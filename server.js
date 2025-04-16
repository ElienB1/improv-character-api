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
    prompt: `You are creating an improv character for a young child. Use clear, fun language. Only return JSON with keys: role, quirk1, quirk2. The role should be something simple like "clown" or "robot" (no names or long titles). Quirks should be physical or emotional and very easy to act out, like "loves to sing" or "hops on one foot". No explanations. Example output: {"role":"Pirate","quirk1":"Loves to sing sea shanties","quirk2":"Hops everywhere instead of walking"}`
  },
  2: {
    label: "Medium",
    prompt: `Create a fun improv character. The role should be a bit more specific, like "game show host" or "wildlife park operator". Quirks should be odd or unexpected but still actable, like "only speaks in questions" or "afraid of words that start with D". Return ONLY JSON with keys: role, quirk1, quirk2. Do not use names. No extra commentary. Example: {"role":"Roller skating baker","quirk1":"Invents frosting flavors","quirk2":"Is scared of sprinkles"}`
  },
  3: {
  label: "Hard",
  prompt: `Create a clever improv character. Respond ONLY in valid JSON with these keys: role, quirk1, quirk2. 
The role should be unique but not abstract — things like "game show host", "wildlife park manager", or "conspiracy radio host". 
Quirks should be weird or ironic, like "asks invasive personal questions" or "thinks their reflection is a twin". 
NO names. NO intro or explanation. Output just the JSON like: {"role":"Game show host","quirk1":"Whispers the answers","quirk2":"Refuses to clap"}.`
},
  4: {
    label: "Very Hard",
    prompt: `Create a surreal, absurd improv character. The role should be oddly specific, like "championship breakdancer" or "professor of magical arts". Quirks should be deeply strange or funny, like "talks to food before eating it" or "believes they’re fluent in Italian but they’re not". Output ONLY valid JSON with keys: role, quirk1, quirk2. No names or commentary. Example: {"role":"Chair therapist","quirk1":"Only speaks in metaphors","quirk2":"Keeps a goldfish in one shoe"}.`
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
