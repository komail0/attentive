import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import type { DB } from "./db.js";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const mac = (payload: string) => crypto.createHmac("sha256", config.secret).update(payload).digest("hex");

export function signToken(lecturerId: number, days = config.sessionDays): string {
  const exp = Date.now() + days * 86_400_000;
  const payload = `${lecturerId}.${exp}`;
  return `${payload}.${mac(payload)}`;
}

export function readToken(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const expected = mac(`${id}.${exp}`);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now()) return null;
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

export function setSessionCookie(res: Response, lecturerId: number): void {
  res.cookie(config.cookieName, signToken(lecturerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: config.sessionDays * 86_400_000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.cookieName, { path: "/" });
}

/** Requires a signed-in lecturer. Puts the id in res.locals.lecturerId. */
export function requireLecturer(db: DB) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = readToken(req.cookies?.[config.cookieName]);
    if (id === null) return void res.status(401).json({ error: "unauthenticated" });
    const row = db.prepare("SELECT id FROM lecturers WHERE id = ?").get(id);
    if (!row) return void res.status(401).json({ error: "unauthenticated" });
    res.locals.lecturerId = id;
    next();
  };
}
