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

Le formulaire public se trouve à `/contrat-location`. Les demandes sont conservées dans D1 et apparaissent dans l’onglet « Contrats » de `/admin`. Appliquer aussi les migrations `0002_ticketing_options.sql`, `0003_contracts.sql` et `0004_native_signatures.sql`.

La signature est gérée par le site. Chaque partie reçoit un lien personnel valable 14 jours, consulte le contrat, dessine sa signature et confirme son consentement. Le système conserve l’horodatage, l’adresse IP, l’agent utilisateur, l’empreinte du contrat et un journal de preuve. Une fois les deux signatures reçues, le PDF final est conservé dans R2 et envoyé aux parties.

Configurer dans Cloudflare Pages :

- le secret `RESEND_API_KEY` pour l’envoi transactionnel;
- `SIGNATURE_FROM_EMAIL`, par exemple `Salle Point G <contrats@sallepointg.ca>`;
- `PUBLIC_SITE_URL=https://sallepointg.ca`;
- le bucket R2 privé `sallepointg-contract-files` lié sous `CONTRACT_FILES`.
