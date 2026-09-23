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
const VERSION = 'wte-v2.16.1';

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

  'js/config.js',
  'js/core/icons.js',
  'js/services/offline.js',
  'js/services/data.js',
  'js/ui.js',
  'js/reglages.js',
  'js/app.js',

  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-64.png',
];

/* Bibliothèques servies par un CDN. Elles sont mises en cache au vol, à la
   première utilisation réussie, plutôt qu'à l'installation : un CDN
   momentanément injoignable ne doit pas faire échouer toute l'installation
   du Service Worker. */
const HOTES_CDN = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
];

/* =========================================================================
   INSTALLATION
   ========================================================================= */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then((cache) => cache.addAll(FICHIERS_SHELL))
      .catch((e) => {
        console.error('[SW] Mise en cache initiale incomplète :', e);
      })
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

  // Navigation : on tente le réseau, on retombe sur la coquille en cache.
  // Les routes étant portées par le fragment d'URL (#/equip/...), toute
  // navigation vise index.html — un seul repli suffit donc pour toutes.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(CACHE_SHELL).then((c) => c.put('index.html', copie));
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
            if (rep && rep.status === 200) cache.put(req, rep.clone());
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
