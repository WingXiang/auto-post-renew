import { TEMPLATES, buildCoverQuery, WING } from "@/lib/cover";

export const metadata = { title: "封面版型庫" };

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">封面版型庫</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          系統會在<strong>產生貼文時，依內容自動挑選最適合的版型</strong>，即時渲染成
          1080×1080 的配圖，並接進自動發文流程 —— 你不需要手動做圖。
          下方是目前的版型與它們的自動觸發條件（皆採用你的品牌色 Wing Style）。
        </p>
      </header>

      <div
        className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-4 text-sm"
        style={{ borderColor: WING.paperLine, background: WING.paper }}
      >
        <span className="font-medium text-gray-700">品牌色：</span>
        {[
          { c: WING.primary, n: "主色 深藍" },
          { c: WING.secondary, n: "輔色 橙" },
          { c: WING.accent, n: "重點 黃橙" },
        ].map((x) => (
          <span key={x.c} className="flex items-center gap-2 text-gray-600">
            <span
              className="inline-block h-4 w-4 rounded"
              style={{ background: x.c }}
            />
            {x.n} <code className="text-xs text-gray-400">{x.c}</code>
          </span>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => {
          const q = buildCoverQuery({
            template: t.id,
            title: t.sample.title,
            subtitle: t.sample.subtitle,
            items: t.sample.items,
            badge: t.badge,
            brand: "Wing Style",
          });
          return (
            <div
              key={t.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/cover?${q}`}
                alt={`${t.name} 版型範例`}
                width={1080}
                height={1080}
                className="aspect-square w-full bg-gray-100"
              />
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-900">
                    {t.name}
                  </h2>
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium text-white"
                    style={{ background: WING.primary }}
                  >
                    {t.badge}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{t.when}</p>
                <p className="text-xs leading-relaxed text-gray-400">
                  <span className="font-medium text-gray-500">自動觸發：</span>
                  {t.trigger}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-10 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">運作方式</h2>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-gray-600">
          <li>
            <strong>1. 產文</strong>：n8n 產生貼文文案後，把標題與內文交給
            <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
              /api/cover
            </code>
            。
          </li>
          <li>
            <strong>2. 自動選版型</strong>：網站依內容判斷 —— 有 3 項以上條列 →
            重點整理型；很短或有力短句 → 金句型；其餘長文 → 故事型。
          </li>
          <li>
            <strong>3. 即時產圖</strong>：用品牌色渲染成 1080×1080 PNG，網址即為該貼文配圖。
          </li>
          <li>
            <strong>4. 自動發文</strong>：配圖網址寫入貼文，隨排程發布到 FB／IG。
          </li>
        </ol>
      </section>
    </div>
  );
}
