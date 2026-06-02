"use client";

import { useCallback, useEffect, useState } from "react";
import type { PipelineLog } from "@/types";
import { Badge } from "./ui";

const POLL_MS = 5000;
const ACTIVE_LIMIT = 5;
const DONE_LIMIT = 5;

// 把英文 workflow_name 翻成中文（給沒有 subject 的舊紀錄用）
const WORKFLOW_LABEL: Record<string, string> = {
  "brand-setup": "品牌初始化",
  "topic-discovery": "搜尋主題",
  "content-generation": "產生貼文",
  "post-scheduler": "發佈貼文",
  "analytics-collection": "收集互動數據",
  "weekly-optimization": "每週優化",
  "customer-identification": "辨識潛在客戶",
  "update-schedule": "更新排程",
};

function localize(name: string): string {
  if (!name) return "(未命名)";
  return WORKFLOW_LABEL[name] ?? name;
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)} 秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小時前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

function LogRow({
  log,
  onMarkFailed,
}: {
  log: PipelineLog;
  onMarkFailed: (id: string) => void;
}) {
  const color =
    log.stalled
      ? "red"
      : log.status === "running"
      ? "blue"
      : log.status === "success"
      ? "green"
      : log.status === "failed"
      ? "red"
      : "gray";
  const subject = log.subject || localize(log.workflow_name);
  return (
    <div className="border-b border-gray-100 px-3 py-2 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-gray-900">
            {subject}
          </div>
          {log.progress && (
            <div className="text-[10px] text-gray-500">{log.progress}</div>
          )}
          <div className="text-[10px] text-gray-400">
            {timeAgo(log.started_at)}
          </div>
        </div>
        <Badge color={color}>
          {log.stalled
            ? "卡住"
            : log.status === "running"
            ? "執行中"
            : log.status === "success"
            ? "完成"
            : log.status === "failed"
            ? "失敗"
            : log.status}
        </Badge>
      </div>
      {log.stalled && (
        <button
          onClick={() => onMarkFailed(log.log_id)}
          className="mt-1 text-[10px] text-red-600 hover:underline"
        >
          標記為失敗 →
        </button>
      )}
    </div>
  );
}

export function PipelineSidebar({ mode = "sidebar" }: { mode?: "sidebar" | "panel" }) {
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [expanded, setExpanded] = useState(mode === "panel");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/pipeline?limit=20", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d) => setLogs(d.logs ?? []))
      .catch(() => {
        /* ignore */
      });
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const active = logs.filter((l) => l.status === "running").slice(0, ACTIVE_LIMIT);
  const done = logs
    .filter((l) => l.status !== "running")
    .slice(0, DONE_LIMIT);
  const activeCount = active.length;

  const markFailed = (id: string) => {
    setLoading(true);
    fetch(`/api/pipeline?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(() => refresh())
      .finally(() => setLoading(false));
  };

  if (mode === "sidebar" && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
      >
        <span>執行進度</span>
        <Badge color={activeCount > 0 ? "blue" : "gray"}>
          {activeCount > 0 ? `執行中 ${activeCount}` : "閒置"}
        </Badge>
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
        <span className="text-xs font-semibold text-gray-700">執行進度</span>
        <div className="flex items-center gap-1">
          <button
            onClick={refresh}
            disabled={loading}
            className="text-[10px] text-gray-500 hover:text-gray-900"
            aria-label="重新整理"
          >
            ⟳
          </button>
          {mode === "sidebar" && (
            <button
              onClick={() => setExpanded(false)}
              className="text-[10px] text-gray-500 hover:text-gray-900"
              aria-label="收起"
            >
              ▼
            </button>
          )}
        </div>
      </div>
      <div className="max-h-[40vh] overflow-y-auto">
        {active.length === 0 && done.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-gray-400">
            尚無執行紀錄
          </div>
        )}
        {active.length > 0 && (
          <div>
            <div className="bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase text-blue-700">
              執行中
            </div>
            {active.map((l) => (
              <LogRow key={l.log_id} log={l} onMarkFailed={markFailed} />
            ))}
          </div>
        )}
        {done.length > 0 && (
          <div>
            <div className="bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase text-gray-600">
              最近完成
            </div>
            {done.map((l) => (
              <LogRow key={l.log_id} log={l} onMarkFailed={markFailed} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
