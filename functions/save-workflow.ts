import { adminGql } from "./lib/gql";
import { getRealRole, requireRole } from "./lib/role";

// Hasura Action: saveWorkflow(org_id, workflow_id?, name, description,
//                              is_active, steps[], triggers[])
//
// This is the ONLY way to write workflow_steps/workflow_triggers — those
// tables have no insert/update/delete permission for any Hasura role
// (Layer 1), specifically so Layer 2 can be enforced here: a plain
// "editor can insert workflow_steps" permission can't express "...except
// when type=db_write", so that rule lives in this handler instead.
export default async (req: any, res: any) => {
  try {
    const { input, session_variables } = req.body;
    const userId = session_variables?.["x-hasura-user-id"];
    if (!userId) return res.status(401).json({ message: "unauthenticated" });

    const { org_id, workflow_id, name, description, is_active, steps, triggers } = input;

    if (workflow_id) {
      const existing = await adminGql<{ workflows_by_pk: { org_id: string } }>(
        `query($id: uuid!) { workflows_by_pk(id: $id) { org_id } }`,
        { id: workflow_id }
      );
      if (!existing.workflows_by_pk) return res.status(404).json({ message: "workflow not found" });
      if (existing.workflows_by_pk.org_id !== org_id) {
        return res.status(400).json({ message: "workflow_id does not belong to org_id" });
      }
    }

    // Layer 2: only an owner may introduce a db_write step, a notify step,
    // or a webhook trigger. Everything else just needs owner/editor.
    const touchesRestrictedCapability =
      (steps as any[]).some((s) => s.type === "db_write" || s.type === "notify") ||
      (triggers as any[]).some((t) => t.type === "webhook");
    const requiredRoles: ("owner" | "editor")[] = touchesRestrictedCapability ? ["owner"] : ["owner", "editor"];

    const role = await getRealRole(userId, org_id);
    requireRole(role, requiredRoles);

    let workflowId = workflow_id;
    if (workflowId) {
      await adminGql(
        `mutation($id: uuid!, $set: workflows_set_input!) {
           update_workflows_by_pk(pk_columns: { id: $id }, _set: $set) { id }
         }`,
        { id: workflowId, set: { name, description, is_active: is_active ?? true } }
      );
      // Delete-and-reinsert steps/triggers — simple and correct given the
      // small step counts these workflows have; avoids diffing logic.
      await adminGql(`mutation($id: uuid!) { delete_workflow_steps(where: { workflow_id: { _eq: $id } }) { affected_rows } }`, { id: workflowId });
      await adminGql(`mutation($id: uuid!) { delete_workflow_triggers(where: { workflow_id: { _eq: $id } }) { affected_rows } }`, { id: workflowId });
    } else {
      const created = await adminGql<{ insert_workflows_one: { id: string } }>(
        `mutation($object: workflows_insert_input!) {
           insert_workflows_one(object: $object) { id }
         }`,
        { object: { org_id, name, description, is_active: is_active ?? true, created_by: userId } }
      );
      workflowId = created.insert_workflows_one.id;
    }

    if (steps.length > 0) {
      await adminGql(
        `mutation($objects: [workflow_steps_insert_input!]!) {
           insert_workflow_steps(objects: $objects) { affected_rows }
         }`,
        {
          objects: steps.map((s: any) => ({
            workflow_id: workflowId,
            step_order: s.step_order,
            name: s.name ?? null,
            type: s.type,
            config: s.config,
          })),
        }
      );
    }

    if (triggers.length > 0) {
      await adminGql(
        `mutation($objects: [workflow_triggers_insert_input!]!) {
           insert_workflow_triggers(objects: $objects) { affected_rows }
         }`,
        {
          objects: triggers.map((t: any) => ({
            workflow_id: workflowId,
            type: t.type,
            config: t.config,
            is_enabled: t.is_enabled ?? true,
          })),
        }
      );
    }

    res.status(200).json({ workflow_id: workflowId });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ message: err.message || "internal error" });
  }
};
