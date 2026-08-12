export type StepType = "llm_call" | "http_request" | "db_write" | "notify" | "conditional_branch" | "approval_gate";
export type TriggerType = "manual" | "webhook" | "scheduled" | "database_event";

export const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: "llm_call", label: "LLM Call" },
  { value: "http_request", label: "HTTP Request" },
  { value: "db_write", label: "DB Write" },
  { value: "notify", label: "Notify" },
  { value: "conditional_branch", label: "Conditional Branch" },
  { value: "approval_gate", label: "Approval Gate" },
];

export const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "webhook", label: "Webhook" },
  { value: "scheduled", label: "Scheduled (cron)" },
  { value: "database_event", label: "Database event" },
];

// Steps whose creation/edit is owner-only (Layer 2 — enforced for real inside
// the saveWorkflow Action handler; this is just the matching UI hint).
export const OWNER_ONLY_STEP_TYPES: StepType[] = ["db_write", "notify"];
export const OWNER_ONLY_TRIGGER_TYPES: TriggerType[] = ["webhook"];

export type StepDraft = {
  step_order: number;
  name: string;
  type: StepType;
  config: Record<string, any>;
};

export type TriggerDraft = {
  type: TriggerType;
  config: Record<string, any>;
  is_enabled: boolean;
};

export function defaultConfigFor(type: StepType): Record<string, any> {
  switch (type) {
    case "llm_call":
      return { prompt: "" };
    case "http_request":
      return { url: "", method: "GET" };
    case "db_write":
      return { key: "", value: "" };
    case "notify":
      return { channel: "slack", target: "", message: "" };
    case "conditional_branch":
      return { condition: { path: "", operator: "eq", value: "" }, skip_step_orders_if_false: [] };
    case "approval_gate":
      return {};
  }
}

export function defaultTriggerConfigFor(type: TriggerType): Record<string, any> {
  switch (type) {
    case "webhook":
      return { secret: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) };
    case "scheduled":
      return { cron: "*/5 * * * *" };
    default:
      return {};
  }
}
