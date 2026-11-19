// End-to-end smoke test for SecDigest using Playwright without touching a real database.
//
// How to run:
//   NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=example-anon-key \
//   npm run build
//   npm run start -- -p 3005
//   npm run e2e
//
// Override the target server URL if needed:
//   BASE_URL=http://localhost:3005 npm run e2e
//
// Override the Chromium executable if a local browser build differs from Playwright's default:
//   PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run e2e

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3005').replace(/\/+$/, '');
const SUPABASE_GLOB = 'https://example.supabase.co/**';
const VIEWPORT = { width: 375, height: 812 };
const OVERFLOW_VIEWPORTS = [
  { width: 360, height: 780 },
  { width: 375, height: 812 },
];
const MAX_RIGHT_OVERFLOW_PX = 0.5;

function readPythonCardCount() {
  const pythonCardsPath = path.join(REPO_ROOT, 'lib', 'practice', 'cards', 'python.json');
  const raw = fs.readFileSync(pythonCardsPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Expected non-empty array in ${pythonCardsPath}`);
  }
  return parsed.length;
}

function buildNewsFixtures(now) {
  const hoursAgo = (hours) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const hoursFromNow = (hours) => new Date(now.getTime() + hours * 3_600_000).toISOString();

  // Keep the -3h item on the current local calendar day even when run between 00:00 and 02:59.
  const startOfLocalToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const todayItemMs = Math.min(
    now.getTime(),
    Math.max(startOfLocalToday, now.getTime() - 3 * 3_600_000)
  );

  return [
    {
      id: 'news-1',
      source_id: 'openssh-advisory-2026',
      category: 'CVE_SECURITY',
      title: 'Critical OpenSSH Pre-Auth Remote Code Execution Patch Released',
      tldr: 'OpenSSH maintainers published an emergency security update addressing a signal handler race condition affecting default server builds.',
      actionable_value: 'Upgrade openssh-server packages across bastion hosts and verify sshd version 9.8p1 or newer.',
      url: 'https://www.openssh.com/security.html',
      event_start_date: null,
      is_bookmarked: false,
      is_read: false,
      is_breaking: true,
      created_at: now.toISOString(),
    },
    {
      id: 'news-2',
      source_id: 'workers-ai-free-tier',
      category: 'AI_FREE',
      title: 'Cloudflare Workers AI Expands Free Daily Inference Tier for Students',
      tldr: 'Developers on the free tier now receive higher daily neuron allocations for lightweight open-weight coding and summarization models.',
      actionable_value: 'Test batch log classification using the free Workers AI REST endpoint without adding a billing card.',
      url: 'https://developers.cloudflare.com/workers-ai/',
      event_start_date: null,
      is_bookmarked: false,
      is_read: false,
      is_breaking: false,
      created_at: new Date(todayItemMs).toISOString(),
    },
    {
      id: 'news-3',
      source_id: 'picogym-autumn-ctf',
      category: 'CTF_COMPETITION',
      title: 'PicoGym Autumn Capture The Flag Qualifier Opens Registration',
      tldr: 'A 48-hour Jeopardy-style competition featuring binary exploitation, web authentication bypasses, and cloud IAM misconfiguration labs.',
      actionable_value: 'Form a team and review x86-64 ROP chains and OAuth state validation before kickoff.',
      url: 'https://ctftime.org/event/list/upcoming',
      event_start_date: hoursFromNow(48),
      is_bookmarked: false,
      is_read: false,
      is_breaking: false,
      created_at: hoursAgo(26),
    },
    {
      id: 'news-4',
      source_id: 'wireguard-mesh-bench',
      category: 'DEV_CLOUD',
      title: 'WireGuard Kernel Mesh Routing Benchmark on Linux 6.12',
      tldr: 'Updated netfilter fast-path hooks cut container-to-container tunnel overhead by nearly twenty percent in multi-region clusters.',
      actionable_value: 'Enable GRO offloading on virtual interfaces when deploying encrypted overlay networks.',
      url: 'https://www.wireguard.com/performance/',
      event_start_date: null,
      is_bookmarked: false,
      is_read: false,
      is_breaking: false,
      created_at: hoursAgo(50),
    },
    {
      id: 'news-5',
      source_id: 'cisa-kev-firewall',
      category: 'CVE_SECURITY',
      title: 'CISA Adds Enterprise Firewall Path Traversal Flaw to KEV Catalog',
      tldr: 'Active exploitation was confirmed against internet-facing management portals running unpatched firmware branches.',
      actionable_value: 'Restrict firewall admin interfaces to private management VLANs and rotate local service credentials.',
      url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
      event_start_date: null,
      is_bookmarked: false,
      is_read: true,
      is_breaking: false,
      created_at: hoursAgo(74),
    },
    {
      id: 'news-6',
      source_id: 'k8s-gateway-api-ga',
      category: 'DEV_CLOUD',
      title: 'Kubernetes Gateway API Reaches General Availability for gRPC Routing',
      tldr: 'Standardized traffic splitting and header matching replace vendor-specific ingress annotations across managed clusters.',
      actionable_value: 'Migrate canary ingress rules to HTTPRoute and GRPCRoute manifests for cleaner RBAC boundaries.',
      url: 'https://gateway-api.sigs.k8s.io/',
      event_start_date: null,
      is_bookmarked: false,
      is_read: true,
      is_breaking: false,
      created_at: hoursAgo(98),
    },
  ];
}

function isIgnoredConsoleError(text) {
  const lower = text.toLowerCase();
  if (lower.includes('favicon')) return true;
  if (
    lower.includes('service worker') ||
    lower.includes('serviceworker') ||
    lower.includes('sw.js')
  ) {
    return true;
  }
  return false;
}

async function waitForWrite(writes, startIndex, predicate, timeoutMs, description) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = writes.slice(startIndex).find(predicate);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const recent = writes.slice(startIndex);
  throw new Error(
    `Timed out waiting for ${description}. Recorded writes: ${JSON.stringify(recent)}`
  );
}

async function swipeCard(page, locator, direction) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(50);

  const box = await locator.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) {
    throw new Error('Could not compute card bounding box for swipe gesture');
  }

  // Aim at the non-interactive upper-middle region of the card, above the bottom action bar.
  const y = Math.round(box.y + Math.min(box.height * 0.45, Math.max(24, box.height - 80)));
  const distance = box.width * 0.7;
  const startX = Math.round(
    direction === 'left' ? box.x + box.width * 0.85 : box.x + box.width * 0.15
  );
  const endX = Math.round(direction === 'left' ? startX - distance : startX + distance);
  const steps = 15;

  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y, id: 1 }],
    });

    for (let i = 1; i <= steps; i += 1) {
      const x = Math.round(startX + ((endX - startX) * i) / steps);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y, id: 1 }],
      });
      await page.waitForTimeout(16);
    }

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await cdp.detach();
  }
}

async function checkNoHorizontalOverflowAtViewport(page, pageLabel, viewport, options = {}) {
  const { checkNewsCardActionBar = false } = options;
  await page.setViewportSize(viewport);
  const report = await page.evaluate(
    async ({ maxRightOverflowPx, shouldCheckActionBar }) => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

      const viewportWidth = window.innerWidth;
      const docScrollWidth = document.documentElement.scrollWidth;
      const bodyScrollWidth = document.body ? document.body.scrollWidth : 0;
      const issues = [];

      if (docScrollWidth > viewportWidth + maxRightOverflowPx) {
        issues.push(
          `documentElement.scrollWidth (${docScrollWidth}) exceeds viewport (${viewportWidth})`
        );
      }
      if (bodyScrollWidth > viewportWidth + maxRightOverflowPx) {
        issues.push(
          `body.scrollWidth (${bodyScrollWidth}) exceeds viewport (${viewportWidth})`
        );
      }

      const skippedTags = new Set([
        'HTML',
        'HEAD',
        'SCRIPT',
        'STYLE',
        'META',
        'LINK',
        'TITLE',
        'NOSCRIPT',
      ]);

      function isClippedByAncestor(el) {
        let parent = el.parentElement;
        while (parent && parent !== document.body && parent !== document.documentElement) {
          const ox = window.getComputedStyle(parent).overflowX;
          if (ox === 'hidden' || ox === 'clip' || ox === 'auto' || ox === 'scroll') {
            return true;
          }
          parent = parent.parentElement;
        }
        return false;
      }

      for (const el of document.querySelectorAll('*')) {
        if (skippedTags.has(el.tagName)) continue;
        if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (isClippedByAncestor(el)) continue;

        if (
          rect.width > viewportWidth + maxRightOverflowPx ||
          rect.right > viewportWidth + maxRightOverflowPx ||
          rect.left < -maxRightOverflowPx
        ) {
          const tag = el.tagName.toLowerCase();
          const idPart = el.id ? `#${el.id}` : '';
          const testId = el.getAttribute('data-testid');
          const testIdPart = testId ? `[data-testid="${testId}"]` : '';
          issues.push(
            `${tag}${idPart}${testIdPart} (left=${Number(rect.left.toFixed(1))}, right=${Number(rect.right.toFixed(1))}, width=${Number(rect.width.toFixed(1))}, viewport=${viewportWidth})`
          );
          if (issues.length >= 5) break;
        }
      }

      if (shouldCheckActionBar) {
        const cards = Array.from(document.querySelectorAll('[data-testid^="news-card-"]'));
        const firstVisibleCard = cards.find((card) => {
          const style = window.getComputedStyle(card);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const rect = card.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        if (!firstVisibleCard) {
          issues.push('No visible news card found for action bar single-line check');
        } else {
          const shareButton = firstVisibleCard.querySelector('[data-testid="share-button"]');
          const actionBar = shareButton ? shareButton.parentElement : null;
          if (!actionBar) {
            issues.push('Could not find action bar via share-button parentElement');
          } else {
            const children = Array.from(actionBar.children);
            if (children.length < 4) {
              issues.push(
                `Expected at least 4 direct children in action bar, found ${children.length}`
              );
            } else {
              const barRect = actionBar.getBoundingClientRect();
              const childRects = children.map((child) => {
                const rect = child.getBoundingClientRect();
                const tag = child.tagName.toLowerCase();
                const testId = child.getAttribute('data-testid');
                return {
                  label: testId ? `${tag}[data-testid="${testId}"]` : tag,
                  top: rect.top,
                  left: rect.left,
                  right: rect.right,
                };
              });

              const minTop = Math.min(...childRects.map((c) => c.top));
              const maxTop = Math.max(...childRects.map((c) => c.top));
              if (maxTop - minTop > 2) {
                const detail = childRects
                  .map((c) => `${c.label}:top=${Number(c.top.toFixed(1))}`)
                  .join(', ');
                issues.push(
                  `Action bar wrapped across multiple lines (top spread ${Number(
                    (maxTop - minTop).toFixed(1)
                  )}px > 2px: ${detail})`
                );
              }

              const barOverflowTolerance = Math.max(maxRightOverflowPx, 1);
              const overflowingChild = childRects.find(
                (c) =>
                  c.right > barRect.right + barOverflowTolerance ||
                  c.left < barRect.left - barOverflowTolerance
              );
              if (overflowingChild) {
                issues.push(
                  `Action bar child exceeds bar bounds (${overflowingChild.label}: left=${Number(
                    overflowingChild.left.toFixed(1)
                  )}, right=${Number(overflowingChild.right.toFixed(1))}, bar=[${Number(
                    barRect.left.toFixed(1)
                  )}, ${Number(barRect.right.toFixed(1))}])`
                );
              }
            }
          }
        }
      }

      return { issues };
    },
    { maxRightOverflowPx: MAX_RIGHT_OVERFLOW_PX, shouldCheckActionBar: checkNewsCardActionBar }
  );

  if (report.issues.length > 0) {
    throw new Error(
      `${pageLabel} @ ${viewport.width}x${viewport.height}: ${report.issues.join('; ')}`
    );
  }
}

async function checkNoHorizontalOverflow(
  page,
  pageLabel,
  viewports = OVERFLOW_VIEWPORTS,
  options = {}
) {
  const originalViewport = page.viewportSize() || VIEWPORT;
  const errors = [];
  try {
    for (const viewport of viewports) {
      try {
        await checkNoHorizontalOverflowAtViewport(page, pageLabel, viewport, options);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  } finally {
    const current = page.viewportSize();
    if (
      !current ||
      current.width !== originalViewport.width ||
      current.height !== originalViewport.height
    ) {
      await page.setViewportSize(originalViewport);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' | '));
  }
}

async function main() {
  const pythonCardCount = readPythonCardCount();
  const newsFixtures = buildNewsFixtures(new Date());
  const recordedNewsGets = [];
  const recordedWrites = [];
  const consoleErrors = [];
  const pageErrors = [];

  let passed = 0;
  let failed = 0;

  async function runCheck(label, fn) {
    try {
      await fn();
      passed += 1;
      console.log(`PASS: ${label}`);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`FAIL: ${label} - ${message}`);
    }
  }

  let browser;
  try {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });
    const context = await browser.newContext({
      viewport: VIEWPORT,
      hasTouch: true,
      isMobile: true,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!isIgnoredConsoleError(text)) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err instanceof Error ? err.message : String(err));
    });

    await page.route(SUPABASE_GLOB, async (route) => {
      const req = route.request();
      const method = req.method().toUpperCase();
      const url = new URL(req.url());
      const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'access-control-allow-headers':
          req.headers()['access-control-request-headers'] ||
          'apikey, authorization, content-type, prefer, x-client-info, accept-profile, content-profile, range',
      };

      if (method === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
        return;
      }

      if (method === 'GET') {
        if (url.pathname === '/rest/v1/news_items') {
          recordedNewsGets.push({
            url: req.url(),
            search: url.search,
          });
          await route.fulfill({
            status: 200,
            headers: { ...corsHeaders, 'content-type': 'application/json' },
            body: JSON.stringify(newsFixtures),
          });
          return;
        }
        if (
          url.pathname === '/rest/v1/practice_cards' ||
          url.pathname === '/rest/v1/practice_reviews' ||
          url.pathname === '/rest/v1/practice_sessions'
        ) {
          await route.fulfill({
            status: 200,
            headers: { ...corsHeaders, 'content-type': 'application/json' },
            body: JSON.stringify([]),
          });
          return;
        }
      }

      if (method === 'PATCH' || method === 'POST' || method === 'PUT') {
        let parsedBody = null;
        const rawBody = req.postData();
        if (rawBody) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            parsedBody = rawBody;
          }
        }
        recordedWrites.push({
          method,
          url: req.url(),
          pathname: url.pathname,
          searchParams: Object.fromEntries(url.searchParams.entries()),
          body: parsedBody,
        });

        const prefer = (req.headers()['prefer'] || '').toLowerCase();
        const wantsRep = prefer.includes('return=representation');

        if (method === 'POST') {
          await route.fulfill({
            status: 201,
            headers: { ...corsHeaders, 'content-type': 'application/json' },
            body: wantsRep ? JSON.stringify(parsedBody ?? []) : '',
          });
        } else {
          await route.fulfill({
            status: wantsRep ? 200 : 204,
            headers: wantsRep
              ? { ...corsHeaders, 'content-type': 'application/json' }
              : corsHeaders,
            body: wantsRep ? JSON.stringify(parsedBody ?? []) : '',
          });
        }
        return;
      }

      await route.fulfill({
        status: 404,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Not Found', method, path: url.pathname }),
      });
    });

    let checkedFeedOverflow = false;
    let checkedPracticeOverflow = false;
    let feedOverflowError = null;
    let practiceOverflowError = null;

    await runCheck('Feed renders with zero console or page errors', async () => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.locator('[data-testid^="news-card-"]').first().waitFor({
        state: 'visible',
        timeout: 10000,
      });

      const unreadCardCount = await page.locator('[data-testid^="news-card-"]').count();
      if (unreadCardCount !== 4) {
        throw new Error(`Expected 4 visible unread cards, found ${unreadCardCount}`);
      }

      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        throw new Error(
          `Console/page errors detected: ${JSON.stringify({ consoleErrors, pageErrors })}`
        );
      }
    });

    await runCheck('Breaking item is first with BREAKING badge and Breaking/Today headers', async () => {
      const firstCard = page.locator('[data-testid^="news-card-"]').first();
      const firstTestId = await firstCard.getAttribute('data-testid');
      if (firstTestId !== 'news-card-news-1') {
        throw new Error(`Expected first card to be news-card-news-1, got ${firstTestId}`);
      }

      const breakingBadge = page.locator('[data-testid="badge-breaking-news-1"]');
      await breakingBadge.waitFor({ state: 'visible', timeout: 5000 });
      const badgeText = (await breakingBadge.textContent())?.trim() || '';
      if (!badgeText.includes('BREAKING')) {
        throw new Error(`Expected BREAKING badge text, got "${badgeText}"`);
      }

      const headerTexts = await page
        .locator('[data-testid^="unread-group-header-"]')
        .evaluateAll((els) => els.map((el) => (el.textContent || '').trim()));

      if (!headerTexts.includes('Breaking')) {
        throw new Error(`Expected "Breaking" day header, found: ${JSON.stringify(headerTexts)}`);
      }
      if (!headerTexts.includes('Today')) {
        throw new Error(`Expected "Today" day header, found: ${JSON.stringify(headerTexts)}`);
      }
    });

    await runCheck('Freshness line shows Updated and is not stale', async () => {
      const freshness = page.locator('[data-testid="feed-freshness"]');
      await freshness.waitFor({ state: 'visible', timeout: 5000 });
      const text = (await freshness.textContent())?.trim() || '';
      if (!text.startsWith('Updated')) {
        throw new Error(`Expected freshness line to start with "Updated", got "${text}"`);
      }
    });

    // Check feed horizontal layout and single-line action bar before mutating card positions.
    try {
      await checkNoHorizontalOverflow(page, 'Feed (/)', OVERFLOW_VIEWPORTS, {
        checkNewsCardActionBar: true,
      });
      checkedFeedOverflow = true;
    } catch (err) {
      checkedFeedOverflow = true;
      feedOverflowError = err instanceof Error ? err : new Error(String(err));
    }

    await runCheck('Search narrows feed to one card and clear restores all unread cards', async () => {
      await page.locator('[data-testid="btn-search-toggle"]').click();
      const input = page.locator('[data-testid="feed-search-input"]');
      await input.waitFor({ state: 'visible', timeout: 5000 });
      await input.fill('WireGuard');

      await page.waitForFunction(
        () => document.querySelectorAll('[data-testid^="news-card-"]').length === 1,
        undefined,
        { timeout: 5000 }
      );

      const matchedCard = page.locator('[data-testid="news-card-news-4"]');
      await matchedCard.waitFor({ state: 'visible', timeout: 5000 });

      await page.locator('[data-testid="btn-search-clear"]').click();

      await page.waitForFunction(
        () => document.querySelectorAll('[data-testid^="news-card-"]').length === 4,
        undefined,
        { timeout: 5000 }
      );
    });

    await runCheck('Swipe left marks card read and swipe right bookmarks another card', async () => {
      await page.waitForTimeout(300);

      const firstCard = page.locator('[data-testid^="news-card-"]').first();
      const firstTestId = await firstCard.getAttribute('data-testid');
      if (!firstTestId) {
        throw new Error('Could not find data-testid on first unread card');
      }
      const firstId = firstTestId.replace(/^news-card-/, '');

      const writesBeforeLeft = recordedWrites.length;
      await swipeCard(page, firstCard, 'left');

      await waitForWrite(
        recordedWrites,
        writesBeforeLeft,
        (w) =>
          w.method === 'PATCH' &&
          w.pathname === '/rest/v1/news_items' &&
          w.searchParams.id === `eq.${firstId}` &&
          w.body &&
          w.body.is_read === true,
        5000,
        `PATCH /rest/v1/news_items?id=eq.${firstId} with is_read=true`
      );

      await page.locator(`[data-testid="news-card-${firstId}"]`).waitFor({
        state: 'detached',
        timeout: 5000,
      });
      await page.waitForTimeout(350);

      const secondCard = page.locator('[data-testid^="news-card-"]').first();
      const secondTestId = await secondCard.getAttribute('data-testid');
      if (!secondTestId) {
        throw new Error('Could not find data-testid on second unread card');
      }
      const secondId = secondTestId.replace(/^news-card-/, '');
      if (secondId === firstId) {
        throw new Error(`Expected a different card for right swipe, still got ${secondId}`);
      }

      const writesBeforeRight = recordedWrites.length;
      await swipeCard(page, secondCard, 'right');

      await waitForWrite(
        recordedWrites,
        writesBeforeRight,
        (w) =>
          w.method === 'PATCH' &&
          w.pathname === '/rest/v1/news_items' &&
          w.searchParams.id === `eq.${secondId}` &&
          w.body &&
          w.body.is_bookmarked === true,
        5000,
        `PATCH /rest/v1/news_items?id=eq.${secondId} with is_bookmarked=true`
      );
    });

    await runCheck('Clicking Load older issues a second GET with created_at=lt.', async () => {
      if (recordedNewsGets.length < 1) {
        throw new Error('Expected at least one initial GET /rest/v1/news_items before clicking load-older');
      }

      const loadOlderBtn = page.locator('[data-testid="load-older"]');
      await loadOlderBtn.scrollIntoViewIfNeeded();
      await loadOlderBtn.waitFor({ state: 'visible', timeout: 5000 });

      const getsBefore = recordedNewsGets.length;
      await loadOlderBtn.click();

      const deadline = Date.now() + 5000;
      let matchedGet = null;
      while (Date.now() < deadline) {
        matchedGet = recordedNewsGets
          .slice(getsBefore)
          .find((entry) => entry.search.includes('created_at=lt.'));
        if (matchedGet) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (!matchedGet) {
        throw new Error(
          `Expected GET /rest/v1/news_items with created_at=lt. after clicking load-older. Recorded GETs: ${JSON.stringify(
            recordedNewsGets.slice(getsBefore)
          )}`
        );
      }

      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="load-older"]');
          return Boolean(btn) && btn.getAttribute('aria-busy') !== 'true';
        },
        undefined,
        { timeout: 5000 }
      );

      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        throw new Error(
          `Console/page errors detected after clicking load-older: ${JSON.stringify({ consoleErrors, pageErrors })}`
        );
      }
    });

    await runCheck('Practice page renders progress, Next up chip, streak panel, and starts 2-minute session', async () => {
      await page.goto(`${BASE_URL}/practice`, { waitUntil: 'networkidle', timeout: 15000 });

      const totalLabel = `0 of ${pythonCardCount} learned`;
      await page.getByText(totalLabel, { exact: true }).waitFor({
        state: 'visible',
        timeout: 10000,
      });

      await page.getByText('Next up', { exact: true }).waitFor({
        state: 'visible',
        timeout: 5000,
      });

      const streakPanel = page.locator('section[aria-label="Practice activity calendar"]');
      await streakPanel.waitFor({ state: 'visible', timeout: 5000 });
      const streakText = (await streakPanel.textContent()) || '';
      if (!/Current streak:\s*0 days/i.test(streakText) || !/Best:\s*0 days/i.test(streakText)) {
        throw new Error(`Unexpected streak panel text: "${streakText.trim()}"`);
      }

      try {
        await checkNoHorizontalOverflow(page, 'Practice (/practice)');
        checkedPracticeOverflow = true;
      } catch (err) {
        checkedPracticeOverflow = true;
        practiceOverflowError = err instanceof Error ? err : new Error(String(err));
      }

      const twoMinBtn = page.getByRole('button', { name: '2 min', exact: true });
      await twoMinBtn.click();
      const pressed = await twoMinBtn.getAttribute('aria-pressed');
      if (pressed !== 'true') {
        throw new Error(`Expected "2 min" button to have aria-pressed="true", got "${pressed}"`);
      }

      const startBtn = page.getByRole('button', { name: /^Start\b/ });
      await startBtn.waitFor({ state: 'visible', timeout: 5000 });
      if (await startBtn.isDisabled()) {
        throw new Error('Expected Start session button to be enabled');
      }
      await startBtn.click();

      const dialog = page.locator('[role="dialog"][aria-label="Practice session"]');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });

      const cardPrompt = dialog.locator('h2').first();
      await cardPrompt.waitFor({ state: 'visible', timeout: 5000 });
      const promptText = (await cardPrompt.textContent())?.trim() || '';
      if (
        !promptText ||
        promptText === 'Nothing to practice right now' ||
        promptText === 'Session done'
      ) {
        throw new Error(`Expected active practice card prompt, got "${promptText}"`);
      }

      const progressBadge = dialog.getByText(/^1\/\d+$/);
      await progressBadge.waitFor({ state: 'visible', timeout: 5000 });

      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        throw new Error(
          `Console/page errors detected on practice page: ${JSON.stringify({ consoleErrors, pageErrors })}`
        );
      }
    });

    await runCheck('No element wider than viewport (no horizontal scroll) on feed or practice at 360x780 and 375x812', async () => {
      const errors = [];
      if (!checkedFeedOverflow) {
        errors.push(new Error('Feed (/) overflow check did not run'));
      }
      if (!checkedPracticeOverflow) {
        errors.push(new Error('Practice (/practice) overflow check did not run'));
      }
      if (feedOverflowError) errors.push(feedOverflowError);
      if (practiceOverflowError) errors.push(practiceOverflowError);
      if (errors.length > 0) {
        throw new Error(errors.map((e) => e.message).join(' | '));
      }
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`FAIL: Unhandled error - ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
