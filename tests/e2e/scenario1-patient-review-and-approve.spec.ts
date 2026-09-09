import { test, expect } from "@playwright/test";
import { login, DEMO_USERS } from "./helpers";

// Spec Scenario 1: Open patient -> inspect timeline -> inspect risk -> approve recommendation.
test("clinician opens a patient, inspects timeline and risk, and approves a recommendation", async ({ page }) => {
  await login(page, DEMO_USERS.clinician);

  await page.goto("/patients");
  await expect(page.locator("h1")).toHaveText("Patients");
  const firstPatientLink = page.locator("table tbody tr td a").first();
  const patientName = await firstPatientLink.textContent();
  await firstPatientLink.click();

  await expect(page.locator("h1")).toHaveText(patientName?.trim() ?? "");

  await page.getByRole("link", { name: "Timeline" }).click();
  await expect(page).toHaveURL(/\/timeline$/);

  await page.getByRole("link", { name: "Risk" }).click();
  await expect(page).toHaveURL(/\/risk$/);
  await expect(page.getByText(/deterministic, configurable rules engine/)).toBeVisible();

  await page.goto("/approvals");
  const approveButtons = page.getByRole("button", { name: "Approve" });
  const initialCount = await approveButtons.count();
  test.skip(initialCount === 0, "No recommendations pending approval to test with");

  await approveButtons.first().click();
  // Approving revalidates the page server-side and removes the decided
  // recommendation from the SUGGESTED-only queue — so the observable
  // effect is one fewer pending card, not an inline "Approved" message
  // (which would require the card to stay mounted after its own status
  // changed, which it doesn't).
  await expect(approveButtons).toHaveCount(initialCount - 1, { timeout: 20000 });
});
