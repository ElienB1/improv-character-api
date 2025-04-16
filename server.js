const express = require("express");
const cors    = require("cors");
const dotenv  = require("dotenv");
const fetch   = require("node-fetch");   // remove this line if you drop node‑fetch
const { OpenAI } = require("openai");

dotenv.config();

const app  = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// ---------------- Prompts by difficulty (unchanged, full schema included)
const difficultyPrompts = {
  1: {
    label: "Very Easy",
    prompt: `You are an API. Respond ONLY in raw JSON using this exact schema:
{
  "role": string,
  "quirk1": string,
  "quirk2": string,
  "schema": {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "#character",
    "name": string,
    "description": string
  }
}
Use simple, recognizable roles and quirks for young children. Do not include names, titles, or fantastical words.`
  },
  2: {
    label: "Medium",
    prompt: `You are an API. Respond ONLY in raw JSON using this exact schema:
{
  "role": string,
  "quirk1": string,
  "quirk2": string,
  "schema": {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "#character",
    "name": string,
    "description": string
  }
}
Role should be playful and unique. Quirks should be imaginative and fun. No names or character titles.`
  },
  3: {
    label: "Hard",
    prompt: `You are an API. Respond ONLY in raw JSON using this exact schema:
{
  "role": string,
  "quirk1": string,
  "quirk2": string,
  "schema": {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "#character",
    "name": string,
    "description": string
  }
}
Roles should be clever or ironic. Quirks can be psychological. Avoid fantasy words and character names.`
  },
  4: {
    label: "Very Hard",
    prompt: `You are an API. Respond ONLY in raw JSON using this exact schema:
{
  "role": string,
  "quirk1": string,
  "quirk2": string,
  "schema": {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "#character",
    "name": string,
    "description": string
  }
}
Roles should be surreal or absurd. Quirks should be long, weird, and oddly specific.`
  }
};

// ---------------- 5‑second in‑memory rate‑limit
const rateLimit = new Map();

// ---------------- /generate endpoint
app.post("/generate", async (req, res) => {
  const { difficulty } = req.body;
  const ip   = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const now  = Date.now();
  const last = rateLimit.get(ip) || 0;

  if (now - last < 5000) {
    return res.status(429).json({ error: "Too many requests. Please wait 5 seconds." });
  }
  rateLimit.set(ip, now);

  if (!difficultyPrompts[difficulty]) {
    return res.status(400).json({ error: "Invalid difficulty level" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model:       "gpt-4o",
      messages:    [{ role: "user", content: difficultyPrompts[difficulty].prompt }],
      temperature: 0.7,
      max_tokens:  300
    });

    const raw     = completion.choices[0].message.content;
    const jsonTxt = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const char    = JSON.parse(jsonTxt);

    return res.json({
      role:   char.role   || "—",
      quirk1: char.quirk1 || "—",
      quirk2: char.quirk2 || "—",
      schema: char.schema || {}
    });
  } catch (err) {
    console.error("OpenAI / JSON parse error:", err);
    return res.status(200).json({
      role:   "Oops! Not improv‑ready 😅",
      quirk1: "This one came out a bit scrambled",
      quirk2: "Try clicking generate again!",
      schema: {
        "@context": "https://schema.org",
        "@type":    "Person",
        "@id":      "#character",
        "name":     "Improviser",
        "description": "A confused character who couldn’t decide what to be."
      }
    });
  }
});

// ---------------- start server
app.listen(port, () => {
  console.log(`✅  API running on http://localhost:${port}`);
});