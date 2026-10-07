import { Modal, Table, Typography } from 'antd';
import { MEASURED_RATES } from '../constants';

const { Paragraph, Title, Text } = Typography;

const RATES = MEASURED_RATES.map((r) => ({
  tokens: String(r.tokens),
  detected: `${r.detected} %`,
  fp: `${r.falsePositives} %`,
}));

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Comment ça marche ?" width={760}>
      <Paragraph>
        MefIAnce combine trois familles d'indices : des <Text strong>traces techniques</Text> laissées par les
        assistants et par les outils qui fabriquent les fichiers, une{' '}
        <Text strong>mesure de prévisibilité</Text> faite par un petit modèle de langage local, et des{' '}
        <Text strong>tendances de style</Text>. Tout est calculé sur cette machine : aucun texte ni fichier
        n'est envoyé sur Internet.
      </Paragraph>

      <Title level={5}>1. Preuves techniques</Title>
      <Paragraph>
        Fiables quand elles existent, mais faciles à effacer.
        <ul>
          <li>
            <Text strong>Métadonnées des fichiers</Text>. PDF : logiciel créateur et producteur (ReportLab,
            WeasyPrint, Chrome en impression…), XMP, Content Credentials (C2PA), champ IPTC « généré par IA ».
            Word : créateur « python-docx » ou « Un-named » (bibliothèque docx en JavaScript), fiche
            application absente, temps d'édition nul, aucune session Word (rsid).
          </li>
          <li>
            <Text strong>Déchets de copier-coller</Text>, propres à chaque assistant : ChatGPT
            (contentReference[oaicite], 【1†source】, turn0search, liens utm_source=chatgpt.com), Gemini
            ([cite_start], [cite: n]), DeepSeek (balises &lt;think&gt;, [citation:n]), Copilot ([^n^]), Grok
            (balises grok:render), liens de partage des assistants, et phrases oubliées (« Bien sûr ! Voici…
            », « Souhaitez-vous que je… », [Votre nom]).
          </li>
          <li>
            <Text strong>Projet entier (.zip)</Text> : fichiers de configuration d'assistants (CLAUDE.md,
            AGENTS.md, .cursorrules, instructions Copilot…), historiques de conversation enregistrés, et
            commits signés par un assistant dans l'historique git (« Co-authored-by: Claude », agent Copilot,
            Cursor, Aider…). Incluez le dossier caché .git dans l'archive. Ces traces prouvent qu'un assistant
            a servi, pas quels fichiers il a écrits.
          </li>
          <li>
            <Text strong>Code source</Text> : typographie impossible à taper au clavier dans les commentaires,
            en-têtes « RÔLE — description », placeholders (YOUR_API_KEY), et commentaires qui répètent la
            ligne suivante (« // Récupère l'utilisateur » au-dessus de getUser()). Un fichier de code seul,
            sans commentaires, reste le plus souvent indéterminable.
          </li>
          <li>
            <Text strong>Caractères cachés</Text> : espaces de largeur nulle, caractères privés des chatbots,
            message caché en caractères « tags » Unicode (décodé et affiché), lettres cyrilliques déguisées en
            lettres latines (signe d'un outil anti-détecteur).
          </li>
        </ul>
      </Paragraph>

      <Title level={5}>2. Modèle de langage</Title>
      <Paragraph>
        Un petit modèle (Qwen2.5 3B, environ 2 Go, chargé à la demande) lit le texte et mesure, mot après mot,
        à quel point chaque choix était probable. Le modèle ne génère rien, il mesure. Trois mesures sont
        combinées : la probabilité moyenne des mots, l'hésitation du modèle (entropie) et le critère
        Fast-DetectGPT, qui compare le texte à ce que le modèle aurait lui-même écrit. Calibration sur{' '}
        <Text strong>640 textes en français</Text> : 400 écrits par des humains avant 2022 (Wikipédia,
        Wikinews, critiques Allociné) et 240 générés sur les mêmes sujets par Claude, ChatGPT, Gemini et
        Mistral. Pour chaque longueur, le seuil est réglé pour ne signaler à tort que{' '}
        <Text strong>5 % des textes humains</Text>. À ce niveau de prudence, la mesure ne repère qu'une partie
        des textes d'IA (tableau ci-dessous) : elle peut confirmer une IA, jamais innocenter un texte. Les
        textes humains très formels (encyclopédie, presse) sont les plus difficiles, car un modèle les trouve
        aussi prévisibles qu'un texte généré. Selon l'assistant, la mesure repère de 16 % (Gemini) à 32 %
        (Mistral) de ses textes.
      </Paragraph>
      <Table
        size="small"
        pagination={false}
        rowKey="tokens"
        dataSource={RATES}
        style={{ marginBottom: 16 }}
        columns={[
          { title: 'Longueur du texte (tokens)', dataIndex: 'tokens' },
          { title: 'Textes IA détectés', dataIndex: 'detected' },
          { title: 'Textes humains signalés à tort', dataIndex: 'fp' },
        ]}
      />

      <Paragraph>
        Le modèle n'est calibré que sur de la prose. Un poème ou un texte en vers est reconnu (lignes courtes,
        rimes) : sa mesure ne pousse jamais vers « humain », car rimes et images rendent tout poème peu
        prévisible, même écrit par une IA.
      </Paragraph>
      <Paragraph>
        <Text strong>Apprentissage.</Text> En bas du verdict, « Apprentissage » permet d'indiquer d'où vient
        vraiment un texte, quand tu le sais. Seules les trois mesures du modèle et la longueur sont gardées,
        jamais le texte. À partir de 20 réponses sur de la prose, le bouton « Détails » sous la zone de saisie
        propose un recalibrage : il montre les taux actuels et proposés, et le nombre de tes réponses bien
        classées par chacun. Rien n'est appliqué sans ton accord, et on peut revenir à la calibration
        d'origine. Les taux du tableau ci-dessus sont ceux de la calibration d'origine. Une réponse ne vaut
        que pour le modèle qui a fait la mesure.
      </Paragraph>

      <Title level={5}>3. Indices de style</Title>
      <Paragraph>
        Tendances, jamais des preuves : vocabulaire sur-employé par les modèles (« il est important de noter
        », « joue un rôle crucial »…), tournures (« ce n'est pas seulement X, c'est Y »), tirets longs, listes
        « Titre : explication », phrases de longueur trop régulière. À l'inverse, abréviations, fautes de
        frappe et ponctuation expressive tirent vers « humain ». Le style seul ne peut pas dépasser environ 60
        %.
      </Paragraph>

      <Title level={5}>4. Filigranes des éditeurs</Title>
      <Paragraph>
        Pour se conformer au règlement européen sur l'IA, les éditeurs marquent désormais les textes générés
        par un filigrane invisible : Claude depuis le 2 août 2026 (dans le monde entier), ChatGPT et Codex à
        partir d'octobre 2026 (dans l'Union européenne), Gemini avec SynthID depuis 2024. Ce filigrane n'est
        pas un caractère caché : c'est un léger biais statistique dans le choix des mots, calculé avec une clé
        secrète. Seul l'éditeur peut le lire, et ses services de vérification sont réservés (régulateurs,
        médias, chercheurs, enseignement…). L'application ne peut donc pas le vérifier sans envoyer le texte :
        le rapport indique seulement si le texte serait assez long pour qu'un filigrane soit lisible (environ
        200 tokens au moins). Une réécriture ou une traduction l'effacent, et son absence ne prouve rien.
      </Paragraph>

      <Title level={5}>Lire le rapport</Title>
      <Paragraph>
        <ul>
          <li>
            <Text strong>Verdict</Text> : score global et trois barres (preuves techniques, prévisibilité du
            texte, style). Quand rien d'exploitable n'est trouvé, la jauge affiche « ? » : le texte est
            indéterminable, ce qui ne veut pas dire humain.
          </li>
          <li>
            <Text strong>Quel outil ?</Text> Les logiciels sont certains (lus dans les métadonnées). Pour les
            assistants IA, la probabilité IA est attribuée à ceux dont une trace propre a été trouvée,
            partagée selon la force des traces s'il y en a plusieurs. Sans trace propre, l'assistant est « non
            identifiable » : le style des IA est trop proche pour les distinguer.
          </li>
          <li>
            <Text strong>Indices détectés</Text> : les preuves techniques d'un côté, les indices statistiques
            et de style de l'autre, avec les extraits qui les ont déclenchés.
          </li>
          <li>
            <Text strong>Texte analysé</Text> : passages surlignés, caractères invisibles affichés, et une
            version nettoyée à copier quand quelque chose a été retiré.
          </li>
          <li>
            Le bouton en haut à droite du rapport change la disposition : grille, une colonne, ou résumé. «
            Organiser » permet de placer les blocs par glisser-déposer : jusqu'à trois côte à côte sur une
            ligne, empilés dans une même case, ou seuls sur une nouvelle ligne pleine largeur (simplement
            l'ordre en mode une colonne). La disposition est mémorisée pour chaque mode. Un bandeau « Analyse
            incomplète » signale un fichier dont le texte n'a pas pu être lu.
          </li>
        </ul>
      </Paragraph>

      <Title level={5}>Limites</Title>
      <Paragraph>
        <ul>
          <li>
            <Text strong>Absence de trace ne veut pas dire humain.</Text> Un texte d'IA retouché à la main,
            reformulé ou demandé « dans un style familier » peut passer inaperçu. Aucun détecteur, même
            payant, n'est fiable sur ce cas.
          </li>
          <li>
            Un humain qui écrit de façon très scolaire ou administrative peut obtenir un score élevé. Ne
            jamais accuser quelqu'un sur la seule base du style ou du modèle.
          </li>
          <li>
            Les métadonnées disparaissent quand on ré-enregistre ou imprime le fichier ; un PDF imprimé depuis
            le navigateur ne dit rien de son contenu.
          </li>
          <li>
            Les filigranes invisibles de Claude, ChatGPT et Gemini ne sont lisibles que par leur éditeur :
            l'application ne peut pas les vérifier. Les caractères invisibles qu'elle repère sont autre chose.
          </li>
        </ul>
      </Paragraph>
    </Modal>
  );
}
