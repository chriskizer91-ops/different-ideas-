/* ================= world ================= */
function alloc(w,h){
  W=w;H=h;N=w*h;
  tile=new Uint8Array(N);soil=new Uint8Array(N);temp=new Uint8Array(N);moist=new Uint8Array(N);elev=new Uint8Array(N);fire=new Uint8Array(N);road=new Uint8Array(N);
  vown=new Uint16Array(N);region=new Uint16Array(N);wreg=new Uint16Array(N);wsize=new Int32Array(65536);
  shade=new Float32Array(N);base=new Uint32Array(N);bmap=new Array(N).fill(null);
  bfsQ=new Int32Array(N);prevA=new Int32Array(N);
  GW=Math.ceil(W/8);GH=Math.ceil(H/8);grid=Array.from({length:GW*GH},()=>[]);
  animCap=Math.max(150,Math.min(700,Math.round(N/250)));
  allocRender();
}
function flood(dst,land,sizes){
  dst.fill(0);let id=0;
  for(let s=0;s<N;s++){
    if(dst[s])continue;const ts=tile[s];
    if(land?!WALK[ts]:ts>WATER)continue;
    if(id>=65534)break;
    id++;let n=0,cnt=0;bfsQ[n++]=s;dst[s]=id;
    while(n){
      const i=bfsQ[--n],x=i%W,y=(i/W)|0;cnt++;
      for(let k=0;k<8;k++){
        const nx=x+DIRS[k][0],ny=y+DIRS[k][1];if(nx<0||ny<0||nx>=W||ny>=H)continue;
        const j=ny*W+nx;if(dst[j])continue;const tj=tile[j];
        if(land?!WALK[tj]:tj>WATER)continue;
        dst[j]=id;bfsQ[n++]=j;
      }
    }
    if(sizes)sizes[id]=cnt;
  }
}
function computeRegions(){
  flood(region,true,null);flood(wreg,false,wsize);
  /* keep path fields that no changed tile can have touched */
  const ns=regionStamp+1;
  if(!dirtyOver){
    for(let n=1;n<vById.length;n++){
      const v=vById[n];if(!v.alive||!v.flow||v.flowStamp!==regionStamp)continue;
      let hitIt=false;
      for(let m=0;m<dirtyWalk.length;m++){
        const i=dirtyWalk[m],dx=(i%W)-v.x,dy=((i/W)|0)-v.y;
        if(dx>=-FR&&dx<=FR&&dy>=-FR&&dy<=FR){hitIt=true;break;}
      }
      if(!hitIt)v.flowStamp=ns;
    }
  }
  regionStamp=ns;dirtyWalk.length=0;dirtyOver=false;regionsDirty=false;
}

function setTile(i,t,paint){
  const old=tile[i];if(old===t)return;
  tile[i]=t;
  if(paint){
    if(t===GRASS||t===SAND||t===DESERT||t===SAVANNA||t===TUNDRA||t===SWAMP)soil[i]=t;
    else if(t===FOREST||t===JUNGLE){if(soil[i]!==GRASS&&soil[i]!==SWAMP&&soil[i]!==SAVANNA)soil[i]=GRASS;}
    else if(t===PINE){if(soil[i]!==TUNDRA&&soil[i]!==GRASS)soil[i]=GRASS;}
    else if(t===HILL||t===MOUNT||t===SNOW)soil[i]=HILL;
    else if(t<=WATER)soil[i]=SAND;
    elev[i]=Math.max(0,Math.min(255,ELEV0[t]+SL-100));
    road[i]=0;
  }
  const b=bmap[i];
  if(b&&!WALK[t])destroyBld(b);
  if(fire[i]&&!BURN[t]&&!bmap[i])fire[i]=0;
  if(WALK[old]!==WALK[t]){regionsDirty=true;if(dirtyWalk.length<300)dirtyWalk.push(i);else dirtyOver=true;}
  else if((old<=WATER)!==(t<=WATER))regionsDirty=true;
  touch(i);
}

/* ---------- colours ---------- */
function kAt(x,y){
  if(x<0||y<0||x>=W||y>=H)return 0;
  const id=vown[y*W+x];if(!id)return 0;
  const v=vById[id];return v&&v.alive?v.k.id:0;
}
function landAt(x,y){return x>=0&&y>=0&&x<W&&y<H&&tile[y*W+x]>WATER;}
function colorOf(i){
  const t=tile[i],d=TD[t],s=shade[i]*d.v,c0=d.c;
  let r=c0[0]+s,g=c0[1]+s,b=c0[2]+s;
  const x=i%W,y=(i/W)|0;
  if(t<=WATER){
    if(t===DEEP){const dp=(90-elev[i])*.3;r-=dp*.45;g-=dp*.75;b-=dp;}
    else if(landAt(x-1,y)||landAt(x+1,y)||landAt(x,y-1)||landAt(x,y+1)){r+=46;g+=44;b+=30;}
  }else if(t!==LAVA){
    let a=elev[(y>0&&x>0)?i-W-1:i],c=elev[(y<H-1&&x<W-1)?i+W+1:i];
    if(a<100)a=100;if(c<100)c=100;
    let L=(c-a)*2.1;if(L>36)L=36;else if(L<-44)L=-44;
    if(t===RIVER)L*=.25;
    r+=L;g+=L;b+=L*.92;
    if(TREE[t]&&((x*7+y*13)&3)===0){r-=14;g-=14;b-=10;}
  }
  if(road[i]){
    if(t===RIVER){r+=(138-r)*.75;g+=(102-g)*.75;b+=(68-b)*.75;}
    else{r+=(172-r)*.55;g+=(144-g)*.55;b+=(100-b)*.55;}
  }
  if(S.borders){
    const vid=vown[i];
    if(vid){
      const v=vById[vid];
      if(v&&v.alive){
        const kc2=v.k.rgb,kid=v.k.id;
        const edge=kAt(x-1,y)!==kid||kAt(x+1,y)!==kid||kAt(x,y-1)!==kid||kAt(x,y+1)!==kid;
        const al=edge?.58:.13;
        r+=(kc2[0]-r)*al;g+=(kc2[1]-g)*al;b+=(kc2[2]-b)*al;
      }
    }
  }
  r=r<0?0:r>255?255:r|0;g=g<0?0:g>255?255:g|0;b=b<0?0:b>255?255:b|0;
  return (255<<24|b<<16|g<<8|r)>>>0;
}
function recolor(i){base[i]=colorOf(i);}
function recolorAround(i){
  const x=i%W,y=(i/W)|0;
  for(let dy=-1;dy<=1;dy++){const ny=y+dy;if(ny<0||ny>=H)continue;for(let dx=-1;dx<=1;dx++){const nx=x+dx;if(nx<0||nx>=W)continue;const j=ny*W+nx;base[j]=colorOf(j);}}
}
/* the renderer listens for tile changes here */
function touch(i){if(G)G.touch(i);else recolorAround(i);}
function touchRows(y0,y1){if(G)G.touchRows(y0,y1);else dirtyAll=true;}
function recolorAll(){for(let i=0;i<N;i++)base[i]=colorOf(i);dirtyAll=false;}
let sweepY=0;
function sweep(){
  const rows=Math.max(2,Math.ceil(H/90));
  for(let n=0;n<rows;n++){
    const y=sweepY;sweepY=(sweepY+1)%H;let i=y*W;
    for(let x=0;x<W;x++,i++){
      if(!reduceMotion&&tile[i]<=WATER&&Math.random()<.12)shade[i]=Math.random()*2-1;
      base[i]=colorOf(i);
    }
  }
}

/* ---------- generation ---------- */
function genWorld(seed,opt){
  const sz=SIZES[opt.size]||SIZES.grand;
  alloc(sz[0],sz[1]);
  capMul=opt.size==='cozy'?.7:opt.size==='colossal'?1.3:1;
  units=[];vById=[null];kingdoms=[];wars=[];boats=[];twisters=[];towers=[];fireList=[];effects=[];sched=[];chronicle=[];bubbles=[];risen=[];
  relM.clear();truM.clear();counts.fill(0);dirtyWalk=[];dirtyOver=true;
  planes=[];raising=[];history=[];wonderOf={};firstTech={};launches=0;lastEvent=null;SL=100;seaGoal=100;storms=[];worldAge=-1;colonyEver=false;
  tick=0;uid=1;sweepY=0;chronDirty=true;
  const rnd=mulberry(seed);
  kc=(rnd()*COLORS.length)|0;
  const n1=mkNoise(rnd),n2=mkNoise(rnd),n3=mkNoise(rnd),n4=mkNoise(rnd);
  const hgt=new Float32Array(N),rdg=new Float32Array(N),mst=new Float32Array(N),tmp=new Float32Array(N),mv=new Float32Array(N);
  const Sc=1/150;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,nx=x*Sc,ny=y*Sc;
    const ed=Math.min(x,W-1-x,y,H-1-y)/22,e=ed<1?(1-ed)*(1-ed):0;
    hgt[i]=fbm(n1,nx*1.9,ny*1.9,5)-e*.45;
    rdg[i]=1-Math.abs(2*fbm(n4,nx*3.1+5.2,ny*3.1+9.7,4)-1);
    mst[i]=fbm(n2,nx*3.3+11,ny*3.3+4,4);
    tmp[i]=fbm(n3,nx*2.2+31,ny*2.2+17,3);
    shade[i]=rnd()*2-1;
  }
  const sorted=Float32Array.from(hgt).sort();
  const lf=opt.land==='islands'?.28:opt.land==='pangea'?.6:.43;
  const q=p=>sorted[Math.max(0,Math.min(N-1,(p*N)|0))];
  const sea=q(1-lf),shal=q(1-lf-.08),top=sorted[N-1],bot=sorted[0];
  const lm=[];
  for(let i=0;i<N;i++){
    if(hgt[i]<sea){mv[i]=0;continue;}
    const el=(hgt[i]-sea)/(top-sea+1e-6),g=Math.min(1,el/.1);
    mv[i]=el*.55+rdg[i]*rdg[i]*rdg[i]*.6*g*g;lm.push(mv[i]);
  }
  lm.sort((a,b)=>a-b);
  const lq=p=>lm.length?lm[Math.min(lm.length-1,(p*lm.length)|0)]:9;
  const qh=lq(.8),qm=lq(.9),qn=lq(.972);
  const t0=opt.climate==='cold'?-.06:opt.climate==='hot'?.36:.17,ts=opt.climate==='hot'?.7:.8;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,hv=hgt[i];
    {const tb=t0+ts*(y/(H-1))+(tmp[i]-.5)*.32,mb=Math.max(0,Math.min(1,(mst[i]-.5)*2.3+.5));
     temp[i]=Math.max(0,Math.min(255,Math.round((tb+.25)/1.5*255)));moist[i]=Math.round(mb*255);}
    if(hv<sea){
      tile[i]=hv<shal?DEEP:WATER;soil[i]=SAND;
      elev[i]=Math.max(0,Math.min(96,18+(hv-bot)/(sea-bot+1e-6)*74));
      continue;
    }
    const el=(hv-sea)/(top-sea+1e-6),m=mv[i];
    const T=t0+ts*(y/(H-1))+(tmp[i]-.5)*.32-m*.22;
    const M=Math.max(0,Math.min(1,(mst[i]-.5)*2.3+.5));
    let t,so;
    if(m>qn||(m>qm&&T<.12)){t=SNOW;so=HILL;}
    else if(m>qm){t=MOUNT;so=HILL;}
    else if(m>qh){t=HILL;so=HILL;}
    else if(el<.03&&T>.2){t=SAND;so=SAND;}
    else if(T<.2){if(M>.55){t=PINE;so=TUNDRA;}else{t=TUNDRA;so=TUNDRA;}}
    else if(T<.36){if(M>.5){t=PINE;so=GRASS;}else{t=GRASS;so=GRASS;}}
    else if(T<.68){
      if(M>.76&&el<.14){t=SWAMP;so=SWAMP;}
      else if(M>.52){t=FOREST;so=GRASS;}
      else{t=GRASS;so=GRASS;}
    }else if(M<.34){t=DESERT;so=DESERT;}
    else if(M<.54){t=SAVANNA;so=SAVANNA;}
    else{t=JUNGLE;so=GRASS;}
    tile[i]=t;soil[i]=so;
    /* heights fall into bands - lowland, hills, mountains, peaks - so terraforming can read them back */
    let e;
    if(t===SNOW&&m>qn)e=218+Math.min(1,(m-qn)/(qn*.25+1e-6))*36;
    else if(t===MOUNT||t===SNOW)e=188+Math.min(1,(m-qm)/(qn-qm+1e-6))*29;
    else if(t===HILL)e=158+Math.min(1,(m-qh)/(qm-qh+1e-6))*29;
    else e=100+Math.max(0,Math.min(1,m/(qh+1e-6)))*57;
    elev[i]=Math.round(e);
  }
  if(opt.land==='flat'||opt.land==='ocean'){blankWorld(opt.land,rnd);computeRegions();recolorAll();seedLife(rnd,opt);return;}
  /* rivers run downhill from the highlands to the sea */
  const srcs=[];
  for(let i=0;i<N;i++)if(tile[i]===HILL||tile[i]===MOUNT)srcs.push(i);
  const nr=Math.min(srcs.length,Math.round(N/4600));
  prevA.fill(0);
  for(let r=1;r<=nr;r++){
    let i=srcs[(rnd()*srcs.length)|0],up=0;
    for(let st=0;st<700;st++){
      const t=tile[i];
      if(t<=WATER||(t===RIVER&&st>0))break;
      prevA[i]=r;
      if(t!==MOUNT&&t!==SNOW&&st>1)tile[i]=RIVER;
      const x=i%W,y=(i/W)|0;let best=-1,bh=1e9;
      for(let k=0;k<8;k+=2){
        const nx=x+DIRS[k][0],ny=y+DIRS[k][1];if(nx<0||ny<0||nx>=W||ny>=H)continue;
        const j=ny*W+nx;if(prevA[j]===r)continue;
        const hv=hgt[j]+mv[j]*.25+rnd()*.003;if(hv<bh){bh=hv;best=j;}
      }
      if(best<0)break;
      if(bh>hgt[i]+mv[i]*.25){
        if(++up>26){
          for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(inB(nx,ny)){const j=ny*W+nx;if(tile[j]!==MOUNT&&tile[j]!==SNOW){tile[j]=WATER;elev[j]=84;}}}
          break;
        }
      }
      i=best;
    }
  }
  computeRegions();recolorAll();
  seedLife(rnd,opt);
}
function seedLife(rnd,opt){
  const spots=[];startSpot=null;
  function spot(pref,minD,tries){
    let best=null,bs=0;
    for(let n=0;n<tries;n++){
      const x=2+((rnd()*(W-4))|0),y=2+((rnd()*(H-4))|0),p=pref(tile[y*W+x]);
      if(p<=bs)continue;
      let ok=true;
      for(const s of spots)if((s.x-x)*(s.x-x)+(s.y-y)*(s.y-y)<minD*minD){ok=false;break;}
      if(ok){bs=p;best={x,y};if(p>=1)break;}
    }
    if(best)spots.push(best);
    return best;
  }
  function band(type,n,s){
    if(!s)return;
    for(let k=0;k<n;k++){
      const x=s.x+((rnd()*5)|0)-2,y=s.y+((rnd()*5)|0)-2;
      if(walkable(x,y))spawn(type,x,y);
    }
  }
  if(opt.peoples!=='none'){
    const many=opt.peoples==='many';
    const tribes=Math.max(4,Math.round(N/(many?4200:8500)));
    const order=[HUMAN,ORC,ELF,DWARF,HUMAN,ELF,ORC,DWARF];
    for(let n=0;n<tribes;n++){
      const r=order[n%8],s=spot(t=>PREF[r][t],many?22:32,220);
      if(s){band(r,6,s);if(!startSpot)startSpot=s;}
    }
  }
  if(opt.wild){
    const herds=Math.round(N/2600),packs=Math.round(N/11000),bears=Math.round(N/14000);
    for(let n=0;n<herds;n++)band(SHEEP,5,spot(t=>t===GRASS?1:t===SAVANNA?.8:0,7,40));
    for(let n=0;n<packs;n++)band(WOLF,3,spot(t=>t===FOREST||t===PINE?1:t===TUNDRA?.6:0,12,40));
    for(let n=0;n<bears;n++)band(BEAR,1,spot(t=>t===FOREST||t===PINE||t===JUNGLE?1:0,12,40));
  }
}
