import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/generate", async (req, res) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
  {
    role: "system",
    content: "You invent quirky improv characters. Respond ONLY with valid JSON containing exactly these 3 keys: 'role', 'quirk1', and 'quirk2'. Do not include any extra text or formatting. Do not wrap your response in markdown or other keys."
  },
  {
    role: "user",
    content: "Give me one improv character in this format: { \"role\": \"...\", \"quirk1\": \"...\", \"quirk2\": \"...\" }"
  }
],

      max_tokens: 60,
      temperature: 1,
    });

    let content = completion.choices[0].message.content;

try {
  const json = JSON.parse(content);
  res.json(json);
} catch (err) {
  console.error("⚠️ Failed to parse JSON:", content);
  res.status(500).json({ error: "Invalid response format from OpenAI", raw: content });
}

  } catch (err) {
    console.error("🔥 ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
