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
      return { success: false, error: `n8n responded ${res.status}: ${text}` };
    }

    const data = await res.json().catch(() => null);
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
