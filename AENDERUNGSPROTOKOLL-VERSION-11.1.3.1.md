# Version 11.1.3.1 – Wrangler-Hotfix

## Behoben

- Workername in `wrangler.jsonc` von `bs-rohrbach-erasmus-v2` auf `bs-rohrbach-erasmus` korrigiert.
- Den kompletten `vars`-Block entfernt. Laufzeitvariablen und Secrets werden ausschließlich in Cloudflare unter **Settings → Variables and Secrets** verwaltet.
- Dadurch werden `MS_CLIENT_ID`, `MS_TENANT_ID` und andere Cloudflare-Werte bei künftigen GitHub-Deployments nicht mehr durch die Repository-Konfiguration überschrieben oder entfernt.

## Wichtig

Die folgenden Werte müssen in Cloudflare bestehen bleiben und gehören nicht in GitHub:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`
- `MS_TENANT_ID`
- `PHOTO_INBOX_PIN`
