/* DAD vs THE MACHINES: sprite loader (Phase 2 pipeline).
   Drop PNGs into assets/ (256x256 entities, 512x512 bosses and props,
   transparent background) and they replace the vector art automatically.
   Anything missing keeps the vector fallback, so art can land one file
   at a time. See PROJECT_BRIEF.md Phase 2 for the generation prompts. */
const SPRITES={};
(function loadSprites(){
  const names=[
    /* the neighbors (dad.png is the fallback body) */
    'dad','karen','coach','itdad','grill','coupon','yoga','ned','hank','brenda','gus',
    'mower','gnome',
    /* the machines */
    'chat','roomba','beta','drone','zap','swarm','medic','split',
    'tank','firewall','scoot','thermo','frido',
    'groomba','printer','mother','vend','courier',
    'algo','subs','cloud','boss',
    /* yard props. bbq is the grill PROP ("grill" is Grill Dad's sprite).
       flamingo and tramp draw live; the rest bake into the floor */
    'bbq','shed','pool','car','tramp','flamingo'];
  const baked=['bbq','shed','pool','car'];
  for(const n of names){
    const img=new Image();
    img.onload=()=>{
      SPRITES[n]=img;
      /* baked props need the floor re-rendered once their art lands */
      if(baked.includes(n) && typeof buildFloor==='function' && typeof FLOOR!=='undefined')
        FLOOR=buildFloor();
    };
    img.onerror=()=>{}; /* missing file: vector fallback stays */
    img.src='assets/'+n+'.png';
  }
})();
function sprite(n){ return SPRITES[n]||null; }
