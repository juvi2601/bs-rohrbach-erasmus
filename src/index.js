const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
});

const html = (body, status = 200) => new Response(body, {
  status,
  headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-frame-options': 'SAMEORIGIN'
  }
});

const randomState = () => crypto.randomUUID().replaceAll('-', '');

const cookie = (name, value, maxAge = 600) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

const readCookie = (request, name) => {
  const raw = request.headers.get('cookie') || '';
  const item = raw.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
};

const callbackPage = ({ provider = 'github', token, error }) => {
  const payload = error
    ? `authorization:${provider}:error:${JSON.stringify(error)}`
    : `authorization:${provider}:success:${JSON.stringify({ token, provider })}`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Anmeldung</title></head>
<body style="font-family:system-ui;padding:2rem;text-align:center"><p>${error ? 'Anmeldung fehlgeschlagen.' : 'Anmeldung erfolgreich. Dieses Fenster wird geschlossen.'}</p>
<script>
(function(){
  const message = ${JSON.stringify(payload)};
  if (window.opener) window.opener.postMessage(message, window.location.origin);
  window.close();
})();
</script></body></html>`;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/cms-status') {
      return json({
        ready: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
        repo: 'juvi2601/bs-rohrbach-erasmus',
        branch: 'main'
      }, 200, { 'cache-control': 'no-store' });
    }

    if (url.pathname === '/auth') {
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        return html(callbackPage({ error: 'GitHub OAuth ist noch nicht in Cloudflare konfiguriert.' }), 503);
      }
      const state = randomState();
      const redirectUri = `${url.origin}/callback`;
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'repo,user:email');
      authUrl.searchParams.set('state', state);
      return new Response(null, {
        status: 302,
        headers: {
          location: authUrl.toString(),
          'set-cookie': cookie('cms_oauth_state', state),
          'cache-control': 'no-store'
        }
      });
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const expectedState = readCookie(request, 'cms_oauth_state');
      if (!code || !state || !expectedState || state !== expectedState) {
        return html(callbackPage({ error: 'Ungültige oder abgelaufene Anmeldung.' }), 400);
      }

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'BS-Rohrbach-Erasmus-CMS'
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/callback`,
          state
        })
      });

      const result = await tokenResponse.json();
      if (!tokenResponse.ok || !result.access_token) {
        return html(callbackPage({ error: result.error_description || result.error || 'Token konnte nicht erstellt werden.' }), 400);
      }

      return html(callbackPage({ token: result.access_token }), 200);
    }

    return env.ASSETS.fetch(request);
  }
};
