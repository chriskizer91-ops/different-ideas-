/* ================= terraforming, climate and weather ================= */
/* height bands above the sea: lowland, hills, mountains, peaks */
function bandOf(e){const r=e-SL;return r<0?-1:r<58?0:r<88?1:r<118?2:3;}
function tBase(i){return temp[i]/255*1.5-.25;}
function tEff(i){return tBase(i)-Math.max(0,elev[i]-SL)/155*.3;}
/* the natural ground for a lowland tile, from its warmth, wetness and height */
function biomeFor(i){
  const T=tEff(i),M=moist[i]/255,low=elev[i]-SL;
  if(low<3&&T>.2&&coastWater(i,-1)>=0)return SAND;
  if(T<.2)return M>.55?PINE:TUNDRA;
  if(T<.36)return M>.5?PINE:GRASS;
  if(T<.68){if(M>.76&&low<20)return SWAMP;return M>.52?FOREST:GRASS;}
  return M<.34?DESERT:M<.54?SAVANNA:JUNGLE;
}
function soilFor(t){return t===FOREST||t===JUNGLE?GRASS:t===PINE?GRASS:t===HILL||t===MOUNT||t===SNOW?HILL:t<=WATER?SAND:t;}
/* settle a tile's type after its height or climate changed */
function reclass(i,climateOnly){
  const t=tile[i],e=elev[i],b=bandOf(e);
  let n=t;
  if(b<0){if(t>WATER||climateOnly)n=e<SL-30?DEEP:WATER;}
  else if(b===0){
    if(t<=WATER||t===HILL||t===MOUNT||t===SNOW||climateOnly)n=biomeFor(i);
    if(t===RIVER&&!climateOnly)n=RIVER;
    if(t===LAVA||t===ASH)n=t;
  }else if(b===1)n=t===LAVA?t:HILL;
  else if(b===2)n=t===LAVA?t:tEff(i)<.12?SNOW:MOUNT;
  else n=SNOW;
  if(n!==t){const s=soilFor(n);setTile(i,n);soil[i]=s;}
  touch(i);
}
function terraBrush(tx,ty,fn){
  const r=brush+.5,R=Math.ceil(r);
  for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){
    const d=Math.sqrt(dx*dx+dy*dy);if(d>r)continue;
    const x=tx+dx,y=ty+dy;if(!inB(x,y))continue;
    fn(y*W+x,1-d/(r+.5),x,y);
  }
}
function raiseLand(tx,ty,dir){
  terraBrush(tx,ty,(i,f)=>{
    const t=tile[i];
    let step=dir*Math.max(1,Math.round(6*f));
    if(dir>0&&t<=WATER&&elev[i]+step<SL&&f>.5)step=Math.max(step,SL-elev[i]);
    elev[i]=Math.max(4,Math.min(255,elev[i]+step));
    reclass(i,false);
  });
  regionsDirty=true;
}
function flattenLand(tx,ty){
  if(!inB(tx,ty))return;
  const goal=elev[ty*W+tx];
  terraBrush(tx,ty,(i,f)=>{elev[i]=Math.round(elev[i]+(goal-elev[i])*.35*f);reclass(i,false);});
}
function climateBrush(tx,ty,dT,dM){
  terraBrush(tx,ty,(i,f)=>{
    if(dT)temp[i]=Math.max(0,Math.min(255,temp[i]+Math.round(dT*f)));
    if(dM)moist[i]=Math.max(0,Math.min(255,moist[i]+Math.round(dM*f)));
    const t=tile[i];
    if(t===LAVA||t===ASH||t===RIVER||t<=WATER){touch(i);return;}
    if(bandOf(elev[i])===0){
      const n=biomeFor(i);
      /* trees only take root where nobody has built */
      if(n!==t&&!(TREE[n]&&(bmap[i]||road[i]))){setTile(i,n);soil[i]=soilFor(n);}
    }else reclass(i,false);
    touch(i);
  });
}
function plantTrees(tx,ty){
  terraBrush(tx,ty,(i,f)=>{
    const t=tile[i];
    if(bmap[i]||road[i]||fire[i]||Math.random()>.55*f+.15)return;
    if(t!==GRASS&&t!==SAVANNA&&t!==TUNDRA&&t!==ASH&&t!==SAND&&t!==SWAMP&&t!==DESERT)return;
    const T=tEff(i),M=moist[i]/255;
    let n=T<.3?PINE:T>.66&&M>.4?JUNGLE:FOREST;
    if(t===DESERT&&M<.25)return;
    moist[i]=Math.max(moist[i],150);
    setTile(i,n);soil[i]=soilFor(n);
  });
}
/* a spring: water finds its way downhill to the sea, or pools into a lake */
function makeRiver(tx,ty){
  if(!inB(tx,ty))return false;
  let i=ty*W+tx;
  if(tile[i]<=WATER){toast('Tap dry land to start a river.');return false;}
  const seen=new Set();
  for(let st=0;st<900;st++){
    seen.add(i);
    const t=tile[i];
    if(t<=WATER)return true;
    if(st>0&&t===RIVER&&!seen.has(i))return true;
    if(t!==LAVA){if(bmap[i]&&bmap[i].solid)destroyBld(bmap[i]);setTile(i,RIVER);soil[i]=GRASS;}
    const x=i%W,y=(i/W)|0;let best=-1,bh=1e9;
    for(let k=0;k<8;k+=2){
      const nx=x+DIRS[k][0],ny=y+DIRS[k][1];if(!inB(nx,ny))continue;
      const j=ny*W+nx;if(seen.has(j))continue;
      const h=elev[j]-(tile[j]<=WATER?40:0)+Math.random()*2.5;
      if(h<bh){bh=h;best=j;}
    }
    if(best<0)break;
    if(elev[best]>elev[i])elev[best]=Math.max(SL,elev[i]-1);
    if(st>40&&elev[best]>=elev[i]&&Math.random()<.02){
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(inB(nx,ny)){const j=ny*W+nx;if(tile[j]!==MOUNT&&tile[j]!==SNOW){elev[j]=SL-6;setTile(j,WATER);}}}
      return true;
    }
    i=best;
  }
  return true;
}
/* the oceans rise or fall a step at a time */
function seaStep(){
  if(SL===seaGoal)return;
  SL+=SL<seaGoal?1:-1;
  for(let i=0;i<N;i++){
    const t=tile[i],wet=t<=WATER,low=elev[i]<SL;
    if(wet!==low)reclass(i,false);
    else if(wet&&t===WATER&&elev[i]<SL-30){tile[i]=DEEP;touch(i);}
    else if(wet&&t===DEEP&&elev[i]>=SL-30){tile[i]=WATER;touch(i);}
  }
  regionsDirty=true;dirtyOver=true;
  if(SL===seaGoal)chron(SL>100?'The great flood reaches its height':SL<100?'The seas have fallen to their lowest':'The seas return to their old shores','disaster');
}
/* ---------- weather: storms drift with the wind ---------- */
const WIND={x:.035,y:.008};
function stormsStep(){
  if(S.weather&&tick%YEAR===0&&storms.length<6&&Math.random()<.55){
    const i=randomTile(j=>tile[j]>WATER,60);
    if(i>=0){
      const x=i%W,y=(i/W)|0,thunder=Math.random()<.35;
      storms.push({x,y,r:6+Math.random()*9,t:0,life:(5+Math.random()*9)*YEAR|0,thunder,id:uid++});
    }
  }
  let w=0;
  for(const s of storms){
    s.t++;s.x+=WIND.x*(1+Math.sin(s.t*.01+s.id)*.5);s.y+=WIND.y+Math.sin(s.t*.007+s.id)*.02;
    if(tick%8===0){
      const r=s.r,R=Math.ceil(r);
      for(let m=0;m<12;m++){
        const dx=(Math.random()*2-1)*R,dy=(Math.random()*2-1)*R;if(dx*dx+dy*dy>r*r)continue;
        const x=Math.round(s.x+dx),y=Math.round(s.y+dy);if(!inB(x,y))continue;
        const i=y*W+x;
        if(fire[i]){fire[i]=0;touch(i);}
        if(tile[i]===ASH&&Math.random()<.3)setTile(i,soil[i]===HILL?HILL:soil[i]);
        else if(tile[i]===LAVA&&Math.random()<.1)setTile(i,HILL,true);
      }
    }
    if(s.thunder&&Math.random()<.006)strike(Math.round(s.x+(Math.random()-.5)*s.r),Math.round(s.y+(Math.random()-.5)*s.r));
    if(s.t<s.life&&s.x<W+20&&s.y<H+20&&s.y>-20)storms[w++]=s;
  }
  storms.length=w;
}
function stormAmt(s){return Math.min(1,s.t/120,(s.life-s.t)/120);}
