"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  PageHeader,
  Button,
  StatusBadge,
  EmptyState,
  Spinner,
  Badge,
} from "@/components/ui";
import type { Topic } from "@/types";

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const fetchTopics = useCallback(() => {
    fetch("/api/topics")
      .then((r) => r.json())
      .then((d) => setTopics(d.topics ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discover" }),
      });
      setTimeout(fetchTopics, 3000);
    } finally {
      setDiscovering(false);
    }
  };

  const handleUpdateStatus = async (
    topicId: string,
    status: "approved" | "rejected"
  ) => {
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", topic_id: topicId, status }),
    });
    setTopics((prev) =>
      prev.map((t) => (t.topic_id === topicId ? { ...t, status } : t))
    );
  };

  const filtered =
    filter === "all" ? topics : topics.filter((t) => t.status === filter);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="主題管理"
        description="搜尋並管理 AI 發現的內容主題"
        actions={
          <Button onClick={handleDiscover} disabled={discovering}>
            {discovering ? "搜尋中..." : "搜尋新主題"}
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        {["all", "pending", "approved", "rejected", "used"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === s
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {s === "all"
              ? "全部"
              : s === "pending"
              ? "待審核"
              : s === "approved"
              ? "已通過"
              : s === "rejected"
              ? "已拒絕"
              : "已使用"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="尚無主題"
          description="點擊「搜尋新主題」讓 AI 自動搜尋相關內容主題"
          action={
            <Button onClick={handleDiscover} disabled={discovering}>
              搜尋新主題
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((topic) => (
            <Card key={topic.topic_id}>
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-medium text-gray-900 line-clamp-2">
                  {topic.topic_title}
                </h3>
                <StatusBadge status={topic.status} />
              </div>
              {topic.source_url && (
                <a
                  href={topic.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-2 block truncate text-sm text-blue-600 hover:underline"
                >
                  {topic.source_url}
                </a>
              )}
              <div className="mb-3 flex items-center gap-2">
                <Badge color={Number(topic.relevance_score) >= 7 ? "green" : "yellow"}>
                  相關度 {topic.relevance_score}/10
                </Badge>
              </div>
              {topic.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      handleUpdateStatus(topic.topic_id, "approved")
                    }
                  >
                    批准
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      handleUpdateStatus(topic.topic_id, "rejected")
                    }
                  >
                    拒絕
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
