"use client";

import Link from "next/link";

// Deliberately identical copy whether the resource doesn't exist or belongs
// to another org — never reveal which, so this can't be used to probe for
// valid ids across orgs.
export function ForbiddenState({ backHref = "/orgs" }: { backHref?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
      <p className="text-lg font-medium">Not found, or you don&apos;t have access</p>
      <p className="text-sm text-slate-500 max-w-sm">
        This resource doesn&apos;t exist, or belongs to an organization you&apos;re not a member of.
      </p>
      <Link href={backHref} className="text-sm underline text-slate-700">
        Back
      </Link>
    </div>
  );
}
