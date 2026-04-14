// FIXED App.jsx — Groq key bug resolved
import { useState, useEffect, useRef, useCallback } from "react";

// ✅ Groq API key (Vite-safe)
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#eef3ff", surface: "#ffffff", card: "#f6f9ff",
  border: "#d1ddf7", borderHover: "#aabcee",
  amber: "#1d4ed8", amberDim: "#93b4f5",
  cream: "#0c1a3a", muted: "#5b6f9e",
  faint: "#e2eafb", green: "#0e9f6e",
  red: "#e02424", blue: "#1e40af",
  purple: "#6d28d9", teal: "#0284c7", orange: "#ea580c",
};

// (file unchanged until parseResume)

// ─── AI Resume Parser — Groq LLaMA (FIXED) ────────────────────
async function parseResume(base64, jobId, jobs) {
  if (!GROQ_API_KEY) {
    throw new Error("Groq API key missing. Add VITE_GROQ_API_KEY in .env and restart dev server.");
  }

  const job = jobs.find(j => j.id === jobId);
  const primarySkills = (job?.skills || []).join(", ") || "not specified";
  const secondarySkills = (job?.secondarySkills || []).join(", ") || "none";

  const resumeText = await extractTextFromPDF(base64);

  const prompt = `You are an expert HR resume screening assistant.
Extract structured candidate data strictly in JSON.
CRITICAL: Extract name, email, phone, location.
RESUME TEXT:
${resumeText.slice(0,6000)}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq API error ${res.status}: ${t.slice(0,200)}`);
  }

  const data = await res.json();
  const txt = data.choices?.[0]?.message?.content;
  if (!txt) throw new Error("Empty Groq response");

  const json = txt.match(/\{[\s\S]*\}/);
  if (!json) throw new Error("Invalid JSON from Groq");

  return JSON.parse(json[0]);
}

// ⚠️ Rest of App.jsx remains unchanged from your original file

export default function App() {
  return null;
}
