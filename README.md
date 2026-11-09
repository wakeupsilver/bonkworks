# Bonkworks

A chain-reaction machine builder. You pin parts to a pegboard wall, link each part to the next one, press **GO!** and watch it play out with physics, sound effects and comic-book bangs.

Open `index.html` in a browser. There's no build step. The start screen offers three ways in: watch an example machine run, build your own from an empty wall, or get a random machine. The physics engine ([Matter.js](https://brm.io/matter-js/) 0.19.0) loads from cdnjs.

## How it works

Every part declares what it **reacts to** (inputs) and what it **does** (outputs), using 11 signals:

| Signal | How it travels |
| --- | --- |
| 🎱 Roll, ⬇️ Drop, 👉 Push | a real physics object has to hit the next part |
| 📌 Sharp | something pointy has to touch it (darts, pins, cactus, glass shards) |
| 💧 Pour | real liquid blobs (water, sand, honey) have to land in it |
| 🔥 Fire | a flame touches it, or a burning fuse crawls over to it |
| 💨 Wind | a cone of air aimed at the next part (it also pushes loose objects) |
| 💡 Light | a beam aimed at the next part |
| 🔊 Noise | an expanding sound ring; anything that listens inside it reacts |
| 🪢 Pull, ⚡ Zap | a rope or wire to the linked part |

When you select a part, the parts list re-sorts into "sets off" groups, one per output signal. Parts that won't react are greyed out and say why (for example *"It needs something pointy or a flame, and Wind-up Car only makes push or roll."*). You can still pick one; the link then shows a red ✗ and a warning.

A rolling ball can knock over a book, but it just bounces off a balloon. The physics enforces the same rules the picker shows: a balloon only checks for sharp things and flames.

### Placement

When you attach a part, it gets placed where it will actually be hit. For things that are thrown, rolled or launched, the source part is first simulated alone in a hidden scratch world. Its trajectory is recorded and the next part's input zone goes on that path. Parts that reach (ropes, wires, noise, light, wind) slide up or down to find free wall space.

### Tested to work without magic

Every compatible pairing of parts (1,318 of them) is tested with pure physics: the second part is auto-placed exactly the way the game places it, and the game checks that the first part really sets it off. The results ship in `verified.js` and drive the picker: pairings that pass are shown in green; anything that missed goes in a separate "might not work here" group. When you click a card, auto-placement runs a quick hidden physics test on candidate spots (and nudged variations of them) and uses one that works.

Physics randomness (water droplets, popcorn, glass shards) is seeded, so a machine plays out exactly the same way every time: what the tests saw is what you see. Playback speed doesn't change results either; slower playback just steps the same physics less often.

Pass-through parts are honest about what they pass on: a funnel turns a marble into a dropped marble and water into poured water, never one into the other, and a honey balloon popped by something sharp just splats (it only rolls when bumped).

After changing parts, rebuild the table from the `bonkworks` folder (needs Playwright with Chromium):

```
node tools/build-verified.js
```

### 🪄 Assist

Assist is on by default. It gently steers released objects toward the part they're meant to hit, pokes objects that get stuck, and if a correctly-linked part still hasn't gone off after a few seconds it gets a visible ✨ **NUDGE!** Turn it off for pure physics.

### 🎲 Generate

Generate does a random walk over the input/output compatibility graph. It starts from a starter, adds parts whose inputs match the previous part's outputs (skipping pairings that failed the physics tests), and ends with a finale. When the machine gets near the floor, it picks rope, wire, sound or light transitions so the chain can climb back up the wall.

Then it runs the whole machine in a hidden pure-physics trial. If a link misses, it bans that pairing and rebuilds from there (for a pass-through part like a funnel it blames what was fed into it, since a car jams in a funnel's spout). In testing, 300 out of 300 generated machines completed with Assist off, all ending with a finale.

## Parts (87)

**Starters:** Marble Hopper, Wind-up Car, Alarm Clock, Big Red Button, Rip Cord, Strike a Match, Flashlight, Water Tank, Cue Stick.

**Rolling & falling:** Ramp, Long Ramp, Funnel, Trampoline, Pinball Bumper, Domino Run, Big Book, Bowling Ball, Honey Balloon (rolls very slowly, splats into a honey puddle), Seesaw Launcher, Catapult, Anvil on a Rope.

**Pokey things:** Cactus Cart, Party Balloon, Water Balloon, Pin on a Stick, Snippy Scissors, Dart Launcher, Fancy Wine Glass, Sandbag.

**Fire & light:** Candle Cart, Cannon, Bottle Rocket, Sunflower, Desk Lamp, Window Blinds, Magnifying Glass, Solar Panel, Candle, Long Fuse, Firecracker, Popcorn Pot, Whistling Kettle, Bunsen Burner, Tesla Coil, Match Striker.

**Air & water:** Bucket Counterweight, Magic Beanstalk, Rubber Duck Float, Thirsty Sponge, Water Wheel, Watering Can, Faucet, Ice Block, Desk Fan, Hair Dryer, Bellows, Pinwheel Winch, Sail Cart, Paper Airplane.

**Sparks & strings:** Trapdoor Shelf, Starting Gate, Toaster, Mousetrap, Pressure Plate, Gong, Clap Switch, Doorbell, Party Popper, Boxing Glove, Jack-in-the-Box, Swinging Hammer, Electromagnet, Conveyor Belt.

**Critters:** Startled Hedgehog, Cymbal Monkey, Sleeping Cat, Guard Dog, Rooster, Hamster Wheel, Pepper & Nose.

**Finales** (the payoff at the end of a machine; they set nothing else off): THE END Balloon, Finish Flag, Grand Fireworks, Ta-Da Curtain, Victory Trophy, Breakfast Bowl, Neon THE END Sign. Between them they accept every signal, so any machine can end with one.

## Files

- `engine.js`: world, signals, triggering, fields (fire/wind/light/noise), ropes and wires, Assist, trajectory sampling
- `parts.js`: the parts catalog (bodies, triggers, custom drawing)
- `render.js`: canvas renderer: pegboard, bodies, flames, beams, particles, comic popups
- `audio.js`: every sound effect, synthesized with Web Audio (no audio files)
- `ui.js`: parts list and next-part picker, editing, camera, generator, run controls
- `verified.js`: generated table of which part pairings work with pure physics
- `tools/build-verified.js`: rebuilds `verified.js`

## Controls

Space = GO / reset · Del = delete · F = flip · Q/E = rotate ramps · L = link to another part · Esc = deselect · drag empty space to pan · scroll or pinch to zoom.
