DEV 15.0.10 – Archiv-CSS auf Startseite

Fix:
- Die öffentliche Reiseübersicht nutzt ein eingebettetes <style>-Element und lädt public/styles.css nicht.
- Die Archivregeln aus 15.0.8/15.0.9 konnten daher live nicht greifen.
- Archiv-CSS jetzt direkt in public/index.html eingebaut.
- Archivkarten: 255 px hoch, Desktop 3 Spalten, 100 % Graustufen, deutlich dezenter.
- Hover: leichte Farbrückkehr.
- Status-/Archivlogik unverändert.
