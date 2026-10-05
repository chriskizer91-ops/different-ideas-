/* ================= terraforming, climate and weather ================= */
/* height bands above the sea: lowland, hills, mountains, peaks */
function bandOf(e){const r=e-SL;return r<0?-1:r<58?0:r<88?1:r<118?2:3;}
/* warmth of a tile: its own climate plus the world's warming (or the god's cooling) */
function tBase(i,w){return temp[i]/255*1.5-.25+(w===undefined?gWarm:w);}
function tEff(i,w){return tBase(i,w)-Math.max(0,elev[i]-SL)/155*.3;}
/* land this cold lies under an ice sheet; hills need it colder still */
const ICE_T=.02;
function iceAt(i,w){const b=bandOf(elev[i]);return b>=0&&b<=1&&tEff(i,w)<ICE_T-(b===1?.04:0);}
/* the natural ground for a lowland tile, from its warmth, wetness and height */
function biomeFor(i,w){
  const T=tEff(i,w),M=moist[i]/255,low=elev[i]-SL;
  if(T<ICE_T)return ICE;
  if(low<3&&T>.2&&coastWater(i,-1)>=0)return SAND;
  if(T<.2)return M>.55?PINE:TUNDRA;
  if(T<.36)return M>.5?PINE:GRASS;
  if(T<.68){if(M>.76&&low<20)return SWAMP;return M>.52?FOREST:GRASS;}
  return M<.34?DESERT:M<.54?SAVANNA:JUNGLE;
}
function soilFor(t){return t===FOREST||t===JUNGLE?GRASS:t===PINE?GRASS:t===HILL||t===MOUNT||t===SNOW?HILL:t<=WATER?SAND:t===ICE?TUNDRA:t;}
/* settle a tile's type after its height or climate changed */
function reclass(i,climateOnly){
  const t=tile[i],e=elev[i],b=bandOf(e);
  let n=t;
  if(b<0){if(t>WATER||climateOnly)n=e<SL-30?DEEP:WATER;}
  else if(b===0){
    if(t<=WATER||t===HILL||t===MOUNT||t===SNOW||t===ICE||climateOnly)n=biomeFor(i);
    if(t===RIVER&&!climateOnly)n=RIVER;
    if(t===LAVA||t===ASH)n=t;
  }else if(b===1)n=t===LAVA?t:iceAt(i)?ICE:HILL;
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
    let step=dir*Math.max(1,Math.round(6*f*sculptStr/5));
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
  const up=SL<seaGoal;SL+=up?1:-1;
  /* only the shore line at the old and new level changes; inland lakes keep their water */
  const edgeE=up?SL-1:SL;
  for(let i=0;i<N;i++){
    const t=tile[i],wet=t<=WATER;
    if(elev[i]===edgeE&&(up?!wet:wet)){
      const b=bmap[i];
      if(up&&b&&b.kind==='hall'&&b.v.alive&&!quiet)chron('The rising sea swallows '+b.v.name+(b.v.k.alive?' of '+b.v.k.name:''),'disaster',b.v);
      reclass(i,false);
    }
    else if(wet&&t===WATER&&elev[i]<SL-30){tile[i]=DEEP;touch(i);}
    else if(wet&&t===DEEP&&elev[i]>=SL-30){tile[i]=WATER;touch(i);}
  }
  regionsDirty=true;dirtyOver=true;
  if(SL===seaGoal&&seaByGod){seaByGod=false;chron(SL>100?'The great flood reaches its height':SL<100?'The seas have fallen to their lowest':'The seas return to their old shores','disaster');}
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
/* ---------- reading the land: heights in metres, peaks, the readout ---------- */
/* heights in metres: plains up to 900 m, hills to 2,200, mountains to 4,200, peaks to 8,000 */
function metres(e){
  const d=e-SL;if(d<0)return-Math.round(-d*60/10)*10;
  const m=d<58?d/58*900:d<88?900+(d-58)/30*1300:d<118?2200+(d-88)/30*2000:4200+(d-118)/37*3800;
  return Math.round(m/10)*10;
}
function fmtM(m){return(m<0?'-':'')+Math.abs(m).toLocaleString('en-US')+' m';}
let spotCache={t:0,list:[]};
function drawSpotHeights(ox,oy,z,x0,y0,x1,y1){
  const t=now();
  if(t-spotCache.t>700){
    const cell=Math.max(8,Math.round(90/Math.max(1,cam.z))),list=[];
    const xa=Math.max(1,x0|0),ya=Math.max(1,y0|0),xb=Math.min(W-2,x1|0),yb=Math.min(H-2,y1|0);
    for(let cy=ya;cy<yb;cy+=cell)for(let cx=xa;cx<xb;cx+=cell){
      let bi=-1,be=-1;
      for(let y=cy;y<Math.min(yb,cy+cell);y++)for(let x=cx;x<Math.min(xb,cx+cell);x++){const i=y*W+x;if(elev[i]>be){be=elev[i];bi=i;}}
      if(bi<0||be-SL<25)continue;
      const bx=bi%W,by=(bi/W)|0;let top=true;
      for(let dy=-2;dy<=2&&top;dy++)for(let dx=-2;dx<=2;dx++){const x=bx+dx,y=by+dy;if(inB(x,y)&&elev[y*W+x]>be){top=false;break;}}
      if(top)list.push([bx,by,be]);
    }
    list.sort((a,b)=>b[2]-a[2]);list.length=Math.min(list.length,30);
    spotCache={t,list};
  }
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='600 '+Math.round(11*dpr)+'px '+FONT;
  for(const[x,y,e]of spotCache.list){
    const px=ox+(x+.5)*z,py=oy+(y+.5)*z;
    ctx.fillStyle='#3a2414';ctx.beginPath();ctx.moveTo(px,py-4*dpr);ctx.lineTo(px+4*dpr,py+3*dpr);ctx.lineTo(px-4*dpr,py+3*dpr);ctx.closePath();ctx.fill();
    ctx.lineWidth=3*dpr;ctx.strokeStyle='rgba(255,252,240,.85)';const s=fmtM(metres(e));
    ctx.strokeText(s,px+6*dpr,py);ctx.fillStyle='#3a2414';ctx.fillText(s,px+6*dpr,py);
  }
}
/* the height under the pointer */
function drawReadout(ox,oy,z){
  const p=hoverP;if(!p||busy)return;
  const t=toTile(p);if(!inB(t.x,t.y))return;
  const i=t.y*W+t.x,m=metres(elev[i]),txt=(m<0?'Depth '+fmtM(-m):'Height '+fmtM(m))+' · '+TD[tile[i]].n;
  ctx.font='600 '+Math.round(12*dpr)+'px '+FONT;ctx.textAlign='left';ctx.textBaseline='top';
  const w=ctx.measureText(txt).width,x=p.x*dpr+14*dpr,y=p.y*dpr+14*dpr;
  ctx.fillStyle='rgba(11,24,40,.88)';ctx.fillRect(x-5*dpr,y-4*dpr,w+10*dpr,20*dpr);
  ctx.fillStyle='#fff6d6';ctx.fillText(txt,x,y);
}
/* ---------- sculpting: strength, smoothing, ridges, valleys, terraces, erosion ---------- */
let sculptStr=5,flatGoal=-1,strokeSeed=0;
function sculptStart(){flatGoal=-1;strokeSeed=(Math.random()*9999)|0;}
const sround=v=>Math.max(0,Math.min(255,Math.floor(v+Math.random())));
function vnoise(x,y){
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hsh(xi,yi),b=hsh(xi+1,yi),c=hsh(xi,yi+1),d=hsh(xi+1,yi+1);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
function sculpt(id,tx,ty){
  const k=sculptStr/5,touched=[];
  if(id==='smooth'){
    const upd=[];
    terraBrush(tx,ty,(i,f,x,y)=>{let s=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(inB(xx,yy)){s+=elev[yy*W+xx];n++;}}upd.push(i,s/n,f);});
    for(let m=0;m<upd.length;m+=3){const i=upd[m];elev[i]=sround(elev[i]+(upd[m+1]-elev[i])*Math.min(1,.55*upd[m+2]*k));touched.push(i);}
  }else if(id==='flatten'){
    if(flatGoal<0&&inB(tx,ty))flatGoal=elev[ty*W+tx];
    terraBrush(tx,ty,(i,f)=>{elev[i]=sround(elev[i]+(flatGoal-elev[i])*Math.min(1,.4*f*k));touched.push(i);});
  }else if(id==='roughen'){
    terraBrush(tx,ty,(i,f,x,y)=>{const n=vnoise(x*.45+strokeSeed,y*.45)*.65+vnoise(x*1.1+strokeSeed,y*1.1+7)*.35;elev[i]=sround(elev[i]+(n-.5)*7*f*k);touched.push(i);});
  }else if(id==='ridge'){
    terraBrush(tx,ty,(i,f,x,y)=>{const n=1-Math.abs(2*vnoise(x*.32+strokeSeed,y*.32)-1),r=n*n;elev[i]=sround(elev[i]+(1.5+r*7)*Math.pow(f,1.3)*k);touched.push(i);});
  }else if(id==='valley'){
    terraBrush(tx,ty,(i,f)=>{elev[i]=sround(elev[i]-Math.pow(f,1.8)*7*k);touched.push(i);});
  }else if(id==='terrace'){
    terraBrush(tx,ty,(i,f)=>{const d=elev[i]-SL;if(d<0)return;const goal=SL+Math.round(d/9)*9;elev[i]=sround(elev[i]+(goal-elev[i])*Math.min(1,.5*f*k));touched.push(i);});
  }else if(id==='erode'){
    for(let it=0;it<2+((k*2)|0);it++)terraBrush(tx,ty,(i,f,x,y)=>{
      let lo=-1,le=elev[i];
      for(let n=0;n<8;n++){const xx=x+DIRS[n][0],yy=y+DIRS[n][1];if(!inB(xx,yy))continue;const j=yy*W+xx;if(elev[j]<le){le=elev[j];lo=j;}}
      if(lo<0)return;
      const d=elev[i]-le;if(d<2)return;
      const mv=Math.min(d*.45,(d-1)*.35*f*Math.min(2,k));
      elev[i]=sround(elev[i]-mv);elev[lo]=sround(elev[lo]+mv*.6);touched.push(i,lo);
    });
  }
  for(const i of touched)reclass(i,false);
  regionsDirty=true;
}
/* ---------- water finds its way: basins fill into lakes, rain gathers into rivers ---------- */
function letWaterFlow(){
  /* old rivers dry up first, so the new network follows today's land */
  for(let i=0;i<N;i++)if(tile[i]===RIVER&&!bmap[i]){const n=bandOf(elev[i])===0?biomeFor(i):HILL;setTile(i,n);soil[i]=soilFor(n);}
  const F=new Int16Array(N),seen=new Uint8Array(N),parent=new Int32Array(N).fill(-1),order=new Int32Array(N);
  const qs=[],qh=new Int32Array(512);for(let l=0;l<512;l++)qs.push([]);
  let on=0,cur=0;
  const push=(i,l)=>{qs[l].push(i);if(l<cur)cur=l;};
  for(let i=0;i<N;i++){
    const x=i%W,y=(i/W)|0,edge=x===0||y===0||x===W-1||y===H-1;
    if((tile[i]<=WATER&&elev[i]<SL)||edge){seen[i]=1;F[i]=elev[i];push(i,elev[i]);}
  }
  cur=0;
  for(;;){
    while(cur<512&&qh[cur]>=qs[cur].length)cur++;
    if(cur>=512)break;
    const i=qs[cur][qh[cur]++];order[on++]=i;
    const x=i%W,y=(i/W)|0;
    for(let n=0;n<8;n++){
      const xx=x+DIRS[n][0],yy=y+DIRS[n][1];if(xx<0||yy<0||xx>=W||yy>=H)continue;
      const j=yy*W+xx;if(seen[j])continue;
      seen[j]=1;F[j]=Math.max(elev[j],F[i]);parent[j]=i;push(j,F[j]);
    }
  }
  /* lakes: filled hollows on land, if big enough to matter */
  let lakes=0;const lk=new Uint8Array(N);
  for(let i=0;i<N;i++)if(F[i]>elev[i]&&tile[i]>WATER&&elev[i]>=SL&&WALK[tile[i]])lk[i]=1;
  const comp=[];
  for(let s=0;s<N;s++){
    if(lk[s]!==1)continue;
    comp.length=0;const st=[s];lk[s]=2;
    while(st.length){const i=st.pop();comp.push(i);const x=i%W,y=(i/W)|0;for(let n=0;n<8;n+=2){const xx=x+DIRS[n][0],yy=y+DIRS[n][1];if(!inB(xx,yy))continue;const j=yy*W+xx;if(lk[j]===1){lk[j]=2;st.push(j);}}}
    let deep=0;for(const i of comp)deep=Math.max(deep,F[i]-elev[i]);
    if(comp.length<4||deep<3)continue;
    lakes++;
    for(const i of comp){if(bmap[i])destroyBld(bmap[i]);setTile(i,WATER);soil[i]=SAND;}
  }
  /* rivers: where the gathered rain grows large */
  const acc=new Float32Array(N);
  for(let m=on-1;m>=0;m--){
    const i=order[m];acc[i]+=.5+moist[i]/255;
    const p=parent[i];if(p>=0)acc[p]+=acc[i];
  }
  const landAcc=[];
  for(let i=0;i<N;i++)if(tile[i]>WATER&&tile[i]!==MOUNT&&tile[i]!==SNOW&&tile[i]!==LAVA)landAcc.push(acc[i]);
  if(!landAcc.length)return{lakes,rivers:0};
  landAcc.sort((a,b)=>b-a);
  const thr=Math.max(40,landAcc[Math.min(landAcc.length-1,Math.floor(landAcc.length*.013))]);
  let rivers=0;
  for(let i=0;i<N;i++){
    const t=tile[i];
    if(acc[i]<thr||t<=WATER||t===MOUNT||t===SNOW||t===LAVA)continue;
    const b=bmap[i];if(b&&b.solid)continue;
    if(b)destroyBld(b);
    setTile(i,RIVER);soil[i]=GRASS;rivers++;
  }
  regionsDirty=true;dirtyOver=true;
  return{lakes,rivers};
}
/* ---------- empty worlds to sculpt from scratch ---------- */
function blankWorld(kind,rnd){
  for(let i=0;i<N;i++){
    const x=i%W,y=(i/W)|0,edge=Math.min(x,y,W-1-x,H-1-y);
    if(kind==='ocean'||edge<4){
      elev[i]=Math.round(40+vnoise(x*.05,y*.05)*30);tile[i]=elev[i]<SL-30?DEEP:WATER;soil[i]=SAND;
    }else{
      elev[i]=Math.round(102+Math.min(edge-4,46)/46*9+vnoise(x*.06,y*.06)*3);
      const t=biomeFor(i);tile[i]=t===SAND?GRASS:t;soil[i]=soilFor(tile[i]);
    }
  }
}
