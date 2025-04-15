import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json()); // Important: allows reading JSON from POST body

app.post("/generate", async (req, res) => {
  try {
    // Get the prompt from the frontend
    const prompt =
      req.body.prompt ||
      "Create an improv character with a role and two quirky traits. Respond in JSON format with keys: role, quirk1, quirk2.";

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // or gpt-4
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.9,
      max_tokens: 150,
    });

    const message = completion.choices[0].message.content;

    let character = {};
    try {
      character = JSON.parse(message);
    } catch (err) {
      console.warn("⚠️ Could not parse JSON:", message);
      return res.status(200).json({
        role: "Error parsing response",
        quirk1: "AI did not return valid JSON",
        quirk2: "Try again or adjust the prompt",
      });
    }

    // Respond with fallback-safe fields
    res.json({
      role: character.role || "No role",
      quirk1: character.quirk1 || "No quirk 1",
      quirk2: character.quirk2 || "No quirk 2",
    });
  } catch (error) {
    console.error("❌ Error in /generate route:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
