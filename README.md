# Inga Interactive

**Du fleuve au réseau** : une expérience pédagogique interactive consacrée à Inga I et II en République démocratique du Congo. Visite guidée, maquette 3D, narration, scénarios hydrauliques et mode musée. Version de distribution : [`VERSION`](VERSION).

Le modèle illustre des relations physiques et des situations pédagogiques. Les résultats sont simulés, sans télémétrie, certification ni approbation de la SNEL.

## Utiliser et livrer

- `index.html` : expérience publique.
- `musee.html` ou `index.html?musee=1` : borne avec retour automatique à la visite.
- [Guide d'installation et d'utilisation](LISEZMOI.html).
- [Dossier de livraison](docs/LIVRAISON.md), [recette client](docs/RECETTE.md), [exploitation et support](docs/EXPLOITATION.md).
- [Composants tiers et pièces de droits](THIRD_PARTY_NOTICES.md).

Le fonctionnement hors ligne sur un site hébergé nécessite une première préparation complète du cache, un contexte HTTPS (ou localhost) et de l'espace disponible dans le navigateur. Le guide distingue ce mode du lancement local Windows.

## Développer

```sh
python3 -m http.server 8001 --bind 127.0.0.1
```

Modifier `index.html` et les ressources du site, puis régénérer la page musée et la version du cache :

```sh
python3 scripts/sync_site.py
python3 scripts/sync_site.py --check
```

`musee.html` est généré : ne pas le modifier directement. Les contrôles internes du modèle sont accessibles dans **Registre → Validation** ; ils vérifient la cohérence du modèle, pas son exactitude par rapport à une installation réelle.

## Vérifier les parcours

Les tests utilisent Playwright **1.62.1** et Chromium. Installation sans dépendances ajoutées au dossier public :

```sh
npm install --prefix /tmp/inga-test-tools --no-audit --no-fund playwright@1.62.1
/tmp/inga-test-tools/node_modules/.bin/playwright install chromium
export NODE_PATH=/tmp/inga-test-tools/node_modules
export CHROMIUM_PATH="$(node -p 'require("playwright").chromium.executablePath()')"
```

Sur une machine Linux vierge, utiliser `playwright install --with-deps chromium` avec les droits nécessaires. On peut aussi définir `CHROMIUM_PATH=/usr/bin/chromium` pour un navigateur déjà installé.

Après avoir lancé le serveur sur le port 8001, exécuter l'ensemble des tests :

```sh
for test in tests/browser-*.cjs; do node "$test" || exit; done
```

`INGA_TEST_URL` change l'origine du serveur ; `INGA_URL` change l'URL complète utilisée par les tests audio. Les suites couvrent les parcours, petits écrans, clavier, narration, coupe Francis et cache hors ligne ; les nouvelles suites `browser-*.cjs` rejoignent automatiquement la CI.

## Construire une distribution

```sh
python3 scripts/build_release.py
cd dist
sha256sum --check SHA256SUMS
```

Le script vérifie d'abord les fichiers générés, la version, l'inventaire du cache et les références locales HTML/CSS. Il produit :

- `dist/site/` : uniquement les fichiers publics, le guide et les avis de licence ; aucun test, script de développement ni dossier client.
- `dist/inga-interactive-<version>.zip` : le site, les lanceurs Windows et les documents de remise au client.
- `dist/MANIFEST.json` : inventaire et SHA-256 des fichiers de livraison.
- `dist/SHA256SUMS` : empreintes de l'archive et du manifeste.

Le paquet est reproductible à contenu identique. `dist/` n'est pas versionné. Pour préparer une nouvelle livraison, mettre à jour `VERSION` et les notes de version, régénérer, puis tester la distribution construite. Ne pas modifier une archive déjà livrée sous le même numéro de version.

## Publication

Le workflow GitHub Actions construit la distribution et exécute chaque suite navigateur sur **`dist/site/`**. GitHub Pages est déployé uniquement si toutes les suites réussissent. Les pull requests exécutent les mêmes contrôles sans publication ; les pushes sur `main` et le lancement manuel depuis `main` peuvent publier.

Dans **Actions → Validate and deploy Inga Interactive**, télécharger l'artefact `inga-interactive-release` d'une exécution réussie pour récupérer le paquet et ses empreintes. Le workflow ne publie pas tout le dépôt sur Pages.

Les tests automatisés Chromium en environnement Linux et aux dimensions mobiles ne remplacent pas une recette sur l'iPhone, la tablette ou la borne réellement vendus. Les éléments à renseigner pour chaque livraison figurent dans le dossier client, notamment le matériel accepté, les engagements de support et les justificatifs de droits des voix et du relief.
