import express from "express";
import multer from "multer";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY env var.");
  process.exit(1);
}

// ако отваряш HTML файла директно (file://) или имаш друг порт, това оправя CORS
app.use(
  cors({
    origin: true, // отразява Origin-а (работи и за localhost, и за други)
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    const categories = (req.body.categories || "").trim();
    if (!categories) return res.status(400).json({ error: "Missing categories" });
    if (!req.file) return res.status(400).json({ error: "Missing image file" });

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Върни САМО валиден JSON масив (без \`\`\`), формат:
[
  {"category":"...", "items":[{"name":"...", "price": 0}]}
]
Категории: ${categories}
Извади артикулите и цените от касовата бележка и ги класифицирай.
`;

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    let text = result.response.text().trim();

    // чистим ако все пак върне markdown
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const data = JSON.parse(text);
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Server: http://localhost:3000");
  console.log("Test:   http://localhost:3000/health");
});
