BS Rohrbach Erasmus+ – 12.1.0 DEV.12

Eigener Schüler-Upload vollständig integriert.

Neu / bereinigt:
- Der sichtbare Schülerbereich verweist direkt auf /upload.html.
- Veraltete Hinweise auf Microsoft Forms und noch einzurichtende Microsoft-365-Links wurden entfernt.
- Die Schüler laden Fotos und kurze Videos ausschließlich über die Erasmus-Website hoch.
- Microsoft bleibt nur für die sichere Anmeldung mit dem Schulkonto sichtbar.
- Datenschutztext an den tatsächlich verwendeten Ablauf angepasst: Microsoft-Anmeldung -> privater Cloudflare-R2-Eingang -> manuelle Lehrerfreigabe -> öffentliche Galerie.
- Fallback-Texte in index.html wurden ebenfalls aktualisiert, damit auch bei verzögertem Laden von site.json keine alten Forms-Texte erscheinen.
- Upload-Seite und zentrale Versionsanzeige auf 12.1.0-dev.12 aktualisiert.

Unverändert:
- R2-Upload und Dateigrenzen
- Admin-Medienfreigabe
- approved/pending-Trennung
- öffentliche Galerie-API aus DEV.11/DEV.11.1
- Microsoft-/Entra-Berechtigungen

TEST NACH DEM DEPLOY:
1. Startseite mit Strg+F5 laden.
2. Im Bereich „Interner Bereich“ darf Microsoft Forms nirgends mehr erwähnt werden.
3. „Zum Foto- & Video-Upload“ anklicken -> /upload.html.
4. Mit einem Schüler-Schulkonto anmelden und einen normalen Test-Upload durchführen.
5. Als Admin /admin/media-inbox.html öffnen und Medium freigeben.
6. Prüfen, dass das freigegebene Medium in der öffentlichen Galerie erscheint.

Commit-Vorschlag:
Version 12.1.0 DEV.12 – Eigener Schüler-Upload vollständig integriert
