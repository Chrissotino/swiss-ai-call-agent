import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CallContext {
  callId: string;
  callType: "inbound" | "outbound";
  customerData?: {
    name?: string;
    company?: string;
    language?: "de" | "de-CH" | "fr" | "it";
    history?: string[];
  };
  goal: string;
  transcript: { role: "agent" | "customer"; text: string }[];
}

export type DecisionAction =
  | "continue"
  | "escalate_to_human"
  | "end_call"
  | "create_ticket"
  | "schedule_callback"
  | "update_crm";

export interface Decision {
  action: DecisionAction;
  confidence: number; // 0–100
  responseText: string;
  reasoning: string;
  followUpTasks?: string[];
}

// ─────────────────────────────────────────────────────────────
// System prompt (Swiss market, multilingual)
// ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an intelligent AI call agent operating in the Swiss market.
You support Swiss German (and its dialects), Standard German, French, and Italian.

Your role:
- Analyse the ongoing conversation and customer context
- Decide on the best next action (continue, escalate, end call, create ticket, etc.)
- Generate a natural, professional response in the customer's language
- Always be polite, concise, and compliant with Swiss communication norms

Decision confidence thresholds:
- >90%  → Take action autonomously
- 70–90% → Take action but log for supervisor review
- <70%  → Escalate to a human agent with full context handover

Respond ONLY with valid JSON in this exact format:
{
  "action": "continue" | "escalate_to_human" | "end_call" | "create_ticket" | "schedule_callback" | "update_crm",
  "confidence": <0–100>,
  "responseText": "<what the agent should say to the customer>",
  "reasoning": "<internal reasoning, not spoken>",
  "followUpTasks": ["<optional task 1>", "<optional task 2>"]
}
`;

// ─────────────────────────────────────────────────────────────
// Core decision function
// ─────────────────────────────────────────────────────────────

export async function makeDecision(context: CallContext): Promise<Decision> {
  const userMessage = buildUserMessage(context);

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content[0];
  if (raw.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return parseDecision(raw.text);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function buildUserMessage(context: CallContext): string {
  const transcriptText = context.transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");

  return `
CALL CONTEXT
============
Call ID   : ${context.callId}
Type      : ${context.callType}
Goal      : ${context.goal}
Language  : ${context.customerData?.language ?? "de-CH"}
Customer  : ${context.customerData?.name ?? "Unknown"} (${context.customerData?.company ?? "N/A"})

TRANSCRIPT SO FAR
=================
${transcriptText}

Please analyse the conversation and provide your decision.
`;
}

function parseDecision(raw: string): Decision {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();

  const parsed = JSON.parse(cleaned);

  return {
    action: parsed.action,
    confidence: Number(parsed.confidence),
    responseText: parsed.responseText,
    reasoning: parsed.reasoning,
    followUpTasks: parsed.followUpTasks ?? [],
  };
}

// ─────────────────────────────────────────────────────────────
// Confidence-based routing
// ─────────────────────────────────────────────────────────────

export function shouldEscalate(decision: Decision): boolean {
  if (decision.action === "escalate_to_human") return true;
  if (decision.confidence < 70) return true;
  return false;
}

export function requiresReview(decision: Decision): boolean {
  return decision.confidence >= 70 && decision.confidence < 90;
}
