import { NextRequest, NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import { getRowsByBrand, updateRow } from "@/lib/google-sheets";
import { redactError } from "@/lib/redact";

const STALL_THRESHOLD_MS = 10 * 60 * 1000; // 10 分鐘

function annotate(log: Record<string, string>) {
  const isRunning = log.status === "running";
  const startedAt = log.started_at ? new Date(log.started_at).getTime() : 0;
  const stalled =
    isRunning && startedAt > 0 && Date.now() - startedAt > STALL_THRESHOLD_MS;
  return { ...log, stalled };
}

export async function GET(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const statusFilter = req.nextUrl.searchParams.get("status"); // 'active' / 'running' / 'success' / 'failed'
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");

    const all = await getRowsByBrand("pipeline_logs", brandId);
    let filtered = all;
    if (statusFilter === "active") {
      filtered = all.filter((l) => l.status === "running");
    } else if (statusFilter) {
      filtered = all.filter((l) => l.status === statusFilter);
    }
    const sorted = filtered.sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );
    const logs = sorted.slice(0, limit).map(annotate);
    return NextResponse.json({ logs });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json(
      { error: redactError(e) || "伺服器錯誤" },
      { status: 500 }
    );
  }
}

// DELETE /api/pipeline?id=<log_id>       → 標單一 stalled 為 failed
// DELETE /api/pipeline?clear=stalled     → 把該品牌全部 stalled 標 failed
export async function DELETE(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const id = req.nextUrl.searchParams.get("id");
    const clear = req.nextUrl.searchParams.get("clear");

    if (id) {
      const ok = await updateRow("pipeline_logs", "log_id", id, {
        status: "failed",
        message: "由使用者手動標記為失敗（執行卡住超過 10 分鐘）",
        finished_at: new Date().toISOString(),
      });
      return NextResponse.json({ success: ok });
    }

    if (clear === "stalled") {
      const all = await getRowsByBrand("pipeline_logs", brandId);
      const now = Date.now();
      const stalled = all.filter(
        (l) =>
          l.status === "running" &&
          l.started_at &&
          now - new Date(l.started_at).getTime() > STALL_THRESHOLD_MS
      );
      for (const l of stalled) {
        await updateRow("pipeline_logs", "log_id", l.log_id, {
          status: "failed",
          message: "自動標記為失敗（執行卡住超過 10 分鐘）",
          finished_at: new Date().toISOString(),
        });
      }
      return NextResponse.json({ success: true, cleared: stalled.length });
    }

    return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json(
      { error: redactError(e) || "伺服器錯誤" },
      { status: 500 }
    );
  }
}
