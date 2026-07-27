# Version 11.1.3.2 – Cloudflare-Variablen dauerhaft erhalten

## Änderung

In `wrangler.jsonc` wurde die offizielle Wrangler-Option

```json
"keep_vars": true
```

ergänzt.

Damit bleiben die im Cloudflare-Dashboard gepflegten Klartextvariablen bei zukünftigen GitHub-/Wrangler-Deployments erhalten, insbesondere:

- `GITHUB_CLIENT_ID`
- `MS_CLIENT_ID`
- `MS_TENANT_ID`

Die verschlüsselten Secrets bleiben weiterhin ausschließlich in Cloudflare gespeichert und werden nicht in GitHub geschrieben.

## Nicht verändert

- Worker-Code
- Microsoft-Graph-Verbindung
- Adminbereich
- Website-Inhalte
- vorhandene Secrets
