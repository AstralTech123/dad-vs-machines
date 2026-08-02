/* =========================================================================
   DAD vs THE MACHINES
   Boot, state, input (keyboard, touch, multi-gamepad), couch co-op player
   management, and the main loop. Up to 4 players: P1 on keyboard/mouse or
   pad, P2-P4 join by pressing A on a controller at the champ select.
   ========================================================================= */

/* ---------------- game state ---------------- */
let G=null, AT=0, COOPZ=1;
const PCOLORS=['#ffd166','#6ec6ff','#9be06f','#ef7fa6'];
function baseStats(){
  return { maxHP:50, regen:0, dmg:1, atk:1, move:240, armor:0, pickup:80, crit:0.03,
    critMul:2, priceMul:1, rerollMul:1, dashCdMax:2.5, dashIF:0.35, rangeMul:1,
    areaMul:1, burgerMul:1, grillMul:1, meleeMul:1, rangedMul:1, blastMul:1,
    dodge:0, luck:0, lifesteal:0, thorns:0, auraSlow:0, rage:0,
    ultNeed:25, mowDur:5 };
}
function mkPlayer(pad,champ){
  return {
    pad:(pad===undefined?null:pad), champ:champ||'dad', perk:null,
    stats:baseStats(), hp:50, lsAcc:0,
    body:{ x:1300, y:1000, vx:0, vy:0, face:1, bob:0, iframe:0, regenT:0, dead:false, deadT:0, lean:0,
      dashCd:0, dashT:0, ddx:1, ddy:0, bvx:0, bvy:0, mowT:0, ult:0, trampCd:0, champ:champ||'dad' },
    weapons:[ mkWeapon('stapler',1) ],
    itemCounts:{}, abil:{},
    reviveT:0, earned:0,
  };
}
/* the whole codebase reads G.player/G.stats/G.hp/...; those are ALIASES to
   the currently active player. setActive points them at a player, saveActive
   writes the scalar fields back. Single player = players[0] active always. */
function setActive(pl){
  G.active=pl;
  G.player=pl.body; G.stats=pl.stats; G.weapons=pl.weapons;
  G.itemCounts=pl.itemCounts; G.abil=pl.abil;
  G.hp=pl.hp; G.champ=pl.champ; G.perk=pl.perk; G.lsAcc=pl.lsAcc;
}
function saveActive(){
  const pl=G.active; if(!pl) return;
  pl.hp=G.hp; pl.champ=G.champ; pl.perk=G.perk; pl.lsAcc=G.lsAcc||0;
  pl.body.champ=G.champ;
}
function livingPlayers(){ return G.players.filter(p=>!p.body.dead); }
function nearestPlayer(x,y){
  let best=null, bd=Infinity;
  for(const pl of G.players){
    if(pl.body.dead) continue;
    const dd=dist2(x,y,pl.body.x,pl.body.y);
    if(dd<bd){ bd=dd; best=pl; }
  }
  return best;
}
function newGame(){
  G = {
    mode:'menu', t:0, wave:0, waveTime:0, sub:'play', subT:0,
    diff:2, endless:false,
    xp:0, level:1, pendingLvls:0,
    yard:{ grill:0, sprink:0, tramp:0, mower:0, pool:0 },
    favorNext:null, favorApplied:null, favorNextWave:0, contract:null,
    gnomes:[], otT:0,
    mats:0, kills:0, totalMats:0,
    players:[], active:null, shopFor:0,
    bullets:[], ebullets:[], enemies:[], pickups:[], parts:[], texts:[], warns:[],
    cam:{ x:1300, y:1000, shake:0 },
    spawnBudget:0, boss:null,
    grillT:8, burgerOut:false, dropT:18, eliteQ:[], ultToast:false, mowSfxT:0,
    shop:{ offers:[], rerolls:0 },
  };
  const p0=mkPlayer(null,'dad');
  G.players=[p0];
  setActive(p0);
  COOPZ=1;
  for(const fl of FLAM){ fl.up=true; fl.f=0; }
  updateHUD(); renderSlots();
}
function mkWeapon(key,tier){ return { key, tier, cd:rand(0,0.3), aim:rand(0,TAU), recoil:0, orbitA:rand(0,TAU), flash:0 }; }

/* ---------------- input: keyboard + touch (player 1) ---------------- */
/* keyboard presets, saved in the browser. touch and gamepads are automatic. */
let BINDS={ dash:' ', mow:'e', name:'SPACE dash · E mower' };
try{ const s=JSON.parse(localStorage.getItem('dvm_binds')||'null'); if(s&&s.dash) BINDS=s; }catch(err){}
function setBinds(b){
  BINDS=b;
  try{ localStorage.setItem('dvm_binds',JSON.stringify(b)); }catch(err){}
  const h=document.getElementById('hintline');
  if(h) h.textContent='P pause · M mute · '+BINDS.name;
}
const keys={};
addEventListener('keydown', e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()]=true;
  const k=e.key.toLowerCase();
  if(k==='m') toggleMute();
  if(k==='p' || e.key==='Escape') togglePause();
  if(k===BINDS.dash || (BINDS.dash===' '&&e.key===' ')){ setActive(G.players[0]); tryDash(); saveActive(); }
  if(k===BINDS.mow){ setActive(G.players[0]); tryMow(); saveActive(); }
});
setBinds(BINDS);
addEventListener('keyup', e=> keys[e.key.toLowerCase()]=false);
addEventListener('touchstart', ()=>{
  document.getElementById('touchnote').style.display='block';
  document.body.classList.add('touchy');
}, {once:true});

const touch={ active:false, id:null, ox:0, oy:0, dx:0, dy:0 };
const cvEl=document.getElementById('game');
cvEl.addEventListener('touchstart', e=>{
  if(e.touches.length>=2){ setActive(G.players[0]); tryDash(); saveActive(); return; }
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

/* ---------------- gamepads: poll every pad, per-pad edges ---------------- */
const PADS={};            // index -> {x,y,mag,pressed:{},edge:{}}
const PAD={ active:false, x:0, y:0 };   // legacy single-pad alias for P1 without a slot
const LOBBY=[];           // pad joiners at champ select: {pad, champIdx}
addEventListener('gamepadconnected', e=>{ toast('🎮 Controller connected. Press A at champ select to join.'); });
addEventListener('gamepaddisconnected', e=>{
  delete PADS[e.gamepad.index];
  const j=LOBBY.findIndex(l=>l.pad===e.gamepad.index);
  if(j>=0){ LOBBY.splice(j,1); if(typeof renderLobby==='function') renderLobby(); }
  if(G && G.mode==='play' && G.players.some(p=>p.pad===e.gamepad.index)){
    togglePause(); toast('🎮 A controller disconnected. Reconnect and resume.');
  }
});
function updatePads(){
  const gps=navigator.getGamepads? navigator.getGamepads() : [];
  for(const gp of gps){
    if(!gp) continue;
    /* only real controllers: wheels, receivers, and phantom HID devices
       report a non-standard mapping and must never join or steer */
    if(gp.mapping!=='standard') continue;
    let st=PADS[gp.index];
    if(!st){
      /* first sighting: record button state WITHOUT firing edges so a
         stuck or phantom-pressed button cannot ghost-join the lobby */
      st=PADS[gp.index]={ x:0,y:0,mag:0, pressed:{}, edge:{}, axHeld:null };
      for(let i=0;i<gp.buttons.length;i++){
        st.pressed[i]=!!(gp.buttons[i]&&gp.buttons[i].pressed);
        st.edge[i]=false;
      }
      continue;
    }
    const x=gp.axes[0]||0, y=gp.axes[1]||0, mag=Math.hypot(x,y);
    /* a stick must prove it can rest near center once before its axes are
       trusted; devices pinned at full tilt (pedals, broken sticks, phantom
       HID gear) never calibrate and can never steer anyone */
    if(!st.calibrated && mag<0.12) st.calibrated=true;
    if(st.calibrated && mag>0.24){ st.x=x; st.y=y; st.mag=mag; }
    else { st.x=0; st.y=0; st.mag=0; }
    for(let i=0;i<gp.buttons.length;i++){
      const p=!!(gp.buttons[i]&&gp.buttons[i].pressed);
      st.edge[i]=p&&!st.pressed[i];
      st.pressed[i]=p;
    }
    /* dpad-or-stick flicks for menu navigation */
    st.edgeLeft = st.edge[14] || (x<-0.6&&!st.axHeld&&(st.axHeld='l')&&true);
    st.edgeRight= st.edge[15] || (x>0.6&&!st.axHeld&&(st.axHeld='r')&&true);
    if(Math.abs(x)<0.4) st.axHeld=null;
    st.edgeUp   = st.edge[12] || (y<-0.6&&!st.ayHeld&&(st.ayHeld='u')&&true);
    st.edgeDown = st.edge[13] || (y>0.6&&!st.ayHeld&&(st.ayHeld='d')&&true);
    if(Math.abs(y)<0.4) st.ayHeld=null;
  }
}
function padOwner(idx){ return G.players.find(p=>p.pad===idx); }
function handlePadsGame(){
  for(const idxStr in PADS){
    const idx=Number(idxStr), st=PADS[idx];
    const pl=padOwner(idx) || (G.players.length===1 ? G.players[0] : null);
    if(st.edge[9]) togglePause();
    if(!pl) continue;
    if(st.edge[0]){ setActive(pl); tryDash(); saveActive(); }
    if(st.edge[1]||st.edge[2]){ setActive(pl); tryMow(); saveActive(); }
  }
  /* legacy PAD alias: single-player moves with any calibrated pad */
  PAD.active=false;
  if(G.players.length===1){
    for(const idxStr in PADS){
      const st=PADS[idxStr];
      if(st.mag>0){ PAD.active=true; PAD.x=st.x; PAD.y=st.y; break; }
    }
  }
}
/* controller players browse and buy on their own shop column */
function handlePadsShop(){
  if(G.mode!=='shop') return;
  if(!document.getElementById('levelup').classList.contains('hidden')) return;
  if(document.getElementById('shop').classList.contains('hidden')) return;
  if(G.players.length<2) return;
  G.players.forEach((pl)=>{
    if(pl.pad===null) return;
    const st=PADS[pl.pad]; if(!st) return;
    const n=(pl.offers?pl.offers.length:0)+1; /* +1 = reroll slot */
    if(st.edgeUp){ pl.shopCur=((pl.shopCur||0)+n-1)%n; sfx.click(); renderShop(); }
    if(st.edgeDown){ pl.shopCur=((pl.shopCur||0)+1)%n; sfx.click(); renderShop(); }
    if(st.edge[0]){
      if((pl.shopCur||0)<pl.offers.length) buyOffer(pl,pl.shopCur||0);
      else rerollFor(pl);
    }
    if(st.edge[2] && (pl.shopCur||0)<pl.offers.length){
      const o=pl.offers[pl.shopCur||0];
      if(o && !o.sold){ o.locked=!o.locked; sfx.click(); renderShop(); }
    }
  });
}
/* controller players pick their level-up on their own column */
function handlePadsLevelup(){
  if(!G.lvlState) return;
  if(document.getElementById('levelup').classList.contains('hidden')) return;
  G.players.forEach((pl,i)=>{
    if(pl.pad===null) return;
    const st=PADS[pl.pad]; if(!st) return;
    const ls=G.lvlState[i]; if(!ls||ls.done) return;
    if(st.edgeUp){ ls.cursor=(ls.cursor+ls.picks.length-1)%ls.picks.length; sfx.click(); renderLevelUp(); }
    if(st.edgeDown){ ls.cursor=(ls.cursor+1)%ls.picks.length; sfx.click(); renderLevelUp(); }
    if(st.edge[0]) chooseLevelUp(i,ls.cursor);
  });
}
function handlePadsLobby(){
  const open=!document.getElementById('champsel').classList.contains('hidden');
  if(!open) return;
  const champKeys=Object.keys(CHAMPS);
  for(const idxStr in PADS){
    const idx=Number(idxStr), st=PADS[idx];
    const joined=LOBBY.find(l=>l.pad===idx);
    if(!joined){
      if(st.edge[0] && LOBBY.length<3){
        LOBBY.push({ pad:idx, champIdx:Math.floor(rand(0,champKeys.length)) });
        toast('🎮 Player '+(LOBBY.length+1)+' joined the couch');
        sfx.buy(); renderLobby();
      }
      continue;
    }
    if(st.edgeLeft){ joined.champIdx=(joined.champIdx+champKeys.length-1)%champKeys.length; sfx.click(); renderLobby(); }
    if(st.edgeRight){ joined.champIdx=(joined.champIdx+1)%champKeys.length; sfx.click(); renderLobby(); }
    if(st.edge[1]){ LOBBY.splice(LOBBY.indexOf(joined),1); sfx.click(); renderLobby(); }
  }
}

function togglePause(){
  if(G.mode==='play'){
    G.mode='pause';
    document.getElementById('pausestats').innerHTML=pauseStatsAll();
    show('pause');
  }
  else if(G.mode==='pause'){ G.mode='play'; hide('pause'); }
}
document.getElementById('pausebtn').addEventListener('click',()=>{ sfx.click(); togglePause(); });
document.getElementById('mutebtn').addEventListener('click',()=>{ toggleMute(); });
document.getElementById('ultwrap').addEventListener('click',()=>{ setActive(G.players[0]); tryMow(); saveActive(); });
document.getElementById('dashbtn').addEventListener('touchstart',(e)=>{ e.preventDefault(); setActive(G.players[0]); tryDash(); saveActive(); },{passive:false});
document.getElementById('dashbtn').addEventListener('click',()=>{ setActive(G.players[0]); tryDash(); saveActive(); });

/* ---------------- downed teammates + revives ---------------- */
function updateRevives(dt){
  if(G.players.length<2) return;
  for(const pl of G.players){
    if(!pl.body.dead) continue;
    const near=livingPlayers().some(q=> dist2(q.body.x,q.body.y,pl.body.x,pl.body.y)<70*70);
    if(near){
      pl.reviveT+=dt;
      if(pl.reviveT>=2.5){
        pl.reviveT=0;
        pl.body.dead=false; pl.body.deadT=0;
        pl.hp=Math.round(pl.stats.maxHP*0.5);
        pl.body.iframe=1.2;
        floatText(pl.body.x,pl.body.y-40,'BACK ON THE CLOCK','#9be06f',true);
        sfx.levelup();
      }
    } else {
      pl.reviveT=Math.max(0,pl.reviveT-dt*0.7);
    }
  }
}

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
  updatePads();
  handlePadsGame();
  handlePadsLobby();
  handlePadsLevelup();
  handlePadsShop();
  if(AC) setTrack(G.mode==='menu'?'menu':'game');
  updateFlies(dt);
  if(G.mode==='menu'){ updateDecor(dt); G.players[0].body.bob+=dt*3; SPRINK.a+=0.75*dt; }
  if(G.mode==='play'){
    G.t+=dt;
    for(const pl of G.players){
      setActive(pl);
      updatePlayer(dt);
      if(!pl.body.dead) updateWeapons(dt);
      saveActive();
    }
    updateRevives(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateWarns(dt);
    updateSpawning(dt);
    updateYard(dt);
    updatePickups(dt);
    updateParts(dt);
    updateTexts(dt);
    updateWaveFlow(dt);
    setActive(G.players[0]);
    /* camera: midpoint of the living, zoom out when the couch spreads out */
    const alive=livingPlayers().length? livingPlayers() : G.players;
    let cx=0, cy=0;
    for(const pl of alive){ cx+=pl.body.x; cy+=pl.body.y; }
    cx/=alive.length; cy/=alive.length;
    let spread=0;
    for(const pl of alive) spread=Math.max(spread, Math.hypot(pl.body.x-cx,pl.body.y-cy));
    const targetZ = alive.length>1 ? clamp(430/Math.max(430,spread+170),0.62,1) : 1;
    COOPZ=lerp(COOPZ,targetZ,Math.min(1,4*dt));
    G.cam.shake=Math.max(0,G.cam.shake-dt*40);
    G.cam.x=lerp(G.cam.x,cx,Math.min(1,8*dt));
    G.cam.y=lerp(G.cam.y,cy,Math.min(1,8*dt));
    const Z=zoomLevel()*COOPZ, hw=VW/2/Z, hh=VH/2/Z;
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
