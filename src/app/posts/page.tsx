"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  PageHeader,
  Button,
  StatusBadge,
  EmptyState,
  Spinner,
  Tabs,
  HelpIcon,
  Badge,
  Textarea,
} from "@/components/ui";
import { OnboardingStepBar } from "@/components/onboarding-stepbar";
import { PostPreview } from "@/components/post-preview";
import type { Post, Schedule, Brand } from "@/types";

type ViewMode = "list" | "calendar";

const WEEKDAYS = [
  { idx: 0, label: "週日" },
  { idx: 1, label: "週一" },
  { idx: 2, label: "週二" },
  { idx: 3, label: "週三" },
  { idx: 4, label: "週四" },
  { idx: 5, label: "週五" },
  { idx: 6, label: "週六" },
];

function parseTimeSlots(raw: string): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) return j.filter((s) => typeof s === "string");
  } catch {
    /* ignore */
  }
  return [];
}

function platformLabel(p: string) {
  if (p === "facebook") return "📘 Facebook";
  if (p === "instagram") return "📷 Instagram";
  return "📘📷 FB + IG";
}

function nextSlotPreview(weekdayMask: string, slots: string[]): string {
  if (!/^[01]{7}$/.test(weekdayMask) || slots.length === 0) return "";
  const now = new Date();
  for (let off = 0; off < 21; off++) {
    const d = new Date(now);
    d.setDate(d.getDate() + off);
    if (weekdayMask[d.getDay()] !== "1") continue;
    for (const s of slots) {
      const [h, m] = s.split(":").map((n) => parseInt(n, 10));
      if (Number.isNaN(h) || Number.isNaN(m)) continue;
      const t = new Date(d);
      t.setHours(h, m, 0, 0);
      if (t.getTime() > now.getTime()) {
        const wd = ["日", "一", "二", "三", "四", "五", "六"][t.getDay()];
        return `下一篇將於 ${t.getMonth() + 1}/${t.getDate()} (${wd}) ${String(
          t.getHours()
        ).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")} 自動發佈到 FB + IG`;
      }
    }
  }
  return "";
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("list");
  const [platformTab, setPlatformTab] = useState<"all" | "facebook" | "instagram">(
    "all"
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [, setSchedule] = useState<Schedule | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [weekdayMask, setWeekdayMask] = useState("0000000");
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [brand, setBrand] = useState<Pick<Brand, "brand_name" | "logo_url"> | null>(null);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<"facebook" | "instagram">("facebook");
  const [scheduleMode, setScheduleMode] = useState<"auto" | "manual">("auto");
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [manualAssignments, setManualAssignments] = useState<Record<string, number>>({});

  const fetchPosts = useCallback(() => {
    fetch("/api/posts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .finally(() => setLoading(false));
  }, []);

  const fetchSchedule = useCallback(() => {
    fetch("/api/schedules", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const s = d.schedule;
        setSchedule(s ?? null);
        if (s) {
          setScheduleEnabled(s.auto_publish_enabled === "true");
          setWeekdayMask(/^[01]{7}$/.test(s.weekday_mask) ? s.weekday_mask : "0000000");
          setTimeSlots(parseTimeSlots(s.time_slots));
        }
      });
  }, []);

  const fetchBrand = useCallback(() => {
    fetch("/api/brands", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.brand) setBrand({ brand_name: d.brand.brand_name, logo_url: d.brand.logo_url });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchSchedule();
    fetchBrand();
  }, [fetchPosts, fetchSchedule, fetchBrand]);

  const toggleWeekday = (idx: number) => {
    const arr = weekdayMask.split("");
    arr[idx] = arr[idx] === "1" ? "0" : "1";
    setWeekdayMask(arr.join(""));
  };

  const addTimeSlot = () => setTimeSlots((s) => [...s, "09:00"]);
  const removeTimeSlot = (i: number) =>
    setTimeSlots((s) => s.filter((_, idx) => idx !== i));
  const updateTimeSlot = (i: number, v: string) =>
    setTimeSlots((s) => s.map((x, idx) => (idx === i ? v : x)));

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const r = await fetch("/api/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekday_mask: weekdayMask,
          time_slots: timeSlots,
          auto_publish_enabled: scheduleEnabled ? "true" : "false",
          ...(scheduleMode === "manual" && Object.keys(manualAssignments).length > 0
            ? {
                selected_post_ids: Array.from(selectedPostIds),
                assignments: manualAssignments,
              }
            : selectedPostIds.size > 0
            ? { selected_post_ids: Array.from(selectedPostIds) }
            : {}),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(`儲存失敗：${d.error ?? r.statusText}`);
      } else {
        if (d.auto_scheduled > 0) {
          alert(`儲存成功，已自動為 ${d.auto_scheduled} 篇貼文排定發佈時間。`);
        } else {
          alert("儲存成功。");
        }
        fetchPosts();
        fetchSchedule();
      }
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleAction = async (
    postId: string,
    action: "regenerate" | "publish" | "update",
    extra?: Record<string, string>
  ) => {
    if (action === "publish" && !confirm("確定要立即發布這篇貼文嗎？")) return;
    setActingId(postId);
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, post_id: postId, ...(extra ?? {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(`${action} 失敗：${d.error ?? r.statusText}`);
      } else {
        if (action === "regenerate") {
          alert("已開始重新生成，約需 30-60 秒。請看左下角執行進度。");
        }
        await fetchPosts();
      }
    } finally {
      setActingId(null);
      if (action === "update") setEditingId(null);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("確定要刪除這篇貼文嗎？刪除後不可復原。")) return;
    setActingId(postId);
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", post_id: postId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) alert(`刪除失敗：${d.error ?? r.statusText}`);
      else fetchPosts();
    } finally {
      setActingId(null);
    }
  };

  const filtered =
    platformTab === "all"
      ? posts
      : posts.filter((p) => p.platform === platformTab);

  const preview = nextSlotPreview(weekdayMask, timeSlots);

  if (loading) return <Spinner />;

  return (
    <div>
      <OnboardingStepBar />

      <PageHeader
        title="貼文排程"
        description="AI 寫好的文案在這。設定自動排程後，AI 會在你選的時段自動發佈到 FB + IG。"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowSchedulePanel((v) => !v)}
            >
              {showSchedulePanel ? "收起自動排程" : "⚙ 自動排程"}
            </Button>
            <HelpIcon text="這頁列出 AI 寫的所有貼文。點「重新生成此文」讓 AI 重寫；點「立即發布」現在就發。打開上方「自動排程」就能設定 AI 每週固定時間自動發。" />
          </div>
        }
      />

      {/* 自動排程 Panel */}
      {showSchedulePanel && (
        <Card className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">自動排程</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                開啟自動排程 — AI 會自動把草稿依下面設定填入發佈時間
              </span>
            </label>
            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">
                哪幾天發？(可多選)
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((w) => {
                  const active = weekdayMask[w.idx] === "1";
                  return (
                    <button
                      key={w.idx}
                      onClick={() => toggleWeekday(w.idx)}
                      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">
                每天什麼時間發？(可加多個)
              </div>
              <div className="space-y-2">
                {timeSlots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={slot}
                      onChange={(e) => updateTimeSlot(i, e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => removeTimeSlot(i)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      移除
                    </button>
                  </div>
                ))}
                <button
                  onClick={addTimeSlot}
                  className="text-sm text-blue-600 hover:underline"
                >
                  + 加一個時段
                </button>
              </div>
            </div>
            {/* 排程模式 */}
            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">排程模式</div>
              <Tabs
                value={scheduleMode}
                onChange={(v) => setScheduleMode(v as "auto" | "manual")}
                options={[
                  { value: "auto", label: "自動輪發" },
                  { value: "manual", label: "手動指定" },
                ]}
              />
              <p className="mt-1 text-xs text-gray-500">
                {scheduleMode === "auto"
                  ? "按順序自動把草稿填入可用時段。勾選下方貼文可只排部分文章。"
                  : "手動指定每篇貼文要排在哪個星期幾。"}
              </p>
            </div>

            {/* 選擇要排程的貼文 */}
            {(() => {
              const drafts = posts.filter(
                (p) => p.status === "draft" && !p.scheduled_time
              );
              if (drafts.length === 0) return null;
              const enabledDays = WEEKDAYS.filter((w) => weekdayMask[w.idx] === "1");
              return (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-700">
                      選擇要排程的貼文 ({selectedPostIds.size}/{drafts.length})
                    </div>
                    <button
                      onClick={() => {
                        if (selectedPostIds.size === drafts.length) {
                          setSelectedPostIds(new Set());
                        } else {
                          setSelectedPostIds(new Set(drafts.map((p) => p.post_id)));
                        }
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {selectedPostIds.size === drafts.length ? "取消全選" : "全選"}
                    </button>
                  </div>
                  <div className="max-h-60 space-y-1.5 overflow-y-auto">
                    {drafts.map((p) => (
                      <label
                        key={p.post_id}
                        className={`flex items-center gap-2 rounded-md border p-2 text-sm transition-colors ${
                          selectedPostIds.has(p.post_id)
                            ? "border-blue-300 bg-blue-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPostIds.has(p.post_id)}
                          onChange={(e) => {
                            const next = new Set(selectedPostIds);
                            if (e.target.checked) next.add(p.post_id);
                            else {
                              next.delete(p.post_id);
                              const a = { ...manualAssignments };
                              delete a[p.post_id];
                              setManualAssignments(a);
                            }
                            setSelectedPostIds(next);
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Badge color={p.platform === "facebook" ? "blue" : "yellow"}>
                          {p.platform === "facebook" ? "FB" : "IG"}
                        </Badge>
                        <span className="flex-1 truncate text-gray-700">
                          {p.topic_title || p.caption.slice(0, 30)}
                        </span>
                        {scheduleMode === "manual" &&
                          selectedPostIds.has(p.post_id) &&
                          enabledDays.length > 0 && (
                            <select
                              value={manualAssignments[p.post_id] ?? ""}
                              onChange={(e) =>
                                setManualAssignments((prev) => ({
                                  ...prev,
                                  [p.post_id]: Number(e.target.value),
                                }))
                              }
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                            >
                              <option value="">選擇星期</option>
                              {enabledDays.map((w) => (
                                <option key={w.idx} value={w.idx}>
                                  {w.label}
                                </option>
                              ))}
                            </select>
                          )}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })()}

            {preview && (
              <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
                預覽：{preview}
              </div>
            )}
            <div className="flex gap-2 border-t border-gray-100 pt-3">
              <Button onClick={handleSaveSchedule} disabled={savingSchedule}>
                {savingSchedule ? "儲存中…" : "儲存"}
              </Button>
              <span className="self-center text-xs text-gray-500">
                {scheduleMode === "auto"
                  ? selectedPostIds.size > 0
                    ? `儲存後將為選中的 ${selectedPostIds.size} 篇草稿自動排定時間`
                    : "儲存後會把所有「未排程草稿」自動填入下一輪可用時段"
                  : `儲存後將依指定的星期排定 ${Object.keys(manualAssignments).length} 篇貼文`}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* 篩選列 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={platformTab}
          onChange={(v) =>
            setPlatformTab(v as "all" | "facebook" | "instagram")
          }
          options={[
            { value: "all", label: `全部 (${posts.length})` },
            {
              value: "facebook",
              label: `📘 FB (${posts.filter((p) => p.platform === "facebook").length})`,
            },
            {
              value: "instagram",
              label: `📷 IG (${posts.filter((p) => p.platform === "instagram").length})`,
            },
          ]}
        />
        <Tabs
          value={view}
          onChange={(v) => setView(v as ViewMode)}
          options={[
            { value: "list", label: "清單" },
            { value: "calendar", label: "月曆" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="尚無貼文"
          description="去主題管理按「+ 搜尋新主題」，AI 會自動找主題並寫成 14 篇貼文"
        />
      ) : view === "calendar" ? (
        <CalendarView
          posts={filtered}
          month={calendarMonth}
          onPrev={() =>
            setCalendarMonth(
              new Date(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth() - 1,
                1
              )
            )
          }
          onNext={() =>
            setCalendarMonth(
              new Date(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth() + 1,
                1
              )
            )
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p) => (
            <PostCard
              key={p.post_id}
              post={p}
              isEditing={editingId === p.post_id}
              editingCaption={editingCaption}
              setEditingCaption={setEditingCaption}
              startEdit={() => {
                setEditingId(p.post_id);
                setEditingCaption(p.caption);
              }}
              cancelEdit={() => setEditingId(null)}
              busy={actingId === p.post_id}
              onRegenerate={() => handleAction(p.post_id, "regenerate")}
              onPublish={() => handleAction(p.post_id, "publish")}
              onSaveEdit={() =>
                handleAction(p.post_id, "update", { caption: editingCaption })
              }
              onDelete={() => handleDelete(p.post_id)}
              onPreview={() => {
                setPreviewPost(p);
                setPreviewPlatform(
                  p.platform === "instagram" ? "instagram" : "facebook"
                );
              }}
            />
          ))}
        </div>
      )}

      {/* FB/IG 預覽 Modal */}
      {previewPost && brand && (
        <PostPreview
          brandName={brand.brand_name}
          logoUrl={brand.logo_url}
          caption={previewPost.caption}
          imageUrl={previewPost.image_url}
          platform={previewPlatform}
          onPlatformChange={setPreviewPlatform}
          onClose={() => setPreviewPost(null)}
        />
      )}
    </div>
  );
}

function PostCard({
  post,
  isEditing,
  editingCaption,
  setEditingCaption,
  startEdit,
  cancelEdit,
  onRegenerate,
  onPublish,
  onSaveEdit,
  onDelete,
  onPreview,
  busy,
}: {
  post: Post;
  isEditing: boolean;
  editingCaption: string;
  setEditingCaption: (s: string) => void;
  startEdit: () => void;
  cancelEdit: () => void;
  onRegenerate: () => void;
  onPublish: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
  busy: boolean;
}) {
  const isPublished = post.status === "published";
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {post.topic_title && (
            <div className="text-xs text-gray-500">📌 {post.topic_title}</div>
          )}
          <div className="mt-1 flex items-center gap-2">
            <Badge color={post.platform === "facebook" ? "blue" : "yellow"}>
              {platformLabel(post.platform)}
            </Badge>
            <StatusBadge status={post.status} />
            {post.scheduled_time && (
              <span className="text-xs text-gray-500">
                {new Date(post.scheduled_time).toLocaleString("zh-TW", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
      </div>
      {post.image_url && (
        <div className="relative h-40 w-full overflow-hidden rounded-md bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
      {isEditing ? (
        <Textarea
          rows={6}
          value={editingCaption}
          onChange={(e) => setEditingCaption(e.target.value)}
        />
      ) : (
        <div className="whitespace-pre-wrap text-sm text-gray-700 line-clamp-6">
          {post.caption || "(尚無文字)"}
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        {isEditing ? (
          <>
            <Button size="sm" onClick={onSaveEdit} disabled={busy}>
              儲存
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit}>
              取消
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={onRegenerate}
              disabled={busy || isPublished}
              title={isPublished ? "已發布的貼文不能重新生成" : ""}
            >
              {busy ? "處理中…" : "重新生成此文"}
            </Button>
            {!isPublished && (
              <Button size="sm" onClick={onPublish} disabled={busy}>
                {busy ? "發布中…" : "立即發布"}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={startEdit}
              disabled={busy || isPublished}
            >
              編輯
            </Button>
            <Button size="sm" variant="ghost" onClick={onPreview}>
              預覽
            </Button>
            {!isPublished && (
              <Button
                size="sm"
                variant="danger"
                onClick={onDelete}
                disabled={busy}
              >
                刪除
              </Button>
            )}
          </>
        )}
        {(post.fb_post_id || post.ig_post_id) && (
          <a
            target="_blank"
            rel="noopener"
            href={
              post.platform === "facebook"
                ? `https://facebook.com/${post.fb_post_id}`
                : `https://www.instagram.com/p/${post.ig_post_id}/`
            }
            className="ml-auto self-center text-xs text-blue-600 hover:underline"
          >
            看已發布的貼文 ↗
          </a>
        )}
      </div>
    </Card>
  );
}

function CalendarView({
  posts,
  month,
  onPrev,
  onNext,
}: {
  posts: Post[];
  month: Date;
  onPrev: () => void;
  onNext: () => void;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);
  const startWeekday = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const postsByDay = new Map<string, Post[]>();
  for (const p of posts) {
    if (!p.scheduled_time) continue;
    const t = new Date(p.scheduled_time);
    if (t.getFullYear() !== year || t.getMonth() !== m) continue;
    const key = String(t.getDate());
    const arr = postsByDay.get(key) ?? [];
    arr.push(p);
    postsByDay.set(key, arr);
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onPrev} className="text-sm text-gray-600">
          ◀ 上月
        </button>
        <div className="text-base font-semibold">
          {year} 年 {m + 1} 月
        </div>
        <button onClick={onNext} className="text-sm text-gray-600">
          下月 ▶
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
          <div
            key={d}
            className="bg-gray-50 px-1 py-1 text-center text-xs font-medium text-gray-500"
          >
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <div
            key={i}
            className="min-h-20 bg-white p-1 text-xs"
            style={{ minHeight: 80 }}
          >
            {c && (
              <>
                <div className="mb-1 text-right text-gray-500">
                  {c.getDate()}
                </div>
                <div className="space-y-1">
                  {(postsByDay.get(String(c.getDate())) ?? []).map((p) => (
                    <div
                      key={p.post_id}
                      title={p.topic_title || p.caption}
                      className={`truncate rounded px-1 py-0.5 text-[10px] ${
                        p.status === "published"
                          ? "bg-green-100 text-green-700"
                          : p.status === "scheduled"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {p.platform === "facebook" ? "📘" : "📷"}{" "}
                      {p.topic_title || p.caption.slice(0, 8)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
