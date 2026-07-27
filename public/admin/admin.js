const readJson = async (url) => {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json();
  } catch (error) {
    console.warn('Admin-Daten konnten nicht geladen werden:', url, error);
    return null;
  }
};

const setCount = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = Number.isFinite(value) ? value : '–';
};

const itemCount = (data, ...keys) => {
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key].length;
  return 0;
};

const normalizeText = value => String(value ?? '').trim();

const isPublished = item => {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.published === 'boolean') return item.published;
  if (typeof item.status === 'string') return item.status.toLowerCase() === 'published';
  return false;
};

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '–';
};

const legalSectionExists = (legal, key, titleNeedle) => {
  const direct = legal?.[key];
  if (direct && typeof direct === 'object') {
    return Boolean(normalizeText(direct.title) || Array.isArray(direct.blocks));
  }
  const collections = [legal?.panels, legal?.sections, legal?.items].filter(Array.isArray);
  return collections.some(list => list.some(entry => {
    const haystack = `${normalizeText(entry?.id)} ${normalizeText(entry?.key)} ${normalizeText(entry?.panel)} ${normalizeText(entry?.title)} ${normalizeText(entry?.label)}`.toLowerCase();
    return haystack.includes(titleNeedle);
  }));
};

const hasCoordinates = place => {
  const position = place?.position || place;
  return Number.isFinite(Number(position?.lat)) && Number.isFinite(Number(position?.lng));
};

const preflightResult = (label, state, detail) => ({ label, state, detail });

const renderPreflight = results => {
  const grid = document.getElementById('preflightGrid');
  const summary = document.getElementById('preflightSummary');
  if (!grid || !summary) return;
  const icon = { ok: '✓', warn: '!', fail: '×' };
  grid.innerHTML = results.map(result => `
    <article class="preflight-item ${result.state}">
      <span class="check-icon" aria-hidden="true">${icon[result.state]}</span>
      <div><strong>${result.label}</strong><small>${result.detail}</small></div>
    </article>`).join('');
  const failed = results.filter(result => result.state === 'fail').length;
  const warnings = results.filter(result => result.state === 'warn').length;
  summary.className = `preflight-summary ${failed ? 'error' : warnings ? 'warning' : 'ready'}`;
  summary.innerHTML = failed
    ? `<span class="check-icon" aria-hidden="true">×</span><div><strong>${failed} Prüfung${failed === 1 ? '' : 'en'} fehlgeschlagen</strong><small>Bitte die rot markierten Bereiche kontrollieren.</small></div>`
    : warnings
      ? `<span class="check-icon" aria-hidden="true">!</span><div><strong>Website einsatzbereit – ${warnings} Hinweis${warnings === 1 ? '' : 'e'}</strong><small>Die gelb markierten Punkte sollten vor der Abreise nochmals geprüft werden.</small></div>`
      : `<span class="check-icon" aria-hidden="true">✓</span><div><strong>Website ist technisch reisebereit</strong><small>Alle automatischen Prüfungen wurden erfolgreich abgeschlossen.</small></div>`;
};

async function loadDashboard() {
  const refresh = document.getElementById('preflightRefresh');
  if (refresh) refresh.disabled = true;
  const [news, program, gallery, downloads, places, faq, diary, legal, site, cms, version, journey] = await Promise.all([
    readJson('/content/news.json'), readJson('/content/program.json'), readJson('/content/gallery.json'),
    readJson('/content/downloads.json'), readJson('/content/places.json'), readJson('/content/faq.json'),
    readJson('/content/diary.json'), readJson('/content/legal.json'), readJson('/content/site.json'),
    readJson('/api/cms-status'), readJson('/version.json'), readJson('/content/journey.json')
  ]);

  setCount('count-news', itemCount(news, 'items', 'news'));
  setCount('count-program', itemCount(program, 'days', 'program'));
  setCount('count-gallery', itemCount(gallery, 'photos'));
  setCount('count-downloads', itemCount(downloads, 'downloads'));
  setCount('count-places', itemCount(places, 'places'));
  setCount('count-faq', itemCount(faq, 'items'));
  const diaryRows = Array.isArray(diary?.entries) ? diary.entries : [];
  const diaryPublished = diaryRows.filter(item => item.published === true);
  const diaryDrafts = diaryRows.filter(item => item.published !== true);
  setCount('count-diary-published', diaryPublished.length);
  setCount('count-diary-drafts', diaryDrafts.length);

  if (version?.version) {
    const values = document.querySelectorAll('.system-strip strong');
    if (values[0]) values[0].textContent = version.version;
    if (values[1] && version.updated) values[1].textContent = version.updated;
  }

  const departure = new Date(site?.departure || '2026-11-21T20:00:00+01:00');
  const returnDate = new Date(site?.returnDate || '2026-11-26T23:59:00+01:00');
  const now = new Date();
  let phase = 'Vor der Reise', phaseDetail = `${Math.max(0, Math.ceil((departure-now)/86400000))} Tage bis zur Abfahrt`;
  if (now >= departure && now <= returnDate) { const day = Math.max(1, Math.min(6, Math.floor((now-departure)/86400000)+1)); phase = `Tag ${day} von 6`; phaseDetail = 'Die Brüsselreise läuft.'; }
  if (now > returnDate) { phase = 'Reise abgeschlossen'; phaseDetail = 'Das Reisetagebuch und die Galerie bleiben erreichbar.'; }
  const phaseEl=document.getElementById('journey-phase'),phaseDetailEl=document.getElementById('journey-detail');if(phaseEl)phaseEl.textContent=phase;if(phaseDetailEl)phaseDetailEl.textContent=phaseDetail;
  const live=site?.liveStatus||{};const autoMode=live.mode!=="manual";const journeyDay=(journey?.days||[]).find(item=>item.date===new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit'}).format(now));const liveTitle=document.getElementById('dashboard-live-title'),liveText=document.getElementById('dashboard-live-text');if(liveTitle)liveTitle.textContent=autoMode?`🤖 Smart Journey: ${journeyDay?.title||phase}`:(live.enabled?`${live.emoji||'📢'} ${live.title||'Aktueller Status'}`:'Manueller Status aus');if(liveText)liveText.textContent=autoMode?(journeyDay?.status||'Der Status wird automatisch aus dem Reiseverlauf erzeugt.'):(live.enabled?(live.text||'Keine Meldung eingetragen.'):'Der manuelle Status ist derzeit ausgeblendet.');
  const latest=[...diaryPublished].sort((a,b)=>`${b.date||''} ${b.time||''}`.localeCompare(`${a.date||''} ${a.time||''}`))[0];const lastTitle=document.getElementById('last-diary-title'),lastDate=document.getElementById('last-diary-date');if(lastTitle)lastTitle.textContent=latest?.title||'Noch keiner';if(lastDate)lastDate.textContent=latest?.date?`Veröffentlicht am ${latest.date}`:'Kein veröffentlichter Eintrag';

  const card = document.querySelector('.status-card');
  const title = card?.querySelector('strong');
  const text = card?.querySelector('small');
  const notice = document.querySelector('.notice p');
  if (cms?.ready) {
    card?.classList.add('ready');
    if (title) title.textContent = 'Redaktion bereit';
    if (text) text.textContent = 'GitHub-Anmeldung ist eingerichtet';
    if (notice) notice.textContent = 'Die Redaktion ist verbunden. Änderungen werden als GitHub-Commit gespeichert und anschließend automatisch über Cloudflare veröffentlicht.';
  } else {
    card?.classList.add('setup');
    if (title) title.textContent = 'Einrichtung erforderlich';
    if (text) text.textContent = 'GitHub OAuth-Zugangsdaten fehlen';
  }

  const files = [news, program, gallery, downloads, places, faq, diary, legal, site, version, journey];
  const placeRows = Array.isArray(places?.places) ? places.places : [];
  const galleryRows = Array.isArray(gallery?.photos) ? gallery.photos : [];
  const publishedDownloads = (downloads?.downloads || []).filter(item => item.published && item.file);
  const programDays = program?.days || program?.program || [];
  const diaryRowsCheck = Array.isArray(diary?.entries) ? diary.entries : [];
  const publishedDiary = diaryRowsCheck.filter(isPublished).length;
  const draftDiary = diaryRowsCheck.length - publishedDiary;
  const hasImpressum = legalSectionExists(legal, 'impressum', 'impressum');
  const hasDatenschutz = legalSectionExists(legal, 'datenschutz', 'datenschutz');
  const missingAlt = galleryRows.filter(item => !normalizeText(item.alt || item.title)).length;

  setText('system-version', version?.version || '–');
  setText('system-updated', version?.updated || version?.date || '–');
  setText('system-status', cms?.ready && files.every(Boolean) ? 'Einsatzbereit' : 'Kontrolle nötig');
  setText('system-diary-published', publishedDiary);
  setText('system-diary-drafts', draftDiary);
  setText('system-gallery', galleryRows.length);
  setText('system-places', placeRows.length);
  setText('system-program', programDays.length);
  setText('system-downloads', publishedDownloads.length);

  renderPreflight([
    preflightResult('Inhaltsdateien erreichbar', files.every(Boolean) ? 'ok' : 'fail', files.every(Boolean) ? 'Alle zentralen JSON-Dateien konnten geladen werden.' : 'Mindestens eine Inhaltsdatei ist nicht erreichbar oder fehlerhaft.'),
    preflightResult('Redaktionszugang', cms?.ready ? 'ok' : 'fail', cms?.ready ? 'GitHub OAuth und CMS-Verbindung sind eingerichtet.' : 'Die CMS-Verbindung ist noch nicht vollständig eingerichtet.'),
    preflightResult('Programm', programDays.length >= 6 ? 'ok' : programDays.length ? 'warn' : 'fail', programDays.length ? `${programDays.length} Reisetage sind eingetragen.` : 'Es wurden keine Reisetage gefunden.'),
    preflightResult('Karte und Marker', placeRows.length && placeRows.every(hasCoordinates) ? 'ok' : placeRows.length ? 'warn' : 'fail', placeRows.length ? `${placeRows.filter(hasCoordinates).length} von ${placeRows.length} Orten besitzen gültige Koordinaten.` : 'Es wurden keine Kartenorte gefunden.'),
    preflightResult('Galerie und Alternativtexte', galleryRows.length && missingAlt === 0 ? 'ok' : galleryRows.length ? 'warn' : 'fail', galleryRows.length ? (missingAlt ? `${galleryRows.length} Fotos geprüft; bei ${missingAlt} Foto${missingAlt === 1 ? '' : 's'} fehlt ein Alternativtext.` : `${galleryRows.length} Fotos geprüft; alle besitzen einen Alternativtext.`) : 'Die Galerie enthält noch keine Fotos.'),
    preflightResult('Öffentliche Downloads', publishedDownloads.length ? 'ok' : 'warn', publishedDownloads.length ? `${publishedDownloads.length} Dokument${publishedDownloads.length === 1 ? '' : 'e'} veröffentlicht.` : 'Derzeit ist kein Download veröffentlicht.'),
    preflightResult('Impressum und Datenschutz', hasImpressum && hasDatenschutz ? 'ok' : 'fail', hasImpressum && hasDatenschutz ? 'Impressum und Datenschutzerklärung wurden erkannt.' : `${hasImpressum ? '' : 'Impressum fehlt oder ist nicht lesbar. '}${hasDatenschutz ? '' : 'Datenschutz fehlt oder ist nicht lesbar.'}`.trim()),
    preflightResult('Smart Journey', journey?.enabled && Array.isArray(journey?.days) && journey.days.length >= 6 ? 'ok' : 'warn', journey?.enabled ? `${journey.days?.length||0} automatische Reisetage konfiguriert.` : 'Smart Journey ist deaktiviert.'),
    preflightResult('Versionsstand', version?.version === '10.8.2' ? 'ok' : 'warn', version?.version ? `Aktuell veröffentlichte Version: ${version.version}.` : 'Versionsinformation konnte nicht geladen werden.')
  ]);
  if (refresh) refresh.disabled = false;
}

document.getElementById('preflightRefresh')?.addEventListener('click', loadDashboard);
loadDashboard();
initJourneySimulator();


const JOURNEY_PREVIEW_KEY = 'bsr-smart-journey-preview';
const previewDateLabel = value => value ? value.split('-').reverse().join('.') : '–';
function loadJourneyPreview(){
  try{return JSON.parse(localStorage.getItem(JOURNEY_PREVIEW_KEY)||'null')}catch{return null}
}
function setJourneyPreviewStatus(preview){
  const status=document.getElementById('journeyPreviewStatus');if(!status)return;
  if(preview?.enabled&&preview.date){status.classList.add('active');status.textContent=`Simulation aktiv: Die Website simuliert den ${previewDateLabel(preview.date)} – nur in diesem Browser.`}
  else{status.classList.remove('active');status.textContent='Simulation ist deaktiviert. Besucher sehen das echte Datum.'}
}
async function initJourneySimulator(){
  const enabled=document.getElementById('journeyPreviewEnabled'),date=document.getElementById('journeyPreviewDate'),preset=document.getElementById('journeyPreviewPreset');
  if(!enabled||!date||!preset)return;
  const journey=await readJson('/content/journey.json');if(!journey)return;
  const start=String(journey.trip?.start||'').slice(0,10),end=String(journey.trip?.end||'').slice(0,10);
  const dayBefore=start?new Date(`${start}T12:00:00`):null;if(dayBefore)dayBefore.setDate(dayBefore.getDate()-1);
  const dayAfter=end?new Date(`${end}T12:00:00`):null;if(dayAfter)dayAfter.setDate(dayAfter.getDate()+1);
  const iso=d=>d&&!Number.isNaN(d.getTime())?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:'';
  const options=[];if(dayBefore)options.push([iso(dayBefore),'⏳ Vor der Reise']);
  (journey.days||[]).forEach(item=>options.push([String(item.date||'').slice(0,10),`${item.emoji||'📅'} ${item.title||item.date}`]));
  if(dayAfter)options.push([iso(dayAfter),'🎉 Nach der Reise']);
  preset.insertAdjacentHTML('beforeend',options.filter(x=>x[0]).map(([value,label])=>`<option value="${value}">${label} · ${previewDateLabel(value)}</option>`).join(''));
  const current=loadJourneyPreview();const details=document.getElementById("journeySimulatorDetails");if(current?.enabled&&details)details.open=true;enabled.checked=Boolean(current?.enabled);date.value=current?.date||start||'';preset.value=current?.date||'';setJourneyPreviewStatus(current);
  preset.addEventListener('change',()=>{if(preset.value)date.value=preset.value});date.addEventListener('change',()=>{preset.value=[...preset.options].some(o=>o.value===date.value)?date.value:''});
  document.getElementById('journeyPreviewApply')?.addEventListener('click',()=>{if(!date.value){setJourneyPreviewStatus(null);return}const value={enabled:enabled.checked,date:date.value};if(value.enabled)localStorage.setItem(JOURNEY_PREVIEW_KEY,JSON.stringify(value));else localStorage.removeItem(JOURNEY_PREVIEW_KEY);setJourneyPreviewStatus(value.enabled?value:null)});
  document.getElementById('journeyPreviewClear')?.addEventListener('click',()=>{localStorage.removeItem(JOURNEY_PREVIEW_KEY);enabled.checked=false;setJourneyPreviewStatus(null)});
}
