/* ================= fire, nature and disasters ================= */
function ignite(i){
  if(fire[i])return;
  const d=bmap[i]?30:BURN[tile[i]];
  if(!d)return;
  fire[i]=d;fireList.push(i);touch(i);
}
function fireStep(){
  let w=0;
  for(let n=0;n<fireList.length;n++){
    const i=fireList[n];if(!fire[i])continue;
    const t=tile[i],b=bmap[i];
    if(Math.random()<(b?.1:SPREAD[t])){const j=nbr(i);if(j>=0)ignite(j);}
    if(b)damageBld(b,3,null);
    if(!fire[i])continue;
    if(--fire[i]===0){
      touch(i);
      if(TREE[t])setTile(i,ASH);
      else if(BURN[t]&&!bmap[i]&&Math.random()<.5)setTile(i,ASH);
    }else fireList[w++]=i;
  }
  fireList.length=w;
}
function tileTicks(){
  const cnt=Math.round(N/85);
  for(let n=0;n<cnt;n++){
    const i=(Math.random()*N)|0,t=tile[i];
    if(t===ASH){if(Math.random()<.2)setTile(i,soil[i]===HILL?HILL:soil[i]);}
    else if(t===LAVA){
      let wet=false;const x=i%W;
      const ns=[x>0?i-1:-1,x<W-1?i+1:-1,i>=W?i-W:-1,i<N-W?i+W:-1];
      for(const j of ns){if(j<0)continue;if(tile[j]<=WATER||tile[j]===RIVER)wet=true;else ignite(j);}
      if(wet||Math.random()<.3){setTile(i,HILL,true);}
    }else if(t===GRASS||t===TUNDRA||t===SAVANNA){
      if(!vown[i]&&!bmap[i]&&!road[i]&&Math.random()<.03){
        const j=nbr(i);
        if(j>=0){
          const tj=tile[j];
          if(t===GRASS&&(tj===FOREST||tj===JUNGLE||tj===PINE))setTile(i,tj);
          else if(t===TUNDRA&&tj===PINE)setTile(i,PINE);
        }
      }
    }
  }
}
function randomTile(pred,tries){
  for(let n=0;n<tries;n++){const i=(Math.random()*N)|0;if(pred(i))return i;}
  return -1;
}
function migrate(){
  if(!S.wild)return;
  if(counts[SHEEP]<12){
    const i=randomTile(j=>tile[j]===GRASS&&!vown[j],300);
    if(i>=0)for(let m=0;m<5;m++)spawn(SHEEP,i%W,(i/W)|0);
  }else if(counts[WOLF]<animCap*.05&&counts[SHEEP]>animCap*.3&&Math.random()<.5){
    const i=randomTile(j=>(tile[j]===FOREST||tile[j]===PINE||tile[j]===TUNDRA)&&!vown[j],300);
    if(i>=0)for(let m=0;m<4;m++)spawn(WOLF,i%W,(i/W)|0);
  }
  if(counts[BEAR]<animCap*.02&&Math.random()<.4){
    const i=randomTile(j=>TREE[tile[j]]===1&&!vown[j],300);
    if(i>=0)spawn(BEAR,i%W,(i/W)|0);
  }
}
function nearName(x,y){
  let best=null,bd=60*60;
  for(let n=1;n<vById.length;n++){const v=vById[n];if(!v.alive)continue;const d=(v.x-x)*(v.x-x)+(v.y-y)*(v.y-y);if(d<bd){bd=d;best=v;}}
  return best?' near '+best.name:' in the wilds';
}
function disasters(){
  if(Math.random()>=(DISASTER[S.disasters]||0))return;
  const r=Math.random();
  if(r<.3){
    const i=randomTile(j=>TREE[tile[j]]===1||tile[j]===GRASS,200);if(i<0)return;
    const x=i%W,y=(i/W)|0,n=4+((Math.random()*6)|0);
    for(let m=0;m<n;m++)sched.push({t:tick+((Math.random()*70)|0),f:'bolt',x:x+((Math.random()*21)|0)-10,y:y+((Math.random()*21)|0)-10});
    chron('A thunderstorm breaks'+nearName(x,y),'disaster',{x,y});
  }else if(r<.48){
    const i=randomTile(j=>tile[j]===MOUNT,400);if(i<0)return;
    erupt(i%W,(i/W)|0);chron('A volcano erupts'+nearName(i%W,(i/W)|0),'disaster',{x:i%W,y:(i/W)|0});
  }else if(r<.64){
    const vs=[];for(let n=1;n<vById.length;n++)if(vById[n].alive&&vById[n].pop>20)vs.push(vById[n]);
    if(!vs.length)return;
    const v=pick(vs);let c=0;
    for(const u of units){if(u.v===v&&!u.sick&&!u.immune){u.sick=200;if(++c>=4)break;}}
    if(c)chron('Plague breaks out in '+v.name,'disaster',v);
  }else if(r<.8){
    const i=randomTile(j=>WALK[tile[j]]===1,100);if(i<0)return;
    twisters.push({x:i%W,y:(i/W)|0,dx:Math.random()<.5?1:-1,dy:0,t:170});
    chron('A tornado touches down'+nearName(i%W,(i/W)|0),'disaster',{x:i%W,y:(i/W)|0});
  }else if(r<.9){
    const i=randomTile(j=>tile[j]>WATER,100);if(i<0)return;
    if(quiet)blast(i%W,(i/W)|0,6,true);else fx({k:'meteor',x:i%W,y:(i/W)|0,t:28});
    chron('A falling star strikes'+nearName(i%W,(i/W)|0),'disaster',{x:i%W,y:(i/W)|0});
  }else if(r<.96){
    const i=randomTile(j=>tile[j]===MOUNT||tile[j]===SNOW,200);if(i<0)return;
    if(spawn(DRAGON,i%W,(i/W)|0))chron('A dragon wakes in the mountains'+nearName(i%W,(i/W)|0),'disaster',{x:i%W,y:(i/W)|0});
  }else{
    const vs=[];for(let n=1;n<vById.length;n++)if(vById[n].alive)vs.push(vById[n]);
    if(!vs.length)return;
    const v=pick(vs);let c=0;
    for(let m=0;m<8;m++){const x=v.x+((Math.random()*17)|0)-8,y=v.y+((Math.random()*17)|0)-8;if(walkable(x,y)&&spawn(ZOMBIE,x,y))c++;}
    if(c)chron('The dead rise outside '+v.name,'disaster',v);
  }
}
function erupt(tx,ty){
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    const x=tx+dx,y=ty+dy;if(!inB(x,y))continue;
    const d=Math.sqrt(dx*dx+dy*dy),i=y*W+x;
    if(d<=1.3)setTile(i,LAVA,true);
    else if(d<=3&&tile[i]!==LAVA){setTile(i,MOUNT,true);elev[i]=Math.max(elev[i],230-d*14);}
  }
  for(let m=0;m<10;m++)sched.push({t:tick+6+((Math.random()*120)|0),f:'lavabomb',x:tx+((Math.random()*19)|0)-9,y:ty+((Math.random()*19)|0)-9});
  fx({k:'boom',x:tx,y:ty,r:6,t:26,T:26});
  if(!reduceMotion)shake=Math.max(shake,10);
}
function updTwisters(){
  let w=0;
  for(let n=0;n<twisters.length;n++){
    const tw=twisters[n];
    if(tick%2===0){
      if(Math.random()<.2){tw.dx=((Math.random()*3)|0)-1;tw.dy=((Math.random()*3)|0)-1;}
      tw.x=Math.max(1,Math.min(W-2,tw.x+tw.dx));tw.y=Math.max(1,Math.min(H-2,tw.y+tw.dy));
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const i=(tw.y+dy)*W+tw.x+dx,b=bmap[i];
        if(b)damageBld(b,14,null);
        if(TREE[tile[i]]&&Math.random()<.5)setTile(i,soil[i]);
        if(fire[i]){fire[i]=0;touch(i);}
      }
      const cx=tw.x>>3,cy=tw.y>>3;
      for(let gy=Math.max(0,cy-1);gy<=Math.min(GH-1,cy+1);gy++)for(let gx=Math.max(0,cx-1);gx<=Math.min(GW-1,cx+1);gx++){
        const c=grid[gy*GW+gx];
        for(let m=0;m<c.length;m++){
          const u=c[m];if(u.dead||u.stowed||u.t===DRAGON)continue;
          if((u.x-tw.x)*(u.x-tw.x)+(u.y-tw.y)*(u.y-tw.y)<=6){
            hit(u,16,null);
            const nx=u.x+((Math.random()*7)|0)-3,ny=u.y+((Math.random()*7)|0)-3;
            if(!u.dead&&walkable(nx,ny)){u.x=nx;u.y=ny;}
          }
        }
      }
    }
    if(--tw.t>0)twisters[w++]=tw;
  }
  twisters.length=w;
}
function updTowers(){
  for(let n=0;n<towers.length;n++){
    const b=towers[n];
    if((tick+n)%5)continue;
    const k=b.v.k;
    if(!k.wars.size&&!counts[ZOMBIE])continue;
    const f=nearest(b,6,o=>o.t===ZOMBIE||(o.k!==null&&o.k!==k&&k.wars.has(o.k)));
    if(f){hit(f,6*k.pow,null);fx({k:'arrow',x:b.x,y:b.y-1,x2:f.x,y2:f.y,t:5,T:5});}
  }
}
function runSched(){
  let w=0;
  for(let n=0;n<sched.length;n++){
    const e=sched[n];
    if(e.t>tick){sched[w++]=e;continue;}
    if(e.f==='bolt')strike(e.x,e.y);
    else if(e.f==='shell'||e.f==='bomb'){
      if(inB(e.x,e.y)){
        const i=e.y*W+e.x,b=bmap[i],bomb=e.f==='bomb';
        if(b&&b.v.k!==e.k){
          const d=bomb?55:e.d;
          if(bomb&&b.kind==='hall')b.hp=Math.max(b.hp-d,hallHp(b.v)*.25);else damageBld(b,d,b.kind==='hall'?{k:e.k}:null);
        }
        if(bomb&&Math.random()<.4)ignite(i);
        const rr=bomb?2.3:1.6;
        for(const u of units)if(!u.dead&&u.k!==e.k&&(u.x-e.x)*(u.x-e.x)+(u.y-e.y)*(u.y-e.y)<=rr)hit(u,bomb?30:14,null);
        fx({k:'boom',x:e.x,y:e.y,r:bomb?1.6:1.1,t:12,T:12});
        if(bomb&&!reduceMotion)shake=Math.max(shake,3);
      }
    }
    else if(e.f==='lavabomb'){
      if(inB(e.x,e.y)){
        const i=e.y*W+e.x;
        if(tile[i]>WATER){setTile(i,LAVA,true);ignite(i);fx({k:'boom',x:e.x,y:e.y,r:1.5,t:10,T:10});}
      }
    }
  }
  sched.length=w;
}

/* ---------- one tick of the simulation ---------- */
function step(){
  tick++;
  for(let n=0;n<grid.length;n++)grid[n].length=0;
  counts.fill(0);
  for(let n=0;n<units.length;n++){const u=units[n];grid[(u.y>>3)*GW+(u.x>>3)].push(u);counts[u.t]++;}
  for(let n=0,len=units.length;n<len;n++){const u=units[n];if(!u.dead)updUnit(u);}
  if(risen.length){for(let n=0;n<risen.length;n+=2)spawn(ZOMBIE,risen[n],risen[n+1]);risen.length=0;}
  sweepUnits();
  if(boats.length)updBoats();
  if(planes.length)updPlanes();
  if(twisters.length)updTwisters();
  if(towers.length)updTowers();
  fireStep();tileTicks();
  if(SL!==seaGoal&&tick%5===0)seaStep();
  stormsStep();
  if(sched.length)runSched();
  if(tick%10===0)villagesStep();
  if(tick%YEAR===0)rulersStep();
}
