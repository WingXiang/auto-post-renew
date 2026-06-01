import { NextRequest, NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import { getRowsByBrand, updateRow } from "@/lib/google-sheets";
import { triggerWorkflow } from "@/lib/n8n";

export async function GET() {
  try {
    const brandId = await requireBrandId();
    const customers = await getRowsByBrand("potential_customers", brandId);
    return NextResponse.json({ customers });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const { action, customer_id, status } = await req.json();

    if (action === "identify") {
      const result = await triggerWorkflow("customer-identification", {
        brand_id: brandId,
      });
      return NextResponse.json(result);
    }

    if (action === "update_status" && customer_id && status) {
      const updated = await updateRow(
        "potential_customers",
        "customer_id",
        customer_id,
        { status }
      );
      return NextResponse.json({ success: updated });
    }

    return NextResponse.json({ error: "無效的操作" }, { status: 400 });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
