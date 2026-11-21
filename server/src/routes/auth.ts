import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { clearSessionCookie, hashPassword, requireLecturer, setSessionCookie, verifyPassword } from "../lib/auth.js";
import type { DB } from "../lib/db.js";
import { fail, parse } from "../lib/http.js";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10).max(200),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

interface LecturerRow { id: number; name: string; email: string; password_hash: string }
const publicLecturer = (l: LecturerRow) => ({ id: l.id, name: l.name, email: l.email });

export function authRouter(db: DB): Router {
  const r = Router();
  const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false, skip: () => process.env.NODE_ENV === "test" });

  r.post("/register", limiter, (req, res) => {
    const body = parse(registerSchema, req.body, res);
    if (!body) return;
    if (db.prepare("SELECT 1 FROM lecturers WHERE email = ?").get(body.email)) return fail(res, 409, "email_taken");
    const info = db.prepare("INSERT INTO lecturers (name, email, password_hash) VALUES (?, ?, ?)").run(body.name, body.email, hashPassword(body.password));
    const lecturer = db.prepare("SELECT * FROM lecturers WHERE id = ?").get(info.lastInsertRowid) as LecturerRow;
    setSessionCookie(res, lecturer.id);
    res.status(201).json({ lecturer: publicLecturer(lecturer) });
  });

  r.post("/login", limiter, (req, res) => {
    const body = parse(loginSchema, req.body, res);
    if (!body) return;
    const lecturer = db.prepare("SELECT * FROM lecturers WHERE email = ?").get(body.email) as LecturerRow | undefined;
    // Same answer whether the email or the password is wrong.
    if (!lecturer || !verifyPassword(body.password, lecturer.password_hash)) return fail(res, 401, "bad_credentials");
    setSessionCookie(res, lecturer.id);
    res.json({ lecturer: publicLecturer(lecturer) });
  });

  r.post("/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  r.get("/me", requireLecturer(db), (_req, res) => {
    const l = db.prepare("SELECT * FROM lecturers WHERE id = ?").get(res.locals.lecturerId) as LecturerRow;
    res.json({ lecturer: publicLecturer(l) });
  });

  return r;
}
