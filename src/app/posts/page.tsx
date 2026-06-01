"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  PageHeader,
  Button,
  StatusBadge,
  EmptyState,
  Spinner,
  Select,
  Textarea,
  Input,
  Badge,
} from "@/components/ui";
import type { Post, Schedule } from "@/types";

type ViewMode = "list" | "calendar";

const DAYS_OPTIONS = [
  { value: "monday", label: "週一" },
  { value: "tuesday", label: "週二" },
  { value: "wednesday", label: "週三" },
  { value: "thursday", label: "週四" },
  { value: "friday", label: "週五" },
  { value: "saturday", label: "週六" },
  { value: "sunday", label: "週日" },
];

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("list");
  const [generating, setGenerating] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const fetchPosts = useCallback(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .finally(() => setLoading(false));
  }, []);

  const fetchSchedule = useCallback(() => {
    fetch("/api/schedules")
      .then((r) => r.json())
      .then((d) => setSchedule(d.schedule ?? null));
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchSchedule();
  }, [fetchPosts, fetchSchedule]);

  const handleSaveSchedule = async () => {
    if (!schedule) return;
    setSavingSchedule(true);
    try {
      await fetch("/api/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency: schedule.frequency,
          post_times: schedule.post_times,
          topic_discovery_day: schedule.topic_discovery_day,
          analytics_day: schedule.analytics_day,
        }),
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const updateScheduleField = (field: keyof Schedule, value: string) => {
    setSchedule((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      setTimeout(fetchPosts, 5000);
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdatePost = async (postId: string, updates: Partial<Post>) => {
    await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", post_id: postId, ...updates }),
    });
    setPosts((prev) =>
      prev.map((p) => (p.post_id === postId ? { ...p, ...updates } : p))
    );
    setEditingPost(null);
  };

  const handleSchedule = async (postId: string, scheduledTime: string) => {
    await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "schedule",
        post_id: postId,
        scheduled_time: scheduledTime,
      }),
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.post_id === postId
          ? { ...p, status: "scheduled" as const, scheduled_time: scheduledTime }
          : p
      )
    );
  };

  const [publishing, setPublishing] = useState<string | null>(null);
  const handlePublish = async (postId: string) => {
    if (!confirm("確定要立即發布這篇貼文到 FB 與 IG 嗎？")) return;
    setPublishing(postId);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", post_id: postId }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        // Poll for status change
        setTimeout(fetchPosts, 8000);
      } else {
        alert(`發布失敗：${data.error || "請檢查 Meta 設定與 access token"}`);
      }
    } catch (e) {
      alert(`發布失敗：${e instanceof Error ? e.message : "未知錯誤"}`);
    } finally {
      setPublishing(null);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days: Date[] = [];
    const startDay = first.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    for (let i = 1; i <= last.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    while (days.length % 7 !== 0) {
      days.push(new Date(year, month + 1, days.length - last.getDate() - startDay + 1));
    }
    return days;
  };

  const getPostsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return posts.filter((p) => p.scheduled_time?.startsWith(dateStr));
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="貼文排程"
        description="管理、生成與排程社群貼文"
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowSchedulePanel((v) => !v)}
            >
              {showSchedulePanel ? "隱藏排程設定" : "排程設定"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setView(view === "list" ? "calendar" : "list")}
            >
              {view === "list" ? "日曆視圖" : "列表視圖"}
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "生成中..." : "AI 生成貼文"}
            </Button>
          </div>
        }
      />

      {showSchedulePanel && schedule && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">排程設定</h2>
            <Button
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              size="sm"
            >
              {savingSchedule ? "儲存中..." : "儲存"}
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Select
              label="每週發文次數"
              value={schedule.frequency}
              onChange={(e) => updateScheduleField("frequency", e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={String(n)}>
                  {n} 次/週
                </option>
              ))}
            </Select>
            <Input
              label="發文時段（逗號分隔）"
              value={
                (() => {
                  try {
                    return JSON.parse(schedule.post_times).join(", ");
                  } catch {
                    return schedule.post_times;
                  }
                })()
              }
              onChange={(e) =>
                updateScheduleField(
                  "post_times",
                  JSON.stringify(
                    e.target.value.split(",").map((t) => t.trim())
                  )
                )
              }
              placeholder="09:00, 12:00, 18:00"
            />
            <Select
              label="主題搜尋日"
              value={schedule.topic_discovery_day}
              onChange={(e) =>
                updateScheduleField("topic_discovery_day", e.target.value)
              }
            >
              {DAYS_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
            <Select
              label="數據分析日"
              value={schedule.analytics_day}
              onChange={(e) =>
                updateScheduleField("analytics_day", e.target.value)
              }
            >
              {DAYS_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      )}

      {posts.length === 0 ? (
        <EmptyState
          title="尚無貼文"
          description="先批准主題，再點擊「AI 生成貼文」自動生成內容"
          action={
            <Button onClick={handleGenerate} disabled={generating}>
              AI 生成貼文
            </Button>
          }
        />
      ) : view === "list" ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.post_id}>
              {editingPost?.post_id === post.post_id ? (
                <div className="space-y-4">
                  <Textarea
                    label="文案"
                    value={editingPost.caption}
                    onChange={(e) =>
                      setEditingPost({ ...editingPost, caption: e.target.value })
                    }
                    rows={4}
                  />
                  <Textarea
                    label="圖片提示詞"
                    value={editingPost.image_prompt}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        image_prompt: e.target.value,
                      })
                    }
                    rows={2}
                  />
                  <Select
                    label="平台"
                    value={editingPost.platform}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        platform: e.target.value as Post["platform"],
                      })
                    }
                  >
                    <option value="both">Facebook + Instagram</option>
                    <option value="facebook">僅 Facebook</option>
                    <option value="instagram">僅 Instagram</option>
                  </Select>
                  <Input
                    label="排程時間"
                    type="datetime-local"
                    value={editingPost.scheduled_time?.slice(0, 16) ?? ""}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        scheduled_time: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : "",
                      })
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        handleUpdatePost(post.post_id, {
                          caption: editingPost.caption,
                          image_prompt: editingPost.image_prompt,
                          platform: editingPost.platform,
                        })
                      }
                    >
                      儲存
                    </Button>
                    <Button variant="secondary" onClick={() => setEditingPost(null)}>
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex gap-2">
                      <Badge color="blue">
                        {post.platform === "both"
                          ? "FB + IG"
                          : post.platform === "facebook"
                          ? "Facebook"
                          : "Instagram"}
                      </Badge>
                      <StatusBadge status={post.status} />
                      {post.optimization_version > 0 && (
                        <Badge color="green">v{post.optimization_version}</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {(post.status === "draft" || post.status === "scheduled") && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handlePublish(post.post_id)}
                          disabled={publishing === post.post_id}
                        >
                          {publishing === post.post_id ? "發布中..." : "立即發布"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingPost({ ...post })}
                      >
                        編輯
                      </Button>
                    </div>
                  </div>
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="post image"
                      className="mb-3 max-h-64 rounded-md border border-gray-200 object-cover"
                    />
                  )}
                  <p className="mb-2 whitespace-pre-wrap text-sm text-gray-700">
                    {post.caption || "(尚無文案)"}
                  </p>
                  {post.image_prompt && (
                    <p className="mb-2 text-xs text-gray-400">
                      圖片提示: {post.image_prompt}
                    </p>
                  )}
                  {post.scheduled_time && (
                    <p className="mb-2 text-xs text-gray-500">
                      排程時間:{" "}
                      {new Date(post.scheduled_time).toLocaleString("zh-TW")}
                    </p>
                  )}
                  {(post.fb_post_id || post.ig_post_id) && (
                    <div className="mb-2 flex gap-3 text-xs text-gray-500">
                      {post.fb_post_id && <span>FB: {post.fb_post_id}</span>}
                      {post.ig_post_id && <span>IG: {post.ig_post_id}</span>}
                    </div>
                  )}
                  {post.status === "draft" && (
                    <div className="flex gap-2">
                      <Input
                        type="datetime-local"
                        className="w-auto"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleSchedule(
                              post.post_id,
                              new Date(e.target.value).toISOString()
                            );
                          }
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() =>
                setCalendarMonth(
                  new Date(
                    calendarMonth.getFullYear(),
                    calendarMonth.getMonth() - 1,
                    1
                  )
                )
              }
            >
              ← 上月
            </Button>
            <h2 className="text-lg font-semibold">
              {calendarMonth.getFullYear()} 年{" "}
              {calendarMonth.getMonth() + 1} 月
            </h2>
            <Button
              variant="ghost"
              onClick={() =>
                setCalendarMonth(
                  new Date(
                    calendarMonth.getFullYear(),
                    calendarMonth.getMonth() + 1,
                    1
                  )
                )
              }
            >
              下月 →
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
              <div key={d} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-500">
                {d}
              </div>
            ))}
            {getDaysInMonth(calendarMonth).map((date, i) => {
              const dayPosts = getPostsForDate(date);
              const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
              return (
                <div
                  key={i}
                  className={`min-h-[80px] bg-white p-1 ${
                    isCurrentMonth ? "" : "opacity-40"
                  }`}
                >
                  <div className="text-xs text-gray-500">{date.getDate()}</div>
                  {dayPosts.map((p) => (
                    <div
                      key={p.post_id}
                      className={`mt-0.5 truncate rounded px-1 text-xs ${
                        p.status === "published"
                          ? "bg-green-100 text-green-700"
                          : p.status === "scheduled"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                      title={p.caption}
                    >
                      {p.caption?.slice(0, 15) || "貼文"}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
