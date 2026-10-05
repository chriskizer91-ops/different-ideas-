/* ================= riches of the earth =================
   Deposits lie on single tiles. A realm works a deposit once the tile is inside one of its towns'
   lands and it has reached the age that can use it. Riches strengthen armies, fill treasuries and
   speed learning and wonders. Rulers covet what they lack, settlers seek it out, and allies and
   trade partners share what they have. */
const COPPER=1,IRON=2,HORSES=3,GOLD=4,MARBLE=5,COAL=6,OIL=7,URANIUM=8;
/* use: the age a realm can first work it; until: the last age it matters; val: how much rulers want it */
const RES=[null,
  {id:'copper', n:'Copper', use:1,until:3,val:.12,col:'#d0783a',does:'stronger bronze weapons and quicker learning'},
  {id:'iron',   n:'Iron',   use:2,until:8,val:.22,col:'#a4492c',does:'stronger armies'},
  {id:'horses', n:'Horses', use:1,until:6,val:.14,col:'#8a5a34',does:'cavalry: stronger armies'},
  {id:'gold',   n:'Gold',   use:0,until:8,val:.16,col:'#f2c434',does:'gold every year'},
  {id:'marble', n:'Marble', use:3,until:8,val:.09,col:'#e8e6e0',does:'wonders built faster'},
  {id:'coal',   n:'Coal',   use:6,until:8,val:.22,col:'#2c2a2e',does:'faster research and more gold in the Industrial Age'},
  {id:'oil',    n:'Oil',    use:7,until:8,val:.34,col:'#3a2a4a',does:'much stronger armies and air power'},
  {id:'uranium',n:'Uranium',use:8,until:8,val:.26,col:'#6ee05a',does:'faster space programme'}];
/* where each lies: one tile in N of these terrains */
const ORE_ON=[null,
  {[HILL]:150,[MOUNT]:420},
  {[HILL]:115,[MOUNT]:230},
  {[GRASS]:300,[SAVANNA]:230,[TUNDRA]:900},
  {[MOUNT]:300,[HILL]:480,[DESERT]:1400},
  {[HILL]:330,[MOUNT]:480},
  {[HILL]:170,[PINE]:650,[FOREST]:950,[SWAMP]:520},
  {[DESERT]:170,[TUNDRA]:420,[SWAMP]:280,[ICE]:500},
  {[MOUNT]:430,[DESERT]:750,[HILL]:1600}];
function placeDeposits(rnd){
  ore.fill(0);
  const far=(x,y)=>{for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const nx=x+dx,ny=y+dy;if(inB(nx,ny)&&ore[ny*W+nx])return false;}return true;};
  for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){
    const i=y*W+x,t=tile[i];if(t<=WATER||t===RIVER||t===LAVA)continue;
    for(let r=1;r<RES.length;r++){
      const n=ORE_ON[r][t];if(!n||rnd()*n>=1)continue;
      if(far(x,y)){ore[i]=r;break;}
    }
  }
  rebuildDeposits();
}
function rebuildDeposits(){deposits=[];for(let i=0;i<N;i++)if(ore[i])deposits.push(i);}
function setOre(i,r){if(ore[i]===r)return;ore[i]=r;rebuildDeposits();touch(i);}
/* who holds a deposit right now (the realm whose town's lands cover it) */
function oreOwner(i){const vid=vown[i];if(!vid)return null;const v=vById[vid];return v&&v.alive?v.k:null;}
function oreWorked(i){const k=oreOwner(i);return!!k&&tile[i]>WATER&&k.age>=RES[ore[i]].use;}

/* ---------- yearly tally: what each realm holds, works and imports ---------- */
function riches(alive){
  for(const k of alive){(k.rOwn||(k.rOwn=new Uint8Array(RES.length))).fill(0);(k.rImp||(k.rImp=new Uint8Array(RES.length))).fill(0);}
  for(const i of deposits){
    const r=ore[i];if(!r||tile[i]<=WATER)continue;
    const k=oreOwner(i);if(k&&k.rOwn&&k.rOwn[r]<255)k.rOwn[r]++;
  }
  for(const k of alive){
    for(const o of k.allies)if(o.alive&&o.rOwn)imp(k,o);
    if(k.pacts)for(const id of k.pacts){const o=kingdoms[id-1];if(o&&o.alive&&o.rOwn&&!k.wars.has(o))imp(k,o);}
    /* gold mines pay every year; coal pays in the age of steam */
    k.gold+=hasRes(k,GOLD)*(k.rOwn[GOLD]?Math.min(4,k.rOwn[GOLD]):1)*(4+k.age*2);
    if(hasRes(k,COAL))k.gold+=hasRes(k,COAL)*(6+k.age*2);
    /* the first time a realm works a great resource, the world hears of it */
    for(let r=1;r<RES.length;r++){
      if(!k.rOwn[r]||k.age<RES[r].use||(k.rSeen&(1<<r)))continue;
      k.rSeen=(k.rSeen||0)|(1<<r);
      if(r===GOLD||r===OIL||r===URANIUM||r===COAL||(r===IRON&&k.age>=2)){
        const at=resTown(k,r);
        chron(k.name+(r===GOLD?' finds gold':r===OIL?' strikes oil':r===URANIUM?' mines uranium':r===COAL?' digs its first coal':' forges iron')+(at?' near '+at.name:''),'tech',at||k,r===IRON);
      }
    }
  }
}
function imp(k,o){for(let r=1;r<RES.length;r++)if(o.rOwn[r]&&!k.rOwn[r]&&o.age>=RES[r].use)k.rImp[r]=1;}
function resTown(k,r){for(const i of deposits)if(ore[i]===r&&oreOwner(i)===k){const v=vById[vown[i]];if(v)return v;}return null;}
/* 1 if the realm works it, half if it trades for it, 0 if it has none or cannot use it yet */
function hasRes(k,r){
  if(!k.rOwn||k.age<RES[r].use||k.age>RES[r].until)return 0;
  return k.rOwn[r]?1:k.rImp&&k.rImp[r]?.5:0;
}
function resPow(k){return 1+(k.age<=3?.08*hasRes(k,COPPER):0)+.15*hasRes(k,IRON)+.1*hasRes(k,HORSES)+.25*hasRes(k,OIL);}
function resLore(k){return 1+.15*hasRes(k,COAL)+.06*hasRes(k,COPPER);}
/* what another realm holds that we lack and could soon use */
function resWant(k,o){
  if(!o.rOwn||!k.rOwn)return null;
  let best=0,bv=0,sum=0;
  for(let r=1;r<RES.length;r++){
    if(!o.rOwn[r]||k.rOwn[r])continue;
    const R=RES[r];if(k.age<R.use-1||k.age>R.until)continue;
    const v=R.val*(k.rImp&&k.rImp[r]?.4:1);sum+=v;if(v>bv){bv=v;best=r;}
  }
  return best?{r:best,v:Math.min(.6,sum)}:null;
}
/* unclaimed riches within reach of a realm's towns */
function freeRiches(k,range){
  let v=0,best=0,bv=0;const R2=range*range;
  for(const i of deposits){
    const r=ore[i];if(!r||vown[i]||tile[i]<=WATER||k.age<RES[r].use-1||k.age>RES[r].until||(k.rOwn&&k.rOwn[r]))continue;
    const x=i%W,y=(i/W)|0;let near=false;
    for(const t of k.villages)if((t.x-x)*(t.x-x)+(t.y-y)*(t.y-y)<R2){near=true;break;}
    if(!near)continue;v+=RES[r].val;if(RES[r].val>bv){bv=RES[r].val;best=r;}
  }
  return best?{r:best,v:Math.min(.5,v)}:null;
}
/* settlers favour sites with riches nearby that their realm can use */
function siteRiches(k,x,y){
  let s=0;
  for(const i of deposits){
    const r=ore[i],dx=i%W-x,dy=((i/W)|0)-y;
    if(dx*dx+dy*dy>36||!r||vown[i]||tile[i]<=WATER||k.age<RES[r].use-1||k.age>RES[r].until)continue;
    s+=RES[r].val*(k.rOwn&&k.rOwn[r]?.4:1.6);
  }
  return Math.min(.8,s);
}
/* places to aim settlers at: free deposits within reach of a town */
function richesNear(v,r0,r1){
  const out=[],k=v.k;
  for(const i of deposits){
    const r=ore[i];if(!r||vown[i]||tile[i]<=WATER||k.age<RES[r].use-1||k.age>RES[r].until)continue;
    const x=i%W,y=(i/W)|0,d=Math.hypot(x-v.x,y-v.y);
    if(d>=r0&&d<=r1)out.push({x,y,r});
  }
  return out;
}
