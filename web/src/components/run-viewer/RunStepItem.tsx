"use client";

import { ApprovalAction } from "./ApprovalAction";

type StepRun = {
  id: string;
  step_order: number;
  type: string;
  status: string;
  input: any;
  output: any;
  error: string | null;
  attempt_count: number;
  approved_by: string | null;
  approved_at: string | null;
  workflowStep?: { name: string | null } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  running: "bg-blue-100 text-blue-700 animate-pulse",
  succeeded: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  paused: "bg-amber-100 text-amber-700",
  skipped: "bg-slate-100 text-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  paused: "paused — awaiting approval",
};

export function RunStepItem({ stepRun }: { stepRun: StepRun }) {
  const label = stepRun.workflowStep?.name || `step ${stepRun.step_order}`;
  const isPendingApproval = stepRun.type === "approval_gate" && stepRun.status === "paused";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-slate-400 w-5">{stepRun.step_order}</span>
        <span className="text-xs uppercase tracking-wide bg-slate-100 rounded px-2 py-0.5">{stepRun.type}</span>
        <span className="font-medium text-sm">{label}</span>
        <span className={`ml-auto text-xs px-2 py-1 rounded ${STATUS_STYLES[stepRun.status] ?? ""}`}>
          {STATUS_LABEL[stepRun.status] ?? stepRun.status}
        </span>
      </div>

      {stepRun.attempt_count > 1 && <p className="text-xs text-slate-400 mt-1">attempt {stepRun.attempt_count}</p>}

      {stepRun.output != null && stepRun.status === "succeeded" && (
        <pre className="mt-2 text-xs bg-slate-50 rounded p-2 overflow-x-auto">{JSON.stringify(stepRun.output, null, 2)}</pre>
      )}

      {stepRun.error && (
        <details className="mt-2">
          <summary className="text-xs text-red-600 cursor-pointer">Error</summary>
          <pre className="text-xs bg-red-50 text-red-700 rounded p-2 overflow-x-auto mt-1">{stepRun.error}</pre>
        </details>
      )}

      {stepRun.approved_by && (
        <p className="text-xs text-slate-400 mt-1">approved {stepRun.approved_at ? new Date(stepRun.approved_at).toLocaleString() : ""}</p>
      )}

      {isPendingApproval && <ApprovalAction stepRunId={stepRun.id} />}
    </div>
  );
}
