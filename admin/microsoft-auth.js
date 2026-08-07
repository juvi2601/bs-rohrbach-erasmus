(() => {
  'use strict';

  const REQUIRED_DOMAIN = 'bs-rohrbach.ac.at';
  const SCOPES = ['User.Read', 'Files.ReadWrite'];
  const SHAREPOINT_URL = 'https://bsrohrbach.sharepoint.com/sites/BSRohrbachBrsselreise2026';
  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  let config = null, app = null, account = null;

  function setState(kind, title, detail) { const card=$('ms-status'); card?.classList.remove('ready','warning','error'); if(kind)card?.classList.add(kind); setText('ms-title',title); setText('ms-text',detail); }
  function markCard(id, kind){ const el=$(id); el?.classList.remove('good','warn','bad'); if(kind)el?.classList.add(kind); }
  function setLoginView(isLoggedIn) { $('login-button').hidden=isLoggedIn; $('permission-button').hidden=!isLoggedIn; $('logout-button').hidden=!isLoggedIn; $('account-panel').hidden=!isLoggedIn; $('storage-button').hidden=!isLoggedIn; }
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
  async function checkPermissions(){const b=$('permission-button');b.disabled=true;b.textContent='Berechtigungen werden geprüft …';try{const token=await getToken();const profile=await graph('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName',token);const claims=token.accessToken.split('.')[1];const decoded=JSON.parse(atob(claims.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(claims.length/4)*4,'=')));const scopes=String(decoded.scp||'').split(/\s+/).filter(Boolean);const hasFiles=scopes.includes('Files.ReadWrite')||scopes.includes('Files.ReadWrite.All');setText('profile-status',`✓ ${profile.displayName} (${profile.userPrincipalName})`);setText('files-status',hasFiles?'✓ Files.ReadWrite wurde erteilt':'✗ Files.ReadWrite fehlt');markCard('profile-card','good');markCard('files-card',hasFiles?'good':'bad');$('scope-list').innerHTML=scopes.map(s=>`<span>${s}</span>`).join('');setText('auth-result',`RECHTETEST ERFOLGREICH\n\nBenutzer: ${profile.displayName}\nKonto: ${profile.userPrincipalName}\nTenant: ${decoded.tid||'–'}\nErteilte Scopes: ${scopes.join(', ')||'keine'}\n\nModul 1 ist abgeschlossen. Jetzt kann Modul 2 getestet werden.`)}catch(error){setText('auth-result',`RECHTETEST FEHLGESCHLAGEN\n\n${error.message||String(error)}`)}finally{b.disabled=false;b.textContent='Berechtigungen prüfen'}}

  async function checkStorage(){
    const b=$('storage-button'); b.disabled=true; b.textContent='Speicher wird geprüft …';
    markCard('onedrive-card');markCard('sharepoint-card');markCard('next-card');setText('onedrive-status','Prüfung läuft …');setText('sharepoint-status','Prüfung läuft …');setText('next-status','Auswertung läuft …');setText('storage-result','LESETEST LÄUFT …\n\nEs werden nur Metadaten abgefragt.');
    let oneDrive=null, sharePoint=null, sharePointError=null;
    try{
      const token=await getToken();
      try{oneDrive=await graph('https://graph.microsoft.com/v1.0/me/drive?$select=id,driveType,webUrl,quota',token);setText('onedrive-status',`✓ ${oneDrive.driveType||'OneDrive'} erreichbar`);markCard('onedrive-card','good')}catch(e){setText('onedrive-status',`✗ ${e.message}`);markCard('onedrive-card','bad')}
      try{sharePoint=await graph('https://graph.microsoft.com/v1.0/sites/bsrohrbach.sharepoint.com:/sites/BSRohrbachBrsselreise2026?$select=id,displayName,webUrl',token);setText('sharepoint-status',`✓ ${sharePoint.displayName||'SharePoint'} erreichbar`);markCard('sharepoint-card','good')}catch(e){sharePointError=e;setText('sharepoint-status',`Noch nicht freigegeben: ${e.code||e.status||'Graph'} `);markCard('sharepoint-card','warn')}
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
  async function logout(){if(!app||!account)return;await app.logoutPopup({account,postLogoutRedirectUri:config.redirectUri});sessionStorage.clear();location.reload()}
  document.addEventListener('DOMContentLoaded',()=>{$('login-button').addEventListener('click',login);$('permission-button').addEventListener('click',checkPermissions);$('storage-button').addEventListener('click',checkStorage);$('logout-button').addEventListener('click',logout);init()});
})();
