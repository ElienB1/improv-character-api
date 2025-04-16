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
    prompt: `Respond ONLY in raw JSON using the keys: role, quirk1, quirk2. The role should be simple and recognizable for a young child (e.g., "clown", "pirate"). Do not use names or titles like "Mr. Wobblepants". Quirks should be very easy to act, like "hops on one foot" or "loves to sing". Do not add descriptive or fantastical words like "whimsical" or "intergalactic". Adjectives that reflect emotion or personality (like "sad", "grumpy") are fine. Example: {"role":"Clown","quirk1":"Juggles invisible balls","quirk2":"Laughs every 5 seconds"}`
  },
  2: {
    label: "Medium",
    prompt: `You are an API. Respond ONLY with raw JSON using the keys: role, quirk1, quirk2. The role should be playful and unique (like "roller skating baker" or "cloud photographer"). Do NOT use names or character titles. Do not add descriptive or fantastical words like "whimsical" or "intergalactic". Adjectives that reflect mood or personality (like "pessimistic") are fine. The quirks should be fun and imaginative (like "Only speaks in questions" or "Afraid of things starting with the letter D"). No explanation. No formatting. Example: {"role":"Cloud photographer","quirk1":"Carries a ladder everywhere","quirk2":"Names each cloud they see"}`
  },
  3: {
    label: "Hard",
    prompt: `Respond ONLY in raw JSON with keys: role, quirk1, quirk2. Do NOT include commentary, titles, or explanation. The role should be clever and ironic (e.g., "conspiracy radio host", "pessimistic mime"). Do not add descriptive or fantastical words like "whimsical" or "intergalactic". Mood or personality words like "grumpy" or "anxious" are allowed. The quirks should be psychological, like "asks overly personal questions" or "only eats foods that rhyme with their name". Example: {"role":"Conspiracy radio host","quirk1":"Whispers secrets to themselves","quirk2":"Believes pigeons are spies"}`
  },
  4: {
    label: "Very Hard",
    prompt: `Create a surreal and absurd improv character. The role should be highly specific and advanced, like "professor of magical arts" or "championship breakdancer". Do not use names or character titles. Do not add descriptive or fantastical words like "whimsical" or "intergalactic". Personality-based words like "pessimistic", "sad", or "grumpy" are okay. Quirks should be long, weird, and funny (e.g., "talks to food before eating it", "thinks they are fluent in Italian but they're not"). Respond ONLY in strict JSON format like {"role":"Chair therapist","quirk1":"Only speaks in metaphors","quirk2":"Keeps a live goldfish in one shoe"}`
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