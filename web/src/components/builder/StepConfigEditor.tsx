"use client";

import { StepDraft } from "./types";

type Props = {
  step: StepDraft;
  onChange: (config: Record<string, any>) => void;
  priorStepLabels: string[];
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

// Per-type config editor. All string fields support {{steps.<name>.output...}}
// / {{trigger.input...}} interpolation — priorStepLabels is shown as a hint
// rather than a full picker widget, to keep this from ballooning in scope.
export function StepConfigEditor({ step, onChange, priorStepLabels }: Props) {
  const set = (patch: Record<string, any>) => onChange({ ...step.config, ...patch });
  const interpolationHint =
    priorStepLabels.length > 0
      ? `Reference prior steps: ${priorStepLabels.map((l) => `{{steps.${l}.output...}}`).join(", ")}`
      : "No prior steps to reference yet.";

  switch (step.type) {
    case "llm_call":
      return (
        <div className="space-y-3">
          <Field label="Prompt" hint={interpolationHint}>
            <textarea
              className={inputCls}
              rows={3}
              value={step.config.prompt ?? ""}
              onChange={(e) => set({ prompt: e.target.value })}
            />
          </Field>
          <Field label="Model (optional)">
            <input
              className={inputCls}
              placeholder="llama-3.1-8b-instant"
              value={step.config.model ?? ""}
              onChange={(e) => set({ model: e.target.value })}
            />
          </Field>
        </div>
      );

    case "http_request":
      return (
        <div className="space-y-3">
          <Field label="URL" hint={interpolationHint}>
            <input
              data-testid="step-url-input"
              className={inputCls}
              value={step.config.url ?? ""}
              onChange={(e) => set({ url: e.target.value })}
            />
          </Field>
          <Field label="Method">
            <select
              className={inputCls}
              value={step.config.method ?? "GET"}
              onChange={(e) => set({ method: e.target.value })}
            >
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Body (JSON, optional)">
            <textarea
              className={inputCls}
              rows={2}
              value={typeof step.config.body === "string" ? step.config.body : JSON.stringify(step.config.body ?? "")}
              onChange={(e) => set({ body: e.target.value })}
            />
          </Field>
        </div>
      );

    case "db_write":
      return (
        <div className="space-y-3">
          <Field label="Key">
            <input className={inputCls} value={step.config.key ?? ""} onChange={(e) => set({ key: e.target.value })} />
          </Field>
          <Field label="Value" hint={interpolationHint}>
            <input
              className={inputCls}
              value={typeof step.config.value === "string" ? step.config.value : JSON.stringify(step.config.value ?? "")}
              onChange={(e) => set({ value: e.target.value })}
            />
          </Field>
        </div>
      );

    case "notify":
      return (
        <div className="space-y-3">
          <Field label="Channel">
            <select className={inputCls} value={step.config.channel ?? "slack"} onChange={(e) => set({ channel: e.target.value })}>
              <option value="slack">Slack</option>
              <option value="email">Email</option>
            </select>
          </Field>
          <Field label="Target" hint="Slack channel name/webhook, or an email address">
            <input className={inputCls} value={step.config.target ?? ""} onChange={(e) => set({ target: e.target.value })} />
          </Field>
          <Field label="Message" hint={interpolationHint}>
            <textarea
              className={inputCls}
              rows={2}
              value={step.config.message ?? ""}
              onChange={(e) => set({ message: e.target.value })}
            />
          </Field>
        </div>
      );

    case "conditional_branch": {
      const condition = step.config.condition ?? {};
      return (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Evaluated against the previous step&apos;s output.</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Path">
              <input
                className={inputCls}
                placeholder="e.g. status"
                value={condition.path ?? ""}
                onChange={(e) => set({ condition: { ...condition, path: e.target.value } })}
              />
            </Field>
            <Field label="Operator">
              <select
                className={inputCls}
                value={condition.operator ?? "eq"}
                onChange={(e) => set({ condition: { ...condition, operator: e.target.value } })}
              >
                {["eq", "neq", "contains", "gt", "lt", "gte", "lte", "truthy"].map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Value">
              <input
                className={inputCls}
                value={condition.value ?? ""}
                onChange={(e) => set({ condition: { ...condition, value: e.target.value } })}
              />
            </Field>
          </div>
          <Field label="If false, skip step orders (comma-separated)">
            <input
              className={inputCls}
              value={(step.config.skip_step_orders_if_false ?? []).join(",")}
              onChange={(e) =>
                set({
                  skip_step_orders_if_false: e.target.value
                    .split(",")
                    .map((s) => parseInt(s.trim(), 10))
                    .filter((n) => !isNaN(n)),
                })
              }
            />
          </Field>
        </div>
      );
    }

    case "approval_gate":
      return <p className="text-sm text-slate-500">Pauses the run until an owner or editor approves it. No configuration needed.</p>;

    default:
      return null;
  }
}
