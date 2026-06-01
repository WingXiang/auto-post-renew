import { NextRequest, NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import { getRowsByBrand, updateRow } from "@/lib/google-sheets";
import { triggerWorkflow } from "@/lib/n8n";
import { formatDate } from "@/lib/utils";

export async function GET() {
  try {
    const brandId = await requireBrandId();
    const schedules = await getRowsByBrand("schedules", brandId);
    const schedule = schedules[0] ?? null;
    return NextResponse.json({ schedule });
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

    const updates: Record<string, string> = {
      updated_at: formatDate(new Date()),
    };
    for (const field of [
      "frequency",
      "post_times",
      "topic_discovery_day",
      "analytics_day",
    ]) {
      if (body[field] !== undefined) {
        updates[field] =
          typeof body[field] === "object"
            ? JSON.stringify(body[field])
            : String(body[field]);
      }
    }

    const updated = await updateRow("schedules", "brand_id", brandId, updates);
    if (!updated) {
      return NextResponse.json({ error: "排程不存在" }, { status: 404 });
    }

    await triggerWorkflow("update-schedule", {
      brand_id: brandId,
      ...updates,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
