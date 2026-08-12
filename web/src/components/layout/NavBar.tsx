"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { QuotaIndicator } from "./QuotaIndicator";

export function NavBar() {
  const { orgId, orgName, role } = useOrg();
  const { signOut, session } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/org/${orgId}/workflows`} className="font-semibold">
            {orgName}
          </Link>
          <span className="text-xs uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{role}</span>
        </div>
        <div className="flex items-center gap-4">
          <QuotaIndicator orgId={orgId} />
          <button onClick={() => router.push("/orgs")} className="text-sm text-slate-600 hover:underline">
            Switch org
          </button>
          <span className="text-sm text-slate-400">{session?.user.email}</span>
          <button onClick={() => signOut().then(() => router.push("/login"))} className="text-sm text-slate-600 hover:underline">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
