/* ---------- boot ---------- */
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function ready(){
  effects.length=0;busy=false;veil(false);hideInfo();chronDirty=true;
  if(+S.history>0){
    let best=null,bp=-1;
    for(const k of kingdoms){if(!k.alive||!k.villages.length)continue;const p=kPop(k);if(p>bp){bp=p;best=k;}}
    if(best)centerOn(best.villages[0].x,best.villages[0].y);
  }
  for(let n=0;n<grid.length;n++)grid[n].length=0;
  counts.fill(0);for(const u of units)counts[u.t]++;
  hud();
}
function presim(ticks){
  quiet=true;let left=ticks;const total=Math.round(ticks/YEAR);
  $('veilTitle').textContent='Writing history';
  (function chunk(){
    const t0=now();
    while(left>0&&now()-t0<45){step();left--;}
    $('veilText').textContent='Year '+yearNow()+' of '+total;
    if(left>0)setTimeout(chunk,0);else{quiet=false;ready();}
  })();
}
function startWorld(){
  const st=seedText.trim().toLowerCase();
  const seed=st?hashStr(st):(Math.random()*2147483647)|0;
  busy=true;veil(true,'Shaping the world','Raising mountains and filling seas');
  setTimeout(()=>{
    natureFromSettings();
    genWorld(seed,{size:S.size,land:S.land,climate:S.climate,peoples:S.peoples,wild:S.wild});
    resize();cam.z=clampZ(Math.max(6,minZ*1.9));
    if(startSpot)centerOn(startSpot.x,startSpot.y);else centerOn(W/2,H/2);
    mini.hidden=!S.minimap;
    const yrs=+S.history||0;
    if(yrs>0)presim(yrs*YEAR);else ready();
  },40);
}
let last=0,acc=0;
function frame(t){
  const dt=Math.min(100,t-last||0);last=t;
  if(!busy){
    if(speed>0){
      acc+=dt*speed;let n=0;
      while(acc>=TICKMS&&n<10){step();acc-=TICKMS;n++;}
      if(n===10)acc=0;
    }
    holdBrush();
    updCamera(dt,acc/TICKMS);
    updDay(dt,speed>0);
    if(typeof AU!=='undefined'&&S.sound)AU.update(dt);
    if(G)G.frame(dt,speed>0,acc/TICKMS);else render(dt,speed>0);
    tickEffects();
    if(frameNo%15===0)hud();
  }
  requestAnimationFrame(frame);
}
initGfx();resize();buildTabs();buildTools(true);bootStart();
/* offer to continue the last world if this browser kept one */
function bootStart(){
  let done=false;const go=f=>{if(!done){done=true;f();}};
  setTimeout(()=>go(startWorld),1800);
  if(!S.autosave){go(startWorld);return;}
  saveGet('auto').then(rec=>{
    if(!rec||!rec.meta||!rec.data||rec.data.v!==SAVE_V){go(startWorld);return;}
    go(()=>{
      veil(true,'Tiny Dominion','Your world is waiting: year '+rec.meta.year+(rec.meta.era?', '+rec.meta.era:'')+', '+fmtPop(rec.meta.pop)+' people.');
      $('veilBtns').hidden=false;
      $('vCont').onclick=()=>{$('veilBtns').hidden=true;loadWorld('auto');};
      $('vNew').onclick=()=>{$('veilBtns').hidden=true;startWorld();};
      $('vCont').focus();
    });
  }).catch(()=>go(startWorld));
}
toast('Shape the land, settle a people, and watch them rise from huts to starships. Pinch or scroll to zoom.');
window.__td={step,S,get busy(){return busy;},cam,centerOn,openSheet,closeSheet,erupt,blast,spawn,
  get s(){return{W,H,units,vById,kingdoms,wars,boats,counts,chronicle,tick,twisters,wonderOf,planes,history,effects};},
  setDay(v){dayClock=v;},
  dbg(){const c=new Array(RES.length).fill(0);for(const i of deposits)c[ore[i]]++;let ice=0;for(let i=0;i<N;i++)if(tile[i]===ICE)ice++;return{dep:c,ice,ice0,SL,seaGoal,gWarm,carbon,melt};},
  dbg4(){const out=[];for(const i of deposits){if(!oreWorked(i))continue;const x=i%W,y=(i/W)|0;let b=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(inB(x+dx,y+dy)&&bmap[(y+dy)*W+x+dx])b++;out.push({x,y,r:ore[i],b});}out.sort((p,q)=>p.b-q.b);const seen={},res=[];for(const o of out)if(!seen[o.r]){seen[o.r]=1;res.push(o);}return res;},
  dbg3(){const out=[],seen={};for(const i of deposits){const r=ore[i];const key=r+(oreWorked(i)?'w':'');if(seen[key])continue;seen[key]=1;out.push({x:i%W,y:(i/W)|0,r,w:oreWorked(i),t:tile[i]});}return out.sort((a,b)=>b.w-a.w);},
  dbg2(){let best=null,bn=0;for(const i of deposits){const x=i%W,y=(i/W)|0;let n=0;for(const j of deposits){const dx=j%W-x,dy=((j/W)|0)-y;if(dx*dx+dy*dy<64)n++;}if(n>bn){bn=n;best={x,y};}}return best;},
  climate:{get carbon(){return carbon;},set uw(v){setGodWarm(v);},melt:()=>meltCaps(),kick:n=>climateKick(n),text:()=>climateText(),get seaBase(){return seaBase;},set seaBase(v){seaBase=v;}},whisper(k,kind){return whisper(k,kind);},get G(){return G;},
  /* test hook: use any tool at a tile, as a tap or one brush stamp */
  use(id,x,y){let t=null;for(const c of CATS)for(const o of c.tools)if(o.id===id)t=o;if(!t)return false;
    if(t.mode==='brush')applyBrush(x,y,t);else if(t.mode==='spawn')spawnBrush(x,y,t.type);
    else{const keep=tool;tool=t;tapAt({x:(x+.5-cam.x)*cam.z,y:(y+.5-cam.y)*cam.z});tool=keep;}return true;},
  setBrush(n){brush=n;},save:saveWorld,load:loadWorld,switchGfx,setWatch,view3d:setView3d,v3(o){Object.assign(V3,o);}};
requestAnimationFrame(frame);
