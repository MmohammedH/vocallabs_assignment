// Shared retry-with-backoff for llm_call / http_request steps. Calls
// onAttempt after every attempt (success or failure) so the caller can
// persist attempt_count and increment quota usage per external call,
// regardless of whether that particular attempt succeeded.
const BACKOFF_MS = [500, 1500, 4000];

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  onAttempt: (attempt: number, error: Error | null) => Promise<void>
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const result = await fn(attempt);
      await onAttempt(attempt, null);
      return result;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      await onAttempt(attempt, lastError);
      if (attempt < BACKOFF_MS.length) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
      }
    }
  }
  throw lastError;
}
