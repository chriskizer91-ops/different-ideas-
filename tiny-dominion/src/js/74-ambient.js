/* ================= ambient life and weather particles (purely visual) ================= */
const flocks=[],jumps=[],whales=[];let ambLast=0;
const h1=n=>{let h=Math.imul(n|0,2654435761)^0x9e3779b9;h=Math.imul(h^(h>>>15),2246822507);h^=h>>>13;return(h>>>0)/4294967296;};
function sceneAmbient(x0,y0,x1,y1,zc,tsec,night){
  const dt=Math.min(.1,Math.max(0,tsec-ambLast));ambLast=tsec;
  const L=SPR.mn,P=SPR.po,S2=SPR.sh,vwT=x1-x0,vhT=y1-y0;
  /* birds cross the sky in loose V formations */
  if(zc>=1.5){
    const want=night?0:Math.min(4,1+((vwT*vhT)/3000|0));
    if(flocks.length<want&&Math.random()<dt*.35){
      const fromL=Math.random()<.5,y=y0+Math.random()*vhT;
      flocks.push({x:fromL?x0-4:x1+4,y,vx:(fromL?1:-1)*(2.2+Math.random()*1.2),vy:(Math.random()-.5)*.8,n:4+((Math.random()*6)|0),seed:(Math.random()*1e6)|0,life:40});
    }
    let w=0;
    for(const f of flocks){
      f.x+=f.vx*dt;f.y+=f.vy*dt;f.life-=dt;
      if(f.life>0&&f.x>x0-12&&f.x<x1+12&&f.y>y0-12&&f.y<y1+12)flocks[w++]=f;
      for(let m=0;m<f.n;m++){
        const row=(m+1)>>1,side=m&1?1:-1,bx=f.x-Math.sign(f.vx)*row*.7+Math.sin(tsec*1.3+m)*.08,by=f.y+side*row*.45+Math.cos(tsec*1.7+m*2)*.06;
        const flap=((tsec*7+m*.37)|0)&1;
        put(SPR.sk,FI('bird_'+flap),bx,by-2.2,.0012,0,0,(f.vx<0?1:0)|4,1,1,1);
        if(zc>=4&&!night)put(S2,FI('shadow'),bx+.6,by+.4,0,0,0,8,.12,1,.25);
      }
    }
    flocks.length=w;
  }
  if(zc>=3){
    /* fish leap in the shallows */
    if(jumps.length<6&&Math.random()<dt*2.5){
      const x=(x0+Math.random()*vwT)|0,y=(y0+Math.random()*vhT)|0;
      if(inB(x,y)&&tile[y*W+x]===WATER)jumps.push({x:x+Math.random(),y:y+Math.random(),t:0,d:Math.random()<.5?1:-1});
    }
    let w=0;
    for(const j of jumps){
      j.t+=dt/.9;
      if(j.t<1){
        jumps[w++]=j;
        const ax=j.x+j.t*.7*j.d,ay=j.y-Math.sin(j.t*Math.PI)*.55;
        if(j.t>.1&&j.t<.9)put(P,FI('fish'),ax,ay,.004,0,0,j.d<0?1:0,1,1,1);
        if(j.t<.25)put(P,FI('splash'),j.x,j.y+.1,.004,0,0,0,1-j.t*4,1,.8);
        else if(j.t>.8)put(P,FI('splash'),j.x+.7*j.d,j.y+.1,.004,0,0,0,(j.t-.8)*5,1,.8);
      }
    }
    jumps.length=w;
    /* now and then a whale surfaces in the deep */
    if(whales.length<2&&Math.random()<dt*.06){
      const x=(x0+Math.random()*vwT)|0,y=(y0+Math.random()*vhT)|0;
      if(inB(x,y)&&tile[y*W+x]===DEEP&&elev[y*W+x]<SL-35)whales.push({x:x+.5,y:y+.5,t:0,d:Math.random()<.5?1:-1});
    }
    w=0;
    for(const wh of whales){
      wh.t+=dt/7;
      if(wh.t<1){
        whales[w++]=wh;
        const x=wh.x+wh.t*1.2*wh.d,show=wh.t<.75?0:1;
        put(L,FI('whale_'+show),x,wh.y,depthY(wh.y),0,0,wh.d<0?1:0,Math.min(1,wh.t*6,(1-wh.t)*6),1,1);
        if(wh.t>.12&&wh.t<.4)for(let m=0;m<3;m++){const q=((wh.t-.12)/.28+m/3)%1;put(L,FI('smoke_0'),x+.15*wh.d,wh.y-.4-q*.9,.006,0,0,4,(1-q)*.8,1,.6+q*.6);}
      }
    }
    whales.length=w;
  }
  /* fireflies on summer nights */
  if(night&&zc>=3.5&&seasonP>.2&&seasonP<.7){
    const slot=(tsec/3)|0;
    for(let m=0;m<70;m++){
      const hx=h1(m*31+slot*7919),hy=h1(m*57+slot*104729),x=x0+hx*vwT,y=y0+hy*vhT;
      const tx=x|0,ty=y|0;if(!inB(tx,ty))continue;
      const t=tile[ty*W+tx];if(t!==FOREST&&t!==SWAMP&&t!==JUNGLE&&t!==GRASS)continue;
      const blink=Math.sin(tsec*3+m*1.7);if(blink<.2)continue;
      put(P,FI('ember'),x+Math.sin(tsec*.7+m)*.4,y+Math.cos(tsec*.9+m)*.3-.4,.004,0,0,0,blink*nightF,1,.5);
    }
  }
  /* rain and snow under the storms */
  if(zc>=2)for(const s of storms){
    const a=stormAmt(s);if(a<.08)continue;
    if(s.x+s.r<x0||s.x-s.r>x1||s.y+s.r<y0||s.y-s.r>y1)continue;
    const cx=Math.max(0,Math.min(W-1,s.x|0)),cy=Math.max(0,Math.min(H-1,s.y|0)),snow=tEff(cy*W+cx)<.06+.25*wintF;
    const n=Math.min(500,(s.r*s.r*(snow?1.2:2.2)*a)|0);
    for(let m=0;m<n;m++){
      const hr=Math.sqrt(h1(m*13+s.id*977)),ha=h1(m*29+s.id*131)*6.283,ph=(tsec*(snow?.35:1.9)+h1(m*7+s.id))%1;
      const bx=s.x+Math.cos(ha)*hr*s.r,by=s.y+Math.sin(ha)*hr*s.r;
      if(bx<x0||bx>x1||by<y0||by>y1)continue;
      if(snow)put(P,FI('snowflake'),bx+Math.sin(tsec*1.5+m)*.3,by-(1-ph)*2.4,.004,0,0,0,.9*a,1,.8);
      else put(P,FI('raindrop'),bx-(1-ph)*.4,by-(1-ph)*2.2,.004,0,0,0,.65*a,1,1);
    }
  }
}
