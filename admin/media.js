const sources = [
  { url: '/content/site.json', area: 'Startseite', collect: collectSite },
  { url: '/content/program.json', area: 'Programm', collect: collectProgram },
  { url: '/content/gallery.json', area: 'Galerie', collect: collectGallery },
  { url: '/content/places.json', area: 'Karte & Orte', collect: collectPlaces }
];
let mediaItems = [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fileName = path => decodeURIComponent(String(path || '').split('/').pop() || path || '');
const add = (list, image, title, area, credit = '', alt = '') => { if (image) list.push({ image, title: title || fileName(image), area, credit, alt }); };
function collectSite(data, area) {
  const out=[]; add(out,data.hero,'Großes Titelbild',area,'',data.heroTitle); add(out,data.hotel?.image,'Hotel',area,'',data.hotel?.name);
  (data.culinary?.items||[]).forEach(x=>add(out,x.image,x.title,'Kulinarik',x.imageCredit,x.alt));
  return out;
}
function collectProgram(data) { const out=[]; (data.days||[]).forEach(d=>{add(out,d.cover,`${d.short||''} – ${d.title}`,'Programm','',d.title); (d.gallery||[]).forEach((img,i)=>add(out,img,`${d.title} – Bild ${i+1}`,'Programm'));}); return out; }
function collectGallery(data) { const out=[]; (data.photos||[]).forEach(p=>add(out,p.image,p.title,'Galerie',p.imageCredit,p.alt||p.title)); return out; }
function collectPlaces(data) { const out=[]; (data.places||[]).forEach(p=>add(out,p.image,p.title,'Karte & Orte',p.imageCredit,p.title)); return out; }
async function load() {
  const results = await Promise.all(sources.map(async s => { try { const r=await fetch(s.url,{cache:'no-store'}); if(!r.ok) return []; return s.collect(await r.json(),s.area); } catch { return []; } }));
  mediaItems = results.flat();
  const areas=[...new Set(mediaItems.map(x=>x.area))].sort();
  document.querySelector('#media-filter').insertAdjacentHTML('beforeend',areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join(''));
  const unique=new Set(mediaItems.map(x=>x.image)); const uploads=[...unique].filter(x=>x.includes('/images/uploads/')).length;
  document.querySelector('#media-total').textContent=`${unique.size} unterschiedliche Bilder`;
  document.querySelector('#media-uploaded').textContent=`${uploads} davon aus der CMS-Mediathek`;
  render();
}
function render(){
  const q=document.querySelector('#media-search').value.trim().toLowerCase(); const filter=document.querySelector('#media-filter').value;
  const rows=mediaItems.filter(x=>(filter==='all'||x.area===filter)&&(!q||`${x.title} ${x.area} ${x.image} ${x.credit}`.toLowerCase().includes(q)));
  document.querySelector('#media-result-count').textContent=`${rows.length} Verwendung${rows.length===1?'':'en'}`;
  const grid=document.querySelector('#media-grid');
  grid.innerHTML=rows.length?rows.map((x,i)=>`<article class="media-card"><div class="media-preview"><img src="${esc(x.image)}" alt="${esc(x.alt||x.title)}" loading="lazy" onerror="this.closest('.media-preview').classList.add('broken')"><span>${esc(x.area)}</span></div><div class="media-card-body"><h3>${esc(x.title)}</h3><code title="${esc(x.image)}">${esc(x.image)}</code>${x.credit?`<p class="media-credit">${esc(x.credit)}</p>`:'<p class="media-credit missing">Kein Bildnachweis eingetragen</p>'}<button type="button" class="copy-path" data-path="${esc(x.image)}">Pfad kopieren</button></div></article>`).join(''):'<div class="empty-state">Keine passenden Bilder gefunden.</div>';
  grid.querySelectorAll('.copy-path').forEach(btn=>btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(btn.dataset.path);btn.textContent='Kopiert ✓';setTimeout(()=>btn.textContent='Pfad kopieren',1600)}catch{btn.textContent='Kopieren nicht möglich'}}));
}
document.querySelector('#media-search').addEventListener('input',render); document.querySelector('#media-filter').addEventListener('change',render); load();
