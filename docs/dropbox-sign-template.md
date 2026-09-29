# Modèle Dropbox Sign — contrat Salle Point G

Créer un modèle à partir du contrat PDF validé, avec deux rôles de signature nommés exactement `Locataire` et `Locateur`. Ajouter pour chaque rôle une signature et les champs automatiques de date de signature. Dropbox Sign consigne aussi l’heure et les événements dans sa piste d’audit.

Ajouter les champs de fusion suivants aux endroits correspondants :

`tenant_name`, `tenant_address`, `tenant_email`, `tenant_phone`, `tenant_neq`, `event_date`, `event_type`, `minors_present`, `minors_count`, `access_time`, `guest_time`, `room_price`, `room_taxes`, `deposit`, `room_balance`, `security_deposit`, `meal_plan`, `meal_count`, `meal_deadline`, `meal_payment`, `meal_allocation`, `beverage_payment`, `beverage_terms`, `other_purchases`, `onsite_contact`, `onsite_phone`, `notes`.

Une fois le modèle publié, copier son identifiant dans le secret Cloudflare `DROPBOX_SIGN_TEMPLATE_ID`. L’API refuse l’envoi si un rôle obligatoire n’existe pas ou si l’identifiant du modèle est invalide.
