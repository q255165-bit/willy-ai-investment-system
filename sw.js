const CACHE='wais-v5-1-1';
const FILES=['./','./index.html','./styles.css','./app.js','./cloud-sync.js','./manifest.webmanifest'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url);
 if(r.mode==='navigate'){e.respondWith(fetch(r,{cache:'no-store'}).then(resp=>{const c=resp.clone();caches.open(CACHE).then(x=>x.put('./index.html',c));return resp}).catch(()=>caches.match('./index.html')));return}
 if(u.origin===self.location.origin)e.respondWith(caches.match(r).then(cached=>{const net=fetch(r,{cache:'no-store'}).then(resp=>{if(resp.ok){const c=resp.clone();caches.open(CACHE).then(x=>x.put(r,c))}return resp}).catch(()=>cached);return cached||net}))
});
