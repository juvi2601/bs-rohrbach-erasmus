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

Promise.all([
  readJson('/content/news.json'),
  readJson('/content/program.json'),
  readJson('/content/gallery.json'),
  readJson('/content/downloads.json'),
  readJson('/content/places.json'),
  readJson('/content/faq.json'),
  readJson('/api/cms-status'),
  readJson('/version.json')
]).then(([news, program, gallery, downloads, places, faq, cms, version]) => {
  setCount('count-news', Array.isArray(news?.items) ? news.items.length : Array.isArray(news?.news) ? news.news.length : 0);
  setCount('count-program', Array.isArray(program?.days) ? program.days.length : Array.isArray(program?.program) ? program.program.length : 0);
  setCount('count-gallery', Array.isArray(gallery?.photos) ? gallery.photos.length : 0);
  setCount('count-downloads', Array.isArray(downloads?.downloads) ? downloads.downloads.length : 0);
  setCount('count-places', Array.isArray(places?.places) ? places.places.length : 0);
  setCount('count-faq', Array.isArray(faq?.items) ? faq.items.length : 0);

  if (version?.version) {
    const values = document.querySelectorAll('.system-strip strong');
    if (values[0]) values[0].textContent = version.version;
    if (values[1] && version.updated) values[1].textContent = version.updated;
  }

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
});
