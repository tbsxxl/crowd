// Gründerzeit: rundenbasiertes Wirtschaftsmodell ohne DOM. Eine Runde ist ein Monat.
// Der Spielstand G ist reines JSON. Aktionen geben {ok,msg} zurück, endTurn(G) rechnet den Monat ab und liefert den Monatsbericht.
(function(root){
'use strict';
const TAX=0.30,EMP=1.21,DAYS=7.5; // Tage je Runde (eine Woche, vier Wochen je Monat)
const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

// ---------- Kataloge ----------
const BRANCHES={
  cafe:{n:'Restaurant',long:'Gastronomie',icon:'🍽️',desc:'Lagen wählen, Restaurants einrichten, Speisekarte und Preise festlegen, Stammgäste gewinnen.',color:'#c8643c',mult:7},
  soft:{n:'Software',long:'Software & Apps',icon:'💻',desc:'Team aufbauen, Apps entwickeln und veröffentlichen, Nutzer gewinnen, Abos verkaufen.',color:'#2f6fd0',mult:10},
  prod:{n:'Produktion',long:'Produktion',icon:'🏭',desc:'Hallen und Linien kaufen, Schichten planen, Aufträge liefern, eine eigene Marke aufbauen.',color:'#3f9b62',mult:6}};
const WAGE={barista:2450,manager:3900,jr:3600,sr:6200,des:4300,qa:3900,worker:2500,admin:3400};
const PRODUCTS={ // other = Zutaten je Portion ohne Eigenlieferung, beans = kg Röstkaffee, piece = Teig/Brötchen aus der Backstraße
  pasta:{n:'Pasta',icon:'🍝',other:2.6,ref:13.9,w:1.4,main:true},
  pizza:{n:'Pizza',icon:'🍕',other:1.6,piece:1,mkt:1.1,ref:12.5,w:1.5,main:true},
  salat:{n:'Salat',icon:'🥗',other:2.0,ref:11.5,w:0.8,main:true},
  limo:{n:'Hauslimonade',icon:'🍋',other:0.6,ref:4.2,w:1.1,drink:true},
  espresso:{n:'Espresso',icon:'☕',other:0.12,beans:0.009,ref:2.8,w:0.7,drink:true},
  tiramisu:{n:'Tiramisu',icon:'🍰',other:1.1,beans:0.004,ref:6.9,w:0.7,cake:true},
  burger:{n:'Burger',icon:'🍔',other:3.0,piece:1,mkt:0.6,ref:14.5,w:1.2,res:'burger',main:true},
  steak:{n:'Steak vom Grill',icon:'🥩',other:9.5,ref:27,w:0.6,res:'grill',main:true},
  wein:{n:'Hauswein',icon:'🍷',other:1.8,ref:6.5,w:0.9,res:'wein',drink:true},
  cocktail:{n:'Sommer-Cocktails',icon:'🍹',other:2.0,ref:9.5,w:0.7,res:'cocktail',drink:true,summer:true}};
const PER=2,GPS=21; // Positionen je Gast, Gäste je Kraft und Tag
const QMULT=[0,1,1.45,2.1],QUAL=[0,0.45,0.7,0.93],QN=['','Einfach','Gut','Premium'];
const LEVELS=[null,{n:'Bistro',cost:22000,comfort:0.6},{n:'Restaurant',cost:40000,comfort:0.8},{n:'Gehoben',cost:75000,comfort:0.95}];
const CAFE_UPS={
  espresso:{n:'Profiküche',icon:'👨‍🍳',cost:15000,mon:120,d:'Hauptgerichte schmecken besser: Qualität +10 %.'},
  vitrine:{n:'Dessertvitrine',icon:'🍰',cost:4000,mon:30,d:'+40 % Verkauf von Desserts.'},
  terrasse:{n:'Terrasse',icon:'⛱️',cost:8000,mon:0,d:'April bis September +20 % Gäste und Plätze.',zones:['city','wohn']},
  lounge:{n:'Bar-Lounge',icon:'🛋️',cost:14000,mon:0,d:'Gemütlichkeit +12 %, Gäste bleiben länger und kommen wieder.'},
  wlan:{n:'Business-Lunch',icon:'💼',cost:3000,mon:60,d:'+12 % Gäste in Innenstadt und Büroviertel.'},
  togo:{n:'Abholfenster',icon:'🥡',cost:9000,mon:0,d:'+15 % Gäste und +20 % Kapazität, etwas weniger gemütlich.'},
  kids:{n:'Kinderecke',icon:'🧸',cost:5000,mon:0,d:'+15 % Gäste im Wohnviertel (Familien).',zones:['wohn']},
  delivery:{n:'Lieferdienst',icon:'🛵',cost:1500,mon:0,d:'+15 % Umsatz über Liefer-Apps, davon 25 % Provision.'},
  roaster:{n:'Holzofen',icon:'🔥',cost:25000,mon:300,d:'Hauptgerichte +6 % Qualität, +8 % Gäste, der Ruf steigt schneller.',minLevel:2},
  solar:{n:'Energiesparpaket',icon:'💡',cost:7000,mon:0,d:'Nebenkosten −40 %.'}};
const CAFE_ACTIONS={
  happy:{n:'Mittagsmenü',icon:'🍱',cost:0,d:'+18 % Gäste, der Bon sinkt um 6 %.'},
  music:{n:'Live-Musik am Wochenende',icon:'🎸',cost:800,d:'+6 % Gäste, der Ruf steigt.'},
  flyer:{n:'Flyer im Viertel',icon:'📰',cost:400,d:'Die Bekanntheit im Viertel steigt deutlich.'},
  stamp:{n:'Treuekarte',icon:'🎟️',cost:0,d:'+8 % Stammgäste, kostet 3 % vom Umsatz.'}};
const HOURS={short:{n:'Nur Mittag',dem:0.7,cap:0.75,wage:0.75},normal:{n:'11–22 Uhr',dem:1,cap:1,wage:1},long:{n:'9–24 Uhr',dem:1.15,cap:1.3,wage:1.3}};
const GENRES={
  prod:{n:'Produktivität',icon:'✅',pot:600000,conv:1.0,adv:0.8,cpi:2.5},
  fit:{n:'Fitness',icon:'🏃',pot:900000,conv:0.8,adv:1.0,cpi:2.0},
  game:{n:'Spiele',icon:'🎮',pot:3000000,conv:0.35,adv:1.6,cpi:1.4,res:'games'},
  fin:{n:'Fintech',icon:'💶',pot:400000,conv:1.6,adv:0.5,cpi:4.5,res:'fintech'}};
const SCOPES={S:{n:'Klein',work:220,q:0,pot:0.5},M:{n:'Mittel',work:650,q:0.05,pot:1},L:{n:'Groß',work:1600,q:0.1,pot:1.7}};
const FOCUS={features:{n:'Neue Funktionen',icon:'✨',d:'Qualität und Aktualität steigen, dabei entstehen neue Bugs.'},bugs:{n:'Bugs beheben',icon:'🐞',d:'Fehler verschwinden, die Bewertung steigt.'},
  perf:{n:'Performance',icon:'⚡',d:'Die App läuft flüssiger: deutlich weniger Kündigungen.'},growth:{n:'Wachstum',icon:'📈',d:'Teilen- und Einlade-Funktionen: +30 % neue Nutzer.'},money:{n:'Monetarisierung',icon:'💰',d:'Bessere Bezahlseiten: +25 % zahlende Nutzer.'}};
const MODELS={free:{n:'Kostenlos mit Werbung'},freemium:{n:'Freemium mit Abo'},paid:{n:'Einmalkauf'}};
const CAMPAIGNS={social:{n:'Social Media',icon:'📱',cost:2000,d:'Laufend: +15 % neue Nutzer.'},influencer:{n:'Influencer-Kampagne',icon:'🌟',cost:12000,d:'Nur nächste Woche: +50 % neue Nutzer und ein Schub obendrauf.'}};
const OFFICE_UPS={
  hardware:{n:'Schnelle Rechner',icon:'🖥️',cost:15000,mon:0,d:'+10 % Entwicklungsleistung.'},
  kitchen:{n:'Teeküche & Obst',icon:'🍎',cost:6000,mon:300,d:'Stimmung +8 %.'},
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
  cafe:{burger:{n:'Burger-Rezeptur',icon:'🍔',cost:8000,months:1,d:'Neues Gericht: Burger'},wein:{n:'Weinkarte',icon:'🍷',cost:9000,months:1,d:'Neu: Hauswein'},
    cocktail:{n:'Cocktailbar',icon:'🍹',cost:12000,months:1,d:'Neu, im Sommer der Renner'},grill:{n:'Grillstation',icon:'🥩',cost:20000,months:2,d:'Neues Gericht mit hohem Bon: Steak'},
    schnell:{n:'Schnellere Abläufe',icon:'⏱️',cost:18000,months:2,d:'+25 % Kapazität je Kraft'},treue:{n:'Reservierungs-App',icon:'📲',cost:22000,months:2,d:'+12 % Stammgäste in allen Restaurants'}},
  soft:{ci:{n:'Automatisierte Tests',icon:'🧪',cost:20000,months:2,d:'40 % weniger neue Bugs'},cloud:{n:'Eigene Cloud',icon:'☁️',cost:25000,months:2,d:'40 % weniger Serverkosten'},
    ki:{n:'KI-Funktionen',icon:'🤖',cost:40000,months:2,d:'+10 % Qualität für alle Apps'},games:{n:'Spiele-Engine',icon:'🎮',cost:30000,months:2,d:'Neues Genre: Spiele'},fintech:{n:'Banklizenz-Partner',icon:'🏦',cost:35000,months:2,d:'Neues Genre: Fintech'}},
  prod:{tisch:{n:'Tisch-Konstruktion',icon:'📐',cost:12000,months:1,d:'Neues Produkt: Tische'},back:{n:'Backstraße',icon:'🥖',cost:15000,months:1,d:'Neue Linie: Teig und Brötchen, beliefert auch eigene Restaurants'},
    auto:{n:'Automatisierung',icon:'🦾',cost:50000,months:2,d:'Linien einzeln automatisieren: +30 % Ausstoß, 2 Leute weniger'},qm:{n:'Qualitätsmanagement',icon:'🏅',cost:25000,months:2,d:'+6 % bei allen Auftragspreisen'}}};
const CITIES=[{id:'kiel',n:'Emden',traffic:1.0,rent:1.0},{id:'hamburg',n:'Hamburg',traffic:1.45,rent:1.5,unlock:{staff:12,cost:60000}},{id:'berlin',n:'Berlin',traffic:1.6,rent:1.35,unlock:{staff:50,cost:120000}}];
const ZONES={
  city:{n:'Innenstadt',traffic:[4200,7000],rent:[3600,6200],size:[80,140],uses:['cafe','office','hq']},
  wohn:{n:'Wohnviertel',traffic:[1500,3000],rent:[1700,2600],size:[100,170],uses:['cafe']},
  buero:{n:'Büroviertel',traffic:[2200,3600],rent:[2600,4200],size:[300,650],uses:['cafe','office','hq']},
  gewerbe:{n:'Gewerbegebiet',traffic:[300,800],rent:[1500,2600],size:[1500,3000],uses:['factory']}};
// Stadtpläne: w Wohnviertel, c Innenstadt, b Büroviertel, g Gewerbe, P Park, A Wasser, L Wahrzeichen
const CITY_MAP={kiel:['ALccwP','Acccww','wcbcww','wwbwPw','gggwww'],hamburg:['ggbccw','gbcLAw','gbccAw','wcbPww','wwwwwg'],berlin:['PPbbcw','PPcLcw','wbccbw','wwbbww','ggwwgg']};
// Blöcke: gleiche Buchstaben in Nachbarfeldern bilden einen großen Block (Fußgängerzone, Park oder Wasser statt Straße)
const CITY_BLOCKS={kiel:['abccde','afccgg','hxijgk','hlimnk','ooopqq'],hamburg:['aabcxd','aefghd','aefihk','lmnopp','qqrrrs'],berlin:['aabbcd','aaefgd','hijjkl','hmnnoo','ppqqrr']};
const CODE={w:'wohn',c:'city',b:'buero',g:'gewerbe'};
const ZONE_MAP=CITY_MAP.kiel.map(r=>[...r].map(ch=>CODE[ch]||'wohn'));
// Eigenheiten der Städte: Saison, Preisbewusstsein, Nachtleben, Terrassen
const CITY_TRAITS={kiel:{d:'Hafenstadt mit Altstadt: günstige Mieten, weniger Laufkundschaft, im Sommer kommen viele Touristen.',summer:1.25,price:1,night:0.9,terr:1.2},
  hamburg:{d:'Wohlhabend und oft verregnet: Gäste zahlen mehr, Terrassen bringen weniger, das Geschäft läuft das ganze Jahr.',summer:1.05,price:0.7,night:1,terr:1.08},
  berlin:{d:'Preisbewusst und nachtaktiv: Gäste achten genau auf Preise, lange Öffnungszeiten lohnen sich besonders.',summer:1.12,price:1.35,night:1.14,terr:1.2}};
const COLS=6,ROWS=5;
const STAGES=[[0,'Gründung'],[6,'Kleinunternehmen'],[50,'Mittelstand'],[250,'Großunternehmen'],[1000,'Konzern']];
const DEPTS={hr:{n:'Personal',icon:'🤝',d:'Bessere Stimmung, halb so viele Kündigungen'},mkt:{n:'Marketing',icon:'📣',d:'Werbung wirkt 35 % stärker'},
  ctrl:{n:'Controlling',icon:'📊',d:'5 % weniger Miete und Nebenkosten, keine Extra-Verwaltung'},rd:{n:'Forschung',icon:'🔬',d:'Entwicklungen doppelt so schnell, etwas mehr Qualität'}};
const COMP_CAFE={kiel:[['Trattoria Bella','#8a6a52',0.66,1.0,3],['Fischhaus Förde','#6b7a8f',0.56,0.9,2],['Deichgrill','#7a8a5a',0.6,0.95,2],['Teestube Ostfriesland','#a07a3a',0.62,0.92,2],['Pizza Hafenkante','#b0503a',0.54,0.85,3]],
  hamburg:[['Elbküche','#4f7d8c',0.72,1.08,4],['Trattoria Bella','#8a6a52',0.66,1.0,2],['Fleetbistro','#5f7a6a',0.64,0.98,3],['Kiez Burger','#a04a3a',0.58,0.88,3],['Alsterblick','#6a6a8f',0.74,1.15,2]],
  berlin:[['Spreeblick Grill','#7d5c8c',0.7,1.02,4],['Kiezküche','#a07a3a',0.6,0.88,3],['Curry Eck','#b0603a',0.55,0.82,4],['Brandenburger Hof','#6a7a6a',0.73,1.12,2],['Dönerwerk','#8a5a3a',0.57,0.85,4]]};
const DIFF={easy:{n:'Leicht',dm:1.15,cq:-0.06},normal:{n:'Normal',dm:1,cq:0},hard:{n:'Schwer',dm:0.88,cq:0.04},tycoon:{n:'Tycoon',dm:0.78,cq:0.08}};
const CURS={EUR:'€',USD:'$',GBP:'£',JPY:'¥'};let CUR='€';
// Geschmack je Stadt für das Hausrezept (Würze, Frische, Portion)
const TASTE={kiel:{wuerze:0.35,frische:0.75,portion:0.75},hamburg:{wuerze:0.5,frische:0.65,portion:0.5},berlin:{wuerze:0.75,frische:0.45,portion:0.55}};
// Neues Restaurant: Fassade, Einrichtung, Ausstattung
const FACADES={klassik:{n:'Klassisch',cost:6000,d:'Schlichte Front mit Markise.'},glas:{n:'Glasfront',cost:18000,d:'Große Fenster: +10 % Laufkundschaft.',walk:1.1},stuck:{n:'Altbau mit Stuck',cost:26000,d:'Repräsentativ: +6 % Gemütlichkeit, Ruf steigt schneller.',comfort:0.06}};

const COMP_APPS=[['Notio','prod',0.7,90000],['Listly','prod',0.58,40000],['FitBuddy','fit',0.62,120000],['RunRun','fit',0.55,60000],['Pixelquest','game',0.66,400000],['Klickfarm','game',0.5,250000],['Spargroschen','fin',0.68,50000]];
const COMP_PROD={kiel:[['Nordholz Werke','#9a8f7a']],hamburg:[['Hanse Möbel','#7a8a9a'],['Speicherstadt Rösterei','#8a6a52']],berlin:[['Spree Manufaktur','#7a7a8a']]};
const BUYERS={stuhl:['Möbelhaus Nord','Wohnwelt','Schulträger Emden','Hotelkette Seeblick'],tisch:['Wohnwelt','Möbelhaus Nord','Kantinenbau AG'],bohnen:['Bohnenwerk','Supermarkt Regional','Hotelkette Seeblick','Bürokaffee GmbH'],gebaeck:['Supermarkt Regional','Kantinenbau AG','Tankstellen-Shops']};
const APP_NAMES=['Taskly','Fokus','Planwerk','Pulse','Kraftakt','Moneta','Zenith','Kompass','Nordlicht','Orbit','Brise','Spark','Atlas','Quokka','Lumen'];
let BR='cafe';
const GOALS=[ // der Reihe nach, mit Förderprämie
  {k:'first',get n(){return BR==='soft'?'Bring deine erste App heraus':BR==='prod'?'Starte deine erste Produktionslinie':'Eröffne dein erstes Restaurant'},d:'Eine Filiale, eine veröffentlichte App oder eine laufende Linie.',reward:3000,test:G=>G.firms.some(f=>f.branch==='cafe'?f.shops.length:f.branch==='soft'?G.apps.some(a=>a.owner===f.id&&a.state==='live'):f.plants.some(p=>p.lines.length))},
  {k:'profit1',n:'Schließe einen Monat mit Gewinn ab',reward:2000,test:G=>last(G)&&last(G).net>0},
  {k:'p5k',n:'Erreiche 5.000 € Monatsgewinn',reward:5000,test:G=>last(G)&&last(G).net>=5000},
  {k:'three',get n(){return BR==='soft'?'Betreibe drei Apps':BR==='prod'?'Betreibe drei Produktionslinien':'Betreibe drei Restaurants'},reward:8000,test:G=>G.firms.some(f=>f.branch==='cafe'?f.shops.length>=3:f.branch==='soft'?G.apps.filter(a=>a.owner===f.id&&a.state!=='off').length>=3:f.plants.reduce((s,p)=>s+p.lines.length,0)>=3)},
  {k:'s10',n:'Beschäftige 10 Menschen',reward:5000,test:G=>totalStaff(G)>=10},
  {k:'stars',get n(){return BR==='soft'?'4,5 Sterne für eine App':BR==='prod'?'Erstklassiger Ruf als Hersteller':'4,5 Sterne für ein Restaurant'},reward:6000,test:G=>G.firms.some(f=>(f.shops||[]).some(s=>stars(s.rep)>=4.5))||G.apps.some(a=>!a.owner.startsWith('c:')&&a.state==='live'&&rating(a)*5>=4.5)||G.firms.some(f=>f.branch==='prod'&&f.rep>=0.88)},
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
  G.diff=o.diff||'normal';G.dm=DIFF[G.diff].dm;G.currency=o.cur||'EUR';CUR=CURS[G.currency];
  for(const c of CITIES)for(const [n,col,q0,p,shops] of COMP_CAFE[c.id].slice(0,o.comps===undefined?2:o.comps)){const q=clamp(q0+DIFF[G.diff].cq,0.4,0.92);const cp=addComp(G,{branch:'cafe',name:n,color:col,q,price:p,city:c.id,rep:0.55+q*0.2});for(let k=0;k<shops;k++)compOpen(G,cp)}
  for(const [n,g,q,u] of COMP_APPS){const cp=addComp(G,{branch:'soft',name:n,color:'#8a8f96',q});G.apps.push({id:uid(G),owner:'c:'+cp.id,name:n,genre:g,scope:'M',state:'live',progress:1,work:1,quality:q,bugs:20,users:u,payers:0,model:'freemium',price:4.99,fresh:0.8,released:-6})}
  for(const c of CITIES)for(const [n,col] of COMP_PROD[c.id]){const cp=addComp(G,{branch:'prod',name:n,color:col,q:0.6,city:c.id});const pl=freePlots(G,c.id,'factory')[0];if(pl){pl.owner='c:'+cp.id;pl.use='factory'}}
  equity(G,o.capital||50000);
  if(o.finance==='loan')takeLoan(G,{amount:o.branch==='prod'?120000:60000,rate:0.065,months:60,name:'Gründerkredit'});
  if(o.finance==='angel'){equity(G,150000);G.owner*=0.8;G.rounds=1;news(G,'Ein Business Angel steigt mit 150.000 € ein und erhält 20 % der Anteile.','fin')}
  foundFirm(G,o.branch,o.name||'Mein Start-up');if(o.color)G.firms[0].color=o.color;G.firms[0].logo=o.logo||0;G.me.name=o.ceo||'Du';G.me.portrait=o.portrait||0;
  genContracts(G);genMarket(G);migrate(G);
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
// Jedes Grundstück trägt ein festes Gebäude. Firmen mieten sich ein: Ladenlokale im Erdgeschoss, Etagen darüber, Hallen im Gewerbegebiet.
const UNITS={wohn:['laden','laden'],city:['laden','laden','etage'],buero:['laden','etage','etage'],gewerbe:['halle']};
const KINDS={laden:{n:'Ladenlokal',uses:['cafe']},etage:{n:'Büroetage',uses:['office','hq']},halle:{n:'Halle',uses:['factory']}};
const UNIT_RANGE={'city-etage':{rent:[3800,6400],size:[250,520]},'buero-laden':{rent:[2200,3400],size:[90,160]}};
function genCity(G,c){const map=CITY_MAP[c.id]||CITY_MAP.kiel;for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){const zk=CODE[map[r][col]];if(!zk)continue;const z=ZONES[zk],tr=Math.round(rr(G,z.traffic[0],z.traffic[1])*c.traffic/50)*50;
  UNITS[zk].forEach((kind,u)=>{const R=UNIT_RANGE[zk+'-'+kind]||z;
    G.plots.push({id:c.id+'-'+r+'-'+col+'-'+u,city:c.id,r,c:col,u,kind,zone:zk,traffic:kind==='laden'?Math.round(tr*rr(G,0.9,1.1)/50)*50:tr,rent:Math.round(rr(G,R.rent[0],R.rent[1])*c.rent/50)*50,size:Math.round(rr(G,R.size[0],R.size[1])/10)*10,owner:null,use:null})})}}
const usesOf=p=>p.kind?KINDS[p.kind].uses.filter(x=>ZONES[p.zone].uses.includes(x)):ZONES[p.zone].uses;
const unitName=p=>p.kind?KINDS[p.kind].n:p.zone==='gewerbe'?'Halle':'Gewerbefläche';
const plot=(G,id)=>G.plots.find(p=>p.id===id);
function freePlots(G,city,use){return G.plots.filter(p=>p.city===city&&!p.owner&&usesOf(p).includes(use)).sort((a,b)=>b.traffic-a.traffic)}
function addComp(G,o){const cp=Object.assign({id:uid(G),rep:0.6,price:1,aware:0.4,value:0},o);G.comps.push(cp);return cp}
function compOpen(G,cp){const mine=G.plots.filter(q=>q.city===cp.city&&q.use==='cafe'&&q.owner&&!q.owner.startsWith('c:'));const sc=p=>p.traffic*(1+0.6*mine.filter(q=>near(p,q)).length)*(0.7+0.6*rand(G));
  const fr=freePlots(G,cp.city,'cafe').filter(p=>p.zone!=='buero'||rand(G)<0.4).sort((a,b)=>sc(b)-sc(a));if(!fr.length)return null;const p=fr[Math.min(fr.length-1,Math.floor(rand(G)*Math.min(3,fr.length)))];p.owner='c:'+cp.id;p.use='cafe';return p}
function foundFirm(G,branch,name){
  const f={id:'f'+uid(G),name,branch,color:BRANCHES[branch].color,founded:G.month,morale:0.75,aware:0.05,rep:0.5,mkt:branch==='soft'?1500:800,wage:1.0,res:{},resCur:null};
  if(branch==='cafe'){f.shops=[];f.menu={};for(const k in PRODUCTS)f.menu[k]={on:['pasta','pizza','salat','limo','espresso','tiramisu'].includes(k),q:k==='limo'?1:2,price:PRODUCTS[k].ref}}
  if(branch==='soft')Object.assign(f,{jr:0,sr:0,des:0,qa:0,office:null,oups:{}});
  if(branch==='prod')Object.assign(f,{plants:[],goods:{},contracts:[],supplier:'standard',brand:null,autoSell:true,delivered:0,made:{}});
  G.firms.push(f);G.cur=f.id;return f}
const firm=(G,id)=>G.firms.find(f=>f.id===id);

// ---------- Personal ----------
function staffOf(G,f){if(f.branch==='cafe')return f.shops.reduce((s,x)=>s+x.staff+(x.manager?1:0),0);if(f.branch==='soft')return f.jr+f.sr+f.des+f.qa;
  return f.plants.reduce((s,p)=>s+1+p.lines.reduce((a,l)=>a+l.workers*l.shifts,0),0)}
function adminOf(G,f){return Math.floor(staffOf(G,f)/15*(1-dcov(G,'ctrl')))}
function hqStaff(G){return G.hq?4+Object.keys(G.depts).reduce((s,k)=>s+deptN(G,k),0)+Object.keys(G.execs||{}).length:0}
// Abteilungen der Zentrale: Köpfe gegen Bedarf, die Wirkung wächst mit der Abdeckung
function dneed(G){return Math.max(2,Math.round(G.firms.reduce((s,f)=>s+staffOf(G,f),0)/60))}
function deptN(G,k){const v=G.depts[k];return v===true?2:(+v||0)}
function dcov(G,k){return G.hq&&!(G.hqBuild>0)&&G.depts[k]?Math.min(1,deptN(G,k)/dneed(G)):0}
function staffNoHq(G){return 1+G.firms.reduce((s,f)=>s+staffOf(G,f)+adminOf(G,f),0)}
function totalStaff(G){return staffNoHq(G)+hqStaff(G)}
function stage(G){const n=totalStaff(G);let i=0;STAGES.forEach((x,j)=>{if(n>=x[0])i=j});return{n:STAGES[i][1],i,next:STAGES[i+1]||null,staff:n}}
const productivity=f=>(0.55+0.6*f.morale)*(f.exec||1);
const has=(f,k)=>!!f.res[k];
const wageOf=(G,role,f)=>WAGE[role]*EMP*G.idx.wage*f.wage;
const stars=rep=>Math.round((1+4*clamp(rep,0,1))*2)/2;
const season=G=>G.month%12;
const summer=G=>{const m=season(G);return m>=3&&m<=8};

// ---------- Restaurant ----------
function menuStats(G,f,s){let sumA=0,sumW=0,sumQW=0,pf=0;const items=[];const ups=s?s.ups:{};
  for(const k in f.menu){const m=f.menu[k],P=PRODUCTS[k];if(!m.on||(P.res&&!has(f,P.res)))continue;
    const price=(s&&!f.uniform&&s.px&&s.px[k]!=null)?s.px[k]:m.price;
    let q=QUAL[m.q]+(s?0.05*mq(s,'prod'):0)+(P.main?recipeFit(G,f,s):0);if(P.main&&ups.espresso)q+=0.1;if(P.main&&ups.roaster)q+=0.06;q=Math.min(1,q);
    const ct=CITY_TRAITS[s?plot(G,s.plot).city:'kiel']||CITY_TRAITS.kiel,pfac=clamp(Math.exp(-1.8*ct.price*(price/P.ref-1)),0.15,1.6);let w=P.w;if(P.cake&&ups.vitrine)w*=1.4;if(P.summer&&summer(G))w*=1.8;if(s&&s.special===k)w*=1.3;
    const a=w*q*pfac;items.push({k,a,price,q:m.q,pf:pfac,qual:q});sumA+=a;sumW+=w;sumQW+=w*q;pf+=pfac*w}
  for(const it of items)it.share=sumA?it.a/sumA:0;
  const cq=1+0.05*ex(G,'cpo');return{items,score:Math.min(1.6,sumA/2.2*cq),quality:sumW?Math.min(1,sumQW/sumW*cq):0,price:sumW?pf/sumW:1}}
function recipeFit(G,f,s){const r=f.recipe;if(!r)return 0;const p=s?plot(G,s.plot):null,T=TASTE[p?p.city:'kiel'];const d=(Math.abs(r.wuerze-T.wuerze)+Math.abs(r.frische-T.frische)+Math.abs(r.portion-T.portion))/3;return clamp(0.08-0.32*d,-0.06,0.08)}
function unitCost(G,f,k,s){const P=PRODUCTS[k],m=f.menu[k];return(P.other*(P.main&&f.recipe?0.8+0.4*f.recipe.portion:1)+(P.beans?P.beans*GOODS.bohnen.ref*G.idx.rohkaffee:0)+(P.piece?P.mkt:0))*QMULT[m.q]}
function compAttr(cp){return Math.pow(cp.q,0.8)*0.8*clamp(Math.exp(-1.8*(cp.price-1)),0.3,1.5)*(0.35+0.65*cp.rep)}
const ZCONV={city:0.062,wohn:0.085,buero:0.066,gewerbe:0.023}; // im Wohnviertel kommen mehr Passanten als Stammgäste
const near=(a,b)=>a.city===b.city&&Math.abs(a.r-b.r)<=1&&Math.abs(a.c-b.c)<=1;
function comfortOf(s){return clamp(LEVELS[s.level].comfort+(FACADES[s.facade||'klassik'].comfort||0)+(s.ups.lounge?0.12:0)-(s.ups.togo?0.03:0),0,1)}
function shopForecast(G,f,s){ // Nachfrage und Kapazität im Monat (auch für die Vorschau)
  const p=plot(G,s.plot),ms=menuStats(G,f,s),comfort=comfortOf(s);
  const A=Math.pow(ms.score,0.8)*comfort*(0.4+0.6*s.rep);
  let comp=0;for(const q of G.plots)if(q!==p&&q.use==='cafe'&&near(p,q)){if(q.owner&&q.owner.startsWith('c:')){const cp=G.comps.find(c=>'c:'+c.id===q.owner);if(cp)comp+=compAttr(cp)}else if(q.owner===f.id)comp+=A*0.5}
  const H=HOURS[s.hours];let m=H.dem;const u=s.ups,a=s.act,CT=CITY_TRAITS[p.city]||CITY_TRAITS.kiel;if(summer(G))m*=CT.summer;if(s.hours==='long')m*=CT.night;
  if(u.wlan&&(p.zone==='city'||p.zone==='buero'))m*=1.12;if(u.togo)m*=1.15;if(u.kids&&p.zone==='wohn')m*=1.15;if(u.roaster)m*=1.08;if(u.terrasse&&summer(G))m*=CT.terr;
  m*=1+0.07*mq(s,'mkt');if(a.happy)m*=1.18;if(a.music)m*=1.06;if(a.stamp)m*=1.08;if(has(f,'treue'))m*=1.12;if(G.ev&&G.ev.heat)m*=1.1;if(G.ev&&G.ev.fest===s.id)m*=1.35;
  const la=Math.max(f.aware,s.la||0,(f.cityAw&&f.cityAw[p.city])||0);
  const dem=p.traffic*DAYS*ZCONV[p.zone]*(0.5+0.5*la)*m*econ(G)*(G.dm||1)*(FACADES[s.facade||'klassik'].walk||1)*A/(A+comp*0.9+0.35);
  let cap=s.staff*GPS*DAYS*productivity(f)*H.cap*(1+0.15*mq(s,'ppl'))*(has(f,'schnell')?1.25:1)*(u.togo?1.2:1)*(u.terrasse&&summer(G)?1.2:1);
  cap=Math.min(cap,p.size*0.9*DAYS*H.cap*(u.terrasse&&summer(G)?1.2:1));
  return{dem,cap,ms,comfort,A,comp}}
function cafeMonth(G,f,rep){
  for(const s of f.shops){const p=plot(G,s.plot);
    if(s.build>0){const r=rentOf(p)*W;pay(G,f.id,'rent',r);rep.items.push({kind:'shop',id:s.id,fid:f.id,plot:p.id,icon:'🚧',name:ZONES[p.zone].n+' '+cityName(p.city),firm:f.name,rev:0,profit:-r,kpi:'Im Bau · Eröffnung in '+s.build+(s.build>1?' Wochen':' Woche')});continue}
    const fc=shopForecast(G,f,s),H=HOURS[s.hours];
    const guests=Math.floor(Math.min(fc.dem,fc.cap));let rev=0,cogs=0,cogsInt=0;const per=PER;
    const byItem={};for(const it of fc.ms.items){const P=PRODUCTS[it.k],n=guests*per*it.share,qm=QMULT[it.q];rev+=n*it.price;cogs+=n*P.other*qm*(P.main&&f.recipe?0.8+0.4*f.recipe.portion:1);byItem[it.k]={n:Math.round(n),rev:n*it.price*(s.act.happy?0.94:1)};
      if(P.beans){const kg=n*P.beans,sup=supplier(G,'bohnen');let got={qty:0,cost:0};if(sup)got=takeGoods(G,sup,'bohnen',kg);cogsInt+=got.cost;cogs+=(kg-got.qty)*GOODS.bohnen.ref*G.idx.rohkaffee*qm}
      if(P.piece){const pc=n*P.piece,sup=supplier(G,'gebaeck');let got={qty:0,cost:0};if(sup)got=takeGoods(G,sup,'gebaeck',pc);cogsInt+=got.cost;cogs+=(pc-got.qty)*P.mkt*qm}}
    if(s.act.happy)rev*=0.94;
    let deliv=0;if(s.ups.delivery){deliv=rev*0.15;rev+=deliv;cogs*=1.15}
    earn(G,f.id,'rev',rev);pay(G,f.id,'cogs',cogs);L(G,f.id).cogs+=cogsInt;
    const wages=(s.staff*wageOf(G,'barista',f)*H.wage+(s.manager?s.manager.salary/12*EMP:0))*W;pay(G,f.id,'staff',wages);
    const ctrl=1-0.05*dcov(G,'ctrl');pay(G,f.id,'rent',rentOf(p)*ctrl*W);
    let other=(200+250*s.level)*(s.ups.solar?0.6:1)*ctrl*W+deliv*0.25;for(const k in s.ups)other+=CAFE_UPS[k].mon*W;pay(G,f.id,'other',other);
    let mk=0;for(const k in s.act)if(s.act[k])mk+=CAFE_ACTIONS[k].cost*W;if(s.act.stamp)mk+=rev*0.03;pay(G,f.id,'mkt',mk);
    s.la=(s.la||0)+((s.act.flyer?0.8:0)-(s.la||0))*kW(0.15);
    const served=fc.dem>0?Math.min(1,fc.cap/fc.dem):1,service=0.1*mq(s,'ppl')+(s.train||0)*0.05;
    const sat=clamp(0.42*fc.ms.quality/0.93+0.2*fc.comfort+0.2*served+0.12*Math.min(1,fc.ms.price)+service+(s.act.music?0.03:0)+(s.ups.roaster?0.03:0),0,1);
    s.rep+=(sat-s.rep)*kW(s.ups.roaster?0.4:0.3);
    const profit=rev-cogs-cogsInt-wages-rentOf(p)*ctrl*W-other-mk;
    let hot=0,cold=0,food=0;for(const it of fc.ms.items){const P=PRODUCTS[it.k],v=guests*per*it.share*it.price*(s.act.happy?0.94:1)*(s.ups.delivery?1.15:1);if(P.main)hot+=v;else if(P.drink)cold+=v;else food+=v}
    const prev=s.stat;s.stat={guests,dem:Math.round(fc.dem),cap:Math.round(fc.cap),rev,cost:rev-profit,profit,sat,served,hot,cold,food,cogs:cogs+cogsInt,wages,rent:rentOf(p)*ctrl*W,other,mk};
    let cm=0,cd=0,cs=0;for(const k in byItem){const P=PRODUCTS[k];if(P.main)cm+=byItem[k].n;else if(P.drink)cd+=byItem[k].n;else cs+=byItem[k].n}
    s.prevItems=prev&&prev.items||null;s.stat.items=byItem;s.ih=s.ih||{};for(const k in PRODUCTS){const v=byItem[k]?byItem[k].rev:0;s.ih[k]=(s.ih[k]||[]).concat([v]).slice(-12)}s.hist=(s.hist||[]).concat([{m:G.month,w:G.week||0,d:dayOf(G)+'.'+(G.month%12+1)+'.',rev,profit,guests,cm,cd,cs}]).slice(-12);s.rcount=(s.rcount||0)+Math.round(guests*0.012);
    s.reviews=reviewsFor(G,s,fc,served);
    rep.items.push({kind:'shop',id:s.id,fid:f.id,plot:p.id,icon:'🍽️',name:ZONES[p.zone].n+' '+cityName(p.city),firm:f.name,rev,profit,kpi:fn(guests)+' Gäste',delta:prev?guests-prev.guests:null,stars:stars(s.rep)})}
  if(f.shops.length)f.rep+=(f.shops.reduce((a,s)=>a+s.rep,0)/f.shops.length-f.rep)*kW(0.5)}
function reviewsFor(G,s,fc,served){const out=[];const q=fc.ms.quality,c=fc.comfort,pr=fc.ms.price;const good=[],bad=[];
  if(q>0.75)good.push(pick(G,['„Die beste Pasta der Stadt.“','„Man schmeckt die Qualität. Komme wieder!“','„Essen wie in Italien.“']));
  if(q<0.5)bad.push(pick(G,['„Die Pasta war verkocht.“','„Das Essen kam lauwarm an den Tisch.“']));
  if(c>0.85)good.push(pick(G,['„So gemütlich, ich bleibe immer länger als geplant.“','„Wunderschön eingerichtet.“']));
  if(served<0.85)bad.push(pick(G,['„Ohne Reservierung keine Chance auf einen Tisch.“','„Eine Stunde aufs Essen gewartet.“','„Das Personal war völlig überlastet.“']));
  if(pr<0.7)bad.push(pick(G,['„Lecker, aber ganz schön teuer.“','„Für den Preis erwarte ich mehr.“']));
  if(pr>1.15)good.push('„Faire Preise, super Preis-Leistung.“');
  if(s.ups.wlan)good.push('„Perfekt für den Business-Lunch.“');if(s.act.music)good.push('„Die Live-Musik am Samstag war großartig!“');
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
  return{fd,raw,P:raw*productivity(f)*(f.oups.hardware?1.1:1)*(1+0.12*ex(G,'cto'))*DAYS,qT:clamp(0.45+0.45*(f.sr*2.2)/Math.max(1,raw)+Math.min(0.12,f.des*0.04)+(has(f,'ki')?0.1:0)+0.04*dcov(G,'rd')+0.03*ex(G,'cpo'),0,0.97),
    bugMult:(1/(1+4*f.qa/Math.max(1,f.jr+f.sr+(fd?1:0))))*(has(f,'ci')?0.6:1)*(f.oups.quiet?0.8:1)}}
function desks(G,f){if(!f.office||f.officeBuild>0)return 3;return Math.floor(plot(G,f.office).size/10)}
function rating(a){const bd=a.bugs/(40+a.users/1500);return clamp(a.quality*1.1-Math.min(1,bd)*0.3,0,1)}
function appAttr(a){const fr=a.fresh===undefined?1:a.fresh;return Math.pow(rating(a),1.6)*(0.4+0.6*fr)*(a.model==='freemium'?clamp(Math.exp(-(a.price-4.99)/10),0.3,1.4):a.model==='paid'?0.7:1.1)}
function softMonth(G,f,rep){
  const t=softTeam(G,f),mine=G.apps.filter(a=>a.owner===f.id&&a.state!=='off'),wsum=mine.reduce((s,a)=>s+a.share,0)||1;
  for(const a of mine){const Wk=t.P*a.share/wsum;a.work_m=Wk;
    if(a.state==='dev'){const qi=clamp(t.qT+SCOPES[a.scope].q,0,0.97);a.quality=(a.quality*a.progress+qi*Wk)/Math.max(1e-6,a.progress+Wk);a.progress+=Wk;a.bugs+=Wk*0.06*t.bugMult;
      if(a.progress>=a.work)release(G,f,a)}
    else if(a.state==='live'){const fo=a.focus;
      a.bugs+=a.users/1e5*45*t.bugMult*W;a.bugs=Math.max(0,a.bugs-Wk*(fo==='bugs'?0.9:0.25));
      if(fo==='features'){a.quality+=Math.max(0,t.qT+0.1-a.quality)*Wk*0.0012;a.bugs+=Wk*0.05*t.bugMult}
      a.fresh=clamp((a.fresh===undefined?1:a.fresh)-0.12*W+Wk*(fo==='features'?0.006:0.002),0,1)}}
  let rev=0,server=0;
  for(const a of mine)if(a.state==='live'){const gen=GENRES[a.genre],rivals=G.apps.filter(b=>b!==a&&b.genre===a.genre&&b.state==='live');
    const A=appAttr(a),Ac=rivals.reduce((s,b)=>s+appAttr(b),0),total=rivals.reduce((s,b)=>s+b.users,0)+a.users,sat=clamp(total/(gen.pot*1.6),0,1);
    const mult=(G.month-a.released<=1?2:1)*(a.focus==='growth'?1.3:1)*(a.camp.social?1.15:1)*(a.camp.influencer?1.5:1)*(a.model==='paid'?0.55:1)*(G.ev&&G.ev.feature===a.id?2.5:1);
    let nu=gen.pot*SCOPES[a.scope].pot*0.005*DAYS*(G.dm||1)*(0.25+f.aware*1.2)*A/(A+Ac*0.4+0.3)*(1-sat)*mult;
    if(a.camp.influencer)nu+=gen.pot*0.01*rating(a);if(a.ads>0)nu+=a.ads*W/gen.cpi*(0.5+rating(a));
    const bd=a.bugs/(40+a.users/1500),fr=a.fresh===undefined?1:a.fresh;
    const churnR=Math.min(0.5,DAYS*(0.002+0.012*Math.min(1.5,bd)+0.004*(1-fr)+(a.model==='free'?0.001:0))*(a.focus==='perf'?0.7:1));
    const prev=a.users;a.users=Math.max(0,a.users+nu-a.users*churnR);a.peak=Math.max(a.peak||0,a.users);
    let r=0;if(a.model==='freemium'){a.payers=a.users*0.18*gen.conv*(0.4+0.6*rating(a))*Math.exp(-a.price/8)*(a.focus==='money'?1.25:1);r=a.payers*a.price*0.85*W}
    else if(a.model==='free'){a.payers=0;r=a.users*0.22*gen.adv*(a.focus==='money'?1.15:1)*W}else{a.payers=0;r=nu*a.price*0.85}
    if(G.ev&&G.ev.featureCut===a.id)r*=0.7;
    rev+=r;const sv=a.users*0.05*(has(f,'cloud')?0.6:1)*W;server+=sv;
    const mk=(a.camp.social?CAMPAIGNS.social.cost*W:0)+(a.camp.influencer?CAMPAIGNS.influencer.cost:0)+(a.ads||0)*W;pay(G,f.id,'mkt',mk);
    a.reviews=appReviews(G,a,bd);a.stat={rev:r,new:nu,churn:prev*churnR,server:sv,mk};
    rep.items.push({kind:'app',id:a.id,fid:f.id,icon:gen.icon,name:a.name,firm:f.name,rev:r,profit:r-sv-mk,kpi:fn(a.users)+' Nutzer',delta:Math.round(a.users-prev),stars:Math.round(rating(a)*10)/2});
    a.camp.influencer=false}
  for(const a of mine)if(a.state==='dev')rep.items.push({kind:'dev',id:a.id,fid:f.id,icon:'🛠️',name:a.name,firm:f.name,rev:0,profit:0,kpi:Math.round(a.progress/a.work*100)+' % fertig'});
  earn(G,f.id,'rev',rev);pay(G,f.id,'other',server);
  pay(G,f.id,'staff',(f.jr*wageOf(G,'jr',f)+f.sr*wageOf(G,'sr',f)+f.des*wageOf(G,'des',f)+f.qa*wageOf(G,'qa',f))*W);
  if(f.office){const ctrl=1-0.05*dcov(G,'ctrl');pay(G,f.id,'rent',rentOf(plot(G,f.office))*ctrl*W);let o=(300+desks(G,f)*15)*ctrl;for(const k in f.oups)o+=OFFICE_UPS[k].mon;pay(G,f.id,'other',o*W)}
  const live=mine.filter(a=>a.state==='live');f.rep+=((live.length?live.reduce((s,a)=>s+rating(a),0)/live.length:0.5)-f.rep)*kW(0.3)}
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
  for(const p of f.plants)for(const l of p.lines){if(p.build>0){l.made=0;continue}let out=lineOut(G,f,l);l.broke=false;if(!l.maint&&rand(G)<pW(0.2)){out*=rr(G,0.65,0.9);l.broke=true}if(G.ev&&G.ev.machine===l.id)out*=0.6;
    const m=GOODS[l.product].mat;let cost=0;for(const r in m)cost+=out*m[r]*GMULT[l.grade]*rawPrice(G,r,f);
    pay(G,f.id,null,cost); // Einkauf: Geld wird zu Lagerbestand, Aufwand erst beim Verkauf
    const g=effGrade(f,l),gs=f.goods[l.product]||(f.goods[l.product]={}),b=gs[g]||(gs[g]={q:0,cost:0});b.q+=out;b.cost+=cost;l.made=out;f.made[l.product]=(f.made[l.product]||0)+out}}
function prodSell(G,f){
  const r0=L(G,f.id).rev,c0=L(G,f.id).cogs,bio=f.supplier==='bio'?1.12:1;f.sales={contract:0,brand:0,whole:0};
  for(const c of f.contracts){let left=c.qty-c.done;const gs=f.goods[c.good];if(!gs||left<=0)continue;
    for(let g=c.grade;g<=3&&left>0;g++){const b=gs[g];if(!b||b.q<1)continue;const t=Math.min(Math.floor(b.q),left),uc=b.cost/b.q;b.q-=t;b.cost-=uc*t;c.done+=t;left-=t;
      earn(G,f.id,'rev',t*c.price*bio);f.sales.contract+=t*c.price*bio;L(G,f.id).cogs+=uc*t;pay(G,f.id,'other',t*GOODS[c.good].ship);f.delivered+=t}
    if(c.done>=c.qty){f.rep+=(1-f.rep)*0.06;news(G,f.name+': Auftrag von '+c.buyer+' erfüllt.','good')}}
  f.contracts=f.contracts.filter(c=>{if(c.done>=c.qty)return false;if(ME&&G.month+1>=c.due){const pen=(c.qty-c.done)*c.price*0.15;pay(G,f.id,'other',pen);f.rep=Math.max(0,f.rep-0.08);
    news(G,f.name+': Auftrag von '+c.buyer+' nicht rechtzeitig geliefert. Strafe '+fmtE(pen)+'.','bad');return false}return true});
  if(f.brand){f.brand.aware+=(clamp(0.05+0.9*f.brand.mkt*(1+0.35*dcov(G,'mkt'))/(f.brand.mkt+15000),0,0.95)-f.brand.aware)*kW(0.25);pay(G,f.id,'mkt',f.brand.mkt*W);
    for(const g in f.goods){const q=goodsTotal(f,g)-reserved(f,g);if(q<1)continue;const vol=Math.min(q,GOODS[g].brand*W*f.brand.aware*Object.keys(G.cities).length*(0.5+f.rep));if(vol<1)continue;
      const price=GOODS[g].ref*1.3*bio,sold=takeOwn(f,g,vol);earn(G,f.id,'rev',sold.qty*price);f.sales.brand+=sold.qty*price;L(G,f.id).cogs+=sold.cost}}
  const capS=storageCap(G,f);
  for(const g in f.goods){const q=goodsTotal(f,g),res=reserved(f,g)+(g==='bohnen'||g==='gebaeck'?internalNeed(G,g):0);
    let sell=0;if(f.autoSell)sell=Math.max(0,q-res-(f.made[g]||0)*0.5);const over=goodsTotalAll(f)-capS;if(over>0)sell=Math.max(sell,Math.min(q,over));
    if(sell>=1){const r=sellWholesale(G,f,g,sell,true);f.sales.whole+=r.rev||0}}
  return{rev:L(G,f.id).rev-r0,cogs:L(G,f.id).cogs-c0}}
function reserved(f,g){return f.contracts.filter(c=>c.good===g).reduce((s,c)=>s+c.qty-c.done,0)}
function goodsTotalAll(f){let s=0;for(const g in f.goods)s+=goodsTotal(f,g);return s}
function takeOwn(f,g,qty){const gs=f.goods[g];let got=0,cost=0;for(let k=3;k>=1&&got<qty;k--){const b=gs[k];if(!b||b.q<=0)continue;const t=Math.min(b.q,qty-got),uc=b.cost/b.q;b.q-=t;b.cost-=uc*t;got+=t;cost+=uc*t}return{qty:got,cost}}
function internalNeed(G,g){let n=0;for(const f of G.firms)if(f.branch==='cafe')for(const s of f.shops){const g0=s.stat?s.stat.guests:0;const ms=menuStats(G,f,s);for(const it of ms.items){const P=PRODUCTS[it.k];n+=g0*PER*it.share*(g==='bohnen'?(P.beans||0):(P.piece||0))}}return n}
function wholesalePrice(G,f,g,grade){return GOODS[g].ref*0.86*(1+0.15*(grade-1))*(g==='bohnen'?G.idx.rohkaffee:1)}
function sellWholesale(G,f,g,qty,quiet){const gs=f.goods[g];if(!gs)return{ok:false,msg:'Nichts auf Lager.'};let left=qty,sold=0,rev=0;
  for(let k=1;k<=3&&left>0;k++){const b=gs[k];if(!b||b.q<=0)continue;const t=Math.min(b.q,left),uc=b.cost/b.q;b.q-=t;b.cost-=uc*t;left-=t;sold+=t;rev+=t*wholesalePrice(G,f,g,k);L(G,f.id).cogs+=uc*t}
  earn(G,f.id,'rev',rev);if(!quiet)news(G,f.name+' verkauft '+fn(sold)+' '+GOODS[g].n+' an den Großhandel.','info');return{ok:true,rev,msg:'Verkauft: '+fn(sold)+' '+GOODS[g].n+' für '+fmtE(rev)}}
function prodCosts(G,f,rep,sales){const ctrl=1-0.05*dcov(G,'ctrl');const n=f.plants.length||1;
  for(const p of f.plants){const pl=plot(G,p.plot);if(p.build>0){const r=rentOf(pl)*ctrl*W;pay(G,f.id,'rent',r);rep.items.push({kind:'plant',id:p.id,fid:f.id,plot:p.plot,icon:'🚧',name:'Werk '+cityName(pl.city),firm:f.name,rev:0,profit:-r,kpi:'Im Bau · fertig in '+p.build+(p.build>1?' Wochen':' Woche')});continue}let w=wageOf(G,'worker',f),energy=400;
    for(const l of p.lines){w+=l.workers*wageOf(G,'worker',f)*(l.shifts+(l.shifts>=3?0.15:0));energy+=LINES[l.type].energy*SHIFTS[l.shifts]*(p.ups.solar?0.65:1);if(l.qc)energy+=2500;if(l.maint)energy+=1200}
    for(const k in p.ups)energy+=PLANT_UPS[k].mon;w*=W;energy*=W;pay(G,f.id,'staff',w);pay(G,f.id,'rent',rentOf(pl)*ctrl*W);pay(G,f.id,'other',energy*ctrl);
    const rev=(sales.rev+(f.internal||0))/n,gross=(sales.rev+(f.internal||0)-sales.cogs)/n;
    rep.items.push({kind:'plant',id:p.id,fid:f.id,plot:p.plot,icon:'🏭',name:'Werk '+cityName(pl.city),firm:f.name,rev,profit:gross-w-rentOf(pl)*ctrl*W-energy*ctrl,
      kpi:p.lines.map(l=>fn(l.made)+' '+GOODS[l.product].unit).join(' · ')||'keine Linie',broke:p.lines.some(l=>l.broke)})}}
function canMake(f,g){return f.branch==='prod'&&f.plants.some(p=>p.lines.some(l=>LINES[l.type].cap[g]))}
function genContracts(G){const compN=G.comps.filter(c=>c.branch==='prod').length;
  G.offers.contracts=G.offers.contracts.filter(c=>c.expires>G.month&&firm(G,c.fid));
  for(const f of G.firms)if(f.branch==='prod'){const goods=Object.keys(GOODS).filter(g=>!GOODS[g].res||has(f,GOODS[g].res)),makeable=goods.filter(x=>canMake(f,x));
    const n=2+Math.floor(rand(G)*2);
    for(let k=0;k<n;k++){const g=makeable.length&&rand(G)<0.8?pick(G,makeable):pick(G,goods);const T=LINES[Object.keys(LINES).find(t=>LINES[t].cap[g])];
      const months=1+Math.floor(rand(G)*2),qty=Math.max(10,Math.round(T.cap[g]*30*0.9*months*rr(G,0.3,0.8)*(1+0.5*f.rep)/5)*5),grade=rand(G)<0.5?1:rand(G)<0.7?2:3;
      const price=GOODS[g].ref*rr(G,0.84,1.08)*(1+0.12*(grade-1))*(0.92+0.16*f.rep)*(has(f,'qm')?1.06:1)*(1-0.02*compN)*(g==='bohnen'?G.idx.rohkaffee:1);
      G.offers.contracts.push({id:uid(G),fid:f.id,good:g,qty,grade,price:Math.round(price*100)/100,months,expires:G.month+2,buyer:pick(G,BUYERS[g])})}}
  G.offers.contracts=G.offers.contracts.slice(-10)}

// ---------- Monatsabschluss ----------
// Eine Runde ist eine Woche (W = Anteil am Monat). Die Buchhaltung schließt monatlich ab.
const W=0.25,WEEKS=4;let ME=false;
const kW=k=>1-Math.pow(1-k,W),pW=p=>1-Math.pow(1-p,W);
function ledCopy(l){return JSON.parse(JSON.stringify({f:l.f,H:l.H,cf:l.cf}))}
function ledDiff(a,b){const out={f:{},H:fz(),cf:{op:0,inv:0,fin:0}};for(const id in b.f){const x=fz(),y=b.f[id],z=a.f[id]||fz();for(const k in x)x[k]=(y[k]||0)-(z[k]||0);out.f[id]=x}
  for(const k in out.H)out.H[k]=(b.H[k]||0)-(a.H[k]||0);for(const k in out.cf)out.cf[k]=(b.cf[k]||0)-(a.cf[k]||0);return out}
const BUILD={shop:3,office:2,plant:4,hq:6}; // Wochen
function buildMonth(G,rep){
  for(const f of G.firms){
    for(const s of f.shops||[])if(s.build>0){s.build--;if(!s.build){const p=plot(G,s.plot);s.opened=G.month;if(s.party){s.la=Math.max(s.la||0,0.6);s.rep=Math.min(1,s.rep+0.06)}
      rep.events.push({icon:'🎉',t:'Eröffnung! '+f.name+' öffnet in '+address(p)+(s.party?' mit großer Eröffnungsfeier.':'.')});news(G,f.name+' eröffnet in '+cityName(p.city)+'.','good');
      paper(rep,'handel','Neueröffnung: '+f.name,f.name+' öffnet ein Restaurant in '+address(p)+'.',{logo:{color:f.color,icon:'cafe'}});s.party=false}}
    if(f.officeBuild>0){f.officeBuild--;if(!f.officeBuild)rep.events.push({icon:'🏢',t:f.name+': Das neue Büro ist bezugsfertig.'})}
    for(const pl of f.plants||[])if(pl.build>0){pl.build--;if(!pl.build)rep.events.push({icon:'🏭',t:f.name+': Die Halle in '+cityName(plot(G,pl.plot).city)+' ist eingerichtet, die Produktion läuft an.'})}}
  if(G.hqBuild>0){G.hqBuild--;if(!G.hqBuild){rep.events.push({icon:'🏛️',t:'Die Konzernzentrale ist fertig! Abteilungen und Vorstand arbeiten ab jetzt.'});news(G,'Die Konzernzentrale steht!','good')}}}
function underBuild(G,p){if(!p||!p.owner||p.owner.startsWith('c:'))return 0;if(p.owner==='H')return G.hqBuild||0;const f=firm(G,p.owner);if(!f)return 0;
  if(p.use==='cafe'){const s=f.shops.find(x=>x.plot===p.id);return s&&s.build||0}if(p.use==='office')return f.officeBuild||0;if(p.use==='factory'){const pl=f.plants.find(x=>x.plot===p.id);return pl&&pl.build||0}return 0}
function dayOf(G){return 1+7*(G.week||0)}
function dateStr(G){return dayOf(G)+'. '+MONTHS[G.month%12]+' '+yearOf(G.month)}
function endTurn(G){
  if(G.over)return null;
  for(const e of [...G.pending])decide(G,e.id,EVENTS[e.k].def||0); // offene Entscheidungen bekommen die Standardwahl
  migrate(G);ME=(G.week||0)===WEEKS-1;
  const rep={month:G.month,week:G.week||0,date:dateStr(G),items:[],events:[],goals:[],cash0:G.cash,paper:[],incidents:[]};const led0=ledCopy(G.led);
  delegateMonth(G,rep);mgrMonth(G,rep);
  for(const f of G.firms)f.exec=1+0.06*ex(G,'coo');
  for(const f of G.firms)if(f.branch==='prod'){f.internal=0;prodProduce(G,f)}
  for(const f of G.firms)if(f.branch==='cafe')cafeMonth(G,f,rep);
  for(const f of G.firms)if(f.branch==='soft')softMonth(G,f,rep);
  for(const f of G.firms)if(f.branch==='prod'){const s=prodSell(G,f);prodCosts(G,f,rep,s)}
  for(const f of G.firms){pay(G,f.id,'mkt',f.mkt*W);pay(G,f.id,'staff',adminOf(G,f)*wageOf(G,'admin',f)*W);
    const m=f.mkt*(1+0.35*dcov(G,'mkt'))*(1+0.2*ex(G,'cmo')),cities=f.branch==='cafe'?Math.max(1,new Set(f.shops.map(s=>plot(G,s.plot).city)).size):1;
    const K=(f.branch==='soft'?9000:f.branch==='prod'?3000:2500)*(f.branch==='cafe'?Math.max(1,Math.sqrt(f.shops.length)*0.8)*cities:1);
    f.aware+=(0.06+0.86*m/(m+K)-f.aware)*kW(0.3);
    const load=f.branch==='soft'?Math.max(0,(staffOf(G,f)+(G.founderDev&&f.id===G.firms[0].id?1:0))/desks(G,f)-1):0;
    let perk=0.1*dcov(G,'hr');if(f.branch==='soft')perk+=(f.oups.kitchen?0.08:0)+(f.oups.gaming?0.05:0);if(f.branch==='prod')perk+=f.plants.some(p=>p.ups.kantine)?0.06:0;
    if(f.branch==='cafe'&&f.shops.length)perk+=f.shops.reduce((a,s)=>a+mq(s,'ppl'),0)/f.shops.length*0.06;
    const mt=clamp(0.62+(f.wage-1)*1.6+perk-load*0.6+(f.moraleBoost||0),0.1,1);f.morale+=(mt-f.morale)*kW(0.45);f.moraleBoost=(f.moraleBoost||0)*Math.pow(0.5,W);
    if(f.resCur){f.resCur.left-=(1+dcov(G,'rd'))*W;if(f.resCur.left<=1e-6){const R=RESEARCH[f.branch][f.resCur.k];f.res[f.resCur.k]=true;news(G,f.name+': '+R.n+' fertig entwickelt.','good');rep.events.push({icon:R.icon,t:'Fertig entwickelt: '+R.n+'. '+R.d+'.'});f.resCur=null}}}
  buildMonth(G,rep);privateMonth(G,rep);propertyMonth(G,rep);campaignMonth(G);execMonth(G,rep);
  if(G.hq){let dn=0;for(const k in G.depts)dn+=deptN(G,k);pay(G,'H','staff',(8000+dn*(G.deptWage||60000)/12)*W);pay(G,'H','rent',rentOf(plot(G,G.hq))*W)}
  for(const a of G.assets){const d=Math.min(a.book,a.cost/a.life*W);a.book-=d;L(G,a.fid).dep+=d}G.assets=G.assets.filter(a=>a.book>0.01);
  if(G.cash<0)pay(G,'H','int',-G.cash*0.12/12*W);
  for(const f of G.firms)if(f.morale<0.45&&rand(G)<pW((1-0.5*dcov(G,'hr'))*(0.45-f.morale)*2.5)){const who=quit(G,f);if(who){news(G,f.name+': '+who+' hat gekündigt.','bad');rep.events.push({icon:'🚪',bad:true,t:f.name+': '+who+' hat gekündigt. Die Stimmung ist schlecht.'})}}
  for(const cp of G.comps){if(cp.branch==='cafe'&&rand(G)<pW(0.07)&&G.plots.filter(p=>p.owner==='c:'+cp.id).length<7){const p=compOpen(G,cp);if(p&&G.cities[cp.city]){news(G,cp.name+' eröffnet in '+cityName(cp.city)+'.','comp');rep.events.push({icon:'🏪',t:'Konkurrenz: '+cp.name+' eröffnet ein Restaurant ('+ZONES[p.zone].n+', '+cityName(cp.city)+').'});paper(rep,'handel',cp.name+' wächst weiter','Die Kette eröffnet ein neues Restaurant in '+cityName(cp.city)+' ('+ZONES[p.zone].n+').',{logo:{color:cp.color,icon:'cafe'}})}}}
  let rec=null;
  if(ME){ // Monatsabschluss
    for(const r of ['rohkaffee','holz','mehl'])G.idx[r]=clamp(G.idx[r]*(1+(rand(G)-0.5)*0.07)+(1-G.idx[r])*0.12,0.6,1.7);
    for(const l of G.loans){const i=l.bal*Math.max(0.01,l.rate-0.005*ex(G,'cfo'))/12;pay(G,'H','int',i);const p=Math.min(l.bal,l.pay-i);G.cash-=p;G.led.cf.fin-=p;l.bal-=p}G.loans=G.loans.filter(l=>l.bal>0.5);
    if(G.hedge&&G.hedge.left>0)G.hedge.left--;
    for(const cp of G.comps){if(cp.branch==='cafe'){if(rand(G)<0.05)cp.q=clamp(cp.q+rr(G,-0.03,0.05),0.4,0.9);
        // Reaktion auf starke eigene Restaurants in der Nachbarschaft: Preise runter, sonst langsam zurück
        const theirs=G.plots.filter(p=>p.owner==='c:'+cp.id);let threat=0;for(const f of G.firms)for(const s of f.shops||[]){if(s.build>0||!s.stat)continue;const q=plot(G,s.plot);if(theirs.some(p=>near(p,q))&&s.rep>cp.rep)threat++}
        const old=cp.price;cp.price=threat?Math.max(0.8,cp.price-0.03):Math.min(cp.base||cp.price,cp.price+0.01);if(!cp.base)cp.base=old;
        if(threat&&old>=0.85&&cp.price<0.85)rep.events.push({icon:'🏷️',t:cp.name+' senkt die Preise, um gegen deine Restaurants zu bestehen.'})}compValue(G,cp)}
    for(const a of G.apps)if(a.owner.startsWith('c:')&&a.state==='live')a.users*=1+0.018*(a.quality-0.4)*(1-a.users/GENRES[a.genre].pot);
    if(rand(G)<0.08){const g=pick(G,Object.keys(GENRES)),cp=addComp(G,{branch:'soft',name:pick(G,APP_NAMES)+' '+pick(G,['Labs','Studio','Apps']),color:'#8a8f96',q:rr(G,0.5,0.75)});
      G.apps.push({id:uid(G),owner:'c:'+cp.id,name:pick(G,APP_NAMES),genre:g,scope:'M',state:'live',progress:1,work:1,quality:cp.q,bugs:15,users:5000,payers:0,model:'freemium',price:4.99,fresh:1,released:G.month})}}
  // Steuern laufen kumuliert mit, jede Woche
  const pre=pretax(G.led),yr=Math.floor(G.month/12),ytd=G.months.filter(x=>Math.floor(x.m/12)===yr).reduce((s,x)=>s+x.pre,0)+pre;
  const due=Math.max(0,ytd-G.tax.carry)*(TAX-0.03*ex(G,'cfo')),delta=due-G.tax.paidYTD;if(Math.abs(delta)>0.5){G.cash-=delta;G.led.H.tax+=delta;G.led.cf.op-=delta;G.tax.paidYTD+=delta}
  const wk=ledDiff(led0,G.led),wp=pl(wk);rep.net=wp.net;rep.rev=wp.rev;rep.ebitda=wp.ebitda;rep.cf=wk.cf;
  if(ME){const net=pre-G.led.H.tax;G.retained+=net;
    rec={m:G.month,f:G.led.f,H:G.led.H,cf:G.led.cf,cash:G.cash,pre,net,staff:totalStaff(G)};rec.bal=balance(G);rec.value=valuation(G,rec).total;
    G.months.push(rec);if(G.months.length>60)G.months.shift();
    if(G.month%12===11){if(ytd<0)G.tax.carry+=-ytd;else G.tax.carry=Math.max(0,G.tax.carry-ytd);G.tax.paidYTD=0;rep.events.push({icon:'📘',t:'Jahresabschluss '+yearOf(G.month)+': '+fmtE(G.months.filter(x=>Math.floor(x.m/12)===yr).reduce((s,x)=>s+x.net,0))+' Jahresergebnis.'})}
    G.led=emptyLedger();
    if(G.cash<-dispo(G)){G.insolvT=(G.insolvT||0)+1;rep.events.push({icon:'⚠️',bad:true,t:'Der Dispo ist überzogen ('+G.insolvT+' von 3). Nach drei Monaten im Minus droht die Insolvenz.'});if(G.insolvT>=3)G.over='insolvent'}else G.insolvT=0;
    marketsMonth(G,rep);clubMonth(G,rep);G.me.wh.push(wealth(G).total);if(G.me.wh.length>24)G.me.wh.shift()}
  G.weeks=(G.weeks||[]).concat([{m:G.month,w:G.week||0,rev:rep.rev,net:rep.net,cash:G.cash}]).slice(-26);
  G.week=((G.week||0)+1)%WEEKS;G.ev={};
  if(ME){G.month++;
    if(G.month%12===0){if(!G.rentFreeze)for(const p of G.plots)p.rent=Math.round(p.rent*1.02/10)*10;G.rentFreeze=false}
    const ne=rep.events.length;marketNews(G,rep);for(const e of rep.events.slice(ne))paper(rep,'wirtschaft',e.t.split(':')[0],e.t,{icon:'bank'});
    worldMonth(G,rep,rec);genContracts(G);investorOffer(G,rep);
    if(G.public){const v=valuation(G).total;G.sharePrice=Math.max(0.01,G.sharePrice*0.6+v/G.shares*0.4)*(1+(rand(G)-0.5)*0.08);G.priceHist.push(G.sharePrice);if(G.priceHist.length>48)G.priceHist.shift()}}
  rollEvents(G,rep);
  for(const g of GOALS)if(!G.goals[g.k]&&g.test(G)){G.goals[g.k]=G.month;if(g.reward){G.cash+=g.reward;G.paidIn+=g.reward;G.led.cf.fin+=g.reward}rep.goals.push(g);news(G,'Ziel erreicht: '+g.n,'ms')}
  rep.cash=G.cash;rep.value=valuation(G).total;rep.staff=totalStaff(G);rep.stage=stage(G).n;rep.monthEnd=ME;
  frontPage(G,rep,rec);G.report=rep;return rep}
function quit(G,f){if(f.branch==='cafe'){const s=f.shops.filter(s=>s.staff>1).sort((a,b)=>b.staff-a.staff)[0];if(s){s.staff--;return'eine Servicekraft'}}
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
  blogger:{branch:'cafe',icon:'📸',when:(G,f)=>f.shops.length,make:(G,f)=>{const s=pick(G,f.shops);return{ref:s.id,t:'Die Food-Bloggerin @emdenisst möchte deine Filiale ('+shopName(G,s)+') testen. 40.000 Menschen lesen mit.'}},
    opts:[{n:'Einladen und groß auftischen',d:'Kostet 300 €. Meistens gibt es einen begeisterten Artikel.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);pay(G,f.id,'mkt',300);if(!s)return'';if(rand(G)<0.75){s.rep=Math.min(1,s.rep+0.1);f.aware=Math.min(1,f.aware+0.05);return'Begeisterter Artikel! Ruf und Bekanntheit steigen.'}s.rep-=0.03;return'Der Artikel ist lauwarm: „Nett, aber zu bemüht.“'}},
      {n:'Ganz normal bedienen',d:'Was zählt, ist der echte Eindruck.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);if(!s)return'';if(s.rep>0.7){s.rep=Math.min(1,s.rep+0.08);f.aware=Math.min(1,f.aware+0.04);return'„Ehrlich gut!“ Der Artikel macht die Runde.'}s.rep-=0.06;return'Der Artikel ist kritisch, der Ruf leidet.'}}],def:1},
  rent:{branch:'cafe',icon:'🏠',when:(G,f)=>f.shops.length,make:(G,f)=>{const s=pick(G,f.shops);return{ref:s.id,t:'Der Vermieter deiner Filiale ('+shopName(G,s)+') will die Miete um 8 % erhöhen.'}},
    opts:[{n:'Akzeptieren',d:'+8 % Miete.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);if(s){const p=plot(G,s.plot);p.rent=Math.round(p.rent*1.08)}return'Die Miete steigt um 8 %.'}},
      {n:'Hart verhandeln',d:'Klappt es, nur +3 %. Sonst +12 %.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);if(!s)return'';const p=plot(G,s.plot);if(rand(G)<0.5){p.rent=Math.round(p.rent*1.03);return'Verhandlung gewonnen: nur +3 %.'}p.rent=Math.round(p.rent*1.12);return'Der Vermieter bleibt hart: +12 %.'}}],def:0},
  raise:{icon:'💬',when:(G,f)=>staffOf(G,f)>=3,make:(G,f)=>({t:'Das Team von '+f.name+' wünscht sich mehr Gehalt. Die Stimmung ist angespannt.'}),
    opts:[{n:'Gehälter um 5 % erhöhen',d:'Dauerhaft teurer, deutlich bessere Stimmung.',run:(G,f)=>{f.wage=Math.min(1.4,f.wage+0.05);f.moraleBoost=0.1;return'Das Team freut sich.'}},
      {n:'Einmaliger Bonus',d:'500 € pro Kopf.',run:(G,f)=>{const n=staffOf(G,f);pay(G,f.id,'staff',n*500);f.moraleBoost=0.06;return'Bonus ausgezahlt: '+fmtE(n*500)+'.'}},
      {n:'Ablehnen',d:'Spart Geld, kostet Stimmung.',run:(G,f)=>{f.morale=Math.max(0.1,f.morale-0.12);return'Die Stimmung sinkt deutlich.'}}],def:2},
  fest:{branch:'cafe',icon:'🎪',when:(G,f)=>f.shops.length&&summer(G),make:(G,f)=>{const s=pick(G,f.shops);return{ref:s.id,t:'Nächste Woche ist Stadtfest direkt vor deiner Filiale ('+shopName(G,s)+'). Ein Außenstand kostet 1.500 €.'}},
    opts:[{n:'Stand aufbauen',d:'+35 % Gäste. Plane genug Personal ein!',run:(G,f,e)=>{pay(G,f.id,'mkt',1500);G.ev.fest=e.ref;return'Der Stand steht.'}},{n:'Nicht mitmachen',d:'',run:()=>'Das Fest zieht vorbei.'}],def:1},
  youtube:{branch:'cafe',icon:'🎥',when:(G,f)=>f.shops.length,make:(G,f)=>{const s=pick(G,f.shops);return{ref:s.id,t:'Ein YouTuber möchte seine Videos in deiner Filiale ('+shopName(G,s)+') aufnehmen. Er scheint im Netz sehr beliebt zu sein. Sollen wir es erlauben?'}},
    opts:[{n:'Klar, solange er niemanden stört',d:'Mehr Bekanntheit, manche Stammgäste nervt das.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);f.aware=Math.min(1,f.aware+0.04);if(s){s.la=Math.min(1,(s.la||0)+0.15);if(rand(G)<0.3){s.rep-=0.03;return'Die Videos laufen gut, aber einige Gäste fühlen sich gestört.'}}return'Das Video geht viral, die Filiale ist im Gespräch.'}},
      {n:'Nein, kein Medienrummel',d:'Alles bleibt ruhig.',run:()=>'Der YouTuber zieht weiter.'}],def:1},
  hack:{branch:'soft',icon:'🛡️',when:(G,f)=>G.apps.some(a=>a.owner===f.id&&a.state==='live'),make:(G,f)=>{const a=pick(G,G.apps.filter(a=>a.owner===f.id&&a.state==='live'));return{ref:a.id,t:'Sicherheitslücke in „'+a.name+'“ entdeckt! Noch weiß niemand davon.'}},
    opts:[{n:'Externe Spezialisten',d:'8.000 €, sofort behoben.',run:(G,f)=>{pay(G,f.id,'other',8000);return'Lücke geschlossen, bevor jemand etwas merkt.'}},
      {n:'Selbst fixen',d:'Kostet Arbeitszeit: +40 Bugs.',run:(G,f,e)=>{const a=G.apps.find(x=>x.id===e.ref);if(a)a.bugs+=40;return'Das Team stopft die Lücke, anderes bleibt liegen.'}},
      {n:'Ignorieren',d:'Riskant.',run:(G,f,e)=>{const a=G.apps.find(x=>x.id===e.ref);if(a&&rand(G)<0.45){a.users*=0.8;a.bugs+=60;return'Die Lücke wird ausgenutzt! 20 % der Nutzer sind weg.'}return'Glück gehabt, niemand hat es bemerkt.'}}],def:2},
  poach:{branch:'soft',icon:'🎯',when:(G,f)=>f.sr>0,make:(G,f)=>({t:'Ein Großkonzern will deinen besten Senior-Entwickler abwerben.'}),
    opts:[{n:'Gegenangebot',d:'Einmalig 6.000 €.',run:(G,f)=>{pay(G,f.id,'staff',6000);return'Er bleibt.'}},{n:'Ziehen lassen',d:'Ein Senior weniger.',run:(G,f)=>{f.sr=Math.max(0,f.sr-1);return'Er geht.'}}],def:1},
  feature:{branch:'soft',icon:'⭐',when:(G,f)=>G.apps.some(a=>a.owner===f.id&&a.state==='live'),make:(G,f)=>{const a=pick(G,G.apps.filter(a=>a.owner===f.id&&a.state==='live'));return{ref:a.id,t:'Der App-Store bietet „'+a.name+'“ nächste Woche einen Platz auf der Startseite an, gegen 30 % des Umsatzes.'}},
    opts:[{n:'Annehmen',d:'Zweieinhalbmal so viele neue Nutzer.',run:(G,f,e)=>{G.ev.feature=e.ref;G.ev.featureCut=e.ref;return'Deine App steht ganz vorne.'}},{n:'Ablehnen',d:'',run:()=>'Vielleicht beim nächsten Mal.'}],def:1},
  bigorder:{branch:'prod',icon:'📦',when:(G,f)=>f.plants.some(p=>p.lines.length),make:(G,f)=>{const g=pick(G,Object.keys(GOODS).filter(x=>canMake(f,x)));const q=Math.round(LINES[Object.keys(LINES).find(t=>LINES[t].cap[g])].cap[g]*30*0.6/5)*5;return{ref:g,qty:q,t:pick(G,BUYERS[g])+' braucht dringend '+fn(q)+' '+GOODS[g].n+' im nächsten Monat, zu 25 % über Marktpreis.'}},
    opts:[{n:'Zusagen',d:'Bei Verzug 15 % Strafe.',run:(G,f,e)=>{f.contracts.push({id:uid(G),good:e.ref,qty:e.qty,grade:1,price:Math.round(GOODS[e.ref].ref*1.25*100)/100,due:G.month+1,done:0,buyer:'Eilauftrag'});return'Eilauftrag angenommen.'}},{n:'Absagen',d:'',run:()=>'Der Kunde sucht weiter.'}],def:1},
  machine:{branch:'prod',icon:'🔧',when:(G,f)=>f.plants.some(p=>p.lines.length),make:(G,f)=>{const l=pick(G,f.plants.flatMap(p=>p.lines));return{ref:l.id,t:'Die '+LINES[l.type].n+' macht seltsame Geräusche. Ein Lager ist verschlissen.'}},
    opts:[{n:'Sofort reparieren',d:'6.000 €.',run:(G,f)=>{pay(G,f.id,'other',6000);return'Repariert.'}},{n:'Weiterlaufen lassen',d:'Nächste Woche −40 % Ausstoß.',run:(G,f,e)=>{G.ev.machine=e.ref;return'Die Linie läuft im Notbetrieb.'}}],def:1},
  hedge:{branch:'prod',icon:'🤝',when:(G,f)=>f.plants.some(p=>p.lines.length)&&!(G.hedge&&G.hedge.left>0),make:(G,f)=>{const r=pick(G,[...new Set(f.plants.flatMap(p=>p.lines.flatMap(l=>Object.keys(GOODS[l.product].mat))))]);return{ref:r,t:'Ein Händler bietet '+RAW[r].n+' für sechs Monate zum Festpreis, 8 % unter dem heutigen Preis.'}},
    opts:[{n:'Festpreis sichern',d:'Schützt vor Preissprüngen.',run:(G,f,e)=>{G.hedge={raw:e.ref,idx:G.idx[e.ref]*0.92,left:6};return'Festpreis für 6 Monate gesichert.'}},{n:'Am Markt bleiben',d:'',run:()=>'Du kaufst weiter zum Tagespreis.'}],def:1},
  grant:{icon:'🏛️',when:(G,f)=>totalStaff(G)<60&&f.id===G.firms[0].id,make:()=>({t:'Das Land fördert Digitalisierung mit 10.000 €. Der Antrag kostet 500 € Beratung.'}),
    opts:[{n:'Antrag stellen',d:'70 % Chance.',run:(G,f)=>{pay(G,f.id,'other',500);if(rand(G)<0.7){G.cash+=10000;G.paidIn+=10000;G.led.cf.fin+=10000;return'Bewilligt! 10.000 € Zuschuss.'}return'Leider abgelehnt.'}},{n:'Keine Zeit',d:'',run:()=>'Vielleicht nächstes Jahr.'}],def:1},
  buyout:{branch:'cafe',icon:'🤝',when:(G,f)=>f.shops.filter(s=>!s.build).length>=2&&G.comps.some(c=>c.branch==='cafe'),make:(G,f)=>{const s=pick(G,f.shops.filter(x=>!x.build)),cp=pick(G,G.comps.filter(c=>c.branch==='cafe')),v=Math.round(((s.stat?Math.max(0,s.stat.profit)*4*12*3:0)+LEVELS[s.level].cost+40000)/1000)*1000;
      return{ref:s.id,cp:cp.id,amt:v,t:cp.name+' möchte dein Restaurant in '+shopName(G,s)+' übernehmen und bietet '+fmtE(v)+'.'}},
    opts:[{n:'Verkaufen',d:'Geld sofort, das Restaurant geht an die Konkurrenz.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref),cp=G.comps.find(c=>c.id===e.cp);if(!s||!cp)return'Das Angebot ist verfallen.';const p=plot(G,s.plot);
        const book=G.assets.filter(a=>a.ref==='shop:'+p.id).reduce((a,x)=>a+x.book,0);G.assets=G.assets.filter(a=>a.ref!=='shop:'+p.id);earn(G,f.id,null,e.amt,'inv');L(G,f.id).other+=book-e.amt;
        f.shops=f.shops.filter(x=>x!==s);p.owner='c:'+cp.id;p.use='cafe';return'Verkauft für '+fmtE(e.amt)+'. '+cp.name+' übernimmt das Restaurant.'}},{n:'Ablehnen',d:'Das Restaurant bleibt deins.',run:()=>'Du lehnst ab.'}],def:1},
  inspect:{branch:'cafe',icon:'🧪',when:(G,f)=>f.shops.some(s=>!s.build),make:(G,f)=>{const s=pick(G,f.shops.filter(x=>!x.build));return{ref:s.id,t:'Das Gesundheitsamt kündigt eine Hygienekontrolle in '+shopName(G,s)+' an.'}},
    opts:[{n:'Grundreinigung vorher',d:'800 €, sicher bestanden.',run:(G,f)=>{pay(G,f.id,'other',800);return'Kontrolle ohne Beanstandung.'}},{n:'Es wird schon passen',d:'Kostet nichts. Riskant.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);if(s&&rand(G)<0.35){pay(G,f.id,'other',2500);s.rep-=0.08;return'Mängel gefunden: 2.500 € Bußgeld, der Ruf leidet.'}return'Bestanden, Glück gehabt.'}}],def:1},
  critic:{branch:'cafe',icon:'🍷',when:(G,f)=>f.shops.some(s=>!s.build&&s.level>=2),make:(G,f)=>{const s=pick(G,f.shops.filter(x=>!x.build&&x.level>=2));return{ref:s.id,t:'Ein bekannter Restaurantkritiker hat einen Tisch in '+shopName(G,s)+' reserviert.'}},
    opts:[{n:'Chef kocht selbst, bestes Menü',d:'1.000 € Extrazutaten.',run:(G,f,e)=>{pay(G,f.id,'cogs',1000);const s=f.shops.find(x=>x.id===e.ref);if(s){const ok=s.rep+rand(G)*0.3>0.75;s.rep=clamp(s.rep+(ok?0.1:-0.02),0,1);f.aware=Math.min(1,f.aware+(ok?0.06:0));return ok?'Glänzende Kritik! Ruf und Bekanntheit steigen.':'Die Kritik ist höflich, aber kühl.'}return''}},
      {n:'Ganz normal',d:'Was zählt, ist der Alltag.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);if(s&&s.rep>0.8){s.rep=Math.min(1,s.rep+0.06);return'„Ehrliche, gute Küche.“ Schöne Kritik.'}if(s)s.rep-=0.05;return'Die Kritik fällt mäßig aus.'}}],def:1},
  noise:{branch:'cafe',icon:'🔊',when:(G,f)=>f.shops.some(s=>!s.build&&(s.hours==='long'||s.ups.terrasse)),make:(G,f)=>{const s=pick(G,f.shops.filter(x=>!x.build&&(x.hours==='long'||x.ups.terrasse)));return{ref:s.id,t:'Nachbarn von '+shopName(G,s)+' beschweren sich über Lärm am späten Abend.'}},
    opts:[{n:'Schallschutz einbauen',d:'3.000 €.',run:(G,f)=>{pay(G,f.id,'other',3000);return'Ruhe im Viertel.'}},{n:'Früher schließen',d:'Öffnungszeiten auf Standard.',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);if(s)s.hours='normal';return'Das Restaurant schließt jetzt um 22 Uhr.'}},{n:'Ignorieren',d:'Kann teuer werden.',run:(G,f)=>{if(rand(G)<0.4){pay(G,f.id,'other',1500);return'Das Ordnungsamt verhängt 1.500 € Bußgeld.'}return'Die Beschwerden verlaufen im Sand.'}}],def:2},
  viral:{branch:'cafe',icon:'📱',when:(G,f)=>f.shops.some(s=>!s.build),make:(G,f)=>{const s=pick(G,f.shops.filter(x=>!x.build));return{ref:s.id,t:'Ein Video über ein Gericht aus '+shopName(G,s)+' geht im Netz viral. Sollen wir es aufgreifen?'}},
    opts:[{n:'Aktionswoche mit dem Gericht',d:'1.200 € Werbung, viel mehr Gäste.',run:(G,f,e)=>{pay(G,f.id,'mkt',1200);const s=f.shops.find(x=>x.id===e.ref);if(s){s.la=Math.min(1,(s.la||0)+0.4);f.aware=Math.min(1,f.aware+0.05)}return'Die Schlange reicht um die Ecke!'}},{n:'Laufen lassen',d:'',run:(G,f,e)=>{const s=f.shops.find(x=>x.id===e.ref);if(s)s.la=Math.min(1,(s.la||0)+0.15);return'Ein paar Neugierige kommen vorbei.'}}],def:1},
  outage:{branch:'soft',icon:'🔌',when:(G,f)=>G.apps.some(a=>a.owner===f.id&&a.state==='live'),make:(G,f)=>({t:'Der Cloud-Anbieter meldet eine Störung. Eure Apps sind teilweise nicht erreichbar.'}),
    opts:[{n:'Notfall-Umzug auf zweiten Anbieter',d:'5.000 €.',run:(G,f)=>{pay(G,f.id,'other',5000);return'Nach zwei Stunden läuft wieder alles.'}},{n:'Abwarten',d:'Einige Nutzer springen ab.',run:(G,f)=>{for(const a of G.apps)if(a.owner===f.id)a.users*=0.96;return'Einen Tag Ausfall, 4 % der Nutzer sind weg.'}}],def:1},
  supply:{branch:'prod',icon:'🚚',when:(G,f)=>f.plants.some(p=>p.lines.length),make:(G,f)=>({t:'Ein Zulieferer hat Lieferprobleme. Rohstoffe werden diese Woche knapp.'}),
    opts:[{n:'Teuer nachkaufen',d:'3.500 € Aufschlag.',run:(G,f)=>{pay(G,f.id,'cogs',3500);return'Die Linien laufen weiter.'}},{n:'Produktion drosseln',d:'Eine Linie steht eine Woche.',run:(G,f)=>{const l=f.plants.flatMap(p=>p.lines)[0];if(l)G.ev.machine=l.id;return'Eine Linie läuft im Notbetrieb.'}}],def:1},
  audit:{icon:'🧾',when:(G,f)=>G.months.length>6&&f.id===G.firms[0].id,make:()=>({t:'Das Finanzamt kündigt eine Betriebsprüfung an.'}),
    opts:[{n:'Steuerberater einschalten',d:'4.000 €, alles sauber.',run:(G,f)=>{pay(G,'H','other',4000);return'Die Prüfung verläuft ohne Befund.'}},{n:'Selbst vorbereiten',d:'Spart Geld, vielleicht Nachzahlung.',run:(G,f)=>{if(rand(G)<0.4){const amt=Math.round(rr(G,3000,12000)/100)*100;pay(G,'H','other',amt);return'Nachzahlung: '+fmtE(amt)+'.'}return'Alles in Ordnung.'}}],def:0},
  teamday:{icon:'🎳',when:(G,f)=>staffOf(G,f)>=8,make:(G,f)=>({t:'Das Team von '+f.name+' wünscht sich einen gemeinsamen Ausflug.'}),
    opts:[{n:'Teamtag spendieren',d:'60 € pro Kopf, bessere Stimmung.',run:(G,f)=>{const n=staffOf(G,f);pay(G,f.id,'staff',n*60);f.moraleBoost=(f.moraleBoost||0)+0.1;return'Der Ausflug war ein voller Erfolg.'}},{n:'Nicht jetzt',d:'',run:(G,f)=>{f.morale=Math.max(0.1,f.morale-0.03);return'Etwas Enttäuschung im Team.'}}],def:1},
  press:{icon:'📰',when:(G,f)=>G.months.length>3,make:(G,f)=>({t:'Ein Wirtschaftsmagazin will ein Porträt über '+f.name+' bringen.'}),
    opts:[{n:'Interview geben',d:'Mehr Bekanntheit.',run:(G,f)=>{f.aware=Math.min(1,f.aware+0.06);return'Schöner Artikel, die Bekanntheit steigt.'}},{n:'Absagen',d:'',run:()=>'Kein Artikel.'}],def:0}};
function shopName(G,s){const p=plot(G,s.plot);return ZONES[p.zone].n+', '+cityName(p.city)}
function rollEvents(G,rep){G.pending=[];if(G.months.length<1&&(G.week||0)<2)return;const n=rand(G)<0.3?1:rand(G)<0.05?2:0;
  for(let i=0;i<n;i++){const opts=[];for(const k in EVENTS){const E=EVENTS[k];for(const f of G.firms){if(E.branch&&E.branch!==f.branch)continue;if(E.when(G,f))opts.push([k,f])}}
    if(!opts.length)return;const [k,f]=pick(G,opts);if(G.pending.some(e=>e.k===k))continue;G.pending.push(Object.assign({id:uid(G),k,fid:f.id,icon:EVENTS[k].icon},EVENTS[k].make(G,f)))}
  mgrIncidents(G,rep)}
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
  const debt=G.loans.reduce((s,l)=>s+l.bal,0),cap=Math.max(60000,e*3.5,balance(G).fixed*0.6)-debt,rate=Math.max(0.02,0.055+clamp(debt/Math.max(1,e),0,6)*0.004+((G.macro?G.macro.rate:0.025)-0.025));
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
function propertyMonth(G,rep){if(ME)G.re=clamp((G.re||1)*(1+(rand(G)-0.45)*0.02),0.7,1.6);let inc=0,cost=0;
  for(const p of G.plots)if(p.prop==='H'){const i=propIncome(G,p)*W;inc+=i;cost+=propValue(G,p)*0.0012*W;p.lastInc=i/W}
  if(inc)earn(G,'H','rev',inc);if(cost)pay(G,'H','other',cost);
  if(inc||cost)rep.items.push({kind:'re',icon:'🏢',name:'Immobilien',firm:'Holding',rev:inc,profit:inc-cost,kpi:G.plots.filter(p=>p.prop==='H').length+' Gebäude'})}
// ---------- Werbeagentur: Kampagnen je Stadt ----------
const CITY_CAMPS={plakat:{n:'Plakat-Anzeigen',icon:'🪧',cost:8000,boost:0.18,d:'Große Plakate an den Hauptstraßen.'},radio:{n:'Radiowerbung',icon:'📻',cost:12000,boost:0.22,d:'Spots im Morgenradio.'},
  kino:{n:'Kinowerbung',icon:'🎬',cost:5000,boost:0.1,d:'Vor jedem Film im Stadtkino.'},tv:{n:'Regional-TV',icon:'📺',cost:40000,boost:0.4,d:'Werbung im Regionalfernsehen.'}};
function campaignMonth(G){for(const f of G.firms){if(!f.camps)continue;f.cityAw=f.cityAw||{};
  for(const c in f.camps){let b=0,cost=0;for(const k in f.camps[c])if(f.camps[c][k]){b+=CITY_CAMPS[k].boost;cost+=CITY_CAMPS[k].cost}
    const t=clamp(b*(1+0.35*dcov(G,'mkt'))*(1+0.2*ex(G,'cmo')),0,0.98);f.cityAw[c]=(f.cityAw[c]||0)+(t-(f.cityAw[c]||0))*kW(0.35);if(cost)pay(G,f.id,'mkt',cost*W)}}}
// ---------- Vorstand: Menschen mit Fähigkeiten, Gehalt, Loyalität und Aktienzuschüssen ----------
const EXECS={
  coo:{n:'COO',long:'Chief Operating Officer',de:'Operative Geschäftsführung',icon:'⚙️',salary:180000,d:'Mehr Produktivität in allen Firmen',dept:'hr',
    deleg:{shops:'Filialbetrieb delegieren',hrl:'Gehälter und Stimmung delegieren',dept:'Personalabteilung delegieren'}},
  cfo:{n:'CFO',long:'Chief Financial Officer',de:'Leitung Finanzen',icon:'📈',salary:180000,d:'Weniger Zinsen und Steuern',dept:'ctrl',
    deleg:{bank:'Bankfinanzierung delegieren',re:'Immobilienverwaltung delegieren',dept:'Controlling delegieren'}},
  cmo:{n:'CMO',long:'Chief Marketing Officer',de:'Leitung Marketing',icon:'📣',salary:160000,d:'Alle Werbung wirkt stärker',dept:'mkt',
    deleg:{mkt:'Unternehmensmarketing delegieren',dept:'Marketingabteilung delegieren'}},
  cto:{n:'CTO',long:'Chief Technology Officer',de:'Technische Leitung',icon:'🧠',salary:170000,d:'Mehr Entwicklungsleistung',dept:'rd',
    deleg:{apps:'App-Pflege delegieren',dept:'Forschungsabteilung delegieren'}},
  cpo:{n:'CPO',long:'Chief Product Officer',de:'Leitung Produkt',icon:'🧪',salary:170000,d:'Bessere Gerichte und Apps',
    deleg:{price:'Preisgestaltung delegieren'}}};
const FIRST={f:['Sofia','Emilia','Lea','Mia','Hannah','Clara','Ida','Mila','Lina','Aylin','Greta','Nora','Yuki','Amira'],m:['Emil','Moritz','Ole','Aaron','Jonas','Lukas','Felix','Noah','Paul','Ben','Karim','Mehmet','Sven','Tariq']};
const LAST=['Zimmermann','Müller','Lorenz','Cruz','Tang','Schulz','Yilmaz','Petersen','Hansen','Wagner','Becker','Nowak','Albrecht','Kaya','Vogel','Brandt','Okafor','Sato'];
const JOBS=['Leitender Direktor für Kundenbeziehungen','Bereichsleitung Finanzen','Head of Growth','Vice President Operations','Technischer Direktor','Leitung Produktmanagement','Partner einer Beratung','Geschäftsführung Vertrieb'];
const EMPLOYERS=['Ein mittelgroßes Unternehmen','Ein Großkonzern','Ein schnell wachsendes Start-up','Eine Unternehmensberatung','Ein Familienunternehmen'];
const BOARD_Q=3; // die Vorstandssitzung findet jedes Quartal statt
function person(G){const g=rand(G)<0.5?'f':'m';return{name:pick(G,FIRST[g])+' '+pick(G,LAST),g,look:(rand(G)*1e6)|0,
  lead:Math.round(rr(G,45,92)),exp:Math.round(rr(G,45,92)),loy:Math.round(rr(G,50,90))}}
function marketPay(G,k){const v=valuation(G).total,sc=clamp(Math.log10(Math.max(1e5,v))-5,0,3);return Math.round(EXECS[k].salary*(0.7+0.3*sc)/10000)*10000}
function cands(G,k){if(!G.cands||G.cands.k!==k||G.cands.m!==G.month){const mp=marketPay(G,k),list=[];
    for(let i=0;i<4;i++){const c=person(G);c.job=pick(G,JOBS);c.at=pick(G,EMPLOYERS);c.cur=Math.round(mp*(0.65+0.45*(c.lead+c.exp)/184)/10000)*10000;c.demand=c.cur;list.push(c)}
    G.cands={k,m:G.month,list}}return G.cands.list}
// Stärke einer Führungskraft: 0 ohne, um 1 bei mittleren Fähigkeiten
function ex(G,k){const e=G.execs&&G.execs[k];if(!e||G.hqBuild>0)return 0;if(e===true)return 1;return(0.4+e.exp/100*0.85)*(0.8+e.lead/100*0.3)}
function grantValue(G,gr,unvestedOnly){const left=unvestedOnly?gr.n*(1-(gr.vested||0)/4):gr.n,px=G.sharePrice||0;return gr.type==='rsu'?left*px:left*Math.max(0,px-gr.strike)}
// ältere Spielstände ergänzen
function migrate(G){
  if(!G.me)G.me={cash:10000,salary:36000,stocks:{},lux:[],club:null};if(!G.me.loc)G.me.loc=G.cityCur||'kiel';if(!G.me.wh)G.me.wh=[];if(G.me.look===undefined)G.me.look=(G.rs>>>3)%100000;
  if(G.me.club&&!G.me.club.players)initClub(G,CLUBS.find(x=>x.id===G.me.club.id),G.me.club);if(!G.execs)G.execs={};if(!G.re)G.re=1;if(!G.stocks)genMarket(G);
  for(const k in G.execs){const e=G.execs[k];if(e===true){const p=person(G);G.execs[k]=Object.assign(p,{since:G.month,salary:marketPay(G,k),deleg:{},grants:[]})}else if(!e)delete G.execs[k]}
  for(const k in G.depts)if(G.depts[k]===true)G.depts[k]=dneed(G);
  if(!G.macro)G.macro={rate:0.025,gdp:0.012,infl:0.02};if(!G.dues)G.dues=[];if(G.divPS===undefined)G.divPS=0;if(!G.deptWage)G.deptWage=60000;
  BR=G.firms[0]?G.firms[0].branch:'cafe';if(!G.currency)G.currency='EUR';CUR=CURS[G.currency]||'€';if(!G.dm)G.dm=1;for(const f of G.firms)if(f.branch==='cafe'){if(f.uniform===undefined)f.uniform=true;if(!f.recipe)f.recipe={wuerze:0.5,frische:0.5,portion:0.5}}
  for(const cp of G.comps)if(!cp.qrev)cp.qrev=[];if(G.me.club){const C=CLUBS.find(x=>x.id===G.me.club.id);if(C)G.me.club.n=C.n}for(const st of G.stocks||[]){const d=STOCKS.find(x=>x[0]===st.tk);if(d)st.n=d[1]}for(const l of G.me.lux)if(l.k==='wein')l.n=LUX.wein.n;mgrMigrate(G);for(const f of G.firms)if(f.branch==='cafe'&&!(f.menu&&f.menu.pasta)){f.menu={};for(const k in PRODUCTS)f.menu[k]={on:['pasta','pizza','salat','limo','espresso','tiramisu'].includes(k),q:k==='limo'?1:2,price:PRODUCTS[k].ref};for(const s of f.shops)s.special=null}}
function econ(G){return 1+clamp(G.macro?G.macro.gdp:0.012,-0.04,0.05)*2-0.024}
// monatlich: Gehälter, Loyalität, Vesting, Rücktritte
function execMonth(G,rep){
  for(const k of Object.keys(G.execs)){const e=G.execs[k],E=EXECS[k];pay(G,'H','staff',e.salary/12*W);
    const unv=(e.grants||[]).reduce((s,g)=>s+grantValue(G,g,true),0),mp=marketPay(G,k);
    const target=clamp(55+60*(e.salary/mp-1)+20*Math.min(1,unv/Math.max(1,e.salary))+(G.months.length&&G.months[G.months.length-1].net>0?5:-5),5,100);
    e.loy=clamp(e.loy+(target-e.loy)*kW(0.08)+gauss(G)*0.6,0,100);
    for(const g of ME?e.grants||[]:[]){const age=G.month-g.m;if(age>0&&age%12===0&&(g.vested||0)<4){g.vested=(g.vested||0)+1;const part=Math.round(g.n/4),px=G.sharePrice||0;
      if(g.type==='rsu'||px>g.strike){if(g.type!=='rsu')equity(G,part*g.strike);G.owner*=G.shares/(G.shares+part);G.shares+=part;
        rep.events.push({icon:'📜',t:e.name+' ('+E.n+'): '+fn(part)+' Aktien unverfallbar'+(g.type==='rsu'?'.':', Option ausgeübt zu '+fmtE(g.strike,2)+'.')+' Dein Anteil sinkt leicht.'})}
      else rep.events.push({icon:'📜',t:e.name+' ('+E.n+'): '+fn(part)+' Optionen verfallen, der Kurs liegt unter '+fmtE(g.strike,2)+'.'})}}
    const quit=e.loy<40&&rand(G)<pW((40-e.loy)/120),poached=!quit&&e.exp>80&&rand(G)<pW(0.006);
    if(quit||poached){delete G.execs[k];const t=G.firms[0].name+' '+E.n+' zurückgetreten';news(G,t,'bad');
      rep.incidents.push({kind:'firm',title:'Vorfall im Unternehmen',t:e.name+' ('+E.long+') hat mit sofortiger Wirkung gekündigt'+(poached?', abgeworben von einem Großkonzern.':'. Die Loyalität war zu gering.')+' Du kannst unter Konzern → Zentrale neu besetzen.'});
      paper(rep,'top',t,G.firms[0].name+' gab bekannt, dass '+e.name+' von der Position des '+E.n+' zurückgetreten ist und das Unternehmen mit sofortiger Wirkung verlassen hat.',{person:{g:e.g,look:e.look},logo:{color:G.firms[0].color,icon:G.firms[0].branch}})}}}
// Delegation: die Führungskräfte entscheiden selbst
function delegateMonth(G,rep){const done=[];const D=(k,d)=>G.execs[k]&&G.execs[k].deleg&&G.execs[k].deleg[d];
  if(D('coo','shops'))for(const f of G.firms)if(f.branch==='cafe')for(const s of f.shops){const fc=shopForecast(G,f,s),per=fc.cap/Math.max(1,s.staff);
    const want=clamp(Math.ceil(fc.dem*1.08/Math.max(1,per)),1,Math.max(2,Math.floor(plot(G,s.plot).size/12)));if(want!==s.staff){const r=A.shop(G,s.id,{staff:want});if(r.ok)done.push('Personal in '+shopName(G,s)+': '+want)}}
  if(D('coo','hrl'))for(const f of G.firms)if(f.morale<0.55&&f.wage<1.3){f.wage=Math.round((f.wage+0.03)*100)/100;done.push(f.name+': Gehälter +3 %')}
  if(D('cfo','bank')){if(G.cash<0){const o=loanOffer(G),need=Math.min(o.max,Math.ceil((-G.cash+20000)/10000)*10000);if(need>0){takeLoan(G,{amount:need,rate:o.rate,months:60,name:'Bankkredit (CFO)'});done.push('Kredit über '+fmtE(need))}}
    else{const l=G.loans.slice().sort((a,b)=>b.rate-a.rate)[0],ms=G.months.slice(-1)[0],burn=ms?Math.abs(sumF(ms,'staff'))+50000:50000;if(l&&G.cash-l.bal>burn*3){G.cash-=l.bal;G.led.cf.fin-=l.bal;l.bal=0;G.loans=G.loans.filter(x=>x.bal>0);done.push('Kredit „'+l.name+'“ getilgt')}}}
  if(D('cfo','re'))for(const p of G.plots)if(p.prop==='H'&&!p.owner){let best=p.leaseR||1,bi=0;for(let r=0.5;r<=1.6001;r+=0.05){const v=r*leaseOcc(Object.assign({},p,{leaseR:r}));if(v>bi){bi=v;best=Math.round(r*100)/100}}if(best!==p.leaseR){p.leaseR=best;done.push('Miete angepasst')}}
  if(D('cmo','mkt')){const last=G.months.slice(-1)[0];if(last)for(const f of G.firms){const r=(last.f[f.id]||{}).rev||0,t=Math.round(Math.max(500,r*0.05)/100)*100;if(Math.abs(t-f.mkt)>f.mkt*0.15){f.mkt=t;done.push(f.name+': Werbung '+fmtE(t)+'/Monat')}}}
  if(D('cto','apps'))for(const a of G.apps)if(firm(G,a.owner)&&a.state==='live'){const want=rating(a)<0.62?'bugs':a.users>GENRES[a.genre].pot*0.4?'money':'features';if(a.focus!==want){a.focus=want;done.push('„'+a.name+'“: '+FOCUS[want].n)}}
  if(D('cpo','price'))for(const f of G.firms)if(f.branch==='cafe'&&f.shops.length){let dem=0,cap=0;for(const s of f.shops){const fc=shopForecast(G,f,s);dem+=fc.dem;cap+=fc.cap}
    const pf=menuStats(G,f,null).price,k=dem>cap*1.05&&pf>0.8?1.03:pf<0.85?0.97:pf>1.15&&dem<cap*0.9?1.03:1;if(k!==1){for(const m in f.menu)f.menu[m].price=Math.round(clamp(f.menu[m].price*k,0.5,30)*10)/10;done.push(f.name+': Preise '+(k>1?'+3 %':'−3 %'))}}
  for(const k in G.execs){const e=G.execs[k],dk=EXECS[k].dept;if(dk&&e.deleg&&e.deleg.dept&&G.hq){const n=dneed(G);if(deptN(G,dk)!==n){G.depts[dk]=n;done.push(DEPTS[dk].n+': '+n+' Köpfe')}}}
  if(done.length)rep.events.push({icon:'🗂️',t:'Dein Vorstand hat entschieden: '+done.slice(0,5).join(' · ')+(done.length>5?' · …':'')})}
// ---------- Welt: Zentralbank, Konjunktur, Politik, Fristen, Dividende ----------
function paper(rep,cat,title,text,o){if(rep&&rep.paper)rep.paper.push(Object.assign({cat,title,text},o||{}))}
const POLITICS=[
  {t:'Mindestlohn steigt um 4 %',x:'Die Bundesregierung hebt den Mindestlohn an. Gastronomie und Handel rechnen mit höheren Kosten.',run:G=>{G.idx.wage*=1.025}},
  {t:'Mietpreisbremse beschlossen',x:'Gewerbemieten dürfen zum Jahreswechsel nicht steigen. Ein Jahr Ruhe für Mieter.',run:G=>{G.rentFreeze=true}},
  {t:'Gleichstellungsgesetz tritt in Kraft',x:'Unternehmen ab 40 Beschäftigten müssen eine Personalabteilung nachweisen. Sonst drohen Geldstrafen.',run:(G,rep)=>{if(totalStaff(G)>=40&&!dcov(G,'hr')){const amt=Math.round(totalStaff(G)*250/500)*500;G.dues.push({m:G.month+2,amt,t:'Geldstrafe nach dem Gleichstellungsgesetz'});
    rep.incidents.push({kind:'firm',title:'Vorfall im Unternehmen',t:'Bitte stelle sicher, dass genug Geld verfügbar ist, um die am '+monthName(G.month+2)+' fällige Geldstrafe von '+fmtE(amt)+' zu decken, wie es das Gleichstellungsgesetz erfordert. Eine Personalabteilung in der Zentrale verhindert künftige Strafen.'})}}},
  {t:'Förderprogramm für Innenstädte',x:'Die Länder stellen Geld für belebte Innenstädte bereit. Mehr Laufkundschaft erwartet.',run:G=>{G.ev.heat=true}},
  {t:'Debatte um Unternehmenssteuer',x:'Im Bundestag wird über eine Senkung der Körperschaftsteuer gestritten. Eine Entscheidung ist nicht in Sicht.',run:()=>{}},
  {t:'Neue Hygieneverordnung',x:'Gastronomiebetriebe müssen ihre Küchen nachrüsten. Die Kosten liegen bei einigen tausend Euro pro Filiale.',run:(G,rep)=>{let n=0;for(const f of G.firms)if(f.branch==='cafe'){n+=f.shops.length}if(n){const amt=n*1500;G.dues.push({m:G.month+1,amt,t:'Nachrüstung nach der Hygieneverordnung'});
    rep.incidents.push({kind:'firm',title:'Vorfall im Unternehmen',t:'Die neue Hygieneverordnung verlangt Nachrüstungen in allen '+n+' Filialen. Fällig im '+monthName(G.month+1)+': '+fmtE(amt)+'.'})}}}];
function worldMonth(G,rep,rec){const M=G.macro;
  // fällige Zahlungen
  for(const d of G.dues.filter(d=>d.m<=G.month)){pay(G,'H','other',d.amt);rep.events.push({icon:'🧾',bad:true,t:d.t+': '+fmtE(d.amt)+' bezahlt.'})}G.dues=G.dues.filter(d=>d.m>G.month);
  // Quartal: Konjunktur und Zentralbank
  if(G.month%3===0){M.gdp=clamp(M.gdp*0.6+gauss(G)*0.008+0.005,-0.04,0.05);M.infl=clamp(M.infl*0.7+0.006+gauss(G)*0.004+M.gdp*0.15,-0.01,0.08);
    const target=0.02+1.5*(M.infl-0.02)+0.5*M.gdp,step=clamp(Math.round((target-M.rate)/0.0025)*0.0025,-0.005,0.005),old=M.rate;M.rate=Math.max(0,Math.round((M.rate+step)*10000)/10000);
    const pc=v=>(v*100).toFixed(2).replace('.',',')+' %';
    paper(rep,'wirtschaft',step>0?'Die Zentralbank erhöht den Leitzins auf '+pc(M.rate):step<0?'Die Zentralbank senkt den Leitzins auf '+pc(M.rate):'Die Zentralbank lässt den Leitzins bei '+pc(M.rate),
      'Auf ihrer Sitzung '+(step?'hat die Notenbank den Zins um '+Math.round(Math.abs(step)*10000)+' Basispunkte '+(step>0?'erhöht':'gesenkt'):'hat die Notenbank den Zins nicht verändert')+'. Die Wirtschaft wuchs im letzten Quartal um '+pc(M.gdp).replace(' %','')+' %, die Inflation liegt bei '+pc(M.infl)+'. Neue Kredite werden '+(step>0?'teurer':step<0?'günstiger':'nicht teurer')+'.',{icon:'bank',top:step!==0});
    if(M.gdp<0)rep.incidents.push({kind:'firm',title:'Konjunktur',t:'Die Wirtschaft schrumpft ('+pc(M.gdp)+'). Die Kundschaft hält ihr Geld zusammen, rechne mit etwas weniger Nachfrage.'});
    // Quartalszahlen der Konkurrenz
    for(const cp of G.comps)if(cp.branch==='cafe'){const n=G.plots.filter(p=>p.owner==='c:'+cp.id).length,base=n*rr(G,150000,210000)*(0.7+cp.q*0.5)*econ(G);cp.qrev.push(Math.round(base));if(cp.qrev.length>8)cp.qrev.shift()}
    const cs=G.comps.filter(c=>c.qrev&&c.qrev.length>1);if(cs.length){const cp=pick(G,cs),a=cp.qrev[cp.qrev.length-1],b=cp.qrev[cp.qrev.length-2],ch=a/b-1;
      paper(rep,'handel',cp.name+' Umsatz '+(ch>=0?'steigt':'fällt')+' um '+(Math.abs(ch)*100).toFixed(1).replace('.',',')+' %',cp.name+' verzeichnete im letzten Quartal einen Umsatz von '+fmtE(a)+', '+(ch>=0?'ein Plus':'ein Rückgang')+' von '+(Math.abs(ch)*100).toFixed(1).replace('.',',')+' % gegenüber dem Vorquartal.',{logo:{color:cp.color,icon:'cafe'},chart:{bars:cp.qrev.slice(-6),up:ch>=0}})}}
  // Politik
  if(rand(G)<0.22){const P=pick(G,POLITICS);P.run(G,rep);paper(rep,'politik',P.t,P.x,{icon:'politik'})}
  // Börse: größter Kurssprung
  let best=null;for(const s of G.stocks){const h=s.hist,c=h.length>1?h[h.length-1]/h[h.length-2]-1:0;if(!best||Math.abs(c)>Math.abs(best.c))best={s,c}}
  if(best&&Math.abs(best.c)>0.04)paper(rep,'markt',best.s.n+'-Aktie '+(best.c>0?'springt um ':'stürzt um ')+(Math.abs(best.c)*100).toFixed(1).replace('.',',')+' %','Die Papiere von '+best.s.n+' ('+best.s.tk+') schlossen bei '+fmtE(best.s.price,2)+'. Händler verweisen auf die Stimmung im Sektor '+SECTORS[best.s.sec]+'.',{chart:{line:best.s.hist.slice(-12),up:best.c>0}});
  // Quartalsdividende der eigenen Aktie
  if(G.public&&G.divPS>0){const tot=G.divPS*G.shares;
    if(G.month%3===1)rep.incidents.push({kind:'firm',title:'Vorfall im Unternehmen',t:'Wir müssen nächsten Monat eine vierteljährliche Dividende von '+fmtE(tot)+' auszahlen. Bitte bewahre bis dahin genug Bargeld auf.'});
    if(G.month%3===2){if(G.cash>=tot){G.cash-=tot;G.led.cf.fin-=tot;G.retained-=tot;const mine=G.divPS*G.shares*G.owner*0.75;G.me.cash+=mine;rep.events.push({icon:'💶',t:'Quartalsdividende ausgezahlt: '+fmtE(tot)+'. Dein Anteil nach Steuer: '+fmtE(mine)+'.'})}
      else{G.divPS=0;rep.incidents.push({kind:'firm',title:'Vorfall im Unternehmen',t:'Die Quartalsdividende konnte nicht gezahlt werden, die Kasse reicht nicht. Der Vorstand setzt sie aus, der Aktienkurs leidet.'});G.sharePrice*=0.9}}}
  if(G.public&&G.month%BOARD_Q===0)rep.incidents.push({kind:'board',title:'Vorstandssitzung',t:'Die Mitglieder des Aufsichtsrats sind heute alle anwesend. Wir sind bereit, die vierteljährliche Sitzung abzuhalten: Dividende und Vergütung.'})}
// Titelseite: eigene Zahlen und Meilensteine
function frontPage(G,rep,rec){const f0=G.firms[0],ms=G.months,prev=rec&&ms.length>1?pl(ms[ms.length-2]):null,cur=rec?pl(rec):null;
  if(prev&&prev.rev>5000){const ch=cur.rev/prev.rev-1;if(Math.abs(ch)>0.06)paper(rep,'top',f0.name+(ch>0?' steigert':' verliert')+' Umsatz um '+(Math.abs(ch)*100).toFixed(0)+' %','Der Konzern meldet für '+monthName(rec.m)+' einen Umsatz von '+fmtE(cur.rev)+' und ein Ergebnis von '+fmtE(rec.net)+'.',{logo:{color:f0.color,icon:f0.branch},chart:{bars:ms.slice(-6).map(m=>pl(m).rev),up:ch>0}})}
  for(const g of rep.goals)paper(rep,'top',f0.name+': '+g.n,'Ein weiterer Meilenstein für das Unternehmen.',{logo:{color:f0.color,icon:f0.branch}});
  if(G.public&&rec)paper(rep,'markt',f0.name+'-Aktie bei '+fmtE(G.sharePrice,2),'Der Börsenwert liegt bei '+fmtE(G.sharePrice*G.shares)+'.',{chart:{line:G.priceHist.slice(-12),up:G.priceHist.length<2||G.priceHist[G.priceHist.length-1]>=G.priceHist[G.priceHist.length-2]}});
  const M=G.macro,pc=v=>(v*100).toFixed(1).replace('.',',')+' %';
  const fill={handel:[['Ketten halten ihre Preise','Die großen Ketten verzichten auf Preiserhöhungen. Analysten erwarten ein ruhiges Quartal.'],['Vegetarisch boomt','In den Innenstädten bestellt inzwischen jeder dritte Gast fleischlos.'],['Mehrweg wird Pflicht','Lieferdienste müssen Mehrwegverpackungen anbieten. Die Kosten steigen leicht.'],['Kundschaft zieht es in die Viertel','Restaurants in Wohnvierteln melden mehr Stammgäste, die Innenstädte stagnieren.'],['Fachkräfte gesucht','Die Gastronomie sucht händeringend Köche und Servicekräfte. Die Löhne ziehen leicht an.']],
    wirtschaft:[['Konjunktur: Wachstum von '+pc(M.gdp),'Die Wirtschaft entwickelt sich '+(M.gdp>0.01?'solide':M.gdp>0?'verhalten':'schwach')+'. Der Leitzins liegt bei '+(M.rate*100).toFixed(2).replace('.',',')+' %.'],['Inflation bei '+pc(M.infl),'Die Teuerung '+(M.infl>0.03?'bleibt hartnäckig':'ist unter Kontrolle')+'. Ökonomen erwarten '+(M.infl>0.03?'weitere Zinsschritte':'stabile Zinsen')+'.'],['Konsumklima '+(M.gdp>0.01?'hellt sich auf':'trübt sich ein'),'Die Verbraucher sind '+(M.gdp>0.01?'in Kauflaune':'vorsichtig')+'. Händler spüren das an der Kasse.']]};
  for(const c of ['wirtschaft','handel'])if(!rep.paper.some(a=>a.cat===c)){const [t,x]=pick(G,fill[c]);paper(rep,c,t,x,{icon:c==='handel'?'cafe':'bank'})}}
function leadActions(A){
  A.offerExec=(G,k,i,salary)=>{if(!G.hq)return{ok:false,msg:'Der Vorstand braucht eine Zentrale.'};if(G.execs[k])return{ok:false,msg:'Die Stelle ist besetzt.'};const list=cands(G,k),c=list[i];if(!c)return{ok:false};
    const fee=Math.round(salary*0.1);if(!can(G,fee))return noMoney(fee);pay(G,'H','other',fee);const p=clamp((salary/c.demand-0.88)/0.25,0,1);list.splice(i,1);
    if(rand(G)<p){G.execs[k]=Object.assign({},c,{since:G.month,salary,deleg:{},grants:[],loy:clamp(c.loy+(salary/c.demand-1)*60,10,100)});delete G.execs[k].job;delete G.execs[k].at;
      news(G,c.name+' wird '+EXECS[k].n+'.','good');return{ok:true,msg:c.name+' nimmt an und wird '+EXECS[k].n+'!'}}
    return{ok:false,msg:c.name+' lehnt ab. Das Angebot war zu niedrig.'}};
  A.fireExec=(G,k)=>{const e=G.execs[k];if(!e)return{ok:false};pay(G,'H','other',e.salary/2);delete G.execs[k];return{ok:true,msg:e.name+' verlässt das Unternehmen (Abfindung '+fmtE(e.salary/2)+').'}};
  A.execSalary=(G,k,v)=>{const e=G.execs[k];if(!e)return{ok:false};const old=e.salary;e.salary=clamp(Math.round(v/10000)*10000,50000,3e6);if(e.salary>old)e.loy=Math.min(100,e.loy+(e.salary/old-1)*40);return{ok:true}};
  A.deleg=(G,k,d)=>{const e=G.execs[k];if(!e)return{ok:false};e.deleg[d]=!e.deleg[d];return{ok:true}};
  A.grant=(G,k,type,n,strike)=>{const e=G.execs[k];if(!e)return{ok:false};if(!G.public)return{ok:false,msg:'Aktienzuschüsse gibt es nach dem Börsengang.'};n=Math.round(n);if(n<=0)return{ok:false};
    const gr={type,n,strike:type==='rsu'?0:Math.round(strike*100)/100,m:G.month,vested:0};e.grants.push(gr);e.loy=Math.min(100,e.loy+25*Math.min(1,grantValue(G,gr)/e.salary)+3);
    return{ok:true,msg:fn(n)+(type==='rsu'?' RSU':' Aktienoptionen')+' an '+e.name+' vergeben.'}};
  A.board=(G,o)=>{if(o.divPS!==undefined)G.divPS=clamp(Math.round(o.divPS*100)/100,0,1000);return{ok:true}};
  A.deptWage=(G,v)=>{G.deptWage=clamp(Math.round(v/5000)*5000,35000,150000);return{ok:true}}}
// ---------- Privat: Gehalt, Aktien, Luxus, Verein ----------
const SECTORS={kaffee:'Gastronomie',tech:'Technologie',auto:'Auto',fin:'Finanzen',handel:'Handel',energie:'Energie'};
const STOCKS=[['FBG','Friesenkrug','kaffee',16.9,21e6,0.004,0.06,0.013],['TRC','Tafelhaus Gruppe','kaffee',41,8e6,0.006,0.07,0.01],['MTRS','Datenwerk','tech',58,40e6,0.01,0.09,0.006],
  ['PXL','Pixelwerk','tech',22,15e6,0.012,0.13,0],['NAU','Nordauto','auto',74,30e6,0.003,0.07,0.025],['VLT','Stromer Mobil','auto',31,12e6,0.009,0.12,0],
  ['HBK','Hanse Bank','fin',12,90e6,0.003,0.06,0.04],['ELB','Elbe Versicherung','fin',96,9e6,0.004,0.04,0.03],['KTH','Kaufhaus Thoma','handel',19,20e6,0.001,0.07,0.035],
  ['WND','Windkraft Nord','energie',27,25e6,0.007,0.08,0.02],['GAS','Ostsee Energie','energie',44,18e6,0.002,0.06,0.045]];
const LUX={wein:{n:'Grand Cru 1945',sub:'Zwei Flaschen alter Burgunder',icon:'🍷',p:[40000,180000],vol:0.07,up:0},uhr:{n:'Vintage-Uhr',sub:'Seltener Chronograph',icon:'⌚',p:[60000,250000],vol:0.05,up:0},
  kunst:{n:'Gemälde',sub:'Klassische Moderne',icon:'🖼️',p:[400000,2500000],vol:0.09,up:0.001},auto:{n:'Oldtimer 300 SL',sub:'Flügeltürer, 1955',icon:'🏎️',p:[1200000,1800000],vol:0.05,up:0.001},
  yacht:{n:'Segelyacht',sub:'32 Meter, Liegeplatz Emden',icon:'⛵',p:[3000000,6000000],vol:0.04,up:0.004},villa:{n:'Villa am Wasser',sub:'Elbchaussee, Hamburg',icon:'🏡',p:[6000000,12000000],vol:0.025,up:0.0015},
  jet:{n:'Privatjet',sub:'Mittelstrecke, 8 Plätze',icon:'🛩️',p:[18000000,30000000],vol:0.03,up:0.006}};
const CLUBS=[{id:'kiel',n:'Emder Seehunde',city:'kiel',price:28e6,league:'2. Liga',c1:'#2f6fd0',owner:'Mitglieder e. V.'},{id:'hh',n:'Hanse Möwen Hamburg',city:'hamburg',price:120e6,league:'1. Liga',c1:'#24272b',owner:'Hanse Invest'},{id:'ber',n:'Spree-Adler Berlin',city:'berlin',price:300e6,league:'1. Liga',c1:'#2f6fd0',owner:'Familie Schneider'}];
function genMarket(G){G.stocks=STOCKS.map(([tk,n,sec,price,shares,drift,vol,div])=>({tk,n,sec,price,shares,drift,vol,div,hist:[price]}));for(let i=0;i<23;i++)stepStocks(G,true)}
function gauss(G){return Math.sqrt(-2*Math.log(rand(G)+1e-9))*Math.cos(6.2832*rand(G))}
function stepStocks(G,warm){const shock={};for(const k in SECTORS)shock[k]=gauss(G)*0.03;const mkt=gauss(G)*0.025+(G.macro?G.macro.gdp*0.08:0);
  for(const s of G.stocks){s.price=Math.max(0.5,s.price*Math.exp(s.drift+mkt+shock[s.sec]+gauss(G)*s.vol));s.hist.push(s.price);if(s.hist.length>24)s.hist.shift()}}
function marketsMonth(G,rep){stepStocks(G);const me=G.me;let div=0;
  if(G.month%3===2)for(const tk in me.stocks){const s=G.stocks.find(x=>x.tk===tk);if(s)div+=me.stocks[tk].n*s.price*s.div/4}
  if(div){me.cash+=div*0.75;rep.events.push({icon:'💶',t:'Dividenden auf dein Depot: +'+fmtE(div*0.75)+' (nach Steuer).'})}
  for(const l of me.lux){l.value=Math.max(1000,l.value*Math.exp(0.002+gauss(G)*LUX[l.k].vol));const up=l.value*LUX[l.k].up;me.cash-=up}}
function privateMonth(G,rep){if(ME)G.me.kmM=0;const sal=G.me.salary/12*W;if(sal>0){pay(G,'H','staff',sal);G.me.cash+=sal*0.58}}
// ---------- Fußballverein: Liga, Kader, Trikots, Transfers, Finanzen ----------
const TEAMS={'1. Liga':['Isar 1900','Ruhrkumpel 09','Sachsenblitz','Werkself Rhein','Mainadler','Neckar 93','Wolfsheide','Schwarzwald Kickers','Weserstrand','Rheinhessen 05','Domstadt FC','Lechtal','Zechen-Union','Ostalb 46','Köpenicker Eiserne','Fohlenweide','Kraichgau','Lilienfeld','Spree-Adler Berlin','Hanse Möwen Hamburg'],
  '2. Liga':['Leinestadt 96','Rheinufer Fortuna','Paderquelle 07','Fächerstadt SC','Frankenclub','Kleeblattstadt','Elbaue 1965','Ostseewelle','Löwenstadt','Saarhöhe','Pfalzberg','Münsterland 06','Donauspatzen','Regenburg SSV','Kiezpiraten','Lila Weiß 99','Taunusquelle','Emder Seehunde','Hanse Möwen Hamburg']};
const POS=[['TW',2],['ABW',6],['MIT',6],['ST',4]];
const CLUB_STAD={kiel:15000,hh:57000,ber:74000};
const OWNERS=['Familie Schneider','Familie Albrecht','Hanse Invest','Mitglieder e. V.','Brauerei Nordlicht','Familie Petersen'];
function lvlOf(lg){return lg==='1. Liga'?74:65}
function genPlayer(G,lg,pos,q){const age=Math.round(rr(G,18,33)),r=clamp(Math.round((q||lvlOf(lg))+gauss(G)*5-(age<21?4:0)),45,94);
  return{id:uid(G),name:pick(G,FIRST.m)+' '+pick(G,LAST),pos,age,r,look:(rand(G)*1e6)|0,sal:pSal(r),val:pVal(r,age)}}
function pSal(r){return Math.round(Math.pow(1.13,r-50)*90000/1000)*1000}
function pVal(r,age){return Math.round(Math.pow(1.17,r-50)*90000*(age<24?1.4:age>30?0.55:1)/10000)*10000}
function squadStr(c){const best=c.players.slice().sort((a,b)=>b.r-a.r);const gk=best.find(p=>p.pos==='TW'),field=best.filter(p=>p!==gk).slice(0,10);return((gk?gk.r:50)+field.reduce((s,p)=>s+p.r,0))/11}
function newTable(G,c){const names=TEAMS[c.league].filter(n=>n!==c.n).sort(()=>rand(G)-0.5).slice(0,17),base=lvlOf(c.league);
  c.table=names.map(n=>({n,str:base+gauss(G)*4,w:0,d:0,l:0,gf:0,ga:0,pts:0})).concat([{n:c.n,me:true,str:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}]);c.md=0}
function initClub(G,C,c){c=c||{};const lg=c.league||C.league;Object.assign(c,{id:C.id,n:C.n,league:lg,hist:c.hist||[],value:c.value||C.price});
  if(!c.players){c.players=[];for(const [p,n] of POS)for(let i=0;i<n;i++)c.players.push(genPlayer(G,lg,p,lvlOf(lg)+((c.str||0.45)-0.45)*20))}
  c.jersey=c.jersey||{c1:C.c1||'#2f6fd0',c2:'#ffffff',style:'streifen',price:79};c.fans=c.fans||Math.round(CLUB_STAD[C.id]*12);c.ticket=c.ticket||(lg==='1. Liga'?38:24);
  c.market=c.market||[];c.fin=c.fin||null;c.since=c.since===undefined?G.month:c.since;if(!c.table)newTable(G,c);if(!c.revA){const sq=c.players.reduce((s,p)=>s+p.val,0);c.revA=Math.max(c.value*0.15,(c.value-sq*0.6)/2.2)}delete c.budget;delete c.str;return c}
function clubMarket(G,c){c.market=[];for(let i=0;i<6;i++){const p=genPlayer(G,c.league,pick(G,['TW','ABW','ABW','MIT','MIT','ST','ST']),lvlOf(c.league)+rr(G,-4,10));p.price=Math.round(p.val*rr(G,0.9,1.35)/10000)*10000;p.from=pick(G,TEAMS[pick(G,['1. Liga','2. Liga'])]);c.market.push(p)}}
function match(G,a,b,home){const d=(a-b)/6+(home?0.25:-0.25);const ga=Math.max(0,Math.round(1.35+d*0.55+gauss(G)*1.05)),gb=Math.max(0,Math.round(1.35-d*0.55+gauss(G)*1.05));return[ga,gb]}
function rec(t,f,a){t.gf+=f;t.ga+=a;if(f>a){t.w++;t.pts+=3}else if(f===a){t.d++;t.pts++}else t.l++}
const SEASON=[7,8,9,10,11,0,1,2,3,4],MDAYS=[4,3,4,3,4,3,3,4,3,3];
function clubMonth(G,rep){const c=G.me.club;if(!c)return;const C=CLUBS.find(x=>x.id===c.id);if(!c.players)initClub(G,C,c);
  const mi=SEASON.indexOf(G.month%12),me=c.table.find(t=>t.me);me.str=squadStr(c);let home=0,res=[];
  if(mi>=0){for(let k=0;k<MDAYS[mi];k++){const order=c.table.slice().sort(()=>rand(G)-0.5);for(let i=0;i<order.length;i+=2){const A0=order[i],B0=order[i+1],h=rand(G)<0.5;const [x,y]=match(G,A0.str,B0.str,h);rec(A0,x,y);rec(B0,y,x);
      if(A0.me||B0.me){const mine=A0.me?[x,y]:[y,x],hm=A0.me?h:!h;if(hm)home++;res.push(mine)}}c.md++}
    for(const t of c.table)if(!t.me)t.str+=gauss(G)*0.3}
  // Finanzen des Monats
  const sorted=c.table.slice().sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)),rank=sorted.indexOf(me)+1,form=res.length?res.reduce((s,[a,b])=>s+(a>b?1:a===b?0.4:0),0)/res.length:0.5;
  c.fans=Math.round(c.fans*(1+(form-0.45)*0.04+(c.league==='1. Liga'?0.004:0)));const cap=CLUB_STAD[c.id];
  const fill=clamp(c.fans/(cap*14)*(0.85+form*0.3)*Math.exp(-(c.ticket/(c.league==='1. Liga'?38:24)-1)*0.9),0.2,1);
  const tickets=home*cap*fill*c.ticket*0.7,jA=Math.exp(-(c.jersey.price/79-1)*1.6),merch=c.fans*0.012*jA*c.jersey.price*(c.jersey.fresh?1.5:1)*0.45;c.jersey.fresh=false;
  const tv=(c.league==='1. Liga'?2.5e6:0.9e6)*(mi>=0?1:0.3)*(1.15-rank/40),spon=c.value*0.0012,wages=c.players.reduce((s,p)=>s+p.sal,0)/12,upk=cap*6;
  const net=tickets+merch+tv+spon-wages-upk;G.me.cash+=net;c.fin={tickets,merch,tv,spon,wages,upk,net,fill,home,res,rank};
  const sq=c.players.reduce((s,p)=>s+p.val,0);c.revA=(c.revA||c.value/3)*0.92+(tickets+merch+tv+spon)*12*0.08;c.value=Math.round(Math.max(sq*1.2,c.revA*2.2+sq*0.6)/100000)*100000;
  if(res.length&&rep){const w=res.filter(([a,b])=>a>b).length,d=res.filter(([a,b])=>a===b).length;rep.events.push({icon:'⚽',t:C.n+': '+w+' Siege, '+d+' Remis, '+(res.length-w-d)+' Niederlagen im Monat · Platz '+rank+' · '+(net>=0?'+':'')+fmtE(net)+' für dich.'})}
  if(G.month%12===4&&mi>=0){const old=c.league;c.hist.unshift({y:yearOf(G.month)-1,lg:old,rank,w:me.w,d:me.d,l:me.l,pts:me.pts});let t=C.n+' beendet die Saison '+(yearOf(G.month)-1)+'/'+String(yearOf(G.month)).slice(2)+' auf Platz '+rank+' ('+old+').';
    if(rank===1&&old==='1. Liga'){t+=' Deutscher Meister! 🏆';G.ms.title=G.month;c.fans=Math.round(c.fans*1.15)}
    if(old==='2. Liga'&&rank<=2){c.league='1. Liga';t+=' Aufstieg in die 1. Liga!';c.fans=Math.round(c.fans*1.25);c.ticket=Math.max(c.ticket,34)}
    if(old==='1. Liga'&&rank>=17){c.league='2. Liga';t+=' Abstieg in die 2. Liga.';c.fans=Math.round(c.fans*0.8)}
    rep.events.push({icon:'🏆',t});paper(rep,'top',C.n+': Platz '+rank,t,{icon:'politik'});
    for(const p of c.players){p.age++;p.r=clamp(p.r+(p.age<24?Math.round(rr(G,0,4)):p.age>30?-Math.round(rr(G,1,4)):Math.round(rr(G,-1,2))),40,95);p.val=pVal(p.r,p.age)}}
  if(G.month%12===6){newTable(G,c);clubMarket(G,c);if(rep)rep.events.push({icon:'🔄',t:C.n+': Das Transferfenster ist offen.'})}
  if(G.month%12===0)clubMarket(G,c)}
function clubActions(A){
  A.buyClub=(G,id)=>{const C=CLUBS.find(x=>x.id===id);if(G.me.club)return{ok:false,msg:'Du besitzt schon einen Verein.'};if(G.me.cash<C.price)return{ok:false,msg:'Privat fehlen dir '+fmtE(C.price-G.me.cash)+'.'};
    G.me.cash-=C.price;G.me.club=initClub(G,C,{value:C.price});clubMarket(G,G.me.club);news(G,'Du kaufst '+C.n+'!','ms');return{ok:true,msg:C.n+' gehört jetzt dir!'}};
  A.sellClub=G=>{const c=G.me.club;if(!c)return{ok:false};G.me.cash+=c.value*0.95;G.me.club=null;return{ok:true,msg:'Verein verkauft für '+fmtE(c.value*0.95)+'.'}};
  A.clubTicket=(G,v)=>{const c=G.me.club;if(!c)return{ok:false};c.ticket=clamp(Math.round(v),8,150);return{ok:true}};
  A.jersey=(G,ch)=>{const c=G.me.club;if(!c)return{ok:false};if(ch.design){if(G.me.cash<250000)return{ok:false,msg:'Ein neues Trikot kostet 250.000 € Design und Produktion.'};G.me.cash-=250000;Object.assign(c.jersey,ch.design,{fresh:true});return{ok:true,msg:'Neues Trikot vorgestellt! Die Fans stürmen den Shop.'}}
    if(ch.price!==undefined)c.jersey.price=clamp(Math.round(ch.price),29,199);return{ok:true}};
  A.signPlayer=(G,pid)=>{const c=G.me.club;if(!c)return{ok:false};if(![6,7,0].includes(G.month%12))return{ok:false,msg:'Das Transferfenster ist geschlossen (offen im Juli, August und Januar).'};const i=c.market.findIndex(p=>p.id===pid);if(i<0)return{ok:false};const p=c.market[i];
    if(c.players.length>=26)return{ok:false,msg:'Der Kader ist voll (26). Verkaufe zuerst jemanden.'};if(G.me.cash<p.price)return{ok:false,msg:'Privat fehlen dir '+fmtE(p.price-G.me.cash)+'.'};
    G.me.cash-=p.price;c.market.splice(i,1);delete p.from;c.players.push(p);return{ok:true,msg:p.name+' wechselt für '+fmtE(p.price)+' zu '+c.n+'.'}};
  A.sellPlayer=(G,pid)=>{const c=G.me.club;if(!c)return{ok:false};const i=c.players.findIndex(p=>p.id===pid);if(i<0)return{ok:false};if(c.players.length<=16)return{ok:false,msg:'Mindestens 16 Spieler müssen bleiben.'};
    const p=c.players[i],v=Math.round(p.val*rr(G,0.8,1.05)/10000)*10000;G.me.cash+=v;c.players.splice(i,1);return{ok:true,msg:p.name+' verkauft für '+fmtE(v)+'.'}}}
// ---------- Reisen ----------
const GEO={kiel:[53.37,7.21],hamburg:[53.55,9.99],berlin:[52.52,13.40]};
const AIRPORTS={kiel:'Flughafen Emden',hamburg:'Flughafen Hamburg',berlin:'Flughafen Berlin Brandenburg'};
function dist(a,b){const [x1,y1]=GEO[a],[x2,y2]=GEO[b],k=Math.PI/180,d=Math.acos(Math.sin(x1*k)*Math.sin(x2*k)+Math.cos(x1*k)*Math.cos(x2*k)*Math.cos((y2-y1)*k))*6371;return Math.round(d)}
function flights(G){const me=G.me,jet=me.lux.some(l=>l.k==='jet');return CITIES.filter(c=>c.id!==me.loc).map(c=>{const km=dist(me.loc,c.id);return{id:c.id,n:c.n,km,cost:jet?Math.round(km*12):Math.round(90+km*0.9),jet,open:!!G.cities[c.id]}})}
function travelActions(A){A.fly=(G,id)=>{const f=flights(G).find(x=>x.id===id);if(!f)return{ok:false};if(G.me.cash<f.cost)return{ok:false,msg:'Privat fehlen dir '+fmtE(f.cost-G.me.cash)+'.'};
  G.me.cash-=f.cost;G.me.loc=id;G.me.km=(G.me.km||0)+f.km;G.me.kmM=(G.me.kmM||0)+f.km;
  let boost=0;if(G.me.visit!==G.month+':'+id){G.me.visit=G.month+':'+id;for(const fm of G.firms){const here=(fm.shops||[]).filter(s=>plot(G,s.plot).city===id);for(const s of here){s.rep=Math.min(1,s.rep+0.03);boost++}
    if(fm.office&&plot(G,fm.office).city===id||(fm.plants||[]).some(p=>plot(G,p.plot).city===id)||here.length)fm.moraleBoost=(fm.moraleBoost||0)+0.05}}
  return{ok:true,msg:'Gelandet in '+cityName(id)+(f.jet?' (Privatjet)':'')+'.'+(boost?' Chefbesuch in '+boost+' Filiale(n): Ruf und Stimmung steigen.':'')}}}
// ---------- Adressen ----------
const STREETS={kiel:['Neutorstraße','Große Straße','Am Delft','Brückstraße','Kirchstraße','Boltentorstraße','Lookvenne','Am Stadtgarten','Zwischen beiden Sielen','Ringstraße'],
  hamburg:['Jungfernstieg','Mönckebergstraße','Ottenser Hauptstraße','Schanzenstraße','Eppendorfer Weg','Lange Reihe','Mühlenkamp','Großer Burstah','Grindelallee','Wandsbeker Chaussee'],
  berlin:['Invalidenstraße','Wilhelmstraße','Torstraße','Kastanienallee','Oranienstraße','Friedrichstraße','Kantstraße','Bergmannstraße','Schönhauser Allee','Turmstraße']};
function address(p){if(!p||!STREETS[p.city])return'';const h=(p.r*7+p.c*13+(p.city.length*3))%10,n=100+((p.r*37+p.c*91+(p.u||0)*17)%480);return STREETS[p.city][h]+' '+n+', '+cityName(p.city)}
// Bewertungen der Konkurrenz
function compShop(G,cp,p){const h=(p.r*31+p.c*17+(p.u||0)*7)%100/100,cat={preis:clamp(Math.exp(-1.8*(cp.price-1))*0.75,0.1,1),produkt:cp.q,service:clamp(0.55+cp.rep*0.4+(h-0.5)*0.1,0,1),atmo:clamp(0.6+h*0.3,0,1)};
  const all=(cat.preis+cat.produkt*1.4+cat.service+cat.atmo)/4.4,n=Math.round(800+cp.rep*6000*(0.6+h));
  const lines=[cat.produkt>0.7?'„Richtig gutes Essen, frisch gekocht.“':'„Das Essen ist okay, mehr nicht.“',cat.preis<0.55?'„Ganz schön teuer für das, was man bekommt.“':'„Faire Preise.“',cat.atmo>0.75?'„Sehr gemütlich, tolle Einrichtung.“':'„Etwas ungemütlich, eher zum Mitnehmen.“',cat.service>0.75?'„Freundliches Personal, schnell bedient.“':'„Lange Wartezeit an der Theke.“'];
  return{cat,all,n,reviews:lines.map((t,i)=>({t,s:Math.max(1,Math.min(5,Math.round((Object.values(cat)[i]*5+all*5)/2))),look:p.r*100+p.c*10+i,g:i%2?'f':'m',k:['produkt','preis','atmo','service'][i]}))}}
function wealth(G){const me=G.me;const own=valuation(G).mine;let st=0,stCost=0;for(const tk in me.stocks){const s=G.stocks.find(x=>x.tk===tk);if(s){st+=me.stocks[tk].n*s.price;stCost+=me.stocks[tk].cost}}
  const lux=me.lux.filter(l=>l.k!=='villa').reduce((s,l)=>s+l.value,0),re=me.lux.filter(l=>l.k==='villa').reduce((s,l)=>s+l.value,0),club=me.club?me.club.value:0;
  return{cash:me.cash,own,stocks:st,stCost,lux,re,club,total:me.cash+own+st+lux+re+club}}

// ---------- Aktionen ----------
const A={};leadActions(A);
const can=(G,amt)=>G.cash-amt>=-dispo(G)*0.5;
const noMoney=amt=>({ok:false,msg:'Dafür fehlt das Geld ('+fmtE(amt)+').'});
function shopOf(G,sid){for(const f of G.firms)if(f.shops){const s=f.shops.find(x=>x.id===sid);if(s)return[f,s]}return[null,null]}
function lineOf(G,lid){for(const f of G.firms)if(f.plants)for(const p of f.plants){const l=p.lines.find(x=>x.id===lid);if(l)return[f,p,l]}return[null,null,null]}
// ---------- Filialleitung: Personen mit Fähigkeiten, Gehalt und Delegation ----------
const MGR_DELEG={staff:'Mitarbeiter und Gehalt delegieren',price:'Produkte und Öffnungszeiten delegieren',mkt:'Filial-Marketing delegieren',inc:'Filial-Zwischenfälle delegieren'};
function mq(s,k){return s&&s.manager&&s.manager[k]?s.manager[k]/100:0}
function mgrAvg(m){return(m.ppl+m.prod+m.mkt+m.eth)/4}
function mgrPay(m){return Math.round((30000+mgrAvg(m)*380)/500)*500}
function mgrPerson(G){const g=rand(G)<0.5?'f':'m',b=rr(G,45,80);const sk=()=>Math.round(clamp(b+gauss(G)*10,30,98));const m={name:pick(G,FIRST[g])+' '+pick(G,LAST),g,look:(rand(G)*1e6)|0,ppl:sk(),prod:sk(),mkt:sk(),eth:sk()};m.demand=mgrPay(m);return m}
function mgrCands(G,sid){G.mgrC=G.mgrC||{};const c=G.mgrC[sid];if(c&&c.m===G.month)return c.list;const list=[mgrPerson(G),mgrPerson(G),mgrPerson(G)];G.mgrC[sid]={m:G.month,list};return list}
function mgrMigrate(G){for(const f of G.firms)for(const s of f.shops||[])if(s.manager===true){const m=mgrPerson(G);s.manager=Object.assign(m,{since:G.month,salary:m.demand,deleg:{}})}}
// monatlich: Delegation und Kündigungen
function mgrMonth(G,rep){const done=[];
  for(const f of G.firms)for(const s of f.shops||[]){const m=s.manager;if(!m)continue;const d=m.deleg||{},nm=m.name.split(' ')[0];
    if(d.staff){const fc=shopForecast(G,f,s),per=fc.cap/Math.max(1,s.staff),want=clamp(Math.ceil(fc.dem*(1.02+0.06*(1-m.ppl/100))/Math.max(1,per)),1,Math.max(2,Math.floor(plot(G,s.plot).size/12)));
      if(want!==s.staff){const r=A.shop(G,s.id,{staff:want});if(r.ok)done.push(nm+': '+want+' Kräfte')}}
    if(d.price){const ms=menuStats(G,f,s);const best=ms.items.slice().sort((a,b)=>b.share-a.share)[0];if(best&&s.special!==best.k&&m.prod>55){s.special=best.k;done.push(nm+': Tagesangebot '+PRODUCTS[best.k].n)}
      const fc=shopForecast(G,f,s);const h=fc.dem>fc.cap*1.15&&s.hours!=='long'&&m.prod>50?'long':fc.dem<fc.cap*0.55&&s.hours==='long'?'normal':null;if(h){s.hours=h;done.push(nm+': Öffnungszeiten '+HOURS[h].n)}}
    if(d.mkt){const fc=shopForecast(G,f,s),low=fc.dem<fc.cap*0.8,high=fc.dem>fc.cap*1.05;
      for(const k of ['flyer','stamp']){const on=!!s.act[k];if(low&&!on&&m.mkt>40){s.act[k]=true;done.push(nm+': '+CAFE_ACTIONS[k].n+' an')}if(high&&on){s.act[k]=false;done.push(nm+': '+CAFE_ACTIONS[k].n+' aus')}}
      if(low&&!s.act.happy&&m.mkt>65){s.act.happy=true;done.push(nm+': Happy Hour an')}if(high&&s.act.happy){s.act.happy=false;done.push(nm+': Happy Hour aus')}}
    // Ethik: Vorfälle; Gehalt: Kündigung
    if(rand(G)<pW((1-m.eth/100)*0.06)){const amt=Math.round(rr(G,300,2500)/50)*50;pay(G,f.id,'other',amt);s.rep-=0.03;rep.events.push({icon:'⚠️',bad:true,t:shopName(G,s)+': Unter der Leitung von '+m.name+' fehlen '+fmtE(amt)+' in der Kasse. Der Ruf leidet.'})}
    m.loy=clamp((m.loy===undefined?75:m.loy)+((m.salary/mgrPay(m)-1)*40+2-m.loy/50)*W+gauss(G)*0.5,0,100);
    if(m.salary<mgrPay(m)*0.88&&rand(G)<pW(0.12)){s.manager=null;rep.events.push({icon:'🚪',bad:true,t:shopName(G,s)+': Filialleitung '+m.name+' kündigt, das Gehalt lag zu weit unter Marktniveau.'})}}
  if(done.length)rep.events.push({icon:'🧑‍💼',t:'Deine Filialleitungen haben entschieden: '+done.slice(0,6).join(' · ')+(done.length>6?' · …':'')})}
// Zwischenfälle in Filialen mit Delegation entscheidet die Leitung selbst
const MGR_PICK={inspect:m=>m.eth>55?0:1,critic:m=>m.prod>65?0:1,noise:m=>m.ppl>60?0:1,viral:m=>m.mkt>50?0:1,blogger:(m,s)=>s.rep>0.72?1:0,rent:m=>m.mkt>65?1:0,fest:(m,s,G,f)=>{const fc=shopForecast(G,f,s);return fc.cap>fc.dem*1.2?0:1},youtube:m=>m.mkt>60&&m.eth>50?0:1};
function mgrIncidents(G,rep){for(const e of [...G.pending]){if(!MGR_PICK[e.k]||!e.ref)continue;const f=firm(G,e.fid),s=f&&(f.shops||[]).find(x=>x.id===e.ref);if(!s||!s.manager||!(s.manager.deleg||{}).inc)continue;
  const o=MGR_PICK[e.k](s.manager,s,G,f),r=decide(G,e.id,o);if(rep)rep.events.push({icon:'🧑‍💼',t:s.manager.name+' ('+shopName(G,s)+') hat entschieden: '+EVENTS[e.k].opts[o].n+'. '+(r.msg||'')})}}
function newShop(G,pid,o){return Object.assign({id:uid(G),plot:pid,level:1,staff:2,manager:false,hours:'normal',ups:{},act:{},special:null,rep:0.55,la:0.15,train:0,stat:null,reviews:[],opened:G.month},o||{})}
A.openShop=(G,fid,pid,o)=>{o=o||{};const lv=clamp(o.level||1,1,3),fc=FACADES[o.facade]||FACADES.klassik,ups=(o.ups||[]).filter(k=>CAFE_UPS[k]&&(!CAFE_UPS[k].minLevel||lv>=CAFE_UPS[k].minLevel));const f=firm(G,fid),p=plot(G,pid);if(!f||f.branch!=='cafe')return{ok:false,msg:'Nur für Restaurants.'};if(!p||p.owner)return{ok:false,msg:'Das Grundstück ist nicht frei.'};
  if(!G.cities[p.city])return{ok:false,msg:'Diese Stadt ist noch nicht erschlossen.'};if(!usesOf(p).includes('cafe'))return{ok:false,msg:'Hier ist keine Gastronomie möglich.'};
  if(ups.some(k=>CAFE_UPS[k].zones&&!CAFE_UPS[k].zones.includes(p.zone)))return{ok:false,msg:'Eine Ausstattung passt nicht zu diesem Standort.'};
  const fit=LEVELS[lv].cost+fc.cost+ups.reduce((a,k)=>a+CAFE_UPS[k].cost,0),cost=shopCost(p)-LEVELS[1].cost+fit;if(!can(G,cost))return noMoney(cost);
  pay(G,f.id,'other',cost-fit);buyAsset(G,f.id,'Einrichtung und Fassade',fit,60,'shop:'+p.id);p.owner=f.id;p.use='cafe';
  const u={};for(const k of ups)u[k]=true;const s=newShop(G,p.id,{build:BUILD.shop+(lv-1),level:lv,facade:o.facade||'klassik',ups:u});f.shops.push(s);news(G,f.name+' baut ein neues Restaurant ('+ZONES[p.zone].n+', '+cityName(p.city)+').','good');return{ok:true,msg:'Baustelle eingerichtet! Eröffnung in '+s.build+' Wochen.',id:s.id}};
const shopCost=p=>LEVELS[1].cost+p.rent*2+1600;
A.shop=(G,sid,ch)=>{const [f,s]=shopOf(G,sid);if(!s)return{ok:false};const p=plot(G,s.plot);
  if(ch.staff!==undefined){const n=clamp(ch.staff,1,Math.max(2,Math.floor(p.size/12)));if(n>s.staff){const c=800*(n-s.staff);if(!can(G,c))return noMoney(c);pay(G,f.id,'other',c)}s.staff=n}
  if(ch.manager===false)s.manager=null;if(ch.party!==undefined&&s.build>0){if(ch.party&&!s.party){if(!can(G,3000))return noMoney(3000);pay(G,f.id,'mkt',3000)}else if(!ch.party&&s.party)pay(G,f.id,'mkt',-3000);s.party=!!ch.party}if(ch.hours)s.hours=ch.hours;if(ch.special!==undefined)s.special=ch.special||null;
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
  if(!G.cities[p.city])return{ok:false,msg:'Diese Stadt ist noch nicht erschlossen.'};if(!usesOf(p).includes('office'))return{ok:false,msg:'Büros gibt es nur in Büroetagen.'};
  const cost=officeCost(p);if(!can(G,cost))return noMoney(cost);
  if(f.office){const o=plot(G,f.office);dropAssets(G,'office:'+o.id);o.owner=null;o.use=null;f.oups={}}
  pay(G,f.id,'other',p.rent*2);buyAsset(G,f.id,'Büroausstattung',p.size*40,60,'office:'+p.id);p.owner=f.id;p.use='office';f.office=p.id;f.officeBuild=BUILD.office;
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
  if(!G.cities[p.city])return{ok:false,msg:'Diese Stadt ist noch nicht erschlossen.'};if(!usesOf(p).includes('factory'))return{ok:false,msg:'Fabriken nur in Hallen im Gewerbegebiet.'};
  const cost=p.rent*3;if(!can(G,cost))return noMoney(cost);pay(G,f.id,'other',cost);p.owner=f.id;p.use='factory';const pl={id:uid(G),plot:p.id,lines:[],ups:{},build:BUILD.plant};f.plants.push(pl);
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
  if(!p||p.owner||!usesOf(p).includes('hq'))return{ok:false,msg:'Wähle eine freie Büroetage in Innenstadt oder Büroviertel.'};if(!G.cities[p.city])return{ok:false,msg:'Diese Stadt ist noch nicht erschlossen.'};
  if(!can(G,250000))return noMoney(250000);buyAsset(G,'H','Zentrale',250000,240,'hq');p.owner='H';p.use='hq';G.hq=p.id;G.hqBuild=BUILD.hq;news(G,'Der Ausbau der Konzernzentrale beginnt.','good');return{ok:true,msg:'Ausbau gestartet! Fertig in '+BUILD.hq+' Wochen.'}};
A.dept=(G,k,n)=>{if(!G.hq)return{ok:false,msg:'Erst eine Zentrale bauen.'};n=clamp(Math.round(n),0,200);const add=n-deptN(G,k);if(add>0){const c=2000*add;if(!can(G,c))return noMoney(c);pay(G,'H','other',c)}G.depts[k]=n;return{ok:true}};
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
A.hireMgr=(G,sid,i,salary)=>{const [f,s]=shopOf(G,sid);if(!s)return{ok:false};if(s.manager)return{ok:false,msg:'Die Filiale hat schon eine Leitung.'};const list=mgrCands(G,sid),c=list[i];if(!c)return{ok:false};
  list.splice(i,1);if(rand(G)<clamp((salary/c.demand-0.9)/0.15,0,1)){s.manager=Object.assign({},c,{since:G.month,salary:Math.round(salary/500)*500,deleg:{},loy:clamp(70+(salary/c.demand-1)*80,30,100)});delete s.manager.demand;return{ok:true,msg:c.name+' leitet jetzt die Filiale.'}}
  return{ok:false,msg:c.name+' lehnt ab. Das Angebot war zu niedrig.'}};
A.mgrSalary=(G,sid,v)=>{const [f,s]=shopOf(G,sid);if(!s||!s.manager)return{ok:false};s.manager.salary=clamp(Math.round(v/500)*500,20000,200000);return{ok:true}};
A.mgrDeleg=(G,sid,k)=>{const [f,s]=shopOf(G,sid);if(!s||!s.manager)return{ok:false};s.manager.deleg=s.manager.deleg||{};s.manager.deleg[k]=!s.manager.deleg[k];return{ok:true}};
A.fireMgr=(G,sid)=>{const [f,s]=shopOf(G,sid);if(!s||!s.manager)return{ok:false};const m=s.manager;pay(G,f.id,'staff',m.salary/12);s.manager=null;return{ok:true,msg:m.name+' verlässt die Filiale (ein Monatsgehalt Abfindung).'}};
A.shopPrice=(G,sid,k,v)=>{const [f,s]=shopOf(G,sid);if(!s)return{ok:false};s.px=s.px||{};s.px[k]=Math.round(clamp(v,0.5,60)*10)/10;return{ok:true}};
A.uniform=(G,fid,on)=>{const f=firm(G,fid);f.uniform=!!on;if(on)for(const s of f.shops||[])s.px={};return{ok:true}};
A.recipe=(G,fid,r)=>{const f=firm(G,fid);if(!can(G,2000))return noMoney(2000);pay(G,f.id,'rd',2000);f.recipe={wuerze:clamp(r.wuerze,0,1),frische:clamp(r.frische,0,1),portion:clamp(r.portion,0,1)};return{ok:true,msg:'Neues Hausrezept eingeführt (Testküche 2.000 €).'}};
A.rename=(G,fid,name)=>{const f=firm(G,fid);name=String(name||'').trim().slice(0,26);if(!f||!name)return{ok:false};f.name=name;return{ok:true,msg:'Die Firma heißt jetzt '+name+'.'}};
A.founderDev=(G,on)=>{G.founderDev=!!on;return{ok:true}};
A.buyProp=(G,pid)=>{const p=plot(G,pid);if(!p||p.prop)return{ok:false};if(p.owner==='H')return{ok:false};if(!G.cities[p.city])return{ok:false,msg:'Diese Stadt ist noch nicht erschlossen.'};
  const v=propValue(G,p),c=v*1.05;if(!can(G,c))return noMoney(c);pay(G,'H','other',v*0.05);buyAsset(G,'H','Immobilie '+ZONES[p.zone].n+' '+cityName(p.city),v,1e9,'prop:'+p.id);p.prop='H';p.leaseR=1;p.buyP=Math.round(c);p.buyM=G.month;
  news(G,'Immobilie gekauft: '+ZONES[p.zone].n+', '+cityName(p.city)+'.','good');return{ok:true,msg:'Fläche gekauft!'}};
A.sellProp=(G,pid)=>{const p=plot(G,pid);if(!p||p.prop!=='H')return{ok:false};if(p.owner==='H')return{ok:false,msg:'Die Zentrale steht hier.'};const v=propValue(G,p)*0.97;
  const a=G.assets.filter(x=>x.ref==='prop:'+p.id),book=a.reduce((s,x)=>s+x.book,0);G.assets=G.assets.filter(x=>x.ref!=='prop:'+p.id);earn(G,'H',null,v,'inv');L(G,'H').other+=book-v;p.prop=null;
  return{ok:true,msg:'Verkauft für '+fmtE(v)+(v>book?' (Gewinn '+fmtE(v-book)+')':' (Verlust '+fmtE(book-v)+')')}};
A.leaseR=(G,pid,r)=>{const p=plot(G,pid);if(!p||p.prop!=='H')return{ok:false};p.leaseR=clamp(Math.round(r*20)/20,0.5,1.6);return{ok:true}};
A.cityCamp=(G,fid,city,k)=>{const f=firm(G,fid);f.camps=f.camps||{};f.camps[city]=f.camps[city]||{};f.camps[city][k]=!f.camps[city][k];return{ok:true}};
A.exec=(G,k)=>({ok:false,msg:'Führungskräfte stellst du über Bewerbungen ein.'});
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
clubActions(A);travelActions(A);
A.secondary=(G,pct)=>{if(!G.public)return{ok:false,msg:'Erst nach dem Börsengang.'};pct=clamp(pct,0.01,0.3);const n=Math.round(G.shares*pct),gross=n*G.sharePrice,fee=gross*0.068,net=gross-fee;
  equity(G,net);G.owner*=G.shares/(G.shares+n);G.shares+=n;G.sharePrice*=0.97;news(G,'Kapitalerhöhung: '+fn(n)+' neue Aktien, Erlös '+fmtE(net)+'.','fin');return{ok:true,msg:'Kapitalerhöhung: +'+fmtE(net)}};
A.decide=(G,id,opt)=>decide(G,id,opt);

// Vorschau beim Bauen einer Filiale
function forecastShop(G,fid,pid){const f=firm(G,fid),p=plot(G,pid);if(!f||f.branch!=='cafe')return null;
  const s=newShop({nextId:0},pid,{id:-1,staff:3});const fc=shopForecast(G,f,s);
  const guests=fc.dem*WEEKS;let perGuest=0,costPer=0;for(const it of fc.ms.items){const P=PRODUCTS[it.k];perGuest+=PER*it.share*it.price;costPer+=PER*it.share*(P.other+(P.beans?P.beans*GOODS.bohnen.ref*G.idx.rohkaffee:0)+(P.piece?P.mkt:0))*QMULT[it.q]}
  const staff=Math.max(2,Math.ceil(guests/(GPS*DAYS*WEEKS*productivity(f))));const rev=guests*perGuest,cost=guests*costPer+staff*wageOf(G,'barista',f)+rentOf(p)+450;
  return{guests:Math.round(guests),rev,profit:rev-cost,staff,cost:shopCost(p)}}

// ---------- Hilfen ----------
function cityName(id){return(CITIES.find(c=>c.id===id)||{}).n}
function yearOf(m){return 2027+Math.floor(m/12)}
function monthName(m){return MONTHS[m%12]+' '+yearOf(m)}
function fn(v){return Math.round(v).toLocaleString('de-DE')}
function fmtE(v,d){if(Math.abs(v)<0.5)v=0;const a=Math.abs(v);if(d)return v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d})+' '+CUR;
  if(a>=1e6)return(v/1e6).toLocaleString('de-DE',{maximumFractionDigits:a>=1e8?0:1})+' Mio. '+CUR;return Math.round(v).toLocaleString('de-DE')+' '+CUR}
function curLedger(G){return{m:G.month,f:G.led.f,H:G.led.H,cf:G.led.cf}}

const K={MONTHS,BRANCHES,WAGE,PRODUCTS,QMULT,QUAL,QN,LEVELS,CAFE_UPS,CAFE_ACTIONS,HOURS,GENRES,SCOPES,FOCUS,MODELS,CAMPAIGNS,OFFICE_UPS,RAW,GOODS,LINES,SHIFTS,GMULT,GQUAL,SUPPLIERS,PLANT_UPS,RESEARCH,CITIES,ZONES,COLS,ROWS,STAGES,DEPTS,GOALS,
  newGame,endTurn,act:A,plot,firm,staffOf,adminOf,totalStaff,hqStaff,stage,menuStats,shopForecast,forecastShop,shopCost,officeCost,softTeam,desks,rating,goodsTotal,lineOut,lineNeed,rawPrice,wholesalePrice,storageCap,reserved,effGrade,
  balance,valuation,firmValue,compValue,takeoverPrice,loanOffer,ipoCheck,pl,curLedger,dateStr,dayOf,W,WEEKS,BUILD,underBuild,monthName,yearOf,cityName,dispo,fmtE,fmtN:fn,freePlots,stars,eventOpts,productivity,summer,shopOf,lineOf,sumF,wageOf,propValue,propIncome,leaseOcc,rentOf,CITY_CAMPS,EXECS,SECTORS,LUX,CLUBS,wealth,genMarket,CITY_MAP,CITY_BLOCKS,CITY_TRAITS,DIFF,CURS,TASTE,FACADES,unitCost,recipeFit,setCur:c=>{CUR=CURS[c]||'€'},MGR_DELEG,mgrCands,mgrPay,flights,dist,AIRPORTS,address,compShop,squadStr,TEAMS,CLUB_STAD,pSal,ex,dcov,dneed,deptN,marketPay,cands,grantValue,migrate,econ,BOARD_Q,UNITS,KINDS,usesOf,unitName,YIELD};
if(typeof module!=='undefined'&&module.exports)module.exports=K;else root.K=K;
})(typeof window!=='undefined'?window:globalThis);
