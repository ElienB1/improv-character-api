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

const difficultyPrompts = {
  1: {
    label: "Very Easy",
    prompt: `Create a very easy character for a young child to act out in an improv game. The role should be simple (like "clown", "mermaid", "robot", "pirate") and should NOT include names like "Mr. Wobblepants". Use clear, fun language. Avoid complex jobs or fancy words. Respond ONLY in JSON format with keys: role, quirk1, quirk2. Example: {"role":"Robot","quirk1":"Speaks in beep boops","quirk2":"Loves bubbles"}`
  },
  2: {
    label: "Medium",
    prompt: `Create a fun and quirky improv character. Use a more specific or unusual role (like "roller skating baker", "cloud photographer", "birthday clown"). The quirks can be strange, like "only speaks in questions" or "is afraid of things that start with the letter D". Do NOT use character names. Respond ONLY in JSON with role, quirk1, quirk2. Example: {"role":"Roller skating baker","quirk1":"Invents frosting flavors","quirk2":"Is scared of sprinkles"}`
  },
  3: {
    label: "Hard",
    prompt: `Create a more complex improv character. The role should be slightly advanced or ironic (e.g., "game show host", "wildlife park operator", "competitive whisperer"). The quirks should be clever or abstract, like "obsessed with knowing personal facts about everyone" or "only eats food that rhymes with their name". Avoid repeating the same role immediately. Respond ONLY in JSON format with keys: role, quirk1, quirk2.`
  },
  4: {
    label: "Very Hard",
    prompt: `Create an absurd improv character. The role should be unusual or niche (like "breakdance champion", "professor of magical arts", "zookeeper of imaginary creatures"). The quirks should be funny, ironic or bizarre — like "thinks they're fluent in Italian but absolutely are not" or "speaks to their food before eating it". Avoid character names and space-related ideas. Respond ONLY in JSON format with keys: role, quirk1, quirk2.`
  }
};

const rateLimit = new Map();

app.post("/generate", async (req, res) => {
  const { difficulty, cf_token } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const now = Date.now();
  const last = rateLimit.get(ip) || 0;
  if (now - last < 5000) {
    return res.status(429).json({ error: "Too many requests. Please wait 5 seconds." });
  }
  rateLimit.set(ip, now);

  if (!difficulty || !difficultyPrompts[difficulty]) {
    return res.status(400).json({ error: "Invalid difficulty" });
  }

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
