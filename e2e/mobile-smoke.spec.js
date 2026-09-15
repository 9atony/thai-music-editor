import { expect, test } from '@playwright/test';

test('landing page fits a portrait phone and opens login', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle(/Thai Music Editor/i);
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'สร้างสรรค์ ดนตรีไทย ได้ทุกที่ ทุกอุปกรณ์',
  })).toBeVisible({ timeout: 15_000 });

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);

  await page.getByRole('button', { name: /เริ่มสร้างฟรีเลย/ }).click();
  await expect(page.getByRole('heading', { name: 'ยินดีต้อนรับกลับมา' })).toBeVisible();
  await expect(page.getByLabel('อีเมล')).toBeVisible();
  await expect(page.getByLabel('รหัสผ่าน', { exact: true })).toBeVisible();
});

test('global notice is readable and dismissible on a portrait phone', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('tme-app-notice', {
      detail: { message: 'ทดสอบข้อความแจ้งเตือน', tone: 'success', duration: 10_000 },
    }));
  });

  await expect(page.getByText('ทดสอบข้อความแจ้งเตือน')).toBeVisible();
  await page.getByRole('button', { name: 'ปิดข้อความแจ้งเตือน' }).click();
  await expect(page.getByText('ทดสอบข้อความแจ้งเตือน')).toBeHidden();
});
