"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  Button,
  Spinner,
  HelpIcon,
  Badge,
  EmptyState,
} from "@/components/ui";
import { OnboardingStepBar } from "@/components/onboarding-stepbar";
import type { Brand, Post } from "@/types";
import { formatDateDisplay } from "@/lib/utils";

function isSameLocalDay(iso: string, ref: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function withinDays(iso: string, days: number, ref: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  const diff = ref.getTime() - d.getTime();
  return diff >= 0 && diff <= days * 86400000;
}

function platformChip(p: string) {
  if (p === "facebook") return "📘 Facebook";
  if (p === "instagram") return "📷 Instagram";
  return "📘📷 FB + IG";
}

const REQUIRED_BRAND_FIELDS: (keyof Brand)[] = [
  "brand_name",
  "theme",
  "tone",
  "target_audience",
  "meta_access_token",
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    Promise.all([
      fetch("/api/posts", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { posts: [] }
      ),
      fetch("/api/brands", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { brand: null }
      ),
    ]).then(([postsR, brandR]) => {
      setPosts(postsR.posts ?? []);
      setBrand(brandR.brand ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) return <Spinner />;

  const now = new Date();
  const todayPosts = posts
    .filter(
      (p) => p.status === "scheduled" && isSameLocalDay(p.scheduled_time, now)
    )
    .sort((a, b) =>
      (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "")
    );
  const draftUnscheduled = posts.filter(
    (p) => p.status === "draft" && !p.scheduled_time
  );
  const recentPublished = posts
    .filter(
      (p) =>
        p.status === "published" &&
        (withinDays(p.scheduled_time, 7, now) ||
          withinDays(p.created_at ?? "", 7, now))
    )
    .sort((a, b) =>
      (b.scheduled_time ?? b.created_at ?? "").localeCompare(
        a.scheduled_time ?? a.created_at ?? ""
      )
    )
    .slice(0, 10);
  const missingBrandFields = brand
    ? REQUIRED_BRAND_FIELDS.filter((f) => !brand[f])
    : REQUIRED_BRAND_FIELDS;

  const handlePublish = async (postId: string) => {
    if (!confirm("確定要立即發布這篇貼文嗎？")) return;
    setPublishing(postId);
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", post_id: postId }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`發布失敗：${d.error ?? r.statusText}`);
      } else {
        await fetchAll();
      }
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div>
      <OnboardingStepBar />

      <PageHeader
        title="今天要做的事"
        description="這裡只顯示需要你看的資訊。其他細節在左邊選單。"
        actions={
          <HelpIcon text="這是首頁。上方顯示你目前完成到哪一步，下面是你今天要看的事。第一次使用照著上方步驟做。" />
        }
      />

      {/* 1. 今天要發的文 */}
      <Card className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          今天要發的文 ({todayPosts.length})
        </h2>
        {todayPosts.length === 0 ? (
          <p className="text-sm text-gray-500">今天沒有預定要發的貼文。</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {todayPosts.map((p) => (
              <li
                key={p.post_id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge color="blue">
                      {new Date(p.scheduled_time).toLocaleTimeString("zh-TW", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {platformChip(p.platform)}
                    </span>
                  </div>
                  {p.topic_title && (
                    <div className="mt-1 text-xs text-gray-500">
                      📌 {p.topic_title}
                    </div>
                  )}
                  <div className="mt-1 line-clamp-2 text-sm text-gray-700">
                    {p.caption}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handlePublish(p.post_id)}
                    disabled={publishing === p.post_id}
                  >
                    {publishing === p.post_id ? "發布中..." : "現在發"}
                  </Button>
                  <Link href={`/posts?focus=${p.post_id}`}>
                    <Button size="sm" variant="secondary">
                      看詳情
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 2. 待處理事項 */}
      <Card className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          待處理事項
        </h2>
        <ul className="space-y-2 text-sm">
          {missingBrandFields.length > 0 && (
            <li className="flex items-center justify-between">
              <span className="text-gray-700">
                品牌設定還有 {missingBrandFields.length} 個欄位沒填
                <span className="ml-2 text-xs text-gray-400">
                  ({missingBrandFields.slice(0, 3).join(", ")}
                  {missingBrandFields.length > 3 ? "…" : ""})
                </span>
              </span>
              <Link href="/brand">
                <Button size="sm" variant="secondary">
                  去填寫
                </Button>
              </Link>
            </li>
          )}
          {draftUnscheduled.length > 0 && (
            <li className="flex items-center justify-between">
              <span className="text-gray-700">
                有 {draftUnscheduled.length} 篇 AI 寫好的草稿還沒安排發布時間
              </span>
              <Link href="/posts">
                <Button size="sm" variant="secondary">
                  去排程
                </Button>
              </Link>
            </li>
          )}
          {missingBrandFields.length === 0 && draftUnscheduled.length === 0 && (
            <li className="text-sm text-gray-500">沒有待處理事項，做得好 🎉</li>
          )}
        </ul>
      </Card>

      {/* 3. 最近 7 天發佈的文 */}
      <Card className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          最近 7 天發布過的貼文
        </h2>
        {recentPublished.length === 0 ? (
          <EmptyState
            title="近 7 天沒有發布過貼文"
            description="開始排程，AI 會幫你自動發到 Facebook + Instagram"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-gray-500">
                  <th className="pb-2 pr-4">主題 / 文字</th>
                  <th className="pb-2 pr-4">平台</th>
                  <th className="pb-2 pr-4">時間</th>
                  <th className="pb-2">看貼文</th>
                </tr>
              </thead>
              <tbody>
                {recentPublished.map((p) => (
                  <tr key={p.post_id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">
                      <div className="line-clamp-1 max-w-md text-gray-700">
                        {p.topic_title || p.caption}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-600">
                      {platformChip(p.platform)}
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-500">
                      {formatDateDisplay(
                        p.scheduled_time || p.created_at || ""
                      )}
                    </td>
                    <td className="py-2 text-xs">
                      {p.platform === "facebook" && p.fb_post_id && (
                        <a
                          className="text-blue-600 hover:underline"
                          target="_blank"
                          rel="noopener"
                          href={`https://facebook.com/${p.fb_post_id}`}
                        >
                          FB ↗
                        </a>
                      )}
                      {p.platform === "instagram" && p.ig_post_id && (
                        <a
                          className="text-blue-600 hover:underline"
                          target="_blank"
                          rel="noopener"
                          href={`https://www.instagram.com/p/${p.ig_post_id}/`}
                        >
                          IG ↗
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 4. 主 CTA */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-6 py-8 text-center">
        <h3 className="text-base font-semibold text-gray-900">沒事可做嗎？</h3>
        <p className="mt-1 text-sm text-gray-600">
          按下方按鈕，AI 會幫你找 7 個熱門主題並各寫一篇貼文。
        </p>
        <Link href="/topics">
          <Button className="mt-4 px-6 py-3 text-base">+ 找新主題</Button>
        </Link>
      </div>
    </div>
  );
}
