// Risiko - Letzte Welt: Grundgerüst (Phase 1-4)
// Kartendarstellung, Gebietsauswahl, Rundensystem (Verstärkung/Spielzug/Verschieben),
// Ressourcen- und Gebäudesystem (Mastertabelle), Sondermechaniken (Cyberangriff,
// Belagerung, Bombardierung, Reparatur nach Besitzwechsel).

// Verstärkung pro Runde: max(3, eigene Gebiete/3) + Bonus je komplett kontrolliertem Kontinent.
// Bonuswert ist ein Platzhalter (ein Viertel der Kontinentgröße, aufgerundet), bis echte
// Kontinent-Bonuswerte im Regelwerk feststehen.
function berechneVerstaerkung(spielerId) {
  const eigene = Object.values(territorien).filter((t) => t.owner === spielerId);
  let n = Math.max(3, Math.floor(eigene.length / 3));
  KARTENDATEN.kontinente.forEach((k) => {
    const gebiete = k.gebiete.filter((g) => territorien[g.id]);
    if (gebiete.length === 0) return;
    const komplettEigen = gebiete.every((g) => territorien[g.id].owner === spielerId);
    if (komplettEigen) n += Math.max(1, Math.ceil(gebiete.length / 4));
  });
  return n;
}

// Gelände-Grundfarben je Kontinent (Biom-Anmutung statt reiner Spielerfarbe)
const KONTINENT_FARBE = {
  arktis: "#dce8ec", na: "#6a9b5e", europa: "#7ba85f", asien: "#a08a52",
  afrika: "#c2a05a", bruch: "#a15c3e", sa: "#4c9b6a", australien: "#c17a4a",
  konstrukt: "#8a92a0", aqua0: "#3f9c9a", aqua1: "#3f9c9a", aqua2: "#3f9c9a", aqua3: "#3f9c9a",
};
// Wieviel Prozent der Fläche in Spielerfarbe eingefärbt wird (Rest bleibt Geländefarbe sichtbar)
const BESITZ_DECKKRAFT = 0.5;

const SPIELER = [
  { id: 1, name: "Spieler 1", farbe: "#d1495b", ressourcen: { metall: 5, nahrung: 5, treibstoff: 5, energie: 10 }, cybermarker: 0, istBot: false },
  { id: 2, name: "Spieler 2", farbe: "#3a86ff", ressourcen: { metall: 5, nahrung: 5, treibstoff: 5, energie: 10 }, cybermarker: 0, istBot: false },
];
// Verzögerung, bevor der Bot nach Rundenbeginn zu handeln anfängt (nur Optik, kein Balancing).
const BOT_VERZOEGERUNG_MS = 500;
const ENERGIE_MAX = 50;
const CYBERMARKER_MAX = 5;
const CYBERMARKER_KOSTEN = 25;
const BOMBARDIERUNG_KOSTEN = 15;

// Gesamte Mastertabelle (Regelwerk Abschnitt 7): Wirtschaft (W01-04) + Verteidigung (V01-10)
// + Infrastruktur (I01-09). "effektAktiv:false" heißt: baubar, Kosten/Bauzeit korrekt,
// aber die Spielwirkung ist noch nicht verdrahtet (braucht Systeme aus späteren Phasen wie
// Luft-/Wassereinheiten, Konvois, Cybermarker, Belagerung/Bombardierung).
// Ertrag/Runde bei Wirtschaftsgebäuden ist ein Platzhalter (Tabelle nennt keine Zahl).
const GEBAEUDE_TYPEN = {
  // Wirtschaft (W01-W04)
  mine: { code: "W01", name: "Mine", kategorie: "wirtschaft", kosten: { metall: 1, energie: 5 }, produziert: "metall", ertrag: 3, effektAktiv: true, effektText: "Liefert Metall pro Runde" },
  farm: { code: "W02", name: "Farm", kategorie: "wirtschaft", kosten: { nahrung: 1, energie: 5 }, produziert: "nahrung", ertrag: 3, effektAktiv: true, effektText: "Liefert Nahrung pro Runde" },
  kraftwerk: { code: "W03", name: "Kraftwerk", kategorie: "wirtschaft", kosten: { energie: 5 }, produziert: "energie", ertrag: 3, effektAktiv: true, effektText: "Liefert Energie pro Runde" },
  raffinerie: { code: "W04", name: "Raffinerie", kategorie: "wirtschaft", kosten: { treibstoff: 1, energie: 5 }, produziert: "treibstoff", ertrag: 3, effektAktiv: true, effektText: "Liefert Treibstoff pro Runde" },

  // Verteidigung (V01-V10)
  mauer: { code: "V01", name: "Mauer", kategorie: "verteidigung", kosten: { metall: 2, energie: 5 }, effektAktiv: true, brauchtZiel: true, effektText: "Blockiert Angriffe von einem gewählten angrenzenden Gebiet" },
  minenguertel: { code: "V02", name: "Minengürtel", kategorie: "verteidigung", kosten: { metall: 2, treibstoff: 1, energie: 5 }, effektAktiv: false, effektText: "Wasserfeld: verhindert Durchfahrt (Effekt folgt, braucht Wasserfelder)" },
  flagstellung: { code: "V03", name: "Flagstellung", kategorie: "verteidigung", kosten: { metall: 1, nahrung: 1, energie: 5 }, effektAktiv: true, effektText: "+1 Würfel bei Verteidigung" },
  geschuetz: { code: "V04", name: "Geschütz", kategorie: "verteidigung", kosten: { metall: 3, energie: 10 }, effektAktiv: true, effektText: "+1 Würfel beim Angriff auf angrenzende Gebiete" },
  radar: { code: "V05", name: "Radar / Aufklärungsturm", kategorie: "verteidigung", kosten: { metall: 1, energie: 10 }, effektAktiv: false, effektText: "Angreifer muss Kampfart offenlegen, Verteidiger würfelt 1x neu (Effekt folgt)" },
  artilleriestellung: { code: "V06", name: "Artilleriestellung", kategorie: "verteidigung", kosten: { metall: 3, treibstoff: 1, energie: 15 }, effektAktiv: false, effektText: "1x/Spiel: 1W6-Vorschlag auf angrenzendes Gebiet (Effekt folgt)" },
  flugabwehr: { code: "V07", name: "Flugabwehr", kategorie: "verteidigung", kosten: { metall: 2, energie: 10 }, effektAktiv: false, effektText: "Luftangriffe verlieren 1 Würfel (Effekt folgt, braucht Lufteinheiten)" },
  kuestenbatterie: { code: "V08", name: "Küstenbatterie", kategorie: "verteidigung", kosten: { metall: 3, energie: 10 }, effektAktiv: false, effektText: "Wasserangriffe -1 Würfel, Konvois 1W6 Schaden (Effekt folgt)" },
  schildgenerator: { code: "V09", name: "Schildgenerator", kategorie: "verteidigung", kosten: { metall: 4, energie: 20 }, effektAktiv: true, effektText: "Angreifer verliert 1 Angriffswürfel" },
  megafestung: { code: "V10", name: "Megafestung", kategorie: "verteidigung", kosten: { metall: 6, energie: 30 }, limitProSpieler: 1, effektAktiv: true, effektText: "Zählt als Flagstellung + Geschütz (+ Kontrollpunkt, folgt noch)" },

  // Infrastruktur (I01-I09)
  aussenposten: { code: "I01", name: "Außenposten", kategorie: "infrastruktur", kosten: { metall: 1, nahrung: 1, energie: 5 }, effektAktiv: false, effektText: "Kleine Kontroll-Boni (Effekt folgt, im Regelwerk nicht beziffert)" },
  kontrollpunkt: { code: "I02", name: "Kontrollpunkt", kategorie: "infrastruktur", kosten: { metall: 1, energie: 10 }, effektAktiv: false, effektText: "Blockiert Konvois (Effekt folgt, braucht Konvoi-System)" },
  kommandozentrale: { code: "I03", name: "Kommandozentrale", kategorie: "infrastruktur", kosten: { metall: 3, energie: 15 }, effektAktiv: true, effektText: "+1 Verschieben-Aktion pro Runde" },
  reparaturdock: { code: "I04", name: "Reparaturdock", kategorie: "infrastruktur", kosten: { metall: 2, treibstoff: 1, energie: 10 }, effektAktiv: true, effektText: "Stellt 1 Truppe pro eigener Runde wieder her" },
  versorgungsdepot: { code: "I05", name: "Versorgungsdepot", kategorie: "infrastruktur", kosten: { metall: 2, nahrung: 1, energie: 10 }, effektAktiv: true, effektText: "+5 Energie pro Runde" },
  sabotagezentrum: { code: "I06", name: "Sabotagezentrum", kategorie: "infrastruktur", kosten: { metall: 2, energie: 15 }, effektAktiv: false, effektText: "Gegner verliert 5 Energie oder Konvoi wird aufgehalten (Effekt folgt)" },
  propagandaturm: { code: "I07", name: "Propagandaturm", kategorie: "infrastruktur", kosten: { metall: 1, energie: 10 }, effektAktiv: false, effektText: "Gegner zahlt +1 Energie pro Angriff (Effekt folgt)" },
  geheimerstuetzpunkt: { code: "I08", name: "Geheimer Stützpunkt", kategorie: "infrastruktur", kosten: { metall: 2, energie: 15 }, effektAktiv: false, effektText: "1x/Spiel Angriff aus nicht angrenzendem Gebiet (Effekt folgt)" },
  orbitalrelais: { code: "I09", name: "Orbitalrelais", kategorie: "infrastruktur", kosten: { metall: 4, treibstoff: 2, energie: 25 }, effektAktiv: false, effektText: "Luftangriffe +1 Würfel, Konvois immun (Effekt folgt)" },

  // Sondergebäude (kontinentgebunden)
  dekontaminationsanlage: { code: "S01", name: "Dekontaminationsanlage", kategorie: "sonder", kosten: { metall: 2, treibstoff: 1, energie: 10 }, effektAktiv: true, nurKontinent: "bruch", effektText: "Schützt dieses Gebiet vor der Kontamination in Der Bruch (-1 Nahrung/Runde)" },
  orbitalstartrampe: { code: "S02", name: "Orbitalstartrampe", kategorie: "sonder", kosten: { metall: 5, treibstoff: 3, energie: 30 }, limitProSpieler: 1, effektAktiv: false, nurKontinent: "konstrukt", effektText: "Schaltet Zugang zum Orbitalring frei (Effekt folgt, braucht Orbitalring als echte Karte)" },
};

// Kontamination: Gebiete in "Der Bruch" verlieren pro Runde 1 Nahrung, außer eine
// fertige Dekontaminationsanlage (S01) steht dort. Regel + Wert sind ein bestätigter
// Vorschlag (16.09.2026), da das Regelwerk dazu bisher nichts festlegte.
const KONTAMINATION_KONTINENT = "bruch";
const KONTAMINATION_VERLUST = 1;

function kannBezahlen(spielerId, kosten) {
  const r = SPIELER.find((s) => s.id === spielerId).ressourcen;
  return Object.entries(kosten).every(([k, v]) => r[k] >= v);
}
function bezahlen(spielerId, kosten) {
  const r = SPIELER.find((s) => s.id === spielerId).ressourcen;
  Object.entries(kosten).forEach(([k, v]) => { r[k] -= v; });
}
function gutschreiben(spielerId, art, menge) {
  const r = SPIELER.find((s) => s.id === spielerId).ressourcen;
  r[art] += menge;
  if (art === "energie") r.energie = Math.min(r.energie, ENERGIE_MAX);
}

function aktiveGebaeude(t, typ) {
  return t.gebaeude.filter((b) => b.fertig && !b.beschaedigt && b.typ === typ);
}
function hatAktivesGebaeude(t, typ) {
  return t.gebaeude.some((b) => b.fertig && !b.beschaedigt && b.typ === typ);
}
function zaehleAktiveGebaeude(spielerId, typ) {
  return Object.values(territorien).filter((t) => t.owner === spielerId && hatAktivesGebaeude(t, typ)).length;
}
// zählt auch noch im Bau befindliche Exemplare -- wichtig für Limit-pro-Spieler-Prüfung,
// sonst ließe sich das Limit durch mehrere gleichzeitige Bauaufträge umgehen
function zaehleAlleGebaeude(spielerId, typ) {
  return Object.values(territorien).filter((t) => t.owner === spielerId).reduce((n, t) => n + t.gebaeude.filter((b) => b.typ === typ).length, 0);
}

// Wird einmal pro eigener Rundenstart aufgerufen -- zwischen dem Bau (im vorigen Spielzug)
// und diesem Aufruf ist immer genau 1 Runde vergangen, das erfüllt die Bauzeit von 1 Runde.
// "fertig" ist danach nur noch ein UI-Flag ("im Bau" vs. aktiv).
function produktionsPhase(spielerId) {
  Object.values(territorien).forEach((t) => {
    if (t.owner !== spielerId) return;
    t.gebaeude.forEach((b) => {
      // Reparatur ist seit dem Auftrag 1 Runde gelaufen -> jetzt fertig repariert
      if (b.beschaedigt && b.reparaturBegonnen) { b.beschaedigt = false; b.reparaturBegonnen = false; }
      if (b.beschaedigt) return; // wirkt nicht, produziert nichts, solange nicht repariert
      b.fertig = true;
      const info = GEBAEUDE_TYPEN[b.typ];
      if (info.produziert) gutschreiben(spielerId, info.produziert, info.ertrag);
      if (b.typ === "reparaturdock") t.truppen += 1;
      if (b.typ === "versorgungsdepot") gutschreiben(spielerId, "energie", 5);
    });

    if (t.continentId === KONTAMINATION_KONTINENT && !hatAktivesGebaeude(t, "dekontaminationsanlage")) {
      const r = SPIELER.find((s) => s.id === spielerId).ressourcen;
      r.nahrung = Math.max(0, r.nahrung - KONTAMINATION_VERLUST);
    }
  });
}
const NEUTRAL_FARBE = "#5a6472";
const START_TRUPPEN = 3;

// --- Farbhilfsfunktionen (Gelände + Spielerfarbe mischen) ---
function hexZuRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbZuHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function farbMischen(hexA, hexB, anteilB) {
  const a = hexZuRgb(hexA), b = hexZuRgb(hexB);
  return rgbZuHex(a.map((v, i) => v * (1 - anteilB) + b[i] * anteilB));
}
function hashText(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}
// leichte, pro Gebiet feste Zufallsschattierung für eine unruhigere, "gewachsene" Geländeoptik
function terrainSchattierung(basisHex, seedText) {
  const rnd = (hashText(seedText) % 1000) / 1000;
  const helligkeit = (rnd - 0.5) * 26; // -13..+13
  const rgb = hexZuRgb(basisHex).map((v) => v + helligkeit);
  return rgbZuHex(rgb);
}

// --- Zustand aufbauen ---
const territorien = {}; // id -> {id, continentId, polygon, x, y, owner, truppen, terrainFarbe}
let globalIndex = 0;
KARTENDATEN.kontinente.forEach((k) => {
  k.gebiete.forEach((g) => {
    if (!g.polygon) return;
    territorien[g.id] = {
      id: g.id,
      continentId: k.id,
      polygon: g.polygon,
      x: g.x,
      y: g.y,
      owner: SPIELER[globalIndex % 2].id,
      truppen: START_TRUPPEN,
      terrainFarbe: terrainSchattierung(KONTINENT_FARBE[k.id] ?? "#6a9b5e", g.id),
      gebaeude: [], // [{typ, fertig, ziel?}] -- ziel nur bei Mauer (blockiertes Nachbargebiet), siehe GEBAEUDE_TYPEN
    };
    globalIndex++;
  });
});

const adjazenz = new Map();
function addAdj(a, b) {
  if (!territorien[a] || !territorien[b]) return;
  if (!adjazenz.has(a)) adjazenz.set(a, new Set());
  if (!adjazenz.has(b)) adjazenz.set(b, new Set());
  adjazenz.get(a).add(b);
  adjazenz.get(b).add(a);
}
KARTENDATEN.nachbarschaften_intern.forEach(([a, b]) => addAdj(a, b));
KARTENDATEN.verbindungen_extern.forEach((v) => addAdj(v.von, v.nach));

let ausgewaehlt = null;
let ziel = null;
let aktiverSpieler = 1;

// --- Rundensystem ---
// phase: "verstaerkung" (Truppen verteilen) -> "spielzug" (beliebig oft angreifen,
// optional 1x verschieben) -> Zug beenden -> nächster Spieler, wieder "verstaerkung".
let phase = "verstaerkung";
let verstaerkungUebrig = 0;
let verschiebenModus = false;
let verschiebenQuelle = null;
let verschiebenVerbleibend = 1; // Standard 1x/Zug, +1 je aktiver Kommandozentrale
let bauModus = false;
let bauZiel = null; // Gebiet, für das gerade ein Gebäudetyp gewählt wird
let mauerZielAuswahl = null; // {gebietId} -- wartet auf Klick des zu blockierenden Nachbargebiets

let cyberEinsetzenAngriff = false; // Checkbox: nächsten Angriff mit Cybermarker verstärken
let belagerungModus = false;
let belagerungVon = null;
let belagerungZiel = null;
let belagerungVerwendet = false; // max. 1x pro Spieler und Runde
let belagerungEffektAuswahl = null; // {gebietId} -- wartet auf Effektwahl nach dem Kampf
let bombardierungModus = false;
let bombardierungVon = null;
let bombardierungZiel = null;
let bombardierungVerwendet = false; // max. 1x pro Spieler und Runde
let meineRolle = null; // im Mehrspielermodus: eigene Spieler-ID (Klicks für den anderen werden ignoriert)

function setMeineRolle(r) { meineRolle = r; }
function amZug() { return meineRolle === null || meineRolle === aktiverSpieler; }

function rundenStart(spielerId) {
  produktionsPhase(spielerId);
  aktiverSpieler = spielerId;
  phase = "verstaerkung";
  verstaerkungUebrig = berechneVerstaerkung(spielerId);
  verschiebenModus = false;
  verschiebenQuelle = null;
  verschiebenVerbleibend = 1 + zaehleAktiveGebaeude(spielerId, "kommandozentrale");
  bauModus = false;
  bauZiel = null;
  mauerZielAuswahl = null;
  cyberEinsetzenAngriff = false;
  belagerungModus = false; belagerungVon = null; belagerungZiel = null; belagerungVerwendet = false; belagerungEffektAuswahl = null;
  bombardierungModus = false; bombardierungVon = null; bombardierungZiel = null; bombardierungVerwendet = false;
  ausgewaehlt = null;
  ziel = null;
  document.querySelectorAll(".spieler-btn").forEach((b) => b.classList.toggle("aktiv", Number(b.dataset.spielerId) === spielerId));
  log(`${SPIELER.find((s) => s.id === spielerId).name} — Verstärkungsphase: ${verstaerkungUebrig} neue Truppen verteilen.`);
  render();
  updatePanel();

  // Bot-Züge laufen nur lokal (Hotseat/Einzelspieler) automatisch. Im Online-Mehrspieler
  // steuert jede Seite nur ihre eigene Verbindung -- Bots dort sind nicht vorgesehen.
  const spieler = SPIELER.find((s) => s.id === spielerId);
  const istOnline = typeof NETZWERK !== "undefined" && NETZWERK.istOnline();
  if (spieler?.istBot && !istOnline) {
    setTimeout(() => botZug(spielerId), BOT_VERZOEGERUNG_MS);
  }
}

// --- Rendering: Karte einmalig aufbauen ---
const svg = document.getElementById("board");
const defsEl = document.createElementNS("http://www.w3.org/2000/svg", "defs");
svg.appendChild(defsEl);

// dezente Geländekörnung, damit die Flächen weniger "flach vektoriell" wirken
const terrainFilter = ns("filter");
terrainFilter.setAttribute("id", "terrain-koernung");
terrainFilter.setAttribute("x", "-5%");
terrainFilter.setAttribute("y", "-5%");
terrainFilter.setAttribute("width", "110%");
terrainFilter.setAttribute("height", "110%");
terrainFilter.innerHTML = `
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="rauschen"/>
  <feColorMatrix in="rauschen" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0"/>
  <feComposite in2="SourceGraphic" operator="over"/>
`;
defsEl.appendChild(terrainFilter);

function polyPath(pts) {
  return "M" + pts.map((p) => p[0] + "," + p[1]).join("L") + "Z";
}
function abstand(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

// entfernt Punkte, die kaum Abstand zum Vorgänger haben (entstehen beim Polygon-Clipping)
// -- sonst entstehen bei der Eckenglättung an diesen Mini-Kanten Schleifen/Artefakte
function vereinfachePolygon(pts, minAbstand = 1.2) {
  const out = [];
  for (const p of pts) {
    if (out.length === 0 || abstand(out[out.length - 1], p) >= minAbstand) out.push(p);
  }
  if (out.length > 2 && abstand(out[out.length - 1], out[0]) < minAbstand) out.pop();
  return out.length >= 3 ? out : pts;
}

// Chaikin-Eckenglättung: schneidet iterativ die Ecken ab -> weich wirkende, aber
// numerisch stabile Kontur (im Gegensatz zu Bezier-durch-Mittelpunkte robust
// gegenüber sehr unterschiedlich langen Kanten, wie sie nach dem Clipping vorkommen)
function chaikinGlaetten(pts, iterationen = 2, ratio = 0.22) {
  let cur = pts;
  for (let it = 0; it < iterationen; it++) {
    const n = cur.length;
    if (n < 3) break;
    const next = [];
    for (let i = 0; i < n; i++) {
      const p0 = cur[i], p1 = cur[(i + 1) % n];
      next.push([p0[0] + (p1[0] - p0[0]) * ratio, p0[1] + (p1[1] - p0[1]) * ratio]);
      next.push([p0[0] + (p1[0] - p0[0]) * (1 - ratio), p0[1] + (p1[1] - p0[1]) * (1 - ratio)]);
    }
    cur = next;
  }
  return cur;
}

function glattPath(pts) {
  const glatt = chaikinGlaetten(vereinfachePolygon(pts));
  return polyPath(glatt);
}
function centroid(pts) {
  let x = 0, y = 0;
  pts.forEach((p) => { x += p[0]; y += p[1]; });
  return [x / pts.length, y / pts.length];
}
function ns(tag) { return document.createElementNS("http://www.w3.org/2000/svg", tag); }

const pathById = {};
const labelById = {};

KARTENDATEN.kontinente.forEach((k) => {
  const clipId = "clip-" + k.id;
  const clip = ns("clipPath");
  clip.setAttribute("id", clipId);
  const clipPath = ns("path");
  clipPath.setAttribute("d", glattPath(k.umriss));
  clip.appendChild(clipPath);
  defsEl.appendChild(clip);

  const g = ns("g");
  g.setAttribute("clip-path", "url(#" + clipId + ")");
  g.setAttribute("filter", "url(#terrain-koernung)");
  svg.appendChild(g);

  k.gebiete.forEach((geb) => {
    if (!geb.polygon) return;
    const p = ns("path");
    p.setAttribute("d", glattPath(geb.polygon));
    p.setAttribute("class", "gebiet");
    p.dataset.id = geb.id;
    p.addEventListener("click", () => onClickGebiet(geb.id));
    g.appendChild(p);
    pathById[geb.id] = p;

    const c = centroid(geb.polygon);
    const t = ns("text");
    t.setAttribute("x", c[0]);
    t.setAttribute("y", c[1] + 3);
    t.setAttribute("class", "truppen");
    g.appendChild(t);
    labelById[geb.id] = t;
  });

  const border = ns("path");
  border.setAttribute("d", glattPath(k.umriss));
  border.setAttribute("class", "cont-border");
  svg.appendChild(border);
});

// --- Rendering: laufende Aktualisierung ---
// Während eines Bot-Zugs unterdrückt, damit nicht bei jeder Einzelaktion (Truppe platzieren,
// bauen, angreifen, ...) die komplette Karte neu gezeichnet wird -- das würde den Bot-Zug
// spürbar verlangsamen, ohne dass währenddessen jemand zusieht. botZug() rendert selbst
// einmal am Anfang und einmal am Ende.
let botRenderStumm = false;

function render() {
  if (botRenderStumm) return;
  Object.values(territorien).forEach((t) => {
    const besitzFarbe = t.owner ? SPIELER.find((s) => s.id === t.owner).farbe : NEUTRAL_FARBE;
    const p = pathById[t.id];
    p.setAttribute("fill", farbMischen(t.terrainFarbe, besitzFarbe, BESITZ_DECKKRAFT));
    p.setAttribute("stroke", besitzFarbe);
    p.classList.toggle("ausgewaehlt", t.id === ausgewaehlt);
    p.classList.toggle("ziel", t.id === ziel);
    let text = String(t.truppen);
    if (t.gebaeude.length) {
      text += " " + t.gebaeude.map((b) => GEBAEUDE_TYPEN[b.typ].code + (b.fertig ? "" : "?")).join(",");
    }
    labelById[t.id].textContent = text;
  });
}

function ressourcenText(spielerId) {
  const r = SPIELER.find((s) => s.id === spielerId).ressourcen;
  return `Metall ${r.metall} · Nahrung ${r.nahrung} · Treibstoff ${r.treibstoff} · Energie ${r.energie}/${ENERGIE_MAX}`;
}

function updatePanel() {
  if (botRenderStumm) return;
  const phaseInfo = document.getElementById("phase-info");
  const info = document.getElementById("auswahl-info");
  const btnAngriff = document.getElementById("btn-angriff");
  const btnAbbrechen = document.getElementById("btn-abbrechen");
  const btnVerschieben = document.getElementById("btn-verschieben");
  const btnBauen = document.getElementById("btn-bauen");
  const btnZugBeenden = document.getElementById("btn-zug-beenden");
  const ressourcenInfo = document.getElementById("ressourcen-info");
  const bauAuswahl = document.getElementById("bau-auswahl");

  ressourcenInfo.innerHTML = SPIELER.map((s) => `<div style="color:${s.farbe}">${s.name}: ${ressourcenText(s.id)}</div>`).join("");

  const spielerName = SPIELER.find((s) => s.id === aktiverSpieler).name;
  if (phase === "verstaerkung") {
    phaseInfo.innerHTML = `<b>${spielerName}</b> — Verstärkungsphase<br>Noch <b>${verstaerkungUebrig}</b> Truppen zu verteilen: eigenes Gebiet anklicken.`;
  } else if (mauerZielAuswahl) {
    phaseInfo.innerHTML = `<b>${spielerName}</b> — Spielzug<br>Mauer: angrenzendes Gebiet anklicken, das blockiert werden soll.`;
  } else if (bauModus) {
    phaseInfo.innerHTML = `<b>${spielerName}</b> — Spielzug<br>Bauen: ${bauZiel ? `Gebäudetyp für <b>${bauZiel}</b> wählen` : "eigenes Gebiet anklicken"}.`;
  } else if (verschiebenModus) {
    phaseInfo.innerHTML = `<b>${spielerName}</b> — Spielzug<br>Verschieben (noch ${verschiebenVerbleibend}x): Start-Gebiet ${verschiebenQuelle ? `<b>${verschiebenQuelle}</b> gewählt, jetzt Zielgebiet klicken` : "auswählen"}.`;
  } else if (belagerungModus) {
    phaseInfo.innerHTML = `<b>${spielerName}</b> — Spielzug<br>Belagerung: ${!belagerungVon ? "eigenes Gebiet (Angreifer) anklicken" : !belagerungZiel ? `<b>${belagerungVon}</b> gewählt, jetzt angrenzendes gegnerisches Zielgebiet klicken` : `bereit: ${belagerungVon} → ${belagerungZiel}`}.`;
  } else if (bombardierungModus) {
    phaseInfo.innerHTML = `<b>${spielerName}</b> — Spielzug<br>Bombardierung: ${!bombardierungVon ? "eigenes Gebiet anklicken" : !bombardierungZiel ? `<b>${bombardierungVon}</b> gewählt, jetzt angrenzendes gegnerisches Zielgebiet klicken` : `bereit: ${bombardierungVon} → ${bombardierungZiel}`}.`;
  } else {
    phaseInfo.innerHTML = `<b>${spielerName}</b> — Spielzug<br>Beliebig oft angreifen, optional bauen/verschieben (noch ${verschiebenVerbleibend}x), dann Zug beenden.`;
  }

  btnVerschieben.disabled = phase !== "spielzug" || verschiebenVerbleibend <= 0 || !amZug();
  btnVerschieben.classList.toggle("aktiv", verschiebenModus);
  btnBauen.disabled = phase !== "spielzug" || !amZug();
  btnBauen.classList.toggle("aktiv", bauModus);
  btnZugBeenden.disabled = phase !== "spielzug" || !amZug();

  bauAuswahl.hidden = !bauZiel;
  if (bauZiel) {
    const kostenText = (kosten) => Object.entries(kosten).map(([k, v]) => `${v} ${k}`).join(", ");
    bauAuswahl.innerHTML = Object.entries(GEBAEUDE_TYPEN).map(([typ, info2]) => {
      const geht = kannBauen(aktiverSpieler, bauZiel, typ);
      const kontinentHinweis = info2.nurKontinent ? ` (nur ${info2.nurKontinent})` : "";
      return `<button class="btn-gebaeude-typ" data-typ="${typ}" title="${info2.effektText}" ${geht ? "" : "disabled"}>${info2.code} ${info2.name} — ${kostenText(info2.kosten)}${kontinentHinweis}${info2.effektAktiv ? "" : " (Effekt folgt)"}</button>`;
    }).join("");
    bauAuswahl.querySelectorAll(".btn-gebaeude-typ").forEach((btn) => {
      btn.addEventListener("click", () => gebaeudeBauen(btn.dataset.typ));
    });
  }

  // --- Cybermarker ---
  const spieler = SPIELER.find((s) => s.id === aktiverSpieler);
  document.getElementById("cyber-info").innerHTML = SPIELER.map((s) => `<div style="color:${s.farbe}">${s.name}: ${s.cybermarker}/${CYBERMARKER_MAX} Cybermarker</div>`).join("");
  const btnCyberKaufen = document.getElementById("btn-cyber-kaufen");
  btnCyberKaufen.disabled = phase !== "spielzug" || !amZug() || spieler.cybermarker >= CYBERMARKER_MAX || spieler.ressourcen.energie < CYBERMARKER_KOSTEN;
  const chkCyber = document.getElementById("chk-cyber-einsetzen");
  chkCyber.checked = cyberEinsetzenAngriff;
  chkCyber.disabled = phase !== "spielzug" || !amZug() || spieler.cybermarker <= 0;

  // --- Belagerung ---
  const btnBelagerung = document.getElementById("btn-belagerung");
  btnBelagerung.disabled = phase !== "spielzug" || belagerungVerwendet || !amZug();
  btnBelagerung.classList.toggle("aktiv", belagerungModus);
  const btnBelagerungAusfuehren = document.getElementById("btn-belagerung-ausfuehren");
  btnBelagerungAusfuehren.hidden = !(belagerungModus && belagerungVon && belagerungZiel);
  const belagerungEffektDiv = document.getElementById("belagerung-effekt-auswahl");
  belagerungEffektDiv.hidden = !belagerungEffektAuswahl;
  if (belagerungEffektAuswahl) {
    belagerungEffektDiv.innerHTML = `<div style="font-size:12px;margin-bottom:4px">Effekt für ${belagerungEffektAuswahl.gebietId} wählen:</div>` +
      Object.entries(BELAGERUNGS_EFFEKTE).map(([key, e]) => `<button class="btn-belagerungs-effekt" data-effekt="${key}" title="${e.effektText}">${e.name}</button>`).join("");
    belagerungEffektDiv.querySelectorAll(".btn-belagerungs-effekt").forEach((btn) => {
      btn.addEventListener("click", () => belagerungEffektAnwenden(btn.dataset.effekt));
    });
  }

  // --- Bombardierung ---
  const btnBombardierung = document.getElementById("btn-bombardierung");
  btnBombardierung.disabled = phase !== "spielzug" || bombardierungVerwendet || !amZug() || spieler.ressourcen.energie < BOMBARDIERUNG_KOSTEN;
  btnBombardierung.classList.toggle("aktiv", bombardierungModus);
  document.getElementById("btn-bombardierung-ausfuehren").hidden = !(bombardierungModus && bombardierungVon && bombardierungZiel);

  // --- Reparatur ---
  const reparaturBlock = document.getElementById("reparatur-block");
  const reparaturListe = document.getElementById("reparatur-liste");
  const beschaedigte = [];
  Object.values(territorien).forEach((t) => {
    if (t.owner !== aktiverSpieler) return;
    t.gebaeude.forEach((b, i) => { if (b.beschaedigt && !b.reparaturBegonnen) beschaedigte.push({ t, b, i }); });
  });
  reparaturBlock.hidden = beschaedigte.length === 0;
  if (beschaedigte.length) {
    const kostenText = (kosten) => Object.entries(kosten).map(([k, v]) => `${v} ${k}`).join(", ");
    reparaturListe.innerHTML = beschaedigte.map(({ t, b, i }) => {
      const info2 = GEBAEUDE_TYPEN[b.typ];
      const kosten = reparaturKosten(b.typ);
      const geht = phase === "spielzug" && amZug() && kannBezahlen(aktiverSpieler, kosten);
      return `<button class="btn-reparieren" data-gebiet="${t.id}" data-index="${i}" ${geht ? "" : "disabled"}>${t.id}: ${info2.code} ${info2.name} — ${kostenText(kosten)}</button>`;
    }).join("");
    reparaturListe.querySelectorAll(".btn-reparieren").forEach((btn) => {
      btn.addEventListener("click", () => reparieren(btn.dataset.gebiet, Number(btn.dataset.index)));
    });
  }

  if (phase !== "spielzug" || verschiebenModus || bauModus || belagerungModus || bombardierungModus || !ausgewaehlt) {
    info.innerHTML = phase === "spielzug" && !verschiebenModus && !bauModus && !belagerungModus && !bombardierungModus
      ? "Kein Gebiet ausgewählt. Klicke ein eigenes Gebiet mit mehr als 1 Truppe."
      : "";
    btnAngriff.disabled = true;
    btnAbbrechen.disabled = !ausgewaehlt;
    return;
  }
  const A = territorien[ausgewaehlt];
  let html = `Von: <b>${A.id}</b> (${A.truppen} Truppen)`;
  if (ziel) {
    const D = territorien[ziel];
    html += `<br>Ziel: <b>${D.id}</b> (${D.truppen} Truppen, ${
      SPIELER.find((s) => s.id === D.owner)?.name ?? "Neutral"
    })`;
  } else {
    html += "<br>Klicke ein angrenzendes gegnerisches Gebiet als Ziel.";
  }
  info.innerHTML = html;
  btnAngriff.disabled = !ziel;
  btnAbbrechen.disabled = false;
}

function log(text, sieg) {
  const el = document.getElementById("log");
  const div = document.createElement("div");
  div.className = "eintrag" + (sieg ? " sieg" : "");
  div.textContent = text;
  el.appendChild(div);
}

// --- Interaktion ---
function onClickGebiet(id) {
  if (!amZug()) return;
  const t = territorien[id];

  if (phase === "verstaerkung") {
    if (t.owner !== aktiverSpieler || verstaerkungUebrig <= 0) return;
    t.truppen += 1;
    verstaerkungUebrig -= 1;
    if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
      NETZWERK.sende({ typ: "verstaerkung_platzieren", gebietId: id });
    }
    if (verstaerkungUebrig <= 0) {
      phase = "spielzug";
      log(`${SPIELER.find((s) => s.id === aktiverSpieler).name} — Verstärkung verteilt, Spielzug beginnt.`);
    }
    render(); updatePanel();
    return;
  }

  if (phase !== "spielzug") return;

  if (mauerZielAuswahl) {
    if (adjazenz.get(mauerZielAuswahl.gebietId)?.has(id)) {
      const mauerGebiet = territorien[mauerZielAuswahl.gebietId];
      mauerGebiet.gebaeude.push({ typ: "mauer", fertig: false, ziel: id });
      log(`${mauerGebiet.id}: Mauer im Bau, blockiert künftig Angriffe von ${id}.`);
      if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
        NETZWERK.sende({ typ: "gebaeude_bauen", gebietId: mauerGebiet.id, gebaeudeTyp: "mauer", ziel: id });
      }
    }
    mauerZielAuswahl = null;
    bauModus = false; bauZiel = null;
    render(); updatePanel();
    return;
  }

  if (bauModus) {
    if (t.owner === aktiverSpieler) bauZiel = id;
    else bauZiel = null;
    render(); updatePanel();
    return;
  }

  if (verschiebenModus) {
    if (verschiebenVerbleibend <= 0) return;
    if (!verschiebenQuelle) {
      if (t.owner === aktiverSpieler && t.truppen > 1) verschiebenQuelle = id;
      render(); updatePanel();
      return;
    }
    if (id === verschiebenQuelle) {
      verschiebenQuelle = null;
      render(); updatePanel();
      return;
    }
    if (t.owner === aktiverSpieler && adjazenz.get(verschiebenQuelle)?.has(id)) {
      verschiebenTruppen(verschiebenQuelle, id);
    }
    return;
  }

  if (belagerungModus) {
    if (belagerungVerwendet) return;
    if (!belagerungVon) {
      if (t.owner === aktiverSpieler && t.truppen > 1) belagerungVon = id;
      render(); updatePanel();
      return;
    }
    if (id === belagerungVon) { belagerungVon = null; render(); updatePanel(); return; }
    if (t.owner !== aktiverSpieler && adjazenz.get(belagerungVon)?.has(id)) {
      belagerungZiel = id;
      render(); updatePanel();
    }
    return;
  }

  if (bombardierungModus) {
    if (bombardierungVerwendet) return;
    if (!bombardierungVon) {
      if (t.owner === aktiverSpieler) bombardierungVon = id;
      render(); updatePanel();
      return;
    }
    if (id === bombardierungVon) { bombardierungVon = null; render(); updatePanel(); return; }
    if (t.owner !== aktiverSpieler && adjazenz.get(bombardierungVon)?.has(id)) {
      bombardierungZiel = id;
      render(); updatePanel();
    }
    return;
  }

  if (!ausgewaehlt) {
    if (t.owner === aktiverSpieler && t.truppen > 1) ausgewaehlt = id;
    render(); updatePanel();
    return;
  }
  if (id === ausgewaehlt) {
    ausgewaehlt = null; ziel = null;
    render(); updatePanel();
    return;
  }
  if (t.owner === aktiverSpieler) {
    ausgewaehlt = t.truppen > 1 ? id : ausgewaehlt;
    ziel = null;
    render(); updatePanel();
    return;
  }
  if (adjazenz.get(ausgewaehlt)?.has(id)) {
    ziel = id;
    render(); updatePanel();
  }
}

// verlegt alle bis auf 1 Truppe von "von" nach "nach"
function verschiebenTruppen(von, nach) {
  const A = territorien[von];
  const B = territorien[nach];
  const anzahl = A.truppen - 1;
  A.truppen = 1;
  B.truppen += anzahl;
  verschiebenQuelle = null;
  verschiebenVerbleibend -= 1;
  if (verschiebenVerbleibend <= 0) verschiebenModus = false;
  log(`${A.id} → ${B.id}: ${anzahl} Truppen verlegt.`);
  if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
    NETZWERK.sende({ typ: "verschieben", von, nach, anzahl });
  }
  render(); updatePanel();
}

// Prüft Baubarkeit: Kosten, kein Duplikat desselben Typs auf demselben Gebiet, Limit/Spieler.
function kannBauen(spielerId, gebietId, typ) {
  const t = territorien[gebietId];
  const info = GEBAEUDE_TYPEN[typ];
  // Regelwerk §5: während der Reparatur können auf dem Gebiet keine neuen Gebäude gebaut werden
  if (t.gebaeude.some((b) => b.beschaedigt)) return false;
  if (t.gebaeude.some((b) => b.typ === typ)) return false;
  if (info.nurKontinent && t.continentId !== info.nurKontinent) return false;
  if (info.limitProSpieler && zaehleAlleGebaeude(spielerId, typ) >= info.limitProSpieler) return false;
  return kannBezahlen(spielerId, info.kosten);
}

// Reparaturkosten aus Regelwerk §5: 50% der Baukosten immer, Energie 0 (Wirtschaft),
// 10 (Schildgenerator/Megafestung/Orbitalrelais/Orbitalstartrampe) oder 5 (alle anderen).
function reparaturEnergieFuer(typ) {
  const info = GEBAEUDE_TYPEN[typ];
  if (info.kategorie === "wirtschaft") return 0;
  return ["schildgenerator", "megafestung", "orbitalrelais", "orbitalstartrampe"].includes(typ) ? 10 : 5;
}
function reparaturKosten(typ) {
  const info = GEBAEUDE_TYPEN[typ];
  const kosten = {};
  Object.entries(info.kosten).forEach(([k, v]) => { if (k !== "energie") kosten[k] = Math.ceil(v * 0.5); });
  kosten.energie = reparaturEnergieFuer(typ);
  return kosten;
}

function reparieren(gebietId, index) {
  const t = territorien[gebietId];
  if (t.owner !== aktiverSpieler || phase !== "spielzug" || !amZug()) return;
  const b = t.gebaeude[index];
  if (!b || !b.beschaedigt || b.reparaturBegonnen) return;
  const kosten = reparaturKosten(b.typ);
  if (!kannBezahlen(aktiverSpieler, kosten)) return;
  bezahlen(aktiverSpieler, kosten);
  b.reparaturBegonnen = true;
  log(`${t.id}: Reparatur von ${GEBAEUDE_TYPEN[b.typ].name} begonnen (fertig zur nächsten eigenen Runde).`);
  if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
    NETZWERK.sende({ typ: "reparieren", gebietId, index });
  }
  render(); updatePanel();
}

function gebaeudeBauen(typ) {
  if (!bauZiel || phase !== "spielzug" || !amZug()) return;
  const t = territorien[bauZiel];
  if (t.owner !== aktiverSpieler) return;
  if (!kannBauen(aktiverSpieler, bauZiel, typ)) return;
  const info = GEBAEUDE_TYPEN[typ];
  bezahlen(aktiverSpieler, info.kosten);

  if (info.brauchtZiel) {
    // Mauer: Kosten sind bezahlt, jetzt noch das zu blockierende Nachbargebiet anklicken lassen
    mauerZielAuswahl = { gebietId: bauZiel };
    render(); updatePanel();
    return;
  }

  t.gebaeude.push({ typ, fertig: false });
  log(`${t.id}: ${info.name} im Bau (fertig zur nächsten eigenen Runde).`);
  if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
    NETZWERK.sende({ typ: "gebaeude_bauen", gebietId: bauZiel, gebaeudeTyp: typ });
  }
  bauModus = false;
  bauZiel = null;
  render(); updatePanel();
}

function cybermarkerKaufen() {
  if (phase !== "spielzug" || !amZug()) return;
  const s = SPIELER.find((sp) => sp.id === aktiverSpieler);
  if (s.cybermarker >= CYBERMARKER_MAX || s.ressourcen.energie < CYBERMARKER_KOSTEN) return;
  s.ressourcen.energie -= CYBERMARKER_KOSTEN;
  s.cybermarker += 1;
  log(`${s.name}: Cybermarker gekauft (${s.cybermarker}/${CYBERMARKER_MAX}).`);
  if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
    NETZWERK.sende({ typ: "cybermarker_kaufen" });
  }
  render(); updatePanel();
}

// Belagerung: Kampf läuft regulär (kein Cybermarker-Slot extra -- nutzt denselben Kern wie
// ein normaler Angriff), danach darf bei Nichteroberung ein Belagerungseffekt gewählt werden.
// Max. 1x pro Spieler und Runde (Regelwerk §4).
const BELAGERUNGS_EFFEKTE = {
  schwaechen: { name: "Verteidigung schwächen", effektText: "-1 Verteidigungswürfel für die nächste Runde" },
  deaktivieren: { name: "Infrastruktur deaktivieren", effektText: "1 gegnerisches Gebäude wird für 1 Runde inaktiv (ohne Reparaturkosten)" },
  moralbruch: { name: "Moralbruch", effektText: "Verteidiger verliert zusätzlich 1 Truppe" },
};

function belagerungAusfuehren() {
  if (phase !== "spielzug" || !amZug() || belagerungVerwendet || !belagerungVon || !belagerungZiel) return;
  const A = territorien[belagerungVon];
  const D = territorien[belagerungZiel];
  const mauerBlockt = D.gebaeude.some((b) => b.fertig && !b.beschaedigt && b.typ === "mauer" && b.ziel === A.id);
  if (mauerBlockt) {
    log(`${A.id} → ${D.id}: Belagerung durch Mauer blockiert.`);
    belagerungModus = false; belagerungVon = null; belagerungZiel = null;
    render(); updatePanel();
    return;
  }
  const r = fuehreKampfDurch(A, D, false);
  belagerungVerwendet = true;
  if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
    NETZWERK.sende({
      typ: "angriff", von: A.id, nach: D.id, aWuerfel: r.aWuerfel, dWuerfel: r.dWuerfel,
      aVerlust: r.aVerlust, dVerlust: r.dVerlust, aNeu: A.truppen, dNeu: D.truppen, dBesitzer: D.owner,
      erobert: r.erobert, verschoben: r.verschoben, cyberEingesetzt: false, gebaeudeD: D.gebaeude,
    });
  }
  if (!r.erobert) {
    belagerungEffektAuswahl = { gebietId: D.id };
  }
  belagerungModus = false; belagerungVon = null; belagerungZiel = null;
  render(); updatePanel();
}

function belagerungEffektAnwenden(effekt) {
  if (!belagerungEffektAuswahl) return;
  const D = territorien[belagerungEffektAuswahl.gebietId];
  if (effekt === "schwaechen") {
    D.belagert = true; // -1 Verteidigungswürfel nächste Runde, siehe fuehreKampfDurch-Erweiterung unten
  } else if (effekt === "deaktivieren") {
    const ziel = D.gebaeude.find((b) => !b.beschaedigt);
    if (ziel) { ziel.beschaedigt = true; ziel.reparaturBegonnen = true; ziel.gratisReparatur = true; }
  } else if (effekt === "moralbruch") {
    D.truppen = Math.max(1, D.truppen - 1);
  }
  log(`${D.id}: Belagerungseffekt "${BELAGERUNGS_EFFEKTE[effekt].name}" angewendet.`);
  if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
    NETZWERK.sende({ typ: "belagerung_effekt", gebietId: D.id, effekt });
  }
  belagerungEffektAuswahl = null;
  render(); updatePanel();
}

// Bombardierung: 1x/Zug, fixe Kosten, direkter Truppenschaden ohne Würfelduell,
// Gebiet wird nicht eingenommen (Regelwerk §4).
function bombardierungAusfuehren() {
  if (phase !== "spielzug" || !amZug() || bombardierungVerwendet || !bombardierungVon || !bombardierungZiel) return;
  const s = SPIELER.find((sp) => sp.id === aktiverSpieler);
  if (s.ressourcen.energie < BOMBARDIERUNG_KOSTEN) return;
  const D = territorien[bombardierungZiel];
  s.ressourcen.energie -= BOMBARDIERUNG_KOSTEN;
  const schaden = 1 + Math.floor(Math.random() * 6);
  const verloren = Math.min(schaden, D.truppen - 1);
  D.truppen = Math.max(1, D.truppen - schaden);
  bombardierungVerwendet = true;
  log(`${bombardierungVon} bombardiert ${D.id}: -${verloren} Truppen.`);
  if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
    NETZWERK.sende({ typ: "bombardierung", gebietId: D.id, dNeu: D.truppen });
  }
  bombardierungModus = false; bombardierungVon = null; bombardierungZiel = null;
  render(); updatePanel();
}

function zugBeenden() {
  if (phase !== "spielzug" || !amZug()) return;
  const naechster = SPIELER.find((s) => s.id !== aktiverSpieler).id;
  if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
    NETZWERK.sende({ typ: "zug_ende", naechsterSpieler: naechster });
  }
  rundenStart(naechster);
}

function wuerfeln(n) {
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);
}

// Wird beim Besitzwechsel aufgerufen: bestehende Gebäude bleiben stehen, gelten aber als
// beschädigt (wirken nicht, produzieren nichts), bis sie repariert werden (Regelwerk §5).
function beiBesitzwechselBeschaedigen(t) {
  t.gebaeude.forEach((b) => { b.beschaedigt = true; b.reparaturBegonnen = false; });
}

// Gemeinsamer Kampf-Kern für normalen Angriff und Belagerung.
function fuehreKampfDurch(A, D, cyberVerwenden) {
  const angreiferBonus = (hatAktivesGebaeude(A, "geschuetz") || hatAktivesGebaeude(A, "megafestung")) ? 1 : 0;
  const verteidigerBonus = (hatAktivesGebaeude(D, "flagstellung") || hatAktivesGebaeude(D, "megafestung")) ? 1 : 0;
  const schildAbzug = hatAktivesGebaeude(D, "schildgenerator") ? 1 : 0;
  const belagertAbzug = D.belagert ? 1 : 0; // Belagerungseffekt "Verteidigung schwächen" -- gilt für die nächste Verteidigung
  D.belagert = false;

  const aAnzahl = Math.max(1, Math.min(A.truppen - 1, 3 + angreiferBonus - schildAbzug));
  const dAnzahl = Math.max(1, Math.min(D.truppen, 2 + verteidigerBonus - belagertAbzug));
  const aWuerfel = wuerfeln(aAnzahl);
  const dWuerfel = wuerfeln(dAnzahl);

  let cyberEingesetzt = false;
  if (cyberVerwenden && SPIELER.find((s) => s.id === A.owner).cybermarker > 0) {
    const minIdx = aWuerfel.indexOf(Math.min(...aWuerfel));
    if (aWuerfel[minIdx] < 6) {
      aWuerfel[minIdx] = 6;
      aWuerfel.sort((a, b) => b - a);
      SPIELER.find((s) => s.id === A.owner).cybermarker -= 1;
      cyberEingesetzt = true;
    }
  }

  let aVerlust = 0, dVerlust = 0;
  for (let i = 0; i < Math.min(aWuerfel.length, dWuerfel.length); i++) {
    if (aWuerfel[i] > dWuerfel[i]) dVerlust++; else aVerlust++;
  }
  A.truppen -= aVerlust;
  D.truppen -= dVerlust;

  let erobert = false;
  let verschoben = 0;
  if (D.truppen <= 0) {
    verschoben = Math.max(A.truppen - 1, 1);
    D.owner = A.owner;
    D.truppen = verschoben;
    A.truppen -= verschoben;
    erobert = true;
    beiBesitzwechselBeschaedigen(D);
  }

  log(`${A.id} [${aWuerfel.join(",")}] vs ${D.id} [${dWuerfel.join(",")}] → Angreifer -${aVerlust}, Verteidiger -${dVerlust}` + (cyberEingesetzt ? " (Cybermarker eingesetzt)" : "") + (erobert ? ` – erobert (${verschoben} verlegt)` : ""), erobert);

  return { aWuerfel, dWuerfel, aVerlust, dVerlust, erobert, verschoben, cyberEingesetzt };
}

function angriff() {
  if (phase !== "spielzug" || !amZug() || !ausgewaehlt || !ziel) return;
  const A = territorien[ausgewaehlt];
  const D = territorien[ziel];

  // Mauer: blockiert Angriffe explizit aus einem gewählten Nachbargebiet
  const mauerBlockt = D.gebaeude.some((b) => b.fertig && !b.beschaedigt && b.typ === "mauer" && b.ziel === A.id);
  if (mauerBlockt) {
    log(`${A.id} → ${D.id}: Angriff durch Mauer blockiert.`);
    return;
  }

  const cyberVerwenden = cyberEinsetzenAngriff;
  const r = fuehreKampfDurch(A, D, cyberVerwenden);
  cyberEinsetzenAngriff = false;

  if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
    NETZWERK.sende({
      typ: "angriff", von: A.id, nach: D.id, aWuerfel: r.aWuerfel, dWuerfel: r.dWuerfel,
      aVerlust: r.aVerlust, dVerlust: r.dVerlust, aNeu: A.truppen, dNeu: D.truppen, dBesitzer: D.owner,
      erobert: r.erobert, verschoben: r.verschoben, cyberEingesetzt: r.cyberEingesetzt, gebaeudeD: D.gebaeude,
    });
  }

  if (r.erobert || A.truppen <= 1) { ausgewaehlt = null; ziel = null; }

  render(); updatePanel();
}

if (typeof NETZWERK !== "undefined") {
  NETZWERK.aufEmpfang((daten) => {
    if (daten.typ === "angriff") {
      const A = territorien[daten.von];
      const D = territorien[daten.nach];
      A.truppen = daten.aNeu;
      D.truppen = daten.dNeu;
      D.owner = daten.dBesitzer;
      if (daten.gebaeudeD) D.gebaeude = daten.gebaeudeD;
      if (daten.cyberEingesetzt) SPIELER.find((s) => s.id === A.owner).cybermarker -= 1;
      log(`${daten.von} [${daten.aWuerfel.join(",")}] vs ${daten.nach} [${daten.dWuerfel.join(",")}] → Angreifer -${daten.aVerlust}, Verteidiger -${daten.dVerlust}` + (daten.cyberEingesetzt ? " (Cybermarker eingesetzt)" : "") + (daten.erobert ? ` – erobert (${daten.verschoben} verlegt)` : ""), daten.erobert);
      render(); updatePanel();
    } else if (daten.typ === "verstaerkung_platzieren") {
      territorien[daten.gebietId].truppen += 1;
      render(); updatePanel();
    } else if (daten.typ === "verschieben") {
      territorien[daten.von].truppen -= daten.anzahl;
      territorien[daten.nach].truppen += daten.anzahl;
      log(`${daten.von} → ${daten.nach}: ${daten.anzahl} Truppen verlegt.`);
      render(); updatePanel();
    } else if (daten.typ === "zug_ende") {
      rundenStart(daten.naechsterSpieler);
    } else if (daten.typ === "gebaeude_bauen") {
      const t = territorien[daten.gebietId];
      const info = GEBAEUDE_TYPEN[daten.gebaeudeTyp];
      bezahlen(t.owner, info.kosten);
      const eintrag = { typ: daten.gebaeudeTyp, fertig: false };
      if (daten.ziel) eintrag.ziel = daten.ziel;
      t.gebaeude.push(eintrag);
      log(`${t.id}: ${info.name} im Bau (fertig zur nächsten eigenen Runde).`);
      render(); updatePanel();
    } else if (daten.typ === "cybermarker_kaufen") {
      const s = SPIELER.find((sp) => sp.id === aktiverSpieler);
      s.ressourcen.energie -= CYBERMARKER_KOSTEN;
      s.cybermarker += 1;
      render(); updatePanel();
    } else if (daten.typ === "reparieren") {
      const t = territorien[daten.gebietId];
      const b = t.gebaeude[daten.index];
      bezahlen(t.owner, reparaturKosten(b.typ));
      b.reparaturBegonnen = true;
      log(`${t.id}: Reparatur von ${GEBAEUDE_TYPEN[b.typ].name} begonnen (fertig zur nächsten eigenen Runde).`);
      render(); updatePanel();
    } else if (daten.typ === "belagerung_effekt") {
      const D = territorien[daten.gebietId];
      if (daten.effekt === "schwaechen") D.belagert = true;
      else if (daten.effekt === "deaktivieren") {
        const ziel = D.gebaeude.find((b) => !b.beschaedigt);
        if (ziel) { ziel.beschaedigt = true; ziel.reparaturBegonnen = true; }
      } else if (daten.effekt === "moralbruch") D.truppen = Math.max(1, D.truppen - 1);
      log(`${D.id}: Belagerungseffekt "${BELAGERUNGS_EFFEKTE[daten.effekt].name}" angewendet.`);
      render(); updatePanel();
    } else if (daten.typ === "bombardierung") {
      territorien[daten.gebietId].truppen = daten.dNeu;
      log(`${daten.gebietId} wurde bombardiert.`);
      render(); updatePanel();
    }
  });
}

// --- Bot (Gegner-KI) ---
// Einfache regelbasierte, vorsichtige KI: baut zuerst Wirtschaft/Grenzverteidigung aus und
// greift nur bei klarer Übermacht an. Nutzt dieselben Funktionen wie ein menschlicher Klick
// (angriff(), gebaeudeBauen(), cybermarkerKaufen(), belagerungAusfuehren(), ...), damit
// Kampf-/Kostenlogik garantiert identisch bleibt.
const BOT_ANGRIFFS_SCHWELLE = 2; // eigene Truppen müssen mind. doppelt so hoch sein wie die des Ziels
const BOT_ENERGIE_PUFFER = 20; // Reserve, die Sondermechaniken nicht antasten sollen
const BOT_WIRTSCHAFT_TYPEN = ["mine", "farm", "kraftwerk", "raffinerie"];
const BOT_GRENZ_VERTEIDIGUNG_TYPEN = ["flagstellung", "geschuetz", "schildgenerator"]; // Mauer bewusst ausgenommen (braucht Zielwahl)

function botEigeneGebiete(spielerId) {
  return Object.values(territorien).filter((t) => t.owner === spielerId);
}

function botIstGrenzgebiet(t) {
  const nachbarn = adjazenz.get(t.id);
  if (!nachbarn) return false;
  for (const n of nachbarn) {
    if (territorien[n].owner !== t.owner) return true;
  }
  return false;
}

function botVerstaerkungVerteilen(spielerId) {
  let sicherheit = 0;
  while (verstaerkungUebrig > 0 && phase === "verstaerkung" && sicherheit < 200) {
    sicherheit++;
    const eigene = botEigeneGebiete(spielerId);
    if (eigene.length === 0) break;
    const grenzgebiete = eigene.filter(botIstGrenzgebiet);
    const kandidaten = grenzgebiete.length ? grenzgebiete : eigene;
    const ziel = kandidaten.slice().sort((a, b) => a.truppen - b.truppen)[0];
    onClickGebiet(ziel.id);
  }
}

// Priorität 1: pro fehlendem Wirtschaftsgebäudetyp eines bauen (irgendwo, wo es geht).
// Priorität 2: Grenzgebiete ohne Verteidigungsgebäude eines der drei einfachen Typen geben.
function botBauen(spielerId) {
  let sicherheit = 0;
  let weiterBauen = true;
  while (weiterBauen && sicherheit < 10) {
    sicherheit++;
    weiterBauen = false;
    const eigene = botEigeneGebiete(spielerId);

    const fehlenderTyp = BOT_WIRTSCHAFT_TYPEN.find((typ) => zaehleAlleGebaeude(spielerId, typ) === 0);
    if (fehlenderTyp) {
      const ziel = eigene.find((t) => kannBauen(spielerId, t.id, fehlenderTyp));
      if (ziel) {
        bauZiel = ziel.id;
        gebaeudeBauen(fehlenderTyp);
        weiterBauen = true;
        continue;
      }
    }

    const grenzOhneVerteidigung = eigene.filter(
      (t) => botIstGrenzgebiet(t) && !t.gebaeude.some((b) => BOT_GRENZ_VERTEIDIGUNG_TYPEN.includes(b.typ))
    );
    for (const t of grenzOhneVerteidigung) {
      const typ = BOT_GRENZ_VERTEIDIGUNG_TYPEN.find((typ2) => kannBauen(spielerId, t.id, typ2));
      if (typ) {
        bauZiel = t.id;
        gebaeudeBauen(typ);
        weiterBauen = true;
        break;
      }
    }
  }
  bauModus = false;
  bauZiel = null;
}

function botCybermarkerKaufen(spielerId) {
  const s = SPIELER.find((sp) => sp.id === spielerId);
  let sicherheit = 0;
  while (s.cybermarker < CYBERMARKER_MAX && s.ressourcen.energie - CYBERMARKER_KOSTEN >= BOT_ENERGIE_PUFFER && sicherheit < 5) {
    cybermarkerKaufen();
    sicherheit++;
  }
}

// Vorsichtig: greift nur an, wenn eigene Truppen (abzüglich der einen, die stehen bleiben
// muss) mindestens BOT_ANGRIFFS_SCHWELLE-mal so hoch sind wie die des Verteidigers, und
// wählt je Durchgang den Angriff mit dem größten Vorteil. Setzt bei knappem Vorteil den
// eigenen Cybermarker ein, um den Sieg abzusichern.
function botAngreifen(spielerId) {
  let sicherheit = 0;
  while (sicherheit < 30) {
    sicherheit++;
    const eigene = botEigeneGebiete(spielerId);
    let bester = null;
    for (const t of eigene) {
      if (t.truppen <= 3) continue;
      const nachbarn = adjazenz.get(t.id);
      if (!nachbarn) continue;
      for (const nId of nachbarn) {
        const n = territorien[nId];
        if (n.owner === spielerId) continue;
        const mauerBlockt = n.gebaeude.some((b) => b.fertig && !b.beschaedigt && b.typ === "mauer" && b.ziel === t.id);
        if (mauerBlockt) continue;
        if (t.truppen - 1 >= n.truppen * BOT_ANGRIFFS_SCHWELLE) {
          const vorteil = t.truppen - n.truppen;
          if (!bester || vorteil > bester.vorteil) bester = { von: t.id, nach: nId, vorteil, dTruppen: n.truppen };
        }
      }
    }
    if (!bester) break;
    const s = SPIELER.find((sp) => sp.id === spielerId);
    ausgewaehlt = bester.von;
    ziel = bester.nach;
    cyberEinsetzenAngriff = s.cybermarker > 0 && bester.vorteil < bester.dTruppen;
    angriff();
  }
  ausgewaehlt = null;
  ziel = null;
  cyberEinsetzenAngriff = false;
}

// Belagerung/Bombardierung gegen ein Grenzgebiet, das dem Bot aktuell zu stark zum direkten
// Angreifen ist (Regelwerk-konform max. 1x/Zug je Mechanik) -- schwächt den Gegner, statt
// ihn unangetastet zu lassen. Bevorzugt bei Belagerung den Effekt "Verteidigung schwächen"
// (vorsichtig: bereitet den nächsten eigenen Zug vor, statt riskant zu eskalieren).
function botFindeUeberlegenesGrenzziel(spielerId, minTruppen) {
  const eigene = botEigeneGebiete(spielerId);
  for (const t of eigene) {
    if (t.truppen < minTruppen) continue;
    const nachbarn = adjazenz.get(t.id);
    if (!nachbarn) continue;
    for (const nId of nachbarn) {
      const n = territorien[nId];
      if (n.owner === spielerId) continue;
      if (n.truppen > t.truppen) return { von: t.id, nach: nId };
    }
  }
  return null;
}

function botSondermechaniken(spielerId) {
  const s = SPIELER.find((sp) => sp.id === spielerId);

  if (!bombardierungVerwendet && s.ressourcen.energie - BOMBARDIERUNG_KOSTEN >= BOT_ENERGIE_PUFFER) {
    const ziel = botFindeUeberlegenesGrenzziel(spielerId, 1);
    if (ziel) {
      bombardierungVon = ziel.von;
      bombardierungZiel = ziel.nach;
      bombardierungAusfuehren();
    }
  }

  if (!belagerungVerwendet) {
    const ziel = botFindeUeberlegenesGrenzziel(spielerId, 2);
    if (ziel) {
      belagerungVon = ziel.von;
      belagerungZiel = ziel.nach;
      belagerungAusfuehren();
      if (belagerungEffektAuswahl) belagerungEffektAnwenden("schwaechen");
    }
  }
}

// Konsolidiert Truppen aus dem Landesinneren an die Grenze, wenn eine Verschiebung übrig ist.
function botVerschieben(spielerId) {
  if (verschiebenVerbleibend <= 0) return;
  const eigene = botEigeneGebiete(spielerId);
  const innenGebiete = eigene.filter((t) => !botIstGrenzgebiet(t) && t.truppen > 3);
  for (const t of innenGebiete) {
    const nachbarn = [...(adjazenz.get(t.id) || [])].filter((nId) => territorien[nId].owner === spielerId);
    const grenzZiel = nachbarn.find((nId) => botIstGrenzgebiet(territorien[nId]));
    if (grenzZiel) {
      verschiebenTruppen(t.id, grenzZiel);
      break;
    }
  }
}

function botZug(spielerId) {
  if (aktiverSpieler !== spielerId || !SPIELER.find((s) => s.id === spielerId)?.istBot) return;
  botRenderStumm = true;
  botVerstaerkungVerteilen(spielerId);
  phase = "spielzug";
  botBauen(spielerId);
  botCybermarkerKaufen(spielerId);
  botAngreifen(spielerId);
  botSondermechaniken(spielerId);
  botVerschieben(spielerId);
  botRenderStumm = false;
  render();
  updatePanel();
  zugBeenden();
}

document.getElementById("btn-angriff").addEventListener("click", angriff);
document.getElementById("btn-abbrechen").addEventListener("click", () => {
  ausgewaehlt = null; ziel = null; verschiebenQuelle = null; bauZiel = null; mauerZielAuswahl = null; render(); updatePanel();
});
document.getElementById("btn-verschieben").addEventListener("click", () => {
  if (phase !== "spielzug" || verschiebenVerbleibend <= 0 || !amZug()) return;
  verschiebenModus = !verschiebenModus;
  bauModus = false; bauZiel = null;
  verschiebenQuelle = null;
  ausgewaehlt = null; ziel = null;
  render(); updatePanel();
});
document.getElementById("btn-bauen").addEventListener("click", () => {
  if (phase !== "spielzug" || !amZug()) return;
  bauModus = !bauModus;
  verschiebenModus = false; verschiebenQuelle = null;
  bauZiel = null;
  ausgewaehlt = null; ziel = null;
  render(); updatePanel();
});
document.getElementById("btn-zug-beenden").addEventListener("click", zugBeenden);

document.getElementById("btn-cyber-kaufen").addEventListener("click", cybermarkerKaufen);
document.getElementById("chk-cyber-einsetzen").addEventListener("change", (e) => {
  cyberEinsetzenAngriff = e.target.checked;
});
document.getElementById("btn-belagerung").addEventListener("click", () => {
  if (phase !== "spielzug" || belagerungVerwendet || !amZug()) return;
  belagerungModus = !belagerungModus;
  bauModus = false; bauZiel = null;
  verschiebenModus = false; verschiebenQuelle = null;
  bombardierungModus = false; bombardierungVon = null; bombardierungZiel = null;
  belagerungVon = null; belagerungZiel = null;
  ausgewaehlt = null; ziel = null;
  render(); updatePanel();
});
document.getElementById("btn-bombardierung").addEventListener("click", () => {
  if (phase !== "spielzug" || bombardierungVerwendet || !amZug()) return;
  bombardierungModus = !bombardierungModus;
  bauModus = false; bauZiel = null;
  verschiebenModus = false; verschiebenQuelle = null;
  belagerungModus = false; belagerungVon = null; belagerungZiel = null;
  bombardierungVon = null; bombardierungZiel = null;
  ausgewaehlt = null; ziel = null;
  render(); updatePanel();
});
document.getElementById("btn-bombardierung-ausfuehren").addEventListener("click", bombardierungAusfuehren);
document.getElementById("btn-belagerung-ausfuehren").addEventListener("click", belagerungAusfuehren);

const spielerAuswahl = document.getElementById("spieler-auswahl");
SPIELER.forEach((s) => {
  const zeile = document.createElement("div");
  zeile.className = "spieler-zeile";

  const btn = document.createElement("button");
  btn.className = "spieler-btn" + (s.id === aktiverSpieler ? " aktiv" : "");
  btn.dataset.spielerId = s.id;
  btn.textContent = s.name;
  btn.style.color = s.farbe;
  // Manueller Spielerwechsel dient nur dem lokalen Hotseat-Testen (überspringt die
  // laufende Phase des vorherigen Spielers wie ein erzwungenes Rundenende).
  btn.addEventListener("click", () => rundenStart(s.id));

  const botLabel = document.createElement("label");
  botLabel.style.cssText = "display:flex;align-items:center;gap:4px;font-size:12px;margin-left:8px";
  const botCheckbox = document.createElement("input");
  botCheckbox.type = "checkbox";
  botCheckbox.checked = s.istBot;
  botCheckbox.addEventListener("change", (e) => {
    s.istBot = e.target.checked;
    // Falls gerade dieser Spieler am Zug ist und jetzt zum Bot wird, direkt übernehmen.
    if (s.istBot && aktiverSpieler === s.id) setTimeout(() => botZug(s.id), BOT_VERZOEGERUNG_MS);
  });
  botLabel.appendChild(botCheckbox);
  botLabel.appendChild(document.createTextNode("KI"));

  zeile.appendChild(btn);
  zeile.appendChild(botLabel);
  spielerAuswahl.appendChild(zeile);
});

rundenStart(aktiverSpieler);
