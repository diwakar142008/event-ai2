import { randomBytes } from "node:crypto";

import { chromium } from "playwright";

const baseUrl = new URL(process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3001");
if (
  baseUrl.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname) ||
  baseUrl.port !== "3001"
) {
  throw new Error("For safety, event CRUD tests only run against a local isolated app on port 3001.");
}

const unique = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const eventName = `CRUD regression ${unique}`;
const errors = [];
let eventId;
const browser = await chromium.launch({
  headless: process.env.DEMO_HEADLESS !== "0",
  ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
  args: ["--disable-dev-shm-usage", "--no-sandbox"],
});
const context = await browser.newContext();
const page = await context.newPage();

page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.url().includes("/api/backend/") && response.status() >= 500) {
    errors.push(`Application request failed (${response.status()}): ${new URL(response.url()).pathname}`);
  }
});

async function deleteCreatedEvent() {
  if (!eventId || page.isClosed()) return;
  await page.evaluate(async (id) => {
    const csrf = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("eventora_csrf="))
      ?.slice("eventora_csrf=".length);
    if (!csrf) throw new Error("The synthetic account has no CSRF cookie for event cleanup.");
    const response = await fetch(`/api/backend/events/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": decodeURIComponent(csrf) },
    });
    if (response.status !== 204 && response.status !== 404) {
      throw new Error(`Synthetic event cleanup failed with status ${response.status}.`);
    }
  }, eventId);
}

try {
  await page.goto(new URL("/sign-up", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Your name").fill("Eventora CRUD Test");
  const password = `CRUD-Test-${randomBytes(16).toString("hex")}9`;
  await page.getByLabel("Email address").fill(`eventora-crud-${unique}@example.com`);
  await page.getByLabel("Create a password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create your free workspace" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });

  await page.getByRole("region", { name: "Quick action" }).getByRole("link", { name: "New event" }).click();
  await page.getByRole("heading", { name: "What are we planning?" }).waitFor();
  await page.getByRole("button", { name: /Continue/ }).click();
  const eventNameInput = page.getByLabel("Event name");
  const eventNameDescriptionId = await eventNameInput.getAttribute("aria-describedby");
  if (
    (await eventNameInput.getAttribute("aria-invalid")) !== "true" ||
    !eventNameDescriptionId ||
    !(await page.locator(`#${eventNameDescriptionId}`).isVisible())
  ) {
    throw new Error("Event form validation is not associated accessibly with the invalid field.");
  }
  await page.getByLabel("Event name").fill(eventName);
  await page.getByLabel("City / location").fill("Portland, Oregon");
  await page.getByLabel("Expected guests").fill("80");
  await page.getByLabel("Total budget (USD)").fill("12000");
  await page.getByLabel("Duration (hours)").fill("5");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("heading", { name: "Set the direction." }).waitFor();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("heading", { name: "Review the brief." }).waitFor();
  await page.getByRole("button", { name: "Create event & workspace" }).click();
  await page.waitForURL(/\/events\/[^/?]+(?:\?.*)?$/, { timeout: 30_000 });
  eventId = new URL(page.url()).pathname.split("/").at(-1);
  await page.getByRole("heading", { name: eventName }).waitFor();

  await page.getByRole("button", { name: "Edit brief" }).click();
  await page.getByRole("dialog", { name: "The brief" }).waitFor();
  const notesField = page.getByLabel("Notes");
  const notesDescriptionId = await notesField.getAttribute("aria-describedby");
  if (!notesDescriptionId || !(await page.locator(`#${notesDescriptionId}`).isVisible())) {
    throw new Error("The notes field hint is not programmatically associated with its textarea.");
  }
  const editedName = `${eventName} edited`;
  await page.getByLabel("Event name").fill(editedName);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("heading", { name: editedName }).waitFor();
  await page.getByRole("status").getByText("Brief updated. Estimate and risk refreshed.").waitFor();

  await page.getByRole("navigation", { name: "Event sections" }).getByRole("button", { name: "Assistant" }).click();
  const conversation = page.getByRole("log", { name: "Assistant conversation" });
  await conversation.waitFor();
  if ((await conversation.getAttribute("aria-live")) !== "polite") {
    throw new Error("Assistant replies are missing a polite live announcement.");
  }

  await deleteCreatedEvent();
  const deletedStatus = await page.evaluate(async (id) => {
    const response = await fetch(`/api/backend/events/${encodeURIComponent(id)}`);
    return response.status;
  }, eventId);
  if (deletedStatus !== 404) throw new Error("The deleted synthetic event is still available.");
  eventId = undefined;
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Event CRUD browser regression passed: create, edit, and delete.");
} finally {
  if (eventId) await deleteCreatedEvent();
  await context.close();
  await browser.close();
}
