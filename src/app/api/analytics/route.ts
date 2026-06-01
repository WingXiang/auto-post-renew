import { NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import { getRowsByBrand } from "@/lib/google-sheets";
import { triggerWorkflow } from "@/lib/n8n";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const brandId = await requireBrandId();
    const [analytics, optimizationLogs] = await Promise.all([
      getRowsByBrand("analytics", brandId),
      getRowsByBrand("optimization_log", brandId),
    ]);
    return NextResponse.json({ analytics, optimizationLogs });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const { action } = await req.json();

    if (action === "collect") {
      const result = await triggerWorkflow("analytics-collection", {
        brand_id: brandId,
      });
      return NextResponse.json(result);
    }

    if (action === "optimize") {
      const result = await triggerWorkflow("weekly-optimization", {
        brand_id: brandId,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "無效的操作" }, { status: 400 });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
