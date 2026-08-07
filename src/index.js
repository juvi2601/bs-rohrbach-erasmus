import { unzipSync, strFromU8 } from 'fflate';

const REPO = 'juvi2601/bs-rohrbach-erasmus';
const VERSION = '12.1.0-dev.4';

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

export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/auth')return handleAuth(url,env);
  if(url.pathname==='/callback')return handleCallback(url,env);
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
