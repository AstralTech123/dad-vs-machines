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
  stapler:{ name:'Staple Gun', desc:'Rapid-fire office staples.',
    dmg:4, cd:0.42, range:340, speed:560, pierce:0, knock:70, price:12, pitch:1.5, bcolor:'#dfe6f0' },
  tps:{ name:'TPS Report', desc:'Piercing paperwork. Did you get the memo?',
    dmg:7, cd:0.95, range:420, speed:470, pierce:2, knock:55, price:14, pitch:1.2, bcolor:'#ffffff' },
  darts:{ name:'Lawn Darts', desc:'Three darts. Banned in several states.',
    dmg:5, cd:1.0, range:330, speed:440, pierce:0, knock:80, count:3, spread:0.38, price:16, pitch:1.0, bcolor:'#ffd166' },
  mug:{ name:'Coffee Mug', desc:'Explodes on impact. It was decaf anyway.',
    dmg:9, cd:1.5, range:380, speed:340, pierce:0, knock:130, aoe:78, price:18, pitch:0.8, bcolor:'#f4eeda' },
  driver:{ name:'Golf Driver', desc:'FORE. Drives through everything.',
    dmg:15, cd:1.65, range:540, speed:760, pierce:4, knock:180, price:20, pitch:0.6, bcolor:'#f4fbff' },
  case:{ name:'Briefcase', desc:'Boomerangs through the org chart.',
    dmg:10, cd:1.7, range:290, speed:430, pierce:99, knock:100, boomerang:true, price:18, pitch:0.7, bcolor:'#a97b50' },
  blower:{ name:'Leaf Blower', desc:'Low damage, absurd knockback. Saturday energy.',
    dmg:3, cd:0.14, range:190, cone:0.62, knock:300, melee:'cone', price:16, pitch:2.0 },
  whacker:{ name:'Weed Whacker', desc:'Orbits you, trimming anything that gets close.',
    dmg:6, cd:0.45, orbitR:82, orbitSpd:3.4, melee:'orbit', price:16, pitch:1.1 },
};
const ITEMS = {
  chair:{ name:'Ergonomic Chair', icon:'💺', stat:'maxHP', vals:[6,12,20], price:10,
    fmt:v=>`+${v} Max HP`, note:'Lumbar support is life support.' },
  fiber:{ name:'Fiber Supplements', icon:'💊', stat:'regen', vals:[1,2,3], price:11,
    fmt:v=>`+${v} HP every 4s`, note:'Keeps everything running on schedule.' },
  strength:{ name:'Dad Strength', icon:'💪', stat:'dmg', vals:[0.08,0.15,0.24], price:12,
    fmt:v=>`+${Math.round(v*100)}% Damage`, note:'Unexplained. Unstoppable.' },
  energy:{ name:'Weekend Energy', icon:'⚡', stat:'atk', vals:[0.08,0.14,0.22], price:12,
    fmt:v=>`+${Math.round(v*100)}% Attack Speed`, note:'The lawn will not mow itself.' },
  sneakers:{ name:'New Balance 624s', icon:'👟', stat:'move', vals:[0.08,0.14,0.22], price:11,
    fmt:v=>`+${Math.round(v*100)}% Move Speed`, note:'Maximum cushion. Maximum velocity.' },
  cargo:{ name:'Cargo Shorts', icon:'🩳', stat:'armor', vals:[1,2,3], price:11,
    fmt:v=>`+${v} Armor`, note:'The pockets absorb the damage.' },
  costco:{ name:'Costco Card', icon:'🛒', stat:'pickup', vals:[30,55,90], price:9,
    fmt:v=>`+${v} Pickup Range`, note:'Buys bolts in bulk.' },
  glasses:{ name:'Reading Glasses', icon:'👓', stat:'crit', vals:[0.06,0.10,0.16], price:12,
    fmt:v=>`+${Math.round(v*100)}% Crit Chance`, note:'Now he sees the fine print.' },
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
  groomba:{ name:'GOLDEN ROOMBA', hp:90, spd:92, dmg:8, r:20, cost:0, minW:99, mats:0, weight:0, ai:'gcharge', knockR:0.3, elite:true },
  printer:{ name:'PRINTER OF DOOM', hp:120, spd:46, dmg:0, shot:7, r:22, cost:0, minW:99, mats:0, weight:0, ai:'printer', knockR:0.3, elite:true },
  mother:{ name:'MOTHER DRONE', hp:150, spd:66, dmg:6, r:26, cost:0, minW:99, mats:0, weight:0, ai:'mother', knockR:0.3, elite:true },
  algo:{ name:'THE ALGORITHM', hp:900, spd:42, dmg:12, r:40, cost:0, minW:99, mats:0, weight:0, ai:'algo', knockR:0 },
  boss:{ name:'AGI-PRIME', hp:2100, spd:46, dmg:15, r:56, cost:0, minW:99, mats:0, weight:0, ai:'boss', knockR:0 },
};
const WAVE_DUR = [0,30,35,40,45,50,55,60,65,70,70];
const FINAL_WAVE = 10;
const MAX_SLOTS = 6;
const ULT_NEED = 25;
const BOSS_WAVES = {5:'algo', 10:'boss'};

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
  karen:  { name:'Karen', icon:'📋', role:'CASTER', weapon:'tps',
            blurb:'HOA President. She has already spoken to your manager.',
            mods:{ maxHP:-5, move:12 }, perk:'complaint',
            perkDesc:'HOA Complaint: machines near her are slowed 28%.' },
  coach:  { name:'Coach Dad', icon:'🏈', role:'MELEE', weapon:'whacker',
            blurb:'Still wears the whistle. Still doing laps.',
            mods:{ move:26, maxHP:5 }, perk:'whistle',
            perkDesc:'Airhorn Dash: dashing blasts machines back. Melee damage +30%.' },
  itdad:  { name:'IT Dad', icon:'🖥️', role:'RANGED', weapon:'stapler',
            blurb:'Have you tried turning the robots off and on again?',
            mods:{ maxHP:-10, crit:0.09 }, perk:'overclock',
            perkDesc:'Overclock: critical hits deal triple damage instead of double.' },
  grill:  { name:'Grill Dad', icon:'🍔', role:'TANK', weapon:'mug',
            blurb:'The propane is a lifestyle.',
            mods:{ maxHP:15, move:-18 }, perk:'grillmaster',
            perkDesc:'Grillmaster: burgers heal double and the grill cooks much faster.' },
  coupon: { name:'Coupon Mom', icon:'🛒', role:'SUPPORT', weapon:'darts',
            blurb:'Never paid full price. Never will.',
            mods:{ pickup:40 }, perk:'coupons',
            perkDesc:'Coupon Book: shop prices 20% off and rerolls half price.' },
  yoga:   { name:'Yoga Mom', icon:'🧘', role:'MELEE', weapon:'blower',
            blurb:'Inhale serenity. Exhale leaf blower.',
            mods:{ move:16, maxHP:-5 }, perk:'flow',
            perkDesc:'Flow State: dash recharges twice as fast with longer i-frames.' },
  ned:    { name:'Watchman Ned', icon:'🔦', role:'RANGED', weapon:'darts',
            blurb:'Neighborhood Watch. He saw you. He sees everything.',
            mods:{ dmg:0.08 }, perk:'binoculars',
            perkDesc:'Binoculars: +25% weapon range.' },
  hank:   { name:'Handyman Hank', icon:'🔧', role:'TANK', weapon:'whacker',
            blurb:'Fixes fences. Settles scores.',
            mods:{ maxHP:10, armor:2, move:-10 }, perk:'thorns',
            perkDesc:'Thorns: machines that hit him take damage right back.' },
  brenda: { name:'Book Club Brenda', icon:'📚', role:'CASTER', weapon:'mug',
            blurb:'This month\'s pick: The Art of War.',
            mods:{ dmg:0.05 }, perk:'bookclub',
            perkDesc:'Plot Twist: explosions are 45% bigger.' },
  gus:    { name:'Retired Marine Gus', icon:'🎖️', role:'TANK', weapon:'driver',
            blurb:'Reactivated for one last yard.',
            mods:{ maxHP:30, move:-36, armor:1 }, perk:'oorah',
            perkDesc:'Oorah: below half HP he deals +25% damage.' },
};

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

