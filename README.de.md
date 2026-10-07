# MefIAnce

[Français](README.md) · [English](README.en.md) · **Deutsch**

Eine lokale Anwendung, die erkennt, ob ein Text oder eine Datei von einer KI stammt (ChatGPT, Claude, Gemini,
Copilot, DeepSeek, Grok, Perplexity, Vibe von Mistral, Meta AI, Qwen...), und wenn möglich von welcher. Alles
wird auf Ihrem Rechner analysiert: Kein Text und keine Datei wird ins Internet gesendet.

Die Oberfläche der Anwendung ist französisch; Schaltflächen und Bereiche werden unten auf Französisch
genannt, mit ihrer deutschen Bedeutung.

## Starten

Doppelklick auf das Startprogramm Ihres Systems:

- macOS: `Lancer-MefIAnce-macOS.command`
- Windows: `Lancer-MefIAnce-Windows.bat`
- Linux: `Lancer-MefIAnce-Linux.sh`

Beim ersten Start werden Node.js, die Abhängigkeiten und die beiden Analysemodelle (etwa 4 GB) automatisch
installiert. Die Anwendung öffnet sich unter http://localhost:5174 und ist auch von anderen Geräten im lokalen
Netzwerk erreichbar (die Adresse steht im Fenster des Startprogramms).

Über die Kommandozeile:

```bash
npm install
npm run dev
```

Unterstützte Formate: eingefügter Text, PDF, Word (.docx), TXT, Markdown, Quellcode (höchstens 25 MB), ein
ganzes Projekt als .zip mit seinem versteckten `.git`-Ordner (höchstens 100 MB).

## Methode

Drei Familien von Hinweisen, getrennt bewertet, damit die Anwendung ehrlich bleibt in dem, was sie behaupten
kann.

### Technische Belege

Zuverlässig, wenn vorhanden, aber leicht zu entfernen.

- **Metadaten**: Ersteller- und Erzeugerwerkzeug von PDFs (ReportLab, WeasyPrint, Chrome ohne Oberfläche...),
  XMP, Content Credentials (C2PA), IPTC-Feld `trainedAlgorithmicMedia`, Autor von .docx-Dateien
  (`python-docx`, `Un-named` aus der docx-Bibliothek), Bearbeitungszeit, Word-Sitzungen (rsid), UTC-Uhrzeit.
- **Spuren von Kopieren und Einfügen**, je nach Assistent:

  | Assistent | Erkannte Markierungen                                                                                        |
  | --------- | ------------------------------------------------------------------------------------------------------------ |
  | ChatGPT   | `contentReference[oaicite]`, `【n†source】`, `turn0search`, `utm_source=chatgpt.com`, private Zeichen U+E200 |
  | Gemini    | `[cite_start]`, `[cite: n]`                                                                                  |
  | Claude    | interne Tags (`antArtifact`, `cite index`)                                                                   |
  | DeepSeek  | `<think>`, `[citation:n]`                                                                                    |
  | Copilot   | `[^n^]`                                                                                                      |
  | Grok      | `<grok:render>`                                                                                              |
  | Alle      | Freigabelinks, typische Einleitungs- oder Schlusssätze von Chatbots, `[Ihr Name]`, rohes Markdown            |

- **Versteckte Zeichen**: Leerzeichen ohne Breite, versteckte Nachrichten in Unicode-„Tag“-Zeichen
  (entschlüsselt), kyrillische Buchstaben, die als lateinische getarnt sind.

Markierungen von drei oder mehr Assistenten im selben Text deuten auf ein Dokument hin, das über sie spricht
(Artikel, Anleitung): Sie zählen dann nur als schwache Hinweise.

### Vorhersagbarkeit des Textes

Zwei kleine lokale Modelle, Qwen2.5 3B Instruct und seine Basisversion (Q4_K_M, je etwa 2 GB, GGUF über
node-llama-cpp), lesen den Text, höchstens 250 Tokens, ohne etwas zu erzeugen. Sie werden bei Bedarf geladen
und nach 2 Minuten ohne Analyse wieder freigegeben.

- **Ab 50 Tokens: Binoculars** (Hans et al., 2024). Der Wert vergleicht, wie überraschend der Text ist, mit
  der „normalen“ Überraschung für das, was ein Modell an seiner Stelle geschrieben hätte: Das Basismodell
  dient als Beobachter, das Instruct-Modell als Ausführender. Ein menschlicher Text, der lediglich förmlich
  ist, wird nicht mehr mit einem generierten verwechselt.
- **Unter 50 Tokens: drei Messwerte** des Instruct-Modells, kombiniert: die mittlere Log-Wahrscheinlichkeit
  der Wörter, die mittlere Entropie (wie stark das Modell zögert) und das Fast-DetectGPT-Kriterium. Bei so
  kurzen Texten erkennt Binoculars schlechter (10 % gegenüber 21 % bei 30 Tokens).

Ohne das Basismodell (nicht heruntergeladen) greift die Anwendung bei allen Längen auf die drei Messwerte
zurück, mit niedrigeren Raten (21 bis 26 %).

Kalibriert an 640 französischen Texten: 400 von Menschen vor 2022 geschrieben (150 Wikipedia-Auszüge im Stand
von Ende 2021, 100 Wikinews-Artikel, 150 Allociné-Filmkritiken) und 240 zu denselben Themen und Gattungen von
vier Assistenten erzeugt, je 60: Claude (Sonnet und Opus), ChatGPT, Gemini und Mistral. Für jede Länge ist die
Schwelle so eingestellt, dass nur 5 % der menschlichen Texte fälschlich markiert werden; die Raten sind per
Kreuzvalidierung gemessen, an Texten, die beim Training nie gesehen wurden.

| Länge (Tokens) | Entscheidung   | Erkannte KI-Texte | Fälschlich markierte menschliche Texte |
| -------------- | -------------- | ----------------- | -------------------------------------- |
| 30             | drei Messwerte | 21 %              | 5 %                                    |
| 50             | Binoculars     | 24 %              | 5 %                                    |
| 80             | Binoculars     | 29 %              | 5 %                                    |
| 120            | Binoculars     | 29 %              | 5 %                                    |
| 200            | Binoculars     | 37 %              | 5 %                                    |

Je nach Assistent erkennt Binoculars ab 80 Tokens etwa 12 % der Texte von Gemini, 28 % von ChatGPT, 34 % von
Claude und 53 % von Mistral. Fehlalarme konzentrieren sich nicht mehr auf Wikipedia: etwa 7 % der Auszüge,
4 % der Presseartikel und 3 % der Kritiken (gegenüber 10 %, 2 % und 0 % mit den drei Messwerten allein).

Bei dieser Vorsicht kann die Messung eine KI **bestätigen**, einen Text aber nie entlasten: Unterhalb der
Schwelle spricht sie kaum für „menschlich“ und reicht für eine Entscheidung nicht aus.

Bei einem PDF oder einer Word-Datei wird nur Fließtext gemessen (Inhaltsverzeichnis, Tabellen und Code
werden ausgelassen). Die Modelle sind nur an Fließtext kalibriert: Ein Gedicht oder Verse (kurze Zeilen,
Reime) werden erkannt, und ihre Messung spricht nie für „menschlich“.

### Kalibrierungskorpus

Die Texte des Korpus liegen in einem privaten Repository,
[SonicDarkSly/MefIAnce-corpus](https://github.com/SonicDarkSly/MefIAnce-corpus), das als Submodul unter
`server/data/corpus/` eingebunden ist (die Lizenzen der menschlichen Texte erlauben keine Veröffentlichung
hier). Zum Abrufen, mit einem GitHub-Konto mit Zugriff auf dieses Repository:
`git submodule update --init server/data/corpus`. Die Claude-Code-Skills in `.claude/skills/` beschreiben die
Arbeitsschritte (abrufen, einen Assistenten hinzufügen, neu kalibrieren, synchronisieren).

Die Skripte in `scripts/corpus/` bauen das Korpus neu auf oder ergänzen es:

```bash
node scripts/corpus/fetch-human.mjs        # menschliche Texte von vor 2022
node scripts/corpus/consignes.mjs          # gemeinsame Aufgaben für alle Assistenten (+ consignes.md)
node scripts/corpus/import.mjs chatgpt lot1.txt   # Antwort eines Assistenten auf einen Aufgabenblock
npm run build -w server
node scripts/corpus/measure.mjs            # drei Messwerte des Instruct-Modells, setzt dort fort, wo es aufhörte
node scripts/corpus/binoculars.mjs         # Binoculars-Wert (Basis und Instruct), setzt ebenfalls fort
node scripts/corpus/train.mjs              # vergleicht die Kalibrierungen
node scripts/corpus/export.mjs             # server/calibration-samples.json, schreibt die Standardkalibrierung neu
```

### Lernen

Unten im Ergebnis lässt sich mit « Apprentissage » (Lernen) angeben, woher ein Text wirklich stammt (KI, und
welche, oder Mensch). Gespeichert werden nur die Messwerte (die drei Messwerte, der Binoculars-Wert und die
Länge) in `server/data/answers.json`, nie der Text. Ab 20 Antworten zu Fließtext schlägt die Anwendung eine
Neukalibrierung vor: aktuelle und vorgeschlagene Raten per Kreuzvalidierung gemessen, und wie viele Ihrer
Antworten jede Variante richtig einordnet. Ohne Ihre Zustimmung wird nichts übernommen, und die
Standardkalibrierung bleibt verfügbar. Eine Antwort gilt nur für das Modell, das die Messung vorgenommen hat;
Antworten von vor der Umstellung auf drei Messwerte zählen nicht mehr. Die Messwerte des ursprünglichen
Korpus (ohne die Texte) stehen in `server/calibration-samples.json`.

### Ganzes Projekt (.zip)

Bei Code liegen die stärksten Belege um die Dateien herum, nicht in ihnen. Ein .zip-Archiv eines Projekts
(Abhängigkeiten, `dist`, `build`… werden ignoriert) wird Datei für Datei analysiert und durchsucht nach:

- **Konfigurationsdateien von Assistenten**: `CLAUDE.md`, `.claude/`, `AGENTS.md`, `GEMINI.md`,
  `.cursorrules`, `.cursor/`, `.github/copilot-instructions.md`, `.windsurfrules`, `.clinerules`, `.aider*`,
  `.kiro/`, `.junie/`…;
- **gespeicherten Gesprächsverläufen** (`.aider.chat.history.md`, `.specstory/`);
- **von einem Assistenten signierten Commits** in der Git-Historie (die letzten 1.000):
  `Co-authored-by: Claude`, „Generated with Claude Code“, Copilot-Agent, Codex, Jules, Cursor, Aider, Devin. Die
  Historie wird gelesen, ohne dass git auf dem Rechner installiert sein muss (isomorphic-git).

Diese Spuren belegen, dass im Projekt ein Assistent verwendet wurde, nicht welche Dateien er geschrieben hat.
Ihr Fehlen beweist nichts: Ein Assistent im Editor oder aus einem Chat kopierter Code hinterlässt keine.

### Quellcode

Das Sprachmodell misst keinen Code. Die Hinweise stammen aus den Kommentaren: Typografie, die sich nicht über
die Tastatur eingeben lässt (lange Gedankenstriche, Pfeile, « » Anführungszeichen, Auslassungspunkte),
Dateiköpfe der Form „ROLLE — Beschreibung“, Chatbot-Sätze, Platzhalter (`YOUR_API_KEY`, `# Example usage`),
Emojis in Logausgaben, Kommentare, die die nächste Zeile wiederholen („// Holt den Benutzer“ über
`getUser()`, ein schwacher Hinweis: 0,2 % markierte Dateien bei 1.719 Dateien aus Open-Source-Bibliotheken).
Gemessen an 70 von Claude geschriebenen Dateien und 225 Dateien aus Open-Source-Bibliotheken: 54 von 70
KI-Dateien über 50 %, keine menschliche Datei.

### Stil und Rhythmus

Überrepräsentierter Wortschatz, wiederkehrende Wendungen, lange Gedankenstriche, gleichmäßige Satzlängen. Nur
Tendenzen: Der Stil allein überschreitet nie etwa 60 %.

### Wasserzeichen der Anbieter

Um Artikel 50 der EU-KI-Verordnung zu erfüllen, markieren die Anbieter erzeugte Texte:

| Assistent         | Seit                                          | Prüfung                                             |
| ----------------- | --------------------------------------------- | --------------------------------------------------- |
| Claude            | 2. August 2026, neuere Modelle, weltweit      | Schnittstelle von Anthropic, eingeschränkter Zugang |
| ChatGPT und Codex | Oktober 2026, Europäische Union („textGrain“) | Detektor nur für zugelassene Forschende             |
| Gemini            | 2024 (SynthID Text)                           | kein öffentlicher Dienst für Text                   |

Es handelt sich nicht um ein verstecktes Zeichen, sondern um eine leichte statistische Verzerrung bei der
Wortwahl, berechnet mit einem geheimen Schlüssel: Nur der Anbieter kann sie lesen. Die Anwendung schickt den
Text nicht zur Prüfung weg. Sie zeigt einen Informationshinweis (ohne Einfluss auf den Wert), der das erklärt
und angibt, ob der Text lang genug wäre, damit ein Wasserzeichen lesbar ist: laut OpenAI etwa 80 % Erkennung
bei 200 Tokens und 95 % bei 400, bei 1 % Fehlalarmen. Umschreiben, Übersetzen oder Nachbearbeiten löscht es;
bei Code ist es schwach. Sein Fehlen beweist nicht, dass ein Mensch den Text geschrieben hat.

## Das Ergebnis lesen

- **Urteil**: Gesamtwert, technische Belege, Vorhersagbarkeit des Textes, Stil. Ohne verwertbare Spuren in
  einem kurzen Text lautet das Urteil „nicht bestimmbar“, mit einer vorläufigen Tendenz.
- **Welches Werkzeug?**: in den Metadaten erkannte Software und der Anteil jedes Assistenten. Das von der
  Datei angegebene Werkzeug (Metadaten, C2PA) hat Vorrang vor den Markierungen im Text. Ohne eindeutige Spur
  ist der Assistent „nicht bestimmbar“: Kein Werkzeug kann ehrlich sagen, welcher einen sauber kopierten Text
  geschrieben hat.
- **Gefundene Hinweise**, **Metadaten**, **Statistiken**, **Analysierter Text** (hervorgehobene und
  beschriftete Stellen, unsichtbare Zeichen, eine bereinigte Fassung zum Kopieren).
- **Anordnung**: Raster, eine Spalte oder Zusammenfassung. Mit der Schaltfläche « Organiser » (Anordnen)
  lassen sich die Blöcke per Ziehen und Ablegen platzieren: bis zu drei nebeneinander in einer Zeile,
  übereinander in einem Feld oder allein in einer Zeile voller Breite. Die Anordnung wird für jeden Modus
  gespeichert.

## Grenzen

- Keine Spur heißt nicht menschlich: Ein überarbeiteter oder umformulierter KI-Text kann unbemerkt bleiben.
- Ein Mensch mit sehr schulmäßigem Stil kann einen hohen Wert erhalten. Beschuldigen Sie niemanden allein
  aufgrund eines Werts.
- Metadaten verschwinden, wenn eine Datei neu gespeichert, gedruckt oder abfotografiert wird.
- Die unsichtbaren Wasserzeichen von Claude, ChatGPT und Gemini kann nur ihr Anbieter lesen. Die unsichtbaren
  Zeichen, die die Anwendung findet, sind etwas anderes.

## Architektur

npm-Monorepo (`server`, `client`).

- `server`: NestJS 11, DDD-/CQRS-Aufbau (`@nestjs/cqrs`)
  - `detection/domain`: Aggregat `Analysis`, Signaldetektoren, Regeln für Urteil und Zuordnung
  - `detection/application`: Befehle, Abfragen, Ereignisbehandlung
  - `detection/infrastructure`: Lesen von PDF (pdfjs-dist) / DOCX / Text, Messung durch das Modell, Verlauf
  - `detection/presentation`: HTTP-API
- `client`: React 18, Vite 6, Ant Design 5

API: `POST /api/analyze/text`, `POST /api/analyze/file`, `GET /api/model`, `GET /api/model/activity`,
`GET /api/calibration`, `POST /api/calibration/apply`, `POST /api/calibration/reset`,
`GET|PUT|DELETE /api/reports/:id/answer`, `GET /api/reports`, `GET /api/reports/:id`,
`DELETE /api/reports/:id`, `DELETE /api/reports`, `GET /api/health`.

Die Analysen werden in `server/data/reports` aufbewahrt (höchstens 200).

Umgebungsvariable: `MEFIANCE_MODEL=off` schaltet die Modelle ab, `MEFIANCE_MODEL=<URI oder Pfad>` erzwingt
ein anderes (ohne Binoculars-Beobachter: Entscheidung anhand der drei Messwerte).
