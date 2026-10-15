import { chromium } from 'playwright';

async function verifyFrontend() {
  console.log('=== Starting Automated Browser Verification ===');
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

  // 1. Check Header
  console.log('2. Verifying Header elements...');
  const title = await page.textContent('h1');
  if (!title || !title.includes('SecDigest')) {
    throw new Error(`Expected title 'SecDigest', got '${title}'`);
  }
  console.log(`  ✓ Header Title: "${title.trim()}"`);

  const unreadCounter = await page.locator('[data-testid="unread-counter"]').textContent();
  console.log(`  ✓ Unread Badge: "${unreadCounter?.trim()}"`);

  // 2. Verify Cards loaded from Supabase
  console.log('3. Checking news cards from Supabase...');
  await page.waitForSelector('[data-testid^="news-card-"]', { timeout: 10000 });
  const initialCards = await page.locator('[data-testid^="news-card-"]').count();
  console.log(`  ✓ Loaded ${initialCards} news cards on "All" filter.`);
  if (initialCards === 0) {
    throw new Error('Zero news cards rendered from Supabase!');
  }

  // 3. Test Category Filters
  const filters = [
    { id: 'filter-ai_free', name: 'Free AI & Credits' },
    { id: 'filter-ctf_competition', name: 'CTF & Labs' },
    { id: 'filter-cve_security', name: 'KEV Alerts' },
    { id: 'filter-dev_cloud', name: 'Dev & Cloud' },
    { id: 'filter-saved', name: 'Saved' },
    { id: 'filter-all', name: 'All' },
  ];

  console.log('4. Testing Category Filter Pills...');
  for (const filter of filters) {
    const filterBtn = page.locator(`[data-testid="${filter.id}"]`);
    await filterBtn.click();
    await page.waitForTimeout(300); // UI transition
    const count = await page.locator('[data-testid^="news-card-"]').count();
    console.log(`  ✓ Filter "${filter.name}": displayed ${count} cards.`);
  }

  // 4. Test Bookmark Toggle
  console.log('5. Testing Bookmark Toggle...');
  // Click 'All' first
  await page.locator('[data-testid="filter-all"]').click();
  await page.waitForTimeout(300);

  const firstBookmarkBtn = page.locator('[data-testid^="btn-bookmark-"]').first();
  const initialBookmarkText = (await firstBookmarkBtn.textContent())?.trim();
  console.log(`  Initial Bookmark State: "${initialBookmarkText}"`);

  // Toggle on
  await firstBookmarkBtn.click();
  await page.waitForTimeout(600); // allow Supabase mutation
  const toggledBookmarkText = (await firstBookmarkBtn.textContent())?.trim();
  console.log(`  Toggled Bookmark State: "${toggledBookmarkText}"`);
  if (toggledBookmarkText === initialBookmarkText) {
    throw new Error('Bookmark button did not change state upon click!');
  }

  // Check Saved tab contains the item
  await page.locator('[data-testid="filter-saved"]').click();
  await page.waitForTimeout(300);
  const savedCount = await page.locator('[data-testid^="news-card-"]').count();
  console.log(`  ✓ Saved tab contains ${savedCount} card(s).`);
  if (savedCount === 0 && toggledBookmarkText === 'Saved') {
    throw new Error('Saved item does not appear in Saved tab!');
  }

  // Toggle off bookmark to restore
  if (toggledBookmarkText === 'Saved') {
    const savedCardBtn = page.locator('[data-testid^="btn-bookmark-"]').first();
    await savedCardBtn.click();
    await page.waitForTimeout(600);
    console.log('  ✓ Untoggled bookmark to restore clean state.');
  }

  // 5. Test Mark Read Toggle & Auto-Sink
  console.log('6. Testing Mark Read Toggle & Auto-Sink...');
  await page.locator('[data-testid="filter-all"]').click();
  await page.waitForTimeout(300);

  const initialFirstCard = page.locator('[data-testid^="news-card-"]').first();
  const initialFirstCardId = await initialFirstCard.getAttribute('data-testid');
  const firstReadBtn = page.locator('[data-testid^="btn-read-"]').first();
  const initialReadText = (await firstReadBtn.textContent())?.trim();
  console.log(`  Initial first card: ${initialFirstCardId}, Read State: "${initialReadText}"`);

  // Toggle to Read
  await firstReadBtn.click();
  await page.waitForTimeout(600);

  // Check if divider is visible when unread and read items coexist
  const dividerVisible = await page.locator('[data-testid="read-items-divider"]').isVisible();
  console.log(`  ✓ "Read Items" divider visible: ${dividerVisible}`);

  // Check that the card that was marked read is positioned after the divider
  const isBelowDivider = await page.evaluate((cardId) => {
    const divider = document.querySelector('[data-testid="read-items-divider"]');
    const card = document.querySelector(`[data-testid="${cardId}"]`);
    if (!divider || !card) return false;
    return Boolean(divider.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, initialFirstCardId);
  console.log(`  ✓ Card successfully sunk below "Read Items" divider: ${isBelowDivider}`);
  if (!isBelowDivider) {
    throw new Error('Card marked read was not positioned below the Read Items divider!');
  }

  const toggledCard = page.locator(`[data-testid="${initialFirstCardId}"]`);
  const toggledCardClass = await toggledCard.getAttribute('class');
  console.log(`  ✓ Card dimming verified (opacity-60): ${toggledCardClass?.includes('opacity-60')}`);

  // Toggle back to unread to restore state
  const toggledReadBtn = toggledCard.locator('[data-testid^="btn-read-"]');
  await toggledReadBtn.click();
  await page.waitForTimeout(600);
  console.log('  ✓ Untoggled read status to restore clean initial state.');

  // 6. Check for Zero Console Errors
  console.log('7. Verifying zero console errors...');
  if (consoleErrors.length > 0) {
    throw new Error(`Encountered ${consoleErrors.length} console errors: \n${consoleErrors.join('\n')}`);
  }
  console.log('  ✓ ZERO console errors recorded.');

  await browser.close();
  console.log('=== All Automated Browser Verification Checks PASSED! ===');
}

verifyFrontend().catch((err) => {
  console.error('Verification FAILED:', err);
  process.exit(1);
});
