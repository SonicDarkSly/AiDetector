---
name: corpus-recalibrer
description: Mesure les nouveaux textes du corpus avec le modèle local, compare les calibrations, puis met à jour la calibration d'origine de MefIAnce (calibration.ts, taux affichés, README). À utiliser après un ajout de textes au corpus, un changement de modèle ou de mesures.
---

# Mesurer et recalibrer

Le modèle de langage n'est jamais réentraîné : seule la calibration (poids des 4 mesures, biais, seuils par
longueur) est recalculée. Le seuil est réglé pour ne signaler à tort que 5 % des textes humains.

## Étapes

1. Compiler puis mesurer (reprend là où il s'était arrêté ; environ 2 s par texte) :
   ```bash
   npm run build -w server
   node scripts/corpus/measure.mjs
   ```
   Lancer en arrière-plan si plus de quelques dizaines de textes. Sauvegarder d'abord
   `server/data/corpus/mesures.json` si on change de modèle.
2. Comparer les calibrations (validation croisée en 5 parts) :
   ```bash
   node scripts/corpus/train.mjs
   ```
   Lire surtout la colonne « IA repérés à 5 % de fausses alertes », longueur par longueur, et la comparer à la
   calibration actuelle. Donner aussi les taux **par assistant** (filtrer `mesures.json` sur `vendor`) : une
   calibration qui marche pour Claude mais pas pour ChatGPT est un surapprentissage.
3. Exporter :
   ```bash
   node scripts/corpus/export.mjs
   ```
   Il réécrit `server/calibration-samples.json` (mesures seules, jamais les textes) et affiche le bloc
   `DEFAULT_CALIBRATION` à reporter dans `server/src/detection/domain/likelihood/calibration.ts`.
4. Reporter les nouveaux taux à trois endroits, qui doivent rester identiques :
   - `DEFAULT_CALIBRATION.rates` et `texts` dans `calibration.ts` ;
   - `MEASURED_RATES` dans `client/src/constants.ts` ;
   - le tableau et la description du corpus dans `README.md` (section « Prévisibilité du texte »).
5. Tester avant de committer : `npm run build -w server` et la vérification de types complète du client
   (`npx tsc --noEmit -p client` ou `vue-tsc`/build du client selon le script disponible). Ne jamais
   annoncer « fait » sans cette preuve.
6. Committer le code dans le dépôt principal (Michael confirme) et le corpus avec le skill `corpus-git`.
