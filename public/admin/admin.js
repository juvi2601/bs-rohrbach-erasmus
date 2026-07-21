const readJson = async (url) => {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json();
  } catch (error) {
    console.warn('Admin-Zähler konnten nicht geladen werden:', url, error);
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
  readJson('/content/downloads.json')
]).then(([news, program, gallery, downloads]) => {
  setCount('count-news', Array.isArray(news?.items) ? news.items.length : Array.isArray(news?.news) ? news.news.length : 0);
  setCount('count-program', Array.isArray(program?.days) ? program.days.length : Array.isArray(program?.program) ? program.program.length : 0);
  setCount('count-gallery', Array.isArray(gallery?.photos) ? gallery.photos.length : 0);
  setCount('count-downloads', Array.isArray(downloads?.downloads) ? downloads.downloads.length : 0);
});
