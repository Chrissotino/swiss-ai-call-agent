import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { makeDecision, shouldEscalate, CallContext } from "../decision-engine/engine.js";

// ─────────────────────────────────────────────────────────────
// MCP Server — Swiss AI Call Agent
// ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "swiss-ai-call-agent",
  version: "1.0.0",
});

// ─────────────────────────────────────────────────────────────
// Tool: analyse_call
// Analyse conversation and return next decision
// ─────────────────────────────────────────────────────────────

server.tool(
  "analyse_call",
  "Analyse an ongoing call and decide the next action",
  {
    callId: z.string().describe("Unique call identifier"),
    callType: z.enum(["inbound", "outbound"]).describe("Direction of the call"),
    goal: z.string().describe("The objective of this call"),
    customerName: z.string().optional().describe("Customer full name"),
    customerCompany: z.string().optional().describe("Customer company name"),
    language: z.enum(["de", "de-CH", "fr", "it"]).default("de-CH"),
    transcript: z
      .array(
        z.object({
          role: z.enum(["agent", "customer"]),
          text: z.string(),
        })
      )
      .describe("Conversation transcript so far"),
  },
  async ({ callId, callType, goal, customerName, customerCompany, language, transcript }) => {
    const context: CallContext = {
      callId,
      callType,
      goal,
      customerData: {
        name: customerName,
        company: customerCompany,
        language,
      },
      transcript,
    };

    const decision = await makeDecision(context);
    const escalate = shouldEscalate(decision);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            action: decision.action,
            confidence: decision.confidence,
            responseText: decision.responseText,
            reasoning: decision.reasoning,
            followUpTasks: decision.followUpTasks,
            requiresHumanHandover: escalate,
          }),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────
// Tool: get_customer_info
// Simulate a CRM lookup (replace with your real CRM adapter)
// ─────────────────────────────────────────────────────────────

server.tool(
  "get_customer_info",
  "Look up customer data from the CRM by phone number or email",
  {
    identifier: z.string().describe("Phone number (+41...) or email address"),
  },
  async ({ identifier }) => {
    // TODO: Replace with real CRM integration (Bexio, Abacus, Dynamics, etc.)
    const mockData = {
      found: true,
      name: "Max Mustermann",
      company: "Mustermann AG",
      language: "de-CH",
      openTickets: 1,
      lastContact: "2025-01-15",
      notes: "Prefers callback between 08:00 and 12:00",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(mockData) }],
    };
  }
);

// ─────────────────────────────────────────────────────────────
// Tool: create_ticket
// Create a support ticket after a call
// ─────────────────────────────────────────────────────────────

server.tool(
  "create_ticket",
  "Create a support ticket based on the call outcome",
  {
    callId: z.string(),
    summary: z.string().describe("Short summary of the issue"),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    assignTo: z.string().optional().describe("Team or agent to assign to"),
  },
  async ({ callId, summary, priority, assignTo }) => {
    // TODO: Replace with real ticketing system (Jira, ServiceNow, etc.)
    const ticket = {
      ticketId: `TKT-${Date.now()}`,
      callId,
      summary,
      priority,
      assignTo: assignTo ?? "first-level-support",
      createdAt: new Date().toISOString(),
      status: "open",
    };

    console.error(`[MCP] Ticket created: ${ticket.ticketId}`);

    return {
      content: [{ type: "text", text: JSON.stringify(ticket) }],
    };
  }
);

// ─────────────────────────────────────────────────────────────
// Tool: schedule_callback
// Schedule a callback appointment
// ─────────────────────────────────────────────────────────────

server.tool(
  "schedule_callback",
  "Schedule a callback for a customer",
  {
    customerName: z.string(),
    phoneNumber: z.string().describe("Swiss phone number (+41...)"),
    preferredTime: z.string().describe("ISO datetime string for preferred callback time"),
    notes: z.string().optional(),
  },
  async ({ customerName, phoneNumber, preferredTime, notes }) => {
    // TODO: Integrate with calendar (Google Calendar, Outlook via Graph API)
    const callback = {
      id: `CB-${Date.now()}`,
      customerName,
      phoneNumber,
      scheduledAt: preferredTime,
      notes: notes ?? "",
      status: "scheduled",
    };

    console.error(`[MCP] Callback scheduled: ${callback.id}`);

    return {
      content: [{ type: "text", text: JSON.stringify(callback) }],
    };
  }
);

// ─────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] Swiss AI Call Agent server running on stdio");
}

main().catch((err) => {
  console.error("[MCP] Fatal error:", err);
  process.exit(1);
});
