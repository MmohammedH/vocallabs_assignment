"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { RoleGate } from "@/components/common/RoleGate";
import { APPROVE_STEP } from "@/lib/graphql/operations";

export function ApprovalAction({ stepRunId }: { stepRunId: string }) {
  const [, executeApprove] = useMutation(APPROVE_STEP);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onApprove() {
    setPending(true);
    setError(null);
    const result = await executeApprove({ stepRunId });
    setPending(false);
    if (result.error) {
      // The Action handler re-derives the approver's real role server-side —
      // this rejection can happen even though the button is visible (e.g. a
      // stale client after a role downgrade), so surface it rather than
      // assuming the mutation always succeeds.
      setError(result.error.graphQLErrors[0]?.message ?? result.error.message);
    }
    // On success, no local state mutation needed — the step_runs
    // subscription pushes the updated row (status/approved_by/approved_at)
    // automatically once the handler resumes the run.
  }

  return (
    <RoleGate allow={["owner", "editor"]}>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={onApprove}
          disabled={pending}
          className="rounded-md bg-amber-600 text-white text-sm px-3 py-1.5 disabled:opacity-50"
        >
          {pending ? "Approving…" : "Approve"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </RoleGate>
  );
}
