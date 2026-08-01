/* DAD vs THE MACHINES: sprite loader (Phase 2 pipeline).
   Drop PNGs into assets/ (256x256 entities, 512x512 bosses and props,
   transparent background) and they replace the vector art automatically.
   Anything missing keeps the vector fallback, so art can land one file
   at a time. See PROJECT_BRIEF.md Phase 2 for the generation prompts. */
const SPRITES={};
(function loadSprites(){
  const names=['dad','mower','gnome',
    'chat','roomba','beta','drone','zap','swarm','medic','split',
    'tank','firewall','groomba','printer','mother','algo','boss'];
  for(const n of names){
    const img=new Image();
    img.onload=()=>{ SPRITES[n]=img; };
    img.onerror=()=>{}; /* missing file: vector fallback stays */
    img.src='assets/'+n+'.png';
  }
})();
function sprite(n){ return SPRITES[n]||null; }
