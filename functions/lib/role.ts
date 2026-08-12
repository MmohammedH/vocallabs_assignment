import { adminGql } from "./gql";

export type Role = "owner" | "editor" | "viewer";

// Ground-truth role lookup. Every Action handler calls this instead of
// trusting session_variables['x-hasura-role'] — that header is set by the
// CLIENT and could be forged by anyone calling the action endpoint directly
// with someone else's guessed workflow_id/step_run_id. This is what makes
// Layer 2 gating (owner-only db_write/webhook/notify, approval-role checks)
// actually enforced in the handler rather than assumed from the request.
export async function getRealRole(userId: string, orgId: string): Promise<Role | null> {
  const data = await adminGql<{ org_members: { role: Role }[] }>(
    `query($orgId: uuid!, $userId: uuid!) {
       org_members(where: { org_id: { _eq: $orgId }, user_id: { _eq: $userId } }, limit: 1) {
         role
       }
     }`,
    { orgId, userId }
  );
  return data.org_members[0]?.role ?? null;
}

export function requireRole(role: Role | null, allowed: Role[]): void {
  if (!role || !allowed.includes(role)) {
    const err: any = new Error(
      role
        ? `role '${role}' is not permitted to perform this action (requires one of: ${allowed.join(", ")})`
        : "caller is not a member of this organization"
    );
    err.statusCode = 403;
    throw err;
  }
}
