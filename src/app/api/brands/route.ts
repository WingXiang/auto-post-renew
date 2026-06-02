import { NextRequest, NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import { getRows, updateRow } from "@/lib/google-sheets";

export async function GET() {
  try {
    const brandId = await requireBrandId();
    const rows = await getRows("brands", (r) => r.brand_id === brandId);
    const brand = rows[0] ?? null;
    return NextResponse.json({ brand });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const body = await req.json();

    const updates: Record<string, string> = {};
    const allowedFields = [
      "brand_name",
      "theme",
      "style",
      "tone",
      "target_audience",
      "past_content_samples",
      "past_content_urls", // NEW
      "fb_page_id",
      "ig_account_id",
      "meta_access_token",
      "logo_url",
      "primary_color",
      "secondary_color",
      "font_preference",
      "visual_keywords",
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = String(body[field]);
      }
    }

    const updated = await updateRow("brands", "brand_id", brandId, updates);
    if (!updated) {
      return NextResponse.json({ error: "品牌不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
