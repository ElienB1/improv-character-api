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
• Role: one plain everyday noun (e.g. baker, teacher, plumber). No adjectives.
• Quirks: short, grounded, simple. Max 5 words.
• Ban all fantasy/sci-fi words like whimsical, magical, enchanted, alien, superhero, cosmic.`
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
• Role: one everyday noun with no modifiers. Do NOT add adjectives (e.g. not "quiet librarian").
• Quirks: slightly quirky or specific, max 5 words.
• All descriptors like "anxious" or "pessimistic" must go in a quirk — not in the role.
• Ban whimsical, magical, cosmic, fantasy, sci-fi, enchanted language.`
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
• Role: must be ONE clean noun. NO adjectives or descriptions.
• Quirks: can include emotional/psychological traits (e.g. "always nervous around people").
• Quirks must be grounded. ≤ 6 words.
• Never include magical, fantasy, whimsical, cosmic, superhero, or sci-fi language.`
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
• Role: must be ONE grounded noun (e.g. janitor, florist, therapist). NO adjectives.
• Quirks: oddly specific or ironic, emotional, but realistic. ≤ 6 words each.
• Use personality words (e.g. anxious, obsessive, pessimistic) as quirks only — never in the role.
• Strictly ban all fantasy, magical, whimsical, enchanted, cosmic, sci-fi descriptors.`
  }
};