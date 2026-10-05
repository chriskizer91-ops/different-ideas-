/* ================= villages and kingdoms ================= */
function rulerName(k){return k.ruler.title+' '+k.ruler.name;}
function newRuler(race,keep){
  const p=pick(RULERS[race]);
  const trait=keep&&Math.random()<.3?keep:pick(TRAITS);
  return{name:p[0],title:p[1],trait,since:tick,until:tick+((16+Math.random()*30)*YEAR|0)};
}
function newKingdom(race,name){
  const color=COLORS[kc++%COLORS.length];
  const k={id:kingdoms.length+1,name:name||genName(race),race,color,rgb:hexRgb(color),villages:[],alive:true,
    gold:10,lore:0,age:0,pow:1,pop:0,str:0,focus:'grow',focusUntil:0,restUntil:tick+(tick<30*YEAR?28:8)*YEAR,
    ruler:null,wars:new Set(),allies:new Set(),nb:[],regs:new Set(),
    target:null,port:null,landing:null,rally:null,rallyUntil:0,pauseUntil:0,boatCd:0,nAdult:0,nSold:0,nBarr:0,broke:false,born:tick};
  k.ruler=newRuler(race,null);
  kingdoms.push(k);
  if(!name)chron(rulerName(k)+' founds the '+SPEC[race].name.toLowerCase()+' realm of '+k.name,'found');
  return k;
}
function kPop(k){let n=0;for(const v of k.villages)n+=v.pop;return n;}
function updPow(k){k.pow=(1+.15*k.age)*(k.nBarr>0?1.2:1)*(k.ruler.trait.id==='conqueror'?1.1:1)*(k.broke?.85:1);}
function hallHp(v){return BHP.hall*(1+.3*v.k.age)*(v.race===DWARF?1.25:1);}
function claim(v,x,y,r){
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(dx*dx+dy*dy>r*r+r)continue;
    const nx=x+dx,ny=y+dy;if(!inB(nx,ny))continue;
    const i=ny*W+nx;if(!vown[i]&&tile[i]!==DEEP)vown[i]=v.id;
  }
  dirtyAll=true;
}
function countTrees(v){
  let n=0;
  for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){const x=v.x+dx,y=v.y+dy;if(inB(x,y)&&TREE[tile[y*W+x]])n++;}
  return n*.22;
}
function recalc(v){
  v.houses=v.farms=v.towers=v.mines=0;v.market=v.barracks=v.temple=v.academy=v.dock=null;
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
    }
  }
  if(v.race===ELF)food+=v.treeFood;
  v.food=food;
}
function addBuilding(v,kind,x,y,ex){
  const i=y*W+x;
  const b={kind,x,y,i,v,hp:BHP[kind],solid:kind!=='farm'&&kind!=='dock'&&kind!=='mine',fert:1,wi:-1,grove:false,cd:0};
  if(kind==='hall')b.hp=hallHp(v);
  if(ex)Object.assign(b,ex);
  bmap[i]=b;v.blds.push(b);
  const t=tile[i];
  if(kind==='farm'){
    if(b.grove)b.fert=.8;
    else{b.fert=Math.max(.3,FERT[TREE[t]?soil[i]:t])*(v.race===ORC?.75:1);if(TREE[t]||t===ASH)setTile(i,soil[i]);}
  }else if((TREE[t]&&v.race!==ELF)||t===ASH)setTile(i,soil[i]);
  if(road[i]){road[i]=0;}
  if(kind==='tower')towers.push(b);
  claim(v,x,y,kind==='hall'?6:kind==='farm'?3:4);
  recalc(v);
  return b;
}
function buildRoad(v,from){
  let x=v.x,y=v.y,cur=flowAt(from,x,y);
  if(cur===65535||cur>150)return;
  for(let st=0;st<220&&cur>1;st++){
    let bx=0,by=0,bd=cur;
    for(let n=0;n<8;n++){
      const o=DIRS[(n*2+(n>3?1:0))&7],d=flowAt(from,x+o[0],y+o[1]);
      if(d<bd){bd=d;bx=o[0];by=o[1];}
    }
    if(!bx&&!by)break;
    x+=bx;y+=by;cur=bd;
    const i=y*W+x;if(!bmap[i]&&!road[i]){road[i]=1;recolor(i);}
  }
}
function foundVillage(u){
  const k=u.k&&u.k.alive?u.k:newKingdom(u.t);
  const v={id:vById.length,name:'',k,race:u.t,x:u.x,y:u.y,blds:[],pop:0,cap:6,res:8,rad:3,food:4,treeFood:0,
    houses:0,farms:0,towers:0,mines:0,market:null,barracks:null,temple:null,academy:null,dock:null,
    alive:true,born:tick,empty:0,flow:null,flowStamp:-1,noDock:0,noMine:0};
  v.name=k.villages.length?genName(u.t):k.name;
  vById.push(v);k.villages.push(v);
  if(v.race===ELF)v.treeFood=countTrees(v);
  addBuilding(v,'hall',u.x,u.y);
  if(u.v)u.v.pop--;
  const g=u.settle&&u.settle.grp;
  u.v=v;u.k=k;u.settle=null;v.pop=1;
  for(const o of units){
    if(o===u||o.dead||o.v||o.t!==u.t||d2(o,u)>=144||v.pop>=v.cap)continue;
    if((g&&o.settle&&o.settle.grp===g)||(!g&&o.settle&&o.settle.found&&o.k===k)||(!o.k&&!o.settle)){o.v=v;o.k=k;o.settle=null;v.pop++;}
  }
  if(g&&g.from&&g.from.alive)buildRoad(v,g.from);
  if(k.villages.length>1)chron(k.name+' settles '+v.name,'found');
}
function ownOK(v,i){const o=vown[i];if(!o||o===v.id)return true;const ov=vById[o];return!!ov&&ov.alive&&ov.k===v.k;}
function clearAround(x,y){
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const b=bmap[(y+dy)*W+x+dx];if(b&&b.solid)return false;}
  return true;
}
function placeBld(v,kind){
  const elf=v.race===ELF;
  let R=v.rad,rmin=1.5;
  if(kind==='farm'){R+=2.5;rmin=2;}else if(kind==='dock')R+=5;else if(kind==='mine')R+=4;else if(kind==='tower')rmin=R*.6;
  for(let n=0;n<(kind==='dock'?90:40);n++){
    const a=Math.random()*6.283,r=rmin+Math.random()*(R-rmin+.01);
    const x=Math.round(v.x+Math.cos(a)*r),y=Math.round(v.y+Math.sin(a)*r);
    if(x<1||y<1||x>=W-1||y>=H-1)continue;
    const i=y*W+x,t=tile[i];
    if(bmap[i]||fire[i]||!BUILD[t]||!ownOK(v,i))continue;
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
    if(!clearAround(x,y))continue;
    addBuilding(v,kind,x,y);return true;
  }
  return false;
}
function destroyBld(b){
  if(bmap[b.i]!==b)return;
  const v=b.v;
  if(b.kind==='hall'){ruinVillage(v);return;}
  bmap[b.i]=null;
  const n=v.blds.indexOf(b);if(n>=0)v.blds.splice(n,1);
  if(b.kind==='tower'){const m=towers.indexOf(b);if(m>=0)towers.splice(m,1);}
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
  for(const b of v.blds){bmap[b.i]=null;if(b.kind==='tower'){const m=towers.indexOf(b);if(m>=0)towers.splice(m,1);}}
  v.blds=[];v.flow=null;recalc(v);
  for(let i=0;i<N;i++)if(vown[i]===v.id)vown[i]=0;
  const k=v.k,n=k.villages.indexOf(v);if(n>=0)k.villages.splice(n,1);
  for(const u of units)if(u.v===v){u.v=null;u.soldier=false;}
  v.pop=0;dirtyAll=true;
  chron(v.name+' lies in ruins','ruin');
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
  k.wars.clear();k.allies.clear();
  chron('The realm of '+k.name+' has fallen','ruin');
}
function captureVillage(v,k){
  const old=v.k;if(old===k)return;
  const n=old.villages.indexOf(v);if(n>=0)old.villages.splice(n,1);
  const same=v.race===k.race;
  v.k=k;v.race=k.race;k.villages.push(v);
  let pop=0;
  for(const u of units){
    if(u.v!==v||u.dead)continue;
    if(same){u.k=k;u.soldier=false;pop++;}else{u.v=null;u.k=null;u.soldier=false;}
  }
  v.pop=pop;dirtyAll=true;
  for(const w of wars){if(w.a===k&&w.b===old)w.sa+=25;else if(w.b===k&&w.a===old)w.sb+=25;}
  chron(k.name+' captures '+(v.name===old.name?'the capital of '+old.name:v.name+' from '+old.name),'war');
  k.pauseUntil=tick+((2+Math.random()*3)*YEAR|0);k.target=null;
  if(old.villages.length===0)killKingdom(old);
  dirtyAll=true;
}
function chop(v){
  const a=Math.random()*6.283,r=Math.random()*(v.rad+2);
  const x=Math.round(v.x+Math.cos(a)*r),y=Math.round(v.y+Math.sin(a)*r);
  if(!inB(x,y))return;const i=y*W+x;
  if(TREE[tile[i]]&&!bmap[i]&&!fire[i]&&vown[i]===v.id){setTile(i,soil[i]);v.res+=2;}
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
    const p=pr[t]+Math.random()*.15;if(p<=bs)continue;
    if(!farFromVillages(x,y))continue;
    bs=p;best={x,y};
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
  chron('Settlers from '+v.name+' set sail for new shores','found');
}
function villageBuild(v,k){
  if(v.res<6)return;
  if(v.pop>=v.cap-2&&v.houses<22){
    if(v.res<10)return;
    if(placeBld(v,'house')){v.res-=10;return;}
  }
  if(v.food<v.pop*.5+4&&v.farms<16&&placeBld(v,'farm')){v.res-=6;return;}
  if(v.res<14)return;
  const age=k.age,f=k.focus,o=[];
  if(age>=1&&!v.dock&&v.houses>=3&&tick>v.noDock)o.push('dock');
  if(age>=1&&!v.market&&v.houses>=5)o.push('market');
  if(!v.temple&&v.houses>=8)o.push('temple');
  if(v.mines<2&&v.houses>=4&&tick>v.noMine)o.push('mine');
  if(age>=2&&!v.barracks&&v.houses>=6&&(f==='army'||k.wars.size>0||v===k.villages[0]))o.push('barracks');
  if(age>=2&&v.towers<(k.wars.size?2:1)&&v.houses>=6)o.push('tower');
  if(age>=3&&!v.academy&&v.houses>=10)o.push('academy');
  for(let n=o.length-1;n>=0;n--)if(k.gold<GCOST[o[n]])o.splice(n,1);
  if(!o.length){if(v.res>40)v.res=40;return;}
  const want=f==='army'?['barracks','tower']:f==='wealth'?['market','mine','dock']:f==='lore'?['academy','temple']:['dock','market','temple'];
  let kind=o[0];
  for(const w of want)if(o.indexOf(w)>=0){kind=w;break;}
  if(placeBld(v,kind)){v.res-=14;k.gold-=GCOST[kind];}
  else if(kind==='dock')v.noDock=tick+12*YEAR;
  else if(kind==='mine')v.noMine=tick+12*YEAR;
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
function villagesStep(){
  if(regionsDirty)computeRegions();
  for(const k of kingdoms)if(k.alive){k.nAdult=0;k.nSold=0;k.nBarr=0;}
  for(let n=1;n<vById.length;n++){const v=vById[n];if(v.alive)v.pop=0;}
  for(const u of units){
    if(u.dead)continue;
    if(u.v)u.v.pop++;
    const k=u.k;
    if(k&&u.t<=ORC&&u.age>=SPEC[u.t].adult){k.nAdult++;if(u.soldier)k.nSold++;}
  }
  const phase=(tick/10)|0;
  for(let n=1;n<vById.length;n++){
    const v=vById[n];if(!v.alive)continue;
    const k=v.k,sp=SPEC[v.race],f=k.focus;
    v.cap=6+v.houses*(5+k.age);v.rad=3+Math.sqrt(v.blds.length)*1.5;
    if(v.pop===0&&tick-v.born>200){if(++v.empty>30){ruinVillage(v);continue;}}else v.empty=0;
    if(v.barracks)k.nBarr++;
    v.res+=(.4+v.pop*.06+v.mines*.5)*(f==='grow'?1.25:1);
    k.gold+=(v.pop*.005+(v.market?.2+v.pop*.008:0)+v.mines*.1)*(f==='wealth'?1.5:1);
    if(v.res<10&&k.gold>30){k.gold-=3;v.res+=3;}
    k.lore+=(v.pop*.002+(v.temple?.06:0)+(v.academy?.3:0))*(f==='lore'?1.6:1)*(k.ruler.trait.id==='scholar'?1.3:1);
    const hall=v.blds[0];
    if(hall&&hall.kind==='hall'&&!fire[hall.i]){const mx=hallHp(v);if(hall.hp<mx)hall.hp=Math.min(mx,hall.hp+8);}
    if((v.pop>=1||k.pop>=12)&&v.pop<v.cap){
      const ff=Math.max(.1,Math.min(1.2,v.food/(v.pop*.45+2)));
      if(Math.random()<.22*sp.birth*ff*(f==='grow'?1.2:1)){const b=pick(v.blds);spawn(v.race,b.x,b.y,k,v,0);}
    }
    if(v.race===ELF){if((phase+n)%8===0){v.treeFood=countTrees(v);recalc(v);}}
    else if(Math.random()<.2)chop(v);
    villageBuild(v,k);
    const maxV=5+k.age+(k.ruler.trait.id==='builder'?2:0);
    if(v.houses>=7&&v.pop>=18&&k.villages.length<maxV&&Math.random()<.04*(f==='grow'?1.8:1))sendSettlers(v);
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
