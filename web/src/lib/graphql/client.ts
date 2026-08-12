"use client";

import { createClient, cacheExchange, fetchExchange, subscriptionExchange, Client } from "@urql/core";
import { createClient as createWsClient } from "graphql-ws";
import { nhostAuth } from "@/lib/auth/nhostAuth";

const HTTP_URL = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL as string;
const WS_URL = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_WS_URL as string;

let client: Client | null = null;

// Public role calls (e.g. none from this frontend today, but kept available)
// send no Authorization header at all; Hasura falls back to its configured
// unauthorized role. Authenticated calls attach the current access token —
// re-read on every request so a token refreshed by nhostAuth's timer is
// always picked up without needing to recreate the client.
function authHeaders(): Record<string, string> {
  const token = nhostAuth.getAccessToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function getGqlClient(): Client {
  if (client) return client;

  const wsClient = createWsClient({
    url: WS_URL,
    connectionParams: () => {
      const token = nhostAuth.getAccessToken();
      return token ? { headers: { authorization: `Bearer ${token}` } } : {};
    },
  });

  client = createClient({
    url: HTTP_URL,
    exchanges: [
      cacheExchange,
      fetchExchange,
      subscriptionExchange({
        forwardSubscription: (request) => ({
          subscribe: (sink) => ({
            unsubscribe: wsClient.subscribe(
              { ...request, query: request.query ?? "" },
              sink as any
            ),
          }),
        }),
      }),
    ],
    fetchOptions: () => ({ headers: authHeaders() }),
  });

  // Note: `connectionParams` above is re-evaluated on every reconnect, so a
  // refreshed token is picked up automatically if the socket ever drops and
  // reconnects. We deliberately don't force-close the socket on every token
  // refresh (graphql-ws's dispose() is meant to be final, not a "reconnect
  // now" — forcing it would kill live subscriptions mid-run) — runs in this
  // app complete well within one 15-minute access-token lifetime.

  return client;
}
