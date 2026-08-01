/* =========================================================================
   DAD vs THE MACHINES v3
   New: 2600x2000 designed yard with solid obstacles, interactive props
   (grill cooks healing burgers, trampoline launches, kiddie pool slows,
   sprinkler attacks machines, flamingos tip over), roaming elite machines
   with loot, timer-end bosses on waves 5 and 10, airdrop crates, three new
   enemy types (delivery drone, IT support bot, firewall bot), and two
   active abilities: SPACE dash and the rideable mower ultimate on E.
   ========================================================================= */

/* ---------------- game state ---------------- */
let G=null, AT=0;
function newGame(){
  G = {
    mode:'menu', t:0, wave:0, waveTime:0, sub:'play', subT:0,
    champ:'dad', perk:null,
    mats:0, kills:0, totalMats:0,
    stats:{ maxHP:50, regen:0, dmg:1, atk:1, move:240, armor:0, pickup:80, crit:0.03,
      critMul:2, priceMul:1, rerollMul:1, dashCdMax:2.5, dashIF:0.35, rangeMul:1,
      areaMul:1, burgerMul:1, grillMul:1, meleeMul:1, rangedMul:1, blastMul:1,
      dodge:0, luck:0, lifesteal:0, thorns:0, auraSlow:0, rage:0 },
    itemCounts:{},
    hp:50,
    player:{ x:1300, y:1000, vx:0, vy:0, face:1, bob:0, iframe:0, regenT:0, dead:false, deadT:0, lean:0,
      dashCd:0, dashT:0, ddx:1, ddy:0, bvx:0, bvy:0, mowT:0, ult:0, trampCd:0 },
    weapons:[ mkWeapon('stapler',1) ],
    bullets:[], ebullets:[], enemies:[], pickups:[], parts:[], texts:[], warns:[],
    cam:{ x:1300, y:1000, shake:0 },
    spawnBudget:0, boss:null,
    grillT:8, burgerOut:false, dropT:18, eliteQ:[], ultToast:false, mowSfxT:0,
    shop:{ offers:[], rerolls:0 },
  };
  for(const fl of FLAM){ fl.up=true; fl.f=0; }
  updateHUD(); renderSlots();
}
function mkWeapon(key,tier){ return { key, tier, cd:rand(0,0.3), aim:rand(0,TAU), recoil:0, orbitA:rand(0,TAU), flash:0 }; }

/* ---------------- input ---------------- */
const keys={};
addEventListener('keydown', e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()]=true;
  const k=e.key.toLowerCase();
  if(k==='m') toggleMute();
  if(k==='p' || e.key==='Escape') togglePause();
  if(k===' ') tryDash();
  if(k==='e') tryMow();
});
addEventListener('keyup', e=> keys[e.key.toLowerCase()]=false);
addEventListener('touchstart', ()=>{
  document.getElementById('touchnote').style.display='block';
  document.body.classList.add('touchy');
}, {once:true});

const touch={ active:false, id:null, ox:0, oy:0, dx:0, dy:0 };
const cvEl=document.getElementById('game');
cvEl.addEventListener('touchstart', e=>{
  if(e.touches.length>=2){ tryDash(); return; }
  const t=e.changedTouches[0];
  touch.active=true; touch.id=t.identifier;
  touch.ox=t.clientX; touch.oy=t.clientY; touch.dx=0; touch.dy=0;
}, {passive:true});
cvEl.addEventListener('touchmove', e=>{
  e.preventDefault();
  for(const t of e.changedTouches){
    if(t.identifier===touch.id){
      touch.dx=t.clientX-touch.ox; touch.dy=t.clientY-touch.oy;
      const m=Math.hypot(touch.dx,touch.dy);
      if(m>52){ touch.dx*=52/m; touch.dy*=52/m; }
    }
  }
}, {passive:false});
function endTouch(e){ for(const t of e.changedTouches){ if(t.identifier===touch.id){ touch.active=false; touch.dx=touch.dy=0; } } }
cvEl.addEventListener('touchend', endTouch);
cvEl.addEventListener('touchcancel', endTouch);

function togglePause(){
  if(G.mode==='play'){ G.mode='pause'; show('pause'); }
  else if(G.mode==='pause'){ G.mode='play'; hide('pause'); }
}
document.getElementById('pausebtn').addEventListener('click',()=>{ sfx.click(); togglePause(); });
document.getElementById('mutebtn').addEventListener('click',()=>{ toggleMute(); });
document.getElementById('ultwrap').addEventListener('click',()=>{ tryMow(); });
document.getElementById('dashbtn').addEventListener('touchstart',(e)=>{ e.preventDefault(); tryDash(); },{passive:false});

/* ---------------- menu attract bots ---------------- */
const DECOR=[];
(function mkDecor(){
  const kinds=['chat','roomba','beta','swarm','tank'];
  for(let i=0;i<5;i++){
    const key=kinds[i];
    let x=rand(800,1800), y=rand(700,1300);
    [x,y]=resolveObst(x,y,30);
    DECOR.push({ key, def:EDEFS[key], x, y, tx:x, ty:y, seed:rand(0,TAU), wobble:rand(0,9),
      state:0, stateT:0, windT:0, hp:1, maxhp:1, flash:0, kx:0, ky:0, trampCd:0 });
  }
})();
function updateDecor(dt){
  for(const d of DECOR){
    d.wobble+=dt;
    const dd=Math.hypot(d.tx-d.x,d.ty-d.y);
    if(dd<10){ d.tx=rand(760,1840); d.ty=rand(660,1340); }
    const a=Math.atan2(d.ty-d.y,d.tx-d.x);
    d.x+=Math.cos(a)*34*dt; d.y+=Math.sin(a)*34*dt;
    [d.x,d.y]=resolveObst(d.x,d.y,d.def.r*0.8);
  }
}

/* ---------------- main loop ---------------- */
let last=performance.now();
function loop(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  AT+=dt;
  updateFlies(dt);
  if(G.mode==='menu'){ updateDecor(dt); G.player.bob+=dt*3; SPRINK.a+=0.75*dt; }
  if(G.mode==='play'){
    G.t+=dt;
    updatePlayer(dt);
    updateWeapons(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateWarns(dt);
    updateSpawning(dt);
    updateYard(dt);
    updatePickups(dt);
    updateParts(dt);
    updateTexts(dt);
    updateWaveFlow(dt);
    G.cam.shake=Math.max(0,G.cam.shake-dt*40);
    G.cam.x=lerp(G.cam.x,G.player.x,Math.min(1,8*dt));
    G.cam.y=lerp(G.cam.y,G.player.y,Math.min(1,8*dt));
    const Z=zoomLevel(), hw=VW/2/Z, hh=VH/2/Z;
    G.cam.x=clamp(G.cam.x,Math.min(hw,ARENA_W/2),Math.max(ARENA_W-hw,ARENA_W/2));
    G.cam.y=clamp(G.cam.y,Math.min(hh,ARENA_H/2),Math.max(ARENA_H-hh,ARENA_H/2));
    if(G.sub==='play') updateHUD();
  } else {
    updateParts(dt); updateTexts(dt);
  }
  draw();
  requestAnimationFrame(loop);
}
newGame();
requestAnimationFrame(loop);
