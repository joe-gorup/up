// Golden Scoop Service Worker
// Minimal service worker required for Android TWA PWA compliance.
// This app loads all content from the live server, so no offline caching
// is implemented — the SW exists solely to satisfy the PWA install criteria.

const CACHE_NAME = 'golden-scoop-v1';

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all open clients immediately
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass all requests through to the network — no caching
  event.respondWith(fetch(event.request));
});
