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

- The world is 1700 × 560 units. Ground is at y = 430 and is grass all the way down. A cave sits at x = 85 on the left and the camp (tent and campfire) at x = 290. The lake basin starts at x = 1270, is 115 units deep (seaweed sways on the bottom) and ends at a waterfall cliff at x = 1658. The beaver's dam goes at x = 1610.
- 12 plots in all: 10 land planting spots every 84 units from x = 440, and 2 floating lake spots at x = 1385 and 1500 that take water plants only. Three decorative lily pads float at x = 1335, 1442, 1558.
- Depth lanes keep overlapping things readable: plants stand on the ground line, ground animals stand 5 to 13 units in front of it, people 16 to 24 units in front, and the level stars, grow bars and + buttons sit 38 to 44 units below the line, under everyone's feet. Draw order follows the lane, so people are always in front of animals and animals in front of trunks.
- A day is 180 s of daylight plus 90 s of night (270 s). A new jungle starts 25 s into Day 1. The day number is `floor(t / 270) + 1`; when it changes, sunrise happens.
- Game time only advances while the page is open, no sheet is showing and the game is not paused. The ⏸️ button pauses; switching apps or tabs pauses automatically. There is no offline growth.
- Autosave every 5 s and whenever the tab hides, to `localStorage` under `junglePlanting.save.v1` (save format version 3). Version 2 saves (16 + 3 spots) are migrated on load: the first 10 land plants and 2 lake plants are kept, the rest are refunded as seeds (including the seeds spent on their levels), and everyone is moved into the smaller world.

## Customizing

- People, animals, the sun and the moon each have a name card with colors and a hat. Its ↩️ button restores the original look: a person's birth colors (stored on the person when they arrive), an animal's species colors and default name, the sun's and moon's defaults. An animal wears a permanent name tag only while its look or name differs from the default, so a reset removes the tag.
- Pointing the mouse at a seed chip shows its name and how many are planted, grouped by level stars. The pick toast on touch tells how long the seed takes to grow.
- The colour rows on a person's card run skin, hair, shirt, pants.

## Sun and moon

- The sun and moon are tappable. Each has a name, two colors and a hat, saved with the game. Their sheet also has a button that jumps time to the next sunset or sunrise (which can bring a newcomer early).

## Helping the player

- The 💡 What now? button was removed. The game no longer points the player at a next step.
- 👀 **Watch**: every animal and person card (and the Jungle Book rows) has a Zoom in and watch button. The camera zooms to at least 1.7× and follows that entity until the player swipes, pinches, scrolls, zooms or taps the Watching pill.
- **Follow the action**: when an animal arrives, a new seed kind appears or a dam stage finishes, the camera glides there. It stays put if a sheet is open, a seed is picked, a finger is on the screen, something is being watched, the game is paused, or the player moved the camera in the last 4 s. The menu has a toggle to turn following off (saved).
- Every tap on the canvas draws a quick white ripple so a miss still gets feedback.
- 📸 **Take a picture** in the menu saves the canvas as a PNG named with the day, with a small caption in the corner. The HUD is not part of the canvas so it never appears in the photo.

## Camera

- Base scale fits the full world height, or 420 world units of width on portrait phones, whichever is smaller. Zoom multiplies that, up to 2.4. On screens 900 px or wider (so a 1024 px iPad and up) you can zoom out until the whole world fits, cave to waterfall. Narrower screens stop at 0.55.
- Zoomed out, the sun and moon arc higher (peak 90 units below the top of the screen), stars and clouds spread into the extra sky, the backdrop stretches up to 2.3× and foreground plants grow up to 30% taller (`view.boost` in draw.js, applied inside `plantMetrics` so perches and hit boxes follow).
- Drag to scroll, drag vertically when zoomed in. The ◀ ▶ buttons scroll while held and hop half a screen on a tap under 220 ms. Pinch and mouse wheel zoom around the pointer.

## Planting spots

- 4 land spots are open at the start. Each newcomer opens 2 more. Tapping thick jungle lets you spend 3 seeds of one kind to have a person clear 1 spot right away. Maximum 10. Lake spots are always open.
- Every open empty spot shows a round + button under it. Tapping the spot or the button with a seed selected plants it; the button bounces while a seed is picked. Without a selection, the seed picker opens, filtered to land or water seeds.

## People

- You start with one explorer. One more arrives at each sunrise until there are 5. They walk in from the left, clear 2 spots, and the naming sheet opens.
- Walking speed 75 units/s. Planting takes 0.9 s, clearing 1.4 s. Lake seeds are tossed from the shore.
- Queued tasks go to the nearest awake person who is idle or just wandering. If everyone is asleep, the nearest sleeper gets up, does the job and goes back to bed.
- **Tent**: at night every person without a job walks to the tent and sleeps inside (hidden, with Zzz over the tent and a lit doorway). The campfire beside it burns from dusk to dawn. They come out 0.5 to 5 s after sunrise. Tapping the tent says who is asleep.
- **Friendly play**: every 25 to 60 s of daytime, one free person picks another free person or an idle ground animal on land (55% animal when both exist) and walks over, giving up after 14 s. They then play for 3.2 s with emoji bubbles and a floating caption. With people: high five, dance, silly joke, hug, wave, spin. With animals: gentle pats, a snack, a dance, peekaboo, tickles, a nose boop. It is decoration only and gives no rewards. The list lives in `PLAYS` in `js/data.js`.

## Growth

- Each plant has a `grow` time in seconds. Progress per second is `1 / grow`, times 0.5 at night and times 1.5 in rain.
- A progress bar sits under every growing plant. A sprout appears at 12% progress. At 100% the bar turns into the level stars, the plant sparkles, a toast fires, and it counts as grown for animal requirements.
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
- Each eligible species arrives with 45% chance per check, or its own `chance` for rare ones (elephant 10%, jaguar 10%). At most 2 species arrive per check.
- Panda: comes when 2 bamboo are grown, eats bamboo, brings bamboo and berry seeds.
- Requirements are tiered for 10 land spots: the four starter trees and two flowers bring the first wave (toucan, parrot, hummingbird, butterflies, bees, monkey, lake animals). Bear and tree frog need 3 grown trees, tapir, owl and armadillo 4 (bat: 4 fruit trees), sloth and gorilla 5, jaguar 6, elephant 7.
- Animals never leave for good once they have arrived.

### Behaviour by kind

- **bird** flies in from the side of the screen and perches on tree tops.
- **climber** sits in a canopy (the tree frog sits lower on the trunk).
- **bug** hovers at flowers and lilies.
- **ground** walks in from the left along the ground. The armadillo rolls into an armoured ball for 60% of its trips (2.4× speed) and stays curled up for 30% of its rests, peeking out. Capybara and frog prefer the lake shore. The frog hops (55% of the time it picks a target) onto a lily pad or a grown water lily and sits there at the water line.
- **lake** swims in the lake, fish at a random depth. The crocodile is amphibious: 40% of its moves head for the bank left of the lake, where it climbs out and suns itself, sliding back into the water on the way back. Each lake species keeps to a zone of the open water (0 = shore, 1 = falls): turtle 0 to 0.3, duck 0.15 to 0.6, crocodile 0.55 to 0.85, otter 0.85 to 1, fish anywhere. When the otter gets bored it rides the waterfall down into the plunge pool 45% of the time.
- **bug** picks a lily only 30% of the time so the pond does not fill with bees and butterflies.
- **glow** is the fireflies, which appear at a flower.
- Picking a target: with a gift ready (or half the time anyway) an eater heads for a plant with fruit it likes. Otherwise a random plant of its kind, avoiding the one it is already on. Idle time between moves is 6 to 14 s (3 to 14 s for bugs).

### Day and night

- Animals whose `home` is `cave` (bat, bear) head for the cave when they go off duty and sleep there. Bats hang upside down from the roof by day; the bear sleeps there at night. Tapping the cave says who is inside.
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

## Beaver, sticks, dam and island

- The beaver arrives when the lake is at least 70% full and 3 trees are grown. It is awake day and night, keeps near the lake, swims, eats bamboo and brings bamboo and nut seeds.
- While the beaver is present and the dam is unfinished, a random grown land tree drops a stick every 40 s, up to 4 lying around. Tapping a stick collects it; the beaver also walks over and fetches sticks on its own. Collected sticks are "wood", shown in the 🪵 HUD pill as have/need.
- With enough wood the beaver swims to the dam site and builds for 3 s. Stages 1 to 3 cost 4 wood each and raise the lake floor to 30%, 40% and 50%, so the lake can never drain below that. After stage 3 the sticks stop dropping. (An earlier build had a stage 4 island with two planting spots; it made the pond too crowded and was removed. Saves that had island plants get those seeds refunded.)
- Once any dam stage exists, a lake above 97% spills over the dam as a small second waterfall with foam.
- Tapping the dam says how far along it is and how much wood is needed.

## Seed economy at a glance

- Starter seeds: 2 banana, 1 mango, 1 palm, 2 big flower, exactly filling the 6 starting spots.
- Sinks: planting (19 spots), upgrades (5 seeds per plant to reach level 3, about 95 in total), clearing (3 seeds each for the last spots), replacing (net −0 but re-rolls the spot).
- A 30-minute simulation with a simple auto-planter produced roughly 2.4 seeds per minute once a dozen animals were around, with flower-type seeds slightly ahead of tree seeds.

## Save data

The save is the whole state object: time, lake, rain timers, seeds per kind, unlocked kinds, plants per slot (`id, pending, progress, fruit, fruitT, level, day`), people, animals (with positions, states and timers), queue, stats, tips seen, mute flag, open slot count. Transient fields such as bounding boxes are rebuilt on load.

## Debug console (`window.JP`)

`JP.skip(sec)` fast-forwards game time. `JP.give(id, n)` grants seeds. `JP.focusSlot(i)` scrolls to a spot (0 to 15 land, 16 to 18 lake). `JP.state()` returns the live save object. `JP.hitTest(x, y)` says what a tap at world coordinates would hit. `JP.dev()` opens the Under the hood page. `JP.step()` draws one frame when the tab is hidden and animation is paused.

## Elephant watering

- When the elephant gets bored it may go for a drink, as long as it is not raining, the lake is above its floor, some land plant is not already wet, and its 45 s cooldown is over.
- It walks to the shore and drinks for 2.5 s (the lake drops 3%), then walks to a land plant that is still growing (any land plant if none is) and sprays for 3.5 s with its trunk in the air.
- That plant and any land plant within 90 units (its direct neighbours) are watered for 40 s: growth runs 2× and fruit 1.5× faster, on top of rain and night rates. Wet plants drip, and the plant sheet says the elephant watered it.

## Beaver chopping a tree

- While the dam is unfinished and the beaver is around, the sheet of a grown land tree has a "Let the beaver chop it down" button. One tree at a time.
- The beaver walks over, gnaws for 4 s while the tree shakes, the tree falls over and the spot is empty again. It gives 4 wood, which is exactly one dam stage, and no seed back.
- This is the second way to clear a spot. Replace still gives 1 seed back and opens the seed picker.
