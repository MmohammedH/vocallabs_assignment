"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "urql";
import { useAuth } from "@/context/AuthContext";
import { OrgProvider, Membership } from "@/context/OrgContext";
import { MY_ORG_MEMBERSHIPS } from "@/lib/graphql/operations";
import { setActiveRole } from "@/lib/graphql/client";
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

  // Set synchronously during render, not in an effect: effects run
  // children-first, so NavBar/QuotaIndicator's own data-fetching effects
  // (deeper in the tree) would otherwise race this and fire their very
  // first request before the role was set. Render itself runs parent-first,
  // so setting it here guarantees every child's first query already sees
  // the correct x-hasura-role.
  //
  // Deliberately no matching cleanup-on-unmount effect: React Strict Mode
  // (on by default in Next.js dev) mounts/cleans-up/remounts effects once
  // synthetically, so a `useEffect(() => () => setActiveRole(null), [])`
  // here would clear it again immediately after mount — right before the
  // *real* child effects (like QuotaIndicator's fetch) get to run. Since
  // this render-time set is idempotent and every other org's layout sets
  // its own value the same way before its children query, no cleanup is
  // needed: the only window without one is after leaving org context
  // entirely (e.g. back to /orgs), where no query on that page depends on
  // a specific role anyway.
  setActiveRole(membership.role);

  return (
    <OrgProvider value={{ orgId, role: membership.role, orgName: membership.organization.name }}>
      <NavBar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">{children}</main>
    </OrgProvider>
  );
}
