import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type SupportedLanguage = "de" | "de-CH" | "fr" | "it";

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence?: number;
  durationMs?: number;
}

export interface TTSOptions {
  language: SupportedLanguage;
  voiceId?: string;
  speed?: number;
  pitch?: number;
}

// ─────────────────────────────────────────────────────────────
// Language → Voice ID mappings (ElevenLabs)
// ─────────────────────────────────────────────────────────────

const ELEVENLABS_VOICE_MAP: Record<SupportedLanguage, string> = {
  "de-CH": process.env.ELEVENLABS_VOICE_ID_DE ?? "21m00Tcm4TlvDq8ikWAM",
  de: process.env.ELEVENLABS_VOICE_ID_DE ?? "21m00Tcm4TlvDq8ikWAM",
  fr: process.env.ELEVENLABS_VOICE_ID_FR ?? "AZnzlk1XvdvUeBnXmlld",
  it: process.env.ELEVENLABS_VOICE_ID_IT ?? "EXAVITQu4vr4xnSDxMaL",
};

// ─────────────────────────────────────────────────────────────
// STT: Speech-to-Text
// ─────────────────────────────────────────────────────────────

/**
 * Transcribe audio using OpenAI Whisper API.
 * Pass an audio buffer (e.g., from Twilio recording) and get text back.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  language?: SupportedLanguage
): Promise<TranscriptionResult> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("file", audioBuffer, { filename: "audio.wav", contentType: "audio/wav" });
  form.append("model", "whisper-1");
  if (language) {
    // Map de-CH to de for Whisper (it understands Swiss German)
    form.append("language", language === "de-CH" ? "de" : language);
  }
  form.append("response_format", "verbose_json");

  const startTime = Date.now();
  const response = await axios.post(
    "https://api.openai.com/v1/audio/transcriptions",
    form,
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        ...form.getHeaders(),
      },
    }
  );

  const durationMs = Date.now() - startTime;

  return {
    text: response.data.text,
    language: response.data.language ?? (language ?? "de"),
    confidence: undefined, // Whisper doesn't expose per-utterance confidence
    durationMs,
  };
}

/**
 * Transcribe audio from a public URL (e.g., Twilio RecordingUrl).
 */
export async function transcribeFromUrl(
  audioUrl: string,
  language?: SupportedLanguage
): Promise<TranscriptionResult> {
  // Download the audio file first
  const response = await axios.get(audioUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);
  return transcribeAudio(buffer, language);
}

// ─────────────────────────────────────────────────────────────
// TTS: Text-to-Speech
// ─────────────────────────────────────────────────────────────

/**
 * Synthesize speech using ElevenLabs API.
 * Returns an audio buffer (MP3) that can be streamed to the caller.
 */
export async function synthesizeSpeech(
  text: string,
  options: TTSOptions
): Promise<Buffer> {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const voiceId = options.voiceId ?? ELEVENLABS_VOICE_MAP[options.language];

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        speed: options.speed ?? 1.0,
      },
    },
    {
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      responseType: "arraybuffer",
    }
  );

  return Buffer.from(response.data);
}

/**
 * Get a TwiML-compatible audio URL for the given text.
 * Uses ElevenLabs and returns base64-encoded audio for inline use,
 * or uploads to a CDN and returns the URL (TODO in production).
 */
export async function textToTwimlSay(
  text: string,
  language: SupportedLanguage
): Promise<string> {
  // For demo purposes, return the text with TwiML Say tag
  // In production: synthesize with ElevenLabs and host the MP3 file
  const langMap: Record<SupportedLanguage, string> = {
    "de-CH": "de-CH",
    de: "de-DE",
    fr: "fr-FR",
    it: "it-IT",
  };
  return `<Say language="${langMap[language]}">${text}</Say>`;
}

// ─────────────────────────────────────────────────────────────
// Utility: Detect language from text (simple heuristic)
// ─────────────────────────────────────────────────────────────

export function detectLanguage(text: string): SupportedLanguage {
  const lower = text.toLowerCase();

  // Very simple keyword detection — replace with a proper library in production
  const frenchKeywords = ["bonjour", "merci", "s'il vous plaît", "comment", "je", "vous"];
  const italianKeywords = ["ciao", "grazie", "prego", "come", "io", "lei"];

  const frScore = frenchKeywords.filter((w) => lower.includes(w)).length;
  const itScore = italianKeywords.filter((w) => lower.includes(w)).length;

  if (frScore > itScore && frScore > 0) return "fr";
  if (itScore > frScore && itScore > 0) return "it";
  return "de-CH"; // Default to Swiss German
}
