import { unzipSync, strFromU8 } from 'fflate';

const REPO = 'juvi2601/bs-rohrbach-erasmus';
const VERSION = '14.1.4-dev';

function normalizeHttpStatus(value,fallback=200){
  const n=Number(value);
  return Number.isInteger(n)&&n>=200&&n<=599?n:fallback;
}
function json(data, status = 200, extraHeaders = {}) {
  const safeStatus=normalizeHttpStatus(status,200);
  const safeHeaders=extraHeaders&&typeof extraHeaders==='object'&&!Array.isArray(extraHeaders)?extraHeaders:{};
  return new Response(JSON.stringify(data), {
    status:safeStatus,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...safeHeaders
    }
  });
}

function oauthCallbackPage(status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const title = status === 'success' ? 'Anmeldung abgeschlossen' : 'Anmeldung fehlgeschlagen';
  return new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#f4f7fb;color:#10243e;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#fff;padding:28px;border-radius:18px;box-shadow:0 14px 40px #10243e20;text-align:center;max-width:460px}</style></head><body><main><h1>${title}</h1><p>${status === 'success' ? 'Das Redaktionssystem wird geöffnet …' : 'Bitte schließe dieses Fenster und versuche es erneut.'}</p></main><script>(function(){var authMessage=${JSON.stringify(message)},sent=false;function sendResult(){if(sent||!window.opener)return;sent=true;window.opener.postMessage(authMessage,'*');window.removeEventListener('message',sendResult,false);setTimeout(function(){window.close()},300)}window.addEventListener('message',sendResult,false);if(window.opener){window.opener.postMessage('authorizing:github','*');setTimeout(sendResult,2000)}})();</script></body></html>`, {
    status: status === 'success' ? 200 : 400,
    headers: {'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",'referrer-policy':'no-referrer'}
  });
}

function getOAuthConfig(env) {
  return {clientId:String(env.GITHUB_CLIENT_ID||'').trim(),clientSecret:String(env.GITHUB_CLIENT_SECRET||'').trim()};
}

async function handleAuth(url, env) {
  const {clientId,clientSecret}=getOAuthConfig(env);
  if(!clientId||!clientSecret)return oauthCallbackPage('error',{message:'GITHUB_CLIENT_ID oder GITHUB_CLIENT_SECRET fehlt in Cloudflare.'});
  const provider=url.searchParams.get('provider');
  if(provider&&provider!=='github')return oauthCallbackPage('error',{message:'Ungültiger OAuth-Anbieter.'});
  const callbackUrl=`${url.origin}/callback`,githubUrl=new URL('https://github.com/login/oauth/authorize');
  githubUrl.searchParams.set('response_type','code');githubUrl.searchParams.set('client_id',clientId);githubUrl.searchParams.set('redirect_uri',callbackUrl);githubUrl.searchParams.set('scope','public_repo,user');
  return Response.redirect(githubUrl.toString(),302);
}

async function handleCallback(url, env) {
  const {clientId,clientSecret}=getOAuthConfig(env);
  if(!clientId||!clientSecret)return oauthCallbackPage('error',{message:'GitHub OAuth ist in Cloudflare nicht vollständig konfiguriert.'});
  const githubError=url.searchParams.get('error_description')||url.searchParams.get('error');
  if(githubError)return oauthCallbackPage('error',{message:githubError});
  const code=url.searchParams.get('code');if(!code)return oauthCallbackPage('error',{message:'GitHub hat keinen Anmeldecode zurückgegeben.'});
  let tokenResponse;
  try{tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{accept:'application/json','content-type':'application/json','user-agent':'BS-Rohrbach-Erasmus-CMS'},body:JSON.stringify({client_id:clientId,client_secret:clientSecret,code,redirect_uri:`${url.origin}/callback`,grant_type:'authorization_code'})})}catch(error){return oauthCallbackPage('error',{message:`GitHub ist nicht erreichbar: ${String(error)}`})}
  let result;try{result=await tokenResponse.json()}catch{return oauthCallbackPage('error',{message:'GitHub hat eine ungültige Antwort geliefert.'})}
  if(!tokenResponse.ok||!result.access_token)return oauthCallbackPage('error',{message:result.error_description||result.error||'GitHub konnte kein Zugriffstoken erstellen.'});

  // DEV.14.7: CMS-Zugriff serverseitig auf explizit freigegebene GitHub-Konten begrenzen.
  // Standardmäßig ist nur juvi2601 zugelassen. Optional kann GITHUB_ADMIN_USERS
  // als kommagetrennte Liste in Cloudflare gesetzt werden (für spätere Erweiterungen).
  const allowedUsers=String(env.GITHUB_ADMIN_USERS||'juvi2601')
    .split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  let githubUserResponse;
  try{
    githubUserResponse=await fetch('https://api.github.com/user',{
      headers:{
        authorization:`Bearer ${result.access_token}`,
        accept:'application/vnd.github+json',
        'user-agent':'BS-Rohrbach-Erasmus-CMS'
      }
    });
  }catch(error){
    return oauthCallbackPage('error',{message:`GitHub-Benutzerprüfung ist fehlgeschlagen: ${String(error)}`});
  }
  let githubUser={};
  try{githubUser=await githubUserResponse.json()}catch{}
  const login=String(githubUser.login||'').trim().toLowerCase();
  if(!githubUserResponse.ok||!login){
    return oauthCallbackPage('error',{message:'Das angemeldete GitHub-Konto konnte nicht geprüft werden.'});
  }
  if(!allowedUsers.includes(login)){
    return oauthCallbackPage('error',{message:'Kein Zugriff auf die Redaktion. Dieses GitHub-Konto ist nicht als Administrator freigeschaltet.'});
  }

  return oauthCallbackPage('success',{token:result.access_token});
}

async function loadConnectorConfig(url, env){
  const r=await env.ASSETS.fetch(new Request(`${url.origin}/content/microsoft-connector.json`));
  if(!r.ok)throw new Error('Microsoft-Connector-Konfiguration fehlt.');
  return r.json();
}

function microsoftState(env, config={}){
  const tenantIdConfigured=Boolean(String(env.MS_TENANT_ID||'').trim());
  const clientIdConfigured=Boolean(String(env.MS_CLIENT_ID||'').trim());
  const clientSecretConfigured=Boolean(String(env.MS_CLIENT_SECRET||'').trim());
  const inboxPinConfigured=Boolean(String(env.PHOTO_INBOX_PIN||'').trim());
  const sourceConfigured=Boolean(String(config.ownerUserPrincipalName||'').trim()&&String(config.responsesFileName||'').trim()&&String(config.uploadFolder||'').trim());
  return {ready:Boolean(config.enabled)&&tenantIdConfigured&&clientIdConfigured&&clientSecretConfigured&&inboxPinConfigured&&sourceConfigured,tenantIdConfigured,clientIdConfigured,clientSecretConfigured,inboxPinConfigured,sourceConfigured,lastSync:config.lastSync||null,version:VERSION};
}

function requireInboxPin(request,env){
  const expected=String(env.PHOTO_INBOX_PIN||'').trim();
  if(!expected)return json({message:'PHOTO_INBOX_PIN ist in Cloudflare noch nicht eingerichtet.'},503);
  const supplied=String(request.headers.get('x-photo-inbox-pin')||'');
  if(supplied!==expected)return json({message:'Fotoeingang-PIN fehlt oder ist falsch.'},401,{'www-authenticate':'PhotoInboxPin'});
  return null;
}

async function graphToken(env){
  const tenant=String(env.MS_TENANT_ID||'').trim(),client=String(env.MS_CLIENT_ID||'').trim(),secret=String(env.MS_CLIENT_SECRET||'').trim();
  if(!tenant||!client||!secret)throw new Error('Microsoft-Zugangsdaten sind in Cloudflare nicht vollständig hinterlegt.');
  const body=new URLSearchParams({client_id:client,client_secret:secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'});
  const r=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const data=await r.json();if(!r.ok||!data.access_token)throw new Error(data.error_description||'Microsoft-Anmeldung ist fehlgeschlagen.');return data.access_token;
}


function decodeJwtPayload(token=''){
  try{
    const part=String(token).split('.')[1]||'';
    const normalized=part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=');
    return JSON.parse(atob(normalized));
  }catch{return {}}
}

function graphTokenInfo(token=''){
  const claims=decodeJwtPayload(token);
  return {
    audience:claims.aud||null,
    applicationId:claims.appid||claims.azp||null,
    tenantId:claims.tid||null,
    roles:Array.isArray(claims.roles)?claims.roles:[],
    expiresAt:claims.exp?new Date(claims.exp*1000).toISOString():null
  };
}

async function resolveUserDrive(token,upn){
  const r=await graphFetch(`/users/${encodeURIComponent(upn)}/drive?$select=id,driveType,webUrl,owner`,token);
  return r.json();
}

async function graphFetch(path,token,options={}){
  const url=`https://graph.microsoft.com/v1.0${path}`;
  const r=await fetch(url,{...options,headers:{authorization:`Bearer ${token}`,...(options.headers||{})}});
  if(!r.ok){
    let details={status:r.status,statusText:r.statusText,url,code:null,message:`Microsoft Graph Fehler ${r.status}`,requestId:null,date:null,raw:null};
    const raw=await r.text().catch(()=>"");
    details.raw=raw.slice(0,2000);
    try{
      const d=JSON.parse(raw);
      details.code=d.error?.code||null;
      details.message=d.error?.message||details.message;
      details.requestId=d.error?.innerError?.['request-id']||d.error?.innerError?.requestId||null;
      details.date=d.error?.innerError?.date||null;
    }catch{}
    const error=new Error(details.message);
    error.name='MicrosoftGraphError';
    error.graph=details;
    throw error;
  }
  return r;
}

function errorPayload(error,stage='unknown'){
  return {
    ok:false,
    stage,
    message:error?.message||String(error),
    errorName:error?.name||'Error',
    graph:error?.graph||null,
    stack:error?.stack?String(error.stack).split('\n').slice(0,8).join('\n'):null,
    testedAt:new Date().toISOString()
  };
}

function decodeXml(s=''){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#xA;/gi,'\n').replace(/&#xD;/gi,'\r')}
function colIndex(ref='A1'){let n=0;for(const ch of (ref.match(/[A-Z]+/i)||['A'])[0].toUpperCase())n=n*26+ch.charCodeAt(0)-64;return n-1}
function parseSharedStrings(xml=''){return [...xml.matchAll(/<si[\s>][\s\S]*?<\/si>/g)].map(m=>decodeXml([...m[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('')))}
function parseSheet(xml,shared){
  const rows=[];
  for(const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
    const row=[];
    for(const cm of rm[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
      const attrs=cm[1],body=cm[2],ref=(attrs.match(/\br="([^"]+)"/)||[])[1]||'A1',type=(attrs.match(/\bt="([^"]+)"/)||[])[1]||'';
      const v=(body.match(/<v>([\s\S]*?)<\/v>/)||[])[1];
      const inline=(body.match(/<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/is>/)||[])[1];
      let value='';if(type==='s'&&v!==undefined)value=shared[Number(v)]??'';else if(type==='inlineStr')value=decodeXml(inline||'');else value=decodeXml(v||'');
      row[colIndex(ref)]=value;
    }
    rows.push(row.map(v=>v??''));
  }
  return rows;
}
function parseXlsx(buffer){
  const zip=unzipSync(new Uint8Array(buffer)),shared=parseSharedStrings(zip['xl/sharedStrings.xml']?strFromU8(zip['xl/sharedStrings.xml']):'');
  const sheetName=Object.keys(zip).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  if(!sheetName)throw new Error('In der Excel-Datei wurde kein Tabellenblatt gefunden.');
  return parseSheet(strFromU8(zip[sheetName]),shared);
}
function normalize(s){return String(s||'').trim().toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')}
function headerIndex(headers,terms){return headers.findIndex(h=>terms.some(t=>normalize(h).includes(t)))}
function excelSerialToText(value){const n=Number(value);if(!Number.isFinite(n)||n<20000)return String(value||'');const d=new Date(Date.UTC(1899,11,30)+n*86400000);return new Intl.DateTimeFormat('de-AT',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Vienna'}).format(d)}
function parseUploads(raw){
  const text=String(raw||'').trim();if(!text)return[];
  try{const d=JSON.parse(text);if(Array.isArray(d))return d.map(x=>({name:x.name||x.fileName||'',link:x.link||x.webUrl||'',id:x.id||x.referenceId||'',driveId:x.driveId||''}))}catch{}
  const urls=[...text.matchAll(/https?:\/\/[^\s,;]+/g)].map(m=>m[0]);return urls.map(u=>({name:decodeURIComponent((u.split('/').pop()||'').split('?')[0]),link:u}));
}
function pathEncode(path){return path.split('/').map(encodeURIComponent).join('/')}

async function findResponseWorkbook(token,upn,fileName,uploadFolder=''){
  const baseFolder=String(uploadFolder||'').split('/').slice(0,-1).join('/');
  const directCandidates=[
    baseFolder?`${baseFolder}/${fileName}`:'',
    fileName
  ].filter(Boolean);

  for(const candidate of directCandidates){
    try{
      const r=await graphFetch(`/users/${encodeURIComponent(upn)}/drive/root:/${pathEncode(candidate)}?$select=id,name,parentReference,lastModifiedDateTime`,token);
      const item=await r.json();
      if(item?.name===fileName)return item;
    }catch(error){
      if(error?.graph?.status!==404)throw error;
    }
  }

  const escaped=fileName.replace(/'/g,"''");
  const searchPath=`/users/${encodeURIComponent(upn)}/drive/root/search(q='${encodeURIComponent(escaped)}')?$select=id,name,parentReference,lastModifiedDateTime&$top=50`;
  const r=await graphFetch(searchPath,token);
  const d=await r.json();
  const exact=(d.value||[]).find(x=>x.name===fileName);
  if(!exact)throw new Error(`Antwortdatei „${fileName}“ wurde im OneDrive nicht gefunden.`);
  return exact;
}
async function getDriveItemByPath(token,upn,path){
  const r=await graphFetch(`/users/${encodeURIComponent(upn)}/drive/root:/${pathEncode(path)}?$select=id,name,parentReference,file,lastModifiedDateTime`,token);return r.json();
}

async function inspectFormsSource(token,config,{includeWorkbookRows=true}={}){
  const upn=String(config.ownerUserPrincipalName||'').trim();
  if(!upn)throw new Error('In der Connector-Konfiguration fehlt ownerUserPrincipalName.');
  const workbook=await findResponseWorkbook(token,upn,config.responsesFileName,config.uploadFolder);
  const uploadFolder=await getDriveItemByPath(token,upn,config.uploadFolder);
  let rowCount=null,uploadColumn=null,uploadEntries=null,headers=[];
  if(includeWorkbookRows){
    const content=await graphFetch(`/users/${encodeURIComponent(upn)}/drive/items/${encodeURIComponent(workbook.id)}/content`,token);
    const rows=parseXlsx(await content.arrayBuffer());
    headers=(rows[0]||[]).map(String);
    let upload=headerIndex(headers,['foto','bild','datei','upload','frage']);
    if(upload<0)upload=headers.findIndex((_,i)=>rows.slice(1).some(r=>parseUploads(r[i]).length));
    rowCount=Math.max(0,rows.length-1);
    uploadColumn=upload>=0?(headers[upload]||`Spalte ${upload+1}`):null;
    uploadEntries=upload>=0?rows.slice(1).reduce((sum,row)=>sum+parseUploads(row[upload]).length,0):0;
  }
  return {
    ownerUserPrincipalName:upn,
    workbook:{id:workbook.id,name:workbook.name,lastModifiedDateTime:workbook.lastModifiedDateTime||null},
    uploadFolder:{id:uploadFolder.id,name:uploadFolder.name,driveId:uploadFolder.parentReference?.driveId||null,lastModifiedDateTime:uploadFolder.lastModifiedDateTime||null},
    rowCount,uploadColumn,uploadEntries,headers
  };
}
async function buildPhotoRows(url,env,config){
  const token=await graphToken(env),upn=config.ownerUserPrincipalName;
  const source=await inspectFormsSource(token,config,{includeWorkbookRows:false});
  const content=await graphFetch(`/users/${encodeURIComponent(upn)}/drive/items/${encodeURIComponent(source.workbook.id)}/content`,token);
  const rows=parseXlsx(await content.arrayBuffer());
  if(rows.length<2)return {photos:[],source:{...source,rowCount:0,uploadEntries:0},diagnostics:{rows:0,uploadEntries:0,photosFound:0,skipped:0},syncedAt:new Date().toISOString()};
  const headers=rows[0].map(String),idx={start:headerIndex(headers,['startzeit','start time']),name:headerIndex(headers,['name']),email:headerIndex(headers,['e-mail','email']),day:headerIndex(headers,['reisetag']),place:headerIndex(headers,['ort oder programmpunkt','programmpunkt']),description:headerIndex(headers,['kurze bildbeschreibung','bildbeschreibung'])};
  let upload=headerIndex(headers,['foto','bild','datei','upload','frage']);
  if(upload<0)upload=headers.findIndex((_,i)=>rows.slice(1).some(r=>parseUploads(r[i]).length));
  if(upload<0)throw new Error('In der Forms-Antwortdatei wurde keine Spalte mit hochgeladenen Dateien gefunden.');
  const photos=[];let uploadEntries=0,skipped=0;
  for(let r=1;r<rows.length;r++){
    const row=rows[r],uploads=parseUploads(row[upload]);uploadEntries+=uploads.length;
    for(let u=0;u<uploads.length;u++){
      const entry=uploads[u];let item=null;
      if(entry.id&&entry.driveId)item={id:entry.id,parentReference:{driveId:entry.driveId},name:entry.name};
      if(!item&&entry.name){try{item=await getDriveItemByPath(token,upn,`${config.uploadFolder}/${entry.name}`)}catch{}}
      if(!item){skipped++;continue;}
      const driveId=item.parentReference?.driveId||entry.driveId;if(!driveId){skipped++;continue;}
      photos.push({id:`${driveId}:${item.id}`,status:'new',day:idx.day>=0?row[idx.day]||'':'',place:idx.place>=0?row[idx.place]||'':'',program:idx.place>=0?row[idx.place]||'':'',description:idx.description>=0?row[idx.description]||'':'',name:(idx.name>=0?row[idx.name]:'')||(idx.email>=0?row[idx.email]:'')||'Unbekannt',email:idx.email>=0?row[idx.email]||'':'',submittedAt:idx.start>=0?excelSerialToText(row[idx.start]):'',fileName:item.name||entry.name||'',image:`${url.origin}/api/photo-inbox/image?driveId=${encodeURIComponent(driveId)}&itemId=${encodeURIComponent(item.id)}`});
    }
  }
  return {photos,source:{...source,rowCount:rows.length-1,uploadColumn:headers[upload]||`Spalte ${upload+1}`,uploadEntries},diagnostics:{rows:rows.length-1,uploadEntries,photosFound:photos.length,skipped},syncedAt:new Date().toISOString()};
}



// --- DEV.9: geschützter R2-Medieneingang (Fotos + kurze Videos) ---
// --- DEV 14.0 Modul 1: Multi-Reise-Grundstruktur ---
const DEFAULT_TRIP_ID = 'bruessel-2026';
const TRIP_REGISTRY = Object.freeze({
  'bruessel-2026': Object.freeze({
    id:'bruessel-2026',
    title:'Brüssel 2026',
    destination:'Brüssel',
    country:'Belgien',
    status:'active',
    startDate:'2026-11-21',
    endDate:'2026-11-27',
    contentBase:'/content',
    theme:{preset:'brussels',primary:'#0b4f8a',accent:'#f2c94c'},
    features:{countdown:true,diary:true,liveStatus:true,gallery:true,mediaUpload:true,map:true}
  })
});
const DRAFT_ROUTE_REGISTRY = Object.freeze({
  'linz-2027': Object.freeze({
    id:'linz-2027',
    draftId:'testreise-2027',
    title:'Testreise 2027',
    destination:'Linz',
    status:'draft',
    published:false
  })
});
const MEDIA_PROJECT = DEFAULT_TRIP_ID; // Kompatibilität zu STABLE 13.9
function mediaProjectFromUrl(url){
  const candidate=normalizeTripId(url?.searchParams?.get('trip'));
  if(candidate===DEFAULT_TRIP_ID||DRAFT_ROUTE_REGISTRY[candidate])return candidate;
  return DEFAULT_TRIP_ID;
}
function mediaProjectFromRequest(request){
  const url=new URL(request.url);
  const header=normalizeTripId(request.headers.get('x-erasmus-trip'));
  const candidate=header||normalizeTripId(url.searchParams.get('trip'));
  if(candidate===DEFAULT_TRIP_ID||DRAFT_ROUTE_REGISTRY[candidate])return candidate;
  return DEFAULT_TRIP_ID;
}
function normalizeTripId(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'')}
function resolveTripId(request,url){
  const header=normalizeTripId(request?.headers?.get('x-erasmus-trip'));
  const query=normalizeTripId(url?.searchParams?.get('trip'));
  const candidate=header||query||DEFAULT_TRIP_ID;
  return TRIP_REGISTRY[candidate]?candidate:DEFAULT_TRIP_ID;
}
function tripConfig(id=DEFAULT_TRIP_ID){return TRIP_REGISTRY[id]||TRIP_REGISTRY[DEFAULT_TRIP_ID]}
function tripPublicPath(id){const value=normalizeTripId(id);return value?`/${value}/`:'/'}
function tripIdFromPath(pathname=''){
  const match=String(pathname||'').match(/^\/([a-z0-9][a-z0-9-]*)\/?$/);
  return match?normalizeTripId(match[1]):'';
}
function publicRouteInfo(pathname=''){
  const id=tripIdFromPath(pathname);
  if(!id)return null;
  if(id===DEFAULT_TRIP_ID)return {id,path:tripPublicPath(id),status:'legacy-alias',published:true};
  const registered=TRIP_REGISTRY[id];
  if(registered)return {id,path:tripPublicPath(id),status:registered.status||'active',published:true};
  const draftRoute=DRAFT_ROUTE_REGISTRY[id];
  return draftRoute?{...draftRoute,path:tripPublicPath(id)}:null;
}
function tripDraftKey(id){return `__system/trips/drafts/${id}.json`}
function publishedMetaKey(id){return `__system/trips/published/${normalizeTripId(id)}/meta.json`}
function publishedResourceKey(id,resource){return `__system/trips/published/${normalizeTripId(id)}/${String(resource||'')}.json`}
function publishedAssetPrefix(id){return `__system/trips/published-assets/${normalizeTripId(id)}/`}
async function getPublishedMeta(env,id){
  if(!env.MEDIA_BUCKET)return null;
  const object=await env.MEDIA_BUCKET.get(publishedMetaKey(id));
  if(!object)return null;
  try{return JSON.parse(await object.text())}catch{return null}
}

const TRIP_LIFECYCLE_STATUSES=Object.freeze(['draft','published','offline','archived']);
function isPublicTripStatus(status){return status==='published'||status==='archived'}
async function tripLifecycleStatus(env,id){
  const tripId=normalizeTripId(id);
  const meta=await getPublishedMeta(env,tripId);
  if(meta?.status&&TRIP_LIFECYCLE_STATUSES.includes(meta.status))return meta.status;
  if(meta?.published===true)return 'published';
  if(TRIP_REGISTRY[tripId])return 'published';
  return 'draft';
}
async function setTripLifecycleStatus(env,id,status,user){
  const tripId=normalizeTripId(id),next=String(status||'').trim().toLowerCase();
  if(!TRIP_LIFECYCLE_STATUSES.includes(next)||next==='draft')
    throw Object.assign(new Error('Ungültiger Reisestatus.'),{status:400});
  if(!TRIP_REGISTRY[tripId]&&!DRAFT_ROUTE_REGISTRY[tripId])
    throw Object.assign(new Error('Unbekannte Reise.'),{status:404});
  const existing=await getPublishedMeta(env,tripId);
  if(DRAFT_ROUTE_REGISTRY[tripId]&&!existing)
    throw Object.assign(new Error('Diese Reise wurde noch nie veröffentlicht. Bitte zuerst über „Prüfen & Veröffentlichen“ veröffentlichen.'),{status:400});
  const now=new Date().toISOString();
  const base=existing||{
    id:tripId,title:TRIP_REGISTRY[tripId]?.title||DRAFT_ROUTE_REGISTRY[tripId]?.title||tripId,
    destination:TRIP_REGISTRY[tripId]?.destination||DRAFT_ROUTE_REGISTRY[tripId]?.destination||''
  };
  const meta={...base,status:next,published:isPublicTripStatus(next),statusUpdatedAt:now,statusUpdatedBy:user?.email||''};
  if(next==='published')meta.publishedAt=meta.publishedAt||now;
  if(next==='offline')meta.offlineAt=now;
  if(next==='archived')meta.archivedAt=now;
  await env.MEDIA_BUCKET.put(publishedMetaKey(tripId),JSON.stringify(meta,null,2),{
    httpMetadata:{contentType:'application/json; charset=utf-8'}
  });
  return meta;
}
function publishRouteForDraft(draftId){
  return Object.values(DRAFT_ROUTE_REGISTRY).find(route=>route.draftId===draftId)||null;
}
function serverPublishIssues(draft){
  const issues=[];
  const req=(value,label)=>{if(!String(value||'').trim())issues.push(label)};
  req(draft?.title,'Reisename');
  req(draft?.id,'Reise-ID');
  req(draft?.destination,'Reiseziel');
  req(draft?.country,'Land');
  req(draft?.startDate,'Abreise');
  req(draft?.endDate,'Rückkehr');
  req(draft?.website?.intro||draft?.subtitle,'Einleitung / Kurzbeschreibung');
  req(draft?.transport?.outboundMode,'Verkehrsmittel Anreise');
  req(draft?.transport?.meetingPoint,'Treffpunkt / Abfahrtszeit');
  req(draft?.transport?.returnInfo,'Rückreise / geplante Rückkehr');
  req(draft?.accommodation?.name,'Hotel / Unterkunft');
  req(draft?.accommodation?.address,'Unterkunft-Adresse');
  if(!(draft?.team?.teachers||[]).length)issues.push('Lehrkräfte');
  if(!String(draft?.images?.hero||'').trim())issues.push('Titelbild');
  const days=draft?.program?.days||[];
  if(!days.length)issues.push('Tagesprogramm');
  days.forEach((day,di)=>{
    if(!String(day?.title||'').trim())issues.push(`Reisetag ${di+1}: Titel`);
    if(!(day?.events||[]).length)issues.push(`Reisetag ${di+1}: Programmpunkt`);
    (day?.events||[]).forEach((event,ei)=>{
      if(!String(event?.time||'').trim())issues.push(`Reisetag ${di+1}, Punkt ${ei+1}: Zeit`);
      if(!String(event?.title||'').trim())issues.push(`Reisetag ${di+1}, Punkt ${ei+1}: Titel`);
    });
  });
  return issues;
}
async function copyPublishedAsset(env,routeId,key){
  const sourceKey=String(key||'');if(!sourceKey)return '';
  if(!sourceKey.startsWith('__system/trips/assets/'))return sourceKey;
  const safeName=sourceKey.split('/').pop()||crypto.randomUUID();
  const target=`${publishedAssetPrefix(routeId)}${crypto.randomUUID()}-${safeName.replace(/[^a-zA-Z0-9._-]/g,'-')}`;
  const object=await env.MEDIA_BUCKET.get(sourceKey);
  if(!object)return '';
  const headers=new Headers();object.writeHttpMetadata(headers);
  const contentType=headers.get('content-type')||'application/octet-stream';
  await env.MEDIA_BUCKET.put(target,object.body,{httpMetadata:{contentType},customMetadata:{sourceKey,publishedAt:new Date().toISOString()}});
  return target;
}
async function rewritePublishedImageKeys(env,routeId,resources){
  const map=new Map();
  const copy=async key=>{
    const value=String(key||'');if(!value)return '';
    if(map.has(value))return map.get(value);
    const target=await copyPublishedAsset(env,routeId,value);map.set(value,target);return target;
  };
  const site=resources.site||{};
  if(site.heroKey)site.heroKey=await copy(site.heroKey);
  if(site.hotel?.imageKey)site.hotel.imageKey=await copy(site.hotel.imageKey);
  const program=resources.program||{};
  for(const day of program.days||[]){
    if(day.coverKey)day.coverKey=await copy(day.coverKey);
    if(Array.isArray(day.galleryKeys))day.galleryKeys=await Promise.all(day.galleryKeys.map(copy));
    for(const event of day.events||[]){
      if(Array.isArray(event.imageKeys))event.imageKeys=await Promise.all(event.imageKeys.map(copy));
    }
  }
  const places=resources.places||{};
  for(const place of places.places||[]){if(place.imageKey)place.imageKey=await copy(place.imageKey)}
}
function cleanTripDraft(input={}){
  const id=normalizeTripId(input.id);
  const title=cleanText(input.title,100);
  const destination=cleanText(input.destination,100);
  const country=cleanText(input.country,100);
  const startDate=/^\d{4}-\d{2}-\d{2}$/.test(String(input.startDate||''))?String(input.startDate):'';
  const endDate=/^\d{4}-\d{2}-\d{2}$/.test(String(input.endDate||''))?String(input.endDate):'';
  const subtitle=cleanText(input.subtitle,180);
  const primary=/^#[0-9a-fA-F]{6}$/.test(String(input.primary||''))?String(input.primary):'#0b4f8a';
  const accent=/^#[0-9a-fA-F]{6}$/.test(String(input.accent||''))?String(input.accent):'#f2c94c';
  if(!id||!title||!destination||!country||!startDate||!endDate)throw Object.assign(new Error('Bitte alle Pflichtfelder ausfüllen.'),{status:400});
  if(endDate<startDate)throw Object.assign(new Error('Das Rückreisedatum darf nicht vor der Abreise liegen.'),{status:400});
  if(TRIP_REGISTRY[id])throw Object.assign(new Error('Diese Reise-ID wird bereits verwendet.'),{status:409});
  const website=(input.website&&typeof input.website==='object')?input.website:{};
  const school=cleanText(website.school,100)||'BS Rohrbach Erasmus+';
  const heroEyebrow=cleanText(website.heroEyebrow,100)||'Berufsschule Rohrbach unterwegs';
  const heroTitle=cleanText(website.heroTitle,100)||title;
  const brandSubtitle=cleanText(website.brandSubtitle,140);
  const intro=cleanText(website.intro,240)||subtitle;
  const countdownLabel=cleanText(website.countdownLabel,100);
  const departureTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(String(website.departureTime||''))?String(website.departureTime):'20:00';
  const returnTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(String(website.returnTime||''))?String(website.returnTime):'23:59';
  const hotelName=cleanText(website.hotelName,120);
  const hotelAddress=cleanText(website.hotelAddress,180);
  const contactName=cleanText(website.contactName,120);
  const contactPhone=cleanText(website.contactPhone,60);
  const notice=cleanText(website.notice,220)||'Noch nicht endgültig bestätigte Punkte sind entsprechend markiert.';
  const transport=(input.transport&&typeof input.transport==='object')?input.transport:{};
  const accommodation=(input.accommodation&&typeof input.accommodation==='object')?input.accommodation:{};
  const team=(input.team&&typeof input.team==='object')?input.team:{};
  const emergency=(input.emergency&&typeof input.emergency==='object')?input.emergency:{};
  const documents=(input.documents&&typeof input.documents==='object')?input.documents:{};
  const features=(input.features&&typeof input.features==='object')?input.features:{};
  const images=(input.images&&typeof input.images==='object')?input.images:{};
  const program=(input.program&&typeof input.program==='object')?input.program:{};
  const locations=(input.locations&&typeof input.locations==='object')?input.locations:{};
  const arr=v=>Array.isArray(v)?v.map(x=>cleanText(x,180)).filter(Boolean):[];
  const bool=(v,d=true)=>typeof v==='boolean'?v:d;
  return {
    id,title,destination,country,startDate,endDate,subtitle,theme:{primary,accent},status:'draft',
    website:{school,heroEyebrow,heroTitle,brandSubtitle,intro,countdownLabel,departureTime,returnTime,hotelName,hotelAddress,contactName,contactPhone,notice},
    transport:{outboundMode:cleanText(transport.outboundMode,100),meetingPoint:cleanText(transport.meetingPoint,180),arrivalInfo:cleanText(transport.arrivalInfo,180),returnMode:cleanText(transport.returnMode,100),returnInfo:cleanText(transport.returnInfo,180),notes:cleanText(transport.notes,400)},
    accommodation:{name:cleanText(accommodation.name||hotelName,140),address:cleanText(accommodation.address||hotelAddress,200),website:cleanText(accommodation.website,220),phone:cleanText(accommodation.phone,80),checkIn:cleanText(accommodation.checkIn,80),checkOut:cleanText(accommodation.checkOut,80),notes:cleanText(accommodation.notes,400)},
    team:{editors:arr(team.editors),teachers:arr(team.teachers),studentListNote:cleanText(team.studentListNote,220)},
    emergency:{contactName:cleanText(emergency.contactName||contactName,140),contactPhone:cleanText(emergency.contactPhone||contactPhone,80),schoolPhone:cleanText(emergency.schoolPhone,80),insurance:cleanText(emergency.insurance,300),notes:cleanText(emergency.notes,400)},
    documents:{program:cleanText(documents.program,220),packingList:cleanText(documents.packingList,220),parentInfo:cleanText(documents.parentInfo,220),insuranceInfo:cleanText(documents.insuranceInfo,220),other:cleanText(documents.other,400)},
    features:{news:bool(features.news),diary:bool(features.diary),gallery:bool(features.gallery),upload:bool(features.upload),map:bool(features.map),smartJourney:bool(features.smartJourney),downloads:bool(features.downloads),emergency:bool(features.emergency)},
    locations:{places:(Array.isArray(locations.places)?locations.places:[]).slice(0,40).map(place=>({name:cleanText(place?.name,140),address:cleanText(place?.address,220),description:cleanText(place?.description,400)})).filter(place=>place.name||place.address)},
    images:{hero:cleanText(images.hero,300),hotel:cleanText(images.hotel,300),program:arr(images.program).slice(0,30)},
    program:{days:(Array.isArray(program.days)?program.days:[]).slice(0,31).map((day,di)=>{
      const date=/^\d{4}-\d{2}-\d{2}$/.test(String(day?.date||''))?String(day.date):'';
      return {
        id:cleanText(day?.id,40)||`day-${di+1}`,date,short:cleanText(day?.short,12),title:cleanText(day?.title,120),subtitle:cleanText(day?.subtitle,220),heroImage:cleanText(day?.heroImage,300),
        events:(Array.isArray(day?.events)?day.events:[]).slice(0,30).map(event=>{
          const eventImages=arr(event?.images).slice(0,10);
          const legacyImage=cleanText(event?.image,300);
          const normalizedImages=[...new Set(eventImages.length?eventImages:(legacyImage?[legacyImage]:[]))];
          return {time:cleanText(event?.time,60),title:cleanText(event?.title,160),text:cleanText(event?.text,500),images:normalizedImages,image:normalizedImages[0]||''};
        })
      };
    }).filter(day=>day.date)}
  };
}

function draftDateParts(value=''){
  const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?{year:m[1],month:m[2],day:m[3],short:`${m[3]}.${m[2]}.`}:{year:'',month:'',day:'',short:''};
}
function draftDateRange(draft){
  const a=draftDateParts(draft.startDate),b=draftDateParts(draft.endDate);
  return a.year&&b.year?`${a.day}.${a.month}.${a.year} – ${b.day}.${b.month}.${b.year}`:'';
}
function draftNavigation(draft){
  const f=draft.features||{},items=[
    {label:'Heute',target:'#heute',on:true},{label:'News',target:'#news',on:f.news!==false},
    {label:'Programm',target:'#programm',on:true},{label:'Karte',target:'#karte',on:f.map!==false},
    {label:'Galerie',target:'#galerie',on:f.gallery!==false},{label:'Downloads',target:'#downloads',on:f.downloads!==false},
    {label:'Hilfe',target:'#notfall',on:f.emergency!==false,emergency:true},
    {label:'Interner Bereich 🔒',target:'#reisegruppe',on:f.upload!==false,highlight:true}
  ];return items.filter(x=>x.on).map(({on,...x})=>x);
}
function draftQuickLinks(draft){
  const f=draft.features||{},rows=[
    {icon:'📖',title:'Reisetagebuch',subtitle:'Berichte & Fotos',target:'#reisetagebuch',on:f.diary!==false},
    {icon:'📅',title:'Programm',subtitle:'Tag für Tag',target:'#programm',on:true},
    {icon:'🗺️',title:'Karte',subtitle:'Alle Reiseziele',target:'#karte',on:f.map!==false},
    {icon:'🌤️',title:'Wetter',subtitle:`${draft.destination||'Reiseziel'} & Ausflüge`,target:'#wetter',on:true},
    {icon:'🔒',title:'Interner Bereich',subtitle:'Geschützte Inhalte',target:'#reisegruppe',on:f.upload!==false},
    {icon:'📥',title:'Downloads',subtitle:'Dokumente & Infos',target:'#downloads',on:f.downloads!==false}
  ];return rows.filter(x=>x.on).map(({on,...x})=>x);
}
function draftEmergencyItems(draft){
  const e=draft.emergency||{},rows=[];
  if(e.contactName||e.contactPhone)rows.push({icon:'👤',title:e.contactName||'Notfall-Ansprechperson',text:e.contactPhone||''});
  if(e.schoolPhone)rows.push({icon:'🏫',title:'Berufsschule Rohrbach',text:e.schoolPhone,url:`tel:${e.schoolPhone.replace(/\s/g,'')}`,button:'Schule anrufen'});
  if(e.insurance)rows.push({icon:'🛡️',title:'Versicherung / Reiseinfo',text:e.insurance});
  if(e.notes)rows.push({icon:'ℹ️',title:'Weitere Hinweise',text:e.notes});
  return rows;
}
function draftProgramResource(draft){
  return {days:(draft.program?.days||[]).map((day,di)=>{
    const p=draftDateParts(day.date),imageKeys=[...new Set((day.events||[]).flatMap(e=>Array.isArray(e.images)?e.images:[]).filter(Boolean))];
    return {dayNumber:di+1,date:p.short,year:p.year,coverKey:day.heroImage||'',galleryKeys:imageKeys,title:day.title||`Reisetag ${di+1}`,subtitle:day.subtitle||'',id:day.id||`day-${di+1}`,short:day.short||`Tag ${di+1}`,events:(day.events||[]).map(e=>({time:e.time||'',title:e.title||'',text:e.text||'',status:'',imageKeys:Array.isArray(e.images)?e.images:[]}))};
  })};
}
function draftSiteResource(draft){
  const a=draft.accommodation||{},f=draft.features||{},year=draftDateParts(draft.startDate).year,range=draftDateRange(draft),depTime=draft.website?.departureTime||'20:00';
  return {
    meta:{pageTitle:`${draft.title} · BS Rohrbach Erasmus+`,description:draft.website?.intro||draft.subtitle||''},
    tripTitle:draft.title,tripYear:year,tripDestination:draft.destination,destination:draft.destination,school:'BS Rohrbach Erasmus+',brandSubtitle:`${draft.destination} · ${range}`,
    subtitle:draft.website?.intro||draft.subtitle||'',departure:`${draft.startDate}T${depTime}:00`,returnDate:`${draft.endDate}T${draft.website?.returnTime||'23:59'}:00`,
    heroKey:draft.images?.hero||'',heroEyebrow:'Berufsschule Rohrbach unterwegs',heroTitle:draft.title,heroPrimaryButton:'Reiseprogramm',heroSecondaryButton:'Internen Bereich öffnen',
    countdownLabel:`🚌 Abfahrt nach ${draft.destination}`,countdownDateText:`${draft.startDate} · ${depTime} Uhr`,
    navigation:draftNavigation(draft),quickLinks:draftQuickLinks(draft),features:f,theme:draft.theme||{},
    today:{eyebrow:'Heute auf unserer Reise',beforeTitle:'Die Reise beginnt bald',beforeText:'Hier erscheint während der Reise automatisch das aktuelle Tagesprogramm.',beforeLabel:'Reisephase',dateRange:range,afterTitle:`${draft.title} ist abgeschlossen`,afterText:'Reisetagebuch, Galerie und Reiseinformationen bleiben weiterhin erreichbar.',afterLabel:'Abgeschlossen'},
    sections:{
      news:{eyebrow:'Aktuelles zur Reise',title:'News & Hinweise',intro:'Neue Informationen werden hier laufend ergänzt.'},
      program:{eyebrow:'Tag für Tag',title:'Unser Reiseprogramm',intro:''},
      map:{eyebrow:'Orientierung vor Ort',title:'Interaktive Reisekarte',intro:'Klicke auf einen Ort für Adresse, Beschreibung und Navigation.'},
      weather:{eyebrow:'Aktuelle Vorschau',title:'Wetter an unseren Reisezielen',intro:'Die Wetterdaten werden automatisch aktualisiert.'},
      gallery:{eyebrow:'Reise in Bildern',title:'Unsere Reiseziele',intro:'Hier erscheinen die für diese Reise freigegebenen Bilder.'},
      downloads:{eyebrow:'Wichtige Unterlagen',title:'Downloads',intro:'Hier erscheinen die für diese Reise vorgesehenen Dokumente.'},
      faq:{eyebrow:'Kurz erklärt',title:'Häufige Fragen',intro:''}
    },
    hotel:{eyebrow:`Unser Zuhause in ${draft.destination}`,title:a.name||'Unterkunft',imageKey:draft.images?.hotel||'',address:a.address||'',mapsUrl:a.address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.address)}`:'',mapsButton:'In Google Maps öffnen',details:[
      a.phone&&{icon:'☎️',title:'Telefon',text:a.phone},a.checkIn&&{icon:'🕓',title:'Check-in',text:a.checkIn},a.checkOut&&{icon:'🧳',title:'Check-out',text:a.checkOut},a.notes&&{icon:'ℹ️',title:'Hinweis',text:a.notes}
    ].filter(Boolean)},
    weatherLocations:[],
    studentArea:{icon:'🔒',eyebrow:'Nur mit Schulkonto',title:'Interner Bereich',text:'Fotos und kurze Videos können über den geschützten Bereich eingereicht werden.',uploadButton:'🔐 Zum Foto-Upload',galleryButton:'Galerie',note:'Anmeldung mit dem Microsoft-365-Schulkonto erforderlich.',uploadUrl:'/upload.html',galleryUrl:'#galerie'},
    emergency:{eyebrow:'Hilfe unterwegs',title:'Wichtige Kontakte',intro:'Nur für den Fall, dass unterwegs rasch Hilfe benötigt wird.',items:draftEmergencyItems(draft)},
    footer:{title:'© Berufsschule Rohrbach · Erasmus+',subtitle:'Projektleitung und technische Umsetzung: Jürgen Vierlinger',topLink:'Nach oben ↑',privacy:'Keine personenbezogenen Reisedaten öffentlich',version:'',updated:''},
    notice:draft.website?.notice||'',liveStatus:{enabled:false,mode:'automatic'}
  };
}
async function geocodeCacheKey(query){
  const bytes=new TextEncoder().encode(String(query||'').trim().toLowerCase());
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return `__system/trips/geocode/${[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}.json`;
}
async function geocodeQuery(env,query){
  const q=String(query||'').trim();if(!q)return null;
  const key=await geocodeCacheKey(q);

  if(env.MEDIA_BUCKET){
    try{
      const cached=await env.MEDIA_BUCKET.get(key);
      if(cached){
        const value=JSON.parse(await cached.text());
        if(value&&Number.isFinite(Number(value.lat))&&Number.isFinite(Number(value.lng)))return value;
      }
    }catch{}
  }

  const save=async result=>{
    if(!result)return null;
    if(env.MEDIA_BUCKET){
      try{
        await env.MEDIA_BUCKET.put(key,JSON.stringify(result),{
          httpMetadata:{contentType:'application/json; charset=utf-8'},
          customMetadata:{query:q,createdAt:new Date().toISOString(),source:String(result.source||'')}
        });
      }catch{}
    }
    return result;
  };

  // Primär: Nominatim / OpenStreetMap
  try{
    const endpoint=new URL('https://nominatim.openstreetmap.org/search');
    endpoint.searchParams.set('q',q);
    endpoint.searchParams.set('format','jsonv2');
    endpoint.searchParams.set('limit','1');
    endpoint.searchParams.set('addressdetails','1');
    endpoint.searchParams.set('accept-language','de');
    const response=await fetch(endpoint.toString(),{headers:{accept:'application/json'}});
    if(response.ok){
      const rows=await response.json(),row=Array.isArray(rows)?rows[0]:null;
      if(row){
        const result={
          lat:Number(row.lat),
          lng:Number(row.lon),
          displayName:String(row.display_name||''),
          source:'nominatim'
        };
        if(Number.isFinite(result.lat)&&Number.isFinite(result.lng))return await save(result);
      }
    }
  }catch{}

  // Fallback: Photon (OSM-Daten)
  try{
    const endpoint=new URL('https://photon.komoot.io/api/');
    endpoint.searchParams.set('q',q);
    endpoint.searchParams.set('limit','1');
    endpoint.searchParams.set('lang','de');
    const response=await fetch(endpoint.toString(),{headers:{accept:'application/json'}});
    if(response.ok){
      const data=await response.json();
      const feature=Array.isArray(data?.features)?data.features[0]:null;
      const coords=feature?.geometry?.coordinates;
      if(Array.isArray(coords)&&coords.length>=2){
        const result={
          lat:Number(coords[1]),
          lng:Number(coords[0]),
          displayName:String(feature?.properties?.name||q),
          source:'photon'
        };
        if(Number.isFinite(result.lat)&&Number.isFinite(result.lng))return await save(result);
      }
    }
  }catch{}

  return null;
}

async function geocodePlace(env,place,draft){
  const destination=String(draft.destination||'').trim();
  const country=String(draft.country||'').trim();

  const queries=[
    [place.title,place.address].filter(Boolean).join(', '),
    [place.address,destination,country].filter(Boolean).join(', '),
    [place.title,destination,country].filter(Boolean).join(', '),
    String(place.address||'').trim()
  ].filter((q,i,a)=>q&&a.indexOf(q)===i);

  for(let i=0;i<queries.length;i++){
    if(i)await new Promise(resolve=>setTimeout(resolve,1050));
    const result=await geocodeQuery(env,queries[i]);
    if(result)return result;
  }
  return null;
}
async function draftPlacesResource(draft,env){
  const places=[],ac=draft.accommodation||{};

  if(ac.name||ac.address){
    places.push({
      title:ac.name||'Unterkunft',
      category:'Hotel',
      address:ac.address||'',
      walk:'Unterkunft',
      imageKey:draft.images?.hotel||'',
      description:ac.notes||'Unsere Unterkunft während der Reise.',
      maps:ac.address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ac.address)}`:''
    });
  }

  for(const p of (draft.locations?.places||[])){
    places.push({
      title:p.name||p.address,
      category:'Sehenswürdigkeit',
      address:p.address||'',
      walk:'',
      image:'',
      description:p.description||'',
      maps:p.address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`:''
    });
  }

  for(const place of places){
    const coords=await geocodePlace(env,place,draft);
    place.lat=coords?coords.lat:null;
    place.lng=coords?coords.lng:null;
  }

  return {places};
}
function draftDownloadsResource(draft){
  const d=draft.documents||{},isLink=v=>/^https?:\/\//i.test(String(v||''))||String(v||'').startsWith('/');
  const rows=[
    ['Reiseprogramm','Aktueller Ablauf der Reise.',d.program,'📅'],
    ['Packliste','Was für die Reise mitgenommen werden soll.',d.packingList,'🧳'],
    ['Elterninformation','Informationen für Eltern und Erziehungsberechtigte.',d.parentInfo,'📄'],
    ['Versicherungsinformationen','Informationen zum Versicherungsschutz.',d.insuranceInfo,'🛡️']
  ];return {downloads:rows.map(([title,description,file,icon])=>({title,description,file:isLink(file)?file:'',icon,published:isLink(file)}))};
}
function draftFaqResource(draft){
  const a=draft.accommodation||{},dep=draft.website?.departureTime||'20:00';
  return {items:[
    {question:'Wann fahren wir ab?',answer:`Am ${draft.startDate} um ${dep} Uhr.`},
    ...(draft.features?.upload!==false?[{question:'Wie funktioniert der Fotoupload?',answer:'Fotos und kurze Videos werden über den geschützten Bereich mit dem schulischen Microsoft-365-Konto eingereicht und vor einer Veröffentlichung geprüft.'}]:[]),
    ...(a.name?[{question:'Wo ist unsere Unterkunft?',answer:`${a.name}${a.address?`, ${a.address}`:''}.`}]:[])
  ]};
}
function draftJourneyResource(draft){
  const dep=draft.website?.departureTime||'20:00',ret=draft.website?.returnTime||'23:59';
  return {enabled:draft.features?.smartJourney!==false,automaticStatus:true,timezone:'Europe/Vienna',trip:{name:draft.title,start:`${draft.startDate}T${dep}:00`,end:`${draft.endDate}T${ret}:00`},before:{emoji:'⏳',title:`${draft.title} rückt näher`,text:`Die Reise startet am ${draft.startDate}.`},after:{emoji:'🎉',title:`${draft.title} ist abgeschlossen`,text:'Reisetagebuch, Galerie und Reiseinformationen bleiben weiterhin erreichbar.'},days:(draft.program?.days||[]).map(day=>({date:day.date,programId:day.id,emoji:'📍',title:day.title,status:day.subtitle||'',place:draft.destination}))};
}
async function draftResource(draft,resource,env){
  if(resource==='site')return draftSiteResource(draft);
  if(resource==='program')return draftProgramResource(draft);
  if(resource==='places')return await draftPlacesResource(draft,env);
  if(resource==='downloads')return draftDownloadsResource(draft);
  if(resource==='faq')return draftFaqResource(draft);
  if(resource==='journey')return draftJourneyResource(draft);
  if(resource==='news')return {news:[]};
  if(resource==='gallery')return {photos:[]};
  if(resource==='diary')return {entries:[]};
  return null;
}

async function listTripDrafts(env){
  if(!env.MEDIA_BUCKET)return [];
  const prefix='__system/trips/drafts/';
  let cursor=undefined,rows=[];
  do{
    const page=await env.MEDIA_BUCKET.list({prefix,limit:1000,cursor});
    for(const object of page.objects||[]){
      try{
        const stored=await env.MEDIA_BUCKET.get(object.key);
        if(!stored)continue;
        const draft=JSON.parse(await stored.text());
        if(draft?.id)rows.push(draft);
      }catch{}
    }
    cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
  rows.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  return rows;
}
async function getTripDraft(env,id){
  if(!env.MEDIA_BUCKET)return null;
  const normalized=normalizeTripId(id);
  if(!normalized)return null;
  const object=await env.MEDIA_BUCKET.get(tripDraftKey(normalized));
  if(!object)return null;
  try{return JSON.parse(await object.text())}catch{return null}
}


// --- Ende DEV 14.0 Modul 1 ---

const MEDIA_ALLOWED_DOMAIN = 'bs-rohrbach.ac.at';
const MEDIA_MAX_IMAGE_BYTES = 12 * 1024 * 1024;
// Cloudflare Free erlaubt max. 100 MB Request-Body. 90 MB lässt Reserve für den Upload.
const MEDIA_MAX_VIDEO_BYTES = 90 * 1024 * 1024;
const MEDIA_MAX_VIDEO_SECONDS = 30;
const MEDIA_MAX_FILES_PER_BATCH = 10;
// Bewusste Sicherheitsreserve unter dem kostenlosen 10-GB-R2-Kontingent.
const MEDIA_STORAGE_LIMIT_BYTES = 9_000_000_000;
const MEDIA_IMAGE_TYPES = new Map([
  ['image/jpeg','jpg'], ['image/png','png'], ['image/webp','webp'],
  ['image/heic','heic'], ['image/heif','heif']
]);
const MEDIA_VIDEO_TYPES = new Map([
  ['video/mp4','mp4'], ['video/quicktime','mov']
]);

function base64UrlDecodeJson(token=''){
  try{
    const part=String(token).split('.')[1]||'';
    const normalized=part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=');
    const bytes=Uint8Array.from(atob(normalized),c=>c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }catch{return {}}
}

function bearerToken(request){
  const value=String(request.headers.get('authorization')||'');
  return /^Bearer\s+/i.test(value)?value.replace(/^Bearer\s+/i,'').trim():'';
}

async function verifySchoolUser(request,env){
  const token=bearerToken(request);
  if(!token)throw Object.assign(new Error('Microsoft-Anmeldung fehlt.'),{status:401});

  // Graph validiert das Token kryptografisch. /me liefert nur bei einem gültigen User-Token Daten.
  const response=await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail',{headers:{authorization:`Bearer ${token}`}});
  if(!response.ok){
    const raw=await response.text().catch(()=>"");
    const error=Object.assign(new Error('Microsoft-Anmeldung ist abgelaufen oder ungültig.'),{status:401,raw:raw.slice(0,600)});
    throw error;
  }
  const me=await response.json();
  const claims=base64UrlDecodeJson(token);
  const expectedTenant=String(env.MS_TENANT_ID||'').trim().toLowerCase();
  const tenant=String(claims.tid||'').trim().toLowerCase();
  const email=String(me.userPrincipalName||me.mail||'').trim().toLowerCase();
  if(!expectedTenant||tenant!==expectedTenant)throw Object.assign(new Error('Dieses Microsoft-Konto gehört nicht zum BS-Rohrbach-Mandanten.'),{status:403});
  if(!email.endsWith(`@${MEDIA_ALLOWED_DOMAIN}`))throw Object.assign(new Error('Nur Microsoft-Konten der BS Rohrbach dürfen Medien hochladen.'),{status:403});
  return {
    id:String(me.id||claims.oid||claims.sub||'').trim(),
    name:String(me.displayName||email).trim().slice(0,120),
    email,
    tenantId:tenant
  };
}

function cleanText(value,max=180){return String(value||'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').slice(0,max)}
function decodeHeader(value=''){try{return decodeURIComponent(String(value||''))}catch{return String(value||'')}}
function safeObjectSegment(value=''){return String(value||'unknown').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)||'unknown'}
function mediaKindForType(type=''){if(MEDIA_IMAGE_TYPES.has(type))return'image';if(MEDIA_VIDEO_TYPES.has(type))return'video';return null}
function mediaExtension(type=''){return MEDIA_IMAGE_TYPES.get(type)||MEDIA_VIDEO_TYPES.get(type)||'bin'}

async function r2Usage(bucket){
  let cursor=undefined,totalBytes=0,totalObjects=0,pages=0;
  do{
    const page=await bucket.list({limit:1000,cursor});
    pages++;
    for(const object of page.objects||[]){
      if(!String(object.key||'').startsWith('__system/')){totalBytes+=Number(object.size||0);totalObjects++}
    }
    cursor=page.truncated?page.cursor:undefined;
    if(pages>1000)throw new Error('Speicherstatistik konnte nicht vollständig gelesen werden.');
  }while(cursor);
  return {totalBytes,totalObjects};
}

function mediaError(error){
  const status=normalizeHttpStatus(error?.status,500);
  return json({ok:false,message:error?.message||String(error)},status);
}

async function handleMediaConfig(url,env){
  const tenantId=String(env.MS_TENANT_ID||'').trim();
  const clientId=String(env.MS_CLIENT_ID||'').trim();
  const project=mediaProjectFromUrl(url);
  let tripTitle='Brüssel 2026',destination='Brüssel',theme={primary:'#0b4f8a',accent:'#f2c94c'},heroUrl='',backUrl='/',startDate=TRIP_REGISTRY[DEFAULT_TRIP_ID]?.startDate||'',endDate=TRIP_REGISTRY[DEFAULT_TRIP_ID]?.endDate||'';
  if(project!==DEFAULT_TRIP_ID){
    const meta=await getPublishedMeta(env,project);
    if(meta?.published){
      const siteObject=await env.MEDIA_BUCKET.get(publishedResourceKey(project,'site'));
      if(siteObject){
        try{
          const site=JSON.parse(await siteObject.text());
          tripTitle=String(site.tripTitle||meta.title||project);
          destination=String(site.destination||meta.destination||'Reise');
          theme=site.theme||theme;
          startDate=String(site.startDate||site.departureDate||site.departure||'').slice(0,10);
          endDate=String(site.endDate||site.returnDate||'').slice(0,10);
          backUrl=tripPublicPath(project);
          if(site.heroKey)heroUrl=`${url.origin}/api/trips/public-image?trip=${encodeURIComponent(project)}&key=${encodeURIComponent(site.heroKey)}`;
        }catch{}
      }
    }
  }
  return json({
    configured:Boolean(tenantId&&clientId),tenantId,clientId,
    redirectUri:`${url.origin}/upload.html`,project,
    tripTitle,tripLabel:project===DEFAULT_TRIP_ID?'Brüssel 2026':tripTitle,destination,theme,heroUrl,backUrl,
    publicUrl:project===DEFAULT_TRIP_ID?'/bruessel-2026/':backUrl,startDate,endDate,
    schoolDomain:MEDIA_ALLOWED_DOMAIN,
    maxFiles:MEDIA_MAX_FILES_PER_BATCH,
    maxImageBytes:MEDIA_MAX_IMAGE_BYTES,
    maxVideoBytes:MEDIA_MAX_VIDEO_BYTES,
    maxVideoSeconds:MEDIA_MAX_VIDEO_SECONDS,
    storageLimitBytes:MEDIA_STORAGE_LIMIT_BYTES,
    version:VERSION
  });
}

async function handleMediaStatus(request,env){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyMediaUploader(request,env,project);
    const usage=await r2Usage(env.MEDIA_BUCKET);
    return json({ok:true,user,usage,limitBytes:MEDIA_STORAGE_LIMIT_BYTES,remainingBytes:Math.max(0,MEDIA_STORAGE_LIMIT_BYTES-usage.totalBytes),project});
  }catch(error){return mediaError(error)}
}

async function handleMediaUpload(request,env){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyMediaUploader(request,env,project);
    if(!user.id)throw Object.assign(new Error('Microsoft-Benutzerkennung fehlt.'),{status:403});

    const contentType=String(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    const kind=mediaKindForType(contentType);
    if(!kind)throw Object.assign(new Error('Dieses Datei-/Medienformat wird nicht unterstützt.'),{status:415});

    const declaredSize=Number(request.headers.get('x-file-size')||request.headers.get('content-length')||0);
    const contentLength=Number(request.headers.get('content-length')||0);
    const maxBytes=kind==='image'?MEDIA_MAX_IMAGE_BYTES:MEDIA_MAX_VIDEO_BYTES;
    if(!Number.isFinite(declaredSize)||declaredSize<=0)throw Object.assign(new Error('Dateigröße fehlt.'),{status:400});
    if(declaredSize>maxBytes||contentLength>maxBytes)throw Object.assign(new Error(kind==='image'?'Foto ist größer als 12 MB.':'Video ist größer als 90 MB.'),{status:413});

    const duration=Number(request.headers.get('x-video-duration')||0);
    if(kind==='video'&&(!Number.isFinite(duration)||duration<=0||duration>MEDIA_MAX_VIDEO_SECONDS+0.25)){
      throw Object.assign(new Error('Videos dürfen höchstens 30 Sekunden lang sein.'),{status:400});
    }

    const originalName=cleanText(decodeHeader(request.headers.get('x-file-name')),160)||`datei.${mediaExtension(contentType)}`;
    let meta={};
    const encodedMeta=String(request.headers.get('x-media-meta')||'');
    if(encodedMeta){
      try{
        const normalized=encodedMeta.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encodedMeta.length/4)*4,'=');
        const bytes=Uint8Array.from(atob(normalized),c=>c.charCodeAt(0));
        meta=JSON.parse(new TextDecoder().decode(bytes));
      }catch{throw Object.assign(new Error('Upload-Metadaten sind ungültig.'),{status:400})}
    }
    const day=cleanText(meta.day,80),program=cleanText(meta.program,140),description=cleanText(meta.description,180);
    if(!day||!program)throw Object.assign(new Error('Reisetag und Programmpunkt sind erforderlich.'),{status:400});

    const usage=await r2Usage(env.MEDIA_BUCKET);
    if(usage.totalBytes+declaredSize>MEDIA_STORAGE_LIMIT_BYTES){
      throw Object.assign(new Error('Der sichere Speichergrenzwert ist erreicht. Bitte zuerst alte Medien archivieren oder löschen.'),{status:507});
    }

    const now=new Date();
    const uploadedAt=now.toISOString();
    const ext=mediaExtension(contentType);
    const folder=kind==='image'?'images':'videos';
    const userSegment=safeObjectSegment(user.id);
    const key=`${project}/pending/${folder}/${userSegment}/${now.getTime()}-${crypto.randomUUID()}.${ext}`;

    await env.MEDIA_BUCKET.put(key,request.body,{
      httpMetadata:{contentType,contentDisposition:`inline; filename*=UTF-8''${encodeURIComponent(originalName)}`},
      customMetadata:{
        status:'pending',project,mediaType:kind,originalName,
        uploaderId:user.id.slice(0,120),uploaderName:user.name,uploaderEmail:user.email,
        day,program,description,uploadedAt,
        durationSeconds:kind==='video'?String(Math.round(duration*10)/10):''
      }
    });

    return json({ok:true,key,status:'pending',mediaType:kind,uploadedAt,fileName:originalName,size:declaredSize,storage:{usedBefore:usage.totalBytes,limitBytes:MEDIA_STORAGE_LIMIT_BYTES}});
  }catch(error){return mediaError(error)}
}
// --- Ende DEV.9 R2-Medieneingang ---

// --- DEV.10: Admin-Medienfreigabe ---
// --- Version 13.5: reisebezogene Rollenbasis ---
const TRIP_ACCESS = Object.freeze({
  'bruessel-2026': Object.freeze({
    'j.vierlinger@bs-rohrbach.ac.at': {role:'admin', name:'Jürgen Vierlinger'},
    'd.lummerstorfer@bs-rohrbach.ac.at': {role:'teacher', name:'Dominik Lummerstorfer'},
    'd.gabriel@bs-rohrbach.ac.at': {role:'teacher', name:'Daniela Gabriel'}
  }),
  'linz-2027': Object.freeze({
    'j.vierlinger@bs-rohrbach.ac.at': {role:'admin', name:'Jürgen Vierlinger'}
  })
});

const TEACHER_HANDBOOK_KEY='__system/docs/teacher-handbook/current.pdf';
const TEACHER_HANDBOOK_META_KEY='__system/docs/teacher-handbook/meta.json';
const TEACHER_HANDBOOK_BACKUP_PREFIX='__system/docs/teacher-handbook/backups/';

async function teacherHandbookMeta(env){
  if(!env.MEDIA_BUCKET)return {exists:false};
  const obj=await env.MEDIA_BUCKET.get(TEACHER_HANDBOOK_META_KEY);
  if(!obj)return {exists:false};
  try{return JSON.parse(await obj.text())}catch{return {exists:false}}
}
async function handleTeacherHandbookGet(request,env){
  try{
    const project=mediaProjectFromRequest(request);
    await verifyTripRole(request,env,['admin','teacher'],project);
    if(!env.MEDIA_BUCKET)throw Object.assign(new Error('Dokumentenspeicher ist nicht verfügbar.'),{status:503});
    const obj=await env.MEDIA_BUCKET.get(TEACHER_HANDBOOK_KEY);
    if(!obj){
      const seed=await env.ASSETS.fetch(new Request(new URL('/docs/lehrkraefte-handbuch-seed.pdf',request.url)));
      if(!seed.ok)throw Object.assign(new Error('Noch kein Lehrkräfte-Handbuch hinterlegt.'),{status:404});
      return new Response(seed.body,{headers:{
        'content-type':'application/pdf','cache-control':'no-store',
        'content-disposition':'inline; filename="BS-Rohrbach-Erasmus-Lehrkraefte-Handbuch.pdf"',
        'x-handbook-source':'seed'
      }});
    }
    return new Response(obj.body,{headers:{
      'content-type':'application/pdf','cache-control':'no-store',
      'content-disposition':'inline; filename="BS-Rohrbach-Erasmus-Lehrkraefte-Handbuch.pdf"',
      'x-handbook-source':'r2'
    }});
  }catch(error){return mediaError(error)}
}
async function handleTeacherHandbookMeta(request,env){
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyTripRole(request,env,['admin','teacher'],project);
    let meta=await teacherHandbookMeta(env);
    if(!meta?.exists)meta={exists:true,source:'seed',filename:'BS-Rohrbach-Erasmus-Lehrkraefte-Handbuch.pdf',updatedAt:'2026-08-21T00:00:00.000Z',size:1009433};
    return json({ok:true,project,user:{email:user.email,name:user.access?.name,role:user.access?.role},meta});
  }catch(error){return mediaError(error)}
}
async function handleTeacherHandbookUpload(request,env){
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyTripRole(request,env,['admin'],project);
    if(!env.MEDIA_BUCKET)throw Object.assign(new Error('Dokumentenspeicher ist nicht verfügbar.'),{status:503});
    const ct=String(request.headers.get('content-type')||'').toLowerCase();
    if(!ct.includes('application/pdf'))throw Object.assign(new Error('Es sind nur PDF-Dateien erlaubt.'),{status:415});
    const data=await request.arrayBuffer();
    if(data.byteLength<4||data.byteLength>25*1024*1024)throw Object.assign(new Error('PDF-Datei ist leer oder größer als 25 MB.'),{status:400});
    if(new TextDecoder().decode(data.slice(0,4))!=='%PDF')throw Object.assign(new Error('Die hochgeladene Datei ist keine gültige PDF-Datei.'),{status:400});
    const now=new Date().toISOString();
    const current=await env.MEDIA_BUCKET.get(TEACHER_HANDBOOK_KEY);
    const oldMeta=await teacherHandbookMeta(env);
    if(current){
      const stamp=(oldMeta?.updatedAt||now).replace(/[:.]/g,'-');
      await env.MEDIA_BUCKET.put(`${TEACHER_HANDBOOK_BACKUP_PREFIX}${stamp}.pdf`,await current.arrayBuffer(),{
        httpMetadata:{contentType:'application/pdf'},
        customMetadata:{backupOf:'teacher-handbook',createdAt:now}
      });
    }
    await env.MEDIA_BUCKET.put(TEACHER_HANDBOOK_KEY,data,{
      httpMetadata:{contentType:'application/pdf'},
      customMetadata:{updatedAt:now,updatedBy:String(user.email||''),filename:'BS-Rohrbach-Erasmus-Lehrkraefte-Handbuch.pdf'}
    });
    const meta={exists:true,source:'r2',updatedAt:now,updatedBy:String(user.email||''),size:data.byteLength,filename:'BS-Rohrbach-Erasmus-Lehrkraefte-Handbuch.pdf',previousAvailable:Boolean(current)};
    await env.MEDIA_BUCKET.put(TEACHER_HANDBOOK_META_KEY,JSON.stringify(meta,null,2),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
    return json({ok:true,meta});
  }catch(error){return mediaError(error)}
}

const ROLE_PERMISSIONS = Object.freeze({
  admin:['media.moderate','diary.manage','live.manage','gallery.manage','users.manage','technical.manage'],
  teacher:['media.moderate','diary.manage','live.manage','gallery.manage'],
  student:['media.upload']
});
function staticTripAccessFor(email,project=MEDIA_PROJECT){
  const normalized=String(email||'').trim().toLowerCase();
  const entry=TRIP_ACCESS[project]?.[normalized]||null;
  return entry?{project,email:normalized,role:entry.role,name:entry.name,permissions:ROLE_PERMISSIONS[entry.role]||[]}:null;
}
function studentAccessKey(project=MEDIA_PROJECT){return `__system/access/${project}/students.json`}
async function loadStudentAccess(env,project=MEDIA_PROJECT){
  if(!env.MEDIA_BUCKET)return [];
  const object=await env.MEDIA_BUCKET.get(studentAccessKey(project));
  if(!object)return [];
  try{
    const data=JSON.parse(await object.text());
    const rows=Array.isArray(data?.students)?data.students:[];
    return rows.map(x=>({email:String(x?.email||'').trim().toLowerCase(),name:cleanText(x?.name,120)}))
      .filter(x=>x.email.endsWith(`@${MEDIA_ALLOWED_DOMAIN}`));
  }catch{
    throw Object.assign(new Error('Die gespeicherte Schüler*innenliste ist beschädigt.'),{status:500});
  }
}
async function saveStudentAccess(env,students,admin,project=MEDIA_PROJECT){
  if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
  const unique=new Map();
  for(const item of Array.isArray(students)?students:[]){
    const email=String(item?.email||'').trim().toLowerCase();
    if(!email||!email.endsWith(`@${MEDIA_ALLOWED_DOMAIN}`))continue;
    unique.set(email,{email,name:cleanText(item?.name,120)});
    if(unique.size>500)throw Object.assign(new Error('Maximal 500 Schüler*innen pro Reise sind zulässig.'),{status:400});
  }
  const payload={project,updatedAt:new Date().toISOString(),updatedBy:String(admin?.email||''),students:[...unique.values()]};
  await env.MEDIA_BUCKET.put(studentAccessKey(project),JSON.stringify(payload,null,2),{
    httpMetadata:{contentType:'application/json; charset=utf-8'},
    customMetadata:{project,updatedAt:payload.updatedAt,updatedBy:payload.updatedBy}
  });
  return payload.students;
}
function tripRosterKey(project=MEDIA_PROJECT){return `__system/access/${project}/roster.json`}
function normalizeRosterRole(value){
  const role=String(value||'student').trim().toLowerCase();
  return ['admin','teacher','student'].includes(role)?role:'student';
}
function cleanRosterEntry(entry={}){
  const email=String(entry.email||'').trim().toLowerCase();
  if(!email||!email.endsWith(`@${MEDIA_ALLOWED_DOMAIN}`))return null;
  return {email,name:cleanText(entry.name||email,120),role:normalizeRosterRole(entry.role)};
}
async function loadTripRoster(env,project=MEDIA_PROJECT){
  if(!env.MEDIA_BUCKET)return [];
  const object=await env.MEDIA_BUCKET.get(tripRosterKey(project));
  if(!object)return [];
  try{
    const data=JSON.parse(await object.text());
    return (Array.isArray(data?.users)?data.users:[]).map(cleanRosterEntry).filter(Boolean);
  }catch{return []}
}
async function saveTripRoster(env,project,users,updatedBy=''){
  if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
  const map=new Map();
  for(const row of Array.isArray(users)?users:[]){
    const clean=cleanRosterEntry(row);
    if(clean)map.set(clean.email,clean);
  }
  const normalized=[...map.values()].sort((a,b)=>a.email.localeCompare(b.email));
  await env.MEDIA_BUCKET.put(tripRosterKey(project),JSON.stringify({
    project,users:normalized,updatedAt:new Date().toISOString(),updatedBy:String(updatedBy||'')
  },null,2),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  return normalized;
}
function tripLabelForProject(project){
  if(project===DEFAULT_TRIP_ID)return TRIP_REGISTRY[DEFAULT_TRIP_ID]?.title||'Brüssel 2026';
  return DRAFT_ROUTE_REGISTRY[project]?.title||project;
}
async function handleHelpAccess(request,env){
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyTripRole(request,env,['admin','teacher'],project);
    return json({
      ok:true,
      project,
      tripLabel:tripLabelForProject(project),
      user,
      role:user.access?.role||'',
      permissions:user.access?.permissions||[]
    });
  }catch(error){return mediaError(error)}
}

async function handleAccessRosterGet(request,env){
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyTripRole(request,env,['admin'],project);
    const dynamic=await loadTripRoster(env,project);
    const fixed=Object.entries(TRIP_ACCESS[project]||{}).map(([email,x])=>({
      email,name:x.name||email,role:x.role,source:'fixed',locked:true
    }));
    const fixedEmails=new Set(fixed.map(x=>x.email));
    const users=[...fixed,...dynamic.filter(x=>!fixedEmails.has(x.email)).map(x=>({...x,source:'roster',locked:false}))];
    users.sort((a,b)=>a.role.localeCompare(b.role)||a.email.localeCompare(b.email));
    return json({ok:true,project,tripLabel:tripLabelForProject(project),user,users,roles:['admin','teacher','student']});
  }catch(error){return mediaError(error)}
}
async function handleAccessRosterPut(request,env){
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyTripRole(request,env,['admin'],project);
    const body=await request.json().catch(()=>{throw Object.assign(new Error('Ungültige Teilnehmerdaten.'),{status:400})});
    const fixedEmails=new Set(Object.keys(TRIP_ACCESS[project]||{}).map(x=>x.toLowerCase()));
    const dynamic=(Array.isArray(body?.users)?body.users:[])
      .map(cleanRosterEntry).filter(Boolean).filter(x=>!fixedEmails.has(x.email));
    const users=await saveTripRoster(env,project,dynamic,user.email);
    return json({ok:true,project,tripLabel:tripLabelForProject(project),users,count:users.length,updatedAt:new Date().toISOString()});
  }catch(error){return mediaError(error)}
}

async function tripAccessFor(env,email,project=MEDIA_PROJECT){
  const normalized=String(email||'').trim().toLowerCase();
  const fixed=staticTripAccessFor(normalized,project);
  if(fixed)return fixed;
  const roster=(await loadTripRoster(env,project)).find(x=>x.email===normalized);
  if(roster)return {project,email:normalized,role:roster.role,name:roster.name||normalized,permissions:ROLE_PERMISSIONS[roster.role]||[]};
  const student=(await loadStudentAccess(env,project)).find(x=>x.email===normalized);
  return student?{project,email:normalized,role:'student',name:student.name||normalized,permissions:ROLE_PERMISSIONS.student}:null;
}
async function verifyTripRole(request,env,allowedRoles=[],project=mediaProjectFromRequest(request)){
  const user=await verifySchoolUser(request,env);
  const access=await tripAccessFor(env,user.email,project);
  if(!access||!allowedRoles.includes(access.role)){
    throw Object.assign(new Error('Für diesen Bereich fehlt die erforderliche Reiseberechtigung.'),{status:403});
  }
  return {...user,access};
}
async function verifyMediaAdmin(request,env,project=mediaProjectFromRequest(request)){
  return verifyTripRole(request,env,['admin','teacher'],project);
}
async function verifyMediaUploader(request,env,project=mediaProjectFromRequest(request)){
  return verifyTripRole(request,env,['admin','teacher','student'],project);
}
async function handleAccessMe(request,env){
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifySchoolUser(request,env);
    const access=await tripAccessFor(env,user.email,project);
    return json({ok:true,user,access,project,tripLabel:tripLabelForProject(project)});
  }catch(error){return mediaError(error)}
}
async function handleAccessUsers(request,env){
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyTripRole(request,env,['admin'],project);
    const fixed=Object.entries(TRIP_ACCESS[project]||{}).map(([email,x])=>({
      email,name:x.name,role:x.role,permissions:ROLE_PERMISSIONS[x.role]||[]
    }));
    const roster=await loadTripRoster(env,project);
    const fixedEmails=new Set(fixed.map(x=>x.email));
    const dynamic=roster.filter(x=>!fixedEmails.has(x.email)).map(x=>({
      email:x.email,name:x.name||x.email,role:x.role,permissions:ROLE_PERMISSIONS[x.role]||[]
    }));
    return json({ok:true,user,project,tripLabel:tripLabelForProject(project),users:[...fixed,...dynamic]});
  }catch(error){return mediaError(error)}
}
async function handleStudentAccessGet(request,env){
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyTripRole(request,env,['admin'],project);
    const students=await loadStudentAccess(env,project);
    return json({ok:true,user,project,tripLabel:tripLabelForProject(project),students});
  }catch(error){return mediaError(error)}
}
async function handleStudentAccessPut(request,env){
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyTripRole(request,env,['admin'],project);
    const body=await request.json().catch(()=>{throw Object.assign(new Error('Ungültige Importdaten.'),{status:400})});
    const students=await saveStudentAccess(env,body?.students,user,project);
    return json({ok:true,project,tripLabel:tripLabelForProject(project),students,count:students.length,updatedAt:new Date().toISOString()});
  }catch(error){return mediaError(error)}
}
// --- Ende Version 13.5 Rollenbasis ---
function pendingPrefix(project=MEDIA_PROJECT){return `${project}/pending/`}
function approvedPrefix(project=MEDIA_PROJECT){return `${project}/approved/`}
function approvedKeyFor(key){return String(key).replace(`/${'pending'}/`,`/approved/`)}
function validPendingKey(key,project=MEDIA_PROJECT){return String(key||'').startsWith(pendingPrefix(project)) && !String(key).includes('..')}
function validApprovedKey(key,project=MEDIA_PROJECT){return String(key||'').startsWith(approvedPrefix(project)) && !String(key).includes('..')}
function validAdminMediaKey(key,project=MEDIA_PROJECT){return validPendingKey(key,project)||validApprovedKey(key,project)}

async function handleMediaAdminList(request,env){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyMediaAdmin(request,env,project);
    async function collect(prefix){
      let cursor=undefined,rows=[];
      do{
        const page=await env.MEDIA_BUCKET.list({prefix,limit:1000,cursor,include:['httpMetadata','customMetadata']});
        for(const o of page.objects||[]){
          const m=o.customMetadata||{};
          rows.push({key:o.key,size:Number(o.size||0),uploaded:o.uploaded||m.uploadedAt||'',etag:o.etag||'',contentType:o.httpMetadata?.contentType||'',metadata:m});
        }
        cursor=page.truncated?page.cursor:undefined;
      }while(cursor);
      rows.sort((a,b)=>String(b.metadata?.uploadedAt||b.uploaded).localeCompare(String(a.metadata?.uploadedAt||a.uploaded)));
      return rows;
    }
    const [items,approvedItems]=await Promise.all([collect(pendingPrefix(project)),collect(approvedPrefix(project))]);
    const usage=await r2Usage(env.MEDIA_BUCKET);
    return json({ok:true,user,items,approvedItems,usage,limitBytes:MEDIA_STORAGE_LIMIT_BYTES,project});
  }catch(error){return mediaError(error)}
}

async function handleMediaAdminFile(request,env,url){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    const project=mediaProjectFromRequest(request);
    await verifyMediaAdmin(request,env,project);
    const key=url.searchParams.get('key')||'';
    if(!validAdminMediaKey(key,project))throw Object.assign(new Error('Ungültiger Medienpfad für diese Reise.'),{status:400});
    const object=await env.MEDIA_BUCKET.get(key);
    if(!object)throw Object.assign(new Error('Medium wurde nicht gefunden.'),{status:404});
    const headers=new Headers(); object.writeHttpMetadata(headers); headers.set('etag',object.httpEtag||''); headers.set('cache-control','private, no-store'); headers.set('x-content-type-options','nosniff');
    return new Response(object.body,{headers});
  }catch(error){return mediaError(error)}
}

async function handleMediaAdminApprove(request,env){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    const project=mediaProjectFromRequest(request);
    const user=await verifyMediaAdmin(request,env,project);
    const body=await request.json().catch(()=>({})),key=String(body.key||'');
    if(!validPendingKey(key,project))throw Object.assign(new Error('Ungültiger Medienpfad für diese Reise.'),{status:400});
    const object=await env.MEDIA_BUCKET.get(key);
    if(!object)throw Object.assign(new Error('Medium wurde nicht gefunden.'),{status:404});
    const target=approvedKeyFor(key),meta={...(object.customMetadata||{}),project,status:'approved',approvedAt:new Date().toISOString(),approvedBy:user.email};
    await env.MEDIA_BUCKET.put(target,object.body,{httpMetadata:object.httpMetadata,customMetadata:meta});
    await env.MEDIA_BUCKET.delete(key);
    return json({ok:true,key:target,status:'approved',project});
  }catch(error){return mediaError(error)}
}

async function handleMediaAdminDelete(request,env){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    const project=mediaProjectFromRequest(request);
    await verifyMediaAdmin(request,env,project);
    const body=await request.json().catch(()=>({})),key=String(body.key||'');
    if(!validAdminMediaKey(key,project))throw Object.assign(new Error('Ungültiger Medienpfad für diese Reise.'),{status:400});
    const head=await env.MEDIA_BUCKET.head(key);
    if(!head)throw Object.assign(new Error('Medium wurde nicht gefunden.'),{status:404});
    await env.MEDIA_BUCKET.delete(key);
    return json({ok:true,deleted:key,freedBytes:Number(head.size||0),project});
  }catch(error){return mediaError(error)}
}
// --- Ende DEV.10 Admin-Medienfreigabe ---

// --- DEV.11: öffentliche Galerie aus freigegebenen R2-Medien ---
async function handleMediaGallery(env,url){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'Galerie-Speicher ist derzeit nicht verfügbar.'},503);
  const project=mediaProjectFromUrl(url);
  let cursor=undefined,items=[];
  do{
    const page=await env.MEDIA_BUCKET.list({prefix:approvedPrefix(project),limit:1000,cursor,include:['httpMetadata','customMetadata']});
    for(const o of page.objects||[]){
      const m=o.customMetadata||{},type=m.mediaType==='video'||String(o.httpMetadata?.contentType||'').startsWith('video/')?'video':'image';
      items.push({
        id:o.key,mediaType:type,
        image:`${url.origin}/api/media/gallery/file?trip=${encodeURIComponent(project)}&key=${encodeURIComponent(o.key)}`,
        title:m.program||m.day||'Reiseerinnerung',day:m.day||'Reise',program:m.program||'',description:m.description||'',
        alt:type==='image'?`${m.program||m.day||'Reisefoto'} – Erasmus+ BS Rohrbach`:'',uploadedAt:m.uploadedAt||'',approvedAt:m.approvedAt||''
      });
    }
    cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
  items.sort((a,b)=>String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
  return json({ok:true,project,items},200,{'cache-control':'public, max-age=60'});
}
async function handleMediaGalleryFile(env,url){
  if(!env.MEDIA_BUCKET)return new Response('Nicht verfügbar',{status:503});
  const project=mediaProjectFromUrl(url);
  const key=url.searchParams.get('key')||'';
  if(!validApprovedKey(key,project))return new Response('Ungültiger Medienpfad',{status:400});
  const object=await env.MEDIA_BUCKET.get(key);if(!object)return new Response('Nicht gefunden',{status:404});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag||'');headers.set('cache-control','public, max-age=3600');headers.set('x-content-type-options','nosniff');
  return new Response(object.body,{headers});
}
// --- Ende DEV.11 R2-Galerie ---



// --- Version 13.7: Microsoft-geschützte Reise-Redaktion über R2-Content-Overrides ---
const EDITOR_CONTENT = Object.freeze({
  diary:{file:'diary.json',permission:'diary.manage'},
  gallery:{file:'gallery.json',permission:'gallery.manage'},
  site:{file:'site.json',permission:'live.manage'}
});
function editorKey(project,name){return `__system/editor/${project}/${name}`}

async function staticContentJson(env,url,file){
  const response=await env.ASSETS.fetch(new Request(`${url.origin}/content/${file}`));
  if(!response.ok)throw Object.assign(new Error(`Inhaltsdatei ${file} konnte nicht geladen werden.`),{status:502});
  return response.json();
}
async function publishedContentJson(env,project,file){
  if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
  const resource=String(file||'').replace(/\.json$/,'');
  const object=await env.MEDIA_BUCKET.get(publishedResourceKey(project,resource));
  if(!object)throw Object.assign(new Error(`Veröffentlichter Inhalt ${file} wurde für diese Reise nicht gefunden.`),{status:404});
  return JSON.parse(await object.text());
}
async function effectiveContentJson(env,url,file,project=DEFAULT_TRIP_ID){
  if(env.MEDIA_BUCKET){
    const object=await env.MEDIA_BUCKET.get(editorKey(project,file));
    if(object){
      try{return JSON.parse(await object.text())}
      catch{throw Object.assign(new Error(`Redaktionsstand ${file} ist beschädigt.`),{status:500})}
    }
  }
  return project===DEFAULT_TRIP_ID?staticContentJson(env,url,file):publishedContentJson(env,project,file);
}
async function saveContentOverride(env,project,file,data,user){
  if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
  await env.MEDIA_BUCKET.put(editorKey(project,file),JSON.stringify(data,null,2),{
    httpMetadata:{contentType:'application/json; charset=utf-8'},
    customMetadata:{project,updatedAt:new Date().toISOString(),updatedBy:String(user.email||''),role:String(user.access?.role||'')}
  });
}
async function getEditorOverride(env,project,file){
  if(!env.MEDIA_BUCKET)return null;
  return env.MEDIA_BUCKET.get(editorKey(project,file));
}
async function handlePublicContentOverride(env,url,file){
  const object=await getEditorOverride(env,DEFAULT_TRIP_ID,file);
  if(!object)return null;
  const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  headers.set('x-editor-source','r2');
  headers.set('x-editor-trip',DEFAULT_TRIP_ID);
  return new Response(object.body,{headers});
}
function requirePermission(user,permission){
  if(!user?.access?.permissions?.includes(permission)){
    throw Object.assign(new Error('Für diese Funktion fehlt die erforderliche Berechtigung.'),{status:403});
  }
}
function cleanDiary(data,user){
  const entries=Array.isArray(data?.entries)?data.entries.slice(0,100):[];
  return {entries:entries.map(item=>({
    published:Boolean(item?.published),
    date:cleanText(item?.date,20),
    time:cleanText(item?.time,30),
    emoji:cleanText(item?.emoji,12)||'📖',
    title:cleanText(item?.title,140),
    location:cleanText(item?.location,120),
    text:cleanText(item?.text,6000),
    approvedPhotos:Array.isArray(item?.approvedPhotos)?item.approvedPhotos.slice(0,20).map(x=>String(x||'').slice(0,700)).filter(Boolean):[],
    tags:Array.isArray(item?.tags)?item.tags.slice(0,12).map(x=>cleanText(typeof x==='string'?x:x?.tag,40)).filter(Boolean):[],
    author:cleanText(item?.author,100)||cleanText(user?.access?.name,100)||'BS Rohrbach'
  })).filter(x=>x.title&&x.date&&x.text)};
}
function cleanGallery(data){
  const photos=Array.isArray(data?.photos)?data.photos.slice(0,100):[];
  return {photos:photos.map(item=>({
    title:cleanText(item?.title,140),
    day:cleanText(item?.day,80),
    image:String(item?.image||'').trim().slice(0,700),
    description:cleanText(item?.description||item?.text,1000),
    alt:cleanText(item?.alt,240),
    credit:cleanText(item?.credit,240)
  })).filter(x=>x.title&&x.image)};
}
function cleanLiveStatus(input){
  const allowedTypes=new Set(['info','success','warning','important']);
  const mode=input?.mode==='manual'?'manual':'automatic';
  const type=allowedTypes.has(input?.type)?input.type:'info';
  return {
    mode,
    enabled:mode==='manual',
    type,
    emoji:cleanText(input?.emoji,12)||'📢',
    title:cleanText(input?.title,120)||'Aktueller Reisestatus',
    text:cleanText(input?.text,800),
    updated:mode==='manual'?new Date().toISOString():''
  };
}
async function handleEditorGet(request,env,url,kind){
  try{
    const project=mediaProjectFromRequest(request);
    const def=EDITOR_CONTENT[kind];
    if(!def)throw Object.assign(new Error('Unbekannter Redaktionsbereich.'),{status:404});
    const user=await verifyTripRole(request,env,['admin','teacher'],project);
    requirePermission(user,def.permission);
    const data=await effectiveContentJson(env,url,def.file,project);
    return json({ok:true,project,tripLabel:tripLabelForProject(project),user:{email:user.email,name:user.access?.name,role:user.access?.role},data});
  }catch(error){return mediaError(error)}
}
async function handleEditorSave(request,env,url,kind){
  try{
    const project=mediaProjectFromRequest(request);
    const def=EDITOR_CONTENT[kind];
    if(!def)throw Object.assign(new Error('Unbekannter Redaktionsbereich.'),{status:404});
    const user=await verifyTripRole(request,env,['admin','teacher'],project);
    requirePermission(user,def.permission);
    const body=await request.json().catch(()=>{throw Object.assign(new Error('Ungültige JSON-Daten.'),{status:400})});
    let data;
    if(kind==='diary')data=cleanDiary(body,user);
    if(kind==='gallery')data=cleanGallery(body);
    if(kind==='site'){
      const current=await effectiveContentJson(env,url,def.file,project);
      data={...current,liveStatus:cleanLiveStatus(body?.liveStatus||body)};
    }
    await saveContentOverride(env,project,def.file,data,user);
    return json({ok:true,project,tripLabel:tripLabelForProject(project),savedAt:new Date().toISOString(),data});
  }catch(error){return mediaError(error)}
}
async function handleEditorReset(request,env,url,kind){
  try{
    const project=mediaProjectFromRequest(request);
    const def=EDITOR_CONTENT[kind];
    if(!def)throw Object.assign(new Error('Unbekannter Redaktionsbereich.'),{status:404});
    const user=await verifyTripRole(request,env,['admin'],project);
    if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
    await env.MEDIA_BUCKET.delete(editorKey(project,def.file));
    return json({ok:true,project,tripLabel:tripLabelForProject(project),message:'Redaktions-Override wurde entfernt.'});
  }catch(error){return mediaError(error)}
}
// --- Ende Version 13.7 Reise-Redaktion ---


export default {async fetch(request,env){
  const url=new URL(request.url);

    // --- DEV 14.1: öffentliche Multi-Reise-Startseite ---
    if(url.pathname==='/api/platform/trips'&&request.method==='GET'){
      const trips=[],archivedTrips=[];
      const pushTrip=(item,status)=>{(status==='archived'?archivedTrips:trips).push({...item,status,published:isPublicTripStatus(status)})};

      const brussels=TRIP_REGISTRY[DEFAULT_TRIP_ID];
      const brusselsStatus=await tripLifecycleStatus(env,brussels.id);
      if(isPublicTripStatus(brusselsStatus)){
        pushTrip({
          id:brussels.id,title:brussels.title,destination:brussels.destination,country:brussels.country,
          startDate:brussels.startDate,endDate:brussels.endDate,path:'/bruessel-2026/',
          heroUrl:'/images/hero.jpg'
        },brusselsStatus);
      }

      for(const route of Object.values(DRAFT_ROUTE_REGISTRY)){
        const meta=await getPublishedMeta(env,route.id);
        const status=await tripLifecycleStatus(env,route.id);
        if(!isPublicTripStatus(status)||!meta)continue;
        let site={};
        try{
          const object=await env.MEDIA_BUCKET.get(publishedResourceKey(route.id,'site'));
          if(object)site=JSON.parse(await object.text());
        }catch{}
        pushTrip({
          id:route.id,title:site.tripTitle||meta.title||route.title,
          destination:site.destination||meta.destination||route.destination,
          country:site.country||'',
          startDate:(site.startDate||site.departureDate||site.departure||'').slice(0,10),
          endDate:(site.endDate||site.returnDate||'').slice(0,10),
          path:tripPublicPath(route.id),
          heroUrl:site.heroKey?`${url.origin}/api/trips/public-image?trip=${encodeURIComponent(route.id)}&key=${encodeURIComponent(site.heroKey)}`:''
        },status);
      }
      const sorter=(a,b)=>String(a.startDate||'9999').localeCompare(String(b.startDate||'9999'));
      trips.sort(sorter);archivedTrips.sort((a,b)=>String(b.startDate||'').localeCompare(String(a.startDate||'')));
      return json({ok:true,mode:'platform-home',trips,archivedTrips},200,{'cache-control':'no-store, max-age=0'});
    }

    // --- DEV 14.0 Modul 9.0.1: Multi-Reise-Routing-Grundlage ---
    if(url.pathname==='/api/trips/routes'&&request.method==='GET'){
      const dynamicRoutes=[];
      for(const route of Object.values(DRAFT_ROUTE_REGISTRY)){
        const meta=await getPublishedMeta(env,route.id);
        const status=await tripLifecycleStatus(env,route.id);
        dynamicRoutes.push({
          id:route.id,title:meta?.title||route.title,destination:meta?.destination||route.destination,path:tripPublicPath(route.id),
          status,published:isPublicTripStatus(status),draftId:route.draftId,
          publishedAt:meta?.publishedAt||'',offlineAt:meta?.offlineAt||'',archivedAt:meta?.archivedAt||''
        });
      }
      const registeredRoutes=[];
      for(const trip of Object.values(TRIP_REGISTRY)){
        const status=await tripLifecycleStatus(env,trip.id);
        registeredRoutes.push({
          id:trip.id,title:trip.title,path:tripPublicPath(trip.id),status,published:isPublicTripStatus(status)
        });
      }
      return json({
        ok:true,
        homepage:{path:'/',mode:'platform-overview',message:'Die Hauptadresse zeigt die Erasmus+ Reiseübersicht.'},
        routes:[...registeredRoutes,...dynamicRoutes],
        publishingEnabled:true
      });
    }

    // Reisebezogener Medienupload: eigener Pfad je Reise.
    if((url.pathname==='/linz-2027/upload'||url.pathname==='/linz-2027/upload/')&&request.method==='GET'){
      const status=await tripLifecycleStatus(env,'linz-2027');
      if(!isPublicTripStatus(status))return new Response('Reise ist derzeit nicht öffentlich.',{status:404});
      const asset=await env.ASSETS.fetch(new Request(`${url.origin}/upload.html?v=14.1.4-dev`,{
        method:'GET',headers:{'cache-control':'no-cache'}
      }));
      const headers=new Headers(asset.headers);
      headers.set('cache-control','no-store, max-age=0');
      headers.set('pragma','no-cache');
      headers.set('x-bsr-upload-trip','linz-2027');
      return new Response(asset.body,{status:asset.status,headers});
    }

    // Reservierte neue Reise: nur veröffentlichte Snapshots werden öffentlich ausgeliefert.
    if((url.pathname==='/linz-2027'||url.pathname==='/linz-2027/')&&request.method==='GET'){
      const status=await tripLifecycleStatus(env,'linz-2027');
      if(isPublicTripStatus(status)){
        const asset=await env.ASSETS.fetch(new Request(`${url.origin}/reise.html?v=14.1.4-dev`,{method:'GET',headers:{'cache-control':'no-cache'}}));
        const headers=new Headers(asset.headers);
        headers.set('cache-control','no-store, max-age=0');
        headers.set('pragma','no-cache');
        headers.set('x-bsr-trip-shell','linz-2027/9.1.1');
        return new Response(asset.body,{status:asset.status,headers});
      }
      return new Response(
        '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reise noch nicht veröffentlicht</title></head><body><main style="font-family:system-ui,sans-serif;max-width:680px;margin:12vh auto;padding:28px"><h1>Diese Reise ist noch nicht veröffentlicht.</h1><p>Die URL <strong>/linz-2027/</strong> ist bereits reserviert, die Reise selbst bleibt bis zur Veröffentlichung geschützt.</p></main></body></html>',
        {status:404,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}}
      );
    }

    // Brüssel 2026 ist ab DEV 14.1 eine eigenständige Reise unter /bruessel-2026/.
    if((url.pathname==='/bruessel-2026'||url.pathname==='/bruessel-2026/')&&request.method==='GET'){
      const status=await tripLifecycleStatus(env,'bruessel-2026');
      if(!isPublicTripStatus(status))return new Response(
        '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reise offline</title></head><body><main style="font-family:system-ui,sans-serif;max-width:680px;margin:12vh auto;padding:28px"><h1>Diese Reise ist derzeit nicht öffentlich.</h1><p>Die Reise wurde vom Administrator offline genommen.</p><p><a href="/">← Zur Reiseübersicht</a></p></main></body></html>',
        {status:404,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}}
      );
      const asset=await env.ASSETS.fetch(new Request(`${url.origin}/bruessel.html?v=15.0.9-dev`,{method:'GET',headers:{'cache-control':'no-cache'}}));
      const headers=new Headers(asset.headers);
      headers.set('cache-control','no-store, max-age=0');
      headers.set('pragma','no-cache');
      headers.set('x-bsr-trip-shell','bruessel-2026/14.1.0');
      return new Response(asset.body,{status:asset.status,headers});
    }

    if(url.pathname==='/api/trips'&&request.method==='GET'){
      return json({ok:true,defaultTrip:DEFAULT_TRIP_ID,trips:Object.values(TRIP_REGISTRY)});
    }
    if(url.pathname==='/api/trips/current'&&request.method==='GET'){
      const id=resolveTripId(request,url);
      return json({ok:true,trip:tripConfig(id),defaultTrip:DEFAULT_TRIP_ID});
    }
    if(url.pathname==='/api/trips/public-health'&&request.method==='GET'){
      return json({ok:true,version:'15.0.9-dev',statusHelper:'ok'},200,{'x-bsr-health':'9.1.3'});
    }

    if(url.pathname==='/api/trips/public-resource'&&request.method==='GET'){
      try{
        const trip=normalizeTripId(url.searchParams.get('trip')),resource=String(url.searchParams.get('resource')||'');
        const meta=await getPublishedMeta(env,trip);
        const lifecycle=await tripLifecycleStatus(env,trip);
        if(!isPublicTripStatus(lifecycle)||!meta)throw Object.assign(new Error('Reise ist derzeit nicht öffentlich.'),{status:404});
        if(!['site','program','places','downloads','faq','news','gallery','diary','journey'].includes(resource))
          throw Object.assign(new Error('Unbekannte Reiseressource.'),{status:400});
        let object=null;
        if(['site','gallery','diary'].includes(resource))object=await getEditorOverride(env,trip,`${resource}.json`);
        if(!object)object=await env.MEDIA_BUCKET.get(publishedResourceKey(trip,resource));
        if(!object)throw Object.assign(new Error('Veröffentlichte Reiseressource fehlt.'),{status:404});
        const data=JSON.parse(await object.text());
        return json(data,200,{'cache-control':'public, max-age=60','x-bsr-public-trip':trip,'x-bsr-public-resource':resource,'x-bsr-editor-override':object.key?.startsWith('__system/editor/')?'1':'0'});
      }catch(error){return mediaError(error)}
    }

    if(url.pathname==='/api/trips/public-image'&&request.method==='GET'){
      try{
        const trip=normalizeTripId(url.searchParams.get('trip')),key=String(url.searchParams.get('key')||'');
        const meta=await getPublishedMeta(env,trip);
        const lifecycle=await tripLifecycleStatus(env,trip);
        if(!isPublicTripStatus(lifecycle)||!meta)throw Object.assign(new Error('Reise ist derzeit nicht öffentlich.'),{status:404});
        if(!key.startsWith(publishedAssetPrefix(trip)))throw Object.assign(new Error('Ungültiger veröffentlichter Bildpfad.'),{status:400});
        const object=await env.MEDIA_BUCKET.get(key);
        if(!object)return new Response('Nicht gefunden',{status:404});
        const headers=new Headers();object.writeHttpMetadata(headers);
        headers.set('cache-control','public, max-age=86400');headers.set('x-content-type-options','nosniff');
        return new Response(object.body,{headers});
      }catch(error){return mediaError(error)}
    }

    if(url.pathname==='/api/trips/publish'&&request.method==='POST'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
        const body=await request.json().catch(()=>({}));
        const draftId=normalizeTripId(body.draftId),route=publishRouteForDraft(draftId);
        if(!route)throw Object.assign(new Error('Für diesen Entwurf ist noch keine öffentliche Reise-URL reserviert.'),{status:400});
        const draft=await getTripDraft(env,draftId);
        if(!draft)throw Object.assign(new Error('Reise-Entwurf wurde nicht gefunden.'),{status:404});
        const issues=serverPublishIssues(draft);
        if(issues.length)throw Object.assign(new Error(`Veröffentlichung nicht möglich. Es fehlen: ${issues.join(', ')}`),{status:400});

        const names=['site','program','places','downloads','faq','news','gallery','diary','journey'];
        const resources={};
        for(const name of names){
          const data=await draftResource(draft,name,env);
          if(data===null||data===undefined)throw Object.assign(new Error(`Reiseressource ${name} konnte nicht erzeugt werden.`),{status:500});
          resources[name]=data;
        }
        await rewritePublishedImageKeys(env,route.id,resources);
        const publishedAt=new Date().toISOString();
        for(const [name,data] of Object.entries(resources)){
          await env.MEDIA_BUCKET.put(publishedResourceKey(route.id,name),JSON.stringify(data,null,2),{
            httpMetadata:{contentType:'application/json; charset=utf-8'},
            customMetadata:{routeId:route.id,draftId,publishedAt}
          });
        }
        const meta={
          id:route.id,draftId,title:draft.title,destination:draft.destination,
          status:'published',published:true,publishedAt,publishedBy:user.email,sourceDraftUpdatedAt:draft.updatedAt||''
        };
        await env.MEDIA_BUCKET.put(publishedMetaKey(route.id),JSON.stringify(meta,null,2),{
          httpMetadata:{contentType:'application/json; charset=utf-8'}
        });
        return json({ok:true,meta,url:`${url.origin}${tripPublicPath(route.id)}`,message:'Reise wurde veröffentlicht.'});
      }catch(error){return mediaError(error)}
    }

    if(url.pathname==='/api/trips/route-draft'&&request.method==='GET'){
      try{
        await verifyTripRole(request,env,['admin']);
        const routeId=normalizeTripId(url.searchParams.get('route'));
        const route=DRAFT_ROUTE_REGISTRY[routeId];
        if(!route)throw Object.assign(new Error('Unbekannte Entwurfs-Route.'),{status:404});
        const draft=await getTripDraft(env,route.draftId);
        if(!draft)throw Object.assign(new Error('Verknüpfter Reise-Entwurf wurde nicht gefunden.'),{status:404});
        return json({ok:true,route:{...route,path:tripPublicPath(route.id)},draft:{id:draft.id,title:draft.title,destination:draft.destination,status:draft.status||'draft'}});
      }catch(error){return mediaError(error)}
    }

    if(url.pathname==='/api/trips/drafts'&&request.method==='GET'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        const drafts=await listTripDrafts(env);
        const decorated=[];
        for(const draft of drafts){
          const route=publishRouteForDraft(draft.id);
          const routeStatus=route?await tripLifecycleStatus(env,route.id):'draft';
          decorated.push({...draft,routeId:route?.id||'',routeStatus});
        }
        return json({ok:true,user,drafts:decorated});
      }catch(error){return mediaError(error)}
    }
    if(url.pathname==='/api/trips/drafts'&&request.method==='POST'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
        const draft=cleanTripDraft(await request.json());
        const existing=await getTripDraft(env,draft.id);
        if(existing)throw Object.assign(new Error('Für diese Reise-ID existiert bereits ein Entwurf.'),{status:409});
        draft.createdAt=new Date().toISOString();draft.updatedAt=draft.createdAt;draft.createdBy=user.email;draft.updatedBy=user.email;
        await env.MEDIA_BUCKET.put(tripDraftKey(draft.id),JSON.stringify(draft,null,2),{httpMetadata:{contentType:'application/json'}});
        return json({ok:true,draft,message:'Entwurf gespeichert. Die Reise ist noch nicht veröffentlicht.'});
      }catch(error){return mediaError(error)}
    }
    if(url.pathname==='/api/trips/draft-resource'&&request.method==='GET'){
      try{
        await verifyTripRole(request,env,['admin']);
        const id=normalizeTripId(url.searchParams.get('id')),resource=String(url.searchParams.get('resource')||'');
        const draft=await getTripDraft(env,id);
        if(!draft)throw Object.assign(new Error('Entwurf wurde nicht gefunden.'),{status:404});
        const data=await draftResource(draft,resource,env);
        if(!data)throw Object.assign(new Error('Unbekannte Vorschau-Ressource.'),{status:400});
        return json(data);
      }catch(error){return mediaError(error)}
    }
    if(url.pathname==='/api/trips/draft-image'&&request.method==='GET'){
      try{
        await verifyTripRole(request,env,['admin']);
        if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
        const key=String(url.searchParams.get('key')||'');
        if(!key.startsWith('__system/trips/assets/'))throw Object.assign(new Error('Ungültiger Bildpfad.'),{status:400});
        const object=await env.MEDIA_BUCKET.get(key);
        if(!object)return new Response('Nicht gefunden',{status:404});
        const headers=new Headers();object.writeHttpMetadata(headers);headers.set('cache-control','private, max-age=300');headers.set('x-content-type-options','nosniff');
        if(object.customMetadata?.originalName)headers.set('x-original-filename',encodeURIComponent(object.customMetadata.originalName));
        return new Response(object.body,{headers});
      }catch(error){return mediaError(error)}
    }
    if(url.pathname==='/api/trips/draft-image'&&request.method==='DELETE'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
        const id=normalizeTripId(url.searchParams.get('id'));
        const key=String(url.searchParams.get('key')||'');
        const prefix=`__system/trips/assets/${id}/program/`;
        if(!id||!key.startsWith(prefix))throw Object.assign(new Error('Ungültiges Programmbild.'),{status:400});
        const draft=await getTripDraft(env,id);
        if(!draft)throw Object.assign(new Error('Entwurf wurde nicht gefunden.'),{status:404});
        await env.MEDIA_BUCKET.delete(key);
        draft.images=draft.images&&typeof draft.images==='object'?draft.images:{hero:'',hotel:'',program:[]};
        draft.images.program=(Array.isArray(draft.images.program)?draft.images.program:[]).filter(x=>x!==key);
        if(draft.program&&Array.isArray(draft.program.days)){
          draft.program.days.forEach(day=>(Array.isArray(day.events)?day.events:[]).forEach(event=>{
            const list=Array.isArray(event.images)?event.images:(event.image?[event.image]:[]);
            event.images=list.filter(x=>x!==key);event.image=event.images[0]||'';
          }));
        }
        draft.updatedAt=new Date().toISOString();draft.updatedBy=user.email;
        await env.MEDIA_BUCKET.put(tripDraftKey(id),JSON.stringify(draft,null,2),{httpMetadata:{contentType:'application/json'}});
        return json({ok:true,key,draft,message:'Programmbild gelöscht.'});
      }catch(error){return mediaError(error)}
    }
    if(url.pathname==='/api/trips/draft-image'&&request.method==='POST'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
        const id=normalizeTripId(url.searchParams.get('id'));
        const slot=String(url.searchParams.get('slot')||'');
        if(!id||!['hero','hotel','program'].includes(slot))throw Object.assign(new Error('Ungültige Reise oder Bildkategorie.'),{status:400});
        const draft=await getTripDraft(env,id);
        if(!draft)throw Object.assign(new Error('Bitte den Entwurf zuerst speichern.'),{status:404});
        const contentType=String(request.headers.get('content-type')||'').toLowerCase();
        if(!['image/jpeg','image/png','image/webp'].includes(contentType))throw Object.assign(new Error('Nur JPG, PNG oder WebP sind erlaubt.'),{status:400});
        const declaredSize=Number(request.headers.get('content-length')||0);
        if(declaredSize>12*1024*1024)throw Object.assign(new Error('Das Bild darf maximal 12 MB groß sein.'),{status:413});
        const ext=contentType==='image/png'?'png':contentType==='image/webp'?'webp':'jpg';
        const key=`__system/trips/assets/${id}/${slot}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        await env.MEDIA_BUCKET.put(key,request.body,{httpMetadata:{contentType},customMetadata:{tripId:id,slot,originalName:decodeURIComponent(String(request.headers.get('x-file-name')||'')).slice(0,180),uploadedBy:user.email,uploadedAt:new Date().toISOString()}});
        return json({ok:true,key,slot});
      }catch(error){return mediaError(error)}
    }
    if(url.pathname.startsWith('/api/trips/drafts/')&&request.method==='GET'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        const id=normalizeTripId(url.pathname.split('/').pop());
        const draft=await getTripDraft(env,id);
        if(!draft)throw Object.assign(new Error('Entwurf wurde nicht gefunden.'),{status:404});
        return json({ok:true,user,draft});
      }catch(error){return mediaError(error)}
    }
    if(url.pathname.startsWith('/api/trips/drafts/')&&request.method==='PUT'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
        const id=normalizeTripId(url.pathname.split('/').pop());
        const existing=await getTripDraft(env,id);
        if(!existing)throw Object.assign(new Error('Entwurf wurde nicht gefunden.'),{status:404});
        const draft=cleanTripDraft({...await request.json(),id});
        draft.createdAt=existing.createdAt||new Date().toISOString();draft.createdBy=existing.createdBy||user.email;
        draft.updatedAt=new Date().toISOString();draft.updatedBy=user.email;
        await env.MEDIA_BUCKET.put(tripDraftKey(id),JSON.stringify(draft,null,2),{httpMetadata:{contentType:'application/json'}});
        return json({ok:true,draft,message:'Entwurf aktualisiert.'});
      }catch(error){return mediaError(error)}
    }
    if(url.pathname.startsWith('/api/trips/drafts/')&&request.method==='DELETE'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
        const id=normalizeTripId(url.pathname.split('/').pop());
        const existing=await getTripDraft(env,id);
        if(!existing)throw Object.assign(new Error('Entwurf wurde nicht gefunden.'),{status:404});
        await env.MEDIA_BUCKET.delete(tripDraftKey(id));
        return json({ok:true,id,message:'Entwurf gelöscht.'});
      }catch(error){return mediaError(error)}
    }
    if(url.pathname==='/api/trips/status'&&request.method==='POST'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
        const body=await request.json().catch(()=>({}));
        const routeId=normalizeTripId(body.routeId),status=String(body.status||'').trim().toLowerCase();
        const meta=await setTripLifecycleStatus(env,routeId,status,user);
        return json({ok:true,routeId,status:meta.status,meta,message:
          status==='offline'?'Reise wurde offline genommen.':
          status==='archived'?'Reise wurde archiviert.':
          'Reise wurde wieder veröffentlicht.'});
      }catch(error){return mediaError(error)}
    }

    if(url.pathname==='/api/trips/admin'&&request.method==='GET'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        const trips=[];
        for(const trip of Object.values(TRIP_REGISTRY)){
          const status=await tripLifecycleStatus(env,trip.id);
          trips.push({...trip,status,published:isPublicTripStatus(status),path:tripPublicPath(trip.id),draftId:null});
        }
        for(const route of Object.values(DRAFT_ROUTE_REGISTRY)){
          const meta=await getPublishedMeta(env,route.id);
          const status=await tripLifecycleStatus(env,route.id);
          if(status==='draft')continue;
          const draft=await getTripDraft(env,route.draftId);
          trips.push({
            id:route.id,title:meta?.title||draft?.title||route.title,destination:meta?.destination||draft?.destination||route.destination,
            country:draft?.country||'',startDate:draft?.startDate||'',endDate:draft?.endDate||'',
            theme:draft?.theme||{},features:draft?.features||{},status,published:isPublicTripStatus(status),
            path:tripPublicPath(route.id),draftId:route.draftId
          });
        }
        return json({ok:true,user,defaultTrip:DEFAULT_TRIP_ID,trips});
      }catch(error){return mediaError(error)}
    }

  if(url.pathname==='/auth')return handleAuth(url,env);
  if(url.pathname==='/callback')return handleCallback(url,env);
  if(url.pathname==='/api/docs/teacher-handbook'&&request.method==='GET')return handleTeacherHandbookGet(request,env);
    if(url.pathname==='/api/docs/teacher-handbook/meta'&&request.method==='GET')return handleTeacherHandbookMeta(request,env);
    if(url.pathname==='/api/docs/teacher-handbook'&&request.method==='PUT')return handleTeacherHandbookUpload(request,env);
    if(url.pathname==='/api/access/me'&&request.method==='GET')return handleAccessMe(request,env);
    if(url.pathname==='/api/help/access'&&request.method==='GET')return handleHelpAccess(request,env);
    if(url.pathname==='/api/access/roster'&&request.method==='GET')return handleAccessRosterGet(request,env);
    if(url.pathname==='/api/access/roster'&&request.method==='PUT')return handleAccessRosterPut(request,env);
    if(url.pathname==='/api/access/users'&&request.method==='GET')return handleAccessUsers(request,env);
    if(url.pathname==='/api/access/students'&&request.method==='GET')return handleStudentAccessGet(request,env);
    if(url.pathname==='/api/access/students'&&request.method==='PUT')return handleStudentAccessPut(request,env);
    if(url.pathname==='/api/editor/diary'&&request.method==='GET')return handleEditorGet(request,env,url,'diary');
    if(url.pathname==='/api/editor/diary'&&request.method==='PUT')return handleEditorSave(request,env,url,'diary');
    if(url.pathname==='/api/editor/gallery'&&request.method==='GET')return handleEditorGet(request,env,url,'gallery');
    if(url.pathname==='/api/editor/gallery'&&request.method==='PUT')return handleEditorSave(request,env,url,'gallery');
    if(url.pathname==='/api/editor/live'&&request.method==='GET')return handleEditorGet(request,env,url,'site');
    if(url.pathname==='/api/editor/live'&&request.method==='PUT')return handleEditorSave(request,env,url,'site');
    if(url.pathname.startsWith('/api/editor/reset/')&&request.method==='POST')return handleEditorReset(request,env,url,url.pathname.split('/').pop());
    if(request.method==='GET'&&['/content/diary.json','/content/gallery.json','/content/site.json'].includes(url.pathname)){
      const file=url.pathname.split('/').pop();
      const override=await handlePublicContentOverride(env,url,file);
      if(override)return override;
    }
    if(url.pathname==='/api/media/config'&&request.method==='GET')return handleMediaConfig(url,env);
  if(url.pathname==='/api/media/status'&&request.method==='GET')return handleMediaStatus(request,env);
  if(url.pathname==='/api/media/upload'&&request.method==='POST')return handleMediaUpload(request,env);
  if(url.pathname==='/api/media/admin/list'&&request.method==='GET')return handleMediaAdminList(request,env);
  if(url.pathname==='/api/media/admin/file'&&request.method==='GET')return handleMediaAdminFile(request,env,url);
  if(url.pathname==='/api/media/admin/approve'&&request.method==='POST')return handleMediaAdminApprove(request,env);
  if(url.pathname==='/api/media/admin/delete'&&request.method==='POST')return handleMediaAdminDelete(request,env);
  if(url.pathname==='/api/media/gallery'&&request.method==='GET')return handleMediaGallery(env,url);
  if(url.pathname==='/api/media/gallery/file'&&request.method==='GET')return handleMediaGalleryFile(env,url);
  if(url.pathname==='/api/microsoft/public-config'&&request.method==='GET'){
    const tenantId=String(env.MS_TENANT_ID||'').trim();
    const clientId=String(env.MS_CLIENT_ID||'').trim();
    return json({
      configured:Boolean(tenantId&&clientId),
      tenantId,
      clientId,
      redirectUri:`${url.origin}/admin/microsoft.html`,
      version:VERSION
    });
  }
  if(url.pathname==='/api/microsoft-status'){
    let config={};try{config=await loadConnectorConfig(url,env)}catch{}
    const state=microsoftState(env,config);
    if(state.ready){
      const started=Date.now();
      try{await graphToken(env);state.connectionTest=true;state.connectionDurationMs=Date.now()-started;state.testedAt=new Date().toISOString()}
      catch(error){state.connectionTest=false;state.connectionError=error.message;state.connectionDurationMs=Date.now()-started;state.testedAt=new Date().toISOString()}
    }
    return json(state);
  }
  if(url.pathname==='/api/microsoft/test'&&(request.method==='GET'||request.method==='POST')){
    let config={};try{config=await loadConnectorConfig(url,env)}catch{}
    const state=microsoftState(env,config),started=Date.now();
    if(!state.tenantIdConfigured||!state.clientIdConfigured||!state.clientSecretConfigured){
      return json({ok:false,message:'Microsoft-Zugangsdaten sind in Cloudflare noch nicht vollständig hinterlegt.',state,testedAt:new Date().toISOString()},503);
    }
    try{
      await graphToken(env);
      return json({ok:true,message:'Microsoft Graph-Anmeldung erfolgreich.',durationMs:Date.now()-started,testedAt:new Date().toISOString(),state});
    }catch(error){
      return json({ok:false,message:error.message||String(error),durationMs:Date.now()-started,testedAt:new Date().toISOString(),state},502);
    }
  }
  if(url.pathname==='/api/microsoft/source-test'&&request.method==='POST'){
    const denied=requireInboxPin(request,env);if(denied)return denied;
    let stage='connector-config';
    try{
      const config=await loadConnectorConfig(url,env),state=microsoftState(env,config);
      if(!state.ready)return json({ok:false,message:'Microsoft-Connector ist noch nicht vollständig eingerichtet.',state},503);
      stage='graph-token';
      const token=await graphToken(env);
      const tokenInfo=graphTokenInfo(token);
      const requiredRoles=['Files.Read.All'];
      const missingRoles=requiredRoles.filter(role=>!tokenInfo.roles.includes(role));
      if(tokenInfo.audience!=='https://graph.microsoft.com'){
        const e=new Error(`Das Access-Token ist nicht für Microsoft Graph bestimmt (aud: ${tokenInfo.audience||'fehlt'}).`);
        e.tokenInfo=tokenInfo;throw e;
      }
      if(missingRoles.length){
        const e=new Error(`Im tatsächlich verwendeten Access-Token fehlt: ${missingRoles.join(', ')}. Prüfe, ob MS_CLIENT_ID wirklich zu jener Entra-App gehört, bei der die Application-Berechtigungen erteilt wurden.`);
        e.tokenInfo=tokenInfo;throw e;
      }
      stage='user-drive';
      const drive=await resolveUserDrive(token,config.ownerUserPrincipalName);
      stage='forms-source';
      const source=await inspectFormsSource(token,config,{includeWorkbookRows:true});
      return json({ok:true,message:'Forms-Antwortdatei und Uploadordner wurden gefunden.',source,drive:{id:drive.id,driveType:drive.driveType,webUrl:drive.webUrl||null},tokenInfo,testedAt:new Date().toISOString()});
    }catch(error){
      const payload=errorPayload(error,stage);
      if(error?.tokenInfo)payload.tokenInfo=error.tokenInfo;
      console.error('Microsoft Forms source test failed',JSON.stringify(payload));
      return json(payload,500);
    }
  }
  if(url.pathname==='/api/photo-inbox/sync'&&request.method==='POST'){
    const denied=requireInboxPin(request,env);if(denied)return denied;
    try{const config=await loadConnectorConfig(url,env),state=microsoftState(env,config);if(!state.ready)return json({message:'Microsoft-Connector ist noch nicht vollständig eingerichtet.',state},503);return json(await buildPhotoRows(url,env,config))}catch(error){return json({message:error.message||String(error)},500)}
  }
  if(url.pathname==='/api/photo-inbox/image'&&request.method==='GET'){
    const denied=requireInboxPin(request,env);if(denied)return denied;
    const driveId=url.searchParams.get('driveId'),itemId=url.searchParams.get('itemId');if(!driveId||!itemId)return json({message:'Bildkennung fehlt.'},400);
    try{const token=await graphToken(env),r=await graphFetch(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,token);return new Response(r.body,{status:200,headers:{'content-type':r.headers.get('content-type')||'application/octet-stream','cache-control':'private, max-age=300','content-disposition':'inline'}})}catch(error){return json({message:error.message||String(error)},500)}
  }
  if(url.pathname==='/api/cms-status'){
    const {clientId,clientSecret}=getOAuthConfig(env);return json({ready:Boolean(clientId&&clientSecret),clientIdConfigured:Boolean(clientId),clientSecretConfigured:Boolean(clientSecret),repo:REPO,branch:'main',version:VERSION});
  }
  if(request.method==='GET'&&['/favicon.ico','/images/favicon.ico'].includes(url.pathname)){
    const assetPath=url.pathname==='/favicon.ico'?'/images/favicon.ico':url.pathname;
    const asset=await env.ASSETS.fetch(new Request(`${url.origin}${assetPath}`,{method:'GET'}));
    if(!asset.ok)return asset;
    const headers=new Headers(asset.headers);
    headers.set('content-type','image/x-icon');
    headers.set('content-disposition','inline; filename="favicon.ico"');
    headers.set('cache-control','public, max-age=86400');
    headers.set('x-content-type-options','nosniff');
    return new Response(asset.body,{status:asset.status,headers});
  }
  if(request.method==='GET'&&['/images/favicon-32x32.png','/images/apple-touch-icon.png'].includes(url.pathname)){
    const asset=await env.ASSETS.fetch(request);
    if(!asset.ok)return asset;
    const headers=new Headers(asset.headers);
    headers.set('content-type','image/png');
    headers.delete('content-disposition');
    headers.set('cache-control','public, max-age=86400');
    headers.set('x-content-type-options','nosniff');
    return new Response(asset.body,{status:asset.status,headers});
  }
  return env.ASSETS.fetch(request);
}};
