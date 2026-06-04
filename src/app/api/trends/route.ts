import { NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import { getRowsByBrand } from "@/lib/google-sheets";
import { redactError } from "@/lib/redact";
import type { TrendItem } from "@/types";

const SERPER_API_KEY = process.env.SERPER_API_KEY ?? "";

async function searchSerper(
  query: string,
  tbs = "qdr:m"
): Promise<{ title: string; link: string; snippet: string }[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, gl: "tw", hl: "zh-TW", num: 10, tbs }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.organic ?? []).map(
    (r: { title: string; link: string; snippet: string }) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet ?? "",
    })
  );
}

export async function POST() {
  try {
    const brandId = await requireBrandId();

    if (!SERPER_API_KEY) {
      return NextResponse.json(
        { error: "SERPER_API_KEY 未設定" },
        { status: 500 }
      );
    }

    const brands = await getRowsByBrand("brands", brandId);
    const brand = brands[0];
    const theme = brand?.theme || "社群行銷";
    const audience = brand?.target_audience || "";

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const queries = [
      `${theme} 社群趨勢 ${year} ${month}月`,
      `Facebook Instagram 熱門話題 最新 ${theme}`,
      audience
        ? `${theme} ${audience} 痛點 趨勢 ${year}`
        : `${theme} 產業趨勢 ${year}`,
    ];

    const allResults = await Promise.all(
      queries.map((q) => searchSerper(q, "qdr:m"))
    );

    const seen = new Set<string>();
    const trends: TrendItem[] = [];
    for (const results of allResults) {
      for (const r of results) {
        if (seen.has(r.link)) continue;
        seen.add(r.link);
        trends.push({
          title: r.title,
          snippet: r.snippet,
          source_url: r.link,
        });
      }
    }

    return NextResponse.json({ trends: trends.slice(0, 15) });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    return NextResponse.json(
      { error: redactError(e) || "伺服器錯誤" },
      { status: 500 }
    );
  }
}
