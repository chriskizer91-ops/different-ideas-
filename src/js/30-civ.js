/* ================= villages and kingdoms ================= */
function rulerName(k){return k.ruler.title+' '+k.ruler.name;}
function newRuler(race,keep,parentTm,cult,nat){
  const p=pick(RULERS[race]);
  const trait=keep&&Math.random()<.3?keep:pickTrait(nat===undefined?1:nat);
  return{name:p[0],title:p[1],trait,tm:rollTemper(trait,race,parentTm||null,cult||null),since:tick,until:tick+((16+Math.random()*30)*YEAR|0)};
}
function newKingdom(race,name){
  const color=COLORS[kc++%COLORS.length];
  const k={id:kingdoms.length+1,name:name||genName(race),race,color,rgb:hexRgb(color),villages:[],alive:true,
    gold:10,lore:0,age:0,tech:0,pow:1,pop:0,str:0,focus:'grow',focusUntil:0,restUntil:tick+(tick<30*YEAR?28:8)*YEAR,
    ruler:null,wars:new Set(),allies:new Set(),nb:[],regs:new Set(),
    target:null,port:null,landing:null,rally:null,rallyUntil:0,pauseUntil:0,boatCd:0,nAdult:0,nSold:0,nBarr:0,nCar:0,nSiege:0,broke:false,born:tick,
    launches:0,colony:false,peak:0,hist:[],
    mem:{},rep:50,goal:null,weary:0,pacts:[],kin:[],nudge:null,mind:null,cool:{},nat:null,culture:null};
  natOf(k);cultureOf(k);
  k.ruler=newRuler(race,null,null,k.culture,k.nat);
  kingdoms.push(k);
  if(!name)chron(rulerName(k)+' founds the '+SPEC[race].name.toLowerCase()+' realm of '+k.name,'found',k.villages[0]);
  return k;
}
function kPop(k){let n=0;for(const v of k.villages)n+=v.pop;return n;}
/* every figure on the map stands for a crowd that grows with the age */
function citizens(v){return v.pop*PPL[v.k.age];}
function kCitizens(k){let n=0;for(const v of k.villages)n+=v.pop;return n*PPL[k.age];}
function fmtPop(n){return n>=1e6?(n/1e6).toFixed(n>=1e7?0:1)+'M':n>=1e4?Math.round(n/1e3)+'k':n>=1e3?(n/1e3).toFixed(1)+'k':String(n|0);}
function settlementWord(v){const h=v.houses,a=v.k.age;return h>=30&&a>=6?'Metropolis':h>=20?'City':h>=12?'Town':h>=5?'Village':'Hamlet';}
function updPow(k){k.pow=(1+.15*k.age)*(k.nBarr>0?1.2:1)*(k.ruler.trait.id==='conqueror'?1.1:1)*(k.broke?.85:1)*resPow(k);}
function hallHp(v){return BHP.hall*(1+.3*v.k.age)*(v.race===DWARF?1.25:1);}
function claim(v,x,y,r){
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(dx*dx+dy*dy>r*r+r)continue;
    const nx=x+dx,ny=y+dy;if(!inB(nx,ny))continue;
    const i=ny*W+nx;if(!vown[i]&&tile[i]!==DEEP)vown[i]=v.id;
  }
  touchRows(y-r-1,y+r+1);
}
function countTrees(v){
  let n=0;
  for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){const x=v.x+dx,y=v.y+dy;if(inB(x,y)&&TREE[tile[y*W+x]])n++;}
  return n*.22;
}
function recalc(v){
  v.houses=v.farms=v.towers=v.mines=v.factories=v.walls=0;
  v.market=v.barracks=v.temple=v.academy=v.dock=v.windmill=v.lighthouse=v.arena=v.wonder=v.pad=null;
  let food=4;
  for(const b of v.blds){
    switch(b.kind){
      case'house':v.houses++;break;
      case'farm':v.farms++;food+=3*b.fert;break;
      case'tower':v.towers++;break;
      case'mine':v.mines++;break;
      case'dock':v.dock=b;food+=9;break;
      case'market':v.market=b;break;
      case'barracks':v.barracks=b;break;
      case'temple':v.temple=b;break;
      case'academy':v.academy=b;break;
      case'windmill':v.windmill=b;food+=6;break;
      case'lighthouse':v.lighthouse=b;break;
      case'factory':v.factories++;break;
      case'arena':v.arena=b;break;
      case'wonder':v.wonder=b;break;
      case'launchpad':v.pad=b;break;
      case'wall':v.walls++;break;
    }
  }
  if(v.race===ELF)food+=v.treeFood;
  v.food=food;
}
function addBuilding(v,kind,x,y,ex){
  const i=y*W+x,big=BIG[kind]?2:1;
  const b={kind,x,y,i,v,hp:BHP[kind]||50,solid:kind!=='farm'&&kind!=='dock'&&kind!=='mine',fert:1,wi:-1,grove:false,cd:0,big,prog:0};
  if(kind==='hall')b.hp=hallHp(v);
  if(ex)Object.assign(b,ex);
  b.tiles=[];
  for(let dy=0;dy<big;dy++)for(let dx=0;dx<big;dx++){
    const j=(y+dy)*W+x+dx,t=tile[j];
    b.tiles.push(j);bmap[j]=b;
    if(kind==='farm'){
      if(b.grove)b.fert=.8;
      else{b.fert=Math.max(.3,FERT[TREE[t]?soil[j]:t])*(v.race===ORC?.75:1);if(TREE[t]||t===ASH)setTile(j,soil[j]);}
    }else if((TREE[t]&&v.race!==ELF)||t===ASH)setTile(j,soil[j]);
    if(road[j])road[j]=0;
    touch(j);
  }
  v.blds.push(b);
  if(b.prog<1)raising.push(b);
  if(kind==='tower')towers.push(b);
  claim(v,x,y,kind==='hall'?6:kind==='farm'?3:kind==='wall'?2:4);
  recalc(v);
  return b;
}
function buildRoad(v,from){
  let x=v.x,y=v.y,cur=flowAt(from,x,y);
  if(cur===65535||cur>150)return;
  const tier=TIER[v.k.age]||0;
  for(let st=0;st<220&&cur>1;st++){
    let bx=0,by=0,bd=cur;
    for(let n=0;n<8;n++){
      const o=DIRS[(n*2+(n>3?1:0))&7],d=flowAt(from,x+o[0],y+o[1]);
      if(d<bd){bd=d;bx=o[0];by=o[1];}
    }
    if(!bx&&!by)break;
    x+=bx;y+=by;cur=bd;
    const i=y*W+x;if(!bmap[i]&&road[i]!==2){road[i]=1|(tier<<2);touch(i);}
  }
}
/* when a realm advances, its highways are rebuilt to the new standard */
function upgradeRoads(k){
  const tier=TIER[k.age]||0;
  for(let i=0;i<N;i++){
    const r=road[i];if((r&3)!==1||(r>>2)>=tier)continue;
    const vid=vown[i];if(vid){const v=vById[vid];if(!v||!v.alive||v.k!==k)continue;}
    else{let near=false;for(const v of k.villages)if(Math.abs(v.x-i%W)<60&&Math.abs(v.y-((i/W)|0))<60){near=true;break;}if(!near)continue;}
    road[i]=1|(tier<<2);
  }
  dirtyAll=true;
}
function foundVillage(u){
  const k=u.k&&u.k.alive?u.k:newKingdom(u.t);
  const v={id:vById.length,name:'',k,race:u.t,x:u.x,y:u.y,blds:[],pop:0,cap:6,res:8,rad:3,food:4,treeFood:0,
    houses:0,farms:0,towers:0,mines:0,factories:0,walls:0,market:null,barracks:null,temple:null,academy:null,dock:null,
    alive:true,born:tick,empty:0,flow:null,flowStamp:-1,noDock:0,noMine:0,noBig:0,noLight:0,heads:null,ring:null,walled:false};
  v.name=k.villages.length?genName(u.t):k.name;
  vById.push(v);k.villages.push(v);
  if(v.race===ELF)v.treeFood=countTrees(v);
  addBuilding(v,'hall',u.x,u.y,{prog:.3});
  initStreets(v);
  if(u.v)u.v.pop--;
  const g=u.settle&&u.settle.grp;
  u.v=v;u.k=k;u.settle=null;v.pop=1;
  for(const o of units){
    if(o===u||o.dead||o.v||o.t!==u.t||d2(o,u)>=144||v.pop>=v.cap)continue;
    if((g&&o.settle&&o.settle.grp===g)||(!g&&o.settle&&o.settle.found&&o.k===k)||(!o.k&&!o.settle)){o.v=v;o.k=k;o.settle=null;v.pop++;}
  }
  if(g&&g.from&&g.from.alive)buildRoad(v,g.from);
  if(k.villages.length>1)chron(k.name+' settles '+v.name,'found',v);
  snd('found',v.x,v.y,.6);
}
function ownOK(v,i){const o=vown[i];if(!o||o===v.id)return true;const ov=vById[o];return!!ov&&ov.alive&&ov.k===v.k;}
function clearAround(x,y){
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const b=bmap[(y+dy)*W+x+dx];if(b&&b.solid)return false;}
  return true;
}
/* ---------- town planning: streets grow out from the hall in a grid, houses line them ---------- */
function layStreet(v,x,y){
  if(x<1||y<1||x>=W-1||y>=H-1)return false;
  const i=y*W+x;
  if(bmap[i]||fire[i]||ore[i]||!BUILD[tile[i]]||!ownOK(v,i))return false;
  if((road[i]&3)!==2){road[i]=2;touch(i);}
  return true;
}
function initStreets(v){
  v.heads=[];
  if(v.race===ELF)return;
  for(const d of[[1,0],[-1,0],[0,1],[0,-1]]){
    if(layStreet(v,v.x+d[0],v.y+d[1])&&layStreet(v,v.x+d[0]*2,v.y+d[1]*2))v.heads.push({x:v.x+d[0]*2,y:v.y+d[1]*2,dx:d[0],dy:d[1],n:2});
  }
}
function growStreets(v){
  const hs=v.heads;if(!hs||!hs.length)return false;
  const hi=(Math.random()*hs.length)|0,h=hs[hi];
  let dx=h.dx,dy=h.dy;
  if(v.race===ORC&&Math.random()<.25){if(dx){dy=Math.random()<.5?1:-1;dx=0;}else{dx=Math.random()<.5?1:-1;dy=0;}}
  const nx=h.x+dx,ny=h.y+dy,lim=v.rad+3.5;
  if((nx-v.x)*(nx-v.x)+(ny-v.y)*(ny-v.y)>lim*lim){if(Math.random()<.3)hs.splice(hi,1);return false;}
  if(!layStreet(v,nx,ny)){hs.splice(hi,1);return false;}
  h.x=nx;h.y=ny;h.dx=dx;h.dy=dy;h.n++;
  const gap=v.race===DWARF?3:4;
  if(h.n%gap===0&&hs.length<16)for(const sd of[1,-1])if(Math.random()<.7)hs.push({x:nx,y:ny,dx:dy*sd,dy:dx*sd,n:0});
  return true;
}
function nearStreet(i){return(road[i-1]&3)===2||(road[i+1]&3)===2||(road[i-W]&3)===2||(road[i+W]&3)===2;}
function placeTown(v,kind){
  const R=v.rad+1.5;
  for(let pass=0;pass<3;pass++){
    for(let n=0;n<36;n++){
      const a=Math.random()*6.283,r=1.5+Math.random()*R*(kind==='house'?.9:1);
      const x=Math.round(v.x+Math.cos(a)*r),y=Math.round(v.y+Math.sin(a)*r);
      if(x<1||y<1||x>=W-1||y>=H-1)continue;
      if(Math.abs(x-v.x)<=1&&Math.abs(y-v.y)<=1)continue;
      const i=y*W+x,t=tile[i];
      if(bmap[i]||road[i]||fire[i]||ore[i]||!BUILD[t]||!ownOK(v,i)||!nearStreet(i))continue;
      addBuilding(v,kind,x,y);return true;
    }
    for(let m=0;m<4;m++)growStreets(v);
  }
  return false;
}
/* a 2x2 site for arenas, launch pads and wonders */
function placeBig(v,kind,ex,coast){
  const R=v.rad+4;
  for(let n=0;n<120;n++){
    const a=Math.random()*6.283,r=2.5+Math.random()*R;
    const x=Math.round(v.x+Math.cos(a)*r),y=Math.round(v.y+Math.sin(a)*r);
    if(x<1||y<1||x>=W-2||y>=H-2)continue;
    let ok=true,wet=false;
    for(let dy=0;dy<2&&ok;dy++)for(let dx=0;dx<2;dx++){
      const i=(y+dy)*W+x+dx;
      if(bmap[i]||road[i]||fire[i]||ore[i]||!BUILD[tile[i]]||!ownOK(v,i)){ok=false;break;}
      if(coast&&coastWater(i,-1)>=0)wet=true;
    }
    if(!ok||(coast&&!wet))continue;
    addBuilding(v,kind,x,y,ex);return true;
  }
  return false;
}
function placeBld(v,kind){
  const elf=v.race===ELF;
  if(BIG[kind])return placeBig(v,kind,null,false);
  if(!elf&&(kind==='house'||kind==='market'||kind==='temple'||kind==='barracks'||kind==='academy'||kind==='factory')){
    if(placeTown(v,kind))return true;
  }
  let R=v.rad,rmin=1.5;
  if(kind==='farm'){R+=2.5;rmin=2;}else if(kind==='dock'||kind==='lighthouse')R+=5;else if(kind==='mine')R+=4;else if(kind==='tower')rmin=R*.6;
  else if(kind==='windmill'){R+=3;rmin=R*.7;}
  for(let n=0;n<(kind==='dock'||kind==='lighthouse'?90:40);n++){
    const a=Math.random()*6.283,r=rmin+Math.random()*(R-rmin+.01);
    const x=Math.round(v.x+Math.cos(a)*r),y=Math.round(v.y+Math.sin(a)*r);
    if(x<1||y<1||x>=W-1||y>=H-1)continue;
    const i=y*W+x,t=tile[i];
    if(bmap[i]||road[i]||fire[i]||ore[i]||!BUILD[t]||!ownOK(v,i))continue;
    if(kind==='farm'){
      if(elf){if(!TREE[t])continue;addBuilding(v,'farm',x,y,{grove:true});return true;}
      if(FERT[TREE[t]?soil[i]:t]<.45)continue;
      addBuilding(v,'farm',x,y);return true;
    }
    if(kind==='mine'){
      if(t!==HILL){
        let ok=false;
        for(let k2=0;k2<8;k2+=2){const tj=tile[i+DIRS[k2][0]+DIRS[k2][1]*W];if(tj===MOUNT||tj===SNOW)ok=true;}
        if(!ok)continue;
      }
      addBuilding(v,'mine',x,y);return true;
    }
    if(kind==='dock'){
      const wi=coastWater(i,-1);if(wi<0)continue;
      addBuilding(v,'dock',x,y,{wi});return true;
    }
    if(kind==='lighthouse'){
      if(coastWater(i,-1)<0||!clearAround(x,y))continue;
      addBuilding(v,'lighthouse',x,y);return true;
    }
    if(!clearAround(x,y))continue;
    addBuilding(v,kind,x,y);return true;
  }
  return false;
}
/* ---------- city walls: a ring of stone with gates where the streets pass ---------- */
function buildWalls(v,k){
  if(!v.ring){
    const R=Math.max(5,Math.round(v.rad+1.2));v.ringR=R;v.ring=[];
    for(let dy=-R-1;dy<=R+1;dy++)for(let dx=-R-1;dx<=R+1;dx++){
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d>=R-.5&&d<R+.5)v.ring.push([v.x+dx,v.y+dy,Math.atan2(dy,dx)]);
    }
    v.ring.sort((a,b)=>a[2]-b[2]);v.ringAt=0;
  }
  let placed=0;
  while(v.ringAt<v.ring.length&&placed<3){
    const[x,y,a]=v.ring[v.ringAt++];
    if(x<1||y<1||x>=W-1||y>=H-1)continue;
    const i=y*W+x;
    if(bmap[i]||road[i]||fire[i]||!WALK[tile[i]]||tile[i]===RIVER||!ownOK(v,i))continue;
    const corner=Math.abs(Math.sin(a*2))<.12&&k.age>=2;
    addBuilding(v,corner?'tower':'wall',x,y);placed++;v.res-=3;
  }
  if(v.ringAt>=v.ring.length)v.walled=true;
}
function destroyBld(b){
  if(bmap[b.i]!==b)return;
  const v=b.v;
  if(b.kind==='hall'){ruinVillage(v);return;}
  for(const j of b.tiles||[b.i]){if(bmap[j]===b)bmap[j]=null;touch(j);}
  const n=v.blds.indexOf(b);if(n>=0)v.blds.splice(n,1);
  if(b.kind==='tower'){const m=towers.indexOf(b);if(m>=0)towers.splice(m,1);}
  if(b.kind==='wonder'&&wonderOf[b.wid]===b){delete wonderOf[b.wid];chron(WMAP[b.wid].n[0].toUpperCase()+WMAP[b.wid].n.slice(1)+' in '+v.name+' is destroyed','ruin',v);}
  if(b.kind==='launchpad'&&v.k.pad===b)v.k.pad=null;
  recalc(v);
}
function damageBld(b,d,u){
  const vk=b.v.k;
  if(u){vk.rally=b.v;vk.rallyUntil=tick+240;}
  b.hp-=d;if(b.hp>0)return;
  if(b.kind==='hall'&&u&&u.k&&u.k.alive&&u.k!==vk){b.hp=hallHp(b.v);captureVillage(b.v,u.k);}
  else destroyBld(b);
}
function ruinVillage(v){
  if(!v.alive)return;
  v.alive=false;
  for(const b of v.blds){
    for(const j of b.tiles||[b.i])if(bmap[j]===b)bmap[j]=null;
    if(b.kind==='tower'){const m=towers.indexOf(b);if(m>=0)towers.splice(m,1);}
    if(b.kind==='wonder'&&wonderOf[b.wid]===b)delete wonderOf[b.wid];
    if(b.kind==='launchpad'&&v.k.pad===b)v.k.pad=null;
  }
  v.blds=[];v.flow=null;recalc(v);
  for(let i=0;i<N;i++)if(vown[i]===v.id)vown[i]=0;
  const k=v.k,n=k.villages.indexOf(v);if(n>=0)k.villages.splice(n,1);
  for(const u of units)if(u.v===v){u.v=null;u.soldier=false;}
  v.pop=0;dirtyAll=true;
  chron(v.name+' lies in ruins','ruin',v);snd('ruin',v.x,v.y,.8);
  if(k.villages.length===0)killKingdom(k);
}
function killKingdom(k){
  if(!k.alive)return;
  k.alive=false;
  for(const u of units)if(u.k===k){u.k=null;u.v=null;u.soldier=false;}
  for(const b of boats)if(b.k===k)for(const u of b.cargo){u.k=null;u.v=null;}
  for(let n=wars.length-1;n>=0;n--){const w=wars[n];if(w.a===k||w.b===k)wars.splice(n,1);}
  for(const o of kingdoms){
    o.allies.delete(k);
    if(o.wars.delete(k)&&o.alive){if(!o.wars.size)standDown(o);else if(o.target&&o.target.k===k)o.target=null;}
  }
  k.wars.clear();k.allies.clear();k.pad=null;
  chron('The realm of '+k.name+' has fallen','ruin');
}
function captureVillage(v,k){
  const old=v.k;if(old===k)return;
  const n=old.villages.indexOf(v);if(n>=0)old.villages.splice(n,1);
  const same=v.race===k.race;
  v.k=k;v.race=k.race;k.villages.push(v);
  if(v.pad&&old.pad===v.pad){old.pad=null;if(!k.pad)k.pad=v.pad;}
  let pop=0;
  for(const u of units){
    if(u.v!==v||u.dead)continue;
    if(same){u.k=k;u.soldier=false;pop++;}else{u.v=null;u.k=null;u.soldier=false;}
  }
  v.pop=pop;dirtyAll=true;
  for(const w of wars){if(w.a===k&&w.b===old)w.sa+=25;else if(w.b===k&&w.a===old)w.sb+=25;}
  remember(old,k,40,0,'took '+v.name);
  chron(k.name+(v.name===k.name?' takes back '+v.name+' from '+old.name:' captures '+(v.name===old.name?'the capital of '+old.name:v.name+' from '+old.name))+(v.wonder?', and with it '+WMAP[v.wonder.wid].n:''),'war',v);
  k.pauseUntil=tick+((2+Math.random()*3)*YEAR|0);k.target=null;
  if(old.villages.length===0)killKingdom(old);
  dirtyAll=true;
}
function chop(v){
  const a=Math.random()*6.283,r=Math.random()*(v.rad+2);
  const x=Math.round(v.x+Math.cos(a)*r),y=Math.round(v.y+Math.sin(a)*r);
  if(!inB(x,y))return;const i=y*W+x;
  if(TREE[tile[i]]&&!bmap[i]&&!fire[i]&&vown[i]===v.id){setTile(i,soil[i]);v.res+=2;if(Math.random()<.3)snd('chop',x,y,.4);}
}
function farFromVillages(x,y){
  for(let n=1;n<vById.length;n++){const o=vById[n];if(o.alive&&(o.x-x)*(o.x-x)+(o.y-y)*(o.y-y)<MINVD*MINVD)return false;}
  return true;
}
function sendSettlers(v){
  const k=v.k,reg=region[v.y*W+v.x],pr=PREF[v.race];
  let best=null,bs=0;
  for(let n=0;n<24;n++){
    const a=Math.random()*6.283,r=18+Math.random()*24;
    const x=Math.round(v.x+Math.cos(a)*r),y=Math.round(v.y+Math.sin(a)*r);
    if(x<2||y<2||x>=W-2||y>=H-2)continue;
    const i=y*W+x,t=tile[i];
    if(!BUILD[t]||vown[i]||region[i]!==reg)continue;
    const p=pr[t]+Math.random()*.15+siteRiches(k,x,y);if(p<=bs)continue;
    if(!farFromVillages(x,y))continue;
    bs=p;best={x,y};
  }
  /* riches draw settlers: try sites beside free deposits within reach */
  for(const d of richesNear(v,14,48)){
    for(let m=0;m<3;m++){
      const x=d.x+((Math.random()*7)|0)-3,y=d.y+((Math.random()*7)|0)-3;
      if(x<2||y<2||x>=W-2||y>=H-2)continue;
      const i=y*W+x,t=tile[i];
      if(!BUILD[t]||vown[i]||ore[i]||region[i]!==reg||!farFromVillages(x,y))continue;
      const p=pr[t]+.1+siteRiches(k,x,y);
      if(p>bs){bs=p;best={x,y};}
      break;
    }
  }
  const adult=SPEC[v.race].adult;
  if(best&&bs>.2){
    const grp={x:best.x,y:best.y,from:v,flow:null,flowStamp:-1};let sent=0;
    for(const u of units){
      if(u.v===v&&!u.dead&&!u.soldier&&u.age>=adult){
        u.v=null;v.pop--;u.settle={x:best.x,y:best.y,t:520,found:true,grp};
        if(++sent>=4)break;
      }
    }
    return;
  }
  /* no room on this shore: sail for a new one */
  const dk=v.dock;if(!dk||k.age<1)return;
  const wr=wreg[dk.wi];let nb=null;bs=0;
  for(let n=0;n<160;n++){
    const a=Math.random()*6.283,r=24+Math.random()*170;
    const x=Math.round(v.x+Math.cos(a)*r),y=Math.round(v.y+Math.sin(a)*r);
    if(x<2||y<2||x>=W-2||y>=H-2)continue;
    const wi=y*W+x;if(tile[wi]>WATER||wreg[wi]!==wr)continue;
    for(let k2=0;k2<8;k2+=2){
      const lx=x+DIRS[k2][0],ly=y+DIRS[k2][1],li=ly*W+lx,t=tile[li];
      if(!BUILD[t]||vown[li]||region[li]===reg)continue;
      const p=pr[t]+Math.random()*.15;if(p<=bs)continue;
      if(!farFromVillages(lx,ly))continue;
      bs=p;nb={x:lx,y:ly,wi};
    }
  }
  if(!nb)return;
  const path=seaPath(dk.wi,nb.wi);if(!path)return;
  const grp=[];
  for(const u of units){if(u.v===v&&!u.dead&&!u.soldier&&u.age>=adult){grp.push(u);if(grp.length>=5)break;}}
  if(grp.length<3)return;
  launchBoat(k,path,grp,'settle',nb);
  chron('Settlers from '+v.name+' set sail for new shores','found',v);
}
const WMAP={};WONDERS.forEach(w=>WMAP[w.id]=w);
/* the earliest wonder this realm could raise that nobody has claimed */
function wonderFor(k){for(const w of WONDERS)if(w.age<=k.age&&!wonderOf[w.id])return w;return null;}
function villageBuild(v,k){
  if(v.res<6)return;
  const age=k.age,maxH=16+age*4,cap0=v===k.villages[0];
  /* towns swell as the ages advance, not only when their people run out of room */
  const wantH=Math.min(maxH,3+age*2.6+v.pop*.35+(cap0?6:0));
  if((v.pop>=v.cap-2||v.houses<wantH)&&v.houses<maxH){
    if(v.res<10)return;
    if(placeBld(v,'house')){v.res-=10;return;}
  }
  if(v.food<v.pop*.5+4&&v.farms<16+age*2&&placeBld(v,'farm')){v.res-=6;return;}
  if(v.res<14)return;
  if(age>=3&&!v.walled&&v.houses>=10&&k.gold>20&&(k.wars.size||Math.random()<.35)){buildWalls(v,k);return;}
  /* great towns pour the realm's gold into the wonders of the world */
  if((cap0||v.houses>=10)&&!v.wonder&&tick>v.noBig&&(!k.wars.size||k.gold>800)){
    const w=wonderFor(k);
    if(w&&k.gold>=w.cost){
      if(placeBig(v,'wonder',{wid:w.id},!!w.coast)){
        const b=v.wonder;k.gold-=w.cost;wonderOf[w.id]=b;b.rate=1/(w.yrs*6);
        chron(k.name+' begins to raise '+w.n+' at '+v.name,'age',v);bubble(k,'Let the world remember us: we shall raise '+w.n+'.');
        return;
      }
      v.noBig=tick+6*YEAR;
    }
  }
  const f=k.focus,o=[];
  if(age>=1&&!v.dock&&v.houses>=3&&tick>v.noDock)o.push('dock');
  if(age>=1&&!v.market&&v.houses>=5)o.push('market');
  if(!v.temple&&v.houses>=8)o.push('temple');
  if(v.mines<2&&v.houses>=4&&tick>v.noMine)o.push('mine');
  if(age>=2&&!v.barracks&&v.houses>=6&&(f==='army'||k.wars.size>0||cap0))o.push('barracks');
  if(age>=2&&v.towers<(k.wars.size?2:1)&&v.houses>=6)o.push('tower');
  if(age>=3&&!v.academy&&v.houses>=10)o.push('academy');
  if(age>=3&&v.dock&&!v.lighthouse&&v.houses>=9&&tick>v.noLight)o.push('lighthouse');
  if(age>=4&&!v.windmill&&v.farms>=4)o.push('windmill');
  if(age>=6&&v.factories<(v.houses>=26?2:1)&&v.houses>=10)o.push('factory');
  if(age>=3&&!v.arena&&v.houses>=16&&tick>v.noBig)o.push('arena');
  if(age>=8&&cap0&&!k.pad&&tick>v.noBig)o.push('launchpad');
  for(let n=o.length-1;n>=0;n--)if(k.gold<GCOST[o[n]])o.splice(n,1);
  if(!o.length){if(v.res>40)v.res=40;return;}
  const want=o.indexOf('launchpad')>=0?['launchpad']:f==='army'?['barracks','tower']:f==='wealth'?['market','factory','mine','dock']:f==='lore'?['academy','temple','lighthouse']:['dock','market','windmill','temple','arena'];
  let kind=o[0];
  for(const w of want)if(o.indexOf(w)>=0){kind=w;break;}
  if(placeBld(v,kind)){v.res-=14;k.gold-=GCOST[kind];if(kind==='launchpad'){k.pad=v.pad;chron(k.name+' builds a launch pad at '+v.name+'. The sky is no longer the limit','age',v);}}
  else if(kind==='dock')v.noDock=tick+12*YEAR;
  else if(kind==='mine')v.noMine=tick+12*YEAR;
  else if(kind==='lighthouse')v.noLight=tick+15*YEAR;
  else if(BIG[kind])v.noBig=tick+6*YEAR;
  if(v.res>40)v.res=40;
}
function keepMuster(k){
  const frac=k.broke?.3:k.focus==='army'?.6:.45;
  if(!k.nAdult)return;
  const gap=frac-k.nSold/k.nAdult;
  if(gap<.08)return;
  for(const u of units){
    if(u.k===k&&u.v&&!u.soldier&&!u.dead&&u.age>=SPEC[u.t].adult&&Math.random()<gap)u.soldier=true;
  }
}
function standDown(k){
  k.target=null;k.port=null;k.landing=null;k.rally=null;
  for(const u of units)if(u.k===k)u.soldier=false;
}
/* buildings rise over a few seasons; wonders over many years */
function raiseStep(){
  let w=0;
  for(let n=0;n<raising.length;n++){
    const b=raising[n],v=b.v;
    if(!v.alive||bmap[b.i]!==b)continue;
    b.prog+=(b.rate||BUILD_T[b.kind]||.25)*(b.rate?1:.7+.3*Math.min(1,v.pop/8))*(b.kind==='wonder'&&v.k.rOwn?1+.4*hasRes(v.k,MARBLE):1);
    if(b.prog>=1){
      b.prog=1;
      snd('build',b.x,b.y,.5);
      if(b.kind==='wonder'){snd('wonder',b.x,b.y,1);
        const wd=WMAP[b.wid];
        chron(v.k.name+' completes '+wd.n+' in '+v.name+'. It will be remembered for a thousand years','age',v);
        bubble(v.k,'Behold '+wd.n+'!');
        banner('A wonder of the world',cap1(wd.n),'Completed by '+v.k.name+' in '+v.name);
        fx({k:'ring',x:b.x+1,y:b.y+1,r:7,t:40,T:40});fx({k:'fireworks',x:b.x+1,y:b.y,t:150,T:150});
      }else if(b.kind==='launchpad')fx({k:'ring',x:b.x+1,y:b.y+1,r:5,t:30,T:30});
      continue;
    }
    raising[w++]=b;
  }
  raising.length=w;
}
/* trade: a caravan sets out for one of the realm's towns, or a friendly neighbour's */
function sendCaravan(v,k){
  const reg=region[v.y*W+v.x];let dest=null;
  if(Math.random()<(k.pacts&&k.pacts.length?.6:.35)&&k.nb.length){
    const n=k.nb[(Math.random()*Math.min(4,k.nb.length))|0],o=n.k;
    if(o.alive&&!k.wars.has(o)&&(k.allies.has(o)||hasPact(k,o)||rel(k,o)>8))for(const tv of o.villages)if(region[tv.y*W+tv.x]===reg&&d2(tv,v)<85*85){dest=tv;break;}
  }
  if(!dest)for(let m=0;m<5;m++){const tv=pick(k.villages);if(tv!==v&&region[tv.y*W+tv.x]===reg&&d2(tv,v)<90*90&&d2(tv,v)>64){dest=tv;break;}}
  if(!dest)return;
  const u=spawn(CARAVAN,v.x,v.y,k,null);
  if(u){u.home=v;u.dest=dest;u.cargo=(3+Math.sqrt(d2(v,dest))*.12)*(dest.k!==k?1.5:1)*(1+(TIER[k.age]||0)*.4);}
}
function villagesStep(){
  if(regionsDirty)computeRegions();
  for(const k of kingdoms)if(k.alive){k.nAdult=0;k.nSold=0;k.nBarr=0;k.nCar=0;k.nSiege=0;}
  for(let n=1;n<vById.length;n++){const v=vById[n];if(v.alive)v.pop=0;}
  for(const u of units){
    if(u.dead)continue;
    if(u.v)u.v.pop++;
    const k=u.k;if(!k)continue;
    if(u.t<=ORC){if(u.age>=SPEC[u.t].adult){k.nAdult++;if(u.soldier)k.nSold++;}}
    else if(u.t===CARAVAN)k.nCar++;else if(u.t===SIEGE)k.nSiege++;
  }
  raiseStep();
  const phase=(tick/10)|0,seas=((tick%YEAR)/YEAR+.875)%1,crop=seas<.25?.8:seas<.75?1.15:.6;
  for(let n=1;n<vById.length;n++){
    const v=vById[n];if(!v.alive)continue;
    const k=v.k,sp=SPEC[v.race],f=k.focus,ag=k.age,ti=TIER[ag]||0;
    v.cap=6+v.houses*(5+ag);v.rad=3+Math.sqrt(v.blds.length)*1.5;
    if(v.pop===0&&tick-v.born>200){if(++v.empty>30){ruinVillage(v);continue;}}else v.empty=0;
    if(v.barracks)k.nBarr++;
    const wd=v.wonder&&v.wonder.prog>=1?WMAP[v.wonder.wid]:null;
    v.res+=(.4+v.pop*.06+v.mines*.5+v.factories*.9+(wd&&wd.res||0))*(f==='grow'?1.25:1)*(1+ag*.05);
    k.gold+=(v.pop*.005+(v.market?.2+v.pop*.008:0)+v.mines*.1+v.factories*.3+(v.dock?.04:0)+(wd&&wd.gold||0))*(f==='wealth'?1.5:1)*(1+ag*.06);
    if(v.res<10&&k.gold>30){k.gold-=3;v.res+=3;}
    k.lore+=(v.pop*.0025+v.houses*.0015+(v.temple?.06:0)+(v.academy?.3+.12*ti:0)+(v.lighthouse?.03:0)+(wd&&wd.lore||0))
      *(f==='lore'?1.6:1)*(k.ruler.trait.id==='scholar'?1.3:1)*(1+ag*.1)*(k.rOwn?resLore(k):1);
    const hall=v.blds[0];
    if(hall&&hall.kind==='hall'&&!fire[hall.i]){const mx=hallHp(v);if(hall.hp<mx)hall.hp=Math.min(mx,hall.hp+8);}
    if((v.pop>=1||k.pop>=12)&&v.pop<v.cap){
      const ff=Math.max(.1,Math.min(1.2,v.food*crop/(v.pop*.45+2)));
      if(Math.random()<.22*sp.birth*ff*(f==='grow'?1.2:1)){const b=pick(v.blds);spawn(v.race,b.x,b.y,k,v,0);}
    }
    if(v.race===ELF){if((phase+n)%8===0){v.treeFood=countTrees(v);recalc(v);}}
    else if(Math.random()<.2)chop(v);
    if(v.race!==ELF&&v.heads&&v.heads.length&&Math.random()<.35)growStreets(v);
    villageBuild(v,k);
    const maxV=5+ag+(k.ruler.trait.id==='builder'?2:0);
    if(v.houses>=7&&v.pop>=18&&k.villages.length<maxV&&Math.random()<.04*(f==='grow'?1.8:1))sendSettlers(v);
    if(v.market&&!k.wars.size&&k.nCar<k.villages.length*1.5+1&&Math.random()<.02*(1+ti*.3)){sendCaravan(v,k);k.nCar++;}
    if(k.wars.size&&ag>=3&&v.barracks&&k.gold>50&&k.nSiege<1+(k.villages.length>>1)&&Math.random()<.06){
      const u=spawn(SIEGE,v.barracks.x,v.barracks.y,k,null);if(u){u.home=v;k.gold-=35;k.nSiege++;}
    }
  }
  for(const k of kingdoms){
    if(!k.alive)continue;
    if(k.wars.size){
      k.gold-=k.nSold*.015;
      if(k.gold<0){k.gold=0;k.broke=true;}else if(k.gold>20)k.broke=false;
      keepMuster(k);if(k.landing)dispatchRaid(k);
      if(k.gold>120&&k.villages.length&&Math.random()<.3){
        const c=k.villages[0];
        for(let m=0;m<4;m++){const u=spawn(k.race,c.x,c.y,k,c);if(u){u.soldier=true;k.gold-=22;}}
      }
    }else k.broke=false;
    updPow(k);
  }
}
