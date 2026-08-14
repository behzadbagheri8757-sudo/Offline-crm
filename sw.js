/* sw.js — App Shell only. Never touches IndexedDB or CRM business data.
   Cache version: bump CACHE_NAME on each deploy that changes static assets.
*/
'use strict';

const CACHE_NAME = 'baqeri-shell-v1';

/** Exact App Shell — every path verified against project tree before ship. */
const PRECACHE_URLS = [
  './index.html',
  './customers.html',
  './customer.html',
  './products.html',
  './inventory.html',
  './suppliers.html',
  './supplier.html',
  './invoices.html',
  './invoice.html',
  './payments.html',
  './checks.html',
  './visits.html',
  './reports.html',
  './settings.html',
  './prospects.html',
  './prospect.html',
  './evaluation.html',
  './prospect-routes.html',
  './css/app.css',
  './js/models.js',
  './js/ui.js',
  './js/db.js',
  './js/calc.js',
  './js/stock.js',
  './js/payments.js',
  './js/backup.js',
  './js/nav.js',
  './js/app.js',
  './js/prospect-scoring.js',
  './js/prospect-db.js',
  './js/prospect-core.js',
  './js/sw-register.js',
  './vendor/xlsx.full.min.js',
  './vendor/html2canvas.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './logo-export.png'
];

self.addEventListener('install', function (event) {
  // Do NOT call skipWaiting() — wait until all controlled clients close
  // so a mid-invoice update cannot force-reload the page.
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', function (event) {
  // Do NOT call clients.claim() automatically — same reason as skipWaiting.
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME && key.indexOf('baqeri-shell-') === 0) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

/**
 * Map a navigation URL to the shell HTML filename (query/hash ignored).
 * e.g. .../customer.html?id=123 → customer.html
 */
function navigationShellPath(url) {
  var path = url.pathname || '';
  if (path.charAt(path.length - 1) === '/') {
    return 'index.html';
  }
  var parts = path.split('/');
  var last = parts[parts.length - 1] || '';
  if (!last || last.indexOf('.') === -1) {
    return 'index.html';
  }
  return last;
}

function cacheMatchByFilename(cache, filename) {
  return cache.keys().then(function (keys) {
    for (var i = 0; i < keys.length; i++) {
      var keyUrl = keys[i].url;
      try {
        var u = new URL(keyUrl);
        var name = u.pathname.split('/').pop();
        if (name === filename) {
          return cache.match(keys[i]);
        }
      } catch (e) {
        /* continue */
      }
    }
    return undefined;
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // Never intercept other origins (should not exist after Phase A/B).
  if (url.origin !== self.location.origin) {
    return;
  }

  // --- Navigation: always serve HTML shell from cache (ignore ?id= / ?shopId=) ---
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        // ignoreSearch covers customer.html?id=... etc.
        return cache.match(request, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          var shell = navigationShellPath(url);
          return cacheMatchByFilename(cache, shell).then(function (byName) {
            if (byName) return byName;
            // Controlled fallback only for unknown paths — not for valid shells
            return cacheMatchByFilename(cache, 'index.html').then(function (idx) {
              if (idx) return idx;
              return new Response('آفلاین — برنامه هنوز روی این دستگاه نصب/cache نشده است.', {
                status: 503,
                statusText: 'Offline',
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
              });
            });
          });
        });
      })
    );
    return;
  }

  // --- Same-origin static assets: cache-first ---
  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(request, { ignoreSearch: true }).then(function (cached) {
        if (cached) return cached;
        return cacheMatchByFilename(cache, (url.pathname.split('/').pop() || '')).then(function (byName) {
          if (byName) return byName;
          // Online miss: network + put (daily update path). Offline miss: fail.
          return fetch(request)
            .then(function (response) {
              if (response && response.ok) {
                try {
                  cache.put(request, response.clone());
                } catch (e) {
                  /* ignore quota / opaque */
                }
              }
              return response;
            })
            .catch(function () {
              return new Response('', { status: 503, statusText: 'Offline' });
            });
        });
      });
    })
  );
});
