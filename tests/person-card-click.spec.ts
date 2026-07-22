/**
 * Manual smoke helper for person-card clicks.
 * Run with: npx playwright test tests/person-card-click.spec.ts
 */
import { expect, test } from "@playwright/test";

test("clicking a person opens PersonDetails panel", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.getByText("Наша семья").waitFor({ timeout: 15000 });

  const personCard = page.locator(".react-flow__node-person").first();
  await expect(personCard).toBeVisible({ timeout: 15000 });
  await personCard.click();

  await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible({
    timeout: 5000,
  });
  await expect(
    page.getByRole("button", { name: /Открыть полный профиль/i }),
  ).toBeVisible();
});
