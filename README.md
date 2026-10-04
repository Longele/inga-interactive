# Inga Interactive

Expérience interactive consacrée aux centrales hydroélectriques Inga I & II en RDC.

## Projet
Site statique HTML/CSS/JavaScript utilisant Three.js, avec visite guidée audio et mode musée/kiosque.

## Lancement
- Site normal : `index.html`
- Mode musée : `index.html?musee=1`

## Hébergement
Le projet est prévu pour être publié comme site statique (GitHub Pages, Cloudflare Pages ou Render).

## Développement

Lancer `python3 -m http.server 8000` à la racine du projet. Modifier `index.html`, puis exécuter `python3 scripts/sync_site.py` : cette commande génère la page musée et renouvelle la version du cache hors ligne à partir des fichiers du site.

Avant de publier, `python3 scripts/sync_site.py --check` vérifie que ces sorties sont à jour. Les 23 contrôles du moteur restent accessibles dans **Registre → Validation**.

### Tests de parcours

Les tests utilisent Node.js, Playwright et Chromium. Installer les outils hors du dossier publié, puis lancer le serveur dans un autre terminal :

```sh
npm install --prefix /tmp/inga-test-tools playwright@1.62.1
python3 -m http.server 8001 --bind 127.0.0.1
```

Avec Chromium installé (`/usr/bin/chromium` par défaut, sinon définir `CHROMIUM_PATH`) :

```sh
NODE_PATH=/tmp/inga-test-tools/node_modules node tests/browser-ux.cjs
NODE_PATH=/tmp/inga-test-tools/node_modules node tests/browser-audio.cjs
NODE_PATH=/tmp/inga-test-tools/node_modules node tests/browser-cutaway.cjs
NODE_PATH=/tmp/inga-test-tools/node_modules node tests/browser-offline.cjs
```

`INGA_TEST_URL` peut changer l’origine du serveur pour les tests UX/hors ligne ; `INGA_URL` peut changer l’URL complète de la page pour les tests audio. Les tests couvrent les comparaisons de scénarios, les petits écrans, le clavier, les annulations audio et le cache hors ligne.
