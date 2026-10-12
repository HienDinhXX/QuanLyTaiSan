const CACHE_VERSION = 'quan-ly-tai-san-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './IMG_A1.jpg'
];

// Cài đặt: lưu các tệp nền tảng của ứng dụng khi đang có mạng.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);

    await Promise.all(APP_SHELL.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });

        if (response.ok) {
          await cache.put(path, response);
        }
      } catch (error) {
        // Nếu chưa tải được tệp, có thể thử lại ở lần truy cập sau.
      }
    }));

    await self.skipWaiting();
  })());
});

// Kích hoạt phiên bản mới và dọn cache cũ của ứng dụng.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(keys.map(key => {
      if (
        key.startsWith('quan-ly-tai-san-') &&
        key !== CACHE_VERSION
      ) {
        return caches.delete(key);
      }
    }));

    await self.clients.claim();
  })());
});

// Xử lý yêu cầu tải trang và các tệp ứng dụng.
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Chỉ xử lý các yêu cầu cùng nguồn.
  if (url.origin !== self.location.origin) return;

  // Trang HTML: ưu tiên tải bản mới từ mạng,
  // nếu mất mạng thì dùng bản đã lưu trong cache.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);

        if (response && response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put('./index.html', response.clone());
        }

        return response;
      } catch (error) {
        return (
          await caches.match(request) ||
          await caches.match('./index.html') ||
          await caches.match('./') ||
          new Response(
            'Ứng dụng chưa được lưu để dùng ngoại tuyến. Hãy mở ứng dụng khi có mạng ít nhất một lần.',
            {
              status: 503,
              headers: {
                'Content-Type': 'text/plain; charset=utf-8'
              }
            }
          )
        );
      }
    })());

    return;
  }

  // Các tệp nền tảng: dùng cache trước để hỗ trợ ngoại tuyến.
  const isAppShell = APP_SHELL.some(path =>
    new URL(path, self.registration.scope).href === url.href
  );

  if (isAppShell) {
    event.respondWith((async () => {
      const cached =
        await caches.match(request) ||
        await caches.match(url.href);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response && response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        return new Response('', {
          status: 503,
          statusText: 'Offline'
        });
      }
    })());
  }
});
