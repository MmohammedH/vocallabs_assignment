import { startRun } from "./lib/startRun";

// Webhook for the Hasura Event Trigger watching `lead_intake` INSERTs — this
// is the concrete "a row change in a watched table auto-starts a run"
// requirement. Demo: `insert into lead_intake (org_id, workflow_id, email,
// payload) values (...)` and a workflow_run appears with no button click,
// streaming live via the step_runs subscription.
export default async (req: any, res: any) => {
  try {
    const row = req.body?.event?.data?.new;
    if (!row) return res.status(200).json({ skipped: true, reason: "no new row in event payload" });

    const result = await startRun({
      workflowId: row.workflow_id,
      orgId: row.org_id,
      triggerType: "database_event",
      input: { email: row.email, ...row.payload },
    });
    res.status(200).json(result);
  } catch (err: any) {
    // Event Trigger webhooks are retried by Hasura on non-2xx, so a real
    // failure here (vs. a deliberate quota/validation stop) should surface
    // as an error rather than being swallowed.
    res.status(500).json({ message: err.message || "internal error" });
  }
};
