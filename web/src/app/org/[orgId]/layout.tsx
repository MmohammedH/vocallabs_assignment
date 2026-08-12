"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "urql";
import { useAuth } from "@/context/AuthContext";
import { OrgProvider, Membership } from "@/context/OrgContext";
import { MY_ORG_MEMBERSHIPS } from "@/lib/graphql/operations";
import { ForbiddenState } from "@/components/common/ForbiddenState";
import { NavBar } from "@/components/layout/NavBar";

// This layout is the org-scoped access boundary for every nested route.
// It resolves the caller's role from their OWN org_members rows (the
// self-row clause in that table's select permission), never from the URL —
// so navigating straight to /org/<some-other-org-id>/... renders
// ForbiddenState instead of leaking whether that org exists.
export default function OrgLayout({ children }: LayoutProps<"/org/[orgId]">) {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [{ data, fetching }] = useQuery<{ org_members: Membership[] }>({
    query: MY_ORG_MEMBERSHIPS,
    pause: !session,
  });

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login");
  }, [authLoading, session, router]);

  if (authLoading || fetching) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">Loading…</div>;
  }
  if (!session) return null;

  const membership = data?.org_members.find((m) => m.organization.id === orgId);
  if (!membership) return <ForbiddenState />;

  return (
    <OrgProvider value={{ orgId, role: membership.role, orgName: membership.organization.name }}>
      <NavBar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">{children}</main>
    </OrgProvider>
  );
}
