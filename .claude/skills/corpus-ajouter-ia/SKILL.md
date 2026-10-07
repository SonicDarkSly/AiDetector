---
name: corpus-ajouter-ia
description: Ajoute au corpus de calibration de MefIAnce les textes d'un assistant (ChatGPT, Gemini, Mistral, DeepSeek, Copilot…) à partir de ses réponses aux 60 consignes communes. À utiliser quand Michael veut ajouter ou refaire les textes d'une IA, ou demande quoi donner à quelle IA.
---

# Ajouter les textes d'un assistant au corpus

Chaque assistant reçoit **les mêmes 60 consignes** que les autres (6 lots de 10, un genre par lot :
lots 1-2 Wikipédia, 3-4 presse, 5-6 critiques de films). Ne jamais répartir les lots entre assistants :
on ne saurait plus si un écart vient de l'IA ou du genre.

## Ce que fait Michael (l'humain colle, Claude ne pilote pas les sites des assistants)

1. Ouvrir `server/data/corpus/consignes.md`, copier le contenu des blocs de code des lots 1 à 6 (tout peut
   partir en un seul message), le coller dans une **nouvelle conversation** de l'assistant. Pour ChatGPT,
   désactiver mémoire et instructions personnalisées.
2. Si la réponse s'arrête avant p60, écrire « continue » et récupérer la suite.
3. Copier toute la réponse (bouton « copier ») dans `server/data/corpus/<ia>/lots.txt`.

Noms d'assistants acceptés : voir `VENDORS` dans `scripts/corpus/corpus-lib.mjs`
(claude, chatgpt, gemini, mistral, deepseek, copilot). Pour un nouvel assistant, l'ajouter à `VENDORS`.

## Ce que fait Claude ensuite

1. Inspecter le fichier avant d'importer :
   ```bash
   f=server/data/corpus/<ia>/lots.txt
   grep -cE '=====' $f                       # 60 attendu
   grep -n '```' $f | head                   # blocs de code éventuels
   ```
   Pièges déjà rencontrés : repères en gras (`**===== p01**`) et blocs de code (gérés par l'import) ;
   Gemini qui écrit d'abord du code Python avant les textes (ignoré car placé avant `===== p01`) ;
   phrase d'introduction avant le premier repère (ignorée).
2. Importer : `node scripts/corpus/import.mjs <ia> server/data/corpus/<ia>/lots.txt`.
   Attendu : « 60 texte(s) <ia> importé(s) ». Une ligne « ignoré : pNN » = texte manquant ou trop court
   (moins de 20 mots) : faire refaire la consigne par Michael, l'ajouter à la fin du fichier précédée de
   `===== pNN`, réimporter (pas de doublon, l'entrée est remplacée).
3. Vérifier qu'aucun texte importé ne contient de code ou de Markdown :
   ```bash
   grep -lE 'texts\[|print\(|```|"""' server/data/corpus/<ia>/p*.txt
   ```
4. Enchaîner avec le skill `corpus-recalibrer`, puis `corpus-git` pour enregistrer.
