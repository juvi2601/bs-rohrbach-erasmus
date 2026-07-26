const sources = [
  { url: '/content/site.json', area: 'Startseite', collect: collectSite },
  { url: '/content/program.json', area: 'Programm', collect: collectProgram },
  { url: '/content/gallery.json', area: 'Galerie', collect: collectGallery },
  { url: '/content/places.json', area: 'Karte & Orte', collect: collectPlaces }
];
let mediaItems = [];
let mediaGroups = new Map();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fileName = path => decodeURIComponent(String(path || '').split('/').pop() || path || '');
const extension = path => (fileName(path).split('.').pop() || 'Datei').toUpperCase();
const add = (list, image, title, area, credit = '', alt = '') => { if (image) list.push({ image, title: title || fileName(image), area, credit, alt }); };
function collectSite(data, area) {
  const out=[]; add(out,data.hero,'Großes Titelbild',area,'',data.heroTitle); add(out,data.hotel?.image,'Hotel',area,'',data.hotel?.name);
  (data.culinary?.items||[]).forEach(x=>add(out,x.image,x.title,'Kulinarik',x.imageCredit,x.alt));
  return out;
}
function collectProgram(data) { const out=[]; (data.days||[]).forEach(d=>{add(out,d.cover,`${d.short||''} – ${d.title}`,'Programm','',d.title); (d.gallery||[]).forEach((img,i)=>add(out,img,`${d.title} – Bild ${i+1}`,'Programm'));}); return out; }
function collectGallery(data) { const out=[]; (data.photos||[]).forEach(p=>add(out,p.image,p.title,'Galerie',p.imageCredit,p.alt||p.title)); return out; }
function collectPlaces(data) { const out=[]; (data.places||[]).forEach(p=>add(out,p.image,p.title,'Karte & Orte',p.imageCredit,p.title)); return out; }
function rebuildGroups(){
  mediaGroups = new Map();
  mediaItems.forEach(item => {
    if (!mediaGroups.has(item.image)) mediaGroups.set(item.image, []);
    mediaGroups.get(item.image).push(item);
  });
}
async function load() {
  const results = await Promise.all(sources.map(async s => { try { const r=await fetch(s.url,{cache:'no-store'}); if(!r.ok) return []; return s.collect(await r.json(),s.area); } catch { return []; } }));
  mediaItems = results.flat();
  rebuildGroups();
  const areas=[...new Set(mediaItems.map(x=>x.area))].sort();
  document.querySelector('#media-filter').insertAdjacentHTML('beforeend',areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join(''));
  const uploads=[...mediaGroups.keys()].filter(x=>x.includes('/images/uploads/')).length;
  document.querySelector('#media-total').textContent=`${mediaGroups.size} Bilder verfügbar`;
  document.querySelector('#media-uploaded').textContent=`${mediaItems.length} Verwendungen · ${uploads} CMS-Upload${uploads===1?'':'s'}`;
  render();
}
function render(){
  const q=document.querySelector('#media-search').value.trim().toLowerCase(); const filter=document.querySelector('#media-filter').value;
  const rows=mediaItems.filter(x=>(filter==='all'||x.area===filter)&&(!q||`${x.title} ${x.area} ${x.image} ${x.credit}`.toLowerCase().includes(q)));
  document.querySelector('#media-result-count').textContent=`${rows.length} Verwendung${rows.length===1?'':'en'}`;
  const grid=document.querySelector('#media-grid');
  grid.innerHTML=rows.length?rows.map((x,i)=>{
    const uses=mediaGroups.get(x.image)?.length||1;
    return `<article class="media-card" tabindex="0" role="button" data-media-index="${mediaItems.indexOf(x)}" aria-label="Details zu ${esc(x.title)} öffnen"><div class="media-preview"><img src="${esc(x.image)}" alt="${esc(x.alt||x.title)}" loading="lazy" onerror="this.closest('.media-preview').classList.add('broken')"><span>${esc(x.area)}</span>${uses>1?`<b class="usage-badge">${uses}× verwendet</b>`:''}</div><div class="media-card-body"><h3>${esc(x.title)}</h3><code title="${esc(x.image)}">${esc(x.image)}</code>${x.credit?`<p class="media-credit">${esc(x.credit)}</p>`:'<p class="media-credit missing">Kein Bildnachweis eingetragen</p>'}<div class="media-card-actions"><button type="button" class="details-button">Details</button><button type="button" class="copy-path" data-path="${esc(x.image)}">Pfad kopieren</button></div></div></article>`;
  }).join(''):'<div class="empty-state">Keine passenden Bilder gefunden.</div>';
  grid.querySelectorAll('.copy-path').forEach(btn=>btn.addEventListener('click',async e=>{e.stopPropagation();try{await navigator.clipboard.writeText(btn.dataset.path);btn.textContent='Kopiert ✓';setTimeout(()=>btn.textContent='Pfad kopieren',1600)}catch{btn.textContent='Kopieren nicht möglich'}}));
  grid.querySelectorAll('.media-card').forEach(card=>{
    const open=()=>openDetails(mediaItems[Number(card.dataset.mediaIndex)]);
    card.addEventListener('click',e=>{if(!e.target.closest('button'))open()});
    card.querySelector('.details-button')?.addEventListener('click',e=>{e.stopPropagation();open()});
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  });
}
function openDetails(item){
  const modal=document.querySelector('#media-modal');
  const uses=mediaGroups.get(item.image)||[item];
  document.querySelector('#modal-image').src=item.image;
  document.querySelector('#modal-image').alt=item.alt||item.title;
  document.querySelector('#modal-title').textContent=fileName(item.image);
  document.querySelector('#modal-path').textContent=item.image;
  document.querySelector('#modal-type').textContent=extension(item.image);
  document.querySelector('#modal-dimensions').textContent='wird ermittelt …';
  document.querySelector('#modal-size').textContent='wird ermittelt …';
  document.querySelector('#modal-warning').hidden=uses.length<2;
  document.querySelector('#modal-warning-text').textContent=`Dieses Bild wird an ${uses.length} Stellen verwendet. Änderungen wirken sich auf alle diese Bereiche aus.`;
  document.querySelector('#modal-usages').innerHTML=uses.map(u=>`<li><strong>${esc(u.area)}</strong><span>${esc(u.title)}</span>${u.credit?`<small>Nachweis: ${esc(u.credit)}</small>`:'<small class="missing">Kein Bildnachweis</small>'}</li>`).join('');
  document.querySelector('#modal-copy').dataset.path=item.image;
  modal.showModal();
  const probe=new Image();
  probe.onload=()=>document.querySelector('#modal-dimensions').textContent=`${probe.naturalWidth} × ${probe.naturalHeight} px`;
  probe.onerror=()=>document.querySelector('#modal-dimensions').textContent='nicht verfügbar';
  probe.src=item.image;
  fetch(item.image,{method:'HEAD',cache:'no-store'}).then(r=>{
    const bytes=Number(r.headers.get('content-length'));
    document.querySelector('#modal-size').textContent=bytes?formatBytes(bytes):'nicht verfügbar';
  }).catch(()=>document.querySelector('#modal-size').textContent='nicht verfügbar');
}
function formatBytes(bytes){ if(bytes<1024)return `${bytes} B`; if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`; return `${(bytes/1024/1024).toFixed(2)} MB`; }
function closeModal(){document.querySelector('#media-modal').close();}
document.querySelector('#media-search').addEventListener('input',render);
document.querySelector('#media-filter').addEventListener('change',render);
document.querySelector('#modal-close').addEventListener('click',closeModal);
document.querySelector('#media-modal').addEventListener('click',e=>{if(e.target.id==='media-modal')closeModal();});
document.querySelector('#modal-copy').addEventListener('click',async e=>{try{await navigator.clipboard.writeText(e.currentTarget.dataset.path);e.currentTarget.textContent='Pfad kopiert ✓';setTimeout(()=>e.currentTarget.textContent='Pfad kopieren',1500)}catch{e.currentTarget.textContent='Kopieren nicht möglich'}});
load();
