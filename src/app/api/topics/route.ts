import { NextRequest, NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import {
  getRowsByBrand,
  updateRow,
  bulkUpdateColumn,
} from "@/lib/google-sheets";
import { triggerWorkflow } from "@/lib/n8n";
import { redactError } from "@/lib/redact";
import { formatDate } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const includeArchived =
      req.nextUrl.searchParams.get("include_archived") === "1";
    const all = await getRowsByBrand("topics", brandId);
    const topics = includeArchived
      ? all
      : all.filter((t) => !t.archived_at);
    return NextResponse.json({ topics });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json(
      { error: redactError(e) || "伺服器錯誤" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const body = await req.json();
    const { action, topic_id, status } = body;

    if (action === "discover") {
      // 1) 一次性把該品牌所有未封存主題標 archived（單一 batchUpdate，避免配額爆）
      const all = await getRowsByBrand("topics", brandId);
      const now = formatDate(new Date());
      const toArchive = all
        .filter((t) => !t.archived_at && t.topic_id)
        .map((t) => t.topic_id);
      const archived = await bulkUpdateColumn(
        "topics",
        "topic_id",
        toArchive,
        "archived_at",
        toArchive.map(() => now)
      );
      // 2) 把使用者的搜尋條件全部轉發給 n8n
      const result = await triggerWorkflow("topic-discovery", {
        brand_id: brandId,
        search_keyword: body.keyword ?? "",
        content_type: body.content_type ?? "",
        target_reader: body.target_reader ?? "",
        recency_days: body.recency_days ?? "",
      });
      return NextResponse.json({ ...result, archived });
    }

    if (action === "archive_all") {
      const all = await getRowsByBrand("topics", brandId);
      const now = formatDate(new Date());
      const ids = all
        .filter((t) => !t.archived_at && t.topic_id)
        .map((t) => t.topic_id);
      const n = await bulkUpdateColumn(
        "topics",
        "topic_id",
        ids,
        "archived_at",
        ids.map(() => now)
      );
      return NextResponse.json({ success: true, archived: n });
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
    return NextResponse.json(
      { error: redactError(e) || "伺服器錯誤" },
      { status: 500 }
    );
  }
}
