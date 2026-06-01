import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireBrandId } from "@/lib/auth";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少檔案" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "只接受圖片檔" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "檔案不能超過 5MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "png";
    const safeName = `${brandId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const blob = await put(safeName, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG") {
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "上傳失敗" },
      { status: 500 }
    );
  }
}
