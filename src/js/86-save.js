/* ================= saving and loading worlds (IndexedDB, this browser only) ================= */
const SAVE_V=1;
let idbP=null;
function idb(){
  if(idbP)return idbP;
  idbP=new Promise((res,rej)=>{
    try{
      const rq=indexedDB.open('tinydominion',1);
      rq.onupgradeneeded=()=>{rq.result.createObjectStore('worlds');};
      rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);
    }catch(e){rej(e);}
  });
  idbP.catch(()=>{});
  return idbP;
}
function idbDo(mode,fn){
  return idb().then(db=>new Promise((res,rej)=>{
    const tx=db.transaction('worlds',mode),st=tx.objectStore('worlds');
    const rq=fn(st);tx.oncomplete=()=>res(rq&&rq.result);tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);
  }));
}
const saveGet=key=>idbDo('readonly',st=>st.get(key));
const savePut=(key,val)=>idbDo('readwrite',st=>st.put(val,key));
const saveMetaAll=()=>idbDo('readonly',st=>st.getAll()).then(()=>Promise.all(['auto','slot1','slot2','slot3'].map(k=>saveGet(k).then(v=>[k,v&&v.meta]))));

/* ---------- world -> plain data ---------- */
function snapshot(){
  const kid=k=>k?k.id:0,vid=v=>v?v.id:0;
  const grps=new Map();
  const grpRef=g=>{if(!g)return null;if(!grps.has(g))grps.set(g,{n:grps.size,x:g.x,y:g.y,from:vid(g.from)});return grps.get(g).n;};
  const unitOut=u=>({id:u.id,t:u.t,x:u.x,y:u.y,hp:u.hp,age:u.age,life:u.life,k:kid(u.k),v:vid(u.v),hunger:u.hunger,soldier:u.soldier,
    settle:u.settle?{x:u.settle.x,y:u.settle.y,t:u.settle.t,found:u.settle.found,grp:grpRef(u.settle.grp)}:null,
    tgt:u.tgt,sick:u.sick,immune:u.immune,ox:u.ox,oy:u.oy,dir:u.dir,home:vid(u.home),dest:vid(u.dest),cargo:u.cargo||0,back:!!u.back,trail:u.trail||null});
  const ks=kingdoms.map(k=>({id:k.id,name:k.name,race:k.race,color:k.color,villages:k.villages.map(vid),alive:k.alive,gold:k.gold,lore:k.lore,age:k.age,tech:k.tech,
    focus:k.focus,focusUntil:k.focusUntil,restUntil:k.restUntil,ruler:{name:k.ruler.name,title:k.ruler.title,trait:k.ruler.trait.id,tm:k.ruler.tm||null,since:k.ruler.since,until:k.ruler.until},
    wars:[...k.wars].map(kid),allies:[...k.allies].map(kid),target:vid(k.target),port:vid(k.port),landing:k.landing,rally:vid(k.rally),rallyUntil:k.rallyUntil,
    pauseUntil:k.pauseUntil,boatCd:k.boatCd,broke:k.broke,born:k.born,launches:k.launches,colony:k.colony,peak:k.peak,hist:k.hist,pad:k.pad?vid(k.pad.v):0,
    mem:k.mem||{},rep:repOf(k),goal:k.goal?{type:k.goal.type,o:kid(k.goal.o),why:k.goal.why,s:k.goal.s,since:k.goal.since}:null,weary:k.weary||0,
    pacts:k.pacts||[],kin:k.kin||[],nudge:k.nudge||null,mind:k.mind||null,heard:k.heard||0,cool:k.cool||{},reigns:k.reigns||null}));
  const vs=[];
  for(let n=1;n<vById.length;n++){
    const v=vById[n];
    vs.push({id:v.id,name:v.name,k:kid(v.k),race:v.race,x:v.x,y:v.y,alive:v.alive,pop:v.pop,cap:v.cap,res:v.res,rad:v.rad,treeFood:v.treeFood,born:v.born,empty:v.empty,
      noDock:v.noDock,noMine:v.noMine,noBig:v.noBig,noLight:v.noLight,heads:v.heads,ring:v.ring,ringAt:v.ringAt,ringR:v.ringR,walled:v.walled,
      blds:v.blds.map(b=>[b.kind,b.x,b.y,b.hp,b.fert,b.wi,b.grove?1:0,b.prog,b.rate||0,b.wid||''])});
  }
  const us=[];for(const u of units)if(!u.dead)us.push(unitOut(u));
  const bs=boats.filter(b=>!b.dead).map(b=>({k:kid(b.k),path:b.path,pi:b.pi,x:b.x,y:b.y,cargo:b.cargo.map(unitOut),mode:b.mode,land:b.land,dir:b.dir,to:kid(b.to),cargoGold:b.cargoGold||0}));
  const wo={};for(const id in wonderOf){const b=wonderOf[id];wo[id]=[b.v.id,b.v.blds.indexOf(b)];}
  const ft={};for(const n in firstTech)ft[n]=kid(firstTech[n]);
  return{v:SAVE_V,W,H,size:S.size,tick,uid,kc,SL,seaGoal,launches,dayClock,capMul,
    tile:tile.slice(),soil:soil.slice(),elev:elev.slice(),fire:fire.slice(),road:road.slice(),vown:vown.slice(),temp:temp.slice(),moist:moist.slice(),
    kingdoms:ks,villages:vs,units:us,boats:bs,grps:[...grps.values()],
    wars:wars.map(w=>({a:kid(w.a),b:kid(w.b),start:w.start,sa:w.sa,sb:w.sb})),
    rel:[...relM.entries()],truce:[...truM.entries()],chronicle:chronicle.slice(-300),history:history.slice(),
    wonderOf:wo,firstTech:ft,sched:sched.map(e=>Object.assign({},e,{k:e.k?kid(e.k):0})),
    twisters:twisters.slice(),storms:storms.slice(),planes:planes.map(p=>Object.assign({},p,{k:kid(p.k)}))};
}
/* ---------- plain data -> world ---------- */
function restore(d){
  alloc(d.W,d.H);
  tile.set(d.tile);soil.set(d.soil);elev.set(d.elev);fire.set(d.fire);road.set(d.road);vown.set(d.vown);temp.set(d.temp);moist.set(d.moist);
  units=[];vById=[null];kingdoms=[];wars=[];boats=[];twisters=d.twisters||[];towers=[];fireList=[];effects=[];sched=[];chronicle=d.chronicle||[];bubbles=[];risen=[];
  planes=[];raising=[];history=d.history||[];wonderOf={};firstTech={};storms=d.storms||[];
  relM.clear();truM.clear();counts.fill(0);dirtyWalk=[];dirtyOver=true;chronDirty=true;lastEvent=null;
  tick=d.tick;uid=d.uid;kc=d.kc;SL=d.SL;seaGoal=d.seaGoal;launches=d.launches||0;dayClock=d.dayClock||18;capMul=d.capMul||1;
  const K=id=>id?kingdoms[id-1]:null,V=id=>id?vById[id]:null;
  for(const o of d.kingdoms){
    const k={id:o.id,name:o.name,race:o.race,color:o.color,rgb:hexRgb(o.color),villages:[],alive:o.alive,gold:o.gold,lore:o.lore,age:o.age,tech:o.tech||0,pow:1,pop:0,str:0,
      focus:o.focus,focusUntil:o.focusUntil,restUntil:o.restUntil,ruler:{name:o.ruler.name,title:o.ruler.title,trait:TRAITS.find(t=>t.id===o.ruler.trait)||TRAITS[0],tm:o.ruler.tm||null,since:o.ruler.since,until:o.ruler.until},
      wars:new Set(),allies:new Set(),nb:[],regs:new Set(),target:null,port:null,landing:o.landing,rally:null,rallyUntil:o.rallyUntil,pauseUntil:o.pauseUntil,boatCd:o.boatCd,
      nAdult:0,nSold:0,nBarr:0,nCar:0,nSiege:0,broke:o.broke,born:o.born,launches:o.launches||0,colony:!!o.colony,peak:o.peak||0,hist:o.hist||[],pad:null,
      mem:o.mem||{},rep:o.rep===undefined?50:o.rep,goal:null,weary:o.weary||0,pacts:o.pacts||[],kin:o.kin||[],nudge:o.nudge||null,mind:o.mind||null,heard:o.heard||0,cool:o.cool||{},reigns:o.reigns||null};
    kingdoms.push(k);
  }
  for(const o of d.villages){
    const v={id:o.id,name:o.name,k:K(o.k),race:o.race,x:o.x,y:o.y,blds:[],pop:0,cap:o.cap,res:o.res,rad:o.rad,food:4,treeFood:o.treeFood,
      houses:0,farms:0,towers:0,mines:0,factories:0,walls:0,market:null,barracks:null,temple:null,academy:null,dock:null,
      alive:o.alive,born:o.born,empty:o.empty,flow:null,flowStamp:-1,noDock:o.noDock,noMine:o.noMine,noBig:o.noBig||0,noLight:o.noLight||0,
      heads:o.heads,ring:o.ring,ringAt:o.ringAt||0,ringR:o.ringR,walled:!!o.walled};
    vById.push(v);
  }
  for(const o of d.kingdoms){
    const k=K(o.id);
    k.villages=o.villages.map(V).filter(Boolean);
    for(const id of o.wars)if(K(id))k.wars.add(K(id));
    for(const id of o.allies)if(K(id))k.allies.add(K(id));
    k.target=V(o.target);k.port=V(o.port);k.rally=V(o.rally);
    if(o.goal)k.goal={type:o.goal.type,o:K(o.goal.o),why:o.goal.why||'',s:o.goal.s||0,since:o.goal.since||tick};
  }
  for(const o of d.villages){
    const v=V(o.id);if(!v.alive)continue;
    for(const a of o.blds){
      const[kind,x,y,hp,fert,wi,grove,prog,rate,wid]=a,big=BIG[kind]?2:1,i=y*W+x;
      const b={kind,x,y,i,v,hp,solid:kind!=='farm'&&kind!=='dock'&&kind!=='mine',fert,wi,grove:!!grove,cd:0,big,prog,tiles:[]};
      if(rate)b.rate=rate;if(wid)b.wid=wid;
      for(let dy=0;dy<big;dy++)for(let dx=0;dx<big;dx++){const j=(y+dy)*W+x+dx;b.tiles.push(j);bmap[j]=b;}
      v.blds.push(b);
      if(kind==='tower')towers.push(b);
      if(prog<1)raising.push(b);
    }
    recalc(v);
  }
  for(const k of kingdoms){const o=d.kingdoms[k.id-1];if(o.pad){const v=V(o.pad);if(v&&v.pad)k.pad=v.pad;}updPow(k);}
  for(const id in d.wonderOf){const[vi,bi]=d.wonderOf[id],v=V(vi);if(v&&v.blds[bi])wonderOf[id]=v.blds[bi];}
  for(const n in d.firstTech)firstTech[n]=K(d.firstTech[n]);
  const grps=(d.grps||[]).map(g=>({x:g.x,y:g.y,from:V(g.from),flow:null,flowStamp:-1}));
  const unitIn=o=>{
    const u={id:o.id,t:o.t,x:o.x,y:o.y,hp:o.hp,age:o.age,life:o.life,k:K(o.k),v:V(o.v),hunger:o.hunger,cd:0,foe:null,soldier:o.soldier,
      settle:o.settle?{x:o.settle.x,y:o.settle.y,t:o.settle.t,found:o.settle.found,grp:o.settle.grp===null?null:grps[o.settle.grp]||null}:null,
      tgt:o.tgt,dead:false,stowed:false,sick:o.sick,immune:o.immune,detour:0,ox:o.ox,oy:o.oy,dir:o.dir};
    if(o.home)u.home=V(o.home);if(o.dest)u.dest=V(o.dest);if(o.cargo)u.cargo=o.cargo;if(o.back)u.back=true;if(o.trail)u.trail=o.trail;
    return u;
  };
  for(const o of d.units)units.push(unitIn(o));
  for(const o of d.boats){
    const b={k:K(o.k),path:o.path,pi:o.pi,x:o.x,y:o.y,cargo:o.cargo.map(unitIn),mode:o.mode,land:o.land,dir:o.dir,dead:false};
    for(const u of b.cargo)u.stowed=true;
    if(o.to)b.to=K(o.to);if(o.cargoGold)b.cargoGold=o.cargoGold;
    if(b.k)boats.push(b);
  }
  for(const w of d.wars){const a=K(w.a),b=K(w.b);if(a&&b)wars.push({a,b,start:w.start,sa:w.sa,sb:w.sb});}
  for(const[key,val]of d.rel)relM.set(key,val);
  for(const[key,val]of d.truce)truM.set(key,val);
  for(const e of d.sched||[]){const k=e.k?K(e.k):null;sched.push(Object.assign({},e,{k}));}
  for(const p of d.planes||[]){const k=K(p.k);if(k)planes.push(Object.assign({},p,{k}));}
  for(let i=0;i<N;i++)if(fire[i])fireList.push(i);
  for(const u of units){counts[u.t]++;if(u.v)u.v.pop++;}
  for(const k of kingdoms)if(k.alive)k.pop=kPop(k);
  regionsDirty=true;computeRegions();recolorAll();dirtyAll=true;sweepY=0;
  startSpot=null;
  worldAge=-1;for(const k of kingdoms)if(k.alive&&k.age>worldAge)worldAge=k.age;colonyEver=kingdoms.some(k=>k.colony);
}
/* ---------- the menu ---------- */
let saveOK=true,autoTimer=0;
function worldMeta(){
  let pop=0,best=-1,realms=0;for(const k of kingdoms)if(k.alive){pop+=kCitizens(k);realms++;if(k.age>best)best=k.age;}
  return{year:yearNow(),pop,realms,era:best<0?'':AGE_NAME[best],date:Date.now(),size:S.size};
}
function saveWorld(key,quietly){
  if(!saveOK||busy||!W)return Promise.resolve(false);
  let data;try{data=snapshot();}catch(e){console.warn(e);if(!quietly)toast('This world could not be saved.');return Promise.resolve(false);}
  return savePut(key,{meta:worldMeta(),data}).then(()=>{if(!quietly)toast(key==='auto'?'World saved.':'World saved to slot '+key.slice(4)+'.');return true;})
    .catch(e=>{console.warn(e);if(!quietly)toast('Saving is not available in this browser.');saveOK=false;return false;});
}
function loadWorld(key){
  return saveGet(key).then(rec=>{
    if(!rec||!rec.data||rec.data.v!==SAVE_V){toast('That save could not be read.');return false;}
    busy=true;veil(true,'Returning to your world','Year '+rec.meta.year);
    return new Promise(res=>setTimeout(()=>{
      try{
        restore(rec.data);if(rec.meta.size)S.size=rec.meta.size;
        resize();cam.z=clampZ(Math.max(7,minZ*2));
        let best=null;for(const k of kingdoms)if(k.alive&&k.villages.length&&(!best||kPop(k)>kPop(best)))best=k;
        if(best)centerOn(best.villages[0].x,best.villages[0].y);else centerOn(W/2,H/2);
        mini.hidden=!S.minimap;
        ready();toast('Welcome back. It is year '+yearNow()+'.');res(true);
      }catch(e){console.warn(e);toast('That save could not be loaded.');busy=false;veil(false);res(false);startWorld();}
    },40));
  }).catch(()=>{toast('Saved worlds are not available in this browser.');return false;});
}
function autosave(){if(S.autosave&&!busy&&W&&tick>YEAR*2)saveWorld('auto',true);}
setInterval(autosave,150000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')autosave();});
function savesHtml(cb){
  saveMetaAll().then(list=>{
    const fmt=m=>m?'Year '+m.year+(m.era?', '+m.era:'')+', '+fmtPop(m.pop)+' people':'Empty';
    cb(list.map(([key,m])=>'<div class="row"><span><b>'+(key==='auto'?'Autosave':'Slot '+key.slice(4))+'</b><br><small class="fine">'+fmt(m)+'</small></span><div class="opts">'+
      (key==='auto'?'':'<button data-save="'+key+'">Save</button>')+(m?'<button data-load="'+key+'">Load</button>':'')+'</div></div>').join(''));
  }).catch(()=>cb('<p class="fine">Saving worlds is not available in this browser.</p>'));
}
