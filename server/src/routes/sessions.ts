import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireLecturer } from "../lib/auth.js";
import type { DB } from "../lib/db.js";
import { fail, parse } from "../lib/http.js";
import { display, lecturerState, loadSession, push, subscribe } from "../lib/live.js";
import { newCode, pdfToPages, summarize } from "../lib/slides.js";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  course: z.string().trim().max(120).default(""),
  language: z.enum(["both", "en"]).default("both"),
});
const slidesSchema = z.object({
  slides: z
    .array(z.object({
      n: z.number().int().min(1).max(500),
      title: z.string().trim().min(1).max(160),
      titleUr: z.string().trim().max(160).default(""),
      summary: z.string().trim().max(300).default(""),
      summaryUr: z.string().trim().max(300).default(""),
    }))
    .min(1)
    .max(300),
});
const currentSchema = z.object({ n: z.number().int().min(1) });
const transcriptSchema = z.object({ text: z.string().trim().min(1).max(600) });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });

export function sessionsRouter(db: DB): Router {
  const r = Router();
  r.use(requireLecturer(db));

  /** Loads the session and checks it belongs to the signed-in lecturer. A stranger's id looks like "not found". */
  const own = (id: number, lecturerId: number) => {
    const s = loadSession(db, id);
    return s && (db.prepare("SELECT lecturer_id FROM sessions WHERE id = ?").get(id) as { lecturer_id: number }).lecturer_id === lecturerId ? s : undefined;
  };
  const idOf = (v: string) => (/^\d+$/.test(v) ? Number(v) : NaN);

  r.get("/", (_req, res) => {
    const rows = db.prepare(
      `SELECT s.id, s.code, s.title, s.course, s.status, s.joined, s.created_at AS createdAt, s.started_at AS startedAt, s.ended_at AS endedAt,
              (SELECT COUNT(*) FROM pins p WHERE p.session_id = s.id) AS pins
       FROM sessions s WHERE s.lecturer_id = ? ORDER BY s.id DESC`,
    ).all(res.locals.lecturerId) as { pins: number; [k: string]: unknown }[];
    res.json({ sessions: rows.map((x) => ({ ...x, pins: display(x.pins) })) });
  });

  r.post("/", (req, res) => {
    const body = parse(createSchema, req.body, res);
    if (!body) return;
    const info = db.prepare("INSERT INTO sessions (lecturer_id, code, title, course, language) VALUES (?, ?, ?, ?, ?)").run(res.locals.lecturerId, newCode(db), body.title, body.course, body.language);
    res.status(201).json({ session: lecturerState(db, Number(info.lastInsertRowid)) });
  });

  r.get("/:id", (req, res) => {
    const id = idOf(req.params.id);
    if (!own(id, res.locals.lecturerId)) return fail(res, 404, "not_found");
    res.json({ session: lecturerState(db, id) });
  });

  r.delete("/:id", (req, res) => {
    const id = idOf(req.params.id);
    const s = own(id, res.locals.lecturerId);
    if (!s) return fail(res, 404, "not_found");
    if (s.status === "live") return fail(res, 409, "session_live");
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  /** Replace the slide list by hand (edit titles and summaries before starting). */
  r.put("/:id/slides", (req, res) => {
    const id = idOf(req.params.id);
    const s = own(id, res.locals.lecturerId);
    if (!s) return fail(res, 404, "not_found");
    if (s.status !== "draft") return fail(res, 409, "session_started");
    const body = parse(slidesSchema, req.body, res);
    if (!body) return;
    const numbers = new Set(body.slides.map((x) => x.n));
    if (numbers.size !== body.slides.length) return fail(res, 400, "duplicate_slide_numbers");
    const insert = db.prepare("INSERT INTO slides (session_id, n, title, title_ur, summary, summary_ur) VALUES (?, ?, ?, ?, ?, ?)");
    db.transaction(() => {
      db.prepare("DELETE FROM slides WHERE session_id = ?").run(id);
      for (const x of [...body.slides].sort((a, b) => a.n - b.n)) insert.run(id, x.n, x.title, x.titleUr, x.summary, x.summaryUr);
    })();
    res.json({ session: lecturerState(db, id) });
  });

  /** Upload a PDF: each page becomes a slide, titled from its largest text. */
  r.post("/:id/slides/upload", upload.single("file"), async (req, res) => {
    const id = idOf(req.params.id);
    const s = own(id, res.locals.lecturerId);
    if (!s) return fail(res, 404, "not_found");
    if (s.status !== "draft") return fail(res, 409, "session_started");
    if (!req.file) return fail(res, 400, "no_file");
    if (req.file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return fail(res, 415, "not_a_pdf");
    try {
      const pages = await pdfToPages(req.file.buffer);
      if (pages.length === 0) return fail(res, 422, "no_pages");
      const summaries = await Promise.all(pages.map((p) => summarize(p.title, p.body)));
      const insert = db.prepare("INSERT INTO slides (session_id, n, title, summary) VALUES (?, ?, ?, ?)");
      db.transaction(() => {
        db.prepare("DELETE FROM slides WHERE session_id = ?").run(id);
        pages.forEach((p, i) => insert.run(id, p.n, p.title, summaries[i]));
      })();
      res.json({ session: lecturerState(db, id) });
    } catch {
      fail(res, 422, "unreadable_pdf");
    }
  });

  r.post("/:id/start", (req, res) => {
    const id = idOf(req.params.id);
    const s = own(id, res.locals.lecturerId);
    if (!s) return fail(res, 404, "not_found");
    if (s.status !== "draft") return fail(res, 409, "already_started");
    const first = db.prepare("SELECT MIN(n) AS n FROM slides WHERE session_id = ?").get(id) as { n: number | null };
    if (first.n === null) return fail(res, 409, "no_slides");
    db.prepare("UPDATE sessions SET status = 'live', current_slide = ?, started_at = datetime('now') WHERE id = ?").run(first.n, id);
    push(db, id);
    res.json({ session: lecturerState(db, id) });
  });

  r.post("/:id/end", (req, res) => {
    const id = idOf(req.params.id);
    const s = own(id, res.locals.lecturerId);
    if (!s) return fail(res, 404, "not_found");
    if (s.status !== "live") return fail(res, 409, "not_live");
    db.prepare("UPDATE sessions SET status = 'ended', ended_at = datetime('now') WHERE id = ?").run(id);
    push(db, id);
    res.json({ session: lecturerState(db, id) });
  });

  /** The lecturer moves to another slide; students see slides up to this one. */
  r.post("/:id/current", (req, res) => {
    const id = idOf(req.params.id);
    const s = own(id, res.locals.lecturerId);
    if (!s) return fail(res, 404, "not_found");
    if (s.status !== "live") return fail(res, 409, "not_live");
    const body = parse(currentSchema, req.body, res);
    if (!body) return;
    if (!db.prepare("SELECT 1 FROM slides WHERE session_id = ? AND n = ?").get(id, body.n)) return fail(res, 400, "no_such_slide");
    db.prepare("UPDATE sessions SET current_slide = ? WHERE id = ?").run(body.n, id);
    push(db, id);
    res.json({ session: lecturerState(db, id) });
  });

  /** Manual transcript line (the default provider). No audio is ever recorded. */
  r.post("/:id/transcript", (req, res) => {
    const id = idOf(req.params.id);
    const s = own(id, res.locals.lecturerId);
    if (!s) return fail(res, 404, "not_found");
    if (s.status !== "live") return fail(res, 409, "not_live");
    const body = parse(transcriptSchema, req.body, res);
    if (!body) return;
    db.prepare("INSERT INTO transcript_lines (session_id, at, text) VALUES (?, strftime('%H:%M', 'now', 'localtime'), ?)").run(id, body.text);
    push(db, id);
    res.status(201).json({ ok: true });
  });

  r.get("/:id/stream", (req, res) => {
    const id = idOf(req.params.id);
    if (!own(id, res.locals.lecturerId)) return fail(res, 404, "not_found");
    subscribe(db, id, res);
  });

  /** After class: pins per slide (same "a few" rule), comments and transcript. */
  r.get("/:id/report", (req, res) => {
    const id = idOf(req.params.id);
    if (!own(id, res.locals.lecturerId)) return fail(res, 404, "not_found");
    const state = lecturerState(db, id)!;
    const transcript = db.prepare("SELECT at, text FROM transcript_lines WHERE session_id = ? ORDER BY id").all(id);
    res.json({ report: { ...state, transcript } });
  });

  return r;
}
