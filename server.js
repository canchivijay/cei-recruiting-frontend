// ============================================================
// CEI Recruiting — Backend API Server
// Handles Anthropic API calls securely (API key stays server-side)
// Deploy on Railway / Render / Fly.io / any Node.js host
// ============================================================

const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const app = express();

// ── Middleware ─────────────────────────────────────────────────
app.use(express.json({ limit: "15mb" })); // PDFs can be large
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["POST", "GET"],
}));

// ── Health check ───────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Resume parsing endpoint ────────────────────────────────────
app.post("/api/parse-resume", async (req, res) => {
  const { base64, jobTitle, skills } = req.body;

  if (!base64) {
    return res.status(400).json({ error: "No PDF data provided" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 }
            },
            {
              type: "text",
              text: `Parse this resume and return ONLY a JSON object with these exact keys:
{
  "name": "Full Name",
  "email": "email or null",
  "phone": "phone or null",
  "currentRole": "most recent job title",
  "totalExp": "X years",
  "skills": ["up to 6 key skills"],
  "education": "Highest degree and institution",
  "summary": "2-sentence professional summary",
  "fitScore": <0-100 integer based on match with role: ${jobTitle} requiring skills: ${(skills||[]).join(", ")}>,
  "fitReason": "1 sentence explaining the score",
  "strengths": ["2-3 key strengths relevant to ${jobTitle}"],
  "redFlags": ["any concerns, or empty array"]
}
Return ONLY the JSON. No markdown, no explanation.`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(502).json({ error: "AI parsing failed", detail: err });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === "text")?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json({ parsed });
  } catch (err) {
    console.error("Parse error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`CEI Recruiting API running on port ${PORT}`));
