"use client";

import { Check, ChevronRight, PenLine, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";

import type { GuestbookEntry } from "@/lib/guestbook";

const PAD_W = 600;
const PAD_H = 200;

type Point = [number, number];

// Each stroke becomes a quadratic curve through the midpoints between samples.
function toPath(strokes: Point[][]) {
  return strokes
    .map((s) => {
      let d = `M${s[0][0]} ${s[0][1]}`;
      for (let i = 1; i < s.length - 1; i++) d += `Q${s[i][0]} ${s[i][1]} ${(s[i][0] + s[i + 1][0]) / 2} ${(s[i][1] + s[i + 1][1]) / 2}`;
      return `${d}L${s[s.length - 1][0]} ${s[s.length - 1][1]}`;
    })
    .join("");
}

function toViewBox(strokes: Point[][]) {
  const points = strokes.flat(), xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x = Math.min(...xs) - 6, y = Math.min(...ys) - 6;
  return `${x} ${y} ${Math.max(...xs) + 6 - x} ${Math.max(...ys) + 6 - y}`;
}

const formatDate = (iso: string) =>
  new Date(`${iso.replace(" ", "T")}Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function Signature({ entry }: { entry: GuestbookEntry }) {
  return (
    <svg className="signature" viewBox={entry.viewBox} preserveAspectRatio="xMinYMid meet" role="img" aria-label={`Signature of ${entry.name}`}>
      <path d={entry.signature} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Four digit wheels that roll to the new count.
function Odometer({ value }: { value: number }) {
  return (
    <span className="odometer" role="img" aria-label={String(value)}>
      {String(Math.min(value, 9999)).padStart(4, "0").split("").map((digit, i) => (
        <span key={i}>
          <span style={{ translate: `0 ${-Number(digit) * 10}%` }}>
            {"0123456789".split("").map((n) => <span key={n}>{n}</span>)}
          </span>
        </span>
      ))}
    </span>
  );
}

function SignaturePad({ strokes, onChange }: { strokes: Point[][]; onChange: (strokes: Point[][]) => void }) {
  const drawing = useRef(false);
  const point = (event: PointerEvent<SVGSVGElement>): Point => {
    const r = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - r.left) / r.width) * PAD_W), y = Math.round(((event.clientY - r.top) / r.height) * PAD_H);
    return [Math.min(PAD_W, Math.max(0, x)), Math.min(PAD_H, Math.max(0, y))];
  };
  function move(event: PointerEvent<SVGSVGElement>) {
    if (!drawing.current) return;
    const p = point(event), last = strokes[strokes.length - 1], q = last[last.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 3) onChange([...strokes.slice(0, -1), [...last, p]]);
  }
  const stop = () => (drawing.current = false);
  return (
    <div className="sign-pad">
      <svg
        viewBox={`0 0 ${PAD_W} ${PAD_H}`}
        role="img"
        aria-labelledby="sign-pad-label"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = true;
          onChange([...strokes, [point(event)]]);
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        {strokes.length > 0 && <path d={toPath(strokes)} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {!strokes.length && <span>Draw your signature here</span>}
    </div>
  );
}

function SignPanel({ open, count, onClose, onSigned }: { open: boolean; count: number; onClose: () => void; onSigned: (entry: GuestbookEntry, count: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "signed">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const el = dialog.current;
    if (open && !el?.open) el?.showModal();
    if (!open && el?.open) el.close();
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!strokes.length) return setError("Draw your signature first.");
    setStatus("saving");
    setError("");
    const response = await fetch("/api/guestbook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, message, signature: toPath(strokes), viewBox: toViewBox(strokes) }),
    }).catch(() => null);
    const result = ((await response?.json().catch(() => null)) ?? {}) as { entry?: GuestbookEntry; count?: number; error?: string };
    if (!response?.ok || !result.entry) {
      setStatus("idle");
      return setError(result.error ?? "Couldn't save your signature. Try again.");
    }
    setStatus("signed");
    onSigned(result.entry, result.count ?? count + 1);
    setTimeout(() => {
      onClose();
      setName("");
      setMessage("");
      setStrokes([]);
      setStatus("idle");
    }, 1800);
  }

  return (
    <dialog ref={dialog} className="sign-panel" aria-labelledby="sign-title" onClose={onClose}>
      <header className="sign-head">
        <span className="sign-icon"><PenLine size={15} aria-hidden="true" /></span>
        <div>
          <h2 id="sign-title">Sign my guestbook</h2>
          <p>Leave a note and sign it in your own hand.</p>
        </div>
        <button type="button" className="sign-close" aria-label="Close" onClick={onClose}><X size={15} /></button>
      </header>
      <form onSubmit={submit}>
        <div className="sign-fields">
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required placeholder="Your name" autoComplete="name" /></label>
          <label>
            <span className="sign-label-row">Message<small>{message.length}/120</small></span>
            <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={120} required placeholder="Say something..." />
          </label>
        </div>
        <div className="sign-label-row sign-pad-label">
          <span id="sign-pad-label">Signature</span>
          {strokes.length > 0 && status === "idle" && <button type="button" onClick={() => setStrokes([])}>Clear</button>}
        </div>
        {status === "signed" ? (
          <p className="sign-done" role="status"><Check size={16} aria-hidden="true" /><span><strong>Signed.</strong> Thank you for stopping by.</span></p>
        ) : (
          <SignaturePad strokes={strokes} onChange={setStrokes} />
        )}
        {error && <p className="sign-error" role="alert">{error}</p>}
        <footer className="sign-foot">
          <Odometer value={count} />
          <span>signatures so far.</span>
          <button className="button button-primary" type="submit" disabled={status !== "idle"}>{status === "saving" ? "Signing…" : "Sign"}</button>
        </footer>
      </form>
    </dialog>
  );
}

// Homepage: the latest few signatures and a tile to add yours.
export function GuestbookSection() {
  const [data, setData] = useState<{ count: number; entries: GuestbookEntry[] }>({ count: 0, entries: [] });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch("/api/guestbook").then((r) => r.json() as Promise<typeof data>).then(setData).catch(() => {});
  }, []);
  return (
    <section className="section-block" aria-labelledby="guestbook-heading">
      <div className="section-heading">
        <div className="guestbook-title"><h2 id="guestbook-heading">Guestbook</h2><span>{data.count} signed</span></div>
        <Link className="section-toggle" href="/guestbook">See everyone<ChevronRight size={14} aria-hidden="true" /></Link>
      </div>
      <ul className="guestbook-strip">
        {data.entries.map((entry) => (
          <li key={entry.id}><Signature entry={entry} /><p>“{entry.message}”</p></li>
        ))}
        <li>
          <button type="button" className="guestbook-sign-tile" onClick={() => setOpen(true)}>
            <PenLine size={18} aria-hidden="true" /><span>Your signature here</span>
          </button>
        </li>
      </ul>
      <SignPanel open={open} count={data.count} onClose={() => setOpen(false)} onSigned={(entry, count) => setData((d) => ({ count, entries: [entry, ...d.entries].slice(0, 5) }))} />
    </section>
  );
}

// /guestbook: everyone, newest first.
export function GuestbookWall({ entries, count, admin }: { entries: GuestbookEntry[]; count: number; admin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function remove(entry: GuestbookEntry) {
    if (!window.confirm(`Delete ${entry.name}'s signature?`)) return;
    await fetch(`/api/guestbook?id=${entry.id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <>
      <header className="guestbook-header">
        <h1>Guestbook</h1>
        <p>Everyone who stopped by, in their own hand.</p>
        <button type="button" className="button button-primary" onClick={() => setOpen(true)}>Sign it</button>
      </header>
      {entries.length ? (
        <ul className="guestbook-wall">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Signature entry={entry} />
              <p>{entry.message}</p>
              <footer>
                <span>{entry.name}</span>
                <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                {admin && <button type="button" className="guestbook-delete" aria-label={`Delete ${entry.name}'s signature`} onClick={() => remove(entry)}><X size={13} /></button>}
              </footer>
            </li>
          ))}
        </ul>
      ) : (
        <p className="guestbook-empty">No signatures yet. Be the first.</p>
      )}
      <SignPanel open={open} count={count} onClose={() => setOpen(false)} onSigned={() => router.refresh()} />
    </>
  );
}
