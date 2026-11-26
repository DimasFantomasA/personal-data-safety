import { test, expect } from '@playwright/test';

test.describe('Интерфейс проверки утечек', () => {
  
  test('Успешная проверка email (отрисовка утечек)', async ({ page }) => {
    await page.route('**/api/email/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          found: true,
          breachCount: 2,
          breaches: [
            { service: 'Adobe', year: '2013', dataTypes: ['Email addresses', 'Passwords'] },
            { service: 'LinkedIn', year: '2021', dataTypes: ['Email addresses'] }
          ],
          cached: false
        }),
      });
    });

    await page.goto('/');

    await page.locator('#email-input').fill('test@example.com');

    await page.locator('#email-form button[type="submit"]').click();

    const resultBlock = page.locator('#email-result');
    await expect(resultBlock).toContainText('Обнаружено утечек: 2');
    await expect(resultBlock).toContainText('Adobe');
    await expect(resultBlock).toContainText('2013 год');
  });

  test('Валидация: ошибка при неверном email', async ({ page }) => {
    await page.goto('/');
    
    await page.locator('#email-input').fill('неверный-email');
    await page.locator('#email-form button[type="submit"]').click();

    const errorBlock = page.locator('#email-error');
    await expect(errorBlock).toBeVisible();
    await expect(errorBlock).toHaveText('Проверьте корректность email-адреса.');
  });

  test('Успешная проверка домена (сводка)', async ({ page }) => {
    await page.route('**/api/domain/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          domain: 'adobe.com',
          breachCount: 5,
          affectedAccounts: 150000,
          cached: false
        }),
      });
    });

    await page.goto('/');

    await page.locator('#domain-input').fill('adobe.com');
    
    await page.locator('#domain-form button[type="submit"]').click();

    const resultBlock = page.locator('#domain-result');
    await expect(resultBlock).toContainText('adobe.com');
    await expect(resultBlock).toContainText('150 000'); 
  });
});