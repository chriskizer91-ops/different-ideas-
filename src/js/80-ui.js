/* ================= interface ================= */
function toast(msg,type){
  const el=$('log');if(!el)return;
  const d=document.createElement('div');d.textContent=msg;if(type)d.className='t-'+type;
  el.appendChild(d);
  while(el.children.length>2)el.removeChild(el.firstChild);
  setTimeout(()=>{d.classList.add('out');},5200);
  setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d);},5900);
}
/* a title card for the great moments of world history */
let bannerTimer=0,worldAge=-1;
function banner(kicker,title,sub){
  if(quiet)return;
  $('bannerKicker').textContent=kicker;$('bannerTitle').textContent=title;$('bannerSub').textContent=sub||'';
  const el=$('banner');el.classList.add('on');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>{el.classList.remove('on');},5200);
}
let infoTimer=0;
function showInfo(html){const el=$('info');el.innerHTML=html;el.hidden=false;clearTimeout(infoTimer);infoTimer=setTimeout(hideInfo,6500);}
function hideInfo(){$('info').hidden=true;}
const SEASON_ICO=['\u{1F331} Spring','\u2600\uFE0F Summer','\u{1F342} Autumn','\u2744\uFE0F Winter'];
function hud(){
  const sp=((tick%YEAR)/YEAR+.875)%1;
  $('year').textContent='Year '+yearNow()+(S.seasons&&speed<=3?' '+SEASON_ICO[(sp*4)|0].split(' ')[0]:'');
  let best=-1;for(const k of kingdoms)if(k.alive&&k.age>best)best=k.age;
  $('era').textContent=best<0?'Tiny Dominion':AGE_NAME[best];
  let cz=0;for(const k of kingdoms)if(k.alive)cz+=kCitizens(k);
  $('pop').textContent=fmtPop(cz+Math.max(0,civCount()-kingdoms.reduce((a,k)=>a+(k.alive?kPop(k):0),0))*6)+(vw<440?'':' people');
  let n=0;for(const k of kingdoms)if(k.alive)n++;
  $('realmCount').textContent=n===0?'No realms yet':n===1?'1 realm':n+' realms';
}
function veil(on,title,text){
  $('veil').hidden=!on;
  if(title)$('veilTitle').textContent=title;
  $('veilText').textContent=text||'';
}
function setClaude(on){document.body.classList.toggle('has-claude',!!on);}
function councilUi(){
  const b=$('councilBtn');if(b){b.disabled=councilBusy;b.textContent=councilBusy?'The rulers are conferring':'Hold a council';}
  const s=$('rSend');if(s)s.disabled=councilBusy;
}
const cap1=s=>s.charAt(0).toUpperCase()+s.slice(1);

/* ---------- sheets ---------- */
let sheetMode='',sheetK=null,sheetTimer=0,seedText='',confirmNew=0;
function openSheet(mode,k){
  sheetMode=mode;sheetK=k||null;
  $('sheet').hidden=false;$('sheetBack').hidden=mode!=='realm';
  $('sheetTitle').textContent=mode==='realms'?'Realms':mode==='realm'?k.name:mode==='chronicle'?'Chronicle':mode==='history'?'History of the world':'Settings';
  $('realmBtn').setAttribute('aria-expanded',String(mode==='realms'||mode==='realm'));
  buildSheet();
  clearInterval(sheetTimer);
  if(mode!=='settings')sheetTimer=setInterval(refreshSheet,1200);
}
function closeSheet(){sheetMode='';$('sheet').hidden=true;clearInterval(sheetTimer);$('realmBtn').setAttribute('aria-expanded','false');}
function optRow(label,key,opts){
  return '<div class="row"><span>'+label+'</span><div class="opts" data-key="'+key+'">'+
    opts.map(o=>'<button data-v="'+o[0]+'" aria-pressed="'+(String(S[key])===String(o[0]))+'">'+o[1]+'</button>').join('')+'</div></div>';
}
const ONOFF=[['true','On'],['false','Off']];
function buildSheet(){
  const body=$('sheetBody');body.scrollTop=0;
  if(sheetMode==='realms'){
    body.innerHTML='<div class="council claude-only"><button id="councilBtn" class="act">Hold a council</button>'+
      '<p class="fine">Claude plays every ruler and picks each realm\'s next move. Each council uses some of your Claude usage.</p></div>'+
      '<p class="fine no-claude">The rulers think for themselves. When this page is open inside Claude, Claude can also play them in a council.</p><div id="realmList"></div>';
    councilUi();
  }else if(sheetMode==='realm'){
    const k=sheetK;
    body.innerHTML='<div class="rhead"><i style="background:'+k.color+'"></i><div><b id="rRuler"></b><small id="rNature"></small></div></div>'+
      '<dl id="rStats" class="stats"></dl><p id="rFocus" class="note"></p>'+
      '<h3 id="rAgeH"></h3><div class="meter" role="img" id="rMeterW"><i id="rMeter"></i></div><p id="rTechNow" class="fine"></p><div id="rTechs" class="chips"></div>'+
      '<div id="rWonders"></div>'+
      '<h3>Towns</h3><div id="rTowns"></div>'+
      '<h3>How it sees its neighbours</h3><div id="rRel"></div>'+
      '<div class="btnrow"><button id="rGo" class="act">Go to capital</button></div>'+
      '<div class="claude-only speak"><h3>Speak to the ruler</h3>'+
      '<textarea id="rMsg" rows="2" maxlength="300" placeholder="Command, warn or bargain as their god"></textarea>'+
      '<button id="rSend" class="act">Send</button><p id="rReply" class="note"></p>'+
      '<p class="fine">Claude answers as the ruler and may act on what you say. Each message uses some of your Claude usage.</p></div>';
    councilUi();
  }else if(sheetMode==='chronicle'){
    body.innerHTML='<p class="fine">Tap an entry marked with a pin to see where it happened.</p><div id="chronList"></div>';chronDirty=true;
  }else if(sheetMode==='history'){
    body.innerHTML='<dl id="hTiles" class="tiles"></dl>'+
      '<h3>The rise and fall of realms</h3><p class="fine">People in the largest realms over the years, on a scale where each line up is ten times more.</p>'+
      '<div id="hLegend" class="legend"></div><div class="chart"><canvas id="hChart" aria-label="Line chart of realm populations over time"></canvas><div id="hTip" class="tip" hidden></div></div>'+
      '<h3>Leading realms</h3><table class="lead"><thead><tr><th>Realm</th><th>Age</th><th class="n">People</th><th class="n">Towns</th></tr></thead><tbody id="hLead"></tbody></table>'+
      '<h3>Wonders of the world</h3><div id="hWonders"></div>';
  }else{
    body.innerHTML='<h3>This world</h3>'+
      optRow('Graphics','gfx',[['hd','HD'],['classic','Classic']])+optRow('Sharpness','quality',[['fast','Fast'],['balanced','Balanced'],['sharp','Sharp']])+
      optRow('Day and night','night',ONOFF)+optRow('Seasons','seasons',ONOFF)+optRow('Weather','weather',ONOFF)+optRow('Clouds','clouds',ONOFF)+optRow('Contour lines','contours',ONOFF)+optRow('Names on the map','labels',ONOFF)+
      optRow('Realm borders','borders',ONOFF)+optRow('Minimap','minimap',ONOFF)+optRow('Trees and peaks up close','detail',ONOFF)+
      optRow('Disasters','disasters',[['off','Off'],['rare','Rare'],['wild','Wild']])+
      optRow('Temper of rulers','mood',[['gentle','Gentle'],['normal','Normal'],['bloodthirsty','Bloodthirsty']])+
      optRow('Population limit','popcap',[['small','Small'],['normal','Normal'],['large','Large']])+
      '<h3>How to play</h3><p class="note">Raise land and paint the world with the Shape and Paint tools. Drop a few people from the Life tab on good land and they will found a realm. Speed time up and watch it grow through nine ages, from huts to cities and rockets. Tap Watch to let the camera follow the action.</p>'+
      '<h3>Sound</h3>'+optRow('Sound','sound',ONOFF)+optRow('Music','music',ONOFF)+
      '<h3>Saved worlds</h3><p class="fine">Worlds are kept in this browser only.</p>'+optRow('Autosave','autosave',ONOFF)+'<div id="saves"><p class="fine">Looking for saved worlds</p></div>'+
      '<h3>New world</h3>'+
      optRow('Size','size',[['cozy','Cozy'],['grand','Grand'],['colossal','Colossal']])+
      optRow('Land','land',[['islands','Islands'],['continents','Continents'],['pangea','One landmass'],['flat','Flat plain'],['ocean','Empty ocean']])+
      optRow('Climate','climate',[['cold','Cold'],['temperate','Temperate'],['hot','Hot']])+
      optRow('Peoples','peoples',[['none','None'],['few','A few'],['many','Many']])+
      optRow('Head start','history',[['0','None'],['60','60 yrs'],['150','150 yrs'],['300','300 yrs']])+
      optRow('Wildlife','wild',ONOFF)+
      '<div class="row"><label for="seedIn">Seed word</label><input id="seedIn" type="text" maxlength="24" placeholder="Leave empty for random" autocomplete="off"></div>'+
      '<div class="btnrow"><button id="newBtn" class="act">Create new world</button></div>'+
      '<p class="fine">Creating a world replaces the current one. Large worlds and the Large population limit run slower on phones.</p>';
    $('seedIn').value=seedText;
    savesHtml(h=>{const el=$('saves');if(el)el.innerHTML=h;});
  }
  refreshSheet();
}
function refreshSheet(){
  if(!sheetMode||sheetMode==='settings')return;
  if(sheetMode==='realms'){
    const list=$('realmList');if(!list)return;
    const alive=kingdoms.filter(k=>k.alive);
    if(!alive.length){list.innerHTML='<p class="note">No realms yet. Drop one of the four peoples on dry land and give them a moment.</p>';return;}
    for(const k of alive)k.pop=kPop(k);
    alive.sort((a,b)=>b.pop-a.pop);
    list.innerHTML=alive.map(k=>{
      const vs=k.villages.length,st=k.wars.size?'At war':k.allies.size?'Allied':'At peace';
      return '<button class="realm" data-k="'+k.id+'"><i style="background:'+k.color+'"></i><span class="rn">'+esc(k.name)+'</span>'+
        '<span class="rs'+(k.wars.size?' hot':'')+'">'+st+'</span><span class="rm">'+SPEC[k.race].pl+', '+fmtPop(kCitizens(k))+' people, '+vs+(vs===1?' town, ':' towns, ')+AGE_NAME[k.age]+'</span></button>';
    }).join('');
  }else if(sheetMode==='realm'){
    const k=sheetK;if(!$('rStats'))return;
    if(!k.alive){$('sheetBody').innerHTML='<p class="note">The realm of '+esc(k.name)+' has fallen.</p>';return;}
    const tr=k.ruler.trait;
    $('rRuler').textContent=rulerName(k)+' '+tr.adj;
    $('rNature').textContent='Ruler of the '+SPEC[k.race].pl.toLowerCase()+' of '+k.name+', '+tr.word;
    $('rStats').innerHTML='<div><dt>People</dt><dd>'+fmtPop(kCitizens(k))+'</dd></div><div><dt>Towns</dt><dd>'+k.villages.length+'</dd></div><div><dt>Age</dt><dd>'+AGES[k.age]+'</dd></div>'+
      '<div><dt>Gold</dt><dd>'+(k.gold|0)+'</dd></div><div><dt>Soldiers</dt><dd>'+k.nSold+'</dd></div><div><dt>Allies</dt><dd>'+k.allies.size+'</dd></div>';
    $('rFocus').textContent=FOCUS_WORD[k.focus]+(k.broke?'. The treasury is empty.':'.');
    {
      const nt=Math.min(k.tech,TECH_LORE.length),lo=nt?TECH_LORE[nt-1]:0,hi=TECH_LORE[Math.min(nt,TECH_LORE.length-1)];
      const pct=nt>=TECH_LORE.length?100:Math.max(0,Math.min(100,Math.round((k.lore-lo)/(hi-lo)*100)));
      $('rAgeH').textContent=AGE_NAME[k.age]+(k.colony?', among the stars':'');
      $('rMeter').style.width=pct+'%';$('rMeterW').setAttribute('aria-label','Research '+pct+' percent');
      $('rTechNow').textContent=nt>=TECH_LORE.length?'Every discovery has been made.':'Now studying '+TECHS[(nt/3)|0][nt%3]+', '+pct+'% of the way'+(k.age<AGES.length-1&&nt%3===2?'. It will open the '+AGE_NAME[k.age+1]:'');
      let h='';for(let n=0;n<nt;n++)h+='<span'+(n>=nt-1?' class="new"':'')+'>'+TECHS[(n/3)|0][n%3]+'</span>';
      $('rTechs').innerHTML=h;
      const ws=[];for(const v of k.villages)if(v.wonder)ws.push(WMAP[v.wonder.wid].n.replace(/^the /,'')+' in '+esc(v.name)+(v.wonder.prog<1?' (being built, '+Math.round(v.wonder.prog*100)+'%)':''));
      $('rWonders').innerHTML=ws.length?'<h3>Wonders</h3><p class="note">'+ws.map(cap1).join('<br>')+'</p>':'';
      const vs=k.villages.slice().sort((a,b)=>b.pop-a.pop).slice(0,12);
      $('rTowns').innerHTML=vs.map(v=>'<button class="town" data-v="'+v.id+'"><b>'+esc(v.name)+(v===k.villages[0]?' \u{1F451}':'')+'</b><small>'+settlementWord(v)+', '+fmtPop(citizens(v))+' people</small></button>').join('')+(k.villages.length>12?'<p class="fine">and '+(k.villages.length-12)+' more</p>':'');
    }
    const rows=[],seen=new Set();
    const add=o=>{
      if(!o.alive||o===k||seen.has(o))return;seen.add(o);
      const st=k.wars.has(o)?'At war':k.allies.has(o)?'Allied':inTruce(k,o)?'Truce':cap1(relWord(rel(k,o)));
      rows.push('<button class="realm slim" data-k="'+o.id+'"><i style="background:'+o.color+'"></i><span class="rn">'+esc(o.name)+'</span><span class="rs'+(k.wars.has(o)?' hot':'')+'">'+st+'</span></button>');
    };
    for(const o of k.wars)add(o);for(const o of k.allies)add(o);
    for(const n of k.nb){if(rows.length>=9)break;add(n.k);}
    $('rRel').innerHTML=rows.length?rows.join(''):'<p class="note">No neighbours within reach yet.</p>';
  }else if(sheetMode==='history'){
    drawHistory();
  }else if(sheetMode==='chronicle'){
    if(!chronDirty)return;chronDirty=false;
    const list=$('chronList');if(!list)return;
    if(!chronicle.length){list.innerHTML='<p class="note">Nothing worth writing down has happened yet.</p>';return;}
    let h='';
    for(let n=chronicle.length-1,c=0;n>=0&&c<160;n--,c++){const e=chronicle[n],go=e.x!==undefined;h+='<div class="ev t-'+(e.type||'x')+(go?' go" role="button" tabindex="0" data-n="'+n:'')+'"><span>Year '+e.y+(go?' <b class="go-ico" aria-label="show on map">\u{1F4CD}</b>':'')+'</span><p>'+esc(e.text)+'</p></div>';}
    list.innerHTML=h;
  }
}
$('sheetClose').addEventListener('click',closeSheet);
$('stopWatch').addEventListener('click',()=>setWatch(false));
$('info').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='followBtn'&&inspected){follow=inspected;glide=null;cam.z=clampZ(Math.max(cam.z,12));hideInfo();toast('Following. Drag the map to stop.');}
});
$('sheetBack').addEventListener('click',()=>openSheet('realms'));
$('realmBtn').addEventListener('click',()=>{if(sheetMode==='realms'||sheetMode==='realm')closeSheet();else openSheet('realms');});
$('sheetBody').addEventListener('input',e=>{if(e.target.id==='seedIn')seedText=e.target.value;});
$('sheetBody').addEventListener('click',e=>{
  const t=e.target;
  const town=t.closest('.town');
  if(town){const v=vById[+town.dataset.v];if(v&&v.alive){camTo(v.x,v.y,Math.max(cam.z,11),1200);closeSheet();}return;}
  const ev=t.closest('.ev.go');
  if(ev){const e=chronicle[+ev.dataset.n];if(e&&e.x!==undefined){camTo(e.x,e.y2,Math.max(cam.z,10),1200);closeSheet();}return;}
  const realm=t.closest('.realm');
  if(realm){const k=kingdoms[+realm.dataset.k-1];if(k&&k.alive)openSheet('realm',k);return;}
  const ob=t.closest('.opts button');
  if(ob){
    const key=ob.parentNode.dataset.key;let v=ob.dataset.v;
    S[key]=typeof DEF[key]==='boolean'?v==='true':v;saveSettings();
    for(const b of ob.parentNode.children)b.setAttribute('aria-pressed',String(b===ob));
    if(key==='borders')dirtyAll=true;
    if(key==='gfx')switchGfx();
    if(key==='sound'&&typeof AU!=='undefined'){AU.unlock();AU.setOn(S.sound);}
    if(key==='music'&&typeof AU!=='undefined')AU.setMusic(S.music);
    if(key==='quality')resize();
    if(key==='weather'&&!S.weather)storms.length=0;
    if(key==='minimap')mini.hidden=!S.minimap;
    return;
  }
  const btn=t.closest('button');if(!btn)return;
  if(btn.dataset.save){saveWorld(btn.dataset.save).then(()=>savesHtml(h=>{const el=$('saves');if(el)el.innerHTML=h;}));return;}
  if(btn.dataset.load){closeSheet();loadWorld(btn.dataset.load);return;}
  if(btn.id==='councilBtn')holdCouncil();
  else if(btn.id==='rGo'){const k=sheetK;if(k&&k.villages.length){camTo(k.villages[0].x,k.villages[0].y,Math.max(cam.z,9),1200);closeSheet();}}
  else if(btn.id==='rSend'){
    const k=sheetK,m=$('rMsg').value.trim();if(!k||!m||councilBusy)return;
    $('rReply').textContent=rulerName(k)+' listens to the heavens';
    speakTo(k,m,reply=>{const el=$('rReply');if(el&&sheetK===k)el.textContent=reply?'\u201c'+reply+'\u201d':'';});
  }else if(btn.id==='newBtn'){
    if(Date.now()-confirmNew<3500){confirmNew=0;closeSheet();startWorld();}
    else{confirmNew=Date.now();btn.textContent='Tap again to replace this world';setTimeout(()=>{if(btn.isConnected)btn.textContent='Create new world';},3500);}
  }
});

/* ---------- tools ---------- */
const sw=t=>'rgb('+TD[t].c.join(',')+')';
const land=(label,t)=>({id:'l'+t,label,sw:sw(t),mode:'brush',tile:t});
const CATS=[
  {label:'World',tools:[
    {id:'pan',label:'Move',ico:'\u270B',mode:'pan'},
    {id:'inspect',label:'Inspect',ico:'\uD83D\uDD0E',mode:'tap'},
    {id:'watch',label:'Watch',ico:'\u{1F3AC}',mode:'action'},
    {id:'view3d',label:'3D view',ico:'\u{1F9CA}',mode:'action'},
    {id:'sound',label:'Sound',ico:'\u{1F50A}',mode:'action'},
    {id:'realms',label:'Realms',ico:'\uD83D\uDC51',mode:'action'},
    {id:'chronicle',label:'Chronicle',ico:'\uD83D\uDCDC',mode:'action'},
    {id:'history',label:'History',ico:'\uD83D\uDCC8',mode:'action'},
    {id:'settings',label:'Settings',ico:'\u2699\uFE0F',mode:'action'}]},
  {label:'Shape',tools:[
    {id:'topo',label:'Topo map',ico:'\u{1F5FA}\uFE0F',mode:'action'},
    {id:'raise',label:'Raise',ico:'\u26F0\uFE0F',mode:'brush',sculpt:1},
    {id:'lower',label:'Lower',ico:'\u{1F573}\uFE0F',mode:'brush',sculpt:1},
    {id:'smooth',label:'Smooth',ico:'\u3030\uFE0F',mode:'brush',sculpt:1},
    {id:'flatten',label:'Flatten',ico:'\u{1F7F0}',mode:'brush',sculpt:1},
    {id:'ridge',label:'Ridges',ico:'\u{1F3D4}\uFE0F',mode:'brush',sculpt:1},
    {id:'valley',label:'Valley',ico:'\u{1F3DE}\uFE0F',mode:'brush',sculpt:1},
    {id:'terrace',label:'Terraces',ico:'\u{1F3EF}',mode:'brush',sculpt:1},
    {id:'roughen',label:'Roughen',ico:'\u{1FAA8}',mode:'brush',sculpt:1},
    {id:'erode',label:'Erode',ico:'\u{1F4A8}',mode:'brush',sculpt:1},
    {id:'flow',label:'Water flows',ico:'\u{1F4A6}',mode:'action'},
    {id:'spring',label:'Spring',ico:'\u26F2',mode:'tap'},
    {id:'sea',label:'Sea level',ico:'\u{1F30A}',mode:'slider'}]},
  {label:'Paint',tools:[
    {id:'plant',label:'Plant trees',ico:'\u{1F333}',mode:'brush'},
    {id:'warm',label:'Warmer',ico:'\u2600\uFE0F',mode:'brush'},
    {id:'cool',label:'Colder',ico:'\u2744\uFE0F',mode:'brush'},
    {id:'wet',label:'Wetter',ico:'\u{1F4A7}',mode:'brush'},
    {id:'dry',label:'Drier',ico:'\u{1F335}',mode:'brush'},
    land('Ocean',DEEP),land('Shallows',WATER),land('Beach',SAND),land('Grass',GRASS),land('Forest',FOREST),land('Jungle',JUNGLE),
    land('Pines',PINE),land('Savanna',SAVANNA),land('Desert',DESERT),land('Tundra',TUNDRA),land('Swamp',SWAMP),land('Hills',HILL),
    land('Mountain',MOUNT),land('River',RIVER),land('Lava',LAVA)]},
  {label:'Life',tools:[
    {id:'human',label:'Humans',ico:'\uD83E\uDDD1',mode:'spawn',type:HUMAN},
    {id:'elf',label:'Elves',ico:'\uD83E\uDDDD',mode:'spawn',type:ELF},
    {id:'dwarf',label:'Dwarves',ico:'\uD83E\uDDD4',mode:'spawn',type:DWARF},
    {id:'orc',label:'Orcs',ico:'\uD83D\uDC79',mode:'spawn',type:ORC},
    {id:'sheep',label:'Sheep',ico:'\uD83D\uDC11',mode:'spawn',type:SHEEP},
    {id:'wolf',label:'Wolves',ico:'\uD83D\uDC3A',mode:'spawn',type:WOLF},
    {id:'bear',label:'Bears',ico:'\uD83D\uDC3B',mode:'spawn',type:BEAR},
    {id:'dragon',label:'Dragon',ico:'\uD83D\uDC09',mode:'spawn',type:DRAGON},
    {id:'zombie',label:'Zombies',ico:'\uD83E\uDDDF',mode:'spawn',type:ZOMBIE}]},
  {label:'Powers',tools:[
    {id:'rain',label:'Rain',ico:'\uD83C\uDF27\uFE0F',mode:'brush'},
    {id:'storm',label:'Storm',ico:'\u26C8\uFE0F',mode:'tap'},
    {id:'bless',label:'Bless',ico:'\u2728',mode:'brush'},
    {id:'fire',label:'Fire',ico:'\uD83D\uDD25',mode:'brush'},
    {id:'bolt',label:'Lightning',ico:'\u26A1',mode:'tap'},
    {id:'bomb',label:'Bomb',ico:'\uD83D\uDCA3',mode:'tap'},
    {id:'meteor',label:'Meteor',ico:'\u2604\uFE0F',mode:'tap'},
    {id:'tornado',label:'Tornado',ico:'\uD83C\uDF2A\uFE0F',mode:'tap'},
    {id:'volcano',label:'Volcano',ico:'\uD83C\uDF0B',mode:'tap'},
    {id:'plague',label:'Plague',ico:'\u2620\uFE0F',mode:'brush'},
    {id:'smite',label:'Smite',ico:'\uD83D\uDC80',mode:'brush'},
    {id:'war',label:'Stir war',ico:'\u2694\uFE0F',mode:'tap'},
    {id:'peace',label:'Make peace',ico:'\uD83D\uDD4A\uFE0F',mode:'tap'}]}
];
let tool=CATS[0].tools[0],cat=0;
function buildTabs(){
  const el=$('tabs');el.innerHTML='';
  CATS.forEach((c,n)=>{
    const b=document.createElement('button');
    b.textContent=c.label;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(n===cat));
    b.addEventListener('click',()=>{cat=n;buildTabs();buildTools(true);});
    el.appendChild(b);
  });
}
function buildTools(reset){
  const el=$('tools'),keep=el.scrollLeft;el.innerHTML='';
  for(const t of CATS[cat].tools){
    const b=document.createElement('button');b.className='tool';
    if(t.mode!=='action')b.setAttribute('aria-pressed',String(t===tool));
    const ic=document.createElement('span');
    if(t.sw){ic.className='sw';ic.style.background=t.sw;}else{ic.className='ico';ic.textContent=t.id==='sound'?(S.sound?'\u{1F50A}':'\u{1F507}'):t.ico;}
    if(t.id==='sound'){b.setAttribute('aria-pressed',String(!!S.sound));}
    if(t.id==='topo'){b.setAttribute('aria-pressed',String(S.topo==='map'));}
    if(t.id==='view3d'){b.setAttribute('aria-pressed',String(view3d));}
    const lb=document.createElement('span');lb.textContent=t.label;
    b.appendChild(ic);b.appendChild(lb);
    b.addEventListener('click',()=>{
      if(typeof AU!=='undefined')AU.unlock();snd('click');
      if(t.id==='sound'){S.sound=!S.sound;saveSettings();if(typeof AU!=='undefined'){AU.unlock();AU.setOn(S.sound);AU.setMusic(S.music);}toast(S.sound?'Sound on.':'Sound off.');buildTools(false);return;}
      if(t.id==='watch'){setWatch(!watching);return;}
      if(t.id==='view3d'){setView3d(!view3d);return;}
      if(t.id==='topo'){S.topo=S.topo==='map'?'off':'map';saveSettings();toast(S.topo==='map'?'Topographic map. Contour lines every 5 steps of height; peaks show their height.':'Back to the living world.');buildTools(false);return;}
      if(t.id==='flow'){const r=letWaterFlow();chron('Rain gathers in the hollows: '+r.lakes+(r.lakes===1?' lake fills':' lakes fill')+' and rivers find their way to the sea','disaster');snd('water');return;}
      if(t.mode==='action'){if(sheetMode===t.id)closeSheet();else openSheet(t.id);return;}
      tool=t;buildTools(false);
    });
    el.appendChild(b);
  }
  el.scrollLeft=reset?0:keep;
  $('brushRow').hidden=!(tool.mode==='brush'||tool.mode==='spawn');
  $('strRow').hidden=!tool.sculpt;
  $('seaRow').hidden=tool.mode!=='slider'||view3d;
  $('reliefRow').hidden=!view3d;
  if(view3d){$('brushRow').hidden=true;$('strRow').hidden=true;}
  if(tool.mode==='slider'){$('seaIn').value=seaGoal-100;$('seaVal').textContent=fmtM((seaGoal-100)*60);}
}

/* ---------- input ---------- */
const ptrs=new Map();let gesture=null,stroke=null;
function pos(e){const r=ovc.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function toTile(p){return{x:Math.floor(cam.x+p.x/cam.z),y:Math.floor(cam.y+p.y/cam.z)};}
function paintAt(p,first){
  const t=toTile(p);
  if(tool.mode==='brush'){
    const again=AGAIN[tool.id]===1;
    if(stroke.ltx===null)applyBrush(t.x,t.y,tool);
    else if(t.x!==stroke.ltx||t.y!==stroke.lty||again){
      const dx=t.x-stroke.ltx,dy=t.y-stroke.lty,steps=Math.max(1,Math.abs(dx),Math.abs(dy));
      for(let s=1;s<=steps;s++)applyBrush(Math.round(stroke.ltx+dx*s/steps),Math.round(stroke.lty+dy*s/steps),tool);
    }
    stroke.ltx=t.x;stroke.lty=t.y;
  }else if(first||Math.hypot(t.x-stroke.spx,t.y-stroke.spy)>=Math.max(1.5,brush*.8)){
    spawnBrush(t.x,t.y,tool.type);stroke.spx=t.x;stroke.spy=t.y;
  }
}
const AGAIN={rain:1,fire:1,bless:1,raise:1,lower:1,flatten:1,warm:1,cool:1,wet:1,dry:1,plant:1,smooth:1,ridge:1,valley:1,terrace:1,roughen:1,erode:1};
/* holding a shaping brush still keeps working the ground */
function holdBrush(){
  if(!stroke||!stroke.paint||stroke.multi||tool.mode!=='brush'||!AGAIN[tool.id]||stroke.ltx===null)return;
  const t=now();if(t-(stroke.lastHold||0)<120)return;stroke.lastHold=t;
  applyBrush(stroke.ltx,stroke.lty,tool);
}
function tapAt(p){
  const t=toTile(p),ok=inB(t.x,t.y);
  switch(tool.id){
    case'spring':if(ok)snd('water',t.x,t.y,.8);if(ok&&makeRiver(t.x,t.y))chron('A new river springs from the earth'+nearName(t.x,t.y),'disaster',{x:t.x,y:t.y});break;
    case'flood':snd('water');if(seaGoal<SL)seaGoal=SL;if(seaGoal>=118){toast('The seas can rise no higher.');break;}seaGoal=Math.min(118,seaGoal+6);chron('The heavens open and the seas begin to rise','disaster');break;
    case'ebb':if(seaGoal>SL)seaGoal=SL;if(seaGoal<=82){toast('The seas can fall no lower.');break;}seaGoal=Math.max(82,seaGoal-6);chron('The seas draw back from the shores','disaster');break;
    case'storm':if(ok){storms.push({x:t.x,y:t.y,r:5+brush*1.5,t:0,life:(3+Math.random()*4)*YEAR|0,thunder:true,id:uid++});chron('A great storm gathers'+nearName(t.x,t.y),'disaster',{x:t.x,y:t.y});}break;
    case'inspect':inspect(t.x,t.y);break;
    case'bolt':strike(t.x,t.y);break;
    case'bomb':if(ok)blast(t.x,t.y,4,false);break;
    case'meteor':if(ok)fx({k:'meteor',x:t.x,y:t.y,t:28});break;
    case'tornado':if(ok)twisters.push({x:Math.max(1,Math.min(W-2,t.x)),y:Math.max(1,Math.min(H-2,t.y)),dx:Math.random()<.5?1:-1,dy:0,t:170});break;
    case'volcano':if(t.x>3&&t.y>3&&t.x<W-4&&t.y<H-4)erupt(t.x,t.y);break;
    case'war':stirWar(t.x,t.y);break;
    case'peace':calmRealm(t.x,t.y);break;
  }
}
ovc.addEventListener('pointerdown',e=>{
  e.preventDefault();if(busy)return;
  if(typeof AU!=='undefined')AU.unlock();
  glide=null;if(watching)setWatch(false);
  try{ovc.setPointerCapture(e.pointerId);}catch(_){}
  const p=pos(e);ptrs.set(e.pointerId,p);
  if(view3d){
    if(ptrs.size===1)stroke={lx:p.x,ly:p.y,moved:0,multi:false,paint:false,pan:e.button===2||e.button===1||e.shiftKey};
    else if(ptrs.size===2){if(stroke)stroke.multi=true;const a=[...ptrs.values()];gesture={mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1};}
    return;
  }
  if(ptrs.size===1){
    const painting=(tool.mode==='brush'||tool.mode==='spawn')&&e.button===0;
    stroke={lx:p.x,ly:p.y,moved:0,ltx:null,lty:null,spx:-99,spy:-99,multi:false,paint:painting};
    if(painting){sculptStart();paintAt(p,true);}
  }else if(ptrs.size===2){
    if(stroke)stroke.multi=true;
    const a=[...ptrs.values()];
    gesture={mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1};
  }
});
ovc.addEventListener('pointermove',e=>{
  if(e.pointerType==='mouse')hoverP=pos(e);
  if(!ptrs.has(e.pointerId))return;
  const p=pos(e);ptrs.set(e.pointerId,p);
  if(view3d){
    if(ptrs.size>=2&&gesture){
      const a=[...ptrs.values()],mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2,d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1;
      rel3dZoom(gesture.d/d);rel3dDrag(mx-gesture.mx,my-gesture.my,true);gesture.mx=mx;gesture.my=my;gesture.d=d;return;
    }
    if(stroke&&!stroke.multi){rel3dDrag(p.x-stroke.lx,p.y-stroke.ly,stroke.pan);stroke.lx=p.x;stroke.ly=p.y;}
    return;
  }
  if(ptrs.size>=2&&gesture){
    const a=[...ptrs.values()],mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2,d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1;
    const wx=cam.x+gesture.mx/cam.z,wy=cam.y+gesture.my/cam.z;
    cam.z=clampZ(cam.z*d/gesture.d);cam.x=wx-mx/cam.z;cam.y=wy-my/cam.z;
    gesture.mx=mx;gesture.my=my;gesture.d=d;clampCam();return;
  }
  if(ptrs.size===1&&stroke&&!stroke.multi){
    const dx=p.x-stroke.lx,dy=p.y-stroke.ly;stroke.moved+=Math.abs(dx)+Math.abs(dy);
    if(stroke.paint)paintAt(p,false);
    else{cam.x-=dx/cam.z;cam.y-=dy/cam.z;clampCam();if(stroke.moved>12)follow=null;}
    stroke.lx=p.x;stroke.ly=p.y;
  }
});
function pointerEnd(e){
  if(!ptrs.has(e.pointerId))return;
  const p=ptrs.get(e.pointerId);ptrs.delete(e.pointerId);
  if(ptrs.size<2)gesture=null;
  if(ptrs.size===0){
    if(stroke&&!view3d&&!stroke.multi&&stroke.moved<12&&tool.mode==='tap'&&e.type==='pointerup'&&!busy)tapAt(p);
    stroke=null;
  }
}
ovc.addEventListener('pointerup',pointerEnd);
ovc.addEventListener('pointercancel',pointerEnd);
ovc.addEventListener('contextmenu',e=>e.preventDefault());
ovc.addEventListener('pointerleave',()=>{hoverP=null;});
ovc.addEventListener('wheel',e=>{
  e.preventDefault();
  if(view3d){rel3dZoom(Math.exp(e.deltaY*.0012));return;}
  glide=null;if(watching)setWatch(false);const p=pos(e),wx=cam.x+p.x/cam.z,wy=cam.y+p.y/cam.z;
  cam.z=clampZ(cam.z*Math.exp(-e.deltaY*.0015));cam.x=wx-p.x/cam.z;cam.y=wy-p.y/cam.z;clampCam();
},{passive:false});
let miniDrag=false;
function miniGo(e){const r=mini.getBoundingClientRect();centerOn((e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H);}
mini.addEventListener('pointerdown',e=>{e.preventDefault();try{mini.setPointerCapture(e.pointerId);}catch(_){}miniDrag=true;miniGo(e);});
mini.addEventListener('pointermove',e=>{if(miniDrag)miniGo(e);});
mini.addEventListener('pointerup',()=>{miniDrag=false;});
mini.addEventListener('pointercancel',()=>{miniDrag=false;});

/* ---------- speed and keys ---------- */
let speed=1,busy=true;
function setSpeed(s){
  speed=s;
  for(const b of $('speed').querySelectorAll('button'))b.setAttribute('aria-pressed',String(+b.dataset.s===s));
}
$('speed').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setSpeed(+b.dataset.s);});
$('brush').addEventListener('input',e=>{brush=+e.target.value;$('brushVal').textContent=brush;});
$('strength').addEventListener('input',e=>{sculptStr=+e.target.value;$('strVal').textContent=sculptStr;});
$('reliefIn').addEventListener('input',e=>{V3.relief=+e.target.value/10;$('reliefVal').textContent=(+e.target.value/10).toFixed(1)+'x';});
$('exit3d').addEventListener('click',()=>setView3d(false));
$('seaIn').addEventListener('input',e=>{seaGoal=100+(+e.target.value);$('seaVal').textContent=fmtM((+e.target.value)*60);});
window.addEventListener('keydown',e=>{
  const tg=e.target&&e.target.tagName;if(tg==='TEXTAREA'||tg==='INPUT')return;
  if(e.key===' '){e.preventDefault();setSpeed(speed?0:1);}
  else if(e.key==='1')setSpeed(1);else if(e.key==='2')setSpeed(3);else if(e.key==='3')setSpeed(8);
  else if(e.key==='4')setSpeed(20);
  else if(e.key==='w'||e.key==='W')setWatch(!watching);
  else if(e.key==='v'||e.key==='V')setView3d(!view3d);
  else if(e.key==='t'||e.key==='T'){S.topo=S.topo==='map'?'off':'map';saveSettings();buildTools(false);}
  else if(e.key==='Escape'){closeSheet();if(watching)setWatch(false);if(view3d)setView3d(false);}
});
window.addEventListener('resize',resize);

