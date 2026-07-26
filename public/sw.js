const CACHE="bsr-travel-v1020";
const CORE=["/","/index.html","/styles.css","/app.js","/config.js","/manifest.webmanifest","/content/site.json","/content/news.json","/content/program.json","/content/places.json","/content/gallery.json","/content/downloads.json","/content/faq.json","/content/legal.json"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  if(url.pathname.startsWith("/admin/")||url.origin!==self.location.origin)return;
  if(e.request.mode==="navigate"){
    e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put("/index.html",copy));return r}).catch(()=>caches.match("/index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>{
    const fresh=fetch(e.request).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>cached);
    return cached||fresh;
  }));
});
