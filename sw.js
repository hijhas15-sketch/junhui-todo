/* 하루 · 루틴과 할 일 — 오프라인 실행을 위한 서비스 워커
   - 설치 시 필요한 파일을 미리 캐시한다
   - 화면(HTML)은 항상 네트워크를 먼저 보고, 실패하면 캐시로 연다 (업데이트가 바로 반영되도록)
   - 아이콘·매니페스트 같은 고정 파일은 캐시 우선으로 빠르게 응답한다
   기록(localStorage)은 이 워커와 무관하며 서버로 전송되지 않는다. */
var CACHE_NAME = 'todo-app-v2';
var PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(PRECACHE); })
      .catch(function() { /* 일부 파일이 없어도 설치는 계속한다 */ })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys.map(function(key) {
          if (key !== CACHE_NAME) return caches.delete(key);
        }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* 화면 이동: 네트워크 우선, 실패하면 캐시된 index.html */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function(res) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, copy); });
          return res;
        })
        .catch(function() {
          return caches.match(req).then(function(hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  /* 그 밖의 파일: 캐시 우선, 없으면 네트워크에서 받아 캐시에 넣는다 */
  event.respondWith(
    caches.match(req).then(function(hit) {
      if (hit) return hit;
      return fetch(req).then(function(res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
