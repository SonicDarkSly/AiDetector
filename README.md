# MefIAnce

Application locale pour savoir si un texte ou un fichier vient d'une IA (ChatGPT, Claude, Gemini, Copilot,
DeepSeek, Grok, Perplexity, Vibe de Mistral, Meta AI, Qwen...), et laquelle quand c'est possible.
Tout est analysé sur la machine : aucun texte ni fichier n'est envoyé sur Internet.

## Lancement

Double-clic sur le lanceur de votre système :

- macOS : `Lancer-MefIAnce-macOS.command`
- Windows : `Lancer-MefIAnce-Windows.bat`
- Linux : `Lancer-MefIAnce-Linux.sh`

Au premier lancement, Node.js, les dépendances et le modèle d'analyse (environ 2 Go) sont installés
automatiquement. L'application s'ouvre sur http://localhost:5174 et reste accessible depuis les autres appareils du réseau
local (adresse affichée dans la fenêtre du lanceur).

En ligne de commande :

```bash
npm install
npm run dev
```

Formats acceptés : texte collé, PDF, Word (.docx), TXT, Markdown, code source (25 Mo au maximum), projet
entier en .zip avec son dossier caché `.git` (100 Mo au maximum).

## Méthode

Trois familles d'indices, notées séparément pour rester honnête sur ce qu'on peut affirmer.

### Preuves techniques

Fiables quand elles existent, mais faciles à effacer.

- **Métadonnées** : outil créateur et producteur des PDF (ReportLab, WeasyPrint, Chrome sans interface...),
  XMP, Content Credentials (C2PA), champ IPTC `trainedAlgorithmicMedia`, auteur des .docx (`python-docx`,
  `Un-named` de la bibliothèque docx), temps d'édition, sessions Word (rsid), horloge en UTC.
- **Traces de copier-coller**, propres à chaque assistant :

  | Assistant | Marqueurs reconnus                                                                                             |
  | --------- | -------------------------------------------------------------------------------------------------------------- |
  | ChatGPT   | `contentReference[oaicite]`, `【n†source】`, `turn0search`, `utm_source=chatgpt.com`, caractères privés U+E200 |
  | Gemini    | `[cite_start]`, `[cite: n]`                                                                                    |
  | Claude    | balises internes (`antArtifact`, `cite index`)                                                                 |
  | DeepSeek  | `<think>`, `[citation:n]`                                                                                      |
  | Copilot   | `[^n^]`                                                                                                        |
  | Grok      | `<grok:render>`                                                                                                |
  | Tous      | liens de partage, phrases d'introduction ou de conclusion de chatbot, `[Votre nom]`, Markdown brut             |

- **Caractères cachés** : espaces de largeur nulle, message caché en caractères « tags » Unicode (décodé),
  lettres cyrilliques déguisées en lettres latines.

Les marqueurs de trois assistants ou plus dans un même texte indiquent un document qui en parle (article,
guide) : ils ne comptent alors que comme de faibles indices.

### Prévisibilité du texte

Un petit modèle local (Qwen2.5 3B Instruct, Q4_K_M, environ 2 Go, GGUF via node-llama-cpp) mesure la
probabilité de chaque mot, sur 250 tokens au plus. Il ne génère rien. Le score combine la
log-probabilité moyenne et la longueur, calibré sur 394 textes en français (46 générés par IA, 348 écrits
par des humains avant 2022). Le seuil est réglé pour signaler à tort au plus 5 % des textes humains : sur
un texte court, mieux vaut un résultat neutre qu'une fausse accusation. Les textes IA du corpus viennent
tous de Claude ; les taux ne sont pas mesurés pour les autres assistants. Sur le même corpus, Qwen2.5 3B
fait un peu mieux que le 1,5B utilisé auparavant (par exemple 96 % contre 91 % de textes IA repérés à
120 tokens).

| Longueur (tokens) | Textes IA détectés | Textes humains signalés à tort |
| ----------------- | ------------------ | ------------------------------ |
| 30                | 63 %               | 5 %                            |
| 50                | 80 %               | 4 %                            |
| 80                | 97 %               | 4 %                            |
| 120               | 96 %               | 5 %                            |
| 200               | 86 %               | 1 %                            |

Pour un PDF ou un Word, seule la prose est mesurée (sommaire, tableaux et code sont écartés). Un résultat
« peu prévisible » reste un indice limité : un texte d'IA retouché, très technique ou écrit dans un style
familier peut aussi sortir ainsi. Le modèle est chargé à la demande et libéré après 2 minutes sans analyse.

Le modèle n'est calibré que sur de la prose. Un poème ou un texte en vers (lignes courtes, rimes) est
reconnu : sa mesure ne pousse jamais vers « humain ».

### Apprentissage

En bas du verdict, « Apprentissage » permet d'indiquer d'où vient vraiment un texte (IA, et
laquelle, ou humain). Seuls deux chiffres sont conservés dans `server/data/answers.json` : la prévisibilité
moyenne et la longueur, jamais le texte. À partir de 20 réponses sur de la prose, l'application propose un
recalibrage : taux actuels et proposés mesurés en validation croisée, et nombre de réponses bien classées
par chacun. Rien n'est appliqué sans accord, et la calibration d'origine reste disponible. Une réponse
ne vaut que pour le modèle qui a fait la mesure : après un changement de modèle, les anciennes ne
comptent plus. Les mesures du
corpus d'origine (sans les textes) sont dans `server/calibration-samples.json`.

### Projet entier (.zip)

Pour du code, les preuves les plus solides sont autour des fichiers, pas dedans. Une archive .zip d'un
projet (dépendances, `dist`, `build`… ignorés) est analysée fichier par fichier, et on y cherche :

- **fichiers de configuration d'assistants** : `CLAUDE.md`, `.claude/`, `AGENTS.md`, `GEMINI.md`,
  `.cursorrules`, `.cursor/`, `.github/copilot-instructions.md`, `.windsurfrules`, `.clinerules`, `.aider*`,
  `.kiro/`, `.junie/`… ;
- **historiques de conversation** enregistrés (`.aider.chat.history.md`, `.specstory/`) ;
- **commits signés par un assistant** dans l'historique git (1 000 derniers) : `Co-authored-by: Claude`,
  « Generated with Claude Code », agent Copilot, Codex, Jules, Cursor, Aider, Devin. L'historique est lu
  sans avoir besoin de git sur la machine (isomorphic-git).

Ces traces prouvent qu'un assistant a servi dans le projet, pas quels fichiers il a écrits. Leur absence ne
prouve rien : un assistant dans l'éditeur ou du code copié depuis un chat n'en laissent pas.

### Code source

Le modèle de langage ne mesure pas le code. Les indices viennent des commentaires : typographie de
rédaction impossible à taper au clavier (tirets longs, flèches, guillemets « », points de suspension),
en-têtes de fichier « RÔLE — description », phrases de chatbot, placeholders (`YOUR_API_KEY`,
`# Example usage`), émojis dans les logs, commentaires qui répètent la ligne suivante (« // Récupère
l'utilisateur » au-dessus de `getUser()`, indice faible : 0,2 % des fichiers signalés sur 1 719 fichiers de
bibliothèques open source). Mesuré sur 70 fichiers écrits par Claude et 225 fichiers de
bibliothèques open source : 54 fichiers IA sur 70 au-dessus de 50 %, aucun fichier humain.

### Style et rythme

Vocabulaire sur-représenté, tournures récurrentes, tirets longs, régularité des phrases. Tendances
seulement : le style seul ne dépasse pas environ 60 %.

### Filigranes des éditeurs

Pour répondre à l'article 50 du règlement européen sur l'IA, les éditeurs marquent les textes générés :

| Assistant        | Depuis                                             | Vérification                              |
| ---------------- | -------------------------------------------------- | ----------------------------------------- |
| Claude           | 2 août 2026, modèles récents, dans le monde entier | interface d'Anthropic en accès restreint  |
| ChatGPT et Codex | octobre 2026, Union européenne (« textGrain »)     | détecteur réservé à des chercheurs agréés |
| Gemini           | 2024 (SynthID Text)                                | aucun service public pour le texte        |

Ce n'est pas un caractère caché mais un léger biais statistique dans le choix des mots, calculé avec une
clé secrète : seul l'éditeur peut le lire. L'application ne l'envoie pas vérifier. Elle affiche un indice
d'information (sans effet sur le score) qui rappelle ce fonctionnement et indique si le texte serait assez
long pour qu'un filigrane soit lisible : environ 80 % de détection à 200 tokens et 95 % à 400 selon OpenAI,
pour 1 % de fausses alertes. Une réécriture, une traduction ou des retouches l'effacent ; il est faible sur
le code. Son absence ne prouve pas qu'un humain a écrit le texte.

## Lire le résultat

- **Verdict** : score global, preuves techniques, prévisibilité du texte, style. Sans trace exploitable sur un
  texte court, le verdict est « indéterminable », avec une tendance indicative.
- **Quel outil ?** : logiciels identifiés dans les métadonnées, et part de chaque assistant. L'outil déclaré
  par le fichier (métadonnées, C2PA) prime sur les marqueurs du texte. Sans trace propre, l'assistant est
  « non identifiable » : aucun outil ne peut honnêtement dire lequel a écrit un texte copié proprement.
- **Indices détectés**, **Métadonnées**, **Statistiques**, **Texte analysé** (passages surlignés et libellés,
  caractères invisibles, version nettoyée à copier).
- **Disposition** : grille, une colonne ou résumé. Le bouton « Organiser » permet de placer les blocs par
  glisser-déposer : jusqu'à trois côte à côte sur une ligne, empilés dans une case, ou seuls sur une ligne
  pleine largeur. La disposition est mémorisée pour chaque mode.

## Limites

- Absence de trace ne veut pas dire humain : un texte d'IA retouché ou reformulé peut passer inaperçu.
- Un humain au style très scolaire peut obtenir un score élevé. Ne jamais accuser quelqu'un sur un score.
- Les métadonnées disparaissent quand on ré-enregistre, imprime ou capture le fichier.
- Les filigranes invisibles de Claude, ChatGPT et Gemini ne sont lisibles que par leur éditeur. Les caractères
  invisibles repérés par l'application sont autre chose.

## Architecture

Monorepo npm (`server`, `client`).

- `server` : NestJS 11, découpage DDD / CQRS (`@nestjs/cqrs`)
  - `detection/domain` : agrégat `Analysis`, détecteurs de signaux, politiques de verdict et d'attribution
  - `detection/application` : commandes, requêtes, gestionnaires d'événements
  - `detection/infrastructure` : lecture PDF (pdfjs-dist) / DOCX / texte, mesure par modèle, historique
  - `detection/presentation` : API HTTP
- `client` : React 18, Vite 6, Ant Design 5

API : `POST /api/analyze/text`, `POST /api/analyze/file`, `GET /api/model`, `GET /api/model/activity`, `GET /api/calibration`,
`POST /api/calibration/apply`, `POST /api/calibration/reset`, `GET|PUT|DELETE /api/reports/:id/answer`,
`GET /api/reports`,
`GET /api/reports/:id`, `DELETE /api/reports/:id`, `DELETE /api/reports`, `GET /api/health`.

Les analyses sont conservées dans `server/data/reports` (200 au maximum).

Variable d'environnement : `MEFIANCE_MODEL=off` désactive le modèle, `MEFIANCE_MODEL=<uri ou chemin>`
en impose un autre.
