import { NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import { getRows } from "@/lib/google-sheets";

export async function POST() {
  try {
    const brandId = await requireBrandId();
    const rows = await getRows("brands", (r) => r.brand_id === brandId);
    const brand = rows[0];
    if (!brand) {
      return NextResponse.json({ error: "找不到品牌" }, { status: 404 });
    }
    const token = brand.meta_access_token;
    if (!token) {
      return NextResponse.json({ error: "尚未設定 Meta Access Token" }, { status: 400 });
    }

    const result: {
      fb_page_name?: string;
      ig_username?: string;
      errors: string[];
    } = { errors: [] };

    // Test FB Page
    if (brand.fb_page_id) {
      try {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${brand.fb_page_id}?fields=name&access_token=${encodeURIComponent(token)}`
        );
        const d = await r.json();
        if (r.ok && d.name) {
          result.fb_page_name = d.name;
        } else {
          result.errors.push(`FB Page: ${d.error?.message || "未知錯誤"}`);
        }
      } catch (e) {
        result.errors.push(`FB Page: ${e instanceof Error ? e.message : "網路錯誤"}`);
      }
    }

    // Test IG Business Account
    if (brand.ig_account_id) {
      try {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${brand.ig_account_id}?fields=username&access_token=${encodeURIComponent(token)}`
        );
        const d = await r.json();
        if (r.ok && d.username) {
          result.ig_username = d.username;
        } else {
          result.errors.push(`IG: ${d.error?.message || "未知錯誤"}`);
        }
      } catch (e) {
        result.errors.push(`IG: ${e instanceof Error ? e.message : "網路錯誤"}`);
      }
    }

    if (!brand.fb_page_id && !brand.ig_account_id) {
      return NextResponse.json(
        { error: "請至少設定 FB Page ID 或 IG Business Account ID" },
        { status: 400 }
      );
    }

    if (result.errors.length > 0 && !result.fb_page_name && !result.ig_username) {
      return NextResponse.json(
        { error: result.errors.join("; ") },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG") {
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "伺服器錯誤" },
      { status: 500 }
    );
  }
}
