"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, PageHeader, Button, Spinner, Badge } from "@/components/ui";
import type { Analytics, OptimizationLog } from "@/types";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [optimizationLogs, setOptimizationLogs] = useState<OptimizationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const fetchData = useCallback(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        setAnalytics(d.analytics ?? []);
        setOptimizationLogs(d.optimizationLogs ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "collect" }),
      });
      setTimeout(fetchData, 5000);
    } finally {
      setCollecting(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "optimize" }),
      });
      setTimeout(fetchData, 5000);
    } finally {
      setOptimizing(false);
    }
  };

  const sorted = [...analytics].sort(
    (a, b) => Number(b.engagement_rate) - Number(a.engagement_rate)
  );
  const top3 = sorted.slice(0, 3);

  const totalLikes = analytics.reduce((s, a) => s + Number(a.likes), 0);
  const totalComments = analytics.reduce((s, a) => s + Number(a.comments), 0);
  const totalShares = analytics.reduce((s, a) => s + Number(a.shares), 0);
  const avgEngagement =
    analytics.length > 0
      ? (
          analytics.reduce((s, a) => s + Number(a.engagement_rate), 0) /
          analytics.length
        ).toFixed(2)
      : "0";

  const latestOptimization = optimizationLogs[optimizationLogs.length - 1];

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="數據分析"
        description="查看社群互動數據與 AI 優化建議"
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleCollect}
              disabled={collecting}
            >
              {collecting ? "收集中..." : "收集數據"}
            </Button>
            <Button onClick={handleOptimize} disabled={optimizing}>
              {optimizing ? "優化中..." : "AI 優化分析"}
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          { label: "總按讚", value: totalLikes },
          { label: "總留言", value: totalComments },
          { label: "總分享", value: totalShares },
          { label: "平均互動率", value: `${avgEngagement}%` },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      {top3.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold">Top 3 互動率最高貼文</h2>
          <div className="space-y-3">
            {top3.map((a, i) => (
              <div
                key={a.analytics_id || i}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">Post: {a.post_id?.slice(0, 8)}...</p>
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span>👍 {a.likes}</span>
                      <span>💬 {a.comments}</span>
                      <span>🔗 {a.shares}</span>
                    </div>
                  </div>
                </div>
                <Badge color="green">{Number(a.engagement_rate).toFixed(2)}%</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {latestOptimization && (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold">AI 優化策略</h2>
          <div className="space-y-3">
            {latestOptimization.caption_guidelines && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">文案指引</h3>
                <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
                  {latestOptimization.caption_guidelines}
                </p>
              </div>
            )}
            {latestOptimization.image_guidelines && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">圖片指引</h3>
                <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
                  {latestOptimization.image_guidelines}
                </p>
              </div>
            )}
            {latestOptimization.top_topics && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">熱門主題</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {latestOptimization.top_topics}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {analytics.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">所有數據紀錄</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-2 pr-4">貼文</th>
                  <th className="pb-2 pr-4">平台</th>
                  <th className="pb-2 pr-4">按讚</th>
                  <th className="pb-2 pr-4">留言</th>
                  <th className="pb-2 pr-4">分享</th>
                  <th className="pb-2 pr-4">觸及</th>
                  <th className="pb-2">互動率</th>
                </tr>
              </thead>
              <tbody>
                {analytics.map((a, i) => (
                  <tr key={a.analytics_id || i} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-mono text-xs">
                      {a.post_id?.slice(0, 8)}...
                    </td>
                    <td className="py-2 pr-4">{a.platform}</td>
                    <td className="py-2 pr-4">{a.likes}</td>
                    <td className="py-2 pr-4">{a.comments}</td>
                    <td className="py-2 pr-4">{a.shares}</td>
                    <td className="py-2 pr-4">{a.reach}</td>
                    <td className="py-2">{Number(a.engagement_rate).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
