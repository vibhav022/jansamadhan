"use client";

import "./portal-overrides.css";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, Bell, BookOpen, Building2, CheckCircle2, ChevronRight,
  ClipboardList, Factory, GraduationCap, Handshake, HeartPulse, LayoutDashboard,
  Hospital, Leaf, Lightbulb, Loader2, LogIn, Map, MapPin, Menu, MessageSquare, Plus, Search, Send,
  ShieldCheck, Sprout, Target, Upload, Users, Waves, X
} from "lucide-react";
import ServicesHub, { MapCentre } from "./services-hub";
import VillageExplorer from "./village-explorer";
import RealMap from "./real-map";

type Challenge = {
  id:string; title:string; description:string; category:string; priority:string; status:string;
  district:string; village?:string; address?:string; latitude?:number; longitude?:number; submitter_name?:string;
  assigned_institution?:string; industry_partner?:string; impact_score?:number; created_at?:string;
};
type Project = { id:string; challenge_id:string; title:string; stage:string; progress:number; institution:string; industry?:string; faculty_lead?:string; next_milestone?:string; due_date?:string };
type Partner = { id:string; name:string; type:string; expertise:string; district?:string; engagement:string };
type Notice = { id:string; title:string; message:string; audience:string; created_at:string };
type ProgressUpdate = { id:string; challenge_id:string; stage:string; progress:number; message:string; actor:string; created_at:string };
type Proposal = { id:string; challenge_id:string; proposer_name:string; proposer_role:string; institution:string; title:string; description:string; status:string; created_at:string };
type Vote = { challenge_id:string; votes:number };

const demoChallenges: Challenge[] = [
  {id:"JH-24018",title:"Fluoride contamination in village handpumps",description:"Residents report unsafe drinking water and recurring dental health issues.",category:"Water",priority:"Critical",status:"In Progress",district:"Palamu",assigned_institution:"BIT Mesra",industry_partner:"Tata Steel Foundation",impact_score:94},
  {id:"JH-23984",title:"Post-harvest vegetable losses for small farmers",description:"A cold-chain and local aggregation challenge affecting farmer incomes.",category:"Agriculture",priority:"High",status:"Pilot",district:"Ranchi",assigned_institution:"BAU Ranchi",industry_partner:"KissanPro Labs",impact_score:86},
  {id:"JH-23941",title:"Accessible learning tools for tribal schools",description:"Offline multilingual learning support is needed in low-connectivity blocks.",category:"Education",priority:"High",status:"Assigned",district:"West Singhbhum",assigned_institution:"Central University of Jharkhand",impact_score:82},
  {id:"JH-23876",title:"Overflowing waste points near public market",description:"Smart collection scheduling and citizen reporting required.",category:"Environment",priority:"Medium",status:"Validated",district:"Dhanbad",impact_score:68},
];
const demoProjects: Project[] = [
  {id:"PRJ-1042",challenge_id:"JH-24018",title:"JalSure low-cost fluoride monitor",stage:"Prototype",progress:68,institution:"BIT Mesra",industry:"Tata Steel Foundation",faculty_lead:"Dr. A. Sinha",next_milestone:"Field calibration",due_date:"18 Oct"},
  {id:"PRJ-1018",challenge_id:"JH-23984",title:"Solar micro cold-room network",stage:"Pilot",progress:82,institution:"BAU Ranchi",industry:"KissanPro Labs",faculty_lead:"Prof. R. Toppo",next_milestone:"Farmer cohort review",due_date:"26 Sep"},
  {id:"PRJ-997",challenge_id:"JH-23941",title:"Akhra offline learning kit",stage:"Research",progress:41,institution:"CUJ",industry:"EdVantage",faculty_lead:"Dr. M. Ekka",next_milestone:"Prototype content pack",due_date:"09 Nov"},
];
const demoPartners: Partner[] = [
  {id:"P1",name:"BIT Mesra",type:"University",expertise:"Engineering · Water · AI",district:"Ranchi",engagement:"4 active projects"},
  {id:"P2",name:"BAU Ranchi",type:"University",expertise:"Agriculture · Rural livelihoods",district:"Ranchi",engagement:"3 active projects"},
  {id:"P3",name:"Tata Steel Foundation",type:"CSR Partner",expertise:"Funding · Field implementation",district:"East Singhbhum",engagement:"₹42L committed"},
  {id:"P4",name:"KissanPro Labs",type:"Startup",expertise:"AgriTech · IoT · Cold chain",district:"Ranchi",engagement:"2 pilots"},
];
const districts=["Bokaro","Chatra","Deoghar","Dhanbad","Dumka","East Singhbhum","Garhwa","Giridih","Godda","Gumla","Hazaribagh","Jamtara","Khunti","Koderma","Latehar","Lohardaga","Pakur","Palamu","Ramgarh","Ranchi","Sahibganj","Seraikela Kharsawan","Simdega","West Singhbhum"];
const categories=["Auto-detect","Education","Healthcare","Agriculture","Water","Environment","Energy","Urban Development","Accessibility","Public Administration","Rural Livelihoods"];
const categoryIcon: Record<string, React.ReactNode>={Education:<BookOpen/>,Healthcare:<HeartPulse/>,Agriculture:<Sprout/>,Water:<Waves/>,Environment:<Leaf/>,"Urban Development":<Building2/>};

export default function Portal(){
  const [section,setSection]=useState("overview");
  const [mobile,setMobile]=useState(false);
  const [role,setRole]=useState("Government");
  const [challenges,setChallenges]=useState<Challenge[]>(demoChallenges);
  const [projects,setProjects]=useState<Project[]>(demoProjects);
  const [partners,setPartners]=useState<Partner[]>(demoPartners);
  const [notices,setNotices]=useState<Notice[]>([]);
  const [updates,setUpdates]=useState<ProgressUpdate[]>([]);
  const [proposals,setProposals]=useState<Proposal[]>([]);
  const [votes,setVotes]=useState<Vote[]>([]);
  const [solverTarget,setSolverTarget]=useState<Challenge|null>(null);
  const [loading,setLoading]=useState(true);
  const [showSubmit,setShowSubmit]=useState(false);
  const [showNotices,setShowNotices]=useState(false);
  const [partnerTarget,setPartnerTarget]=useState<Partner|null>(null);
  const [workflowTarget,setWorkflowTarget]=useState<Challenge|null>(null);
  const [projectUpdateTarget,setProjectUpdateTarget]=useState<Project|null>(null);
  const [publicReviewTarget,setPublicReviewTarget]=useState<Project|null>(null);
  const [showLogin,setShowLogin]=useState(false);
  const [profileName,setProfileName]=useState("");
  const [query,setQuery]=useState("");
  const [toast,setToast]=useState("");

  async function load(){
    setLoading(true);
    try{
      const res=await fetch("/api/portal",{cache:"no-store"});
      if(res.ok){const data=await res.json() as {challenges:Challenge[];projects:Project[];partners:Partner[];notifications:Notice[];updates:ProgressUpdate[];proposals?:Proposal[];votes?:Vote[]};setChallenges(data.challenges.length?data.challenges:demoChallenges);setProjects(data.projects.length?data.projects:demoProjects);setPartners(data.partners.length?data.partners:demoPartners);setNotices(data.notifications||[]);setUpdates(data.updates||[]);setProposals(data.proposals||[]);setVotes(data.votes||[])}
    }finally{setLoading(false)}
  }
  useEffect(()=>{
    void (async () => {
      await load();
    })();
    void fetch("/api/portal?action=session",{cache:"no-store"})
      .then(async r=>{if(r.ok){const d=await r.json() as {user?:{name:string;role:string}};if(d.user){setProfileName(d.user.name);setRole(d.user.role)}}})
      .catch(()=>{});
  },[]);
  useEffect(()=>{if(toast){const id=setTimeout(()=>setToast(""),3500);return()=>clearTimeout(id)}},[toast]);

  const filtered=useMemo(()=>challenges.filter(c=>(c.title+c.category+c.district+c.status).toLowerCase().includes(query.toLowerCase())),[challenges,query]);
  const stats=[
    {label:"Challenges received",value:challenges.length+1248,change:"+86 this month",icon:<ClipboardList/>,tone:"blue"},
    {label:"Active university teams",value:38,change:"12 institutions",icon:<GraduationCap/>,tone:"violet"},
    {label:"Industry collaborations",value:27,change:"₹2.4 Cr mobilised",icon:<Handshake/>,tone:"amber"},
    {label:"Solutions implemented",value:96,change:"1.8L citizens reached",icon:<CheckCircle2/>,tone:"green"},
  ];
  const nav=[
    ["overview","Overview",<LayoutDashboard key="o"/>],["challenges","Challenges",<Target key="c"/>],
    ["services","Public Services",<Hospital key="s"/>],
    ["map","Map Centre",<Map key="m"/>],["updates","Work Updates",<Activity key="u"/>],
    ["projects","Projects",<Lightbulb key="p"/>],["solver","Solver Hub",<Target key="solver"/>],["partners","Partners",<Handshake key="n"/>],
    ["analytics","Analytics",<Activity key="a"/>],
  ];
  return <div className="portal">
    <aside className={"sidebar "+(mobile?"open":"")}>
      <div className="brand"><div className="brandmark">ज</div><div><b>JanSamadhan</b><span>Societal Innovation Portal</span></div><button className="mobile-close" onClick={()=>setMobile(false)}><X/></button></div>
      <nav>{nav.map(([id,label,icon])=><button key={String(id)} className={section===id?"active":""} onClick={()=>{setSection(String(id));setMobile(false)}}>{icon}<span>{label}</span>{id==="challenges"&&<em>{challenges.length}</em>}</button>)}</nav>
      <div className="side-card"><ShieldCheck/><b>Transparent innovation</b><p>Every challenge is tracked from submission to measurable community impact.</p></div>
      <div className="jh-badge"><span>Government of Jharkhand</span><b>Innovation Mission</b></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <button className="menu-button" onClick={()=>setMobile(true)}><Menu/></button>
        <div className="searchbar"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search challenges, districts or projects"/></div>
        <div className="top-actions">
          <select value={role} onChange={e=>setRole(e.target.value)} aria-label="Current portal view"><option>Citizen</option><option>University</option><option>Industry</option><option>Government</option></select>
          <button className="login-trigger" onClick={()=>setShowLogin(true)}><LogIn/>{profileName||"Login"}</button>
          <button className="icon-button" onClick={()=>setShowNotices(true)}><Bell/><i>{notices.length||3}</i></button>
          <button className="primary compact" onClick={()=>setShowSubmit(true)}><Plus/>Submit challenge</button>
        </div>
      </header>

      {section==="overview"&&<Overview stats={stats} challenges={filtered} projects={projects} onSubmit={()=>setShowSubmit(true)} onNavigate={setSection}/>}
      {section==="services"&&<ServicesHub onOpenMap={()=>setSection("map")}/>} 
      {section==="map"&&<><MapCentre/><VillageExplorer challenges={challenges}/></>}
      {section==="updates"&&<Updates challenges={challenges} updates={updates}/>}
      {section==="challenges"&&<Challenges items={filtered} loading={loading} onSubmit={()=>setShowSubmit(true)} onUpdate={setWorkflowTarget}/>} 
      {section==="projects"&&<Projects items={projects} onGovernmentUpdate={setProjectUpdateTarget} onPublicReview={setPublicReviewTarget}/>}
      {section==="solver"&&<SolverHub challenges={challenges} proposals={proposals} votes={votes} profileName={profileName} role={role} onPropose={setSolverTarget} onRefresh={load}/>} 
      {section==="partners"&&<Partners items={partners} onMessage={setPartnerTarget}/>}
      {section==="analytics"&&<Analytics challenges={challenges} projects={projects}/>}
    </main>
    {showSubmit&&<SubmissionModal onClose={()=>setShowSubmit(false)} onSuccess={(message)=>{setToast(message);setShowSubmit(false);load()}}/>}
    {showLogin&&<LoginModal role={role} setRole={setRole} profileName={profileName} onClose={()=>setShowLogin(false)} onSuccess={user=>{setProfileName(user.name);setRole(user.role);setToast(`Signed in as ${user.name}`);setShowLogin(false)}} onSignOut={()=>{setProfileName("");setToast("Signed out");setShowLogin(false)}}/>}
    {showNotices&&<Notifications notices={notices} onClose={()=>setShowNotices(false)}/>} 
      {partnerTarget&&<PartnerMessageModal partner={partnerTarget} onClose={()=>setPartnerTarget(null)} onSuccess={message=>{setToast(message);setPartnerTarget(null);load()}}/>}
    {workflowTarget&&<ChallengeWorkflowModal challenge={workflowTarget} onClose={()=>setWorkflowTarget(null)} onSuccess={async(status)=>{setToast(`Workflow updated — ${status}`);setWorkflowTarget(null);await load()}}/>}
    {projectUpdateTarget&&<GovernmentUpdateModal project={projectUpdateTarget} onClose={()=>setProjectUpdateTarget(null)} onSuccess={async(message)=>{setToast(message);setProjectUpdateTarget(null);await load()}}/>}
    {solverTarget&&<SolutionProposalModal challenge={solverTarget} role={role} profileName={profileName} onClose={()=>setSolverTarget(null)} onSuccess={async message=>{setToast(message);setSolverTarget(null);await load()}}/>}
    {publicReviewTarget&&<PublicReviewModal project={publicReviewTarget} onClose={()=>setPublicReviewTarget(null)} onSuccess={async(message)=>{setToast(message);setPublicReviewTarget(null);await load()}}/>}
    {toast&&<div className="toast"><CheckCircle2/>{toast}</div>}
  </div>
}

function Overview({stats,challenges,projects,onSubmit,onNavigate}:{stats:{label:string;value:number;change:string;icon:React.ReactNode;tone:string}[];challenges:Challenge[];projects:Project[];onSubmit:()=>void;onNavigate:(s:string)=>void}){
  return <div className="page">
    <section className="hero">
      <div><span className="eyebrow"><span></span>Jharkhand’s collaborative innovation network</span><h1>From community challenge<br/>to deployed solution.</h1><p>Citizens surface real problems. Universities research them. Industry helps fund, prototype and scale what works.</p><div className="hero-actions"><button className="primary" onClick={onSubmit}><Plus/>Submit a societal challenge</button><button className="secondary" onClick={()=>onNavigate("services")}>Find public services<ChevronRight/></button></div></div>
      <div className="impact-card"><div className="impact-head"><Target/><span>Community impact</span></div><strong>1,82,400</strong><p>Citizens reached through implemented solutions</p><div className="impact-row"><span><b>24</b> districts</span><span><b>96</b> deployed</span><span><b>17</b> patents</span></div></div>
    </section>
    <section className="stat-grid">{stats.map(s=><article className={"stat-card "+s.tone} key={s.label}><div className="stat-icon">{s.icon}</div><div><span>{s.label}</span><strong>{s.value.toLocaleString()}</strong><small>{s.change}</small></div></article>)}</section>
    <section className="overview-grid">
      <article className="panel map-panel"><PanelTitle title="Challenge map" text="Live distribution across Jharkhand districts" action="View analytics" onClick={()=>onNavigate("analytics")}/><JharkhandMap challenges={challenges}/></article>
      <article className="panel"><PanelTitle title="Priority queue" text="Challenges requiring action" action="View all" onClick={()=>onNavigate("challenges")}/><div className="queue">{challenges.slice(0,4).map(c=><ChallengeRow key={c.id} item={c}/>)}</div></article>
    </section>
    <section className="panel projects-panel"><PanelTitle title="Projects moving forward" text="University and industry teams delivering solutions" action="All projects" onClick={()=>onNavigate("projects")}/><div className="project-strip">{projects.slice(0,3).map(p=><ProjectCard key={p.id} item={p}/>)}</div></section>
  </div>
}

function Challenges({items,loading,onSubmit,onUpdate}:{items:Challenge[];loading:boolean;onSubmit:()=>void;onUpdate:(c:Challenge)=>void}){
  const [filter,setFilter]=useState("All");
  const shown=filter==="All"?items:items.filter(i=>i.category===filter);
  return <div className="page"><PageHead eyebrow="Problem management" title="Societal challenges" text="Review, validate, assign and monitor issues submitted across Jharkhand." action={onSubmit}/>
    <div className="filter-row">{["All","Water","Agriculture","Education","Healthcare","Environment"].map(f=><button className={filter===f?"active":""} onClick={()=>setFilter(f)} key={f}>{f}</button>)}</div>
    {loading?<div className="loading"><Loader2 className="spin"/>Loading challenges…</div>:<div className="challenge-grid">{shown.map(c=><article className="challenge-card" key={c.id}><div className="challenge-top"><div className="domain-icon">{categoryIcon[c.category]||<Lightbulb/>}</div><Priority value={c.priority}/></div><span className="record">{c.id} · {c.district}</span><h3>{c.title}</h3><p>{c.description}</p><div className="assignment"><span><GraduationCap/>{c.assigned_institution||"Awaiting university match"}</span><span><Factory/>{c.industry_partner||"Industry partner open"}</span></div><div className="card-footer"><Status value={c.status}/><button onClick={()=>onUpdate(c)}>{c.status==="Implemented"?"View workflow":"Update workflow"}<ChevronRight/></button></div></article>)}</div>}</div>
}

function Updates({challenges,updates}:{challenges:Challenge[];updates:ProgressUpdate[]}){
  const progressFor=(status:string)=>({"Submitted":10,"Under Review":22,"Validated":38,"Assigned":52,"In Progress":68,"Pilot":84,"Implemented":100}[status]||10);
  const fallback:ProgressUpdate[]=[{id:"demo-1",challenge_id:"JH-24018",stage:"In Progress",progress:68,message:"Field team installed the first fluoride monitor and is collecting calibration data.",actor:"BIT Mesra water team",created_at:"2026-09-10T10:00:00Z"},{id:"demo-2",challenge_id:"JH-23984",stage:"Pilot",progress:84,message:"Three farmer clusters are using the solar cold-room pilot.",actor:"BAU Ranchi",created_at:"2026-09-09T10:00:00Z"}];
  const activity=[...updates,...fallback].sort((a,b)=>b.created_at.localeCompare(a.created_at));
  return <div className="page updates-page"><PageHead eyebrow="Transparent delivery tracking" title="Work progress updates" text="See what has been completed, what is in progress, and the next action for every challenge."/><section className="progress-summary"><article className="panel"><b>{challenges.filter(c=>c.status==="In Progress"||c.status==="Pilot").length}</b><span>actively being worked on</span></article><article className="panel"><b>{challenges.filter(c=>c.status==="Implemented").length+96}</b><span>solutions implemented</span></article><article className="panel"><b>{updates.length}</b><span>verified system updates</span></article></section><section className="updates-grid"><article className="panel challenge-progress-list"><PanelTitle title="Challenge completion" text="Current status and estimated completion"/>{challenges.map(challenge=>{const progress=progressFor(challenge.status);return <div className="challenge-progress-row" key={challenge.id}><div><span>{challenge.id} · {challenge.district}</span><b>{challenge.title}</b><small>{challenge.status}</small></div><div><strong>{progress}%</strong><i><em style={{width:`${progress}%`}}></em></i><small>{progress===100?"Implemented":"Next update from assigned team"}</small></div></div>})}</article><article className="panel update-timeline"><PanelTitle title="Latest updates" text="Verified progress from the delivery workflow"/>{activity.map(update=><article key={update.id}><i></i><div><span>{update.stage} · {update.progress}%</span><b>{update.message}</b><small>{update.actor} · {update.created_at.slice(0,10)}</small></div></article>)}</article></section></div>
}

function SolverHub({challenges,proposals,votes,profileName,role,onPropose,onRefresh}:{challenges:Challenge[];proposals:Proposal[];votes:Vote[];profileName:string;role:string;onPropose:(c:Challenge)=>void;onRefresh:()=>void}){
  const [busy,setBusy]=useState<string>("");
  const voteCount=(id:string)=>Number(votes.find(v=>v.challenge_id===id)?.votes||0);
  const support=async(id:string)=>{if(!profileName){alert("Please login with email OTP first.");return}setBusy(id);try{const r=await fetch("/api/portal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"challengeVote",challengeId:id})});const d=await r.json() as {error?:string};if(!r.ok)throw new Error(d.error||"Could not support challenge");await onRefresh()}catch(e){alert(e instanceof Error?e.message:"Could not support challenge")}finally{setBusy("")}};
  return <div className="page"><PageHead eyebrow="University + industry action" title="Problem Solver Hub" text={`Discover real community problems, support priority issues, and submit a solution proposal for ${role.toLowerCase()} teams.`}/><div className="challenge-grid">{challenges.map(c=><article className="challenge-card" key={c.id}><div className="challenge-top"><div className="domain-icon">{categoryIcon[c.category]||<Lightbulb/>}</div><Priority value={c.priority}/></div><span className="record">{c.id} · {c.village||c.district}</span><h3>{c.title}</h3><p>{c.description}</p><div className="assignment"><span><Users/>Support: {voteCount(c.id)}</span><span><Lightbulb/>{proposals.filter(p=>p.challenge_id===c.id).length} proposals</span></div><div className="card-footer"><button className="secondary" disabled={busy===c.id} onClick={()=>support(c.id)}>{busy===c.id?<Loader2 className="spin"/>:"👍"} Support</button><button onClick={()=>onPropose(c)}><Send/>Propose solution</button></div></article>)}</div><section className="panel" style={{marginTop:20}}><PanelTitle title="Submitted solution proposals" text="Every proposal is stored and visible to the government workflow."/>{proposals.length===0?<p>No proposals yet. Be the first university or industry team to propose a solution.</p>:<div className="queue">{proposals.map(p=><div className="challenge-row" key={p.id}><div className="domain-icon"><Lightbulb/></div><div><span>{p.id} · {p.proposer_role}</span><b>{p.title}</b><small>{p.institution} · {p.status}</small></div></div>)}</div>}</section></div>
}

function Projects({items,onGovernmentUpdate,onPublicReview}:{items:Project[];onGovernmentUpdate:(project:Project)=>void;onPublicReview:(project:Project)=>void}){return <div className="page"><PageHead eyebrow="Delivery engine" title="Project tracking" text="Every project clearly shows completed work, current task, next task and a government update."/><div className="project-grid">{items.map(p=><ProjectCard key={p.id} item={p} full onGovernmentUpdate={()=>onGovernmentUpdate(p)} onPublicReview={()=>onPublicReview(p)}/>)}</div><section className="workflow panel"><PanelTitle title="How to read project status" text="The highlighted stage is the work happening right now."/><div className="workflow-line">{["Challenge validated","Research proposal","Prototype ready","Field pilot","Solution verified","Deployment complete"].map((x,i)=><div key={x} className={i<2?"complete":i===2?"current":""}><i>{i<2?<CheckCircle2/>:i+1}</i><span>{x}</span><small>{i<2?"Done":i===2?"In progress":"Upcoming"}</small></div>)}</div></section></div>}
function Partners({items,onMessage}:{items:Partner[];onMessage:(partner:Partner)=>void}){return <div className="page"><PageHead eyebrow="Collaboration network" title="Universities & industry partners" text="Match institutional expertise, mentorship and funding to validated challenges."/><div className="partner-grid">{items.map(p=><article className="partner-card panel" key={p.id}><div className="partner-logo">{p.type==="University"?<GraduationCap/>:<Factory/>}</div><div><span>{p.type}</span><h3>{p.name}</h3><p>{p.expertise}</p><small><MapPin/>{p.district||"Jharkhand"} · {p.engagement}</small></div><button aria-label={`Message ${p.name}`} onClick={()=>onMessage(p)}><MessageSquare/></button></article>)}</div></div>}
function Analytics({challenges,projects}:{challenges:Challenge[];projects:Project[]}){const domains=["Water","Agriculture","Education","Healthcare","Environment"];const counts=domains.map(d=>({d,n:challenges.filter(c=>c.category===d).length}));const max=Math.max(1,...counts.map(x=>x.n));const districtRows=Object.values(challenges.reduce<Record<string,{district:string;total:number;solved:number;active:number}>>((all,item)=>{const current=all[item.district]||{district:item.district,total:0,solved:0,active:0};current.total++;if(item.status==="Implemented")current.solved++;if(["Assigned","In Progress","Pilot"].includes(item.status))current.active++;all[item.district]=current;return all},{})).sort((a,b)=>b.total-a.total);const solved=challenges.filter(c=>c.status==="Implemented").length;const activeProjects=projects.filter(project=>project.progress<100).length;const completedProjects=projects.filter(project=>project.progress>=100).length;const averageProgress=projects.length?Math.round(projects.reduce((sum,project)=>sum+project.progress,0)/projects.length):0;return <div className="page"><PageHead eyebrow="Government intelligence" title="District problem-resolution dashboard" text="Measures are calculated only from challenges and projects currently recorded in JanSamadhan."/><section className="progress-summary"><article className="panel"><b>{challenges.length}</b><span>challenges recorded</span></article><article className="panel"><b>{solved}</b><span>problems solved</span></article><article className="panel"><b>{averageProgress}%</b><span>average project completion</span></article></section><div className="analytics-grid"><article className="panel chart-card"><h3>Challenges by domain</h3><p>Count from submitted portal records</p><div className="bars">{counts.map(x=><div key={x.d}><span>{x.d}</span><i><b style={{width:(x.n/max*100)+"%"}}></b></i><strong>{x.n}</strong></div>)}</div></article><article className="panel outcome-card"><h3>Project delivery measure</h3><div className="outcome-ring"><b>{averageProgress}%</b><span>average completion</span></div><div className="outcome-list"><span><Activity/>{activeProjects} active projects</span><span><CheckCircle2/>{completedProjects} completed projects</span><span><ClipboardList/>{solved} implemented challenges</span></div></article></div><article className="panel district-table"><PanelTitle title="District-wise problem status" text="Resolution = implemented challenges ÷ total challenges in that district."/><table><thead><tr><th>District</th><th>Received</th><th>In progress</th><th>Solved</th><th>Resolution</th></tr></thead><tbody>{districtRows.map(r=><tr key={r.district}><td><b>{r.district}</b></td><td>{r.total}</td><td>{r.active}</td><td>{r.solved}</td><td><b className="score">{r.total?Math.round(r.solved/r.total*100):0}%</b></td></tr>)}</tbody></table></article></div>}

function ChallengeWorkflowModal({challenge,onClose,onSuccess}:{challenge:Challenge;onClose:()=>void;onSuccess:(status:string)=>void}){
  const stages=["Submitted","Under Review","Validated","Assigned","In Progress","Pilot","Implemented"];
  const current=Math.max(0,stages.indexOf(challenge.status));
  const [chosen,setChosen]=useState(challenge.status);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const submit=async()=>{if(chosen===challenge.status){onClose();return}setBusy(true);setError("");try{const response=await fetch("/api/portal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"updateChallenge",id:challenge.id,status:chosen,assignedInstitution:challenge.assigned_institution,industryPartner:challenge.industry_partner})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"Could not update the workflow.");onSuccess(chosen)}catch(reason){setError(reason instanceof Error?reason.message:"Could not update the workflow.")}finally{setBusy(false)}};
  return <div className="modal-backdrop"><div className="modal workflow-modal"><header><div><span>Challenge workflow</span><h2>{challenge.id} · {challenge.district}</h2></div><button onClick={onClose}><X/></button></header><div className="form-page"><h3>{challenge.title}</h3><p className="workflow-help">Select the stage to correct or update the workflow. Every saved change appears in Work Updates.</p><div className="challenge-stage-list">{stages.map((stage,index)=><button type="button" key={stage} className={chosen===stage?"active":index<current?"done":""} onClick={()=>setChosen(stage)}><i>{index<current?<CheckCircle2/>:index+1}</i><span><b>{stage}</b><small>{index<current?"Previously completed · click to correct":index===current?"Current stage":"Set as next stage"}</small></span></button>)}</div></div>{error&&<p className="form-error">{error}</p>}<footer><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||chosen===challenge.status} onClick={submit}>{busy?<Loader2 className="spin"/>:<CheckCircle2/>}{busy?"Saving…":chosen===challenge.status?"No change selected":"Save workflow update"}</button></footer></div></div>
}

function PublicReviewModal({project,onClose,onSuccess}:{project:Project;onClose:()=>void;onSuccess:(message:string)=>void}){
  const [name,setName]=useState("");const [rating,setRating]=useState("5");const [review,setReview]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const submit=async()=>{if(name.trim().length<2||review.trim().length<10){setError("Add your name and a useful review.");return}setBusy(true);try{const response=await fetch("/api/portal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"publicReview",projectId:project.id,projectTitle:project.title,name,rating,review})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"Review could not be sent.");onSuccess("Public review submitted. Thank you.")}catch(reason){setError(reason instanceof Error?reason.message:"Review could not be sent.")}finally{setBusy(false)}};
  return <div className="modal-backdrop"><div className="modal"><header><div><span>Public review</span><h2>Review completed work</h2></div><button onClick={onClose}><X/></button></header><div className="form-page"><div className="ai-note"><CheckCircle2/><p><b>{project.title}</b><br/>Share whether the solution is useful for your community.</p></div><label>Your name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Name or organisation"/></label><label>Rating<select value={rating} onChange={e=>setRating(e.target.value)}><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Average</option><option value="2">2 — Needs improvement</option><option value="1">1 — Poor</option></select></label><label>Review<textarea value={review} onChange={e=>setReview(e.target.value)} placeholder="What changed? What should be improved?"/></label></div>{error&&<p className="form-error">{error}</p>}<footer><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={submit}>{busy?<Loader2 className="spin"/>:<Send/>}{busy?"Sending…":"Submit review"}</button></footer></div></div>
}

function GovernmentUpdateModal({project,onClose,onSuccess}:{project:Project;onClose:()=>void;onSuccess:(message:string)=>void}){
  const [message,setMessage]=useState(`Current work: ${project.stage}. Next milestone: ${project.next_milestone||"To be confirmed"}.`);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const submit=async()=>{if(message.trim().length<12){setError("Add a clear update for the government dashboard.");return}setBusy(true);setError("");try{const response=await fetch("/api/portal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"projectGovernmentUpdate",projectId:project.id,challengeId:project.challenge_id,projectTitle:project.title,message})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"Update could not be sent.");onSuccess("Government update sent successfully.")}catch(reason){setError(reason instanceof Error?reason.message:"Update could not be sent.")}finally{setBusy(false)}};
  return <div className="modal-backdrop"><div className="modal"><header><div><span>Government reporting</span><h2>Send project update</h2></div><button onClick={onClose}><X/></button></header><div className="form-page"><div className="ai-note"><Activity/><p><b>{project.title}</b> · {project.progress}% complete<br/>Current: {project.stage} · Next: {project.next_milestone||"To be confirmed"}</p></div><label>Update for Government<textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Describe completed work, current work and the next requirement."/></label></div>{error&&<p className="form-error">{error}</p>}<footer><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={submit}>{busy?<Loader2 className="spin"/>:<Send/>}{busy?"Sending…":"Send update"}</button></footer></div></div>
}

function SubmissionModal({onClose,onSuccess}:{onClose:()=>void;onSuccess:(m:string)=>void}){
  const [step,setStep]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [form,setForm]=useState({title:"",description:"",district:"",village:"",address:"",category:"Auto-detect",submitterName:"",submitterType:"Citizen",contact:"",latitude:"",longitude:"",evidenceKey:""});
  const set=(key:string,value:string)=>setForm(f=>({...f,[key]:value}));
  const locate=()=>{if(!navigator.geolocation){setError("GPS is not available on this device.");return}if(!window.isSecureContext){setError("GPS requires a secure HTTPS connection.");return}setError("");navigator.geolocation.getCurrentPosition(p=>setForm(f=>({...f,latitude:String(p.coords.latitude),longitude:String(p.coords.longitude)})),error=>setError(error.code===1?"Location permission was denied. Enable it in browser settings and try again.":"Could not get a GPS signal. Please try again."),{enableHighAccuracy:true,timeout:15000,maximumAge:30000})};
   const upload = async (file?: File) => {
  if (!file) return;

  setBusy(true);
  setError("");

  try {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/uploads", {
      method: "POST",
      body: fd,
    });

    const data = await res.json() as {
      error?: string;
      key?: string;
    };

    if (res.status === 503) {
      setError(
        "Evidence uploads are temporarily unavailable. " +
        "You can continue submitting your challenge without an attachment."
      );
      return;
    }

    if (!res.ok) {
      setError(data.error || "Upload failed. Please try again.");
      return;
    }

    set("evidenceKey", data.key || "");
    setToastLocal(file.name + " attached");
  } catch {
    setError(
      "Upload service is unavailable. You can continue without an attachment."
    );
  } finally {
    setBusy(false);
  }
};
  const [toastLocal,setToastLocal]=useState("");
  const next=()=>{setError("");if(step===1&&form.title.trim().length<8){setError("Write a challenge title with at least 8 characters.");return}if(step===1&&form.description.trim().length<30){setError("Add a little more detail so the right team can understand the issue.");return}if(step===1&&!form.district){setError("Select the district where this issue is happening.");return}setStep(s=>s+1)};
  const submit=async()=>{if(form.submitterName.trim().length<2){setError("Enter your name or organisation.");return}if(form.contact.trim().length<5){setError("Enter a phone number or email for status updates.");return}setBusy(true);setError("");const res=await fetch("/api/portal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"challenge",...form,category:form.category==="Auto-detect"?"":form.category,latitude:form.latitude?Number(form.latitude):null,longitude:form.longitude?Number(form.longitude):null})});const data=await res.json() as {error?:string;id?:string;category?:string;priority?:string};setBusy(false);if(!res.ok){setError(data.error||"Submission failed.");return}onSuccess(`${data.id} submitted · AI category: ${data.category} · ${data.priority} priority`)};
  return <div className="modal-backdrop"><div className="modal"><header><div><span>Citizen engagement module</span><h2>Submit a societal challenge</h2></div><button onClick={onClose}><X/></button></header><div className="steps"><i className={step>=1?"active":""}>1</i><b></b><i className={step>=2?"active":""}>2</i><b></b><i className={step>=3?"active":""}>3</i><span>Problem</span><span>Evidence & location</span><span>Contact</span></div>
    {step===1&&<div className="form-page"><label>Challenge title<input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Describe the issue in one clear sentence"/></label><label>What is happening?<textarea value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Who is affected, how often, and what outcome is needed?"/></label><div className="two"><label>District<select value={form.district} onChange={e=>set("district",e.target.value)}><option value="">Select district</option>{districts.map(x=><option key={x}>{x}</option>)}</select></label><label>Domain<select value={form.category} onChange={e=>set("category",e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label></div></div>}
    {step===2&&<div className="form-page"><label>Village / locality<input value={form.village} onChange={e=>set("village",e.target.value)} placeholder="Village name (helps problem-solvers filter local issues)"/></label><label>Address or landmark<input value={form.address} onChange={e=>set("address",e.target.value)} placeholder="Village, block, ward or landmark"/></label><button className="location-card" onClick={locate}><MapPin/><div><b>{form.latitude?"Location captured":"Use current GPS location"}</b><span>{form.latitude?`${Number(form.latitude).toFixed(5)}, ${Number(form.longitude).toFixed(5)}`:"Helps evaluators understand the exact affected area"}</span></div><ChevronRight/></button><label className="upload-card"><Upload/><div><b>{toastLocal||"Add photo, video or PDF evidence"}</b><span>Maximum file size: 10 MB</span></div><input type="file" accept="image/*,video/*,.pdf" onChange={e=>upload(e.target.files?.[0])}/></label></div>}
    {step===3&&<div className="form-page"><div className="two"><label>Your name / organisation<input value={form.submitterName} onChange={e=>set("submitterName",e.target.value)} placeholder="Full name"/></label><label>Submitting as<select value={form.submitterType} onChange={e=>set("submitterType",e.target.value)}><option>Citizen</option><option>Community group</option><option>Panchayati Raj Institution</option><option>Urban Local Body</option><option>Government department</option></select></label></div><label>Phone or email<input value={form.contact} onChange={e=>set("contact",e.target.value)} placeholder="For status updates and clarification"/></label><div className="ai-note"><Lightbulb/><p><b>AI-assisted processing</b>Your submission will be categorized, prioritized, checked for duplicates, and routed for expert validation.</p></div></div>}
    {error&&<p className="form-error">{error}</p>}<footer><button type="button" className="secondary" onClick={()=>step===1?onClose():setStep(s=>s-1)}>Back</button>{step<3?<button type="button" className="primary" onClick={next}>Continue<ChevronRight/></button>:<button type="button" className="primary" disabled={busy} onClick={submit}>{busy?<Loader2 className="spin"/>:<Send/>}Submit challenge</button>}</footer></div></div>
}
type OtpStart = { challengeId:string; maskedEmail:string; expiresIn:number; resendIn:number; resendsLeft:number; message?:string; error?:string; retryAfter?:number };
async function portalPost<T>(payload:Record<string,unknown>){const r=await fetch("/api/portal",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});const d=await r.json().catch(()=>({})) as T&{error?:string;retryAfter?:number};return {ok:r.ok,data:d}}
function LoginModal({role,setRole,profileName,onClose,onSuccess,onSignOut}:{role:string;setRole:(value:string)=>void;profileName:string;onClose:()=>void;onSuccess:(user:{name:string;role:string})=>void;onSignOut:()=>void}){
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [name,setName]=useState("");const [email,setEmail]=useState("");const [phone,setPhone]=useState("");const [otp,setOtp]=useState("");
  const [challenge,setChallenge]=useState<OtpStart|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [info,setInfo]=useState("");
  const [now,setNow]=useState(()=>Date.now());const [expiresAt,setExpiresAt]=useState(0);const [resendAt,setResendAt]=useState(0);
  useEffect(()=>{if(!challenge)return;const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[challenge]);
  const expiresIn=Math.max(0,Math.ceil((expiresAt-now)/1000));const resendIn=Math.max(0,Math.ceil((resendAt-now)/1000));
  const clock=(sec:number)=>`${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`;
  const started=(d:OtpStart)=>{const t=Date.now();setChallenge(d);setNow(t);setExpiresAt(t+d.expiresIn*1000);setResendAt(t+d.resendIn*1000);setOtp("");setInfo(d.message||"OTP sent to your email.")};
  const sendOtp=async()=>{setError("");setInfo("");
    if(!/^\S+@\S+\.\S+$/.test(email.trim())){setError("Enter a valid email address.");return}
    if(mode==="signup"&&(name.trim().length<2||phone.replace(/\D/g,"").length!==10)){setError("Enter your name and 10-digit mobile number.");return}
    setBusy(true);try{const {ok,data}=await portalPost<OtpStart>({action:"requestOtp",mode,email:email.trim(),name:name.trim(),phone,role});if(!ok){if(data.retryAfter)setResendAt(Date.now()+data.retryAfter*1000);throw new Error(data.error||"Could not send OTP.")}started(data)}catch(e){setError(e instanceof Error?e.message:"Could not send OTP.")}finally{setBusy(false)}};
  const resend=async()=>{if(!challenge||resendIn>0)return;setError("");setInfo("");setBusy(true);try{const {ok,data}=await portalPost<OtpStart>({action:"resendOtp",challengeId:challenge.challengeId,email:email.trim()});if(!ok){if(data.retryAfter)setResendAt(Date.now()+data.retryAfter*1000);throw new Error(data.error||"Could not resend OTP.")}started(data)}catch(e){setError(e instanceof Error?e.message:"Could not resend OTP.")}finally{setBusy(false)}};
  const verify=async()=>{if(!challenge)return;if(otp.length!==6){setError("Enter the 6-digit OTP.");return}if(expiresIn===0){setError("This OTP has expired. Please resend a new one.");return}setBusy(true);setError("");setInfo("");try{const {ok,data}=await portalPost<{user?:{name:string;role:string}}>({action:"verifyOtp",challengeId:challenge.challengeId,email:email.trim(),otp});if(!ok)throw new Error(data.error||"OTP verification failed.");if(data.user?.role)setRole(data.user.role);onSuccess({name:data.user?.name||name.trim(),role:data.user?.role||role})}catch(e){setOtp("");setError(e instanceof Error?e.message:"OTP verification failed.")}finally{setBusy(false)}};
  const back=()=>{setChallenge(null);setOtp("");setError("");setInfo("")};
  const signOut=async()=>{setBusy(true);try{await portalPost({action:"logout"})}finally{setBusy(false);onSignOut()}};
  if(profileName&&!challenge)return <div className="modal-backdrop"><div className="modal login-modal"><header><div><span>JanSamadhan access</span><h2>Signed in</h2></div><button onClick={onClose}><X/></button></header><div className="form-page"><div className="ai-note"><ShieldCheck/><p><b>{profileName}</b>Verified with email OTP · {role} workspace</p></div></div><footer><button className="secondary" onClick={onClose}>Close</button><button className="primary" disabled={busy} onClick={signOut}>{busy?<Loader2 className="spin"/>:<LogIn/>}Sign out</button></footer></div></div>;
  const roleSelect=<label>Access role<select value={role} onChange={e=>setRole(e.target.value)}><option>Citizen</option><option>University</option><option>Industry</option><option>Government</option></select></label>;
  return <div className="modal-backdrop"><div className="modal login-modal"><header><div><span>JanSamadhan access</span><h2>{challenge?"Verify your email":mode==="signup"?"Create your account":"Login to your workspace"}</h2></div><button onClick={onClose}><X/></button></header>
    <div className="form-page">{!challenge?<>
      <div className="filter-row">{(["login","signup"] as const).map(m=><button type="button" key={m} className={mode===m?"active":""} onClick={()=>{setMode(m);setError("");setInfo("")}}>{m==="login"?"Login":"Create account"}</button>)}</div>
      {mode==="signup"&&<><label>Name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your full name"/></label><label>Mobile number<input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit mobile number"/></label></>}
      <label>Email address<input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendOtp()}} type="email" autoComplete="email" placeholder="name@example.com"/></label>
      {roleSelect}
      <div className="ai-note"><ShieldCheck/><p><b>Secure email OTP</b>A one-time 6-digit code will be emailed to you. It is valid for 5 minutes and can be used only once.</p></div>
    </>:<>
      <div className="ai-note"><ShieldCheck/><p><b>Check your inbox</b>{info||`We sent a 6-digit code to ${challenge.maskedEmail}.`} {expiresIn>0?`Code expires in ${clock(expiresIn)}.`:"The code has expired — request a new one."}</p></div>
      <label>Enter 6-digit OTP<input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} onKeyDown={e=>{if(e.key==="Enter")verify()}} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit OTP" autoFocus/></label>
      <button type="button" className="secondary" disabled={busy||resendIn>0} onClick={resend}><Send/>{resendIn>0?`Resend OTP in ${resendIn}s`:"Resend OTP"}</button>
    </>}</div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <footer><button className="secondary" onClick={challenge?back:onClose}>{challenge?"Back":"Cancel"}</button><button className="primary" disabled={busy||(!challenge&&resendIn>0)} onClick={challenge?verify:sendOtp}>{busy?<Loader2 className="spin"/>:challenge?<ShieldCheck/>:<Send/>}{busy?"Please wait…":challenge?"Verify & login":!challenge&&resendIn>0?`Wait ${resendIn}s`:"Send OTP"}</button></footer></div></div>
}
function SolutionProposalModal({challenge,role,profileName,onClose,onSuccess}:{challenge:Challenge;role:string;profileName:string;onClose:()=>void;onSuccess:(message:string)=>void}){
 const [institution,setInstitution]=useState("");const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const submit=async()=>{if(profileName.length<2){setError("Login with OTP first.");return}setBusy(true);setError("");try{const r=await fetch("/api/portal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"solutionProposal",challengeId:challenge.id,proposerName:profileName,proposerRole:role,institution,title,description})});const d=await r.json() as {error?:string};if(!r.ok)throw new Error(d.error||"Could not submit proposal");onSuccess("Solution proposal submitted successfully.")}catch(e){setError(e instanceof Error?e.message:"Could not submit proposal")}finally{setBusy(false)}};
 return <div className="modal-backdrop"><div className="modal"><header><div><span>Real collaboration workflow</span><h2>Propose a solution</h2></div><button onClick={onClose}><X/></button></header><div className="form-page"><div className="ai-note"><Target/><p><b>{challenge.id}</b>{challenge.title}</p></div><label>University / company / team<input value={institution} onChange={e=>setInstitution(e.target.value)} placeholder="e.g. ABC University Innovation Lab"/></label><label>Solution title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Short solution name"/></label><label>Solution description<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Explain how your team will solve the problem, expected impact and pilot approach."/></label></div>{error&&<p className="form-error">{error}</p>}<footer><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={submit}>{busy?<Loader2 className="spin"/>:<Send/>}{busy?"Submitting…":"Submit proposal"}</button></footer></div></div>
}

function PartnerMessageModal({partner,onClose,onSuccess}:{partner:Partner;onClose:()=>void;onSuccess:(message:string)=>void}){
  const [sender,setSender]=useState("");const [contact,setContact]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const submit=async()=>{if(sender.trim().length<2||contact.trim().length<5||message.trim().length<10){setError("Add your name, contact and a short message.");return}setBusy(true);setError("");try{const response=await fetch("/api/portal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"partnerMessage",partnerId:partner.id,partnerName:partner.name,sender,contact,message})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"Message could not be sent.");onSuccess(`Message sent to ${partner.name}`)}catch(reason){setError(reason instanceof Error?reason.message:"Message could not be sent.")}finally{setBusy(false)}};
  return <div className="modal-backdrop"><div className="modal partner-message-modal"><header><div><span>Partner communication</span><h2>Message {partner.name}</h2></div><button onClick={onClose}><X/></button></header><div className="form-page"><label>Your name<input value={sender} onChange={e=>setSender(e.target.value)} placeholder="Name or organisation"/></label><label>Phone or email<input value={contact} onChange={e=>setContact(e.target.value)} placeholder="For their reply"/></label><label>Message<textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder={`Explain what support you need from ${partner.name}.`}/></label><div className="ai-note"><MessageSquare/><p><b>Routed message</b>Your message is saved in the JanSamadhan notification workflow for this partner.</p></div></div>{error&&<p className="form-error">{error}</p>}<footer><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={submit}>{busy?<Loader2 className="spin"/>:<Send/>}{busy?"Sending…":"Send message"}</button></footer></div></div>
}
function Notifications({notices,onClose}:{notices:Notice[];onClose:()=>void}){const fallback=[{id:"1",title:"Challenge validated",message:"JH-23984 was approved for university assignment.",audience:"All",created_at:"Today"},{id:"2",title:"New industry interest",message:"Tata Steel Foundation joined the water innovation cohort.",audience:"All",created_at:"Yesterday"},{id:"3",title:"Milestone submitted",message:"JalSure field calibration report is ready for review.",audience:"All",created_at:"2 days ago"}];return <div className="drawer-backdrop" onClick={onClose}><aside className="notice-drawer" onClick={e=>e.stopPropagation()}><header><div><span>Updates</span><h2>Notifications</h2></div><button onClick={onClose}><X/></button></header>{[...notices,...fallback].map(n=><article key={n.id}><i></i><div><b>{n.title}</b><p>{n.message}</p><span>{n.created_at?.slice(0,10)}</span></div></article>)}</aside></div>}
function PanelTitle({title,text,action,onClick}:{title:string;text:string;action?:string;onClick?:()=>void}){return <header className="panel-title"><div><h2>{title}</h2><p>{text}</p></div>{action&&<button onClick={onClick}>{action}<ChevronRight/></button>}</header>}
function PageHead({eyebrow,title,text,action}:{eyebrow:string;title:string;text:string;action?:()=>void}){return <header className="page-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{action&&<button className="primary" onClick={action}><Plus/>Submit challenge</button>}</header>}
function Priority({value}:{value:string}){return <span className={"priority "+value.toLowerCase()}>{value}</span>}
function Status({value}:{value:string}){return <span className="status"><i></i>{value}</span>}
function ChallengeRow({item}:{item:Challenge}){return <div className="challenge-row"><div className="domain-icon">{categoryIcon[item.category]||<Lightbulb/>}</div><div><span>{item.id} · {item.district}</span><b>{item.title}</b><small>{item.category}</small></div><div><Priority value={item.priority}/><Status value={item.status}/></div></div>}
function ProjectCard({item,full=false,onGovernmentUpdate,onPublicReview}:{item:Project;full?:boolean;onGovernmentUpdate?:()=>void;onPublicReview?:()=>void}){const stages=["Challenge validated","Research & proposal","Prototype build","Field pilot","Solution verification","Deployment"];const currentIndex=Math.min(5,Math.max(0,Math.floor(item.progress/20)));const done=stages[Math.max(0,currentIndex-1)]||"Challenge review";const current=stages[currentIndex];const next=stages[Math.min(5,currentIndex+1)];return <article className={"project-card "+(full?"full":"")}><div className="project-head"><span>{item.id} · {item.stage}</span><b>{item.progress}%</b></div><h3>{item.title}</h3><p><GraduationCap/>{item.institution}</p>{item.industry&&<p><Factory/>{item.industry}</p>}<div className="progress"><i style={{width:item.progress+"%"}}></i></div><div className="project-track"><span><CheckCircle2/>Completed: {done}</span><span><Activity/>Current: {current}</span><span><Target/>Next: {item.next_milestone||next}</span></div><footer><span>Expected next step: {next}</span><b>{item.due_date}</b></footer>{full&&<div className="project-actions">{onGovernmentUpdate&&<button className="government-update-button" onClick={onGovernmentUpdate}><Send/>Send update to Government</button>}{onPublicReview&&<button className="public-review-button" onClick={onPublicReview}><MessageSquare/>Public review</button>}</div>}</article>}
function JharkhandMap({challenges}:{challenges:Challenge[]}){return <div className="mapbox"><RealMap challenges={challenges} onSelect={()=>{}}/><div className="map-legend"><b>Live challenge distribution</b><span><i></i>New</span><span><i className="green-dot"></i>Active project</span></div></div>}
