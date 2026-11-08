# Jungle Planting: how it works under the hood

A plain-language map of every mechanic, for whoever is tuning the game. The numbers quoted here are the defaults in `js/data.js` (`WORLD`, `RULES`, `PLANTS`, `ANIMALS`). The in-game menu has an **Under the hood** page that renders the same information from the live data, so if the two ever disagree, the game is right and this file is stale.

## Where things live

| File | What is in it |
| --- | --- |
| `js/data.js` | All tunable content: world layout, `RULES`, plants, animals, colors, hats, names |
| `js/game.js` | State, update loop, people and animal AI, camera, input, saving, all sheets and HUD |
| `js/draw.js` | Everything painted on the canvas (sky, ground, lake, plants, people, critters, stars, labels) |
| `js/audio.js` | Synthesized sound effects, no audio files |

## World and time

- The world is 1520 × 560 units. Ground is at y = 430. The lake basin starts at x = 1190 and ends at a waterfall cliff at x = 1478.
- 16 land planting spots sit every 72 units from x = 60. Three floating lake spots at x = 1280, 1355, 1430 take water plants only. Three decorative lily pads float at x = 1240, 1318, 1392.
- A day is 180 s of daylight plus 90 s of night (270 s). A new jungle starts 25 s into Day 1. The day number is `floor(t / 270) + 1`; when it changes, sunrise happens.
- Game time only advances while the page is open and no sheet is showing. There is no offline growth.
- Autosave every 5 s and whenever the tab hides, to `localStorage` under `junglePlanting.save.v1` (save format version 2, with migration from version 1).

## Sun and moon

- The sun and moon are tappable. Each has a name, two colors and a hat, saved with the game. Their sheet also has a button that jumps time to the next sunset or sunrise (which can bring a newcomer early).

## Camera

- Base scale fits the full world height, or 420 world units of width on portrait phones, whichever is smaller. Zoom multiplies that, clamped to 0.55 to 2.4.
- Drag to scroll, drag vertically when zoomed in. The ◀ ▶ buttons scroll while held and hop half a screen on a tap under 220 ms. Pinch and mouse wheel zoom around the pointer.

## Planting spots

- 6 land spots are open at the start. Each newcomer opens 2 more. Tapping thick jungle lets you spend 3 seeds of one kind to have a person clear 1 spot right away. Maximum 16. Lake spots are always open.
- Every open empty spot shows a round + button under it. Tapping the spot or the button with a seed selected plants it; the button bounces while a seed is picked. Without a selection, the seed picker opens, filtered to land or water seeds.

## People

- You start with one explorer. One more arrives at each sunrise until there are 5. They walk in from the left, clear 2 spots, and the naming sheet opens.
- Walking speed 75 units/s. Planting takes 0.9 s, clearing 1.4 s. Lake seeds are tossed from the shore (x = 920).
- Queued tasks go to the nearest person who is idle or just wandering. Idle people wander by day and sleep standing up at night, but still get up for tasks.

## Growth

- Each plant has a `grow` time in seconds. Progress per second is `1 / grow`, times 0.5 at night and times 1.5 in rain.
- A sprout appears at 12% progress. At 100% the plant sparkles, a toast fires, and it counts as grown for animal requirements.
- Grown fruit plants add one fruit every `fruit.interval` seconds (1.3× faster in rain) until `fruit.max`. Animals eat one fruit per visit.

## Levels and stars

- Plants have levels 1 to 3. Upgrading costs `level + 1` seeds of the same kind, so 2 seeds for level 2 and 3 for level 3, and only works on a grown plant.
- Each level adds 15% size, +1 max fruit, 20% faster fruit, and +15% seed chance when an animal eats from the plant.
- Three stars sit under every sprouted plant. Gold stars show the current level, faint ones show what is left to earn. The same stars appear in the hover tag, the plant sheet and My Plants.
- Replace removes the plant, refunds 1 seed of its kind, and opens the seed picker for that spot. An animal perched there flies off and picks a new target.

## Rain and lake

- The first rain comes 60 to 120 s after a new jungle starts. After a shower ends, the next one comes 90 to 200 s later. Showers last 30 to 60 s.
- The lake fills 0.009 per second while raining (about +40% in a 45 s shower) and drains 0.002 per second otherwise, never below 20%. The water line is `GROUND_Y + 60 − level × 62`, so lilies and swimmers rise and fall with it.
- Lake level gates the lake animals (fish, turtle, capybara at 50%; crocodile and otter at 85%).

## Animals

### Arrival

- Every 15 s the game checks every species in order. A species may arrive if it is below its `max`, none of its members is away, it is its active time of day, and its `req` function returns true for the current stats (grown counts per plant id, total grown trees, grown fruit trees, grown flowers including lilies, lake level, which species are present).
- Each eligible species arrives with 45% chance per check, or its own `chance` for rare ones (elephant 7%, jaguar 10%). At most 2 species arrive per check.
- Requirements are tiered: the four starter trees and two flowers bring the first wave (toucan, parrot, hummingbird, butterflies, bees, monkey, lake animals). Tapir and owl need 5 grown trees, sloth and armadillo 6, gorilla 7, jaguar 9, elephant 11, bat 5 fruit trees, duck 3 flowers.
- Animals never leave for good once they have arrived.

### Behaviour by kind

- **bird** flies in from the side of the screen and perches on tree tops.
- **climber** sits in a canopy (the tree frog sits lower on the trunk).
- **bug** hovers at flowers and lilies.
- **ground** walks in from the left along the ground. Capybara and frog prefer the lake shore. The frog hops (55% of the time it picks a target) onto a lily pad or a grown water lily and sits there at the water line.
- **lake** swims in the lake, fish at a random depth.
- **glow** is the fireflies, which appear at a flower.
- Picking a target: with a gift ready (or half the time anyway) an eater heads for a plant with fruit it likes. Otherwise a random plant of its kind, avoiding the one it is already on. Idle time between moves is 6 to 14 s (3 to 14 s for bugs).

### Day and night

- Day animals fall asleep where they are at night and show Zzz. Night animals leave at sunrise (flying or walking off at 1.6× speed), wait off screen, and come back at sunset. "Both" animals stay around the clock. Fireflies simply vanish and reappear.

### Seeds (gifts)

- Every animal that brings seeds hands over a **welcome gift** 15 to 30 s after settling in. This one is guaranteed.
- After that each animal runs a gift timer of `gift` seconds.
  - Animals with no food list (sloth, owl, jaguar, turtle, duck) gift when the timer runs out, with 40% chance (or their own `giftChance`).
  - Eaters gift only while eating a fruit they like, with 40% chance plus 15% per level of the plant above 1. Bee and butterfly use 30%.
  - If none of an eater's foods is planted and grown anywhere, it gifts on its timer anyway with 50% chance, so chains like armadillo → nut tree cannot dead-end.
- A gift is a new kind 75% of the time if the animal knows a kind you have not unlocked, otherwise a random kind from its `brings` list. New kinds trigger the big "NEW SEED" toast.
- Safety net: with zero land seeds and at least one empty land spot for 75 s, a grown fruit plant (or "the wind") drops a seed, and every gift chance becomes 100% until you have one.

### Sounds

- Each species may have a `sound`. Every 4 to 9 s one awake animal with a sound calls, 70% of the time; otherwise a generic chirp by day.

## Seed economy at a glance

- Starter seeds: 2 banana, 1 mango, 1 palm, 2 big flower, exactly filling the 6 starting spots.
- Sinks: planting (19 spots), upgrades (5 seeds per plant to reach level 3, about 95 in total), clearing (3 seeds each for the last spots), replacing (net −0 but re-rolls the spot).
- A 30-minute simulation with a simple auto-planter produced roughly 2.4 seeds per minute once a dozen animals were around, with flower-type seeds slightly ahead of tree seeds.

## Save data

The save is the whole state object: time, lake, rain timers, seeds per kind, unlocked kinds, plants per slot (`id, pending, progress, fruit, fruitT, level, day`), people, animals (with positions, states and timers), queue, stats, tips seen, mute flag, open slot count. Transient fields such as bounding boxes are rebuilt on load.

## Debug console (`window.JP`)

`JP.skip(sec)` fast-forwards game time. `JP.give(id, n)` grants seeds. `JP.focusSlot(i)` scrolls to a spot (0 to 15 land, 16 to 18 lake). `JP.state()` returns the live save object. `JP.hitTest(x, y)` says what a tap at world coordinates would hit. `JP.dev()` opens the Under the hood page. `JP.step()` draws one frame when the tab is hidden and animation is paused.
