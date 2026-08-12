import { adminGql, runSql } from "./gql";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function getUsage(orgId: string): Promise<{ callsUsed: number; callsAllowed: number; remaining: number }> {
  const data = await adminGql<{ org_usage_this_month: { calls_used: number; quota_calls_allowed: number; calls_remaining: number }[] }>(
    `query($orgId: uuid!) {
       org_usage_this_month(where: { org_id: { _eq: $orgId } }) {
         calls_used
         quota_calls_allowed
         calls_remaining
       }
     }`,
    { orgId }
  );
  const row = data.org_usage_this_month[0];
  return {
    callsUsed: row?.calls_used ?? 0,
    callsAllowed: row?.quota_calls_allowed ?? 0,
    remaining: row?.calls_remaining ?? 0,
  };
}

// Atomically increments this month's usage counter by 1. Called once per
// external-call ATTEMPT (llm_call / http_request), success or failure — a
// failed retry still consumed provider quota/cost, so it counts too.
export async function incrementUsage(orgId: string): Promise<void> {
  const periodStart = firstOfMonth();
  if (!UUID_RE.test(orgId) || !DATE_RE.test(periodStart)) {
    throw new Error("incrementUsage: invalid orgId/periodStart");
  }
  await runSql(
    `INSERT INTO public.org_usage_counters (org_id, period_start, calls_used)
     VALUES ('${orgId}'::uuid, '${periodStart}'::date, 1)
     ON CONFLICT (org_id, period_start)
     DO UPDATE SET calls_used = org_usage_counters.calls_used + 1, updated_at = now();`
  );
}

function firstOfMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
