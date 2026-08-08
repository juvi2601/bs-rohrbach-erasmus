BS Rohrbach Erasmus+ – 12.1.0-dev.11.1

Hotfix für DEV.11 R2-Galerie.

Behoben:
- /api/media/gallery verursachte Cloudflare Error 1101.
- Ursache: Der Header-Optionsblock wurde versehentlich als zweiter Parameter an json() übergeben und dadurch als HTTP-Statuscode verwendet.
- Korrektur: Status 200 wird explizit übergeben; Cache-Control wird als dritter Parameter übergeben.

Unverändert:
- R2 Upload/Freigabe
- Medien-Metadaten
- Foto-/Video-Größenlimits
- Auflösung von Fotos wird weiterhin NICHT beschränkt.
