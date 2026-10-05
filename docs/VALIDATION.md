# Validation technique de la version 1.0.0

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
- La CI est configurée pour exécuter les huit suites sur le dossier public produit, avant déploiement. Son résultat distant doit être consulté pour le commit effectivement publié ; ce document rapporte les exécutions locales effectuées.

## Vérifications à effectuer sur l'installation livrée

Utiliser `RECETTE.md` pour confirmer le toucher, le son, la résolution, le redémarrage du poste et une journée de fonctionnement sur le matériel retenu. Aucun résultat sur iPhone/iPad physique, Safari ou borne fonctionnant une journée entière n'est revendiqué ici.
