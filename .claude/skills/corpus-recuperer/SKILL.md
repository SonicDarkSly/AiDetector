---
name: corpus-recuperer
description: Récupère ou met à jour le corpus de calibration de MefIAnce (dépôt privé MefIAnce-corpus, sous-module git dans server/data/corpus) et vérifie qu'il est complet. À utiliser sur une nouvelle machine, après un clone, ou quand le corpus local semble absent, incomplet ou en retard.
---

# Récupérer le corpus de calibration

Le corpus (textes humains d'avant 2022, textes d'assistants, consignes, manifeste, mesures) vit dans le
dépôt **privé** `MefIAnce-corpus`, branché comme sous-module git sur `server/data/corpus`. Le dépôt
principal est public : les textes n'y sont jamais commités directement (licences Wikipédia, Wikinews,
Allociné).

## Étapes

1. Récupérer le sous-module (premier clone ou corpus absent) :
   ```bash
   git submodule update --init server/data/corpus
   ```
   Pour suivre la dernière version du corpus plutôt que celle référencée par le dépôt principal :
   ```bash
   git -C server/data/corpus pull --ff-only
   ```
   Si l'accès est refusé : le dépôt est privé, il faut être connecté à GitHub avec un compte autorisé
   (`gh auth status`). Ne jamais contourner en copiant les textes ailleurs.

2. Vérifier le contenu :
   ```bash
   node -e 'const m=require("./server/data/corpus/manifest.json");const c={};for(const e of m)c[e.vendor??e.label]=(c[e.vendor??e.label]??0)+1;console.log(c)'
   ```
   Attendu au 7 octobre 2026 : 400 textes humains, 60 par assistant (claude, chatgpt, gemini, mistral).

3. Vérifier que les mesures sont complètes, après `npm run build -w server` :
   `node scripts/corpus/measure.mjs` puis `node scripts/corpus/binoculars.mjs`. Chacun annonce
   « 0 texte(s) à mesurer » si tout est à jour ; sinon il mesure ce qui manque. `binoculars.mjs` télécharge
   le modèle de base (environ 2 Go) s'il est absent.

## À savoir

- Les textes humains peuvent être reconstruits depuis leurs sources avec `node scripts/corpus/fetch-human.mjs`,
  mais les sources en ligne évoluent : le sous-module reste la référence.
- Les modèles de langage (`server/data/llm/*.gguf`, Instruct et base, environ 2 Go chacun) ne sont pas dans
  le corpus : le lanceur de l'application les télécharge (`scripts/warmup-model.mjs`).
- Pour enregistrer des changements du corpus, utiliser le skill `corpus-git`.
