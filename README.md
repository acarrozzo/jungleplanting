# Jungle Planting 🌴

A cozy browser game for planting seeds in the jungle, watching tall trees grow, and welcoming the animals that come to eat the fruit. Works on phones and computers.

## Play it

Open `index.html` in a browser, or serve the folder:

```bash
npm run dev
```

(that just runs `python3 -m http.server 8787`)

then visit http://localhost:8787 (on a phone on the same wifi, use the computer's IP address instead of localhost).

## Deploy

It is a static site, so any static host works. For Vercel: import the GitHub repo at vercel.com/new, leave the framework as **Other** with no build command, and deploy. `vercel.json` only sets no-cache headers so updates show up right away. On an iPad, open the site in Safari, tap Share, then **Add to Home Screen** for a full-screen app with its own icon.

## How to play

- Tap a dirt spot and pick a seed. One of your people walks over and plants it.
- Water lilies grow on the three floating spots in the lake. A waterfall feeds the lake at the far right, and frogs hop onto the lily pads.
- Empty spots show a round + button. Tap it to plant there. Growing plants show a progress bar underneath, grown plants show their level stars.
- A cave on the left: bats sleep in it by day and a bear sleeps in it at night.
- A beaver comes when the lake is full and trees are grown. Trees drop sticks; tap them (or let the beaver fetch them) and it builds a dam in three stages that keeps the lake from draining. A full lake spills over the dam, and the otter slides down the waterfall.
- ⏸️ pauses the game. It also pauses on its own when you switch apps.
- 👀 on any name card zooms in and follows that animal or person. The camera also glides to new arrivals unless you are busy (toggle in the menu).
- 20 plots: 12 tree spots on the back row, 6 flower patches out front, and 2 floating in the lake. On a 1024px screen or wider, zooming all the way out shows the whole jungle, and the scroll arrows fade away.
- ⛺ People sleep in the tent in the foreground at night, next to a campfire. They still get up to plant if you ask.
- 🐘 The elephant drinks at the lake and sprays the plants, which makes them grow faster for a while.
- 🪓 Tap a grown tree to let the beaver chop it down. The wood goes into the dam and the spot is free again.
- 💛 Now and then people play with each other and the animals: high fives, dances, tickles, nose boops.
- Depth: people walk at the back, plants grow on a front row, and animals pass behind the trees or stand out in front of them. Things further back are drawn a little smaller.
- 📸 in the menu saves a picture of your jungle.
- Days are 3 minutes, nights 1.5 minutes. Plants grow slower at night and faster in the rain. Rain also fills the lake.
- Grown trees make fruit. Animals come to eat it and bring you seeds, including new kinds. Every new animal brings a welcome seed soon after it arrives.
- The duck, otter and crocodile swim and also walk on land. The gorilla jumps up and hangs in the trees.
- The first animals come for the starter trees and flowers. Bigger ones (sloth, tapir, owl, gorilla, jaguar, elephant) need more grown trees. The Jungle Book shows what each one is waiting for.
- Tap a grown plant to make it bigger with spare seeds (up to level 3) or swap it for a new seed.
- Tap the thick jungle to clear a new spot for 3 seeds. A new friend also arrives every sunrise (up to 5) and clears 2 spots.
- Tap any person or animal to rename it and pick colors and a hat. The ↩️ button on a name card restores the original look. The sun and moon can be dressed up too, and their sheet can call the next sunset or sunrise early.
- The 📖 Jungle Book has three tabs: Animals (who has visited and who is still hiding), Plants (every plant with its growth, fruit, level and spot, plus the seed kinds found so far) and People. Tap 👀 to jump to anything.
- On a keyboard, Esc closes any pop-up.
- The seed bar groups seeds: trees first, then flowers, then lake plants. On a computer, point at a seed to see what it grows into and who loves it.
- On a computer, point at anything and it glows softly with its name, handy when animals and plants overlap.
- Every plant shows 1 to 3 stars under it for its level. Spare seeds of the same kind buy the next star.
- Swipe or use the ◀ ▶ buttons to look around, ➕ ➖ (or pinch / mouse wheel) to zoom.

## Files

- `index.html`, `style.css` – page and kid-friendly UI
- `js/data.js` – plants, animals, colors, hats, day length and the `RULES` table (tweak numbers here)
- `MECHANICS.md` – every rule explained for whoever is tuning the game; the menu's **Under the hood** page shows the live numbers
- `js/draw.js` – everything drawn on the canvas
- `js/audio.js` – tiny synthesized sound effects
- `js/game.js` – game loop, animal behaviour, camera, saving, touch input

Progress saves automatically in the browser on that device.

## Parent cheats

Open the browser console and type:

- `JP.skip(120)` – fast-forward 120 seconds of game time
- `JP.give('kapok', 3)` – get 3 seeds of any plant id from `js/data.js`
- `JP.focusSlot(16)` – scroll to a planting spot (0–15 land, 16–18 lake)
