"use client";

import { ReactNode, useState } from "react";
import { Provider as UrqlProvider } from "urql";
import { AuthProvider } from "@/context/AuthContext";
import { getGqlClient } from "@/lib/graphql/client";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => getGqlClient());
  return (
    <UrqlProvider value={client}>
      <AuthProvider>{children}</AuthProvider>
    </UrqlProvider>
  );
}
