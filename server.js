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

// 🎯 Prompts by difficulty
const difficultyPrompts = {
  1: {
    label: "Very Easy",
    prompt: `Create a very easy character for a young child to improv. Use simple words. Roles should be fun and recognizable like "clown" or "pirate". No names. Quirks should be easy to act like "loves to sing" or "hops on one foot". Respond ONLY in JSON with keys: role, quirk1, quirk2. Avoid repeating roles. Example: {"role":"Robot","quirk1":"Speaks in beep boops","quirk2":"Loves bubbles"}`
  },
    2: {
    label: "Medium",
    prompt: `You are an API. Respond ONLY in raw JSON format with keys: role, quirk1, quirk2. Do NOT add any explanation. The role should be quirky but simple (like "roller skating baker"). Quirks should be imaginative but readable (like "Only speaks in questions"). No names or titles. Output format: {"role":"example","quirk1":"example","quirk2":"example"}`
  },
  3: {
    label: "Hard",
    prompt: `Respond ONLY in raw JSON with keys: role, quirk1, quirk2. Do NOT include commentary, titles, or explanation. The role should be clever and ironic (e.g., "conspiracy radio host"). The quirks should be psychological, like "asks overly personal questions". No names. Output format: {"role":"example","quirk1":"example","quirk2":"example"}`
  },
  4: {
    label: "Very Hard",
    prompt: `Create a surreal and absurd improv character. The role should be highly specific and advanced, like "professor of magical arts" or "championship breakdancer". Quirks should be long, unexpected, and funny—such as "Talks to food before eating it" or "Thinks they are fluent in Italian but they're not". Return ONLY strict JSON with the keys: role, quirk1, quirk2. Do NOT use character names or provide extra explanation. Example: {"role":"Chair therapist","quirk1":"Only speaks in metaphors","quirk2":"Keeps a live goldfish in one shoe"}`
  }
};

// 🛡️ In-memory rate limiter
const rateLimit = new Map(); // IP -> last request timestamp

app.post("/generate", async (req, res) => {
  const { difficulty, cf_token } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // ⏱️ Basic IP rate limiting
  const now = Date.now();
  const last = rateLimit.get(ip) || 0;
  if (now - last < 5000) {
    return res.status(429).json({ error: "Too many requests. Please wait 5 seconds." });
  }
  rateLimit.set(ip, now);

  // ✅ Validate difficulty input
  if (!difficulty || !difficultyPrompts[difficulty]) {
    return res.status(400).json({ error: "Invalid difficulty level" });
  }

  // ✅ Turnstile CAPTCHA check (optional)
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
      console.error("Captcha error:", err);
      return res.status(500).json({ error: "Captcha check failed" });
    }
  }

  const prompt = difficultyPrompts[difficulty].prompt;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
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
