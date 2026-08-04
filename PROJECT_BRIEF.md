# DAD vs THE MACHINES — Project Brief

Read this first. It is the handoff from the chat prototype to real development.
The goal: a browser wave-survival game (Brotato style) good enough that Austin's
friends, who are AI skeptics, admit it is fun. Keep it playable at every commit.

## Current state (v3.5, single file)

Everything lives in one file, currently `index.html` (about 2,500 lines).
It works today. Do not break it while refactoring.

Already built:
- 10 waves, 30 to 70 seconds each. Bosses arrive when the timer hits zero on
  wave 5 (The Algorithm) and wave 10 (AGI-PRIME).
- 2600x2000 backyard map with solid obstacles (shed, pool, hedges, trees, car,
  grill) and interactive props: grill cooks healing burgers, trampoline
  launches, kiddie pool slows, sprinkler damages machines, flamingos tip over.
- Roaming elites with edge arrows and loot: Golden Roomba, Printer of Doom,
  Mother Drone. Airdrop crates.
- 11 enemy types including kamikaze delivery drones, healing IT Support bots,
  and front-shielded Firewall bots.
- 8 auto-firing weapons with 3 tiers and pair-combining, 8 passive stat items,
  a between-wave shop with reroll.
- Actives: Space dash with i-frames, and a mower ultimate (E) charged by kills.
- Touch controls, mobile zoom, all sound synthesized in code, no asset files.

Player prefs for this project: plain English explanations, one step at a time,
no em dashes in text shown to the player or written to Austin.

## Phase 0: repo and live link (do this first)

Kickoff prompt Austin can paste into Claude Code:

    Read PROJECT_BRIEF.md. Do Phase 0: init a git repo here, make sure
    index.html runs locally, create a public GitHub repo named
    dad-vs-machines, push, and walk me through enabling GitHub Pages from
    the main branch. Confirm the live URL works, then stop.

Notes:
- Deploy from branch main, root folder. The URL will be
  https://USERNAME.github.io/dad-vs-machines/
- Every future push updates the same link in about a minute. Friends never
  need a new URL.
- Test locally with any static server (for example `npx serve` or
  `python -m http.server`) or by opening index.html directly.

## Phase 1: split the single file

Refactor into modules with no build tool. Plain ES modules served by Pages.

    index.html        (shell, CSS can stay inline or move to style.css)
    src/main.js       (boot, loop, state)
    src/data.js       (WEAPONS, ITEMS, EDEFS, waves, tuning constants)
    src/systems.js    (spawning, combat, yard interactions, shop logic)
    src/render.js     (all drawing, floor bake, UI)
    src/audio.js      (synth sfx and music)
    src/assets.js     (sprite loader, Phase 2)
    assets/           (PNG sprites, Phase 2)

Rules: behavior-identical refactor, commit in small steps, game must run
after every commit. Verify with a local server since ES modules will not
load from file:// in some browsers.

## Phase 2: sprite pipeline (the graphics overhaul)

Austin generates PNGs with an image model. The game loads them and falls
back to the current vector art for any missing file, so art can land
incrementally.

Loader behavior:
- Try `assets/<name>.png` for each known name at boot with a short timeout.
- If loaded, draw the image (centered, scaled to the entity's size, rotated
  or flipped where the code already does that). If not, use existing vector.
- Hit-flash, shadows, glows, and health bars stay code-drawn on top.

File spec:
- PNG, transparent background, subject fills most of the frame.
- Entities 256x256. Bosses 512x512. Props 512x512.
- Character faces the viewer or slightly right. Code flips for left.

Style line to end every prompt with, for consistency:

    chunky cartoon style, thick dark outlines, flat cel shading, bright
    colors, slight top-down three-quarter view, single character centered,
    plain solid background for easy removal, video game sprite

Phase 2a, entities first (biggest visual payoff), file names and prompts:

- dad.png: middle aged suburban dad, balding with gray side hair, gray
  mustache, blue polo shirt tucked into khaki cargo shorts, white tube socks,
  chunky white sneakers, standing ready
- mower.png: same dad riding a small red riding lawnmower, gripping the wheel,
  determined face
- chat.png: small round hovering robot with a single antenna, two orange
  rectangular eyes, dark gray metal
- roomba.png: robot vacuum disc with one menacing red eye on top
- beta.png: boxy walking robot with two stubby legs, orange visor eyes
- drone.png: small quadcopter drone carrying a cardboard delivery package
- zap.png: diamond shaped floating robot with one glowing purple eye
- swarm.png: tiny angular dart shaped micro robot with one red eye
- medic.png: small white robot with a red cross on its chest and a green
  screen
- split.png: round cracked robot that looks ready to break apart, two red eyes
- tank.png: huge server rack robot on tank treads, blinking green status
  lights, one red visor slit
- firewall.png: squat robot holding a large glowing blue riot shield in front
  of itself
- groomba.png: golden luxury robot vacuum with a tiny crown, one orange eye
- printer.png: evil office printer robot with a red ERR screen and paper
  jamming out of its tray
- mother.png: large twin rotor drone carrier robot with red eyes and a hatch
  underneath
- algo.png: giant ominous loading spinner, glowing purple ring of segments
  around a white core eye, dark circular body
- boss.png: massive rectangular AI mainframe robot, purple core, antenna
  array, angry orange eyes, AGI printed on a chest plate

NEW MACHINES (2026-08-03 wave), same style line as the originals:
- scoot.png: teal electric kick scooter robot, headlight eye, leaning forward
  mid-charge, slightly menacing delivery energy
- thermo.png: round smart thermostat robot, dark dial face with a glowing
  orange 88 degree readout, thin silver ring bezel
- frido.png: tall stainless smart fridge robot, two doors, blue ice dispenser
  glow, one small angry red camera eye on the lower door
- vend.png: vending machine elite, dark red cabinet with gold trim, glowing
  snack rows behind glass, one orange targeting eye, subtle gold aura
- courier.png: round golden delivery robot with a brown bolt sack on its
  back, big friendly dollar sign, built to flee
- subs.png: boss, a looming envelope-and-invoice monster robot, SUBSCRIBE
  stamped on it, red accents
- cloud.png: boss, a dark storm cloud server with rack lights inside and rain
  of cables, blue-white core

THE NEIGHBORS (optional but transformative; drawn at 68px in game, generate
256px): karen.png, coach.png, itdad.png, grill.png, coupon.png, yoga.png,
ned.png, hank.png, brenda.png, gus.png. Match each champ's look from the
champ select portraits (clipboard, whistle, IT badge, apron, coupons, yoga
gear, binoculars, tool belt, book, marine bearing).

Phase 2b, props (wired and live, drop them any time): bbq.png (the grill
prop; the name grill.png belongs to Grill Dad), shed.png, pool.png, car.png,
tramp.png, flamingo.png, gnome.png. The floor bake composites the first four
automatically; tramp and flamingo animate live. Same style line.

Practical tips for Austin: generate on a plain background and remove it, keep
one chat or session per batch so the style stays consistent, and redo any
sprite that drifts off style rather than accepting it.

## Phase 3+: gameplay backlog (from Brotato field research)

Priority order. Each item should ship as its own small release.

1. Difficulty and pacing tune based on friend feedback (spawn curve, elite
   pressure, boss HP).
2. XP and levels separate from bolts: enemies grant XP, each level-up banks a
   choice of one of four stat upgrades presented at wave end before the shop.
3. Item pool expansion to 30 plus items across 4 rarity tiers, including
   build-around uniques. Dad-flavored examples: Socket Wrench (+1 projectile),
   Riding Mower Keys (mower charges faster), Coupon Book (shop prices down,
   luck up), HOA Complaint (nearby machines slowed), Second Coffee (dash
   cooldown down), Lawn Care Sponsorship (whacker and blower damage up).
4. New stats to support builds: luck (drop and tier rolls), dodge, projectile
   count, area size, lifesteal in small amounts.
5. Weapon classes with set bonuses: Office set, Yard set, Grill set. Add a
   Grill weapon class (spatula, skewers, propane pressure) since friends will
   ask for it.
6. Character select: multiple dads with tradeoffs. Coach Dad (melee and speed),
   IT Dad (crit and zappy weapons, less HP), Coupon Dad (economy), Grill Dad
   (burgers heal more, fire damage).
7. Mob and wave variety: horde moments, a rare loot courier that crosses the
   map and drops big rewards if caught, hazard waves (sprinkler storm).
8. Boss roster: one new boss per release until waves 3, 5, 7, 10 all have
   distinct fights, then boss modifiers for replays.
9. Endless mode after wave 10 with scaling, plus difficulty tiers at run
   start: Weekday, Weekend, HOA Audit.
10. Meta progression: unlocks and best-run records saved in localStorage
    (works on GitHub Pages), unlock new dads and items by achievements.

## Working agreement

- One change at a time, explained in plain English before implementing.
- Keep the game playable at every commit. Small commits, clear messages.
- Run a syntax check before committing and test in the browser after.
- Never let a refactor and a feature share one commit.
- Tuning values live in data.js so balance passes touch one file.
