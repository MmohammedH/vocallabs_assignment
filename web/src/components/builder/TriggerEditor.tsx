"use client";

import { TriggerDraft } from "./types";

const inputCls = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export function TriggerEditor({
  trigger,
  workflowId,
  onChange,
}: {
  trigger: TriggerDraft;
  workflowId: string | null;
  onChange: (config: Record<string, any>) => void;
}) {
  switch (trigger.type) {
    case "manual":
      return <p className="text-sm text-slate-500">Started by clicking Run. No configuration needed.</p>;

    case "webhook": {
      const url = workflowId
        ? `${process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL}` // GraphQL endpoint; see hint below for the mutation shape
        : null;
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Secret</label>
            <input
              className={`${inputCls} font-mono`}
              value={trigger.config.secret ?? ""}
              onChange={(e) => onChange({ ...trigger.config, secret: e.target.value })}
            />
          </div>
          <p className="text-xs text-slate-500">
            External systems start this workflow with a GraphQL mutation against{" "}
            <code className="bg-slate-100 px-1 rounded">{url ?? "<graphql endpoint>"}</code>:
            <br />
            <code className="bg-slate-100 px-1 rounded block mt-1 whitespace-pre-wrap">
              {`mutation { webhookTrigger(workflow_id: "${workflowId ?? "<workflow id, after saving>"}", secret: "${
                trigger.config.secret ?? "<secret>"
              }", payload: {}) { workflow_run_id status } }`}
            </code>
          </p>
        </div>
      );
    }

    case "scheduled":
      return (
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Cron expression (5-field, UTC)</label>
          <input
            className={`${inputCls} font-mono`}
            placeholder="*/5 * * * *"
            value={trigger.config.cron ?? ""}
            onChange={(e) => onChange({ ...trigger.config, cron: e.target.value })}
          />
          <p className="text-xs text-slate-400">Checked once a minute; matches at 1-minute granularity.</p>
        </div>
      );

    case "database_event":
      return (
        <p className="text-sm text-slate-500">
          Starts automatically when a row is inserted into <code className="bg-slate-100 px-1 rounded">lead_intake</code>{" "}
          referencing this workflow&apos;s id — no configuration needed for this demo&apos;s fixed watched table.
        </p>
      );

    default:
      return null;
  }
}
