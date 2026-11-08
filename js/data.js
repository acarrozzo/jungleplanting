// ===== Jungle Planting: game data =====
// Everything about plants, animals, colors and accessories lives here so it's easy to tweak.

const WORLD = {
  W: 1520, H: 560, GROUND_Y: 430,
  LAKE_X: 1190,           // where the lake basin starts
  SLOT_X0: 60, SLOT_DX: 72, MAX_SLOTS: 16, // 16 spots, 72 apart so neighbouring trees overlap less
  LAKE_SLOTS: [1280, 1355, 1430], // x positions of the floating water-plant spots
  LILY_PADS: [1240, 1318, 1392],  // decorative pads frogs hop onto
  FALLS_X: 1478,          // the waterfall cliff starts here
  DAY: 180, NIGHT: 90,    // seconds (3 minute day, 1.5 minute night)
};
WORLD.CYCLE = WORLD.DAY + WORLD.NIGHT;

// Tunable rules. The "Under the hood" page in the game menu reads these, so it always shows the real numbers.
// Times are seconds, rates are per second, chances are 0..1, [a, b] means a random value between a and b.
const RULES = {
  growth:  { nightRate: 0.5, rainRate: 1.5, fruitRainRate: 1.3, sproutAt: 0.12 },
  rain:    { firstGap: [60, 120], gap: [90, 200], length: [30, 60], lakeFill: 0.009, lakeDrain: 0.002, lakeFloor: 0.2 },
  slots:   { start: 6, perNewcomer: 2, clearCost: 3 },
  people:  { max: 5, walkSpeed: 75, plantTime: 0.9, clearTime: 1.4 },
  animals: { spawnEvery: 15, spawnChance: 0.45, maxPerCheck: 2, giftChance: 0.4, welcomeDelay: [15, 30], noFoodGiftChance: 0.5, newSeedBias: 0.75, eatTime: 2.5 },
  upgrade: { maxLevel: 3, sizePerLevel: 0.15, fruitMaxPerLevel: 1, fruitSpeedPerLevel: 0.2, giftBonusPerLevel: 0.15 },
  seeds:   { fallbackAfter: 75 },
  save:    { every: 5 },
};

// Plants. grow = seconds from seed to fully grown (daytime, no rain).
// kind: tree | flower | bush | water (water plants only grow on the floating spots in the lake). fruit: what animals eat; interval = seconds per new fruit.
const PLANTS = {
  banana:     { name: 'Banana Tree',   emoji: '🍌', grow: 120, style: 'banana',     height: 210, kind: 'tree',   starter: 2, fruit: { name: 'banana',      color: '#ffe135', interval: 30, max: 3 } },
  mango:      { name: 'Mango Tree',    emoji: '🥭', grow: 150, style: 'round',      height: 290, kind: 'tree',   starter: 1, leaf: '#2e8b3a', fruit: { name: 'mango',       color: '#ff9f2e', interval: 35, max: 4 } },
  palm:       { name: 'Palm Tree',     emoji: '🌴', grow: 140, style: 'palm',       height: 350, kind: 'tree',   starter: 1, fruit: { name: 'coconut',     color: '#8b5a2b', interval: 40, max: 3 } },
  flower:     { name: 'Big Flower',    emoji: '🌺', grow: 60,  style: 'flower',     height: 85,  kind: 'flower', starter: 2, petal: '#ff5fa2', fruit: { name: 'nectar',      color: '#fff3a0', interval: 20, max: 2 } },
  cacao:      { name: 'Cacao Tree',    emoji: '🍫', grow: 160, style: 'round',      height: 250, kind: 'tree',   leaf: '#3f7d2a', fruit: { name: 'cacao pod',   color: '#b5651d', interval: 40, max: 3 } },
  papaya:     { name: 'Papaya Tree',   emoji: '🍈', grow: 130, style: 'papaya',     height: 290, kind: 'tree',   fruit: { name: 'papaya',      color: '#ffb347', interval: 35, max: 3 } },
  kapok:      { name: 'Giant Kapok',   emoji: '🌳', grow: 300, style: 'kapok',      height: 440, kind: 'tree',   leaf: '#2f7a3f', fruit: null },
  fig:        { name: 'Fig Tree',      emoji: '🟣', grow: 170, style: 'round',      height: 280, kind: 'tree',   leaf: '#4b8a3a', fruit: { name: 'fig',         color: '#7b3f9e', interval: 30, max: 4 } },
  lily:       { name: 'Water Lily',    emoji: '🪷', grow: 50,  style: 'lily',       height: 36,  kind: 'water',  petal: '#ffb6d9', fruit: { name: 'nectar',      color: '#fff',    interval: 25, max: 1 } },
  moonflower: { name: 'Moonflower',    emoji: '🌙', grow: 80,  style: 'moonflower', height: 105,  kind: 'flower', petal: '#e3ebff', fruit: { name: 'moon nectar', color: '#cdf',    interval: 25, max: 2 } },
  orchid:     { name: 'Orchid',        emoji: '🌸', grow: 90,  style: 'orchid',     height: 100,  kind: 'flower', petal: '#d35cff', fruit: { name: 'nectar',      color: '#fff3a0', interval: 25, max: 2 } },
  nut:        { name: 'Nut Tree',      emoji: '🌰', grow: 180, style: 'round',      height: 310, kind: 'tree',   leaf: '#5a7f2a', fruit: { name: 'nut',         color: '#7a4a1e', interval: 35, max: 4 } },
  golden:     { name: 'Golden Tree',   emoji: '✨', grow: 240, style: 'round',      height: 330, kind: 'tree',   leaf: '#d9b021', rare: true, fruit: { name: 'golden fruit', color: '#fff176', interval: 45, max: 3 } },
  rainbow:    { name: 'Rainbow Flower',emoji: '🌈', grow: 70,  style: 'rainbow',    height: 95,  kind: 'flower', fruit: { name: 'nectar',      color: '#fff3a0', interval: 20, max: 2 } },
  berry:      { name: 'Berry Bush',    emoji: '🫐', grow: 45,  style: 'bush',       height: 60,  kind: 'bush',   fruit: { name: 'berry',       color: '#4a4aff', interval: 20, max: 5 } },
  bamboo:     { name: 'Bamboo',        emoji: '🎋', grow: 60,  style: 'bamboo',     height: 340, kind: 'tree',   fruit: { name: 'bamboo shoot', color: '#9bd36a', interval: 30, max: 3 } },
};

// Animals. kind: bird (flies, perches on tree tops) | climber (sits in canopy) | bug (hovers at flowers)
// ground (walks) | lake (swims) | glow (fireflies). active: day | night | both.
// req(s): when it may come. eats: fruit of these plants. brings: seeds it may drop. gift: seconds between gifts.
const ANIMALS = {
  parrot:      { name: 'Parrot',      kind: 'bird',    active: 'day',   max: 1, speed: 140, hint: 'Loves mango and palm trees',               req: s => s.grown('mango') + s.grown('palm') >= 1, eats: ['mango', 'papaya', 'palm'], brings: ['cacao', 'mango'], gift: 64, sound: 'chirp', c1: '#ff3b3b', c2: '#2f6bff' },
  toucan:      { name: 'Toucan',      kind: 'bird',    active: 'day',   max: 1, speed: 130, hint: 'Looks for a banana tree',                  req: s => s.grown('banana') >= 1, eats: ['banana', 'papaya'], brings: ['papaya', 'banana'], gift: 64, sound: 'chirp', c1: '#222222', c2: '#ff8c1a' },
  hummingbird: { name: 'Hummingbird', kind: 'bug',     active: 'day',   max: 1, speed: 220, hint: 'Sips from big flowers',                    req: s => s.flowers >= 1, eats: ['flower', 'rainbow', 'orchid'], brings: ['rainbow', 'flower'], gift: 56, sound: 'chirp', c1: '#2fd27a', c2: '#ff4fa0' },
  monkey:      { name: 'Monkey',      kind: 'climber', active: 'day',   max: 1, speed: 120, hint: 'Needs 2 grown trees and a banana tree',    req: s => s.trees >= 2 && s.grown('banana') >= 1, eats: ['banana', 'mango', 'berry'], brings: ['berry', 'banana'], gift: 56, sound: 'ooh', c1: '#8b5a2b', c2: '#e8c39e' },
  sloth:       { name: 'Sloth',       kind: 'climber', active: 'day',   max: 1, speed: 14,  hint: 'Comes when 6 trees are grown',             req: s => s.trees >= 6, eats: [], brings: ['kapok'], gift: 112, c1: '#9c8b74', c2: '#d9cbb3' },
  butterfly:   { name: 'Butterfly',   kind: 'bug',     active: 'day',   max: 2, speed: 60,  hint: 'Flutters to flowers',                      req: s => s.flowers >= 1, eats: ['flower', 'rainbow', 'orchid', 'lily'], brings: ['flower'], gift: 96, giftChance: 0.3, c1: '#ff9f1a', c2: '#5a2a8a' },
  bee:         { name: 'Bee',         kind: 'bug',     active: 'day',   max: 2, speed: 90,  hint: 'Needs 2 flowers',                          req: s => s.flowers >= 2, eats: ['flower', 'rainbow', 'orchid', 'lily'], brings: ['flower', 'rainbow'], gift: 72, giftChance: 0.3, sound: 'buzz', c1: '#ffd21f', c2: '#222222' },
  capybara:    { name: 'Capybara',    kind: 'ground',  active: 'day',   max: 1, speed: 40,  hint: 'Likes a half-full lake and a tree',        req: s => s.lake >= 0.5 && s.trees >= 1, eats: ['berry', 'bamboo'], brings: ['lily', 'berry'], gift: 96, nearLake: true, c1: '#a86f3a', c2: '#5a3a1a' },
  tapir:       { name: 'Tapir',       kind: 'ground',  active: 'day',   max: 1, speed: 45,  hint: 'Comes when 5 trees are grown',             req: s => s.trees >= 5, eats: ['fig', 'mango', 'papaya'], brings: ['fig'], gift: 80, c1: '#3a3a3a', c2: '#e8e8e8' },
  elephant:    { name: 'Elephant',    kind: 'ground',  active: 'day',   max: 1, speed: 35,  hint: 'Very rare! Needs 11 grown trees',          req: s => s.trees >= 11, eats: ['banana', 'mango', 'fig', 'papaya', 'nut'], brings: ['golden'], gift: 96, chance: 0.07, sound: 'trumpet', c1: '#8d8d9a', c2: '#c9b3c9' },
  gorilla:     { name: 'Gorilla',     kind: 'ground',  active: 'day',   max: 1, speed: 50,  hint: 'Needs 7 grown trees and bananas',          req: s => s.trees >= 7 && s.grown('banana') >= 1, eats: ['banana', 'bamboo', 'berry'], brings: ['bamboo', 'banana'], gift: 72, sound: 'ooh', c1: '#2b2b2b', c2: '#6d6d6d' },
  owl:         { name: 'Owl',         kind: 'bird',    active: 'night', max: 1, speed: 110, hint: 'Hoots at night once 5 trees are grown',    req: s => s.trees >= 5, eats: [], brings: ['moonflower'], gift: 96, sound: 'hoot', c1: '#a0714f', c2: '#e9d8b8' },
  bat:         { name: 'Bat',         kind: 'bird',    active: 'night', max: 1, speed: 170, hint: 'Flies at night once 5 fruit trees are grown', req: s => s.fruitTrees >= 5, eats: ['fig', 'mango', 'papaya', 'banana'], brings: ['fig'], gift: 72, c1: '#3b2d4a', c2: '#8a6aa8' },
  fireflies:   { name: 'Fireflies',   kind: 'glow',    active: 'night', max: 1, speed: 30,  hint: 'Glow at night near flowers',               req: s => s.flowers >= 1, eats: [], brings: [], gift: 0, c1: '#d8ff5a', c2: '#ffffff' },
  jaguar:      { name: 'Jaguar',      kind: 'ground',  active: 'night', max: 1, speed: 70,  hint: 'Rare! Prowls at night with 9 trees grown', req: s => s.trees >= 9, eats: [], brings: ['orchid'], gift: 112, chance: 0.1, c1: '#e0a53a', c2: '#2a2a2a' },
  treefrog:    { name: 'Tree Frog',   kind: 'climber', active: 'night', max: 1, speed: 60,  hint: 'Sits in trees at night once 4 trees are grown', req: s => s.trees >= 4, eats: [], brings: [], gift: 0, sound: 'croak', c1: '#4fd14a', c2: '#ff5a3a' },
  armadillo:   { name: 'Armadillo',   kind: 'ground',  active: 'night', max: 1, speed: 40,  hint: 'Digs at night once 6 trees are grown',     req: s => s.trees >= 6, eats: ['nut', 'berry'], brings: ['nut'], gift: 80, c1: '#9a9a8a', c2: '#5e5e50' },
  moth:        { name: 'Moth',        kind: 'bug',     active: 'night', max: 1, speed: 70,  hint: 'Loves moonflowers',                        req: s => s.grown('moonflower') >= 1, eats: ['moonflower'], brings: ['moonflower'], gift: 80, c1: '#e8e0c8', c2: '#8a7f66' },
  fish:        { name: 'Fish',        kind: 'lake',    active: 'both',  max: 3, speed: 60,  hint: 'Swims when the lake is half full',         req: s => s.lake >= 0.5, eats: [], brings: [], gift: 0, c1: '#ff7f2a', c2: '#ffd27f' },
  turtle:      { name: 'Turtle',      kind: 'lake',    active: 'both',  max: 1, speed: 20,  hint: 'Needs a half-full lake and a tree',        req: s => s.lake >= 0.5 && s.trees >= 1, eats: [], brings: ['lily'], gift: 144, c1: '#3f8f3a', c2: '#8fd36a' },
  crocodile:   { name: 'Crocodile',   kind: 'lake',    active: 'both',  max: 1, speed: 30,  hint: 'Floats when the lake is nearly full',      req: s => s.lake >= 0.85, eats: [], brings: [], gift: 0, c1: '#4f8a2a', c2: '#c9d97a' },
  duck:        { name: 'Duck',        kind: 'lake',    active: 'day',   max: 1, speed: 40,  hint: 'Paddles when the lake is half full and 3 flowers bloom', req: s => s.lake >= 0.5 && s.flowers >= 3, eats: [], brings: ['lily'], gift: 128, sound: 'quack', c1: '#f4f4f4', c2: '#ff9f1a' },
  frog:        { name: 'Frog',        kind: 'ground',  active: 'both',  max: 1, speed: 50,  hint: 'Hops by the lake when flowers grow',       req: s => s.lake >= 0.3 && s.flowers >= 1, eats: [], brings: [], gift: 0, sound: 'croak', nearLake: true, c1: '#5bd15b', c2: '#c8f0a0' },
  otter:       { name: 'Otter',       kind: 'lake',    active: 'day',   max: 1, speed: 70,  hint: 'Plays when the lake is nearly full and fish swim', req: s => s.lake >= 0.85 && s.present('fish'), eats: [], brings: [], gift: 0, c1: '#7a4a2a', c2: '#d9b48a' },
};

const ACCESSORIES = [
  { id: 'none',     name: 'None',      emoji: '🚫' },
  { id: 'cap',      name: 'Cap',       emoji: '🧢' },
  { id: 'partyhat', name: 'Party Hat', emoji: '🎉' },
  { id: 'crown',    name: 'Crown',     emoji: '👑' },
  { id: 'bow',      name: 'Bow',       emoji: '🎀' },
  { id: 'glasses',  name: 'Glasses',   emoji: '👓' },
  { id: 'flower',   name: 'Flower',    emoji: '🌼' },
  { id: 'scarf',    name: 'Scarf',     emoji: '🧣' },
  { id: 'tophat',   name: 'Top Hat',   emoji: '🎩' },
];

// Short palettes keep the customize sheet small enough to fit on a phone screen without scrolling.
const PEOPLE_COLORS = ['#ff3b3b', '#ff8c1a', '#ffd21f', '#5bd15b', '#2fd2c0', '#2f6bff', '#8a4fff', '#ff4fa0'];
const ANIMAL_COLORS = ['#ff3b3b', '#ff8c1a', '#ffd21f', '#5bd15b', '#2f6bff', '#8a4fff', '#ff4fa0', '#ffffff'];
const SKY_COLORS = ['#ffd84a', '#ff9f2e', '#ff6b6b', '#ff4fa0', '#f2f4ff', '#cfe3ff', '#b9a6ff', '#8ff0d8'];
const COLORS = ['#ff3b3b', '#ff8c1a', '#ffd21f', '#5bd15b', '#2e8b3a', '#2fd2c0', '#2f6bff', '#8a4fff', '#ff4fa0', '#ffffff', '#c9c9c9', '#6d6d6d', '#222222', '#8b5a2b', '#e8c39e', '#ffe0bd'];
const SKIN_COLORS = ['#ffe0bd', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5a3a1a'];
const HAIR_COLORS = ['#222222', '#5a3a1a', '#8b5a2b', '#d9a066', '#ff3b3b', '#2f6bff', '#8a4fff', '#ff4fa0'];

const PERSON_NAMES = ['Maya', 'Leo', 'Zuri', 'Kai', 'Nova', 'Milo', 'Aria', 'Finn', 'Luna', 'Theo', 'Ivy', 'Remy'];
