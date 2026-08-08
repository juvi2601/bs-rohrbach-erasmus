(() => {
  'use strict';

  const REQUIRED_DOMAIN = 'bs-rohrbach.ac.at';
  const SCOPES = ['User.Read', 'Files.ReadWrite'];
  const SHAREPOINT_URL = 'https://bsrohrbach.sharepoint.com/sites/BSRohrbachBrsselreise2026';
  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  let config = null, app = null, account = null, detectedSite = null;

  function setState(kind, title, detail) { const card=$('ms-status'); card?.classList.remove('ready','warning','error'); if(kind)card?.classList.add(kind); setText('ms-title',title); setText('ms-text',detail); }
  function markCard(id, kind){ const el=$(id); el?.classList.remove('good','warn','bad'); if(kind)el?.classList.add(kind); }
  function setLoginView(isLoggedIn) { $('login-button').hidden=isLoggedIn; $('permission-button').hidden=!isLoggedIn; $('logout-button').hidden=!isLoggedIn; $('account-panel').hidden=!isLoggedIn; $('storage-button').hidden=!isLoggedIn; $('library-button').hidden=!isLoggedIn; }
  function displayAccount(current) {
    account=current||null; setLoginView(Boolean(account)); if(!account)return;
    setText('account-name',account.name||'Microsoft-Benutzer'); setText('account-user',account.username||'–'); setText('account-tenant',account.tenantId||'–');
    const domainOk=String(account.username||'').toLowerCase().endsWith(`@${REQUIRED_DOMAIN}`); setText('account-domain',domainOk?'✓ Schulkonto erkannt':'⚠ Konto gehört nicht zur Schuldomain'); $('account-domain')?.classList.toggle('bad-text',!domainOk);
    setState(domainOk?'ready':'warning','Microsoft-Anmeldung aktiv',domainOk?`${account.name||account.username} ist angemeldet.`:'Anmeldung erfolgreich, aber nicht mit einem BS-Rohrbach-Schulkonto.');
    setText('storage-result','Microsoft-Anmeldung aktiv. Der lesende Speicherzugriff kann jetzt geprüft werden.');
  }
  async function getToken(scopes=SCOPES){ const request={scopes,account}; try{return await app.acquireTokenSilent(request)}catch{return await app.acquireTokenPopup(request)} }
  async function graph(url, token){ const r=await fetch(url,{headers:{Authorization:`Bearer ${token.accessToken}`}}); let data={}; try{data=await r.json()}catch{} if(!r.ok){const e=new Error(data.error?.message||`Microsoft Graph HTTP ${r.status}`);e.status=r.status;e.code=data.error?.code||'';throw e} return data; }

  async function init() {
    try {
      if(typeof window.msal==='undefined')throw new Error('MSAL-Bibliothek konnte nicht geladen werden.');
      setText('sharepoint-target',SHAREPOINT_URL);
      const response=await fetch('/api/microsoft/public-config',{cache:'no-store'}); config=await response.json(); if(!response.ok||!config.configured)throw new Error(config.message||'Tenant-ID oder Client-ID fehlt in Cloudflare.');
      setText('redirect-uri',config.redirectUri); setText('client-id-short',`${config.clientId.slice(0,8)}…${config.clientId.slice(-4)}`);
      app=new msal.PublicClientApplication({auth:{clientId:config.clientId,authority:`https://login.microsoftonline.com/${config.tenantId}`,redirectUri:config.redirectUri,postLogoutRedirectUri:config.redirectUri,navigateToLoginRequestUrl:false},cache:{cacheLocation:'sessionStorage',storeAuthStateInCookie:false},system:{allowNativeBroker:false}});
      if(typeof app.initialize==='function')await app.initialize(); const redirectResult=await app.handleRedirectPromise(); const cached=redirectResult?.account||app.getActiveAccount()||app.getAllAccounts()[0]||null; if(cached)app.setActiveAccount(cached); displayAccount(cached); if(!cached)setState('ready','Microsoft-Anmeldung bereit','Mit dem Microsoft-365-Schulkonto anmelden.');
    } catch(error){setState('error','Microsoft-Konfiguration nicht bereit',error.message||String(error));setText('auth-result',`FEHLER: ${error.message||String(error)}`);$('login-button').disabled=true;}
  }
  async function login(){const b=$('login-button');b.disabled=true;b.textContent='Microsoft-Anmeldung wird geöffnet …';setText('auth-result','Microsoft-Anmeldefenster wird geöffnet …');try{const result=await app.loginPopup({scopes:SCOPES,prompt:'select_account'});app.setActiveAccount(result.account);displayAccount(result.account);setText('auth-result',`ANMELDUNG ERFOLGREICH\n\n${result.account.name||''}\n${result.account.username||''}\n\nModul 2 kann jetzt den Speicherzugriff prüfen.`)}catch(error){if(error.errorCode==='user_cancelled')setText('auth-result','Die Anmeldung wurde abgebrochen. Es wurden keine Daten verändert.');else setText('auth-result',`ANMELDUNG FEHLGESCHLAGEN\n\n${error.message||String(error)}\n\nCode: ${error.errorCode||'–'}`);setState('error','Microsoft-Anmeldung fehlgeschlagen',error.errorCode||error.message||String(error))}finally{b.disabled=false;b.textContent='Mit Microsoft-365-Schulkonto anmelden'}}
  async function checkPermissions(){
    const b=$('permission-button'); b.disabled=true; b.textContent='Berechtigungen werden geprüft …';
    try{
      const token=await getToken();
      const profile=await graph('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName',token);
      const claims=token.accessToken.split('.')[1];
      const decoded=JSON.parse(atob(claims.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(claims.length/4)*4,'=')));
      const scopes=String(decoded.scp||'').split(/\s+/).filter(Boolean);
      const hasFiles=scopes.includes('Files.ReadWrite')||scopes.includes('Files.ReadWrite.All');
      setText('profile-status',`✓ ${profile.displayName} (${profile.userPrincipalName})`);
      setText('files-status',hasFiles?'✓ Files.ReadWrite erteilt':'✗ Files.ReadWrite fehlt');
      markCard('profile-card','good'); markCard('files-card',hasFiles?'good':'bad');
      $('scope-list').innerHTML=scopes.map(s=>`<span>${s}</span>`).join('');
      setText('auth-result',`RECHTETEST ERFOLGREICH\n\nBenutzer: ${profile.displayName}\nKonto: ${profile.userPrincipalName}\nTenant: ${decoded.tid||'–'}\nErteilte Scopes: ${scopes.join(', ')||'keine'}\n\nDEV.8 verwendet bewusst keine Sites.Read.All-Berechtigung.`);
    }catch(error){setText('auth-result',`RECHTETEST FEHLGESCHLAGEN\n\n${error.message||String(error)}`)}
    finally{b.disabled=false;b.textContent='Berechtigungen prüfen'}
  }

  async function checkStorage(){
    const b=$('storage-button'); b.disabled=true; b.textContent='Speicher wird geprüft …';
    markCard('onedrive-card');markCard('sharepoint-card');markCard('next-card');setText('onedrive-status','Prüfung läuft …');setText('sharepoint-status','Prüfung läuft …');setText('next-status','Auswertung läuft …');setText('storage-result','LESETEST LÄUFT …\n\nEs werden nur Metadaten abgefragt.');
    let oneDrive=null, sharePoint=null, sharePointError=null;
    try{
      const token=await getToken();
      try{oneDrive=await graph('https://graph.microsoft.com/v1.0/me/drive?$select=id,driveType,webUrl,quota',token);setText('onedrive-status',`✓ ${oneDrive.driveType||'OneDrive'} erreichbar`);markCard('onedrive-card','good')}catch(e){setText('onedrive-status',`✗ ${e.message}`);markCard('onedrive-card','bad')}
      try{sharePoint=await graph('https://graph.microsoft.com/v1.0/sites/bsrohrbach.sharepoint.com:/sites/BSRohrbachBrsselreise2026?$select=id,displayName,webUrl',token);detectedSite=sharePoint;setText('sharepoint-status',`✓ ${sharePoint.displayName||'SharePoint'} erreichbar`);markCard('sharepoint-card','good')}catch(e){sharePointError=e;setText('sharepoint-status',`Noch nicht freigegeben: ${e.code||e.status||'Graph'} `);markCard('sharepoint-card','warn')}
      let next='';
      if(oneDrive&&sharePoint){next='SharePoint ist lesend erreichbar. Als Nächstes ermitteln wir die Dokumentbibliothek und den Foto-Zielordner.';markCard('next-card','good')}
      else if(oneDrive&&sharePointError){next='Login und OneDrive funktionieren. Für den gezielten SharePoint-Zugriff fehlt noch eine SharePoint-Berechtigung. DEV.4 hat nichts verändert.';markCard('next-card','warn')}
      else{next='Der Speicherzugriff muss zuerst geklärt werden. Es wurden keine Daten verändert.';markCard('next-card','bad')}
      setText('next-status',next);
      const lines=['SPEICHERTEST ABGESCHLOSSEN','',`Eigenes OneDrive: ${oneDrive?'ERREICHBAR':'NICHT ERREICHBAR'}`];
      if(oneDrive){lines.push(`Typ: ${oneDrive.driveType||'–'}`,`Web: ${oneDrive.webUrl||'–'}`)}
      lines.push('',`Brüssel-SharePoint: ${sharePoint?'ERREICHBAR':'NOCH NICHT ERREICHBAR'}`);
      if(sharePoint)lines.push(`Name: ${sharePoint.displayName||'–'}`,`Web: ${sharePoint.webUrl||'–'}`);
      if(sharePointError)lines.push(`Graph-Code: ${sharePointError.code||'–'}`,`HTTP: ${sharePointError.status||'–'}`,`Meldung: ${sharePointError.message}`);
      lines.push('','WICHTIG: Dieser Test war ausschließlich lesend. Keine Datei wurde erstellt, geändert oder gelöscht.');
      setText('storage-result',lines.join('\n'));
    }catch(error){setText('storage-result',`SPEICHERTEST FEHLGESCHLAGEN\n\n${error.message||String(error)}\n\nEs wurden keine Daten verändert.`);markCard('next-card','bad');setText('next-status','Fehler auswerten, bevor wir Rechte oder Dateien ändern.')}finally{b.disabled=false;b.textContent='Speicherzugriff prüfen'}
  }

  async function graphDiagnostic(url, token){
    const started=Date.now();
    let response=null, text='', data=null;
    try{
      response=await fetch(url,{headers:{Authorization:`Bearer ${token.accessToken}`}});
      text=await response.text();
      try{data=text?JSON.parse(text):null}catch{}
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        msRequestId: response.headers.get('request-id')||response.headers.get('x-ms-request-id')||'',
        elapsed: Date.now()-started,
        data,
        text
      };
    }catch(error){
      return {ok:false,status:0,statusText:'FETCH_ERROR',msRequestId:'',elapsed:Date.now()-started,data:null,text:'',error};
    }
  }

  function diagnosticLines(label,url,result){
    const lines=[`[${label}]`, `URL: ${url}`, `HTTP: ${result.status||'–'} ${result.statusText||''}`.trim(), `Dauer: ${result.elapsed} ms`];
    if(result.msRequestId)lines.push(`Request-ID: ${result.msRequestId}`);
    if(result.ok){
      const count=Array.isArray(result.data?.value)?result.data.value.length:null;
      lines.push('Ergebnis: ERFOLGREICH');
      if(count!==null)lines.push(`Gefundene Elemente: ${count}`);
      if(result.data?.name)lines.push(`Name: ${result.data.name}`);
      if(result.data?.webUrl)lines.push(`Web: ${result.data.webUrl}`);
    }else{
      const code=result.data?.error?.code||result.error?.name||'–';
      const message=result.data?.error?.message||result.error?.message||result.text||'Keine Fehlermeldung';
      lines.push('Ergebnis: FEHLER',`Graph-Code: ${code}`,`Meldung: ${message}`);
    }
    return lines;
  }

  async function checkLibraries(){
    const b=$('library-button'); b.disabled=true; b.textContent='Diagnose läuft …';
    markCard('libraries-card');markCard('folders-card');markCard('target-card');
    setText('libraries-status','Diagnose läuft …');setText('folders-status','Noch nicht geprüft');setText('target-status','Auswertung läuft …');
    setText('library-result','BIBLIOTHEKS-DIAGNOSE LÄUFT …\n\nEs werden ausschließlich Metadaten gelesen.');
    try{
      const token=await getToken();
      const claims=token.accessToken.split('.')[1];
      const decoded=JSON.parse(atob(claims.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(claims.length/4)*4,'=')));
      const scopes=String(decoded.scp||'').split(/\s+/).filter(Boolean);

      const siteUrl='https://graph.microsoft.com/v1.0/sites/bsrohrbach.sharepoint.com:/sites/BSRohrbachBrsselreise2026?$select=id,displayName,webUrl';
      const siteRes=await graphDiagnostic(siteUrl,token);
      const lines=['DEV.7 – SHAREPOINT/BIBLIOTHEKS-DIAGNOSE','',`Token-Scopes: ${scopes.join(', ')||'keine'}`,''];
      lines.push(...diagnosticLines('1. SharePoint-Site',siteUrl,siteRes),'');
      if(!siteRes.ok||!siteRes.data?.id){
        setText('libraries-status','✗ SharePoint-Site konnte nicht erneut gelesen werden');markCard('libraries-card','bad');
        setText('folders-status','Nicht getestet');markCard('folders-card','warn');
        setText('target-status','Site-Zugriff zuerst klären');markCard('target-card','bad');
        lines.push('AUSWERTUNG','Der Fehler liegt bereits beim Zugriff auf die SharePoint-Site. Es wurden keine Daten verändert.');
        setText('library-result',lines.join('\n'));return;
      }
      detectedSite=siteRes.data;
      const siteId=siteRes.data.id;

      const drivesUrl=`https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,driveType,webUrl`;
      const drivesRes=await graphDiagnostic(drivesUrl,token);
      lines.push(...diagnosticLines('2. Alle Dokumentbibliotheken (/drives)',drivesUrl,drivesRes),'');

      const defaultDriveUrl=`https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drive?$select=id,name,driveType,webUrl`;
      const defaultDriveRes=await graphDiagnostic(defaultDriveUrl,token);
      lines.push(...diagnosticLines('3. Standard-Dokumentbibliothek (/drive)',defaultDriveUrl,defaultDriveRes),'');

      let drives=[];
      if(drivesRes.ok&&Array.isArray(drivesRes.data?.value))drives=drivesRes.data.value;
      let chosen=drives[0]||null;
      if(!chosen&&defaultDriveRes.ok&&defaultDriveRes.data?.id)chosen=defaultDriveRes.data;

      if(drivesRes.ok){
        setText('libraries-status',`✓ ${drives.length} Dokumentbibliothek${drives.length===1?'':'en'} über /drives gefunden`);markCard('libraries-card','good');
      }else if(defaultDriveRes.ok){
        setText('libraries-status','⚠ Liste blockiert, aber Standard-Dokumentbibliothek ist erreichbar');markCard('libraries-card','warn');
      }else{
        setText('libraries-status',`✗ Bibliothekszugriff: HTTP ${drivesRes.status||defaultDriveRes.status||'–'}`);markCard('libraries-card','bad');
      }

      if(chosen){
        const childrenUrl=`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(chosen.id)}/root/children?$select=id,name,folder,file,webUrl&$top=100`;
        const childrenRes=await graphDiagnostic(childrenUrl,token);
        lines.push(...diagnosticLines('4. Ordner im Stammverzeichnis',childrenUrl,childrenRes),'');
        if(childrenRes.ok){
          const folders=(childrenRes.data?.value||[]).filter(x=>x.folder);
          setText('folders-status',folders.length?`✓ ${folders.length} Ordner in „${chosen.name||'Dokumente'}“ sichtbar`:`✓ „${chosen.name||'Dokumente'}“ erreichbar; keine Ordner auf oberster Ebene`);markCard('folders-card','good');
          if(folders.length){lines.push('Sichtbare Ordner:');folders.forEach((f,i)=>lines.push(`${i+1}. ${f.name}`));lines.push('');}
          const photo=folders.find(f=>/foto|photo|upload|bilder|images|erasmus|br[uü]ssel/i.test(f.name||''));
          if(photo){setText('target-status',`✓ Möglicher Zielordner: „${photo.name}“`);markCard('target-card','good');lines.push('MÖGLICHER FOTO-ZIELORDNER',photo.name,photo.webUrl||'','');}
          else{setText('target-status','Kein eindeutiger Foto-Zielordner erkannt; Ziel können wir nach der Diagnose festlegen.');markCard('target-card','warn');}
        }else{
          setText('folders-status',`✗ Ordnerzugriff: HTTP ${childrenRes.status||'–'}`);markCard('folders-card','bad');
          setText('target-status','Zielordner noch nicht lesbar');markCard('target-card','warn');
        }
      }else{
        setText('folders-status','Nicht getestet – keine Bibliothek-ID verfügbar');markCard('folders-card','warn');
        setText('target-status','Noch offen');markCard('target-card','warn');
      }

      lines.push('AUSWERTUNG');
      if(!drivesRes.ok&&[401,403].includes(drivesRes.status)){
        lines.push('Der SharePoint selbst ist erreichbar, aber das Auflisten aller Dokumentbibliotheken wird vom delegierten Token abgewiesen. DEV.7 fordert dafür nun Sites.Read.All im delegierten Token an.');
      }else if(drivesRes.ok && drives.length===0 && !defaultDriveRes.ok){
        lines.push('Die Site ist erreichbar, aber /drives liefert 0 Bibliotheken und /drive ist weiterhin nicht erlaubt. Prüfe oben, ob Sites.Read.All wirklich im Token steht.');
      }else if(drivesRes.ok){
        lines.push('Das Auflisten der Dokumentbibliotheken funktioniert und mindestens eine Bibliothek ist verwertbar. Wir können im nächsten Schritt den Zielordner festlegen.');
      }else if(defaultDriveRes.ok){
        lines.push('Die vollständige Bibliotheksliste ist nicht verfügbar, die Standard-Dokumentbibliothek aber schon. Das kann für unseren Foto-Workflow bereits ausreichen.');
      }else{
        lines.push('Die genaue Graph-Antwort steht oben. Wir werten sie aus, bevor wir Berechtigungen ändern.');
      }
      lines.push('','WICHTIG: DEV.7 ist weiterhin ausschließlich lesend. Es wurde kein Ordner und keine Datei erstellt, geändert oder gelöscht.');
      setText('library-result',lines.join('\n'));
    }catch(error){
      setText('library-result',`DIAGNOSE FEHLGESCHLAGEN\n\n${error.message||String(error)}\n\nEs wurden keine Daten verändert.`);markCard('target-card','bad');setText('target-status','Fehler zuerst auswerten; nichts verändern.');
    }finally{b.disabled=false;b.textContent='Bibliothekszugriff diagnostizieren';}
  }


  function encodeSharingUrl(url){
    const bytes=new TextEncoder().encode(url);
    let binary=''; bytes.forEach(b=>binary+=String.fromCharCode(b));
    return 'u!'+btoa(binary).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
  }

  async function checkSharedFolder(){
    const b=$('shared-button'); const input=$('shared-url');
    const raw=String(input?.value||'').trim();
    if(!raw){setText('shared-result','Bitte zuerst einen Freigabelink zu einem SharePoint-/OneDrive-Ordner einfügen.');return;}
    if(!/^https:\/\//i.test(raw)){setText('shared-result','Der Freigabelink muss mit https:// beginnen.');return;}
    b.disabled=true; b.textContent='Freigabelink wird geprüft …';
    markCard('shared-item-card'); markCard('shared-children-card'); markCard('shared-next-card');
    setText('shared-item-status','Prüfung läuft …'); setText('shared-children-status','Wartet auf Zielordner …'); setText('shared-next-status','Auswertung läuft …');
    setText('shared-result','DEV.8 – FREIGABELINK-TEST LÄUFT …\n\nEs werden ausschließlich Metadaten gelesen.');
    try{
      sessionStorage.setItem('erasmusSharedFolderUrl',raw);
      const token=await getToken(['User.Read','Files.ReadWrite']);
      const shareId=encodeSharingUrl(raw);
      const itemUrl=`https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(shareId)}/driveItem?$select=id,name,webUrl,folder,file,parentReference,remoteItem,shared`;
      const itemRes=await graphDiagnostic(itemUrl,token);
      const lines=['DEV.8 – ADMINFREIER FREIGABELINK-TEST','',`Freigabelink: ${raw}`,'',...diagnosticLines('1. Freigegebenes Element',itemUrl,itemRes),''];
      if(!itemRes.ok){
        setText('shared-item-status',`✗ HTTP ${itemRes.status||'–'} ${itemRes.statusText||''}`); markCard('shared-item-card','bad');
        setText('shared-children-status','Nicht getestet'); markCard('shared-children-card','warn');
        setText('shared-next-status','Link/Berechtigung prüfen'); markCard('shared-next-card','warn');
        lines.push('AUSWERTUNG','Der Freigabelink konnte mit Files.ReadWrite nicht geöffnet werden. Es wurde nichts verändert.');
        setText('shared-result',lines.join('\n')); return;
      }
      const item=itemRes.data||{};
      const remote=item.remoteItem||{};
      const effective=Object.keys(remote).length?remote:item;
      const parent=effective.parentReference||item.parentReference||{};
      const driveId=parent.driveId||'';
      const itemId=effective.id||item.id||'';
      const isFolder=Boolean(effective.folder||item.folder);
      setText('shared-item-status',`✓ ${effective.name||item.name||'Element'} erreichbar${isFolder?' (Ordner)':''}`); markCard('shared-item-card','good');
      lines.push(`Name: ${effective.name||item.name||'–'}`,`Typ: ${isFolder?'Ordner':(effective.file?'Datei':'Element')}`,`Drive-ID: ${driveId||'nicht geliefert'}`,`Item-ID: ${itemId||'nicht geliefert'}`,'');
      let children=[];
      if(isFolder&&driveId&&itemId){
        const childrenUrl=`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children?$select=id,name,folder,file,webUrl&$top=50`;
        const childrenRes=await graphDiagnostic(childrenUrl,token);
        lines.push(...diagnosticLines('2. Ordnerinhalt (nur lesend)',childrenUrl,childrenRes),'');
        if(childrenRes.ok){
          children=Array.isArray(childrenRes.data?.value)?childrenRes.data.value:[];
          setText('shared-children-status',`✓ ${children.length} Element${children.length===1?'':'e'} lesbar`); markCard('shared-children-card','good');
          if(children.length){lines.push('Gefundene Elemente:');children.slice(0,20).forEach(x=>lines.push(`- ${x.folder?'📁':'📄'} ${x.name}`));lines.push('');}
        }else{
          setText('shared-children-status',`✗ HTTP ${childrenRes.status||'–'} ${childrenRes.data?.error?.code||''}`); markCard('shared-children-card','bad');
        }
      }else{
        setText('shared-children-status',isFolder?'Ordner erkannt, aber Drive-/Item-ID fehlt':'Der Link zeigt nicht auf einen Ordner'); markCard('shared-children-card','warn');
      }
      if(isFolder&&driveId&&itemId){
        setText('shared-next-status','✓ Zielordner technisch adressierbar – nächster Test kann ein kontrollierter Upload sein'); markCard('shared-next-card','good');
        lines.push('AUSWERTUNG','Der Freigabelink führt auf einen adressierbaren Ordner. Damit haben wir einen möglichen Weg ohne Sites.Read.All und ohne Adminzustimmung gefunden.','', 'WICHTIG: DEV.8 hat nichts hochgeladen, erstellt, geändert oder gelöscht.');
      }else{
        setText('shared-next-status','Noch kein eindeutig adressierbarer Ordner'); markCard('shared-next-card','warn');
        lines.push('AUSWERTUNG','Der Link ist erreichbar, aber noch nicht als beschreibbarer Zielordner identifiziert. Es wurde nichts verändert.');
      }
      setText('shared-result',lines.join('\n'));
    }catch(error){
      setText('shared-result',`FREIGABELINK-TEST FEHLGESCHLAGEN\n\n${error.message||String(error)}\n\nEs wurden keine Daten verändert.`);
      markCard('shared-next-card','bad'); setText('shared-next-status','Fehler zuerst auswerten');
    }finally{b.disabled=false;b.textContent='Freigabelink prüfen (READ ONLY)';}
  }

  async function logout(){if(!app||!account)return;await app.logoutPopup({account,postLogoutRedirectUri:config.redirectUri});sessionStorage.clear();location.reload()}
  document.addEventListener('DOMContentLoaded',()=>{$('login-button').addEventListener('click',login);$('permission-button').addEventListener('click',checkPermissions);$('storage-button').addEventListener('click',checkStorage);$('library-button').addEventListener('click',checkLibraries);$('shared-button')?.addEventListener('click',checkSharedFolder);const saved=sessionStorage.getItem('erasmusSharedFolderUrl');if(saved&&$('shared-url'))$('shared-url').value=saved;$('logout-button').addEventListener('click',logout);init()});
})();
