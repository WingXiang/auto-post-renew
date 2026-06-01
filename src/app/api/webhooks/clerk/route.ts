import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { appendRow } from "@/lib/google-sheets";
import { triggerWorkflow } from "@/lib/n8n";
import { generateId, formatDate } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing webhook secret" },
      { status: 500 }
    );
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  const body = await req.text();

  let evt: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof evt;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (evt.type === "organization.created") {
    const orgId = evt.data.id as string;
    const orgName = evt.data.name as string;

    await appendRow("brands", {
      brand_id: orgId,
      brand_name: orgName,
      theme: "",
      style: "",
      tone: "",
      target_audience: "",
      past_content_samples: "",
      fb_page_id: "",
      ig_account_id: "",
      meta_access_token: "",
    });

    await appendRow("schedules", {
      schedule_id: generateId(),
      brand_id: orgId,
      frequency: "3",
      post_times: JSON.stringify(["09:00", "12:00", "18:00"]),
      topic_discovery_day: "monday",
      analytics_day: "sunday",
      updated_at: formatDate(new Date()),
    });

    await triggerWorkflow("brand-setup", {
      brand_id: orgId,
      brand_name: orgName,
    });
  }

  return NextResponse.json({ success: true });
}
