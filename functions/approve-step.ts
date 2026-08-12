import { adminGql } from "./lib/gql";
import { getRealRole, requireRole } from "./lib/role";
import { runSteps } from "./lib/runSteps";

// Hasura Action: approveStep(step_run_id: uuid!)
// The mid-execution "is this approver actually owner/editor in this org"
// check can't be a static DB permission — it happens here, in the handler,
// re-deriving the real role the same way every other Action does.
export default async (req: any, res: any) => {
  try {
    const { input, session_variables } = req.body;
    const userId = session_variables?.["x-hasura-user-id"];
    const stepRunId = input.step_run_id;
    if (!userId) return res.status(401).json({ message: "unauthenticated" });

    const data = await adminGql<{
      step_runs_by_pk: {
        id: string;
        type: string;
        status: string;
        step_order: number;
        workflow_run_id: string;
        workflowRun: { org_id: string };
      };
    }>(
      `query($id: uuid!) {
         step_runs_by_pk(id: $id) {
           id type status step_order workflow_run_id
           workflowRun { org_id }
         }
       }`,
      { id: stepRunId }
    );
    const stepRun = data.step_runs_by_pk;
    if (!stepRun) return res.status(404).json({ message: "step run not found" });
    if (stepRun.type !== "approval_gate" || stepRun.status !== "paused") {
      return res.status(409).json({ message: "step run is not a paused approval_gate" });
    }

    const role = await getRealRole(userId, stepRun.workflowRun.org_id);
    requireRole(role, ["owner", "editor"]);

    await adminGql(
      `mutation($id: uuid!, $set: step_runs_set_input!) {
         update_step_runs_by_pk(pk_columns: { id: $id }, _set: $set) { id }
       }`,
      {
        id: stepRunId,
        set: {
          status: "succeeded",
          approved_by: userId,
          approved_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
      }
    );
    await adminGql(
      `mutation($id: uuid!, $set: workflow_runs_set_input!) {
         update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: $set) { id }
       }`,
      { id: stepRun.workflow_run_id, set: { status: "running" } }
    );

    // Resume is nothing more than re-entering the same executor loop,
    // starting right after the step that was just approved.
    await runSteps(stepRun.workflow_run_id, stepRun.step_order + 1);

    const final = await adminGql<{ workflow_runs_by_pk: { status: string } }>(
      `query($id: uuid!) { workflow_runs_by_pk(id: $id) { status } }`,
      { id: stepRun.workflow_run_id }
    );
    res.status(200).json({ workflow_run_id: stepRun.workflow_run_id, status: final.workflow_runs_by_pk.status });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ message: err.message || "internal error" });
  }
};
