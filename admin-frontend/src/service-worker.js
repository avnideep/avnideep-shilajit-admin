// Avnideep Admin PWA Service Worker v6 - Pages redirect-safe
// Cache names
var CACHE = 'avnideep-admin-v6';
var STATIC_CACHE = 'avnideep-admin-static-v6';
var API_CACHE = 'avnideep-admin-api-v6';
var FONT_CACHE = 'avnideep-admin-fonts-v6';
var IMMUTABLE_CACHE = 'avnideep-admin-immutable-v6';

// Assets to pre-cache on install
var STATIC_ASSETS = [
  '/',
  '/offline',
  '/dashboard',
  '/orders',
  '/order-detail',
  '/rewards',
  '/analytics',
  '/payment-settings',
  '/seo',
  '/css/styles.css',
  '/js/api.js',
  '/js/mobile-menu.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg'
];

// Install - pre-cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then(function(cache) {
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(STATIC_CACHE).then(function(cache) {
        return cache.addAll(STATIC_ASSETS);
      })
    ]).then(function() {
      return self.skipWaiting();
    }).catch(function(err) {
      console.warn('SW pre-cache failed, will cache on demand:', err);
      return self.skipWaiting();
    })
  );
});

// Activate - clean old caches, claim clients
self.addEventListener('activate', function(event) {
  event.waitUntil(
    Promise.all([
      // Remove old cache versions
      caches.keys().then(function(keys) {
        return Promise.all(
          keys.filter(function(k) {
            return k !== CACHE && k !== STATIC_CACHE && 
                   k !== API_CACHE && k !== FONT_CACHE && k !== IMMUTABLE_CACHE;
          }).map(function(k) { 
            console.log('SW: Deleting old cache', k);
            return caches.delete(k); 
          })
        );
      }),
      // Navigation preload intentionally disabled - we always respond
      // via respondWith() with our own fetch/cache logic.
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Helper: is API request
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

// Helper: is immutable/static asset (hashed filenames)
function isImmutable(url) {
  return url.pathname.includes('/css/') ||
         url.pathname.includes('/js/') ||
         url.pathname.includes('/icons/') ||
         url.pathname.match(/\.(woff2|woff|ttf|jpg|png|svg|ico|css|js)$/);
}

// Helper: is navigation request
function isNavigation(url, request) {
  return request.mode === 'navigate';
}

// Helper: send message to all clients
function sendMessageToClients(msg) {
  return self.clients.matchAll().then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage(msg);
    });
  });
}

// Network-first strategy (for API & dynamic content)
async function networkFirst(request, cacheName, timeoutMs) {
  var url = new URL(request.url);
  var timeout = timeoutMs || 3000;
  
  try {
    var response = await Promise.race([
      fetch(request),
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('timeout')); }, timeout);
      })
    ]);
    
    if (response && response.ok) {
      var clone = response.clone();
      caches.open(cacheName || API_CACHE).then(function(cache) {
        cache.put(request, clone);
      });
      return response;
    }
    throw new Error('Response not OK');
  } catch (err) {
    var cached = await caches.match(request);
    if (cached) return cached;
    
    // For API requests that fail, try to serve stale data
    if (isApiRequest(url)) {
      return new Response(JSON.stringify({
        ok: false, error: 'You are offline. Data may be outdated.',
        offline: true
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // For navigation that fails, show offline page
    if (isNavigation(url, request)) {
      var offlinePage = await caches.match('/offline');
      if (offlinePage) return offlinePage;
      return new Response('Offline', { status: 503 });
    }
    
    throw err;
  }
}

// Cache-first strategy (for static/immutable assets)
async function cacheFirst(request, cacheName) {
  var cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    var response = await fetch(request);
    if (response && response.ok) {
      var clone = response.clone();
      caches.open(cacheName || IMMUTABLE_CACHE).then(function(cache) {
        cache.put(request, clone);
      });
    }
    return response;
  } catch (err) {
    // If static asset fails, return a placeholder
    return new Response('', { status: 200 });
  }
}

// Stale-while-revalidate (for HTML pages)
async function staleWhileRevalidate(request) {
  var cache = await caches.open(CACHE);
  var cached = await cache.match(request);
  
  var fetchPromise = fetch(request).then(function(response) {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(function() {
    return cached || caches.match('/offline');
  });
  
  return cached || fetchPromise;
}

// Handle fetch events
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip .html URLs - Cloudflare Pages 308-redirects them to clean URLs
  // (e.g. /dashboard.html -> /dashboard). Let the browser follow the
  // redirect, then we intercept the clean navigation instead.
  if (url.pathname.endsWith('.html')) return;
  
  // Handle API requests - network first with longer timeout
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(event.request, API_CACHE, 5000));
    return;
  }
  
  // Handle immutable static assets (CSS, JS, icons) - cache first
  if (isImmutable(url)) {
    event.respondWith(cacheFirst(event.request, IMMUTABLE_CACHE));
    return;
  }
  
  // Handle HTML pages/navigation - stale while revalidate
  if (isNavigation(url, event.request)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  
  // Everything else - network first
  event.respondWith(networkFirst(event.request, CACHE, 3000));
});

// Handle background sync for offline actions
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-status-updates') {
    event.waitUntil(syncQueuedUpdates());
  } else if (event.tag === 'sync-orders') {
    event.waitUntil(syncQueuedOrders());
  }
});

// Periodic background sync for dashboard data refresh
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'refresh-dashboard') {
    event.waitUntil(refreshDashboardData());
  }
});

async function syncQueuedUpdates() {
  try {
    var cache = await caches.open(CACHE + '-queue');
    var requests = await cache.keys();
    
    return Promise.all(requests.map(function(request) {
      return fetch(request).then(function(response) {
        if (response.ok) return cache.delete(request);
        // Retry logic: keep in queue if failed
        return Promise.resolve();
      }).catch(function() {
        // Keep in queue for next sync
        return Promise.resolve();
      });
    }));
  } catch(e) {
    console.warn('Background sync failed:', e);
  }
}

async function syncQueuedOrders() {
  // Placeholder for future order sync feature
  return Promise.resolve();
}

async function refreshDashboardData() {
  try {
    var response = await fetch('/api/admin/dashboard?period=all');
    if (response && response.ok) {
      var clone = response.clone();
      var cache = await caches.open(API_CACHE);
      cache.put('/api/admin/dashboard?period=all', clone);
      
      sendMessageToClients({
        type: 'DASHBOARD_REFRESHED',
        timestamp: Date.now()
      });
    }
  } catch(e) {
    // Silently fail - will retry on next periodic sync
  }
}

// Handle messages from the client
self.addEventListener('message', function(event) {
  if (!event.data) return;
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CLEAR_CACHE':
      caches.keys().then(function(keys) {
        return Promise.all(keys.map(function(k) { return caches.delete(k); }));
      }).then(function() {
        if (event.source && event.source.postMessage) {
          event.source.postMessage({ type: 'CACHE_CLEARED' });
        }
      });
      break;
    case 'CACHE_PAGE':
      if (event.data.url) {
        caches.open(CACHE).then(function(cache) {
          fetch(event.data.url).then(function(response) {
            if (response.ok) cache.put(event.data.url, response);
          }).catch(function() {});
        });
      }
      break;
  }
});
