// Gründerzeit: die Stadt als Diorama-Block. Liest den Spielstand, schreibt nichts hinein.
(function(){
'use strict';
const P=10,S=4,COLS=10,ROWS=8,WW=COLS*P+(COLS+1)*S,DD=ROWS*P+(ROWS+1)*S,MARGIN=5,BW=WW+2*MARGIN,BD=DD+2*MARGIN,DEPTH=7;
const px=c=>-WW/2+S+c*(P+S)+P/2,pz=r=>-DD/2+S+r*(P+S)+P/2;
const streetX=i=>-WW/2+S/2+i*(P+S),streetZ=i=>-DD/2+S/2+i*(P+S);
const grow=[],marks=[];let markGeo=null;
// Stadtplan biegen: Rasterpunkt (x,z) -> Weltpunkt. Am Rand verschwindet die Verschiebung, damit der Block sauber abschließt.
let WARP=null;
const WA=1.55;
const WARPS={
  kiel:(x,z)=>{const u=(x+WW/2)/WW,v=(z+DD/2)/DD,e=Math.sin(Math.PI*u)*Math.sin(Math.PI*v);return[x+6.5*Math.sin(Math.PI*v)*(1.1-u)*Math.sin(Math.PI*u)*1.6-3.5*e,z-5*e+2.5*Math.sin(2*Math.PI*u)*Math.sin(Math.PI*v)]},
  hamburg:(x,z)=>{const cx=WW/2-P*1.6,cz=-DD/2+P*1.9,dx=x-cx,dz=z-cz,d=Math.hypot(dx,dz)||1,u=(x+WW/2)/WW,v=(z+DD/2)/DD,edge=Math.sin(Math.PI*u)*Math.sin(Math.PI*v),f=7.5*Math.exp(-d*d/520)*Math.min(1,edge*1.6);
    return[x+dx/d*f+2.5*Math.sin(Math.PI*v*2)*Math.sin(Math.PI*u),z+dz/d*f-2*Math.sin(Math.PI*u*2)*Math.sin(Math.PI*v)]},
  berlin:(x,z)=>{const u=(x+WW/2)/WW,v=(z+DD/2)/DD,e=Math.sin(Math.PI*u)*Math.sin(Math.PI*v);return[x+7*(v-0.5)*e*1.4+3*Math.sin(2*Math.PI*v)*Math.sin(Math.PI*u),z-4*(u-0.5)*e*1.4]}};
const Wp=(x,z)=>{[x,z]=rPush(x,z);if(!WARP)return[x,z];const [a,b]=WARP(x,z);return[x+(a-x)*WA,z+(b-z)*WA]};
const Wang=(x,z)=>{const a=Wp(x-0.5,z),b=Wp(x+0.5,z);return-Math.atan2(b[1]-a[1],b[0]-a[0])};
function placeCell(g,r,c){const j=(RIVERS[cityId]||[]).some(q=>q.h?(r===q.i||r===q.i-1):(c===q.i||c===q.i-1))?0:1,h=((r*73+c*151+(cityId||'').length*37)%97)/97,h2=((r*41+c*29+7)%89)/89,[x,z]=Wp(px(c)+(h-0.5)*1.6*j,pz(r)+(h2-0.5)*1.2*j);g.position.set(x,0,z);g.rotation.y=Wang(px(c),pz(r))+(h2-0.5)*0.22*j}
function shade3(hex,k){const n=parseInt(hex.slice(1),16),f=v=>Math.max(0,Math.min(255,Math.round(v*k)));return'#'+[f(n>>16),f(n>>8&255),f(n&255)].map(v=>v.toString(16).padStart(2,'0')).join('')}
const toW=(g,lx,lz)=>{const c=Math.cos(g.rotation.y),s=Math.sin(g.rotation.y);return[g.position.x+lx*c+lz*s,g.position.z-lx*s+lz*c]};
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
  berlin:{house:['#f0b8a1','#9fc4e2','#f3d68f','#e9a3ac','#bad9c3','#f6efe3'],roof:['#d8644b','#c95540','#6f7f9a'],office:['#dfe6ec','#e8e5de','#d3dbe2']},
  wien:{house:['#f3e2a9','#f1ece0','#e8d7b5','#f4e9c8','#e3c98f'],roof:['#5f9e8a','#8a4f3a','#6f7f9a'],office:['#f1ece0','#e8e5de','#f3e2a9']},
  amsterdam:{house:['#6b3a2c','#8e3b2a','#3d3530','#a6472f','#f2ece0','#5a4a3a'],roof:['#24272b','#3d4651','#5a3b30'],office:['#dfe6ec','#8e3b2a','#e8e5de']}};
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
  kiel:{n:'Emden',ground:'#bfd2a2',build(g){ // Vor dem Wall: Felder, Weide mit Kühen, Mühlen, Giebelhäuser und Speicher
    const FC=['#dcc57c','#a9c47a','#c9a86a','#9cc47e','#e3d28c'];
    for(let i=0;i<14;i++){const x=-68+i*10.5,c=FC[i%5];B(9.8,0.1,7.5,c,x,0,LZ+1,g);for(let k=0;k<5;k++)B(9.6,0.13,0.2,shade3(c,0.86),x,0,LZ-2.2+k*1.6,g)}
    B(24,0.1,7,'#8fbf73',32,0,LZ+9.5,g);for(const z of [LZ+6,LZ+13])B(24,0.5,0.12,'#e9e4d8',32,0,z,g);
    for(let i=0;i<6;i++){const x=23+i*3.4+(i%2)*0.8,z=LZ+8+(i%3)*1.4;B(1.3,0.7,0.6,'#f4f1ea',x,0.45,z,g);B(0.5,0.72,0.62,'#24272b',x-0.2,0.45,z,g);B(0.4,0.4,0.4,'#f4f1ea',x+0.8,0.8,z,g);for(const dx of [-0.45,0.45])for(const dz of [-0.2,0.2])B(0.14,0.45,0.14,'#4a4f55',x+dx,0,z+dz,g)}
    // Speicher und Kontorhäuser am Delft
    for(let i=0;i<3;i++){const x=-8+i*6;B(5.2,5+i%2,5,i%2?'#8e3b2a':'#a6472f',x,0,LZ+9,g);add(prism(5.4,2,5.2),'#3d4651',x,5+i%2,LZ+9,g);for(let k=0;k<2;k++)B(0.9,1.1,0.05,'#f4f1ea',x-1.2+k*2.4,1.5,LZ+11.52,g)}
    // Giebelhäuser am anderen Ufer
    ['#a6472f','#b8553a','#8e3b2a','#c46a4a','#f2ece0','#a6472f','#b8553a'].forEach((c,i)=>gableHouse(g,-40+i*4.2,LZ-7,3.8,4+(i%3)*1.2,c,i%2===0));
    // Mühlen und Bäume auf dem Land
    windmill(g,24,LZ-7);windmill(g,38,LZ-8);windmill(g,-60,LZ-8);trees(g,14,18,74,LZ-12,LZ-4);B(24,0.1,7,'#8fbf73',-56,0,LZ+9.5,g);trees(g,8,-74,-48,LZ-12,LZ-4);
    // Backsteinkirche
    B(9,6,5,'#9a4430',8,0,LZ-8,g);add(prism(9.2,3.5,5.2),'#5a3b30',8,6,LZ-8,g);B(2.6,11,2.6,'#9a4430',3.5,0,LZ-8,g);add(new THREE.ConeGeometry(1.9,4,4),'#5f9e8a',3.5,13,LZ-8,g).rotation.y=Math.PI/4;
    trees(g,10,-74,74,LZ+7,LZ+12)}},
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
    trees(g,12,30,74,LZ+7,LZ+12);for(let i=0;i<3;i++)crane(g,52+i*8,LZ-10,i%2?'#cc3b33':'#2f6fd0');container(g,-50,LZ+0.5,16)}},
  wien:{n:'Wien',ground:'#d3dbc2',build(g){ // Riesenrad im Park, Schloss mit Garten, Donau
    water(g,LZ+3,LZ+9,'#6d9bb8');boat(g,-30,LZ+5.5,'#f4f1ea',8,true);
    // Schloss: lange gelbe Fassade mit grünem Dach
    B(30,5,5,'#efd58a',-34,0,LZ-6,g);add(prism(30.4,1.6,5.2),'#5f9e8a',-34,5,LZ-6,g);for(let i=0;i<12;i++)B(1,1.6,0.05,'#f4f1ea',-47+i*2.4,1.4,LZ-3.47,g);B(5,6.6,5.4,'#efd58a',-34,0,LZ-6,g);
    for(let i=0;i<5;i++)B(5,0.08,2.2,'#7fb36a',-44+i*5.2,0,LZ-0.5,g);trees(g,10,-50,-16,LZ-11,LZ-9);
    // Riesenrad, dreht sich
    const wh=new THREE.Group();wh.position.set(22,9.5,LZ-4);g.add(wh);const rim=new THREE.Mesh(new THREE.TorusGeometry(7,0.18,6,40),M('#b8443a'));wh.add(rim);
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2,sp=B(0.12,7,0.12,'#b8443a',0,0,0,wh);sp.geometry.translate(0,-3.5,0);sp.position.set(0,0,0);sp.rotation.z=a;const cab=B(1,1.2,1,['#cc3b33','#f2c14e','#2f6fd0','#f4f1ea'][i%4],Math.cos(a)*7,Math.sin(a)*7-0.6,0,wh);cab.userData.cab=a}
    for(const dz of [-1,1]){const lg=B(0.3,10.5,0.3,'#8a3a30',22,0,LZ-4+dz*0.9,g);lg.rotation.x=dz*0.08}
    landAnim.push(t=>{wh.rotation.z=t/9000;for(const c of wh.children)if(c.userData.cab!==undefined)c.rotation.z=-wh.rotation.z});
    trees(g,14,8,40,LZ-12,LZ+1);trees(g,8,40,74,LZ-12,LZ+12)}},
  amsterdam:{n:'Amsterdam',ground:'#cdd7bd',build(g){ // Gracht mit Hausbooten und Giebelhäusern, Mühle, Fahrräder
    water(g,LZ-2,LZ+3,'#5f8fa8');for(let i=0;i<5;i++){const hb=boat(g,-60+i*14,LZ+1.6,['#2f6b5a','#3d4651','#8e3b2a','#f2c14e','#2f6fd0'][i],7,true);B(4,1.4,1.6,'#f4f1ea',0,0.5,0,hb)}
    const cols=['#3d3530','#6b3a2c','#8e3b2a','#f2ece0','#5a4a3a','#a6472f','#2f3b45'];
    for(let row=0;row<2;row++)for(let i=0;i<22;i++){const x=-72+i*6.6,z=row?LZ+8:LZ-8,h=5+((i*7+row*3)%4)*1.1;gableHouse(g,x,z,3.2,h,cols[(i+row*3)%cols.length],(i+row)%3===0)}
    windmill(g,56,LZ+11);for(let i=0;i<14;i++){const x=-60+i*8.5;B(1.4,0.6,0.08,'#24272b',x,0.5,LZ+4.3,g);for(const dx of [-0.55,0.55])cyl(0.32,0.32,0.06,'#24272b',x+dx,0.32,LZ+4.3,g,10).rotation.x=Math.PI/2}}},
  berlin:{n:'Berlin',ground:'#d2d6c4',build(g){ // Spree mit Ausflugsschiff, Fernsehturm, Stadttor mit Säulen, Parlament mit Glaskuppel
    B(BW,0.08,5,'#93c27a',0,0,LZ+1.5,g);trees(g,24,-74,74,LZ-0.5,LZ+4);
    // Dom mit Kuppeln an der Spree
    B(12,7,8,'#9a958a',10,0,LZ-7,g);add(new THREE.SphereGeometry(3.4,16,10,0,Math.PI*2,0,Math.PI/2),'#4f8a78',10,7,LZ-7,g);cyl(0.5,0.8,1.6,'#4f8a78',10,10.2,LZ-7,g,8);
    for(const dx of [-5,5])for(const dz of [-3,3]){B(2,9,2,'#9a958a',10+dx,0,LZ-7+dz,g);add(new THREE.SphereGeometry(1,10,8,0,Math.PI*2,0,Math.PI/2),'#4f8a78',10+dx,9,LZ-7+dz,g)}
    // Stadttor mit Säulen
    B(16,1.2,4,'#e2d6b8',-28,0,LZ+9,g);for(let i=0;i<6;i++)cyl(0.45,0.5,6,'#e9dfc4',-34.5+i*2.6,1.2,LZ+9,g,8);B(16,1.8,4,'#e2d6b8',-28,7.2,LZ+9,g);B(5,1.2,2,'#e2d6b8',-28,9,LZ+9,g);B(1.8,1.6,1,'#5f8f7a',-28,10.2,LZ+9,g);
    for(const dx of [-10.5,10.5])B(4,6,4,'#e2d6b8',-28+dx,0,LZ+9,g);
    // Parlament mit Kuppel
    B(18,6,9,'#ddd2b6',-28,0,LZ-8,g);for(const dx of [-8,8])for(const dz of [-3.5,3.5])B(3,8,3,'#d4c8aa',-28+dx,0,LZ-8+dz,g);
    const dome=add(new THREE.SphereGeometry(3.4,16,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#cfe3ec',metalness:0.4,roughness:0.15,transparent:true,opacity:0.85}),-28,6,LZ-8,g);
    trees(g,16,26,74,LZ-12,LZ-3);trees(g,6,-12,4,LZ+7,LZ+12);trees(g,10,-74,-42,LZ-12,LZ+12)}}};
// ---------- Besondere Felder im Stadtraster: Wahrzeichen, Parks, Wasser ----------
const MAP_CITY={wien:{top:'#a39d94',ground:'#e9e3d6',park:'#94c27c'},amsterdam:{top:'#9a958e',ground:'#e3ddd2',park:'#86bb70'},kiel:{top:'#9c938b',ground:'#e4ddd0',park:'#8fbf73'},hamburg:{top:'#8e959b',ground:'#dfe0dc',park:'#7fb37a'},berlin:{top:'#a0a29f',ground:'#e6e2d8',park:'#93c27a'}};
let topMat=null,roadGroup=null;
function ribbon(pts,w,y,col){const pos=[],idx=[];for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l*w/2,nz=dx/l*w/2;
    pos.push(pts[i][0]+nx,y,pts[i][1]+nz,pts[i][0]-nx,y,pts[i][1]-nz);if(i)idx.push(2*i-2,2*i-1,2*i,2*i-1,2*i+1,2*i)}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,typeof col==='string'?M(col):col);m.receiveShadow=true;return m}
function buildRoads(){if(!roadGroup)return;while(roadGroup.children.length){const c=roadGroup.children.pop();if(c.geometry)c.geometry.dispose()}
  const asphalt=new THREE.MeshStandardMaterial({color:(MAP_CITY[cityId]||MAP_CITY.kiel).top,roughness:0.95,side:THREE.DoubleSide}),dashM=new THREE.MeshBasicMaterial({color:'#f3f1ea',side:THREE.DoubleSide});
  const lines=[],line=(fn,a0,a1)=>{let pts=[];for(let t=a0;t<=a1+0.01;t+=1.5){const q=fn(t);if(inRiver(...q)===1){if(pts.length>1)lines.push(pts);pts=[];continue}pts.push(Wp(...q))}if(pts.length>1)lines.push(pts)};
  for(let i=0;i<=COLS;i++)line(t=>[streetX(i),t],-BD/2,BD/2);for(let i=0;i<=ROWS;i++)line(t=>[t,streetZ(i)],-BW/2,BW/2);
  for(const L of lines){roadGroup.add(ribbon(L,S,0.015,asphalt));for(let k=0;k<L.length-1;k+=2)roadGroup.add(ribbon([L[k],L[k+1]],0.18,0.03,dashM))}}
// Schild als Fläche mit Schrift
function sign(g,text,w,h,x,y,z,bg,fg,ry){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),label(text,bg||'#24272b',fg||'#ffffff'));m.position.set(x,y,z);if(ry)m.rotation.y=ry;g.add(m);return m}
// Öffentliche Gebäude: Börse, Bank, Stadion, Flughafen, Zeitung, Makler. Höhe für Auswahl und Schild wird zurückgegeben.
function civic(k,g){const st='#e9e2d0',dk='#3d4651',L=k==='stadion'||k==='flughafen'?2*P+S:P;B(L,0.3,L,k==='flughafen'?'#a9c78f':'#d9d2c4',0,0,0,g);
  if(k==='boerse'){B(8.6,0.4,6.4,'#cfc6b2',0,0.3,-0.6,g);B(8,0.4,5.8,'#d8cfbb',0,0.7,-0.6,g);B(7.4,4.4,5,st,0,1.1,-0.9,g);
    for(let i=0;i<6;i++)cyl(0.32,0.36,4.2,'#f4f1ea',-3.1+i*1.24,1.1,1.85,g,10);B(7.8,0.6,0.8,'#f4f1ea',0,5.3,1.85,g);add(prism(7.8,1.6,1),'#ece6d6',0,5.9,1.85,g);
    sign(g,'BÖRSE',4.2,0.55,0,5.6,2.27,'#24272b','#f2c14e');B(1.4,0.5,0.8,'#6b5a2a',-3.2,0.3,3.6,g);B(1,0.8,0.6,'#b07a1c',-3.2,0.8,3.6,g);add(new THREE.ConeGeometry(0.12,0.6,6),'#b07a1c',-2.75,1.75,3.6,g).rotation.z=-0.9;return 7.5}
  if(k==='bank'){B(6.8,1.6,6.4,'#3d4651',0,0.3,-0.6,g);const gl=new THREE.MeshStandardMaterial({color:'#9fc0d6',roughness:0.15,metalness:0.5});B(5.6,8,5.2,gl,0,1.9,-0.6,g);
    for(let i=1;i<8;i++)B(5.7,0.12,5.3,'#e8eef2',0,1.9+i,-0.6,g);B(6,0.6,5.6,'#3d4651',0,9.9,-0.6,g);sign(g,'HAUSBANK',4.4,0.6,0,1.1,2.62,'#2f6fd0','#ffffff');return 10.5}
  if(k==='zeitung'){B(8.4,5.2,5.6,'#9a4a35',0,0.3,-0.8,g);add(prism(8.6,1.8,5.8),'#3d4651',0,5.5,-0.8,g);for(let k2=0;k2<2;k2++)for(let i=0;i<5;i++)B(0.9,1.1,0.06,'#f4f1ea',-3.2+i*1.6,1.6+k2*1.8,2.02,g);
    sign(g,'WIRTSCHAFTSKURIER',6.4,0.7,0,4.75,2.05,'#f4f1ea','#24272b');for(let i=0;i<3;i++){const rl=cyl(0.5,0.5,1.6,'#f4f1ea',2.4+i*0,0.3,3.3-i*0,g,12);rl.rotation.z=Math.PI/2;rl.position.set(-2.5+i*2.4,0.8,3.6)}return 7.6}
  if(k==='makler'){B(7.6,6.6,5.6,'#e4d2bd',0,0.3,-0.8,g);for(let k2=0;k2<3;k2++)for(let i=0;i<4;i++)B(1.1,1,0.06,'#3d4651',-2.5+i*1.65,1.4+k2*1.8,2.02,g);
    B(2.4,2.2,0.15,'#3f9b62',0,4.6,2.1,g);add(prism(2.6,1,0.2),'#2f8a55',0,5.7,2.1,g);sign(g,'IMMOBILIEN',4.6,0.6,0,0.85,2.05,'#3f9b62','#ffffff');return 7.2}
  if(k==='stadion'){ // 2×2 Felder: ovale Arena mit Rängen, Dach und Flutlicht
    const ov=(rt,rb,h,y,col)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,40,1,true),new THREE.MeshStandardMaterial({color:col,side:THREE.DoubleSide,flatShading:true}));m.scale.z=0.72;m.position.y=y;m.castShadow=m.receiveShadow=true;g.add(m);return m};
    ov(10.4,10.8,5,2.8,'#b8443a');ov(9.6,7.6,4.4,2.8,'#e9e2d0');for(let k2=1;k2<4;k2++)ov(9.6-k2*0.5,9.6-k2*0.5+0.05,0.12,1.2+k2*1.1,'#c9c2b2');
    const roof=new THREE.Mesh(new THREE.RingGeometry(7.4,10.6,40),new THREE.MeshStandardMaterial({color:'#f4f1ea',side:THREE.DoubleSide}));roof.rotation.x=-Math.PI/2;roof.scale.y=0.72;roof.position.y=5.35;g.add(roof);
    B(12,0.12,7.2,'#4f9a4a',0,0.35,0,g);for(let i=0;i<6;i+=2)B(2,0.13,7.2,'#5aa856',-5+i*2,0.36,0,g);B(0.1,0.15,7.2,'#ffffff',0,0.37,0,g);for(const x of [-6,6])B(0.1,0.15,7.2,'#ffffff',x,0.37,0,g);
    for(const [x,z] of [[-10.4,-7.6],[10.4,-7.6],[-10.4,7.6],[10.4,7.6]]){cyl(0.22,0.3,9.5,'#5a6270',x,0.3,z,g,6);B(2,1,0.4,'#f4f1ea',x,9.8,z,g)}return 11}
  if(k==='flughafen'){ // 2×2 Felder: Start- und Landebahn, Terminal, Tower, Flugzeuge
    B(22.6,0.06,4.2,'#4a4f55',0,0.3,-7.4,g);for(let i=0;i<9;i++)B(1.4,0.08,0.24,'#f4f1ea',-9.6+i*2.4,0.33,-7.4,g);for(const x of [-10.6,10.6])for(let i=0;i<4;i++)B(0.24,0.08,0.6,'#f4f1ea',x,0.33,-8.8+i*0.95,g);
    B(3,0.05,8,'#6a6f75',-6,0.3,-1.8,g);B(16,0.05,3.4,'#6a6f75',1,0.3,1.4,g);
    const gl=new THREE.MeshStandardMaterial({color:'#9fc0d6',roughness:0.15,metalness:0.4});B(16,3.2,4.4,gl,1,0.3,6.2,g);B(16.6,0.5,5,'#e8eef2',1,3.5,6.2,g);
    for(let i=0;i<3;i++)B(0.8,0.8,2.6,'#d9dde1',-4+i*5,1.3,3,g);
    cyl(0.7,0.9,9,'#e9e4d8',-8.8,0.3,6,g,8);cyl(1.6,1.2,1.6,'#9fc0d6',-8.8,9.3,6,g,10);cyl(1.7,1.7,0.3,'#3d4651',-8.8,10.9,6,g,10);
    const plane=(x,z,ry,sc)=>{const pl=new THREE.Group();pl.position.set(x,0.3,z);pl.rotation.y=ry;pl.scale.setScalar(sc);g.add(pl);const fu=cyl(0.55,0.5,6.4,'#f4f1ea',0,0,0,pl,12);fu.rotation.z=Math.PI/2;fu.position.set(0,1,0);
      add(new THREE.SphereGeometry(0.55,10,8),'#f4f1ea',3.2,1,0,pl);B(1.6,0.1,6.6,'#d9dde1',0.2,0.9,0,pl);B(0.9,0.08,2.4,'#d9dde1',-2.8,1.2,0,pl);B(1,1.4,0.1,'#2f6fd0',-2.9,1.5,0,pl);return pl};
    plane(-4,2.4,Math.PI/2,1);plane(1,2.4,Math.PI/2,1);plane(4,-7.4,0,1.1);
    sign(g,'FLUGHAFEN',6,0.8,1,2.1,8.42,'#2f6fd0','#ffffff');return 11}
  return 4}
function special(code,id,r,c,g){seed=(r*17+c*5+id.length*11)|0||3;
  const cv=window.K&&K.CIVIC&&K.CIVIC[code];if(cv){const h=civic(cv.k,g),big='SF'.includes(code)?2*P+S:P;g.userData.pid='civic:'+cv.k;anchors['civic:'+cv.k]={x:g.position.x,y:0.3,z:g.position.z,w:big*0.92,h,d:big*0.92,rot:g.rotation.y,pin:h,civic:cv};return}
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
    if(id==='wien'){ // Dom mit hohem Südturm und gemustertem Dach
      B(8.6,5.4,4.6,'#d6cdb8',0,0.3,0.4,g);const rf=add(prism(8.8,4.2,4.8),'#c9a227',0,5.7,0.4,g);for(let i=0;i<5;i++)B(1.5,0.06,0.06,'#2f6b5a',-3+i*1.5,7.4,2.62,g);
      B(2.6,7,2.6,'#d6cdb8',-2.8,0.3,-2.6,g);add(new THREE.ConeGeometry(1.7,9,4),'#cfc5ae',-2.8,11.8,-2.6,g).rotation.y=Math.PI/4;add(new THREE.ConeGeometry(0.3,1.2,6),'#c9a227',-2.8,16.9,-2.6,g);
      for(let i=0;i<4;i++)B(0.6,2.6,0.1,'#3d4651',-2.4+i*1.6,1.6,2.72,g)}
    if(id==='amsterdam'){ // Museum aus Backstein mit zwei Türmen
      B(9,5,5,'#9a4430',0,0.3,-0.4,g);add(prism(9.2,2.2,5.2),'#3d4651',0,5.3,-0.4,g);for(const x of [-3.4,3.4]){B(2.2,8.5,2.2,'#9a4430',x,0.3,-0.4,g);add(new THREE.ConeGeometry(1.4,3,4),'#3d4651',x,10.3,-0.4,g).rotation.y=Math.PI/4;add(new THREE.SphereGeometry(0.3,8,6),'#c9a227',x,12,-0.4,g)}
      for(let k=0;k<2;k++)for(let i=0;i<5;i++)B(0.8,1.2,0.05,'#f4f1ea',-3.2+i*1.6,1+k*2,2.12,g);B(2.4,2.2,0.1,'#24272b',0,0.3,2.14,g)}
    if(id==='berlin'){ // Fernsehturm mit Pavillon
      B(7,1.4,7,'#e8e5de',0,0.3,0,g);for(let i=0;i<4;i++){const t=add(prism(3.4,1.2,1.4),'#f4f1ea',-2.2+(i%2)*4.4,1.7,-2.2+Math.floor(i/2)*4.4,g)}
      cyl(0.55,0.95,15,'#d9dcdf',0,0.3,0,g,12);add(new THREE.SphereGeometry(2.1,16,12),new THREE.MeshStandardMaterial({color:'#c9ced4',metalness:0.5,roughness:0.3}),0,16.6,0,g);
      cyl(1,1,0.5,'#8a8f96',0,18.4,0,g,12);cyl(0.25,0.36,3,'#e05a3a',0,18.9,0,g,8);cyl(0.14,0.25,2.2,'#f4f1ea',0,21.9,0,g,6)}}}
// ---------- Flüsse, Kanäle und der Emder Wall ----------
// Wasser läuft entlang eines Straßenzugs: h=1 waagerecht auf streetZ(i), sonst senkrecht auf streetX(i), von a bis b (Rasterkoordinaten).
// Querstraßen führen über Brücken, Straßen am Ende eines Kanals enden am Ufer.
const RIVERS={
  berlin:[{h:1,i:3,a:-BW/2,b:BW/2}], // Spree quer durch die Mitte
  wien:[{h:0,i:7,a:-BD/2,b:BD/2}], // Donaukanal
  amsterdam:[{h:1,i:2,a:-BW/2,b:BW/2},{h:1,i:5,a:-BW/2,b:BW/2}]}; // Grachten
// Am Fluss rücken die Häuserreihen auseinander; zum Rand hin läuft die Verschiebung aus, damit der Block seine Form behält.
const RK=4.2,RW=S+2*RK*0.8+0.8;
function rFade(r,al){const e=al<r.a?r.a-al:al>r.b?al-r.b:0;return Math.max(0,1-e/7)}
function rPush(x,z){const rs=RIVERS[cityId];if(!rs)return[x,z];let dx=0,dz=0;
  for(const r of rs){if(r.h){const z0=streetZ(r.i),f=rFade(r,x);if(!f)continue;dz+=z<z0?-RK*f*Math.max(0,z+BD/2)/(z0+BD/2):z>z0?RK*f*Math.max(0,BD/2-z)/(BD/2-z0):0}
    else{const x0=streetX(r.i),f=rFade(r,z);if(!f)continue;dx+=x<x0?-RK*f*Math.max(0,x+BW/2)/(x0+BW/2):x>x0?RK*f*Math.max(0,BW/2-x)/(BW/2-x0):0}}
  return[x+dx,z+dz]}
function inRiver(x,z){for(const r of RIVERS[cityId]||[]){const d=r.h?Math.abs(z-streetZ(r.i)):Math.abs(x-streetX(r.i)),al=r.h?x:z;if(d>S/2+0.2||al<r.a||al>r.b)continue;
    const n=r.h?COLS:ROWS,sf=r.h?streetX:streetZ;for(let j=0;j<=n;j++){const q=sf(j);if(q>r.a+S&&q<r.b-S&&Math.abs(al-q)<S/2+0.2)return 2}return 1}return 0}
// Außerhalb des Rasters wird nicht weiter gebogen
function Wq(x,z){const cx=Math.max(-WW/2,Math.min(WW/2,x)),cz=Math.max(-DD/2,Math.min(DD/2,z)),[a,b]=Wp(cx,cz);return[a+x-cx,b+z-cz]}
let waterGroup=null;const edgeTrees=[];
function buildWater(){if(!waterGroup)return;while(waterGroup.children.length){const c=waterGroup.children.pop();c.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
  const g=waterGroup,wm=new THREE.MeshStandardMaterial({color:cityId==='hamburg'?'#6f9fbf':'#5c9cbf',roughness:0.2,metalness:0.1,side:THREE.DoubleSide});
  const along=(fn,a,b)=>{const pts=[];for(let t=a;;t+=1.2){const u=Math.min(t,b);pts.push(Wq(...fn(u)));if(u>=b)break}return pts};
  const deck=M((MAP_CITY[cityId]||MAP_CITY.kiel).top);
  for(const r of RIVERS[cityId]||[]){const at=(u,o)=>r.h?[u,streetZ(r.i)+(o||0)]:[streetX(r.i)+(o||0),u];
    g.add(ribbon(along(u=>at(u),r.a,r.b),RW,0.14,wm));
    for(const e of [-1,1])g.add(ribbon(along(u=>at(u,e*(S/2+0.25)),r.a,r.b),0.5,0.2,M('#c9c2b2')));
    for(let k=0;k<r.b-r.a;k+=1.3){const u=r.a+k+0.6,o=((k*7.3)%5-2)/2*(RW/2-1.2);if(inRiver(...at(u))!==1)continue;const [cx,cz]=Wq(...at(u)),an=Wang(...at(u)),[x,z]=r.h?[cx+Math.sin(an)*o,cz+Math.cos(an)*o]:[cx+Math.cos(an)*o,cz-Math.sin(an)*o];B(1.3,0.03,0.1,'#d7ecf6',x,0.15,z,g).rotation.y=an+(r.h?0:Math.PI/2)}
    // Brücken
    const n=r.h?COLS:ROWS,sf=r.h?streetX:streetZ;
    for(let j=0;j<=n;j++){const q=sf(j);if(!(q>r.a+S&&q<r.b-S))continue;const [gx,gz]=at(q),[x,z]=Wq(gx,gz),bg=new THREE.Group();bg.position.set(x,0,z);bg.rotation.y=Wang(gx,gz)+(r.h?Math.PI/2:0);g.add(bg);
      const L=RW+1.2;B(L,0.22,S+0.2,deck,0,0.14,0,bg);B(L,0.2,S+0.6,'#b9b2a4',0,0,0,bg);for(const e of [-1,1])B(L,0.45,0.18,'#e9e4d8',0,0.36,e*(S/2+0.1),bg);for(const e of [-1,1])B(0.8,0.6,S+0.4,'#b9b2a4',e*(L/2-1.4),-0.45,0,bg)}
    // Boote zwischen den Brücken
    const stops=[];for(let j=0;j<n;j++){const m=(sf(j)+sf(j+1))/2;if(m>r.a+3&&m<r.b-3)stops.push(m)}
    stops.filter((_,k)=>k%2===0).slice(0,3).forEach((m,k)=>{const [gx,gz]=at(m,(k%2?-0.6:0.6)),[x,z]=Wq(gx,gz),bt=boat(g,x,z,cityId==='kiel'&&k===0?'#c8363b':['#f4f1ea','#2f6fd0','#6b4a2f'][k%3],3.4,true);bt.scale.setScalar(0.8);bt.rotation.y=Wang(gx,gz)+(r.h?0:Math.PI/2)})}
  if(cityId==='kiel'){ // Wall mit Bäumen und Mühlen, davor der Stadtgraben
    const ow=WW/2+1.6,od=DD/2+1.6,mw=WW/2+3.9,md=DD/2+3.9;
    const sides=[[t=>[t,-md],t=>[t,-od],-BW/2,BW/2],[t=>[t,md],t=>[t,od],-BW/2,BW/2],[t=>[-mw,t],t=>[-ow,t],-BD/2,BD/2],[t=>[mw,t],t=>[ow,t],-BD/2,BD/2]];
    const open=(x,z)=>inRiver(x,z);
    const wallM=new THREE.MeshStandardMaterial({color:'#7fae6a',flatShading:true,roughness:0.9,side:THREE.DoubleSide});let n=0;
    for(const [m,w,a,b] of sides){g.add(ribbon(along(m,a,b),2.1,0.14,wm));const wa=m===sides[0][0]||m===sides[1][0]?-ow-1.3:-od-1.3;
      let run=[];const flush=()=>{if(run.length>1)g.add(dam(run,2.8,1.6,0.6,wallM));run=[]};
      for(let t=wa;t<=-wa+0.01;t+=1){const q=w(t);if(open(...q)){flush();continue}run.push(Wq(...q))}flush();
      for(let t=wa+2;t<-wa-1;t+=3.2){const q=w(t);if(open(...q))continue;const [x,z]=Wq(...q);n++;cyl(0.1,0.14,0.9,'#6b4a2f',x,0.6,z,g,5);add(new THREE.IcosahedronGeometry(0.75,0),['#6fae5a','#5e9e4e','#86be62'][n%3],x,1.9,z,g)}}
    for(const [gx,gz] of [[ow,-od],[-ow,od],[ow,DD/4]]){const [x,z]=Wq(gx,gz),mg=new THREE.Group();mg.position.set(x,0.6,z);mg.scale.setScalar(0.5);g.add(mg);windmill(mg,0,0)}}
  g.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=o.position.y>0.2}});
  for(const t of edgeTrees){const v=cityId!=='kiel'&&!inRiver(t.x,t.z);t.o.forEach(o=>o.visible=v)}}
// Damm mit schrägen Flanken: unten breit, oben schmal
function dam(pts,wb,wt,h,mat){const pos=[],idx=[],n=pts.length,side=(i,o)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return[pts[i][0]-dz/l*o,pts[i][1]+dx/l*o]};
  const strip=(o1,y1,o2,y2)=>{const s0=pos.length/3;for(let i=0;i<n;i++){const p=side(i,o1),q=side(i,o2);pos.push(p[0],y1,p[1],q[0],y2,q[1]);if(i)idx.push(s0+2*i-2,s0+2*i-1,s0+2*i,s0+2*i-1,s0+2*i+1,s0+2*i)}};
  strip(wb/2,0.1,wt/2,h);strip(wt/2,h,-wt/2,h);strip(-wt/2,h,-wb/2,0.1);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();const m=new THREE.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;return m}
// Lücken zwischen Feldern desselben Blocks füllen: Platz, Park oder Wasser. Autos meiden diese Flächen.
const gaps=[];
const PLAZA={kiel:'#cdb8a4',hamburg:'#c9cdd0',berlin:'#d3cdbf',wien:'#d8cdb6',amsterdam:'#c9bba8'};
function fillGaps(G){gaps.length=0;const map=K.CITY_MAP[cityId],bl=K.CITY_BLOCKS&&K.CITY_BLOCKS[cityId];if(!map||!bl)return;
  const g=new THREE.Group();g.userData.cell='gaps';plotGroup.add(g);
  const kind=(a,b)=>a==='A'&&b==='A'?'A':a==='P'&&b==='P'?'P':'Z';
  const col=k=>k==='A'?'#5c9cbf':k==='P'?(MAP_CITY[cityId]||MAP_CITY.kiel).park:PLAZA[cityId]||'#d0c8bc';
  const put=(x0,z0,w,d,k)=>{gaps.push({x0:x0-w/2,x1:x0+w/2,z0:z0-d/2,z1:z0+d/2,k});const [x,z]=Wp(x0,z0);w+=0.8;d+=0.8;const m=B(w,k==='A'?0.1:0.16,d,col(k),x,k==='A'?-0.02:0,z,g);m.rotation.y=Wang(x0,z0);
    if(k==='Z'&&w*d>14){for(let i=0;i<2;i++){const tx=x+(i?1:-1)*w*0.25,tz=z+(i?-1:1)*d*0.25;cyl(0.1,0.14,0.9,'#6b4a2f',tx,0.16,tz,g,5);add(new THREE.IcosahedronGeometry(0.7,0),'#6fae5a',tx,1.6,tz,g)}B(1.2,0.35,0.4,'#7a5a3a',x,0.16,z,g)}
    if(k==='P'){cyl(0.12,0.16,1,'#6b4a2f',x,0.16,z,g,5);add(new THREE.IcosahedronGeometry(0.9,0),'#5e9e4e',x,1.8,z,g)}};
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const id=bl[r][c];
    if(c<COLS-1&&bl[r][c+1]===id)put((px(c)+px(c+1))/2,pz(r),S+0.2,P,kind(map[r][c],map[r][c+1]));
    if(r<ROWS-1&&bl[r+1][c]===id)put(px(c),(pz(r)+pz(r+1))/2,P,S+0.2,kind(map[r][c],map[r+1][c]));
    if(c<COLS-1&&r<ROWS-1&&bl[r][c+1]===id&&bl[r+1][c]===id&&bl[r+1][c+1]===id)put((px(c)+px(c+1))/2,(pz(r)+pz(r+1))/2,S+0.2,S+0.2,kind(map[r][c],map[r+1][c+1]));
    if(r===0&&map[r][c]==='A'){const z1=pz(0)-P/2,z0=-DD/2-MARGIN;put(px(c),(z0+z1)/2,P,z1-z0+0.1,'A');g.children[g.children.length-1].position.y=0.06}}
  g.traverse(o=>{if(o.isMesh)o.receiveShadow=true})}
const inGap=(x,z,water)=>{for(const q of gaps)if(x>q.x0&&x<q.x1&&z>q.z0&&z<q.z1&&(!water||q.k==='A'))return true;return false};
function buildSpecials(G){const map=window.K&&K.CITY_MAP&&K.CITY_MAP[cityId];if(!map)return;if(!G.plots.some(p=>p.city===cityId&&'PALKNSFZM'.includes(map[p.r][p.c])))fillGaps(G);else gaps.length=0;
  for(let r=0;r<map.length;r++)for(let c=0;c<map[r].length;c++){const code=map[r][c];if(!'PALKNSFZM'.includes(code))continue;if(G.plots.some(p=>p.city===cityId&&p.r===r&&p.c===c))continue;
    if('SF'.includes(code)&&((r>0&&map[r-1][c]===code)||(c>0&&map[r][c-1]===code)))continue; // 2×2 nur einmal, mittig
    const g=new THREE.Group();g.userData.cell='x'+r+'-'+c;if('SF'.includes(code)){const cx=(px(c)+px(c+1))/2,cz=(pz(r)+pz(r+1))/2,[x,z]=Wp(cx,cz);g.position.set(x,0,z);g.rotation.y=Wang(cx,cz)}else placeCell(g,r,c);plotGroup.add(g);special(code,cityId,r,c,g);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}})}}
function buildLand(id){if(topMat)topMat.color.set((MAP_CITY[id]||MAP_CITY.kiel).ground);if(!landGroup)return;while(landGroup.children.length){const c=landGroup.children.pop();c.traverse(o=>{if(o.geometry)o.geometry.dispose()})}landAnim.length=0;
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
  roadGroup=new THREE.Group();root.add(roadGroup);waterGroup=new THREE.Group();root.add(waterGroup);
  // Bäume und Laternen am Rand
  for(let i=0;i<72;i++){const side=i%4,t=rnd();let x,z;if(side<2){x=-BW/2+2+t*(BW-4);z=side?BD/2-2.2:-BD/2+2.2}else{z=-BD/2+2+t*(BD-4);x=side===2?-BW/2+2.2:BW/2-2.2}
    edgeTrees.push({x,z,o:[add(new THREE.CylinderGeometry(0.12,0.16,1,5),'#6b4a2f',x,0.6,z),add(new THREE.IcosahedronGeometry(0.9+rnd()*0.3,0),['#6fae5a','#5e9e4e','#86be62'][i%3],x,1.7,z)]})}
  plotGroup=new THREE.Group();root.add(plotGroup);
  const ringGeo=new THREE.RingGeometry(P*0.62,P*0.7,4,1);ringGeo.rotateZ(Math.PI/4);ringGeo.rotateX(-Math.PI/2);
  selRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:'#24272b',transparent:true,opacity:0.85,depthWrite:false}));selRing.visible=false;selRing.renderOrder=5;root.add(selRing);
  hoverRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:'#24272b',transparent:true,opacity:0.25,depthWrite:false}));hoverRing.visible=false;root.add(hoverRing);
  // Auf dem Handy passt die ganze Stadt aufs Bild: etwas weiter weg und mittig über dem Dock
  if((cv.clientWidth||innerWidth)<=760){view.zoom=0.74;view.tz=-44;view.tx=8}
  initWalkers();initCars();resize();applyView()}

// ---------- Kamera ----------
function applyView(){view.tilt=Math.min(1.35,Math.max(0.35,view.tilt));view.zoom=Math.min(3.2,Math.max(0.55,view.zoom));
  const d=150,cp=Math.cos(view.tilt);camera.position.set(view.tx+d*Math.sin(view.tilt)*Math.sin(view.yaw),d*cp+20,view.tz+d*Math.sin(view.tilt)*Math.cos(view.yaw));
  camera.lookAt(view.tx,0,view.tz);camera.zoom=view.zoom;camera.updateProjectionMatrix()}
// Karte verschieben: Bildschirmpixel in Bodenkoordinaten umrechnen
function pan(dx,dy){const u=(camera.right-camera.left)/camera.zoom/(canvas.clientWidth||innerWidth),c=Math.cos(view.yaw),s=Math.sin(view.yaw),k=1/Math.max(0.3,Math.cos(view.tilt));
  view.tx-=(dx*c+dy*s*k)*u;view.tz-=(-dx*s+dy*c*k)*u;view.tx=Math.max(-BW/2,Math.min(BW/2,view.tx));view.tz=Math.max(-BD/2-LD,Math.min(BD/2,view.tz));applyView()}
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
function setCity(G,id){if(cityId===id)return;cityId=id;WARP=WARPS[id]||null;buildLand(id);buildRoads();buildWater();sig={};for(const k in cells)delete cells[k];for(const k in anchors)delete anchors[k];
  while(plotGroup.children.length){const c=plotGroup.children.pop();c.traverse(o=>{if(o.geometry)o.geometry.dispose()})}bases=[];buildSpecials(G);sync(G,true)}
function sync(G,force){G0=G;if(!plotGroup)return;
  const byCell={};for(const p of G.plots){if(p.city!==cityId)continue;(byCell[p.r+'-'+p.c]=byCell[p.r+'-'+p.c]||[]).push(p)}
  for(const key in byCell){const list=byCell[key],us=list.map(p=>plotSig(G,p)),s=us.join('#');if(!force&&sig[key]===s)continue;
    const prev=cells[key]?cells[key].sigs:{};sig[key]=s;
    const old=plotGroup.children.find(c=>c.userData.cell===key);if(old){plotGroup.remove(old);old.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
    const g=new THREE.Group();g.userData.cell=key;const p0=list[0];placeCell(g,p0.r,p0.c);plotGroup.add(g);
    const parts=buildCell(G,list,g);cells[key]={sigs:{}};list.forEach((p,i)=>{cells[key].sigs[p.id]=us[i];
      if(!force&&old&&prev[p.id]!==us[i]&&parts[p.id]){for(const o of parts[p.id])grow.push({g:o,t:0,pop:true})}})}
  bases=[];plotGroup.traverse(o=>{if(o.userData.base)bases.push(o)});
  updateWalkerDensity(G)}
function unitGroup(g,pid){const u=new THREE.Group();u.userData.pid=pid;g.add(u);return u}
function buildCell(G,list,g){const p0=list[0];seed=(p0.r*31+p0.c*7+(p0.city||'').length*13)|0||5;
  const zone=p0.zone,slots=SLOTS[zone],used=new Set(),units=slots.map((k,i)=>{let p=list.find(q=>q.u===i);
    if(!p)p=list.find(q=>q.u===undefined&&!used.has(q)&&dispKind(q)===k);if(p)used.add(p);return p||null});
  const def=(units.find(Boolean)||p0).id,parts={};
  const bg=(MAP_CITY[cityId]||MAP_CITY.kiel),base=B(P,0.25,P,zone==='gewerbe'?'#d8d2c4':shade3(bg.ground,0.95),0,0,0,unitGroup(g,def));base.userData.base=true;
  if(zone==='wohn'){const gw=3+rnd()*4,gd=1.6+rnd()*1.4;B(gw,0.04,gd,bg.park,(rnd()-0.5)*(P-gw),0.25,-P/2+gd/2+0.3,g);if(rnd()<0.7){const tx=(rnd()-0.5)*6;cyl(0.1,0.14,0.8,'#6b4a2f',tx,0.25,-P/2+1,g,5);add(new THREE.IcosahedronGeometry(0.7,0),'#6fae5a',tx,1.5,-P/2+1,g)}}
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
    const [wx,wz]=toW(g,a.x,a.z);if(a.fz!==undefined){const f=toW(g,a.x,a.fz);a.fx=f[0];a.fz=f[1]}a.x=wx;a.z=wz;a.rot=g.rotation.y;anchors[p.id]=a});
  for(const [p,I,x,y,z] of pins){const sp=pin(I,p);sp.position.set(x,y,z);g.add(sp);(parts[p.id]=parts[p.id]||[]).push(sp);anchors[p.id].pin=y;const pw=toW(g,x,z);anchors[p.id].pinX=pw[0];anchors[p.id].pinZ=pw[1]}
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
function initCars(){const geo=new THREE.BoxGeometry(1.6,0.7,0.8);geo.translate(0,0.45,0);cInst=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.6}),48);
  cInst.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(48*3),3);cInst.castShadow=true;root.add(cInst);
  const cols=['#f4f1ea','#d63c3c','#3d78d8','#24272b','#f2c14e','#9da3a8'].map(c=>new THREE.Color(c));
  for(let i=0;i<48;i++){cInst.setColorAt(i,cols[i%cols.length]);cData.push({horiz:i%2===0,line:i%(i%2?COLS+1:ROWS+1),t:rnd(),dir:i%4<2?1:-1,v:0.03+rnd()*0.02})}}
const O=new THREE.Object3D();
function moveOnGrid(o,dt,lane){ // läuft entlang einer Straße und biegt an Kreuzungen manchmal ab
  const L=o.horiz?WW:DD,prev=o.t*L-L/2;o.t+=o.v*o.dir*dt/L*60;if(o.t>1){o.t=1;o.dir=-1}if(o.t<0){o.t=0;o.dir=1}
  const cur=o.t*L-L/2,n=o.horiz?COLS:ROWS,sf=o.horiz?streetX:streetZ;
  for(let i=0;i<=n;i++){const s=sf(i);if((prev-s)*(cur-s)<0&&rnd()<0.3){const fixed=o.horiz?streetZ(o.line):streetX(o.line);o.horiz=!o.horiz;o.line=i;const L2=o.horiz?WW:DD;o.t=(fixed+L2/2)/L2;o.dir=rnd()<0.5?1:-1;break}}
  const a=o.t*(o.horiz?WW:DD)-(o.horiz?WW:DD)/2;return o.horiz?[a,streetZ(o.line)+lane]:[streetX(o.line)+lane,a]}
function animate(dt){
  for(let i=0;i<WMAX;i++){if(i>=wCount){O.position.set(0,-50,0);O.scale.setScalar(0.001);O.updateMatrix();wInst.setMatrixAt(i,O.matrix);continue}
    const w=wData[i];const [gx,gz]=moveOnGrid(w,dt*0.05,w.side),[x,z]=Wp(gx,gz),rv=inRiver(gx,gz);if(inGap(gx,gz,true)||rv===1){O.position.set(0,-50,0);O.scale.setScalar(0.001);O.updateMatrix();wInst.setMatrixAt(i,O.matrix);continue}O.position.set(x,(rv?0.36:0.12)+Math.abs(Math.sin(performance.now()/180+i))*0.05,z);O.scale.setScalar(1);O.rotation.set(0,0,0);O.updateMatrix();wInst.setMatrixAt(i,O.matrix)}
  wInst.instanceMatrix.needsUpdate=true;
  for(let i=0;i<cData.length;i++){const c=cData[i];const [gx,gz]=moveOnGrid(c,dt*0.07,(c.dir>0?0.55:-0.55)),[x,z]=Wp(gx,gz),q=c.horiz?Wp(gx+0.5,gz):Wp(gx,gz+0.5),rv=inRiver(gx,gz);
    if(rv===1){c.dir=-c.dir;c.wet=(c.wet||0)+1;if(c.wet>3){c.horiz=!c.horiz;c.line=Math.floor(rnd()*((c.horiz?ROWS:COLS)+1));c.t=rnd();c.wet=0}}else c.wet=0;
    O.position.set(x,rv===2?0.36:0,z);O.rotation.set(0,-Math.atan2(q[1]-z,q[0]-x),0);O.scale.setScalar(inGap(gx,gz,false)||rv===1?0.001:1);O.updateMatrix();cInst.setMatrixAt(i,O.matrix)}
  cInst.instanceMatrix.needsUpdate=true}

// ---------- Auswahl und Interaktion ----------
function plotAt(cx,cy){const r=canvas.getBoundingClientRect();const v=new THREE.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);ray.setFromCamera(v,camera);
  const hit=ray.intersectObjects(plotGroup.children,true)[0];if(!hit)return null;let o=hit.object;while(o&&!o.userData.pid)o=o.parent;return o?o.userData.pid:null}
function boxAt(a,m){const o=new THREE.Mesh(new THREE.BoxGeometry(a.w,a.h,a.d),m);o.position.set(a.x,a.y+a.h/2,a.z);o.rotation.y=a.rot||0;o.renderOrder=6;return o}
let selBox=null,hovBox=null;const edgeGeo={};
function edgeBox(a,color,op){const k=[a.w,a.h,a.d].map(v=>v.toFixed(2)).join('x');if(!edgeGeo[k])edgeGeo[k]=new THREE.EdgesGeometry(new THREE.BoxGeometry(a.w,a.h,a.d));
  const o=new THREE.LineSegments(edgeGeo[k],new THREE.LineBasicMaterial({color,transparent:true,opacity:op,depthTest:false}));o.position.set(a.x,a.y+a.h/2,a.z);o.rotation.y=a.rot||0;o.renderOrder=9;return o}
function select(pid){sel=pid;if(selBox){root.remove(selBox);selBox=null}const a=pid&&anchors[pid];selRing.visible=!!a;
  if(a){selRing.scale.set(a.w/P*0.8,1,a.d/P*0.8);selRing.position.set(a.x,0.3,a.z);selRing.rotation.y=a.rot||0;selBox=edgeBox(a,'#24272b',0.9);root.add(selBox)}}
function hover(pid){if(hovBox){root.remove(hovBox);hovBox=null}const a=pid&&pid!==sel&&anchors[pid];hoverRing.visible=false;if(a){hovBox=edgeBox(a,'#24272b',0.35);root.add(hovBox)}}
function project(pid,y){const a=anchors[pid];if(!a)return null;const pinX=a.pinX!==undefined?a.pinX:a.x,v=y==='pin'?new THREE.Vector3(pinX,(a.pin||a.y+a.h)+4.8,a.pinZ!==undefined?a.pinZ:a.z):a.fz!==undefined&&y!==undefined?new THREE.Vector3(a.fx,a.y+a.h*0.45,a.fz):new THREE.Vector3(a.x,y===undefined?a.y+a.h:Math.max(y,a.y+a.h*0.6),a.z);v.project(camera);
  const r=canvas.getBoundingClientRect();return{x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height,vis:v.z<1}}
function highlight(list,color){for(const m of marks){root.remove(m)}marks.length=0;if(!list||!list.length)return;
  for(const it of list){const pid=Array.isArray(it)?it[0]:it,col=Array.isArray(it)?it[1]:color;const a=anchors[pid];if(!a)continue;const m=boxAt({...a,w:a.w+0.3,h:a.h+0.3,d:a.d+0.3,y:a.y-0.15},new THREE.MeshBasicMaterial({color:col||'#3f9b62',transparent:true,opacity:Array.isArray(it)?0.6:0.4,depthWrite:false}));root.add(m);marks.push(m);
    // Säule über der Fläche: Höhe zeigt die Laufkundschaft
    if(Array.isArray(it)&&it[2]!==undefined){const hh=1.5+it[2]*11,c=new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.85,hh,10),new THREE.MeshBasicMaterial({color:col}));c.position.set(a.pinX!==undefined?a.pinX:a.x,a.y+a.h+0.6+hh/2,a.pinZ!==undefined?a.pinZ:a.z);c.userData.bar=true;root.add(c);marks.push(c)}}}
let last=0;function frame(t){const dt=Math.min(0.05,(t-last)/1000||0.016);last=t;animate(dt*60);for(const f of landAnim)f(t);
  for(let i=grow.length-1;i>=0;i--){const a=grow[i];if(a.pop){a.t+=dt/0.5;const k=Math.min(1,a.t),e=k<1?1-Math.pow(1-k,3)*Math.cos(k*7):1;const sc=Math.max(0.01,e);a.g.scale.set(a.g.isSprite?3.6*sc*(a.g.userData.sc||1):sc,a.g.isSprite?4.5*sc*(a.g.userData.sc||1):sc,1*(a.g.isSprite?1:sc));if(k>=1){if(!a.g.isSprite)a.g.scale.set(1,1,1);grow.splice(i,1)}continue}
    a.t+=dt/0.7;const k=Math.min(1,a.t),e=1+Math.sin(k*Math.PI)*0.18*(1-k)+(k<1?-(1-k)*(1-k):0);a.g.scale.set(1,Math.max(0.02,k<1?k*k*(3-2*k)*(1+0.15*Math.sin(k*Math.PI)):1),1);if(k>=1){a.g.scale.set(1,1,1);grow.splice(i,1)}}
  for(const m of marks)if(!m.userData.bar)m.material.opacity=0.3+0.2*Math.sin(t/260);
  if(selRing.visible)selRing.material.opacity=0.6+0.3*Math.sin(t/300);renderer.render(scene,camera)}
function setLogo(svg){const im=new Image();im.onload=()=>{logoImg=im;for(const k in pinTex)delete pinTex[k];if(G0&&plotGroup)sync(G0,true)};im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}
window.World={civics:()=>Object.entries(anchors).filter(([k])=>k.startsWith('civic:')).map(([id,a])=>({id,n:a.civic.n,icon:a.civic.icon})),pan,init,setLogo,resize,setCity,sync,select,hover,plotAt,project,frame,view,applyView,highlight,get city(){return cityId}};
})();
