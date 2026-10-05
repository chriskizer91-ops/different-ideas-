/* ================= god powers ================= */
let brush=2;
function forBrush(tx,ty,fn){
  const r=brush-1,lim=r*r+r*.8;
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(dx*dx+dy*dy>lim)continue;
    const x=tx+dx,y=ty+dy;if(inB(x,y))fn(y*W+x,x,y);
  }
}
function killNear(x,y,r){
  const rr=r*r;
  for(const u of units)if(!u.dead&&(u.x-x)*(u.x-x)+(u.y-y)*(u.y-y)<=rr)kill(u);
  for(const b of boats)if(!b.dead&&(b.x-x)*(b.x-x)+(b.y-y)*(b.y-y)<=rr){b.dead=true;b.cargo=[];fx({k:'boom',x:b.x,y:b.y,r:1.5,t:10,T:10});}
  sweepUnits();
}
function kingdomAt(tx,ty){
  if(!inB(tx,ty))return null;
  const vid=vown[ty*W+tx];if(!vid)return null;
  const v=vById[vid];return v&&v.alive?v.k:null;
}
function applyBrush(tx,ty,tool){
  if(tool.tile!==undefined){forBrush(tx,ty,i=>setTile(i,tool.tile,true));return;}
  switch(tool.id){
    case'fire':forBrush(tx,ty,i=>{if(Math.random()<.6)ignite(i);});break;
    case'rain':
      forBrush(tx,ty,(i,x,y)=>{
        if(fire[i]){fire[i]=0;touch(i);}const t=tile[i];
        if(t===ASH)setTile(i,soil[i]===HILL?HILL:soil[i]);
        else if(t===LAVA)setTile(i,HILL,true);
        else if(t===DESERT&&Math.random()<.05)setTile(i,SAVANNA,true);
        else if(t===GRASS&&!vown[i]&&!bmap[i]&&Math.random()<.03)setTile(i,FOREST);
        if(Math.random()<.25)fx({k:'rain',x:x+Math.random(),y:y+Math.random(),t:6+((Math.random()*6)|0)});
      });
      break;
    case'smite':killNear(tx,ty,brush-.2);break;
    case'plague':{
      const rr=(brush-.2)*(brush-.2);
      for(const u of units)if(u.t<=ORC&&!u.sick&&(u.x-tx)*(u.x-tx)+(u.y-ty)*(u.y-ty)<=rr){u.sick=200;u.immune=false;}
      break;
    }
    case'bless':{
      const rr=(brush+.5)*(brush+.5);
      for(const u of units)if((u.x-tx)*(u.x-tx)+(u.y-ty)*(u.y-ty)<=rr&&u.t<=ORC){u.hp=SPEC[u.t].hp;u.sick=0;u.immune=true;}
      forBrush(tx,ty,i=>{if(fire[i]){fire[i]=0;touch(i);}if(tile[i]===ASH)setTile(i,soil[i]===HILL?HILL:soil[i]);const b=bmap[i];if(b){b.hp=Math.max(b.hp,b.kind==='hall'?hallHp(b.v):BHP[b.kind]);b.v.res+=2;}});
      if(Math.random()<.5)fx({k:'ring',x:tx,y:ty,r:brush+1,t:16,T:16});
      break;
    }
  }
}
function spawnBrush(tx,ty,type){
  const n=brush<=1?1:brush+1,r=brush-1;
  for(let k=0;k<n;k++){
    const x=tx+Math.round((Math.random()*2-1)*r),y=ty+Math.round((Math.random()*2-1)*r);
    if(type===DRAGON){if(inB(x,y))spawn(DRAGON,x,y);break;}
    if(walkable(x,y))spawn(type,x,y);
  }
}
function strike(tx,ty){
  if(!inB(tx,ty))return;
  fx({k:'bolt',x:tx,y:ty,t:10,seed:(Math.random()*1e6)|0});
  const i=ty*W+tx;ignite(i);
  const b=bmap[i];if(b)damageBld(b,45,null);
  killNear(tx,ty,1.6);
}
function blast(tx,ty,r,lava){
  for(let dy=-r-3;dy<=r+3;dy++)for(let dx=-r-3;dx<=r+3;dx++){
    const x=tx+dx,y=ty+dy;if(!inB(x,y))continue;
    const d=Math.sqrt(dx*dx+dy*dy),i=y*W+x;
    if(d<=r){
      const b=bmap[i];if(b)destroyBld(b);
      const t=tile[i];
      if(lava&&d<r*.42&&t>WATER)setTile(i,LAVA,true);
      else if(t===MOUNT||t===SNOW)setTile(i,HILL,true);
      else if(t>WATER&&t!==LAVA&&t!==HILL&&t!==RIVER)setTile(i,ASH);
      fire[i]=0;road[i]=0;touch(i);
    }else if(d<=r+3&&Math.random()<.3)ignite(i);
  }
  killNear(tx,ty,r+.8);
  fx({k:'boom',x:tx,y:ty,r:r+2,t:22,T:22});
  if(!reduceMotion)shake=Math.max(shake,r*2);
}
function stirWar(tx,ty){
  const k=kingdomAt(tx,ty);
  if(!k){toast('Tap land that belongs to a realm.');return;}
  let best=null,bd=1e9;
  for(const o of kingdoms){
    if(!o.alive||o===k||k.wars.has(o)||!o.villages.length)continue;
    let d=1e9;for(const v of o.villages){const c=nearestVillageOf(k,v.x,v.y);if(c){const q=d2(c,v);if(q<d)d=q;}}
    if(d<bd){bd=d;best=o;}
  }
  if(!best){toast(k.name+' has no one left to fight.');return;}
  bubble(k,'The heavens demand war!');
  declareWar(k,best,'Whispers from the heavens drive '+k.name+' to war with '+best.name);
}
function calmRealm(tx,ty){
  const k=kingdomAt(tx,ty);
  if(!k){toast('Tap land that belongs to a realm.');return;}
  if(!k.wars.size){toast(k.name+' is already at peace.');return;}
  for(const o of[...k.wars])makePeace(k,o,true);
  bubble(k,'Lay down your arms.');
  chron('A hush from the heavens ends the wars of '+k.name,'peace');
}
function inspect(tx,ty){
  if(!inB(tx,ty)){hideInfo();return;}
  let u=null,bd=5;
  for(const o of units){const d=(o.x-tx)*(o.x-tx)+(o.y-ty)*(o.y-ty);if(d<bd){bd=d;u=o;}}
  const i=ty*W+tx,vid=vown[i],v=vid?vById[vid]:null,b=bmap[i];
  let html;
  if(u&&bd<=2){
    const s=SPEC[u.t],yrs=Math.floor(u.age/YEAR);
    const role=u.t>ORC?'':u.age<s.adult?'Child':u.soldier?'Soldier':u.v?'Villager':u.settle&&u.settle.found?'Settler':'Wanderer';
    html='<b>'+s.name+(u.k?' of '+esc(u.k.name):'')+'</b><small>'+(role?role+', ':'')+yrs+(yrs===1?' year old':' years old')+(u.sick?', sick with plague':'')+'</small>';
  }else if(v&&v.alive){
    const k=v.k;
    html='<b>'+esc(v.name)+'</b><small>'+SPEC[v.race].name+' settlement of '+esc(k.name)+', '+AGES[k.age]+' Age</small>'+
      '<small>'+v.pop+' of '+v.cap+' people, '+v.houses+' homes, '+v.farms+' farms</small>'+
      (b?'<small>This is its '+(b.kind==='farm'&&b.grove?'grove':b.kind)+'</small>':'')+
      (k.wars.size?'<small>At war with '+[...k.wars].map(o=>esc(o.name)).join(', ')+'</small>':'');
  }else html='<b>'+TD[tile[i]].n+'</b>';
  showInfo(html);
}
