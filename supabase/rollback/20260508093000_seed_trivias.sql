DELETE FROM trivias
WHERE title IN (
    'De Stellis Morientibus',
    'El Numero Pi',
    'The Octopus Mind',
    'Tokyo at Night',
    'La Patagonia',
    'Die Doppelhelix',
    'Viae Romanae',
    'Ramen no Rekishi',
    'ים המלח'
);

DELETE FROM trivia_categories
WHERE slug IN (
    'cosmos',
    'animals',
    'cities',
    'geography',
    'landscapes',
    'science',
    'math',
    'history',
    'food'
);
