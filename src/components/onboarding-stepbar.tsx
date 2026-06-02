"use client";

import { useEffect, useState } from "react";
import type { Brand, Schedule, Topic } from "@/types";
import { StepBar } from "./ui";

interface State {
  loading: boolean;
  brand: Brand | null;
  topics: Topic[];
  schedule: Schedule | null;
}

// 必填的品牌欄位（任一空 = step 1 未完成）
const REQUIRED_BRAND_FIELDS: (keyof Brand)[] = [
  "brand_name",
  "theme",
  "tone",
  "target_audience",
  "meta_access_token",
];

export function OnboardingStepBar() {
  const [state, setState] = useState<State>({
    loading: true,
    brand: null,
    topics: [],
    schedule: null,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/brands", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { brand: null }
      ),
      fetch("/api/topics", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { topics: [] }
      ),
      fetch("/api/schedules", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { schedule: null }
      ),
    ]).then(([b, t, s]) =>
      setState({
        loading: false,
        brand: b.brand ?? null,
        topics: t.topics ?? [],
        schedule: s.schedule ?? null,
      })
    );
  }, []);

  if (state.loading) return null;

  const brandDone =
    !!state.brand &&
    REQUIRED_BRAND_FIELDS.every((f) => !!state.brand![f]);
  const topicsDone = state.topics.length > 0;
  const scheduleDone = state.schedule?.auto_publish_enabled === "true";

  let currentStep = 1;
  if (brandDone) currentStep = 2;
  if (brandDone && topicsDone) currentStep = 3;

  return (
    <StepBar
      currentStep={currentStep}
      steps={[
        { label: "1. 設定品牌", href: "/brand", done: brandDone },
        { label: "2. 找新主題", href: "/topics", done: topicsDone },
        { label: "3. 開啟自動排程", href: "/posts", done: scheduleDone },
      ]}
    />
  );
}
