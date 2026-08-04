# Roadmap (from Austin's first playtest, 2026-08-01)

Goal before shipping to friends: enough content that they can play a full hour
without seeing everything. Different champs, different builds, multiple maps,
and a how-to guide. Keep the game playable at every commit.

## R1: Polish the current map
- Tree canopy fix: canopies hide the player because trunk collision is tiny
  (18 px) while the leaves draw on top. Make canopies semi-transparent when
  the player is underneath. Hedges are already solid and are fine.
- Balance pass on actives: mower should be really helpful, never an instant
  win. Currently charges 1 per kill, ready at 25 kills, lasts 5 seconds.

## R2: Drop and item economy
Current facts (v3.5):
- Elites always drop 12 + 3 per wave bolts plus a burger. Not random.
- Airdrop crates land on a timer, every 16 to 24 seconds, 8 + 2 per wave bolts.
- No luck stat, nothing modifies drops yet.
Planned:
- Luck stat: raises crate contents, item rarity rolls, and elite loot.
- Item pool to 30 plus items across 4 rarity tiers (common, rare, epic,
  legendary), including build-around uniques. See brief Phase 3 items 3 and 4.

## R3: Character select, 10 plus champs with roles (SHIPPED 2026-08-01, 11 champs live)
Premise: middle aged suburbanites raging against the machines. Roles: tank,
melee, ranged, caster (spell and active power). Each champ gets base stat
tweaks plus one signature perk. Candidate cast, have fun with it:
- Karen, HOA President: caster, her Complaint aura slows machines
- Coach Dad: melee and move speed, whistle stuns
- IT Dad: crit and zappy weapons, less HP
- Grill Dad: tanky, burgers heal more, fire damage
- Coupon Mom: economy, cheaper shop, more bolts
- Yoga Mom: dodge and dash cooldown
- Neighborhood Watch Ned: ranged, longer vision and range
- Handyman Hank: tank, thorns when hit
- Book Club Brenda: caster, area size up
- Retired Marine Gus: tank, less knockback, slow but huge HP
A how-to screen must show each champ's role, stats, and playstyle.

## R4: How-to guide
In-game screen (not a separate doc) covering: all stats and what they do,
weapons and combining, items by rarity, actives (dash, mower), interactive
yard props, elites and bosses, and the champ roster with roles.

## R5: Maps, 3 at launch
- Backyard (exists)
- Corporate Office: cubicle maze, copier hazard, vending machine heals
- Third map to pick later: candidates are Big Box Hardware Store, Grocery
  Store, or Suburban Cul-de-sac
Map select at run start. Obstacles and props themed per map.

## Parked: online multiplayer
Real-time co-op means netcode and a server, effectively a rewrite. Revisit
only if friends are hooked. Cheap social substitute first: shared leaderboard
plus a daily seeded run everyone can compare scores on.

## Reference games
Brotato (shop, luck, builds), LoL Swarm mode (champ roles and ults), Bloons
(map variety, tiered content depth).

## Shipped since (2026-08-01 session 2)
- 5 difficulty tiers: Lazy Sunday, Weekday, Weekend Warrior, HOA Audit, Robot Uprising
- Stat system v2 (weapon classes, dodge, luck, lifesteal), XP and leveling with pick-one-of-four upgrades
- Champion select with 11 neighbors, real portraits, per-champ outfits and perks
- Pause menu, in-game How to Play guide, crowd damage fix
- Garage sale, chore contracts, neighbor favors, yard investments
- 56-item catalog, balance pass, gamepad support, visual identity pass, Corporate Office map: SHIPPED
- Couch co-op (4P), shared leaderboard, iPhone fixes: SHIPPED

## R6: The Gear Overhaul (from friends' playtest feedback, 2026-08-03)
Friends' verdicts: flamingo chore impossible late (FIXED, replaced with
scaling chores), item system is unreadable junk with no direction, max
difficulty too easy (wave 20 on a phone, first try).

Direction, decided with Austin:
1. WoW-style gear replaces both the 6-weapon list and the 56 stacking items.
   Ten slots: Weapon x2, Head, Chest, Legs, Feet, Neck, Ring x2, Trinket.
   Weapons define your attacks; champs keep stats, role, perk, and ult.
2. Every piece has a rarity (common, uncommon, rare, epic, legendary), stat
   lines, and a visible type tag (MELEE / RANGED / EXPLOSIVE / AOE).
3. Character sheet in the shop: paper doll with all 10 slots, tap any item
   for a full tooltip, champ's preferred stats called out. Works with touch,
   gamepad, and per-player in couch co-op.
4. Backpack: 12 slots, swap gear between waves, expandable via a rare drop.
5. Empower: collecting copies upgrades a piece (6/5/4/3/2 copies by rarity).
   An empowered green should still lose to a dropped epic.
6. Roughly 10 uniques per slot: stat sticks, on-hit effects, AOE trinkets,
   paired set bonuses. Elites and bosses can drop gear directly, luck nudges
   drop rarity.
7. More enemy types, elites as regular scaling spawns, more rare spawns.
8. Last: retune all 5 difficulties with the sim (gear changes player power).

R6 SHIPPED 2026-08-03: all eight points live. Slot census 10+ uniques per
slot (76 armor pieces + 10 weapons). Elites scale to 6 per wave on ROBOT
UPRISING, which also got hp 2.6x / dmg 2.1x / rate 2x / spd 1.1x. Diffs 1-3
untouched for family play. NEXT: friends playtest round 2; candidates for
round 3: set bonuses (paired gear), gamepad navigation for the character
sheet, more on-hit effects, third map.
