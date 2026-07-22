/**
 * Profile panel actions smoke.
 * Run: npx playwright test tests/person-profile-actions.spec.ts --browser=chromium
 */
import { expect, test } from "@playwright/test";

test.describe("person profile actions", () => {
  test("open profile modal receives selected person", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000/");
    await page.getByText("Наша семья").waitFor({ timeout: 20000 });

    const person = page.locator(".react-flow__node-person").first();
    await expect(person).toBeVisible({ timeout: 15000 });
    await person.click();

    await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible({
      timeout: 8000,
    });

    const openProfile = page.getByRole("button", {
      name: /Открыть полный профиль/i,
    });
    await expect(openProfile).toBeVisible();
    const personId = await openProfile.getAttribute("data-person-id");
    expect(personId).toBeTruthy();

    await openProfile.click();

    await expect(
      page.getByText("Отдельная страница профиля появится на следующем этапе"),
    ).toHaveCount(0);
    await expect(page.getByText(/появится на следующем этапе/i)).toHaveCount(0);

    const dialog = page.getByRole("dialog", { name: "Полный профиль" });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toHaveAttribute("data-person-id", personId!);

    await dialog.getByRole("button", { name: "Закрыть полный профиль" }).click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });

  test("mobile 390: open profile modal without toast", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.localStorage.setItem("family-tree-center-hint-dismissed", "1");
    });
    await page.goto("http://localhost:3000/");
    await page.getByText("Наша семья").waitFor({ timeout: 20000 });

    const person = page.locator(".react-flow__node-person").first();
    await expect(person).toBeVisible({ timeout: 15000 });
    await person.click({ force: true });

    const openProfile = page.getByRole("button", {
      name: /Открыть полный профиль/i,
    });
    await openProfile.scrollIntoViewIfNeeded();
    await expect(openProfile).toBeVisible({ timeout: 10000 });
    const personId = await openProfile.getAttribute("data-person-id");
    expect(personId).toBeTruthy();

    await openProfile.click();
    await expect(
      page.getByText("Отдельная страница профиля появится на следующем этапе"),
    ).toHaveCount(0);

    const dialog = page.getByRole("dialog", { name: "Полный профиль" });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toHaveAttribute("data-person-id", personId!);

    await dialog.getByRole("button", { name: "Закрыть полный профиль" }).click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });

  test("guest does not see admin write buttons", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000/");
    await page.getByText("Наша семья").waitFor({ timeout: 20000 });

    // Ensure signed out
    const login = page.getByRole("button", { name: "Войти" });
    if (!(await login.isVisible().catch(() => false))) {
      test.skip(true, "already signed in — skip guest assertion");
    }

    await page.locator(".react-flow__node-person").first().click();
    await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Добавить родственника" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Редактировать" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Удалить человека" }),
    ).toHaveCount(0);
  });
});
