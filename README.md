# ES Doubs Studio Communication

Outil web statique pour créer des visuels sociaux ES Doubs sans compétence technique. Il fonctionne sans backend : les sauvegardes restent dans le navigateur via `localStorage`.

## Lancer l'outil

Ouvrir `index.html` dans Chrome, Edge ou Firefox.

Si un navigateur bloque les exports depuis un fichier local, lancer un petit serveur dans ce dossier :

```powershell
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Utilisation rapide

1. Choisir une catégorie puis un modèle dans la colonne de gauche.
2. Modifier les champs dans `Contenu`.
3. Déposer une photo, utiliser la banque média, ou ajouter un logo partenaire.
4. Choisir un format : Instagram carré, Instagram portrait, Facebook, Twitter/X ou Story.
5. Exporter en PNG, JPG ou PDF.

Le modèle `Affiche de match` est l'exemple complet livré par défaut.

## Modèles inclus

Les catégories couvrent les besoins demandés : matchs et résultats, événements, vie du club, partenariats, communication, célébrations et administration.

Chaque modèle repose sur une mise en page verrouillée : les bénévoles changent les textes et médias, mais pas les marges, la hiérarchie ou les emplacements principaux.

## Modifier ou ajouter un modèle

Les modèles sont déclarés dans `assets/js/templates.js`.

Pour ajouter un modèle :

1. Ajouter une entrée dans `templates`.
2. Renseigner `id`, `category`, `name`, `description`, `layout`, `defaultFormat`, `defaultImage`, `defaultIcon`.
3. Ajouter les champs dans `fields` avec la forme `{ key, label, value, type }`.
4. Réutiliser un `layout` existant : `match`, `result`, `list`, `table`, `roster`, `event`, `portrait`, `transfer`, `sponsor`, `info`, `gallery`, `quote`, `celebration`, `recruitment`.

Pour créer une nouvelle mise en page, ajouter une fonction de rendu dans `assets/js/app.js`, puis l'ajouter dans l'objet `renderers`.

## Identité visuelle

Couleurs par défaut :

- Rouge : `#d20f1f`
- Bleu : `#1f5ca8`
- Or : `#d7b65d`
- Noir : `#111827`
- Blanc : `#ffffff`

Polices :

- Titres : Montserrat, avec fallback Arial Black / Arial.
- Texte : Open Sans, avec fallback Segoe UI / Arial.

Le mode admin permet de modifier les couleurs et polices globales. Ces réglages restent enregistrés dans le navigateur.

## Conseils photos

- Utiliser des images nettes, idéalement au moins `1600 px` sur le plus grand côté.
- Préférer des photos verticales pour les formats Instagram portrait et Story.
- Garder de l'espace autour du sujet pour éviter les recadrages.
- Éviter les photos trop sombres si le texte principal doit apparaître dessus.
- Pour les sponsors, importer un logo sur fond transparent si possible.

## Exports

Résolutions intégrées :

- Instagram carré : `1080x1080`
- Instagram portrait : `1080x1350`
- Facebook : `1200x630`
- Twitter/X : `1200x675`
- Story : `1080x1920`

Les boutons `PNG`, `JPG` et `PDF` exportent exactement la résolution du format sélectionné.
