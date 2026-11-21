import crypto from "node:crypto";
import { config } from "../config.js";
import type { DB } from "./db.js";

const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I, L, O: easy to read aloud

/** A short code students type in, like KMR-4821. Unique across sessions. */
export function newCode(db: DB): string {
  for (let i = 0; i < 50; i++) {
    let letters = "";
    for (let j = 0; j < 3; j++) letters += LETTERS[crypto.randomInt(LETTERS.length)];
    const code = `${letters}-${crypto.randomInt(1000, 10000)}`;
    if (!db.prepare("SELECT 1 FROM sessions WHERE code = ?").get(code)) return code;
  }
  throw new Error("could not allocate a session code");
}

export interface PageText {
  n: number;
  title: string;
  body: string;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** The first sentence of a slide's text, shortened, used as the one-line summary. */
export function firstSentence(body: string, max = 140): string {
  const t = clean(body);
  if (!t) return "";
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  const s = m ? m[1] : t;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/** Reads each PDF page: the largest text on the page becomes the title, the rest is the body. */
export async function pdfToPages(buf: Buffer): Promise<PageText[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, isEvalSupported: false, verbosity: 0 }).promise;
  const pages: PageText[] = [];
  const limit = Math.min(doc.numPages, 200);
  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it): it is Extract<typeof it, { str: string }> => "str" in it && typeof it.str === "string" && it.str.trim() !== "")
      .map((it) => ({ str: it.str, size: Math.abs(it.transform[3]) || it.height || 0, y: Math.round(it.transform[5]) }));
    let title = "";
    if (items.length) {
      const maxSize = Math.max(...items.map((x) => x.size));
      const big = items.filter((x) => x.size >= maxSize - 0.5);
      const firstLineY = big[0].y;
      title = clean(big.filter((x) => Math.abs(x.y - firstLineY) <= 2).map((x) => x.str).join(" "));
    }
    const body = clean(items.map((x) => x.str).join(" ")).replace(title, "").trim();
    pages.push({ n: i, title: title.slice(0, 120) || `Slide ${i}`, body });
  }
  return pages;
}

/** Optional AI one-line summary. Falls back to the first sentence when no key is set or the call fails. */
export async function summarize(title: string, body: string): Promise<string> {
  const fallback = firstSentence(body);
  if (!config.anthropicKey || !body.trim()) return fallback;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": config.anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 80,
        messages: [{ role: "user", content: `Summarise this lecture slide in one plain sentence of at most 20 words. Reply with the sentence only.\n\nTitle: ${title}\n\n${body.slice(0, 2000)}` }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const data = (await res.json()) as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text?.trim();
    return text ? text.slice(0, 200) : fallback;
  } catch {
    return fallback;
  }
}
