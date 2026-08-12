# GraphQL Operations

These are the operations required by the assignment, consumed by the Next.js frontend (`web/`) and, for `webhookTrigger`, by external callers directly.

| File | Kind | Used for |
|---|---|---|
| `operations/get-org-workflows.graphql` | query | Org's workflows with steps, triggers, and most recent run status |
| `operations/get-workflow.graphql` | query | Single workflow for the builder's edit mode |
| `operations/my-org-memberships.graphql` | query | Org switcher — which orgs the caller belongs to and their role in each |
| `operations/org-usage.graphql` | query | Quota indicator (`organizations.usageThisMonth`, the required Hasura aggregation) |
| `operations/save-workflow.graphql` | mutation | Create/edit a workflow, its steps, and its triggers (Action: `saveWorkflow`) |
| `operations/trigger-workflow-run.graphql` | mutation | Manual "Run" button (Action: `triggerWorkflowRun`) |
| `operations/approve-step.graphql` | mutation | Approve a paused `approval_gate` step (Action: `approveStep`) |
| `operations/webhook-trigger.graphql` | mutation | Inbound webhook endpoint external systems call (Action: `webhookTrigger`, public role) |
| `operations/step-runs-subscription.graphql` | subscription | Live per-step status for a run, filtered to `workflow_run_id`, including the paused/awaiting-approval state |
| `operations/get-workflow-run.graphql` | query | One-shot run lookup used before opening the subscription, to distinguish "not started yet" from "forbidden" |

All four mutations here are Hasura Actions, not raw table mutations — see `functions/` for their handlers and `nhost/metadata/actions.yaml` / `actions.graphql` for their Hasura definitions. Every org-scoped query/subscription relies on Layer 1 permissions (see `nhost/metadata/databases/default/tables/public_*.yaml`) to silently return zero rows for anything outside the caller's org — the frontend treats an empty result as "not found or forbidden" rather than assuming success.
