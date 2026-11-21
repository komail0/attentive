import type { APIRequestContext, Page } from "@playwright/test";

/** A tiny valid PDF with one page per [title, body] pair. */
export function makePdf(pages: [string, string][]): Buffer {
  const objs: string[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`;
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

export const SLIDES = [
  ["What is a function", "A function is a named block of code that does one job."],
  ["Parameters and return values", "Parameters carry values in; a return value carries a result out."],
  ["Base case: when to stop", "The base case ends the recursion; without it the calls never end."],
  ["Recursive calls", "Each call makes a smaller call until the base case is reached."],
] as const;

let counter = 0;
export const uniqueEmail = () => `lecturer${Date.now()}${counter++}@isb.nu.edu.pk`;

/** Registers a lecturer and returns an API context that carries their cookie. */
export async function lecturerApi(request: APIRequestContext) {
  const email = uniqueEmail();
  const res = await request.post("/api/auth/register", { data: { name: "Dr. Amna Basharat", email, password: "correct-horse-battery" } });
  if (!res.ok()) throw new Error(`register failed: ${res.status()}`);
  return { email, password: "correct-horse-battery" };
}

/** Creates a live session with the demo slides through the API. Returns its id and code. */
export async function liveSession(request: APIRequestContext, current = 3): Promise<{ id: number; code: string }> {
  await lecturerApi(request);
  const created = await request.post("/api/sessions", { data: { title: "Recursion", course: "CS1002" } });
  const { id, code } = (await created.json()).session as { id: number; code: string };
  await request.put(`/api/sessions/${id}/slides`, { data: { slides: SLIDES.map(([title, summary], i) => ({ n: i + 1, title, summary })) } });
  await request.post(`/api/sessions/${id}/start`, { data: {} });
  await request.post(`/api/sessions/${id}/current`, { data: { n: current } });
  return { id, code };
}

export async function joinAs(page: Page, code: string) {
  await page.goto("/");
  await page.fill("#code", code);
  await page.press("#code", "Enter");
  await page.waitForURL(/\/s\//);
  await page.getByRole("heading", { level: 1 }).waitFor();
}
