# Hotfix 9.0.2 – Reisekarte

## Ursache
Eine alte CSS-Regel aus Version 8.3 blendete direkte Leaflet-Ebenen und die Steuerung im Kartencontainer mit `display:none!important` aus. Dadurch blieb nur der hellblaue Hintergrund sichtbar.

## Korrektur
Die Regel wurde aus `styles.css` und `public/styles.css` entfernt. Leaflet-Kacheln, Marker, Popups und Zoom-Steuerung können dadurch wieder angezeigt werden.
