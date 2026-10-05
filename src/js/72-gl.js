/* ================= GPU renderer (WebGL2) =================
   Terrain is drawn by one fragment shader from three data textures (tile type and flags, a smooth
   land/elevation field, and realm ownership), at 16 art pixels per tile. Trees, peaks, buildings,
   people and effects are instanced sprites from a procedurally drawn atlas, depth-sorted on the GPU.
   At night a low-resolution light map is multiplied over the scene and windows light up. */
const AP=16;
const SH_FULL_VS=`#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;

const SH_COMMON=`
const float AP=16.;
const float BY[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
float bay(ivec2 p){return (BY[(p.y&3)*4+(p.x&3)]+.5)/16.;}
float nz(vec2 p){return texture(uNz,p*.00390625).r;}
float hs(ivec2 p){return texelFetch(uNz,p&255,0).g;}
float hs2(ivec2 p){return texelFetch(uNz,(p+ivec2(97,41))&255,0).b;}
float fbm(vec2 p){return nz(p)*.5+nz(p*2.03+vec2(17.3,9.1))*.25+nz(p*4.07+vec2(3.7,41.2))*.125+nz(p*8.13+vec2(29.1,5.7))*.0625;}
float stormAt(vec2 w){float a=0.;for(int i=0;i<6;i++){if(i>=uNSt)break;vec4 s=uSt[i];float d=length(w-s.xy)/s.z;a=max(a,(1.-smoothstep(.55,1.05,d+(nz(w*.5+s.xy)-.5)*.3))*s.w);}return a;}
`;

const SH_TERRAIN_FS=`#version 300 es
precision highp float;precision highp int;
uniform highp sampler2D uTerr,uSm,uOwn,uKPal,uBio,uNz;
uniform vec2 uRes,uCam,uWorld,uSun,uWind;
uniform float uZoom,uTime,uSeas,uSAmp,uBord,uCloud,uDay,uDet,uSL,uTreeA;
uniform vec4 uSt[6];uniform int uNSt;
out vec4 o;
${SH_COMMON}
ivec2 ct(ivec2 t){return clamp(t,ivec2(0),ivec2(uWorld)-1);}
vec4 TT(ivec2 t){return texelFetch(uTerr,ct(t),0);}
int B(float v){return int(v*255.+.5);}
vec4 SM(vec2 p){return texture(uSm,p/uWorld);}
int KID(ivec2 t){vec4 v=texelFetch(uOwn,ct(t),0);return B(v.r)+B(v.g)*256;}
vec3 KC(int id){return texelFetch(uKPal,ivec2(id&255,id>>8),0).rgb;}
int RK(ivec2 t){return B(TT(t).a)&3;}
vec3 BIO(int t){
  float s=fract(uSeas-.125)*4.;int a=int(s)&3,b=(a+1)&3;float f=fract(s);
  vec3 sc=mix(texelFetch(uBio,ivec2(t,a),0).rgb,texelFetch(uBio,ivec2(t,b),0).rgb,f);
  return mix(texelFetch(uBio,ivec2(t,1),0).rgb,sc,uSAmp);
}
float segD(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
/* distance from the road's centre line inside tile t, joining every road neighbour */
float roadD(ivec2 t,vec2 f,out int ax){
  bool E=RK(t+ivec2(1,0))>0,Wn=RK(t+ivec2(-1,0))>0,Nn=RK(t+ivec2(0,-1))>0,S=RK(t+ivec2(0,1))>0;
  vec2 c=vec2(.5);float d=max(abs(f.x-.5),abs(f.y-.5))*1.15;
  if(E)d=min(d,segD(f,c,vec2(1.3,.5)));
  if(Wn)d=min(d,segD(f,c,vec2(-.3,.5)));
  if(Nn)d=min(d,segD(f,c,vec2(.5,-.3)));
  if(S)d=min(d,segD(f,c,vec2(.5,1.3)));
  if(!E&&!Nn&&RK(t+ivec2(1,-1))>0)d=min(d,segD(f,c,vec2(1.2,-.2)));
  if(!Wn&&!Nn&&RK(t+ivec2(-1,-1))>0)d=min(d,segD(f,c,vec2(-.2,-.2)));
  if(!E&&!S&&RK(t+ivec2(1,1))>0)d=min(d,segD(f,c,vec2(1.2,1.2)));
  if(!Wn&&!S&&RK(t+ivec2(-1,1))>0)d=min(d,segD(f,c,vec2(-.2,1.2)));
  bool hz=(E||Wn)&&!(Nn||S),vt=(Nn||S)&&!(E||Wn);
  ax=hz?1:vt?2:0;
  return d;
}
void main(){
  vec2 fc=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec2 wp=uCam+fc/uZoom;
  float q=uZoom>=9.?AP:(uZoom>=4.5?8.:0.);
  vec2 ap=q>0.?(floor(wp*q)+.5)/q:wp;
  ivec2 ai=ivec2(floor(ap*AP));
  float det=smoothstep(2.,7.,uZoom)*uDet;
  float wint=clamp(cos((uSeas-.875)*6.2832)*1.5-.3,0.,1.)*uSAmp;
  bool outW=wp.x<0.||wp.y<0.||wp.x>=uWorld.x||wp.y>=uWorld.y;
  vec2 jit=(vec2(nz(ap*2.3+vec2(13.,7.)),nz(ap*2.3+vec2(71.,29.)))-.5)*.7;
  vec4 s=SM(clamp(ap+jit*.6,vec2(.5),uWorld-.5));
  if(outW)s.ra=vec2(0.);
  float land=s.r,elevS=s.g*255.,river=s.a;
  ivec2 t0=ivec2(floor(ap));
  vec4 T0=TT(t0);
  int ty0=B(T0.r),fl=B(T0.g),rb=B(T0.a);
  float cold=T0.b*1.5-.25;
  int otier=B(texelFetch(uOwn,ct(t0),0).b);
  float h=hs(ai),h2=hs2(ai);
  vec3 c;
  if(land<.5||outW){
    /* ---- water ---- */
    float depth=clamp((uSL-elevS)/72.,0.,1.);
    if(outW){vec2 dd=max(-wp,wp-uWorld);depth=min(1.,depth+max(dd.x,dd.y)*.04);}
    float dq=floor(depth*7.+bay(ai)*det)/7.;
    c=mix(vec3(.25,.63,.76),vec3(.07,.21,.42),pow(dq,.75));
    float shore=smoothstep(.2,.5,land);
    c=mix(c,vec3(.36,.75,.81),shore*.8*(1.-river));
    c=mix(c,vec3(.29,.6,.76),river*.85);
    float t=uTime;
    float w1=nz(vec2(ap.x*.8+t*.3,ap.y*3.4));
    float w2=nz(vec2(ap.x*.55-t*.2+50.,ap.y*2.7+30.));
    float cr=(w1+w2)*.5;
    c+=step(.73,cr)*(.06+.07*(1.-depth))*det;
    c-=step(cr,.27)*.035*det;
    float gl=hs(ai+ivec2(int(t*2.3)*31,int(t*1.7)*17));
    if(gl>.9965)c=mix(c,vec3(1.),.75*det*uDay);
    float fb=smoothstep(.28,.5,land)*(1.-river);
    float fn=nz(ap*3.1+vec2(t*.5,-t*.35))*.6+nz(ap*6.3-vec2(t*.4,t*.2))*.4;
    float foam=max(step(.465,land)*(1.-river),step(1.-fb*.7,fn));
    c=mix(c,vec3(.93,.97,1.),foam*.9*min(1.,det+.4));
    if(step(cold+(nz(ap*1.6)-.5)*.1,-.02+.24*wint)*step(depth,.8)>.5&&!outW){
      c=mix(vec3(.80,.89,.95),vec3(.92,.96,.99),hs(ai/3));if(h2>.95)c*=.9;
    }
    if((rb&3)>0&&ty0==16&&!outW){
      int ax;float d=roadD(t0,fract(ap),ax);
      if(d<.24){int rt=max(rb>>2,otier);c=rt>=2?vec3(.62,.6,.57):vec3(.55,.4,.26);if(fract(fract(ap).x*(ax==2?4.:1.)+fract(ap).y*(ax==2?0.:4.))<.2)c*=.82;if(d>.18)c*=.75;}
    }
  }else{
    /* ---- land ---- */
    ivec2 tj=ivec2(floor(ap+jit));
    int ty=B(TT(tj).r);
    if(ty<=1||ty==16)ty=ty0;
    if(ty<=1||ty==16)ty=2;
    c=BIO(ty);
    float lf=fbm(ap*.31);
    c*=mix(1.,.9+lf*.2,det);
    /* small pixel-art marks: one per 4x4 cell, at a random spot */
    ivec2 cel=ai>>2;float cr=hs(cel*3+ivec2(11,5));
    ivec2 tp=cel*4+ivec2(int(hs2(cel*7)*3.),1+int(hs(cel*5+ivec2(3,9))*3.));
    bool onT=ai==tp,onT2=ai==tp+ivec2(0,-1),onT3=ai==tp+ivec2(1,0);
    if(ty==3||ty==5||ty==11){
      if(cr<.42){if(onT||onT2)c*=.83;else if(onT3&&cr<.2)c*=.88;}
      else if(cr>.9&&onT)c*=1.1;
      if(ty==11&&h2>.75&&h2<.8)c=mix(c,vec3(.78,.7,.38),.5);
      if(ty==3&&h2>.993&&wint<.4)c=h>.5?vec3(.97,.93,.5):(h>.25?vec3(.98,.98,.98):vec3(.95,.55,.7));
      if(ty==5){float rk=nz(ap*1.7+9.);if(rk>.7)c=mix(c,vec3(.62,.6,.54)*(h>.5?1.:.9),.8);}
    }else if(ty==4||ty==12||ty==14){
      if(cr<.5&&(onT||onT3))c*=.82;else if(cr>.85&&onT)c*=1.12;
      if(nz(ap*2.9)>.68)c*=.88;
      if(uTreeA<.99){
        /* seen from afar a forest is a carpet of crowns */
        vec3 su=texelFetch(uBio,ivec2(ty,1),0).rgb,cd=texelFetch(uBio,ivec2(ty,4),0).rgb,cl=texelFetch(uBio,ivec2(ty,5),0).rgb;
        vec3 sea=BIO(ty)/max(su,vec3(.01));
        float cn=nz(ap*2.7+vec2(5.,3.)),cs=nz(ap*2.7+vec2(5.,3.)-uSun*.2);
        vec3 cc=mix(cd,cl,smoothstep(.42,.62,cn))*(cs>cn+.03?.82:1.)*sea;
        c=mix(cc,c,uTreeA);
      }
    }else if(ty==2){if(cr<.3&&onT)c*=.88;else if(cr>.92&&onT)c*=1.08;}
    else if(ty==10){
      float d=fract(ap.x*.25+ap.y*.6+fbm(ap*.2)*2.5);
      c*=d<.18?.92:(d<.3?1.05:1.);
      if(cr<.18&&onT)c*=.9;
    }else if(ty==6||ty==7){
      float st=fract(ap.y*2.2+nz(ap*1.3)*1.5);
      if(st<.12)c*=.86;
      if(cr<.4&&(onT||onT3))c*=.86;else if(cr>.8&&onT)c*=1.1;
      c*=mix(vec3(1.),vec3(1.06,.98,.9),nz(ap*.6));
      /* crags: emboss a ridged noise toward the sun */
      float r0=fbm(ap*.9),r1=fbm(ap*.9+uSun*.18);
      c*=1.+clamp((r1-r0)*9.,-.35,.3);
      if(ty==6&&elevS>214.+nz(ap*1.4)*14.)c=mix(c,vec3(.93,.95,.98)*(1.+clamp((r1-r0)*6.,-.25,.1)),.9);
    }else if(ty==13){
      if(nz(ap*1.9+3.)>.62)c=mix(c,vec3(.93,.95,.97),.85);
      else if(cr<.35&&(onT||onT2))c*=.86;
    }else if(ty==15){
      float pd=nz(ap*1.6+5.);
      if(pd>.6)c=vec3(.24,.33,.29)+step(.985,h)*.2;else if(cr<.5&&(onT||onT2))c*=.82;
    }else if(ty==8){
      float n=fbm(ap*.7+vec2(uTime*.05,uTime*.03));
      c=mix(vec3(.8,.15,.03),vec3(1.,.8,.25),smoothstep(.35,.75,n));
      if(nz(ap*2.3+vec2(uTime*.02,0.))>.63)c=vec3(.28,.12,.09);
    }else if(ty==9){
      if(h>.9)c*=.8;
      if(h2>.985)c=mix(vec3(1.,.35,.05),vec3(1.,.7,.2),hs(ai+ivec2(int(uTime*5.),0)));
    }
    bool cliff=ty==6||ty==7;
    if(!cliff&&land<.6&&river<.3){
      vec3 sand=cold<.12?vec3(.66,.66,.64):texelFetch(uBio,ivec2(2,1),0).rgb;
      c=land<.535?sand*.86:sand*(h>.85?.94:1.);
    }
    if(river>.12&&land<.64)c=mix(c,vec3(.42,.5,.3),.45);
    if((fl&2)!=0){
      vec2 f=fract(ap);bool vt=hs(t0*3)>.5;
      float rw=fract((vt?f.x:f.y)*4.);
      float ph=fract(uSeas);
      vec3 soilC=vec3(.46,.33,.2),young=vec3(.45,.68,.26),ripe=vec3(.86,.72,.3),stub=vec3(.72,.62,.38);
      vec3 crop=ph<.25?mix(soilC*1.15,young,ph/.25):ph<.5?mix(young,ripe,(ph-.25)/.25):ph<.66?ripe:ph<.76?stub:soilC*1.1;
      crop=mix(mix(young,ripe,.55),crop,uSAmp);
      c=rw<.5?mix(soilC,crop,.3):crop*(h>.8?.92:1.);
      if(f.x<.07||f.y<.07)c=mix(c,vec3(.4,.48,.24),.65);
    }else if((fl&4)!=0)c=mix(c,vec3(.42,.62,.3),.35);
    if((fl&8)!=0){
      vec3 g=otier>=2?vec3(.63,.61,.57)*(1.-.08*step(.5,h)):vec3(.58,.48,.34)*(1.-.06*step(.6,h));
      c=mix(c,g,.8);
    }
    int rk=rb&3;
    if(rk>0){
      vec2 f=fract(ap);int ax;
      float d=roadD(t0,f,ax);
      float w=rk==2?(otier>=3?.18:.2):.165;
      if(d<w){
        int rt=max(rb>>2,otier);bool hw=rk==1;
        vec3 rc;
        if(rt<=1){rc=vec3(.62,.5,.33)*(h>.8?.9:1.);if(d>w-.07)rc*=.86;}
        else if(rt==2||(rt==3&&!hw)){
          rc=vec3(.62,.6,.56);ivec2 cb=ai/3;
          if((ai.x+(cb.y&1))%3==0||ai.y%3==0)rc*=.8;
          rc*=.95+.1*hs(cb);
          if(rt==3)rc*=vec3(1.05,.92,.86);
        }else if(rt==3){
          rc=vec3(.5,.47,.44)*(.92+.12*h);
          if(ax>0){float a=ax==1?f.x:f.y,p=ax==1?f.y:f.x;
            if(fract(a*5.33)<.45)rc=vec3(.42,.3,.2);
            if(abs(abs(p-.5)-.09)<.035)rc=vec3(.8,.8,.83);}
        }else{
          rc=vec3(.33,.34,.36)*(.95+.08*h);
          if(hw){if(ax>0){float a=ax==1?f.x:f.y,p=ax==1?f.y:f.x;if(abs(p-.5)<.035&&fract(a*2.)<.5)rc=vec3(.95,.85,.4);}}
          else if(d>w-.06)rc=vec3(.66,.66,.64);
        }
        c=rc;
      }
    }
    if((fl&1)!=0){
      c=mix(c,vec3(.16,.11,.09),.75);
      float e=hs(ai+ivec2(int(uTime*9.)*13,0));
      if(e>.72)c=mix(vec3(.95,.3,.05),vec3(1.,.82,.3),(e-.72)/.28);
    }
    float e1=SM(ap+vec2(.5,0.)).g,e2=SM(ap-vec2(.5,0.)).g,e3=SM(ap+vec2(0.,.5)).g,e4=SM(ap-vec2(0.,.5)).g;
    vec3 n=normalize(vec3((e2-e1)*10.,(e4-e3)*10.,1.));
    vec3 L=normalize(vec3(uSun,.8));
    float dif=dot(n,L)-L.z;
    float sh=1.+dif*1.1;
    sh=mix(sh,floor(sh*9.+bay(ai))/9.,det);
    c*=clamp(sh,.55,1.35);
    float te=cold-max(0.,elevS-100.)/155.*.5+(nz(ap*1.9)-.5)*.09;
    if(ty!=8&&ty!=9&&(fl&3)==0&&rk==0&&te<-.03+.22*wint)
      c=mix(vec3(.94,.97,1.),vec3(.76,.83,.94),clamp(-dif*3.,0.,1.))*(h>.92?.97:1.);
  }
  if(!outW&&uBord>.5){
    int k0=KID(t0);
    if(k0>0){
      vec3 kc=KC(k0);
      c=mix(c,kc,.12);
      vec2 f=fract(ap);float bw=max(.125,1.5/uZoom);
      bool e=(f.x<bw&&KID(t0+ivec2(-1,0))!=k0)||(f.x>1.-bw&&KID(t0+ivec2(1,0))!=k0)||(f.y<bw&&KID(t0+ivec2(0,-1))!=k0)||(f.y>1.-bw&&KID(t0+ivec2(0,1))!=k0);
      if(e)c=mix(c,kc*1.1+.06,.82);
    }
  }
  if(uCloud>.5){float cs=fbm((ap+uSun*3.)*.028+uWind);c*=1.-step(.6,cs)*.16*uDay;}
  if(uNSt>0){float st=stormAt(ap);c*=1.-st*.32;c=mix(c,vec3(dot(c,vec3(.33))),st*.35);}
  if(outW){vec2 d=max(-wp,wp-uWorld);c*=max(.7,1.-max(d.x,d.y)*.008);}
  o=vec4(c,1.);
}`;

const SH_CLOUD_FS=`#version 300 es
precision highp float;
uniform highp sampler2D uNz;
uniform vec2 uRes,uCam,uWind;uniform vec3 uAmb;uniform float uZoom,uFade;
uniform vec4 uSt[6];uniform int uNSt;
out vec4 o;
${SH_COMMON}
void main(){
  vec2 fc=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec2 wp=uCam+fc/uZoom;
  vec2 cp=(floor(wp*4.)+.5)/4.;
  float st=uNSt>0?stormAt(cp):0.;
  float d=fbm(cp*.028+uWind)+st*.45;
  if(d<.6)discard;
  float dn=fbm((cp+vec2(.4,1.6))*.028+uWind)+st*.45,up=fbm((cp-vec2(.3,1.))*.028+uWind)+st*.45;
  vec3 col=vec3(.95,.96,.98);
  if(dn<.6)col=vec3(.76,.8,.88);else if(up<.6)col=vec3(1.);
  if(d>.7)col*=.97;
  col=mix(col,vec3(.42,.45,.52)*(dn<.6?.8:1.),smoothstep(.15,.6,st));
  o=vec4(col*uAmb,max(.86*uFade,st*.75*(1.-smoothstep(10.,22.,uZoom))));
}`;

const SH_DARK_FS=`#version 300 es
precision highp float;
uniform sampler2D uLight;uniform vec3 uAmb;uniform vec2 uRes;
out vec4 o;
void main(){vec3 l=texture(uLight,gl_FragCoord.xy/uRes).rgb;o=vec4(min(vec3(1.),uAmb+l),1.);}`;

const SH_SPRITE_VS=`#version 300 es
precision highp float;precision highp int;
layout(location=0) in vec2 aC;
layout(location=1) in vec4 iA;
layout(location=2) in vec4 iB;
layout(location=3) in vec4 iT;
layout(location=4) in vec4 iF;
uniform highp sampler2D uFr;uniform vec2 uRes,uCam,uAt;uniform float uZoom;
out vec2 vUV;out vec4 vT,vF;out float vA;flat out int vFl;out vec2 vW;
void main(){
  int fi=int(iA.z+.5);
  vec4 r=texelFetch(uFr,ivec2(fi,0),0),an=texelFetch(uFr,ivec2(fi,1),0);
  float s=iB.w;int fl=int(iB.y+.5);
  vec2 c=aC;c.y=mix(1.-iB.z,1.,aC.y);
  bool fx=(fl&1)!=0;
  float ax=fx?r.z-an.x:an.x;
  vec2 w=iA.xy-vec2(ax,an.y)/16.*s+c*r.zw/16.*s;
  vec2 sc=(w-uCam)*uZoom;
  gl_Position=vec4(sc.x/uRes.x*2.-1.,1.-sc.y/uRes.y*2.,iA.w*2.-1.,1.);
  vUV=(r.xy+vec2(fx?1.-c.x:c.x,c.y)*r.zw)/uAt;
  vT=iT;vF=iF;vA=iB.x;vFl=fl;vW=w;
}`;

const SH_SPRITE_FS=`#version 300 es
precision highp float;precision highp int;
uniform highp sampler2D uAtl,uNz;uniform int uMode;uniform float uNight,uDay,uCloud;uniform vec2 uAt,uWind,uSun;
uniform vec4 uSt[6];uniform int uNSt;
in vec2 vUV;in vec4 vT,vF;in float vA;flat in int vFl;in vec2 vW;
out vec4 o;
${SH_COMMON}
void main(){
  vec4 t=texture(uAtl,vUV);
  if(t.a<.01)discard;
  int mk=int(t.a*255.+.5);
  vec3 c=t.rgb;float L=t.r*1.6;
  if(uMode==1){
    if(mk==252){
      ivec2 px=ivec2(vUV*uAt);
      float on=texelFetch(uNz,(px/2+ivec2((vFl>>4)*7,(vFl>>4)*3))&255,0).r;
      if(on<.3)discard;
      o=vec4(vec3(1.,.84,.52)*max(.8,min(1.3,L))*1.25*uNight,1.);
    }else if(mk==251)o=vec4(c*uNight,1.);
    else discard;
    return;
  }
  if(mk==254)c=vT.rgb*L;else if(mk==253)c=vF.rgb*L;else if(mk==252)c=vec3(.19,.25,.33)*L;
  if((vFl&8)!=0){o=vec4(0.,0.,0.,vA);return;}
  if(uMode==0&&uCloud>.5&&(vFl&4)==0){float cs=fbm((vW+uSun*3.)*.028+uWind);c*=1.-step(.6,cs)*.16*uDay;}
  if(uMode==0&&uNSt>0&&(vFl&4)==0){float st=stormAt(vW);c*=1.-st*.32;c=mix(c,vec3(dot(c,vec3(.33))),st*.35);}
  o=vec4(c,vA);
}`;

const SH_LIGHT_VS=`#version 300 es
precision highp float;
layout(location=0) in vec2 aC;layout(location=1) in vec4 iL;layout(location=2) in vec4 iC;
uniform vec2 uRes,uCam;uniform float uZoom;
out vec2 vP;out vec3 vC;
void main(){vec2 w=iL.xy+(aC*2.-1.)*iL.z;vec2 sc=(w-uCam)*uZoom;
  gl_Position=vec4(sc.x/uRes.x*2.-1.,1.-sc.y/uRes.y*2.,0.,1.);vP=aC*2.-1.;vC=iC.rgb*iL.w;}`;
const SH_LIGHT_FS=`#version 300 es
precision highp float;
in vec2 vP;in vec3 vC;out vec4 o;
void main(){float d=dot(vP,vP);if(d>1.)discard;float f=1.-d;o=vec4(vC*f*f,1.);}`;

function glCreate(canvas){
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,stencil:false,premultipliedAlpha:false,powerPreference:'high-performance'});
  if(!gl)return null;
  const R={gl};
  function shader(type,src){
    const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs,fs){
    const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
    const u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i);u[a.name.replace(/\[0\]$/,'')]=gl.getUniformLocation(p,a.name);}
    return{p,u};
  }
  function tex(w,h,linear,repeat,data,fmt){
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    const f=linear?gl.LINEAR:gl.NEAREST,wr=repeat?gl.REPEAT:gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wr);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wr);
    if(fmt==='f32')gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,data);
    else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data||null);
    return t;
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  R.pT=program(SH_FULL_VS,SH_TERRAIN_FS);
  R.pC=program(SH_FULL_VS,SH_CLOUD_FS);
  R.pD=program(SH_FULL_VS,SH_DARK_FS);
  R.pS=program(SH_SPRITE_VS,SH_SPRITE_FS);
  R.pL=program(SH_LIGHT_VS,SH_LIGHT_FS);

  /* noise: white noise per texel, filtered linearly it doubles as value noise */
  const nzd=new Uint8Array(256*256*4),rr=mulberry(1234567);
  for(let i=0;i<nzd.length;i++)nzd[i]=(rr()*256)|0;
  R.tNz=tex(256,256,true,true,nzd);
  /* biome colours per season: rows 0..3 spring, summer, autumn, winter */
  const bio=new Uint8Array(32*8*4);
  for(let t=0;t<NT;t++)for(let r=0;r<6;r++){const c=hexRgb(r<4?BIOME_COL[t][r]:CANOPY[t][r-4]),o=(r*32+t)*4;bio[o]=c[0];bio[o+1]=c[1];bio[o+2]=c[2];bio[o+3]=255;}
  R.tBio=tex(32,8,false,false,bio);
  R.kpal=new Uint8Array(256*256*4);R.tKPal=tex(256,256,false,false,R.kpal);R.kpalN=0;

  /* sprite atlas */
  const A=(typeof buildAtlas==='function')?buildAtlas():atlStub();
  R.atlas=A;R.tAtl=tex(A.w,A.h,false,false,A.data);
  const fr=new Float32Array(A.frames.length*2*4);
  A.frames.forEach((f,i)=>{fr.set([f.x,f.y,f.w,f.h],i*4);fr.set([f.ax,f.ay,0,0],(A.frames.length+i)*4);});
  R.tFr=tex(A.frames.length,2,false,false,fr,'f32');

  /* geometry */
  R.vaoFull=gl.createVertexArray();
  const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
  function spriteVao(){
    const vao=gl.createVertexArray(),buf=gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,40,0);gl.vertexAttribDivisor(1,1);
    gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,40,16);gl.vertexAttribDivisor(2,1);
    gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,4,gl.UNSIGNED_BYTE,true,40,32);gl.vertexAttribDivisor(3,1);
    gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,4,gl.UNSIGNED_BYTE,true,40,36);gl.vertexAttribDivisor(4,1);
    gl.bindVertexArray(null);
    return{vao,buf};
  }
  function lightVao(){
    const vao=gl.createVertexArray(),buf=gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,20,0);gl.vertexAttribDivisor(1,1);
    gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.UNSIGNED_BYTE,true,20,16);gl.vertexAttribDivisor(2,1);
    gl.bindVertexArray(null);
    return{vao,buf};
  }
  R.vShadow=spriteVao();R.vMain=spriteVao();R.vPost=spriteVao();R.vSky=spriteVao();R.vLight=lightVao();

  /* night light map */
  R.lightW=0;R.lightH=0;R.tLight=null;R.fbo=gl.createFramebuffer();
  R.ensureLight=function(w,h){
    if(w===R.lightW&&h===R.lightH)return;
    if(R.tLight)gl.deleteTexture(R.tLight);
    R.tLight=tex(w,h,true,false,null);R.lightW=w;R.lightH=h;
    gl.bindFramebuffer(gl.FRAMEBUFFER,R.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,R.tLight,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  };

  /* world data mirrored into textures */
  R.W=0;R.H=0;
  R.setWorld=function(){
    R.W=W;R.H=H;
    R.dT=new Uint8Array(N*4);R.dS=new Uint8Array(N*4);R.dO=new Uint8Array(N*4);R.rows=new Uint8Array(H);
    for(const t of[R.tTerr,R.tSm,R.tOwn])if(t)gl.deleteTexture(t);
    R.tTerr=tex(W,H,false,false,null);R.tSm=tex(W,H,true,false,null);R.tOwn=tex(W,H,false,false,null);
    R.kpal.fill(0);R.kpalN=0;
    R.full=true;
  };
  R.touch=function(i){if(!R.dT||R.W!==W)return;glTileData(R,i);R.rows[(i/W)|0]=1;};
  R.touchRows=function(a,b){if(!R.dT||R.W!==W)return;a=Math.max(0,a);b=Math.min(H-1,b);for(let y=a;y<=b;y++){for(let i=y*W,e=i+W;i<e;i++)glTileData(R,i);R.rows[y]=1;}};
  R.flush=function(){
    if(dirtyAll){R.full=true;dirtyAll=false;}
    if(R.full){
      for(let i=0;i<N;i++)glTileData(R,i);
      R.rows.fill(1);R.full=false;
    }
    let y=0;
    while(y<H){
      if(!R.rows[y]){y++;continue;}
      let e=y;while(e<H&&R.rows[e]){R.rows[e]=0;e++;}
      const off=y*W*4,len=(e-y)*W*4;
      for(const[t,d]of[[R.tTerr,R.dT],[R.tSm,R.dS],[R.tOwn,R.dO]]){
        gl.bindTexture(gl.TEXTURE_2D,t);gl.texSubImage2D(gl.TEXTURE_2D,0,0,y,W,e-y,gl.RGBA,gl.UNSIGNED_BYTE,d.subarray(off,off+len));
      }
      y=e;
    }
    if(R.kpalN!==kingdoms.length){
      for(let n=R.kpalN;n<kingdoms.length;n++){const k=kingdoms[n],o=k.id*4;if(o+3<R.kpal.length){R.kpal[o]=k.rgb[0];R.kpal[o+1]=k.rgb[1];R.kpal[o+2]=k.rgb[2];R.kpal[o+3]=255;}}
      R.kpalN=kingdoms.length;
      gl.bindTexture(gl.TEXTURE_2D,R.tKPal);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,R.kpal);
    }
  };
  R.frame=function(dt,running,lerp){glFrame(R,dt,running,lerp);};
  R.tex=tex;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();R.lost=true;});
  canvas.addEventListener('webglcontextrestored',()=>{toast('The graphics were reset. Reload the page if the world looks wrong.');});
  return R;
}
/* one tile's entries in the three data textures */
function glTileData(R,i){
  const t=tile[i],o=i*4,b=bmap[i];
  let fl=0;
  if(fire[i])fl|=1;
  if(b){if(b.kind==='farm')fl|=b.grove?4:2;else if(b.kind!=='dock'&&b.kind!=='mine'&&b.kind!=='wall')fl|=8;}
  const vid=vown[i];let kid=0,tier=0;
  if(vid){const v=vById[vid];if(v&&v.alive){kid=v.k.id;tier=TIER[v.k.age]||0;}}
  const rd=road[i];
  R.dT[o]=t;R.dT[o+1]=fl;R.dT[o+2]=temp[i];R.dT[o+3]=rd?((rd&3)|(Math.max(rd>>2,0)<<2)):0;
  R.dS[o]=t>WATER&&t!==RIVER?255:0;R.dS[o+1]=elev[i];R.dS[o+2]=TREE[t]?255:0;R.dS[o+3]=t===RIVER?255:0;
  R.dO[o]=kid&255;R.dO[o+1]=kid>>8;R.dO[o+2]=tier;R.dO[o+3]=0;
}
/* a tiny stand-in atlas, used only if the art module is missing */
function atlStub(){
  const w=64,h=32,data=new Uint8Array(w*h*4);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const o=(y*w+x)*4;const edge=x===0||y===0||x===15||y===15;data[o]=data[o+1]=data[o+2]=edge?60:160;data[o+3]=edge?255:254;}
  for(let y=0;y<6;y++)for(let x=20;x<36;x++){const o=(y*w+x)*4;data[o+3]=255;}
  return{w,h,data,frames:[{name:'box',x:0,y:0,w:16,h:16,ax:8,ay:15},{name:'shadow',x:20,y:0,w:16,h:6,ax:8,ay:3}],idx:{box:0,shadow:1}};
}
