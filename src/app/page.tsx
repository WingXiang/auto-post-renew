"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  PageHeader,
  Button,
  StatusBadge,
  Spinner,
} from "@/components/ui";
import type { PipelineLog } from "@/types";

interface DashboardStats {
  totalTopics: number;
  pendingTopics: number;
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  totalCustomers: number;
}

export default function DashboardPage() {
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [logsRes, topicsRes, postsRes, customersRes] = await Promise.all([
        fetch("/api/pipeline").then((r) => r.json()),
        fetch("/api/topics").then((r) => r.json()),
        fetch("/api/posts").then((r) => r.json()),
        fetch("/api/customers").then((r) => r.json()),
      ]);

      setLogs(logsRes.logs ?? []);

      const topics = topicsRes.topics ?? [];
      const posts = postsRes.posts ?? [];
      const customers = customersRes.customers ?? [];

      setStats({
        totalTopics: topics.length,
        pendingTopics: topics.filter(
          (t: { status: string }) => t.status === "pending"
        ).length,
        totalPosts: posts.length,
        scheduledPosts: posts.filter(
          (p: { status: string }) => p.status === "scheduled"
        ).length,
        publishedPosts: posts.filter(
          (p: { status: string }) => p.status === "published"
        ).length,
        totalCustomers: customers.length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const triggerWorkflow = async (action: string, endpoint: string) => {
    setTriggering(action);
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setTimeout(fetchData, 3000);
    } finally {
      setTriggering(null);
    }
  };

  if (loading) return <Spinner />;

  const quickActions = [
    { label: "搜尋主題", action: "discover", endpoint: "/api/topics" },
    { label: "生成貼文", action: "generate", endpoint: "/api/posts" },
    { label: "收集數據", action: "collect", endpoint: "/api/analytics" },
    { label: "AI 優化", action: "optimize", endpoint: "/api/analytics" },
    { label: "識別客戶", action: "identify", endpoint: "/api/customers" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Pipeline 總覽與快捷操作" />

      {stats && (
        <div className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "主題總數", value: stats.totalTopics },
            { label: "待審主題", value: stats.pendingTopics },
            { label: "貼文總數", value: stats.totalPosts },
            { label: "已排程", value: stats.scheduledPosts },
            { label: "已發布", value: stats.publishedPosts },
            { label: "潛在客戶", value: stats.totalCustomers },
          ].map((s) => (
            <Card key={s.label}>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">快捷觸發</h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((qa) => (
            <Button
              key={qa.action}
              variant="secondary"
              onClick={() => triggerWorkflow(qa.action, qa.endpoint)}
              disabled={triggering !== null}
            >
              {triggering === qa.action ? "執行中..." : qa.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Pipeline 執行日誌</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">尚無執行紀錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-2 pr-4">工作流程</th>
                  <th className="pb-2 pr-4">狀態</th>
                  <th className="pb-2 pr-4">訊息</th>
                  <th className="pb-2 pr-4">開始時間</th>
                  <th className="pb-2">結束時間</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={log.log_id || i}
                    className="border-b border-gray-100"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {log.workflow_name}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-2 pr-4 max-w-xs truncate text-gray-600">
                      {log.message}
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-500">
                      {log.started_at
                        ? new Date(log.started_at).toLocaleString("zh-TW")
                        : ""}
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {log.finished_at
                        ? new Date(log.finished_at).toLocaleString("zh-TW")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
