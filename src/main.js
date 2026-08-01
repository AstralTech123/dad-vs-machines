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
    mats:0, kills:0, totalMats:0,
    stats:{ maxHP:50, regen:0, dmg:1, atk:1, move:240, armor:0, pickup:80, crit:0.03 },
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

/* ---------------- actives ---------------- */
function tryDash(){
  const P=G.player;
  if(G.mode!=='play'||P.dead||P.dashCd>0||P.mowT>0) return;
  let ix=0, iy=0;
  if(keys['w']||keys['arrowup']) iy-=1;
  if(keys['s']||keys['arrowdown']) iy+=1;
  if(keys['a']||keys['arrowleft']) ix-=1;
  if(keys['d']||keys['arrowright']) ix+=1;
  if(touch.active && (Math.abs(touch.dx)>7||Math.abs(touch.dy)>7)){ ix=touch.dx; iy=touch.dy; }
  let len=Math.hypot(ix,iy);
  if(len<0.01){ ix=P.face; iy=0; len=1; }
  P.ddx=ix/len; P.ddy=iy/len;
  P.dashT=0.13; P.dashCd=2.5;
  P.iframe=Math.max(P.iframe,0.35);
  sfx.dashw();
}
function tryMow(){
  const P=G.player;
  if(G.mode!=='play'||P.dead||P.mowT>0||P.ult<ULT_NEED) return;
  P.mowT=5; P.ult=0; G.ultToast=false;
  banner('MOWER TIME','FIVE SECONDS OF PURE YARD WORK');
  sfx.bossroar(); G.cam.shake=Math.min(16,G.cam.shake+8);
  updateHUD();
}

/* ---------------- wave scaling + spawning ---------------- */
function hpMul(w){ return 1 + 0.34*(w-1) + 0.03*(w-1)*(w-1); }
function dmgMul(w){ return 1 + 0.13*(w-1); }
function spdMul(w){ return 1 + 0.02*(w-1); }

function startWave(n){
  G.wave=n; G.waveTime=WAVE_DUR[n]; G.sub='play'; G.subT=0;
  G.hp=G.stats.maxHP;
  G.bullets.length=0; G.ebullets.length=0; G.enemies.length=0;
  G.pickups.length=0; G.warns.length=0; G.spawnBudget=2.5; G.boss=null;
  G.player.x=1300; G.player.y=1000; G.player.iframe=1;
  G.player.bvx=0; G.player.bvy=0; G.player.mowT=0; G.player.dashT=0;
  G.grillT=Math.min(G.grillT, 10); G.burgerOut=false; G.dropT=rand(12,20);
  G.eliteQ=[];
  const dur=WAVE_DUR[n];
  if(n>=2){ G.eliteQ.push(dur*0.5);
    if(n>=5) G.eliteQ.push(dur*0.24);
    if(n>=8) G.eliteQ.unshift(dur*0.72); }
  G.mode='play'; hide('shop');
  document.getElementById('bosswrap').style.display='none';
  banner('WAVE '+n, flavor(n)); sfx.wave();
  updateHUD();
}
function flavor(n){
  return ['','They said it was just autocomplete.','The pop-ups are walking now.',
    'Same-day delivery. Of explosions.','It is aiming at you specifically.','Survive the clock. Then meet The Algorithm.',
    'Someone gave it legs.','It brought a shield to a yard fight.','It read your emails.',
    'It knows about the 401k.','Overtime starts when the clock hits zero.'][n]||'';
}
function addWarn(x,y,t,kind,ekind){ G.warns.push({x,y,t,max:t,kind:kind||'e',def:null,ekind:ekind||null}); }
function scheduleSpawn(defKey,x,y){ G.warns.push({x,y,t:0.7,max:0.7,kind:'e',def:defKey,ekind:null}); }
function spawnEnemy(defKey,x,y,child){
  const d=EDEFS[defKey], w=G.wave;
  const e={ def:d, key:defKey, x, y, hp:d.hp*hpMul(w), maxhp:d.hp*hpMul(w),
    spd:d.spd*spdMul(w)*rand(0.92,1.08), flash:0, kx:0, ky:0, contactCd:0,
    seed:rand(0,TAU), state:0, stateT:rand(0,1.5), windT:0, child:!!child, wobble:rand(0,9),
    trampCd:0 };
  if(defKey==='boss'){ e.hp=e.maxhp=d.hp; G.boss=e; e.burstT=2.0; e.addT=5; e.spiral=0; e.volT=2.0; }
  if(defKey==='algo'){ e.hp=e.maxhp=d.hp; G.boss=e; e.spiral=rand(0,TAU); e.fireT=0.4; e.dashCd2=5;
    e.tele=0; e.dashLeft=0; e.dashA=0; e.nextAdd=0.75; }
  if(defKey==='mother'){ e.spawnT=3; }
  if(defKey==='printer'){ e.stateT=rand(1,2); }
  G.enemies.push(e);
  return e;
}
function spawnEliteAt(ekind,x,y){
  const e=spawnEnemy(ekind,x,y);
  toast('⚠ '+EDEFS[ekind].name+' is loose in the yard');
  sfx.elite();
  return e;
}
function queueElite(){
  const w=G.wave;
  let kinds=['groomba'];
  if(w>=4) kinds.push('printer');
  if(w>=6) kinds.push('mother');
  const ekind=pick(kinds);
  const a=rand(0,TAU), r=rand(520,820);
  let ex=clamp(G.player.x+Math.cos(a)*r, 100, ARENA_W-100);
  let ey=clamp(G.player.y+Math.sin(a)*r, 100, ARENA_H-100);
  [ex,ey]=resolveObst(ex,ey,30);
  addWarn(ex,ey,1.0,'elite',ekind);
}
function updateSpawning(dt){
  if(G.sub!=='play') return;
  const w=G.wave;
  const ramp = 0.5 + 1.0*(1 - G.waveTime/WAVE_DUR[w]);
  G.spawnBudget += dt * (1.0 + 0.7*w) * ramp;
  const cap = Math.min(110, 30 + 9*w);
  if(G.enemies.length >= cap) return;
  const avail = Object.keys(EDEFS).filter(k=> EDEFS[k].weight>0 && EDEFS[k].minW<=w);
  let guard=0;
  while(guard++<6){
    const key = wpick(avail.map(k=>[k, EDEFS[k].weight]));
    const d=EDEFS[key]; const count=d.pack||1; const cost=d.cost*count;
    if(G.spawnBudget < cost) break;
    G.spawnBudget -= cost;
    const a=rand(0,TAU), r=rand(340,560);
    let cx=clamp(G.player.x+Math.cos(a)*r, 70, ARENA_W-70);
    let cy=clamp(G.player.y+Math.sin(a)*r, 70, ARENA_H-70);
    [cx,cy]=resolveObst(cx,cy,26);
    for(let i=0;i<count;i++){
      let sx=clamp(cx+rand(-46,46),60,ARENA_W-60), sy=clamp(cy+rand(-46,46),60,ARENA_H-60);
      [sx,sy]=resolveObst(sx,sy,20);
      scheduleSpawn(key, sx, sy);
    }
  }
}

/* ---------------- player ---------------- */
function updatePlayer(dt){
  const P=G.player, st=G.stats;
  if(P.dead){ P.deadT+=dt; if(P.deadT>1.4 && G.mode==='play'){ showDead(); } return; }
  P.dashCd=Math.max(0,P.dashCd-dt);
  P.trampCd=Math.max(0,P.trampCd-dt);
  if(P.mowT>0){
    P.mowT-=dt;
    G.mowSfxT-=dt;
    if(G.mowSfxT<=0){ sfx.mow(); G.mowSfxT=0.11; }
    if(P.mowT<=0){ P.mowT=0; toast('Out of gas.'); }
  }
  let ix=0, iy=0;
  if(keys['w']||keys['arrowup']) iy-=1;
  if(keys['s']||keys['arrowdown']) iy+=1;
  if(keys['a']||keys['arrowleft']) ix-=1;
  if(keys['d']||keys['arrowright']) ix+=1;
  if(touch.active && (Math.abs(touch.dx)>7||Math.abs(touch.dy)>7)){ ix=touch.dx/52; iy=touch.dy/52; }
  const len=Math.hypot(ix,iy)||1;
  const mudF = inMud(P.x,P.y)?0.55:1;
  const mowF = P.mowT>0?1.55:1;
  if(P.dashT>0){
    P.dashT-=dt;
    P.x+=P.ddx*1450*dt; P.y+=P.ddy*1450*dt;
    spawnPart(P.x,P.y,rand(0,TAU),rand(5,30),0.3,'ghost',0);
  } else {
    P.vx=ix/len*st.move*Math.min(1,len)*mudF*mowF;
    P.vy=iy/len*st.move*Math.min(1,len)*mudF*mowF;
    P.x+=P.vx*dt; P.y+=P.vy*dt;
  }
  P.x+=P.bvx*dt; P.y+=P.bvy*dt;
  P.bvx*=Math.pow(0.02,dt); P.bvy*=Math.pow(0.02,dt);
  P.x=clamp(P.x, 46, ARENA_W-46);
  P.y=clamp(P.y, 52, ARENA_H-52);
  P.bumpCd=Math.max(0,(P.bumpCd||0)-dt);
  const bx0=P.x, by0=P.y;
  [P.x,P.y]=resolveObst(P.x,P.y,15);
  if(P.bumpCd<=0 && (Math.abs(P.x-bx0)>1.6||Math.abs(P.y-by0)>1.6)){
    P.bumpCd=0.45;
    spawnPart(P.x+rand(-6,6),P.y+10,rand(-2.4,-0.7),rand(30,90),0.35,'#c9c2a8',3);
    noiseHit(0.045,0.06,650);
  }
  const nowMud=inMud(P.x,P.y);
  if(nowMud && !P.wasMud){
    floatText(P.x,P.y-40,'SLOWED','#8fd0ea');
    for(let k=0;k<6;k++) spawnPart(P.x,P.y+8,rand(0,TAU),rand(60,150),0.35,'#8fd0ea',3);
    noiseHit(0.08,0.09,1100);
  }
  P.wasMud=nowMud;
  if(Math.abs(ix)>0.1) P.face=ix>0?1:-1;
  const moving = Math.abs(ix)>0.05||Math.abs(iy)>0.05;
  P.bob += dt*(moving?11:3)*(P.mowT>0?1.6:1);
  P.lean = lerp(P.lean, P.vx/st.move*0.14, 10*dt);
  P.iframe=Math.max(0,P.iframe-dt);
  if(P.mowT>0 && moving){
    spawnPart(P.x+rand(-12,12), P.y+22, rand(1.2,1.9), rand(60,160), rand(0.3,0.6),
      pick(['#5da13c','#7cc451','#3f6d2c']), rand(2,3));
  }
  P.regenT+=dt;
  if(P.regenT>=4){ P.regenT-=4; if(st.regen>0 && G.hp<st.maxHP){ G.hp=Math.min(st.maxHP,G.hp+st.regen); floatText(P.x,P.y-40,'+'+st.regen,'#9be06f'); updateHUD(); } }
}
function damagePlayer(raw){
  const P=G.player;
  if(P.dead||P.iframe>0||P.mowT>0) return;
  const dmg=Math.max(1, Math.round(raw - G.stats.armor));
  G.hp-=dmg; P.iframe=0.7; G.cam.shake=Math.min(18,G.cam.shake+7);
  floatText(P.x,P.y-46,'-'+dmg,'#ff5a5f'); sfx.hurt();
  if(G.hp<=0){ G.hp=0; P.dead=true; P.deadT=0; playerDeathFX(); }
  updateHUD();
}
function playerDeathFX(){
  const P=G.player; sfx.boom(); G.cam.shake=26;
  for(let i=0;i<26;i++) spawnPart(P.x,P.y, rand(0,TAU), rand(60,300), rand(0.5,1.1), pick(['#e8b98c','#4f81b0','#c9b483','#f5f5f5']), rand(2,5));
  spawnPart(P.x,P.y, rand(-2.6,-0.6), rand(180,260), 1.4, 'shoe', 0);
  spawnPart(P.x,P.y, rand(-2.6,-0.6), rand(180,260), 1.4, 'shoe', 0);
  for(let i=0;i<5;i++) spawnPart(P.x,P.y, rand(0,TAU), rand(20,70), rand(0.8,1.4), 'smoke', rand(8,14));
}

/* ---------------- weapons + bullets ---------------- */
function tierStat(w){ const t=TIER[w.tier], d=WEAPONS[w.key];
  return { dmg:d.dmg*t.dmg, cd:d.cd*t.cd }; }
function nearestEnemy(x,y,range){
  let best=null, bd=range*range;
  for(const e of G.enemies){ const d=dist2(x,y,e.x,e.y); if(d<bd){ bd=d; best=e; } }
  return best;
}
function lerp0(a,b,t){ return a + angDiff(a,b)*clamp(t,0,1); }
function rollCrit(){ return Math.random()<G.stats.crit; }
function updateWeapons(dt){
  const P=G.player; if(P.dead) return;
  const n=G.weapons.length;
  G.weapons.forEach((w,i)=>{
    const def=WEAPONS[w.key], ts=tierStat(w);
    w.cd -= dt*G.stats.atk;
    w.recoil=Math.max(0,w.recoil-dt*5);
    w.flash=Math.max(0,w.flash-dt);
    if(def.melee==='orbit'){
      w.orbitA += def.orbitSpd*dt*G.stats.atk;
      const bx=P.x+Math.cos(w.orbitA)*def.orbitR, by=P.y+Math.sin(w.orbitA)*def.orbitR;
      w.bx=bx; w.by=by;
      for(const e of G.enemies){
        if(e['_wk'+i]>G.t) continue;
        if(dist2(bx,by,e.x,e.y) < (20+e.def.r)*(20+e.def.r)){
          e['_wk'+i]=G.t + ts.cd/G.stats.atk;
          hitEnemy(e, ts.dmg, Math.atan2(e.y-P.y,e.x-P.x), 120, rollCrit());
        }
      }
      return;
    }
    const slotA = -Math.PI/2 + (i-(n-1)/2)*0.55;
    w.hx = P.x + Math.cos(slotA)*30;
    w.hy = P.y + Math.sin(slotA)*30 - 2;
    const tgt = nearestEnemy(P.x,P.y, def.range||500);
    if(tgt){ w.aim = lerp0(w.aim, Math.atan2(tgt.y-w.hy, tgt.x-w.hx), 14*dt); }
    else { w.aim = lerp0(w.aim, P.face===1?-0.2:Math.PI+0.2, 6*dt); }
    if(!tgt || w.cd>0) return;
    w.cd = ts.cd; w.recoil=1; w.flash=0.07;
    if(def.melee==='cone'){
      sfx.shoot(def.pitch);
      const baseA=w.aim;
      for(const e of G.enemies){
        const d=Math.hypot(e.x-P.x,e.y-P.y);
        if(d<def.range+e.def.r && Math.abs(angDiff(baseA,Math.atan2(e.y-P.y,e.x-P.x)))<def.cone){
          hitEnemy(e, ts.dmg, baseA, def.knock, rollCrit());
        }
      }
      for(let k=0;k<4;k++) spawnPart(w.hx,w.hy, baseA+rand(-0.4,0.4), rand(240,380), 0.3, '#bde8c4', 2);
      return;
    }
    sfx.shoot(def.pitch);
    const count=def.count||1;
    for(let c=0;c<count;c++){
      const spread = def.spread? (c-(count-1)/2)*def.spread : rand(-0.03,0.03);
      const a=w.aim+spread;
      G.bullets.push({ x:w.hx, y:w.hy, vx:Math.cos(a)*def.speed, vy:Math.sin(a)*def.speed,
        dmg:ts.dmg, pierce:def.pierce||0, r:def.aoe?7:5, life:(def.range||400)/def.speed,
        key:w.key, aoe:def.aoe||0, knock:def.knock||60, crit:rollCrit(),
        boom:!!def.boomerang, phase:0, spin:rand(0,TAU), hitSet:{} });
    }
  });
}
function updateBullets(dt){
  const P=G.player;
  for(let i=G.bullets.length-1;i>=0;i--){
    const b=G.bullets[i];
    b.spin+=dt*12;
    if(b.boom && b.phase===1){
      const a=Math.atan2(P.y-b.y,P.x-b.x);
      const sp=Math.hypot(b.vx,b.vy);
      b.vx=lerp(b.vx,Math.cos(a)*sp,8*dt); b.vy=lerp(b.vy,Math.sin(a)*sp,8*dt);
      if(dist2(b.x,b.y,P.x,P.y)<30*30){ G.bullets.splice(i,1); continue; }
    }
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(b.life<=0){
      if(b.boom && b.phase===0){ b.phase=1; b.life=3; b.hitSet={}; continue; }
      if(b.aoe) explode(b);
      G.bullets.splice(i,1); continue;
    }
    if(b.x<12||b.x>ARENA_W-12){ b.vx*=-1; if(!b.boom){ if(b.aoe) explode(b); G.bullets.splice(i,1); continue; } }
    if(b.y<12||b.y>ARENA_H-12){ b.vy*=-1; if(!b.boom){ if(b.aoe) explode(b); G.bullets.splice(i,1); continue; } }
    let removed=false;
    for(const e of G.enemies){
      if(b.hitSet[e.seed]) continue;
      const rr=(b.r+e.def.r);
      if(dist2(b.x,b.y,e.x,e.y)<rr*rr){
        b.hitSet[e.seed]=1;
        hitEnemy(e, b.dmg, Math.atan2(b.vy,b.vx), b.knock, b.crit);
        if(b.aoe){ explode(b); G.bullets.splice(i,1); removed=true; break; }
        if(b.pierce>0){ b.pierce--; }
        else if(!b.boom){ G.bullets.splice(i,1); removed=true; break; }
      }
    }
    if(removed) continue;
  }
}
function explode(b){
  sfx.boom(); G.cam.shake=Math.min(16,G.cam.shake+5);
  for(let k=0;k<12;k++) spawnPart(b.x,b.y, rand(0,TAU), rand(60,300), rand(0.3,0.7), pick(['#ffd166','#ff9a4d','#d9a066']), rand(2,4));
  for(let k=0;k<4;k++) spawnPart(b.x,b.y, rand(0,TAU), rand(15,60), rand(0.6,1.0), 'smoke', rand(9,15));
  spawnPart(b.x,b.y,0,0,0.22,'flash',b.aoe*0.9);
  ringPart(b.x,b.y,b.aoe);
  for(const e of G.enemies){
    if(dist2(b.x,b.y,e.x,e.y) < (b.aoe+e.def.r)*(b.aoe+e.def.r)){
      hitEnemy(e, b.dmg, Math.atan2(e.y-b.y,e.x-b.x), b.knock, b.crit);
    }
  }
}

/* ---------------- enemies ---------------- */
function hitEnemy(e, dmg, ang, knock, crit){
  let mult = G.stats.dmg*(crit?2:1);
  let blocked=false;
  if(e.def.frontDR){
    const fe=Math.atan2(G.player.y-e.y, G.player.x-e.x);
    if(Math.abs(angDiff(ang, fe+Math.PI))<1.05){ mult*=0.2; blocked=true; }
  }
  const final=Math.max(1,Math.round(dmg*mult));
  e.hp-=final; e.flash=0.09;
  const kr = e.def.knockR!==undefined? e.def.knockR : 1;
  e.kx += Math.cos(ang)*knock*kr; e.ky += Math.sin(ang)*knock*kr;
  floatText(e.x+rand(-8,8), e.y-e.def.r-10, final, blocked?'#9aa2ae':(crit?'#ffd166':'#ffffff'), crit);
  if(blocked) sfx.tink(); else sfx.hit();
  for(let k=0;k<3;k++) spawnPart(e.x,e.y, ang+rand(-0.7,0.7), rand(80,220), 0.25, blocked?'#9ecbff':'#ffd166', 2);
  if(e.hp<=0) killEnemy(e);
}
function killEnemy(e){
  const idx=G.enemies.indexOf(e); if(idx<0) return;
  G.enemies.splice(idx,1);
  G.kills++;
  const P=G.player;
  if(P.ult<ULT_NEED){
    P.ult++;
    if(P.ult>=ULT_NEED && !G.ultToast){ G.ultToast=true; toast('🚜 MOWER READY! Press E'); sfx.combine(); }
  }
  G.cam.shake=Math.min(14,G.cam.shake+(e.def.r>24?5:1.2));
  if(e.def.r>24) sfx.boom(); else noiseHit(0.09,0.09,1800);
  const pal=['#ff5a5f','#ffb26b','#8b93a3','#5c6470','#33383f'];
  for(let k=0;k<(e.def.r>24?16:7);k++)
    spawnPart(e.x,e.y, rand(0,TAU), rand(50,260), rand(0.3,0.8), pick(pal), rand(2,5));
  for(let k=0;k<(e.def.r>24?3:1);k++)
    spawnPart(e.x,e.y, rand(0,TAU), rand(60,180), rand(0.5,0.9), 'nut', rand(3,5));
  spawnPart(e.x,e.y,0,0,0.18,'flash',e.def.r*1.6);
  if(e.def.r>24) for(let k=0;k<4;k++) spawnPart(e.x,e.y, rand(0,TAU), rand(15,50), rand(0.7,1.1), 'smoke', rand(9,16));
  if(e.def.splits && !e.child){ for(let s=0;s<e.def.splits;s++) spawnEnemy('swarm', e.x+rand(-14,14), e.y+rand(-14,14), true); }
  if(e.def.elite){
    const loot=12+3*G.wave;
    for(let m=0;m<loot;m++) G.pickups.push({ x:e.x+rand(-16,16), y:e.y+rand(-16,16),
      vx:rand(-120,120), vy:rand(-140,-20), mag:false, t:0, kind:'bolt', val:1 });
    G.pickups.push({ x:e.x, y:e.y, vx:rand(-40,40), vy:-60, mag:false, t:0, kind:'burger', val:15 });
    banner('ELITE SCRAPPED','+'+loot+' BOLTS AND A BURGER');
    G.cam.shake=18;
  } else {
    const mats = e.child?0:e.def.mats;
    for(let m=0;m<mats;m++) G.pickups.push({ x:e.x+rand(-10,10), y:e.y+rand(-10,10),
      vx:rand(-70,70), vy:rand(-90,-20), mag:false, t:0, kind:'bolt', val:1 });
  }
  if(e.key==='boss'||e.key==='algo'){ onBossDown(); }
  updateHUD();
}
function droneBlast(e){
  const P=G.player;
  const r=74;
  sfx.boom(); G.cam.shake=Math.min(16,G.cam.shake+6);
  spawnPart(e.x,e.y,0,0,0.22,'flash',r);
  ringPart(e.x,e.y,r);
  for(let k=0;k<10;k++) spawnPart(e.x,e.y, rand(0,TAU), rand(60,280), rand(0.3,0.7), pick(['#ffd166','#ff9a4d','#ff5a5f']), rand(2,4));
  if(!P.dead && dist2(e.x,e.y,P.x,P.y)<(r+14)*(r+14)) damagePlayer(e.def.blast*dmgMul(G.wave));
  for(const o of [...G.enemies]){
    if(o!==e && dist2(e.x,e.y,o.x,o.y)<(r+o.def.r)*(r+o.def.r)){
      hitEnemy(o, 12, Math.atan2(o.y-e.y,o.x-e.x), 200, false);
    }
  }
  e.hp=0; killEnemy(e);
}
function updateEnemies(dt){
  const P=G.player;
  for(const e of G.enemies){
    e.flash=Math.max(0,e.flash-dt);
    e.contactCd=Math.max(0,e.contactCd-dt);
    e.trampCd=Math.max(0,e.trampCd-dt);
    e.stateT-=dt; e.wobble+=dt;
    e.x+=e.kx*dt; e.y+=e.ky*dt;
    e.kx*=Math.pow(0.002,dt); e.ky*=Math.pow(0.002,dt);
    const a=Math.atan2(P.y-e.y,P.x-e.x), d=Math.hypot(P.x-e.x,P.y-e.y);
    const mudF = inMud(e.x,e.y)?0.55:1;
    const sp = e.spd*mudF;
    const ai=e.def.ai;
    if(ai==='chase'){
      e.x+=Math.cos(a)*sp*dt; e.y+=Math.sin(a)*sp*dt;
    } else if(ai==='swarm'){
      const j=Math.sin(G.t*7+e.seed)*40;
      e.x+=(Math.cos(a)*sp+Math.cos(a+Math.PI/2)*j)*dt;
      e.y+=(Math.sin(a)*sp+Math.sin(a+Math.PI/2)*j)*dt;
    } else if(ai==='charge'||ai==='gcharge'){
      const fast=ai==='gcharge';
      if(e.state===0){
        e.x+=Math.cos(a)*sp*0.7*dt; e.y+=Math.sin(a)*sp*0.7*dt;
        if(e.stateT<=0){ e.state=1; e.stateT=fast?0.32:0.45; }
      } else if(e.state===1){
        e.x+=rand(-1.6,1.6);
        if(e.stateT<=0){ e.state=2; e.stateT=fast?0.42:0.5; e.dashA=a; }
      } else {
        e.x+=Math.cos(e.dashA)*sp*(fast?5.4:4.6)*dt; e.y+=Math.sin(e.dashA)*sp*(fast?5.4:4.6)*dt;
        if(e.stateT<=0){ e.state=0; e.stateT=fast?rand(0.8,1.4):rand(1.6,2.6); }
      }
    } else if(ai==='shoot'){
      if(e.windT>0){
        e.windT-=dt;
        if(e.windT<=0){
          const spv=310, aa=Math.atan2(P.y-e.y,P.x-e.x);
          G.ebullets.push({ x:e.x, y:e.y, vx:Math.cos(aa)*spv, vy:Math.sin(aa)*spv,
            dmg:e.def.shot*dmgMul(G.wave), r:6, life:3 });
          tone(720,0.08,'sawtooth',0.05,220);
        }
      } else {
        if(d>350) { e.x+=Math.cos(a)*sp*dt; e.y+=Math.sin(a)*sp*dt; }
        else if(d<250){ e.x-=Math.cos(a)*sp*0.8*dt; e.y-=Math.sin(a)*sp*0.8*dt; }
        else { e.x+=Math.cos(a+Math.PI/2)*sp*0.4*Math.sin(G.t+e.seed)*dt;
               e.y+=Math.sin(a+Math.PI/2)*sp*0.4*Math.sin(G.t+e.seed)*dt; }
        if(e.stateT<=0){ e.windT=0.5; e.stateT=rand(2.0,2.8); }
      }
    } else if(ai==='printer'){
      if(e.windT>0){
        e.windT-=dt;
        if(e.windT<=0){
          const aa=Math.atan2(P.y-e.y,P.x-e.x);
          for(let s=-2;s<=2;s++){
            const av=aa+s*0.22;
            G.ebullets.push({ x:e.x, y:e.y, vx:Math.cos(av)*290, vy:Math.sin(av)*290,
              dmg:e.def.shot*dmgMul(G.wave), r:6, life:3.4, paper:true });
          }
          noiseHit(0.12,0.09,2200);
          for(let k=0;k<4;k++) spawnPart(e.x,e.y,aa+rand(-0.5,0.5),rand(120,240),0.4,'#f7f5ee',3);
        }
      } else {
        if(d>420) { e.x+=Math.cos(a)*sp*dt; e.y+=Math.sin(a)*sp*dt; }
        else if(d<300){ e.x-=Math.cos(a)*sp*0.7*dt; e.y-=Math.sin(a)*sp*0.7*dt; }
        if(e.stateT<=0){ e.windT=0.6; e.stateT=rand(2.2,2.8); }
      }
    } else if(ai==='kami'){
      if(e.fuse!==undefined){
        e.fuse-=dt;
        e.x+=Math.cos(a)*sp*0.2*dt; e.y+=Math.sin(a)*sp*0.2*dt;
        if(Math.floor(e.fuse*10)!==Math.floor((e.fuse+dt)*10)) sfx.beep();
        if(e.fuse<=0){ droneBlast(e); continue; }
      } else {
        e.x+=Math.cos(a)*sp*dt + Math.cos(a+Math.PI/2)*Math.sin(G.t*5+e.seed)*30*dt;
        e.y+=Math.sin(a)*sp*dt + Math.sin(a+Math.PI/2)*Math.sin(G.t*5+e.seed)*30*dt;
        if(d<85){ e.fuse=0.65; sfx.beep(); }
      }
    } else if(ai==='medic'){
      let tgt=null, bf=1;
      for(const o of G.enemies){
        if(o===e||o.def.elite||o.key==='boss'||o.key==='algo') continue;
        const f=o.hp/o.maxhp;
        if(f<bf && f<1 && dist2(e.x,e.y,o.x,o.y)<420*420){ bf=f; tgt=o; }
      }
      e.healTarget=null;
      if(tgt){
        const ta=Math.atan2(tgt.y-e.y,tgt.x-e.x), td=Math.hypot(tgt.x-e.x,tgt.y-e.y);
        if(td>130){ e.x+=Math.cos(ta)*sp*dt; e.y+=Math.sin(ta)*sp*dt; }
        else {
          e.healTarget=tgt;
          if(e.stateT<=0){
            e.stateT=0.5;
            tgt.hp=Math.min(tgt.maxhp, tgt.hp+(4+G.wave));
            floatText(tgt.x,tgt.y-tgt.def.r-10,'+'+(4+G.wave),'#7ce88a');
            spawnPart(tgt.x,tgt.y,rand(0,TAU),rand(20,60),0.4,'#7ce88a',3);
          }
          if(d<260){ e.x-=Math.cos(a)*sp*0.6*dt; e.y-=Math.sin(a)*sp*0.6*dt; }
        }
      } else {
        if(d<320){ e.x-=Math.cos(a)*sp*0.7*dt; e.y-=Math.sin(a)*sp*0.7*dt; }
        else { e.x+=Math.cos(a+1.2)*sp*0.4*dt; e.y+=Math.sin(a+1.2)*sp*0.4*dt; }
      }
    } else if(ai==='mother'){
      if(d>340){ e.x+=Math.cos(a)*sp*dt; e.y+=Math.sin(a)*sp*dt; }
      else if(d<240){ e.x-=Math.cos(a)*sp*0.8*dt; e.y-=Math.sin(a)*sp*0.8*dt; }
      else { e.x+=Math.cos(a+Math.PI/2)*sp*0.5*dt; e.y+=Math.sin(a+Math.PI/2)*sp*0.5*dt; }
      e.spawnT-=dt;
      if(e.spawnT<=0 && G.enemies.length<Math.min(110,30+9*G.wave)){
        e.spawnT=3;
        for(let s=0;s<2;s++) spawnEnemy('swarm', e.x+rand(-20,20), e.y+rand(-20,20), true);
        spawnPart(e.x,e.y,0,0,0.15,'flash',e.def.r*1.3);
      }
    } else if(ai==='algo'){
      updateAlgo(e,dt,a,d);
    } else if(ai==='boss'){
      updateBoss(e,dt,a,d);
    }
    e.x=clamp(e.x,40,ARENA_W-40); e.y=clamp(e.y,40,ARENA_H-40);
    if(e.key!=='boss' && e.key!=='algo'){
      [e.x,e.y]=resolveObst(e.x,e.y,e.def.r*0.8);
      const td=Math.hypot(e.x-TRAMP.x,e.y-TRAMP.y);
      if(td<TRAMP.r && e.trampCd<=0){
        e.trampCd=0.6; TRAMP.anim=1;
        const ba=td>1?Math.atan2(e.y-TRAMP.y,e.x-TRAMP.x):rand(0,TAU);
        e.kx+=Math.cos(ba)*620; e.ky+=Math.sin(ba)*620;
        sfx.spring();
      }
    }
    if(P.mowT>0 && d < e.def.r+30 && (e._mow===undefined||e._mow<G.t)){
      e._mow=G.t+0.25;
      hitEnemy(e, 22, Math.atan2(e.y-P.y,e.x-P.x), 420, false);
    }
    if(!P.dead && e.contactCd<=0 && d < e.def.r+16 && e.fuse===undefined){
      damagePlayer(e.def.dmg*dmgMul(G.wave));
      e.contactCd=0.8;
      e.kx-=Math.cos(a)*140; e.ky-=Math.sin(a)*140;
    }
  }
  for(let i=G.ebullets.length-1;i>=0;i--){
    const b=G.ebullets[i];
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(b.life<=0||b.x<0||b.x>ARENA_W||b.y<0||b.y>ARENA_H){ G.ebullets.splice(i,1); continue; }
    if(P.mowT>0 && dist2(b.x,b.y,P.x,P.y)<42*42){
      spawnPart(b.x,b.y,rand(0,TAU),rand(60,140),0.3,'#ffd166',2);
      G.ebullets.splice(i,1); continue;
    }
    if(!P.dead && dist2(b.x,b.y,P.x,P.y)<(b.r+14)*(b.r+14)){
      damagePlayer(b.dmg); G.ebullets.splice(i,1);
    }
  }
}
function updateAlgo(e,dt,a,d){
  e.fireT-=dt;
  if(e.fireT<=0){
    e.fireT=0.1; e.spiral+=0.5;
    G.ebullets.push({ x:e.x, y:e.y, vx:Math.cos(e.spiral)*165, vy:Math.sin(e.spiral)*165,
      dmg:8*dmgMul(G.wave), r:6, life:6 });
  }
  if(e.dashLeft>0){
    e.dashLeft-=dt;
    e.x+=Math.cos(e.dashA)*950*dt; e.y+=Math.sin(e.dashA)*950*dt;
  } else if(e.tele>0){
    e.tele-=dt;
    if(e.tele<=0){ e.dashLeft=0.32; G.cam.shake=Math.min(14,G.cam.shake+5);
      tone(160,0.25,'sawtooth',0.12,70); }
  } else {
    e.x+=Math.cos(a)*e.spd*dt; e.y+=Math.sin(a)*e.spd*dt;
    e.dashCd2-=dt;
    if(e.dashCd2<=0){ e.dashCd2=6; e.tele=0.55; e.dashA=a; tone(520,0.4,'sine',0.06,180); }
  }
  if(e.hp/e.maxhp < e.nextAdd){
    e.nextAdd-=0.25;
    for(let i=0;i<3;i++){
      const aa=rand(0,TAU);
      scheduleSpawn('chat', clamp(e.x+Math.cos(aa)*160,60,ARENA_W-60), clamp(e.y+Math.sin(aa)*160,60,ARENA_H-60));
    }
  }
  const f=document.getElementById('bossfill');
  if(f) f.style.width=(clamp(e.hp/e.maxhp,0,1)*100)+'%';
}
function updateBoss(e,dt,a,d){
  const enr = e.hp < e.maxhp*0.35;
  const spd = e.spd*(enr?1.6:1);
  e.x+=Math.cos(a)*spd*dt; e.y+=Math.sin(a)*spd*dt;
  e.burstT-=dt; e.addT-=dt;
  if(e.hp<e.maxhp*0.6){
    e.volT-=dt;
    if(e.volT<=0){
      e.volT=2.0;
      for(let s=-1;s<=1;s++){
        const av=a+s*0.25;
        G.ebullets.push({ x:e.x, y:e.y, vx:Math.cos(av)*230, vy:Math.sin(av)*230,
          dmg:8*dmgMul(G.wave), r:6, life:4 });
      }
      tone(300,0.15,'sawtooth',0.08,120);
    }
  }
  if(e.burstT<=0){
    e.burstT = enr?2.1:3.0; e.spiral+=0.4;
    const n=enr?18:13;
    for(let i=0;i<n;i++){
      const aa=e.spiral + i/n*TAU;
      G.ebullets.push({ x:e.x, y:e.y, vx:Math.cos(aa)*185, vy:Math.sin(aa)*185,
        dmg:9*dmgMul(G.wave), r:7, life:5 });
    }
    tone(140,0.3,'sawtooth',0.12,60); G.cam.shake=Math.min(14,G.cam.shake+4);
  }
  if(e.addT<=0 && G.enemies.length<16){
    e.addT=7;
    for(let i=0;i<3;i++){
      const aa=rand(0,TAU);
      scheduleSpawn(Math.random()<0.5?'chat':'swarm',
        clamp(e.x+Math.cos(aa)*150,60,ARENA_W-60), clamp(e.y+Math.sin(aa)*150,60,ARENA_H-60));
    }
  }
  const f=document.getElementById('bossfill');
  if(f) f.style.width=(clamp(e.hp/e.maxhp,0,1)*100)+'%';
}

/* ---------------- yard interactions ---------------- */
function updateYard(dt){
  const P=G.player;
  // grill cooks burgers
  if(!G.burgerOut){
    G.grillT-=dt;
    G.grillSmk=(G.grillSmk||0)-dt;
    if(G.grillSmk<=0){
      G.grillSmk=0.4;
      spawnPart(GRILLPOS.x+rand(-8,8),GRILLPOS.y-32,-Math.PI/2+rand(-0.3,0.3),rand(14,30),rand(0.8,1.3),'smoke',rand(5,9));
    }
    if(G.grillT<=0){
      G.burgerOut=true; G.grillT=26;
      G.pickups.push({ x:BURGER_SPOT.x, y:BURGER_SPOT.y, vx:0, vy:0, mag:false, t:0, kind:'burger', val:15, grill:true });
      toast('🍔 Burgers are ready at the grill');
      sfx.sizzle();
    }
  }
  // airdrop crates
  if(G.sub==='play' && G.wave>=2){
    G.dropT-=dt;
    if(G.dropT<=0){
      G.dropT=rand(16,24);
      let dx=0, dy=0, ok=false;
      for(let tries=0; tries<10 && !ok; tries++){
        dx=rand(220,ARENA_W-220); dy=rand(220,ARENA_H-220);
        const [rx,ry]=resolveObst(dx,dy,26);
        const pd=Math.hypot(dx-P.x,dy-P.y);
        if(Math.abs(rx-dx)<4 && Math.abs(ry-dy)<4 && pd>260 && pd<950){ ok=true; }
      }
      addWarn(dx,dy,1.1,'drop');
      sfx.drop();
    }
  }
  // sprinkler
  SPRINK.a += 0.75*dt;
  const jx=Math.cos(SPRINK.a), jy=Math.sin(SPRINK.a);
  for(let k=0;k<2;k++){
    const t=rand(0.15,1);
    spawnPart(SPRINK.x+jx*170*t, SPRINK.y+jy*170*t,
      SPRINK.a+rand(-0.25,0.25), rand(20,60), 0.35, '#7fc7e8', 2);
  }
  for(const e of G.enemies){
    if(e.key==='boss'||e.key==='algo') continue;
    const ed=Math.hypot(e.x-SPRINK.x,e.y-SPRINK.y);
    if(ed<180 && ed>20){
      const ea=Math.atan2(e.y-SPRINK.y,e.x-SPRINK.x);
      if(Math.abs(angDiff(SPRINK.a,ea))<0.15 && (e._spk===undefined||e._spk<G.t)){
        e._spk=G.t+0.35;
        hitEnemy(e, 2, ea, 170, false);
      }
    }
  }
  // trampoline (player)
  const td=Math.hypot(P.x-TRAMP.x,P.y-TRAMP.y);
  if(td<TRAMP.r && P.trampCd<=0 && !P.dead){
    P.trampCd=0.6; TRAMP.anim=1;
    const ba=td>1?Math.atan2(P.y-TRAMP.y,P.x-TRAMP.x):rand(0,TAU);
    P.bvx+=Math.cos(ba)*760; P.bvy+=Math.sin(ba)*760;
    P.iframe=Math.max(P.iframe,0.25);
    floatText(P.x,P.y-44,'BOING!','#6ea8ff',true);
    sfx.spring();
  }
  TRAMP.anim=Math.max(0,TRAMP.anim-dt*3);
  // flamingos tip over
  for(const fl of FLAM){
    if(fl.up){
      if(dist2(fl.x,fl.y,P.x,P.y)<26*26){ fl.up=false; sfx.tink(); }
      else for(const e of G.enemies){
        if(dist2(fl.x,fl.y,e.x,e.y)<(e.def.r+14)*(e.def.r+14)){ fl.up=false; sfx.tink(); break; }
      }
    } else if(fl.f<1){ fl.f=Math.min(1,fl.f+dt*3.5); }
  }
}

/* ---------------- warns / pickups / particles / text ---------------- */
function updateWarns(dt){
  for(let i=G.warns.length-1;i>=0;i--){
    const w=G.warns[i]; w.t-=dt;
    if(w.t<=0){
      G.warns.splice(i,1);
      if(w.kind==='bossw') spawnEnemy(w.ekind, w.x, w.y);
      else if(w.kind==='elite') spawnEliteAt(w.ekind, w.x, w.y);
      else if(w.kind==='drop'){
        G.pickups.push({ x:w.x, y:w.y, vx:0, vy:0, mag:false, t:0, kind:'crate', val:8+2*G.wave });
        G.cam.shake=Math.min(10,G.cam.shake+4);
        noiseHit(0.12,0.12,900);
      }
      else if(w.def) spawnEnemy(w.def, w.x, w.y);
    }
  }
}
function updatePickups(dt){
  const P=G.player, pr=G.stats.pickup;
  for(let i=G.pickups.length-1;i>=0;i--){
    const p=G.pickups[i]; p.t+=dt;
    const d=Math.hypot(P.x-p.x,P.y-p.y);
    let magR = p.kind==='bolt'? pr : Math.max(60,pr*0.6);
    if(p.kind==='burger' && !p.mag && G.sub!=='vacuum' && G.hp>G.stats.maxHP-5) magR=26;
    if(p.mag||G.sub==='vacuum'||d<magR){
      const a=Math.atan2(P.y-p.y,P.x-p.x);
      const sp=Math.min(720, 260+p.t*900);
      p.x+=Math.cos(a)*sp*dt; p.y+=Math.sin(a)*sp*dt;
      if(d<24){
        G.pickups.splice(i,1);
        if(p.kind==='bolt'){ G.mats++; G.totalMats++; sfx.pickup(); }
        else if(p.kind==='burger'){
          G.hp=Math.min(G.stats.maxHP, G.hp+p.val);
          if(p.grill) G.burgerOut=false;
          floatText(P.x,P.y-44,'+'+p.val+' 🍔','#9be06f',true);
          sfx.munch();
        }
        else if(p.kind==='crate'){
          G.mats+=p.val; G.totalMats+=p.val;
          floatText(P.x,P.y-44,'+'+p.val+' 🔩','#ffd166',true);
          for(let k=0;k<8;k++) spawnPart(p.x,p.y,rand(0,TAU),rand(60,200),0.4,'#c9a06a',3);
          sfx.buy();
        }
        updateHUD(); continue;
      }
    } else {
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=Math.pow(0.01,dt); p.vy*=Math.pow(0.01,dt);
    }
  }
}
function spawnPart(x,y,a,sp,life,color,r){
  if(G.parts.length>380) G.parts.shift();
  G.parts.push({ x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life, max:life, color, r, rot:rand(0,TAU), vr:rand(-6,6) });
}
function ringPart(x,y,r){ G.parts.push({ x,y,vx:0,vy:0,life:0.28,max:0.28,color:'ring',r,rot:0,vr:0 }); }
function updateParts(dt){
  for(let i=G.parts.length-1;i>=0;i--){
    const p=G.parts[i]; p.life-=dt;
    if(p.life<=0){ G.parts.splice(i,1); continue; }
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt;
    if(p.color==='shoe'||p.color==='nut'){ p.vy+=500*dt; }
    else if(p.color==='smoke'){ p.vy-=26*dt; p.vx*=Math.pow(0.3,dt); }
    else { p.vx*=Math.pow(0.05,dt); p.vy*=Math.pow(0.05,dt); }
  }
}
function floatText(x,y,txt,color,big){
  if(G.texts.length>60) G.texts.shift();
  G.texts.push({ x:x, y:y, txt:''+txt, color, life:0.8, max:0.8, big:!!big });
}
function updateTexts(dt){
  for(let i=G.texts.length-1;i>=0;i--){
    const t=G.texts[i]; t.life-=dt; t.y-=34*dt;
    if(t.life<=0) G.texts.splice(i,1);
  }
}

/* ---------------- wave flow + boss phases ---------------- */
function updateWaveFlow(dt){
  if(G.player.dead) return;
  if(G.sub==='play'){
    G.waveTime-=dt;
    if(G.eliteQ.length && G.waveTime < G.eliteQ[0]){ G.eliteQ.shift(); queueElite(); }
    if(G.waveTime<=0){
      G.waveTime=0;
      if(BOSS_WAVES[G.wave]) startBossPhase(BOSS_WAVES[G.wave]);
      else endWaveCleanup();
    }
  } else if(G.sub==='vacuum'){
    G.subT+=dt;
    if(G.pickups.length===0 && G.subT>0.9){
      if(G.wave===FINAL_WAVE){ showWin(); G.sub='done'; }
      else { openShop(); G.sub='shopping'; }
    }
  }
}
function startBossPhase(kind){
  G.sub='boss';
  const label=document.getElementById('bosslabel');
  label.textContent = kind==='algo' ? 'T H E   A L G O R I T H M' : 'A G I – P R I M E';
  document.getElementById('bosswrap').style.display='block';
  document.getElementById('bossfill').style.width='100%';
  banner('OVERTIME', kind==='algo' ? '⚠ THE ALGORITHM HAS FINISHED BUFFERING ⚠' : '⚠ AGI-PRIME IS ONLINE ⚠');
  sfx.bossroar();
  const P=G.player;
  const a=Math.atan2(ARENA_H/2-P.y, ARENA_W/2-P.x);
  let bx=clamp(P.x+Math.cos(a)*420, 160, ARENA_W-160);
  let by=clamp(P.y+Math.sin(a)*420, 160, ARENA_H-160);
  addWarn(bx,by,1.4,'bossw',kind);
  updateHUD();
}
function endWaveCleanup(){
  G.sub='vacuum'; G.subT=0;
  for(const e of [...G.enemies]){
    for(let k=0;k<6;k++) spawnPart(e.x,e.y,rand(0,TAU),rand(40,200),0.5,'#5c6470',3);
    spawnPart(e.x,e.y,0,0,0.15,'flash',e.def.r*1.4);
  }
  G.enemies.length=0; G.ebullets.length=0;
  G.warns=G.warns.filter(w=>w.kind==='drop');
  for(const p of G.pickups) p.mag=true;
  const bonus=4+G.wave; G.mats+=bonus; G.totalMats+=bonus;
  floatText(G.player.x,G.player.y-56,'WAVE BONUS +'+bonus,'#9be06f',true);
  sfx.wave();
}
function onBossDown(){
  document.getElementById('bosswrap').style.display='none';
  G.boss=null;
  for(const e of [...G.enemies]) killEnemy(e);
  G.ebullets.length=0;
  G.warns=G.warns.filter(w=>w.kind==='drop');
  G.sub='vacuum'; G.subT=0;
  for(const p of G.pickups) p.mag=true;
  if(G.wave===FINAL_WAVE){ banner('SYSTEM SHUTDOWN',''); }
  else {
    const bonus=10+G.wave; G.mats+=bonus; G.totalMats+=bonus;
    banner('BOSS SCRAPPED','+'+bonus+' BOLT BONUS');
  }
  G.cam.shake=24; sfx.boom();
}

/* ---------------- shop ---------------- */
function tierRoll(){
  const w=G.wave;
  const t3 = w>=6 ? Math.min(0.22, 0.04*(w-5)) : 0;
  const t2 = w>=3 ? Math.min(0.42, 0.10+0.05*(w-3)) : (w>=2?0.08:0);
  const r=Math.random();
  if(r<t3) return 3; if(r<t3+t2) return 2; return 1;
}
function priceOf(kind,key,tier){
  const base = kind==='w'? WEAPONS[key].price : ITEMS[key].price;
  return Math.round(base * TIER[tier].priceMul * (1+0.09*(G.wave-1)));
}
function rollOffers(){
  const offers=[];
  for(let i=0;i<4;i++){
    const isWeapon = Math.random()<0.42;
    const tier=tierRoll();
    if(isWeapon){
      const key=pick(Object.keys(WEAPONS));
      offers.push({ kind:'w', key, tier, price:priceOf('w',key,tier), sold:false });
    } else {
      const key=pick(Object.keys(ITEMS));
      offers.push({ kind:'i', key, tier, price:priceOf('i',key,tier), sold:false });
    }
  }
  G.shop.offers=offers;
}
function openShop(){ G.mode='shop'; G.shop.rerolls=0; rollOffers(); renderShop(); show('shop'); }
function rerollCost(){ return G.wave + G.shop.rerolls*2; }
function rerollShop(){
  const c=rerollCost();
  if(G.mats<c) return;
  G.mats-=c; G.shop.rerolls++; rollOffers(); renderShop(); sfx.click(); updateHUD();
}
function canBuy(o){
  if(o.sold || G.mats<o.price) return false;
  if(o.kind==='w'){
    const slotsFull = G.weapons.length>=MAX_SLOTS;
    const hasPair = G.weapons.some(w=> w.key===o.key && w.tier===o.tier && o.tier<3);
    if(slotsFull && !hasPair) return false;
  }
  return true;
}
function buyOffer(i){
  const o=G.shop.offers[i];
  if(!canBuy(o)) return;
  G.mats-=o.price; o.sold=true; sfx.buy();
  if(o.kind==='w'){
    G.weapons.push(mkWeapon(o.key,o.tier));
    tryCombine(o.key,o.tier);
  } else {
    const it=ITEMS[o.key];
    applyItem(it,o.tier);
    G.itemCounts[o.key]=(G.itemCounts[o.key]||0)+1;
  }
  renderShop(); renderSlots(); updateHUD();
}
function tryCombine(key,tier){
  if(tier>=3) return;
  const same=G.weapons.filter(w=>w.key===key && w.tier===tier);
  if(same.length>=2){
    G.weapons.splice(G.weapons.indexOf(same[0]),1);
    G.weapons.splice(G.weapons.indexOf(same[1]),1);
    G.weapons.push(mkWeapon(key,tier+1));
    toast('⚙ Combined into '+WEAPONS[key].name+' '+TIER[tier+1].name+'!');
    sfx.combine();
    tryCombine(key,tier+1);
  }
}
function applyItem(it,tier){
  const v=it.vals[tier-1], st=G.stats;
  if(it.stat==='maxHP'){ st.maxHP+=v; G.hp+=v; }
  else if(it.stat==='regen') st.regen+=v;
  else if(it.stat==='dmg') st.dmg+=v;
  else if(it.stat==='atk') st.atk+=v;
  else if(it.stat==='move') st.move*= (1+v);
  else if(it.stat==='armor') st.armor+=v;
  else if(it.stat==='pickup') st.pickup+=v;
  else if(it.stat==='crit') st.crit+=v;
}
function renderShop(){
  document.getElementById('shopmats').textContent='🔩 '+G.mats;
  document.getElementById('gowave').textContent='START WAVE '+(G.wave+1)+' →';
  const box=document.getElementById('offers'); box.innerHTML='';
  G.shop.offers.forEach((o,i)=>{
    const t=TIER[o.tier];
    let iconHTML,name,desc;
    if(o.kind==='w'){ const d=WEAPONS[o.key];
      iconHTML=`<img src="${ICONURL[o.key]}" alt="">`; name=d.name;
      desc=d.desc+`<br><span style="color:#ece7db">DMG ${Math.round(d.dmg*t.dmg)} · every ${(d.cd*t.cd).toFixed(2)}s</span>`;
      if(G.weapons.length>=MAX_SLOTS && !G.weapons.some(w=>w.key===o.key&&w.tier===o.tier&&o.tier<3))
        desc+='<br><span style="color:#e0a34d">Slots full. Needs a matching pair to combine.</span>';
    } else { const d=ITEMS[o.key]; iconHTML=d.icon; name=d.name;
      desc=`<span style="color:#ece7db">${d.fmt(d.vals[o.tier-1])}</span><br>${d.note}`; }
    const div=document.createElement('div');
    div.className='card t'+o.tier+(o.sold?' sold':'');
    div.innerHTML=`<div class="cicon">${iconHTML}</div><div class="cname">${name}</div>
      <div class="ctier">${t.name}${o.kind==='w'?' WEAPON':''}</div>
      <div class="cdesc">${desc}</div>
      <button ${canBuy(o)?'':'disabled'}>${o.sold?'SOLD':'🔩 '+o.price}</button>`;
    div.querySelector('button').addEventListener('click',()=>buyOffer(i));
    box.appendChild(div);
  });
  const rb=document.getElementById('rerollbtn');
  rb.textContent='Reroll (🔩 '+rerollCost()+')';
  rb.disabled = G.mats<rerollCost();
  const st=G.stats;
  document.getElementById('statpanel').innerHTML=`<h3>DAD STATS</h3>
    Max HP <span class="sv">${st.maxHP}</span> · Regen <span class="sv">${st.regen}/4s</span> ·
    Damage <span class="sv">${Math.round(st.dmg*100)}%</span> · Atk Speed <span class="sv">${Math.round(st.atk*100)}%</span><br>
    Move <span class="sv">${Math.round(st.move)}</span> · Armor <span class="sv">${st.armor}</span> ·
    Crit <span class="sv">${Math.round(st.crit*100)}%</span> · Pickup <span class="sv">${Math.round(st.pickup)}</span>`;
  const wp=G.weapons.map(w=>`<img src="${ICONURL[w.key]}" alt=""><sup>${w.tier}</sup>`).join(' ');
  document.getElementById('weappanel').innerHTML=`<h3>GARAGE (${G.weapons.length}/${MAX_SLOTS} slots)</h3>
    ${wp}<br>Buy two of the same weapon + tier and they combine.`;
}
document.getElementById('rerollbtn').addEventListener('click',rerollShop);
document.getElementById('gowave').addEventListener('click',()=>{ sfx.click(); startWave(G.wave+1); });

/* ---------------- HUD / overlays ---------------- */
function updateHUD(){
  if(!G) return;
  const frac=clamp(G.hp/G.stats.maxHP,0,1);
  const hf=document.getElementById('hpfill');
  hf.style.width=(frac*100)+'%';
  hf.className = frac<0.3 ? 'low' : '';
  document.getElementById('hptext').textContent=Math.ceil(G.hp)+' / '+G.stats.maxHP;
  document.getElementById('armorchip').textContent=G.stats.armor>0?('🛡 '+G.stats.armor+' armor'):'';
  document.getElementById('wavenum').textContent=G.wave||1;
  const t=Math.max(0,Math.ceil(G.waveTime));
  document.getElementById('wavetimer').textContent=(G.sub==='boss')?'BOSS':('0:'+(t<10?'0':'')+t);
  document.getElementById('matcount').textContent='🔩 '+G.mats;
  document.getElementById('killcount').textContent=G.kills+' machines scrapped';
  const P=G.player;
  document.getElementById('ultfill').style.width=(P.ult/ULT_NEED*100)+'%';
  const uw=document.getElementById('ultwrap');
  const ut=document.getElementById('ulttext');
  if(P.mowT>0){ ut.textContent='MOWING'; uw.className=''; }
  else if(P.ult>=ULT_NEED){ ut.textContent='🚜 MOWER READY (E)'; uw.className='ready'; }
  else { ut.textContent='MOWER '+P.ult+'/'+ULT_NEED; uw.className=''; }
}
function renderSlots(){
  const box=document.getElementById('slotwrap'); box.innerHTML='';
  for(let i=0;i<MAX_SLOTS;i++){
    const d=document.createElement('div'); d.className='slot';
    const w=G.weapons[i];
    if(w){ d.innerHTML=`<img src="${ICONURL[w.key]}" alt="">`+
      `<div class="pips" style="color:${w.tier===3?'#c48df0':w.tier===2?'#6aa8f0':'#8b93a3'}">${'●'.repeat(w.tier)}</div>`; }
    box.appendChild(d);
  }
}
let bannerTO=null;
function banner(big,small){
  const b=document.getElementById('banner');
  b.querySelector('.big').textContent=big;
  b.querySelector('.small').textContent=small||'';
  b.classList.add('on');
  clearTimeout(bannerTO); bannerTO=setTimeout(()=>b.classList.remove('on'),1900);
}
let toastTO=null;
function toast(msg){
  const t=document.getElementById('toast'); t.textContent=msg; t.style.opacity=1;
  clearTimeout(toastTO); toastTO=setTimeout(()=>t.style.opacity=0,1800);
}
function show(id){ document.getElementById(id).classList.remove('hidden'); }
function hide(id){ document.getElementById(id).classList.add('hidden'); }
function showDead(){
  G.mode='dead';
  document.getElementById('deadstats').innerHTML=
    `Made it to <b>wave ${G.wave}</b> · scrapped <b>${G.kills}</b> machines · collected <b>${G.totalMats}</b> bolts<br>The machines have added this run to their training data.`;
  show('dead');
}
function showWin(){
  G.mode='win';
  document.getElementById('winstats').innerHTML=
    `AGI-PRIME unplugged on <b>wave ${FINAL_WAVE}</b> · <b>${G.kills}</b> machines scrapped · <b>${G.totalMats}</b> bolts collected<br>He clocked out at 5:00 PM sharp and did not think about it again.`;
  show('win');
}
document.getElementById('startbtn').addEventListener('click',()=>{ initAudio(); sfx.click(); hide('menu'); startWave(1); });
document.getElementById('retrybtn').addEventListener('click',()=>{ initAudio(); sfx.click(); hide('dead'); newGame(); startWave(1); });
document.getElementById('winbtn').addEventListener('click',()=>{ initAudio(); sfx.click(); hide('win'); newGame(); startWave(1); });

/* ---------------- canvas + glow sprites ---------------- */
const cv=document.getElementById('game'), ctx=cv.getContext('2d');
let VW=innerWidth, VH=innerHeight, DPR=1;
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  VW=innerWidth; VH=innerHeight;
  cv.width=VW*DPR; cv.height=VH*DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize',resize); resize();
function zoomLevel(){ return VW<700 ? 0.78 : 1; }
function mkGlow(rgb){
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d');
  const grad=g.createRadialGradient(32,32,2,32,32,32);
  grad.addColorStop(0,'rgba('+rgb+',0.85)');
  grad.addColorStop(0.4,'rgba('+rgb+',0.32)');
  grad.addColorStop(1,'rgba('+rgb+',0)');
  g.fillStyle=grad; g.fillRect(0,0,64,64);
  return c;
}
const GLOWS={
  red:mkGlow('255,90,95'), orange:mkGlow('255,160,80'), purple:mkGlow('196,141,240'),
  green:mkGlow('155,224,111'), gold:mkGlow('255,209,102'), white:mkGlow('255,255,255'),
  blue:mkGlow('110,198,255'),
};
function drawGlow(c,x,y,r,alpha){
  ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=alpha;
  ctx.drawImage(GLOWS[c], x-r, y-r, r*2, r*2);
  ctx.restore();
}
function roundedRectPath(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
}

/* ---------------- pre-rendered yard floor ---------------- */
function buildFloor(){
  const c=document.createElement('canvas'); c.width=ARENA_W; c.height=ARENA_H;
  const f=c.getContext('2d');
  for(let x=0, i=0; x<ARENA_W; x+=118, i++){
    f.fillStyle = i%2? '#2e4029' : '#35492f';
    f.fillRect(x,0,118,ARENA_H);
  }
  f.fillStyle='rgba(255,255,255,0.03)';
  for(let x=118;x<ARENA_W;x+=236) f.fillRect(x-1,0,2,ARENA_H);
  for(let i=0;i<520;i++){
    f.fillStyle='rgba(0,0,0,'+rand(0.02,0.05)+')';
    f.fillRect(rand(0,ARENA_W),rand(0,ARENA_H),3,3);
  }
  for(let i=0;i<5;i++){
    f.fillStyle='rgba(94,78,52,0.12)';
    f.beginPath();
    f.ellipse(rand(300,ARENA_W-300),rand(300,ARENA_H-300),rand(50,90),rand(30,55),rand(0,TAU),0,TAU);
    f.fill();
  }
  function sign(x,y,txt){
    f.fillStyle='#4a3520'; f.fillRect(x-2,y-4,4,16);
    const w2=txt.length*6.4+16;
    f.fillStyle='#8a6d52'; roundedRectPath(f,x-w2/2,y-21,w2,18,3); f.fill();
    f.strokeStyle='#4a3520'; f.lineWidth=2; roundedRectPath(f,x-w2/2,y-21,w2,18,3); f.stroke();
    f.fillStyle='#f4eeda'; f.font='bold 10px monospace'; f.textAlign='center'; f.textBaseline='middle';
    f.fillText(txt,x,y-11);
  }
  // patio (top-left) + grout
  f.fillStyle='#70747c'; f.fillRect(140,110,480,320);
  f.strokeStyle='rgba(0,0,0,0.28)'; f.lineWidth=2;
  for(let gx=140;gx<=620;gx+=96){ f.beginPath(); f.moveTo(gx,110); f.lineTo(gx,430); f.stroke(); }
  for(let gy=110;gy<=430;gy+=80){ f.beginPath(); f.moveTo(140,gy); f.lineTo(620,gy); f.stroke(); }
  f.fillStyle='rgba(0,0,0,0.16)'; f.fillRect(140,422,480,8);
  // driveway
  f.fillStyle='#5c6066'; f.fillRect(150,1520,440,480);
  f.strokeStyle='rgba(0,0,0,0.25)';
  for(let gy=1520;gy<2000;gy+=96){ f.beginPath(); f.moveTo(150,gy); f.lineTo(590,gy); f.stroke(); }
  // shed: dark interior strip + plank wall with door and window (roof is drawn overhead at runtime)
  f.fillStyle='rgba(0,0,0,0.3)'; f.beginPath(); f.ellipse(2270,306,232,108,0,0,TAU); f.fill();
  f.fillStyle='#3a3226'; f.fillRect(2080,140,380,118);
  f.fillStyle='#6e5238'; f.fillRect(2080,252,380,178);
  f.strokeStyle='#5a4128'; f.lineWidth=2;
  for(let py=268;py<430;py+=20){ f.beginPath(); f.moveTo(2080,py); f.lineTo(2460,py); f.stroke(); }
  f.fillStyle='#4a3520'; f.fillRect(2226,300,88,130);
  f.strokeStyle='#2e2114'; f.lineWidth=3; f.strokeRect(2226,300,88,130);
  f.strokeStyle='#3a2a18'; f.beginPath(); f.moveTo(2270,300); f.lineTo(2270,430); f.stroke();
  f.fillStyle='#d4af37'; f.beginPath(); f.arc(2258,368,4,0,TAU); f.fill();
  f.fillStyle='#9db6c9'; f.fillRect(2360,300,64,52);
  f.strokeStyle='#4a3520'; f.lineWidth=4; f.strokeRect(2360,300,64,52);
  f.beginPath(); f.moveTo(2392,300); f.lineTo(2392,352); f.moveTo(2360,326); f.lineTo(2424,326); f.stroke();
  f.fillStyle='rgba(255,255,255,0.35)'; f.fillRect(2364,304,18,14);
  sign(2160,470,"DAD'S SHED");
  // above-ground pool: wall with seams, white rim, shaded water, ladder
  f.fillStyle='rgba(0,0,0,0.32)'; f.beginPath(); f.ellipse(2160,1598,170,76,0,0,TAU); f.fill();
  f.fillStyle='#97a4ad'; f.beginPath(); f.arc(2160,1560,158,0,TAU); f.fill();
  f.strokeStyle='#7b8892'; f.lineWidth=2;
  for(let i=0;i<18;i++){
    const a=Math.PI*0.06 + i/17*Math.PI*0.88;
    f.beginPath();
    f.moveTo(2160+Math.cos(a)*120,1560+Math.sin(a)*120);
    f.lineTo(2160+Math.cos(a)*158,1560+Math.sin(a)*158);
    f.stroke();
  }
  f.strokeStyle='#e8e4da'; f.lineWidth=12;
  f.beginPath(); f.ellipse(2160,1552,148,142,0,0,TAU); f.stroke();
  const wg=f.createRadialGradient(2126,1520,20,2160,1552,140);
  wg.addColorStop(0,'#5aa8d6'); wg.addColorStop(1,'#2e6d94');
  f.fillStyle=wg; f.beginPath(); f.arc(2160,1552,136,0,TAU); f.fill();
  f.strokeStyle='rgba(255,255,255,0.35)'; f.lineWidth=3;
  f.beginPath(); f.arc(2160,1552,96,-2.6,-1.2); f.stroke();
  f.fillStyle='#f0e13a'; f.beginPath(); f.arc(2214,1512,10,0,TAU); f.fill();
  f.fillStyle='#e07b2e'; f.fillRect(2222,1508,7,5);
  f.strokeStyle='#cfd6e0'; f.lineWidth=5;
  f.beginPath(); f.moveTo(2138,1702); f.lineTo(2138,1640); f.moveTo(2182,1702); f.lineTo(2182,1640); f.stroke();
  f.lineWidth=4;
  for(let ly=1652; ly<=1696; ly+=14){ f.beginPath(); f.moveTo(2138,ly); f.lineTo(2182,ly); f.stroke(); }
  sign(2160,1768,'NO ROBOTS');
  // hedges: raised with a dark front face, leaf clumps, and flowers
  for(const o of OBST){ if(o.type!=='hedge') continue;
    f.fillStyle='rgba(0,0,0,0.3)'; roundedRectPath(f,o.x-4,o.y+6,o.w+8,o.h+6,16); f.fill();
    f.fillStyle='#1c3319'; roundedRectPath(f,o.x,o.y-4,o.w,o.h+8,14); f.fill();
    f.fillStyle='#2f5228'; roundedRectPath(f,o.x,o.y-14,o.w,o.h,14); f.fill();
    f.fillStyle='#3f6d35';
    for(let i=0;i<Math.floor(o.w*o.h/380);i++){
      f.beginPath(); f.arc(o.x+rand(10,o.w-10),o.y-14+rand(6,o.h-8),rand(4,8),0,TAU); f.fill();
    }
    f.fillStyle='rgba(255,255,255,0.14)'; roundedRectPath(f,o.x+4,o.y-12,o.w-8,8,6); f.fill();
    f.fillStyle='#e58bb1';
    for(let i=0;i<5;i++) f.fillRect(o.x+rand(8,o.w-10), o.y-12+rand(4,o.h-8), 4,4);
  }
  // car: two-tone body, roof, windshields, lights
  f.fillStyle='rgba(0,0,0,0.35)'; f.beginPath(); f.ellipse(375,1692,142,64,0,0,TAU); f.fill();
  f.fillStyle='#1a1a1a';
  f.fillRect(268,1606,44,16); f.fillRect(438,1606,44,16);
  f.fillRect(268,1733,44,16); f.fillRect(438,1733,44,16);
  f.fillStyle='#6f2020'; roundedRectPath(f,250,1628,250,107,22); f.fill();
  f.fillStyle='#a83b3b'; roundedRectPath(f,250,1616,250,107,22); f.fill();
  f.fillStyle='#c04b4b'; roundedRectPath(f,286,1632,178,75,16); f.fill();
  f.fillStyle='#bcd2e0';
  f.beginPath(); f.moveTo(292,1638); f.lineTo(318,1648); f.lineTo(318,1692); f.lineTo(292,1702); f.closePath(); f.fill();
  f.beginPath(); f.moveTo(458,1638); f.lineTo(432,1648); f.lineTo(432,1692); f.lineTo(458,1702); f.closePath(); f.fill();
  f.fillStyle='#8c2f2f'; roundedRectPath(f,322,1646,106,48,10); f.fill();
  f.fillStyle='rgba(255,255,255,0.18)'; roundedRectPath(f,330,1650,90,12,6); f.fill();
  f.fillStyle='#ffd166'; f.fillRect(496,1636,6,12); f.fillRect(496,1690,6,12);
  f.fillStyle='#c22e35'; f.fillRect(248,1636,5,12); f.fillRect(248,1690,5,12);
  // tree trunks + canopy ground shade
  for(const t of TREES){
    f.fillStyle='rgba(0,0,0,0.22)'; f.beginPath(); f.ellipse(t.x+14,t.y+10,120,60,0,0,TAU); f.fill();
    f.fillStyle='#5a4128'; f.beginPath(); f.arc(t.x,t.y,20,0,TAU); f.fill();
    f.fillStyle='#6e5238'; f.beginPath(); f.arc(t.x-5,t.y-5,10,0,TAU); f.fill();
  }
  // kiddie pool: inflatable ring with segments, shaded water, big duck
  f.fillStyle='rgba(0,0,0,0.28)'; f.beginPath(); f.ellipse(MUD.x,MUD.y+14,MUD.r+8,MUD.r*0.45,0,0,TAU); f.fill();
  f.fillStyle='#e0637f'; f.beginPath(); f.arc(MUD.x,MUD.y,MUD.r,0,TAU); f.fill();
  f.fillStyle='#ff9db8'; f.beginPath(); f.arc(MUD.x,MUD.y-6,MUD.r-6,0,TAU); f.fill();
  f.strokeStyle='#e0637f'; f.lineWidth=3;
  for(let i=0;i<10;i++){
    const a=i/10*TAU;
    f.beginPath();
    f.moveTo(MUD.x+Math.cos(a)*(MUD.r-26),MUD.y-6+Math.sin(a)*(MUD.r-26));
    f.lineTo(MUD.x+Math.cos(a)*MUD.r,MUD.y-6+Math.sin(a)*(MUD.r-2));
    f.stroke();
  }
  const kg=f.createRadialGradient(MUD.x-16,MUD.y-20,8,MUD.x,MUD.y-6,MUD.r-24);
  kg.addColorStop(0,'#8fd0ea'); kg.addColorStop(1,'#57a3cf');
  f.fillStyle=kg; f.beginPath(); f.arc(MUD.x,MUD.y-6,MUD.r-26,0,TAU); f.fill();
  f.fillStyle='#f0e13a'; f.beginPath(); f.arc(MUD.x+28,MUD.y-18,9,0,TAU); f.fill();
  f.fillStyle='#e07b2e'; f.fillRect(MUD.x+35,MUD.y-22,6,4);
  sign(MUD.x,MUD.y+MUD.r+36,'SLOW ZONE');
  // sprinkler base
  f.fillStyle='#8b93a3'; f.fillRect(SPRINK.x-5,SPRINK.y-5,10,10);
  f.fillStyle='#5c6470'; f.beginPath(); f.arc(SPRINK.x,SPRINK.y,4,0,TAU); f.fill();
  sign(SPRINK.x,SPRINK.y+44,'SPRINKLER');
  // grill: big kettle with dome lid, shelf, and utensils
  f.fillStyle='rgba(0,0,0,0.35)'; f.beginPath(); f.ellipse(GRILLPOS.x,GRILLPOS.y+36,56,16,0,0,TAU); f.fill();
  f.strokeStyle='#15171a'; f.lineWidth=6;
  f.beginPath();
  f.moveTo(GRILLPOS.x-26,GRILLPOS.y+16); f.lineTo(GRILLPOS.x-38,GRILLPOS.y+52);
  f.moveTo(GRILLPOS.x+26,GRILLPOS.y+16); f.lineTo(GRILLPOS.x+38,GRILLPOS.y+52);
  f.moveTo(GRILLPOS.x,GRILLPOS.y+24); f.lineTo(GRILLPOS.x,GRILLPOS.y+56);
  f.stroke();
  f.fillStyle='#1a1a1a';
  f.beginPath(); f.arc(GRILLPOS.x-38,GRILLPOS.y+54,7,0,TAU); f.fill();
  f.beginPath(); f.arc(GRILLPOS.x+38,GRILLPOS.y+54,7,0,TAU); f.fill();
  f.fillStyle='#23262c'; f.beginPath(); f.ellipse(GRILLPOS.x,GRILLPOS.y+8,48,26,0,0,TAU); f.fill();
  const gg=f.createLinearGradient(0,GRILLPOS.y-40,0,GRILLPOS.y+6);
  gg.addColorStop(0,'#3f454d'); gg.addColorStop(1,'#23262c');
  f.fillStyle=gg; f.beginPath(); f.ellipse(GRILLPOS.x,GRILLPOS.y-8,46,30,0,0,TAU); f.fill();
  f.fillStyle='rgba(255,255,255,0.15)';
  f.beginPath(); f.ellipse(GRILLPOS.x-14,GRILLPOS.y-20,16,8,-0.4,0,TAU); f.fill();
  f.strokeStyle='#15171a'; f.lineWidth=3;
  f.beginPath(); f.moveTo(GRILLPOS.x-46,GRILLPOS.y+2); f.lineTo(GRILLPOS.x+46,GRILLPOS.y+2); f.stroke();
  f.fillStyle='#c22e35'; f.beginPath(); f.arc(GRILLPOS.x,GRILLPOS.y-40,6,0,TAU); f.fill();
  f.fillStyle='#e8e4da'; f.beginPath(); f.arc(GRILLPOS.x+22,GRILLPOS.y-28,4,0,TAU); f.fill();
  f.fillStyle='#6b4f2a'; f.fillRect(GRILLPOS.x+48,GRILLPOS.y-10,46,20);
  f.strokeStyle='#8b93a3'; f.lineWidth=3;
  f.beginPath(); f.moveTo(GRILLPOS.x+56,GRILLPOS.y-6); f.lineTo(GRILLPOS.x+72,GRILLPOS.y-6); f.stroke();
  f.fillStyle='#8b93a3'; f.fillRect(GRILLPOS.x+70,GRILLPOS.y-10,10,8);
  f.fillStyle='#c22e35'; f.fillRect(GRILLPOS.x+82,GRILLPOS.y-12,7,14);
  sign(GRILLPOS.x,GRILLPOS.y+92,'BURGERS');
  // cooler on patio
  f.fillStyle='rgba(0,0,0,0.25)'; f.beginPath(); f.ellipse(540,200,28,8,0,0,TAU); f.fill();
  f.fillStyle='#b03038'; f.fillRect(514,172,52,28);
  f.fillStyle='#ece7db'; f.fillRect(514,165,52,10);
  // gnome + hose
  f.fillStyle='rgba(0,0,0,0.25)'; f.beginPath(); f.ellipse(660,1450,12,4,0,0,TAU); f.fill();
  f.fillStyle='#3f6bab'; f.fillRect(652,1432,16,17);
  f.fillStyle='#ece7db'; f.beginPath(); f.ellipse(660,1434,8,7,0,0,TAU); f.fill();
  f.fillStyle='#e8b98c'; f.beginPath(); f.arc(660,1427,6,0,TAU); f.fill();
  f.fillStyle='#c22e35'; f.beginPath();
  f.moveTo(652,1425); f.lineTo(668,1425); f.lineTo(660,1408); f.closePath(); f.fill();
  f.strokeStyle='#3f7d46'; f.lineWidth=5;
  for(let r=8;r<=20;r+=6){ f.beginPath(); f.arc(2410,1860,r,0,TAU*0.9); f.stroke(); }
  f.fillStyle='#8b93a3'; f.fillRect(2426,1856,12,8);
  // picket fence
  function fenceRun(len){
    f.fillStyle='#8f887a'; f.fillRect(0,12,len,5); f.fillRect(0,25,len,5);
    for(let x=6; x<len-6; x+=26){
      f.beginPath();
      f.moveTo(x+7,-6); f.lineTo(x+14,3); f.lineTo(x+14,36); f.lineTo(x,36); f.lineTo(x,3);
      f.closePath();
      f.fillStyle='#d8d2c2'; f.fill();
      f.strokeStyle='#6f6a5d'; f.lineWidth=1.5; f.stroke();
    }
  }
  f.save(); fenceRun(ARENA_W); f.restore();
  f.save(); f.translate(ARENA_W,ARENA_H); f.rotate(Math.PI); fenceRun(ARENA_W); f.restore();
  f.save(); f.translate(0,ARENA_H); f.rotate(-Math.PI/2); fenceRun(ARENA_H); f.restore();
  f.save(); f.translate(ARENA_W,0); f.rotate(Math.PI/2); fenceRun(ARENA_H); f.restore();
  f.fillStyle='#c4bdac';
  [[0,0],[ARENA_W-16,0],[0,ARENA_H-16],[ARENA_W-16,ARENA_H-16]].forEach(p=>f.fillRect(p[0],p[1],16,16));
  f.strokeStyle='rgba(0,0,0,0.22)'; f.lineWidth=30;
  f.strokeRect(30,30,ARENA_W-60,ARENA_H-60);
  return c;
}
const FLOOR = buildFloor();
const FLIES=[];
for(let i=0;i<18;i++) FLIES.push({ x:rand(80,ARENA_W-80), y:rand(80,ARENA_H-80),
  a:rand(0,TAU), ph:rand(0,TAU), sp:rand(6,16) });
function updateFlies(dt){
  for(const fl of FLIES){
    fl.a += rand(-1.4,1.4)*dt;
    fl.x = clamp(fl.x+Math.cos(fl.a)*fl.sp*dt, 60, ARENA_W-60);
    fl.y = clamp(fl.y+Math.sin(fl.a)*fl.sp*dt, 60, ARENA_H-60);
  }
}

/* ---------------- vector weapon art + baked UI icons ---------------- */
function drawIcon(c,key,s){
  if(key==='stapler'){
    c.fillStyle='#98a2b3';
    c.beginPath(); c.moveTo(-s,-s*0.18); c.lineTo(s*0.9,-s*0.5); c.lineTo(s,-s*0.05);
    c.lineTo(-s,0.08*s); c.closePath(); c.fill();
    c.fillStyle='#5c6470'; c.fillRect(-s,0.05*s,s*2,s*0.32);
    c.fillStyle='#2f333a'; c.beginPath(); c.arc(-s*0.78,-s*0.03,s*0.16,0,TAU); c.fill();
  } else if(key==='tps'){
    c.fillStyle='#f7f5ee'; c.fillRect(-s*0.62,-s*0.8,s*1.24,s*1.6);
    c.strokeStyle='#b9b2a2'; c.lineWidth=Math.max(1,s*0.08);
    for(let i=0;i<4;i++){ c.beginPath(); c.moveTo(-s*0.44,-s*0.4+i*s*0.32);
      c.lineTo(s*0.44,-s*0.4+i*s*0.32); c.stroke(); }
    c.fillStyle='#c22e35'; c.fillRect(-s*0.62,-s*0.8,s*0.5,s*0.3);
  } else if(key==='darts'){
    c.fillStyle='#8b93a3';
    c.beginPath(); c.moveTo(s,0); c.lineTo(s*0.5,-s*0.16); c.lineTo(s*0.5,s*0.16); c.closePath(); c.fill();
    c.fillStyle='#ffd166'; c.fillRect(-s*0.4,-s*0.14,s*0.9,s*0.28);
    c.fillStyle='#c22e35';
    c.beginPath(); c.moveTo(-s*0.4,-s*0.14); c.lineTo(-s,-s*0.42); c.lineTo(-s*0.7,0); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-s*0.4,s*0.14); c.lineTo(-s,s*0.42); c.lineTo(-s*0.7,0); c.closePath(); c.fill();
  } else if(key==='mug'){
    c.fillStyle='#f4eeda'; c.fillRect(-s*0.55,-s*0.52,s*1.0,s*1.04);
    c.strokeStyle='#f4eeda'; c.lineWidth=s*0.2;
    c.beginPath(); c.arc(s*0.55,0,s*0.34,-Math.PI/2,Math.PI/2); c.stroke();
    c.fillStyle='#c22e35'; c.fillRect(-s*0.55,-s*0.1,s*1.0,s*0.34);
    c.strokeStyle='rgba(200,200,200,0.8)'; c.lineWidth=Math.max(1,s*0.09);
    c.beginPath(); c.moveTo(-s*0.2,-s*0.62); c.quadraticCurveTo(-s*0.05,-s*0.85,-s*0.2,-s*1.0); c.stroke();
  } else if(key==='driver'){
    c.strokeStyle='#cfd6e0'; c.lineWidth=s*0.14;
    c.beginPath(); c.moveTo(-s,0); c.lineTo(s*0.5,0); c.stroke();
    c.fillStyle='#33383f'; c.fillRect(-s,-s*0.1,s*0.36,s*0.2);
    c.fillStyle='#8b93a3';
    c.beginPath(); c.ellipse(s*0.66,s*0.05,s*0.34,s*0.24,0.3,0,TAU); c.fill();
    c.fillStyle='#e8e4da'; c.beginPath(); c.arc(s*0.6,-s*0.05,s*0.07,0,TAU); c.fill();
  } else if(key==='case'){
    c.fillStyle='#8a5c34'; roundedRectPath(c,-s*0.9,-s*0.62,s*1.8,s*1.24,s*0.16); c.fill();
    c.fillStyle='#6e4726'; c.fillRect(-s*0.9,-s*0.12,s*1.8,s*0.24);
    c.strokeStyle='#5a3a1e'; c.lineWidth=s*0.14;
    c.beginPath(); c.arc(0,-s*0.62,s*0.3,Math.PI,0); c.stroke();
    c.fillStyle='#d4af37'; c.fillRect(-s*0.55,-s*0.08,s*0.2,s*0.16); c.fillRect(s*0.35,-s*0.08,s*0.2,s*0.16);
  } else if(key==='blower'){
    c.fillStyle='#e0762e';
    c.beginPath(); c.ellipse(-s*0.35,0,s*0.5,s*0.44,0,0,TAU); c.fill();
    c.fillStyle='#33383f';
    c.beginPath(); c.moveTo(0,-s*0.2); c.lineTo(s,-s*0.32); c.lineTo(s,s*0.32); c.lineTo(0,s*0.2);
    c.closePath(); c.fill();
    c.fillStyle='#e0762e'; c.fillRect(-s*0.5,-s*0.72,s*0.5,s*0.24);
    c.fillStyle='#1d2025'; c.beginPath(); c.arc(-s*0.35,0,s*0.16,0,TAU); c.fill();
  } else if(key==='whacker'){
    c.strokeStyle='#e0762e'; c.lineWidth=s*0.16;
    c.beginPath(); c.moveTo(-s,0); c.lineTo(s*0.4,0); c.stroke();
    c.fillStyle='#33383f'; c.beginPath(); c.ellipse(s*0.62,0,s*0.36,s*0.28,0,0,TAU); c.fill();
    c.strokeStyle='#bde8c4'; c.lineWidth=Math.max(1,s*0.07);
    c.beginPath(); c.moveTo(s*0.62,0); c.lineTo(s*1.05,-s*0.3); c.moveTo(s*0.62,0); c.lineTo(s*1.05,s*0.3); c.stroke();
  }
}
const ICONURL={};
(function bakeIcons(){
  for(const key of Object.keys(WEAPONS)){
    const c=document.createElement('canvas'); c.width=c.height=48;
    const ic=c.getContext('2d');
    ic.translate(24,24); ic.rotate(-0.35);
    drawIcon(ic,key,17);
    ICONURL[key]=c.toDataURL();
  }
})();

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

/* ---------------- dad + mower art ---------------- */
function drawDad(P){
  const x=P.x, y=P.y, f=P.face;
  const bob=Math.sin(P.bob)*2, step=Math.sin(P.bob);
  const blink = P.iframe>0 && Math.sin(AT*30)>0;
  ctx.save(); ctx.translate(x,y); ctx.rotate(P.lean||0); ctx.translate(0,bob*0.35);
  if(blink) ctx.globalAlpha=0.45;
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0,30,17,5.5,0,0,TAU); ctx.fill();
  ctx.fillStyle='#e8c49a';
  ctx.fillRect(-8.5,12,6.5,10+step*2); ctx.fillRect(2,12,6.5,10-step*2);
  ctx.fillStyle='#f5f5f5';
  ctx.fillRect(-8.5,18+step*2,6.5,5); ctx.fillRect(2,18-step*2,6.5,5);
  ctx.fillStyle='#c22e35';
  ctx.fillRect(-8.5,19+step*2,6.5,1.4); ctx.fillRect(2,19-step*2,6.5,1.4);
  function shoe(sx,sy){
    ctx.fillStyle='#f5f5f5'; roundedRectPath(ctx,sx,sy,13,6,2.5); ctx.fill();
    ctx.fillStyle='#c9cdd4'; ctx.fillRect(sx,sy+5,13,3);
    ctx.strokeStyle='#8b93a3'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(sx+3,sy+5); ctx.lineTo(sx+6.5,sy+1); ctx.lineTo(sx+10,sy+5); ctx.stroke();
  }
  shoe(-13,22+step*2); shoe(1,22-step*2);
  ctx.fillStyle='#c9b483'; roundedRectPath(ctx,-11,3,22,11,2); ctx.fill();
  ctx.fillStyle='#b5a071'; ctx.fillRect(-11,7,5,6); ctx.fillRect(6,7,5,6);
  ctx.fillStyle='#4f81b0'; roundedRectPath(ctx,-11,-13,22,17,3); ctx.fill();
  ctx.fillStyle='#3f6b94'; ctx.fillRect(-2,-13,4,9);
  ctx.fillStyle='#e8e4da';
  ctx.beginPath(); ctx.moveTo(-6,-13); ctx.lineTo(-1,-8); ctx.lineTo(-1,-13); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6,-13); ctx.lineTo(1,-8); ctx.lineTo(1,-13); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#6b4f2a'; ctx.fillRect(-11,2,22,3.5);
  ctx.fillStyle='#d4af37'; ctx.fillRect(-2,2,4,3.5);
  const sw=Math.sin(P.bob)*3;
  ctx.fillStyle='#4f81b0'; ctx.fillRect(-15,-10+sw*0.4,4.5,10); ctx.fillRect(10.5,-10-sw*0.4,4.5,10);
  ctx.fillStyle='#e8c49a'; ctx.fillRect(-15,0+sw*0.4,4.5,5); ctx.fillRect(10.5,0-sw*0.4,4.5,5);
  ctx.fillStyle='#e8c49a'; roundedRectPath(ctx,-8,-28,16,16,4); ctx.fill();
  ctx.fillStyle='#dcb387'; ctx.fillRect(f===1?-9:7,-22,2.5,4);
  ctx.fillStyle='#9a9a9a'; ctx.fillRect(-8,-26,3,8); ctx.fillRect(5,-26,3,8);
  ctx.fillStyle='#efd9bd'; ctx.beginPath(); ctx.ellipse(0,-27,7,3.2,0,Math.PI,0); ctx.fill();
  ctx.fillStyle='#2a2a2a';
  ctx.fillRect(f===1?-2.5:-5,-21,2.6,2.6); ctx.fillRect(f===1?3:0.5,-21,2.6,2.6);
  ctx.fillStyle='#7c7c7c'; ctx.fillRect(-4,-15.5,8,2.2);
  ctx.restore();
  ctx.globalAlpha=1;
}
function drawMower(P){
  const x=P.x, y=P.y, f=P.face;
  const rumble=Math.sin(AT*40)*1.2;
  ctx.save(); ctx.translate(x,y+rumble*0.4);
  if(f===-1) ctx.scale(-1,1);
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(0,30,30,8,0,0,TAU); ctx.fill();
  ctx.fillStyle='#1a1a1a';
  ctx.beginPath(); ctx.arc(-16,22,11,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(18,24,7,0,TAU); ctx.fill();
  ctx.fillStyle='#4a4a4a';
  ctx.beginPath(); ctx.arc(-16,22,4,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(18,24,2.5,0,TAU); ctx.fill();
  ctx.fillStyle='#b03038'; roundedRectPath(ctx,-26,4,52,18,5); ctx.fill();
  ctx.fillStyle='#8c2428'; ctx.fillRect(-26,16,52,6);
  ctx.fillStyle='#8b93a3'; roundedRectPath(ctx,14,-2,16,12,3); ctx.fill();
  ctx.fillStyle='#33383f'; ctx.fillRect(24,-8,4,8);
  ctx.fillStyle='#1d2025'; roundedRectPath(ctx,-24,-6,16,12,3); ctx.fill();
  ctx.strokeStyle='#33383f'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(8,2); ctx.lineTo(2,-12); ctx.stroke();
  ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(2,-14,5,0,TAU); ctx.stroke();
  ctx.save(); ctx.translate(-8,-14+rumble*0.5);
  ctx.fillStyle='#4f81b0'; roundedRectPath(ctx,-9,-8,18,16,3); ctx.fill();
  ctx.fillStyle='#e8c49a'; roundedRectPath(ctx,-6.5,-22,13,14,4); ctx.fill();
  ctx.fillStyle='#9a9a9a'; ctx.fillRect(-6.5,-20,2.5,6); ctx.fillRect(4,-20,2.5,6);
  ctx.fillStyle='#efd9bd'; ctx.beginPath(); ctx.ellipse(0,-21,5.5,2.6,0,Math.PI,0); ctx.fill();
  ctx.fillStyle='#2a2a2a'; ctx.fillRect(0.5,-16,2.4,2.4); ctx.fillRect(4,-16,2.4,2.4);
  ctx.fillStyle='#7c7c7c'; ctx.fillRect(0,-11.5,7,2);
  ctx.restore();
  ctx.restore();
  drawGlow('gold',x,y,44,0.22+0.1*Math.sin(AT*20));
}

/* ---------------- draw: weapons + bullets ---------------- */
function drawWeapons(){
  const P=G.player;
  G.weapons.forEach((w,i)=>{
    const def=WEAPONS[w.key];
    if(def.melee==='orbit'){
      const bx=w.bx||P.x, by=w.by||P.y;
      drawGlow('green',bx,by,20,0.35);
      ctx.save(); ctx.translate(bx,by); ctx.rotate(AT*10);
      drawIcon(ctx,'whacker',13); ctx.restore(); return;
    }
    const rec=w.recoil*6;
    const mx=w.hx - Math.cos(w.aim)*rec, my=w.hy - Math.sin(w.aim)*rec;
    ctx.save(); ctx.translate(mx,my); ctx.rotate(w.aim);
    if(Math.cos(w.aim)<0) ctx.scale(1,-1);
    drawIcon(ctx,w.key,11); ctx.restore();
    if(w.flash>0 && !def.melee){
      const fa=w.flash/0.07;
      const fx=w.hx+Math.cos(w.aim)*16, fy=w.hy+Math.sin(w.aim)*16;
      drawGlow('gold',fx,fy,15,fa*0.8);
    }
  });
}
function drawBullet(b){
  const def=WEAPONS[b.key];
  ctx.save();
  ctx.strokeStyle=def.bcolor||'#fff'; ctx.globalAlpha=0.35; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(b.x-b.vx*0.035,b.y-b.vy*0.035); ctx.lineTo(b.x,b.y); ctx.stroke();
  ctx.restore();
  if(b.key==='mug'||b.key==='case'||b.key==='tps'){
    ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.spin);
    drawIcon(ctx,b.key,b.key==='case'?10:9); ctx.restore(); return;
  }
  if(b.key==='darts'){
    ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(Math.atan2(b.vy,b.vx));
    drawIcon(ctx,'darts',9); ctx.restore(); return;
  }
  if(b.key==='stapler'){
    ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(Math.atan2(b.vy,b.vx));
    ctx.strokeStyle='#e8eef7'; ctx.lineWidth=2.4;
    ctx.beginPath(); ctx.moveTo(-4,-3); ctx.lineTo(3,-3); ctx.lineTo(3,3); ctx.lineTo(-4,3); ctx.stroke();
    ctx.restore(); return;
  }
  drawGlow('white',b.x,b.y,10,0.35);
  ctx.fillStyle=def.bcolor||'#fff';
  ctx.beginPath(); ctx.arc(b.x,b.y,b.r-1,0,TAU); ctx.fill();
}

/* ---------------- draw: robots ---------------- */
function drawEnemy(e){
  const x=e.x, y=e.y, r=e.def.r;
  ctx.save(); ctx.translate(x,y);
  const bob=Math.sin(e.wobble*6+e.seed)*2;
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0,r*0.9+4,r*0.9,r*0.28,0,0,TAU); ctx.fill();
  if(e.key==='chat'){
    ctx.translate(0,bob);
    drawGlow('red',0,-r-8,9,0.5);
    ctx.fillStyle='#394047'; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
    ctx.strokeStyle='#59626d'; ctx.lineWidth=2; ctx.stroke();
    ctx.strokeStyle='#8b93a3'; ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(0,-r-6); ctx.stroke();
    ctx.fillStyle='#ff5a5f'; ctx.beginPath(); ctx.arc(0,-r-8,2.6,0,TAU); ctx.fill();
    drawGlow('orange',-4,-2,7,0.55); drawGlow('orange',4,-2,7,0.55);
    ctx.fillStyle='#ffb26b'; ctx.fillRect(-6,-4,4,4); ctx.fillRect(2,-4,4,4);
    ctx.fillStyle='#20242b'; ctx.fillRect(-5,5,10,2);
  } else if(e.key==='roomba'||e.key==='groomba'){
    const gold=e.key==='groomba';
    ctx.rotate(e.wobble*(e.state===2?18:4));
    ctx.fillStyle=gold?'#8a6d1f':'#262b31'; ctx.beginPath(); ctx.ellipse(0,0,r,r*0.82,0,0,TAU); ctx.fill();
    ctx.fillStyle=gold?'#d4af37':'#33383f'; ctx.beginPath(); ctx.ellipse(0,0,r*0.75,r*0.6,0,0,TAU); ctx.fill();
    ctx.strokeStyle=e.state===1?'#ff5a5f':(gold?'#ffe28a':'#59626d'); ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.ellipse(0,0,r,r*0.82,0,0,TAU); ctx.stroke();
    ctx.strokeStyle=gold?'#8a6d1f':'#4a505c'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-r*0.7,0); ctx.lineTo(r*0.7,0);
    ctx.moveTo(0,-r*0.55); ctx.lineTo(0,r*0.55); ctx.stroke();
    drawGlow(e.state===1?'red':'orange',0,0,9,0.7);
    ctx.fillStyle=e.state===1?'#ff5a5f':'#ffb26b'; ctx.beginPath(); ctx.arc(0,0,3.5,0,TAU); ctx.fill();
  } else if(e.key==='beta'){
    ctx.translate(0,bob*0.5);
    const leg=Math.sin(e.wobble*9)*4;
    ctx.strokeStyle='#4a505c'; ctx.lineWidth=4.5;
    ctx.beginPath(); ctx.moveTo(-8,10); ctx.lineTo(-11,19+leg); ctx.moveTo(8,10); ctx.lineTo(11,19-leg); ctx.stroke();
    ctx.fillStyle='#394047'; roundedRectPath(ctx,-r*0.82,-r*0.92,r*1.64,r*1.56,4); ctx.fill();
    ctx.fillStyle='#191d22'; roundedRectPath(ctx,-r*0.62,-r*0.6,r*1.24,r*0.55,3); ctx.fill();
    drawGlow('orange',-r*0.3,-r*0.32,10,0.6); drawGlow('orange',r*0.3,-r*0.32,10,0.6);
    ctx.fillStyle='#ffb26b'; ctx.fillRect(-r*0.48,-r*0.46,r*0.34,r*0.28); ctx.fillRect(r*0.14,-r*0.46,r*0.34,r*0.28);
    ctx.fillStyle='#8b93a3'; ctx.fillRect(-3,-r*0.92-5,6,5);
  } else if(e.key==='drone'){
    ctx.translate(0,bob);
    ctx.strokeStyle='#59626d'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(-r,-r*0.7); ctx.lineTo(r,r*0.7); ctx.moveTo(r,-r*0.7); ctx.lineTo(-r,r*0.7); ctx.stroke();
    ctx.strokeStyle='rgba(180,190,200,0.55)'; ctx.lineWidth=2;
    for(const [rx,ry] of [[-r,-r*0.7],[r,-r*0.7],[-r,r*0.7],[r,r*0.7]]){
      ctx.beginPath(); ctx.ellipse(rx,ry,8,3,AT*30%TAU,0,TAU); ctx.stroke();
    }
    ctx.fillStyle='#394047'; roundedRectPath(ctx,-7,-6,14,12,3); ctx.fill();
    ctx.fillStyle='#8a5c34'; ctx.fillRect(-6,6,12,10);
    ctx.fillStyle='#e0d6b8'; ctx.fillRect(-1.5,6,3,10); ctx.fillRect(-6,10,12,2.5);
    const fusing=e.fuse!==undefined;
    if(fusing) drawGlow('red',0,0,16,0.6+0.4*Math.sin(AT*40));
    ctx.fillStyle=fusing&&Math.sin(AT*40)>0?'#ff5a5f':'#ffb26b';
    ctx.beginPath(); ctx.arc(0,-2,3,0,TAU); ctx.fill();
  } else if(e.key==='zap'){
    ctx.translate(0,bob);
    ctx.save(); ctx.rotate(Math.PI/4);
    ctx.fillStyle='#3b3244'; roundedRectPath(ctx,-r*0.8,-r*0.8,r*1.6,r*1.6,4); ctx.fill();
    ctx.strokeStyle='#6a4f7d'; ctx.lineWidth=2;
    roundedRectPath(ctx,-r*0.8,-r*0.8,r*1.6,r*1.6,4); ctx.stroke();
    ctx.restore();
    const wind=e.windT>0? (1-e.windT/0.5) : 0;
    drawGlow(wind>0?'white':'purple',0,0,14+wind*10,0.6+wind*0.4);
    ctx.fillStyle=wind>0?'#ffffff':'#c48df0';
    ctx.beginPath(); ctx.arc(0,0,4+wind*5,0,TAU); ctx.fill();
  } else if(e.key==='swarm'){
    ctx.rotate(Math.atan2(G.player.y-y,G.player.x-x));
    ctx.fillStyle='#463138';
    ctx.beginPath(); ctx.moveTo(r,0); ctx.lineTo(-r,-r*0.85); ctx.lineTo(-r*0.5,0); ctx.lineTo(-r,r*0.85);
    ctx.closePath(); ctx.fill();
    drawGlow('red',r*0.2,0,6,0.7);
    ctx.fillStyle='#ff5a5f'; ctx.beginPath(); ctx.arc(r*0.2,0,2,0,TAU); ctx.fill();
  } else if(e.key==='medic'){
    ctx.translate(0,bob);
    ctx.fillStyle='#e8e4da'; roundedRectPath(ctx,-r*0.8,-r*0.9,r*1.6,r*1.7,5); ctx.fill();
    ctx.strokeStyle='#b9b2a2'; ctx.lineWidth=2;
    roundedRectPath(ctx,-r*0.8,-r*0.9,r*1.6,r*1.7,5); ctx.stroke();
    ctx.fillStyle='#c22e35';
    ctx.fillRect(-2.5,-r*0.55,5,r*0.7); ctx.fillRect(-r*0.42,-r*0.28,r*0.84,5);
    ctx.fillStyle='#20242b'; ctx.fillRect(-r*0.5,r*0.15,r,r*0.28);
    drawGlow('green',0,r*0.29,8,0.5);
    ctx.fillStyle='#7ce88a'; ctx.fillRect(-r*0.3,r*0.2,r*0.6,r*0.16);
    if(e.healTarget && e.healTarget.hp>0){
      ctx.strokeStyle='rgba(124,232,138,0.7)'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.lineTo(e.healTarget.x-x, e.healTarget.y-y); ctx.stroke();
    }
  } else if(e.key==='split'){
    ctx.translate(0,bob*0.6);
    ctx.fillStyle='#3f3a48'; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
    ctx.strokeStyle='#191d22'; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.moveTo(-r*0.6,-r*0.4); ctx.lineTo(0,0); ctx.lineTo(r*0.5,-r*0.5);
    ctx.moveTo(0,0); ctx.lineTo(2,r*0.7); ctx.stroke();
    drawGlow('red',-4.5,-1.5,8,0.55); drawGlow('red',4.5,-1.5,8,0.55);
    ctx.fillStyle='#ff8a8d'; ctx.fillRect(-7,-4,5,5); ctx.fillRect(2,-4,5,5);
  } else if(e.key==='tank'){
    const tread=(e.wobble*40)%12;
    ctx.fillStyle='#15181c'; ctx.fillRect(-r,-r*0.92,r*2,r*1.84);
    ctx.strokeStyle='#000'; ctx.lineWidth=2;
    for(let ty=-r*0.92+tread; ty<r*0.92; ty+=12){
      ctx.beginPath(); ctx.moveTo(-r,ty); ctx.lineTo(-r*0.82,ty);
      ctx.moveTo(r*0.82,ty); ctx.lineTo(r,ty); ctx.stroke();
    }
    ctx.fillStyle='#33383f'; roundedRectPath(ctx,-r*0.82,-r*0.78,r*1.64,r*1.56,4); ctx.fill();
    ctx.fillStyle='#0d0f13';
    for(let i=0;i<3;i++){ roundedRectPath(ctx,-r*0.62,-r*0.58+i*r*0.42,r*1.24,r*0.24,2); ctx.fill(); }
    for(let i=0;i<3;i++){
      const on=Math.sin(AT*3+i*2+e.seed)>0;
      if(on) drawGlow('green',-r*0.5,-r*0.5+i*r*0.42+r*0.1,6,0.7);
      ctx.fillStyle=on?'#5cff8a':'#1e3a26';
      ctx.fillRect(-r*0.55,-r*0.52+i*r*0.42,4,4);
    }
    drawGlow('red',0,r*0.02,12,0.5);
    ctx.fillStyle='#ff5a5f'; ctx.fillRect(-r*0.25,-r*0.04,r*0.5,r*0.12);
  } else if(e.key==='firewall'){
    const fa=Math.atan2(G.player.y-y,G.player.x-x);
    ctx.rotate(fa);
    ctx.fillStyle='#33383f'; roundedRectPath(ctx,-r*0.9,-r*0.6,r*1.2,r*1.2,4); ctx.fill();
    drawGlow('orange',-r*0.35,-r*0.15,8,0.5);
    ctx.fillStyle='#ffb26b'; ctx.fillRect(-r*0.45,-r*0.22,r*0.3,r*0.22);
    ctx.fillStyle='#2a4a66'; roundedRectPath(ctx,r*0.3,-r*0.95,r*0.42,r*1.9,5); ctx.fill();
    ctx.strokeStyle='#6ec6ff'; ctx.lineWidth=2.5;
    roundedRectPath(ctx,r*0.3,-r*0.95,r*0.42,r*1.9,5); ctx.stroke();
    drawGlow('blue',r*0.5,0,r*1.1,0.28);
    ctx.fillStyle='#6ec6ff';
    ctx.fillRect(r*0.44,-r*0.6,3,3); ctx.fillRect(r*0.44,0,3,3); ctx.fillRect(r*0.44,r*0.55,3,3);
  } else if(e.key==='printer'){
    ctx.translate(0,bob*0.4);
    ctx.fillStyle='#b9b2a2'; roundedRectPath(ctx,-r,-r*0.7,r*2,r*1.4,5); ctx.fill();
    ctx.fillStyle='#8a8578'; ctx.fillRect(-r,-r*0.05,r*2,r*0.3);
    ctx.fillStyle='#191d22'; ctx.fillRect(-r*0.7,-r*0.5,r*1.4,r*0.3);
    drawGlow('red',0,-r*0.35,12,0.6);
    ctx.fillStyle='#ff5a5f'; ctx.font='bold '+(r*0.28)+'px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('ERR', 0, -r*0.35);
    ctx.fillStyle='#f7f5ee';
    const jam=e.windT>0?Math.sin(AT*30)*2:0;
    ctx.fillRect(-r*0.55+jam,r*0.28,r*1.1,r*0.34);
    ctx.strokeStyle='#b9b2a2'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(-r*0.4,r*0.4); ctx.lineTo(r*0.4,r*0.4); ctx.stroke();
  } else if(e.key==='mother'){
    ctx.translate(0,bob*1.4);
    ctx.strokeStyle='rgba(180,190,200,0.5)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(-r*0.85,-r*0.3,13,4,AT*26%TAU,0,TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(r*0.85,-r*0.3,13,4,AT*26%TAU,0,TAU); ctx.stroke();
    ctx.strokeStyle='#59626d'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(-r*0.85,-r*0.3); ctx.lineTo(r*0.85,-r*0.3); ctx.stroke();
    ctx.fillStyle='#443338'; ctx.beginPath(); ctx.ellipse(0,0,r*0.8,r*0.6,0,0,TAU); ctx.fill();
    ctx.strokeStyle='#6b4a52'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#191d22'; ctx.fillRect(-r*0.35,r*0.25,r*0.7,r*0.28);
    drawGlow('red',-r*0.25,-r*0.1,9,0.6); drawGlow('red',r*0.25,-r*0.1,9,0.6);
    ctx.fillStyle='#ff5a5f';
    ctx.beginPath(); ctx.arc(-r*0.25,-r*0.1,3.5,0,TAU); ctx.arc(r*0.25,-r*0.1,3.5,0,TAU); ctx.fill();
  } else if(e.key==='algo'){
    drawGlow('purple',0,0,r*1.5,0.4);
    ctx.fillStyle='#1c1826'; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
    ctx.strokeStyle='#3b3244'; ctx.lineWidth=3; ctx.stroke();
    for(let i=0;i<8;i++){
      const a0=AT*2.2 + i*TAU/8;
      ctx.strokeStyle='rgba(196,141,240,'+(0.15+0.85*(i/8))+')';
      ctx.lineWidth=7;
      ctx.beginPath(); ctx.arc(0,0,r*0.72,a0,a0+0.5); ctx.stroke();
    }
    drawGlow('white',0,0,16,0.7);
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,6,0,TAU); ctx.fill();
    if(e.tele>0){
      ctx.strokeStyle='rgba(255,90,95,'+(0.4+0.4*Math.sin(AT*24))+')'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(e.dashA)*420, Math.sin(e.dashA)*420); ctx.stroke();
    }
  } else if(e.key==='boss'){
    const enr=e.hp<e.maxhp*0.35;
    ctx.translate(0,bob);
    drawGlow(enr?'red':'purple',0,r*0.95,r*1.1,0.5);
    ctx.fillStyle='#23262e'; roundedRectPath(ctx,-r,-r,r*2,r*2,14); ctx.fill();
    ctx.strokeStyle=enr?'#ff5a5f':'#6a4f7d'; ctx.lineWidth=4;
    roundedRectPath(ctx,-r,-r,r*2,r*2,14); ctx.stroke();
    ctx.strokeStyle='#4a505c'; ctx.lineWidth=3;
    for(let i=-1;i<=1;i++){
      ctx.beginPath(); ctx.moveTo(i*r*0.4,-r); ctx.lineTo(i*r*0.5,-r-16-Math.abs(i)*6); ctx.stroke();
      const on=Math.sin(AT*4+i*2)>0;
      if(on) drawGlow('red',i*r*0.5,-r-18-Math.abs(i)*6,6,0.8);
      ctx.fillStyle=on?'#ff5a5f':'#5a2a2c';
      ctx.beginPath(); ctx.arc(i*r*0.5,-r-18-Math.abs(i)*6,2.6,0,TAU); ctx.fill();
    }
    const cy=-r*0.22;
    drawGlow(enr?'red':'purple',0,cy,34+Math.sin(AT*6)*5,0.85);
    ctx.fillStyle=enr?'#ff5a5f':'#c48df0';
    ctx.beginPath(); ctx.arc(0,cy,13+Math.sin(AT*6)*2.5,0,TAU); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=3;
    for(let i=0;i<5;i++){
      const a0=AT*1.6+i*TAU/5;
      ctx.beginPath(); ctx.arc(0,cy,23,a0,a0+0.7); ctx.stroke();
    }
    drawGlow('orange',-r*0.42,-r*0.68,12,0.7); drawGlow('orange',r*0.42,-r*0.68,12,0.7);
    ctx.fillStyle='#ffb26b';
    ctx.fillRect(-r*0.6,-r*0.72,r*0.36,8); ctx.fillRect(r*0.24,-r*0.72,r*0.36,8);
    ctx.fillStyle='#15181c'; roundedRectPath(ctx,-r*0.5,r*0.3,r,r*0.36,4); ctx.fill();
    ctx.fillStyle='#ece7db'; ctx.font='bold '+(r*0.3)+'px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('AGI', 0, r*0.49);
  }
  if(e.def.elite){
    ctx.strokeStyle='rgba(255,209,102,'+(0.4+0.3*Math.sin(AT*5))+')'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,r+9,0,TAU); ctx.stroke();
    ctx.fillStyle='#ffd166';
    for(let i=-1;i<=1;i++){
      ctx.beginPath();
      ctx.moveTo(i*8-5,-r-14); ctx.lineTo(i*8+5,-r-14); ctx.lineTo(i*8,-r-24);
      ctx.closePath(); ctx.fill();
    }
    ctx.font='bold 11px "Trebuchet MS",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#000'; ctx.fillText(e.def.name,1,-r-32);
    ctx.fillStyle='#ffd166'; ctx.fillText(e.def.name,0,-r-33);
  }
  if(e.key!=='boss' && e.key!=='algo' && e.hp<e.maxhp && e.hp>0){
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(-r,-r-10,r*2,4);
    ctx.fillStyle='#ff5a5f'; ctx.fillRect(-r,-r-10,r*2*clamp(e.hp/e.maxhp,0,1),4);
  }
  if(e.flash>0){
    ctx.globalCompositeOperation='source-atop';
    ctx.globalAlpha=0.85; ctx.fillStyle='#fff';
    ctx.fillRect(-r-8,-r-24,r*2+16,r*2+34);
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  }
  ctx.restore();
}

/* ---------------- draw: pickups, props, arrows ---------------- */
function drawPickup(p){
  if(p.kind==='bolt'){
    drawGlow('green',p.x,p.y,8,0.4);
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.t*3);
    ctx.fillStyle='#9be06f'; ctx.fillRect(-4,-2,8,4);
    ctx.fillStyle='#5da13c'; ctx.fillRect(-2,-4,4,8);
    ctx.restore();
  } else if(p.kind==='burger'){
    const bb=Math.sin(AT*4+p.t)*2;
    drawGlow('gold',p.x,p.y+bb,14,0.4);
    ctx.save(); ctx.translate(p.x,p.y+bb);
    ctx.fillStyle='#e8b054'; ctx.beginPath(); ctx.ellipse(0,-4,10,6,0,Math.PI,0); ctx.fill();
    ctx.fillStyle='#6e4726'; ctx.fillRect(-10,-3,20,4);
    ctx.fillStyle='#7cc451'; ctx.fillRect(-11,0.5,22,2.5);
    ctx.fillStyle='#e8b054'; roundedRectPath(ctx,-10,3,20,5,2); ctx.fill();
    ctx.fillStyle='#f4eeda';
    ctx.fillRect(-5,-6,1.6,1.6); ctx.fillRect(1,-7,1.6,1.6); ctx.fillRect(-1,-5,1.6,1.6);
    ctx.restore();
  } else if(p.kind==='crate'){
    drawGlow('gold',p.x,p.y,16,0.35);
    ctx.save(); ctx.translate(p.x,p.y);
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0,10,14,4,0,0,TAU); ctx.fill();
    ctx.fillStyle='#8a5c34'; roundedRectPath(ctx,-12,-9,24,19,2); ctx.fill();
    ctx.fillStyle='#e0d6b8'; ctx.fillRect(-2,-9,4,19); ctx.fillRect(-12,-2,24,4);
    ctx.strokeStyle='#5a3a1e'; ctx.lineWidth=1.5;
    roundedRectPath(ctx,-12,-9,24,19,2); ctx.stroke();
    ctx.restore();
  }
}
function drawTramp(){
  ctx.save(); ctx.translate(TRAMP.x,TRAMP.y);
  const sq=1-TRAMP.anim*0.12;
  ctx.strokeStyle='#33383f'; ctx.lineWidth=4;
  for(let i=0;i<4;i++){
    const a=i/4*TAU+0.6;
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*TRAMP.r*0.9,Math.sin(a)*TRAMP.r*0.9);
    ctx.lineTo(Math.cos(a)*TRAMP.r*1.05,Math.sin(a)*TRAMP.r*1.05+8); ctx.stroke();
  }
  ctx.fillStyle='#1d2025'; ctx.beginPath(); ctx.ellipse(0,0,TRAMP.r*sq,TRAMP.r*0.82*sq,0,0,TAU); ctx.fill();
  ctx.strokeStyle='#3f6bab'; ctx.lineWidth=9;
  ctx.beginPath(); ctx.ellipse(0,0,TRAMP.r*0.92*sq,TRAMP.r*0.75*sq,0,0,TAU); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1.5;
  for(let i=0;i<6;i++){
    const a=i/6*TAU;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*TRAMP.r*0.8*sq,Math.sin(a)*TRAMP.r*0.66*sq); ctx.stroke();
  }
  ctx.restore();
}
function drawFlams(){
  for(const fl of FLAM){
    ctx.save(); ctx.translate(fl.x,fl.y);
    ctx.rotate(fl.up?0 : fl.f*1.35*fl.dir);
    ctx.strokeStyle='#2a2d26'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-5,26); ctx.moveTo(4,0); ctx.lineTo(6,26); ctx.stroke();
    ctx.fillStyle='#ef7fa6'; ctx.beginPath(); ctx.ellipse(0,-6,13,9,0,0,TAU); ctx.fill();
    ctx.strokeStyle='#ef7fa6'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(10,-10); ctx.quadraticCurveTo(20,-26,12,-32); ctx.stroke();
    ctx.fillStyle='#ef7fa6'; ctx.beginPath(); ctx.arc(11,-33,4.5,0,TAU); ctx.fill();
    ctx.fillStyle='#1a1a1a'; ctx.beginPath();
    ctx.moveTo(7,-34); ctx.lineTo(1,-31); ctx.lineTo(7,-30); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function drawCanopies(){
  // shed roof, drawn overhead so anything north of the shed passes behind it
  ctx.fillStyle='rgba(0,0,0,0.25)';
  ctx.fillRect(2066,252,408,14);
  const rg=ctx.createLinearGradient(0,120,0,262);
  rg.addColorStop(0,'#8a7660'); rg.addColorStop(1,'#5f4d38');
  ctx.fillStyle=rg;
  ctx.beginPath(); ctx.moveTo(2066,262); ctx.lineTo(2474,262); ctx.lineTo(2420,120); ctx.lineTo(2120,120);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#3a2c1c'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(2066,262); ctx.lineTo(2474,262); ctx.lineTo(2420,120); ctx.lineTo(2120,120);
  ctx.closePath(); ctx.stroke();
  ctx.strokeStyle='rgba(58,44,28,0.6)'; ctx.lineWidth=2;
  for(let ry=140;ry<260;ry+=18){
    const t=(262-ry)/142;
    ctx.beginPath();
    ctx.moveTo(2066+(2120-2066)*t, ry);
    ctx.lineTo(2474-(2474-2420)*t, ry);
    ctx.stroke();
  }
  ctx.fillStyle='#9c8870'; ctx.fillRect(2114,112,312,12);
  for(const t of TREES){
    ctx.save(); ctx.translate(t.x+Math.sin(AT*0.5)*4, t.y-26);
    ctx.globalAlpha=0.96;
    ctx.fillStyle='#24421f';
    for(const [ox,oy,rr] of [[0,0,74],[-52,18,48],[54,14,50],[-20,-38,44],[30,-34,40]]){
      ctx.beginPath(); ctx.arc(ox,oy,rr,0,TAU); ctx.fill();
    }
    ctx.fillStyle='#33582b';
    for(let i=0;i<16;i++){
      ctx.beginPath(); ctx.arc(rand(-70,70),rand(-50,40),rand(3,7),0,TAU); ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha=1;
}
function drawArrows(cam,Z){
  if(G.mode!=='play'&&G.mode!=='pause') return;
  const targets=[];
  for(const e of G.enemies){
    if(e.def.elite) targets.push({x:e.x,y:e.y,c:'#ffd166'});
    if(e.key==='boss'||e.key==='algo') targets.push({x:e.x,y:e.y,c:'#ff5a5f'});
  }
  for(const p of G.pickups){
    if(p.kind==='crate') targets.push({x:p.x,y:p.y,c:'#e0a34d'});
    if(p.kind==='burger'&&p.grill) targets.push({x:p.x,y:p.y,c:'#9be06f'});
  }
  const m=34;
  for(const t of targets){
    const sx=(t.x-cam.x)*Z+VW/2, sy=(t.y-cam.y)*Z+VH/2;
    if(sx>m&&sx<VW-m&&sy>m&&sy<VH-m) continue;
    const cx2=clamp(sx,m,VW-m), cy2=clamp(sy,m,VH-m);
    const ang=Math.atan2(sy-VH/2,sx-VW/2);
    ctx.save(); ctx.translate(cx2,cy2); ctx.rotate(ang);
    ctx.globalAlpha=0.5+0.3*Math.sin(AT*6);
    ctx.fillStyle=t.c;
    ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-7,-8); ctx.lineTo(-7,8); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha=1;
  }
}

/* ---------------- master draw ---------------- */
function draw(){
  ctx.fillStyle='#101410'; ctx.fillRect(0,0,VW,VH);
  const cam=G.cam, Z=zoomLevel();
  const shx=rand(-1,1)*cam.shake, shy=rand(-1,1)*cam.shake;
  ctx.save();
  ctx.translate(VW/2,VH/2); ctx.scale(Z,Z);
  ctx.translate(-cam.x+shx, -cam.y+shy);
  ctx.drawImage(FLOOR,0,0);
  for(const fl of FLIES){
    const a=0.25+0.35*(0.5+0.5*Math.sin(AT*1.8+fl.ph));
    drawGlow('gold',fl.x,fl.y,7,a);
  }
  drawTramp();
  drawFlams();
  // pool ripples + grill ready glow
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=2;
  for(let i=0;i<2;i++){
    const rr=((AT*22+i*60)%120);
    ctx.globalAlpha=0.5*(1-rr/120);
    ctx.beginPath(); ctx.arc(2160,1552,16+rr,0,TAU); ctx.stroke();
  }
  ctx.globalAlpha=1;
  if(G.burgerOut) drawGlow('orange',GRILLPOS.x,GRILLPOS.y-6,32,0.35+0.2*Math.sin(AT*8));
  // sprinkler jet
  const jx=Math.cos(SPRINK.a), jy=Math.sin(SPRINK.a);
  ctx.strokeStyle='rgba(127,199,232,0.28)'; ctx.lineWidth=6;
  ctx.beginPath(); ctx.moveTo(SPRINK.x,SPRINK.y);
  ctx.lineTo(SPRINK.x+jx*170,SPRINK.y+jy*170); ctx.stroke();
  if(G.mode==='menu'){
    for(const d of DECOR) drawEnemy(d);
    const P=G.player;
    drawDad(P);
    const n=G.weapons.length;
    G.weapons.forEach((w,i)=>{
      const a=AT*0.7 + i*TAU/Math.max(1,n);
      ctx.save();
      ctx.translate(P.x+Math.cos(a)*52, P.y+Math.sin(a)*52);
      ctx.rotate(a+Math.PI/2);
      drawIcon(ctx,w.key,11);
      ctx.restore();
    });
  } else {
    for(const w of G.warns){
      const p=1-w.t/w.max;
      if(w.kind==='drop'){
        ctx.fillStyle='rgba(0,0,0,'+(0.15+0.2*p)+')';
        ctx.beginPath(); ctx.ellipse(w.x,w.y,20*p+6,7*p+2,0,0,TAU); ctx.fill();
        const oy=(1-p)*300;
        ctx.save(); ctx.translate(w.x,w.y-oy);
        ctx.fillStyle='#e8e4da';
        ctx.beginPath(); ctx.moveTo(0,-26); ctx.lineTo(-16,-8); ctx.lineTo(16,-8); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#8a5c34'; roundedRectPath(ctx,-10,-8,20,16,2); ctx.fill();
        ctx.fillStyle='#e0d6b8'; ctx.fillRect(-1.5,-8,3,16);
        ctx.restore();
        continue;
      }
      const big = w.kind==='bossw'||w.kind==='elite';
      drawGlow(w.kind==='elite'?'gold':'red',w.x,w.y,(big?60:22),0.35+0.3*Math.sin(AT*18));
      ctx.strokeStyle=w.kind==='elite'?'rgba(255,209,102,0.9)':'rgba(255,90,95,0.9)';
      ctx.lineWidth=big?4:2;
      ctx.beginPath(); ctx.arc(w.x,w.y,(big?54:16)*(1-p*0.4),0,TAU); ctx.stroke();
      ctx.fillStyle='rgba(255,230,230,'+(0.6+0.4*Math.sin(AT*20))+')';
      ctx.font='bold '+(big?30:14)+'px monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('!',w.x,w.y);
    }
    for(const p of G.pickups) drawPickup(p);
    for(const e of G.enemies) drawEnemy(e);
    if(!G.player.dead){
      if(G.player.mowT>0) drawMower(G.player);
      else { drawDad(G.player); drawWeapons(); }
    }
    for(const b of G.bullets) drawBullet(b);
    for(const b of G.ebullets){
      drawGlow('red',b.x,b.y,13,0.6);
      ctx.fillStyle=b.paper?'#f7f5ee':'#ff6b6f';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,TAU); ctx.fill();
    }
  }
  for(const p of G.parts){
    const a=p.life/p.max;
    if(p.color==='ring'){
      ctx.strokeStyle='rgba(255,209,102,'+a+')'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1.4-a*0.4),0,TAU); ctx.stroke();
    } else if(p.color==='flash'){
      drawGlow('white',p.x,p.y,p.r*(1.2-a*0.2),a*0.8);
    } else if(p.color==='smoke'){
      ctx.globalAlpha=a*0.35; ctx.fillStyle='#6d7178';
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1.6-a*0.6),0,TAU); ctx.fill();
      ctx.globalAlpha=1;
    } else if(p.color==='ghost'){
      ctx.globalAlpha=a*0.4; ctx.fillStyle='#4f81b0';
      ctx.fillRect(p.x-6,p.y-12,12,24); ctx.globalAlpha=1;
    } else if(p.color==='shoe'){
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle='#f5f5f5'; ctx.fillRect(-8,-4,16,7);
      ctx.fillStyle='#b9b9b9'; ctx.fillRect(-8,3,16,3);
      ctx.restore();
    } else if(p.color==='nut'){
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle='#8b93a3';
      ctx.beginPath();
      for(let i=0;i<6;i++){ const a2=i/6*TAU;
        if(i===0) ctx.moveTo(Math.cos(a2)*p.r,Math.sin(a2)*p.r);
        else ctx.lineTo(Math.cos(a2)*p.r,Math.sin(a2)*p.r); }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    } else {
      ctx.globalAlpha=a; ctx.fillStyle=p.color;
      ctx.fillRect(p.x-p.r/2,p.y-p.r/2,p.r,p.r);
      ctx.globalAlpha=1;
    }
  }
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(const t of G.texts){
    const pop = 1 + Math.max(0,(t.life/t.max)-0.7)*2.2;
    ctx.globalAlpha=clamp(t.life/0.5,0,1);
    ctx.save(); ctx.translate(t.x,t.y); ctx.scale(pop,pop);
    ctx.font=(t.big?'bold 22px':'bold 15px')+' "Trebuchet MS",sans-serif';
    ctx.fillStyle='#000'; ctx.fillText(t.txt,1,2);
    ctx.fillStyle=t.color; ctx.fillText(t.txt,0,0);
    ctx.restore();
    ctx.globalAlpha=1;
  }
  drawCanopies();
  ctx.restore();
  let g=ctx.createLinearGradient(0,0,0,VH);
  g.addColorStop(0,'rgba(255,150,70,0.06)');
  g.addColorStop(0.45,'rgba(0,0,0,0)');
  g.addColorStop(1,'rgba(18,20,52,0.22)');
  ctx.fillStyle=g; ctx.fillRect(0,0,VW,VH);
  g=ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*0.35,VW/2,VH/2,Math.max(VW,VH)*0.72);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.34)');
  ctx.fillStyle=g; ctx.fillRect(0,0,VW,VH);
  if(G.player.iframe>0.35 && !G.player.dead && G.mode!=='menu'){
    const a=(G.player.iframe-0.35)/0.35*0.35;
    g=ctx.createRadialGradient(VW/2,VH/2,VH*0.35,VW/2,VH/2,VH*0.75);
    g.addColorStop(0,'rgba(255,0,0,0)'); g.addColorStop(1,'rgba(255,30,30,'+a+')');
    ctx.fillStyle=g; ctx.fillRect(0,0,VW,VH);
  }
  drawArrows(cam,Z);
  if(touch.active && G.mode==='play'){
    ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(touch.ox,touch.oy,50,0,TAU); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(touch.ox+touch.dx,touch.oy+touch.dy,20,0,TAU); ctx.fill();
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
