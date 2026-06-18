import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import {
  WING,
  extractFields,
  type CoverFields,
  type TemplateId,
} from "@/lib/cover";

export const runtime = "nodejs";

const SIZE = 1080;

/**
 * 動態載入 Noto Sans TC 字型子集（只抓畫面會用到的字，URL 小、速度快）。
 * 用舊版 User-Agent 讓 Google Fonts 回傳 ttf（Satori 不吃 woff2）。
 */
async function loadFonts(text: string) {
  const chars = Array.from(new Set(Array.from(text + "0123456789．・|／—－.%")))
    .join("")
    .slice(0, 600);
  const out: { name: string; data: ArrayBuffer; weight: 500 | 900; style: "normal" }[] =
    [];
  await Promise.all(
    ([500, 900] as const).map(async (weight) => {
      try {
        const css = await fetch(
          `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@${weight}&text=${encodeURIComponent(
            chars
          )}`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 6.1; rv:6.0) Gecko/20110814 Firefox/6.0",
            },
          }
        ).then((r) => r.text());
        const url = css.match(
          /src:\s*url\(([^)]+)\)\s*format\(['"]?(?:truetype|opentype)['"]?\)/
        )?.[1];
        if (!url) return;
        const data = await fetch(url).then((r) => r.arrayBuffer());
        out.push({ name: "Noto Sans TC", data, weight, style: "normal" });
      } catch {
        /* 字型載入失敗就略過，下方有 fallback */
      }
    })
  );
  return out;
}

/** 角落裝飾方塊 */
function Corner({
  color,
  pos,
}: {
  color: string;
  pos: "tl" | "br";
}) {
  const base = {
    position: "absolute" as const,
    width: 220,
    height: 220,
    display: "flex",
    opacity: 0.18,
    borderRadius: 28,
    background: color,
  };
  return pos === "tl" ? (
    <div style={{ ...base, top: -70, left: -70 }} />
  ) : (
    <div style={{ ...base, bottom: -70, right: -70 }} />
  );
}

function BrandTag({ brand, color }: { brand: string; color: string }) {
  if (!brand) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          display: "flex",
          width: 18,
          height: 18,
          borderRadius: 5,
          background: WING.accent,
        }}
      />
      <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color }}>
        {brand}
      </div>
    </div>
  );
}

function QuoteTemplate(f: CoverFields) {
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: WING.primary,
        padding: 90,
        fontFamily: "Noto Sans TC",
      }}
    >
      <Corner color={WING.accent} pos="tl" />
      <Corner color={WING.secondary} pos="br" />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <BrandTag brand={f.brand} color="rgba(255,255,255,0.92)" />
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: 4,
            color: WING.accent,
          }}
        >
          {f.badge}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 150,
            lineHeight: 0.8,
            fontWeight: 900,
            color: WING.accent,
            marginBottom: 8,
          }}
        >
          “
        </div>
        <div
          style={{
            display: "flex",
            fontSize: f.title.length > 22 ? 70 : 86,
            lineHeight: 1.28,
            fontWeight: 900,
            color: "#FFFFFF",
          }}
        >
          {f.title}
        </div>
        {f.subtitle ? (
          <div
            style={{
              display: "flex",
              marginTop: 34,
              fontSize: 36,
              fontWeight: 500,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {f.subtitle}
          </div>
        ) : null}
      </div>
      <div
        style={{ display: "flex", width: 160, height: 10, background: WING.accent }}
      />
    </div>
  );
}

function StoryTemplate(f: CoverFields) {
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        display: "flex",
        position: "relative",
        background: WING.primary,
        fontFamily: "Noto Sans TC",
      }}
    >
      <div style={{ display: "flex", width: 22, height: SIZE, background: WING.accent }} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 88,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              background: WING.accent,
              color: WING.primary,
              fontSize: 28,
              fontWeight: 900,
              padding: "12px 28px",
              borderRadius: 999,
            }}
          >
            {f.badge}
          </div>
          <BrandTag brand={f.brand} color="rgba(255,255,255,0.92)" />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: f.title.length > 18 ? 76 : 92,
              lineHeight: 1.22,
              fontWeight: 900,
              color: "#FFFFFF",
            }}
          >
            {f.title}
          </div>
          {f.subtitle ? (
            <div
              style={{
                display: "flex",
                marginTop: 40,
                fontSize: 40,
                fontWeight: 500,
                lineHeight: 1.45,
                color: WING.accent,
              }}
            >
              {f.subtitle}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "rgba(255,255,255,0.6)",
            fontSize: 26,
            fontWeight: 500,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 56,
              height: 6,
              background: "rgba(255,255,255,0.5)",
            }}
          />
          {f.brand || "AutoPost"}
        </div>
      </div>
    </div>
  );
}

function ListTemplate(f: CoverFields) {
  const items = f.items.slice(0, 5);
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        display: "flex",
        flexDirection: "column",
        background: WING.paper,
        fontFamily: "Noto Sans TC",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: WING.primary,
          padding: "56px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: 3,
              color: WING.accent,
            }}
          >
            {f.badge}
          </div>
          <BrandTag brand={f.brand} color="rgba(255,255,255,0.9)" />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: f.title.length > 16 ? 58 : 68,
            lineHeight: 1.2,
            fontWeight: 900,
            color: "#FFFFFF",
          }}
        >
          {f.title}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "40px 80px",
          gap: 26,
        }}
      >
        {items.map((it, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 30 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 74,
                height: 74,
                borderRadius: 20,
                background: WING.accent,
                color: WING.primary,
                fontSize: 40,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                display: "flex",
                flex: 1,
                fontSize: 38,
                fontWeight: 900,
                lineHeight: 1.25,
                color: WING.ink,
              }}
            >
              {it}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function render(f: CoverFields) {
  if (f.template === "list") return ListTemplate(f);
  if (f.template === "quote") return QuoteTemplate(f);
  return StoryTemplate(f);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const templateParam = sp.get("template") as TemplateId | null;

  // 兩種呼叫方式：
  //  1) 明確欄位：template / title / subtitle / items / badge / brand（版型庫預覽用）
  //  2) 原始內容：title + caption（n8n 直接丟，由網站自動分版型）
  const fields: CoverFields = extractFields({
    title: sp.get("title") || undefined,
    caption: sp.get("caption") || undefined,
    brand: sp.get("brand") || undefined,
    badge: sp.get("badge") || undefined,
    template: templateParam || undefined,
  });
  // 明確帶 subtitle / items 時覆蓋自動萃取結果
  if (sp.get("subtitle")) fields.subtitle = sp.get("subtitle")!;
  if (sp.get("items"))
    fields.items = sp
      .get("items")!
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);

  const allText = [
    fields.title,
    fields.subtitle,
    fields.badge,
    fields.brand,
    ...fields.items,
    "“”",
  ].join("");

  try {
    const fonts = await loadFonts(allText);
    return new ImageResponse(render(fields), {
      width: SIZE,
      height: SIZE,
      fonts: fonts.length
        ? fonts.map((ft) => ({
            name: ft.name,
            data: ft.data,
            weight: ft.weight,
            style: ft.style,
          }))
        : undefined,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    // 字型／渲染失敗 → 回傳純色底圖，確保配圖永遠有值（FB/IG 不會抓到 500）
    return new ImageResponse(
      (
        <div
          style={{
            width: SIZE,
            height: SIZE,
            display: "flex",
            background: WING.primary,
          }}
        />
      ),
      { width: SIZE, height: SIZE }
    );
  }
}
