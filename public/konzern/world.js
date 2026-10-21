// Gründerzeit: die Stadt als Diorama-Block. Liest den Spielstand, schreibt nichts hinein.
(function(){
'use strict';
const P=10,S=4,COLS=6,ROWS=5,WW=COLS*P+(COLS+1)*S,DD=ROWS*P+(ROWS+1)*S,MARGIN=5,BW=WW+2*MARGIN,BD=DD+2*MARGIN,DEPTH=7;
const px=c=>-WW/2+S+c*(P+S)+P/2,pz=r=>-DD/2+S+r*(P+S)+P/2;
const streetX=i=>-WW/2+S/2+i*(P+S),streetZ=i=>-DD/2+S/2+i*(P+S);
const grow=[],marks=[];let markGeo=null;
let renderer,scene,camera,root,plotGroup,canvas,walkers,cars,ray=new THREE.Raycaster(),sel=null,selRing,hoverRing,cityId=null,sig={},bases=[],G0=null;
const view={yaw:-0.62,tilt:0.98,zoom:1,tx:0,tz:2};
const mats={};
const M=c=>mats[c]||(mats[c]=new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:0.85}));
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t}
function add(geo,m,x,y,z,parent){const o=new THREE.Mesh(geo,typeof m==='string'||typeof m==='number'?M(m):m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;(parent||root).add(o);return o}
function B(w,h,d,m,x,y,z,p){return add(new THREE.BoxGeometry(w,h,d),m,x,y+h/2,z,p)}
function prism(w,h,d){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,h);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);return g}
let seed=7;const rnd=()=>(seed=seed*16807%2147483647,(seed-1)/2147483646);
function label(text,bg,fg,w,h){return new THREE.MeshBasicMaterial({map:canvasTex(256,64,(g,W,H)=>{g.fillStyle=bg;g.fillRect(0,0,W,H);g.fillStyle=fg;let f=40;
  g.font=`700 ${f}px Manrope, system-ui, sans-serif`;while(g.measureText(text).width>W*0.9&&f>14){f-=2;g.font=`700 ${f}px Manrope, system-ui, sans-serif`}g.textAlign='center';g.textBaseline='middle';g.fillText(text,W/2,H/2+2)})})}

function strataTex(len){return canvasTex(Math.round(len*8),128,(g,w,h)=>{
  const L=[[0,'#8d9096'],[.07,'#f1e9d7'],[.25,'#e5d5b2'],[.52,'#d2b98d'],[.78,'#ad8a5d']];
  L.forEach(([y0,c],i)=>{g.fillStyle=c;g.beginPath();g.moveTo(0,h);for(let x=0;x<=w;x+=8)g.lineTo(x,y0*h+(i>1?Math.sin(x*.012+i*2)*3+Math.sin(x*.041+i)*1.5:0));g.lineTo(w,h);g.closePath();g.fill()});
  for(let k=0;k<w*1.1;k++){const x=rnd()*w,y=h*0.1+rnd()*h*0.9,big=y/h>.75&&rnd()<.3;g.fillStyle=big?'rgba(250,244,230,.85)':(rnd()<.5?'rgba(255,250,240,.45)':'rgba(110,85,55,.22)');
    g.beginPath();g.ellipse(x,y,big?2+rnd()*3:0.8+rnd()*1.2,big?1.5+rnd()*2:0.6+rnd()*0.8,0,0,6.3);g.fill()}})}

function init(cv){
  canvas=cv;renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0,0);
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-10,10,10,-10,0.1,500);
  scene.add(new THREE.HemisphereLight(0xffffff,0xcfc6b6,0.8));
  const sun=new THREE.DirectionalLight(0xfffaf0,0.85);sun.position.set(-40,70,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:200});sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.03;scene.add(sun);
  // weicher Schatten unter dem Block
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(BW*1.6,BD*1.6),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,map:canvasTex(256,256,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,w*0.2,w/2,h/2,w/2);r.addColorStop(0,'rgba(36,39,43,.28)');r.addColorStop(1,'rgba(36,39,43,0)');g.fillStyle=r;g.fillRect(0,0,w,h)})}));
  sh.rotation.x=-Math.PI/2;sh.position.y=-DEPTH-0.5;scene.add(sh);
  root=new THREE.Group();scene.add(root);
  // Block mit Erdschichten, Straßen obenauf
  const sx=new THREE.MeshLambertMaterial({map:strataTex(BD)}),sz=new THREE.MeshLambertMaterial({map:strataTex(BW)});
  const top=new THREE.MeshStandardMaterial({color:'#9a9da2',roughness:0.95});
  const blk=new THREE.Mesh(new THREE.BoxGeometry(BW,DEPTH,BD),[sx,sx,top,M('#7d6a4f'),sz,sz]);blk.position.y=-DEPTH/2;blk.receiveShadow=true;root.add(blk);
  // Gehweg-Rand ringsum und Fahrbahnmarkierungen
  const walkM=M('#d9d4c9'),dash=M('#f3f1ea');
  for(const [w,d,x,z] of [[BW,MARGIN+1.2,0,-BD/2+(MARGIN+1.2)/2],[BW,MARGIN+1.2,0,BD/2-(MARGIN+1.2)/2],[MARGIN+1.2,BD,-BW/2+(MARGIN+1.2)/2,0],[MARGIN+1.2,BD,BW/2-(MARGIN+1.2)/2,0]])B(w,0.12,d,walkM,x,0,z);
  for(let i=0;i<=COLS;i++)for(let z=-DD/2;z<DD/2;z+=3)B(0.18,0.02,1.4,dash,streetX(i),0.01,z+0.7);
  for(let i=0;i<=ROWS;i++)for(let x=-WW/2;x<WW/2;x+=3)B(1.4,0.02,0.18,dash,x+0.7,0.01,streetZ(i));
  // Bäume und Laternen am Rand
  for(let i=0;i<34;i++){const side=i%4,t=rnd();let x,z;if(side<2){x=-BW/2+2+t*(BW-4);z=side?BD/2-2.2:-BD/2+2.2}else{z=-BD/2+2+t*(BD-4);x=side===2?-BW/2+2.2:BW/2-2.2}
    add(new THREE.CylinderGeometry(0.12,0.16,1,5),'#6b4a2f',x,0.6,z);add(new THREE.IcosahedronGeometry(0.9+rnd()*0.3,0),['#6fae5a','#5e9e4e','#86be62'][i%3],x,1.7,z)}
  plotGroup=new THREE.Group();root.add(plotGroup);
  const ringGeo=new THREE.RingGeometry(P*0.62,P*0.7,4,1);ringGeo.rotateZ(Math.PI/4);ringGeo.rotateX(-Math.PI/2);
  selRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:'#24272b',transparent:true,opacity:0.85,depthWrite:false}));selRing.visible=false;selRing.renderOrder=5;root.add(selRing);
  hoverRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:'#24272b',transparent:true,opacity:0.25,depthWrite:false}));hoverRing.visible=false;root.add(hoverRing);
  initWalkers();initCars();resize();applyView()}

// ---------- Kamera ----------
function applyView(){view.tilt=Math.min(1.35,Math.max(0.35,view.tilt));view.zoom=Math.min(3.2,Math.max(0.55,view.zoom));
  const d=150,cp=Math.cos(view.tilt);camera.position.set(view.tx+d*Math.sin(view.tilt)*Math.sin(view.yaw),d*cp+20,view.tz+d*Math.sin(view.tilt)*Math.cos(view.yaw));
  camera.lookAt(view.tx,0,view.tz);camera.zoom=view.zoom;camera.updateProjectionMatrix()}
function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;renderer.setSize(w,h,false);
  // Die Stadt soll mitten im freien Bereich liegen: neben dem Pult (Desktop) oder über dem Bottom-Sheet (Handy)
  const mob=w<=760,aspect=w/h,span=mob?BW*0.47/aspect:BD*0.62,tw=2*span*aspect,th=2*span;
  const cx=mob?w/2:w/2,cy=mob?h*0.44:h*0.52;
  camera.left=-cx/w*tw;camera.right=camera.left+tw;camera.top=cy/h*th;camera.bottom=camera.top-th;camera.updateProjectionMatrix()}

// ---------- Grundstücke ----------
const ZCOL={city:'#e6e0d4',wohn:'#a9cf8a',buero:'#d5d7d9',gewerbe:'#d6cbb3'};
function plotSig(G,p){let s=p.owner+'|'+p.use;
  if(p.owner&&!p.owner.startsWith('c:')&&p.owner!=='H'){const f=G.firms.find(x=>x.id===p.owner);if(f){s+='|'+f.color+'|'+f.name;
    if(p.use==='cafe'){const sh=f.shops.find(x=>x.plot===p.id);s+='|'+(sh?sh.level+Object.keys(sh.ups).sort().join(','):0)}
    if(p.use==='office')s+='|'+Object.keys(f.oups||{}).sort().join(',');
    if(p.use==='factory'){const pl=f.plants.find(x=>x.plot===p.id);s+='|'+(pl?pl.lines.map(l=>l.type+(l.auto?'a':'')+l.shifts).join(',')+Object.keys(pl.ups||{}).join(','):'')}}}
  if(p.owner&&p.owner.startsWith('c:')){const cp=G.comps.find(c=>'c:'+c.id===p.owner);s+='|'+(cp?cp.name:'')}
  return s}
function setCity(G,id){if(cityId===id)return;cityId=id;sig={};while(plotGroup.children.length){const c=plotGroup.children.pop();c.traverse(o=>{if(o.geometry)o.geometry.dispose()})}bases=[];sync(G,true)}
function sync(G,force){G0=G;if(!plotGroup)return;
  for(const p of G.plots){if(p.city!==cityId)continue;const s=plotSig(G,p);if(!force&&sig[p.id]===s)continue;sig[p.id]=s;
    const old=plotGroup.children.find(c=>c.userData.pid===p.id);if(old){plotGroup.remove(old);old.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
    const g=new THREE.Group();g.userData.pid=p.id;g.position.set(px(p.c),0,pz(p.r));plotGroup.add(g);buildPlot(G,p,g);
    if(!force&&old)grow.push({g,t:0})}
  bases=[];plotGroup.traverse(o=>{if(o.userData.base)bases.push(o)});
  updateWalkerDensity(G)}
function buildPlot(G,p,g){
  seed=(p.r*31+p.c*7+p.id.length*13)|0||5;
  const base=B(P,0.25,P,ZCOL[p.zone],0,0,0,g);base.userData.base=true;base.userData.pid=p.id;
  const owner=p.owner,own=owner&&!owner.startsWith('c:')&&owner!=='H',comp=owner&&owner.startsWith('c:');
  const f=own?G.firms.find(x=>x.id===owner):null,cp=comp?G.comps.find(c=>'c:'+c.id===owner):null;
  const color=f?f.color:cp?cp.color:'#c9c4b8';
  if(p.use==='cafe')cafe(G,p,g,color,f?f.name:cp?cp.name:'',f?(f.shops.find(x=>x.plot===p.id)||{}).level||1:2,!!f);
  else if(p.use==='office')office(p,g,color,f?f.name:'');
  else if(p.use==='factory')factory(G,p,g,color,f);
  else if(p.use==='hq')tower(g,'#24272b');
  else vacant(p,g)}
function windows(g,w,h,d,x,z,floors,color){for(let k=0;k<floors;k++)B(w*0.84,0.34,0.04,color||'#3d4651',x,1+k*(h/floors)+0.3,z+d/2+0.01,g)}
function vacant(p,g){
  if(p.zone==='gewerbe'){for(let i=-4;i<=4;i+=1)B(0.06,0.9,0.06,'#9a9da2',i,0.25,-4.4,g);B(8.2,0.04,0.04,'#9a9da2',0,1.05,-4.4,g);
    B(2.2,1.2,0.1,'#f2c14e',2.4,0.25,4.2,g);for(let i=0;i<5;i++)add(new THREE.IcosahedronGeometry(0.3+rnd()*0.3,0),'#b9b2a4',-3+rnd()*6,0.35,-2+rnd()*4,g);return}
  const res=p.zone==='wohn';
  if(res){ // Wohnhäuser mit einem leeren Ladenlokal
    for(const [x,z,w,d] of [[-2.6,-2.4,4,4.2],[2.4,-2.6,4.4,3.8],[-2.8,2.6,3.6,3.6]]){const h=3+rnd()*3.5;B(w,h,d,['#f0b8a1','#9fc4e2','#f3d68f','#e9a3ac','#bad9c3','#f6efe3'][Math.floor(rnd()*6)],x,0.25,z,g);
      add(prism(w+0.2,1.2,d+0.2),['#d8644b','#c95540','#6f7f9a'][Math.floor(rnd()*3)],x,0.25+h,z,g).rotation.y=Math.PI/2;windows(g,w,h,d,x,z,Math.floor(h/1.4))}
    B(3.6,2.2,3.4,'#ece8df',2.4,0.25,2.6,g);B(3,0.6,0.08,'#f2c14e',2.4,1.3,4.32,g);return}
  const h=p.zone==='buero'?6+rnd()*5:4+rnd()*3;B(7.6,h,7.6,'#e8e5de',0,0.25,0,g);windows(g,7.6,h,7.6,0,0,Math.floor(h/1.3),'#c8ccd2');
  B(3.4,0.7,0.08,'#f2c14e',0,1.2,3.86,g)}
function cafe(G,p,g,color,name,level,own){
  const wall=own?'#f6efe3':'#ece6da';const h=p.zone==='city'?5.5:3.4;
  B(7.4,h,6,wall,0,0.25,-1.2,g);windows(g,7.4,h,6,0,-1.2,Math.max(1,Math.floor(h/1.6)-1));
  B(7,1.6,0.06,level>=3?'#bcd8e8':'#3d4651',0,0.6,1.82,g); // Schaufenster
  const aw=add(prism(7.6,0.9,1.6),color,0,2.4,2.4,g);aw.rotation.x=-Math.PI/2*0;aw.scale.set(1,0.6,1);
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(4.6,0.9),label(name||'Café',color,'#ffffff'));sg.position.set(0,h+0.05+0.25-0.9,1.84);g.add(sg);
  // Terrasse mit Tischen und Gästen
  const nT=level>=2?4:2;for(let i=0;i<nT;i++){const x=-2.7+i*(5.4/(nT-1||1)),z=3.6;add(new THREE.CylinderGeometry(0.45,0.45,0.06,10),'#f4f1ea',x,0.95,z,g);B(0.08,0.7,0.08,'#2d3436',x,0.25,z,g);
    if(level>=2){add(new THREE.ConeGeometry(1.1,0.5,8),color,x,2.4,z,g);B(0.05,1.6,0.05,'#2d3436',x,0.9,z,g)}}
  if(level>=2)for(const x of [-3.5,3.5])add(new THREE.IcosahedronGeometry(0.55,0),'#6aa957',x,0.9,4.4,g);
  const sh=own&&G.firms.find(f=>f.shops&&f.shops.some(x=>x.plot===p.id));const u=sh?sh.shops.find(x=>x.plot===p.id).ups:{};
  if(u.terrasse){B(9,0.06,2.6,'#c8a27a',0,0.25,3.6,g);if(level<2)for(const x of [-2.7,2.7]){add(new THREE.ConeGeometry(1.1,0.5,8),color,x,2.4,3.6,g);B(0.05,1.6,0.05,'#2d3436',x,0.9,3.6,g)}}
  if(u.roaster){add(new THREE.CylinderGeometry(0.28,0.32,2.4,8),'#8a8f96',2.6,h+1.4,-2.4,g);add(new THREE.CylinderGeometry(0.42,0.42,0.2,8),'#24272b',2.6,h+2.6,-2.4,g)}
  if(u.togo){B(1.4,1.1,0.5,'#f4f1ea',-4.1,0.25,0.6,g);B(1.2,0.5,0.06,color,-4.1,1.0,0.86,g)}
  if(u.delivery){B(0.9,0.5,0.4,'#d63c3c',4.4,0.4,2.6,g);B(0.4,0.4,0.4,'#f4f1ea',4.6,0.9,2.6,g)}
  if(u.kids){add(new THREE.ConeGeometry(0.7,1.1,4),'#f2c14e',-3.7,0.8,-4.2,g);B(0.9,0.9,0.9,'#4fb0c6',-2.6,0.25,-4.2,g)}
  if(u.wlan)B(0.06,1.4,0.06,'#24272b',-3,h+0.95,-3.8,g);
  if(u.solar)for(let i=0;i<3;i++){const m=B(1.6,0.08,1.2,'#2f3e55',-2.4+i*2,h+0.3,-2.6,g);m.rotation.x=-0.3}
  if(u.lounge)for(const x of [-2,0,2])B(1.2,0.5,0.6,'#9b6fb5',x,0.25,1.4,g);
  if(u.vitrine)B(1.6,0.8,0.5,'#cfe3ec',2.6,0.25,1.4,g)}
function office(p,g,color,name){const floors=Math.max(3,Math.min(8,Math.floor(p.size/80)));const h=floors*1.3;
  B(8,h,7.2,'#dfe6ec',0,0.25,0,g);for(let k=0;k<floors;k++)B(8.06,0.18,7.26,'#f4f1ea',0,0.25+k*1.3+1.15,0,g);
  B(8.1,0.5,7.3,color,0,0.25+h,0,g);const sg=new THREE.Mesh(new THREE.PlaneGeometry(5,0.9),label(name,color,'#ffffff'));sg.position.set(0,1.1,3.62);g.add(sg);
  const f=G0&&G0.firms.find(x=>x.office===p.id),u=f?f.oups||{}:{};
  if(u.gaming)B(1.6,1.2,1.6,'#9b6fb5',-3,0.75+h,-2.4,g);if(u.kitchen)add(new THREE.IcosahedronGeometry(0.7,0),'#6aa957',3,h+1.3,-2.4,g);
  if(u.hardware)for(let i=0;i<3;i++)B(0.8,0.6,0.8,'#8a8f96',-1+i*1.1,h+0.75,2.2,g);if(u.quiet)B(2.4,0.9,2.4,'#bcd8e8',2.4,h+0.75,1.6,g)}
function factory(G,p,g,color,f){
  const lines=f?((f.plants.find(x=>x.plot===p.id)||{}).lines||[]):[{type:'moebel'}];
  B(8.6,3.2,6,'#d8d6d0',0,0.25,-1.4,g);for(let i=0;i<4;i++){const r=add(prism(2.15,1.1,6),'#9da3a8',-3.22+i*2.15,3.45,-1.4,g);r.rotation.y=0}
  B(8.62,0.5,6.02,color,0,2.3,-1.4,g);
  lines.forEach((l,i)=>{const x=-3+i*2.2;if(l.type==='roest'){add(new THREE.CylinderGeometry(0.35,0.4,5.5,8),'#8a8f96',x,3,-3.6,g)}
    else if(l.type==='back'){add(new THREE.CylinderGeometry(0.6,0.6,2.4,10),'#e9e4d8',x,1.45,2.6,g)}else B(1.6,1.2,1.2,'#b07a46',x,0.25,2.7,g)});
  B(2.4,1.2,1.1,'#f4f1ea',2.6,0.25,3.4,g);B(1,1.1,1.1,color,1.0,0.25,3.4,g); // Lieferwagen am Tor
  const pl=f&&f.plants.find(x=>x.plot===p.id),u=pl?pl.ups||{}:{};
  if(u.solar)for(let i=0;i<4;i++){const m=B(1.8,0.08,4.8,'#2f3e55',-3.22+i*2.15,4.1,-1.4,g)}
  if(u.lager){B(3.2,2.2,2.8,'#cfc8b9',-2.6,0.25,2.9,g);B(3.24,0.3,2.84,color,-2.6,2.25,2.9,g)}
  if(u.kantine){B(1.8,1.4,1.6,'#f6efe3',4.2,0.25,-4.2,g);add(new THREE.IcosahedronGeometry(0.5,0),'#6aa957',3,0.8,-4.4,g)}
  if(pl)pl.lines.forEach((l,i)=>{if(l.auto)B(0.5,1.6,0.5,'#f2c14e',-3+i*2.2+0.9,0.25,2.7,g);if(l.shifts>1)for(let k=0;k<l.shifts;k++)B(0.3,0.3,0.06,'#fff3c4',-3.6+i*2.2+k*0.5,2.0,1.62,g)})}
function tower(g,color){const floors=14;for(let k=0;k<floors;k++)B(7-k*0.12,1.2,7-k*0.12,k%2?'#cfd8e0':'#e8edf1',0,0.25+k*1.2,0,g);B(5.3,0.8,5.3,color,0,0.25+floors*1.2,0,g);
  add(new THREE.CylinderGeometry(0.06,0.06,3,4),'#24272b',0,0.25+floors*1.2+2.3,0,g)}

// ---------- Passanten und Autos ----------
const WMAX=420;let wInst,wData=[],wCount=0,cInst,cData=[];
function initWalkers(){const geo=new THREE.CylinderGeometry(0.18,0.22,0.9,6);geo.translate(0,0.45,0);
  wInst=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.9}),WMAX);wInst.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(WMAX*3),3);
  wInst.castShadow=true;root.add(wInst);const cols=['#e8604c','#f0b23a','#4fb0c6','#24272b','#e57fb0','#7cc56b','#9b6fb5','#f4f1ea','#3d78d8'].map(c=>new THREE.Color(c));
  for(let i=0;i<WMAX;i++){wInst.setColorAt(i,cols[i%cols.length]);wData.push(newWalker())}}
function newWalker(){const horiz=rnd()<0.5,line=horiz?Math.floor(rnd()*(ROWS+1)):Math.floor(rnd()*(COLS+1)),side=rnd()<0.5?-1.55:1.55;
  return{horiz,line,side,t:rnd(),dir:rnd()<0.5?1:-1,v:0.012+rnd()*0.01}}
function updateWalkerDensity(G){const t=G.plots.filter(p=>p.city===cityId).reduce((s,p)=>s+p.traffic,0);wCount=Math.min(WMAX,Math.round(t/260))}
function initCars(){const geo=new THREE.BoxGeometry(1.6,0.7,0.8);geo.translate(0,0.45,0);cInst=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.6}),24);
  cInst.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(24*3),3);cInst.castShadow=true;root.add(cInst);
  const cols=['#f4f1ea','#d63c3c','#3d78d8','#24272b','#f2c14e','#9da3a8'].map(c=>new THREE.Color(c));
  for(let i=0;i<24;i++){cInst.setColorAt(i,cols[i%cols.length]);cData.push({horiz:i%2===0,line:i%(i%2?COLS+1:ROWS+1),t:rnd(),dir:i%4<2?1:-1,v:0.03+rnd()*0.02})}}
const O=new THREE.Object3D();
function moveOnGrid(o,dt,lane){ // läuft entlang einer Straße und biegt an Kreuzungen manchmal ab
  const L=o.horiz?WW:DD,prev=o.t*L-L/2;o.t+=o.v*o.dir*dt/L*60;if(o.t>1){o.t=1;o.dir=-1}if(o.t<0){o.t=0;o.dir=1}
  const cur=o.t*L-L/2,n=o.horiz?COLS:ROWS,sf=o.horiz?streetX:streetZ;
  for(let i=0;i<=n;i++){const s=sf(i);if((prev-s)*(cur-s)<0&&rnd()<0.3){const fixed=o.horiz?streetZ(o.line):streetX(o.line);o.horiz=!o.horiz;o.line=i;const L2=o.horiz?WW:DD;o.t=(fixed+L2/2)/L2;o.dir=rnd()<0.5?1:-1;break}}
  const a=o.t*(o.horiz?WW:DD)-(o.horiz?WW:DD)/2;return o.horiz?[a,streetZ(o.line)+lane]:[streetX(o.line)+lane,a]}
function animate(dt){
  for(let i=0;i<WMAX;i++){if(i>=wCount){O.position.set(0,-50,0);O.scale.setScalar(0.001);O.updateMatrix();wInst.setMatrixAt(i,O.matrix);continue}
    const w=wData[i];const [x,z]=moveOnGrid(w,dt*0.05,w.side);O.position.set(x,0.12+Math.abs(Math.sin(performance.now()/180+i))*0.05,z);O.scale.setScalar(1);O.rotation.set(0,0,0);O.updateMatrix();wInst.setMatrixAt(i,O.matrix)}
  wInst.instanceMatrix.needsUpdate=true;
  for(let i=0;i<cData.length;i++){const c=cData[i];const [x,z]=moveOnGrid(c,dt*0.07,(c.dir>0?0.55:-0.55));O.position.set(x,0,z);O.rotation.set(0,c.horiz?0:Math.PI/2,0);O.scale.setScalar(1);O.updateMatrix();cInst.setMatrixAt(i,O.matrix)}
  cInst.instanceMatrix.needsUpdate=true}

// ---------- Auswahl und Interaktion ----------
function plotAt(cx,cy){const r=canvas.getBoundingClientRect();const v=new THREE.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);ray.setFromCamera(v,camera);
  const hit=ray.intersectObjects(plotGroup.children,true)[0];if(!hit)return null;let o=hit.object;while(o&&!o.userData.pid)o=o.parent;return o?o.userData.pid:null}
function select(pid){sel=pid;const g=pid&&plotGroup.children.find(c=>c.userData.pid===pid);selRing.visible=!!g;if(g){selRing.position.set(g.position.x,0.3,g.position.z)}}
function hover(pid){const g=pid&&plotGroup.children.find(c=>c.userData.pid===pid);hoverRing.visible=!!g&&pid!==sel;if(g)hoverRing.position.set(g.position.x,0.29,g.position.z)}
function project(pid,y){const g=plotGroup.children.find(c=>c.userData.pid===pid);if(!g)return null;const v=new THREE.Vector3(g.position.x,y||7,g.position.z).project(camera);
  const r=canvas.getBoundingClientRect();return{x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height,vis:v.z<1}}
function highlight(list,color){for(const m of marks){root.remove(m)}marks.length=0;if(!list||!list.length)return;
  if(!markGeo){markGeo=new THREE.PlaneGeometry(P*0.96,P*0.96);markGeo.rotateX(-Math.PI/2)}
  for(const pid of list){const g=plotGroup.children.find(c=>c.userData.pid===pid);if(!g)continue;
    const m=new THREE.Mesh(markGeo,new THREE.MeshBasicMaterial({color:color||'#3f9b62',transparent:true,opacity:0.45,depthWrite:false}));m.position.set(g.position.x,0.27,g.position.z);m.renderOrder=4;root.add(m);marks.push(m)}}
let last=0;function frame(t){const dt=Math.min(0.05,(t-last)/1000||0.016);last=t;animate(dt*60);
  for(let i=grow.length-1;i>=0;i--){const a=grow[i];a.t+=dt/0.7;const k=Math.min(1,a.t),e=1+Math.sin(k*Math.PI)*0.18*(1-k)+(k<1?-(1-k)*(1-k):0);a.g.scale.set(1,Math.max(0.02,k<1?k*k*(3-2*k)*(1+0.15*Math.sin(k*Math.PI)):1),1);if(k>=1){a.g.scale.set(1,1,1);grow.splice(i,1)}}
  for(const m of marks)m.material.opacity=0.3+0.2*Math.sin(t/260);
  if(selRing.visible)selRing.material.opacity=0.6+0.3*Math.sin(t/300);renderer.render(scene,camera)}
window.World={init,resize,setCity,sync,select,hover,plotAt,project,frame,view,applyView,highlight,get city(){return cityId}};
})();
