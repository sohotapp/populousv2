// POST /api/merge/webhook
// Handle Merge.dev webhooks for sync notifications

import { NextRequest, NextResponse } from "next/server";
import type { MergeWebhookPayload, MergeWebhookEvent } from "@/lib/merge/types";

// Webhook secret for verification (from Merge dashboard)
const MERGE_WEBHOOK_SECRET = process.env.MERGE_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (in production)
    const signature = request.headers.get("x-merge-signature");
    if (MERGE_WEBHOOK_SECRET && signature) {
      // TODO: Implement signature verification
      // const isValid = verifySignature(body, signature, MERGE_WEBHOOK_SECRET);
      // if (!isValid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = await request.json() as MergeWebhookPayload;
    const event = payload.hook.event as MergeWebhookEvent;

    console.log(`[Merge Webhook] Received event: ${event}`, {
      linkedAccountId: payload.linked_account_id,
    });

    switch (event) {
      case "linked_account.created":
        // New account connected
        console.log(`[Merge Webhook] New account connected: ${payload.linked_account_id}`);
        // Could trigger initial sync here
        break;

      case "sync.completed":
        // Sync completed - data is ready
        console.log(`[Merge Webhook] Sync completed for: ${payload.linked_account_id}`);
        // Could notify frontend via WebSocket or update database
        break;

      case "changed_data":
        // Data changed in source - incremental update available
        console.log(`[Merge Webhook] Data changed for: ${payload.linked_account_id}`);
        // Could trigger incremental sync
        break;

      case "sync.errored":
        // Sync failed
        console.error(`[Merge Webhook] Sync error for: ${payload.linked_account_id}`, payload.data);
        // Could mark connection as errored in database
        break;

      case "linked_account.deleted":
        // Account disconnected
        console.log(`[Merge Webhook] Account disconnected: ${payload.linked_account_id}`);
        // Could clean up associated data
        break;

      default:
        console.log(`[Merge Webhook] Unknown event: ${event}`);
    }

    return NextResponse.json({ received: true, event });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Verify Merge webhook signature (placeholder for production)
function verifySignature(_body: string, _signature: string, _secret: string): boolean {
  // In production, implement HMAC verification:
  // const hmac = crypto.createHmac('sha256', secret);
  // hmac.update(body);
  // const expectedSignature = hmac.digest('hex');
  // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  return true;
}
