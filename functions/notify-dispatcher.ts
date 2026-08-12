import { adminGql } from "./lib/gql";

// Webhook for the Hasura Event Trigger watching `notifications` INSERTs.
// This is the notify step type's actual delivery mechanism — the run
// executor only inserts a 'pending' row and moves on (see runSteps.ts); this
// handler is what turns that row into a real Slack/email send, decoupled
// from the run.
//
// STUBBED per the assignment's disclosed-fallback option: no real Slack
// webhook URL / SMTP credentials are configured for this assignment, so the
// "send" here is a console.log plus marking the row `sent`. Swapping in a
// real send is a single change: set SLACK_WEBHOOK_URL (or SMTP_* vars) via
// [[global.environment]] in nhost.toml the same way GROQ_API_KEY is wired,
// then replace the body of `send()` below with the real fetch() call.
async function send(notification: { channel: string; target: string; payload: any }): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (notification.channel === "slack" && webhookUrl) {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: notification.payload?.message ?? "" }),
    });
    return;
  }
  // eslint-disable-next-line no-console
  console.log(
    `[notify-dispatcher] STUB send — channel=${notification.channel} target=${notification.target} message=${JSON.stringify(
      notification.payload?.message
    )}`
  );
}

export default async (req: any, res: any) => {
  try {
    const row = req.body?.event?.data?.new;
    if (!row) return res.status(200).json({ skipped: true });

    try {
      await send(row);
      await adminGql(
        `mutation($id: uuid!, $sentAt: timestamptz!) {
           update_notifications_by_pk(pk_columns: { id: $id }, _set: { status: "sent", sent_at: $sentAt }) { id }
         }`,
        { id: row.id, sentAt: new Date().toISOString() }
      );
    } catch (sendErr: any) {
      await adminGql(
        `mutation($id: uuid!, $error: String!) {
           update_notifications_by_pk(pk_columns: { id: $id }, _set: { status: "failed", error: $error }) { id }
         }`,
        { id: row.id, error: sendErr.message ?? String(sendErr) }
      );
    }
    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "internal error" });
  }
};
