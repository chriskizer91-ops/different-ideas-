const $=id=>document.getElementById(id);
const reduceMotion=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const now=()=>(typeof performance!=='undefined'?performance.now():Date.now());

/* ---------- terrain ---------- */
const DEEP=0,WATER=1,SAND=2,GRASS=3,FOREST=4,HILL=5,MOUNT=6,SNOW=7,LAVA=8,ASH=9,DESERT=10,SAVANNA=11,JUNGLE=12,TUNDRA=13,PINE=14,SWAMP=15,RIVER=16,NT=17;
const TD=[
  {n:'Deep ocean',    c:[24,64,116],  v:4, w:0,b:0,f:0,  burn:0, sp:0,  tree:0},
  {n:'Shallows',      c:[46,116,170], v:6, w:0,b:0,f:0,  burn:0, sp:0,  tree:0},
  {n:'Beach',         c:[230,210,150],v:7, w:1,b:1,f:.2, burn:0, sp:0,  tree:0},
  {n:'Grassland',     c:[124,174,78], v:6, w:1,b:1,f:1,  burn:8, sp:.05,tree:0},
  {n:'Forest',        c:[66,128,60],  v:6, w:1,b:1,f:.8, burn:36,sp:.09,tree:1},
  {n:'Hills',         c:[150,146,100],v:9, w:1,b:1,f:.3, burn:0, sp:0,  tree:0},
  {n:'Mountain',      c:[124,118,114],v:10,w:0,b:0,f:0,  burn:0, sp:0,  tree:0},
  {n:'Snowy peak',    c:[238,242,248],v:4, w:0,b:0,f:0,  burn:0, sp:0,  tree:0},
  {n:'Lava',          c:[255,104,24], v:26,w:0,b:0,f:0,  burn:0, sp:0,  tree:0},
  {n:'Scorched earth',c:[78,68,60],   v:6, w:1,b:1,f:1.2,burn:0, sp:0,  tree:0},
  {n:'Desert',        c:[224,192,122],v:7, w:1,b:1,f:.1, burn:0, sp:0,  tree:0},
  {n:'Savanna',       c:[178,172,86], v:8, w:1,b:1,f:.6, burn:10,sp:.07,tree:0},
  {n:'Jungle',        c:[36,112,64],  v:8, w:1,b:1,f:.8, burn:26,sp:.06,tree:1},
  {n:'Tundra',        c:[208,216,216],v:6, w:1,b:1,f:.2, burn:0, sp:0,  tree:0},
  {n:'Pine forest',   c:[62,104,86],  v:8, w:1,b:1,f:.5, burn:40,sp:.1, tree:1},
  {n:'Swamp',         c:[88,114,80],  v:8, w:1,b:1,f:.5, burn:0, sp:0,  tree:0},
  {n:'River',         c:[72,142,192], v:6, w:1,b:0,f:0,  burn:0, sp:0,  tree:0}
];
const WALK=new Uint8Array(NT),BUILD=new Uint8Array(NT),TREE=new Uint8Array(NT),BURN=new Uint8Array(NT),SPREAD=new Float32Array(NT),FERT=new Float32Array(NT);
TD.forEach((d,i)=>{WALK[i]=d.w;BUILD[i]=d.b;TREE[i]=d.tree;BURN[i]=d.burn;SPREAD[i]=d.sp;FERT[i]=d.f;});
const ELEV0=[40,84,102,108,110,150,205,240,150,108,108,108,110,110,112,102,100];
const DIRS=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

/* ---------- creatures ---------- */
const HUMAN=0,ELF=1,DWARF=2,ORC=3,SHEEP=4,WOLF=5,BEAR=6,DRAGON=7,ZOMBIE=8,NU=9;
const YEAR=60,TICKMS=125,MINVD=16;
const SPEC=[
  {name:'Human', pl:'Humans', hp:30, atk:5, move:.45,adult:8*YEAR, life:[55,75],  birth:1,   range:0,aggr:1},
  {name:'Elf',   pl:'Elves',  hp:30, atk:6.5,move:.5, adult:10*YEAR,life:[120,170],birth:.75, range:4,aggr:.6},
  {name:'Dwarf', pl:'Dwarves',hp:46, atk:6, move:.38,adult:9*YEAR, life:[80,110], birth:.62, range:0,aggr:.8},
  {name:'Orc',   pl:'Orcs',   hp:40, atk:7, move:.45,adult:6*YEAR, life:[40,55],  birth:1.1, range:0,aggr:1.45},
  {name:'Sheep', pl:'Sheep',  hp:10, atk:0, move:.2, adult:2*YEAR, life:[12,18]},
  {name:'Wolf',  pl:'Wolves', hp:26, atk:8, move:.7, adult:2*YEAR, life:[16,24]},
  {name:'Bear',  pl:'Bears',  hp:70, atk:12,move:.5, adult:3*YEAR, life:[22,30]},
  {name:'Dragon',pl:'Dragons',hp:400,atk:30,move:1,  adult:0,      life:[25,40]},
  {name:'Zombie',pl:'Zombies',hp:24, atk:6, move:.3, adult:0,      life:[5,8]}
];
function prefs(base,o){const a=new Float32Array(NT);for(let t=0;t<NT;t++)if(BUILD[t])a[t]=base;for(const k in o)a[k]=o[k];return a;}
const PREF=[
  prefs(.25,{[GRASS]:1,[SAVANNA]:.8,[FOREST]:.5,[SAND]:.35,[HILL]:.4,[ASH]:.6,[JUNGLE]:.3,[PINE]:.3,[TUNDRA]:.2,[DESERT]:.12,[SWAMP]:.2}),
  prefs(.04,{[FOREST]:1,[JUNGLE]:.9,[PINE]:.8,[GRASS]:.15}),
  prefs(.1,{[HILL]:1,[TUNDRA]:.5,[PINE]:.4,[GRASS]:.2,[SAVANNA]:.2}),
  prefs(.35,{[SAVANNA]:1,[SWAMP]:.9,[DESERT]:.7,[GRASS]:.5,[ASH]:.8,[HILL]:.5,[JUNGLE]:.5})
];
const AFF=[[.4,.25,.25,-.55],[.25,.6,-.1,-.7],[.25,-.1,.6,-.6],[-.55,-.7,-.6,.1]];
const COLORS=['#e5484d','#3e7bfa','#f5a524','#a05cf0','#17c3b2','#f06fb3','#f4f4f4','#2b2b33','#ff7a2e','#00a0e9','#b8e04a','#8a5a2b','#ff4fd8','#7de3ff'];
const NAME1=[
  ['Al','Bel','Cor','Dun','El','Fen','Gal','Hal','Ist','Kar','Lor','Mar','Nor','Os','Pel','Ros','Sil','Tor','Val','Wyn','Ash','Bry','Cal','Eld'],
  ['Ael','Lia','Syl','Thal','Elo','Nim','Ith','Cael','Lor','Fae','Yll','Aer','Mel','Quel'],
  ['Kaz','Dur','Bal','Thor','Grim','Kar','Bof','Dun','Mor','Nar','Gim','Thra','Bel','Kol'],
  ['Gr','Kr','Ug','Zog','Mor','Dra','Sna','Bru','Ghaz','Urk','Thok','Vrak','Naz']
];
const NAME2=[
  ['den','mere','ford','wick','holm','gard','ia','or','eth','stead','mont','vale','by','ton','haven','reach'],
  ['wen','dor','ial','ethil','anor','riel','ion','ara','ith','oth','alas','enor'],
  ['dum','grim','ak','heim','gard','bar','dol','rak','ur','zad','helm','ir'],
  ['uk','ash','gor','mok','zug','nak','dush','rag','gul','bog','tar']
];
const RULERS=[
  [['Isolde','Queen'],['Edmund','King'],['Mathilda','Queen'],['Roland','King'],['Agnes','Queen'],['Baldric','King'],['Elinor','Queen'],['Godfrey','King'],['Rowena','Queen'],['Osric','King'],['Hildegard','Queen'],['Alaric','King']],
  [['Aelindra','Lady'],['Thalion','Lord'],['Sylwen','Lady'],['Caelum','Lord'],['Nimue','Lady'],['Erevan','Lord'],['Liriel','Lady'],['Faelar','Lord']],
  [['Durin','Thane'],['Brunhild','Thane'],['Thrain','Thane'],['Dagna','Thane'],['Borin','Thane'],['Helga','Thane'],['Gloin','Thane'],['Sigrun','Thane']],
  [['Grak','Warchief'],['Ursha','Warchief'],['Morg','Warchief'],['Shagra','Warchief'],['Zug','Warchief'],['Bula','Warchief'],['Thok','Warchief'],['Gasha','Warchief']]
];
const TRAITS=[
  {id:'conqueror',adj:'the Fierce', word:'a conqueror who craves glory',     aggr:2,  focus:'army'},
  {id:'builder',  adj:'the Builder',word:'a builder who wants a wide realm', aggr:.7, focus:'grow'},
  {id:'merchant', adj:'the Golden', word:'a merchant who loves coin',        aggr:.5, focus:'wealth'},
  {id:'scholar',  adj:'the Wise',   word:'a scholar who prizes knowledge',   aggr:.4, focus:'lore'},
  {id:'zealot',   adj:'the Devout', word:'a zealot who distrusts outsiders', aggr:1.4,focus:'grow'},
  {id:'schemer',  adj:'the Sly',    word:'a schemer who preys on the weak',  aggr:1.2,focus:'wealth'}
];
const AGES=['Tribal','Bronze','Iron','Castle','Golden'],AGE_T=[100,500,1600,4000];
const FOCUS_WORD={grow:'Growing the realm',army:'Building its army',wealth:'Filling the treasury',lore:'Seeking knowledge'};
const GCOST={dock:10,market:10,mine:10,tower:15,temple:20,barracks:25,academy:40};
const BHP={hall:160,house:40,farm:15,tower:80,barracks:70,market:40,temple:50,academy:50,mine:40,dock:30};

/* ---------- settings ---------- */
const SIZES={cozy:[224,144],grand:[416,240],colossal:[640,352]};
const DEF={size:'grand',land:'continents',climate:'temperate',peoples:'few',history:'0',wild:true,
  night:true,clouds:true,labels:true,borders:true,minimap:true,detail:true,disasters:'rare',mood:'normal',popcap:'normal'};
const S=Object.assign({},DEF);
try{const j=JSON.parse(localStorage.getItem('tinydominion.settings')||'null');if(j&&typeof j==='object')for(const k in DEF)if(typeof j[k]===typeof DEF[k])S[k]=j[k];}catch(e){}
function saveSettings(){try{localStorage.setItem('tinydominion.settings',JSON.stringify(S));}catch(e){}}
const POPCAP={small:1200,normal:2200,large:3600},MOOD={gentle:.35,normal:1,bloodthirsty:2.4},DISASTER={off:0,rare:.09,wild:.4};

/* ---------- state ---------- */
let W=0,H=0,N=0,GW=0,GH=0;
let tile,soil,elev,fire,road,vown,region,wreg,wsize,shade,base,bmap,bfsQ,prevA,grid;
let units=[],vById=[null],kingdoms=[],wars=[],boats=[],twisters=[],towers=[],fireList=[],effects=[],sched=[],chronicle=[],bubbles=[],risen=[];
let dirtyWalk=[],dirtyOver=false,capMul=1;
let tick=0,uid=1,kc=0,dirtyAll=true,regionsDirty=true,regionStamp=0,shake=0,quiet=false,chronDirty=true,startSpot=null,animCap=300;
const counts=new Int32Array(NU);
const relM=new Map(),truM=new Map();
const civCount=()=>counts[0]+counts[1]+counts[2]+counts[3];

/* ---------- helpers ---------- */
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function mkNoise(rnd){
  const p=new Uint8Array(256);for(let i=0;i<256;i++)p[i]=i;
  for(let i=255;i>0;i--){const j=(rnd()*(i+1))|0;const t=p[i];p[i]=p[j];p[j]=t;}
  const lat=(x,y)=>p[(p[x&255]+y)&255]/255;
  return function(x,y){
    const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
    const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
    const a=lat(xi,yi),b=lat(xi+1,yi),c=lat(xi,yi+1),d=lat(xi+1,yi+1);
    return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
  };
}
function fbm(n,x,y,oct){let s=0,a=1,f=1,t=0;for(let o=0;o<oct;o++){s+=a*n(x*f,y*f);t+=a;a*=.5;f*=2;}return s/t;}
function hsh(x,y){let h=(Math.imul(x,374761393)+Math.imul(y,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
function hexRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function pick(a){return a[(Math.random()*a.length)|0];}
function inB(x,y){return x>=0&&y>=0&&x<W&&y<H;}
function walkable(x,y){return x>=0&&y>=0&&x<W&&y<H&&WALK[tile[y*W+x]]===1;}
function d2(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy;}
function nbr(i){
  const r=(Math.random()*4)|0,x=i%W;
  if(r===0)return x>0?i-1:-1;
  if(r===1)return x<W-1?i+1:-1;
  if(r===2)return i>=W?i-W:-1;
  return i<N-W?i+W:-1;
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function yearNow(){return 1+Math.floor(tick/YEAR);}
function fx(e){if(effects.length<700)effects.push(e);}
function genName(race){
  for(let n=0;n<30;n++){
    const s=pick(NAME1[race])+pick(NAME2[race]);let used=false;
    for(const k of kingdoms)if(k.name===s){used=true;break;}
    if(!used)for(let i=1;i<vById.length;i++)if(vById[i].name===s){used=true;break;}
    if(!used)return s;
  }
  return pick(NAME1[race])+pick(NAME2[race])+' '+(2+((Math.random()*8)|0));
}
