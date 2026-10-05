/* ================= climate: smoke, warming, ice and the seas =================
   From the Industrial Age, towns burn coal and oil. The smoke gathers in the air and the world
   slowly warms. Ice sheets in the cold north and on high ground melt as it warms and grow as it
   cools, and melted ice raises the seas, which can swallow coastal towns. Rulers may turn to
   clean power, alone or together at a summit. The god can also warm or chill the world directly. */
const POLLUTE={off:0,normal:1,heavy:2.4};
const C_DEG=.025;                    /* one degree of warming, in the units of tBase */
const CARBON_DEG=1/75;               /* degrees of lasting warming per unit of carbon in the air */
let rowW=new Float32Array(1),climY=0,iceNow=0,seaByGod=false,warmMark=0,lastSummit=-1e9,climHist=[];
function degWarm(){return gWarm/C_DEG;}
function iceUnit(){return Math.max(160,ice0/6);}
/* the sea follows the god's chosen level plus the water of every ice sheet that has melted */
function updSea(){
  const g=Math.max(64,Math.min(136,seaBase+Math.max(-12,Math.min(12,Math.round(melt/iceUnit())))));
  if(g!==seaGoal)seaGoal=g;
}
function resetClimate(){
  rowW=new Float32Array(H);climY=0;carbon=0;cWarm=0;uWarm=0;gWarm=0;melt=0;seaBase=100;seaByGod=false;warmMark=0;lastSummit=-1e9;climHist=[];
  let n=0;for(let i=0;i<N;i++)if(tile[i]===ICE)n++;
  ice0=Math.max(1,n);iceNow=n;
}
/* make the ice of a fresh world agree exactly with its climate, so nothing melts on the first day */
function settleIce(){
  for(let i=0;i<N;i++){
    const t=tile[i];if(t<=WATER||t===RIVER||t===LAVA||t===MOUNT||t===SNOW)continue;
    const b=bandOf(elev[i]);if(b<0||b>1)continue;
    if(iceAt(i)){if(t!==ICE){tile[i]=ICE;soil[i]=TUNDRA;}}
    else if(t===ICE){const n=b===0?biomeFor(i):HILL;tile[i]=n;soil[i]=soilFor(n);}
  }
}

/* ---------- every tick: a few rows of the world catch up with its temperature ---------- */
function climateStep(){
  if(rowW.length!==H)rowW=new Float32Array(H).fill(gWarm);
  const rows=Math.max(1,Math.ceil(H/120));
  for(let n=0;n<rows;n++){climateRow(climY,1);climY=(climY+1)%H;}
  updSea();
}
function climateRow(y,boost){
  const w=gWarm,w0=rowW[y],shift=Math.abs(w-w0)>.003;
  let i=y*W;
  for(let x=0;x<W;x++,i++){
    const t=tile[i];if(t<=WATER||t===LAVA||t===RIVER||t===ASH)continue;
    const b=bandOf(elev[i]);
    if(b<=1){
      const T=tEff(i),lim=ICE_T-(b===1?.04:0);
      if(t===ICE){
        /* ice melts faster the warmer it is */
        if(T>=lim&&Math.random()<Math.min(1,(.18+(T-lim)*6)*boost)){const n=b===0?biomeFor(i):HILL;setTile(i,n);soil[i]=soilFor(n);melt++;iceNow--;}
        continue;
      }
      if(T<lim){
        /* and creeps back slowly, faster in a deep freeze */
        if(!bmap[i]&&!road[i]&&(b===1?t===HILL:(t===TUNDRA||t===PINE||t===GRASS||t===SAND||t===SWAMP||t===FOREST||t===DESERT||t===SAVANNA))
          &&Math.random()<Math.min(1,(.03+(lim-T)*3)*boost)){setTile(i,ICE);soil[i]=TUNDRA;melt--;iceNow++;}
        continue;
      }
      /* warmer or colder years move the forests, grasslands and deserts, but not what the god painted */
      if(b===0&&shift&&!bmap[i]){
        const was=biomeFor(i,w0);
        if(was===t){const n=biomeFor(i);if(n!==t&&n!==ICE&&!(TREE[n]&&road[i])){setTile(i,n);soil[i]=soilFor(n);}}
      }
    }else if(b===2&&(t===MOUNT||t===SNOW)){
      const want=tEff(i)<.12?SNOW:MOUNT;
      if(want!==t&&Math.random()<.3*boost){tile[i]=want;touch(i);}
    }
  }
  rowW[y]=w;
}

/* ---------- every year: smoke rises, the air warms ---------- */
function climateYear(){
  const pm=POLLUTE[S.pollution]===undefined?1:POLLUTE[S.pollution];
  let e=0;
  for(const k of kingdoms){
    if(!k.alive){k.smoke=0;continue;}
    let s=0;
    if(k.age>=6){
      const am=k.age===6?1:k.age===7?1.7:1.25;
      for(const v of k.villages){v.smog=(v.factories*1.2+v.houses*.05)*am*(1-(k.clean||0))*pm;s+=v.smog;}
    }else for(const v of k.villages)v.smog=0;
    k.smoke=s;e+=s;
  }
  carbon=Math.max(0,carbon*.993+e*.01);
  const target=Math.min(9,carbon*CARBON_DEG)*C_DEG;
  cWarm+=(target-cWarm)*.06;
  gWarm=cWarm+uWarm;
  if((yearNow()&3)===0){let n=0;for(let i=0;i<N;i++)if(tile[i]===ICE)n++;iceNow=n;}
  /* milestones of a warming world */
  const smoke=cWarm/C_DEG;
  if(smoke>=warmMark+1&&smoke>=1){
    warmMark=Math.floor(smoke);
    chron('The smoke of '+(e>0?'the factories':'the old factories')+' has warmed the world by '+warmMark+' degree'+(warmMark>1?'s':''),'disaster');
  }
  climHist.push([yearNow(),Math.round(degWarm()*10)/10,SL-100]);
  if(climHist.length>3000)climHist.shift();
  summit();
}
function smokeWord(k){const s=k.smoke||0;return s<3?'clear':s<10?'hazy':s<25?'smoky':'choking';}

/* ---------- a summit: when the world grows warm, modern realms meet to cut their smoke ---------- */
function summit(){
  if(degWarm()<1.5||tick-lastSummit<35*YEAR)return;
  const ks=kingdoms.filter(k=>k.alive&&k.age>=7&&k.villages.length);
  if(ks.length<3)return;
  lastSummit=tick;
  let host=ks[0],hb=-1;
  for(const k of ks){const tm=tmOf(k),s=tm.curio+tm.caut+(k.smoke?0:.2);if(s>hb){hb=s;host=k;}}
  const yes=[],no=[];
  for(const k of ks){
    const p=weighClean(k,true);
    if(p&&p.u+.15>0){yes.push(k);k.clean=Math.min(1,(k.clean||0)+.2);}else no.push(k);
  }
  for(const a of yes)for(const b of yes)if(a.id<b.id)setRel(a,b,rel(a,b)+10);
  const town=host.villages[0];
  const name='Summit of '+(town?town.name:host.name);
  if(!yes.length){chron('A '+name+' on the warming world ends in failure','disaster',host);return;}
  chron('At the '+name+', '+yes.map(k=>k.name).join(', ')+' pledge to cut their smoke'+(no.length?'. '+no.map(k=>k.name).join(', ')+(no.length>1?' refuse':' refuses'):''),'peace',host);
  if(!lastSummitEver){lastSummitEver=true;banner('A warming world','The '+name,yes.length+(yes.length===1?' realm pledges':' realms pledge')+' to cut their smoke');}
  for(const k of no)k.rep=repOf(k)-3;
}
let lastSummitEver=false;

/* ---------- the god's hand on the climate ---------- */
function setGodWarm(deg){
  uWarm=deg*C_DEG;gWarm=cWarm+uWarm;
}
/* a burst of change so the god sees the ice start to move at once */
function climateKick(passes){for(let p=0;p<passes;p++)for(let y=0;y<H;y++)climateRow(y,2.5);updSea();}
function meltCaps(){
  let n=0;
  for(let i=0;i<N;i++)if(tile[i]===ICE){const b=bandOf(elev[i]),nt=b===0?TUNDRA:HILL;setTile(i,nt);soil[i]=TUNDRA;n++;}
  melt+=n;iceNow=0;updSea();
  for(let i=0;i<N;i++)if(tile[i]===SNOW&&bandOf(elev[i])===2){tile[i]=MOUNT;touch(i);}
  chron(n?'The heavens melt the ice caps. Meltwater pours into the seas':'There is no ice left to melt','disaster');
  return n;
}
/* the readout under the climate slider */
function climateText(){
  const d=degWarm(),sm=cWarm/C_DEG,ip=Math.round(iceNow/Math.max(1,ice0)*100);
  return 'World '+(d>=0?'+':'−')+Math.abs(d).toFixed(1)+' °C'+(sm>=.1?' ('+sm.toFixed(1)+' from smoke)':'')+
    ' · Seas '+(SL>=100?'+':'−')+fmtM(Math.abs(SL-100)*60).replace('-','')+' · Ice '+Math.min(999,ip)+'%';
}
