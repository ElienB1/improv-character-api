const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

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
Rules:
• Role: everyday noun (teacher, baker). NO adjectives.
• Ban whimsical, cosmic, magical, fantastical terms.`
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
Rules:
• Short noun or noun with practical modifier.
• Ban whimsical, cosmic, magical, fantastical terms.`
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
Rules:
• ONE emotional adjective (e.g. pessimistic chef).
• Ban whimsical, cosmic, magical, fantastical terms.`
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
Rules:
• One or two emotional adjectives before normal noun.
• Ban whimsical, cosmic, magical, fantastical terms.
• Quirks concise (≤6 words each), realistic.`
  }
};

const rateLimit = new Map();

// Persistent state outside endpoint
let lastCharacter = {
  role: "",
  quirk1: "",
  quirk2: ""
};

app.post("/generate", async (req, res) => {
  const { difficulty } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const now = Date.now();
  const last = rateLimit.get(ip) || 0;
  if (now - last < 5000) {
    return res.status(429).json({ error: "Too many requests. Please wait 5 seconds." });
  }
  rateLimit.set(ip, now);

  if (!difficultyPrompts[difficulty]) {
    return res.status(400).json({ error: "Invalid difficulty level" });
  }

  let attempts = 0;
  const maxAttempts = 5;
  let character;

  try {
    do {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: difficultyPrompts[difficulty].prompt }],
        temperature: 0.9, // slightly higher temp to avoid duplicates
        max_tokens: 300
      });

      const raw = completion.choices[0].message.content;
      const jsonTxt = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      character = JSON.parse(jsonTxt);

      attempts++;

      if (attempts >= maxAttempts) break;

    } while (
      character.role === lastCharacter.role ||
      character.quirk1 === lastCharacter.quirk1 ||
      character.quirk2 === lastCharacter.quirk2
    );

    lastCharacter = {
      role: character.role,
      quirk1: character.quirk1,
      quirk2: character.quirk2
    };

    res.json({
      role: character.role || "—",
      quirk1: character.quirk1 || "—",
      quirk2: character.quirk2 || "—",
      schema: character.schema || {}
    });

  } catch (err) {
    console.error("OpenAI / JSON parse error:", err);
    return res.status(200).json({
      role: "Oops! Not improv-ready 😅",
      quirk1: "This one came out a bit scrambled",
      quirk2: "Try clicking generate again!",
      schema: {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": "#character",
        "name": "Improviser",
        "description": "A confused character who couldn’t decide what to be."
      }
    });
  }
});

app.listen(port, () => {
  console.log(`✅ API running on port ${port}`);
});