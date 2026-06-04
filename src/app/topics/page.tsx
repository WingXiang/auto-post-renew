"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  Button,
  EmptyState,
  Spinner,
  Badge,
  Input,
  Select,
  HelpIcon,
  ViewToggle,
} from "@/components/ui";
import { OnboardingStepBar } from "@/components/onboarding-stepbar";
import type { Topic, TrendItem } from "@/types";

const CONTENT_TYPES = ["", "教學", "案例分享", "觀點", "工具評測", "趨勢"];
const READERS = ["", "新手", "進階", "決策者"];
const RECENCY = [
  { value: "", label: "不限" },
  { value: "7", label: "近 7 天" },
  { value: "30", label: "近 30 天" },
  { value: "90", label: "近 90 天" },
];

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [view, setView] = useState<"card" | "list">("card");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Trend search state
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [selectedTrends, setSelectedTrends] = useState<Set<number>>(new Set());
  const [searchingTrends, setSearchingTrends] = useState(false);

  // Search form state
  const [keyword, setKeyword] = useState("");
  const [contentType, setContentType] = useState("");
  const [targetReader, setTargetReader] = useState("");
  const [recencyDays, setRecencyDays] = useState("");

  const fetchTopics = useCallback(
    (archived = includeArchived) => {
      const url = archived ? "/api/topics?include_archived=1" : "/api/topics";
      fetch(url, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setTopics(d.topics ?? []))
        .finally(() => setLoading(false));
    },
    [includeArchived]
  );

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const handleSearchTrends = async () => {
    setSearchingTrends(true);
    try {
      const r = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(`趨勢搜尋失敗：${d.error ?? r.statusText}`);
        return;
      }
      const items: TrendItem[] = d.trends ?? [];
      setTrends(items);
      setSelectedTrends(new Set(items.map((_, i) => i)));
    } finally {
      setSearchingTrends(false);
    }
  };

  const toggleTrend = (idx: number) => {
    setSelectedTrends((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    const selectedTrendItems = trends.filter((_, i) => selectedTrends.has(i));
    try {
      const r = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "discover",
          keyword: keyword.trim(),
          content_type: contentType,
          target_reader: targetReader,
          recency_days: recencyDays,
          trends: selectedTrendItems.length > 0 ? selectedTrendItems : undefined,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`搜尋失敗：${d.error ?? r.statusText}`);
        return;
      }
      setShowSearch(false);
      // 提示使用者：搜尋是 fire-and-forget；給 60s 後再 refresh
      alert(
        "搜尋已啟動。AI 正在搜尋主題並產生 7 篇貼文，約需 2-3 分鐘。\n\n你可以在左下角「執行進度」看處理狀況，完成後回來重新整理頁面。"
      );
      // poll until 7 new topics appear or 4 minutes
      const start = Date.now();
      const poll = async () => {
        await new Promise((r) => setTimeout(r, 10_000));
        const rr = await fetch("/api/topics", { cache: "no-store" });
        const dd = await rr.json();
        const fresh = (dd.topics ?? []).filter(
          (t: Topic) => !t.archived_at
        ) as Topic[];
        setTopics(dd.topics ?? []);
        if (fresh.length >= 1) return;
        if (Date.now() - start < 4 * 60_000) return poll();
      };
      poll();
    } finally {
      setDiscovering(false);
    }
  };

  const visible = includeArchived ? topics : topics.filter((t) => !t.archived_at);
  const archivedCount = topics.filter((t) => t.archived_at).length;

  if (loading) return <Spinner />;

  return (
    <div>
      <OnboardingStepBar />

      <PageHeader
        title="主題管理"
        description="AI 幫你找熱門主題，並自動寫成 FB / IG 貼文草稿。"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowSearch((v) => !v)}>
              {showSearch ? "收起搜尋" : "+ 搜尋新主題"}
            </Button>
            <HelpIcon text="按「搜尋新主題」會在 2-3 分鐘內找 7 個熱門主題，並各自寫成一篇 FB + 一篇 IG 草稿（共 14 篇）。舊的主題會自動封存隱藏。" />
          </div>
        }
      />

      {showSearch && (
        <Card className="mb-6">
          {/* Step 1: 趨勢搜尋 */}
          <div className="mb-4 border-b border-gray-100 pb-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Step 1：探索近期社群趨勢（可選）
              </h3>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSearchTrends}
                disabled={searchingTrends}
              >
                {searchingTrends ? "搜尋中…" : "🔥 搜尋近期趨勢"}
              </Button>
            </div>
            {trends.length > 0 && (
              <div className="space-y-2">
                {trends.map((t, i) => (
                  <label
                    key={i}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 transition-colors ${
                      selectedTrends.has(i)
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTrends.has(i)}
                      onChange={() => toggleTrend(i)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">
                        {t.title}
                      </div>
                      {t.snippet && (
                        <div className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                          {t.snippet}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
                <div className="text-xs text-gray-500">
                  已選 {selectedTrends.size} 個趨勢，將與下方關鍵字合併搜尋
                </div>
              </div>
            )}
            {trends.length === 0 && (
              <p className="text-xs text-gray-500">
                點「搜尋近期趨勢」讓 AI 參考社群熱門話題來找主題。也可以跳過，直接填關鍵字搜尋。
              </p>
            )}
          </div>

          {/* Step 2: 關鍵字搜尋 */}
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Step 2：告訴 AI 你想找什麼樣的主題
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="關鍵字（最重要）"
              placeholder="例如：AI 自動化在電商的應用"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              label="內容類型"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t || "all"} value={t}>
                  {t || "不限"}
                </option>
              ))}
            </Select>
            <Select
              label="目標讀者"
              value={targetReader}
              onChange={(e) => setTargetReader(e.target.value)}
            >
              {READERS.map((r) => (
                <option key={r || "all"} value={r}>
                  {r || "不限"}
                </option>
              ))}
            </Select>
            <Select
              label="時事性"
              value={recencyDays}
              onChange={(e) => setRecencyDays(e.target.value)}
            >
              {RECENCY.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleDiscover} disabled={discovering}>
              {discovering ? "搜尋中…" : "開始搜尋"}
            </Button>
            <span className="text-xs text-gray-500">
              搜尋將清空目前的主題列表（自動封存，不會真的刪除）
            </span>
          </div>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          顯示 {visible.length} 個主題
          {archivedCount > 0 && (
            <button
              onClick={() => {
                const next = !includeArchived;
                setIncludeArchived(next);
                fetchTopics(next);
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              {includeArchived
                ? "隱藏已封存"
                : `顯示已封存 (${archivedCount})`}
            </button>
          )}
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="還沒有主題"
          description="按上方「+ 搜尋新主題」讓 AI 自動找 7 個熱門主題並寫成貼文"
          action={
            <Button onClick={() => setShowSearch(true)}>+ 搜尋新主題</Button>
          }
        />
      ) : view === "card" ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <TopicCard
              key={t.topic_id}
              topic={t}
              expanded={expanded === t.topic_id}
              onToggle={() =>
                setExpanded(expanded === t.topic_id ? null : t.topic_id)
              }
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500">
                <th className="px-4 py-3">主題</th>
                <th className="px-4 py-3">類型</th>
                <th className="px-4 py-3">相關度</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.topic_id} className="border-b border-gray-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 line-clamp-1">
                      {t.topic_title}
                    </div>
                    {t.brand_relevance && (
                      <div className="mt-1 text-xs text-gray-500 line-clamp-1">
                        {t.brand_relevance}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {t.content_type || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <RelevanceBadge score={t.relevance_score} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/posts?topic_id=${encodeURIComponent(
                        t.topic_id
                      )}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      看貼文 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function RelevanceBadge({ score }: { score: number | string }) {
  const n = typeof score === "string" ? Number(score) : score;
  const color = n >= 80 ? "green" : n >= 60 ? "yellow" : "gray";
  return <Badge color={color}>{Number.isFinite(n) ? `${n}` : "—"}</Badge>;
}

function TopicCard({
  topic,
  expanded,
  onToggle,
}: {
  topic: Topic;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${
        expanded ? "border-blue-300 ring-1 ring-blue-100" : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-2">
        <h3 className="flex-1 text-sm font-semibold text-gray-900 line-clamp-2">
          {topic.topic_title}
        </h3>
        <RelevanceBadge score={topic.relevance_score} />
      </div>
      {topic.content_type && (
        <div className="mt-2">
          <Badge color="blue">{topic.content_type}</Badge>
          {topic.target_reader && (
            <span className="ml-1">
              <Badge color="gray">{topic.target_reader}</Badge>
            </span>
          )}
        </div>
      )}
      <button
        onClick={onToggle}
        className="mt-3 text-xs text-blue-600 hover:underline"
      >
        {expanded ? "收起" : "看詳情 →"}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 text-xs">
          {topic.brand_relevance && (
            <div>
              <div className="font-semibold text-gray-700">為什麼相關</div>
              <div className="text-gray-600">{topic.brand_relevance}</div>
            </div>
          )}
          {topic.suggested_angles && (
            <div>
              <div className="font-semibold text-gray-700">建議撰寫角度</div>
              <div className="text-gray-600">{topic.suggested_angles}</div>
            </div>
          )}
          {topic.source_url && (
            <a
              href={topic.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-blue-600 hover:underline"
            >
              {topic.source_url}
            </a>
          )}
          <Link
            href={`/posts?topic_id=${encodeURIComponent(topic.topic_id)}`}
            className="inline-block rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            看 AI 寫的貼文 →
          </Link>
        </div>
      )}
    </div>
  );
}
