// Shared app data, constants, and mock state
// Exported to window for cross-script access

const LANGUAGES = [
  { code: 'LAT', name: 'Latin', dir: 'ltr' },
  { code: 'EN', name: 'English', dir: 'ltr' },
  { code: 'DE', name: 'German', dir: 'ltr' },
  { code: 'FR', name: 'French', dir: 'ltr' },
  { code: 'ES', name: 'Spanish', dir: 'ltr' },
  { code: 'AR', name: 'Arabic', dir: 'rtl' },
  { code: 'HE', name: 'Hebrew', dir: 'rtl' },
  { code: 'ZH', name: 'Chinese', dir: 'ltr' },
  { code: 'JA', name: 'Japanese', dir: 'ltr' },
];

// Word knowledge levels
const LEVELS = [
  { id: 0, label: 'Unseen', short: '?', color: 'oklch(85% 0.08 10)', textColor: 'oklch(35% 0.12 10)' },
  { id: 1, label: 'Unknown', short: 'L1', color: 'oklch(80% 0.12 15)', textColor: 'oklch(30% 0.15 15)' },
  { id: 2, label: 'Seen', short: 'L2', color: 'oklch(82% 0.10 30)', textColor: 'oklch(32% 0.12 30)' },
  { id: 3, label: 'Ok-ish', short: 'L3', color: 'oklch(84% 0.10 70)', textColor: 'oklch(34% 0.12 70)' },
  { id: 4, label: 'Good', short: 'L4', color: 'oklch(84% 0.10 130)', textColor: 'oklch(34% 0.12 130)' },
  { id: 5, label: 'Known', short: 'L5', color: 'transparent', textColor: 'inherit' },
];

const SAMPLE_TEXTS = [
  {
    id: '011', title: '011', language: 'LAT', dir: 'ltr',
    content: `Roma gessit tria bella cum Carthagine. Fuerunt ergo tria bella Punica. Bellum Punicum est bellum Carthaginiense. Primum bellum Punicum venit in medio saeculo tertio ante Christum. Messana fuit urbs in Sicilia. Viri mali regnaverunt in Messana. Nomen eorum fuit Mamertini. Mamertini pugnaverunt cum Hierone. Hiero fuit rex in alia urbe in Sicilia. Hiero fuit rex Syracusarum. Ergo Mamertini, viri mali, pugnaverunt cum rege Syracusarum. Mamertini in periculo fuerunt. Mamertini rogaverunt Romanos et Carthaginienses. Romani et Carthaginienses erant potentes. Romani venerunt in Siciliam. Ergo Romani pugnaverunt cum Hierone. Hiero timuit Romanos. Hiero fecit pacem cum Romanis.`,
    createdAt: '2026-04-28'
  },
  {
    id: '010', title: '010', language: 'LAT', dir: 'ltr',
    content: `In Africa septentrionali fuit urbs magna, Carthago. Carthago erat urbs Phoenicia. Phoenices erant nautae et mercatores. Carthaginienses pugnaverunt cum Romanis per multos annos. Bellum Punicum primum fuit in Sicilia. Romani et Carthaginienses pugnaverunt de Sicilia. Sicilia est insula magna. Romani vicerunt in primo bello Punico. Carthago dedit Siciliam Romanis.`,
    createdAt: '2026-04-25'
  },
  {
    id: '008', title: '008', language: 'LAT', dir: 'ltr',
    content: `Romani narraverunt fabulam de legibus Romanis. In initio, Romani non habuerunt leges scriptas. Plebs non habuit iura. Patricii habuerunt potestatem. Plebs rogavit senatum de legibus scriptis. Senatus misit viros Romanos in Graeciam. Viri Romani viderunt leges Graecas. Postea, Romani scripserunt leges. Leges Romanae erant in tabulis duodecim.`,
    createdAt: '2026-04-20'
  },
  {
    id: '007', title: '007', language: 'LAT', dir: 'ltr',
    content: `In rebus humanis, periculum non est rarum. Romani saepe in periculo fuerunt. Galli venerunt in Italiam et pugnaverunt cum Romanis. Galli vicerunt Romanos in proelio. Romani fugerunt in Capitolium. Galli venerunt in urbem Romam et incenderunt eam. Marcus Manlius servavit Capitolium.`,
    createdAt: '2026-04-15'
  },
  {
    id: 'Heb001', title: 'Heb001', language: 'HE', dir: 'rtl',
    content: `בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ. וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל־פְּנֵי תְהוֹם. וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל־פְּנֵי הַמָּיִם. וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי אוֹר.`,
    createdAt: '2026-04-10'
  },
];

const SAMPLE_WORDS = [
  { id: 'w1', word: 'elephantum', language: 'LAT', level: 5, note: 'elephant (accusative)', examples: [] },
  { id: 'w2', word: 'animal', language: 'LAT', level: 5, note: 'animal, living being', examples: ['Animal magnum est elephantus.'] },
  { id: 'w3', word: 'animalia', language: 'LAT', level: 5, note: 'animals (plural nominative)', examples: [] },
  { id: 'w4', word: 'circo', language: 'LAT', level: 5, note: 'circus (dative/ablative)', examples: [] },
  { id: 'w5', word: 'graecae', language: 'LAT', level: 5, note: 'Greek (genitive feminine)', examples: [] },
  { id: 'w6', word: 'mittere', language: 'LAT', level: 1, note: '', examples: [] },
  { id: 'w7', word: 'saeculo', language: 'LAT', level: 2, note: 'century, generation', examples: ['In medio saeculo tertio.'] },
  { id: 'w8', word: 'alia', language: 'LAT', level: 2, note: 'other, another', examples: [] },
  { id: 'w9', word: 'Carthagine', language: 'LAT', level: 3, note: 'Carthage (ablative)', examples: ['Roma gessit bella cum Carthagine.'] },
  { id: 'w10', word: 'pugnaverunt', language: 'LAT', level: 4, note: 'they fought', examples: [] },
  { id: 'w11', word: 'tria', language: 'LAT', level: 3, note: 'three (neuter)', examples: [] },
  { id: 'w12', word: 'bella', language: 'LAT', level: 4, note: 'wars (plural)', examples: [] },
  { id: 'w13', word: 'rex', language: 'LAT', level: 5, note: 'king', examples: ['Hiero fuit rex Syracusarum.'] },
];

// Known words for reading view (word -> level mapping)
const KNOWN_WORDS = {
  'roma': 5, 'bella': 4, 'tria': 3, 'cum': 5, 'carthagine': 3,
  'fuerunt': 4, 'ergo': 4, 'punica': 3, 'bellum': 4, 'punicum': 3,
  'est': 5, 'carthaginiense': 2, 'primum': 4, 'venit': 4, 'in': 5,
  'medio': 3, 'saeculo': 2, 'tertio': 3, 'ante': 5, 'christum': 3,
  'messana': 3, 'fuit': 5, 'urbs': 4, 'sicilia': 4, 'viri': 4,
  'mali': 3, 'regnaverunt': 3, 'nomen': 5, 'eorum': 4, 'mamertini': 3,
  'pugnaverunt': 4, 'hierone': 2, 'hiero': 3, 'rex': 5, 'alia': 2,
  'urbe': 4, 'syracusarum': 2, 'rege': 3, 'gessit': 1,
};

const DEMO_USER = {
  name: 'Alex Learner',
  email: 'alex@example.com',
  avatar: null,
  stats: { wordsTracked: 420, known: 353, learning: 61, mastered: 6 },
  // Trivia preferences
  favoriteLanguages: ['LAT', 'ES', 'EN'],
  targetLevels: ['A2', 'B1'],
};

// CEFR levels with semantic grouping
const CEFR_LEVELS = [
  { code: 'A1', label: 'Beginner', tier: 'beginner', bg: 'oklch(92% 0.06 145)', text: 'oklch(35% 0.13 145)' },
  { code: 'A2', label: 'Elementary', tier: 'beginner', bg: 'oklch(88% 0.08 145)', text: 'oklch(32% 0.14 145)' },
  { code: 'B1', label: 'Intermediate', tier: 'intermediate', bg: 'oklch(92% 0.06 75)', text: 'oklch(38% 0.13 75)' },
  { code: 'B2', label: 'Upper-Int.', tier: 'intermediate', bg: 'oklch(88% 0.08 75)', text: 'oklch(35% 0.14 75)' },
  { code: 'C1', label: 'Advanced', tier: 'advanced', bg: 'oklch(90% 0.06 25)', text: 'oklch(36% 0.14 25)' },
  { code: 'C2', label: 'Proficiency', tier: 'advanced', bg: 'oklch(86% 0.08 25)', text: 'oklch(33% 0.15 25)' },
];

// Trivia categories with signature colors + ascii-safe icon names
const CATEGORIES = [
  { id: 'cosmos', label: 'Cosmos', icon: 'sparkle', color: 'oklch(48% 0.18 270)', bg: 'oklch(94% 0.06 270)' },
  { id: 'animals', label: 'Animals', icon: 'paw', color: 'oklch(50% 0.16 145)', bg: 'oklch(94% 0.06 145)' },
  { id: 'cities', label: 'Cities', icon: 'building', color: 'oklch(52% 0.14 60)', bg: 'oklch(94% 0.06 60)' },
  { id: 'landscapes', label: 'Landscapes', icon: 'mountain', color: 'oklch(50% 0.13 200)', bg: 'oklch(94% 0.05 200)' },
  { id: 'science', label: 'Science', icon: 'atom', color: 'oklch(48% 0.18 305)', bg: 'oklch(94% 0.06 305)' },
  { id: 'math', label: 'Math', icon: 'pi', color: 'oklch(54% 0.18 35)', bg: 'oklch(94% 0.06 35)' },
  { id: 'history', label: 'History', icon: 'scroll', color: 'oklch(46% 0.09 60)', bg: 'oklch(93% 0.04 60)' },
  { id: 'food', label: 'Food', icon: 'cup', color: 'oklch(56% 0.16 15)', bg: 'oklch(94% 0.06 15)' },
];

const TRIVIAS = [
  {
    id: 't1', title: 'De Stellis Morientibus', subtitle: 'Supernovae explained',
    category: 'cosmos', language: 'LAT', level: 'B1', dir: 'ltr',
    readMinutes: 4, hasImage: true,
    content: `Stellae magnae non in aeternum vivunt. Cum stella magna fuel suum consumit, in centro suo collabitur. Tunc fit explosio ingens. Hoc est supernova. In una supernova, stella plus lucis emittit quam tota galaxia. Materia stellae in spatium proicitur. Ex hac materia novae stellae et planetae nascuntur. Etiam atomi corporis tui ex stellis mortuis veniunt. Nos sumus pulvis stellarum.`
  },
  {
    id: 't2', title: 'El Número Pi', subtitle: 'A constant without end',
    category: 'math', language: 'ES', level: 'B1', dir: 'ltr',
    readMinutes: 3, hasImage: false,
    content: `El número pi (π) es una constante matemática. Es la relación entre la circunferencia de un círculo y su diámetro. Pi comienza con 3.14159, pero los decimales nunca terminan ni se repiten. Por esta razón, pi es un número irracional. Los antiguos griegos ya conocían pi. Hoy, los ordenadores han calculado más de cien billones de cifras de pi. ¿Para qué sirve tanto? Es un buen test para la potencia de las computadoras.`
  },
  {
    id: 't3', title: 'The Octopus Mind', subtitle: 'Nine brains, three hearts',
    category: 'animals', language: 'EN', level: 'A2', dir: 'ltr',
    readMinutes: 3, hasImage: true,
    content: `The octopus is a very strange animal. It has eight arms and three hearts. But the most amazing thing is its brain. An octopus has nine brains in total: one big central brain and one small brain in each arm. Each arm can taste, touch, and even decide things on its own. Octopuses can solve puzzles, open jars, and remember faces. Some scientists think octopuses dream when they sleep. Their skin can change color in less than a second.`
  },
  {
    id: 't4', title: 'Tokyo at Night', subtitle: 'A city that never stops',
    category: 'cities', language: 'EN', level: 'B2', dir: 'ltr',
    readMinutes: 5, hasImage: true,
    content: `Tokyo is the largest metropolitan area in the world, with nearly 37 million people. By day, it is a vast machine of trains, suits and silent commuters. But Tokyo only reveals its true character after dark. Neon signs in Shinjuku flood the streets in pink and electric blue. In Shibuya, thousands of pedestrians cross the famous scramble every two minutes. Tiny bars in Golden Gai seat just six people. Vending machines hum on every corner. Despite the density, the city feels strangely calm — almost meditative — once you stop trying to understand it.`
  },
  {
    id: 't5', title: 'La Patagonia', subtitle: 'Where the wind is law',
    category: 'landscapes', language: 'ES', level: 'B2', dir: 'ltr',
    readMinutes: 4, hasImage: true,
    content: `La Patagonia es una región vasta y casi vacía en el extremo sur de Sudamérica. Aquí el viento es constante: puede soplar a más de cien kilómetros por hora durante días enteros. Los árboles crecen inclinados, esculpidos por el aire. Glaciares como el Perito Moreno se mueven lentamente hacia los lagos azules. Hay más ovejas que personas. En invierno, los caminos quedan cubiertos de nieve y aislan pueblos enteros. Los habitantes dicen que en la Patagonia no se vive: se sobrevive con elegancia.`
  },
  {
    id: 't6', title: 'Die Doppelhelix', subtitle: 'The shape of life',
    category: 'science', language: 'DE', level: 'C1', dir: 'ltr',
    readMinutes: 5, hasImage: true,
    content: `Im Jahr 1953 entdeckten James Watson und Francis Crick die Struktur der DNA. Es war eine Doppelhelix — zwei lange Stränge, die sich umeinander drehen wie eine verdrehte Leiter. Diese einfache Form trägt die gesamte genetische Information jedes Lebewesens. Wenn man die DNA einer einzigen menschlichen Zelle entrollen würde, wäre sie etwa zwei Meter lang. Im ganzen Körper befinden sich genug DNA-Moleküle, um die Strecke zur Sonne und zurück mehrere hundert Mal zurückzulegen. Die Information wird in vier Buchstaben geschrieben: A, T, G und C.`
  },
  {
    id: 't7', title: 'Viae Romanae', subtitle: 'All roads lead to Rome',
    category: 'history', language: 'LAT', level: 'A2', dir: 'ltr',
    readMinutes: 3, hasImage: false,
    content: `Romani fecerunt vias longas per totum imperium. Hae viae erant rectae et bene constructae. Milites Romani celeriter ire poterant in viis. Mercatores quoque viis utebantur. Via Appia fuit prima via magna. Hodie possumus videre vias Romanas in Italia, Hispania, et Britannia. Aliquae viae adhuc usantur post duo milia annorum.`
  },
  {
    id: 't8', title: 'Black Holes', subtitle: 'Where light cannot escape',
    category: 'cosmos', language: 'EN', level: 'C1', dir: 'ltr',
    readMinutes: 6, hasImage: true,
    content: `A black hole is what remains when a massive star collapses upon itself. Its gravity is so intense that not even light can escape — hence the name. The boundary beyond which return is impossible is called the event horizon. Time itself behaves strangely near a black hole: an external observer would see a falling clock slow down and freeze at the horizon. Inside, our equations break down at a point called the singularity, where density becomes infinite. The supermassive black hole at the center of our Milky Way, Sagittarius A*, has a mass of four million suns.`
  },
  {
    id: 't9', title: 'Los Colibríes', subtitle: 'Tiny acrobats of the sky',
    category: 'animals', language: 'ES', level: 'A2', dir: 'ltr',
    readMinutes: 2, hasImage: true,
    content: `Los colibríes son las aves más pequeñas del mundo. Pueden volar hacia adelante, hacia atrás, e incluso de cabeza. Sus alas se mueven hasta ochenta veces por segundo. El corazón de un colibrí late más de mil veces por minuto. Para tener tanta energía, comen néctar de muchas flores cada día. Por la noche, entran en un sueño profundo llamado torpor para no morir de hambre.`
  },
  {
    id: 't10', title: 'Fibonacci', subtitle: 'Numbers in nature',
    category: 'math', language: 'EN', level: 'B1', dir: 'ltr',
    readMinutes: 3, hasImage: false,
    content: `The Fibonacci sequence is a list of numbers: 1, 1, 2, 3, 5, 8, 13, 21, 34… Each number is the sum of the two before it. This simple pattern appears everywhere in nature. The petals of many flowers come in Fibonacci numbers. The spiral of a sunflower's seeds follows the sequence. Even the shell of a nautilus grows according to it. Mathematicians find this strange and beautiful. The numbers are connected to the golden ratio, which artists have used for thousands of years.`
  },
  {
    id: 't11', title: 'Le Sahara', subtitle: 'An ocean of sand',
    category: 'landscapes', language: 'FR', level: 'B1', dir: 'ltr',
    readMinutes: 4, hasImage: true,
    content: `Le Sahara est le plus grand désert chaud du monde. Il couvre presque toute l'Afrique du Nord. Pendant la journée, la température peut atteindre cinquante degrés. La nuit, elle peut descendre près de zéro. Le Sahara n'a pas toujours été un désert. Il y a dix mille ans, c'était une savane verte avec des lacs et des rivières. Des peintures rupestres montrent des animaux comme des girafes et des hippopotames. Aujourd'hui, le sable continue d'avancer chaque année.`
  },
  {
    id: 't12', title: 'ラーメンの歴史', subtitle: 'A bowl with a story',
    category: 'food', language: 'JA', level: 'A2', dir: 'ltr',
    readMinutes: 3, hasImage: true,
    content: `ラーメンは日本の有名な料理です。でも、本当は中国から来ました。二十世紀の初めに、日本の港町で食べられ始めました。第二次世界大戦の後、ラーメンはとても人気になりました。今、日本中にたくさんのラーメン屋があります。地域によって味が違います。北海道のラーメンはみそで、博多のラーメンはとんこつです。ラーメンは安くて、おいしくて、温かい食べ物です。`
  },
  {
    id: 't13', title: 'Why the Sky is Blue', subtitle: 'Light and air',
    category: 'science', language: 'EN', level: 'A2', dir: 'ltr',
    readMinutes: 3, hasImage: false,
    content: `The sun's light looks white, but it is really made of all colors. When sunlight enters the air, it hits tiny molecules. Blue light bounces around more than other colors. So we see blue everywhere we look in the sky. At sunset, the light travels through more air. The blue is scattered away, and we see red and orange instead. On the moon, there is no air. So the sky is always black, even during the day.`
  },
  {
    id: 't14', title: 'Roma Aeterna', subtitle: 'The Eternal City',
    category: 'cities', language: 'LAT', level: 'B1', dir: 'ltr',
    readMinutes: 4, hasImage: true,
    content: `Roma vocatur urbs aeterna. Aeterna quia per duo milia et septingentos annos stetit. Romulus eam condidit secundum fabulam. Imperatores aedificaverunt fora et templa. Postea papae aedificaverunt basilicas magnas. Hodie Roma est urbs viva et antiqua simul. In una via potes videre columnam Romanam, ecclesiam medii aevi, et tabernam modernam. Romani dicunt: vedi Napoli, e poi muori. Sed primum Romam vide.`
  },
  {
    id: 't15', title: 'بيت من ورق', subtitle: 'Origami and the brain',
    category: 'science', language: 'AR', level: 'B2', dir: 'rtl',
    readMinutes: 3, hasImage: false,
    content: `الأوريغامي هو فن طي الورق. بدأ في اليابان قبل أكثر من ألف عام. اليوم، يستخدم العلماء الأوريغامي في الطب والفضاء. خلايا قلب الإنسان تطوى مثل الورق عندما تتشكل. حتى التلسكوبات الفضائية تطوى لكي تدخل في الصاروخ، ثم تفتح في الفضاء. الفن البسيط يحل مشاكل صعبة.`
  },
];

Object.assign(window, {
  LANGUAGES, LEVELS, SAMPLE_TEXTS, SAMPLE_WORDS, KNOWN_WORDS, DEMO_USER,
  CEFR_LEVELS, CATEGORIES, TRIVIAS,
});
