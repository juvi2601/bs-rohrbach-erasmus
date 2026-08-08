VERSION 12.1.0 DEV.9 – R2 FOTO- UND VIDEOEINGANG (NEUAUFBAU)

Basis: Git-HEAD c2d3c80 (DEV.8.2). Die zuvor lokal vorbereitete DEV.9-Version wurde bewusst verworfen.

NEU
- Microsoft-Schullogin bleibt Pflicht.
- Der Worker prüft serverseitig das gültige Graph-Token über /me, Tenant-ID und @bs-rohrbach.ac.at.
- Private Speicherung im R2-Binding MEDIA_BUCKET / Bucket bs-rohrbach-erasmus-photos.
- Projektstruktur: bruessel-2026/pending/images/<User-ID>/... und .../videos/<User-ID>/...
- Fotos: JPG/PNG/WebP/HEIC/HEIF, max. 12 MB pro Datei. KEINE Prüfung oder Begrenzung der Bildauflösung.
- Videos: MP4/MOV, max. 30 Sekunden und max. 90 MB pro Datei.
- Maximal 10 Medien pro Upload-Vorgang.
- Speicher-Sicherheitsgrenze: 9 GB (unter dem kostenlosen 10-GB-Kontingent). Upload wird darüber serverseitig abgelehnt.
- Medien bleiben nach Upload privat/pending. Admin-Freigabe und Galerie folgen in einem nächsten DEV-Schritt.

WARUM VIDEOS 90 MB UND NICHT 150 MB?
Cloudflare Free akzeptiert pro HTTP-Anfrage maximal 100 MB Request-Body. 90 MB lässt sichere Reserve. Größere Videos können später bei Bedarf mit R2-Multipart-Upload ergänzt werden.

VOR DEM EINPIELEN
1. In GitHub Desktop die 5 Änderungen des alten DEV.9-Prototyps verwerfen (Discard changes).
2. Prüfen, dass Working Tree sauber ist.
3. Dieses Update darüber kopieren.

CLOUDFLARE
- R2-Bucket existiert: bs-rohrbach-erasmus-photos
- Dashboard-Binding existiert: MEDIA_BUCKET
- Dieses Update trägt dasselbe Binding zusätzlich in wrangler.jsonc ein.

ENTRA
Als SPA-Redirect-URI zusätzlich eintragen:
https://erasmus-bsrohrbach.eu/upload.html
Die vorhandene /admin/microsoft.html URI bleibt bestehen.
Für den neuen R2-Upload wird nur User.Read angefordert; Sites.Read.All ist nicht nötig.

COMMIT-VORSCHLAG
Version 12.1.0 DEV.9 – R2 Medien-Upload neu aufgebaut
