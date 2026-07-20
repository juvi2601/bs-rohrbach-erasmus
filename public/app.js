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
  setText("heroEyebrow",site.heroEyebrow);setText("heroTitle",site.heroTitle||site.tripTitle);setText("heroSubtitle",site.subtitle);
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

function renderProgram(days){const tabs=qs("#dayTabs"),panels=qs("#dayPanels");tabs.innerHTML=days.map((d,i)=>`<button class="day-tab ${i===0?'active':''}" data-day="${esc(d.id)}" role="tab" aria-selected="${i===0}"><b>${esc(d.short)}</b><span>${esc(d.date)}</span></button>`).join("");panels.innerHTML=days.map((d,i)=>`<article class="day-panel ${i===0?'active':''}" id="day-${esc(d.id)}" role="tabpanel"><div class="day-cover ${d.cover?'photo-cover':''}" ${d.cover?`style="--bg:url('${esc(d.cover)}')"`:''}><div><small>Tag ${Number(d.dayNumber)||0}</small><h3>${esc(d.title)}</h3><p>${esc(d.subtitle)}</p></div>${d.icon?`<span class="day-icon">${esc(d.icon)}</span>`:''}</div>${(d.gallery||[]).length?`<div class="gallery-row">${d.gallery.map((x,j)=>`<img src="${esc(x)}" alt="${esc(d.title)} ${j+1}" loading="lazy">`).join("")}</div>`:''}<div class="timeline">${(d.events||[]).map(e=>`<div class="timeline-row ${e.status==='pending'?'pending':''}"><time>${esc(e.time)}</time><div><h4>${esc(e.title)}</h4><p>${esc(e.text)}</p>${e.status?`<span class="badge ${esc(e.status)}">${e.status==='confirmed'?'bereits gebucht':'noch nicht bestätigt'}</span>`:''}</div></div>`).join("")}</div></article>`).join("");qsa(".day-tab",tabs).forEach(btn=>btn.addEventListener("click",()=>activateDay(btn.dataset.day)))}
function activateDay(id){qsa(".day-tab").forEach(b=>{const on=b.dataset.day===id;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on))});qsa(".day-panel").forEach(p=>p.classList.toggle("active",p.id===`day-${id}`))}

function renderToday(days){const site=window.__SITE||{};const t=site.today||{};const now=new Date(),start=new Date(site.departure||"2026-11-21T20:00:00+01:00"),end=new Date(site.returnDate||"2026-11-26T23:59:00+01:00");let pct=0,label="Vorfreude",day=null;if(now>=start&&now<=end){pct=Math.min(100,Math.max(0,(now-start)/(end-start)*100));label=`Tag ${Math.max(1,Math.ceil((now-start)/86400000))} von 5`;const ids=["sa","so","mo","di","mi","do"];day=days.find(d=>d.id===ids[Math.min(ids.length-1,Math.floor((now-start)/86400000))])}else if(now>end){pct=100;label=t.afterLabel||"Reise abgeschlossen"}qs("#progressBar").style.width=`${pct}%`;qs("#progressValue").textContent=`${Math.round(pct)} %`;qs("#progressLabel").textContent=label;if(day){qs("#todayTitle").textContent=day.title;qs("#todayText").textContent=day.subtitle;qs("#progressDate").textContent=`${day.short}, ${day.date}`;qs("#todaySchedule").innerHTML=(day.events||[]).slice(0,3).map(e=>`<article class="today-item"><time>${esc(e.time)}</time><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></article>`).join("");activateDay(day.id)}else if(now>end){qs("#todayTitle").textContent=t.afterTitle||"Schöne Erinnerungen an Brüssel";qs("#todayText").textContent=t.afterText||"Die Reise ist abgeschlossen. Die geschützte Galerie bleibt für die Reisegruppe erreichbar."}}

function renderMap(places){if(!window.L||!places.length){qs("#map").innerHTML='<div class="empty-state">Karte konnte nicht geladen werden.</div>';return}const map=L.map("map",{scrollWheelZoom:false}).setView([50.85,4.36],12);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);const bounds=[];const list=qs("#placeList");list.innerHTML=places.map((p,i)=>`<article class="place-card" data-place="${i}" tabindex="0"><img src="${esc(p.image)}" alt="${esc(p.title)}"><div><small>${esc(p.category)}</small><h3>${esc(p.title)}</h3><small>${esc(p.walk)}</small></div></article>`).join("");const markers=places.map(p=>{bounds.push([p.lat,p.lng]);return L.marker([p.lat,p.lng]).addTo(map).bindPopup(`<img src="${esc(p.image)}" alt=""><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><small>${esc(p.address)} · ${esc(p.walk)}</small><p><a href="${esc(p.maps)}" target="_blank" rel="noopener"><b>Google Maps öffnen</b></a></p>`) });qsa(".place-card",list).forEach(card=>{const open=()=>{const i=Number(card.dataset.place);map.setView(markers[i].getLatLng(),14,{animate:true});markers[i].openPopup()};card.addEventListener("click",open);card.addEventListener("keydown",e=>{if(e.key==="Enter")open()})});if(bounds.length)map.fitBounds(bounds,{padding:[25,25]})}

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
