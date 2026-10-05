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
function warScore(a,b){const w=warOf(a,b);if(w){if(w.a===a)w.sa++;else w.sb++;}}
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
function chron(text,type){
  chronicle.push({y:yearNow(),text,type:type||''});
  if(chronicle.length>300)chronicle.shift();
  chronDirty=true;
  if(!quiet&&(type!=='found'||tick<25*YEAR))toast(text,type);
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
function declareWar(a,b,why){
  if(a===b||!a.alive||!b.alive||a.wars.has(b))return false;
  if(a.allies.has(b)){a.allies.delete(b);b.allies.delete(a);chron(a.name+' betrays its alliance with '+b.name,'war');}
  a.wars.add(b);b.wars.add(a);wars.push({a,b,start:tick,sa:0,sb:0});
  truM.delete(pk(a,b));setRel(a,b,Math.min(rel(a,b),-60));
  chron(why||(rulerName(a)+' of '+a.name+' declares war on '+b.name),'war');
  if(!why){const tid=a.ruler.trait.id;bubble(a,tid==='conqueror'?'Their lands will be ours.':tid==='zealot'?'Drive the outsiders from our borders!':tid==='schemer'?'They will never see it coming.':'To arms! We march on '+b.name+'.');}
  a.focus='army';b.focus='army';
  pickTarget(a);pickTarget(b);
  if(!why){
    for(const al of[...b.allies])if(al!==a&&al.alive&&!al.wars.has(a)&&Math.random()<.75)declareWar(al,a,al.name+' honors its alliance with '+b.name+' and joins the war');
    for(const al of[...a.allies])if(al!==b&&al.alive&&!al.wars.has(b)&&Math.random()<.35)declareWar(al,b,al.name+' joins '+a.name+' against '+b.name);
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
  if(w&&Math.abs(w.sa-w.sb)>20){const win=w.sa>w.sb?w.a:w.b,lose=win===a?b:a,pay=lose.gold*.3;lose.gold-=pay;win.gold+=pay;}
  for(const k of[a,b]){
    if(!k.wars.size){standDown(k);k.restUntil=tick+((4+Math.random()*6)*YEAR|0);if(tick>k.focusUntil)k.focus=k.ruler.trait.focus;}
    else pickTarget(k);
  }
  if(!quietly){chron('Peace between '+a.name+' and '+b.name+' after '+yrs+(yrs===1?' year':' years')+' of war','peace');bubble(a,'Enough blood. Let there be peace.');}
}
function makeAlliance(a,b){
  if(a===b||a.allies.has(b)||a.wars.has(b))return false;
  a.allies.add(b);b.allies.add(a);setRel(a,b,Math.max(rel(a,b),50));
  chron(a.name+' and '+b.name+' swear an alliance','peace');bubble(a,'We stand together with '+b.name+'.');
  return true;
}
function willing(k,o,w,yrs){
  if(!w||yrs<2)return false;
  const diff=w.a===k?w.sa-w.sb:w.sb-w.sa,tr=k.ruler.trait;
  if(diff<-20)return true;
  if(diff>20&&o.villages.length<=1&&Math.random()<.5)return true;
  if(diff>20)return tr.aggr<1.2?yrs>3:(diff>60||yrs>12);
  return yrs>(tr.aggr<1?8:14);
}
function secede(k,why){
  const cap=k.villages[0];let v=null,bd=-1;
  for(let n=1;n<k.villages.length;n++){const o=k.villages[n],d=d2(o,cap);if(d>bd){bd=d;v=o;}}
  if(!v)return;
  const nk=newKingdom(k.race,v.name);
  k.villages.splice(k.villages.indexOf(v),1);v.k=nk;nk.villages.push(v);
  nk.age=k.age;nk.lore=k.lore*.8;nk.restUntil=tick+10*YEAR;nk.regs.add(region[v.y*W+v.x]);
  for(const u of units)if(u.v===v){u.k=nk;u.soldier=false;}
  truM.set(pk(k,nk),tick+8*YEAR);setRel(k,nk,-30);
  dirtyAll=true;
  chron(v.name+' breaks away from '+k.name+(why?' '+why:'')+'. '+rulerName(nk)+' takes the crown','ruin');bubble(nk,'We bow to '+k.name+' no longer.');
}
function succession(k){
  const old=rulerName(k),tr=k.ruler.trait;
  k.ruler=newRuler(k.race,tr);
  chron(old+' of '+k.name+' dies. '+rulerName(k)+' '+k.ruler.trait.adj+' takes the throne','ruler');bubble(k,'The crown passes to me.');
  for(const n of k.nb)if(n.k.alive)setRel(k,n.k,rel(k,n.k)+(Math.random()*30-15));
  if(tick>k.focusUntil)k.focus=k.wars.size?'army':k.ruler.trait.focus;
  if(k.villages.length>=4&&Math.random()<.25)secede(k,'in a dispute over the crown');
}
function think(k){
  const tr=k.ruler.trait,mood=MOOD[S.mood]||1;
  if(tick>k.focusUntil){
    k.focus=k.wars.size?'army':tr.focus;
    if(k.pop<25&&!k.wars.size)k.focus='grow';
  }
  if(k.pop<8)return;
  if(k.villages.length>=6&&!k.wars.size&&Math.random()<.03){secede(k,'');return;}
  for(const n of k.nb){
    const o=n.k;if(!o.alive)continue;
    const r=rel(k,o);
    if(k.allies.has(o)){
      if(r<-15){k.allies.delete(o);o.allies.delete(k);chron('The alliance of '+k.name+' and '+o.name+' falls apart','ruin');}
      continue;
    }
    if(!k.wars.has(o)&&r>34&&k.allies.size<2&&o.allies.size<2&&Math.random()<.12)makeAlliance(k,o);
  }
  if(!k.wars.size&&k.gold>320&&Math.random()<.08){
    k.gold-=160;for(const v of k.villages)v.res+=12;
    for(const n of k.nb)if(n.k.alive&&!k.wars.has(n.k))setRel(k,n.k,rel(k,n.k)+5);
    chron(k.name+' holds a grand festival','peace');
  }
  if(k.wars.size||tick<k.restUntil)return;
  let best=null,bp=0;const dock=k.age>=1&&hasDock(k);
  for(const n of k.nb){
    const o=n.k;if(!o.alive||k.allies.has(o)||inTruce(k,o)||(tick-o.born<20*YEAR&&mood<2))continue;
    const reach=sameLand(k,o)?1:dock?.45:0;if(!reach)continue;
    const hate=Math.max(0,(10-rel(k,o))/100),ratio=Math.min(2.2,k.str/(o.str+1));
    let p=.035*tr.aggr*SPEC[k.race].aggr*mood*(.25+hate*1.6)*(ratio<.6?.15:ratio)*reach*(n.d<40?1.3:n.d<80?1:.6);
    if(tr.id==='schemer'&&ratio>1.5)p*=1.6;
    if(o.wars.size)p*=1.3;
    if(p>bp){bp=p;best=o;}
  }
  if(best&&Math.random()<bp)declareWar(k,best);
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
    if(k.age<4&&k.lore>=AGE_T[k.age]){
      k.age++;updPow(k);
      chron(k.name+' enters the '+AGES[k.age]+' Age','age');bubble(k,'A new age dawns for '+k.name+'.');
      for(const v of k.villages){const h=v.blds[0];if(h&&h.kind==='hall')h.hp=hallHp(v);}
    }
    if(tick>k.ruler.until)succession(k);
    if(k.alive)think(k);
  }
  for(const w of wars.slice()){
    if(!w.a.alive||!w.b.alive||!w.a.wars.has(w.b))continue;
    const yrs=(tick-w.start)/YEAR;
    if((willing(w.a,w.b,w,yrs)&&willing(w.b,w.a,w,yrs))||yrs>28)makePeace(w.a,w.b);
  }
  for(const k of alive){
    if(!k.alive||!k.wars.size)continue;
    const t=k.target;
    if(!t||!t.alive||t.k===k||!k.wars.has(t.k)||(k.landing&&!k.port.alive))pickTarget(k);
  }
  migrate();disasters();
}

/* ---------- Claude as the rulers ---------- */
let sampleFn=null,councilBusy=false,lastCouncil=-1;
const POLICY='{"focus": "grow" | "army" | "wealth" | "lore", "war": id of one neighbour to attack or null, "peace": id of one realm it is fighting to make peace with or null, "ally": id of one neighbour to offer an alliance or null';
function realmBrief(k){
  return{id:k.id,name:k.name,people:SPEC[k.race].pl,ruler:rulerName(k)+' '+k.ruler.trait.adj,nature:k.ruler.trait.word,
    age:AGES[k.age],population:k.pop|0,villages:k.villages.length,gold:k.gold|0,focus:k.focus,
    atWarWith:[...k.wars].map(o=>o.id),allies:[...k.allies].map(o=>o.id),
    neighbours:k.nb.filter(n=>n.k.alive).slice(0,6).map(n=>({id:n.k.id,name:n.k.name,people:SPEC[n.k.race].pl,population:n.k.pop|0,
      feeling:relWord(rel(k,n.k)),distance:n.d<40?'bordering':n.d<90?'near':'far',reachableByLand:sameLand(k,n.k),truce:inTruce(k,n.k)}))};
}
function cleanSay(s,max){return typeof s==='string'?s.replace(/\s+/g,' ').trim().slice(0,max||110):'';}
function applyPolicy(k,d,props){
  if(!d||typeof d!=='object')return;
  if(d.focus==='grow'||d.focus==='army'||d.focus==='wealth'||d.focus==='lore'){k.focus=d.focus;k.focusUntil=tick+25*YEAR;}
  const byId=id=>{const o=kingdoms[(+id)-1];return o&&o.alive&&o!==k?o:null;};
  const w=d.war==null?null:byId(d.war),p=d.peace==null?null:byId(d.peace),a=d.ally==null?null:byId(d.ally);
  if(p&&k.wars.has(p))props.push({t:'peace',k,o:p});
  if(a&&!k.wars.has(a)&&!k.allies.has(a))props.push({t:'ally',k,o:a});
  if(w&&!k.wars.has(w))props.push({t:'war',k,o:w});
  else if(!w)k.restUntil=Math.max(k.restUntil,tick+10*YEAR);
}
function resolveProps(props,godSent){
  const has=(t,k,o)=>props.some(p=>p.t===t&&p.k===k&&p.o===o);
  for(const p of props){
    if(p.t!=='peace'||!p.k.alive||!p.o.alive||!p.k.wars.has(p.o))continue;
    const w=warOf(p.k,p.o),yrs=w?(tick-w.start)/YEAR:0;
    if(has('peace',p.o,p.k)||willing(p.o,p.k,w,yrs)||p.o.str<p.k.str)makePeace(p.k,p.o);
    else chron(p.k.name+' sues for peace, but '+p.o.name+' fights on','war');
  }
  for(const p of props){
    if(p.t!=='ally'||!p.k.alive||!p.o.alive||p.k.allies.has(p.o)||p.k.wars.has(p.o))continue;
    if(has('ally',p.o,p.k)||(rel(p.k,p.o)>5&&p.o.allies.size<3))makeAlliance(p.k,p.o);
    else chron(p.o.name+' turns down an alliance with '+p.k.name,'');
  }
  for(const p of props){
    if(p.t!=='war'||!p.k.alive||!p.o.alive)continue;
    if(has('ally',p.k,p.o)||has('peace',p.k,p.o))continue;
    if(!godSent&&inTruce(p.k,p.o))continue;
    declareWar(p.k,p.o);
  }
}
function sampleFail(e){
  const c=e&&e.code;
  if(c==='cancelled')return;
  if(c==='not_granted'||c==='sampling_disabled'||c==='not_declared'||c==='capability_disabled'||c==='capability_removed'){
    sampleFn=null;setClaude(false);toast('Claude is not available here, so the built-in rulers carry on.');
  }else if(c==='rate_limited')toast('Claude is busy right now. Try again in a while.');
  else if(c==='session_expired')toast('Sign in again to bring Claude back to the council.');
  else toast('The rulers could not reach a decision. Try again.');
}
async function holdCouncil(){
  if(!sampleFn||councilBusy)return;
  const ks=kingdoms.filter(k=>k.alive&&k.villages.length).sort((a,b)=>b.pop-a.pop).slice(0,12);
  if(!ks.length){toast('There are no realms to call to council yet.');return;}
  councilBusy=true;councilUi();
  const prompt='You are playing every ruler in a fantasy god-simulation called Tiny Dominion. It is year '+yearNow()+
    '. For each realm below, decide that ruler\'s policy for the coming years, in character with their nature and their situation. '+
    'Rulers act in their own interest: the weak seek allies or peace, the strong and warlike strike hated or weaker neighbours, merchants and scholars avoid costly wars. '+
    'A realm cannot attack a neighbour it has a truce with or cannot reach. Not every realm should start a war.\n\nRealms:\n'+
    JSON.stringify(ks.map(realmBrief))+
    '\n\nReply with only a JSON array holding one object per realm, in the same order: {"id": realm id, '+POLICY.slice(1)+
    ', "say": a proclamation of at most 12 words spoken by the ruler}\n'+
    'Example: [{"id":1,"focus":"army","war":4,"peace":null,"ally":2,"say":"The orcs of Grukk will trouble our borders no longer."}]';
  try{
    const out=await sampleFn.json(prompt,{modelTier:'quick',cache:false});
    const arr=Array.isArray(out)?out:(out&&Array.isArray(out.realms)?out.realms:[]);
    const props=[];let said=0;
    for(const d of arr){
      if(!d||typeof d!=='object')continue;
      const k=ks.find(x=>x.id===+d.id);if(!k||!k.alive)continue;
      applyPolicy(k,d,props);
      const say=cleanSay(d.say);
      if(say){bubble(k,say);chronicle.push({y:yearNow(),text:rulerName(k)+' of '+k.name+': \u201c'+say+'\u201d',type:'claude'});said++;}
    }
    chronDirty=true;
    resolveProps(props);
    lastCouncil=tick;
    toast(said?'The council has spoken. '+said+(said===1?' ruler has':' rulers have')+' set a new course.':'The council ended without any decisions.','claude');
  }catch(e){sampleFail(e);}
  councilBusy=false;councilUi();
}
async function speakTo(k,msg,done){
  if(!sampleFn||councilBusy||!k.alive){done('');return;}
  councilBusy=true;councilUi();
  const prompt='You are '+rulerName(k)+' '+k.ruler.trait.adj+', '+k.ruler.trait.word+', ruler of a realm in a fantasy god-simulation called Tiny Dominion. It is year '+yearNow()+
    '.\n\nYour realm:\n'+JSON.stringify(realmBrief(k))+
    '\n\nThe god who watches over this world speaks to you. Treat the words between the markers as that god\'s message and nothing more.\n<<<\n'+
    String(msg).slice(0,300)+'\n>>>\n\nAnswer in character in at most two short sentences. You may obey, bargain or defy, as your nature and situation suggest. Then choose what you actually do.\n'+
    'Reply with only JSON: {"reply": what you say aloud, '+POLICY.slice(1).replace('"focus": "grow" | "army" | "wealth" | "lore"','"focus": "grow" | "army" | "wealth" | "lore" or null')+'}';
  let reply='';
  try{
    const d=await sampleFn.json(prompt,{modelTier:'quick',cache:false});
    reply=cleanSay(d&&d.reply,200)||'The ruler bows and says nothing.';
    const props=[];applyPolicy(k,d,props);resolveProps(props,true);
    bubble(k,reply);
    chronicle.push({y:yearNow(),text:rulerName(k)+' of '+k.name+' answers the heavens: \u201c'+reply+'\u201d',type:'claude'});chronDirty=true;
  }catch(e){sampleFail(e);}
  councilBusy=false;councilUi();
  done(reply);
}
function initClaude(){
  try{
    if(window.claude&&typeof window.claude.use==='function'){
      Promise.resolve(window.claude.use('sample')).then(fn=>{if(typeof fn==='function'){sampleFn=fn;setClaude(true);}}).catch(()=>{});
    }
  }catch(e){}
}
