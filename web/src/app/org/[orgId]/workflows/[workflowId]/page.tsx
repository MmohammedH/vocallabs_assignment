"use client";

import { useParams } from "next/navigation";
import { useQuery } from "urql";
import { GET_WORKFLOW } from "@/lib/graphql/operations";
import { WorkflowBuilderPage, Draft } from "@/components/builder/WorkflowBuilderPage";
import { ForbiddenState } from "@/components/common/ForbiddenState";
import { useOrg } from "@/context/OrgContext";

export default function EditWorkflowPage() {
  const params = useParams<{ orgId: string; workflowId: string }>();
  const { orgId } = useOrg();
  const [{ data, fetching, error }] = useQuery({
    query: GET_WORKFLOW,
    variables: { id: params.workflowId },
  });

  if (fetching) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const workflow = data?.workflows?.[0];
  // Empty result under row-level security means "not found or forbidden" —
  // and belt-and-suspenders: also reject if it resolved to a DIFFERENT org
  // than the one in the URL (shouldn't happen given the permission filter,
  // but never trust a single layer).
  if (!workflow || workflow.org_id !== orgId) return <ForbiddenState backHref={`/org/${orgId}/workflows`} />;

  const draft: Draft = {
    name: workflow.name,
    description: workflow.description ?? "",
    is_active: workflow.is_active,
    steps: workflow.steps.map((s: any) => ({ step_order: s.step_order, name: s.name ?? "", type: s.type, config: s.config })),
    triggers: workflow.triggers.map((t: any) => ({ type: t.type, config: t.config, is_enabled: t.is_enabled })),
  };

  return <WorkflowBuilderPage workflowId={workflow.id} initialDraft={draft} />;
}
