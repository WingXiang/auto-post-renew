import { NextRequest, NextResponse } from "next/server";
import { requireBrandId } from "@/lib/auth";
import { getRows } from "@/lib/google-sheets";
import { redactError, redactSecrets } from "@/lib/redact";
import * as cheerio from "cheerio";

type SourceType = "fb" | "ig" | "web";

interface FetchResult {
  title: string;
  excerpt: string;
  source_type: SourceType;
  fetched_at: string;
}

function detectSource(url: string): SourceType {
  if (/(?:^|\.)facebook\.com\//i.test(url)) return "fb";
  if (/(?:^|\.)instagram\.com\//i.test(url)) return "ig";
  return "web";
}

/** 抓 FB 貼文 — URL 形如:
 *   https://www.facebook.com/{page}/posts/{numeric_id}
 *   https://www.facebook.com/permalink.php?story_fbid={id}&id={page_id}
 *   https://www.facebook.com/{page}/posts/pfbid... (新 base64 id)
 */
async function fetchFb(url: string, token: string): Promise<FetchResult> {
  // 嘗試萃取 post id
  let postId = "";
  const m1 = url.match(/\/posts\/(?:pfbid[A-Za-z0-9]+|\d+)/);
  if (m1) {
    postId = m1[0].split("/").pop() || "";
  } else {
    const u = new URL(url);
    postId =
      u.searchParams.get("story_fbid") ||
      u.searchParams.get("v") ||
      "";
  }
  if (!postId) throw new Error("無法從 URL 解析 Facebook 貼文 ID");

  const r = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(
      postId
    )}?fields=message,permalink_url,created_time&access_token=${encodeURIComponent(
      token
    )}`,
    { cache: "no-store" }
  );
  const d = await r.json();
  if (!r.ok || !d.message) {
    throw new Error(d.error?.message || "FB 抓取失敗");
  }
  return {
    title: d.permalink_url
      ? `FB 貼文 (${d.created_time?.slice(0, 10) ?? ""})`
      : "FB 貼文",
    excerpt: String(d.message).slice(0, 2000),
    source_type: "fb",
    fetched_at: new Date().toISOString(),
  };
}

/** 抓 IG 貼文 — URL 形如 https://www.instagram.com/p/{shortcode}/
 *  Graph API 沒有「直接從 URL 拿貼文」的 endpoint，要列該 ig_user_id 的 media 找 shortcode 比對。
 */
async function fetchIg(
  url: string,
  token: string,
  igAccountId: string
): Promise<FetchResult> {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!m) throw new Error("無法從 URL 解析 Instagram shortcode");
  const shortcode = m[1];

  if (!igAccountId) {
    throw new Error("品牌尚未設定 IG Business Account ID，無法抓 IG 貼文");
  }

  // Paginate 找 shortcode（FB Graph API 沒有直接 query by shortcode）
  let next: string | null = `https://graph.facebook.com/v21.0/${encodeURIComponent(
    igAccountId
  )}/media?fields=caption,permalink,shortcode,media_type,timestamp&limit=50&access_token=${encodeURIComponent(
    token
  )}`;
  for (let page = 0; page < 6 && next; page++) {
    const r: Response = await fetch(next, { cache: "no-store" });
    const d: {
      data?: {
        shortcode?: string;
        caption?: string;
        permalink?: string;
        timestamp?: string;
      }[];
      paging?: { next?: string };
      error?: { message?: string };
    } = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "IG 抓取失敗");
    const found = d.data?.find((item) => item.shortcode === shortcode);
    if (found) {
      return {
        title: `IG 貼文 (${found.timestamp?.slice(0, 10) ?? ""})`,
        excerpt: String(found.caption ?? "").slice(0, 2000),
        source_type: "ig",
        fetched_at: new Date().toISOString(),
      };
    }
    next = d.paging?.next ?? null;
  }
  throw new Error("找不到此 IG 貼文 (可能不屬於已連線的 IG 帳號)");
}

/** 抓任意公開網頁，取 title + og:description + 主要 article 文字 */
async function fetchWeb(url: string): Promise<FetchResult> {
  const r = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; auto-post-renew/1.0; +https://auto-post-renew.vercel.app)",
      accept: "text/html,*/*",
    },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text() ||
    "(無標題)";

  let excerpt =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";

  // 主內文：article > main > body — 取最長的
  const candidates = ["article", "main", '[role="main"]', ".post", ".article"];
  let bodyText = "";
  for (const sel of candidates) {
    const t = $(sel).first().text().trim();
    if (t.length > bodyText.length) bodyText = t;
  }
  if (!bodyText) bodyText = $("body").text().trim();
  bodyText = bodyText.replace(/\s+/g, " ").trim();
  if (bodyText && bodyText.length > excerpt.length) {
    excerpt = bodyText;
  }
  return {
    title: title.trim().slice(0, 200),
    excerpt: excerpt.slice(0, 2000),
    source_type: "web",
    fetched_at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const brandId = await requireBrandId();
    const { url } = await req.json();
    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "缺少 url" }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "URL 格式錯誤" }, { status: 400 });
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return NextResponse.json(
        { error: "只接受 http/https URL" },
        { status: 400 }
      );
    }

    const source = detectSource(url);

    if (source === "fb" || source === "ig") {
      const brands = await getRows(
        "brands",
        (r) => r.brand_id === brandId
      );
      const brand = brands[0];
      const token = brand?.meta_access_token ?? "";
      if (!token) {
        return NextResponse.json(
          { error: "品牌尚未設定 Meta Access Token，無法抓 FB/IG 貼文" },
          { status: 400 }
        );
      }
      const result =
        source === "fb"
          ? await fetchFb(url, token)
          : await fetchIg(url, token, brand?.ig_account_id ?? "");
      return NextResponse.json(result);
    }

    const result = await fetchWeb(url);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ORG")
      return NextResponse.json({ error: "請先選擇品牌" }, { status: 400 });
    // 把抓取失敗回 200，UI 用 error 欄判斷
    return NextResponse.json({
      error: redactSecrets(redactError(e)) || "抓取失敗",
    });
  }
}
