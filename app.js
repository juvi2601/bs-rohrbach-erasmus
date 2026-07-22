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
  if(places.status==="fulfilled")renderMap(places.value.places||[]);
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


function eventIcon(event){
  const text=`${event.title||''} ${event.text||''}`.toLowerCase();
  if(/bus|abfahrt|ankunft|heimreise|rückfahrt|fahrt/.test(text)) return '🚌';
  if(/hotel|check-in|check in|zimmer|frühstück/.test(text)) return '🏨';
  if(/parlament|kommission|europäisch|vertretung|vortrag/.test(text)) return '🇪🇺';
  if(/antwerpen|hafen|diamant|rundfahrt|stadtführung/.test(text)) return '⚓';
  if(/essen|mittag|abendessen|pommes|waffel|restaurant/.test(text)) return '🍽️';
  if(/freizeit|shopping|bummeln|zentrum|grand.place|sightseeing/.test(text)) return '📍';
  if(/museum|parlamentarium|atomium|waterloo/.test(text)) return '🏛️';
  return '✦';
}

function renderProgram(days){
  const tabs=qs("#dayTabs"),panels=qs("#dayPanels");
  const eventCount=day=>(day.events||[]).length;
  const totalEvents=days.reduce((sum,day)=>sum+eventCount(day),0);
  const statusCount=(day,status)=>(day.events||[]).filter(event=>event.status===status).length;
  const firstTime=day=>((day.events||[])[0]||{}).time||"–";
  const lastTime=day=>((day.events||[]).slice(-1)[0]||{}).time||"–";

  tabs.innerHTML=days.map((d,i)=>`<button class="day-tab ${i===0?'active':''}" data-day="${esc(d.id)}" role="tab" aria-controls="day-${esc(d.id)}" aria-selected="${i===0}">
    <span class="day-tab-index">${String(i+1).padStart(2,'0')}</span>
    <span class="day-tab-weekday">${esc(d.short)}</span>
    <span class="day-tab-date">${esc(d.date)}</span>
    <span class="day-tab-title">${esc(d.title)}</span>
    <span class="day-tab-count">${eventCount(d)} Stopps</span>
  </button>`).join("");

  panels.innerHTML=days.map((d,i)=>{
    const events=d.events||[];
    const dayLabel=Number(d.dayNumber)===0?'Anreisetag':`Reisetag ${Number(d.dayNumber)||i}`;
    const confirmed=statusCount(d,'confirmed');
    const pending=statusCount(d,'pending');
    const progress=Math.round(((i+1)/days.length)*100);
    return `<article class="day-panel ${i===0?'active':''}" id="day-${esc(d.id)}" role="tabpanel" aria-label="${esc(d.short)} ${esc(d.date)} – ${esc(d.title)}">
      <header class="day-cover ${d.cover?'photo-cover':''}" ${d.cover?`style="--bg:url('${esc(d.cover)}')"`:''}>
        <div class="day-cover-topline"><span>${esc(dayLabel)}</span><span>Etappe ${i+1} von ${days.length}</span></div>
        <div class="day-cover-content">
          <p class="day-date-large">${esc(d.short)} · ${esc(d.date)}2026</p>
          <h3>${esc(d.title)}</h3>
          <p>${esc(d.subtitle)}</p>
          <div class="day-cover-chips">
            <span>⏱ ${esc(firstTime(d))} – ${esc(lastTime(d))}</span>
            <span>📍 ${events.length} ${events.length===1?'Programmpunkt':'Programmpunkte'}</span>
            ${confirmed?`<span class="chip-confirmed">✓ ${confirmed} bestätigt</span>`:''}
            ${pending?`<span class="chip-pending">○ ${pending} offen</span>`:''}
          </div>
        </div>
        ${d.icon?`<span class="day-icon" aria-hidden="true">${esc(d.icon)}</span>`:''}
      </header>

      ${(d.gallery||[]).length?`<div class="day-photo-strip">${d.gallery.map((x,j)=>`<figure><img src="${esc(x)}" alt="${esc(d.title)} – Eindruck ${j+1}" loading="lazy"><figcaption>${String(j+1).padStart(2,'0')}</figcaption></figure>`).join("")}</div>`:''}

      <div class="trip-progress" aria-label="Fortschritt innerhalb der Reise">
        <div class="trip-progress-copy"><span>Reiseverlauf</span><strong>${progress}%</strong></div>
        <div class="trip-progress-track"><span style="width:${progress}%"></span></div>
        <small>${i===0?'Abfahrt':i===days.length-1?'Heimreise':`${days.length-i-1} Reisetage folgen`}</small>
      </div>

      <div class="program-overview">
        <div><span class="overview-label">Datum</span><strong>${esc(d.short)}, ${esc(d.date)}2026</strong></div>
        <div><span class="overview-label">Tagesfokus</span><strong>${esc(d.title)}</strong></div>
        <div><span class="overview-label">Reise gesamt</span><strong>${totalEvents} Programmpunkte</strong></div>
      </div>

      <div class="timeline-heading"><div><span class="eyebrow">Tagesablauf</span><h4>Unser Programm im Überblick</h4></div><span>${events.length} Stopps</span></div>
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

  qsa(".day-tab",tabs).forEach(btn=>btn.addEventListener("click",()=>activateDay(btn.dataset.day,true)));
  qsa(".program-pager-button",panels).forEach(btn=>btn.addEventListener("click",()=>{if(btn.dataset.target)activateDay(btn.dataset.target,true)}));
}

function activateDay(id,scroll=false){
  qsa(".day-tab").forEach(b=>{const on=b.dataset.day===id;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on));if(on)b.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})});
  qsa(".day-panel").forEach(p=>p.classList.toggle("active",p.id===`day-${id}`));
  if(scroll){const section=qs('#programm');if(section)window.scrollTo({top:section.offsetTop+110,behavior:'smooth'})}
}

function renderToday(days){const site=window.__SITE||{};const t=site.today||{};const now=new Date(),start=new Date(site.departure||"2026-11-21T20:00:00+01:00"),end=new Date(site.returnDate||"2026-11-26T23:59:00+01:00");let pct=0,label="Vorfreude",day=null;if(now>=start&&now<=end){pct=Math.min(100,Math.max(0,(now-start)/(end-start)*100));label=`Tag ${Math.max(1,Math.ceil((now-start)/86400000))} von 5`;const ids=["sa","so","mo","di","mi","do"];day=days.find(d=>d.id===ids[Math.min(ids.length-1,Math.floor((now-start)/86400000))])}else if(now>end){pct=100;label=t.afterLabel||"Reise abgeschlossen"}qs("#progressBar").style.width=`${pct}%`;qs("#progressValue").textContent=`${Math.round(pct)} %`;qs("#progressLabel").textContent=label;if(day){qs("#todayTitle").textContent=day.title;qs("#todayText").textContent=day.subtitle;qs("#progressDate").textContent=`${day.short}, ${day.date}`;qs("#todaySchedule").innerHTML=(day.events||[]).slice(0,3).map(e=>`<article class="today-item"><time>${esc(e.time)}</time><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></article>`).join("");activateDay(day.id)}else if(now>end){qs("#todayTitle").textContent=t.afterTitle||"Schöne Erinnerungen an Brüssel";qs("#todayText").textContent=t.afterText||"Die Reise ist abgeschlossen. Die geschützte Galerie bleibt für die Reisegruppe erreichbar."}}

function renderMap(places){
  const canvas=qs("#map"),list=qs("#placeList"),legend=qs("#mapLegend");
  if(!window.L||!places.length){canvas.innerHTML='<div class="empty-state">Karte konnte nicht geladen werden.</div>';return}

  const categories={
    "Hotel":{color:"#e63946",icon:"H"},
    "EU":{color:"#1557b0",icon:"EU"},
    "Sehenswürdigkeit":{color:"#7b2cbf",icon:"★"},
    "Metro":{color:"#f59e0b",icon:"M"},
    "Essen":{color:"#16a34a",icon:"🍴"},
    "Notfall":{color:"#dc2626",icon:"!"},
    "Antwerpen":{color:"#0f766e",icon:"A"},
    "Waterloo":{color:"#64748b",icon:"W"}
  };
  const styleFor=cat=>categories[cat]||{color:"#334155",icon:"•"};
  const markerIcon=cat=>{const c=styleFor(cat);return L.divIcon({className:"travel-marker-wrap",html:`<span class="travel-marker" style="--marker:${c.color}"><b>${esc(c.icon)}</b></span>`,iconSize:[38,46],iconAnchor:[19,43],popupAnchor:[0,-40]})};
  const map=L.map("map",{scrollWheelZoom:false,zoomControl:true}).setView([50.8503,4.3517],13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);

  const brusselsBounds=[];
  const allBounds=[];
  const markers=[];
  const categoryOrder=[...new Set(places.map(p=>p.category))];
  legend.innerHTML=categoryOrder.map(cat=>{const c=styleFor(cat);return `<span class="legend-item"><i style="--legend:${c.color}"></i>${esc(cat)}</span>`}).join("");

  list.innerHTML=places.map((p,i)=>{const c=styleFor(p.category);return `<article class="place-card" data-place="${i}" tabindex="0" role="button" aria-label="${esc(p.title)} auf der Karte anzeigen"><img src="${esc(p.image)}" alt="${esc(p.title)}"><div class="place-card-copy"><span class="place-category" style="--category:${c.color}">${esc(p.category)}</span><h3>${esc(p.title)}</h3><small>${esc(p.walk||p.address||"")}</small></div><span class="place-arrow" aria-hidden="true">›</span></article>`}).join("");

  places.forEach((p,i)=>{
    const point=[Number(p.lat),Number(p.lng)];allBounds.push(point);
    if(point[0]>50.80&&point[0]<50.93&&point[1]>4.28&&point[1]<4.45)brusselsBounds.push(point);
    const route=p.maps||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address||p.title)}`;
    const popup=`<div class="travel-popup"><img src="${esc(p.image)}" alt="${esc(p.title)}"><div class="travel-popup-body"><span class="popup-category">${esc(p.category)}</span><h3>${esc(p.title)}</h3><p>${esc(p.description||"")}</p><div class="popup-address">📍 ${esc(p.address||"")}</div>${p.walk?`<div class="popup-distance">🚶 ${esc(p.walk)}</div>`:""}<a class="popup-route" href="${esc(route)}" target="_blank" rel="noopener">Route öffnen ↗</a></div></div>`;
    const marker=L.marker(point,{icon:markerIcon(p.category),title:p.title}).addTo(map).bindPopup(popup,{maxWidth:320,minWidth:270});
    marker.on("click",()=>setActive(i));markers.push(marker);
  });

  function setActive(index){qsa(".place-card",list).forEach((card,i)=>card.classList.toggle("active",i===index));const card=qsa(".place-card",list)[index];if(card)card.scrollIntoView({block:"nearest",behavior:"smooth"})}
  function openPlace(index){const marker=markers[index];if(!marker)return;setActive(index);map.flyTo(marker.getLatLng(),15,{duration:.7});marker.openPopup()}
  qsa(".place-card",list).forEach(card=>{const open=()=>openPlace(Number(card.dataset.place));card.addEventListener("click",open);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}})});
  const showBrussels=()=>{if(brusselsBounds.length)map.fitBounds(brusselsBounds,{padding:[45,45],maxZoom:14});else map.setView([50.8503,4.3517],13)};
  qs("#mapReset")?.addEventListener("click",showBrussels);
  showBrussels();
  setTimeout(()=>map.invalidateSize(),150);
}

async function loadWeather(places=[]){
  const primary=places[0]||{name:"Brüssel",lat:50.8503,lon:4.3517};
  const current=qs("#weatherCurrent"),forecast=qs("#weatherForecast");
  try{
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${primary.lat}&longitude=${primary.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=Europe%2FBrussels`;
    const x=await(await fetch(u)).json(),c=x.current||{},w=weatherInfo(c.weather_code),d=x.daily||{};
    const tip=weatherTip({temperature:c.temperature_2m,wind:c.wind_speed_10m,precipitation:(d.precipitation_probability_max||[])[0],code:c.weather_code});
    current.innerHTML=`<article class="weather-card weather-now"><div><small>📍 Heute in ${esc(primary.name)}</small><strong>${Math.round(c.temperature_2m??0)} °C</strong><span>Gefühlt ${Math.round(c.apparent_temperature??0)} °C · Wind ${Math.round(c.wind_speed_10m??0)} km/h</span><span>${w.text}</span><div class="weather-tip"><b>💡 Reisetipp</b><span>${esc(tip)}</span></div></div><div class="weather-icon">${w.icon}</div></article>`;
    const labels=["Heute","Morgen","Übermorgen"];
    forecast.innerHTML=(d.time||[]).slice(0,4).map((day,i)=>{const info=weatherInfo((d.weather_code||[])[i]);const label=labels[i]||new Intl.DateTimeFormat("de-AT",{weekday:"long"}).format(new Date(day+"T12:00:00"));return `<article class="forecast-day"><small>${esc(label)}</small><div class="forecast-icon">${info.icon}</div><strong>${Math.round((d.temperature_2m_max||[])[i]??0)}°</strong><span>${Math.round((d.temperature_2m_min||[])[i]??0)}° min</span><span>${Math.round((d.precipitation_probability_max||[])[i]??0)} % Regen</span><b>${info.text}</b></article>`}).join("");
  }catch{current.innerHTML='<div class="empty-state">Wetterdaten sind derzeit nicht verfügbar.</div>';forecast.innerHTML=""}
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
