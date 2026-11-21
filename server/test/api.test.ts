import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDb, type DB } from "../src/lib/db.js";

let db: DB;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDb(":memory:");
  app = createApp(db, "/nonexistent");
});

const creds = { name: "Dr. Amna Basharat", email: "amna@isb.nu.edu.pk", password: "correct-horse-battery" };

async function lecturer(c = creds) {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send(c).expect(201);
  return agent;
}

/** Makes a live session with 5 slides and returns the code and id. */
async function liveSession(agent: ReturnType<typeof request.agent>, current = 5) {
  const created = await agent.post("/api/sessions").send({ title: "Recursion", course: "CS1002" }).expect(201);
  const id = created.body.session.id as number;
  const code = created.body.session.code as string;
  await agent
    .put(`/api/sessions/${id}/slides`)
    .send({ slides: [1, 2, 3, 4, 5].map((n) => ({ n, title: `Slide ${n}`, summary: `About ${n}.` })) })
    .expect(200);
  await agent.post(`/api/sessions/${id}/start`).expect(200);
  if (current !== 1) {
    await agent.post(`/api/sessions/${id}/current`).send({ n: current }).expect(200);
  }
  return { id, code };
}

/** A tiny but valid PDF: one page per [title, body] pair, set in Helvetica. */
function makePdf(pages: [string, string][]): Buffer {
  const objs: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach(([title, body], i) => {
    const stream = `BT /F1 32 Tf 50 700 Td (${title}) Tj ET BT /F1 12 Tf 50 650 Td (${body}) Tj ET`;
    objs[4 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objs[5 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

describe("accounts", () => {
  it("registers, reads the profile, signs out and back in", async () => {
    const agent = await lecturer();
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.lecturer.email).toBe(creds.email);
    expect(me.body.lecturer).not.toHaveProperty("password_hash");
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);
    await agent.post("/api/auth/login").send({ email: creds.email.toUpperCase(), password: creds.password }).expect(200);
    await agent.get("/api/auth/me").expect(200);
  });

  it("stores only a salted hash", () => {
    return lecturer().then(() => {
      const row = db.prepare("SELECT password_hash FROM lecturers").get() as { password_hash: string };
      expect(row.password_hash.startsWith("scrypt$")).toBe(true);
      expect(row.password_hash).not.toContain(creds.password);
    });
  });

  it("rejects duplicates, weak passwords and wrong credentials with the same answer for email and password", async () => {
    await lecturer();
    await request(app).post("/api/auth/register").send(creds).expect(409);
    await request(app).post("/api/auth/register").send({ ...creds, email: "x@y.pk", password: "short" }).expect(400);
    const a = await request(app).post("/api/auth/login").send({ email: creds.email, password: "wrong-password-1" }).expect(401);
    const b = await request(app).post("/api/auth/login").send({ email: "nobody@y.pk", password: "wrong-password-1" }).expect(401);
    expect(a.body).toEqual(b.body);
  });

  it("protects lecturer routes", async () => {
    await request(app).get("/api/sessions").expect(401);
    await request(app).post("/api/sessions").send({ title: "x" }).expect(401);
  });
});

describe("session lifecycle", () => {
  it("cannot start without slides, then goes draft -> live -> ended", async () => {
    const agent = await lecturer();
    const created = await agent.post("/api/sessions").send({ title: "Recursion" }).expect(201);
    const id = created.body.session.id;
    expect(created.body.session.code).toMatch(/^[A-Z]{3}-\d{4}$/);
    expect(created.body.session.status).toBe("draft");
    await agent.post(`/api/sessions/${id}/start`).expect(409);
    await agent.put(`/api/sessions/${id}/slides`).send({ slides: [{ n: 1, title: "Intro" }, { n: 2, title: "Base case" }] }).expect(200);
    const started = await agent.post(`/api/sessions/${id}/start`).expect(200);
    expect(started.body.session.status).toBe("live");
    expect(started.body.session.current).toBe(1);
    await agent.post(`/api/sessions/${id}/start`).expect(409);
    await agent.put(`/api/sessions/${id}/slides`).send({ slides: [{ n: 1, title: "x" }] }).expect(409);
    const ended = await agent.post(`/api/sessions/${id}/end`).expect(200);
    expect(ended.body.session.status).toBe("ended");
    await agent.delete(`/api/sessions/${id}`).expect(200);
  });

  it("keeps one lecturer's sessions invisible to another", async () => {
    const a = await lecturer();
    const b = await lecturer({ name: "Other", email: "other@isb.nu.edu.pk", password: "another-long-password" });
    const { id } = await liveSession(a);
    await b.get(`/api/sessions/${id}`).expect(404);
    await b.post(`/api/sessions/${id}/end`).expect(404);
    await b.get(`/api/sessions/${id}/report`).expect(404);
    const list = await b.get("/api/sessions").expect(200);
    expect(list.body.sessions).toHaveLength(0);
  });

  it("validates input", async () => {
    const agent = await lecturer();
    await agent.post("/api/sessions").send({ title: "" }).expect(400);
    await agent.post("/api/sessions").send({}).expect(400);
    const { id } = await liveSession(agent);
    await agent.post(`/api/sessions/${id}/current`).send({ n: 99 }).expect(400);
    await agent.post(`/api/sessions/${id}/transcript`).send({ text: "" }).expect(400);
    await agent.get("/api/sessions/abc").expect(404);
  });
});

describe("students and anonymity", () => {
  it("shows a draft session as empty and refuses pins before the lecture starts", async () => {
    const agent = await lecturer();
    const created = await agent.post("/api/sessions").send({ title: "Recursion" }).expect(201);
    const code = created.body.session.code;
    const state = await request(app).get(`/api/s/${code}/state`).expect(200);
    expect(state.body.session.status).toBe("draft");
    expect(state.body.session.slides).toEqual([]);
    await request(app).post(`/api/s/${code}/pin`).send({ slide: 1 }).expect(409);
    await request(app).get("/api/s/NOPE-0000/state").expect(404);
  });

  it("reveals only slides up to the current one while live, and all once ended", async () => {
    const agent = await lecturer();
    const { id, code } = await liveSession(agent, 3);
    const live = await request(app).post(`/api/s/${code}/join`).expect(200);
    expect(live.body.session.slides.map((s: { n: number }) => s.n)).toEqual([1, 2, 3]);
    await request(app).post(`/api/s/${code}/pin`).send({ slide: 5 }).expect(400);
    await agent.post(`/api/sessions/${id}/end`).expect(200);
    const ended = await request(app).get(`/api/s/${code}/state`).expect(200);
    expect(ended.body.session.slides).toHaveLength(5);
  });

  it("shows 'a few' under 3 pins and the real number from 3", async () => {
    const agent = await lecturer();
    const { id, code } = await liveSession(agent);
    const shown = async (n: number) => (await agent.get(`/api/sessions/${id}`)).body.session.slides.find((s: { n: number }) => s.n === n).display;
    expect(await shown(4)).toBe("none");
    await request(app).post(`/api/s/${code}/pin`).send({ slide: 4 }).expect(200);
    expect(await shown(4)).toBe("few");
    await request(app).post(`/api/s/${code}/pin`).send({ slide: 4 }).expect(200);
    expect(await shown(4)).toBe("few");
    await request(app).post(`/api/s/${code}/pin`).send({ slide: 4 }).expect(200);
    expect(await shown(4)).toBe(3);
    const state = (await agent.get(`/api/sessions/${id}`)).body.session;
    expect(state.hottest).toBe(4);
    expect(state.totalPins).toBe(3);
    await request(app).post(`/api/s/${code}/unpin`).send({ slide: 4 }).expect(200);
    expect(await shown(4)).toBe("few");
  });

  it("never lets the exact count below the threshold leave the server", async () => {
    const agent = await lecturer();
    const { id, code } = await liveSession(agent);
    await request(app).post(`/api/s/${code}/pin`).send({ slide: 2 }).expect(200);
    const raw = JSON.stringify((await agent.get(`/api/sessions/${id}`)).body);
    const state = (await agent.get(`/api/sessions/${id}`)).body.session;
    expect(state.slides.find((s: { n: number }) => s.n === 2).display).toBe("few");
    expect(state.totalPins).toBe("few");
    expect(raw).not.toMatch(/"display":1\b/);
  });

  it("stores no student identifier or timestamp anywhere", async () => {
    const agent = await lecturer();
    const { code } = await liveSession(agent);
    await request(app).post(`/api/s/${code}/join`).set("User-Agent", "Secret Phone 9000").set("X-Forwarded-For", "203.0.113.7").expect(200);
    await request(app).post(`/api/s/${code}/pin`).set("User-Agent", "Secret Phone 9000").send({ slide: 2 }).expect(200);
    await request(app).post(`/api/s/${code}/comment`).send({ slide: 2, text: "what is the base case for?" }).expect(200);
    const cols = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
    expect(cols("pins")).toEqual(["id", "session_id", "slide_n"]);
    expect(cols("comments")).toEqual(["id", "session_id", "slide_n", "text"]);
    // Nothing a student sent (address, device name) appears in any table.
    for (const t of ["pins", "comments", "sessions", "slides", "transcript_lines"]) {
      const dump = JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all());
      expect(dump).not.toContain("Secret Phone");
      expect(dump).not.toContain("203.0.113.7");
    }
    // Joining adds one to a counter and nothing else.
    expect((db.prepare("SELECT joined FROM sessions").get() as { joined: number }).joined).toBe(1);
  });

  it("limits comment length and rejects empty comments", async () => {
    const agent = await lecturer();
    const { code } = await liveSession(agent);
    await request(app).post(`/api/s/${code}/comment`).send({ slide: 2, text: "x".repeat(281) }).expect(400);
    await request(app).post(`/api/s/${code}/comment`).send({ slide: 2, text: "   " }).expect(400);
    await request(app).post(`/api/s/${code}/comment`).send({ slide: 2, text: "x".repeat(280) }).expect(200);
  });

  it("gives every student the summaries and transcript after class, with no pin data", async () => {
    const agent = await lecturer();
    const { id, code } = await liveSession(agent);
    await agent.post(`/api/sessions/${id}/transcript`).send({ text: "The base case stops the recursion." }).expect(201);
    await request(app).get(`/api/s/${code}/after`).expect(409);
    await request(app).post(`/api/s/${code}/pin`).send({ slide: 2 }).expect(200);
    await agent.post(`/api/sessions/${id}/end`).expect(200);
    const after = await request(app).get(`/api/s/${code}/after`).expect(200);
    expect(after.body.transcript[0].text).toContain("base case");
    expect(JSON.stringify(after.body)).not.toMatch(/pin|display/i);
  });
});

describe("report", () => {
  it("returns per-slide counts, comments and the full transcript", async () => {
    const agent = await lecturer();
    const { id, code } = await liveSession(agent);
    for (let i = 0; i < 4; i++) await request(app).post(`/api/s/${code}/pin`).send({ slide: 3 }).expect(200);
    await request(app).post(`/api/s/${code}/comment`).send({ slide: 3, text: "why stop at 1?" }).expect(200);
    await agent.post(`/api/sessions/${id}/transcript`).send({ text: "line one" }).expect(201);
    await agent.post(`/api/sessions/${id}/end`).expect(200);
    const rep = (await agent.get(`/api/sessions/${id}/report`).expect(200)).body.report;
    expect(rep.slides.find((s: { n: number }) => s.n === 3).display).toBe(4);
    expect(rep.comments).toEqual([{ slide: 3, text: "why stop at 1?" }]);
    expect(rep.transcript).toHaveLength(1);
    expect(rep.hottest).toBe(3);
  });
});

describe("slide upload", () => {
  it("turns each PDF page into a slide, titled from its largest text", async () => {
    const agent = await lecturer();
    const id = (await agent.post("/api/sessions").send({ title: "Recursion" })).body.session.id;
    const pdf = makePdf([["What is a function", "A function is a named block of code. It does one job."], ["Base case", "The base case ends the recursion."]]);
    const res = await agent.post(`/api/sessions/${id}/slides/upload`).attach("file", pdf, "recursion.pdf").expect(200);
    const slides = res.body.session.slides;
    expect(slides).toHaveLength(2);
    expect(slides[0].title).toBe("What is a function");
    expect(slides[0].summary).toBe("A function is a named block of code.");
    expect(slides[1].title).toBe("Base case");
  });

  it("refuses files that are not PDFs", async () => {
    const agent = await lecturer();
    const id = (await agent.post("/api/sessions").send({ title: "x" })).body.session.id;
    await agent.post(`/api/sessions/${id}/slides/upload`).attach("file", Buffer.from("hello"), "a.pdf").expect(415);
    await agent.post(`/api/sessions/${id}/slides/upload`).expect(400);
  });
});

describe("robustness", () => {
  it("answers bad JSON and unknown routes without leaking details", async () => {
    const bad = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{not json").expect(400);
    expect(bad.body).toEqual({ error: "invalid_json" });
    await request(app).get("/api/nope").expect(404);
  });
});
