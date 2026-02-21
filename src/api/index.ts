import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { makeDecision, shouldEscalate, requiresReview, CallContext } from "../decision-engine/engine.js";

dotenv.config();

const app = express();
const PORT = process.env.API_PORT ?? 3001;

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─────────────────────────────────────────────────────────────
// In-memory call registry (replace with DB in production)
// ─────────────────────────────────────────────────────────────

interface CallRecord {
  callId: string;
  callType: "inbound" | "outbound";
  status: "active" | "completed" | "escalated" | "failed";
  goal: string;
  customerName?: string;
  customerPhone?: string;
  language: "de" | "de-CH" | "fr" | "it";
  transcript: { role: "agent" | "customer"; text: string; timestamp: string }[];
  startedAt: string;
  endedAt?: string;
  lastDecision?: object;
}

const activeCalls = new Map<string, CallRecord>();

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "swiss-ai-call-agent-api", timestamp: new Date().toISOString() });
});

// ── Calls ────────────────────────────────────────────────────

// Start a new outbound call session
app.post("/calls/start", async (req: Request, res: Response) => {
  try {
    const { callType, goal, customerName, customerPhone, language } = req.body;

    if (!goal) {
      return res.status(400).json({ error: "goal is required" });
    }

    const callId = uuidv4();
    const call: CallRecord = {
      callId,
      callType: callType ?? "outbound",
      status: "active",
      goal,
      customerName,
      customerPhone,
      language: language ?? "de-CH",
      transcript: [],
      startedAt: new Date().toISOString(),
    };

    activeCalls.set(callId, call);

    console.log(`[API] Call started: ${callId}`);
    return res.status(201).json({ callId, status: "active" });
  } catch (err) {
    console.error("[API] Error starting call:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Process a new utterance and get AI decision
app.post("/calls/:callId/utterance", async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { role, text } = req.body;

    const call = activeCalls.get(callId);
    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }

    // Add to transcript
    call.transcript.push({ role, text, timestamp: new Date().toISOString() });

    // Build context for decision engine
    const context: CallContext = {
      callId: call.callId,
      callType: call.callType,
      goal: call.goal,
      customerData: {
        name: call.customerName,
        language: call.language,
      },
      transcript: call.transcript.map(({ role, text }) => ({ role, text })),
    };

    // Get AI decision
    const decision = await makeDecision(context);
    const escalate = shouldEscalate(decision);
    const review = requiresReview(decision);

    call.lastDecision = decision;

    // Handle terminal actions
    if (decision.action === "end_call" || escalate) {
      call.status = escalate ? "escalated" : "completed";
      call.endedAt = new Date().toISOString();
    }

    activeCalls.set(callId, call);

    return res.json({
      callId,
      decision: {
        action: decision.action,
        confidence: decision.confidence,
        responseText: decision.responseText,
        reasoning: decision.reasoning,
        followUpTasks: decision.followUpTasks,
      },
      requiresHumanHandover: escalate,
      requiresSupervisorReview: review,
      callStatus: call.status,
    });
  } catch (err) {
    console.error("[API] Error processing utterance:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get call details
app.get("/calls/:callId", (req: Request, res: Response) => {
  const { callId } = req.params;
  const call = activeCalls.get(callId);
  if (!call) {
    return res.status(404).json({ error: "Call not found" });
  }
  return res.json(call);
});

// End a call
app.post("/calls/:callId/end", (req: Request, res: Response) => {
  const { callId } = req.params;
  const call = activeCalls.get(callId);
  if (!call) {
    return res.status(404).json({ error: "Call not found" });
  }

  call.status = "completed";
  call.endedAt = new Date().toISOString();
  activeCalls.set(callId, call);

  console.log(`[API] Call ended: ${callId}`);
  return res.json({ callId, status: "completed", endedAt: call.endedAt });
});

// List all active calls (dashboard)
app.get("/calls", (_req: Request, res: Response) => {
  const calls = Array.from(activeCalls.values()).map(({ callId, callType, status, customerName, language, startedAt }) => ({
    callId,
    callType,
    status,
    customerName,
    language,
    startedAt,
  }));
  return res.json({ calls, total: calls.length });
});

// ── Twilio Webhook ────────────────────────────────────────────

// Inbound call webhook from Twilio
app.post("/webhooks/twilio/inbound", async (req: Request, res: Response) => {
  const { CallSid, From, To } = req.body;

  const callId = CallSid ?? uuidv4();
  const call: CallRecord = {
    callId,
    callType: "inbound",
    status: "active",
    goal: "Handle inbound customer inquiry",
    customerPhone: From,
    language: "de-CH",
    transcript: [],
    startedAt: new Date().toISOString(),
  };

  activeCalls.set(callId, call);
  console.log(`[API] Inbound call from ${From} to ${To}, callId: ${callId}`);

  // Return TwiML to answer the call
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-CH">Guten Tag, willkommen beim Swiss AI Call Agent. Wie kann ich Ihnen helfen?</Say>
  <Gather input="speech" action="/webhooks/twilio/speech" speechTimeout="3" language="de-CH">
  </Gather>
</Response>`;

  res.set("Content-Type", "text/xml");
  return res.send(twiml);
});

// Process speech input from Twilio
app.post("/webhooks/twilio/speech", async (req: Request, res: Response) => {
  const { CallSid, SpeechResult } = req.body;
  const call = activeCalls.get(CallSid);

  if (!call || !SpeechResult) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-CH">Entschuldigung, ich habe Sie nicht verstanden. Bitte rufen Sie uns erneut an.</Say>
  <Hangup/>
</Response>`;
    res.set("Content-Type", "text/xml");
    return res.send(twiml);
  }

  // Add customer utterance
  call.transcript.push({ role: "customer", text: SpeechResult, timestamp: new Date().toISOString() });

  // Get AI decision
  const context: CallContext = {
    callId: call.callId,
    callType: "inbound",
    goal: call.goal,
    customerData: { language: call.language },
    transcript: call.transcript.map(({ role, text }) => ({ role, text })),
  };

  const decision = await makeDecision(context);
  const escalate = shouldEscalate(decision);

  call.transcript.push({ role: "agent", text: decision.responseText, timestamp: new Date().toISOString() });

  let twiml: string;
  if (escalate || decision.action === "end_call") {
    call.status = escalate ? "escalated" : "completed";
    call.endedAt = new Date().toISOString();
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-CH">${decision.responseText}</Say>
  <Hangup/>
</Response>`;
  } else {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-CH">${decision.responseText}</Say>
  <Gather input="speech" action="/webhooks/twilio/speech" speechTimeout="3" language="de-CH">
  </Gather>
</Response>`;
  }

  activeCalls.set(call.callId, call);
  res.set("Content-Type", "text/xml");
  return res.send(twiml);
});

// ─────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[API] Swiss AI Call Agent API running on port ${PORT}`);
});

export default app;
