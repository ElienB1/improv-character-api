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

// IP-based rate limiter
const rateLimit = new Map();

// Store last generated result
let lastCharacter = {
  role: "",
  quirk1: "",
  quirk2: ""
};

// Fuzzy match logic
function isTooSimilar(a, b) {
  if (!a || !b) return false;
  return stringSimilarity.compareTwoStrings(a.toLowerCase(), b.toLowerCase()) > 0.55;
}

// Extract base noun (e.g. 'librarian' from 'quiet librarian')
function extractCoreNoun(role = "") {
  return role.trim().split(" ").pop().toLowerCase();
}

// Prompts for each difficulty level
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
• Role must be a plain everyday noun (e.g. baker, teacher, plumber). No adjectives or modifiers.
• Quirks should be realistic and simple (e.g. "collects pebbles", "hums while walking").
• Emotional or personality words like "anxious", "moody" must go in quirks, NOT the role.
• Absolutely forbid whimsical, magical, cosmic, fantasy, sci-fi, superhero, enchanted words.`
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
• Role = 1 grounded noun, no descriptors. (e.g. "mechanic", not "sleepy mechanic").
• Quirks can include emotional or odd traits.
• Quirks must be grounded and short (≤ 5 words).
• No fantasy or sci-fi words in any field.`
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
• Role = only a noun. No adjectives (e.g. just "janitor", not "nervous janitor").
• Quirks can be ironic, anxious, obsessive, weird, etc. Max 6 words.
• Personality/emotional traits go in quirks only.
• Do not use whimsical, cosmic, magical, or fantasy-like language.`
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
• Role = single grounded noun, NO adjectives. No emotional or descriptive prefixes.
• Quirks: oddly specific, psychological, ironic, or uncomfortable. Max 6 words each.
• Quirks can include emotional traits (e.g. "obsessed with order", "cries at small talk").
• Ban all fantasy, sci-fi, whimsical, enchanted, superhero, and magical words.`
  }
};

// Character generation endpoint
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

      const isSameCoreNoun = currentNoun === lastNoun;
      const isFuzzyMatch = isTooSimilar(currentCombo, lastCombo);

      attempts++;

      if (!isSameCoreNoun && !isFuzzyMatch) break;

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
    console.error("OpenAI error or JSON parse failure:", err);
    res.status(200).json({
      role: "Oops! Not improv‑ready 😅",
      quirk1: "This one came out a bit scrambled",
      quirk2: "Try clicking generate again!",
      schema: {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": "#character",
        name: "Improviser",
        description: "A confused character who couldn’t decide what to be."
      }
    });
  }
});

// Start the server (required for Render)
app.listen(port, () => {
  console.log(`✅ API running on http://localhost:${port}`);
});