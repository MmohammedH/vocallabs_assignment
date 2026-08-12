// Mirrors the canonical operations documented in /graphql/operations/*.graphql
// at the repo root. Inlined here as plain strings to avoid adding a .graphql
// webpack loader for this scope.

export const MY_ORG_MEMBERSHIPS = /* GraphQL */ `
  query MyOrgMemberships {
    org_members {
      role
      organization {
        id
        name
      }
    }
  }
`;

export const GET_ORG_WORKFLOWS = /* GraphQL */ `
  query GetOrgWorkflows($orgId: uuid!) {
    workflows(where: { org_id: { _eq: $orgId } }, order_by: { created_at: desc }) {
      id
      name
      description
      is_active
      created_at
      steps(order_by: { step_order: asc }) {
        id
        step_order
        name
        type
        config
      }
      triggers {
        id
        type
        config
        is_enabled
      }
      latestRun: runs(order_by: { created_at: desc }, limit: 1) {
        id
        status
        trigger_type
        started_at
        completed_at
      }
    }
  }
`;

export const GET_WORKFLOW = /* GraphQL */ `
  query GetWorkflow($id: uuid!) {
    workflows(where: { id: { _eq: $id } }) {
      id
      org_id
      name
      description
      is_active
      steps(order_by: { step_order: asc }) {
        id
        step_order
        name
        type
        config
      }
      triggers {
        id
        type
        config
        is_enabled
      }
    }
  }
`;

export const ORG_USAGE = /* GraphQL */ `
  query OrgUsage($orgId: uuid!) {
    organizations(where: { id: { _eq: $orgId } }) {
      id
      name
      quota_calls_allowed
      usageThisMonth {
        calls_used
        calls_remaining
      }
    }
  }
`;

export const SAVE_WORKFLOW = /* GraphQL */ `
  mutation SaveWorkflow(
    $orgId: uuid!
    $workflowId: uuid
    $name: String!
    $description: String
    $isActive: Boolean
    $steps: [WorkflowStepInput!]!
    $triggers: [WorkflowTriggerInput!]!
  ) {
    saveWorkflow(
      org_id: $orgId
      workflow_id: $workflowId
      name: $name
      description: $description
      is_active: $isActive
      steps: $steps
      triggers: $triggers
    ) {
      workflow_id
    }
  }
`;

export const TRIGGER_WORKFLOW_RUN = /* GraphQL */ `
  mutation TriggerWorkflowRun($workflowId: uuid!) {
    triggerWorkflowRun(workflow_id: $workflowId) {
      workflow_run_id
      status
    }
  }
`;

export const APPROVE_STEP = /* GraphQL */ `
  mutation ApproveStep($stepRunId: uuid!) {
    approveStep(step_run_id: $stepRunId) {
      workflow_run_id
      status
    }
  }
`;

export const GET_WORKFLOW_RUN = /* GraphQL */ `
  query GetWorkflowRun($id: uuid!) {
    workflow_runs(where: { id: { _eq: $id } }) {
      id
      workflow_id
      status
      trigger_type
      started_at
      completed_at
      workflow {
        name
      }
    }
  }
`;

export const STEP_RUNS_SUBSCRIPTION = /* GraphQL */ `
  subscription StepRunsForRun($workflowRunId: uuid!) {
    step_runs(where: { workflow_run_id: { _eq: $workflowRunId } }, order_by: { step_order: asc }) {
      id
      step_order
      type
      status
      input
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      completed_at
      workflowStep {
        name
      }
    }
  }
`;
