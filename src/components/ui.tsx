"use client";

import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  useState,
} from "react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
        {...props}
      />
    </div>
  );
}

export function Textarea({
  label,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <textarea
        className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
        {...props}
      />
    </div>
  );
}

export function Select({
  label,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function Badge({
  children,
  color = "gray",
}: {
  children: React.ReactNode;
  color?: "gray" | "green" | "yellow" | "red" | "blue";
}) {
  const colors = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: "gray" | "green" | "yellow" | "red" | "blue" }> = {
    pending: { label: "待審核", color: "yellow" },
    approved: { label: "已通過", color: "green" },
    rejected: { label: "已拒絕", color: "red" },
    used: { label: "已使用", color: "gray" },
    draft: { label: "草稿", color: "gray" },
    scheduled: { label: "已排程", color: "blue" },
    published: { label: "已發布", color: "green" },
    failed: { label: "失敗", color: "red" },
    running: { label: "執行中", color: "blue" },
    success: { label: "成功", color: "green" },
    new: { label: "新", color: "blue" },
    contacted: { label: "已聯繫", color: "yellow" },
    converted: { label: "已轉換", color: "green" },
    dismissed: { label: "已忽略", color: "gray" },
  };
  const info = map[status] ?? { label: status, color: "gray" as const };
  return <Badge color={info.color}>{info.label}</Badge>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );
}

// ============================================================
// Segmented-control style Tabs（受控）
// ============================================================
export function Tabs({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={`inline-flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Tooltip — 簡單 hover/tap 文字框
// ============================================================
export function Tooltip({
  text,
  children,
  side = "bottom",
}: {
  text: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
}) {
  const [show, setShow] = useState(false);
  const sideClass =
    side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  return (
    <span className="relative inline-flex">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow((v) => !v)}
        className="inline-flex"
      >
        {children}
      </span>
      {show && (
        <span
          className={`absolute left-1/2 z-50 w-64 -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg ${sideClass}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ============================================================
// HelpIcon — 角落「?」圖示，hover 顯示說明
// ============================================================
export function HelpIcon({ text }: { text: string }) {
  return (
    <Tooltip text={text} side="bottom">
      <button
        type="button"
        aria-label="說明"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:border-blue-500 hover:text-blue-600"
      >
        ?
      </button>
    </Tooltip>
  );
}

// ============================================================
// StepBar — 三步驟進度條
// ============================================================
export function StepBar({
  steps,
  currentStep,
}: {
  steps: { label: string; href?: string; done: boolean }[];
  /** 1-indexed */
  currentStep: number;
}) {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      {steps.map((s, i) => {
        const idx = i + 1;
        const isCurrent = idx === currentStep;
        const isDone = s.done;
        const circleColor = isDone
          ? "bg-green-500 text-white"
          : isCurrent
          ? "bg-blue-600 text-white"
          : "bg-gray-200 text-gray-500";
        const label = (
          <span
            className={`text-sm font-medium ${
              isCurrent ? "text-gray-900" : "text-gray-600"
            }`}
          >
            {s.label}
          </span>
        );
        return (
          <span key={s.label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${circleColor}`}
            >
              {isDone ? "✓" : idx}
            </span>
            {s.href && !isDone ? (
              <a href={s.href} className="hover:underline">
                {label}
              </a>
            ) : (
              label
            )}
            {i < steps.length - 1 && (
              <span className="mx-1 inline-block h-px w-6 bg-gray-300" />
            )}
          </span>
        );
      })}
    </div>
  );
}

// ============================================================
// ViewToggle — 卡片 / 列表 切換
// ============================================================
export function ViewToggle({
  value,
  onChange,
}: {
  value: "card" | "list";
  onChange: (v: "card" | "list") => void;
}) {
  return (
    <Tabs
      value={value}
      onChange={(v) => onChange(v as "card" | "list")}
      options={[
        { value: "card", label: "卡片" },
        { value: "list", label: "列表" },
      ]}
    />
  );
}
