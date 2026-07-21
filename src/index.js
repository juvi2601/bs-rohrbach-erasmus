const REPO = 'juvi2601/bs-rohrbach-erasmus';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function oauthCallbackPage(status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const title = status === 'success' ? 'Anmeldung abgeschlossen' : 'Anmeldung fehlgeschlagen';

  return new Response(`<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#f4f7fb;color:#10243e;display:grid;place-items:center;min-height:100vh;margin:0}
    main{background:#fff;padding:28px;border-radius:18px;box-shadow:0 14px 40px #10243e20;text-align:center;max-width:460px}
  </style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p>${status === 'success' ? 'Das Redaktionssystem wird geöffnet …' : 'Bitte schließe dieses Fenster und versuche es erneut.'}</p>
</main>
<script>
(function () {
  var authMessage = ${JSON.stringify(message)};
  var sent = false;

  function sendResult() {
    if (sent || !window.opener) return;
    sent = true;
    window.opener.postMessage(authMessage, '*');
    window.removeEventListener('message', sendResult, false);
    setTimeout(function () { window.close(); }, 300);
  }

  // Decap erwartet zuerst diese Bereitschaftsmeldung und antwortet darauf.
  window.addEventListener('message', sendResult, false);
  if (window.opener) {
    window.opener.postMessage('authorizing:github', '*');
    // Robuster Fallback für Browser/Erweiterungen, die die Antwort blockieren.
    setTimeout(sendResult, 2000);
  }
})();
</script>
</body>
</html>`, {
    status: status === 'success' ? 200 : 400,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      'referrer-policy': 'no-referrer'
    }
  });
}

function getOAuthConfig(env) {
  const clientId = String(env.GITHUB_CLIENT_ID || '').trim();
  const clientSecret = String(env.GITHUB_CLIENT_SECRET || '').trim();
  return { clientId, clientSecret };
}

async function handleAuth(url, env) {
  const { clientId, clientSecret } = getOAuthConfig(env);
  if (!clientId || !clientSecret) {
    return oauthCallbackPage('error', {
      message: 'GITHUB_CLIENT_ID oder GITHUB_CLIENT_SECRET fehlt in Cloudflare.'
    });
  }

  const provider = url.searchParams.get('provider');
  if (provider && provider !== 'github') {
    return oauthCallbackPage('error', { message: 'Ungültiger OAuth-Anbieter.' });
  }

  const callbackUrl = `${url.origin}/callback?provider=github`;
  const githubUrl = new URL('https://github.com/login/oauth/authorize');
  githubUrl.searchParams.set('response_type', 'code');
  githubUrl.searchParams.set('client_id', clientId);
  githubUrl.searchParams.set('redirect_uri', callbackUrl);
  githubUrl.searchParams.set('scope', 'public_repo,user');

  return Response.redirect(githubUrl.toString(), 302);
}

async function handleCallback(url, env) {
  const { clientId, clientSecret } = getOAuthConfig(env);
  if (!clientId || !clientSecret) {
    return oauthCallbackPage('error', {
      message: 'GitHub OAuth ist in Cloudflare nicht vollständig konfiguriert.'
    });
  }

  const provider = url.searchParams.get('provider');
  if (provider && provider !== 'github') {
    return oauthCallbackPage('error', { message: 'Ungültiger OAuth-Anbieter.' });
  }

  const githubError = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (githubError) {
    return oauthCallbackPage('error', { message: githubError });
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return oauthCallbackPage('error', { message: 'GitHub hat keinen Anmeldecode zurückgegeben.' });
  }

  const callbackUrl = `${url.origin}/callback?provider=github`;
  let tokenResponse;
  try {
    tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'BS-Rohrbach-Erasmus-CMS'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code'
      })
    });
  } catch (error) {
    return oauthCallbackPage('error', { message: `GitHub ist nicht erreichbar: ${String(error)}` });
  }

  let result;
  try {
    result = await tokenResponse.json();
  } catch {
    return oauthCallbackPage('error', { message: 'GitHub hat eine ungültige Antwort geliefert.' });
  }

  if (!tokenResponse.ok || !result.access_token) {
    return oauthCallbackPage('error', {
      message: result.error_description || result.error || 'GitHub konnte kein Zugriffstoken erstellen.'
    });
  }

  // Genau das von Decap erwartete Format: { token: "..." }
  return oauthCallbackPage('success', { token: result.access_token });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth') return handleAuth(url, env);
    if (url.pathname === '/callback') return handleCallback(url, env);

    if (url.pathname === '/api/cms-status') {
      const { clientId, clientSecret } = getOAuthConfig(env);
      return json({
        ready: Boolean(clientId && clientSecret),
        clientIdConfigured: Boolean(clientId),
        clientSecretConfigured: Boolean(clientSecret),
        repo: REPO,
        branch: 'main',
        version: '4.3.5'
      });
    }

    return env.ASSETS.fetch(request);
  }
};
