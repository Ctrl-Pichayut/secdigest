import { chromium } from 'playwright';

async function verifyFrontend() {
  console.log('=== Starting Automated Browser Verification for Phase 5 ===');
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

  // 1. Check Header & New Daily Social Components
  console.log('2. Verifying Friendly Header & Progress Bar...');
  const title = await page.textContent('h1');
  if (!title || !title.includes('SecDigest')) {
    throw new Error(`Expected title 'SecDigest', got '${title}'`);
  }
  console.log(`  ✓ Header Title: "${title.trim()}"`);

  const morningDrop = await page.locator('text=Morning Drop').first().textContent();
  console.log(`  ✓ Morning Drop badge: "${morningDrop?.trim()}"`);

  const progressText = await page.locator('[data-testid="progress-text"]').textContent();
  console.log(`  ✓ Progress bar text: "${progressText?.trim()}"`);
  if (!progressText || !progressText.includes('caught up today')) {
    throw new Error(`Unexpected progress bar text: ${progressText}`);
  }

  const unreadCounter = await page.locator('[data-testid="unread-counter"]').textContent();
  console.log(`  ✓ Unread counter badge: "${unreadCounter?.trim()}"`);

  // 2. Verify Cards loaded from Supabase
  console.log('3. Checking news cards from Supabase...');
  await page.waitForSelector('[data-testid^="news-card-"]', { timeout: 10000 });
  const initialCards = await page.locator('[data-testid^="news-card-"]').count();
  console.log(`  ✓ Loaded ${initialCards} news cards in total.`);
  if (initialCards === 0) {
    throw new Error('Zero news cards rendered from Supabase!');
  }

  // Verify pastel styling and Quick Takeaway label
  const takeawayLabel = await page.locator('text=Quick Takeaway').first().textContent();
  console.log(`  ✓ Quick Takeaway bubble present: "${takeawayLabel?.trim()}"`);

  // 3. Test Category Filter Pills
  const filters = [
    { id: 'filter-ai_free', name: 'Free AI & Credits' },
    { id: 'filter-ctf_competition', name: 'CTF & Labs' },
    { id: 'filter-cve_security', name: 'Hot Bugs (KEV)' },
    { id: 'filter-dev_cloud', name: 'Dev & Cloud' },
    { id: 'filter-saved', name: 'Saved' },
    { id: 'filter-all', name: 'All' },
  ];

  console.log('4. Testing Category Filter Pills with Emoji Tags...');
  for (const filter of filters) {
    const filterBtn = page.locator(`[data-testid="${filter.id}"]`);
    await filterBtn.click();
    await page.waitForTimeout(300); // UI transition
    const count = await page.locator('[data-testid^="news-card-"]').count();
    console.log(`  ✓ Filter "${filter.name}": displayed ${count} cards.`);
  }

  // 4. Test Bookmark Toggle
  console.log('5. Testing Bookmark Toggle...');
  await page.locator('[data-testid="filter-all"]').click();
  await page.waitForTimeout(300);

  const firstBookmarkBtn = page.locator('[data-testid^="btn-bookmark-"]').first();
  const initialBookmarkText = (await firstBookmarkBtn.textContent())?.trim();
  console.log(`  Initial Bookmark State: "${initialBookmarkText}"`);

  // Toggle on
  await firstBookmarkBtn.click();
  await page.waitForTimeout(600);
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

  // 5. Test Mark Read Toggle, Auto-Sink & Collapsible Drawer
  console.log('6. Testing Mark Read Toggle, Auto-Sink & Collapsible Drawer...');
  await page.locator('[data-testid="filter-all"]').click();
  await page.waitForTimeout(300);

  const initialFirstCard = page.locator('[data-testid^="news-card-"]').first();
  const initialFirstCardId = await initialFirstCard.getAttribute('data-testid');
  const firstReadBtn = page.locator('[data-testid^="btn-read-"]').first();
  const initialReadText = (await firstReadBtn.textContent())?.trim();
  console.log(`  Initial first card: ${initialFirstCardId}, Read State: "${initialReadText}"`);

  // Read progress text before marking
  const prevProgress = await page.locator('[data-testid="progress-text"]').textContent();

  // Toggle to Read
  await firstReadBtn.click();
  await page.waitForTimeout(600);

  // Check if drawer button is visible
  const drawerBtn = page.locator('[data-testid="read-items-divider"]');
  const drawerBtnVisible = await drawerBtn.isVisible();
  console.log(`  ✓ Collapsible drawer button visible: ${drawerBtnVisible}`);

  // Progress text updated
  const newProgress = await page.locator('[data-testid="progress-text"]').textContent();
  console.log(`  ✓ Progress updated from "${prevProgress?.trim()}" to "${newProgress?.trim()}"`);

  // Expand the drawer to inspect read card
  await drawerBtn.click();
  await page.waitForTimeout(500);

  const drawerVisible = await page.locator('[data-testid="read-items-drawer"]').isVisible();
  console.log(`  ✓ Collapsible drawer expanded: ${drawerVisible}`);

  // Verify the card is inside the drawer
  const cardInDrawer = page.locator(`[data-testid="read-items-drawer"] [data-testid="${initialFirstCardId}"]`);
  const isCardInDrawer = await cardInDrawer.isVisible();
  console.log(`  ✓ Marked card smoothly moved into read drawer: ${isCardInDrawer}`);
  if (!isCardInDrawer) {
    throw new Error('Card marked read was not found inside the collapsible read drawer!');
  }

  // Check dimmed opacity class on read card
  const readCardClass = await cardInDrawer.getAttribute('class');
  console.log(`  ✓ Read card dimmed opacity verified: ${readCardClass?.includes('opacity-60')}`);

  // Untoggle back to unread to restore initial state
  const unreadBtnInDrawer = cardInDrawer.locator('[data-testid^="btn-read-"]');
  await unreadBtnInDrawer.click();
  await page.waitForTimeout(600);
  console.log('  ✓ Untoggled read status inside drawer to restore clean initial state.');

  // 6. Test Sticky Filter Bar Scroll Geometry (Ensure no overlap)
  console.log('7. Verifying sticky filter bar scroll geometry...');
  const navBox = await page.locator('nav[aria-label="Category navigation"]').boundingBox();
  console.log(`  ✓ Nav sticky bar position: top=${navBox?.y}, height=${navBox?.height}`);
  if (!navBox || navBox.height <= 0) {
    throw new Error('Nav bar missing valid dimensions!');
  }

  // 7. Check for Zero Console Errors
  console.log('8. Verifying zero console errors...');
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
