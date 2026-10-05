/* ================= GPU scene: what to draw each frame ================= */
function mkList(n,st){const b=new ArrayBuffer(n*st);return{b,f:new Float32Array(b),u:new Uint32Array(b),n:0,cap:n,st};}
const SPR={sh:mkList(4096,40),mn:mkList(16384,40),po:mkList(2048,40),sk:mkList(2048,40),li:mkList(2048,20)};
function growL(L){const nb=new ArrayBuffer(L.cap*2*L.st);new Uint8Array(nb).set(new Uint8Array(L.b));L.b=nb;L.f=new Float32Array(nb);L.u=new Uint32Array(nb);L.cap*=2;}
/* one sprite: frame, foot point, depth, team colour, tint, flags (1 flip, 4 airborne, 8 shadow, seed<<4), alpha, crop, scale */
function put(L,fr,x,y,dep,team,tint,flags,alpha,crop,scale){
  if(L.n>=L.cap)growL(L);
  const o=L.n*10,f=L.f;
  f[o]=x;f[o+1]=y;f[o+2]=fr;f[o+3]=dep;f[o+4]=alpha;f[o+5]=flags;f[o+6]=crop;f[o+7]=scale;
  L.u[o+8]=team||NEUTRAL_U;L.u[o+9]=tint||FOL_U;L.n++;
}
function light(x,y,r,a,col){
  const L=SPR.li;if(L.n>=L.cap)growL(L);
  const o=L.n*5;L.f[o]=x;L.f[o+1]=y;L.f[o+2]=r;L.f[o+3]=a;L.u[o+4]=col;L.n++;
}
const rgbU=(r,g,b)=>(r|g<<8|b<<16|255<<24)>>>0;
const NEUTRAL_U=rgbU(176,168,150);let FOL_U=rgbU(78,152,60);
const hexU=h=>{const c=hexRgb(h);return rgbU(c[0],c[1],c[2]);};
const WHITE=rgbU(255,255,255),LAMP=rgbU(255,186,104),FIREL=rgbU(255,128,40),LAVAL=rgbU(255,96,30),COOLL=rgbU(200,220,255);
const depthY=y=>.985-Math.max(0,Math.min(1,(y+4)/(H+12)))*.97;
function kU(k){return k.u32||(k.u32=rgbU(k.rgb[0],k.rgb[1],k.rgb[2]));}

/* atlas lookups by name, with graceful fallbacks while art is missing */
const fcache=new Map();
function FI(name){
  let v=fcache.get(name);if(v!==undefined)return v;
  const idx=G.atlas.idx;
  if(idx[name]!==undefined)v=idx[name];
  else{
    const p=name.split('_');
    for(let k=p.length-1;k>0&&v===undefined;k--)if(/^\d+$/.test(p[k])&&p[k]!=='0'){p[k]='0';const n=p.join('_');if(idx[n]!==undefined)v=idx[n];}
    if(v===undefined){const n=name.replace(/_[edo]_/,'_h_');if(idx[n]!==undefined)v=idx[n];}
    if(v===undefined)v=idx.box!==undefined?idx.box:0;
  }
  fcache.set(name,v);return v;
}
const RACE_L=['h','e','d','o'];

/* seasons: colour of leaves per tree family, blended through the year */
const FOL={
  oak:[[120,190,80],[78,152,60],[214,140,46],[150,120,80]],
  pine:[[60,122,80],[50,112,74],[52,108,72],[48,96,70]],
  jungle:[[52,150,70],[44,138,62],[70,140,56],[56,128,64]],
  acacia:[[150,170,70],[128,150,58],[176,150,60],[140,128,80]],
  bush:[[110,180,70],[80,150,58],[190,120,50],[130,120,80]]
};
const AUT=[[214,140,46],[200,82,42],[226,180,60],[188,110,40]];
let seasonP=.4,seasonAmp=1,wintF=0;
function folTint(fam,var_){
  const s=((seasonP-.125+1)%1)*4,a=s|0,f=s-a,b=(a+1)&3,P=FOL[fam];
  let ca=P[a],cb=P[b];
  if(fam==='oak'||fam==='bush'){const au=AUT[var_&3];if(a===2)ca=au;if(b===2)cb=au;}
  const su=P[1],m=seasonAmp;
  return rgbU(su[0]+((ca[0]+(cb[0]-ca[0])*f)-su[0])*m|0,su[1]+((ca[1]+(cb[1]-ca[1])*f)-su[1])*m|0,su[2]+((ca[2]+(cb[2]-ca[2])*f)-su[2])*m|0);
}
function snowAt(i){
  const cold=temp[i]/255*1.5-.25-Math.max(0,elev[i]-100)/155*.5;
  return cold<.04+.3*wintF;
}

function sceneNature(x0,y0,x1,y1,zc,night){
  if(zc<2.6)return;
  const al=Math.min(1,(zc-2.6)/1.6),L=SPR.mn;
  const tO=[folTint('oak',0),folTint('oak',1),folTint('oak',2),folTint('oak',3)],tP=folTint('pine',0),tJ=folTint('jungle',0),tA=folTint('acacia',0),tB=folTint('bush',0);
  const lights=night&&zc>=3;
  for(let y=Math.max(0,y0);y<Math.min(H,y1);y++){
    for(let x=Math.max(0,x0);x<Math.min(W,x1);x++){
      const i=y*W+x,t=tile[i];
      if(t===LAVA){if(lights)light(x+.5,y+.5,1.7,.75,LAVAL);continue;}
      if(!DECO[t]||bmap[i]||road[i]||fire[i])continue;
      const h=hsh(x,y),h2=hsh(y+7,x+13),jx=(h2-.5)*.36,dy=y+.88+(h-.5)*.12;
      switch(t){
        case FOREST:{
          const bare=wintF>.3+h*.5;
          if(h>.55)put(L,FI(bare?'oakbare_'+((h2*2)|0):'oak_'+((h2*3)|0)),x+.25+jx*.5,y+.45,depthY(y+.45),0,tO[(h2*4)|0],0,al,1,.85);
          put(L,FI(bare?'oakbare_'+((h*2)|0):'oak_'+((h*3)|0)),x+.5+jx,dy,depthY(dy),0,tO[(h*4)|0],h>.5?1:0,al,1,.95+h2*.15);
          break;
        }
        case PINE:{
          const sn=snowAt(i);
          if(h>.5)put(L,FI((sn?'pinesnow_':'pine_')+((h2*2)|0)),x+.2+jx*.5,y+.5,depthY(y+.5),0,tP,0,al,1,.8);
          put(L,FI((sn?'pinesnow_':'pine_')+((h*3)|0)),x+.55+jx,dy,depthY(dy),0,tP,h2>.5?1:0,al,1,.95+h2*.15);
          break;
        }
        case JUNGLE:
          if(h>.45)put(L,FI('palm_'+((h2*2)|0)),x+.2+jx*.5,y+.5,depthY(y+.5),0,tJ,h>.7?1:0,al,1,.85);
          put(L,FI(h<.5?'jungle_'+((h2*2)|0):'palm_'+((h2*2)|0)),x+.55+jx,dy,depthY(dy),0,tJ,h2>.5?1:0,al,1,1);
          break;
        case SAVANNA:if(h<.07)put(L,FI('acacia_0'),x+.5+jx,dy,depthY(dy),0,tA,h2>.5?1:0,al,1,1);else if(h>.97)put(L,FI('bush_'+((h2*2)|0)),x+.5,dy,depthY(dy),0,tA,0,al,1,.8);break;
        case DESERT:if(h>.975)put(L,FI('cactus_'+((h2*2)|0)),x+.5+jx,dy,depthY(dy),0,0,0,al,1,1);break;
        case GRASS:
          if(h<.022)put(L,FI('bush_'+((h2*2)|0)),x+.5+jx,dy,depthY(dy),0,tB,0,al,1,1);
          else if(h>.988&&wintF<.4)put(L,FI('flowers_'+((h2*2)|0)),x+.5+jx,dy,depthY(dy),0,0,0,al,1,1);
          break;
        case HILL:if(h<.045)put(L,FI('rock_'+((h2*3)|0)),x+.5+jx,dy,depthY(dy),0,0,0,al,1,1);break;
        case TUNDRA:if(h>.965)put(L,FI('rock_'+((h2*3)|0)),x+.5+jx,dy,depthY(dy),0,0,0,al,1,1);else if(h<.03)put(L,FI(snowAt(i)?'pinesnow_0':'pine_0'),x+.5+jx,dy,depthY(dy),0,tP,0,al,1,.75);break;
        case SWAMP:if(h<.18)put(L,FI('reeds_0'),x+.5+jx,dy,depthY(dy),0,0,h2>.5?1:0,al,1,1);break;
        case ASH:if(h<.22)put(L,FI('stump_0'),x+.5+jx,dy,depthY(dy),0,0,0,al,1,1);break;
        case MOUNT:put(L,FI('peak_'+((h*3)|0)),x+.5+jx*.5,y+.95,depthY(y+.95),0,0,h2>.6?1:0,al,1,1+h2*.12);break;
        case SNOW:put(L,FI('snowpeak_'+((h*3)|0)),x+.5+jx*.5,y+.95,depthY(y+.95),0,0,h2>.6?1:0,al,1,1+h2*.12);break;
      }
    }
  }
}

/* ---------- buildings ---------- */
function bldFrame(b,v,k){
  const r=RACE_L[v.race]||'h',t=TIER[k.age]||0,vv=(b.x*7+b.y*13)&1;
  switch(b.kind){
    case'house':{
      if(t>=3){const dd=Math.hypot(b.x-v.x,b.y-v.y);if(dd<v.rad*.62)return FI('tall_'+r+'_'+t+'_'+((b.x*5+b.y*3)%3));}
      return FI('house_'+r+'_'+t+'_'+vv);
    }
    case'hall':return FI('hall_'+r+'_'+t);
    case'temple':return FI('temple_'+r+'_'+t);
    case'tower':return FI('tower_'+t);
    case'barracks':return FI('barracks_'+t);
    case'market':return FI('market_'+t);
    case'academy':return FI('academy_'+Math.max(1,t));
    case'mine':return FI('mine_'+t);
    case'dock':return FI('dockhut_'+t);
    case'farm':return b.grove?FI('grove'):-1;
    case'wall':{
      const wt=Math.max(1,Math.min(3,t)),h=(j)=>{const o=bmap[j];return o&&(o.kind==='wall'||o.kind==='tower')&&o.v.k===k;};
      return FI((h(b.i-1)||h(b.i+1)||!(h(b.i-W)||h(b.i+W))?'wall_':'wallv_')+wt);
    }
    case'windmill':return FI((t>=4?'turbine_':'windmill_')+(((now()/(t>=4?160:260))|0)+b.x)%3);
    case'factory':return FI('factory_'+Math.max(3,t));
    case'lighthouse':return FI('lighthouse_'+Math.max(1,t));
    case'arena':return FI(t>=3?'arena_4':'arena_1');
    case'launchpad':return FI('launchpad');
    case'wonder':return FI('wonder_'+b.wid);
    default:return FI(b.kind+'_'+t);
  }
}
const LRAD={hall:3.4,house:1.9,temple:2.6,tower:2.2,barracks:2.2,market:2.4,academy:2.4,mine:1.6,dock:1.8,wall:0,windmill:1.4,factory:3,lighthouse:2.4,arena:4,launchpad:4,wonder:5};
/* chimney smoke: a few puffs on a loop, drawn from time alone */
function smokePlume(x,y,seed,tsec,big,n){
  for(let m=0;m<n;m++){
    const p=(tsec*(big?.32:.45)+m/n+seed*.137)%1;
    put(SPR.mn,FI('smoke_'+(p<.3?0:p<.65?1:2)),x+Math.sin(p*5+seed)*.25+p*.6,y-p*(big?3.2:2),.007,0,0,4,(1-p)*(big?.55:.4),1,(big?1.1:.7)+p*.8);
  }
}
function sceneBuildings(x0,y0,x1,y1,zc,night,tsec){
  if(zc<1.6)return;
  const L=SPR.mn,S2=SPR.sh;
  for(let n=1;n<vById.length;n++){
    const v=vById[n];if(!v.alive)continue;
    const m=v.rad+6;if(v.x+m<x0||v.x-m>x1||v.y+m<y0||v.y-m>y1)continue;
    const k=v.k,team=kU(k);
    for(const b of v.blds){
      if(b.x<x0-2||b.x>x1+2||b.y<y0-2||b.y>y1+4)continue;
      const fy=b.y+.95,crop=b.prog===undefined?1:Math.max(.08,b.prog);
      if(b.kind==='farm'){
        if(b.grove)put(L,FI('grove'),b.x+.5,b.y+.8,depthY(b.y+.8),team,folTint('oak',0),0,1,1,1);
        else if(((b.x*31+b.y*17)%9)===0)put(L,FI(((b.x+b.y)&1)?'haystack':'scarecrow'),b.x+.5,b.y+.75,depthY(b.y+.75),team,0,0,1,1,1);
        continue;
      }
      if(b.kind==='dock'){
        const wx=(b.wi%W)-b.x,wy=((b.wi/W)|0)-b.y;
        if(wx)put(L,FI('pierh'),b.x+.5,b.y+.6,depthY(b.y+.2),team,0,wx<0?1:0,1,1,1);
        else put(L,FI('pierv'),b.x+.5,wy>0?b.y+.5:b.y-.9,depthY(b.y+(wy>0?1.4:.3)),team,0,0,1,1,1);
      }
      const fr=bldFrame(b,v,k);if(fr<0)continue;
      const seed=((b.x*73+b.y*151)&4095)<<4,big=b.big===2,bx=b.x+(big?1:.5),by=big?b.y+1.95:fy;
      put(L,fr,bx,by,depthY(by),team,0,seed,1,crop,1);
      if(crop<1)put(L,FI(big?'scaffold2':'scaffold'),bx,by,depthY(by)-.0005,team,0,0,1,1,1);
      if(b.solid&&zc>=3&&b.kind!=='wall')put(S2,FI(big?'shadowbig':'shadow'),bx-sunX*.25,by-.05-sunY*.12,0,0,0,8,.22*dayLight,1,b.kind==='hall'?1.9:1.1);
      const lr=LRAD[b.kind];
      if(night&&b.solid&&crop>=1&&lr!==0)light(bx,by-.6,lr||2,.58,LAMP);
      if(crop>=1&&zc>=2.5){
        if(b.kind==='factory')smokePlume(bx+.1,by-1.9,b.x+b.y,tsec,true,5);
        else if(b.kind==='house'&&(TIER[k.age]||0)===3&&((b.x*3+b.y)&3)===0)smokePlume(bx+.2,by-1.4,b.x*7+b.y,tsec,false,3);
        else if(b.kind==='hall'&&(TIER[k.age]||0)===0)smokePlume(bx-.3,by-1.2,b.x,tsec,false,3);
        else if(b.kind==='launchpad'&&!b.v.k.flying)put(L,FI('rocket'),bx+.05,by-.35,depthY(by)-.001,team,0,0,1,1,1);
      }
      if(night&&b.kind==='lighthouse'&&crop>=1){
        const a=tsec*1.4,dx=Math.cos(a),dy=Math.sin(a)*.6;
        for(let m=1;m<=4;m++)light(bx+dx*m*1.6,by-1.4+dy*m*1.6,.9+m*.35,.55-m*.08,COOLL);
      }
      if(fire[b.i]){
        put(SPR.po,FI('flame_'+((frameNo>>2)+b.x)%4),b.x+.5,b.y+.6,depthY(b.y+.98),0,0,0,1,1,1.3);
        if(night)light(b.x+.5,b.y+.4,2.4,.9,FIREL);
      }
    }
  }
}

/* ---------- people, beasts, boats ---------- */
function sceneUnits(x0,y0,x1,y1,zc,lerp,tsec,night){
  if(zc<1.1)return;
  const L=SPR.mn,S2=SPR.sh,small=zc<3,shad=zc>=4;
  for(let n=0;n<units.length;n++){
    const u=units[n];
    if(u.x<x0||u.x>x1||u.y<y0||u.y>y1)continue;
    let px=u.px===undefined?u.x:u.px,py=u.py===undefined?u.y:u.py;
    if(Math.abs(px-u.x)>1.5||Math.abs(py-u.y)>1.5){px=u.x;py=u.y;}
    const rx=px+(u.x-px)*lerp+.5+u.ox,ry=py+(u.y-py)*lerp+.5+u.oy+.3;
    const moving=u.x!==px||u.y!==py,ph=moving?1+(((tsec*7)|0)+u.id)%2:0,t=u.t,fl=u.dir<0?1:0;
    let fr,team=0,sc=1;
    if(t<=ORC){
      const k=u.k;team=k?kU(k):PLAIN_U[t];
      const kid=u.age<SPEC[t].adult;sc=kid?.7:1;
      if(u.soldier&&k){const ti=TIER[k.age]||0;fr=FI(RACE_L[t]+'_sol'+ti+'_'+(u.cd>1&&u.foe?3:ph));}
      else fr=FI(RACE_L[t]+'_civ_'+ph);
    }else if(t===DRAGON){
      const f=((tsec*6)|0)%3;
      put(L,FI('dragon_'+f),rx,ry-1.6,.004,0,0,fl|4,1,1,1.4);
      put(S2,FI('shadowbig'),rx,ry+.2,0,0,0,8,.2,1,1);
      continue;
    }else if(t===SIEGE&&u.k){
      const a=u.k.age;team=kU(u.k);
      fr=FI('siege_'+(a>=7?4:a>=5?3:a>=4?2:1));
    }else if(t===CARAVAN&&u.k){
      const ti=TIER[u.k.age]||0,onRoad=road[u.y*W+u.x]!==0;team=kU(u.k);
      if(ti===3&&onRoad){
        fr=FI('train_3');
        const tr=u.trail;
        if(tr&&zc>=2.5)for(let m=0;m<2&&m<tr.length;m++){const c=tr[m];put(L,FI('traincar_3'),c.x+.5,c.y+.85,depthY(c.y+.85),team,0,fl,1,1,1);}
      }else fr=FI(ti>=4?'truck_4':'cart_'+Math.min(2,ti));
    }else{
      const nm=t===SHEEP?'sheep_':t===WOLF?'wolf_':t===BEAR?'bear_':t===ZOMBIE?'zombie_':'box_';
      fr=FI(nm+(moving?(((tsec*6)|0)+u.id)%(t===ZOMBIE?3:2):0));
    }
    if(small)sc*=Math.min(2.4,2.6/Math.max(.5,zc*.6));
    put(L,fr,rx,ry,depthY(ry),team,0,fl,1,1,sc);
    if(shad)put(S2,FI('shadow'),rx,ry,0,0,0,8,.2*dayLight,1,.42*sc);
    if(u.sick&&zc>=4)put(SPR.po,FI('spark'),rx,ry-.9,0,rgbU(126,224,74),0,0,1,1,.8);
  }
  for(const b of boats){
    if(b.x<x0-1||b.x>x1+1||b.y<y0-1||b.y>y1+1)continue;
    let px=b.px===undefined?b.x:b.px,py=b.py===undefined?b.y:b.py;
    const rx=px+(b.x-px)*lerp+.5,ry=py+(b.y-py)*lerp+.6+Math.sin(tsec*2+b.x)*.03;
    put(L,FI('boat_'+(TIER[b.k.age]||0)),rx,ry,depthY(ry),kU(b.k),0,b.dir<0?1:0,1,1,1);
    if(night)light(rx,ry-.3,1.4,.4,LAMP);
  }
  for(const p of planes){
    const rx=p.px+(p.x-p.px)*lerp+.5,ry=p.py+(p.y-p.py)*lerp+.5;
    if(rx<x0-4||rx>x1+4||ry<y0-4||ry>y1+6)continue;
    put(SPR.sk,FI('plane_'+((tsec*12|0)&1)),rx,ry-2.6,.001,kU(p.k),0,(p.dir<0?1:0)|4,1,1,1.2);
    put(S2,FI('shadow'),rx,ry+.3,0,0,0,8,.18,1,.9);
  }
  /* fishing boats bob about every harbour */
  if(zc>=2.5)for(let n=1;n<vById.length;n++){
    const v=vById[n];if(!v.alive||!v.dock)continue;
    const d=v.dock,wx=d.wi%W,wy=(d.wi/W)|0;if(wx<x0||wx>x1||wy<y0||wy>y1)continue;
    const a=tsec*.18+n,ox=Math.cos(a)*1.3,oy=Math.sin(a*1.3)*.9,tx=Math.round(wx+ox),ty=Math.round(wy+oy);
    const ok=inB(tx,ty)&&tile[ty*W+tx]<=WATER;
    const fx2=ok?wx+ox:wx,fy2=ok?wy+oy:wy;
    put(L,FI('fishboat'),fx2+.5,fy2+.65+Math.sin(tsec*2.2+n)*.04,depthY(fy2+.65),kU(v.k),0,Math.sin(a)>0?1:0,1,1,1);
  }
  for(const tw of twisters){
    if(tw.x<x0-3||tw.x>x1+3||tw.y<y0-3||tw.y>y1+8)continue;
    for(let n=0;n<9;n++){
      const a=tsec*5+n*.8,r=.15+n*.09;
      put(L,FI('smoke_'+Math.min(2,(n/3)|0)),tw.x+.5+Math.sin(a)*r*1.5,tw.y+.8-n*.55,depthY(tw.y+1)-.001*n,0,0,0,.85,1,.8+n*.18);
    }
  }
}

/* ---------- effects ---------- */
function sceneEffects(x0,y0,x1,y1,night){
  const P=SPR.po,L=SPR.mn;
  for(const e of effects){
    if(e.x<x0-6||e.x>x1+6||e.y<y0-6||e.y>y1+6)continue;
    switch(e.k){
      case'boom':{const p=1-e.t/e.T;put(P,FI('boom_'+Math.min(4,(p*5)|0)),e.x+.5,e.y+.5,.003,0,0,0,1,1,Math.max(.6,e.r*1.25));
        light(e.x+.5,e.y+.5,e.r*2.6,1.2*(1-p),FIREL);break;}
      case'smoke':put(L,FI('smoke_'+(e.t>26?0:e.t>12?1:2)),e.x+.5+Math.sin(e.t*.3)*.3,e.y-(40-e.t)*.08-.2,.006,0,0,4,e.t/40*.7,1,1);break;
      case'spark':put(P,FI('spark'),e.x+.5+(Math.random()-.5)*.6,e.y+.2+(Math.random()-.5)*.6,.003,0,0,0,1,1,1);break;
      case'arrow':{const p=1-e.t/e.T,ax=e.x+(e.x2-e.x)*p+.5,ay=e.y+(e.y2-e.y)*p+.3-Math.sin(p*3.14)*.8;
        put(P,FI(e.gun?'bullet':'arrow'),ax,ay,.003,0,0,e.x2<e.x?1:0,1,1,1);break;}
      case'rain':put(P,FI('raindrop'),e.x,e.y-e.t*.5,.003,0,0,0,.9,1,1);break;
      case'shot':{const p=1-e.t/e.T,ax=e.x+(e.x2-e.x)*p+.5,ay=e.y+(e.y2-e.y)*p+.3-Math.sin(p*3.14)*1.6;
        put(P,FI(e.s),ax,ay,.003,0,0,0,1,1,1);break;}
      case'rocket':{
        const p=1-e.t/e.T,lift=p<.12?0:Math.pow((p-.12)/.88,2.2)*70,rx=e.x+.05,ry=e.y+.6-lift;
        put(SPR.sk,FI('rocket'),rx,ry-.95,.0015,e.team?kU(e.team):WHITE,0,4,1,1,e.colony?1.5:1);
        if(p>.04)put(SPR.sk,FI('exhaust_'+((frameNo>>1)%3)),rx,ry-.95,.0016,0,0,4,1,1,(e.colony?1.5:1)*(p<.12?.6+p*3:1.2));
        for(let m=0;m<10;m++){const q=(m/10+frameNo*.004)%1,sy=ry-.2+q*Math.min(lift,14)*.9;if(lift>.3||m<3)put(L,FI('smoke_'+(q<.3?0:q<.6?1:2)),rx+Math.sin(m*1.7+q*4)*(.2+q*1.4),sy,.006,0,0,4,(1-q)*.55,1,.8+q*2.2);}
        light(rx,ry,3+(e.colony?2:0),1.1,FIREL);
        if(p<.2&&!reduceMotion)shake=Math.max(shake,2);
        break;
      }
    }
  }
}

function sceneCollect(R,cx,cy,z,lerp,tsec){
  for(const k in SPR)SPR[k].n=0;
  if(R.noSprites)return;
  const zc=cam.z,x0=Math.floor(cx)-2,y0=Math.floor(cy)-2,x1=Math.ceil(cx+cv.width/z)+2,y1=Math.ceil(cy+cv.height/z)+4;
  const night=nightF>.02;
  sceneNature(x0,y0,x1,y1,zc,night);
  sceneBuildings(x0,y0,x1,y1,zc,night,tsec);
  sceneUnits(x0,y0,x1,y1,zc,lerp,tsec,night);
  sceneEffects(x0,y0,x1,y1,night);
  sceneAmbient(x0,y0,x1,y1,zc,tsec,night);
  if(night&&zc>=1.6){
    for(let n=0;n<fireList.length;n++){
      const i=fireList[n],fx2=i%W,fy=(i/W)|0;
      if(fire[i]&&fx2>=x0&&fx2<=x1&&fy>=y0&&fy<=y1&&!bmap[i])light(fx2+.5,fy+.5,2,.7+Math.random()*.2,FIREL);
    }
  }
  if(zc>=2.5){
    for(let n=0;n<fireList.length;n++){
      const i=fireList[n],fx2=i%W,fy=(i/W)|0;
      if(fire[i]&&!bmap[i]&&fx2>=x0&&fx2<=x1&&fy>=y0&&fy<=y1)put(SPR.po,FI('flame_'+((frameNo>>2)+fx2+fy)%4),fx2+.5,fy+.85,depthY(fy+.85),0,0,0,1,1,1);
    }
  }
}

/* ---------- the frame ---------- */
const FW_COL=['#ff6b6b','#ffd93d','#6bcBff','#c38bff','#7dffb0','#ffffff','#ff9f43'];
const PLAIN_U=[rgbU(210,201,180),rgbU(159,198,154),rgbU(163,154,140),rgbU(93,74,54)];
function glFrame(R,dt,running,lerp){
  const gl=R.gl;frameNo++;
  if(R.lost)return;
  if(!R.dT||R.W!==W)R.setWorld();
  R.flush();
  const cw=cv.width,ch=cv.height,z=cam.z*gdpr,tsec=now()/1000;
  let cx=cam.x,cy=cam.y;
  if(shake>0){cx+=(Math.random()-.5)*shake/cam.z*.5;cy+=(Math.random()-.5)*shake/cam.z*.5;shake*=.88;if(shake<.4)shake=0;}
  seasonP=((tick%YEAR)+Math.max(0,Math.min(1,lerp)))/YEAR;
  const sTarget=S.seasons?(speed<=1?1:speed<=3?.75:speed<=8?.3:0):0;
  seasonAmp+=(sTarget-seasonAmp)*Math.min(1,dt/900);
  wintF=Math.max(0,Math.min(1,Math.cos((seasonP-.875)*6.2832)*1.5-.3))*seasonAmp;
  FOL_U=folTint('bush',2);
  const tc0=now();
  sceneCollect(R,cx,cy,z,Math.max(0,Math.min(1,lerp)),tsec);
  R.tScene=R.tScene*.9+(now()-tc0)*.1;R.nSpr=SPR.mn.n+SPR.sh.n+SPR.po.n;

  const wind=[tsec*.0035,tsec*.0011];
  const stv=new Float32Array(24);let nst=0;
  for(const s of storms){if(nst>=6)break;stv.set([s.x,s.y,s.r,stormAmt(s)],nst*4);nst++;}
  const setSt=u=>{gl.uniform1i(u.uNSt,nst);if(nst)gl.uniform4fv(u.uSt,stv);};
  gl.viewport(0,0,cw,ch);
  gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.depthMask(true);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
  /* terrain */
  const pT=R.pT,uT=pT.u;gl.useProgram(pT.p);
  const bindT=(unit,t,loc)=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);if(loc)gl.uniform1i(loc,unit);};
  bindT(0,R.tTerr,uT.uTerr);bindT(1,R.tSm,uT.uSm);bindT(2,R.tOwn,uT.uOwn);bindT(3,R.tKPal,uT.uKPal);bindT(4,R.tBio,uT.uBio);bindT(5,R.tNz,uT.uNz);
  gl.uniform2f(uT.uRes,cw,ch);gl.uniform2f(uT.uCam,cx,cy);gl.uniform2f(uT.uWorld,W,H);gl.uniform2f(uT.uSun,sunX,sunY);gl.uniform2f(uT.uWind,wind[0],wind[1]);
  gl.uniform1f(uT.uZoom,z);gl.uniform1f(uT.uTime,tsec%3600);gl.uniform1f(uT.uSeas,seasonP);gl.uniform1f(uT.uSAmp,seasonAmp);
  gl.uniform1f(uT.uBord,S.borders?1:0);gl.uniform1f(uT.uCloud,S.clouds?1:0);gl.uniform1f(uT.uDay,dayLight);gl.uniform1f(uT.uDet,S.detail?1:.35);gl.uniform1f(uT.uSL,SL);gl.uniform1f(uT.uTreeA,Math.max(0,Math.min(1,(cam.z-2.6)/1.6)));
  setSt(uT);
  gl.bindVertexArray(R.vaoFull);gl.drawArrays(gl.TRIANGLES,0,3);

  /* sprites */
  const pS=R.pS,uS=pS.u;gl.useProgram(pS.p);
  bindT(6,R.tAtl,uS.uAtl);bindT(7,R.tFr,uS.uFr);bindT(5,R.tNz,uS.uNz);
  gl.uniform2f(uS.uRes,cw,ch);gl.uniform2f(uS.uCam,cx,cy);gl.uniform2f(uS.uAt,R.atlas.w,R.atlas.h);gl.uniform1f(uS.uZoom,z);
  gl.uniform1f(uS.uNight,nightF);gl.uniform1f(uS.uDay,dayLight);gl.uniform1f(uS.uCloud,S.clouds?1:0);gl.uniform2f(uS.uWind,wind[0],wind[1]);gl.uniform2f(uS.uSun,sunX,sunY);setSt(uS);
  const draw=(L,V,mode)=>{
    if(!L.n)return;
    gl.uniform1i(uS.uMode,mode);
    gl.bindBuffer(gl.ARRAY_BUFFER,V.buf);gl.bufferData(gl.ARRAY_BUFFER,L.f.subarray(0,L.n*10),gl.STREAM_DRAW);
    gl.bindVertexArray(V.vao);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,L.n);
  };
  gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  draw(SPR.sh,R.vShadow,0);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
  draw(SPR.mn,R.vMain,0);

  /* night: light map, then darken everything except what is lit */
  if(nightF>.01){
    const lw=Math.max(1,cw>>1),lh=Math.max(1,ch>>1);
    R.ensureLight(lw,lh);
    gl.bindFramebuffer(gl.FRAMEBUFFER,R.fbo);gl.viewport(0,0,lw,lh);
    gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
    if(SPR.li.n){
      const pL=R.pL,uL=pL.u;gl.useProgram(pL.p);
      gl.uniform2f(uL.uRes,cw,ch);gl.uniform2f(uL.uCam,cx,cy);gl.uniform1f(uL.uZoom,z);
      gl.bindBuffer(gl.ARRAY_BUFFER,R.vLight.buf);gl.bufferData(gl.ARRAY_BUFFER,SPR.li.f.subarray(0,SPR.li.n*5),gl.STREAM_DRAW);
      gl.bindVertexArray(R.vLight.vao);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,SPR.li.n);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cw,ch);
    const dusk=Math.sin(Math.min(1,nightF)*Math.PI);
    const amb=[1-nightF*.79+dusk*.06,1-nightF*.74-dusk*.1,1-nightF*.52-dusk*.2];
    const pD=R.pD,uD=pD.u;gl.useProgram(pD.p);
    bindT(8,R.tLight,uD.uLight);gl.uniform3f(uD.uAmb,amb[0],amb[1],amb[2]);gl.uniform2f(uD.uRes,cw,ch);
    gl.blendFunc(gl.DST_COLOR,gl.ZERO);
    gl.bindVertexArray(R.vaoFull);gl.drawArrays(gl.TRIANGLES,0,3);
    R.amb=amb;
    /* lit windows and lamps */
    gl.useProgram(pS.p);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.blendFunc(gl.ONE,gl.ONE);
    gl.uniform1f(uS.uNight,Math.min(1,nightF*1.3));
    draw(SPR.mn,R.vMain,1);
  }else R.amb=[1,1,1];
  /* fire, explosions and sparks stay bright */
  gl.useProgram(pS.p);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  draw(SPR.po,R.vPost,2);
  gl.disable(gl.DEPTH_TEST);gl.depthMask(true);
  /* clouds high above */
  if(S.clouds||nst){
    const fade=Math.max(0,Math.min(1,1-(cam.z-3)/5));
    if(fade>0||nst){
      const pC=R.pC,uC=pC.u;gl.useProgram(pC.p);
      bindT(5,R.tNz,uC.uNz);gl.uniform2f(uC.uRes,cw,ch);gl.uniform2f(uC.uCam,cx,cy);gl.uniform2f(uC.uWind,wind[0],wind[1]);
      gl.uniform1f(uC.uZoom,z);gl.uniform1f(uC.uFade,S.clouds?fade:0);setSt(uC);const a=R.amb;gl.uniform3f(uC.uAmb,Math.min(1,a[0]+.08),Math.min(1,a[1]+.08),Math.min(1,a[2]+.1));
      gl.bindVertexArray(R.vaoFull);gl.drawArrays(gl.TRIANGLES,0,3);
    }
  }
  if(SPR.sk.n){gl.useProgram(pS.p);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);draw(SPR.sk,R.vSky,2);}
  gl.bindVertexArray(null);
  glOverlay(cx,cy);
}

/* the 2D layer on top: names, speech, lightning, rings */
function glOverlay(cx,cy){
  const z=cam.z*dpr,ox=-cx*z,oy=-cy*z;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ovc.width,ovc.height);
  const x0=cx-3,y0=cy-3,x1=cx+vw/cam.z+3,y1=cy+vh/cam.z+3;
  for(const e of effects){
    const px=ox+(e.x+.5)*z,py=oy+(e.y+.5)*z;
    if(e.k==='bolt'){
      const r=mulberry(e.seed);
      ctx.strokeStyle=e.t>5?'#ffffff':'#ffe66b';ctx.lineWidth=Math.max(2*dpr,z*.18);ctx.lineCap='round';
      ctx.beginPath();let x=px,y=py;ctx.moveTo(x,y);
      while(y>0){y-=z*2+r()*z*2+8;x+=(r()-.5)*z*4;ctx.lineTo(x,y);}
      ctx.stroke();
      if(e.t>7&&!reduceMotion){ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect(0,0,ovc.width,ovc.height);}
    }else if(e.k==='ring'){
      const p=1-e.t/e.T;ctx.globalAlpha=Math.max(0,1-p);ctx.strokeStyle='#ffe98a';ctx.lineWidth=Math.max(2,z*.25);
      ctx.beginPath();ctx.arc(px,py,e.r*z*(.2+.8*p),0,6.283);ctx.stroke();ctx.globalAlpha=1;
    }else if(e.k==='fireworks'){
      const el=e.T-e.t,r=mulberry(e.x*977+e.y*31);
      if(el%11===1)snd('firework',e.x,e.y,.6);
      ctx.globalCompositeOperation='lighter';
      for(let b=0;b*11<=el;b++){
        const bx=e.x+(r()-.5)*12,by=e.y-3-r()*7,col=FW_COL[(r()*FW_COL.length)|0],age=el-b*11;
        if(age>34)continue;
        const cx2=ox+(bx+.5)*z,cy2=oy+(by+.5)*z,rad=Math.sqrt(age/34)*z*2.4,a=1-age/34,sz=Math.max(2,z*.16);
        ctx.fillStyle=col;ctx.globalAlpha=a;
        for(let m=0;m<14;m++){const an=m/14*6.283;ctx.fillRect(cx2+Math.cos(an)*rad-sz/2,cy2+Math.sin(an)*rad+age*age*.002*z-sz/2,sz,sz);}
      }
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    }else if(e.k==='meteor'){
      const p=e.t/28,mx=px+p*z*16,my=py-p*z*26;
      const g=ctx.createLinearGradient(mx+z*6,my-z*10,mx,my);g.addColorStop(0,'rgba(255,120,40,0)');g.addColorStop(1,'rgba(255,200,90,.9)');
      ctx.strokeStyle=g;ctx.lineWidth=Math.max(3,z*.9);ctx.beginPath();ctx.moveTo(mx+z*6,my-z*10);ctx.lineTo(mx,my);ctx.stroke();
      ctx.fillStyle='#ffcf5a';ctx.beginPath();ctx.arc(mx,my,Math.max(3,z*1.1),0,6.283);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(mx,my,Math.max(1.5,z*.5),0,6.283);ctx.fill();
    }
  }
  drawNames(ox,oy,z,x0,y0,x1,y1);
  drawCursor(ox,oy,z);
  if(S.minimap&&frameNo%30===0)drawMiniGL();
}
function drawMiniGL(){
  const mw=mini.width,mh=mini.height;if(!mw||!mh)return;
  const im=mctx.createImageData(mw,mh),d=im.data;
  for(let py=0;py<mh;py++){
    const ty=Math.min(H-1,(py+.5)/mh*H|0);
    for(let px=0;px<mw;px++){
      const tx=Math.min(W-1,(px+.5)/mw*W|0),i=ty*W+tx,t=tile[i],o=(py*mw+px)*4;
      let c=MINI_COL[t];
      let r=c[0],g=c[1],b=c[2];
      if(t<=WATER){const dp=(100-elev[i])*.5;r-=dp*.3;g-=dp*.45;b-=dp*.35;}
      const vid=vown[i];
      if(vid&&S.borders){const v=vById[vid];if(v&&v.alive){const kc=v.k.rgb;r+=(kc[0]-r)*.4;g+=(kc[1]-g)*.4;b+=(kc[2]-b)*.4;}}
      d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=255;
    }
  }
  mctx.putImageData(im,0,0);
  for(const k of kingdoms){
    if(!k.alive||!k.villages.length)continue;const c=k.villages[0],s=3*dpr;
    mctx.fillStyle='#0b1828';mctx.fillRect((c.x/W*mw-s/2-dpr)|0,(c.y/H*mh-s/2-dpr)|0,s+2*dpr,s+2*dpr);
    mctx.fillStyle=k.color;mctx.fillRect((c.x/W*mw-s/2)|0,(c.y/H*mh-s/2)|0,s,s);
  }
  mctx.strokeStyle='#fff';mctx.lineWidth=Math.max(1,dpr);
  mctx.strokeRect(Math.round(cam.x/W*mw)+.5,Math.round(cam.y/H*mh)+.5,Math.max(3,vw/cam.z/W*mw),Math.max(3,vh/cam.z/H*mh));
}
