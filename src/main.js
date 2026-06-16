const goalOptions = {
  kraft: { label: 'Muskelaufbau', split: ['Push', 'Pull', 'Beine', 'Oberkörper', 'Unterkörper'] },
  abnehmen: { label: 'Abnehmen', split: ['Ganzkörper Kraft', 'Intervalle', 'Mobility', 'Zone-2 Cardio', 'Core'] },
  ausdauer: { label: 'Ausdauer', split: ['Easy Run', 'Tempo', 'Kraft Stabi', 'Lange Einheit', 'Regeneration'] },
};

const workoutBank = {
  Push: ['Bankdrücken 4×6-8', 'Schulterdrücken 3×8-10', 'Liegestütze 3×AMRAP', 'Trizepsdrücken 3×12'],
  Pull: ['Klimmzüge/Latzug 4×6-10', 'Rudern 4×8-10', 'Face Pulls 3×15', 'Bizepscurls 3×12'],
  Beine: ['Kniebeugen 4×6-8', 'Rumänisches Kreuzheben 3×8', 'Ausfallschritte 3×10/Seite', 'Wadenheben 3×15'],
  Oberkörper: ['Schrägbankdrücken 3×8', 'Kabelrudern 3×10', 'Seitheben 3×15', 'Plank 3×45s'],
  Unterkörper: ['Beinpresse 4×10', 'Hip Thrust 3×10', 'Beincurls 3×12', 'Farmer Walk 4×30m'],
  'Ganzkörper Kraft': ['Goblet Squat 4×10', 'Kurzhantel-Rudern 3×12', 'Brustpresse 3×10', 'Dead Bug 3×12'],
  Intervalle: ['10 Min Warm-up', '8×45s schnell/75s locker', '10 Min Cool-down', 'Dehnen 8 Min'],
  Mobility: ['Hüftmobilität 10 Min', 'Brustwirbelsäule 8 Min', 'Schulterkontrolle 8 Min', 'Atemübung 5 Min'],
  'Zone-2 Cardio': ['35-50 Min locker', 'Puls 60-70% HFmax', 'Gesprächstempo halten', '5 Min Cool-down'],
  Core: ['Pallof Press 3×12', 'Side Plank 3×30s', 'Mountain Climbers 3×30s', 'Bird Dog 3×10'],
  'Easy Run': ['30-45 Min locker laufen', 'Kadenz entspannt', 'RPE 4/10', 'Nachbereitung: Waden dehnen'],
  Tempo: ['12 Min Einlaufen', '3×8 Min zügig', '3 Min Trabpause', '10 Min Auslaufen'],
  'Kraft Stabi': ['Step-ups 3×10', 'Single-leg RDL 3×8', 'Wadenheben 4×12', 'Core Zirkel 10 Min'],
  'Lange Einheit': ['60-90 Min ruhig', 'Trinken planen', 'Puls stabil halten', 'Letzte 10 Min sehr locker'],
  Regeneration: ['Spaziergang 30 Min', 'Mobility Flow 15 Min', 'Schlafziel prüfen', 'Stresslevel notieren'],
};

let state = { goal: 'kraft', days: 4, level: 'intermediate', connected: false, metrics: { steps: 8420, calories: 612, heartRate: 72, sleep: 7.4, lastSync: 'Demo-Daten' } };

const icon = (name) => `<span class="icon" aria-hidden="true">${name}</span>`;
const app = document.querySelector('#root');

function buildPlan() {
  const split = goalOptions[state.goal].split;
  const intensity = state.level === 'beginner' ? 'moderat' : state.level === 'advanced' ? 'hoch' : 'mittel';
  return Array.from({ length: Number(state.days) }, (_, index) => {
    const title = split[index % split.length];
    return { day: `Tag ${index + 1}`, title, intensity, exercises: workoutBank[title] };
  });
}

function render() {
  const metrics = state.metrics;
  app.innerHTML = `<main>
    <section class="hero"><nav><div class="brand">${icon('◒')} FitSync Planner</div><a href="#connect">Gerät verbinden</a></nav><div class="heroGrid"><div><p class="eyebrow">${icon('✦')} Trainingsplanung + Wearable-Daten</p><h1>Erstelle smarte Fitnesspläne und lies deine Samsung-Gear-Daten aus.</h1><p class="lead">Plane Kraft, Ausdauer und Abnehmen in wenigen Klicks. Verbinde deine Samsung Gear S3 Frontier über Samsung Health, Health Connect oder CSV-Export, um Schritte, Puls, Schlaf und Kalorien in die Planung einfließen zu lassen.</p><a class="cta" href="#planner">Plan erstellen</a></div><div class="watchCard">${icon('⌚')}<h2>Samsung Gear S3 Frontier</h2><p>Status: ${state.connected ? 'Synchronisiert' : 'Bereit zum Verbinden'}</p><button id="demoSync">${icon('⌁')} Demo-Sync starten</button></div></div></section>
    <section class="metrics" aria-label="Fitnessdaten">${metric('◷','Schritte', metrics.steps.toLocaleString('de-DE'))}${metric('◆','Aktive kcal', metrics.calories)}${metric('♡','Ruhepuls', `${metrics.heartRate} bpm`)}${metric('☾','Schlaf', `${metrics.sleep} h`)}</section>
    <section id="planner" class="panel twoCols"><div><p class="eyebrow">Plan Generator</p><h2>Dein Trainingsplan</h2><div class="controls"><label>Ziel<select id="goal">${Object.entries(goalOptions).map(([key, item]) => `<option value="${key}" ${state.goal === key ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label><label>Trainingstage/Woche<input id="days" type="range" min="2" max="6" value="${state.days}"><strong>${state.days} Tage</strong></label><label>Level<select id="level"><option value="beginner" ${state.level === 'beginner' ? 'selected' : ''}>Einsteiger</option><option value="intermediate" ${state.level === 'intermediate' ? 'selected' : ''}>Fortgeschritten</option><option value="advanced" ${state.level === 'advanced' ? 'selected' : ''}>Erfahren</option></select></label></div></div><div class="planList">${buildPlan().map(planCard).join('')}</div></section>
    <section id="connect" class="panel connect"><div><p class="eyebrow">${icon('✓')} Datenschutzfreundlich</p><h2>Wearable-Anbindung</h2><p>Browser können eine Gear S3 nicht direkt vollständig auslesen. Diese Website bereitet deshalb die üblichen Integrationswege vor: Samsung Health/Health Connect für Android-Apps, CSV-Import für Exporte und eine Demo-Sync-Schnittstelle für spätere Backend-APIs.</p><div class="importBox">${icon('⇪')}<label>Samsung-Health CSV importieren<input id="csv" type="file" accept=".csv"></label></div><small>Letzte Synchronisierung: ${metrics.lastSync}</small></div><ol><li>Samsung Health auf dem Smartphone mit der Gear S3 synchronisieren.</li><li>Daten per Health Connect freigeben oder als CSV exportieren.</li><li>Hier importieren und Trainingsumfang anhand von Schlaf, Puls und Aktivität anpassen.</li></ol></section>
  </main>`;
  bindEvents();
}

function metric(symbol, label, value) { return `<div class="metric">${icon(symbol)}<span>${label}</span><strong>${value}</strong></div>`; }
function planCard(item) { return `<article><div><strong>${item.day}</strong><h3>${item.title}</h3><p>Intensität: ${item.intensity}</p></div><ul>${item.exercises.map((ex) => `<li>${icon('✓')}${ex}</li>`).join('')}</ul></article>`; }
function bindEvents() {
  document.querySelector('#demoSync').addEventListener('click', () => { state = { ...state, connected: true, metrics: { steps: 11890, calories: 934, heartRate: 68, sleep: 8.1, lastSync: new Date().toLocaleString('de-DE') } }; render(); });
  document.querySelector('#goal').addEventListener('change', (event) => { state.goal = event.target.value; render(); });
  document.querySelector('#days').addEventListener('input', (event) => { state.days = event.target.value; render(); });
  document.querySelector('#level').addEventListener('change', (event) => { state.level = event.target.value; render(); });
  document.querySelector('#csv').addEventListener('change', (event) => { const file = event.target.files?.[0]; if (!file) return; state.connected = true; state.metrics.lastSync = `CSV importiert: ${file.name}`; render(); });
}

render();
