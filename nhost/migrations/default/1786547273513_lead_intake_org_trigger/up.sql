-- lead_intake.org_id must be auto-derived from workflow_id, never client-settable,
-- consistent with every other child table's org-spoofing protection.
create trigger trg_lead_intake_org_id
  before insert or update on public.lead_intake
  for each row execute function public.set_org_id_from_workflow();
