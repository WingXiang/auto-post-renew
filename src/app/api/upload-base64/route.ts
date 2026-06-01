import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// Auth via shared secret (called from n8n, not user)
const N8N_API_KEY = process.env.N8N_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { api_key, base64, filename, content_type } = body as {
      api_key?: string;
      base64?: string;
      filename?: string;
      content_type?: string;
    };

    if (!api_key || api_key !== N8N_API_KEY) {
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
      { error: e instanceof Error ? e.message : "上傳失敗" },
      { status: 500 }
    );
  }
}
