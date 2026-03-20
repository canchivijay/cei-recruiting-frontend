import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase.js";

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

const RECRUITER_COLORS = [C.amber, C.blue, C.teal, C.purple, C.green, C.orange];
const RECRUITER_ROLE_OPTIONS = ["Lead Recruiter","Tech Recruiter","HR Recruiter","Campus Recruiter","Talent Partner","Sourcing Specialist"];
const DEPTS    = ["Engineering","Design","Product","Marketing","HR","Finance","Operations","Sales"];
const LOCATIONS = ["Remote","On-site","Hybrid","Chennai","Bangalore","Mumbai","Delhi","Hyderabad"];
const STAGES   = ["Applied","Screening","Tech Round 1","Tech Round 2","Tech Round 3","HR Round","Final Round","Offer","Hired","Rejected"];

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
  { id: "l1",    label: "Level 1", short: "L1", color: C.blue   },
  { id: "l2",    label: "Level 2", short: "L2", color: C.purple },
  { id: "final", label: "Final",   short: "FN", color: C.green  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sc  = v => v >= 88 ? C.green : v >= 70 ? C.amber : C.red;
const ini = n => (n||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const fmt = iso => new Date(iso).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});

const Avatar = ({ text, size=36, color=C.amber }) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:color+"20",border:`1px solid ${color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.33,fontFamily:FM,color,flexShrink:0,fontWeight:600}}>{text}</div>
);
const Badge = ({ label, color }) => (
  <span style={{padding:"2px 8px",borderRadius:4,fontSize:10,background:color+"20",color,border:`0.5px solid ${color}40`,fontFamily:FM,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</span>
);
const Bar = ({ val }) => (
  <div style={{display:"flex",alignItems:"center",gap:8}}>
    <div style={{flex:1,height:3,background:C.border,borderRadius:2,overflow:"hidden"}}>
      <div style={{width:`${val||0}%`,height:"100%",background:sc(val||0),borderRadius:2,transition:"width 0.8s ease"}}/>
    </div>
    <span style={{fontSize:11,color:sc(val||0),fontFamily:FM,minWidth:22}}>{val||0}</span>
  </div>
);
const Pill  = ({ label }) => (
  <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,background:C.faint,color:C.muted,fontFamily:FM,border:`0.5px solid ${C.border}`}}>{label}</span>
);
const Spin  = () => (
  <div style={{display:"inline-block",width:14,height:14,border:`2px solid ${C.amberDim}`,borderTop:`2px solid ${C.amber}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
);

// ─── CSV Export ───────────────────────────────────────────────────────────────
function downloadCSV(candidates, interviews, jobs, recruiters) {
  const rows = [
    ["Job Title","Department","Recruiter","Candidate Name","Stage","Fit Score",
     "Interview Status","Skills","Experience","Upload Date","Source"].join(",")
  ];
  candidates.forEach(c => {
    const job = jobs.find(j=>j.id===c.job_id);
    const rec = recruiters.find(r=>r.id===c.recruiter_id);
    rows.push([
      `"${job?.title||""}"`, `"${job?.dept||""}"`, `"${rec?.name||""}"`,
      `"${c.name}"`, `"${c.stage}"`, c.score,
      `"${STATUS_META[c.interview_status]?.label||""}"`,
      `"${(c.skills||[]).join("; ")}"`, `"${c.exp||""}"`,
      `"${c.uploaded_at?fmt(c.uploaded_at):""}"`,
      `"${c.source==="ai"?"AI Screened":"Manual"}"`
    ].join(","));
  });
  const encoded = encodeURIComponent(rows.join("\n"));
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encoded;
  a.download = `cei_report_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── AI Resume Parser (calls your backend) ────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function parseResume(base64, job) {
  const res = await fetch(`${API_URL}/api/parse-resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base64,
      jobTitle: job?.title || "",
      skills: job?.skills || [],
    }),
  });
  if (!res.ok) throw new Error("API error " + res.status);
  const { parsed } = await res.json();
  return parsed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Auth state ──
  const [session,          setSession]         = useState(null);
  const [authLoading,      setAuthLoading]      = useState(true);
  const [authMode,         setAuthMode]         = useState("login");
  const [authEmail,        setAuthEmail]        = useState("");
  const [authPassword,     setAuthPassword]     = useState("");
  const [authError,        setAuthError]        = useState("");
  const [authBusy,         setAuthBusy]         = useState(false);

  // Signup extras
  const [signupName,       setSignupName]       = useState("");
  const [signupRole,       setSignupRole]       = useState(RECRUITER_ROLE_OPTIONS[0]);
  const [signupColor,      setSignupColor]      = useState(RECRUITER_COLORS[0]);
  const [signupConfirm,    setSignupConfirm]    = useState("");

  // ── App data ──
  const [myProfile,        setMyProfile]        = useState(null);
  const [recruiters,       setRecruiters]       = useState([]);
  const [jobs,             setJobs]             = useState([]);
  const [candidates,       setCandidates]       = useState([]);
  const [interviews,       setInterviews]       = useState([]);
  const [dataLoading,      setDataLoading]      = useState(false);

  // ── UI state ──
  const [tab,              setTab]              = useState("dashboard");
  const [editingCand,      setEditingCand]      = useState(null);
  const [editForm,         setEditForm]         = useState({});
  const [pipelineJob,      setPipelineJob]      = useState("all");
  const [expandedJobId,    setExpandedJobId]    = useState(null);
  const [confirmClearJob,  setConfirmClearJob]  = useState(null);
  const [showJobForm,      setShowJobForm]      = useState(false);
  const [jTitle,           setJTitle]           = useState("");
  const [jDept,            setJDept]            = useState(DEPTS[0]);
  const [jLocation,        setJLocation]        = useState(LOCATIONS[0]);
  const [jSkillInput,      setJSkillInput]      = useState("");
  const [jSkills,          setJSkills]          = useState([]);
  const [jSecInput,        setJSecInput]        = useState("");
  const [jSecSkills,       setJSecSkills]       = useState([]);
  const [jResponsibilities,setJResponsibilities]= useState("");
  const [jUrgent,          setJUrgent]          = useState(false);
  const [jError,           setJError]           = useState("");
  const [uploadJob,        setUploadJob]        = useState("");
  const [uploading,        setUploading]        = useState(false);
  const [uploadResult,     setUploadResult]     = useState(null);
  const [uploadError,      setUploadError]      = useState(null);
  const [dragOver,         setDragOver]         = useState(false);
  const [bulkQueue,        setBulkQueue]        = useState([]);
  const [bulkProcessing,   setBulkProcessing]   = useState(false);
  const bulkQueueRef = useRef([]);
  const fileRef      = useRef(null);
  const [rptJob,           setRptJob]           = useState("all");
  const [rptRec,           setRptRec]           = useState("all");
  const [rptStat,          setRptStat]          = useState("all");

  // ── Auth listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load data when logged in ──
  useEffect(() => {
    if (session) loadAll();
  }, [session]);

  async function loadAll() {
    setDataLoading(true);
    const [
      { data: recs },
      { data: jbs },
      { data: cands },
      { data: ivs },
    ] = await Promise.all([
      supabase.from("recruiters").select("*").order("created_at"),
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("candidates").select("*").order("uploaded_at", { ascending: false }),
      supabase.from("interviews").select("*").order("created_at"),
    ]);
    setRecruiters(recs || []);
    setJobs(jbs || []);
    setCandidates(cands || []);
    setInterviews(ivs || []);

    // Load own profile
    const { data: profile } = await supabase
      .from("recruiters")
      .select("*")
      .eq("id", session.user.id)
      .single();
    setMyProfile(profile);
    setDataLoading(false);
  }

  // ── Auth handlers ──
  const handleLogin = async () => {
    setAuthBusy(true); setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    setAuthBusy(false);
  };

  const handleSignup = async () => {
    if (!signupName.trim())                           { setAuthError("Enter your full name."); return; }
    if (!authPassword || authPassword.length < 6)    { setAuthError("Password must be at least 6 characters."); return; }
    if (authPassword !== signupConfirm)               { setAuthError("Passwords do not match."); return; }
    setAuthBusy(true); setAuthError("");
    const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) { setAuthError(error.message); setAuthBusy(false); return; }
    if (data.user) {
      await supabase.from("recruiters").insert({
        id:       data.user.id,
        name:     signupName.trim(),
        initials: ini(signupName.trim()),
        role:     signupRole,
        color:    signupColor,
      });
    }
    setAuthBusy(false);
  };

  const handleLogout = () => supabase.auth.signOut();

  // ── CRUD helpers ──
  const myCandidates = myProfile ? candidates.filter(c => c.recruiter_id === myProfile.id) : candidates;

  const updateStage = async (id, stage) => {
    setCandidates(p => p.map(c => c.id===id ? {...c, stage} : c));
    await supabase.from("candidates").update({ stage }).eq("id", id);
  };

  const updateStatus = async (id, interview_status) => {
    setCandidates(p => p.map(c => c.id===id ? {...c, interview_status} : c));
    await supabase.from("candidates").update({ interview_status }).eq("id", id);
  };

  const updateInterview = async (id, patch) => {
    setInterviews(p => p.map(i => i.id===id ? {...i,...patch} : i));
    await supabase.from("interviews").update(patch).eq("id", id);
  };

  const updateFeedback = async (candId, feedback) => {
    setCandidates(p => p.map(c => c.id===candId ? {...c, feedback} : c));
    await supabase.from("candidates").update({ feedback }).eq("id", candId);
  };

  const saveEditCand = async (id) => {
    const patch = {
      name:             editForm.name?.trim(),
      role:             editForm.role,
      exp:              editForm.exp,
      email:            editForm.email,
      phone:            editForm.phone,
      location:         editForm.location,
      interview_status: editForm.interview_status,
      stage:            editForm.stage,
      skills:           editForm.skills?.split(",").map(s=>s.trim()).filter(Boolean),
      avatar:           ini(editForm.name?.trim()),
    };
    setCandidates(p => p.map(c => c.id!==id ? c : {...c,...patch}));
    await supabase.from("candidates").update(patch).eq("id", id);
    setEditingCand(null);
  };

  const handleCreateJob = async () => {
    if (!jTitle.trim()) { setJError("Job title is required."); return; }
    const newJob = {
      title: jTitle.trim(), dept: jDept, location: jLocation,
      skills: jSkills, secondary_skills: jSecSkills,
      responsibilities: jResponsibilities.trim(),
      urgent: jUrgent, status: "Active", created_by: myProfile?.id,
    };
    const { data, error } = await supabase.from("jobs").insert(newJob).select().single();
    if (!error && data) {
      setJobs(p => [data, ...p]);
      setJTitle(""); setJDept(DEPTS[0]); setJLocation(LOCATIONS[0]);
      setJSkills([]); setJSkillInput(""); setJSecSkills([]); setJSecInput("");
      setJResponsibilities(""); setJUrgent(false); setJError(""); setShowJobForm(false);
    } else {
      setJError(error?.message || "Failed to create job");
    }
  };

  const handleDeleteJob = async (id) => {
    setJobs(p => p.filter(j => j.id !== id));
    await supabase.from("jobs").delete().eq("id", id);
  };

  const toggleJobStatus = async (id) => {
    const job = jobs.find(j => j.id===id);
    const status = job?.status==="Active" ? "Closed" : "Active";
    setJobs(p => p.map(j => j.id===id ? {...j, status} : j));
    await supabase.from("jobs").update({ status }).eq("id", id);
  };

  const confirmClearCandidates = async (jobId) => {
    setCandidates(p => p.filter(c => c.job_id !== jobId));
    setInterviews(p => p.filter(i => i.job_id !== jobId));
    setConfirmClearJob(null);
    await supabase.from("candidates").delete().eq("job_id", jobId);
  };

  // ── Resume upload ──
  const handleFile = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") { setUploadError("Please upload a PDF."); return; }
    if (!uploadJob) { setUploadError("Select a job role first."); return; }
    setUploading(true); setUploadResult(null); setUploadError(null);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsDataURL(file);
      });
      const job = jobs.find(j => j.id===uploadJob);
      const parsed = await parseResume(base64, job);
      const nc = {
        name: parsed.name||"Unknown", avatar: ini(parsed.name||"UC"),
        role: parsed.currentRole||"—", exp: parsed.totalExp||"—",
        score: Math.min(100,Math.max(0,parsed.fitScore||50)),
        skills: parsed.skills||[], email: parsed.email, phone: parsed.phone,
        education: parsed.education, summary: parsed.summary,
        fit_reason: parsed.fitReason, red_flags: parsed.redFlags||[],
        strengths: parsed.strengths||[], job_id: uploadJob,
        recruiter_id: myProfile?.id, source: "ai",
        stage: "Applied", interview_status: "pending",
        uploaded_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("candidates").insert(nc).select().single();
      if (!error && data) { setCandidates(p => [data, ...p]); setUploadResult(data); }
      else setUploadError(error?.message || "Save failed");
    } catch(err) { setUploadError(err.message || "Parse failed"); }
    finally { setUploading(false); }
  }, [uploadJob, myProfile, jobs]);

  const handleBulkFiles = useCallback(async (files) => {
    if (!uploadJob) { setUploadError("Select a target role first."); return; }
    const pdfs = Array.from(files).filter(f => f.type==="application/pdf");
    if (pdfs.length===0) { setUploadError("No PDFs found."); return; }
    setUploadError(null); setUploadResult(null);
    const queue = pdfs.map((f,i) => ({ id:`q${Date.now()}_${i}`, name:f.name, file:f, status:"queued", result:null, error:null }));
    bulkQueueRef.current = queue;
    setBulkQueue([...queue]); setBulkProcessing(true);
    const job = jobs.find(j => j.id===uploadJob);
    for (let i=0; i<queue.length; i++) {
      bulkQueueRef.current = bulkQueueRef.current.map((q,idx) => idx===i ? {...q, status:"processing"} : q);
      setBulkQueue([...bulkQueueRef.current]);
      try {
        const base64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(queue[i].file);
        });
        const parsed = await parseResume(base64, job);
        const nc = {
          name: parsed.name||"Unknown", avatar: ini(parsed.name||"UC"),
          role: parsed.currentRole||"—", exp: parsed.totalExp||"—",
          score: Math.min(100,Math.max(0,parsed.fitScore||50)),
          skills: parsed.skills||[], email: parsed.email, phone: parsed.phone,
          education: parsed.education, summary: parsed.summary,
          fit_reason: parsed.fitReason, red_flags: parsed.redFlags||[],
          strengths: parsed.strengths||[], job_id: uploadJob,
          recruiter_id: myProfile?.id, source: "ai",
          stage: "Applied", interview_status: "pending",
          uploaded_at: new Date().toISOString(),
        };
        const { data } = await supabase.from("candidates").insert(nc).select().single();
        if (data) setCandidates(p => [data, ...p]);
        bulkQueueRef.current = bulkQueueRef.current.map((q,idx) => idx===i ? {...q, status:"done", result:data} : q);
        setBulkQueue([...bulkQueueRef.current]);
      } catch(err) {
        bulkQueueRef.current = bulkQueueRef.current.map((q,idx) => idx===i ? {...q, status:"error", error:err.message} : q);
        setBulkQueue([...bulkQueueRef.current]);
      }
    }
    setBulkProcessing(false);
  }, [uploadJob, myProfile, jobs]);

  // ─── Report filtered data ──────────────────────────────────────
  const reportData = candidates.filter(c => {
    if (rptJob!=="all" && c.job_id!==rptJob)                     return false;
    if (rptRec!=="all" && c.recruiter_id!==rptRec)               return false;
    if (rptStat!=="all" && c.interview_status!==rptStat)         return false;
    return true;
  });

  // ─── Auth Screen ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg,fontFamily:FM}}>
        <Spin/> <span style={{marginLeft:10,color:C.muted,fontSize:12}}>Loading...</span>
      </div>
    );
  }

  if (!session) {
    const inp = {background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none",width:"100%",letterSpacing:"0.04em",boxSizing:"border-box"};
    const lbl = {fontSize:9,color:C.muted,letterSpacing:"0.12em",marginBottom:5,display:"block"};
    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:C.bg,fontFamily:FM,padding:24}}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} input[type=password]{letter-spacing:0.15em}`}</style>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontFamily:FD,fontSize:44,color:C.amber,lineHeight:1}}>CEI Recruiting</div>
          <div style={{fontSize:10,color:C.muted,letterSpacing:"0.16em",marginTop:4}}>RECRUITMENT · HR · AI</div>
        </div>
        <div style={{display:"flex",gap:0,marginBottom:20,background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:3,width:"100%",maxWidth:420}}>
          {["login","signup"].map(m=>(
            <button key={m} onClick={()=>{setAuthMode(m);setAuthError("");}} style={{flex:1,padding:"7px 0",borderRadius:4,border:"none",cursor:"pointer",background:authMode===m?C.amber:"transparent",color:authMode===m?"#fff":C.muted,fontFamily:FM,fontSize:10,letterSpacing:"0.08em",transition:"all 0.15s"}}>
              {m==="login"?"SIGN IN":"CREATE ACCOUNT"}
            </button>
          ))}
        </div>
        <div style={{width:"100%",maxWidth:420,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
          {authMode==="signup" && (
            <div style={{marginBottom:12}}>
              <label style={lbl}>FULL NAME</label>
              <input value={signupName} onChange={e=>setSignupName(e.target.value)} placeholder="e.g. Priya Krishnan" style={inp}/>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <label style={lbl}>EMAIL</label>
            <input type="email" value={authEmail} onChange={e=>{setAuthEmail(e.target.value);setAuthError("");}} placeholder="you@company.com" style={inp}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={lbl}>PASSWORD</label>
            <input type="password" value={authPassword} onChange={e=>{setAuthPassword(e.target.value);setAuthError("");}} onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?handleLogin():null)} placeholder={authMode==="signup"?"Min 6 characters":""} style={inp}/>
          </div>
          {authMode==="signup" && (
            <>
              <div style={{marginBottom:12}}>
                <label style={lbl}>CONFIRM PASSWORD</label>
                <input type="password" value={signupConfirm} onChange={e=>{setSignupConfirm(e.target.value);setAuthError("");}} onKeyDown={e=>e.key==="Enter"&&handleSignup()} placeholder="Re-enter password" style={inp}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={lbl}>ROLE</label>
                <select value={signupRole} onChange={e=>setSignupRole(e.target.value)} style={{...inp,cursor:"pointer"}}>
                  {RECRUITER_ROLE_OPTIONS.map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <div style={{marginBottom:18}}>
                <label style={lbl}>PROFILE COLOUR</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {RECRUITER_COLORS.map(col=>(
                    <button key={col} onClick={()=>setSignupColor(col)} style={{width:28,height:28,borderRadius:"50%",background:col+"30",border:`2px solid ${signupColor===col?col:col+"40"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {signupColor===col&&<div style={{width:10,height:10,borderRadius:"50%",background:col}}/>}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {authError && <div style={{marginBottom:10,padding:"7px 10px",background:C.red+"15",border:`1px solid ${C.red}40`,borderRadius:5,fontSize:11,color:C.red}}>{authError}</div>}
          <button
            onClick={authMode==="login"?handleLogin:handleSignup}
            disabled={authBusy}
            style={{width:"100%",padding:"10px 0",borderRadius:5,background:authBusy?C.border:C.amber,border:"none",color:authBusy?C.muted:"#fff",fontFamily:FM,fontSize:11,cursor:authBusy?"not-allowed":"pointer",fontWeight:700,letterSpacing:"0.08em"}}>
            {authBusy ? "Please wait..." : authMode==="login" ? "SIGN IN →" : "CREATE ACCOUNT & SIGN IN →"}
          </button>
          {authMode==="login" && (
            <p style={{marginTop:10,textAlign:"center",fontSize:10,color:C.muted}}>
              No account? <button onClick={()=>{setAuthMode("signup");setAuthError("");}} style={{background:"none",border:"none",color:C.amber,cursor:"pointer",fontFamily:FM,fontSize:10,textDecoration:"underline"}}>Create one</button>
            </p>
          )}
        </div>
        <div style={{marginTop:20,fontSize:9,color:C.muted,letterSpacing:"0.1em"}}>ALL ACTIVITY IS LOGGED PER RECRUITER</div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg,fontFamily:FM,flexDirection:"column",gap:12}}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Spin/>
        <span style={{color:C.muted,fontSize:12}}>Loading your workspace...</span>
      </div>
    );
  }

  // ─── Nav Item ─────────────────────────────────────────────────
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
      {badge>0 && <span style={{fontSize:9,background:C.red+"30",color:C.red,padding:"1px 5px",borderRadius:3}}>{badge}</span>}
    </button>
  );

  const pendingInterviews = interviews.filter(i=>i.recruiter_id===myProfile?.id&&i.status==="scheduled").length;
  const pendingCands      = myCandidates.filter(c=>c.interview_status==="pending").length;
  const aiScanned         = myCandidates.filter(c=>c.source==="ai").length;

  const LABEL = { dashboard:"Overview", candidates:"My Candidates", upload:"Upload Resumes", jobs:"Job Postings", pipeline:"Pipeline", interviews:"Interviews", report:"Activity Report" };

  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:FM,color:C.cream,overflow:"hidden"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}} .fi{animation:fadeIn 0.25s ease} input::placeholder{color:${C.muted}} ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}`}</style>

      {/* Sidebar */}
      <div style={{width:196,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"16px 14px 12px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontFamily:FD,fontSize:20,color:C.amber,lineHeight:1}}>CEI Recruiting</div>
          <div style={{fontSize:8,color:C.muted,marginTop:2,letterSpacing:"0.14em"}}>RECRUITMENT · HR · AI</div>
        </div>
        <div style={{padding:"10px 8px",flex:1,overflowY:"auto"}}>
          <div style={{fontSize:8,color:C.muted,padding:"0 8px 5px",letterSpacing:"0.14em"}}>MY WORKSPACE</div>
          <NavItem id="dashboard"  label="Dashboard"     icon="◈" badge={0} />
          <NavItem id="candidates" label="My Candidates" icon="○" badge={pendingCands} />
          <NavItem id="upload"     label="Upload Resume" icon="⬆" badge={aiScanned} />
          <NavItem id="jobs"       label="Job Postings"  icon="◇" badge={jobs.filter(j=>j.status==="Active").length} />
          <NavItem id="pipeline"   label="Pipeline"      icon="⬡" badge={0} />
          <NavItem id="interviews" label="Interviews"    icon="◻" badge={pendingInterviews} />
          <div style={{fontSize:8,color:C.muted,padding:"10px 8px 5px",letterSpacing:"0.14em"}}>TEAM</div>
          <NavItem id="report"     label="Activity Report" icon="◇" badge={0} />
        </div>
        <div style={{padding:12,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <Avatar text={myProfile?.initials||"?"} size={28} color={myProfile?.color||C.amber}/>
            <div>
              <div style={{fontSize:11,color:C.cream}}>{myProfile?.name||session.user.email}</div>
              <div style={{fontSize:9,color:C.muted}}>{myProfile?.role||""}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{width:"100%",padding:"5px 0",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:9,cursor:"pointer",letterSpacing:"0.06em"}}>SIGN OUT</button>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"10px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.surface,flexShrink:0}}>
          <span style={{fontFamily:FD,fontSize:20,color:C.cream}}>{LABEL[tab]}</span>
          <div style={{display:"flex",gap:8}}>
            <Badge label={`${myCandidates.length} mine`} color={myProfile?.color||C.amber}/>
            <Badge label={`${candidates.length} total`}  color={C.muted}/>
          </div>
        </div>

        <div style={{flex:1,padding:22,overflow:"auto"}}>

          {/* ══ DASHBOARD ══ */}
          {tab==="dashboard" && (
            <div className="fi">
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:18}}>
                {[
                  {label:"Total",    value:candidates.length,                                            color:C.muted},
                  {label:"Approved", value:candidates.filter(c=>c.interview_status==="approved").length, color:C.green},
                  {label:"Rejected", value:candidates.filter(c=>c.interview_status==="rejected").length, color:C.red},
                  {label:"On Hold",  value:candidates.filter(c=>c.interview_status==="hold").length,     color:C.orange},
                  {label:"Offered",  value:candidates.filter(c=>c.stage==="Offer").length,               color:C.teal},
                  {label:"Hired",    value:candidates.filter(c=>c.stage==="Hired").length,               color:C.green},
                ].map(m=>(
                  <div key={m.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",borderTop:`2px solid ${m.color}`}}>
                    <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>{m.label.toUpperCase()}</div>
                    <div style={{fontFamily:FD,fontSize:30,color:m.color,lineHeight:1}}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Interview rounds table */}
              <div style={{marginBottom:8,fontSize:9,color:C.muted,letterSpacing:"0.12em"}}>INTERVIEW ROUNDS BREAKDOWN</div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,marginBottom:18,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"1.8fr repeat(4,1fr)",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{padding:"10px 14px",fontSize:9,color:C.muted,letterSpacing:"0.1em"}}>CANDIDATE</div>
                  {INTERVIEW_LEVELS.map(lvl=>(
                    <div key={lvl.id} style={{padding:"10px 10px",fontSize:9,color:lvl.color,letterSpacing:"0.08em",borderLeft:`1px solid ${C.border}`,textAlign:"center"}}>{lvl.label.toUpperCase()}</div>
                  ))}
                  <div style={{padding:"10px 10px",fontSize:9,color:C.muted,letterSpacing:"0.08em",borderLeft:`1px solid ${C.border}`,textAlign:"center"}}>STATUS</div>
                </div>
                {candidates.length===0
                  ? <div style={{padding:"20px",textAlign:"center",fontSize:11,color:C.muted}}>No candidates yet.</div>
                  : candidates.map((c,i)=>{
                    const job = jobs.find(j=>j.id===c.job_id);
                    const sm  = STATUS_META[c.interview_status]||STATUS_META.pending;
                    return (
                      <div key={c.id} style={{display:"grid",gridTemplateColumns:"1.8fr repeat(4,1fr)",borderBottom:i<candidates.length-1?`1px solid ${C.border}`:"none",alignItems:"center"}}>
                        <div style={{padding:"9px 14px",display:"flex",gap:8,alignItems:"center"}}>
                          <Avatar text={c.avatar||ini(c.name)} size={24} color={sc(c.score)}/>
                          <div>
                            <div style={{fontSize:11,color:C.cream}}>{c.name}</div>
                            <div style={{fontSize:9,color:C.muted}}>{job?.title||"—"}</div>
                          </div>
                        </div>
                        {INTERVIEW_LEVELS.map(lvl=>{
                          const round = interviews.find(iv=>iv.candidate_id===c.id&&iv.level===lvl.id);
                          const rst   = round ? INTERVIEW_STATUS_META[round.status] : null;
                          return (
                            <div key={lvl.id} style={{padding:"9px 10px",borderLeft:`1px solid ${C.border}`,textAlign:"center"}}>
                              {round ? <span style={{padding:"2px 7px",borderRadius:4,fontSize:9,background:rst?.color+"20",color:rst?.color,fontFamily:FM,border:`0.5px solid ${rst?.color}40`}}>{rst?.label}</span>
                                     : <span style={{fontSize:9,color:C.faint}}>—</span>}
                            </div>
                          );
                        })}
                        <div style={{padding:"9px 10px",borderLeft:`1px solid ${C.border}`,textAlign:"center"}}>
                          <span style={{padding:"2px 7px",borderRadius:4,fontSize:9,background:sm.color+"20",color:sm.color,fontFamily:FM,border:`0.5px solid ${sm.color}40`}}>{sm.label}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* My stats + upcoming */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1.6fr",gap:14}}>
                <div>
                  <div style={{marginBottom:8,fontSize:9,color:C.muted,letterSpacing:"0.12em"}}>YOUR STATS</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {[
                      {label:"My Candidates", value:myCandidates.length,                                                   color:myProfile?.color||C.amber},
                      {label:"Approved",       value:myCandidates.filter(c=>c.interview_status==="approved").length,        color:C.green},
                      {label:"Rejected",       value:myCandidates.filter(c=>c.interview_status==="rejected").length,        color:C.red},
                      {label:"On Hold",        value:myCandidates.filter(c=>c.interview_status==="hold").length,            color:C.orange},
                      {label:"Offered",        value:myCandidates.filter(c=>c.stage==="Offer").length,                      color:C.teal},
                      {label:"Hired",          value:myCandidates.filter(c=>c.stage==="Hired").length,                      color:C.green},
                    ].map(m=>(
                      <div key={m.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:10,color:C.muted}}>{m.label}</span>
                        <span style={{fontFamily:FD,fontSize:20,color:m.color,lineHeight:1}}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{marginBottom:8,fontSize:9,color:C.muted,letterSpacing:"0.12em"}}>UPCOMING INTERVIEWS</div>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    {interviews.filter(i=>i.recruiter_id===myProfile?.id).length===0
                      ? <div style={{padding:"20px",textAlign:"center",fontSize:11,color:C.muted}}>No interviews scheduled yet.</div>
                      : interviews.filter(i=>i.recruiter_id===myProfile?.id).map(iv=>{
                        const c   = candidates.find(x=>x.id===iv.candidate_id);
                        const job = jobs.find(j=>j.id===iv.job_id);
                        const lvl = INTERVIEW_LEVELS.find(l=>l.id===iv.level);
                        return (
                          <div key={iv.id} style={{padding:"9px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
                            <Avatar text={ini(iv.candidate_name)} size={28} color={sc(c?.score||70)}/>
                            <div style={{flex:1}}>
                              <div style={{fontSize:11,color:C.cream}}>{iv.candidate_name}</div>
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
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {myCandidates.length===0 && (
                  <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",fontSize:11,color:C.muted}}>No candidates yet. Upload resumes to get started.</div>
                )}
                {myCandidates.map(c=>{
                  const job       = jobs.find(j=>j.id===c.job_id);
                  const sm        = STATUS_META[c.interview_status]||STATUS_META.pending;
                  const isEditing = editingCand===c.id;
                  const iStyle    = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none",width:"100%",boxSizing:"border-box"};
                  return (
                    <div key={c.id} style={{background:C.card,border:`1px solid ${isEditing?C.amber+"80":C.border}`,borderRadius:8,padding:"12px 16px"}}>
                      {!isEditing ? (
                        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                          <Avatar text={c.avatar||ini(c.name)} size={38} color={sc(c.score)}/>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                              <div>
                                <div style={{fontSize:14,color:C.cream}}>{c.name}</div>
                                <div style={{fontSize:10,color:C.muted}}>{c.role} · {c.exp} · {job?.title||"—"}</div>
                              </div>
                              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                                <Badge label={c.stage} color={STAGE_META[c.stage]?.color||C.muted}/>
                                <Badge label={sm.label} color={sm.color}/>
                                {c.source==="ai" && <Badge label="AI" color={C.purple}/>}
                                <button onClick={()=>{setEditingCand(c.id);setEditForm({name:c.name,role:c.role||"",exp:c.exp||"",email:c.email||"",phone:c.phone||"",location:c.location||"",interview_status:c.interview_status||"pending",stage:c.stage||"Applied",skills:(c.skills||[]).join(", ")});}}
                                  style={{padding:"3px 10px",borderRadius:4,border:`0.5px solid ${C.amber}60`,background:C.amber+"12",color:C.amber,fontFamily:FM,fontSize:9,cursor:"pointer",letterSpacing:"0.06em"}}>EDIT</button>
                              </div>
                            </div>
                            {(c.email||c.phone||c.location) && (
                              <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
                                {c.email    && <span style={{fontSize:10,color:C.teal}}>✉ {c.email}</span>}
                                {c.phone    && <span style={{fontSize:10,color:C.teal}}>✆ {c.phone}</span>}
                                {c.location && <span style={{fontSize:10,color:C.muted}}>◻ {c.location}</span>}
                              </div>
                            )}
                            <div style={{marginBottom:8}}><Bar val={c.score}/></div>
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                              {(c.skills||[]).map(s=><Pill key={s} label={s}/>)}
                            </div>
                            {/* Interview rounds */}
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:8}}>INTERVIEW ROUNDS</div>
                              <div style={{display:"flex",gap:8}}>
                                {INTERVIEW_LEVELS.map(lvl=>{
                                  const round = interviews.find(iv=>iv.candidate_id===c.id&&iv.level===lvl.id);
                                  const rst   = round ? INTERVIEW_STATUS_META[round.status] : null;
                                  return (
                                    <div key={lvl.id} style={{flex:1,background:round?lvl.color+"12":C.faint,border:`1px solid ${round?lvl.color+"50":C.border}`,borderRadius:6,padding:"8px 10px",textAlign:"center"}}>
                                      <div style={{fontSize:9,color:lvl.color,fontFamily:FM,fontWeight:700,marginBottom:4}}>{lvl.label}</div>
                                      {round ? (
                                        <>
                                          <div style={{fontSize:9,color:C.muted,marginBottom:4}}>{round.date} · {round.time}</div>
                                          <select value={round.status} onChange={e=>updateInterview(round.id,{status:e.target.value})}
                                            style={{width:"100%",background:rst?.color+"15",border:`1px solid ${rst?.color}50`,borderRadius:4,color:rst?.color,fontFamily:FM,fontSize:9,padding:"3px 6px",cursor:"pointer",outline:"none",fontWeight:700}}>
                                            {["scheduled","completed","approved","cancelled"].map(s=>(
                                              <option key={s} value={s}>{INTERVIEW_STATUS_META[s].label}</option>
                                            ))}
                                          </select>
                                        </>
                                      ) : <div style={{fontSize:9,color:C.muted,opacity:0.5}}>Not scheduled</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                              <span style={{fontSize:9,color:C.muted}}>STATUS:</span>
                              {["approved","rejected","hold","pending"].map(st=>(
                                <button key={st} onClick={()=>updateStatus(c.id,st)}
                                  style={{padding:"4px 10px",borderRadius:4,border:`0.5px solid ${STATUS_META[st].color}${c.interview_status===st?"":"40"}`,background:c.interview_status===st?STATUS_META[st].color+"20":"transparent",color:STATUS_META[st].color,fontFamily:FM,fontSize:9,cursor:"pointer",fontWeight:c.interview_status===st?"700":"400",letterSpacing:"0.06em"}}>
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
                      ) : (
                        <div className="fi">
                          <div style={{fontSize:9,color:C.amber,letterSpacing:"0.1em",marginBottom:14}}>EDITING — {c.name}</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                            {[{k:"name",l:"FULL NAME"},{k:"role",l:"CURRENT ROLE"},{k:"email",l:"EMAIL ID"},{k:"phone",l:"MOBILE NUMBER"},{k:"location",l:"LOCATION"},{k:"exp",l:"EXPERIENCE"}].map(({k,l})=>(
                              <div key={k}>
                                <div style={{fontSize:9,color:C.muted,marginBottom:4}}>{l}</div>
                                <input value={editForm[k]||""} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))} style={iStyle}/>
                              </div>
                            ))}
                            <div>
                              <div style={{fontSize:9,color:C.muted,marginBottom:4}}>INTERVIEW STATUS</div>
                              <select value={editForm.interview_status} onChange={e=>setEditForm(f=>({...f,interview_status:e.target.value}))} style={{...iStyle,cursor:"pointer"}}>
                                {["pending","approved","rejected","hold"].map(s=><option key={s} value={s}>{STATUS_META[s].label}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{fontSize:9,color:C.muted,marginBottom:4}}>PIPELINE STAGE</div>
                              <select value={editForm.stage} onChange={e=>setEditForm(f=>({...f,stage:e.target.value}))} style={{...iStyle,cursor:"pointer"}}>
                                {STAGES.map(s=><option key={s}>{s}</option>)}
                              </select>
                            </div>
                            <div style={{gridColumn:"1/-1"}}>
                              <div style={{fontSize:9,color:C.muted,marginBottom:4}}>SKILLS (comma-separated)</div>
                              <input value={editForm.skills||""} onChange={e=>setEditForm(f=>({...f,skills:e.target.value}))} placeholder="React, TypeScript, Node.js" style={iStyle}/>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>saveEditCand(c.id)} style={{padding:"7px 18px",borderRadius:4,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700}}>SAVE CHANGES</button>
                            <button onClick={()=>setEditingCand(null)} style={{padding:"7px 14px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:10,cursor:"pointer"}}>CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ UPLOAD ══ */}
          {tab==="upload" && (
            <div className="fi" style={{maxWidth:800}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:10}}>STEP 1 — SELECT TARGET ROLE</div>
                {jobs.filter(j=>j.status==="Active").length===0 ? (
                  <div style={{padding:"16px",textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:6}}>
                    <div style={{fontSize:11,color:C.muted,marginBottom:8}}>No active jobs yet.</div>
                    <button onClick={()=>setTab("jobs")} style={{padding:"6px 14px",borderRadius:4,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700}}>CREATE A JOB FIRST →</button>
                  </div>
                ) : (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                    {jobs.filter(j=>j.status==="Active").map(j=>(
                      <button key={j.id} onClick={()=>{setUploadJob(j.id);setBulkQueue([]);setUploadResult(null);setUploadError(null);}}
                        style={{padding:"10px 12px",borderRadius:6,border:`1px solid ${uploadJob===j.id?C.amber+"80":C.border}`,background:uploadJob===j.id?C.amber+"12":"transparent",color:uploadJob===j.id?C.amber:C.muted,fontFamily:FM,fontSize:10,cursor:"pointer",textAlign:"left"}}>
                        <div style={{fontSize:11,color:uploadJob===j.id?C.amber:C.cream,marginBottom:2}}>{j.title}</div>
                        <div style={{fontSize:9,opacity:0.7}}>{j.dept} · {j.location}</div>
                        <div style={{fontSize:9,marginTop:4,color:C.muted}}>{candidates.filter(c=>c.job_id===j.id).length} screened</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em"}}>STEP 2 — DROP RESUMES · Uploading as <span style={{color:myProfile?.color||C.amber}}>{myProfile?.name}</span></div>
                  {bulkQueue.length>0 && <button onClick={()=>{setBulkQueue([]);bulkQueueRef.current=[];}} style={{padding:"3px 10px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:9,cursor:"pointer"}}>CLEAR</button>}
                </div>
                <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
                  onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files;if(f.length>1)handleBulkFiles(f);else if(f.length===1)handleFile(f[0]);}}
                  onClick={()=>fileRef.current?.click()}
                  style={{border:`1.5px dashed ${dragOver?C.amber:C.border}`,borderRadius:8,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:dragOver?C.amber+"08":C.surface,transition:"all 0.2s",marginBottom:bulkQueue.length>0?12:0}}>
                  <input ref={fileRef} type="file" accept=".pdf" multiple style={{display:"none"}} onChange={e=>{const f=e.target.files;if(!f||!f.length)return;f.length>1?handleBulkFiles(f):handleFile(f[0]);e.target.value="";}}/>
                  {uploading ? (
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                      <Spin/><div style={{fontSize:12,color:C.amber}}>Claude is parsing the resume...</div>
                    </div>
                  ) : (
                    <>
                      <div style={{fontSize:28,marginBottom:8,opacity:0.35}}>⬆</div>
                      <div style={{fontSize:13,color:C.cream,marginBottom:4}}>Drop PDFs or click to browse</div>
                      <div style={{fontSize:10,color:C.muted}}>Select <strong style={{color:C.amber}}>multiple files</strong> for bulk screening</div>
                    </>
                  )}
                </div>
                {uploadError && <div style={{marginTop:8,padding:"8px 12px",background:C.red+"15",border:`1px solid ${C.red}40`,borderRadius:6,fontSize:11,color:C.red}}>{uploadError}</div>}
                {bulkQueue.length>0 && (
                  <div>
                    <div style={{display:"flex",gap:14,marginBottom:10,padding:"8px 12px",background:C.faint,borderRadius:6,alignItems:"center"}}>
                      <span style={{fontSize:10,color:C.cream,flex:1}}>{bulkProcessing?"Processing...":"Batch complete"}</span>
                      <span style={{fontSize:10,color:C.amber}}>{bulkQueue.filter(q=>q.status==="processing").length} processing</span>
                      <span style={{fontSize:10,color:C.green}}>{bulkQueue.filter(q=>q.status==="done").length} done</span>
                      <span style={{fontSize:10,color:C.red}}>{bulkQueue.filter(q=>q.status==="error").length} errors</span>
                    </div>
                    <div style={{height:4,background:C.border,borderRadius:2,marginBottom:12,overflow:"hidden"}}>
                      <div style={{width:`${Math.round((bulkQueue.filter(q=>q.status==="done"||q.status==="error").length/bulkQueue.length)*100)}%`,height:"100%",background:C.amber,borderRadius:2,transition:"width 0.4s ease"}}/>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {bulkQueue.map((item,i)=>{
                        const stColor={queued:C.muted,processing:C.amber,done:C.green,error:C.red}[item.status];
                        return (
                          <div key={item.id} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 12px",background:C.surface,borderRadius:6,border:`1px solid ${item.status==="done"?C.green+"30":item.status==="error"?C.red+"30":C.border}`}}>
                            <div style={{width:20,height:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                              {item.status==="processing"?<Spin/>:<span style={{fontSize:12,color:stColor}}>{{queued:"○",done:"●",error:"✕"}[item.status]||"○"}</span>}
                            </div>
                            <span style={{fontSize:9,color:C.muted,width:20}}>#{i+1}</span>
                            <span style={{fontSize:10,color:C.cream,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</span>
                            {item.result && <><span style={{fontSize:10,color:C.cream}}>{item.result.name}</span><span style={{fontSize:11,color:sc(item.result.score),fontFamily:FD}}>{item.result.score}</span></>}
                            {item.error  && <span style={{fontSize:9,color:C.red}}>{item.error}</span>}
                            <span style={{fontSize:9,color:stColor,fontFamily:FM,letterSpacing:"0.06em",minWidth:64,textAlign:"right",textTransform:"uppercase"}}>{item.status}</span>
                          </div>
                        );
                      })}
                    </div>
                    {!bulkProcessing && (
                      <div style={{display:"flex",gap:8,marginTop:12}}>
                        <button onClick={()=>setTab("candidates")} style={{padding:"7px 16px",borderRadius:4,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700}}>VIEW {bulkQueue.filter(q=>q.status==="done").length} CANDIDATES →</button>
                        <button onClick={()=>{setBulkQueue([]);bulkQueueRef.current=[];}} style={{padding:"7px 14px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:10,cursor:"pointer"}}>SCREEN MORE</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {uploadResult && bulkQueue.length===0 && (
                <div className="fi" style={{background:C.card,border:`1px solid ${C.green}50`,borderRadius:8,padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{fontSize:9,color:C.green,letterSpacing:"0.1em"}}>✓ ADDED TO PIPELINE</div>
                    <Badge label={`${uploadResult.score}/100 FIT`} color={sc(uploadResult.score)}/>
                  </div>
                  <div style={{fontFamily:FD,fontSize:18,color:C.cream,marginBottom:4}}>{uploadResult.name}</div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:10}}>{uploadResult.role} · {uploadResult.exp}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>{(uploadResult.skills||[]).map(s=><Pill key={s} label={s}/>)}</div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:10}}>{uploadResult.summary}</div>
                  <div style={{padding:"8px 10px",background:C.faint,borderRadius:6,fontSize:10,color:C.muted,marginBottom:12}}>
                    <span style={{color:C.amber}}>Fit: </span>{uploadResult.fit_reason}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setTab("candidates")} style={{padding:"7px 14px",borderRadius:4,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:9,cursor:"pointer",fontWeight:700}}>VIEW MY CANDIDATES →</button>
                    <button onClick={()=>{setUploadResult(null);}} style={{padding:"7px 14px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:9,cursor:"pointer"}}>SCREEN ANOTHER</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ JOBS ══ */}
          {tab==="jobs" && (
            <div className="fi">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em"}}>{jobs.length} JOBS · {jobs.filter(j=>j.status==="Active").length} ACTIVE</div>
                <button onClick={()=>{setShowJobForm(v=>!v);setJError("");}} style={{padding:"8px 18px",borderRadius:4,background:showJobForm?"transparent":C.amber,border:`1px solid ${showJobForm?C.border:C.amber}`,color:showJobForm?C.muted:"#fff",fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700}}>{showJobForm?"✕ CANCEL":"+ POST NEW JOB"}</button>
              </div>
              {showJobForm && (
                <div className="fi" style={{background:C.card,border:`1px solid ${C.amber}40`,borderRadius:8,padding:20,marginBottom:16}}>
                  <div style={{fontSize:9,color:C.amber,letterSpacing:"0.12em",marginBottom:16}}>NEW JOB POSTING</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{fontSize:9,color:C.muted,marginBottom:5}}>JOB TITLE *</div>
                      <input value={jTitle} onChange={e=>{setJTitle(e.target.value);setJError("");}} placeholder="e.g. Senior Backend Engineer" style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none",boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.muted,marginBottom:5}}>DEPARTMENT</div>
                      <select value={jDept} onChange={e=>setJDept(e.target.value)} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none",cursor:"pointer"}}>
                        {DEPTS.map(d=><option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.muted,marginBottom:5}}>LOCATION</div>
                      <select value={jLocation} onChange={e=>setJLocation(e.target.value)} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none",cursor:"pointer"}}>
                        {LOCATIONS.map(l=><option key={l}>{l}</option>)}
                      </select>
                    </div>
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{fontSize:9,color:C.muted,marginBottom:5}}>PRIMARY SKILLS <span style={{fontSize:8,opacity:0.6}}>(Enter to add)</span></div>
                      <div style={{display:"flex",gap:6,marginBottom:8}}>
                        <input value={jSkillInput} onChange={e=>setJSkillInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(jSkillInput.trim()&&!jSkills.includes(jSkillInput.trim())){setJSkills(p=>[...p,jSkillInput.trim()]);}setJSkillInput("");}}} placeholder="e.g. React, Python..." style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none"}}/>
                        <button onClick={()=>{if(jSkillInput.trim())setJSkills(p=>[...p,jSkillInput.trim()]);setJSkillInput("");}} style={{padding:"8px 14px",borderRadius:6,background:C.amber+"22",border:`1px solid ${C.amber}40`,color:C.amber,fontFamily:FM,fontSize:11,cursor:"pointer"}}>+</button>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {jSkills.map(s=><span key={s} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:20,background:C.amber+"18",border:`0.5px solid ${C.amber}40`,color:C.amber,fontFamily:FM,fontSize:10}}>{s}<button onClick={()=>setJSkills(p=>p.filter(x=>x!==s))} style={{background:"none",border:"none",color:C.amberDim,cursor:"pointer",padding:0,fontSize:12,lineHeight:1}}>×</button></span>)}
                      </div>
                    </div>
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{fontSize:9,color:C.muted,marginBottom:5}}>SECONDARY SKILLS</div>
                      <div style={{display:"flex",gap:6,marginBottom:8}}>
                        <input value={jSecInput} onChange={e=>setJSecInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(jSecInput.trim())setJSecSkills(p=>[...p,jSecInput.trim()]);setJSecInput("");}}} placeholder="e.g. Docker, GraphQL..." style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none"}}/>
                        <button onClick={()=>{if(jSecInput.trim())setJSecSkills(p=>[...p,jSecInput.trim()]);setJSecInput("");}} style={{padding:"8px 14px",borderRadius:6,background:C.blue+"22",border:`1px solid ${C.blue}40`,color:C.blue,fontFamily:FM,fontSize:11,cursor:"pointer"}}>+</button>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {jSecSkills.map(s=><span key={s} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:20,background:C.blue+"18",border:`0.5px solid ${C.blue}40`,color:C.blue,fontFamily:FM,fontSize:10}}>{s}<button onClick={()=>setJSecSkills(p=>p.filter(x=>x!==s))} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",padding:0,fontSize:12,lineHeight:1}}>×</button></span>)}
                      </div>
                    </div>
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{fontSize:9,color:C.muted,marginBottom:5}}>RESPONSIBILITIES</div>
                      <textarea value={jResponsibilities} onChange={e=>setJResponsibilities(e.target.value)} rows={4} placeholder={"• Lead the design and implementation...\n• Collaborate with cross-functional teams..."} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.cream,fontFamily:FM,fontSize:11,outline:"none",resize:"vertical",lineHeight:1.6,boxSizing:"border-box"}}/>
                    </div>
                    <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:10}}>
                      <button onClick={()=>setJUrgent(v=>!v)} style={{width:36,height:20,borderRadius:10,background:jUrgent?C.red+"40":C.faint,border:`1px solid ${jUrgent?C.red:C.border}`,cursor:"pointer",position:"relative",flexShrink:0}}>
                        <div style={{width:12,height:12,borderRadius:"50%",background:jUrgent?C.red:C.muted,position:"absolute",top:3,left:jUrgent?20:4,transition:"left 0.2s"}}/>
                      </button>
                      <span style={{fontSize:10,color:jUrgent?C.red:C.muted}}>MARK AS URGENT</span>
                    </div>
                  </div>
                  {jError && <div style={{padding:"7px 10px",background:C.red+"15",border:`1px solid ${C.red}40`,borderRadius:5,fontSize:11,color:C.red,marginBottom:10}}>{jError}</div>}
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={handleCreateJob} style={{padding:"9px 22px",borderRadius:4,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700}}>PUBLISH JOB</button>
                    <button onClick={()=>setShowJobForm(false)} style={{padding:"9px 16px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:10,cursor:"pointer"}}>CANCEL</button>
                  </div>
                </div>
              )}
              {jobs.length===0 ? (
                <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:8,padding:"40px 32px",textAlign:"center"}}>
                  <div style={{fontSize:28,opacity:0.15,marginBottom:10}}>◇</div>
                  <div style={{fontSize:13,color:C.muted,marginBottom:16}}>No jobs posted yet</div>
                  <button onClick={()=>setShowJobForm(true)} style={{padding:"8px 18px",borderRadius:4,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700}}>+ POST FIRST JOB</button>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {jobs.map(job=>{
                    const candCount    = candidates.filter(c=>c.job_id===job.id).length;
                    const approvedCount= candidates.filter(c=>c.job_id===job.id&&c.interview_status==="approved").length;
                    const hiredCount   = candidates.filter(c=>c.stage==="Hired"&&c.job_id===job.id).length;
                    const createdBy    = recruiters.find(r=>r.id===job.created_by);
                    const isExpanded   = expandedJobId===job.id;
                    const jobCands     = candidates.filter(c=>c.job_id===job.id);
                    return (
                      <div key={job.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 20px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                              <span style={{fontFamily:FD,fontSize:18,color:C.cream}}>{job.title}</span>
                              {job.urgent && <Badge label="Urgent" color={C.red}/>}
                              <Badge label={job.status} color={job.status==="Active"?C.green:C.muted}/>
                            </div>
                            <div style={{display:"flex",gap:16,fontSize:10,color:C.muted,marginBottom:10}}>
                              <span>◇ {job.dept}</span><span>◻ {job.location}</span>
                              {createdBy && <span>◈ {createdBy.name}</span>}
                            </div>
                            {(job.skills||[]).length>0 && <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>{(job.skills||[]).map(s=><Pill key={s} label={s}/>)}</div>}
                            {(job.secondary_skills||[]).length>0 && <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{(job.secondary_skills||[]).map(s=><span key={s} style={{padding:"2px 8px",borderRadius:20,fontSize:10,background:C.blue+"15",color:C.blue,fontFamily:FM}}>{s}</span>)}</div>}
                          </div>
                          <div style={{display:"flex",gap:14,alignItems:"flex-start",flexShrink:0,marginLeft:20}}>
                            <button onClick={()=>setExpandedJobId(isExpanded?null:job.id)} style={{textAlign:"center",background:"transparent",border:`1px solid ${isExpanded?C.amber+"80":C.border}`,borderRadius:6,padding:"8px 14px",cursor:"pointer"}}>
                              <div style={{fontFamily:FD,fontSize:26,color:C.amber,lineHeight:1}}>{candCount}</div>
                              <div style={{fontSize:8,color:C.muted,marginTop:2}}>{isExpanded?"▲ HIDE":"▼ CANDIDATES"}</div>
                            </button>
                            <div style={{textAlign:"center"}}>
                              <div style={{fontFamily:FD,fontSize:26,color:C.green,lineHeight:1}}>{approvedCount}</div>
                              <div style={{fontSize:8,color:C.muted}}>APPROVED</div>
                            </div>
                            <div style={{textAlign:"center"}}>
                              <div style={{fontFamily:FD,fontSize:26,color:C.teal,lineHeight:1}}>{hiredCount}</div>
                              <div style={{fontSize:8,color:C.muted}}>HIRED</div>
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{marginTop:14,borderTop:`1px solid ${C.border}`,paddingTop:12}}>
                            <div style={{fontSize:9,color:C.muted,marginBottom:10}}>CANDIDATES FOR THIS ROLE</div>
                            {jobCands.length===0 ? <div style={{fontSize:11,color:C.muted}}>No candidates yet.</div> : (
                              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                {jobCands.map(c=>{
                                  const sm  = STATUS_META[c.interview_status]||STATUS_META.pending;
                                  const rec = recruiters.find(r=>r.id===c.recruiter_id);
                                  return (
                                    <div key={c.id} style={{display:"grid",gridTemplateColumns:"1.4fr 0.8fr 0.5fr repeat(3,0.7fr) 0.8fr",gap:8,padding:"8px 12px",background:C.surface,borderRadius:6,border:`1px solid ${C.border}`,alignItems:"center"}}>
                                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                        <Avatar text={c.avatar||ini(c.name)} size={24} color={sc(c.score)}/>
                                        <div>
                                          <div style={{fontSize:11,color:C.cream}}>{c.name}</div>
                                          <div style={{fontSize:9,color:C.muted}}>{c.exp}{c.email&&` · ${c.email}`}</div>
                                        </div>
                                      </div>
                                      <span style={{fontSize:9,color:STAGE_META[c.stage]?.color||C.muted,fontFamily:FM}}>{c.stage}</span>
                                      <span style={{fontSize:12,color:sc(c.score),fontFamily:FD}}>{c.score}</span>
                                      {INTERVIEW_LEVELS.map(lvl=>{
                                        const round = interviews.find(iv=>iv.candidate_id===c.id&&iv.level===lvl.id);
                                        const rst   = round?INTERVIEW_STATUS_META[round.status]:null;
                                        return (
                                          <div key={lvl.id}>
                                            {round?<span style={{padding:"2px 6px",borderRadius:3,fontSize:8,background:rst?.color+"18",color:rst?.color,fontFamily:FM,border:`0.5px solid ${rst?.color}40`,whiteSpace:"nowrap"}}>{lvl.short}: {rst?.label}</span>
                                                  :<span style={{fontSize:9,color:C.faint}}>{lvl.short}: —</span>}
                                          </div>
                                        );
                                      })}
                                      <span style={{padding:"2px 7px",borderRadius:4,fontSize:9,background:sm.color+"20",color:sm.color,fontFamily:FM,border:`0.5px solid ${sm.color}40`}}>{sm.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        <div style={{display:"flex",gap:8,marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`,flexWrap:"wrap",alignItems:"center"}}>
                          <button onClick={()=>{setUploadJob(job.id);setTab("upload");}} style={{padding:"5px 12px",borderRadius:4,border:`0.5px solid ${C.amber}60`,background:"transparent",color:C.amber,fontFamily:FM,fontSize:9,cursor:"pointer"}}>⬆ SCREEN RESUMES</button>
                          <button onClick={()=>toggleJobStatus(job.id)} style={{padding:"5px 12px",borderRadius:4,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:9,cursor:"pointer"}}>{job.status==="Active"?"CLOSE ROLE":"REOPEN ROLE"}</button>
                          {confirmClearJob===job.id ? (
                            <div style={{display:"flex",gap:6,alignItems:"center",padding:"4px 10px",background:C.red+"12",border:`1px solid ${C.red}40`,borderRadius:5}}>
                              <span style={{fontSize:9,color:C.red,fontFamily:FM}}>Remove all {candCount} candidates?</span>
                              <button onClick={()=>confirmClearCandidates(job.id)} style={{padding:"3px 10px",borderRadius:3,background:C.red,border:"none",color:"#fff",fontFamily:FM,fontSize:9,cursor:"pointer",fontWeight:700}}>YES</button>
                              <button onClick={()=>setConfirmClearJob(null)} style={{padding:"3px 10px",borderRadius:3,border:`0.5px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FM,fontSize:9,cursor:"pointer"}}>CANCEL</button>
                            </div>
                          ) : (
                            <button onClick={()=>setConfirmClearJob(job.id)} style={{padding:"5px 12px",borderRadius:4,border:`0.5px solid ${C.orange}50`,background:"transparent",color:C.orange,fontFamily:FM,fontSize:9,cursor:"pointer"}}>✕ CLEAR RESUMES ({candCount})</button>
                          )}
                          <button onClick={()=>handleDeleteJob(job.id)} style={{padding:"5px 12px",borderRadius:4,border:`0.5px solid ${C.red}40`,background:"transparent",color:C.red,fontFamily:FM,fontSize:9,cursor:"pointer"}}>DELETE JOB</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ PIPELINE ══ */}
          {tab==="pipeline" && (
            <div className="fi">
              <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{fontSize:9,color:C.muted}}>FILTER BY JOB:</div>
                <select value={pipelineJob} onChange={e=>setPipelineJob(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:5,color:C.cream,fontFamily:FM,fontSize:10,padding:"5px 10px",cursor:"pointer",outline:"none"}}>
                  <option value="all">All Jobs ({candidates.length} candidates)</option>
                  {jobs.map(j=><option key={j.id} value={j.id}>{j.title} ({candidates.filter(c=>c.job_id===j.id).length})</option>)}
                </select>
              </div>
              {(pipelineJob==="all"?jobs:jobs.filter(j=>j.id===pipelineJob)).map(job=>{
                const jobCands = candidates.filter(c=>c.job_id===job.id);
                if(jobCands.length===0) return null;
                return (
                  <div key={job.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,marginBottom:14,overflow:"hidden"}}>
                    <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.faint}}>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontFamily:FD,fontSize:15,color:C.cream}}>{job.title}</span>
                        <Badge label={job.dept} color={C.muted}/><Badge label={job.location} color={C.muted}/>
                      </div>
                      <div style={{display:"flex",gap:12,fontSize:10}}>
                        <span style={{color:C.amber}}>{jobCands.length} candidates</span>
                        <span style={{color:C.green}}>{jobCands.filter(c=>c.interview_status==="approved").length} approved</span>
                        <span style={{color:C.green}}>{jobCands.filter(c=>c.stage==="Hired").length} hired</span>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1.6fr 0.9fr 0.7fr repeat(3,0.8fr) 0.9fr 1.4fr",gap:0,padding:"7px 16px",borderBottom:`1px solid ${C.border}`,background:C.surface}}>
                      {["CANDIDATE","STAGE","SCORE","L1","L2","FINAL","STATUS","FEEDBACK"].map(h=>(
                        <div key={h} style={{fontSize:8,color:C.muted,letterSpacing:"0.1em"}}>{h}</div>
                      ))}
                    </div>
                    {jobCands.map((c,ci)=>{
                      const rec       = recruiters.find(r=>r.id===c.recruiter_id);
                      const sm        = STATUS_META[c.interview_status]||STATUS_META.pending;
                      const stageMeta = STAGE_META[c.stage]||{color:C.muted};
                      return (
                        <div key={c.id} style={{display:"grid",gridTemplateColumns:"1.6fr 0.9fr 0.7fr repeat(3,0.8fr) 0.9fr 1.4fr",gap:0,padding:"9px 16px",borderBottom:ci<jobCands.length-1?`1px solid ${C.border}`:"none",alignItems:"center"}}>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <Avatar text={c.avatar||ini(c.name)} size={26} color={sc(c.score)}/>
                            <div>
                              <div style={{fontSize:11,color:C.cream}}>{c.name}</div>
                              <div style={{fontSize:9,color:C.muted}}>{c.exp} {rec&&<span style={{color:rec.color}}>· {rec.initials}</span>}</div>
                            </div>
                          </div>
                          <div><span style={{fontSize:9,color:stageMeta.color,fontFamily:FM}}>{c.stage}</span></div>
                          <div style={{fontSize:12,color:sc(c.score),fontFamily:FD}}>{c.score}</div>
                          {INTERVIEW_LEVELS.map(lvl=>{
                            const round = interviews.find(iv=>iv.candidate_id===c.id&&iv.level===lvl.id);
                            const rst   = round?INTERVIEW_STATUS_META[round.status]:null;
                            return (
                              <div key={lvl.id}>
                                {round ? (
                                  <select value={round.status} onChange={e=>updateInterview(round.id,{status:e.target.value})}
                                    style={{background:rst?.color+"15",border:`1px solid ${rst?.color}40`,borderRadius:4,color:rst?.color,fontFamily:FM,fontSize:8,padding:"2px 4px",cursor:"pointer",outline:"none",fontWeight:700}}>
                                    {["scheduled","completed","approved","cancelled"].map(s=><option key={s} value={s}>{INTERVIEW_STATUS_META[s].label}</option>)}
                                  </select>
                                ) : <span style={{fontSize:9,color:C.faint}}>—</span>}
                              </div>
                            );
                          })}
                          <div><span style={{padding:"2px 7px",borderRadius:4,fontSize:9,background:sm.color+"20",color:sm.color,fontFamily:FM,border:`0.5px solid ${sm.color}40`}}>{sm.label}</span></div>
                          <div>
                            <input defaultValue={c.feedback||""} onBlur={e=>updateFeedback(c.id,e.target.value)} placeholder="Add feedback..."
                              style={{width:"100%",background:"transparent",border:`0.5px solid ${C.border}`,borderRadius:4,padding:"3px 7px",color:C.cream,fontFamily:FM,fontSize:9,outline:"none",boxSizing:"border-box"}}/>
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
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:16}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:12}}>SCHEDULE NEW INTERVIEW</div>
                <ScheduleForm candidates={myCandidates} recruiter={myProfile} jobs={jobs}
                  onAdd={async (iv)=>{
                    const { data } = await supabase.from("interviews").insert(iv).select().single();
                    if(data) setInterviews(p=>[...p,data]);
                  }}/>
              </div>
              {[{label:"MY INTERVIEWS",list:interviews.filter(i=>i.recruiter_id===myProfile?.id)},{label:"ALL TEAM INTERVIEWS",list:interviews.filter(i=>i.recruiter_id!==myProfile?.id)}].map(group=>(
                <div key={group.label} style={{marginBottom:18}}>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>{group.label}</div>
                  {group.list.length===0?<div style={{fontSize:11,color:C.muted}}>None.</div>:group.list.map(iv=>{
                    const c   = candidates.find(x=>x.id===iv.candidate_id);
                    const rec = recruiters.find(r=>r.id===iv.recruiter_id);
                    const job = jobs.find(j=>j.id===iv.job_id);
                    const lvl = INTERVIEW_LEVELS.find(l=>l.id===iv.level);
                    return (
                      <div key={iv.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:8,borderLeft:`3px solid ${rec?.color||C.muted}`}}>
                        <div style={{fontFamily:FD,fontSize:17,color:rec?.color||C.muted,minWidth:64}}>{iv.time}</div>
                        <Avatar text={ini(iv.candidate_name)} size={34} color={sc(c?.score||70)}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:C.cream}}>{iv.candidate_name}</div>
                          <div style={{fontSize:10,color:C.muted}}>{iv.date} · {iv.role} · {job?.title}</div>
                          <div style={{fontSize:10,color:C.muted}}>by {rec?.name}</div>
                        </div>
                        {lvl && <Badge label={lvl.label} color={lvl.color}/>}
                        <Badge label={iv.type} color={rec?.color||C.muted}/>
                        <div style={{display:"flex",gap:4}}>
                          {["scheduled","completed","approved","cancelled"].map(st=>{
                            const colors={scheduled:C.blue,completed:C.teal,approved:C.green,cancelled:C.red};
                            const canEdit=iv.recruiter_id===myProfile?.id;
                            return (
                              <button key={st} onClick={()=>canEdit&&updateInterview(iv.id,{status:st})}
                                style={{padding:"3px 8px",borderRadius:3,border:`0.5px solid ${iv.status===st?colors[st]:C.border}`,background:iv.status===st?colors[st]+"20":"transparent",color:colors[st],fontFamily:FM,fontSize:8,cursor:canEdit?"pointer":"default",letterSpacing:"0.05em",opacity:canEdit?1:0.5}}>
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

          {/* ══ ACTIVITY REPORT ══ */}
          {tab==="report" && (
            <div className="fi">
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
                {[{label:"JOB",val:rptJob,set:setRptJob,opts:[{v:"all",l:"All Jobs"},...jobs.map(j=>({v:j.id,l:j.title}))]},
                  {label:"RECRUITER",val:rptRec,set:setRptRec,opts:[{v:"all",l:"All Recruiters"},...recruiters.map(r=>({v:r.id,l:r.name}))]},
                  {label:"STATUS",val:rptStat,set:setRptStat,opts:[{v:"all",l:"All Statuses"},{v:"approved",l:"Approved"},{v:"rejected",l:"Rejected"},{v:"hold",l:"On Hold"},{v:"pending",l:"Pending"}]},
                ].map(({label,val,set,opts})=>(
                  <div key={label}>
                    <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:5}}>{label}</div>
                    <select value={val} onChange={e=>set(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:5,color:C.cream,fontFamily:FM,fontSize:10,padding:"6px 10px",cursor:"pointer",outline:"none"}}>
                      {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{flex:1}}/>
                <button onClick={()=>downloadCSV(reportData,interviews,jobs,recruiters)}
                  style={{padding:"8px 18px",borderRadius:4,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700}}>
                  ↓ DOWNLOAD CSV ({reportData.length} rows)
                </button>
              </div>
              {candidates.length===0 ? (
                <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:8,padding:"40px 32px",textAlign:"center"}}>
                  <div style={{fontSize:13,color:C.muted}}>No candidates yet — upload resumes to see activity data here</div>
                </div>
              ) : (
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:16}}>
                    {[
                      {label:"Total",    value:reportData.length,                                                  color:C.muted},
                      {label:"Approved", value:reportData.filter(c=>c.interview_status==="approved").length,       color:C.green},
                      {label:"Rejected", value:reportData.filter(c=>c.interview_status==="rejected").length,       color:C.red},
                      {label:"On Hold",  value:reportData.filter(c=>c.interview_status==="hold").length,           color:C.orange},
                      {label:"Offered",  value:reportData.filter(c=>c.stage==="Offer").length,                     color:C.teal},
                      {label:"Hired",    value:reportData.filter(c=>c.stage==="Hired").length,                     color:C.green},
                    ].map(m=>(
                      <div key={m.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",borderTop:`2px solid ${m.color}`}}>
                        <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>{m.label.toUpperCase()}</div>
                        <div style={{fontFamily:FD,fontSize:28,color:m.color,lineHeight:1}}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                  {recruiters.filter(r=>rptRec==="all"||r.id===rptRec).length>0 && (
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",marginBottom:10}}>RECRUITER BREAKDOWN</div>
                      <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(recruiters.filter(r=>rptRec==="all"||r.id===rptRec).length,4)},1fr)`,gap:8}}>
                        {recruiters.filter(r=>rptRec==="all"||r.id===rptRec).map(r=>{
                          const filtered = reportData.filter(c=>c.recruiter_id===r.id);
                          return (
                            <div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:12,borderTop:`2px solid ${r.color}`}}>
                              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                                <Avatar text={r.initials} size={28} color={r.color}/>
                                <div><div style={{fontSize:11,color:C.cream}}>{r.name}</div><div style={{fontSize:9,color:C.muted}}>{r.role}</div></div>
                              </div>
                              {[{label:"Candidates",value:filtered.length,color:r.color},{label:"Approved",value:filtered.filter(c=>c.interview_status==="approved").length,color:C.green},{label:"Rejected",value:filtered.filter(c=>c.interview_status==="rejected").length,color:C.red},{label:"On Hold",value:filtered.filter(c=>c.interview_status==="hold").length,color:C.orange},{label:"Hired",value:filtered.filter(c=>c.stage==="Hired").length,color:C.teal},{label:"Interviews",value:interviews.filter(i=>i.recruiter_id===r.id).length,color:C.blue}].map(m=>(
                                <div key={m.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                                  <span style={{fontSize:9,color:C.muted}}>{m.label}</span>
                                  <span style={{fontSize:12,color:m.color,fontFamily:FD}}>{m.value}</span>
                                </div>
                              ))}
                              {jobs.filter(j=>filtered.some(c=>c.job_id===j.id)).length>0 && (
                                <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                                  <div style={{fontSize:8,color:C.muted,marginBottom:5}}>BY JOB</div>
                                  {jobs.map(j=>{const cnt=filtered.filter(c=>c.job_id===j.id).length;return cnt===0?null:(
                                    <div key={j.id} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                                      <span style={{fontSize:9,color:C.muted,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.title}</span>
                                      <span style={{fontSize:9,color:r.color}}>{cnt}</span>
                                    </div>
                                  );})}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 80px 60px 60px",gap:8,background:C.faint}}>
                      {["CANDIDATE","JOB","RECRUITER","STAGE","STATUS","SCORE","SOURCE"].map(h=>(
                        <div key={h} style={{fontSize:8,color:C.muted,letterSpacing:"0.1em"}}>{h}</div>
                      ))}
                    </div>
                    {reportData.length===0
                      ? <div style={{padding:"20px",textAlign:"center",fontSize:11,color:C.muted}}>No candidates match the filters.</div>
                      : reportData.map((c,i)=>{
                        const job = jobs.find(j=>j.id===c.job_id);
                        const rec = recruiters.find(r=>r.id===c.recruiter_id);
                        const sm  = STATUS_META[c.interview_status]||STATUS_META.pending;
                        const stg = STAGE_META[c.stage]||{color:C.muted};
                        return (
                          <div key={c.id} style={{padding:"9px 14px",borderBottom:i<reportData.length-1?`1px solid ${C.border}`:"none",display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 80px 60px 60px",gap:8,alignItems:"center"}}>
                            <div style={{display:"flex",gap:7,alignItems:"center"}}>
                              <Avatar text={c.avatar||ini(c.name)} size={22} color={sc(c.score)}/>
                              <div><div style={{fontSize:11,color:C.cream}}>{c.name}</div><div style={{fontSize:9,color:C.muted}}>{c.exp}</div></div>
                            </div>
                            <div style={{fontSize:10,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job?.title||"—"}</div>
                            <div style={{display:"flex",gap:5,alignItems:"center"}}>
                              <Avatar text={rec?.initials||"?"} size={18} color={rec?.color||C.muted}/>
                              <span style={{fontSize:9,color:C.muted}}>{rec?.name?.split(" ")[0]||"—"}</span>
                            </div>
                            <div><span style={{fontSize:9,color:stg.color,fontFamily:FM}}>{c.stage}</span></div>
                            <div><Badge label={sm.label} color={sm.color}/></div>
                            <div style={{fontSize:12,color:sc(c.score),fontFamily:FD}}>{c.score}</div>
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
function ScheduleForm({ candidates, recruiter, jobs, onAdd }) {
  const [cid,   setCid]   = useState("");
  const [date,  setDate]  = useState("");
  const [time,  setTime]  = useState("");
  const [level, setLevel] = useState("l1");
  const [type,  setType]  = useState("Technical");

  const submit = () => {
    if (!cid || !date || !time) return;
    const c   = candidates.find(x => x.id===cid);
    const lvl = INTERVIEW_LEVELS.find(l => l.id===level);
    if (!c) return;
    onAdd({
      candidate_id:   cid,
      candidate_name: c.name,
      role:           c.role,
      recruiter_id:   recruiter?.id,
      job_id:         c.job_id,
      date, time, type,
      level,
      level_label:    lvl?.label || "Level 1",
      status:         "scheduled",
    });
    setCid(""); setDate(""); setTime("");
  };

  const sel = { background: C.faint, border: `1px solid ${C.border}`, borderRadius: 5, color: C.cream, fontFamily: FM, fontSize: 10, padding: "7px 10px", outline: "none" };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      {[
        {lbl:"CANDIDATE", el:<select value={cid} onChange={e=>setCid(e.target.value)} style={{...sel,minWidth:180}}><option value="">Select candidate</option>{candidates.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>},
        {lbl:"LEVEL",     el:<select value={level} onChange={e=>setLevel(e.target.value)} style={sel}>{INTERVIEW_LEVELS.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select>},
        {lbl:"TYPE",      el:<select value={type} onChange={e=>setType(e.target.value)} style={sel}>{["Technical","HR Screening","Portfolio","Culture Fit","System Design"].map(t=><option key={t}>{t}</option>)}</select>},
        {lbl:"DATE",      el:<input type="date" value={date} onChange={e=>setDate(e.target.value)} style={sel}/>},
        {lbl:"TIME",      el:<input type="time" value={time} onChange={e=>setTime(e.target.value)} style={sel}/>},
      ].map(({lbl,el})=>(
        <div key={lbl}>
          <div style={{fontSize:8,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>{lbl}</div>
          {el}
        </div>
      ))}
      <button onClick={submit} style={{padding:"8px 16px",borderRadius:4,background:C.amber,border:"none",color:"#fff",fontFamily:FM,fontSize:10,cursor:"pointer",fontWeight:700,height:34}}>+ SCHEDULE</button>
    </div>
  );
}
