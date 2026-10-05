# Composants et ressources tiers

Ce fichier concerne les éléments tiers distribués avec Inga Interactive. Il ne constitue pas une licence du code, des textes, des dessins ou de la marque propres au projet et n'accorde aucun droit de représentation de la SNEL.

## Bibliothèques et polices

| Élément distribué | Origine et avis | Licence incluse |
| --- | --- | --- |
| `lib/three.min.js`, Three.js r128 | Copyright © 2010–2021 Three.js authors ; version 128 inscrite dans la bibliothèque | [MIT](licenses/THREE-MIT.txt) |
| `lib/OrbitControls.js` | Fichier identique à `examples/js/controls/OrbitControls.js` du tag Three.js r128 | [MIT](licenses/THREE-MIT.txt) |
| `fonts/ibm-plex-*.woff2` : IBM Plex Sans, Sans Condensed, Mono | Copyright © 2017 IBM Corp., nom réservé « Plex » | [SIL Open Font License 1.1](licenses/IBM-PLEX-OFL.txt) |
| `fonts/architects-daughter-*.woff2` | Copyright © 2010 Kimberly Geswein, kimberlygeswein.com | [SIL Open Font License 1.1](licenses/ARCHITECTS-DAUGHTER-OFL.txt) |

Les textes de licence proviennent des dépôts officiels suivants ; les avis sont conservés intégralement dans `licenses/` :

- Three.js : https://github.com/mrdoob/three.js/blob/r128/LICENSE
- IBM Plex Sans : https://github.com/google/fonts/blob/main/ofl/ibmplexsans/OFL.txt
- IBM Plex Mono : https://github.com/google/fonts/blob/main/ofl/ibmplexmono/OFL.txt
- IBM Plex Sans Condensed : https://github.com/google/fonts/blob/main/ofl/ibmplexsanscondensed/OFL.txt
- Architects Daughter : https://github.com/google/fonts/blob/main/ofl/architectsdaughter/OFL.txt

Les trois familles IBM Plex ont fourni le même texte de licence lors de la préparation du dossier. Les sommes SHA-256 de tous les fichiers effectivement livrés figurent dans `MANIFEST.json`, à la racine de l'archive de livraison.

## Relief Copernicus DEM

Le relief intégré aux pages provient du Copernicus DEM GLO-30, tuile S06 E013, reprojetée en UTM 33S, selon le registre de sources de l'application. Il s'agit d'un modèle numérique de surface ; il ne fournit pas de bathymétrie ni de relevé d'exécution des ouvrages.

Le registre AWS officiel indique que GLO-30 Public et GLO-90 sont mis à disposition gratuitement sous les conditions de leur licence, sans pour autant dispenser de ces conditions :

- Inventaire du fournisseur : https://registry.opendata.aws/copernicus-dem/
- Licence liée par cet inventaire : https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- Inventaire vérifié : https://github.com/awslabs/open-data-registry/blob/main/datasets/copernicus-dem.yaml

Attribution vérifiée dans le catalogue officiel Google Earth Engine pour ce jeu de données, conservée dans [la notice Copernicus](licenses/COPERNICUS-DEM-NOTICE.txt) :

> © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.

- Texte source consulté : https://github.com/google/earthengine-catalog/blob/master/catalog/COPERNICUS/COPERNICUS_DEM_GLO30.jsonnet
- PDF de licence lié par ce catalogue : https://docs.sentinel-hub.com/api/latest/static/files/data/dem/resources/license/License-COPDEM-30.pdf
- Annexe ESA liée par le catalogue STAC `stactools-packages/cop-dem` : https://spacedata.copernicus.eu/documents/20123/121286/CSCDA_ESA_Mission-specific+Annex_31_Oct_22.pdf

**Pièce à compléter dans le dossier commercial :** copie intégrale de la licence applicable à la tuile réellement acquise et vérification des mentions propres à sa transformation. Le dépôt ne conserve pas cette pièce ; les pages et PDF de licence du fournisseur n'étaient pas accessibles depuis l'environnement de préparation. L'attribution ci-dessus est vérifiée, mais ne remplace pas la licence intégrale.

## Narration et contenu du projet

`voix/stop1.mp3` à `voix/stop8.mp3` sont identifiés dans le projet comme une narration « Perle (ElevenLabs) ». Ils ont été fournis avec les fichiers du projet. Lors de la préparation de cette livraison, l'éditeur a confirmé que les huit narrations ont été générées avec son compte, sous un abonnement payant autorisant l'usage commercial au moment de la génération.

Cette confirmation est une déclaration de l'éditeur, pas un audit indépendant des justificatifs. **À conserver dans ses archives commerciales :** facture ou preuve du plan actif, date de génération, référence de la voix et conditions applicables. Aucun identifiant de compte ni justificatif privé n'a besoin d'être publié avec le site.

Les documents externes cités dans le registre servent de sources documentaires. Ils ne sont pas livrés dans l'archive. Les références à la SNEL et à d'autres organismes ne constituent ni un partenariat, ni une certification, ni une autorisation de marque. La géométrie est une reconstruction pédagogique partielle. Les droits des créations propres au projet, des icônes et de toute référence visuelle adaptée sont à documenter par l'éditeur dans son contrat de livraison.
