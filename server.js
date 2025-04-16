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
    prompt: `You are an API. Respond ONLY in raw JSON using this schema: {\"role\": string, \"quirk1\": string, \"quirk2\": string}. The role should be simple and recognizable for a young child (e.g., \"clown\", \"pirate\"). Do not use names or titles like \"Mr. Wobblepants\". Quirks should be very easy to act, like \"hops on one foot\" or \"loves to sing\". Do not add descriptive or fantastical words like \"whimsical\" or \"intergalactic\". Adjectives that reflect emotion or personality (like \"sad\", \"grumpy\") are fine.`
  },
  2: {
    label: "Medium",
    prompt: `You are an API. Respond ONLY in raw JSON using this schema: {\"role\": string, \"quirk1\": string, \"quirk2\": string}. The role should be playful and unique (like \"roller skating baker\" or \"cloud photographer\"). Do NOT use names or character titles. The quirks should be fun and imaginative (like \"Only speaks in questions\" or \"Afraid of things starting with the letter D\"). Do not add descriptive or fantastical words like \"whimsical\" or \"intergalactic\". Mood or personality-based adjectives like \"pessimistic\" are fine.`
  },
  3: {
    label: "Hard",
    prompt: `You are an API. Respond ONLY in raw JSON using this schema: {\"role\": string, \"quirk1\": string, \"quirk2\": string}. The role should be clever and ironic (e.g., \"conspiracy radio host\"). Avoid names and descriptive or fantastical words like \"intergalactic\" or \"whimsical\". Mood-based adjectives like \"anxious\" or \"pessimistic\" are allowed. The quirks should be psychological, like \"asks overly personal questions\" or \"believes everyone is a clone\".`
  },
  4: {
    label: "Very Hard",
    prompt: `You are an API. Respond ONLY in raw JSON using this schema: {\"role\": string, \"quirk1\": string, \"quirk2\": string}. The role should be surreal or absurd (e.g., \"chair therapist\", \"time-traveling tea critic\"). Avoid names or overly descriptive fantasy words. Quirks should be long, unexpected, and weirdly specific (e.g., \"Talks to food before eating it\", \"Keeps a live goldfish in one shoe\").`
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
  const jsonStart = message.indexOf('{');
  const jsonEnd = message.lastIndexOf('}');
  const jsonText = message.slice(jsonStart, jsonEnd + 1).trim();

  character = JSON.parse(jsonText);
} catch (e) {
  console.warn("❌ Failed to parse JSON:\n", message);
  return res.status(200).json({
    role: "Oops! Not improv-ready 😅",
    quirk1: "This one came out a bit scrambled",
    quirk2: "Try clicking generate again!"
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