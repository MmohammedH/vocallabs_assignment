"use client";

import { useState } from "react";
import { StepDraft, STEP_TYPES, OWNER_ONLY_STEP_TYPES, defaultConfigFor } from "./types";
import { StepConfigEditor } from "./StepConfigEditor";
import { Role } from "@/context/OrgContext";

export function StepList({
  steps,
  role,
  onChange,
}: {
  steps: StepDraft[];
  role: Role;
  onChange: (steps: StepDraft[]) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [addingType, setAddingType] = useState("");

  function renumber(list: StepDraft[]): StepDraft[] {
    return list.map((s, i) => ({ ...s, step_order: i + 1 }));
  }

  function addStep() {
    if (!addingType) return;
    const type = addingType as StepDraft["type"];
    if (OWNER_ONLY_STEP_TYPES.includes(type) && role !== "owner") return;
    const next = renumber([...steps, { step_order: 0, name: `${type}_${steps.length + 1}`, type, config: defaultConfigFor(type) }]);
    onChange(next);
    setExpanded(next.length - 1);
    setAddingType("");
  }

  function removeStep(index: number) {
    onChange(renumber(steps.filter((_, i) => i !== index)));
    setExpanded(null);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(renumber(next));
    setExpanded(target);
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }

  const availableTypes = STEP_TYPES.filter((t) => role === "owner" || !OWNER_ONLY_STEP_TYPES.includes(t.value));

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const isExpanded = expanded === i;
        const priorLabels = steps.slice(0, i).map((s) => s.name || String(s.step_order));
        return (
          <div key={i} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs font-mono text-slate-400 w-5">{i + 1}</span>
              <span className="text-xs uppercase tracking-wide bg-slate-100 rounded px-2 py-0.5">{step.type}</span>
              <input
                className="flex-1 text-sm font-medium bg-transparent focus:outline-none"
                value={step.name}
                onChange={(e) => updateStep(i, { name: e.target.value })}
              />
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 px-1">
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === steps.length - 1}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 px-1"
              >
                ↓
              </button>
              <button onClick={() => setExpanded(isExpanded ? null : i)} className="text-sm text-slate-600 px-2">
                {isExpanded ? "Collapse" : "Edit"}
              </button>
              <button onClick={() => removeStep(i)} className="text-sm text-red-500 px-2">
                Delete
              </button>
            </div>
            {isExpanded && (
              <div className="border-t border-slate-100 px-4 py-3">
                <StepConfigEditor step={step} onChange={(config) => updateStep(i, { config })} priorStepLabels={priorLabels} />
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2 pt-2">
        <select value={addingType} onChange={(e) => setAddingType(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Add a step…</option>
          {availableTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
              {OWNER_ONLY_STEP_TYPES.includes(t.value) ? " (owner only)" : ""}
            </option>
          ))}
        </select>
        <button onClick={addStep} disabled={!addingType} className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 disabled:opacity-40">
          Add
        </button>
      </div>
    </div>
  );
}
