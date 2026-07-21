# Admin-/CMS-Einrichtung – Version 4.3.5

## Bereits eingerichtet und unverändert lassen

In Cloudflare müssen vorhanden sein:

- `GITHUB_CLIENT_ID` als Plaintext
- `GITHUB_CLIENT_SECRET` als Secret

In der GitHub OAuth App muss die Callback-URL lauten:

`https://bs-rohrbach-erasmus.j-vierlinger.workers.dev/callback`

GitHub akzeptiert dabei den vom Worker ergänzten Query-Parameter `?provider=github`.

## Nach dem Upload

1. Dateien in GitHub ersetzen und committen.
2. Cloudflare-Deployment abwarten.
3. Diese Diagnoseadresse öffnen:
   `https://bs-rohrbach-erasmus.j-vierlinger.workers.dev/api/cms-status`
4. Dort müssen `ready`, `clientIdConfigured` und `clientSecretConfigured` jeweils `true` sein.
5. Danach `/admin/cms/` in einem Inkognito-Fenster öffnen und mit GitHub anmelden.

## Sicherheit

Der Client Secret darf niemals in GitHub, Screenshots oder den Chat kopiert werden.
