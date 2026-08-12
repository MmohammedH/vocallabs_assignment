// http_request step: generic outbound call to any external API.
export type HttpRequestResult = { status: number; headers: Record<string, string>; body: any };

export async function callHttp(opts: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<HttpRequestResult> {
  const method = (opts.method || "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && opts.body !== undefined;

  const res = await fetch(opts.url, {
    method,
    headers: {
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
    body: hasBody ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)) : undefined,
  });

  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // not JSON, keep as raw text
  }

  if (!res.ok) {
    const err: any = new Error(`http_request failed with status ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));
  return { status: res.status, headers, body };
}
