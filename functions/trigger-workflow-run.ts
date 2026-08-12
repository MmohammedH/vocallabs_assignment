import { adminGql } from "./lib/gql";
import { getRealRole, requireRole } from "./lib/role";
import { startRun } from "./lib/startRun";

// Hasura Action: triggerWorkflowRun(workflow_id: uuid!)
// 1. Verify caller is owner/editor in the workflow's org (real role,
//    re-derived from org_members — never trust x-hasura-role, since this
//    endpoint can be called directly with any guessed workflow_id).
// 2. Check the org's quota isn't exhausted.
// 3. Create the workflow_run and run the executor to completion/pause/failure.
export default async (req: any, res: any) => {
  try {
    const { input, session_variables } = req.body;
    const userId = session_variables?.["x-hasura-user-id"];
    const workflowId = input.workflow_id;
    if (!userId) return res.status(401).json({ message: "unauthenticated" });

    const wf = await adminGql<{ workflows_by_pk: { id: string; org_id: string; is_active: boolean } }>(
      `query($id: uuid!) { workflows_by_pk(id: $id) { id org_id is_active } }`,
      { id: workflowId }
    );
    if (!wf.workflows_by_pk) return res.status(404).json({ message: "workflow not found" });
    const workflow = wf.workflows_by_pk;

    const role = await getRealRole(userId, workflow.org_id);
    requireRole(role, ["owner", "editor"]);

    const result = await startRun({ workflowId, orgId: workflow.org_id, triggerType: "manual", triggeredBy: userId });
    if (result.quotaExceeded) {
      return res.status(403).json({ message: "organization usage quota exhausted for this period" });
    }
    res.status(200).json({ workflow_run_id: result.runId, status: result.status });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ message: err.message || "internal error" });
  }
};
