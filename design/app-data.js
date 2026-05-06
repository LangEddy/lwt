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
  stats: { wordsTracked: 420, known: 353, learning: 61, mastered: 6 }
};

Object.assign(window, {
  LANGUAGES, LEVELS, SAMPLE_TEXTS, SAMPLE_WORDS, KNOWN_WORDS, DEMO_USER
});
