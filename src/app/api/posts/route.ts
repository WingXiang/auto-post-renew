import { NextRequest, NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import {
  getRowsByBrand,
  appendRow,
  updateRow,
  getRows,
} from "@/lib/google-sheets";
import { triggerWorkflow } from "@/lib/n8n";
import { generateId, formatDate } from "@/lib/utils";
import { redactError } from "@/lib/redact";

export async function GET(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const platform = req.nextUrl.searchParams.get("platform");
    const all = await getRowsByBrand("posts", brandId);
    const posts =
      platform && ["facebook", "instagram", "both"].includes(platform)
        ? all.filter((p) => p.platform === platform)
        : all;
    return NextResponse.json({ posts });
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
    const { action, topic_id, post_id, ...data } = await req.json();

    if (action === "generate") {
      const result = await triggerWorkflow("content-generation", {
        brand_id: brandId,
        topic_id,
      });
      return NextResponse.json(result);
    }

    if (action === "regenerate" && post_id) {
      // 找出 post 對應的 topic_id 後重新觸發 content-generation 的 update 模式
      const all = await getRows(
        "posts",
        (r) => r.brand_id === brandId && r.post_id === post_id
      );
      const post = all[0];
      if (!post) {
        return NextResponse.json({ error: "貼文不存在" }, { status: 404 });
      }
      const result = await triggerWorkflow("content-generation", {
        brand_id: brandId,
        topic_id: post.topic_id ?? "",
        post_id,
        mode: "regenerate",
      });
      return NextResponse.json(result);
    }

    if (action === "create") {
      const post = {
        post_id: generateId(),
        brand_id: brandId,
        topic_id: topic_id ?? "",
        topic_title: data.topic_title ?? "",
        platform: data.platform ?? "both",
        caption: data.caption ?? "",
        image_prompt: data.image_prompt ?? "",
        image_url: "",
        scheduled_time: data.scheduled_time ?? "",
        status: "draft",
        fb_post_id: "",
        ig_post_id: "",
        optimization_version: "0",
        created_at: formatDate(new Date()),
      };
      await appendRow("posts", post);
      return NextResponse.json({ success: true, post });
    }

    if (action === "schedule" && post_id) {
      await updateRow("posts", "post_id", post_id, {
        status: "scheduled",
        scheduled_time: data.scheduled_time ?? "",
      });
      return NextResponse.json({ success: true });
    }

    if (action === "update" && post_id) {
      const updates: Record<string, string> = {};
      for (const field of [
        "caption",
        "image_prompt",
        "platform",
        "scheduled_time",
        "status",
      ]) {
        if (data[field] !== undefined) updates[field] = String(data[field]);
      }
      await updateRow("posts", "post_id", post_id, updates);
      return NextResponse.json({ success: true });
    }

    if (action === "publish") {
      const result = await triggerWorkflow("post-scheduler", {
        brand_id: brandId,
        post_id,
      });
      return NextResponse.json(result);
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
