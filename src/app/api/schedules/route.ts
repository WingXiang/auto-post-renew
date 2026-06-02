import { NextRequest, NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import {
  getRowsByBrand,
  updateRow,
  appendRow,
  bulkUpdateColumn,
} from "@/lib/google-sheets";
import { triggerWorkflow } from "@/lib/n8n";
import { formatDate, generateId } from "@/lib/utils";
import { redactError } from "@/lib/redact";

export async function GET() {
  try {
    const brandId = await requireBrandId();
    const schedules = await getRowsByBrand("schedules", brandId);
    const schedule = schedules[0] ?? null;
    return NextResponse.json({ schedule });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json(
      { error: redactError(e) || "伺服器錯誤" },
      { status: 500 }
    );
  }
}

/** 按 weekday_mask + time_slots 計算接下來 N 個發文時間點 */
function computeNextSlots(
  weekdayMask: string,
  timeSlots: string[],
  count: number
): string[] {
  if (!/^[01]{7}$/.test(weekdayMask) || timeSlots.length === 0) return [];
  const result: string[] = [];
  const now = new Date();
  for (let dayOffset = 0; result.length < count && dayOffset < 60; dayOffset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    const dayIdx = d.getDay(); // 0=Sun..6=Sat
    if (weekdayMask[dayIdx] !== "1") continue;
    for (const slot of timeSlots) {
      const [hh, mm] = slot.split(":").map((n) => parseInt(n, 10));
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
      const t = new Date(d);
      t.setHours(hh, mm, 0, 0);
      if (t.getTime() > now.getTime()) {
        result.push(t.toISOString());
        if (result.length >= count) break;
      }
    }
  }
  return result;
}

/** 把該品牌所有未排程的 draft posts 依時段填入 scheduled_time（接 IG / FB 兩篇配成一組） */
async function autoFillSchedule(
  brandId: string,
  weekdayMask: string,
  timeSlotsRaw: string
) {
  let slots: string[] = [];
  try {
    const parsed = JSON.parse(timeSlotsRaw);
    if (Array.isArray(parsed)) slots = parsed.filter((s) => typeof s === "string");
  } catch {
    slots = [];
  }
  if (slots.length === 0) return { scheduled: 0 };

  const all = await getRowsByBrand("posts", brandId);
  const drafts = all
    .filter((p) => p.status === "draft" && !p.scheduled_time)
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));

  // 同一 topic_id 的 FB / IG 兩篇用同個時段 → 先依 topic_id 分組
  const groups: Record<string, typeof drafts> = {};
  const order: string[] = [];
  for (const p of drafts) {
    const key = p.topic_id || `solo:${p.post_id}`;
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(p);
  }

  const times = computeNextSlots(weekdayMask, slots, order.length);
  // 收集 post_id 與目標時間，最後做 2 個 batchUpdate（status + scheduled_time）
  const ids: string[] = [];
  const timesArr: string[] = [];
  for (let i = 0; i < order.length; i++) {
    const t = times[i];
    if (!t) break;
    for (const p of groups[order[i]]) {
      ids.push(p.post_id);
      timesArr.push(t);
    }
  }
  if (ids.length === 0) return { scheduled: 0 };
  await bulkUpdateColumn(
    "posts",
    "post_id",
    ids,
    "scheduled_time",
    timesArr
  );
  await bulkUpdateColumn(
    "posts",
    "post_id",
    ids,
    "status",
    ids.map(() => "scheduled")
  );
  return { scheduled: ids.length };
}

export async function PUT(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const body = await req.json();

    const updates: Record<string, string> = {
      updated_at: formatDate(new Date()),
    };

    // 新 schema
    if (body.weekday_mask !== undefined)
      updates.weekday_mask = String(body.weekday_mask);
    if (body.time_slots !== undefined)
      updates.time_slots =
        typeof body.time_slots === "object"
          ? JSON.stringify(body.time_slots)
          : String(body.time_slots);
    if (body.auto_publish_enabled !== undefined)
      updates.auto_publish_enabled = String(body.auto_publish_enabled);

    // 舊欄位仍接受，兼容
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

    // 若該品牌尚未有 schedule 列，append 一筆
    const existing = await getRowsByBrand("schedules", brandId);
    if (existing.length === 0) {
      await appendRow("schedules", {
        schedule_id: generateId("sch"),
        brand_id: brandId,
        weekday_mask: updates.weekday_mask ?? "0000000",
        time_slots: updates.time_slots ?? "[]",
        auto_publish_enabled: updates.auto_publish_enabled ?? "false",
        frequency: updates.frequency ?? "0",
        post_times: updates.post_times ?? "[]",
        topic_discovery_day: updates.topic_discovery_day ?? "",
        analytics_day: updates.analytics_day ?? "",
        updated_at: updates.updated_at,
      });
    } else {
      const updated = await updateRow(
        "schedules",
        "brand_id",
        brandId,
        updates
      );
      if (!updated) {
        return NextResponse.json({ error: "排程不存在" }, { status: 404 });
      }
    }

    // 若啟用自動排程，把 draft 自動填時段
    let scheduled = 0;
    if (updates.auto_publish_enabled === "true") {
      const result = await autoFillSchedule(
        brandId,
        updates.weekday_mask ?? "0000000",
        updates.time_slots ?? "[]"
      );
      scheduled = result.scheduled;
    }

    await triggerWorkflow("update-schedule", {
      brand_id: brandId,
      ...updates,
    });

    return NextResponse.json({ success: true, auto_scheduled: scheduled });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json(
      { error: redactError(e) || "伺服器錯誤" },
      { status: 500 }
    );
  }
}
