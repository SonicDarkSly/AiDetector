---
name: corpus-git
description: Enregistre et synchronise le corpus de calibration de MefIAnce avec git (sous-module privé MefIAnce-corpus dans server/data/corpus, puis pointeur du sous-module dans le dépôt principal public). À utiliser pour committer, pousser ou récupérer des changements du corpus, ou en cas de conflit ou de sous-module désynchronisé.
---

# Le corpus et git

Deux dépôts :

| Dépôt | Contenu | Visibilité |
| --- | --- | --- |
| `MefIAnce` (principal) | code, scripts, `calibration-samples.json`, **pointeur** vers un commit du corpus | public |
| `MefIAnce-corpus` (sous-module `server/data/corpus`) | textes, consignes, manifeste, mesures, réponses brutes des assistants | **privé** |

Le dépôt principal ne contient jamais les textes eux-mêmes. Il retient seulement « quel commit du corpus va
avec ce code ».

## Règles (non négociables)

- **Jamais de push sans confirmation explicite de Michael, à chaque fois.** Un commit accordé n'est pas un
  push accordé.
- Jamais `--no-verify`. Si un hook échoue, chercher la cause.
- Ne jamais rendre le dépôt du corpus public, ni copier des textes du corpus dans le dépôt principal.
- Messages de commit en français, sans accents dans le titre (convention du dépôt), terminés par la ligne
  `Co-Authored-By` fournie par l'environnement.

## Enregistrer un changement du corpus

1. Dans le corpus :
   ```bash
   git -C server/data/corpus status --short
   git -C server/data/corpus add -A
   git -C server/data/corpus commit -m "Textes Mistral (60) et mesures"
   ```
2. Dans le dépôt principal, le sous-module apparaît modifié (nouveau commit pointé). L'enregistrer **avec**
   le code qui en dépend (nouvelle calibration, taux) :
   ```bash
   git add server/data/corpus
   git commit -m "Calibration sur Claude, ChatGPT, Gemini et Mistral"
   ```
3. Pousser, seulement après confirmation, **le corpus d'abord** (sinon le dépôt principal pointerait vers un
   commit introuvable) :
   ```bash
   git -C server/data/corpus push
   git push
   ```
   Pour éviter l'oubli : `git push --recurse-submodules=check` refuse de pousser si le corpus n'est pas poussé.

## Récupérer les changements d'un autre poste

```bash
git pull
git submodule update --init server/data/corpus
```
(voir aussi le skill `corpus-recuperer`).

## Problèmes courants

- **« detached HEAD » dans le corpus** : normal après `submodule update`. Avant de committer dans le corpus,
  revenir sur la branche : `git -C server/data/corpus switch main`.
- **Conflit sur `manifest.json` ou `mesures.json`** : ces fichiers sont générés. Prendre une version, puis
  relancer `import.mjs` pour les fichiers de réponses concernés et `measure.mjs` (qui complète les mesures
  manquantes) plutôt que fusionner à la main.
- **Le dépôt principal montre `server/data/corpus` modifié sans raison** : comparer
  `git submodule status` et `git -C server/data/corpus log -1` ; soit committer le nouveau pointeur, soit
  revenir au commit attendu avec `git submodule update server/data/corpus`.
