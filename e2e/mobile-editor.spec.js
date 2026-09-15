import { expect, test } from '@playwright/test';
import process from 'node:process';

test.skip(!process.env.FIRESTORE_EMULATOR_HOST, 'ต้องใช้ Firebase Emulator');

test('สมาชิกใหม่เปิดหน้าแก้ไขมือถือแบบสัมผัสได้', async ({ page }) => {
  const emulatorStatus = await page.request.get('http://127.0.0.1:9099/');
  expect(emulatorStatus.ok()).toBe(true);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /เริ่มสร้างฟรีเลย/ }).click();
  await page.getByRole('button', { name: 'สร้างบัญชีใหม่' }).click();

  await page.getByLabel('ชื่อผู้ใช้').fill('Mobile QA');
  await page.getByLabel('อีเมล').fill('mobile.qa.isolated@example.com');
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('MobileQa123!');
  await page.getByLabel('ยืนยันรหัสผ่าน').fill('MobileQa123!');
  await page.getByRole('button', { name: 'สมัครสมาชิก' }).click();

  const createProjectButton = page.getByRole('button', { name: /สร้างโปรเจกต์ใหม่/ });
  await expect(createProjectButton).toBeVisible({ timeout: 20_000 });
  await createProjectButton.click();

  await page.getByRole('button', { name: 'แก้ไข' }).click();
  const toolsButton = page.getByRole('button', { name: 'เครื่องมือ' });
  await expect(toolsButton).toBeVisible({ timeout: 15_000 });
  await toolsButton.click();
  await expect(page.getByLabel('เครื่องมือแก้ไขมือถือ')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'เครื่องมือแก้ไข' })).toBeVisible();
});
