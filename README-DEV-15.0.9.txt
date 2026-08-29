DEV 15.0.9 – Kompaktes Graustufen-Archiv

Korrektur zu 15.0.8:
Die Reisekarten verwenden das Titelbild als CSS-Hintergrund (.trip-bg), nicht als <img>. Deshalb griff der vorige Graustufen-Selektor nicht auf das Bild.

Jetzt:
- .trip-bg im Archiv tatsächlich 100 % Graustufen.
- Archivkarten fest kompakt: 260 px Höhe.
- Desktop 3 Karten pro Reihe, Tablet 2, Smartphone 1.
- Archivkarten deutlich weniger dominant.
- Beim Hover nur leichte Farbrückkehr (weiterhin klar als Archiv erkennbar).
- Status-/Archivlogik unverändert.
