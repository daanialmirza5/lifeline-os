import { test, expect } from "@playwright/test";
import { login, DEMO_USERS } from "./helpers";

// Spec Scenario 4: Conflicting update -> conflict UI -> resolution.
// Uses the seeded "Patient E" scenario (Wei Zhang): a task completed
// online by a clinician while a coordinator had a conflicting CANCELLED
// update queued offline for the same task at an older version.
test("a pre-existing sync conflict is visible and resolvable from the Tasks page", async ({ page }) => {
  await login(page, DEMO_USERS.coordinator);
  await page.goto("/tasks");

  await expect(page.getByText("Sync Conflicts Requiring Resolution")).toBeVisible();
  await expect(page.getByText(/CANCELLED/)).toBeVisible();
  await expect(page.getByText(/COMPLETED/)).toBeVisible();

  const resolveButtons = page.getByRole("button", { name: "Keep server value" });
  const initialCount = await resolveButtons.count();
  await resolveButtons.first().click();
  // Resolving revalidates the page and removes the now-resolved conflict
  // from the CONFLICT-only query, so the observable effect is the
  // conflict panel losing an entry (or disappearing entirely if it was
  // the only one) rather than an inline confirmation staying mounted.
  await expect(resolveButtons).toHaveCount(initialCount - 1, { timeout: 20000 });
});
