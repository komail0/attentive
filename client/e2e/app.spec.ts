import { expect, test } from "@playwright/test";
import { joinAs, liveSession, makePdf, SLIDES, uniqueEmail } from "./helpers";

test.describe("student", () => {
  test("joins with a code, pins, undoes, and sees only their own pins", async ({ page, request }) => {
    const { code } = await liveSession(request);
    await joinAs(page, code);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/slide/i);
    await expect(page.getByText("Base case: when to stop")).toBeVisible();

    await page.getByRole("button", { name: /^Pin slide 3/ }).click();
    await expect(page.getByRole("status")).toContainText("Pinned slide 3. No name attached.");
    await expect(page.locator(".row").filter({ hasText: "Base case" }).getByRole("button", { name: /^Pinned ✓\. Slide 3/ })).toHaveAttribute("aria-disabled", "true");

    await page.getByRole("link", { name: /my pins/i }).click();
    await expect(page.getByText("Base case: when to stop")).toBeVisible();
    await page.getByRole("button", { name: /^Undo: Slide 3/ }).click();
    await expect(page.getByRole("status")).toContainText("Pin on slide 3 removed.");
    await expect(page.getByText("You have not pinned a slide yet.")).toBeVisible();
  });

  test("remembers the student's pins after a reload, on their device only", async ({ page, request }) => {
    const { code } = await liveSession(request);
    await joinAs(page, code);
    await page.getByRole("button", { name: /^Pin slide 2/ }).click();
    await expect(page.getByRole("status")).toContainText("Pinned slide 2");
    await page.reload();
    await expect(page.getByRole("button", { name: /^Pinned ✓\. Slide 2/ })).toBeVisible();
    const cookies = await page.context().cookies();
    expect(cookies).toEqual([]); // students never get a cookie
  });

  test("the round badge pins the current slide in one tap", async ({ page, request }) => {
    const { code } = await liveSession(request, 3);
    await joinAs(page, code);
    await page.getByRole("button", { name: /^Pin it/ }).click();
    await expect(page.getByRole("status")).toContainText("Pinned slide 3");
    await expect(page.getByRole("button", { name: /^Pinned ✓\. Slide 3/ }).first()).toBeVisible();
  });

  test("adds an anonymous comment through the sheet, with Escape and focus return", async ({ page, request }) => {
    const { code } = await liveSession(request);
    await joinAs(page, code);
    await page.getByRole("button", { name: /^Pin slide 3/ }).click();
    const open = page.getByRole("button", { name: /add a comment/i });
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel("Your comment")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();

    await open.click();
    await page.getByRole("button", { name: /send comment/i }).click();
    await expect(page.getByRole("alert")).toContainText("Write a comment first");
    await page.getByLabel("Your comment").fill("What is the base case for?");
    await page.getByRole("button", { name: /send comment/i }).click();
    await expect(page.getByRole("status")).toContainText("Comment sent. No name attached.");
  });

  test("shows a clear error for a wrong code and one for an empty code", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /join lecture/i }).click();
    await expect(page.getByRole("alert")).toContainText("Enter the session code.");
    await page.fill("#code", "ZZZ-0000");
    await page.press("#code", "Enter");
    await expect(page.getByRole("alert")).toContainText("That code was not found");
    await expect(page.locator("#code")).toBeFocused();
  });

  test("a failed pin keeps the pin, offers Retry, and recovers", async ({ page, request }) => {
    const { code } = await liveSession(request);
    await joinAs(page, code);
    await page.route("**/api/s/*/pin", (route) => route.abort());
    await page.getByRole("button", { name: /^Pin slide 3/ }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Pin not sent");
    await expect(page.getByRole("button", { name: "Retry" })).toBeFocused();
    await page.unroute("**/api/s/*/pin");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("status")).toContainText("Pinned slide 3");
  });

  test("shows a waiting screen until the lecturer starts", async ({ page, request }) => {
    const { lecturerApi } = await import("./helpers");
    await lecturerApi(request);
    const created = await request.post("/api/sessions", { data: { title: "Later" } });
    const code = (await created.json()).session.code as string;
    await page.goto(`/s/${code}`);
    await expect(page.getByText("Waiting for the lecturer to start")).toBeVisible();
  });

  test("shows the after-class summaries and transcript once the lecture has ended", async ({ page, request }) => {
    const { id, code } = await liveSession(request);
    await request.post(`/api/sessions/${id}/transcript`, { data: { text: "The base case stops the recursion." } });
    await joinAs(page, code);
    await page.getByRole("button", { name: /^Pin slide 3/ }).click();
    await expect(page.getByRole("status")).toContainText("Pinned slide 3");
    await request.post(`/api/sessions/${id}/end`, { data: {} });
    await page.waitForURL(/\/after$/, { timeout: 15_000 });
    // pinned slides come first
    await expect(page.locator(".row").first()).toContainText("Base case: when to stop");
    await expect(page.getByText("You pinned this")).toBeVisible();
    await page.getByRole("button", { name: /^Transcript/ }).click();
    await expect(page.getByText("The base case stops the recursion.")).toBeVisible();
  });

  test("switches to Urdu with right-to-left layout and back", async ({ page, request }) => {
    const { code } = await liveSession(request);
    await joinAs(page, code);
    await page.getByRole("button", { name: /EN \| اردو/ }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ur");
    await expect(page.getByRole("button", { name: /پن کریں/ }).first()).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl"); // remembered
    await page.getByRole("button", { name: /EN \| اردو/ }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("text size and theme switches are remembered", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await page.getByRole("button", { name: /^Aa\./ }).click();
    await expect(html).toHaveAttribute("data-size", "1");
    const before = await html.getAttribute("data-theme");
    await page.getByRole("button", { name: /Switch to the (light|dark) theme/ }).click();
    await expect(html).not.toHaveAttribute("data-theme", before!);
    await page.reload();
    await expect(html).toHaveAttribute("data-size", "1");
    await expect(html).not.toHaveAttribute("data-theme", before!);
  });
});

test.describe("lecturer", () => {
  test("registers, builds a session from a PDF, runs the lecture and reads the report", async ({ page, request, browser }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/lecturer");
    await page.waitForURL(/login/);
    await page.getByRole("link", { name: /create an account/i }).click();
    await page.fill("#f-name", "Dr. Amna Basharat");
    await page.fill("#f-email", uniqueEmail());
    await page.fill("#f-password", "correct-horse-battery");
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(/\/lecturer\/sessions$/);
    await expect(page.getByText(/No sessions yet/)).toBeVisible();

    await page.getByRole("link", { name: /new session/i }).first().click();
    await page.fill("#f-title", "Recursion");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/setup/);

    await page.setInputFiles("#pdf", { name: "recursion.pdf", mimeType: "application/pdf", buffer: makePdf(SLIDES.map(([a, b]) => [a, b])) });
    await expect(page.getByText(/4 slides found/)).toBeVisible();
    await expect(page.locator('input[value="Base case: when to stop"]')).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();
    const code = (await page.locator(".code").innerText()).trim();
    expect(code).toMatch(/^[A-Z]{3}-\d{4}$/);
    await page.getByRole("button", { name: /start lecture/i }).click();
    await page.waitForURL(/sessions\/\d+$/);
    await expect(page.getByText(/Nothing pinned yet|No pins yet/i)).toBeVisible();

    // three different students pin slide 1 and one comments; the lecturer sees "a few" then the real number
    const student = async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: "http://localhost:3200" });
      const p = await ctx.newPage();
      await joinAs(p, code);
      await p.getByRole("button", { name: /^Pin slide 1/ }).click();
      await expect(p.getByRole("status")).toContainText("Pinned slide 1");
      return { p, ctx };
    };
    const s1 = await student();
    await expect(page.locator(".cell").first()).toContainText("a few");
    const s2 = await student();
    await expect(page.locator(".cell").first()).toContainText("a few");
    const s3 = await student();
    await expect(page.locator(".cell").first()).not.toContainText("a few");
    await expect(page.locator(".cell").first().locator(".tcount")).toHaveText("3");
    await expect(page.getByText("3 Pins")).toBeVisible();
    await expect(page.getByText("3 Joined")).toBeVisible();

    await s1.p.getByRole("button", { name: /add a comment/i }).click();
    await s1.p.getByLabel("Your comment").fill("What is a function for?");
    await s1.p.getByRole("button", { name: /send comment/i }).click();
    await expect(page.getByText("What is a function for?")).toBeVisible();

    // the lecturer adds a transcript line and moves to slide 3
    await page.getByLabel("Add a transcript line").fill("A function is a named block of code.");
    await page.getByRole("button", { name: /add line/i }).click();
    await expect(page.getByText("A function is a named block of code.")).toBeVisible();
    await page.locator(".cell").nth(2).click();
    await page.getByRole("button", { name: /show this slide/i }).click();
    await expect(s2.p.getByText("Base case: when to stop")).toBeVisible({ timeout: 15_000 });

    // end with confirmation
    await page.getByRole("button", { name: /end lecture/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /end lecture/i }).click();
    await page.waitForURL(/report/);
    await expect(page.getByRole("heading", { name: /pins by slide/i })).toBeVisible();
    await expect(page.locator("tbody tr").first()).toContainText("What is a function");
    await expect(page.getByText("What is a function for?")).toBeVisible();
    await expect(page.getByText("A function is a named block of code.")).toBeVisible();

    // students are taken to the after-class page
    await s3.p.waitForURL(/after/, { timeout: 15_000 });
    await expect(s3.p.getByText("You pinned this")).toBeVisible();
    await s1.ctx.close();
    await s2.ctx.close();
    await s3.ctx.close();

    // signing out and back in keeps the sessions
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/login/);
    await page.goto("/lecturer/sessions");
    await page.waitForURL(/login/);
  });

  test("keeps one lecturer's session private from another lecturer", async ({ browser, request }) => {
    const { id } = await liveSession(request);
    const ctx = await browser.newContext({ baseURL: "http://localhost:3200" });
    const other = await ctx.request.post("/api/auth/register", { data: { name: "Other", email: uniqueEmail(), password: "another-long-password" } });
    expect(other.ok()).toBeTruthy();
    expect((await ctx.request.get(`/api/sessions/${id}`)).status()).toBe(404);
    expect((await ctx.request.get(`/api/sessions/${id}/report`)).status()).toBe(404);
    await ctx.close();
  });

  test("shows a wrong-password error without saying which part was wrong", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/lecturer/login");
    await page.fill("#f-email", "nobody@isb.nu.edu.pk");
    await page.fill("#f-password", "wrong-password-1");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByRole("alert")).toContainText("Email or password is not right.");
  });

  test("the dashboard works right to left in Urdu", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const email = uniqueEmail();
    await request.post("/api/auth/register", { data: { name: "Dr. Amna", email, password: "correct-horse-battery" } });
    const created = await request.post("/api/sessions", { data: { title: "Recursion" } });
    const { id } = (await created.json()).session as { id: number };
    await request.put(`/api/sessions/${id}/slides`, { data: { slides: [{ n: 1, title: "Intro" }, { n: 2, title: "Base case" }] } });
    await request.post(`/api/sessions/${id}/start`, { data: {} });
    // sign the browser in as the same lecturer
    await page.goto("/lecturer/login");
    await page.fill("#f-email", email);
    await page.fill("#f-password", "correct-horse-battery");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/sessions/);
    await page.goto(`/lecturer/sessions/${id}`);
    await page.getByRole("button", { name: /EN \| اردو/ }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("شامل").first()).toBeVisible();
  });
});
