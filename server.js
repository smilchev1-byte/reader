import express from "express";
import multer from "multer";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// 1) Сложи ключа в ENV (НЕ в кода)
// Windows (PowerShell):  setx GEMINI_API_KEY "YOUR_KEY"
// macOS/Linux:           export GEMINI_API_KEY="YOUR_KEY"
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY env var.");
  process.exit(1);
}

app.use(cors()); // ако ще хостваш frontend на друг домейн/порт

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    const categories = (req.body.categories || "").trim();
    if (!categories) return res.status(400).json({ error: "Missing categories" });
    if (!req.file) return res.status(400).json({ error: "Missing image file" });

    const genAI = new GoogleGenerativeAI(API_KEY);

    // Най-стабилно: 1.5-flash / 1.5-pro (смени ако искаш)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Ти си счетоводен асистент.
Разгледай тази снимка на касова бележка (Receipt OCR).
Извади списък с всички закупени стоки и техните цени.
След това групирай всеки артикул в една от тези категории: ${categories}.
Върни резултата САМО като JSON масив, без никакъв друг текст:
[
  {
    "category": "Храна",
    "items": [
      {"name": "Хляб Добруджа", "price": 1.50},
      {"name": "Сирене", "price": 8.20}
    ]
  }
]
Цените да са числа (number).
`;

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    let text = result.response.text().trim();

    // чистим ако случайно върне ```json
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // валидираме JSON
    const data = JSON.parse(text);

    res.json({ data });
  } catch (err) {
    res.status(500).json({
      error: err?.message || "Server error",
    });
  }
});

app.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
