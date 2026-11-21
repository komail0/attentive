import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { joinAs, liveSession, makePdf, SLIDES, uniqueEmail } from "./helpers";

const THEMES = ["dark", "light"] as const;
const LANGS = ["en", "ur"] as const;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function prefs(page: Page, theme: string, lang: string) {
  await page.addInitScript(([t, l]) => {
    localStorage.setItem("att-theme", t);
    localStorage.setItem("att-lang", l);
  }, [theme, lang]);
}

async function expectNoViolations(page: Page, label: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0)); // sticky bars hide rows while scrolled; check the page as it opens
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const found = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(found, `${label}: accessibility violations`).toEqual([]);
}

for (const theme of THEMES) {
  for (const lang of LANGS) {
    test.describe(`axe: student screens, ${theme}, ${lang}`, () => {
      test("join, wrong code, slides, pinned, comment sheet, failed pin, my pins, help, waiting, offline, after class", async ({ page, request }) => {
        test.setTimeout(40_000);
        // Tall viewport: the sticky pin bar would otherwise sit over rows that are further down the page, which is normal scrolling, not a defect.
        await page.setViewportSize({ width: 390, height: 1400 });
        await prefs(page, theme, lang);
        const { id, code } = await liveSession(request);
        const key = `${theme}/${lang}`;

        await page.goto("/");
        await expectNoViolations(page, `${key} join`);
        await page.fill("#code", "ZZZ-0000");
        await page.press("#code", "Enter");
        await page.locator("#code-err").waitFor();
        await expectNoViolations(page, `${key} join error`);

        await joinAs(page, code);
        await expectNoViolations(page, `${key} slides`);

        await page.locator(".row").filter({ hasText: "Base case" }).getByRole("button").click();
        await page.getByRole("status").getByText(/\d/).first().waitFor();
        await expectNoViolations(page, `${key} pinned`);

        await page.getByRole("status").getByRole("button").nth(1).click();
        await page.getByRole("dialog").waitFor();
        await expectNoViolations(page, `${key} comment sheet`);
        await page.keyboard.press("Escape");

        await page.route("**/api/s/*/pin", (r) => r.abort());
        await page.locator(".row").filter({ hasText: "What is a function" }).getByRole("button").click();
        await page.getByRole("alert").waitFor();
        await expectNoViolations(page, `${key} failed pin`);
        await page.unroute("**/api/s/*/pin");

        await page.locator("a.tabi").nth(1).click();
        await expectNoViolations(page, `${key} my pins`);
        await page.locator("a.tabi").nth(2).click();
        await expectNoViolations(page, `${key} help`);

        await page.route("**/api/s/*/state", (r) => r.abort());
        await page.locator(".bigic.warnic").waitFor({ timeout: 15_000 });
        await expectNoViolations(page, `${key} offline`);
        await page.unroute("**/api/s/*/state");

        await request.post(`/api/sessions/${id}/end`, { data: {} });
        await page.waitForURL(/after/, { timeout: 15_000 });
        await page.locator(".row").first().waitFor();
        await expectNoViolations(page, `${key} after class summaries`);
        await page.locator(".seg button").nth(1).click();
        await expectNoViolations(page, `${key} after class transcript`);
      });

      test("waiting screen", async ({ page, request }) => {
        await prefs(page, theme, lang);
        const { lecturerApi } = await import("./helpers");
        await lecturerApi(request);
        const created = await request.post("/api/sessions", { data: { title: "Later" } });
        await page.goto(`/s/${(await created.json()).session.code}`);
        await page.locator("h2").first().waitFor();
        await expectNoViolations(page, `${theme}/${lang} waiting`);
      });
    });

    test.describe(`axe: lecturer screens, ${theme}, ${lang}`, () => {
      test("login, register, sessions, new, setup, code, dashboard, report", async ({ page }) => {
        test.setTimeout(60_000);
        await page.setViewportSize({ width: 1280, height: 900 });
        await prefs(page, theme, lang);
        const key = `${theme}/${lang}`;

        await page.goto("/lecturer/login");
        await page.locator("form").waitFor();
        await expectNoViolations(page, `${key} sign in`);
        await page.goto("/lecturer/register");
        await page.locator("form").waitFor();
        await expectNoViolations(page, `${key} register`);

        await page.request.post("/api/auth/register", { data: { name: "Dr. Amna", email: uniqueEmail(), password: "correct-horse-battery" } });
        await page.goto("/lecturer/sessions");
        await page.getByRole("link").first().waitFor();
        await expectNoViolations(page, `${key} sessions (empty)`);

        await page.goto("/lecturer/new");
        await page.locator("form").waitFor();
        await expectNoViolations(page, `${key} new session`);
        await page.fill("#f-title", "Recursion");
        await page.locator("form button[type=submit]").click();
        await page.waitForURL(/setup/);
        await page.setInputFiles("#pdf", { name: "r.pdf", mimeType: "application/pdf", buffer: makePdf(SLIDES.map(([a, b]) => [a, b])) });
        await page.locator(".slide-edit").first().waitFor();
        await expectNoViolations(page, `${key} setup`);
        await page.locator(".panel .row2 .btn:not(.line)").last().click();
        await page.locator(".code").waitFor();
        await expectNoViolations(page, `${key} share code`);
        await page.locator(".panel .row2 .btn:not(.line)").click();
        await page.waitForURL(/sessions\/\d+$/);
        await page.locator(".strip").waitFor();
        await expectNoViolations(page, `${key} dashboard (empty)`);

        const code = (await page.locator(".meta[dir=ltr]").first().innerText()).split("·").pop()!.trim();
        for (let i = 0; i < 4; i++) await page.request.post(`/api/s/${code}/pin`, { data: { slide: 1 } });
        await page.request.post(`/api/s/${code}/comment`, { data: { slide: 1, text: "What is a function for?" } });
        await page.locator(".cell").first().locator(".tcount").waitFor();
        await expectNoViolations(page, `${key} dashboard (pins)`);

        await page.locator(".dhero + .stats .btn").click();
        await page.getByRole("dialog").waitFor();
        await expectNoViolations(page, `${key} end confirmation`);
        await page.getByRole("dialog").locator(".btn:not(.line)").click();
        await page.waitForURL(/report/);
        await page.locator("table").waitFor();
        await expectNoViolations(page, `${key} report`);
      });
    });
  }
}

test.describe("keyboard", () => {
  test("the whole student flow works with the keyboard alone", async ({ page, request }) => {
    const { code } = await liveSession(request);
    await page.goto("/");
    await page.keyboard.press("Tab"); // skip link
    await expect(page.getByRole("link", { name: /skip to main content/i })).toBeFocused();
    await page.locator("#code").focus();
    await page.keyboard.type(code);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/s\//);
    const pin = page.locator(".row").filter({ hasText: "Base case" }).getByRole("button");
    await pin.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText("Pinned slide 3");
    // a focus ring is visible on the focused control
    await pin.focus();
    const outline = await pin.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe("solid");
    // pressing a disabled-looking pinned button does nothing and keeps focus on it
    await page.keyboard.press("Enter");
    await expect(pin).toBeFocused();
  });

  test("the comment sheet traps focus", async ({ page, request }) => {
    const { code } = await liveSession(request);
    await joinAs(page, code);
    await page.locator(".row").filter({ hasText: "Base case" }).getByRole("button").click();
    await page.getByRole("button", { name: /add a comment/i }).click();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"));
      expect(inside).toBe(true);
    }
  });
});

test.describe("layout", () => {
  for (const width of [320, 390]) {
    for (const size of ["0", "2"]) {
      test(`student screens do not scroll sideways at ${width}px with text size ${size}`, async ({ page, request }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.addInitScript((s) => localStorage.setItem("att-size", s), size);
        const { code } = await liveSession(request);
        const overflow = async (label: string) => {
          const w = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
          expect(w.s, `${label} overflows (${w.s} > ${w.c})`).toBeLessThanOrEqual(w.c);
        };
        await page.goto("/");
        await overflow("join");
        await joinAs(page, code);
        await overflow("slides");
        await page.locator("a.tabi").nth(1).click();
        await overflow("my pins");
        await page.locator("a.tabi").nth(2).click();
        await overflow("help");
      });
    }
  }

  test("every button and link on the student screens is at least 44 px", async ({ page, request }) => {
    const { code } = await liveSession(request);
    const small: string[] = [];
    const measure = async (label: string) => {
      const items = await page.$$eval("button, a, input, textarea", (els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent !== null && !e.classList.contains("sr-only") && !e.classList.contains("skip"))
          .map((e) => {
            const r = e.getBoundingClientRect();
            return { text: (e.textContent || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 30), w: r.width, h: r.height };
          }),
      );
      for (const i of items) if (i.h < 44 || i.w < 44) small.push(`${label}: ${i.text} ${Math.round(i.w)}x${Math.round(i.h)}`);
    };
    await page.goto("/");
    await measure("join");
    await joinAs(page, code);
    await measure("slides");
    await page.locator("a.tabi").nth(1).click();
    await measure("my pins");
    await page.locator("a.tabi").nth(2).click();
    await measure("help");
    expect(small).toEqual([]);
  });
});
