const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
});

const html = (body, status = 200, extraHeaders = {}) => new Response(body, {
  status,
  headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-frame-options': 'SAMEORIGIN',
    ...extraHeaders
  }
});

const randomState = () => crypto.randomUUID().replaceAll('-', '');

const cookie = (name, value, maxAge = 600) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

const clearCookie = (name) =>
  `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

const readCookie = (request, name) => {
  const raw = request.headers.get('cookie') || '';
  const item = raw.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
};

// Decap CMS uses a short postMessage handshake. The callback window must first
// announce "authorizing:github", wait for the opener to answer and only then
// return the token. Sending the token immediately makes the popup disappear
// without logging the user in.
const callbackPage = ({ token, error }) => {
  const status = error ? 'error' : 'success';
  const data = error ? { message: String(error), provider: 'github' } : { token, provider: 'github' };
  const resultMessage = `authorization:github:${status}:${JSON.stringify(data)}`;

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GitHub-Anmeldung</title>
</head>
<body style="font-family:system-ui;padding:2rem;text-align:center;background:#f5f7fb;color:#0b2545">
  <p>${error ? 'Die Anmeldung ist fehlgeschlagen.' : 'Anmeldung wird abgeschlossen …'}</p>
  <script>
  (function () {
    const resultMessage = ${JSON.stringify(resultMessage)};
    const finish = function () {
      if (!window.opener) return;
      window.opener.postMessage(resultMessage, '*');
            setTimeout(function () { window.close(); }, 250);
    };

    window.addEventListener('message', function (event) {
      if (event.source === window.opener && event.data === 'authorizing:github') finish();
    }, false);

    if (window.opener) {
      window.opener.postMessage('authorizing:github', '*');
      // Fallback for browsers/extensions that suppress the reply handshake.
      setTimeout(finish, 1500);
    }
  })();
  </script>
</body>
</html>`;
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
        return html(callbackPage({ error: 'GitHub OAuth ist in Cloudflare noch nicht vollständig konfiguriert.' }), 503);
      }

      const provider = url.searchParams.get('provider');
      if (provider && provider !== 'github') {
        return html(callbackPage({ error: 'Unbekannter Anmeldeanbieter.' }), 400);
      }

      const state = randomState();
      const redirectUri = `${url.origin}/callback`;
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'public_repo user:email');
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
      const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');
      const expectedState = readCookie(request, 'cms_oauth_state');

      if (oauthError) {
        return html(callbackPage({ error: oauthError }), 400, {
          'set-cookie': clearCookie('cms_oauth_state')
        });
      }

      if (!code || !state || !expectedState || state !== expectedState) {
        return html(callbackPage({ error: 'Ungültige oder abgelaufene Anmeldung. Bitte erneut versuchen.' }), 400, {
          'set-cookie': clearCookie('cms_oauth_state')
        });
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
        return html(callbackPage({
          error: result.error_description || result.error || 'GitHub konnte kein Zugriffstoken erstellen.'
        }), 400, { 'set-cookie': clearCookie('cms_oauth_state') });
      }

      return html(callbackPage({ token: result.access_token }), 200, {
        'set-cookie': clearCookie('cms_oauth_state')
      });
    }

    return env.ASSETS.fetch(request);
  }
};
