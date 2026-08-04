/* DAD vs THE MACHINES: dev-only headless balance simulator.
   Never runs on its own. From the console:
     await simRun('gus', 2)         -> one bot run, returns summary
     await simMatrix([['dad',2],['gus',4]]) -> several runs
   The bot kites away from crowds, dashes when swarmed, rides the mower,
   buys whatever it can afford, and picks random level-ups. It plays worse
   than a human, so read results as a floor, not a ceiling. */
function simBotStep(){
  const P=G.player;
  let near=0;
  for(const e of G.enemies){ if(dist2(P.x,P.y,e.x,e.y)<200*200) near++; }
  /* sample 8 directions, walk toward the probe point with the most breathing
     room: crude gap-finding, much closer to human routing than fleeing */
  let bestA=0, bestScore=-Infinity;
  for(let k=0;k<8;k++){
    const a2=k/8*TAU;
    const px=P.x+Math.cos(a2)*190, py=P.y+Math.sin(a2)*190;
    let score=0;
    for(const e of G.enemies) score+=Math.min(Math.hypot(px-e.x,py-e.y),520);
    for(const b of G.ebullets) score-=Math.max(0,180-Math.hypot(px-b.x,py-b.y))*2;
    if(px<140||px>ARENA_W-140||py<140||py>ARENA_H-140) score-=2600;
    if(score>bestScore){ bestScore=score; bestA=a2; }
  }
  const ax=Math.cos(bestA), ay=Math.sin(bestA);
  keys['w']=keys['a']=keys['s']=keys['d']=false;
  if(ax>0.3) keys['d']=true; if(ax<-0.3) keys['a']=true;
  if(ay>0.3) keys['s']=true; if(ay<-0.3) keys['w']=true;
  if(P.dashCd<=0 && near>=4) tryDash();
  if(P.ult>=scaledUltNeed(G.stats) && near>=3) tryMow();
}
function simTick(dt){
  if(G.mode==='play'){
    simBotStep();
    G.t+=dt;
    updatePlayer(dt); updateWeapons(dt); updateBullets(dt); updateEnemies(dt);
    updateWarns(dt); updateSpawning(dt); updateYard(dt); updatePickups(dt);
    updateParts(0.5); updateTexts(0.5); updateWaveFlow(dt);
  } else if(G.mode==='shop'){
    if(!document.getElementById('levelup').classList.contains('hidden')){
      if(G.lvlState){
        G.lvlState.forEach((ls,i)=>{ if(!ls.done) chooseLevelUp(i,Math.floor(Math.random()*ls.picks.length)); });
        advanceLevelUp();
      }
    } else {
      let guard=0, bought=true;
      while(bought && guard++<12){
        bought=false;
        for(const pl of G.players){
          (pl.offers||[]).forEach((o,i)=>{ if(!o.sold && canBuyFor(pl,o)){ buyOffer(pl,i); bought=true; } });
        }
      }
      document.getElementById('gowave').click();
    }
  }
}
async function simRun(champ,diff,maxWave){
  maxWave=maxWave||20;
  selChamp=champ; selDiff=diff;
  if(MAPKEY!=='yard'){ MAPKEY='yard'; FLOOR=buildFloor(); }
  newGame(); G.diff=diff; applyChamp(champ); startWave(1);
  const dt=1/30;
  const cap=30*60*25; /* 25 sim-minutes */
  let steps=0, maxWaveReached=1;
  while(steps++<cap){
    simTick(dt);
    maxWaveReached=Math.max(maxWaveReached,G.wave);
    if(G.player.dead) break;
    if(G.sub==='done') break;
    if(G.wave>maxWave) break;
    if(steps%4000===0) await new Promise(r=>setTimeout(r,0));
  }
  const r={ champ, diff, waveReached:maxWaveReached, survived:!G.player.dead,
    level:G.level, kills:G.kills, hpLeft:Math.round(G.hp), gear:gearCount(G.active),
    weapons:G.weapons.length, simMinutes:Math.round(steps*dt/60*10)/10 };
  hide('shop'); hide('levelup'); hide('dead'); hide('win');
  return r;
}
async function simMatrix(list){
  const out=[];
  for(const [c,d] of list) out.push(await simRun(c,d));
  return out;
}
