import { NextResponse } from "next/server";
import { initializeSpreadsheet } from "@/lib/google-sheets";

export async function POST() {
  try {
    await initializeSpreadsheet();
    return NextResponse.json({ success: true, message: "工作表初始化完成" });
  } catch (e) {
    return NextResponse.json(
      {
        error: "初始化失敗",
        details: e instanceof Error ? e.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
