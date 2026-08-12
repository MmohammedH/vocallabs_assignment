"use client";

import { WorkflowBuilderPage, Draft } from "@/components/builder/WorkflowBuilderPage";

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  is_active: true,
  steps: [],
  triggers: [{ type: "manual", config: {}, is_enabled: true }],
};

export default function NewWorkflowPage() {
  return <WorkflowBuilderPage workflowId={null} initialDraft={EMPTY_DRAFT} />;
}
