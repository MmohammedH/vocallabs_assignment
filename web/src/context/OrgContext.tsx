"use client";

import { createContext, useContext, ReactNode } from "react";

export type Role = "owner" | "editor" | "viewer";

export type Membership = { role: Role; organization: { id: string; name: string } };

type OrgContextValue = {
  orgId: string;
  role: Role;
  orgName: string;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ value, children }: { value: OrgContextValue; children: ReactNode }) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}

export function canManageMembers(role: Role) {
  return role === "owner";
}
export function canEditWorkflow(role: Role) {
  return role === "owner" || role === "editor";
}
export function canRun(role: Role) {
  return role === "owner" || role === "editor";
}
export function canApprove(role: Role) {
  return role === "owner" || role === "editor";
}
