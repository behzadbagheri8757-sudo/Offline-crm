/* sw-register.js — register App Shell service worker only.
   Does not alter bootPage, loadData, or any business logic.
   No skipWaiting / no forced reload.
*/
(function () {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .catch(function (err) {
        console.warn('Service Worker registration failed', err);
      });
  });
})();
