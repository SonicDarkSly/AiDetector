# AiDetector

Application locale pour vérifier si un texte ou un fichier a été produit par une IA (ChatGPT, Claude,
Gemini, Copilot, Perplexity, Mistral...). Aucun service externe : tout est analysé sur la machine.

## Lancement

Double-clic sur le lanceur de votre système :

- macOS : `Lancer-AiDetector-macOS.command`
- Windows : `Lancer-AiDetector-Windows.bat`
- Linux : `Lancer-AiDetector-Linux.sh`

Au premier lancement, Node.js, les dépendances et le modèle d'analyse sont installés automatiquement. L'application s'ouvre sur
http://localhost:5174 et reste accessible depuis les autres appareils du réseau local (adresse affichée
dans la fenêtre du lanceur).

En ligne de commande :

```bash
npm install
npm run dev
```

## Ce qui est analysé

Formats acceptés : texte collé, PDF, Word (.docx), TXT, Markdown, code source.

- **Métadonnées** : outil producteur des PDF (ReportLab, WeasyPrint...), XMP, Content Credentials (C2PA),
  champ IPTC « trainedAlgorithmicMedia », créateur des .docx (`python-docx`, `docx`), temps d'édition,
  sessions Word.
- **Traces de copier-coller** : marqueurs internes de ChatGPT (`oaicite`, `turn0search`...) et de Gemini
  (`[cite_start]`), liens `utm_source=chatgpt.com`, formules d'introduction et de conclusion de chatbot,
  champs `[Votre nom]`, Markdown brut.
- **Caractères cachés** : espaces de largeur nulle, caractères Unicode privés ou « tags », homoglyphes.
- **Code** : placeholders, commentaires « Step 1 », émojis dans les logs.
- **Modèle de langage** : un petit modèle local (Qwen2.5 1,5B, GGUF, node-llama-cpp) mesure la
  prévisibilité du texte, token par token (méthode Fast-DetectGPT). Il ne génère rien. Téléchargé une seule
  fois par le lanceur dans `server/data/llm` (environ 1 Go). `AIDETECTOR_MODEL=off` désactive la mesure.
- **Style et rythme** : vocabulaire sur-représenté, tournures récurrentes, régularité des phrases.

Le résultat sépare les preuves techniques des indices de style. Sans trace technique, un texte court est
déclaré indéterminable : un texte d'IA copié proprement et retouché ne laisse pas toujours de trace.

## Architecture

Monorepo npm (`server`, `client`).

- `server` : NestJS, découpage DDD / CQRS (`@nestjs/cqrs`)
  - `detection/domain` : agrégat `Analysis`, détecteurs de signaux, politique de verdict, événements
  - `detection/application` : commandes, requêtes, gestionnaires d'événements
  - `detection/infrastructure` : lecture PDF / DOCX / texte, mesure par modèle, historique sur disque
  - `detection/presentation` : API HTTP
- `client` : React, Vite, Ant Design

API : `POST /api/analyze/text`, `POST /api/analyze/file`, `GET /api/reports`, `GET /api/reports/:id`,
`DELETE /api/reports/:id`, `DELETE /api/reports`, `GET /api/health`.

Les analyses sont conservées dans `server/data/reports` (200 au maximum).
