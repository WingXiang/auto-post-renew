// 封面版型庫 — 共用邏輯（無 React / 無 Node 專屬 API，client 與 server 皆可 import）
//
// 設計理念：網站產生貼文時，依「貼文內容」自動判斷版型（金句 / 故事 / 重點整理），
// 萃取出標題、副標、條列項目，再交給 /api/cover 即時渲染成 1080×1080 PNG 當配圖。
// 全部判斷邏輯集中在這裡 —— n8n 只需把原始 caption/title 丟給 /api/cover，由網站決定版型。

/** Wing Style 品牌色 */
export const WING = {
  primary: "#2A4189", // 深藍（主色）
  secondary: "#C67E13", // 橙（輔色）
  accent: "#FDBD3B", // 黃橙（重點色）
  ink: "#1B2A52", // 深藍墨（淺底文字）
  paper: "#F4F6FB", // 淺底
  paperLine: "#E2E7F2", // 淺底分隔線
} as const;

export type TemplateId = "quote" | "story" | "list";

export interface TemplateMeta {
  id: TemplateId;
  name: string; // 顯示名稱
  badge: string; // 封面上的分類標籤
  when: string; // 適用時機
  trigger: string; // 自動觸發條件（給版型庫頁說明）
  sample: { title: string; subtitle?: string; items?: string[] };
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "quote",
    name: "金句型",
    badge: "金句",
    when: "一句到位的觀點、痛點或結論，要讓人停下來。",
    trigger: "貼文很短，或標題帶驚嘆／問號的有力短句時自動採用。",
    sample: {
      title: "別再用昨天的方法，解決明天的問題。",
      subtitle: "趨勢不等人，跟上的人先拿到入場券",
    },
  },
  {
    id: "story",
    name: "故事型",
    badge: "觀點",
    when: "敘事、案例分享、帶情境的觀點文。",
    trigger: "一般長文（非條列）時的預設版型。",
    sample: {
      title: "他用 3 個月，把流量變成穩定客源",
      subtitle: "關鍵不是花更多錢，而是把對的內容放對位置",
    },
  },
  {
    id: "list",
    name: "重點整理型",
    badge: "重點整理",
    when: "可條列的步驟、清單、懶人包。",
    trigger: "貼文內含 3 項以上條列（1. 2. 3.／・／-）時自動採用。",
    sample: {
      title: "新手做社群最常踩的 4 個坑",
      items: [
        "只發自己想說的，不管受眾要什麼",
        "三天打魚兩天曬網，沒有固定節奏",
        "貼文沒有鉤子，滑過就忘了",
        "從不看數據，憑感覺一直重來",
      ],
    },
  },
];

export const TEMPLATE_IDS: TemplateId[] = TEMPLATES.map((t) => t.id);

/** 從 caption 萃取條列項目（支援 1. / 1、/ 1) / ① / ・ / - / • 等開頭） */
export function extractListItems(caption: string): string[] {
  const items: string[] = [];
  for (const raw of caption.split(/\r?\n/)) {
    const ln = raw.trim();
    if (!ln) continue;
    const m = ln.match(
      /^(?:\d{1,2}[.、)）．]|[①-⑳]|[•·・\-–—▪▶✦*])\s*(.+)$/
    );
    if (m) {
      const text = m[1].replace(/^[\s:：]+/, "").trim();
      if (text.length >= 2) items.push(text);
    }
  }
  return items;
}

/** 依標題 + 內文自動判斷版型 */
export function classify(title: string, caption: string): TemplateId {
  if (extractListItems(caption).length >= 3) return "list";
  const plain = caption.replace(/\s/g, "");
  if (plain.length <= 60) return "quote";
  const t = (title || "").trim();
  if (/[！!？?]/.test(t) && t.length <= 26) return "quote";
  return "story";
}

function clip(s: string, max: number): string {
  const v = (s || "").replace(/\s+/g, " ").trim();
  return v.length > max ? v.slice(0, max - 1) + "…" : v;
}

/** 取第一句（到句號／問號／驚嘆號為止） */
function firstSentence(s: string, max: number): string {
  const seg =
    (s || "").replace(/\r?\n/g, " ").split(/(?<=[。！？!?])/)[0] || s || "";
  return clip(seg, max);
}

export interface CoverFields {
  template: TemplateId;
  title: string;
  subtitle: string;
  items: string[];
  badge: string;
  brand: string;
}

/**
 * 從原始貼文內容萃取出封面所需欄位。
 * title 優先用 topic_title；沒有就用內文第一句。
 */
export function extractFields(opts: {
  title?: string;
  caption?: string;
  brand?: string;
  template?: TemplateId;
  badge?: string;
}): CoverFields {
  const caption = opts.caption || "";
  const rawTitle = (opts.title || "").trim() || firstSentence(caption, 30);
  const template = opts.template || classify(rawTitle, caption);
  const meta = TEMPLATES.find((t) => t.id === template) || TEMPLATES[1];

  const title = clip(rawTitle, template === "list" ? 28 : 40);
  let subtitle = "";
  let items: string[] = [];

  if (template === "list") {
    items = extractListItems(caption)
      .slice(0, 5)
      .map((s) => clip(s, 26));
    if (items.length === 0) items = meta.sample.items ?? [];
  } else {
    // 副標：取內文第一句（若與標題不同）
    const fs = firstSentence(caption, 40);
    subtitle = fs && fs !== title ? fs : "";
  }

  return {
    template,
    title,
    subtitle,
    items,
    badge: opts.badge || meta.badge,
    brand: clip(opts.brand || "", 20),
  };
}

/** 由欄位組出 /api/cover 的查詢字串（給 n8n / 版型庫 / 預覽共用） */
export function buildCoverQuery(fields: Partial<CoverFields>): string {
  const p = new URLSearchParams();
  if (fields.template) p.set("template", fields.template);
  if (fields.title) p.set("title", fields.title);
  if (fields.subtitle) p.set("subtitle", fields.subtitle);
  if (fields.items?.length) p.set("items", fields.items.join("|"));
  if (fields.badge) p.set("badge", fields.badge);
  if (fields.brand) p.set("brand", fields.brand);
  return p.toString();
}
