/* DAD vs THE MACHINES: the shared neighborhood leaderboard (Supabase REST).
   The anon key below is a public client key by design; the database only
   allows reading scores and inserting rows that pass its sanity checks.
   Everything degrades gracefully offline: the local record book always works. */
const BOARD_URL='https://oxxgbbkzpbgjtdjjhzsi.supabase.co/rest/v1/dvm_scores';
const BOARD_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eGdiYmt6cGJnanRkampoenNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MDE3MDksImV4cCI6MjA4NjA3NzcwOX0.C4JWjrV8SMTiIZsV8G9vnQVPaaguYc0RMyNeV-7TV7k';
function boardHeaders(){
  return { 'apikey':BOARD_KEY, 'Authorization':'Bearer '+BOARD_KEY, 'Content-Type':'application/json' };
}
function submitGlobalScore(entry){
  try{
    return fetch(BOARD_URL, {
      method:'POST',
      headers:Object.assign({'Prefer':'return=minimal'}, boardHeaders()),
      body:JSON.stringify(entry),
    }).then(r=>r.ok).catch(()=>false);
  }catch(e){ return Promise.resolve(false); }
}
function fetchGlobalScores(limit){
  try{
    return fetch(BOARD_URL+'?select=name,score,wave,champ,diff,coop&order=score.desc&limit='+(limit||10), {
      headers:boardHeaders(),
    }).then(r=> r.ok ? r.json() : null).catch(()=>null);
  }catch(e){ return Promise.resolve(null); }
}
