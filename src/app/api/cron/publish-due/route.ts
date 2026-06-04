import { NextRequest, NextResponse } from "next/server";
import { getRows, updateRow } from "@/lib/google-sheets";
import { triggerWorkflow } from "@/lib/n8n";
import { formatDate } from "@/lib/utils";
import { redactError } from "@/lib/redact";

/**
 * Cron endpoint that publishes any post whose scheduled_time has passed.
 *
 * Triggered by Vercel Cron every 15 min (see vercel.json).
 * Auth: Vercel attaches `Authorization: Bearer ${CRON_SECRET}` when calling
 * cron paths. If CRON_SECRET is unset, the endpoint is open (dev convenience);
 * production must set CRON_SECRET in env.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const allPosts = await getRows("posts");
    const due = allPosts.filter((p) => {
      if (p.status !== "scheduled") return false;
      if (!p.scheduled_time) return false;
      const t = new Date(p.scheduled_time);
      if (Number.isNaN(t.getTime())) return false;
      return t.getTime() <= now.getTime();
    });

    if (due.length === 0) {
      return NextResponse.json({ checked: allPosts.length, due: 0 });
    }

    // Mark as publishing so we don't fire twice if cron overlaps
    const nowIso = formatDate(now);
    await Promise.all(
      due.map((p) =>
        updateRow("posts", "post_id", p.post_id, {
          status: "publishing",
          updated_at: nowIso,
        })
      )
    );

    // Trigger n8n post-scheduler for each due post (fire-and-forget)
    const results = await Promise.allSettled(
      due.map((p) =>
        triggerWorkflow("post-scheduler", {
          brand_id: p.brand_id,
          post_id: p.post_id,
        })
      )
    );

    const succeeded = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.length - succeeded;

    // For posts whose webhook failed, roll back status so next cron retries
    await Promise.all(
      results.map((r, i) => {
        if (r.status === "fulfilled" && r.value.success) return null;
        return updateRow("posts", "post_id", due[i].post_id, {
          status: "scheduled",
          updated_at: nowIso,
        });
      })
    );

    return NextResponse.json({
      checked: allPosts.length,
      due: due.length,
      succeeded,
      failed,
      post_ids: due.map((p) => p.post_id),
    });
  } catch (e) {
    return NextResponse.json(
      { error: redactError(e) || "伺服器錯誤" },
      { status: 500 }
    );
  }
}
