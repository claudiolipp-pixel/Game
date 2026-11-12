# Letzter Winter

Endloses 2D-Top-Down-Zombie-Survival als Progressive Web App – reines HTML5 Canvas + Vanilla JavaScript,
keine Frameworks, keine externen Assets. Optimiert für iPad (Safari / Homescreen-App), läuft offline.

> Stand und Spielanleitung: siehe Abschnitt [Spielen & Testen](#spielen--testen). Die ursprüngliche
> Projektbeschreibung (Auftrag) steht unverändert unter [Projektspezifikation](#projektspezifikation).

## Spielen & Testen

### Lokal (Desktop)
```bash
node tools/serve.mjs 8080      # oder: python3 -m http.server 8080
```
Dann `http://localhost:8080/` öffnen.

### iPad im selben WLAN
1. Auf dem Rechner `node tools/serve.mjs 8080` starten – die Konsole zeigt die WLAN-Adresse (z. B. `http://192.168.1.23:8080/`).
2. Diese Adresse auf dem iPad in Safari öffnen.
3. Hinweis: Über `http://` im WLAN läuft das Spiel, aber der Service Worker (Offline-Modus) wird von iOS nur über
   `https://` oder `localhost` registriert. Für den echten Offline-Test bitte GitHub Pages nutzen.

### Deployment auf GitHub Pages
1. Repository auf GitHub → **Settings → Pages**.
2. **Source: Deploy from a branch**, Branch auswählen (z. B. `main`), Ordner `/ (root)` → **Save**.
3. Nach ca. einer Minute ist das Spiel unter `https://<benutzer>.github.io/<repo>/` erreichbar.
   Alle Pfade sind relativ, es ist kein Build-Schritt nötig (`.nojekyll` liegt bei).

### „Zum Home-Bildschirm“ (iPad)
1. Die GitHub-Pages-Adresse in **Safari** öffnen und einmal vollständig laden lassen.
2. **Teilen-Symbol → „Zum Home-Bildschirm“ → Hinzufügen.**
3. Das Spiel startet nun im Vollbild ohne Browserleiste und funktioniert auch im Flugmodus.

### Nach Code-Änderungen
```bash
node tools/make-sw.mjs      # aktualisiert Dateiliste + Cache-Version in sw.js
node tools/make-icons.mjs   # (nur bei Icon-Änderungen; benötigt Playwright)
```

## Steuerung

| Aktion | iPad (Touch) | Tastatur/Maus | Gamepad |
|---|---|---|---|
| Bewegen | linker Stick (leicht = schleichen) | WASD / Pfeile, `C` schleichen | linker Stick |
| Zielen + Angreifen | ⚔ halten (Auto-Zielen) oder rechter Stick (weit auslenken = feuern) | Maus + Klick | rechter Stick / RT |
| Sprinten | 🏃 (umschalten) | Shift | LT / L3 |
| Interagieren | ✋ | `E` | A |
| Waffe wechseln / Nachladen | 🔁 / Tipp auf Waffenanzeige | `Q` / `R` | LB / X |
| Inventar / Bauen | 🎒 / 🔨 | `I` / `B` | Y / RB |
| Taschenlampe | 🔦 | `F` | Select |
| Bauen: platzieren / drehen / abbrechen | Leiste unten | Leertaste / `T` / `X` | D-Pad ↓ / D-Pad ↑ / B |
| Karte / Pause | Minimap antippen / Ⅱ | – / `Esc` | – / Start |

Linkshänder-Modus, Joystick-Größe, feste Joystick-Position, Grafikqualität, Tageslänge und „Fallen markieren“
stehen in den Einstellungen.

## Kurzanleitung

- **Ziel:** so viele Tage wie möglich überleben. 1 Tag ≈ 8 Minuten, 4 Jahreszeiten à 7 Tage, jedes Jahr wird härter.
- **Tag 1:** Bäume/Steine schlagen (Holz, Stein), Kisten in Gebäuden plündern, vor der Nacht ein Lagerfeuer bauen.
- **Wasser** aus Seen/Flüssen am Lagerfeuer abkochen, Regen mit Regensammlern auffangen. **Fleisch** braten.
- **Lärm** (Schüsse, Sprinten, Glas, Generator) lockt Zombies an – Bogen, Armbrust-Turm und Schleichen sind leise.
- **Biss = Infektionsrisiko**, heilbar nur mit Antibiotika (Supermarkt, Polizei, Militär).
- **Alle 10 Tage Blutmond:** Horden greifen an. Wände, Speerwälle, Fallen und Türme vorbereiten, Kiste mit
  Munition neben Türme stellen. Baupläne für Türme liegen in Baumarkt, Polizeistation und Militärposten.
- **Winter:** Mantel nähen (10 Stoff), Feuer und Dach nutzen, Vorräte anlegen. Seen sind zugefroren (begehbar).
- **Bett:** schlafen überspringt die Nacht und speichert – nur wenn keine Zombies in der Nähe sind.

## Architektur

```
index.html, style.css      HUD + Menüs als DOM-Overlay, Spielfeld als Canvas
manifest.json, sw.js       PWA (fullscreen, Querformat, Cache-first-Service-Worker)
icons/                     per Canvas generierte PNG-Icons (tools/make-icons.mjs)
src/config.js              ALLE Balancing-Werte: Items, Rezepte, Bauwerke, Zombies, Loot, Wetter …
src/state.js               gemeinsamer Spielzustand (G)
src/core/                  loop (Fixed Timestep 60 Hz + Interpolation), input (Touch/Tastatur/Gamepad),
                           save (localStorage), rng (Hash + Perlin), game (Orchestrierung, Auto-Save)
src/world/                 world (Chunks, Biome, Gebäude, Kollision, Persistenz), time, weather
src/entities/              player, zombies (Pool + KI + Wildtiere), projectiles (Pool), fx (Partikel-Pool)
src/systems/               spatial (Spatial Hash), flowfield (Horden-Pathfinding), noise, combat,
                           inventory, survival, interact
src/building/              structures (Bauwerke + Fallen), turrets (Türme, MG, Generator, Stromzaun), build
src/render/                sprites (prozedurale Pixel-Art), renderer, lighting (Compositing), weatherfx
src/ui/                    hud, menus, minimap, tutorial
src/audio/audio.js         Web-Audio-Synthesizer (entsperrt nach erster Geste)
```

Performance: Object Pools für Zombies/Projektile/Partikel, Spatial Hash für alle Nachbarschaftsabfragen,
Flow-Field (Bucket-Dijkstra, alle 0,4 s) statt Einzel-Pathfinding, Chunks als vorgerenderte Canvas,
Culling außerhalb des Sichtfelds, Türme scannen nur alle 200 ms, Licht-Layer in 1/3 Auflösung,
keine Allokationen in den heißen Schleifen. Bei Bedarf „Grafikqualität“ reduzieren.

---

## Projektspezifikation

### Projekt: "Letzter Winter" – 2D Top-Down Zombie Survival (Endless)

#### Ziel
Baue ein vollständiges, endloses 2D-Zombie-Survival-Spiel als Progressive Web App (PWA),
das auf einem iPad in Safari bzw. als Homescreen-App flüssig und OFFLINE läuft.
Das Spiel endet nur mit dem Tod der Spielfigur. Score = überlebte Tage.

#### Technische Vorgaben (verbindlich)
- Reines HTML5 Canvas + Vanilla JavaScript (ES-Module), KEINE Frameworks, KEINE externen Assets,
  KEINE CDNs. Alle Grafiken prozedural im Code (Pixel-Art-Stil), alle Sounds per Web Audio API synthetisiert.
- PWA: manifest.json, Service Worker (cache-first), Icons per Canvas generiert und als PNG gespeichert,
  "display": "fullscreen", Querformat.
- iPad-Optimierung:
  - Touch-Steuerung: virtueller Joystick links (Bewegung), rechts Ziel-/Schuss-Stick (Twin-Stick),
    plus Buttons für Interagieren, Inventar, Bauen, Sprinten. Optional Bluetooth-Gamepad (Gamepad API)
    und Tastatur/Maus als Fallback.
  - Kein Zoom/Scroll/Doppeltipp-Zoom (touch-action: none, passive:false), Safe-Area-Insets beachten.
  - Retina: devicePixelRatio berücksichtigen, aber interne Render-Auflösung skalierbar für Performance.
  - Audio erst nach erster Nutzer-Geste entsperren (iOS-Pflicht).
  - Ziel: stabile 60 FPS auf einem iPad der letzten 4 Jahre. Object Pooling, Culling außerhalb des
    Sichtfelds, Spatial Hash für Kollisionen, keine Allokationen im Game Loop.
- Fixed-Timestep Game Loop (z. B. 60 Hz Logik, interpoliertes Rendering).
- Pausieren bei visibilitychange (App-Wechsel), automatisches Speichern.
- Speicherstand in localStorage/IndexedDB: Auto-Save alle 60 s + beim Pausieren. Highscore-Liste.

#### Welt
- Unendliche, prozedural generierte Welt in Chunks (Seed-basiert, Simplex/Perlin-Noise).
- Biome: Wald, Wiese, verlassene Kleinstadt, Farmland, See/Fluss, Sumpf.
- Lootbare Gebäude (Häuser, Tankstelle, Supermarkt, Baumarkt, Polizeistation, Militärposten)
  mit Innenräumen oder Dach-Ausblendung.
- Chunks werden nach Entfernung geladen/entladen. Veränderungen (geplünderte Kisten, gebaute Wände,
  Fallen, Türme) bleiben gespeichert.

#### Zeit, Tag/Nacht & Jahreszeiten
- 1 Spieltag ≈ 8 Minuten Echtzeit (konfigurierbar). Dynamische Beleuchtung, nachts Sicht stark eingeschränkt,
  Taschenlampe/Lagerfeuer als Lichtquellen (Lichtkegel per Canvas-Compositing).
- 4 Jahreszeiten zu je 7 Tagen, Zyklus wiederholt sich endlos, jedes Jahr schwerer:
  - Frühling: Regen, Pflanzen wachsen, moderate Temperaturen, Zombies normal.
  - Sommer: Hitze → mehr Durst, Gewitter, lange Tage, Zombies in Horden.
  - Herbst: Ernte, Nebel (reduzierte Sicht), kürzere Tage, Tiere wandern.
  - Winter: Schnee (visuell + Spuren), Kälte → Erfrierungsgefahr, kaum Nahrung, Seen frieren zu,
    Zombies langsamer, aber Blizzards.
- Wettersystem: Regen, Gewitter, Nebel, Schnee, Blizzard, Hitzewelle – mit Partikeleffekten und Gameplay-Wirkung.
- Visuelle Farbpalette ändert sich mit der Jahreszeit.

#### Überleben
- Werte: Gesundheit, Hunger, Durst, Körpertemperatur, Ausdauer, Infektion.
- Zombiebiss = Infektionsrisiko, heilbar nur mit seltenen Antibiotika.
- Nahrung verdirbt (im Sommer schneller, im Winter langsamer). Kochen am Feuer.
- Wasser: Fluss/See (abkochen!), Regen sammeln, Flaschen.
- Kleidung mit Kälte-/Hitze-/Rüstungswerten.

#### Zombies & Gegner
- Typen: Walker (langsam), Runner (schnell, schwach), Brute (Tank), Screamer (lockt andere an),
  Crawler (schwer zu sehen), später saisonale Varianten (z. B. Frost-Zombies im Winter).
- Lärm-System: Schüsse, Sprinten, Glas zerbrechen, Generatoren und laute Fallen erzeugen Lärm,
  der Zombies anlockt. Schleichen möglich.
- Einfache, performante KI: Wandern → Wahrnehmung (Sicht + Gehör) → Verfolgen → Angreifen.
  Flow-Field-Pathfinding für Horden.
- Schwierigkeit skaliert mit überlebten Tagen: mehr Zombies, neue Typen, Blutmond-Nächte alle 10 Tage
  mit Horden-Angriff auf die Basis.

#### Kampf, Loot & Crafting
- Nahkampf (Messer, Brechstange, Axt, Baseballschläger) mit Haltbarkeit.
- Fernkampf (Pistole, Schrotflinte, Gewehr, Bogen) mit seltener Munition und Nachladen.
- Grid-Inventar mit Gewichtslimit, Rucksäcke erweitern es.
- Crafting-Menü (touchfreundlich, große Buttons): Verbände, Fackeln, Pfeile, Bolzen, Werkzeuge,
  Fallen und stationäre Waffen (siehe unten).
- Ressourcen: Holz (Bäume fällen), Stein, Metallschrott, Stoff, Benzin, Elektroteile, Nahrung, Medizin.
- Baupläne: Fortgeschrittene Fallen/Türme erst über gefundene Baupläne freischaltbar
  (Loot in Polizeistation, Baumarkt, Militärposten).

#### Basisbau
- Platzierbar im Raster (Vorschau grün/rot, drehbar per Tipp): Holz-/Steinwände, Türen, Barrikaden,
  Lagerfeuer, Regensammler, Beete (Anbau nur Frühling/Sommer), Kisten,
  Bett (Schlafen = Zeit überspringen + speichern, nur wenn keine Zombies nah).
- Zombies können Wände, Fallen und Türme angreifen und zerstören.

#### Fallen & stationäre Verteidigung
Fallen und Geschütze sind ein Kernsystem und sollen gegen Blutmond-Horden ein strategischer Faktor sein.
Alles wird über das Crafting-Menü hergestellt und wie Basisbau-Objekte im Raster platziert.

##### Fallen (einmalig oder mit Haltbarkeit)
- Stachelgrube: verlangsamt + Schaden, Holz + Stein
- Bärenfalle: hält einen Zombie fest (nicht Brutes), Metallschrott, muss nach Auslösung neu gespannt werden
- Stacheldraht: verlangsamt, Schaden pro Sekunde, nutzt sich ab
- Stolperdraht + Dosen: Alarm-Sound, der dich weckt bzw. warnt (kein Schaden)
- Lärmköder (Wecker/Radio): lockt Zombies weg von der Basis, z. B. in Fallen
- Molotow-Falle / Benzinpfütze: entzündbar per Schuss oder Fackel, Flächenschaden, im Regen unwirksam
- Sprengfalle (Rohrbombe + Stolperdraht): spätes Spiel, seltene Teile, hoher Lärm

##### Stationäre Waffen (mit Munition/Treibstoff, reparierbar)
- Speerwall / Pfahlbarrikade: passiver Schaden für Angreifer, blockiert Weg
- Armbrust-Turm: automatisch, nutzt Bolzen, lautlos
- Selbstschuss-Anlage (Schrotflinte an Stolperdraht): stark, aber laut
- Flammenwerfer-Turm: braucht Benzin, im Winter Bonus gegen Frost-Zombies
- MG-Nest (Spieler bemannt es selbst): hoher Schaden, verbraucht viel Munition, Spieler ist dabei gebunden
- Stromzaun: braucht Generator + Treibstoff, Generator erzeugt dauerhaft Lärm

##### Regeln
- Jedes Objekt hat HP, Haltbarkeit und Upgrade-Stufen (Holz → Metall → verstärkt). Zombies greifen Türme gezielt an.
- Automatische Türme haben Reichweite, Sichtlinie (keine Sicht durch Wände) und Nachladezeit.
- Munition für Türme kommt aus einer angrenzenden Kiste oder wird manuell nachgefüllt.
- Jahreszeiten wirken sich aus: Regen löscht Feuerfallen, Schnee verdeckt Fallen (auch für dich schlechter sichtbar),
  Kälte lässt Generatoren schwerer anspringen.
- Der Spieler kann in eigene Fallen laufen (außer bei aktivierter Option "Fallen markieren").
- Performance: Türme suchen Ziele nur alle 200 ms über den Spatial Hash.

#### UI / UX
- Hauptmenü: Neues Spiel (Seed optional), Fortsetzen, Highscores, Einstellungen
  (Lautstärke, Joystick-Größe/Position, Linkshänder-Modus, Grafikqualität, Tageslänge, Fallen markieren).
- HUD minimalistisch: Statusbalken, Tag X + Jahreszeit + Uhrzeit, Temperatur, Minimap (antippen = groß,
  zeigt Basis, Fallen und Türme).
- Game-Over-Screen: überlebte Tage, getötete Zombies (davon durch Fallen/Türme), Todesursache, Highscore.
- Kurzes, überspringbares Tutorial am ersten Tag.

#### Vorgehen (wichtig)
Arbeite in Meilensteinen und liefere nach jedem Meilenstein einen spielbaren Stand. Committe jeden Meilenstein mit git.
1. Grundgerüst: PWA, Canvas, Game Loop, Touch-Joysticks, Spieler bewegt sich, Kamera.
2. Prozedurale Chunk-Welt + Kollisionen.
3. Zombies (Walker) + Nahkampf + Gesundheit + Tod/Game Over.
4. Tag/Nacht + Licht + Hunger/Durst + Loot + Inventar.
5. Jahreszeiten + Wetter + Temperatur.
6. Crafting + Basisbau + einfache Fallen (Stachelgrube, Stacheldraht, Bärenfalle, Stolperdraht, Speerwall).
7. Weitere Zombie-Typen, Fernkampf, Lärm-System, Blutmond, Baupläne,
   automatische Türme, MG-Nest, Molotow-/Sprengfallen, Generator + Stromzaun.
8. Speichern/Laden, Highscores, Menüs, Einstellungen, Sound.
9. Performance-Pass auf iPad + Balancing (insbesondere Fallen/Türme vs. Blutmond-Horden).

Saubere Modulstruktur (z. B. /src/core, /src/world, /src/entities, /src/systems, /src/building, /src/ui, /src/audio).
Zentrale config.js für alle Balancing-Werte. README mit Anleitung für den Test am iPad
(lokaler Server im WLAN + Deployment auf GitHub Pages + "Zum Home-Bildschirm").
Starte mit Meilenstein 1, erkläre kurz deinen Architektur-Plan und lege los.
