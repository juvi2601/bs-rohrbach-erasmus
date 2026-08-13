DEV 14.0 – Modul 8.3.7 Automatische Kartenorte & Geocoding

- Kartenorte werden automatisch anhand von Name + Adresse geocodiert.
- Geocoding-Ergebnisse werden in R2 zwischengespeichert, damit dieselbe Adresse nicht wiederholt abgefragt wird.
- Externe Geocoding-Anfragen laufen seriell und höchstens etwa 1x pro Sekunde.
- Die Unterkunft aus Schritt 3 wird automatisch als Kartenpunkt „Hotel“ ergänzt.
- Das vorhandene Hotelbild wird auch auf der Karte verwendet.
- Manuelle Kartenorte bleiben erhalten; Koordinaten müssen nicht eingegeben werden.
- Null-Koordinaten werden nicht mehr versehentlich als 0/0 interpretiert.
- Brüssel-Referenzdaten bleiben unverändert.
