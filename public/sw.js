const CACHE_NAME = 'secdigest-v2';
const NAV_TIMEOUT_MS = 4000;
const SUPABASE_TIMEOUT_MS = 5000;
const PRECACHE_URLS = ['/', '/practice'];

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) {
    return false;
  }
  const { pathname } = url;
  return (
    pathname.startsWith('/_next/static/') ||
    /^\/icon-[^/]+\.png$/.test(pathname) ||
    pathname === '/manifest.webmanifest'
  );
}

function isSupabaseRestGet(request, url) {
  return (
    request.method === 'GET' &&
    url.protocol === 'https:' &&
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.startsWith('/rest/v1/')
  );
}

// Race a navigation fetch against a short timeout without cloning the navigate Request
// with a RequestInit (which throws a TypeError in browsers).
function fetchNavigationWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timerId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Navigation network timeout'));
      }
    }, timeoutMs);

    fetch(request)
      .then((response) => {
        clearTimeout(timerId);
        if (!settled) {
          settled = true;
          resolve(response);
        } else if (response && response.status === 200) {
          // Refresh the cached page if a slow response finishes after the timeout.
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, response.clone()))
            .catch(() => {});
        }
      })
      .catch((error) => {
        clearTimeout(timerId);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
  });
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetchNavigationWithTimeout(request, NAV_TIMEOUT_MS);
    if (response && response.status === 200) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedPage = await cache.match(request);
    if (cachedPage) {
      return cachedPage;
    }
    const url = new URL(request.url);
    if (url.pathname !== '/') {
      const cachedPath = await cache.match(url.pathname);
      if (cachedPath) {
        return cachedPath;
      }
    }
    const cachedRoot = await cache.match('/');
    if (cachedRoot) {
      return cachedRoot;
    }
    throw error;
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response && response.status === 200) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstSupabase(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request);

  const updateCache = (response) => {
    if (response && response.status === 200) {
      return cache.put(request, response.clone()).catch(() => {});
    }
    return Promise.resolve();
  };

  if (!cached) {
    const response = await networkPromise;
    await updateCache(response);
    return response;
  }

  return new Promise((resolve) => {
    let settled = false;
    const timerId = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(cached);
      }
    }, SUPABASE_TIMEOUT_MS);

    networkPromise
      .then((response) => {
        clearTimeout(timerId);
        if (!settled) {
          settled = true;
          updateCache(response).then(() => resolve(response));
        } else {
          // Refresh the cache if the slow network response arrives after fallback.
          updateCache(response);
        }
      })
      .catch(() => {
        clearTimeout(timerId);
        if (!settled) {
          settled = true;
          resolve(cached);
        }
      });
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(
          PRECACHE_URLS.map(async (path) => {
            try {
              const response = await fetch(path);
              if (response && response.status === 200) {
                await cache.put(path, response);
              }
            } catch {
              // Ignore individual network failures during install.
            }
          })
        );
      } catch {
        // Ignore cache errors on install; subsequent navigations populate the cache.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept or cache non-GET requests.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  if (isSupabaseRestGet(request, url)) {
    event.respondWith(networkFirstSupabase(request));
    return;
  }

  // Pass through all other requests untouched.
});
