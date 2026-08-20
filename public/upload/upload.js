const $ = id => document.getElementById(id);
const uploadPathMatch = location.pathname.match(/^\/([a-z0-9][a-z0-9-]*)\/upload\/?$/i);
const uploadTrip = (uploadPathMatch?.[1] || new URLSearchParams(location.search).get('trip') || 'bruessel-2026').toLowerCase();
const tripQuery = `trip=${encodeURIComponent(uploadTrip)}`;
const withTrip = path => `${path}${path.includes('?')?'&':'?'}${tripQuery}`;
let config = null;
let msalApp = null;
let account = null;
let selected = [];
let isUploading = false;

const IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);
const VIDEO_TYPES = new Set(['video/mp4','video/quicktime']);
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|mov)$/i;

const formatBytes = n => {
  const value = Number(n || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(0)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
  return `${(value / 1024 ** 3).toFixed(2).replace('.', ',')} GB`;
};
const mediaLabel = count => `${count} Medium${count === 1 ? '' : 'ien'}`;

function showMessage(text, type = 'error') {
  const box = $('formMessage'); box.textContent = text; box.className = `form-message ${type}`; box.hidden = false;
  box.scrollIntoView({behavior:'smooth', block:'center'});
}
function clearMessage(){ $('formMessage').hidden = true; }
function setLoginMessage(text){ $('loginMessage').textContent = text || ''; }

function applyTripContext(){
  if(!config)return;
  const label=config.tripLabel||config.tripTitle||'Brüssel 2026';
  const back=config.backUrl||'/';
  if($('uploadTripLabel'))$('uploadTripLabel').textContent=label;
  if($('uploadBrandLink'))$('uploadBrandLink').href=back;
  if($('uploadBackLink'))$('uploadBackLink').href=back;
  if($('uploadLead'))$('uploadLead').textContent=`Fotos und kurze Videos unserer ${config.destination||'Reise'}-Reise sicher hochladen. Erst nach Prüfung und Freigabe durch die Redaktion können Medien in der Galerie oder im Reisetagebuch erscheinen.`;
  document.title=`Foto- & Video-Upload · ${label}`;
  const root=document.documentElement,theme=config.theme||{};
  if(theme.primary){root.style.setProperty('--blue',theme.primary);root.style.setProperty('--ink',theme.primary)}
  if(theme.accent){root.style.setProperty('--blue2',theme.accent);root.style.setProperty('--yellow',theme.accent)}
  if(config.heroUrl)document.body.style.setProperty('--upload-hero-image',`url("${config.heroUrl}")`);
}
async function loadConfig(){
  const response = await fetch(withTrip('/api/media/config'),{cache:'no-store'});
  if(!response.ok) throw new Error('Upload-Konfiguration konnte nicht geladen werden.');
  config = await response.json();
  applyTripContext();
  if(!config.configured) throw new Error('Microsoft-Konfiguration ist noch nicht vollständig.');
  if(typeof window.msal === 'undefined') throw new Error('Microsoft-Anmeldung konnte nicht geladen werden. Bitte Seite neu laden.');
  msalApp = new msal.PublicClientApplication({auth:{clientId:config.clientId,authority:`https://login.microsoftonline.com/${config.tenantId}`,redirectUri:config.redirectUri,postLogoutRedirectUri:config.redirectUri,navigateToLoginRequestUrl:false},cache:{cacheLocation:'sessionStorage',storeAuthStateInCookie:false},system:{allowNativeBroker:false}});
  await msalApp.initialize?.();
  account = msalApp.getAllAccounts()[0] || null;
  if(account) await showUploadForAccount();
}

async function getGraphToken(interactive=false){
  if(!msalApp) throw new Error('Microsoft-Anmeldung ist noch nicht bereit.');
  if(!account){
    if(!interactive) throw new Error('Bitte zuerst mit dem Schulkonto anmelden.');
    const login = await msalApp.loginPopup({scopes:['User.Read'],prompt:'select_account'});
    account = login.account || msalApp.getAllAccounts()[0];
  }
  try{
    const result = await msalApp.acquireTokenSilent({scopes:['User.Read'],account});
    return result.accessToken;
  }catch(error){
    if(!interactive) throw error;
    const result = await msalApp.acquireTokenPopup({scopes:['User.Read'],account});
    account = result.account || account;
    return result.accessToken;
  }
}

async function fetchStatus(){
  const token = await getGraphToken(true);
  const response = await fetch(withTrip('/api/media/status'),{headers:{authorization:`Bearer ${token}`},cache:'no-store'});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.message || 'Schulkonto konnte nicht geprüft werden.');
  return data;
}

async function showUploadForAccount(){
  try{
    setLoginMessage('Schulkonto wird geprüft …');
    const status = await fetchStatus();
    account = msalApp.getAllAccounts().find(a => a.homeAccountId === account?.homeAccountId) || account;
    $('accountName').textContent = status.user.name || account?.name || 'BS Rohrbach';
    $('accountEmail').textContent = status.user.email || account?.username || '';
    $('avatar').textContent = (status.user.name || 'MS').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || 'MS';
    updateStorage(status.usage?.totalBytes || 0, status.limitBytes || config.storageLimitBytes);
    $('loginView').hidden = true; $('uploadView').hidden = false; setLoginMessage('');
  }catch(error){
    setLoginMessage(error.message || String(error));
    account = null;
    try{await msalApp.logoutPopup({postLogoutRedirectUri:config.redirectUri})}catch{}
  }
}

async function login(){
  try{
    setLoginMessage('Microsoft-Anmeldung wird geöffnet …');
    const result = await msalApp.loginPopup({scopes:['User.Read'],prompt:'select_account'});
    account = result.account || msalApp.getAllAccounts()[0];
    await showUploadForAccount();
  }catch(error){setLoginMessage(error?.message || 'Anmeldung wurde abgebrochen.');}
}
async function logout(){
  if(isUploading || !msalApp) return;
  try{if(account) await msalApp.logoutPopup({account,postLogoutRedirectUri:config.redirectUri});}catch{}
  sessionStorage.clear(); account=null; selected=[]; location.reload();
}

function updateStorage(used, limit){
  $('storageBox').hidden = false;
  const ratio = Math.min(1, used / Math.max(1, limit));
  $('storageBar').style.width = `${Math.round(ratio*100)}%`;
  $('storageText').textContent = `${formatBytes(used)} von ${formatBytes(limit)} Sicherheitsgrenze belegt`;
  $('storageBox').classList.toggle('warning', ratio >= .8);
}

async function loadProgram(){
  try{
    const programUrl=uploadTrip==='bruessel-2026'?'/content/program.json':withTrip('/api/trips/public-resource')+'&resource=program';
    const response=await fetch(programUrl,{cache:'no-store'}); if(!response.ok) throw new Error();
    const data=await response.json(),days=Array.isArray(data.days)?data.days:[];
    $('daySelect').insertAdjacentHTML('beforeend',days.map((day,index)=>`<option value="${index}">${day.short||''} ${day.date||''} · ${day.title||''}</option>`).join(''));
    $('daySelect').dataset.days=JSON.stringify(days);
  }catch{$('daySelect').innerHTML='<option value="">Programm konnte nicht geladen werden</option>'; showMessage('Das Reiseprogramm konnte nicht geladen werden.');}
}
function updatePrograms(){
  const days=$('daySelect').dataset.days?JSON.parse($('daySelect').dataset.days):[],index=$('daySelect').value,select=$('programSelect');
  if(index===''){select.disabled=true;select.innerHTML='<option value="">Zuerst Reisetag auswählen</option>';}
  else{const events=days[Number(index)]?.events||[];select.disabled=false;select.innerHTML='<option value="">Bitte auswählen</option>'+events.map((event,i)=>`<option value="${i}">${event.time?`${event.time} · `:''}${event.title||'Programmpunkt'}</option>`).join('')+'<option value="other">Anderer Ort / freie Zeit</option>';}
  refreshState();
}
function currentAssignment(){
  const days=$('daySelect').dataset.days?JSON.parse($('daySelect').dataset.days):[],di=$('daySelect').value,pi=$('programSelect').value;
  const day=di===''?'':days[Number(di)];
  const program=pi===''?'':pi==='other'?'Anderer Ort / freie Zeit':day?.events?.[Number(pi)];
  return {day:day?`${day.short||''} ${day.date||''} · ${day.title||''}`.trim():'',program:typeof program==='string'?program:(program?`${program.time?`${program.time} · `:''}${program.title||'Programmpunkt'}`:'')};
}

function fileKind(file){if(IMAGE_TYPES.has(file.type)||IMAGE_EXT.test(file.name))return'image';if(VIDEO_TYPES.has(file.type)||VIDEO_EXT.test(file.name))return'video';return null;}
function fileKey(file){return `${file.name}-${file.size}-${file.lastModified}`;}
function videoDuration(file){
  return new Promise(resolve=>{const url=URL.createObjectURL(file),video=document.createElement('video');video.preload='metadata';video.onloadedmetadata=()=>{const d=Number(video.duration||0);URL.revokeObjectURL(url);resolve(Number.isFinite(d)?d:0)};video.onerror=()=>{URL.revokeObjectURL(url);resolve(0)};video.src=url;});
}
async function addFiles(files){
  clearMessage(); const incoming=[...files];
  if(selected.length+incoming.length>config.maxFiles){showMessage(`Bitte höchstens ${config.maxFiles} Medien pro Upload auswählen.`);return;}
  for(const file of incoming){
    const kind=fileKind(file); if(!kind){showMessage(`${file.name}: Format wird nicht unterstützt.`);continue;}
    const max=kind==='image'?config.maxImageBytes:config.maxVideoBytes;
    if(file.size>max){showMessage(`${file.name}: ${kind==='image'?'Foto':'Video'} ist größer als ${formatBytes(max)}.`);continue;}
    if(selected.some(item=>item.key===fileKey(file)))continue;
    let duration=0;
    if(kind==='video'){
      duration=await videoDuration(file);
      if(!duration){showMessage(`${file.name}: Videodauer konnte nicht gelesen werden.`);continue;}
      if(duration>config.maxVideoSeconds+.25){showMessage(`${file.name}: Video ist ${Math.ceil(duration)} Sekunden lang. Erlaubt sind maximal ${config.maxVideoSeconds} Sekunden.`);continue;}
    }
    selected.push({file,key:fileKey(file),kind,duration});
  }
  renderFiles();
}
function renderFiles(){
  const grid=$('previewGrid');grid.innerHTML='';
  selected.forEach((item,index)=>{
    const {file,kind,duration}=item,url=URL.createObjectURL(file),card=document.createElement('article');card.className='preview-item';
    const media=kind==='image'?`<img src="${url}" alt="Vorschau ${index+1}">`:`<video src="${url}" muted controls playsinline preload="metadata"></video>`;
    card.innerHTML=`<div class="preview-image-wrap">${media}<span class="media-badge">${kind==='image'?'📷 Foto':'🎥 Video'}</span></div><button class="remove-file" type="button" aria-label="Datei entfernen">×</button><div class="preview-meta"><strong></strong><small>${formatBytes(file.size)}${kind==='video'?` · ${duration.toFixed(1).replace('.',',')} s`:''}</small></div>`;
    card.querySelector('strong').textContent=file.name;
    const preview=card.querySelector(kind==='image'?'img':'video');preview.addEventListener(kind==='image'?'load':'loadedmetadata',()=>URL.revokeObjectURL(url),{once:true});
    card.querySelector('.remove-file').onclick=()=>{selected.splice(index,1);renderFiles()};grid.appendChild(card);
  });
  $('fileSummary').hidden=!selected.length;$('fileCount').textContent=mediaLabel(selected.length);$('totalSize').textContent=selected.length?`Gesamt: ${formatBytes(selected.reduce((s,x)=>s+x.file.size,0))}`:'';refreshState();
}
function refreshState(){
  const hasAssignment=Boolean($('daySelect').value&&$('programSelect').value),hasFiles=selected.length>0,ready=hasAssignment&&hasFiles&&!isUploading;
  document.querySelector('[data-step="1"]').classList.toggle('complete',hasAssignment);document.querySelector('[data-step="2"]').classList.toggle('active',hasAssignment&&!hasFiles);document.querySelector('[data-step="2"]').classList.toggle('complete',hasFiles);document.querySelector('[data-step="3"]').classList.toggle('active',ready);$('submitButton').disabled=!ready;$('submitHint').textContent=ready?`${mediaLabel(selected.length)} bereit zum sicheren Upload.`:'Bitte Reisetag, Programmpunkt und mindestens eine Datei auswählen.';
}
function base64UrlJson(value){const bytes=new TextEncoder().encode(JSON.stringify(value));let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function uploadOne(item,meta){
  const token=await getGraphToken(true);
  const response=await fetch(withTrip('/api/media/upload'),{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':item.file.type||'application/octet-stream','x-file-name':encodeURIComponent(item.file.name),'x-file-size':String(item.file.size),'x-video-duration':item.kind==='video'?String(item.duration):'0','x-media-meta':base64UrlJson(meta),'x-erasmus-trip':uploadTrip},body:item.file});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||`${item.file.name}: Upload fehlgeschlagen.`);return data;
}
async function performUpload(){
  isUploading=true;refreshState();$('uploadDialog').hidden=false;const assignment=currentAssignment(),meta={...assignment,description:$('description').value.trim()},total=selected.length;let last=null;
  try{
    for(let i=0;i<total;i++){
      const item=selected[i];$('uploadStatus').textContent=`${item.file.name} wird sicher übertragen …`;$('progressFiles').textContent=`${i+1} von ${total} Medien`;$('progressBar').style.width=`${Math.round((i/total)*100)}%`;$('progressPercent').textContent=`${Math.round((i/total)*100)} %`;last=await uploadOne(item,meta);$('progressBar').style.width=`${Math.round(((i+1)/total)*100)}%`;$('progressPercent').textContent=`${Math.round(((i+1)/total)*100)} %`;
    }
    $('uploadDialog').hidden=true;$('successCount').textContent=mediaLabel(total);$('successDialog').hidden=false;
    try{const status=await fetchStatus();updateStorage(status.usage?.totalBytes||0,status.limitBytes||config.storageLimitBytes)}catch{}
    selected=[];renderFiles();
  }catch(error){$('uploadDialog').hidden=true;showMessage(error.message||String(error));}
  finally{isUploading=false;refreshState();}
}
function resetForm(){$('uploadForm').reset();$('charCount').textContent='0';selected=[];updatePrograms();renderFiles();clearMessage();$('successDialog').hidden=true;window.scrollTo({top:0,behavior:'smooth'});}

$('loginButton').addEventListener('click',login);$('logoutButton').addEventListener('click',logout);$('chooseButton').addEventListener('click',e=>{e.stopPropagation();if(!isUploading)$('fileInput').click()});$('dropZone').addEventListener('click',()=>{if(!isUploading)$('fileInput').click()});$('dropZone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click()}});$('fileInput').addEventListener('change',e=>{addFiles(e.target.files);e.target.value=''});['dragenter','dragover'].forEach(n=>$('dropZone').addEventListener(n,e=>{e.preventDefault();$('dropZone').classList.add('dragging')}));['dragleave','drop'].forEach(n=>$('dropZone').addEventListener(n,e=>{e.preventDefault();$('dropZone').classList.remove('dragging')}));$('dropZone').addEventListener('drop',e=>addFiles(e.dataTransfer.files));$('clearButton').addEventListener('click',()=>{selected=[];renderFiles()});$('daySelect').addEventListener('change',updatePrograms);$('programSelect').addEventListener('change',refreshState);$('description').addEventListener('input',e=>$('charCount').textContent=e.target.value.length);$('uploadForm').addEventListener('submit',e=>{e.preventDefault();clearMessage();if(!$('daySelect').value)return showMessage('Bitte einen Reisetag auswählen.');if(!$('programSelect').value)return showMessage('Bitte einen Programmpunkt auswählen.');if(!selected.length)return showMessage('Bitte mindestens eine Datei auswählen.');performUpload()});$('newUploadButton').addEventListener('click',resetForm);

Promise.all([loadConfig(),loadProgram()]).catch(error=>setLoginMessage(error.message||String(error)));
