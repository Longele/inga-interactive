# Notes de version

## 1.2.0

Nouvelle coupe interactive de l'alternateur, reliée aux groupes du simulateur.

- Choix du groupe observé et parcours en trois étapes : rotor, stator et tensions alternatives.
- Dessin sur fond de parchemin avec champ magnétique affichable, une ou trois phases, pause et avance par quart de tour. La rotation est ralentie dix fois.
- Consigne de charge ajustable, raccourcis 30 % et 100 %, marche/arrêt, panne et réparation du groupe choisi ; les autres réglages sont conservés.
- Vitesse et puissance issues du modèle pour montrer la différence entre vitesse de synchronisme et charge, ainsi que la possibilité d'une tension sans puissance livrée.
- Accès depuis les outils, Plus sur mobile, Apprendre et l'expérience G24 ; passage direct entre la coupe Francis et celle de l'alternateur du même groupe.
- Limites explicites : rotor à deux pôles illustratifs, tensions normalisées et champ supposé établi en marche. Aucun nombre réel de pôles, niveau de tension ou fréquence du site n'est déduit du dessin ; l'excitation n'est pas simulée.
- Vitesses de référence documentées : environ 136 tr/min pour Inga I [S03] ; 107,1 tr/min pour Inga II, valeur du groupe 5 étendue aux autres groupes par hypothèse du modèle [S11].

Le détail des vérifications de cette version et leur portée figurent dans [VALIDATION.md](VALIDATION.md). La publication reste conditionnée aux onze suites navigateur de GitHub Actions pour le commit livré.

## 1.1.0

Nouvelle coupe interactive du canal pour comprendre le lien entre les dépôts de sable, le passage de l'eau et la production électrique.

- Dessin animé sur fond de parchemin, commandes Dégagé et Ensablé et curseur de dépôts illustratifs de 0 à 100 %.
- Dessin maintenu visible pendant le défilement des commandes sur petit écran, avec commande de pause dans l'en-tête.
- Capacité du canal ajustée de 2 200 à 1 600 m³/s, avec mise à jour du débit et de la puissance calculés par le simulateur.
- Comparaison avec un canal dégagé en conservant les autres réglages : fleuve, groupes, demande et réseau. Une contrainte ailleurs dans le système peut limiter l'effet de l'ensablement sur la puissance.
- Transformation automatique d'ensablement ou de nettoyage en huit secondes, arrêt manuel, pause du dessin et prise en compte de la réduction des animations.
- Accès par Coupe du canal dans la barre d'outils, Plus sur mobile, Le canal en coupe dans Apprendre et l'expérience du canal.
- Origine des chiffres explicitée : 2 200 m³/s est une valeur historique documentée [S01] ; 1 600 m³/s et la progression des dépôts sont des hypothèses pédagogiques. Le dessin ne représente pas une mesure ou une simulation de sédimentation réelle.

Le détail des vérifications de cette version et leur portée figurent dans [VALIDATION.md](VALIDATION.md). La publication reste conditionnée aux suites navigateur de GitHub Actions pour le commit livré.

## 1.0.2

Les expériences d'Apprendre montrent désormais le changement directement sur la maquette.

- Au lancement, la fenêtre se ferme et la vue cadre le canal, les centrales ou le réseau selon l'expérience choisie.
- La maquette affiche l'état Avant, puis applique automatiquement le changement trois secondes après l'arrivée de la vue.
- Un petit panneau laisse la maquette interactive. Ses boutons Avant et Après appliquent les réglages correspondants ; une sélection manuelle arrête le passage automatique.
- Les chiffres et l'explication s'ouvrent à la demande avec « Résultat et explication », pour laisser le temps d'observer.
- Les panneaux habituels sont temporairement dégagés pendant l'observation, puis retrouvent leur état précédent à sa fermeture.
- En l'absence de rendu 3D, l'expérience donne directement accès au résultat chiffré.

Les résultats de validation de cette version seront consignés séparément de ceux des versions précédentes, après exécution des tests.

## 1.0.1

Parcours Apprendre adapté aux personnes qui découvrent l'hydroélectricité.

- Réponse facultative : chaque expérience propose « Je ne sais pas, montrez-moi », sans note ni prérequis.
- Parcours en trois étapes : Votre idée, Le résultat et Pourquoi.
- Comparaison graphique Avant/Après de la puissance produite, avec accès aux chiffres détaillés.
- Retour explicite sur la réponse choisie et présentation du résultat observé lorsqu'aucune réponse n'a été donnée.
- Explication séparée du résultat pour comprendre les causes à son rythme.
- Accès direct à Apprendre en bas de l'écran sur mobile et commande « Revoir mon résultat » pour reprendre la dernière expérience après l'exploration de la maquette.

La validation de cette version doit être associée à son propre commit et à ses résultats de tests ; les preuves de la version 1.0.0 restent distinctes.

## 1.0.0

Distribution structurée d'Inga Interactive pour médiation scientifique et usage muséal.

- Maquette 3D d'Inga I et II, visite en français et coupe de groupe Francis adaptée au téléphone en portrait et paysage.
- Objectifs annoncés à l'entrée, bilan de fin de visite, trois défis de prédiction et glossaire des notions essentielles.
- Comparaisons de scénarios, états documentés ou hypothétiques et contrôles internes du modèle.
- Reprise de la visite en cas de chargement audio bloqué ; lecture du texte possible indépendamment du son.
- Parcours au clavier, restitution du focus à la fermeture des fenêtres et prise en compte de la réduction des animations.
- Options regroupées sur mobile et bilan vertical pour lire le chemin de l'eau à l'électricité.
- Mode musée et ressources disponibles hors ligne après préparation complète du cache sur un site compatible.
- Reprise du mode musée après l'abandon d'une visite en pause ou d'une fenêtre ouverte, avec restauration du parcours d'accueil.
- État de téléchargement vérifié, reprise d'un téléchargement incomplet et mise à jour déclenchée explicitement par l'utilisateur.
- Distribution reproductible avec version, manifeste, empreintes SHA-256, guide d'utilisation et documents de recette.
- Avis MIT et SIL OFL des bibliothèques et polices inclus ; attribution Copernicus vérifiée et confirmation de l'éditeur pour l'usage commercial des huit narrations ElevenLabs.
- Déploiement GitHub Pages conditionné à la réussite des suites navigateur, à partir d'un dossier public isolé du dépôt.

### Portée de la validation

Les suites automatisées s'exécutent sous Chromium/Linux et incluent des dimensions de téléphone et de tablette. Le succès de la CI s'applique au commit testé. Aucun essai sur appareil physique, Safari/iOS ou journée complète d'exploitation d'une borne n'est attesté par ces notes.

Le dossier `RECETTE.md` définit la vérification sur le matériel client. Les preuves de droits listées dans `THIRD_PARTY_NOTICES.md` et les modalités contractuelles restent à renseigner par l'éditeur ; leur absence n'est pas masquée par le numéro de version.
