import axios, { AxiosInstance } from "axios";
import dotenv from "dotenv";

dotenv.config();

// ─────────────────────────────────────────────────────────────
// Bexio CRM Integration
// Swiss SME ERP/CRM system
// Docs: https://docs.bexio.com/
// ─────────────────────────────────────────────────────────────

export interface BexioContact {
  id: number;
  name_1: string;        // Last name or company name
  name_2?: string;       // First name
  phone_fixed?: string;
  phone_mobile?: string;
  email?: string;
  language?: string;
  notes?: string;
}

export interface BexioNote {
  contact_id: number;
  text: string;
  is_important?: boolean;
}

export interface BexioCallLog {
  contact_id: number;
  subject: string;
  description: string;
  call_date: string;     // ISO datetime
  duration_seconds?: number;
  outcome: "completed" | "escalated" | "no_answer" | "busy";
}

// ─────────────────────────────────────────────────────────────
// Bexio API Client
// ─────────────────────────────────────────────────────────────

class BexioClient {
  private http: AxiosInstance;

  constructor() {
    const apiKey = process.env.BEXIO_API_KEY;
    const baseUrl = process.env.BEXIO_BASE_URL ?? "https://api.bexio.com/2.0";

    if (!apiKey) {
      console.warn("[Bexio] BEXIO_API_KEY not set — using mock mode");
    }

    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey ?? "mock"}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  // ── Contacts ──────────────────────────────────────────────

  /**
   * Search contacts by phone number or email.
   */
  async findContactByIdentifier(identifier: string): Promise<BexioContact | null> {
    try {
      const isEmail = identifier.includes("@");
      const field = isEmail ? "email" : "phone_fixed";

      const response = await this.http.post("/contact/search", [
        { field, value: identifier, criteria: "=" },
      ]);

      const contacts: BexioContact[] = response.data;
      if (!contacts || contacts.length === 0) {
        // Try mobile number
        if (!isEmail) {
          const mobileResponse = await this.http.post("/contact/search", [
            { field: "phone_mobile", value: identifier, criteria: "=" },
          ]);
          const mobileContacts: BexioContact[] = mobileResponse.data;
          return mobileContacts?.[0] ?? null;
        }
        return null;
      }

      return contacts[0];
    } catch (err) {
      console.error("[Bexio] Error searching contact:", err);
      return null;
    }
  }

  /**
   * Get contact by ID.
   */
  async getContact(contactId: number): Promise<BexioContact | null> {
    try {
      const response = await this.http.get(`/contact/${contactId}`);
      return response.data;
    } catch (err) {
      console.error(`[Bexio] Error fetching contact ${contactId}:`, err);
      return null;
    }
  }

  /**
   * Update contact notes after a call.
   */
  async updateContactNotes(contactId: number, note: string): Promise<void> {
    try {
      const contact = await this.getContact(contactId);
      const existingNotes = contact?.notes ?? "";
      const timestamp = new Date().toISOString().split("T")[0];
      const updatedNotes = `${existingNotes}\n[${timestamp}] ${note}`.trim();

      await this.http.patch(`/contact/${contactId}`, { notes: updatedNotes });
      console.log(`[Bexio] Updated notes for contact ${contactId}`);
    } catch (err) {
      console.error(`[Bexio] Error updating notes for contact ${contactId}:`, err);
    }
  }

  // ── Call Logs ─────────────────────────────────────────────

  /**
   * Log a completed call in Bexio as a note/activity.
   */
  async logCall(callLog: BexioCallLog): Promise<void> {
    try {
      const noteText = `📞 Call Log (${callLog.outcome})
Subject: ${callLog.subject}
Date: ${callLog.call_date}
Duration: ${callLog.duration_seconds ? Math.round(callLog.duration_seconds / 60) + " min" : "N/A"}

${callLog.description}`;

      await this.http.post("/note", {
        contact_id: callLog.contact_id,
        text: noteText,
        is_important: callLog.outcome === "escalated",
      });

      console.log(`[Bexio] Call logged for contact ${callLog.contact_id}`);
    } catch (err) {
      console.error("[Bexio] Error logging call:", err);
    }
  }

  // ── Projects / Tickets ─────────────────────────────────────

  /**
   * Create a project task for follow-up.
   */
  async createFollowUpTask(
    contactId: number,
    title: string,
    description: string,
    dueDate?: string
  ): Promise<void> {
    try {
      // Bexio uses "todos" or project tasks
      await this.http.post("/todo", {
        name: title,
        description,
        contact_id: contactId,
        due_at: dueDate ?? new Date(Date.now() + 86400000).toISOString().split("T")[0], // +1 day
        finished: false,
      });
      console.log(`[Bexio] Follow-up task created for contact ${contactId}`);
    } catch (err) {
      console.error("[Bexio] Error creating follow-up task:", err);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Exported singleton + convenience functions
// ─────────────────────────────────────────────────────────────

export const bexio = new BexioClient();

/**
 * Look up a customer in Bexio by phone or email.
 * Returns a simplified object usable by the MCP/Decision engine.
 */
export async function lookupCustomerInBexio(identifier: string): Promise<{
  found: boolean;
  name?: string;
  company?: string;
  language?: string;
  notes?: string;
  contactId?: number;
}> {
  const contact = await bexio.findContactByIdentifier(identifier);
  if (!contact) {
    return { found: false };
  }

  const fullName = [contact.name_2, contact.name_1].filter(Boolean).join(" ");

  return {
    found: true,
    name: fullName,
    company: contact.name_1,
    language: contact.language ?? "de-CH",
    notes: contact.notes,
    contactId: contact.id,
  };
}
