/*
 * 旧站遗留的 Service Worker 会让浏览器一直用缓存的旧页面。
 * 这份文件是「自毁版」：一旦被浏览器取到并激活，它会
 *   1) 删掉本站所有缓存
 *   2) 把自己注销
 *   3) 让已打开的标签页重新加载一次
 * 之后这个站点就不再注册任何 Service Worker。
 */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) { /* 忽略 */ }

    try {
      await self.registration.unregister();
    } catch (e) { /* 忽略 */ }

    try {
      var list = await self.clients.matchAll({ type: 'window' });
      list.forEach(function (c) { c.navigate(c.url); });
    } catch (e) { /* 忽略 */ }
  })());
});
