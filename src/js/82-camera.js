/* ================= camera: glides, following, and the cinematic director ================= */
let glide=null,follow=null,watching=false,watchNext=0,hoverP=null;
/* fly the camera to a spot, easing in and out */
function camTo(x,y,z,dur){
  const tz=clampZ(z||cam.z);
  glide={fx:cam.x+vw/cam.z/2,fy:cam.y+vh/cam.z/2,fz:cam.z,tx:x,ty:y,tz,t0:now(),dur:reduceMotion?1:dur||900};
}
function stopCam(){glide=null;follow=null;if(watching)setWatch(false);}
function updCamera(dt,lerp){
  if(glide){
    const p=Math.min(1,(now()-glide.t0)/glide.dur),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    /* zoom out a little mid-flight on long hops so the journey reads */
    const far=Math.hypot(glide.tx-glide.fx,glide.ty-glide.fy),dip=far>40?Math.sin(p*Math.PI)*Math.min(.45,far/400):0;
    cam.z=clampZ((glide.fz+(glide.tz-glide.fz)*e)*(1-dip));
    centerOn(glide.fx+(glide.tx-glide.fx)*e,glide.fy+(glide.ty-glide.fy)*e);
    if(p>=1)glide=null;
  }else if(follow){
    const u=follow;
    if(u.dead||(u.stowed&&!u.k)){follow=null;toast('The one you were following is gone.');return;}
    const px=u.px===undefined?u.x:u.px,py=u.py===undefined?u.y:u.py;
    const fx2=px+(u.x-px)*lerp+.5,fy2=py+(u.y-py)*lerp+.5;
    const cx=cam.x+vw/cam.z/2,cy=cam.y+vh/cam.z/2,k=Math.min(1,dt/250);
    centerOn(cx+(fx2-cx)*k,cy+(fy2-cy)*k);
  }
  if(watching)director();
}
function setWatch(on){
  watching=on;document.body.classList.toggle('watching',on);
  const b=$('watchBtn');if(b){b.setAttribute('aria-pressed',String(on));}
  if(on){watchNext=0;closeSheet();hideInfo();toast('Watching the world. Touch the map to take the camera back.');}
}
/* pick something worth seeing: fresh events first, then rockets, battles, wonders, great cities */
function director(){
  const t=now();
  if(t<watchNext||glide)return;
  const c=[];
  if(lastEvent&&t-lastEvent.t<20000)c.push({x:lastEvent.x,y:lastEvent.y,w:lastEvent.type==='war'||lastEvent.type==='age'?6:4,z:9});
  for(const e of effects)if(e.k==='rocket'&&e.t>200)c.push({x:e.x,y:e.y-4,w:9,z:7});
  for(const b of raising)if(b.kind==='wonder'&&b.v.alive)c.push({x:b.x+1,y:b.y+1,w:2,z:12});
  let fights=0;
  for(let n=0;n<units.length&&fights<4;n+=7){const u=units[n];if(u.foe&&u.soldier&&u.k&&u.foe.k&&u.foe.k!==u.k){c.push({x:u.x,y:u.y,w:3,z:11});fights++;}}
  for(const u of units)if(u.t===DRAGON){c.push({x:u.x,y:u.y,w:3,z:8,u});break;}
  for(const p of planes){c.push({x:p.x,y:p.y,w:3,z:8});break;}
  for(const s of storms){c.push({x:s.x,y:s.y,w:1,z:5});break;}
  let big=null;for(let n=1;n<vById.length;n++){const v=vById[n];if(v.alive&&(!big||v.houses>big.houses))big=v;}
  if(big)c.push({x:big.x,y:big.y,w:2,z:13});
  for(let m=0;m<2;m++){const v=vById[1+((Math.random()*(vById.length-1))|0)];if(v&&v.alive)c.push({x:v.x,y:v.y,w:1,z:10+Math.random()*6});}
  if(!c.length){watchNext=t+4000;return;}
  let sum=0;for(const o of c)sum+=o.w;let r=Math.random()*sum,pick2=c[0];
  for(const o of c){r-=o.w;if(r<=0){pick2=o;break;}}
  camTo(pick2.x,pick2.y,pick2.z*(.85+Math.random()*.3),2600);
  if(lastEvent&&pick2.x===lastEvent.x)lastEvent.t=0;
  watchNext=t+9000+Math.random()*5000;
}
/* the brush outline under the pointer */
function drawCursor(ox,oy,z){
  const p=hoverP||(stroke&&stroke.paint?{x:stroke.lx,y:stroke.ly}:null);
  if(!p||busy||watching)return;
  if(tool.mode!=='brush'&&tool.mode!=='spawn'&&tool.mode!=='tap')return;
  if(tool.id==='inspect'||tool.id==='flood'||tool.id==='ebb')return;
  const t=toTile(p),px=ox+(t.x+.5)*z,py=oy+(t.y+.5)*z;
  const r=tool.mode==='tap'?.6:tool.id==='raise'||tool.id==='lower'||tool.id==='flatten'||tool.id==='warm'||tool.id==='cool'||tool.id==='wet'||tool.id==='dry'||tool.id==='plant'?brush+.5:Math.max(.6,brush-.5);
  ctx.save();ctx.lineWidth=Math.max(1.5,dpr*1.5);
  ctx.strokeStyle='rgba(11,24,40,.7)';ctx.beginPath();ctx.arc(px,py,r*z+1.5*dpr,0,6.283);ctx.stroke();
  ctx.strokeStyle='rgba(255,236,150,.95)';ctx.beginPath();ctx.arc(px,py,r*z,0,6.283);ctx.stroke();
  ctx.restore();
}
function bldName(b){
  const t=TIER[b.v.k.age]||0;
  switch(b.kind){
    case'hall':return["chieftain's hall",'great hall','castle','town hall','capitol'][t];
    case'house':return t>=3&&Math.hypot(b.x-b.v.x,b.y-b.v.y)<b.v.rad*.62?(t>=4?'tower block':'tenement'):'home';
    case'academy':return['school','library','university','university','research lab'][t];
    case'temple':return['shrine','temple','cathedral','church','monument'][t];
    case'tower':return['watchtower','watchtower','stone tower','fort','radar tower'][t];
    case'barracks':return['war camp','barracks','barracks','garrison','military base'][t];
    case'market':return['market','market','market hall','shopping street','mall'][t];
    case'mine':return t>=3?'colliery':'mine';
    case'dock':return['jetty','harbour','harbour','port','port'][t];
    case'wonder':return WMAP[b.wid].n;
    case'windmill':return t>=4?'wind turbine':'windmill';
    case'arena':return t>=3?'stadium':'arena';
    case'launchpad':return'launch pad';
    case'wall':return'city wall';
    case'farm':return b.grove?'grove':'farm';
    default:return b.kind;
  }
}
