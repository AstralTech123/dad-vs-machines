/* DAD vs THE MACHINES: data (weapons, items, enemies, waves, tuning, yard layout) */
/* ---------------- utils ---------------- */
const TAU = Math.PI * 2;
const rand = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => v<a?a:(v>b?b:v);
const dist2 = (ax,ay,bx,by) => { const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
const lerp = (a,b,t) => a+(b-a)*t;
const angDiff = (a,b) => { let d=(b-a)%TAU; if(d>Math.PI)d-=TAU; if(d<-Math.PI)d+=TAU; return d; };
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
function wpick(list){ let tot=0; for(const e of list) tot+=e[1];
  let r=Math.random()*tot;
  for(const e of list){ r-=e[1]; if(r<=0) return e[0]; }
  return list[list.length-1][0]; }

/* ---------------- definitions ---------------- */
const TIER = {
  1:{name:'STANDARD', dmg:1.0, cd:1.0,  priceMul:1.0 },
  2:{name:'DELUXE',   dmg:1.65,cd:0.88, priceMul:2.2 },
  3:{name:'PRO-GRADE',dmg:2.6, cd:0.76, priceMul:4.4 },
};
const WEAPONS = {
  stapler:{ name:'Staple Gun', desc:'Rapid-fire office staples.', cls:'ranged',
    dmg:4, cd:0.42, range:340, speed:560, pierce:0, knock:70, price:12, pitch:1.5, bcolor:'#dfe6f0' },
  tps:{ name:'TPS Report', desc:'Piercing paperwork. Did you get the memo?', cls:'ranged',
    dmg:7, cd:0.95, range:420, speed:470, pierce:2, knock:55, price:14, pitch:1.2, bcolor:'#ffffff' },
  darts:{ name:'Lawn Darts', desc:'Three darts. Banned in several states.', cls:'ranged',
    dmg:5, cd:1.0, range:330, speed:440, pierce:0, knock:80, count:3, spread:0.38, price:16, pitch:1.0, bcolor:'#ffd166' },
  mug:{ name:'Coffee Mug', desc:'Explodes on impact. It was decaf anyway.', cls:'blast',
    dmg:9, cd:1.5, range:380, speed:340, pierce:0, knock:130, aoe:78, price:18, pitch:0.8, bcolor:'#f4eeda' },
  driver:{ name:'Golf Driver', desc:'FORE. Drives through everything.', cls:'ranged',
    dmg:15, cd:1.65, range:540, speed:760, pierce:4, knock:180, price:20, pitch:0.6, bcolor:'#f4fbff' },
  case:{ name:'Briefcase', desc:'Boomerangs through the org chart.', cls:'ranged',
    dmg:10, cd:1.7, range:290, speed:430, pierce:99, knock:100, boomerang:true, price:18, pitch:0.7, bcolor:'#a97b50' },
  blower:{ name:'Leaf Blower', desc:'Low damage, absurd knockback. Saturday energy.', cls:'melee',
    dmg:3, cd:0.14, range:190, cone:0.62, knock:300, melee:'cone', price:16, pitch:2.0 },
  whacker:{ name:'Weed Whacker', desc:'Orbits you, trimming anything that gets close.', cls:'melee',
    dmg:6, cd:0.45, orbitR:82, orbitSpd:3.4, melee:'orbit', price:16, pitch:1.1 },
};
/* items: rar 1 COMMON .. 5 LEGENDARY. stats are flat deltas like champ mods.
   ability items do something stats cannot. Legendaries appear once per run. */
const RARITY = {
  1:{ name:'COMMON',    color:'#8b93a3', w:55 },
  2:{ name:'UNCOMMON',  color:'#9be06f', w:26 },
  3:{ name:'RARE',      color:'#6aa8f0', w:13 },
  4:{ name:'EPIC',      color:'#c48df0', w:5 },
  5:{ name:'LEGENDARY', color:'#ffd166', w:1 },
};
/* stack caps by rarity: at the cap an item stops appearing in your shop */
const RARITY_CAP={ 1:6, 2:5, 3:4, 4:3, 5:1 };
/* which stats each role loves, for the GOOD FOR YOU shop badge */
const ROLE_STATS={
  TANK:['maxHP','armor','regen','thorns','lifesteal','burgerMul'],
  MELEE:['meleeMul','move','atk'],
  RANGED:['rangedMul','crit','critMul','rangeMul'],
  CASTER:['blastMul','areaMul'],
  SUPPORT:['luck','pickup'],
  'ALL-ROUNDER':['dmg','atk'],
};
const STAT_NAMES={ maxHP:'Max HP', armor:'Armor', regen:'Regen', thorns:'Thorns', lifesteal:'Lifesteal',
  burgerMul:'Burger Heal', meleeMul:'Melee Dmg', move:'Move Speed', atk:'Attack Speed',
  rangedMul:'Ranged Dmg', crit:'Crit', critMul:'Crit Dmg', rangeMul:'Range',
  blastMul:'Blast Dmg', areaMul:'Area Size', luck:'Luck', pickup:'Pickup', dmg:'Damage' };
function goodForChamp(champ,it){
  const c=CHAMPS[champ]; if(!c) return false;
  const st=it.stats||{};
  if(c.wpref && st[c.wpref+'Mul']>0) return true;
  const wants=ROLE_STATS[c.role]||[];
  return Object.keys(st).some(k=> wants.includes(k) && st[k]>0);
}
const ITEMS = {
  /* commons: one honest stat */
  chair:    { name:'Ergonomic Chair', icon:'💺', rar:1, price:10, stats:{maxHP:6}, note:'Lumbar support is life support.' },
  fiber:    { name:'Fiber Supplements', icon:'💊', rar:1, price:11, stats:{regen:1}, note:'Keeps everything running on schedule.' },
  strength: { name:'Dad Strength', icon:'💪', rar:1, price:12, stats:{dmg:0.07}, note:'Unexplained. Unstoppable.' },
  energy:   { name:'Weekend Energy', icon:'⚡', rar:1, price:12, stats:{atk:0.07}, note:'The lawn will not mow itself.' },
  sneakers: { name:'New Balance 624s', icon:'👟', rar:1, price:11, stats:{move:16}, note:'Maximum cushion. Maximum velocity.' },
  cargo:    { name:'Cargo Shorts', icon:'🩳', rar:1, price:11, stats:{armor:1}, note:'The pockets absorb the damage.' },
  costco:   { name:'Costco Card', icon:'🛒', rar:1, price:9,  stats:{pickup:35}, note:'Buys bolts in bulk.' },
  glasses:  { name:'Reading Glasses', icon:'👓', rar:1, price:12, stats:{crit:0.05}, note:'Now he sees the fine print.' },
  visor:    { name:'Sun Visor', icon:'🧢', rar:1, price:10, stats:{rangeMul:0.06}, note:'Cuts the glare. Extends the argument.' },
  gloves:   { name:'Work Gloves', icon:'🧤', rar:1, price:11, stats:{meleeMul:0.08}, note:'Grip strength of a man who owns a vise.' },
  scope:    { name:'Bird Watching Scope', icon:'🔭', rar:1, price:11, stats:{rangedMul:0.08}, note:'That is a red-tailed hawk. And a target.' },
  propane:  { name:'Spare Propane', icon:'🔥', rar:1, price:11, stats:{blastMul:0.08}, note:'You can never have enough.' },
  /* uncommons: two stats, no strings attached */
  insoles:  { name:'Gel Insoles', icon:'🦶', rar:2, price:16, stats:{move:14, dodge:0.02}, note:'Walking on clouds. Dodging on clouds.' },
  thermos:  { name:'Big Thermos', icon:'☕', rar:2, price:17, stats:{regen:1, maxHP:4}, note:'Soup stays hot for nine hours.' },
  vitamins: { name:'Costco Vitamins', icon:'🫙', rar:2, price:18, stats:{maxHP:8, regen:1}, note:'A tub the size of a toddler.' },
  mulch:    { name:'Fresh Mulch Bag', icon:'🪵', rar:2, price:16, stats:{armor:1, thorns:2}, note:'Sharp cedar. Do not step in the beds.' },
  sauce:    { name:'Secret BBQ Sauce', icon:'🥫', rar:2, price:17, stats:{burgerMul:0.5, maxHP:4}, note:'The recipe dies with him.' },
  polo:     { name:'Moisture-Wick Polo', icon:'👕', rar:2, price:16, stats:{dodge:0.03, move:8}, note:'Breathable. Elusive.' },
  rakes:    { name:'Matching Rakes', icon:'🧹', rar:2, price:18, stats:{meleeMul:0.12, atk:0.04}, note:'His and yours. Mostly his.' },
  staples:  { name:'Staple Value Pack', icon:'📎', rar:2, price:18, stats:{rangedMul:0.12, atk:0.04}, note:'40,000 count. Family size.' },
  gascan:   { name:'Spare Gas Can', icon:'⛽', rar:2, price:18, stats:{mowDur:1, ultNeed:-2}, note:'The mower drinks first.' },
  horseshoe:{ name:'Lucky Horseshoe', icon:'🧲', rar:2, price:19, stats:{luck:0.1}, note:'Found it the day everything went right.' },
  coupons:  { name:'Sunday Coupons', icon:'📰', rar:2, price:16, stats:{luck:0.08, pickup:20}, note:'Clipped with surgical precision.' },
  kneepads: { name:'Knee Pads', icon:'🦵', rar:2, price:16, stats:{armor:1, maxHP:5}, note:'For gardening. And glory.' },
  espresso: { name:'Double Espresso', icon:'🥃', rar:2, price:18, stats:{dashCdMax:-0.25, move:6}, note:'Decaf is for the machines.' },
  manual:   { name:'Owner\'s Manual', icon:'📖', rar:2, price:17, stats:{rangeMul:0.08, crit:0.03}, note:'He actually read it.' },
  /* rares: bigger numbers, honest tradeoffs */
  toolbelt: { name:'Loaded Tool Belt', icon:'🧰', rar:3, price:28, stats:{meleeMul:0.18, armor:1, move:-8}, note:'Heavy is the waist that wears the tools.' },
  laser:    { name:'Laser Level', icon:'📏', rar:3, price:30, stats:{rangedMul:0.15, crit:0.05, rangeMul:0.08}, note:'Perfectly straight. Perfectly lethal.' },
  fireworks:{ name:'Leftover Fireworks', icon:'🎆', rar:3, price:30, stats:{blastMul:0.2, areaMul:0.12}, note:'Saved since July. For emergencies.' },
  recliner: { name:'Massage Recliner', icon:'🛋️', rar:3, price:28, stats:{maxHP:14, regen:2, move:-10}, note:'Nobody else is allowed in it.' },
  smoothie: { name:'Kale Smoothie', icon:'🥤', rar:3, price:27, stats:{regen:2, dodge:0.03, move:8}, note:'He hates it. It works.' },
  deadbolt: { name:'Smart Deadbolt', icon:'🔒', rar:3, price:28, stats:{armor:2, thorns:3}, note:'Now with revenge mode.' },
  leafnet:  { name:'Pool Leaf Net', icon:'🥅', rar:3, price:26, stats:{pickup:50, luck:0.08}, note:'Catches leaves, bolts, and compliments.' },
  whistle:  { name:'Backup Whistle', icon:'📣', rar:3, price:29, stats:{atk:0.08, meleeMul:0.1, dmg:0.05}, note:'The sound of accountability.' },
  propcap:  { name:'Propeller Cap', icon:'🚁', rar:3, price:27, stats:{dodge:0.05, move:10, maxHP:-4}, note:'Aerodynamic. Embarrassing.' },
  ribeye:   { name:'Ribeye Reserve', icon:'🥩', rar:3, price:30, stats:{lifesteal:0.02, dmg:0.06}, note:'Rare, like his approval.' },
  drillbits:{ name:'Titanium Drill Bits', icon:'🪛', rar:3, price:30, stats:{crit:0.06, critMul:0.3}, note:'Goes through anything. Anything.' },
  hoafine:  { name:'Framed HOA Fine', icon:'🖼️', rar:3, price:28, stats:{dmg:0.1, luck:0.05, maxHP:-5}, note:'He fought the fine. The fine lost.' },
  soaker:   { name:'Mega Soaker 3000', icon:'🔫', rar:3, price:31, stats:{rangedMul:0.14, rangeMul:0.1, atk:0.05}, note:'Banned from three birthday parties.' },
  charcoal: { name:'Artisan Charcoal', icon:'♨️', rar:3, price:28, stats:{blastMul:0.15, burgerMul:0.4}, note:'Small batch. Big flavor. Bigger boom.' },
  /* epics: build-defining stat piles */
  socket:   { name:'Socket Wrench Set', icon:'🔧', rar:4, price:48, stats:{atk:0.12, meleeMul:0.15, rangedMul:0.15, move:-6}, note:'Metric AND imperial. A complete man.' },
  ledger:   { name:'Family Budget Ledger', icon:'📒', rar:4, price:46, stats:{luck:0.12, pickup:30, priceMul:-0.08}, note:'Every bolt accounted for.' },
  flannel:  { name:'Weekend Armor (Flannel)', icon:'🧥', rar:4, price:50, stats:{maxHP:16, armor:2, dodge:0.03, move:-10}, note:'Triple-layered. Machine washable.' },
  coldbrew: { name:'Quad-Shot Cold Brew', icon:'🧊', rar:4, price:48, stats:{dashCdMax:-0.5, atk:0.08, move:12, maxHP:-6}, note:'His heart is fine. Probably.' },
  bifocals: { name:'Prescription Bifocals', icon:'🥽', rar:4, price:52, stats:{crit:0.08, critMul:0.5, rangeMul:0.08}, note:'Sees weak points. And fine print. Everywhere.' },
  grillfork:{ name:'Midnight Grill Fork', icon:'🍴', rar:4, price:52, stats:{lifesteal:0.03, dmg:0.08, blastMul:0.1}, note:'Forged at 2am over open flame.' },
  warranty: { name:'Extended Warranty', icon:'📜', rar:4, price:47, stats:{maxHP:10, armor:1, dodge:0.04, luck:0.08}, note:'For once, it actually paid off.' },
  mowerkeys:{ name:'Riding Mower Keys', icon:'🔑', rar:4, price:54, stats:{ultNeed:-6, mowDur:2}, note:'The good mower. The forbidden mower.' },
  fridge:   { name:'Garage Mini Fridge', icon:'🧊', rar:4, price:55, stats:{maxHP:6}, ability:'fridge', note:'A cold burger waits at the start of every wave.' },
  bugzap:   { name:'Industrial Bug Zapper', icon:'💡', rar:4, price:55, stats:{}, ability:'zapaura', note:'Machines near you sizzle for 3 damage a second.' },
  /* legendaries: once per run, from wave 5 */
  gnome:    { name:'Garden Gnome of War', icon:'🗿', rar:5, price:95, stats:{}, ability:'gnome', note:'A gnome joins the fight. He has a staple gun and no fear.' },
  overtime: { name:'Overtime Pay', icon:'💼', rar:5, price:90, stats:{}, ability:'overtime', note:'+1 bolt every 3 seconds. The grind never stops.' },
  mortgage: { name:'Second Mortgage', icon:'🏠', rar:5, price:85, stats:{}, ability:'mortgage', note:'+70 bolts right now. Shop prices +10% for the rest of the run.' },
  spatula:  { name:'The Golden Spatula', icon:'🥄', rar:5, price:100, stats:{burgerMul:1, lifesteal:0.02, maxHP:10}, note:'Burgers heal double again. The cul-de-sac kneels.' },
  gavel:    { name:'HOA President\'s Gavel', icon:'🔨', rar:5, price:110, stats:{dmg:0.15, areaMul:0.2, auraSlow:0.1}, note:'Order. ORDER.' },
  trophy:   { name:'Yard of the Month Trophy', icon:'🏆', rar:5, price:105, stats:{luck:0.2, dmg:0.08, atk:0.08, move:10}, note:'The committee has spoken.' },
};
const EDEFS = {
  chat:{ name:'Chatbot', hp:8, spd:96, dmg:3, r:12, cost:1, minW:1, mats:1, weight:10, ai:'chase' },
  roomba:{ name:'Roomba', hp:15, spd:74, dmg:5, r:14, cost:2, minW:2, mats:1, weight:7, ai:'charge' },
  beta:{ name:'Beta Bot', hp:32, spd:58, dmg:8, r:19, cost:3, minW:3, mats:2, weight:6, ai:'chase' },
  drone:{ name:'Delivery Drone', hp:12, spd:118, dmg:0, blast:9, r:13, cost:2.2, minW:3, mats:2, weight:5, ai:'kami' },
  zap:{ name:'Zapper', hp:20, spd:72, dmg:0, shot:7, r:14, cost:3, minW:4, mats:2, weight:5, ai:'shoot' },
  swarm:{ name:'Swarmlet', hp:4, spd:140, dmg:3, r:8, cost:0.7, minW:5, mats:1, weight:6, ai:'swarm', pack:6 },
  medic:{ name:'IT Support', hp:26, spd:70, dmg:3, r:15, cost:3, minW:5, mats:3, weight:3, ai:'medic' },
  split:{ name:'Splitter', hp:30, spd:76, dmg:6, r:17, cost:3.5, minW:6, mats:2, weight:5, ai:'chase', splits:3 },
  tank:{ name:'Server Rack', hp:100, spd:38, dmg:14, r:30, cost:6, minW:6, mats:5, weight:4, ai:'chase', knockR:0.12 },
  firewall:{ name:'Firewall', hp:60, spd:50, dmg:9, r:19, cost:4, minW:7, mats:3, weight:4, ai:'chase', frontDR:true, knockR:0.4 },
  courier:{ name:'BOLT COURIER', hp:60, spd:150, dmg:0, r:16, cost:0, minW:99, mats:0, weight:0, ai:'courier', knockR:0.15, courier:true },
  groomba:{ name:'GOLDEN ROOMBA', hp:105, spd:92, dmg:8, r:20, cost:0, minW:99, mats:0, weight:0, ai:'gcharge', knockR:0.3, elite:true },
  printer:{ name:'PRINTER OF DOOM', hp:140, spd:46, dmg:0, shot:7, r:22, cost:0, minW:99, mats:0, weight:0, ai:'printer', knockR:0.3, elite:true },
  mother:{ name:'MOTHER DRONE', hp:175, spd:66, dmg:6, r:26, cost:0, minW:99, mats:0, weight:0, ai:'mother', knockR:0.3, elite:true },
  algo:{ name:'THE ALGORITHM', hp:1050, spd:42, dmg:12, r:40, cost:0, minW:99, mats:0, weight:0, ai:'algo', knockR:0, boss:true },
  subs:{ name:'THE SUBSCRIPTION', hp:1650, spd:40, dmg:13, r:46, cost:0, minW:99, mats:0, weight:0, ai:'subs', knockR:0, boss:true },
  cloud:{ name:'THE CLOUD', hp:2000, spd:52, dmg:12, shot:9, r:48, cost:0, minW:99, mats:0, weight:0, ai:'cloud', knockR:0, boss:true },
  boss:{ name:'AGI-PRIME', hp:2600, spd:46, dmg:15, r:56, cost:0, minW:99, mats:0, weight:0, ai:'boss', knockR:0, boss:true },
};
const WAVE_DUR = [0,30,35,40,45,50,55,60,65,70,70,70,70,70,70,75,75,75,75,75,80];
const FINAL_WAVE = 20;
const MAX_SLOTS = 6;
const ULT_NEED = 25;
const BOSS_WAVES = {5:'algo', 10:'subs', 15:'cloud', 20:'boss'};
/* boss lookup that keeps working in endless mode: every 5th wave past 20
   brings a random boss back for another round */
function bossFor(w){
  if(BOSS_WAVES[w]) return BOSS_WAVES[w];
  if(w>FINAL_WAVE && w%5===0) return ['algo','subs','cloud','boss'][Math.floor(rand(0,4))];
  return null;
}

/* ---------------- maps ----------------
   both maps share the same obstacle geometry (proven balance); each gets its
   own art, labels, and flavor. MAPKEY drives every visual branch. */
const MAPS = {
  yard:  { name:'THE BACKYARD',     desc:'Where it all started.' },
  office:{ name:'CORPORATE OFFICE', desc:'The machines took the third floor.' },
};
let MAPKEY='yard';

/* ---------------- yard layout: obstacles + interactive props ---------------- */
const ARENA_W=2600, ARENA_H=2000;
const OBST = [
  { s:'r', x:2080, y:140,  w:380, h:290, type:'shed' },
  { s:'c', x:2160, y:1560, r:150, type:'pool' },
  { s:'c', x:380,  y:255,  r:46,  type:'grill' },
  { s:'c', x:700,  y:1470, r:18,  type:'tree' },
  { s:'c', x:1780, y:560,  r:18,  type:'tree' },
  { s:'r', x:1060, y:330,  w:300, h:56,  type:'hedge' },
  { s:'r', x:530,  y:960,  w:56,  h:320, type:'hedge' },
  { s:'r', x:1560, y:1330, w:320, h:56,  type:'hedge' },
  { s:'r', x:250,  y:1620, w:250, h:115, type:'car' },
];
const TRAMP = { x:1330, y:1650, r:86, anim:0 };
const MUD   = { x:940,  y:760,  r:96 };
const SPRINK= { x:1520, y:980,  a:0 };
const GRILLPOS = { x:380, y:255 };
const BURGER_SPOT = { x:380, y:352 };
const TREES = [ {x:700,y:1470}, {x:1780,y:560} ];
const FLAM = [
  { x:2340, y:320,  up:true, f:0, dir:1 },
  { x:820,  y:1780, up:true, f:0, dir:-1 },
  { x:1980, y:830,  up:true, f:0, dir:1 },
];
function resolveObst(px,py,pr){
  for(const o of OBST){
    if(o.s==='c'){
      let dx=px-o.x, dy=py-o.y, d=Math.hypot(dx,dy);
      const min=pr+o.r;
      if(d<min){ if(d<0.001){ dx=1; dy=0; d=1; } px=o.x+dx/d*min; py=o.y+dy/d*min; }
    } else {
      const cx=clamp(px,o.x,o.x+o.w), cy=clamp(py,o.y,o.y+o.h);
      let dx=px-cx, dy=py-cy;
      const d2=dx*dx+dy*dy;
      if(d2<pr*pr){
        if(d2>0.0001){ const d=Math.sqrt(d2); px=cx+dx/d*pr; py=cy+dy/d*pr; }
        else {
          const l=px-o.x, r2=o.x+o.w-px, t=py-o.y, b=o.y+o.h-py;
          const m=Math.min(l,r2,t,b);
          if(m===l) px=o.x-pr; else if(m===r2) px=o.x+o.w+pr;
          else if(m===t) py=o.y-pr; else py=o.y+o.h+pr;
        }
      }
    }
  }
  return [px,py];
}
function inMud(x,y){ return dist2(x,y,MUD.x,MUD.y) < MUD.r*MUD.r; }

/* ---------------- champions ----------------
   mods are flat deltas on the base stats in newGame():
   maxHP 50, regen 0, dmg 1, atk 1, move 240, armor 0, pickup 80, crit 0.03 */
const CHAMPS = {
  dad:    { name:'The Dad', icon:'👟', role:'ALL-ROUNDER', weapon:'stapler',
            blurb:'The original. Maximum cushion, zero weaknesses.',
            mods:{}, perk:null,
            perkDesc:'Perfectly average in every way. The HOA approves.' },
  karen:  { name:'Karen', icon:'📋', role:'CASTER', weapon:'tps', wpref:'blast',
            blurb:'HOA President. She has already spoken to your manager.',
            mods:{ maxHP:-5, move:12 }, perk:'complaint',
            perkDesc:'HOA Complaint: machines near her are slowed 28%.' },
  coach:  { name:'Coach Dad', icon:'🏈', role:'MELEE', weapon:'whacker', wpref:'melee',
            blurb:'Still wears the whistle. Still doing laps.',
            mods:{ move:26, maxHP:5 }, perk:'whistle',
            perkDesc:'Airhorn Dash: dashing blasts machines back. Melee damage +30%.' },
  itdad:  { name:'KevBoi', icon:'🖥️', role:'RANGED', weapon:'stapler', wpref:'ranged',
            blurb:'Fixed your printer once. Never lets you forget it.',
            mods:{ maxHP:-10, crit:0.09 }, perk:'overclock',
            perkDesc:'Overclock: critical hits deal triple damage instead of double.' },
  grill:  { name:'Grill Dad', icon:'🍔', role:'TANK', weapon:'mug', wpref:'blast',
            blurb:'The propane is a lifestyle.',
            mods:{ maxHP:15, move:-18 }, perk:'grillmaster',
            perkDesc:'Grillmaster: burgers heal double and the grill cooks much faster.' },
  coupon: { name:'Coupon Mom', icon:'🛒', role:'SUPPORT', weapon:'darts',
            blurb:'Never paid full price. Never will.',
            mods:{ pickup:40 }, perk:'coupons',
            perkDesc:'Coupon Book: shop prices 20% off and rerolls half price.' },
  yoga:   { name:'Yoga Mom', icon:'🧘', role:'MELEE', weapon:'blower', wpref:'melee',
            blurb:'Inhale serenity. Exhale leaf blower.',
            mods:{ move:16, maxHP:-5 }, perk:'flow',
            perkDesc:'Flow State: dash recharges twice as fast with longer i-frames.' },
  ned:    { name:'CamDawg', icon:'🔦', role:'RANGED', weapon:'darts', wpref:'ranged', wonly:['ranged'],
            blurb:'Neighborhood Watch. His doorbell cam has the footage to prove it.',
            mods:{ dmg:0.08 }, perk:'binoculars',
            perkDesc:'Binoculars: +25% weapon range.' },
  hank:   { name:'Handyman Hank', icon:'🔧', role:'TANK', weapon:'whacker', wpref:'melee',
            blurb:'Fixes fences. Settles scores.',
            mods:{ maxHP:10, armor:2, move:-10 }, perk:'thorns',
            perkDesc:'Thorns: machines that hit him take damage right back.' },
  brenda: { name:'Book Club Brenda', icon:'📚', role:'CASTER', weapon:'mug', wpref:'blast', wonly:['blast'],
            blurb:'This month\'s pick: The Art of War.',
            mods:{ dmg:0.05 }, perk:'bookclub',
            perkDesc:'Plot Twist: explosions are 45% bigger.' },
  gus:    { name:'Retired Marine Gus', icon:'🎖️', role:'TANK', weapon:'whacker',
            wpref:'melee', wonly:['melee','blast'],
            blurb:'Reactivated for one last yard.',
            mods:{ maxHP:30, move:-36, armor:1 }, perk:'oorah',
            perkDesc:'Oorah: below half HP he deals +25% damage.' },
};

/* ---------------- difficulty ----------------
   hp/dmg scale the machines, rate scales spawn pressure, loot scales bolts */
const DIFFS = {
  1:{ name:'LAZY SUNDAY',     desc:'The machines are half asleep. A gentle mow.', hp:0.75, dmg:0.7,  rate:0.8,  loot:0.85 },
  2:{ name:'WEEKDAY',         desc:'The standard shift.',                          hp:1,    dmg:1,    rate:1,    loot:1 },
  3:{ name:'WEEKEND WARRIOR', desc:'They brought friends.',                        hp:1.3,  dmg:1.2,  rate:1.2,  loot:1.15 },
  4:{ name:'HOA AUDIT',       desc:'Everything is out to get you. Even the lawn.', hp:1.7,  dmg:1.45, rate:1.45, loot:1.35 },
  5:{ name:'ROBOT UPRISING',  desc:'The singularity arrived and it is furious.',   hp:2.2,  dmg:1.8,  rate:1.7,  loot:1.6 },
};
const DF=()=>DIFFS[G.diff||2];
/* mower charge requirement grows with the wave so the ult stays a moment,
   not a permanent state; upgrades lower the base before scaling */
function scaledUltNeed(st){
  const w=Math.max(1,(G&&G.wave)||1);
  return Math.round((st.ultNeed||ULT_NEED)*(1+0.15*(w-1)));
}

/* ---------------- chore contracts (optional wave objectives) ---------------- */
const CONTRACTS = [
  { key:'mow',    n:6,  txt:'Scrap 6 machines with the mower' },
  { key:'swarm',  n:8,  txt:'Scrap 8 Swarmlets' },
  { key:'bolts',  n:25, txt:'Collect 25 bolts this wave' },
  { key:'nodmg',  n:0,  txt:'Take zero damage this wave' },
  { key:'flam',   n:0,  txt:'Keep every flamingo standing' },
  { key:'burger', n:2,  txt:'Eat 2 burgers this wave' },
];

/* ---------------- neighbor favors (borrow a weak perk for one wave) ---------------- */
const FAVORS = {
  dad:   { desc:'+5% damage and attack speed this wave', deltas:{ dmg:0.05, atk:0.05 } },
  karen: { desc:'Machines near you slowed 15% this wave', deltas:{ auraSlow:0.15 } },
  coach: { desc:'+15% melee damage this wave', deltas:{ meleeMul:0.15 } },
  itdad: { desc:'+50% crit damage this wave', deltas:{ critMul:0.5 } },
  grill: { desc:'Burgers heal +50% this wave', deltas:{ burgerMul:0.5 } },
  coupon:{ desc:'+15% luck this wave', deltas:{ luck:0.15 } },
  yoga:  { desc:'Dash recharges 0.6s faster this wave', deltas:{ dashCdMax:-0.6 } },
  ned:   { desc:'+12% weapon range this wave', deltas:{ rangeMul:0.12 } },
  hank:  { desc:'Thorns 5 this wave', deltas:{ thorns:5 } },
  brenda:{ desc:'+20% bigger explosions this wave', deltas:{ areaMul:0.2 } },
  gus:   { desc:'+12% damage below half HP this wave', deltas:{ rage:0.12 } },
};

/* ---------------- yard investments (per-run upgrades to the map itself) ---------------- */
const YARD_UPGRADES = {
  grill: { name:'Grill Upgrade', icon:'🍔', costs:[20,40],
    descs:['Grill cooks 35% faster','Burgers heal +10'],
    oname:'Microwave Upgrade', odescs:['Microwave runs 35% faster','Snacks heal +10'] },
  sprink:{ name:'Sprinkler Pressure', icon:'💦', costs:[18,36],
    descs:['Sprinkler hits 3x harder','Sprinkler arc twice as wide'],
    oname:'Fan Overclock', odescs:['Desk fan hits 3x harder','Fan arc twice as wide'] },
  tramp: { name:'Trampoline Grease', icon:'🤸', costs:[15,30],
    descs:['Bigger launch and longer i-frames','Launching blasts machines away'],
    oname:'Chair Grease', odescs:['Bigger launch and longer i-frames','Launching blasts machines away'] },
  mower: { name:'Mower Tune-Up', icon:'🚜', costs:[25,50],
    descs:['Mower ready 5 kills sooner','Mower runs 2 seconds longer'],
    oname:'Floor Buffer Keys', odescs:['Buffer ready 5 kills sooner','Buffer runs 2 seconds longer'] },
  pool:  { name:'Pool Chemicals', icon:'🏖️', costs:[12,24],
    descs:['Machines slowed much harder in the pool','Machines rust: 4 damage per second in the pool'],
    oname:'Spill Solvent', odescs:['Machines slowed much harder in the spill','Machines corrode: 4 damage per second in the spill'] },
};
function yardName(k){ const u=YARD_UPGRADES[k]; return (MAPKEY==='office'&&u.oname)?u.oname:u.name; }
function champCanUse(cls){ const c=CHAMPS[(G&&G.champ)||'dad']||CHAMPS.dad; return !c.wonly||c.wonly.includes(cls); }
function yardDescs(k){ const u=YARD_UPGRADES[k]; return (MAPKEY==='office'&&u.odescs)?u.odescs:u.descs; }

/* ---------------- enemy traits (affixes from wave 6 on) ---------------- */
const TRAITS={
  turbo:   { name:'TURBO',    color:'#8fd8ff', glow:'blue',   apply:e=>{ e.spd*=1.45; } },
  armored: { name:'ARMORED',  color:'#c9cdd4', glow:'white',  apply:e=>{ e.dr=0.3; } },
  volatile:{ name:'VOLATILE', color:'#ff9a4d', glow:'orange', apply:e=>{ e.volatile=true; } },
  giant:   { name:'GIANT',    color:'#c48df0', glow:'purple', apply:e=>{ e.hp*=1.6; e.maxhp*=1.6; e.giant=true; e.spd*=0.85; e.dmg2=1.3; } },
  leech:   { name:'LEECH',    color:'#9be06f', glow:'green',  apply:e=>{ e.leech=true; } },
};

/* ---------------- leveling ---------------- */
function xpNeed(l){ return 10 + (l-1)*8; }
const LEVEL_UPS = [
  { t:'+7 Max HP', d:'Tougher. Also heals 7.', a:st=>{ st.maxHP+=7; G.hp=Math.min(G.hp+7,st.maxHP); } },
  { t:'+1 Regen', d:'Every 4 seconds.', a:st=>st.regen+=1 },
  { t:'+6% Damage', d:'All damage.', a:st=>st.dmg+=0.06 },
  { t:'+6% Attack Speed', d:'Everything fires faster.', a:st=>st.atk+=0.06 },
  { t:'+14 Move Speed', d:'New stride unlocked.', a:st=>st.move+=14 },
  { t:'+1 Armor', d:'Flat damage reduction.', a:st=>st.armor+=1 },
  { t:'+4% Crit', d:'Chance to double up.', a:st=>st.crit+=0.04 },
  { t:'+20 Pickup Range', d:'Bolts come to you.', a:st=>st.pickup+=20 },
  { t:'+4% Dodge', d:'Chance to avoid hits entirely.', a:st=>st.dodge+=0.04 },
  { t:'+8% Luck', d:'Better loot, better shop tiers.', a:st=>st.luck+=0.08 },
  { t:'+8% Melee Damage', d:'Blower and whacker class.', a:st=>st.meleeMul+=0.08 },
  { t:'+8% Ranged Damage', d:'Staples, darts, drivers.', a:st=>st.rangedMul+=0.08 },
  { t:'+8% Blast Damage', d:'Explosions and caster tools.', a:st=>st.blastMul+=0.08 },
  { t:'+2% Lifesteal', d:'Damage dealt heals you.', a:st=>st.lifesteal+=0.02 },
];

/* per-champ palette for the vector character art; missing keys fall back to
   the dad's default look. PNG sprites replace this whole system in Phase 2. */
const LOOKS = {
  dad:   { shirt:'#4f81b0', shirt2:'#3f6b94', shorts:'#c9b483', shorts2:'#b5a071',
           hair:'#9a9a9a', top:'#efd9bd', must:'#7c7c7c', sock:'#c22e35' },
  karen: { shirt:'#d66a9c', shirt2:'#b2527f', shorts:'#f0ece0', shorts2:'#d6d0c0',
           hair:'#e8c95a', top:'#e8c95a', must:null },
  coach: { shirt:'#c22e35', shirt2:'#9c2028', shorts:'#33383f', shorts2:'#23272e',
           hair:'#5a4128', must:'#5a4128', sock:'#33383f' },
  itdad: { shirt:'#2f3e4d', shirt2:'#232f3b', shorts:'#8b93a3', shorts2:'#6f7683',
           hair:'#2a2a2a', must:'#2a2a2a' },
  grill: { shirt:'#e8e4da', shirt2:'#c9c2a8', shorts:'#6b4f2a', shorts2:'#57401f',
           sock:'#e0a34d' },
  coupon:{ shirt:'#6fae5c', shirt2:'#578a48', shorts:'#4a5a8c', shorts2:'#3b4870',
           hair:'#8c5a2e', top:'#8c5a2e', must:null },
  yoga:  { shirt:'#b98ade', shirt2:'#9a6cc0', shorts:'#33383f', shorts2:'#23272e',
           hair:'#3a2c1c', top:'#3a2c1c', must:null },
  ned:   { shirt:'#e0a34d', shirt2:'#c28434', shorts:'#5f4d38', shorts2:'#4a3c2a',
           hair:'#4a4a4a', must:'#4a4a4a' },
  hank:  { shirt:'#a03c30', shirt2:'#7f2f26', shorts:'#4a5a8c', shorts2:'#3b4870',
           hair:'#3a2c1c', must:'#3a2c1c' },
  brenda:{ shirt:'#4da3a0', shirt2:'#3b807e', shorts:'#7a5c8a', shorts2:'#61476e',
           hair:'#b04a3a', top:'#b04a3a', must:null },
  gus:   { shirt:'#5b6e4f', shirt2:'#47573d', shorts:'#5b6e4f', shorts2:'#47573d',
           hair:'#c9cdd4', top:'#c9cdd4', must:'#c9cdd4' },
};

