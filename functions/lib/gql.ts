// Admin-authenticated GraphQL client used by every function handler to read
// and write workflow/run/step data. Handlers never trust the caller's JWT for
// authorization decisions — they re-derive the real role (see role.ts) and
// then use the admin secret to perform the actual writes, since the tables
// they touch (workflow_steps, workflow_runs, step_runs, ...) have NO insert/
// update/delete permission for any Hasura role (Layer 2 gating lives here,
// not in the database permission layer).

const GRAPHQL_URL = process.env.NHOST_GRAPHQL_URL as string;
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET as string;

export class GqlError extends Error {
  errors: any[];
  constructor(errors: any[]) {
    super(errors?.[0]?.message || "GraphQL error");
    this.errors = errors;
  }
}

export async function adminGql<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hasura-admin-secret": ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new GqlError(json.errors);
  return json.data as T;
}

// Direct SQL execution via Hasura's /v2/query endpoint (admin-only), used
// where we need a genuinely atomic Postgres upsert (e.g. calls_used = calls_used + 1)
// that Hasura's declarative insert on_conflict can't express — on_conflict's
// update_columns overwrites with the new value, it doesn't add to the old one.
const HASURA_BASE = (process.env.NHOST_HASURA_URL || "").replace(/\/console\/?$/, "");

// NOTE: Hasura's run_sql endpoint takes a raw SQL string with no bind-
// parameter support, so callers are responsible for safely constructing it.
// Only used internally (quota.ts) with server-derived uuid/date values that
// are validated before interpolation — never with raw client input.
export async function runSql(sql: string): Promise<any> {
  const res = await fetch(`${HASURA_BASE}/v2/query`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hasura-admin-secret": ADMIN_SECRET,
    },
    body: JSON.stringify({ type: "run_sql", args: { source: "default", sql } }),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`run_sql failed: ${JSON.stringify(json)}`);
  return json;
}
