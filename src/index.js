import { unzipSync, strFromU8 } from 'fflate';

const REPO = 'juvi2601/bs-rohrbach-erasmus';
const VERSION = '14.0-dev.8.2.3';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
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
const MEDIA_PROJECT = DEFAULT_TRIP_ID; // Kompatibilität zu STABLE 13.9
function normalizeTripId(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'')}
function resolveTripId(request,url){
  const header=normalizeTripId(request?.headers?.get('x-erasmus-trip'));
  const query=normalizeTripId(url?.searchParams?.get('trip'));
  const candidate=header||query||DEFAULT_TRIP_ID;
  return TRIP_REGISTRY[candidate]?candidate:DEFAULT_TRIP_ID;
}
function tripConfig(id=DEFAULT_TRIP_ID){return TRIP_REGISTRY[id]||TRIP_REGISTRY[DEFAULT_TRIP_ID]}
function tripDraftKey(id){return `__system/trips/drafts/${id}.json`}
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
    features:{diary:bool(features.diary),gallery:bool(features.gallery),upload:bool(features.upload),map:bool(features.map),smartJourney:bool(features.smartJourney),downloads:bool(features.downloads)},
    images:{hero:cleanText(images.hero,300),hotel:cleanText(images.hotel,300),program:arr(images.program).slice(0,30)},
    program:{days:(Array.isArray(program.days)?program.days:[]).slice(0,31).map((day,di)=>{
      const date=/^\d{4}-\d{2}-\d{2}$/.test(String(day?.date||''))?String(day.date):'';
      return {
        id:cleanText(day?.id,40)||`day-${di+1}`,date,short:cleanText(day?.short,12),title:cleanText(day?.title,120),subtitle:cleanText(day?.subtitle,220),
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
  const status=Number(error?.status)||500;
  return json({ok:false,message:error?.message||String(error)},status);
}

async function handleMediaConfig(url,env){
  const tenantId=String(env.MS_TENANT_ID||'').trim();
  const clientId=String(env.MS_CLIENT_ID||'').trim();
  return json({
    configured:Boolean(tenantId&&clientId),tenantId,clientId,
    redirectUri:`${url.origin}/upload.html`,project:MEDIA_PROJECT,
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
    const user=await verifyMediaUploader(request,env);
    const usage=await r2Usage(env.MEDIA_BUCKET);
    return json({ok:true,user,usage,limitBytes:MEDIA_STORAGE_LIMIT_BYTES,remainingBytes:Math.max(0,MEDIA_STORAGE_LIMIT_BYTES-usage.totalBytes),project:MEDIA_PROJECT});
  }catch(error){return mediaError(error)}
}

async function handleMediaUpload(request,env){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    const user=await verifyMediaUploader(request,env);
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
    const key=`${MEDIA_PROJECT}/pending/${folder}/${userSegment}/${now.getTime()}-${crypto.randomUUID()}.${ext}`;

    await env.MEDIA_BUCKET.put(key,request.body,{
      httpMetadata:{contentType,contentDisposition:`inline; filename*=UTF-8''${encodeURIComponent(originalName)}`},
      customMetadata:{
        status:'pending',project:MEDIA_PROJECT,mediaType:kind,originalName,
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
  })
});
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
async function saveStudentAccess(env,students,admin){
  if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
  const unique=new Map();
  for(const item of Array.isArray(students)?students:[]){
    const email=String(item?.email||'').trim().toLowerCase();
    if(!email||!email.endsWith(`@${MEDIA_ALLOWED_DOMAIN}`))continue;
    unique.set(email,{email,name:cleanText(item?.name,120)});
    if(unique.size>500)throw Object.assign(new Error('Maximal 500 Schüler*innen pro Reise sind zulässig.'),{status:400});
  }
  const payload={project:MEDIA_PROJECT,updatedAt:new Date().toISOString(),updatedBy:String(admin?.email||''),students:[...unique.values()]};
  await env.MEDIA_BUCKET.put(studentAccessKey(MEDIA_PROJECT),JSON.stringify(payload,null,2),{
    httpMetadata:{contentType:'application/json; charset=utf-8'},
    customMetadata:{project:MEDIA_PROJECT,updatedAt:payload.updatedAt,updatedBy:payload.updatedBy}
  });
  return payload.students;
}
async function tripAccessFor(env,email,project=MEDIA_PROJECT){
  const normalized=String(email||'').trim().toLowerCase();
  const fixed=staticTripAccessFor(normalized,project);
  if(fixed)return fixed;
  const student=(await loadStudentAccess(env,project)).find(x=>x.email===normalized);
  return student?{project,email:normalized,role:'student',name:student.name||normalized,permissions:ROLE_PERMISSIONS.student}:null;
}
async function verifyTripRole(request,env,allowedRoles=[]){
  const user=await verifySchoolUser(request,env);
  const access=await tripAccessFor(env,user.email);
  if(!access||!allowedRoles.includes(access.role)){
    throw Object.assign(new Error('Für diesen Bereich fehlt die erforderliche Reiseberechtigung.'),{status:403});
  }
  return {...user,access};
}
async function verifyMediaAdmin(request,env){
  return verifyTripRole(request,env,['admin','teacher']);
}
async function verifyMediaUploader(request,env){
  return verifyTripRole(request,env,['admin','teacher','student']);
}
async function handleAccessMe(request,env){
  try{
    const user=await verifySchoolUser(request,env);
    const access=await tripAccessFor(env,user.email);
    return json({ok:true,user,access,project:MEDIA_PROJECT});
  }catch(error){return mediaError(error)}
}
async function handleAccessUsers(request,env){
  try{
    const user=await verifyTripRole(request,env,['admin']);
    const fixed=Object.entries(TRIP_ACCESS[MEDIA_PROJECT]||{}).map(([email,x])=>({
      email,name:x.name,role:x.role,permissions:ROLE_PERMISSIONS[x.role]||[]
    }));
    const students=(await loadStudentAccess(env)).map(x=>({
      email:x.email,name:x.name||x.email,role:'student',permissions:ROLE_PERMISSIONS.student
    }));
    return json({ok:true,user,project:MEDIA_PROJECT,users:[...fixed,...students]});
  }catch(error){return mediaError(error)}
}
async function handleStudentAccessGet(request,env){
  try{
    const user=await verifyTripRole(request,env,['admin']);
    const students=await loadStudentAccess(env);
    return json({ok:true,user,project:MEDIA_PROJECT,students});
  }catch(error){return mediaError(error)}
}
async function handleStudentAccessPut(request,env){
  try{
    const user=await verifyTripRole(request,env,['admin']);
    const body=await request.json().catch(()=>{throw Object.assign(new Error('Ungültige Importdaten.'),{status:400})});
    const students=await saveStudentAccess(env,body?.students,user);
    return json({ok:true,project:MEDIA_PROJECT,students,count:students.length,updatedAt:new Date().toISOString()});
  }catch(error){return mediaError(error)}
}
// --- Ende Version 13.5 Rollenbasis ---
function pendingPrefix(){return `${MEDIA_PROJECT}/pending/`}
function approvedPrefix(){return `${MEDIA_PROJECT}/approved/`}
function approvedKeyFor(key){return String(key).replace(`/${'pending'}/`,`/approved/`)}
function validPendingKey(key){return String(key||'').startsWith(pendingPrefix()) && !String(key).includes('..')}
function validApprovedKey(key){return String(key||'').startsWith(approvedPrefix()) && !String(key).includes('..')}
function validAdminMediaKey(key){return validPendingKey(key)||validApprovedKey(key)}

async function handleMediaAdminList(request,env){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    const user=await verifyMediaAdmin(request,env);
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
    const [items,approvedItems]=await Promise.all([collect(pendingPrefix()),collect(approvedPrefix())]);
    const usage=await r2Usage(env.MEDIA_BUCKET);
    return json({ok:true,user,items,approvedItems,usage,limitBytes:MEDIA_STORAGE_LIMIT_BYTES,project:MEDIA_PROJECT});
  }catch(error){return mediaError(error)}
}

async function handleMediaAdminFile(request,env,url){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    await verifyMediaAdmin(request,env);
    const key=url.searchParams.get('key')||'';
    if(!validAdminMediaKey(key))throw Object.assign(new Error('Ungültiger Medienpfad.'),{status:400});
    const object=await env.MEDIA_BUCKET.get(key);
    if(!object)throw Object.assign(new Error('Medium wurde nicht gefunden.'),{status:404});
    const headers=new Headers(); object.writeHttpMetadata(headers); headers.set('etag',object.httpEtag||''); headers.set('cache-control','private, no-store'); headers.set('x-content-type-options','nosniff');
    return new Response(object.body,{headers});
  }catch(error){return mediaError(error)}
}

async function handleMediaAdminApprove(request,env){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    const user=await verifyMediaAdmin(request,env);
    const body=await request.json().catch(()=>({})),key=String(body.key||'');
    if(!validPendingKey(key))throw Object.assign(new Error('Ungültiger Medienpfad.'),{status:400});
    const object=await env.MEDIA_BUCKET.get(key);
    if(!object)throw Object.assign(new Error('Medium wurde nicht gefunden.'),{status:404});
    const target=approvedKeyFor(key),meta={...(object.customMetadata||{}),status:'approved',approvedAt:new Date().toISOString(),approvedBy:user.email};
    await env.MEDIA_BUCKET.put(target,object.body,{httpMetadata:object.httpMetadata,customMetadata:meta});
    await env.MEDIA_BUCKET.delete(key);
    return json({ok:true,key:target,status:'approved'});
  }catch(error){return mediaError(error)}
}

async function handleMediaAdminDelete(request,env){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'R2-Binding MEDIA_BUCKET fehlt.'},503);
  try{
    await verifyMediaAdmin(request,env);
    const body=await request.json().catch(()=>({})),key=String(body.key||'');
    if(!validAdminMediaKey(key))throw Object.assign(new Error('Ungültiger Medienpfad.'),{status:400});
    const head=await env.MEDIA_BUCKET.head(key);
    if(!head)throw Object.assign(new Error('Medium wurde nicht gefunden.'),{status:404});
    await env.MEDIA_BUCKET.delete(key);
    return json({ok:true,deleted:key,freedBytes:Number(head.size||0)});
  }catch(error){return mediaError(error)}
}
// --- Ende DEV.10 Admin-Medienfreigabe ---

// --- DEV.11: öffentliche Galerie aus freigegebenen R2-Medien ---
async function handleMediaGallery(env,url){
  if(!env.MEDIA_BUCKET)return json({ok:false,message:'Galerie-Speicher ist derzeit nicht verfügbar.'},503);
  let cursor=undefined,items=[];
  do{
    const page=await env.MEDIA_BUCKET.list({prefix:approvedPrefix(),limit:1000,cursor,include:['httpMetadata','customMetadata']});
    for(const o of page.objects||[]){
      const m=o.customMetadata||{},type=m.mediaType==='video'||String(o.httpMetadata?.contentType||'').startsWith('video/')?'video':'image';
      items.push({
        id:o.key,mediaType:type,
        image:`${url.origin}/api/media/gallery/file?key=${encodeURIComponent(o.key)}`,
        title:m.program||m.day||'Reiseerinnerung',day:m.day||'Reise',program:m.program||'',description:m.description||'',
        alt:type==='image'?`${m.program||m.day||'Reisefoto'} – Erasmus+ BS Rohrbach`:'',uploadedAt:m.uploadedAt||'',approvedAt:m.approvedAt||''
      });
    }
    cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
  items.sort((a,b)=>String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
  return json({ok:true,project:MEDIA_PROJECT,items},200,{'cache-control':'public, max-age=60'});
}
async function handleMediaGalleryFile(env,url){
  if(!env.MEDIA_BUCKET)return new Response('Nicht verfügbar',{status:503});
  const key=url.searchParams.get('key')||'';
  if(!validApprovedKey(key))return new Response('Ungültiger Medienpfad',{status:400});
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
function editorKey(name){return `__system/editor/${MEDIA_PROJECT}/${name}`}

async function staticContentJson(env,url,file){
  const response=await env.ASSETS.fetch(new Request(`${url.origin}/content/${file}`));
  if(!response.ok)throw Object.assign(new Error(`Inhaltsdatei ${file} konnte nicht geladen werden.`),{status:502});
  return response.json();
}
async function effectiveContentJson(env,url,file){
  if(env.MEDIA_BUCKET){
    const object=await env.MEDIA_BUCKET.get(editorKey(file));
    if(object){
      try{return JSON.parse(await object.text())}
      catch{throw Object.assign(new Error(`Redaktionsstand ${file} ist beschädigt.`),{status:500})}
    }
  }
  return staticContentJson(env,url,file);
}
async function saveContentOverride(env,file,data,user){
  if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
  await env.MEDIA_BUCKET.put(editorKey(file),JSON.stringify(data,null,2),{
    httpMetadata:{contentType:'application/json; charset=utf-8'},
    customMetadata:{project:MEDIA_PROJECT,updatedAt:new Date().toISOString(),updatedBy:String(user.email||''),role:String(user.access?.role||'')}
  });
}
async function handlePublicContentOverride(env,url,file){
  if(!env.MEDIA_BUCKET)return null;
  const object=await env.MEDIA_BUCKET.get(editorKey(file));
  if(!object)return null;
  const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  headers.set('x-editor-source','r2');
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
    enabled:Boolean(input?.enabled),
    type,
    emoji:cleanText(input?.emoji,12)||'📢',
    title:cleanText(input?.title,120)||'Aktueller Reisestatus',
    text:cleanText(input?.text,800),
    updated:cleanText(input?.updated,80)
  };
}
async function handleEditorGet(request,env,url,kind){
  try{
    const def=EDITOR_CONTENT[kind];
    if(!def)throw Object.assign(new Error('Unbekannter Redaktionsbereich.'),{status:404});
    const user=await verifyTripRole(request,env,['admin','teacher']);
    requirePermission(user,def.permission);
    const data=await effectiveContentJson(env,url,def.file);
    return json({ok:true,project:MEDIA_PROJECT,user:{email:user.email,name:user.access?.name,role:user.access?.role},data});
  }catch(error){return mediaError(error)}
}
async function handleEditorSave(request,env,url,kind){
  try{
    const def=EDITOR_CONTENT[kind];
    if(!def)throw Object.assign(new Error('Unbekannter Redaktionsbereich.'),{status:404});
    const user=await verifyTripRole(request,env,['admin','teacher']);
    requirePermission(user,def.permission);
    const body=await request.json().catch(()=>{throw Object.assign(new Error('Ungültige JSON-Daten.'),{status:400})});
    let data;
    if(kind==='diary')data=cleanDiary(body,user);
    if(kind==='gallery')data=cleanGallery(body);
    if(kind==='site'){
      const current=await effectiveContentJson(env,url,def.file);
      data={...current,liveStatus:cleanLiveStatus(body?.liveStatus||body)};
    }
    await saveContentOverride(env,def.file,data,user);
    return json({ok:true,project:MEDIA_PROJECT,savedAt:new Date().toISOString(),data});
  }catch(error){return mediaError(error)}
}
async function handleEditorReset(request,env,url,kind){
  try{
    const def=EDITOR_CONTENT[kind];
    if(!def)throw Object.assign(new Error('Unbekannter Redaktionsbereich.'),{status:404});
    const user=await verifyTripRole(request,env,['admin']);
    if(!env.MEDIA_BUCKET)throw Object.assign(new Error('R2-Binding MEDIA_BUCKET fehlt.'),{status:503});
    await env.MEDIA_BUCKET.delete(editorKey(def.file));
    return json({ok:true,project:MEDIA_PROJECT,message:'Redaktions-Override wurde entfernt.'});
  }catch(error){return mediaError(error)}
}
// --- Ende Version 13.7 Reise-Redaktion ---


export default {async fetch(request,env){
  const url=new URL(request.url);
    if(url.pathname==='/api/trips'&&request.method==='GET'){
      return json({ok:true,defaultTrip:DEFAULT_TRIP_ID,trips:Object.values(TRIP_REGISTRY)});
    }
    if(url.pathname==='/api/trips/current'&&request.method==='GET'){
      const id=resolveTripId(request,url);
      return json({ok:true,trip:tripConfig(id),defaultTrip:DEFAULT_TRIP_ID});
    }
    if(url.pathname==='/api/trips/drafts'&&request.method==='GET'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        return json({ok:true,user,drafts:await listTripDrafts(env)});
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
    if(url.pathname==='/api/trips/admin'&&request.method==='GET'){
      try{
        const user=await verifyTripRole(request,env,['admin']);
        return json({ok:true,user,defaultTrip:DEFAULT_TRIP_ID,trips:Object.values(TRIP_REGISTRY)});
      }catch(error){return mediaError(error)}
    }

  if(url.pathname==='/auth')return handleAuth(url,env);
  if(url.pathname==='/callback')return handleCallback(url,env);
  if(url.pathname==='/api/access/me'&&request.method==='GET')return handleAccessMe(request,env);
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
  return env.ASSETS.fetch(request);
}};
