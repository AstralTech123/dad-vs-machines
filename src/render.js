/* DAD vs THE MACHINES: render (canvas, floor bake, art, HUD, master draw) */
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
  const un=G.stats.ultNeed||ULT_NEED;
  document.getElementById('ultfill').style.width=(P.ult/un*100)+'%';
  const uw=document.getElementById('ultwrap');
  const ut=document.getElementById('ulttext');
  if(P.mowT>0){ ut.textContent='MOWING'; uw.className=''; }
  else if(P.ult>=un){ ut.textContent='🚜 MOWER READY (E)'; uw.className='ready'; }
  else { ut.textContent='MOWER '+P.ult+'/'+un; uw.className=''; }
  document.getElementById('lvlchip').textContent='LV '+(G.level||1)+' · '+Math.floor(G.xp||0)+'/'+xpNeed(G.level||1)+' XP';
  const cl=document.getElementById('contractline');
  if(G.contract){
    const c=G.contract, d=c.def;
    const prog = d.key==='flam' ? (FLAM.every(f=>f.up)?'OK':'FAILED')
               : d.key==='nodmg' ? (c.dmg?'FAILED':'OK')
               : c.prog+'/'+d.n;
    cl.textContent='🧹 '+d.txt+' ('+prog+')';
  } else cl.textContent='';
}
function buildFavorPick(){
  const box=document.getElementById('favorpick');
  // the 3 neighbors roll ONCE per shop visit; reopening shows the same 3
  if(!G.shop.favorPicks){
    const others=Object.keys(CHAMPS).filter(k=>k!==G.champ);
    const picks=[];
    while(picks.length<3&&others.length){ picks.push(others.splice(Math.floor(Math.random()*others.length),1)[0]); }
    G.shop.favorPicks=picks;
  }
  box.innerHTML='<div id="favorhead">Whoever answers helps for the next wave only. One call per shop, and these three are who picked up.</div>';
  for(const k of G.shop.favorPicks){
    const el=document.createElement('div');
    el.className='favcard';
    el.innerHTML=`<img src="${champPortrait(k)}" alt=""><div class="fname">${CHAMPS[k].name}</div>`+
      `<div class="fdesc">${FAVORS[k].desc}</div>`;
    el.addEventListener('click',()=>{
      G.favorNext=k; G.shop.favorUsed=true; sfx.buy();
      box.classList.add('hidden'); renderShop();
    });
    box.appendChild(el);
  }
  box.classList.remove('hidden');
}
document.getElementById('favorbtn').addEventListener('click',()=>{
  if(G.shop.favorUsed||G.favorNext) return;
  sfx.click(); buildFavorPick();
});
function showLevelUp(){
  show('levelup');
  document.getElementById('lvlsub').textContent='PICK AN UPGRADE'+(G.pendingLvls>1?' ('+G.pendingLvls+' BANKED)':'');
  const box=document.getElementById('lvlchoices'); box.innerHTML='';
  const pool=[...LEVEL_UPS], picks=[];
  for(let i=0;i<4&&pool.length;i++) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  for(const u of picks){
    const el=document.createElement('div');
    el.className='lvlcard';
    el.innerHTML=`<div class="lt">${u.t}</div><div class="ld">${u.d}</div>`;
    el.addEventListener('click',()=>{
      u.a(G.stats); sfx.buy(); G.pendingLvls--; updateHUD();
      if(G.pendingLvls>0) showLevelUp();
      else { hide('levelup'); openShop(); }
    });
    box.appendChild(el);
  }
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
/* ---------------- shared stat sheet + guide ---------------- */
function statsHTML(){
  const st=G.stats;
  return `<h3>${(CHAMPS[G.champ]||CHAMPS.dad).name.toUpperCase()} · LEVEL ${G.level||1} · ${DF().name}</h3>
    Max HP <span class="sv">${st.maxHP}</span> · Regen <span class="sv">${st.regen}/4s</span> ·
    Damage <span class="sv">${Math.round(st.dmg*100)}%</span> · Atk Speed <span class="sv">${Math.round(st.atk*100)}%</span><br>
    Move <span class="sv">${Math.round(st.move)}</span> · Armor <span class="sv">${st.armor}</span> ·
    Crit <span class="sv">${Math.round(st.crit*100)}%</span> · Pickup <span class="sv">${Math.round(st.pickup)}</span><br>
    Melee <span class="sv">${Math.round(st.meleeMul*100)}%</span> · Ranged <span class="sv">${Math.round(st.rangedMul*100)}%</span> ·
    Blast <span class="sv">${Math.round(st.blastMul*100)}%</span> · Dodge <span class="sv">${Math.round(st.dodge*100)}%</span> ·
    Luck <span class="sv">${Math.round(st.luck*100)}%</span> · Lifesteal <span class="sv">${Math.round(st.lifesteal*100)}%</span>`;
}
function buildGuide(){
  const statRows=[
    ['Max HP','Your health. Reach 0 and the run ends.'],
    ['Regen','HP recovered every 4 seconds.'],
    ['Damage','Multiplies all damage you deal.'],
    ['Attack Speed','How fast every weapon fires.'],
    ['Move Speed','How fast you walk.'],
    ['Armor','Flat damage removed from every hit you take.'],
    ['Dodge','Chance to completely avoid a hit.'],
    ['Crit','Chance to deal double damage (triple for KevBoi).'],
    ['Melee / Ranged / Blast','Bonus damage for that weapon class.'],
    ['Range','How far your weapons reach.'],
    ['Luck','Better shop tiers, fatter crates and elite loot.'],
    ['Lifesteal','A cut of damage dealt comes back as HP.'],
    ['Pickup Range','How far bolts fly toward you.'],
  ].map(r=>`<tr><td class="sv">${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  const weapRows=Object.entries(WEAPONS).map(([k,w])=>
    `<tr><td><img src="${ICONURL[k]}" alt=""></td><td class="sv">${w.name}</td>`+
    `<td class="g${w.cls}">${w.cls.toUpperCase()}</td><td>${w.dmg} dmg / ${w.cd}s</td><td>${w.desc}</td></tr>`).join('');
  const champRows=Object.entries(CHAMPS).map(([k,c])=>
    `<tr><td><img src="${champPortrait(k)}" alt=""></td><td class="sv">${c.name}</td>`+
    `<td>${c.role}</td><td>${c.perkDesc}</td></tr>`).join('');
  document.getElementById('guidebody').innerHTML=`
    <h3>CONTROLS</h3>
    <p><span class="sv">WASD</span> or arrows to move · <span class="sv">SPACE</span> dash with i-frames ·
    <span class="sv">E</span> rides the mower once 25 kills charge it · <span class="sv">P</span> pause.<br>
    Touch: drag anywhere to move, two finger tap to dash, tap the mower bar to ride.<br>
    Weapons aim and fire themselves. Your job is positioning.</p>
    <h3>STATS</h3>
    <table>${statRows}</table>
    <h3>LEVELING</h3>
    <p>Machines grant XP, elites and bosses grant piles of it. Every level banks a free upgrade,
    chosen one of four at wave end before the shop opens.</p>
    <h3>WEAPONS</h3>
    <p>Six slots. Buy two of the same weapon at the same tier and they combine into the next tier.</p>
    <table>${weapRows}</table>
    <h3>THE YARD</h3>
    <p>The grill cooks healing burgers · the trampoline launches you across the map ·
    the kiddie pool slows everyone in it · the sprinkler damages machines · mud slows you ·
    flamingos tip over. The yard is on your side, use it.</p>
    <h3>THE MACHINES</h3>
    <p>Eleven types, from swarming Chatbots to shielded Firewall bots and healing IT Support.
    Golden elites roam with big loot, follow the edge arrows to find them. Airdrop crates land
    on a flare. Bosses arrive when the clock hits zero on waves 5 and 10.</p>
    <h3>THE NEIGHBORS</h3>
    <table>${champRows}</table>`;
}
document.getElementById('resumebtn').addEventListener('click',()=>{ sfx.click(); togglePause(); });
document.getElementById('restartbtn').addEventListener('click',()=>{ sfx.click(); hide('pause'); beginRun(); });
document.getElementById('quitbtn').addEventListener('click',()=>{ sfx.click(); hide('pause'); newGame(); show('menu'); });
document.getElementById('pguidebtn').addEventListener('click',()=>{ sfx.click(); buildGuide(); show('guide'); });
document.getElementById('mguidebtn').addEventListener('click',()=>{ initAudio(); sfx.click(); buildGuide(); show('guide'); });
document.getElementById('guideclose').addEventListener('click',()=>{ sfx.click(); hide('guide'); });
document.getElementById('deadmenubtn').addEventListener('click',()=>{ sfx.click(); hide('dead'); newGame(); show('menu'); });
document.getElementById('winmenubtn').addEventListener('click',()=>{ sfx.click(); hide('win'); newGame(); show('menu'); });

/* ---------------- champion select ---------------- */
let selChamp='dad', selDiff=2;
function buildDiffRow(){
  const row=document.getElementById('diffrow');
  row.innerHTML='';
  for(const k in DIFFS){
    const el=document.createElement('div');
    el.className='diffchip d'+k+(Number(k)===selDiff?' sel':'');
    el.textContent=DIFFS[k].name;
    el.addEventListener('click',()=>{ if(selDiff!==Number(k)){ selDiff=Number(k); sfx.click(); buildDiffRow(); } });
    row.appendChild(el);
  }
  const d=document.createElement('div');
  d.id='diffdesc'; d.textContent=DIFFS[selDiff].desc;
  row.appendChild(d);
}
const CHAMP_IMGS={};
/* portrait rendered by the exact same drawBody used in the yard, so the
   card always matches the in-game character */
function champPortrait(key){
  if(CHAMP_IMGS[key]) return CHAMP_IMGS[key];
  const c=document.createElement('canvas'); c.width=c.height=96;
  const g=c.getContext('2d');
  g.imageSmoothingEnabled=false;
  g.translate(48,46); g.scale(1.5,1.5);
  drawBody(g, Object.assign({},LOOKS.dad,LOOKS[key]||{}), 1, 0);
  return CHAMP_IMGS[key]=c.toDataURL();
}
function buildChampSelect(){
  const grid=document.getElementById('champgrid');
  grid.innerHTML='';
  for(const key in CHAMPS){
    const c=CHAMPS[key];
    const el=document.createElement('div');
    el.className='champcard'+(key===selChamp?' sel':'');
    el.innerHTML=`<img class="cpimg" src="${champPortrait(key)}" alt=""><div class="cpname">${c.name}</div>`+
      `<div class="cprole ${c.role.toLowerCase().replace(/[^a-z]/g,'')}">${c.role}</div>`;
    el.addEventListener('click',()=>{ if(selChamp!==key){ selChamp=key; sfx.click(); buildChampSelect(); } });
    grid.appendChild(el);
  }
  buildDiffRow();
  renderChampDetail();
}
function renderChampDetail(){
  const c=CHAMPS[selChamp], m=c.mods||{};
  const parts=[];
  const fmt=(v,suf)=>(v>0?'+':'')+v+(suf||'');
  if(m.maxHP) parts.push('Max HP '+fmt(m.maxHP));
  if(m.move) parts.push('Speed '+fmt(m.move));
  if(m.dmg) parts.push('Damage '+fmt(Math.round(m.dmg*100),'%'));
  if(m.atk) parts.push('Attack Speed '+fmt(Math.round(m.atk*100),'%'));
  if(m.crit) parts.push('Crit '+fmt(Math.round(m.crit*100),'%'));
  if(m.armor) parts.push('Armor '+fmt(m.armor));
  if(m.pickup) parts.push('Pickup '+fmt(m.pickup));
  document.getElementById('champdetail').innerHTML=
    `<div class="cblurb">${c.blurb}</div>`+
    `<div class="cstats">${parts.length?parts.join(' · '):'Standard issue neighbor stats'}</div>`+
    `<div class="cweap">Starts with: ${WEAPONS[c.weapon].name}</div>`+
    `<div class="cperk">${c.perkDesc}</div>`;
}
document.getElementById('startbtn').addEventListener('click',()=>{ initAudio(); sfx.click(); hide('menu'); buildChampSelect(); show('champsel'); });
function beginRun(){ newGame(); G.diff=selDiff; applyChamp(selChamp); startWave(1); }
document.getElementById('champstart').addEventListener('click',()=>{ sfx.click(); hide('champsel'); beginRun(); });
document.getElementById('retrybtn').addEventListener('click',()=>{ initAudio(); sfx.click(); hide('dead'); beginRun(); });
document.getElementById('winbtn').addEventListener('click',()=>{ initAudio(); sfx.click(); hide('win'); beginRun(); });

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

/* ---------------- dad + mower art ---------------- */
function drawBody(c,L,f,step){
  c.fillStyle='#e8c49a';
  c.fillRect(-8.5,12,6.5,10+step*2); c.fillRect(2,12,6.5,10-step*2);
  c.fillStyle='#f5f5f5';
  c.fillRect(-8.5,18+step*2,6.5,5); c.fillRect(2,18-step*2,6.5,5);
  c.fillStyle=L.sock;
  c.fillRect(-8.5,19+step*2,6.5,1.4); c.fillRect(2,19-step*2,6.5,1.4);
  function shoe(sx,sy){
    c.fillStyle='#f5f5f5'; roundedRectPath(c,sx,sy,13,6,2.5); c.fill();
    c.fillStyle='#c9cdd4'; c.fillRect(sx,sy+5,13,3);
    c.strokeStyle='#8b93a3'; c.lineWidth=1.6;
    c.beginPath(); c.moveTo(sx+3,sy+5); c.lineTo(sx+6.5,sy+1); c.lineTo(sx+10,sy+5); c.stroke();
  }
  shoe(-13,22+step*2); shoe(1,22-step*2);
  c.fillStyle=L.shorts; roundedRectPath(c,-11,3,22,11,2); c.fill();
  c.fillStyle=L.shorts2; c.fillRect(-11,7,5,6); c.fillRect(6,7,5,6);
  c.fillStyle=L.shirt; roundedRectPath(c,-11,-13,22,17,3); c.fill();
  c.fillStyle=L.shirt2; c.fillRect(-2,-13,4,9);
  c.fillStyle='#e8e4da';
  c.beginPath(); c.moveTo(-6,-13); c.lineTo(-1,-8); c.lineTo(-1,-13); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(6,-13); c.lineTo(1,-8); c.lineTo(1,-13); c.closePath(); c.fill();
  c.fillStyle='#6b4f2a'; c.fillRect(-11,2,22,3.5);
  c.fillStyle='#d4af37'; c.fillRect(-2,2,4,3.5);
  const sw=step*3;
  c.fillStyle=L.shirt; c.fillRect(-15,-10+sw*0.4,4.5,10); c.fillRect(10.5,-10-sw*0.4,4.5,10);
  c.fillStyle='#e8c49a'; c.fillRect(-15,0+sw*0.4,4.5,5); c.fillRect(10.5,0-sw*0.4,4.5,5);
  c.fillStyle='#e8c49a'; roundedRectPath(c,-8,-28,16,16,4); c.fill();
  c.fillStyle='#dcb387'; c.fillRect(f===1?-9:7,-22,2.5,4);
  c.fillStyle=L.hair; c.fillRect(-8,-26,3,8); c.fillRect(5,-26,3,8);
  c.fillStyle=L.top; c.beginPath(); c.ellipse(0,-27,7,3.2,0,Math.PI,0); c.fill();
  c.fillStyle='#2a2a2a';
  c.fillRect(f===1?-2.5:-5,-21,2.6,2.6); c.fillRect(f===1?3:0.5,-21,2.6,2.6);
  if(L.must){ c.fillStyle=L.must; c.fillRect(-4,-15.5,8,2.2); }
}
/* small always-on HP bar above the character so eyes stay on the action */
function drawPlayerHP(P){
  if(G.mode==='menu') return;
  const frac=clamp(G.hp/G.stats.maxHP,0,1);
  const w=34, y=P.y-(P.mowT>0?52:44);
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.fillRect(P.x-w/2-1, y-1, w+2, 6);
  ctx.fillStyle = frac<0.3?'#ff5a5f':frac<0.6?'#ffd166':'#9be06f';
  ctx.fillRect(P.x-w/2, y, w*frac, 4);
}
function drawDad(P){
  const x=P.x, y=P.y, f=P.face;
  const L=Object.assign({},LOOKS.dad,LOOKS[G.champ]||{});
  const bob=Math.sin(P.bob)*2, step=Math.sin(P.bob);
  const blink = P.iframe>0 && Math.sin(AT*30)>0;
  ctx.save(); ctx.translate(x,y); ctx.rotate(P.lean||0); ctx.translate(0,bob*0.35);
  if(blink) ctx.globalAlpha=0.45;
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0,30,17,5.5,0,0,TAU); ctx.fill();
  drawBody(ctx,L,f,step);
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
  const L=Object.assign({},LOOKS.dad,LOOKS[G.champ]||{});
  ctx.save(); ctx.translate(-8,-14+rumble*0.5);
  ctx.fillStyle=L.shirt; roundedRectPath(ctx,-9,-8,18,16,3); ctx.fill();
  ctx.fillStyle='#e8c49a'; roundedRectPath(ctx,-6.5,-22,13,14,4); ctx.fill();
  ctx.fillStyle=L.hair; ctx.fillRect(-6.5,-20,2.5,6); ctx.fillRect(4,-20,2.5,6);
  ctx.fillStyle=L.top; ctx.beginPath(); ctx.ellipse(0,-21,5.5,2.6,0,Math.PI,0); ctx.fill();
  ctx.fillStyle='#2a2a2a'; ctx.fillRect(0.5,-16,2.4,2.4); ctx.fillRect(4,-16,2.4,2.4);
  if(L.must){ ctx.fillStyle=L.must; ctx.fillRect(0,-11.5,7,2); }
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
    // fade the canopy when the player walks under it so he stays visible
    let ca=0.96;
    const P=G&&G.player;
    if(P){ const d=Math.hypot(P.x-t.x, P.y-(t.y-26)); ca=lerp(0.42,0.96,clamp((d-70)/60,0,1)); }
    ctx.globalAlpha=ca;
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
      drawPlayerHP(G.player);
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

