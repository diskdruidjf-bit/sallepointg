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
