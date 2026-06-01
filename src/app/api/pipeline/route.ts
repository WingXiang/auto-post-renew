import { NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import { getRowsByBrand } from "@/lib/google-sheets";

export async function GET() {
  try {
    const brandId = await requireBrandId();
    const logs = await getRowsByBrand("pipeline_logs", brandId);
    const sorted = logs.sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );
    return NextResponse.json({ logs: sorted.slice(0, 50) });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
