const qs=(s,c=document)=>c.querySelector(s), qsa=(s,c=document)=>[...c.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fetchJson=async url=>{const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(url);return r.json()};
let programData={days:[]}, galleryData=[], activeGallery=[];

async function init(){
  setupNav();setupReveal();setupPwa();setupLightbox();
  const [site,program,places,gallery,downloads,faq,news]=await Promise.allSettled([
    fetchJson("content/site.json"),fetchJson("content/program.json"),fetchJson("content/places.json"),fetchJson("content/gallery.json"),fetchJson("content/downloads.json"),fetchJson("content/faq.json"),fetchJson("content/news.json")
  ]);
  if(site.status==="fulfilled")applySite(site.value);
  if(program.status==="fulfilled"){programData=program.value;renderProgram(program.value.days||[]);renderToday(program.value.days||[])}
  if(places.status==="fulfilled")renderMap(places.value);
  if(gallery.status==="fulfilled"){galleryData=gallery.value.photos||[];renderGallery(galleryData)}
  if(downloads.status==="fulfilled")renderDownloads(downloads.value.downloads||[]);
  if(faq.status==="fulfilled")renderFaq(faq.value.items||[]);
  renderNews(news.status==="fulfilled"?news.value.news||[]:[]);
  loadWeather(site.status==="fulfilled"?(site.value.weatherLocations||[]):[]);
}

function setText(id,value){const el=qs("#"+id);if(el&&value!==undefined&&value!==null)el.textContent=value}
function setLink(id,label,url){const el=qs("#"+id);if(!el)return;if(label)setText(id,label);if(url){el.href=url;el.target="_blank";el.rel="noopener"}}
function renderSectionHead(prefix,data={}){setText(prefix+"Eyebrow",data.eyebrow);setText(prefix+"Title",data.title);setText(prefix+"Intro",data.intro)}
function applySite(site){
  window.__SITE=site;
  if(site.meta){document.title=site.meta.pageTitle||document.title;const m=qs('meta[name="description"]');if(m&&site.meta.description)m.content=site.meta.description}
  setText("brandTitle",site.school);setText("brandSubtitle",site.brandSubtitle);
  setText("heroEyebrow",site.heroEyebrow);const heroTitle=site.heroTitle||site.tripTitle||"";const heroTitleEl=qs("#heroTitle");if(heroTitleEl){const match=heroTitle.match(/^(.*?)(\s+\d{4})$/);if(match){heroTitleEl.textContent=match[1]+" ";const accent=document.createElement("span");accent.textContent=match[2].trim();heroTitleEl.appendChild(accent)}else{heroTitleEl.textContent=heroTitle}}setText("heroSubtitle",site.subtitle);
  setText("heroPrimaryButton",site.heroPrimaryButton);setText("heroSecondaryButton",site.heroSecondaryButton);
  if(site.hero){const hm=qs("#heroMedia");if(hm)hm.style.backgroundImage=`url('${site.hero.replace(/'/g,"%27")}')`}
  setText("countdownLabel",site.countdownLabel);setText("countdownDateText",site.countdownDateText);
  if(Array.isArray(site.navigation)){qs("#mainNav").innerHTML=site.navigation.map(x=>`<a class="${x.highlight?'nav-upload':''} ${x.emergency?'nav-emergency':''}" href="${esc(x.target||'#')}">${esc(x.label)}</a>`).join("");bindNavLinks()}
  if(Array.isArray(site.quickLinks)){qs("#quickLinks").innerHTML=site.quickLinks.map(x=>`<a href="${esc(x.target||'#')}"><span>${esc(x.icon)}</span><b>${esc(x.title)}</b><small>${esc(x.subtitle)}</small></a>`).join("")}
  const t=site.today||{};setText("todayEyebrow",t.eyebrow);setText("todayTitle",t.beforeTitle);setText("todayText",t.beforeText);setText("progressLabel",t.beforeLabel);setText("progressDate",t.dateRange);
  const s=site.sections||{};renderSectionHead("news",s.news);renderSectionHead("program",s.program);renderSectionHead("map",s.map);renderSectionHead("weather",s.weather);renderSectionHead("gallery",s.gallery);renderSectionHead("culinary",s.culinary);renderSectionHead("downloads",s.downloads);renderSectionHead("faq",s.faq);
  setText("programNotice",site.notice||(s.program||{}).intro);
  const culinary=site.culinaryItems||[];qs("#culinaryGrid").innerHTML=culinary.map(x=>`<article class="reveal visible"><img src="${esc(x.image)}" alt="${esc(x.title)}"><div><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div></article>`).join("");
  const h=site.hotel||{};setText("hotelEyebrow",h.eyebrow);setText("hotelTitle",h.title);setText("hotelAddress",h.address);if(h.image){const im=qs("#hotelImage");im.src=h.image;im.alt=h.title||"Hotel"}setLink("hotelMapsButton",h.mapsButton,h.mapsUrl);qs("#hotelDetails").innerHTML=(h.details||[]).map(x=>`<div><span>${esc(x.icon)}</span><b>${esc(x.title)}</b><small>${esc(x.text)}</small></div>`).join("");
  const g=site.studentArea||{};setText("groupIcon",g.icon);setText("groupEyebrow",g.eyebrow);setText("groupTitle",g.title);setText("groupIntro",g.text);setText("uploadButton",g.uploadButton);setText("galleryButton",g.galleryButton);setText("uploadNote",g.note);activateExternal("uploadButton",g.uploadUrl);activateExternal("galleryButton",g.galleryUrl);
  const e=site.emergency||{};setText("emergencyEyebrow",e.eyebrow);setText("emergencyTitle",e.title);setText("emergencyIntro",e.intro);renderEmergency(e.items||[]);
  const a=site.adminArea||{};setText("adminEyebrow",a.eyebrow);setText("adminTitle",a.title);setText("adminIntro",a.text);setText("adminButton",a.button);
  const f=site.footer||{};setText("footerTitle",f.title);setText("footerSubtitle",f.subtitle);setText("footerTopLink",f.topLink);setText("footerPrivacy",f.privacy);
  const target=new Date(site.departure||"2026-11-21T20:00:00+01:00").getTime();
  const tick=()=>{let d=target-Date.now(),el=qs("#countdown");if(!el)return;if(d<=0){el.innerHTML='<div><strong>🎉</strong><small>Es geht los!</small></div>';return}const vals=[];vals.push([Math.floor(d/86400000),"Tage"]);d%=86400000;vals.push([Math.floor(d/3600000),"Stunden"]);d%=3600000;vals.push([Math.floor(d/60000),"Minuten"]);d%=60000;vals.push([Math.floor(d/1000),"Sekunden"]);el.innerHTML=vals.map(v=>`<div><strong>${String(v[0]).padStart(2,"0")}</strong><small>${v[1]}</small></div>`).join("")};tick();setInterval(tick,1000);
}
function activateExternal(id,url){const a=qs("#"+id);if(a&&url){a.href=url;a.target="_blank";a.rel="noopener";a.classList.remove("disabled");a.removeAttribute("aria-disabled")}}

function renderNews(items){const grid=qs("#newsGrid");const rows=items.filter(x=>x.published!==false).sort((a,b)=>(b.date||"").localeCompare(a.date||""));if(!rows.length){grid.innerHTML='<div class="empty-state">Noch keine Meldungen veröffentlicht.</div>';return}grid.innerHTML=rows.map(n=>`<article class="news-card ${n.important?'important':''}"><time>${formatDate(n.date)}</time><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></article>`).join("")}
function formatDate(v){if(!v)return"";return new Intl.DateTimeFormat("de-AT",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(v+"T12:00:00"))}


function svgIcon(name,extraClass=''){
  // Einheitliches, an Lucide angelehntes Outline-Set (inline, ohne externe Abhängigkeit)
  const icons={
    bus:'<rect x="4" y="3" width="16" height="15" rx="3.2"/><path d="M7 7h10M4 12h16M7 18v2m10-2v2"/><circle cx="8" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="15" r="1" fill="currentColor" stroke="none"/>',
    ship:'<path d="M4 15.5 7 8h10l3 7.5-8 3.5-8-3.5Z"/><path d="M12 3v5M9 5h6M3 20c1.5 0 2.25-1 3.75-1s2.25 1 3.75 1 2.25-1 3.75-1 2.25 1 3.75 1 2.25-1 3.75-1"/>',
    train:'<rect x="5" y="2.5" width="14" height="16" rx="3.5"/><path d="M8 6.5h8M5 11h14M8 18.5 6 22m10-3.5 2 3.5M8 22h8"/><circle cx="8.5" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="14.5" r="1" fill="currentColor" stroke="none"/>',
    utensils:'<path d="M6 3v7M3.5 3v4.5A2.5 2.5 0 0 0 6 10m2.5-7v4.5A2.5 2.5 0 0 1 6 10v11M16 3v18M16 3c3 1.8 4.5 5 4 9h-4"/>',
    camera:'<path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h5Z"/><circle cx="12" cy="13" r="3.5"/>',
    diamond:'<path d="M3 9.5 7.5 4h9L21 9.5 12 21 3 9.5Z"/><path d="M3 9.5h18M7.5 4 12 9.5 16.5 4M7.5 9.5 12 21l4.5-11.5"/>',
    hotel:'<path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16M17 9h2a2 2 0 0 1 2 2v10M8 7h2M8 11h2M8 15h2M3 21h19"/>',
    bed:'<path d="M3 5v16M21 21v-8a2 2 0 0 0-2-2H7a4 4 0 0 0-4 4v2h18M7 11V7h5a2 2 0 0 1 2 2v2"/>',
    landmark:'<path d="M3 9h18L12 3 3 9ZM4 21h16M6 9v9m4-9v9m4-9v9m4-9v9M3 18h18"/>',
    building:'<path d="M4 21h16M6 21V5l6-3 6 3v16M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M11 21v-3h2v3"/>',
    euflag:'<rect x="3" y="5" width="18" height="14" rx="2" fill="#1557b0" stroke="none"/><g fill="#ffd43b" stroke="none"><circle cx="12" cy="8" r=".68"/><circle cx="14.5" cy="8.8" r=".68"/><circle cx="16" cy="11" r=".68"/><circle cx="14.5" cy="13.2" r=".68"/><circle cx="12" cy="14" r=".68"/><circle cx="9.5" cy="13.2" r=".68"/><circle cx="8" cy="11" r=".68"/><circle cx="9.5" cy="8.8" r=".68"/></g>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    route:'<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h3a3 3 0 0 0 3-3V8a3 3 0 0 1 3-3h-1"/>',
    mapPin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
    ticket:'<path d="M2 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
    coffee:'<path d="M3 8h13v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Z"/><path d="M16 10h2a3 3 0 0 1 0 6h-2M6 2v2M10 2v2M14 2v2"/>',
    star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>'
  };
  return `<svg class="program-svg-icon icon-${name} ${extraClass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.mapPin}</svg>`;
}

function eventIcon(event){
  const text=`${event.title||''} ${event.text||''}`.toLowerCase();
  // Spezifische Begriffe stehen bewusst vor allgemeinen Wörtern wie „Fahrt“.
  if(/hafenrundfahrt|schifffahrt|schiff|hafen/.test(text)) return svgIcon('ship');
  if(/mittag|abendessen|frühstück|pommes|waffel|restaurant|food court|essen/.test(text)) return svgIcon('utensils');
  if(/gruppenfoto|foto|fotostopp/.test(text)) return svgIcon('camera');
  if(/diamant/.test(text)) return svgIcon('diamond');
  if(/bahnhof|central|zug|metro/.test(text)) return svgIcon('train');
  if(/sicherheitskontrolle|akkreditierung|security|kontrolle/.test(text)) return svgIcon('shield');
  if(/parlamentarium|plenarsaal|parlament/.test(text)) return svgIcon('landmark');
  if(/kommission|ständige vertretung|europäischer rat|rat der europäischen/.test(text)) return svgIcon('building');
  if(/europäisch|eu-|eu /.test(text)) return svgIcon('euflag');
  if(/hotel|check-in|check in|zimmer/.test(text)) return svgIcon('bed');
  if(/vortrag|präsentation|besprechung|referat/.test(text)) return svgIcon('mic');
  if(/freizeit in 4er-gruppen|gruppe|gruppen/.test(text)) return svgIcon('users');
  if(/spaziergang|sightseeing|altstadt|bummeln|shopping|freizeit/.test(text)) return svgIcon('route');
  if(/ticket|eintritt/.test(text)) return svgIcon('ticket');
  if(/pause|kaffee/.test(text)) return svgIcon('coffee');
  if(/bus|abfahrt|ankunft|heimreise|rückfahrt|fahrt/.test(text)) return svgIcon('bus');
  return svgIcon('mapPin');
}


function dayIcon(day){
  const text=`${day.id||''} ${day.title||''} ${day.subtitle||''}`.toLowerCase();
  if(/antwerpen|hafen|diamant/.test(text)) return svgIcon('diamond','day-svg');
  if(/parlament|kommission|eu|vertretung|brüssel/.test(text)) return svgIcon('euflag','day-svg');
  if(/heimreise|anreise|rohrbach|abfahrt|bus/.test(text)) return svgIcon('bus','day-svg');
  if(/vortrag/.test(text)) return svgIcon('talk','day-svg');
  return svgIcon('pin','day-svg');
}

function renderProgram(days){
  const tabs=qs("#dayTabs"),panels=qs("#dayPanels");
  const eventCount=day=>(day.events||[]).length;
  const totalEvents=days.reduce((sum,day)=>sum+eventCount(day),0);
  const statusCount=(day,status)=>(day.events||[]).filter(event=>event.status===status).length;
  const firstTime=day=>((day.events||[])[0]||{}).time||"–";
  const lastTime=day=>((day.events||[]).slice(-1)[0]||{}).time||"–";

  tabs.innerHTML=days.map((d,i)=>`<button class="day-tab ${i===0?'active':''}" data-day="${esc(d.id)}" role="tab" aria-controls="day-${esc(d.id)}" aria-selected="${i===0}">
    <span class="day-tab-weekday">${esc(d.short)}</span>
    <span class="day-tab-date">${esc(d.date)}</span>
    <span class="day-tab-title">${esc(d.title)}</span>
  </button>`).join("");

  panels.innerHTML=days.map((d,i)=>{
    const events=d.events||[];
    const dayLabel=Number(d.dayNumber)===0?'Anreisetag':`Reisetag ${Number(d.dayNumber)||i}`;
    const confirmed=statusCount(d,'confirmed');
    const pending=statusCount(d,'pending');
    const progress=Math.round(((i+1)/days.length)*100);
    return `<article class="day-panel ${i===0?'active':''}" id="day-${esc(d.id)}" role="tabpanel" aria-label="${esc(d.short)} ${esc(d.date)} – ${esc(d.title)}">
      <header class="day-cover ${d.cover?'photo-cover':''}" ${d.cover?`style="--bg:url('${esc(d.cover)}')"`:''}>
        <div class="day-cover-topline"><span>${esc(dayLabel)}</span></div>
        <div class="day-cover-content">
          <p class="day-date-large">${esc(d.short)} · ${esc(d.date)}2026</p>
          <h3>${esc(d.title)}</h3>
          <p>${esc(d.subtitle)}</p>
          <div class="day-cover-chips">
            ${confirmed?`<span class="chip-confirmed">✓ ${confirmed} bestätigt</span>`:''}
            ${pending?`<span class="chip-pending">○ ${pending} offen</span>`:''}
          </div>
        </div>
        <span class="day-icon" aria-hidden="true">${dayIcon(d)}</span>
      </header>

      ${(d.gallery||[]).length?`<div class="day-photo-strip">${d.gallery.map((x,j)=>`<figure><img src="${esc(x)}" alt="${esc(d.title)} – Eindruck ${j+1}" loading="lazy"></figure>`).join("")}</div>`:''}

      <div class="trip-progress" aria-label="Fortschritt innerhalb der Reise">
        <div class="trip-progress-copy"><span>Reiseverlauf</span></div>
        <div class="trip-progress-track"><span style="width:${progress}%"></span></div>
        <small>Tag ${i+1} von ${days.length}</small>
      </div>

      <div class="program-overview">
        <div><span class="overview-label">Datum</span><strong>${esc(d.short)}, ${esc(d.date)}2026</strong></div>
        <div><span class="overview-label">Tagesfokus</span><strong>${esc(d.title)}</strong></div>
        <div><span class="overview-label">Reisezeitraum</span><strong>21.–26. November 2026</strong></div>
      </div>

      <div class="timeline-heading"><div><span class="eyebrow">Tagesablauf</span><h4>Unser Programm im Überblick</h4></div></div>
      <div class="timeline" aria-label="Tagesablauf">
        ${events.map((e,index)=>`<article class="timeline-row ${e.status==='pending'?'pending':''} ${e.status==='confirmed'?'confirmed':''}">
          <div class="timeline-marker" aria-hidden="true"><span class="timeline-icon">${eventIcon(e)}</span><small>${String(index+1).padStart(2,'0')}</small></div>
          <time>${esc(e.time)}</time>
          <div class="timeline-content">
            <div class="timeline-card-head"><span class="timeline-step">Stopp ${String(index+1).padStart(2,'0')}</span>${e.status?`<span class="status-dot ${esc(e.status)}">${e.status==='confirmed'?'Bestätigt':'In Planung'}</span>`:''}</div>
            <h4>${esc(e.title)}</h4>
            <p>${esc(e.text)}</p>
            ${e.status?`<span class="badge ${esc(e.status)}"><span aria-hidden="true">${e.status==='confirmed'?'✓':'○'}</span>${e.status==='confirmed'?'Bereits gebucht':'Noch nicht bestätigt'}</span>`:''}
          </div>
        </article>`).join("")}
      </div>

      <nav class="program-pager" aria-label="Zwischen Reisetagen wechseln">
        <button type="button" class="program-pager-button prev" data-target="${i>0?esc(days[i-1].id):''}" ${i===0?'disabled':''}><span>←</span><small>${i>0?esc(days[i-1].short+' · '+days[i-1].date):'Start'}</small><strong>${i>0?esc(days[i-1].title):'Abreise'}</strong></button>
        <button type="button" class="program-pager-button next" data-target="${i<days.length-1?esc(days[i+1].id):''}" ${i===days.length-1?'disabled':''}><span>→</span><small>${i<days.length-1?esc(days[i+1].short+' · '+days[i+1].date):'Ziel'}</small><strong>${i<days.length-1?esc(days[i+1].title):'Heimreise'}</strong></button>
      </nav>
    </article>`
  }).join("");

  qsa(".day-tab",tabs).forEach(btn=>btn.addEventListener("click",()=>activateDay(btn.dataset.day,false)));
  qsa(".program-pager-button",panels).forEach(btn=>btn.addEventListener("click",()=>{if(btn.dataset.target)activateDay(btn.dataset.target,true)}));
}

function activateDay(id,scroll=false){
  const tabs=qs('#dayTabs');
  let activeTab=null;
  qsa(".day-tab").forEach(b=>{
    const on=b.dataset.day===id;
    b.classList.toggle("active",on);
    b.setAttribute("aria-selected",String(on));
    if(on) activeTab=b;
  });
  qsa(".day-panel").forEach(p=>p.classList.toggle("active",p.id===`day-${id}`));

  // Mobile: only the tab bar itself scrolls. scrollIntoView moved the whole
  // viewport horizontally on the final travel day and clipped the page.
  if(activeTab&&tabs&&window.matchMedia('(max-width:700px)').matches){
    const maxLeft=Math.max(0,tabs.scrollWidth-tabs.clientWidth);
    const centered=activeTab.offsetLeft-(tabs.clientWidth-activeTab.offsetWidth)/2;
    tabs.scrollTo({left:Math.min(maxLeft,Math.max(0,centered)),behavior:'smooth'});
  }

  if(scroll){
    const section=qs('#programm');
    if(section){
      const offset=window.matchMedia('(max-width:700px)').matches?76:92;
      window.scrollTo({top:Math.max(0,section.offsetTop-offset),behavior:'smooth'});
    }
  }
}

function renderToday(days){const site=window.__SITE||{};const t=site.today||{};const now=new Date(),start=new Date(site.departure||"2026-11-21T20:00:00+01:00"),end=new Date(site.returnDate||"2026-11-26T23:59:00+01:00");let pct=0,label="Vorfreude",day=null;if(now>=start&&now<=end){pct=Math.min(100,Math.max(0,(now-start)/(end-start)*100));label=`Tag ${Math.max(1,Math.ceil((now-start)/86400000))} von 5`;const ids=["sa","so","mo","di","mi","do"];day=days.find(d=>d.id===ids[Math.min(ids.length-1,Math.floor((now-start)/86400000))])}else if(now>end){pct=100;label=t.afterLabel||"Reise abgeschlossen"}qs("#progressBar").style.width=`${pct}%`;qs("#progressValue").textContent=`${Math.round(pct)} %`;qs("#progressLabel").textContent=label;if(day){qs("#todayTitle").textContent=day.title;qs("#todayText").textContent=day.subtitle;qs("#progressDate").textContent=`${day.short}, ${day.date}`;qs("#todaySchedule").innerHTML=(day.events||[]).slice(0,3).map(e=>`<article class="today-item"><time>${esc(e.time)}</time><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></article>`).join("");activateDay(day.id)}else if(now>end){qs("#todayTitle").textContent=t.afterTitle||"Schöne Erinnerungen an Brüssel";qs("#todayText").textContent=t.afterText||"Die Reise ist abgeschlossen. Die geschützte Galerie bleibt für die Reisegruppe erreichbar."}}

function renderMap(mapData){
  const canvas=qs("#map"),list=qs("#placeList"),legend=qs("#mapLegend"),reset=qs("#mapReset");
  const rawPlaces=Array.isArray(mapData)?mapData:(mapData?.places||[]);
  const routeStops=Array.isArray(mapData?.route)?mapData.route:[];
  if(!canvas||!list||!legend||!window.L){if(canvas)canvas.innerHTML='<div class="empty-state">Karte konnte nicht geladen werden.</div>';return}

  const defaults={
    "Hotel":{color:"#e63946",icon:"H"},"EU":{color:"#1557b0",icon:"EU"},
    "Sehenswürdigkeit":{color:"#7b2cbf",icon:"★"},"Metro":{color:"#f59e0b",icon:"M"},
    "Essen":{color:"#16a34a",icon:"✦"},"Notfall":{color:"#dc2626",icon:"!"},
    "Antwerpen":{color:"#0f766e",icon:"A"},"Waterloo":{color:"#64748b",icon:"W"}
  };
  const places=rawPlaces
    .filter(p=>p&&p.published!==false&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)))
    .sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999));
  if(!places.length){canvas.innerHTML='<div class="empty-state">Für die Karte fehlen veröffentlichte Orte mit gültigen Koordinaten.</div>';return}

  const styleFor=p=>({color:p.markerColor||defaults[p.category]?.color||"#334155",icon:p.markerIcon||defaults[p.category]?.icon||"•"});
  const markerIcon=p=>{const s=styleFor(p);return L.divIcon({className:"erasmus-marker-wrap",html:`<div class="erasmus-marker" style="--marker:${esc(s.color)}"><span>${esc(s.icon)}</span></div>`,iconSize:[44,50],iconAnchor:[22,48],popupAnchor:[0,-43]})};

  canvas.innerHTML="";
  const map=L.map(canvas,{zoomControl:true,scrollWheelZoom:false,zoomAnimation:true,fadeAnimation:true,markerZoomAnimation:true,preferCanvas:true});
  L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap-Mitwirkende'}).addTo(map);
  map.zoomControl.setPosition("topright");
  map.on("focus",()=>map.scrollWheelZoom.enable());
  map.on("blur",()=>map.scrollWheelZoom.disable());

  const layers=new Map();
  const markerGroup=L.featureGroup().addTo(map);
  const categoryOrder=[...new Set(places.map(p=>p.category||"Weitere Orte"))];
  legend.innerHTML=`<button class="map-filter active" data-category="Alle" type="button"><i style="--legend:#0a49a5"></i>Alle</button>`+
    categoryOrder.map(cat=>{const p=places.find(x=>(x.category||"Weitere Orte")===cat),s=styleFor(p);return `<button class="map-filter" data-category="${esc(cat)}" type="button"><i style="--legend:${esc(s.color)}"></i>${esc(cat)}</button>`}).join("");

  list.innerHTML='<section class="map-detail" id="mapDetail" aria-live="polite"></section><div class="place-list-items" id="placeListItems"></div>';
  const detail=qs("#mapDetail",list),items=qs("#placeListItems",list);
  items.innerHTML=places.map((p,i)=>{const s=styleFor(p);return `<article class="place-card" data-place="${i}" data-category="${esc(p.category||"Weitere Orte")}" tabindex="0" role="button"><img src="${esc(p.image||'/images/hero.jpg')}" alt="${esc(p.title)}"><div class="place-card-copy"><span class="place-category" style="--category:${esc(s.color)}">${esc(p.category||"Weitere Orte")}</span><h3>${esc(p.title)}</h3><small>${esc(p.walk||p.address||"")}</small></div><span class="place-arrow" aria-hidden="true">›</span></article>`}).join("");

  const popupHtml=p=>{const maps=p.maps||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address||p.title)}`;return `<article class="leaflet-place-popup">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.title)}">`:''}<div><small>${esc(p.category||'Ort')}</small><h3>${esc(p.title)}</h3>${p.description?`<p>${esc(p.description)}</p>`:''}<div class="popup-actions"><a href="${esc(maps)}" target="_blank" rel="noopener">Google Maps ↗</a>${p.streetView?`<a href="${esc(p.streetView)}" target="_blank" rel="noopener">Street View ↗</a>`:''}</div></div></article>`};
  places.forEach((p,i)=>{const marker=L.marker([Number(p.lat),Number(p.lng)],{icon:markerIcon(p),title:p.title,riseOnHover:true}).bindPopup(popupHtml(p),{maxWidth:340,minWidth:260});marker.addTo(markerGroup);marker.on("click",()=>setActive(i,{move:false}));layers.set(i,marker)});

  let routeLayer=null,routeMarkers=[];
  const validRoute=routeStops.filter(x=>x&&x.published!==false&&Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lng))).sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999));
  if(validRoute.length>1){
    const coords=validRoute.map(x=>[Number(x.lat),Number(x.lng)]);
    routeLayer=L.polyline(coords,{color:"#0a49a5",weight:5,opacity:.86,lineCap:"round",lineJoin:"round",dashArray:"1 0"}).addTo(map);
    L.polyline(coords,{color:"#ffffff",weight:2,opacity:.75,dashArray:"3 10",interactive:false}).addTo(map);
    routeMarkers=validRoute.map((stop,i)=>L.marker(coords[i],{icon:L.divIcon({className:"route-stop-wrap",html:`<div class="route-stop">${i+1}</div>`,iconSize:[28,28],iconAnchor:[14,14]})}).bindTooltip(stop.title||`Station ${i+1}`,{direction:"top",offset:[0,-12],className:"route-tooltip"}).addTo(map));
  }

  let activeIndex=0,activeCategory="Alle",view="city";
  function renderDetail(index){const p=places[index],s=styleFor(p);if(!p)return;const maps=p.maps||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address||p.title)}`;detail.innerHTML=`<div class="map-detail-media"><img src="${esc(p.image||'/images/hero.jpg')}" alt="${esc(p.title)}"><span class="map-detail-badge" style="--detail:${esc(s.color)}">${esc(p.category||'Ort')}</span></div><div class="map-detail-copy"><h3>${esc(p.title)}</h3>${p.description?`<p>${esc(p.description)}</p>`:''}<div class="map-detail-meta">${p.address?`<span><b>Adresse</b>${esc(p.address)}</span>`:''}${p.walk?`<span><b>Entfernung</b>${esc(p.walk)}</span>`:''}</div><div class="map-detail-actions"><a class="map-detail-route" href="${esc(maps)}" target="_blank" rel="noopener">Google Maps <span>↗</span></a>${p.streetView?`<a class="map-detail-route secondary" href="${esc(p.streetView)}" target="_blank" rel="noopener">Street View <span>↗</span></a>`:''}</div></div>`}
  function setActive(index,{move=true}={}){activeIndex=index;qsa('.place-card',items).forEach((c,i)=>c.classList.toggle('active',i===index));renderDetail(index);const p=places[index],marker=layers.get(index);if(move){view="city";updateSwitch();map.flyTo([Number(p.lat),Number(p.lng)],Number(p.zoom)||17,{duration:.85});setTimeout(()=>marker?.openPopup(),500)}}
  qsa('.place-card',items).forEach(card=>{const open=()=>setActive(Number(card.dataset.place));card.addEventListener('click',open);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})});
  function applyFilter(cat){activeCategory=cat;qsa('.map-filter',legend).forEach(b=>b.classList.toggle('active',b.dataset.category===cat));places.forEach((p,i)=>{const show=cat==='Alle'||(p.category||'Weitere Orte')===cat;const marker=layers.get(i);if(show&&!markerGroup.hasLayer(marker))markerGroup.addLayer(marker);if(!show&&markerGroup.hasLayer(marker))markerGroup.removeLayer(marker)});qsa('.place-card',items).forEach(c=>c.hidden=!(cat==='Alle'||c.dataset.category===cat));const first=places.findIndex(p=>cat==='Alle'||(p.category||'Weitere Orte')===cat);if(first>=0)setActive(first)}
  qsa('.map-filter',legend).forEach(btn=>btn.addEventListener('click',()=>applyFilter(btn.dataset.category)));

  const toolbar=legend.closest('.map-toolbar');
  const switcher=document.createElement('div');switcher.className='map-view-switch';switcher.innerHTML='<button class="active" data-view="city" type="button">Orte</button><button data-view="trip" type="button">Gesamtreise</button>';reset?.replaceWith(switcher);toolbar?.appendChild(switcher);
  function updateSwitch(){qsa('button',switcher).forEach(b=>b.classList.toggle('active',b.dataset.view===view))}
  qsa('button',switcher).forEach(btn=>btn.addEventListener('click',()=>{view=btn.dataset.view;updateSwitch();if(view==='trip'&&validRoute.length>1){map.fitBounds(L.latLngBounds(validRoute.map(x=>[Number(x.lat),Number(x.lng)])),{padding:[55,55],animate:true,duration:.8})}else{const p=places[activeIndex];map.flyTo([Number(p.lat),Number(p.lng)],Number(p.zoom)||17,{duration:.8})}}));

  setActive(0,{move:false});
  if(validRoute.length>1)map.fitBounds(markerGroup.getBounds(),{padding:[45,45]});else map.setView([Number(places[0].lat),Number(places[0].lng)],Number(places[0].zoom)||17);
  setTimeout(()=>map.invalidateSize(),200);
}

async function loadWeather(places=[]){
  const primary=places[0]||{name:"Brüssel",lat:50.8503,lon:4.3517};
  const current=qs("#weatherCurrent"),forecast=qs("#weatherForecast");
  try{
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${primary.lat}&longitude=${primary.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=Europe%2FBrussels`;
    const r=await fetch(u,{cache:"no-store"});
    if(!r.ok)throw new Error(`Wetter-API: ${r.status}`);
    const x=await r.json(),c=x.current||{},w=weatherInfo(c.weather_code),d=x.daily||{};
    const tip=weatherTip({temperature:c.temperature_2m,wind:c.wind_speed_10m,precipitation:(d.precipitation_probability_max||[])[0],code:c.weather_code});
    current.innerHTML=`<article class="weather-card weather-now"><div><small>📍 Heute in ${esc(primary.name)}</small><strong>${Math.round(c.temperature_2m??0)} °C</strong><span>Gefühlt ${Math.round(c.apparent_temperature??0)} °C · Wind ${Math.round(c.wind_speed_10m??0)} km/h</span><span>${w.text}</span><div class="weather-tip"><b>💡 Reisetipp</b><span>${esc(tip)}</span></div></div><div class="weather-icon">${w.icon}</div></article>`;
    const labels=["Heute","Morgen","Übermorgen"];
    forecast.innerHTML=(d.time||[]).slice(0,4).map((day,i)=>{const info=weatherInfo((d.weather_code||[])[i]);const label=labels[i]||new Intl.DateTimeFormat("de-AT",{weekday:"long"}).format(new Date(day+"T12:00:00"));return `<article class="forecast-day"><small>${esc(label)}</small><div class="forecast-icon">${info.icon}</div><strong>${Math.round((d.temperature_2m_max||[])[i]??0)}°</strong><span>${Math.round((d.temperature_2m_min||[])[i]??0)}° min</span><span>${Math.round((d.precipitation_probability_max||[])[i]??0)} % Regen</span><b>${info.text}</b></article>`}).join("");
  }catch(error){
    console.error("Wetter konnte nicht geladen werden:",error);
    if(current)current.innerHTML='<div class="empty-state">Wetterdaten sind derzeit nicht verfügbar.</div>';
    if(forecast)forecast.innerHTML="";
  }
}

function weatherTip({temperature=0,wind=0,precipitation=0,code=0}={}){
  if(precipitation>=50||code>=51&&code<=82)return "Regenjacke oder Schirm mitnehmen.";
  if(temperature<8)return "Warme Kleidung und eine wetterfeste Jacke empfohlen.";
  if(wind>=30)return "Es wird windig – eine windfeste Jacke ist sinnvoll.";
  if(temperature>=25)return "Sonnencreme und Trinkflasche nicht vergessen.";
  if(temperature<14)return "Eine zusätzliche Jacke ist empfehlenswert.";
  return "Angenehmes Reisewetter – trotzdem eine leichte Jacke einpacken.";
}

function weatherInfo(code=0){if(code===0)return{icon:"☀️",text:"Klar"};if([1,2].includes(code))return{icon:"🌤️",text:"Leicht bewölkt"};if(code===3)return{icon:"☁️",text:"Bewölkt"};if([45,48].includes(code))return{icon:"🌫️",text:"Nebel"};if(code>=51&&code<=67)return{icon:"🌧️",text:"Regen"};if(code>=71&&code<=77)return{icon:"🌨️",text:"Schnee"};if(code>=80&&code<=82)return{icon:"🌦️",text:"Regenschauer"};if(code>=95)return{icon:"⛈️",text:"Gewitter"};return{icon:"🌥️",text:"Wechselhaft"}}

function renderGallery(items){const cats=["Alle",...new Set(items.map(x=>x.day).filter(Boolean))];qs("#galleryFilters").innerHTML=cats.map((c,i)=>`<button class="filter-button ${i===0?'active':''}" data-filter="${esc(c)}">${esc(c)}</button>`).join("");const draw=filter=>{activeGallery=filter==="Alle"?items:items.filter(x=>x.day===filter);qs("#galleryGrid").innerHTML=activeGallery.map((p,i)=>`<figure class="gallery-item" data-index="${i}" tabindex="0"><img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy"><figcaption><b>${esc(p.title)}</b><span>${esc(p.day)}</span></figcaption></figure>`).join("");qsa(".gallery-item").forEach(el=>{const open=()=>openLightbox(Number(el.dataset.index));el.addEventListener("click",open);el.addEventListener("keydown",e=>{if(e.key==="Enter")open()})})};draw("Alle");qsa(".filter-button").forEach(b=>b.addEventListener("click",()=>{qsa(".filter-button").forEach(x=>x.classList.remove("active"));b.classList.add("active");draw(b.dataset.filter)}))}
let lightboxIndex=0,touchStart=0;function setupLightbox(){qs("#lightboxClose").addEventListener("click",closeLightbox);qs("#lightboxPrev").addEventListener("click",()=>moveLightbox(-1));qs("#lightboxNext").addEventListener("click",()=>moveLightbox(1));qs("#lightbox").addEventListener("click",e=>{if(e.target.id==="lightbox")closeLightbox()});document.addEventListener("keydown",e=>{if(qs("#lightbox").hidden)return;if(e.key==="Escape")closeLightbox();if(e.key==="ArrowLeft")moveLightbox(-1);if(e.key==="ArrowRight")moveLightbox(1)});qs("#lightbox").addEventListener("touchstart",e=>touchStart=e.changedTouches[0].clientX,{passive:true});qs("#lightbox").addEventListener("touchend",e=>{const dx=e.changedTouches[0].clientX-touchStart;if(Math.abs(dx)>60)moveLightbox(dx>0?-1:1)},{passive:true})}
function openLightbox(i){lightboxIndex=i;updateLightbox();qs("#lightbox").hidden=false;document.body.style.overflow="hidden"}function closeLightbox(){qs("#lightbox").hidden=true;document.body.style.overflow=""}function moveLightbox(d){lightboxIndex=(lightboxIndex+d+activeGallery.length)%activeGallery.length;updateLightbox()}function updateLightbox(){const p=activeGallery[lightboxIndex];if(!p)return;qs("#lightboxImage").src=p.image;qs("#lightboxImage").alt=p.title;qs("#lightboxTitle").textContent=p.title;qs("#lightboxCaption").textContent=p.description||p.day||""}

function renderEmergency(items){const grid=qs("#emergencyGrid");if(!grid)return;grid.innerHTML=items.map(x=>`<article class="emergency-item"><div class="emergency-item-icon">${esc(x.icon||"🛟")}</div><div><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p>${x.url&&x.button?`<a class="emergency-link" href="${esc(x.url)}" ${String(x.url).startsWith('http')?'target="_blank" rel="noopener"':''}>${esc(x.button)}</a>`:''}</div></article>`).join("")}

function renderDownloads(items){const rows=items.filter(x=>x.published&&x.file);qs("#downloadsGrid").innerHTML=rows.length?rows.map(x=>`<article class="download-card"><div class="download-icon">${esc(x.icon||"📄")}</div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p><a class="button button-blue" href="${esc(x.file)}" target="_blank" rel="noopener">Öffnen</a></article>`).join(""):'<div class="empty-state">Derzeit sind noch keine öffentlichen Dokumente freigegeben.</div>'}
function renderFaq(items){qs("#faqList").innerHTML=items.map((x,i)=>`<article class="faq-item"><button aria-expanded="false">${esc(x.question)}<span>＋</span></button><div class="faq-answer">${esc(x.answer)}</div></article>`).join("");qsa(".faq-item button").forEach(b=>b.addEventListener("click",()=>{const item=b.parentElement,open=item.classList.toggle("open");b.setAttribute("aria-expanded",String(open));qs("span",b).textContent=open?"−":"＋"}))}

function bindNavLinks(){const nav=qs("#mainNav");qsa("a",nav).forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")))}
function setupNav(){const toggle=qs("#navToggle"),nav=qs("#mainNav");toggle.addEventListener("click",()=>{const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open))});bindNavLinks();addEventListener("scroll",()=>qs("#siteHeader").classList.toggle("scrolled",scrollY>20),{passive:true})}
function setupReveal(){const obs=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add("visible")}),{threshold:.1});qsa(".reveal").forEach(x=>obs.observe(x))}
function setupPwa(){let prompt;const btn=qs("#installButton");addEventListener("beforeinstallprompt",e=>{e.preventDefault();prompt=e;btn.hidden=false});btn.addEventListener("click",async()=>{if(!prompt)return;prompt.prompt();await prompt.userChoice;prompt=null;btn.hidden=true});if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}))}
init();
