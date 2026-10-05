/* ================= the minds of rulers =================
   Every ruler has a temperament, a memory of what other realms did, and a long-term goal.
   Once a year they weigh their real options, each scored from named factors, and act on the
   strongest if it is strong enough. Other rulers answer offers with the same kind of reasoning.
   The realm page shows all of it, so you can watch them think. */
const TEMPER=['aggr','caut','ambi','greed','zeal','honor','curio','cunning'];
const TEMPER_NAME={aggr:'Aggression',caut:'Caution',ambi:'Ambition',greed:'Greed',zeal:'Zeal',honor:'Honour',curio:'Curiosity',cunning:'Cunning'};
const TRAIT_TM={
  conqueror:{aggr:.85,caut:.25,ambi:.8,greed:.4,zeal:.4,honor:.5,curio:.2,cunning:.4},
  builder:{aggr:.3,caut:.55,ambi:.85,greed:.4,zeal:.3,honor:.6,curio:.45,cunning:.25},
  merchant:{aggr:.2,caut:.6,ambi:.5,greed:.9,zeal:.15,honor:.55,curio:.4,cunning:.5},
  scholar:{aggr:.15,caut:.7,ambi:.45,greed:.3,zeal:.2,honor:.65,curio:.92,cunning:.3},
  zealot:{aggr:.6,caut:.4,ambi:.5,greed:.3,zeal:.95,honor:.55,curio:.25,cunning:.3},
  schemer:{aggr:.5,caut:.45,ambi:.65,greed:.6,zeal:.3,honor:.12,curio:.35,cunning:.95}};
const RACE_TM=[{ambi:.1},{curio:.15,zeal:.1,aggr:-.1},{greed:.15,honor:.15},{aggr:.2,caut:-.1,curio:-.1}];
const ARMY_WORD=['warriors','spearmen','legions','legions','knights','musketeers','riflemen','divisions','divisions'];
const clamp01=v=>v<0?0:v>1?1:v;
/* ---------- the character of a people and of each nation ----------
   When a world is made, each people is set to be peaceful, average or warlike. Every realm then gets
   its own national character around that, which outlives its rulers: each new ruler is born near it. */
const NATURES=['peaceful','average','warlike'];
let NATURE=[1,1,1,1];
const NAT_SHIFT=[{aggr:-.26,caut:.12,honor:.12,zeal:-.1,curio:.08,greed:.04},{},{aggr:.26,caut:-.12,ambi:.1,zeal:.1,honor:-.06,curio:-.06}];
const NAT_TRAITW=[{conqueror:.25,zealot:.6,schemer:.6,builder:1.3,merchant:1.3,scholar:1.4},{},{conqueror:2.2,zealot:1.4,schemer:1.2,builder:.8,merchant:.6,scholar:.5}];
function natureFromSettings(){NATURE=[S.natHuman,S.natElf,S.natDwarf,S.natOrc].map(v=>Math.max(0,NATURES.indexOf(v)));}
function rollCulture(race,nat){
  const c={},sh=NAT_SHIFT[nat]||{};
  for(const a of TEMPER)c[a]=Math.max(.05,Math.min(.95,.5+(RACE_TM[race][a]||0)+(sh[a]||0)+(Math.random()-.5)*.3));
  return c;
}
function natOf(k){if(k.nat===undefined||k.nat===null)k.nat=NATURE[k.race]===undefined?1:NATURE[k.race];return k.nat;}
function cultureOf(k){return k.culture||(k.culture=rollCulture(k.race,natOf(k)));}
/* a breakaway realm keeps most of its parent's character */
function driftCulture(c){const d={};for(const a of TEMPER)d[a]=Math.max(.05,Math.min(.95,c[a]+(Math.random()-.5)*.2));return d;}
function pickTrait(nat){
  const w=NAT_TRAITW[nat]||{};let t=0;for(const x of TRAITS)t+=w[x.id]||1;
  let r=Math.random()*t;for(const x of TRAITS){r-=w[x.id]||1;if(r<=0)return x;}
  return TRAITS[0];
}
function rollTemper(trait,race,parent,cult){
  const t={};
  for(const a of TEMPER){
    let b=cult?TRAIT_TM[trait.id][a]*.45+cult[a]*.55:TRAIT_TM[trait.id][a]+(RACE_TM[race][a]||0);
    if(parent&&parent[a]!==undefined)b=b*.7+parent[a]*.3;
    t[a]=Math.max(.03,Math.min(.97,b+(Math.random()-.5)*(cult?.26:.32)));
  }
  return t;
}
function tmOf(k){const r=k.ruler;return r.tm||(r.tm=rollTemper(r.trait,k.race,null,cultureOf(k)));}

/* ---------- memory: grudges and debts between realms ---------- */
function memOf(k,o){const m=k.mem||(k.mem={});return m[o.id]||(m[o.id]={g:0,d:0,why:'',dwhy:''});}
function remember(k,o,dg,dd,why){
  if(!k||!o||k===o||!k.alive)return;
  const m=memOf(k,o);
  m.g=Math.max(0,Math.min(150,m.g+dg));m.d=Math.max(0,Math.min(100,m.d+dd));
  if(why&&dg>=8){m.why=why;m.wy=yearNow();}
  if(why&&dd>0&&(dd>=8||!m.dwhy)){m.dwhy=why;m.dy=yearNow();}
}
function grudge(k,o){const m=k.mem&&k.mem[o.id];return m?m.g:0;}
function debt(k,o){const m=k.mem&&k.mem[o.id];return m?m.d:0;}
/* after an offer or a demand, a ruler waits years before trying the same again */
function cool(k,kind,o){return!!(k.cool&&k.cool[kind+o.id]>tick);}
function setCool(k,kind,o,yrs){(k.cool||(k.cool={}))[kind+o.id]=tick+yrs*YEAR|0;}
function hasPact(k,o){return!!(k.pacts&&k.pacts.indexOf(o.id)>=0);}
function repOf(k){return k.rep===undefined?(k.rep=50):k.rep;}
function fadeMemory(k){
  if(!k.mem)return;
  for(const id in k.mem){const m=k.mem[id];m.g*=m.why&&m.why.indexOf('betray')>=0?.985:.965;m.d*=.95;if(m.g<1&&m.d<1)delete k.mem[id];}
  k.rep=Math.min(100,repOf(k)+.4);
}

/* ---------- how a ruler sees the world ---------- */
function allyStr(o){let s=o.str;for(const a of o.allies)if(a.alive)s+=a.str*.6;return s;}
function canReach(k,o){return sameLand(k,o)?1:(k.age>=1&&hasDock(k))?.5:0;}
function nbDist(k,o){for(const n of k.nb)if(n.k===o)return n.d;return 999;}
/* how strongly another realm frightens us */
function fearOf(k,o){
  if(!o.alive||k.allies.has(o))return 0;
  const ratio=allyStr(o)/(allyStr(k)+1),d=nbDist(k,o),near=d<40?1:d<90?.6:.25;
  return clamp01((ratio-1)*.5*near*(.5+tmOf(o).aggr)+(rel(k,o)<-30?.15:0));
}
/* what we would gain from taking another realm's land */
function covet(k,o){
  let c=0;const tm=tmOf(k);
  for(const v of o.villages){
    if(v.wonder&&v.wonder.prog>=1)c+=.35;
    const ours=nearestVillageOf(k,v.x,v.y);if(ours&&d2(ours,v)<45*45)c+=.12;
  }
  c+=tm.greed*Math.min(.35,o.gold/1500);
  return Math.min(1,c);
}
function armyWord(k){return ARMY_WORD[k.age]||'warriors';}
function say(k,list,o,extra){
  if(!list||!list.length)return;
  let s=list[(Math.random()*list.length)|0];
  s=s.replace(/\{O\}/g,o?o.name:'').replace(/\{OP\}/g,o?SPEC[o.race].pl.toLowerCase():'').replace(/\{ARMY\}/g,armyWord(k)).replace(/\{X\}/g,extra||'');
  bubble(k,s);
  return s;
}
const SAY={
  war_weak:['{O} is weak. We take what we want.','Their walls are thin. March on {O}!','Our {ARMY} will feast in {O}.'],
  war_grudge:['{O} will pay for what they did.','We have not forgotten, {O}.','Vengeance for {X}!'],
  war_covet:['The riches of {O} will be ours.','{O} sits on land that should be ours.'],
  war_zeal:['Drive the {OP} from our borders!','The {OP} defile this land.'],
  war_sly:['While {O} bleeds elsewhere, we strike.','They will never see it coming.'],
  war_goal:['The time has come. {O} falls.','For years we have prepared. Now, {O}!'],
  war_fear:['Strike {O} before {O} strikes us.'],
  war_res:['The {X} of {O} will be ours.','Our {ARMY} need their {X}.','Why should {O} keep all that {X}?'],
  war_betray:['Alliances are for the weak. {O} is ours.'],
  peace_weary:['Enough blood. Let there be peace with {O}.','Our people are tired of war.'],
  peace_losing:['We cannot win this. Seek terms with {O}.'],
  peace_broke:['The treasury is empty. We need peace.'],
  ally:['Together we stand against {X}.','{O} is a true friend.','Two realms, one shield.'],
  ally_kin:['The {OP} stand together.'],
  tribute:['Pay, {O}, or face our {ARMY}.','A tithe, {O}. Or war.'],
  tribute_paid:['We pay, for now.'],
  tribute_refused:['We bow to no one.','Come and take it.'],
  gift:['A gift for our friends in {O}.','Let {O} know our goodwill.'],
  pact:['Let our caravans roll to {O}.','Trade makes us both rich.'],
  marry:['Our houses are joined.','A royal wedding! Let the bells ring.'],
  patron:['Knowledge is our greatest treasure.','Build schools, not swords.'],
  clean:['Clear skies for our children.','The seas will not take our cities.','Wind and sun will power us now.'],
  refuse_war:['The heavens ask too much. We will not fight.','War? Not while I live.'],
  refuse_peace:['Peace? Not while {O} stands.','The heavens are wrong. We fight on.'],
  refuse_lore:['Books will not fill our granaries.','We have no time for scrolls.'],
  accept:['The heavens have spoken. We obey.','As the gods will it.']};

/* ---------- long-term goals ---------- */
const GOALS={conquer:'Conquer',avenge:'Avenge wrongs by',defend:'Defend against',prosper:'Grow rich',enlighten:'Seek knowledge',expand:'Settle new lands'};
const GOAL_FOCUS={conquer:'army',avenge:'army',defend:'army',prosper:'wealth',enlighten:'lore',expand:'grow'};
const lc1=t=>t.charAt(0).toLowerCase()+t.slice(1);
function goalText(g){
  if(!g)return'Keeping the realm steady';
  return GOALS[g.type]+(g.o?' '+g.o.name:'')+(g.why?' ('+g.why+')':'');
}
function chooseGoal(k){
  const tm=tmOf(k),opts=[],maxV=5+k.age+(k.ruler.trait.id==='builder'?2:0);
  opts.push({type:'prosper',s:.15+tm.greed*.55,why:'a merchant’s heart'});
  opts.push({type:'enlighten',s:.1+tm.curio*.6+(wonderFor(k)?.08:0),why:'a curious mind'});
  if(k.villages.length<maxV){const fr=freeRiches(k,60);opts.push({type:'expand',s:.12+tm.ambi*.5+(fr?fr.v*.5:0),why:fr&&fr.v>.12?'the '+RES[fr.r].n.toLowerCase()+' in the wilds':'room to grow'});}
  for(const n of k.nb){
    const o=n.k;if(!o.alive||!canReach(k,o))continue;
    const adv=allyStr(k)/(allyStr(o)+1),g=grudge(k,o),f=fearOf(k,o);
    const rw=resWant(k,o);
    if(adv>1.3&&!k.allies.has(o))opts.push({type:'conquer',o,s:tm.ambi*.3+tm.aggr*.3+covet(k,o)*.25+(rw?rw.v*.5:0)+Math.min(.25,(adv-1)*.2)-tm.caut*.25+(natOf(k)-1)*.08,
      why:rw&&rw.v>.18?'their '+RES[rw.r].n.toLowerCase():adv>2?'they are weak':covet(k,o)>.3?'their riches':'room to grow'});
    if(g>25)opts.push({type:'avenge',o,s:g/100*(.7+tm.aggr*.4)-tm.honor*.05,why:memOf(k,o).why||'old wrongs'});
    if(f>.25)opts.push({type:'defend',o,s:f*(.6+tm.caut*.6),why:'they grow too strong'});
  }
  opts.sort((a,b)=>b.s-a.s);
  const best=opts[0],cur=k.goal;
  /* rulers commit to a goal; only a clearly better one replaces it */
  if(cur){
    const still=opts.find(p=>p.type===cur.type&&p.o===cur.o);
    if(still&&still.s>=best.s*.8&&tick-cur.since<40*YEAR){cur.s=still.s;return;}
  }
  k.goal={type:best.type,o:best.o||null,why:best.why,s:best.s,since:tick};
  if(cur&&(cur.type!==best.type||cur.o!==best.o)&&!quiet&&(best.type==='conquer'||best.type==='avenge'||best.type==='defend'))
    chron(rulerName(k)+' of '+k.name+' turns the realm toward a new aim: '+lc1(goalText(k.goal)),'ruler',k,true);
}

/* ---------- the yearly council: weigh every option, act on the best ---------- */
function sumWhy(f){let s=0;for(const x of f)s+=x[1];return s;}
function weighWar(k,o){
  const tm=tmOf(k),f=[],mood=MOOD[S.mood]||1,reach=canReach(k,o);
  if(!reach)return null;
  const adv=allyStr(k)/(allyStr(o)+1),g=grudge(k,o),goal=k.goal&&k.goal.o===o&&(k.goal.type==='conquer'||k.goal.type==='avenge');
  {const t=(tm.aggr-.45)*.5;f.push([t>0?'a warlike temper':'a peaceable temper',t]);}
  if(mood<1)f.push(['peaceful times',-.3]);else if(mood>1)f.push(['a bloodthirsty age',.3]);
  {const nt=natOf(k);if(nt!==1)f.push([nt?'a warlike people':'a peaceful people',nt?.18:-.18]);}
  if(adv>1)f.push(['they are weaker',Math.min(.45,(adv-1)*.3)*(1-tm.caut*.5)]);else f.push(['they are stronger',-(1/Math.max(.2,adv)-1)*.35*(.5+tm.caut)]);
  if(g>5)f.push(['old grudge',g/100*.55]);
  const cv=covet(k,o);if(cv>.05)f.push(['covets their land',cv*tm.ambi*.55]);
  const rw=resWant(k,o);if(rw)f.push(['their '+RES[rw.r].n.toLowerCase(),rw.v*(.45+tm.greed*.35+tm.ambi*.25)]);
  if(o.race!==k.race&&tm.zeal>.5)f.push(['zeal against the '+SPEC[o.race].pl.toLowerCase(),(tm.zeal-.5)*.5]);
  if(o.wars.size)f.push(['they are busy at war',tm.cunning*.3]);
  if(goal)f.push(['it is our goal',.4]);
  if(k.nudge&&tick<k.nudge.until)f.push(k.nudge.type==='war'?['the heavens urge war',.45]:['the heavens urge peace',-.45]);
  if(k.wars.size)f.push(['already at war',-.35*k.wars.size]);
  if(k.weary)f.push(['war weariness',-k.weary*.7]);
  if(inTruce(k,o))f.push(['we swore a truce',-(.3+tm.honor*.9)]);
  if(k.allies.has(o))f.push(['they are our ally',-(.4+tm.honor*1.1)+tm.cunning*.3]);
  if(k.kin&&k.kin.indexOf(o.id)>=0)f.push(['royal kin',-.35*tm.honor]);
  if(hasPact(k,o))f.push(['trade pact',-.1-.25*tm.greed]);
  if(debt(k,o)>5)f.push(['we owe them',-debt(k,o)/100*.5]);
  const d=nbDist(k,o);if(d>80)f.push(['far away',-.15]);
  if(reach<1)f.push(['across the sea',-.12]);
  if(tick-o.born<20*YEAR&&mood<2)f.push(['they are newly founded',-.6]);
  if(tick<k.restUntil)f.push([tick-k.born<30*YEAR?'the realm is young':'still recovering',-.7]);
  if(k.broke)f.push(['empty treasury',-.25]);
  return{kind:'war',o,u:sumWhy(f),f};
}
function weighPeace(k,o){
  const tm=tmOf(k),f=[],w=warOf(k,o);if(!w)return null;
  const yrs=(tick-w.start)/YEAR,diff=(w.a===k?w.sa-w.sb:w.sb-w.sa);
  if(yrs<1.5)return{kind:'peace',o,u:-1,f:[['the war has just begun',-1]]};
  if(cool(k,'peace',o))return{kind:'peace',o,u:-.5,f:[['they refused our last offer',-.5]]};
  f.push(['war weariness',(k.weary||0)*.8+yrs*.012]);
  if(diff<-10)f.push(['we are losing',Math.min(.5,-diff/80)*(.5+tm.caut)]);
  if(diff>10)f.push(['we are winning',-Math.min(.5,diff/80)*(.4+tm.aggr)]);
  if(k.broke)f.push(['empty treasury',.3]);
  const g=grudge(k,o);if(g>10)f.push(['old grudge',-g/100*.5]);
  if(k.goal&&k.goal.o===o&&k.goal.type!=='defend')f.push(['it is our goal to beat them',-.35]);
  if(k.nudge&&tick<k.nudge.until)f.push(k.nudge.type==='peace'?['the heavens urge peace',.5]:['the heavens urge war',-.4]);
  {const t=(tm.caut-tm.aggr)*.25;f.push([t>0?'a careful temper':'a warlike temper',t]);}
  return{kind:'peace',o,u:sumWhy(f),f};
}
function weighAlliance(k,o){
  if(k.allies.has(o)||k.wars.has(o)||k.allies.size>=3||o.allies.size>=3||cool(k,'ally',o))return null;
  const tm=tmOf(k),f=[];
  let shared=null;for(const e of k.wars)if(o.wars.has(e)){shared=e;break;}
  if(shared)f.push(['common enemy '+shared.name,.5]);
  let threat=null,tf=0;for(const n of k.nb){const t=n.k;if(t===o||!t.alive)continue;const fk=fearOf(k,t),fo=fearOf(o,t);if(fk+fo>tf){tf=fk+fo;threat=t;}}
  if(threat&&tf>.3)f.push(['fear of '+threat.name,tf*.4*(.5+tm.caut)]);
  f.push([rel(k,o)>=0?'friendship':'ill feeling',rel(k,o)/100*.5]);
  if(o.race===k.race)f.push(['the same people',.12]);else if(tm.zeal>.5)f.push(['distrust of the '+SPEC[o.race].pl.toLowerCase(),-(tm.zeal-.5)*.5]);
  if(repOf(o)<35)f.push(['they break promises',-(35-repOf(o))/100]);
  if(grudge(k,o)>10)f.push(['old grudge',-grudge(k,o)/100*.6]);
  if(k.goal&&k.goal.type==='defend'&&k.goal.o&&o.wars.has(k.goal.o))f.push(['they fight our foe',.25]);
  {const t=(tm.caut-.5)*.2;f.push([t>0?'caution':'self-reliance',t]);}
  return{kind:'ally',o,u:sumWhy(f)-.15,f,shared:shared||threat};
}
function weighTribute(k,o){
  if(k.allies.has(o)||k.wars.has(o)||inTruce(k,o)||!canReach(k,o)||o.gold<40||cool(k,'trib',o))return null;
  const tm=tmOf(k),adv=allyStr(k)/(allyStr(o)+1);if(adv<1.6)return null;
  const f=[['they are far weaker',Math.min(.4,(adv-1.6)*.25)-.08],['greed',tm.greed*.3],[(tm.aggr+tm.cunning>1)?'a hard heart':'a soft heart',(tm.aggr+tm.cunning-1)*.2],['honour',-tm.honor*.25]];
  if(k.goal&&k.goal.type==='prosper')f.push(['it fills the treasury',.12]);
  if(natOf(k)!==1)f.push([natOf(k)?'a warlike people':'a peaceful people',natOf(k)?.08:-.12]);
  return{kind:'tribute',o,u:sumWhy(f),f};
}
function weighGift(k,o){
  if(k.wars.has(o)||k.gold<120||cool(k,'gift',o))return null;
  const tm=tmOf(k),fr=fearOf(k,o);if(fr<.25&&rel(k,o)>-10)return null;
  const f=[['fear of them',fr*.6*(.5+tm.caut)-.08],['generosity',-tm.greed*.25]];
  if(rel(k,o)<-10)f.push(['to mend relations',.12]);
  return{kind:'gift',o,u:sumWhy(f),f};
}
function weighPact(k,o){
  if(k.wars.has(o)||hasPact(k,o)||k.age<1||rel(k,o)<0||cool(k,'pact',o))return null;
  const tm=tmOf(k),f=[['greed',tm.greed*.4],['friendship',rel(k,o)/100*.3]];
  let m=0;for(const v of k.villages)if(v.market)m++;
  if(!m)f.push(['no markets yet',-.3]);
  const rw=resWant(k,o);if(rw)f.push(['to trade for their '+RES[rw.r].n.toLowerCase(),rw.v*.7]);
  return{kind:'pact',o,u:sumWhy(f)-.1,f};
}
function weighMarriage(k,o){
  if(k.wars.has(o)||(k.kin&&k.kin.indexOf(o.id)>=0)||rel(k,o)<20||cool(k,'wed',o))return null;
  const tm=tmOf(k),f=[['friendship',rel(k,o)/100*.4],['ambition',tm.ambi*.15]];
  if(o.race===k.race)f.push(['the same people',.15]);else f.push(['different peoples',-.2-tm.zeal*.3]);
  return{kind:'marry',o,u:sumWhy(f)-.12,f};
}
function rulerThink(k){
  const tm=tmOf(k);
  fadeMemory(k);
  if(k.cool)for(const c in k.cool)if(k.cool[c]<=tick)delete k.cool[c];
  if(k.wars.size)k.weary=Math.min(1,(k.weary||0)+.05);else k.weary=(k.weary||0)*.8;
  chooseGoal(k);
  for(const o of[...k.allies]){
    if(!o.alive){k.allies.delete(o);continue;}
    if(rel(k,o)<-15||grudge(k,o)>45){k.allies.delete(o);o.allies.delete(k);chron('The alliance of '+k.name+' and '+o.name+' falls apart'+(memOf(k,o).why?': '+o.name+' '+memOf(k,o).why:''),'ruin',k);}
  }
  if(k.pacts&&k.pacts.length){
    k.pacts=k.pacts.filter(id=>{const o=kingdoms[id-1];return o&&o.alive&&!k.wars.has(o);});
    k.gold+=k.pacts.length*(3+2*k.age);
  }
  /* the realm's focus follows its goal, and its needs */
  if(tick>k.focusUntil){
    let f=GOAL_FOCUS[k.goal?k.goal.type:'prosper']||k.ruler.trait.focus;
    if(k.goal&&k.goal.type==='defend'&&k.goal.s<.45)f=k.ruler.trait.focus;
    if(k.wars.size)f='army';else if(k.broke)f='wealth';else if(k.pop<25)f='grow';
    k.focus=f;
  }
  if(k.pop<8){k.mind={y:yearNow(),bar:0,opts:[],did:null,small:true};return;}
  if(k.villages.length>=6&&!k.wars.size&&Math.random()<.03*(1.3-tm.honor)){secede(k,'');k.mind={y:yearNow(),opts:[],did:'lost a province'};return;}
  const opts=[];
  for(const n of k.nb){
    const o=n.k;if(!o.alive)continue;
    let x;
    if(k.wars.has(o)){if((x=weighPeace(k,o)))opts.push(x);continue;}
    if((x=weighWar(k,o)))opts.push(x);
    if((x=weighAlliance(k,o)))opts.push(x);
    if((x=weighTribute(k,o)))opts.push(x);
    if((x=weighGift(k,o)))opts.push(x);
    if((x=weighPact(k,o)))opts.push(x);
    if((x=weighMarriage(k,o)))opts.push(x);
  }
  if(!k.wars.size&&k.gold>320)opts.push({kind:'festival',o:null,u:.1+Math.min(.4,k.gold/4000)-tm.greed*.2,f:[['a full treasury',Math.min(.4,k.gold/4000)],['greed',-tm.greed*.2]]});
  {const c=weighClean(k);if(c)opts.push(c);}
  if(k.gold>250&&tm.curio>.45)opts.push({kind:'patron',o:null,u:tm.curio*.45-tm.greed*.15,f:[['curiosity',tm.curio*.45],['greed',-tm.greed*.15]]});
  opts.sort((a,b)=>b.u-a.u);
  const best=opts[0];
  let did=null;
  /* the strongest option is acted on only if it is strong enough; bolder rulers act sooner */
  const bar=.28+tm.caut*.15-tm.aggr*.08;
  if(best&&best.u>bar&&Math.random()<Math.min(.85,(best.u-bar)*2.4+.15))did=act(k,best);
  const shown=[],per={};
  for(const p of opts){if(shown.length>=5)break;if((per[p.kind]=(per[p.kind]||0)+1)<=2||p===best)shown.push(p);}
  k.mind={y:yearNow(),bar,opts:shown.map(p=>({kind:p.kind,o:p.o?p.o.id:0,u:p.u,f:p.f.filter(x=>Math.abs(x[1])>.02).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,4),done:p===best&&!!did})),did};
}
/* clean power: weighed by realms of the Modern Age once smoke and rising seas trouble them */
function weighClean(k,atSummit){
  if(k.age<7||(k.clean||0)>=.95||(!atSummit&&k.gold<180))return null;
  const tm=tmOf(k),deg=degWarm(),f=[];
  if(deg>.4)f.push(['the world is warming',Math.min(.5,(deg-.4)*.16)]);
  if(SL>100){let c=0;for(const v of k.villages)if(v.dock)c++;f.push(['the seas are rising',Math.min(.45,(SL-100)*.06)*(.3+Math.min(1,c/Math.max(1,k.villages.length))*1.2)]);}
  if((k.smoke||0)>8)f.push(['smog over our cities',Math.min(.25,(k.smoke-8)*.012)]);
  f.push(['curiosity',tm.curio*.15]);f.push(['caution',tm.caut*.1]);
  f.push(['the cost',-.2-tm.greed*.25]);
  if(hasRes(k,OIL)||hasRes(k,COAL))f.push(['our own coal and oil',-.1]);
  return{kind:'clean',o:null,u:sumWhy(f),f};
}
const WAR_WHY={'a warlike temper':'for glory','a warlike people':'as warlike peoples do','they are weaker':'seeing their weakness','old grudge':'to avenge old wrongs','covets their land':'coveting their land','they are busy at war':'while they are busy elsewhere',
  'it is our goal':'as long planned','the heavens urge war':'urged on by the heavens','a bloodthirsty age':'in a bloodthirsty age'};
function lead(f){let b=null;for(const x of f)if(x[1]>0&&(!b||x[1]>b[1]))b=x;return b?b[0]:'';}
function act(k,p){
  const o=p.o,why=lead(p.f);
  switch(p.kind){
    case'war':{
      const betray=k.allies.has(o);
      const key=betray?'war_betray':why==='old grudge'?'war_grudge':why==='they are weaker'?'war_weak':why==='covets their land'?'war_covet':why.indexOf('zeal')===0?'war_zeal':why==='they are busy at war'?'war_sly':why==='it is our goal'?'war_goal':why.indexOf('their ')===0?'war_res':'war_weak';
      const ph=why.indexOf('zeal')===0?'out of zeal':why.indexOf('their ')===0?'to seize '+why:WAR_WHY[why]||'';
      if(declareWar(k,o,rulerName(k)+' of '+k.name+' declares war on '+o.name+(ph?', '+ph:''))){say(k,SAY[key],o,key==='war_res'?why.slice(6):memOf(k,o).why);return'war on '+o.name;}
      return null;
    }
    case'peace':{
      const w=warOf(k,o),yrs=w?(tick-w.start)/YEAR:0,them=weighPeace(o,k);
      const losing=w?(w.a===k?w.sa-w.sb:w.sb-w.sa)<-10:false;
      if(them&&(them.u>.05||(losing&&them.u>-.25))){
        const terms=peaceTerms(k,o,w);
        makePeace(k,o,true);
        chron('Peace between '+k.name+' and '+o.name+' after '+Math.max(1,Math.round(yrs))+' years'+(terms?'. '+terms:''),'peace',k);snd('peace');
        say(k,SAY[why==='we are losing'?'peace_losing':why==='empty treasury'?'peace_broke':'peace_weary'],o);
        return'peace with '+o.name;
      }
      setCool(k,'peace',o,2);
      chron(k.name+' sues for peace, but '+o.name+' fights on','war',k,true);
      say(o,SAY.refuse_peace,k);remember(o,k,0,0,'');
      return null;
    }
    case'ally':{
      const them=weighAlliance(o,k);
      if(them&&them.u>-.05){if(makeAlliance(k,o)){say(k,o.race===k.race?SAY.ally_kin:SAY.ally,o,p.shared?p.shared.name:'all who threaten us');return'alliance with '+o.name;}}
      else{setCool(k,'ally',o,12);chron(o.name+' turns down an alliance with '+k.name,'',k,true);remember(k,o,4,0,'refused our friendship');}
      return null;
    }
    case'tribute':{
      const amt=Math.round(Math.max(20,o.gold*.25)),tmo=tmOf(o);setCool(k,'trib',o,12);
      const fear=fearOf(o,k),pay=fear*(.4+tmo.caut)>tmo.aggr*.5+.15;
      say(k,SAY.tribute,o);
      if(pay){
        o.gold-=amt;k.gold+=amt;remember(o,k,18,0,'extorted tribute');
        chron(k.name+' demands tribute from '+o.name+', who pays '+amt+' gold','war',o,true);say(o,SAY.tribute_paid,k);
        return'tribute from '+o.name;
      }
      remember(o,k,12,0,'demanded tribute');
      say(o,SAY.tribute_refused,k);
      chron(o.name+' refuses to pay tribute to '+k.name,'war',o,true);
      if(tmOf(k).aggr>.55&&canReach(k,o))declareWar(k,o,k.name+' marches on '+o.name+' to take the tribute it was refused');
      return'demanded tribute';
    }
    case'gift':{
      const amt=Math.round(Math.min(k.gold*.15,200));k.gold-=amt;o.gold+=amt;setCool(k,'gift',o,10);
      setRel(k,o,rel(k,o)+18);remember(o,k,-10,15,'sent us gifts');
      chron(k.name+' sends '+amt+' gold in gifts to '+o.name,'peace',k,true);say(k,SAY.gift,o);
      return'gifts to '+o.name;
    }
    case'pact':{
      const them=weighPact(o,k);
      if(!them||them.u<-.1){setCool(k,'pact',o,15);chron(o.name+' declines a trade pact with '+k.name,'',k,true);return null;}
      (k.pacts||(k.pacts=[])).push(o.id);(o.pacts||(o.pacts=[])).push(k.id);
      setRel(k,o,rel(k,o)+12);
      chron(k.name+' and '+o.name+' sign a trade pact','peace',k);say(k,SAY.pact,o);
      return'trade pact with '+o.name;
    }
    case'marry':{
      const them=weighMarriage(o,k);if(!them||them.u<-.1){setCool(k,'wed',o,15);return null;}
      (k.kin||(k.kin=[])).push(o.id);(o.kin||(o.kin=[])).push(k.id);
      setRel(k,o,rel(k,o)+25);remember(k,o,-15,10,'joined by marriage');remember(o,k,-15,10,'joined by marriage');
      chron('A royal wedding joins the houses of '+k.name+' and '+o.name,'peace',k);say(k,SAY.marry,o);
      if(k.villages[0])fx({k:'fireworks',x:k.villages[0].x,y:k.villages[0].y,t:90,T:90});
      return'royal wedding with '+o.name;
    }
    case'festival':{
      k.gold-=160+k.gold*.12;for(const v of k.villages)v.res+=12;
      if(k.villages[0])fx({k:'fireworks',x:k.villages[0].x,y:k.villages[0].y,t:120,T:120});
      for(const n of k.nb)if(n.k.alive&&!k.wars.has(n.k))setRel(k,n.k,rel(k,n.k)+5);
      chron(k.name+' holds a grand festival','peace',k,true);
      return'a grand festival';
    }
    case'clean':{
      const cost=Math.round(120+k.gold*.12);k.gold-=cost;k.clean=Math.min(1,(k.clean||0)+.25);
      chron(k.name+(k.age>=8?' lights its cities with fusion power':k.clean>=.9?' runs almost wholly on wind and sun':' builds wind farms and solar fields')+', cutting its smoke','tech',k);
      say(k,SAY.clean,null);
      return'clean power';
    }
    case'patron':{
      const g=Math.round(k.gold*.3);k.gold-=g;k.lore+=g*.25;
      chron(rulerName(k)+' of '+k.name+' pours '+g+' gold into scholars and libraries','tech',k);say(k,SAY.patron,null);
      return'patronage of learning';
    }
  }
  return null;
}
/* what the loser gives up when a war ends */
function peaceTerms(a,b,w){
  if(!w)return'';
  const diff=w.sa-w.sb,win=diff>0?w.a:w.b,lose=win===w.a?w.b:w.a,m=Math.abs(diff);
  if(m<15)return'Neither side gains anything';
  if(m>=45&&lose.villages.length>=2){
    let best=null,bd=1e9;
    for(const v of lose.villages){if(v===lose.villages[0])continue;const c=nearestVillageOf(win,v.x,v.y);if(c){const d=d2(c,v);if(d<bd){bd=d;best=v;}}}
    if(best&&bd<80*80){cedeVillage(best,win);remember(lose,win,30,0,'took '+best.name+' in the peace');return lose.name+' cedes '+best.name+' to '+win.name;}
  }
  const pay=Math.round(lose.gold*(m>30?.4:.2));lose.gold-=pay;win.gold+=pay;
  remember(lose,win,8,0,'forced reparations on us');
  return lose.name+' pays '+pay+' gold in reparations';
}
/* a town changes hands by treaty, keeping its people */
function cedeVillage(v,k){
  const old=v.k;if(old===k)return;
  const n=old.villages.indexOf(v);if(n>=0)old.villages.splice(n,1);
  const same=v.race===k.race;v.k=k;v.race=k.race;k.villages.push(v);
  for(const u of units)if(u.v===v&&!u.dead){if(same){u.k=k;u.soldier=false;}else{u.v=null;u.k=null;u.soldier=false;}}
  dirtyAll=true;
}
/* allies decide for themselves whether to answer the call */
function answerCall(al,friend,foe,offense){
  const tm=tmOf(al),f=tm.honor*.6+debt(al,friend)/100*.5+rel(al,friend)/100*.3+grudge(al,foe)/100*.5-tm.caut*fearOf(al,foe)*.4-(al.weary||0)*.4-al.wars.size*.2+(tm.aggr-.5)*.2
    -(inTruce(al,foe)?.2+tm.honor*.3:0)-(hasPact(al,foe)?.15:0)+(natOf(al)-1)*.08+(Math.random()-.5)*.15;
  return f>(offense?.45:.12);
}
/* the heavens whisper to a ruler; whether they listen depends on who they are */
function whisper(k,kind){
  const tm=tmOf(k);
  if(tick<(k.heard||0))return{ok:false,busy:true,text:rulerName(k)+' is still weighing your last whisper.'};
  k.heard=tick+YEAR;
  let listens;
  if(kind==='war')listens=tm.aggr+tm.zeal*.3+Math.random()*.4>tm.caut+tm.honor*.3;
  else if(kind==='peace')listens=tm.caut+tm.honor*.4+Math.random()*.4>tm.aggr+tm.cunning*.2;
  else listens=tm.curio+Math.random()*.5>.45;
  if(!listens){
    const t=say(k,kind==='war'?SAY.refuse_war:kind==='peace'?SAY.refuse_peace:SAY.refuse_lore,[...k.wars][0]||null);
    chron(rulerName(k)+' of '+k.name+' ignores the heavens','ruler',k);
    return{ok:false,text:t};
  }
  if(kind==='lore'){k.focus='lore';k.focusUntil=tick+20*YEAR;k.lore+=40+k.villages.length*10;}
  else k.nudge={type:kind,until:tick+8*YEAR};
  const t=say(k,SAY.accept,null);
  chron(rulerName(k)+' of '+k.name+' heeds a whisper from the heavens: '+(kind==='war'?'war':kind==='peace'?'peace':'learning'),'ruler',k);
  return{ok:true,text:t};
}
/* describe a weighed option for the realm page */
function optLabel(p){
  const o=p.o?kingdoms[p.o-1]:null,n=o?o.name:'';
  return{war:'War on '+n,peace:'Peace with '+n,ally:'Alliance with '+n,tribute:'Demand tribute from '+n,gift:'Send gifts to '+n,clean:'Build clean power',pact:'Trade pact with '+n,marry:'Royal marriage with '+n,festival:'Hold a festival',patron:'Fund scholars'}[p.kind]||p.kind;
}
