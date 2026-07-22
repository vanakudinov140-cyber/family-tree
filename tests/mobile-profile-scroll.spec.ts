/**
 * Mobile profile sheet scroll.
 * Run: npx playwright test tests/mobile-profile-scroll.spec.ts --browser=chromium
 */
import { expect, test } from "@playwright/test";

test.describe("mobile profile scroll", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("sheet content scrolls to admin actions", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("family-tree-center-hint-dismissed", "1");
    });
    await page.goto("http://localhost:3000/");
    await page.getByText("Наша семья").waitFor({ timeout: 20000 });

    const person = page.locator(".react-flow__node-person").first();
    await expect(person).toBeVisible({ timeout: 15000 });
    await person.click({ force: true });

    const sheet = page.getByRole("dialog", { name: "Профиль" });
    await expect(sheet).toBeVisible({ timeout: 8000 });

    const scroll = page.locator('[data-profile-scroll="sheet"]');
    await expect(scroll).toBeVisible();

    const metrics = await scroll.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
      touchAction: getComputedStyle(el).touchAction,
    }));

    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    expect(metrics.overflowY).toMatch(/auto|scroll/);
    expect(metrics.touchAction).toMatch(/pan-y/);

    await scroll.evaluate((el) => {
      el.scrollTo({ top: el.scrollHeight });
    });

    const scrollTop = await scroll.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);

    const editButton = page.getByRole("button", { name: /Редактировать/i });
    const addButton = page.getByRole("button", {
      name: /Добавить родственника/i,
    });
    const openProfile = page.getByRole("button", {
      name: /Открыть полный профиль/i,
    });

    // Admin buttons may be hidden for guests; at least one bottom action should exist.
    const openVisible = await openProfile.isVisible().catch(() => false);
    const editVisible = await editButton.isVisible().catch(() => false);
    const addVisible = await addButton.isVisible().catch(() => false);
    expect(openVisible || editVisible || addVisible).toBeTruthy();

    if (editVisible) {
      await editButton.scrollIntoViewIfNeeded();
      await expect(editButton).toBeVisible();
      await editButton.click();
      const editDialog = page.getByRole("dialog").filter({
        hasText: /Редактировать|Сохранить|Отмена/i,
      });
      await expect(editDialog.first()).toBeVisible({ timeout: 5000 });
      await page
        .getByRole("button", { name: /Отмена|Закрыть/i })
        .first()
        .click({ force: true })
        .catch(async () => {
          await page.keyboard.press("Escape");
        });
      await expect(scroll).toBeVisible();
      await scroll.evaluate((el) => {
        el.scrollTo({ top: 0 });
        el.scrollTo({ top: el.scrollHeight });
      });
      const again = await scroll.evaluate((el) => el.scrollTop);
      expect(again).toBeGreaterThan(0);
    } else if (openVisible) {
      await openProfile.scrollIntoViewIfNeeded();
      await expect(openProfile).toBeInViewport();
    }

    await page.getByRole("button", { name: "Закрыть", exact: true }).click();
    await expect(sheet).toBeHidden({ timeout: 5000 });

    const bodyOverflow = await page.evaluate(
      () => document.body.style.overflow,
    );
    expect(bodyOverflow === "" || bodyOverflow === "visible").toBeTruthy();

    const sheetFlag = await page.evaluate(
      () => document.documentElement.dataset.mobileProfileSheet ?? "",
    );
    expect(sheetFlag).toBe("");
  });
});
