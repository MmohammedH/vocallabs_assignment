"use client";

import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";
import { useOrg } from "@/context/OrgContext";
import { SAVE_WORKFLOW } from "@/lib/graphql/operations";
import { StepList } from "./StepList";
import { TriggerEditor } from "./TriggerEditor";
import { RunButton } from "./RunButton";
import {
  StepDraft,
  TriggerDraft,
  TRIGGER_TYPES,
  OWNER_ONLY_TRIGGER_TYPES,
  defaultTriggerConfigFor,
} from "./types";

export type Draft = {
  name: string;
  description: string;
  is_active: boolean;
  steps: StepDraft[];
  triggers: TriggerDraft[];
};

type Action =
  | { type: "setMeta"; patch: Partial<Draft> }
  | { type: "setSteps"; steps: StepDraft[] }
  | { type: "setTriggers"; triggers: TriggerDraft[] };

function reducer(state: Draft, action: Action): Draft {
  switch (action.type) {
    case "setMeta":
      return { ...state, ...action.patch };
    case "setSteps":
      return { ...state, steps: action.steps };
    case "setTriggers":
      return { ...state, triggers: action.triggers };
  }
}

export function WorkflowBuilderPage({
  workflowId,
  initialDraft,
}: {
  workflowId: string | null;
  initialDraft: Draft;
}) {
  const { orgId, role } = useOrg();
  const router = useRouter();
  const [draft, dispatch] = useReducer(reducer, initialDraft);
  const [addingTriggerType, setAddingTriggerType] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, executeSave] = useMutation(SAVE_WORKFLOW);

  const readOnly = role === "viewer";

  function addTrigger() {
    if (!addingTriggerType) return;
    const type = addingTriggerType as TriggerDraft["type"];
    if (OWNER_ONLY_TRIGGER_TYPES.includes(type) && role !== "owner") return;
    dispatch({
      type: "setTriggers",
      triggers: [...draft.triggers, { type, config: defaultTriggerConfigFor(type), is_enabled: true }],
    });
    setAddingTriggerType("");
  }

  function removeTrigger(index: number) {
    dispatch({ type: "setTriggers", triggers: draft.triggers.filter((_, i) => i !== index) });
  }

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    const result = await executeSave({
      orgId,
      workflowId,
      name: draft.name,
      description: draft.description || null,
      isActive: draft.is_active,
      steps: draft.steps.map((s) => ({ step_order: s.step_order, name: s.name, type: s.type, config: s.config })),
      triggers: draft.triggers.map((t) => ({ type: t.type, config: t.config, is_enabled: t.is_enabled })),
    });
    setSaving(false);
    if (result.error) {
      setSaveError(result.error.graphQLErrors[0]?.message ?? result.error.message);
      return;
    }
    const savedId = result.data.saveWorkflow.workflow_id;
    router.push(`/org/${orgId}/workflows/${savedId}`);
  }

  const availableTriggerTypes = TRIGGER_TYPES.filter((t) => role === "owner" || !OWNER_ONLY_TRIGGER_TYPES.includes(t.value));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{workflowId ? "Edit workflow" : "New workflow"}</h1>
        <div className="flex items-center gap-3">
          {workflowId && <RunButton workflowId={workflowId} />}
        </div>
      </div>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <div className="space-y-3 bg-white border border-slate-200 rounded-lg p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input
            disabled={readOnly}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
            value={draft.name}
            onChange={(e) => dispatch({ type: "setMeta", patch: { name: e.target.value } })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Description</label>
          <input
            disabled={readOnly}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
            value={draft.description}
            onChange={(e) => dispatch({ type: "setMeta", patch: { description: e.target.value } })}
          />
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Steps</h2>
        {readOnly ? (
          <ReadOnlySteps steps={draft.steps} />
        ) : (
          <StepList steps={draft.steps} role={role} onChange={(steps) => dispatch({ type: "setSteps", steps })} />
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Triggers</h2>
        <div className="space-y-2">
          {draft.triggers.map((trigger, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide bg-slate-100 rounded px-2 py-0.5">{trigger.type}</span>
                {!readOnly && (
                  <button onClick={() => removeTrigger(i)} className="text-sm text-red-500">
                    Remove
                  </button>
                )}
              </div>
              <TriggerEditor
                trigger={trigger}
                workflowId={workflowId}
                onChange={(config) =>
                  dispatch({
                    type: "setTriggers",
                    triggers: draft.triggers.map((t, idx) => (idx === i ? { ...t, config } : t)),
                  })
                }
              />
            </div>
          ))}
          {!readOnly && (
            <div className="flex items-center gap-2 pt-1">
              <select
                value={addingTriggerType}
                onChange={(e) => setAddingTriggerType(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Add a trigger…</option>
                {availableTriggerTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                    {OWNER_ONLY_TRIGGER_TYPES.includes(t.value) ? " (owner only)" : ""}
                  </option>
                ))}
              </select>
              <button onClick={addTrigger} disabled={!addingTriggerType} className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 disabled:opacity-40">
                Add
              </button>
            </div>
          )}
        </div>
      </section>

      {!readOnly && (
        <div className="flex justify-end">
          <button onClick={onSave} disabled={saving || !draft.name} className="rounded-md bg-slate-900 text-white text-sm px-5 py-2 disabled:opacity-50">
            {saving ? "Saving…" : "Save workflow"}
          </button>
        </div>
      )}
    </div>
  );
}

function ReadOnlySteps({ steps }: { steps: StepDraft[] }) {
  return (
    <ul className="space-y-1">
      {steps.map((s, i) => (
        <li key={i} className="text-sm text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-2">
          {i + 1}. <span className="font-medium">{s.name}</span> — {s.type}
        </li>
      ))}
    </ul>
  );
}
