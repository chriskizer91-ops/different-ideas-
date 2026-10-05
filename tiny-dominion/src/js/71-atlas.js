/* ================= 71-atlas.js — procedural pixel-art sprite atlas =================
   buildAtlas() -> {w,h,data:Uint8Array RGBA,frames:[{name,x,y,w,h,ax,ay}],idx:{name:i}}
   16 art px per tile, light from top-left, 1px sel-out outline, 3-tone ramps.
   Alpha markers: 255 normal | 254 TEAM gray L (L/160) | 253 FOLIAGE gray L | 252 WINDOW gray L | 251 EMISSIVE rgb.
   Extras beyond the required list:
     fountain, well, statue, lamppost (EMISSIVE lamp), campfire (logs; pair with flame_*),
     tomb, ruin_0..1, crate, banner, oakautumn? (no: autumn comes from the foliage tint)
   Only two top-level names (buildAtlas, atlBuild); every helper lives inside atlBuild's closure. */

function buildAtlas(){return atlBuild();}
function atlBuild(){
/* ---------- colour ---------- */
function rgb(r,g,b){return (0xff000000|(b<<16)|(g<<8)|r)>>>0;}
function hex(h){const n=parseInt(h.slice(1),16);return rgb(n>>16&255,n>>8&255,n&255);}
function teamL(L){return (0xfe000000|(L<<16)|(L<<8)|L)>>>0;}
function folL(L){return (0xfd000000|(L<<16)|(L<<8)|L)>>>0;}
function winL(L){return (0xfc000000|(L<<16)|(L<<8)|L)>>>0;}
function emi(h){return ((hex(h)&0xffffff)|0xfb000000)>>>0;}
function ramp(s){return s.split(' ').map(hex);}
const MT={
  wood:ramp('#3a2616 #5a3a22 #7e5532 #a37444 #c4955e'),
  dwood:ramp('#2a1a12 #43281a #5f3a24 #7d5032 #9a6a44'),
  lwood:ramp('#5e4228 #87623a #ab8452 #c9a46c #e2c48c'),
  plaster:ramp('#8e7c66 #b8a487 #d8c7a6 #eadfc4 #f8f1de'),
  stone:ramp('#45434e #67656e #8a8890 #aaa8aa #cbc8c4'),
  dstone:ramp('#33343e #4c4f5c #686d7a #868c98 #a8aeb6'),
  wstone:ramp('#7e8c94 #a8b6b8 #cdd6d2 #e6ebe4 #fafbf4'),
  brick:ramp('#4e231d #74352a #9a4a34 #b96446 #d5835e'),
  sand:ramp('#8a6a3e #b38a54 #d2ab6e #e6c78c #f5e2b2'),
  thatch:ramp('#5a4120 #866530 #b18c40 #d4b25e #ead08a'),
  hide:ramp('#4e3220 #704a30 #946644 #b4855c #cfa47a'),
  iron:ramp('#25282f #3e434d #5e6672 #84909c #b2bec8'),
  rust:ramp('#3a2018 #5a2e1e #7e4428 #a35e36 #c27c4a'),
  brass:ramp('#4e3612 #7e5a1e #ad832c #d6aa46 #f2d47e'),
  copper:ramp('#2c5248 #3c7262 #529880 #74b89c #a2d8bc'),
  concrete:ramp('#55575e #74767e #95979d #b5b7ba #d2d4d4'),
  white:ramp('#8f9aa4 #b9c2c8 #d9dee0 #eef0ee #fcfcf8'),
  gold:ramp('#6a4810 #9c7216 #cfa22a #ecca4c #fff09a'),
  bronze:ramp('#4a2e16 #74482a #a06c3a #c49052 #e2b878'),
  bone:ramp('#7c7262 #a49a84 #cac2a8 #e4dec8 #f8f4e6'),
  turf:ramp('#2e5a26 #417a30 #5a9a3c #78b84e #9cd468'),
  snow:ramp('#7f95b4 #a8bcd4 #cddcea #e8f0f8 #ffffff'),
  rock:ramp('#3e3a3a #5c5654 #7a736e #9a928a #b8b0a6'),
  red:ramp('#4e1418 #7a1e22 #a8302e #cc4a3a #e8735a'),
  glass:ramp('#1e3a4a #2c5468 #3e7288 #6aa0b4 #a8d4e0'),
  teal:ramp('#1c4a4c #276664 #3a8c84 #5cb4a6 #94dccb'),
  skin:ramp('#8a5434 #b97a52 #e0a678 #f2c49a #fadcbc'),
  green:ramp('#20401e #2f5e28 #4a8034 #68a446 #8cc65c'),
  steel:ramp('#3a4250 #586474 #7c8a9a #a4b2be #d0dae0')
};
const TEAM=[teamL(80),teamL(115),teamL(160),teamL(205),teamL(235)];
const FOL=[folL(78),folL(105),folL(140),folL(175),folL(210)];
const WN=winL(160),WD=winL(118),WL=winL(205);
const INK=hex('#1c1a24'),HOLE=hex('#241a1a');
const OUTC=[22,18,30];

/* ---------- canvas & primitives (current canvas cvs, 1px margin built in) ---------- */
let cvs=null;
function cv(w,h){cvs={w:w+2,h:h+2,p:new Uint32Array((w+2)*(h+2))};return cvs;}
function px(x,y,c){
  if(c==null)return;x=(x|0)+1;y=(y|0)+1;
  if(x<0||y<0||x>=cvs.w||y>=cvs.h)return;cvs.p[y*cvs.w+x]=c;
}
function getPx(x,y){x=(x|0)+1;y=(y|0)+1;return(x<0||y<0||x>=cvs.w||y>=cvs.h)?0:cvs.p[y*cvs.w+x];}
function fillPx(x,y,c){px(x,y,typeof c==='function'?c(x,y):c);}
function rc(x,y,w,h,c){for(let j=0;j<h;j++)for(let i=0;i<w;i++)fillPx(x+i,y+j,c);}
function hl(x,y,l,c){for(let i=0;i<l;i++)fillPx(x+i,y,c);}
function vl(x,y,l,c){for(let i=0;i<l;i++)fillPx(x,y+i,c);}
function ln(x0,y0,x1,y1,c){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;
  for(;;){fillPx(x0,y0,c);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}
}
function ell(cx,cy,rx,ry,c){
  for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){
    const u=(x+.5-cx)/rx,v=(y+.5-cy)/ry;if(u*u+v*v<=1)fillPx(x,y,c);
  }
}
function poly(pts,c){
  let y0=1e9,y1=-1e9;const n=pts.length>>1;
  for(let i=1;i<pts.length;i+=2){y0=Math.min(y0,pts[i]);y1=Math.max(y1,pts[i]);}
  for(let y=Math.floor(y0);y<=Math.ceil(y1);y++){
    const yc=y+.5,xs=[];
    for(let i=0;i<n;i++){
      const ax=pts[i*2],ay=pts[i*2+1],bx=pts[((i+1)%n)*2],by=pts[((i+1)%n)*2+1];
      if((ay<=yc&&by>yc)||(by<=yc&&ay>yc))xs.push(ax+(yc-ay)/(by-ay)*(bx-ax));
    }
    xs.sort((a,b)=>a-b);
    for(let k=0;k+1<xs.length;k+=2)for(let x=Math.ceil(xs[k]-.5);x<=Math.floor(xs[k+1]-.5);x++)fillPx(x,y,c);
  }
}
const BAYM=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function bayer(x,y){return (BAYM[((y&3)<<2)|(x&3)]+.5)/16;}
/* sphere-shaded ellipse: ramp chosen from normal·light with ordered dither */
function sph(cx,cy,rx,ry,m,o){
  o=o||{};const n=m.length,dz=o.dither==null?.55:o.dither,b=o.bias||0,clipY=o.clipY==null?1e9:o.clipY;
  ell(cx,cy,rx,ry,(x,y)=>{
    if(y>clipY)return null;
    const u=(x+.5-cx)/rx,v=(y+.5-cy)/ry,w=Math.sqrt(Math.max(0,1-u*u-v*v));
    let d=-.5*u-.62*v+.6*w;if(o.g)d=d*.55+o.g(x,y)*.45;
    let t=(d+.35+b)/1.25*(n-1)+(bayer(x,y)-.5)*dz;
    return m[Math.max(0,Math.min(n-1,Math.round(t)))];
  });
}
function pmap(x,y,rows,pal){
  for(let j=0;j<rows.length;j++){const r=rows[j];for(let i=0;i<r.length;i++){const c=pal[r[i]];if(c!==undefined)px(x+i,y+j,c);}}
}
function flipH(){const S=cvs,w=S.w;for(let y=0;y<S.h;y++){const o=y*w;for(let x=0;x<w>>1;x++){const t=S.p[o+x];S.p[o+x]=S.p[o+w-1-x];S.p[o+w-1-x]=t;}}}
/* deterministic PRNG */
let seed=1;
function rnd(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
function rint(a,b){return a+Math.floor(rnd()*(b-a+1));}

/* ---------- registry, outline, trim ---------- */
let LIST=[];
function outline(S){
  const w=S.w,h=S.h,p=S.p,o=new Uint32Array(p),ot=hex('#271f2d'),of=hex('#1d2a1b');
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;if(p[i]>>>24)continue;let best=0,bl=1e9;
    for(let k=0;k<4;k++){
      const nx=x+(k===0)-(k===1),ny=y+(k===2)-(k===3);if(nx<0||ny<0||nx>=w||ny>=h)continue;
      const c=p[ny*w+nx],a=c>>>24;if(!a||a===251)continue;let oc;
      if(a===255){const r=c&255,g=c>>8&255,b=c>>16&255;
        oc=rgb(Math.round(r*.27+OUTC[0]*.73),Math.round(g*.27+OUTC[1]*.73),Math.round(b*.27+OUTC[2]*.73));}
      else oc=a===254?ot:a===253?of:INK;
      const l=(oc&255)*3+(oc>>8&255)*6+(oc>>16&255);if(l<bl){bl=l;best=oc;}
    }
    o[i]=best;
  }
  S.p=o;
}
/* add current canvas as frame; (ax,ay) in drawing coords */
function add(name,ax,ay,ol){
  const S=cvs;if(ol!==false)outline(S);
  let x0=S.w,y0=S.h,x1=-1,y1=-1;
  for(let y=0;y<S.h;y++)for(let x=0;x<S.w;x++)if(S.p[y*S.w+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  if(x1<0){x0=y0=0;x1=y1=0;}
  const w=x1-x0+1,h=y1-y0+1,p=new Uint32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)p[y*w+x]=S.p[(y+y0)*S.w+x+x0];
  LIST.push({name,w,h,p,ax:Math.round(ax)+1-x0,ay:Math.round(ay)+1-y0});
}

/* ---------- building kit ---------- */
function rk(m,k){return m[Math.max(0,Math.min(m.length-1,k))];}
/* textured wall: m ramp, tex = plain|brick|stone|plank|log|timber|corr|panel|block ; o.b secondary ramp */
function wall(x,y,w,h,m,tex,o){
  o=o||{};const b=o.b||MT.dwood;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    let k=i===0?3:i>=w-(o.sh||1)?1:2,c=null;
    switch(tex){
      case'brick':{const bd=(j/3|0),off=(bd&1)*2;if(j%3===2)k--;else if((i+off)%4===0)k--;else if(((i+off)>>2)*7+bd*5&4)k+=(k<3?1:0)*0;break;}
      case'stone':{const bd=(j/3|0),off=(bd*3)%5;const jx=(i+off)%5;if(j%3===2||jx===0)k--;else if(j%3===0&&jx===1&&k>=2)k++;break;}
      case'block':{const bd=(j/4|0),off=(bd&1)*3;const jx=(i+off)%6;if(j%4===3||jx===0)k--;else if(j%4===0&&k>=2)k++;break;}
      case'plank':if(i%3===2&&i<w-1)k--;break;
      case'corr':if(i%2===1)k--;break;
      case'log':{const r=j%3;if(r===0&&k>=2)k++;else if(r===2)k--;if((i===0||i===w-1)&&r===1)k=4;break;}
      case'panel':if(j%5===4||i%6===5)k--;break;
      case'timber':{
        const post=i===0||i===w-1||(o.posts&&o.posts.includes(i));
        if(j===0||j===h-1||post||(o.mid!=null&&j===o.mid))c=rk(b,post&&i===0?2:1);
        else if(o.brace){const a=i%o.brace,bj=j-(o.mid!=null&&j>o.mid?o.mid:0);if(a===bj||o.brace-1-a===bj)c=rk(b,1);}
        break;}
    }
    if(o.tint&&(j>=h-1))k--;
    px(x+i,y+j,c!=null?c:rk(m,k));
  }
}
/* cylinder (round wall/tower): shading by column */
function cylK(u,d){let k=2.25-2.1*u;if(u<-.8)k-=.8;return Math.round(Math.min(k,3.6)+(d||0));}
function cyl(x,y,w,h,m,o){
  o=o||{};const crv=o.curve==null?1:o.curve;
  for(let i=0;i<w;i++){
    const u=(i+.5)/w*2-1,bot=Math.round(crv*Math.sqrt(Math.max(0,1-u*u)));
    for(let j=0;j<h+bot;j++){
      let k=cylK(u,(bayer(i,j)-.5)*.4);
      if(o.tex==='stone'&&((j%3===2)||((i+((j/3|0)%2)*2)%4===0)))k--;
      if(o.tex==='plank'&&i%3===2)k--;
      if(o.tex==='brick'&&((j%3===2)||((i+((j/3|0)%2)*2)%4===0)))k--;
      px(x+i,y+j,rk(m,k));
    }
  }
}
function win(x,y,w,h,o){
  o=o||{};
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    if(o.arch&&j===0&&(i===0||i===w-1)&&w>2)continue;
    px(x+i,y+j,j===0&&o.dk!==false?WD:WN);
  }
  if(w>=3&&h>=3&&o.cross!==false&&o.frame!=null){vl(x+(w>>1),y,h,o.frame);if(h>=4)hl(x,y+(h>>1),w,o.frame);}
  if(o.sill!=null)hl(x-(w>1?0:0),y+h,w,o.sill);
  if(o.glint!==false&&h>1)px(x+(o.arch?1:0)+(w>2?w-1-(o.arch?1:0)-1:0),y+h-1,WL);
}
function winGrid(x,y,cols,rows,ww,wh,gx,gy,o){
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)win(x+c*(ww+gx),y+r*(wh+gy),ww,wh,o);
}
function door(x,y,w,h,m,o){
  o=o||{};
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    if(o.arch&&j===0&&(i===0||i===w-1))continue;
    if(o.round&&j<2&&((i===0||i===w-1)&&j===0))continue;
    let c=m?rk(m,(i===0?2:1)+(j===0?-1:0)-(w>2&&i===w-1?1:0)):HOLE;
    if(m&&o.plank&&i%2===1&&i<w-1)c=rk(m,0);
    px(x+i,y+j,c);
  }
  if(o.knob)px(x+w-2,y+(h>>1)+1,o.knob);
}
/* team flag on a pole: pole top at (x,y) */
function flag(x,y,ph,fw,fh,o){
  o=o||{};const pc=o.pole||MT.wood;
  vl(x,y,ph,pc[1]);if(o.lit!==false)px(x,y,pc[3]);
  if(o.knob!==false)px(x,y-1,o.knobc||MT.gold[3]);
  const dir=o.left?-1:1;
  for(let i=0;i<fw;i++)for(let j=0;j<fh;j++){
    const tail=i===fw-1&&fw>3&&j>0&&j<fh-1&&o.tail!==false;if(tail)continue;
    const wv=((i+(o.ph||0))>>1)&1;let k=j===0?3:j===fh-1?1:2;if(wv&&k>1)k--;
    px(x+dir*(i+1),y+j+(o.drop&&i>=fw-2?1:0),TEAM[k]);
  }
}
/* hanging banner from a rod */
function banner(x,y,w,h,o){
  o=o||{};const rod=o.rod||MT.gold;
  hl(x-1,y,w+2,rod[2]);px(x-1,y,rod[3]);
  for(let j=1;j<=h;j++)for(let i=0;i<w;i++){
    if(j===h&&w>2&&i===(w>>1))continue;if(j===h&&w===2&&i===1)continue;
    px(x+i,y+j,TEAM[i===0?3:i===w-1?1:2]);
  }
  if(o.emb!==false&&w>=3&&h>=4)px(x+(w>>1),y+2+(h>4?1:0),o.emb||MT.gold[3]);
}
function chim(x,y,w,h,m,o){
  o=o||{};wall(x,y,w,h,m,o.tex||'plain');hl(x,y,w,rk(m,4));
  if(o.cap)hl(x-1,y,w+2,rk(m,1)),hl(x-1,y-1,w+2,rk(m,3));
  if(o.glow)hl(x+1,y,w-2,emi(o.glow));
  else hl(x+(w>2?1:0),y,w>2?w-2:w,INK);
}
/* crenellations: merlon top row y */
function cren(x,y,w,m,o){
  o=o||{};const mw=o.mw||2,gap=o.gap||1,h=o.h||2;
  for(let i=0;i<w;i++){
    const ph=i%(mw+gap);if(ph>=mw)continue;
    for(let j=0;j<h;j++)px(x+i,y+j,rk(m,ph===0?(j===0?4:3):(i===w-1?1:2)));
  }
}
/* front-gable roof: wall cols x0..x0+w-1, eave row ye (gable base), rise gh, depth D */
function gable(x0,w,ye,gh,D,m,g,o){
  o=o||{};const xc=x0+(w-1)/2,hw=(w-1)/2+1+(o.ov==null?0:o.ov),tex=o.tex,course=o.course==null?3:o.course;
  for(let x=Math.floor(xc-hw);x<=Math.ceil(xc+hw);x++){
    const dx=Math.abs(x-xc);if(dx>hw)continue;
    const yf=Math.round(ye-gh*(1-dx/hw)),side=x<xc-.3?-1:x>xc+.3?1:0;
    for(let y=yf-D;y<yf;y++){
      const row=yf-1-y;let k=side<0?3:side>0?1:2;
      if(course&&row%course===course-1)k--;
      if(tex==='thatch'){const h=((x*73+y*37)^(x*11))%7;if(h===0)k--;else if(h===3&&k<4)k++;}
      if(y===yf-D&&side<0)k=4;if(side===0)k=y===yf-D?4:3;
      if(o.curl&&row>=D-1&&dx>hw-2.5)k--;
      px(x,y,rk(m,k));
    }
    px(x,yf,rk(m,side<0?1:0));
    if(g)for(let y=yf+1;y<=ye;y++)px(x,y,y===yf+1?rk(g,1):rk(g,dx>hw-2.5&&side>0?1:2));
  }
}
/* hip roof: eave row yF spanning xa..xb, ridge row yR, inset ins, back-eave rows bk below ridge */
function hip(xa,xb,yF,yR,ins,m,o){
  o=o||{};const bk=o.bk==null?Math.max(1,Math.round((yF-yR)*.4)):o.bk,course=o.course==null?2:o.course,tex=o.tex;
  poly([xa,yF+1,xa+ins+.5,yR,xa,yR+bk],(x,y)=>rk(m,3));
  poly([xb+1,yF+1,xb+.5-ins,yR,xb+1,yR+bk],(x,y)=>rk(m,1));
  poly([xa+.6,yF+1,xb+.4,yF+1,xb+1-ins,yR,xa+ins,yR],(x,y)=>{
    const row=yF-y;let k=2;if(course&&row%course===course-1)k--;
    if(tex==='thatch'){const h=((x*73+y*37)^(x*11))%7;if(h===0)k--;else if(h===3)k++;}
    if(tex==='slate'&&row%2===0&&(x+row*2)%5===0)k++;
    return rk(m,k);
  });
  hl(xa+ins,yR,xb-xa-2*ins+1,rk(m,4));
  hl(xa,yF,xb-xa+1,rk(m,1));
}
/* cone roof: apex (cx,yA), base centre yB, radius r */
function cone(cx,yA,yB,r,m,o){
  o=o||{};const ry=o.ry==null?r*.3:o.ry,tex=o.tex,cav=o.cav||0;
  for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
    const dx=x+.5-cx,u=dx/r;if(Math.abs(u)>1)continue;
    let f=Math.abs(u);if(cav)f=Math.pow(f,1+cav);
    const yt=Math.round(yA+(yB-yA)*f),yb=Math.round(yB+ry*Math.sqrt(1-u*u));
    for(let y=yt;y<=yb;y++){
      let k=cylK(u*1.05,(bayer(x,y)-.5)*.45);
      if(tex==='thatch'){const h=((x*73+y*31)^(x*7))%6;if(h===0)k--;}
      if(tex==='band'&&(yb-y)%3===0)k--;
      if(y===yb&&o.rim!==false)k--;
      px(x,y,rk(m,k));
    }
  }
}
function dome(cx,yB,rx,ry,m,o){o=o||{};sph(cx,yB+.5,rx,ry,m,{clipY:yB,dither:o.dither,bias:o.bias});}
/* flat roof seen from above: top surface + front lip */
function flat(x,y,w,d,m,o){
  o=o||{};rc(x,y,w,d,rk(m,3));hl(x,y,w,rk(m,4));vl(x,y,d,rk(m,4));
  hl(x,y+d,w,rk(m,1));if(o.lip)hl(x,y+d+1,w,o.lip);
}

/* ---------- packing ---------- */
const GENS=[];
function pack(){
  LIST=[];seed=0x5eed;
  for(const g of GENS)g();
  const W=2048,fr=LIST.slice().sort((a,b)=>b.h-a.h||b.w-a.w);
  let x=0,y=0,sh=0;
  for(const f of fr){if(x+f.w>W){x=0;y+=sh+1;sh=0;}f.x=x;f.y=y;x+=f.w+1;if(f.h>sh)sh=f.h;}
  let H=1;while(H<y+sh)H<<=1;
  const data=new Uint8Array(W*H*4),u=new Uint32Array(data.buffer),frames=[],idx={};
  for(const f of LIST){
    for(let j=0;j<f.h;j++)u.set(f.p.subarray(j*f.w,(j+1)*f.w),(f.y+j)*W+f.x);
    idx[f.name]=frames.length;frames.push({name:f.name,x:f.x,y:f.y,w:f.w,h:f.h,ax:f.ax,ay:f.ay});
  }
  LIST=[];
  return{w:W,h:H,data,frames,idx};
}

/* ---------- helpers for compositions ---------- */
function remap(from,to,test){
  const S=cvs,w=S.w;
  for(let y=0;y<S.h;y++)for(let x=0;x<w;x++){
    const c=S.p[y*w+x];if(!c||!test(x-1,y-1))continue;
    const k=from.indexOf(c);if(k>=0)S.p[y*w+x]=to[Math.min(to.length-1,k)];
  }
}
function vine(x,y,len,sd){seed=sd;for(let j=0;j<len;j++){const xx=x+(rnd()<.4?1:0)-(rnd()<.2?1:0);px(xx,y+j,FOL[rint(1,3)]);if(rnd()<.3)px(xx+1,y+j,FOL[3]);}}
function skull(x,y){const b=MT.bone;rc(x,y,3,2,b[3]);px(x+1,y+2,b[2]);px(x,y+1,INK);px(x+2,y+1,INK);px(x,y,b[4]);}
function tusk(x,y,dir,h){const b=MT.bone;for(let j=0;j<h;j++)px(x+(j<h-2?0:dir*(j-h+3)),y-j,b[j===h-1?4:j>h/2?3:2]);}
function spike(x,y,h,m){m=m||MT.iron;vl(x,y,h,m[2]);px(x,y,m[4]);}
/* horizontal stripe of team paint replacing a ramp */
function paint(m,y0,y1){remap(m,TEAM,(x,y)=>y>=y0&&y<=y1);}

/* ---------- houses ---------- */
function house(r,t,v){
  const M=MT,TM=TEAM,FO=FOL,H=t<2?26:t<3?30:t<4?34:40,B=H-1;cv(28,H);
  const name='house_'+r+'_'+t+'_'+v;
  const k=r+t+v;
  switch(k){
  /* ----- tier 0 ----- */
  case'h00':{ // round wattle hut, thatch cone
    cyl(8,B-6,12,6,M.lwood,{tex:'plank'});
    door(13,B-5,3,5,null);rc(13,B-4,1,4,TM[3]);rc(14,B-4,1,3,TM[2]);
    cone(14,B-20,B-8,9.5,M.thatch,{ry:2.6,tex:'thatch'});
    ln(12,B-22,16,B-18,M.wood[2]);ln(16,B-22,12,B-18,M.wood[1]);
    break;}
  case'h01':{ // A-frame thatch lodge
    wall(8,B-4,13,5,M.wood,'log');
    gable(8,13,B-5,10,4,M.thatch,M.lwood,{tex:'thatch',course:0});
    door(12,B-6,4,7,null,{arch:true});rc(12,B-5,1,6,M.wood[3]);
    px(14,B-10,WN);flag(14,B-22,4,4,2,{knob:false});
    break;}
  case'e00':{ // leaf dome hut
    dome(14,B,8.5,13,FO);
    rc(11,B-1,7,2,M.lwood[1]);
    door(12,B-7,5,8,M.lwood,{arch:true});door(13,B-6,3,7,null,{arch:true});rc(13,B-4,1,5,TM[3]);rc(14,B-4,2,5,TM[1]);
    for(const[x,y]of[[8,B-6],[19,B-8],[10,B-10],[17,B-3]])px(x,y,hex('#f2a6c8'));px(15,B-12,hex('#fff2c0'));
    break;}
  case'e01':{ // treehouse
    sph(9,B-16,5,4,FO);sph(20,B-15,5,4,FO);sph(14,B-20,6,4,FO);
    cyl(12,B-11,4,11,M.wood,{curve:0});px(11,B,M.wood[2]);px(16,B,M.wood[1]);px(10,B,M.wood[1]);px(17,B,M.wood[0]);
    ln(9,B-11,12,B-7,M.wood[1]);ln(19,B-11,16,B-7,M.wood[0]);
    hl(7,B-12,15,M.lwood[3]);hl(7,B-11,15,M.lwood[1]);
    wall(9,B-17,10,5,M.lwood,'plank');door(13,B-16,2,4,null);rc(13,B-16,1,4,TM[3]);rc(14,B-16,1,4,TM[2]);
    cone(14,B-24,B-17,6.5,FO,{ry:1.6});
    break;}
  case'd00':{ // stone mound with turf
    sph(14,B+1,9.5,10,M.rock,{clipY:B});
    remap(M.rock,M.turf,(x,y)=>y<B-7+Math.abs(x-14)*.35);
    door(11,B-6,6,7,M.stone);door(12,B-5,4,6,M.wood,{arch:true,plank:true,knob:M.brass[3]});
    hl(11,B-7,6,M.stone[3]);banner(19,B-7,2,4);
    chim(18,B-12,2,3,M.stone);
    break;}
  case'd01':{ // dry-stone hut with turf roof
    wall(8,B-6,13,7,M.stone,'stone');
    hip(7,21,B-7,B-14,3,M.turf,{course:0,tex:'thatch'});
    door(12,B-5,4,6,M.wood,{plank:true});hl(11,B-6,6,M.dstone[3]);
    banner(16,B-6,3,4);win(9,B-4,2,2,{glint:false});
    break;}
  case'o00':{ // hide tent
    ln(14,B-15,10,B-21,M.dwood[2]);ln(14,B-15,18,B-21,M.dwood[1]);ln(14,B-15,13,B-22,M.dwood[3]);
    cone(14,B-16,B-2,9,M.hide,{ry:2.2});
    ln(14,B-16,9,B-1,M.hide[1]);ln(14,B-16,18,B,M.hide[0]);
    paint(M.hide,B-8,B-7);
    poly([14,B-10,11.5,B+1,16.5,B+1],HOLE);ln(14,B-10,11,B,M.hide[3]);ln(14,B-10,17,B,M.hide[1]);
    tusk(9,B,1,6);tusk(19,B,-1,6);
    break;}
  case'o01':{ // log lean-to, hide roof, skull
    wall(8,B-6,13,7,M.dwood,'log');
    hip(7,21,B-7,B-14,2,M.hide,{course:0});paint(M.hide,B-10,B-10);
    door(12,B-5,4,6,null);rc(12,B-5,4,1,M.hide[3]);
    skull(13,B-17);spike(7,B-12,4,M.dwood);spike(21,B-12,4,M.dwood);
    break;}
  /* ----- tier 1 ----- */
  case'h10':{
    wall(8,B-7,13,8,M.plaster,'plain');vl(8,B-7,8,M.dwood[2]);vl(20,B-7,8,M.dwood[1]);hl(8,B,13,M.stone[1]);
    gable(8,13,B-8,6,5,TM,M.plaster);hl(8,B-7,13,M.plaster[1]);
    win(14,B-11,1,2,{glint:false});door(13,B-5,3,6,M.wood,{plank:true});
    win(10,B-5,2,2,{sill:M.dwood[2]});win(17,B-5,2,2,{sill:M.dwood[1]});
    break;}
  case'h11':{
    wall(7,B-7,15,8,M.sand,'block');hl(7,B,15,M.sand[1]);
    hip(6,22,B-8,B-15,4,TM,{bk:2});hl(7,B-7,15,M.sand[1]);
    door(9,B-5,3,6,M.wood,{plank:true});hl(8,B-6,5,M.dwood[2]);
    win(14,B-5,2,2,{sill:M.sand[3]});win(18,B-5,2,2,{sill:M.sand[3]});
    break;}
  case'e10':{
    cyl(8,B-8,13,8,M.wstone,{tex:'stone'});
    dome(14.5,B-8,8,8,TM);px(14,B-17,FO[3]);px(15,B-17,FO[2]);px(14,B-18,FO[4]);
    door(13,B-6,3,7,M.lwood,{arch:true});win(9,B-5,2,2,{arch:false,glint:false});win(18,B-5,2,2,{glint:false});
    vine(8,B-7,6,3);vine(20,B-8,5,5);
    break;}
  case'e11':{
    wall(8,B-7,13,8,M.wstone,'stone');
    cone(14.5,B-23,B-8,7.8,TM,{cav:.45,ry:1.8});px(14,B-24,M.gold[3]);
    door(12,B-6,4,7,M.lwood,{arch:true});win(9,B-5,2,3,{arch:true});win(18,B-5,2,3,{arch:true});
    vine(20,B-6,6,9);
    break;}
  case'd10':{
    wall(7,B-7,15,8,M.dstone,'block');
    flat(6,B-12,17,3,M.dstone);hl(6,B-9,17,TM[2]);hl(6,B-8,17,TM[1]);
    chim(18,B-16,3,4,M.stone);
    door(11,B-5,5,6,M.wood,{plank:true});hl(11,B-3,5,M.iron[2]);hl(10,B-6,7,M.stone[3]);
    win(8,B-5,2,2);win(18,B-5,2,2);
    break;}
  case'd11':{
    wall(7,B-7,15,8,M.dstone,'block');
    hip(6,22,B-8,B-13,4,TM,{bk:1});hl(7,B-7,15,M.dstone[0]);
    door(12,B-5,5,6,M.wood,{plank:true,knob:M.brass[3]});hl(11,B-6,7,M.stone[4]);px(11,B-5,M.stone[3]);px(17,B-5,M.stone[2]);
    win(8,B-5,2,2);chim(8,B-16,3,4,M.dstone);
    break;}
  case'o10':{
    wall(8,B-7,13,8,M.dwood,'log');
    hip(7,21,B-8,B-14,2,TM,{course:0});ln(10,B-14,10,B-8,TM[1]);ln(18,B-14,18,B-8,TM[0]);
    tusk(8,B-14,-1,5);tusk(20,B-14,1,5);
    door(12,B-5,4,6,null);rc(12,B-5,4,2,M.hide[2]);skull(13,B-11);
    break;}
  case'o11':{
    cyl(9,B-7,11,7,M.dwood,{tex:'plank'});
    spike(13,B-25,6,M.iron);spike(15,B-24,5,M.iron);ln(11,B-23,13,B-19,M.dwood[2]);
    cone(14.5,B-20,B-8,8,TM,{ry:2.2});ln(14,B-20,9,B-7,TM[0]);
    door(13,B-4,3,5,null);skull(13,B-11);tusk(11,B,1,5);tusk(18,B,-1,5);
    break;}
  /* ----- tier 2 ----- */
  case'h20':{
    wall(8,B-10,13,11,M.plaster,'timber',{b:M.dwood,posts:[6],mid:5,brace:6});
    hl(8,B,13,M.stone[1]);
    chim(18,B-23,3,6,M.brick,{tex:'brick'});
    gable(8,13,B-11,8,6,TM,M.plaster);hl(8,B-10,13,M.dwood[0]);
    win(13,B-16,3,3,{frame:M.dwood[1]});
    win(10,B-8,2,2,{sill:M.dwood[2]});win(17,B-8,2,2,{sill:M.dwood[1]});
    door(13,B-4,3,5,M.wood,{plank:true});win(10,B-3,2,2);
    break;}
  case'h21':{
    wall(7,B-4,15,5,M.stone,'stone');wall(7,B-10,15,6,M.plaster,'timber',{b:M.dwood,posts:[5,9]});
    chim(9,B-22,3,5,M.stone);
    hip(6,22,B-11,B-19,4,TM,{bk:2});hl(7,B-10,15,M.dwood[0]);
    wall(13,B-17,4,4,M.plaster,'plain');cone(14.5,B-20,B-17,3,TM,{ry:.5});win(14,B-16,2,2);
    win(9,B-8,2,3,{frame:M.dwood[1]});win(18,B-8,2,3);door(13,B-4,3,5,M.wood,{plank:true});win(9,B-3,2,2);win(18,B-3,2,2);
    break;}
  case'e20':{
    wall(8,B-9,13,10,M.wstone,'stone');
    cone(14.5,B-27,B-10,8.2,TM,{cav:.55,ry:2});px(14,B-29,M.gold[4]);px(14,B-30,M.gold[3]);
    hl(7,B-9,15,M.wstone[4]);
    door(12,B-7,5,8,M.wstone,{arch:true});door(13,B-6,3,7,M.lwood,{arch:true});
    win(9,B-7,2,4,{arch:true});win(18,B-7,2,4,{arch:true});win(14,B-16,2,3,{arch:true});
    vine(8,B-8,7,11);
    break;}
  case'e21':{
    cyl(9,B-12,11,12,M.wstone,{tex:'stone'});
    cone(14.5,B-29,B-13,7.2,TM,{cav:.5,ry:1.6});px(14,B-31,M.gold[3]);
    win(11,B-10,2,3,{arch:true});win(16,B-10,2,3,{arch:true});door(13,B-5,3,6,M.lwood,{arch:true});
    sph(21,B-6,3.5,3,FO);sph(7,B-4,3,2.5,FO);vine(18,B-11,9,21);
    break;}
  case'd20':{
    wall(6,B-8,17,9,M.dstone,'block');
    chim(17,B-19,4,6,M.stone,{cap:true,glow:'#ff8a3a'});
    hip(5,23,B-9,B-15,3,TM,{bk:1,tex:'slate'});hl(6,B-8,17,M.dstone[0]);
    door(11,B-6,6,7,M.dstone);door(12,B-5,4,6,M.wood,{plank:true,knob:M.brass[3]});hl(12,B-3,4,M.iron[1]);
    win(7,B-6,3,3,{frame:M.iron[1]});win(19,B-6,3,3,{frame:M.iron[1]});
    break;}
  case'd21':{
    wall(7,B-11,15,12,M.dstone,'block');cren(7,B-13,15,M.dstone,{mw:2,gap:1});
    flat(8,B-12,13,1,M.dstone);
    banner(10,B-9,3,6);banner(16,B-9,3,6);
    door(13,B-4,3,5,M.wood,{plank:true});win(14,B-10,1,2,{glint:false});
    break;}
  case'o20':{
    wall(6,B-8,17,9,M.dwood,'plank');hl(6,B-4,17,M.dwood[1]);
    hip(5,23,B-9,B-15,3,TM,{bk:1,course:3});
    for(let x=9;x<=19;x+=3)spike(x,B-18,3,M.iron);
    door(12,B-6,5,7,null);rc(12,B-6,5,1,M.dwood[3]);skull(13,B-9);
    tusk(10,B,1,6);tusk(18,B,-1,6);win(8,B-6,2,2);win(20,B-6,2,2);
    break;}
  case'o21':{
    for(let x=6;x<=22;x+=2){const h=10+((x*7)%3);vl(x,B-h,h+1,M.dwood[x<10?3:x>18?1:2]);vl(x+1,B-h+1,h,M.dwood[1]);px(x,B-h-1,M.dwood[4]);}
    cone(14.5,B-24,B-12,7.5,TM,{ry:2});tusk(11,B-20,-1,5);tusk(18,B-20,1,5);
    door(12,B-6,5,7,null);skull(13,B-10);rc(12,B-6,5,1,M.iron[2]);
    break;}
  /* ----- tier 3 ----- */
  case'h30':{
    wall(7,B-14,15,15,M.brick,'brick');hl(7,B-7,15,M.stone[3]);hl(7,B,15,M.stone[1]);
    chim(8,B-26,3,6,M.brick,{tex:'brick',cap:true});chim(18,B-26,3,6,M.brick,{tex:'brick',cap:true});
    hip(6,22,B-15,B-22,3,TM,{bk:2,tex:'slate'});hl(7,B-14,15,M.brick[0]);
    for(const x of[9,13,17]){win(x,B-12,2,3,{sill:M.stone[4]});px(x,B-13,M.stone[3]);px(x+1,B-13,M.stone[3]);}
    win(9,B-5,2,3,{sill:M.stone[4]});win(17,B-5,2,3,{sill:M.stone[4]});
    door(13,B-5,3,5,M.dwood,{knob:M.brass[3]});hl(12,B,5,M.stone[3]);hl(13,B-6,3,M.stone[3]);
    break;}
  case'h31':{
    wall(7,B-11,15,12,M.brick,'brick');hl(7,B,15,M.stone[1]);
    chim(17,B-27,3,5,M.brick,{tex:'brick',cap:true});
    rc(6,B-20,17,8,TM[2]);hip(6,22,B-12,B-20,1,TM,{bk:1,tex:'slate'});hl(6,B-21,17,M.iron[2]);
    for(const x of[8,13,18]){wall(x,B-19,4,5,M.plaster,'plain');cone(x+1.5,B-22,B-19,2.6,TM,{ry:.4});win(x+1,B-18,2,3);}
    hl(7,B-11,15,M.brick[0]);
    win(8,B-9,3,4,{frame:M.white[3],sill:M.white[3]});win(18,B-9,3,4,{frame:M.white[3],sill:M.white[3]});
    door(13,B-6,3,7,M.dwood,{knob:M.brass[3]});rc(12,B-7,5,1,M.white[3]);win(13,B-9,3,2,{glint:false});
    break;}
  case'e30':{
    wall(7,B-12,15,13,M.wstone,'stone');rc(7,B-12,15,1,M.copper[3]);
    cone(14.5,B-29,B-13,8.8,TM,{cav:.55,ry:2});px(14,B-31,M.copper[4]);vl(14,B-33,2,M.copper[3]);
    for(const x of[9,17]){win(x,B-10,3,5,{arch:true,frame:M.copper[3]});}
    door(12,B-6,5,7,M.copper,{arch:true});door(13,B-5,3,6,null,{arch:true});px(14,B-4,emi('#ffd27a'));
    vine(7,B-11,8,31);win(13,B-19,3,3,{arch:true,cross:false});
    break;}
  case'e31':{
    wall(7,B-4,15,5,M.wstone,'stone');
    rc(7,B-15,15,11,M.white[3]);winGrid(8,B-14,4,2,2,4,1,1,{dk:false});
    for(const x of[7,10,13,16,19,21])vl(x,B-15,11,M.white[x>17?2:4]);
    dome(14.5,B-15,8.5,7,M.glass);remap(M.glass,[WD,WN,WN,WL,WL],()=>true);
    ln(14,B-22,14,B-15,M.white[4]);ln(10,B-20,8,B-15,M.white[4]);ln(19,B-20,21,B-15,M.white[2]);
    hl(6,B-15,17,TM[3]);hl(6,B-14,17,TM[1]);
    door(13,B-4,3,5,M.copper,{arch:true});sph(9,B-1,3,2.5,FO);sph(20,B-1,3,2.5,FO);
    break;}
  case'd30':{
    wall(6,B-11,17,12,M.dstone,'block');
    chim(18,B-26,4,9,M.copper,{cap:true});px(18,B-22,M.brass[3]);hl(18,B-20,4,M.brass[2]);
    hip(5,23,B-12,B-19,3,TM,{bk:2,tex:'slate'});hl(6,B-11,17,M.dstone[0]);
    vl(8,B-10,11,M.brass[3]);vl(9,B-10,11,M.brass[1]);hl(8,B-6,4,M.brass[2]);px(10,B-6,M.brass[4]);px(8,B-3,M.brass[4]);
    door(12,B-6,5,7,M.iron,{plank:true,knob:M.brass[4]});rc(12,B-7,5,1,M.brass[3]);
    win(18,B-8,3,3,{frame:M.brass[2],sill:M.brass[3]});win(12,B-10,5,2,{glint:false});
    break;}
  case'd31':{
    wall(5,B-10,19,11,M.dstone,'block');
    chim(7,B-22,3,8,M.brick,{tex:'brick',cap:true,glow:'#ff9a40'});
    hip(4,24,B-11,B-16,3,TM,{bk:1});hl(5,B-10,19,M.dstone[0]);
    ell(17.5,B-5,4,4,M.brass[1]);ell(17.5,B-5,3,3,M.brass[3]);ell(17.5,B-5,1.4,1.4,M.brass[1]);for(const[a,b]of[[17,B-10],[13,B-6],[21,B-6],[17,B-2]])px(a,b,M.brass[2]);
    rc(7,B-6,5,4,M.iron[1]);rc(8,B-5,3,3,emi('#ff7a2e'));px(9,B-5,emi('#ffd060'));
    break;}
  case'o30':{
    wall(7,B-9,15,10,M.rust,'corr');paint(M.rust,B-5,B-4);
    chim(18,B-18,2,7,M.iron);
    hip(6,22,B-10,B-15,2,M.iron,{bk:1,course:0});remap(M.iron,M.rust,(x,y)=>x<12&&y>B-14);
    door(11,B-6,4,7,M.iron,{plank:true});win(17,B-7,3,2,{glint:false});spike(7,B-12,3);spike(21,B-12,3);skull(12,B-9);
    break;}
  case'o31':{
    wall(6,B-6,17,7,M.rust,'corr');wall(8,B-13,13,7,M.iron,'panel');rc(13,B-12,5,3,TM[2]);hl(13,B-12,5,TM[3]);
    flat(7,B-15,15,2,M.rust);spike(8,B-18,3);spike(13,B-19,4);spike(19,B-18,3);
    win(9,B-11,2,2);win(18,B-11,2,2);door(10,B-5,4,6,null);rc(17,B-4,4,4,TM[1]);hl(17,B-4,4,TM[3]);
    chim(5,B-12,2,9,M.iron);
    break;}
  /* ----- tier 4 ----- */
  case'h40':{
    wall(5,B-9,12,10,M.white,'plain');wall(17,B-5,6,6,M.concrete,'plain');rc(18,B-4,4,5,M.concrete[1]);for(let y=B-3;y<=B;y+=2)hl(18,y,4,M.concrete[0]);
    flat(4,B-12,14,2,M.concrete);hl(4,B-10,14,TM[2]);hl(17,B-6,6,TM[1]);
    win(6,B-7,6,4,{frame:M.white[4],cross:false});win(13,B-8,3,3);door(13,B-4,3,5,M.wood);
    rc(6,B-14,6,2,M.glass[1]);hl(6,B-14,6,M.glass[3]);
    break;}
  case'h41':{
    wall(6,B-20,17,21,M.concrete,'plain');flat(5,B-22,19,2,M.concrete);
    for(let f=0;f<4;f++){const y=B-19+f*5;winGrid(8,y,3,1,3,3,2,0);hl(6,y+3,17,TM[f%2?1:2]);hl(6,y+4,17,M.concrete[1]);}
    rc(12,B-4,5,5,M.glass[1]);rc(13,B-3,3,4,WN);
    break;}
  case'e40':{
    rc(7,B-2,15,3,M.white[2]);hl(7,B-2,15,M.white[4]);
    dome(14.5,B-2,8.5,11,M.glass);remap(M.glass,[WD,WN,WN,WL,WL],()=>true);
    for(const a of[-.75,-.35,0,.35,.75]){for(let j=0;j<12;j++){const yy=B-2-j,fr=Math.sqrt(Math.max(0,1-(j/11)**2));px(Math.round(14.5+a*8.5*fr-.5),yy,M.white[a<0?4:3]);}}
    hl(10,B-7,10,M.white[4]);door(13,B-4,3,4,M.white,{arch:true});sph(22,B-3,3,4,FO);sph(5,B-2,2.5,3,FO);
    break;}
  case'e41':{
    cyl(10,B-18,9,19,M.white,{curve:1});
    for(let f=0;f<3;f++){const y=B-16+f*6;hl(11,y,7,WN);hl(11,y+1,7,WN);px(16,y+1,WL);hl(9,y+3,11,TM[f===1?3:2]);}
    dome(14.5,B-19,5.5,4,M.white);vl(14,B-26,4,M.white[4]);px(14,B-27,emi('#9ff0ff'));
    sph(8,B-3,3,3.5,FO);sph(21,B-2,2.5,3,FO);door(13,B-3,3,4,null,{arch:true});
    break;}
  case'd40':{
    wall(6,B-11,17,12,M.brass,'panel');rc(6,B-3,17,4,M.dstone[2]);hl(6,B-3,17,M.dstone[3]);
    flat(5,B-14,19,2,M.iron);chim(19,B-18,3,4,M.iron,{cap:true});
    winGrid(8,B-9,3,1,3,3,2,0,{frame:M.brass[1]});
    ell(11,B-11,2.5,2.5,M.iron[2]);px(11,B-12,M.iron[4]);door(16,B-3,4,4,M.iron,{plank:true});
    for(let x=7;x<22;x+=3)px(x,B-4,M.brass[4]);
    break;}
  case'd41':{
    wall(4,B-8,21,9,M.dstone,'block');wall(7,B-15,15,7,M.dstone,'block');wall(10,B-21,9,6,M.brass,'panel');
    hl(4,B-8,21,M.brass[3]);hl(7,B-15,15,M.brass[3]);hl(10,B-21,9,M.brass[4]);
    winGrid(6,B-6,5,1,2,3,2,0);winGrid(9,B-13,4,1,2,3,1,0);winGrid(11,B-19,3,1,2,3,1,0);
    rc(13,B-3,3,4,M.iron[1]);hl(4,B-7,21,TM[2]);
    break;}
  case'o40':{
    wall(5,B-9,19,10,M.iron,'panel');remap(M.iron,M.rust,(x,y)=>((x*5+y*3)%7)<2);
    for(let x=5;x<24;x++)if(((x+0)>>1)%2===0)px(x,B-9,TM[2]);else px(x,B-9,INK);
    flat(4,B-12,21,2,M.rust);spike(6,B-15,3);spike(22,B-15,3);chim(16,B-18,2,6,M.rust);
    win(8,B-6,4,1,{glint:false});win(17,B-6,4,1,{glint:false});door(12,B-5,5,6,M.rust,{plank:true});
    break;}
  case'o41':{
    const cont=(x,y,w,m)=>{wall(x,y,w,5,m,'corr');hl(x,y,w,rk(m,3));hl(x,y+4,w,rk(m,0));};
    cont(5,B-4,10,M.rust);cont(15,B-4,8,TEAM);cont(7,B-9,14,TEAM);cont(5,B-14,9,M.rust);cont(14,B-14,8,M.iron);
    win(8,B-12,2,2);win(17,B-12,2,2);win(10,B-7,3,1,{glint:false});door(8,B-3,3,4,null);
    chim(19,B-20,2,6,M.iron);spike(6,B-17,3);
    break;}
  }
  add(name,14,B);
}
GENS.push(()=>{for(const r of'hedo')for(let t=0;t<5;t++)for(let v=0;v<2;v++)house(r,t,v);});

/* ---------- tall city-core buildings ---------- */
const WLV=[70,118,150,160,160,175,190];
function facade(x,y,w,h,m,o){
  o=o||{};wall(x,y,w,h,m,o.tex||'plain',{sh:o.sh==null?2:o.sh});
  const ww=o.ww||2,wh=o.wh||2,gx=o.gx==null?1:o.gx,gy=o.gy==null?1:o.gy;
  for(let yy=y+(o.top==null?1:o.top);yy+wh<=y+h-(o.bot==null?1:o.bot);yy+=wh+gy){
    for(let xx=x+(o.l==null?1:o.l);xx+ww<=x+w-(o.r==null?1:o.r);xx+=ww+gx){
      const L=WLV[rint(0,WLV.length-1)];
      for(let j=0;j<wh;j++)for(let i=0;i<ww;i++)px(xx+i,yy+j,winL(Math.max(40,L-(xx+i>=x+w-3?30:0))));
      if(o.sill!=null)hl(xx,yy+wh,ww,o.sill);
    }
  }
}
/* sections from the ground up: [w,h,ramp,opts]; returns top y */
function stack(secs,cx){
  let y=cvs.h-3;
  for(const[w,h,m,o]of secs){
    const x=Math.round(cx-w/2);facade(x,y-h+1,w,h,m,o);
    hl(x,y-h,w,rk(m,4));hl(x,y-h-1,w,rk(m,3));if(o&&o.trim!=null)hl(x,y-h+1,w,o.trim);
    y-=h+1;
  }
  return y;
}
function antenna(x,y,h){vl(x,y-h,h+1,MT.iron[2]);px(x,y-h-1,emi('#ff4040'));px(x-1,y-2,MT.iron[1]);px(x+1,y-2,MT.iron[3]);}
function tall(r,t,v){
  const M=MT,TM=TEAM,FO=FOL,H=t===3?40:66,B=H-1,cx=14;cv(28,H);seed=r.charCodeAt(0)*31+t*7+v;
  const k=r+t+v;let y;
  switch(k){
  case'h30':
    y=stack([[16,20,M.brick,{tex:'brick',ww:2,wh:3,gx:3,gy:3,l:2,top:7,sill:M.stone[4]}]],cx);
    rc(6,B-5,16,1,TM[3]);for(let x=6;x<22;x++)px(x,B-4,TM[(x>>1)%2?3:1]);win(7,B-3,5,3,{cross:false});win(16,B-3,5,3,{cross:false});door(13,B-3,2,4,M.dwood);
    chim(8,y-7,3,6,M.brick,{tex:'brick',cap:true});
    rc(5,y-5,18,6,TM[2]);hip(5,22,y,y-6,1,TM,{bk:1,tex:'slate'});
    for(const x of[8,13,18]){wall(x-1,y-4,4,4,M.plaster,'plain');cone(x+.5,y-7,y-4,2.6,TM,{ry:.4});win(x,y-3,2,2);}
    break;
  case'h31':
    y=stack([[16,26,M.brick,{tex:'brick',ww:2,wh:3,gx:2,gy:3,l:2,top:2,sill:M.stone[4]}]],cx);
    rc(5,y-1,18,2,M.stone[3]);hl(5,y+1,18,M.stone[1]);
    vl(18,y+3,22,M.iron[1]);for(let j=0;j<4;j++)ln(17,y+5+j*6,21,y+8+j*6,M.iron[2]);
    rc(9,y-8,5,5,M.wood[2]);rc(9,y-8,5,1,M.wood[3]);cone(11.5,y-11,y-8,3.4,M.wood,{ry:.5});vl(9,y-3,3,M.iron[1]);vl(13,y-3,3,M.iron[1]);
    rc(6,B-3,16,4,M.dwood[2]);win(7,B-3,4,3,{cross:false});win(16,B-3,4,3,{cross:false});rc(6,B-5,16,2,TM[2]);hl(6,B-5,16,TM[3]);
    break;
  case'h32':
    y=stack([[16,30,M.sand,{tex:'block',ww:2,wh:3,gx:2,gy:3,l:2,top:2,sill:M.sand[4]}]],cx);
    rc(5,y-1,18,2,M.sand[4]);cyl(5,y-6,6,7,M.sand,{curve:1});win(7,y-4,2,3,{arch:true});dome(8,y-6,3.5,4,TM);vl(8,y-12,3,M.gold[3]);
    cren(12,y-2,10,M.sand);flag(18,y-10,8,5,3);
    rc(6,B-4,16,5,M.dwood[1]);win(7,B-3,3,4,{cross:false});win(17,B-3,3,4,{cross:false});door(12,B-3,3,4,M.dwood);rc(6,B-5,16,1,TM[3]);
    break;
  case'e30':
    y=stack([[15,20,M.wstone,{tex:'stone',ww:2,wh:4,gx:3,gy:3,l:2,top:3,sill:M.copper[3]}]],cx);
    cone(14,y-14,y,8.6,TM,{cav:.55,ry:1.8});vl(13,y-17,3,M.copper[3]);px(13,y-18,M.copper[4]);vine(7,y+3,12,7);
    door(12,B-5,4,6,M.copper,{arch:true});
    break;
  case'e31':
    y=stack([[12,28,M.wstone,{tex:'stone',ww:2,wh:4,gx:2,gy:2,l:2,top:2,sill:M.copper[3]}]],cx);
    cone(14,y-17,y+1,6.8,TM,{cav:.6,ry:1.4});vl(13,y-21,3,M.gold[3]);sph(21,B-3,3.5,4,FO);sph(7,B-2,3,3,FO);
    rc(8,y+3,12,1,M.copper[3]);
    break;
  case'e32':
    y=stack([[16,22,M.wstone,{tex:'stone',ww:3,wh:5,gx:2,gy:2,l:2,top:2}],[10,8,M.white,{ww:2,wh:3,gx:2,l:2,top:2}]],cx);
    for(const x of[6,21])cone(x+.5,y+3,y+12,2.4,TM,{cav:.5,ry:.6});
    cone(14,y-10,y+1,5.2,TM,{cav:.6,ry:1.1});px(13,y-11,emi('#bff8ff'));vine(20,B-14,12,19);
    break;
  case'd30':
    y=stack([[18,22,M.dstone,{tex:'block',ww:3,wh:2,gx:2,gy:4,l:2,top:3}]],cx);
    cren(5,y-1,18,M.dstone);chim(8,y-6,3,6,M.brass,{cap:true,glow:'#ff9a40'});chim(17,y-8,3,8,M.copper,{cap:true});
    vl(20,y+3,20,M.brass[3]);vl(21,y+3,20,M.brass[1]);rc(11,B-5,6,6,M.iron[1]);rc(12,B-4,4,5,M.wood[2]);banner(7,B-14,3,6);
    break;
  case'd31':
    y=stack([[20,10,M.dstone,{tex:'block',ww:2,wh:2,gx:2,gy:2,l:2,top:2}],[15,9,M.dstone,{tex:'block',ww:2,wh:2,gx:2,gy:2,l:2}],[10,8,M.brass,{tex:'panel',ww:2,wh:2,gx:2,l:2}]],cx);
    dome(14,y,4.5,3.5,M.copper);vl(14,y-6,3,M.brass[3]);rc(12,B-4,4,5,M.iron[1]);hl(4,B-10,20,TM[2]);hl(6,B-20,16,TM[2]);
    break;
  case'd32':
    y=stack([[16,32,M.dstone,{tex:'block',ww:2,wh:3,gx:3,gy:3,l:2,top:2}]],cx);
    cren(6,y-1,16,M.dstone);dome(14,y,5,5,M.brass);vl(14,y-8,3,M.brass[4]);chim(7,y-5,2,5,M.iron,{glow:'#ff8030'});chim(19,y-6,2,6,M.iron,{glow:'#ff8030'});
    banner(8,B-18,3,7);banner(17,B-18,3,7);rc(12,B-5,4,6,M.wood[2]);
    break;
  case'o30':
    y=stack([[16,12,M.rust,{tex:'corr',ww:2,wh:2,gx:3,gy:3,l:2,top:2}],[12,9,M.iron,{tex:'panel',ww:2,wh:2,gx:2,gy:2,l:2}]],cx);
    chim(18,y-4,3,12,M.iron);spike(9,y-3,3);spike(12,y-2,2);rc(8,B-15,12,2,TM[2]);hl(8,B-15,12,TM[3]);door(11,B-5,5,6,null);
    break;
  case'o31':
    y=stack([[16,26,M.iron,{tex:'panel',ww:2,wh:2,gx:3,gy:3,l:2,top:2}]],cx);remap(M.iron,M.rust,(x,yy)=>((x*7+yy*3)%11)<3);
    chim(8,y-6,3,8,M.rust);chim(18,y-8,3,10,M.rust);for(let x=7;x<22;x+=3)spike(x,y-2,2);
    banner(6,B-20,3,8);banner(19,B-20,3,8);rc(11,B-6,6,7,HOLE);skull(13,B-9);
    break;
  case'o32':
    y=stack([[18,14,M.rust,{tex:'corr',ww:3,wh:2,gx:2,gy:3,l:2,top:2}],[14,10,M.iron,{tex:'panel',ww:2,wh:2,gx:2,gy:2,l:2}],[9,7,M.iron,{ww:1,wh:2,gx:2,l:2}]],cx);
    chim(7,y+6,3,12,M.iron);chim(19,y+4,3,14,M.rust);for(let x=10;x<19;x+=3)spike(x,y-3,3);px(13,y+3,emi('#ff3a2a'));px(15,y+3,emi('#ff3a2a'));
    rc(8,B-16,12,2,TM[2]);door(11,B-5,5,6,null);
    break;
  /* ---- tier 4 skyscrapers ---- */
  case'h40':
    y=stack([[16,34,M.concrete,{ww:2,wh:2,gx:1,gy:1,l:2,top:4}]],cx);
    rc(6,B-3,16,4,M.glass[2]);win(7,B-3,14,3,{cross:false,glint:false});rc(6,B-4,16,1,TM[3]);
    rc(8,y-4,4,4,M.wood[1]);hl(8,y-4,4,M.wood[3]);rc(15,y-2,5,2,M.concrete[1]);antenna(19,y-2,4);
    break;
  case'h41':
    y=stack([[16,46,M.steel,{ww:3,wh:2,gx:1,gy:1,l:1,r:1,top:2,sh:3}]],cx);
    rc(6,B-3,16,4,M.steel[1]);win(8,B-3,12,4,{cross:false});hl(6,y+3,16,TM[2]);hl(6,y+4,16,TM[1]);
    rc(9,y-2,10,2,M.steel[2]);ell(14,y-1,3,1,M.concrete[4]);px(14,y-1,TM[2]);antenna(10,y-2,5);
    break;
  case'h42':
    y=stack([[16,30,M.sand,{ww:1,wh:3,gx:1,gy:1,l:2,top:2}],[12,16,M.sand,{ww:1,wh:3,gx:1,gy:1,l:2,top:2}],[8,8,M.sand,{ww:1,wh:2,gx:1,gy:1,l:2,top:2}]],cx);
    rc(11,y-3,6,4,M.gold[3]);hl(11,y-3,6,M.gold[4]);rc(12,y-6,4,3,TM[2]);vl(13,y-14,8,M.steel[3]);vl(14,y-12,6,M.steel[1]);px(13,y-15,emi('#ff5040'));
    break;
  case'e40':
    y=stack([[14,34,M.white,{ww:2,wh:3,gx:1,gy:1,l:2,top:2,sh:2}]],cx);remap([WN],[winL(175)],()=>true);
    dome(14,y+1,7,6,M.glass);remap(M.glass,[WD,WN,WN,WL,WL],(x,yy)=>yy<=y);vl(14,y-9,4,M.white[4]);px(14,y-10,emi('#9ff0ff'));
    hl(7,B-12,14,TM[2]);hl(7,B-24,14,TM[2]);sph(6,B-2,3,3,FO);sph(22,B-2,3,3,FO);
    break;
  case'e41':
    y=stack([[12,46,M.white,{ww:1,wh:3,gx:1,gy:1,l:2,top:2}]],cx);
    for(let j=0;j<12;j++){const w=Math.round(6*(1-j/12)**.7);hl(14-w,y-j,w*2,j%3===0?TM[2]:M.white[j<2?4:3]);}
    px(13,y-13,emi('#a8f4ff'));px(14,y-13,emi('#a8f4ff'));vl(13,y-17,4,M.white[4]);
    for(let j=0;j<46;j+=9)hl(8,B-3-j,12,TM[1]);sph(20,B-2,3,3,FO);
    break;
  case'e42':
    y=stack([[14,24,M.white,{ww:1,wh:2,gx:1,gy:1,l:2,top:2}],[10,18,M.glass,{ww:1,wh:2,gx:1,gy:1,l:1,top:1}],[6,10,M.white,{ww:1,wh:2,gx:1,gy:1,l:1}]],cx);
    cone(14,y-8,y+1,3,TM,{cav:.6,ry:.6});vl(13,y-12,4,M.white[4]);px(13,y-13,emi('#c0fff8'));px(12,y-10,emi('#80e8ff'));px(14,y-10,emi('#80e8ff'));
    break;
  case'd40':
    y=stack([[20,12,M.dstone,{tex:'block',ww:2,wh:2,gx:1,gy:2,l:2,top:2}],[16,10,M.brass,{tex:'panel',ww:2,wh:2,gx:1,gy:1,l:2}],[12,8,M.dstone,{ww:2,wh:2,gx:1,gy:1,l:2}],[8,6,M.brass,{ww:1,wh:2,gx:1,l:2}]],cx);
    rc(12,y-2,4,2,M.brass[4]);px(13,y-3,emi('#ffb050'));hl(4,B-12,20,TM[2]);hl(6,B-23,16,TM[2]);
    break;
  case'd41':
    y=stack([[18,40,M.dstone,{tex:'block',ww:2,wh:3,gx:2,gy:2,l:2,top:2}]],cx);
    cren(5,y-1,18,M.brass);ell(14,y-4,4,4,M.brass[1]);ell(14,y-4,3,3,M.brass[3]);ell(14,y-4,1.2,1.2,M.iron[1]);
    for(let j=0;j<40;j+=10)hl(5,B-3-j,18,M.brass[3]);banner(12,B-12,4,8);
    break;
  case'd42':
    y=stack([[20,16,M.dstone,{tex:'block',ww:2,wh:2,gx:2,gy:2,l:2,top:2}],[16,14,M.brass,{tex:'panel',ww:2,wh:2,gx:1,gy:1,l:2}],[12,12,M.dstone,{ww:2,wh:2,gx:1,gy:1,l:2}],[8,10,M.brass,{ww:1,wh:2,gx:1,l:2}]],cx);
    cone(14,y-6,y+1,4,M.brass,{ry:.8});px(13,y-7,emi('#ff9a3a'));chim(5,B-22,2,6,M.iron,{glow:'#ff8a30'});chim(21,B-22,2,6,M.iron,{glow:'#ff8a30'});
    hl(4,B-16,20,TM[2]);hl(6,B-31,16,TM[2]);
    break;
  case'o40':
    y=stack([[16,34,M.iron,{tex:'panel',ww:2,wh:1,gx:2,gy:2,l:2,top:2}]],cx);remap(M.iron,M.rust,(x,yy)=>((x*5+yy*7)%13)<4);
    chim(17,y-6,3,8,M.rust);spike(8,y-3,3);spike(11,y-2,2);rc(6,B-12,16,2,TM[2]);hl(6,B-12,16,TM[3]);px(8,y+2,emi('#ff3a2a'));
    break;
  case'o41':
    y=stack([[16,22,M.iron,{tex:'panel',ww:2,wh:1,gx:2,gy:2,l:2,top:2}],[12,22,M.rust,{tex:'corr',ww:1,wh:2,gx:2,gy:2,l:2}]],cx);
    for(let x=9;x<20;x+=2)spike(x,y-3+(x%4===1?-1:0),3);chim(5,B-30,3,8,M.rust);px(13,y+3,emi('#ff3a2a'));px(15,y+3,emi('#ff3a2a'));
    banner(8,B-20,3,8);banner(17,B-20,3,8);
    break;
  case'o42':
    y=stack([[18,22,M.iron,{tex:'panel',ww:2,wh:1,gx:2,gy:2,l:2,top:2}],[14,20,M.rust,{tex:'corr',ww:2,wh:1,gx:2,gy:2,l:2}],[10,14,M.iron,{ww:1,wh:1,gx:2,gy:2,l:2}]],cx);
    remap(M.iron,M.rust,(x,yy)=>((x*3+yy*5)%9)<2);
    tusk(10,y,-1,6);tusk(18,y,1,6);spike(14,y-6,6);px(12,y+2,emi('#ff3020'));px(16,y+2,emi('#ff3020'));
    chim(5,B-28,3,10,M.rust);chim(21,B-26,3,10,M.rust);rc(5,B-14,18,2,TM[2]);rc(7,B-34,14,2,TM[2]);
    break;
  }
  add('tall_'+r+'_'+t+'_'+v,cx,B);
}
GENS.push(()=>{for(const r of'hedo')for(const t of[3,4])for(let v=0;v<3;v++)tall(r,t,v);});

/* ---------- composition helpers ---------- */
function turret(cx,yb,w,h,m,o){
  o=o||{};const x=Math.round(cx-w/2);
  if(o.sq)wall(x,yb-h+1,w,h,m,o.tex||'stone');else cyl(x,yb-h+1,w,h,m,{tex:o.tex||'stone',curve:o.curve==null?1:o.curve});
  const top=yb-h+1;
  if(o.roof){cone(cx,top-o.rh,top,w/2+1.2,o.roof,{ry:o.ry==null?1.2:o.ry,cav:o.cav||0});if(o.flag)flag(Math.round(cx-.5),top-o.rh-6,6,o.fw||4,2);}
  else{cren(x-1,top-2,w+2,m,{mw:o.mw||1,gap:1});rc(x,top,w,1,rk(m,1));if(o.flag)flag(Math.round(cx-.5),top-9,8,o.fw||5,3);}
  if(o.win)win(Math.round(cx-.5),top+3,1,2,{glint:false});
  return top;
}
function columns(x0,yt,n,step,h,m,o){
  o=o||{};
  for(let i=0;i<n;i++){const x=x0+i*step;
    vl(x,yt,h,rk(m,4));vl(x+1,yt,h,rk(m,2));if(o.w3)vl(x+2,yt,h,rk(m,1));
    hl(x-1,yt,o.w3?5:4,rk(m,3));hl(x-1,yt+h-1,o.w3?5:4,rk(m,2));}
}
function steps(x,y,w,n,m){for(let j=0;j<n;j++){hl(x-j,y+j,w+2*j,rk(m,j%2?2:3));px(x-j,y+j,rk(m,4));}}
function brazier(x,y){rc(x-1,y,3,1,MT.iron[3]);px(x,y+1,MT.iron[1]);vl(x,y+2,3,MT.iron[2]);px(x,y-1,emi('#ffb040'));px(x-1,y-1,emi('#ff6a20'));px(x+1,y-1,emi('#ff8a30'));px(x,y-2,emi('#ffe080'));}
function lantern(x,y){px(x,y,MT.iron[1]);px(x,y+1,emi('#ffd27a'));}
function totem(x,yb,h){
  const M=MT,cols=[M.red[3],hex('#3e8ad0'),M.gold[3],M.green[3]];
  wall(x,yb-h+1,3,h,M.wood,'plain');
  for(let j=0;j*5<h-3;j++){const y=yb-h+3+j*5;hl(x,y,3,cols[j%4]);px(x+1,y+1,INK);px(x,y+1,M.wood[4]);px(x+2,y+2,M.bone[3]);hl(x,y+3,3,M.wood[1]);}
  hl(x-2,yb-h+2,7,M.wood[3]);px(x-2,yb-h+1,M.wood[4]);px(x+4,yb-h+1,M.wood[2]);
}
function clock(cx,cy){ell(cx,cy,2.6,2.6,MT.white[4]);px(cx-.5,cy-1.5,INK);px(cx-.5,cy-.5,INK);px(cx+.5,cy-.5,INK);ell(cx,cy,2.6,2.6,(x,y)=>null);}

/* ---------- halls (settlement centres) ---------- */
function hall(r,t){
  const M=MT,TM=TEAM,FO=FOL,H=58,B=H-1,cx=20;cv(40,H);seed=r.charCodeAt(0)*13+t;
  switch(r+t){
  case'h0':
    totem(33,B,17);flag(34,B-24,7,5,3);
    wall(8,B-7,24,8,M.wood,'log');
    hip(6,33,B-8,B-20,5,M.thatch,{tex:'thatch',course:0,bk:4});
    ln(14,B-23,17,B-20,M.bone[3]);ln(26,B-23,23,B-20,M.bone[2]);
    door(17,B-6,6,7,M.dwood);door(18,B-5,4,6,null,{arch:true});banner(13,B-7,3,5);banner(24,B-7,3,5);skull(19,B-10);
    win(10,B-5,2,2,{glint:false});win(28,B-5,2,2,{glint:false});
    break;
  case'h1':
    steps(8,B-2,24,3,M.stone);rc(7,B-15,26,13,M.plaster[2]);rc(9,B-13,22,11,HOLE);
    door(17,B-10,6,8,M.wood,{plank:true});for(const x of[11,26])win(x,B-10,3,4,{frame:M.plaster[2]});
    columns(8,B-15,6,4,13,M.white);rc(6,B-17,28,2,M.white[3]);hl(6,B-17,28,M.white[4]);hl(6,B-16,28,M.gold[2]);
    gable(7,26,B-18,6,6,TM,M.white,{course:3});ell(20,B-21,2,1.5,M.gold[3]);
    flag(5,B-26,9,5,3,{pole:M.iron});flag(34,B-26,9,5,3,{pole:M.iron});
    break;
  case'h2':
    wall(13,B-27,14,18,M.stone,'stone');cren(12,B-29,16,M.stone);flat(13,B-28,14,1,M.stone);
    banner(15,B-24,3,7);banner(22,B-24,3,7);win(19,B-23,2,3,{arch:true});flag(19,B-38,9,7,3);
    wall(6,B-9,28,10,M.stone,'stone');cren(5,B-11,30,M.stone);flat(6,B-10,28,1,M.stone);
    door(16,B-7,8,8,M.dstone,{arch:true});door(17,B-6,6,7,null,{arch:true});for(let x=17;x<23;x+=2)vl(x,B-6,6,M.iron[2]);hl(17,B-3,6,M.iron[2]);
    turret(8,B,8,17,M.stone,{roof:TM,rh:9,flag:true,win:true});turret(32,B,8,17,M.stone,{roof:TM,rh:9,flag:true,win:true});
    break;
  case'h3':
    for(const x0 of[4,26]){wall(x0,B-13,10,14,M.brick,'brick');rc(x0-1,B-19,12,6,TM[2]);hip(x0-1,x0+10,B-14,B-19,1,TM,{bk:1,tex:'slate'});winGrid(x0+1,B-11,3,2,2,3,1,2,{sill:M.stone[4]});hl(x0,B-13,10,M.stone[3]);}
    wall(13,B-18,14,19,M.stone,'block');hl(13,B-18,14,M.stone[4]);
    turret(20,B-18,10,13,M.stone,{sq:true,tex:'block',roof:TM,rh:10,flag:true,ry:.8});
    clock(20,B-26);winGrid(15,B-15,3,2,2,3,2,2,{sill:M.white[4]});door(18,B-5,4,6,M.dwood,{arch:true});steps(17,B,6,1,M.stone);
    columns(14,B-6,2,10,6,M.white);
    break;
  case'h4':
    steps(10,B-2,20,3,M.white);wall(5,B-12,30,11,M.white,'block');winGrid(7,B-10,2,2,2,3,2,2);winGrid(29,B-10,2,2,2,3,2,2);
    rc(13,B-16,14,14,HOLE);columns(13,B-16,4,4,14,M.white);gable(12,16,B-17,4,3,M.white,M.white,{course:0});
    cyl(13,B-25,14,8,M.white,{curve:1});columns(14,B-25,4,3,7,M.white);
    dome(20,B-25,8,9,M.white,{dither:.3});cyl(18,B-37,4,4,M.white);cone(20,B-40,B-37,2.5,M.gold,{ry:.5});flag(19,B-48,8,6,3,{pole:M.iron});
    flag(6,B-21,9,4,3,{pole:M.iron});flag(32,B-21,9,4,3,{pole:M.iron});
    break;
  case'e0':
    sph(11,B-28,7.5,7,FO);sph(29,B-29,7.5,7,FO);sph(20,B-36,10.5,8,FO);
    cyl(16,B-24,9,24,M.wood,{curve:1});for(const[a,b]of[[13,B],[14,B-1],[26,B],[25,B-1],[12,B]])px(a,b,M.wood[a<20?2:1]);
    ln(16,B-22,9,B-28,M.wood[2]);ln(24,B-22,31,B-28,M.wood[1]);
    hl(10,B-15,20,M.lwood[3]);hl(10,B-14,20,M.lwood[1]);wall(12,B-20,8,5,M.lwood,'plank');cone(16,B-24,B-20,5,FO,{ry:1});win(14,B-18,2,2);
    sph(13,B-26,7,5,FO);sph(27,B-25,7,5,FO);sph(20,B-31,9,6,FO);
    door(18,B-7,5,8,M.lwood,{arch:true});door(19,B-6,3,7,null,{arch:true});rc(19,B-5,1,6,TM[3]);rc(20,B-5,2,6,TM[2]);
    banner(9,B-24,3,6);banner(29,B-24,3,6);for(const[a,b]of[[12,B-14],[27,B-14],[23,B-21]])lantern(a,b);
    break;
  case'e1':
    wall(4,B-9,32,10,M.wstone,'stone');winGrid(6,B-7,3,1,2,4,2,0,{arch:true});winGrid(27,B-7,3,1,2,4,1,0,{arch:true});
    for(const x of[9,31])dome(x,B-9,5.5,5,TM);
    cyl(13,B-17,15,17,M.wstone,{tex:'stone'});columns(14,B-15,4,4,13,M.white);door(19,B-8,3,8,M.lwood,{arch:true});
    dome(20.5,B-17,9,10,TM);px(20,B-28,FO[3]);px(19,B-29,FO[2]);px(21,B-29,FO[4]);px(20,B-30,FO[3]);
    vine(4,B-8,8,3);vine(35,B-8,7,5);vine(13,B-16,10,7);
    break;
  case'e2':
    wall(6,B-11,28,12,M.wstone,'stone');winGrid(8,B-9,6,1,2,4,2,0,{arch:true});door(18,B-8,5,9,M.white,{arch:true});door(19,B-7,3,8,M.lwood,{arch:true});
    rc(10,B-14,20,3,M.wstone[3]);hl(10,B-14,20,M.wstone[4]);
    turret(9,B-11,6,12,M.wstone,{roof:TM,rh:12,cav:.5,ry:.8});turret(31,B-11,6,12,M.wstone,{roof:TM,rh:12,cav:.5,ry:.8});
    turret(20.5,B-11,8,18,M.wstone,{roof:TM,rh:17,cav:.55,ry:1});win(20,B-25,2,4,{arch:true});px(20,B-47,M.gold[4]);flag(20,B-53,6,5,2);
    banner(14,B-11,2,5,{emb:false});banner(25,B-11,2,5,{emb:false});vine(6,B-10,8,9);
    break;
  case'e3':
    wall(5,B-12,30,13,M.wstone,'stone');winGrid(7,B-10,7,1,2,5,2,0,{arch:true});rc(5,B-13,30,1,M.copper[3]);
    dome(20,B-13,12,14,M.glass);remap(M.glass,[WD,WN,WN,WL,WL],(x,y)=>y<B-13);
    for(const a of[-.8,-.45,0,.45,.8])for(let j=0;j<15;j++){const fr=Math.sqrt(Math.max(0,1-(j/14)**2));px(Math.round(20+a*12*fr-.5),B-13-j,M.copper[a<0?4:2]);}
    rc(17,B-29,6,3,M.copper[3]);cone(20,B-34,B-29,3.5,M.copper,{ry:.6});flag(19,B-41,6,5,2);
    door(17,B-9,6,10,M.copper,{arch:true});door(18,B-8,4,9,null,{arch:true});banner(9,B-12,3,6);banner(28,B-12,3,6);
    break;
  case'e4':
    wall(4,B-7,32,8,M.white,'plain');winGrid(6,B-5,6,1,3,3,1,0);winGrid(26,B-5,3,1,3,3,1,0);hl(4,B-8,32,TM[3]);
    for(let j=0;j<44;j++){const w=Math.round(7+3*Math.sin(j/44*Math.PI)*.8-j*.08),x=20-w;
      for(let i=0;i<w*2;i++){const u=i/(w*2);px(x+i,B-8-j,i===0?M.white[4]:i===w*2-1?M.white[1]:(j%4===0||i%3===0)?M.white[u<.5?3:2]:winL(u>.8?118:j%8<4?160:175));}}
    hl(13,B-20,14,TM[2]);hl(14,B-36,12,TM[2]);cone(20,B-60,B-52,4,M.white,{ry:.5});px(19,B-61,emi('#a0f8ff'));px(19,B-62,emi('#e0ffff'));
    door(18,B-4,4,5,null,{arch:true});
    break;
  case'd0':
    sph(20,B+1,17,20,M.rock,{clipY:B});remap(M.rock,M.turf,(x,y)=>y<B-14+Math.abs(x-20)*.3);
    rc(12,B-13,16,14,M.dstone[1]);wall(12,B-15,16,3,M.dstone,'block');hl(12,B-15,16,M.dstone[4]);
    wall(12,B-12,3,13,M.dstone,'block');wall(25,B-12,3,13,M.dstone,'block');
    door(15,B-11,10,12,M.wood,{plank:true});hl(15,B-8,10,M.iron[2]);hl(15,B-3,10,M.iron[2]);vl(20,B-11,12,INK);
    banner(13,B-11,1,6,{emb:false});banner(26,B-11,1,6,{emb:false});brazier(9,B-4);brazier(31,B-4);
    chim(27,B-24,3,6,M.dstone,{glow:'#ff8a30'});flag(20,B-28,9,6,3,{pole:M.iron});
    break;
  case'd1':
    wall(5,B-12,30,13,M.dstone,'block');flat(4,B-17,32,4,M.dstone);hl(4,B-13,32,TM[2]);hl(4,B-12,32,TM[1]);
    door(15,B-9,10,10,M.dstone);door(16,B-8,8,9,M.wood,{plank:true});vl(20,B-8,9,M.iron[1]);hl(16,B-5,8,M.iron[2]);
    for(const x of[11,28]){wall(x,B-11,3,12,M.stone,'plain');px(x+1,B-9,emi('#5ff0d8'));px(x+1,B-6,emi('#5ff0d8'));px(x+1,B-3,emi('#5ff0d8'));}
    win(7,B-8,2,3);win(32,B-8,2,3);chim(8,B-22,4,5,M.dstone,{glow:'#ff8a30'});chim(29,B-22,4,5,M.dstone,{glow:'#ff8a30'});flag(20,B-27,9,6,3,{pole:M.iron});
    break;
  case'd2':
    wall(10,B-24,20,15,M.dstone,'block');cren(9,B-26,22,M.dstone,{mw:2,gap:2});flat(10,B-25,20,1,M.dstone);
    winGrid(13,B-20,4,1,2,2,2,0,{});banner(18,B-21,4,8);flag(20,B-36,9,7,3,{pole:M.iron});
    wall(5,B-10,30,11,M.dstone,'block');cren(4,B-12,32,M.dstone,{mw:2,gap:2});flat(5,B-11,30,1,M.dstone);
    turret(8,B,9,15,M.dstone,{sq:true,tex:'block',mw:2});turret(32,B,9,15,M.dstone,{sq:true,tex:'block',mw:2});
    for(const x of[7,31])rc(x,B-11,2,1,emi('#ff9a40'));
    door(15,B-8,10,9,M.dstone);door(16,B-7,8,8,M.iron,{plank:true});hl(16,B-7,8,M.brass[3]);banner(11,B-9,3,6);banner(26,B-9,3,6);
    break;
  case'd3':
    wall(3,B-11,34,12,M.dstone,'block');winGrid(5,B-9,10,1,2,3,1,0,{sill:M.brass[3]});hl(3,B-12,34,M.brass[3]);
    cyl(11,B-20,18,9,M.dstone,{tex:'stone'});hl(11,B-20,18,M.brass[4]);
    dome(20,B-20,9,10,M.brass,{dither:.3});rc(18,B-32,4,2,M.copper[3]);cone(20,B-36,B-32,2.5,M.copper,{ry:.4});flag(19,B-43,7,5,3,{pole:M.iron});
    chim(4,B-22,3,10,M.copper,{cap:true,glow:'#ff9a40'});chim(33,B-22,3,10,M.copper,{cap:true,glow:'#ff9a40'});
    for(const x of[8,31]){vl(x,B-10,10,M.brass[3]);vl(x+1,B-10,10,M.brass[1]);}
    door(16,B-8,8,9,M.brass);door(17,B-7,6,8,M.iron,{plank:true});banner(12,B-10,3,6);banner(25,B-10,3,6);
    break;
  case'd4':{
    let y=B;const lv=[[34,9,M.dstone],[28,8,M.brass],[22,8,M.dstone],[16,8,M.brass],[10,7,M.dstone]];
    for(const[w,h,m]of lv){const x=20-w/2;facade(x,y-h+1,w,h,m,{tex:m===M.brass?'panel':'block',ww:2,wh:2,gx:1,gy:2,l:2,top:2});hl(x,y-h,w,rk(m,4));hl(x,y-h+1,w,TM[2]);y-=h+1;}
    cone(20,y-6,y+1,3.5,M.brass,{ry:.6});px(19,y-7,emi('#ffb050'));chim(5,B-15,3,6,M.iron,{glow:'#ff8a30'});chim(33,B-15,3,6,M.iron,{glow:'#ff8a30'});
    rc(17,B-4,6,5,M.iron[1]);flag(28,y-6,8,5,3,{pole:M.iron});
    break;}
  case'o0':
    totem(4,B,14);skull(4,B-15);vl(34,B-15,16,M.dwood[2]);skull(33,B-17);flag(20,B-41,6,5,3,{pole:M.dwood});
    ln(20,B-26,14,B-34,M.dwood[2]);ln(20,B-26,26,B-34,M.dwood[1]);ln(20,B-26,19,B-35,M.dwood[3]);
    cone(20,B-27,B-2,13,M.hide,{ry:2.5});
    for(const u of[-.6,-.15,.3,.7])ln(20,B-27,20+u*13,B,M.hide[u<0?1:0]);
    paint(M.hide,B-13,B-11);paint(M.hide,B-20,B-20);
    poly([20,B-14,16,B+1,24,B+1],HOLE);ln(20,B-14,16,B,M.hide[3]);skull(19,B-17);
    tusk(12,B,1,10);tusk(28,B,-1,10);tusk(14,B,1,8);tusk(26,B,-1,8);
    break;
  case'o1':
    wall(6,B-10,28,11,M.dwood,'log');
    hip(4,35,B-11,B-22,6,TM,{course:3,bk:3});tusk(9,B-21,-1,7);tusk(31,B-21,1,7);
    for(let x=12;x<=28;x+=4)spike(x,B-25,4,M.bone);
    door(16,B-8,8,9,null);rc(16,B-8,8,2,M.hide[2]);skull(19,B-12);skull(9,B-7);skull(29,B-7);
    banner(12,B-9,2,5,{emb:false});banner(26,B-9,2,5,{emb:false});
    break;
  case'o2':
    wall(11,B-20,18,12,M.dwood,'plank');hip(9,30,B-21,B-30,4,TM,{bk:2});for(let x=13;x<=27;x+=3)spike(x,B-33,3);flag(20,B-40,8,6,3,{pole:M.dwood});
    for(let x=5;x<=34;x+=2){const h=11+(x*5)%3;vl(x,B-h,h+1,M.dwood[x<10?3:x>30?1:2]);vl(x+1,B-h+1,h,M.dwood[1]);px(x,B-h-1,M.dwood[4]);}
    hl(5,B-6,31,M.dwood[0]);
    for(const x of[4,31]){wall(x,B-23,5,11,M.dwood,'plank');cone(x+2.5,B-30,B-23,3.6,TM,{ry:1});}
    door(16,B-8,8,9,null);rc(16,B-8,8,1,M.iron[2]);for(let x=16;x<24;x+=2)px(x,B-7,M.iron[3]);skull(19,B-11);skull(12,B-15);skull(26,B-15);
    banner(10,B-10,3,6);banner(27,B-10,3,6);
    break;
  case'o3':
    wall(4,B-12,32,13,M.rust,'corr');remap(M.rust,M.iron,(x,y)=>((x>>2)+(y>>2))%3===0);
    wall(11,B-24,18,12,M.iron,'panel');rc(15,B-22,10,4,TM[2]);hl(15,B-22,10,TM[3]);skull(19,B-21);
    flat(10,B-26,20,2,M.rust);for(let x=4;x<36;x+=3)spike(x,B-15,3);
    chim(7,B-30,4,18,M.iron,{cap:true});chim(29,B-34,4,22,M.rust,{cap:true});px(8,B-30,emi('#ff6a20'));px(30,B-34,emi('#ff6a20'));
    door(15,B-9,10,10,M.iron,{plank:true});rc(15,B-9,10,2,TM[1]);win(13,B-19,2,2);win(25,B-19,2,2);
    banner(6,B-11,3,7);banner(31,B-11,3,7);
    break;
  case'o4':
    wall(4,B-10,32,11,M.rust,'corr');for(let x=4;x<36;x+=3)spike(x,B-13,3);
    facade(12,B-44,16,35,M.iron,{tex:'panel',ww:2,wh:1,gx:2,gy:2,l:2,top:6});remap(M.iron,M.rust,(x,y)=>(((x>>1)*7+(y>>1)*5)%11)<3);
    rc(12,B-44,16,1,M.iron[4]);tusk(13,B-44,-1,8);tusk(26,B-44,1,8);spike(19,B-52,8);
    rc(15,B-41,10,3,INK);px(16,B-40,emi('#ff3020'));px(17,B-40,emi('#ff6040'));px(22,B-40,emi('#ff3020'));px(23,B-40,emi('#ff6040'));
    hl(12,B-30,16,TM[2]);hl(12,B-29,16,TM[1]);banner(14,B-27,3,9);banner(23,B-27,3,9);
    chim(6,B-24,3,14,M.iron,{glow:'#ff6a20'});chim(31,B-26,3,16,M.iron,{glow:'#ff6a20'});door(16,B-8,8,9,null);
    break;
  }
  add('hall_'+r+'_'+t,cx,B);
}
GENS.push(()=>{for(const r of'hedo')for(let t=0;t<5;t++)hall(r,t);});

/* ---------- temples ---------- */
function menhir(x,yb,w,h,m){m=m||MT.stone;wall(x,yb-h+1,w,h,m,'plain');px(x,yb-h+1,rk(m,4));px(x+w-1,yb-h+1,rk(m,2));hl(x,yb,w,rk(m,1));}
function rose(cx,cy,r){ell(cx,cy,r+1,r+1,MT.stone[3]);ell(cx,cy,r,r,WN);px(cx-.5,cy-.5,WL);ell(cx,cy,r,r,(x,y)=>((x+y)&1)&&Math.abs(x+.5-cx)+Math.abs(y+.5-cy)>r*.8?WD:null);}
function temple(r,t){
  const M=MT,TM=TEAM,FO=FOL,H=56,B=H-1,cx=18;cv(36,H);seed=r.charCodeAt(0)*17+t*3;
  switch(r+t){
  case'h0':
    ell(18,B-2,13,4,M.turf[1]);ell(18,B-2,12,3.3,M.turf[2]);
    for(const[x,h]of[[9,8],[14,10],[21,10],[26,8]])menhir(x,B-3,3,h,M.stone);
    rc(12,B-14,13,2,M.stone[3]);hl(12,B-14,13,M.stone[4]);hl(12,B-12,13,M.stone[1]);
    for(const[x,h]of[[5,8],[30,8],[11,9],[24,9]])menhir(x,B,3,h,M.stone);
    menhir(16,B-1,5,3,M.dstone);px(18,B-4,emi('#ffb040'));px(17,B-5,emi('#ffd060'));banner(17,B-12,3,4);
    break;
  case'h1':
    steps(6,B-2,24,3,M.white);rc(6,B-14,24,12,HOLE);door(15,B-11,6,9,M.bronze);
    columns(6,B-14,4,7,12,M.white,{w3:true});rc(4,B-16,28,2,M.white[3]);hl(4,B-16,28,M.white[4]);hl(4,B-15,28,TM[2]);
    gable(5,26,B-17,6,5,TM,M.white,{course:0});px(17,B-23,M.gold[3]);px(18,B-23,M.gold[3]);px(4,B-18,M.gold[3]);px(31,B-18,M.gold[3]);ell(18,B-19,1.5,1.2,M.gold[3]);
    break;
  case'h2':
    wall(4,B-14,22,15,M.stone,'stone');gable(4,22,B-15,9,3,TM,M.stone);rose(15,B-15,3);
    door(12,B-7,6,8,M.stone,{arch:true});door(13,B-6,4,7,M.wood,{arch:true,plank:true});
    for(const x of[4,24])wall(x,B-12,2,13,M.stone,'plain');win(7,B-11,2,4,{arch:true});win(21,B-11,2,4,{arch:true});
    turret(29,B,7,26,M.stone,{sq:true,tex:'stone',roof:TM,rh:18,ry:.6});win(28,B-20,2,4,{arch:true});win(28,B-12,2,3,{arch:true});
    px(29,B-46,M.gold[4]);hl(28,B-47,3,M.gold[3]);px(29,B-48,M.gold[3]);
    break;
  case'h3':
    dome(18,B-14,8,8,M.copper,{dither:.3});cyl(16,B-25,4,3,M.copper);px(17,B-27,M.gold[4]);px(18,B-27,M.gold[3]);
    wall(7,B-13,22,14,M.sand,'block');rose(18,B-9,3);door(16,B-4,5,5,M.wood,{arch:true});
    for(const x of[3,26]){turret(x+3.5,B,7,22,M.sand,{sq:true,tex:'block',roof:TM,rh:9,ry:.6});win(x+3,B-17,2,4,{arch:true});win(x+3,B-9,2,3,{arch:true});}
    gable(10,16,B-14,5,2,TM,M.sand,{course:0});
    break;
  case'h4':
    rc(2,B-2,32,3,M.concrete[3]);hl(2,B-2,32,M.concrete[4]);
    wall(4,B-12,10,10,M.white,'plain');wall(22,B-12,10,10,M.white,'plain');win(6,B-10,6,7,{cross:false});win(24,B-10,6,7,{cross:false});
    for(let j=0;j<40;j++){const w=Math.max(1,Math.round(3.5-j*.06));hl(18-w,B-3-j,w,M.white[4]);hl(18,B-3-j,w,M.white[2]);}
    px(17,B-44,M.gold[4]);px(18,B-44,M.gold[3]);rc(16,B-8,4,2,M.gold[3]);banner(7,B-15,2,8,{emb:false});banner(27,B-15,2,8,{emb:false});
    break;
  case'e0':
    ell(18,B-2,15,4,M.turf[1]);for(const[x,h]of[[6,5],[12,6],[24,6],[30,5]])menhir(x-1,B-3,2,h,M.wstone);
    sph(12,B-24,7,6,FO);sph(25,B-23,7,6,FO);sph(18,B-30,9,7,FO);
    cyl(15,B-18,6,17,M.wood);ln(15,B-16,10,B-22,M.wood[2]);ln(20,B-16,26,B-21,M.wood[1]);sph(18,B-22,8,5,FO);
    door(17,B-6,3,4,null,{arch:true});for(const[x,y]of[[9,B-12],[27,B-15],[21,B-27],[13,B-30]])px(x,y,emi('#c8ffb0'));
    for(const[x,h]of[[3,6],[9,7],[27,7],[33,6]])menhir(x-1,B,2,h,M.wstone);banner(23,B-15,2,5,{emb:false});
    break;
  case'e1':
    steps(8,B-2,20,3,M.wstone);rc(9,B-14,18,12,M.wstone[1]);door(16,B-10,4,8,M.lwood,{arch:true});
    columns(8,B-14,6,4,12,M.white);rc(7,B-16,22,2,M.white[3]);hl(7,B-16,22,M.white[4]);
    dome(18,B-16,10,10,TM);px(18,B-27,FO[3]);px(17,B-28,FO[4]);px(19,B-28,FO[2]);vine(7,B-15,10,4);vine(28,B-15,9,9);
    break;
  case'e2':
    sph(18,B-34,11,8,FO);sph(10,B-28,6,5,FO);sph(26,B-28,6,5,FO);
    cyl(16,B-24,5,16,M.wood);wall(5,B-12,26,13,M.wstone,'stone');
    for(const x of[7,14,22])door(x,B-9,6,10,MT.wstone,{arch:true}),door(x+1,B-8,4,9,null,{arch:true});door(14,B-8,6,9,M.wood);rc(16,B-8,2,9,M.wood[1]);
    cone(8,B-21,B-12,4,TM,{cav:.5,ry:.8});cone(28,B-21,B-12,4,TM,{cav:.5,ry:.8});sph(18,B-15,6,3,FO);
    banner(16,B-14,4,7);vine(5,B-11,10,3);vine(30,B-11,9,8);
    break;
  case'e3':
    wall(6,B-9,24,10,M.wstone,'stone');winGrid(8,B-7,5,1,2,4,2,0,{arch:true});
    poly([18,B-46,12,B-9,24.5,B-9],(x,y)=>{const u=(x+.5-12)/12.5;return (y%5===0)?M.glass[u<.5?4:2]:u<.3?M.glass[4]:u<.5?M.glass[3]:(x+y)%7===0?winL(175):u<.75?M.glass[2]:M.glass[1];});
    ln(18,B-46,18,B-9,M.white[4]);ln(18,B-46,12,B-9,M.white[3]);ln(18,B-46,24,B-9,M.white[1]);
    px(17,B-47,emi('#e0fff8'));px(17,B-48,emi('#a0f0ff'));rc(5,B-10,26,1,M.copper[3]);
    turret(5,B,4,14,M.wstone,{roof:TM,rh:8,cav:.5,ry:.4});turret(31,B,4,14,M.wstone,{roof:TM,rh:8,cav:.5,ry:.4});
    break;
  case'e4':
    rc(1,B-1,34,2,M.white[3]);hl(1,B-1,34,M.white[4]);
    poly([18,B-30,3,B-2,33,B-2],(x,y)=>{const u=(x-3)/30,lt=x<18;if((B-y)%5===0)return M.white[lt?4:2];if(Math.abs(x+.5-18)<.6)return M.white[3];return lt?(u<.3?M.glass[4]:(x+y)%6===0?winL(190):M.glass[3]):((x+y)%6===0?winL(140):u>.8?M.glass[1]:M.glass[2]);});
    px(17,B-31,emi('#ffffff'));vl(17,B-38,7,emi('#bff6ff'));px(17,B-39,emi('#ffffff'));
    door(16,B-6,4,5,null,{arch:true});banner(6,B-10,2,6,{emb:false});banner(28,B-10,2,6,{emb:false});
    break;
  case'd0':
    sph(18,B+1,14,16,M.rock,{clipY:B});
    ell(18,B-9,7,8,M.dstone[1]);sph(18,B-9,6,7,M.dstone);rc(13,B-13,11,2,M.dstone[1]);px(15,B-11,emi('#ffb040'));px(21,B-11,emi('#ffb040'));
    rc(14,B-7,9,6,M.brass[2]);for(let x=14;x<23;x+=2)vl(x,B-7,6,M.brass[1]);hl(14,B-7,9,M.brass[4]);px(18,B-9,M.dstone[0]);
    brazier(5,B-3);brazier(31,B-3);banner(9,B-13,2,5,{emb:false});banner(26,B-13,2,5,{emb:false});
    break;
  case'd1':
    wall(6,B-10,24,11,M.dstone,'block');flat(5,B-14,26,3,M.dstone);hl(5,B-11,26,TM[2]);
    for(const x of[8,14,20,26])px(x,B-7,emi('#5ff0d8')),px(x+1,B-6,emi('#5ff0d8')),px(x,B-5,emi('#5ff0d8'));
    door(15,B-8,6,9,M.dstone);door(16,B-7,4,8,M.bronze,{plank:true});brazier(5,B-3);brazier(31,B-3);
    menhir(16,B-15,4,6,M.stone);px(17,B-18,emi('#5ff0d8'));px(18,B-19,emi('#5ff0d8'));
    break;
  case'd2':
    wall(3,B-14,30,15,M.dstone,'block');cren(2,B-16,32,M.dstone,{mw:2,gap:2});flat(3,B-15,30,1,M.dstone);
    door(13,B-11,10,12,M.dstone,{arch:true});door(14,B-10,8,11,null,{arch:true});
    rc(16,B-9,4,9,M.stone[2]);rc(15,B-15,6,6,M.stone[3]);px(16,B-13,INK);px(19,B-13,INK);rc(16,B-11,4,3,M.brass[3]);rc(15,B-8,6,2,M.stone[3]);
    vl(22,B-18,12,M.wood[2]);rc(20,B-19,5,3,M.iron[2]);hl(20,B-19,5,M.iron[4]);
    banner(6,B-12,3,8);banner(27,B-12,3,8);brazier(10,B-2);brazier(26,B-2);
    break;
  case'd3':
    wall(5,B-12,26,13,M.dstone,'block');hl(5,B-13,26,M.brass[3]);
    ell(18,B-20,9,9,M.brass[1]);ell(18,B-20,8,8,M.brass[3]);ell(18,B-20,7,7,M.brass[2]);ell(18,B-20,3,3,M.iron[1]);ell(18,B-20,1.5,1.5,emi('#ffa040'));
    for(let a=0;a<8;a++){const s=Math.sin(a*Math.PI/4),c=Math.cos(a*Math.PI/4);rc(17.5+c*8.5-1,B-20+s*8.5-1,2,2,M.brass[3]);}
    door(14,B-8,8,9,M.brass);rc(15,B-7,6,8,emi('#ff8a30'));rc(16,B-6,4,7,emi('#ffc060'));
    chim(6,B-22,3,10,M.copper,{glow:'#ff9a40'});chim(27,B-22,3,10,M.copper,{glow:'#ff9a40'});banner(9,B-11,3,6);banner(24,B-11,3,6);
    break;
  case'd4':
    steps(8,B-3,20,4,M.dstone);wall(10,B-10,16,7,M.dstone,'block');hl(10,B-10,16,TM[2]);
    rc(11,B-16,14,5,M.iron[2]);hl(11,B-16,14,M.iron[4]);rc(13,B-11,10,1,M.iron[1]);poly([24,B-16,31,B-14,24,B-12],M.iron[1]);
    vl(17,B-34,18,M.wood[2]);vl(18,B-34,18,M.wood[1]);rc(12,B-38,12,6,M.brass[2]);hl(12,B-38,12,M.brass[4]);vl(12,B-38,6,M.brass[3]);hl(12,B-33,12,M.brass[1]);
    px(13,B-17,emi('#ffb050'));px(22,B-17,emi('#ffb050'));brazier(6,B-5);brazier(30,B-5);
    break;
  case'o0':
    ell(18,B-1,12,3,M.bone[1]);for(let i=0;i<14;i++){seed=i*7+3;px(8+rint(0,20),B-2+rint(0,2),M.bone[rint(2,4)]);}
    totem(16,B-1,22);skull(16,B-25);tusk(15,B-21,-1,5);tusk(19,B-21,1,5);
    for(const x of[8,26]){vl(x,B-14,14,M.dwood[2]);skull(x-1,B-16);}
    rc(10,B-4,4,3,M.iron[1]);px(11,B-5,emi('#ffb040'));px(12,B-6,emi('#ffe080'));px(12,B-5,emi('#ff6a20'));
    flag(26,B-22,6,4,3,{pole:M.dwood});
    break;
  case'o1':
    menhir(8,B,20,6,M.rock);wall(12,B-10,12,5,M.red,'plain');hl(12,B-10,12,M.red[4]);
    tusk(10,B-6,-1,12);tusk(26,B-6,1,12);skull(17,B-13);skull(13,B-13);skull(21,B-13);
    brazier(5,B-3);brazier(31,B-3);banner(15,B-9,6,4);
    break;
  case'o2':
    sph(18,B+1,15,13,M.rock,{clipY:B});
    sph(18,B-12,9,9,M.bone);rc(11,B-6,15,5,M.bone[2]);hl(11,B-6,15,M.bone[3]);for(let x=12;x<26;x+=2)vl(x,B-6,3,M.bone[4]),px(x+1,B-6,M.bone[1]);
    ell(14,B-13,2.5,2.5,INK);ell(22,B-13,2.5,2.5,INK);px(14,B-13,emi('#ff4020'));px(21,B-13,emi('#ff4020'));px(18,B-9,INK);
    rc(13,B-3,10,3,INK);px(16,B-3,emi('#ffb040'));px(18,B-4,emi('#ffe080'));px(19,B-3,emi('#ff6a20'));
    tusk(5,B,1,14);tusk(31,B,-1,14);banner(7,B-14,3,6);banner(26,B-14,3,6);
    break;
  case'o3':
    wall(6,B-6,24,7,M.rust,'corr');rc(11,B-24,14,18,M.iron[2]);wall(11,B-24,14,18,M.iron,'panel');
    rc(13,B-21,10,4,INK);rc(14,B-20,2,2,emi('#ff4020'));rc(20,B-20,2,2,emi('#ff4020'));rc(14,B-14,8,3,M.rust[1]);for(let x=14;x<22;x+=2)px(x,B-14,M.bone[3]);
    tusk(11,B-24,-1,7);tusk(24,B-24,1,7);chim(4,B-20,3,14,M.rust);chim(29,B-18,3,12,M.rust);banner(15,B-11,6,4);
    break;
  case'o4':
    rc(4,B-2,28,3,M.iron[1]);hl(4,B-2,28,M.iron[3]);
    for(let j=0;j<40;j++){const w=Math.max(1,Math.round(5-j*.1));hl(18-w,B-3-j,w,M.iron[2]);hl(18,B-3-j,w,M.iron[0]);if(j%6===3){px(17,B-3-j,emi('#ff3a20'));px(18,B-3-j,emi('#c02010'));}}
    px(17,B-44,emi('#ff6040'));tusk(12,B-3,-1,10);tusk(24,B-3,1,10);banner(6,B-14,3,9);banner(27,B-14,3,9);
    break;
  }
  add('temple_'+r+'_'+t,cx,B);
}
GENS.push(()=>{for(const r of'hedo')for(let t=0;t<5;t++)temple(r,t);});

/* ---------- civic buildings ---------- */
function goods(x,y,n){const cs=['#e04a3a','#f2b33a','#7cc04a','#c8743a','#a05cc0','#f4e0a0'];for(let i=0;i<n;i++){px(x+i,y,hex(cs[(i*5+x)%6]));if(i%2===0)px(x+i,y-1,hex(cs[(i*3+y)%6]));}}
function awning(x,y,w,h){for(let i=0;i<w;i++)for(let j=0;j<h;j++){const st=((i>>1)&1);px(x+i,y+j,st?TEAM[j===0?4:3]:hex(j===0?'#ffffff':'#e8e2d4'));}for(let i=0;i<w;i+=2)px(x+i,y+h,((i>>1)&1)?TEAM[1]:hex('#c8c0b0'));}
function rack(x,yb){const M=MT;hl(x,yb-5,6,M.wood[3]);vl(x,yb-6,7,M.wood[1]);vl(x+5,yb-6,7,M.wood[1]);for(let i=1;i<5;i++){vl(x+i,yb-9,9,M.wood[2]);px(x+i,yb-10,M.iron[4]);}}
function oreCart(x,yb){const M=MT;rc(x,yb-4,7,3,M.iron[2]);hl(x,yb-4,7,M.iron[4]);hl(x,yb-5,7,M.rock[1]);px(x+1,yb-6,M.rock[3]);px(x+3,yb-6,M.gold[3]);px(x+4,yb-6,M.rock[2]);px(x+5,yb-5,M.gold[4]);px(x+1,yb,M.iron[0]);px(x+5,yb,M.iron[0]);px(x+1,yb-1,M.iron[1]);px(x+5,yb-1,M.iron[1]);}
function lattice(x0,y0,x1,y1,w0,w1,m){ // tapered lattice tower from (x0..) bottom to top
  const h=y0-y1;
  for(let j=0;j<=h;j++){const w=Math.round(w0+(w1-w0)*j/h),cx=(x0+x1)/2,l=Math.round(cx-w/2),r=Math.round(cx+w/2)-1;px(l,y0-j,m[3]);px(r,y0-j,m[1]);
    if(j%4===0)hl(l,y0-j,r-l+1,m[2]);else{const t=(j%4)/4;px(Math.round(l+(r-l)*t),y0-j,m[2]);px(Math.round(r-(r-l)*t),y0-j,m[1]);}}
}
function civic(kind,t){
  const M=MT,TM=TEAM,FO=FOL,H=56,B=H-1,cx=14;cv(28,H);seed=kind.length*31+t;
  switch(kind+t){
  case'tower0':
    for(const x of[8,19]){vl(x,B-16,17,M.wood[2]);vl(x+1,B-16,17,M.wood[1]);}
    ln(9,B-14,19,B-3,M.wood[1]);ln(19,B-14,9,B-3,M.wood[2]);ln(9,B-7,19,B,M.wood[1]);
    rc(6,B-19,16,3,M.wood[2]);hl(6,B-19,16,M.wood[3]);
    for(let x=6;x<22;x+=2){vl(x,B-23,5,M.wood[3]);vl(x+1,B-22,4,M.wood[1]);px(x,B-24,M.wood[4]);}
    cone(14,B-32,B-25,9,M.thatch,{ry:1.2,tex:'thatch'});vl(8,B-25,2,M.wood[1]);vl(19,B-25,2,M.wood[1]);flag(14,B-38,6,5,3);
    break;
  case'tower1':turret(14,B,12,26,M.stone,{sq:true,tex:'stone',mw:2,flag:true});win(14,B-18,1,3,{glint:false});win(14,B-10,1,3,{glint:false});banner(9,B-22,2,5,{emb:false});door(12,B-4,4,5,M.wood,{arch:true,plank:true});break;
  case'tower2':turret(14,B,12,28,M.stone,{tex:'stone',roof:TM,rh:13,flag:true,ry:1.5});win(13,B-22,2,3,{arch:true});win(10,B-13,1,3,{glint:false});win(17,B-13,1,3,{glint:false});door(12,B-4,4,5,M.wood,{arch:true,plank:true});cren(7,B-29,14,M.stone,{mw:1,gap:1,h:1});break;
  case'tower3':
    cyl(4,B-12,20,12,M.brick,{tex:'brick',curve:2});cren(4,B-14,20,M.brick,{mw:2,gap:2});flat(5,B-13,18,1,M.brick);
    for(const x of[7,17]){rc(x,B-8,4,3,HOLE);rc(x+1,B-7,4,1,M.iron[1]);px(x+4,B-7,M.iron[3]);}
    turret(14,B-13,8,10,M.brick,{tex:'brick',mw:1,flag:true});door(12,B-4,4,5,M.dwood);
    break;
  case'tower4':
    rc(5,B-5,18,6,M.concrete[2]);wall(5,B-5,18,6,M.concrete,'plain');hl(5,B-6,18,M.concrete[4]);
    lattice(14,B-6,14,B-30,12,4,M.steel);rc(11,B-34,6,4,M.steel[2]);hl(11,B-34,6,M.steel[4]);
    ell(14,B-38,7,3,M.white[3]);ell(14,B-38,6,2,M.white[1]);vl(14,B-41,4,M.steel[1]);px(14,B-42,emi('#ff4040'));
    ln(8,B-7,4,B-10,M.iron[1]);ln(20,B-7,24,B-10,M.iron[1]);rc(6,B-8,4,2,M.iron[2]);rc(18,B-8,4,2,M.iron[2]);rc(12,B-4,4,5,M.iron[1]);hl(5,B,18,TM[2]);flag(6,B-16,8,4,2,{pole:M.iron});
    break;
  case'barracks0':
    wall(6,B-6,16,7,M.wood,'log');hip(5,22,B-7,B-14,3,M.hide,{course:0});paint(M.hide,B-10,B-10);
    door(12,B-5,4,6,null);rack(20,B);flag(6,B-21,8,4,3);skull(13,B-9);
    break;
  case'barracks1':
    wall(4,B-7,20,8,M.plaster,'timber',{b:M.dwood,posts:[6,13]});hip(3,24,B-8,B-15,3,TM,{bk:2});
    for(const x of[6,19]){ell(x+1,B-4,1.6,1.6,TM[2]);px(x+1,B-4,M.bronze[3]);}door(12,B-5,4,6,M.wood,{plank:true});rack(23,B);flag(5,B-22,7,4,3);
    break;
  case'barracks2':
    wall(3,B-10,22,11,M.stone,'stone');cren(2,B-12,24,M.stone,{mw:2,gap:1});flat(3,B-11,22,1,M.stone);
    banner(6,B-8,3,6);banner(19,B-8,3,6);door(11,B-7,6,8,M.stone,{arch:true});door(12,B-6,4,7,M.wood,{arch:true,plank:true});
    vl(25,B-6,7,M.wood[2]);hl(23,B-5,5,M.wood[2]);ell(25,B-7,1.2,1.2,M.thatch[3]);flag(13,B-20,8,5,3);
    break;
  case'barracks3':
    wall(3,B-11,22,12,M.brick,'brick');hip(2,25,B-12,B-18,2,TM,{bk:1,tex:'slate'});winGrid(5,B-9,6,1,2,3,1,0,{sill:M.stone[4]});
    door(12,B-5,4,6,M.dwood);hl(3,B-6,22,M.stone[3]);flag(14,B-27,9,6,3,{pole:M.iron});
    ell(23,B-1,2,2,M.wood[1]);rc(20,B-4,7,2,M.iron[1]);hl(20,B-4,7,M.iron[3]);px(27,B-4,INK);
    break;
  case'barracks4':
    wall(2,B-8,24,9,M.concrete,'panel');rc(2,B-11,24,3,hex('#5e6a3a'));for(let i=0;i<24;i+=3)px(2+i,B-11,hex('#7a8a4a')),px(3+i,B-10,hex('#4a5530'));
    ell(14,B-5,3,3,TM[2]);px(14,B-5,TM[4]);px(13,B-6,TM[4]);px(15,B-6,TM[4]);win(4,B-6,4,2,{glint:false});win(20,B-6,4,2,{glint:false});
    for(let x=1;x<27;x+=2)rc(x,B,2,1,M.sand[x%4?2:3]),rc(x,B-1,1,1,M.sand[3]);antenna(22,B-11,8);flag(5,B-19,8,5,3,{pole:M.iron});
    break;
  case'market0':
    for(const x of[3,15]){vl(x,B-8,9,M.wood[2]);vl(x+9,B-8,9,M.wood[1]);rc(x,B-3,10,3,M.wood[2]);hl(x,B-3,10,M.wood[3]);goods(x+1,B-4,8);rc(x-1,B-11,12,3,TM[2]);hl(x-1,B-11,12,TM[3]);hl(x-1,B-9,12,TM[1]);}
    ell(13,B,2,1.5,M.wood[2]);goods(12,B-1,3);
    break;
  case'market1':
    for(const x of[2,15]){rc(x,B-3,11,3,M.sand[2]);hl(x,B-3,11,M.sand[4]);goods(x+1,B-4,9);vl(x,B-10,8,M.wood[2]);vl(x+10,B-10,8,M.wood[1]);awning(x-1,B-12,13,2);}
    for(const x of[9,20]){ell(x,B-1,1.6,2,M.red[2]);px(x-1,B-2,M.red[4]);px(x,B-4,M.red[1]);}
    break;
  case'market2':
    wall(4,B-15,20,7,M.plaster,'timber',{b:M.dwood,posts:[6,13],brace:7});hip(3,24,B-16,B-22,3,TM,{bk:2});winGrid(6,B-13,4,1,2,2,3,0);
    rc(4,B-8,20,9,HOLE);for(const x of[4,11,17,23])vl(x,B-8,9,M.stone[x<12?3:1]);goods(6,B-1,5);goods(13,B-1,4);goods(19,B-1,3);
    awning(1,B-6,8,2);awning(19,B-6,8,2);
    break;
  case'market3':
    wall(2,B-13,24,14,M.brick,'brick');rc(2,B-14,24,1,M.stone[4]);winGrid(4,B-12,6,1,2,3,2,0,{sill:M.stone[4]});
    for(const x of[3,15]){win(x,B-5,10,4,{cross:false});goods(x+1,B-2,8);awning(x-1,B-7,12,2);}
    door(13,B-5,2,6,M.dwood);rc(8,B-16,12,2,TM[2]);hl(8,B-16,12,TM[3]);
    break;
  case'market4':
    rc(1,B-1,26,2,M.concrete[3]);facade(3,B-20,22,19,M.steel,{ww:4,wh:3,gx:1,gy:1,l:1,top:5});
    rc(3,B-5,22,5,M.glass[2]);win(4,B-4,20,4,{cross:false});rc(9,B-4,10,4,M.glass[3]);hl(9,B-4,10,M.glass[4]);
    rc(6,B-19,16,3,TM[2]);hl(6,B-19,16,TM[4]);hl(9,B-18,10,M.white[4]);flat(2,B-23,24,2,M.steel);
    break;
  case'academy1':
    steps(7,B-1,14,2,M.stone);rc(4,B-12,20,11,M.sand[2]);wall(4,B-12,20,11,M.sand,'block');rc(9,B-11,10,10,HOLE);columns(8,B-11,4,4,10,M.white);
    gable(4,20,B-13,5,4,TM,M.white,{course:0});rc(11,B-16,6,2,M.bone[3]);px(10,B-16,M.bone[1]);px(17,B-16,M.bone[1]);
    break;
  case'academy2':
    wall(4,B-13,20,14,M.stone,'stone');hip(3,24,B-14,B-21,4,TM,{bk:2});win(6,B-11,3,6,{arch:true,frame:M.stone[3]});win(19,B-11,3,6,{arch:true,frame:M.stone[3]});
    win(12,B-12,4,4,{arch:true,frame:M.stone[3]});door(12,B-6,4,7,M.wood,{arch:true,plank:true});rc(11,B-9,6,2,M.white[4]);px(14,B-9,M.white[2]);hl(11,B-7,6,M.red[2]);banner(7,B-20,2,4,{emb:false});banner(19,B-20,2,4,{emb:false});
    break;
  case'academy3':
    wall(2,B-12,24,13,M.sand,'block');winGrid(4,B-10,7,2,2,3,1,1,{sill:M.white[4]});
    cyl(9,B-18,10,6,M.sand,{tex:'stone'});dome(14,B-18,6,7,M.copper,{dither:.3});cone(14,B-28,B-25,1.6,M.gold,{ry:.3});clock(14,B-15);
    rc(10,B-5,8,5,HOLE);columns(10,B-6,3,3,6,M.white);door(13,B-4,2,5,M.dwood);
    break;
  case'academy4':
    wall(2,B-10,24,11,M.white,'plain');win(4,B-8,20,4,{cross:false});hl(2,B-10,24,TM[2]);door(12,B-3,4,4,M.glass);
    flat(1,B-13,26,2,M.white);vl(19,B-19,6,M.steel[2]);
    ell(19,B-22,7,4,M.white[3]);ell(19,B-23,6,3,M.white[4]);ell(20,B-22,4,2,M.white[2]);ln(19,B-22,23,B-27,M.steel[1]);px(23,B-28,emi('#ff5050'));
    cyl(4,B-18,7,6,M.steel);dome(7.5,B-18,4,3,M.steel);rc(7,B-21,1,3,INK);
    break;
  case'mine0':case'mine1':case'mine2':{
    sph(14,B+1,12,12,M.rock,{clipY:B});if(t===0)remap(M.rock,M.turf,(x,y)=>y<B-9+Math.abs(x-14)*.25);
    rc(10,B-7,8,8,INK);rc(11,B-6,6,7,HOLE);
    const fm=t===2?M.stone:M.wood;vl(9,B-8,9,fm[3]);vl(10,B-8,9,fm[2]);vl(17,B-8,9,fm[1]);vl(18,B-8,9,fm[0]);hl(8,B-9,12,fm[3]);hl(8,B-8,12,fm[1]);
    hl(11,B,6,M.iron[3]);oreCart(t===0?19:19,B);if(t>0)lantern(8,B-7);if(t>0)rc(19,B-1,8,1,M.wood[1]);
    if(t===2){vl(4,B-14,15,M.wood[2]);ln(4,B-14,11,B-10,M.wood[2]);vl(11,B-10,3,M.iron[1]);ell(4,B-2,2,2,M.wood[1]);}
    if(t>0)flag(16,B-21,8,4,2);
    break;}
  case'mine3':
    wall(2,B-8,12,9,M.brick,'brick');hip(1,14,B-9,B-13,2,TM,{bk:1});chim(3,B-22,3,10,M.brick,{tex:'brick',cap:true});win(5,B-6,2,3);win(10,B-6,2,3);
    ln(16,B,20,B-24,M.iron[2]);ln(25,B,20,B-24,M.iron[1]);ln(16,B-8,24,B-8,M.iron[1]);ln(17,B-16,23,B-16,M.iron[1]);ln(16,B,24,B-16,M.iron[1]);
    ln(13,B-6,19,B-22,M.iron[2]);
    ell(20,B-25,4,4,M.iron[1]);ell(20,B-25,3,3,(x,y)=>null);ell(20,B-25,3.2,3.2,M.iron[3]);ell(20,B-25,2.2,2.2,M.iron[1]);px(20,B-26,M.iron[4]);
    vl(22,B-24,24,M.iron[0]);rc(19,B-3,4,3,M.iron[2]);oreCart(14,B);
    break;
  case'mine4':
    rc(1,B-1,26,2,M.concrete[2]);hl(1,B-1,26,M.concrete[3]);sph(6,B,5,4,M.rock,{clipY:B});
    lattice(18,B-2,18,B-40,10,3,M.gold);rc(15,B-43,6,3,M.gold[2]);hl(15,B-43,6,M.gold[4]);px(18,B-44,emi('#ff4040'));
    rc(8,B-8,8,5,M.gold[2]);hl(8,B-8,8,M.gold[4]);win(13,B-7,2,2);rc(8,B-3,8,2,M.iron[1]);ln(10,B-8,4,B-16,M.gold[1]);ln(11,B-8,5,B-16,M.gold[3]);rc(2,B-17,4,3,M.iron[2]);
    break;
  case'dockhut0':
    for(const x of[6,11,17,21])vl(x,B-3,4,M.wood[1]);rc(5,B-4,18,1,M.wood[3]);
    wall(7,B-10,14,6,M.lwood,'plank');cone(14,B-19,B-10,9,M.thatch,{ry:1.2,tex:'thatch'});door(12,B-8,3,4,null);
    for(let j=0;j<5;j++)for(let i=0;i<4;i++)if((i+j)&1)px(21+i,B-10+j,M.hide[3]);vl(21,B-11,6,M.wood[2]);
    break;
  case'dockhut1':
    wall(5,B-8,18,9,M.wood,'plank');hip(4,23,B-9,B-15,3,TM,{bk:2});door(10,B-6,7,7,M.wood);rc(11,B-5,5,6,HOLE);
    ell(22,B-1,2,2,M.wood[2]);hl(20,B-1,4,M.wood[1]);ell(4,B-1,2,2,M.wood[2]);
    break;
  case'dockhut2':
    wall(3,B-10,16,11,M.stone,'stone');hip(2,19,B-11,B-17,3,TM,{bk:2});door(7,B-7,7,8,M.wood,{plank:true});
    vl(23,B-22,22,M.wood[2]);ln(23,B-22,15,B-18,M.wood[2]);vl(15,B-18,6,M.iron[0]);rc(14,B-12,3,2,M.wood[3]);
    for(const[x,y]of[[20,B],[23,B],[21,B-3]])rc(x,y-2,3,3,M.lwood[2]),hl(x,y-2,3,M.lwood[4]);
    break;
  case'dockhut3':
    wall(2,B-12,14,13,M.brick,'brick');hip(1,16,B-13,B-18,2,TM,{bk:1});door(5,B-8,8,9,M.dwood,{plank:true});
    lattice(22,B,22,B-30,5,3,M.red);ln(22,B-30,12,B-26,M.red[2]);ln(22,B-29,12,B-25,M.red[1]);hl(22,B-31,4,M.red[3]);rc(24,B-30,3,3,M.iron[1]);
    vl(13,B-25,8,M.iron[0]);rc(12,B-17,3,2,M.iron[3]);for(let x=17;x<26;x+=4)rc(x,B-3,3,4,[M.wood[2],TM[2],M.red[2]][x%3]);
    break;
  case'dockhut4':
    lattice(6,B,6,B-30,3,3,M.gold);lattice(22,B,22,B-30,3,3,M.gold);rc(2,B-33,26,3,M.gold[2]);hl(2,B-33,26,M.gold[4]);hl(2,B-31,26,M.gold[1]);
    rc(13,B-30,5,3,M.iron[2]);vl(15,B-27,10,M.iron[0]);rc(12,B-17,7,4,TM[2]);hl(12,B-17,7,TM[3]);
    for(const[x,y,c]of[[8,B,M.red],[15,B,TEAM],[8,B-4,M.teal],[15,B-4,M.rust]])wall(x,y-3,7,4,c,'corr'),hl(x,y-3,7,rk(c,3));
    break;
  }
  add(kind+'_'+t,cx,B);
}
GENS.push(()=>{
  for(let t=0;t<5;t++)for(const k of['tower','barracks','market','mine','dockhut'])civic(k,t);
  for(let t=1;t<5;t++)civic('academy',t);
});

/* ---------- misc structures ---------- */
function sail(cx,cy,ang,len,m){ // one windmill sail: spar + lattice cloth on the trailing side
  const c=Math.cos(ang),s=Math.sin(ang),qx=-s,qy=c;
  poly([cx+c*3+qx*.5,cy+s*3+qy*.5,cx+c*len+qx*.5,cy+s*len+qy*.5,cx+c*len+qx*3.6,cy+s*len+qy*3.6,cx+c*3+qx*3.6,cy+s*3+qy*3.6],(x,y)=>{
    const dx=x+.5-cx,dy=y+.5-cy,al=dx*c+dy*s,ac=dx*qx+dy*qy;return(Math.round(al)%3===0||ac>3)?MT.wood[2]:m[ac<2?4:3];});
  ln(cx+c*1.5,cy+s*1.5,cx+c*len,cy+s*len,MT.wood[1]);
}
function misc(){
  const M=MT,TM=TEAM,FO=FOL;
  /* piers */
  cv(26,9);for(let x=1;x<25;x+=5){vl(x,4,5,M.wood[1]);vl(x+1,4,4,M.wood[0]);}
  rc(0,0,25,4,M.lwood[2]);for(let x=0;x<25;x+=3)vl(x,0,4,M.lwood[x%2?3:1]);hl(0,0,25,M.lwood[4]);hl(0,4,25,M.wood[1]);
  add('pierh',0,4);
  cv(8,26);rc(1,0,6,24,M.lwood[2]);for(let y=0;y<24;y+=3)hl(1,y,6,M.lwood[y%2?3:1]);vl(1,0,24,M.lwood[4]);vl(6,0,24,M.lwood[0]);
  for(let y=4;y<24;y+=8){vl(0,y,2,M.wood[2]);vl(7,y,2,M.wood[1]);}rc(1,24,6,1,M.wood[1]);vl(1,24,2,M.wood[1]);vl(6,24,2,M.wood[0]);
  add('pierv',3,0);
  /* windmill */
  for(let f=0;f<3;f++){
    cv(32,40);const B=39;
    poly([9,B+1,23,B+1,20,B-20,12,B-20],(x,y)=>{const u=(x-16)/7;let k=cylK(u);if((B-y)%4===3)k--;return rk(M.plaster,k);});
    wall(9,B-2,14,3,M.stone,'stone');door(14,B-6,4,7,M.wood,{arch:true,plank:true});win(15,B-14,2,2);
    cone(16,B-29,B-20,6.5,M.thatch,{ry:1.2,tex:'thatch'});
    for(let i=0;i<4;i++)sail(16,B-22,f*Math.PI/6+i*Math.PI/2+.3,14,M.plaster);
    ell(16,B-22,1.5,1.5,M.wood[1]);px(16,B-23,M.wood[3]);
    add('windmill_'+f,16,B);
  }
  /* wind turbine */
  for(let f=0;f<3;f++){
    cv(30,48);const B=47,hx=15,hy=B-30;
    for(let j=0;j<=30;j++){const w=j<10?3:2;hl(hx-1,B-j,w,M.white[3]);px(hx-1,B-j,M.white[4]);px(hx-2+w,B-j,M.white[1]);}
    rc(hx-1,hy-2,5,3,M.white[3]);hl(hx-1,hy-2,5,M.white[4]);px(hx+3,hy,M.white[1]);
    for(let i=0;i<3;i++){const a=f*Math.PI*2/9+i*Math.PI*2/3-Math.PI/2;for(let d=1;d<=13;d+=.5){const x=hx+Math.cos(a)*d,y=hy+Math.sin(a)*d;px(Math.floor(x),Math.floor(y),d<11?M.white[3]:M.white[2]);if(d<7)px(Math.floor(x-Math.sin(a)),Math.floor(y+Math.cos(a)),M.white[2]);}}
    px(hx,hy,M.white[4]);px(hx,hy-3,emi('#ff4040'));hl(hx-3,B,7,M.concrete[2]);
    add('turbine_'+f,hx,B);
  }
  /* factories */
  {cv(30,48);const B=47;
    chim(6,B-36,4,22,M.brick,{tex:'brick',cap:true});hl(6,B-30,4,M.stone[3]);chim(13,B-32,3,18,M.brick,{tex:'brick',cap:true});hl(13,B-26,3,M.stone[3]);
    wall(2,B-13,26,14,M.brick,'brick');for(let i=0;i<4;i++){const x=2+i*6.5;poly([x,B-13,x+6.5,B-13,x+6.5,B-19],(xx,y)=>y>B-15?TM[1]:TM[2]);poly([x+6.5,B-19,x+6.5,B-13,x+7.5,B-13],WN);}
    winGrid(4,B-11,6,1,2,4,2,0,{frame:M.brick[1]});rc(20,B-5,6,6,M.iron[1]);for(let y=B-5;y<=B;y+=2)hl(20,y,6,M.iron[2]);rc(3,B-5,4,2,TM[2]);
    add('factory_3',15,B);}
  {cv(34,48);const B=47;
    for(let j=0;j<26;j++){const t=j/25,w=Math.round(8-5*Math.sin(t*Math.PI*.85)),cx=9;for(let i=-w;i<w;i++){const u=(i+.5)/w;px(cx+i,B-j,rk(M.concrete,cylK(u)+(j%5===0?0:0)));}}
    ell(9,B-26,4.5,1,M.concrete[1]);hl(4,B-26,10,M.concrete[4]);
    wall(15,B-14,17,15,M.white,'panel');winGrid(17,B-12,4,2,3,2,1,2);hl(15,B-15,17,TM[2]);hl(15,B-14,17,TM[1]);
    chim(26,B-28,3,14,M.white,{cap:true});hl(26,B-24,3,M.red[3]);hl(26,B-20,3,M.red[3]);rc(19,B-4,6,5,M.steel[1]);
    ln(15,B-6,9,B-6,M.steel[2]);add('factory_4',17,B);}
  /* walls: drawn 3x wide then cropped to exactly 16 for seamless tiling */
  const wallH=(t,dw)=>{const S=cv(48,26),B=25;
    for(let o=0;o<48;o+=16){
      if(t===1){for(let x=0;x<16;x+=2){const h=14+((x*5)%3),X=o+x;vl(X,B-h,h+1,M.wood[2]);vl(X+1,B-h+1,h,M.wood[1]);px(X,B-h-1,M.wood[4]);px(X+1,B-h,M.wood[3]);}hl(o,B-4,16,M.dwood[1]);hl(o,B-11,16,M.dwood[1]);}
      if(t===2){wall(o,B-12,16,13,M.stone,'stone',{sh:0});rc(o,B-15,16,3,M.stone[3]);hl(o,B-15,16,M.stone[4]);for(let x=0;x<16;x+=4){rc(o+x,B-17,2,2,M.stone[3]);hl(o+x,B-17,2,M.stone[4]);px(o+x+1,B-16,M.stone[2]);}hl(o,B-12,16,M.stone[1]);px(o+7,B-8,INK);px(o+7,B-7,INK);}
      if(t===3){wall(o,B-15,16,16,M.stone,'block',{sh:0});poly([o,B+1,o+16,B+1,o+16,B-5,o,B-5],(x,y)=>rk(M.dstone,y>B-2?1:2));for(let x=0;x<16;x+=3)px(o+x,B-3,M.dstone[1]);
        rc(o,B-19,16,4,M.brick[2]);hl(o,B-19,16,M.brick[4]);hl(o,B-16,16,M.brick[0]);for(let x=1;x<16;x+=5){rc(o+x,B-22,3,3,M.brick[3]);hl(o+x,B-22,3,M.brick[4]);px(o+x+2,B-21,M.brick[1]);}rc(o+7,B-11,2,3,INK);}
    }
    outline(S);const P=new Uint32Array(18*S.h);for(let y=0;y<S.h;y++)for(let x=0;x<16;x++)P[y*18+x+1]=S.p[y*S.w+x+17];
    S.w=18;S.p=P;add('wall_'+t,8,B,false);
  };
  const wallV=(t)=>{const S=cv(14,80),top=1,len=16,fh=t===1?14:t===2?13:16;
    for(let o=0;o<3;o++){const y0=o*16;
      if(t===1){for(let y=0;y<16;y+=2){ell(7,y0+y+1,2.5,1.2,M.wood[3]);px(6,y0+y,M.wood[4]);px(8,y0+y+1,M.wood[1]);}}
      if(t===2){rc(3,y0,8,16,M.stone[3]);vl(3,y0,16,M.stone[4]);vl(10,y0,16,M.stone[1]);for(let y=0;y<16;y+=4){rc(2,y0+y,2,2,M.stone[4]);rc(10,y0+y,2,2,M.stone[2]);px(11,y0+y+1,M.stone[1]);}for(let y=2;y<16;y+=4)hl(4,y0+y,6,M.stone[2]);}
      if(t===3){rc(2,y0,10,16,M.brick[2]);vl(2,y0,16,M.brick[4]);vl(11,y0,16,M.brick[0]);for(let y=0;y<16;y+=5){rc(1,y0+y,3,3,M.brick[3]);hl(1,y0+y,3,M.brick[4]);rc(10,y0+y,3,3,M.brick[2]);}for(let y=1;y<16;y+=3)hl(4,y0+y,6,M.brick[1]);}
    }
    const fy=48;
    if(t===1){for(let x=4;x<10;x+=2){vl(x,fy,fh,M.wood[2]);vl(x+1,fy,fh,M.wood[1]);}}
    if(t===2)wall(3,fy,8,fh,M.stone,'stone',{sh:1});
    if(t===3){wall(2,fy,10,fh,M.stone,'block',{sh:1});rc(1,fy+fh-5,12,5,M.dstone[2]);hl(1,fy+fh-5,12,M.dstone[3]);}
    outline(S);const P=new Uint32Array(S.w*(32+fh+2)),off=33;
    for(let y=0;y<16+fh+1;y++)for(let x=0;x<S.w;x++)P[(y+1)*S.w+x]=S.p[(y+off)*S.w+x];
    S.h=16+fh+2;S.p=P;add('wallv_'+t,7,16+fh-1,false);
  };
  for(let t=1;t<4;t++){wallH(t);wallV(t);}
  /* lighthouses */
  for(let t=1;t<5;t++){
    cv(20,52);const B=51,cx=10,h=t===1?30:36;
    poly([cx-5,B+1,cx+5,B+1,cx+3.5,B-h,cx-3.5,B-h],(x,y)=>{const u=(x+.5-cx)/(5-1.5*(B-y)/h);let k=cylK(u);
      if(t===1){if((B-y)%3===2)k--;return rk(M.sand,k);}
      if(t===2)return((B-y)%10<5)?rk(M.stone,k):rk(M.white,k);
      if(t===3)return((B-y)%10<5)?TEAM[Math.max(0,Math.min(4,k))]:rk(M.white,k);
      return rk(M.white,k+((B-y)%12<2?-1:0));});
    const ty=B-h;door(cx-1,B-4,2,5,M.wood);win(cx-.5,B-h*.55,1,2,{glint:false});
    if(t===1){rc(cx-5,ty-1,10,2,M.sand[3]);hl(cx-5,ty-1,10,M.sand[4]);rc(cx-2,ty-4,5,3,emi('#ff8a30'));rc(cx-1,ty-6,3,3,emi('#ffc040'));px(cx,ty-7,emi('#fff0a0'));px(cx-3,ty-3,emi('#ff6a20'));px(cx+3,ty-3,emi('#ff6a20'));}
    else{rc(cx-5,ty-1,10,2,M.iron[2]);hl(cx-5,ty-1,10,M.iron[4]);rc(cx-3,ty-6,6,5,M.iron[1]);rc(cx-2,ty-6,4,5,emi('#ffe680'));px(cx-1,ty-5,emi('#ffffff'));vl(cx-3,ty-6,5,M.iron[2]);
      cone(cx,ty-10,ty-6,3.6,t===4?M.white:t===2?TEAM:M.red,{ry:.6});px(cx-.5,ty-11,t===4?emi('#ff4040'):M.iron[3]);}
    add('lighthouse_'+t,cx,B);
  }
  /* arenas 2x2 */
  {cv(46,34);const B=33,cx=23;
    ell(cx,B-14,21,13,M.sand[1]);ell(cx,B-14,20,12,M.sand[3]);
    ell(cx,B-14,17,9.5,(x,y)=>((y-B)&1)?M.stone[3]:M.stone[2]);ell(cx,B-13,11,6,M.sand[2]);ell(cx,B-13,10,5,M.sand[3]);ell(cx-2,B-14,4,2,M.sand[4]);
    ell(cx,B-14,21,13,(x,y)=>y>B-14?null:null);
    for(let x=2;x<44;x++){const u=(x+.5-cx)/21,yb=Math.round(B-14+13*Math.sqrt(Math.max(0,1-u*u)));const k=cylK(u);
      for(let y=yb-10;y<=yb;y++){let c=rk(M.sand,k);const r=yb-y;if((r===3||r===7)&&((x+1)%4!==0))c=rk(M.sand,k-1);
        if((r===1||r===2||r===5||r===6)&&x%4===1)c=HOLE;if(r===9||r===10)c=rk(M.sand,k+1);px(x,y,c);}}
    for(const x of[6,16,30,40])banner(x,B-12+Math.round(Math.abs(x-23)*.12),2,3,{emb:false});
    flag(4,B-26,6,4,2,{pole:M.wood});flag(42,B-26,6,4,2,{pole:M.wood});
    add('arena_1',cx,B);}
  {cv(46,34);const B=33,cx=23;
    ell(cx,B-12,21,12,M.concrete[1]);ell(cx,B-12,20,11,(x,y)=>((x+y)%3===0?TEAM[1]:TEAM[2]));ell(cx,B-12,14,7,M.concrete[3]);
    ell(cx,B-12,12,5.5,hex('#4e9a3a'));ell(cx,B-12,12,5.5,(x,y)=>(x>>1)%2?hex('#5aa844'):null);rc(cx-11,B-12,22,1,hex('#e8f0e0'));vl(cx,B-17,11,hex('#e8f0e0'));ell(cx,B-12,2,1.2,(x,y)=>hex('#e8f0e0'));
    for(let x=2;x<44;x++){const u=(x+.5-cx)/21,yb=Math.round(B-12+12*Math.sqrt(Math.max(0,1-u*u)));const k=cylK(u);for(let y=yb-5;y<=yb;y++){let c=rk(M.white,k);if(yb-y===2)c=rk(M.glass,k);if(yb-y===5)c=TEAM[3];px(x,y,c);}}
    for(const x of[3,43]){vl(x,B-30,22,M.steel[2]);rc(x-2,B-32,5,2,M.steel[1]);hl(x-2,B-32,5,emi('#fff4c0'));}
    add('arena_4',cx,B);}
  /* launchpad + rocket + exhaust */
  {cv(44,52);const B=51,cx=22;
    poly([3,B-1,41,B-1,38,B-12,6,B-12],(x,y)=>rk(M.concrete,(x+y)%9===0?2:3));hl(3,B,39,M.concrete[1]);hl(6,B-12,33,M.concrete[4]);
    for(let x=4;x<41;x++){px(x,B-1,((x>>1)&1)?hex('#f2c230'):INK);}
    ell(cx,B-6,8,3.5,M.concrete[1]);ell(cx,B-6,7,3,TEAM[2]);ell(cx,B-6,4,1.7,M.concrete[0]);ell(cx,B-6,3,1.2,INK);
    lattice(34,B-9,34,B-48,6,6,M.red);rc(31,B-49,7,2,M.red[3]);for(const y of[B-38,B-26,B-16]){hl(26,y,7,M.red[2]);hl(26,y+1,7,M.red[0]);}
    px(34,B-50,emi('#ff4040'));rc(8,B-16,6,5,M.white[3]);hl(8,B-16,6,M.white[4]);win(9,B-15,4,2,{cross:false});
    add('launchpad',cx,B);}
  {cv(11,32);const B=31,cx=5;
    for(let j=0;j<30;j++){const w=j<22?3.5:j<27?3.5-(j-22)*.55:Math.max(.5,3.5-(j-22)*.55);for(let i=Math.floor(cx-w);i<Math.ceil(cx+w);i++){const u=(i+.5-cx)/4;let c=rk(M.white,cylK(u));if(j>=13&&j<16)c=TEAM[Math.max(0,Math.min(4,cylK(u)))];if(j>=27)c=TEAM[Math.max(0,Math.min(4,cylK(u)))];if(j===20&&i===cx)c=WN;px(i,B-1-j,c);}}
    poly([1.5,B-7,-1,B+1,1.5,B-1],M.iron[2]);poly([8.5,B-7,11,B+1,8.5,B-1],M.iron[1]);rc(3,B,5,1,M.iron[1]);vl(5,B-9,9,M.white[1]);
    add('rocket',cx,B);}
  for(let f=0;f<3;f++){cv(11,16);seed=f*99+7;
    for(let j=0;j<15;j++){const w=Math.max(.6,(j<4?2.2+j*.5:4.2-(j-4)*.36)*(1+(rnd()-.5)*.25));for(let i=Math.floor(5.5-w);i<Math.ceil(5.5+w);i++){const d=Math.abs(i+.5-5.5)/w+j/16;px(i,j,emi(d<.45?'#ffffff':d<.75?'#ffe680':d<1.05?'#ffa030':'#e8502a'));}}
    add('exhaust_'+f,5,0,false);}
  /* scaffolds */
  const scaf=(w,h,name)=>{cv(w,h);const W=M.lwood;for(let x=0;x<w;x+=Math.ceil(w/3)-1){vl(x,0,h,W[2]);}vl(w-1,0,h,W[1]);
    for(let y=2;y<h;y+=6){hl(0,y,w,W[3]);hl(0,y+1,w,W[1]);}for(let y=2;y+6<h;y+=6)ln(1,y+6,Math.min(w-2,h/2),y+1,W[1]);add(name,w>>1,h-1);};
  scaf(16,18,'scaffold');scaf(34,36,'scaffold2');
  /* farm bits */
  cv(12,10);sph(6,9,6,8,M.thatch,{clipY:9});for(let i=0;i<10;i++){seed=i+3;px(rint(1,10),rint(2,8),M.thatch[rint(0,1)]);}hl(1,9,10,M.thatch[1]);add('haystack',6,9);
  cv(11,15);vl(5,2,13,M.wood[1]);hl(1,5,9,M.wood[2]);rc(3,4,5,5,TM[2]);hl(3,4,5,TM[3]);vl(7,4,5,TM[1]);px(1,6,M.thatch[3]);px(9,6,M.thatch[3]);px(4,9,M.thatch[3]);px(6,9,M.thatch[2]);
  ell(5.5,2.5,1.6,1.6,M.thatch[3]);hl(2,1,7,M.thatch[2]);rc(4,0,3,1,M.thatch[3]);px(5,3,INK);add('scarecrow',5,14);
  cv(12,14);vl(5,8,6,M.wood[2]);vl(6,8,5,M.wood[1]);sph(6,5.5,5.5,5,FO);for(const[x,y]of[[3,4],[8,3],[5,7],[9,6],[4,1],[7,8]]){px(x,y,hex('#e8402e'));}px(3,3,hex('#ff9a7a'));px(8,2,hex('#ff9a7a'));add('grove',6,13);
}
GENS.push(misc);

/* ---------- wonders (2x2) ---------- */
function wonders(){
  const M=MT,TM=TEAM,FO=FOL;
  /* Stonehenge */
  {cv(48,32);const B=31,cx=24;ell(cx,B-8,23,9,M.turf[1]);ell(cx,B-8,22,8,M.turf[2]);ell(cx-4,B-10,12,4,M.turf[3]);
    const st=[];for(let i=0;i<14;i++){const a=i/14*Math.PI*2;st.push([cx+Math.cos(a)*17,B-8+Math.sin(a)*6.5,a]);}
    const inner=[[cx-7,B-10],[cx,B-12],[cx+7,B-10]];
    const draw=(x,y,w,h,lint)=>{x=Math.round(x-w/2);y=Math.round(y);rc(x,y-h+1,w,h,M.stone[2]);vl(x,y-h+1,h,M.stone[3]);vl(x+w-1,y-h+1,h,M.stone[1]);hl(x,y,w,M.stone[1]);px(x+1,y-h+3,M.turf[3]);if(lint)rc(x-1,y-h-1,w+2+lint,2,M.stone[3]),hl(x-1,y-h-1,w+2+lint,M.stone[4]);};
    const all=st.map(([x,y,a],i)=>({x,y,w:3,h:10,l:(i%2===0&&Math.sin(a)<.3)?4:0})).concat(inner.map(([x,y])=>({x,y,w:4,h:14,l:0})));
    all.sort((a,b)=>a.y-b.y);for(const s of all)draw(s.x,s.y,s.w,s.h,s.l);
    rc(cx-9,B-26,7,2,M.stone[3]);hl(cx-9,B-26,7,M.stone[4]);rc(cx+5,B-26,6,2,M.stone[3]);hl(cx+5,B-26,6,M.stone[4]);
    menhir(cx-15,B-4,3,2,M.stone);rc(cx-2,B-8,5,2,M.stone[1]);hl(cx-2,B-8,5,M.stone[3]);
    add('wonder_stones',cx,B);}
  /* Great Pyramid */
  {cv(48,44);const B=43,cx=24,ax=21,ay=B-38,x0=2,xm=33,x1=46,yb=B-9;
    poly([xm,B+1,x1+1,yb,ax+.5,ay],(x,y)=>rk(M.sand,(B-y)%3===0?0:1));
    poly([x0,B+1,xm+.5,B+1,ax+.5,ay],(x,y)=>{const u=(x-x0)/(xm-x0);return rk(M.sand,((B-y)%3===0?2:3)+(u<.25&&(B-y)%3?1:0));});
    ln(x0,B,ax,ay,M.sand[4]);ln(ax,ay,xm,B,M.sand[2]);ln(ax+1,ay+1,x1,yb,M.sand[0]);
    poly([ax+.5,ay-1,ax-3,ay+6,ax+4,ay+6],(x,y)=>x<ax?M.gold[4]:M.gold[2]);px(ax,ay+1,M.gold[3]);
    rc(16,B-4,3,4,HOLE);hl(15,B-5,5,M.sand[4]);
    add('wonder_pyramid',cx,B);}
  /* Colossus */
  {cv(36,68);const B=67,cx=18,P=M.copper;
    sph(cx,B+1,16,6,M.rock,{clipY:B});ell(cx-9,B-1,3,1,hex('#5aa8d0'));ell(cx+10,B,4,1,hex('#5aa8d0'));
    wall(cx-8,B-14,17,11,M.stone,'block');rc(cx-9,B-15,19,2,M.stone[3]);hl(cx-9,B-15,19,M.stone[4]);hl(cx-9,B-4,19,M.stone[1]);
    const fig=[
      '.......aaa........',
      '......aAAAa.......',
      '.....aaAAaaa......',
      '......aAAaa.......',
      '......Aaaab.......',
      '.....AAaabbb......',
      '....AAAaabbbb.....',
      '...AAAaaaabbbb....',
      '..AA.AAaaaabb.bb..',
      '..A..AAaaaabb..b..',
      '.AA..AAaaaabb..bb.',
      '.A...AAAaaabb...b.',
      '.....AAAaaabb.....',
      '.....AAaaaabb.....',
      '.....AAaaaabbb....',
      '.....AAaaa.abb....',
      '.....AAaa...bb....',
      '.....AAaa...bb....',
      '.....AAa....bb....',
      '.....AAa....abb...',
      '.....AAa.....bb...',
      '....AAa......abb..',
      '....AAa.......bb..',
      '...AAAa......abbb.',
      '...AAaa......abbb.',
    ];
    const big=(x0,y0)=>{for(let j=0;j<fig.length;j++)for(let i=0;i<fig[j].length;i++){const ch=fig[j][i];if(ch==='.')continue;const c=ch==='A'?P[3]:ch==='a'?P[2]:P[1];rc(x0+i*1,y0+j*2,1,2,c);}};
    big(cx-9,B-66);
    rc(cx-4,B-55,9,3,P[2]);hl(cx-4,B-55,9,P[3]);for(let x=cx-3;x<cx+5;x+=2)px(x,B-56,M.gold[3]);
    for(const[a,b]of[[cx-3,B-65],[cx-1,B-67],[cx+1,B-67],[cx+3,B-65]])px(a,b,M.gold[3]);
    vl(cx-7,B-62,10,P[2]);px(cx-7,B-63,M.gold[3]);rc(cx-9,B-66,5,3,M.gold[2]);
    px(cx-8,B-67,emi('#ffd060'));px(cx-7,B-68,emi('#ffb030'));px(cx-7,B-67,emi('#ffffff'));px(cx-6,B-67,emi('#ff7a20'));px(cx-7,B-66,emi('#ffe080'));
    px(cx-1,B-62,INK);px(cx+1,B-62,P[0]);
    add('wonder_colossus',cx,B);}
  /* Great Library */
  {cv(48,44);const B=43,cx=24;
    dome(cx,B-24,13,13,M.white,{dither:.3});rc(cx-1,B-38,3,2,M.gold[3]);px(cx,B-39,M.gold[4]);
    cyl(cx-13,B-26,26,4,M.white);hl(cx-13,B-26,26,M.gold[3]);
    steps(8,B-3,32,4,M.white);rc(6,B-19,36,16,HOLE);
    for(let i=0;i<8;i++)win(9+i*4,B-15,2,4,{glint:false,dk:false});door(21,B-11,6,8,M.bronze,{plank:true});
    columns(6,B-19,9,4.3|0,16,M.white,{w3:true});rc(4,B-21,40,2,M.white[3]);hl(4,B-21,40,M.white[4]);hl(4,B-20,40,M.gold[2]);
    gable(5,38,B-22,7,4,M.white,M.white,{course:0});rc(18,B-26,12,2,TM[2]);ell(cx,B-25,2.5,1.5,M.gold[3]);
    banner(2,B-18,3,8);banner(43,B-18,3,8);
    add('wonder_library',cx,B);}
  /* Gothic cathedral */
  {cv(46,70);const B=69,cx=23;
    wall(10,B-30,26,31,M.stone,'stone');gable(10,26,B-31,12,6,TM,M.stone);rose(cx,B-24,5);
    door(18,B-11,10,12,M.stone,{arch:true});door(19,B-10,8,11,M.wood,{arch:true,plank:true});vl(23,B-10,11,M.iron[1]);
    for(const x of[12,31])win(x,B-20,3,9,{arch:true,frame:M.stone[3]});
    for(const x of[2,35]){wall(x,B-40,9,41,M.stone,'stone');win(x+3,B-36,3,7,{arch:true,frame:M.stone[3]});win(x+3,B-24,3,6,{arch:true});door(x+3,B-7,3,8,M.wood,{arch:true});
      cren(x-1,B-42,11,M.stone,{mw:1,gap:1});cone(x+4.5,B-66,B-41,5.5,TM,{ry:.8});px(x+4,B-67,M.gold[4]);hl(x+3,B-68,3,M.gold[3]);px(x+4,B-69,M.gold[3]);}
    for(const x of[10,35])vl(x,B-30,31,M.stone[1]);
    add('wonder_cathedral',cx,B);}
  /* Observatory */
  {cv(46,44);const B=43,cx=23;
    steps(10,B-2,26,3,M.white);wall(6,B-14,34,12,M.white,'block');winGrid(8,B-12,7,1,2,4,2,0,{arch:true});door(21,B-9,4,7,M.copper,{arch:true});
    cyl(13,B-22,20,8,M.white);hl(13,B-22,20,M.copper[3]);
    dome(cx,B-22,12,13,M.white,{dither:.25});poly([cx-1,B-35,cx+3,B-35,cx+3,B-22,cx-1,B-22],(x,y)=>INK);
    ln(cx+1,B-26,cx+12,B-38,M.steel[2]);ln(cx+2,B-26,cx+13,B-37,M.steel[1]);ln(cx,B-27,cx+11,B-39,M.steel[3]);rc(cx+11,B-41,3,3,M.brass[3]);
    for(const x of[6,40]){cyl(x-4,B-20,8,6,M.white);dome(x,B-20,4,4,M.copper,{dither:.2});}
    add('wonder_observatory',cx,B);}
  /* Iron tower */
  {cv(42,76);const B=75,cx=21,I=[hex('#2e2620'),hex('#4a3a2e'),hex('#6a5442'),hex('#8c7058'),hex('#ae9070')];
    const hw=(j)=>j<20?18-j*.42:j<44?9.6-(j-20)*.2:Math.max(.6,4.8-(j-44)*.18);
    for(let j=0;j<70;j++){const w=hw(j),y=B-j,l=Math.round(cx-w),r=Math.round(cx+w)-1;
      px(l,y,I[3]);px(l+1,y,I[2]);px(r,y,I[1]);px(r-1,y,I[1]);
      if(w>3){const ph=j%6;const a=Math.round(l+(r-l)*ph/12),b=Math.round(r-(r-l)*ph/12);px(a+1,y,I[2]);px(b-1,y,I[1]);px(Math.round(cx-w/2)+(ph<3?ph:5-ph),y,I[2]);px(Math.round(cx+w/2)-(ph<3?ph:5-ph),y,I[1]);}
      else if(w>1)rc(l,y,r-l+1,1,j%3?I[2]:I[3]);}
    for(let x=-11;x<=11;x++){const y=Math.round(B-9+Math.sqrt(1-(x/12)**2)*-5);px(cx+x,y,I[2]);px(cx+x,y+1,I[1]);}
    rc(cx-12,B-21,24,2,I[3]);hl(cx-12,B-21,24,I[4]);rc(cx-12,B-19,24,1,I[0]);
    rc(cx-7,B-45,14,2,I[3]);hl(cx-7,B-45,14,I[4]);rc(cx-3,B-63,6,2,I[3]);
    vl(cx,B-72,4,I[2]);px(cx,B-73,emi('#ff5040'));px(cx-6,B-20,emi('#ffd27a'));px(cx+5,B-20,emi('#ffd27a'));px(cx-2,B-44,emi('#ffd27a'));px(cx+2,B-44,emi('#ffd27a'));
    add('wonder_irontower',cx,B);}
  /* Sky spire */
  {cv(36,76);const B=75,cx=18;seed=777;
    rc(4,B-4,28,5,M.steel[2]);hl(4,B-4,28,M.steel[4]);win(6,B-3,24,4,{cross:false});hl(4,B-5,28,TM[2]);
    let y=B-6;for(const[w,h]of[[22,24],[18,18],[14,14],[10,8]]){const x=cx-w/2;
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){const u=i/w;let c=(i===0)?M.steel[4]:(i===w-1)?M.steel[1]:(j%3===2)?M.steel[u<.6?3:2]:winL(u>.75?110:u<.3?190:WLV[rint(1,6)]);px(x+i,y-j,c);}
      hl(x,y-h,w,M.steel[4]);hl(x+1,y-h+1,w-2,TM[2]);y-=h+1;}
    poly([cx-5,y+1,cx+5,y+1,cx,y-6],(x,yy)=>x<cx?M.steel[4]:M.steel[2]);vl(cx,y-14,9,M.steel[3]);px(cx,y-15,emi('#ffffff'));px(cx,y-16,emi('#a0e8ff'));px(cx-1,y-15,emi('#60c8ff'));px(cx+1,y-15,emi('#60c8ff'));
    add('wonder_skyspire',cx,B);}
  /* Stargate */
  {cv(46,46);const B=45,cx=23,cy=B-22,R=17;
    poly([1,B+1,45,B+1,40,B-8,6,B-8],(x,y)=>rk(M.concrete,y<B-6?4:y>B-1?1:(x+y)%7?3:2));rc(15,B-11,16,4,M.concrete[2]);hl(15,B-11,16,M.concrete[4]);
    for(let x=6;x<40;x+=4)px(x,B-4,emi('#40e8ff'));
    for(let y=cy-R;y<=cy+R;y++)for(let x=cx-R;x<=cx+R;x++){const dx=x+.5-cx,dy=(y+.5-cy)*1.05,d=Math.sqrt(dx*dx+dy*dy);
      if(d<R-4){const a=Math.atan2(dy,dx),sw=Math.sin(a*3+d*.55)*.5+.5,k=d/(R-4);px(x,y,emi(k<.25?'#e8ffff':sw>.6?(k<.6?'#8ef0ff':'#3cb8f0'):(k<.6?'#58d0ff':'#2878d8')));}
      else if(d<R){const a=Math.atan2(dy,dx);let k=cylK(-Math.cos(a+.8)*.9);let c=rk(M.steel,k);if(d>R-1)c=rk(M.steel,k-1);if(d<R-3)c=rk(M.steel,k-1);
        const ch=((a+Math.PI)/(Math.PI*2)*9)%1;if(ch<.18&&d>R-3&&d<R-.6)c=emi('#7ff8ff');px(x,y,c);}}
    add('wonder_stargate',cx,B);}
}
GENS.push(wonders);

/* ---------- nature ---------- */
/* canopy of blobs: each blob sphere-shaded, blended with a global sphere so the whole crown reads as one volume */
function canopy(blobs,gcx,gcy,grx,gry,m,o){
  o=o||{};const g=(x,y)=>{const u=(x+.5-gcx)/grx,v=(y+.5-gcy)/gry;return -.5*u-.62*v+.6*Math.sqrt(Math.max(0,1-Math.min(1,u*u+v*v)));};
  for(const[x,y,rx,ry]of blobs)sph(x,y,rx,ry||rx,m,{g,dither:o.dither==null?.5:o.dither,bias:o.bias||0});
  if(o.speck){seed=o.speck;for(let i=0;i<o.n;i++){const x=Math.round(gcx+(rnd()-.5)*grx*1.6),y=Math.round(gcy+(rnd()-.5)*gry*1.6),c=getPx(x,y);const k=m.indexOf(c);if(k>0&&k<m.length-1)px(x,y,m[k+(rnd()<.5?1:-1)]);}}
}
function trunk(x,yb,h,w,m){m=m||MT.wood;for(let j=0;j<h;j++)for(let i=0;i<w;i++)px(x+i,yb-j,m[i===0?3:i===w-1?1:2]);px(x-1,yb,m[2]);px(x+w,yb,m[1]);}
function nature(){
  const M=MT,FO=FOL;
  /* oaks */
  const oaks=[
    [[7,8,5],[4,10,3.5],[10,10,3.5],[7,5,4]],
    [[8,9,5.5],[4,10,4],[12,10,4],[6,5,4],[10,6,4]],
    [[7,9,4.5],[7,4,4],[4,8,3.5],[10,8,3.5],[7,13,3.5]]];
  oaks.forEach((bl,v)=>{cv(16,20);const yb=19,tx=6+(v===1?1:0);trunk(tx,yb,7,3);px(tx+1,yb-6,M.wood[0]);
    canopy(bl,v===1?8:7,v===2?8:7.5,7,7,FO,{speck:v*11+1,n:14});add('oak_'+v,tx+1,yb);});
  /* bare trees */
  for(let v=0;v<2;v++){cv(16,20);const yb=19,G=[hex('#3a2c26'),hex('#55423a'),hex('#6e5a4e'),hex('#8a7464')];trunk(7,yb,8,2,G);
    const br=v?[[8,12,3,6],[8,12,13,5],[8,9,6,2],[8,10,11,1],[4,6,2,3],[12,6,14,2],[8,8,8,0]]:[[8,12,3,5],[8,11,13,4],[8,9,5,1],[9,9,11,0],[3,5,1,2],[13,4,15,3]];
    for(const[a,b,c,d]of br)ln(a,b,c,d,G[a<c?1:2]);for(const[a,b,c,d]of br)px(c,d,G[3]);add('oakbare_'+v,8,yb);}
  /* pines */
  const pine=(v,snow)=>{cv(14,24);const yb=23,cx=7,tiers=v===1?4:3,top=v===2?1:3;trunk(cx-1,yb,4,2);
    for(let t=0;t<tiers;t++){const y0=top+t*((yb-4-top)/tiers),y1=y0+((yb-3-top)/tiers)+2,w=2.2+(t+1)*(v===2?1.2:1.45);
      poly([cx,y0,cx+w+.5,y1,cx-w-.5,y1],(x,y)=>{const u=(x+.5-cx)/w,r=(y-y0)/(y1-y0);let k=u<-.15?3:u<.35?2:1;if(r>.85)k--;if(u<-.5&&r<.6)k=4;if(((x*7+y*3)%9)===0)k--;if(snow&&(y<y0+2+(u<0?1:0)||r<.35&&u<.1))return M.snow[u<0?4:u<.4?3:1];return FO[Math.max(0,Math.min(4,k))];});
      for(let x=Math.ceil(cx-w);x<cx+w;x+=2)px(x,Math.round(y1),snow&&x<cx?M.snow[3]:FO[x<cx?1:0]);}
    add((snow?'pinesnow_':'pine_')+v,cx,yb);};
  for(let v=0;v<3;v++)pine(v,false);for(let v=0;v<2;v++)pine(v,true);
  /* palms (jungle broadleaf) */
  for(let v=0;v<2;v++){cv(20,22);const yb=21;let x=9,cx=v?11:9;
    for(let j=0;j<14;j++){const xx=Math.round(cx+Math.sin(j/14*1.6)*(v?-2:2));px(xx,yb-j,M.lwood[j%3===0?1:3]);px(xx+1,yb-j,M.lwood[j%3===0?0:1]);x=xx;}
    const top=yb-14,fr=v?[[-8,3],[-6,-2],[-2,-5],[3,-4],[7,0],[8,4],[-5,5]]:[[-8,2],[-5,-3],[0,-5],[5,-3],[8,2],[3,5],[-3,5]];
    for(const[dx,dy]of fr){const L=Math.hypot(dx,dy);for(let s=0;s<=1;s+=.08){const fx=x+.5+dx*s,fy=top+dy*s+Math.sin(s*Math.PI)*-1.5+s*s*3;const w=Math.sin(s*Math.PI)*1.6+.3;
      for(let q=-w;q<=w;q+=.6)px(Math.floor(fx-dy/L*q),Math.floor(fy+dx/L*q),FO[q<-.2?(dy<0?4:3):q>.4?1:2]);}}
    px(x,top+1,M.lwood[1]);px(x+1,top+1,hex('#6a4a2a'));px(x-1,top+2,hex('#6a4a2a'));
    add('palm_'+v,x+1,yb);}
  /* jungle giants */
  for(let v=0;v<2;v++){cv(20,28);const yb=27;trunk(8,yb,14,3,M.dwood);px(7,yb-1,M.dwood[2]);px(11,yb-1,M.dwood[1]);
    canopy(v?[[10,9,7,5],[5,11,4,3.5],[15,11,4,3.5],[10,5,5,4]]:[[9,10,6,5],[14,8,5,4.5],[5,12,4,3],[9,5,5,4]],10,9,9,7,FO,{bias:-.15,speck:v+40,n:20});
    for(const[a,l]of[[4,6],[7,9],[13,5],[16,7]])vine(a+(v?1:0),13+(a%3),l-(v?2:0),a*3+v);
    if(v)px(6,8,hex('#f04a6a')),px(14,6,hex('#f04a6a'));else px(12,7,hex('#ffd040')),px(5,11,hex('#ffd040'));
    add('jungle_'+v,9,yb);}
  /* acacia */
  {cv(22,16);const yb=15;trunk(10,yb,6,2,M.wood);ln(10,yb-5,6,yb-9,M.wood[2]);ln(11,yb-5,15,yb-9,M.wood[1]);ln(11,yb-6,11,yb-9,M.wood[2]);
    canopy([[11,5,9.5,2.6],[6,4,4.5,2],[15,4,5,2.2],[11,3,5,2]],11,4.5,10,3,FO,{dither:.3});add('acacia_0',11,yb);}
  /* cactus */
  {const C=ramp('#2c5a2a #3e7a34 #5a9a40 #7ab854 #a0d470');
    cv(12,16);const yb=15;rc(5,2,3,14,C[2]);vl(5,2,14,C[3]);vl(7,2,14,C[1]);px(6,1,C[3]);
    rc(1,6,2,5,C[2]);vl(1,5,5,C[3]);hl(1,10,4,C[2]);rc(9,4,2,4,C[2]);vl(10,4,4,C[1]);hl(8,8,3,C[1]);
    for(let y=3;y<15;y+=3)px(6,y,C[4]);add('cactus_0',6,yb);
    cv(12,10);ell(6,6,4,3.5,(x,y)=>C[cylK((x+.5-6)/4)]);ell(3,3,2.5,2,(x,y)=>C[cylK((x+.5-3)/2.5)]);ell(9,4,2,1.6,(x,y)=>C[cylK((x+.5-9)/2)]);
    px(3,1,hex('#ff6a8a'));px(4,1,hex('#ffb0c0'));px(9,2,hex('#ffd040'));add('cactus_1',6,9);}
  /* bushes */
  for(let v=0;v<2;v++){cv(12,9);canopy(v?[[6,5,5,3.5],[3,5,3,2.5],[9,4,3,2.5]]:[[6,5,4.5,3.5],[4,4,3,2.5]],6,4.5,5.5,4,FO,{speck:v+70,n:5});if(v){px(4,3,hex('#e8402e'));px(8,4,hex('#e8402e'));}add('bush_'+v,6,8);}
  /* rocks */
  [[6,4,4,3],[8,5,5.5,4],[5,3,3,2.2]].forEach(([w,h,rx,ry],v)=>{cv(14,9);sph(7,8,rx,ry*1.6,M.rock,{clipY:8});if(v===1)sph(11,8,2.5,2.5,M.rock,{clipY:8});px(6,8-Math.round(ry),M.rock[4]);add('rock_'+v,7,8);});
  /* stump */
  {cv(10,8);const G=ramp('#1a1614 #2a2420 #3c332c #524638 #6a5a48');rc(3,2,4,6,G[2]);vl(3,2,6,G[3]);vl(6,2,6,G[1]);ell(5,2,2,1,G[4]);px(4,2,emi('#ff6a20'));px(2,7,G[2]);px(7,7,G[1]);px(7,4,G[2]);px(8,3,G[1]);add('stump_0',5,7);}
  /* reeds */
  {cv(12,12);const R=ramp('#3a5a2a #4f7a34 #6a9a44 #8ab858 #a8d070');for(const[x,h]of[[2,7],[4,10],[6,8],[8,11],[10,6]]){vl(x,11-h,h+1,R[x%4?2:3]);if(h>7){vl(x,11-h,3,hex('#6a4028'));px(x,10-h,R[1]);}}ln(3,11,1,6,R[1]);ln(9,11,11,5,R[2]);add('reeds_0',6,11);}
  /* flowers */
  for(let v=0;v<2;v++){cv(9,6);const cs=v?['#ffd040','#ffffff','#ff9a3a']:['#f05a8a','#b070f0','#ffffff'];for(const[x,y,i]of[[1,2,0],[3,1,1],[5,3,2],[7,2,0],[4,4,0],[2,4,2]]){px(x,y+1,hex('#3e7a34'));px(x,y,hex(cs[i]));}add('flowers_'+v,4,5);}
  /* mountain peaks: overlapping lit/shadow cones, jagged edges, crevices, snow caps */
  const pk=(cx,ay,yb,wl,wr,sk,R,snowY,S)=>{
    const pts=[cx-wl,yb+1];for(let i=1;i<4;i++){const t=i/4;pts.push(cx-wl+wl*t+(rnd()-.5)*1.6,yb-(yb-ay)*t+(rnd()-.5)*1.6);}
    pts.push(cx,ay);for(let i=1;i<4;i++){const t=i/4;pts.push(cx+wr*t+(rnd()-.5)*1.6,ay+(yb-ay)*t+(rnd()-.5)*1.6);}pts.push(cx+wr,yb+1);
    const cr=[];for(let i=0;i<3;i++)cr.push([rnd(),rnd()]);
    poly(pts,(x,y)=>{const t=(y-ay)/(yb-ay),rx=cx+sk*t,lit=x+.5<rx;let k=lit?3:1;
      if(lit&&x+.5>rx-1.6)k=4;if(!lit&&x+.5<rx+1.2)k=0;
      for(const[a,b]of cr){const yy=ay+(yb-ay)*(.25+a*.6),xx=rx+(lit?-1:1)*(y-yy)*(1+b);if(y>yy&&Math.abs(x+.5-xx)<.6)k+=lit?-1:-1;}
      if(t>.82)k=lit?Math.min(k,2):Math.min(k,1);
      const sl=snowY+((x*7+3)%3)-(lit?1:0);if(S&&y<sl)return S[lit?(k>=4?4:3):(k<=0?1:2)];
      return R[Math.max(0,Math.min(4,k))];});
  };
  const peak=(name,v,snowy)=>{cv(26,26);const yb=25;seed=v*29+(snowy?7:3);const R=M.rock,S=M.snow;
    const sn=(ay,f)=>snowy?Math.round(ay+(yb-ay)*f):(f>0?Math.round(ay+(yb-ay)*f):-99);
    if(v===0){pk(6,11,yb,6,6,1,R,sn(11,snowy?.75:-9),S);pk(13,3,yb,11,10,2,R,sn(3,snowy?.78:.22),S);}
    if(v===1){pk(18,8,yb,6,6,1,R,sn(8,snowy?.72:0),S);pk(11,5,yb,10,8,1.5,R,sn(5,snowy?.78:0),S);}
    if(v===2){pk(8,6,yb,7,6,1,R,sn(6,snowy?.78:.25),S);pk(16,4,yb,8,9,2,R,sn(4,snowy?.8:.2),S);pk(12,13,yb,9,8,1,R,sn(13,snowy?.6:0),S);}
    add(name+'_'+v,12,yb);};
  for(let v=0;v<3;v++){peak('peak',v,false);peak('snowpeak',v,true);}
  /* hills */
  for(let v=0;v<2;v++){cv(20,9);const G=ramp('#5e9a40 #69a444 #76ae4a #84ba54 #92c45e');sph(10,8.5,v?9:8,v?5:6,G,{clipY:8,dither:.7,bias:-.15});hl(2,8,16,0);add('hill_'+v,10,7,false);}
}
GENS.push(nature);

/* ---------- people ---------- */
const RACE={
  h:{w:5,head:['.HHH.','HHSSS','HhSES','.sSS.'],tor:4,hem:1,leg:1,skin:'skin',hair:'#6a4228 #4a2c1a',pants:'#5e4c3e #463a30'},
  e:{w:4,head:['.HHH.','HHHSS','HhSES','.HSs.'],tor:4,hem:1,leg:2,skin:'#c88e6a #e8b490 #fad8bc #ffeedc #ffffff',hair:'#f4e2a0 #d0b46a',pants:'#56664e #3e4c38',ear:1},
  d:{w:6,head:['.HHHH.','HHSSSS','HhSSES','OOOOOO','.OOOOo'],tor:3,hem:0,leg:1,skin:'#9a5a3a #c8805a #eaa880 #f8c8a0 #ffe4c8',hair:'#e08a3a #b0602a',beard:1,pants:'#5a3e2a #42301f'},
  o:{w:6,head:['..HH..','.SSSSS','SSSSES','.SSWSs'],tor:4,hem:1,leg:1,skin:'#3e6420 #5a8a30 #7aac44 #98c85a #b8e080',hair:'#2a2420 #1a1614',pants:'#3e3428 #2c241c'}
};
function rampX(s){return Array.isArray(s)?s:s.indexOf(' ')<0&&MT[s]?MT[s]:ramp(s);}
/* draw a person facing right; returns geometry for gear */
function body(r,f,o){
  o=o||{};const R=RACE[r],S=rampX(R.skin),Hc=ramp(R.hair),Pc=ramp(R.pants),M=MT,TM=TEAM;
  const B=o.B||17,cx=8,w=R.w,x0=cx-(w>>1),bob=f===2?1:0;
  const nH=R.head.length,legH=R.leg+1,hem=R.hem,tor=R.tor,tTop=B-legH-hem-tor+1-bob+(R.beard?0:0),hTop=tTop-4;
  const cloth=o.cloth||TM,dk=o.boots||hex('#2a2220');
  /* legs */
  const lg=(x,len,c,fc)=>{vl(x,B-len,len,c);px(x,B,fc);};
  const L=R.leg;
  if(f===1){lg(x0,L+1,Pc[1],dk);px(x0-1,B,dk);lg(x0+w-1,L+1,Pc[0],dk);px(x0+w,B,dk);}
  else if(f===2){lg(cx-1,L+bob,Pc[1],dk);lg(cx,L+bob,Pc[0],dk);}
  else{lg(x0+1,L,Pc[1],dk);lg(x0+w-2,L,Pc[0],dk);if(f===3)px(x0+w-1,B,dk);}
  if(f===1){px(x0+1,B-L,Pc[1]);px(x0+w-2,B-L,Pc[0]);}
  /* torso */
  const tb=tTop+tor+hem-1;
  for(let y=tTop;y<=tb;y++)for(let x=x0;x<x0+w;x++){
    let k=x===x0?3:x===x0+w-1?1:2;if(y===tb&&hem)k=Math.max(1,k-1);
    px(x,y,o.tunic?o.tunic(x-x0,y-tTop,k):cloth[k]);}
  if(o.belt!==false&&tor>=3)hl(x0,tTop+tor-1,w,o.beltc||hex('#4a3424'));
  /* head */
  const hx=cx-(R.head[0].length>>1);
  pmap(hx,hTop,R.head,{H:Hc[0],h:Hc[1],S:S[3],s:S[2],E:INK,W:M.bone[4],O:Hc[0],o:Hc[1]});
  if(R.ear)px(hx-1,hTop+1,S[3]);
  if(r==='e'&&!o.helm){vl(hx,hTop+4,2,Hc[0]);}
  /* arms */
  const ha={x:x0+w,y:tTop+2};
  if(f===1)ha.x++;
  if(f===3){ha.x=x0+w+1;ha.y=tTop+1;}
  if(!o.noArm){
    if(f===3){px(x0+w,tTop+1,cloth[2]);px(ha.x,ha.y,S[3]);}
    else{vl(x0+w-1-(f===1?0:1),tTop,2,cloth[1]);px(ha.x-(f===1?0:1),ha.y,S[2]);if(f===1)px(x0+w,tTop+1,cloth[1]);}
    if(f!==3&&o.back!==false)px(x0-1+(f===2?1:0),tTop+2,S[1]);
  }
  return{B,cx,x0,w,tTop,hTop,hx,ha,S,bob};
}
function weapon(g,kind,f,o){
  const M=MT,W=M.wood,I=M.steel;o=o||{};let x=g.ha.x,y=g.ha.y;
  if(o.back&&f!==3){x=g.x0-1;y=g.tTop+2;}else if(o.back){y=g.tTop;x=g.x0+g.w;}
  const atk=f===3;
  switch(kind){
  case'club':if(atk){ln(x,y,x+3,y-1,W[2]);rc(x+3,y-2,2,2,W[3]);if(o.spiky)px(x+5,y-2,I[4]);}else{ln(x,y,x,y-4,W[2]);rc(x,y-6,2,2,W[3]);px(x+1,y-5,W[1]);if(o.spiky)px(x-1,y-6,I[4]);}break;
  case'spear':if(atk){hl(x-3,y,9,W[3]);hl(x+6,y,2,I[4]);px(x+8,y,I[3]);}else{vl(x,y-7,10,W[2]);px(x,y-8,I[4]);px(x,y-9,I[3]);}break;
  case'sword':if(atk){hl(x+1,y,4,I[4]);px(x+5,y,I[3]);vl(x+1,y-1,3,M.gold[3]);}else{vl(x,y-5,5,I[4]);px(x,y-6,I[3]);hl(x-1,y,3,M.gold[3]);}break;
  case'axe':if(atk){ln(x,y,x+4,y-2,W[2]);rc(x+3,y-4,2,3,I[3]);px(x+5,y-3,I[4]);}else{vl(x,y-6,8,W[2]);rc(x+1,y-6,2,3,I[3]);px(x+2,y-5,I[4]);}break;
  case'hammer':if(atk){ln(x,y,x+4,y-2,W[2]);rc(x+3,y-5,3,3,I[2]);hl(x+3,y-5,3,I[4]);}else{vl(x,y-5,7,W[2]);rc(x-1,y-7,3,3,I[2]);hl(x-1,y-7,3,I[4]);}break;
  case'bow':if(atk){vl(x+1,y-3,7,W[3]);px(x,y-4,W[2]);px(x,y+4,W[2]);vl(x-1,y-3,7,M.bone[4]);hl(x-3,y,6,W[1]);px(x+3,y,I[4]);}
    else{px(x,y-3,W[3]);vl(x+1,y-2,5,W[3]);px(x,y+3,W[2]);vl(x,y-2,5,M.bone[3]);}break;
  case'musket':if(atk){hl(x-3,y,9,W[2]);hl(x+3,y,3,I[1]);px(x+6,y,I[3]);if(o.bay)hl(x+7,y,2,I[4]);px(x+7+(o.bay?2:0),y,emi('#ffffff'));px(x+8+(o.bay?2:0),y,emi('#ffd040'));px(x+8+(o.bay?2:0),y-1,emi('#ff8a20'));px(x+8+(o.bay?2:0),y+1,emi('#ff8a20'));}
    else{vl(x,y-6,9,W[2]);vl(x,y-6,3,I[1]);if(o.bay)vl(x,y-8,2,I[4]);}break;
  case'rifle':if(atk){hl(x-3,y,8,hex('#2a2c30'));px(x-2,y+1,hex('#2a2c30'));px(x+1,y+1,hex('#3a3c40'));px(x+5,y,emi('#ffffff'));px(x+6,y,emi('#ffd040'));px(x+6,y-1,emi('#ff8a20'));px(x+6,y+1,emi('#ff8a20'));}
    else{ln(x-2,y+2,x+2,y-3,hex('#2a2c30'));px(x-1,y+2,hex('#3a3c40'));}break;
  case'cleaver':if(atk){ln(x,y,x+2,y-1,W[1]);rc(x+2,y-3,3,3,I[3]);hl(x+2,y-3,3,I[4]);}else{vl(x,y-3,4,W[1]);rc(x,y-7,2,4,I[3]);vl(x+1,y-7,4,I[4]);}break;
  }
}
function shield(g,kind,f){
  const M=MT,TM=TEAM,x=g.x0+g.w-1+(f===3?-1:0),y=g.tTop+(f===3?1:0);
  if(kind==='round'){ell(x+1.5,y+2.5,2.2,2.6,M.bronze[1]);ell(x+1.5,y+2.5,1.5,1.9,TM[2]);px(x+1,y+1,TM[3]);px(x+1,y+2,TM[3]);px(x+2,y+3,TM[1]);px(x+1,y+2,M.bronze[4]);}
  else if(kind==='kite'){rc(x,y,3,4,TM[2]);vl(x,y,4,TM[3]);vl(x+2,y,4,TM[1]);px(x+1,y+4,TM[1]);px(x+1,y+5,TM[0]);hl(x,y,3,M.steel[4]);px(x+1,y+1,M.gold[4]);px(x+1,y+2,M.gold[3]);}
  else if(kind==='hide'){rc(x,y,3,5,M.hide[2]);vl(x,y,5,M.hide[3]);vl(x+2,y,5,M.hide[1]);px(x+1,y+1,TM[3]);px(x+1,y+2,TM[2]);px(x+1,y+3,TM[2]);px(x+2,y,M.bone[4]);}
}
function helm(g,kind,r){
  const M=MT,TM=TEAM,x=g.hx,y=g.hTop,n=r==='d'||r==='o'?6:5;
  const cap=(m,k1,k2)=>{hl(x+(r==='o'?1:0),y,n-1-(r==='o'?1:0),m[k1]);hl(x,y+1,n-2,m[k2]);px(x+n-1,y+1,m[k2]);px(x+n-2,y,m[k1]);};
  switch(kind){
  case'feather':hl(x,y+1,2,M.red[2]);px(x+2,y+1,M.red[3]);px(x,y-1,M.white[4]);px(x,y-2,M.white[3]);px(x+1,y,M.white[3]);break;
  case'bronze':cap(M.bronze,4,2);px(x,y+2,M.bronze[1]);hl(x,y-1,n-2,TM[3]);hl(x-1,y-2,n-2,TM[2]);break;
  case'steel':cap(M.steel,4,2);px(x,y+2,M.steel[1]);px(x+n-1,y+2,M.steel[3]);px(x+1,y-1,M.steel[3]);break;
  case'tricorne':hl(x-1,y+1,n+2,hex('#2a2226'));hl(x,y,n,hex('#3a3036'));hl(x+1,y-1,n-2,hex('#3a3036'));px(x+n,y+1,M.gold[3]);break;
  case'shako':rc(x,y-2,n-1,3,hex('#2a2a36'));hl(x,y+1,n,hex('#1e1e28'));px(x+1,y-3,TM[3]);px(x+1,y-4,TM[2]);px(x+2,y-1,M.gold[3]);break;
  case'modern':hl(x,y,n,hex('#5a6a3a'));hl(x-1,y+1,n+1,hex('#4a5830'));hl(x+1,y-1,n-2,hex('#6e7e4a'));break;
  case'horned':cap(M.iron,3,2);px(x-1,y-1,M.bone[4]);px(x+n,y-1,M.bone[4]);px(x-1,y,M.bone[3]);px(x+n,y,M.bone[3]);break;
  case'spiked':cap(M.iron,3,1);px(x+2,y-1,M.iron[3]);px(x+2,y-2,M.iron[4]);px(x+n-2,y-1,M.iron[4]);break;
  case'hood':hl(x,y,n-1,TM[3]);px(x,y+1,TM[2]);px(x,y+2,TM[1]);px(x+1,y+1,TM[2]);px(x+1,y-1,TM[2]);break;
  case'circlet':hl(x+1,y+1,n-2,M.gold[3]);px(x+n-2,y+1,hex('#7ff0ff'));break;
  }
}
function people(){
  const M=MT,TM=TEAM;
  for(const r of'hedo')for(let f=0;f<3;f++){cv(18,19);const g=body(r,f,{});if(r==='d')hl(g.x0,g.tTop+g.bob,1,TM[3]);add(r+'_civ_'+f,g.cx,g.B);}
  const hideT=(i,j,k)=>(i===j||i===j+1)?TM[k+1]:rk(M.hide,k);
  const mail=(i,j,k)=>i>0&&i<4?TM[k]:rk(M.steel,k-((i+j)&1));
  const camo=(i,j,k)=>((i*3+j*5)%7<2)?TM[Math.max(0,k-1)]:((i+j*2)%5===0?hex('#4a5830'):TM[k]);
  const coat=(i,j,k)=>(i===j%4||i===3-j%4)&&j<3?M.white[4]:TM[k];
  const G={
    h:[{tun:hideT,helm:'feather',wp:'club'},{helm:'bronze',wp:'spear',sh:'round'},{tun:mail,helm:'steel',wp:'sword',sh:'kite'},{tun:coat,helm:'tricorne',wp:'musket',bay:1},{tun:camo,helm:'modern',wp:'rifle'}],
    e:[{tun:hideT,helm:'circlet',wp:'bow'},{helm:'hood',wp:'bow'},{tun:mail,helm:'circlet',wp:'bow'},{tun:coat,helm:'shako',wp:'musket'},{tun:camo,helm:'modern',wp:'rifle'}],
    d:[{tun:hideT,wp:'hammer'},{helm:'bronze',wp:'axe',sh:'round'},{tun:mail,helm:'horned',wp:'hammer',sh:'kite'},{tun:coat,helm:'shako',wp:'musket',bay:1},{tun:camo,helm:'modern',wp:'rifle'}],
    o:[{tun:hideT,wp:'club',spiky:1},{tun:hideT,helm:'horned',wp:'cleaver',sh:'hide'},{tun:mail,helm:'spiked',wp:'axe',sh:'hide'},{tun:coat,helm:'spiked',wp:'musket'},{tun:camo,helm:'modern',wp:'rifle'}]
  };
  for(const r of'hedo')for(let t=0;t<5;t++)for(let f=0;f<4;f++){
    const q=G[r][t];cv(20,22);const B=19;
    const g=body(r,f,{B,tunic:q.tun?(i,j,k)=>q.tun(i,j,Math.max(0,Math.min(4,k))):null,helm:q.helm});
    if(q.helm)helm(g,q.helm,r);
    if(r==='e'&&q.wp==='bow'&&f!==3){vl(g.x0-1,g.tTop-1,4,M.wood[1]);px(g.x0-1,g.tTop-2,M.white[4]);}
    if(q.sh)shield(g,q.sh,f);
    weapon(g,q.wp,f,{bay:q.bay,spiky:q.spiky,back:!!q.sh});
    add(r+'_sol'+t+'_'+f,g.cx,g.B);
  }
}
GENS.push(people);

/* ---------- creatures ---------- */
function creatures(){
  const M=MT,TM=TEAM;
  const WO=ramp('#9a9488 #c8c2b4 #e6e0d2 #f6f2e8 #ffffff'),BK=[hex('#1e1a1c'),hex('#2e282a'),hex('#4a4244')];
  for(let f=0;f<2;f++){cv(12,9);const yb=8;
    for(const[x,i]of[[3,0],[5,1],[7,0],[9,1]]){const up=f&&(i===1);vl(x,yb-2-(up?1:0),2,BK[i]);}
    ell(6,4,4.6,2.8,(x,y)=>WO[cylK((x+.5-5)/5)-((x+y)%4===0?1:0)]);px(3,3,WO[4]);px(5,2,WO[4]);
    rc(9,2,3,3,BK[1]);px(11,3,BK[0]);px(10,3,INK);px(9,2,BK[2]);px(9,1,BK[2]);
    add('sheep_'+f,6,yb);}
  const GR=ramp('#3e3e44 #5c5c64 #7c7c84 #9c9ca4 #c4c4c8');
  for(let f=0;f<2;f++){cv(14,8);const yb=7;
    for(const[x,i]of[[3,0],[4,1],[9,0],[10,1]]){const st=f?(i?1:-1):0;ln(x,yb-3,x+st,yb,GR[i?1:2]);}
    rc(2,2,9,3,GR[2]);hl(2,2,9,GR[3]);hl(3,4,7,GR[1]);px(9,5,GR[1]);
    rc(10,1,3,3,GR[2]);hl(10,1,2,GR[3]);rc(12,2,2,2,GR[2]);px(13,2,INK);px(11,0,GR[3]);px(10,0,GR[2]);px(11,2,hex('#ffd040'));hl(12,3,2,GR[4]);
    ln(1,2,0,f?0:1,GR[3]);px(2,3,GR[2]);
    add('wolf_'+f,7,yb);}
  const BR=ramp('#2e1e14 #4a3020 #6a4630 #8a603e #a87c52');
  for(let f=0;f<2;f++){cv(15,10);const yb=9;
    for(const[x,i]of[[3,0],[5,1],[9,0],[11,1]]){const st=f&&i?1:0;rc(x,yb-3-st,2,3,BR[i?1:2]);px(x+(i?1:0),yb,BR[0]);}
    ell(7,4.5,6,3.8,(x,y)=>BR[cylK((x+.5-6)/6.5)+(y<3?1:0)]);px(3,2,BR[4]);
    rc(11,2,4,4,BR[2]);hl(11,2,3,BR[3]);px(11,1,BR[2]);px(13,1,BR[2]);rc(14,4,1,2,BR[3]);px(15,4,INK);px(13,3,INK);
    add('bear_'+f,7,yb);}
  const DE=ramp('#4a2e1a #7a4e2e #a8743e #c8945a #e8c08a');
  for(let f=0;f<2;f++){cv(13,12);const yb=11;
    for(const[x,i]of[[2,0],[3,1],[8,0],[9,1]]){const st=f?(i?1:-1):0;ln(x,yb-3,x+st,yb,DE[i?1:2]);}
    rc(2,5,8,3,DE[2]);hl(2,5,8,DE[3]);hl(3,7,6,DE[1]);px(1,5,M.white[4]);px(1,6,DE[3]);
    rc(9,3,2,3,DE[2]);rc(10,1,3,2,DE[2]);px(12,2,INK);px(11,1,INK);px(9,1,DE[3]);
    ln(10,0,9,-2,M.bone[3]);px(8,-2,M.bone[3]);px(10,-2,M.bone[3]);ln(11,0,12,-2,M.bone[2]);px(13,-2,M.bone[2]);
    add('deer_'+f,6,yb);}
  /* zombie */
  for(let f=0;f<3;f++){cv(18,19);
    const g=body('h',f,{noArm:true,cloth:ramp('#2e3a44 #44525e #5e6e78 #7a8a92 #98a8ae'),tunic:(i,j,k)=>(i*3+j)%5===0?hex('#6a5a4a'):rk(ramp('#2e3a44 #44525e #5e6e78 #7a8a92 #98a8ae'),k)});
    remap(M.skin,ramp('#3e5a3a #5a7a50 #7e9e6a #9cba84 #b8d4a0'),()=>true);
    remap(ramp(RACE.h.hair),[hex('#3a3a30'),hex('#2a2a22')],()=>true);
    const y=g.tTop+1+(f===2?0:0);hl(g.x0+g.w-1,y,3+(f===1?1:0),hex('#5e6e78'));px(g.x0+g.w+2+(f===1?1:0),y,hex('#9cba84'));px(g.x0+g.w+1,y+1,hex('#7e9e6a'));
    px(g.hx+3,g.hTop+2,emi('#ff4030'));
    add('zombie_'+f,g.cx,g.B);}
  /* dragon, seen from above: wings spread north/south, head right */
  const DR=ramp('#3a0e10 #6a1a18 #a02a20 #cc4a2a #ee7a40'),WG=ramp('#4a1a1a #7a2a22 #b8503a #d8784a #f0a868');
  for(let f=0;f<3;f++){cv(34,30);const cy=15,span=[8,13,10][f],back=[0,0,4][f];
    const wing=(dir)=>{const sx=18,tx=sx-4-back,ty=cy+dir*span,wx=sx+2-back*.4,wy=cy+dir*span*.55;
      const sc=[[tx-4,cy+dir*span*.8],[sx-8,cy+dir*span*.66],[sx-11,cy+dir*span*.4],[sx-11,cy+dir*2]];
      const pts=[sx,cy+dir,wx,wy,tx,ty];sc.forEach(([x,y],i)=>{const p=i?sc[i-1]:[tx,ty];pts.push((x+p[0])/2+1.5,(y+p[1])/2-dir*2.2);pts.push(x,y);});
      poly(pts,(x,y)=>{const r=Math.abs(y-cy)/span;return WG[(dir<0?2:1)+(r>.7?1:0)];});
      const bc=dir<0?DR[3]:DR[2];ln(sx,cy+dir,wx,wy,bc);ln(wx,wy,tx,ty,bc);for(const[x,y]of sc.slice(0,3))ln(wx,wy,x,y,DR[dir<0?1:0]);px(tx,ty,M.bone[4]);px(wx,wy,M.bone[3]);};
    wing(-1);wing(1);
    for(let i=0;i<13;i++){const x=11-i,y=cy+Math.round(Math.sin(i/2.6+f*.8)*1.4);px(x,y,DR[2]);if(i<8)px(x,y+1,DR[1]);if(i<5)px(x,y-1,DR[3]);}
    const ty=cy+Math.round(Math.sin(12/2.6+f*.8)*1.4);poly([-1,ty,-3,ty-2,-4,ty+1,-2,ty+2],DR[3]);
    ell(16,cy+.5,7,3.3,(x,y)=>DR[y<cy-1?3:y>cy+1?1:2]);for(let x=11;x<21;x+=2)px(x,cy,DR[4]);
    rc(22,cy-1,4,3,DR[2]);hl(22,cy-1,4,DR[3]);rc(26,cy-2,4,5,DR[2]);hl(26,cy-2,4,DR[3]);hl(26,cy+2,4,DR[1]);rc(30,cy-1,2,3,DR[2]);px(31,cy,DR[1]);
    px(28,cy-2,emi('#ffd040'));px(28,cy+2,emi('#ffd040'));ln(26,cy-3,24,cy-4,M.bone[4]);ln(26,cy+3,24,cy+4,M.bone[3]);
    add('dragon_'+f,16,cy);}
}
GENS.push(creatures);

/* ---------- vehicles & boats ---------- */
function wheel(x,y,r,m){m=m||MT.wood;ell(x,y,r,r,m[1]);if(r>=2){ell(x,y,r-1,r-1,(xx,yy)=>null);ell(x,y,r-.8,r-.8,null);}px(Math.floor(x),Math.floor(y),m[3]);if(r>=2.5){ln(x-r+1,y,x+r-1,y,m[2]);ln(x,y-r+1,x,y+r-1,m[2]);}}
function horse(x,yb,f,c){c=c||ramp('#3a2216 #5e3a22 #84542e #a8703e #c8925a');
  for(const[lx,i]of[[x,0],[x+1,1],[x+5,0],[x+6,1]]){const st=f?(i?1:-1):0;ln(lx,yb-3,lx+st,yb,c[i?1:2]);}
  rc(x,yb-6,7,3,c[2]);hl(x,yb-6,7,c[3]);hl(x+1,yb-4,5,c[1]);rc(x+6,yb-9,2,4,c[2]);rc(x+7,yb-9,3,2,c[2]);px(x+9,yb-8,c[1]);px(x+6,yb-10,c[3]);vl(x+5,yb-9,3,hex('#2a1a14'));px(x-1,yb-6,hex('#2a1a14'));px(x-1,yb-5,hex('#2a1a14'));}
function vehicles(){
  const M=MT,TM=TEAM;
  /* carts */
  {cv(24,12);const yb=11,OX=ramp('#3a2a20 #5e4634 #86684c #a88a68 #c8ae8c');
    rc(1,4,10,3,M.wood[2]);hl(1,4,10,M.wood[3]);hl(1,6,10,M.wood[1]);rc(2,2,8,2,M.thatch[3]);hl(2,2,8,M.thatch[4]);px(4,1,TM[2]);px(5,1,TM[3]);px(6,1,TM[2]);
    wheel(6,8,2.6);ln(11,6,14,6,M.wood[1]);
    horse(13,yb,0,OX);px(20,3,M.bone[4]);px(21,2,M.bone[4]);px(19,2,M.bone[3]);
    add('cart_0',11,yb);}
  {cv(26,14);const yb=13;
    rc(1,7,11,3,M.wood[2]);hl(1,9,11,M.wood[1]);
    for(let x=1;x<12;x++){const h=Math.round(5*Math.sqrt(1-((x-6)/6.2)**2));for(let y=7-h;y<7;y++)px(x,y,TM[x<4?3:x>9?1:(y===7-h?3:2)]);}
    for(let x=3;x<11;x+=3)vl(x,3,4,TM[1]);ell(6,7,3.5,3.5,TM[0]);ell(6,7,2.5,2.5,HOLE);
    wheel(3,10,2.4);wheel(10,10,2.4);ln(12,8,15,8,M.wood[1]);horse(15,yb,1);
    add('cart_1',12,yb);}
  {cv(26,14);const yb=13;
    rc(2,2,9,7,TM[2]);vl(2,2,7,TM[3]);vl(10,2,7,TM[1]);hl(1,1,11,hex('#2a2226'));hl(2,0,9,hex('#3a3036'));hl(2,8,9,M.gold[3]);hl(2,2,9,M.gold[3]);
    win(4,3,2,3,{glint:false});win(7,3,2,3);rc(11,6,2,2,hex('#3a3036'));
    wheel(3,10,2.4,M.iron);wheel(10,10,2.4,M.iron);ln(12,8,15,8,M.wood[1]);horse(15,yb,0,ramp('#d0ccc4 #e4e0d8 #f4f0e8 #ffffff #ffffff'));
    add('cart_2',12,yb);}
  /* train */
  {cv(22,14);const yb=13,K=ramp('#14161a #24282e #383e46 #545c66 #7a848e');
    rc(1,5,13,5,K[2]);hl(1,5,13,K[4]);hl(1,6,13,K[3]);hl(1,9,13,K[1]);for(const x of[4,8,12])vl(x,5,5,M.brass[3]);
    rc(13,1,7,9,K[2]);vl(13,1,9,K[3]);rc(14,2,4,3,WN);hl(12,0,9,TM[2]);hl(12,1,9,TM[1]);
    rc(3,1,3,4,K[2]);hl(2,0,5,K[3]);rc(8,3,2,2,M.brass[3]);px(0,7,emi('#ffe080'));poly([-2,12,1,9,1,12],M.red[2]);
    hl(1,10,20,K[0]);for(const x of[4,9])wheel(x,11.5,2,M.red);wheel(16,11.5,2.2,M.red);ln(4,11,16,11,M.steel[3]);
    flipH();add('train_3',10,yb);}
  {cv(18,12);const yb=11;
    rc(1,2,15,7,TM[2]);hl(1,2,15,TM[3]);hl(1,8,15,TM[1]);vl(1,2,7,TM[3]);vl(15,2,7,TM[1]);hl(0,1,17,hex('#3a3036'));hl(1,0,15,hex('#545c66'));
    winGrid(3,4,4,1,2,2,1,0);hl(1,9,15,hex('#24282e'));wheel(4,10.5,1.6,M.iron);wheel(13,10.5,1.6,M.iron);
    add('traincar_3',8,yb);}
  {cv(20,11);const yb=10;
    rc(1,1,11,7,M.white[2]);hl(1,1,11,M.white[4]);hl(1,7,11,M.white[1]);vl(1,1,7,M.white[3]);rc(3,3,7,3,M.white[3]);
    rc(12,3,6,5,TM[2]);hl(12,3,5,TM[3]);rc(13,4,3,2,WN);px(17,4,TM[1]);hl(12,7,7,hex('#2a2c30'));px(18,6,emi('#fff4c0'));
    hl(1,8,17,hex('#2a2c30'));for(const x of[4,8,15])ell(x,9,1.6,1.6,hex('#1e2024')),px(x,9,M.steel[3]);
    add('truck_4',10,yb);}
  /* siege */
  {cv(16,12);const yb=11;rc(1,7,13,2,M.wood[2]);hl(1,7,13,M.wood[3]);ln(4,7,7,3,M.wood[1]);ln(10,7,7,3,M.wood[1]);hl(6,3,3,M.wood[3]);
    ln(3,6,12,1,M.wood[3]);ln(3,7,12,2,M.wood[1]);rc(12,0,3,2,M.wood[1]);px(13,0,M.rock[3]);wheel(3.5,10,1.7);wheel(11.5,10,1.7);
    add('siege_1',8,yb);}
  {cv(18,24);const yb=23;rc(1,20,15,2,M.wood[2]);hl(1,20,15,M.wood[3]);ln(3,20,8,6,M.wood[2]);ln(13,20,9,6,M.wood[1]);hl(7,6,4,M.wood[3]);
    ln(1,2,15,10,M.wood[3]);ln(1,3,15,11,M.wood[1]);rc(13,10,4,4,M.iron[2]);hl(13,10,4,M.iron[4]);ln(1,3,0,9,hex('#c8b890'));px(0,10,M.rock[2]);
    wheel(3.5,22,1.6);wheel(13.5,22,1.6);add('siege_2',8,yb);}
  {cv(15,9);const yb=8;rc(2,4,8,2,M.wood[2]);hl(2,4,8,M.wood[3]);ln(0,6,3,4,M.wood[1]);
    rc(4,2,10,3,hex('#2a2c30'));hl(4,2,10,hex('#5a6068'));px(14,3,INK);rc(3,2,2,3,hex('#3a3e44'));wheel(6,6,2.5);
    add('siege_3',7,yb);}
  {cv(22,12);const yb=11;
    rc(1,5,19,4,TM[2]);hl(1,5,19,TM[3]);for(let i=0;i<19;i+=4){px(2+i,6,TM[1]);px(3+i,7,TM[0]);px(4+i,6,hex('#4a5830'));}
    rc(5,2,9,3,TM[2]);hl(5,2,9,TM[3]);px(7,3,TM[1]);px(10,3,hex('#4a5830'));hl(14,3,7,hex('#3a3e44'));px(21,3,INK);px(9,1,hex('#3a3e44'));
    rc(0,8,21,3,hex('#2a2c30'));hl(1,8,19,hex('#4a4e56'));for(let x=2;x<20;x+=3)px(x,9,hex('#6a6e76'));
    add('siege_4',10,yb);}
  /* boats (waterline = anchor row) */
  const hull=(x0,x1,wl,d,m,o)=>{o=o||{};for(let x=x0;x<=x1;x++){const u=(x-x0)/(x1-x0),bow=u>.82?Math.round((u-.82)/.18*d):0,st=u<.08?1:0;for(let y=wl-d+bow-(o.sheer?Math.round((u-.5)**2*4):0);y<=wl+1-st;y++){const r=wl+1-y;px(x,y,r<=1?m[1]:y===wl-d+bow?m[4]:m[r<=2?2:3]);}}};
  {cv(18,9);const wl=6;hull(1,15,wl,2,M.wood,{sheer:1});rc(7,1,3,3,TM[2]);hl(7,1,3,TM[3]);rc(7,0,3,1,RACE.h.hair.split(' ').map(hex)[0]);px(8,1,M.skin[3]);px(9,1,M.skin[3]);
    ln(11,0,13,7,M.wood[1]);rc(13,6,2,2,M.wood[3]);add('boat_0',8,wl);}
  {cv(26,22);const wl=19;
    hull(1,23,wl,4,M.wood,{sheer:1});for(let x=4;x<21;x+=3){ln(x,wl-1,x-2,wl+2,M.lwood[3]);}hl(2,wl-4,20,M.wood[4]);for(let x=4;x<21;x+=2)px(x,wl-3,TM[(x>>1)%2?2:1]);
    vl(12,2,wl-5,M.wood[1]);hl(6,2,13,M.wood[2]);rc(6,3,13,11,TM[2]);vl(6,3,11,TM[3]);vl(18,3,11,TM[1]);hl(6,13,13,TM[1]);for(let y=4;y<13;y+=4)hl(7,y,11,TM[3]);ell(12,8,2,2,M.gold[3]);
    poly([23,wl-4,26,wl-7,25,wl-3],M.wood[3]);add('boat_1',12,wl);}
  {cv(32,30);const wl=27;
    hull(1,29,wl,6,M.wood,{sheer:1});rc(1,wl-9,6,4,M.wood[2]);hl(1,wl-9,6,M.wood[4]);winGrid(2,wl-8,2,1,1,1,1,0);
    for(let x=8;x<26;x+=3)px(x,wl-3,INK);hl(3,wl-5,24,M.gold[3]);
    const mast=(x,top,w,h)=>{vl(x,top,wl-6-top,M.wood[1]);for(let k=0;k<2;k++){const y=top+2+k*(h+1);for(let j=0;j<h;j++){const bulge=j>0&&j<h-1?1:0;hl(x-w-bulge+1,y+j,2*w+bulge*2-1,TM[j===0?3:j===h-1?1:2]);px(x-w-bulge+1,y+j,TM[3]);}hl(x-w,y-1,2*w+1,M.wood[2]);}px(x,top-1,TM[3]);px(x+1,top-1,TM[2]);};
    mast(8,4,3,5);mast(16,1,4,6);mast(24,6,3,5);
    ln(26,9,31,wl-6,M.wood[3]);add('boat_2',15,wl);}
  {cv(30,16);const wl=13;
    hull(1,27,wl,4,M.iron,{});hl(2,wl-1,25,M.red[2]);hl(2,wl,25,M.red[1]);
    rc(6,wl-7,16,3,M.white[3]);hl(6,wl-7,16,M.white[4]);winGrid(7,wl-6,7,1,1,1,1,0);rc(9,wl-10,8,3,M.white[2]);hl(9,wl-10,8,M.white[4]);win(10,wl-9,6,1,{glint:false});
    rc(16,wl-15,3,6,TM[2]);vl(16,wl-15,6,TM[3]);hl(16,wl-15,3,INK);hl(16,wl-13,3,M.white[4]);
    vl(5,wl-12,8,M.wood[1]);vl(24,wl-10,6,M.wood[1]);add('boat_3',14,wl);}
  {cv(34,14);const wl=11,G=ramp('#3a4048 #545c66 #707a86 #8e98a4 #b4bec8');
    hull(1,31,wl,3,G,{});hl(2,wl,29,hex('#2a2c30'));
    rc(10,wl-6,12,3,G[2]);hl(10,wl-6,12,G[4]);rc(13,wl-9,6,3,G[2]);hl(13,wl-9,6,G[4]);win(14,wl-8,4,1,{glint:false});
    vl(16,wl-13,4,G[1]);hl(14,wl-12,5,G[3]);px(16,wl-14,emi('#ff4040'));
    rc(24,wl-5,3,2,G[1]);hl(26,wl-5,4,G[0]);rc(5,wl-5,3,2,G[1]);hl(1,wl-5,4,G[0]);hl(10,wl-3,12,TM[2]);
    add('boat_4',16,wl);}
  {cv(12,9);const wl=7;hull(1,10,wl,2,M.lwood,{sheer:1});rc(5,2,3,3,TM[2]);hl(5,2,3,TM[3]);rc(5,1,3,1,M.thatch[3]);hl(4,1,5,M.thatch[2]);px(7,2,M.skin[3]);
    ln(8,3,12,0,M.wood[3]);vl(12,0,5,hex('#d8d8d0'));add('fishboat',6,wl);}
  /* plane (seen from above, nose right) */
  for(let f=0;f<2;f++){cv(18,14);const G=ramp('#3e4a32 #56663f #6e8050 #8a9c66 #aabb84'),cy=6;
    poly([7,0,10,0,11,13,8,13],(x,y)=>G[y<cy?3:y>cy+1?2:3]);hl(7,0,4,G[4]);hl(8,13,3,G[1]);
    ell(9,2.5,1.4,1.4,TM[2]);px(9,2,TM[3]);ell(9.5,10.5,1.4,1.4,TM[1]);px(10,10,TM[2]);
    rc(1,cy-3,3,8,G[2]);hl(1,cy-3,3,G[4]);px(1,cy-3,TM[2]);px(1,cy+4,TM[1]);
    rc(1,cy,14,2,G[2]);hl(1,cy,14,G[4]);hl(2,cy+1,13,G[1]);rc(11,cy,2,1,hex('#5aa0c8'));px(12,cy,hex('#c8eaff'));rc(14,cy,2,2,G[3]);
    if(f)vl(16,cy-3,8,hex('#c4c8cc'));else{ln(15,cy-3,17,cy+4,hex('#c4c8cc'));}px(16,cy,hex('#2a2c30'));
    add('plane_'+f,8,cy);}
  /* birds, whale, fish, splash */
  cv(5,3);pmap(0,0,['W...W','.WGW.','..G..'],{W:hex('#f4f4f0'),G:hex('#9aa0a8')});add('bird_0',2,1,false);
  cv(5,3);pmap(0,0,['.....','WWGWW','..G..'],{W:hex('#f4f4f0'),G:hex('#9aa0a8')});add('bird_1',2,1,false);
  const WH=ramp('#1a2430 #2a3a4c #3e5468 #5a7088 #8098b0');
  cv(16,6);ell(7,5,7,3,(x,y)=>y>4?null:WH[y<3?3:2]);px(4,2,WH[4]);hl(1,4,13,WH[1]);px(10,3,INK);rc(13,1,1,2,hex('#c8e0f0'));px(12,0,hex('#e8f4ff'));px(14,0,hex('#e8f4ff'));add('whale_0',7,4);
  cv(16,7);ln(6,6,8,3,WH[2]);poly([8,3,4,0,6,3],WH[3]);poly([8,3,12,0,10,3],WH[1]);hl(4,6,7,hex('#e8f4ff'));px(3,5,hex('#c8e0f0'));px(11,5,hex('#c8e0f0'));add('whale_1',7,6);
  cv(4,3);pmap(0,0,['.SS.','SSWS','..S.'],{S:hex('#b8c4cc'),W:hex('#f0f8ff')});px(3,1,hex('#7a8a96'));add('fish',2,2,false);
  cv(9,5);ell(4.5,3,4.5,2,hex('#e8f4ff'));ell(4.5,3,3,1.1,null);px(4,0,hex('#ffffff'));px(2,1,hex('#c8e4f4'));px(6,1,hex('#c8e4f4'));add('splash',4,3,false);
}
GENS.push(vehicles);

/* ---------- effects ---------- */
function effects(){
  const M=MT,E=emi;
  /* flames: emissive, 4 flicker frames */
  for(let f=0;f<4;f++){cv(9,12);seed=f*17+3;const sway=[0,1,0,-1][f];
    for(let y=0;y<12;y++){const t=y/11,w=(t<.25?1.2+t*10:3.6-((t-.25)*1.1))*(1+(rnd()-.5)*.2)*.95,cx=4.5+sway*(1-t)*1.4;
      for(let x=Math.floor(cx-w);x<Math.ceil(cx+w);x++){const d=Math.abs(x+.5-cx)/w*.7+(1-t)*.55;if(d>1.05)continue;px(x,y,E(d<.42?'#fff6c0':d<.62?'#ffd040':d<.85?'#ff8a20':'#d8401c'));}}
    for(const[x,y]of[[2+f%2,1],[6-f%3,2],[4,0]])if(rnd()<.7)px(x+sway,y-f%2,E('#ff6a20'));
    add('flame_'+f,4,11,false);}
  /* smoke puffs (normal pixels, renderer fades) */
  [5,8,12].forEach((d,s)=>{cv(d,d);const G=ramp('#6a6c72 #84868c #a0a2a6 #bcbec0 #d8d8d8');sph(d/2,d/2,d/2,d/2,G,{dither:.8,bias:.15});if(d>6){sph(d*.35,d*.38,d*.28,d*.28,G,{bias:.3});}add('smoke_'+s,d>>1,d>>1,false);});
  /* explosion sequence */
  const boomC=['#ffffff','#fff2a0','#ffd040','#ff9a28','#ff5a1c','#c8301a'],SM=ramp('#2e2a2e #444046 #5c585e #78747a #96929a');
  for(let f=0;f<5;f++){cv(26,26);seed=f*31+11;const c=13,R=[4.5,8,10.5,11.5,12.5][f],ph=[rnd()*6,rnd()*6,rnd()*6];
    const rad=a=>R*(1+.13*Math.sin(3*a+ph[0])+.09*Math.sin(5*a+ph[1])+.05*Math.sin(11*a+ph[2]));
    if(f<3)for(let y=0;y<26;y++)for(let x=0;x<26;x++){const dx=x+.5-c,dy=y+.5-c,d=Math.hypot(dx,dy)/rad(Math.atan2(dy,dx));if(d>1)continue;
      const n=(bayer(x,y)-.5)*.12,k=Math.max(0,Math.min(5,Math.floor((d+n)*[2.6,4,5][f]+[0,0,1][f])));px(x,y,emi(boomC[k]));}
    if(f>=2){const n=f===2?7:9;for(let i=0;i<n;i++){const a=i/n*6.283+ph[0],rr=R*(f===2?.92:.78)*(1+(rnd()-.5)*.2),pr=f===2?2:f===3?3.4:3;
      sph(c+Math.cos(a)*rr,c+Math.sin(a)*rr,pr,pr,f===4?SM:[emi('#8a2a18'),emi('#b8401c'),emi('#e0601c'),emi('#ff8a28'),emi('#ffb040')],{dither:.4});}}
    if(f===3)for(let i=0;i<9;i++){const a=i/9*6.283+ph[1],rr=R*.4;sph(c+Math.cos(a)*rr,c+Math.sin(a)*rr,2.2,2.2,SM.slice(1),{dither:.4});}
    if(f>=1)for(let i=0;i<4+f*2;i++){const a=rnd()*6.283,r=R*(1.05+rnd()*.3);px(Math.round(c+Math.cos(a)*r),Math.round(c+Math.sin(a)*r),emi(f<4?'#ffd040':'#ff7a20'));}
    add('boom_'+f,c,c,false);}
  cv(3,3);pmap(0,0,['.a.','aWa','.a.'],{a:E('#ffc040'),W:E('#ffffff')});add('spark',1,1,false);
  cv(2,2);pmap(0,0,['ab','bc'],{a:E('#ffd060'),b:E('#ff8a20'),c:E('#e0501c')});add('ember',1,1,false);
  cv(6,1);pmap(0,0,['fwwwwT'],{f:hex('#e8e0d0'),w:M.wood[3],T:M.steel[4]});add('arrow',3,0,false);
  cv(3,1);pmap(0,0,['abW'],{a:E('#ff9a20'),b:E('#ffd040'),W:E('#ffffff')});add('bullet',1,0,false);
  cv(3,3);pmap(0,0,['.b.','bab','.c.'],{a:M.rock[3],b:M.rock[2],c:M.rock[1]});px(0,2,M.rock[1]);px(2,2,M.rock[1]);add('stone',1,1,false);
  cv(3,3);pmap(0,0,['.b.','bac','.c.'],{a:hex('#5a5e66'),b:hex('#3a3e44'),c:hex('#1e2024')});px(0,0,null);add('shell',1,1,false);
  cv(5,5);pmap(0,0,['.bab.','bcaab','acdca','bcccb','.bab.'],{a:E('#ff7a20'),b:E('#a8301c'),c:E('#ffb040'),d:E('#fff0a0')});add('lavabomb',2,2,false);
  /* shadows (solid black, renderer adds alpha) */
  cv(16,6);ell(8,3,8,3,rgb(0,0,0));add('shadow',8,3,false);
  cv(34,10);ell(17,5,17,5,rgb(0,0,0));add('shadowbig',17,5,false);
  cv(1,4);vl(0,0,4,hex('#cfe4f4'));px(0,3,hex('#ffffff'));add('raindrop',0,3,false);
  cv(2,2);rc(0,0,2,2,hex('#ffffff'));px(1,1,hex('#dceaf6'));add('snowflake',1,1,false);
}
GENS.push(effects);

/* ---------- extras: fountain, well, statue, lamppost, campfire, tomb, ruins, crate, banner ---------- */
function extras(){
  const M=MT,TM=TEAM;
  {cv(18,14);const yb=13;ell(9,yb-3,8,3.5,M.stone[1]);ell(9,yb-3.5,8,3,M.stone[3]);ell(9,yb-3.5,6.5,2,hex('#4aa0d0'));ell(8,yb-4,3,1,hex('#8ad0f0'));
    rc(1,yb-3,16,3,M.stone[2]);hl(1,yb-3,16,M.stone[3]);hl(1,yb,16,M.stone[1]);for(let x=2;x<16;x+=4)vl(x,yb-2,2,M.stone[1]);
    rc(8,yb-9,2,6,M.stone[3]);vl(9,yb-9,6,M.stone[1]);ell(9,yb-9,2.5,1,M.stone[3]);px(8,yb-11,hex('#cfeaff'));px(9,yb-12,hex('#ffffff'));px(6,yb-9,hex('#8ad0f0'));px(11,yb-9,hex('#8ad0f0'));px(5,yb-7,hex('#cfeaff'));px(12,yb-7,hex('#cfeaff'));
    add('fountain',9,yb);}
  {cv(12,16);const yb=15;cyl(1,yb-4,10,4,M.stone,{tex:'stone'});ell(6,yb-4,5,1.5,M.stone[3]);ell(6,yb-4,3.5,1,INK);
    vl(1,yb-12,8,M.wood[2]);vl(10,yb-12,8,M.wood[1]);gable(1,10,yb-11,4,3,TM,null,{course:0});vl(6,yb-9,4,hex('#c8b890'));rc(5,yb-6,2,2,M.wood[2]);
    add('well',6,yb);}
  {cv(12,24);const yb=23;wall(2,yb-5,8,6,M.stone,'block');hl(1,yb-6,10,M.stone[4]);
    const P=M.copper;rc(4,yb-17,4,11,P[2]);vl(4,yb-17,11,P[3]);vl(7,yb-17,11,P[1]);rc(4,yb-20,3,3,P[2]);px(4,yb-20,P[3]);ln(7,yb-16,9,yb-21,P[1]);rc(8,yb-23,3,2,P[2]);px(9,yb-23,P[4]);vl(5,yb-11,5,P[1]);
    add('statue',6,yb);}
  {cv(6,16);const yb=15;vl(2,yb-12,13,hex('#2a2c30'));hl(1,yb,3,hex('#2a2c30'));hl(1,yb-13,4,hex('#3a3e44'));rc(2,yb-12,2,2,emi('#ffe080'));px(3,yb-12,emi('#fff6c8'));hl(1,yb-10,4,hex('#3a3e44'));
    add('lamppost',2,yb);}
  {cv(10,5);ln(1,4,8,2,M.wood[2]);ln(1,2,8,4,M.wood[1]);ell(4.5,4,3,1,M.rock[2]);px(4,3,emi('#ff8a20'));px(5,3,emi('#ffd040'));add('campfire',4,4);}
  {cv(7,9);const yb=8;rc(1,1,5,8,M.stone[2]);vl(1,1,8,M.stone[3]);vl(5,1,8,M.stone[1]);hl(2,0,3,M.stone[3]);vl(3,2,4,M.stone[1]);hl(2,3,3,M.stone[1]);hl(0,yb,7,M.turf[2]);add('tomb',3,yb);}
  for(let v=0;v<2;v++){cv(18,14);const yb=13;seed=v*5+1;
    if(v===0){wall(1,yb-7,5,8,M.stone,'stone');wall(6,yb-4,7,5,M.stone,'stone');wall(13,yb-9,3,10,M.stone,'stone');px(14,yb-10,M.stone[3]);px(2,yb-8,M.stone[3]);}
    else{wall(2,yb-3,14,4,M.dwood,'plank');for(const[x,h]of[[2,7],[7,4],[12,9],[15,5]])vl(x,yb-h,h,hex('#2a2420'));ln(3,yb-6,11,yb-3,hex('#3a302a'));}
    for(let i=0;i<6;i++)px(rint(0,17),yb-rint(0,1),M.rock[rint(1,3)]);add('ruin_'+v,9,yb);}
  {cv(6,6);rc(0,1,6,5,M.lwood[2]);hl(0,1,6,M.lwood[4]);rc(0,0,6,1,M.lwood[3]);ln(0,1,5,5,M.lwood[1]);vl(5,1,5,M.lwood[1]);add('crate',3,5);}
  {cv(6,16);vl(1,0,16,M.wood[1]);px(1,0,M.gold[3]);banner(2,1,3,8);add('banner',1,15);}
}
GENS.push(extras);
return pack();
}
