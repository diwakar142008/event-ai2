/**
 * Mobile capture pass for Eventora AI.
 *
 * Runs separately from scripts/capture-screenshots.mjs so each browser session
 * stays short in memory-constrained environments.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUTPUT_DIR ?? path.resolve("docs/screenshots");
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;

fs.mkdirSync(OUT, { recursive: true });
const errors = [];

const executablePath = process.env.CHROME_EXECUTABLE;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ["--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox", "--disable-software-rasterizer"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.message));

async function check(label) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  if (result.scrollWidth > result.innerWidth + 1) errors.push(`[overflow:${label}] ${result.scrollWidth}`);
}

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/mobile-landing.png` });
await check("landing");

await page.goto(BASE + "/sign-in", { waitUntil: "domcontentloaded" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.getByRole("button", { name: /Enter the studio/i }).click();
await page.waitForURL("**/dashboard", { timeout: 30000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/mobile-dashboard.png` });
await check("dashboard");

await browser.close();
console.log(JSON.stringify({ errors }, null, 2));
if (errors.length) process.exitCode = 1;
