import { redactError, redactSecrets } from "./redact";

const N8N_BASE_URL = process.env.N8N_BASE_URL!;
const N8N_API_KEY = process.env.N8N_API_KEY!;

export type WorkflowName =
  | "brand-setup"
  | "topic-discovery"
  | "content-generation"
  | "post-scheduler"
  | "analytics-collection"
  | "weekly-optimization"
  | "customer-identification"
  | "update-schedule";

export async function triggerWorkflow(
  workflow: WorkflowName,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const url = `${N8N_BASE_URL}/webhook/${workflow}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, api_key: N8N_API_KEY }),
    });

    if (!res.ok) {
      const text = await res.text();
      // n8n 偶爾會在錯誤回應裡 echo 整個 payload（含 api_key），
      // 在送回 client 之前一律遮罩。
      return {
        success: false,
        error: `n8n responded ${res.status}: ${redactSecrets(text)}`,
      };
    }

    const data = await res.json().catch(() => null);
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: redactError(err) || "Unknown error",
    };
  }
}
