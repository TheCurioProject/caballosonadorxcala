const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err.message));
  page.on('requestfailed', request => console.log('BROWSER REQUEST FAILED:', request.url(), request.failure().errorText));

  try {
    console.log('Navigating to home...');
    await page.goto('http://localhost:3000/es', { waitUntil: 'networkidle' });
    
    console.log('Clicking "Reservar"...');
    await page.click('button:has-text("Reservar")');
    await page.waitForTimeout(1000);
    
    // Step 1: Fechas
    console.log('Selecting dates...');
    // We need to click a date. The calendar has buttons for days.
    // Let's just evaluate a script to force the state if possible, or click the first available date.
    // The calendar uses DayPicker. Let's find an available day.
    const availableDays = await page.$$('.rdp-day:not(.rdp-day_disabled)');
    if (availableDays.length >= 2) {
      await availableDays[0].click();
      await page.waitForTimeout(500);
      await availableDays[1].click();
    } else {
      console.log('Not enough available days to select a range.');
    }
    await page.waitForTimeout(1000);
    
    console.log('Clicking "Siguiente" (Step 1 -> 2)...');
    await page.click('button:has-text("Siguiente")');
    await page.waitForTimeout(1000);
    
    // Step 2: Comida
    console.log('Clicking "Siguiente" (Step 2 -> 3)...');
    await page.click('button:has-text("Siguiente")');
    await page.waitForTimeout(1000);
    
    // Step 3: ATVs
    console.log('Clicking "Siguiente" (Step 3 -> 4)...');
    await page.click('button:has-text("Siguiente")');
    await page.waitForTimeout(1000);
    
    // Step 4: Tus Datos
    console.log('Filling out user data...');
    await page.fill('input#name', 'Juan Perez');
    await page.waitForTimeout(500);
    
    await page.fill('input#email', 'test@');
    await page.waitForTimeout(500);
    
    // Press Enter to test the autofill / enter key issue
    await page.press('input#email', 'Enter');
    await page.waitForTimeout(1000);
    
    console.log('Current URL after Enter:', page.url());
    
    await page.fill('input#email', 'test@gmail.com');
    await page.waitForTimeout(500);
    
    await page.fill('input#phoneCode', '52');
    await page.waitForTimeout(500);
    
    await page.fill('input#phone', '1234567890');
    await page.waitForTimeout(500);
    
    await page.press('input#phone', 'Enter');
    await page.waitForTimeout(1000);
    
    console.log('Current URL after second Enter:', page.url());
    
    console.log('Test completed successfully.');
  } catch (err) {
    console.error('TEST ERROR:', err);
  } finally {
    await browser.close();
  }
})();
