# Admin-Bereich einmalig aktivieren

Die Programmierung ist bereits enthalten. Für die Anmeldung benötigt GitHub einmalig eine OAuth-App.

## 1. GitHub OAuth-App anlegen

GitHub öffnen → Settings → Developer settings → OAuth Apps → New OAuth App

- Application name: `BS Rohrbach Erasmus Admin`
- Homepage URL: `https://bs-rohrbach-erasmus.j-vierlinger.workers.dev`
- Authorization callback URL: `https://bs-rohrbach-erasmus.j-vierlinger.workers.dev/callback`

Danach die angezeigte **Client ID** notieren und ein **Client Secret** erzeugen.

## 2. Zugangsdaten bei Cloudflare eintragen

Cloudflare Dashboard → Workers & Pages → `bs-rohrbach-erasmus` → Settings → Variables and Secrets

Eintragen:

- Variable/Secret `GITHUB_CLIENT_ID` = Client ID von GitHub
- Secret `GITHUB_CLIENT_SECRET` = Client Secret von GitHub

Anschließend das Deployment nötigenfalls noch einmal starten.

## 3. Admin öffnen

`https://bs-rohrbach-erasmus.j-vierlinger.workers.dev/admin/`

Dann auf **Redaktion öffnen** klicken und mit dem GitHub-Konto anmelden, das Schreibrechte für das Repository `juvi2601/bs-rohrbach-erasmus` besitzt.

## Funktionsweise

Beim Speichern legt Decap CMS einen Commit im Branch `main` an. GitHub löst automatisch das Cloudflare-Deployment aus. Nach kurzer Zeit ist die Änderung öffentlich sichtbar.

## Sicherheit

Das GitHub Client Secret liegt nur als Cloudflare-Secret vor und wird nicht in den Browser oder das Repository geschrieben.
