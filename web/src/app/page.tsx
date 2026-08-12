"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? "/orgs" : "/login");
  }, [loading, session, router]);

  return (
    <div className="flex-1 flex items-center justify-center text-slate-500">
      Loading…
    </div>
  );
}
