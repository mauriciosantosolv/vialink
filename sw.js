const SHELL='vialink-shell-v2';const ASSETS='vialink-assets-v2';
const ROOT=new URL(self.registration.scope);
self.addEventListener('install',e=>{e.waitUntil((async()=>{const cache=await caches.open(SHELL);const page=await fetch(ROOT.href,{cache:'reload'});if(!page.ok)throw new Error('Shell indisponível');const html=await page.clone().text();await cache.put(ROOT.href,page);const assets=[...new Set(html.match(/(?:\.\/|\/)assets\/[^\"'<> ]+/g)||[])];await cache.addAll(['config.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png',...assets].map(x=>new URL(x,ROOT).href));await self.skipWaiting()})());});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>![SHELL,ASSETS].includes(k)).map(k=>caches.delete(k)))),self.clients.claim()]));});
self.addEventListener('fetch',e=>{const req=e.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 if(req.mode==='navigate'){e.respondWith(fetch(req).then(async response=>{if(response.ok){const cache=await caches.open(SHELL);await cache.put(ROOT.href,response.clone())}return response}).catch(()=>caches.match(ROOT.href)));return;}
 if(url.pathname===new URL('config.js',ROOT).pathname){e.respondWith(fetch(req).then(async response=>{if(response.ok)(await caches.open(SHELL)).put(req,response.clone());return response}).catch(()=>caches.match(req)));return;}
 if(url.pathname.startsWith(new URL('assets/',ROOT).pathname)||url.pathname.startsWith(new URL('icons/',ROOT).pathname)){e.respondWith(caches.open(ASSETS).then(async c=>{const cached=await c.match(req);if(cached)return cached;const response=await fetch(req);if(response.ok)c.put(req,response.clone());return response;}));}
});
