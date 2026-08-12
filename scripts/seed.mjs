#!/usr/bin/env node
// Seeds the Final Task demo scenario: two isolated orgs, each with their
// own users/roles, and a fully-built demo workflow in Org A.
//
// Usage:
//   HASURA_ADMIN_SECRET=<value from .secrets> node scripts/seed.mjs
//
// Env overrides (all optional, default to local nhost):
//   AUTH_URL     default https://local.auth.local.nhost.run/v1
//   GRAPHQL_URL  default https://local.graphql.local.nhost.run/v1
//
// Idempotent-ish: re-running creates fresh users/orgs each time (emails are
// timestamped) rather than upserting — cheap to re-run before a demo.

const AUTH_URL = process.env.AUTH_URL || "https://local.auth.local.nhost.run/v1";
const GQL_URL = process.env.GRAPHQL_URL || "https://local.graphql.local.nhost.run/v1";
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const PASSWORD = "Password123!";

if (!ADMIN_SECRET) {
  console.error("Set HASURA_ADMIN_SECRET (see .secrets locally, or your nhost Cloud project's admin secret).");
  process.exit(1);
}

async function signUp(email) {
  const res = await fetch(`${AUTH_URL}/signup/email-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`signup ${email} failed: ${JSON.stringify(json)}`);
  return json.session.user;
}

async function adminGql(query, variables) {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

const stamp = Date.now();
const users = {
  ownerA: `owner-a-${stamp}@example.com`,
  editorA: `editor-a-${stamp}@example.com`,
  viewerA: `viewer-a-${stamp}@example.com`,
  ownerB: `owner-b-${stamp}@example.com`,
};

console.log("Signing up users...");
const [ownerA, editorA, viewerA, ownerB] = await Promise.all(Object.values(users).map(signUp));

console.log("Creating organizations...");
const orgs = await adminGql(
  `mutation($a: String!, $b: String!) {
     orgA: insert_organizations_one(object: { name: $a }) { id }
     orgB: insert_organizations_one(object: { name: $b }) { id }
   }`,
  { a: `Acme Corp (Org A)`, b: `Globex Inc (Org B)` }
);
const orgAId = orgs.orgA.id;
const orgBId = orgs.orgB.id;

console.log("Assigning roles...");
await adminGql(
  `mutation($rows: [org_members_insert_input!]!) { insert_org_members(objects: $rows) { affected_rows } }`,
  {
    rows: [
      { org_id: orgAId, user_id: ownerA.id, role: "owner" },
      { org_id: orgAId, user_id: editorA.id, role: "editor" },
      { org_id: orgAId, user_id: viewerA.id, role: "viewer" },
      { org_id: orgBId, user_id: ownerB.id, role: "owner" },
    ],
  }
);

console.log("Building the demo workflow in Org A (llm_call -> conditional_branch -> http_request -> approval_gate)...");
const webhookSecret = "demo-webhook-secret";
const workflow = await adminGql(
  `mutation($orgId: uuid!, $userId: uuid!) {
     insert_workflows_one(object: { org_id: $orgId, name: "Support ticket triage", description: "Classifies sentiment, fetches context, branches, and pauses for approval before acting.", created_by: $userId }) { id }
   }`,
  { orgId: orgAId, userId: ownerA.id }
);
const workflowId = workflow.insert_workflows_one.id;

await adminGql(
  `mutation($objects: [workflow_steps_insert_input!]!) { insert_workflow_steps(objects: $objects) { affected_rows } }`,
  {
    objects: [
      {
        workflow_id: workflowId,
        step_order: 1,
        name: "classify_sentiment",
        type: "llm_call",
        config: {
          prompt:
            "Reply with exactly one word, lowercase, no punctuation: positive or negative. Sentiment of this support ticket: 'This product completely ruined my week, nothing works and support never replies.'",
        },
      },
      {
        // conditional_branch evaluates against the IMMEDIATELY PRECEDING
        // step's output, so this must sit right after classify_sentiment,
        // not after fetch_customer_context — this is what makes it
        // genuinely "branch based on the LLM's output" rather than on
        // whatever step happens to run right before it.
        workflow_id: workflowId,
        step_order: 2,
        name: "branch_on_sentiment",
        type: "conditional_branch",
        config: {
          condition: { path: "content", operator: "eq", value: "negative" },
          skip_step_orders_if_false: [3],
        },
      },
      {
        // Only fetch extra customer context (real HTTP call) when the
        // ticket is negative-sentiment — the concrete, visible effect of
        // the branch above.
        workflow_id: workflowId,
        step_order: 3,
        name: "fetch_customer_context",
        type: "http_request",
        config: { url: "https://httpbin.org/get", method: "GET" },
      },
      {
        // Always runs regardless of the branch, so the demo reliably
        // reaches the pause/approve step.
        workflow_id: workflowId,
        step_order: 4,
        name: "manager_approval",
        type: "approval_gate",
        config: {},
      },
    ],
  }
);

await adminGql(
  `mutation($objects: [workflow_triggers_insert_input!]!) { insert_workflow_triggers(objects: $objects) { affected_rows } }`,
  {
    objects: [
      { workflow_id: workflowId, type: "manual", config: {} },
      { workflow_id: workflowId, type: "webhook", config: { secret: webhookSecret } },
    ],
  }
);

console.log("\n================ DEMO SCENARIO READY ================\n");
console.log(`Org A ("Acme Corp"):  ${orgAId}`);
console.log(`  owner:  ${users.ownerA}  / ${PASSWORD}`);
console.log(`  editor: ${users.editorA}  / ${PASSWORD}`);
console.log(`  viewer: ${users.viewerA}  / ${PASSWORD}`);
console.log(`Org B ("Globex Inc"): ${orgBId}`);
console.log(`  owner:  ${users.ownerB}  / ${PASSWORD}`);
console.log(`\nDemo workflow: ${workflowId} ("Support ticket triage")`);
console.log(`  1. classify_sentiment (llm_call, real Groq call)`);
console.log(`  2. branch_on_sentiment (conditional_branch on step 1's output — skips step 3 unless sentiment is "negative")`);
console.log(`  3. fetch_customer_context (http_request, real call to httpbin.org — only runs for negative sentiment)`);
console.log(`  4. manager_approval (approval_gate — always runs, pauses the run)`);
console.log(`\nStart it manually: sign in as the owner, open the workflow, click Run.`);
console.log(`Start it via webhook (2nd start method), from anywhere:`);
console.log(`  curl -X POST ${GQL_URL} -H 'content-type: application/json' -d '{"query":"mutation { webhookTrigger(workflow_id: \\"${workflowId}\\", secret: \\"${webhookSecret}\\", payload: {}) { workflow_run_id status } }"}'`);
console.log(`\nWalk the Final Task checklist:`);
console.log(`  - Sign in as the Org A owner/editor -> Run -> watch it pause at manager_approval live -> Approve.`);
console.log(`  - Sign in as the Org B owner -> confirm Org A's org/workflow/run are all inaccessible, including by pasting the ids above directly into the URL.`);
console.log("\n=======================================================\n");
