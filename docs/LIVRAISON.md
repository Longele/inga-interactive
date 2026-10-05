# Dossier de livraison — Inga Interactive

## Objet du produit

Inga Interactive explique le chemin de l'eau et de l'électricité à Inga I et II. Il est destiné à la médiation scientifique, à l'accueil de visiteurs et à l'apprentissage des principes. Il comprend une maquette 3D, une visite en français, une coupe de groupe Francis, des coupes interactives du canal et de l'alternateur, une expérience du transformateur et du transport, des scénarios interactifs, des repères documentaires et un mode musée.

Le parcours « Du fleuve à la ville » relie ces éléments en six étapes visibles. Les vues Fleuve et Ville lisent le bilan du simulateur ; les étapes intermédiaires ouvrent les ouvrages correspondants. La navigation conserve les réglages et le groupe observé entre turbine et alternateur. L'expérience du transformateur reste indépendante du bilan principal.

La coupe du canal permet d'ajuster des dépôts illustratifs et de suivre leur effet sur la capacité de passage et la puissance simulée, tout en conservant les autres réglages. La plage de 2 200 à 1 600 m³/s relie une valeur historique documentée à une hypothèse pédagogique ; le curseur ne mesure pas l'état réel du canal.

La coupe de l'alternateur relie le principe rotor/stator/tensions alternées au groupe choisi dans le simulateur. Ses commandes agissent sur la charge et l'état de ce groupe. Le dessin à deux pôles et les tensions normalisées sont illustratifs ; ils n'établissent ni la géométrie, ni le nombre de pôles, ni la tension ou la fréquence réelle des machines d'Inga. L'excitation et la régulation de tension ne sont pas modélisées.

L'expérience du transport compare localement tension, courant et pertes à puissance envoyée constante, indépendamment du bilan principal. Elle repose sur un transformateur idéal et une ligne triphasée résistive avec des paramètres hypothétiques ; elle ne représente ni un équipement réel du site, ni la liaison en courant continu Inga–Kolwezi.

Les puissances et débits affichés sont calculés par un modèle pédagogique. Le produit ne reçoit pas de télémétrie et n'est pas un outil de commande, de dimensionnement ou de formation qualifiante à l'exploitation des centrales. Il ne revendique aucune certification ni approbation de la SNEL.

## Remise technique

La version exacte figure dans `site/VERSION` et dans `MANIFEST.json`. Le paquet est nommé `inga-interactive-<version>.zip` ; son empreinte est fournie dans `SHA256SUMS`. Conserver ensemble l'archive, le manifeste et le résultat de la recette.

| Livrable | Contenu |
| --- | --- |
| `site/` | Site autonome, bibliothèques, polices, icônes, pistes audio, cache hors ligne et guide |
| `site/LISEZMOI.html` | Installation, accès, son, maintenance courante |
| `site/Lancer_musee.bat`, `site/Ouvrir_Inga.bat` | Lanceurs Windows fournis pour une recette locale Chrome/Edge |
| `site/THIRD_PARTY_NOTICES.md`, `site/licenses/` | Avis et licences des composants identifiés |
| `documentation/` | Présent dossier, recette, exploitation et notes de version |
| `MANIFEST.json` | Inventaire avec taille et empreinte des fichiers remis |

Le répertoire publié par GitHub Pages contient uniquement le site public. Les lanceurs Windows et les documents de remise restent dans l'archive client.

## Périmètre à convenir pour chaque client

Ces champs définissent la livraison contractuelle ; ils ne constituent pas des engagements déjà acceptés :

| Champ | Valeur à inscrire dans le bon de livraison |
| --- | --- |
| Client et interlocuteur de recette | À renseigner |
| Éditeur, coordonnées et responsable de support | À renseigner |
| Usage retenu | Site public, borne locale ou les deux |
| Version et empreinte de l'archive acceptée | À recopier depuis le paquet remis |
| Équipements et versions de navigateur acceptés | À inscrire après recette sur ces équipements |
| Nombre d'installations et droit de diffusion | À définir par contrat |
| Personnalisation, logo et validation éditoriale | À définir ; aucune autorisation de marque implicite |
| Hébergement, domaine et responsabilité de maintenance | À définir |
| Durée et niveau de support | À définir ; aucun délai d'intervention automatique |
| Mises à jour incluses, hors périmètre et prix | À définir |

## État des preuves

- Les contrôles du modèle et les suites navigateur sont automatisés. Le résultat d'une exécution CI réussie est lié à un commit précis ; il faut conserver son lien avec le bon de livraison.
- Les essais aux dimensions d'un téléphone utilisent Chromium en environnement Linux. Ils ne certifient pas Safari, iOS, Android ni un appareil physique particulier.
- Les licences MIT et SIL OFL des bibliothèques et polices sont jointes, ainsi que l'attribution Copernicus vérifiée. L'éditeur a confirmé avoir généré les huit voix avec son compte ElevenLabs sous un abonnement payant autorisant l'usage commercial. Ses justificatifs restent à conserver dans ses archives privées ; la licence complète applicable à la tuile de relief dérivée reste à joindre au dossier selon `site/THIRD_PARTY_NOTICES.md`.
- Les contenus, les marques et les droits propres à l'éditeur doivent être décrits dans le contrat. Aucune licence générale du code original n'est ajoutée par ce dossier.

La livraison finale se constate avec la recette signée et les droits documentés sur les ressources effectivement cédées. L'archive ne constitue pas à elle seule cette acceptation.
