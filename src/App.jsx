
// CEIRecruiting_fixed_v2.jsx
// ✅ Includes robust candidate name/email/phone extraction fixes

import { useState, useEffect, useRef, useCallback } from "react";

// ---------------- HELPERS ----------------
const ini = (n = "") =>
  n.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "UC";

// ---------------- SAFE PARSE FIX ----------------
async function parseResume(base64, uploadJob, jobs) {
  const GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY;

  const prompt = `Extract resume details in strict JSON. Always attempt name extraction.
Return keys: name, fullName, candidateName, email, phone, location, summary, skills,
currentRole, currentCompany, totalExp, education, certifications, languages,
fitScore, fitReason, skillMatch, primarySkillsMatched, primarySkillsTotal,
primaryMatchPct, secondaryMatchPct, experienceMatch, recommendation.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: "application/pdf", data: base64 } }, { text: prompt }] }]
      })
    }
  );

  const d = await res.json();
  let raw = d?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  // ✅ Name fallback logic
  let finalName = parsed.name || parsed.fullName || parsed.candidateName || null;

  if (!finalName || finalName.length < 3) {
    const blob = [parsed.summary, parsed.currentRole, parsed.location].join(" ");
    const match = blob?.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})/);
    if (match) finalName = match[1];
  }

  parsed.name = finalName || "Unknown Candidate";

  // ✅ Sanitize contact
  parsed.email = parsed.email && parsed.email.includes("@") ? parsed.email : null;
  parsed.phone = parsed.phone && parsed.phone.match(/\d{7,}/) ? parsed.phone : null;

  return parsed;
}

// ---------------- APP ----------------
export default function App() {
  const [candidates, setCandidates] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (file.type !== "application/pdf") return alert("PDF only");

    setUploading(true);

    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

    const parsed = await parseResume(base64);

    const safeName = parsed.name && parsed.name.length > 2
      ? parsed.name
      : "Unknown Candidate";

    const nc = {
      id: `c_${Date.now()}`,
      name: safeName,
      avatar: ini(safeName),
      role: parsed.currentRole || "—",
      exp: parsed.totalExp || "—",
      skills: parsed.skills || [],
      email: parsed.email,
      phone: parsed.phone,
      score: parsed.fitScore || 50,
      summary: parsed.summary || "",
      uploadedAt: new Date().toISOString(),
    };

    setCandidates(p => [...p, nc]);
    setUploading(false);
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h2>CEI Recruiting – Fixed Upload</h2>
      <input type="file" ref={fileRef} hidden accept="application/pdf"
        onChange={e => handleFile(e.target.files[0])} />
      <button onClick={() => fileRef.current.click()}>
        Upload Resume
      </button>
      {uploading && <p>Parsing resume…</p>}
      <ul>
        {candidates.map(c => (
          <li key={c.id}>{c.name} – {c.email || "No email"}</li>
        ))}
      </ul>
    </div>
  );
}
