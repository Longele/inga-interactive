# Validation technique

## Version 1.5.0 — six narrations dans les coupes

- Les six MP3 fournis se décodent entièrement avec FFmpeg, sans erreur : mono, 44,1 kHz, durées comprises entre 16,93 et 23,25 secondes. Les octets reçus sont conservés sans réencodage.
- `browser-journey-audio.cjs` : dix groupes de vérification et le contrôle d’absence d’erreurs JavaScript réussissent sur la distribution construite. Les six pistes sont effectivement lues avec progression du temps et contrôle de leur durée, en ligne puis avec le réseau coupé.
- Pause, reprise à la même position, arrêt, réécoute, fin sans navigation automatique, fermeture, retour à la maquette, changement de coupe, réinitialisation et ouverture d’une autre fenêtre vérifiés. Les chargements et événements tardifs ne relancent pas une ancienne voix.
- Erreur réseau, nouvelle tentative, promesse de lecture bloquée, mise en arrière-plan et coexistence avec la visite guidée existante vérifiées. Un chargement bloqué propose une nouvelle tentative et l’explication écrite.
- Commandes et texte repliable accessibles dans les six coupes à 320×568, 390×844, 740×800, 844×390 et 1440×900. Capture Ville à 320×568 inspectée visuellement.
- Le cache fournit des réponses partielles MP3 correctes : préfixe, suffixe et plage impossible. Le test vérifie les octets et les en-têtes ; il ne constitue pas un essai sur un iPhone physique.
- Les sept groupes de `browser-offline.cjs` passent, y compris mise à jour, migration et redémarrage hors ligne. La sélection de mise en page de `browser-journey.cjs` passe ses cinq formats et le contrôle d’absence d’erreurs. Vérifications syntaxiques, synchronisation du mode musée et du cache, construction des 72 fichiers publics et contrôle du diff réussis.

La nouvelle suite porte à quatorze les suites navigateur exécutées automatiquement avant publication. Le résultat distant doit être vérifié pour le commit livré.

## Version 1.4.1 — explications pour débutants

Les six scripts de narration ont été relus pour simplifier le vocabulaire et expliciter les liens entre eau, rotation, production et transport. Il s’agit d’une relecture éditoriale, pas d’une mesure de compréhension auprès de visiteurs. Aucun audio correspondant n’a été généré.

La sélection `INGA_JOURNEY_CASE=layout` de `browser-journey.cjs` réussit sur la distribution construite : cinq formats, six étapes par format et absence d’erreurs JavaScript, soit six contrôles réussis. Les titres et explications plus longs conservent les commandes accessibles. Les scripts modifiés passent le contrôle syntaxique ; le cache est synchronisé et les 65 fichiers publics sont construits.

Inspection visuelle à 320×568 : guides Transformateur et Ville entièrement visibles ; récapitulatif final lisible en 14 px, avec ses commandes de navigation accessibles.

La publication reste conditionnée aux treize suites navigateur du commit livré dans GitHub Actions.

## Version 1.4.0 — du fleuve à la ville

Vérifications exécutées sur la distribution construite sous Chromium/Linux avec Playwright 1.62.1 :

- `browser-journey.cjs` : 19 vérifications réussies, sans erreur JavaScript. Parcours des six étapes, navigation précédente/suivante, retour à la maquette, conservation des réglages et fin du parcours vérifiés.
- Clic réel sur G11 dans la maquette, continuité du groupe entre turbine et alternateur, raccourcis d'Apprendre et ouverture d'un ouvrage depuis son repère sur la scène vérifiés. Ce repère reste accessible lorsque le panneau d'informations habituel est masqué.
- Vues Fleuve et Ville actualisées avec les débits, la production, les pertes et la puissance livrée du modèle ; expérience du transformateur indépendante du bilan principal et des réglages conservés.
- Clavier, maintien et restitution du focus, Échap, pause et réduction des animations vérifiés. Les changements rapides d'étape et les interruptions par la visite, la réinitialisation, le plan ou Apprendre ne rouvrent pas une ancienne fenêtre.
- Cinq formats vérifiés avec WebGL actif : 320×568, 390×844, 740×800, 844×390 et 1440×900. Guide et commandes de bas de fenêtre accessibles aux six étapes ; inspection visuelle du guide Canal et des vues Fleuve et Ville. La barre d'outils et le menu Plus restent utilisables à côté de l'entrée du parcours.
- Contrôles syntaxiques réussis pour les 13 scripts externes, les deux scripts intégrés à l'index et les trois du mode musée. Page musée et cache synchronisés, construction de 65 fichiers publics et vérification du diff réussies.

Pour reproduire la suite, servir `dist/site` sur le port 8001 après construction et utiliser l'environnement Playwright décrit dans le README :

```sh
node tests/browser-journey.cjs
```

La publication est conditionnée aux treize suites navigateur découvertes automatiquement par GitHub Actions, dont les parcours musée et hors ligne. Le résultat distant doit être vérifié pour le commit livré. Les résultats historiques ci-dessous restent distincts.

## Version 1.3.0 — transformateur et transport

Vérifications exécutées sur la distribution construite sous Chromium/Linux avec Playwright 1.62.1 :

- `browser-transformer.cjs` : 19 vérifications réussies, sans erreur JavaScript. Références à 100 MW : 288,675 A et 2,5 MW de pertes à 200 kV ; 144,338 A et 0,625 MW à 400 kV. Conservation de la puissance, limites du calcul, cas zéro et indépendance du modèle principal vérifiés.
- Boutons, curseur au clavier, comparaison animée, arrêt, pause, flux magnétique, étapes et préférence de réduction des animations vérifiés. La puissance du site est mémorisée au clic et reste fixe lors des changements ultérieurs du simulateur.
- Liens depuis l'alternateur, Apprendre, l'expérience réseau et les informations CA ; fermeture, Échap, réinitialisation, visite, plan et remplacement de fenêtre vérifiés. Aucun changement différé après annulation.
- Cinq formats vérifiés et inspectés visuellement : 320×568, 390×844, 740×800, 844×390 et 1440×900. Dessin et mesures restent visibles ; les commandes défilantes sont accessibles. Tous les boutons de la barre à 1024 px sont également accessibles.
- Correction du conflit entre les flèches des champs et la caméra : les curseurs du transformateur et du canal répondent au clavier sans déplacer la vue.
- `browser-navigation.cjs` : les quatre groupes de vérification passent, notamment le menu Plus sur trois colonnes en paysage, le bilan mobile, le retour au bureau et le secours sans WebGL.
- `browser-offline.cjs` : les sept groupes passent localement, dont l'installation avec deux onglets, le démarrage hors ligne et la migration d'une ancienne version. Les attentes d'état du service worker sont indépendantes des images d'animation des onglets en arrière-plan ; l'installation revient explicitement à l'onglet demandeur.
- Contrôles syntaxiques, génération du mode musée et du cache, construction de la distribution et vérification du diff réussis.

Pour reproduire la suite, servir `dist/site` sur le port 8001 et utiliser l'environnement Playwright décrit dans le README :

```sh
node tests/browser-transformer.cjs
```

La publication est conditionnée aux douze suites navigateur découvertes automatiquement par GitHub Actions, dont les parcours musée et hors ligne. Le résultat distant doit être vérifié pour le commit livré. Les résultats historiques ci-dessous restent distincts.

## Version 1.2.0 — coupe interactive de l'alternateur

Vérifications exécutées sur la distribution construite sous Chromium/Linux avec Playwright 1.62.1 :

- `browser-alternator.cjs` : 18 vérifications réussies. Choix du groupe, vitesse de synchronisme aux consignes 0 %, 30 % et 100 %, tensions normalisées à puissance nulle, conservation des autres réglages, instantanés d'état et refus des appels invalides à l'API.
- Marche/arrêt, montée en vitesse, panne/réparation, champ magnétique, une ou trois phases, pause, quart de tour et réduction des animations vérifiés.
- Accès depuis les outils, Apprendre, l'expérience G24 et la coupe Francis ; retour entre turbine et alternateur, navigation au clavier, fermeture et interruption des animations vérifiés.
- Cinq formats vérifiés et inspectés visuellement : 320×568, 390×844, 740×800, 844×390 et 1440×900. Les mesures restent visibles et les commandes accessibles pendant le défilement.
- Contrôles syntaxiques, génération du mode musée et du cache, construction de la distribution et vérification du diff réussis.

Pour reproduire la suite, servir `dist/site` sur le port 8001 après construction et utiliser l'environnement Playwright décrit dans le README :

```sh
node tests/browser-alternator.cjs
```

La publication est conditionnée aux onze suites navigateur découvertes automatiquement par GitHub Actions, dont les parcours musée et hors ligne. Le résultat distant doit être vérifié pour le commit livré. Les preuves des versions précédentes ci-dessous restent distinctes.

## Version 1.1.0 — coupe interactive du canal

Vérifications exécutées sur la distribution construite sous Chromium/Linux avec Playwright 1.62.1 :

- `browser-canal.cjs` : 21 vérifications réussies. Accès depuis les outils et Apprendre, correspondance du curseur et des boutons avec le modèle, conservation des autres réglages, référence de puissance à canal dégagé, animation visible du dessin, transformation et arrêt, réduction des animations, navigation au clavier et fermeture.
- Cinq formats vérifiés : 320×568, 390×844, 740×800, 844×390 et 1440×900. Le dessin reste visible pendant le défilement des commandes et la pause reste accessible dans l'en-tête. Aucune erreur JavaScript signalée par la suite.
- Inspection visuelle des formats 320×568, 390×844, 844×390 et 1440×900 ; capture du format tablette 740×800 produite par le test.
- Contrôles syntaxiques, génération du mode musée et du cache, construction de la distribution et vérification du diff réussis.

Pour reproduire la suite, servir `dist/site` sur le port 8001 après construction, puis utiliser l'environnement Playwright décrit dans le README :

```sh
node tests/browser-canal.cjs
```

La publication est conditionnée aux dix suites navigateur découvertes automatiquement par GitHub Actions, dont les parcours musée et hors ligne. Les résultats distants doivent être vérifiés pour le commit effectivement publié. Les preuves des versions précédentes ci-dessous restent distinctes.

## Version 1.0.2 — expérience visible dans la maquette

Vérifications exécutées sur `dist/site` sous Chromium/Linux avec Playwright 1.62.1 :

- `browser-learning-scene.cjs` : 12 vérifications réussies avec le rendu 3D actif. Cadrage du sujet hors du panneau, interactions tactiles et boutons accessibles à 320×568, 390×844, 844×390 et 1440×900 ; dépôts du canal, voyant de G24 et valeurs du réseau ; passage automatique ; comparaison manuelle ; annulation à la fermeture, au changement de scénario, à la réinitialisation, au lancement d'une visite et à l'ouverture d'une autre fenêtre.
- `browser-learning.cjs` : 12 vérifications réussies du parcours pédagogique avec le nouveau passage par la maquette. L'attente du démarrage automatique du musée remplace un clic susceptible de viser un accueil déjà masqué.
- `browser-navigation.cjs` : 4 groupes réussis.
- Vérification supplémentaire sans WebGL : le lancement ouvre la comparaison numérique, sans panneau de scène bloqué ni erreur JavaScript.
- Inspection visuelle du panneau et de la maquette, génération du mode musée et du cache, construction de la distribution réussies.

La publication est conditionnée aux neuf suites navigateur découvertes automatiquement par GitHub Actions. Les résultats distants doivent être vérifiés pour le commit effectivement publié.

## Version 1.0.1 — parcours Apprendre

Vérifications exécutées sur le dossier public `dist/site` sous Chromium/Linux avec Playwright 1.62.1 :

- `browser-learning.cjs` : 12 vérifications réussies. Réponses correctes, différentes ou absentes ; comparaison avec les calculs du modèle ; étapes séparées ; conservation du résultat ; reprise et réinitialisation ; clavier et détails repliables ; formats 320×568, 390×844 et 844×390 ; comportement musée.
- `browser-navigation.cjs` : 4 groupes réussis. Navigation, fenêtres, bilan mobile et fonctionnement sans WebGL.
- `browser-kiosk.cjs` : 4 vérifications réussies. Reprise après abandon et annulation au retour du visiteur.
- Inspection visuelle des quatre écrans Apprendre à 390×844 avec la maquette rendue.
- Génération du mode musée, actualisation du cache, construction de la distribution et contrôle syntaxique réussis.

Les huit suites restent obligatoires dans GitHub Actions avant publication. Le résultat distant doit être vérifié pour le commit publié. Les vérifications historiques ci-dessous concernent la version 1.0.0.

## Version 1.0.0

Les résultats ci-dessous ont été obtenus dans l'environnement de préparation sous Chromium/Linux, avec Playwright 1.62.1. Ils décrivent les vérifications effectuées ; la recette sur l'équipement du client reste distincte.

| Suite exécutée | Résultat | Couverture principale |
| --- | --- | --- |
| `browser-ux.cjs` | 14 vérifications réussies | Scénarios, modifications manuelles, focus, clavier, accueil, tablette, visite mobile, deux modes |
| `browser-audio.cjs` | 9 vérifications réussies | Annulations, callbacks tardifs, Pause/Reprendre, changement d'étape, narration adaptée |
| `browser-audio-recovery.cjs` | 8 vérifications réussies | Requête MP3 bloquée, décodage bloqué, lecture/synthèse interrompue, reprise, mode texte et progression automatique |
| `browser-cutaway.cjs` | 6 configurations réussies | Coupe de l'étape 6, commandes, fermeture, navigation et absence d'ouverture tardive |
| `browser-learning.cjs` | 10 vérifications réussies | Calculs des trois défis, lexique, clavier, fin de visite versus Quitter, formats mobiles, réinitialisation |
| `browser-navigation.cjs` | 4 groupes réussis | Navigation mobile, fenêtres, bilan vertical, restauration sur ordinateur et secours sans WebGL |
| `browser-kiosk.cjs` | 4 vérifications réussies | Reprise après abandon en pause, fermeture des fenêtres, annulation du redémarrage au retour d'un visiteur |
| `browser-offline.cjs` | 7 groupes réussis | Échecs/reprise du téléchargement, état du cache, mise à jour volontaire, autres onglets préservés, migration de l'ancienne version, démarrage réel hors ligne |

Les 23 contrôles internes du moteur réussissent également sur les parcours vérifiés, y compris après démarrage hors ligne. Ils vérifient les calculs implémentés et ne constituent pas une validation du modèle par SNEL.

## Formats et modes

Dimensions couvertes selon les suites : 320×568, 390×844, 844×390, 900×700, 1024×768 et 1440×900. Les tests incluent les versions normale et musée, ainsi que la réduction des mouvements. Le parcours de coupe en 1440×900 utilise aussi les mouvements ordinaires.

Les tests consacrés à l'audio et à certains panneaux désactivent le dessin répété du terrain après initialisation pour isoler les temporisations et la navigation des coûts du rendu logiciel cloud. Le moteur, la boucle de visite et le dessin 2D de la coupe restent actifs ; la suite UX et le démarrage hors ligne vérifient séparément la voie WebGL réelle.

## Fabrication et publication

- Vérification de la page musée et de la version du cache par `scripts/sync_site.py --check`.
- Compilation syntaxique des scripts externes et des scripts intégrés aux deux pages.
- Construction du dossier public et de l'archive versionnée par `scripts/build_release.py`.
- Deux constructions successives produisent la même empreinte SHA-256 de l'archive.
- La CI découvre toutes les suites `tests/browser-*.cjs` et les exécute sur le dossier public produit, avant déploiement. Son résultat distant doit être consulté pour le commit effectivement publié ; seules les sections assorties de résultats ci-dessus rapportent des exécutions effectuées.

## Vérifications à effectuer sur l'installation livrée

Utiliser `RECETTE.md` pour confirmer le toucher, le son, la résolution, le redémarrage du poste et une journée de fonctionnement sur le matériel retenu. Aucun résultat sur iPhone/iPad physique, Safari ou borne fonctionnant une journée entière n'est revendiqué ici.
