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
    prompt: `Create a very simple improv character for a young child. Use plain, easy-to-understand words. Respond ONLY in strict JSON format with the keys: role, quirk1, quirk2.

• The role should be a basic character (like “clown”, “robot”, “pirate”, “chef” — no names or complex jobs).
• Quirks should describe fun, physical things they do (like “loves to sing”, “hops on one foot”, “always pretends to fly”).
• Do NOT include names, titles, or advanced professions.
• Avoid silly made-up words, personality traits, or anything scary.

Example: {"role":"Clown","quirk1":"Loves to sing really loud","quirk2":"Always hops on one foot"}`
  },
  2: {
    label: "Medium",
    prompt: `Create a fun improv character with a quirky role and two imaginative quirks. Respond ONLY in strict JSON format with the keys: role, quirk1, quirk2.

• The role can be playful or weird but real-world understandable (e.g. "zookeeper", "ice cream truck driver", "mail carrier").
• The quirks should be unexpected, slightly illogical, or sensory-based (e.g. "afraid of things starting with the letter D", or "only speaks in questions").
• No names or made-up characters. Avoid rhyming names or overused clichés.

Example: {"role":"Zookeeper","quirk1":"Always wears sunglasses indoors","quirk2":"Only speaks in questions"}`
  },
  3: {
    label: "Hard",
    prompt: `Create a creative improv character with an unusual or oddly specific job and two strange, clever quirks. Respond ONLY in strict JSON format with the keys: role, quirk1, quirk2.

• The role should be real or believable but unique — something like “game show host”, “wildlife park operator”, or “convention planner”.
• The quirks should reveal deeper oddities or fixations, like "obsessed with everyone's personal details" or "writes everything backwards first".
• Avoid magical or fantasy elements here — keep it rooted in the real world but offbeat.

Example: {"role":"Game show host","quirk1":"Keeps score in roman numerals","quirk2":"Asks everyone for their star sign before speaking"}`
  },
  4: {
    label: "Very Hard",
    prompt: `Create a complex and surreal improv character with a strange or ironic role and two long, detailed quirks. Respond ONLY in strict JSON format with the keys: role, quirk1, quirk2.

• The role can be exaggerated, absurd, or oddly specific (e.g. “professor of magical arts”, “breakdance championship winner”, “trophy organizer”).
• The quirks should be long, weird, or layered — like "thinks they're fluent in Italian but they're absolutely not", or "talks to their food before eating it".
• Be humorous, surprising, and avoid repeating simple traits like “scared of heights”.

Example: {"role":"Breakdance championship winner","quirk1":"Greets everyone with an interpretive dance move","quirk2":"Talks to their food before eating it"}`
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
