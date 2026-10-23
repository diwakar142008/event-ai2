import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(
  process.env.DEMO_OUTPUT_DIR ?? path.join(scriptDir, "..", "..", "artifacts", "demo"),
);
const baseUrl = new URL(process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3001");

if (!["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname) || baseUrl.port !== "3001") {
  throw new Error("For safety, the demo only runs against a local isolated app on port 3001.");
}

await fs.mkdir(outputDir, { recursive: true });

const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const videoPath = path.join(outputDir, `eventora-demo-${stamp}.webm`);
const failures = [];
let stage = "launching browser";
const browser = await chromium.launch({
  headless: process.env.DEMO_HEADLESS === "1",
  ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
  args: ["--disable-dev-shm-usage", "--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const video = page.video();

page.on("console", (message) => {
  if (message.type() === "error") failures.push(`Console error: ${message.text()}`);
});
page.on("pageerror", (error) => failures.push(`Page error: ${error.message}`));
page.on("response", (response) => {
  if (response.status() >= 400) {
    failures.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
  }
});
page.on("dialog", (dialog) => {
  failures.push(`Unexpected browser dialog: ${dialog.type()}`);
  void dialog.dismiss();
});

async function pause(milliseconds = 1600) {
  await page.waitForTimeout(milliseconds);
}

async function visible(locator, timeout = 30_000) {
  await locator.waitFor({ state: "visible", timeout });
}

try {
  stage = "opening the homepage";
  console.log(`Demo: ${stage}`);
  await page.goto(baseUrl.href, { waitUntil: "domcontentloaded" });
  await visible(page.locator("main h1"));
  await pause(8000);

  stage = "running the homepage cost estimator";
  console.log(`Demo: ${stage}`);
  const intelligence = page.locator("#intelligence");
  await visible(intelligence);
  await intelligence.scrollIntoViewIfNeeded();
  await pause(5500);
  await page.getByRole("button", { name: "Estimate this event" }).click();
  await visible(page.getByText("Estimated total (sample-based guide)"));
  await visible(page.getByText("synthetic", { exact: false }));
  await pause(8000);

  stage = "creating a synthetic account through signup";
  console.log(`Demo: ${stage}`);
  await page.goto(new URL("/sign-up", baseUrl).href, { waitUntil: "domcontentloaded" });
  await visible(page.getByLabel("Your name"));
  const unique = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const demoPassword = `EventoraDemo-${randomBytes(12).toString("hex")}7`;
  await page.getByLabel("Your name").fill("Eventora Demo");
  await page.getByLabel("Email address").fill(`eventora-demo-${unique}@example.com`);
  await page.getByLabel("Create a password").fill(demoPassword);
  await page.getByLabel("Confirm password").fill(demoPassword);
  await page.getByRole("button", { name: "Create your free workspace" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  const quickAction = page.getByRole("region", { name: "Quick action" });
  await visible(quickAction.getByRole("link", { name: "New event" }));
  await pause(6000);

  stage = "entering the event brief";
  console.log(`Demo: ${stage}`);
  await quickAction.getByRole("link", { name: "New event" }).click();
  await visible(page.getByRole("heading", { name: "What are we planning?" }));
  await page.getByLabel("Event name").fill("Maya & Alex — Garden Celebration");
  await page.getByLabel("City / location").fill("Portland, Oregon");
  await page.getByLabel("Expected guests").fill("180");
  await page.getByLabel("Total budget (USD)").fill("45000");
  await page.getByLabel("Duration (hours)").fill("6");
  await pause(7000);

  stage = "estimating and reviewing the event";
  console.log(`Demo: ${stage}`);
  await page.getByRole("button", { name: /Continue/ }).click();
  await visible(page.getByRole("heading", { name: "Set the direction." }));
  const gardenTheme = page.locator('input[name="theme"][value="romantic_garden"]');
  if (!(await gardenTheme.isChecked())) throw new Error("The sample garden theme is not selected.");
  await pause(6000);
  await page.getByRole("button", { name: /Continue/ }).click();
  await visible(page.getByRole("heading", { name: "Review the brief." }));
  await page.getByRole("button", { name: "Estimate this event" }).click();
  await visible(page.getByText("Model estimate"));
  await pause(8000);

  stage = "creating the event and generating its plan";
  console.log(`Demo: ${stage}`);
  await page.getByRole("button", { name: "Create event & workspace" }).click();
  await page.waitForURL(/\/events\/[^/?]+(?:\?.*)?$/, { timeout: 30_000 });
  await visible(page.getByRole("heading", { name: "Maya & Alex — Garden Celebration" }));
  await pause(8000);

  const sections = page.getByRole("navigation", { name: "Event sections" });
  stage = "showing the plan and budget allocation";
  console.log(`Demo: ${stage}`);
  await sections.getByRole("button", { name: "Plan" }).click();
  await visible(page.getByRole("heading", { name: "How the budget is allocated" }));
  await visible(page.getByTitle("eventora-deterministic-v1"));
  await pause(8000);

  stage = "showing the preparation and event-day timelines";
  console.log(`Demo: ${stage}`);
  await sections.getByRole("button", { name: "Timeline" }).click();
  await visible(page.getByRole("heading", { name: "Working backwards" }));
  await visible(page.getByRole("heading", { name: "Event-day flow" }));
  await pause(8000);

  stage = "showing the generated checklist";
  console.log(`Demo: ${stage}`);
  await sections.getByRole("button", { name: "Checklist" }).click();
  await visible(page.getByRole("heading", { name: /Checklist ·/ }));
  await visible(page.locator("main li").first());
  await pause(8000);

  stage = "showing budget tracking";
  console.log(`Demo: ${stage}`);
  await sections.getByRole("button", { name: "Budget" }).click();
  await pause(7000);

  stage = "asking the event assistant";
  console.log(`Demo: ${stage}`);
  await sections.getByRole("button", { name: "Assistant" }).click();
  await visible(page.getByRole("heading", { name: "Ask the studio" }));
  const fallbackLabels = page.getByText("Deterministic fallback", { exact: true });
  const existingFallbackLabels = await fallbackLabels.count();
  await page.getByRole("textbox", { name: "Message" }).fill("Where can I save money without losing the atmosphere?");
  await page.getByRole("button", { name: "Send message" }).click();
  const responseDeadline = Date.now() + 45_000;
  while ((await fallbackLabels.count()) <= existingFallbackLabels && Date.now() < responseDeadline) {
    await page.waitForTimeout(250);
  }
  if ((await fallbackLabels.count()) <= existingFallbackLabels) {
    throw new Error("The assistant did not show its engine label after responding.");
  }
  await pause(10_000);

  stage = "returning to the homepage";
  console.log(`Demo: ${stage}`);
  await page.goto(baseUrl.href, { waitUntil: "domcontentloaded" });
  await visible(page.locator("main h1"));
  await pause(6000);
} catch (error) {
  failures.push(
    `${stage}: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
  );
} finally {
  const temporaryVideoPath = await video.path();
  if (!page.isClosed()) await page.close();
  await video.saveAs(videoPath);
  await context.close();
  await browser.close();
  if (temporaryVideoPath !== videoPath) await fs.rm(temporaryVideoPath, { force: true });
}

console.log(`Demo recording saved: ${videoPath}`);
if (failures.length) {
  console.error("Demo completed with failures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Demo completed with no browser, page, or application request errors.");
}
