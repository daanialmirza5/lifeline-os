import { test, expect } from "@playwright/test";
import { login, DEMO_USERS } from "./helpers";

// Spec Scenario 3: Offline action -> reconnect -> synchronization.
test("acknowledging a task while offline queues it, then syncs automatically on reconnect", async ({ page }) => {
  await login(page, DEMO_USERS.clinician);

  // Approve a coordination recommendation so there is an OPEN task to act on.
  await page.goto("/approvals");
  const coordLabel = page.locator("p", { hasText: "COORDINATION" }).first();
  if ((await coordLabel.count()) === 0) test.skip(true, "No coordination recommendation available to approve");
  const coordCard = coordLabel.locator('xpath=./ancestor::div[contains(@class,"rounded-lg")][1]');
  await coordCard.getByRole("button", { name: "Approve" }).click();
  await page.waitForTimeout(1000);

  await page.goto("/tasks", { waitUntil: "networkidle" });
  const ackButton = page.getByRole("button", { name: "Acknowledge" }).first();
  await expect(ackButton).toBeVisible();

  await page.context().setOffline(true);
  await expect(page.locator("header")).toContainText("Offline");
  // `force: true` bypasses Playwright's actionability/stability checks —
  // Next dev's HMR websocket disconnects when the network drops, which
  // can otherwise make the page look "unstable" to those checks even
  // though the button itself is a plain, already-rendered client element.
  await ackButton.click({ force: true });
  await expect(page.getByText("Queued locally")).toBeVisible();

  await page.context().setOffline(false);
  await page.waitForTimeout(2000);
  await page.reload();
  await expect(page.locator("header")).toContainText("Online");
  await expect(page.getByText("IN PROGRESS").first()).toBeVisible();
});
