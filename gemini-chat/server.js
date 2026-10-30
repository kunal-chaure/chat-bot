import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Config (all overridable with environment variables) ----------
const {
  GEMINI_API_KEY,
  GEMINI_MODEL = "gemini-3.8-flash",
  THINKING_LEVEL = "low", // low | medium | high  (3.8 Flash does not support "minimal")
  SYSTEM_PROMPT = "You are a friendly, concise assistant. Use Markdown for formatting. Put code in fenced code blocks with a language tag.",
  PORT = 3000,
} = process.env;

const MAX_MESSAGE_CHARS = 4000;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY. Add it to .env (local) or Render's Environment tab (production).");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ---------- App ----------
const app = express();

// Render sits behind a proxy; this makes req.ip (and rate limiting) use the real client IP.
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Health check used by Render
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Protect your API quota from abuse: 20 chat requests per minute per IP.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many messages. Please wait a minute and try again." },
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const previousId =
    typeof req.body?.previousInteractionId === "string" && req.body.previousInteractionId.length <= 300
      ? req.body.previousInteractionId
      : null;

  if (!message) return res.status(400).json({ error: "Please type a message." });
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_CHARS} characters).` });
  }

  try {
    const interaction = await ai.interactions.create(
      {
        model: GEMINI_MODEL,
        input: message,
        system_instruction: SYSTEM_PROMPT,
        generation_config: { thinking_level: THINKING_LEVEL },
        // Server-side conversation memory: Google keeps the history, we only pass the last id.
        ...(previousId ? { previous_interaction_id: previousId } : {}),
      },
      { timeout: 60_000 }
    );

    const reply = interaction.output_text?.trim();
    if (!reply) {
      return res.status(502).json({ error: "The model returned an empty response. Try rephrasing your message." });
    }

    return res.json({ reply, interactionId: interaction.id });
  } catch (err) {
    const status = err?.status ?? err?.code;
    console.error("Gemini error:", status, err?.message);

    if (status === 429) {
      return res.status(429).json({ error: "The AI service is busy or the quota is used up. Try again in a minute." });
    }
    if (previousId && (status === 400 || status === 404)) {
      return res.status(409).json({
        code: "CONVERSATION_EXPIRED",
        error: "This conversation has expired. Your next message will start a new one.",
      });
    }
    if (status === 401 || status === 403) {
      return res.status(500).json({ error: "The server is not configured correctly. Please try again later." });
    }
    return res.status(500).json({ error: "Something went wrong while contacting the AI. Please try again." });
  }
});

// Bad JSON etc.
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") {
    return res.status(400).json({ error: "Invalid request." });
  }
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Chat server running on port ${PORT} using model "${GEMINI_MODEL}"`);
});
