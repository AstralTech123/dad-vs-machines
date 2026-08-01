/* DAD vs THE MACHINES: systems (actives, spawning, combat, yard interactions, waves, shop) */
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

/* apply a champion's stat mods and starting weapon; call right after newGame() */
function applyChamp(key){
  const c=CHAMPS[key]||CHAMPS.dad;
  G.champ=key; G.perk=c.perk||null;
  const st=G.stats, m=c.mods||{};
  st.maxHP+=(m.maxHP||0); st.move+=(m.move||0); st.dmg+=(m.dmg||0); st.atk+=(m.atk||0);
  st.crit+=(m.crit||0); st.armor+=(m.armor||0); st.pickup+=(m.pickup||0); st.regen+=(m.regen||0);
  G.hp=st.maxHP;
  G.weapons=[ mkWeapon(c.weapon||'stapler',1) ];
  updateHUD(); renderSlots();
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

