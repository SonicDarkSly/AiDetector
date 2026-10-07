---
name: corpus-recalibrer
description: Mesure les nouveaux textes du corpus avec le modèle local, compare les calibrations, puis met à jour la calibration d'origine de MefIAnce (calibration.ts, taux affichés, README). À utiliser après un ajout de textes au corpus, un changement de modèle ou de mesures.
---

# Mesurer et recalibrer

Les modèles de langage ne sont jamais réentraînés : seule la calibration est recalculée. Elle contient deux
formules : `measures` (trois mesures du modèle Instruct, utilisée sous 50 tokens) et `binoculars` (score
Binoculars, base + Instruct, utilisée à partir de 50 tokens). Chacune a ses poids, son biais et un seuil par
longueur réglé pour ne signaler à tort que 5 % des textes humains.

## Étapes

1. Compiler puis mesurer (les deux scripts reprennent là où ils s'étaient arrêtés) :
   ```bash
   npm run build -w server
   node scripts/corpus/measure.mjs      # trois mesures, environ 2 s par texte
   node scripts/corpus/binoculars.mjs   # Binoculars, environ 7 s par texte (deux modèles)
   ```
   Lancer en arrière-plan au-delà de quelques dizaines de textes (640 textes : environ 80 min pour
   Binoculars). Sauvegarder d'abord `mesures.json` et `binoculars.json` si on change de modèle.
2. Comparer les calibrations (validation croisée en 5 parts) :
   ```bash
   node scripts/corpus/train.mjs
   ```
   Chaque formule est évaluée avec un seuil par longueur à 5 % de fausses alertes : lire la colonne
   « IA repérés » longueur par longueur, et les lignes **par assistant** et **par genre** (une calibration qui
   marche pour Claude mais pas pour ChatGPT, ou qui accuse surtout Wikipédia, est un surapprentissage).
3. Exporter :
   ```bash
   node scripts/corpus/export.mjs
   npx prettier --write server/src/detection/domain/likelihood/calibration.ts
   ```
   Il réécrit `server/calibration-samples.json` (mesures seules, jamais les textes) et **réécrit lui-même**
   `DEFAULT_CALIBRATION` dans `calibration.ts`, puis affiche les taux de la règle complète.
4. Reporter ces taux, qui doivent rester identiques partout :
   - `MEASURED_RATES` dans `client/src/constants.ts` ;
   - le texte d'aide `client/src/components/HelpModal.tsx` (taux par assistant) ;
   - le tableau « Prévisibilité du texte » des README (`README.md`, `README.en.md`, `README.de.md`).
5. Tester avant de committer : `npm run typecheck` (serveur et client) puis `npm run build`. Ne jamais
   annoncer « fait » sans cette preuve.
6. Committer le code dans le dépôt principal (Michael confirme) et le corpus avec le skill `corpus-git`.
