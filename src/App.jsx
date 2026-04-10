import { useState, useEffect, useRef, useCallback } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#eef3ff", surface: "#ffffff", card: "#f6f9ff",
  border: "#d1ddf7", borderHover: "#aabcee",
  amber: "#1d4ed8", amberDim: "#93b4f5",
  cream: "#0c1a3a", muted: "#5b6f9e", faint: "#e2eafb",
  green: "#0e9f6e", red: "#e02424", blue: "#1e40af",
  purple: "#6d28d9", teal: "#0284c7", orange: "#ea580c",
};
const FD = "'Cormorant Garamond','Georgia',serif";
const FM = "'DM Mono','Courier New',monospace";

// ─── Static Data ──────────────────────────────────────────────────────────────
const RECRUITER_COLORS = [C.amber, C.blue, C.teal, C.purple, C.green, C.orange];
const RECRUITER_ROLE_OPTIONS = ["Lead Recruiter","Tech Recruiter","HR Recruiter","Campus Recruiter","Talent Partner","Sourcing Specialist"];
const STOR_RECS = "cei_recruiters_v1";

const STOR_JOBS  = "cei_jobs_v1";
const DEPTS = ["Engineering","Design","Product","Marketing","HR","Finance","Operations","Sales"];
const LOCATIONS = ["Remote","On-site","Hybrid","Chennai","Bangalore","Mumbai","Delhi","Hyderabad"];

const STAGES = ["Applied","Screening","Tech Round 1","Tech Round 2","Tech Round 3","HR Round","Final Round","Offer","Hired","Rejected"];

const STAGE_META = {
  "Applied":     { color: C.muted,   short: "APP" },
  "Screening":   { color: C.blue,    short: "SCR" },
  "Tech Round 1":{ color: C.amber,   short: "TR1" },
  "Tech Round 2":{ color: C.orange,  short: "TR2" },
  "Tech Round 3":{ color: C.purple,  short: "TR3" },
  "HR Round":    { color: C.teal,    short: "HR"  },
  "Final Round": { color: C.blue,    short: "FNL" },
  "Offer":       { color: C.green,   short: "OFR" },
  "Hired":       { color: C.green,   short: "HRD" },
  "Rejected":    { color: C.red,     short: "REJ" },
};



const STOR_CANDS = "cei_candidates_v1";
const STOR_INTV  = "cei_interviews_v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sc = v => v >= 88 ? C.green : v >= 70 ? C.amber : C.red;
const ini = n => n.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const fmt = iso => new Date(iso).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});

const Avatar = ({ text, size=36, color=C.amber }) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:color+"20",border:`1px solid ${color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.33,fontFamily:FM,color,flexShrink:0,fontWeight:600}}>{text}</div>
);
const Badge = ({ label, color }) => (
  <span style={{padding:"3px 10px",borderRadius:4,fontSize:12,background:color+"20",color,border:`0.5px solid ${color}40`,fontFamily:FM,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</span>
);
const Bar = ({ val }) => (
  <div style={{display:"flex",alignItems:"center",gap:8}}>
    <div style={{flex:1,height:3,background:C.border,borderRadius:2,overflow:"hidden"}}>
      <div style={{width:`${val}%`,height:"100%",background:sc(val),borderRadius:2,transition:"width 0.8s ease"}}/>
    </div>
    <span style={{fontSize:11,color:sc(val),fontFamily:FM,minWidth:22}}>{val}</span>
  </div>
);
const Pill = ({ label }) => (
  <span style={{padding:"3px 10px",borderRadius:20,fontSize:12,background:C.faint,color:C.muted,fontFamily:FM,border:`0.5px solid ${C.border}`}}>{label}</span>
);
const Spin = () => (
  <div style={{display:"inline-block",width:14,height:14,border:`2px solid ${C.amberDim}`,borderTop:`2px solid ${C.amber}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
);

const STATUS_META = {
  approved: { color: C.green,  label: "Approved" },
  rejected: { color: C.red,    label: "Rejected" },
  hold:     { color: C.orange, label: "On Hold"  },
  pending:  { color: C.muted,  label: "Pending"  },
};

const INTERVIEW_STATUS_META = {
  scheduled: { color: C.blue,   label: "Scheduled" },
  completed: { color: C.teal,   label: "Completed" },
  approved:  { color: C.green,  label: "Approved"  },
  cancelled: { color: C.red,    label: "Cancelled" },
};

const INTERVIEW_LEVELS = [
  { id: "l1", label: "Level 1", short: "L1", color: C.blue   },
  { id: "l2", label: "Level 2", short: "L2", color: C.purple },
  { id: "final", label: "Final", short: "FN", color: C.green  },
];

// ─── AI Parser — Gemini direct (no backend needed) ───────────────────────────
const GEMINI_KEY = "AIzaSyDh6Ll6t0JlN8tfQIeW8TkqrjO94wwpHMo";

async function parseResume(base64, jobId, jobs) {
  const job = jobs.find(j=>j.id===jobId);
  const primarySkills   = (job?.skills||[]).join(", ") || "not specified";
  const secondarySkills = (job?.secondarySkills||[]).join(", ") || "none";

  const prompt = `You are an expert HR resume screening assistant. Analyze this resume against the job requirements below.

ROLE: ${job?.title || "Not specified"}
DEPARTMENT: ${job?.dept || "Not specified"}
PRIMARY SKILLS (must-have): ${primarySkills}
SECONDARY SKILLS (good-to-have): ${secondarySkills}
RESPONSIBILITIES: ${job?.responsibilities || "Not specified"}

INSTRUCTIONS:
- Analyze resumes in Word and PDF formats for hiring or HR professionals
- Verify exact match between required skills in the job description and skills listed in the resume
- Focus on primary skills as specified in the job description and the resume skills section
- Rate each skill based on presence and relevance, and provide an overall fit assessment
- Consider years of experience, education, and certifications
- Present results in a clear, concise summary for easy decision-making
- Do not process resumes in languages other than English
- Respond only to resume evaluation and skill matching
- Always communicate in English
- CRITICAL: You MUST extract the candidate name from the top of the resume. Look for it in the header, title, or first line. Never return "Unknown" for name.
- CRITICAL: Extract email (look for @ symbol), phone (look for digits with spaces/dashes), location (look for city/state near top)

Return ONLY this JSON object, nothing else, no markdown, no backticks:
{
  "name": "EXTRACT the candidate full name exactly as written at top of resume - this is CRITICAL",
  "email": "email address extracted from resume or null",
  "phone": "phone/mobile number with country code if present or null",
  "location": "city, state/country extracted from resume or null",
  "currentRole": "most recent job title",
  "currentCompany": "most recent employer name or null",
  "totalExp": "X years Y months",
  "skills": ["up to 10 skills found in resume"],
  "education": [
    {"degree": "degree name", "institution": "college/university name", "year": "graduation year or null", "specialization": "field of study or null"}
  ],
  "certifications": ["list of certifications found or empty array"],
  "languages": ["languages known or empty array"],
  "summary": "2 sentence professional summary",
  "fitScore": <overall 0-100 fit score>,
  "fitReason": "1 sentence overall fit explanation",
  "skillMatch": [
    {"skill": "skill name", "required": true, "found": true, "relevance": "exact|partial|missing", "note": "brief note"}
  ],
  "primarySkillsMatched": <number of primary skills found>,
  "primarySkillsTotal": <total number of primary skills required>,
  "primaryMatchPct": <0-100 percentage of primary skills matched>,
  "secondaryMatchPct": <0-100 percentage of secondary skills matched>,
  "experienceMatch": "exceeds|meets|below",
  "strengths": ["2-3 key strengths relevant to the role"],
  "redFlags": ["concerns or empty array"],
  "recommendation": "shortlist|consider|reject"
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: "application/pdf", data: base64 } },
          { text: prompt }
        ]}]
      })
    }
  );
  const d = await res.json();
  const txt = d.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(txt.replace(/```json|```/g,"").trim());
}

// ─── CSV Report Generator ─────────────────────────────────────────────────────
function generateCSV(candidates, interviews, jobs, recruiters) {
  const rows = [];

  // Header
  rows.push([
    "Job Title","Department","Recruiter","Candidate Name","Stage",
    "Fit Score","Interview Status","Skills","Experience",
    "Upload Date","Interview Date","Interview Type","Source"
  ].join(","));

  candidates.forEach(c => {
    const job = jobs.find(j=>j.id===c.jobId);
    const rec = recruiters.find(r=>r.id===c.recruiterId);
    const intv = interviews.find(i=>i.candidateId===c.id);
    const row = [
      `"${job?.title||""}"`,
      `"${job?.dept||""}"`,
      `"${rec?.name||""}"`,
      `"${c.name}"`,
      `"${c.stage}"`,
      c.score,
      `"${STATUS_META[c.interviewStatus]?.label||""}"`,
      `"${(c.skills||[]).join("; ")}"`,
      `"${c.exp}"`,
      `"${fmt(c.uploadedAt)}"`,
      `"${intv?.date||""}"`,
      `"${intv?.type||""}"`,
      `"${c.source==="ai"?"AI Screened":"Manual"}"`
    ];
    rows.push(row.join(","));
  });

  return rows.join("\n");
}

function downloadCSV(csv, filename) {
  const encoded = encodeURIComponent(csv);
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encoded;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Storage ──────────────────────────────────────────────────────────────────
async function load(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function save(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN APP ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [recruiters, setRecruiters]       = useState([]);
  const [currentRecruiter, setCurrentRecruiter] = useState(null);
  const [tab, setTab]                     = useState("dashboard");
  const [jobs, setJobs]                   = useState([]);
  const [candidates, setCandidates]       = useState([]);
  const [interviews, setInterviews]       = useState([]);
  const [loaded, setLoaded]               = useState(false);

  // Auth screen state
  const [authMode, setAuthMode]           = useState("login");
  const [signupName, setSignupName]       = useState("");
  const [signupRole, setSignupRole]       = useState(RECRUITER_ROLE_OPTIONS[0]);
  const [signupColor, setSignupColor]     = useState(RECRUITER_COLORS[0]);
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm]   = useState("");
  const [signupError, setSignupError]     = useState("");

  // Login password prompt
  const [loginTarget, setLoginTarget]     = useState(null); // recruiter waiting for password
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError]       = useState("");

  // Candidate edit state
  const [editingCand, setEditingCand]     = useState(null);
  const [editForm, setEditForm]           = useState({});

  // Pipeline job filter
  const [pipelineJobFilter, setPipelineJobFilter] = useState("all");

  // Job postings candidate dropdown
  const [expandedJobId, setExpandedJobId] = useState(null);

  // Inline confirmation for clearing resumes
  const [confirmClearJobId, setConfirmClearJobId] = useState(null);

  // Job editing state
  const [editingJobId, setEditingJobId]   = useState(null);
  const [ejTitle, setEjTitle]             = useState("");
  const [ejDept, setEjDept]               = useState(DEPTS[0]);
  const [ejLocation, setEjLocation]       = useState(LOCATIONS[0]);
  const [ejSkillInput, setEjSkillInput]   = useState("");
  const [ejSkills, setEjSkills]           = useState([]);
  const [ejSecInput, setEjSecInput]       = useState("");
  const [ejSecSkills, setEjSecSkills]     = useState([]);
  const [ejResponsibilities, setEjResponsibilities] = useState("");
  const [ejUrgent, setEjUrgent]           = useState(false);

  // Candidate expanded detail view
  const [expandedCandId, setExpandedCandId] = useState(null);

  // Job creation state
  const [showJobForm, setShowJobForm]     = useState(false);
  const [jTitle, setJTitle]               = useState("");
  const [jDept, setJDept]                 = useState(DEPTS[0]);
  const [jLocation, setJLocation]         = useState(LOCATIONS[0]);
  const [jSkillInput, setJSkillInput]     = useState("");
  const [jSkills, setJSkills]             = useState([]);
  const [jSecSkillInput, setJSecSkillInput] = useState("");
  const [jSecSkills, setJSecSkills]       = useState([]);
  const [jResponsibilities, setJResponsibilities] = useState("");
  const [jUrgent, setJUrgent]             = useState(false);
  const [jError, setJError]               = useState("");

  // Upload state
  const [uploadJob, setUploadJob]         = useState("");
  const [uploading, setUploading]         = useState(false);
  const [uploadResult, setUploadResult]   = useState(null);
  const [uploadError, setUploadError]     = useState(null);
  const [fileName, setFileName]           = useState(null);
  const [dragOver, setDragOver]           = useState(false);
  const fileRef = useRef(null);

  // Bulk upload state
  const [bulkQueue, setBulkQueue]         = useState([]); // [{id, name, status, result, error}]
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const bulkQueueRef = useRef([]);

  // Report filters
  const [rptJob,  setRptJob]  = useState("all");
  const [rptRec,  setRptRec]  = useState("all");
  const [rptStat, setRptStat] = useState("all");

  useEffect(() => {
    Promise.all([load(STOR_RECS), load(STOR_JOBS), load(STOR_CANDS), load(STOR_INTV)]).then(([r, jo, c, i]) => {
      if (r)  setRecruiters(r);
      if (jo) setJobs(jo);
      if (c)  setCandidates(c);
      if (i)  setInterviews(i);
      setLoaded(true);
    });
  }, []);

  useEffect(() => { if (loaded) save(STOR_RECS,  recruiters);  }, [recruiters, loaded]);
  useEffect(() => { if (loaded) save(STOR_JOBS,  jobs);        }, [jobs, loaded]);
  useEffect(() => { if (loaded) save(STOR_CANDS, candidates);  }, [candidates, loaded]);
  useEffect(() => { if (loaded) save(STOR_INTV,  interviews);  }, [interviews, loaded]);

  // ── Derived ──
  const myCandidates = currentRecruiter
    ? candidates.filter(c => c.recruiterId === currentRecruiter.id)
    : candidates;

  const pipelineByStage = STAGES.reduce((acc, s) => {
    acc[s] = candidates.filter(c => c.stage === s);
    return acc;
  }, {});

  const myPipelineByStage = STAGES.reduce((acc, s) => {
    acc[s] = myCandidates.filter(c => c.stage === s);
    return acc;
  }, {});

  // ── Recruiter activity stats ──
  const recStats = recruiters.map(r => {
    const rc = candidates.filter(c => c.recruiterId === r.id);
    const ri = interviews.filter(i => i.recruiterId === r.id);
    return {
      ...r,
      total:      rc.length,
      approved:   rc.filter(c=>c.interviewStatus==="approved").length,
      rejected:   rc.filter(c=>c.interviewStatus==="rejected").length,
      hold:       rc.filter(c=>c.interviewStatus==="hold").length,
      hired:      rc.filter(c=>c.stage==="Hired").length,
      interviews: ri.length,
      avgScore:   rc.length ? Math.round(rc.reduce((s,c)=>s+c.score,0)/rc.length) : 0,
      byJob:      jobs.map(j => ({ job: j, count: rc.filter(c=>c.jobId===j.id).length })).filter(x=>x.count>0),
    };
  });

  // ── Actions ──
  const updateStage = (id, stage) => setCandidates(p => p.map(c => c.id===id ? {...c, stage} : c));
  const updateStatus = (id, interviewStatus) => setCandidates(p => p.map(c => c.id===id ? {...c, interviewStatus} : c));
  const updateInterview = (id, patch) => setInterviews(p => p.map(i => i.id===id ? {...i,...patch} : i));
  const updateFeedback = (candId, feedback) => setCandidates(p => p.map(c => c.id===candId ? {...c, feedback} : c));

  const handleFile = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") { setUploadError("Please upload a PDF."); return; }
    setFileName(file.name); setUploading(true); setUploadResult(null); setUploadError(null);
    try {
      const base64 = await new Promise((res,rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsDataURL(file);
      });
      const parsed = await parseResume(base64, uploadJob, jobs);
      const eduRaw = parsed.education;
      const eduStr = Array.isArray(eduRaw)
        ? eduRaw.map(e=>`${e.degree||""} ${e.institution?`- ${e.institution}`:""}${e.year?` (${e.year})`:""}${e.specialization?`, ${e.specialization}`:""}`.trim()).join(" | ")
        : (eduRaw||"—");
      const nc = {
        id: `c_${Date.now()}`,
        name: parsed.name || "Unknown",
        avatar: ini(parsed.name||"UC"),
        role: parsed.currentRole || "—",
        currentCompany: parsed.currentCompany||"",
        exp: parsed.totalExp || "—",
        score: Math.min(100,Math.max(0,parsed.fitScore||50)),
        skills: parsed.skills||[],
        email: parsed.email||null,
        phone: parsed.phone||null,
        location: parsed.location||null,
        education: eduStr,
        educationDetail: Array.isArray(eduRaw)?eduRaw:[],
        certifications: parsed.certifications||[],
        languages: parsed.languages||[],
        summary: parsed.summary,
        fitReason: parsed.fitReason,
        redFlags: parsed.redFlags||[],
        strengths: parsed.strengths||[],
        skillMatch: parsed.skillMatch||[],
        primaryMatchPct: parsed.primaryMatchPct||0,
        secondaryMatchPct: parsed.secondaryMatchPct||0,
        primarySkillsMatched: parsed.primarySkillsMatched||0,
        primarySkillsTotal: parsed.primarySkillsTotal||0,
        experienceMatch: parsed.experienceMatch||"",
        recommendation: parsed.recommendation||"consider",
        jobId: uploadJob,
        recruiterId: currentRecruiter?.id || "r1",
        source: "ai", stage: "Applied",
        interviewStatus: "pending",
        uploadedAt: new Date().toISOString(),
      };
      setCandidates(p => [...p, nc]);
      setUploadResult(nc);
    } catch(err) {
      setUploadError("AI parsing failed: " + (err.message||"Unknown error"));
    } finally { setUploading(false); }
  }, [uploadJob, currentRecruiter]);
  const handleBulkFiles = useCallback(async (files) => {
    if (!uploadJob) { setUploadError("Please select a target role first."); return; }
    const pdfs = Array.from(files).filter(f => f.type === "application/pdf");
    if (pdfs.length === 0) { setUploadError("No PDF files found."); return; }
    setUploadError(null); setUploadResult(null);
    const initialQueue = pdfs.map((f, i) => ({
      id: `q_${Date.now()}_${i}`,
      name: f.name, file: f, status: "queued", result: null, error: null,
    }));
    bulkQueueRef.current = initialQueue;
    setBulkQueue([...initialQueue]);
    setBulkProcessing(true);
    for (let i = 0; i < initialQueue.length; i++) {
      bulkQueueRef.current = bulkQueueRef.current.map((q, idx) => idx===i ? {...q, status:"processing"} : q);
      setBulkQueue([...bulkQueueRef.current]);
      try {
        const base64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(initialQueue[i].file);
        });
        const parsed = await parseResume(base64, uploadJob, jobs);
        const nc = {
          id: `c_${Date.now()}_${i}`,
          name: parsed.name || "Unknown",
          avatar: ini(parsed.name || "UC"),
          role: parsed.currentRole || "—",
          exp: parsed.totalExp || "—",
          score: Math.min(100, Math.max(0, parsed.fitScore || 50)),
          skills: parsed.skills || [],
          email: parsed.email, phone: parsed.phone,
          education: parsed.education, summary: parsed.summary,
          fitReason: parsed.fitReason, redFlags: parsed.redFlags || [],
          strengths: parsed.strengths || [],
          jobId: uploadJob, recruiterId: currentRecruiter?.id || "r1",
          source: "ai", stage: "Applied", interviewStatus: "pending",
          uploadedAt: new Date().toISOString(),
        };
        setCandidates(p => [...p, nc]);
        bulkQueueRef.current = bulkQueueRef.current.map((q, idx) => idx===i ? {...q, status:"done", result:nc} : q);
        setBulkQueue([...bulkQueueRef.current]);
      } catch (err) {
        bulkQueueRef.current = bulkQueueRef.current.map((q, idx) => idx===i ? {...q, status:"error", error: err.message||"Parse failed"} : q);
        setBulkQueue([...bulkQueueRef.current]);
      }
    }
    setBulkProcessing(false);
  }, [uploadJob, currentRecruiter, jobs]);

  const handleSignup = () => {
    const name = signupName.trim();
    if (!name) { setSignupError("Please enter your full name."); return; }
    if (!signupPassword) { setSignupError("Please create a password."); return; }
    if (signupPassword.length < 4) { setSignupError("Password must be at least 4 characters."); return; }
    if (signupPassword !== signupConfirm) { setSignupError("Passwords do not match."); return; }
    if (recruiters.find(r => r.name.toLowerCase() === name.toLowerCase())) {
      setSignupError("A recruiter with this name already exists."); return;
    }
    const newRec = {
      id:       `r_${Date.now()}`,
      name,
      initials: ini(name),
      role:     signupRole,
      color:    signupColor,
      password: signupPassword,
    };
    setRecruiters(p => [...p, newRec]);
    setCurrentRecruiter(newRec);
    setSignupName(""); setSignupPassword(""); setSignupConfirm(""); setSignupError("");
  };

  const handleLoginAttempt = (recruiter) => {
    if (!recruiter.password) { setCurrentRecruiter(recruiter); return; }
    setLoginTarget(recruiter);
    setLoginPassword("");
    setLoginError("");
  };

  const handleLoginSubmit = () => {
    if (loginPassword === loginTarget.password) {
      setCurrentRecruiter(loginTarget);
      setLoginTarget(null); setLoginPassword(""); setLoginError("");
    } else {
      setLoginError("Incorrect password. Please try again.");
    }
  };

  // Candidate edit handlers
  const startEditCand = (c) => {
    setEditingCand(c.id);
    setEditForm({
      name: c.name, role: c.role, exp: c.exp,
      email: c.email||"", phone: c.phone||"", location: c.location||"",
      interviewStatus: c.interviewStatus, stage: c.stage,
      skills: (c.skills||[]).join(", "),
    });
  };

  const saveEditCand = (id) => {
    setCandidates(p => p.map(c => c.id !== id ? c : {
      ...c,
      name:            editForm.name.trim()||c.name,
      role:            editForm.role,
      exp:             editForm.exp,
      email:           editForm.email,
      phone:           editForm.phone,
      location:        editForm.location,
      interviewStatus: editForm.interviewStatus,
      stage:           editForm.stage,
      skills:          editForm.skills.split(",").map(s=>s.trim()).filter(Boolean),
      avatar:          ini(editForm.name.trim()||c.name),
    }));
    setEditingCand(null);
  };

  const handleCreateJob = () => {
    if (!jTitle.trim()) { setJError("Job title is required."); return; }
    const newJob = {
      id:               `j_${Date.now()}`,
      title:            jTitle.trim(),
      dept:             jDept,
      location:         jLocation,
      skills:           jSkills,
      secondarySkills:  jSecSkills,
      responsibilities: jResponsibilities.trim(),
      urgent:           jUrgent,
      createdBy:        currentRecruiter.id,
      createdAt:        new Date().toISOString(),
      status:           "Active",
    };
    setJobs(p => [...p, newJob]);
    setJTitle(""); setJDept(DEPTS[0]); setJLocation(LOCATIONS[0]);
    setJSkills([]); setJSkillInput(""); setJSecSkills([]); setJSecSkillInput("");
    setJResponsibilities(""); setJUrgent(false); setJError("");
    setShowJobForm(false);
  };

  const handleDeleteJob = (id) => {
    setJobs(p => p.filter(j => j.id !== id));
  };

  const startEditJob = (job) => {
    setEditingJobId(job.id);
    setEjTitle(job.title);
    setEjDept(job.dept);
    setEjLocation(job.location);
    setEjSkills(job.skills||[]);
    setEjSecSkills(job.secondarySkills||[]);
    setEjResponsibilities(job.responsibilities||"");
    setEjUrgent(job.urgent||false);
    setEjSkillInput(""); setEjSecInput("");
  };

  const saveEditJob = (id) => {
    setJobs(p => p.map(j => j.id!==id ? j : {
      ...j,
      title: ejTitle.trim()||j.title,
      dept: ejDept, location: ejLocation,
      skills: ejSkills, secondarySkills: ejSecSkills,
      responsibilities: ejResponsibilities.trim(),
      urgent: ejUrgent,
    }));
    setEditingJobId(null);
  };

  const clearJobCandidates = (jobId) => {
    setConfirmClearJobId(jobId);
  };

  const confirmClear = (jobId) => {
    setCandidates(p => p.filter(c => c.jobId !== jobId));
    setInterviews(p => p.filter(i => i.jobId !== jobId));
    setConfirmClearJobId(null);
  };

  const toggleJobStatus = (id) => {
    setJobs(p => p.map(j => j.id === id ? {...j, status: j.status === "Active" ? "Closed" : "Active"} : j));
  };

  const addSkill = () => {
    const s = jSkillInput.trim();
    if (s && !jSkills.includes(s)) { setJSkills(p => [...p, s]); }
    setJSkillInput("");
  };

  const addSecSkill = () => {
    const s = jSecSkillInput.trim();
    if (s && !jSecSkills.includes(s)) { setJSecSkills(p => [...p, s]); }
    setJSecSkillInput("");
  };

  const handleDeleteRecruiter = (id, e) => {
    e.stopPropagation();
    setRecruiters(p => p.filter(r => r.id !== id));
  };

  // ─── Auth Screen ─────────────────────────────────────────────────────────────
  if (!currentRecruiter) {
    const inputStyle = {
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 6,
      padding: "9px 12px", color: C.cream, fontFamily: FM, fontSize: 11,
      outline: "none", width: "100%", letterSpacing: "0.04em", boxSizing: "border-box",
    };
    const labelStyle = { fontSize: 9, color: C.muted, letterSpacing: "0.12em", marginBottom: 5, display: "block" };

    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:C.bg,fontFamily:FM,padding:24}}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}} .fi{animation:fadeIn 0.25s ease} input[type=password]{letter-spacing:0.15em}`}</style>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontFamily:FD,fontSize:44,color:C.amber,lineHeight:1}}>CEI Recruiting</div>
          <div style={{fontSize:10,color:C.muted,letterSpacing:"0.16em",marginTop:4}}>RECRUITMENT · HR · AI</div>
        </div>

        {/* Password prompt overlay */}
        {loginTarget && (
          <div className="fi" style={{width:"100%",maxWidth:360,background:C.card,border:`1px solid ${loginTarget.color}50`,borderRadius:10,padding:24,marginBottom:16}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:18}}>
              <Avatar text={loginTarget.initials} size={36} color={loginTarget.color}/>
              <div>
                <div style={{fontSize:13,color:C.cream}}>{loginTarget.name}</div>
                <div style={{fontSize:10,color:C.muted}}>{loginTarget.role}</div>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelStyle}>PASSWORD</label>
              <input type="password" value={loginPassword} onChange={e=>{setLoginPassword(e.target.value);setLoginError("");}}
                onKeyDown={e=>e.key==="Enter"&&handleLoginSubmit()} placeholder="Enter your password" autoFocus style={inputStyle}/>
            </div>
            {loginError && <div style={{marginBottom:10,padding:"7px 10px",background:C.red+"15",border:`1px solid ${C.red}40`,borderRadius:5,fontSize:11,color:C.red}}>{loginError}</div>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={handleLoginSubmit} style={{flex:1,padding:"9px 0",borderRadius:5,background:C.amber,border:"none",color:C.bg,fontFamily:FM,fontSize:11,cursor:"pointer",fontWeight:700,letterSpacing:"0.06em"}}>SIGN IN →</button>
              <button onClick={()=>{setLoginTarget(null);setLoginError("");}} style={{padding:"9px 14px",borderRadius:5,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:11,cursor:"pointer"}}>BACK</button>
            </div>
          </div>
        )}

        {!loginTarget && (
          <>
            {/* Toggle */}
            <div style={{display:"flex",gap:0,marginBottom:24,background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:3,width:"100%",maxWidth:420}}>
              {["login","signup"].map(m=>(
                <button key={m} onClick={()=>{setAuthMode(m);setSignupError("");}} style={{flex:1,padding:"7px 0",borderRadius:4,border:"none",cursor:"pointer",background:authMode===m?C.amber:"transparent",color:authMode===m?C.bg:C.muted,fontFamily:FM,fontSize:10,letterSpacing:"0.08em",transition:"all 0.15s"}}>
                  {m==="login"?"SIGN IN":"CREATE ACCOUNT"}
                </button>
              ))}
            </div>

            {/* Sign In */}
            {authMode==="login" && (
              <div className="fi" style={{width:"100%",maxWidth:420}}>
                {recruiters.length===0 ? (
                  <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:10,padding:32,textAlign:"center"}}>
                    <div style={{fontSize:24,marginBottom:8,opacity:0.3}}>○</div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:4}}>No accounts yet</div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:16}}>Create your recruiter account to get started</div>
                    <button onClick={()=>setAuthMode("signup")} style={{padding:"7px 18px",borderRadius:4,background:C.amber,border:"none",color:C.bg,fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700,letterSpacing:"0.06em"}}>CREATE ACCOUNT →</button>
                  </div>
                ) : (
                  <div>
                    <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",marginBottom:10}}>SELECT YOUR PROFILE</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {recruiters.map(r => {
                        const rc = candidates.filter(c=>c.recruiterId===r.id);
                        return (
                          <button key={r.id} onClick={()=>handleLoginAttempt(r)} style={{
                            background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
                            padding:"14px 16px",cursor:"pointer",textAlign:"left",
                            transition:"all 0.15s",fontFamily:FM,borderLeft:`3px solid ${r.color}`,position:"relative",
                          }}>
                            <div style={{display:"flex",gap:12,alignItems:"center"}}>
                              <Avatar text={r.initials} size={40} color={r.color}/>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,color:C.cream,marginBottom:2}}>{r.name}</div>
                                <div style={{fontSize:10,color:C.muted}}>{r.role} {r.password ? "· 🔒" : ""}</div>
                              </div>
                              <div style={{display:"flex",gap:14,marginRight:28}}>
                                <div style={{textAlign:"center"}}>
                                  <div style={{fontFamily:FD,fontSize:20,color:r.color,lineHeight:1}}>{rc.length}</div>
                                  <div style={{fontSize:8,color:C.muted}}>CANDS</div>
                                </div>
                                <div style={{textAlign:"center"}}>
                                  <div style={{fontFamily:FD,fontSize:20,color:C.green,lineHeight:1}}>{rc.filter(c=>c.interviewStatus==="approved").length}</div>
                                  <div style={{fontSize:8,color:C.muted}}>APPR</div>
                                </div>
                                <div style={{textAlign:"center"}}>
                                  <div style={{fontFamily:FD,fontSize:20,color:C.amber,lineHeight:1}}>{interviews.filter(i=>i.recruiterId===r.id).length}</div>
                                  <div style={{fontSize:8,color:C.muted}}>INTV</div>
                                </div>
                              </div>
                              <button onClick={(e)=>handleDeleteRecruiter(r.id,e)} style={{position:"absolute",top:10,right:10,background:"transparent",border:`0.5px solid ${C.border}`,borderRadius:3,color:C.muted,fontFamily:FM,fontSize:9,cursor:"pointer",padding:"2px 6px",lineHeight:1}}>✕</button>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div style={{marginTop:14,textAlign:"center"}}>
                      <button onClick={()=>setAuthMode("signup")} style={{background:"transparent",border:"none",color:C.muted,fontFamily:FM,fontSize:10,cursor:"pointer",letterSpacing:"0.06em",textDecoration:"underline"}}>+ ADD ANOTHER RECRUITER</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sign Up */}
            {authMode==="signup" && (
              <div className="fi" style={{width:"100%",maxWidth:420,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",marginBottom:18}}>NEW RECRUITER ACCOUNT</div>

                <div style={{marginBottom:12}}>
                  <label style={labelStyle}>FULL NAME</label>
                  <input value={signupName} onChange={e=>{setSignupName(e.target.value);setSignupError("");}} placeholder="e.g. Priya Krishnan" style={inputStyle}/>
                </div>

                <div style={{marginBottom:12}}>
                  <label style={labelStyle}>ROLE</label>
                  <select value={signupRole} onChange={e=>setSignupRole(e.target.value)} style={{...inputStyle,cursor:"pointer"}}>
                    {RECRUITER_ROLE_OPTIONS.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  <div>
                    <label style={labelStyle}>PASSWORD</label>
                    <input type="password" value={signupPassword} onChange={e=>{setSignupPassword(e.target.value);setSignupError("");}} placeholder="Min 4 characters" style={inputStyle}/>
                  </div>
                  <div>
                    <label style={labelStyle}>CONFIRM PASSWORD</label>
                    <input type="password" value={signupConfirm} onChange={e=>{setSignupConfirm(e.target.value);setSignupError("");}} onKeyDown={e=>e.key==="Enter"&&handleSignup()} placeholder="Re-enter password" style={inputStyle}/>
                  </div>
                </div>

                <div style={{marginBottom:18}}>
                  <label style={labelStyle}>PROFILE COLOUR</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {RECRUITER_COLORS.map(col=>(
                      <button key={col} onClick={()=>setSignupColor(col)} style={{width:28,height:28,borderRadius:"50%",background:col+"30",border:`2px solid ${signupColor===col?col:col+"40"}`,cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {signupColor===col && <div style={{width:10,height:10,borderRadius:"50%",background:col}}/>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",background:C.surface,borderRadius:6,marginBottom:14,border:`1px solid ${signupColor}40`}}>
                  <Avatar text={ini(signupName||"?")} size={34} color={signupColor}/>
                  <div>
                    <div style={{fontSize:12,color:C.cream}}>{signupName||"Your Name"}</div>
                    <div style={{fontSize:10,color:C.muted}}>{signupRole} · 🔒 Password protected</div>
                  </div>
                </div>

                {signupError && <div style={{marginBottom:10,padding:"7px 10px",background:C.red+"15",border:`1px solid ${C.red}40`,borderRadius:5,fontSize:11,color:C.red}}>{signupError}</div>}
                <button onClick={handleSignup} style={{width:"100%",padding:"10px 0",borderRadius:5,background:C.amber,border:"none",color:C.bg,fontFamily:FM,fontSize:11,cursor:"pointer",fontWeight:700,letterSpacing:"0.08em"}}>CREATE ACCOUNT & SIGN IN →</button>
              </div>
            )}
          </>
        )}

        <div style={{marginTop:20,fontSize:9,color:C.muted,letterSpacing:"0.1em"}}>ALL ACTIVITY IS LOGGED PER RECRUITER</div>
      </div>
    );
  }

  // ─── Nav ──────────────────────────────────────────────────────────────────────
  const NavItem = ({ id, label, icon, badge }) => (
    <button onClick={()=>setTab(id)} style={{
      display:"flex",alignItems:"center",gap:10,width:"100%",
      padding:"9px 14px",borderRadius:6,border:"none",cursor:"pointer",
      background:tab===id?C.amber+"15":"transparent",
      color:tab===id?C.amber:C.muted,
      fontFamily:FM,fontSize:11,letterSpacing:"0.06em",
      transition:"all 0.15s",textAlign:"left",
      borderLeft:tab===id?`2px solid ${C.amber}`:"2px solid transparent",
    }}>
      <span style={{opacity:0.7}}>{icon}</span>
      <span style={{flex:1}}>{label.toUpperCase()}</span>
      {badge!=null && badge>0 && <span style={{fontSize:9,background:C.red+"30",color:C.red,padding:"1px 5px",borderRadius:3}}>{badge}</span>}
    </button>
  );

  const pendingInterviews = interviews.filter(i=>i.recruiterId===currentRecruiter.id&&i.status==="scheduled").length;
  const myCandsPending    = myCandidates.filter(c=>c.interviewStatus==="pending").length;
  const aiScanned         = myCandidates.filter(c=>c.source==="ai").length;

  // ─── Report filtered data ────────────────────────────────────────────────────
  const reportData = candidates.filter(c => {
    if (rptJob  !== "all" && c.jobId !== rptJob)           return false;
    if (rptRec  !== "all" && c.recruiterId !== rptRec)     return false;
    if (rptStat !== "all" && c.interviewStatus !== rptStat) return false;
    return true;
  });

  const LABEL = { dashboard:"Overview", upload:"Upload Resume", pipeline:"Pipeline", interviews:"Interviews", report:"Activity Report", candidates:"My Candidates", jobs:"Job Postings", aiscreened:"AI Screened Resumes" };

  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:FM,color:C.cream,overflow:"hidden",fontSize:14}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}} .fi{animation:fadeIn 0.25s ease} input::placeholder{color:${C.muted}} ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}`}</style>

      {/* Sidebar */}
      <div style={{width:192,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"16px 14px 12px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontFamily:FD,fontSize:20,color:C.amber,lineHeight:1}}>CEI Recruiting</div>
          <div style={{fontSize:8,color:C.muted,marginTop:2,letterSpacing:"0.14em"}}>RECRUITMENT · HR · AI</div>
        </div>
        <div style={{padding:"10px 8px",flex:1,overflowY:"auto"}}>
          <div style={{fontSize:8,color:C.muted,padding:"0 8px 5px",letterSpacing:"0.14em"}}>MY WORKSPACE</div>
          <NavItem id="dashboard"   label="Dashboard"     icon="◈" />
          <NavItem id="candidates"  label="My Candidates" icon="○" badge={myCandsPending} />
          <NavItem id="upload"      label="Upload Resume"  icon="⬆" />
          <NavItem id="aiscreened"  label="AI Screened"    icon="🤖" badge={aiScanned||null} />
          <NavItem id="jobs"        label="Job Postings"   icon="◇" badge={jobs.filter(j=>j.status==="Active").length||null} />
          <NavItem id="pipeline"    label="Full Pipeline"  icon="⬡" />
          <NavItem id="interviews"  label="Interviews"     icon="◻" badge={pendingInterviews||null} />
          <div style={{fontSize:8,color:C.muted,padding:"10px 8px 5px",letterSpacing:"0.14em"}}>TEAM</div>
          <NavItem id="report"      label="Activity Report" icon="◇" />
        </div>
        <div style={{padding:12,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <Avatar text={currentRecruiter.initials} size={28} color={currentRecruiter.color}/>
            <div>
              <div style={{fontSize:11,color:C.cream}}>{currentRecruiter.name}</div>
              <div style={{fontSize:9,color:C.muted}}>{currentRecruiter.role}</div>
            </div>
          </div>
          <button onClick={()=>{setCurrentRecruiter(null);setTab("dashboard");}} style={{width:"100%",padding:"5px 0",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:9,cursor:"pointer",letterSpacing:"0.06em"}}>SWITCH RECRUITER</button>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
        {/* Topbar */}
        <div style={{padding:"10px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.surface,flexShrink:0}}>
          <span style={{fontFamily:FD,fontSize:20,color:C.cream}}>{LABEL[tab]}</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <Badge label={`${myCandidates.length} my candidates`} color={currentRecruiter.color}/>
            <Badge label={`${candidates.length} total`} color={C.muted}/>
          </div>
        </div>

        <div style={{flex:1,padding:22,overflow:"auto"}}>

          {/* ══ DASHBOARD ══ */}
          {tab==="dashboard" && (
            <div className="fi">
              {/* Overall status metrics — all candidates */}
              <div style={{marginBottom:8,fontSize:9,color:C.muted,letterSpacing:"0.12em"}}>ALL CANDIDATES OVERVIEW</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:18}}>
                {[
                  {label:"Total",    value:candidates.length,                                          color:C.muted},
                  {label:"Approved", value:candidates.filter(c=>c.interviewStatus==="approved").length, color:C.green},
                  {label:"Rejected", value:candidates.filter(c=>c.interviewStatus==="rejected").length, color:C.red},
                  {label:"On Hold",  value:candidates.filter(c=>c.interviewStatus==="hold").length,     color:C.orange},
                  {label:"Offered",  value:candidates.filter(c=>c.stage==="Offer").length,              color:C.teal},
                  {label:"Hired",    value:candidates.filter(c=>c.stage==="Hired").length,              color:C.green},
                ].map(m=>(
                  <div key={m.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",borderTop:`2px solid ${m.color}`}}>
                    <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>{m.label.toUpperCase()}</div>
                    <div style={{fontFamily:FD,fontSize:30,color:m.color,lineHeight:1}}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Interview rounds breakdown */}
              <div style={{marginBottom:8,fontSize:9,color:C.muted,letterSpacing:"0.12em"}}>INTERVIEW ROUNDS BREAKDOWN</div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,marginBottom:18,overflow:"hidden"}}>
                {/* Header */}
                <div style={{display:"grid",gridTemplateColumns:"1.8fr repeat(4,1fr)",gap:0,borderBottom:`1px solid ${C.border}`}}>
                  <div style={{padding:"10px 14px",fontSize:9,color:C.muted,letterSpacing:"0.1em"}}>CANDIDATE</div>
                  {INTERVIEW_LEVELS.map(lvl=>(
                    <div key={lvl.id} style={{padding:"10px 10px",fontSize:9,color:lvl.color,letterSpacing:"0.08em",borderLeft:`1px solid ${C.border}`,textAlign:"center"}}>{lvl.label.toUpperCase()}</div>
                  ))}
                  <div style={{padding:"10px 10px",fontSize:9,color:C.muted,letterSpacing:"0.08em",borderLeft:`1px solid ${C.border}`,textAlign:"center"}}>STATUS</div>
                </div>
                {candidates.length===0
                  ? <div style={{padding:"20px",textAlign:"center",fontSize:11,color:C.muted}}>No candidates yet.</div>
                  : candidates.map((c,i)=>{
                    const job = jobs.find(j=>j.id===c.jobId);
                    const sm = STATUS_META[c.interviewStatus];
                    return (
                      <div key={c.id} style={{display:"grid",gridTemplateColumns:"1.8fr repeat(4,1fr)",gap:0,borderBottom:i<candidates.length-1?`1px solid ${C.border}`:"none",alignItems:"center"}}>
                        <div style={{padding:"9px 14px",display:"flex",gap:8,alignItems:"center"}}>
                          <Avatar text={c.avatar} size={24} color={sc(c.score)}/>
                          <div>
                            <div style={{fontSize:11,color:C.cream}}>{c.name}</div>
                            <div style={{fontSize:9,color:C.muted}}>{job?.title||"—"}</div>
                          </div>
                        </div>
                        {INTERVIEW_LEVELS.map(lvl=>{
                          const round = interviews.find(i=>i.candidateId===c.id&&i.level===lvl.id);
                          const rst = round ? INTERVIEW_STATUS_META[round.status] : null;
                          return (
                            <div key={lvl.id} style={{padding:"9px 10px",borderLeft:`1px solid ${C.border}`,textAlign:"center"}}>
                              {round ? (
                                <span style={{padding:"2px 7px",borderRadius:4,fontSize:9,background:rst?.color+"20",color:rst?.color,fontFamily:FM,border:`0.5px solid ${rst?.color}40`,letterSpacing:"0.05em"}}>{rst?.label}</span>
                              ) : (
                                <span style={{fontSize:9,color:C.faint}}>—</span>
                              )}
                            </div>
                          );
                        })}
                        <div style={{padding:"9px 10px",borderLeft:`1px solid ${C.border}`,textAlign:"center"}}>
                          <span style={{padding:"2px 7px",borderRadius:4,fontSize:9,background:sm?.color+"20",color:sm?.color,fontFamily:FM,border:`0.5px solid ${sm?.color}40`,letterSpacing:"0.05em"}}>{sm?.label}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* My personal stats + team */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1.6fr",gap:14}}>
                <div>
                  <div style={{marginBottom:8,fontSize:9,color:C.muted,letterSpacing:"0.12em"}}>YOUR STATS — {currentRecruiter.name.toUpperCase()}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {[
                      {label:"My Candidates", value:myCandidates.length,                                                                                              color:currentRecruiter.color},
                      {label:"Approved",       value:myCandidates.filter(c=>c.interviewStatus==="approved").length,                                                    color:C.green},
                      {label:"Rejected",       value:myCandidates.filter(c=>c.interviewStatus==="rejected").length,                                                    color:C.red},
                      {label:"On Hold",        value:myCandidates.filter(c=>c.interviewStatus==="hold").length,                                                        color:C.orange},
                      {label:"Level 1 Rounds", value:interviews.filter(i=>i.recruiterId===currentRecruiter.id&&i.level==="l1").length,                                 color:C.blue},
                      {label:"Level 2 Rounds", value:interviews.filter(i=>i.recruiterId===currentRecruiter.id&&i.level==="l2").length,                                 color:C.purple},
                      {label:"Offer Stage",    value:myCandidates.filter(c=>c.stage==="Offer").length,                                                                 color:C.teal},
                      {label:"Hired",          value:myCandidates.filter(c=>c.stage==="Hired").length,                                                                 color:C.green},
                    ].map(m=>(
                      <div key={m.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:13,color:C.muted}}>{m.label}</span>
                        <span style={{fontFamily:FD,fontSize:22,color:m.color,lineHeight:1}}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{marginBottom:8,fontSize:9,color:C.muted,letterSpacing:"0.12em"}}>UPCOMING INTERVIEWS</div>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    {interviews.filter(i=>i.recruiterId===currentRecruiter.id).length===0
                      ? <div style={{padding:"20px",textAlign:"center",fontSize:11,color:C.muted}}>No interviews scheduled yet.</div>
                      : interviews.filter(i=>i.recruiterId===currentRecruiter.id).map(iv=>{
                        const c = candidates.find(x=>x.id===iv.candidateId);
                        const job = jobs.find(j=>j.id===iv.jobId);
                        const lvl = INTERVIEW_LEVELS.find(l=>l.id===iv.level);
                        return (
                          <div key={iv.id} style={{padding:"9px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
                            <Avatar text={ini(iv.candidateName)} size={28} color={sc(c?.score||70)}/>
                            <div style={{flex:1}}>
                              <div style={{fontSize:11,color:C.cream}}>{iv.candidateName}</div>
                              <div style={{fontSize:9,color:C.muted}}>{iv.date} · {iv.time} · {job?.title}</div>
                            </div>
                            {lvl && <Badge label={lvl.label} color={lvl.color}/>}
                            <Badge label={iv.status} color={(INTERVIEW_STATUS_META[iv.status]||INTERVIEW_STATUS_META.scheduled).color}/>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ MY CANDIDATES ══ */}
          {tab==="candidates" && (
            <div className="fi">
              {/* Filter pills */}
              <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                {["all","pending","approved","rejected","hold"].map(s=>(
                  <button key={s} onClick={()=>{}} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${s==="all"?C.amber:STATUS_META[s]?.color||C.border}`,background:"transparent",color:s==="all"?C.amber:STATUS_META[s]?.color||C.muted,fontFamily:FM,fontSize:13,cursor:"pointer"}}>
                    {s==="all"?"ALL":STATUS_META[s]?.label?.toUpperCase()}
                  </button>
                ))}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {myCandidates.map(c=>{
                  const job        = jobs.find(j=>j.id===c.jobId);
                  const sm         = STATUS_META[c.interviewStatus]||STATUS_META.pending;
                  const isEditing  = editingCand === c.id;
                  const isExpanded = expandedCandId === c.id;
                  const iStyle     = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"8px 12px",color:C.cream,fontFamily:FM,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"};

                  return (
                    <div key={c.id} style={{background:C.card,border:`1px solid ${isEditing?C.amber+"80":isExpanded?C.blue+"50":C.border}`,borderRadius:10,overflow:"hidden",transition:"border-color 0.15s"}}>

                      {/* ── Summary Row (always visible, clickable) ── */}
                      {!isEditing && (
                        <div onClick={()=>setExpandedCandId(isExpanded?null:c.id)}
                          style={{padding:"14px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"center",background:isExpanded?C.faint:"transparent"}}>
                          <Avatar text={c.avatar||ini(c.name||"?")} size={42} color={sc(c.score)}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:16,color:C.cream,fontWeight:600}}>{c.name}</div>
                            <div style={{fontSize:13,color:C.muted,marginTop:2}}>{c.role}{c.currentCompany?` @ ${c.currentCompany}`:""} · {c.exp}</div>
                            <div style={{fontSize:12,color:C.muted,marginTop:1}}>{job?.title||"No job assigned"}</div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
                            <div style={{display:"flex",gap:6}}>
                              <Badge label={c.stage} color={STAGE_META[c.stage]?.color||C.muted}/>
                              <Badge label={sm.label} color={sm.color}/>
                              {c.source==="ai"&&<Badge label="AI" color={C.purple}/>}
                              {c.recommendation&&<Badge label={c.recommendation} color={c.recommendation==="shortlist"?C.green:c.recommendation==="reject"?C.red:C.orange}/>}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontFamily:FD,fontSize:22,color:sc(c.score)}}>{c.score}%</span>
                              <span style={{fontSize:16,color:C.muted}}>{isExpanded?"▲":"▼"}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Compact score bar (collapsed) ── */}
                      {!isEditing && !isExpanded && (
                        <div style={{padding:"0 16px 12px 16px"}}>
                          <Bar val={c.score}/>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
                            {(c.skills||[]).slice(0,5).map(s=><Pill key={s} label={s}/>)}
                            {(c.skills||[]).length>5&&<span style={{fontSize:12,color:C.muted}}>+{(c.skills||[]).length-5} more</span>}
                          </div>
                        </div>
                      )}

                      {/* ── Expanded full profile ── */}
                      {!isEditing && isExpanded && (
                        <div style={{padding:"16px",borderTop:`1px solid ${C.border}`}}>

                          {/* Contact info grid */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16,padding:"14px",background:C.card,borderRadius:8,border:`1px solid ${C.border}`}}>
                            <div>
                              <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:4}}>FULL NAME</div>
                              <div style={{fontSize:15,color:C.cream,fontWeight:600}}>{c.name||"—"}</div>
                            </div>
                            <div>
                              <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:4}}>CURRENT ROLE</div>
                              <div style={{fontSize:14,color:C.cream}}>{c.role||"—"}{c.currentCompany?<span style={{color:C.muted}}> @ {c.currentCompany}</span>:""}</div>
                            </div>
                            <div>
                              <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:4}}>EMAIL ID</div>
                              <div style={{fontSize:14,color:c.email?C.teal:C.muted,fontWeight:c.email?500:400}}>{c.email||"Not found in resume"}</div>
                            </div>
                            <div>
                              <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:4}}>PHONE NUMBER</div>
                              <div style={{fontSize:14,color:c.phone?C.teal:C.muted,fontWeight:c.phone?500:400}}>{c.phone||"Not found in resume"}</div>
                            </div>
                            <div>
                              <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:4}}>LOCATION</div>
                              <div style={{fontSize:14,color:c.location?C.cream:C.muted}}>{c.location||"Not found in resume"}</div>
                            </div>
                            <div>
                              <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:4}}>EXPERIENCE</div>
                              <div style={{fontSize:14,color:C.cream}}>{c.exp||"—"}</div>
                            </div>
                            {c.education&&c.education!=="—"&&(
                              <div style={{gridColumn:"1/-1"}}>
                                <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:4}}>EDUCATION</div>
                                <div style={{fontSize:14,color:C.cream}}>{c.education}</div>
                              </div>
                            )}
                            {c.certifications?.length>0&&(
                              <div style={{gridColumn:"1/-1"}}>
                                <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:6}}>CERTIFICATIONS</div>
                                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{c.certifications.map(x=><span key={x} style={{padding:"3px 10px",borderRadius:4,fontSize:12,background:C.teal+"15",color:C.teal,fontFamily:FM,border:`0.5px solid ${C.teal}40`}}>{x}</span>)}</div>
                              </div>
                            )}
                            {c.languages?.length>0&&(
                              <div style={{gridColumn:"1/-1"}}>
                                <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:6}}>LANGUAGES</div>
                                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{c.languages.map(l=><span key={l} style={{padding:"3px 10px",borderRadius:4,fontSize:12,background:C.purple+"15",color:C.purple,fontFamily:FM,border:`0.5px solid ${C.purple}40`}}>{l}</span>)}</div>
                              </div>
                            )}
                          </div>

                          {/* Match % bars */}
                          {(c.primaryMatchPct>0||c.score>0)&&(
                            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
                              {[
                                {l:"OVERALL FIT",    v:c.score||0,            col:sc(c.score||0),            sub:null},
                                {l:"PRIMARY SKILLS", v:c.primaryMatchPct||0,  col:sc(c.primaryMatchPct||0),  sub:`${c.primarySkillsMatched||0}/${c.primarySkillsTotal||0} matched`},
                                {l:"SECONDARY",      v:c.secondaryMatchPct||0,col:C.blue,                    sub:c.experienceMatch||null},
                              ].map(m=>(
                                <div key={m.l} style={{padding:"10px 12px",background:m.col+"12",border:`1px solid ${m.col}30`,borderRadius:8,textAlign:"center"}}>
                                  <div style={{fontFamily:FD,fontSize:30,color:m.col,lineHeight:1}}>{m.v}%</div>
                                  <div style={{fontSize:11,color:C.muted,marginTop:4,letterSpacing:"0.06em"}}>{m.l}</div>
                                  {m.sub&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{m.sub}</div>}
                                  <div style={{height:3,background:C.border,borderRadius:2,marginTop:6,overflow:"hidden"}}>
                                    <div style={{width:`${m.v}%`,height:"100%",background:m.col,borderRadius:2}}/>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Skills */}
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                            {(c.skills||[]).map(s=><Pill key={s} label={s}/>)}
                          </div>

                          {/* Summary */}
                          {c.summary&&<div style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:12,padding:"10px 12px",background:C.faint,borderRadius:6}}>{c.summary}</div>}

                          {/* Strengths + Red flags */}
                          {(c.strengths?.length>0||c.redFlags?.length>0)&&(
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                              {c.strengths?.length>0&&(
                                <div style={{padding:"10px 12px",background:C.green+"10",border:`1px solid ${C.green}30`,borderRadius:8}}>
                                  <div style={{fontSize:11,color:C.green,letterSpacing:"0.08em",marginBottom:6}}>STRENGTHS</div>
                                  {c.strengths.map(s=><div key={s} style={{fontSize:13,color:C.cream,marginBottom:3}}>• {s}</div>)}
                                </div>
                              )}
                              {c.redFlags?.length>0&&(
                                <div style={{padding:"10px 12px",background:C.red+"10",border:`1px solid ${C.red}30`,borderRadius:8}}>
                                  <div style={{fontSize:11,color:C.red,letterSpacing:"0.08em",marginBottom:6}}>RED FLAGS</div>
                                  {c.redFlags.map(f=><div key={f} style={{fontSize:13,color:C.muted,marginBottom:3}}>• {f}</div>)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Fit reason */}
                          {c.fitReason&&(
                            <div style={{padding:"10px 12px",background:C.faint,borderRadius:6,fontSize:13,color:C.muted,marginBottom:14}}>
                              <span style={{color:C.amber,fontWeight:600}}>AI Assessment: </span>{c.fitReason}
                            </div>
                          )}

                          {/* Interview rounds */}
                          <div style={{marginBottom:14}}>
                            <div style={{fontSize:12,color:C.muted,letterSpacing:"0.08em",marginBottom:8,display:"flex",justifyContent:"space-between"}}>
                              <span>INTERVIEW ROUNDS</span>
                              <span style={{color:C.amber}}>{interviews.filter(i=>i.candidateId===c.id).length} SCHEDULED</span>
                            </div>
                            <div style={{display:"flex",gap:8}}>
                              {INTERVIEW_LEVELS.map(lvl=>{
                                const round=interviews.find(i=>i.candidateId===c.id&&i.level===lvl.id);
                                const rs=round?INTERVIEW_STATUS_META[round.status]:null;
                                return (
                                  <div key={lvl.id} style={{flex:1,background:round?lvl.color+"12":C.faint,border:`1px solid ${round?lvl.color+"50":C.border}`,borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                                    <div style={{fontSize:13,color:lvl.color,fontWeight:700,marginBottom:5}}>{lvl.label}</div>
                                    {round?(
                                      <>
                                        <div style={{fontSize:12,color:C.muted,marginBottom:3}}>{round.date}</div>
                                        <div style={{fontSize:12,color:C.muted,marginBottom:6}}>{round.time} · {round.type}</div>
                                        <select value={round.status} onChange={e=>updateInterview(round.id,{status:e.target.value})}
                                          style={{width:"100%",background:rs?.color+"15",border:`1px solid ${rs?.color}50`,borderRadius:4,color:rs?.color,fontFamily:FM,fontSize:12,padding:"4px 6px",cursor:"pointer",outline:"none",fontWeight:700}}>
                                          {["scheduled","completed","approved","cancelled"].map(s=><option key={s} value={s}>{INTERVIEW_STATUS_META[s].label}</option>)}
                                        </select>
                                      </>
                                    ):(
                                      <div style={{fontSize:12,color:C.muted,opacity:0.5}}>Not scheduled</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Status + Stage controls */}
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                            <span style={{fontSize:13,color:C.muted}}>STATUS:</span>
                            {["approved","rejected","hold","pending"].map(st=>(
                              <button key={st} onClick={()=>updateStatus(c.id,st)}
                                style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${STATUS_META[st].color}${c.interviewStatus===st?"":"40"}`,background:c.interviewStatus===st?STATUS_META[st].color+"20":"transparent",color:STATUS_META[st].color,fontFamily:FM,fontSize:12,cursor:"pointer",fontWeight:c.interviewStatus===st?"700":"400"}}>
                                {STATUS_META[st].label.toUpperCase()}
                              </button>
                            ))}
                            <span style={{fontSize:13,color:C.muted,marginLeft:4}}>STAGE:</span>
                            <select value={c.stage} onChange={e=>updateStage(c.id,e.target.value)} style={{background:C.faint,border:`1px solid ${C.border}`,borderRadius:6,color:C.cream,fontFamily:FM,fontSize:13,padding:"5px 10px",cursor:"pointer"}}>
                              {STAGES.map(s=><option key={s}>{s}</option>)}
                            </select>
                            <button onClick={()=>{setEditingCand(c.id);setExpandedCandId(null);setEditForm({name:c.name,role:c.role||"",exp:c.exp||"",email:c.email||"",phone:c.phone||"",location:c.location||"",interviewStatus:c.interviewStatus||"pending",stage:c.stage||"Applied",skills:(c.skills||[]).join(", ")});}}
                              style={{marginLeft:"auto",padding:"6px 16px",borderRadius:6,border:`1px solid ${C.amber}60`,background:C.amber+"12",color:C.amber,fontFamily:FM,fontSize:13,cursor:"pointer",fontWeight:600}}>✏ EDIT DETAILS</button>
                          </div>
                        </div>
                      )}

                      {/* ── Edit Form ── */}
                      {isEditing && (
                        <div style={{padding:"16px"}}>
                          <div style={{fontSize:14,color:C.amber,fontWeight:700,marginBottom:16}}>EDITING — {c.name}</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                            {[{k:"name",l:"FULL NAME"},{k:"role",l:"CURRENT ROLE"},{k:"email",l:"EMAIL ID"},{k:"phone",l:"PHONE NUMBER"},{k:"location",l:"LOCATION"},{k:"exp",l:"EXPERIENCE"}].map(({k,l})=>(
                              <div key={k}>
                                <div style={{fontSize:12,color:C.muted,letterSpacing:"0.08em",marginBottom:5}}>{l}</div>
                                <input value={editForm[k]||""} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))} style={iStyle}/>
                              </div>
                            ))}
                            <div>
                              <div style={{fontSize:12,color:C.muted,letterSpacing:"0.08em",marginBottom:5}}>INTERVIEW STATUS</div>
                              <select value={editForm.interviewStatus} onChange={e=>setEditForm(f=>({...f,interviewStatus:e.target.value}))} style={{...iStyle,cursor:"pointer"}}>
                                {["pending","approved","rejected","hold"].map(s=><option key={s} value={s}>{STATUS_META[s].label}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{fontSize:12,color:C.muted,letterSpacing:"0.08em",marginBottom:5}}>PIPELINE STAGE</div>
                              <select value={editForm.stage} onChange={e=>setEditForm(f=>({...f,stage:e.target.value}))} style={{...iStyle,cursor:"pointer"}}>
                                {STAGES.map(s=><option key={s}>{s}</option>)}
                              </select>
                            </div>
                            <div style={{gridColumn:"1/-1"}}>
                              <div style={{fontSize:12,color:C.muted,letterSpacing:"0.08em",marginBottom:5}}>SKILLS <span style={{opacity:0.6}}>(comma-separated)</span></div>
                              <input value={editForm.skills||""} onChange={e=>setEditForm(f=>({...f,skills:e.target.value}))} placeholder="React, TypeScript, Node.js" style={iStyle}/>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>saveEditCand(c.id)} style={{padding:"8px 20px",borderRadius:6,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:13,cursor:"pointer",fontWeight:700}}>SAVE CHANGES</button>
                            <button onClick={()=>setEditingCand(null)} style={{padding:"8px 16px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:13,cursor:"pointer"}}>CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {myCandidates.length===0 && (
                  <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:10,padding:40,textAlign:"center",color:C.muted}}>
                    <div style={{fontSize:32,opacity:0.15,marginBottom:10}}>○</div>
                    <div style={{fontSize:15,marginBottom:6}}>No candidates yet</div>
                    <div style={{fontSize:13,marginBottom:16}}>Upload resumes to get started</div>
                    <button onClick={()=>setTab("upload")} style={{padding:"8px 20px",borderRadius:6,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:13,cursor:"pointer",fontWeight:700}}>⬆ UPLOAD RESUMES →</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ UPLOAD ══ */}
          {tab==="upload" && (
            <div className="fi" style={{maxWidth:800}}>

              {/* Step 1 — Job selector */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:10}}>STEP 1 — SELECT TARGET ROLE</div>
                {jobs.filter(j=>j.status==="Active").length===0 ? (
                  <div style={{padding:"16px",textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:6}}>
                    <div style={{fontSize:11,color:C.muted,marginBottom:8}}>No active jobs yet.</div>
                    <button onClick={()=>setTab("jobs")} style={{padding:"6px 14px",borderRadius:4,background:C.amber,border:"none",color:C.bg,fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700,letterSpacing:"0.06em"}}>CREATE A JOB FIRST →</button>
                  </div>
                ) : (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                    {jobs.filter(j=>j.status==="Active").map(j=>(
                      <button key={j.id} onClick={()=>{setUploadJob(j.id);setBulkQueue([]);setUploadResult(null);setUploadError(null);}}
                        style={{padding:"10px 12px",borderRadius:6,border:`1px solid ${uploadJob===j.id?C.amber+"80":C.border}`,background:uploadJob===j.id?C.amber+"12":"transparent",color:uploadJob===j.id?C.amber:C.muted,fontFamily:FM,fontSize:10,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
                        <div style={{fontSize:11,color:uploadJob===j.id?C.amber:C.cream,marginBottom:2}}>{j.title}</div>
                        <div style={{fontSize:9,opacity:0.7}}>{j.dept} · {j.location}</div>
                        <div style={{fontSize:9,marginTop:4,color:j.id===uploadJob?C.amber:C.muted}}>{candidates.filter(c=>c.jobId===j.id).length} screened</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2 — Drop zone (multi-file) */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em"}}>STEP 2 — DROP RESUMES (SINGLE OR BULK) · Uploading as <span style={{color:currentRecruiter.color}}>{currentRecruiter.name}</span></div>
                  {bulkQueue.length>0 && (
                    <button onClick={()=>{setBulkQueue([]);bulkQueueRef.current=[];setUploadError(null);}}
                      style={{padding:"3px 10px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:9,cursor:"pointer",letterSpacing:"0.06em"}}>CLEAR QUEUE</button>
                  )}
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e=>{e.preventDefault();setDragOver(true);}}
                  onDragLeave={()=>setDragOver(false)}
                  onDrop={e=>{
                    e.preventDefault(); setDragOver(false);
                    const files=e.dataTransfer.files;
                    if(files.length>1) handleBulkFiles(files);
                    else if(files.length===1) handleFile(files[0]);
                  }}
                  onClick={()=>fileRef.current?.click()}
                  style={{border:`1.5px dashed ${dragOver?C.amber:C.border}`,borderRadius:8,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:dragOver?C.amber+"08":C.surface,transition:"all 0.2s",marginBottom:bulkQueue.length>0?12:0}}>
                  <input ref={fileRef} type="file" accept=".pdf" multiple style={{display:"none"}}
                    onChange={e=>{
                      const files=e.target.files;
                      if(!files||files.length===0) return;
                      if(files.length>1) handleBulkFiles(files);
                      else handleFile(files[0]);
                      e.target.value="";
                    }}/>
                  {uploading ? (
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                      <Spin/>
                      <div style={{fontSize:12,color:C.amber}}>Claude is reading the resume...</div>
                      <div style={{fontSize:10,color:C.muted}}>Extracting · Scoring · Adding to pipeline</div>
                    </div>
                  ) : (
                    <>
                      <div style={{fontSize:28,marginBottom:8,opacity:0.35}}>⬆</div>
                      <div style={{fontSize:13,color:C.cream,marginBottom:4}}>Drop PDFs here or click to browse</div>
                      <div style={{fontSize:10,color:C.muted,marginBottom:4}}>Select <strong style={{color:C.amber}}>multiple files</strong> at once for bulk screening</div>
                      <div style={{fontSize:9,color:C.muted}}>Claude parses each resume · scores fit · adds to pipeline automatically</div>
                    </>
                  )}
                </div>
                {uploadError && <div style={{marginTop:8,padding:"8px 12px",background:C.red+"15",border:`1px solid ${C.red}40`,borderRadius:6,fontSize:11,color:C.red}}>{uploadError}</div>}

                {/* Bulk queue progress */}
                {bulkQueue.length>0 && (
                  <div>
                    {/* Summary bar */}
                    <div style={{display:"flex",gap:14,marginBottom:10,padding:"8px 12px",background:C.faint,borderRadius:6,alignItems:"center"}}>
                      <span style={{fontSize:10,color:C.cream,flex:1}}>
                        {bulkProcessing ? "Processing resumes..." : "Batch complete"}
                      </span>
                      <span style={{fontSize:10,color:C.muted}}>{bulkQueue.filter(q=>q.status==="queued").length} queued</span>
                      <span style={{fontSize:10,color:C.amber}}>{bulkQueue.filter(q=>q.status==="processing").length} processing</span>
                      <span style={{fontSize:10,color:C.green}}>{bulkQueue.filter(q=>q.status==="done").length} done</span>
                      <span style={{fontSize:10,color:C.red}}>{bulkQueue.filter(q=>q.status==="error").length} errors</span>
                    </div>

                    {/* Progress bar */}
                    <div style={{height:4,background:C.border,borderRadius:2,marginBottom:12,overflow:"hidden"}}>
                      <div style={{
                        width:`${Math.round((bulkQueue.filter(q=>q.status==="done"||q.status==="error").length/bulkQueue.length)*100)}%`,
                        height:"100%",background:C.amber,borderRadius:2,transition:"width 0.4s ease"
                      }}/>
                    </div>

                    {/* Per-file rows */}
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {bulkQueue.map((item,i)=>{
                        const stColor = {queued:C.muted, processing:C.amber, done:C.green, error:C.red}[item.status];
                        const stIcon  = {queued:"○", processing:"◌", done:"●", error:"✕"}[item.status];
                        return (
                          <div key={item.id} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 12px",background:C.surface,borderRadius:6,border:`1px solid ${item.status==="done"?C.green+"30":item.status==="error"?C.red+"30":C.border}`}}>
                            {/* Status icon + spin */}
                            <div style={{width:20,height:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                              {item.status==="processing"
                                ? <Spin/>
                                : <span style={{fontSize:12,color:stColor}}>{stIcon}</span>
                              }
                            </div>
                            {/* File number */}
                            <span style={{fontSize:9,color:C.muted,fontFamily:FM,width:20,flexShrink:0}}>#{i+1}</span>
                            {/* File name */}
                            <span style={{fontSize:10,color:C.cream,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</span>
                            {/* Result: parsed name + score */}
                            {item.result && (
                              <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                                <span style={{fontSize:10,color:C.cream}}>{item.result.name}</span>
                                <span style={{fontSize:11,color:sc(item.result.score),fontFamily:FD}}>{item.result.score}</span>
                                <span style={{padding:"1px 7px",borderRadius:4,fontSize:9,background:C.green+"18",color:C.green,fontFamily:FM,border:`0.5px solid ${C.green}40`,letterSpacing:"0.05em"}}>ADDED</span>
                              </div>
                            )}
                            {/* Error */}
                            {item.error && (
                              <span style={{fontSize:9,color:C.red,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.error}</span>
                            )}
                            {/* Status label */}
                            <span style={{fontSize:9,color:stColor,fontFamily:FM,letterSpacing:"0.06em",minWidth:64,textAlign:"right",textTransform:"uppercase"}}>{item.status}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Done actions */}
                    {!bulkProcessing && bulkQueue.length>0 && (
                      <div style={{display:"flex",gap:8,marginTop:12}}>
                        <button onClick={()=>setTab("candidates")} style={{padding:"7px 16px",borderRadius:4,background:C.amber,border:"none",color:C.bg,fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700,letterSpacing:"0.06em"}}>
                          VIEW {bulkQueue.filter(q=>q.status==="done").length} CANDIDATES →
                        </button>
                        <button onClick={()=>setTab("pipeline")} style={{padding:"7px 16px",borderRadius:4,border:`0.5px solid ${C.amber}60`,background:"transparent",color:C.amber,fontFamily:FM,fontSize:10,cursor:"pointer",letterSpacing:"0.06em"}}>
                          OPEN PIPELINE →
                        </button>
                        <button onClick={()=>{setBulkQueue([]);bulkQueueRef.current=[];}} style={{padding:"7px 14px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:10,cursor:"pointer",letterSpacing:"0.06em"}}>
                          SCREEN MORE
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Single upload result card */}
              {uploadResult && bulkQueue.length===0 && (
                <div className="fi" style={{background:C.card,border:`1px solid ${C.green}50`,borderRadius:8,padding:16,marginBottom:12}}>
                  {/* Header row */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                    <div style={{fontSize:9,color:C.green,letterSpacing:"0.1em"}}>✓ ADDED TO PIPELINE · {currentRecruiter.name}</div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      {uploadResult.recommendation && (
                        <Badge label={uploadResult.recommendation.toUpperCase()} color={uploadResult.recommendation==="shortlist"?C.green:uploadResult.recommendation==="reject"?C.red:C.orange}/>
                      )}
                      <Badge label={`${uploadResult.score}/100 OVERALL FIT`} color={sc(uploadResult.score)}/>
                    </div>
                  </div>

                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <Avatar text={uploadResult.avatar} size={44} color={sc(uploadResult.score)}/>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:FD,fontSize:18,color:C.cream,marginBottom:2}}>{uploadResult.name}</div>
                      <div style={{fontSize:10,color:C.muted,marginBottom:10}}>{uploadResult.role} · {uploadResult.exp} · {jobs.find(j=>j.id===uploadJob)?.title}</div>

                      {/* Match percentage bars */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                        {/* Overall fit */}
                        <div style={{padding:"10px 12px",background:sc(uploadResult.score)+"12",border:`1px solid ${sc(uploadResult.score)}40`,borderRadius:8,textAlign:"center"}}>
                          <div style={{fontFamily:FD,fontSize:32,color:sc(uploadResult.score),lineHeight:1}}>{uploadResult.score}%</div>
                          <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginTop:4}}>OVERALL FIT</div>
                          <div style={{height:3,background:C.border,borderRadius:2,marginTop:6,overflow:"hidden"}}>
                            <div style={{width:`${uploadResult.score}%`,height:"100%",background:sc(uploadResult.score),borderRadius:2}}/>
                          </div>
                        </div>
                        {/* Primary skills match */}
                        <div style={{padding:"10px 12px",background:sc(uploadResult.primaryMatchPct||0)+"12",border:`1px solid ${sc(uploadResult.primaryMatchPct||0)}40`,borderRadius:8,textAlign:"center"}}>
                          <div style={{fontFamily:FD,fontSize:32,color:sc(uploadResult.primaryMatchPct||0),lineHeight:1}}>{uploadResult.primaryMatchPct||0}%</div>
                          <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginTop:4}}>PRIMARY SKILLS</div>
                          <div style={{fontSize:9,color:C.muted,marginTop:2}}>{uploadResult.primarySkillsMatched||0}/{uploadResult.primarySkillsTotal||0} matched</div>
                          <div style={{height:3,background:C.border,borderRadius:2,marginTop:4,overflow:"hidden"}}>
                            <div style={{width:`${uploadResult.primaryMatchPct||0}%`,height:"100%",background:sc(uploadResult.primaryMatchPct||0),borderRadius:2}}/>
                          </div>
                        </div>
                        {/* Secondary skills match */}
                        <div style={{padding:"10px 12px",background:C.blue+"12",border:`1px solid ${C.blue}40`,borderRadius:8,textAlign:"center"}}>
                          <div style={{fontFamily:FD,fontSize:32,color:C.blue,lineHeight:1}}>{uploadResult.secondaryMatchPct||0}%</div>
                          <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginTop:4}}>SECONDARY SKILLS</div>
                          <div style={{fontSize:9,color:C.muted,marginTop:2}}>{uploadResult.experienceMatch||"—"} experience</div>
                          <div style={{height:3,background:C.border,borderRadius:2,marginTop:4,overflow:"hidden"}}>
                            <div style={{width:`${uploadResult.secondaryMatchPct||0}%`,height:"100%",background:C.blue,borderRadius:2}}/>
                          </div>
                        </div>
                      </div>

                      {/* Skill-by-skill breakdown */}
                      {uploadResult.skillMatch?.length>0 && (
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:8}}>SKILL MATCH BREAKDOWN</div>
                          <div style={{display:"flex",flexDirection:"column",gap:5}}>
                            {uploadResult.skillMatch.map((sm,i)=>{
                              const rel = sm.relevance;
                              const col = rel==="exact"?C.green:rel==="partial"?C.orange:C.red;
                              const icon = rel==="exact"?"✓":rel==="partial"?"~":"✗";
                              return (
                                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",background:col+"08",border:`1px solid ${col}25`,borderRadius:5}}>
                                  <span style={{fontSize:12,color:col,width:16,textAlign:"center",flexShrink:0}}>{icon}</span>
                                  <div style={{flex:1}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                                      <span style={{fontSize:11,color:C.cream,fontWeight:500}}>{sm.skill}</span>
                                      {sm.required && <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:C.amber+"20",color:C.amber,fontFamily:FM,letterSpacing:"0.06em"}}>PRIMARY</span>}
                                    </div>
                                    {sm.note && <div style={{fontSize:9,color:C.muted,marginTop:1}}>{sm.note}</div>}
                                  </div>
                                  <span style={{fontSize:9,color:col,fontFamily:FM,letterSpacing:"0.06em",textTransform:"uppercase",flexShrink:0}}>{rel}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Summary + skills found */}
                      <div style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:10}}>{uploadResult.summary}</div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                        {(uploadResult.skills||[]).map(s=><Pill key={s} label={s}/>)}
                      </div>

                      {/* Strengths + red flags */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                        {uploadResult.strengths?.length>0 && (
                          <div style={{padding:"8px 10px",background:C.green+"10",border:`1px solid ${C.green}30`,borderRadius:6}}>
                            <div style={{fontSize:9,color:C.green,letterSpacing:"0.1em",marginBottom:5}}>STRENGTHS</div>
                            {uploadResult.strengths.map(s=><div key={s} style={{fontSize:10,color:C.cream,marginBottom:2}}>• {s}</div>)}
                          </div>
                        )}
                        {uploadResult.redFlags?.length>0 && (
                          <div style={{padding:"8px 10px",background:C.red+"10",border:`1px solid ${C.red}30`,borderRadius:6}}>
                            <div style={{fontSize:9,color:C.red,letterSpacing:"0.1em",marginBottom:5}}>FLAGS</div>
                            {uploadResult.redFlags.map(f=><div key={f} style={{fontSize:10,color:C.muted,marginBottom:2}}>• {f}</div>)}
                          </div>
                        )}
                      </div>

                      {/* Fit reason */}
                      <div style={{padding:"8px 10px",background:C.faint,borderRadius:6,fontSize:10,color:C.muted,marginBottom:12}}>
                        <span style={{color:C.amber}}>Assessment: </span>{uploadResult.fitReason}
                      </div>

                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setTab("candidates")} style={{padding:"7px 14px",borderRadius:4,background:C.amber,border:"none",color:C.bg,fontFamily:FM,fontSize:9,cursor:"pointer",fontWeight:700,letterSpacing:"0.06em"}}>VIEW MY CANDIDATES →</button>
                        <button onClick={()=>{setUploadResult(null);setFileName(null);}} style={{padding:"7px 14px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:9,cursor:"pointer",letterSpacing:"0.06em"}}>SCREEN ANOTHER</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ JOBS ══ */}
          {tab==="jobs" && (
            <div className="fi">
              {/* Header row */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em"}}>{jobs.length} JOB{jobs.length!==1?"S":""} · {jobs.filter(j=>j.status==="Active").length} ACTIVE</div>
                <button onClick={()=>{setShowJobForm(v=>!v);setJError("");}} style={{padding:"8px 18px",borderRadius:4,background:showJobForm?"transparent":C.amber,border:`1px solid ${showJobForm?C.border:C.amber}`,color:showJobForm?C.muted:C.bg,fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700,letterSpacing:"0.06em",transition:"all 0.15s"}}>
                  {showJobForm?"✕ CANCEL":"+ POST NEW JOB"}
                </button>
              </div>

              {/* Creation form */}
              {showJobForm && (
                <div className="fi" style={{background:C.card,border:`1px solid ${C.amber}40`,borderRadius:8,padding:20,marginBottom:16}}>
                  <div style={{fontSize:9,color:C.amber,letterSpacing:"0.12em",marginBottom:16}}>NEW JOB POSTING</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>JOB TITLE *</div>
                      <input value={jTitle} onChange={e=>{setJTitle(e.target.value);setJError("");}} placeholder="e.g. Senior Backend Engineer"
                        style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none",letterSpacing:"0.04em",boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>DEPARTMENT</div>
                      <select value={jDept} onChange={e=>setJDept(e.target.value)} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none",cursor:"pointer"}}>
                        {DEPTS.map(d=><option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>LOCATION</div>
                      <select value={jLocation} onChange={e=>setJLocation(e.target.value)} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none",cursor:"pointer"}}>
                        {LOCATIONS.map(l=><option key={l}>{l}</option>)}
                      </select>
                    </div>
                    {/* Primary Skills */}
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>PRIMARY SKILLS <span style={{color:C.faint,fontSize:8}}>(must-have · Enter or + to add)</span></div>
                      <div style={{display:"flex",gap:6,marginBottom:8}}>
                        <input value={jSkillInput} onChange={e=>setJSkillInput(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addSkill();}}}
                          placeholder="e.g. React, Python, AWS..."
                          style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none"}}/>
                        <button onClick={addSkill} style={{padding:"8px 14px",borderRadius:6,background:C.amber+"22",border:`1px solid ${C.amber}40`,color:C.amber,fontFamily:FM,fontSize:11,cursor:"pointer"}}>+</button>
                      </div>
                      {jSkills.length>0 && (
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {jSkills.map(s=>(
                            <span key={s} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:20,background:C.amber+"18",border:`0.5px solid ${C.amber}40`,color:C.amber,fontFamily:FM,fontSize:10}}>
                              {s}<button onClick={()=>setJSkills(p=>p.filter(x=>x!==s))} style={{background:"none",border:"none",color:C.amberDim,cursor:"pointer",padding:0,fontSize:12,lineHeight:1}}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Secondary Skills */}
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>SECONDARY SKILLS <span style={{color:C.faint,fontSize:8}}>(good-to-have · Enter or + to add)</span></div>
                      <div style={{display:"flex",gap:6,marginBottom:8}}>
                        <input value={jSecSkillInput} onChange={e=>setJSecSkillInput(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addSecSkill();}}}
                          placeholder="e.g. Docker, GraphQL, Figma..."
                          style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none"}}/>
                        <button onClick={addSecSkill} style={{padding:"8px 14px",borderRadius:6,background:C.blue+"22",border:`1px solid ${C.blue}40`,color:C.blue,fontFamily:FM,fontSize:11,cursor:"pointer"}}>+</button>
                      </div>
                      {jSecSkills.length>0 && (
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {jSecSkills.map(s=>(
                            <span key={s} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:20,background:C.blue+"18",border:`0.5px solid ${C.blue}40`,color:C.blue,fontFamily:FM,fontSize:10}}>
                              {s}<button onClick={()=>setJSecSkills(p=>p.filter(x=>x!==s))} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",padding:0,fontSize:12,lineHeight:1}}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Responsibilities */}
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>RESPONSIBILITIES</div>
                      <textarea value={jResponsibilities} onChange={e=>setJResponsibilities(e.target.value)}
                        placeholder={"• Lead the design and implementation of...\n• Collaborate with cross-functional teams...\n• Own the architecture of..."}
                        rows={4}
                        style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none",resize:"vertical",lineHeight:1.6,boxSizing:"border-box"}}/>
                    </div>
                    {/* Urgent toggle */}
                    <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:10}}>
                      <button onClick={()=>setJUrgent(v=>!v)} style={{width:36,height:20,borderRadius:10,background:jUrgent?C.red+"40":C.faint,border:`1px solid ${jUrgent?C.red:C.border}`,cursor:"pointer",position:"relative",transition:"all 0.2s",flexShrink:0}}>
                        <div style={{width:12,height:12,borderRadius:"50%",background:jUrgent?C.red:C.muted,position:"absolute",top:3,left:jUrgent?20:4,transition:"left 0.2s"}}/>
                      </button>
                      <span style={{fontSize:10,color:jUrgent?C.red:C.muted,letterSpacing:"0.06em"}}>MARK AS URGENT</span>
                    </div>
                  </div>
                  {jError && <div style={{padding:"7px 10px",background:C.red+"15",border:`1px solid ${C.red}40`,borderRadius:5,fontSize:11,color:C.red,marginBottom:10}}>{jError}</div>}
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={handleCreateJob} style={{padding:"9px 22px",borderRadius:4,background:C.amber,border:"none",color:C.bg,fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700,letterSpacing:"0.06em"}}>PUBLISH JOB</button>
                    <button onClick={()=>{setShowJobForm(false);setJError("");}} style={{padding:"9px 16px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:10,cursor:"pointer",letterSpacing:"0.06em"}}>CANCEL</button>
                  </div>
                </div>
              )}

              {/* Job list */}
              {jobs.length===0 ? (
                <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:8,padding:"40px 32px",textAlign:"center"}}>
                  <div style={{fontSize:28,opacity:0.15,marginBottom:10}}>◇</div>
                  <div style={{fontSize:13,color:C.muted,marginBottom:4}}>No jobs posted yet</div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:16}}>Create your first job to start screening candidates against it</div>
                  <button onClick={()=>setShowJobForm(true)} style={{padding:"8px 18px",borderRadius:4,background:C.amber,border:"none",color:C.bg,fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700,letterSpacing:"0.06em"}}>+ POST FIRST JOB</button>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {jobs.map(job=>{
                    const candCount = candidates.filter(c=>c.jobId===job.id).length;
                    const approvedCount = candidates.filter(c=>c.jobId===job.id&&c.interviewStatus==="approved").length;
                    const hiredCount = candidates.filter(c=>c.stage==="Hired"&&c.jobId===job.id).length;
                    const createdBy = recruiters.find(r=>r.id===job.createdBy);
                    const isExpanded = expandedJobId === job.id;
                    const jobCands = candidates.filter(c=>c.jobId===job.id);
                    return (
                    <div key={job.id} style={{background:C.card,border:`1px solid ${job.status==="Active"?C.border:C.faint}`,borderRadius:8,padding:"16px 20px",opacity:job.status==="Active"?1:0.6,transition:"all 0.15s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                            <span style={{fontFamily:FD,fontSize:18,color:C.cream}}>{job.title}</span>
                            {job.urgent && <Badge label="Urgent" color={C.red}/>}
                            <Badge label={job.status} color={job.status==="Active"?C.green:C.muted}/>
                          </div>
                          <div style={{display:"flex",gap:16,fontSize:10,color:C.muted,marginBottom:10}}>
                            <span>◇ {job.dept}</span>
                            <span>◻ {job.location}</span>
                            {createdBy && <span>◈ {createdBy.name}</span>}
                            {job.createdAt && <span>{new Date(job.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</span>}
                          </div>
                          {job.skills?.length>0 && (
                            <div style={{marginBottom:6}}>
                              <div style={{fontSize:8,color:C.muted,letterSpacing:"0.08em",marginBottom:4}}>PRIMARY</div>
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{job.skills.map(s=><Pill key={s} label={s}/>)}</div>
                            </div>
                          )}
                          {job.secondarySkills?.length>0 && (
                            <div style={{marginBottom:6}}>
                              <div style={{fontSize:8,color:C.muted,letterSpacing:"0.08em",marginBottom:4}}>SECONDARY</div>
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                {job.secondarySkills.map(s=>(
                                  <span key={s} style={{padding:"2px 8px",borderRadius:20,fontSize:10,background:C.blue+"15",color:C.blue,fontFamily:FM,border:`0.5px solid ${C.blue}30`}}>{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {job.responsibilities && (
                            <div style={{marginTop:8,padding:"8px 10px",background:C.faint,borderRadius:5,fontSize:10,color:C.muted,lineHeight:1.6,whiteSpace:"pre-line",maxHeight:64,overflow:"hidden"}}>
                              {job.responsibilities.slice(0,120)}{job.responsibilities.length>120?"…":""}
                            </div>
                          )}
                        </div>
                        {/* Clickable stats */}
                        <div style={{display:"flex",gap:14,alignItems:"flex-start",flexShrink:0,marginLeft:20}}>
                          <button onClick={()=>setExpandedJobId(isExpanded?null:job.id)} style={{textAlign:"center",background:"transparent",border:`1px solid ${isExpanded?C.amber+"80":C.border}`,borderRadius:6,padding:"8px 14px",cursor:"pointer",transition:"all 0.15s"}}>
                            <div style={{fontFamily:FD,fontSize:26,color:isExpanded?C.amber:C.amber,lineHeight:1}}>{candCount}</div>
                            <div style={{fontSize:8,color:C.muted,letterSpacing:"0.08em",marginTop:2}}>{isExpanded?"▲ HIDE":"▼ CANDIDATES"}</div>
                          </button>
                          <div style={{textAlign:"center"}}>
                            <div style={{fontFamily:FD,fontSize:26,color:C.green,lineHeight:1}}>{approvedCount}</div>
                            <div style={{fontSize:8,color:C.muted,letterSpacing:"0.08em"}}>APPROVED</div>
                          </div>
                          <div style={{textAlign:"center"}}>
                            <div style={{fontFamily:FD,fontSize:26,color:C.teal,lineHeight:1}}>{hiredCount}</div>
                            <div style={{fontSize:8,color:C.muted,letterSpacing:"0.08em"}}>HIRED</div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded candidate dropdown */}
                      {isExpanded && (
                        <div className="fi" style={{marginTop:14,borderTop:`1px solid ${C.border}`,paddingTop:12}}>
                          <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:10}}>CANDIDATES FOR THIS ROLE</div>
                          {jobCands.length===0?(
                            <div style={{fontSize:13,color:C.muted,padding:"8px 0"}}>No candidates screened yet.</div>
                          ):(
                            <div style={{display:"flex",flexDirection:"column",gap:8}}>
                              {jobCands.map(jc=>{
                                const sm      = STATUS_META[jc.interviewStatus]||STATUS_META.pending;
                                const rec     = recruiters.find(r=>r.id===jc.recruiterId);
                                const stageMeta=STAGE_META[jc.stage]||{color:C.muted};
                                const candIntv = interviews.filter(i=>i.candidateId===jc.id);
                                return (
                                  <div key={jc.id} style={{background:C.card,borderRadius:8,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                                    {/* Candidate header */}
                                    <div style={{padding:"10px 14px",display:"flex",gap:10,alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
                                      <Avatar text={jc.avatar||ini(jc.name||"?")} size={32} color={sc(jc.score)}/>
                                      <div style={{flex:1}}>
                                        <div style={{fontSize:15,color:C.cream,fontWeight:500}}>{jc.name}</div>
                                        <div style={{fontSize:12,color:C.muted}}>{jc.exp} {jc.email&&`· ${jc.email}`} {jc.phone&&`· ${jc.phone}`}</div>
                                      </div>
                                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                                        <span style={{fontFamily:FD,fontSize:20,color:sc(jc.score)}}>{jc.score}%</span>
                                        <Badge label={stageMeta.color?jc.stage:"Applied"} color={stageMeta.color||C.muted}/>
                                        <Badge label={sm.label} color={sm.color}/>
                                        {jc.recommendation&&<Badge label={jc.recommendation} color={jc.recommendation==="shortlist"?C.green:jc.recommendation==="reject"?C.red:C.orange}/>}
                                      </div>
                                    </div>
                                    {/* Interview workflow */}
                                    <div style={{padding:"10px 14px"}}>
                                      <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:8}}>INTERVIEW WORKFLOW</div>
                                      <div style={{display:"flex",gap:8,marginBottom:10}}>
                                        {INTERVIEW_LEVELS.map(lvl=>{
                                          const round=candIntv.find(i=>i.level===lvl.id);
                                          const rs=round?INTERVIEW_STATUS_META[round.status]:null;
                                          return (
                                            <div key={lvl.id} style={{flex:1,background:round?lvl.color+"12":C.faint,border:`1px solid ${round?lvl.color+"50":C.border}`,borderRadius:6,padding:"8px 10px",textAlign:"center"}}>
                                              <div style={{fontSize:12,color:lvl.color,fontWeight:700,marginBottom:3}}>{lvl.label}</div>
                                              {round?(
                                                <>
                                                  <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{round.date} · {round.time}</div>
                                                  <select value={round.status} onChange={e=>updateInterview(round.id,{status:e.target.value})}
                                                    style={{width:"100%",background:rs?.color+"15",border:`1px solid ${rs?.color}50`,borderRadius:4,color:rs?.color,fontFamily:FM,fontSize:11,padding:"2px 5px",cursor:"pointer",outline:"none",fontWeight:700}}>
                                                    {["scheduled","completed","approved","cancelled"].map(s=><option key={s} value={s}>{INTERVIEW_STATUS_META[s].label}</option>)}
                                                  </select>
                                                </>
                                              ):(
                                                <div style={{fontSize:11,color:C.muted,opacity:0.5}}>Not scheduled</div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {/* Status + Stage controls */}
                                      <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                                        <span style={{fontSize:12,color:C.muted}}>STATUS:</span>
                                        {["approved","rejected","hold","pending"].map(st=>(
                                          <button key={st} onClick={()=>updateStatus(jc.id,st)}
                                            style={{padding:"3px 9px",borderRadius:4,border:`0.5px solid ${STATUS_META[st].color}${jc.interviewStatus===st?"":"40"}`,background:jc.interviewStatus===st?STATUS_META[st].color+"20":"transparent",color:STATUS_META[st].color,fontFamily:FM,fontSize:11,cursor:"pointer",fontWeight:jc.interviewStatus===st?"700":"400"}}>
                                            {STATUS_META[st].label.toUpperCase()}
                                          </button>
                                        ))}
                                        <span style={{fontSize:12,color:C.muted,marginLeft:4}}>STAGE:</span>
                                        <select value={jc.stage} onChange={e=>updateStage(jc.id,e.target.value)}
                                          style={{background:C.faint,border:`0.5px solid ${C.border}`,borderRadius:4,color:C.cream,fontFamily:FM,fontSize:12,padding:"3px 8px",cursor:"pointer"}}>
                                          {STAGES.map(s=><option key={s}>{s}</option>)}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{display:"flex",gap:8,marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`,flexWrap:"wrap",alignItems:"center"}}>
                        <button onClick={()=>{setUploadJob(job.id);setTab("upload");}} style={{padding:"6px 13px",borderRadius:4,border:`0.5px solid ${C.amber}60`,background:"transparent",color:C.amber,fontFamily:FM,fontSize:11,cursor:"pointer",letterSpacing:"0.06em"}}>⬆ SCREEN RESUMES</button>
                        <button onClick={()=>startEditJob(job)} style={{padding:"6px 13px",borderRadius:4,border:`0.5px solid ${C.blue}60`,background:C.blue+"10",color:C.blue,fontFamily:FM,fontSize:11,cursor:"pointer",letterSpacing:"0.06em"}}>✏ EDIT JOB</button>
                        <button onClick={()=>toggleJobStatus(job.id)} style={{padding:"6px 13px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:11,cursor:"pointer",letterSpacing:"0.06em"}}>{job.status==="Active"?"CLOSE ROLE":"REOPEN ROLE"}</button>
                        {confirmClearJobId===job.id ? (
                          <div style={{display:"flex",gap:6,alignItems:"center",padding:"4px 10px",background:C.red+"12",border:`1px solid ${C.red}40`,borderRadius:5}}>
                            <span style={{fontSize:12,color:C.red,fontFamily:FM}}>Remove all {candidates.filter(cc=>cc.jobId===job.id).length} candidates?</span>
                            <button onClick={()=>confirmClear(job.id)} style={{padding:"3px 10px",borderRadius:3,background:C.red,border:"none",color:"#fff",fontFamily:FM,fontSize:11,cursor:"pointer",fontWeight:700}}>YES</button>
                            <button onClick={()=>setConfirmClearJobId(null)} style={{padding:"3px 10px",borderRadius:3,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:11,cursor:"pointer"}}>CANCEL</button>
                          </div>
                        ) : (
                          <button onClick={()=>clearJobCandidates(job.id)} style={{padding:"6px 13px",borderRadius:4,border:`0.5px solid ${C.orange}50`,background:"transparent",color:C.orange,fontFamily:FM,fontSize:11,cursor:"pointer",letterSpacing:"0.06em"}}>✕ CLEAR RESUMES ({candidates.filter(cc=>cc.jobId===job.id).length})</button>
                        )}
                        <button onClick={()=>handleDeleteJob(job.id)} style={{padding:"6px 13px",borderRadius:4,border:`0.5px solid ${C.red}40`,background:"transparent",color:C.red,fontFamily:FM,fontSize:11,cursor:"pointer",letterSpacing:"0.06em"}}>DELETE JOB</button>
                      </div>

                      {/* ── Inline Edit Form ── */}
                      {editingJobId===job.id && (
                        <div className="fi" style={{marginTop:14,padding:16,background:C.surface,borderRadius:8,border:`1px solid ${C.blue}50`}}>
                          <div style={{fontSize:12,color:C.blue,letterSpacing:"0.1em",marginBottom:14,fontWeight:700}}>EDITING: {job.title}</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                            <div style={{gridColumn:"1/-1"}}>
                              <div style={{fontSize:12,color:C.muted,marginBottom:5}}>JOB TITLE</div>
                              <input value={ejTitle} onChange={e=>setEjTitle(e.target.value)} style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",color:C.cream,fontFamily:FM,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                            </div>
                            <div>
                              <div style={{fontSize:12,color:C.muted,marginBottom:5}}>DEPARTMENT</div>
                              <select value={ejDept} onChange={e=>setEjDept(e.target.value)} style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",color:C.cream,fontFamily:FM,fontSize:13,outline:"none",cursor:"pointer"}}>
                                {DEPTS.map(d=><option key={d}>{d}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{fontSize:12,color:C.muted,marginBottom:5}}>LOCATION</div>
                              <select value={ejLocation} onChange={e=>setEjLocation(e.target.value)} style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",color:C.cream,fontFamily:FM,fontSize:13,outline:"none",cursor:"pointer"}}>
                                {LOCATIONS.map(l=><option key={l}>{l}</option>)}
                              </select>
                            </div>
                            <div style={{gridColumn:"1/-1"}}>
                              <div style={{fontSize:12,color:C.muted,marginBottom:5}}>PRIMARY SKILLS <span style={{fontSize:11,opacity:0.6}}>(Enter to add)</span></div>
                              <div style={{display:"flex",gap:6,marginBottom:6}}>
                                <input value={ejSkillInput} onChange={e=>setEjSkillInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(ejSkillInput.trim())setEjSkills(p=>[...p,ejSkillInput.trim()]);setEjSkillInput("");}}} placeholder="Add skill..." style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",color:C.cream,fontFamily:FM,fontSize:13,outline:"none"}}/>
                                <button onClick={()=>{if(ejSkillInput.trim())setEjSkills(p=>[...p,ejSkillInput.trim()]);setEjSkillInput("");}} style={{padding:"7px 12px",borderRadius:6,background:C.amber+"22",border:`1px solid ${C.amber}40`,color:C.amber,fontFamily:FM,cursor:"pointer"}}>+</button>
                              </div>
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{ejSkills.map(s=><span key={s} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:20,background:C.amber+"18",border:`0.5px solid ${C.amber}40`,color:C.amber,fontFamily:FM,fontSize:12}}>{s}<button onClick={()=>setEjSkills(p=>p.filter(x=>x!==s))} style={{background:"none",border:"none",color:C.amberDim,cursor:"pointer",padding:0,fontSize:13,lineHeight:1}}>×</button></span>)}</div>
                            </div>
                            <div style={{gridColumn:"1/-1"}}>
                              <div style={{fontSize:12,color:C.muted,marginBottom:5}}>SECONDARY SKILLS</div>
                              <div style={{display:"flex",gap:6,marginBottom:6}}>
                                <input value={ejSecInput} onChange={e=>setEjSecInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(ejSecInput.trim())setEjSecSkills(p=>[...p,ejSecInput.trim()]);setEjSecInput("");}}} placeholder="Add skill..." style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",color:C.cream,fontFamily:FM,fontSize:13,outline:"none"}}/>
                                <button onClick={()=>{if(ejSecInput.trim())setEjSecSkills(p=>[...p,ejSecInput.trim()]);setEjSecInput("");}} style={{padding:"7px 12px",borderRadius:6,background:C.blue+"22",border:`1px solid ${C.blue}40`,color:C.blue,fontFamily:FM,cursor:"pointer"}}>+</button>
                              </div>
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{ejSecSkills.map(s=><span key={s} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:20,background:C.blue+"18",border:`0.5px solid ${C.blue}40`,color:C.blue,fontFamily:FM,fontSize:12}}>{s}<button onClick={()=>setEjSecSkills(p=>p.filter(x=>x!==s))} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",padding:0,fontSize:13,lineHeight:1}}>×</button></span>)}</div>
                            </div>
                            <div style={{gridColumn:"1/-1"}}>
                              <div style={{fontSize:12,color:C.muted,marginBottom:5}}>RESPONSIBILITIES</div>
                              <textarea value={ejResponsibilities} onChange={e=>setEjResponsibilities(e.target.value)} rows={3} style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",color:C.cream,fontFamily:FM,fontSize:13,outline:"none",resize:"vertical",lineHeight:1.6,boxSizing:"border-box"}}/>
                            </div>
                            <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:10}}>
                              <button onClick={()=>setEjUrgent(v=>!v)} style={{width:36,height:20,borderRadius:10,background:ejUrgent?C.red+"40":C.faint,border:`1px solid ${ejUrgent?C.red:C.border}`,cursor:"pointer",position:"relative",flexShrink:0}}>
                                <div style={{width:12,height:12,borderRadius:"50%",background:ejUrgent?C.red:C.muted,position:"absolute",top:3,left:ejUrgent?20:4,transition:"left 0.2s"}}/>
                              </button>
                              <span style={{fontSize:13,color:ejUrgent?C.red:C.muted}}>URGENT</span>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>saveEditJob(job.id)} style={{padding:"8px 20px",borderRadius:4,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:13,cursor:"pointer",fontWeight:700}}>SAVE CHANGES</button>
                            <button onClick={()=>setEditingJobId(null)} style={{padding:"8px 14px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:13,cursor:"pointer"}}>CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ PIPELINE (full view) ══ */}
          {tab==="pipeline" && (
            <div className="fi">
              {/* Stage legend + job filter */}
              <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em"}}>FILTER BY JOB:</div>
                <select value={pipelineJobFilter} onChange={e=>setPipelineJobFilter(e.target.value)}
                  style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:5,color:C.cream,fontFamily:FM,fontSize:10,padding:"5px 10px",cursor:"pointer",outline:"none"}}>
                  <option value="all">All Jobs ({candidates.length} candidates)</option>
                  {jobs.map(j=>{
                    const cnt=candidates.filter(c=>c.jobId===j.id).length;
                    return <option key={j.id} value={j.id}>{j.title} ({cnt})</option>;
                  })}
                </select>
                <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                  {STAGES.slice(0,-1).map(s=>{
                    const meta=STAGE_META[s];
                    const cnt=candidates.filter(c=>c.stage===s&&(pipelineJobFilter==="all"||c.jobId===pipelineJobFilter)).length;
                    return cnt>0?(
                      <span key={s} style={{padding:"2px 8px",borderRadius:4,fontSize:9,background:meta.color+"18",color:meta.color,fontFamily:FM,border:`0.5px solid ${meta.color}40`}}>{s}: {cnt}</span>
                    ):null;
                  })}
                </div>
              </div>

              {/* Per-job candidate tables */}
              {(pipelineJobFilter==="all" ? jobs : jobs.filter(j=>j.id===pipelineJobFilter)).map(job=>{
                const jobCands = candidates.filter(c=>c.jobId===job.id);
                if(jobCands.length===0) return null;
                return (
                  <div key={job.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,marginBottom:14,overflow:"hidden"}}>
                    {/* Job header */}
                    <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.faint}}>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontFamily:FD,fontSize:15,color:C.cream}}>{job.title}</span>
                        <Badge label={job.dept} color={C.muted}/>
                        <Badge label={job.location} color={C.muted}/>
                      </div>
                      <div style={{display:"flex",gap:12,fontSize:10}}>
                        <span style={{color:C.amber}}>{jobCands.length} candidates</span>
                        <span style={{color:C.green}}>{jobCands.filter(c=>c.interviewStatus==="approved").length} approved</span>
                        <span style={{color:C.teal}}>{jobCands.filter(c=>c.stage==="Offer").length} offered</span>
                        <span style={{color:C.green}}>{jobCands.filter(c=>c.stage==="Hired").length} hired</span>
                      </div>
                    </div>
                    {/* Column headers */}
                    <div style={{display:"grid",gridTemplateColumns:"1.6fr 0.9fr 0.7fr repeat(3,0.8fr) 0.9fr 1.4fr",gap:0,padding:"7px 16px",borderBottom:`1px solid ${C.border}`,background:C.surface}}>
                      {["CANDIDATE","STAGE","SCORE","L1","L2","FINAL","STATUS","FEEDBACK"].map(h=>(
                        <div key={h} style={{fontSize:8,color:C.muted,letterSpacing:"0.1em"}}>{h}</div>
                      ))}
                    </div>
                    {jobCands.map((c,ci)=>{
                      const rec=recruiters.find(r=>r.id===c.recruiterId);
                      const sm=STATUS_META[c.interviewStatus];
                      const stageMeta=STAGE_META[c.stage];
                      return (
                        <div key={c.id} style={{display:"grid",gridTemplateColumns:"1.6fr 0.9fr 0.7fr repeat(3,0.8fr) 0.9fr 1.4fr",gap:0,padding:"9px 16px",borderBottom:ci<jobCands.length-1?`1px solid ${C.border}`:"none",alignItems:"center"}}>
                          {/* Candidate */}
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <Avatar text={c.avatar} size={26} color={sc(c.score)}/>
                            <div>
                              <div style={{fontSize:11,color:C.cream}}>{c.name}</div>
                              <div style={{fontSize:9,color:C.muted}}>{c.exp} {rec&&<span style={{color:rec.color}}>· {rec.initials}</span>}</div>
                            </div>
                          </div>
                          {/* Stage */}
                          <div><span style={{fontSize:9,color:stageMeta?.color||C.muted,fontFamily:FM}}>{c.stage}</span></div>
                          {/* Score */}
                          <div style={{fontSize:12,color:sc(c.score),fontFamily:FD}}>{c.score}</div>
                          {/* Interview levels */}
                          {INTERVIEW_LEVELS.map(lvl=>{
                            const round=interviews.find(i=>i.candidateId===c.id&&i.level===lvl.id);
                            const rst=round?INTERVIEW_STATUS_META[round.status]:null;
                            return (
                              <div key={lvl.id}>
                                {round?(
                                  <select value={round.status} onChange={e=>updateInterview(round.id,{status:e.target.value})}
                                    style={{background:rst?.color+"15",border:`1px solid ${rst?.color}40`,borderRadius:4,color:rst?.color,fontFamily:FM,fontSize:8,padding:"2px 4px",cursor:"pointer",outline:"none",fontWeight:700}}>
                                    {["scheduled","completed","approved","cancelled"].map(s=>(
                                      <option key={s} value={s} style={{background:C.surface,color:C.cream}}>{INTERVIEW_STATUS_META[s].label}</option>
                                    ))}
                                  </select>
                                ):(
                                  <span style={{fontSize:9,color:C.faint}}>—</span>
                                )}
                              </div>
                            );
                          })}
                          {/* Overall status */}
                          <div><span style={{padding:"2px 7px",borderRadius:4,fontSize:9,background:sm?.color+"20",color:sm?.color,fontFamily:FM,border:`0.5px solid ${sm?.color}40`}}>{sm?.label}</span></div>
                          {/* Feedback */}
                          <div>
                            <input
                              defaultValue={c.feedback||""}
                              onBlur={e=>updateFeedback(c.id,e.target.value)}
                              placeholder="Add feedback..."
                              style={{width:"100%",background:"transparent",border:`0.5px solid ${C.border}`,borderRadius:4,padding:"3px 7px",color:C.cream,fontFamily:FM,fontSize:9,outline:"none",boxSizing:"border-box"}}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {jobs.length===0&&<div style={{padding:32,textAlign:"center",fontSize:11,color:C.muted}}>No jobs created yet.</div>}
            </div>
          )}

          {/* ══ INTERVIEWS ══ */}
          {tab==="interviews" && (
            <div className="fi">
              {/* Add interview form */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:16}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:12}}>SCHEDULE NEW INTERVIEW</div>
                <ScheduleForm candidates={myCandidates} currentRecruiter={currentRecruiter} jobs={jobs} onAdd={(iv)=>setInterviews(p=>[...p,iv])}/>
              </div>

              {/* Interview list */}
              {[
                {label:"MY INTERVIEWS", list:interviews.filter(i=>i.recruiterId===currentRecruiter.id)},
                {label:"ALL TEAM INTERVIEWS", list:interviews.filter(i=>i.recruiterId!==currentRecruiter.id)},
              ].map(group=>(
                <div key={group.label} style={{marginBottom:18}}>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>{group.label}</div>
                  {group.list.length===0?<div style={{fontSize:11,color:C.muted,padding:"8px 0"}}>None.</div>:group.list.map(iv=>{
                    const c=candidates.find(x=>x.id===iv.candidateId);
                    const rec=recruiters.find(r=>r.id===iv.recruiterId);
                    const job=jobs.find(j=>j.id===iv.jobId);
                    return (
                      <div key={iv.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:8,borderLeft:`3px solid ${rec?.color||C.muted}`}}>
                        <div style={{fontFamily:FD,fontSize:17,color:rec?.color||C.muted,minWidth:64}}>{iv.time}</div>
                        <Avatar text={ini(iv.candidateName)} size={34} color={sc(c?.score||70)}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:C.cream}}>{iv.candidateName}</div>
                          <div style={{fontSize:10,color:C.muted}}>{iv.date} · {iv.role} · {job?.title}</div>
                          <div style={{fontSize:10,color:C.muted}}>by {rec?.name}</div>
                        </div>
                        {(() => {
                          const lvl = INTERVIEW_LEVELS.find(l=>l.id===iv.level);
                          return lvl ? <Badge label={lvl.label} color={lvl.color}/> : null;
                        })()}
                        <Badge label={iv.type} color={rec?.color||C.muted}/>
                        {/* Status */}
                        <div style={{display:"flex",gap:4}}>
                          {["scheduled","completed","approved","cancelled"].map(st=>{
                            const stColors={scheduled:C.blue,completed:C.teal,approved:C.green,cancelled:C.red};
                            const stColor=stColors[st];
                            const canEdit=iv.recruiterId===currentRecruiter.id;
                            return (
                              <button key={st} onClick={()=>canEdit&&updateInterview(iv.id,{status:st})}
                                style={{padding:"3px 8px",borderRadius:3,border:`0.5px solid ${iv.status===st?stColor:C.border}`,background:iv.status===st?stColor+"20":"transparent",color:stColor,fontFamily:FM,fontSize:8,cursor:canEdit?"pointer":"default",letterSpacing:"0.05em",opacity:canEdit?1:0.5}}>
                                {st.toUpperCase()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}


          {/* ══ AI SCREENED RESUMES ══ */}
          {tab==="aiscreened" && (
            <div className="fi">
              {/* Summary bar */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:18}}>
                {[
                  {label:"AI Screened",  value:candidates.filter(c=>c.source==="ai").length,                                           color:C.purple},
                  {label:"Shortlisted",  value:candidates.filter(c=>c.source==="ai"&&c.recommendation==="shortlist").length,            color:C.green},
                  {label:"Consider",     value:candidates.filter(c=>c.source==="ai"&&c.recommendation==="consider").length,             color:C.orange},
                  {label:"Rejected",     value:candidates.filter(c=>c.source==="ai"&&c.recommendation==="reject").length,               color:C.red},
                ].map(m=>(
                  <div key={m.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",borderTop:`2px solid ${m.color}`}}>
                    <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>{m.label.toUpperCase()}</div>
                    <div style={{fontFamily:FD,fontSize:30,color:m.color,lineHeight:1}}>{m.value}</div>
                  </div>
                ))}
              </div>

              {candidates.filter(c=>c.source==="ai").length===0 ? (
                <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:8,padding:"40px 32px",textAlign:"center"}}>
                  <div style={{fontSize:32,opacity:0.15,marginBottom:10}}>🤖</div>
                  <div style={{fontSize:13,color:C.muted,marginBottom:4}}>No AI screened resumes yet</div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:16}}>Upload resumes to screen them with AI</div>
                  <button onClick={()=>setTab("upload")} style={{padding:"8px 18px",borderRadius:4,background:C.amber,border:"none",color:C.bg,fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700}}>⬆ UPLOAD RESUMES →</button>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {candidates.filter(c=>c.source==="ai").map(c=>{
                    const job = jobs.find(j=>j.id===c.jobId);
                    const rec = RECRUITERS.find(r=>r.id===c.recruiterId);
                    const sm  = STATUS_META[c.interviewStatus]||STATUS_META.pending;
                    const recColor = rec?.color || C.muted;
                    const recInitials = rec?.initials || ini(c.recruiterId||"?");
                    const recObj = recruiters.find(r=>r.id===c.recruiterId);
                    const rColor = recObj?.color||C.muted;

                    return (
                      <div key={c.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
                        {/* Top header bar */}
                        <div style={{background:C.faint,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
                          <div style={{display:"flex",gap:10,alignItems:"center"}}>
                            <Avatar text={c.avatar||ini(c.name)} size={36} color={sc(c.score)}/>
                            <div>
                              <div style={{fontFamily:FD,fontSize:17,color:C.cream}}>{c.name}</div>
                              <div style={{fontSize:10,color:C.muted}}>{c.role}{c.currentCompany?` @ ${c.currentCompany}`:""} · {c.exp}</div>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            {c.recommendation && (
                              <Badge label={c.recommendation.toUpperCase()} color={c.recommendation==="shortlist"?C.green:c.recommendation==="reject"?C.red:C.orange}/>
                            )}
                            <Badge label={`${c.score}% FIT`} color={sc(c.score)}/>
                            <Badge label={sm.label} color={sm.color}/>
                            <Badge label={job?.title||"—"} color={C.muted}/>
                          </div>
                        </div>

                        <div style={{padding:"14px 16px"}}>
                          {/* Contact info row */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14,padding:"10px 14px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`}}>
                            <div>
                              <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>EMAIL</div>
                              <div style={{fontSize:11,color:c.email?C.teal:C.muted}}>{c.email||"Not found"}</div>
                            </div>
                            <div>
                              <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>PHONE</div>
                              <div style={{fontSize:11,color:c.phone?C.teal:C.muted}}>{c.phone||"Not found"}</div>
                            </div>
                            <div>
                              <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>LOCATION</div>
                              <div style={{fontSize:11,color:c.location?C.cream:C.muted}}>{c.location||"Not found"}</div>
                            </div>
                            <div>
                              <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>SCREENED BY</div>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <Avatar text={recObj?.initials||"?"} size={18} color={rColor}/>
                                <span style={{fontSize:11,color:C.cream}}>{recObj?.name||"—"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Education */}
                          {c.education && c.education!=="—" && (
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>EDUCATION</div>
                              {c.educationDetail?.length>0 ? (
                                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                                  {c.educationDetail.map((e,i)=>(
                                    <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"6px 10px",background:C.surface,borderRadius:5,border:`1px solid ${C.border}`}}>
                                      <span style={{fontSize:12,color:C.amber}}>🎓</span>
                                      <div>
                                        <span style={{fontSize:11,color:C.cream,fontWeight:500}}>{e.degree}</span>
                                        {e.specialization && <span style={{fontSize:10,color:C.muted}}> · {e.specialization}</span>}
                                        {e.institution && <span style={{fontSize:10,color:C.muted}}> — {e.institution}</span>}
                                        {e.year && <span style={{fontSize:10,color:C.amber}}> ({e.year})</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{fontSize:11,color:C.muted,padding:"6px 10px",background:C.surface,borderRadius:5,border:`1px solid ${C.border}`}}>{c.education}</div>
                              )}
                            </div>
                          )}

                          {/* Certifications + Languages */}
                          {(c.certifications?.length>0||c.languages?.length>0) && (
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                              {c.certifications?.length>0 && (
                                <div>
                                  <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>CERTIFICATIONS</div>
                                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                    {c.certifications.map(cert=>(
                                      <span key={cert} style={{padding:"3px 8px",borderRadius:4,fontSize:10,background:C.teal+"15",color:C.teal,fontFamily:FM,border:`0.5px solid ${C.teal}40`}}>{cert}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {c.languages?.length>0 && (
                                <div>
                                  <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>LANGUAGES</div>
                                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                    {c.languages.map(lang=>(
                                      <span key={lang} style={{padding:"3px 8px",borderRadius:4,fontSize:10,background:C.purple+"15",color:C.purple,fontFamily:FM,border:`0.5px solid ${C.purple}40`}}>{lang}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Skills */}
                          <div style={{marginBottom:12}}>
                            <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>SKILLS</div>
                            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                              {(c.skills||[]).map(s=><Pill key={s} label={s}/>)}
                            </div>
                          </div>

                          {/* Match % bars */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                            <div style={{padding:"8px 12px",background:sc(c.score)+"12",border:`1px solid ${sc(c.score)}30`,borderRadius:6,textAlign:"center"}}>
                              <div style={{fontFamily:FD,fontSize:24,color:sc(c.score),lineHeight:1}}>{c.score}%</div>
                              <div style={{fontSize:8,color:C.muted,marginTop:3}}>OVERALL FIT</div>
                              <div style={{height:3,background:C.border,borderRadius:2,marginTop:5,overflow:"hidden"}}>
                                <div style={{width:`${c.score}%`,height:"100%",background:sc(c.score),borderRadius:2}}/>
                              </div>
                            </div>
                            <div style={{padding:"8px 12px",background:sc(c.primaryMatchPct||0)+"12",border:`1px solid ${sc(c.primaryMatchPct||0)}30`,borderRadius:6,textAlign:"center"}}>
                              <div style={{fontFamily:FD,fontSize:24,color:sc(c.primaryMatchPct||0),lineHeight:1}}>{c.primaryMatchPct||0}%</div>
                              <div style={{fontSize:8,color:C.muted,marginTop:3}}>PRIMARY SKILLS</div>
                              <div style={{fontSize:9,color:C.muted}}>{c.primarySkillsMatched||0}/{c.primarySkillsTotal||0} matched</div>
                              <div style={{height:3,background:C.border,borderRadius:2,marginTop:3,overflow:"hidden"}}>
                                <div style={{width:`${c.primaryMatchPct||0}%`,height:"100%",background:sc(c.primaryMatchPct||0),borderRadius:2}}/>
                              </div>
                            </div>
                            <div style={{padding:"8px 12px",background:C.blue+"12",border:`1px solid ${C.blue}30`,borderRadius:6,textAlign:"center"}}>
                              <div style={{fontFamily:FD,fontSize:24,color:C.blue,lineHeight:1}}>{c.secondaryMatchPct||0}%</div>
                              <div style={{fontSize:8,color:C.muted,marginTop:3}}>SECONDARY SKILLS</div>
                              <div style={{fontSize:9,color:C.muted}}>{c.experienceMatch||"—"} exp</div>
                              <div style={{height:3,background:C.border,borderRadius:2,marginTop:3,overflow:"hidden"}}>
                                <div style={{width:`${c.secondaryMatchPct||0}%`,height:"100%",background:C.blue,borderRadius:2}}/>
                              </div>
                            </div>
                          </div>

                          {/* Skill breakdown */}
                          {c.skillMatch?.length>0 && (
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>SKILL MATCH BREAKDOWN</div>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                                {c.skillMatch.map((sm,i)=>{
                                  const col=sm.relevance==="exact"?C.green:sm.relevance==="partial"?C.orange:C.red;
                                  const icon=sm.relevance==="exact"?"✓":sm.relevance==="partial"?"~":"✗";
                                  return (
                                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",background:col+"08",border:`1px solid ${col}25`,borderRadius:4}}>
                                      <span style={{fontSize:11,color:col,width:14,flexShrink:0}}>{icon}</span>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                                          <span style={{fontSize:10,color:C.cream}}>{sm.skill}</span>
                                          {sm.required&&<span style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:C.amber+"20",color:C.amber,fontFamily:FM}}>PRIMARY</span>}
                                        </div>
                                        {sm.note&&<div style={{fontSize:9,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sm.note}</div>}
                                      </div>
                                      <span style={{fontSize:8,color:col,fontFamily:FM,textTransform:"uppercase",flexShrink:0}}>{sm.relevance}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Strengths + Red flags */}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                            {c.strengths?.length>0&&(
                              <div style={{padding:"8px 10px",background:C.green+"10",border:`1px solid ${C.green}30`,borderRadius:6}}>
                                <div style={{fontSize:8,color:C.green,letterSpacing:"0.1em",marginBottom:5}}>STRENGTHS</div>
                                {c.strengths.map(s=><div key={s} style={{fontSize:10,color:C.cream,marginBottom:2}}>• {s}</div>)}
                              </div>
                            )}
                            {c.redFlags?.length>0&&(
                              <div style={{padding:"8px 10px",background:C.red+"10",border:`1px solid ${C.red}30`,borderRadius:6}}>
                                <div style={{fontSize:8,color:C.red,letterSpacing:"0.1em",marginBottom:5}}>RED FLAGS</div>
                                {c.redFlags.map(f=><div key={f} style={{fontSize:10,color:C.muted,marginBottom:2}}>• {f}</div>)}
                              </div>
                            )}
                          </div>

                          {/* Assessment + actions */}
                          <div style={{padding:"7px 10px",background:C.faint,borderRadius:5,fontSize:10,color:C.muted,marginBottom:12}}>
                            <span style={{color:C.amber}}>Assessment: </span>{c.fitReason}
                          </div>

                          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                            <span style={{fontSize:9,color:C.muted}}>STATUS:</span>
                            {["approved","rejected","hold","pending"].map(st=>(
                              <button key={st} onClick={()=>updateStatus(c.id,st)}
                                style={{padding:"4px 10px",borderRadius:4,border:`0.5px solid ${STATUS_META[st].color}${c.interviewStatus===st?"":"40"}`,background:c.interviewStatus===st?STATUS_META[st].color+"20":"transparent",color:STATUS_META[st].color,fontFamily:FM,fontSize:9,cursor:"pointer",fontWeight:c.interviewStatus===st?"700":"400"}}>
                                {STATUS_META[st].label.toUpperCase()}
                              </button>
                            ))}
                            <span style={{fontSize:9,color:C.muted,marginLeft:6}}>STAGE:</span>
                            <select value={c.stage} onChange={e=>updateStage(c.id,e.target.value)}
                              style={{background:C.faint,border:`0.5px solid ${C.border}`,borderRadius:4,color:C.cream,fontFamily:FM,fontSize:9,padding:"4px 8px",cursor:"pointer"}}>
                              {STAGES.map(s=><option key={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ ACTIVITY REPORT ══ */}
          {tab==="report" && (
            <div className="fi">
              {/* Filters row */}
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
                <div>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>JOB</div>
                  <select value={rptJob} onChange={e=>setRptJob(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:5,color:C.cream,fontFamily:FM,fontSize:10,padding:"6px 10px",cursor:"pointer",outline:"none"}}>
                    <option value="all">All Jobs</option>
                    {jobs.map(j=><option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>RECRUITER</div>
                  <select value={rptRec} onChange={e=>setRptRec(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:5,color:C.cream,fontFamily:FM,fontSize:10,padding:"6px 10px",cursor:"pointer",outline:"none"}}>
                    <option value="all">All Recruiters</option>
                    {recruiters.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>STATUS</div>
                  <select value={rptStat} onChange={e=>setRptStat(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:5,color:C.cream,fontFamily:FM,fontSize:10,padding:"6px 10px",cursor:"pointer",outline:"none"}}>
                    <option value="all">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="hold">On Hold</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div style={{flex:1}}/>
                <button
                  onClick={()=>downloadCSV(generateCSV(reportData,interviews,jobs,recruiters),`cei_report_${new Date().toISOString().slice(0,10)}.csv`)}
                  style={{padding:"8px 18px",borderRadius:4,background:C.amber,border:"none",color:C.bg,fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700,letterSpacing:"0.06em"}}>
                  ↓ DOWNLOAD CSV ({reportData.length} rows)
                </button>
              </div>

              {/* Empty state */}
              {candidates.length===0 && (
                <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:8,padding:"40px 32px",textAlign:"center",marginBottom:16}}>
                  <div style={{fontSize:28,opacity:0.15,marginBottom:10}}>◇</div>
                  <div style={{fontSize:13,color:C.muted,marginBottom:4}}>No candidates yet</div>
                  <div style={{fontSize:10,color:C.muted}}>Upload resumes to start seeing activity data here</div>
                </div>
              )}

              {/* Summary stats across all data */}
              {candidates.length>0 && (
                <>
                  {/* Overall funnel */}
                  <div style={{marginBottom:8,fontSize:9,color:C.muted,letterSpacing:"0.12em"}}>PIPELINE SUMMARY — {reportData.length} CANDIDATES MATCHED</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:18}}>
                    {[
                      {label:"Total",    value:reportData.length,                                                    color:C.muted},
                      {label:"Approved", value:reportData.filter(c=>c.interviewStatus==="approved").length,           color:C.green},
                      {label:"Rejected", value:reportData.filter(c=>c.interviewStatus==="rejected").length,           color:C.red},
                      {label:"On Hold",  value:reportData.filter(c=>c.interviewStatus==="hold").length,               color:C.orange},
                      {label:"Offered",  value:reportData.filter(c=>c.stage==="Offer").length,                        color:C.teal},
                      {label:"Hired",    value:reportData.filter(c=>c.stage==="Hired").length,                        color:C.green},
                    ].map(m=>(
                      <div key={m.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",borderTop:`2px solid ${m.color}`}}>
                        <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>{m.label.toUpperCase()}</div>
                        <div style={{fontFamily:FD,fontSize:28,color:m.color,lineHeight:1}}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Per-recruiter breakdown */}
                  {recruiters.length>0 && (
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",marginBottom:10}}>RECRUITER BREAKDOWN</div>
                      <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(recruiters.length,4)},1fr)`,gap:8}}>
                        {recruiters
                          .filter(r => rptRec==="all" || r.id===rptRec)
                          .map(r=>{
                            const filtered = reportData.filter(c=>c.recruiterId===r.id);
                            return (
                              <div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:12,borderTop:`2px solid ${r.color}`}}>
                                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                                  <Avatar text={r.initials} size={28} color={r.color}/>
                                  <div>
                                    <div style={{fontSize:11,color:C.cream}}>{r.name}</div>
                                    <div style={{fontSize:9,color:C.muted}}>{r.role}</div>
                                  </div>
                                </div>
                                {[
                                  {label:"Candidates", value:filtered.length,                                                       color:r.color},
                                  {label:"Approved",   value:filtered.filter(c=>c.interviewStatus==="approved").length,             color:C.green},
                                  {label:"Rejected",   value:filtered.filter(c=>c.interviewStatus==="rejected").length,             color:C.red},
                                  {label:"On Hold",    value:filtered.filter(c=>c.interviewStatus==="hold").length,                 color:C.orange},
                                  {label:"Hired",      value:filtered.filter(c=>c.stage==="Hired").length,                         color:C.teal},
                                  {label:"Interviews", value:interviews.filter(i=>i.recruiterId===r.id).length,                     color:C.blue},
                                ].map(m=>(
                                  <div key={m.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                                    <span style={{fontSize:9,color:C.muted}}>{m.label}</span>
                                    <span style={{fontSize:12,color:m.color,fontFamily:FD}}>{m.value}</span>
                                  </div>
                                ))}
                                {/* By job */}
                                {jobs.length>0 && (
                                  <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                                    <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>BY JOB</div>
                                    {jobs.map(j=>{
                                      const cnt=filtered.filter(c=>c.jobId===j.id).length;
                                      if(cnt===0) return null;
                                      return (
                                        <div key={j.id} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                                          <span style={{fontSize:9,color:C.muted,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.title}</span>
                                          <span style={{fontSize:9,color:r.color}}>{cnt}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Candidate table */}
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 80px 60px 60px",gap:8,background:C.faint}}>
                      {["CANDIDATE","JOB","RECRUITER","STAGE","STATUS","SCORE","SOURCE"].map(h=>(
                        <div key={h} style={{fontSize:8,color:C.muted,letterSpacing:"0.1em"}}>{h}</div>
                      ))}
                    </div>
                    {reportData.length===0
                      ? <div style={{padding:"20px",textAlign:"center",fontSize:11,color:C.muted}}>No candidates match the selected filters.</div>
                      : reportData.map((c,i)=>{
                          const job = jobs.find(j=>j.id===c.jobId);
                          const rec = recruiters.find(r=>r.id===c.recruiterId);
                          const sm  = STATUS_META[c.interviewStatus] || STATUS_META.pending;
                          const stageMeta = STAGE_META[c.stage] || {color:C.muted};
                          return (
                            <div key={c.id} style={{padding:"9px 14px",borderBottom:i<reportData.length-1?`1px solid ${C.border}`:"none",display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 80px 60px 60px",gap:8,alignItems:"center"}}>
                              <div style={{display:"flex",gap:7,alignItems:"center"}}>
                                <Avatar text={c.avatar||ini(c.name||"?")} size={22} color={sc(c.score||0)}/>
                                <div>
                                  <div style={{fontSize:11,color:C.cream}}>{c.name}</div>
                                  <div style={{fontSize:9,color:C.muted}}>{c.exp}</div>
                                </div>
                              </div>
                              <div style={{fontSize:10,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job?.title||"—"}</div>
                              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                                <Avatar text={rec?.initials||"?"} size={18} color={rec?.color||C.muted}/>
                                <span style={{fontSize:9,color:C.muted}}>{rec?.name?.split(" ")[0]||"—"}</span>
                              </div>
                              <div><span style={{fontSize:9,color:stageMeta.color,fontFamily:FM}}>{c.stage||"—"}</span></div>
                              <div><Badge label={sm.label} color={sm.color}/></div>
                              <div style={{fontSize:12,color:sc(c.score||0),fontFamily:FD}}>{c.score||0}</div>
                              <div style={{fontSize:9,color:c.source==="ai"?C.purple:C.muted}}>{c.source==="ai"?"AI":"Manual"}</div>
                            </div>
                          );
                        })}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Schedule Interview Form ──────────────────────────────────────────────────
function ScheduleForm({ candidates, currentRecruiter, jobs, onAdd }) {
  const [cid,   setCid]   = useState("");
  const [date,  setDate]  = useState("");
  const [time,  setTime]  = useState("");
  const [level, setLevel] = useState("l1");
  const [type,  setType]  = useState("Technical");

  const submit = () => {
    if (!cid || !date || !time) return;
    const c = candidates.find(x => x.id === cid);
    if (!c) return;
    const lvl = INTERVIEW_LEVELS.find(l => l.id === level);
    onAdd({
      id:            `i_${Date.now()}`,
      candidateId:   cid,
      candidateName: c.name,
      role:          c.role,
      recruiterId:   currentRecruiter.id,
      jobId:         c.jobId,
      date, time, type,
      level,
      levelLabel:    lvl?.label || "Level 1",
      status:        "scheduled",
    });
    setCid(""); setDate(""); setTime("");
  };

  const sel = { background: C.faint, border: `1px solid ${C.border}`, borderRadius: 5, color: C.cream, fontFamily: FM, fontSize: 10, padding: "7px 10px", outline: "none" };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div>
        <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>CANDIDATE</div>
        <select value={cid} onChange={e => setCid(e.target.value)} style={{ ...sel, minWidth: 180 }}>
          <option value="">Select candidate</option>
          {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>LEVEL</div>
        <select value={level} onChange={e => setLevel(e.target.value)} style={sel}>
          {INTERVIEW_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>TYPE</div>
        <select value={type} onChange={e => setType(e.target.value)} style={sel}>
          {["Technical", "HR Screening", "Portfolio", "Culture Fit", "System Design"].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>DATE</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={sel} />
      </div>
      <div>
        <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>TIME</div>
        <input type="time" value={time} onChange={e => setTime(e.target.value)} style={sel} />
      </div>
      <button onClick={submit} style={{ padding: "8px 16px", borderRadius: 4, background: C.amber, border: "none", color: C.bg, fontFamily: FM, fontSize: 10, cursor: "pointer", fontWeight: 700, letterSpacing: "0.06em", height: 34 }}>+ SCHEDULE</button>
    </div>
  );
}
