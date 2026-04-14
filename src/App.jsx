// App.jsx (UPDATED) — Groq + Regex Email Fallback
import { useState, useEffect, useRef, useCallback } from "react";

// ✅ Groq API key (Vite-safe)
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

// ─────────────────────────────────────────────────────────────
// ✅ REGEX FALLBACK HELPERS
// ─────────────────────────────────────────────────────────────
function extractEmailRegex(text) {
  if (!text) return null;
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const match = text.match(emailRegex);
  return match ? match[0] : null;
}

// ─── PDF TEXT EXTRACTION (unchanged) ──────────────────────────
async function extractTextFromPDF(base64) {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load pdf.js"));
      document.head.appendChild(script);
    });
  }

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(" ") + "
";
  }

  if (!fullText.trim()) {
    throw new Error("No text found in PDF. Possibly scanned image.");
  }
  return fullText;
}

// ─── AI Resume Parser — Groq + Regex Fallback ──────────────────
async function parseResume(base64, jobId, jobs) {
  if (!GROQ_API_KEY) {
    throw new Error("Groq API key missing. Add VITE_GROQ_API_KEY in .env and restart.");
  }

  const resumeText = await extractTextFromPDF(base64);

  const prompt = `You are an ATS resume parser. Extract structured JSON.

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
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err.slice(0,200)}`);
  }

  const data = await res.json();
  const txt = data.choices?.[0]?.message?.content;
  if (!txt) throw new Error("Empty Groq response");

  const jsonMatch = txt.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid JSON from Groq");

  const parsed = JSON.parse(jsonMatch[0]);

  // ✅ REGEX EMAIL FALLBACK
  if (!parsed.email || !parsed.email.includes("@")) {
    const fallbackEmail = extractEmailRegex(resumeText);
    if (fallbackEmail) parsed.email = fallbackEmail;
  }

  return parsed;
}

// ─── MAIN APP (rest of your app unchanged) ─────────────────────
export default function App() {
  return null;
}
