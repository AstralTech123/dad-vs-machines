/* DAD vs THE MACHINES: systems (actives, spawning, combat, yard interactions, waves, shop) */
/* ---------------- actives ---------------- */
function tryDash(){
  const P=G.player;
  if(G.mode!=='play'||P.dead||P.dashCd>0||P.mowT>0) return;
  let ix=0, iy=0;
  if(G.active && G.active.pad!==null){
    const st2=PADS[G.active.pad];
    if(st2 && st2.mag>0){ ix=st2.x; iy=st2.y; }
  } else {
    if(keys['w']||keys['arrowup']) iy-=1;
    if(keys['s']||keys['arrowdown']) iy+=1;
    if(keys['a']||keys['arrowleft']) ix-=1;
    if(keys['d']||keys['arrowright']) ix+=1;
    if(touch.active && (Math.abs(touch.dx)>7||Math.abs(touch.dy)>7)){ ix=touch.dx; iy=touch.dy; }
    if(PAD.active && Math.hypot(ix,iy)<0.01){ ix=PAD.x; iy=PAD.y; }
  }
  let len=Math.hypot(ix,iy);
  if(len<0.01){ ix=P.face; iy=0; len=1; }
  P.ddx=ix/len; P.ddy=iy/len;
  P.dashT=0.13; P.dashCd=G.stats.dashCdMax;
  P.iframe=Math.max(P.iframe,G.stats.dashIF);
  if(G.perk==='whistle'){
    for(const e of [...G.enemies]){
      const d=Math.hypot(e.x-P.x,e.y-P.y);
      if(d<170){
        const a=Math.atan2(e.y-P.y,e.x-P.x);
        const kr=e.def.knockR!==undefined?e.def.knockR:1;
        e.kx+=Math.cos(a)*520*kr; e.ky+=Math.sin(a)*520*kr;
      }
    }
    sfx.spring();
  }
  sfx.dashw();
}
function tryMow(){
  const P=G.player;
  if(G.mode!=='play'||P.dead||P.mowT>0||P.ult<G.stats.ultNeed) return;
  P.mowT=G.stats.mowDur; P.ult=0; G.ultToast=false;
  banner('MOWER TIME','PURE YARD WORK');
  sfx.bossroar(); G.cam.shake=Math.min(16,G.cam.shake+8);
  updateHUD();
}

/* ---------------- wave scaling + spawning ---------------- */
function hpMul(w){ return 1 + 0.35*(w-1) + 0.032*(w-1)*(w-1); }
function dmgMul(w){ return 1 + 0.14*(w-1); }
function spdMul(w){ return 1 + 0.02*(w-1); }

function startWave(n){
  G.wave=n; G.waveTime=WAVE_DUR[n]; G.sub='play'; G.subT=0;
  G.bullets.length=0; G.ebullets.length=0; G.enemies.length=0;
  G.pickups.length=0; G.warns.length=0; G.spawnBudget=2.5; G.boss=null;
  G.players.forEach((pl,i)=>{
    const b=pl.body;
    if(b.dead){ b.dead=false; b.deadT=0; pl.hp=Math.round(pl.stats.maxHP*0.5); }
    else pl.hp=pl.stats.maxHP;
    b.x=1300+(i-(G.players.length-1)/2)*54; b.y=1000; b.iframe=1;
    b.bvx=0; b.bvy=0; b.mowT=0; b.dashT=0;
    pl.reviveT=0;
  });
  setActive(G.players[0]);
  G.grillT=Math.min(G.grillT, 10); G.burgerOut=false; G.dropT=rand(12,20);
  G.eliteQ=[];
  const dur=WAVE_DUR[n];
  if(n>=2){ G.eliteQ.push(dur*0.5);
    if(n>=5) G.eliteQ.push(dur*0.24);
    if(n>=8) G.eliteQ.unshift(dur*0.72); }
  // mini fridge: a cold burger per fridge owned, waiting at wave start
  const fridges=G.players.reduce((s,q)=>s+(q.abil.fridge||0),0);
  for(let f=0; f<fridges; f++)
    G.pickups.push({ x:1300+rand(-70,70), y:1080+rand(-20,20), vx:0, vy:0, mag:false, t:0, kind:'burger', val:15 });
  // neighbor favor: revert last wave's boost, then apply the queued one (whole couch)
  if(G.favorApplied){
    for(const pl of G.players) for(const k in G.favorApplied) pl.stats[k]-=G.favorApplied[k];
    G.favorApplied=null;
  }
  if(G.favorNext){
    const F=FAVORS[G.favorNext];
    G.favorApplied=Object.assign({},F.deltas);
    for(const pl of G.players) for(const k in F.deltas) pl.stats[k]+=F.deltas[k];
    toast('🤝 '+CHAMPS[G.favorNext].name+' lends a hand this wave');
    G.favorNext=null;
  }
  // chore contract on non-boss waves from wave 2 on
  G.contract = (n>=2 && !bossFor(n)) ? { def:pick(CONTRACTS), prog:0, dmg:false } : null;
  // rare bolt courier from wave 4 on
  G.courierT = (n>=4 && Math.random()<0.3) ? rand(8, WAVE_DUR[n]*0.6) : undefined;
  if(G.contract){
    const ctxt='🧹 Optional chore: '+G.contract.def.txt+' (pays bolts and XP)';
    setTimeout(()=>{ if(G.contract) toast(ctxt); }, G.favorApplied?2600:800);
  }
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
  // weapon class identity: preferred class gets a bonus, restricted champs a bigger one
  if(c.wpref) st[c.wpref+'Mul'] += (c.wonly? 0.35 : 0.2);
  if(c.perk==='complaint') st.auraSlow=0.28;
  else if(c.perk==='whistle') st.meleeMul+=0.3;
  else if(c.perk==='overclock') st.critMul=3;
  else if(c.perk==='grillmaster'){ st.burgerMul=2; st.grillMul=0.45; G.grillT=4; }
  else if(c.perk==='coupons'){ st.priceMul=0.8; st.rerollMul=0.5; }
  else if(c.perk==='flow'){ st.dashCdMax=1.25; st.dashIF=0.55; }
  else if(c.perk==='binoculars') st.rangeMul=1.25;
  else if(c.perk==='thorns') st.thorns=8;
  else if(c.perk==='bookclub') st.areaMul=1.45;
  else if(c.perk==='oorah') st.rage=0.25;
  G.hp=st.maxHP;
  G.weapons.length=0;
  G.weapons.push(mkWeapon(c.weapon||'stapler',1));
  updateHUD(); renderSlots();
}
function flavor(n){
  const F=['','They said it was just autocomplete.','The pop-ups are walking now.',
    'Same-day delivery. Of explosions.','It is aiming at you specifically.','Survive the clock. Then meet The Algorithm.',
    'Someone gave it legs.','It brought a shield to a yard fight.','It read your emails.',
    'It knows about the 401k.','The invoice is coming due.',
    'It unionized. Against you.','It learned to parallel park.','It is in your walls. Literally.',
    'The firmware update made it angrier.','Forecast: cloudy with a chance of doom.',
    'It subscribed you to everything.','It found the good scissors.','It speaks HOA now.',
    'One more quarter of growth.','The final performance review.'];
  if(n<F.length) return F[n];
  return pick(['They keep coming.','Still coming.','The machines remember.','No more warranty.','This is the overtime of overtime.']);
}
function addWarn(x,y,t,kind,ekind){ G.warns.push({x,y,t,max:t,kind:kind||'e',def:null,ekind:ekind||null}); }
function scheduleSpawn(defKey,x,y){ G.warns.push({x,y,t:0.7,max:0.7,kind:'e',def:defKey,ekind:null}); }
function spawnEnemy(defKey,x,y,child){
  const d=EDEFS[defKey], w=G.wave;
  const coopHP=1+0.6*(G.players.length-1);
  const dhp=d.hp*hpMul(w)*DF().hp*coopHP;
  const e={ def:d, key:defKey, x, y, hp:dhp, maxhp:dhp,
    spd:d.spd*spdMul(w)*rand(0.92,1.08), flash:0, kx:0, ky:0, contactCd:0,
    seed:rand(0,TAU), state:0, stateT:rand(0,1.5), windT:0, child:!!child, wobble:rand(0,9),
    trampCd:0 };
  if(d.boss){
    const endlessMul = G.wave>FINAL_WAVE ? hpMul(G.wave)/hpMul(FINAL_WAVE) : 1;
    e.hp=e.maxhp=Math.round(d.hp*DF().hp*endlessMul);
    G.boss=e;
  }
  // traits: from wave 6, machines can spawn with an affix (more loot and XP)
  if(!d.boss && !d.courier && !child && G.wave>=6 && Math.random() < Math.min(0.3, 0.045*(G.wave-5))*DF().rate){
    e.trait=pick(Object.keys(TRAITS));
    TRAITS[e.trait].apply(e);
  }
  if(defKey==='boss'){ e.burstT=2.0; e.addT=5; e.spiral=0; e.volT=2.0; }
  if(defKey==='subs'){ e.billT=3.5; e.burstT=6; e.spiral=0; }
  if(defKey==='cloud'){ e.spiral=rand(0,TAU); e.fireT=0.4; e.addT=6; e.orbDir=Math.random()<0.5?1:-1; }
  if(defKey==='algo'){ e.spiral=rand(0,TAU); e.fireT=0.4; e.dashCd2=5;
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
  G.spawnBudget += dt * (1.0 + 0.74*w) * ramp * DF().rate * (w<=2?0.85:1) * (1+0.5*(G.players.length-1));
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
  if(P.dead){
    P.deadT+=dt;
    if(P.deadT>1.4 && G.mode==='play' && G.players.every(q=>q.body.dead)) showDead();
    return;
  }
  P.dashCd=Math.max(0,P.dashCd-dt);
  P.trampCd=Math.max(0,P.trampCd-dt);
  if(P.mowT>0){
    P.mowT-=dt;
    G.mowSfxT-=dt;
    if(G.mowSfxT<=0){ sfx.mow(); G.mowSfxT=0.11; }
    if(P.mowT<=0){ P.mowT=0; toast('Out of gas.'); }
  }
  let ix=0, iy=0;
  if(G.active && G.active.pad!==null){
    const st2=PADS[G.active.pad];
    if(st2 && st2.mag>0){ ix=st2.x; iy=st2.y; }
  } else {
    if(keys['w']||keys['arrowup']) iy-=1;
    if(keys['s']||keys['arrowdown']) iy+=1;
    if(keys['a']||keys['arrowleft']) ix-=1;
    if(keys['d']||keys['arrowright']) ix+=1;
    if(touch.active && (Math.abs(touch.dx)>7||Math.abs(touch.dy)>7)){ ix=touch.dx/52; iy=touch.dy/52; }
    /* pad steers P1 only when keyboard and touch are idle */
    if(PAD.active && Math.hypot(ix,iy)<0.01){ ix=PAD.x; iy=PAD.y; }
  }
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
  // owning a legendary earns you the WoW sparkle
  if(G.hasLegend && Math.random()<dt*4)
    spawnPart(P.x+rand(-14,14), P.y+rand(-22,8), -Math.PI/2+rand(-0.4,0.4), rand(8,26), 0.55, '#ffd166', 2);
}
/* hit a specific player regardless of the current alias */
function hurtPlayer(pl,raw){
  const prev=G.active;
  setActive(pl);
  const r=damagePlayer(raw);
  saveActive();
  if(prev&&prev!==pl) setActive(prev);
  return r;
}
/* returns true when the attack connected (including a dodge, which still
   consumes the attacker's swing) so callers can pace their cooldowns */
function damagePlayer(raw){
  const P=G.player;
  raw*=DF().dmg;
  if(P.dead||P.iframe>0||P.mowT>0) return false;
  if(G.stats.dodge>0 && Math.random()<G.stats.dodge){
    floatText(P.x,P.y-46,'DODGE','#8fd0ea'); return true;
  }
  const dmg=Math.max(1, Math.round(raw - G.stats.armor));
  // brief 0.1s buffer only smooths same-frame spikes; each machine's own
  // contactCd is what paces its hits, so crowds now deal full stacked damage
  G.hp-=dmg; P.iframe=0.1; G.cam.shake=Math.min(18,G.cam.shake+7);
  floatText(P.x,P.y-46,'-'+dmg,'#ff5a5f'); sfx.hurt();
  if(G.stats.thorns){
    for(const e of [...G.enemies]){
      if(dist2(P.x,P.y,e.x,e.y)<(e.def.r+42)*(e.def.r+42))
        hitEnemy(e, G.stats.thorns, Math.atan2(e.y-P.y,e.x-P.x), 160, false);
    }
  }
  if(G.contract) G.contract.dmg=true;
  if(G.hp<=0){ G.hp=0; P.dead=true; P.deadT=0; playerDeathFX(); }
  updateHUD();
  return true;
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
function clsMul(def){
  return def.cls==='melee'?G.stats.meleeMul : def.cls==='blast'?G.stats.blastMul : G.stats.rangedMul;
}
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
          hitEnemy(e, ts.dmg*clsMul(def), Math.atan2(e.y-P.y,e.x-P.x), 120, rollCrit());
        }
      }
      return;
    }
    const slotA = -Math.PI/2 + (i-(n-1)/2)*0.55;
    w.hx = P.x + Math.cos(slotA)*30;
    w.hy = P.y + Math.sin(slotA)*30 - 2;
    const tgt = nearestEnemy(P.x,P.y, (def.range||500)*G.stats.rangeMul);
    if(tgt){ w.aim = lerp0(w.aim, Math.atan2(tgt.y-w.hy, tgt.x-w.hx), 14*dt); }
    else { w.aim = lerp0(w.aim, P.face===1?-0.2:Math.PI+0.2, 6*dt); }
    if(!tgt || w.cd>0) return;
    w.cd = ts.cd; w.recoil=1; w.flash=0.07;
    if(def.melee==='cone'){
      sfx.shoot(def.pitch);
      const baseA=w.aim;
      for(const e of G.enemies){
        const d=Math.hypot(e.x-P.x,e.y-P.y);
        if(d<def.range*G.stats.rangeMul+e.def.r && Math.abs(angDiff(baseA,Math.atan2(e.y-P.y,e.x-P.x)))<def.cone){
          hitEnemy(e, ts.dmg*clsMul(def), baseA, def.knock, rollCrit());
        }
      }
      for(let k=0;k<9;k++) spawnPart(w.hx,w.hy, baseA+rand(-0.55,0.55), rand(220,460), rand(0.25,0.4),
        pick(['#bde8c4','#e8f7ff','#9be06f']), rand(2,3.5));
      return;
    }
    sfx.shoot(def.pitch);
    const count=def.count||1;
    for(let c=0;c<count;c++){
      const spread = def.spread? (c-(count-1)/2)*def.spread : rand(-0.03,0.03);
      const a=w.aim+spread;
      G.bullets.push({ x:w.hx, y:w.hy, vx:Math.cos(a)*def.speed, vy:Math.sin(a)*def.speed,
        dmg:ts.dmg*clsMul(def), pierce:def.pierce||0, r:def.aoe?7:5, life:((def.range||400)*G.stats.rangeMul)/def.speed,
        key:w.key, aoe:(def.aoe||0)*G.stats.areaMul, knock:def.knock||60, crit:rollCrit(),
        boom:!!def.boomerang, phase:0, spin:rand(0,TAU), hitSet:{}, own:G.active });
    }
  });
}
function updateBullets(dt){
  for(let i=G.bullets.length-1;i>=0;i--){
    const b=G.bullets[i];
    /* credit hits, lifesteal, and mower charge to the bullet's owner */
    if(b.own && b.own!==G.active && G.players.includes(b.own)){ saveActive(); setActive(b.own); }
    const P=(b.own&&G.players.includes(b.own))? b.own.body : G.players[0].body;
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
  let mult = G.stats.dmg*(crit?G.stats.critMul:1);
  if(G.stats.rage && G.hp<=G.stats.maxHP*0.5) mult*=1+G.stats.rage;
  if(e.dr) mult*=(1-e.dr);
  let blocked=false;
  if(e.def.frontDR){
    const fe=Math.atan2(G.player.y-e.y, G.player.x-e.x);
    if(Math.abs(angDiff(ang, fe+Math.PI))<1.05){ mult*=0.2; blocked=true; }
  }
  const final=Math.max(1,Math.round(dmg*mult));
  e.hp-=final; e.flash=0.09;
  if(G.stats.lifesteal>0 && !G.player.dead && G.hp>0 && G.hp<G.stats.maxHP){
    G.lsAcc=(G.lsAcc||0)+final*G.stats.lifesteal;
    if(G.lsAcc>=1){ const h=Math.floor(G.lsAcc); G.lsAcc-=h; G.hp=Math.min(G.stats.maxHP,G.hp+h); }
  }
  const kr = e.def.knockR!==undefined? e.def.knockR : 1;
  e.kx += Math.cos(ang)*knock*kr; e.ky += Math.sin(ang)*knock*kr;
  floatText(e.x+rand(-8,8), e.y-e.def.r-10, final, blocked?'#9aa2ae':(crit?'#ffd166':'#ffffff'), crit);
  if(blocked) sfx.tink(); else sfx.hit();
  for(let k=0;k<3;k++) spawnPart(e.x,e.y, ang+rand(-0.7,0.7), rand(80,220), 0.25, blocked?'#9ecbff':'#ffd166', 2);
  if(e.hp<=0) killEnemy(e);
}
function gainXP(n){
  G.xp+=n;
  while(G.xp>=xpNeed(G.level)){
    G.xp-=xpNeed(G.level); G.level++; G.pendingLvls++;
    floatText(G.player.x,G.player.y-56,'LEVEL UP!','#ffd166',true);
    sfx.levelup();
  }
}
function killEnemy(e){
  const idx=G.enemies.indexOf(e); if(idx<0) return;
  G.enemies.splice(idx,1);
  G.kills++;
  gainXP(Math.round((e.def.boss ? 30 : e.def.elite ? 12 : e.def.mats)*(e.trait?1.5:1)));
  if(e.volatile){
    spawnPart(e.x,e.y,0,0,0.2,'flash',60);
    ringPart(e.x,e.y,70);
    for(let k=0;k<8;k++) spawnPart(e.x,e.y,rand(0,TAU),rand(60,240),0.4,'#ff9a4d',3);
    sfx.boom();
    for(const q of G.players){
      if(!q.body.dead && dist2(e.x,e.y,q.body.x,q.body.y)<84*84)
        hurtPlayer(q, 6*dmgMul(G.wave));
    }
  }
  const P=G.player;
  if(P.ult<G.stats.ultNeed){
    P.ult++;
    if(P.ult>=G.stats.ultNeed && !G.ultToast){ G.ultToast=true; toast('🚜 MOWER READY! Press E'); sfx.combine(); }
  }
  if(G.contract){
    if(G.contract.def.key==='swarm' && e.key==='swarm') G.contract.prog++;
    if(G.contract.def.key==='mow' && e._byMow) G.contract.prog++;
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
  if(e.def.courier){
    const loot=Math.round((20+3*G.wave)*(1+G.stats.luck)*DF().loot*(1+0.25*(G.players.length-1)));
    for(let m=0;m<loot;m++) G.pickups.push({ x:e.x+rand(-18,18), y:e.y+rand(-18,18),
      vx:rand(-140,140), vy:rand(-160,-20), mag:false, t:0, kind:'bolt', val:1 });
    banner('COURIER SCRAPPED','+'+loot+' BOLTS INTERCEPTED');
    G.cam.shake=14;
  }
  if(e.def.elite){
    const loot=Math.round((12+3*G.wave)*(1+G.stats.luck)*DF().loot);
    for(let m=0;m<loot;m++) G.pickups.push({ x:e.x+rand(-16,16), y:e.y+rand(-16,16),
      vx:rand(-120,120), vy:rand(-140,-20), mag:false, t:0, kind:'bolt', val:1 });
    G.pickups.push({ x:e.x, y:e.y, vx:rand(-40,40), vy:-60, mag:false, t:0, kind:'burger', val:15 });
    banner('ELITE SCRAPPED','+'+loot+' BOLTS AND A BURGER');
    G.cam.shake=18;
  } else {
    const mats = e.child?0:Math.round(e.def.mats*DF().loot*(e.trait?1.5:1)*(1+0.25*(G.players.length-1)));
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
  for(const q of G.players){
    if(!q.body.dead && dist2(e.x,e.y,q.body.x,q.body.y)<(r+14)*(r+14))
      hurtPlayer(q, e.def.blast*dmgMul(G.wave));
  }
  for(const o of [...G.enemies]){
    if(o!==e && dist2(e.x,e.y,o.x,o.y)<(r+o.def.r)*(r+o.def.r)){
      hitEnemy(o, 12, Math.atan2(o.y-e.y,o.x-e.x), 200, false);
    }
  }
  e.hp=0; killEnemy(e);
}
function updateEnemies(dt){
  for(const e of G.enemies){
    e.flash=Math.max(0,e.flash-dt);
    e.contactCd=Math.max(0,e.contactCd-dt);
    e.trampCd=Math.max(0,e.trampCd-dt);
    e.stateT-=dt; e.wobble+=dt;
    e.x+=e.kx*dt; e.y+=e.ky*dt;
    e.kx*=Math.pow(0.002,dt); e.ky*=Math.pow(0.002,dt);
    /* each machine hunts the nearest living neighbor */
    const tp=nearestPlayer(e.x,e.y);
    const P=tp? tp.body : G.players[0].body;
    const a=Math.atan2(P.y-e.y,P.x-e.x), d=Math.hypot(P.x-e.x,P.y-e.y);
    const inPool=inMud(e.x,e.y);
    const mudF = inPool?(G.yard.pool>=1?0.36:0.55):1;
    if(inPool && G.yard.pool>=2){ e.hp-=4*dt; if(e.hp<=0){ killEnemy(e); continue; } }
    let zapped=false;
    for(const q of G.players){
      const zs=q.abil.zapaura;
      if(zs && !q.body.dead && dist2(e.x,e.y,q.body.x,q.body.y)<150*150){
        e.hp-=3*zs*dt;
        if(Math.random()<dt*5) spawnPart(e.x,e.y,rand(0,TAU),rand(20,70),0.2,'#8fd8ff',2);
        if(e.hp<=0){ killEnemy(e); zapped=true; break; }
      }
    }
    if(zapped) continue;
    let auraF=1;
    for(const q of G.players){
      if(!q.body.dead && q.stats.auraSlow && dist2(e.x,e.y,q.body.x,q.body.y)<190*190)
        auraF=Math.min(auraF,1-q.stats.auraSlow);
    }
    const sp = e.spd*mudF*auraF;
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
    } else if(ai==='courier'){
      /* sprints across the yard; catch it before it escapes */
      if(e.tx===undefined){ e.tx = e.x<ARENA_W/2 ? ARENA_W+90 : -90; e.ty=clamp(e.y+rand(-260,260),120,ARENA_H-120); }
      const ca2=Math.atan2(e.ty-e.y,e.tx-e.x);
      e.x+=Math.cos(ca2)*e.spd*dt; e.y+=Math.sin(ca2)*e.spd*dt;
      if(e.x<-70||e.x>ARENA_W+70){ e._fled=true; }
    } else if(ai==='algo'){
      bossClock(e,dt);
      updateAlgo(e,dt,a,d);
    } else if(ai==='subs'){
      bossClock(e,dt);
      updateSubs(e,dt,a,d);
    } else if(ai==='cloud'){
      bossClock(e,dt);
      updateCloud(e,dt,a,d);
    } else if(ai==='boss'){
      bossClock(e,dt);
      updateBoss(e,dt,a,d);
    }
    if(e.def.courier){ e.y=clamp(e.y,40,ARENA_H-40); }
    else { e.x=clamp(e.x,40,ARENA_W-40); e.y=clamp(e.y,40,ARENA_H-40); }
    if(!e.def.boss && !e.def.courier){
      [e.x,e.y]=resolveObst(e.x,e.y,e.def.r*0.8);
      const td=Math.hypot(e.x-TRAMP.x,e.y-TRAMP.y);
      if(td<TRAMP.r && e.trampCd<=0){
        e.trampCd=0.6; TRAMP.anim=1;
        const ba=td>1?Math.atan2(e.y-TRAMP.y,e.x-TRAMP.x):rand(0,TAU);
        e.kx+=Math.cos(ba)*620; e.ky+=Math.sin(ba)*620;
        sfx.spring();
      }
    }
    for(const q of G.players){
      const qb=q.body;
      if(qb.mowT>0 && !qb.dead && Math.hypot(e.x-qb.x,e.y-qb.y) < e.def.r+30 && (e._mow===undefined||e._mow<G.t)){
        e._mow=G.t+0.25; e._byMow=true;
        const prev=G.active; saveActive(); setActive(q);
        hitEnemy(e, 22, Math.atan2(e.y-qb.y,e.x-qb.x), 420, false);
        saveActive(); if(prev&&prev!==q) setActive(prev);
        break;
      }
    }
    if(tp && !P.dead && e.contactCd<=0 && d < e.def.r+16 && e.fuse===undefined){
      if(hurtPlayer(tp, e.def.dmg*dmgMul(G.wave)*(e.dmg2||1))){
        e.contactCd=1.0;
        e.kx-=Math.cos(a)*140; e.ky-=Math.sin(a)*140;
        if(e.leech && e.hp<e.maxhp){
          e.hp=Math.min(e.maxhp, e.hp+8);
          floatText(e.x,e.y-e.def.r-10,'+8','#9be06f');
        }
      }
    }
  }
  for(let i=G.enemies.length-1;i>=0;i--) if(G.enemies[i]._fled) G.enemies.splice(i,1);
  for(let i=G.ebullets.length-1;i>=0;i--){
    const b=G.ebullets[i];
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(b.life<=0||b.x<0||b.x>ARENA_W||b.y<0||b.y>ARENA_H){ G.ebullets.splice(i,1); continue; }
    let gone=false;
    for(const q of G.players){
      const qb=q.body;
      if(qb.dead) continue;
      if(qb.mowT>0 && dist2(b.x,b.y,qb.x,qb.y)<42*42){
        spawnPart(b.x,b.y,rand(0,TAU),rand(60,140),0.3,'#ffd166',2);
        G.ebullets.splice(i,1); gone=true; break;
      }
      if(dist2(b.x,b.y,qb.x,qb.y)<(b.r+14)*(b.r+14)){
        hurtPlayer(q,b.dmg); G.ebullets.splice(i,1); gone=true; break;
      }
    }
    if(gone) continue;
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
/* after 75 seconds every boss enrages: faster, harder hitting, done summoning.
   Prevents add-spam stalemates where weapons never reach the boss. */
function bossClock(e,dt){
  e.age=(e.age||0)+dt;
  if(e.age>75 && !e.enraged){
    e.enraged=true;
    e.spd*=1.6; e.dmg2=(e.dmg2||1)*1.5;
    floatText(e.x,e.y-e.def.r-20,'ENRAGED','#ff5a5f',true);
    banner('ENRAGED','FINISH IT OR IT FINISHES YOU');
    sfx.bossroar();
  }
}
function updateSubs(e,dt,a,d){
  // THE SUBSCRIPTION: lumbers at you, mails exploding invoices, cancels nothing
  e.x+=Math.cos(a)*e.spd*dt; e.y+=Math.sin(a)*e.spd*dt;
  e.billT-=dt; e.burstT-=dt;
  if(e.billT<=0 && !e.enraged && G.enemies.length<40){
    e.billT = e.hp<e.maxhp*0.5 ? 2.6 : 3.8;
    for(let s=0;s<2;s++) spawnEnemy('drone', e.x+rand(-30,30), e.y+rand(-30,30), true);
    floatText(e.x,e.y-e.def.r-14,'YOU HAVE BEEN BILLED','#ffd166');
    tone(620,0.12,'square',0.07,320);
    spawnPart(e.x,e.y,0,0,0.15,'flash',e.def.r*1.2);
  }
  if(e.burstT<=0){
    e.burstT=6.5; e.spiral+=0.7;
    for(let i=0;i<10;i++){
      const aa=e.spiral + i/10*TAU;
      G.ebullets.push({ x:e.x, y:e.y, vx:Math.cos(aa)*175, vy:Math.sin(aa)*175,
        dmg:9*dmgMul(G.wave), r:6, life:4.5, paper:true });
    }
    tone(180,0.25,'sawtooth',0.1,80); G.cam.shake=Math.min(12,G.cam.shake+4);
  }
  const f=document.getElementById('bossfill');
  if(f) f.style.width=(clamp(e.hp/e.maxhp,0,1)*100)+'%';
}
function updateCloud(e,dt,a,d){
  // THE CLOUD: keeps its distance, rains data, spins up swarm instances
  const want=380;
  if(d>want+60){ e.x+=Math.cos(a)*e.spd*dt; e.y+=Math.sin(a)*e.spd*dt; }
  else if(d<want-60){ e.x-=Math.cos(a)*e.spd*0.8*dt; e.y-=Math.sin(a)*e.spd*0.8*dt; }
  else { e.x+=Math.cos(a+Math.PI/2*e.orbDir)*e.spd*0.7*dt; e.y+=Math.sin(a+Math.PI/2*e.orbDir)*e.spd*0.7*dt; }
  e.fireT-=dt; e.addT-=dt;
  const enr=e.hp<e.maxhp*0.4;
  if(e.fireT<=0){
    e.fireT=enr?0.11:0.17; e.spiral+=enr?0.45:0.6;
    G.ebullets.push({ x:e.x, y:e.y, vx:Math.cos(e.spiral)*190, vy:Math.sin(e.spiral)*190,
      dmg:e.def.shot*dmgMul(G.wave), r:6, life:5 });
  }
  if(e.addT<=0 && !e.enraged && G.enemies.length<40){
    e.addT=6;
    for(let s=0;s<3;s++) spawnEnemy('swarm', e.x+rand(-26,26), e.y+rand(-26,26), true);
    floatText(e.x,e.y-e.def.r-14,'SPINNING UP INSTANCES','#8fd8ff');
    spawnPart(e.x,e.y,0,0,0.15,'flash',e.def.r*1.2);
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
  if(e.addT<=0 && !e.enraged && G.enemies.length<16){
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
      const gm=Math.min(...G.players.map(q=>q.stats.grillMul||1));
      G.burgerOut=true; G.grillT=26*gm;
      /* the grill DELIVERS: the burger lands near whoever needs it most,
         so nobody has to camp the corner of the map to heal */
      const tgt=[...G.players].filter(q=>!q.body.dead)
        .sort((a,b)=>a.hp/a.stats.maxHP - b.hp/b.stats.maxHP)[0];
      let bx=BURGER_SPOT.x, by=BURGER_SPOT.y;
      if(tgt){
        const a=rand(0,TAU);
        bx=clamp(tgt.body.x+Math.cos(a)*140, 60, ARENA_W-60);
        by=clamp(tgt.body.y+Math.sin(a)*140, 60, ARENA_H-60);
        [bx,by]=resolveObst(bx,by,12);
      }
      G.pickups.push({ x:bx, y:by, vx:0, vy:0, mag:false, t:0, kind:'burger', val:15, grill:true });
      toast(MAPKEY==='office' ? '🍔 Break room delivery, still hot' : '🍔 Grill delivery! Burger incoming');
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
  // gnome of war: trails its owner, staples the nearest machine
  for(const g of G.gnomes){
    const owner=(g.own && G.players.includes(g.own) && !g.own.body.dead)? g.own.body
      : (nearestPlayer(g.x,g.y)? nearestPlayer(g.x,g.y).body : P);
    const gd=Math.hypot(owner.x-g.x,owner.y-g.y);
    if(gd>90){ const ga=Math.atan2(owner.y-g.y,owner.x-g.x); g.x+=Math.cos(ga)*150*dt; g.y+=Math.sin(ga)*150*dt; }
    [g.x,g.y]=resolveObst(g.x,g.y,10);
    g.cd-=dt;
    if(g.cd<=0){
      const t=nearestEnemy(g.x,g.y,320);
      if(t){
        g.cd=0.55;
        const a=Math.atan2(t.y-g.y,t.x-g.x);
        G.bullets.push({ x:g.x, y:g.y, vx:Math.cos(a)*520, vy:Math.sin(a)*520, dmg:4,
          pierce:0, r:4, life:0.7, key:'stapler', aoe:0, knock:40, crit:false,
          boom:false, phase:0, spin:0, hitSet:{}, own:g.own });
        sfx.shoot(1.8);
      }
    }
  }
  // overtime pay: bolts trickle in while the wave runs (stacks across the couch)
  const otTotal=G.players.reduce((s,q)=>s+(q.abil.overtime||0),0);
  if(otTotal && G.sub==='play'){
    G.otT+=dt;
    if(G.otT>=3){
      G.otT-=3; G.mats+=otTotal; G.totalMats+=otTotal;
      floatText(P.x,P.y-54,'+'+otTotal+' 🔩 overtime','#ffd166');
      updateHUD();
    }
  }
  // sprinkler
  SPRINK.a += 0.75*dt;
  const jx=Math.cos(SPRINK.a), jy=Math.sin(SPRINK.a);
  for(let k=0;k<2;k++){
    const t=rand(0.15,1);
    spawnPart(SPRINK.x+jx*170*t, SPRINK.y+jy*170*t,
      SPRINK.a+rand(-0.25,0.25), rand(20,60), 0.35, MAPKEY==='office'?'#e8e4da':'#7fc7e8', 2);
  }
  for(const e of G.enemies){
    if(e.def.boss) continue;
    const ed=Math.hypot(e.x-SPRINK.x,e.y-SPRINK.y);
    if(ed<180 && ed>20){
      const ea=Math.atan2(e.y-SPRINK.y,e.x-SPRINK.x);
      if(Math.abs(angDiff(SPRINK.a,ea))<(G.yard.sprink>=2?0.3:0.15) && (e._spk===undefined||e._spk<G.t)){
        e._spk=G.t+0.35;
        hitEnemy(e, G.yard.sprink>=1?6:2, ea, 170, false);
      }
    }
  }
  // trampoline launches any neighbor who steps on it
  for(const q of G.players){
    const qb=q.body;
    if(qb.dead) continue;
    const td=Math.hypot(qb.x-TRAMP.x,qb.y-TRAMP.y);
    if(td<TRAMP.r && qb.trampCd<=0){
      qb.trampCd=0.6; TRAMP.anim=1;
      const ba=td>1?Math.atan2(qb.y-TRAMP.y,qb.x-TRAMP.x):rand(0,TAU);
      const boost=G.yard.tramp>=1?950:760;
      qb.bvx+=Math.cos(ba)*boost; qb.bvy+=Math.sin(ba)*boost;
      qb.iframe=Math.max(qb.iframe, G.yard.tramp>=1?0.6:0.25);
      if(G.yard.tramp>=2){
        for(const e of G.enemies){
          if(dist2(e.x,e.y,TRAMP.x,TRAMP.y)<200*200){
            const ka=Math.atan2(e.y-TRAMP.y,e.x-TRAMP.x);
            const kr=e.def.knockR!==undefined?e.def.knockR:1;
            e.kx+=Math.cos(ka)*460*kr; e.ky+=Math.sin(ka)*460*kr;
          }
        }
      }
      floatText(qb.x,qb.y-44,'BOING!','#6ea8ff',true);
      sfx.spring();
    }
  }
  TRAMP.anim=Math.max(0,TRAMP.anim-dt*3);
  // flamingos tip over
  for(const fl of FLAM){
    if(fl.up){
      let tipped=false;
      for(const q of G.players){
        if(!q.body.dead && dist2(fl.x,fl.y,q.body.x,q.body.y)<26*26){ tipped=true; break; }
      }
      if(!tipped) for(const e of G.enemies){
        if(dist2(fl.x,fl.y,e.x,e.y)<(e.def.r+14)*(e.def.r+14)){ tipped=true; break; }
      }
      if(tipped){ fl.up=false; sfx.tink(); }
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
        G.pickups.push({ x:w.x, y:w.y, vx:0, vy:0, mag:false, t:0, kind:'crate', val:Math.round((8+2*G.wave)*(1+G.stats.luck)*DF().loot) });
        G.cam.shake=Math.min(10,G.cam.shake+4);
        noiseHit(0.12,0.12,900);
      }
      else if(w.def) spawnEnemy(w.def, w.x, w.y);
    }
  }
}
function updatePickups(dt){
  for(let i=G.pickups.length-1;i>=0;i--){
    const p=G.pickups[i]; p.t+=dt;
    /* each pickup flies to whichever neighbor is closest */
    const tp=nearestPlayer(p.x,p.y);
    if(!tp){ p.x+=p.vx*dt; p.y+=p.vy*dt; continue; }
    const P=tp.body, pr=tp.stats.pickup;
    const d=Math.hypot(P.x-p.x,P.y-p.y);
    let magR = p.kind==='bolt'? pr : Math.max(60,pr*0.6);
    if(p.kind==='burger' && !p.mag && G.sub!=='vacuum' && tp.hp>tp.stats.maxHP-5) magR=26;
    if(p.mag||G.sub==='vacuum'||d<magR){
      const a=Math.atan2(P.y-p.y,P.x-p.x);
      const sp=Math.min(720, 260+p.t*900);
      p.x+=Math.cos(a)*sp*dt; p.y+=Math.sin(a)*sp*dt;
      if(d<24){
        G.pickups.splice(i,1);
        const prev=G.active; saveActive(); setActive(tp);
        if(p.kind==='bolt'){ G.mats++; G.totalMats++; tp.earned=(tp.earned||0)+1; if(G.contract&&G.contract.def.key==='bolts') G.contract.prog++; sfx.pickup(); }
        else if(p.kind==='burger'){
          if(G.contract&&G.contract.def.key==='burger') G.contract.prog++;
          const heal=Math.round((p.val+(G.yard.grill>=2?10:0))*G.stats.burgerMul);
          G.hp=Math.min(G.stats.maxHP, G.hp+heal);
          if(p.grill) G.burgerOut=false;
          floatText(P.x,P.y-44,'+'+heal+' 🍔','#9be06f',true);
          sfx.munch();
        }
        else if(p.kind==='crate'){
          G.mats+=p.val; G.totalMats+=p.val; tp.earned=(tp.earned||0)+p.val;
          floatText(P.x,P.y-44,'+'+p.val+' 🔩','#ffd166',true);
          for(let k=0;k<8;k++) spawnPart(p.x,p.y,rand(0,TAU),rand(60,200),0.4,'#c9a06a',3);
          sfx.buy();
        }
        saveActive(); if(prev&&prev!==tp) setActive(prev);
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
    if(G.courierT!==undefined && G.courierT>0){
      G.courierT-=dt;
      if(G.courierT<=0){
        G.courierT=undefined;
        const fromLeft=Math.random()<0.5;
        const e=spawnEnemy('courier', fromLeft?-40:ARENA_W+40, rand(300,ARENA_H-300));
        if(e){ e.x=clamp(e.x,-40,ARENA_W+40); }
        toast('💰 A BOLT COURIER is cutting through! Catch it!');
        sfx.elite();
      }
    }
    if(G.eliteQ.length && G.waveTime < G.eliteQ[0]){ G.eliteQ.shift(); queueElite(); }
    if(G.waveTime<=0){
      G.waveTime=0;
      const bk=bossFor(G.wave);
      if(bk) startBossPhase(bk);
      else endWaveCleanup();
    }
  } else if(G.sub==='vacuum'){
    G.subT+=dt;
    if(G.pickups.length===0 && G.subT>0.9){
      if(G.wave>=FINAL_WAVE && !G.endless){ showWin(); G.sub='done'; }
      else { G.mode='shop'; G.sub='shopping'; if(G.pendingLvls>0) showLevelUp(); else openShop(); }
    }
  }
}
const BOSS_LABELS={
  algo:{ label:'T H E   A L G O R I T H M', warn:'⚠ THE ALGORITHM HAS FINISHED BUFFERING ⚠' },
  subs:{ label:'T H E   S U B S C R I P T I O N', warn:'⚠ YOUR FREE TRIAL HAS ENDED ⚠' },
  cloud:{ label:'T H E   C L O U D', warn:'⚠ 100% CHANCE OF THE CLOUD ⚠' },
  boss:{ label:'A G I – P R I M E', warn:'⚠ AGI-PRIME IS ONLINE ⚠' },
};
function startBossPhase(kind){
  G.sub='boss';
  document.getElementById('bosslabel').textContent = BOSS_LABELS[kind].label;
  document.getElementById('bosswrap').style.display='block';
  document.getElementById('bossfill').style.width='100%';
  banner('OVERTIME', BOSS_LABELS[kind].warn);
  sfx.bossroar();
  const P=G.player;
  const a=Math.atan2(ARENA_H/2-P.y, ARENA_W/2-P.x);
  let bx=clamp(P.x+Math.cos(a)*420, 160, ARENA_W-160);
  let by=clamp(P.y+Math.sin(a)*420, 160, ARENA_H-160);
  addWarn(bx,by,1.4,'bossw',kind);
  updateHUD();
}
function settleContract(){
  const c=G.contract; if(!c) return;
  G.contract=null;
  const d=c.def;
  const ok = d.key==='flam' ? FLAM.every(f=>f.up)
           : d.key==='nodmg' ? !c.dmg
           : c.prog>=d.n;
  if(ok){
    const pay=Math.round((10+3*G.wave)*DF().loot);
    G.mats+=pay; G.totalMats+=pay; gainXP(8);
    toast('🧹 CHORE DONE: +'+pay+' bolts, +8 XP'); sfx.buy();
  } else {
    toast('Chore missed. The lawn judges you.');
  }
  updateHUD();
}
function endWaveCleanup(){
  settleContract();
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
  if(G.wave>=FINAL_WAVE && !G.endless){ banner('SYSTEM SHUTDOWN',''); }
  else {
    const bonus=10+G.wave; G.mats+=bonus; G.totalMats+=bonus;
    banner('BOSS SCRAPPED','+'+bonus+' BOLT BONUS');
  }
  G.cam.shake=24; sfx.boom();
}

/* ---------------- shop ---------------- */
function tierRoll(){
  const w=G.wave, lk=1+G.stats.luck;
  const t3 = (w>=6 ? Math.min(0.22, 0.04*(w-5)) : 0)*lk;
  const t2 = (w>=3 ? Math.min(0.42, 0.10+0.05*(w-3)) : (w>=2?0.08:0))*lk;
  const r=Math.random();
  if(r<t3) return 3; if(r<t3+t2) return 2; return 1;
}
function priceOf(kind,key,tier){
  if(kind==='w')
    return Math.max(1, Math.round(WEAPONS[key].price * TIER[tier].priceMul * (1+0.14*(G.wave-1)) * G.stats.priceMul));
  return Math.max(1, Math.round(ITEMS[key].price * (1+0.12*(G.wave-1)) * G.stats.priceMul));
}
function rarityRoll(){
  const w=G.wave, lk=1+G.stats.luck;
  const ww={
    1:RARITY[1].w,
    2:RARITY[2].w,
    3:RARITY[3].w*lk*(1+0.08*w),
    4:RARITY[4].w*lk*(1+0.10*w),
    5:(w>=5? RARITY[5].w*lk*(1+0.12*w) : 0),
  };
  let tot=0; for(const k in ww) tot+=ww[k];
  let r=Math.random()*tot;
  for(const k in ww){ r-=ww[k]; if(r<=0) return Number(k); }
  return 1;
}
/* every player has their own shelf, rolled with their own luck, class rules,
   and prices, so the whole couch shops simultaneously */
function shopOfferCount(){ return G.players.length>1 ? 3 : 4; }
/* an item is pointless for a champ when its ONLY stat is a class damage
   multiplier for a class they cannot equip */
function itemUsable(k){
  const st=ITEMS[k].stats||{};
  const keys=Object.keys(st);
  if(keys.length===1){
    const kk=keys[0];
    if(kk==='meleeMul' && !champCanUse('melee')) return false;
    if(kk==='rangedMul' && !champCanUse('ranged')) return false;
    if(kk==='blastMul' && !champCanUse('blast')) return false;
  }
  return true;
}
function rollOffersFor(pl){
  const prev=G.active; saveActive(); setActive(pl);
  /* locked offers survive rerolls and carry into the next wave's shop */
  const offers=(pl.offers||[]).filter(o=>o.locked&&!o.sold);
  const slotsFull=G.weapons.length>=MAX_SLOTS;
  for(let i=offers.length;i<shopOfferCount();i++){
    let isWeapon = Math.random()<0.42;
    const pref=(CHAMPS[G.champ]||{}).wpref;
    if(isWeapon && slotsFull){
      /* full garage: only offer weapons that can actually combine */
      const pairable=G.weapons.filter(w=>w.tier<3);
      if(pairable.length && Math.random()<0.6){
        const pw=pick(pairable);
        offers.push({ kind:'w', key:pw.key, tier:pw.tier, price:priceOf('w',pw.key,pw.tier), sold:false });
        continue;
      }
      isWeapon=false; /* nothing combinable: sell them an item instead */
    }
    if(isWeapon){
      const tier=tierRoll();
      const wpool=Object.keys(WEAPONS).filter(k=>champCanUse(WEAPONS[k].cls));
      const key=wpick(wpool.map(k=>[k, WEAPONS[k].cls===pref?3:1]));
      offers.push({ kind:'w', key, tier, price:priceOf('w',key,tier), sold:false });
    } else {
      const rar=rarityRoll();
      /* respect stack caps and skip items this champ cannot use at all */
      const open=k=> (G.itemCounts[k]||0) < RARITY_CAP[ITEMS[k].rar] && itemUsable(k);
      let pool=Object.keys(ITEMS).filter(k=> ITEMS[k].rar===rar && open(k));
      if(!pool.length) pool=Object.keys(ITEMS).filter(k=> ITEMS[k].rar<=2 && open(k));
      if(!pool.length) pool=Object.keys(ITEMS).filter(open);
      if(!pool.length) pool=Object.keys(ITEMS);
      const key=wpick(pool.map(k=>{
        const st=ITEMS[k].stats||{};
        return [k, (pref && st[pref+'Mul'])?3:1];
      }));
      let curse=null, price=priceOf('i',key,1);
      if(ITEMS[key].rar<5 && Math.random()<0.12){
        curse=pick([['maxHP',-6],['move',-12],['armor',-1],['dodge',-0.03],['luck',-0.08]]);
        price=Math.max(1,Math.round(price*0.6));
      }
      offers.push({ kind:'i', key, tier:ITEMS[key].rar, price, curse, sold:false });
    }
  }
  pl.offers=offers;
  saveActive(); if(prev) setActive(prev);
}
function openShop(){
  G.mode='shop'; G.shop.favorUsed=false; G.shop.favorPicks=null;
  document.getElementById('favorpick').classList.add('hidden');
  for(const pl of G.players){ pl.rerolls=0; pl.shopCur=0; rollOffersFor(pl); }
  saveActive(); setActive(G.players[0]);
  renderShop(); show('shop');
  if(Object.keys(YARD_UPGRADES).some(k=>{ const c=yardCost(k); return c!==null && G.mats>=c; }))
    toast('💡 The '+(MAPKEY==='office'?'office facilities':'yard')+' could use an upgrade (right panel)');
}
function canBuyFor(pl,o){
  const prev=G.active; saveActive(); setActive(pl);
  const r=canBuy(o);
  saveActive(); if(prev) setActive(prev);
  return r;
}
function sellWeapon(pl,i){
  if(pl.weapons.length<=1) return;
  const w=pl.weapons[i]; if(!w) return;
  const prev=G.active; saveActive(); setActive(pl);
  const val=Math.max(1,Math.round(priceOf('w',w.key,w.tier)*0.5));
  G.mats+=val; G.totalMats+=val;
  pl.weapons.splice(i,1);
  saveActive(); if(prev) setActive(prev);
  toast('Sold '+WEAPONS[w.key].name+' for 🔩'+val);
  sfx.buy(); renderShop(); renderSlots(); updateHUD();
}
function yardCost(key){
  const lvl=G.yard[key], u=YARD_UPGRADES[key];
  if(lvl>=u.costs.length) return null;
  return Math.max(1,Math.round(u.costs[lvl]*(1+0.10*(G.wave-1))*G.stats.priceMul));
}
function buyYard(key){
  const cost=yardCost(key);
  if(cost===null||G.mats<cost) return;
  G.mats-=cost; G.yard[key]++;
  const lvl=G.yard[key];
  if(key==='grill'&&lvl===1) G.stats.grillMul*=0.65;
  if(key==='mower'&&lvl===1) G.stats.ultNeed=Math.max(5,G.stats.ultNeed-5);
  if(key==='mower'&&lvl===2) G.stats.mowDur+=2;
  toast('🔧 '+yardName(key)+' installed');
  saveActive();
  sfx.buy(); renderShop(); updateHUD();
}
function rerollCostFor(pl){ return Math.max(1, Math.round((G.wave + (pl.rerolls||0)*2)*pl.stats.rerollMul)); }
function rerollFor(pl){
  const c=rerollCostFor(pl);
  if(G.mats<c) return;
  G.mats-=c; pl.rerolls=(pl.rerolls||0)+1;
  rollOffersFor(pl); renderShop(); sfx.click(); updateHUD();
}
function canBuy(o){
  if(o.sold || G.mats<o.price) return false;
  if(o.kind==='w'){
    if(!champCanUse(WEAPONS[o.key].cls)) return false;
    const slotsFull = G.weapons.length>=MAX_SLOTS;
    const hasPair = G.weapons.some(w=> w.key===o.key && w.tier===o.tier && o.tier<3);
    if(slotsFull && !hasPair) return false;
  }
  return true;
}
function buyOffer(pl,i){
  const o=pl.offers[i]; if(!o) return;
  const prev=G.active; saveActive(); setActive(pl);
  if(!canBuy(o)){ if(prev) setActive(prev); return; }
  G.mats-=o.price; o.sold=true; sfx.buy();
  if(o.kind==='w'){
    G.weapons.push(mkWeapon(o.key,o.tier));
    tryCombine(o.key,o.tier);
  } else {
    const it=ITEMS[o.key];
    applyItem(it);
    if(o.curse){
      G.stats[o.curse[0]]+=o.curse[1];
      G.hp=Math.max(1,Math.min(G.hp,G.stats.maxHP));
      floatText(G.player.x,G.player.y-50,'CURSED...','#ff5a5f',true);
    }
    G.itemCounts[o.key]=(G.itemCounts[o.key]||0)+1;
    if(it.rar===5) sfx.legendary();
  }
  saveActive(); if(prev) setActive(prev);
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
function applyItem(it){
  const st=G.stats;
  for(const k in (it.stats||{})){
    st[k]+=it.stats[k];
    if(k==='maxHP' && it.stats[k]>0) G.hp+=it.stats[k];
  }
  st.ultNeed=Math.max(5, st.ultNeed);
  st.dashCdMax=Math.max(0.6, st.dashCdMax);
  G.hp=Math.max(1, Math.min(G.hp, st.maxHP));
  if(it.rar===5) G.hasLegend=true;
  if(it.ability==='mortgage'){ G.mats+=70; st.priceMul+=0.1; }
  else if(it.ability==='gnome'){
    G.abil.gnome=(G.abil.gnome||0)+1;
    G.gnomes.push({ x:G.player.x+rand(-50,50), y:G.player.y+rand(-50,50), cd:0, own:G.active });
  }
  else if(it.ability){ G.abil[it.ability]=(G.abil[it.ability]||0)+1; }
}
const STAT_FMT={
  maxHP:v=>sg(v)+' Max HP', regen:v=>sg(v)+' Regen', dmg:v=>pc(v)+' Damage',
  atk:v=>pc(v)+' Atk Speed', move:v=>sg(v)+' Move', armor:v=>sg(v)+' Armor',
  pickup:v=>sg(v)+' Pickup', crit:v=>pc(v)+' Crit', critMul:v=>sg(v)+'x Crit Dmg',
  dodge:v=>pc(v)+' Dodge', luck:v=>pc(v)+' Luck', lifesteal:v=>pc(v)+' Lifesteal',
  meleeMul:v=>pc(v)+' Melee', rangedMul:v=>pc(v)+' Ranged', blastMul:v=>pc(v)+' Blast',
  rangeMul:v=>pc(v)+' Range', areaMul:v=>pc(v)+' Area', burgerMul:v=>pc(v)+' Burger Heal',
  thorns:v=>sg(v)+' Thorns', dashCdMax:v=>(v>0?'+':'')+v+'s Dash CD',
  ultNeed:v=>sg(v)+' Mower Kills', mowDur:v=>sg(v)+'s Mower Time',
  priceMul:v=>pc(v)+' Shop Prices', auraSlow:v=>pc(v)+' Slow Aura',
};
function sg(v){ return (v>0?'+':'')+v; }
function pc(v){ return (v>0?'+':'')+Math.round(v*100)+'%'; }
function fmtItemStats(d){
  return Object.entries(d.stats||{}).map(([k,v])=> STAT_FMT[k]? STAT_FMT[k](v) : k+' '+v).join(' · ');
}
function offerCard(pl,pi,o,i,small){
  let iconHTML,name,desc,tierHTML,cls;
  if(o.kind==='w'){ const d=WEAPONS[o.key], t=TIER[o.tier];
    iconHTML=`<img src="${ICONURL[o.key]}" alt="">`; name=d.name;
    desc=d.desc+`<br><span style="color:#ece7db">DMG ${Math.round(d.dmg*t.dmg)} · every ${(d.cd*t.cd).toFixed(2)}s</span>`;
    if(pl.weapons.length>=MAX_SLOTS && !pl.weapons.some(w=>w.key===o.key&&w.tier===o.tier&&o.tier<3))
      desc+='<br><span style="color:#e0a34d">Slots full. Needs a matching pair to combine.</span>';
    tierHTML=`<div class="ctier">${t.name} WEAPON</div>`; cls='t'+o.tier;
  } else { const d=ITEMS[o.key], r=RARITY[o.tier];
    iconHTML=d.icon; name=(o.curse?'Cursed ':'')+d.name;
    const stats=fmtItemStats(d);
    desc=(stats?`<span style="color:#ece7db">${stats}</span><br>`:'')+(d.note||'');
    if(o.curse){
      const cf=STAT_FMT[o.curse[0]];
      desc+=`<br><span style="color:#ff5a5f">CURSE: ${cf?cf(o.curse[1]):o.curse[0]+' '+o.curse[1]}</span>`;
    }
    const owned=pl.itemCounts[o.key]||0;
    const cap=RARITY_CAP[d.rar];
    tierHTML=`<div class="ctier" style="color:${o.curse?'#ff5a5f':r.color}">${o.curse?'CURSED '+r.name:r.name}</div>`
      +(goodForChamp(pl.champ,d)?'<div class="goodbadge">★ GOOD FOR YOU</div>':'')
      +(owned?`<div class="owned">OWNED ×${owned} of ${cap}</div>`:'');
    cls=(o.curse?'cursed ':'')+'r'+o.tier;
  }
  const div=document.createElement('div');
  div.className='card '+cls+(o.sold?' sold':'')+(small?' small':'')
    +(pl.pad!==null && pl.shopCur===i && !o.sold ? ' cur':'')
    +(o.locked?' locked':'');
  div.innerHTML=`<button class="lockbtn" title="Lock: keep this offer for later (X on a controller)">${o.locked?'🔒':'🔓'}</button>
    <div class="cicon">${iconHTML}</div><div class="cname">${name}</div>
    ${tierHTML}
    <div class="cdesc">${desc}</div>
    <button class="buybtn" ${canBuyFor(pl,o)?'':'disabled'}>${o.sold?'SOLD':'🔩 '+o.price}</button>`;
  div.querySelector('.buybtn').addEventListener('click',()=>buyOffer(pl,i));
  div.querySelector('.lockbtn').addEventListener('click',(ev)=>{
    ev.stopPropagation();
    o.locked=!o.locked; sfx.click(); renderShop();
  });
  return div;
}
function garageHTML(pl){
  return pl.weapons.map((w,i)=>`<span class="wrow"><img src="${ICONURL[w.key]}" alt=""><sup>${w.tier}</sup>`+
    (pl.weapons.length>1?`<button class="sellbtn" data-i="${i}">SELL 🔩${Math.max(1,Math.round(priceOf('w',w.key,w.tier)*0.5))}</button>`:'')+
    `</span>`).join(' ');
}
function renderShop(){
  document.getElementById('shopmats').textContent='🔩 '+G.mats;
  document.getElementById('gowave').textContent='START WAVE '+(G.wave+1)+' →';
  document.getElementById('buyfor').style.display='none';
  const box=document.getElementById('offers'); box.innerHTML='';
  const coop=G.players.length>1;
  box.className=coop?'coopshop':'';
  if(coop){
    /* one column per neighbor: everyone browses and buys at the same time.
       P1 clicks; pad players steer their column with dpad and buy with A. */
    G.players.forEach((pl,pi)=>{
      const col=document.createElement('div');
      col.className='shopcol';
      col.style.borderColor=PCOLORS[pi];
      const head=document.createElement('div');
      head.className='shophead2'; head.style.color=PCOLORS[pi];
      head.innerHTML=`<img src="${champPortrait(pl.champ)}" alt=""> P${pi+1} ${CHAMPS[pl.champ].name}`+
        `<span class="shopmini">HP ${Math.ceil(pl.hp)}/${pl.stats.maxHP} · 🔩${pl.earned||0} collected${pl.pad!==null?' · dpad + A':''}</span>`;
      col.appendChild(head);
      pl.offers.forEach((o,i)=> col.appendChild(offerCard(pl,pi,o,i,true)));
      const rb=document.createElement('button');
      rb.className='colreroll'+(pl.pad!==null && pl.shopCur===pl.offers.length?' cur':'');
      rb.textContent='Reroll (🔩 '+rerollCostFor(pl)+')';
      rb.disabled=G.mats<rerollCostFor(pl);
      rb.addEventListener('click',()=>rerollFor(pl));
      col.appendChild(rb);
      const gr=document.createElement('div');
      gr.className='colgarage';
      const inv=Object.entries(pl.itemCounts).map(([k,n])=>
        ITEMS[k]? `<span title="${ITEMS[k].name} ×${n}">${ITEMS[k].icon}${n>1?'×'+n:''}</span>`:'').join(' ');
      const cch=CHAMPS[pl.champ];
      const wnote=cch.wonly? cch.wonly.map(s=>s.toUpperCase()).join('+')+' ONLY' : cch.wpref? 'likes '+cch.wpref.toUpperCase() : 'any weapon';
      gr.innerHTML='<span class="glabel">GARAGE ('+wnote+')</span> '+garageHTML(pl)
        +(inv?'<br><span class="glabel">ITEMS</span> '+inv:'');
      gr.querySelectorAll('.sellbtn').forEach(b=>
        b.addEventListener('click',()=>sellWeapon(pl,Number(b.dataset.i))));
      col.appendChild(gr);
      box.appendChild(col);
    });
  } else {
    const pl=G.players[0];
    pl.offers.forEach((o,i)=> box.appendChild(offerCard(pl,0,o,i,false)));
  }
  const rb=document.getElementById('rerollbtn');
  rb.style.display=coop?'none':'';
  if(!coop){
    rb.textContent='Reroll (🔩 '+rerollCostFor(G.players[0])+')';
    rb.disabled = G.mats<rerollCostFor(G.players[0]);
  }
  const sp=document.getElementById('statpanel'), wpn=document.getElementById('weappanel');
  sp.style.display=coop?'none':'';
  wpn.style.display=coop?'none':'';
  if(!coop){
    sp.innerHTML=statsHTML(true);
    const pl=G.players[0];
    wpn.innerHTML=`<h3>GARAGE (${pl.weapons.length}/${MAX_SLOTS} slots)</h3>
      ${garageHTML(pl)}<br>Buy two of the same weapon + tier and they combine. Selling pays half.`;
    wpn.querySelectorAll('.sellbtn').forEach(b=>
      b.addEventListener('click',()=>sellWeapon(pl,Number(b.dataset.i))));
  }
  document.getElementById('yardpanel').innerHTML=
    `<h3>${MAPKEY==='office'?'FACILITIES':'YARD WORK'} (lasts the whole run)</h3>`+
    Object.entries(YARD_UPGRADES).map(([k,u])=>{
      const lvl=G.yard[k], cost=yardCost(k);
      const btn = cost===null ? '<span style="color:#9be06f;font-weight:bold">MAXED</span>'
        : `<button class="yardbtn" data-k="${k}" ${G.mats>=cost?'':'disabled'}>🔩 ${cost}</button>`;
      return `<div class="yrow">${u.icon} <span class="sv">${yardName(k)}</span> ${'▪'.repeat(lvl)}<br>`+
        `<span class="ydesc">${cost===null?'Fully upgraded':yardDescs(k)[lvl]}</span> ${btn}</div>`;
    }).join('');
  document.querySelectorAll('#yardpanel .yardbtn').forEach(b=>
    b.addEventListener('click',()=>buyYard(b.dataset.k)));
  const fb=document.getElementById('favorbtn');
  const favReady = G.wave >= (G.favorNextWave||0);
  fb.disabled = !!(G.shop.favorUsed||G.favorNext||!favReady);
  fb.textContent = G.favorNext ? '📞 '+CHAMPS[G.favorNext].name+' is coming'
    : !favReady ? '📞 Neighbors busy until wave '+G.favorNextWave
    : G.shop.favorUsed ? '📞 Nobody else is home' : '📞 CALL A NEIGHBOR (free)';
  const yp2=document.getElementById('yardpanel');
  yp2.classList.toggle('afford', Object.keys(YARD_UPGRADES).some(k=>{ const c=yardCost(k); return c!==null && G.mats>=c; }));
}
document.getElementById('rerollbtn').addEventListener('click',()=>rerollFor(G.players[0]));
document.getElementById('gowave').addEventListener('click',()=>{ sfx.click(); startWave(G.wave+1); });

