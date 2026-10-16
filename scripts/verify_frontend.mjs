import { chromium } from 'playwright';

async function verifyFrontend() {
  console.log('=== Starting Automated Browser Verification for Phase 7 (Eye-Comfort & Independent TH Toggle) ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // Mobile iPhone standard
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error(`[Browser Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
    console.error(`[Browser Page Error] ${err.message}`);
  });

  console.log('1. Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // 1. Verify Header & Time-Aware Greeting Badge
  console.log('2. Verifying Header elements & Time-Aware Greeting Badge...');
  const title = await page.textContent('h1');
  if (!title || !title.includes('SecDigest')) {
    throw new Error(`Expected title 'SecDigest', got '${title}'`);
  }
  console.log(`  ✓ Header Title: "${title.trim()}"`);

  const greetingBadge = await page.locator('[data-testid="time-greeting-badge"]').textContent();
  console.log(`  ✓ Time-Aware Greeting Badge: "${greetingBadge?.trim()}"`);
  if (!greetingBadge || (!greetingBadge.includes('DROP') && !greetingBadge.includes('MORNING') && !greetingBadge.includes('AFTERNOON') && !greetingBadge.includes('EVENING'))) {
    throw new Error(`Unexpected greeting badge text: ${greetingBadge}`);
  }

  // Confirm Global "TH All" button was deleted
  const globalLangCount = await page.locator('[data-testid="btn-global-lang"]').count();
  console.log(`  ✓ Global "TH All" button count: ${globalLangCount} (Expected 0)`);
  if (globalLangCount > 0) {
    throw new Error('Global "TH All" button still exists in DOM! Must be removed.');
  }

  // 2. Verify Zero Pure White (#FFFFFF) surfaces in Paper Mode
  console.log('3. Verifying Zero Pure White (#FFFFFF) surfaces in Cozy Paper Mode...');
  await page.waitForSelector('[data-testid^="news-card-"]', { timeout: 10000 });
  const cardElements = page.locator('[data-testid^="news-card-"]');
  const cardCount = await cardElements.count();
  console.log(`  ✓ Loaded ${cardCount} news cards.`);

  const pureWhiteCount = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    let whiteMatches = 0;
    for (const el of all) {
      const bg = window.getComputedStyle(el).backgroundColor;
      // rgb(255, 255, 255) is pure white #FFFFFF
      if (bg === 'rgb(255, 255, 255)') {
        whiteMatches++;
      }
    }
    return whiteMatches;
  });
  console.log(`  ✓ Pure white (#FFFFFF) elements found: ${pureWhiteCount} (Expected 0)`);
  if (pureWhiteCount > 0) {
    throw new Error(`Found ${pureWhiteCount} pure white (#FFFFFF) elements on page! Cozy Paper must ban pure white.`);
  }

  // 3. Test Theme Switching ("☕ Paper" -> "🌆 Dusk" -> "☕ Paper")
  console.log('4. Testing Eye-Comfort Theme Switcher...');
  const themeBtn = page.locator('[data-testid="btn-theme-toggle"]');
  const initialThemeText = (await themeBtn.textContent())?.trim();
  console.log(`  Initial theme button: "${initialThemeText}"`);

  // Switch to Dusk
  await themeBtn.click();
  await page.waitForTimeout(400);

  const duskThemeText = (await themeBtn.textContent())?.trim();
  console.log(`  Toggled theme button: "${duskThemeText}"`);
  if (!duskThemeText?.includes('Dusk')) {
    throw new Error(`Expected Dusk mode, got '${duskThemeText}'`);
  }

  // Verify localStorage persistence
  const savedTheme = await page.evaluate(() => localStorage.getItem('secdigest_theme'));
  console.log(`  ✓ localStorage persisted theme: "${savedTheme}"`);
  if (savedTheme !== 'dusk') {
    throw new Error(`Expected 'dusk' in localStorage, got '${savedTheme}'`);
  }

  // Switch back to Paper mode
  await themeBtn.click();
  await page.waitForTimeout(400);
  const revertedThemeText = (await themeBtn.textContent())?.trim();
  console.log(`  ✓ Reverted theme button: "${revertedThemeText}"`);

  // 4. Test Independent Per-Card Thai Translation Toggle
  console.log('5. Testing Independent Per-Card Thai Translation Toggle...');
  const firstCard = page.locator('[data-testid^="news-card-"]').nth(0);
  const secondCard = page.locator('[data-testid^="news-card-"]').nth(1);

  const firstCardId = (await firstCard.getAttribute('data-testid'))?.replace('news-card-', '');
  const secondCardId = (await secondCard.getAttribute('data-testid'))?.replace('news-card-', '');

  const langBtn1 = firstCard.locator(`[data-testid="btn-lang-${firstCardId}"]`);
  const langBtn2 = secondCard.locator(`[data-testid="btn-lang-${secondCardId}"]`);

  const enSummary1 = (await firstCard.locator('p').first().textContent())?.trim();
  const enSummary2 = (await secondCard.locator('p').first().textContent())?.trim();

  // Toggle Card 1 to Thai
  await langBtn1.click();
  await page.waitForTimeout(400);

  const thSummary1 = (await firstCard.locator('p').first().textContent())?.trim();
  const stillEnSummary2 = (await secondCard.locator('p').first().textContent())?.trim();

  console.log(`  ✓ Card 1 toggled to Thai (summary changed: ${thSummary1 !== enSummary1})`);
  console.log(`  ✓ Card 2 remained in English (summary unchanged: ${stillEnSummary2 === enSummary2})`);
  if (stillEnSummary2 !== enSummary2) {
    throw new Error('Card 2 was affected by Card 1 toggle! Per-card state is not independent.');
  }

  // Verify Card 1 Glossary Box appears
  const glossary1 = firstCard.locator(`[data-testid="tech-terms-${firstCardId}"]`);
  const glossary1Visible = await glossary1.isVisible();
  console.log(`  ✓ Card 1 Technical Glossary Box ("🧠 ศัพท์เทคนิคในข่าวนี้") visible: ${glossary1Visible}`);
  if (!glossary1Visible) {
    throw new Error('Technical glossary box did not appear when Card 1 was toggled to Thai!');
  }

  // Now toggle Card 2 to Thai as well
  await langBtn2.click();
  await page.waitForTimeout(400);
  const thSummary2 = (await secondCard.locator('p').first().textContent())?.trim();
  console.log(`  ✓ Card 2 toggled to Thai (summary changed: ${thSummary2 !== enSummary2})`);

  // Untoggle Card 1 back to English
  await langBtn1.click();
  await page.waitForTimeout(400);
  const revertedSummary1 = (await firstCard.locator('p').first().textContent())?.trim();
  const stillThSummary2 = (await secondCard.locator('p').first().textContent())?.trim();

  console.log(`  ✓ Card 1 reverted to English: ${revertedSummary1 === enSummary1}`);
  console.log(`  ✓ Card 2 REMAINS in Thai: ${stillThSummary2 === thSummary2}`);
  if (stillThSummary2 !== thSummary2) {
    throw new Error('Card 2 reverted when Card 1 was clicked! Cards must be strictly independent.');
  }

  // Untoggle Card 2 back to clean initial state
  await langBtn2.click();
  await page.waitForTimeout(400);

  // 5. Verify NO Opacity Dimming on Read Cards
  console.log('6. Verifying NO opacity dimming on read cards...');
  const firstCardReadBtn = firstCard.locator('[data-testid^="btn-read-"]');
  await firstCardReadBtn.click(); // mark read -> card moves to caught up posts
  await page.waitForTimeout(600);

  // Open the Caught Up Posts drawer
  const drawerBtn = page.locator('[data-testid="read-items-divider"]');
  await drawerBtn.click();
  await page.waitForTimeout(500);

  const readCard = page.locator(`[data-testid="read-items-drawer"] [data-testid="news-card-${firstCardId}"]`);
  const readCardClass = (await readCard.getAttribute('class')) || '';
  console.log(`  ✓ Read card class inside drawer: "${readCardClass}"`);
  if (readCardClass.includes('opacity-60')) {
    throw new Error('Read card still has opacity-60! Opacity dimming must be removed for 100% crisp readability.');
  }

  // Untoggle read status to restore clean initial state
  const unreadBtn = readCard.locator('[data-testid^="btn-read-"]');
  await unreadBtn.click();
  await page.waitForTimeout(600);
  console.log('  ✓ Untoggled read status to restore clean initial state.');

  // 6. Check for Zero Console Errors
  console.log('7. Verifying zero console errors...');
  if (consoleErrors.length > 0) {
    throw new Error(`Encountered ${consoleErrors.length} console errors: \n${consoleErrors.join('\n')}`);
  }
  console.log('  ✓ ZERO console errors recorded.');

  await browser.close();
  console.log('=== All Phase 7 Automated Browser Verification Checks PASSED! ===');
}

verifyFrontend().catch((err) => {
  console.error('Verification FAILED:', err);
  process.exit(1);
});
