/* ================= rulers, diplomacy and war ================= */
const pk=(a,b)=>a.id<b.id?a.id*8192+b.id:b.id*8192+a.id;
function baseRel(a,b){
  let r=AFF[a.race][b.race]*60;
  const ta=a.ruler.trait.id,tb=b.ruler.trait.id;
  if(a.race!==b.race){if(ta==='zealot')r-=22;if(tb==='zealot')r-=22;}
  if(ta==='merchant')r+=10;if(tb==='merchant')r+=10;
  if(ta==='conqueror')r-=8;if(tb==='conqueror')r-=8;
  return r;
}
function rel(a,b){const v=relM.get(pk(a,b));return v===undefined?baseRel(a,b):v;}
function setRel(a,b,v){relM.set(pk(a,b),Math.max(-100,Math.min(100,v)));}
function relWord(r){return r<-55?'hatred':r<-25?'hostile':r<-8?'wary':r<15?'neutral':r<45?'cordial':'friendly';}
function inTruce(a,b){const t=truM.get(pk(a,b));return t!==undefined&&tick<t;}
function warOf(a,b){for(const w of wars)if((w.a===a&&w.b===b)||(w.a===b&&w.b===a))return w;return null;}
function warScore(a,b){const w=warOf(a,b);if(w){if(w.a===a)w.sa++;else w.sb++;}remember(b,a,.2,0,'');}
function nearestVillageOf(k,x,y){
  let best=null,bd=1e9;
  for(const v of k.villages){const d=(v.x-x)*(v.x-x)+(v.y-y)*(v.y-y);if(d<bd){bd=d;best=v;}}
  return best;
}
function sameLand(a,b){for(const r of a.regs)if(b.regs.has(r))return true;return false;}
function hasDock(k){for(const v of k.villages)if(v.dock)return true;return false;}
function bubble(k,text){
  if(quiet||!k.villages.length)return;
  for(let n=bubbles.length-1;n>=0;n--)if(bubbles[n].k===k)bubbles.splice(n,1);
  bubbles.push({k,text:String(text).slice(0,90),until:now()+9000});
  if(bubbles.length>8)bubbles.shift();
}
function chron(text,type,at,hush){
  const e={y:yearNow(),text,type:type||''};
  if(at){if(at.villages)at=at.villages[0];if(at&&at.x!==undefined){e.x=at.x;e.y2=at.y;}}
  chronicle.push(e);
  if(e.x!==undefined)lastEvent={x:e.x,y:e.y2,t:now(),type:e.type};
  if(chronicle.length>300)chronicle.shift();
  chronDirty=true;
  if(!quiet&&!hush&&(type!=='found'||tick<25*YEAR))toast(text,type);
}
function pickTarget(k){
  k.target=null;k.port=null;k.landing=null;
  if(!k.wars.size||!k.villages.length||tick<k.pauseUntil)return;
  let best=null,bs=1e9,sea=null,ss=1e9;
  for(const e of k.wars){
    for(const tv of e.villages){
      const treg=region[tv.y*W+tv.x];let od=1e9,any=1e9;
      for(const o of k.villages){
        const d=Math.sqrt((o.x-tv.x)*(o.x-tv.x)+(o.y-tv.y)*(o.y-tv.y));
        if(d<any)any=d;
        if(region[o.y*W+o.x]===treg&&d<od)od=d;
      }
      if(od<130){const sc=od*(.5+tv.pop/40);if(sc<bs){bs=sc;best=tv;}}
      else if(k.age>=1&&any<280){const sc=any*(.5+tv.pop/40);if(sc<ss){ss=sc;sea=tv;}}
    }
  }
  if(best){k.target=best;return;}
  if(!sea)return;
  let port=null,pd=1e9;
  for(const v of k.villages){if(!v.dock)continue;const d=d2(v,sea);if(d<pd){pd=d;port=v;}}
  if(!port)return;
  const land=findLanding(sea,wreg[port.dock.wi]);
  if(!land)return;
  k.target=sea;k.port=port;k.landing=land;
}
function declareWar(a,b,why,joining){
  if(a===b||!a.alive||!b.alive||a.wars.has(b))return false;
  const truce=inTruce(a,b);
  if(a.allies.has(b)){
    a.allies.delete(b);b.allies.delete(a);a.rep=repOf(a)-25;remember(b,a,60,0,'betrayed our alliance');
    chron(a.name+' betrays its alliance with '+b.name,'war');
  }else remember(b,a,truce?40:25,0,truce?'broke the truce':'declared war on us');
  if(truce)a.rep=repOf(a)-20;
  if(a.pacts){a.pacts=a.pacts.filter(id=>id!==b.id);}if(b.pacts){b.pacts=b.pacts.filter(id=>id!==a.id);}
  a.wars.add(b);b.wars.add(a);wars.push({a,b,start:tick,sa:0,sb:0});
  truM.delete(pk(a,b));setRel(a,b,Math.min(rel(a,b),-60));
  chron(why||(rulerName(a)+' of '+a.name+' declares war on '+b.name),'war',nearestVillageOf(b,a.villages[0]?a.villages[0].x:0,a.villages[0]?a.villages[0].y:0)||b);
  a.focus='army';b.focus='army';
  {const c=b.villages[0];snd('horn',c?c.x:undefined,c?c.y:undefined,.9);}
  pickTarget(a);pickTarget(b);
  if(!joining){
    /* each ally weighs the call for itself: honour, debts and old hatreds against fear and weariness */
    for(const al of[...b.allies]){
      if(al===a||!al.alive||al.wars.has(a)||al.allies.has(a)||!canReach(al,a))continue;
      if(answerCall(al,b,a,false)){declareWar(al,a,al.name+' honours its alliance with '+b.name+' and joins the war',true);remember(b,al,0,25,'stood by us in war');}
      else{remember(b,al,22,0,'abandoned us in war');al.rep=repOf(al)-8;setRel(b,al,rel(b,al)-25);chron(al.name+' leaves its ally '+b.name+' to fight alone','ruin',b);}
    }
    for(const al of[...a.allies]){
      if(al===b||!al.alive||al.wars.has(b)||al.allies.has(b)||!canReach(al,b))continue;
      if(answerCall(al,a,b,true)){declareWar(al,b,al.name+' joins '+a.name+' against '+b.name,true);remember(a,al,0,15,'fought at our side');}
    }
  }
  return true;
}
function makePeace(a,b,quietly){
  if(!a.wars.has(b))return;
  const w=warOf(a,b),yrs=w?Math.max(1,Math.round((tick-w.start)/YEAR)):1;
  a.wars.delete(b);b.wars.delete(a);
  const n=wars.indexOf(w);if(n>=0)wars.splice(n,1);
  truM.set(pk(a,b),tick+((12+Math.random()*10)*YEAR|0));
  setRel(a,b,Math.max(rel(a,b),-25));
  for(const k of[a,b]){
    if(!k.wars.size){standDown(k);k.restUntil=tick+((4+Math.random()*6)*YEAR|0);if(tick>k.focusUntil)k.focus=k.ruler.trait.focus;}
    else pickTarget(k);
  }
  if(!quietly){const t=peaceTerms(a,b,w);chron('Peace between '+a.name+' and '+b.name+' after '+yrs+(yrs===1?' year':' years')+' of war'+(t?'. '+t:''),'peace',a);snd('peace');bubble(a,'Enough blood. Let there be peace.');}
}
function makeAlliance(a,b){
  if(a===b||a.allies.has(b)||a.wars.has(b))return false;
  a.allies.add(b);b.allies.add(a);setRel(a,b,Math.max(rel(a,b),50));
  chron(a.name+' and '+b.name+' swear an alliance','peace');bubble(a,'We stand together with '+b.name+'.');
  return true;
}
function secede(k,why){
  const cap=k.villages[0];let v=null,bd=-1;
  for(let n=1;n<k.villages.length;n++){const o=k.villages[n],d=d2(o,cap);if(d>bd){bd=d;v=o;}}
  if(!v)return;
  const nk=newKingdom(k.race,kingdoms.some(o=>o.alive&&o.name===v.name)?'Free '+v.name:v.name);
  k.villages.splice(k.villages.indexOf(v),1);v.k=nk;nk.villages.push(v);
  nk.age=k.age;nk.lore=k.lore*.8;nk.restUntil=tick+10*YEAR;nk.regs.add(region[v.y*W+v.x]);
  for(const u of units)if(u.v===v){u.k=nk;u.soldier=false;}
  truM.set(pk(k,nk),tick+8*YEAR);setRel(k,nk,-30);remember(k,nk,20,0,'broke away from us');
  dirtyAll=true;
  chron(v.name+' breaks away from '+k.name+(why?' '+why:'')+'. '+rulerName(nk)+' takes the crown','ruin');bubble(nk,'We bow to '+k.name+' no longer.');
}
const ROMAN=['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];
function succession(k){
  const old=rulerName(k),tr=k.ruler.trait;
  const tm=k.ruler.tm,base=k.ruler.name.replace(/ [IVX]+$/,'');
  k.ruler=newRuler(k.race,tr,tm);k.goal=null;k.nudge=null;
  /* a name already worn by this realm's rulers takes a regnal number */
  const reign=k.reigns||(k.reigns={});reign[base]=reign[base]||1;
  if(reign[k.ruler.name]){reign[k.ruler.name]++;k.ruler.name+=' '+ROMAN[Math.min(reign[k.ruler.name],ROMAN.length-1)];}
  else reign[k.ruler.name]=1;
  chron(old+' of '+k.name+' dies. '+rulerName(k)+' '+k.ruler.trait.adj+' takes the throne','ruler');bubble(k,'The crown passes to me.');
  for(const n of k.nb)if(n.k.alive)setRel(k,n.k,rel(k,n.k)+(Math.random()*30-15));
  if(tick>k.focusUntil)k.focus=k.wars.size?'army':k.ruler.trait.focus;
  if(k.villages.length>=4&&Math.random()<.25)secede(k,'in a dispute over the crown');
}
function rulersStep(){
  if(regionsDirty)computeRegions();
  const alive=kingdoms.filter(k=>k.alive);
  for(const k of alive){
    k.pop=kPop(k);k.str=k.pop*k.pow;k.nb=[];k.regs.clear();
    for(const v of k.villages)k.regs.add(region[v.y*W+v.x]);
  }
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
    const a=alive[i],b=alive[j];let bd=1e9;
    for(const va of a.villages)for(const vb of b.villages){const d=(va.x-vb.x)*(va.x-vb.x)+(va.y-vb.y)*(va.y-vb.y);if(d<bd)bd=d;}
    bd=Math.sqrt(bd);
    if(bd<150){
      a.nb.push({k:b,d:bd});b.nb.push({k:a,d:bd});
      let r=rel(a,b);
      r+=(baseRel(a,b)-r)*.05;
      if(a.wars.has(b))r-=2;else if(a.allies.has(b))r+=1.5;else if(bd<24)r-=.8*(MOOD[S.mood]||1);
      for(const e of a.wars)if(b.wars.has(e)){r+=2.5;break;}
      if(a.age>=1&&b.age>=1&&!a.wars.has(b)&&r>-20)r+=.5;
      setRel(a,b,r);
    }
  }
  for(const k of alive){
    if(!k.alive)continue;
    k.nb.sort((p,q)=>p.d-q.d);
    while(k.tech<TECH_LORE.length&&k.lore>=TECH_LORE[k.tech]){
      const nm=TECHS[(k.tech/3)|0][k.tech%3];
      if(!firstTech[nm]){firstTech[nm]=k;chron(k.name+' is the first realm to discover '+nm,'tech',k);snd('tech');}
      k.tech++;
    }
    if(k.age<AGES.length-1&&k.lore>=AGE_T[k.age]){
      const t0=TIER[k.age];
      k.age++;updPow(k);
      chron(k.name+' enters the '+AGE_NAME[k.age],'age',k);snd('fanfare',k.villages[0]?k.villages[0].x:undefined,k.villages[0]?k.villages[0].y:undefined,1);
      if(k.age>worldAge){worldAge=k.age;if(k.age>0)banner('A new age dawns','The '+AGE_NAME[k.age],k.name+' leads the world into it');}bubble(k,AGE_SAY[k.age]||'A new age dawns for '+k.name+'.');
      for(const v of k.villages){const h=v.blds[0];if(h&&h.kind==='hall')h.hp=hallHp(v);}
      if(TIER[k.age]!==t0)upgradeRoads(k);else dirtyAll=true;
    }
    spaceProgram(k);
    if(k.wars.size&&k.age>=7&&k.target&&k.target.alive&&k.gold>60&&Math.random()<.45)airRaid(k);
    if(!k.wars.size&&k.age>=2&&Math.random()<.18+(k.pacts?k.pacts.length*.1:0))tradeFleet(k);
    if(tick>k.ruler.until)succession(k);
    if(k.alive)rulerThink(k);
  }
  for(const w of wars.slice()){
    if(!w.a.alive||!w.b.alive||!w.a.wars.has(w.b))continue;
    const yrs=(tick-w.start)/YEAR;
    /* rulers make peace for their own reasons (see rulerThink); a generation of war exhausts everyone */
    if(yrs>30){const t=peaceTerms(w.a,w.b,w);makePeace(w.a,w.b,true);chron('Exhausted after '+Math.round(yrs)+' years, '+w.a.name+' and '+w.b.name+' lay down their arms'+(t?'. '+t:''),'peace',w.a);snd('peace');}
  }
  for(const k of alive){
    if(!k.alive||!k.wars.size)continue;
    const t=k.target;
    if(!t||!t.alive||t.k===k||!k.wars.has(t.k)||(k.landing&&!k.port.alive))pickTarget(k);
  }
  migrate();disasters();
  recordHistory();
}
let colonyEver=false;
const TECH_LORE=[];
for(let a=0;a<TECHS.length;a++){const t0=a?AGE_T[a-1]:0,t1=a<AGE_T.length?AGE_T[a]:STAR_LORE;for(let i=0;i<3;i++)TECH_LORE.push(t0+(t1-t0)*(i+1)/3);}
const AGE_SAY=['','Bronze tools for a bronze age!','Iron makes us strong.','Let us build in marble and think great thoughts.','Raise the castle walls!',
  'A rebirth of art and learning.','Steam and steel will change everything.','The modern world is ours.','Now we reach for the stars.'];
/* ---------- the space age: rockets, then a colony ship ---------- */
function spaceProgram(k){
  const pad=k.pad;
  if(!pad||pad.prog<1||bmap[pad.i]!==pad||pad.v.k!==k)return;
  if(Math.random()>.22)return;
  const colony=k.tech>=TECH_LORE.length&&!k.colony;
  k.launches++;launches++;
  effects.push({k:'rocket',x:pad.x+1,y:pad.y+1,t:420,T:420,team:k,colony});snd('rocket',pad.x+1,pad.y+1,1);
  if(colony){
    k.colony=true;
    chron(k.name+' launches a colony ship to the stars. A new chapter of history begins beyond the sky','age',pad.v);
    if(!colonyEver){colonyEver=true;banner('Beyond the sky','A colony ship departs',k.name+' carries its people to the stars');}
    bubble(k,'Farewell, little world. We go to the stars.');
  }else if(k.launches===1)chron(k.name+' launches the first rocket into the heavens','age',pad.v);
}
/* ---------- the modern age: bombers fly against the enemy ---------- */
function airRaid(k){
  const c=k.villages[0],t=k.target;if(!c)return;
  k.gold-=40;
  planes.push({k,x:c.x,y:c.y,tx:t.x,ty:t.y,hx:c.x,hy:c.y,state:0,bombs:4,dir:t.x>=c.x?1:-1,px:c.x,py:c.y});
}
function updPlanes(){
  let w=0;
  for(let n=0;n<planes.length;n++){
    const p=planes[n];p.px=p.x;p.py=p.y;
    const tx=p.state?p.hx:p.tx,ty=p.state?p.hy:p.ty,dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);
    if(d<1.2){
      if(!p.state){
        for(let m=0;m<p.bombs;m++)sched.push({t:tick+m*2+1,f:'bomb',x:Math.round(p.x+(Math.random()-.5)*5),y:Math.round(p.y+(Math.random()-.5)*5),k:p.k});
        p.state=1;p.dir=-p.dir;
      }else continue;
    }else{p.x+=dx/d*.8;p.y+=dy/d*.8;if(Math.abs(dx)>.3)p.dir=dx>0?1:-1;}
    if(p.k.alive)planes[w++]=p;
  }
  planes.length=w;
}
/* ---------- merchant fleets between friendly harbours ---------- */
function tradeFleet(k){
  let port=null;for(const v of k.villages)if(v.dock&&v.market){port=v;break;}
  if(!port)return;
  const wr=wreg[port.dock.wi];
  const cands=[];
  for(const n of k.nb){const o=n.k;if(!o.alive||k.wars.has(o)||(!k.allies.has(o)&&!hasPact(k,o)&&rel(k,o)<5))continue;for(const v of o.villages)if(v.dock&&wreg[v.dock.wi]===wr)cands.push(v);}
  for(const v of k.villages)if(v!==port&&v.dock&&wreg[v.dock.wi]===wr&&d2(v,port)>400)cands.push(v);
  if(!cands.length)return;
  const dest=pick(cands);
  const path=seaPath(port.dock.wi,dest.dock.wi);if(!path||path.length<12)return;
  launchBoat(k,path,[],'trade',{x:dest.dock.x,y:dest.dock.y});
  const b=boats[boats.length-1];b.to=dest.k;b.cargoGold=(8+path.length*.06)*(1+(TIER[k.age]||0)*.4)*(dest.k!==k?1.4:1);
}
/* ---------- a yearly record for the history chart ---------- */
function recordHistory(){
  const yr=yearNow();
  for(const k of kingdoms){
    if(!k.alive&&!k.hist.length)continue;
    const c=k.alive?kCitizens(k):0;
    if(c>k.peak)k.peak=c;
    if(k.alive||k.hist.length&&k.hist[k.hist.length-1][1]>0)k.hist.push([yr,c]);
    if(k.hist.length>1200)k.hist.splice(0,k.hist.length-1200);
  }
  let tot=0,best=0;for(const k of kingdoms)if(k.alive){tot+=kCitizens(k);if(k.age>best)best=k.age;}
  history.push([yr,tot,best]);if(history.length>3000)history.shift();
}

