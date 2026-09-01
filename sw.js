self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Pass-through fetch per abilitare l'installazione PWA.
  // Nessuna cache di contenuti: evita dati stantii/sensibili.
});