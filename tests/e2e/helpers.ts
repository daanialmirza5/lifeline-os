import { Page } from "@playwright/test";

export const DEMO_USERS = {
  clinician: { email: "clinician@lifeline.demo", password: "LifelineDemo!Clinician1" },
  coordinator: { email: "coordinator@lifeline.demo", password: "LifelineDemo!Coordinator1" },
  admin: { email: "admin@lifeline.demo", password: "LifelineDemo!Admin1" },
} as const;

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await Promise.all([page.waitForURL("**/"), page.click('button[type="submit"]')]);
}
