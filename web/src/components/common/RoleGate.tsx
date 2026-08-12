"use client";

import { ReactNode } from "react";
import { Role, useOrg } from "@/context/OrgContext";

// Renders children only if the caller's role is in `allow` — structurally
// absent from the DOM otherwise, not just hidden. This is UI convenience
// only; every mutation it guards is independently enforced server-side
// (Hasura Layer 1 permission + the Action handler's own role re-check).
export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { role } = useOrg();
  if (!allow.includes(role)) return null;
  return <>{children}</>;
}
