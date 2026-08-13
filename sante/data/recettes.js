/* ============================================================
   BASE DE RECETTES — 53 plats équilibrés pour 4 personnes
   ------------------------------------------------------------
   Construite à partir des repères nutritionnels du PNNS 4 / ANSES :
     · 1/2 légumes, 1/4 protéines, 1/4 féculents complets
     · poisson 2x/semaine dont 1 poisson gras
     · légumineuses 2 a 3x/semaine
     · viande rouge <= 1x/semaine, charcuterie limitee
   Inspirations : Marmiton, 750g, Ricardo, Amandine Cooking, HelloFresh.

   Champs :
     cat        Végétarien | Poisson | Volaille | Viande rouge | Porc | Œufs
     legumineuse / poissonGras / viandeRouge : marqueurs d'équilibre
     plaisir    true = plat "jour sympa" (week-end / envie de réconfort)
     ingredients: [nom, quantité (pour 4 pers.), unité, rayon]
     allergenes : codes de la liste ALLERGENES (js/app.js)
     src        : [site, requête de recherche]
   ============================================================ */

const RAYONS = {
  lg: 'Fruits & légumes',
  bo: 'Boucherie & volaille',
  po: 'Poissonnerie',
  cr: 'Crèmerie & œufs',
  fe: 'Féculents & légumes secs',
  ep: 'Épicerie salée',
  es: 'Épices & aromates',
  bl: 'Boulangerie',
  sg: 'Surgelés'
};

const SOURCES = {
  marmiton:       { nom: 'Marmiton',         url: 'https://www.marmiton.org/recettes/recherche.aspx?aqt=' },
  g750:           { nom: '750g',             url: 'https://www.750g.com/recherche?q=' },
  ricardo:        { nom: 'Ricardo Cuisine',  url: 'https://www.ricardocuisine.com/recherche?q=' },
  amandine:       { nom: 'Amandine Cooking', url: 'https://www.amandinecooking.com/?s=' },
  hellofresh:     { nom: 'HelloFresh',       url: 'https://www.hellofresh.fr/recipes/search?q=' }
};

const RECETTES = [

/* ---------------------------------------------------------------
   VÉGÉTARIEN & LÉGUMINEUSES
   --------------------------------------------------------------- */
{
  id: 'dahl-corail',
  nom: 'Dahl de lentilles corail au lait de coco et épinards',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 35, diff: 'Facile',
  kcal: 515, prot: 21, gluc: 68, lip: 16, fibres: 14,
  saisons: ['automne', 'hiver', 'printemps'],
  tags: ['one pot', 'batch cooking', 'sans gluten', 'économique'],
  allergenes: [],
  ingredients: [
    ['Lentilles corail', 300, 'g', 'fe'],
    ['Lait de coco', 400, 'ml', 'ep'],
    ['Épinards frais', 200, 'g', 'lg'],
    ['Tomates concassées', 400, 'g', 'ep'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Gingembre frais', 20, 'g', 'lg'],
    ['Curry en poudre', 2, 'c.à.s', 'es'],
    ['Cumin moulu', 1, 'c.à.c', 'es'],
    ['Curcuma', 1, 'c.à.c', 'es'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Riz basmati complet', 250, 'g', 'fe'],
    ['Citron vert', 1, 'pièce', 'lg'],
    ['Coriandre fraîche', 1, 'botte', 'lg']
  ],
  etapes: [
    'Émincez les oignons, hachez l\'ail et le gingembre. Faites revenir 5 min dans l\'huile d\'olive dans une grande cocotte.',
    'Ajoutez curry, cumin et curcuma, mélangez 1 min pour libérer les arômes.',
    'Versez les lentilles corail rincées, les tomates concassées, le lait de coco et 400 ml d\'eau. Salez, poivrez.',
    'Laissez mijoter 20 min à feu doux en remuant de temps en temps, jusqu\'à ce que les lentilles se défassent.',
    'Pendant ce temps, faites cuire le riz complet selon les indications du paquet.',
    'Hors du feu, incorporez les épinards (ils fondent en 2 min), le jus du citron vert et la coriandre ciselée.'
  ],
  astuce: 'Se congèle très bien : doublez les quantités et gardez 4 portions pour un soir de flemme.',
  src: ['marmiton', 'dahl lentilles corail lait de coco']
},
{
  id: 'chili-sin-carne',
  nom: 'Chili sin carne aux haricots rouges',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 40, diff: 'Facile',
  kcal: 495, prot: 20, gluc: 72, lip: 11, fibres: 17,
  saisons: ['automne', 'hiver'],
  tags: ['one pot', 'batch cooking', 'économique', 'riche en fibres'],
  allergenes: [],
  ingredients: [
    ['Haricots rouges cuits', 480, 'g', 'ep'],
    ['Maïs doux', 200, 'g', 'ep'],
    ['Tomates concassées', 800, 'g', 'ep'],
    ['Poivron rouge', 2, 'pièce', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Carotte', 2, 'pièce', 'lg'],
    ['Cumin moulu', 2, 'c.à.c', 'es'],
    ['Paprika fumé', 2, 'c.à.c', 'es'],
    ['Piment doux en poudre', 1, 'c.à.c', 'es'],
    ['Concentré de tomate', 2, 'c.à.s', 'ep'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Riz complet', 250, 'g', 'fe'],
    ['Coriandre fraîche', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Taillez oignons, poivrons et carottes en petits dés. Faites-les suer 8 min dans l\'huile.',
    'Ajoutez l\'ail haché, les épices et le concentré de tomate, mélangez 2 min.',
    'Versez les tomates concassées et 200 ml d\'eau, laissez mijoter 15 min à couvert.',
    'Ajoutez les haricots rouges égouttés et le maïs, poursuivez 10 min à découvert pour épaissir.',
    'Faites cuire le riz complet en parallèle.',
    'Rectifiez l\'assaisonnement et parsemez de coriandre au moment de servir.'
  ],
  astuce: 'Un carré de chocolat noir dans la sauce arrondit l\'acidité de la tomate.',
  src: ['g750', 'chili sin carne']
},
{
  id: 'curry-pois-chiches',
  nom: 'Curry de pois chiches, patate douce et épinards',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 40, diff: 'Facile',
  kcal: 540, prot: 18, gluc: 74, lip: 17, fibres: 15,
  saisons: ['automne', 'hiver'],
  tags: ['one pot', 'sans gluten', 'batch cooking'],
  allergenes: [],
  ingredients: [
    ['Pois chiches cuits', 480, 'g', 'ep'],
    ['Patate douce', 700, 'g', 'lg'],
    ['Épinards frais', 200, 'g', 'lg'],
    ['Lait de coco', 400, 'ml', 'ep'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Gingembre frais', 20, 'g', 'lg'],
    ['Pâte de curry (ou curry en poudre)', 2, 'c.à.s', 'es'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Riz basmati', 250, 'g', 'fe'],
    ['Citron', 1, 'pièce', 'lg']
  ],
  etapes: [
    'Épluchez et coupez la patate douce en cubes de 2 cm.',
    'Faites revenir l\'oignon émincé, l\'ail et le gingembre 5 min, ajoutez la pâte de curry.',
    'Ajoutez la patate douce, le lait de coco et 200 ml d\'eau. Couvrez et laissez cuire 20 min.',
    'Incorporez les pois chiches égouttés, poursuivez 5 min.',
    'Ajoutez les épinards, un filet de jus de citron, salez, poivrez.',
    'Servez avec le riz basmati.'
  ],
  astuce: 'La patate douce apporte des glucides à index glycémique modéré : idéal le soir après le sport.',
  src: ['amandine', 'curry pois chiches patate douce']
},
{
  id: 'buddha-bowl',
  nom: 'Buddha bowl quinoa, houmous et légumes rôtis',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 45, diff: 'Facile',
  kcal: 560, prot: 19, gluc: 65, lip: 23, fibres: 14,
  saisons: ['printemps', 'été', 'automne'],
  tags: ['sans gluten', 'lunch box', 'coloré'],
  allergenes: ['sesame'],
  ingredients: [
    ['Quinoa', 240, 'g', 'fe'],
    ['Pois chiches cuits', 400, 'g', 'ep'],
    ['Patate douce', 500, 'g', 'lg'],
    ['Brocoli', 400, 'g', 'lg'],
    ['Carotte', 3, 'pièce', 'lg'],
    ['Avocat', 2, 'pièce', 'lg'],
    ['Houmous', 200, 'g', 'ep'],
    ['Graines de courge', 40, 'g', 'ep'],
    ['Tahini (purée de sésame)', 2, 'c.à.s', 'ep'],
    ['Citron', 1, 'pièce', 'lg'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Paprika fumé', 1, 'c.à.c', 'es']
  ],
  etapes: [
    'Préchauffez le four à 200 °C. Coupez patate douce et carottes en bâtonnets, le brocoli en fleurettes.',
    'Mélangez les légumes et la moitié des pois chiches avec 2 c.à.s d\'huile, le paprika, sel et poivre. Enfournez 25 min.',
    'Faites cuire le quinoa 12 min dans 2 fois son volume d\'eau salée, puis égrainez à la fourchette.',
    'Préparez la sauce : tahini, jus de citron, 3 c.à.s d\'eau, sel — fouettez jusqu\'à obtenir une texture crémeuse.',
    'Composez les bols : quinoa, légumes rôtis, pois chiches restants, avocat en lamelles, une cuillère de houmous.',
    'Arrosez de sauce tahini et parsemez de graines de courge.'
  ],
  astuce: 'Le trio quinoa + pois chiches donne un profil d\'acides aminés complet, sans viande.',
  src: ['hellofresh', 'buddha bowl quinoa']
},
{
  id: 'minestrone',
  nom: 'Minestrone aux haricots blancs et pâtes complètes',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 40, diff: 'Facile',
  kcal: 430, prot: 17, gluc: 66, lip: 9, fibres: 15,
  saisons: ['automne', 'hiver'],
  tags: ['soupe repas', 'économique', 'batch cooking'],
  allergenes: ['gluten', 'lait', 'celeri'],
  ingredients: [
    ['Haricots blancs cuits', 400, 'g', 'ep'],
    ['Pâtes complètes courtes', 160, 'g', 'fe'],
    ['Courgette', 2, 'pièce', 'lg'],
    ['Carotte', 3, 'pièce', 'lg'],
    ['Céleri branche', 2, 'pièce', 'lg'],
    ['Poireau', 1, 'pièce', 'lg'],
    ['Tomates concassées', 400, 'g', 'ep'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Ail', 2, 'gousse', 'lg'],
    ['Bouillon de légumes', 1200, 'ml', 'ep'],
    ['Parmesan', 60, 'g', 'cr'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Basilic frais', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Taillez tous les légumes en petits dés réguliers.',
    'Faites suer oignon, carotte et céleri 8 min dans l\'huile d\'olive.',
    'Ajoutez poireau, courgette, ail, puis les tomates concassées et le bouillon. Mijotez 15 min.',
    'Ajoutez les pâtes et les haricots blancs, cuisez le temps indiqué sur le paquet.',
    'Servez avec le parmesan râpé et le basilic ciselé.'
  ],
  astuce: 'Version sans gluten : remplacez les pâtes par 120 g de riz complet.',
  src: ['marmiton', 'minestrone haricots blancs']
},
{
  id: 'galettes-lentilles',
  nom: 'Galettes de lentilles vertes et carotte, sauce yaourt-menthe',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 45, diff: 'Moyen',
  kcal: 470, prot: 22, gluc: 58, lip: 15, fibres: 13,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['économique', 'les enfants adorent'],
  allergenes: ['oeuf', 'lait', 'gluten'],
  ingredients: [
    ['Lentilles vertes', 250, 'g', 'fe'],
    ['Carotte', 3, 'pièce', 'lg'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Œuf', 2, 'pièce', 'cr'],
    ['Chapelure', 60, 'g', 'ep'],
    ['Cumin moulu', 1, 'c.à.c', 'es'],
    ['Yaourt grec', 300, 'g', 'cr'],
    ['Menthe fraîche', 0.5, 'botte', 'lg'],
    ['Citron', 1, 'pièce', 'lg'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Salade verte', 1, 'pièce', 'lg'],
    ['Pommes de terre', 600, 'g', 'lg']
  ],
  etapes: [
    'Cuisez les lentilles 20 min à l\'eau salée, égouttez et laissez tiédir.',
    'Râpez les carottes, hachez l\'oignon. Mélangez avec les lentilles écrasées grossièrement, les œufs, la chapelure et le cumin.',
    'Formez 8 galettes, réservez 15 min au frais pour qu\'elles se tiennent.',
    'Faites cuire les pommes de terre en robe des champs (25 min) ou en cubes au four.',
    'Dorez les galettes 4 min de chaque côté à la poêle dans un filet d\'huile.',
    'Mélangez yaourt, menthe ciselée, jus de citron, sel. Servez avec la salade.'
  ],
  astuce: 'Les galettes se congèlent crues, séparées par du papier cuisson.',
  src: ['amandine', 'galettes lentilles carotte']
},
{
  id: 'tajine-legumes',
  nom: 'Tajine de légumes aux pois chiches et abricots secs',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 50, diff: 'Facile',
  kcal: 520, prot: 17, gluc: 84, lip: 12, fibres: 16,
  saisons: ['automne', 'hiver'],
  tags: ['one pot', 'batch cooking', 'parfumé'],
  allergenes: ['gluten', 'coque'],
  ingredients: [
    ['Pois chiches cuits', 480, 'g', 'ep'],
    ['Courgette', 2, 'pièce', 'lg'],
    ['Carotte', 3, 'pièce', 'lg'],
    ['Navet', 2, 'pièce', 'lg'],
    ['Poivron jaune', 1, 'pièce', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Abricots secs', 100, 'g', 'ep'],
    ['Tomates concassées', 400, 'g', 'ep'],
    ['Ras el-hanout', 2, 'c.à.s', 'es'],
    ['Cannelle', 1, 'c.à.c', 'es'],
    ['Semoule complète', 250, 'g', 'fe'],
    ['Amandes effilées', 40, 'g', 'ep'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Coriandre fraîche', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Faites revenir les oignons émincés 5 min, ajoutez le ras el-hanout et la cannelle.',
    'Ajoutez carottes, navets et poivron en morceaux, mouillez avec les tomates et 300 ml d\'eau.',
    'Laissez mijoter 20 min à couvert, puis ajoutez courgettes, pois chiches et abricots coupés en deux.',
    'Poursuivez 15 min à découvert : la sauce doit être sirupeuse.',
    'Préparez la semoule complète (volume égal d\'eau bouillante, 5 min à couvert, égrainez).',
    'Parsemez d\'amandes torréfiées et de coriandre.'
  ],
  astuce: 'Sans les fruits secs, comptez 80 kcal de moins par personne.',
  src: ['marmiton', 'tajine legumes pois chiches']
},
{
  id: 'risotto-orge',
  nom: 'Risotto d\'orge perlé aux champignons',
  cat: 'Végétarien', legumineuse: false, plaisir: false,
  temps: 45, diff: 'Moyen',
  kcal: 505, prot: 17, gluc: 74, lip: 14, fibres: 11,
  saisons: ['automne', 'hiver'],
  tags: ['réconfortant', 'céréale complète'],
  allergenes: ['gluten', 'lait', 'coque', 'sulfite'],
  ingredients: [
    ['Orge perlé', 300, 'g', 'fe'],
    ['Champignons de Paris', 500, 'g', 'lg'],
    ['Échalote', 2, 'pièce', 'lg'],
    ['Ail', 2, 'gousse', 'lg'],
    ['Bouillon de légumes', 1000, 'ml', 'ep'],
    ['Vin blanc sec', 100, 'ml', 'ep'],
    ['Parmesan', 60, 'g', 'cr'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Persil plat', 0.5, 'botte', 'lg'],
    ['Roquette', 100, 'g', 'lg'],
    ['Noix', 40, 'g', 'ep']
  ],
  etapes: [
    'Émincez les champignons, faites-les sauter à feu vif 6 min sans les remuer sans arrêt pour qu\'ils dorent. Réservez.',
    'Faites suer les échalotes, ajoutez l\'orge perlé et nacrez 2 min.',
    'Déglacez au vin blanc, puis ajoutez le bouillon louche par louche pendant 30 min en remuant.',
    'Incorporez les champignons, le parmesan et le persil hors du feu.',
    'Servez avec la roquette assaisonnée et les noix concassées.'
  ],
  astuce: 'L\'orge perlé remplace le riz arborio : 3 fois plus de fibres, texture identique.',
  src: ['ricardo', 'risotto orge champignons']
},
{
  id: 'lasagnes-veggie',
  nom: 'Lasagnes végétariennes lentilles-courgettes',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 70, diff: 'Moyen',
  kcal: 585, prot: 26, gluc: 66, lip: 21, fibres: 12,
  saisons: ['automne', 'hiver', 'printemps'],
  tags: ['plat familial', 'batch cooking'],
  allergenes: ['gluten', 'lait'],
  ingredients: [
    ['Feuilles de lasagne', 250, 'g', 'fe'],
    ['Lentilles vertes', 200, 'g', 'fe'],
    ['Courgette', 3, 'pièce', 'lg'],
    ['Tomates concassées', 800, 'g', 'ep'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Lait demi-écrémé', 500, 'ml', 'cr'],
    ['Farine', 40, 'g', 'ep'],
    ['Beurre', 30, 'g', 'cr'],
    ['Mozzarella râpée', 125, 'g', 'cr'],
    ['Parmesan', 40, 'g', 'cr'],
    ['Origan séché', 1, 'c.à.c', 'es'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep']
  ],
  etapes: [
    'Cuisez les lentilles 20 min. Faites revenir oignon et ail, ajoutez les tomates, l\'origan puis les lentilles. Mijotez 15 min.',
    'Taillez les courgettes en fines lamelles, poêlez-les 5 min pour évacuer l\'eau.',
    'Préparez la béchamel : beurre + farine, puis le lait froid en fouettant, 5 min jusqu\'à épaississement. Muscade, sel, poivre.',
    'Montez : sauce lentilles, feuilles, courgettes, béchamel — 3 fois.',
    'Terminez par la béchamel, la mozzarella et le parmesan.',
    'Enfournez 35 min à 180 °C, laissez reposer 10 min avant de couper.'
  ],
  astuce: 'Les lentilles remplacent la viande hachée avec autant de protéines et zéro graisse saturée.',
  src: ['g750', 'lasagnes vegetariennes lentilles']
},
{
  id: 'falafels-four',
  nom: 'Falafels au four et taboulé de quinoa',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 45, diff: 'Moyen',
  kcal: 530, prot: 20, gluc: 68, lip: 18, fibres: 15,
  saisons: ['printemps', 'été'],
  tags: ['sans friture', 'lunch box'],
  allergenes: ['sesame'],
  ingredients: [
    ['Pois chiches secs (trempés 12 h)', 300, 'g', 'fe'],
    ['Quinoa', 240, 'g', 'fe'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Persil plat', 1, 'botte', 'lg'],
    ['Coriandre fraîche', 0.5, 'botte', 'lg'],
    ['Cumin moulu', 2, 'c.à.c', 'es'],
    ['Tomate', 3, 'pièce', 'lg'],
    ['Concombre', 1, 'pièce', 'lg'],
    ['Citron', 2, 'pièce', 'lg'],
    ['Tahini (purée de sésame)', 3, 'c.à.s', 'ep'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Menthe fraîche', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Mixez les pois chiches trempés (crus, non cuits) avec oignon, ail, herbes, cumin, sel : la pâte doit rester granuleuse.',
    'Formez 20 boulettes, badigeonnez d\'huile et enfournez 25 min à 200 °C en les retournant à mi-cuisson.',
    'Cuisez le quinoa 12 min, laissez refroidir.',
    'Mélangez le quinoa avec tomates et concombre en dés, herbes ciselées, jus de citron et huile d\'olive.',
    'Sauce : tahini + jus de citron + eau, jusqu\'à consistance de crème.',
    'Servez les falafels sur le taboulé, nappés de sauce.'
  ],
  astuce: 'Impératif : des pois chiches secs trempés, jamais en conserve, sinon la pâte se délite.',
  src: ['marmiton', 'falafel au four']
},
{
  id: 'curry-tofu',
  nom: 'Curry thaï de tofu, brocoli et lait de coco',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 30, diff: 'Facile',
  kcal: 525, prot: 24, gluc: 60, lip: 21, fibres: 9,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['rapide', 'wok'],
  allergenes: ['soja'],
  ingredients: [
    ['Tofu ferme', 400, 'g', 'cr'],
    ['Brocoli', 500, 'g', 'lg'],
    ['Poivron rouge', 1, 'pièce', 'lg'],
    ['Lait de coco', 400, 'ml', 'ep'],
    ['Pâte de curry vert', 2, 'c.à.s', 'es'],
    ['Sauce soja', 3, 'c.à.s', 'ep'],
    ['Gingembre frais', 20, 'g', 'lg'],
    ['Riz thaï complet', 250, 'g', 'fe'],
    ['Citron vert', 1, 'pièce', 'lg'],
    ['Huile de sésame', 1, 'c.à.s', 'ep'],
    ['Basilic frais', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Pressez le tofu 10 min entre deux torchons, coupez-le en cubes et faites-le dorer 8 min au wok. Réservez.',
    'Faites revenir le gingembre et la pâte de curry 1 min, ajoutez le lait de coco.',
    'Ajoutez brocoli et poivron, cuisez 8 min : les légumes doivent rester croquants.',
    'Remettez le tofu, ajoutez la sauce soja et le jus de citron vert.',
    'Servez sur le riz thaï complet avec le basilic.'
  ],
  astuce: 'Tofu bien pressé = tofu qui dore. C\'est toute la différence.',
  src: ['hellofresh', 'curry vert tofu']
},
{
  id: 'soupe-pois-casses',
  nom: 'Soupe de pois cassés au cumin et croûtons complets',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 50, diff: 'Facile',
  kcal: 425, prot: 22, gluc: 62, lip: 9, fibres: 18,
  saisons: ['automne', 'hiver'],
  tags: ['soupe repas', 'très économique', 'batch cooking'],
  allergenes: ['gluten'],
  ingredients: [
    ['Pois cassés', 350, 'g', 'fe'],
    ['Carotte', 3, 'pièce', 'lg'],
    ['Poireau', 2, 'pièce', 'lg'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Ail', 2, 'gousse', 'lg'],
    ['Cumin moulu', 2, 'c.à.c', 'es'],
    ['Bouillon de légumes', 1500, 'ml', 'ep'],
    ['Pain complet', 4, 'tranche', 'bl'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Yaourt grec', 200, 'g', 'cr'],
    ['Persil plat', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Rincez les pois cassés. Faites revenir oignon, carottes et poireaux 8 min.',
    'Ajoutez les pois cassés, le cumin, l\'ail et le bouillon. Cuisez 35 min à couvert.',
    'Mixez la moitié de la soupe pour garder de la texture.',
    'Toastez le pain complet coupé en dés avec un filet d\'huile, 8 min à 200 °C.',
    'Servez avec une cuillère de yaourt grec, les croûtons et le persil.'
  ],
  astuce: '18 g de fibres par portion : la soupe la plus rassasiante de la liste.',
  src: ['marmiton', 'soupe pois casses']
},
{
  id: 'haricots-blancs-tomate',
  nom: 'Haricots blancs à la tomate et au romarin, œuf poché',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 30, diff: 'Facile',
  kcal: 460, prot: 24, gluc: 55, lip: 15, fibres: 16,
  saisons: ['automne', 'hiver'],
  tags: ['rapide', 'économique', 'one pot'],
  allergenes: ['oeuf', 'gluten'],
  ingredients: [
    ['Haricots blancs cuits', 600, 'g', 'ep'],
    ['Tomates concassées', 600, 'g', 'ep'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Romarin frais', 2, 'brin', 'lg'],
    ['Œuf', 4, 'pièce', 'cr'],
    ['Épinards frais', 150, 'g', 'lg'],
    ['Pain complet', 4, 'tranche', 'bl'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Vinaigre blanc', 1, 'c.à.s', 'ep'],
    ['Parmesan', 30, 'g', 'cr']
  ],
  etapes: [
    'Faites revenir oignon et ail 5 min avec le romarin.',
    'Ajoutez les tomates et les haricots égouttés, laissez mijoter 15 min à feu doux.',
    'Incorporez les épinards en fin de cuisson.',
    'Pochez les œufs 3 min dans une eau frémissante vinaigrée.',
    'Servez les haricots avec l\'œuf poché dessus, un peu de parmesan et une tranche de pain grillé.'
  ],
  astuce: 'Le dîner de secours par excellence : 30 min, ingrédients de placard.',
  src: ['ricardo', 'haricots blancs tomate romarin']
},

/* ---------------------------------------------------------------
   POISSON & FRUITS DE MER
   --------------------------------------------------------------- */
{
  id: 'saumon-miso',
  nom: 'Saumon rôti au miso, brocolis et riz complet',
  cat: 'Poisson', poissonGras: true, plaisir: false,
  temps: 30, diff: 'Facile',
  kcal: 565, prot: 38, gluc: 55, lip: 21, fibres: 8,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['oméga-3', 'rapide', 'four'],
  allergenes: ['poisson', 'soja', 'sesame'],
  ingredients: [
    ['Pavé de saumon', 4, 'pièce', 'po'],
    ['Brocoli', 600, 'g', 'lg'],
    ['Riz complet', 250, 'g', 'fe'],
    ['Pâte de miso', 2, 'c.à.s', 'ep'],
    ['Sauce soja', 2, 'c.à.s', 'ep'],
    ['Miel', 1, 'c.à.s', 'ep'],
    ['Gingembre frais', 15, 'g', 'lg'],
    ['Ail', 2, 'gousse', 'lg'],
    ['Huile de sésame', 1, 'c.à.s', 'ep'],
    ['Graines de sésame', 2, 'c.à.s', 'ep'],
    ['Citron vert', 1, 'pièce', 'lg']
  ],
  etapes: [
    'Mélangez miso, sauce soja, miel, gingembre râpé et ail pressé.',
    'Badigeonnez les pavés de saumon et laissez mariner 10 min.',
    'Enfournez 12 à 14 min à 200 °C, peau vers le bas.',
    'Faites cuire le riz complet et le brocoli à la vapeur (8 min, il doit rester ferme).',
    'Servez avec les graines de sésame et un trait de citron vert.'
  ],
  astuce: 'Le poisson gras 1 fois par semaine couvre l\'essentiel des besoins en oméga-3 (repère PNNS).',
  src: ['ricardo', 'saumon miso erable']
},
{
  id: 'papillote-cabillaud',
  nom: 'Papillote de cabillaud citron-fenouil et pommes de terre',
  cat: 'Poisson', poissonGras: false, plaisir: false,
  temps: 40, diff: 'Facile',
  kcal: 425, prot: 36, gluc: 46, lip: 10, fibres: 8,
  saisons: ['automne', 'hiver', 'printemps'],
  tags: ['light', 'four', 'sans gluten'],
  allergenes: ['poisson'],
  ingredients: [
    ['Dos de cabillaud', 600, 'g', 'po'],
    ['Fenouil', 2, 'pièce', 'lg'],
    ['Pommes de terre', 800, 'g', 'lg'],
    ['Citron', 2, 'pièce', 'lg'],
    ['Tomate cerise', 250, 'g', 'lg'],
    ['Échalote', 2, 'pièce', 'lg'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Thym frais', 4, 'brin', 'lg'],
    ['Olives noires', 60, 'g', 'ep']
  ],
  etapes: [
    'Préchauffez le four à 200 °C. Coupez les pommes de terre en rondelles fines, précuisez-les 8 min à l\'eau.',
    'Émincez le fenouil finement, les échalotes en lamelles.',
    'Sur 4 feuilles de papier cuisson : pommes de terre, fenouil, un morceau de cabillaud, tomates cerises, olives, rondelles de citron, thym.',
    'Arrosez d\'huile d\'olive, salez, poivrez et fermez hermétiquement les papillotes.',
    'Enfournez 20 min. Ouvrez à table : le parfum fait tout le travail.'
  ],
  astuce: 'Zéro vaisselle et cuisson à la vapeur douce : la texture du poisson reste nacrée.',
  src: ['marmiton', 'papillote cabillaud fenouil']
},
{
  id: 'poke-saumon',
  nom: 'Poke bowl saumon, avocat et concombre',
  cat: 'Poisson', poissonGras: true, plaisir: false,
  temps: 25, diff: 'Facile',
  kcal: 590, prot: 33, gluc: 62, lip: 23, fibres: 8,
  saisons: ['printemps', 'été'],
  tags: ['sans cuisson', 'oméga-3', 'frais'],
  allergenes: ['poisson', 'soja', 'sesame'],
  ingredients: [
    ['Saumon très frais (qualité sashimi)', 500, 'g', 'po'],
    ['Riz à sushi', 300, 'g', 'fe'],
    ['Avocat', 2, 'pièce', 'lg'],
    ['Concombre', 1, 'pièce', 'lg'],
    ['Carotte', 2, 'pièce', 'lg'],
    ['Edamame', 200, 'g', 'sg'],
    ['Sauce soja', 4, 'c.à.s', 'ep'],
    ['Huile de sésame', 1, 'c.à.s', 'ep'],
    ['Vinaigre de riz', 3, 'c.à.s', 'ep'],
    ['Graines de sésame', 2, 'c.à.s', 'ep'],
    ['Citron vert', 1, 'pièce', 'lg'],
    ['Oignon nouveau', 2, 'pièce', 'lg']
  ],
  etapes: [
    'Cuisez le riz, assaisonnez-le tiède avec le vinaigre de riz et une pincée de sucre et de sel.',
    'Coupez le saumon en cubes de 2 cm, faites-le mariner 10 min dans sauce soja + huile de sésame + jus de citron vert.',
    'Taillez concombre et carottes en fines lamelles, l\'avocat en tranches.',
    'Faites cuire les edamame 4 min à l\'eau bouillante salée.',
    'Composez les bols et parsemez de sésame et d\'oignon nouveau.'
  ],
  astuce: 'Saumon cru : achetez-le le jour même chez le poissonnier, ou passez-le 24 h au congélateur avant.',
  src: ['g750', 'poke bowl saumon']
},
{
  id: 'curry-crevettes',
  nom: 'Curry de crevettes au lait de coco',
  cat: 'Poisson', poissonGras: false, plaisir: false,
  temps: 30, diff: 'Facile',
  kcal: 545, prot: 32, gluc: 62, lip: 18, fibres: 6,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['rapide', 'parfumé'],
  allergenes: ['crustace'],
  ingredients: [
    ['Crevettes décortiquées', 600, 'g', 'po'],
    ['Lait de coco', 400, 'ml', 'ep'],
    ['Poivron rouge', 2, 'pièce', 'lg'],
    ['Courgette', 1, 'pièce', 'lg'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Gingembre frais', 20, 'g', 'lg'],
    ['Pâte de curry rouge', 2, 'c.à.s', 'es'],
    ['Riz basmati', 250, 'g', 'fe'],
    ['Citron vert', 1, 'pièce', 'lg'],
    ['Coriandre fraîche', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Faites revenir oignon, ail et gingembre 4 min, ajoutez la pâte de curry.',
    'Versez le lait de coco, ajoutez poivrons et courgette en lanières, mijotez 10 min.',
    'Ajoutez les crevettes et cuisez 4 min seulement : au-delà elles deviennent caoutchouteuses.',
    'Finissez avec le jus de citron vert et la coriandre.',
    'Servez avec le riz basmati.'
  ],
  astuce: 'Crevettes crues plutôt que cuites : elles restent moelleuses.',
  src: ['marmiton', 'curry crevettes lait de coco']
},
{
  id: 'maquereau-lentilles',
  nom: 'Maquereaux grillés et salade de lentilles vertes',
  cat: 'Poisson', poissonGras: true, legumineuse: true, plaisir: false,
  temps: 35, diff: 'Facile',
  kcal: 555, prot: 38, gluc: 45, lip: 24, fibres: 12,
  saisons: ['printemps', 'été', 'automne'],
  tags: ['oméga-3', 'économique', 'sans gluten'],
  allergenes: ['poisson', 'moutarde'],
  ingredients: [
    ['Filets de maquereau', 8, 'pièce', 'po'],
    ['Lentilles vertes', 300, 'g', 'fe'],
    ['Carotte', 2, 'pièce', 'lg'],
    ['Échalote', 2, 'pièce', 'lg'],
    ['Persil plat', 1, 'botte', 'lg'],
    ['Moutarde à l\'ancienne', 1, 'c.à.s', 'ep'],
    ['Vinaigre de cidre', 2, 'c.à.s', 'ep'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Citron', 1, 'pièce', 'lg'],
    ['Feuille de laurier', 1, 'pièce', 'es']
  ],
  etapes: [
    'Cuisez les lentilles 20 min avec une carotte entière et le laurier, dans une eau non salée (salez en fin de cuisson).',
    'Préparez la vinaigrette : moutarde, vinaigre de cidre, huile d\'olive, échalote ciselée.',
    'Égouttez les lentilles encore tièdes et mélangez-les à la vinaigrette avec la seconde carotte râpée et le persil.',
    'Grillez les filets de maquereau 3 min côté peau, 1 min de l\'autre côté.',
    'Servez avec un quartier de citron.'
  ],
  astuce: 'Le maquereau est le poisson gras le moins cher et l\'un des plus riches en oméga-3.',
  src: ['g750', 'maquereau salade lentilles']
},
{
  id: 'pates-thon',
  nom: 'Pâtes complètes au thon, câpres et tomates cerises',
  cat: 'Poisson', poissonGras: false, plaisir: false,
  temps: 25, diff: 'Facile',
  kcal: 540, prot: 31, gluc: 72, lip: 14, fibres: 10,
  saisons: ['printemps', 'été'],
  tags: ['rapide', 'placard', 'économique'],
  allergenes: ['poisson', 'gluten'],
  ingredients: [
    ['Pâtes complètes', 400, 'g', 'fe'],
    ['Thon au naturel', 320, 'g', 'ep'],
    ['Tomate cerise', 400, 'g', 'lg'],
    ['Câpres', 2, 'c.à.s', 'ep'],
    ['Olives noires', 60, 'g', 'ep'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Roquette', 100, 'g', 'lg'],
    ['Citron', 1, 'pièce', 'lg'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Piment d\'Espelette', 0.5, 'c.à.c', 'es'],
    ['Basilic frais', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Faites cuire les pâtes complètes al dente, réservez une louche d\'eau de cuisson.',
    'Pendant ce temps, faites éclater les tomates cerises coupées en deux 5 min à la poêle avec l\'ail et l\'huile.',
    'Ajoutez le thon égoutté et émietté, les câpres et les olives, réchauffez 2 min.',
    'Mélangez avec les pâtes et un peu d\'eau de cuisson pour lier.',
    'Hors du feu : roquette, zeste et jus de citron, basilic, piment d\'Espelette.'
  ],
  astuce: 'L\'eau de cuisson des pâtes est le meilleur liant : jamais de crème.',
  src: ['marmiton', 'pates thon tomates cerises capres']
},
{
  id: 'cabillaud-pane',
  nom: 'Cabillaud pané aux herbes au four et purée de petits pois',
  cat: 'Poisson', poissonGras: false, plaisir: false,
  temps: 35, diff: 'Facile',
  kcal: 480, prot: 38, gluc: 48, lip: 13, fibres: 10,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['les enfants adorent', 'sans friture'],
  allergenes: ['poisson', 'gluten', 'oeuf', 'lait'],
  ingredients: [
    ['Dos de cabillaud', 600, 'g', 'po'],
    ['Chapelure', 100, 'g', 'ep'],
    ['Parmesan', 40, 'g', 'cr'],
    ['Persil plat', 0.5, 'botte', 'lg'],
    ['Œuf', 2, 'pièce', 'cr'],
    ['Farine', 40, 'g', 'ep'],
    ['Petits pois surgelés', 600, 'g', 'sg'],
    ['Pommes de terre', 400, 'g', 'lg'],
    ['Menthe fraîche', 0.5, 'botte', 'lg'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Citron', 1, 'pièce', 'lg']
  ],
  etapes: [
    'Mélangez chapelure, parmesan, persil haché, sel et poivre.',
    'Passez les morceaux de cabillaud dans la farine, l\'œuf battu puis la chapelure.',
    'Déposez sur une plaque, arrosez d\'un filet d\'huile et enfournez 18 min à 200 °C.',
    'Cuisez pommes de terre et petits pois 12 min à l\'eau, écrasez avec un peu d\'huile d\'olive et la menthe.',
    'Servez avec un quartier de citron.'
  ],
  astuce: 'Version maison des « fish sticks » : même plaisir, moitié moins de matières grasses.',
  src: ['ricardo', 'cabillaud pane four']
},
{
  id: 'sardines-ratatouille',
  nom: 'Sardines grillées, ratatouille et semoule complète',
  cat: 'Poisson', poissonGras: true, plaisir: false,
  temps: 50, diff: 'Facile',
  kcal: 545, prot: 33, gluc: 60, lip: 20, fibres: 12,
  saisons: ['été'],
  tags: ['oméga-3', 'économique', 'plancha'],
  allergenes: ['poisson', 'gluten'],
  ingredients: [
    ['Sardines fraîches', 12, 'pièce', 'po'],
    ['Aubergine', 2, 'pièce', 'lg'],
    ['Courgette', 2, 'pièce', 'lg'],
    ['Poivron rouge', 2, 'pièce', 'lg'],
    ['Tomate', 4, 'pièce', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Herbes de Provence', 2, 'c.à.c', 'es'],
    ['Semoule complète', 250, 'g', 'fe'],
    ['Huile d\'olive', 4, 'c.à.s', 'ep'],
    ['Citron', 2, 'pièce', 'lg']
  ],
  etapes: [
    'Coupez tous les légumes en cubes. Faites revenir séparément aubergine et courgette pour qu\'elles dorent sans rendre trop d\'eau.',
    'Faites suer oignons et poivrons, ajoutez les tomates et l\'ail, puis les autres légumes.',
    'Ajoutez les herbes, laissez mijoter 25 min à découvert.',
    'Grillez les sardines 3 min de chaque côté à feu vif.',
    'Préparez la semoule complète et servez le tout avec du citron.'
  ],
  astuce: 'La ratatouille est encore meilleure réchauffée : préparez-la la veille.',
  src: ['marmiton', 'sardines grillees ratatouille']
},
{
  id: 'wok-crevettes-soba',
  nom: 'Wok de crevettes, nouilles soba et légumes croquants',
  cat: 'Poisson', poissonGras: false, plaisir: false,
  temps: 25, diff: 'Facile',
  kcal: 510, prot: 33, gluc: 68, lip: 11, fibres: 8,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['rapide', 'wok'],
  allergenes: ['crustace', 'gluten', 'soja', 'sesame'],
  ingredients: [
    ['Crevettes décortiquées', 500, 'g', 'po'],
    ['Nouilles soba', 300, 'g', 'fe'],
    ['Pak choï (ou chou chinois)', 400, 'g', 'lg'],
    ['Carotte', 2, 'pièce', 'lg'],
    ['Poivron rouge', 1, 'pièce', 'lg'],
    ['Oignon nouveau', 3, 'pièce', 'lg'],
    ['Sauce soja', 4, 'c.à.s', 'ep'],
    ['Gingembre frais', 20, 'g', 'lg'],
    ['Ail', 2, 'gousse', 'lg'],
    ['Huile de sésame', 1, 'c.à.s', 'ep'],
    ['Graines de sésame', 2, 'c.à.s', 'ep'],
    ['Citron vert', 1, 'pièce', 'lg']
  ],
  etapes: [
    'Cuisez les nouilles soba 4 min, rincez-les à l\'eau froide pour stopper la cuisson.',
    'Taillez tous les légumes en fines lanières (mandoline ou couteau).',
    'Au wok très chaud : gingembre, ail, puis carottes et poivron 3 min.',
    'Ajoutez les crevettes 3 min, puis le pak choï 2 min.',
    'Ajoutez les nouilles, la sauce soja et l\'huile de sésame, sautez 2 min.',
    'Servez avec sésame, oignon nouveau et citron vert.'
  ],
  astuce: 'Tout doit être coupé avant d\'allumer le feu : un wok se cuisine en 8 minutes chrono.',
  src: ['hellofresh', 'wok crevettes nouilles']
},
{
  id: 'truite-aneth',
  nom: 'Truite au four à l\'aneth, épinards et pommes grenaille',
  cat: 'Poisson', poissonGras: true, plaisir: false,
  temps: 40, diff: 'Facile',
  kcal: 535, prot: 37, gluc: 45, lip: 21, fibres: 7,
  saisons: ['printemps', 'automne', 'hiver'],
  tags: ['oméga-3', 'four', 'sans gluten'],
  allergenes: ['poisson', 'lait'],
  ingredients: [
    ['Filets de truite', 600, 'g', 'po'],
    ['Pommes de terre grenaille', 800, 'g', 'lg'],
    ['Épinards frais', 400, 'g', 'lg'],
    ['Aneth', 1, 'botte', 'lg'],
    ['Citron', 2, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Yaourt grec', 200, 'g', 'cr'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Moutarde', 1, 'c.à.c', 'ep']
  ],
  etapes: [
    'Coupez les grenailles en deux, mélangez-les à l\'huile, sel, poivre, et enfournez 30 min à 200 °C.',
    'Déposez les filets de truite sur la plaque à mi-cuisson (12 min suffisent) avec des rondelles de citron.',
    'Faites tomber les épinards 3 min à la poêle avec l\'ail.',
    'Mélangez yaourt grec, aneth ciselé, jus de citron et moutarde pour la sauce.',
    'Servez la truite avec les grenailles, les épinards et la sauce à l\'aneth.'
  ],
  astuce: 'La truite d\'élevage française est une alternative locale et moins chère au saumon.',
  src: ['ricardo', 'truite four aneth']
},
{
  id: 'colin-sauce-vierge',
  nom: 'Filet de colin sauce vierge, quinoa et courgettes',
  cat: 'Poisson', poissonGras: false, plaisir: false,
  temps: 30, diff: 'Facile',
  kcal: 455, prot: 36, gluc: 44, lip: 14, fibres: 8,
  saisons: ['printemps', 'été'],
  tags: ['light', 'sans gluten', 'rapide'],
  allergenes: ['poisson'],
  ingredients: [
    ['Filet de colin', 600, 'g', 'po'],
    ['Quinoa', 240, 'g', 'fe'],
    ['Courgette', 3, 'pièce', 'lg'],
    ['Tomate', 3, 'pièce', 'lg'],
    ['Échalote', 1, 'pièce', 'lg'],
    ['Basilic frais', 0.5, 'botte', 'lg'],
    ['Ciboulette', 0.5, 'botte', 'lg'],
    ['Citron', 1, 'pièce', 'lg'],
    ['Huile d\'olive', 4, 'c.à.s', 'ep'],
    ['Coriandre en grains', 1, 'c.à.c', 'es']
  ],
  etapes: [
    'Préparez la sauce vierge : tomates mondées en petits dés, échalote ciselée, herbes, jus de citron, huile d\'olive, coriandre concassée. Laissez infuser à température ambiante.',
    'Cuisez le quinoa 12 min.',
    'Taillez les courgettes en rubans et poêlez-les 5 min à feu vif.',
    'Cuisez le colin 4 min de chaque côté à la poêle antiadhésive, ou 10 min vapeur.',
    'Nappez le poisson de sauce vierge au moment de servir (jamais chauffée).'
  ],
  astuce: 'La sauce vierge remplace le beurre blanc : 3 fois moins de lipides, plus de fraîcheur.',
  src: ['g750', 'colin sauce vierge']
},

/* ---------------------------------------------------------------
   VOLAILLE
   --------------------------------------------------------------- */
{
  id: 'poulet-roti-legumes',
  nom: 'Poulet rôti citron-herbes et légumes racines au four',
  cat: 'Volaille', plaisir: false,
  temps: 80, diff: 'Facile',
  kcal: 575, prot: 42, gluc: 52, lip: 20, fibres: 9,
  saisons: ['automne', 'hiver'],
  tags: ['plat familial', 'dimanche', 'sans gluten'],
  allergenes: [],
  ingredients: [
    ['Poulet fermier entier', 1400, 'g', 'bo'],
    ['Pommes de terre', 600, 'g', 'lg'],
    ['Carotte', 4, 'pièce', 'lg'],
    ['Panais', 2, 'pièce', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Citron', 2, 'pièce', 'lg'],
    ['Ail', 6, 'gousse', 'lg'],
    ['Thym frais', 4, 'brin', 'lg'],
    ['Romarin frais', 2, 'brin', 'lg'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep']
  ],
  etapes: [
    'Préchauffez à 200 °C. Glissez un citron piqué et des herbes dans le poulet.',
    'Coupez tous les légumes en gros morceaux, disposez-les autour du poulet dans un grand plat.',
    'Arrosez d\'huile d\'olive, salez, poivrez, ajoutez les gousses d\'ail en chemise.',
    'Enfournez 1 h 10 en arrosant 2 ou 3 fois avec le jus de cuisson.',
    'Laissez reposer 10 min avant de découper : la chair reste juteuse.'
  ],
  astuce: 'Gardez la carcasse : un bouillon maison de 2 h vaut tous les cubes du commerce.',
  src: ['marmiton', 'poulet roti citron herbes']
},
{
  id: 'poulet-curry-basmati',
  nom: 'Émincé de poulet au curry et riz basmati',
  cat: 'Volaille', plaisir: false,
  temps: 30, diff: 'Facile',
  kcal: 545, prot: 40, gluc: 62, lip: 15, fibres: 6,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['rapide', 'les enfants adorent'],
  allergenes: ['lait'],
  ingredients: [
    ['Blanc de poulet', 600, 'g', 'bo'],
    ['Riz basmati', 250, 'g', 'fe'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Poivron jaune', 1, 'pièce', 'lg'],
    ['Courgette', 1, 'pièce', 'lg'],
    ['Curry en poudre', 2, 'c.à.s', 'es'],
    ['Lait de coco allégé', 250, 'ml', 'ep'],
    ['Yaourt grec', 150, 'g', 'cr'],
    ['Ail', 2, 'gousse', 'lg'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Coriandre fraîche', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Coupez le poulet en lanières, saisissez-les 5 min à feu vif. Réservez.',
    'Faites revenir oignons, poivron et courgette 6 min, ajoutez l\'ail et le curry.',
    'Versez le lait de coco, remettez le poulet et laissez mijoter 8 min.',
    'Hors du feu, ajoutez le yaourt grec pour lier la sauce (elle ne doit plus bouillir).',
    'Servez avec le riz basmati et la coriandre.'
  ],
  astuce: 'Le yaourt hors du feu remplace la crème : -100 kcal par portion.',
  src: ['marmiton', 'poulet au curry riz basmati']
},
{
  id: 'blanquette-dinde',
  nom: 'Blanquette de dinde légère aux champignons',
  cat: 'Volaille', plaisir: false,
  temps: 55, diff: 'Moyen',
  kcal: 530, prot: 42, gluc: 55, lip: 14, fibres: 7,
  saisons: ['automne', 'hiver'],
  tags: ['réconfortant', 'plat familial'],
  allergenes: ['lait', 'gluten', 'celeri'],
  ingredients: [
    ['Escalope de dinde', 700, 'g', 'bo'],
    ['Champignons de Paris', 400, 'g', 'lg'],
    ['Carotte', 4, 'pièce', 'lg'],
    ['Poireau', 1, 'pièce', 'lg'],
    ['Céleri branche', 1, 'pièce', 'lg'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Bouillon de volaille', 800, 'ml', 'ep'],
    ['Farine', 30, 'g', 'ep'],
    ['Crème légère 15%', 150, 'ml', 'cr'],
    ['Riz complet', 250, 'g', 'fe'],
    ['Citron', 1, 'pièce', 'lg'],
    ['Feuille de laurier', 1, 'pièce', 'es'],
    ['Persil plat', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Coupez la dinde en cubes, faites-la blanchir 3 min dans le bouillon frémissant avec laurier, carottes, poireau et céleri.',
    'Laissez cuire 25 min à feu doux, puis retirez la viande et les légumes.',
    'Faites un roux léger (farine + 2 c.à.s de bouillon), délayez avec 600 ml de bouillon, laissez épaissir 5 min.',
    'Poêlez les champignons émincés à part pour qu\'ils dorent, ajoutez-les à la sauce.',
    'Hors du feu : crème légère, jus de citron, persil. Remettez viande et légumes.',
    'Servez avec le riz complet.'
  ],
  astuce: 'La crème à 15 % suffit largement, la sauce est déjà liée par le roux.',
  src: ['g750', 'blanquette dinde legere']
},
{
  id: 'poulet-basquaise',
  nom: 'Poulet basquaise et riz complet',
  cat: 'Volaille', plaisir: false,
  temps: 55, diff: 'Facile',
  kcal: 560, prot: 41, gluc: 60, lip: 16, fibres: 9,
  saisons: ['été', 'automne'],
  tags: ['one pot', 'batch cooking', 'sans gluten'],
  allergenes: ['sulfite'],
  ingredients: [
    ['Cuisse de poulet', 4, 'pièce', 'bo'],
    ['Poivron rouge', 2, 'pièce', 'lg'],
    ['Poivron vert', 2, 'pièce', 'lg'],
    ['Tomate', 6, 'pièce', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Piment d\'Espelette', 1, 'c.à.c', 'es'],
    ['Thym frais', 3, 'brin', 'lg'],
    ['Riz complet', 250, 'g', 'fe'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Vin blanc sec', 100, 'ml', 'ep']
  ],
  etapes: [
    'Retirez la peau des cuisses (l\'essentiel du gras y est) et faites-les dorer 6 min dans la cocotte.',
    'Ajoutez oignons et poivrons en lanières, laissez fondre 10 min.',
    'Déglacez au vin blanc, ajoutez tomates concassées, ail, thym et piment d\'Espelette.',
    'Couvrez et laissez mijoter 30 min à feu doux.',
    'Servez avec le riz complet.'
  ],
  astuce: 'Retirer la peau du poulet fait économiser environ 90 kcal par portion.',
  src: ['marmiton', 'poulet basquaise']
},
{
  id: 'brochettes-poulet-yaourt',
  nom: 'Brochettes de poulet mariné yaourt-curcuma et boulgour',
  cat: 'Volaille', plaisir: false,
  temps: 35, diff: 'Facile',
  kcal: 520, prot: 44, gluc: 58, lip: 11, fibres: 9,
  saisons: ['printemps', 'été'],
  tags: ['barbecue', 'marinade', 'lunch box'],
  allergenes: ['lait', 'gluten'],
  ingredients: [
    ['Blanc de poulet', 700, 'g', 'bo'],
    ['Yaourt nature', 250, 'g', 'cr'],
    ['Curcuma', 2, 'c.à.c', 'es'],
    ['Paprika', 1, 'c.à.c', 'es'],
    ['Cumin moulu', 1, 'c.à.c', 'es'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Citron', 2, 'pièce', 'lg'],
    ['Boulgour', 250, 'g', 'fe'],
    ['Poivron rouge', 2, 'pièce', 'lg'],
    ['Courgette', 1, 'pièce', 'lg'],
    ['Oignon rouge', 1, 'pièce', 'lg'],
    ['Menthe fraîche', 0.5, 'botte', 'lg'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep']
  ],
  etapes: [
    'Mélangez yaourt, épices, ail pressé, jus d\'un citron. Faites mariner le poulet en cubes 30 min minimum (idéalement 4 h).',
    'Montez les brochettes en alternant poulet, poivron, courgette et oignon rouge.',
    'Cuisez 12 min au four à 220 °C (ou 10 min au barbecue), en retournant à mi-cuisson.',
    'Faites gonfler le boulgour dans un volume et demi d\'eau bouillante, 10 min à couvert.',
    'Mélangez le boulgour avec la menthe, l\'huile d\'olive et le jus du second citron.'
  ],
  astuce: 'La marinade au yaourt attendrit la viande grâce à son acidité — sans ajouter de gras.',
  src: ['ricardo', 'brochettes poulet yaourt curcuma']
},
{
  id: 'wok-poulet-brocoli',
  nom: 'Wok de poulet, brocoli et sauce soja-gingembre',
  cat: 'Volaille', plaisir: false,
  temps: 25, diff: 'Facile',
  kcal: 510, prot: 42, gluc: 58, lip: 12, fibres: 8,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['rapide', 'wok'],
  allergenes: ['soja', 'sesame', 'gluten'],
  ingredients: [
    ['Blanc de poulet', 600, 'g', 'bo'],
    ['Brocoli', 500, 'g', 'lg'],
    ['Carotte', 2, 'pièce', 'lg'],
    ['Oignon nouveau', 3, 'pièce', 'lg'],
    ['Riz complet', 250, 'g', 'fe'],
    ['Sauce soja', 4, 'c.à.s', 'ep'],
    ['Gingembre frais', 25, 'g', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Miel', 1, 'c.à.s', 'ep'],
    ['Huile de sésame', 1, 'c.à.s', 'ep'],
    ['Graines de sésame', 2, 'c.à.s', 'ep'],
    ['Maïzena', 1, 'c.à.c', 'ep']
  ],
  etapes: [
    'Cuisez le riz complet. Détaillez le poulet en lanières fines.',
    'Mélangez sauce soja, miel, gingembre râpé, ail et maïzena avec 5 c.à.s d\'eau.',
    'Saisissez le poulet 5 min au wok très chaud, réservez.',
    'Sautez brocoli et carottes 5 min avec 2 c.à.s d\'eau pour créer de la vapeur.',
    'Remettez le poulet, versez la sauce, laissez épaissir 2 min.',
    'Servez sur le riz avec sésame et oignon nouveau.'
  ],
  astuce: 'La maïzena dans la marinade (technique du « velveting ») garde le poulet tendre.',
  src: ['hellofresh', 'wok poulet brocoli soja']
},
{
  id: 'chili-dinde',
  nom: 'Chili de dinde hachée aux haricots noirs',
  cat: 'Volaille', legumineuse: true, plaisir: false,
  temps: 40, diff: 'Facile',
  kcal: 505, prot: 38, gluc: 60, lip: 11, fibres: 14,
  saisons: ['automne', 'hiver'],
  tags: ['one pot', 'batch cooking', 'riche en protéines'],
  allergenes: [],
  ingredients: [
    ['Dinde hachée', 500, 'g', 'bo'],
    ['Haricots noirs cuits', 400, 'g', 'ep'],
    ['Tomates concassées', 800, 'g', 'ep'],
    ['Poivron rouge', 2, 'pièce', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Maïs doux', 150, 'g', 'ep'],
    ['Cumin moulu', 2, 'c.à.c', 'es'],
    ['Paprika fumé', 2, 'c.à.c', 'es'],
    ['Riz complet', 250, 'g', 'fe'],
    ['Citron vert', 1, 'pièce', 'lg'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Coriandre fraîche', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Faites dorer la dinde hachée 6 min en l\'émiettant.',
    'Ajoutez oignons, poivrons, ail et épices, poursuivez 6 min.',
    'Versez les tomates, laissez mijoter 20 min.',
    'Ajoutez haricots noirs et maïs, réchauffez 5 min.',
    'Servez sur le riz avec coriandre et jus de citron vert.'
  ],
  astuce: 'La dinde hachée contient 3 fois moins de lipides que le bœuf 15 % MG.',
  src: ['ricardo', 'chili dinde hachee']
},
{
  id: 'cesar-poulet',
  nom: 'Salade César revisitée au poulet grillé',
  cat: 'Volaille', plaisir: false,
  temps: 30, diff: 'Facile',
  kcal: 465, prot: 41, gluc: 34, lip: 18, fibres: 6,
  saisons: ['printemps', 'été'],
  tags: ['light', 'rapide', 'salade repas'],
  allergenes: ['lait', 'gluten', 'oeuf', 'poisson', 'moutarde'],
  ingredients: [
    ['Blanc de poulet', 600, 'g', 'bo'],
    ['Laitue romaine', 2, 'pièce', 'lg'],
    ['Pain complet', 4, 'tranche', 'bl'],
    ['Parmesan', 60, 'g', 'cr'],
    ['Yaourt grec', 200, 'g', 'cr'],
    ['Filet d\'anchois', 3, 'pièce', 'ep'],
    ['Moutarde', 1, 'c.à.c', 'ep'],
    ['Ail', 1, 'gousse', 'lg'],
    ['Citron', 1, 'pièce', 'lg'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Tomate cerise', 200, 'g', 'lg']
  ],
  etapes: [
    'Sauce : mixez yaourt grec, anchois, ail, moutarde, jus de citron, la moitié du parmesan et 1 c.à.s d\'huile.',
    'Grillez le poulet assaisonné 6 min de chaque côté, laissez reposer puis émincez.',
    'Toastez le pain complet en dés au four, 8 min à 200 °C avec un filet d\'huile.',
    'Mélangez la romaine coupée, les tomates cerises et la sauce.',
    'Ajoutez le poulet, les croûtons et les copeaux de parmesan restants.'
  ],
  astuce: 'La César classique est à base de mayonnaise : la version yaourt divise les lipides par trois.',
  src: ['g750', 'salade cesar legere yaourt']
},
{
  id: 'curry-vert-poulet',
  nom: 'Curry vert de poulet à la thaïe',
  cat: 'Volaille', plaisir: false,
  temps: 35, diff: 'Facile',
  kcal: 570, prot: 39, gluc: 60, lip: 20, fibres: 7,
  saisons: ['automne', 'hiver'],
  tags: ['parfumé', 'one pot'],
  allergenes: ['poisson', 'crustace'],
  ingredients: [
    ['Blanc de poulet', 600, 'g', 'bo'],
    ['Pâte de curry vert', 2, 'c.à.s', 'es'],
    ['Lait de coco', 400, 'ml', 'ep'],
    ['Haricots verts', 300, 'g', 'lg'],
    ['Aubergine', 1, 'pièce', 'lg'],
    ['Poivron rouge', 1, 'pièce', 'lg'],
    ['Sauce nuoc-mâm', 2, 'c.à.s', 'ep'],
    ['Riz thaï complet', 250, 'g', 'fe'],
    ['Citron vert', 2, 'pièce', 'lg'],
    ['Basilic frais', 0.5, 'botte', 'lg'],
    ['Huile d\'olive', 1, 'c.à.s', 'ep']
  ],
  etapes: [
    'Faites chauffer la pâte de curry 1 min avec l\'huile, puis ajoutez la moitié du lait de coco.',
    'Ajoutez le poulet en lanières, cuisez 5 min.',
    'Ajoutez le reste du lait de coco, l\'aubergine en cubes, les haricots verts et le poivron.',
    'Laissez mijoter 15 min, assaisonnez au nuoc-mâm et au jus de citron vert.',
    'Servez sur le riz avec le basilic.'
  ],
  astuce: 'Sans nuoc-mâm (poisson) : remplacez par 1 c.à.s de sauce soja + une pincée de sel.',
  src: ['marmiton', 'curry vert poulet thai']
},
{
  id: 'tikka-masala',
  nom: 'Poulet tikka masala allégé au yaourt',
  cat: 'Volaille', plaisir: false,
  temps: 45, diff: 'Moyen',
  kcal: 555, prot: 44, gluc: 58, lip: 16, fibres: 6,
  saisons: ['automne', 'hiver'],
  tags: ['parfumé', 'plat familial'],
  allergenes: ['lait'],
  ingredients: [
    ['Blanc de poulet', 700, 'g', 'bo'],
    ['Yaourt nature', 300, 'g', 'cr'],
    ['Tomates concassées', 600, 'g', 'ep'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Ail', 4, 'gousse', 'lg'],
    ['Gingembre frais', 25, 'g', 'lg'],
    ['Garam masala', 2, 'c.à.s', 'es'],
    ['Paprika', 2, 'c.à.c', 'es'],
    ['Curcuma', 1, 'c.à.c', 'es'],
    ['Riz basmati', 250, 'g', 'fe'],
    ['Crème légère 15%', 100, 'ml', 'cr'],
    ['Coriandre fraîche', 0.5, 'botte', 'lg'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep']
  ],
  etapes: [
    'Marinez le poulet en cubes 1 h dans le yaourt avec la moitié des épices, l\'ail et le gingembre.',
    'Faites griller le poulet 12 min au four à 220 °C pour obtenir les bords caramélisés typiques.',
    'Faites revenir les oignons 10 min jusqu\'à ce qu\'ils soient bien fondants, ajoutez le reste des épices.',
    'Versez les tomates, mijotez 15 min puis mixez la sauce pour la rendre veloutée.',
    'Ajoutez le poulet grillé et la crème légère, réchauffez 5 min sans bouillir.',
    'Servez avec le riz basmati et la coriandre.'
  ],
  astuce: 'Le vrai secret du tikka : le passage au four très chaud, pas la crème.',
  src: ['marmiton', 'poulet tikka masala']
},

/* ---------------------------------------------------------------
   VIANDE ROUGE & PORC
   --------------------------------------------------------------- */
{
  id: 'bourguignon-leger',
  nom: 'Bœuf bourguignon allégé et purée maison',
  cat: 'Viande rouge', viandeRouge: true, plaisir: false,
  temps: 150, diff: 'Moyen',
  kcal: 620, prot: 45, gluc: 54, lip: 21, fibres: 8,
  saisons: ['automne', 'hiver'],
  tags: ['mijoté', 'dimanche', 'plat familial'],
  allergenes: ['gluten', 'lait', 'sulfite'],
  ingredients: [
    ['Bœuf à braiser (paleron)', 800, 'g', 'bo'],
    ['Carotte', 5, 'pièce', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Champignons de Paris', 400, 'g', 'lg'],
    ['Vin rouge', 400, 'ml', 'ep'],
    ['Bouillon de bœuf', 400, 'ml', 'ep'],
    ['Concentré de tomate', 2, 'c.à.s', 'ep'],
    ['Farine', 20, 'g', 'ep'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Bouquet garni', 1, 'pièce', 'es'],
    ['Pommes de terre', 1000, 'g', 'lg'],
    ['Lait demi-écrémé', 150, 'ml', 'cr'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep']
  ],
  etapes: [
    'Dégraissez soigneusement la viande et coupez-la en gros cubes. Saisissez-la par petites quantités dans la cocotte.',
    'Ajoutez oignons et carottes, saupoudrez de farine et mélangez 2 min.',
    'Déglacez au vin rouge, ajoutez le bouillon, le concentré de tomate, l\'ail et le bouquet garni.',
    'Couvrez et laissez mijoter 2 h à feu très doux (ou 2 h 30 au four à 150 °C).',
    'Ajoutez les champignons poêlés 20 min avant la fin.',
    'Purée : pommes de terre cuites à l\'eau, écrasées avec le lait chaud et un filet d\'huile d\'olive (pas de beurre).'
  ],
  astuce: 'Préparez-le la veille, dégraissez à froid : la sauce y gagne et vous retirez le gras figé.',
  src: ['marmiton', 'boeuf bourguignon']
},
{
  id: 'boeuf-brocoli',
  nom: 'Bœuf sauté au brocoli façon asiatique',
  cat: 'Viande rouge', viandeRouge: true, plaisir: false,
  temps: 25, diff: 'Facile',
  kcal: 540, prot: 42, gluc: 58, lip: 15, fibres: 8,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['rapide', 'wok'],
  allergenes: ['soja', 'sesame', 'gluten'],
  ingredients: [
    ['Bavette de bœuf', 500, 'g', 'bo'],
    ['Brocoli', 600, 'g', 'lg'],
    ['Riz complet', 250, 'g', 'fe'],
    ['Sauce soja', 4, 'c.à.s', 'ep'],
    ['Gingembre frais', 20, 'g', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Miel', 1, 'c.à.s', 'ep'],
    ['Maïzena', 1, 'c.à.c', 'ep'],
    ['Huile de sésame', 1, 'c.à.s', 'ep'],
    ['Oignon nouveau', 3, 'pièce', 'lg'],
    ['Graines de sésame', 1, 'c.à.s', 'ep']
  ],
  etapes: [
    'Émincez le bœuf très finement dans le sens contraire des fibres, mélangez-le à la maïzena et 1 c.à.s de soja.',
    'Blanchissez le brocoli 3 min à l\'eau bouillante, égouttez.',
    'Saisissez le bœuf 2 min au wok brûlant, réservez immédiatement.',
    'Faites revenir ail et gingembre, ajoutez le brocoli, la sauce soja restante et le miel.',
    'Remettez le bœuf 1 min, servez sur le riz avec sésame et oignon nouveau.'
  ],
  astuce: 'Le PNNS conseille de limiter la viande rouge à 500 g par semaine et par personne : ce plat en utilise 125 g.',
  src: ['ricardo', 'boeuf brocoli sauté']
},
{
  id: 'boulettes-boeuf',
  nom: 'Boulettes de bœuf sauce tomate et spaghettis complets',
  cat: 'Viande rouge', viandeRouge: true, plaisir: false,
  temps: 45, diff: 'Facile',
  kcal: 610, prot: 38, gluc: 72, lip: 18, fibres: 11,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['plat familial', 'les enfants adorent'],
  allergenes: ['gluten', 'oeuf', 'lait'],
  ingredients: [
    ['Bœuf haché 5% MG', 500, 'g', 'bo'],
    ['Spaghettis complets', 400, 'g', 'fe'],
    ['Tomates concassées', 800, 'g', 'ep'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Ail', 4, 'gousse', 'lg'],
    ['Œuf', 1, 'pièce', 'cr'],
    ['Chapelure', 50, 'g', 'ep'],
    ['Parmesan', 50, 'g', 'cr'],
    ['Persil plat', 0.5, 'botte', 'lg'],
    ['Origan séché', 1, 'c.à.c', 'es'],
    ['Carotte', 2, 'pièce', 'lg'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Basilic frais', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Mélangez le bœuf haché avec l\'œuf, la chapelure, la moitié du parmesan, le persil, un oignon râpé, sel et poivre.',
    'Formez 16 boulettes, dorez-les 6 min à la poêle puis réservez.',
    'Faites revenir le second oignon, l\'ail et les carottes râpées 6 min, ajoutez les tomates et l\'origan.',
    'Laissez mijoter 15 min, ajoutez les boulettes et poursuivez 10 min.',
    'Cuisez les spaghettis complets al dente et servez avec le reste de parmesan et le basilic.'
  ],
  astuce: 'La carotte râpée dans la sauce adoucit l\'acidité sans sucre ajouté.',
  src: ['marmiton', 'boulettes boeuf sauce tomate']
},
{
  id: 'filet-mignon-pommes',
  nom: 'Filet mignon de porc aux pommes et patates douces',
  cat: 'Porc', plaisir: false,
  temps: 50, diff: 'Facile',
  kcal: 575, prot: 42, gluc: 64, lip: 15, fibres: 9,
  saisons: ['automne', 'hiver'],
  tags: ['four', 'sucré-salé', 'sans gluten'],
  allergenes: ['moutarde', 'porc'],
  ingredients: [
    ['Filet mignon de porc', 700, 'g', 'bo'],
    ['Patate douce', 800, 'g', 'lg'],
    ['Pomme', 3, 'pièce', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Moutarde à l\'ancienne', 2, 'c.à.s', 'ep'],
    ['Miel', 1, 'c.à.s', 'ep'],
    ['Thym frais', 4, 'brin', 'lg'],
    ['Bouillon de volaille', 200, 'ml', 'ep'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Haricots verts', 400, 'g', 'lg']
  ],
  etapes: [
    'Préchauffez à 200 °C. Coupez les patates douces en cubes, mélangez-les à l\'huile et au thym, enfournez 20 min.',
    'Saisissez le filet mignon sur toutes ses faces dans une cocotte, badigeonnez de moutarde et de miel.',
    'Ajoutez oignons et pommes en quartiers, versez le bouillon.',
    'Enfournez 25 min avec les patates douces. La viande doit rester rosée à cœur.',
    'Laissez reposer 5 min avant de trancher. Servez avec les haricots verts vapeur.'
  ],
  astuce: 'Le filet mignon est le morceau de porc le plus maigre : environ 4 % de matières grasses.',
  src: ['ricardo', 'filet mignon porc pommes']
},
{
  id: 'parmentier-patate-douce',
  nom: 'Hachis parmentier bœuf et patate douce',
  cat: 'Viande rouge', viandeRouge: true, plaisir: false,
  temps: 60, diff: 'Moyen',
  kcal: 595, prot: 36, gluc: 68, lip: 19, fibres: 11,
  saisons: ['automne', 'hiver'],
  tags: ['plat familial', 'batch cooking', 'les enfants adorent'],
  allergenes: ['lait'],
  ingredients: [
    ['Bœuf haché 5% MG', 500, 'g', 'bo'],
    ['Patate douce', 800, 'g', 'lg'],
    ['Pommes de terre', 500, 'g', 'lg'],
    ['Carotte', 3, 'pièce', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Tomates concassées', 400, 'g', 'ep'],
    ['Lait demi-écrémé', 150, 'ml', 'cr'],
    ['Gruyère râpé', 60, 'g', 'cr'],
    ['Thym frais', 3, 'brin', 'lg'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Salade verte', 1, 'pièce', 'lg']
  ],
  etapes: [
    'Cuisez patates douces et pommes de terre 20 min à l\'eau, écrasez-les avec le lait chaud.',
    'Faites revenir oignons, ail et carottes en petits dés 8 min.',
    'Ajoutez le bœuf haché, faites-le colorer, puis les tomates et le thym. Mijotez 10 min.',
    'Dans un plat : la viande, puis la purée. Rayez à la fourchette et parsemez de gruyère.',
    'Gratinez 20 min à 200 °C. Servez avec la salade verte.'
  ],
  astuce: 'Moitié patate douce, moitié pomme de terre : plus de vitamine A et un goût plus rond.',
  src: ['g750', 'hachis parmentier patate douce']
},
{
  id: 'saute-agneau-legumes',
  nom: 'Sauté d\'agneau aux légumes du soleil et semoule',
  cat: 'Viande rouge', viandeRouge: true, plaisir: false,
  temps: 60, diff: 'Moyen',
  kcal: 605, prot: 40, gluc: 62, lip: 21, fibres: 10,
  saisons: ['printemps', 'été'],
  tags: ['mijoté', 'parfumé'],
  allergenes: ['gluten'],
  ingredients: [
    ['Épaule d\'agneau désossée', 700, 'g', 'bo'],
    ['Courgette', 2, 'pièce', 'lg'],
    ['Aubergine', 1, 'pièce', 'lg'],
    ['Poivron rouge', 2, 'pièce', 'lg'],
    ['Tomate', 4, 'pièce', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Ras el-hanout', 1, 'c.à.s', 'es'],
    ['Cumin moulu', 1, 'c.à.c', 'es'],
    ['Semoule complète', 250, 'g', 'fe'],
    ['Bouillon de volaille', 300, 'ml', 'ep'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Coriandre fraîche', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Dégraissez l\'agneau, coupez-le en cubes et saisissez-le vivement dans la cocotte.',
    'Ajoutez oignons et ail, puis les épices.',
    'Mouillez avec le bouillon, couvrez et laissez mijoter 30 min.',
    'Ajoutez tous les légumes en gros morceaux et poursuivez 20 min à découvert.',
    'Préparez la semoule complète et servez avec la coriandre.'
  ],
  astuce: 'Un seul plat de viande rouge par semaine suffit : celui-ci ou le bourguignon, pas les deux.',
  src: ['marmiton', 'saute agneau legumes']
},

/* ---------------------------------------------------------------
   ŒUFS & PLATS LÉGERS
   --------------------------------------------------------------- */
{
  id: 'chakchouka',
  nom: 'Chakchouka, œufs pochés aux tomates et poivrons',
  cat: 'Œufs', plaisir: false,
  temps: 35, diff: 'Facile',
  kcal: 420, prot: 21, gluc: 44, lip: 17, fibres: 10,
  saisons: ['été', 'automne'],
  tags: ['économique', 'one pot', 'rapide'],
  allergenes: ['oeuf', 'gluten'],
  ingredients: [
    ['Œuf', 8, 'pièce', 'cr'],
    ['Poivron rouge', 3, 'pièce', 'lg'],
    ['Tomates concassées', 800, 'g', 'ep'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Cumin moulu', 2, 'c.à.c', 'es'],
    ['Paprika fumé', 1, 'c.à.c', 'es'],
    ['Pain complet', 8, 'tranche', 'bl'],
    ['Feta', 100, 'g', 'cr'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Persil plat', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Émincez oignons et poivrons, faites-les fondre 12 min à feu doux dans l\'huile d\'olive.',
    'Ajoutez l\'ail et les épices, puis les tomates concassées. Laissez réduire 10 min.',
    'Creusez 8 puits dans la sauce et cassez-y les œufs.',
    'Couvrez et laissez cuire 6 à 8 min : le blanc doit être pris, le jaune coulant.',
    'Parsemez de feta émiettée et de persil, servez avec le pain complet grillé.'
  ],
  astuce: 'Le petit-déjeuner-dîner parfait : 2 œufs par personne couvrent 40 % des besoins en protéines du repas.',
  src: ['marmiton', 'chakchouka']
},
{
  id: 'tortilla-pdt',
  nom: 'Tortilla de pommes de terre et oignons, salade verte',
  cat: 'Œufs', plaisir: false,
  temps: 40, diff: 'Moyen',
  kcal: 455, prot: 20, gluc: 48, lip: 20, fibres: 6,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['économique', 'lunch box', 'sans gluten'],
  allergenes: ['oeuf', 'moutarde'],
  ingredients: [
    ['Œuf', 8, 'pièce', 'cr'],
    ['Pommes de terre', 800, 'g', 'lg'],
    ['Oignon', 2, 'pièce', 'lg'],
    ['Huile d\'olive', 4, 'c.à.s', 'ep'],
    ['Salade verte', 1, 'pièce', 'lg'],
    ['Tomate cerise', 200, 'g', 'lg'],
    ['Persil plat', 0.5, 'botte', 'lg'],
    ['Moutarde', 1, 'c.à.c', 'ep'],
    ['Vinaigre de cidre', 1, 'c.à.s', 'ep']
  ],
  etapes: [
    'Coupez les pommes de terre en rondelles fines et les oignons en lamelles.',
    'Faites-les cuire doucement 20 min à couvert dans 3 c.à.s d\'huile : elles doivent être fondantes, pas dorées.',
    'Battez les œufs, salez, poivrez, ajoutez les pommes de terre égouttées et laissez reposer 5 min.',
    'Versez dans la poêle, cuisez 6 min à feu doux, retournez à l\'aide d\'une assiette et poursuivez 4 min.',
    'Servez tiède avec la salade assaisonnée à la vinaigrette moutarde.'
  ],
  astuce: 'Se mange froide le lendemain : la meilleure lunch box qui soit.',
  src: ['g750', 'tortilla espagnole pommes de terre']
},
{
  id: 'quiche-sans-pate',
  nom: 'Quiche sans pâte courgettes-chèvre',
  cat: 'Œufs', plaisir: false,
  temps: 50, diff: 'Facile',
  kcal: 405, prot: 25, gluc: 28, lip: 21, fibres: 5,
  saisons: ['printemps', 'été'],
  tags: ['light', 'sans pâte', 'lunch box'],
  allergenes: ['oeuf', 'lait', 'gluten', 'coque'],
  ingredients: [
    ['Œuf', 6, 'pièce', 'cr'],
    ['Courgette', 3, 'pièce', 'lg'],
    ['Bûche de chèvre', 150, 'g', 'cr'],
    ['Lait demi-écrémé', 250, 'ml', 'cr'],
    ['Farine', 60, 'g', 'ep'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Menthe fraîche', 0.5, 'botte', 'lg'],
    ['Huile d\'olive', 1, 'c.à.s', 'ep'],
    ['Salade verte', 1, 'pièce', 'lg'],
    ['Noix', 40, 'g', 'ep']
  ],
  etapes: [
    'Râpez les courgettes, faites-les revenir 8 min avec l\'oignon pour évacuer l\'eau. C\'est l\'étape à ne pas sauter.',
    'Battez les œufs avec le lait et la farine, salez, poivrez.',
    'Ajoutez les courgettes et la menthe ciselée, versez dans un moule huilé.',
    'Répartissez le chèvre en rondelles sur le dessus.',
    'Enfournez 35 min à 180 °C. Servez avec la salade et les noix.'
  ],
  astuce: 'Sans pâte : environ 180 kcal de moins par part qu\'une quiche classique.',
  src: ['amandine', 'quiche sans pate courgette chevre']
},
{
  id: 'riz-saute-oeufs',
  nom: 'Riz sauté aux œufs et petits légumes',
  cat: 'Œufs', plaisir: false,
  temps: 25, diff: 'Facile',
  kcal: 480, prot: 19, gluc: 70, lip: 13, fibres: 7,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['rapide', 'anti-gaspi', 'économique'],
  allergenes: ['oeuf', 'soja', 'sesame'],
  ingredients: [
    ['Riz complet', 300, 'g', 'fe'],
    ['Œuf', 4, 'pièce', 'cr'],
    ['Petits pois surgelés', 200, 'g', 'sg'],
    ['Carotte', 2, 'pièce', 'lg'],
    ['Poivron rouge', 1, 'pièce', 'lg'],
    ['Oignon nouveau', 3, 'pièce', 'lg'],
    ['Ail', 2, 'gousse', 'lg'],
    ['Sauce soja', 3, 'c.à.s', 'ep'],
    ['Huile de sésame', 1, 'c.à.s', 'ep'],
    ['Gingembre frais', 15, 'g', 'lg']
  ],
  etapes: [
    'Cuisez le riz la veille si possible : un riz froid ne colle pas au wok.',
    'Brouillez les œufs rapidement dans le wok, réservez.',
    'Sautez carottes et poivron 4 min, ajoutez ail, gingembre et petits pois.',
    'Ajoutez le riz froid, faites-le sauter 4 min à feu vif avec la sauce soja.',
    'Remettez les œufs, ajoutez l\'huile de sésame et l\'oignon nouveau.'
  ],
  astuce: 'Le plat anti-gaspi idéal : tout reste de légumes du frigo y passe.',
  src: ['hellofresh', 'riz saute oeufs legumes']
},
{
  id: 'veloute-potimarron',
  nom: 'Velouté de potimarron aux lentilles corail et tartine de chèvre',
  cat: 'Végétarien', legumineuse: true, plaisir: false,
  temps: 35, diff: 'Facile',
  kcal: 445, prot: 18, gluc: 58, lip: 14, fibres: 12,
  saisons: ['automne', 'hiver'],
  tags: ['soupe repas', 'économique', 'réconfortant'],
  allergenes: ['lait', 'gluten'],
  ingredients: [
    ['Potimarron', 1200, 'g', 'lg'],
    ['Lentilles corail', 150, 'g', 'fe'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Ail', 2, 'gousse', 'lg'],
    ['Bouillon de légumes', 1200, 'ml', 'ep'],
    ['Lait de coco', 100, 'ml', 'ep'],
    ['Cumin moulu', 1, 'c.à.c', 'es'],
    ['Pain complet', 8, 'tranche', 'bl'],
    ['Bûche de chèvre', 150, 'g', 'cr'],
    ['Graines de courge', 40, 'g', 'ep'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep'],
    ['Miel', 1, 'c.à.s', 'ep']
  ],
  etapes: [
    'Lavez le potimarron sans l\'éplucher (la peau se mange) et coupez-le en cubes.',
    'Faites revenir l\'oignon, ajoutez potimarron, lentilles corail, ail, cumin et bouillon.',
    'Laissez cuire 20 min puis mixez finement avec le lait de coco.',
    'Toastez les tranches de pain, déposez le chèvre, un filet de miel et passez 3 min sous le gril.',
    'Servez le velouté parsemé de graines de courge.'
  ],
  astuce: 'Les lentilles corail apportent les protéines qui manquent à une soupe classique : c\'est ça qui en fait un vrai repas.',
  src: ['amandine', 'veloute potimarron lentilles corail']
},
{
  id: 'ramen-oeuf-mollet',
  nom: 'Bouillon ramen aux œufs mollets et pak choï',
  cat: 'Œufs', plaisir: false,
  temps: 35, diff: 'Moyen',
  kcal: 490, prot: 22, gluc: 66, lip: 14, fibres: 8,
  saisons: ['automne', 'hiver'],
  tags: ['réconfortant', 'bouillon'],
  allergenes: ['oeuf', 'gluten', 'soja', 'sesame'],
  ingredients: [
    ['Nouilles ramen (ou soba)', 300, 'g', 'fe'],
    ['Œuf', 4, 'pièce', 'cr'],
    ['Pak choï (ou chou chinois)', 400, 'g', 'lg'],
    ['Champignons shiitake', 200, 'g', 'lg'],
    ['Bouillon de légumes', 1500, 'ml', 'ep'],
    ['Sauce soja', 4, 'c.à.s', 'ep'],
    ['Pâte de miso', 2, 'c.à.s', 'ep'],
    ['Gingembre frais', 25, 'g', 'lg'],
    ['Ail', 3, 'gousse', 'lg'],
    ['Oignon nouveau', 3, 'pièce', 'lg'],
    ['Huile de sésame', 1, 'c.à.s', 'ep'],
    ['Maïs doux', 150, 'g', 'ep']
  ],
  etapes: [
    'Cuisez les œufs 6 min exactement, refroidissez-les dans l\'eau glacée puis écalez-les.',
    'Faites infuser gingembre et ail dans le bouillon 15 min, ajoutez sauce soja et miso délayé (jamais bouillant).',
    'Faites sauter les shiitakes 5 min, blanchissez le pak choï 2 min.',
    'Cuisez les nouilles séparément et répartissez-les dans les bols.',
    'Versez le bouillon, disposez légumes, maïs, œuf coupé en deux, oignon nouveau et huile de sésame.'
  ],
  astuce: '6 minutes chrono pour l\'œuf mollet : au-delà, le jaune n\'est plus coulant.',
  src: ['g750', 'ramen maison bouillon miso']
},
{
  id: 'salade-grecque-quinoa',
  nom: 'Salade grecque au quinoa, feta et concombre',
  cat: 'Végétarien', plaisir: false,
  temps: 20, diff: 'Facile',
  kcal: 465, prot: 17, gluc: 52, lip: 20, fibres: 9,
  saisons: ['été'],
  tags: ['sans cuisson', 'lunch box', 'rapide', 'sans gluten'],
  allergenes: ['lait'],
  ingredients: [
    ['Quinoa', 250, 'g', 'fe'],
    ['Concombre', 1, 'pièce', 'lg'],
    ['Tomate', 4, 'pièce', 'lg'],
    ['Poivron vert', 1, 'pièce', 'lg'],
    ['Oignon rouge', 1, 'pièce', 'lg'],
    ['Feta', 200, 'g', 'cr'],
    ['Olives noires', 100, 'g', 'ep'],
    ['Origan séché', 1, 'c.à.c', 'es'],
    ['Huile d\'olive', 4, 'c.à.s', 'ep'],
    ['Citron', 1, 'pièce', 'lg'],
    ['Pois chiches cuits', 240, 'g', 'ep']
  ],
  etapes: [
    'Cuisez le quinoa 12 min, rincez-le à l\'eau froide et laissez refroidir.',
    'Coupez concombre, tomates, poivron et oignon rouge en gros morceaux.',
    'Mélangez le tout avec les pois chiches et les olives.',
    'Assaisonnez d\'huile d\'olive, jus de citron, origan, sel et poivre.',
    'Ajoutez la feta en cubes juste avant de servir.'
  ],
  astuce: 'Se prépare le matin pour le soir : la salade n\'en est que meilleure.',
  src: ['marmiton', 'salade grecque quinoa feta']
},

/* ---------------------------------------------------------------
   JOURS SYMPA — plaisir, mais version maligne
   --------------------------------------------------------------- */
{
  id: 'burger-poulet-four',
  nom: 'Burger maison au poulet croustillant au four et potatoes',
  cat: 'Volaille', plaisir: true,
  temps: 50, diff: 'Moyen',
  kcal: 685, prot: 44, gluc: 74, lip: 22, fibres: 8,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['jour sympa', 'sans friture', 'les enfants adorent'],
  allergenes: ['gluten', 'oeuf', 'lait', 'moutarde'],
  ingredients: [
    ['Blanc de poulet', 600, 'g', 'bo'],
    ['Pain burger complet', 4, 'pièce', 'bl'],
    ['Chapelure panko', 120, 'g', 'ep'],
    ['Œuf', 2, 'pièce', 'cr'],
    ['Farine', 50, 'g', 'ep'],
    ['Paprika fumé', 2, 'c.à.c', 'es'],
    ['Pommes de terre', 800, 'g', 'lg'],
    ['Yaourt grec', 150, 'g', 'cr'],
    ['Moutarde', 1, 'c.à.c', 'ep'],
    ['Cornichons', 6, 'pièce', 'ep'],
    ['Salade verte', 1, 'pièce', 'lg'],
    ['Tomate', 2, 'pièce', 'lg'],
    ['Oignon rouge', 1, 'pièce', 'lg'],
    ['Cheddar', 60, 'g', 'cr'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep']
  ],
  etapes: [
    'Coupez les pommes de terre en quartiers, mélangez-les à 2 c.à.s d\'huile et au paprika, enfournez 35 min à 200 °C.',
    'Aplatissez les blancs de poulet, passez-les dans la farine, l\'œuf battu puis le panko.',
    'Déposez sur une plaque, arrosez d\'un filet d\'huile et enfournez 22 min à 200 °C (retournez à mi-cuisson).',
    'Sauce : yaourt grec, moutarde, cornichons hachés, sel, poivre.',
    'Toastez les pains, montez : sauce, salade, poulet croustillant, cheddar, tomate, oignon rouge.'
  ],
  astuce: 'Panné au four et non frit : on garde le croustillant, on divise les lipides par deux.',
  src: ['g750', 'burger poulet croustillant maison']
},
{
  id: 'pizza-maison',
  nom: 'Pizza maison pâte semi-complète, légumes et mozzarella',
  cat: 'Végétarien', plaisir: true,
  temps: 100, diff: 'Moyen',
  kcal: 645, prot: 26, gluc: 88, lip: 20, fibres: 10,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['jour sympa', 'à faire ensemble', 'plat familial'],
  allergenes: ['gluten', 'lait'],
  ingredients: [
    ['Farine semi-complète (T110)', 400, 'g', 'ep'],
    ['Farine de blé (T65)', 100, 'g', 'ep'],
    ['Levure de boulanger sèche', 1, 'pièce', 'ep'],
    ['Coulis de tomate', 400, 'g', 'ep'],
    ['Mozzarella', 250, 'g', 'cr'],
    ['Courgette', 1, 'pièce', 'lg'],
    ['Poivron rouge', 1, 'pièce', 'lg'],
    ['Champignons de Paris', 200, 'g', 'lg'],
    ['Oignon rouge', 1, 'pièce', 'lg'],
    ['Roquette', 100, 'g', 'lg'],
    ['Origan séché', 2, 'c.à.c', 'es'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep'],
    ['Ail', 2, 'gousse', 'lg']
  ],
  etapes: [
    'Pâte : mélangez les farines, la levure, 10 g de sel, 320 ml d\'eau tiède et 2 c.à.s d\'huile. Pétrissez 8 min.',
    'Laissez lever 1 h 30 sous un torchon, jusqu\'à ce que la pâte double de volume.',
    'Préchauffez le four au maximum (250 °C) avec la plaque à l\'intérieur.',
    'Étalez la pâte finement en 2 pizzas, étalez le coulis assaisonné à l\'ail et à l\'origan.',
    'Garnissez de légumes finement émincés et de mozzarella déchirée.',
    'Enfournez 10 à 12 min sur la plaque brûlante. Ajoutez la roquette à la sortie du four.'
  ],
  astuce: 'La farine semi-complète apporte le double de fibres — et une pâte plus goûteuse.',
  src: ['marmiton', 'pate a pizza maison']
},
{
  id: 'tacos-boeuf-haricots',
  nom: 'Tacos maison bœuf-haricots rouges et guacamole',
  cat: 'Viande rouge', viandeRouge: true, legumineuse: true, plaisir: true,
  temps: 40, diff: 'Facile',
  kcal: 670, prot: 36, gluc: 72, lip: 25, fibres: 15,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['jour sympa', 'à faire ensemble', 'convivial'],
  allergenes: ['gluten', 'lait'],
  ingredients: [
    ['Bœuf haché 5% MG', 400, 'g', 'bo'],
    ['Haricots rouges cuits', 400, 'g', 'ep'],
    ['Tortillas de blé complet', 8, 'pièce', 'bl'],
    ['Avocat', 2, 'pièce', 'lg'],
    ['Tomate', 3, 'pièce', 'lg'],
    ['Oignon rouge', 1, 'pièce', 'lg'],
    ['Citron vert', 2, 'pièce', 'lg'],
    ['Maïs doux', 150, 'g', 'ep'],
    ['Laitue', 1, 'pièce', 'lg'],
    ['Cumin moulu', 2, 'c.à.c', 'es'],
    ['Paprika fumé', 1, 'c.à.c', 'es'],
    ['Yaourt grec', 150, 'g', 'cr'],
    ['Cheddar', 80, 'g', 'cr'],
    ['Coriandre fraîche', 0.5, 'botte', 'lg']
  ],
  etapes: [
    'Faites revenir le bœuf haché avec la moitié de l\'oignon, le cumin et le paprika, 8 min.',
    'Ajoutez les haricots rouges écrasés grossièrement et 100 ml d\'eau, laissez épaissir 5 min.',
    'Guacamole : écrasez les avocats avec le jus d\'un citron vert, l\'oignon rouge restant, sel, coriandre.',
    'Préparez une salsa rapide : tomates en dés, maïs, jus du second citron vert.',
    'Réchauffez les tortillas 30 s à la poêle sèche.',
    'Chacun garnit son tacos : viande-haricots, salade, salsa, guacamole, yaourt grec, un peu de cheddar.'
  ],
  astuce: 'Moitié viande, moitié haricots : plus de fibres, moins de gras, et personne ne voit la différence.',
  src: ['ricardo', 'tacos boeuf haricots rouges']
},
{
  id: 'gratin-butternut-cheddar',
  nom: 'Gratin de pâtes complètes butternut-cheddar',
  cat: 'Végétarien', plaisir: true,
  temps: 55, diff: 'Facile',
  kcal: 650, prot: 26, gluc: 86, lip: 21, fibres: 12,
  saisons: ['automne', 'hiver'],
  tags: ['jour sympa', 'réconfortant', 'plat familial'],
  allergenes: ['gluten', 'lait'],
  ingredients: [
    ['Pâtes complètes courtes', 400, 'g', 'fe'],
    ['Butternut', 700, 'g', 'lg'],
    ['Cheddar', 120, 'g', 'cr'],
    ['Lait demi-écrémé', 400, 'ml', 'cr'],
    ['Farine', 30, 'g', 'ep'],
    ['Beurre', 25, 'g', 'cr'],
    ['Oignon', 1, 'pièce', 'lg'],
    ['Ail', 2, 'gousse', 'lg'],
    ['Muscade', 1, 'pincée', 'es'],
    ['Chapelure', 40, 'g', 'ep'],
    ['Épinards frais', 200, 'g', 'lg'],
    ['Huile d\'olive', 1, 'c.à.s', 'ep']
  ],
  etapes: [
    'Cuisez le butternut en cubes 15 min à la vapeur, puis mixez-le avec un peu de lait.',
    'Faites une béchamel légère (beurre, farine, lait), ajoutez la purée de butternut, la muscade et les deux tiers du cheddar.',
    'Cuisez les pâtes 2 min de moins que le temps indiqué.',
    'Faites tomber les épinards à la poêle avec l\'ail.',
    'Mélangez pâtes, épinards et sauce, versez dans un plat, couvrez du reste de cheddar et de chapelure.',
    'Gratinez 20 min à 200 °C.'
  ],
  astuce: 'Le butternut donne l\'onctuosité et la couleur d\'un mac & cheese avec moitié moins de fromage.',
  src: ['amandine', 'gratin pates butternut']
},
{
  id: 'fajitas-poulet',
  nom: 'Fajitas de poulet et poivrons',
  cat: 'Volaille', plaisir: true,
  temps: 35, diff: 'Facile',
  kcal: 625, prot: 43, gluc: 68, lip: 19, fibres: 10,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['jour sympa', 'convivial', 'rapide'],
  allergenes: ['gluten', 'lait'],
  ingredients: [
    ['Blanc de poulet', 600, 'g', 'bo'],
    ['Tortillas de blé complet', 8, 'pièce', 'bl'],
    ['Poivron rouge', 2, 'pièce', 'lg'],
    ['Poivron vert', 1, 'pièce', 'lg'],
    ['Oignon rouge', 2, 'pièce', 'lg'],
    ['Paprika fumé', 2, 'c.à.c', 'es'],
    ['Cumin moulu', 2, 'c.à.c', 'es'],
    ['Origan séché', 1, 'c.à.c', 'es'],
    ['Citron vert', 2, 'pièce', 'lg'],
    ['Yaourt grec', 200, 'g', 'cr'],
    ['Avocat', 1, 'pièce', 'lg'],
    ['Laitue', 1, 'pièce', 'lg'],
    ['Huile d\'olive', 2, 'c.à.s', 'ep']
  ],
  etapes: [
    'Marinez le poulet en lanières 15 min avec épices, huile et jus d\'un citron vert.',
    'Saisissez le poulet 6 min à feu vif, réservez.',
    'Sautez poivrons et oignons 8 min : ils doivent rester légèrement croquants et colorés.',
    'Remettez le poulet, mélangez 2 min.',
    'Réchauffez les tortillas et servez avec yaourt grec, avocat en lamelles, laitue et citron vert.'
  ],
  astuce: 'Le poulet mariné puis saisi très chaud : c\'est la coloration qui fait tout le goût, pas le gras.',
  src: ['hellofresh', 'fajitas poulet poivrons']
},
{
  id: 'nuggets-coleslaw',
  nom: 'Nuggets de poulet maison au four, wedges et coleslaw léger',
  cat: 'Volaille', plaisir: true,
  temps: 45, diff: 'Facile',
  kcal: 630, prot: 42, gluc: 66, lip: 20, fibres: 9,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['jour sympa', 'les enfants adorent', 'sans friture'],
  allergenes: ['gluten', 'oeuf', 'lait', 'moutarde'],
  ingredients: [
    ['Blanc de poulet', 600, 'g', 'bo'],
    ['Chapelure panko', 120, 'g', 'ep'],
    ['Œuf', 2, 'pièce', 'cr'],
    ['Farine', 50, 'g', 'ep'],
    ['Parmesan', 40, 'g', 'cr'],
    ['Paprika', 2, 'c.à.c', 'es'],
    ['Pommes de terre', 800, 'g', 'lg'],
    ['Chou blanc', 400, 'g', 'lg'],
    ['Carotte', 3, 'pièce', 'lg'],
    ['Yaourt grec', 200, 'g', 'cr'],
    ['Moutarde', 1, 'c.à.c', 'ep'],
    ['Vinaigre de cidre', 2, 'c.à.s', 'ep'],
    ['Huile d\'olive', 3, 'c.à.s', 'ep']
  ],
  etapes: [
    'Coupez les pommes de terre en wedges, huilez, salez et enfournez 35 min à 200 °C.',
    'Détaillez le poulet en gros morceaux, passez-les dans la farine, l\'œuf, puis le mélange panko-parmesan-paprika.',
    'Enfournez 20 min à 200 °C avec un filet d\'huile, en les retournant à mi-cuisson.',
    'Coleslaw : chou et carottes râpés, sauce yaourt grec + moutarde + vinaigre de cidre.',
    'Servez le tout ensemble, avec un peu de la même sauce en accompagnement.'
  ],
  astuce: 'Le panko donne un croustillant que la chapelure classique ne fait pas, même sans friture.',
  src: ['ricardo', 'nuggets poulet maison four']
},
{
  id: 'pancakes-avoine',
  nom: 'Pancakes protéinés à l\'avoine et fruits rouges (brunch)',
  cat: 'Végétarien', plaisir: true,
  temps: 25, diff: 'Facile',
  kcal: 480, prot: 24, gluc: 62, lip: 14, fibres: 8,
  saisons: ['printemps', 'été', 'automne', 'hiver'],
  tags: ['jour sympa', 'brunch', 'week-end'],
  allergenes: ['oeuf', 'lait', 'gluten', 'coque'],
  ingredients: [
    ['Flocons d\'avoine', 250, 'g', 'fe'],
    ['Œuf', 4, 'pièce', 'cr'],
    ['Fromage blanc 0%', 300, 'g', 'cr'],
    ['Lait demi-écrémé', 150, 'ml', 'cr'],
    ['Levure chimique', 1, 'c.à.c', 'ep'],
    ['Banane', 2, 'pièce', 'lg'],
    ['Fruits rouges surgelés', 300, 'g', 'sg'],
    ['Miel', 2, 'c.à.s', 'ep'],
    ['Amandes effilées', 40, 'g', 'ep'],
    ['Huile de colza', 1, 'c.à.s', 'ep'],
    ['Cannelle', 1, 'c.à.c', 'es']
  ],
  etapes: [
    'Mixez les flocons d\'avoine en farine grossière.',
    'Mélangez avec les œufs, le fromage blanc, le lait, la levure, la cannelle et les bananes écrasées.',
    'Laissez reposer la pâte 10 min : elle épaissit.',
    'Cuisez les pancakes 2 min de chaque côté à la poêle légèrement huilée.',
    'Faites compoter les fruits rouges 5 min avec 1 c.à.s de miel.',
    'Servez avec la compotée, les amandes et un filet de miel.'
  ],
  astuce: '24 g de protéines par personne : un brunch qui tient jusqu\'au dîner.',
  src: ['amandine', 'pancakes avoine proteines']
}

];

if (typeof module !== 'undefined') { module.exports = { RECETTES, RAYONS, SOURCES }; }
