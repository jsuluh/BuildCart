/* ── BuildCart PWA Service Worker Registration ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then((reg) => {
        console.log('✅ BuildCart SW registered:', reg.scope);
        // Check for updates every 30 min
        setInterval(() => reg.update(), 30 * 60 * 1000);
      })
      .catch((err) => console.warn('⚠️ SW registration failed:', err));

    // Handle SW updates — show update toast
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 BuildCart updated — new SW activated');
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED' && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}
