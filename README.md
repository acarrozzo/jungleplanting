# Jungle Planting 🌴

A cozy browser game for planting seeds in the jungle, watching tall trees grow, and welcoming the animals that come to eat the fruit. Works on phones and computers.

## Play it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8787
```

then visit http://localhost:8787 (on a phone on the same wifi, use the computer's IP address instead of localhost).

## How to play

- Tap a dirt spot and pick a seed. One of your people walks over and plants it.
- Water lilies grow on the three floating spots in the lake. A waterfall feeds the lake at the far right, and frogs hop onto the lily pads.
- Empty spots show a round + button. Tap it to plant there. Growing plants show a progress bar underneath, grown plants show their level stars.
- A cave on the left: bats sleep in it by day and a bear sleeps in it at night.
- A beaver comes when the lake is full and trees are grown. Trees drop sticks; tap them (or let the beaver fetch them) and it builds a dam in three stages that keeps the lake from draining. A full lake spills over the dam, and the otter slides down the waterfall.
- ⏸️ pauses the game. It also pauses on its own when you switch apps.
- 💡 says what to do next and takes you there. 👀 on any name card zooms in and follows that animal or person. The camera also glides to new arrivals unless you are busy (toggle in the menu).
- 📸 in the menu saves a picture of your jungle.
- Days are 3 minutes, nights 1.5 minutes. Plants grow slower at night and faster in the rain. Rain also fills the lake.
- Grown trees make fruit. Animals come to eat it and bring you seeds, including new kinds. Every new animal brings a welcome seed soon after it arrives.
- The first animals come for the starter trees and flowers. Bigger ones (sloth, tapir, owl, gorilla, jaguar, elephant) need more grown trees. The Jungle Book shows what each one is waiting for.
- Tap a grown plant to make it bigger with spare seeds (up to level 3) or swap it for a new seed.
- Tap the thick jungle to clear a new spot for 3 seeds. A new friend also arrives every sunrise (up to 5) and clears 2 spots.
- Tap any person or animal to rename it and pick colors and a hat. The ↩️ button on a name card restores the original look. The sun and moon can be dressed up too, and their sheet can call the next sunset or sunrise early.
- The 🌱 button lists every plant you own with its growth, fruit, level and spot. Tap 👀 to jump to it.
- Land seeds and lake seeds sit on their own sides of the seed bar. On a computer, point at a seed to see what it grows into and who loves it.
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
