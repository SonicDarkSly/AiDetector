import { Modal, Typography } from 'antd';

const { Paragraph, Title, Text } = Typography;

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Comment ça marche ?" width={720}>
      <Paragraph>
        AiDetector cherche des <Text strong>traces concrètes</Text> laissées par les assistants (ChatGPT,
        Claude, Gemini, Copilot...) et par les outils qu'ils utilisent pour fabriquer des fichiers, mesure la{' '}
        <Text strong>prévisibilité</Text> du texte avec un petit modèle de langage local, puis relève des{' '}
        <Text strong>tendances de style</Text>. Tout est calculé sur ce Mac.
      </Paragraph>

      <Title level={5}>1. Preuves techniques (fiables quand elles existent)</Title>
      <Paragraph>
        <ul>
          <li>
            <Text strong>Métadonnées</Text> : PDF : logiciel producteur (ReportLab, WeasyPrint... = script,
            typique des PDF créés par ChatGPT/Claude), XMP, Content Credentials (C2PA), champ IPTC « généré
            par IA », fuseau UTC des bacs à sable. DOCX : créateur « python-docx » (ChatGPT) ou « Un-named »
            (docx-js, Claude), fiche application absente, temps d'édition incompatible avec une frappe
            humaine, sessions Word (rsid).
          </li>
          <li>
            <Text strong>Artefacts de copier-coller</Text> : marqueurs internes de ChatGPT
            (contentReference[oaicite], 【1†source】, turn0search), de Gemini ([cite_start]), liens «
            utm_source=chatgpt.com », « Bien sûr ! Voici... », « Souhaitez-vous que je... », [Votre nom],
            Markdown brut dans un Word.
          </li>
          <li>
            <Text strong>Caractères cachés</Text> : espaces de largeur nulle, caractères privés de ChatGPT,
            messages cachés en « tags » Unicode, homoglyphes (lettres cyrilliques déguisées, signe d'un «
            humanizer » anti-détecteur).
          </li>
        </ul>
      </Paragraph>

      <Title level={5}>2. Mesure par modèle de langage</Title>
      <Paragraph>
        Un petit modèle (Qwen2.5 1,5B, environ 1 Go) lit le texte et calcule, mot après mot, à quel point
        chaque choix était probable (méthode Fast-DetectGPT). Un texte généré suit presque toujours les choix
        les plus attendus ; un humain s'en écarte davantage. Le modèle ne génère rien, il mesure. La mesure
        est solide au-delà d'environ 150 mots et peu fiable en dessous.
      </Paragraph>

      <Title level={5}>3. Indices de style (tendances, jamais des preuves)</Title>
      <Paragraph>
        Vocabulaire sur-employé par les modèles (« il est important de noter », « joue un rôle crucial », «
        delve »...), tournures (« ce n'est pas seulement X, c'est Y »), tirets cadratins, listes « Titre :
        explication », phrases de longueur trop régulière. À l'inverse, abréviations SMS, fautes de frappe et
        ponctuation expressive tirent vers « humain ». Le style seul ne peut pas dépasser ~60 %.
      </Paragraph>

      <Title level={5}>Limites (à garder en tête)</Title>
      <Paragraph>
        <ul>
          <li>
            <Text strong>Absence de trace ≠ humain.</Text> Un texte d'IA retapé, reformulé ou demandé « dans
            mon style » passe inaperçu. Aucun détecteur, même payant, n'est fiable sur ce cas.
          </li>
          <li>
            Un humain qui écrit de façon très scolaire peut obtenir un score de style élevé (faux positif). Ne
            jamais accuser quelqu'un sur la seule base du style.
          </li>
          <li>
            Les métadonnées s'effacent en ré-enregistrant le fichier ; un PDF « imprimé » depuis le navigateur
            ne dit rien de son contenu.
          </li>
          <li>
            L'attribution à une IA précise n'est possible qu'avec une trace technique (marqueur, métadonnée).
          </li>
        </ul>
      </Paragraph>
    </Modal>
  );
}
