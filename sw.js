const CACHE_NAME = 'mis-finanzas-pwa-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://unpkg.com/@phosphor-icons/web'
];

/**
 * Evento 'install': Se dispara cuando el Service Worker se instala.
 * Abrimos una caché y guardamos los recursos estáticos de la app.
 */
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache abierta');
                return cache.addAll(urlsToCache);
            })
    );
});

/**
 * Evento 'fetch': Se dispara cada vez que la aplicación solicita un recurso.
 * Implementa una estrategia "Cache First".
 */
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Si el recurso está en la caché, lo retornamos desde ahí.
                if (response) {
                    return response;
                }

                // Si no está en la caché, lo buscamos en la red.
                return fetch(event.request)
                    .then(networkResponse => {
                        // Opcional: clonamos la respuesta y la guardamos en caché para futuras peticiones.
                        // Esto es útil para recursos dinámicos o que no estaban en la lista inicial.
                        let responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    }
                );
            })
    );
});

/**
 * Evento 'activate': Se dispara cuando el Service Worker se activa.
 * Es un buen lugar para limpiar cachés antiguas si es necesario.
 */
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
