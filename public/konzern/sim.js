// Gründerzeit: rundenbasiertes Wirtschaftsmodell ohne DOM. Eine Runde ist ein Monat.
// Der Spielstand G ist reines JSON. Aktionen geben {ok,msg} zurück, endTurn(G) rechnet den Monat ab und liefert den Monatsbericht.
(function(root){
'use strict';
const TAX=0.30,EMP=1.21,DAYS=30;
const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

// ---------- Kataloge ----------
const BRANCHES={
  cafe:{n:'Café',long:'Gastronomie',icon:'☕',desc:'Lagen wählen, Filialen einrichten, Speisekarte und Preise festlegen, Stammgäste gewinnen.',color:'#c8643c',mult:7},
  soft:{n:'Software',long:'Software & Apps',icon:'💻',desc:'Team aufbauen, Apps entwickeln und veröffentlichen, Nutzer gewinnen, Abos verkaufen.',color:'#2f6fd0',mult:10},
  prod:{n:'Produktion',long:'Produktion',icon:'🏭',desc:'Hallen und Linien kaufen, Schichten planen, Aufträge liefern, eine eigene Marke aufbauen.',color:'#3f9b62',mult:6}};
const WAGE={barista:2300,manager:3900,jr:3600,sr:6200,des:4300,qa:3900,worker:2900,admin:3400};
const PRODUCTS={ // other = Zutaten je Stück ohne Bohnen/Backware, beans = kg Röstkaffee, piece = Backware
  espresso:{n:'Espresso',icon:'☕',other:0.12,beans:0.009,ref:2.4,w:1.0,coffee:true},
  cappu:{n:'Cappuccino',icon:'🥛',other:0.36,beans:0.009,ref:3.6,w:1.6,coffee:true},
  filter:{n:'Filterkaffee',icon:'🫖',other:0.08,beans:0.012,ref:2.6,w:0.9,coffee:true},
  kuchen:{n:'Kuchen',icon:'🍰',other:0.45,piece:1,mkt:1.0,ref:3.9,w:0.8,cake:true},
  bagel:{n:'Bagel',icon:'🥯',other:0.8,piece:1,mkt:0.9,ref:5.4,w:0.7,res:'bagel',cake:true},
  chai:{n:'Chai Latte',icon:'🍵',other:0.7,ref:4.2,w:0.8,res:'chai'},
  coldbrew:{n:'Cold Brew',icon:'🧊',other:0.25,beans:0.02,ref:4.4,w:0.8,res:'coldbrew',coffee:true,summer:true},
  bowl:{n:'Frühstücksbowl',icon:'🥣',other:2.8,ref:8.9,w:0.6,res:'bowl'}};
const QMULT=[0,1,1.45,2.1],QUAL=[0,0.45,0.7,0.93],QN=['','Einfach','Gut','Premium'];
const LEVELS=[null,{n:'Einfach',cost:15000,comfort:0.6},{n:'Gemütlich',cost:25000,comfort:0.8},{n:'Design',cost:45000,comfort:0.95}];
const CAFE_UPS={
  espresso:{n:'Profi-Siebträger',icon:'☕',cost:8000,mon:80,d:'Kaffee schmeckt besser: Qualität der Kaffeegetränke +10 %.'},
  vitrine:{n:'Kuchenvitrine',icon:'🍰',cost:4000,mon:30,d:'+40 % Verkauf von Kuchen und Bagels.'},
  terrasse:{n:'Terrasse',icon:'⛱️',cost:6000,mon:0,d:'April bis September +20 % Gäste und Plätze.',zones:['city','wohn']},
  lounge:{n:'Lounge mit Sofas',icon:'🛋️',cost:10000,mon:0,d:'Gemütlichkeit +12 %, Gäste bleiben und kommen wieder.'},
  wlan:{n:'WLAN & Steckdosen',icon:'📶',cost:2000,mon:40,d:'+12 % Gäste in Innenstadt und Büroviertel.'},
  togo:{n:'To-go-Fenster',icon:'🥤',cost:9000,mon:0,d:'+15 % Gäste und +20 % Kapazität, etwas weniger gemütlich.'},
  kids:{n:'Spielecke',icon:'🧸',cost:5000,mon:0,d:'+15 % Gäste im Wohnviertel (Familien).',zones:['wohn']},
  delivery:{n:'Lieferdienst',icon:'🛵',cost:1500,mon:0,d:'+15 % Umsatz über Liefer-Apps, davon 25 % Provision.'},
  roaster:{n:'Schaurösterei',icon:'🔥',cost:25000,mon:300,d:'Kaffeequalität +6 %, +8 % Gäste, der Ruf steigt schneller.',minLevel:2},
  solar:{n:'Energiesparpaket',icon:'💡',cost:7000,mon:0,d:'Nebenkosten −40 %.'}};
const CAFE_ACTIONS={
  happy:{n:'Happy Hour',icon:'🍹',cost:0,d:'+18 % Gäste, der Bon sinkt um 6 %.'},
  music:{n:'Live-Musik am Wochenende',icon:'🎸',cost:800,d:'+6 % Gäste, der Ruf steigt.'},
  flyer:{n:'Flyer im Viertel',icon:'📰',cost:400,d:'Die Bekanntheit im Viertel steigt deutlich.'},
  stamp:{n:'Stempelkarte',icon:'🎟️',cost:0,d:'+8 % Stammgäste, kostet 3 % vom Umsatz.'}};
const HOURS={short:{n:'7–15 Uhr',dem:0.78,cap:0.8,wage:0.8},normal:{n:'7–19 Uhr',dem:1,cap:1,wage:1},long:{n:'6–22 Uhr',dem:1.18,cap:1.3,wage:1.3}};
const GENRES={
  prod:{n:'Produktivität',icon:'✅',pot:600000,conv:1.0,adv:0.8,cpi:2.5},
  fit:{n:'Fitness',icon:'🏃',pot:900000,conv:0.8,adv:1.0,cpi:2.0},
  game:{n:'Spiele',icon:'🎮',pot:3000000,conv:0.35,adv:1.6,cpi:1.4,res:'games'},
  fin:{n:'Fintech',icon:'💶',pot:400000,conv:1.6,adv:0.5,cpi:4.5,res:'fintech'}};
const SCOPES={S:{n:'Klein',work:220,q:0,pot:0.5},M:{n:'Mittel',work:650,q:0.05,pot:1},L:{n:'Groß',work:1600,q:0.1,pot:1.7}};
const FOCUS={features:{n:'Neue Funktionen',icon:'✨',d:'Qualität und Aktualität steigen, dabei entstehen neue Bugs.'},bugs:{n:'Bugs beheben',icon:'🐞',d:'Fehler verschwinden, die Bewertung steigt.'},
  perf:{n:'Performance',icon:'⚡',d:'Die App läuft flüssiger: deutlich weniger Kündigungen.'},growth:{n:'Wachstum',icon:'📈',d:'Teilen- und Einlade-Funktionen: +30 % neue Nutzer.'},money:{n:'Monetarisierung',icon:'💰',d:'Bessere Bezahlseiten: +25 % zahlende Nutzer.'}};
const MODELS={free:{n:'Kostenlos mit Werbung'},freemium:{n:'Freemium mit Abo'},paid:{n:'Einmalkauf'}};
const CAMPAIGNS={social:{n:'Social Media',icon:'📱',cost:2000,d:'Laufend: +15 % neue Nutzer.'},influencer:{n:'Influencer-Kampagne',icon:'🌟',cost:12000,d:'Nur nächsten Monat: +50 % neue Nutzer und ein Schub obendrauf.'}};
const OFFICE_UPS={
  hardware:{n:'Schnelle Rechner',icon:'🖥️',cost:15000,mon:0,d:'+10 % Entwicklungsleistung.'},
  kitchen:{n:'Kaffeeküche & Obst',icon:'🍎',cost:6000,mon:300,d:'Stimmung +8 %.'},
  gaming:{n:'Spielezimmer',icon:'🕹️',cost:8000,mon:0,d:'Stimmung +5 %, Einstellen kostet weniger.'},
  quiet:{n:'Fokusräume',icon:'🎧',cost:12000,mon:0,d:'20 % weniger neue Bugs.'}};
const RAW={holz:{n:'Holz',unit:'Bretter',p:4.5},rohkaffee:{n:'Rohkaffee',unit:'kg',p:5.2},mehl:{n:'Mehl',unit:'kg',p:0.55}};
const GOODS={
  stuhl:{n:'Stühle',icon:'🪑',unit:'Stk',mat:{holz:4},ref:52,ship:1.5,brand:3000},
  tisch:{n:'Tische',icon:'🪵',unit:'Stk',mat:{holz:11},ref:165,ship:4,res:'tisch',brand:800},
  bohnen:{n:'Röstkaffee',icon:'🫘',unit:'kg',mat:{rohkaffee:1.2},ref:15.5,ship:0.3,brand:6000},
  gebaeck:{n:'Gebäck',icon:'🥐',unit:'Stk',mat:{mehl:0.12},ref:0.95,ship:0.02,res:'back',brand:60000}};
const LINES={
  moebel:{n:'Möbel-Linie',icon:'🪚',cost:70000,workers:6,cap:{stuhl:46,tisch:17},energy:1400},
  roest:{n:'Rösterei',icon:'🔥',cost:48000,workers:3,cap:{bohnen:120},energy:1100},
  back:{n:'Backstraße',icon:'🥖',cost:55000,workers:5,cap:{gebaeck:2200},energy:1300,res:'back'}};
const SHIFTS=[0,1,1.9,2.7],GMULT=[0,1,1.25,1.6],GQUAL=[0,0.5,0.72,0.92];
const SUPPLIERS={cheap:{n:'Günstig',p:0.85,d:'Billiger Einkauf, die Güte sinkt um eine Stufe.'},standard:{n:'Standard',p:1,d:'Normale Preise und Qualität.'},bio:{n:'Bio & fair',p:1.35,d:'Teurer Einkauf, dafür +12 % bei Aufträgen und Marke.'}};
const PLANT_UPS={lager:{n:'Lagerhalle',icon:'📦',cost:20000,mon:300,d:'Doppelte Lagerkapazität.'},solar:{n:'Solardach',icon:'☀️',cost:30000,mon:0,d:'Energiekosten −35 %.'},kantine:{n:'Kantine',icon:'🍲',cost:15000,mon:400,d:'Stimmung +6 %.'}};
const RESEARCH={
  cafe:{bagel:{n:'Bagel-Rezeptur',icon:'🥯',cost:6000,months:1,d:'Neues Produkt: Bagel'},chai:{n:'Chai Latte',icon:'🍵',cost:8000,months:1,d:'Neues Produkt: Chai Latte'},
    coldbrew:{n:'Cold Brew',icon:'🧊',cost:10000,months:1,d:'Neues Produkt, im Sommer der Renner'},bowl:{n:'Frühstücksbowls',icon:'🥣',cost:15000,months:2,d:'Neues Produkt mit hohem Bon'},
    schnell:{n:'Schnellere Abläufe',icon:'⏱️',cost:18000,months:2,d:'+25 % Kapazität je Barista'},treue:{n:'Treue-App',icon:'📲',cost:22000,months:2,d:'+12 % Stammgäste in allen Filialen'}},
  soft:{ci:{n:'Automatisierte Tests',icon:'🧪',cost:20000,months:2,d:'40 % weniger neue Bugs'},cloud:{n:'Eigene Cloud',icon:'☁️',cost:25000,months:2,d:'40 % weniger Serverkosten'},
    ki:{n:'KI-Funktionen',icon:'🤖',cost:40000,months:2,d:'+10 % Qualität für alle Apps'},games:{n:'Spiele-Engine',icon:'🎮',cost:30000,months:2,d:'Neues Genre: Spiele'},fintech:{n:'Banklizenz-Partner',icon:'🏦',cost:35000,months:2,d:'Neues Genre: Fintech'}},
  prod:{tisch:{n:'Tisch-Konstruktion',icon:'📐',cost:12000,months:1,d:'Neues Produkt: Tische'},back:{n:'Backstraße',icon:'🥖',cost:15000,months:1,d:'Neue Linie: Gebäck, beliefert auch eigene Cafés'},
    auto:{n:'Automatisierung',icon:'🦾',cost:50000,months:2,d:'Linien einzeln automatisieren: +30 % Ausstoß, 2 Leute weniger'},qm:{n:'Qualitätsmanagement',icon:'🏅',cost:25000,months:2,d:'+6 % bei allen Auftragspreisen'}}};
const CITIES=[{id:'kiel',n:'Kiel',traffic:1.0,rent:1.0},{id:'hamburg',n:'Hamburg',traffic:1.45,rent:1.5,unlock:{staff:12,cost:60000}},{id:'berlin',n:'Berlin',traffic:1.6,rent:1.35,unlock:{staff:50,cost:120000}}];
const ZONES={
  city:{n:'Innenstadt',traffic:[4200,7000],rent:[3600,6200],size:[80,140],uses:['cafe','office','hq']},
  wohn:{n:'Wohnviertel',traffic:[1500,3000],rent:[1700,2600],size:[100,170],uses:['cafe']},
  buero:{n:'Büroviertel',traffic:[2200,3600],rent:[2600,4200],size:[300,650],uses:['cafe','office','hq']},
  gewerbe:{n:'Gewerbegebiet',traffic:[300,800],rent:[1500,2600],size:[1500,3000],uses:['factory']}};
const ZONE_MAP=[['wohn','buero','buero','buero','buero','wohn'],['wohn','city','city','city','city','wohn'],['wohn','city','city','city','city','wohn'],['wohn','wohn','buero','buero','wohn','wohn'],['gewerbe','gewerbe','gewerbe','gewerbe','gewerbe','gewerbe']];
const COLS=6,ROWS=5;
const STAGES=[[0,'Gründung'],[6,'Kleinunternehmen'],[50,'Mittelstand'],[250,'Großunternehmen'],[1000,'Konzern']];
const DEPTS={hr:{n:'Personal',icon:'🤝',d:'Bessere Stimmung, halb so viele Kündigungen'},mkt:{n:'Marketing',icon:'📣',d:'Werbung wirkt 35 % stärker'},
  ctrl:{n:'Controlling',icon:'📊',d:'5 % weniger Miete und Nebenkosten, keine Extra-Verwaltung'},rd:{n:'Forschung',icon:'🔬',d:'Entwicklungen doppelt so schnell, etwas mehr Qualität'}};
const COMP_CAFE={kiel:[['Bohnenwerk','#8a6a52',0.66,1.0,3],['Kaffeekontor','#6b7a8f',0.56,0.9,2]],hamburg:[['Elbröster','#4f7d8c',0.72,1.08,4],['Bohnenwerk','#8a6a52',0.66,1.0,2]],berlin:[['Spreebohne','#7d5c8c',0.7,1.02,4],['Kiezkaffee','#a07a3a',0.6,0.88,3]]};
const COMP_APPS=[['Notio','prod',0.7,90000],['Listly','prod',0.58,40000],['FitBuddy','fit',0.62,120000],['RunRun','fit',0.55,60000],['Pixelquest','game',0.66,400000],['Klickfarm','game',0.5,250000],['Spargroschen','fin',0.68,50000]];
const COMP_PROD={kiel:[['Nordholz Werke','#9a8f7a']],hamburg:[['Hanse Möbel','#7a8a9a'],['Speicherstadt Rösterei','#8a6a52']],berlin:[['Spree Manufaktur','#7a7a8a']]};
const BUYERS={stuhl:['Möbelhaus Nord','Wohnwelt','Schulträger Kiel','Hotelkette Seeblick'],tisch:['Wohnwelt','Möbelhaus Nord','Kantinenbau AG'],bohnen:['Bohnenwerk','Supermarkt Regional','Hotelkette Seeblick','Bürokaffee GmbH'],gebaeck:['Supermarkt Regional','Kantinenbau AG','Tankstellen-Shops']};
const APP_NAMES=['Taskly','Fokus','Planwerk','Pulse','Kraftakt','Moneta','Zenith','Kompass','Nordlicht','Orbit','Brise','Spark','Atlas','Quokka','Lumen'];
const GOALS=[ // der Reihe nach, mit Förderprämie
  {k:'first',n:'Eröffne dein erstes Geschäft',d:'Eine Filiale, eine veröffentlichte App oder eine laufende Linie.',reward:3000,test:G=>G.firms.some(f=>f.branch==='cafe'?f.shops.length:f.branch==='soft'?G.apps.some(a=>a.owner===f.id&&a.state==='live'):f.plants.some(p=>p.lines.length))},
  {k:'profit1',n:'Schließe einen Monat mit Gewinn ab',reward:2000,test:G=>last(G)&&last(G).net>0},
  {k:'p5k',n:'Erreiche 5.000 € Monatsgewinn',reward:5000,test:G=>last(G)&&last(G).net>=5000},
  {k:'three',n:'Drei Filialen, drei Apps oder drei Linien',reward:8000,test:G=>G.firms.some(f=>f.branch==='cafe'?f.shops.length>=3:f.branch==='soft'?G.apps.filter(a=>a.owner===f.id&&a.state!=='off').length>=3:f.plants.reduce((s,p)=>s+p.lines.length,0)>=3)},
  {k:'s10',n:'Beschäftige 10 Menschen',reward:5000,test:G=>totalStaff(G)>=10},
  {k:'stars',n:'4,5 Sterne für ein Geschäft',reward:6000,test:G=>G.firms.some(f=>(f.shops||[]).some(s=>stars(s.rep)>=4.5))||G.apps.some(a=>!a.owner.startsWith('c:')&&a.state==='live'&&rating(a)*5>=4.5)||G.firms.some(f=>f.branch==='prod'&&f.rep>=0.88)},
  {k:'city2',n:'Erschließe eine zweite Stadt',reward:15000,test:G=>Object.keys(G.cities).length>=2},
  {k:'hold',n:'Gründe eine zweite Firma',reward:10000,test:G=>G.firms.length>=2},
  {k:'p25k',n:'Erreiche 25.000 € Monatsgewinn',reward:20000,test:G=>last(G)&&last(G).net>=25000},
  {k:'hq',n:'Baue eine Konzernzentrale',reward:25000,test:G=>!!G.hq},
  {k:'take',n:'Übernimm einen Konkurrenten',reward:30000,test:G=>!!G.ms.takeover},
  {k:'s100',n:'Beschäftige 100 Menschen',reward:40000,test:G=>totalStaff(G)>=100},
  {k:'ipo',n:'Bring deinen Konzern an die Börse',reward:0,test:G=>G.public},
  {k:'s1000',n:'Beschäftige 1.000 Menschen',reward:0,test:G=>totalStaff(G)>=1000},
  {k:'rich',n:'Werde privat Millionär (1 Mio. € Vermögen)',reward:0,test:G=>wealth(G).total>=1e6},
  {k:'v100',n:'Erreiche 100 Mio. € Unternehmenswert',reward:0,test:G=>last(G)&&last(G).value>=1e8},
  {k:'bil',n:'Werde Milliardär',reward:0,test:G=>wealth(G).total>=1e9}];

// ---------- Zufall ----------
function rand(G){let t=(G.rs=(G.rs+0x6D2B79F5)|0);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}
const rr=(G,a,b)=>a+(b-a)*rand(G),pick=(G,a)=>a[Math.floor(rand(G)*a.length)];
const uid=G=>G.nextId++;
const last=G=>G.months[G.months.length-1];

// ---------- Neues Spiel ----------
function newGame(o){
  const G={v:2,rs:(o.seed||Date.now())|0,month:0,cash:0,paidIn:0,retained:0,owner:1,rounds:0,public:false,shares:1e6,sharePrice:0,priceHist:[],
    firms:[],plots:[],comps:[],apps:[],loans:[],assets:[],nextId:1,cities:{kiel:true},cityCur:'kiel',hq:null,depts:{},
    idx:{rohkaffee:1,holz:1,mehl:1,wage:1},hedge:null,months:[],news:[],pending:[],offers:{contracts:[],investor:null},tax:{paidYTD:0,carry:0},ms:{},goals:{},over:null,report:null,founderDev:true,ev:{},led:null,execs:{},me:{cash:10000,salary:36000,stocks:{},lux:[],club:null},re:1};
  G.led=emptyLedger();
  for(const c of CITIES)genCity(G,c);
  for(const c of CITIES)for(const [n,col,q,p,shops] of COMP_CAFE[c.id]){const cp=addComp(G,{branch:'cafe',name:n,color:col,q,price:p,city:c.id,rep:0.55+q*0.2});for(let k=0;k<shops;k++)compOpen(G,cp)}
  for(const [n,g,q,u] of COMP_APPS){const cp=addComp(G,{branch:'soft',name:n,color:'#8a8f96',q});G.apps.push({id:uid(G),owner:'c:'+cp.id,name:n,genre:g,scope:'M',state:'live',progress:1,work:1,quality:q,bugs:20,users:u,payers:0,model:'freemium',price:4.99,fresh:0.8,released:-6})}
  for(const c of CITIES)for(const [n,col] of COMP_PROD[c.id]){const cp=addComp(G,{branch:'prod',name:n,color:col,q:0.6,city:c.id});const pl=freePlots(G,c.id,'factory')[0];if(pl){pl.owner='c:'+cp.id;pl.use='factory'}}
  equity(G,o.capital||50000);
  if(o.finance==='loan')takeLoan(G,{amount:o.branch==='prod'?120000:60000,rate:0.065,months:60,name:'Gründerkredit'});
  if(o.finance==='angel'){equity(G,150000);G.owner*=0.8;G.rounds=1;news(G,'Ein Business Angel steigt mit 150.000 € ein und erhält 20 % der Anteile.','fin')}
  foundFirm(G,o.branch,o.name||'Mein Start-up');
  genContracts(G);genMarket(G);
  return G}
function emptyLedger(){return{f:{},H:fz(),cf:{op:0,inv:0,fin:0}}}
function fz(){return{rev:0,revInt:0,cogs:0,staff:0,rent:0,mkt:0,rd:0,other:0,dep:0,int:0,tax:0}}
function L(G,fid){if(fid==='H')return G.led.H;return G.led.f[fid]||(G.led.f[fid]=fz())}
function news(G,t,k){G.news.unshift({m:G.month,t,k:k||'info'});if(G.news.length>80)G.news.length=80}
function pay(G,fid,acc,amt,cf){if(!amt)return;G.cash-=amt;if(acc)L(G,fid)[acc]+=amt;G.led.cf[cf||'op']-=amt}
function earn(G,fid,acc,amt,cf){if(!amt)return;G.cash+=amt;if(acc)L(G,fid)[acc]+=amt;G.led.cf[cf||'op']+=amt}
function equity(G,amt){G.cash+=amt;G.paidIn+=amt;G.led.cf.fin+=amt}
function buyAsset(G,fid,name,cost,life,ref){G.cash-=cost;G.led.cf.inv-=cost;G.assets.push({id:uid(G),fid,name,cost,life,book:cost,ref:ref||null})}
function dropAssets(G,ref){for(const a of G.assets.filter(a=>a.ref===ref)){L(G,a.fid).dep+=a.book;a.book=0}G.assets=G.assets.filter(a=>a.book>0.01)}
function genCity(G,c){for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){const z=ZONES[ZONE_MAP[r][col]];
  G.plots.push({id:c.id+'-'+r+'-'+col,city:c.id,r,c:col,zone:ZONE_MAP[r][col],traffic:Math.round(rr(G,z.traffic[0],z.traffic[1])*c.traffic/50)*50,rent:Math.round(rr(G,z.rent[0],z.rent[1])*c.rent/50)*50,size:Math.round(rr(G,z.size[0],z.size[1])/10)*10,owner:null,use:null})}}
const plot=(G,id)=>G.plots.find(p=>p.id===id);
function freePlots(G,city,use){return G.plots.filter(p=>p.city===city&&!p.owner&&ZONES[p.zone].uses.includes(use)).sort((a,b)=>b.traffic-a.traffic)}
function addComp(G,o){const cp=Object.assign({id:uid(G),rep:0.6,price:1,aware:0.4,value:0},o);G.comps.push(cp);return cp}
function compOpen(G,cp){const fr=freePlots(G,cp.city,'cafe').filter(p=>p.zone!=='buero'||rand(G)<0.4);if(!fr.length)return null;const p=fr[Math.min(fr.length-1,Math.floor(rand(G)*Math.min(5,fr.length)))];p.owner='c:'+cp.id;p.use='cafe';return p}
function foundFirm(G,branch,name){
  const f={id:'f'+uid(G),name,branch,color:BRANCHES[branch].color,founded:G.month,morale:0.75,aware:0.05,rep:0.5,mkt:branch==='soft'?1500:800,wage:1.0,res:{},resCur:null};
  if(branch==='cafe'){f.shops=[];f.menu={};for(const k in PRODUCTS)f.menu[k]={on:['espresso','cappu','filter','kuchen'].includes(k),q:k==='filter'?1:2,price:PRODUCTS[k].ref}}
  if(branch==='soft')Object.assign(f,{jr:0,sr:0,des:0,qa:0,office:null,oups:{}});
  if(branch==='prod')Object.assign(f,{plants:[],goods:{},contracts:[],supplier:'standard',brand:null,autoSell:true,delivered:0,made:{}});
  G.firms.push(f);G.cur=f.id;return f}
const firm=(G,id)=>G.firms.find(f=>f.id===id);

// ---------- Personal ----------
function staffOf(G,f){if(f.branch==='cafe')return f.shops.reduce((s,x)=>s+x.staff+(x.manager?1:0),0);if(f.branch==='soft')return f.jr+f.sr+f.des+f.qa;
  return f.plants.reduce((s,p)=>s+1+p.lines.reduce((a,l)=>a+l.workers*l.shifts,0),0)}
function adminOf(G,f){return G.depts.ctrl?0:Math.floor(staffOf(G,f)/15)}
function hqStaff(G){return G.hq?4+Object.keys(G.depts).filter(k=>G.depts[k]).length*Math.max(2,Math.round(staffNoHq(G)/120)):0}
function staffNoHq(G){return 1+G.firms.reduce((s,f)=>s+staffOf(G,f)+adminOf(G,f),0)}
function totalStaff(G){return staffNoHq(G)+hqStaff(G)}
function stage(G){const n=totalStaff(G);let i=0;STAGES.forEach((x,j)=>{if(n>=x[0])i=j});return{n:STAGES[i][1],i,next:STAGES[i+1]||null,staff:n}}
const productivity=f=>(0.55+0.6*f.morale)*(f.exec||1);
const has=(f,k)=>!!f.res[k];
const wageOf=(G,role,f)=>WAGE[role]*EMP*G.idx.wage*f.wage;
const stars=rep=>Math.round((1+4*clamp(rep,0,1))*2)/2;
const season=G=>G.month%12;
const summer=G=>{const m=season(G);return m>=3&&m<=8};

// ---------- Café ----------
function menuStats(G,f,s){let sumA=0,sumW=0,sumQW=0,pf=0;const items=[];const ups=s?s.ups:{};
  for(const k in f.menu){const m=f.menu[k],P=PRODUCTS[k];if(!m.on||(P.res&&!has(f,P.res)))continue;
    let q=QUAL[m.q];if(P.coffee&&ups.espresso)q+=0.1;if(P.coffee&&ups.roaster)q+=0.06;q=Math.min(1,q);
    const pfac=clamp(Math.exp(-1.8*(m.price/P.ref-1)),0.15,1.6);let w=P.w;if(P.cake&&ups.vitrine)w*=1.4;if(P.summer&&summer(G))w*=1.8;if(s&&s.special===k)w*=1.3;
    const a=w*q*pfac;items.push({k,a,price:m.price,q:m.q,pf:pfac,qual:q});sumA+=a;sumW+=w;sumQW+=w*q;pf+=pfac*w}
  for(const it of items)it.share=sumA?it.a/sumA:0;
  return{items,score:Math.min(1.6,sumA/2.2),quality:sumW?sumQW/sumW:0,price:sumW?pf/sumW:1}}
function compAttr(cp){return Math.pow(cp.q,0.8)*0.8*clamp(Math.exp(-1.8*(cp.price-1)),0.3,1.5)*(0.35+0.65*cp.rep)}
const ZCONV={city:0.14,wohn:0.2,buero:0.15,gewerbe:0.05}; // im Wohnviertel kommen mehr Passanten als Stammgäste
const near=(a,b)=>a.city===b.city&&Math.abs(a.r-b.r)<=1&&Math.abs(a.c-b.c)<=1;
function comfortOf(s){return clamp(LEVELS[s.level].comfort+(s.ups.lounge?0.12:0)-(s.ups.togo?0.03:0),0,1)}
function shopForecast(G,f,s){ // Nachfrage und Kapazität im Monat (auch für die Vorschau)
  const p=plot(G,s.plot),ms=menuStats(G,f,s),comfort=comfortOf(s);
  const A=Math.pow(ms.score,0.8)*comfort*(0.4+0.6*s.rep);
  let comp=0;for(const q of G.plots)if(q!==p&&q.use==='cafe'&&near(p,q)){if(q.owner&&q.owner.startsWith('c:')){const cp=G.comps.find(c=>'c:'+c.id===q.owner);if(cp)comp+=compAttr(cp)}else if(q.owner===f.id)comp+=A*0.5}
  const H=HOURS[s.hours];let m=H.dem;const u=s.ups,a=s.act;
  if(u.wlan&&(p.zone==='city'||p.zone==='buero'))m*=1.12;if(u.togo)m*=1.15;if(u.kids&&p.zone==='wohn')m*=1.15;if(u.roaster)m*=1.08;if(u.terrasse&&summer(G))m*=1.2;
  if(a.happy)m*=1.18;if(a.music)m*=1.06;if(a.stamp)m*=1.08;if(has(f,'treue'))m*=1.12;if(G.ev&&G.ev.heat)m*=1.1;if(G.ev&&G.ev.fest===s.id)m*=1.35;
  const la=Math.max(f.aware,s.la||0,(f.cityAw&&f.cityAw[p.city])||0);
  const dem=p.traffic*DAYS*ZCONV[p.zone]*(0.5+0.5*la)*m*A/(A+comp*0.9+0.35);
  let cap=s.staff*85*DAYS*productivity(f)*H.cap*(s.manager?1.12:1)*(has(f,'schnell')?1.25:1)*(u.togo?1.2:1)*(u.terrasse&&summer(G)?1.2:1);
  cap=Math.min(cap,p.size*3.5*DAYS*H.cap*(u.terrasse&&summer(G)?1.2:1));
  return{dem,cap,ms,comfort,A,comp}}
function cafeMonth(G,f,rep){
  for(const s of f.shops){const p=plot(G,s.plot),fc=shopForecast(G,f,s),H=HOURS[s.hours];
    const guests=Math.floor(Math.min(fc.dem,fc.cap));let rev=0,cogs=0,cogsInt=0;const per=1.5;
    for(const it of fc.ms.items){const P=PRODUCTS[it.k],n=guests*per*it.share,qm=QMULT[it.q];rev+=n*it.price;cogs+=n*P.other*qm;
      if(P.beans){const kg=n*P.beans,sup=supplier(G,'bohnen');let got={qty:0,cost:0};if(sup)got=takeGoods(G,sup,'bohnen',kg);cogsInt+=got.cost;cogs+=(kg-got.qty)*GOODS.bohnen.ref*G.idx.rohkaffee*qm}
      if(P.piece){const pc=n*P.piece,sup=supplier(G,'gebaeck');let got={qty:0,cost:0};if(sup)got=takeGoods(G,sup,'gebaeck',pc);cogsInt+=got.cost;cogs+=(pc-got.qty)*P.mkt*qm}}
    if(s.act.happy)rev*=0.94;
    let deliv=0;if(s.ups.delivery){deliv=rev*0.15;rev+=deliv;cogs*=1.15}
    earn(G,f.id,'rev',rev);pay(G,f.id,'cogs',cogs);L(G,f.id).cogs+=cogsInt;
    const wages=s.staff*wageOf(G,'barista',f)*H.wage+(s.manager?wageOf(G,'manager',f):0);pay(G,f.id,'staff',wages);
    const ctrl=G.depts.ctrl?0.95:1;pay(G,f.id,'rent',rentOf(p)*ctrl);
    let other=(200+250*s.level)*(s.ups.solar?0.6:1)*ctrl+deliv*0.25;for(const k in s.ups)other+=CAFE_UPS[k].mon;pay(G,f.id,'other',other);
    let mk=0;for(const k in s.act)if(s.act[k])mk+=CAFE_ACTIONS[k].cost;if(s.act.stamp)mk+=rev*0.03;pay(G,f.id,'mkt',mk);
    s.la=(s.la||0)*0.85+(s.act.flyer?0.12:0);
    const served=fc.dem>0?Math.min(1,fc.cap/fc.dem):1,service=(s.manager?0.08:0)+(s.train||0)*0.05;
    const sat=clamp(0.42*fc.ms.quality/0.93+0.2*fc.comfort+0.2*served+0.12*Math.min(1,fc.ms.price)+service+(s.act.music?0.03:0)+(s.ups.roaster?0.03:0),0,1);
    s.rep+=(sat-s.rep)*(s.ups.roaster?0.4:0.3);
    const profit=rev-cogs-cogsInt-wages-rentOf(p)*ctrl-other-mk;
    let hot=0,cold=0,food=0;for(const it of fc.ms.items){const P=PRODUCTS[it.k],v=guests*per*it.share*it.price*(s.act.happy?0.94:1)*(s.ups.delivery?1.15:1);if(P.cake||k_food(it.k))food+=v;else if(P.summer)cold+=v;else hot+=v}
    const prev=s.stat;s.stat={guests,dem:Math.round(fc.dem),cap:Math.round(fc.cap),rev,cost:rev-profit,profit,sat,served,hot,cold,food,cogs:cogs+cogsInt,wages,rent:rentOf(p)*ctrl,other,mk};
    s.hist=(s.hist||[]).concat([{m:G.month,rev,profit,guests}]).slice(-8);s.rcount=(s.rcount||0)+Math.round(guests*0.012);
    s.reviews=reviewsFor(G,s,fc,served);
    rep.items.push({kind:'shop',id:s.id,fid:f.id,plot:p.id,icon:'☕',name:ZONES[p.zone].n+' '+cityName(p.city),firm:f.name,rev,profit,kpi:fn(guests)+' Gäste',delta:prev?guests-prev.guests:null,stars:stars(s.rep)})}
  if(f.shops.length)f.rep+=(f.shops.reduce((a,s)=>a+s.rep,0)/f.shops.length-f.rep)*0.5}
function reviewsFor(G,s,fc,served){const out=[];const q=fc.ms.quality,c=fc.comfort,pr=fc.ms.price;const good=[],bad=[];
  if(q>0.75)good.push(pick(G,['„Der beste Cappuccino der Stadt.“','„Man schmeckt die Qualität. Komme wieder!“','„Kaffee wie in Italien.“']));
  if(q<0.5)bad.push(pick(G,['„Der Kaffee war leider wässrig.“','„Kuchen schmeckte wie vom Discounter.“']));
  if(c>0.85)good.push(pick(G,['„So gemütlich, ich bleibe immer länger als geplant.“','„Wunderschön eingerichtet.“']));
  if(served<0.85)bad.push(pick(G,['„Lange Schlange, nach 15 Minuten aufgegeben.“','„Viel zu voll, kein Platz bekommen.“','„Das Personal war völlig überlastet.“']));
  if(pr<0.7)bad.push(pick(G,['„Lecker, aber ganz schön teuer.“','„Für den Preis erwarte ich mehr.“']));
  if(pr>1.15)good.push('„Faire Preise, super Preis-Leistung.“');
  if(s.ups.wlan)good.push('„Perfekt zum Arbeiten mit dem Laptop.“');if(s.act.music)good.push('„Die Live-Musik am Samstag war großartig!“');
  if(s.ups.terrasse&&summer(G))good.push('„Traumhafte Terrasse in der Sonne.“');if(s.manager)good.push('„Freundlich und gut organisiert.“');
  const g=good.length?pick(G,good):null,b=bad.length?pick(G,bad):null;
  if(g)out.push({s:Math.min(5,stars(s.rep)+0.5),t:g});if(b)out.push({s:Math.max(1,stars(s.rep)-1.5),t:b});if(!out.length)out.push({s:stars(s.rep),t:'„Solide. Nichts Besonderes, aber gut.“'});return out}
function k_food(k){return k==='bowl'}
function supplier(G,good){for(const f of G.firms)if(f.branch==='prod'&&goodsTotal(f,good)>0)return f;return null}
function takeGoods(G,sup,good,qty){let got=0,cost=0;const gs=sup.goods[good];if(!gs)return{qty:0,cost:0};
  for(let g=1;g<=3&&got<qty;g++){const b=gs[g];if(!b||b.q<=0)continue;const t=Math.min(b.q,qty-got),uc=b.cost/b.q;b.q-=t;b.cost-=uc*t;got+=t;cost+=uc*t}
  if(got>0){L(G,sup.id).revInt+=cost;L(G,sup.id).cogs+=cost;sup.internal=(sup.internal||0)+cost}return{qty:got,cost}}

// ---------- Software ----------
function softTeam(G,f){const fd=G.founderDev&&f.id===G.firms[0].id?1.4:0,raw=fd+f.jr+f.sr*2.2;
  return{fd,raw,P:raw*productivity(f)*(f.oups.hardware?1.1:1)*(G.execs&&G.execs.cto?1.12:1)*DAYS,qT:clamp(0.45+0.45*(f.sr*2.2)/Math.max(1,raw)+Math.min(0.12,f.des*0.04)+(has(f,'ki')?0.1:0)+(G.depts.rd?0.04:0),0,0.97),
    bugMult:(1/(1+4*f.qa/Math.max(1,f.jr+f.sr+(fd?1:0))))*(has(f,'ci')?0.6:1)*(f.oups.quiet?0.8:1)}}
function desks(G,f){if(!f.office)return 3;return Math.floor(plot(G,f.office).size/10)}
function rating(a){const bd=a.bugs/(40+a.users/1500);return clamp(a.quality*1.1-Math.min(1,bd)*0.3,0,1)}
function appAttr(a){const fr=a.fresh===undefined?1:a.fresh;return Math.pow(rating(a),1.6)*(0.4+0.6*fr)*(a.model==='freemium'?clamp(Math.exp(-(a.price-4.99)/10),0.3,1.4):a.model==='paid'?0.7:1.1)}
function softMonth(G,f,rep){
  const t=softTeam(G,f),mine=G.apps.filter(a=>a.owner===f.id&&a.state!=='off'),wsum=mine.reduce((s,a)=>s+a.share,0)||1;
  for(const a of mine){const W=t.P*a.share/wsum;a.work_m=W;
    if(a.state==='dev'){const qi=clamp(t.qT+SCOPES[a.scope].q,0,0.97);a.quality=(a.quality*a.progress+qi*W)/Math.max(1e-6,a.progress+W);a.progress+=W;a.bugs+=W*0.06*t.bugMult;
      if(a.progress>=a.work)release(G,f,a)}
    else if(a.state==='live'){const fo=a.focus;
      a.bugs+=a.users/1e5*45*t.bugMult;a.bugs=Math.max(0,a.bugs-W*(fo==='bugs'?0.9:0.25));
      if(fo==='features'){a.quality+=Math.max(0,t.qT+0.1-a.quality)*W*0.0012;a.bugs+=W*0.05*t.bugMult}
      a.fresh=clamp((a.fresh===undefined?1:a.fresh)-0.12+W*(fo==='features'?0.006:0.002),0,1)}}
  let rev=0,server=0;
  for(const a of mine)if(a.state==='live'){const gen=GENRES[a.genre],rivals=G.apps.filter(b=>b!==a&&b.genre===a.genre&&b.state==='live');
    const A=appAttr(a),Ac=rivals.reduce((s,b)=>s+appAttr(b),0),total=rivals.reduce((s,b)=>s+b.users,0)+a.users,sat=clamp(total/(gen.pot*1.6),0,1);
    const mult=(G.month-a.released<=1?2:1)*(a.focus==='growth'?1.3:1)*(a.camp.social?1.15:1)*(a.camp.influencer?1.5:1)*(a.model==='paid'?0.55:1)*(G.ev&&G.ev.feature===a.id?2.5:1);
    let nu=gen.pot*SCOPES[a.scope].pot*0.005*DAYS*(0.25+f.aware*1.2)*A/(A+Ac*0.4+0.3)*(1-sat)*mult;
    if(a.camp.influencer)nu+=gen.pot*0.01*rating(a);if(a.ads>0)nu+=a.ads/gen.cpi*(0.5+rating(a));
    const bd=a.bugs/(40+a.users/1500),fr=a.fresh===undefined?1:a.fresh;
    const churnR=Math.min(0.5,DAYS*(0.002+0.012*Math.min(1.5,bd)+0.004*(1-fr)+(a.model==='free'?0.001:0))*(a.focus==='perf'?0.7:1));
    const prev=a.users;a.users=Math.max(0,a.users+nu-a.users*churnR);a.peak=Math.max(a.peak||0,a.users);
    let r=0;if(a.model==='freemium'){a.payers=a.users*0.18*gen.conv*(0.4+0.6*rating(a))*Math.exp(-a.price/8)*(a.focus==='money'?1.25:1);r=a.payers*a.price*0.85}
    else if(a.model==='free'){a.payers=0;r=a.users*0.22*gen.adv*(a.focus==='money'?1.15:1)}else{a.payers=0;r=nu*a.price*0.85}
    if(G.ev&&G.ev.featureCut===a.id)r*=0.7;
    rev+=r;const sv=a.users*0.05*(has(f,'cloud')?0.6:1);server+=sv;
    const mk=(a.camp.social?CAMPAIGNS.social.cost:0)+(a.camp.influencer?CAMPAIGNS.influencer.cost:0)+(a.ads||0);pay(G,f.id,'mkt',mk);
    a.reviews=appReviews(G,a,bd);a.stat={rev:r,new:nu,churn:prev*churnR,server:sv,mk};
    rep.items.push({kind:'app',id:a.id,fid:f.id,icon:gen.icon,name:a.name,firm:f.name,rev:r,profit:r-sv-mk,kpi:fn(a.users)+' Nutzer',delta:Math.round(a.users-prev),stars:Math.round(rating(a)*10)/2});
    a.camp.influencer=false}
  for(const a of mine)if(a.state==='dev')rep.items.push({kind:'dev',id:a.id,fid:f.id,icon:'🛠️',name:a.name,firm:f.name,rev:0,profit:0,kpi:Math.round(a.progress/a.work*100)+' % fertig'});
  earn(G,f.id,'rev',rev);pay(G,f.id,'other',server);
  pay(G,f.id,'staff',f.jr*wageOf(G,'jr',f)+f.sr*wageOf(G,'sr',f)+f.des*wageOf(G,'des',f)+f.qa*wageOf(G,'qa',f));
  if(f.office){const ctrl=G.depts.ctrl?0.95:1;pay(G,f.id,'rent',rentOf(plot(G,f.office))*ctrl);let o=(300+desks(G,f)*15)*ctrl;for(const k in f.oups)o+=OFFICE_UPS[k].mon;pay(G,f.id,'other',o)}
  const live=mine.filter(a=>a.state==='live');f.rep+=((live.length?live.reduce((s,a)=>s+rating(a),0)/live.length:0.5)-f.rep)*0.3}
function appReviews(G,a,bd){const r=rating(a),out=[];
  if(bd>0.5)out.push({s:1.5,t:pick(G,['„Stürzt ständig ab. Bitte fixen!“','„Seit dem Update geht nichts mehr.“'])});
  if(r>0.75)out.push({s:5,t:pick(G,['„Genau so eine App habe ich gesucht.“','„Durchdacht und schnell. Top!“','„Benutze ich jeden Tag.“'])});
  if((a.fresh===undefined?1:a.fresh)<0.4)out.push({s:2.5,t:'„Seit Monaten kein Update mehr …“'});
  if(a.model==='freemium'&&a.price>7)out.push({s:2,t:'„Das Abo ist mir zu teuer.“'});
  if(a.model==='free')out.push({s:3,t:'„Gut, aber die Werbung nervt.“'});
  if(!out.length)out.push({s:Math.round(r*10)/2,t:'„Macht, was sie soll.“'});return out.slice(0,2)}
function release(G,f,a){a.state='live';a.released=G.month;a.quality*=Math.min(1,0.6+0.4*a.progress/a.work);a.fresh=1;
  news(G,f.name+' veröffentlicht „'+a.name+'“ ('+GENRES[a.genre].n+'). Qualität '+Math.round(a.quality*100)+' %.','good')}

// ---------- Produktion ----------
function goodsTotal(f,g){const gs=f.goods&&f.goods[g];if(!gs)return 0;let s=0;for(let k=1;k<=3;k++)s+=gs[k]?gs[k].q:0;return s}
function lineNeed(l){const T=LINES[l.type];return l.auto?Math.max(1,T.workers-2):T.workers}
function lineOut(G,f,l){const T=LINES[l.type];return T.cap[l.product]*DAYS*Math.min(1,l.workers/lineNeed(l))*SHIFTS[l.shifts]*productivity(f)*(l.auto?1.3:1)}
function rawPrice(G,r,f){const sup=SUPPLIERS[f?f.supplier:'standard'];const idx=G.hedge&&G.hedge.left>0&&G.hedge.raw===r?G.hedge.idx:G.idx[r];return RAW[r].p*idx*sup.p}
function effGrade(f,l){return clamp(l.grade-(f.supplier==='cheap'?1:0)+(l.qc?1:0),1,3)}
function storageCap(G,f){return f.plants.reduce((s,p)=>s+p.lines.reduce((a,l)=>a+lineOut(G,f,l),0)*(p.ups.lager?4:2),0)}
function prodProduce(G,f){
  f.made={};
  for(const p of f.plants)for(const l of p.lines){let out=lineOut(G,f,l);l.broke=false;if(!l.maint&&rand(G)<0.2){out*=rr(G,0.65,0.9);l.broke=true}if(G.ev&&G.ev.machine===l.id)out*=0.6;
    const m=GOODS[l.product].mat;let cost=0;for(const r in m)cost+=out*m[r]*GMULT[l.grade]*rawPrice(G,r,f);
    pay(G,f.id,null,cost); // Einkauf: Geld wird zu Lagerbestand, Aufwand erst beim Verkauf
    const g=effGrade(f,l),gs=f.goods[l.product]||(f.goods[l.product]={}),b=gs[g]||(gs[g]={q:0,cost:0});b.q+=out;b.cost+=cost;l.made=out;f.made[l.product]=(f.made[l.product]||0)+out}}
function prodSell(G,f){
  const r0=L(G,f.id).rev,c0=L(G,f.id).cogs,bio=f.supplier==='bio'?1.12:1;f.sales={contract:0,brand:0,whole:0};
  for(const c of f.contracts){let left=c.qty-c.done;const gs=f.goods[c.good];if(!gs||left<=0)continue;
    for(let g=c.grade;g<=3&&left>0;g++){const b=gs[g];if(!b||b.q<1)continue;const t=Math.min(Math.floor(b.q),left),uc=b.cost/b.q;b.q-=t;b.cost-=uc*t;c.done+=t;left-=t;
      earn(G,f.id,'rev',t*c.price*bio);f.sales.contract+=t*c.price*bio;L(G,f.id).cogs+=uc*t;pay(G,f.id,'other',t*GOODS[c.good].ship);f.delivered+=t}
    if(c.done>=c.qty){f.rep+=(1-f.rep)*0.06;news(G,f.name+': Auftrag von '+c.buyer+' erfüllt.','good')}}
  f.contracts=f.contracts.filter(c=>{if(c.done>=c.qty)return false;if(G.month+1>=c.due){const pen=(c.qty-c.done)*c.price*0.15;pay(G,f.id,'other',pen);f.rep=Math.max(0,f.rep-0.08);
    news(G,f.name+': Auftrag von '+c.buyer+' nicht rechtzeitig geliefert. Strafe '+fmtE(pen)+'.','bad');return false}return true});
  if(f.brand){f.brand.aware+=(clamp(0.05+0.9*f.brand.mkt*(G.depts.mkt?1.35:1)/(f.brand.mkt+15000),0,0.95)-f.brand.aware)*0.25;pay(G,f.id,'mkt',f.brand.mkt);
    for(const g in f.goods){const q=goodsTotal(f,g)-reserved(f,g);if(q<1)continue;const vol=Math.min(q,GOODS[g].brand*f.brand.aware*Object.keys(G.cities).length*(0.5+f.rep));if(vol<1)continue;
      const price=GOODS[g].ref*1.3*bio,sold=takeOwn(f,g,vol);earn(G,f.id,'rev',sold.qty*price);f.sales.brand+=sold.qty*price;L(G,f.id).cogs+=sold.cost}}
  const capS=storageCap(G,f);
  for(const g in f.goods){const q=goodsTotal(f,g),res=reserved(f,g)+(g==='bohnen'||g==='gebaeck'?internalNeed(G,g):0);
    let sell=0;if(f.autoSell)sell=Math.max(0,q-res-(f.made[g]||0)*0.5);const over=goodsTotalAll(f)-capS;if(over>0)sell=Math.max(sell,Math.min(q,over));
    if(sell>=1){const r=sellWholesale(G,f,g,sell,true);f.sales.whole+=r.rev||0}}
  return{rev:L(G,f.id).rev-r0,cogs:L(G,f.id).cogs-c0}}
function reserved(f,g){return f.contracts.filter(c=>c.good===g).reduce((s,c)=>s+c.qty-c.done,0)}
function goodsTotalAll(f){let s=0;for(const g in f.goods)s+=goodsTotal(f,g);return s}
function takeOwn(f,g,qty){const gs=f.goods[g];let got=0,cost=0;for(let k=3;k>=1&&got<qty;k--){const b=gs[k];if(!b||b.q<=0)continue;const t=Math.min(b.q,qty-got),uc=b.cost/b.q;b.q-=t;b.cost-=uc*t;got+=t;cost+=uc*t}return{qty:got,cost}}
function internalNeed(G,g){let n=0;for(const f of G.firms)if(f.branch==='cafe')for(const s of f.shops){const g0=s.stat?s.stat.guests:0;const ms=menuStats(G,f,s);for(const it of ms.items){const P=PRODUCTS[it.k];n+=g0*1.5*it.share*(g==='bohnen'?(P.beans||0):(P.piece||0))}}return n}
function wholesalePrice(G,f,g,grade){return GOODS[g].ref*0.7*(1+0.15*(grade-1))*(g==='bohnen'?G.idx.rohkaffee:1)}
function sellWholesale(G,f,g,qty,quiet){const gs=f.goods[g];if(!gs)return{ok:false,msg:'Nichts auf Lager.'};let left=qty,sold=0,rev=0;
  for(let k=1;k<=3&&left>0;k++){const b=gs[k];if(!b||b.q<=0)continue;const t=Math.min(b.q,left),uc=b.cost/b.q;b.q-=t;b.cost-=uc*t;left-=t;sold+=t;rev+=t*wholesalePrice(G,f,g,k);L(G,f.id).cogs+=uc*t}
  earn(G,f.id,'rev',rev);if(!quiet)news(G,f.name+' verkauft '+fn(sold)+' '+GOODS[g].n+' an den Großhandel.','info');return{ok:true,rev,msg:'Verkauft: '+fn(sold)+' '+GOODS[g].n+' für '+fmtE(rev)}}
function prodCosts(G,f,rep,sales){const ctrl=G.depts.ctrl?0.95:1;const n=f.plants.length||1;
  for(const p of f.plants){const pl=plot(G,p.plot);let w=wageOf(G,'worker',f),energy=400;
    for(const l of p.lines){w+=l.workers*wageOf(G,'worker',f)*(l.shifts+(l.shifts>=3?0.15:0));energy+=LINES[l.type].energy*SHIFTS[l.shifts]*(p.ups.solar?0.65:1);if(l.qc)energy+=2500;if(l.maint)energy+=1200}
    for(const k in p.ups)energy+=PLANT_UPS[k].mon;pay(G,f.id,'staff',w);pay(G,f.id,'rent',rentOf(pl)*ctrl);pay(G,f.id,'other',energy*ctrl);
    const rev=(sales.rev+(f.internal||0))/n,gross=(sales.rev+(f.internal||0)-sales.cogs)/n;
    rep.items.push({kind:'plant',id:p.id,fid:f.id,plot:p.plot,icon:'🏭',name:'Werk '+cityName(pl.city),firm:f.name,rev,profit:gross-w-rentOf(pl)*ctrl-energy*ctrl,
      kpi:p.lines.map(l=>fn(l.made)+' '+GOODS[l.product].unit).join(' · ')||'keine Linie',broke:p.lines.some(l=>l.broke)})}}
function canMake(f,g){return f.branch==='prod'&&f.plants.some(p=>p.lines.some(l=>LINES[l.type].cap[g]))}
function genContracts(G){const compN=G.comps.filter(c=>c.branch==='prod').length;
  G.offers.contracts=G.offers.contracts.filter(c=>c.expires>G.month&&firm(G,c.fid));
  for(const f of G.firms)if(f.branch==='prod'){const goods=Object.keys(GOODS).filter(g=>!GOODS[g].res||has(f,GOODS[g].res)),makeable=goods.filter(x=>canMake(f,x));
    const n=2+Math.floor(rand(G)*2);
    for(let k=0;k<n;k++){const g=makeable.length&&rand(G)<0.8?pick(G,makeable):pick(G,goods);const T=LINES[Object.keys(LINES).find(t=>LINES[t].cap[g])];
      const months=1+Math.floor(rand(G)*2),qty=Math.max(10,Math.round(T.cap[g]*DAYS*0.9*months*rr(G,0.3,0.8)*(1+0.5*f.rep)/5)*5),grade=rand(G)<0.5?1:rand(G)<0.7?2:3;
      const price=GOODS[g].ref*rr(G,0.84,1.08)*(1+0.12*(grade-1))*(0.92+0.16*f.rep)*(has(f,'qm')?1.06:1)*(1-0.02*compN)*(g==='bohnen'?G.idx.rohkaffee:1);
      G.offers.contracts.push({id:uid(G),fid:f.id,good:g,qty,grade,price:Math.round(price*100)/100,months,expires:G.month+2,buyer:pick(G,BUYERS[g])})}}
  G.offers.contracts=G.offers.contracts.slice(-10)}

// ---------- Monatsabschluss ----------
function endTurn(G){
  if(G.over)return null;
  for(const e of [...G.pending])decide(G,e.id,EVENTS[e.k].def||0); // offene Entscheidungen bekommen die Standardwahl
  const rep={month:G.month,items:[],events:[],goals:[],cash0:G.cash};
  for(const r of ['rohkaffee','holz','mehl'])G.idx[r]=clamp(G.idx[r]*(1+(rand(G)-0.5)*0.07)+(1-G.idx[r])*0.12,0.6,1.7);
  for(const f of G.firms)f.exec=G.execs&&G.execs.coo?1.06:1;
  for(const f of G.firms)if(f.branch==='prod'){f.internal=0;prodProduce(G,f)}
  for(const f of G.firms)if(f.branch==='cafe')cafeMonth(G,f,rep);
  for(const f of G.firms)if(f.branch==='soft')softMonth(G,f,rep);
  for(const f of G.firms)if(f.branch==='prod'){const s=prodSell(G,f);prodCosts(G,f,rep,s)}
  for(const f of G.firms){pay(G,f.id,'mkt',f.mkt);pay(G,f.id,'staff',adminOf(G,f)*wageOf(G,'admin',f));
    const m=f.mkt*(G.depts.mkt?1.35:1)*(G.execs&&G.execs.cmo?1.2:1),cities=f.branch==='cafe'?Math.max(1,new Set(f.shops.map(s=>plot(G,s.plot).city)).size):1;
    const K=(f.branch==='soft'?9000:f.branch==='prod'?3000:2500)*(f.branch==='cafe'?Math.max(1,Math.sqrt(f.shops.length)*0.8)*cities:1);
    f.aware+=(0.06+0.86*m/(m+K)-f.aware)*0.3;
    const load=f.branch==='soft'?Math.max(0,(staffOf(G,f)+(G.founderDev&&f.id===G.firms[0].id?1:0))/desks(G,f)-1):0;
    let perk=G.depts.hr?0.1:0;if(f.branch==='soft')perk+=(f.oups.kitchen?0.08:0)+(f.oups.gaming?0.05:0);if(f.branch==='prod')perk+=f.plants.some(p=>p.ups.kantine)?0.06:0;
    if(f.branch==='cafe'&&f.shops.length)perk+=f.shops.filter(s=>s.manager).length/f.shops.length*0.05;
    const mt=clamp(0.62+(f.wage-1)*1.6+perk-load*0.6+(f.moraleBoost||0),0.1,1);f.morale+=(mt-f.morale)*0.45;f.moraleBoost=(f.moraleBoost||0)*0.5;
    if(f.resCur){f.resCur.left-=G.depts.rd?2:1;if(f.resCur.left<=0){const R=RESEARCH[f.branch][f.resCur.k];f.res[f.resCur.k]=true;news(G,f.name+': '+R.n+' fertig entwickelt.','good');rep.events.push({icon:R.icon,t:'Fertig entwickelt: '+R.n+'. '+R.d+'.'});f.resCur=null}}}
  privateMonth(G,rep);propertyMonth(G,rep);campaignMonth(G);for(const k in G.execs)if(G.execs[k])pay(G,'H','staff',EXECS[k].salary);
  if(G.hq){const dc=Object.keys(G.depts).filter(k=>G.depts[k]).length;pay(G,'H','staff',8000+dc*(4000+30*staffNoHq(G)));pay(G,'H','rent',rentOf(plot(G,G.hq)))}
  for(const a of G.assets){const d=Math.min(a.book,a.cost/a.life);a.book-=d;L(G,a.fid).dep+=d}G.assets=G.assets.filter(a=>a.book>0.01);
  for(const l of G.loans){const i=l.bal*Math.max(0.01,l.rate-(G.execs&&G.execs.cfo?0.005:0))/12;pay(G,'H','int',i);const p=Math.min(l.bal,l.pay-i);G.cash-=p;G.led.cf.fin-=p;l.bal-=p}G.loans=G.loans.filter(l=>l.bal>0.5);
  if(G.cash<0)pay(G,'H','int',-G.cash*0.12/12);
  if(G.hedge&&G.hedge.left>0)G.hedge.left--;
  const pre=pretax(G.led),yr=Math.floor(G.month/12),ytd=G.months.filter(x=>Math.floor(x.m/12)===yr).reduce((s,x)=>s+x.pre,0)+pre;
  const due=Math.max(0,ytd-G.tax.carry)*(G.execs&&G.execs.cfo?TAX-0.03:TAX),delta=due-G.tax.paidYTD;if(Math.abs(delta)>0.5){G.cash-=delta;G.led.H.tax+=delta;G.led.cf.op-=delta;G.tax.paidYTD+=delta}
  const net=pre-G.led.H.tax;G.retained+=net;
  const rec={m:G.month,f:G.led.f,H:G.led.H,cf:G.led.cf,cash:G.cash,pre,net,staff:totalStaff(G)};rec.bal=balance(G);rec.value=valuation(G,rec).total;
  G.months.push(rec);if(G.months.length>60)G.months.shift();
  if(G.month%12===11){if(ytd<0)G.tax.carry+=-ytd;else G.tax.carry=Math.max(0,G.tax.carry-ytd);G.tax.paidYTD=0;rep.events.push({icon:'📘',t:'Jahresabschluss '+yearOf(G.month)+': '+fmtE(G.months.filter(x=>Math.floor(x.m/12)===yr).reduce((s,x)=>s+x.net,0))+' Jahresergebnis.'})}
  G.led=emptyLedger();
  for(const f of G.firms)if(f.morale<0.45&&rand(G)<(G.depts.hr?0.5:1)*(0.45-f.morale)*2.5){const who=quit(G,f);if(who){news(G,f.name+': '+who+' hat gekündigt.','bad');rep.events.push({icon:'🚪',bad:true,t:f.name+': '+who+' hat gekündigt. Die Stimmung ist schlecht.'})}}
  for(const cp of G.comps){if(cp.branch==='cafe'&&rand(G)<0.07&&G.plots.filter(p=>p.owner==='c:'+cp.id).length<7){const p=compOpen(G,cp);if(p&&G.cities[cp.city]){news(G,cp.name+' eröffnet in '+cityName(cp.city)+'.','comp');rep.events.push({icon:'🏪',t:'Konkurrenz: '+cp.name+' eröffnet eine Filiale ('+ZONES[p.zone].n+', '+cityName(cp.city)+').'})}}
    if(cp.branch==='cafe'&&rand(G)<0.05)cp.q=clamp(cp.q+rr(G,-0.03,0.05),0.4,0.9);compValue(G,cp)}
  for(const a of G.apps)if(a.owner.startsWith('c:')&&a.state==='live')a.users*=1+0.018*(a.quality-0.4)*(1-a.users/GENRES[a.genre].pot);
  if(rand(G)<0.08){const g=pick(G,Object.keys(GENRES)),cp=addComp(G,{branch:'soft',name:pick(G,APP_NAMES)+' '+pick(G,['Labs','Studio','Apps']),color:'#8a8f96',q:rr(G,0.5,0.75)});
    G.apps.push({id:uid(G),owner:'c:'+cp.id,name:pick(G,APP_NAMES),genre:g,scope:'M',state:'live',progress:1,work:1,quality:cp.q,bugs:15,users:5000,payers:0,model:'freemium',price:4.99,fresh:1,released:G.month})}
  if(G.cash<-dispo(G)){G.insolvT=(G.insolvT||0)+1;rep.events.push({icon:'⚠️',bad:true,t:'Der Dispo ist überzogen ('+G.insolvT+' von 3). Nach drei Monaten im Minus droht die Insolvenz.'});if(G.insolvT>=3)G.over='insolvent'}else G.insolvT=0;
  marketsMonth(G,rep);clubMonth(G,rep);
  G.month++;G.ev={};
  if(G.month%12===0)for(const p of G.plots)p.rent=Math.round(p.rent*1.02/10)*10;
  marketNews(G,rep);genContracts(G);investorOffer(G,rep);rollEvents(G);
  if(G.public){const v=valuation(G).total;G.sharePrice=Math.max(0.01,G.sharePrice*0.6+v/G.shares*0.4)*(1+(rand(G)-0.5)*0.08);G.priceHist.push(G.sharePrice);if(G.priceHist.length>48)G.priceHist.shift()}
  for(const g of GOALS)if(!G.goals[g.k]&&g.test(G)){G.goals[g.k]=G.month;if(g.reward){G.cash+=g.reward;G.paidIn+=g.reward;G.led.cf.fin+=g.reward}rep.goals.push(g);news(G,'Ziel erreicht: '+g.n,'ms')}
  const p=pl(rec);rep.net=net;rep.rev=p.rev;rep.ebitda=p.ebitda;rep.cash=G.cash;rep.value=rec.value;rep.staff=rec.staff;rep.stage=stage(G).n;
  G.report=rep;return rep}
function quit(G,f){if(f.branch==='cafe'){const s=f.shops.filter(s=>s.staff>1).sort((a,b)=>b.staff-a.staff)[0];if(s){s.staff--;return'eine Barista-Kraft'}}
  if(f.branch==='soft'){if(f.sr>0&&rand(G)<0.5){f.sr--;return'ein Senior-Entwickler'}if(f.jr>0){f.jr--;return'ein Junior-Entwickler'}}
  if(f.branch==='prod')for(const p of f.plants)for(const l of p.lines)if(l.workers>1){l.workers--;return'eine Fachkraft'}return null}
function pretax(led){let s=0;for(const id in led.f){const x=led.f[id];s+=x.rev+x.revInt-x.cogs-x.staff-x.rent-x.mkt-x.rd-x.other-x.dep-x.int}const h=led.H;return s+h.rev-(h.staff+h.rent+h.mkt+h.rd+h.other+h.dep+h.int)}
function marketNews(G,rep){const r=rand(G);
  if(r<0.10){G.idx.rohkaffee=clamp(G.idx.rohkaffee*rr(G,1.1,1.22),0.6,1.7);rep.events.push({icon:'📈',t:'Missernte in Brasilien: Rohkaffee wird deutlich teurer.'})}
  else if(r<0.18){G.idx.rohkaffee=clamp(G.idx.rohkaffee*rr(G,0.82,0.92),0.6,1.7);rep.events.push({icon:'📉',t:'Rekordernte: Rohkaffee wird günstiger.'})}
  else if(r<0.25){G.idx.holz=clamp(G.idx.holz*rr(G,1.06,1.18),0.6,1.7);rep.events.push({icon:'🌲',t:'Holz wird knapp, die Preise ziehen an.'})}
  else if(r<0.33&&summer(G)){G.ev.heat=true;rep.events.push({icon:'☀️',t:'Hitzewelle angekündigt: mehr Laufkundschaft im kommenden Monat.'})}
  else if(r<0.37){G.idx.wage*=1.03;rep.events.push({icon:'🧾',t:'Tarifabschluss: Die Löhne steigen um 3 %.'})}}
function investorOffer(G,rep){if(G.public||G.rounds>=4){G.offers.investor=null;return}const v=valuation(G).total;
  if(G.offers.investor&&G.offers.investor.expires<G.month)G.offers.investor=null;
  if(!G.offers.investor&&v>Math.max(300000,(G.lastRoundV||0)*1.6)&&G.month-(G.lastRoundM===undefined?-99:G.lastRoundM)>=6&&rand(G)<0.35){const amt=Math.round(v*0.25/10000)*10000;
    G.offers.investor={amount:amt,share:0.2,name:pick(G,['Nordlicht Ventures','Hanse Capital','Elbe Partners','Spree Invest']),expires:G.month+2};
    if(rep)rep.events.push({icon:'💼',t:G.offers.investor.name+' bietet '+fmtE(amt)+' für 20 % der Anteile (unter Finanzen).'})}}
function dispo(G){const ms=G.months.slice(-3);const rev=ms.length?ms.reduce((s,m)=>s+sumF(m,'rev'),0)/ms.length:0;return 25000+0.5*rev}
function sumF(m,k){let s=0;for(const id in m.f)s+=m.f[id][k]||0;return s}

// ---------- Entscheidungen ----------
const EVENTS={
  blogger:{branch:'cafe',icon:'📸',when:(G,f)=>f.shops.length,make:(G,f)=>{const s=pick(G,f.shops);return{ref:s.id,t:'Die Food-Bloggerin @kielisst möchte deine Filiale ('+shopName(G,s)+') testen. 40.000 Menschen lesen mit.'}},
    opts:[{n:'Einladen und groß auftischen',d:'Kostet 300 €. Meistens gibt es einen begeisterten Artikel.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);pay(G,f.id,'mkt',300);if(!s)return'';if(rand(G)<0.75){s.rep=Math.min(1,s.rep+0.1);f.aware=Math.min(1,f.aware+0.05);return'Begeisterter Artikel! Ruf und Bekanntheit steigen.'}s.rep-=0.03;return'Der Artikel ist lauwarm: „Nett, aber zu bemüht.“'}},
      {n:'Ganz normal bedienen',d:'Was zählt, ist der echte Eindruck.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);if(!s)return'';if(s.rep>0.7){s.rep=Math.min(1,s.rep+0.08);f.aware=Math.min(1,f.aware+0.04);return'„Ehrlich gut!“ Der Artikel macht die Runde.'}s.rep-=0.06;return'Der Artikel ist kritisch, der Ruf leidet.'}}],def:1},
  rent:{branch:'cafe',icon:'🏠',when:(G,f)=>f.shops.length,make:(G,f)=>{const s=pick(G,f.shops);return{ref:s.id,t:'Der Vermieter deiner Filiale ('+shopName(G,s)+') will die Miete um 8 % erhöhen.'}},
    opts:[{n:'Akzeptieren',d:'+8 % Miete.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);if(s){const p=plot(G,s.plot);p.rent=Math.round(p.rent*1.08)}return'Die Miete steigt um 8 %.'}},
      {n:'Hart verhandeln',d:'Klappt es, nur +3 %. Sonst +12 %.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);if(!s)return'';const p=plot(G,s.plot);if(rand(G)<0.5){p.rent=Math.round(p.rent*1.03);return'Verhandlung gewonnen: nur +3 %.'}p.rent=Math.round(p.rent*1.12);return'Der Vermieter bleibt hart: +12 %.'}}],def:0},
  raise:{icon:'💬',when:(G,f)=>staffOf(G,f)>=3,make:(G,f)=>({t:'Das Team von '+f.name+' wünscht sich mehr Gehalt. Die Stimmung ist angespannt.'}),
    opts:[{n:'Gehälter um 5 % erhöhen',d:'Dauerhaft teurer, deutlich bessere Stimmung.',run:(G,f)=>{f.wage=Math.min(1.4,f.wage+0.05);f.moraleBoost=0.1;return'Das Team freut sich.'}},
      {n:'Einmaliger Bonus',d:'500 € pro Kopf.',run:(G,f)=>{const n=staffOf(G,f);pay(G,f.id,'staff',n*500);f.moraleBoost=0.06;return'Bonus ausgezahlt: '+fmtE(n*500)+'.'}},
      {n:'Ablehnen',d:'Spart Geld, kostet Stimmung.',run:(G,f)=>{f.morale=Math.max(0.1,f.morale-0.12);return'Die Stimmung sinkt deutlich.'}}],def:2},
  fest:{branch:'cafe',icon:'🎪',when:(G,f)=>f.shops.length&&summer(G),make:(G,f)=>{const s=pick(G,f.shops);return{ref:s.id,t:'Nächsten Monat ist Stadtfest direkt vor deiner Filiale ('+shopName(G,s)+'). Ein Außenstand kostet 1.500 €.'}},
    opts:[{n:'Stand aufbauen',d:'+35 % Gäste. Plane genug Baristas ein!',run:(G,f,e)=>{pay(G,f.id,'mkt',1500);G.ev.fest=e.ref;return'Der Stand steht.'}},{n:'Nicht mitmachen',d:'',run:()=>'Das Fest zieht vorbei.'}],def:1},
  hack:{branch:'soft',icon:'🛡️',when:(G,f)=>G.apps.some(a=>a.owner===f.id&&a.state==='live'),make:(G,f)=>{const a=pick(G,G.apps.filter(a=>a.owner===f.id&&a.state==='live'));return{ref:a.id,t:'Sicherheitslücke in „'+a.name+'“ entdeckt! Noch weiß niemand davon.'}},
    opts:[{n:'Externe Spezialisten',d:'8.000 €, sofort behoben.',run:(G,f)=>{pay(G,f.id,'other',8000);return'Lücke geschlossen, bevor jemand etwas merkt.'}},
      {n:'Selbst fixen',d:'Kostet Arbeitszeit: +40 Bugs.',run:(G,f,e)=>{const a=G.apps.find(x=>x.id===e.ref);if(a)a.bugs+=40;return'Das Team stopft die Lücke, anderes bleibt liegen.'}},
      {n:'Ignorieren',d:'Riskant.',run:(G,f,e)=>{const a=G.apps.find(x=>x.id===e.ref);if(a&&rand(G)<0.45){a.users*=0.8;a.bugs+=60;return'Die Lücke wird ausgenutzt! 20 % der Nutzer sind weg.'}return'Glück gehabt, niemand hat es bemerkt.'}}],def:2},
  poach:{branch:'soft',icon:'🎯',when:(G,f)=>f.sr>0,make:(G,f)=>({t:'Ein Großkonzern will deinen besten Senior-Entwickler abwerben.'}),
    opts:[{n:'Gegenangebot',d:'Einmalig 6.000 €.',run:(G,f)=>{pay(G,f.id,'staff',6000);return'Er bleibt.'}},{n:'Ziehen lassen',d:'Ein Senior weniger.',run:(G,f)=>{f.sr=Math.max(0,f.sr-1);return'Er geht.'}}],def:1},
  feature:{branch:'soft',icon:'⭐',when:(G,f)=>G.apps.some(a=>a.owner===f.id&&a.state==='live'),make:(G,f)=>{const a=pick(G,G.apps.filter(a=>a.owner===f.id&&a.state==='live'));return{ref:a.id,t:'Der App-Store bietet „'+a.name+'“ nächsten Monat einen Platz auf der Startseite an, gegen 30 % des Umsatzes.'}},
    opts:[{n:'Annehmen',d:'Zweieinhalbmal so viele neue Nutzer.',run:(G,f,e)=>{G.ev.feature=e.ref;G.ev.featureCut=e.ref;return'Deine App steht ganz vorne.'}},{n:'Ablehnen',d:'',run:()=>'Vielleicht beim nächsten Mal.'}],def:1},
  bigorder:{branch:'prod',icon:'📦',when:(G,f)=>f.plants.some(p=>p.lines.length),make:(G,f)=>{const g=pick(G,Object.keys(GOODS).filter(x=>canMake(f,x)));const q=Math.round(LINES[Object.keys(LINES).find(t=>LINES[t].cap[g])].cap[g]*DAYS*0.6/5)*5;return{ref:g,qty:q,t:pick(G,BUYERS[g])+' braucht dringend '+fn(q)+' '+GOODS[g].n+' im nächsten Monat, zu 25 % über Marktpreis.'}},
    opts:[{n:'Zusagen',d:'Bei Verzug 15 % Strafe.',run:(G,f,e)=>{f.contracts.push({id:uid(G),good:e.ref,qty:e.qty,grade:1,price:Math.round(GOODS[e.ref].ref*1.25*100)/100,due:G.month+1,done:0,buyer:'Eilauftrag'});return'Eilauftrag angenommen.'}},{n:'Absagen',d:'',run:()=>'Der Kunde sucht weiter.'}],def:1},
  machine:{branch:'prod',icon:'🔧',when:(G,f)=>f.plants.some(p=>p.lines.length),make:(G,f)=>{const l=pick(G,f.plants.flatMap(p=>p.lines));return{ref:l.id,t:'Die '+LINES[l.type].n+' macht seltsame Geräusche. Ein Lager ist verschlissen.'}},
    opts:[{n:'Sofort reparieren',d:'6.000 €.',run:(G,f)=>{pay(G,f.id,'other',6000);return'Repariert.'}},{n:'Weiterlaufen lassen',d:'Nächsten Monat −40 % Ausstoß.',run:(G,f,e)=>{G.ev.machine=e.ref;return'Die Linie läuft im Notbetrieb.'}}],def:1},
  hedge:{branch:'prod',icon:'🤝',when:(G,f)=>f.plants.some(p=>p.lines.length)&&!(G.hedge&&G.hedge.left>0),make:(G,f)=>{const r=pick(G,[...new Set(f.plants.flatMap(p=>p.lines.flatMap(l=>Object.keys(GOODS[l.product].mat))))]);return{ref:r,t:'Ein Händler bietet '+RAW[r].n+' für sechs Monate zum Festpreis, 8 % unter dem heutigen Preis.'}},
    opts:[{n:'Festpreis sichern',d:'Schützt vor Preissprüngen.',run:(G,f,e)=>{G.hedge={raw:e.ref,idx:G.idx[e.ref]*0.92,left:6};return'Festpreis für 6 Monate gesichert.'}},{n:'Am Markt bleiben',d:'',run:()=>'Du kaufst weiter zum Tagespreis.'}],def:1},
  grant:{icon:'🏛️',when:(G,f)=>totalStaff(G)<60&&f.id===G.firms[0].id,make:()=>({t:'Das Land fördert Digitalisierung mit 10.000 €. Der Antrag kostet 500 € Beratung.'}),
    opts:[{n:'Antrag stellen',d:'70 % Chance.',run:(G,f)=>{pay(G,f.id,'other',500);if(rand(G)<0.7){G.cash+=10000;G.paidIn+=10000;G.led.cf.fin+=10000;return'Bewilligt! 10.000 € Zuschuss.'}return'Leider abgelehnt.'}},{n:'Keine Zeit',d:'',run:()=>'Vielleicht nächstes Jahr.'}],def:1},
  press:{icon:'📰',when:(G,f)=>G.months.length>3,make:(G,f)=>({t:'Ein Wirtschaftsmagazin will ein Porträt über '+f.name+' bringen.'}),
    opts:[{n:'Interview geben',d:'Mehr Bekanntheit.',run:(G,f)=>{f.aware=Math.min(1,f.aware+0.06);return'Schöner Artikel, die Bekanntheit steigt.'}},{n:'Absagen',d:'',run:()=>'Kein Artikel.'}],def:0}};
function shopName(G,s){const p=plot(G,s.plot);return ZONES[p.zone].n+', '+cityName(p.city)}
function rollEvents(G){G.pending=[];if(G.months.length<2)return;const n=rand(G)<0.65?1:rand(G)<0.4?2:0;
  for(let i=0;i<n;i++){const opts=[];for(const k in EVENTS){const E=EVENTS[k];for(const f of G.firms){if(E.branch&&E.branch!==f.branch)continue;if(E.when(G,f))opts.push([k,f])}}
    if(!opts.length)return;const [k,f]=pick(G,opts);if(G.pending.some(e=>e.k===k))continue;G.pending.push(Object.assign({id:uid(G),k,fid:f.id,icon:EVENTS[k].icon},EVENTS[k].make(G,f)))}}
function decide(G,id,opt){const i=G.pending.findIndex(e=>e.id===id);if(i<0)return{ok:false};const e=G.pending[i],E=EVENTS[e.k],f=firm(G,e.fid);G.pending.splice(i,1);
  if(!f)return{ok:true};const o=E.opts[opt]||E.opts[0];const res=o.run(G,f,e)||'';if(res)news(G,res,'info');return{ok:true,msg:res}}
const eventOpts=e=>EVENTS[e.k].opts.map(o=>({n:o.n,d:o.d}));

// ---------- Bilanz und Bewertung ----------
function inventory(G){let v=0;for(const f of G.firms)if(f.branch==='prod')for(const g in f.goods)for(const k in f.goods[g])v+=f.goods[g][k].cost;return v}
function balance(G){const fixed=G.assets.reduce((s,a)=>s+a.book,0),inv=inventory(G),cash=Math.max(0,G.cash),od=Math.max(0,-G.cash),debt=G.loans.reduce((s,l)=>s+l.bal,0);
  const assets=fixed+inv+cash,eq=assets-debt-od,cur=pretax(G.led)-G.led.H.tax;return{fixed,inv,cash,assets,debt,od,eq,paidIn:G.paidIn,retained:G.retained,curNet:cur,diff:eq-(G.paidIn+G.retained+cur)}}
function ebitdaOf(m,fid){const x=m.f[fid];return x?x.rev+x.revInt-x.cogs-x.staff-x.rent-x.mkt-x.rd-x.other:0}
function firmValue(G,f,ms){const months=ms||G.months.slice(-6);const e=months.length?months.reduce((s,m)=>s+ebitdaOf(m,f.id),0)/months.length*12:0;
  const book=G.assets.filter(a=>a.fid===f.id).reduce((s,a)=>s+a.book,0);let extra=0;
  if(f.branch==='soft')extra=G.apps.filter(a=>a.owner===f.id&&a.state==='live').reduce((s,a)=>s+a.users*6,0);if(f.branch==='cafe')extra=f.shops.length*20000*f.rep;
  return Math.max(book*0.6,e*BRANCHES[f.branch].mult+book*0.4)+extra}
function valuation(G,rec){const ms=rec?G.months.slice(-5).concat([rec]):G.months.slice(-6);const firms=G.firms.map(f=>({id:f.id,v:firmValue(G,f,ms)}));
  const debt=G.loans.reduce((s,l)=>s+l.bal,0),hq=G.assets.filter(a=>a.fid==='H').reduce((s,a)=>s+a.book,0);
  const total=Math.max(0,firms.reduce((s,x)=>s+x.v,0)+G.cash+inventory(G)-debt+hq);return{firms,total,mine:total*G.owner}}
function compValue(G,cp){if(cp.branch==='cafe')cp.value=G.plots.filter(p=>p.owner==='c:'+cp.id).length*90000*(0.5+cp.q);else if(cp.branch==='soft')cp.value=200000+G.apps.filter(a=>a.owner==='c:'+cp.id).reduce((s,a)=>s+a.users*6,0);
  else cp.value=G.plots.filter(p=>p.owner==='c:'+cp.id).length*380000;return cp.value}
function takeoverPrice(G,cp){return Math.round(compValue(G,cp)*1.35/1000)*1000}
function pl(m,fid){const z=fz();const ids=fid?[fid]:Object.keys(m.f);for(const id of ids){const x=m.f[id];if(!x)continue;for(const k in z)z[k]+=x[k]||0}
  if(!fid){for(const k in z)z[k]+=m.H[k]||0;z.cogs-=z.revInt;z.revInt=0}
  const ebitda=z.rev+z.revInt-z.cogs-z.staff-z.rent-z.mkt-z.rd-z.other,ebit=ebitda-z.dep;return Object.assign(z,{ebitda,ebit,net:ebit-z.int-z.tax})}
function loanOffer(G){const ms=G.months.slice(-6),e=ms.length?ms.reduce((s,m)=>s+Object.keys(m.f).reduce((a,id)=>a+ebitdaOf(m,id),0),0)/ms.length*12:0;
  const debt=G.loans.reduce((s,l)=>s+l.bal,0),cap=Math.max(60000,e*3.5,balance(G).fixed*0.6)-debt,rate=0.055+clamp(debt/Math.max(1,e),0,6)*0.004;
  return{max:Math.max(0,Math.floor(cap/10000)*10000),rate:Math.round(rate*1000)/1000}}
function takeLoan(G,o){const r=o.rate/12,n=o.months,p=o.amount*r/(1-Math.pow(1+r,-n));G.loans.push({id:uid(G),name:o.name,amount:o.amount,bal:o.amount,rate:o.rate,months:n,pay:p});G.cash+=o.amount;G.led.cf.fin+=o.amount}
function ipoCheck(G){const y=G.months.slice(-12),rev=y.reduce((s,m)=>s+sumF(m,'rev'),0),l3=G.months.slice(-3);
  return[{t:'Eigene Zentrale',ok:!!G.hq},{t:'Mindestens 150 Mitarbeitende',ok:totalStaff(G)>=150},{t:'Umsatz der letzten 12 Monate ab 8 Mio. €',ok:rev>=8e6},{t:'Gewinn in den letzten drei Monaten',ok:l3.length===3&&l3.every(m=>m.net>0)}]}

// ---------- Immobilien ----------
const YIELD={city:0.045,buero:0.05,wohn:0.05,gewerbe:0.065};
const rentOf=p=>p.prop==='H'?0:p.rent; // im eigenen Gebäude fällt keine Miete an
function propValue(G,p){return Math.round(p.rent*12/YIELD[p.zone]*(G.re||1)/1000)*1000}
function propIncome(G,p){if(p.prop!=='H')return 0;if(p.owner&&p.owner.startsWith('c:'))return p.rent;if(!p.owner){return p.rent*(p.leaseR||1)*leaseOcc(p)}return 0}
function leaseOcc(p){return clamp(0.95-0.9*((p.leaseR||1)-1),0,0.98)}
function propertyMonth(G,rep){G.re=clamp((G.re||1)*(1+(rand(G)-0.45)*0.02),0.7,1.6);let inc=0,cost=0;
  for(const p of G.plots)if(p.prop==='H'){const i=propIncome(G,p);inc+=i;cost+=propValue(G,p)*0.0012;p.lastInc=i}
  if(inc)earn(G,'H','rev',inc);if(cost)pay(G,'H','other',cost);
  if(inc||cost)rep.items.push({kind:'re',icon:'🏢',name:'Immobilien',firm:'Holding',rev:inc,profit:inc-cost,kpi:G.plots.filter(p=>p.prop==='H').length+' Gebäude'})}
// ---------- Werbeagentur: Kampagnen je Stadt ----------
const CITY_CAMPS={plakat:{n:'Plakat-Anzeigen',icon:'🪧',cost:8000,boost:0.18,d:'Große Plakate an den Hauptstraßen.'},radio:{n:'Radiowerbung',icon:'📻',cost:12000,boost:0.22,d:'Spots im Morgenradio.'},
  kino:{n:'Kinowerbung',icon:'🎬',cost:5000,boost:0.1,d:'Vor jedem Film im Stadtkino.'},tv:{n:'Regional-TV',icon:'📺',cost:40000,boost:0.4,d:'Werbung im Regionalfernsehen.'}};
function campaignMonth(G){for(const f of G.firms){if(!f.camps)continue;f.cityAw=f.cityAw||{};
  for(const c in f.camps){let b=0,cost=0;for(const k in f.camps[c])if(f.camps[c][k]){b+=CITY_CAMPS[k].boost;cost+=CITY_CAMPS[k].cost}
    const t=clamp(b*(G.depts.mkt?1.35:1)*(G.execs.cmo?1.2:1),0,0.98);f.cityAw[c]=(f.cityAw[c]||0)+(t-(f.cityAw[c]||0))*0.35;if(cost)pay(G,f.id,'mkt',cost)}}}
// ---------- Vorstand ----------
const EXECS={coo:{n:'COO',long:'Chief Operating Officer',icon:'⚙️',salary:18000,d:'+6 % Produktivität in allen Firmen'},cfo:{n:'CFO',long:'Chief Financial Officer',icon:'📈',salary:18000,d:'0,5 % weniger Zinsen, 3 % weniger Steuern'},
  cmo:{n:'CMO',long:'Chief Marketing Officer',icon:'📣',salary:16000,d:'Alle Werbung wirkt 20 % stärker'},cto:{n:'CTO',long:'Chief Technology Officer',icon:'🧠',salary:17000,d:'+12 % Entwicklungsleistung'}};
// ---------- Privat: Gehalt, Aktien, Luxus, Verein ----------
const SECTORS={kaffee:'Kaffee',tech:'Technologie',auto:'Auto',fin:'Finanzen',handel:'Handel',energie:'Energie'};
const STOCKS=[['FBG','Friesenhügel','kaffee',16.9,21e6,0.004,0.06,0.013],['TRC','Trunk Coffee','kaffee',41,8e6,0.006,0.07,0.01],['MTRS','Metrosoft','tech',58,40e6,0.01,0.09,0.006],
  ['PXL','Pixelwerk','tech',22,15e6,0.012,0.13,0],['NAU','Nordauto','auto',74,30e6,0.003,0.07,0.025],['VLT','Voltwagen','auto',31,12e6,0.009,0.12,0],
  ['HBK','Hanse Bank','fin',12,90e6,0.003,0.06,0.04],['ELB','Elbe Versicherung','fin',96,9e6,0.004,0.04,0.03],['KTH','Kaufhaus Thoma','handel',19,20e6,0.001,0.07,0.035],
  ['WND','Windkraft Nord','energie',27,25e6,0.007,0.08,0.02],['GAS','Ostsee Energie','energie',44,18e6,0.002,0.06,0.045]];
const LUX={wein:{n:'Romanée-Conti 1945',sub:'Zwei Flaschen Rotwein',icon:'🍷',p:[40000,180000],vol:0.07,up:0},uhr:{n:'Vintage-Uhr',sub:'Seltener Chronograph',icon:'⌚',p:[60000,250000],vol:0.05,up:0},
  kunst:{n:'Gemälde',sub:'Klassische Moderne',icon:'🖼️',p:[400000,2500000],vol:0.09,up:0.001},auto:{n:'Oldtimer 300 SL',sub:'Flügeltürer, 1955',icon:'🏎️',p:[1200000,1800000],vol:0.05,up:0.001},
  yacht:{n:'Segelyacht',sub:'32 Meter, Liegeplatz Kiel',icon:'⛵',p:[3000000,6000000],vol:0.04,up:0.004},villa:{n:'Villa am Wasser',sub:'Elbchaussee, Hamburg',icon:'🏡',p:[6000000,12000000],vol:0.025,up:0.0015},
  jet:{n:'Privatjet',sub:'Mittelstrecke, 8 Plätze',icon:'🛩️',p:[18000000,30000000],vol:0.03,up:0.006}};
const CLUBS=[{id:'kiel',n:'Holstein SV',city:'kiel',price:12e6,league:'2. Liga'},{id:'hh',n:'Hamburger Kickers',city:'hamburg',price:80e6,league:'1. Liga'},{id:'ber',n:'Berlin SC',city:'berlin',price:300e6,league:'1. Liga'}];
function genMarket(G){G.stocks=STOCKS.map(([tk,n,sec,price,shares,drift,vol,div])=>({tk,n,sec,price,shares,drift,vol,div,hist:[price]}));for(let i=0;i<23;i++)stepStocks(G,true)}
function gauss(G){return Math.sqrt(-2*Math.log(rand(G)+1e-9))*Math.cos(6.2832*rand(G))}
function stepStocks(G,warm){const shock={};for(const k in SECTORS)shock[k]=gauss(G)*0.03;const mkt=gauss(G)*0.025;
  for(const s of G.stocks){s.price=Math.max(0.5,s.price*Math.exp(s.drift+mkt+shock[s.sec]+gauss(G)*s.vol));s.hist.push(s.price);if(s.hist.length>24)s.hist.shift()}}
function marketsMonth(G,rep){stepStocks(G);const me=G.me;let div=0;
  if(G.month%3===2)for(const tk in me.stocks){const s=G.stocks.find(x=>x.tk===tk);if(s)div+=me.stocks[tk].n*s.price*s.div/4}
  if(div){me.cash+=div*0.75;rep.events.push({icon:'💶',t:'Dividenden auf dein Depot: +'+fmtE(div*0.75)+' (nach Steuer).'})}
  for(const l of me.lux){l.value=Math.max(1000,l.value*Math.exp(0.002+gauss(G)*LUX[l.k].vol));const up=l.value*LUX[l.k].up;me.cash-=up}}
function privateMonth(G,rep){const sal=G.me.salary/12;if(sal>0){pay(G,'H','staff',sal);G.me.cash+=sal*0.58}}
function clubMonth(G,rep){const c=G.me.club;if(!c)return;const C=CLUBS.find(x=>x.id===c.id);
  const inc=c.value*0.003*(1.2-c.lastRank/22)+(c.league==='1. Liga'?250000:40000);G.me.cash+=inc-c.budget;c.str+=(c.budget/(c.budget+c.value*0.006)-c.str)*0.15;
  if(G.month%12===4){const rank=clamp(Math.round(18-c.str*17+gauss(G)*2.2),1,18);c.hist.unshift({y:yearOf(G.month),rank});c.lastRank=rank;
    let t=C.n+' beendet die Saison auf Platz '+rank+'.';if(rank===1){c.value*=1.35;t+=' Meisterschaft! 🏆';G.ms.title=G.month}else if(rank<=4)c.value*=1.12;else if(rank>=16){c.value*=0.85;t+=' Abstiegszone …'}else c.value*=1.0+(10-rank)*0.008;
    rep.events.push({icon:'⚽',t})}}
function wealth(G){const me=G.me;const own=valuation(G).mine;let st=0,stCost=0;for(const tk in me.stocks){const s=G.stocks.find(x=>x.tk===tk);if(s){st+=me.stocks[tk].n*s.price;stCost+=me.stocks[tk].cost}}
  const lux=me.lux.filter(l=>l.k!=='villa').reduce((s,l)=>s+l.value,0),re=me.lux.filter(l=>l.k==='villa').reduce((s,l)=>s+l.value,0),club=me.club?me.club.value:0;
  return{cash:me.cash,own,stocks:st,stCost,lux,re,club,total:me.cash+own+st+lux+re+club}}

// ---------- Aktionen ----------
const A={};
const can=(G,amt)=>G.cash-amt>=-dispo(G)*0.5;
const noMoney=amt=>({ok:false,msg:'Dafür fehlt das Geld ('+fmtE(amt)+').'});
function shopOf(G,sid){for(const f of G.firms)if(f.shops){const s=f.shops.find(x=>x.id===sid);if(s)return[f,s]}return[null,null]}
function lineOf(G,lid){for(const f of G.firms)if(f.plants)for(const p of f.plants){const l=p.lines.find(x=>x.id===lid);if(l)return[f,p,l]}return[null,null,null]}
function newShop(G,pid,o){return Object.assign({id:uid(G),plot:pid,level:1,staff:2,manager:false,hours:'normal',ups:{},act:{},special:null,rep:0.55,la:0.15,train:0,stat:null,reviews:[],opened:G.month},o||{})}
A.openShop=(G,fid,pid)=>{const f=firm(G,fid),p=plot(G,pid);if(!f||f.branch!=='cafe')return{ok:false,msg:'Nur für Cafés.'};if(!p||p.owner)return{ok:false,msg:'Das Grundstück ist nicht frei.'};
  if(!G.cities[p.city])return{ok:false,msg:'Diese Stadt ist noch nicht erschlossen.'};if(!ZONES[p.zone].uses.includes('cafe'))return{ok:false,msg:'Hier ist keine Gastronomie erlaubt.'};
  const cost=shopCost(p);if(!can(G,cost))return noMoney(cost);
  pay(G,f.id,'other',cost-LEVELS[1].cost);buyAsset(G,f.id,'Einrichtung',LEVELS[1].cost,60,'shop:'+p.id);p.owner=f.id;p.use='cafe';
  const s=newShop(G,p.id);f.shops.push(s);news(G,f.name+' eröffnet eine Filiale ('+ZONES[p.zone].n+', '+cityName(p.city)+').','good');return{ok:true,msg:'Filiale eröffnet!',id:s.id}};
const shopCost=p=>LEVELS[1].cost+p.rent*2+1600;
A.shop=(G,sid,ch)=>{const [f,s]=shopOf(G,sid);if(!s)return{ok:false};const p=plot(G,s.plot);
  if(ch.staff!==undefined){const n=clamp(ch.staff,1,Math.max(2,Math.floor(p.size/12)));if(n>s.staff){const c=800*(n-s.staff);if(!can(G,c))return noMoney(c);pay(G,f.id,'other',c)}s.staff=n}
  if(ch.manager!==undefined)s.manager=!!ch.manager;if(ch.hours)s.hours=ch.hours;if(ch.special!==undefined)s.special=ch.special||null;
  if(ch.act)s.act[ch.act]=!s.act[ch.act];
  if(ch.train){if(s.train>=3)return{ok:false,msg:'Das Team ist bestens geschult.'};if(!can(G,1500))return noMoney(1500);pay(G,f.id,'other',1500);s.train++;return{ok:true,msg:'Schulung gebucht: Service +5 %.'}}
  if(ch.up){const U=CAFE_UPS[ch.up];if(!U||s.ups[ch.up])return{ok:false};if(U.zones&&!U.zones.includes(p.zone))return{ok:false,msg:'An diesem Standort nicht möglich.'};
    if(U.minLevel&&s.level<U.minLevel)return{ok:false,msg:'Erst ab Einrichtung „'+LEVELS[U.minLevel].n+'“.'};if(!can(G,U.cost))return noMoney(U.cost);buyAsset(G,f.id,U.n,U.cost,60,'shop:'+p.id);s.ups[ch.up]=true;return{ok:true,msg:U.n+' eingebaut!'}}
  if(ch.level){if(s.level>=3)return{ok:false};const c=LEVELS[s.level+1].cost;if(!can(G,c))return noMoney(c);buyAsset(G,f.id,'Umbau '+LEVELS[s.level+1].n,c,60,'shop:'+p.id);s.level++;return{ok:true,msg:'Umgebaut: '+LEVELS[s.level].n+'!'}}
  return{ok:true}};
A.closeShop=(G,sid)=>{const [f,s]=shopOf(G,sid);if(!s)return{ok:false};const p=plot(G,s.plot);dropAssets(G,'shop:'+p.id);pay(G,f.id,'other',s.staff*WAGE.barista);p.owner=null;p.use=null;f.shops=f.shops.filter(x=>x!==s);return{ok:true,msg:'Filiale geschlossen.'}};
A.menu=(G,fid,k,ch)=>{const f=firm(G,fid),m=f.menu[k];if(!m)return{ok:false};if(PRODUCTS[k].res&&!has(f,PRODUCTS[k].res))return{ok:false,msg:'Erst entwickeln.'};Object.assign(m,ch);m.price=Math.round(clamp(m.price,0.5,30)*10)/10;return{ok:true}};
A.firm=(G,fid,ch)=>{const f=firm(G,fid);if(ch.mkt!==undefined)f.mkt=Math.max(0,Math.round(ch.mkt));if(ch.wage!==undefined)f.wage=clamp(ch.wage,0.85,1.4);if(ch.supplier)f.supplier=ch.supplier;if(ch.autoSell!==undefined)f.autoSell=!!ch.autoSell;
  if(ch.brandMkt!==undefined&&f.brand)f.brand.mkt=Math.max(0,ch.brandMkt);return{ok:true}};
A.research=(G,fid,k)=>{const f=firm(G,fid),R=RESEARCH[f.branch][k];if(!R||f.res[k])return{ok:false};if(f.resCur)return{ok:false,msg:'Es läuft schon eine Entwicklung.'};if(!can(G,R.cost))return noMoney(R.cost);
  pay(G,f.id,'rd',R.cost);f.resCur={k,left:R.months,months:R.months};return{ok:true,msg:'Entwicklung gestartet: '+R.n}};
A.hire=(G,fid,role,d)=>{const f=firm(G,fid);const n=f[role]+d;if(n<0)return{ok:false};
  if(d>0&&f.jr+f.sr+f.des+f.qa+d+1>desks(G,f)*1.25)return{ok:false,msg:'Kein Platz mehr. Miete ein größeres Büro.'};
  const fee=(f.oups.gaming?800:1200)*d;if(d>0){if(!can(G,fee))return noMoney(fee);pay(G,f.id,'other',fee)}else pay(G,f.id,'other',WAGE[role]*-d);f[role]=n;return{ok:true}};
A.rentOffice=(G,fid,pid)=>{const f=firm(G,fid),p=plot(G,pid);if(!f||f.branch!=='soft')return{ok:false,msg:'Nur für Software-Firmen.'};if(!p||p.owner)return{ok:false,msg:'Das Grundstück ist nicht frei.'};
  if(!G.cities[p.city])return{ok:false,msg:'Diese Stadt ist noch nicht erschlossen.'};if(!ZONES[p.zone].uses.includes('office'))return{ok:false,msg:'Hier sind keine Büros möglich.'};
  const cost=officeCost(p);if(!can(G,cost))return noMoney(cost);
  if(f.office){const o=plot(G,f.office);dropAssets(G,'office:'+o.id);o.owner=null;o.use=null;f.oups={}}
  pay(G,f.id,'other',p.rent*2);buyAsset(G,f.id,'Büroausstattung',p.size*40,60,'office:'+p.id);p.owner=f.id;p.use='office';f.office=p.id;
  news(G,f.name+' bezieht ein Büro mit '+Math.floor(p.size/10)+' Arbeitsplätzen.','good');return{ok:true,msg:'Büro bezogen!'}};
const officeCost=p=>p.size*40+p.rent*2;
A.officeUp=(G,fid,k)=>{const f=firm(G,fid),U=OFFICE_UPS[k];if(!f.office)return{ok:false,msg:'Erst ein Büro mieten.'};if(f.oups[k])return{ok:false};if(!can(G,U.cost))return noMoney(U.cost);
  buyAsset(G,f.id,U.n,U.cost,60,'office:'+f.office);f.oups[k]=true;return{ok:true,msg:U.n+' eingerichtet!'}};
A.newApp=(G,fid,genre,scope)=>{const f=firm(G,fid),g=GENRES[genre];if(!g)return{ok:false};if(g.res&&!has(f,g.res))return{ok:false,msg:'Genre erst entwickeln.'};
  const used=new Set(G.apps.map(a=>a.name)),name=APP_NAMES.find(n=>!used.has(n))||('App '+uid(G));
  const a={id:uid(G),owner:f.id,name,genre,scope,state:'dev',progress:0,work:SCOPES[scope].work,quality:0,bugs:0,users:0,payers:0,share:2,model:'freemium',price:4.99,focus:'features',camp:{},ads:0,fresh:1,released:0};
  G.apps.push(a);return{ok:true,msg:'Projekt „'+name+'“ gestartet!',id:a.id}};
A.app=(G,aid,ch)=>{const a=G.apps.find(x=>x.id===aid);if(!a)return{ok:false};const f=firm(G,a.owner);
  if(ch.release){if(a.state!=='dev'||a.progress<a.work*0.6)return{ok:false,msg:'Erst ab 60 % Fortschritt.'};release(G,f,a);return{ok:true,msg:'„'+a.name+'“ ist live!'}}
  if(ch.off){a.state='off';a.users=0;return{ok:true}}
  if(ch.share!==undefined)a.share=clamp(ch.share,0,4);if(ch.model)a.model=ch.model;if(ch.price!==undefined)a.price=Math.round(clamp(ch.price,0.99,29.99)*100)/100;if(ch.focus)a.focus=ch.focus;
  if(ch.ads!==undefined)a.ads=clamp(Math.round(ch.ads/500)*500,0,100000);if(ch.camp)a.camp[ch.camp]=!a.camp[ch.camp];return{ok:true}};
A.rentPlant=(G,fid,pid)=>{const f=firm(G,fid),p=plot(G,pid);if(!f||f.branch!=='prod')return{ok:false,msg:'Nur für Produktionsfirmen.'};if(!p||p.owner)return{ok:false,msg:'Das Grundstück ist nicht frei.'};
  if(!G.cities[p.city])return{ok:false,msg:'Diese Stadt ist noch nicht erschlossen.'};if(!ZONES[p.zone].uses.includes('factory'))return{ok:false,msg:'Fabriken nur im Gewerbegebiet.'};
  const cost=p.rent*3;if(!can(G,cost))return noMoney(cost);pay(G,f.id,'other',cost);p.owner=f.id;p.use='factory';const pl={id:uid(G),plot:p.id,lines:[],ups:{}};f.plants.push(pl);
  news(G,f.name+' mietet eine Halle in '+cityName(p.city)+'.','good');return{ok:true,msg:'Halle gemietet! Jetzt eine Linie kaufen.',id:pl.id}};
A.buyLine=(G,fid,plantId,type)=>{const f=firm(G,fid),pl=f&&f.plants.find(x=>x.id===plantId),T=LINES[type];if(!pl||!T)return{ok:false};if(T.res&&!has(f,T.res))return{ok:false,msg:'Erst entwickeln.'};
  if(pl.lines.length>=Math.floor(plot(G,pl.plot).size/500))return{ok:false,msg:'Die Halle ist voll.'};const c=T.cost+800*T.workers;if(!can(G,c))return noMoney(c);
  const id=uid(G);buyAsset(G,f.id,T.n,T.cost,96,'line:'+id);pay(G,f.id,'other',800*T.workers);pl.lines.push({id,type,product:Object.keys(T.cap)[0],workers:T.workers,grade:2,shifts:1,auto:false,qc:false,maint:false,made:0});
  return{ok:true,msg:T.n+' läuft!'}};
A.line=(G,lid,ch)=>{const [f,p,l]=lineOf(G,lid);if(!l)return{ok:false};
  if(ch.workers!==undefined){const n=clamp(ch.workers,0,lineNeed(l));if(n>l.workers){const c=800*(n-l.workers)*l.shifts;if(!can(G,c))return noMoney(c);pay(G,f.id,'other',c)}l.workers=n}
  if(ch.shifts){const s=clamp(ch.shifts,1,3);if(s>l.shifts){const c=800*l.workers*(s-l.shifts);if(!can(G,c))return noMoney(c);pay(G,f.id,'other',c)}l.shifts=s}
  if(ch.grade)l.grade=clamp(ch.grade,1,3);if(ch.product&&LINES[l.type].cap[ch.product]&&(!GOODS[ch.product].res||has(f,GOODS[ch.product].res)))l.product=ch.product;
  if(ch.qc!==undefined)l.qc=!!ch.qc;if(ch.maint!==undefined)l.maint=!!ch.maint;
  if(ch.auto){if(!has(f,'auto'))return{ok:false,msg:'Erst „Automatisierung“ entwickeln.'};if(l.auto)return{ok:false};if(!can(G,40000))return noMoney(40000);buyAsset(G,f.id,'Automatisierung',40000,96,'line:'+l.id);l.auto=true;l.workers=Math.min(l.workers,lineNeed(l));return{ok:true,msg:'Linie automatisiert!'}}
  return{ok:true}};
A.sellLine=(G,lid)=>{const [f,p,l]=lineOf(G,lid);if(!l)return{ok:false};const book=G.assets.filter(x=>x.ref==='line:'+lid).reduce((s,a)=>s+a.book,0),pr=book*0.5;
  dropAssets(G,'line:'+lid);earn(G,f.id,null,pr,'inv');L(G,f.id).dep-=pr;p.lines=p.lines.filter(x=>x!==l);return{ok:true,msg:'Linie verkauft für '+fmtE(pr)}};
A.plantUp=(G,plantId,k)=>{for(const f of G.firms)if(f.plants){const p=f.plants.find(x=>x.id===plantId);if(p){const U=PLANT_UPS[k];if(p.ups[k])return{ok:false};if(!can(G,U.cost))return noMoney(U.cost);buyAsset(G,f.id,U.n,U.cost,96,'plant:'+p.id);p.ups[k]=true;return{ok:true,msg:U.n+' gebaut!'}}}return{ok:false}};
A.brand=(G,fid)=>{const f=firm(G,fid);if(f.brand)return{ok:false};if(!can(G,30000))return noMoney(30000);pay(G,f.id,'mkt',30000);f.brand={aware:0.05,mkt:3000};news(G,f.name+' bringt eine eigene Marke in die Supermärkte.','good');return{ok:true,msg:'Eigene Marke gestartet!'}};
A.accept=(G,cid)=>{const i=G.offers.contracts.findIndex(c=>c.id===cid);if(i<0)return{ok:false};const c=G.offers.contracts[i],f=firm(G,c.fid);
  f.contracts.push({id:c.id,good:c.good,qty:c.qty,grade:c.grade,price:c.price,due:G.month+c.months,done:0,buyer:c.buyer});G.offers.contracts.splice(i,1);return{ok:true,msg:'Auftrag angenommen!'}};
A.wholesale=(G,fid,g)=>{const f=firm(G,fid),q=goodsTotal(f,g)-reserved(f,g);if(q<1)return{ok:false,msg:'Alles ist für Aufträge reserviert.'};return sellWholesale(G,f,g,q)};
A.found=(G,branch,name)=>{const c=25000;if(!can(G,c))return noMoney(c);pay(G,'H','other',c);const f=foundFirm(G,branch,name);genContracts(G);news(G,'Neue Firma gegründet: '+f.name+'.','good');return{ok:true,msg:f.name+' gegründet!',id:f.id}};
A.unlockCity=(G,cid)=>{const c=CITIES.find(x=>x.id===cid);if(!c||G.cities[cid])return{ok:false};if(totalStaff(G)<c.unlock.staff)return{ok:false,msg:'Erst ab '+c.unlock.staff+' Mitarbeitenden.'};
  if(!can(G,c.unlock.cost))return noMoney(c.unlock.cost);pay(G,'H','other',c.unlock.cost);G.cities[cid]=true;news(G,'Markteintritt in '+c.n+'.','good');return{ok:true,msg:'Willkommen in '+c.n+'!'}};
A.buildHQ=(G,pid)=>{const p=plot(G,pid);if(G.hq)return{ok:false,msg:'Es gibt schon eine Zentrale.'};if(totalStaff(G)<25)return{ok:false,msg:'Eine Zentrale lohnt sich erst ab 25 Mitarbeitenden.'};
  if(!p||p.owner||!ZONES[p.zone].uses.includes('hq'))return{ok:false,msg:'Wähle ein freies Grundstück in Innenstadt oder Büroviertel.'};if(!G.cities[p.city])return{ok:false,msg:'Diese Stadt ist noch nicht erschlossen.'};
  if(!can(G,250000))return noMoney(250000);buyAsset(G,'H','Zentrale',250000,240,'hq');p.owner='H';p.use='hq';G.hq=p.id;news(G,'Die Konzernzentrale steht!','good');return{ok:true,msg:'Zentrale gebaut!'}};
A.dept=(G,k,on)=>{if(!G.hq)return{ok:false,msg:'Erst eine Zentrale bauen.'};if(on&&!G.depts[k]){if(!can(G,5000))return noMoney(5000);pay(G,'H','other',5000)}G.depts[k]=!!on;return{ok:true}};
A.loan=(G,amount)=>{const o=loanOffer(G);if(amount>o.max)return{ok:false,msg:'Die Bank gibt höchstens '+fmtE(o.max)+'.'};takeLoan(G,{amount,rate:o.rate,months:60,name:'Bankkredit'});return{ok:true,msg:fmtE(amount)+' Kredit aufgenommen.'}};
A.repay=(G,lid)=>{const l=G.loans.find(x=>x.id===lid);if(!l)return{ok:false};if(G.cash<l.bal)return{ok:false,msg:'Zu wenig Geld für die Sondertilgung.'};G.cash-=l.bal;G.led.cf.fin-=l.bal;l.bal=0;G.loans=G.loans.filter(x=>x.bal>0);return{ok:true,msg:'Kredit getilgt.'}};
A.investor=(G,yes)=>{const o=G.offers.investor;if(!o)return{ok:false};G.offers.investor=null;if(!yes)return{ok:true,msg:'Angebot abgelehnt.'};
  equity(G,o.amount);G.owner*=1-o.share;G.rounds++;G.lastRoundV=valuation(G).total;G.lastRoundM=G.month;news(G,o.name+' investiert '+fmtE(o.amount)+'.','fin');return{ok:true,msg:'Finanzierungsrunde: +'+fmtE(o.amount)}};
A.ipo=G=>{if(G.public||!ipoCheck(G).every(x=>x.ok))return{ok:false,msg:'Voraussetzungen noch nicht erfüllt.'};const v=valuation(G).total,amt=v*0.25/0.75*0.95;equity(G,amt);G.owner*=0.75;G.public=true;
  G.sharePrice=v/0.75/G.shares;G.priceHist=[G.sharePrice];news(G,'Börsengang! Erlös '+fmtE(amt)+'.','ms');return{ok:true,msg:'Willkommen an der Börse!'}};
A.takeover=(G,cid)=>{const cp=G.comps.find(c=>c.id===cid);if(!cp)return{ok:false};const price=takeoverPrice(G,cp);
  if(cp.branch!=='soft'&&cp.city&&!G.cities[cp.city])return{ok:false,msg:'Erst in '+cityName(cp.city)+' aktiv werden.'};if(G.cash<price)return{ok:false,msg:'Die Übernahme kostet '+fmtE(price)+'.'};
  let f=G.firms.find(x=>x.branch===cp.branch);if(!f)f=foundFirm(G,cp.branch,cp.name);
  G.cash-=price;G.led.cf.inv-=price;const owned=G.plots.filter(p=>p.owner==='c:'+cp.id);let gw=price;
  const std=cp.branch==='cafe'?20000:cp.branch==='prod'?LINES.moebel.cost*0.7:0,sc=owned.length&&std?Math.min(1,price*0.6/(owned.length*std)):1;
  const addA=(name,v,life,ref)=>{G.assets.push({id:uid(G),fid:f.id,name,cost:v,life,book:v,ref});gw-=v};
  if(cp.branch==='cafe')for(const p of owned){p.owner=f.id;f.shops.push(newShop(G,p.id,{level:2,staff:3,rep:cp.rep,la:0.3}));addA('Einrichtung (übernommen)',std*sc,60,'shop:'+p.id)}
  if(cp.branch==='prod')for(const p of owned){p.owner=f.id;const id=uid(G),type=rand(G)<0.5?'moebel':'roest';f.plants.push({id:uid(G),plot:p.id,ups:{},lines:[{id,type,product:Object.keys(LINES[type].cap)[0],workers:LINES[type].workers,grade:2,shifts:1,auto:false,qc:false,maint:false,made:0}]});addA(LINES[type].n+' (übernommen)',std*sc,96,'line:'+id)}
  if(cp.branch==='soft'){for(const a of G.apps)if(a.owner==='c:'+cp.id)Object.assign(a,{owner:f.id,share:1,focus:'bugs',camp:{},ads:0});f.jr+=3;f.sr+=1}
  if(gw>0)G.assets.push({id:uid(G),fid:f.id,name:'Firmenwert '+cp.name,cost:gw,life:120,book:gw,ref:'gw:'+cp.id});
  G.comps=G.comps.filter(c=>c!==cp);G.ms.takeover=G.month;news(G,'Übernahme: '+cp.name+' gehört jetzt zu dir.','ms');return{ok:true,msg:cp.name+' übernommen!'}};
A.founderDev=(G,on)=>{G.founderDev=!!on;return{ok:true}};
A.buyProp=(G,pid)=>{const p=plot(G,pid);if(!p||p.prop)return{ok:false};if(p.owner==='H')return{ok:false};if(!G.cities[p.city])return{ok:false,msg:'Diese Stadt ist noch nicht erschlossen.'};
  const v=propValue(G,p),c=v*1.05;if(!can(G,c))return noMoney(c);pay(G,'H','other',v*0.05);buyAsset(G,'H','Immobilie '+ZONES[p.zone].n+' '+cityName(p.city),v,1e9,'prop:'+p.id);p.prop='H';p.leaseR=1;
  news(G,'Immobilie gekauft: '+ZONES[p.zone].n+', '+cityName(p.city)+'.','good');return{ok:true,msg:'Gebäude gekauft!'}};
A.sellProp=(G,pid)=>{const p=plot(G,pid);if(!p||p.prop!=='H')return{ok:false};if(p.owner==='H')return{ok:false,msg:'Die Zentrale steht hier.'};const v=propValue(G,p)*0.97;
  const a=G.assets.filter(x=>x.ref==='prop:'+p.id),book=a.reduce((s,x)=>s+x.book,0);G.assets=G.assets.filter(x=>x.ref!=='prop:'+p.id);earn(G,'H',null,v,'inv');L(G,'H').other+=book-v;p.prop=null;
  return{ok:true,msg:'Verkauft für '+fmtE(v)+(v>book?' (Gewinn '+fmtE(v-book)+')':' (Verlust '+fmtE(book-v)+')')}};
A.leaseR=(G,pid,r)=>{const p=plot(G,pid);if(!p||p.prop!=='H')return{ok:false};p.leaseR=clamp(Math.round(r*20)/20,0.5,1.6);return{ok:true}};
A.cityCamp=(G,fid,city,k)=>{const f=firm(G,fid);f.camps=f.camps||{};f.camps[city]=f.camps[city]||{};f.camps[city][k]=!f.camps[city][k];return{ok:true}};
A.exec=(G,k)=>{if(!G.hq)return{ok:false,msg:'Der Vorstand braucht eine Zentrale.'};G.execs[k]=!G.execs[k];if(G.execs[k]){pay(G,'H','other',10000);return{ok:true,msg:EXECS[k].long+' eingestellt (Headhunter 10.000 €).'}}return{ok:true,msg:EXECS[k].n+' verlässt das Unternehmen.'}};
A.salary=(G,v)=>{G.me.salary=clamp(Math.round(v/10000)*10000,0,5e6);return{ok:true}};
A.dividend=(G,amt)=>{amt=Math.min(amt,G.cash);if(amt<=0)return{ok:false,msg:'Kein Geld für eine Dividende.'};if(G.cash-amt<0)return{ok:false};G.cash-=amt;G.led.cf.fin-=amt;G.retained-=amt;
  const mine=amt*G.owner*0.75;G.me.cash+=mine;news(G,'Dividende ausgeschüttet: '+fmtE(amt)+', davon '+fmtE(mine)+' netto an dich.','fin');return{ok:true,msg:'Ausgeschüttet. Netto an dich: '+fmtE(mine)}};
A.trade=(G,tk,n)=>{const me=G.me;if(tk==='OWN'){if(!G.public)return{ok:false};const price=G.sharePrice;const share=n/G.shares;
    if(n>0){const c=n*price*1.002;if(me.cash<c)return{ok:false,msg:'Privat fehlen dir '+fmtE(c-me.cash)+'.'};if(G.owner+share>0.95)return{ok:false,msg:'So viele Aktien sind nicht im Umlauf.'};me.cash-=c;G.owner+=share;return{ok:true,msg:fn(n)+' eigene Aktien gekauft.'}}
    if(G.owner+share<0.01)return{ok:false,msg:'So viele Aktien hast du nicht.'};me.cash+=-n*price*0.998;G.owner+=share;return{ok:true,msg:fn(-n)+' eigene Aktien verkauft.'}}
  const s=G.stocks.find(x=>x.tk===tk);if(!s)return{ok:false};const pos=me.stocks[tk]||(me.stocks[tk]={n:0,cost:0});
  if(n>0){const c=n*s.price*1.002;if(me.cash<c)return{ok:false,msg:'Privat fehlen dir '+fmtE(c-me.cash)+'.'};me.cash-=c;pos.n+=n;pos.cost+=c;return{ok:true,msg:fn(n)+' '+s.n+' gekauft.'}}
  const k=Math.min(pos.n,-n);if(k<=0)return{ok:false};const uc=pos.cost/pos.n;me.cash+=k*s.price*0.998;pos.n-=k;pos.cost-=uc*k;if(pos.n<=0)delete me.stocks[tk];return{ok:true,msg:fn(k)+' '+s.n+' verkauft.'}};
A.buyLux=(G,k)=>{const L0=LUX[k];const price=Math.round(rr(G,L0.p[0],L0.p[1])/100)*100;if(G.me.cash<price)return{ok:false,msg:'Privat fehlen dir '+fmtE(price-G.me.cash)+'.'};
  G.me.cash-=price;G.me.lux.push({id:uid(G),k,cost:price,value:price*rr(G,0.75,1.25),known:false});return{ok:true,msg:L0.n+' gekauft für '+fmtE(price)+'.'}};
A.appraise=(G,id)=>{const l=G.me.lux.find(x=>x.id===id);if(!l||l.known)return{ok:false};const fee=Math.max(500,l.cost*0.01);if(G.me.cash<fee)return{ok:false,msg:'Das Gutachten kostet '+fmtE(fee)+'.'};G.me.cash-=fee;l.known=true;return{ok:true,msg:'Gutachten: fairer Marktwert '+fmtE(l.value)+'.'}};
A.sellLux=(G,id)=>{const i=G.me.lux.findIndex(x=>x.id===id);if(i<0)return{ok:false};const l=G.me.lux[i],v=l.value*0.92;G.me.cash+=v;G.me.lux.splice(i,1);return{ok:true,msg:'Verkauft für '+fmtE(v)+' (nach Auktionsgebühr).'}};
A.buyClub=(G,id)=>{const C=CLUBS.find(x=>x.id===id);if(G.me.club)return{ok:false,msg:'Du besitzt schon einen Verein.'};if(G.me.cash<C.price)return{ok:false,msg:'Privat fehlen dir '+fmtE(C.price-G.me.cash)+'.'};
  G.me.cash-=C.price;G.me.club={id,value:C.price,str:0.45,budget:C.price*0.004,league:C.league,lastRank:10,hist:[]};news(G,'Du kaufst '+C.n+'!','ms');return{ok:true,msg:C.n+' gehört jetzt dir!'}};
A.clubBudget=(G,v)=>{if(!G.me.club)return{ok:false};G.me.club.budget=Math.max(0,Math.round(v/10000)*10000);return{ok:true}};
A.sellClub=G=>{const c=G.me.club;if(!c)return{ok:false};G.me.cash+=c.value*0.95;G.me.club=null;return{ok:true,msg:'Verein verkauft.'}};
A.secondary=(G,pct)=>{if(!G.public)return{ok:false,msg:'Erst nach dem Börsengang.'};pct=clamp(pct,0.01,0.3);const n=Math.round(G.shares*pct),gross=n*G.sharePrice,fee=gross*0.068,net=gross-fee;
  equity(G,net);G.owner*=G.shares/(G.shares+n);G.shares+=n;G.sharePrice*=0.97;news(G,'Kapitalerhöhung: '+fn(n)+' neue Aktien, Erlös '+fmtE(net)+'.','fin');return{ok:true,msg:'Kapitalerhöhung: +'+fmtE(net)}};
A.decide=(G,id,opt)=>decide(G,id,opt);

// Vorschau beim Bauen einer Filiale
function forecastShop(G,fid,pid){const f=firm(G,fid),p=plot(G,pid);if(!f||f.branch!=='cafe')return null;
  const s=newShop({nextId:0},pid,{id:-1,staff:3});const fc=shopForecast(G,f,s);
  const guests=fc.dem;let perGuest=0,costPer=0;for(const it of fc.ms.items){const P=PRODUCTS[it.k];perGuest+=1.5*it.share*it.price;costPer+=1.5*it.share*(P.other+(P.beans?P.beans*GOODS.bohnen.ref*G.idx.rohkaffee:0)+(P.piece?P.mkt:0))*QMULT[it.q]}
  const staff=Math.max(2,Math.ceil(guests/(85*DAYS*productivity(f))));const rev=guests*perGuest,cost=guests*costPer+staff*wageOf(G,'barista',f)+rentOf(p)+450;
  return{guests:Math.round(guests),rev,profit:rev-cost,staff,cost:shopCost(p)}}

// ---------- Hilfen ----------
function cityName(id){return(CITIES.find(c=>c.id===id)||{}).n}
function yearOf(m){return 2027+Math.floor(m/12)}
function monthName(m){return MONTHS[m%12]+' '+yearOf(m)}
function fn(v){return Math.round(v).toLocaleString('de-DE')}
function fmtE(v,d){if(Math.abs(v)<0.5)v=0;const a=Math.abs(v);if(d)return v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d})+' €';
  if(a>=1e6)return(v/1e6).toLocaleString('de-DE',{maximumFractionDigits:a>=1e8?0:1})+' Mio. €';return Math.round(v).toLocaleString('de-DE')+' €'}
function curLedger(G){return{m:G.month,f:G.led.f,H:G.led.H,cf:G.led.cf}}

const K={MONTHS,BRANCHES,WAGE,PRODUCTS,QMULT,QUAL,QN,LEVELS,CAFE_UPS,CAFE_ACTIONS,HOURS,GENRES,SCOPES,FOCUS,MODELS,CAMPAIGNS,OFFICE_UPS,RAW,GOODS,LINES,SHIFTS,GMULT,GQUAL,SUPPLIERS,PLANT_UPS,RESEARCH,CITIES,ZONES,COLS,ROWS,STAGES,DEPTS,GOALS,
  newGame,endTurn,act:A,plot,firm,staffOf,adminOf,totalStaff,hqStaff,stage,menuStats,shopForecast,forecastShop,shopCost,officeCost,softTeam,desks,rating,goodsTotal,lineOut,lineNeed,rawPrice,wholesalePrice,storageCap,reserved,effGrade,
  balance,valuation,firmValue,compValue,takeoverPrice,loanOffer,ipoCheck,pl,curLedger,dateStr:G=>monthName(G.month),monthName,yearOf,cityName,dispo,fmtE,fmtN:fn,freePlots,stars,eventOpts,productivity,summer,shopOf,lineOf,sumF,wageOf,propValue,propIncome,leaseOcc,rentOf,CITY_CAMPS,EXECS,SECTORS,LUX,CLUBS,wealth,genMarket,YIELD};
if(typeof module!=='undefined'&&module.exports)module.exports=K;else root.K=K;
})(typeof window!=='undefined'?window:globalThis);
