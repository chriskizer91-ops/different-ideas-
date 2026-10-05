/* ================= creatures ================= */
function spawn(t,x,y,k,v,age){
  if(t<=ORC){const cap=POPCAP[S.popcap]*capMul;if(civCount()>=cap||counts[t]>=cap*.42)return null;}
  else if(t===SHEEP){if(counts[SHEEP]>=animCap)return null;}
  else if(t===WOLF){if(counts[WOLF]>=animCap*.28)return null;}
  else if(t===BEAR){if(counts[BEAR]>=animCap*.08)return null;}
  else if(t===ZOMBIE){if(counts[ZOMBIE]>=260)return null;}
  else if(t===DRAGON){if(counts[DRAGON]>=6)return null;}
  counts[t]++;
  const s=SPEC[t];
  const u={id:uid++,t,x,y,hp:s.hp,age:age===undefined?s.adult:age,
    life:((s.life[0]+Math.random()*(s.life[1]-s.life[0]))*YEAR)|0,
    k:k||null,v:v||null,hunger:0,cd:0,foe:null,soldier:false,settle:null,tgt:null,
    dead:false,stowed:false,sick:0,immune:false,detour:0,
    ox:(Math.random()-.5)*.5,oy:(Math.random()-.5)*.5,dir:1};
  units.push(u);if(v)v.pop++;
  return u;
}
function kill(u,by){
  if(u.dead)return;
  u.dead=true;if(u.v)u.v.pop--;
  if(by){
    if(by.t===ZOMBIE&&u.t<=ORC)risen.push(u.x,u.y);
    if(u.k&&by.k&&u.k!==by.k)warScore(by.k,u.k);
  }
}
function hit(o,dmg,by){o.hp-=dmg;if(o.hp<=0)kill(o,by);}
function sweepUnits(){let w=0;for(let n=0;n<units.length;n++){const u=units[n];if(!u.dead&&!u.stowed)units[w++]=u;}units.length=w;}
function nearest(u,r,pred){
  let best=null,bd=r*r+1;
  const x0=Math.max(0,(u.x-r)>>3),x1=Math.min(GW-1,(u.x+r)>>3),y0=Math.max(0,(u.y-r)>>3),y1=Math.min(GH-1,(u.y+r)>>3);
  for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){
    const c=grid[cy*GW+cx];
    for(let n=0;n<c.length;n++){
      const o=c[n];if(o===u||o.dead||o.stowed)continue;
      const dx=o.x-u.x,dy=o.y-u.y,d=dx*dx+dy*dy;
      if(d<bd&&pred(o)){bd=d;best=o;}
    }
  }
  return best;
}
function tryMove(u,dx,dy){
  const nx=u.x+dx,ny=u.y+dy;if(!walkable(nx,ny))return false;
  const i=ny*W+nx,b=bmap[i];
  if(b&&b.solid)return false;
  if(fire[i]&&Math.random()<.9)return false;
  u.x=nx;u.y=ny;if(dx)u.dir=dx;return true;
}
function wander(u){return tryMove(u,((Math.random()*3)|0)-1,((Math.random()*3)|0)-1);}
function stepTo(u,tx,ty){
  if(u.detour>0){u.detour--;return wander(u);}
  const dx=Math.sign(tx-u.x),dy=Math.sign(ty-u.y);
  if(dx||dy){
    if(tryMove(u,dx,dy))return true;
    if(dx&&dy){if(tryMove(u,dx,0)||tryMove(u,0,dy))return true;}
    else if(dx){if(tryMove(u,dx,Math.random()<.5?1:-1))return true;}
    else{if(tryMove(u,Math.random()<.5?1:-1,dy))return true;}
    u.detour=4+((Math.random()*8)|0);
  }
  return wander(u);
}
/* local flow fields: every walkable tile near a goal knows how far it is, so armies path around bays and ranges */
const FR=96,FD=FR*2+1,flowQ=new Int32Array(FD*FD);
function flowOf(v){
  if(v.flow&&v.flowStamp===regionStamp)return v.flow;
  const f=v.flow||(v.flow=new Uint16Array(FD*FD));f.fill(65535);
  const ox=v.x-FR,oy=v.y-FR;let h=0,t=0;
  f[FR*FD+FR]=0;flowQ[t++]=FR*FD+FR;
  while(h<t){
    const li=flowQ[h++],lx=li%FD,ly=(li/FD)|0,d=f[li]+1;
    for(let n=0;n<8;n++){
      const ax=lx+DIRS[n][0],ay=ly+DIRS[n][1];if(ax<0||ay<0||ax>=FD||ay>=FD)continue;
      const wx=ax+ox,wy=ay+oy;if(wx<0||wy<0||wx>=W||wy>=H)continue;
      const lj=ay*FD+ax;if(f[lj]!==65535)continue;
      if(!WALK[tile[wy*W+wx]])continue;
      f[lj]=d;flowQ[t++]=lj;
    }
  }
  v.flowStamp=regionStamp;return f;
}
function flowAt(v,x,y){
  const lx=x-v.x+FR,ly=y-v.y+FR;if(lx<0||ly<0||lx>=FD||ly>=FD)return 65535;
  return flowOf(v)[ly*FD+lx];
}
function stepFlow(u,v){
  const lx=u.x-v.x+FR,ly=u.y-v.y+FR;
  if(lx<1||ly<1||lx>=FD-1||ly>=FD-1)return stepTo(u,v.x,v.y);
  const f=flowOf(v),cur=f[ly*FD+lx];
  if(cur===65535)return stepTo(u,v.x,v.y);
  let bx=0,by=0,bd=cur;const r=(Math.random()*8)|0;
  for(let n=0;n<8;n++){
    const o=DIRS[(n+r)&7],d=f[(ly+o[1])*FD+lx+o[0]];
    if(d<bd){
      const x=u.x+o[0],y=u.y+o[1];if(x<0||y<0||x>=W||y>=H)continue;
      const b=bmap[y*W+x];if(b&&b.solid)continue;
      bd=d;bx=o[0];by=o[1];
    }
  }
  if((bx||by)&&tryMove(u,bx,by))return true;
  return wander(u);
}
function flounder(u){
  const nx=u.x+((Math.random()*3)|0)-1,ny=u.y+((Math.random()*3)|0)-1;
  if(!inB(nx,ny))return;if(tile[ny*W+nx]===LAVA)return;u.x=nx;u.y=ny;
}
function hostile(u,o){
  const ot=o.t;
  if(ot===ZOMBIE)return true;
  if(ot===WOLF||ot===BEAR)return d2(u,o)<=16;
  if(ot>ORC)return false;
  const a=u.k,b=o.k;
  if(a&&b)return a!==b&&a.wars.has(b);
  if(!a&&!b)return u.t!==ot&&(u.t===ORC||ot===ORC);
  return false;
}
function strikeFoe(u,f,s){
  const r=s.range||0,dd=d2(u,f);
  if(dd<=2||(r&&dd<=r*r)){
    if(u.cd<=0){
      const far=dd>2;u.cd=far?5:3;
      let dmg=s.atk*(.6+Math.random()*.8);
      if(u.k){dmg*=u.k.pow;const vid=vown[u.y*W+u.x];if(vid&&vById[vid].k===u.k)dmg*=1.25;}
      if(f.t===ELF&&!far&&TREE[tile[f.y*W+f.x]])dmg*=.65;
      hit(f,dmg,u);
      if(far)fx({k:'arrow',x:u.x,y:u.y,x2:f.x,y2:f.y,t:5,T:5});
      else if(Math.random()<.25)fx({k:'spark',x:f.x,y:f.y,t:4});
    }
    return true;
  }
  return false;
}
function updUnit(u){
  const s=SPEC[u.t];
  u.px=u.x;u.py=u.y;
  u.age++;if(u.cd>0)u.cd--;
  if(u.age>u.life){kill(u);return;}
  if(u.t===DRAGON){updDragon(u);return;}
  const i=u.y*W+u.x,t=tile[i];
  if(t===LAVA){kill(u);return;}
  if(fire[i]){u.hp-=5;if(u.hp<=0){kill(u);return;}wander(u);return;}
  if(!WALK[t]){
    if(t<=WATER){u.hp-=2;if(u.hp<=0){kill(u);return;}}
    flounder(u);return;
  }
  if(tick%20===0&&u.hp<s.hp)u.hp++;
  switch(u.t){
    case SHEEP:
      if(u.age>=s.adult&&(t===GRASS||t===SAVANNA)&&Math.random()<.004&&grid[(u.y>>3)*GW+(u.x>>3)].length<14)spawn(SHEEP,u.x,u.y,null,null,0);
      if(Math.random()<s.move)wander(u);
      return;
    case WOLF:case BEAR:updPredator(u,s);return;
    case ZOMBIE:updZombie(u,s);return;
    default:updCiv(u,s,i);
  }
}
function updPredator(u,s){
  const bear=u.t===BEAR;
  if(!bear||!TREE[tile[u.y*W+u.x]]||tick%3===0)u.hunger++;
  if(bear&&u.hunger<600&&u.age>=s.adult&&Math.random()<.002)spawn(BEAR,u.x,u.y,null,null,0);
  if(u.hunger>(bear?1600:1100)){kill(u);return;}
  if(u.hunger>60){
    if((tick+u.id)%3===0||!u.foe)u.foe=nearest(u,bear?8:13,o=>o.t===SHEEP||(o.t<=ORC&&u.hunger>(bear?140:260)));
    const f=u.foe;
    if(f&&!f.dead&&!f.stowed){
      if(d2(u,f)<=2){
        if(u.cd<=0){
          u.cd=3;hit(f,s.atk*(.6+Math.random()*.8),u);
          if(f.dead){u.hunger=0;u.foe=null;if(Math.random()<(bear?.2:.45))spawn(u.t,u.x,u.y,null,null,0);}
        }
      }else if(Math.random()<s.move)stepTo(u,f.x,f.y);
      return;
    }
    u.foe=null;
    if(u.hunger>200){
      if(!u.tgt||Math.random()<.01||(Math.abs(u.x-u.tgt.x)<3&&Math.abs(u.y-u.tgt.y)<3))
        u.tgt={x:Math.max(1,Math.min(W-2,u.x+((Math.random()*100)|0)-50)),y:Math.max(1,Math.min(H-2,u.y+((Math.random()*100)|0)-50))};
      if(Math.random()<s.move)stepTo(u,u.tgt.x,u.tgt.y);
      return;
    }
  }
  if(Math.random()<s.move*.4)wander(u);
}
function updZombie(u,s){
  if((tick+u.id)%3===0||!u.foe)u.foe=nearest(u,10,o=>o.t<=ORC);
  const f=u.foe;
  if(f&&!f.dead&&!f.stowed){
    if(d2(u,f)<=2){if(u.cd<=0){u.cd=3;hit(f,s.atk*(.6+Math.random()*.8),u);}}
    else if(Math.random()<s.move)stepTo(u,f.x,f.y);
    return;
  }
  u.foe=null;
  if(Math.random()<s.move*.6)wander(u);
}
function updDragon(u){
  if(!u.tgt||(Math.abs(u.x-u.tgt.x)<2&&Math.abs(u.y-u.tgt.y)<2)||Math.random()<.008){
    let v=null;
    if(vById.length>1&&Math.random()<.6){
      let bd=1e9;
      for(let n=0;n<6;n++){const c=vById[1+((Math.random()*(vById.length-1))|0)];if(c.alive){const d=d2(c,u);if(d<bd){bd=d;v=c;}}}
    }
    if(v)u.tgt={x:v.x+((Math.random()*9)|0)-4,y:v.y+((Math.random()*9)|0)-4};
    else u.tgt={x:Math.max(0,Math.min(W-1,u.x+((Math.random()*120)|0)-60)),y:Math.max(0,Math.min(H-1,u.y+((Math.random()*120)|0)-60))};
  }
  const dx=Math.sign(u.tgt.x-u.x),dy=Math.sign(u.tgt.y-u.y);
  u.x=Math.max(0,Math.min(W-1,u.x+dx));u.y=Math.max(0,Math.min(H-1,u.y+dy));if(dx)u.dir=dx;
  if(Math.random()<.1){
    const i=u.y*W+u.x;
    if(tile[i]>WATER){
      ignite(i);const j=nbr(i);if(j>=0)ignite(j);
      const v=nearest(u,2,o=>o.t!==DRAGON);if(v)hit(v,30,u);
      fx({k:'boom',x:u.x,y:u.y,r:1.6,t:10,T:10});
    }
  }
}
function canFound(u,i){
  const t=tile[i];
  if(!BUILD[t]||bmap[i]||vown[i])return false;
  if(Math.random()>.05*PREF[u.t][t])return false;
  for(let n=1;n<vById.length;n++){const v=vById[n];if(v.alive&&(v.x-u.x)*(v.x-u.x)+(v.y-u.y)*(v.y-u.y)<MINVD*MINVD)return false;}
  return true;
}
function adjEnemyBld(u,hallOnly){
  const k=u.k;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const x=u.x+dx,y=u.y+dy;if(!inB(x,y))continue;
    const b=bmap[y*W+x];if(!b||b.v.k===k)continue;
    if(hallOnly&&b.kind!=='hall')continue;
    if(k.wars.has(b.v.k))return b;
  }
  return null;
}
function nomad(u,s,i,adult){
  const st=u.settle,settler=!!(st&&st.found);
  if(adult){
    const vid=vown[i];
    if(vid){
      const tv=vById[vid];
      if(!settler&&tv&&tv.alive&&tv.race===u.t&&(!u.k||u.k===tv.k)&&tv.pop<tv.cap){u.v=tv;u.k=tv.k;u.settle=null;tv.pop++;return;}
    }else if((!settler||st.t<90||(u.x-st.x)*(u.x-st.x)+(u.y-st.y)*(u.y-st.y)<=36)&&canFound(u,i)){foundVillage(u);return;}
    if(!st&&(tick+u.id)%25===0){
      let best=null,bd=900;
      for(let n=1;n<vById.length;n++){
        const tv=vById[n];
        if(!tv.alive||tv.race!==u.t||(u.k&&u.k!==tv.k)||tv.pop>=tv.cap)continue;
        const d=(tv.x-u.x)*(tv.x-u.x)+(tv.y-u.y)*(tv.y-u.y);if(d<bd){bd=d;best=tv;}
      }
      if(best)u.settle={x:best.x,y:best.y,t:80,found:false,grp:null};
    }
  }
  if(u.settle){
    if(--u.settle.t<=0)u.settle=null;
    else{
      if(Math.random()<s.move){if(u.settle.grp)stepFlow(u,u.settle.grp);else stepTo(u,u.settle.x,u.settle.y);}
      return;
    }
  }
  if(Math.random()<s.move*.8)wander(u);
}
function rehome(u){
  const k=u.k,v=u.v,reg=region[u.y*W+u.x];
  let best=null,bd=1e9;
  for(const o of k.villages){
    if(region[o.y*W+o.x]!==reg)continue;
    const d=d2(o,u);if(d<bd){bd=d;best=o;}
  }
  v.pop--;
  if(best){u.v=best;best.pop++;}
  else{u.v=null;u.soldier=false;u.settle={x:u.x,y:u.y,t:420,found:true,grp:null};}
}
function soldierMove(u,s,k,tv,mv){
  let b=adjEnemyBld(u,true);
  if(!b&&Math.random()<.15)b=adjEnemyBld(u,false);
  if(b){if(u.cd<=0){u.cd=3;damageBld(b,s.atk*k.pow,u);if(Math.random()<.3)fx({k:'spark',x:b.x,y:b.y,t:4});}return;}
  if(region[u.y*W+u.x]===region[tv.y*W+tv.x]){if(Math.random()<mv)stepFlow(u,tv);return;}
  const port=k.port;
  if(port&&port.alive&&port.k===k&&port.dock&&k.landing){
    const dk=port.dock,dd=(u.x-dk.x)*(u.x-dk.x)+(u.y-dk.y)*(u.y-dk.y);
    if(dd>9&&Math.random()<mv){
      if(flowAt(port,u.x,u.y)<10)stepTo(u,dk.x,dk.y);else stepFlow(u,port);
    }
    return;
  }
  if(Math.random()<mv*.4)wander(u);
}
function updCiv(u,s,i){
  const adult=u.age>=s.adult;
  if(u.sick){
    u.sick--;
    if((tick+u.id)%10===0){
      u.hp-=2;if(u.hp<=0){kill(u);return;}
      const o=nearest(u,2,x=>x.t<=ORC&&!x.sick&&!x.immune);
      if(o&&Math.random()<.3)o.sick=200;
    }
    if(!u.sick)u.immune=true;
  }
  if(adult){
    if((tick+u.id)%(u.k&&u.k.wars.size?3:9)===0)u.foe=nearest(u,7,o=>hostile(u,o));
    let f=u.foe;
    if(f&&(f.dead||f.stowed||d2(u,f)>81))f=u.foe=null;
    if(f){
      const hv=u.v;
      if(hv&&f.k&&u.k&&(u.x-hv.x)*(u.x-hv.x)+(u.y-hv.y)*(u.y-hv.y)<(hv.rad+7)*(hv.rad+7)){u.k.rally=hv;u.k.rallyUntil=tick+220;}
      if(!strikeFoe(u,f,s)&&Math.random()<s.move)stepTo(u,f.x,f.y);
      return;
    }
  }
  const v=u.v;
  if(!v){nomad(u,s,i,adult);return;}
  if(!v.alive){u.v=null;if(u.k&&!u.k.alive)u.k=null;return;}
  const k=u.k,mv=s.move*(road[i]?1.5:1);
  if(u.soldier&&adult){
    const tv=k.target,ry=k.rally;
    const defend=ry&&ry.alive&&ry.k===k&&tick<k.rallyUntil&&region[i]===region[ry.y*W+ry.x]&&d2(u,ry)<8100;
    if(defend&&((u.id&1)||!tv)){
      if(d2(u,ry)>36){if(Math.random()<mv)stepFlow(u,ry);}
      else if(Math.random()<s.move*.5)wander(u);
      return;
    }
    if(tv&&tv.alive&&tv.k!==k&&k.wars.has(tv.k)){soldierMove(u,s,k,tv,mv);return;}
    if(!k.wars.size)u.soldier=false;
  }
  const dd=(u.x-v.x)*(u.x-v.x)+(u.y-v.y)*(u.y-v.y),R=v.rad+3;
  if(dd>R*R){
    if((tick+u.id)%40===0&&region[i]!==region[v.y*W+v.x]){rehome(u);return;}
    if(Math.random()<mv)stepFlow(u,v);
  }else if(Math.random()<s.move*.5)wander(u);
}

/* ---------- ships ---------- */
function seaPath(si,ti){
  if(si===ti)return[si];
  if(tile[si]>WATER||tile[ti]>WATER||wreg[si]!==wreg[ti])return null;
  prevA.fill(-1);
  let h=0,t=0;bfsQ[t++]=si;prevA[si]=si;
  while(h<t){
    const i=bfsQ[h++];if(i===ti)break;
    const x=i%W,y=(i/W)|0;
    for(let n=0;n<8;n++){
      const nx=x+DIRS[n][0],ny=y+DIRS[n][1];if(nx<0||ny<0||nx>=W||ny>=H)continue;
      const j=ny*W+nx;if(prevA[j]!==-1||tile[j]>WATER)continue;
      prevA[j]=i;bfsQ[t++]=j;
    }
  }
  if(prevA[ti]===-1)return null;
  const p=[];let c=ti;
  while(c!==si){p.push(c);c=prevA[c];}
  p.push(si);p.reverse();return p;
}
function launchBoat(k,path,cargo,mode,land){
  for(const u of cargo){u.stowed=true;u.foe=null;if(u.v){u.v.pop--;if(mode==='settle')u.v=null;}}
  sweepUnits();
  const i=path[0];
  boats.push({k,path,pi:0,x:i%W,y:(i/W)|0,cargo,mode,land,dir:1,dead:false});
}
function unloadBoat(b,lx,ly){
  b.dead=true;
  for(const u of b.cargo){
    u.stowed=false;
    if(lx<0){u.dead=true;continue;}
    let x=lx,y=ly;
    const o=DIRS[(Math.random()*8)|0];
    if(walkable(lx+o[0],ly+o[1])){x=lx+o[0];y=ly+o[1];}
    u.x=x;u.y=y;units.push(u);
    if(b.mode==='settle'){u.v=null;u.settle={x:lx,y:ly,t:420,found:true,grp:null};}
    else{u.soldier=true;if(u.v&&u.v.alive)u.v.pop++;}
  }
  b.cargo=[];
}
function beach(b){
  for(let n=0;n<8;n++){const x=b.x+DIRS[n][0],y=b.y+DIRS[n][1];if(walkable(x,y)){unloadBoat(b,x,y);return;}}
  unloadBoat(b,-1,-1);
}
function updBoats(){
  let w=0;
  for(let n=0;n<boats.length;n++){
    const b=boats[n];
    b.px=b.x;b.py=b.y;
    if(!b.dead){
      b.pi++;
      if(b.pi>=b.path.length){
        if(walkable(b.land.x,b.land.y))unloadBoat(b,b.land.x,b.land.y);else beach(b);
      }else{
        const i=b.path[b.pi];
        if(tile[i]>WATER)beach(b);
        else{const nx=i%W;if(nx!==b.x)b.dir=nx>b.x?1:-1;b.x=nx;b.y=(i/W)|0;}
      }
    }
    if(!b.dead)boats[w++]=b;
  }
  boats.length=w;
}
function coastWater(i,wr){
  const x=i%W;
  if(x>0&&tile[i-1]<=WATER&&(wr<0?wsize[wreg[i-1]]>=120:wreg[i-1]===wr))return i-1;
  if(x<W-1&&tile[i+1]<=WATER&&(wr<0?wsize[wreg[i+1]]>=120:wreg[i+1]===wr))return i+1;
  if(i>=W&&tile[i-W]<=WATER&&(wr<0?wsize[wreg[i-W]]>=120:wreg[i-W]===wr))return i-W;
  if(i<N-W&&tile[i+W]<=WATER&&(wr<0?wsize[wreg[i+W]]>=120:wreg[i+W]===wr))return i+W;
  return -1;
}
function findLanding(tv,wr){
  let best=null,bd=65535;const f=flowOf(tv);
  for(let ly=FR-36;ly<=FR+36;ly++)for(let lx=FR-36;lx<=FR+36;lx++){
    const d=f[ly*FD+lx];if(d>=bd||d<3)continue;
    const x=lx+tv.x-FR,y=ly+tv.y-FR;if(x<1||y<1||x>=W-1||y>=H-1)continue;
    const wi=coastWater(y*W+x,wr);if(wi<0)continue;
    bd=d;best={x,y,wi};
  }
  return best;
}
function dispatchRaid(k){
  const port=k.port,land=k.landing;
  if(!port||!port.alive||port.k!==k||!port.dock||!land||tick<k.boatCd)return;
  const dk=port.dock,grp=[];
  for(const u of units){
    if(u.k===k&&u.soldier&&!u.dead&&(u.x-dk.x)*(u.x-dk.x)+(u.y-dk.y)*(u.y-dk.y)<=20){grp.push(u);if(grp.length>=14)break;}
  }
  if(grp.length<5)return;
  const path=seaPath(dk.wi,land.wi);
  if(!path){k.target=null;k.landing=null;return;}
  launchBoat(k,path,grp,'raid',land);
  k.boatCd=tick+25;
}
