
async function actualiza_datos()
{
  await console.log("Actualizando datos....")
}

const cacheName = 'pwa_cups';
const staticAssets = [
  './',
  './index.html',
  './manifest.webmanifest',
  './fconta.js',
  './logo256.png',
  './favicon.ico',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js',
  'https://code.highcharts.com/stock/highstock.js',
  'https://code.highcharts.com/modules/boost.js',
  'https://code.highcharts.com/stock/modules/data.js',
  'https://code.highcharts.com/stock/modules/exporting.js',
  'https://code.highcharts.com/stock/modules/export-data.js'
];
self.addEventListener('install', async event => {
  const cache = await caches.open(cacheName);
  await cache.addAll(staticAssets);
  console.log('install event');
});

self.addEventListener('fetch', async event => {
  console.log('fetch event');
  const req = event.request;
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(req);
  return cachedResponse || fetch(req);
}

self.addEventListener('periodicsync', async event => {
  console.log('periodicsync received for ' + event.tag);
  const onPeriodicSync = async() => {
    await actualiza_datos();
  };
    event.waitUntil(onPeriodicSync());
});
