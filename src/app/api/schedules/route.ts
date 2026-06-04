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

function parseSlots(timeSlotsRaw: string): string[] {
  try {
    const parsed = JSON.parse(timeSlotsRaw);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string");
  } catch {
    /* ignore */
  }
  return [];
}

/** 把該品牌所有（或指定的）未排程 draft posts 依時段填入 scheduled_time */
async function autoFillSchedule(
  brandId: string,
  weekdayMask: string,
  timeSlotsRaw: string,
  onlyPostIds?: string[]
) {
  const slots = parseSlots(timeSlotsRaw);
  if (slots.length === 0) return { scheduled: 0 };

  const all = await getRowsByBrand("posts", brandId);
  let drafts = all
    .filter((p) => p.status === "draft" && !p.scheduled_time)
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));

  if (onlyPostIds && onlyPostIds.length > 0) {
    const set = new Set(onlyPostIds);
    drafts = drafts.filter((p) => set.has(p.post_id));
  }

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
  await bulkUpdateColumn("posts", "post_id", ids, "scheduled_time", timesArr);
  await bulkUpdateColumn("posts", "post_id", ids, "status", ids.map(() => "scheduled"));
  return { scheduled: ids.length };
}

/** 手動指定：每篇貼文排到指定的星期幾（一次性） */
async function manualAssignSchedule(
  brandId: string,
  assignments: Record<string, number>,
  weekdayMask: string,
  timeSlotsRaw: string
) {
  const slots = parseSlots(timeSlotsRaw);
  if (slots.length === 0) return { scheduled: 0 };

  const all = await getRowsByBrand("posts", brandId);
  const postMap = new Map(all.map((p) => [p.post_id, p]));
  const now = new Date();

  const ids: string[] = [];
  const timesArr: string[] = [];

  const byWeekday = new Map<number, string[]>();
  for (const [postId, weekday] of Object.entries(assignments)) {
    const post = postMap.get(postId);
    if (!post || post.status !== "draft") continue;
    const wd = Number(weekday);
    if (Number.isNaN(wd) || wd < 0 || wd > 6) continue;
    if (!byWeekday.has(wd)) byWeekday.set(wd, []);
    byWeekday.get(wd)!.push(postId);
  }

  for (const [weekday, postIds] of byWeekday) {
    const slotsForDay = computeNextSlotsForWeekday(weekday, slots, postIds.length, now);
    for (let i = 0; i < postIds.length; i++) {
      if (!slotsForDay[i]) break;
      ids.push(postIds[i]);
      timesArr.push(slotsForDay[i]);
      const post = postMap.get(postIds[i]);
      if (post?.topic_id) {
        const paired = all.find(
          (p) =>
            p.topic_id === post.topic_id &&
            p.post_id !== postIds[i] &&
            p.status === "draft" &&
            !ids.includes(p.post_id)
        );
        if (paired) {
          ids.push(paired.post_id);
          timesArr.push(slotsForDay[i]);
        }
      }
    }
  }

  if (ids.length === 0) return { scheduled: 0 };
  await bulkUpdateColumn("posts", "post_id", ids, "scheduled_time", timesArr);
  await bulkUpdateColumn("posts", "post_id", ids, "status", ids.map(() => "scheduled"));
  return { scheduled: ids.length };
}

function computeNextSlotsForWeekday(
  weekday: number,
  timeSlots: string[],
  count: number,
  now: Date
): string[] {
  const result: string[] = [];
  for (let dayOffset = 0; result.length < count && dayOffset < 60; dayOffset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    if (d.getDay() !== weekday) continue;
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
      const selectedPostIds = body.selected_post_ids as string[] | undefined;
      const assignments = body.assignments as Record<string, number> | undefined;
      const mask = updates.weekday_mask ?? "0000000";
      const slots = updates.time_slots ?? "[]";

      if (assignments && Object.keys(assignments).length > 0) {
        const result = await manualAssignSchedule(brandId, assignments, mask, slots);
        scheduled = result.scheduled;
      } else {
        const result = await autoFillSchedule(
          brandId,
          mask,
          slots,
          selectedPostIds && selectedPostIds.length > 0 ? selectedPostIds : undefined
        );
        scheduled = result.scheduled;
      }
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
