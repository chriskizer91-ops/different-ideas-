/* ================= rendering ================= */
/* classic 2D renderer: used when WebGL2 is unavailable or switched off in settings */
const off=document.createElement('canvas'),octx=off.getContext('2d');
let img=null,buf=null,clouds=[];
const FLAME=[0xff20b0ff,0xff106aff,0xff60d8ff,0xff083ce0];
function allocRender(){
  off.width=W;off.height=H;img=octx.createImageData(W,H);buf=new Uint32Array(img.data.buffer);
  clouds=[];const n=Math.round(N/6500);
  for(let i=0;i<n;i++)clouds.push({x:Math.random()*W,y:Math.random()*H,s:5+Math.random()*9,sp:.5+Math.random()*.9,seed:(Math.random()*1e6)|0});
  sizeMini();
  if(G)G.setWorld();
}

/* ---------- terrain detail ---------- */
function drawDetail(ox,oy,z,x0,y0,x1,y1){
  const ph=(now()/650)|0,one=Math.max(1,z*.12);
  for(let y=y0;y<y1;y++){
    const py=oy+y*z;
    for(let x=x0;x<x1;x++){
      const i=y*W+x,t=tile[i];
      if(t<=WATER){
        if(hsh(x+ph*31,y-ph*17)<.03){ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect((ox+x*z+z*.15)|0,(py+z*.45)|0,Math.ceil(z*.7),one);}
        continue;
      }
      if(bmap[i]||fire[i]||road[i])continue;
      const h=hsh(x,y),px=ox+x*z;
      switch(t){
        case GRASS:
          if(h<.14){ctx.fillStyle='#5f9a40';ctx.fillRect((px+z*h*4)|0,(py+z*.5)|0,Math.max(1,z*.14),Math.ceil(z*.26));}
          else if(h>.95){ctx.fillStyle=h>.985?'#f4e04a':h>.97?'#ffffff':'#f49ac2';ctx.fillRect((px+z*.4)|0,(py+z*.35)|0,Math.max(1,z*.18),Math.max(1,z*.18));}
          break;
        case FOREST:{
          const jx=px+(h-.5)*z*.3;
          ctx.fillStyle='#5b3f2a';ctx.fillRect((jx+z*.42)|0,(py+z*.55)|0,Math.max(1,z*.16),Math.ceil(z*.4));
          ctx.fillStyle=h<.5?'#2f7a36':'#3a8a3c';
          ctx.fillRect((jx+z*.12)|0,(py-z*.3)|0,Math.ceil(z*.76),Math.ceil(z*.85));
          ctx.fillRect((jx+z*.26)|0,(py-z*.46)|0,Math.ceil(z*.48),Math.ceil(z*.2));
          ctx.fillStyle='#6cb658';ctx.fillRect((jx+z*.22)|0,(py-z*.3)|0,Math.ceil(z*.28),Math.ceil(z*.22));
          break;
        }
        case PINE:{
          const jx=px+(h-.5)*z*.2;
          ctx.fillStyle='#4a3526';ctx.fillRect((jx+z*.44)|0,(py+z*.6)|0,Math.max(1,z*.12),Math.ceil(z*.35));
          ctx.fillStyle=h<.5?'#24553f':'#2c6148';
          ctx.fillRect((jx+z*.4)|0,(py-z*.6)|0,Math.ceil(z*.2),Math.ceil(z*.3));
          ctx.fillRect((jx+z*.28)|0,(py-z*.35)|0,Math.ceil(z*.44),Math.ceil(z*.35));
          ctx.fillRect((jx+z*.14)|0,(py-z*.05)|0,Math.ceil(z*.72),Math.ceil(z*.4));
          ctx.fillRect((jx+z*.04)|0,(py+z*.3)|0,Math.ceil(z*.92),Math.ceil(z*.32));
          if(soil[i]===TUNDRA){ctx.fillStyle='#eef4f6';ctx.fillRect((jx+z*.4)|0,(py-z*.6)|0,Math.ceil(z*.2),Math.max(1,z*.14));ctx.fillRect((jx+z*.28)|0,(py-z*.35)|0,Math.ceil(z*.22),Math.max(1,z*.1));}
          break;
        }
        case JUNGLE:
          ctx.fillStyle='#1f7040';ctx.fillRect((px-z*.05)|0,(py-z*.4)|0,Math.ceil(z*1.1),Math.ceil(z*.95));
          ctx.fillStyle='#2c8a4c';ctx.fillRect((px+z*(.05+h*.3))|0,(py-z*.58)|0,Math.ceil(z*.6),Math.ceil(z*.5));
          ctx.fillStyle='#58b060';ctx.fillRect((px+z*.15)|0,(py-z*.5)|0,Math.ceil(z*.25),Math.ceil(z*.2));
          if(h>.9){ctx.fillStyle='#e8485a';ctx.fillRect((px+z*.6)|0,(py+z*.1)|0,Math.max(1,z*.16),Math.max(1,z*.16));}
          break;
        case MOUNT:case SNOW:{
          const top=py-z*(t===SNOW?.75:.5)-h*z*.2,mx=px+z*.5;
          ctx.fillStyle=t===SNOW?'#a9a6a8':'#9a938d';
          ctx.beginPath();ctx.moveTo(px-z*.12,py+z);ctx.lineTo(mx,top);ctx.lineTo(mx,py+z);ctx.fill();
          ctx.fillStyle=t===SNOW?'#7f7c82':'#6d6762';
          ctx.beginPath();ctx.moveTo(mx,top);ctx.lineTo(px+z*1.12,py+z);ctx.lineTo(mx,py+z);ctx.fill();
          if(t===SNOW||h>.6){
            const sh=(py+z-top)*(t===SNOW?.45:.25);
            ctx.fillStyle='#f6f9fc';ctx.beginPath();ctx.moveTo(mx,top);ctx.lineTo(mx-sh*.42,top+sh);ctx.lineTo(mx+sh*.42,top+sh);ctx.fill();
          }
          break;
        }
        case HILL:
          if(h<.55){ctx.fillStyle='#b0ae7c';ctx.fillRect((px+z*.1)|0,(py+z*.22)|0,Math.ceil(z*.8),Math.ceil(z*.3));ctx.fillStyle='#86835a';ctx.fillRect((px+z*.1)|0,(py+z*.52)|0,Math.ceil(z*.8),one);}
          break;
        case DESERT:
          if(h<.3){ctx.fillStyle='#c8a560';ctx.fillRect((px+z*.1)|0,(py+z*.55)|0,Math.ceil(z*.7),one);}
          else if(h>.975){ctx.fillStyle='#4f8a3a';ctx.fillRect((px+z*.42)|0,(py-z*.1)|0,Math.max(1,z*.18),Math.ceil(z*.9));ctx.fillRect((px+z*.18)|0,(py+z*.25)|0,Math.ceil(z*.26),Math.max(1,z*.14));ctx.fillRect((px+z*.18)|0,(py+z*.08)|0,Math.max(1,z*.12),Math.ceil(z*.2));}
          break;
        case SAVANNA:
          if(h<.07){ctx.fillStyle='#6a5030';ctx.fillRect((px+z*.44)|0,(py+z*.1)|0,Math.max(1,z*.12),Math.ceil(z*.8));ctx.fillStyle='#7c8f3a';ctx.fillRect((px-z*.15)|0,(py-z*.2)|0,Math.ceil(z*1.3),Math.ceil(z*.32));ctx.fillRect((px+z*.1)|0,(py-z*.35)|0,Math.ceil(z*.8),Math.ceil(z*.18));}
          else if(h>.6&&h<.8){ctx.fillStyle='#a39a48';ctx.fillRect((px+z*.3)|0,(py+z*.5)|0,Math.ceil(z*.3),one);}
          break;
        case SWAMP:
          if(h<.4){ctx.fillStyle='#4d6b62';ctx.fillRect((px+z*.15)|0,(py+z*.3)|0,Math.ceil(z*.6),Math.ceil(z*.4));}
          else if(h>.8){ctx.fillStyle='#3d5a2e';ctx.fillRect((px+z*.3)|0,(py+z*.1)|0,one,Math.ceil(z*.6));ctx.fillRect((px+z*.55)|0,(py+z*.25)|0,one,Math.ceil(z*.5));}
          break;
        case TUNDRA:
          if(h<.25){ctx.fillStyle='#f4f8f8';ctx.fillRect((px+z*.2)|0,(py+z*.3)|0,Math.ceil(z*.4),Math.ceil(z*.25));}
          else if(h>.95){ctx.fillStyle='#8b8f93';ctx.fillRect((px+z*.3)|0,(py+z*.4)|0,Math.ceil(z*.35),Math.ceil(z*.3));}
          break;
        case SAND:if(h>.93){ctx.fillStyle='#c9b480';ctx.fillRect((px+z*.4)|0,(py+z*.5)|0,Math.max(1,z*.2),Math.max(1,z*.15));}break;
        case RIVER:if(hsh(x+ph*7,y+ph*3)<.12){ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect((px+z*.2)|0,(py+z*.4)|0,Math.ceil(z*.5),one);}break;
        case LAVA:if(hsh(x+ph,y-ph)<.3){ctx.fillStyle='#ffd23f';ctx.fillRect((px+z*.3)|0,(py+z*.3)|0,Math.ceil(z*.4),Math.ceil(z*.4));}break;
        case ASH:if(h<.2){ctx.fillStyle='#2e2722';ctx.fillRect((px+z*.4)|0,(py+z*.3)|0,Math.max(1,z*.2),Math.ceil(z*.5));}break;
      }
    }
  }
}

/* ---------- buildings ---------- */
let BX=0,BY=0,BZ=1;
function R(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect((BX+x*BZ)|0,(BY+y*BZ)|0,Math.max(1,Math.ceil(w*BZ)),Math.max(1,Math.ceil(h*BZ)));}
const SHADE='rgba(0,0,0,.28)';
function drawHouse(race,age,kc2,big){
  if(race===ELF){
    R(.38,.3,.24,.7,'#6a4a2e');R(-.2,-.6,1.4,1,'#3f8f4a');R(0,-.75,1,.2,'#3f8f4a');R(-.05,-.58,.6,.3,'#62b05e');
    R(-.2,.18,1.4,.18,kc2);R(.42,-.12,.18,.2,'#ffe9a0');
  }else if(race===DWARF){
    R(-.15,.1,1.3,.9,'#8f8a84');R(-.15,.1,1.3,.14,'#a8a39c');R(-.25,-.12,1.5,.26,kc2);R(-.25,.1,1.5,.1,SHADE);
    R(.35,.5,.3,.5,'#2e2620');if(age>=2)R(.8,-.45,.2,.4,'#6b625a');
  }else if(race===ORC){
    R(.3,-.45,.4,.35,'#7a5a3c');R(.1,-.12,.8,.45,'#7a5a3c');R(-.15,.3,1.3,.7,'#6b4c32');R(-.15,.3,1.3,.14,kc2);
    R(.38,.55,.24,.45,'#241a12');if(age>=2)R(.46,-.75,.08,.35,'#e9e2d0');
  }else{
    R(-.1,.25,1.2,.75,age>=2?'#d9d4c8':'#eadfc4');R(-.25,-.25,1.5,.6,kc2);R(-.1,-.38,1.2,.16,kc2);R(-.25,.2,1.5,.14,SHADE);
    R(.38,.6,.26,.4,'#3a2a1c');if(age>=2)R(.82,-.6,.2,.4,'#6b625a');
    if(age>=3&&!big)R(.05,.4,.2,.2,'#9fd0e8');
  }
}
function drawBld(b,ox,oy,z){
  const v=b.v,k=v.k,kc2=k.color,race=v.race,age=k.age;
  BX=ox+b.x*z;BY=oy+b.y*z;BZ=z;
  switch(b.kind){
    case'farm':
      if(b.grove){R(0,0,1,1,'#7fbf5a');R(.15,.15,.2,.2,'#d9455a');R(.6,.25,.2,.2,'#d9455a');R(.3,.6,.2,.2,'#d9455a');R(.7,.7,.18,.18,'#d9455a');}
      else{R(0,0,1,1,'#d8b64c');if(z>=4*dpr){R(0,.22,1,.14,'#b08a2c');R(0,.62,1,.14,'#b08a2c');}}
      break;
    case'dock':{
      const wx=(b.wi%W)-b.x,wy=((b.wi/W)|0)-b.y;
      if(wx)R(wx>0?.3:-.9,.3,1.6,.4,'#8a6a44');else R(.3,wy>0?.3:-.9,.4,1.6,'#8a6a44');
      R(.25+wx*.8,.25+wy*.8,.5,.5,'#a07c52');R(.2,.2,.14,.14,'#3a2a1c');R(.66,.66,.14,.14,'#3a2a1c');
      break;
    }
    case'mine':
      R(-.1,.05,1.2,.95,'#6f675f');R(0,-.1,1,.2,'#857c73');R(.25,.4,.5,.6,'#1d1814');R(.2,.34,.6,.12,'#8a6a44');
      R(.08,.2,.12,.12,'#f2c94c');R(.82,.5,.12,.12,'#f2c94c');
      break;
    case'house':drawHouse(race,age,kc2,false);break;
    case'market':
      R(-.1,.3,1.2,.7,'#e7d9b8');R(-.2,-.08,1.4,.42,kc2);R(.05,-.08,.2,.42,'#fff');R(.5,-.08,.2,.42,'#fff');R(.95,-.08,.2,.42,'#fff');
      R(.1,.55,.2,.2,'#d9455a');R(.45,.55,.2,.2,'#f2c94c');R(.78,.55,.2,.2,'#6cb658');
      break;
    case'barracks':
      R(-.3,.2,1.6,.8,'#8d7b68');R(-.4,-.15,1.8,.45,'#5a2e2a');R(-.4,.2,1.8,.12,SHADE);R(.3,.55,.4,.45,'#2a1e14');
      R(.92,-.75,.1,.65,'#2a1e14');R(1.02,-.75,.45,.3,kc2);
      break;
    case'tower':
      R(.15,-.9,.7,1.9,'#aaa59c');R(.15,-.9,.2,1.9,'#c2bdb4');R(.05,-1.12,.9,.3,'#8f8a82');
      R(.05,-1.3,.22,.2,'#8f8a82');R(.39,-1.3,.22,.2,'#8f8a82');R(.73,-1.3,.22,.2,'#8f8a82');
      R(.42,-.4,.16,.35,'#2a2420');R(.46,-1.95,.08,.7,'#2a1e14');R(.54,-1.95,.45,.3,kc2);
      break;
    case'temple':
      R(-.2,.1,1.4,.9,'#f3efe6');R(-.05,.25,.14,.75,'#d5cfc2');R(.3,.25,.14,.75,'#d5cfc2');R(.6,.25,.14,.75,'#d5cfc2');R(.92,.25,.14,.75,'#d5cfc2');
      R(-.3,-.25,1.6,.4,'#e6c35a');R(0,-.5,1,.28,'#e6c35a');R(.42,-.95,.16,.5,'#e6c35a');R(.3,-.8,.4,.12,'#e6c35a');
      break;
    case'academy':
      R(-.2,.1,1.4,.9,'#d9d4c8');R(-.2,.1,1.4,.12,'#bdb7aa');R(.1,-.5,.8,.62,'#4a78c8');R(.25,-.68,.5,.2,'#4a78c8');R(.2,-.42,.25,.2,'#7fa4e6');
      R(.45,-1.05,.1,.4,'#e6c35a');R(.35,.5,.3,.5,'#3a2a1c');
      break;
    case'wall':R(0,-.2,1,1.2,'#8f8a82');R(0,-.35,1,.2,'#a9a49b');break;
    case'windmill':case'lighthouse':case'factory':R(.15,-.9,.7,1.9,b.kind==='factory'?'#8a5a4a':'#e8e2d6');R(.1,-1.1,.8,.3,kc2);break;
    case'arena':case'launchpad':case'wonder':
      R(0,-1,2,2.9,b.kind==='wonder'?'#e6c35a':'#bdb7aa');R(.2,-1.3,1.6,.4,kc2);break;
    case'hall':
      if(age>=3&&race!==ELF&&race!==ORC){
        const st=race===DWARF?'#8c8780':'#b9b4aa',st2=race===DWARF?'#77726c':'#a39e94';
        R(-.6,-.45,2.2,1.45,st);R(-.6,-.45,2.2,.16,st2);
        for(let n=0;n<5;n++)R(-.6+n*.5,-.68,.26,.24,st);
        R(-.95,-.95,.55,1.95,st2);R(1.4,-.95,.55,1.95,st2);R(-1.02,-1.25,.7,.34,kc2);R(1.33,-1.25,.7,.34,kc2);
        R(.2,.25,.6,.75,'#2a1e14');R(.3,-.2,.14,.3,'#2a2420');R(.6,-.2,.14,.3,'#2a2420');
        R(.44,-1.9,.1,1.3,'#2a1e14');R(.54,-1.9,.75,.45,kc2);
      }else{
        BX-=z*.45;BY-=z*.55;BZ=z*1.9;
        drawHouse(race,age,kc2,true);
        BX=ox+b.x*z;BY=oy+b.y*z;BZ=z;
        if(race===ORC){R(1.1,-.9,.1,1.2,'#e9e2d0');R(.98,-1.15,.34,.3,'#e9e2d0');R(1.04,-1.05,.08,.08,'#241a12');R(1.18,-1.05,.08,.08,'#241a12');}
        R(.44,-2,.1,1.1,'#2a1e14');R(.54,-2,.7,.42,kc2);
      }
      break;
  }
  if(fire[b.i]){
    ctx.fillStyle=frameNo%6<3?'#ffb020':'#ff5a10';
    ctx.fillRect((BX+z*.1)|0,(BY-z*(.6+Math.random()*.5))|0,Math.ceil(z*.8),Math.ceil(z*.9));
  }
}

/* ---------- creatures ---------- */
const SKIN=['#f2cda4','#ead9b0','#e0a882','#79b548'],PLAIN=['#d2c9b4','#9fc69a','#a39a8c','#5d4a36'];
function drawUnit(u,ox,oy,z,small){
  const px=ox+(u.x+.5+u.ox)*z,py=oy+(u.y+.5+u.oy)*z,t=u.t;
  if(t<=ORC){
    const col=u.k?u.k.color:PLAIN[t];
    if(small){ctx.fillStyle=col;ctx.fillRect((px-dpr)|0,(py-dpr)|0,2*dpr,2*dpr);return;}
    const kid=u.age<SPEC[t].adult,s=z*(kid?.38:t===DWARF?.5:.55),wd=t===DWARF?1.25:1;
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect((px-s*.6*wd)|0,(py-s*.3)|0,Math.ceil(s*1.2*wd),Math.ceil(s*1.1));
    ctx.fillStyle=col;ctx.fillRect((px-s*.5*wd)|0,(py-s*.2)|0,Math.ceil(s*wd),Math.ceil(s*.9));
    ctx.fillStyle=SKIN[t];ctx.fillRect((px-s*.4)|0,(py-s*.9)|0,Math.ceil(s*.8),Math.ceil(s*.7));
    if(t===ELF){ctx.fillStyle='#2f7a36';ctx.fillRect((px-s*.45)|0,(py-s*1.05)|0,Math.ceil(s*.9),Math.ceil(s*.3));}
    else if(t===DWARF){ctx.fillStyle='#c4622a';ctx.fillRect((px-s*.4)|0,(py-s*.45)|0,Math.ceil(s*.8),Math.ceil(s*.5));ctx.fillStyle='#8f8a84';ctx.fillRect((px-s*.45)|0,(py-s*1.05)|0,Math.ceil(s*.9),Math.ceil(s*.25));}
    else if(t===HUMAN&&!kid){ctx.fillStyle='#6a4a2e';ctx.fillRect((px-s*.4)|0,(py-s*1)|0,Math.ceil(s*.8),Math.ceil(s*.22));}
    if(u.soldier){
      if(t===ELF){ctx.fillStyle='#8a6a44';ctx.fillRect((px+s*.6)|0,(py-s*.9)|0,Math.max(1,s*.16),Math.ceil(s*1.3));}
      else{ctx.fillStyle=t===ORC?'#b9b0a0':'#e9eef2';ctx.fillRect((px+s*.55*wd)|0,(py-s*.8)|0,Math.max(1,s*.22),Math.ceil(s*1.1));if(t!==HUMAN)ctx.fillRect((px+s*.4*wd)|0,(py-s*.8)|0,Math.ceil(s*.5),Math.max(1,s*.3));}
    }
    if(u.sick){ctx.fillStyle='#7ee04a';ctx.fillRect((px-s*.15)|0,(py-s*1.5)|0,Math.max(1,s*.3),Math.max(1,s*.3));}
    return;
  }
  if(small){ctx.fillStyle=t===SHEEP?'#f4f1e8':t===WOLF?'#4d5158':t===BEAR?'#5a3c26':'#6f8f6a';ctx.fillRect((px-dpr)|0,(py-dpr)|0,2*dpr,2*dpr);return;}
  const s=z*.5,d=u.dir>0;
  if(t===SHEEP){
    ctx.fillStyle='#f4f1e8';ctx.fillRect((px-s*.7)|0,(py-s*.4)|0,Math.ceil(s*1.4),Math.ceil(s*.9));
    ctx.fillStyle='#3a332c';ctx.fillRect((px+(d?s*.5:-s*.9))|0,(py-s*.5)|0,Math.ceil(s*.45),Math.ceil(s*.5));
  }else if(t===WOLF){
    ctx.fillStyle='#676c74';ctx.fillRect((px-s*.8)|0,(py-s*.3)|0,Math.ceil(s*1.6),Math.ceil(s*.7));
    ctx.fillStyle='#3d4046';ctx.fillRect((px+(d?s*.6:-s*1.1))|0,(py-s*.6)|0,Math.ceil(s*.55),Math.ceil(s*.6));
  }else if(t===BEAR){
    ctx.fillStyle='#6b472c';ctx.fillRect((px-s*1.1)|0,(py-s*.7)|0,Math.ceil(s*2.2),Math.ceil(s*1.3));
    ctx.fillStyle='#4f331f';ctx.fillRect((px+(d?s*.8:-s*1.5))|0,(py-s*.9)|0,Math.ceil(s*.75),Math.ceil(s*.8));
  }else if(t===SIEGE||t===CARAVAN){
    ctx.fillStyle=u.k?u.k.color:'#8a6a44';ctx.fillRect((px-s*.9)|0,(py-s*.6)|0,Math.ceil(s*1.8),Math.ceil(s*.9));
    ctx.fillStyle='#3a2a1c';ctx.fillRect((px-s*.8)|0,(py+s*.2)|0,Math.ceil(s*.4),Math.ceil(s*.4));ctx.fillRect((px+s*.4)|0,(py+s*.2)|0,Math.ceil(s*.4),Math.ceil(s*.4));
  }else if(t===ZOMBIE){
    ctx.fillStyle='#4f5d4a';ctx.fillRect((px-s*.5)|0,(py-s*.2)|0,Math.ceil(s),Math.ceil(s));
    ctx.fillStyle='#9bbf8a';ctx.fillRect((px-s*.4)|0,(py-s*.95)|0,Math.ceil(s*.8),Math.ceil(s*.75));
    ctx.fillRect((px+(d?s*.5:-s*1.1))|0,(py-s*.1)|0,Math.ceil(s*.6),Math.max(1,s*.25));
  }
}
function drawDragon(u,ox,oy,z){
  const px=ox+(u.x+.5)*z,py=oy+(u.y+.5)*z,s=Math.max(z*.6,2*dpr),up=frameNo%24<12;
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect((px-s*1.6)|0,(py+s*2.6)|0,Math.ceil(s*3.2),Math.ceil(s*.7));
  ctx.fillStyle='#e0452b';ctx.fillRect((px-s*1.2)|0,(py-(up?s*2:s*.1))|0,Math.ceil(s*2.4),Math.ceil(s*1.8));
  ctx.fillStyle='#a8201a';ctx.fillRect((px-s*2)|0,(py-s*.5)|0,Math.ceil(s*4),Math.ceil(s));
  ctx.fillStyle='#7c1612';ctx.fillRect((px+(u.dir>0?s*1.8:-s*2.8))|0,(py-s*.9)|0,Math.ceil(s),Math.ceil(s*.9));
}
function drawBoat(b,ox,oy,z){
  const s=Math.max(z,3*dpr),px=ox+(b.x+.5)*z,py=oy+(b.y+.5)*z;
  ctx.fillStyle='rgba(255,255,255,.4)';ctx.fillRect((px-b.dir*s*1.3-s*.3)|0,(py+s*.35)|0,Math.ceil(s*.7),Math.max(1,s*.14));
  ctx.fillStyle='#6a4a2e';ctx.fillRect((px-s*.7)|0,(py+s*.05)|0,Math.ceil(s*1.4),Math.ceil(s*.45));
  ctx.fillStyle='#4f3520';ctx.fillRect((px-s*.5)|0,(py+s*.4)|0,Math.ceil(s),Math.max(1,s*.14));
  ctx.fillStyle='#3a2a1c';ctx.fillRect((px-s*.06)|0,(py-s*1.1)|0,Math.max(1,s*.12),Math.ceil(s*1.2));
  ctx.fillStyle=b.k.color;ctx.fillRect((px+(b.dir>0?s*.06:-s*.7))|0,(py-s*1)|0,Math.ceil(s*.64),Math.ceil(s*.8));
  ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect((px+(b.dir>0?s*.06:-s*.7))|0,(py-s*.65)|0,Math.ceil(s*.64),Math.max(1,s*.14));
}
function drawTwister(tw,ox,oy,z){
  const px=ox+(tw.x+.5)*z,py=oy+(tw.y+.5)*z,tt=now()/90;
  for(let n=0;n<7;n++){
    const w=z*(.5+n*.45),x=px+Math.sin(tt+n*.9)*z*.35*(n*.3+.4);
    ctx.fillStyle=n%2?'rgba(120,124,132,.8)':'rgba(170,174,182,.8)';
    ctx.fillRect((x-w/2)|0,(py-n*z*.75)|0,Math.ceil(w),Math.ceil(z*.7));
  }
}
function label(text,px,py,size,bold,color){
  ctx.font=(bold?'700 ':'600 ')+Math.round(size*dpr)+'px '+FONT;
  ctx.lineWidth=3*dpr;ctx.strokeStyle='rgba(11,24,40,.9)';ctx.strokeText(text,px,py);
  ctx.fillStyle=color||'#fff';ctx.fillText(text,px,py);
}
function wrapText(text,max){
  const words=text.split(' '),lines=[];let cur='';
  for(const w of words){
    if(cur&&(cur+' '+w).length>max){lines.push(cur);cur=w;}else cur=cur?cur+' '+w:w;
  }
  if(cur)lines.push(cur);
  return lines.slice(0,4);
}
function drawBubble(text,px,py){
  const lines=wrapText(text,26),fs=12*dpr,lh=fs*1.25,pad=6*dpr;
  ctx.font='600 '+fs+'px '+FONT;
  let w=0;for(const l of lines)w=Math.max(w,ctx.measureText(l).width);
  const bw=w+pad*2,bh=lines.length*lh+pad*1.6,x=Math.round(px-bw/2),y=Math.round(py-bh-8*dpr);
  ctx.fillStyle='#12263f';ctx.fillRect(x-2*dpr,y-2*dpr,bw+4*dpr,bh+4*dpr);
  ctx.fillRect(px-4*dpr,y+bh,8*dpr,6*dpr);
  ctx.fillStyle='#fff8dc';ctx.fillRect(x,y,bw,bh);ctx.fillRect(px-2*dpr,y+bh-dpr,4*dpr,4*dpr);
  ctx.fillStyle='#12263f';ctx.textBaseline='top';
  for(let n=0;n<lines.length;n++)ctx.fillText(lines[n],px,y+pad*.8+n*lh);
  ctx.textBaseline='bottom';
}
function drawClouds(ox,oy,z,dt,x0,y0,x1,y1){
  const fade=cam.z>6?Math.max(0,1-(cam.z-6)/5):1;
  for(const c of clouds){
    c.x+=c.sp*dt*.0012;if(c.x>W+20)c.x=-20;
    if(c.x+c.s*2<x0-8||c.x-c.s>x1+8||c.y+c.s<y0-8||c.y-c.s>y1+8)continue;
    const r=mulberry(c.seed);
    for(let pass=0;pass<2;pass++){
      if(pass===1&&fade<=0)break;
      ctx.fillStyle=pass===0?'rgba(8,16,40,.13)':'rgba(255,255,255,'+(.36*fade).toFixed(3)+')';
      const dx=pass===0?4:0,dy=pass===0?5:0;
      const rr=mulberry(c.seed);
      for(let n=0;n<5;n++){
        const bx=c.x+(rr()-.5)*c.s*1.6+dx,by=c.y+(rr()-.5)*c.s*.6+dy,bw=c.s*(.5+rr()*.6),bh=c.s*(.25+rr()*.25);
        ctx.fillRect((ox+(bx-bw/2)*z)|0,(oy+(by-bh/2)*z)|0,Math.ceil(bw*z),Math.ceil(bh*z));
      }
    }
    r();
  }
}
function tickEffects(){
  let w=0;
  for(let n=0;n<effects.length;n++){
    const e=effects[n];
    if(e.k==='meteor'&&e.t===1)blast(e.x,e.y,6,true);
    if(--e.t>0)effects[w++]=e;
  }
  effects.length=w;
}
function drawEffects(ox,oy,z,cw,ch){
  for(let n=0;n<effects.length;n++){
    const e=effects[n],px=ox+(e.x+.5)*z,py=oy+(e.y+.5)*z;
    switch(e.k){
      case'bolt':{
        const r=mulberry(e.seed);
        ctx.strokeStyle=e.t>5?'#ffffff':'#ffe66b';ctx.lineWidth=Math.max(2*dpr,z*.3);
        ctx.beginPath();let x=px,y=py;ctx.moveTo(x,y);
        while(y>0){y-=z*2+r()*z*2+8;x+=(r()-.5)*z*4;ctx.lineTo(x,y);}
        ctx.stroke();
        if(e.t>7&&!reduceMotion){ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(0,0,cw,ch);}
        break;
      }
      case'boom':{
        const p=1-e.t/e.T,rad=e.r*z*(.3+.7*p);
        ctx.globalAlpha=Math.max(0,1-p);
        ctx.fillStyle='#ffb347';ctx.beginPath();ctx.arc(px,py,rad,0,6.283);ctx.fill();
        ctx.strokeStyle='#fff6d6';ctx.lineWidth=Math.max(1,z*.3);ctx.stroke();
        ctx.globalAlpha=1;break;
      }
      case'ring':{
        const p=1-e.t/e.T;
        ctx.globalAlpha=Math.max(0,1-p);ctx.strokeStyle='#ffe98a';ctx.lineWidth=Math.max(2,z*.35);
        ctx.beginPath();ctx.arc(px,py,e.r*z*(.2+.8*p),0,6.283);ctx.stroke();ctx.globalAlpha=1;break;
      }
      case'meteor':{
        const p=e.t/28,mx=px+p*z*16,my=py-p*z*26;
        ctx.strokeStyle='rgba(255,170,60,.7)';ctx.lineWidth=Math.max(2,z*.9);
        ctx.beginPath();ctx.moveTo(mx+z*5,my-z*8);ctx.lineTo(mx,my);ctx.stroke();
        ctx.fillStyle='#ffcf5a';ctx.beginPath();ctx.arc(mx,my,Math.max(3,z*1.3),0,6.283);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(mx,my,Math.max(1.5,z*.6),0,6.283);ctx.fill();
        break;
      }
      case'rain':ctx.fillStyle='rgba(214,236,255,.85)';ctx.fillRect(px|0,(py-e.t*z*.5)|0,Math.max(1,z*.14),Math.ceil(z*.7));break;
      case'arrow':{
        const p=1-e.t/e.T,ax=px+(e.x2-e.x)*z*p,ay=py+(e.y2-e.y)*z*p-Math.sin(p*3.14)*z*.8;
        ctx.fillStyle='#fff3c4';ctx.fillRect((ax-z*.15)|0,(ay-z*.15)|0,Math.max(2,z*.3),Math.max(2,z*.3));break;
      }
      case'spark':ctx.fillStyle=e.t%2?'#fff':'#ffd23f';ctx.fillRect((px-z*.2+(Math.random()-.5)*z*.6)|0,(py-z*.6+(Math.random()-.5)*z*.6)|0,Math.max(2,z*.3),Math.max(2,z*.3));break;
      case'smoke':ctx.fillStyle='rgba(60,56,54,'+(e.t/40*.5).toFixed(3)+')';ctx.fillRect((px+Math.sin(e.t*.3)*z*.3)|0,(py-(40-e.t)*z*.08-z)|0,Math.ceil(z*.6),Math.ceil(z*.6));break;
    }
  }
}
function drawMini(){
  const mw=mini.width,mh=mini.height;
  mctx.imageSmoothingEnabled=true;mctx.drawImage(off,0,0,W,H,0,0,mw,mh);
  for(const k of kingdoms){
    if(!k.alive||!k.villages.length)continue;const c=k.villages[0],s=3*dpr;
    mctx.fillStyle='#0b1828';mctx.fillRect((c.x/W*mw-s/2-dpr)|0,(c.y/H*mh-s/2-dpr)|0,s+2*dpr,s+2*dpr);
    mctx.fillStyle=k.color;mctx.fillRect((c.x/W*mw-s/2)|0,(c.y/H*mh-s/2)|0,s,s);
  }
  mctx.strokeStyle='#fff';mctx.lineWidth=Math.max(1,dpr);
  mctx.strokeRect(Math.round(cam.x/W*mw)+.5,Math.round(cam.y/H*mh)+.5,Math.max(3,vw/cam.z/W*mw),Math.max(3,vh/cam.z/H*mh));
}
function render(dt,running){
  frameNo++;
  if(dirtyAll)recolorAll();else sweep();
  buf.set(base);
  for(let n=0;n<fireList.length;n++){const i=fireList[n];if(fire[i])buf[i]=FLAME[(Math.random()*4)|0];}
  const cw=cv.width,ch=cv.height,z=cam.z*dpr;
  const tx0=Math.max(0,Math.floor(cam.x)-1),ty0=Math.max(0,Math.floor(cam.y)-1);
  const tx1=Math.min(W,Math.ceil(cam.x+vw/cam.z)+1),ty1=Math.min(H,Math.ceil(cam.y+vh/cam.z)+1);
  const vis=tx1>tx0&&ty1>ty0,full=frameNo%24===1||!vis;
  if(full)octx.putImageData(img,0,0);else octx.putImageData(img,0,0,tx0,ty0,tx1-tx0,ty1-ty0);
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#184074';ctx.fillRect(0,0,cw,ch);
  let ox=-cam.x*z,oy=-cam.y*z;
  if(shake>0){ox+=(Math.random()-.5)*shake*dpr;oy+=(Math.random()-.5)*shake*dpr;shake*=.88;if(shake<.4)shake=0;}
  ox=Math.round(ox);oy=Math.round(oy);
  ctx.imageSmoothingEnabled=cam.z<1;
  if(vis)ctx.drawImage(off,tx0,ty0,tx1-tx0,ty1-ty0,ox+tx0*z,oy+ty0*z,(tx1-tx0)*z,(ty1-ty0)*z);
  const x0=cam.x-3,y0=cam.y-3,x1=cam.x+vw/cam.z+3,y1=cam.y+vh/cam.z+3;
  if(vis&&S.detail&&cam.z>=5.5&&(tx1-tx0)*(ty1-ty0)<17000)drawDetail(ox,oy,z,tx0,ty0,tx1,Math.min(H,ty1+1));
  if(cam.z>=1.6){
    for(let n=1;n<vById.length;n++){
      const v=vById[n];if(!v.alive)continue;
      const m=v.rad+8;if(v.x+m<x0||v.x-m>x1||v.y+m<y0||v.y-m>y1)continue;
      const bl=v.blds;
      for(let q=0;q<bl.length;q++)if(!bl[q].solid)drawBld(bl[q],ox,oy,z);
      for(let q=bl.length-1;q>=0;q--)if(bl[q].solid)drawBld(bl[q],ox,oy,z);
    }
  }
  for(const b of boats)if(b.x>=x0&&b.x<=x1&&b.y>=y0&&b.y<=y1)drawBoat(b,ox,oy,z);
  const small=cam.z<3.2;let dragons=null;
  if(cam.z>=1.1){
    for(let n=0;n<units.length;n++){
      const u=units[n];
      if(u.x<x0||u.x>x1||u.y<y0||u.y>y1)continue;
      if(u.t===DRAGON){(dragons||(dragons=[])).push(u);continue;}
      drawUnit(u,ox,oy,z,small);
    }
  }
  for(const tw of twisters)drawTwister(tw,ox,oy,z);
  if(dragons)for(const u of dragons)drawDragon(u,ox,oy,z);
  /* smoke rises from whatever is burning on screen */
  if(fireList.length&&frameNo%3===0&&!reduceMotion){
    for(let n=0;n<6;n++){const i=fireList[(Math.random()*fireList.length)|0],fx2=i%W,fy=(i/W)|0;if(fire[i]&&fx2>=x0&&fx2<=x1&&fy>=y0&&fy<=y1)fx({k:'smoke',x:fx2,y:fy,t:40});}
  }
  drawEffects(ox,oy,z,cw,ch);
  if(S.clouds&&cam.z>=1.2)drawClouds(ox,oy,z,running?dt:0,x0,y0,x1,y1);
  /* day and night */
  if(nightF>.01){
    const dusk=nightF<1?Math.sin(nightF*3.14159):0;
    ctx.globalCompositeOperation='multiply';
    ctx.fillStyle='rgb('+Math.round(255-nightF*120+dusk*30)+','+Math.round(255-nightF*102-dusk*8)+','+Math.round(255-nightF*40-dusk*36)+')';
    ctx.fillRect(0,0,cw,ch);
    if(cam.z>=1.6){
      for(let pass=0;pass<2;pass++){
        if(pass===0){ctx.globalCompositeOperation='lighter';ctx.fillStyle='rgba(255,176,84,'+(.17*nightF).toFixed(3)+')';}
        else{ctx.globalCompositeOperation='source-over';ctx.globalAlpha=nightF;ctx.fillStyle='#ffe28c';}
        for(let n=1;n<vById.length;n++){
          const v=vById[n];if(!v.alive)continue;
          const m=v.rad+6;if(v.x+m<x0||v.x-m>x1||v.y+m<y0||v.y-m>y1)continue;
          for(const b of v.blds){
            if(!b.solid)continue;
            if(pass===0)ctx.fillRect((ox+(b.x-.8)*z)|0,(oy+(b.y-.8)*z)|0,Math.ceil(z*2.6),Math.ceil(z*2.6));
            else{
              const lx=ox+(b.x+(b.kind==='hall'?.05:.36))*z,ly=oy+(b.y+.42)*z,ls=Math.max(2*dpr,z*.3);
              ctx.fillRect(lx|0,ly|0,Math.ceil(ls),Math.ceil(ls));
              if(b.kind==='hall')ctx.fillRect((lx+z*.75)|0,ly|0,Math.ceil(ls),Math.ceil(ls));
            }
          }
        }
      }
      ctx.globalAlpha=1;
    }
    ctx.globalCompositeOperation='lighter';
    ctx.fillStyle='rgba(255,140,40,'+(.55*nightF).toFixed(3)+')';
    for(let n=0;n<fireList.length;n++){
      const i=fireList[n],fx2=i%W,fy=(i/W)|0;
      if(fire[i]&&fx2>=x0&&fx2<=x1&&fy>=y0&&fy<=y1)ctx.fillRect((ox+fx2*z-z*.5)|0,(oy+fy*z-z*.5)|0,Math.ceil(z*2),Math.ceil(z*2));
    }
    ctx.globalCompositeOperation='source-over';
  }
  drawNames(ox,oy,z,x0,y0,x1,y1);
  if(S.minimap&&frameNo%4===0)drawMini();
}
/* names and speech, shared by both renderers */
function drawNames(ox,oy,z,x0,y0,x1,y1){
  ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineJoin='round';
  if(S.labels){
    for(const k of kingdoms){
      if(!k.alive)continue;
      for(let n=0;n<k.villages.length;n++){
        const v=k.villages[n];
        if(v.x<x0||v.x>x1||v.y<y0||v.y>y1)continue;
        if(n>0&&cam.z<6)continue;
        if(n===0&&cam.z<1.5&&k.villages.length<3)continue;
        const px=ox+(v.x+.5)*z,py=oy+(v.y-2.4)*z;
        if(n===0)label(k.name+(k.wars.size?' \u2694':''),px,py,cam.z<4?11:13,true,k.wars.size?'#ffd9d0':'#fff');
        else label(v.name,px,py,11,false);
      }
    }
  }
  if(bubbles.length){
    const tnow=now();
    for(let n=bubbles.length-1;n>=0;n--){
      const b=bubbles[n];
      if(tnow>b.until||!b.k.alive||!b.k.villages.length){bubbles.splice(n,1);continue;}
      const c=b.k.villages[0];
      if(c.x<x0||c.x>x1||c.y<y0||c.y>y1)continue;
      ctx.textAlign='center';
      drawBubble(b.text,ox+(c.x+.5)*z,oy+(c.y-2.4)*z-(S.labels?16*dpr:0));
    }
  }
}
