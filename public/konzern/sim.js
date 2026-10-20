// Gründerzeit: Wirtschaftsmodell ohne DOM. Ein Tick ist ein Tag, ein Monat hat 30 Tage, ein Jahr 12 Monate.
// Alles hängt am Spielstand G (reines JSON, speicherbar). Aktionen geben {ok,msg} zurück.
(function(root){
'use strict';
const DPM=30,TAX=0.30,EMP=1.21; // Lohnnebenkosten Arbeitgeber
const MONTHS=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

// ---------- Kataloge ----------
const BRANCHES={
  cafe:{n:'Café',long:'Gastronomie',desc:'Standortwahl, Einrichtung, Rezepturen und Laufkundschaft. Gute Lagen sind teuer, gute Bohnen auch.',color:'#c8643c',mult:7},
  soft:{n:'Software',long:'Software & Apps',desc:'Entwicklerteams, Releases, Bugs, Nutzerzahlen und Abo-Umsätze. Lange kein Umsatz, dann schnelles Wachstum.',color:'#2f6fd0',mult:10},
  prod:{n:'Produktion',long:'Produktion',desc:'Fabriken, Rohstoffeinkauf, Produktionslinien und Aufträge vom Handel. Teurer Start, solide Margen.',color:'#3f9b62',mult:6}};
const WAGE={barista:2300,jr:3600,sr:6200,qa:3900,worker:2900,admin:3400}; // Monatsbrutto
const ROLE_N={barista:'Barista',jr:'Junior-Entwickler',sr:'Senior-Entwickler',qa:'Tester',worker:'Produktion',admin:'Verwaltung'};
const PRODUCTS={ // Café-Sortiment: other = Zutaten ohne Bohnen/Backware je Stück, beans = kg Röstkaffee, piece = Backware
  espresso:{n:'Espresso',other:0.12,beans:0.009,ref:2.4,w:1.0},
  cappu:{n:'Cappuccino',other:0.36,beans:0.009,ref:3.6,w:1.6},
  filter:{n:'Filterkaffee',other:0.08,beans:0.012,ref:2.6,w:0.9},
  kuchen:{n:'Kuchen',other:0.45,piece:1,mkt:1.0,ref:3.9,w:0.8},
  bagel:{n:'Bagel',other:0.8,piece:1,mkt:0.9,ref:5.4,w:0.7,res:'bagel'},
  chai:{n:'Chai Latte',other:0.7,ref:4.2,w:0.8,res:'chai'},
  coldbrew:{n:'Cold Brew',other:0.25,beans:0.02,ref:4.4,w:0.8,res:'coldbrew'},
  bowl:{n:'Frühstücksbowl',other:2.8,ref:8.9,w:0.6,res:'bowl'}};
const QMULT=[0,1,1.45,2.1],QUAL=[0,0.45,0.7,0.93];
const LEVELS=[null,{n:'Einfach',cost:15000,comfort:0.6},{n:'Gemütlich',cost:25000,comfort:0.8},{n:'Design',cost:45000,comfort:0.95}];
const GENRES={
  prod:{n:'Produktivität',pot:600000,conv:1.0,adv:0.8},
  fit:{n:'Fitness',pot:900000,conv:0.8,adv:1.0},
  game:{n:'Spiele',pot:3000000,conv:0.35,adv:1.6,res:'games'},
  fin:{n:'Fintech',pot:400000,conv:1.6,adv:0.5,res:'fintech'}};
const SCOPES={S:{n:'Klein',work:220,q:0,pot:0.5},M:{n:'Mittel',work:650,q:0.05,pot:1},L:{n:'Groß',work:1600,q:0.1,pot:1.7}};
const RAW={holz:{n:'Holz',unit:'Bretter',p:4.5},rohkaffee:{n:'Rohkaffee',unit:'kg',p:5.2},mehl:{n:'Mehl',unit:'kg',p:0.55}};
const GOODS={
  stuhl:{n:'Stühle',unit:'Stk',mat:{holz:4},ref:52,ship:1.5},
  tisch:{n:'Tische',unit:'Stk',mat:{holz:11},ref:165,ship:4,res:'tisch'},
  bohnen:{n:'Röstkaffee',unit:'kg',mat:{rohkaffee:1.2},ref:15.5,ship:0.3},
  gebaeck:{n:'Gebäck',unit:'Stk',mat:{mehl:0.12},ref:0.95,ship:0.02,res:'back'}};
const LINES={
  moebel:{n:'Möbel-Linie',cost:70000,workers:6,cap:{stuhl:46,tisch:17},energy:1400},
  roest:{n:'Rösterei',cost:48000,workers:3,cap:{bohnen:120},energy:1100},
  back:{n:'Backstraße',cost:55000,workers:5,cap:{gebaeck:2200},energy:1300,res:'back'}};
const GMULT=[0,1,1.25,1.6],GQUAL=[0,0.5,0.72,0.92];
const RESEARCH={
  cafe:{
    bagel:{n:'Bagel-Rezeptur',cost:6000,days:20,d:'Neues Produkt: Bagel'},
    chai:{n:'Chai Latte',cost:8000,days:30,d:'Neues Produkt: Chai Latte'},
    coldbrew:{n:'Cold Brew',cost:10000,days:30,d:'Neues Produkt: Cold Brew, stark an heißen Tagen'},
    bowl:{n:'Frühstücksbowls',cost:15000,days:45,d:'Neues Produkt mit hohem Bon'},
    schnell:{n:'Schnellere Abläufe',cost:18000,days:40,d:'+25 % Kunden pro Barista'},
    treue:{n:'Treue-App',cost:22000,days:60,d:'+12 % Stammkundschaft in allen Filialen'}},
  soft:{
    ci:{n:'Automatisierte Tests',cost:20000,days:40,d:'40 % weniger neue Bugs'},
    cloud:{n:'Eigene Cloud-Plattform',cost:25000,days:45,d:'40 % weniger Serverkosten'},
    ki:{n:'KI-Funktionen',cost:40000,days:60,d:'+10 % Qualität bei neuen Projekten'},
    games:{n:'Spiele-Engine',cost:30000,days:50,d:'Neues Genre: Spiele'},
    fintech:{n:'Banklizenz-Partner',cost:35000,days:60,d:'Neues Genre: Fintech'}},
  prod:{
    tisch:{n:'Tisch-Konstruktion',cost:12000,days:30,d:'Neues Produkt: Tische auf der Möbel-Linie'},
    back:{n:'Backstraße',cost:15000,days:30,d:'Neue Linie: Gebäck, beliefert auch eigene Cafés'},
    auto:{n:'Automatisierung',cost:50000,days:60,d:'+30 % Ausstoß aller Linien'},
    qm:{n:'Qualitätsmanagement',cost:25000,days:45,d:'Bessere Preise bei Aufträgen'}}};
const CITIES=[
  {id:'kiel',n:'Kiel',traffic:1.0,rent:1.0},
  {id:'hamburg',n:'Hamburg',traffic:1.45,rent:1.5,unlock:{staff:12,cost:60000}},
  {id:'berlin',n:'Berlin',traffic:1.6,rent:1.35,unlock:{staff:50,cost:120000}}];
const ZONES={
  city:{n:'Innenstadt',traffic:[4200,7000],rent:[3600,6200],size:[80,140],uses:['cafe','office','hq']},
  wohn:{n:'Wohnviertel',traffic:[1500,3000],rent:[1700,2600],size:[100,170],uses:['cafe']},
  buero:{n:'Büroviertel',traffic:[2200,3600],rent:[2600,4200],size:[300,650],uses:['cafe','office','hq']},
  gewerbe:{n:'Gewerbegebiet',traffic:[300,800],rent:[1500,2600],size:[1500,3000],uses:['factory']}};
const ZONE_MAP=[ // 5 Reihen × 6 Spalten, oben die Büros, unten das Gewerbe
  ['wohn','buero','buero','buero','buero','wohn'],
  ['wohn','city','city','city','city','wohn'],
  ['wohn','city','city','city','city','wohn'],
  ['wohn','wohn','buero','buero','wohn','wohn'],
  ['gewerbe','gewerbe','gewerbe','gewerbe','gewerbe','gewerbe']];
const COLS=6,ROWS=5;
const STAGES=[[0,'Gründung'],[6,'Kleinunternehmen'],[50,'Mittelstand'],[250,'Großunternehmen'],[1000,'Konzern']];
const DEPTS={hr:{n:'Personal',d:'Bessere Stimmung, weniger Kündigungen'},mkt:{n:'Marketing',d:'Werbebudgets wirken 35 % stärker'},
  ctrl:{n:'Controlling',d:'5 % weniger Miete und Nebenkosten, keine Extra-Verwaltung'},rd:{n:'Forschung',d:'Forschung 60 % schneller, etwas mehr Qualität'}};
const COMP_CAFE={kiel:[['Bohnenwerk','#8a6a52',0.66,1.0,3],['Kaffeekontor','#6b7a8f',0.56,0.9,2]],
  hamburg:[['Elbröster','#4f7d8c',0.72,1.08,4],['Bohnenwerk','#8a6a52',0.66,1.0,2]],
  berlin:[['Spreebohne','#7d5c8c',0.7,1.02,4],['Kiezkaffee','#a07a3a',0.6,0.88,3]]};
const COMP_APPS=[['Notio','prod',0.7,90000],['Listly','prod',0.58,40000],['FitBuddy','fit',0.62,120000],['RunRun','fit',0.55,60000],
  ['Pixelquest','game',0.66,400000],['Klickfarm','game',0.5,250000],['Spargroschen','fin',0.68,50000]];
const COMP_PROD={kiel:[['Nordholz Werke','#9a8f7a']],hamburg:[['Hanse Möbel','#7a8a9a'],['Speicherstadt Rösterei','#8a6a52']],berlin:[['Spree Manufaktur','#7a7a8a']]};
const BUYERS={stuhl:['Möbelhaus Nord','Wohnwelt','Schulträger Kiel','Hotelkette Seeblick'],tisch:['Wohnwelt','Möbelhaus Nord','Kantinenbau AG'],
  bohnen:['Bohnenwerk','Supermarkt Regional','Hotelkette Seeblick','Bürokaffee GmbH'],gebaeck:['Supermarkt Regional','Kantinenbau AG','Tankstellen-Shops']};
const APP_NAMES=['Taskly','Fokus','Planwerk','Pulse','Kraftakt','Moneta','Zenith','Kompass','Nordlicht','Orbit','Brise','Spark','Atlas','Quokka','Lumen'];

// ---------- Zufall (gespeichert im Spielstand) ----------
function rand(G){let t=(G.rs=(G.rs+0x6D2B79F5)|0);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}
const rr=(G,a,b)=>a+(b-a)*rand(G);
const pick=(G,arr)=>arr[Math.floor(rand(G)*arr.length)];

// ---------- Spielstand ----------
function newGame(o){
  const G={v:1,rs:(o.seed||Date.now())|0,day:0,cash:0,paidIn:0,retained:0,owner:1,rounds:0,public:false,shares:1e6,sharePrice:0,priceHist:[],
    firms:[],plots:[],comps:[],apps:[],loans:[],assets:[],nextId:1,cities:{kiel:true},cityCur:'kiel',hq:null,depts:{},
    led:null,months:[],news:[],idx:{rohkaffee:1,holz:1,mehl:1,wage:1},events:{},offers:{contracts:[]},
    tax:{paidYTD:0,carry:0},overdraft:0,insolvT:0,over:null,ms:{},founderDev:true,speedHint:0};
  G.led=emptyLedger();
  for(const c of CITIES)genCity(G,c);
  // Konkurrenz
  for(const c of CITIES)for(const [n,col,q,p,shops] of COMP_CAFE[c.id]){const cp=addComp(G,{branch:'cafe',name:n,color:col,q,price:p,city:c.id,rep:0.55+q*0.2});
    for(let k=0;k<shops;k++)compOpen(G,cp)}
  for(const [n,g,q,u] of COMP_APPS){const cp=addComp(G,{branch:'soft',name:n,color:'#8a8f96',q});G.apps.push({id:uid(G),owner:'c:'+cp.id,name:n,genre:g,scope:'M',state:'live',progress:1,work:1,quality:q,bugs:20,users:u,weight:1,model:'abo',price:4.99,released:-200})}
  for(const c of CITIES)for(const [n,col] of COMP_PROD[c.id]){const cp=addComp(G,{branch:'prod',name:n,color:col,q:0.6,city:c.id});const pl=freePlots(G,c.id,'factory')[0];if(pl){pl.owner='c:'+cp.id;pl.use='factory'}}
  const cash=o.capital||50000;equity(G,cash,'Eigenkapital des Gründers');
  if(o.finance==='loan')takeLoan(G,{amount:o.branch==='prod'?120000:60000,rate:0.065,months:60,name:'Gründerkredit'});
  if(o.finance==='angel'){equity(G,150000,'Business Angel');G.owner*=0.8;G.rounds=1;news(G,'Ein Business Angel steigt mit 150.000 € ein und erhält 20 % der Anteile.','fin')}
  const f=foundFirm(G,o.branch,o.name||'Mein Start-up',true);
  news(G,'Willkommen! '+f.name+' ist gegründet. '+firstHint(f),'tip');
  genContracts(G,true);
  return G}
function firstHint(f){return f.branch==='cafe'?'Wähle in der Innenstadt oder im Wohnviertel ein freies Grundstück für deine erste Filiale.':
  f.branch==='soft'?'Du startest im Homeoffice. Stelle Entwickler ein und starte dein erstes App-Projekt.':
  'Miete ein Grundstück im Gewerbegebiet und kaufe deine erste Produktionslinie.'}
function uid(G){return G.nextId++}
function emptyLedger(){return{f:{},H:fz(),cf:{op:0,inv:0,fin:0}}}
function fz(){return{rev:0,revInt:0,cogs:0,staff:0,rent:0,mkt:0,rd:0,other:0,dep:0,int:0,tax:0}}
function L(G,fid){if(fid==='H')return G.led.H;return G.led.f[fid]||(G.led.f[fid]=fz())}
function news(G,t,k){G.news.unshift({d:G.day,t,k:k||'info'});if(G.news.length>60)G.news.length=60}

// Geldbewegungen: Aufwand (pay) oder Ertrag (earn) mit GuV-Konto und Kapitalfluss-Art
function pay(G,fid,acc,amt,cf){if(!amt)return;G.cash-=amt;if(acc)L(G,fid)[acc]+=amt;G.led.cf[cf||'op']-=amt}
function earn(G,fid,acc,amt,cf){if(!amt)return;G.cash+=amt;if(acc)L(G,fid)[acc]+=amt;G.led.cf[cf||'op']+=amt}
function equity(G,amt,why){G.cash+=amt;G.paidIn+=amt;G.led.cf.fin+=amt}
function buyAsset(G,fid,name,cost,life,ref){G.cash-=cost;G.led.cf.inv-=cost;const a={id:uid(G),fid,name,cost,life,book:cost,ref:ref||null};G.assets.push(a);return a}
function dropAssets(G,ref){ // Abgang: Restbuchwert wird Aufwand
  for(const a of G.assets.filter(a=>a.ref===ref)){L(G,a.fid).dep+=a.book;a.book=0}G.assets=G.assets.filter(a=>a.book>0.01)}

// ---------- Stadt ----------
function genCity(G,c){
  for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){const z=ZONES[ZONE_MAP[r][col]];
    const t=rr(G,z.traffic[0],z.traffic[1])*c.traffic,rent=rr(G,z.rent[0],z.rent[1])*c.rent,size=rr(G,z.size[0],z.size[1]);
    G.plots.push({id:c.id+'-'+r+'-'+col,city:c.id,r,c:col,zone:ZONE_MAP[r][col],traffic:Math.round(t/50)*50,rent:Math.round(rent/50)*50,size:Math.round(size/10)*10,owner:null,use:null,ref:null})}}
const plot=(G,id)=>G.plots.find(p=>p.id===id);
function freePlots(G,city,use){return G.plots.filter(p=>p.city===city&&!p.owner&&ZONES[p.zone].uses.includes(use)).sort((a,b)=>b.traffic-a.traffic)}
function addComp(G,o){const cp=Object.assign({id:uid(G),rep:0.6,price:1,aware:0.4,value:0},o);G.comps.push(cp);return cp}
function compOpen(G,cp){const fr=freePlots(G,cp.city,'cafe').filter(p=>p.zone!=='buero'||rand(G)<0.4);if(!fr.length)return null;
  const p=fr[Math.min(fr.length-1,Math.floor(rand(G)*Math.min(5,fr.length)))];p.owner='c:'+cp.id;p.use='cafe';return p}

// ---------- Firmen ----------
function foundFirm(G,branch,name,first){
  const f={id:'f'+uid(G),name,branch,color:BRANCHES[branch].color,founded:G.day,morale:0.75,aware:0.05,rep:0.5,mkt:branch==='soft'?1500:800,wage:1.0,res:{},resCur:null};
  if(branch==='cafe')Object.assign(f,{shops:[],menu:{espresso:{on:true,q:2,price:2.4},cappu:{on:true,q:2,price:3.6},filter:{on:true,q:1,price:2.5},kuchen:{on:true,q:2,price:3.9}}});
  if(branch==='soft')Object.assign(f,{jr:0,sr:0,qa:0,office:null});
  if(branch==='prod')Object.assign(f,{plants:[],raw:{holz:0,rohkaffee:0,mehl:0},rawCost:{holz:0,rohkaffee:0,mehl:0},goods:{},auto:{holz:10,rohkaffee:10,mehl:10},contracts:[],autoSell:true,delivered:0});
  for(const k in PRODUCTS)if(f.menu&&!f.menu[k])f.menu[k]={on:false,q:2,price:PRODUCTS[k].ref};
  G.firms.push(f);if(!first){G.cur=f.id}else G.cur=f.id;return f}
const firm=(G,id)=>G.firms.find(f=>f.id===id);
function staffOf(G,f){
  if(f.branch==='cafe')return f.shops.reduce((s,x)=>s+x.staff,0);
  if(f.branch==='soft')return f.jr+f.sr+f.qa;
  if(f.branch==='prod')return f.plants.reduce((s,p)=>s+1+p.lines.reduce((a,l)=>a+l.workers,0),0);return 0}
function adminOf(G,f){return G.depts.ctrl?0:Math.floor(staffOf(G,f)/15)}
function totalStaff(G){return 1+G.firms.reduce((s,f)=>s+staffOf(G,f)+adminOf(G,f),0)+(G.hq?hqStaff(G):0)}
function hqStaff(G){return 4+Object.keys(G.depts).filter(k=>G.depts[k]).length*Math.max(2,Math.round(totalStaffNoHq(G)/120))}
function totalStaffNoHq(G){return 1+G.firms.reduce((s,f)=>s+staffOf(G,f)+adminOf(G,f),0)}
function stage(G){const n=totalStaff(G);let s=STAGES[0];for(const x of STAGES)if(n>=x[0])s=x;return{n:s[1],i:STAGES.indexOf(s),next:STAGES[STAGES.indexOf(s)+1]||null,staff:n}}
function productivity(f){return 0.55+0.6*f.morale}
function mktEff(G){return G.depts.mkt?1.35:1}
function resSpeed(G){return G.depts.rd?1.6:1}
function cityCount(G){return Object.keys(G.cities).length}
function wageCost(G,role,n,f){return n*WAGE[role]*EMP*G.idx.wage*f.wage}
function has(f,k){return!!f.res[k]}

// ---------- Café ----------
function menuStats(G,f){
  let sumA=0,sumW=0,sumQW=0,pf=0;const items=[];
  for(const k in f.menu){const m=f.menu[k],P=PRODUCTS[k];if(!m.on||(P.res&&!has(f,P.res)))continue;
    const pfac=clamp(Math.exp(-1.8*(m.price/P.ref-1)),0.15,1.6),q=QUAL[m.q],heat=(G.events.heat>0&&k==='coldbrew')?2.2:1;
    const a=P.w*q*pfac*heat;items.push({k,a,price:m.price,q:m.q,pf:pfac});sumA+=a;sumW+=P.w;sumQW+=P.w*q;pf+=pfac*P.w}
  for(const it of items)it.share=sumA?it.a/sumA:0;
  return{items,score:Math.min(1.6,sumA/2.2),quality:sumW?sumQW/sumW:0,price:sumW?pf/sumW:1}}
function shopAttr(G,f,ms){return Math.pow(ms.score,0.8)*(0.35+0.65*f.rep)}
function compAttr(cp){return Math.pow(cp.q,0.8)*0.8*clamp(Math.exp(-1.8*(cp.price-1)),0.3,1.5)*(0.35+0.65*cp.rep)}
function near(a,b){return a.city===b.city&&Math.abs(a.r-b.r)<=1&&Math.abs(a.c-b.c)<=1}
function supplier(G,good){for(const f of G.firms)if(f.branch==='prod'){const s=goodsTotal(f,good);if(s>0)return f}return null}
function cafeDay(G,f){
  const ms=menuStats(G,f),A=shopAttr(G,f,ms),prod=productivity(f);
  const loyal=has(f,'treue')?1.12:1,heat=G.events.heat>0?1.12:1;
  let repAcc=0,repN=0;
  for(const s of f.shops){const p=plot(G,s.plot);const comfort=LEVELS[s.level].comfort;
    let compSum=0;for(const q of G.plots)if(q!==p&&q.use==='cafe'&&near(p,q)){
      if(q.owner&&q.owner.startsWith('c:')){const cp=G.comps.find(c=>'c:'+c.id===q.owner);if(cp)compSum+=compAttr(cp)}else if(q.owner===f.id)compSum+=A*comfort*0.5}
    const a=A*comfort;
    const dem=p.traffic*0.13*(0.5+0.5*f.aware)*loyal*heat*a/(a+compSum*0.9+0.35);
    const cap=Math.min(s.staff*85*prod*(has(f,'schnell')?1.25:1),p.size*3.5);
    const cust=Math.floor(Math.min(dem,cap));
    let rev=0,cogs=0,cogsInt=0;const per=1.5; // cogsInt: Ware aus eigener Produktion, kein Geldfluss
    for(const it of ms.items){const P=PRODUCTS[it.k],n=cust*per*it.share,qm=QMULT[it.q];
      rev+=n*it.price;cogs+=n*P.other*qm;
      if(P.beans){const kg=n*P.beans,sup=supplier(G,'bohnen');
        if(sup){const got=takeGoods(G,sup,'bohnen',kg);cogsInt+=got.cost;if(got.qty<kg)cogs+=(kg-got.qty)*GOODS.bohnen.ref*G.idx.rohkaffee*qm}
        else cogs+=kg*GOODS.bohnen.ref*G.idx.rohkaffee*qm}
      if(P.piece){const pc=n*P.piece,sup=supplier(G,'gebaeck');
        if(sup){const got=takeGoods(G,sup,'gebaeck',pc);cogsInt+=got.cost;if(got.qty<pc)cogs+=(pc-got.qty)*P.mkt*qm}
        else cogs+=pc*P.mkt*qm}}
    earn(G,f.id,'rev',rev);pay(G,f.id,'cogs',cogs);L(G,f.id).cogs+=cogsInt;
    s.stat={cust,dem:Math.round(dem),cap:Math.round(cap),rev,cogs:cogs+cogsInt};
    s.hist=(s.hist||0)*0.9+rev*0.1;
    const served=dem>0?Math.min(1,cap/dem):1;
    const sat=0.45*ms.quality/0.93+0.2*comfort+0.2*served+0.15*Math.min(1,ms.price);
    repAcc+=sat;repN++}
  if(repN)f.rep+=(clamp(repAcc/repN,0,1)-f.rep)*0.01}
function takeGoods(G,sup,good,qty){ // interne Lieferung zu Herstellkosten
  let got=0,cost=0;const gs=sup.goods[good];if(!gs)return{qty:0,cost:0};
  for(let g=1;g<=3&&got<qty;g++){const b=gs[g];if(!b||b.q<=0)continue;const t=Math.min(b.q,qty-got),uc=b.cost/b.q;b.q-=t;b.cost-=uc*t;got+=t;cost+=uc*t}
  if(got>0){L(G,sup.id).revInt+=cost;L(G,sup.id).cogs+=cost}
  return{qty:got,cost}}

// ---------- Software ----------
function softTeam(G,f){const fd=G.founderDev&&f.id===G.firms[0].id&&f.branch==='soft'?1.4:0;
  const raw=fd+f.jr+f.sr*2.2;return{fd,raw,W:raw*productivity(f),qT:clamp(0.45+0.45*(f.sr*2.2)/Math.max(1,raw)+(has(f,'ki')?0.1:0)+(G.depts.rd?0.04:0),0,0.97),
    bugMult:(1/(1+4*f.qa/Math.max(1,f.jr+f.sr+(fd?1:0))))*(has(f,'ci')?0.6:1)}}
function desks(G,f){if(!f.office)return 3;const p=plot(G,f.office);return Math.floor(p.size/10)}
function rating(a){const bd=a.bugs/(15+a.users/3000);return clamp(a.quality*1.1-Math.min(1.5,bd)*0.25,0,1)}
function appAttr(a){const r=rating(a);return Math.pow(r,1.6)*(0.4+0.6*(a.fresh===undefined?1:a.fresh))*(a.model==='abo'?clamp(Math.exp(-(a.price-4.99)/10),0.3,1.4):1.1)}
function softDay(G,f){
  const t=softTeam(G,f),mine=G.apps.filter(a=>a.owner===f.id&&a.state!=='off');
  const wsum=mine.reduce((s,a)=>s+a.weight,0)||1;
  for(const a of mine){const dw=t.W*a.weight/wsum;
    if(a.state==='dev'){const sc=SCOPES[a.scope];const qi=clamp(t.qT+sc.q,0,0.97);
      a.quality=(a.quality*a.progress+qi*dw)/Math.max(1e-6,a.progress+dw);a.progress+=dw;a.bugs+=dw*0.12*t.bugMult;
      if(a.progress>=a.work)release(G,f,a)}
    else{a.bugs=Math.max(0,a.bugs-dw*0.9);a.bugs+=a.users/1e5*1.5*t.bugMult; // neue Fehler durch Nutzung
      a.quality+=Math.max(0,t.qT+0.1-a.quality)*dw*0.0003;
      a.fresh=clamp((a.fresh===undefined?1:a.fresh)-0.004+dw*0.004,0,1)}}  // ohne Updates veraltet eine App
  // Nutzer und Umsätze
  let rev=0,server=0;
  for(const a of mine)if(a.state==='live'){const gen=GENRES[a.genre];
    const rivals=G.apps.filter(b=>b!==a&&b.genre===a.genre&&b.state==='live');
    const A=appAttr(a),Ac=rivals.reduce((s,b)=>s+appAttr(b),0),total=rivals.reduce((s,b)=>s+b.users,0)+a.users;
    const sat=clamp(total/(gen.pot*1.6),0,1),boost=G.day-a.released<30?2:1;
    const nu=gen.pot*SCOPES[a.scope].pot*0.0035*(0.25+f.aware*1.2)*A/(A+Ac*0.4+0.3)*(1-sat)*boost;
    const bd=a.bugs/(15+a.users/3000);
    const churn=a.users*(0.002+0.012*Math.min(1.5,bd)+0.004*(1-(a.fresh===undefined?1:a.fresh))+(a.model==='ads'?0.001:0));
    a.users=Math.max(0,a.users+nu-churn);a.peak=Math.max(a.peak||0,a.users);
    if(a.model==='abo'){a.payers=a.users*0.14*gen.conv*(0.4+0.6*rating(a))*Math.exp(-a.price/8);rev+=a.payers*a.price/DPM*0.85}
    else{a.payers=0;rev+=a.users*0.22*gen.adv/DPM}
    server+=a.users*0.05/DPM*(has(f,'cloud')?0.6:1)}
  earn(G,f.id,'rev',rev);pay(G,f.id,'other',server);
  f.rep+=((mine.length?mine.reduce((s,a)=>s+rating(a),0)/mine.length:0.5)-f.rep)*0.01}
function release(G,f,a){a.state='live';a.released=G.day;a.quality*=Math.min(1,0.6+0.4*a.progress/a.work);a.users=a.users||0;
  news(G,f.name+' veröffentlicht „'+a.name+'“ ('+GENRES[a.genre].n+'). Qualität '+Math.round(a.quality*100)+' %.','good')}

// ---------- Produktion ----------
function goodsTotal(f,g){const gs=f.goods&&f.goods[g];if(!gs)return 0;let s=0;for(let k=1;k<=3;k++)s+=gs[k]?gs[k].q:0;return s}
function lineOut(G,f,l){const L0=LINES[l.type];return L0.cap[l.product]*Math.min(1,l.workers/L0.workers)*productivity(f)*(has(f,'auto')?1.3:1)}
function rawNeedPerDay(G,f){const need={holz:0,rohkaffee:0,mehl:0};
  for(const p of f.plants)for(const l of p.lines){const out=lineOut(G,f,l),m=GOODS[l.product].mat;for(const r in m)need[r]+=out*m[r]*GMULT[l.grade]}return need}
function rawPrice(G,r){return RAW[r].p*G.idx[r]}
function prodDay(G,f){
  // Einkauf: Vorrat für die eingestellten Tage halten (Wareneinkauf bindet Geld im Lager)
  const need=rawNeedPerDay(G,f);
  for(const r in need)if(need[r]>0){const target=need[r]*f.auto[r];if(f.raw[r]<target*0.6){const q=target-f.raw[r],c=q*rawPrice(G,r);
    if(G.cash-c>-dispo(G)){G.cash-=c;G.led.cf.op-=c;f.raw[r]+=q;f.rawCost[r]+=c}}}
  // Produktion
  for(const p of f.plants)for(const l of p.lines){let out=lineOut(G,f,l);const m=GOODS[l.product].mat;
    for(const r in m){const per=m[r]*GMULT[l.grade];if(per>0)out=Math.min(out,f.raw[r]/per)}
    if(out<=0){l.made=0;continue}
    let cost=0;for(const r in m){const used=out*m[r]*GMULT[l.grade],uc=f.raw[r]>0?f.rawCost[r]/f.raw[r]:0;f.raw[r]-=used;f.rawCost[r]-=uc*used;cost+=uc*used;if(f.raw[r]<1e-6){f.raw[r]=0;f.rawCost[r]=0}}
    const gs=f.goods[l.product]||(f.goods[l.product]={});const b=gs[l.grade]||(gs[l.grade]={q:0,cost:0});b.q+=out;b.cost+=cost;l.made=out}
  // Lieferungen an Aufträge
  for(const c of f.contracts){if(c.done>=c.qty)continue;let left=c.qty-c.done;const gs=f.goods[c.good];if(!gs)continue;
    for(let g=c.grade;g<=3&&left>0;g++){const b=gs[g];if(!b||b.q<1)continue;const t=Math.min(Math.floor(b.q),left),uc=b.cost/b.q;b.q-=t;b.cost-=uc*t;
      c.done+=t;left-=t;earn(G,f.id,'rev',t*c.price);L(G,f.id).cogs+=uc*t;pay(G,f.id,'other',t*GOODS[c.good].ship);f.delivered+=t}
    if(c.done>=c.qty){f.rep+=(1-f.rep)*0.05;news(G,f.name+': Auftrag von '+c.buyer+' erfüllt ('+fmtN(c.qty)+' '+GOODS[c.good].n+').','good')}}
  f.contracts=f.contracts.filter(c=>{if(c.done>=c.qty)return false;
    if(G.day>c.due){const pen=(c.qty-c.done)*c.price*0.15;pay(G,f.id,'other',pen);f.rep=Math.max(0,f.rep-0.08);
      news(G,f.name+': Auftrag von '+c.buyer+' nicht rechtzeitig geliefert. Vertragsstrafe '+fmtE(pen)+'.','bad');return false}return true});
  // Überschuss an den Großhandel, wenn mehr als 30 Tage Ausstoß auf Lager liegen und kein Auftrag wartet
  if(f.autoSell)for(const g in f.goods){const per=f.plants.reduce((s,p)=>s+p.lines.filter(l=>l.product===g).reduce((a,l)=>a+lineOut(G,f,l),0),0);
    const reserved=f.contracts.filter(c=>c.good===g).reduce((s,c)=>s+c.qty-c.done,0);const internal=g==='bohnen'||g==='gebaeck'?internalNeed(G,g)*20:0;
    const excess=goodsTotal(f,g)-reserved-internal-per*15;if(excess>1)sellWholesale(G,f,g,excess,true)}}
function internalNeed(G,g){let n=0;for(const f of G.firms)if(f.branch==='cafe')for(const s of f.shops)if(s.stat){const ms=menuStats(G,f);for(const it of ms.items){const P=PRODUCTS[it.k];n+=s.stat.cust*1.5*it.share*(g==='bohnen'?(P.beans||0):(P.piece||0))}}return n}
function wholesalePrice(G,f,g,grade){return GOODS[g].ref*0.7*(1+0.15*(grade-1))*(g==='bohnen'?G.idx.rohkaffee:1)}
function sellWholesale(G,f,g,qty,quiet){const gs=f.goods[g];if(!gs)return{ok:false,msg:'Nichts auf Lager.'};let left=qty,sold=0,rev=0;
  for(let k=1;k<=3&&left>0;k++){const b=gs[k];if(!b||b.q<=0)continue;const t=Math.min(b.q,left),uc=b.cost/b.q;b.q-=t;b.cost-=uc*t;left-=t;sold+=t;rev+=t*wholesalePrice(G,f,g,k);L(G,f.id).cogs+=uc*t}
  earn(G,f.id,'rev',rev);if(!quiet)news(G,f.name+' verkauft '+fmtN(sold)+' '+GOODS[g].n+' an den Großhandel für '+fmtE(rev)+'.','info');return{ok:true,msg:'Verkauft: '+fmtN(sold)+' für '+fmtE(rev)}}
function canMake(f,g){if(f.branch!=='prod')return false;return f.plants.some(p=>p.lines.some(l=>LINES[l.type].cap[g]))}
function genContracts(G,initial){
  const compN=G.comps.filter(c=>c.branch==='prod').length;
  for(const f of G.firms)if(f.branch==='prod'){
    const goods=Object.keys(GOODS).filter(g=>!GOODS[g].res||has(f,GOODS[g].res));
    const n=initial?4:3+Math.floor(rand(G)*2);
    const makeable=goods.filter(x=>canMake(f,x));
    for(let k=0;k<n;k++){const g=makeable.length&&rand(G)<0.75?pick(G,makeable):pick(G,goods);
      const per=Math.max(LINES[Object.keys(LINES).find(t=>LINES[t].cap[g])].cap[g]*0.8,1);
      const days=Math.round(rr(G,25,50)),qty=Math.max(10,Math.round(per*days*rr(G,0.25,0.75)*(1+0.5*f.rep)/5)*5);
      const grade=rand(G)<0.5?1:rand(G)<0.7?2:3;
      const price=GOODS[g].ref*rr(G,0.84,1.08)*(1+0.12*(grade-1))*(0.92+0.16*f.rep)*(has(f,'qm')?1.06:1)*(1-0.02*compN)*(g==='bohnen'?G.idx.rohkaffee:1);
      G.offers.contracts.push({id:uid(G),fid:f.id,good:g,qty,grade,price:Math.round(price*100)/100,days,expires:G.day+20,buyer:pick(G,BUYERS[g])})}}
  G.offers.contracts=G.offers.contracts.filter(c=>c.expires>=G.day&&firm(G,c.fid)).slice(-12)}

// ---------- Tagesablauf ----------
function dispo(G){const rev=lastMonths(G,3).reduce((s,m)=>s+sumF(m,'rev'),0)/3;return 25000+0.5*rev}
function step(G){
  if(G.over)return;
  G.day++;
  // Märkte wandern
  for(const r of ['rohkaffee','holz','mehl'])G.idx[r]=clamp(G.idx[r]*(1+(rand(G)-0.5)*0.012)+(1-G.idx[r])*0.004,0.6,1.7);
  for(const k in G.events)if(G.events[k]>0)G.events[k]--;
  for(const f of G.firms){
    // Laufende Kosten anteilig je Tag
    const st=f.branch==='cafe'?[['barista',staffOf(G,f)]]:f.branch==='soft'?[['jr',f.jr],['sr',f.sr],['qa',f.qa]]:[['worker',staffOf(G,f)]];
    let wages=0;for(const [r,n] of st)wages+=wageCost(G,r,n,f);wages+=wageCost(G,'admin',adminOf(G,f),f);pay(G,f.id,'staff',wages/DPM);
    let rent=0,util=0;const ctrl=G.depts.ctrl?0.95:1;
    if(f.branch==='cafe')for(const s of f.shops){rent+=plot(G,s.plot).rent;util+=200+250*s.level}
    if(f.branch==='soft'&&f.office){rent+=plot(G,f.office).rent;util+=300+desks(G,f)*15}
    if(f.branch==='prod')for(const p of f.plants){rent+=plot(G,p.plot).rent;util+=400+p.lines.reduce((s,l)=>s+LINES[l.type].energy,0)}
    pay(G,f.id,'rent',rent*ctrl/DPM);pay(G,f.id,'other',util*ctrl/DPM);pay(G,f.id,'mkt',f.mkt/DPM);
    // Bekanntheit, Stimmung
    const m=f.mkt*mktEff(G),K=(f.branch==='soft'?9000:f.branch==='prod'?3000:2500)*(f.branch==='cafe'?Math.max(1,Math.sqrt(f.shops.length)*0.8)*Object.keys(G.cities).filter(c=>f.shops&&f.shops.some(s=>plot(G,s.plot).city===c)).length||1:1);
    const tgt=0.06+0.86*m/(m+K);f.aware+=(tgt-f.aware)*0.012;
    const load=f.branch==='soft'?Math.max(0,(staffOf(G,f)+(G.founderDev?1:0))/desks(G,f)-1):0;
    const mt=clamp(0.62+(f.wage-1)*1.6+(G.depts.hr?0.1:0)-load*0.6,0.1,1);f.morale+=(mt-f.morale)*0.02;
    if(f.branch==='cafe')cafeDay(G,f);else if(f.branch==='soft')softDay(G,f);else prodDay(G,f);
    // Forschung
    if(f.resCur){f.resCur.left-=resSpeed(G);if(f.resCur.left<=0){f.res[f.resCur.k]=true;const R=RESEARCH[f.branch][f.resCur.k];news(G,f.name+': Forschung abgeschlossen: '+R.n+'.','good');f.resCur=null}}}
  // Zentrale
  if(G.hq){const dc=Object.keys(G.depts).filter(k=>G.depts[k]).length;pay(G,'H','staff',(8000+dc*(4000+30*totalStaffNoHq(G)))/DPM);pay(G,'H','rent',plot(G,G.hq).rent/DPM)}
  // Konkurrenz-Apps wachsen langsam
  for(const a of G.apps)if(a.owner.startsWith('c:')&&a.state==='live'){const gen=GENRES[a.genre];a.users*=1+(0.0006*(a.quality-0.4))*(1-a.users/gen.pot)}
  // Kontokorrent
  if(G.cash<0){pay(G,'H','int',-G.cash*0.12/360);if(G.cash<-dispo(G)){G.insolvT++;if(G.insolvT===1||G.insolvT%10===0)news(G,'Achtung: Der Dispositionsrahmen ist überzogen. In '+(30-G.insolvT)+' Tagen droht die Insolvenz.','bad');
    if(G.insolvT>=30){G.over='insolvent';news(G,'Insolvenz. Die Bank kündigt alle Kredite.','bad')}}else G.insolvT=0}else G.insolvT=0;
  if(G.day%DPM===0)monthEnd(G)}

// ---------- Monatsabschluss ----------
function lastMonths(G,n){return G.months.slice(-n)}
function sumF(m,k){let s=0;for(const id in m.f)s+=m.f[id][k]||0;return s}
function monthEnd(G){
  // Abschreibungen
  for(const a of G.assets){const d=Math.min(a.book,a.cost/a.life);a.book-=d;L(G,a.fid).dep+=d}G.assets=G.assets.filter(a=>a.book>0.01);
  // Kredite
  for(const l of G.loans){const i=l.bal*l.rate/12;pay(G,'H','int',i);const p=Math.min(l.bal,l.pay-i);G.cash-=p;G.led.cf.fin-=p;l.bal-=p}
  G.loans=G.loans.filter(l=>l.bal>0.5);
  // Steuern auf den Jahresgewinn, monatlich vorausgezahlt
  const pre=pretax(G.led);const m=monthIndex(G);const yr=Math.floor(m/12);
  const ytd=G.months.filter(x=>Math.floor(x.m/12)===yr).reduce((s,x)=>s+x.pre,0)+pre;
  const due=Math.max(0,ytd-G.tax.carry)*TAX,delta=due-G.tax.paidYTD;
  if(Math.abs(delta)>0.5){if(delta>0)pay(G,'H','tax',delta);else{G.cash-=delta;G.led.H.tax+=delta;G.led.cf.op-=delta}G.tax.paidYTD+=delta}
  const net=pre-G.led.H.tax;G.retained+=net;
  const rec={m,f:G.led.f,H:G.led.H,cf:G.led.cf,cash:G.cash,pre,net,staff:totalStaff(G),bal:balance(G)};
  rec.value=valuation(G,rec).total;G.months.push(rec);if(G.months.length>48)G.months.shift();
  if((m+1)%12===0){if(ytd<0)G.tax.carry+=-ytd;else G.tax.carry=Math.max(0,G.tax.carry-ytd);G.tax.paidYTD=0;
    news(G,'Jahresabschluss '+yearName(m)+': Jahresergebnis '+fmtE(G.months.filter(x=>Math.floor(x.m/12)===yr).reduce((s,x)=>s+x.net,0))+'.','fin')}
  G.led=emptyLedger();
  // Mieten steigen leicht, Löhne mit Tarif
  if((m+1)%12===0)for(const p of G.plots)p.rent=Math.round(p.rent*1.02/10)*10;
  // Kündigungen bei schlechter Stimmung
  for(const f of G.firms)if(f.morale<0.45){const q=(G.depts.hr?0.5:1)*(0.45-f.morale)*1.5;
    if(rand(G)<q){const lost=quit(G,f);if(lost)news(G,f.name+': '+lost+' hat gekündigt. Die Stimmung ist schlecht (Gehalt, Überlastung?).','bad')}}
  // Konkurrenz
  for(const cp of G.comps){if(cp.branch==='cafe'&&rand(G)<0.07&&G.plots.filter(p=>p.owner==='c:'+cp.id).length<7){const p=compOpen(G,cp);if(p&&G.cities[cp.city])news(G,cp.name+' eröffnet eine Filiale in '+cityName(cp.city)+' ('+ZONES[p.zone].n+').','comp')}
    if(cp.branch==='cafe'&&rand(G)<0.05)cp.q=clamp(cp.q+rr(G,-0.03,0.05),0.4,0.9);
    compValue(G,cp)}
  if(rand(G)<0.08){const genres=Object.keys(GENRES);const g=pick(G,genres);const cp=addComp(G,{branch:'soft',name:pick(G,APP_NAMES)+' '+pick(G,['Labs','Studio','Apps','Digital']),color:'#8a8f96',q:rr(G,0.5,0.75)});
    G.apps.push({id:uid(G),owner:'c:'+cp.id,name:pick(G,APP_NAMES),genre:g,scope:'M',state:'live',progress:1,work:1,quality:cp.q,bugs:15,users:5000,weight:1,model:'abo',price:4.99,released:G.day});
    news(G,'Neue Konkurrenz-App im Bereich '+GENRES[g].n+'.','comp')}
  events(G);genContracts(G,false);investorOffer(G);
  if(G.public){const v=valuation(G).total;const target=v/G.shares;G.sharePrice=Math.max(0.01,G.sharePrice*0.6+target*0.4)*(1+(rand(G)-0.5)*0.08);G.priceHist.push(G.sharePrice);if(G.priceHist.length>48)G.priceHist.shift()}
  milestones(G)}
function quit(G,f){if(f.branch==='cafe'){const s=f.shops.filter(s=>s.staff>1).sort((a,b)=>b.staff-a.staff)[0];if(s){s.staff--;return'ein Barista'}}
  if(f.branch==='soft'){if(f.sr>0&&rand(G)<0.5){f.sr--;return'ein Senior-Entwickler'}if(f.jr>0){f.jr--;return'ein Junior-Entwickler'}}
  if(f.branch==='prod'){for(const p of f.plants)for(const l of p.lines)if(l.workers>1){l.workers--;return'eine Fachkraft in der Produktion'}}return null}
function pretax(led){let s=0;for(const id in led.f){const x=led.f[id];s+=x.rev+x.revInt-x.cogs-x.staff-x.rent-x.mkt-x.rd-x.other-x.dep-x.int}
  const h=led.H;s-=h.staff+h.rent+h.mkt+h.rd+h.other+h.dep+h.int;return s}
function monthIndex(G){return Math.floor((G.day-1)/DPM)}
function yearName(m){return 2027+Math.floor(m/12)}
function dateStr(G){const m=Math.floor(G.day/DPM),d=G.day%DPM+1;return d+'. '+MONTHS[m%12]+' '+yearName(m)}
function cityName(id){return(CITIES.find(c=>c.id===id)||{}).n}
function events(G){
  const r=rand(G);
  if(r<0.10){G.idx.rohkaffee=clamp(G.idx.rohkaffee*rr(G,1.08,1.2),0.6,1.7);news(G,'Missernte in Brasilien: Der Rohkaffeepreis steigt deutlich.','market')}
  else if(r<0.17){G.idx.rohkaffee=clamp(G.idx.rohkaffee*rr(G,0.85,0.94),0.6,1.7);news(G,'Rekordernte: Rohkaffee wird günstiger.','market')}
  else if(r<0.24){G.idx.holz=clamp(G.idx.holz*rr(G,1.06,1.18),0.6,1.7);news(G,'Holz wird knapp, die Preise ziehen an.','market')}
  else if(r<0.31){const mo=monthIndex(G)%12;if(mo>=4&&mo<=7){G.events.heat=12;news(G,'Hitzewelle: Mehr Laufkundschaft, Cold Brew ist der Renner.','market')}}
  else if(r<0.36){G.idx.wage*=1.03;news(G,'Tarifabschluss: Die Löhne steigen um 3 %.','market')}
  else if(r<0.42){const mine=G.apps.filter(a=>!a.owner.startsWith('c:')&&a.state==='live');if(mine.length){const a=pick(G,mine);const add=Math.round(GENRES[a.genre].pot*0.03*rating(a));a.users+=add;news(G,'„'+a.name+'“ wird im App-Store empfohlen: +'+fmtN(add)+' Nutzer.','good')}}
  else if(r<0.47){for(const f of G.firms)if(f.branch==='cafe'&&f.shops.length){const ms=menuStats(G,f);if(ms.quality<0.55){f.rep=Math.max(0,f.rep-0.08);news(G,'Lebensmittelkontrolle bei '+f.name+': Mängel bei den Zutaten, der Ruf leidet.','bad')}else news(G,'Lebensmittelkontrolle bei '+f.name+': alles einwandfrei.','good');break}}}
function investorOffer(G){
  if(G.public||G.rounds>=4){G.offers.investor=null;return}
  const v=valuation(G).total;
  if(G.offers.investor&&G.offers.investor.expires<G.day)G.offers.investor=null;
  if(!G.offers.investor&&v>Math.max(300000,(G.lastRoundV||0)*1.6)&&G.day-(G.lastRoundD||-999)>=180&&rand(G)<0.35){const amt=Math.round(v*0.25/10000)*10000;
    G.offers.investor={amount:amt,share:0.2,name:pick(G,['Nordlicht Ventures','Hanse Capital','Elbe Partners','Spree Invest']),expires:G.day+60};
    news(G,G.offers.investor.name+' bietet '+fmtE(amt)+' für 20 % der Anteile.','fin')}}
function milestones(G){const M=G.ms,st=totalStaff(G),last=G.months[G.months.length-1];
  const chk=(k,c,t)=>{if(!M[k]&&c){M[k]=G.day;news(G,'Meilenstein: '+t,'ms')}};
  chk('rev',G.months.some(m=>sumF(m,'rev')>0),'Erster Umsatz');
  chk('profit',last&&last.net>0,'Erster Gewinnmonat');
  chk('s10',st>=10,'10 Mitarbeitende');chk('s100',st>=100,'100 Mitarbeitende');chk('s1000',st>=1000,'1.000 Mitarbeitende');
  chk('city2',cityCount(G)>=2,'Zweite Stadt');chk('hold',G.firms.length>=2,'Holding mit zwei Firmen');
  chk('hq',!!G.hq,'Eigene Zentrale');chk('ipo',G.public,'Börsengang');chk('m10',last&&last.value>=10e6,'10 Mio. € Unternehmenswert')}
const MILESTONES=[['rev','Erster Umsatz'],['profit','Erster Gewinnmonat'],['s10','10 Mitarbeitende'],['city2','Zweite Stadt'],['hold','Holding mit zwei Firmen'],
  ['hq','Eigene Zentrale'],['takeover','Erste Übernahme'],['s100','100 Mitarbeitende'],['ipo','Börsengang'],['m10','10 Mio. € Unternehmenswert'],['s1000','1.000 Mitarbeitende']];

// ---------- Bilanz, Bewertung ----------
function inventory(G){let v=0;for(const f of G.firms)if(f.branch==='prod'){for(const r in f.rawCost)v+=f.rawCost[r];for(const g in f.goods)for(const k in f.goods[g])v+=f.goods[g][k].cost}return v}
function balance(G){
  const fixed=G.assets.reduce((s,a)=>s+a.book,0),inv=inventory(G),cash=Math.max(0,G.cash),od=Math.max(0,-G.cash),debt=G.loans.reduce((s,l)=>s+l.bal,0);
  const assets=fixed+inv+cash,eq=assets-debt-od;
  // laufender Monat noch nicht abgeschlossen: Ergebnis des Monats gehört zum Eigenkapital
  const cur=pretax(G.led)-G.led.H.tax;
  return{fixed,inv,cash,assets,debt,od,eq,paidIn:G.paidIn,retained:G.retained,curNet:cur,diff:eq-(G.paidIn+G.retained+cur)}}
function ebitdaOf(m,fid){const x=m.f[fid];if(!x)return 0;return x.rev+x.revInt-x.cogs-x.staff-x.rent-x.mkt-x.rd-x.other}
function firmValue(G,f,ms){
  const months=ms||lastMonths(G,6);const e=months.length?months.reduce((s,m)=>s+ebitdaOf(m,f.id),0)/months.length*12:0;
  const book=G.assets.filter(a=>a.fid===f.id).reduce((s,a)=>s+a.book,0);
  let extra=0;if(f.branch==='soft')extra=G.apps.filter(a=>a.owner===f.id&&a.state==='live').reduce((s,a)=>s+a.users*6,0);
  if(f.branch==='cafe')extra=f.shops.length*20000*f.rep;
  return Math.max(book*0.6,e*BRANCHES[f.branch].mult+book*0.4)+extra}
function valuation(G,rec){const ms=rec?lastMonths(G,5).concat([rec]):lastMonths(G,6);
  const firms=G.firms.map(f=>({id:f.id,v:firmValue(G,f,ms)}));const debt=G.loans.reduce((s,l)=>s+l.bal,0);
  const total=Math.max(0,firms.reduce((s,x)=>s+x.v,0)+G.cash+inventory(G)-debt+(G.hq?G.assets.filter(a=>a.fid==='H').reduce((s,a)=>s+a.book,0):0));
  return{firms,total,mine:total*G.owner}}
function compValue(G,cp){
  if(cp.branch==='cafe'){const n=G.plots.filter(p=>p.owner==='c:'+cp.id).length;cp.value=n*90000*(0.5+cp.q)}
  else if(cp.branch==='soft'){cp.value=200000+G.apps.filter(a=>a.owner==='c:'+cp.id).reduce((s,a)=>s+a.users*6,0)}
  else cp.value=G.plots.filter(p=>p.owner==='c:'+cp.id).length*380000;return cp.value}

// ---------- Aktionen ----------
const A={};
function need(G,amt){return G.cash-amt>=-dispo(G)*0.5}
A.openShop=(G,fid,pid)=>{const f=firm(G,fid),p=plot(G,pid);if(!f||f.branch!=='cafe')return{ok:false,msg:'Nur für Cafés.'};
  if(!p||p.owner)return{ok:false,msg:'Grundstück ist nicht frei.'};if(!G.cities[p.city])return{ok:false,msg:'In dieser Stadt bist du noch nicht aktiv.'};
  if(!ZONES[p.zone].uses.includes('cafe'))return{ok:false,msg:'Hier ist keine Gastronomie erlaubt.'};
  const cost=LEVELS[1].cost+p.rent*2;if(!need(G,cost))return{ok:false,msg:'Zu wenig Geld: Einrichtung und Kaution kosten '+fmtE(cost)+'.'};
  pay(G,f.id,'other',p.rent*2);buyAsset(G,f.id,'Einrichtung '+ZONES[p.zone].n,LEVELS[1].cost,60,'shop:'+p.id);
  p.owner=f.id;p.use='cafe';f.shops.push({id:uid(G),plot:p.id,level:1,staff:2,stat:null});pay(G,f.id,'other',2*800);
  news(G,f.name+' eröffnet eine Filiale in '+cityName(p.city)+' ('+ZONES[p.zone].n+').','good');return{ok:true,msg:'Filiale eröffnet.'}};
A.upgradeShop=(G,fid,sid)=>{const f=firm(G,fid),s=f&&f.shops.find(x=>x.id===sid);if(!s||s.level>=3)return{ok:false,msg:'Höchste Stufe erreicht.'};
  const c=LEVELS[s.level+1].cost;if(!need(G,c))return{ok:false,msg:'Zu wenig Geld ('+fmtE(c)+').'};buyAsset(G,f.id,'Umbau '+LEVELS[s.level+1].n,c,60,'shop:'+s.plot);s.level++;return{ok:true,msg:'Umgebaut: '+LEVELS[s.level].n}};
A.shopStaff=(G,fid,sid,d)=>{const f=firm(G,fid),s=f&&f.shops.find(x=>x.id===sid);if(!s)return{ok:false};const n=clamp(s.staff+d,1,Math.max(2,Math.floor(plot(G,s.plot).size/12)));
  if(n>s.staff)pay(G,f.id,'other',800*(n-s.staff));s.staff=n;return{ok:true}};
A.closeShop=(G,fid,sid)=>{const f=firm(G,fid),i=f.shops.findIndex(x=>x.id===sid);if(i<0)return{ok:false};const s=f.shops[i],p=plot(G,s.plot);
  dropAssets(G,'shop:'+p.id);pay(G,f.id,'other',s.staff*WAGE.barista);p.owner=null;p.use=null;f.shops.splice(i,1);return{ok:true,msg:'Filiale geschlossen (Abfindungen gezahlt).'}};
A.menu=(G,fid,k,ch)=>{const f=firm(G,fid);const m=f.menu[k];if(!m)return{ok:false};if(PRODUCTS[k].res&&!has(f,PRODUCTS[k].res))return{ok:false,msg:'Erst erforschen.'};Object.assign(m,ch);m.price=Math.round(clamp(m.price,0.5,30)*10)/10;return{ok:true}};
A.setMkt=(G,fid,v)=>{const f=firm(G,fid);f.mkt=Math.max(0,Math.round(v));return{ok:true}};
A.setWage=(G,fid,v)=>{const f=firm(G,fid);f.wage=clamp(v,0.85,1.4);return{ok:true}};
A.research=(G,fid,k)=>{const f=firm(G,fid),R=RESEARCH[f.branch][k];if(!R||f.res[k])return{ok:false};if(f.resCur)return{ok:false,msg:'Es läuft schon ein Forschungsprojekt.'};
  if(!need(G,R.cost))return{ok:false,msg:'Zu wenig Geld ('+fmtE(R.cost)+').'};pay(G,f.id,'rd',R.cost);f.resCur={k,left:R.days,days:R.days};return{ok:true,msg:'Forschung gestartet: '+R.n}};
A.hire=(G,fid,role,d)=>{const f=firm(G,fid);if(f.branch!=='soft')return{ok:false};const n=f[role]+d;if(n<0)return{ok:false};
  if(d>0&&f.jr+f.sr+f.qa+d+1>desks(G,f)*1.25)return{ok:false,msg:'Kein Platz mehr: Miete ein größeres Büro.'};
  if(d>0){if(!need(G,1200*d))return{ok:false,msg:'Zu wenig Geld für die Anwerbung.'};pay(G,f.id,'other',1200*d)}else pay(G,f.id,'other',WAGE[role]*-d);f[role]=n;return{ok:true}};
A.rentOffice=(G,fid,pid)=>{const f=firm(G,fid),p=plot(G,pid);if(!f||f.branch!=='soft')return{ok:false,msg:'Nur für Software-Firmen.'};
  if(!p||p.owner)return{ok:false,msg:'Grundstück ist nicht frei.'};if(!G.cities[p.city])return{ok:false,msg:'In dieser Stadt bist du noch nicht aktiv.'};
  if(!ZONES[p.zone].uses.includes('office'))return{ok:false,msg:'Hier sind keine Büros möglich.'};
  const cost=p.size*40+p.rent*2;if(!need(G,cost))return{ok:false,msg:'Zu wenig Geld: Ausstattung und Kaution kosten '+fmtE(cost)+'.'};
  if(f.office){const o=plot(G,f.office);dropAssets(G,'office:'+o.id);o.owner=null;o.use=null}
  pay(G,f.id,'other',p.rent*2);buyAsset(G,f.id,'Büroausstattung',p.size*40,60,'office:'+p.id);p.owner=f.id;p.use='office';f.office=p.id;
  news(G,f.name+' bezieht ein Büro mit '+Math.floor(p.size/10)+' Arbeitsplätzen in '+cityName(p.city)+'.','good');return{ok:true,msg:'Büro bezogen.'}};
A.newApp=(G,fid,genre,scope)=>{const f=firm(G,fid);const g=GENRES[genre];if(!g)return{ok:false};if(g.res&&!has(f,g.res))return{ok:false,msg:'Genre erst erforschen.'};
  const used=new Set(G.apps.map(a=>a.name));const name=APP_NAMES.find(n=>!used.has(n))||('App '+uid(G));
  G.apps.push({id:uid(G),owner:f.id,name,genre,scope,state:'dev',progress:0,work:SCOPES[scope].work,quality:0,bugs:0,users:0,weight:2,model:'abo',price:4.99,released:0});
  return{ok:true,msg:'Projekt „'+name+'“ gestartet.'}};
A.app=(G,aid,ch)=>{const a=G.apps.find(x=>x.id===aid);if(!a)return{ok:false};
  if(ch.release&&a.state==='dev'){if(a.progress<a.work*0.6)return{ok:false,msg:'Erst ab 60 % Fortschritt.'};release(G,firm(G,a.owner),a);return{ok:true}}
  if(ch.off){a.state='off';a.users=0;return{ok:true}}
  if(ch.weight!==undefined)a.weight=clamp(ch.weight,0,3);if(ch.model)a.model=ch.model;if(ch.price!==undefined)a.price=Math.round(clamp(ch.price,0.99,29.99)*100)/100;return{ok:true}};
A.rentPlant=(G,fid,pid)=>{const f=firm(G,fid),p=plot(G,pid);if(!f||f.branch!=='prod')return{ok:false,msg:'Nur für Produktionsfirmen.'};
  if(!p||p.owner)return{ok:false,msg:'Grundstück ist nicht frei.'};if(!G.cities[p.city])return{ok:false,msg:'In dieser Stadt bist du noch nicht aktiv.'};
  if(!ZONES[p.zone].uses.includes('factory'))return{ok:false,msg:'Fabriken nur im Gewerbegebiet.'};
  const cost=p.rent*3;if(!need(G,cost))return{ok:false,msg:'Zu wenig Geld für die Kaution ('+fmtE(cost)+').'};pay(G,f.id,'other',cost);
  p.owner=f.id;p.use='factory';f.plants.push({id:uid(G),plot:p.id,lines:[]});news(G,f.name+' mietet eine Halle in '+cityName(p.city)+'.','good');return{ok:true,msg:'Halle gemietet. Jetzt eine Linie kaufen.'}};
A.buyLine=(G,fid,plantId,type)=>{const f=firm(G,fid),pl=f&&f.plants.find(x=>x.id===plantId),T=LINES[type];if(!pl||!T)return{ok:false};
  if(T.res&&!has(f,T.res))return{ok:false,msg:'Erst erforschen.'};if(pl.lines.length>=Math.floor(plot(G,pl.plot).size/500))return{ok:false,msg:'Die Halle ist voll.'};
  if(!need(G,T.cost))return{ok:false,msg:'Zu wenig Geld: Die Linie kostet '+fmtE(T.cost)+'.'};
  const id=uid(G);buyAsset(G,f.id,T.n,T.cost,96,'line:'+id);pl.lines.push({id,type,product:Object.keys(T.cap)[0],workers:T.workers,grade:2,made:0});pay(G,f.id,'other',800*T.workers);
  return{ok:true,msg:T.n+' gekauft.'}};
A.line=(G,fid,lid,ch)=>{const f=firm(G,fid);for(const p of f.plants)for(const l of p.lines)if(l.id===lid){
  if(ch.workers!==undefined){const n=clamp(ch.workers,0,LINES[l.type].workers);if(n>l.workers)pay(G,f.id,'other',800*(n-l.workers));l.workers=n}
  if(ch.grade)l.grade=clamp(ch.grade,1,3);if(ch.product&&LINES[l.type].cap[ch.product]&&(!GOODS[ch.product].res||has(f,GOODS[ch.product].res)))l.product=ch.product;return{ok:true}}return{ok:false}};
A.sellLine=(G,fid,lid)=>{const f=firm(G,fid);for(const p of f.plants){const i=p.lines.findIndex(l=>l.id===lid);if(i>=0){const a=G.assets.find(x=>x.ref==='line:'+lid);const proceeds=a?a.book*0.5:0;
  dropAssets(G,'line:'+lid);earn(G,f.id,null,proceeds,'inv');L(G,f.id).dep-=proceeds;p.lines.splice(i,1);return{ok:true,msg:'Linie verkauft für '+fmtE(proceeds)}}}return{ok:false}};
A.accept=(G,cid)=>{const i=G.offers.contracts.findIndex(c=>c.id===cid);if(i<0)return{ok:false};const c=G.offers.contracts[i],f=firm(G,c.fid);
  f.contracts.push({id:c.id,good:c.good,qty:c.qty,grade:c.grade,price:c.price,due:G.day+c.days,done:0,buyer:c.buyer});G.offers.contracts.splice(i,1);return{ok:true,msg:'Auftrag angenommen.'}};
A.wholesale=(G,fid,g)=>{const f=firm(G,fid);const reserved=f.contracts.filter(c=>c.good===g).reduce((s,c)=>s+c.qty-c.done,0);const q=goodsTotal(f,g)-reserved;if(q<1)return{ok:false,msg:'Alles für Aufträge reserviert.'};return sellWholesale(G,f,g,q)};
A.setAuto=(G,fid,ch)=>{const f=firm(G,fid);if(ch.raw)f.auto[ch.raw]=clamp(ch.days,0,60);if(ch.autoSell!==undefined)f.autoSell=ch.autoSell;return{ok:true}};
A.found=(G,branch,name)=>{const cost=25000;if(!need(G,cost))return{ok:false,msg:'Für die Gründung brauchst du '+fmtE(cost)+'.'};
  pay(G,'H','other',cost);const f=foundFirm(G,branch,name);f.aware=0.05;news(G,'Neue Firma gegründet: '+f.name+' ('+BRANCHES[branch].n+').','good');return{ok:true,msg:f.name+' gegründet.',id:f.id}};
A.unlockCity=(G,cid)=>{const c=CITIES.find(x=>x.id===cid);if(!c||G.cities[cid])return{ok:false};const st=totalStaff(G);
  if(st<c.unlock.staff)return{ok:false,msg:'Erst ab '+c.unlock.staff+' Mitarbeitenden.'};if(!need(G,c.unlock.cost))return{ok:false,msg:'Markteintritt kostet '+fmtE(c.unlock.cost)+'.'};
  pay(G,'H','other',c.unlock.cost);G.cities[cid]=true;news(G,'Markteintritt in '+c.n+'. Neue Grundstücke stehen bereit.','good');return{ok:true}};
A.buildHQ=(G,pid)=>{const p=plot(G,pid);if(G.hq)return{ok:false,msg:'Es gibt schon eine Zentrale.'};if(totalStaff(G)<25)return{ok:false,msg:'Eine Zentrale lohnt sich erst ab 25 Mitarbeitenden.'};
  if(!p||p.owner||!ZONES[p.zone].uses.includes('hq'))return{ok:false,msg:'Wähle ein freies Grundstück in Innenstadt oder Büroviertel.'};if(!G.cities[p.city])return{ok:false,msg:'Stadt noch nicht erschlossen.'};
  const cost=250000;if(!need(G,cost))return{ok:false,msg:'Der Bau kostet '+fmtE(cost)+'.'};buyAsset(G,'H','Zentrale',cost,240,'hq');p.owner='H';p.use='hq';G.hq=p.id;
  news(G,'Die Konzernzentrale in '+cityName(p.city)+' ist bezogen. Jetzt Abteilungen aufbauen.','good');return{ok:true,msg:'Zentrale gebaut.'}};
A.dept=(G,k,on)=>{if(!G.hq)return{ok:false,msg:'Erst eine Zentrale bauen.'};if(on&&!G.depts[k])pay(G,'H','other',5000);G.depts[k]=!!on;return{ok:true}};
A.loan=(G,amount)=>{const off=loanOffer(G);if(amount>off.max)return{ok:false,msg:'Die Bank gibt höchstens '+fmtE(off.max)+'.'};takeLoan(G,{amount,rate:off.rate,months:60,name:'Bankkredit'});return{ok:true,msg:fmtE(amount)+' zu '+(off.rate*100).toFixed(1).replace('.',',')+' % aufgenommen.'}};
A.repay=(G,lid)=>{const l=G.loans.find(x=>x.id===lid);if(!l)return{ok:false};if(G.cash<l.bal)return{ok:false,msg:'Zu wenig Geld für die Sondertilgung.'};G.cash-=l.bal;G.led.cf.fin-=l.bal;l.bal=0;G.loans=G.loans.filter(x=>x.bal>0);return{ok:true,msg:'Kredit getilgt.'}};
A.investor=(G,yes)=>{const o=G.offers.investor;if(!o)return{ok:false};G.offers.investor=null;if(!yes)return{ok:true,msg:'Angebot abgelehnt.'};
  equity(G,o.amount,o.name);G.owner*=1-o.share;G.rounds++;G.lastRoundV=valuation(G).total;G.lastRoundD=G.day;news(G,o.name+' investiert '+fmtE(o.amount)+'. Dein Anteil: '+Math.round(G.owner*100)+' %.','fin');return{ok:true,msg:'Finanzierungsrunde abgeschlossen.'}};
function ipoCheck(G){const y=lastMonths(G,12),rev=y.reduce((s,m)=>s+sumF(m,'rev'),0),st=totalStaff(G),last3=lastMonths(G,3);
  return[{t:'Eigene Zentrale',ok:!!G.hq},{t:'Mindestens 150 Mitarbeitende',ok:st>=150,v:st},{t:'Umsatz der letzten 12 Monate ab 8 Mio. €',ok:rev>=8e6,v:rev},{t:'Gewinn in den letzten drei Monaten',ok:last3.length===3&&last3.every(m=>m.net>0)}]}
A.ipo=(G)=>{if(G.public)return{ok:false};if(!ipoCheck(G).every(x=>x.ok))return{ok:false,msg:'Voraussetzungen noch nicht erfüllt.'};
  const v=valuation(G).total,amt=v*0.25/0.75*0.95;equity(G,amt,'Börsengang');G.owner*=0.75;G.public=true;G.sharePrice=v/0.75/G.shares;G.priceHist=[G.sharePrice];
  news(G,'Börsengang! Die Aktie startet bei '+fmtE(G.sharePrice,2)+'. Erlös: '+fmtE(amt)+'.','ms');return{ok:true,msg:'Willkommen an der Börse.'}};
A.takeover=(G,cid)=>{const cp=G.comps.find(c=>c.id===cid);if(!cp)return{ok:false};const price=Math.round(compValue(G,cp)*1.35/1000)*1000;
  if(cp.branch!=='soft'&&cp.city&&!G.cities[cp.city])return{ok:false,msg:'Erst in '+cityName(cp.city)+' aktiv werden.'};
  if(G.cash<price)return{ok:false,msg:'Die Übernahme kostet '+fmtE(price)+'. Nimm einen Kredit auf oder spare.'};
  let f=G.firms.find(x=>x.branch===cp.branch);if(!f){f=foundFirm(G,cp.branch,cp.name);G.cur=f.id}
  G.cash-=price;G.led.cf.inv-=price;
  const owned=G.plots.filter(p=>p.owner==='c:'+cp.id);let goodwill=price;
  const std=cp.branch==='cafe'?20000:cp.branch==='prod'?LINES.moebel.cost*0.7:0,sc=owned.length&&std?Math.min(1,price*0.6/(owned.length*std)):1; // Anlagen höchstens 60 % des Preises
  const addA=(name,v,life,ref)=>{G.assets.push({id:uid(G),fid:f.id,name,cost:v,life,book:v,ref});goodwill-=v};
  if(cp.branch==='cafe')for(const p of owned){p.owner=f.id;f.shops.push({id:uid(G),plot:p.id,level:2,staff:3,stat:null});addA('Einrichtung (übernommen)',std*sc,60,'shop:'+p.id)}
  if(cp.branch==='prod')for(const p of owned){p.owner=f.id;const id=uid(G),type=rand(G)<0.5?'moebel':'roest';f.plants.push({id:uid(G),plot:p.id,lines:[{id,type,product:Object.keys(LINES[type].cap)[0],workers:LINES[type].workers,grade:2,made:0}]});
    addA(LINES[type].n+' (übernommen)',std*sc,96,'line:'+id)}
  if(cp.branch==='soft'){for(const a of G.apps)if(a.owner==='c:'+cp.id){a.owner=f.id;a.weight=1}f.jr+=3;f.sr+=1}
  if(goodwill>0)G.assets.push({id:uid(G),fid:f.id,name:'Firmenwert '+cp.name,cost:goodwill,life:120,book:goodwill,ref:'gw:'+cp.id});
  G.comps=G.comps.filter(c=>c!==cp);G.ms.takeover=G.ms.takeover||G.day;news(G,'Übernahme: '+cp.name+' gehört jetzt zu '+f.name+' (Kaufpreis '+fmtE(price)+').','ms');return{ok:true,msg:cp.name+' übernommen.'}};
A.founderRole=(G,dev)=>{G.founderDev=!!dev;return{ok:true}};
function loanOffer(G){const ms=lastMonths(G,6);const e=ms.length?ms.reduce((s,m)=>s+Object.keys(m.f).reduce((a,id)=>a+ebitdaOf(m,id),0),0)/ms.length*12:0;
  const debt=G.loans.reduce((s,l)=>s+l.bal,0),bal=balance(G);const cap=Math.max(60000,e*3.5,bal.fixed*0.6)-debt;
  const rate=0.055+clamp(debt/Math.max(1,e),0,6)*0.004;return{max:Math.max(0,Math.floor(cap/10000)*10000),rate:Math.round(rate*1000)/1000}}
function takeLoan(G,o){const r=o.rate/12,n=o.months,payM=o.amount*r/(1-Math.pow(1+r,-n));G.loans.push({id:uid(G),name:o.name,amount:o.amount,bal:o.amount,rate:o.rate,months:n,pay:payM,start:G.day});
  G.cash+=o.amount;G.led.cf.fin+=o.amount}

// ---------- Auswertung für die Oberfläche ----------
function pl(m,fid){ // GuV-Zeilen für eine Firma oder den Konzern (fid null)
  const z=fz();const ids=fid?[fid]:Object.keys(m.f);for(const id of ids){const x=m.f[id];if(!x)continue;for(const k in z)z[k]+=x[k]||0}
  if(!fid){const h=m.H;for(const k in z)z[k]+=h[k]||0;z.cogs-=z.revInt;z.revInt=0}
  const ebitda=z.rev+z.revInt-z.cogs-z.staff-z.rent-z.mkt-z.rd-z.other,ebit=ebitda-z.dep,net=ebit-z.int-z.tax;return Object.assign(z,{ebitda,ebit,net})}
function curMonth(G){return{m:monthIndex(G),f:G.led.f,H:G.led.H,cf:G.led.cf,partial:true}}
function fmtN(v){return Math.round(v).toLocaleString('de-DE')}
function fmtE(v,d){if(Math.abs(v)<0.5)v=0;const a=Math.abs(v);if(d)return v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d})+' €';
  if(a>=1e6)return(v/1e6).toLocaleString('de-DE',{maximumFractionDigits:a>=1e8?0:1})+' Mio. €';return Math.round(v).toLocaleString('de-DE')+' €'}

const K={DPM,MONTHS,BRANCHES,WAGE,ROLE_N,PRODUCTS,QMULT,QUAL,LEVELS,GENRES,SCOPES,RAW,GOODS,LINES,GMULT,GQUAL,RESEARCH,CITIES,ZONES,COLS,ROWS,STAGES,DEPTS,MILESTONES,
  newGame,step,act:A,plot,firm,staffOf,adminOf,totalStaff,stage,menuStats,softTeam,desks,rating,goodsTotal,lineOut,rawNeedPerDay,rawPrice,wholesalePrice,
  balance,valuation,firmValue,compValue,loanOffer,ipoCheck,pl,curMonth,lastMonths,sumF,dateStr,monthIndex,yearName,cityName,dispo,fmtE,fmtN,inventory,freePlots,internalNeed,productivity};
if(typeof module!=='undefined'&&module.exports)module.exports=K;else root.K=K;
})(typeof window!=='undefined'?window:globalThis);
