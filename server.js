import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// 🎭 Prompt library with refined difficulty tiers
const difficultyPrompts = {
  1: {
    label: "Very Easy",
    prompt: `Create a very simple improv character for a young child. Respond ONLY in valid JSON format with the keys: role, quirk1, quirk2.

RULES:
• The role should be a basic, playful character (e.g. "clown", "pirate", "robot").
• Quirks must describe physical actions or simple behaviors (e.g. "hops on one foot", "always sings when walking").
• ❌ Do NOT include names (e.g. "Mr. Wiggles") or titles (e.g. "Captain", "Dr.").
• ❌ No fantasy or scary roles. No personality descriptions.

Example:
{
  "role": "Robot",
  "quirk1": "Speaks in beep-boops",
  "quirk2": "Loves bubbles"
}`
  },

  2: {
    label: "Medium",
    prompt: `Create a quirky improv character with a real-world role and two unusual quirks. Respond ONLY in valid JSON format with the keys: role, quirk1, quirk2.

RULES:
• The role should be something plausible but fun (e.g. "ice cream truck driver", "librarian", "mail carrier").
• Quirks should be surprising or slightly irrational (e.g. "afraid of words that start with D", "only speaks in questions").
• ❌ No names or titles. Do NOT include "Mr.", "Dr.", "Captain", etc.
• ❌ No fantasy elements or superpowers.

Example:
{
  "role": "Librarian",
  "quirk1": "Hums the national anthem whenever nervous",
  "quirk2": "Is afraid of things that start with the letter D"
}`
  },

  3: {
    label: "Hard",
    prompt: `Create a clever improv character with a niche or oddly specific role, and two strange, socially quirky behaviors. Respond ONLY in valid JSON format with the keys: role, quirk1, quirk2.

RULES:
• The role must be grounded but unique (e.g. "wildlife park operator", "game show host", "convention planner").
• Quirks should be unusual fixations, anxieties, or habits (e.g. "collects used receipts", "asks people’s blood type when meeting them").
• ❌ No fantasy/sci-fi roles, no titles, and no character names.

Example:
{
  "role": "Game show host",
  "quirk1": "Keeps score in Roman numerals",
  "quirk2": "Obsessed with learning people’s middle names"
}`
  },

  4: {
    label: "Very Hard",
    prompt: `Create a surreal and absurd improv character with an extremely unusual role and two long, comedic quirks. Respond ONLY in valid JSON format with the keys: role, quirk1, quirk2.

RULES:
• The role should sound real but absurd or ironic (e.g. "trophy organizer", "professional whisper coach", "breakdance championship winner").
• Quirks must be complex, specific, and humorous (e.g. "talks to their food before eating it", "thinks they're fluent in Italian but clearly aren't").
• ❌ No names or titles (e.g. "Dr.", "Captain", "Mister", etc.).
• ❌ No fantasy/sci-fi roles or magical creatures.

Example:
{
  "role": "Trophy organizer",
  "quirk1": "Talks to their food before eating it",
  "quirk2": "Thinks they’re fluent in Italian, but clearly aren’t"
}`
  }
};

// 🧱 In-memory rate limiter
const rateLimit = new Map(); // IP -> timestamp

app.post("/generate", async (req, res) => {
  const { difficulty, cf_token } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // ⏱️ Rate limit: 1 request per 5 seconds
  const now = Date.now();
  const last = rateLimit.get(ip) || 0;
  if (now - last < 5000) {
    return res.status(429).json({ error: "Too many requests. Please wait 5 seconds." });
  }
  rateLimit.set(ip, now);

  // ✅ Validate difficulty
  if (!difficulty || !difficultyPrompts[difficulty]) {
    return res.status(400).json({ error: "Invalid difficulty" });
  }

  // ✅ Turnstile check
  if (process.env.CF_TURNSTILE_SECRET) {
    try {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: process.env.CF_TURNSTILE_SECRET,
          response: cf_token,
          remoteip: ip
        })
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        return res.status(403).json({ error: "Captcha failed" });
      }
    } catch (err) {
      console.error("Turnstile error:", err);
      return res.status(500).json({ error: "Captcha check failed" });
    }
  }

  // 🤖 Generate from OpenAI
  const prompt = difficultyPrompts[difficulty].prompt;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 200
    });

    const message = completion.choices[0].message.content;

    let character;
    try {
      character = JSON.parse(message);
    } catch {
      return res.status(200).json({
        role: "Error parsing response",
        quirk1: "AI did not return valid JSON",
        quirk2: "Try again or adjust the prompt"
      });
    }

    res.json({
      role: character.role || "—",
      quirk1: character.quirk1 || "—",
      quirk2: character.quirk2 || "—"
    });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
