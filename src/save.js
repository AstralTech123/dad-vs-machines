/* DAD vs THE MACHINES: save + resume.
   The run autosaves every time the shop renders (the natural between-waves
   checkpoint), including the exact shop offers so a refresh is never a free
   reroll. The menu grows a RESUME button while a save exists. Dying or
   winning clears it: this is a bookmark, not a time machine. */
const SAVE_KEY='dvm_save';
const SAVE_V=1;

function serializeInst(g){
  return g?{ kind:g.kind, key:g.key, copies:g.copies, emp:g.emp, curse:g.curse, used:g.used }:null;
}
function reviveInst(s){
  if(!s) return null;
  const inst=s.kind==='w'?mkWeapon(s.key):mkGearItem(s.key);
  inst.copies=s.copies; inst.emp=s.emp; inst.curse=s.curse||null; inst.used=!!s.used;
  return inst;
}
function saveRun(){
  if(!G || G.mode!=='shop' || window._SIMMING) return;
  try{
    const s={
      v:SAVE_V, t:Date.now(), map:MAPKEY, diff:G.diff, endless:!!G.endless,
      wave:G.wave, xp:G.xp, level:G.level, mats:G.mats, kills:G.kills, totalMats:G.totalMats,
      yard:G.yard, hasLegend:!!G.hasLegend,
      favorNext:G.favorNext, favorApplied:G.favorApplied, favorNextWave:G.favorNextWave||0,
      shopState:{ favorUsed:!!G.shop.favorUsed, favorPicks:G.shop.favorPicks||null },
      players:G.players.map(pl=>({
        pad:pl.pad, champ:pl.champ, hp:pl.hp, earned:pl.earned||0, packMax:pl.packMax,
        stats:pl.stats, abil:pl.abil, setApplied:pl.setApplied||{},
        gear:Object.fromEntries(GEAR_SLOTS.map(([sk])=>[sk,serializeInst(pl.gear[sk])])),
        pack:pl.pack.map(serializeInst),
        rerolls:pl.rerolls||0,
        offers:(pl.offers||[]).map(o=>({ kind:o.kind, key:o.key, rar:o.rar, price:o.price,
          curse:o.curse, relevant:!!o.relevant, sold:!!o.sold, locked:!!o.locked })),
      })),
    };
    localStorage.setItem(SAVE_KEY,JSON.stringify(s));
    updateResumeBtn();
  }catch(err){}
}
/* read and sanity-check the save without touching game state */
function peekSave(){
  try{
    const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(!s || s.v!==SAVE_V || !s.players || !s.players.length) return null;
    for(const p of s.players){
      if(!CHAMPS[p.champ]) return null;
      for(const it of [...Object.values(p.gear||{}), ...(p.pack||[])])
        if(it && !defByKey(it.key)) return null; /* catalog changed under the save */
    }
    return s;
  }catch(err){ return null; }
}
function clearSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(err){} updateResumeBtn(); }
function resumeRun(){
  const s=peekSave(); if(!s) return false;
  if(MAPKEY!==s.map){ MAPKEY=s.map; FLOOR=buildFloor(); }
  newGame();
  G.diff=s.diff; G.endless=s.endless;
  G.wave=s.wave; G.xp=s.xp; G.level=s.level; G.mats=s.mats; G.kills=s.kills; G.totalMats=s.totalMats;
  Object.assign(G.yard,s.yard); G.hasLegend=s.hasLegend;
  G.favorNext=s.favorNext; G.favorApplied=s.favorApplied; G.favorNextWave=s.favorNextWave;
  G.players=s.players.map((p,i)=>{
    const pl=mkPlayer(p.pad,p.champ);
    pl.perk=(CHAMPS[p.champ]||{}).perk||null;
    /* stats are restored wholesale: gear, level-ups, sets, curses, and yard
       purchases are already baked in, so nothing gets re-applied */
    pl.stats=p.stats; pl.abil=p.abil; pl.setApplied=p.setApplied;
    pl.packMax=p.packMax||PACK_BASE;
    for(const [sk] of GEAR_SLOTS) pl.gear[sk]=reviveInst((p.gear||{})[sk]);
    pl.pack=(p.pack||[]).map(reviveInst).filter(Boolean);
    syncWeapons(pl);
    pl.hp=Math.min(p.hp,pl.stats.maxHP); pl.earned=p.earned;
    pl.rerolls=p.rerolls; pl.offers=p.offers;
    pl.body.champ=p.champ;
    pl.body.x=1300+(i-(s.players.length-1)/2)*54; pl.body.y=1000;
    return pl;
  });
  setActive(G.players[0]);
  /* gnome trinkets bring their gnomes back to work */
  for(const pl of G.players)
    for(let k=0;k<(pl.abil.gnome||0);k++)
      G.gnomes.push({ x:pl.body.x+rand(-50,50), y:pl.body.y+rand(-50,50), cd:0, own:pl });
  G.mode='shop';
  G.shop.favorUsed=s.shopState.favorUsed; G.shop.favorPicks=s.shopState.favorPicks;
  document.getElementById('favorpick').classList.add('hidden');
  renderShop(); renderSlots(); updateHUD();
  show('shop');
  toast('🔧 Shift resumed. The machines waited.');
  return true;
}
/* menu button: appears only while a save exists, labeled with the run */
function updateResumeBtn(){
  const b=document.getElementById('mresume'); if(!b) return;
  const s=peekSave();
  if(!s){ b.style.display='none'; return; }
  b.style.display='';
  const who=(CHAMPS[s.players[0].champ]||{name:'?'}).name;
  const coop=s.players.length>1?' +'+(s.players.length-1):'';
  b.textContent='🔧 RESUME: wave '+(s.wave+1)+' · '+who+coop+' · '+((DIFFS[s.diff]||{}).name||'');
}
(function wireResume(){
  const b=document.getElementById('mresume'); if(!b) return;
  b.addEventListener('click',()=>{
    initAudio(); sfx.click();
    if(resumeRun()) hide('menu');
    else { clearSave(); toast('That save was from an older shift. Fresh clock-in it is.'); }
  });
  updateResumeBtn();
})();
