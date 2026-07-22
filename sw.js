const CACHE_NAME='skippernow-v17';
const APP_URL='./';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||APP_URL,self.location.href).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if('focus'in client){await client.focus();return;}
    }
    if(self.clients.openWindow)return self.clients.openWindow(target);
  })());
});
