/* ================= history of the world: stat tiles, a chart and the wonders ================= */
let histHover=-1;
function histSeries(){
  /* the realms that mattered most: the largest ever, up to six; colour follows each realm */
  const ks=kingdoms.filter(k=>k.hist.length>1).sort((a,b)=>b.peak-a.peak).slice(0,6);
  return ks;
}
function drawHistory(chartOnly){
  const cvh=$('hChart');if(!cvh)return;
  if(!chartOnly)histPanels();
  drawHistChart(cvh);
  const cc=$('cChart');if(cc)drawClimChart(cc);
}
/* the climate as two small charts over the same years: temperature above, sea level below */
let climHover=-1;
function drawClimChart(cvh){
  const css=getComputedStyle(document.body),v=n=>css.getPropertyValue(n).trim();
  const ink=v('--ink')||'#12263f',muted=v('--muted')||'#4d6577',surf=v('--panel')||'#d7ebe4',cW=v('--viz-warm')||'#eb6834',cS=v('--viz-sea')||'#2a78d6';
  const r=window.devicePixelRatio||1,w=cvh.clientWidth||400,h=cvh.clientHeight||200;
  if(cvh.width!==Math.round(w*r)||cvh.height!==Math.round(h*r)){cvh.width=Math.round(w*r);cvh.height=Math.round(h*r);}
  const c=cvh.getContext('2d');c.setTransform(r,0,0,r,0,0);c.clearRect(0,0,w,h);c.font='12px '+FONT;
  const d=climHist;
  if(d.length<2){c.fillStyle=muted;c.textBaseline='middle';c.fillText('The climate has not been recorded for long enough yet.',8,h/2);return;}
  const y0=d[0][0],y1=d[d.length-1][0],L=48,R=74,T=18,gap=26,B=20,ph=(h-T-B-gap)/2,pw=w-L-R;
  const X=yr=>L+(yr-y0)/Math.max(1,y1-y0)*pw;
  const panels=[
    {name:'World temperature',col:cW,get:p=>p[1],fmt:x=>degTxt(Math.round(x*10)/10),top:T,unit:1},
    {name:'Sea level',col:cS,get:p=>p[2]*60,fmt:x=>(x>0?'+':x<0?'\u2212':'')+fmtM(Math.abs(x)),top:T+ph+gap,unit:60}];
  for(const P of panels){
    let lo=0,hi=0;for(const p of d){const x=P.get(p);if(x<lo)lo=x;if(x>hi)hi=x;}
    const pad=P.unit;lo=Math.min(lo,-pad*.5);hi=Math.max(hi,pad);
    const Y=x=>P.top+ph-(x-lo)/(hi-lo)*ph;
    c.fillStyle=ink;c.textAlign='left';c.textBaseline='bottom';c.font='600 12px '+FONT;c.fillText(P.name,L,P.top-4);c.font='12px '+FONT;
    /* a quiet zero line, labelled on the axis */
    c.strokeStyle=muted;c.globalAlpha=.35;c.lineWidth=1;const yz=Math.round(Y(0))+.5;c.beginPath();c.moveTo(L,yz);c.lineTo(L+pw,yz);c.stroke();c.globalAlpha=1;
    c.fillStyle=muted;c.textAlign='right';c.textBaseline='middle';c.fillText(P.fmt(0).replace(/^\u2212?/,''),L-6,yz);c.fillText(P.fmt(hi),L-6,Y(hi));
    c.beginPath();d.forEach((p,n)=>{const x=X(p[0]),y=Y(P.get(p));if(n)c.lineTo(x,y);else c.moveTo(x,y);});
    c.lineJoin='round';c.lineCap='round';c.strokeStyle=P.col;c.lineWidth=2;c.stroke();
    const last=d[d.length-1],ex=X(last[0]),ey=Y(P.get(last));
    c.fillStyle=surf;c.beginPath();c.arc(ex,ey,5,0,6.283);c.fill();c.fillStyle=P.col;c.beginPath();c.arc(ex,ey,4,0,6.283);c.fill();
    c.fillStyle=ink;c.textAlign='left';c.textBaseline='middle';c.fillText(P.fmt(P.get(last)),ex+9,ey);
    P.Y=Y;
  }
  c.fillStyle=muted;c.textAlign='center';c.textBaseline='top';
  const step=Math.max(10,Math.pow(10,Math.floor(Math.log10(Math.max(10,y1-y0))))/(y1-y0>300?1:2));
  for(let yr=Math.ceil(y0/step)*step;yr<=y1;yr+=step)c.fillText('Year '+yr,X(yr),h-B+4);
  const tip=$('cTip');
  if(climHover>=L&&climHover<=L+pw){
    const yr=Math.round(y0+(climHover-L)/pw*(y1-y0));let p=d[0];for(const q of d){if(q[0]<=yr)p=q;else break;}
    const x=Math.round(X(p[0]))+.5;c.strokeStyle=ink;c.globalAlpha=.5;c.lineWidth=1;c.beginPath();c.moveTo(x,T);c.lineTo(x,h-B);c.stroke();c.globalAlpha=1;
    for(const P of panels){const y=P.Y(P.get(p));c.fillStyle=surf;c.beginPath();c.arc(x,y,5,0,6.283);c.fill();c.fillStyle=P.col;c.beginPath();c.arc(x,y,4,0,6.283);c.fill();}
    tip.innerHTML='<b>Year '+p[0]+'</b><br>'+panels.map(P=>P.name+': '+P.fmt(P.get(p))).join('<br>');
    tip.hidden=false;tip.style.left=Math.max(0,Math.min(w-170,climHover+10))+'px';tip.style.top='8px';
  }else if(tip)tip.hidden=true;
}
function histPanels(){
  let tot=0,realms=0,wars2=0,best=-1;
  for(const k of kingdoms)if(k.alive){realms++;tot+=kCitizens(k);if(k.wars.size)wars2++;if(k.age>best)best=k.age;}
  const wn=Object.keys(wonderOf).filter(id=>wonderOf[id].prog>=1).length;
  $('hTiles').innerHTML='<div><dt>People in the world</dt><dd>'+fmtPop(tot)+'</dd></div><div><dt>Realms standing</dt><dd>'+realms+'</dd></div>'+
    '<div><dt>Most advanced</dt><dd style="font-size:17px">'+(best<0?'None yet':AGE_NAME[best])+'</dd></div><div><dt>Wonders standing</dt><dd>'+wn+' of '+WONDERS.length+'</dd></div>'+
    '<div><dt>World temperature</dt><dd>'+degTxt(Math.round(degWarm()*10)/10)+'</dd></div><div><dt>Sea level</dt><dd>'+(SL>100?'+':SL<100?'\u2212':'')+fmtM(Math.abs(SL-100)*60)+'</dd></div>';
  const ks=histSeries();
  $('hLegend').innerHTML=ks.map(k=>'<span><i style="background:'+k.color+'"></i>'+esc(k.name)+(k.alive?'':' (fallen)')+'</span>').join('');
  const ink=getComputedStyle(document.body).getPropertyValue('--ink').trim()||'#12263f',muted=getComputedStyle(document.body).getPropertyValue('--muted').trim()||'#4d6577';
  const lead=kingdoms.filter(k=>k.alive).sort((a,b)=>kCitizens(b)-kCitizens(a)).slice(0,8);
  $('hLead').innerHTML=lead.map(k=>'<tr><td><span style="display:inline-block;width:10px;height:10px;background:'+k.color+';border:1px solid '+ink+';margin-right:5px"></span>'+esc(k.name)+'</td><td>'+AGES[k.age]+'</td><td class="n">'+fmtPop(kCitizens(k))+'</td><td class="n">'+k.villages.length+'</td></tr>').join('');
  $('hWonders').innerHTML=WONDERS.map(wd=>{
    const b=wonderOf[wd.id];
    if(!b)return'<p class="note">'+cap1(wd.n)+': <span style="color:'+muted+'">not yet raised ('+AGE_NAME[wd.age]+')</span></p>';
    return'<button class="town" data-v="'+b.v.id+'"><b>'+cap1(wd.n)+'</b><small>'+(b.prog<1?'Rising in ':'')+esc(b.v.name)+', '+esc(b.v.k.name)+'</small></button>';
  }).join('');
}
function drawHistChart(cvh){
  const ks=histSeries();
  const css=getComputedStyle(document.body),ink=css.getPropertyValue('--ink').trim()||'#12263f',muted=css.getPropertyValue('--muted').trim()||'#4d6577',surf=css.getPropertyValue('--panel').trim()||'#d7ebe4';
  const r=window.devicePixelRatio||1,w=cvh.clientWidth||400,h=cvh.clientHeight||230;
  if(cvh.width!==Math.round(w*r)||cvh.height!==Math.round(h*r)){cvh.width=Math.round(w*r);cvh.height=Math.round(h*r);}
  const c=cvh.getContext('2d');c.setTransform(r,0,0,r,0,0);c.clearRect(0,0,w,h);
  c.font='12px '+FONT;
  const y1=yearNow(),y0=Math.max(1,ks.reduce((m,k)=>Math.min(m,k.hist[0][0]),y1));
  if(!ks.length||y1-y0<2){c.fillStyle=muted;c.fillText('History is still being written. Come back in a few years.',8,h/2);return;}
  let vmax=10;for(const k of ks)for(const p of k.hist)if(p[1]>vmax)vmax=p[1];
  const lmax=Math.ceil(Math.log10(vmax)),lmin=1,L=40,R=78,T=8,B=22,pw=w-L-R,ph=h-T-B;
  const X=yr=>L+(yr-y0)/(y1-y0)*pw,Y=v=>T+ph-(Math.log10(Math.max(10,v))-lmin)/(lmax-lmin)*ph;
  c.strokeStyle=muted;c.globalAlpha=.25;c.lineWidth=1;
  for(let e=lmin;e<=lmax;e++){const y=Math.round(Y(Math.pow(10,e)))+.5;c.beginPath();c.moveTo(L,y);c.lineTo(L+pw,y);c.stroke();}
  c.globalAlpha=1;c.fillStyle=muted;c.textAlign='right';c.textBaseline='middle';
  for(let e=lmin;e<=lmax;e++)c.fillText(fmtPop(Math.pow(10,e)),L-6,Y(Math.pow(10,e)));
  c.textAlign='center';c.textBaseline='top';
  const step=Math.max(10,Math.pow(10,Math.floor(Math.log10(y1-y0)))/(y1-y0>300?1:2));
  for(let yr=Math.ceil(y0/step)*step;yr<=y1;yr+=step)c.fillText('Year '+yr,X(yr),h-B+6);
  /* lines: a dark casing under every realm colour keeps white and black banners visible */
  const ends=[];
  for(const k of ks){
    c.beginPath();let started=false;
    for(const p of k.hist){if(p[1]<=0){started=false;continue;}const x=X(p[0]),y=Y(p[1]);if(!started){c.moveTo(x,y);started=true;}else c.lineTo(x,y);}
    c.lineJoin='round';c.lineCap='round';
    c.strokeStyle=surf;c.lineWidth=5;c.stroke();
    c.strokeStyle=ink;c.globalAlpha=.55;c.lineWidth=3.5;c.stroke();c.globalAlpha=1;
    c.strokeStyle=k.color;c.lineWidth=2;c.stroke();
    let last=null;for(let n=k.hist.length-1;n>=0;n--)if(k.hist[n][1]>0){last=k.hist[n];break;}
    if(last)ends.push({k,x:X(last[0]),y:Y(last[1])});
  }
  /* end labels, nudged apart only as far as needed and joined back with a leader */
  ends.sort((a,b)=>a.y-b.y);let prev=-99;
  c.textAlign='left';c.textBaseline='middle';
  for(const e of ends){
    const ly=Math.max(e.y,prev+13);prev=ly;
    c.fillStyle=surf;c.strokeStyle=ink;c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,4,0,6.283);c.fill();c.stroke();
    c.fillStyle=e.k.color;c.beginPath();c.arc(e.x,e.y,3,0,6.283);c.fill();
    const tx=Math.min(e.x+8,L+pw+6);
    if(Math.abs(ly-e.y)>2){c.strokeStyle=muted;c.lineWidth=1;c.beginPath();c.moveTo(e.x+4,e.y);c.lineTo(tx-2,ly);c.stroke();}
    c.fillStyle=ink;c.fillText(e.k.name.length>11?e.k.name.slice(0,10)+'…':e.k.name,tx,ly);
  }
  /* hover crosshair */
  if(histHover>=0){
    const yr=Math.round(y0+(histHover-L)/pw*(y1-y0));
    if(yr>=y0&&yr<=y1){
      const x=Math.round(X(yr))+.5;c.strokeStyle=ink;c.globalAlpha=.5;c.lineWidth=1;c.beginPath();c.moveTo(x,T);c.lineTo(x,T+ph);c.stroke();c.globalAlpha=1;
      const rows=[];
      for(const k of ks){let v=0;for(const p of k.hist)if(p[0]<=yr)v=p[1];else break;if(v>0)rows.push([k,v]);}
      rows.sort((a,b)=>b[1]-a[1]);
      const tip=$('hTip');
      tip.innerHTML='<b>Year '+yr+'</b><br>'+(rows.length?rows.map(q=>'<i style="background:'+q[0].color+'"></i>'+esc(q[0].name)+': '+fmtPop(q[1])).join('<br>'):'No great realms yet');
      tip.hidden=false;tip.style.left=Math.max(0,Math.min(w-150,histHover+10))+'px';tip.style.top='8px';
    }
  }else{const tip=$('hTip');if(tip)tip.hidden=true;}
}
document.addEventListener('pointermove',e=>{
  const cc=$('cChart');if(cc&&e.target===cc){const r=cc.getBoundingClientRect();climHover=e.clientX-r.left;drawClimChart(cc);return;}
  const cvh=$('hChart');if(!cvh||e.target!==cvh)return;
  const r=cvh.getBoundingClientRect();histHover=e.clientX-r.left;drawHistory(true);
});
document.addEventListener('pointerleave',e=>{if(e.target&&e.target.id==='hChart'){histHover=-1;drawHistory(true);}if(e.target&&e.target.id==='cChart'){climHover=-1;drawClimChart(e.target);}},true);
