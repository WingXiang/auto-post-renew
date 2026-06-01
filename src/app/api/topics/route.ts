import { NextRequest, NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import { getRowsByBrand, updateRow } from "@/lib/google-sheets";
import { triggerWorkflow } from "@/lib/n8n";

export async function GET() {
  try {
    const brandId = await requireBrandId();
    const topics = await getRowsByBrand("topics", brandId);
    return NextResponse.json({ topics });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const { action, topic_id, status } = await req.json();

    if (action === "discover") {
      const result = await triggerWorkflow("topic-discovery", {
        brand_id: brandId,
      });
      return NextResponse.json(result);
    }

    if (action === "update_status" && topic_id && status) {
      const updated = await updateRow("topics", "topic_id", topic_id, {
        status,
      });
      return NextResponse.json({ success: updated });
    }

    return NextResponse.json({ error: "無效的操作" }, { status: 400 });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
