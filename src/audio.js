/* DAD vs THE MACHINES: audio (synth sfx and music, no asset files).
   Two buses: sfx and music, separately toggleable. Menu and game get
   different tracks, switched automatically by the main loop. */
let AC=null, masterGain=null, gSfx=null, gMus=null;
let muted=false, musicOn=true, sfxOn=true;
let musicTimer=null, musicStep=0, curTrack='menu';
function initAudio(){
  if(AC) return;
  try{
    AC = new (window.AudioContext||window.webkitAudioContext)();
    masterGain=AC.createGain(); masterGain.gain.value=0.9; masterGain.connect(AC.destination);
    gSfx=AC.createGain(); gSfx.connect(masterGain);
    gMus=AC.createGain(); gMus.connect(masterGain);
    applyMix();
    startMusic();
  }catch(e){ AC=null; }
}
function applyMix(){
  if(!AC) return;
  masterGain.gain.value = muted?0:0.9;
  gSfx.gain.value = sfxOn?1:0;
  gMus.gain.value = musicOn?0.9:0;
}
function tone(freq,dur,type,vol,slideTo,bus){
  if(!AC||muted) return;
  const o=AC.createOscillator(), g=AC.createGain();
  o.type=type||'square'; o.frequency.setValueAtTime(freq,AC.currentTime);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo),AC.currentTime+dur);
  g.gain.setValueAtTime(vol,AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+dur);
  o.connect(g); g.connect(bus==='mus'?gMus:gSfx);
  o.start(); o.stop(AC.currentTime+dur+0.02);
}
function noiseHit(dur,vol,lp,bus){
  if(!AC||muted) return;
  const len=Math.max(1,Math.floor(AC.sampleRate*dur));
  const buf=AC.createBuffer(1,len,AC.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
  const src=AC.createBufferSource(); src.buffer=buf;
  const g=AC.createGain(); g.gain.value=vol;
  const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp||3000;
  src.connect(f); f.connect(g); g.connect(bus==='mus'?gMus:gSfx); src.start();
}
const sfx = {
  /* softened: triangle wave, quieter, pitch wobble so it never drones */
  shoot:(p)=> tone(540*(p||1)*rand(0.93,1.07),0.05,'triangle',0.028,300*(p||1)),
  hit:  ()=> noiseHit(0.05,0.05,2400),
  boom: ()=> { noiseHit(0.22,0.18,900); tone(150,0.28,'sine',0.14,40); },
  pickup:()=> tone(rand(840,960),0.06,'sine',0.045,1350),
  buy:  ()=> { tone(523,0.09,'triangle',0.1); setTimeout(()=>tone(784,0.14,'triangle',0.1),90); },
  hurt: ()=> { tone(200,0.16,'sawtooth',0.13,70); noiseHit(0.1,0.09,1200); },
  wave: ()=> { [523,659,784,1046].forEach((f,i)=> setTimeout(()=>tone(f,0.12,'triangle',0.08),i*90)); },
  combine:()=> { [660,880,1320].forEach((f,i)=> setTimeout(()=>tone(f,0.1,'square',0.05),i*70)); },
  levelup:()=> { [523,659,784,1046,1318].forEach((f,i)=> setTimeout(()=>tone(f,0.13,'triangle',0.09),i*70)); },
  legendary:()=> { [392,494,587,784].forEach((f,i)=> setTimeout(()=>tone(f,0.4,'sine',0.1),i*150)); noiseHit(0.6,0.03,7000); },
  click:()=> tone(400,0.03,'square',0.04),
  bossroar:()=> { tone(90,0.6,'sawtooth',0.2,45); noiseHit(0.5,0.16,500); },
  elitewarn:()=> { [220,196,220,262].forEach((f,i)=> setTimeout(()=>tone(f,0.16,'sawtooth',0.08,f*0.8),i*130)); },
  spring:()=> tone(190,0.14,'sine',0.11,640),
  munch:()=> { tone(160,0.07,'triangle',0.11); setTimeout(()=>tone(130,0.09,'triangle',0.11),80); },
  beep:()=> tone(980,0.05,'square',0.04),
  tink:()=> { tone(1500,0.04,'square',0.03); },
  dashw:()=> tone(300,0.1,'sawtooth',0.04,900),
  sizzle:()=> noiseHit(0.3,0.045,1600),
  drop:()=> tone(1200,0.5,'sine',0.04,300),
  elite:()=> { tone(220,0.25,'sawtooth',0.09,110); setTimeout(()=>tone(180,0.3,'sawtooth',0.09,90),180); },
  mow:()=> tone(rand(68,84),0.07,'sawtooth',0.05,55),
};
/* menu: lazy front-porch arpeggio. game: the driving bassline. */
const TRACKS={
  menu:{ notes:[220,0,262,330,0,262,330,392, 196,0,247,294,0,247,294,330], step:300, type:'sine', vol:0.024, hat:false },
  game:{ notes:[110,0,110,0,164.8,0,146.8,130.8, 110,0,110,164.8,0,196,0,146.8], step:140, type:'triangle', vol:0.03, hat:true },
};
function setTrack(name){
  if(curTrack===name) return;
  curTrack=name; musicStep=0;
  if(musicTimer){ clearInterval(musicTimer); musicTimer=null; startMusic(); }
}
function startMusic(){
  if(musicTimer||!AC) return;
  musicTimer=setInterval(()=>{
    if(!AC) return;
    const tr=TRACKS[curTrack];
    const f=tr.notes[musicStep%tr.notes.length];
    if(f) tone(f,tr.step/1000*1.2,tr.type,tr.vol,0,'mus');
    if(tr.hat && musicStep%2===0) noiseHit(0.015,0.01,7000,'mus');
    musicStep++;
  }, TRACKS[curTrack].step);
}
function toggleMute(){
  muted=!muted; applyMix(); toast(muted?'Muted':'Sound on');
  document.getElementById('mutebtn').textContent = muted?'🔇':'🔊';
}
function toggleMusic(){ musicOn=!musicOn; applyMix(); }
function toggleSfx(){ sfxOn=!sfxOn; applyMix(); }
