/**
 * Visual smoke for relationship-centered Tree mode.
 * Run: npx playwright test tests/focused-tree-visual.spec.ts --browser=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const OUT = path.join("tests", "screenshots");

async function prepare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("family-tree-center-hint-dismissed", "1");
  });
  await page.goto("http://localhost:3000/");
  await page.getByText("Наша семья").waitFor({ timeout: 20000 });
}

async function openModeDesktop(page: Page, label: string): Promise<void> {
  const btn = page.getByRole("button", { name: label, exact: true }).first();
  await expect(btn).toBeVisible({ timeout: 10000 });
  await btn.click({ force: true });
  await page.waitForTimeout(450);
}

async function openModeMobile(page: Page, mobileLabel: string): Promise<void> {
  const menu = page.getByTitle("Режим просмотра");
  // Fallback: the compact mode trigger shows the current mobile label.
  const trigger = (await menu.count()) > 0
    ? menu
    : page.locator(".tree-toolbar button[aria-haspopup='listbox']").first();
  await expect(trigger).toBeVisible({ timeout: 10000 });
  await trigger.click();
  await page.waitForTimeout(200);
  const option = page
    .locator("[role='listbox'] button[role='option']")
    .filter({ hasText: mobileLabel })
    .first();
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
  await page.waitForTimeout(450);
}

test.describe("focused tree visual", () => {
  test("desktop tree modes render", async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);

    await openModeDesktop(page, "Ближайшие");
    await page.screenshot({
      path: path.join(OUT, "tree-nearby-desktop.png"),
      fullPage: false,
    });

    await openModeDesktop(page, "3 поколения");
    await page.screenshot({
      path: path.join(OUT, "tree-generations-desktop.png"),
      fullPage: false,
    });

    await openModeDesktop(page, "Вся ветка");
    await page.screenshot({
      path: path.join(OUT, "tree-branch-desktop.png"),
      fullPage: false,
    });

    await openModeDesktop(page, "Вся семья");
    await page.screenshot({
      path: path.join(OUT, "tree-all-desktop.png"),
      fullPage: false,
    });

    await page.getByRole("button", { name: "Схема", exact: true }).click();
    await page.waitForTimeout(400);
    await openModeDesktop(page, "Ближайшие");
    await page.screenshot({
      path: path.join(OUT, "scheme-nearby-desktop.png"),
      fullPage: false,
    });

    await page.getByRole("button", { name: "Дерево", exact: true }).click();
    await page.waitForTimeout(400);

    const firstPerson = page.locator(".react-flow__node-person").first();
    await expect(firstPerson).toBeVisible({ timeout: 10000 });
    await firstPerson.click();
    await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();
    await expect(page.getByText("Связь с центром дерева")).toBeVisible();
    const makeCenter = page.getByRole("button", { name: /Сделать центром/i });
    if (await makeCenter.isVisible().catch(() => false)) {
      await makeCenter.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({
      path: path.join(OUT, "tree-after-make-center-desktop.png"),
      fullPage: false,
    });
  });

  test("mobile 390px tree modes", async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);

    await openModeMobile(page, "Близкие");
    await page.screenshot({
      path: path.join(OUT, "tree-nearby-mobile-390.png"),
      fullPage: false,
    });

    await openModeMobile(page, "3 пок.");
    await page.screenshot({
      path: path.join(OUT, "tree-generations-mobile-390.png"),
      fullPage: false,
    });
  });

  test("click opens profile; make center changes focus", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page);
    await openModeDesktop(page, "3 поколения");

    const nodes = page.locator(".react-flow__node-person");
    const count = await nodes.count();
    test.skip(count < 2, "need at least two visible people");

    // Prefer a non-center card so «Сделать центром» is available.
    let targetIndex = 0;
    for (let i = 0; i < count; i += 1) {
      const text = await nodes.nth(i).innerText();
      if (!/центр/i.test(text)) {
        targetIndex = i;
        break;
      }
    }

    await nodes.nth(targetIndex).click();
    await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();
    await expect(page.getByText("Связь с центром дерева")).toBeVisible();
    const makeCenter = page.getByRole("button", { name: /Сделать центром/i });
    await expect(makeCenter).toBeVisible({ timeout: 5000 });
    await makeCenter.click();
    await page.waitForTimeout(900);

    await nodes.first().click();
    await expect(page.getByText("Связь с центром дерева")).toBeVisible();
  });
});
