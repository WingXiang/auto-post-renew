import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { redactError } from "@/lib/redact";

// Auth via shared secret (called from n8n, not user)
const N8N_API_KEY = process.env.N8N_API_KEY!;

// 用 timing-safe 比較避免微弱的 timing oracle
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { api_key, base64, filename, content_type } = body as {
      api_key?: string;
      base64?: string;
      filename?: string;
      content_type?: string;
    };

    if (!api_key || !safeEqual(api_key, N8N_API_KEY)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!base64) {
      return NextResponse.json({ error: "缺少 base64" }, { status: 400 });
    }

    // Strip data: URI prefix if present
    const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleaned, "base64");

    const mime = content_type || "image/png";
    const ext = mime.split("/")[1] || "png";
    const safeName =
      filename && filename.length < 120
        ? filename.replace(/[^a-zA-Z0-9._/-]/g, "_")
        : `gen/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const blob = await put(safeName, buffer, {
      access: "public",
      contentType: mime,
    });
    return NextResponse.json({ url: blob.url, size: buffer.length });
  } catch (e) {
    return NextResponse.json(
      { error: redactError(e) || "上傳失敗" },
      { status: 500 }
    );
  }
}
