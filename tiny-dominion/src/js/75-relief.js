/* ================= 3D relief view: the world as a tabletop model =================
   The 2D scene (terrain, trees, towns) is baked into one large texture, then draped over a
   height mesh built from the elevation field. A glossy sea plane, layered earth sides, sun
   lighting and haze finish the diorama. The simulation keeps running; the bake refreshes. */
const SH_REL_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aP;
uniform mat4 uMVP;uniform highp sampler2D uSm;uniform vec2 uWorld;uniform float uHS,uSL,uBase;
out vec2 vUV;out vec3 vN;out float vH;out vec3 vW;
float hAt(vec2 p){float e=texture(uSm,clamp(p,vec2(.5),uWorld-.5)/uWorld).g*255.;float d=e-uSL;return d>=0.?d*uHS:d*uHS*.55;}
void main(){
  vec2 p=aP.xy;float h=hAt(p);
  float hx=hAt(p+vec2(1.,0.))-hAt(p-vec2(1.,0.)),hz=hAt(p+vec2(0.,1.))-hAt(p-vec2(0.,1.));
  vN=normalize(vec3(-hx,2.,-hz));
  if(aP.z>.5){h=uBase;vN=vec3(0.,0.,0.);}
  vW=vec3(p.x,h,p.y);vH=h;vUV=vec2(p.x/uWorld.x,1.-p.y/uWorld.y);
  gl_Position=uMVP*vec4(vW,1.);
}`;
const SH_REL_FS=`#version 300 es
precision highp float;
uniform highp sampler2D uBake;uniform vec3 uSun,uAmb,uSunC,uFog,uEye;uniform float uFogN,uFogF,uSkirt,uHS;
in vec2 vUV;in vec3 vN;in float vH;in vec3 vW;out vec4 o;
void main(){
  vec3 c;
  if(uSkirt>.5){
    /* layered earth on the sides of the model */
    float d=-vH/max(uHS,.01);
    float band=floor(d/7.);
    vec3 a=vec3(.42,.3,.2),b=vec3(.55,.42,.3),r=vec3(.5,.47,.44);
    c=mod(band,3.)<1.?a:mod(band,3.)<2.?b:r;
    if(d<2.)c=vec3(.28,.4,.2);
    c*=.62+.18*smoothstep(0.,40.,-d+40.);
    vec3 sn=abs(dFdx(vW).x)>abs(dFdx(vW).z)?vec3(0.,0.,1.):vec3(1.,0.,0.);
    c*=uAmb+uSunC*.5*abs(dot(sn,uSun));
  }else{
    c=texture(uBake,vUV).rgb;
    float l=max(0.,dot(normalize(vN),uSun));
    c*=uAmb+uSunC*l;
  }
  float f=smoothstep(uFogN,uFogF,length(vW-uEye));
  o=vec4(mix(c,uFog,f*.75),1.);
}`;
const SH_WATER_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aP;
uniform mat4 uMVP;uniform vec2 uWorld;
out vec3 vW;
void main(){vW=vec3(aP.x*uWorld.x,0.,aP.y*uWorld.y);gl_Position=uMVP*vec4(vW,1.);}`;
const SH_WATER_FS=`#version 300 es
precision highp float;
uniform highp sampler2D uNz;uniform vec3 uSun,uEye,uFog,uAmb;uniform float uTime,uFogN,uFogF;
in vec3 vW;out vec4 o;
float nz(vec2 p){return texture(uNz,p*.00390625).r;}
void main(){
  vec2 p=vW.xz;
  float a=nz(p*1.3+vec2(uTime*.6,uTime*.4)),b=nz(p*2.1-vec2(uTime*.5,-uTime*.3));
  vec3 n=normalize(vec3((a-.5)*.35,1.,(b-.5)*.35));
  vec3 v=normalize(uEye-vW),h=normalize(v+uSun);
  float spec=pow(max(0.,dot(n,h)),90.)*1.6;
  float fres=.25+.65*pow(1.-max(0.,dot(n,v)),3.);
  vec3 c=mix(vec3(.08,.3,.48),vec3(.55,.75,.9),fres)*(uAmb+.35);
  float f=smoothstep(uFogN,uFogF,length(vW-uEye));
  o=vec4(mix(c+spec*vec3(1.,.95,.85),uFog,f*.75),mix(.42,.82,fres));
}`;
/* upright sprites standing on the model, turned to face the camera */
const SH_BB_VS=`#version 300 es
precision highp float;precision highp int;
layout(location=0) in vec2 aC;layout(location=1) in vec4 iA;layout(location=2) in vec4 iB;layout(location=3) in vec4 iT;layout(location=4) in vec4 iF;
uniform highp sampler2D uFr,uSm;uniform mat4 uMVP;uniform vec3 uRight;uniform vec2 uWorld,uAt;uniform float uHS,uSL;
out vec2 vUV;out vec4 vT,vF;out float vA;flat out int vFl;out vec2 vW;
float hAt(vec2 p){float e=texture(uSm,clamp(p,vec2(.5),uWorld-.5)/uWorld).g*255.;float d=e-uSL;return d>=0.?d*uHS:0.;}
void main(){
  int fi=int(iA.z+.5);
  vec4 r=texelFetch(uFr,ivec2(fi,0),0),an=texelFetch(uFr,ivec2(fi,1),0);
  float s=iB.w;int fl=int(iB.y+.5);
  vec2 c=aC;c.y=mix(1.-iB.z,1.,aC.y);
  bool fx=(fl&1)!=0;
  float ax=fx?r.z-an.x:an.x;
  vec2 foot=iA.xy;float h=hAt(foot);
  float ox=(c.x*r.z-ax)/16.*s,oy=(an.y-c.y*r.w)/16.*s;
  vec3 p=vec3(foot.x,h,foot.y)+uRight*ox+vec3(0.,oy*1.1,0.);
  gl_Position=uMVP*vec4(p,1.);
  vUV=(r.xy+vec2(fx?1.-c.x:c.x,c.y)*r.zw)/uAt;
  vT=iT;vF=iF;vA=iB.x;vFl=fl&~12;vW=foot;
}`;
const SH_SKY_FS=`#version 300 es
precision highp float;
uniform vec3 uTop,uHor;uniform vec2 uRes;out vec4 o;
void main(){float t=gl_FragCoord.y/uRes.y;o=vec4(mix(uHor,uTop,smoothstep(.2,1.,t)),1.);}`;

let view3d=false;
const V3={yaw:.35,pitch:.75,dist:180,tx:0,tz:0,relief:2,bakeT:0,bakeDirty:true,mvp:null,eye:[0,0,0]};
/* small matrix helpers (column-major, like WebGL expects) */
function m4mul(a,b){const r=new Float32Array(16);for(let c=0;c<4;c++)for(let rr=0;rr<4;rr++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+rr]*b[c*4+k];r[c*4+rr]=s;}return r;}
function m4persp(fov,asp,n,f){const t=1/Math.tan(fov/2),r=new Float32Array(16);r[0]=t/asp;r[5]=t;r[10]=(f+n)/(n-f);r[11]=-1;r[14]=2*f*n/(n-f);return r;}
function m4look(e,c,u){
  let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2];let l=Math.hypot(zx,zy,zz);zx/=l;zy/=l;zz/=l;
  let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;l=Math.hypot(xx,xy,xz);xx/=l;xy/=l;xz/=l;
  const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
  return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1]);
}
function hsc(){return .075*V3.relief;}
function heightAt(x,y){const i=Math.max(0,Math.min(H-1,y|0))*W+Math.max(0,Math.min(W-1,x|0)),d=elev[i]-SL;return d>=0?d*hsc():d*hsc()*.55;}
function setView3d(on){
  if(on&&!G){toast('The 3D view needs the HD graphics setting.');return;}
  view3d=on;document.body.classList.toggle('v3d',on);
  if(on){
    V3.tx=cam.x+vw/cam.z/2;V3.tz=cam.y+vh/cam.z/2;
    V3.dist=Math.max(30,Math.min(Math.max(W,H)*1.4,vw/cam.z*1.1));V3.bakeDirty=true;
    closeSheet();hideInfo();if(watching)setWatch(false);
    toast('Drag to turn the world. Scroll or pinch to zoom. Right-drag or use two fingers to move.');
  }else{
    cam.z=clampZ(vw/Math.max(20,V3.dist*.9));centerOn(V3.tx,V3.tz);
  }
  buildTools(false);
}
/* geometry for the model: a height grid, plus the four earth walls */
function rel3dMesh(R){
  const gl=R.gl;
  if(R.relMesh&&R.relMesh.W===W&&R.relMesh.H===H)return R.relMesh;
  const s=W*H>120000?2:1,gw=Math.floor(W/s)+1,gh=Math.floor(H/s)+1;
  const verts=[],idx=[];
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++)verts.push(Math.min(W,x*s),Math.min(H,y*s),0);
  for(let y=0;y<gh-1;y++)for(let x=0;x<gw-1;x++){const a=y*gw+x,b=a+1,c=a+gw,d=c+1;idx.push(a,c,b,b,c,d);}
  const nGrid=idx.length;
  /* the walls: each edge gets a top row at the terrain and a bottom row at the base */
  const edge=pts=>{
    const base=verts.length/3;
    for(const[x,y]of pts){verts.push(x,y,0);verts.push(x,y,1);}
    for(let n=0;n<pts.length-1;n++){const a=base+n*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,c,c,b,d);}
  };
  const top=[],bot=[],lef=[],rig=[];
  for(let x=0;x<gw;x++){top.push([Math.min(W,x*s),0]);bot.push([Math.min(W,x*s),H]);}
  for(let y=0;y<gh;y++){lef.push([0,Math.min(H,y*s)]);rig.push([W,Math.min(H,y*s)]);}
  edge(top);edge(bot);edge(lef);edge(rig);
  const vao=gl.createVertexArray(),vb=gl.createBuffer(),ib=gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(idx),gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  const wvao=gl.createVertexArray(),wb=gl.createBuffer();
  gl.bindVertexArray(wvao);gl.bindBuffer(gl.ARRAY_BUFFER,wb);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,0,1,0,0,0,1,0,1,1,0]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);gl.bindVertexArray(null);
  if(R.relMesh){gl.deleteVertexArray(R.relMesh.vao);gl.deleteVertexArray(R.relMesh.wvao);}
  R.relMesh={W,H,vao,nGrid,nAll:idx.length,wvao};
  return R.relMesh;
}
/* paint the whole world, flat, into one texture */
function rel3dBake(R){
  const gl=R.gl,small=Math.min(screen.width||1e4,screen.height||1e4)<820;
  const P=Math.max(2,Math.min(8,Math.floor((small?2048:4096)/Math.max(W,H)))),bw=W*P,bh=H*P;
  if(!R.bake||R.bake.w!==bw||R.bake.h!==bh){
    if(R.bake){gl.deleteTexture(R.bake.tex);gl.deleteFramebuffer(R.bake.fbo);gl.deleteRenderbuffer(R.bake.rb);}
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,bw,bh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const an=gl.getExtension('EXT_texture_filter_anisotropic');if(an)gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    const rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,bw,bh);
    const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    R.bake={tex,fbo,rb,w:bw,h:bh,P};
  }
  const B=R.bake;
  /* every tree and building in the world, at a model-friendly zoom */
  for(const k in SPR)SPR[k].n=0;
  const keepZ=cam.z;cam.z=8;
  /* towns and trees stand up as sprites near the camera; the bake keeps only the ground */
  cam.z=keepZ;
  gl.bindFramebuffer(gl.FRAMEBUFFER,B.fbo);gl.viewport(0,0,bw,bh);
  gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
  const pT=R.pT,uT=pT.u;gl.useProgram(pT.p);
  const bindT=(unit,t,loc)=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);if(loc)gl.uniform1i(loc,unit);};
  bindT(0,R.tTerr,uT.uTerr);bindT(1,R.tSm,uT.uSm);bindT(2,R.tOwn,uT.uOwn);bindT(3,R.tKPal,uT.uKPal);bindT(4,R.tBio,uT.uBio);bindT(5,R.tNz,uT.uNz);
  gl.uniform2f(uT.uRes,bw,bh);gl.uniform2f(uT.uCam,0,0);gl.uniform2f(uT.uWorld,W,H);gl.uniform2f(uT.uSun,0,0);gl.uniform2f(uT.uWind,0,0);
  gl.uniform1f(uT.uZoom,P);gl.uniform1f(uT.uTime,0);gl.uniform1f(uT.uSeas,seasonP);gl.uniform1f(uT.uSAmp,seasonAmp);
  gl.uniform1f(uT.uBord,S.borders?1:0);gl.uniform1f(uT.uCloud,0);gl.uniform1f(uT.uDay,1);gl.uniform1f(uT.uDet,1);gl.uniform1f(uT.uSL,SL);
  gl.uniform1f(uT.uTreeA,topoMap?1:0);gl.uniform1f(uT.uTopo,topoMap?2:S.contours?1:0);gl.uniform1i(uT.uNSt,0);
  gl.bindVertexArray(R.vaoFull);gl.drawArrays(gl.TRIANGLES,0,3);
  if(SPR.mn.n){
    const pS=R.pS,uS=pS.u;gl.useProgram(pS.p);
    bindT(6,R.tAtl,uS.uAtl);bindT(7,R.tFr,uS.uFr);bindT(5,R.tNz,uS.uNz);
    gl.uniform2f(uS.uRes,bw,bh);gl.uniform2f(uS.uCam,0,0);gl.uniform2f(uS.uAt,R.atlas.w,R.atlas.h);gl.uniform1f(uS.uZoom,P);
    gl.uniform1f(uS.uNight,0);gl.uniform1f(uS.uDay,1);gl.uniform1f(uS.uCloud,0);gl.uniform1i(uS.uNSt,0);gl.uniform1i(uS.uMode,0);
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    for(const[L,V]of[[SPR.sh,R.vShadow],[SPR.mn,R.vMain]]){
      if(!L.n)continue;
      if(L===SPR.mn){gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);}
      gl.bindBuffer(gl.ARRAY_BUFFER,V.buf);gl.bufferData(gl.ARRAY_BUFFER,L.f.subarray(0,L.n*10),gl.STREAM_DRAW);
      gl.bindVertexArray(V.vao);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,L.n);
    }
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.bindTexture(gl.TEXTURE_2D,B.tex);gl.generateMipmap(gl.TEXTURE_2D);
  for(const k in SPR)SPR[k].n=0;
  V3.bakeT=now();V3.bakeDirty=false;
}
function rel3dFrame(R){
  const gl=R.gl;
  if(!R.pR){
    try{
      const mk=(vs,fs)=>{const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;};
        const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
        if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
        const u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i);u[a.name]=gl.getUniformLocation(p,a.name);}return{p,u};};
      R.pR=mk(SH_REL_VS,SH_REL_FS);R.pW=mk(SH_WATER_VS,SH_WATER_FS);R.pK=mk(SH_FULL_VS,SH_SKY_FS);R.pB=mk(SH_BB_VS,SH_SPRITE_FS);
    }catch(e){console.warn(e);toast('The 3D view could not start on this device.');view3d=false;document.body.classList.remove('v3d');return;}
  }
  const mesh=rel3dMesh(R);
  if(V3.bakeDirty||now()-V3.bakeT>(speed>0?2500:6000))rel3dBake(R);
  const cw=cv.width,ch=cv.height,tsec=now()/1000;
  /* camera orbiting a point on the model */
  const ty=heightAt(V3.tx,V3.tz),cp=Math.cos(V3.pitch),sp=Math.sin(V3.pitch);
  const eye=[V3.tx+V3.dist*cp*Math.sin(V3.yaw),ty+V3.dist*sp,V3.tz+V3.dist*cp*Math.cos(V3.yaw)];
  const proj=m4persp(.72,cw/ch,Math.max(.5,V3.dist*.02),V3.dist*4+Math.max(W,H)*2.5);
  const mvp=m4mul(proj,m4look(eye,[V3.tx,ty,V3.tz],[0,1,0]));
  V3.mvp=mvp;V3.eye=eye;
  const nf=topoMap?0:nightF,dl=1-nf;
  const sun=[-.45*sunX+.15,.75,-.45*sunY-.25],sl=Math.hypot(sun[0],sun[1],sun[2]);sun[0]/=sl;sun[1]/=sl;sun[2]/=sl;
  const amb=[.42*dl+.14,.44*dl+.16,.48*dl+.26],sunC=[.75*dl,.72*dl,.64*dl];
  const fog=[.72*dl+.08,.82*dl+.1,.92*dl+.2],fogN=V3.dist*1.1,fogF=V3.dist*3.5+Math.max(W,H);
  gl.viewport(0,0,cw,ch);
  gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
  const pK=R.pK;gl.useProgram(pK.p);
  gl.uniform3f(pK.u.uTop,.25*dl+.03,.45*dl+.05,.78*dl+.12);gl.uniform3f(pK.u.uHor,fog[0],fog[1],fog[2]);gl.uniform2f(pK.u.uRes,cw,ch);
  gl.bindVertexArray(R.vaoFull);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
  gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);gl.disable(gl.CULL_FACE);
  const pR=R.pR,u=pR.u;gl.useProgram(pR.p);
  gl.activeTexture(gl.TEXTURE0+1);gl.bindTexture(gl.TEXTURE_2D,R.tSm);gl.uniform1i(u.uSm,1);
  gl.activeTexture(gl.TEXTURE0+9);gl.bindTexture(gl.TEXTURE_2D,R.bake.tex);gl.uniform1i(u.uBake,9);
  gl.uniformMatrix4fv(u.uMVP,false,mvp);gl.uniform2f(u.uWorld,W,H);gl.uniform1f(u.uHS,hsc());gl.uniform1f(u.uSL,SL);
  let lo=255;for(let i=0;i<N;i+=7)if(elev[i]<lo)lo=elev[i];
  gl.uniform1f(u.uBase,Math.min(-2,(lo-SL)*hsc()*.55-3));
  gl.uniform3f(u.uSun,sun[0],sun[1],sun[2]);gl.uniform3f(u.uAmb,amb[0],amb[1],amb[2]);gl.uniform3f(u.uSunC,sunC[0],sunC[1],sunC[2]);
  gl.uniform3f(u.uFog,fog[0],fog[1],fog[2]);gl.uniform3f(u.uEye,eye[0],eye[1],eye[2]);gl.uniform1f(u.uFogN,fogN);gl.uniform1f(u.uFogF,fogF);
  gl.bindVertexArray(mesh.vao);
  gl.uniform1f(u.uSkirt,0);gl.drawElements(gl.TRIANGLES,mesh.nGrid,gl.UNSIGNED_INT,0);
  gl.uniform1f(u.uSkirt,1);gl.drawElements(gl.TRIANGLES,mesh.nAll-mesh.nGrid,gl.UNSIGNED_INT,mesh.nGrid*4);
  /* buildings, trees, people and boats near the camera */
  if(!topoMap)rel3dSprites(R,mvp,eye,sun,amb,sunC,nf,tsec);
  /* the sea surface */
  const pW=R.pW,uw=pW.u;gl.useProgram(pW.p);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  gl.activeTexture(gl.TEXTURE0+5);gl.bindTexture(gl.TEXTURE_2D,R.tNz);gl.uniform1i(uw.uNz,5);
  gl.uniformMatrix4fv(uw.uMVP,false,mvp);gl.uniform2f(uw.uWorld,W,H);gl.uniform3f(uw.uSun,sun[0],sun[1],sun[2]);
  gl.uniform3f(uw.uEye,eye[0],eye[1],eye[2]);gl.uniform3f(uw.uFog,fog[0],fog[1],fog[2]);gl.uniform3f(uw.uAmb,amb[0],amb[1],amb[2]);
  gl.uniform1f(uw.uTime,tsec%1000);gl.uniform1f(uw.uFogN,fogN);gl.uniform1f(uw.uFogF,fogF);
  gl.bindVertexArray(mesh.wvao);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.bindVertexArray(null);
  rel3dOverlay();
}
function rel3dSprites(R,mvp,eye,sun,amb,sunC,nf,tsec){
  const gl=R.gl;
  for(const k in SPR)SPR[k].n=0;
  const rn=Math.min(70,V3.dist*.75),rb=Math.min(190,V3.dist*1.7),cx=V3.tx,cz=V3.tz;
  if(V3.dist<260)sceneNature(Math.floor(cx-rn),Math.floor(cz-rn),Math.ceil(cx+rn),Math.ceil(cz+rn),8,nf>.02);
  sceneBuildings(Math.floor(cx-rb),Math.floor(cz-rb),Math.ceil(cx+rb),Math.ceil(cz+rb),8,nf>.02,tsec);
  if(V3.dist<200){sceneUnits(Math.floor(cx-rn),Math.floor(cz-rn),Math.ceil(cx+rn),Math.ceil(cz+rn),8,.5,tsec,false);sceneEffects(cx-rn,cz-rn,cx+rn,cz+rn,false);}
  const pB=R.pB,u=pB.u;gl.useProgram(pB.p);
  gl.activeTexture(gl.TEXTURE0+6);gl.bindTexture(gl.TEXTURE_2D,R.tAtl);gl.uniform1i(u.uAtl,6);
  gl.activeTexture(gl.TEXTURE0+7);gl.bindTexture(gl.TEXTURE_2D,R.tFr);gl.uniform1i(u.uFr,7);
  gl.activeTexture(gl.TEXTURE0+1);gl.bindTexture(gl.TEXTURE_2D,R.tSm);gl.uniform1i(u.uSm,1);
  gl.activeTexture(gl.TEXTURE0+5);gl.bindTexture(gl.TEXTURE_2D,R.tNz);gl.uniform1i(u.uNz,5);
  gl.uniformMatrix4fv(u.uMVP,false,mvp);gl.uniform3f(u.uRight,Math.cos(V3.yaw),0,-Math.sin(V3.yaw));
  gl.uniform2f(u.uWorld,W,H);gl.uniform2f(u.uAt,R.atlas.w,R.atlas.h);gl.uniform1f(u.uHS,hsc());gl.uniform1f(u.uSL,SL);
  gl.uniform1f(u.uCloud,0);gl.uniform1i(u.uNSt,0);gl.uniform1f(u.uDay,1);
  const lit=[amb[0]+sunC[0]*.75,amb[1]+sunC[1]*.75,amb[2]+sunC[2]*.75];gl.uniform3f(u.uLit,lit[0],lit[1],lit[2]);
  const draw=(L,V,mode)=>{
    if(!L.n)return;gl.uniform1i(u.uMode,mode);
    gl.bindBuffer(gl.ARRAY_BUFFER,V.buf);gl.bufferData(gl.ARRAY_BUFFER,L.f.subarray(0,L.n*10),gl.STREAM_DRAW);
    gl.bindVertexArray(V.vao);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,L.n);
  };
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
  gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  draw(SPR.mn,R.vMain,0);
  if(nf>.02){gl.depthMask(false);gl.blendFunc(gl.ONE,gl.ONE);gl.uniform1f(u.uNight,Math.min(1,nf*1.3));draw(SPR.mn,R.vMain,1);}
  gl.depthMask(false);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  draw(SPR.po,R.vPost,2);
  gl.depthMask(true);
  for(const k in SPR)SPR[k].n=0;
}
/* realm names float above their capitals */
function rel3dOverlay(){
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ovc.width,ovc.height);
  if(!S.labels||!V3.mvp)return;
  const m=V3.mvp,w=ovc.width,h=ovc.height;
  ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineJoin='round';
  for(const k of kingdoms){
    if(!k.alive||!k.villages.length)continue;
    const v=k.villages[0],x=v.x+.5,z=v.y+.5,y=heightAt(v.x,v.y)+2.5;
    const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cw2=m[3]*x+m[7]*y+m[11]*z+m[15];
    if(cw2<=.1)continue;
    const sx=(cx/cw2*.5+.5)*w,sy=(1-(cy/cw2*.5+.5))*h;
    if(sx<-50||sx>w+50||sy<-20||sy>h+20)continue;
    const fs=Math.max(9,Math.min(14,1400/cw2));
    label(k.name,sx,sy,fs,true,k.wars.size?'#ffd9d0':'#fff');
  }
}
/* orbit, zoom and pan with pointer or wheel */
function rel3dDrag(dx,dy,pan){
  if(pan){
    const s=V3.dist*.0016,c=Math.cos(V3.yaw),sn=Math.sin(V3.yaw);
    V3.tx-=(dx*c+dy*sn)*s;V3.tz-=(-dx*sn+dy*c)*s;
    V3.tx=Math.max(0,Math.min(W,V3.tx));V3.tz=Math.max(0,Math.min(H,V3.tz));
  }else{V3.yaw-=dx*.006;V3.pitch=Math.max(.14,Math.min(1.45,V3.pitch+dy*.005));}
}
function rel3dZoom(f){V3.dist=Math.max(12,Math.min(Math.max(W,H)*1.6,V3.dist*f));}
