/* =========================================================================
   WiTracEQUIP — Service Worker
   -------------------------------------------------------------------------
   Rôle : rendre l'application installable et la faire démarrer sans réseau.
   Il met en cache la « coquille » de l'application — le HTML (autonome,
   avec son CSS et son JavaScript inline), le manifest, les icônes, les
   deux bibliothèques externes — de sorte qu'ouvrir WiTracEQUIP dans un
   sous-sol affiche l'interface au lieu du dinosaure hors-ligne du
   navigateur.

   Ce qu'il NE met PAS en cache, et c'est essentiel
   ------------------------------------------------
   Aucune requête vers Supabase ne passe par ici. Ni les données, ni surtout
   les jetons d'authentification :

     - CORRECTION : mettre en cache une réponse d'API servirait des données
       périmées sans que personne ne le sache. Sur un carnet d'entretien,
       afficher une vieille valeur en la présentant comme actuelle est pire
       que d'afficher une erreur franche.

     - SÉCURITÉ : le cache du Service Worker n'est pas cloisonné par compte.
       Y laisser une réponse authentifiée la rendrait lisible au compte
       suivant sur le même appareil — exactement ce que le cloisonnement RLS
       s'emploie à empêcher côté serveur.
   ========================================================================= */

/* Changer ce numéro à chaque déploiement : c'est ce qui déclenche le
   remplacement de l'ancien cache par le nouveau chez tous les utilisateurs. */
const VERSION = 'wte-v2.29.1';

const CACHE_SHELL = `${VERSION}-shell`;
const CACHE_EXTERNE = `${VERSION}-externe`;

/* La coquille de l'application : le HTML, son CSS et son JavaScript
   (désormais découpés en fichiers séparés, voir css/style.css et js/*.js)
   + le manifest + les icônes. Si l'un de ces fichiers manque, l'application
   ne démarre pas hors ligne. */
const FICHIERS_SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'css/fondateur.css',
  'css/horizon.css',
  'css/nude.css',
  'css/support-atelier.css',
  'css/tour-controle.css',
  'css/themes.css',
  'css/vitrine.css',

  'js/config.js',
  'js/i18n.js',
  'js/core/icons.js',
  'js/core/data.js',
  'js/core/offline.js',
  'js/fondateur-view.js',
  'js/vitrine.js',
  'js/ui.js',
  'js/reglages.js',
  'js/rapports.js',
  'js/app.js',

  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-64.png',
  'assets/icons/logo-mark.png',
];

/* Bibliothèques servies par un CDN. Elles sont mises en cache au vol, à la
   première utilisation réussie, plutôt qu'à l'installation : un CDN
   momentanément injoignable ne doit pas faire échouer toute l'installation
   du Service Worker. */
const HOTES_CDN = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

/* Bibliothèques indispensables au démarrage (js/config.js appelle
   supabase.createClient dès le chargement : sans elle, l'appli ne démarre
   pas hors ligne). Elles sont préchargées à l'installation, une par une,
   avec une requête « no-cors » identique à celle d'une balise <script> —
   la réponse est alors « opaque » (status 0), ce qui est normal. Un échec
   d'une seule ne fait pas échouer l'installation : le cache au vol
   ci-dessous prendra le relais. */
const BIBLIOTHEQUES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
  'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Lora:wght@600;700&display=swap',
];

/* =========================================================================
   INSTALLATION
   ========================================================================= */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      // cache: 'reload' : on redemande chaque fichier au serveur. Sans cela le
      // navigateur peut resservir l'ANCIEN app.js depuis son cache HTTP
      // (GitHub Pages le garde 10 min) et la nouvelle version embarquerait
      // l'ancien code — c'est ce qui laissait « À prévoir » à l'écran.
      .then((cache) => cache.addAll(FICHIERS_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .catch((e) => {
        console.error('[SW] Mise en cache initiale incomplète :', e);
      })
      // Bibliothèques externes : préchargées séparément (voir BIBLIOTHEQUES).
      .then(() => caches.open(CACHE_EXTERNE))
      .then((cache) => Promise.all(BIBLIOTHEQUES.map((u) =>
        fetch(new Request(u, { mode: 'no-cors' }))
          .then((rep) => { if (rep && (rep.status === 200 || rep.type === 'opaque')) return cache.put(u, rep); })
          .catch((e) => console.warn('[SW] Bibliothèque non préchargée :', u, e))
      )))
      // Nouvelle version prête : elle prend la main tout de suite, sans
      // attendre que l'utilisateur ferme tous ses onglets. Sinon le téléphone
      // mélange l'ancien JavaScript (en cache) et le nouveau HTML.
      .then(() => self.skipWaiting())
  );
});

/* =========================================================================
   ACTIVATION — ménage des versions précédentes
   ========================================================================= */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(
        noms.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/* =========================================================================
   INTERCEPTION DES REQUÊTES
   ========================================================================= */

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Seules les lectures sont concernées. Un POST vers Supabase — une
  // intervention, un retrait — doit toujours atteindre le serveur ou échouer
  // franchement, jamais être servi depuis un cache.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase : jamais interceptée (voir l'en-tête de ce fichier).
  if (url.hostname.endsWith('.supabase.co')) return;

  // Navigation : seul l'accueil de l'application est une coquille à mettre
  // en cache. Une page autonome (comme l'aperçu Fondateur) ne doit JAMAIS
  // remplacer index.html dans le cache hors ligne.
  if (req.mode === 'navigate') {
    const scope = new URL(self.registration.scope).pathname;
    const appPaths = [scope, scope + 'index.html'];
    if (!appPaths.includes(url.pathname)) return;
    event.respondWith(
      fetch(req)
        .then((rep) => {
          // Un serveur de prévisualisation peut rediriger / vers l'aperçu.
          // Dans ce cas, on le montre mais on ne le garde pas comme coquille.
          if (rep.ok && appPaths.includes(new URL(rep.url).pathname)) {
            const copie = rep.clone();
            caches.open(CACHE_SHELL).then((c) => c.put('index.html', copie));
          }
          return rep;
        })
        .catch(() => caches.match('index.html', { ignoreSearch: true })
          .then((r) => r || caches.match('./')))
    );
    return;
  }

  // Bibliothèques externes : on sert le cache immédiatement et on rafraîchit
  // en arrière-plan. Le démarrage reste instantané, la version reste à jour.
  if (HOTES_CDN.includes(url.hostname)) {
    event.respondWith(
      caches.open(CACHE_EXTERNE).then((cache) => cache.match(req).then((enCache) => {
        const reseau = fetch(req)
          .then((rep) => {
            // Une balise <script> sans crossorigin donne une réponse « opaque »
            // (status 0) : il faut l'accepter, sinon rien n'est jamais mis en cache.
            if (rep && (rep.status === 200 || rep.type === 'opaque')) cache.put(req, rep.clone());
            return rep;
          })
          .catch(() => enCache);
        return enCache || reseau;
      }))
    );
    return;
  }

  // Fichiers de l'application (même origine) : le cache d'abord, car ils ne
  // changent qu'au déploiement — et un déploiement change VERSION, ce qui
  // reconstruit le cache de toute façon.
  if (url.origin === self.location.origin) {
    event.respondWith(
      // Uniquement dans le cache de CETTE version : jamais un fichier resté
      // dans le cache d'une version précédente.
      caches.open(CACHE_SHELL).then((c) => c.match(req)).then((enCache) => enCache || fetch(req).then((rep) => {
        if (rep && rep.status === 200 && rep.type === 'basic') {
          const copie = rep.clone();
          caches.open(CACHE_SHELL).then((c) => c.put(req, copie));
        }
        return rep;
      }))
    );
  }
});

/* =========================================================================
   MISE À JOUR IMMÉDIATE (sur demande de la page)
   ========================================================================= */

self.addEventListener('message', (event) => {
  if (event.data === 'ACTIVER_MAINTENANT') self.skipWaiting();
});
