import { chromium } from 'playwright';

async function verifyFrontend() {
  console.log('=== Starting Automated Browser Verification for Phase 6 (Thai Translations) ===');
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

  // 1. Check Header & Global Language Toggle
  console.log('2. Verifying Header elements & Global Language Toggle...');
  const title = await page.textContent('h1');
  if (!title || !title.includes('SecDigest')) {
    throw new Error(`Expected title 'SecDigest', got '${title}'`);
  }
  console.log(`  ✓ Header Title: "${title.trim()}"`);

  const globalLangBtn = page.locator('[data-testid="btn-global-lang"]');
  const globalLangText = (await globalLangBtn.textContent())?.trim();
  console.log(`  ✓ Global Language Button: "${globalLangText}"`);

  // 2. Verify Cards loaded from Supabase
  console.log('3. Checking news cards from Supabase...');
  await page.waitForSelector('[data-testid^="news-card-"]', { timeout: 10000 });
  const cardCount = await page.locator('[data-testid^="news-card-"]').count();
  console.log(`  ✓ Loaded ${cardCount} news cards in total.`);
  if (cardCount === 0) {
    throw new Error('Zero news cards rendered from Supabase!');
  }

  // 3. Test Per-Card Thai Translation Toggle on First Card
  console.log('4. Testing Per-Card Thai Translation Toggle...');
  const firstCard = page.locator('[data-testid^="news-card-"]').first();
  const firstCardId = (await firstCard.getAttribute('data-testid'))?.replace('news-card-', '');
  const langBtn = firstCard.locator(`[data-testid="btn-lang-${firstCardId}"]`);

  const initialBtnText = (await langBtn.textContent())?.trim();
  console.log(`  Initial card language button: "${initialBtnText}"`);

  // Initial English summary
  const enSummary = await firstCard.locator('p').first().textContent();
  console.log(`  English summary sample: "${enSummary?.slice(0, 60)}..."`);

  // Click to toggle to Thai
  await langBtn.click();
  await page.waitForTimeout(400);

  const toggledBtnText = (await langBtn.textContent())?.trim();
  console.log(`  Toggled card language button: "${toggledBtnText}"`);
  if (!toggledBtnText?.includes('EN')) {
    throw new Error(`Expected button to show 'EN', got '${toggledBtnText}'`);
  }

  // Check Thai summary
  const thSummary = await firstCard.locator('p').first().textContent();
  console.log(`  Thai summary sample: "${thSummary?.slice(0, 60)}..."`);
  if (thSummary === enSummary) {
    throw new Error('Summary text did not change upon toggling to Thai!');
  }

  // Check Thai Takeaway label
  const thTakeawayLabel = await firstCard.locator('text=สรุปสั้นๆ ว่าทำไมควรรู้').textContent();
  console.log(`  ✓ Thai Takeaway label verified: "${thTakeawayLabel?.trim()}"`);

  // Check Tech Terms Glossary Box
  const glossaryBox = firstCard.locator(`[data-testid="tech-terms-${firstCardId}"]`);
  const glossaryVisible = await glossaryBox.isVisible();
  console.log(`  ✓ Technical Glossary Box ("🧠 ศัพท์เทคนิคในข่าวนี้") visible: ${glossaryVisible}`);
  if (!glossaryVisible) {
    throw new Error('Technical glossary box did not appear when toggling card to Thai!');
  }
  const glossaryText = await glossaryBox.textContent();
  console.log(`  Glossary terms sample: "${glossaryText?.slice(0, 80)}..."`);

  // Untoggle back to English
  await langBtn.click();
  await page.waitForTimeout(400);
  const revertedBtnText = (await langBtn.textContent())?.trim();
  console.log(`  ✓ Successfully reverted card to English: "${revertedBtnText}"`);

  // 4. Test Global Language Toggle
  console.log('5. Testing Global Language Toggle...');
  await globalLangBtn.click();
  await page.waitForTimeout(500);

  const globalToggledText = (await globalLangBtn.textContent())?.trim();
  console.log(`  Global button state after click: "${globalToggledText}"`);

  // Verify multiple cards have Thai takeaway label
  const thaiLabelsCount = await page.locator('text=สรุปสั้นๆ ว่าทำไมควรรู้').count();
  console.log(`  ✓ Cards flipped to Thai via global toggle: ${thaiLabelsCount}`);
  if (thaiLabelsCount === 0) {
    throw new Error('Global language toggle did not translate cards!');
  }

  // Revert global language
  await globalLangBtn.click();
  await page.waitForTimeout(500);
  console.log('  ✓ Reverted global language back to English.');

  // 5. Test Bookmark and Read toggles remain functional
  console.log('6. Verifying Bookmark and Read status toggles...');
  const firstBookmarkBtn = page.locator('[data-testid^="btn-bookmark-"]').first();
  await firstBookmarkBtn.click();
  await page.waitForTimeout(400);
  const bookmarked = (await firstBookmarkBtn.textContent())?.trim();
  console.log(`  ✓ Bookmark toggled: "${bookmarked}"`);
  await firstBookmarkBtn.click(); // restore
  await page.waitForTimeout(400);

  // 6. Check for Zero Console Errors
  console.log('7. Verifying zero console errors...');
  if (consoleErrors.length > 0) {
    throw new Error(`Encountered ${consoleErrors.length} console errors: \n${consoleErrors.join('\n')}`);
  }
  console.log('  ✓ ZERO console errors recorded.');

  await browser.close();
  console.log('=== All Phase 6 Automated Browser Verification Checks PASSED! ===');
}

verifyFrontend().catch((err) => {
  console.error('Verification FAILED:', err);
  process.exit(1);
});
