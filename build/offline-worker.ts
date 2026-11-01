/** A cache only for the application shell. Projects and image uploads stay in IndexedDB. */
export function offlineWorkerSource(version: string, paths: string[]) {
  return `const CACHE=${JSON.stringify('moku-shell-' + version)};
const PRECACHE=${JSON.stringify([...new Set(paths)])};
const PATHS=new Set(PRECACHE);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.all(PRECACHE.map(async path=>{
    const response=await fetch(new Request(path,{cache:'reload',credentials:'same-origin'}));
    if(!response.ok||response.type==='opaqueredirect')throw new Error('Application shell unavailable');
    if(path==='/index.html'&&!(await response.clone().text()).includes('name="moku-app"'))throw new Error('Application shell is not authenticated');
    await cache.put(path,response);
  }));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=(await caches.keys()).filter(key=>key.startsWith('moku-shell-'));
  const previous=keys.filter(key=>key!==CACHE).slice(-1);
  await Promise.all(keys.filter(key=>key!==CACHE&&!previous.includes(key)).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);return (await cache.match('/index.html'))||fetch(request)})());
    return;
  }
  if(PATHS.has(url.pathname))event.respondWith((async()=>{
    const cache=await caches.open(CACHE);const cached=await cache.match(url.pathname);
    if(cached)return cached;
    const response=await fetch(request);if(response.ok)await cache.put(url.pathname,response.clone());return response;
  })());
});`;
}
