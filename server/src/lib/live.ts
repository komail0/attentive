import type { Response } from "express";
import { config } from "../config.js";
import type { DB } from "./db.js";

/** What a lecturer may see for a slide: nothing, "a few" (1 or 2), or the real number (3 or more). */
export type Shown = "none" | "few" | number;
export const display = (count: number): Shown => (count <= 0 ? "none" : count < config.threshold ? "few" : count);

interface SessionRow {
  id: number;
  code: string;
  title: string;
  course: string;
  language: string;
  status: "draft" | "live" | "ended";
  current_slide: number;
  joined: number;
  started_at: string | null;
  ended_at: string | null;
}

export function loadSession(db: DB, id: number): SessionRow | undefined {
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
}

/** The full picture the lecturer sees. Counts are passed through `display`. */
export function lecturerState(db: DB, id: number) {
  const s = loadSession(db, id);
  if (!s) return null;
  const slides = db.prepare("SELECT n, title, title_ur, summary, summary_ur FROM slides WHERE session_id = ? ORDER BY n").all(id) as {
    n: number; title: string; title_ur: string; summary: string; summary_ur: string;
  }[];
  const counts = new Map(
    (db.prepare("SELECT slide_n AS n, COUNT(*) AS c FROM pins WHERE session_id = ? GROUP BY slide_n").all(id) as { n: number; c: number }[]).map((r) => [r.n, r.c]),
  );
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  let hottest: number | null = null;
  let max = 0;
  for (const [n, c] of counts) if (c > max) { max = c; hottest = n; }
  const comments = db.prepare("SELECT slide_n AS slide, text FROM comments WHERE session_id = ? ORDER BY id").all(id) as { slide: number; text: string }[];
  const transcript = db.prepare("SELECT at, text FROM transcript_lines WHERE session_id = ? ORDER BY id DESC LIMIT 12").all(id) as { at: string; text: string }[];
  return {
    id: s.id,
    code: s.code,
    title: s.title,
    course: s.course,
    language: s.language,
    status: s.status,
    current: s.current_slide,
    joined: s.joined,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    totalPins: display(total),
    hottest: max >= config.threshold ? hottest : null,
    slides: slides.map((sl) => {
      const c = counts.get(sl.n) ?? 0;
      return { n: sl.n, title: sl.title, titleUr: sl.title_ur, summary: sl.summary, summaryUr: sl.summary_ur, display: display(c) };
    }),
    comments,
    transcript: transcript.reverse(),
  };
}

/** Server-sent events hub: one set of open lecturer connections per session. */
const clients = new Map<number, Set<Response>>();

export function subscribe(db: DB, id: number, res: Response): void {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(lecturerState(db, id))}\n\n`);
  let set = clients.get(id);
  if (!set) clients.set(id, (set = new Set()));
  set.add(res);
  const beat = setInterval(() => res.write(": keep-alive\n\n"), 25_000);
  res.on("close", () => {
    clearInterval(beat);
    set!.delete(res);
    if (set!.size === 0) clients.delete(id);
  });
}

export function push(db: DB, id: number): void {
  const set = clients.get(id);
  if (!set || set.size === 0) return;
  const msg = `data: ${JSON.stringify(lecturerState(db, id))}\n\n`;
  for (const res of set) res.write(msg);
}
