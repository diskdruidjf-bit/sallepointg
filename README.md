# Salle Point G

Le site existant reste en HTML/CSS natif. Un serveur Node léger fournit les pages d’événements, leur API et l’administration privée.

## Démarrage local

Node.js 20 ou plus récent est requis.

```sh
ADMIN_PASSWORD='choisir-un-mot-de-passe-fort' npm start
```

Ouvrir ensuite `http://localhost:3000`. L’administration se trouve à `http://localhost:3000/admin` et les événements à `http://localhost:3000/evenements`.

```sh
npm test
```

Les événements sont stockés dans `data/events.json`. Le checkout Eventbrite intégré requiert HTTPS dans l’environnement hébergé pour permettre un achat réel.

## Cloudflare Pages

La production utilise les Pages Functions de `functions/` et une base Cloudflare D1 liée sous le nom `DB`. Dans les paramètres du projet Pages, ajouter :

- un binding D1 nommé `DB`, pour la prévisualisation et la production;
- un secret chiffré `ADMIN_PASSWORD`, pour la prévisualisation et la production.

Appliquer ensuite `migrations/0001_initial.sql` à la base D1. Le serveur `server.js` et `data/events.json` restent disponibles uniquement pour le développement local sans Cloudflare.

## Contrats de location et signature électronique

Le formulaire public se trouve à `/contrat-location`. Les demandes sont conservées dans D1 et apparaissent dans l’onglet « Contrats » de `/admin`. Appliquer aussi `migrations/0002_ticketing_options.sql` et `migrations/0003_contracts.sql`.

La signature utilise un modèle Dropbox Sign comportant deux rôles, exactement nommés `Locataire` et `Locateur`. Le modèle doit contenir les champs de fusion décrits dans `docs/dropbox-sign-template.md`. Configurer dans Cloudflare Pages :

- les secrets `DROPBOX_SIGN_API_KEY` et `DROPBOX_SIGN_TEMPLATE_ID`;
- la variable facultative `DROPBOX_SIGN_TEST_MODE=true` pendant les essais;
- le bucket R2 privé `sallepointg-contract-files` lié sous `CONTRACT_FILES`;
- l’URL de rappel Dropbox Sign `https://sallepointg.ca/api/signatures/dropbox-sign`.

Dropbox Sign envoie les invitations et la copie finale aux signataires. Le rappel conserve également le PDF final dans le bucket privé pour son téléchargement depuis l’administration.
