import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processWebhookEvent } from "@/lib/clickup/webhooks";
import type { ClickUpWebhookPayload } from "@/types/clickup";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * POST /api/webhooks/clickup
 *
 * Receives webhook events from ClickUp. ClickUp sends a POST request
 * for each event (task changes, list changes, etc.).
 *
 * Flow:
 * 1. Parse and validate the incoming payload
 * 2. Look up the workspace associated with the webhook
 * 3. Store the raw event in the webhook_events table
 * 4. Process the event to update cached data
 * 5. Return 200 quickly to acknowledge receipt
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = body as ClickUpWebhookPayload;

    // Validate minimum required fields
    if (!payload.event || !payload.webhook_id) {
      return NextResponse.json(
        { error: "Invalid webhook payload: missing event or webhook_id" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Find the workspace associated with this webhook
    const { data: workspace, error: lookupError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("clickup_webhook_id", payload.webhook_id)
      .single();

    if (lookupError || !workspace) {
      console.warn(
        `[Webhook] No workspace found for webhook ID: ${payload.webhook_id}`
      );
      // Return 200 anyway to prevent ClickUp from retrying
      return NextResponse.json({ received: true, matched: false });
    }

    const workspaceId = workspace.id;

    // Store the raw event in webhook_events table for audit/replay
    const { error: insertError } = await supabase
      .from("webhook_events")
      .insert({
        workspace_id: workspaceId,
        source: "clickup",
        event_type: payload.event,
        webhook_id: payload.webhook_id,
        payload: body,
        received_at: new Date().toISOString(),
        processed: false,
      });

    if (insertError) {
      console.error("[Webhook] Failed to store event:", insertError);
    }

    // Process the event immediately to update cached data
    try {
      await processWebhookEvent(payload, workspaceId);

      // Mark event as processed
      if (!insertError) {
        await supabase
          .from("webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("workspace_id", workspaceId)
          .eq("webhook_id", payload.webhook_id)
          .eq("event_type", payload.event)
          .order("received_at", { ascending: false })
          .limit(1);
      }
    } catch (processError) {
      console.error("[Webhook] Failed to process event:", processError);
      // Don't fail the response — event is stored and can be retried
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (err) {
    console.error("[Webhook] Unexpected error:", err);
    // Return 200 to prevent ClickUp from retrying on our errors
    return NextResponse.json(
      { received: true, error: "Internal processing error" },
      { status: 200 }
    );
  }
}
