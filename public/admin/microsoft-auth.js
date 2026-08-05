(() => {
  'use strict';

  const REQUIRED_DOMAIN = 'bs-rohrbach.ac.at';
  const SCOPES = ['openid', 'profile', 'email', 'User.Read', 'Files.ReadWrite'];
  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };

  let config = null;
  let app = null;
  let account = null;

  function setState(kind, title, detail) {
    const card = $('ms-status');
    card?.classList.remove('ready', 'warning', 'error');
    if (kind) card?.classList.add(kind);
    setText('ms-title', title);
    setText('ms-text', detail);
  }

  function setLoginView(isLoggedIn) {
    $('login-button').hidden = isLoggedIn;
    $('permission-button').hidden = !isLoggedIn;
    $('logout-button').hidden = !isLoggedIn;
    $('account-panel').hidden = !isLoggedIn;
  }

  function displayAccount(current) {
    account = current || null;
    setLoginView(Boolean(account));
    if (!account) return;
    setText('account-name', account.name || 'Microsoft-Benutzer');
    setText('account-user', account.username || '–');
    setText('account-tenant', account.tenantId || '–');
    const domainOk = String(account.username || '').toLowerCase().endsWith(`@${REQUIRED_DOMAIN}`);
    setText('account-domain', domainOk ? '✓ Schulkonto erkannt' : '⚠ Konto gehört nicht zur Schuldomain');
    $('account-domain')?.classList.toggle('bad-text', !domainOk);
    setState(domainOk ? 'ready' : 'warning', 'Microsoft-Anmeldung aktiv', domainOk ? `${account.name || account.username} ist angemeldet.` : 'Anmeldung erfolgreich, aber nicht mit einem BS-Rohrbach-Schulkonto.');
  }

  async function init() {
    try {
      const response = await fetch('/api/microsoft/public-config', { cache: 'no-store' });
      config = await response.json();
      if (!response.ok || !config.configured) throw new Error(config.message || 'Tenant-ID oder Client-ID fehlt in Cloudflare.');
      setText('redirect-uri', config.redirectUri);
      setText('client-id-short', `${config.clientId.slice(0, 8)}…${config.clientId.slice(-4)}`);

      app = new msal.PublicClientApplication({
        auth: {
          clientId: config.clientId,
          authority: `https://login.microsoftonline.com/${config.tenantId}`,
          redirectUri: config.redirectUri,
          postLogoutRedirectUri: config.redirectUri,
          navigateToLoginRequestUrl: false
        },
        cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
        system: { allowNativeBroker: false }
      });

      if (typeof app.initialize === 'function') await app.initialize();
      const redirectResult = await app.handleRedirectPromise();
      const cached = redirectResult?.account || app.getActiveAccount() || app.getAllAccounts()[0] || null;
      if (cached) app.setActiveAccount(cached);
      displayAccount(cached);
      if (!cached) setState('ready', 'Microsoft-Anmeldung bereit', 'Mit dem Microsoft-365-Schulkonto anmelden.');
    } catch (error) {
      setState('error', 'Microsoft-Konfiguration nicht bereit', error.message || String(error));
      setText('auth-result', `FEHLER: ${error.message || String(error)}`);
      $('login-button').disabled = true;
    }
  }

  async function login() {
    const button = $('login-button');
    button.disabled = true;
    button.textContent = 'Microsoft-Anmeldung wird geöffnet …';
    setText('auth-result', 'Microsoft-Anmeldefenster wird geöffnet …');
    try {
      const result = await app.loginPopup({ scopes: SCOPES, prompt: 'select_account' });
      app.setActiveAccount(result.account);
      displayAccount(result.account);
      setText('auth-result', `ANMELDUNG ERFOLGREICH\n\n${result.account.name || ''}\n${result.account.username || ''}\n\nAls Nächstes können die delegierten Berechtigungen geprüft werden.`);
    } catch (error) {
      if (error.errorCode === 'user_cancelled') setText('auth-result', 'Die Anmeldung wurde abgebrochen. Es wurden keine Daten verändert.');
      else setText('auth-result', `ANMELDUNG FEHLGESCHLAGEN\n\n${error.message || String(error)}\n\nCode: ${error.errorCode || '–'}`);
      setState('error', 'Microsoft-Anmeldung fehlgeschlagen', error.errorCode || error.message || String(error));
    } finally {
      button.disabled = false;
      button.textContent = 'Mit Microsoft-365-Schulkonto anmelden';
    }
  }

  async function checkPermissions() {
    const button = $('permission-button');
    button.disabled = true;
    button.textContent = 'Berechtigungen werden geprüft …';
    try {
      const request = { scopes: SCOPES, account };
      let token;
      try { token = await app.acquireTokenSilent(request); }
      catch { token = await app.acquireTokenPopup(request); }

      const headers = { Authorization: `Bearer ${token.accessToken}` };
      const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName', { headers });
      const profile = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(profile.error?.message || `Microsoft Graph: HTTP ${profileResponse.status}`);

      const claims = token.accessToken.split('.')[1];
      const decoded = JSON.parse(atob(claims.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(claims.length / 4) * 4, '=')));
      const scopes = String(decoded.scp || '').split(/\s+/).filter(Boolean);
      const hasFiles = scopes.includes('Files.ReadWrite') || scopes.includes('Files.ReadWrite.All');

      setText('profile-status', `✓ ${profile.displayName} (${profile.userPrincipalName})`);
      setText('files-status', hasFiles ? '✓ Files.ReadWrite wurde erteilt' : '✗ Files.ReadWrite fehlt');
      $('profile-card')?.classList.add('good');
      $('files-card')?.classList.toggle('good', hasFiles);
      $('files-card')?.classList.toggle('bad', !hasFiles);
      $('scope-list').innerHTML = scopes.map(scope => `<span>${scope}</span>`).join('');
      setText('auth-result', `RECHTETEST ERFOLGREICH\n\nBenutzer: ${profile.displayName}\nKonto: ${profile.userPrincipalName}\nTenant: ${decoded.tid || '–'}\nErteilte Scopes: ${scopes.join(', ') || 'keine'}\n\n${hasFiles ? 'Modul 1 ist erfolgreich abgeschlossen. Der nächste Schritt ist der Zugriffstest auf den vorgesehenen SharePoint-/OneDrive-Speicher.' : 'Die Anmeldung funktioniert, aber Files.ReadWrite wurde nicht erteilt.'}`);
      setState(hasFiles ? 'ready' : 'warning', hasFiles ? 'Modul 1 erfolgreich' : 'Anmeldung aktiv, Dateirecht fehlt', hasFiles ? 'Login und delegierte Berechtigung funktionieren.' : 'Files.ReadWrite muss noch genehmigt werden.');
    } catch (error) {
      setText('auth-result', `RECHTETEST FEHLGESCHLAGEN\n\n${error.message || String(error)}\n\nCode: ${error.errorCode || '–'}`);
      setState('error', 'Rechtetest fehlgeschlagen', error.errorCode || error.message || String(error));
    } finally {
      button.disabled = false;
      button.textContent = 'Berechtigungen prüfen';
    }
  }

  async function logout() {
    if (!app || !account) return;
    await app.logoutPopup({ account, postLogoutRedirectUri: config.redirectUri });
    sessionStorage.clear();
    location.reload();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('login-button').addEventListener('click', login);
    $('permission-button').addEventListener('click', checkPermissions);
    $('logout-button').addEventListener('click', logout);
    init();
  });
})();
