import { chromium } from 'playwright';

async function verifyPwa() {
  console.log('=== Starting PWA & Asset Verification ===');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  // 1. Check /manifest.webmanifest
  console.log('1. Checking http://localhost:3000/manifest.webmanifest...');
  const manifestRes = await page.goto('http://localhost:3000/manifest.webmanifest');
  if (manifestRes.status() !== 200) {
    throw new Error(`Manifest returned HTTP ${manifestRes.status()}`);
  }

  const manifestJson = JSON.parse(await manifestRes.text());
  console.log('  ✓ Manifest JSON parsed successfully:');
  console.log(`    - name: "${manifestJson.name}"`);
  console.log(`    - short_name: "${manifestJson.short_name}"`);
  console.log(`    - start_url: "${manifestJson.start_url}"`);
  console.log(`    - display: "${manifestJson.display}"`);
  console.log(`    - background_color: "${manifestJson.background_color}"`);
  console.log(`    - theme_color: "${manifestJson.theme_color}"`);
  console.log(`    - icons: ${manifestJson.icons?.length} icon(s) defined`);

  if (manifestJson.name !== 'SecDigest: CyberSec & AI Daily Brief') {
    throw new Error(`Expected name 'SecDigest: CyberSec & AI Daily Brief', got '${manifestJson.name}'`);
  }
  if (manifestJson.short_name !== 'SecDigest') {
    throw new Error(`Expected short_name 'SecDigest', got '${manifestJson.short_name}'`);
  }
  if (manifestJson.display !== 'standalone') {
    throw new Error(`Expected display 'standalone', got '${manifestJson.display}'`);
  }

  // 2. Check icon URLs from manifest
  for (const icon of manifestJson.icons || []) {
    const iconUrl = `http://localhost:3000${icon.src}`;
    console.log(`2. Verifying icon: ${iconUrl}...`);
    const iconRes = await page.goto(iconUrl);
    if (iconRes.status() !== 200) {
      throw new Error(`Icon ${icon.src} returned HTTP ${iconRes.status()}`);
    }
    const contentType = iconRes.headers()['content-type'] || '';
    if (!contentType.includes('image/png')) {
      throw new Error(`Icon ${icon.src} content-type is '${contentType}', expected image/png`);
    }
    console.log(`  ✓ ${icon.src} loaded successfully (${icon.sizes}, ${contentType}).`);
  }

  // 3. Navigate to root and verify PWA head tags
  console.log('3. Checking PWA meta tags in root page head...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // In Next.js App Router streaming, metadata is inserted reactively
  const manifestLocator = page.locator('link[rel="manifest"]');
  await manifestLocator.waitFor({ state: 'attached', timeout: 5000 });
  const manifestHref = await manifestLocator.getAttribute('href');
  console.log(`  ✓ Manifest Link tag present: href="${manifestHref}"`);

  const themeColorMeta = page.locator('meta[name="theme-color"]').first();
  await themeColorMeta.waitFor({ state: 'attached', timeout: 5000 });
  const themeColor = await themeColorMeta.getAttribute('content');
  console.log(`  ✓ Theme Color meta: "${themeColor}"`);
  if (themeColor !== '#09090b') {
    throw new Error(`Expected theme-color '#09090b', got '${themeColor}'`);
  }

  const appleTitleMeta = page.locator('meta[name="apple-mobile-web-app-title"]').first();
  await appleTitleMeta.waitFor({ state: 'attached', timeout: 5000 });
  const appleTitle = await appleTitleMeta.getAttribute('content');
  console.log(`  ✓ apple-mobile-web-app-title: "${appleTitle}"`);

  await browser.close();
  console.log('=== All PWA & Asset Verification Checks PASSED! ===');
}

verifyPwa().catch((err) => {
  console.error('PWA Verification FAILED:', err);
  process.exit(1);
});
