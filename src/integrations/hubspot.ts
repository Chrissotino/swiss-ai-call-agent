import axios, { AxiosInstance } from "axios";
import dotenv from "dotenv";

dotenv.config();

interface HubspotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    company?: string;
    email?: string;
    phone?: string;
    hs_language?: string;
    notes_last_contacted?: string;
  };
}

class HubspotClient {
  private http: AxiosInstance;

  constructor() {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    const baseUrl = process.env.HUBSPOT_BASE_URL ?? "https://api.hubapi.com";

    if (!token) {
      console.warn("[HubSpot] HUBSPOT_ACCESS_TOKEN not set — using mock mode");
    }

    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${token ?? "mock"}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  async findContactByIdentifier(identifier: string): Promise<HubspotContact | null> {
    try {
      const propertyName = identifier.includes("@") ? "email" : "phone";

      const response = await this.http.post("/crm/v3/objects/contacts/search", {
        filterGroups: [
          {
            filters: [
              {
                propertyName,
                operator: "EQ",
                value: identifier,
              },
            ],
          },
        ],
        limit: 1,
        properties: ["firstname", "lastname", "company", "email", "phone", "hs_language", "notes_last_contacted"],
      });

      const contacts = response.data?.results as HubspotContact[] | undefined;
      return contacts?.[0] ?? null;
    } catch (err) {
      console.error("[HubSpot] Error searching contact:", err);
      return null;
    }
  }
}

const hubspot = new HubspotClient();

export async function lookupCustomerInHubspot(identifier: string): Promise<{
  found: boolean;
  name?: string;
  company?: string;
  language?: string;
  notes?: string;
  contactId?: string;
}> {
  const contact = await hubspot.findContactByIdentifier(identifier);
  if (!contact) {
    return { found: false };
  }

  const name = [contact.properties.firstname, contact.properties.lastname].filter(Boolean).join(" ");

  return {
    found: true,
    name,
    company: contact.properties.company,
    language: contact.properties.hs_language ?? "de-CH",
    notes: contact.properties.notes_last_contacted,
    contactId: contact.id,
  };
}
