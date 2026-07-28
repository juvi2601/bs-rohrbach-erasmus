# Update 11.2.1 installieren

Dieses kleine Folgeupdate entfernt das nicht mehr benötigte Tages-Icon aus dem CMS und aus den großen Tagesbildern. Die wählbaren Programmsymbole bei den einzelnen Programmpunkten bleiben unverändert erhalten.

## Installation

1. Den Inhalt dieses Ordners in den Hauptordner `bs-rohrbach-erasmus` kopieren.
2. Vorhandene Dateien ersetzen.
3. GitHub Desktop öffnen.
4. Commit-Nachricht: `Version 11.2.1 – Tages-Icon entfernt`
5. **Commit to main** und danach **Push origin**.
6. Nach dem Cloudflare-Deployment die Adminseite und Website mit `Strg + F5` aktualisieren.

## Test

- Im CMS unter **Programm** darf beim Reisetag nach dem Untertitel kein Feld **Icon (optional)** mehr erscheinen.
- Bei den einzelnen Programmpunkten bleibt das Dropdown **Programmsymbol (optional)** vorhanden.
- Auf der öffentlichen Website erscheint im großen Tagesbild kein zusätzliches Symbol mehr.
- Dashboard-Version: **11.2.1**.
