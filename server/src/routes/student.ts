import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { DB } from "../lib/db.js";
import { fail, parse } from "../lib/http.js";
import { push } from "../lib/live.js";

const slideSchema = z.object({ slide: z.number().int().min(1) });
const commentSchema = z.object({ slide: z.number().int().min(1), text: z.string().trim().min(1).max(280) });

interface Row { id: number; code: string; title: string; language: string; status: "draft" | "live" | "ended"; current_slide: number }

/**
 * Student endpoints. There is no account, no cookie and no identifier: the server cannot tell two students
 * apart, which is the point. Rate limiting keeps its counters in memory only and is keyed by network address.
 */
export function studentRouter(db: DB): Router {
  const r = Router();
  const writeLimit = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false, skip: () => process.env.NODE_ENV === "test" });

  const find = (code: string) => db.prepare("SELECT id, code, title, language, status, current_slide FROM sessions WHERE code = ?").get(code.toUpperCase()) as Row | undefined;

  /** Slides revealed so far (up to the one on screen) while live, all of them once the lecture has ended. */
  const publicState = (s: Row) => {
    const slides = s.status === "draft" ? [] : (db.prepare(
      "SELECT n, title, title_ur AS titleUr, summary, summary_ur AS summaryUr FROM slides WHERE session_id = ? AND (? = 'ended' OR n <= ?) ORDER BY n",
    ).all(s.id, s.status, s.current_slide) as unknown[]);
    return { code: s.code, title: s.title, language: s.language, status: s.status, current: s.current_slide, slides };
  };

  /** Joining only adds one to a counter. Nothing about the joiner is stored. */
  r.post("/:code/join", (req, res) => {
    const s = find(req.params.code);
    if (!s) return fail(res, 404, "not_found");
    if (s.status === "live") {
      db.prepare("UPDATE sessions SET joined = joined + 1 WHERE id = ?").run(s.id);
      push(db, s.id);
    }
    res.json({ session: publicState(s) });
  });

  r.get("/:code/state", (req, res) => {
    const s = find(req.params.code);
    if (!s) return fail(res, 404, "not_found");
    res.json({ session: publicState(s) });
  });

  const liveSlide = (code: string, slide: number) => {
    const s = find(code);
    if (!s) return { error: "not_found" as const, status: 404 };
    if (s.status !== "live") return { error: "not_live" as const, status: 409 };
    if (!db.prepare("SELECT 1 FROM slides WHERE session_id = ? AND n = ? AND n <= ?").get(s.id, slide, s.current_slide)) return { error: "no_such_slide" as const, status: 400 };
    return { s };
  };

  r.post("/:code/pin", writeLimit, (req, res) => {
    const body = parse(slideSchema, req.body, res);
    if (!body) return;
    const x = liveSlide(req.params.code, body.slide);
    if (!x.s) return fail(res, x.status!, x.error!);
    db.prepare("INSERT INTO pins (session_id, slide_n) VALUES (?, ?)").run(x.s.id, body.slide);
    push(db, x.s.id);
    res.json({ ok: true });
  });

  /** Removes one pin from that slide (the student's own, but the server cannot tell whose: counts only). */
  r.post("/:code/unpin", writeLimit, (req, res) => {
    const body = parse(slideSchema, req.body, res);
    if (!body) return;
    const x = liveSlide(req.params.code, body.slide);
    if (!x.s) return fail(res, x.status!, x.error!);
    db.prepare("DELETE FROM pins WHERE id = (SELECT MAX(id) FROM pins WHERE session_id = ? AND slide_n = ?)").run(x.s.id, body.slide);
    push(db, x.s.id);
    res.json({ ok: true });
  });

  r.post("/:code/comment", writeLimit, (req, res) => {
    const body = parse(commentSchema, req.body, res);
    if (!body) return;
    const x = liveSlide(req.params.code, body.slide);
    if (!x.s) return fail(res, x.status!, x.error!);
    db.prepare("INSERT INTO comments (session_id, slide_n, text) VALUES (?, ?, ?)").run(x.s.id, body.slide, body.text);
    push(db, x.s.id);
    res.json({ ok: true });
  });

  /** Study resource after the lecture: summaries and transcript, for every student. Never any pin data. */
  r.get("/:code/after", (req, res) => {
    const s = find(req.params.code);
    if (!s) return fail(res, 404, "not_found");
    if (s.status !== "ended") return fail(res, 409, "not_ended");
    const transcript = db.prepare("SELECT at, text FROM transcript_lines WHERE session_id = ? ORDER BY id").all(s.id);
    res.json({ session: publicState(s), transcript });
  });

  return r;
}
