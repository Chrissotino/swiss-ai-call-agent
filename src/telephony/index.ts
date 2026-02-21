import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface OutboundCallRequest {
  to: string;           // Swiss phone number (+41...)
  from?: string;        // Twilio number (defaults to env)
  customerName?: string;
  goal: string;
  language?: "de" | "de-CH" | "fr" | "it";
  callbackUrl?: string; // Webhook URL for call events
}

export interface OutboundCallResult {
  callSid: string;
  status: string;
  to: string;
  from: string;
  startedAt: string;
}

export interface CallStatus {
  callSid: string;
  status: "queued" | "ringing" | "in-progress" | "completed" | "failed" | "busy" | "no-answer";
  duration?: number;
  to: string;
  from: string;
  startedAt?: string;
  endedAt?: string;
}

// ─────────────────────────────────────────────────────────────
// Twilio Adapter
// ─────────────────────────────────────────────────────────────

/**
 * Lazy-load Twilio client to avoid crashing if credentials aren't set.
 */
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are not set");
  }

  // Dynamic import to avoid build-time issues
  const twilio = require("twilio");
  return twilio(accountSid, authToken);
}

/**
 * Initiate an outbound call via Twilio.
 * The call will hit the webhookUrl to get TwiML instructions.
 */
export async function initiateOutboundCall(
  request: OutboundCallRequest
): Promise<OutboundCallResult> {
  const client = getTwilioClient();

  const from = request.from ?? process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error("TWILIO_PHONE_NUMBER is not set");
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const webhookUrl = request.callbackUrl ?? `${apiBaseUrl}/webhooks/twilio/outbound`;

  // Validate Swiss phone number format
  const normalizedTo = normalizeSwissNumber(request.to);

  const call = await client.calls.create({
    to: normalizedTo,
    from,
    url: webhookUrl,
    statusCallback: `${apiBaseUrl}/webhooks/twilio/status`,
    statusCallbackMethod: "POST",
  });

  console.log(`[Telephony] Outbound call initiated: ${call.sid} → ${normalizedTo}`);

  return {
    callSid: call.sid,
    status: call.status,
    to: normalizedTo,
    from,
    startedAt: new Date().toISOString(),
  };
}

/**
 * Get the status of an active call.
 */
export async function getCallStatus(callSid: string): Promise<CallStatus> {
  const client = getTwilioClient();
  const call = await client.calls(callSid).fetch();

  return {
    callSid: call.sid,
    status: call.status,
    duration: call.duration ? Number(call.duration) : undefined,
    to: call.to,
    from: call.from,
    startedAt: call.startTime?.toISOString(),
    endedAt: call.endTime?.toISOString(),
  };
}

/**
 * End an active call.
 */
export async function hangupCall(callSid: string): Promise<void> {
  const client = getTwilioClient();
  await client.calls(callSid).update({ status: "completed" });
  console.log(`[Telephony] Call hung up: ${callSid}`);
}

/**
 * Send a DTMF tone to an active call.
 */
export async function sendDTMF(callSid: string, digits: string): Promise<void> {
  const client = getTwilioClient();
  await client.calls(callSid).update({
    twiml: `<Response><Play digits="${digits}"/></Response>`,
  });
}

// ─────────────────────────────────────────────────────────────
// Swiss Phone Number Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Normalize Swiss phone numbers to E.164 format (+41...).
 */
export function normalizeSwissNumber(number: string): string {
  // Remove spaces, dashes, parentheses
  let cleaned = number.replace(/[\s\-().]/g, "");

  // Handle local format (0XX XXXXXXX → +41 XX XXXXXXX)
  if (cleaned.startsWith("0") && !cleaned.startsWith("00")) {
    cleaned = "+41" + cleaned.slice(1);
  }

  // Handle international format without +
  if (cleaned.startsWith("0041")) {
    cleaned = "+41" + cleaned.slice(4);
  }

  // Validate that it's a valid Swiss number
  if (!cleaned.match(/^\+41[0-9]{9}$/)) {
    console.warn(`[Telephony] Warning: "${number}" may not be a valid Swiss number`);
  }

  return cleaned;
}

/**
 * Check if a number is a valid Swiss mobile number.
 */
export function isSwissMobile(number: string): boolean {
  const normalized = normalizeSwissNumber(number);
  // Swiss mobile prefixes: 075, 076, 077, 078, 079
  return /^\+417[5-9]/.test(normalized);
}

/**
 * Format a Swiss number for display (e.g., +41 79 123 45 67).
 */
export function formatSwissNumber(number: string): string {
  const normalized = normalizeSwissNumber(number);
  if (normalized.startsWith("+41") && normalized.length === 12) {
    const local = normalized.slice(3);
    return `+41 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  }
  return number;
}

// ─────────────────────────────────────────────────────────────
// Campaign Manager (Outbound Batch Calling)
// ─────────────────────────────────────────────────────────────

interface CampaignContact {
  name?: string;
  phone: string;
  language?: "de" | "de-CH" | "fr" | "it";
  customGoal?: string;
}

interface CampaignResult {
  campaignId: string;
  total: number;
  initiated: number;
  failed: number;
  results: { contact: CampaignContact; callSid?: string; error?: string }[];
}

/**
 * Run an outbound call campaign for a list of contacts.
 * Adds a delay between calls to avoid spam detection.
 */
export async function runCampaign(
  contacts: CampaignContact[],
  defaultGoal: string,
  delayMs = 5000
): Promise<CampaignResult> {
  const campaignId = uuidv4();
  const results: CampaignResult["results"] = [];
  let initiated = 0;
  let failed = 0;

  console.log(`[Telephony] Campaign ${campaignId} starting with ${contacts.length} contacts`);

  for (const contact of contacts) {
    try {
      const result = await initiateOutboundCall({
        to: contact.phone,
        customerName: contact.name,
        goal: contact.customGoal ?? defaultGoal,
        language: contact.language ?? "de-CH",
      });
      results.push({ contact, callSid: result.callSid });
      initiated++;
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      results.push({ contact, error });
      failed++;
      console.error(`[Telephony] Failed to call ${contact.phone}: ${error}`);
    }

    // Delay between calls
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[Telephony] Campaign ${campaignId} complete: ${initiated} initiated, ${failed} failed`);

  return {
    campaignId,
    total: contacts.length,
    initiated,
    failed,
    results,
  };
}
