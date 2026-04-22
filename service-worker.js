// ==================== MEMORY LANE - SERVICE WORKER ====================
// Versioon: 2.0.0
// Autor: Perekond Ojaküla
// =====================================================================

const CACHE_NAME = 'memory-lane-v2.0.0';
const RUNTIME_CACHE = 'memory-lane-runtime';

// Failid, mida kohe vahemällu salvestada
const PRECACHE_URLS = [
    '/Memory/',
    '/Memory/index.html',
    '/Memory/manifest.json',
    '/Memory/assets/css/style.min.css',
    '/Memory/assets/js/game.min.js',
    '/Memory/assets/icons/icon-192.png',
    '/Memory/assets/icons/icon-512.png',
    '/Memory/assets/icons/favicon.ico'
];

// ==================== INSTALL - Esmane vahemällu salvestamine ====================
self.addEventListener('install', (event) => {
    console.log('🚀 Service Worker: Installimine...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Failide vahemällu salvestamine');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => {
                console.log('✅ Service Worker: Kõik failid vahemälus');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Service Worker: Vahemälu viga:', error);
            })
    );
});

// ==================== ACTIVATE - Vana vahemälu puhastamine ====================
self.addEventListener('activate', (event) => {
    console.log('🎯 Service Worker: Aktiveerimine...');
    
    const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return cacheNames.filter(
                    (cacheName) => !currentCaches.includes(cacheName)
                );
            })
            .then((cachesToDelete) => {
                return Promise.all(
                    cachesToDelete.map((cacheToDelete) => {
                        console.log('🗑️ Service Worker: Kustutan vana vahemälu:', cacheToDelete);
                        return caches.delete(cacheToDelete);
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker: Aktiveeritud ja valmis');
                return self.clients.claim();
            })
    );
});

// ==================== FETCH - Päringute töötlemine ====================
self.addEventListener('fetch', (event) => {
    // Ignoreeri POST päringuid ja API kutseid
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Ignoreeri Google Analytics ja muud välised päringud
    const url = new URL(event.request.url);
    if (url.hostname.includes('google-analytics.com') || 
        url.hostname.includes('googletagmanager.com') ||
        url.hostname.includes('cdn.jsdelivr.net')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Kui on vahemälus, tagasta sealt
                if (cachedResponse) {
                    // Samal ajal uuenda vahemälu taustal
                    fetchAndCache(event.request);
                    return cachedResponse;
                }
                
                // Kui pole vahemälus, tee võrgupäring
                return fetchAndCache(event.request);
            })
            .catch(() => {
                // Kui kõik ebaõnnestub, näita offline-lehte
                if (event.request.mode === 'navigate') {
                    return caches.match('/Memory/index.html');
                }
                
                // Piltide jaoks võib tagastada vaikimisi pildi
                if (event.request.destination === 'image') {
                    return new Response(
                        '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#1b2735"/><text x="50" y="55" text-anchor="middle" fill="#fff" font-size="14">📴</text></svg>',
                        { 
                            status: 200, 
                            statusText: 'OK',
                            headers: { 'Content-Type': 'image/svg+xml' }
                        }
                    );
                }
                
                return new Response('Offline - Palun kontrolli internetiühendust', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
                });
            })
    );
});

// ==================== ABI FUNKTSIOON - Päringu tegemine ja vahemällu salvestamine ====================
function fetchAndCache(request) {
    return fetch(request)
        .then((response) => {
            // Salvesta ainult edukad vastused
            if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
            }
            
            // Klooni vastus (seda saab ainult üks kord lugeda)
            const responseToCache = response.clone();
            
            caches.open(RUNTIME_CACHE)
                .then((cache) => {
                    cache.put(request, responseToCache);
                })
                .catch((error) => {
                    console.warn('⚠️ Service Worker: Ei saanud vahemällu salvestada:', error);
                });
            
            return response;
        })
        .catch((error) => {
            console.error('❌ Service Worker: Päring ebaõnnestus:', error);
            throw error;
        });
}

// ==================== PUSH NOTIFICATIONS (Valikuline) ====================
self.addEventListener('push', (event) => {
    console.log('📨 Service Worker: Push teade saadud');
    
    let data = {
        title: 'Memory Lane',
        body: 'Tule mängi! Uued tasemed ootavad!',
        icon: '/Memory/assets/icons/icon-192.png',
        badge: '/Memory/assets/icons/badge-96.png',
        vibrate: [200, 100, 200],
        data: {
            url: '/Memory/'
        }
    };
    
    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            vibrate: data.vibrate,
            data: data.data,
            actions: [
                {
                    action: 'play',
                    title: '🎮 Mängi kohe'
                },
                {
                    action: 'later',
                    title: '⏰ Hiljem'
                }
            ]
        })
    );
});

// ==================== NOTIFICATION KLIKK ====================
self.addEventListener('notificationclick', (event) => {
    console.log('🖱️ Service Worker: Teatele klikitud');
    
    event.notification.close();
    
    if (event.action === 'play') {
        event.waitUntil(
            clients.openWindow('/Memory/')
        );
    } else {
        event.waitUntil(
            clients.matchAll({ type: 'window' })
                .then((clientList) => {
                    for (const client of clientList) {
                        if (client.url.includes('/Memory/') && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    return clients.openWindow('/Memory/');
                })
        );
    }
});

// ==================== SÜNKRONISEERIMINE (Taustal) ====================
self.addEventListener('sync', (event) => {
    console.log('🔄 Service Worker: Taustal sünkroniseerimine:', event.tag);
    
    if (event.tag === 'sync-progress') {
        event.waitUntil(syncProgress());
    }
});

async function syncProgress() {
    try {
        // Siia saab lisada edenemise sünkroniseerimise serveriga
        console.log('✅ Service Worker: Edenemine sünkroniseeritud');
    } catch (error) {
        console.error('❌ Service Worker: Sünkroniseerimine ebaõnnestus:', error);
    }
}

// ==================== SÕNUMID PÕHILÕIMEST ====================
self.addEventListener('message', (event) => {
    console.log('📬 Service Worker: Sõnum saadud:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('✅ Service Worker: Kogu vahemälu puhastatud');
                event.ports[0].postMessage({ success: true });
            })
        );
    }
});

console.log('🎮 Memory Lane Service Worker laaditud - Versioon 2.0.0');
