const MAX_FILES = 10;
const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MIN_RECOMMENDED_WIDTH = 1000;
let selected = [];
let isUploading = false;
const $ = id => document.getElementById(id);

$('loginButton').addEventListener('click', () => {
  $('loginView').hidden = true;
  $('uploadView').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('logoutButton').addEventListener('click', () => {
  if (isUploading) return;
  $('uploadView').hidden = true;
  $('loginView').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

const formatBytes = n => n < 1024 * 1024
  ? `${(n / 1024).toFixed(0)} KB`
  : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

const photoLabel = count => `${count} Foto${count === 1 ? '' : 's'}`;

async function loadProgram() {
  try {
    const response = await fetch('/content/program.json', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const data = await response.json();
    const days = Array.isArray(data.days) ? data.days : [];
    $('daySelect').insertAdjacentHTML('beforeend', days.map((day, index) =>
      `<option value="${index}">${day.short || ''} ${day.date || ''} · ${day.title || ''}</option>`
    ).join(''));
    $('daySelect').dataset.days = JSON.stringify(days);
  } catch {
    $('daySelect').innerHTML = '<option value="">Programm konnte nicht geladen werden</option>';
    showMessage('Das Reiseprogramm konnte nicht geladen werden. Bitte die Seite neu laden.');
  }
}

function updatePrograms() {
  const raw = $('daySelect').dataset.days;
  const days = raw ? JSON.parse(raw) : [];
  const index = $('daySelect').value;
  const select = $('programSelect');

  if (index === '') {
    select.disabled = true;
    select.innerHTML = '<option value="">Zuerst Reisetag auswählen</option>';
  } else {
    const events = days[Number(index)]?.events || [];
    select.disabled = false;
    select.innerHTML = '<option value="">Bitte auswählen</option>' + events.map((event, eventIndex) =>
      `<option value="${eventIndex}">${event.time ? `${event.time} · ` : ''}${event.title || 'Programmpunkt'}</option>`
    ).join('') + '<option value="other">Anderer Ort / freie Zeit</option>';
  }

  refreshState();
}

function showMessage(text, type = 'error') {
  const box = $('formMessage');
  box.textContent = text;
  box.className = `form-message ${type}`;
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearMessage() {
  $('formMessage').hidden = true;
}

function fileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function readImageDimensions(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return Promise.resolve(null);
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const result = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

async function addFiles(files) {
  clearMessage();
  const incoming = [...files];
  if (selected.length + incoming.length > MAX_FILES) {
    showMessage(`Bitte höchstens ${MAX_FILES} Fotos auswählen.`);
    return;
  }

  for (const file of incoming) {
    const extensionAllowed = file.name.match(/\.(jpe?g|png|webp|heic|heif)$/i);
    if (!ALLOWED.includes(file.type) && !extensionAllowed) {
      showMessage(`${file.name}: Dateiformat wird nicht unterstützt.`);
      continue;
    }
    if (file.size > MAX_SIZE) {
      showMessage(`${file.name}: Die Datei ist größer als 15 MB.`);
      continue;
    }
    if (selected.some(item => item.key === fileKey(file))) continue;

    const dimensions = await readImageDimensions(file);
    selected.push({ file, key: fileKey(file), dimensions });
  }

  renderFiles();
}

function renderFiles() {
  const grid = $('previewGrid');
  grid.innerHTML = '';

  selected.forEach((item, index) => {
    const { file, dimensions } = item;
    const url = URL.createObjectURL(file);
    const card = document.createElement('article');
    const isSmall = dimensions && Math.max(dimensions.width, dimensions.height) < MIN_RECOMMENDED_WIDTH;
    card.className = `preview-item${isSmall ? ' low-resolution' : ''}`;
    card.innerHTML = `
      <div class="preview-image-wrap">
        <img src="${url}" alt="Vorschau ${index + 1}">
        ${isSmall ? '<span class="quality-warning" title="Für große Darstellungen möglicherweise zu klein">Kleine Auflösung</span>' : ''}
      </div>
      <button class="remove-file" type="button" aria-label="${file.name} entfernen">×</button>
      <div class="preview-meta">
        <strong title="${file.name}"></strong>
        <small>${formatBytes(file.size)}${dimensions ? ` · ${dimensions.width} × ${dimensions.height} px` : ''}</small>
      </div>`;
    card.querySelector('strong').textContent = file.name;
    card.querySelector('img').onload = () => URL.revokeObjectURL(url);
    card.querySelector('.remove-file').onclick = () => {
      selected.splice(index, 1);
      renderFiles();
    };
    grid.appendChild(card);
  });

  $('fileSummary').hidden = !selected.length;
  $('fileCount').textContent = photoLabel(selected.length);
  $('totalSize').textContent = selected.length
    ? `Gesamt: ${formatBytes(selected.reduce((sum, item) => sum + item.file.size, 0))}`
    : '';
  refreshState();
}

function refreshState() {
  const hasAssignment = Boolean($('daySelect').value && $('programSelect').value);
  const hasFiles = selected.length > 0;
  const ready = hasAssignment && hasFiles && !isUploading;

  document.querySelector('[data-step="1"]').classList.toggle('complete', hasAssignment);
  document.querySelector('[data-step="2"]').classList.toggle('active', hasAssignment && !hasFiles);
  document.querySelector('[data-step="2"]').classList.toggle('complete', hasFiles);
  document.querySelector('[data-step="3"]').classList.toggle('active', ready);

  $('submitButton').disabled = !ready;
  $('submitHint').textContent = ready
    ? `${photoLabel(selected.length)} bereit zum sicheren Upload.`
    : 'Bitte Reisetag, Programmpunkt und mindestens ein Foto auswählen.';
}

function openPicker() {
  if (!isUploading) $('fileInput').click();
}

$('chooseButton').addEventListener('click', event => {
  event.stopPropagation();
  openPicker();
});
$('dropZone').addEventListener('click', openPicker);
$('dropZone').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openPicker();
  }
});
$('fileInput').addEventListener('change', event => {
  addFiles(event.target.files);
  event.target.value = '';
});
['dragenter', 'dragover'].forEach(name => $('dropZone').addEventListener(name, event => {
  event.preventDefault();
  $('dropZone').classList.add('dragging');
}));
['dragleave', 'drop'].forEach(name => $('dropZone').addEventListener(name, event => {
  event.preventDefault();
  $('dropZone').classList.remove('dragging');
}));
$('dropZone').addEventListener('drop', event => addFiles(event.dataTransfer.files));
$('clearButton').addEventListener('click', () => {
  selected = [];
  renderFiles();
});
$('daySelect').addEventListener('change', updatePrograms);
$('programSelect').addEventListener('change', refreshState);
$('description').addEventListener('input', event => $('charCount').textContent = event.target.value.length);

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function simulateUpload() {
  isUploading = true;
  refreshState();
  $('uploadDialog').hidden = false;
  const total = selected.length;

  for (let progress = 0; progress <= 100; progress += 2) {
    const processed = Math.min(total, Math.max(0, Math.ceil((progress / 100) * total)));
    $('progressBar').style.width = `${progress}%`;
    $('progressPercent').textContent = `${progress} %`;
    $('progressFiles').textContent = `${processed} von ${total} Fotos`;
    $('uploadStatus').textContent = progress < 25
      ? 'Die Dateien werden geprüft …'
      : progress < 90
        ? 'Fotos werden sicher übertragen …'
        : 'Upload wird abgeschlossen …';
    await wait(35);
  }

  await wait(250);
  $('uploadDialog').hidden = true;
  $('successCount').textContent = photoLabel(total);
  $('successDialog').hidden = false;
  isUploading = false;
  refreshState();
}

$('uploadForm').addEventListener('submit', event => {
  event.preventDefault();
  clearMessage();
  if (!$('daySelect').value) return showMessage('Bitte einen Reisetag auswählen.');
  if (!$('programSelect').value) return showMessage('Bitte einen Programmpunkt auswählen.');
  if (!selected.length) return showMessage('Bitte mindestens ein Foto auswählen.');
  simulateUpload();
});

function resetForm() {
  $('uploadForm').reset();
  $('charCount').textContent = '0';
  selected = [];
  updatePrograms();
  renderFiles();
  clearMessage();
  $('successDialog').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('newUploadButton').addEventListener('click', resetForm);
loadProgram();
refreshState();
