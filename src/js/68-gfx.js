/* ================= graphics: canvases and camera ================= */
let cv=$('c');
const ovc=$('ov');
let ctx=null,G=null;
const mini=$('mini'),mctx=mini.getContext('2d');
const cam={x:0,y:0,z:4};
let vw=300,vh=500,dpr=1,gdpr=1,minZ=1,frameNo=0,dayClock=18,nightF=0,sunX=.5,sunY=-.8,dayLight=1;
const FONT='"Pixelify Sans",ui-monospace,"Courier New",monospace';
const MAXZ=40,QUAL={fast:1,balanced:1.5,sharp:2.5};

function sizeMini(){
  const mw=W>=600?128:112,mh=Math.round(mw*H/W);
  mini.style.width=mw+'px';mini.style.height=mh+'px';
  mini.width=Math.round(mw*dpr);mini.height=Math.round(mh*dpr);
}
function clampZ(z){return Math.max(minZ,Math.min(MAXZ,z));}
function clampCam(){
  const tw=vw/cam.z,th=vh/cam.z;
  cam.x=Math.max(-tw*.5,Math.min(W-tw*.5,cam.x));
  cam.y=Math.max(-th*.5,Math.min(H-th*.5,cam.y));
}
function centerOn(x,y){cam.x=x-vw/cam.z/2;cam.y=y-vh/cam.z/2;clampCam();}
function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2.5);
  vw=ovc.clientWidth||window.innerWidth||300;vh=ovc.clientHeight||window.innerHeight||500;
  ovc.width=Math.round(vw*dpr);ovc.height=Math.round(vh*dpr);
  gdpr=G?Math.min(dpr,QUAL[S.quality]||1.5):dpr;
  cv.width=Math.round(vw*gdpr);cv.height=Math.round(vh*gdpr);
  minZ=Math.min(vw/(W||1),vh/(H||1))*.85;cam.z=clampZ(cam.z);clampCam();
  if(W)sizeMini();
}
/* the sun crosses the sky once per day; dusk and dawn tint the light */
function updDay(dt,running){
  if(S.night){
    if(running)dayClock=(dayClock+dt/1000)%150;
    const p=dayClock/150;
    nightF=p<.56?0:p<.66?(p-.56)/.1:p<.9?1:(1-p)/.1;
  }else{nightF=0;}
  const p=S.night?dayClock/150:.3,a=((p+.06)%1)/.68*Math.PI;
  if(a<=Math.PI){sunX=Math.cos(a);sunY=-.35-.65*Math.sin(a);}else{sunX=-.3;sunY=-.6;}
  const l=Math.hypot(sunX,sunY);sunX/=l;sunY/=l;
  dayLight=1-nightF;
}
function initGfx(){
  G=null;
  if(S.gfx!=='classic'){
    try{G=glCreate(cv);}catch(e){console.warn('WebGL renderer unavailable:',e);G=null;}
    if(!G){
      /* the failed attempt may have claimed the canvas, so start from a fresh one */
      const fresh=cv.cloneNode(false);cv.parentNode.replaceChild(fresh,cv);cv=fresh;
    }
  }
  ctx=G?ovc.getContext('2d'):cv.getContext('2d');
  document.body.classList.toggle('gl',!!G);
}
