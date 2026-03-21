// supabase/functions/ai-chat/index.ts
// B-047: Edge Function wrapper for AI chat.
//
// Accepts POST with { message, conversationId, workspaceId }.
// Verifies auth (extracts user from JWT), validates workspace membership,
// then delegates to the chat handler (B-046) via the internal API route.
// Returns the response as JSON with appropriate CORS headers.
//
// Depends on: B-046 (handleChat)
// Blocks: B-057

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS headers (consistent with other edge functions)
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Supabase clients
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function getSupabaseWithAuth(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
    },
  );
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

interface ChatRequestBody {
  message: string;
  conversationId: string;
  workspaceId: string;
}

function validateRequest(
  body: unknown,
): { valid: true; data: ChatRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const { message, conversationId, workspaceId } = body as Record<
    string,
    unknown
  >;

  if (!workspaceId || typeof workspaceId !== "string") {
    return {
      valid: false,
      error: "workspaceId is required and must be a string",
    };
  }

  if (!conversationId || typeof conversationId !== "string") {
    return {
      valid: false,
      error: "conversationId is required and must be a string",
    };
  }

  if (
    !message ||
    typeof message !== "string" ||
    (message as string).trim().length === 0
  ) {
    return {
      valid: false,
      error: "message is required and must be a non-empty string",
    };
  }

  if ((message as string).length > 10_000) {
    return {
      valid: false,
      error: "message must be 10,000 characters or fewer",
    };
  }

  return {
    valid: true,
    data: {
      message: (message as string).trim(),
      conversationId: conversationId as string,
      workspaceId: workspaceId as string,
    },
  };
}

// ---------------------------------------------------------------------------
// Timeout wrapper
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 55_000; // 55s — leave headroom within Supabase's 60s limit

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Request timed out")),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // -----------------------------------------------------------------------
    // 1. Authenticate: extract user from JWT
    // -----------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("Missing or invalid Authorization header", 401);
    }

    const supabaseAuth = getSupabaseWithAuth(authHeader);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error("[ai-chat] Auth error:", authError?.message);
      return errorResponse("Invalid or expired token", 401);
    }

    // -----------------------------------------------------------------------
    // 2. Parse and validate request body
    // -----------------------------------------------------------------------
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON in request body", 400);
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return errorResponse(validation.error, 400);
    }

    const { message, conversationId, workspaceId } = validation.data;

    // -----------------------------------------------------------------------
    // 3. Verify workspace membership
    // -----------------------------------------------------------------------
    const admin = getSupabaseAdmin();
    const { data: member, error: memberError } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return errorResponse("Access denied: not a member of this workspace", 403);
    }

    // -----------------------------------------------------------------------
    // 4. Forward to chat handler (B-046) via internal API route
    //    The handleChat orchestration lives in the Next.js app. The edge
    //    function delegates to it, keeping auth + validation at the edge.
    // -----------------------------------------------------------------------
    const appUrl = Deno.env.get("APP_URL");
    if (!appUrl) {
      console.error("[ai-chat] APP_URL environment variable is not set");
      return errorResponse("Server configuration error", 500);
    }

    const chatPayload = {
      workspace_id: workspaceId,
      user_id: user.id,
      conversation_id: conversationId,
      message,
    };

    const chatResponse = await withTimeout(
      fetch(`${appUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Forward the service role key for internal auth
          "X-Supabase-Service-Role": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        },
        body: JSON.stringify(chatPayload),
      }),
      REQUEST_TIMEOUT_MS,
    );

    // -----------------------------------------------------------------------
    // 5. Return response
    // -----------------------------------------------------------------------
    const chatResult = await chatResponse.json();

    if (!chatResponse.ok) {
      const status = chatResponse.status >= 400 && chatResponse.status < 600
        ? chatResponse.status
        : 500;
      return errorResponse(
        chatResult.error || "Chat processing failed",
        status,
      );
    }

    // Strip orchestration metadata (edge function responses are always "production")
    if (chatResult._orchestration) {
      delete chatResult._orchestration;
    }

    return jsonResponse(chatResult, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[ai-chat] Unhandled error:", message);

    if (message === "Request timed out") {
      return errorResponse(
        "The request took too long to process. Please try a simpler question or try again later.",
        504,
      );
    }

    return errorResponse(
      "An error occurred while processing your request. Please try again.",
      500,
    );
  }
});
