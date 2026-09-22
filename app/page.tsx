"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronDown,
  Globe2,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Search,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { IconType } from "react-icons";
import { FaAws, FaGithub, FaLinkedinIn } from "react-icons/fa6";
import { TbBrandAzure } from "react-icons/tb";
import {
  siCloudflare,
  siConvex,
  siDocker,
  siFastapi,
  siGithub,
  siGo,
  siHuggingface,
  siJavascript,
  siKubernetes,
  siLangchain,
  siLinux,
  siNeon,
  siNextdotjs,
  siNvidia,
  siOnnx,
  siPlanetscale,
  siPostgresql,
  siPython,
  siPytorch,
  siQdrant,
  siRailway,
  siRay,
  siReact,
  siRedis,
  siSupabase,
  siTypescript,
  siVercel,
  siWeightsandbiases,
} from "simple-icons";

import { GitHubActivity } from "@/components/ui/github-activity";
import { cn } from "@/lib/utils";

type BrandData = { title: string; path: string; hex: string };
type Skill = {
  name: string;
  href: string;
  icon?: BrandData;
  customIcon?: IconType;
  color?: string;
  extra?: boolean;
};

const socials = [
  { label: "GitHub", href: "https://github.com/vivekvar-dl", icon: FaGithub },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/vivekvar", icon: FaLinkedinIn },
  { label: "Email", href: "mailto:vivekvarikuti22@gmail.com", icon: Mail },
  { label: "Website", href: "https://vivekvari.dev", icon: Globe2 },
  { label: "Phone", href: "tel:+919618934336", icon: Phone },
];

const jobs = [
  {
    company: "4Sight AI",
    role: "Lead AI engineer",
    date: "Aug 25 – Now",
    location: "Andhra Pradesh",
    icon: Sparkles,
    bullets: [
      "Shipped a POCSO compliance system using RAG over 1,000+ legal documents, generating citation-backed scorecards and evidence-gap reports in under five minutes per case.",
      "Built the FastAPI backend and human-in-the-loop validation flow, cutting hallucinations by 40% and prosecutor review time by 60%.",
      "Engineered a real-time face-recognition pipeline for a 2,000-camera network, reaching 93.3% true-accept at a 1-in-1,000 false-match rate.",
      "Trained and deployed a YOLO traffic-enforcement pipeline that detected 2,000+ no-helmet violations in one six-hour window.",
    ],
  },
  {
    company: "GGS Information Services",
    role: "Machine learning intern",
    date: "Dec 24 – Feb 25",
    location: "On-site",
    icon: BriefcaseBusiness,
    bullets: [
      "Built production 3D mesh-compression algorithms with 60% size reduction while retaining 95% geometric accuracy for 15+ enterprise clients.",
      "Developed a 2D-to-3D conversion pipeline that processed 500+ STEP files daily and reduced manual CAD work by 70%.",
      "Optimized inference with CUDA kernels and INT8 quantization, reducing latency by 30% and memory use by 50%.",
    ],
  },
];

const skillGroups: { title: string; skills: Skill[] }[] = [
  {
    title: "Language",
    skills: [
      { name: "Python", href: "https://www.python.org/", icon: siPython },
      { name: "Go", href: "https://go.dev/", icon: siGo },
      { name: "TypeScript", href: "https://www.typescriptlang.org/", icon: siTypescript },
      { name: "JavaScript", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript", icon: siJavascript },
    ],
  },
  {
    title: "AI & web",
    skills: [
      { name: "PyTorch", href: "https://pytorch.org/", icon: siPytorch },
      { name: "Hugging Face", href: "https://huggingface.co/", icon: siHuggingface },
      { name: "LangChain", href: "https://www.langchain.com/", icon: siLangchain },
      { name: "FastAPI", href: "https://fastapi.tiangolo.com/", icon: siFastapi },
      { name: "React", href: "https://react.dev/", icon: siReact, extra: true },
      { name: "Next.js", href: "https://nextjs.org/", icon: siNextdotjs, extra: true },
    ],
  },
  {
    title: "Inference",
    skills: [
      { name: "NVIDIA", href: "https://www.nvidia.com/", icon: siNvidia },
      { name: "ONNX", href: "https://onnx.ai/", icon: siOnnx },
      { name: "Ray", href: "https://www.ray.io/", icon: siRay },
      { name: "Weights & Biases", href: "https://wandb.ai/", icon: siWeightsandbiases, extra: true },
    ],
  },
  {
    title: "Data",
    skills: [
      { name: "PostgreSQL", href: "https://www.postgresql.org/", icon: siPostgresql },
      { name: "Redis", href: "https://redis.io/", icon: siRedis },
      { name: "Qdrant", href: "https://qdrant.tech/", icon: siQdrant },
      { name: "Neon", href: "https://neon.com/", icon: siNeon, extra: true },
      { name: "Supabase", href: "https://supabase.com/", icon: siSupabase, extra: true },
      { name: "Convex", href: "https://convex.dev/", icon: siConvex, extra: true },
      { name: "PlanetScale", href: "https://planetscale.com/", icon: siPlanetscale, extra: true },
    ],
  },
  {
    title: "Infrastructure",
    skills: [
      { name: "AWS", href: "https://aws.amazon.com/", customIcon: FaAws, color: "#FF9900" },
      { name: "Vercel", href: "https://vercel.com/", icon: siVercel },
      { name: "Cloudflare", href: "https://www.cloudflare.com/", icon: siCloudflare },
      { name: "Linux", href: "https://www.linux.org/", icon: siLinux },
      { name: "Docker", href: "https://www.docker.com/", icon: siDocker },
      { name: "Kubernetes", href: "https://kubernetes.io/", icon: siKubernetes, extra: true },
      { name: "Azure", href: "https://azure.microsoft.com/", customIcon: TbBrandAzure, color: "#0078D4", extra: true },
      { name: "Railway", href: "https://railway.com/", icon: siRailway, extra: true },
      { name: "GitHub", href: "https://github.com/", icon: siGithub, extra: true },
    ],
  },
];

const projects = [
  { name: "indictok", description: "Tokenizers for 22 Indian languages across 12 scripts", metric: "22 langs", href: "https://github.com/vivekvar-dl/indictok", icon: Search },
  { name: "TurboQuant", description: "KV-cache quantization for long-context Qwen inference", metric: "4× target", href: "https://github.com/vivekvar-dl", icon: Sparkles },
  { name: "GSPO reproduction", description: "Stable RL post-training on DeepSeek-R1-Distill-Qwen", metric: "75.8%", href: "https://github.com/vivekvar-dl", icon: FaGithub },
  { name: "DeepRE", description: "Reproduction of self-verifying reasoning with GRPO", metric: "90% parity", href: "https://github.com/vivekvar-dl", icon: Sparkles },
  { name: "Dial 112 AI", description: "Real-time emergency-call intelligence for AP Police", metric: "1K+/day", href: "https://github.com/vivekvar-dl", icon: Phone },
  { name: "Genesis", description: "ALife simulation with evolving GRU agents", metric: "86 gen", href: "https://github.com/vivekvar-dl/genesis", icon: Sparkles },
];

function SocialLink({ label, href, icon: Icon }: (typeof socials)[number]) {
  return (
    <li>
      <a className="social-link" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} aria-label={label} title={label}>
        <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
      </a>
    </li>
  );
}

function BrandIcon({ skill }: { skill: Skill }) {
  const color = skill.icon ? `#${skill.icon.hex}` : skill.color;
  const CustomIcon = skill.customIcon;
  return (
    <span className="brand-icon" style={{ color }} aria-hidden="true">
      {skill.icon ? <svg viewBox="0 0 24 24" role="img"><path fill="currentColor" d={skill.icon.path} /></svg> : CustomIcon ? <CustomIcon /> : null}
    </span>
  );
}

function SkillRow({ title, skills, expanded }: { title: string; skills: Skill[]; expanded: boolean }) {
  const visible = skills.filter((skill) => expanded || !skill.extra);
  return (
    <div className="skill-row">
      <h3>{title}</h3>
      <ul>
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((skill) => (
            <motion.li layout="position" key={skill.name} initial={skill.extra ? { opacity: 0, y: 10, filter: "blur(4px)" } : false} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(4px)" }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
              <a className="skill-link" href={skill.href} target="_blank" rel="noreferrer"><BrandIcon skill={skill} /><span>{skill.name}</span></a>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function SectionToggle({ expanded, onClick, controls, className }: { expanded: boolean; onClick: () => void; controls: string; className?: string }) {
  return (
    <button className={cn("section-toggle", className)} type="button" aria-expanded={expanded} aria-controls={controls} onClick={onClick}>
      {expanded ? "See less" : "See more"}<ChevronDown className={cn("toggle-chevron", expanded && "rotate-180")} size={14} />
    </button>
  );
}

function CompactExperience() {
  return (
    <ol className="experience-timeline" aria-label="Career timeline">
      {jobs.map((job, index) => {
        const Icon = job.icon;
        return (
          <li key={job.company}>
            <div className="timeline-line" aria-hidden="true"><span className={cn("timeline-dot", index === 0 && "timeline-dot-current")} /></div>
            <div className="timeline-role"><span className="mini-icon"><Icon size={14} strokeWidth={1.5} /></span><span>{job.company}</span></div>
            <p>{job.date}</p>
          </li>
        );
      })}
    </ol>
  );
}

function ExpandedExperience({ mobile }: { mobile?: boolean }) {
  const [openJob, setOpenJob] = useState<number | null>(null);
  return (
    <ol className={cn("experience-details", mobile && "experience-mobile")}>
      {jobs.map((job, index) => {
        const Icon = job.icon;
        const open = !mobile || openJob === index;
        return (
          <li key={job.company}>
            <button type="button" className="job-heading" onClick={() => mobile && setOpenJob(open ? null : index)} aria-expanded={mobile ? open : undefined}>
              <span className="job-identity"><span className="job-icon"><Icon size={16} strokeWidth={1.45} /></span><span><strong>{job.company}</strong><span>{job.role}</span></span></span>
              <span className="job-date">{job.date} <span aria-hidden="true">·</span> {job.location}{mobile && <ChevronDown className={cn("job-chevron", open && "rotate-180")} size={13} />}</span>
            </button>
            <AnimatePresence initial={false}>
              {open && <motion.ul initial={mobile ? { opacity: 0, y: 10, filter: "blur(4px)" } : false} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(4px)" }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>{job.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</motion.ul>}
            </AnimatePresence>
          </li>
        );
      })}
    </ol>
  );
}

export default function Home() {
  const [experienceExpanded, setExperienceExpanded] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  return (
    <main className="page-shell">
      <section className="hero" aria-label="Introduction">
        <div className="identity-row"><div><h1>V Sara Vivek</h1><p>AI engineer</p></div><nav aria-label="Social links"><ul>{socials.map((social) => <SocialLink key={social.label} {...social} />)}</ul></nav></div>
        <div className="intro-copy">
          <p>yo, I’m Vivek, an AI engineer based in <span className="dotted-link">Andhra Pradesh</span>, shipping production LLM, RAG, and computer-vision systems for government at scale.</p>
          <p>So far, I’ve cut prosecutor review time by <strong>60%</strong>, shipped real-time face recognition across a <strong>2,000-camera</strong> network, and built an enforcement pipeline that detected <strong>2,000+ violations</strong> in six hours.</p>
        </div>
        <div className="cta-row"><span className="cta-note" aria-hidden="true">let’s build</span><a className="button button-primary" href="mailto:vivekvarikuti22@gmail.com">Email me</a><a className="button button-secondary" href="https://github.com/vivekvar-dl" target="_blank" rel="noreferrer">View GitHub <FaGithub size={14} aria-hidden="true" /></a></div>
      </section>

      <section className="section-block" aria-labelledby="performance-heading">
        <div className="section-heading"><h2 id="performance-heading">Performance</h2></div>
        <GitHubActivity username="vivekvar-dl" accent={["#d6d6d6", "#a8a8a8", "#6f6f6f", "#171717"]} cellSize={10} months={12} showMonths label="Top contributions in:" className="activity-card" style={{ width: "100%" }} />
        <a className="rareui-credit" href="https://www.rareui.com/components/githubactivity" target="_blank" rel="noreferrer">GitHub activity by Rare UI <ArrowUpRight size={11} aria-hidden="true" /></a>
      </section>

      <section className="section-block" aria-labelledby="experience-heading">
        <div className="section-heading"><h2 id="experience-heading">Experience</h2><SectionToggle expanded={experienceExpanded} onClick={() => setExperienceExpanded((value) => !value)} controls="experience-content" className="experience-toggle" /></div>
        <div id="experience-content" className="desktop-experience"><AnimatePresence initial={false} mode="wait">{experienceExpanded ? <motion.div key="expanded" initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(4px)" }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}><ExpandedExperience /></motion.div> : <motion.div key="compact" initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(4px)" }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}><CompactExperience /></motion.div>}</AnimatePresence></div>
        <div className="mobile-experience"><ExpandedExperience mobile /></div>
      </section>

      <section className="section-block" aria-labelledby="skills-heading">
        <div className="section-heading"><h2 id="skills-heading">Skills</h2><SectionToggle expanded={skillsExpanded} onClick={() => setSkillsExpanded((value) => !value)} controls="skills-content" /></div>
        <div id="skills-content" className="skills-grid">{skillGroups.map((group) => <SkillRow key={group.title} {...group} expanded={skillsExpanded} />)}</div>
      </section>

      <section className="section-block" aria-labelledby="projects-heading">
        <div className="section-heading"><h2 id="projects-heading">Projects</h2></div>
        <ul className="project-list">{projects.map((project) => { const Icon = project.icon; return <li key={project.name}><a href={project.href} target="_blank" rel="noreferrer"><span className="project-icon"><Icon size={16} strokeWidth={1.5} /></span><span className="project-copy"><strong>{project.name}</strong><span>{project.description}</span></span><span className="project-metric">{project.metric}</span></a></li>; })}</ul>
      </section>

      <section className="section-block highlights" aria-labelledby="highlights-heading">
        <div className="section-heading"><h2 id="highlights-heading">Highlights</h2></div>
        <ul><li><span>Publication</span><strong>PPAG — identity-preserving image synthesis</strong><small>92% identity-preservation score</small></li><li><span>Award</span><strong>1st Prize — Nationwide AI Agent Hackathon</strong><small>Andhra Pradesh Police · 2025</small></li><li><span>Program</span><strong>Microsoft for Startups Founders Hub</strong><small>Selected January 2025</small></li></ul>
      </section>

      <section className="section-block education" aria-labelledby="education-heading">
        <div className="section-heading"><h2 id="education-heading">Education</h2></div>
        <div><span className="education-icon"><GraduationCap size={17} strokeWidth={1.5} /></span><p><strong>B.Tech in Artificial Intelligence & Machine Learning</strong><span>Usha Rama College of Engineering · 2021–2025</span></p><MapPin size={13} aria-hidden="true" /><span>Telaprolu</span></div>
      </section>

      <motion.footer className="signature-wrap" initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0.15 }} animate={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }} whileHover={{ scale: 1.015, rotate: -0.25 }} transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}>
        <img className="signature-image" src="/signature.svg" alt="V Sara Vivek signature" />
      </motion.footer>
    </main>
  );
}
