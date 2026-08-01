/* DAD vs THE MACHINES: audio (synth sfx and music, no asset files) */
/* ---------------- audio (synthesized) ---------------- */
let AC=null, masterGain=null, muted=false, musicTimer=null, musicStep=0;
function initAudio(){
  if(AC) return;
  try{
    AC = new (window.AudioContext||window.webkitAudioContext)();
    masterGain = AC.createGain(); masterGain.gain.value=0.9; masterGain.connect(AC.destination);
    startMusic();
  }catch(e){ AC=null; }
}
function tone(freq,dur,type,vol,slideTo){
  if(!AC||muted) return;
  const o=AC.createOscillator(), g=AC.createGain();
  o.type=type||'square'; o.frequency.setValueAtTime(freq,AC.currentTime);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo),AC.currentTime+dur);
  g.gain.setValueAtTime(vol,AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+dur);
  o.connect(g); g.connect(masterGain);
  o.start(); o.stop(AC.currentTime+dur+0.02);
}
function noiseHit(dur,vol,lp){
  if(!AC||muted) return;
  const len=Math.max(1,Math.floor(AC.sampleRate*dur));
  const buf=AC.createBuffer(1,len,AC.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
  const src=AC.createBufferSource(); src.buffer=buf;
  const g=AC.createGain(); g.gain.value=vol;
  const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp||3000;
  src.connect(f); f.connect(g); g.connect(masterGain); src.start();
}
const sfx = {
  shoot:(p)=> tone(560*(p||1),0.055,'square',0.05,300*(p||1)),
  hit:  ()=> noiseHit(0.05,0.08,2600),
  boom: ()=> { noiseHit(0.22,0.2,900); tone(150,0.28,'sine',0.16,40); },
  pickup:()=> tone(rand(840,960),0.06,'sine',0.055,1350),
  buy:  ()=> { tone(523,0.09,'triangle',0.12); setTimeout(()=>tone(784,0.14,'triangle',0.12),90); },
  hurt: ()=> { tone(200,0.16,'sawtooth',0.15,70); noiseHit(0.1,0.11,1200); },
  wave: ()=> { [523,659,784,1046].forEach((f,i)=> setTimeout(()=>tone(f,0.12,'triangle',0.09),i*90)); },
  combine:()=> { [660,880,1320].forEach((f,i)=> setTimeout(()=>tone(f,0.1,'square',0.06),i*70)); },
  click:()=> tone(400,0.03,'square',0.05),
  bossroar:()=> { tone(90,0.6,'sawtooth',0.2,45); noiseHit(0.5,0.16,500); },
  spring:()=> tone(190,0.14,'sine',0.12,640),
  munch:()=> { tone(160,0.07,'triangle',0.12); setTimeout(()=>tone(130,0.09,'triangle',0.12),80); },
  beep:()=> tone(980,0.05,'square',0.05),
  tink:()=> { tone(1500,0.04,'square',0.035); },
  dashw:()=> tone(300,0.1,'sawtooth',0.045,900),
  sizzle:()=> noiseHit(0.3,0.05,1600),
  drop:()=> tone(1200,0.5,'sine',0.045,300),
  elite:()=> { tone(220,0.25,'sawtooth',0.1,110); setTimeout(()=>tone(180,0.3,'sawtooth',0.1,90),180); },
  mow:()=> tone(rand(68,84),0.07,'sawtooth',0.06,55),
};
const BASSLINE=[110,0,110,0,164.8,0,146.8,130.8, 110,0,110,164.8,0,196,0,146.8];
function startMusic(){
  if(musicTimer||!AC) return;
  musicTimer=setInterval(()=>{
    if(muted||!AC) return;
    const f=BASSLINE[musicStep%BASSLINE.length];
    if(f) tone(f,0.16,'triangle',0.03);
    if(musicStep%2===0) noiseHit(0.015,0.01,7000);
    musicStep++;
  },140);
}
function toggleMute(){
  muted=!muted; toast(muted?'Muted':'Sound on');
  document.getElementById('mutebtn').textContent = muted?'🔇':'🔊';
}

