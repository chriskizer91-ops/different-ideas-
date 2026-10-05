/* ================= sound: procedural sfx, ambience beds and generative music (pure Web Audio, no files) ================= */
const AU_MASTER=.42,AU_MUSV=.5,AU_CAP=12,AU_MCAP=9;
let auC=null,auDead=false,auUnl=false,auOn=null,auMOn=null,auOffT=0,auFr=0;
let auOut=null,auSfx=null,auAmb=null,auMus=null,auVerb=null,auEcho=null,auWhite=null,auBrown=null,auKS=null,auKSf=220,auPanOK=false;
const auV=[],auLast={},auBed={};
const auSm={ocean:0,river:0,tree:0,green:0,bld:0,fire:0,lava:0,mount:0,war:0};
const auSt={era:0,war:false,night:0,zo:0,storm:0,fireL:0,pz:1,u:.31,v:.67,ck:0};
const auPts={tree:{x:[],y:[],n:0},bld:{x:[],y:[],n:0},lava:{x:[],y:[],n:0}};
const auR=(a,b)=>a+Math.random()*(b-a);
const auFin=x=>Number.isFinite(x)?x:0;
const auCl=(x,a,b)=>x<a?a:x>b?b:x;
const auMidi=m=>440*Math.pow(2,(m-69)/12);

/* ---------- node helpers: every node a voice makes is listed so it can be disconnected when the voice ends ---------- */
function auVox(dur,g,pan,send,bus,t){
  const c=auC;t=t||c.currentTime+.015;
  const o=c.createGain();o.gain.value=auFin(g);
  const V={t,end:t+dur,n:[o],o,m:bus===auMus,name:''};
  let last=o;
  if(pan&&auPanOK){const p=c.createStereoPanner();p.pan.value=auCl(auFin(pan),-1,1);o.connect(p);V.n.push(p);last=p;}
  last.connect(bus||auSfx);
  if(send>0){const s=c.createGain();s.gain.value=send;o.connect(s);s.connect(auVerb);V.n.push(s);}
  auV.push(V);return V;
}
function auO(V,type,f,t0,t1){const o=auC.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t0);o.start(t0);o.stop(t1);V.n.push(o);return o;}
function auNz(V,brown,t0,t1,rate){
  const s=auC.createBufferSource(),b=brown?auBrown:auWhite;s.buffer=b;s.loop=true;if(rate)s.playbackRate.value=rate;
  s.start(t0,Math.random()*(b.duration-.6));s.stop(t1);V.n.push(s);return s;
}
function auF(V,type,f,q){const b=auC.createBiquadFilter();b.type=type;b.frequency.value=f;if(q!==undefined)b.Q.value=q;V.n.push(b);return b;}
function auGn(V,val){const g=auC.createGain();g.gain.value=val;V.n.push(g);return g;}
function auW(){for(let i=0;i<arguments.length-1;i++)arguments[i].connect(arguments[i+1]);return arguments[0];}
/* percussive envelope: linear attack, exponential fall to silence */
function auE(p,t,a,pk,d){p.setValueAtTime(1e-4,t);p.linearRampToValueAtTime(Math.max(2e-4,pk),t+a);p.exponentialRampToValueAtTime(1e-4,t+a+d);}
function auSw(p,t,a,b,d){p.setValueAtTime(a,t);p.exponentialRampToValueAtTime(b,t+d);}
/* random wobble of a gain, for rolling rumbles */
function auRoll(p,t,d,k){p.setValueAtTime(.6,t);for(let i=1;i<=k;i++)p.linearRampToValueAtTime(auR(.3,1),t+i*d/k);}
function auPrune(now){
  let w=0;
  for(let i=0;i<auV.length;i++){const V=auV[i];if(V.end+.15<now){for(const n of V.n){try{n.disconnect();}catch(e){}}}else auV[w++]=V;}
  auV.length=w;
}
function auCount(m,name){let n=0;for(const V of auV)if(V.m===m&&(!name||V.name===name))n++;return n;}

/* ---------- buffers: one white and one brown noise, one plucked string (Karplus-Strong), made once ---------- */
function auNoise(sec,brown){
  const sr=auC.sampleRate,n=Math.floor(sr*sec),b=auC.createBuffer(1,n,sr),d=b.getChannelData(0);
  let last=0,m=0;
  for(let i=0;i<n;i++){const w=Math.random()*2-1;if(brown){last=(last+.02*w)/1.02;d[i]=last;}else d[i]=w;}
  if(brown){/* tilt so the loop joins without a step, then remove DC */
    const a=d[0],z=d[n-1];let mean=0;
    for(let i=0;i<n;i++){d[i]-=a+(z-a)*i/(n-1);mean+=d[i];}
    mean/=n;for(let i=0;i<n;i++)d[i]-=mean;
  }
  for(let i=0;i<n;i++)m=Math.max(m,Math.abs(d[i]));
  const k=.95/(m||1);for(let i=0;i<n;i++)d[i]*=k;
  return b;
}
function auMkKS(){
  const sr=auC.sampleRate,P=Math.round(sr/220),n=Math.floor(sr*2.6),b=auC.createBuffer(1,n,sr),d=b.getChannelData(0);
  auKSf=sr/P;let lp=0,mean=0,m=0;
  for(let i=0;i<P;i++){lp+=(Math.random()*2-1-lp)*.55;d[i]=lp;mean+=lp;}
  mean/=P;for(let i=0;i<P;i++)d[i]-=mean;
  for(let i=P;i<n;i++)d[i]=.4985*(d[i-P]+(i>P?d[i-P-1]:d[0]));
  for(let i=0;i<n;i++)m=Math.max(m,Math.abs(d[i]));
  const k=.9/(m||1),fo=Math.floor(sr*.05);
  for(let i=0;i<n;i++)d[i]*=k*(i>n-fo?(n-i)/fo:1);
  return b;
}

/* ---------- the graph: buses -> master -> compressor -> trim -> speakers, with a delay-network "reverb" send ---------- */
function auInit(){
  try{
    const AC=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
    if(!AC){auDead=true;return;}
    const c=auC=new AC();
    auPanOK=typeof c.createStereoPanner==='function';
    const comp=c.createDynamicsCompressor();
    comp.threshold.value=-12;comp.knee.value=10;comp.ratio.value=5;comp.attack.value=.004;comp.release.value=.3;
    const trim=c.createGain();trim.gain.value=.8;
    auOut=c.createGain();auOut.gain.value=0;
    auW(auOut,comp,trim,c.destination);
    const bus=v=>{const g=c.createGain();g.gain.value=v;g.connect(auOut);return g;};
    auSfx=bus(1);auAmb=bus(.9);auMus=bus(0);
    auWhite=auNoise(3,false);auBrown=auNoise(4,true);auKS=auMkKS();
    /* four damped feedback combs, spread across the stereo field */
    auVerb=c.createGain();
    const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=200;auVerb.connect(hp);
    const vo=bus(.26);
    [[.0797,.77,-.7],[.1131,.71,.7],[.1517,.63,-.35],[.1971,.56,.35]].forEach(a=>{
      const d=c.createDelay(.5),f=c.createBiquadFilter(),g=c.createGain();
      d.delayTime.value=a[0];f.type='lowpass';f.frequency.value=2800;f.Q.value=-3;g.gain.value=a[1];
      auW(hp,d,f,g,d);
      if(auPanOK){const p=c.createStereoPanner();p.pan.value=a[2];auW(f,p,vo);}else f.connect(vo);
    });
    /* a long musical echo, used by the space-age score */
    auEcho=c.createGain();
    const ed=c.createDelay(1.5),ef=c.createBiquadFilter(),eg=c.createGain(),eo=bus(.5),ev=c.createGain();
    ed.delayTime.value=.45;ef.type='lowpass';ef.frequency.value=2000;eg.gain.value=.42;ev.gain.value=.25;
    auW(auEcho,ed,ef,eg,ed);ef.connect(eo);auW(ef,ev,auVerb);
    auBeds();
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{
      try{if(document.hidden){if(auC.state==='running'){const p=auC.suspend();if(p&&p.catch)p.catch(()=>{});}}else if(auOn)auResume();}catch(e){}
    });
  }catch(e){auDead=!auC||!auOut||!auBrown;if(auDead)auC=null;}
}
function auResume(){
  try{
    if(auC.state!=='running'&&!(typeof document!=='undefined'&&document.hidden)){const p=auC.resume();if(p&&p.catch)p.catch(()=>{});}
  }catch(e){}
}
function auApply(){
  if(!auC)return;
  try{
    const t=auC.currentTime;
    auOut.gain.setTargetAtTime(auOn?AU_MASTER:0,t,.1);
    auMus.gain.setTargetAtTime(auMOn?AU_MUSV:0,t,.5);
    clearTimeout(auOffT);
    if(auOn)auResume();
    else auOffT=setTimeout(()=>{try{if(!auOn&&auC.state==='running'){const p=auC.suspend();if(p&&p.catch)p.catch(()=>{});}}catch(e){}},700);
  }catch(e){}
}
function auStart(){
  if(!auC&&!auDead)auInit();
  if(!auC)return;
  auApply();
  /* iOS needs a sound started inside the gesture */
  try{const b=auC.createBuffer(1,1,22050),s=auC.createBufferSource();s.buffer=b;s.connect(auC.destination);s.start(0);}catch(e){}
}

/* ---------- ambience beds: looping noise through filters, levels steered from the world each frame ---------- */
function auBeds(){
  const c=auC;
  const mk=name=>{const out=c.createGain();out.gain.value=0;return auBed[name]={out,on:false,cur:0,z0:0};};
  const src=(brown,rate)=>{const s=c.createBufferSource(),b=brown?auBrown:auWhite;s.buffer=b;s.loop=true;s.playbackRate.value=rate;s.start(0,Math.random()*(b.duration-.6));return s;};
  const flt=(type,f,q)=>{const b=c.createBiquadFilter();b.type=type;b.frequency.value=f;if(q!==undefined)b.Q.value=q;return b;};
  const gn=v=>{const g=c.createGain();g.gain.value=v;return g;};
  const lfo=(f,...pd)=>{const o=c.createOscillator();o.frequency.value=f;for(let i=0;i<pd.length;i+=2){const g=gn(pd[i+1]);o.connect(g);g.connect(pd[i]);}o.start();return o;};
  /* ocean surf: brown noise that swells and washes */
  let B=mk('surf');const sl=flt('lowpass',420,0),sw=gn(.62);auW(src(1,.9),sl,sw,B.out);
  B=mk('hiss');const hb=flt('bandpass',1300,.6),hg=gn(.6);auW(src(0,.8),hb,flt('lowpass',5000,0),hg,B.out);
  lfo(.071,sw.gain,.26,sl.frequency,200,hg.gain,.3);lfo(.113,sw.gain,.12);
  /* wind: narrow band of noise whose centre wanders */
  B=mk('wind');const wb=flt('bandpass',560,2.2),wg=gn(.72);auW(src(0,.55),wb,flt('lowpass',1700,0),wg,B.out);B.f=wb;
  lfo(.05,wb.frequency,260);lfo(.13,wb.frequency,90);lfo(.17,wg.gain,.28);
  /* rain */
  B=mk('rain');auW(src(0,1),flt('highpass',1400,0),flt('lowpass',7500,0),B.out);
  /* town murmur */
  B=mk('town');const tg=gn(.65);B.f=flt('bandpass',430,.8);auW(src(0,.5),B.f,flt('lowpass',1100,0),tg,B.out);lfo(.37,tg.gain,.22);lfo(1.3,tg.gain,.12);
  /* fire: crackle spikes on a high band plus a low roar */
  B=mk('fire');B.ck=gn(.05);B.rg=gn(.5);auW(src(0,1.1),flt('highpass',1900,0),B.ck,B.out);auW(src(1,1.3),flt('lowpass',380,0),B.rg,B.out);
  /* lava: deep resonant bubbling */
  B=mk('lava');const ll=flt('lowpass',150,4),lg=gn(.7);auW(src(1,.55),ll,lg,B.out);lfo(.23,lg.gain,.28);lfo(.09,ll.frequency,40);
  /* crickets: a high sine, pulsed fast and gated into short chirps */
  B=mk('crk');
  try{
    const Hn=10,re=new Float32Array(Hn+1),im=new Float32Array(Hn+1),du=.16;
    for(let n=1;n<=Hn;n++){const x=Math.PI*n/(Hn+1);re[n]=2/(n*Math.PI)*Math.sin(n*Math.PI*du)*Math.sin(x)/x;}
    const pw=c.createPeriodicWave(re,im,{disableNormalization:true});
    [[4300,29,1.6,-.45],[4850,33,1.37,.5]].forEach(a=>{
      const car=c.createOscillator(),am=gn(.5),gate=gn(du),go=c.createOscillator();
      car.frequency.value=a[0];lfo(a[1],am.gain,.5);go.setPeriodicWave(pw);go.frequency.value=a[2];go.connect(gate.gain);
      auW(car,am,gate);
      if(auPanOK){const p=c.createStereoPanner();p.pan.value=a[3];auW(gate,p,B.out);}else gate.connect(B.out);
      car.start();go.start();
    });
  }catch(e){}
}
function auBedLvl(k,lvl,now){
  const B=auBed[k];if(!B)return;
  lvl=auFin(lvl);
  if(lvl>8e-4){if(!B.on){B.out.connect(auAmb);B.on=true;}B.z0=0;}
  else if(B.on){if(!B.z0)B.z0=now;else if(now-B.z0>3){try{B.out.disconnect();}catch(e){}B.on=false;}}
  if(Math.abs(lvl-B.cur)>1.5e-3||(lvl===0&&B.cur!==0)){B.out.gain.setTargetAtTime(lvl,now,.35);B.cur=lvl;}
}

/* ---------- reading the world: a rotating low-discrepancy sample of the visible tiles ---------- */
function auPush(P,x,y){const k=P.n++&7;P.x[k]=x;P.y[k]=y;}
function auPick(P){if(!P.n)return null;const k=Math.random()*Math.min(8,P.n)|0;return[P.x[k]+Math.random(),P.y[k]+Math.random()];}
function auScan(dt){
  const st=auSt,z=Math.max(.05,auFin(cam.z)||1),tw=vw/z,th=vh/z,c=[0,0,0,0,0,0,0,0,0];
  st.zo=auCl((6-z)/5,0,1);st.night=auCl(auFin(nightF),0,1);st.pz=speed===0?.5:1;
  let K=0;
  if(W>0&&H>0&&tile){
    const x0=Math.max(0,Math.floor(cam.x)),y0=Math.max(0,Math.floor(cam.y)),x1=Math.min(W,Math.ceil(cam.x+tw)),y1=Math.min(H,Math.ceil(cam.y+th)),w=x1-x0,h=y1-y0;
    if(w>0&&h>0){
      K=Math.min(240,w*h);
      for(let k=0;k<K;k++){
        st.u+=.7548776662466927;if(st.u>=1)st.u-=1;st.v+=.5698402909980532;if(st.v>=1)st.v-=1;
        const x=x0+(st.u*w|0),y=y0+(st.v*h|0),i=y*W+x,t=tile[i];
        if(t<=WATER)c[0]++;
        else if(t===RIVER)c[1]++;
        else if(t===FOREST||t===JUNGLE||t===PINE){c[2]++;if(Math.random()<.05)auPush(auPts.tree,x,y);}
        else if(t===GRASS||t===SAVANNA||t===SWAMP){c[3]++;if(Math.random()<.01)auPush(auPts.tree,x,y);}
        else if(t===LAVA){c[6]++;if(Math.random()<.2)auPush(auPts.lava,x,y);}
        else if(t===MOUNT||t===SNOW)c[7]++;
        const b=bmap&&bmap[i];
        if(b){c[4]++;if(Math.random()<.1)auPush(auPts.bld,x,y);const kk=b.v&&b.v.k;if(kk&&kk.wars&&kk.wars.size)c[8]++;}
        if(fire&&fire[i])c[5]++;
      }
    }
  }
  const a=1-Math.exp(-dt/900),sm=auSm,keys=['ocean','river','tree','green','bld','fire','lava','mount','war'];
  for(let j=0;j<9;j++){const f=K?c[j]/K:0;sm[keys[j]]+=(f-sm[keys[j]])*a;}
  st.fireL=Math.min(1,Math.sqrt(sm.fire*40));
  /* storms over the view: how close, how strong, how much of the screen they cover */
  let s=0;
  if(storms&&storms.length)for(const S2 of storms){
    const amt=Math.min(1,S2.t/120,(S2.life-S2.t)/120);if(!(amt>0))continue;
    const qx=auCl(S2.x,cam.x,cam.x+tw),qy=auCl(S2.y,cam.y,cam.y+th),d=Math.hypot(S2.x-qx,S2.y-qy),r=Math.max(1,S2.r||6);
    const ov=d<r?1:Math.max(0,1-(d-r)/(r*1.5));if(!(ov>0))continue;
    s=Math.max(s,amt*ov*(.35+.65*Math.min(1,Math.PI*r*r/Math.max(1,tw*th)*1.5)));
  }
  st.storm+=(auFin(s)-st.storm)*a;
}
function auMood(){
  let era=0,near=false;
  const z=Math.max(.05,auFin(cam.z)||1),tw=vw/z,th=vh/z,x0=cam.x-tw*.5,x1=cam.x+tw*1.5,y0=cam.y-th*.5,y1=cam.y+th*1.5;
  if(kingdoms)for(const k of kingdoms){
    if(!k||!k.alive)continue;
    if(k.age>era)era=k.age;
    if(!near&&k.wars&&k.wars.size>0&&k.villages)for(const v of k.villages)if(v&&v.x>=x0&&v.x<=x1&&v.y>=y0&&v.y<=y1){near=true;break;}
  }
  auSt.era=auCl(era|0,0,8);auSt.war=near||auSm.war>.01;
}
function auBedsSet(now){
  const s=auSm,st=auSt,zo=st.zo,nf=st.night,pz=st.pz,oc=Math.pow(s.ocean,.6);
  auBedLvl('surf',.3*oc*(1-.35*zo)*pz,now);
  auBedLvl('hiss',(.07*oc*(1-.5*zo)+.13*Math.min(1,s.river*6)*(1-.6*zo))*pz,now);
  auBedLvl('wind',Math.min(.4,.05+.11*zo+.1*s.mount+.26*st.storm)*pz,now);
  auBedLvl('rain',.15*st.storm*pz,now);
  auBedLvl('crk',.035*nf*Math.min(1,(s.tree+s.green)*1.6)*(1-.5*zo)*pz,now);
  auBedLvl('town',.14*Math.min(1,s.bld*4)*(.3+.7*(1-zo))*(1-.4*nf)*pz,now);
  auBedLvl('fire',.26*st.fireL*pz,now);
  auBedLvl('lava',.3*Math.min(1,Math.sqrt(s.lava*10))*pz,now);
  try{
    auBed.wind.f.frequency.setTargetAtTime(520+420*st.storm+200*zo,now,1.5);
    auBed.fire.rg.gain.setTargetAtTime(.25+.75*st.fireL,now,.5);
    auBed.town.f.frequency.setTargetAtTime(st.era>=6?300:430,now,2);
  }catch(e){}
}
/* little events that ride on the beds: birds, hammers, lava pops, fire crackles */
function auEvents(ds,now){
  const s=auSm,st=auSt,zo=st.zo,nf=st.night,pz=st.pz;
  let r=(.8*Math.pow(s.tree,.7)+.25*s.green)*(1-nf)*(1-.6*zo)*pz;
  if(Math.random()<r*ds){const p=auPick(auPts.tree);if(p)AU.sfx('birdcall',p[0],p[1],auR(.35,.9));}
  r=1.1*Math.min(1,s.bld*4)*(1-zo)*(1-.85*nf)*(pz<1?0:1);
  if(cam.z>=3&&Math.random()<r*ds){const p=auPick(auPts.bld);if(p)AU.sfx('build',p[0],p[1],auR(.2,.4));}
  r=1.4*Math.min(1,Math.sqrt(s.lava*10))*pz;
  if(Math.random()<r*ds){const p=auPick(auPts.lava);if(p)AU.sfx('_lava',p[0],p[1],auR(.4,1));}
  const B=auBed.fire;
  if(B&&B.on&&st.fireL>.01){
    if(st.ck<now+.02)st.ck=now+.02;
    const end=now+.05+ds,rate=6+40*st.fireL;
    while(st.ck<end){B.ck.gain.setValueAtTime(auR(.25,1),st.ck);B.ck.gain.setTargetAtTime(.05,st.ck+.002,.012);st.ck+=.004-Math.log(1-Math.random()*.999)/rate;}
  }
}

/* ---------- one-shot sound recipes: [min gap s, max at once, flags(1 priority, 2 always audible, 4 vol=size), fn] ---------- */
const auRootM=o=>auMidi(auM.root+o);
const AU_FX={
boom:[.16,5,4,(g,p,s,nr)=>{
  const d=.7+1.3*s,V=auVox(d+.1,g*(.5+.5*s),p,.1+.15*s),t=V.t;
  let n=auNz(V,1,t,t+d,.8),f=auF(V,'lowpass',800,0),e=auGn(V,0);
  auSw(f.frequency,t,700+1800*s,70+60*s,d*.85);auE(e.gain,t,.006,.9,d-.02);auW(n,f,e,V.o);
  const o=auO(V,'sine',125-45*s,t,t+.55+.5*s),e2=auGn(V,0);auSw(o.frequency,t,125-45*s,35,.3+.2*s);auE(e2.gain,t,.004,.75,.45+.5*s);auW(o,e2,V.o);
  n=auNz(V,0,t,t+.15);f=auF(V,'lowpass',3200,0);e=auGn(V,0);auE(e.gain,t,.002,.4*(.4+.6*nr),.09);auW(n,f,e,V.o);
}],
bigboom:[.25,3,1,(g,p,v,nr)=>{
  const V=auVox(4.6,g,p,.28),t=V.t;
  let n=auNz(V,1,t,t+4.4,.7),f=auF(V,'lowpass',1200,0),e=auGn(V,0);auSw(f.frequency,t,1500,60,3.6);auE(e.gain,t,.012,1,4.3);auW(n,f,e,V.o);
  n=auNz(V,1,t,t+4.5,.45);f=auF(V,'lowpass',240,2);e=auGn(V,0);const r=auGn(V,1);auRoll(r.gain,t,4.2,8);
  e.gain.setValueAtTime(1e-4,t);e.gain.linearRampToValueAtTime(.7,t+.5);e.gain.exponentialRampToValueAtTime(1e-4,t+4.5);auW(n,f,r,e,V.o);
  const o=auO(V,'sine',72,t,t+2.2),e2=auGn(V,0);auSw(o.frequency,t,72,26,1.6);auE(e2.gain,t,.005,.9,2.1);auW(o,e2,V.o);
  n=auNz(V,0,t,t+.4);f=auF(V,'lowpass',2600,0);e=auGn(V,0);auE(e.gain,t,.002,.1+.5*nr,.3);auW(n,f,e,V.o);
}],
thunder:[.3,2,1,(g,p,v,nr)=>{
  const lag=(1-nr)*.5,V=auVox(5+lag,g*1.5,p,.3),t=V.t,tl=t+lag;
  if(nr>.3){
    const n=auNz(V,0,t,t+.7),e=auGn(V,0),q=e.gain;auW(n,auF(V,'highpass',700,0),auF(V,'lowpass',6000,0),e,V.o);
    q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.8*nr,t+.004);q.exponentialRampToValueAtTime(.05,t+.09);q.linearRampToValueAtTime(.6*nr,t+.12);q.exponentialRampToValueAtTime(1e-4,t+.6);
  }
  const n=auNz(V,1,tl,tl+4.9,.6),f=auF(V,'lowpass',400,0),r=auGn(V,1),e=auGn(V,0),q=e.gain;
  auSw(f.frequency,tl,420,110,3.8);auRoll(r.gain,tl,4.2,9);
  q.setValueAtTime(1e-4,tl);q.linearRampToValueAtTime(1,tl+.35);q.exponentialRampToValueAtTime(1e-4,tl+4.8);auW(n,f,r,e,V.o);
}],
fire:[.12,3,0,(g,p)=>{
  const V=auVox(1.1,g,p,.08),t=V.t,n=auNz(V,0,t,t+1.05),b=auF(V,'bandpass',260,.9),e=auGn(V,0),q=e.gain;
  b.frequency.setValueAtTime(260,t);b.frequency.exponentialRampToValueAtTime(2200,t+.35);b.frequency.exponentialRampToValueAtTime(700,t+1);
  q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.5,t+.12);q.exponentialRampToValueAtTime(1e-4,t+1);auW(n,b,e,V.o);
  const n2=auNz(V,1,t,t+.7),e2=auGn(V,0);auE(e2.gain,t,.04,.45,.55);auW(n2,auF(V,'lowpass',320,0),e2,V.o);
}],
clash:[.06,5,0,(g,p)=>{
  const b=auR(1000,1600),V=auVox(.42,g,p,.12),t=V.t;
  for(const a of [[1,.09,.32],[1.47,.06,.22],[2.66,.04,.14],[3.9,.022,.08]]){const o=auO(V,'sine',b*a[0]*auR(.99,1.01),t,t+a[2]+.03),e=auGn(V,0);auE(e.gain,t,.001,a[1],a[2]);auW(o,e,V.o);}
  const n=auNz(V,0,t,t+.08),e=auGn(V,0);auE(e.gain,t,.001,.2,.04);auW(n,auF(V,'highpass',2500,0),e,V.o);
}],
arrow:[.07,4,0,(g,p)=>{
  const f=auR(170,220),V=auVox(.5,g,p,.05),t=V.t,o=auO(V,'triangle',f,t,t+.2),e=auGn(V,0);
  auSw(o.frequency,t,f,f*.88,.12);auE(e.gain,t,.002,.2,.16);auW(o,auF(V,'lowpass',1400,0),e,V.o);
  const n=auNz(V,0,t,t+.45),b=auF(V,'bandpass',3400,5),e2=auGn(V,0),q=e2.gain;auSw(b.frequency,t+.02,3400,1300,.32);
  q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.26,t+.13);q.exponentialRampToValueAtTime(1e-4,t+.42);auW(n,b,e2,V.o);
}],
shot:[.07,4,0,(g,p)=>{
  const V=auVox(1,g,p,.3),t=V.t,n=auNz(V,0,t,t+.2),f=auF(V,'lowpass',6000,0),e=auGn(V,0);
  auSw(f.frequency,t,6000,900,.16);auE(e.gain,t,.001,.45,.14);auW(n,f,e,V.o);
  const o=auO(V,'sine',170,t,t+.16),e2=auGn(V,0);auSw(o.frequency,t,170,55,.08);auE(e2.gain,t,.002,.3,.12);auW(o,e2,V.o);
  const n2=auNz(V,1,t,t+.85),e3=auGn(V,0);auE(e3.gain,t,.01,.22,.7);auW(n2,auF(V,'lowpass',600,0),e3,V.o);
}],
cannon:[.15,3,0,(g,p)=>{
  const V=auVox(1.5,g,p,.22),t=V.t,o=auO(V,'sine',95,t,t+.8),e=auGn(V,0);auSw(o.frequency,t,95,32,.4);auE(e.gain,t,.003,.75,.75);auW(o,e,V.o);
  const n=auNz(V,1,t,t+1.3,.8),f=auF(V,'lowpass',800,0),e2=auGn(V,0);auSw(f.frequency,t,800,140,.6);auE(e2.gain,t,.004,.65,1.2);auW(n,f,e2,V.o);
  const n2=auNz(V,0,t,t+.1),e3=auGn(V,0);auE(e3.gain,t,.001,.4,.06);auW(n2,auF(V,'lowpass',2400,0),e3,V.o);
}],
splash:[.1,3,0,(g,p)=>{
  const V=auVox(.75,g,p,.1),t=V.t,n=auNz(V,0,t,t+.5),e=auGn(V,0),q=e.gain;
  q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.42,t+.012);q.exponentialRampToValueAtTime(1e-4,t+.45);auW(n,auF(V,'bandpass',1100,.8),e,V.o);
  const n2=auNz(V,1,t,t+.32),e2=auGn(V,0);auE(e2.gain,t,.006,.36,.28);auW(n2,auF(V,'lowpass',450,0),e2,V.o);
  const o=auO(V,'sine',600,t,t+.7),e3=auGn(V,0),pf=o.frequency,pg=e3.gain;pg.setValueAtTime(0,t);
  for(let i=0,tk=t+.08;i<3;i++,tk+=auR(.07,.15)){const f=auR(500,1100);pf.setValueAtTime(f,tk);pf.exponentialRampToValueAtTime(f*1.9,tk+.05);pg.setValueAtTime(1e-4,tk);pg.linearRampToValueAtTime(.07,tk+.005);pg.exponentialRampToValueAtTime(1e-4,tk+.06);}
  auW(o,e3,V.o);
}],
build:[.05,3,0,(g,p)=>{
  const f=auR(480,820),V=auVox(.22,g,p,.06),t=V.t,o=auO(V,'triangle',f,t,t+.12),e=auGn(V,0);
  auSw(o.frequency,t,f,f*.9,.06);auE(e.gain,t,.001,.17,.08);auW(o,e,V.o);
  const n=auNz(V,0,t,t+.05),e2=auGn(V,0);auE(e2.gain,t,5e-4,.19,.025);auW(n,auF(V,'bandpass',2200,1.4),e2,V.o);
}],
chop:[.08,3,0,(g,p)=>{
  const V=auVox(.35,g,p,.08),t=V.t,n=auNz(V,0,t,t+.1),e=auGn(V,0);auE(e.gain,t,.001,.32,.07);auW(n,auF(V,'bandpass',1150,1.6),e,V.o);
  const o=auO(V,'triangle',280,t,t+.15),e2=auGn(V,0);auSw(o.frequency,t,280,150,.08);auE(e2.gain,t,.002,.21,.11);auW(o,e2,V.o);
  const n2=auNz(V,1,t,t+.16),e3=auGn(V,0);auE(e3.gain,t,.002,.18,.12);auW(n2,auF(V,'lowpass',650,0),e3,V.o);
}],
roar:[.6,2,1,(g,p)=>{
  const f0=auR(70,95),V=auVox(2.4,g,p,.25),t=V.t,am=auGn(V,.65),l=auO(V,'sine',auR(26,34),t,t+2.3),lg=auGn(V,.35),lp=auF(V,'lowpass',300,7),e=auGn(V,0),q=e.gain;
  auW(l,lg,am.gain);
  lp.frequency.setValueAtTime(260,t);lp.frequency.linearRampToValueAtTime(1300,t+.45);lp.frequency.exponentialRampToValueAtTime(380,t+2.1);
  [1,1.007,1.5].forEach((r,i)=>{const o=auO(V,'sawtooth',f0*r*.8,t,t+2.3),pf=o.frequency;pf.linearRampToValueAtTime(f0*r*1.25,t+.5);pf.exponentialRampToValueAtTime(f0*r*.72,t+2.1);auW(o,auGn(V,i===2?.3:.6),lp);});
  q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.5,t+.25);q.linearRampToValueAtTime(.42,t+1.2);q.exponentialRampToValueAtTime(1e-4,t+2.2);auW(lp,am,e,V.o);
  const n=auNz(V,1,t,t+2.3),e2=auGn(V,0),q2=e2.gain;
  q2.setValueAtTime(1e-4,t);q2.linearRampToValueAtTime(.3,t+.25);q2.linearRampToValueAtTime(.25,t+1.2);q2.exponentialRampToValueAtTime(1e-4,t+2.2);auW(n,auF(V,'bandpass',600,.7),e2,V.o);
}],
zombie:[.35,2,0,(g,p)=>{
  const f0=auR(90,120),V=auVox(1.9,g,p,.12),t=V.t,o=auO(V,'sawtooth',f0*1.1,t,t+1.85),l=auO(V,'sine',5.5,t,t+1.85),e=auGn(V,0),q=e.gain;
  o.frequency.exponentialRampToValueAtTime(f0*.82,t+1.6);auW(l,auGn(V,f0*.03),o.frequency);
  auW(o,auF(V,'bandpass',520,4),e);auW(o,auF(V,'bandpass',1150,6),auGn(V,.45),e);
  q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.9,t+.35);q.linearRampToValueAtTime(.7,t+1.1);q.exponentialRampToValueAtTime(1e-4,t+1.8);e.connect(V.o);
}],
rocket:[1,2,1,(g,p)=>{
  const V=auVox(6.6,g,p,.2),t=V.t,n=auNz(V,1,t,t+6.5),f=auF(V,'lowpass',150,0),e=auGn(V,0),q=e.gain;
  auSw(f.frequency,t,150,1100,5);q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.6,t+1.2);q.linearRampToValueAtTime(.5,t+4);q.exponentialRampToValueAtTime(1e-4,t+6.4);auW(n,f,e,V.o);
  const n2=auNz(V,0,t,t+6.5),b=auF(V,'bandpass',450,.7),e2=auGn(V,0),q2=e2.gain;
  auSw(b.frequency,t,450,2600,5);q2.setValueAtTime(1e-4,t);q2.linearRampToValueAtTime(.13,t+1.5);q2.linearRampToValueAtTime(.1,t+4.2);q2.exponentialRampToValueAtTime(1e-4,t+6.4);auW(n2,b,e2,V.o);
  const o=auO(V,'sine',46,t,t+6.3),e3=auGn(V,0),q3=e3.gain;auSw(o.frequency,t,46,120,5);
  q3.setValueAtTime(1e-4,t);q3.linearRampToValueAtTime(.35,t+1);q3.exponentialRampToValueAtTime(1e-4,t+6.2);auW(o,e3,V.o);
}],
horn:[1,1,3,(g,p)=>{
  let f=auRootM(-24);while(f<80)f*=2;while(f>130)f/=2;
  const V=auVox(2.9,g,p,.35),t=V.t,lp=auF(V,'lowpass',200,2),e=auGn(V,0),q=e.gain,lf=lp.frequency;
  lf.setValueAtTime(180,t);lf.linearRampToValueAtTime(950,t+.35);lf.linearRampToValueAtTime(650,t+2);lf.linearRampToValueAtTime(260,t+2.7);
  for(const a of [[1,.5,'sawtooth'],[1.004,.4,'sawtooth'],[1.5,.16,'sawtooth'],[.5,.35,'sine']]){const o=auO(V,a[2],f*a[0]*.92,t,t+2.85);o.frequency.exponentialRampToValueAtTime(f*a[0],t+.18);auW(o,auGn(V,a[1]),lp);}
  q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.7,t+.3);q.linearRampToValueAtTime(.6,t+2);q.exponentialRampToValueAtTime(1e-4,t+2.8);auW(lp,e,V.o);
}],
peace:[1,1,3,(g,p)=>{
  const V=auVox(4,g,p,.45),t=V.t;
  [0,4,7].forEach((iv,k)=>{const f=auRootM(12+iv),tk=t+k*.11;
    for(const a of [[1,.12,3.3],[2.76,.035,1]]){const o=auO(V,'sine',f*a[0],tk,tk+a[2]+.05),e=auGn(V,0);auE(e.gain,tk,.004,a[1],a[2]);auW(o,e,V.o);}});
}],
fanfare:[1,1,3,(g,p)=>{
  const V=auVox(2.4,g,p,.3),t=V.t;
  for(const a of [[-5,0,.15,.9],[0,.17,.15,.95],[4,.34,1.15,1],[-12,.34,1.15,.55]]){
    const f=auRootM(12+a[0]),tk=t+a[1],d=a[2],lp=auF(V,'lowpass',f*2,3),e=auGn(V,0),q=e.gain,lf=lp.frequency;
    lf.setValueAtTime(f*1.5,tk);lf.linearRampToValueAtTime(Math.min(9000,f*7),tk+.04);lf.linearRampToValueAtTime(f*3.5,tk+d);
    q.setValueAtTime(1e-4,tk);q.linearRampToValueAtTime(.2*a[3],tk+.025);q.linearRampToValueAtTime(.16*a[3],tk+d);q.exponentialRampToValueAtTime(1e-4,tk+d+.28);
    for(const dt of [-6,6]){const o=auO(V,'sawtooth',f*.97,tk,tk+d+.3);o.detune.value=dt;o.frequency.exponentialRampToValueAtTime(f,tk+.04);o.connect(lp);}
    auW(lp,e,V.o);
  }
}],
wonder:[1.5,1,3,(g,p)=>{
  const V=auVox(3.8,g,p,.5),t=V.t,sum=auGn(V,.2),l=auO(V,'sine',5,t,t+3.7),lg=auGn(V,9),e=auGn(V,0),q=e.gain;l.connect(lg);
  for(const iv of [0,4,7,12])for(const dt of [-8,8]){const o=auO(V,'sawtooth',auRootM(iv),t,t+3.7);o.detune.value=dt;lg.connect(o.detune);o.connect(sum);}
  auW(sum,auF(V,'bandpass',700,3),e);auW(sum,auF(V,'bandpass',1150,4),auGn(V,.6),e);auW(sum,auF(V,'lowpass',450,0),auGn(V,.5),e);
  q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(1,t+1.4);q.linearRampToValueAtTime(.85,t+2.4);q.exponentialRampToValueAtTime(1e-4,t+3.6);e.connect(V.o);
}],
tech:[.4,2,3,(g,p)=>{
  const V=auVox(1.6,g,p,.45),t=V.t;
  [0,4,7,12,16].forEach((iv,k)=>{const tk=t+k*.065,o=auO(V,'triangle',auRootM(24+iv),tk,tk+.85),e=auGn(V,0);auE(e.gain,tk,.003,.15,.8);auW(o,e,V.o);});
}],
found:[.4,2,3,(g,p)=>{
  const V=auVox(1.9,g,p,.3),t=V.t;
  for(const a of [[0,0],[7,.2]]){const f=auRootM(12+a[0]),tk=t+a[1],o=auO(V,'triangle',f,tk,tk+1.6),o2=auO(V,'sine',f/2,tk,tk+1.6),e=auGn(V,0);
    auE(e.gain,tk,.03,.17,1.5);auW(o,auF(V,'lowpass',1700,0),e,V.o);auW(o2,auGn(V,.5),e);}
}],
ruin:[.6,1,3,(g,p)=>{
  const f=auRootM(-12),V=auVox(3.4,g,p,.35),t=V.t,lp=auF(V,'lowpass',650,0),e=auGn(V,0),q=e.gain;
  for(const a of [[1,.6,'triangle'],[1.1892,.45,'triangle'],[.5,.5,'sine']]){const o=auO(V,a[2],f*a[0],t,t+3.3);o.frequency.setValueAtTime(f*a[0],t+1.6);o.frequency.exponentialRampToValueAtTime(f*a[0]*.96,t+3.2);auW(o,auGn(V,a[1]),lp);}
  q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.32,t+.35);q.exponentialRampToValueAtTime(1e-4,t+3.2);auW(lp,e,V.o);
}],
plague:[.8,1,3,(g,p)=>{
  const f=auR(620,720),V=auVox(3,g,p,.4),t=V.t,l=auO(V,'sine',6,t,t+2.9),lg=auGn(V,f*.012),lp=auF(V,'lowpass',2400,0),e=auGn(V,0),q=e.gain;l.connect(lg);
  for(const a of [[1,.5,'sine'],[1.012,.5,'sine'],[1.414,.25,'triangle']]){const o=auO(V,a[2],f*a[0],t,t+2.9);auSw(o.frequency,t,f*a[0],f*a[0]*.5,2.5);lg.connect(o.frequency);auW(o,auGn(V,a[1]),lp);}
  q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.3,t+.45);q.exponentialRampToValueAtTime(1e-4,t+2.8);auW(lp,e,V.o);
}],
rumble:[.12,3,0,(g,p)=>{
  const V=auVox(1,g,p,.05),t=V.t,n=auNz(V,1,t,t+.9,.7),e=auGn(V,0);auE(e.gain,t,.05,.45,.8);auW(n,auF(V,'lowpass',210,3),e,V.o);
  const n2=auNz(V,0,t,t+.5),e2=auGn(V,0);auE(e2.gain,t,.02,.09,.45);auW(n2,auF(V,'bandpass',380,.8),e2,V.o);
}],
water:[.15,2,0,(g,p)=>{
  const V=auVox(.9,g,p,.1),t=V.t,n=auNz(V,0,t,t+.8),e=auGn(V,0),q=e.gain;
  q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.1,t+.08);q.exponentialRampToValueAtTime(1e-4,t+.75);auW(n,auF(V,'bandpass',950,1.5),e,V.o);
  const o=auO(V,'sine',400,t,t+.85),e2=auGn(V,0),pf=o.frequency,pg=e2.gain;pg.setValueAtTime(0,t);
  for(let i=0,tk=t+.02,k=4+(Math.random()*3|0);i<k;i++,tk+=auR(.08,.12)){const f=auR(280,700);pf.setValueAtTime(f,tk);pf.exponentialRampToValueAtTime(f*2.3,tk+.045);pg.setValueAtTime(1e-4,tk);pg.linearRampToValueAtTime(.1,tk+.006);pg.exponentialRampToValueAtTime(1e-4,tk+.065);}
  auW(o,e2,V.o);
}],
paint:[.07,2,0,(g,p)=>{
  const V=auVox(.38,g,p,0),t=V.t,n=auNz(V,0,t,t+.35),b=auF(V,'bandpass',2800,1.2),e=auGn(V,0),q=e.gain;
  auSw(b.frequency,t,2800,1300,.28);q.setValueAtTime(1e-4,t);q.linearRampToValueAtTime(.09,t+.07);q.exponentialRampToValueAtTime(1e-4,t+.33);auW(n,b,e,V.o);
}],
click:[.03,2,1,(g,p)=>{
  const V=auVox(.08,g,p,0),t=V.t,o=auO(V,'sine',1700,t,t+.06),e=auGn(V,0);auE(e.gain,t,.001,.1,.04);auW(o,e,V.o);
}],
spawn:[.06,3,0,(g,p)=>{
  const k=auR(.85,1.2),V=auVox(.28,g,p,.08),t=V.t,o=auO(V,'sine',250*k,t,t+.25),e=auGn(V,0);
  auSw(o.frequency,t,250*k,700*k,.08);auE(e.gain,t,.004,.16,.17);auW(o,e,V.o);
}],
birdcall:[.18,2,0,(g,p)=>{
  const k=auR(.85,1.2),V=auVox(.55,g,p,.18),t=V.t,o=auO(V,'sine',3000*k,t,t+.5),e=auGn(V,0),pf=o.frequency,q=e.gain,ty=Math.random()*3|0;
  q.setValueAtTime(1e-4,t);
  if(ty===0)for(let c=0;c<2;c++){const tc=t+c*.14;pf.setValueAtTime(2500*k,tc);pf.exponentialRampToValueAtTime(4100*k,tc+.05);pf.exponentialRampToValueAtTime(3000*k,tc+.09);
    q.setValueAtTime(1e-4,tc);q.linearRampToValueAtTime(.1,tc+.012);q.linearRampToValueAtTime(.075,tc+.07);q.exponentialRampToValueAtTime(1e-4,tc+.1);}
  else if(ty===1){pf.setValueAtTime(4200*k,t);pf.exponentialRampToValueAtTime(2300*k,t+.3);q.linearRampToValueAtTime(.095,t+.03);q.exponentialRampToValueAtTime(1e-4,t+.34);}
  else for(let c=0;c<5;c++){const tc=t+c*.05;pf.setValueAtTime(3300*k,tc);pf.exponentialRampToValueAtTime(3900*k,tc+.03);q.setValueAtTime(1e-4,tc);q.linearRampToValueAtTime(.075,tc+.008);q.exponentialRampToValueAtTime(1e-4,tc+.04);}
  auW(o,e,V.o);
}],
firework:[.1,4,0,(g,p)=>{
  const V=auVox(1.7,g,p,.25),t=V.t,n=auNz(V,0,t,t+.15),e=auGn(V,0);auE(e.gain,t,.001,.5,.1);auW(n,auF(V,'lowpass',2600,0),e,V.o);
  const o=auO(V,'sine',240,t,t+.16),e2=auGn(V,0);auSw(o.frequency,t,240,75,.08);auE(e2.gain,t,.002,.4,.12);auW(o,e2,V.o);
  const n2=auNz(V,0,t,t+1.5),cg=auGn(V,0),q=cg.gain;
  for(let i=0,tt=t+.15;i<14;i++){tt+=auR(.02,.08);q.setValueAtTime(auR(.15,.55),tt);q.setTargetAtTime(0,tt+.002,.01);}
  auW(n2,auF(V,'highpass',3000,0),cg,V.o);
}],
_lava:[.3,1,0,(g,p)=>{
  const V=auVox(.35,g,p,.05),t=V.t,o=auO(V,'sine',80,t,t+.3),e=auGn(V,0);auSw(o.frequency,t,auR(60,90),auR(160,240),.12);auE(e.gain,t,.01,.3,.2);auW(o,e,V.o);
}]
};
/* where a sound sits on screen: [gain, pan, nearness] or null when far off */
function auPos(wx,wy,glob){
  const z=Math.max(.05,auFin(cam.z)||1),tw=vw/z,th=vh/z,dx=wx+.5-(cam.x+tw/2),dy=wy+.5-(cam.y+th/2),ox=Math.abs(dx)-tw/2,oy=Math.abs(dy)-th/2;
  let g;
  if(ox<=0&&oy<=0)g=1-.3*Math.max(Math.abs(dx)/(tw/2),Math.abs(dy)/(th/2));
  else{const o=Math.max(ox/tw,oy/th);g=o>=1?0:.7*(1-o)*(1-o);}
  g=auFin(g);const pan=auFin(auCl(dx/(tw/2)*.8,-.8,.8));
  if(glob)return[Math.max(.45,g),pan*.6,g];
  if(g<=0)return null;
  if(z<3)g*=.35+.65*auCl((z-.5)/2.5,0,1);
  return[g,pan,g];
}

/* ---------- generative score: phrases on a drifting key, timbre by era, minor and drums in war, sparse at night ---------- */
const AU_SC={pent:[0,2,4,7,9],mpent:[0,3,5,7,10],dor:[0,2,3,5,7,9,10],mix:[0,2,4,5,7,9,10],ion:[0,2,4,5,7,9,11],lyd:[0,2,4,6,7,9,11],aeo:[0,2,3,5,7,8,10]};
const AU_GRP=[0,0,1,1,2,2,3,4,5],AU_MODE=[['pent','mpent'],['dor','aeo'],['mix','aeo'],['ion','aeo'],['ion','aeo'],['lyd','aeo']];
const AU_STEP=[-2,-1,-1,-1,1,1,1,2,0,3,-3],AU_DUR=[1,1,1,1.5,2,2,3];
const auM={t:0,q:[],n:0,kc:8,root:52+(Math.random()*12|0),ch:0,grp:0,war:false,beat:.7,ps:0,pe:0,dr:0,dk:0};
const auDegM=(sc,base,deg)=>{const L=sc.length,o=Math.floor(deg/L);return base+o*12+sc[deg-o*L];};
function auSnap(d,ch,tn,L){let b=d,bd=99;for(let o=-1;o<=2;o++)for(const x of tn){const c=ch+x+o*L,dd=Math.abs(c-d);if(dd<bd){bd=dd;b=c;}}return b;}
/* instruments: each writes one note into a music voice */
function auFlute(V,f,t,d,vel){
  const o=auO(V,'sine',f*.985,t,t+d+.5),o2=auO(V,'triangle',f*2,t,t+d+.5),e=auGn(V,0),p=e.gain;
  o.frequency.exponentialRampToValueAtTime(f,t+.09);
  if(d>.9){const l=auO(V,'sine',5,t,t+d+.5),lg=auGn(V,0);lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(f*.006,t+.6);auW(l,lg,o.frequency);}
  p.setValueAtTime(1e-4,t);p.linearRampToValueAtTime(.13*vel,t+.08);p.linearRampToValueAtTime(.1*vel,t+d);p.exponentialRampToValueAtTime(1e-4,t+d+.45);
  o.connect(e);auW(o2,auGn(V,.08),e);e.connect(V.o);
  const n=auNz(V,0,t,t+.15),ng=auGn(V,0);auE(ng.gain,t,.01,.028*vel,.08);auW(n,auF(V,'bandpass',f*2.5,4),ng,V.o);
}
function auPluck(V,f,t,d,vel,lp){
  const s=auC.createBufferSource(),r=f/auKSf;s.buffer=auKS;s.playbackRate.value=r;V.n.push(s);
  const end=t+Math.max(.5,Math.min(auKS.duration/r,d+1.6)),e=auGn(V,0);
  e.gain.setValueAtTime(.7*vel,t);e.gain.setValueAtTime(.7*vel,end-.3);e.gain.linearRampToValueAtTime(0,end);
  s.start(t);s.stop(end);auW(s,auF(V,'lowpass',lp,0),e,V.o);
}
function auPiano(V,f,t,d,vel){
  const o=auO(V,'triangle',f,t,t+d+1.6),o2=auO(V,'sine',f*2,t,t+d+1.6),b=auF(V,'lowpass',f*4,0),e=auGn(V,0),p=e.gain;o2.detune.value=3;
  auSw(b.frequency,t,Math.min(6000,f*6),Math.max(300,f*1.5),1.5);
  p.setValueAtTime(1e-4,t);p.linearRampToValueAtTime(.19*vel,t+.012);p.exponentialRampToValueAtTime(.05*vel,t+Math.min(d,1.2)+.02);p.exponentialRampToValueAtTime(1e-4,t+d+1.5);
  o.connect(b);auW(o2,auGn(V,.3),b);auW(b,e,V.o);
}
function auEP(V,f,t,d,vel){
  const c=auO(V,'sine',f,t,t+d+1.4),m=auO(V,'sine',f,t,t+d+1.4),mg=auGn(V,0),e=auGn(V,0),p=e.gain;
  auSw(mg.gain,t,f*1.6,f*.15,1.2);auW(m,mg,c.frequency);
  p.setValueAtTime(1e-4,t);p.linearRampToValueAtTime(.14*vel,t+.006);p.exponentialRampToValueAtTime(.05*vel,t+Math.min(d,1.6)+.02);p.exponentialRampToValueAtTime(1e-4,t+d+1.3);
  auW(c,e,V.o);
}
function auSpace(V,f,t,d,vel){
  const o=auO(V,'sine',f,t,t+d+1.2),o2=auO(V,'triangle',f*2,t,t+d+1.2),e=auGn(V,0),p=e.gain,s=auGn(V,.35);o2.detune.value=6;
  p.setValueAtTime(1e-4,t);p.linearRampToValueAtTime(.14*vel,t+.04);p.exponentialRampToValueAtTime(1e-4,t+d+1.1);
  o.connect(e);auW(o2,auGn(V,.25),e);e.connect(V.o);auW(V.o,s,auEcho);
}
function auNote(grp,m,t,d,vel){
  if(auCount(true)>=AU_MCAP)return;
  const f=auMidi(m),V=auVox(d+[.6,1.7,1.7,1.7,1.5,1.3][grp],1,auR(-.3,.3),[.22,.28,.28,.3,.34,.5][grp],auMus,t);
  if(grp===0)auFlute(V,f,t,d,vel);else if(grp<3)auPluck(V,f,t,d,vel,grp===1?2600:1600);
  else if(grp===3)auPiano(V,f,t,d,vel);else if(grp===4)auEP(V,f,t,d,vel);else auSpace(V,f,t,d,vel);
}
function auBass(grp,m,t,vel){
  if(auCount(true)>=AU_MCAP)return;
  const V=auVox(3.3,1,0,.25,auMus,t),f=auMidi(m);
  if(grp===3)auPiano(V,f,t,1.4,vel*.8);else if(grp===4)auEP(V,f,t,1.6,vel*.7);else auPluck(V,f,t,1.5,vel*.8,900);
}
/* sustained pads: 0 low hum, 1 drone, 2 soft pad, 3 shimmer */
function auPad(kind,ms,t,len,vel){
  if(auCount(true)>=AU_MCAP)return;
  const A=[.9,1.5,1.2,2.2][kind],R=[1.5,2,2.2,3.5][kind],V=auVox(len+R+.1,1,0,[.2,.25,.3,.5][kind],auMus,t);
  const b=auF(V,'lowpass',[600,420,1100,1400][kind],kind===3?4:0),e=auGn(V,0),p=e.gain,pk=[.06,.04,.035,.03][kind]*vel,ty=['sine','sawtooth','triangle','sawtooth'][kind];
  for(const m of ms)for(const dt of kind?[-7,7]:[0]){const o=auO(V,ty,auMidi(m),t,t+len+R);o.detune.value=dt;o.connect(b);}
  if(kind===3){auW(auO(V,'sine',.15,t,t+len+R),auGn(V,500),b.frequency);}
  p.setValueAtTime(1e-4,t);p.linearRampToValueAtTime(pk,t+A);p.setValueAtTime(pk,t+Math.max(A,len));p.exponentialRampToValueAtTime(1e-4,t+len+R);
  auW(b,e,V.o);
  if(kind===3)auW(e,auGn(V,.3),auEcho);
}
function auDrum(t,a,low){
  if(auCount(true)>=AU_MCAP)return;
  const V=auVox(low?1.1:.45,low?.75:.4,0,low?.25:.1,auMus,t),f0=low?78:190,o=auO(V,'sine',f0,t,t+(low?1:.4)),e=auGn(V,0);
  auSw(o.frequency,t,f0,f0*.5,low?.25:.12);auE(e.gain,t,.004,.5*a,low?.9:.33);auW(o,e,V.o);
  const n=auNz(V,low?1:0,t,t+.15),g=auGn(V,0);auE(g.gain,t,.002,(low?.35:.12)*a,low?.12:.05);
  auW(n,auF(V,low?'lowpass':'bandpass',low?320:1000,low?0:1.3),g,V.o);
}
function auPhrase(now){
  const M=auM,st=auSt,first=!M.n++,ni=st.night>.5;
  M.grp=AU_GRP[st.era]||0;M.war=st.war;
  const sc=AU_SC[AU_MODE[M.grp][M.war?1:0]],L=sc.length,tn=L===7?[0,2,4]:[0,2,3];
  M.beat=[.74,.68,.64,.6,.58,.72][M.grp]*(ni?1.25:1)*(M.war?.92:1);
  if(--M.kc<=0){M.kc=6+(Math.random()*8|0);let r=M.root+[5,-5,7,-7,2,-2][Math.random()*6|0];while(r>63)r-=12;while(r<52)r+=12;M.root=r;}
  let rest=first?.3:auR(1.4,4)*(ni?1.7:1);if(!first&&Math.random()<.15)rest*=2.5;
  M.t=Math.max(M.t,now)+rest;
  const opts=L===7?[0,0,3,4,5,1,3,4]:[0,0,3,4,2];
  let ch=opts[Math.random()*opts.length|0];if(ch===M.ch)ch=opts[Math.random()*opts.length|0];M.ch=ch;
  const base=M.root+(ni?0:12),cnt=ni?3+(Math.random()*4|0):4+(Math.random()*5|0);
  let deg=ch+tn[Math.random()*3|0],tot=0,ai=Math.random()*3|0,dir=Math.random()<.5?1:-1;
  for(let i=0;i<cnt;i++){
    const last=i===cnt-1;
    if(M.grp===5){deg=ch+tn[((ai%3)+3)%3]+Math.floor(ai/3)*L;ai+=dir;if(ai>5||ai<-2)dir=-dir;}
    else if(i){deg+=AU_STEP[Math.random()*AU_STEP.length|0];if(deg>L+1)deg-=2;if(deg<-3)deg+=2;}
    if(last&&M.grp!==5)deg=auSnap(deg,ch,tn,L);
    const d=last?auR(2.5,4):M.grp===5?[1,1,1.5,1,2][Math.random()*5|0]:AU_DUR[Math.random()*AU_DUR.length|0];
    M.q.push({m:auDegM(sc,base,deg),d,v:(ni?.6:.85)*auR(.8,1),s:!last&&i>0&&Math.random()<(ni?.3:.12)});
    tot+=d;
  }
  const T=M.t,len=tot*M.beat,bm=auDegM(sc,M.root-12,ch),tri=tn.map(x=>auDegM(sc,M.root,ch+x));
  M.ps=T;M.pe=T+len;
  const v=ni?.7:1;
  if(M.grp===0)auPad(0,[bm],T,len,v);
  else if(M.grp===1)auBass(1,bm,T,v);
  else if(M.grp===2){auPad(1,[bm,bm+7],T,len,v);auBass(2,bm,T,v*.8);}
  else if(M.grp===3)auBass(3,bm,T,v);
  else if(M.grp===4){auPad(2,tri,T,len,v);auBass(4,bm,T,v);}
  else auPad(3,[bm,bm+7,tri[0]+12],T,len,v);
}
function auMusic(now){
  const M=auM;
  if(M.t<now-.5){M.t=now;M.q.length=0;}
  let guard=0;
  while(M.t<now+.3&&guard++<12){
    if(!M.q.length){auPhrase(now);continue;}
    const n=M.q.shift();
    if(!n.s)auNote(M.grp,n.m,M.t,n.d*M.beat,n.v);
    M.t+=n.d*M.beat;
  }
  /* slow war drums, or soft hand drums under stone-age phrases */
  const war=auSt.war,hand=!war&&M.grp===0;
  if(war||hand){
    if(M.dr<now)M.dr=now+.05;
    guard=0;
    while(M.dr<now+.3&&guard++<6){
      const k=M.dk++&7;
      if(war){const a=[1,0,0,0,.6,0,.35,.2][k];if(a)auDrum(M.dr,a*(auSt.night>.5?.7:1),1);M.dr+=M.beat;}
      else{const a=[.8,0,.35,0,.55,.3,0,.25][k];if(a&&M.dr>=M.ps&&M.dr<M.pe&&Math.random()<.85)auDrum(M.dr,a*.8,0);M.dr+=M.beat/2;}
    }
  }
}

/* ---------- public interface ---------- */
const AU={
  unlock(){
    if(auDead)return;
    try{
      auUnl=true;
      if(auOn===null)auOn=typeof S!=='undefined'&&!!S.sound;
      if(auMOn===null)auMOn=!(typeof S!=='undefined'&&S.music===false);
      if(!auOn)return;
      if(!auC)auStart();
      else if(auC.state!=='running')auStart();
    }catch(e){}
  },
  setOn(on){
    auOn=!!on;
    if(auMOn===null)auMOn=!(typeof S!=='undefined'&&S.music===false);
    try{if(auC)auApply();else if(auOn&&auUnl)auStart();}catch(e){}
  },
  setMusic(on){
    auMOn=!!on;
    try{if(auC){auApply();if(auMOn){auM.t=0;auM.n=0;auM.q.length=0;}}}catch(e){}
  },
  sfx(name,wx,wy,vol){
    if(!auC||!auOn)return;
    try{
      const R=AU_FX[name];if(!R||auC.state!=='running')return;
      const t=auC.currentTime,L=auLast[name]||(auLast[name]={t:-9,h:[]});
      if(t-L.t<R[0])return;
      let v=vol==null?(R[2]&4?.5:1):+vol;v=Number.isFinite(v)?auCl(v,0,1):1;
      let g=1,pan=0,nr=1;
      if(wx!=null&&wy!=null&&Number.isFinite(+wx)&&Number.isFinite(+wy)){const P=auPos(+wx,+wy,R[2]&2);if(!P)return;g=P[0];pan=P[1];nr=P[2];}
      let n=0;for(const x of L.h)if(t-x<.2)n++;
      g*=1/(1+.6*n);
      if(!(R[2]&4))g*=v;
      if(!(g>=.012))return;
      auPrune(t);
      if(auCount(false,name)>=R[1]||auCount(false)>=AU_CAP+(R[2]&1?3:0))return;
      L.t=t;L.h.push(t);if(L.h.length>5)L.h.shift();
      const before=auV.length;
      R[3](g,pan,v,nr);
      for(let i=before;i<auV.length;i++)auV[i].name=name;
    }catch(e){}
  },
  update(dt){
    if(!auC)return;
    try{
      const now=auC.currentTime;
      auPrune(now);
      if(!auOn||auC.state!=='running')return;
      dt=auCl(auFin(+dt)||16,0,250);auFr++;
      try{auScan(dt);if(auFr%20===1)auMood();}catch(e){}
      try{if(auFr%6===0)auBedsSet(now);}catch(e){}
      try{auEvents(dt/1000,now);}catch(e){}
      try{if(auMOn)auMusic(now);}catch(e){}
    }catch(e){}
  }
};
