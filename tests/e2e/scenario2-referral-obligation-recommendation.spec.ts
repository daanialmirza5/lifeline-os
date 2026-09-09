import { test, expect } from "@playwright/test";
import { login, DEMO_USERS } from "./helpers";

// Spec Scenario 2: Create referral -> obligation generated -> recommendation generated.
//
// Note on timing: the continuity risk engine only flags a referral as
// "unscheduled" once it has been pending past a threshold (see
// UNSCHEDULED_REFERRAL_THRESHOLD_DAYS in src/lib/services/risk.ts) — a
// referral created seconds ago correctly does NOT yet warrant a
// recommendation. So this test verifies the immediate part (referral ->
// obligation) against a freshly created referral, and the
// recommendation-generation part against the seeded Aarav Sharma patient,
// whose referral was seeded as already overdue.
test("creating a referral generates an obligation; recomputing risk on an overdue referral generates a recommendation", async ({
  page,
}) => {
  await login(page, DEMO_USERS.clinician);

  // Part A: referral -> obligation (immediate)
  await page.goto("/patients");
  await page.locator("table tbody tr td a", { hasText: "Maria Santos" }).click();
  await page.getByLabel("Specialty").fill("Dermatology");
  await page.getByRole("button", { name: "Create Referral" }).click();
  await page.waitForURL(/\/patients\/[^/]+$/);

  await page.getByRole("link", { name: "Obligations" }).click();
  await expect(page.getByText(/Specialist appointment must be scheduled/)).toBeVisible();

  // Part B: recompute risk on an already-overdue referral -> recommendation generated
  await page.goto("/patients");
  await page.locator("table tbody tr td a", { hasText: "Aarav Sharma" }).click();
  await page.getByRole("link", { name: "Risk" }).click();
  await page.getByRole("button", { name: /Recompute risk/ }).click();
  await page.waitForTimeout(1500);

  await page.goto("/approvals");
  await expect(page.getByText("Aarav Sharma").first()).toBeVisible();
});
