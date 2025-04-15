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
app.use(express.json()); // <-- Important! This lets Express parse JSON bodies

app.post("/generate", async (req, res) => {
  try {
    // Use the prompt from the frontend, or a default
    const prompt =
      req.body.prompt ||
      "Create an improv character with a role and two quirky traits. Respond in JSON format with fields: role, quirk1, quirk2.";

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.9,
      max_tokens: 150,
    });

    // Get the AI's message
    const message = completion.choices[0].message.content;

    // Try to parse the response as JSON
    let character = {};
    try {
      character = JSON.parse(message);
    } catch (err) {
      // Fallback if the AI response isn't JSON
      return res.status(200).json({
        role: "Error parsing character",
        quirk1: "Response was not valid JSON",
        quirk2: "Check your OpenAI prompt formatting",
      });
    }

    res.json(character);
  } catch (error) {
    console.error("❌ Error in /generate:", error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
