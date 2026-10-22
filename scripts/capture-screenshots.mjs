/**
 * Repeatable UI capture for Eventora AI.
 *
 * Usage (with Playwright installed outside the repo):
 *   EVENT_ID=<event-id> DEMO_EMAIL=<email> DEMO_PASSWORD=<password> \
 *     node scripts/capture-screenshots.mjs
 *
 * Requires a running Next dev server at http://127.0.0.1:3000 and the FastAPI
 * backend at http://127.0.0.1:8000. Do not run this against real user data.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = process.env.OUTPUT_DIR ?? path.resolve("docs/screenshots");
const EVENT_ID = process.env.EVENT_ID;
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;

fs.mkdirSync(OUT, { recursive: true });

const errors = [];

function watch(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[console:${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`[pageerror:${label}] ${err.message}`));
}

async function overflow(page, label) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  if (result.scrollWidth > result.innerWidth + 1) {
    errors.push(`[overflow:${label}] ${result.scrollWidth} > ${result.innerWidth}`);
  }
  return result;
}

// Some containers lack the headless-shell system libraries but can run the
// full Chromium binary. Set CHROME_EXECUTABLE when needed.
const executablePath = process.env.CHROME_EXECUTABLE;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ["--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox", "--disable-software-rasterizer"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
watch(page, "desktop");

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/landing-hero.png` });
await overflow(page, "landing");

await page.locator("#intelligence").scrollIntoViewIfNeeded();
await page.getByRole("button", { name: /Estimate this event/i }).click();
await page.getByText("Random Forest planning estimate").waitFor({ timeout: 30000 });
await page.locator("#intelligence").screenshot({ path: `${OUT}/landing-estimator.png` });
await page.screenshot({ path: `${OUT}/landing-full.jpg`, fullPage: true, type: "jpeg", quality: 78 });

await page.goto(BASE + "/sign-in", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/sign-in.png` });
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.getByRole("button", { name: /Enter the studio/i }).click();
await page.waitForURL("**/dashboard", { timeout: 30000 });
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}/dashboard.png` });
await page.screenshot({ path: `${OUT}/dashboard-full.jpg`, fullPage: true, type: "jpeg", quality: 80 });
await overflow(page, "dashboard");

if (EVENT_ID) {
  await page.goto(`${BASE}/events/${EVENT_ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/workspace-overview.png` });
  await overflow(page, "workspace");

  const planTab = page.getByRole("button", { name: /^Plan$/ });
  if (await planTab.count()) {
    await planTab.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/workspace-plan.png` });
    await page.screenshot({ path: `${OUT}/workspace-plan-full.jpg`, fullPage: true, type: "jpeg", quality: 78 });
  }

  const budgetTab = page.getByRole("button", { name: /^Budget$/ });
  if (await budgetTab.count()) {
    await budgetTab.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/workspace-budget.png` });
  }

  const assistantTab = page.getByRole("button", { name: /^Assistant$/ });
  if (await assistantTab.count()) {
    await assistantTab.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/workspace-assistant.png` });
  }
}

await page.goto(BASE + "/recommendations", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2800);
await page.screenshot({ path: `${OUT}/recommendations.png` });
await page.screenshot({ path: `${OUT}/recommendations-full.jpg`, fullPage: true, type: "jpeg", quality: 80 });
await overflow(page, "recommendations");

await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/settings.png` });
await page.screenshot({ path: `${OUT}/settings-full.jpg`, fullPage: true, type: "jpeg", quality: 80 });

await page.goto(BASE + "/events/new", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/wizard.png` });
await overflow(page, "wizard");

// Basic form-label check on the wizard.
const labelReport = await page.evaluate(() => {
  const unlabeled = [...document.querySelectorAll("input,select,textarea")].filter((element) => {
    if (element.type === "hidden" || element.type === "radio") return false;
    const id = element.getAttribute("id");
    return !id || !document.querySelector(`label[for="${id}"]`);
  }).length;
  return { unlabeled, h1: document.querySelectorAll("h1").length };
});

await browser.close();
fs.writeFileSync("/tmp/pw/report.json", JSON.stringify({ errors, labelReport }, null, 2));
console.log(JSON.stringify({ errors, labelReport }, null, 2));
