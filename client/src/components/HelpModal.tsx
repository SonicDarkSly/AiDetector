import { Modal, Table, Typography } from 'antd';

const { Paragraph, Title, Text } = Typography;

const RATES = [
  { tokens: '30', detected: '89 %', fp: '19 %' },
  { tokens: '50', detected: '96 %', fp: '14 %' },
  { tokens: '80', detected: '100 %', fp: '10 %' },
  { tokens: '120', detected: '96 %', fp: '7 %' },
  { tokens: '200', detected: '86 %', fp: '2 %' },
];

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
            <Text strong>Caractères cachés</Text> : espaces de largeur nulle, caractères privés des chatbots,
            message caché en caractères « tags » Unicode (décodé et affiché), lettres cyrilliques déguisées en
            lettres latines (signe d'un outil anti-détecteur).
          </li>
        </ul>
      </Paragraph>

      <Title level={5}>2. Modèle de langage</Title>
      <Paragraph>
        Un petit modèle (Qwen2.5 1,5B, environ 1 Go, chargé à la demande) lit le texte et mesure, mot après
        mot, à quel point chaque choix était probable. Un texte généré suit presque toujours les choix les
        plus attendus ; un humain s'en écarte davantage. Le modèle ne génère rien, il mesure. Le score combine
        la probabilité moyenne des mots et la longueur du texte, calibré sur{' '}
        <Text strong>394 textes en français</Text> (46 générés par IA, 348 écrits par des humains avant 2022).
        Son nom et ses caractéristiques sont indiqués sous la zone de saisie ; le verdict rappelle sa
        fiabilité pour la longueur du texte analysé.
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

      <Title level={5}>3. Indices de style</Title>
      <Paragraph>
        Tendances, jamais des preuves : vocabulaire sur-employé par les modèles (« il est important de noter
        », « joue un rôle crucial »…), tournures (« ce n'est pas seulement X, c'est Y »), tirets longs, listes
        « Titre : explication », phrases de longueur trop régulière. À l'inverse, abréviations, fautes de
        frappe et ponctuation expressive tirent vers « humain ». Le style seul ne peut pas dépasser environ 60
        %.
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
            Le bouton en haut à droite du rapport change la disposition : deux colonnes, une colonne, ou
            résumé. « Organiser » permet de déplacer les blocs par glisser-déposer : colonne gauche, colonne
            droite, ou pleine largeur en haut ou en bas (simplement l'ordre en mode une colonne). La
            disposition est mémorisée pour chaque mode. Un bandeau « Analyse incomplète » signale un fichier
            dont le texte n'a pas pu être lu.
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
            Les filigranes invisibles (SynthID de Google, par exemple) ne sont lisibles que par leur éditeur :
            l'application ne peut pas les vérifier.
          </li>
        </ul>
      </Paragraph>
    </Modal>
  );
}
