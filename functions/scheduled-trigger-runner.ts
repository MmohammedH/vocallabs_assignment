import { adminGql } from "./lib/gql";
import { startRun } from "./lib/startRun";
import { cronMatches } from "./lib/cron";

// Webhook for a single, static Hasura Cron Trigger (see
// nhost/metadata/cron_triggers.yaml, schedule "* * * * *"). Rather than
// registering one real Hasura cron trigger per user-configured schedule
// (which would mean calling Hasura's metadata API at runtime whenever a
// workflow's scheduled trigger is saved), this polls once a minute for every
// enabled `scheduled` trigger and runs the ones whose cron expression
// matches the current UTC minute. Simpler and fully git-trackable, at
// 1-minute granularity.
export default async (req: any, res: any) => {
  try {
    const now = req.body?.scheduled_time ? new Date(req.body.scheduled_time) : new Date();

    const data = await adminGql<{
      workflow_triggers: { id: string; config: any; workflow_id: string; workflow: { org_id: string; is_active: boolean } }[];
    }>(
      `query {
         workflow_triggers(where: { type: { _eq: "scheduled" }, is_enabled: { _eq: true } }) {
           id config workflow_id
           workflow { org_id is_active }
         }
       }`
    );

    const results: any[] = [];
    for (const trigger of data.workflow_triggers) {
      if (!trigger.workflow.is_active) continue;
      const cron = trigger.config?.cron;
      if (!cron || !cronMatches(cron, now)) continue;

      const result = await startRun({
        workflowId: trigger.workflow_id,
        orgId: trigger.workflow.org_id,
        triggerType: "scheduled",
      });
      results.push({ trigger_id: trigger.id, workflow_id: trigger.workflow_id, ...result });
    }

    res.status(200).json({ checked: data.workflow_triggers.length, started: results.length, results });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "internal error" });
  }
};
