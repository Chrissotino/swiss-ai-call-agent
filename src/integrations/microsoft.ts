import axios, { AxiosInstance } from "axios";
import dotenv from "dotenv";

dotenv.config();

export interface MicrosoftContact {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  companyName?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  emailAddresses?: { address: string; name?: string }[];
}

class MicrosoftDynamicsClient {
  private http: AxiosInstance;

  constructor() {
    const token = process.env.MS_GRAPH_TOKEN;
    const baseUrl = process.env.MS_GRAPH_BASE_URL ?? "https://graph.microsoft.com/v1.0";

    if (!token) {
      console.warn("[Microsoft] MS_GRAPH_TOKEN not set — using mock mode");
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

  async findContactByIdentifier(identifier: string): Promise<MicrosoftContact | null> {
    try {
      const escapedIdentifier = identifier.replace(/'/g, "''");
      const isEmail = identifier.includes("@");
      const filter = isEmail
        ? `emailAddresses/any(e:e/address eq '${escapedIdentifier}')`
        : `mobilePhone eq '${escapedIdentifier}' or businessPhones/any(p:p eq '${escapedIdentifier}')`;

      const response = await this.http.get("/me/contacts", {
        params: {
          "$top": 1,
          "$filter": filter,
        },
      });

      const contacts = response.data?.value as MicrosoftContact[] | undefined;
      return contacts?.[0] ?? null;
    } catch (err) {
      console.error("[Microsoft] Error searching contact:", err);
      return null;
    }
  }
}

const microsoft = new MicrosoftDynamicsClient();

export async function lookupCustomerInMicrosoft(identifier: string): Promise<{
  found: boolean;
  name?: string;
  company?: string;
  language?: string;
  notes?: string;
  contactId?: string;
}> {
  const contact = await microsoft.findContactByIdentifier(identifier);
  if (!contact) {
    return { found: false };
  }

  return {
    found: true,
    name: contact.displayName || [contact.givenName, contact.surname].filter(Boolean).join(" "),
    company: contact.companyName,
    language: "de-CH",
    notes: "Contact loaded from Microsoft Graph contacts",
    contactId: contact.id,
  };
}
