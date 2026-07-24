# Kartenfix 9.0.3

Behoben wurden die aus dem alten Chat bekannten Leaflet-Konflikte:

- keine erzwungenen 256-px-Kachelgrößen mehr
- keine manuellen Positionen für Leaflet-Panes oder Tile-Container
- korrekter offizieller Leaflet-CSS-Integritätswert
- globale `img { max-width: 100% }`-Regel nur für Leaflet neutralisiert
- Zoom-Plus und Zoom-Minus mit fester, normaler Größe
- Quellenangabe nicht mehr über die Kartenbreite gestreckt
- Service-Worker-Cache auf `bsr-travel-v903` erhöht

Der bestehende Kartenzoom und die CMS-Daten bleiben unverändert.
