import { adminGql } from "./lib/gql";
import { startRun } from "./lib/startRun";

// Hasura Action: webhookTrigger(workflow_id: uuid!, secret: String!, payload: json)
// Public role — no user JWT required, since external systems call this.
// Authorization here is entirely secret-based: the caller must know the
// per-trigger secret configured when the webhook trigger was created.
// A wrong secret and a nonexistent workflow return the identical 401, so
// this endpoint never reveals whether a given workflow_id exists.
export default async (req: any, res: any) => {
  try {
    const { input } = req.body;
    const { workflow_id, secret, payload } = input;

    const data = await adminGql<{
      workflow_triggers: { id: string; config: any; workflow: { org_id: string } }[];
    }>(
      `query($workflowId: uuid!) {
         workflow_triggers(
           where: { workflow_id: { _eq: $workflowId }, type: { _eq: "webhook" }, is_enabled: { _eq: true } }
         ) { id config workflow { org_id } }
       }`,
      { workflowId: workflow_id }
    );
    const trigger = data.workflow_triggers[0];
    if (!trigger || trigger.config?.secret !== secret) {
      return res.status(401).json({ message: "invalid webhook trigger" });
    }
    const orgId = trigger.workflow.org_id;

    const result = await startRun({ workflowId: workflow_id, orgId, triggerType: "webhook", input: payload });
    if (result.quotaExceeded) {
      return res.status(403).json({ message: "organization usage quota exhausted for this period" });
    }
    res.status(200).json({ workflow_run_id: result.runId, status: result.status });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ message: err.message || "internal error" });
  }
};
