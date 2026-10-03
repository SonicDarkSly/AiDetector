# MefIAnce

Application locale pour savoir si un texte ou un fichier vient d'une IA (ChatGPT, Claude, Gemini, Copilot,
DeepSeek, Grok, Perplexity, Vibe de Mistral, Meta AI, Qwen...), et laquelle quand c'est possible.
Tout est analysé sur la machine : aucun texte ni fichier n'est envoyé sur Internet.

## Lancement

Double-clic sur le lanceur de votre système :

- macOS : `Lancer-MefIAnce-macOS.command`
- Windows : `Lancer-MefIAnce-Windows.bat`
- Linux : `Lancer-MefIAnce-Linux.sh`

Au premier lancement, Node.js, les dépendances et le modèle d'analyse (environ 1 Go) sont installés
automatiquement. L'application s'ouvre sur http://localhost:5174 et reste accessible depuis les autres
appareils du réseau local (adresse affichée dans la fenêtre du lanceur).

En ligne de commande :

```bash
npm install
npm run dev
```

Formats acceptés : texte collé, PDF, Word (.docx), TXT, Markdown, code source (25 Mo au maximum).

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

Un petit modèle local (Qwen2.5 1,5B Instruct, Q4_K_M, GGUF via node-llama-cpp) mesure la probabilité de
chaque mot. Il ne génère rien. Le score combine la log-probabilité moyenne et la longueur, calibré sur 394
textes en français (46 générés par IA, 348 écrits par des humains avant 2022). Le seuil est réglé pour
signaler à tort au plus 5 % des textes humains : sur un texte court, mieux vaut un résultat neutre qu'une
fausse accusation. Les textes IA du corpus viennent tous de Claude ; les taux ne sont pas mesurés pour les
autres assistants.

| Longueur (tokens) | Textes IA détectés | Textes humains signalés à tort |
| ----------------- | ------------------ | ------------------------------ |
| 30                | 63 %               | 5 %                            |
| 50                | 78 %               | 4 %                            |
| 80                | 97 %               | 5 %                            |
| 120               | 91 %               | 5 %                            |
| 200               | 86 %               | 2 %                            |

Pour un PDF ou un Word, seule la prose est mesurée (sommaire, tableaux et code sont écartés). Un résultat
« peu prévisible » reste un indice limité : un texte d'IA retouché, très technique ou écrit dans un style
familier peut aussi sortir ainsi. Le modèle est chargé à la demande et libéré après 5 minutes sans analyse.

### Code source

Le modèle de langage ne mesure pas le code. Les indices viennent des commentaires : typographie de
rédaction impossible à taper au clavier (tirets longs, flèches, guillemets « », points de suspension),
en-têtes de fichier « RÔLE — description », phrases de chatbot, placeholders (`YOUR_API_KEY`,
`# Example usage`), émojis dans les logs. Mesuré sur 70 fichiers écrits par Claude et 225 fichiers de
bibliothèques open source : 54 fichiers IA sur 70 au-dessus de 50 %, aucun fichier humain.

### Style et rythme

Vocabulaire sur-représenté, tournures récurrentes, tirets longs, régularité des phrases. Tendances
seulement : le style seul ne dépasse pas environ 60 %.

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
- Les filigranes invisibles (SynthID de Google) ne sont lisibles que par leur éditeur.

## Architecture

Monorepo npm (`server`, `client`).

- `server` : NestJS 11, découpage DDD / CQRS (`@nestjs/cqrs`)
  - `detection/domain` : agrégat `Analysis`, détecteurs de signaux, politiques de verdict et d'attribution
  - `detection/application` : commandes, requêtes, gestionnaires d'événements
  - `detection/infrastructure` : lecture PDF (pdfjs-dist) / DOCX / texte, mesure par modèle, historique
  - `detection/presentation` : API HTTP
- `client` : React 18, Vite 6, Ant Design 5

API : `POST /api/analyze/text`, `POST /api/analyze/file`, `GET /api/model`, `GET /api/model/activity`, `GET /api/reports`,
`GET /api/reports/:id`, `DELETE /api/reports/:id`, `DELETE /api/reports`, `GET /api/health`.

Les analyses sont conservées dans `server/data/reports` (200 au maximum).

Variable d'environnement : `MEFIANCE_MODEL=off` désactive le modèle, `MEFIANCE_MODEL=<uri ou chemin>`
en impose un autre.
