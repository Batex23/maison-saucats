/* Quêtes de départ (estimations à corriger dans l'appli). updatedAt = 0 : les données synchronisées passent toujours devant. */
const SEED_TASKS = [
  { id: "t-liege", place: "wc_rdc", title: "WC : découper et coller le liège", kind: "reparation", zone: "WC du bas", project: "WC du bas", duration: 90, urgency: 2, importance: 2, outdoor: false, deps: [], materials: [{ name: "Colle pour liège", cost: 15, have: false }], status: "todo" },
  { id: "t-abri", place: "abri", title: "Cabane : refaire la toiture", kind: "projet", zone: "Abri", project: "Cabane", duration: 240, urgency: 2, importance: 3, outdoor: true, deps: [], materials: [], status: "todo", notes: "À faire avant les tuiles de rive." },
  { id: "t-abri-toit", place: "abri", title: "Cabane : poser les tuiles de rive", kind: "projet", zone: "Abri", project: "Cabane", duration: 180, urgency: 2, importance: 3, outdoor: true, deps: ["t-abri"], materials: [{ name: "Tuiles de rive", cost: 0, have: false }], status: "todo", notes: "Vérifier si les tuiles de rive sont déjà là ; sinon mettre le prix." },
  { id: "t-terrasse", place: "abri", title: "Poser la terrasse en dalles travertin", kind: "projet", zone: "Abri", project: "Coin douche exotique", duration: 360, urgency: 1, importance: 2, outdoor: true, deps: ["t-abri"], materials: [{ name: "Dalles style travertin gris", cost: 300, have: false }, { name: "Sable de pose", cost: 40, have: false }], status: "todo" },
  { id: "t-douche", place: "abri", title: "Installer la douche extérieure", kind: "projet", zone: "Abri", project: "Coin douche exotique", duration: 240, urgency: 1, importance: 2, outdoor: true, deps: ["t-terrasse"], materials: [{ name: "Kit douche extérieure", cost: 120, have: false }, { name: "Raccords et tuyau", cost: 25, have: false }], status: "todo", waitUntil: "2027-04-01" },
  { id: "t-brisevue", place: "jardin", title: "Poser le brise-vue côté voisins", kind: "projet", zone: "Jardin", project: "Coin douche exotique", duration: 120, urgency: 2, importance: 2, outdoor: true, deps: [], materials: [{ name: "Brise-vue / canisse", cost: 80, have: false }], status: "todo" },
  { id: "t-bananier", place: "abri", title: "Planter le bananier", kind: "projet", zone: "Abri", project: "Coin douche exotique", duration: 45, urgency: 1, importance: 1, outdoor: true, deps: [], materials: [{ name: "Bananier", cost: 40, have: false }], status: "todo", waitUntil: "2027-04-15", notes: "Après les gelées." },
  { id: "t-allee", place: "jardin", title: "Finir l'allée : étaler les cailloux (stock au potager)", kind: "projet", zone: "Jardin", project: "Allée", duration: 180, urgency: 2, importance: 2, outdoor: true, deps: ["j-brouette"], materials: [], status: "doing" },
  { id: "t-paillage", place: "jardin", title: "Pailler les massifs en écorces", kind: "projet", zone: "Jardin", project: "Coin douche exotique", duration: 60, urgency: 1, importance: 1, outdoor: true, deps: ["t-brisevue"], materials: [{ name: "Écorces de pin", cost: 30, have: false }], status: "todo" },
  { id: "t-potager-plan", place: "potager", title: "Dessiner le plan des planches du potager", kind: "projet", zone: "Potager", project: "Potager", duration: 60, urgency: 2, importance: 3, outdoor: false, deps: [], materials: [], status: "todo", notes: "11,5 x 13,5 m, entrée au milieu de la façade nord, serre côté ouest." },
  { id: "t-potager-planches", place: "potager", title: "Préparer les planches (carton + broyat)", kind: "projet", zone: "Potager", project: "Potager", duration: 240, urgency: 2, importance: 3, outdoor: true, deps: ["t-potager-plan"], materials: [{ name: "Carton brun", cost: 0, have: false }, { name: "Broyat / BRF", cost: 50, have: false }], status: "todo" },
  { id: "t-irrigation", place: "puits", title: "Installer l'irrigation depuis le puits", kind: "projet", zone: "Puits", project: "Potager", duration: 240, urgency: 1, importance: 2, outdoor: true, deps: ["t-potager-planches"], materials: [{ name: "Goutte-à-goutte + programmateur", cost: 120, have: false }], status: "todo", waitUntil: "2027-03-01" },
  { id: "t-serre", place: "potager", title: "Construire la serre earthship", kind: "projet", zone: "Potager", project: "Serre earthship", duration: 1200, urgency: 1, importance: 2, outdoor: true, deps: ["t-potager-plan"], materials: [{ name: "Bottes de paille", cost: 100, have: false }, { name: "Bois de structure", cost: 400, have: false }, { name: "Polycarbonate", cost: 300, have: false }], status: "todo", waitUntil: "2027-03-01", notes: "Budget max ~1000 €. Partie serre + partie stockage." },
  { id: "e-aspi", place: "maison", title: "Passer l'aspirateur", kind: "entretien", zone: "Maison", duration: 20, urgency: 2, importance: 2, outdoor: false, everyDays: 1, lastDone: "2026-11-22" },
  { id: "e-sol", place: "maison", title: "Laver le sol", kind: "entretien", zone: "Maison", duration: 40, urgency: 2, importance: 2, outdoor: false, everyDays: 7, lastDone: "2026-11-18" },
  { id: "e-sdb", place: "sdb", title: "Nettoyer la salle de bain et le WC", kind: "entretien", zone: "Maison", duration: 30, urgency: 2, importance: 2, outdoor: false, everyDays: 7, lastDone: "2026-11-15" },
  { id: "e-vitres", place: "maison", title: "Nettoyer les vitres", kind: "entretien", zone: "Maison", duration: 60, urgency: 1, importance: 1, outdoor: false, everyDays: 30, lastDone: "2026-10-30" },
  { id: "e-draps", place: "suite", title: "Changer les draps", kind: "entretien", zone: "Maison", duration: 15, urgency: 1, importance: 2, outdoor: false, everyDays: 14, lastDone: "2026-11-12" },
  { id: "e-frigo", place: "cuisine", title: "Nettoyer le frigo", kind: "entretien", zone: "Maison", duration: 20, urgency: 1, importance: 1, outdoor: false, everyDays: 30, lastDone: "2026-11-01" },
  { id: "e-balou", place: "terrasse", title: "Brosser Baloo", kind: "entretien", zone: "Jardin", duration: 15, urgency: 1, importance: 2, outdoor: true, everyDays: 7, lastDone: "2026-11-20" },
  { id: "e-poules", place: "poulailler", title: "Eau et grain des poules", kind: "entretien", zone: "Poulailler", duration: 10, urgency: 3, importance: 3, outdoor: true, everyDays: 2, lastDone: "2026-11-22" },
  { id: "e-poulailler", place: "poulailler", title: "Changer la litière du poulailler", kind: "entretien", zone: "Poulailler", duration: 30, urgency: 2, importance: 2, outdoor: true, everyDays: 14, lastDone: "2026-11-05" },
  { id: "e-puits", place: "puits", title: "Vérifier la pompe du puits", kind: "entretien", zone: "Puits", duration: 15, urgency: 1, importance: 2, outdoor: true, everyDays: 90, lastDone: "2026-10-01" },
  { id: "e-gouttieres", place: "facades", title: "Vider les gouttières", kind: "entretien", zone: "Maison", duration: 60, urgency: 1, importance: 2, outdoor: true, everyDays: 180, lastDone: "2026-06-01" }
];

/* Projets du moment, dictés par Baptiste le 23/11/2026. Durées et prix : estimations à corriger. */
const ECH = { name: "Échelle / échafaudage roulant", cost: 150, have: false };
const PB = { name: "Peinture blanche murs", cost: 35, have: false };
const ENDUIT = { name: "Enduit de rebouchage", cost: 12, have: false };
const P = (id, place, title, o = {}) => ({ id, place, title, kind: "projet", duration: 60, urgency: 2, importance: 2, outdoor: false, deps: [], materials: [], status: "todo", ...o });
SEED_TASKS.push(
  // Cuisine : la cafetière
  P("p-cafe-bois", "cuisine", "Cafetière : poser le bois autour", { project: "Cafetière", duration: 120, status: "doing" }),
  P("p-cafe-orne", "cuisine", "Cafetière : finir l'ornement", { project: "Cafetière", duration: 120, status: "doing" }),
  P("p-cafe-soud", "cuisine", "Cafetière : souder les composants", { project: "Cafetière", duration: 90 }),
  P("p-cafe-remont", "cuisine", "Cafetière : réassembler les derniers morceaux", { project: "Cafetière", duration: 60, deps: ["p-cafe-bois", "p-cafe-orne", "p-cafe-soud"], importance: 3 }),
  P("p-cafe-affiche", "cuisine", "Affiche « mode d'emploi du café » à imprimer", { project: "Cafetière", duration: 90, urgency: 1, materials: [{ name: "Impression de l'affiche", cost: 15, have: false }], notes: "Notice design pour expliquer la mise en route du café." }),
  // Séjour
  P("p-poutre", "sejour", "Peindre la poutre (partie haute)", { duration: 180, materials: [ECH, { name: "Peinture poutre", cost: 30, have: false }] }),
  P("p-mur-choix", "sejour", "Choisir l'habillage du grand mur (mur végétal ?)", { project: "Grand mur du séjour", duration: 60, notes: "Idée : mur végétal. À challenger : eau et humidité sur une maison bois, lumière, entretien en hauteur. Pistes : végétal stabilisé (sans eau ni lumière), tasseaux bois + plantes suspendues, peinture ou fresque." }),
  P("p-mur", "sejour", "Réaliser l'habillage du grand mur", { project: "Grand mur du séjour", duration: 960, urgency: 1, deps: ["p-mur-choix"] }),
  P("p-lum-sejour", "sejour", "Installer les luminaires du séjour", { duration: 120, materials: [ECH] }),
  P("p-caches", "sejour", "Poser des caches lumière sur les vitres hautes", { duration: 120, materials: [ECH, { name: "Caches / films pour vitres hautes", cost: 60, have: false }] }),
  P("p-vitres-hautes", "sejour", "Nettoyer les vitres hautes", { duration: 90, materials: [ECH] }),
  P("p-ramb-chercher", "sejour", "Aller chercher la nouvelle rambarde", { project: "Sécuriser l'escalier", duration: 120, urgency: 3, importance: 3 }),
  P("p-ramb-depose", "sejour", "Déposer la rambarde murale existante", { project: "Sécuriser l'escalier", duration: 60, urgency: 3, importance: 3 }),
  P("p-ramb-mur", "sejour", "Escalier : reprendre le mur et les fixations (enduits)", { project: "Sécuriser l'escalier", duration: 240, urgency: 3, importance: 3, deps: ["p-ramb-depose"], materials: [ENDUIT, { name: "Chevilles et fixations rambarde", cost: 25, have: false }] }),
  P("p-ramb-peint", "sejour", "Escalier : repeindre le mur", { project: "Sécuriser l'escalier", duration: 180, urgency: 2, importance: 2, deps: ["p-ramb-mur"], materials: [PB] }),
  P("p-ramb-pose", "sejour", "Poser la nouvelle rambarde", { project: "Sécuriser l'escalier", duration: 240, urgency: 3, importance: 3, deps: ["p-ramb-chercher", "p-ramb-mur"] }),
  P("p-baie", "sejour", "Refaire la peinture au-dessus de la baie vitrée (craquelures)", { duration: 240, materials: [ENDUIT, PB] }),
  P("p-eclab", "sejour", "Retoucher les éclaboussures de peinture", { duration: 60, urgency: 1, materials: [PB] }),
  P("p-chem-trous", "sejour", "Reboucher les trous au-dessus de la cheminée (retirer le scotch)", { duration: 45, materials: [ENDUIT, PB] }),
  P("p-kallax", "sejour", "Ranger et remettre au propre l'étagère Kallax", { duration: 90 }),
  P("p-n64", "sejour", "Remettre au propre le coin Nintendo 64", { duration: 30, urgency: 1, importance: 1 }),
  // Entrée
  P("p-coussin", "entree", "Récupérer le coussin de l'entrée chez ma mère", { duration: 30, urgency: 1, notes: "En cours d'aménagement chez ma mère." }),
  P("p-miroir", "entree", "Poser un miroir dans l'entrée", { duration: 45, urgency: 1, materials: [{ name: "Miroir d'entrée", cost: 60, have: false }] }),
  P("p-entree-peint", "entree", "Nettoyer les taches et retoucher le blanc de l'entrée", { duration: 60, materials: [PB] }),
  P("p-butoir", "entree", "Poser un butoir de porte (la porte abîme le mur)", { kind: "reparation", duration: 15, urgency: 3, materials: [{ name: "Butoir de porte", cost: 10, have: false }] }),
  P("p-porte-entree", "entree", "Régler le bas de la porte d'entrée (joint qui frotte)", { kind: "reparation", duration: 90, status: "doing" }),
  // Buanderie / cellier
  P("p-cel-etag", "buanderie", "Installer les étagères du cellier", { project: "Cellier", duration: 120, materials: [{ name: "Étagères cellier", cost: 100, have: false }] }),
  P("p-cel-linge", "buanderie", "Réorganiser le coin linge", { project: "Cellier", duration: 60 }),
  P("p-cel-etendoir", "buanderie", "Installer un étendoir intérieur", { project: "Cellier", duration: 60, materials: [{ name: "Étendoir intérieur", cost: 40, have: false }] }),
  P("p-cel-sacs", "buanderie", "Créer un rangement pour les sacs", { project: "Cellier", duration: 90, urgency: 1 }),
  P("p-cel-haut", "buanderie", "Rangements au-dessus du congélateur", { project: "Cellier", duration: 180, urgency: 1, materials: [{ name: "Planches et tasseaux", cost: 40, have: false }] }),
  // Chambre 1
  P("p-ch1-nuages", "ch1", "Peindre les nuages", { project: "Chambre 1", duration: 240, importance: 3 }),
  P("p-ch1-arche", "ch1", "Peindre l'arche", { project: "Chambre 1", duration: 180, importance: 3 }),
  P("p-ch1-appliques", "ch1", "Installer les appliques murales", { project: "Chambre 1", duration: 90 }),
  P("p-ch1-etag", "ch1", "Installer les petites étagères", { project: "Chambre 1", duration: 60 }),
  // WC du bas
  P("p-wc-lessive", "wc_rdc", "Lessiver les murs du WC", { project: "WC du bas", duration: 45, materials: [{ name: "Lessive pour murs", cost: 8, have: false }], notes: "Avant le liège et la déco." }),
  P("p-wc-porte", "wc_rdc", "Repeindre la porte du WC du bas", { project: "WC du bas", duration: 180, materials: [{ name: "Peinture porte", cost: 25, have: false }] }),
  // Chambre 2 (bureau, chambre d'amis)
  P("p-ch2-lum", "ch2", "Installer les luminaires de la chambre 2", { duration: 90 }),
  P("p-ch2-armoire", "ch2", "Réorganiser l'armoire", { duration: 60 }),
  P("p-ch2-chaise", "ch2", "Chaise de bureau (le sol se marque)", { duration: 15, materials: [{ name: "Chaise de bureau ou patins", cost: 60, have: false }] }),
  P("p-ch2-lit", "ch2", "Idée : lit escamotable", { duration: 960, urgency: 1, importance: 1, notes: "Pas prioritaire : relever le lit suffit pour l'instant." }),
  // Salle d'eau du bas
  P("p-sde-bac", "sde", "Installer un bac pour laver bébé", { duration: 60, waitUntil: "", materials: [{ name: "Bac de bain bébé", cost: 30, have: false }], notes: "Avant la naissance (février 2027)." }),
  // Couloir
  P("p-couloir", "couloir", "Reboucher et poncer les encadrements de portes", { duration: 120, materials: [ENDUIT] }),
  // Étage : coursive
  P("p-biblio-plan", "palier", "Concevoir la bibliothèque (piano, instruments, livres)", { project: "Bibliothèque de la coursive", duration: 180, importance: 3 }),
  P("p-biblio", "palier", "Construire la bibliothèque", { project: "Bibliothèque de la coursive", duration: 1440, deps: ["p-biblio-plan"], materials: [{ name: "Bois bibliothèque", cost: 300, have: false }] }),
  P("p-livres", "palier", "Ranger les livres et les instruments", { project: "Bibliothèque de la coursive", duration: 180, deps: ["p-biblio"] }),
  // Étage : suite
  P("p-coiffeuse", "suite", "Désencombrer et organiser le coin coiffeuse", { duration: 120 }),
  P("p-niches", "suite", "Habiller les niches de la penderie (bois type chêne)", { duration: 480, urgency: 1, importance: 1, materials: [{ name: "Habillage niches chêne", cost: 250, have: false }], notes: "Solutions trouvées trop chères : chercher moins cher. La 1re niche est purement déco." }),
  P("p-porte-suite", "suite", "Finir la peinture terracotta de la porte", { duration: 90, status: "doing" }),
  // Étage : salle de bain
  P("p-bain-fix", "sdb", "Fixer et régler la baignoire (partie haute)", { kind: "reparation", duration: 120, urgency: 3 }),
  P("p-joints", "sdb", "Refaire les joints baignoire et lavabos", { kind: "reparation", duration: 120, deps: ["p-bain-fix"], materials: [{ name: "Mastic sanitaire", cost: 15, have: false }] }),
  P("p-coffres-choix", "sdb", "Choisir la peinture des coffres de volets", { duration: 30, urgency: 1 }),
  P("p-coffres", "sdb", "Peindre les coffres de volets", { duration: 120, urgency: 1, deps: ["p-coffres-choix"] }),
  P("p-sdb-lum", "sdb", "Installer une lumière au-dessus des portants", { duration: 90 }),
  // Étage : terrasse du haut
  P("p-gc-etude", "terrasse_etage", "Étudier le garde-corps de la terrasse du haut", { project: "Terrasse du haut", duration: 120, urgency: 3, importance: 3, outdoor: true, notes: "Aujourd'hui il n'y en a pas du tout." }),
  P("p-gc", "terrasse_etage", "Poser le garde-corps tout autour", { project: "Terrasse du haut", duration: 960, urgency: 3, importance: 3, outdoor: true, deps: ["p-gc-etude"], materials: [{ name: "Garde-corps terrasse", cost: 0, have: false }], notes: "Chiffrer après l'étude." }),
  P("p-sauna-plan", "terrasse_etage", "Concevoir le local sauna (rangement en attendant)", { project: "Terrasse du haut", duration: 180, urgency: 1, outdoor: true, notes: "Prévoir dès le départ ce qu'il faut pour un sauna : isolation, électricité, ventilation." }),
  P("p-sauna", "terrasse_etage", "Construire le local", { project: "Terrasse du haut", duration: 1920, urgency: 1, outdoor: true, deps: ["p-sauna-plan", "p-gc"] })
);
SEED_TASKS.forEach(t => { if (!t.zone) t.zone = t.place; });

/* Extérieur, dicté par Baptiste le 23/11/2026. Durées et prix : estimations à corriger. */
const BOIS_CAB = { name: "Bois cabane (frise + surélévation du faîtage)", cost: 80, have: false };
const X = (id, place, title, o = {}) => P(id, place, title, { outdoor: true, ...o });
SEED_TASKS.push(
  // Mare naturelle (à faire en même temps que la piscine)
  X("m-plan", "mare", "Mare : implanter les 4 zones", { project: "Mare", duration: 120, urgency: 3, importance: 3, notes: "Zone de régénération des plantes + 3 bassins de 2 × 2 m : 40 cm, 60 cm et 1,20 m de profondeur. Trop-plein déjà creusé." }),
  X("m-creuser", "mare", "Mare : creuser les zones", { project: "Mare", duration: 960, urgency: 3, importance: 3, deps: ["m-plan"] }),
  X("m-membrane", "mare", "Mare : poser le géotextile et l'EPDM", { project: "Mare", duration: 360, urgency: 3, importance: 3, deps: ["m-creuser"], materials: [{ name: "Géotextile mare", cost: 80, have: false }, { name: "Bâche EPDM mare", cost: 500, have: false }] }),
  X("m-tropplein", "mare", "Mare : raccorder le trop-plein", { project: "Mare", duration: 120, deps: ["m-membrane"] }),
  X("m-pompe", "mare", "Mare : bonde de fond, pompe et filtration mécanique", { project: "Mare", duration: 240, deps: ["m-membrane"], materials: [{ name: "Pompe + filtre mécanique mare", cost: 250, have: false }, { name: "Bonde de fond", cost: 40, have: false }] }),
  X("m-ponton", "mare", "Construire le ponton au-dessus de la mare", { project: "Mare", duration: 960, urgency: 1, deps: ["m-membrane"] }),
  X("m-eau", "mare", "Remplir la mare et la piscine en même temps", { project: "Piscine et mare", duration: 240, urgency: 2, importance: 3, deps: ["m-membrane", "pi-liner"], notes: "Équilibrer les pressions pendant le remplissage et la pose du liner." }),
  // Piscine
  X("pi-demander", "piscine", "Demander au pisciniste quel fond il exige avant sa venue", { project: "Piscine", duration: 15, urgency: 3, importance: 3 }),
  X("pi-choix", "piscine", "Piscine : choisir entre ponçage et ragréage du fond", { project: "Piscine", duration: 60, urgency: 3, importance: 3, deps: ["pi-demander"], notes: "Critères : le moins cher, le plus simple, faisable en hiver. Le ragréage craint le froid : regarder la température minimale sur la fiche du produit." }),
  X("pi-fond", "piscine", "Piscine : préparer le fond (avant le pisciniste)", { project: "Piscine", duration: 960, urgency: 3, importance: 3, deps: ["pi-choix"] }),
  X("pi-liner", "piscine", "Pisciniste : finition et pose du liner", { project: "Piscine", duration: 60, urgency: 2, importance: 3, deps: ["pi-fond"], waitUntil: "2027-03-01", notes: "Fait par un professionnel au printemps 2027." }),
  X("pi-gaines", "piscine", "Passer les gaines d'éclairage avant la plage", { project: "Piscine", duration: 240, deps: ["pi-liner"], materials: [{ name: "Gaines et câble extérieur", cost: 80, have: false }] }),
  X("pi-plage", "piscine", "Plage et margelles en pierre autour de la piscine", { project: "Piscine", duration: 2400, urgency: 1, deps: ["pi-gaines"], materials: [{ name: "Dalles et margelles pierre", cost: 0, have: false }], notes: "Chiffrer les dalles." }),
  X("pi-eclairage", "piscine", "Poser l'éclairage de nuit (piscine et chemin)", { project: "Piscine", duration: 240, urgency: 1, deps: ["pi-plage"], materials: [{ name: "Luminaires extérieurs", cost: 150, have: false }] }),
  X("pi-medit", "piscine", "Créer la zone méditerranéenne autour du bassin", { project: "Piscine", duration: 960, urgency: 1, deps: ["pi-plage"] }),
  X("pi-secu", "piscine", "Sécuriser l'accès piscine et mare", { project: "Piscine et mare", duration: 480, urgency: 3, importance: 3, deps: ["pi-liner"], materials: [{ name: "Panneaux ou filet de protection", cost: 0, have: false }], notes: "Poteaux et platines déjà achetés, il manque le système de protection. Une piscine enterrée privée doit avoir un dispositif de sécurité normalisé dès sa mise en service (obligation légale), sans attendre que la petite marche." }),
  // Cabane
  X("c-faitage", "abri", "Cabane : poser les tuiles de faîtage", { project: "Cabane", duration: 180, deps: ["t-abri"], materials: [{ name: "Tuiles de faîtage", cost: 0, have: true }, BOIS_CAB] }),
  X("c-frise", "abri", "Cabane : finir la frise", { project: "Cabane", duration: 180, materials: [BOIS_CAB] }),
  X("c-caches", "abri", "Cabane : poser les caches autour de la toiture", { project: "Cabane", duration: 120, deps: ["c-frise", "t-abri-toit"] }),
  X("c-finitions", "abri", "Cabane : finitions", { project: "Cabane", duration: 240, deps: ["c-faitage", "c-caches"] }),
  // Jardin
  X("j-brouette", "jardin", "Réparer la brouette (la roue a repercé)", { kind: "reparation", duration: 45, urgency: 3, materials: [{ name: "Roue de brouette increvable", cost: 25, have: false }], notes: "Bloque l'allée et la bande d'accès." }),
  X("j-tropical", "jardin", "Créer la zone tropicale entre la cabane et la maison", { project: "Coin douche exotique", duration: 960, urgency: 1, waitUntil: "2027-04-01", notes: "Des chênes sont déjà plantés." }),
  X("j-calendrier", "jardin", "Établir le calendrier des plantations par saison", { duration: 60 }),
  X("j-etendoir-choix", "jardin", "Choisir l'emplacement de l'étendoir extérieur", { duration: 30, notes: "Pas trop loin, pas moche." }),
  X("j-etendoir", "jardin", "Installer l'étendoir extérieur", { duration: 120, deps: ["j-etendoir-choix"], materials: [{ name: "Étendoir extérieur", cost: 80, have: false }] }),
  X("j-pergola", "terrasse", "Pergola végétale devant la chambre (poteaux déjà là)", { project: "Pergola", duration: 960, importance: 3, notes: "Avant l'été 2027, pour protéger la chambre du soleil." }),
  X("j-vigne", "terrasse", "Planter vignes et grimpantes au pied de la pergola", { project: "Pergola", duration: 90, deps: ["j-pergola"], materials: [{ name: "Vignes et grimpantes", cost: 60, have: false }] }),
  // Potager
  X("pt-plantations", "potager", "Potager : premières plantations", { project: "Potager", duration: 240, deps: ["t-potager-planches"], waitUntil: "2027-03-15" }),
  // Poulailler
  X("po-plan", "poulailler", "Dessiner le nouveau poulailler (bardage bois debout)", { project: "Poulailler", duration: 180, notes: "Derrière la maison, joli côté visible." }),
  X("po-construire", "poulailler", "Construire le poulailler", { project: "Poulailler", duration: 1440, deps: ["po-plan"], materials: [{ name: "Bois poulailler et bardage", cost: 300, have: false }] }),
  // Accès, parking, portail
  X("a-bande", "acces", "Chemin d'accès : bande de 1 m (géotextile + cailloux)", { project: "Accès", duration: 240, deps: ["j-brouette"], materials: [{ name: "Géotextile bande d'accès", cost: 0, have: true }, { name: "Cailloux bande d'accès", cost: 80, have: false }] }),
  X("a-parking", "acces", "Pavage granit du parking (4 × 8 m)", { project: "Accès", duration: 2400, urgency: 1, materials: [{ name: "Pavés granit 32 m²", cost: 0, have: false }], notes: "Chiffrer les pavés et le lit de pose." }),
  X("a-portail-choix", "acces", "Choisir le portail motorisé 4 m et la clôture", { project: "Portail", duration: 120 }),
  X("a-portail", "acces", "Poser le portail motorisé 4 m", { project: "Portail", duration: 960, deps: ["a-portail-choix"], materials: [{ name: "Portail motorisé 4 m", cost: 0, have: false }] }),
  X("a-bardage", "acces", "Habiller la clôture en bardage bois debout", { project: "Portail", duration: 960, urgency: 1, deps: ["a-portail"] }),
  // Terrasse de l'entrée (le bois et les lambourdes sont déjà là)
  X("e-plots-choix", "terrasse_entree", "Choisir la solution de plots béton (tubes PVC ?)", { project: "Terrasse de l'entrée", duration: 60, urgency: 3, importance: 3, notes: "Bois (30 m²) et lambourdes déjà achetés. Restes de tubes PVC disponibles." }),
  X("e-plots", "terrasse_entree", "Couler les plots béton", { project: "Terrasse de l'entrée", duration: 480, urgency: 3, importance: 3, deps: ["e-plots-choix"], materials: [{ name: "Béton en sacs (plots)", cost: 60, have: false }, { name: "Tubes PVC", cost: 0, have: true }] }),
  X("e-terrasse", "terrasse_entree", "Poser lambourdes et lames, bien de niveau (~20 m²)", { project: "Terrasse de l'entrée", duration: 1440, urgency: 3, importance: 3, deps: ["e-plots"] }),
  X("e-rampe", "terrasse_entree", "Créer la pente pour les courses", { project: "Terrasse de l'entrée", duration: 240, deps: ["e-terrasse"] }),
  X("e-local", "terrasse_entree", "Imaginer le local fermé vélos et mobylettes", { project: "Terrasse de l'entrée", duration: 120, urgency: 1, deps: ["e-terrasse"] })
);
SEED_TASKS.forEach(t => { if (!t.zone) t.zone = t.place; });

/* Rappels et projets longs, ajoutés le 23/11/2026. */
SEED_TASKS.push(
  { id: "e-poubelle-jaune", place: "acces", zone: "Accès", title: "Sortir la poubelle jaune", kind: "entretien", duration: 5, urgency: 3, importance: 3, outdoor: true, weekday: 2, evening: true, everyDays: 7, lastDone: "2026-11-17", notes: "Collecte le mercredi matin." },
  { id: "e-poubelle-grise", place: "acces", zone: "Accès", title: "Sortir la poubelle grise", kind: "entretien", duration: 5, urgency: 3, importance: 3, outdoor: true, weekday: 4, evening: true, everyDays: 7, lastDone: "2026-11-19", notes: "Collecte le vendredi matin." },
  P("d-projet", "maison", "Domotique : définir le projet", { project: "Domotique", duration: 180, urgency: 1, importance: 1, notes: "Long terme. Volets électriques automatisés, gestion de la température, suivi et monitoring de la maison." }),
  P("d-volets", "maison", "Domotique : automatiser les volets électriques", { project: "Domotique", duration: 480, urgency: 1, importance: 1, deps: ["d-projet"] }),
  P("d-temp", "maison", "Domotique : gestion de la température", { project: "Domotique", duration: 480, urgency: 1, importance: 1, deps: ["d-projet"] }),
  P("d-monitoring", "maison", "Domotique : suivi et monitoring de la maison", { project: "Domotique", duration: 480, urgency: 1, importance: 1, deps: ["d-projet"] })
);
