const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const stringSimilarity = require("string-similarity");
const { OpenAI } = require("openai");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// Basic in-memory IP rate-limiting
const rateLimit = new Map();

// Track the last generated character
let lastCharacter = {
  role: "",
  quirk1: "",
  quirk2: ""
};

// Fuzzy matching utility
function isTooSimilar(a, b) {
  if (!a || !b) return false;
  return stringSimilarity.compareTwoStrings(a.toLowerCase(), b.toLowerCase()) > 0.55;
}

// Extract the core noun from a role (last word)
function extractCoreNoun(role = "") {
  return role.trim().split(" ").pop().toLowerCase();
}

// Difficulty-level prompts (no whimsical/magical descriptors)
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
• Role: basic everyday noun only (e.g. baker, teacher). No adjectives.
• Quirks: short, realistic, max 5 words.
• Strictly ban fantasy/sci-fi words like whimsical, magical, cosmic, alien, enchanted, wizard, superhero.`
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
• Role: noun or noun with realistic modifier (e.g. tired plumber).
• Quirks: grounded and fun, ≤ 5 words.
• Ban magical, whimsical, cosmic, enchanted, sci-fi descriptors.`
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
• Role: one emotional adjective + noun (e.g. anxious barista).
• Quirks: ironic, specific, grounded. ≤ 6 words.
• No magical, whimsical, enchanted, sci-fi or fantasy terms.`
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
• Role: up to 2 emotional or existential adjectives + normal noun (e.g. melancholic accountant).
• Quirks: oddly specific, realistic. Each ≤ 6 words. No punctuation.
• Strict ban: whimsical, magical, cosmic, enchanted, alien, fantasy, sci-fi, wizard, superhero.`
  }
};

// API route
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
        temperature: 0.9,
        max_tokens: 300
      });

      const raw = completion.choices[0].message.content;
      const jsonTxt = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      character = JSON.parse(jsonTxt);

      const currentCombo = `${character.role} | ${character.quirk1} | ${character.quirk2}`;
      const lastCombo = `${lastCharacter.role} | ${lastCharacter.quirk1} | ${lastCharacter.quirk2}`;

      const currentNoun = extractCoreNoun(character.role);
      const lastNoun = extractCoreNoun(lastCharacter.role);

      const isSameNoun = currentNoun === lastNoun;
      const isFuzzyMatch = isTooSimilar(currentCombo, lastCombo);

      attempts++;

      if (!isSameNoun && !isFuzzyMatch) break;

    } while (attempts < maxAttempts);

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
    res.status(200).json({
      role: "Oops! Not improv‑ready 😅",
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
  console.log(`✅ API running on http://localhost:${port}`);
});