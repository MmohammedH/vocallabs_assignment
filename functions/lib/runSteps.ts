import { adminGql } from "./gql";
import { resolveConfig, registerStepOutput, RunContext } from "./interpolate";
import { evaluateCondition } from "./condition";
import { callGroq } from "./groq";
import { callHttp } from "./httpRequest";
import { withRetry } from "./retry";
import { incrementUsage } from "./quota";

type WorkflowStepRow = {
  id: string;
  step_order: number;
  name: string | null;
  type: string;
  config: any;
};

type WorkflowRunRow = {
  id: string;
  workflow_id: string;
  org_id: string;
  status: string;
  input: any;
};

async function getWorkflowRun(runId: string): Promise<WorkflowRunRow> {
  const data = await adminGql<{ workflow_runs_by_pk: WorkflowRunRow }>(
    `query($id: uuid!) {
       workflow_runs_by_pk(id: $id) { id workflow_id org_id status input }
     }`,
    { id: runId }
  );
  if (!data.workflow_runs_by_pk) throw new Error(`workflow_run ${runId} not found`);
  return data.workflow_runs_by_pk;
}

async function getExistingStepRuns(runId: string) {
  const data = await adminGql<{ step_runs: { step_order: number; output: any; workflowStep: { name: string | null } }[] }>(
    `query($runId: uuid!) {
       step_runs(where: { workflow_run_id: { _eq: $runId } }, order_by: { step_order: asc }) {
         step_order
         output
         workflowStep { name }
       }
     }`,
    { runId }
  );
  return data.step_runs;
}

async function getStepsFrom(workflowId: string, fromStepOrder: number): Promise<WorkflowStepRow[]> {
  const data = await adminGql<{ workflow_steps: WorkflowStepRow[] }>(
    `query($workflowId: uuid!, $fromOrder: Int!) {
       workflow_steps(
         where: { workflow_id: { _eq: $workflowId }, step_order: { _gte: $fromOrder } }
         order_by: { step_order: asc }
       ) { id step_order name type config }
     }`,
    { workflowId, fromOrder: fromStepOrder }
  );
  return data.workflow_steps;
}

async function insertStepRun(runId: string, orgId: string, step: WorkflowStepRow, input: any) {
  const data = await adminGql<{ insert_step_runs_one: { id: string } }>(
    `mutation($object: step_runs_insert_input!) {
       insert_step_runs_one(object: $object) { id }
     }`,
    {
      object: {
        workflow_run_id: runId,
        workflow_step_id: step.id,
        step_order: step.step_order,
        type: step.type,
        status: "running",
        input,
        started_at: new Date().toISOString(),
      },
    }
  );
  return data.insert_step_runs_one.id;
}

async function updateStepRun(stepRunId: string, set: Record<string, any>) {
  await adminGql(
    `mutation($id: uuid!, $set: step_runs_set_input!) {
       update_step_runs_by_pk(pk_columns: { id: $id }, _set: $set) { id }
     }`,
    { id: stepRunId, set }
  );
}

async function updateWorkflowRun(runId: string, set: Record<string, any>) {
  await adminGql(
    `mutation($id: uuid!, $set: workflow_runs_set_input!) {
       update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: $set) { id }
     }`,
    { id: runId, set }
  );
}

async function insertSkippedStepRun(runId: string, step: WorkflowStepRow) {
  await adminGql(
    `mutation($object: step_runs_insert_input!) { insert_step_runs_one(object: $object) { id } }`,
    {
      object: {
        workflow_run_id: runId,
        workflow_step_id: step.id,
        step_order: step.step_order,
        type: step.type,
        status: "skipped",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      },
    }
  );
}

// Runs workflow_steps with step_order >= fromStepOrder, in order, updating
// step_runs/workflow_runs as it goes so the step_runs subscription reflects
// progress live. Stops (returns) on an approval_gate (run paused) or a
// failed step (run failed). A completed pass marks the run 'completed'.
// This same function is called for: manual trigger, webhook trigger,
// scheduled trigger, database-event trigger, AND resuming after approval —
// resume is nothing more than re-entering this loop at fromStepOrder.
export async function runSteps(runId: string, fromStepOrder: number): Promise<void> {
  const run = await getWorkflowRun(runId);
  const existing = await getExistingStepRuns(runId);
  const steps = await getStepsFrom(run.workflow_id, fromStepOrder);

  const context: RunContext = { steps: {}, trigger: { input: run.input ?? null } };
  let lastOutput: any = null;
  const skipOrders = new Set<number>();

  for (const sr of existing) {
    registerStepOutput(context, sr.step_order, sr.workflowStep?.name ?? null, sr.output);
    lastOutput = sr.output ?? lastOutput;
  }

  for (const step of steps) {
    if (skipOrders.has(step.step_order)) {
      await insertSkippedStepRun(runId, step);
      continue;
    }

    const resolvedConfig = resolveConfig(step.config ?? {}, context);
    const stepRunId = await insertStepRun(runId, run.org_id, step, resolvedConfig);

    try {
      switch (step.type) {
        case "llm_call": {
          let attempts = 0;
          const result = await withRetry(
            async () => callGroq(resolvedConfig),
            async (attempt, error) => {
              attempts = attempt;
              await updateStepRun(stepRunId, { attempt_count: attempt });
              await incrementUsage(run.org_id);
              if (error) await updateStepRun(stepRunId, { error: error.message });
            }
          );
          const output = { content: result.content, model: result.model };
          await updateStepRun(stepRunId, {
            status: "succeeded",
            output,
            error: null,
            attempt_count: attempts,
            completed_at: new Date().toISOString(),
          });
          registerStepOutput(context, step.step_order, step.name, output);
          lastOutput = output;
          break;
        }

        case "http_request": {
          let attempts = 0;
          const result = await withRetry(
            async () => callHttp(resolvedConfig),
            async (attempt, error) => {
              attempts = attempt;
              await updateStepRun(stepRunId, { attempt_count: attempt });
              await incrementUsage(run.org_id);
              if (error) await updateStepRun(stepRunId, { error: error.message });
            }
          );
          const output = { status: result.status, body: result.body };
          await updateStepRun(stepRunId, {
            status: "succeeded",
            output,
            error: null,
            attempt_count: attempts,
            completed_at: new Date().toISOString(),
          });
          registerStepOutput(context, step.step_order, step.name, output);
          lastOutput = output;
          break;
        }

        case "db_write": {
          await adminGql(
            `mutation($object: workflow_outputs_insert_input!) {
               insert_workflow_outputs_one(object: $object) { id }
             }`,
            {
              object: {
                workflow_run_id: runId,
                step_run_id: stepRunId,
                key: resolvedConfig.key,
                value: resolvedConfig.value ?? null,
              },
            }
          );
          const output = { key: resolvedConfig.key, written: true };
          await updateStepRun(stepRunId, { status: "succeeded", output, completed_at: new Date().toISOString() });
          registerStepOutput(context, step.step_order, step.name, output);
          lastOutput = output;
          break;
        }

        case "notify": {
          await adminGql(
            `mutation($object: notifications_insert_input!) {
               insert_notifications_one(object: $object) { id }
             }`,
            {
              object: {
                step_run_id: stepRunId,
                channel: resolvedConfig.channel,
                target: resolvedConfig.target,
                payload: { message: resolvedConfig.message },
              },
            }
          );
          // Fire-and-forget: the Hasura Event Trigger on `notifications`
          // dispatches the real send asynchronously. The executor does not
          // wait for delivery confirmation before moving on.
          const output = { queued: true };
          await updateStepRun(stepRunId, { status: "succeeded", output, completed_at: new Date().toISOString() });
          registerStepOutput(context, step.step_order, step.name, output);
          lastOutput = output;
          break;
        }

        case "conditional_branch": {
          const passed = evaluateCondition(resolvedConfig.condition, lastOutput);
          const output = { condition_passed: passed };
          await updateStepRun(stepRunId, { status: "succeeded", output, completed_at: new Date().toISOString() });
          registerStepOutput(context, step.step_order, step.name, output);
          if (!passed) {
            for (const order of resolvedConfig.skip_step_orders_if_false ?? []) skipOrders.add(order);
          }
          lastOutput = output;
          break;
        }

        case "approval_gate": {
          await updateStepRun(stepRunId, { status: "paused" });
          await updateWorkflowRun(runId, { status: "paused", current_step_order: step.step_order });
          return; // stop the loop entirely — approveStep() resumes it later
        }

        default:
          throw new Error(`unknown step type: ${step.type}`);
      }
    } catch (err: any) {
      await updateStepRun(stepRunId, {
        status: "failed",
        error: err?.message ?? String(err),
        completed_at: new Date().toISOString(),
      });
      await updateWorkflowRun(runId, {
        status: "failed",
        error: err?.message ?? String(err),
        completed_at: new Date().toISOString(),
      });
      return;
    }
  }

  await updateWorkflowRun(runId, {
    status: "completed",
    output: lastOutput,
    completed_at: new Date().toISOString(),
  });
}
