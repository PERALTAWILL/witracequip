if ('serviceWorker' in navigator) {
  // Quand une nouvelle version prend la main, on recharge UNE fois la page
  // pour que tout (HTML, CSS, JavaScript) vienne de la même version.
  let dejaRecharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (dejaRecharge || !navigator.serviceWorker.controller) return;
    dejaRecharge = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      // En revenant sur l'appli (téléphone), on vérifie s'il existe une
      // nouvelle version : plus besoin de la fermer complètement.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch((e) => {
      console.error('[SW] Échec d\'enregistrement :', e);
    });
  });
}
