# Maison de Saucats

Les tâches de la maison, pièce par pièce : bricolage, réparations, entretien, achats et planning, pour Baptiste et Elodie (avec Baloo comme guide).

L'appli s'installe sur le téléphone comme une application classique. Elle fonctionne hors ligne et synchronise vos tâches entre vos deux téléphones par un dépôt GitHub privé.

## Ce qu'il y a dedans

- **Maison** : « Aujourd'hui » propose quoi faire selon ton temps, l'endroit et ta forme. En dessous, la maison en isométrie (RDC, étage, extérieur) d'après les plans : touche une pièce pour voir ses tâches, triées en « à faire maintenant », « il manque du matériel » et « plus tard ».
- **Nouvelle tâche avec Baloo** : il pose les questions une par une : où, quel genre, combien de temps, quel matériel, est-ce que tu l'as, combien ça coûte, ce qu'il faut finir avant, pour quand, qui s'en occupe.
- **Demander à Claude** : envoie l'état de la maison à Claude (avec votre abonnement, sans clé API). Claude pose ses questions, puis donne un bloc de tâches à recoller dans l'appli.
- **Tâches** : toutes les tâches, rangées par pièce.
- **Achats** : la liste générée toute seule, triée par ce qui débloque le plus.
- **Agenda** : le planning des 12 prochaines semaines selon vos heures de bricolage.
- **Nous** : qui utilise ce téléphone, prénoms, consignes pour Claude, synchro, sauvegarde.

Les pièces et leurs positions sont dans `js/house.js`.

## Installer sur le téléphone

1. Ouvre `https://batex23.github.io/maison-saucats/` dans Safari (iPhone) ou Chrome (Android).
2. iPhone : bouton Partager → « Sur l'écran d'accueil ». Android : menu ⋮ → « Installer l'application ».

## Mettre en place la synchro (une fois)

1. Sur GitHub, crée un dépôt **privé** nommé `maison-saucats-data` (vide, sans README).
2. Crée un jeton : Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
   - Repository access : *Only select repositories* → `maison-saucats-data`.
   - Permissions → Repository permissions → **Contents : Read and write**.
   - Durée : 1 an.
3. Dans l'appli, onglet **Équipe** → Synchro : colle le jeton et touche **Connecter**.
4. Fais pareil sur le téléphone d'Elodie (même jeton ou un second).

Le jeton reste uniquement dans le téléphone. Le code de l'appli est public, vos quêtes restent dans le dépôt privé.

## Mettre à jour

Les fichiers sont statiques (`index.html`, `css/`, `js/`). Après une modification, change le numéro `CACHE` dans `sw.js` pour que les téléphones prennent la nouvelle version.

## Parler à Baloo

Le bouton « Parler à Baloo » ouvre la conversation avec Claude où l'appli est construite. On y dicte les nouvelles tâches ou les changements ; Claude les écrit dans `js/seed.js` :

- une nouvelle tâche s'ajoute à `SEED_TASKS` et apparaît sur les téléphones au prochain lancement ;
- une correction (tâche faite, nouveau prix, autre pièce…) s'ajoute à `SEED_PATCHES` avec une clé unique, et ne s'applique qu'une fois.

Le lien se change dans l'onglet Nous si on repart d'une autre conversation.
