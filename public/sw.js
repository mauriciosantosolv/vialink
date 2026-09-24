const SHELL='vialink-shell-v1';const ASSETS='vialink-assets-v1';
self.addEventListener('install',e=>{e.waitUntil((async()=>{const cache=await caches.open(SHELL);const page=await fetch('/',{cache:'reload'});if(!page.ok)throw new Error('Shell indisponível');const html=await page.clone().text();await cache.put('/',page);const assets=[...new Set(html.match(/\/assets\/[^\"'<> ]+/g)||[])];await cache.addAll(['/config.js','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png',...assets]);await self.skipWaiting()})());});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>![SHELL,ASSETS].includes(k)).map(k=>caches.delete(k)))),self.clients.claim()]));});
self.addEventListener('fetch',e=>{const req=e.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'){e.respondWith(fetch(req).then(async response=>{if(response.ok){const cache=await caches.open(SHELL);await cache.put('/',response.clone())}return response}).catch(()=>caches.match('/')));return;}
 if(url.pathname==='/config.js'){e.respondWith(fetch(req).then(async response=>{if(response.ok)(await caches.open(SHELL)).put(req,response.clone());return response}).catch(()=>caches.match(req)));return;}
 if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/icons/')){e.respondWith(caches.open(ASSETS).then(async c=>{const cached=await c.match(req);if(cached)return cached;const response=await fetch(req);if(response.ok)c.put(req,response.clone());return response;}));}
});
