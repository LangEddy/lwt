INSERT INTO trivia_categories (slug, name, icon_svg, color, bg_color)
VALUES
    (
        'cosmos',
        'Cosmos',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',
        'oklch(48% 0.18 270)',
        'oklch(94% 0.06 270)'
    ),
    (
        'animals',
        'Animals',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 13.5a4 4 0 100 8 4 4 0 000-8zM5.5 8a2 2 0 100 4 2 2 0 000-4zM18.5 8a2 2 0 100 4 2 2 0 000-4zM8.5 4a2 2 0 100 4 2 2 0 000-4zM15.5 4a2 2 0 100 4 2 2 0 000-4z"/></svg>',
        'oklch(50% 0.16 145)',
        'oklch(94% 0.06 145)'
    ),
    (
        'cities',
        'Cities',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M9 9h.01M9 13h.01M9 17h.01M14 9h.01M14 13h.01M14 17h.01"/></svg>',
        'oklch(52% 0.14 60)',
        'oklch(94% 0.06 60)'
    ),
    (
        'geography',
        'Geography',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18"/></svg>',
        'oklch(50% 0.14 220)',
        'oklch(94% 0.05 220)'
    ),
    (
        'landscapes',
        'Landscapes',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20l6-10 4 6 3-4 7 8H2zM7 6a1 1 0 100-2 1 1 0 000 2z"/></svg>',
        'oklch(50% 0.13 200)',
        'oklch(94% 0.05 200)'
    ),
    (
        'science',
        'Science',
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-atom-icon lucide-atom"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/></svg>',
        'oklch(48% 0.18 305)',
        'oklch(94% 0.06 305)'
    ),
    (
        'math',
        'Math',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7v10M15 7v10M9 17H7M15 17h2"/></svg>',
        'oklch(54% 0.18 35)',
        'oklch(94% 0.06 35)'
    ),
    (
        'history',
        'History',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 4H5a2 2 0 00-2 2v3h3v9a2 2 0 002 2h11a2 2 0 002-2V6a2 2 0 00-2-2zM10 12h6M10 16h6M10 8h6"/></svg>',
        'oklch(46% 0.09 60)',
        'oklch(93% 0.04 60)'
    ),
    (
        'food',
        'Food',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h11v8a4 4 0 01-4 4H9a4 4 0 01-4-4V8zM16 10h2a2 2 0 010 4h-2M9 4l1-2M13 4l1-2"/></svg>',
        'oklch(56% 0.16 15)',
        'oklch(94% 0.06 15)'
    );

INSERT INTO trivias (language_id, category_id, title, subtitle, content, cefr_level, direction, is_published)
VALUES
    (
        (SELECT id FROM languages WHERE code = 'la'),
        (SELECT id FROM trivia_categories WHERE slug = 'cosmos'),
        'De Stellis Morientibus',
        'Quid est supernova',
        'Stellae magnae non in aeternum vivunt. Cum fuel deest, stella in se colligitur et explosio fit. Hanc explosionem supernovam vocamus. Materia emissa novas stellas et planetas format.',
        'B1',
        'ltr',
        true
    ),
    (
        (SELECT id FROM languages WHERE code = 'es'),
        (SELECT id FROM trivia_categories WHERE slug = 'math'),
        'El Numero Pi',
        'Una constante sin fin',
        'El numero pi es la relacion entre la circunferencia y el diametro. Empieza con 3.14159, pero sus decimales no terminan y no se repiten.',
        'B1',
        'ltr',
        true
    ),
    (
        (SELECT id FROM languages WHERE code = 'en'),
        (SELECT id FROM trivia_categories WHERE slug = 'animals'),
        'The Octopus Mind',
        'Nine brains, three hearts',
        'The octopus is a very unusual animal. It has three hearts and can solve puzzles. Scientists continue to study how its nervous system works.',
        'A2',
        'ltr',
        true
    ),
    (
        (SELECT id FROM languages WHERE code = 'en'),
        (SELECT id FROM trivia_categories WHERE slug = 'cities'),
        'Tokyo at Night',
        'A city that never stops',
        'Tokyo changes after sunset. Neon lights, dense streets, and small bars create a unique rhythm that combines speed and calm.',
        'B2',
        'ltr',
        true
    ),
    (
        (SELECT id FROM languages WHERE code = 'es'),
        (SELECT id FROM trivia_categories WHERE slug = 'landscapes'),
        'La Patagonia',
        'Donde el viento manda',
        'La Patagonia es una region enorme del sur de Sudamerica. El viento define la vida diaria y los glaciares muestran cambios muy lentos.',
        'B2',
        'ltr',
        true
    ),
    (
        (SELECT id FROM languages WHERE code = 'de'),
        (SELECT id FROM trivia_categories WHERE slug = 'science'),
        'Die Doppelhelix',
        'Die Form des Lebens',
        'Die DNA hat die Form einer Doppelhelix. Diese Struktur speichert Informationen, die Wachstum, Reparatur und Vererbung steuern.',
        'C1',
        'ltr',
        true
    ),
    (
        (SELECT id FROM languages WHERE code = 'la'),
        (SELECT id FROM trivia_categories WHERE slug = 'history'),
        'Viae Romanae',
        'Omnes viae Romam ducunt',
        'Romani vias longas et rectas per imperium fecerunt. Viae militibus et mercatoribus utiles erant et multae partes Europae coniungebant.',
        'A2',
        'ltr',
        true
    ),
    (
        (SELECT id FROM languages WHERE code = 'ja'),
        (SELECT id FROM trivia_categories WHERE slug = 'food'),
        'Ramen no Rekishi',
        'ものがたりのある いっぽん',
        'ラーメンは 日本で にんきの たべものです。ちいきに よって スープの あじが ちがい、しょうゆや とんこつ などの タイプが あります。',
        'A2',
        'ltr',
        true
    ),
    (
        (SELECT id FROM languages WHERE code = 'he'),
        (SELECT id FROM trivia_categories WHERE slug = 'geography'),
        'ים המלח',
        'האגם הכי מלוח בעולם',
        'ים המלח נמצא בין ישראל לירדן. בגלל כמות המלח הגבוהה, אנשים יכולים לצוף בקלות על המים. האזור מפורסם גם בבוץ המינרלי שלו.',
        'A2',
        'rtl',
        true
    );