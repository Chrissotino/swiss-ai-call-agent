# 🇨🇭 Swiss AI Call Agent

> Enterprise-grade AI Call Agent for the Swiss market — inbound & outbound calls, multilingual (DE/FR/IT), MCP architecture, Claude AI decision engine, real-time dashboard.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Status](https://img.shields.io/badge/Status-In%20Development-blue)
![MCP](https://img.shields.io/badge/Architecture-MCP-purple)
![Claude AI](https://img.shields.io/badge/AI-Claude%20Anthropic-orange)

---

## 📋 Project Overview

The **Swiss AI Call Agent** is an enterprise-grade autonomous calling system built specifically for the Swiss market. It handles both inbound and outbound calls using AI, supports Swiss German dialects as well as French and Italian, and is fully compliant with Swiss data protection regulations (DSG/nDSG).

The system is powered by **MCP (Model Context Protocol)** as the orchestration layer and **Claude AI** as the intelligent decision engine — enabling real-time context-aware conversations, CRM lookups, escalation decisions, and automated follow-ups — all controllable via a modern web dashboard.

---

## ⚡ Key Capabilities

### Outbound Calls
- Appointment scheduling and reminders
- Customer follow-up campaigns
- Sales outreach with personalized scripts
- Payment reminders and dunning
- Survey and feedback collection

### Inbound Calls
- Intelligent customer support handling
- FAQ resolution without human intervention
- Automatic ticket creation in connected systems
- Smart escalation to human agents with full context handover
- IVR replacement with natural language understanding

### Core Intelligence
- Real-time decision making based on full conversation context
- CRM data lookup during active calls via MCP tools
- Automatic call summarization and task creation post-call
- Sentiment analysis and conversation scoring
- Confidence-based escalation thresholds

---

## 🇨🇭 Swiss Market Features

| Feature | Details |
|---|---|
| Languages | Swiss German (ZH/BE/BS dialects), Standard German, French, Italian, Romansh |
| Data Protection | Fully compliant with Swiss DSG/nDSG and GDPR-aligned |
| Local Integrations | Abacus, Bexio, Swiss telecom APIs (Swisscom, Sunrise, Salt) |
| Phone Formatting | Swiss number formats (+41), SIP routing support |
| Data Residency | Deployable on Swiss Azure regions or on-premise |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WEB DASHBOARD                            │
│         (React + TypeScript - Control Panel)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  COMMAND LAYER (API)                        │
│            Node.js + Express REST API                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│             MCP ORCHESTRATION LAYER                         │
│   ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│   │  Call Tools  │  │  CRM Tools  │  │  Calendar Tools  │  │
│   └──────────────┘  └─────────────┘  └──────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           DECISION ENGINE (Claude AI)                       │
│    Context Analysis → Decision → Action → Response          │
└──────────┬───────────────────────────────────┬──────────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────┐                 ┌─────────────────────┐
│   VOICE LAYER    │                 │   BACKEND SYSTEMS   │
│  STT: Whisper /  │                 │  CRM, ERP, Calendar │
│  Azure Speech    │                 │  Abacus, Bexio, M365│
│  TTS: ElevenLabs │                 └─────────────────────┘
│  / Azure Neural  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  TELEPHONY API   │
│  Twilio / SIP    │
│  Swisscom / Salt │
└──────────────────┘
```

---

## 🎛️ Dashboard Features

- **Live Call Monitor** — real-time transcription and call status
- **Campaign Manager** — create and manage outbound call lists with scheduling
- **Decision Tree Editor** — no-code editor for defining call flows and logic
- **Analytics & Reporting** — call success rates, sentiment scores, conversion tracking
- **Alert System** — instant notifications for escalations, failures, and anomalies
- **Agent Configuration** — manage personas, languages, scripts, and fallback behaviors
- **Integration Hub** — connect CRM, ERP, calendar, and ticketing systems

---

## 🧠 Decision Engine

Claude AI acts as the central brain of the system:

```
Conversation Input
       │
       ▼
┌─────────────────────────┐
│   Context Assembly      │  ← CRM data, history, call goal
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Claude AI Analysis    │  ← Intent detection, sentiment
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Decision Making       │  ← Continue / Escalate / End / Task
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Action Execution      │  ← MCP tool calls, CRM update, follow-up
└─────────────────────────┘
```

**Confidence Thresholds:**
- `>90%` → Fully autonomous action
- `70-90%` → Action with logging for review
- `<70%` → Escalate to human agent

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Orchestration | MCP (Model Context Protocol) |
| AI / LLM | Claude AI by Anthropic |
| Speech-to-Text | OpenAI Whisper / Azure Speech Services |
| Text-to-Speech | ElevenLabs / Azure Neural Voice |
| Telephony | Twilio / SIP / Plivo |
| Dashboard Frontend | React 18 + TypeScript + TailwindCSS |
| Backend API | Node.js + Express |
| Database | PostgreSQL + Redis |
| Infrastructure | Docker + Azure (Swiss region) |

---

## 👤 Human-in-the-Loop

- Human agents can take over any call at any moment with one click
- All AI decisions below confidence threshold are flagged for review
- Full audit log of every AI decision
- Shadow mode: AI listens and suggests, human executes

---

## 🔒 Compliance & Privacy

- Swiss DSG / nDSG compliant
- GDPR-aligned data handling
- Automatic call recording consent prompt
- Data residency in Switzerland (Azure Switzerland North)
- No data used for model training by default

---

## 🗺️ Roadmap

### Phase 1 — Inbound Foundation
- [ ] Basic inbound call handling with Claude AI
- [ ] Swiss German STT integration
- [ ] MCP server setup with CRM tools
- [ ] Simple dashboard with call logs

### Phase 2 — Outbound + Dashboard
- [ ] Outbound campaign manager
- [ ] Full dashboard with analytics
- [ ] Decision tree editor (no-code)
- [ ] Bexio / Abacus integration

### Phase 3 — Full Autonomy + Dialect Optimization
- [ ] Swiss dialect fine-tuning (Zürich, Bern, Basel)
- [ ] Multi-language per-call switching
- [ ] Advanced sentiment analysis
- [ ] On-premise deployment option

---

## 🚀 Getting Started

```bash
git clone https://github.com/Chrissotino/swiss-ai-call-agent.git
cd swiss-ai-call-agent
npm install
cp .env.example .env
npm run mcp:start
npm run api:start
npm run dashboard:start
```

---

## 📁 Project Structure

```
swiss-ai-call-agent/
├── mcp-server/           # MCP orchestration server
│   ├── tools/            # Call, CRM, Calendar MCP tools
│   └── index.ts
├── decision-engine/      # Claude AI integration
│   ├── prompts/          # System prompts per use case
│   └── engine.ts
├── voice-layer/          # STT/TTS integration
├── telephony/            # Twilio / SIP adapter
├── api/                  # Express REST API
├── dashboard/            # React frontend
├── integrations/         # Bexio, Abacus, M365 connectors
├── .env.example
└── docker-compose.yml
```

---

## 📄 License

MIT License

---

## 👤 Author

**Chris Sotino** — AI Architect
- LinkedIn: [linkedin.com/in/Chrissotino](https://linkedin.com/in/Chrissotino)
- GitHub: [@Chrissotino](https://github.com/Chrissotino)

---

*Built with ❤️ for the Swiss market — because AI should speak your language.*
