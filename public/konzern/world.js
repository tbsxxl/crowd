// Gründerzeit: die Stadt als Diorama-Block. Liest den Spielstand, schreibt nichts hinein.
(function(){
'use strict';
const P=10,S=4,COLS=6,ROWS=5,WW=COLS*P+(COLS+1)*S,DD=ROWS*P+(ROWS+1)*S,MARGIN=5,BW=WW+2*MARGIN,BD=DD+2*MARGIN,DEPTH=7;
const px=c=>-WW/2+S+c*(P+S)+P/2,pz=r=>-DD/2+S+r*(P+S)+P/2;
const streetX=i=>-WW/2+S/2+i*(P+S),streetZ=i=>-DD/2+S/2+i*(P+S);
const grow=[],marks=[];let markGeo=null;
let renderer,scene,camera,root,plotGroup,canvas,walkers,cars,ray=new THREE.Raycaster(),sel=null,selRing,hoverRing,cityId=null,sig={},bases=[],G0=null;
const view={yaw:-0.62,tilt:0.98,zoom:1,tx:0,tz:-7};
const mats={};
const M=c=>mats[c]||(mats[c]=new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:0.85}));
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t}
function add(geo,m,x,y,z,parent){const o=new THREE.Mesh(geo,typeof m==='string'||typeof m==='number'?M(m):m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;(parent||root).add(o);return o}
function B(w,h,d,m,x,y,z,p){return add(new THREE.BoxGeometry(w,h,d),m,x,y+h/2,z,p)}
function prism(w,h,d){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,h);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);return g}
let seed=7;const rnd=()=>(seed=seed*16807%2147483647,(seed-1)/2147483646);
let logoImg=null;
function label(text,bg,fg,img){return new THREE.MeshBasicMaterial({map:canvasTex(256,64,(g,W,H)=>{g.fillStyle=bg;g.fillRect(0,0,W,H);g.fillStyle=fg;let f=40;const off=img?50:0;
  if(img){g.fillStyle='#ffffff';g.beginPath();g.arc(30,32,25,0,7);g.fill();g.drawImage(img,8,10,44,44);g.fillStyle=fg}
  g.font=`700 ${f}px Manrope, system-ui, sans-serif`;while(g.measureText(text).width>(W-off)*0.9&&f>14){f-=2;g.font=`700 ${f}px Manrope, system-ui, sans-serif`}g.textAlign='center';g.textBaseline='middle';g.fillText(text,off+(W-off)/2,H/2+2)})})}

function strataTex(len){return canvasTex(Math.round(len*8),128,(g,w,h)=>{
  const L=[[0,'#8d9096'],[.07,'#f1e9d7'],[.25,'#e5d5b2'],[.52,'#d2b98d'],[.78,'#ad8a5d']];
  L.forEach(([y0,c],i)=>{g.fillStyle=c;g.beginPath();g.moveTo(0,h);for(let x=0;x<=w;x+=8)g.lineTo(x,y0*h+(i>1?Math.sin(x*.012+i*2)*3+Math.sin(x*.041+i)*1.5:0));g.lineTo(w,h);g.closePath();g.fill()});
  for(let k=0;k<w*1.1;k++){const x=rnd()*w,y=h*0.1+rnd()*h*0.9,big=y/h>.75&&rnd()<.3;g.fillStyle=big?'rgba(250,244,230,.85)':(rnd()<.5?'rgba(255,250,240,.45)':'rgba(110,85,55,.22)');
    g.beginPath();g.ellipse(x,y,big?2+rnd()*3:0.8+rnd()*1.2,big?1.5+rnd()*2:0.6+rnd()*0.8,0,0,6.3);g.fill()}})}

// Hausfarben je Stadt: Emden Backstein, Hamburg Backstein und Weiß, Berlin Putz in Pastell
const CITY_STYLE={kiel:{house:['#a6472f','#b8553a','#8e3b2a','#c46a4a','#f2ece0','#9a4430'],roof:['#5a3b30','#3d4651','#6b3a2c'],office:['#c9a58f','#e8e5de','#b8553a']},
  hamburg:{house:['#9a4a35','#f4f1ea','#e8e2d6','#b05a40','#dfe6ec'],roof:['#3d4651','#5f8f7a','#6f7f9a'],office:['#dfe6ec','#e8e5de','#9a4a35']},
  berlin:{house:['#f0b8a1','#9fc4e2','#f3d68f','#e9a3ac','#bad9c3','#f6efe3'],roof:['#d8644b','#c95540','#6f7f9a'],office:['#dfe6ec','#e8e5de','#d3dbe2']}};
// ---------- Wahrzeichen: ein Uferstreifen hinter der Stadt, je Stadt eigene, frei nachempfundene Modelle ----------
const LD=26,LZ=-DD/2-MARGIN-LD/2; // Tiefe und Mitte des Streifens
let landGroup=null;const landAnim=[];
function cyl(rt,rb,h,col,x,y,z,g,seg){return add(new THREE.CylinderGeometry(rt,rb,h,seg||10),col,x,y+h/2,z,g)}
function water(g,z0,z1,col){const m=new THREE.Mesh(new THREE.BoxGeometry(BW,0.3,z1-z0),new THREE.MeshStandardMaterial({color:col||'#5f9fc4',roughness:0.25,metalness:0.1}));m.position.set(0,-0.07,(z0+z1)/2);m.receiveShadow=true;g.add(m);
  for(let i=0;i<26;i++){const w=B(1.2+Math.random()*1.6,0.03,0.08,'#cfe6f2',-BW/2+3+Math.random()*(BW-6),0.08,z0+1+Math.random()*(z1-z0-2),g);w.castShadow=false}
  B(BW,0.5,0.6,'#b9b2a4',0,-0.25,z0-0.3,g);B(BW,0.5,0.6,'#b9b2a4',0,-0.25,z1+0.3,g)}
function ground(g,z0,z1,col){B(BW,0.06,z1-z0,col,0,0,(z0+z1)/2,g)}
function trees(g,n,x0,x1,z0,z1){for(let i=0;i<n;i++){const x=x0+Math.random()*(x1-x0),z=z0+Math.random()*(z1-z0);cyl(0.12,0.16,1,'#6b4a2f',x,0,z,g,5);add(new THREE.IcosahedronGeometry(0.8+Math.random()*0.4,0),['#6fae5a','#5e9e4e','#86be62'][i%3],x,1.7,z,g)}}
function gableHouse(g,x,z,w,h,col,stepped){B(w,h,3,col,x,0,z,g);
  if(stepped){for(let k=0;k<4;k++)B(w*(1-k*0.22),0.6,0.3,col,x,h+k*0.6,z+1.55,g);add(prism(w,2.4,3),'#5a3b30',x,h,z,g)}else add(prism(w,2.2,3.1),'#3d4651',x,h,z,g);
  for(let k=0;k<Math.floor(h/1.3);k++)B(w*0.5,0.5,0.05,'#f4f1ea',x,0.6+k*1.3,z+1.52,g)}
function boat(g,x,z,col,len,anim){const b=new THREE.Group();g.add(b);b.position.set(x,0,z);
  B(len,0.9,1.8,col,0,-0.3,0,b);B(len*0.45,0.9,1.3,'#f4f1ea',-len*0.1,0.6,0,b);B(0.15,3,0.15,'#24272b',len*0.2,0.6,0,b);
  if(anim)landAnim.push(t=>{b.position.y=Math.sin(t/900+x)*0.08;b.rotation.z=Math.sin(t/1300+x)*0.02});return b}
function windmill(g,x,z){cyl(1.0,1.6,6,'#4a4f55',x,0,z,g,8);add(new THREE.ConeGeometry(1.2,1.4,8),'#2f3439',x,6.7,z,g);B(3.6,0.3,3.6,'#5a3b30',x,2.2,z,g);
  const hub=new THREE.Group();hub.position.set(x,6.2,z+1.3);g.add(hub);for(let i=0;i<4;i++){const arm=new THREE.Group();arm.rotation.z=i*Math.PI/2;hub.add(arm);B(0.25,4.6,0.08,'#e9e4d8',0,0,0,arm);B(0.9,3.4,0.04,'#c9c2b2',0.55,0.9,0,arm)}
  landAnim.push(t=>{hub.rotation.z=t/1400+x})}
function crane(g,x,z,col){B(0.5,9,0.5,col,x-1,0,z-1,g);B(0.5,9,0.5,col,x+1,0,z-1,g);B(0.5,9,0.5,col,x-1,0,z+1,g);B(0.5,9,0.5,col,x+1,0,z+1,g);B(2.6,1.4,2.6,col,x,9,z,g);B(0.5,0.5,11,col,x,10.4,z+3.5,g);B(1.4,1,1.4,'#24272b',x,9.4,z-1.5,g)}
function container(g,x,z,len){B(len,1.4,4,'#3d4651',x,-0.2,z,g);B(len*0.18,3,3.4,'#f4f1ea',x-len*0.4,1.2,z,g);const cols=['#cc3b33','#2f6fd0','#d4a72c','#3f9b62','#e07a2a','#9b6fb5'];
  for(let i=0;i<Math.floor(len*0.7/1.6);i++)for(let k=0;k<2;k++)B(1.5,0.9,1.6,cols[(i*3+k)%6],x-len*0.25+i*1.6,1.2+k*0.9,z-0.9+((i+k)%2)*1.8,g)}
const LANDMARKS={
  kiel:{n:'Emden',ground:'#c9d7b4',build(g){ // Hafen am Ratsdelft, Backsteinrathaus mit Turm, Mühlen auf dem Wall, Giebelhäuser
    water(g,LZ-3,LZ+5,'#5c9cbf');
    boat(g,-18,LZ+1.5,'#c8363b',9,true);B(0.5,2.4,0.5,'#c8363b',-16,0.6,LZ+1.5,g);B(0.9,0.6,0.9,'#f2c14e',-16,3,LZ+1.5,g); // Feuerschiff
    const sail=boat(g,12,LZ+0.5,'#6b4a2f',8,true);B(0.15,6,0.15,'#3b2a20',-1,0.6,0,sail);B(2.6,3.2,0.05,'#f4efe2',-1,2.4,0.1,sail);
    // Speicher und Kontorhäuser am Delft
    for(let i=0;i<3;i++){const x=-8+i*6;B(5.2,5+i%2,5,i%2?'#8e3b2a':'#a6472f',x,0,LZ+9,g);add(prism(5.4,2,5.2),'#3d4651',x,5+i%2,LZ+9,g);for(let k=0;k<2;k++)B(0.9,1.1,0.05,'#f4f1ea',x-1.2+k*2.4,1.5,LZ+11.52,g)}
    // Giebelhäuser am anderen Ufer
    ['#a6472f','#b8553a','#8e3b2a','#c46a4a','#f2ece0','#a6472f','#b8553a'].forEach((c,i)=>gableHouse(g,-40+i*4.2,LZ-7,3.8,4+(i%3)*1.2,c,i%2===0));
    // Wall mit Mühlen und Bäumen
    B(26,1.2,8,'#7fae6a',30,0,LZ-7,g);windmill(g,24,LZ-7);windmill(g,36,LZ-8);trees(g,9,18,44,LZ-11,LZ-4);
    // Backsteinkirche
    B(9,6,5,'#9a4430',8,0,LZ-8,g);add(prism(9.2,3.5,5.2),'#5a3b30',8,6,LZ-8,g);B(2.6,11,2.6,'#9a4430',3.5,0,LZ-8,g);add(new THREE.ConeGeometry(1.9,4,4),'#5f9e8a',3.5,13,LZ-8,g).rotation.y=Math.PI/4;
    trees(g,6,-46,46,LZ+7,LZ+12)}},
  hamburg:{n:'Hamburg',ground:'#cfcac0',build(g){ // Elbe mit Containerschiff und Kränen, Konzerthaus auf dem Speicher, Kirchturm, Speicherstadt
    water(g,LZ-6,LZ+4,'#6f93a8');container(g,-6,LZ-1,22);boat(g,26,LZ+1.8,'#f4f1ea',6,true);
    for(let i=0;i<4;i++)crane(g,-38+i*7,LZ-10,i%2?'#cc3b33':'#2f6fd0');
    // Konzerthaus: Backsteinsockel, Glasaufbau mit Wellendach
    B(14,5,7,'#9a4a35',22,0,LZ-9,g);const glass=new THREE.MeshStandardMaterial({color:'#bcd8e8',roughness:0.1,metalness:0.4});
    B(14,6,7,glass,22,5,LZ-9,g);for(let i=0;i<4;i++){const w=add(new THREE.CylinderGeometry(1.9,1.9,7,12,1,false,0,Math.PI),'#e8eef2',16.8+i*3.5,11,LZ-9,g);w.rotation.x=Math.PI/2;w.rotation.y=Math.PI/2;w.scale.set(1,1,0.55+0.3*(i%2))}
    // Speicherstadt am Fleet
    for(let i=0;i<4;i++){const x=-30+i*7;B(6,6.5,5,'#9a4a35',x,0,LZ+9,g);add(prism(6.2,1.8,5.2),'#5f8f7a',x,6.5,LZ+9,g);for(let k=0;k<3;k++)B(0.8,0.9,0.05,'#f4f1ea',x-1.8+k*1.8,2+k*0,LZ+11.55,g)}
    // Kirchturm mit grünem Helm
    B(4,14,4,'#9a4a35',8,0,LZ+9,g);B(4.4,0.8,4.4,'#e8e3d6',8,14,LZ+9,g);cyl(1.4,1.9,3,'#5f9e8a',8,14.8,LZ+9,g,8);cyl(0.5,1.2,2.4,'#5f9e8a',8,17.8,LZ+9,g,8);add(new THREE.ConeGeometry(0.5,3.2,8),'#5f9e8a',8,21.8,LZ+9,g);
    trees(g,7,30,46,LZ+7,LZ+12)}},
  berlin:{n:'Berlin',ground:'#d2d6c4',build(g){ // Spree mit Ausflugsschiff, Fernsehturm, Stadttor mit Säulen, Parlament mit Glaskuppel
    water(g,LZ-1,LZ+4,'#6d9bb8');boat(g,-10,LZ+1.5,'#f4f1ea',7,true);
    // Dom mit Kuppeln an der Spree
    B(12,7,8,'#9a958a',10,0,LZ-7,g);add(new THREE.SphereGeometry(3.4,16,10,0,Math.PI*2,0,Math.PI/2),'#4f8a78',10,7,LZ-7,g);cyl(0.5,0.8,1.6,'#4f8a78',10,10.2,LZ-7,g,8);
    for(const dx of [-5,5])for(const dz of [-3,3]){B(2,9,2,'#9a958a',10+dx,0,LZ-7+dz,g);add(new THREE.SphereGeometry(1,10,8,0,Math.PI*2,0,Math.PI/2),'#4f8a78',10+dx,9,LZ-7+dz,g)}
    // Stadttor mit Säulen
    B(16,1.2,4,'#e2d6b8',-28,0,LZ+9,g);for(let i=0;i<6;i++)cyl(0.45,0.5,6,'#e9dfc4',-34.5+i*2.6,1.2,LZ+9,g,8);B(16,1.8,4,'#e2d6b8',-28,7.2,LZ+9,g);B(5,1.2,2,'#e2d6b8',-28,9,LZ+9,g);B(1.8,1.6,1,'#5f8f7a',-28,10.2,LZ+9,g);
    for(const dx of [-10.5,10.5])B(4,6,4,'#e2d6b8',-28+dx,0,LZ+9,g);
    // Parlament mit Kuppel
    B(18,6,9,'#ddd2b6',-28,0,LZ-8,g);for(const dx of [-8,8])for(const dz of [-3.5,3.5])B(3,8,3,'#d4c8aa',-28+dx,0,LZ-8+dz,g);
    const dome=add(new THREE.SphereGeometry(3.4,16,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#cfe3ec',metalness:0.4,roughness:0.15,transparent:true,opacity:0.85}),-28,6,LZ-8,g);
    trees(g,10,26,46,LZ-12,LZ-3);trees(g,6,-12,4,LZ+7,LZ+12)}}};
// ---------- Besondere Felder im Stadtraster: Wahrzeichen, Parks, Wasser ----------
const MAP_CITY={kiel:{top:'#a39a92',park:'#8fbf73'},hamburg:{top:'#8e959b',park:'#7fb37a'},berlin:{top:'#a3a5a2',park:'#93c27a'}};
let topMat=null;
function special(code,id,r,c,g){seed=(r*17+c*5+id.length*11)|0||3;
  if(code==='P'){B(P,0.3,P,(MAP_CITY[id]||MAP_CITY.kiel).park,0,0,0,g);B(P,0.04,1.1,'#e2d6b8',0,0.3,0,g);B(1.1,0.04,P,'#e2d6b8',0,0.3,0,g);
    if((r+c)%2){const pond=add(new THREE.CylinderGeometry(2.1,2.1,0.1,18),new THREE.MeshStandardMaterial({color:'#6fa8c8',roughness:0.2}),2.6,0.32,-2.6,g)}else{cyl(0.9,1.1,0.5,'#d9d2c4',2.6,0.3,-2.6,g);cyl(0.15,0.2,1.2,'#d9d2c4',2.6,0.8,-2.6,g)}
    if(id==='berlin'&&r===0&&c===1){cyl(0.4,0.6,6.5,'#d9cfb0',0,0.3,0,g);add(new THREE.SphereGeometry(0.5,8,6),'#d4a72c',0,7.2,0,g);add(new THREE.ConeGeometry(0.6,1.2,4),'#d4a72c',0,7.8,0,g)}
    for(let i=0;i<9;i++){const x=-4+rnd()*8,z=-4+rnd()*8;if(Math.abs(x)<1||Math.abs(z)<1||(x>0.3&&z<-0.3&&x<5&&z>-5&&Math.hypot(x-2.6,z+2.6)<2.6))continue;cyl(0.12,0.16,1,'#6b4a2f',x,0.3,z,g,5);add(new THREE.IcosahedronGeometry(0.8+rnd()*0.5,0),['#6fae5a','#5e9e4e','#86be62'][i%3],x,1.9,z,g)}
    for(const [x,z] of [[-1.6,1.6],[1.6,-1.6]])B(1.2,0.35,0.4,'#7a5a3a',x,0.3,z,g);return}
  if(code==='A'){const wm=new THREE.Mesh(new THREE.BoxGeometry(P+S,0.2,P+S),new THREE.MeshStandardMaterial({color:id==='hamburg'?'#6f9fbf':'#5c9cbf',roughness:0.2,metalness:0.1}));wm.position.set(0,-0.05,0);g.add(wm);
    for(let i=0;i<5;i++)B(1+Math.random()*1.4,0.03,0.08,'#cfe6f2',-4+Math.random()*8,0.08,-4+Math.random()*8,g);
    for(const [x,z,w,d] of [[0,-(P+S)/2,P+S,0.4],[0,(P+S)/2,P+S,0.4]])B(w,0.45,d,'#b9b2a4',x,-0.1,z,g);
    if(id==='hamburg'){const b=boat(g,0,0,'#f4f1ea',3.2,true);B(0.1,3.4,0.1,'#24272b',0,0.4,0,b);B(1.4,2.4,0.04,'#ffffff',0.4,1,0.05,b);if(r===1)cyl(0.25,0.3,3.2,'#f4f1ea',2.5,0,-2.5,g,8)}else{const b=boat(g,0,1,'#2f6fd0',4,true)}return}
  if(code==='L'){B(P,0.3,P,'#d9d2c4',0,0,0,g);
    if(id==='kiel'){ // Backsteinrathaus mit Turm und grünem Helm
      B(8.4,4.6,5,'#a6472f',0,0.3,-0.8,g);for(let i=0;i<4;i++)B(1.6,1,0.3,'#a6472f',-3+i*2,4.9,1.6,g);add(prism(8.6,2.4,5.2),'#5a3b30',0,4.9,-0.8,g);
      for(let k=0;k<2;k++)for(let i=0;i<5;i++)B(0.8,1.1,0.05,'#f4f1ea',-3.2+i*1.6,1.1+k*1.8,1.72,g);
      B(2.4,8.2,2.4,'#a6472f',0,0.3,-0.8,g);B(2.6,0.7,2.6,'#f4f1ea',0,8.5,-0.8,g);cyl(0.9,1.2,1.6,'#5f9e8a',0,9.2,-0.8,g,8);cyl(0.25,0.9,1.3,'#5f9e8a',0,10.8,-0.8,g,8);add(new THREE.ConeGeometry(0.25,1.8,8),'#5f9e8a',0,13,-0.8,g);
      for(const x of [-3.5,3.5])add(new THREE.IcosahedronGeometry(0.7,0),'#6fae5a',x,1.2,3.5,g)}
    if(id==='hamburg'){ // Sandstein-Rathaus mit grünem Dach und Mittelturm
      B(9,5,5.6,'#cdbb94',0,0.3,-0.6,g);add(prism(9.2,2.2,5.8),'#5f9e8a',0,5.3,-0.6,g);for(let k=0;k<2;k++)for(let i=0;i<6;i++)B(0.7,1.3,0.05,'#3d4651',-3.6+i*1.45,1.2+k*2,2.22,g);
      B(2.2,10,2.2,'#cdbb94',0,0.3,-0.6,g);cyl(0.6,1.2,2.6,'#5f9e8a',0,10.3,-0.6,g,8);add(new THREE.ConeGeometry(0.4,2.6,8),'#5f9e8a',0,14.2,-0.6,g);
      for(let i=0;i<5;i++)B(0.5,0.6,0.5,'#d4a72c',-3.6+i*1.8,5.3,2,g)}
    if(id==='berlin'){ // Fernsehturm mit Pavillon
      B(7,1.4,7,'#e8e5de',0,0.3,0,g);for(let i=0;i<4;i++){const t=add(prism(3.4,1.2,1.4),'#f4f1ea',-2.2+(i%2)*4.4,1.7,-2.2+Math.floor(i/2)*4.4,g)}
      cyl(0.55,0.95,15,'#d9dcdf',0,0.3,0,g,12);add(new THREE.SphereGeometry(2.1,16,12),new THREE.MeshStandardMaterial({color:'#c9ced4',metalness:0.5,roughness:0.3}),0,16.6,0,g);
      cyl(1,1,0.5,'#8a8f96',0,18.4,0,g,12);cyl(0.25,0.36,3,'#e05a3a',0,18.9,0,g,8);cyl(0.14,0.25,2.2,'#f4f1ea',0,21.9,0,g,6)}}}
// Lücken zwischen Feldern desselben Blocks füllen: Platz, Park oder Wasser. Autos meiden diese Flächen.
const gaps=[];
const PLAZA={kiel:'#cdb8a4',hamburg:'#c9cdd0',berlin:'#d3cdbf'};
function fillGaps(G){gaps.length=0;const map=K.CITY_MAP[cityId],bl=K.CITY_BLOCKS&&K.CITY_BLOCKS[cityId];if(!map||!bl)return;
  const g=new THREE.Group();g.userData.cell='gaps';plotGroup.add(g);
  const kind=(a,b)=>a==='A'&&b==='A'?'A':a==='P'&&b==='P'?'P':'Z';
  const col=k=>k==='A'?'#5c9cbf':k==='P'?(MAP_CITY[cityId]||MAP_CITY.kiel).park:PLAZA[cityId]||'#d0c8bc';
  const put=(x,z,w,d,k)=>{const m=B(w,k==='A'?0.1:0.16,d,col(k),x,k==='A'?-0.02:0,z,g);gaps.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,k});
    if(k==='Z'&&w*d>14){for(let i=0;i<2;i++){const tx=x+(i?1:-1)*w*0.25,tz=z+(i?-1:1)*d*0.25;cyl(0.1,0.14,0.9,'#6b4a2f',tx,0.16,tz,g,5);add(new THREE.IcosahedronGeometry(0.7,0),'#6fae5a',tx,1.6,tz,g)}B(1.2,0.35,0.4,'#7a5a3a',x,0.16,z,g)}
    if(k==='P'){cyl(0.12,0.16,1,'#6b4a2f',x,0.16,z,g,5);add(new THREE.IcosahedronGeometry(0.9,0),'#5e9e4e',x,1.8,z,g)}};
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const id=bl[r][c];
    if(c<COLS-1&&bl[r][c+1]===id)put((px(c)+px(c+1))/2,pz(r),S+0.2,P,kind(map[r][c],map[r][c+1]));
    if(r<ROWS-1&&bl[r+1][c]===id)put(px(c),(pz(r)+pz(r+1))/2,P,S+0.2,kind(map[r][c],map[r+1][c]));
    if(c<COLS-1&&r<ROWS-1&&bl[r][c+1]===id&&bl[r+1][c]===id&&bl[r+1][c+1]===id)put((px(c)+px(c+1))/2,(pz(r)+pz(r+1))/2,S+0.2,S+0.2,kind(map[r][c],map[r+1][c+1]));
    if(r===0&&map[r][c]==='A'){const z1=pz(0)-P/2,z0=-DD/2-MARGIN;put(px(c),(z0+z1)/2,P,z1-z0+0.1,'A');g.children[g.children.length-1].position.y=0.06}}
  g.traverse(o=>{if(o.isMesh)o.receiveShadow=true})}
const inGap=(x,z,water)=>{for(const q of gaps)if(x>q.x0&&x<q.x1&&z>q.z0&&z<q.z1&&(!water||q.k==='A'))return true;return false};
function buildSpecials(G){const map=window.K&&K.CITY_MAP&&K.CITY_MAP[cityId];if(!map)return;if(!G.plots.some(p=>p.city===cityId&&'PAL'.includes(map[p.r][p.c])))fillGaps(G);else gaps.length=0;
  for(let r=0;r<map.length;r++)for(let c=0;c<map[r].length;c++){const code=map[r][c];if(!'PAL'.includes(code))continue;if(G.plots.some(p=>p.city===cityId&&p.r===r&&p.c===c))continue;
    const g=new THREE.Group();g.userData.cell='x'+r+'-'+c;g.position.set(px(c),0,pz(r));plotGroup.add(g);special(code,cityId,r,c,g);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}})}}
function buildLand(id){if(topMat)topMat.color.set((MAP_CITY[id]||MAP_CITY.kiel).top);if(!landGroup)return;while(landGroup.children.length){const c=landGroup.children.pop();c.traverse(o=>{if(o.geometry)o.geometry.dispose()})}landAnim.length=0;
  const L=LANDMARKS[id];if(!L)return;ground(landGroup,LZ-LD/2,LZ+LD/2,L.ground);L.build(landGroup);
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(10,1.6),label(L.n.toUpperCase(),'#24272b','#ffffff'));sg.rotation.x=-Math.PI/2;sg.position.set(-BW/2+8,0.12,LZ+LD/2-2);landGroup.add(sg);
  landGroup.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}})}
function init(cv){
  canvas=cv;renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0,0);
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-10,10,10,-10,0.1,500);
  scene.add(new THREE.HemisphereLight(0xffffff,0xcfc6b6,0.8));
  const sun=new THREE.DirectionalLight(0xfffaf0,0.85);sun.position.set(-40,70,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:220});sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.03;scene.add(sun);
  // weicher Schatten unter dem Block
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(BW*1.6,BD*1.6),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,map:canvasTex(256,256,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,w*0.2,w/2,h/2,w/2);r.addColorStop(0,'rgba(36,39,43,.28)');r.addColorStop(1,'rgba(36,39,43,0)');g.fillStyle=r;g.fillRect(0,0,w,h)})}));
  sh.rotation.x=-Math.PI/2;sh.position.y=-DEPTH-0.5;sh.position.z=-LD/2;sh.scale.set(1,1.3,1);scene.add(sh);
  root=new THREE.Group();scene.add(root);
  // Block mit Erdschichten, Straßen obenauf
  const sx=new THREE.MeshLambertMaterial({map:strataTex(BD)}),sz=new THREE.MeshLambertMaterial({map:strataTex(BW)});
  const top=topMat=new THREE.MeshStandardMaterial({color:'#9a9da2',roughness:0.95});
  const blk=new THREE.Mesh(new THREE.BoxGeometry(BW,DEPTH,BD),[sx,sx,top,M('#7d6a4f'),sz,sz]);blk.position.y=-DEPTH/2;blk.receiveShadow=true;root.add(blk);
  const sxl=new THREE.MeshLambertMaterial({map:strataTex(LD)}),ext=new THREE.Mesh(new THREE.BoxGeometry(BW,DEPTH,LD),[sxl,sxl,top,M('#7d6a4f'),sz,sz]);ext.position.set(0,-DEPTH/2,LZ);ext.receiveShadow=true;root.add(ext);
  landGroup=new THREE.Group();root.add(landGroup);
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
  const mob=w<=760,aspect=w/h,span=mob?BW*0.47/aspect:(BD+LD)*0.52,tw=2*span*aspect,th=2*span;
  const cx=mob?w/2:w/2,cy=mob?h*0.44:h*0.52;
  camera.left=-cx/w*tw;camera.right=camera.left+tw;camera.top=cy/h*th;camera.bottom=camera.top-th;camera.updateProjectionMatrix()}

// ---------- Gebäude und Einheiten ----------
// Jedes Grundstück trägt ein festes Gebäude. Firmen mieten sich ein: Ladenlokale im Erdgeschoss, Etagen darüber, Hallen im Gewerbegebiet.
// Wer wo sitzt, zeigen Pins über den Dächern.
const ZCOL={city:'#e6e0d4',wohn:'#a9cf8a',buero:'#d5d7d9',gewerbe:'#d6cbb3'};
const SLOTS={wohn:['laden','laden'],city:['laden','laden','etage'],buero:['laden','etage','etage'],gewerbe:['halle']};
const FZ=2.4,GF=1.85; // Vorderkante der Fassade, Höhe des Erdgeschosses
const anchors={},cells={},pinTex={};
function plotSig(G,p){let s=p.owner+'|'+p.use+'|'+(p.prop||'')+'|b'+(window.K&&K.underBuild?K.underBuild(G,p):0);
  if(p.owner&&!p.owner.startsWith('c:')&&p.owner!=='H'){const f=G.firms.find(x=>x.id===p.owner);if(f){s+='|'+f.color+'|'+f.name;
    if(p.use==='cafe'){const sh=f.shops.find(x=>x.plot===p.id);s+='|'+(sh?sh.level+(sh.facade||'')+Object.keys(sh.ups).sort().join(','):0)}
    if(p.use==='office')s+='|'+Object.keys(f.oups||{}).sort().join(',');
    if(p.use==='factory'){const pl=f.plants.find(x=>x.plot===p.id);s+='|'+(pl?pl.lines.map(l=>l.type+(l.auto?'a':'')+l.shifts).join(',')+Object.keys(pl.ups||{}).join(','):'')}}}
  if(p.owner&&p.owner.startsWith('c:')){const cp=G.comps.find(c=>'c:'+c.id===p.owner);s+='|'+(cp?cp.name:'')}
  return s}
const dispKind=p=>p.kind||(p.zone==='gewerbe'?'halle':(p.use==='office'||p.use==='hq'||(!p.use&&p.zone==='buero'))?'etage':'laden');
function setCity(G,id){if(cityId===id)return;cityId=id;buildLand(id);sig={};for(const k in cells)delete cells[k];for(const k in anchors)delete anchors[k];
  while(plotGroup.children.length){const c=plotGroup.children.pop();c.traverse(o=>{if(o.geometry)o.geometry.dispose()})}bases=[];buildSpecials(G);sync(G,true)}
function sync(G,force){G0=G;if(!plotGroup)return;
  const byCell={};for(const p of G.plots){if(p.city!==cityId)continue;(byCell[p.r+'-'+p.c]=byCell[p.r+'-'+p.c]||[]).push(p)}
  for(const key in byCell){const list=byCell[key],us=list.map(p=>plotSig(G,p)),s=us.join('#');if(!force&&sig[key]===s)continue;
    const prev=cells[key]?cells[key].sigs:{};sig[key]=s;
    const old=plotGroup.children.find(c=>c.userData.cell===key);if(old){plotGroup.remove(old);old.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
    const g=new THREE.Group();g.userData.cell=key;const p0=list[0];g.position.set(px(p0.c),0,pz(p0.r));plotGroup.add(g);
    const parts=buildCell(G,list,g);cells[key]={sigs:{}};list.forEach((p,i)=>{cells[key].sigs[p.id]=us[i];
      if(!force&&old&&prev[p.id]!==us[i]&&parts[p.id]){for(const o of parts[p.id])grow.push({g:o,t:0,pop:true})}})}
  bases=[];plotGroup.traverse(o=>{if(o.userData.base)bases.push(o)});
  updateWalkerDensity(G)}
function unitGroup(g,pid){const u=new THREE.Group();u.userData.pid=pid;g.add(u);return u}
function buildCell(G,list,g){const p0=list[0];seed=(p0.r*31+p0.c*7+(p0.city||'').length*13)|0||5;
  const zone=p0.zone,slots=SLOTS[zone],used=new Set(),units=slots.map((k,i)=>{let p=list.find(q=>q.u===i);
    if(!p)p=list.find(q=>q.u===undefined&&!used.has(q)&&dispKind(q)===k);if(p)used.add(p);return p||null});
  const def=(units.find(Boolean)||p0).id,parts={};
  const base=B(P,0.25,P,ZCOL[zone],0,0,0,unitGroup(g,def));base.userData.base=true;
  const info=p=>{if(!p||!p.owner)return{};const own=!p.owner.startsWith('c:')&&p.owner!=='H',f=own?G.firms.find(x=>x.id===p.owner):null,cp=p.owner.startsWith('c:')?G.comps.find(c=>'c:'+c.id===p.owner):null;
    return{build:window.K&&K.underBuild?K.underBuild(G,p):0,f,cp,hq:p.owner==='H',color:p.owner==='H'?'#24272b':f?f.color:cp?cp.color:'#8a8f96',name:f?f.name:cp?cp.name:''}};
  const deco=(p,ug)=>{const d=new THREE.Group();ug.add(d);if(p)(parts[p.id]=parts[p.id]||[]).push(d);return d};
  const pins=[];
  if(zone==='gewerbe'){const p=units[0],ug=unitGroup(g,p?p.id:def),I=info(p);hall(G,p,ug,deco(p,ug),I);if(p&&p.owner)pins.push([p,I,0,6.2,-1.4]);if(p&&p.prop==='H')flag(ug,-4.2,0.25,4.2)}
  else if(zone==='wohn'){ // zwei schmale Wohnhäuser, unten je ein Ladenlokal
    for(let i=0;i<2;i++){const p=units[i],sx=i?2.2:-2.2,ug=unitGroup(g,p?p.id:def),I=info(p),h=4.4+rnd()*2.6;
      const CS=CITY_STYLE[cityId]||CITY_STYLE.kiel,col=CS.house[Math.floor(rnd()*CS.house.length)];
      B(4.3,h,6,col,sx,0.25,-0.6,ug);add(prism(4.5,1.2,6.2),CS.roof[Math.floor(rnd()*CS.roof.length)],sx,0.25+h,-0.6,ug).rotation.y=0;
      for(let k=0;k<Math.floor((h-GF)/1.3);k++)for(const wx of [-1,0,1])B(0.7,0.7,0.05,'#3d4651',sx+wx*1.25,0.25+GF+0.35+k*1.3,FZ+0.01,ug);
      shopfront(G,p,ug,deco(p,ug),I,sx,4.1);if(p&&p.owner)pins.push([p,I,sx,h+2.9,0]);if(p&&p.prop==='H')flag(ug,sx+1.8,0.25,FZ+0.6)}}
  else if(zone==='city'){ // Geschäftshaus: zwei Läden unten, Büroetagen darüber
    const h=6.6+rnd()*2.6,ep=units[2],eg=unitGroup(g,ep?ep.id:def),EI=info(ep),col=(cityId==='kiel'?['#c46a4a','#b8553a','#efe6d6','#a6472f']:cityId==='hamburg'?['#efe6d6','#9a4a35','#e4d2bd','#d9dee4']:['#efe6d6','#e4d2bd','#d9dee4','#f1dcc8'])[Math.floor(rnd()*4)];
    etage(G,ep,eg,deco(ep,eg),EI,0.25+GF,h-GF,8.8,6,col,true);if(ep&&ep.owner)pins.push([ep,EI,0,h+(EI.hq?6.5:3.6),0]);if(ep&&ep.prop==='H')flag(eg,-4.2,h+0.6,2.2);
    for(let i=0;i<2;i++){const p=units[i],sx=i?2.2:-2.2,ug=unitGroup(g,p?p.id:def),I=info(p);B(4.4,GF,6,'#e9e2d4',sx,0.25,-0.6,ug);
      shopfront(G,p,ug,deco(p,ug),I,sx,4.1);if(p&&p.owner)pins.push([p,I,sx,h+1.6,FZ]);if(p&&p.prop==='H')flag(ug,sx+1.8,0.25,FZ+0.6)}}
  else{ // Büroturm: ein Laden und die Lobby unten, zwei Etagenblöcke darüber
    const h=10+rnd()*4,mid=GF+(h-GF)/2,col=(CITY_STYLE[cityId]||CITY_STYLE.berlin).office[Math.floor(rnd()*3)];
    for(const [i,y0,hh] of [[1,0.25+GF,mid-GF],[2,0.25+mid,h-mid]]){const p=units[i],ug=unitGroup(g,p?p.id:def),I=info(p);etage(G,p,ug,deco(p,ug),I,y0,hh,8.4,6.8,col,i===2);
      if(p&&p.owner)pins.push([p,I,i===1?2.6:-0.4,h+(i===1?1.8:I.hq?6.5:3.8),0]);if(p&&p.prop==='H')flag(ug,4,y0+0.2,2.6)}
    const lg=unitGroup(g,units[1]?units[1].id:def);B(4.2,GF,6.8,'#cfd6dc',2.1,0.25,-1,lg);B(2.4,1.3,0.06,'#bcd8e8',2.1,0.25,FZ+0.01,lg);
    const p=units[0],ug=unitGroup(g,p?p.id:def),I=info(p);B(4.2,GF,6.8,'#e9e2d4',-2.1,0.25,-1,ug);shopfront(G,p,ug,deco(p,ug),I,-2.1,4);
    if(p&&p.owner)pins.push([p,I,-2.4,h+1.2,FZ]);if(p&&p.prop==='H')flag(ug,-0.4,0.25,FZ+0.6)}
  // Anker für Auswahl, Labels und Markierung
  units.forEach((p,i)=>{if(!p)return;const k=slots[i];let a;
    if(k==='halle')a={x:0,y:0.25,z:0,w:9.2,h:4.8,d:9.2};
    else if(k==='laden'){const sx=zone==='buero'?-2.1:i?2.2:-2.2;a={x:sx,y:0.25,z:1.2,w:4.4,h:GF+0.3,d:7.2,fz:FZ-0.3}}
    else{const top=g.userData.top||8,y0=g.userData['y'+i]||0.25+GF,hh=g.userData['h'+i]||top-y0;a={x:0,y:y0,z:-0.6,w:9.2,h:hh,d:7.2}}
    a.x+=g.position.x;a.z+=g.position.z;anchors[p.id]=a});
  for(const [p,I,x,y,z] of pins){const sp=pin(I,p);sp.position.set(x,y,z);g.add(sp);(parts[p.id]=parts[p.id]||[]).push(sp);anchors[p.id].pin=y;anchors[p.id].pinX=x+g.position.x;anchors[p.id].pinZ=z+g.position.z}
  return parts}
function flag(g,x,y,z){B(0.08,2.4,0.08,'#24272b',x,y,z,g);B(1.1,0.65,0.04,'#d4a72c',x+0.6,y+1.7,z,g)}
// Baugerüst: Stangen, Bretter, grünes Netz
function scaffold(g,x,y,z,w,h,face){const net=new THREE.MeshStandardMaterial({color:'#7fae6a',transparent:true,opacity:0.55,flatShading:true,roughness:0.9});
  for(let i=0;i<=Math.round(w/1.2);i++){const px=x-w/2+i*(w/Math.round(w/1.2));B(0.07,h,0.07,'#c9ccd0',px,y,z+face,g)}
  for(let k=1;k*1.1<h;k++)B(w,0.07,0.6,'#b08a5a',x,y+k*1.1,z+face-0.25,g);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),net);m.position.set(x,y+h/2,z+face+0.04);g.add(m)}
function buildSite(g,x,z,w,weeks){for(let i=0;i<5;i++)B(w/5-0.1,0.9,0.05,i%2?'#e05a3a':'#f4f1ea',x-w/2+w/10+i*w/5,0.25,z,g);
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w*0.9,3.4),0.55),label('ERÖFFNUNG IN '+weeks+' WO.','#f2c14e','#24272b'));sg.position.set(x,1.05,z+0.04);g.add(sg)}
function crane(g,x,z,h){B(0.35,h,0.35,'#f2c14e',x,0.25,z,g);B(5,0.3,0.3,'#f2c14e',x-1.6,0.25+h,z,g);B(0.9,0.6,0.6,'#24272b',x+0.8,0.25+h-0.6,z,g);B(0.05,2.2,0.05,'#24272b',x-3.6,0.25+h-2.2,z,g)}
function shopfront(G,p,ug,d,I,sx,w){
  const frame=B(w,0.22,0.12,'#d9d2c4',sx,0.25+GF-0.22,FZ+0.05,ug);
  if(!p||!p.owner){B(w*0.82,1.15,0.05,'#4a525c',sx,0.4,FZ+0.01,ug);
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(w*0.62,0.5),label(p&&p.prop==='H'?'ZU VERMIETEN':'ZU MIETEN','#f2c14e','#24272b'));sg.position.set(sx,1.0,FZ+0.05);ug.add(sg);return}
  if(I.build){B(w*0.82,1.15,0.05,'#4a525c',sx,0.4,FZ+0.01,ug);scaffold(d,sx,0.25,FZ,w,GF+0.4,0.15);buildSite(d,sx,FZ+1.3,w,I.build);return}
  const color=I.color,lvl=I.f?((I.f.shops.find(x=>x.plot===p.id)||{}).level||1):2,u=I.f?((I.f.shops.find(x=>x.plot===p.id)||{}).ups||{}):{};
  const fac=I.f?((I.f.shops.find(x=>x.plot===p.id)||{}).facade||'klassik'):'klassik';
  if(fac==='glas'){B(w*0.92,GF-0.3,0.05,'#9cc6d8',sx,0.3,FZ+0.02,ug);for(let i=0;i<=4;i++)B(0.08,GF-0.3,0.08,'#f4f1ea',sx-w*0.46+i*w*0.23,0.3,FZ+0.05,ug)}
  else if(fac==='stuck'){B(w*0.86,1.2,0.05,'#2f3439',sx,0.4,FZ+0.01,ug);for(const dx of [-w/2+0.15,0,w/2-0.15])B(0.3,GF,0.18,'#e9e4d8',sx+dx,0.25,FZ+0.08,ug);B(w+0.1,0.25,0.3,'#e9e4d8',sx,0.25+GF-0.05,FZ+0.1,ug)}
  else B(w*0.86,1.2,0.05,lvl>=3?'#bcd8e8':'#3d4651',sx,0.4,FZ+0.01,ug);
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(w*0.9,0.5),label(I.name||'Restaurant',color,'#ffffff',I.f&&I.f===G.firms[0]?logoImg:null));sg.position.set(sx,0.25+GF-0.11,FZ+0.12);d.add(sg);
  const aw=add(prism(w,0.7,1.3),color,sx,1.55,FZ+0.65,d);aw.rotation.x=-Math.PI/2;aw.scale.set(1,1,0.5);
  const nT=lvl>=2?2:1;for(let i=0;i<nT;i++){const x=sx+(nT===1?0:(i?1:-1)*1.1),z=FZ+1.7;add(new THREE.CylinderGeometry(0.38,0.38,0.06,10),'#f4f1ea',x,0.9,z,d);B(0.07,0.65,0.07,'#2d3436',x,0.25,z,d);
    if(lvl>=2||u.terrasse){add(new THREE.ConeGeometry(0.9,0.42,8),color,x,2.25,z,d);B(0.05,1.5,0.05,'#2d3436',x,0.85,z,d)}}
  if(u.terrasse)B(w,0.05,1.9,'#c8a27a',sx,0.25,FZ+1.7,d);
  if(u.vitrine)B(1.2,0.7,0.4,'#cfe3ec',sx+w/2-0.9,0.25,FZ+0.35,d);
  if(u.lounge)B(1.4,0.45,0.5,'#9b6fb5',sx-w/2+1,0.25,FZ+0.35,d);
  if(u.togo){B(0.9,1.0,0.5,'#f4f1ea',sx+w/2+0.15,0.25,FZ+0.9,d);B(0.8,0.3,0.06,color,sx+w/2+0.15,0.95,FZ+1.16,d)}
  if(u.delivery){B(0.9,0.45,0.4,'#d63c3c',sx-w/2+0.6,0.3,FZ+2.4,d);B(0.4,0.4,0.4,'#f4f1ea',sx-w/2+0.8,0.75,FZ+2.4,d)}
  if(u.kids)add(new THREE.ConeGeometry(0.5,0.8,4),'#f2c14e',sx+w/2-0.5,0.65,FZ+2.5,d);
  if(u.wlan)B(0.05,0.9,0.05,'#24272b',sx+w/2-0.3,1.7,FZ+1.1,d);
  if(u.roaster){add(new THREE.CylinderGeometry(0.22,0.26,1.2,8),'#8a8f96',sx+1.2,0.25+GF+0.6,FZ-0.4,d)}
  if(u.solar)for(let i=0;i<2;i++){const m=B(1.4,0.06,0.8,'#2f3e55',sx-0.8+i*1.6,1.95,FZ+0.65,d);m.rotation.x=-0.25}}
function etage(G,p,ug,d,I,y0,hh,w,dp,col,top){const g=ug.parent;
  B(w,hh,dp,col,0,y0,-0.6,ug);const floors=Math.max(1,Math.round(hh/1.3));
  const occ=p&&p.owner,win=I.hq?'#24272b':occ?I.color:'#9aa4ae';
  for(let k=0;k<floors;k++){const y=y0+k*(hh/floors)+0.35;B(w*0.86,0.42,0.05,occ?win:'#c8ccd2',0,y,-0.6+dp/2+0.01,ug);B(0.05,0.42,dp*0.86,occ?win:'#c8ccd2',-w/2-0.01,y,-0.6,ug)}
  if(top){B(w+0.2,0.25,dp+0.2,'#cfc8bb',0,y0+hh,-0.6,ug);g.userData.top=y0+hh}
  const i=p?p.u:undefined;if(i!==undefined){g.userData['y'+i]=y0;g.userData['h'+i]=hh}
  if(!occ){if(p){const sg=new THREE.Mesh(new THREE.PlaneGeometry(2.6,0.5),label(p.prop==='H'?'ZU VERMIETEN':'ZU MIETEN','#f2c14e','#24272b'));sg.position.set(-w/2-0.03,y0+hh/2,-0.6);sg.rotation.y=-Math.PI/2;d.add(sg)}return}
  if(I.build){scaffold(d,0,y0,-0.6+dp/2,w,hh,0.12);const bs=new THREE.Mesh(new THREE.PlaneGeometry(3.6,0.6),label('UMBAU · '+I.build+' WO.','#f2c14e','#24272b'));bs.position.set(0,y0+hh/2,-0.6+dp/2+0.25);d.add(bs);if(top)crane(d,w/2-0.6,-2.6,y0+hh+4);return}
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(4.4,0.75),label(I.hq?'Zentrale':I.name,I.color,'#ffffff'));sg.position.set(0,y0+hh-0.5,-0.6+dp/2+0.04);d.add(sg);
  if(I.hq&&top){for(let k=0;k<3;k++)B(6-k*0.9,1.1,4.6-k*0.7,k%2?'#3d4651':'#24272b',0,y0+hh+0.25+k*1.1,-0.6,d);add(new THREE.CylinderGeometry(0.05,0.05,2.4,4),'#24272b',0,y0+hh+4.6,-0.6,d);add(new THREE.OctahedronGeometry(0.4,0),'#d4a72c',0,y0+hh+5.9,-0.6,d)}
  if(I.f&&top){const u=I.f.oups||{},ry=y0+hh+0.25;if(u.gaming)B(1.4,1,1.4,'#9b6fb5',-2.8,ry,-2.4,d);if(u.kitchen)add(new THREE.IcosahedronGeometry(0.6,0),'#6aa957',2.8,ry+0.5,-2.4,d);
    if(u.hardware)for(let k=0;k<3;k++)B(0.7,0.55,0.7,'#8a8f96',-1+k*1,ry,1.6,d);if(u.quiet)B(2,0.8,2,'#bcd8e8',2.4,ry,1,d)}}
function hall(G,p,ug,d,I){const f=I.f,color=p&&p.owner?I.color:'#b9bdc2';
  B(8.6,3.2,6,'#d8d6d0',0,0.25,-1.4,ug);for(let i=0;i<4;i++)add(prism(2.15,1.1,6),'#9da3a8',-3.22+i*2.15,3.45,-1.4,ug);
  B(8.62,0.5,6.02,color,0,2.3,-1.4,ug);B(2.6,2,0.06,'#8a8f96',-2.4,0.25,1.62,ug);
  if(!p||!p.owner){for(let i=-4;i<=4;i+=1)B(0.06,0.9,0.06,'#9a9da2',i,0.25,4.4,ug);
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.7),label(p&&p.prop==='H'?'ZU VERMIETEN':'ZU MIETEN','#f2c14e','#24272b'));sg.position.set(2,1.5,1.66);ug.add(sg);return}
  if(I.build){crane(d,3.2,3.2,7);for(let i=0;i<3;i++)B(1.2,0.6,0.8,['#b08a5a','#8a8f96','#f2c14e'][i],-3+i*1.5,0.25,3.4,d);const bs=new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.6),label('AUFBAU · '+I.build+' WO.','#f2c14e','#24272b'));bs.position.set(-1,1.6,1.68);d.add(bs);return}
  const pl=f&&f.plants.find(x=>x.plot===p.id),lines=f?(pl?pl.lines:[]):[{type:'moebel'}],u=pl?pl.ups||{}:{};
  lines.forEach((l,i)=>{const x=-3+i*2.2;if(l.type==='roest')add(new THREE.CylinderGeometry(0.35,0.4,5.5,8),'#8a8f96',x,3,-3.6,d);
    else if(l.type==='back')add(new THREE.CylinderGeometry(0.6,0.6,2.4,10),'#e9e4d8',x,1.45,2.6,d);else B(1.6,1.2,1.2,'#b07a46',x,0.25,2.7,d);
    if(l.auto)B(0.5,1.6,0.5,'#f2c14e',x+0.9,0.25,2.7,d);if(l.shifts>1)for(let k=0;k<l.shifts;k++)B(0.3,0.3,0.06,'#fff3c4',x-0.6+k*0.5,2.0,1.62,d)});
  B(2.4,1.2,1.1,'#f4f1ea',2.6,0.25,3.4,d);B(1,1.1,1.1,color,1.0,0.25,3.4,d);
  if(u.solar)for(let i=0;i<4;i++)B(1.8,0.08,4.8,'#2f3e55',-3.22+i*2.15,4.1,-1.4,d);
  if(u.lager){B(3.2,2.2,2.8,'#cfc8b9',-2.6,0.25,2.9,d);B(3.24,0.3,2.84,color,-2.6,2.25,2.9,d)}
  if(u.kantine){B(1.8,1.4,1.6,'#f6efe3',4.2,0.25,-4.2,d);add(new THREE.IcosahedronGeometry(0.5,0),'#6aa957',3,0.8,-4.4,d)}}
// weiße Symbole für die Pins
function glyph(g,k,x,y){g.save();g.translate(x,y);g.fillStyle='#fff';g.strokeStyle='#fff';g.lineWidth=7;g.lineCap=g.lineJoin='round';
  if(k==='cafe'){g.beginPath();g.arc(0,4,22,0,7);g.fill();g.fillStyle='rgba(36,39,43,.18)';g.beginPath();g.arc(0,4,14,0,7);g.fill();g.fillStyle='#fff';
    g.fillRect(-34,-22,4,46);for(const dx of [-38,-32,-26])g.fillRect(dx,-24,3,14);g.fillRect(28,-22,5,46);g.beginPath();g.ellipse(30,-14,5,12,0,0,7);g.fill()}
  else if(k==='office'){g.fillRect(-30,-14,60,42);g.lineWidth=6;g.strokeRect(-12,-26,24,14);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(-30,2,60,5)}
  else if(k==='factory'){g.beginPath();g.moveTo(-32,30);g.lineTo(-32,-6);g.lineTo(-14,4);g.lineTo(-14,-6);g.lineTo(4,4);g.lineTo(4,-6);g.lineTo(22,4);g.lineTo(22,-30);g.lineTo(32,-30);g.lineTo(32,30);g.closePath();g.fill()}
  else if(k==='bau'){g.beginPath();g.moveTo(0,-30);g.lineTo(32,26);g.lineTo(-32,26);g.closePath();g.fill();g.fillStyle='rgba(36,39,43,.85)';g.fillRect(-4,-10,8,22);g.fillRect(-4,16,8,6)}
  else if(k==='hq'){g.beginPath();g.moveTo(-30,22);g.lineTo(-34,-20);g.lineTo(-14,0);g.lineTo(0,-28);g.lineTo(14,0);g.lineTo(34,-20);g.lineTo(30,22);g.closePath();g.fill();g.fillRect(-30,26,60,8)}
  else{g.beginPath();g.arc(0,0,16,0,7);g.fill()}
  g.restore()}
// Pin über dem Dach: Markenfarbe, Symbol der Branche, Goldrand bei eigener Immobilie
function pin(I,p){const icon=I.build?'bau':I.hq?'hq':p.use||'x',own=!!I.f||I.hq,useLogo=!!(I.f&&logoImg&&!I.build&&I.f===G0.firms[0]),key=I.color+icon+(p.prop==='H')+own+useLogo;
  if(!pinTex[key])pinTex[key]=canvasTex(128,160,(g,w,h)=>{g.fillStyle='rgba(36,39,43,.18)';g.beginPath();g.ellipse(64,152,16,5,0,0,7);g.fill();
    if(!own)g.globalAlpha=0.62;g.fillStyle=I.color;g.strokeStyle=p.prop==='H'?'#d4a72c':'#ffffff';g.lineWidth=p.prop==='H'?9:6;g.beginPath();
    const r=22,x0=10,y0=8,x1=118,y1=112;g.moveTo(x0+r,y0);g.lineTo(x1-r,y0);g.quadraticCurveTo(x1,y0,x1,y0+r);g.lineTo(x1,y1-r);g.quadraticCurveTo(x1,y1,x1-r,y1);g.lineTo(78,y1);g.lineTo(64,146);g.lineTo(50,y1);g.lineTo(x0+r,y1);g.quadraticCurveTo(x0,y1,x0,y1-r);g.lineTo(x0,y0+r);g.quadraticCurveTo(x0,y0,x0+r,y0);g.closePath();g.fill();g.stroke();
    g.globalAlpha=1;if(useLogo){g.fillStyle='#ffffff';g.beginPath();g.arc(64,60,40,0,7);g.fill();g.drawImage(logoImg,30,26,68,68)}else glyph(g,icon,64,60);
    if(own){g.fillStyle='#ffffff';g.beginPath();g.arc(104,20,13,0,7);g.fill();g.fillStyle=I.color;g.beginPath();g.arc(104,20,7,0,7);g.fill()}});
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:pinTex[key],depthTest:false,transparent:true}));const sc=own?1:0.66;sp.scale.set(3.6*sc,4.5*sc,1);sp.userData.sc=sc;sp.center.set(0.5,0.05);sp.renderOrder=own?9:8;sp.userData.pid=p.id;sp.userData.pinBase=0;return sp}
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
    const w=wData[i];const [x,z]=moveOnGrid(w,dt*0.05,w.side);if(inGap(x,z,true)){O.position.set(0,-50,0);O.scale.setScalar(0.001);O.updateMatrix();wInst.setMatrixAt(i,O.matrix);continue}O.position.set(x,0.12+Math.abs(Math.sin(performance.now()/180+i))*0.05,z);O.scale.setScalar(1);O.rotation.set(0,0,0);O.updateMatrix();wInst.setMatrixAt(i,O.matrix)}
  wInst.instanceMatrix.needsUpdate=true;
  for(let i=0;i<cData.length;i++){const c=cData[i];const [x,z]=moveOnGrid(c,dt*0.07,(c.dir>0?0.55:-0.55));O.position.set(x,0,z);O.rotation.set(0,c.horiz?0:Math.PI/2,0);O.scale.setScalar(inGap(x,z,false)?0.001:1);O.updateMatrix();cInst.setMatrixAt(i,O.matrix)}
  cInst.instanceMatrix.needsUpdate=true}

// ---------- Auswahl und Interaktion ----------
function plotAt(cx,cy){const r=canvas.getBoundingClientRect();const v=new THREE.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);ray.setFromCamera(v,camera);
  const hit=ray.intersectObjects(plotGroup.children,true)[0];if(!hit)return null;let o=hit.object;while(o&&!o.userData.pid)o=o.parent;return o?o.userData.pid:null}
function boxAt(a,m){const o=new THREE.Mesh(new THREE.BoxGeometry(a.w,a.h,a.d),m);o.position.set(a.x,a.y+a.h/2,a.z);o.renderOrder=6;return o}
let selBox=null,hovBox=null;const edgeGeo={};
function edgeBox(a,color,op){const k=[a.w,a.h,a.d].map(v=>v.toFixed(2)).join('x');if(!edgeGeo[k])edgeGeo[k]=new THREE.EdgesGeometry(new THREE.BoxGeometry(a.w,a.h,a.d));
  const o=new THREE.LineSegments(edgeGeo[k],new THREE.LineBasicMaterial({color,transparent:true,opacity:op,depthTest:false}));o.position.set(a.x,a.y+a.h/2,a.z);o.renderOrder=9;return o}
function select(pid){sel=pid;if(selBox){root.remove(selBox);selBox=null}const a=pid&&anchors[pid];selRing.visible=!!a;
  if(a){selRing.scale.set(a.w/P*0.8,1,a.d/P*0.8);selRing.position.set(a.x,0.3,a.z);selBox=edgeBox(a,'#24272b',0.9);root.add(selBox)}}
function hover(pid){if(hovBox){root.remove(hovBox);hovBox=null}const a=pid&&pid!==sel&&anchors[pid];hoverRing.visible=false;if(a){hovBox=edgeBox(a,'#24272b',0.35);root.add(hovBox)}}
function project(pid,y){const a=anchors[pid];if(!a)return null;const pinX=a.pinX!==undefined?a.pinX:a.x,v=y==='pin'?new THREE.Vector3(pinX,(a.pin||a.y+a.h)+4.8,a.pinZ!==undefined?a.pinZ:a.z):a.fz!==undefined&&y!==undefined?new THREE.Vector3(a.x,a.y+a.h*0.45,a.fz+(a.z-1.2)):new THREE.Vector3(a.x,y===undefined?a.y+a.h:Math.max(y,a.y+a.h*0.6),a.z);v.project(camera);
  const r=canvas.getBoundingClientRect();return{x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height,vis:v.z<1}}
function highlight(list,color){for(const m of marks){root.remove(m)}marks.length=0;if(!list||!list.length)return;
  for(const pid of list){const a=anchors[pid];if(!a)continue;const m=boxAt({...a,w:a.w+0.3,h:a.h+0.3,d:a.d+0.3,y:a.y-0.15},new THREE.MeshBasicMaterial({color:color||'#3f9b62',transparent:true,opacity:0.4,depthWrite:false}));root.add(m);marks.push(m)}}
let last=0;function frame(t){const dt=Math.min(0.05,(t-last)/1000||0.016);last=t;animate(dt*60);for(const f of landAnim)f(t);
  for(let i=grow.length-1;i>=0;i--){const a=grow[i];if(a.pop){a.t+=dt/0.5;const k=Math.min(1,a.t),e=k<1?1-Math.pow(1-k,3)*Math.cos(k*7):1;const sc=Math.max(0.01,e);a.g.scale.set(a.g.isSprite?3.6*sc*(a.g.userData.sc||1):sc,a.g.isSprite?4.5*sc*(a.g.userData.sc||1):sc,1*(a.g.isSprite?1:sc));if(k>=1){if(!a.g.isSprite)a.g.scale.set(1,1,1);grow.splice(i,1)}continue}
    a.t+=dt/0.7;const k=Math.min(1,a.t),e=1+Math.sin(k*Math.PI)*0.18*(1-k)+(k<1?-(1-k)*(1-k):0);a.g.scale.set(1,Math.max(0.02,k<1?k*k*(3-2*k)*(1+0.15*Math.sin(k*Math.PI)):1),1);if(k>=1){a.g.scale.set(1,1,1);grow.splice(i,1)}}
  for(const m of marks)m.material.opacity=0.3+0.2*Math.sin(t/260);
  if(selRing.visible)selRing.material.opacity=0.6+0.3*Math.sin(t/300);renderer.render(scene,camera)}
function setLogo(svg){const im=new Image();im.onload=()=>{logoImg=im;for(const k in pinTex)delete pinTex[k];if(G0&&plotGroup)sync(G0,true)};im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}
window.World={init,setLogo,resize,setCity,sync,select,hover,plotAt,project,frame,view,applyView,highlight,get city(){return cityId}};
})();
