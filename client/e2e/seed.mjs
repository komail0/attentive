// Seeds a live demo session on a running server. Usage: node e2e/seed.mjs [baseUrl]
const base = process.argv[2] ?? "http://localhost:3100";
const j = async (path, body, cookie) => {
  const res = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { res, data: text ? JSON.parse(text) : {} };
};
const email = `demo${Date.now()}@isb.nu.edu.pk`;
const reg = await j("/api/auth/register", { name: "Dr. Amna Basharat", email, password: "demo-password-123" });
const cookie = reg.res.headers.get("set-cookie").split(";")[0];
const s = await j("/api/sessions", { title: "Recursion", course: "CS1002" }, cookie);
const id = s.data.session.id;
const titles = ["What is a function", "Parameters and return values", "Passing arguments", "Return addresses", "Breaking a problem down", "Factorial by hand", "Stack frames", "Calling a function", "Base case: when to stop", "Recursive calls"];
const sums = ["A function is a named block of code that does one job.", "Parameters carry values in; a return value carries a result out.", "The caller gives each parameter a value when it calls.", "The program remembers where to continue after a call ends.", "A big problem can be split into a smaller copy of itself.", "5! is 5 times 4!, and 4! is 4 times 3!, and so on.", "Every call gets its own frame on the call stack.", "A function can call another function, or itself.", "The base case ends the recursion; without it the calls never end.", "Each call makes a smaller call until the base case is reached."];
await fetch(`${base}/api/sessions/${id}/slides`, { method: "PUT", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ slides: titles.map((t, i) => ({ n: i + 5, title: t, summary: sums[i] })) }) });
await j(`/api/sessions/${id}/start`, {}, cookie);
await j(`/api/sessions/${id}/current`, { n: 14 }, cookie);
console.log(JSON.stringify({ id, code: s.data.session.code, email, cookie }));
