# Maison de Saucats

Les quêtes de la maison, façon RPG pixel : bricolage, réparations, entretien, achats et planning, à deux (avec Balou comme guide).

L'appli s'installe sur le téléphone comme une application classique. Elle fonctionne hors ligne et synchronise vos quêtes entre vos deux téléphones par un dépôt GitHub privé.

## Ce qu'il y a dedans

- **Carte** : le terrain vu de dessus. Touche une zone (maison, piscine, abri, potager, poulailler, puits) pour voir ses quêtes. Balou propose la mission du jour selon ton temps, l'endroit et ta forme.
- **Nouvelle quête avec Balou** : il pose les questions une par une : où, quel genre, combien de temps, quel matériel, est-ce que tu l'as, combien ça coûte, ce qu'il faut finir avant, pour quand, qui s'en occupe.
- **Demander à Claude** : envoie l'état de la maison à Claude (avec votre abonnement, sans clé API). Claude pose ses questions, puis donne un bloc de quêtes à recoller dans l'appli.
- **Quêtes** : le journal, avec les états Faisable, À acheter, Bloquée, En attente.
- **Sac** : la liste d'achats générée toute seule, triée par ce qui débloque le plus.
- **Agenda** : le planning des 12 prochaines semaines selon vos heures de bricolage.
- **Équipe** : niveaux et XP de chacun, prénoms, consignes pour Claude, synchro.

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
