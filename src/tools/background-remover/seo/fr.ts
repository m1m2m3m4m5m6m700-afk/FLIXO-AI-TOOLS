import type { LocalizedToolSeo } from '@/lib/seo/tool-manifest';

export const fr: LocalizedToolSeo = Object.freeze({
  title: 'Supprimer l’arrière-plan d’une image en ligne | FLIXO',
  description: 'Supprimez les arrière-plans uniformes et connectés directement dans votre navigateur sans téléverser l’image.',
  intro: 'FLIXO Background Remover aide à isoler un sujet d’un arrière-plan simple directement dans le navigateur. L’outil convient aux images dont l’arrière-plan possède une couleur ou une texture relativement uniforme. Choisissez une image, lancez le traitement local, vérifiez l’aperçu puis téléchargez le résultat. Dans le flux local, l’image source reste dans votre navigateur au lieu d’être envoyée à un serveur de traitement FLIXO.',
  keywords: ['supprimer arrière-plan image', 'enlever fond image', 'fond transparent', 'suppression arrière-plan navigateur'],
  howTo: ['Choisissez une image avec un arrière-plan connecté ou uniforme.', 'Lancez la suppression et vérifiez l’aperçu.', 'Téléchargez l’image traitée lorsque le résultat est correct.'],
  features: ['Traitement local dans le navigateur', 'Conçu pour les arrière-plans uniformes et connectés', 'Aperçu avant téléchargement', 'Aucun téléversement requis pour le flux local'],
  altText: ['Espace de travail de suppression d’arrière-plan', 'Image originale avant suppression', 'Image traitée avec arrière-plan supprimé'],
});
