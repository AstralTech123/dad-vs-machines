/* DAD vs THE MACHINES: render (canvas, floor bake, art, HUD, master draw) */
/* ---------------- HUD / overlays ---------------- */
function updateHUD(){
  if(!G) return;
  const p0=G.players[0];
  const p0hp=(G.active===p0)? G.hp : p0.hp;
  const frac=clamp(p0hp/p0.stats.maxHP,0,1);
  const hf=document.getElementById('hpfill');
  hf.style.width=(frac*100)+'%';
  hf.className = frac<0.3 ? 'low' : '';
  document.getElementById('hptext').textContent=Math.ceil(p0hp)+' / '+p0.stats.maxHP;
  document.getElementById('armorchip').textContent=p0.stats.armor>0?('🛡 '+p0.stats.armor+' armor'):'';
  document.getElementById('wavenum').textContent=G.wave||1;
  const t=Math.max(0,Math.ceil(G.waveTime));
  document.getElementById('wavetimer').textContent=(G.sub==='boss')?'BOSS':('0:'+(t<10?'0':'')+t);
  document.getElementById('matcount').textContent='🔩 '+G.mats;
  document.getElementById('killcount').textContent=G.kills+' machines scrapped';
  const P=p0.body;
  const un=scaledUltNeed(p0.stats);
  document.getElementById('ultfill').style.width=(P.ult/un*100)+'%';
  const uw=document.getElementById('ultwrap');
  const ut=document.getElementById('ulttext');
  if(P.mowT>0){ ut.textContent='MOWING'; uw.className=''; }
  else if(P.ult>=un){ ut.textContent='🚜 MOWER READY (E)'; uw.className='ready'; }
  else { ut.textContent='MOWER '+Math.floor(P.ult/un*100)+'%'; uw.className=''; }
  /* co-op: P2-P4 each own a corner panel with their model, HP, and haul */
  for(let i=1;i<4;i++){
    const el=document.getElementById('pcorner'+(i+1));
    if(!el) continue;
    const pl=G.players[i];
    if(!pl || G.mode==='menu'){ el.style.display='none'; el._champ=null; continue; }
    el.style.display='block';
    if(el._champ!==pl.champ){
      el._champ=pl.champ;
      el.style.borderColor=PCOLORS[i];
      el.innerHTML=`<div class="pcrow"><img src="${champPortrait(pl.champ)}" alt="">`+
        `<div class="pcinfo"><div class="pcname" style="color:${PCOLORS[i]}"></div>`+
        `<div class="cotrack"><div class="cofill"></div></div>`+
        `<div class="pcbolts"></div></div></div>`;
    }
    const hp=(G.active===pl)?G.hp:pl.hp;
    const fr=clamp(hp/pl.stats.maxHP,0,1);
    el.querySelector('.pcname').textContent='P'+(i+1)+' '+CHAMPS[pl.champ].name+(pl.body.dead?' · DOWN':'');
    const cf=el.querySelector('.cofill');
    cf.style.width=(fr*100)+'%';
    cf.style.background=pl.body.dead?'#555':PCOLORS[i];
    el.querySelector('.pcbolts').textContent='🔩 '+(pl.earned||0)+' collected';
  }
  document.getElementById('lvlchip').textContent='LV '+(G.level||1)+' · '+Math.floor(G.xp||0)+'/'+xpNeed(G.level||1)+' XP';
  const cl=document.getElementById('contractline');
  if(G.contract){
    const c=G.contract, d=c.def;
    const prog = d.key==='nodmg' ? (c.dmg?'FAILED':'OK')
               : d.key==='hp75' ? (contractHPOk()?'OK':'LOW')
               : c.prog+'/'+c.n;
    cl.textContent='🧹 '+c.txt+' ('+prog+')';
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
      G.favorNext=k; G.shop.favorUsed=true;
      G.favorNextWave=G.wave+3; /* neighbors need a break: one call every 3 waves */
      sfx.buy();
      box.classList.add('hidden'); renderShop();
    });
    box.appendChild(el);
  }
  box.classList.remove('hidden');
}
document.getElementById('favorbtn').addEventListener('click',()=>{
  if(G.shop.favorUsed||G.favorNext||G.wave<(G.favorNextWave||0)) return;
  sfx.click(); buildFavorPick();
});
function showLevelUp(){
  show('levelup');
  document.getElementById('lvlsub').textContent=
    (G.players.length>1?'EVERYONE PICKS THEIR OWN UPGRADE':'PICK AN UPGRADE')+
    (G.pendingLvls>1?' ('+G.pendingLvls+' BANKED)':'');
  /* every player rolls their own four options and picks simultaneously:
     P1 clicks, controller players use dpad + A on their column */
  G.lvlState=G.players.map(()=>{
    const pool=[...LEVEL_UPS], picks=[];
    for(let i=0;i<4&&pool.length;i++) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    return { picks, cursor:0, done:false, chosen:-1 };
  });
  renderLevelUp();
}
function renderLevelUp(){
  const box=document.getElementById('lvlchoices');
  box.innerHTML='';
  box.className=G.players.length>1?'multi':'';
  G.players.forEach((pl,i)=>{
    const ls=G.lvlState[i];
    const col=document.createElement('div');
    col.className='lvlcol';
    if(G.players.length>1){
      col.style.borderColor=PCOLORS[i];
      col.innerHTML=`<div class="lvlhead" style="color:${PCOLORS[i]}">`+
        `<img src="${champPortrait(pl.champ)}" alt=""> P${i+1} ${CHAMPS[pl.champ].name}${ls.done?' ✔ READY':''}</div>`;
    }
    ls.picks.forEach((u,ci)=>{
      const el=document.createElement('div');
      el.className='lvlcard'
        +(pl.pad!==null && ci===ls.cursor && !ls.done ? ' cur':'')
        +(ls.done && ci===ls.chosen ? ' chosen':'')
        +(ls.done ? ' locked':'');
      el.innerHTML=`<div class="lt">${u.t}</div><div class="ld">${u.d}</div>`;
      if(!ls.done) el.addEventListener('click',()=>chooseLevelUp(i,ci));
      col.appendChild(el);
    });
    box.appendChild(col);
  });
}
function chooseLevelUp(i,ci){
  const ls=G.lvlState&&G.lvlState[i];
  if(!ls||ls.done) return;
  const pl=G.players[i], u=ls.picks[ci];
  const prev=G.active; saveActive(); setActive(pl);
  u.a(G.stats); saveActive();
  setActive(prev&&G.players.includes(prev)?prev:G.players[0]);
  ls.done=true; ls.chosen=ci;
  sfx.buy(); updateHUD();
  if(G.lvlState.every(s=>s.done)){
    G.pendingLvls--;
    const seq=(G.lvlSeq=(G.lvlSeq||0)+1);
    setTimeout(()=>{ if(G.lvlSeq===seq) advanceLevelUp(); },450);
    renderLevelUp();
  } else renderLevelUp();
}
/* moves past a fully-picked level-up screen; the timer calls this after a
   short beat, and the simulator calls it directly */
function advanceLevelUp(){
  if(!G.lvlState || !G.lvlState.every(s=>s.done)) return;
  G.lvlSeq=(G.lvlSeq||0)+1;
  if(G.pendingLvls>0) showLevelUp();
  else { G.lvlState=null; hide('levelup'); openShop(); }
}
function renderSlots(){
  const box=document.getElementById('slotwrap'); box.innerHTML='';
  /* two weapon boxes + one armor tally; the full sheet lives in the shop */
  for(const sk of ['w1','w2']){
    const d=document.createElement('div'); d.className='slot';
    const w=G.gear&&G.gear[sk];
    if(w){ const def=WEAPONS[w.key];
      d.innerHTML=gearIconHTML(w.key)+
      `<div class="pips" style="color:${w.emp?'#ffd166':RARITY[def.rar].color}">${w.emp?'⭐':'●'.repeat(def.rar)}</div>`; }
    box.appendChild(d);
  }
  const worn=GEAR_SLOTS.filter(([sk])=> sk!=='w1'&&sk!=='w2'&&G.gear&&G.gear[sk]).length;
  const d2=document.createElement('div'); d2.className='slot';
  d2.innerHTML=`<span style="font-size:18px">🎽</span><div class="pips" style="color:#8b93a3">${worn}/8</div>`;
  box.appendChild(d2);
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
    `Made it to <b>wave ${G.wave}</b> · scrapped <b>${G.kills}</b> machines · collected <b>${G.totalMats}</b> bolts<br>`+
    `SCORE: <b>${runScore()}</b> on ${DIFFS[G.diff||2].name}<br>The machines have added this run to their training data.`;
  prepScoreRow('dead');
  show('dead');
}
function showWin(){
  G.mode='win';
  document.getElementById('winstats').innerHTML=
    `AGI-PRIME unplugged on <b>wave ${FINAL_WAVE}</b> · <b>${G.kills}</b> machines scrapped · <b>${G.totalMats}</b> bolts collected<br>`+
    `SCORE: <b>${runScore()}</b> on ${DIFFS[G.diff||2].name}<br>He clocked out at 5:00 PM sharp and did not think about it again.`;
  prepScoreRow('win');
  show('win');
}
/* ---------------- the neighborhood record book (local, no sign-in) ---------------- */
function getScores(){ try{ return JSON.parse(localStorage.getItem('dvm_scores')||'[]'); }catch(e){ return []; } }
function recordScore(name){
  const s=getScores();
  const nm=(name||'DAD').trim().slice(0,16)||'DAD';
  const entry={ n:nm, score:runScore(), wave:G.wave, champ:CHAMPS[G.players[0].champ].name,
    diff:DIFFS[G.diff||2].name, coop:G.players.length, d:Date.now() };
  s.push(entry);
  s.sort((a,b)=>b.score-a.score);
  if(s.length>25) s.length=25;
  try{
    localStorage.setItem('dvm_scores',JSON.stringify(s));
    localStorage.setItem('dvm_name',nm);
  }catch(e){}
  /* also post to the shared neighborhood board; quiet if offline */
  submitGlobalScore({ name:entry.n, score:entry.score, wave:entry.wave,
    champ:entry.champ, diff:entry.diff, coop:entry.coop })
    .then(ok=>{ if(ok) toast('🌍 Posted to the neighborhood board'); });
}
function prepScoreRow(which){
  const inp=document.getElementById(which+'name');
  const btn=document.getElementById(which+'submit');
  if(!inp||!btn) return;
  inp.value=localStorage.getItem('dvm_name')||'';
  btn.disabled=false; btn.textContent='RECORD SCORE';
}
for(const which of ['dead','win','pause']){
  const btn=document.getElementById(which+'submit');
  if(btn) btn.addEventListener('click',function(){
    if(this.disabled) return;
    recordScore(document.getElementById(which+'name').value);
    this.disabled=true; this.textContent='✔ RECORDED';
    sfx.buy(); toast('🏆 Score recorded in the neighborhood record book');
  });
}
function scoreRows(list){
  return '<table>'+list.map((r,i)=>
    `<tr><td class="sv">#${i+1}</td><td class="sv">${String(r.n||r.name||'?').replace(/[<>&]/g,'')}</td>`+
    `<td>${r.score}</td><td>wave ${r.wave}</td><td>${r.champ}${(r.coop||1)>1?' +'+(r.coop-1):''}</td><td>${r.diff}</td></tr>`).join('')+'</table>';
}
function buildRecords(){
  const s=getScores();
  document.getElementById('recordsbody').innerHTML =
    '<h3>📱 THIS DEVICE</h3>'+(s.length===0
      ? '<p style="color:#a39c8a">No runs recorded yet on this device. Go make history.</p>'
      : scoreRows(s.slice(0,10)));
  const gb=document.getElementById('recordsglobal');
  gb.innerHTML='<h3>🌍 THE NEIGHBORHOOD</h3><p style="color:#a39c8a">Checking the board...</p>';
  fetchGlobalScores(10).then(rows=>{
    if(rows===null){
      gb.innerHTML='<h3>🌍 THE NEIGHBORHOOD</h3><p style="color:#a39c8a">The shared board is not reachable right now. Local records below still count.</p>';
    } else if(rows.length===0){
      gb.innerHTML='<h3>🌍 THE NEIGHBORHOOD</h3><p style="color:#a39c8a">Nobody has posted yet. First name on the board owns the block.</p>';
    } else {
      gb.innerHTML='<h3>🌍 THE NEIGHBORHOOD</h3>'+scoreRows(rows);
    }
  });
}
document.getElementById('mrecbtn').addEventListener('click',()=>{ sfx.click(); buildRecords(); show('records'); });
document.getElementById('recordsclose').addEventListener('click',()=>{ sfx.click(); hide('records'); });
/* tap any owned gear icon to see what it is and what it does */
function wireInvIcons(container){
  container.querySelectorAll('.invit').forEach(el=>{
    el.addEventListener('click',()=>{
      const d=defByKey(el.dataset.k); if(!d) return;
      const tag=d.cls ? (d.cls==='blast'?'EXPLOSIVE':d.cls.toUpperCase())+' WEAPON' : SLOT_LABEL[slotsFor(d)[0]];
      const body=d.cls
        ? `DMG ${Math.round(d.dmg)} every ${d.cd.toFixed(2)}s · ${d.desc||''}`
        : `${fmtItemStats(d)}${d.note?' · '+d.note:''}`;
      toast((d.icon||'🔧')+' '+d.name+' ['+RARITY[d.rar].name+' '+tag+']: '+body);
      sfx.click();
    });
  });
}
/* ---------------- character sheet: tap your dad, see your build ----------------
   opens from the shop. left column head-to-toe, right column jewelry, weapons
   at the bottom of each. tap any slot or backpack piece for the full story. */
const CS={ pl:null, sel:null };
const CS_LEFT=[['head','HEAD'],['chest','CHEST'],['legs','LEGS'],['feet','FEET'],['w1','WEAPON 1']];
const CS_RIGHT=[['neck','NECK'],['ring1','RING 1'],['ring2','RING 2'],['trinket','TRINKET'],['w2','WEAPON 2']];
function openCharSheet(pl){ CS.pl=pl; CS.sel=null; renderCharSheet(); show('charsheet'); sfx.click(); }
function closeCharSheet(){ hide('charsheet'); CS.pl=null; CS.sel=null; }
document.getElementById('csclose').addEventListener('click',()=>{ sfx.click(); closeCharSheet(); });
function gearTypeTag(d){ return d.cls ? (d.cls==='blast'?'EXPLOSIVE':d.cls.toUpperCase())+' WEAPON' : SLOT_LABEL[slotsFor(d)[0]]; }
function csStatLines(d,emp){
  const m=emp?EMP_STATMUL:1;
  return Object.entries(d.stats||{}).map(([k,v])=>{
    const vv=Math.round(v*m*100)/100;
    return STAT_FMT[k]? STAT_FMT[k](vv) : k+' '+vv;
  });
}
function csSlotDiv(sk,label){
  const pl=CS.pl, g=pl.gear[sk];
  const div=document.createElement('div');
  div.className='csslot'+(g?'':' gempty')+(CS.sel&&CS.sel.loc==='slot'&&CS.sel.ref===sk?' sel':'');
  if(g){
    const d=gearDef(g);
    div.style.borderColor=g.emp?'#ffd166':RARITY[d.rar].color;
    div.innerHTML=`<span class="ic">${ICONURL[g.key]?`<img src="${ICONURL[g.key]}" alt="">`:(d.icon||'❔')}</span>`+
      `<span><span class="lb">${label}${g.emp?' ⭐':''}</span><br><span class="nm">${d.name}</span></span>`;
  } else {
    div.innerHTML=`<span class="ic" style="opacity:.5">·</span><span class="lb">${label}</span>`;
  }
  div.addEventListener('click',()=>{ CS.sel={loc:'slot',ref:sk}; renderCharSheet(); sfx.click(); });
  return div;
}
function renderCharSheet(){
  const pl=CS.pl; if(!pl) return;
  const c=CHAMPS[pl.champ]||CHAMPS.dad;
  document.getElementById('csportrait').src=champPortrait(pl.champ);
  document.getElementById('csname').textContent=c.name.toUpperCase();
  document.getElementById('csrole').textContent=c.role+(c.wpref?' · LIKES '+(c.wpref==='blast'?'EXPLOSIVE':c.wpref.toUpperCase())+' WEAPONS':'');
  const wants=(ROLE_STATS[c.role]||[]).map(k=>STAT_NAMES[k]||k);
  if(c.wpref) wants.unshift(STAT_NAMES[c.wpref+'Mul']);
  document.getElementById('cswants').textContent='STACK THESE: '+[...new Set(wants)].join(' · ');
  const L=document.getElementById('csleft'); L.innerHTML='';
  for(const [sk,lb] of CS_LEFT) L.appendChild(csSlotDiv(sk,lb));
  const R=document.getElementById('csright'); R.innerHTML='';
  for(const [sk,lb] of CS_RIGHT) R.appendChild(csSlotDiv(sk,lb));
  document.getElementById('csfigure').innerHTML=`<img src="${champPortrait(pl.champ)}" alt="">`;
  document.getElementById('cspackn').textContent='('+pl.pack.length+'/'+pl.packMax+')';
  const PK=document.getElementById('cspack'); PK.innerHTML='';
  pl.pack.forEach((g,i)=>{
    const d=gearDef(g);
    const el=document.createElement('div');
    el.className='cspk'+(CS.sel&&CS.sel.loc==='pack'&&CS.sel.ref===i?' sel':'');
    el.style.borderColor=g.emp?'#ffd166':RARITY[d.rar].color;
    el.innerHTML=(ICONURL[g.key]?`<img src="${ICONURL[g.key]}" alt="">`:(d.icon||'❔'))+(g.emp?'<span class="st">⭐</span>':'');
    el.addEventListener('click',()=>{ CS.sel={loc:'pack',ref:i}; renderCharSheet(); sfx.click(); });
    PK.appendChild(el);
  });
  for(let i=pl.pack.length;i<pl.packMax;i++){
    const el=document.createElement('div'); el.className='cspk gempty'; PK.appendChild(el);
  }
  renderCsDetail();
}
function renderCsDetail(){
  const pl=CS.pl, box=document.getElementById('csdetail');
  if(!CS.sel){ box.innerHTML='<span style="color:#7c8272">Tap a slot or a backpack piece to inspect it. A gold border means EMPOWERED.</span>'; return; }
  const {loc,ref}=CS.sel;
  const g = loc==='slot' ? pl.gear[ref] : pl.pack[ref];
  if(!g){
    box.innerHTML=`<span style="color:#7c8272">Empty ${SLOT_LABEL[ref]||''} slot. Every shop card is tagged with the slot it fills.</span>`;
    return;
  }
  const d=gearDef(g), r=RARITY[d.rar];
  const lines=csStatLines(d,g.emp).join(' · ');
  const weapLine=d.cls?`DMG ${Math.round(d.dmg*(g.emp?EMP_DMG:1))} · every ${(d.cd*(g.emp?EMP_CD:1)).toFixed(2)}s${d.aoe?' · blast radius '+Math.round(d.aoe):''}${d.pierce?' · pierces '+(d.pierce>10?'everything':d.pierce):''}`:'';
  const curse=g.curse?`<br><span style="color:#ff5a5f">CURSE: ${STAT_FMT[g.curse[0]]?STAT_FMT[g.curse[0]](g.curse[1]):g.curse[0]+' '+g.curse[1]}</span>`:'';
  const copies=g.emp?'⭐ EMPOWERED':`copies ${g.copies}/${EMPOWER_NEED[d.rar]} to empower`;
  const good=goodForChamp(pl.champ,d)?' · <span style="color:#9be06f">★ good for '+(CHAMPS[pl.champ].name)+'</span>':'';
  let setHTML='';
  if(d.set){
    const S=SETS[d.set], worn=setWornCount(pl,d.set);
    const bl=Object.entries(S.bonuses).map(([n,b])=>
      `<span style="color:${worn>=Number(n)?'#9be06f':'#7c8272'}">(${n}) ${b.desc}${worn>=Number(n)?' ✔':''}</span>`).join(' · ');
    setHTML=`<br><span style="color:${S.color}">◆ ${S.name} · ${worn} worn</span><br>${bl}`;
  }
  box.innerHTML=`<span class="dname">${d.icon||''} ${d.name}</span> `+
    `<span class="dtag" style="color:${r.color}">${r.name} · ${gearTypeTag(d)}</span><br>`+
    (weapLine?`<span style="color:#ece7db">${weapLine}</span><br>`:'')+
    (lines?`<span style="color:#ece7db">${lines}</span><br>`:'')+
    `<span>${d.note||d.desc||''}</span>${curse}<br>`+
    `<span style="color:#a39c8a">${copies}${good}</span>${setHTML}`+
    `<div class="dbtns"></div>`;
  const btns=box.querySelector('.dbtns');
  const mkB=(txt,fn)=>{ const b=document.createElement('button'); b.textContent=txt; b.addEventListener('click',fn); btns.appendChild(b); };
  if(loc==='slot') mkB('⇣ TO BACKPACK',()=>{ uiUnequip(pl,ref); CS.sel=null; renderCharSheet(); });
  else mkB('⇡ EQUIP',()=>{ uiEquipFromPack(pl,ref); CS.sel=null; renderCharSheet(); });
  mkB('SELL 🔩'+sellValue(g),()=>{ sellGear(pl,loc==='slot'?'slot':'pack',ref); CS.sel=null; renderCharSheet(); });
}
/* ---------------- shared stat sheet + guide ---------------- */
function statsHTML(full){
  const st=G.stats;
  let extra='';
  if(full){
    const rows=[];
    const c=CHAMPS[G.champ];
    if(c){
      rows.push('🎯 '+(c.wonly
        ? 'Uses '+c.wonly.map(s=>s.toUpperCase()).join(' + ')+' weapons ONLY. Other class damage stats do nothing for you.'
        : c.wpref ? 'Prefers '+c.wpref.toUpperCase()+' weapons (bonus class damage).' : 'Uses any weapon.'));
      const wants=(ROLE_STATS[c.role]||[]).map(k=>STAT_NAMES[k]||k);
      if(c.wpref) wants.unshift(STAT_NAMES[c.wpref+'Mul']);
      rows.push('🛒 Shop for: '+[...new Set(wants)].join(', ')+'. Cards marked ★ GOOD FOR YOU fit your build.');
    }
    if(c&&c.perk) rows.push('★ '+c.perkDesc);
    rows.push('🚜 Mower ultimate: charges over '+scaledUltNeed(st)+' seconds ('+Math.floor(G.player.ult/scaledUltNeed(st)*100)+'% now). Press E or tap the bar when full.');
    rows.push('🔩 Bolts collected this run: '+(G.active&&G.active.earned||0)+' (the wallet is shared, this is your contribution)');
    const worn=GEAR_SLOTS.map(([sk])=>G.gear&&G.gear[sk]).filter(Boolean);
    for(const g of worn){ const d=gearDef(g); if(d.ability) rows.push(d.icon+' '+d.name+': '+d.note); }
    for(const k in G.yard){ if(G.yard[k]>0) rows.push(YARD_UPGRADES[k].icon+' '+yardName(k)+' Lv'+G.yard[k]); }
    const inv=[...worn, ...((G.pack)||[])].map(g=>{
      const d=gearDef(g);
      return `<span class="invit" data-k="${g.key}" title="${d.name}">${d.icon||gearIconHTML(g.key)}${g.emp?'⭐':''}${g.copies>1?'×'+g.copies:''}</span>`;
    }).join(' ');
    extra='<br><span class="sv">ABILITIES</span><br>'+rows.join('<br>')+
      (inv?'<br><span class="sv">GEAR</span> (tap a piece to see what it does)<br>'+inv:'');
  }
  return `<h3>${(CHAMPS[G.champ]||CHAMPS.dad).name.toUpperCase()} · LEVEL ${G.level||1} · ${DF().name}</h3>
    Max HP <span class="sv">${st.maxHP}</span> · Regen <span class="sv">${st.regen}/4s</span> ·
    Damage <span class="sv">${Math.round(st.dmg*100)}%</span> · Atk Speed <span class="sv">${Math.round(st.atk*100)}%</span><br>
    Move <span class="sv">${Math.round(st.move)}</span> · Armor <span class="sv">${st.armor}</span> ·
    Crit <span class="sv">${Math.round(st.crit*100)}%</span> · Pickup <span class="sv">${Math.round(st.pickup)}</span><br>
    Melee <span class="sv">${Math.round(st.meleeMul*100)}%</span> · Ranged <span class="sv">${Math.round(st.rangedMul*100)}%</span> ·
    Blast <span class="sv">${Math.round(st.blastMul*100)}%</span> · Dodge <span class="sv">${Math.round(st.dodge*100)}%</span> ·
    Luck <span class="sv">${Math.round(st.luck*100)}%</span> · Lifesteal <span class="sv">${Math.round(st.lifesteal*100)}%</span>`+extra;
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
    `<tr><td>${gearIconHTML(k)}</td><td class="sv" style="color:${RARITY[w.rar].color}">${w.name}</td>`+
    `<td class="g${w.cls}">${w.cls==='blast'?'EXPLOSIVE':w.cls.toUpperCase()}</td><td>${w.dmg} dmg / ${w.cd}s</td><td>${w.desc}</td></tr>`).join('');
  const champRows=Object.entries(CHAMPS).map(([k,c])=>
    `<tr><td><img src="${champPortrait(k)}" alt=""></td><td class="sv">${c.name}</td>`+
    `<td>${c.role}</td><td>${c.perkDesc}</td></tr>`).join('');
  document.getElementById('guidebody').innerHTML=`
    <h3>CONTROLS</h3>
    <p><span class="sv">WASD</span> or arrows to move · <span class="sv">SPACE</span> dash with i-frames ·
    <span class="sv">E</span> rides the mower once its bar charges (about 45 seconds, upgrades speed it up) · <span class="sv">P</span> pause.<br>
    Touch: drag anywhere to move, two finger tap to dash, tap the mower bar to ride.<br>
    Controller: left stick moves, <span class="sv">A</span> dashes, <span class="sv">B</span> or <span class="sv">X</span> rides the mower, <span class="sv">Start</span> pauses. Menus use the pointer.<br>
    Couch co-op: up to 4 neighbors. Press <span class="sv">A</span> on a controller at champ select to join, dpad picks your champ.
    Bolts are shared, level-ups boost everyone, downed neighbors revive if you stand with them.
    In the shop, pick who you are BUYING FOR to gear each player.<br>
    Weapons aim and fire themselves. Your job is positioning.</p>
    <h3>STATS</h3>
    <table>${statRows}</table>
    <h3>LEVELING</h3>
    <p>Machines grant XP, elites and bosses grant piles of it. Every level banks a free upgrade,
    chosen one of four at wave end before the shop opens.</p>
    <h3>GEAR</h3>
    <p>Ten equipment slots: two WEAPONS, HEAD, CHEST, LEGS, FEET, NECK, two RINGS, and a TRINKET.
    Every piece has a rarity: <span style="color:#8b93a3">COMMON</span>,
    <span style="color:#9be06f">UNCOMMON</span>, <span style="color:#6aa8f0">RARE</span>,
    <span style="color:#c48df0">EPIC</span>, <span style="color:#ffd166">LEGENDARY</span>.
    Buying copies of a piece you own EMPOWERS it (6 copies for common, 5 uncommon, 4 rare,
    3 epic, 2 legendary): bigger stats, stronger effects. Spare gear waits in your 12-slot
    backpack, swap freely between waves. Legendaries appear from wave 5. Luck improves your
    odds at everything. Watch for <span style="color:#ff5a5f">CURSED</span> pieces: 40% off,
    but the discount costs you something real while worn.<br>
    The shop guarantees ONE piece each visit that fits your champ (the ★ card). The rest is
    honest loot: sometimes treasure, sometimes garbage for your build. Marked ◆ pieces belong
    to TIER SETS: wear 2 or more together for set bonuses, topped by Thunder Dad's lightning
    and The Patriarch's Vestments.</p>
    <h3>WEAPONS</h3>
    <p>Two weapon slots. Weapons decide what you swing or shoot; your champ's class bonus
    decides how hard. MELEE, RANGED, or EXPLOSIVE, always printed on the card.</p>
    <table>${weapRows}</table>
    <h3>THE YARD</h3>
    <p>The grill cooks healing burgers and DELIVERS them to whoever is hurting most, follow the green arrow ·
    the trampoline launches you across the map ·
    the kiddie pool slows everyone in it · the sprinkler damages machines · mud slows you ·
    flamingos tip over. The yard is on your side, use it.</p>
    <h3>THE MACHINES</h3>
    <p>Thirteen types, from swarming Chatbots to charging E-Scooters, artillery Thermostats,
    tanky Smart Fridges, shielded Firewall bots, and healing IT Support.
    Elites arrive more often the deeper the run and the meaner the difficulty.
    Golden elites roam with big loot and often drop a mystery gear box, follow the edge arrows
    to find them. Bosses always drop RARE or better gear. Airdrop crates land on a flare. From wave 6, machines can spawn with traits: TURBO, ARMORED, VOLATILE, GIANT,
    LEECH. They glow, they are labeled, and they pay 50% extra loot and XP. Bosses arrive when
    the clock hits zero on waves 5, 10, 15, and 20, and beat wave 20 to unlock the endless shift.</p>
    <h3>THE NEIGHBORS</h3>
    <table>${champRows}</table>`;
}
document.getElementById('resumebtn').addEventListener('click',()=>{ sfx.click(); togglePause(); });
document.getElementById('restartbtn').addEventListener('click',()=>{ sfx.click(); hide('pause'); beginRun(); });
document.getElementById('quitbtn').addEventListener('click',()=>{ sfx.click(); hide('pause'); LOBBY.length=0; newGame(); show('menu'); });
document.getElementById('pguidebtn').addEventListener('click',()=>{ sfx.click(); buildGuide(); show('guide'); });
document.getElementById('mguidebtn').addEventListener('click',()=>{ initAudio(); sfx.click(); buildGuide(); show('guide'); });
document.getElementById('guideclose').addEventListener('click',()=>{ sfx.click(); hide('guide'); });
/* fullscreen: one toggle, reachable on every screen, always exitable.
   iPhone Safari has no fullscreen API, so it gets a proper explainer. */
document.getElementById('fsbtn').addEventListener('click',()=>{
  sfx.click();
  if(navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches){
    toast('Already fullscreen. Nice.');
    return;
  }
  if(document.fullscreenElement){
    if(document.exitFullscreen) document.exitFullscreen();
  } else {
    const d=document.documentElement;
    if(d.requestFullscreen){
      d.requestFullscreen().catch(()=>show('fshelp'));
    } else {
      show('fshelp');
    }
  }
});
document.getElementById('fshelpclose').addEventListener('click',()=>{ sfx.click(); hide('fshelp'); });
document.addEventListener('fullscreenchange',()=>{
  document.getElementById('fsbtn').classList.toggle('fson', !!document.fullscreenElement);
});
function markBindBtns(){
  document.getElementById('bindA').className='bigbtn slim'+(BINDS.dash===' '?'':' alt');
  document.getElementById('bindB').className='bigbtn slim'+(BINDS.dash==='shift'?'':' alt');
}
document.getElementById('mctrlbtn').addEventListener('click',()=>{ sfx.click(); markBindBtns(); show('ctrlpanel'); });
document.getElementById('ctrlclose').addEventListener('click',()=>{ sfx.click(); hide('ctrlpanel'); });
document.getElementById('bindA').addEventListener('click',()=>{
  setBinds({ dash:' ', mow:'e', name:'SPACE dash · E mower' }); sfx.click(); markBindBtns();
});
document.getElementById('bindB').addEventListener('click',()=>{
  setBinds({ dash:'shift', mow:'q', name:'SHIFT dash · Q mower' }); sfx.click(); markBindBtns();
});
document.getElementById('deadmenubtn').addEventListener('click',()=>{ sfx.click(); hide('dead'); LOBBY.length=0; newGame(); show('menu'); });
document.getElementById('winmenubtn').addEventListener('click',()=>{ sfx.click(); hide('win'); LOBBY.length=0; newGame(); show('menu'); });
document.getElementById('endlessbtn').addEventListener('click',()=>{
  initAudio(); sfx.click(); hide('win');
  G.endless=true;
  banner('ENDLESS SHIFT','THE MACHINES DO NOT CLOCK OUT');
  startWave(G.wave+1);
});
function updateSoundBtns(){
  for(const id of ['musicbtn','mmusicbtn']){
    const el=document.getElementById(id); if(el) el.textContent='MUSIC: '+(musicOn?'ON':'OFF');
  }
  for(const id of ['sfxbtn','msfxbtn']){
    const el=document.getElementById(id); if(el) el.textContent='SFX: '+(sfxOn?'ON':'OFF');
  }
}
for(const id of ['musicbtn','mmusicbtn']){
  document.getElementById(id).addEventListener('click',()=>{
    initAudio(); toggleMusic(); sfx.click(); updateSoundBtns();
  });
}
for(const id of ['sfxbtn','msfxbtn']){
  document.getElementById(id).addEventListener('click',()=>{
    initAudio(); toggleSfx(); updateSoundBtns(); sfx.click();
  });
}

/* ---------------- champion select ---------------- */
let selChamp='dad', selDiff=2, selMap='yard';
function buildMapRow(){
  const row=document.getElementById('maprow');
  row.innerHTML='';
  for(const k in MAPS){
    const el=document.createElement('div');
    el.className='diffchip'+(k===selMap?' sel':'');
    el.textContent='🗺 '+MAPS[k].name;
    el.addEventListener('click',()=>{ if(selMap!==k){ selMap=k; sfx.click(); buildMapRow(); } });
    row.appendChild(el);
  }
  const d=document.createElement('div');
  d.id='mapdesc'; d.className='diffdesc'; d.style.width='100%'; d.style.textAlign='center';
  d.style.fontSize='11.5px'; d.style.color='#a39c8a'; d.style.marginTop='2px';
  d.textContent=MAPS[selMap].desc;
  row.appendChild(d);
}
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
    el.dataset.key=key;
    el.innerHTML=`<img class="cpimg" src="${champPortrait(key)}" alt=""><div class="cpname">${c.name}</div>`+
      `<div class="cprole ${c.role.toLowerCase().replace(/[^a-z]/g,'')}">${c.role}</div>`;
    el.addEventListener('click',()=>{ if(selChamp!==key){ selChamp=key; sfx.click(); buildChampSelect(); } });
    grid.appendChild(el);
  }
  buildMapRow();
  buildDiffRow();
  renderLobby();
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
  const wline = c.wonly ? c.wonly.map(x=>x.toUpperCase()).join(' + ')+' WEAPONS ONLY (+35% class damage)'
    : c.wpref ? 'Prefers '+c.wpref.toUpperCase()+' weapons (+20% class damage)'
    : 'Uses any weapon';
  document.getElementById('champdetail').innerHTML=
    `<div class="cblurb">${c.blurb}</div>`+
    `<div class="cstats">${parts.length?parts.join(' · '):'Standard issue neighbor stats'}</div>`+
    `<div class="cweap">Starts with: ${WEAPONS[c.weapon].name} · ${wline}</div>`+
    `<div class="cperk">${c.perkDesc}</div>`;
}
document.getElementById('startbtn').addEventListener('click',()=>{ initAudio(); sfx.click(); hide('menu'); buildChampSelect(); show('champsel'); });
function beginRun(){
  if(MAPKEY!==selMap){ MAPKEY=selMap; FLOOR=buildFloor(); }
  newGame(); G.diff=selDiff;
  /* prune joiners whose controller is gone */
  for(let i=LOBBY.length-1;i>=0;i--) if(!PADS[LOBBY[i].pad]) LOBBY.splice(i,1);
  const champKeys=Object.keys(CHAMPS);
  const roster=[{pad:null, champ:selChamp}]
    .concat(LOBBY.map(l=>({pad:l.pad, champ:champKeys[l.champIdx]})));
  G.players=roster.map(r=>mkPlayer(r.pad,r.champ));
  G.players.forEach((pl,i)=>{
    pl.body.x=1300+(i-(roster.length-1)/2)*54;
    setActive(pl); applyChamp(pl.champ); saveActive();
  });
  setActive(G.players[0]);
  startWave(1);
}
function pauseStatsAll(){
  const prev=G.active; saveActive();
  let out='';
  G.players.forEach((pl,i)=>{
    setActive(pl);
    out+=(G.players.length>1?`<div class="pph" style="color:${PCOLORS[i]}">PLAYER ${i+1}</div>`:'')+statsHTML(true);
  });
  setActive(prev||G.players[0]);
  return out;
}
function renderLobby(){
  const bar=document.getElementById('lobbybar');
  if(!bar) return;
  const champKeys=Object.keys(CHAMPS);
  let html=`<span class="lobhint">🎮 Couch co-op: press <b>A</b> on a controller to join · dpad picks your neighbor · B or a click removes them</span>`;
  LOBBY.forEach((l,ix)=>{
    const key=champKeys[l.champIdx], i=ix+1;
    html+=`<span class="lobslot" style="border-color:${PCOLORS[i]}" title="Click to remove">`+
      `<img src="${champPortrait(key)}" alt=""> P${i+1} ${CHAMPS[key].name} ✕</span>`;
  });
  bar.innerHTML=html;
  bar.querySelectorAll('.lobslot').forEach((el,ix)=>
    el.addEventListener('click',()=>{ LOBBY.splice(ix,1); sfx.click(); renderLobby(); }));
  updateGridBadges();
}
/* joined controller players mark their champ card on the grid in their color */
function updateGridBadges(){
  const champKeys=Object.keys(CHAMPS);
  document.querySelectorAll('#champgrid .champcard').forEach(el=>{
    el.querySelectorAll('.pbadge').forEach(b=>b.remove());
    el.style.boxShadow='';
  });
  LOBBY.forEach((l,ix)=>{
    const key=champKeys[l.champIdx], i=ix+1;
    const card=document.querySelector('#champgrid .champcard[data-key="'+key+'"]');
    if(!card) return;
    const b=document.createElement('div');
    b.className='pbadge'; b.textContent='P'+(i+1);
    b.style.background=PCOLORS[i];
    card.appendChild(b);
    card.style.boxShadow='0 0 0 2px '+PCOLORS[i]+', 0 0 14px '+PCOLORS[i];
  });
}
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

/* ---------------- pre-rendered floor (per map) ---------------- */
function buildFloor(){ return MAPKEY==='office'? buildFloorOffice() : buildFloorYard(); }
function buildFloorOffice(){
  const c=document.createElement('canvas'); c.width=ARENA_W; c.height=ARENA_H;
  const f=c.getContext('2d');
  // carpet columns + tile seams + wear
  for(let x=0,i=0;x<ARENA_W;x+=130,i++){ f.fillStyle=i%2?'#31414e':'#374857'; f.fillRect(x,0,130,ARENA_H); }
  f.strokeStyle='rgba(0,0,0,0.12)'; f.lineWidth=1;
  for(let y=0;y<ARENA_H;y+=130){ f.beginPath(); f.moveTo(0,y); f.lineTo(ARENA_W,y); f.stroke(); }
  for(let i=0;i<420;i++){ f.fillStyle='rgba(0,0,0,'+rand(0.02,0.05)+')'; f.fillRect(rand(0,ARENA_W),rand(0,ARENA_H),3,3); }
  for(let i=0;i<6;i++){ f.fillStyle='rgba(74,53,32,0.14)'; f.beginPath();
    f.ellipse(rand(300,ARENA_W-300),rand(300,ARENA_H-300),rand(30,60),rand(20,40),rand(0,TAU),0,TAU); f.fill(); }
  function osign(x,y,txt){
    const w2=txt.length*6.4+16;
    f.fillStyle='#20303c'; roundedRectPath(f,x-w2/2,y-21,w2,18,3); f.fill();
    f.strokeStyle='#5d7486'; f.lineWidth=2; roundedRectPath(f,x-w2/2,y-21,w2,18,3); f.stroke();
    f.fillStyle='#cfe3f2'; f.font='bold 10px monospace'; f.textAlign='center'; f.textBaseline='middle';
    f.fillText(txt,x,y-11);
  }
  // break room tile (patio footprint) + microwave counter (grill spot)
  f.fillStyle='#8d9299'; f.fillRect(140,110,480,320);
  f.strokeStyle='rgba(0,0,0,0.22)'; f.lineWidth=2;
  for(let gx=140;gx<=620;gx+=80){ f.beginPath(); f.moveTo(gx,110); f.lineTo(gx,430); f.stroke(); }
  for(let gy=110;gy<=430;gy+=80){ f.beginPath(); f.moveTo(140,gy); f.lineTo(620,gy); f.stroke(); }
  f.fillStyle='#4a3a2c'; roundedRectPath(f,320,215,120,70,8); f.fill();
  f.fillStyle='#d8dde2'; roundedRectPath(f,334,225,92,50,6); f.fill();
  f.fillStyle='#20262c'; f.fillRect(342,233,52,34);
  f.fillStyle='#9be06f'; f.fillRect(400,233,16,8);
  f.strokeStyle='#20262c'; f.lineWidth=2; roundedRectPath(f,334,225,92,50,6); f.stroke();
  osign(380,470,'BREAK ROOM');
  // IT pit (driveway footprint)
  f.fillStyle='#2a333c'; f.fillRect(150,1520,440,480);
  f.strokeStyle='rgba(255,255,255,0.05)';
  for(let gy=1520;gy<2000;gy+=96){ f.beginPath(); f.moveTo(150,gy); f.lineTo(590,gy); f.stroke(); }
  osign(370,1500,'IT DEPARTMENT');
  // server room (shed footprint)
  f.fillStyle='rgba(0,0,0,0.3)'; f.beginPath(); f.ellipse(2270,306,232,108,0,0,TAU); f.fill();
  f.fillStyle='#141a20'; f.fillRect(2080,140,380,118);
  f.fillStyle='#2b3540'; f.fillRect(2080,252,380,178);
  for(let rx=2100;rx<2420;rx+=52){
    f.fillStyle='#1a222b'; f.fillRect(rx,268,40,150);
    for(let ly=278;ly<410;ly+=16){
      f.fillStyle=Math.random()<0.5?'#9be06f':'#ff5a5f'; f.fillRect(rx+6,ly,5,3);
      f.fillStyle='#6aa8f0'; f.fillRect(rx+16,ly,4,3);
    }
  }
  f.fillStyle='#4a5560'; f.fillRect(2226,300,88,130);
  f.strokeStyle='#141a20'; f.lineWidth=3; f.strokeRect(2226,300,88,130);
  f.fillStyle='#9db6c9'; f.fillRect(2360,300,64,52);
  f.strokeStyle='#141a20'; f.lineWidth=4; f.strokeRect(2360,300,64,52);
  osign(2160,470,'SERVER ROOM');
  // round conference table (pool footprint)
  f.fillStyle='rgba(0,0,0,0.32)'; f.beginPath(); f.ellipse(2160,1598,170,76,0,0,TAU); f.fill();
  f.fillStyle='#4a3520'; f.beginPath(); f.arc(2160,1560,158,0,TAU); f.fill();
  f.fillStyle='#5f4830'; f.beginPath(); f.arc(2160,1552,148,0,TAU); f.fill();
  const tg=f.createRadialGradient(2120,1516,20,2160,1552,148);
  tg.addColorStop(0,'#8a6d48'); tg.addColorStop(1,'#5f4830');
  f.fillStyle=tg; f.beginPath(); f.arc(2160,1552,136,0,TAU); f.fill();
  f.strokeStyle='rgba(0,0,0,0.25)'; f.lineWidth=3; f.beginPath(); f.arc(2160,1552,136,0,TAU); f.stroke();
  for(let i=0;i<7;i++){
    const a=rand(0,TAU), rr=rand(30,105);
    f.save(); f.translate(2160+Math.cos(a)*rr,1552+Math.sin(a)*rr*0.8); f.rotate(rand(-0.5,0.5));
    f.fillStyle='#e8e4da'; f.fillRect(-8,-11,16,22);
    f.strokeStyle='rgba(0,0,0,0.2)'; f.lineWidth=1;
    for(let ly=-6;ly<10;ly+=4){ f.beginPath(); f.moveTo(-5,ly); f.lineTo(5,ly); f.stroke(); }
    f.restore();
  }
  osign(2160,1768,'MEETING IN PROGRESS');
  // cubicle partitions (hedge footprints)
  for(const o of OBST){ if(o.type!=='hedge') continue;
    f.fillStyle='rgba(0,0,0,0.3)'; roundedRectPath(f,o.x-4,o.y+6,o.w+8,o.h+6,10); f.fill();
    f.fillStyle='#3c4b58'; roundedRectPath(f,o.x,o.y-4,o.w,o.h+8,8); f.fill();
    f.fillStyle='#54687a'; roundedRectPath(f,o.x,o.y-14,o.w,o.h,8); f.fill();
    f.strokeStyle='#8b9aa8'; f.lineWidth=3; roundedRectPath(f,o.x,o.y-14,o.w,o.h,8); f.stroke();
    f.fillStyle='#f4eeda';
    for(let i=0;i<Math.floor(o.w*o.h/2600);i++)
      f.fillRect(o.x+rand(8,o.w-14), o.y-14+rand(6,o.h-12), 8,10);
    f.fillStyle='#ffd166'; f.fillRect(o.x+rand(8,o.w-12), o.y-14+rand(6,o.h-10), 7,7);
  }
  // industrial copier (car footprint)
  f.fillStyle='rgba(0,0,0,0.35)'; f.beginPath(); f.ellipse(375,1692,142,64,0,0,TAU); f.fill();
  f.fillStyle='#b8bcc2'; roundedRectPath(f,250,1616,250,107,14); f.fill();
  f.fillStyle='#9ba0a8'; roundedRectPath(f,250,1668,250,55,14); f.fill();
  f.fillStyle='#20262c'; roundedRectPath(f,270,1628,90,30,6); f.fill();
  f.fillStyle='#6aa8f0'; f.fillRect(276,1634,36,18);
  f.fillStyle='#e8e4da'; f.fillRect(392,1636,86,12);
  f.fillStyle='rgba(0,0,0,0.2)'; f.fillRect(392,1648,86,4);
  f.fillStyle='#ff5a5f'; f.beginPath(); f.arc(478,1642,5,0,TAU); f.fill();
  osign(375,1600,'COPIER ROW');
  // coffee spill (kiddie pool footprint)
  f.fillStyle='rgba(0,0,0,0.28)'; f.beginPath(); f.ellipse(MUD.x,MUD.y+14,MUD.r+8,MUD.r*0.45,0,0,TAU); f.fill();
  f.fillStyle='#4a2f1c'; f.beginPath(); f.ellipse(MUD.x,MUD.y,MUD.r,MUD.r*0.8,0,0,TAU); f.fill();
  f.fillStyle='#6b4526'; f.beginPath(); f.ellipse(MUD.x-10,MUD.y-8,MUD.r*0.7,MUD.r*0.55,0,0,TAU); f.fill();
  f.fillStyle='rgba(255,255,255,0.12)'; f.beginPath(); f.ellipse(MUD.x-26,MUD.y-20,26,12,0.5,0,TAU); f.fill();
  f.save(); f.translate(MUD.x+MUD.r*0.8,MUD.y-MUD.r*0.5); f.rotate(1.9);
  f.fillStyle='#e8e4da'; f.fillRect(-9,-12,18,24); f.fillStyle='#c9c2a8'; f.fillRect(-9,-12,18,5); f.restore();
  osign(MUD.x,MUD.y+MUD.r+34,'WET FLOOR');
  // desk fan base (sprinkler spot) + chair mat (trampoline spot)
  f.fillStyle='#33383f'; f.beginPath(); f.ellipse(SPRINK.x,SPRINK.y+6,16,7,0,0,TAU); f.fill();
  f.fillStyle='#8b93a3'; f.fillRect(SPRINK.x-3,SPRINK.y-16,6,22);
  osign(SPRINK.x,SPRINK.y+44,'DESK FAN');
  f.fillStyle='rgba(255,255,255,0.06)'; f.beginPath(); f.ellipse(TRAMP.x,TRAMP.y,TRAMP.r+14,TRAMP.r*0.85+10,0,0,TAU); f.fill();
  osign(TRAMP.x,TRAMP.y+TRAMP.r+40,'ERGONOMIC ZONE');
  // ficus pots (tree spots)
  for(const t of TREES){
    f.fillStyle='rgba(0,0,0,0.22)'; f.beginPath(); f.ellipse(t.x+10,t.y+8,90,44,0,0,TAU); f.fill();
    f.fillStyle='#a8502e'; f.beginPath(); f.moveTo(t.x-16,t.y-4); f.lineTo(t.x+16,t.y-4);
    f.lineTo(t.x+11,t.y+16); f.lineTo(t.x-11,t.y+16); f.closePath(); f.fill();
    f.fillStyle='#8a3f24'; f.fillRect(t.x-17,t.y-8,34,6);
    f.fillStyle='#5a4128'; f.fillRect(t.x-3,t.y-22,6,16);
  }
  return c;
}
function buildFloorYard(){
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
let FLOOR = buildFloor();
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
    if(WEAPONS[key].icon) continue; /* emoji-iconed weapons skip the vector bake */
    const c=document.createElement('canvas'); c.width=c.height=48;
    const ic=c.getContext('2d');
    ic.translate(24,24); ic.rotate(-0.35);
    drawIcon(ic,key,17);
    ICONURL[key]=c.toDataURL();
  }
})();
/* icon for any gear key: baked vector art if we have it, emoji otherwise.
   always wrapped as a tappable .invit so tooltips work everywhere */
function gearIconHTML(key){
  const d=defByKey(key)||{};
  const inner=ICONURL[key] ? `<img src="${ICONURL[key]}" alt="">` : (d.icon||'❔');
  return `<span class="invit" data-k="${key}">${inner}</span>`;
}

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
  c.strokeStyle='rgba(18,22,16,0.6)'; c.lineWidth=1.5;
  c.fillStyle=L.shorts; roundedRectPath(c,-11,3,22,11,2); c.fill(); c.stroke();
  c.fillStyle=L.shorts2; c.fillRect(-11,7,5,6); c.fillRect(6,7,5,6);
  c.fillStyle=L.shirt; roundedRectPath(c,-11,-13,22,17,3); c.fill(); c.stroke();
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
  c.strokeStyle='rgba(18,22,16,0.6)'; c.lineWidth=1.5;
  roundedRectPath(c,-8,-28,16,16,4); c.stroke();
  c.fillStyle='#dcb387'; c.fillRect(f===1?-9:7,-22,2.5,4);
  c.fillStyle=L.hair; c.fillRect(-8,-26,3,8); c.fillRect(5,-26,3,8);
  c.fillStyle=L.top; c.beginPath(); c.ellipse(0,-27,7,3.2,0,Math.PI,0); c.fill();
  c.fillStyle='#2a2a2a';
  c.fillRect(f===1?-2.5:-5,-21,2.6,2.6); c.fillRect(f===1?3:0.5,-21,2.6,2.6);
  if(L.must){ c.fillStyle=L.must; c.fillRect(-4,-15.5,8,2.2); }
}
function drawGnome(g){
  ctx.save(); ctx.translate(g.x,g.y);
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0,10,9,3.5,0,0,TAU); ctx.fill();
  const S=sprite('gnome');
  if(S){ ctx.drawImage(S,-14,-20,28,28); ctx.restore(); return; }
  ctx.fillStyle='#3f6b94'; ctx.fillRect(-5,-2,10,10);
  ctx.fillStyle='#e8e4da'; ctx.beginPath(); ctx.arc(0,-4,5,0,TAU); ctx.fill();
  ctx.fillStyle='#e8c49a'; ctx.fillRect(-2.5,-7,5,3);
  ctx.fillStyle='#c22e35'; ctx.beginPath(); ctx.moveTo(-5,-7); ctx.lineTo(5,-7); ctx.lineTo(0,-19); ctx.closePath(); ctx.fill();
  ctx.restore();
}
/* small always-on HP bar above each character so eyes stay on the action */
function drawPlayerHP(pl){
  if(G.mode==='menu') return;
  const P=pl.body;
  const frac=clamp(pl.hp/pl.stats.maxHP,0,1);
  const w=34, y=P.y-(P.mowT>0?52:44);
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.fillRect(P.x-w/2-1, y-1, w+2, 6);
  ctx.fillStyle = frac<0.3?'#ff5a5f':frac<0.6?'#ffd166':'#9be06f';
  ctx.fillRect(P.x-w/2, y, w*frac, 4);
}
/* a downed neighbor: ghost body, revive ring for teammates standing close */
function drawDowned(pl,i){
  const P=pl.body;
  ctx.save(); ctx.translate(P.x,P.y); ctx.globalAlpha=0.45;
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0,30,17,5.5,0,0,TAU); ctx.fill();
  ctx.rotate(1.35);
  drawBody(ctx,Object.assign({},LOOKS.dad,LOOKS[P.champ]||{}),1,0);
  ctx.restore();
  ctx.globalAlpha=1;
  if(G.players.length>1){
    ctx.save();
    ctx.strokeStyle=PCOLORS[i]; ctx.lineWidth=3; ctx.globalAlpha=0.8;
    ctx.beginPath(); ctx.arc(P.x,P.y,34,-Math.PI/2,-Math.PI/2+TAU*clamp(pl.reviveT/2.5,0,1)); ctx.stroke();
    ctx.globalAlpha=1;
    ctx.fillStyle='#ff5a5f'; ctx.font='bold 11px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('DOWN',P.x,P.y-46);
    ctx.restore();
  }
}
function drawDad(P){
  const x=P.x, y=P.y, f=P.face;
  const L=Object.assign({},LOOKS.dad,LOOKS[P.champ||G.champ]||{});
  const bob=Math.sin(P.bob)*2, step=Math.sin(P.bob);
  const blink = P.iframe>0 && Math.sin(AT*30)>0;
  ctx.save(); ctx.translate(x,y); ctx.rotate(P.lean||0); ctx.translate(0,bob*0.35);
  if(blink) ctx.globalAlpha=0.45;
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0,30,17,5.5,0,0,TAU); ctx.fill();
  const S=sprite(P.champ||G.champ)||sprite('dad');
  if(S){
    if(f===-1) ctx.scale(-1,1);
    ctx.drawImage(S,-34,-36,68,68);
  } else {
    drawBody(ctx,L,f,step);
  }
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
  const S=sprite('mower');
  if(S){
    ctx.drawImage(S,-42,-46,84,84);
    ctx.restore();
    drawGlow('gold',x,y,44,0.22+0.1*Math.sin(AT*20));
    return;
  }
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
  const L=Object.assign({},LOOKS.dad,LOOKS[P.champ||G.champ]||{});
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
  if(e.trait){
    const T=TRAITS[e.trait];
    drawGlow(T.glow,0,0,r*1.6,0.45);
    ctx.fillStyle=T.color; ctx.font='bold 9px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(T.name,0,-r-16);
  }
  if(e.giant) ctx.scale(1.22,1.22);
  if(e.key==='courier'){
    ctx.translate(0,bob);
    drawGlow('gold',0,0,r*2,0.55);
    ctx.fillStyle='#d4af37'; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
    ctx.strokeStyle='#8a6d1c'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.fillStyle='#f5e28a'; ctx.beginPath(); ctx.arc(-r*0.25,-r*0.25,r*0.45,0,TAU); ctx.fill();
    /* bolt sack on its back */
    ctx.fillStyle='#8a5c34'; ctx.beginPath(); ctx.arc(0,-r-6,9,0,TAU); ctx.fill();
    ctx.strokeStyle='#5a3a1e'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-4,-r-13); ctx.lineTo(4,-r-13); ctx.stroke();
    ctx.fillStyle='#ffd166'; ctx.font='bold 9px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('$',0,-r-6);
    ctx.fillStyle='#2a2a2a'; ctx.fillRect(-r*0.4,-3,r*0.3,4); ctx.fillRect(r*0.12,-3,r*0.3,4);
  } else if(e.key==='chat'){
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
  } else if(e.key==='scoot'){
    ctx.rotate(Math.atan2(G.player.y-y,G.player.x-x));
    ctx.fillStyle='#1f6f6b'; roundedRectPath(ctx,-r*0.9,-r*0.25,r*1.8,r*0.5,3); ctx.fill();
    ctx.strokeStyle='#2fa39c'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(r*0.75,0); ctx.lineTo(r*0.75,-r*0.9);
    ctx.moveTo(r*0.45,-r*0.9); ctx.lineTo(r*1.05,-r*0.9); ctx.stroke();
    ctx.fillStyle='#20242b';
    ctx.beginPath(); ctx.arc(-r*0.7,r*0.35,4.5,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.7,r*0.35,4.5,0,TAU); ctx.fill();
    drawGlow(e.state===1?'red':'orange',0,-r*0.1,8,0.6);
    ctx.fillStyle=e.state===1?'#ff5a5f':'#ffb26b'; ctx.beginPath(); ctx.arc(0,-r*0.1,3,0,TAU); ctx.fill();
  } else if(e.key==='thermo'){
    ctx.translate(0,bob);
    ctx.fillStyle='#20242b'; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
    ctx.strokeStyle='#59626d'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.stroke();
    ctx.strokeStyle='#394047'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,r*0.72,0,TAU); ctx.stroke();
    const tw=e.windT>0? (1-e.windT/0.5) : 0;
    drawGlow(tw>0?'red':'orange',0,0,12+tw*8,0.55+0.4*tw);
    ctx.fillStyle=tw>0?'#ff5a5f':'#ff9a4d'; ctx.font='bold 10px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('88°',0,1);
  } else if(e.key==='frido'){
    ctx.translate(0,bob*0.4);
    ctx.fillStyle='#c7ccd4'; roundedRectPath(ctx,-r*0.72,-r,r*1.44,r*2,5); ctx.fill();
    ctx.strokeStyle='#8b93a3'; ctx.lineWidth=2; roundedRectPath(ctx,-r*0.72,-r,r*1.44,r*2,5); ctx.stroke();
    ctx.strokeStyle='#59626d'; ctx.beginPath(); ctx.moveTo(-r*0.72,-r*0.25); ctx.lineTo(r*0.72,-r*0.25); ctx.stroke();
    ctx.fillStyle='#59626d'; ctx.fillRect(r*0.35,-r*0.6,4,r*0.3); ctx.fillRect(r*0.35,0,4,r*0.5);
    drawGlow('blue',-r*0.25,-r*0.55,9,0.6);
    ctx.fillStyle='#8fd8ff'; ctx.fillRect(-r*0.42,-r*0.68,r*0.34,r*0.26);
    drawGlow('red',0,r*0.45,8,0.5);
    ctx.fillStyle='#ff5a5f'; ctx.beginPath(); ctx.arc(0,r*0.45,2.8,0,TAU); ctx.fill();
  } else if(e.key==='vend'){
    ctx.translate(0,bob*0.3);
    drawGlow('gold',0,0,r*1.7,0.4);
    ctx.fillStyle='#8a2f35'; roundedRectPath(ctx,-r*0.8,-r,r*1.6,r*2,5); ctx.fill();
    ctx.strokeStyle='#d4af37'; ctx.lineWidth=2.5; roundedRectPath(ctx,-r*0.8,-r,r*1.6,r*2,5); ctx.stroke();
    ctx.fillStyle='#1d2025'; roundedRectPath(ctx,-r*0.55,-r*0.75,r*0.7,r*1.3,3); ctx.fill();
    for(let row=0;row<3;row++){
      ctx.fillStyle=['#ffd166','#9be06f','#ff9a4d'][row];
      for(let cq=0;cq<2;cq++) ctx.fillRect(-r*0.48+cq*r*0.3, -r*0.65+row*r*0.4, r*0.2, r*0.24);
    }
    const vw=e.windT>0? (1-e.windT/0.5) : 0;
    drawGlow(vw>0?'red':'orange',r*0.45,-r*0.2,9,0.5+0.4*vw);
    ctx.fillStyle=vw>0?'#ff5a5f':'#ffb26b'; ctx.beginPath(); ctx.arc(r*0.45,-r*0.2,3,0,TAU); ctx.fill();
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
  } else if(e.key==='subs'){
    ctx.translate(0,bob*0.5);
    drawGlow('gold',0,0,r*1.7,0.3);
    ctx.fillStyle='#d8d3c5'; roundedRectPath(ctx,-r,-r*0.72,r*2,r*1.44,8); ctx.fill();
    ctx.strokeStyle='#8f8a7c'; ctx.lineWidth=3; roundedRectPath(ctx,-r,-r*0.72,r*2,r*1.44,8); ctx.stroke();
    ctx.strokeStyle='#a8a294'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(-r+4,-r*0.66); ctx.lineTo(0,r*0.1); ctx.lineTo(r-4,-r*0.66); ctx.stroke();
    ctx.save(); ctx.rotate(-0.18);
    ctx.strokeStyle='#c22e35'; ctx.lineWidth=3; ctx.strokeRect(-r*0.62,r*0.05,r*1.24,r*0.42);
    ctx.fillStyle='#c22e35'; ctx.font='bold '+Math.round(r*0.3)+'px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('PAST DUE',0,r*0.27);
    ctx.restore();
    drawGlow('red',-r*0.42,-r*0.35,10,0.6); drawGlow('red',r*0.42,-r*0.35,10,0.6);
    ctx.fillStyle='#ff5a5f'; ctx.fillRect(-r*0.52,-r*0.42,r*0.24,r*0.14); ctx.fillRect(r*0.28,-r*0.42,r*0.24,r*0.14);
  } else if(e.key==='cloud'){
    ctx.translate(0,bob);
    drawGlow('blue',0,0,r*1.8,0.3);
    ctx.fillStyle='#3a4450';
    for(const [ox,oy,rr] of [[0,0,r*0.75],[-r*0.7,r*0.15,r*0.5],[r*0.7,r*0.12,r*0.52],[-r*0.3,-r*0.42,r*0.5],[r*0.35,-r*0.38,r*0.45]]){
      ctx.beginPath(); ctx.arc(ox,oy,rr,0,TAU); ctx.fill();
    }
    ctx.fillStyle='#2b333d'; ctx.beginPath(); ctx.arc(-r*0.2,r*0.3,r*0.5,0,TAU); ctx.fill();
    ctx.fillStyle='#ffd166';
    ctx.beginPath(); ctx.moveTo(-4,r*0.5); ctx.lineTo(8,r*0.5); ctx.lineTo(0,r*0.9); ctx.lineTo(10,r*0.9);
    ctx.lineTo(-8,r*1.4); ctx.lineTo(-2,r*1.0); ctx.lineTo(-10,r*1.0); ctx.closePath(); ctx.fill();
    drawGlow('purple',0,-r*0.1,14,0.7);
    ctx.fillStyle='#c48df0'; ctx.beginPath(); ctx.arc(0,-r*0.1,8,0,TAU); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,-r*0.1,3.4,0,TAU); ctx.fill();
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
  } else if(p.kind==='gear'){
    /* the mystery box: rarity-colored, contents secret until grabbed */
    const d=defByKey(p.key), col=RARITY[d.rar].color;
    const bb=Math.sin(AT*4+p.t)*2.5;
    drawGlow(d.rar>=4?'gold':'green',p.x,p.y+bb,17,0.5);
    ctx.save(); ctx.translate(p.x,p.y+bb);
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0,13,13,4,0,0,TAU); ctx.fill();
    ctx.fillStyle='#22271f'; roundedRectPath(ctx,-11,-11,22,22,5); ctx.fill();
    ctx.strokeStyle=col; ctx.lineWidth=2.2;
    roundedRectPath(ctx,-11,-11,22,22,5); ctx.stroke();
    ctx.fillStyle=col; ctx.font='bold 13px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('?',0,1);
    ctx.restore();
  }
}
function drawTramp(){
  if(MAPKEY==='office'){
    // rolling office chair: same launch mechanics, corporate energy
    ctx.save(); ctx.translate(TRAMP.x,TRAMP.y);
    const sq=1-TRAMP.anim*0.12;
    ctx.strokeStyle='#33383f'; ctx.lineWidth=4;
    for(let i=0;i<5;i++){
      const a=i/5*TAU+0.5;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*TRAMP.r*0.5,Math.sin(a)*TRAMP.r*0.4);
      ctx.lineTo(Math.cos(a)*TRAMP.r*0.75,Math.sin(a)*TRAMP.r*0.62+6); ctx.stroke();
      ctx.fillStyle='#1d2025'; ctx.beginPath();
      ctx.arc(Math.cos(a)*TRAMP.r*0.78,Math.sin(a)*TRAMP.r*0.64+8,6,0,TAU); ctx.fill();
    }
    ctx.fillStyle='#22282f'; ctx.beginPath(); ctx.ellipse(0,0,TRAMP.r*0.62*sq,TRAMP.r*0.5*sq,0,0,TAU); ctx.fill();
    ctx.fillStyle='#2f3a44'; ctx.beginPath(); ctx.ellipse(0,-6,TRAMP.r*0.5*sq,TRAMP.r*0.4*sq,0,0,TAU); ctx.fill();
    ctx.fillStyle='#1d2025'; ctx.beginPath(); ctx.ellipse(0,-TRAMP.r*0.45,TRAMP.r*0.5,TRAMP.r*0.22,0,0,TAU); ctx.fill();
    ctx.restore(); return;
  }
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
  if(MAPKEY==='office'){
    // water coolers: they tip over just like the flamingos
    for(const fl of FLAM){
      ctx.save(); ctx.translate(fl.x,fl.y);
      ctx.rotate(fl.up?0 : fl.f*1.35*fl.dir);
      ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0,26,14,5,0,0,TAU); ctx.fill();
      ctx.fillStyle='#e8e4da'; roundedRectPath(ctx,-10,-2,20,28,4); ctx.fill();
      ctx.fillStyle='#20262c'; ctx.fillRect(-6,8,12,6);
      ctx.fillStyle='rgba(110,198,255,0.85)'; roundedRectPath(ctx,-8,-26,16,26,5); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillRect(-5,-22,4,14);
      ctx.restore();
    }
    return;
  }
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
function canopyFade(t){
  let ca=0.96;
  const P=G&&G.player;
  if(P){ const d=Math.hypot(P.x-t.x, P.y-(t.y-26)); ca=lerp(0.42,0.96,clamp((d-70)/60,0,1)); }
  return ca;
}
function drawCanopies(){
  if(MAPKEY==='office'){
    // server room ceiling panel, overhead like the shed roof
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(2066,252,408,14);
    ctx.fillStyle='#232c34';
    ctx.beginPath(); ctx.moveTo(2066,262); ctx.lineTo(2474,262); ctx.lineTo(2420,120); ctx.lineTo(2120,120);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#39434d'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(2066,262); ctx.lineTo(2474,262); ctx.lineTo(2420,120); ctx.lineTo(2120,120);
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle='#39434d'; ctx.fillRect(2150,150,60,30); ctx.fillRect(2320,150,60,30);
    ctx.fillStyle='#9be06f'; ctx.fillRect(2160,158,8,4); ctx.fillRect(2330,158,8,4);
    // ficus canopies with the same walk-under fade
    for(const t of TREES){
      ctx.save(); ctx.translate(t.x+Math.sin(AT*0.5)*3, t.y-26);
      ctx.globalAlpha=canopyFade(t);
      ctx.fillStyle='#3f6d35';
      for(const [ox,oy,rr] of [[0,0,52],[-34,10,34],[36,8,34],[-12,-26,30],[18,-24,28]]){
        ctx.beginPath(); ctx.arc(ox,oy,rr,0,TAU); ctx.fill();
      }
      ctx.fillStyle='#5a8f4a';
      for(let i=0;i<10;i++){ ctx.beginPath(); ctx.arc(rand(-44,44),rand(-34,26),rand(3,6),0,TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha=1;
    return;
  }
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
    ctx.globalAlpha=canopyFade(t);
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
    if(e.def.elite||e.def.courier) targets.push({x:e.x,y:e.y,c:'#ffd166'});
    if(e.def.boss) targets.push({x:e.x,y:e.y,c:'#ff5a5f'});
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
  const cam=G.cam, Z=zoomLevel()*COOPZ;
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
    // ability aura rings, drawn under the characters
    if(G.mode!=='menu'){
      for(const pl of G.players){
        const P=pl.body;
        if(P.dead) continue;
        if(pl.abil.zapaura){
          ctx.save(); ctx.strokeStyle='rgba(143,216,255,0.3)'; ctx.lineWidth=2;
          ctx.setLineDash([6,10]); ctx.lineDashOffset=-AT*40;
          ctx.beginPath(); ctx.arc(P.x,P.y,150,0,TAU); ctx.stroke(); ctx.restore();
        }
        if(pl.stats.auraSlow>0){
          ctx.save(); ctx.strokeStyle='rgba(196,141,240,0.28)'; ctx.lineWidth=2;
          ctx.setLineDash([10,12]); ctx.lineDashOffset=AT*30;
          ctx.beginPath(); ctx.arc(P.x,P.y,190,0,TAU); ctx.stroke(); ctx.restore();
        }
      }
    }
    for(const g of G.gnomes) drawGnome(g);
    G.players.forEach((pl,i)=>{
      const P=pl.body;
      if(P.dead && G.mode!=='menu'){ drawDowned(pl,i); return; }
      if(P.dead) return;
      saveActive(); setActive(pl);
      if(G.players.length>1){
        ctx.save(); ctx.strokeStyle=PCOLORS[i]; ctx.globalAlpha=0.55; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.ellipse(P.x,P.y+30,19,7,0,0,TAU); ctx.stroke(); ctx.restore();
      }
      if(P.mowT>0) drawMower(P);
      else { drawDad(P); drawWeapons(); }
      drawPlayerHP(pl);
    });
    saveActive(); setActive(G.players[0]);
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

