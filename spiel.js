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
  ozeane: "#1f5f7a",
};
const SPIELER = [
  { id: 1, name: "Spieler 1", farbe: "#d1495b", ressourcen: { metall: 5, nahrung: 5, treibstoff: 5, energie: 10 }, cybermarker: 0, istBot: false },
  { id: 2, name: "Spieler 2", farbe: "#3a86ff", ressourcen: { metall: 5, nahrung: 5, treibstoff: 5, energie: 10 }, cybermarker: 0, istBot: false },
];
// Verzögerung, bevor der Bot nach Rundenbeginn zu handeln anfängt (nur Optik, kein Balancing).
const BOT_VERZOEGERUNG_MS = 500;
const ENERGIE_MAX = 50;
// Obergrenzen für Metall/Nahrung/Treibstoff: eigener Zusatz (bestätigt 17.09.2026), da das
// Regelwerk dafür keine Zahl nennt (nur Energie hat mit 50 eine feste Grenze). Verhindert das
// im Playtesting gefundene Aufstauen vierstelliger Ressourcenmengen, wenn nach ausgebauter
// Wirtschaft/Verteidigung nichts mehr zum Ausgeben bleibt.
const RESSOURCEN_MAX = 100;
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

  // Wirtschaft, Fortsetzung (W08 laut Mastertabelle). "Herrschaftsmarker"-Effekt ist im
  // Regelwerk nicht definiert -- baubar, aber ohne eigene Spielwirkung außer als Zielgebiet
  // für die Kampagne (Episode 7: "gegnerisches Hauptquartier erobern", siehe unten). Limit
  // 1/Spieler ist ein eigener, plausibler Zusatz (ein "Hauptquartier" sollte nicht beliebig
  // oft baubar sein), im Regelwerk nicht explizit festgelegt.
  hauptquartier: { code: "W08", name: "Hauptquartier", kategorie: "wirtschaft", kosten: { metall: 3, energie: 15 }, limitProSpieler: 1, effektAktiv: false, effektText: "Herrschaftsmarker (Effekt nicht definiert) -- dient als Kampagnen-Zielgebiet (Episode 7)" },

  // Sondergebäude (kontinentgebunden)
  dekontaminationsanlage: { code: "S01", name: "Dekontaminationsanlage", kategorie: "sonder", kosten: { metall: 2, treibstoff: 1, energie: 10 }, effektAktiv: true, nurKontinent: "bruch", effektText: "Schützt dieses Gebiet vor der Kontamination in Der Bruch (-1 Nahrung/Runde)" },
  orbitalstartrampe: { code: "S02", name: "Orbitalstartrampe", kategorie: "sonder", kosten: { metall: 5, treibstoff: 3, energie: 30 }, limitProSpieler: 1, effektAktiv: false, nurKontinent: "konstrukt", effektText: "Schaltet Zugang zum Orbitalring frei (Effekt folgt, braucht Orbitalring als echte Karte). Baubar erst ab Kampagnen-Episode 6, außerhalb der Kampagne uneingeschränkt." },
};

// Design-Feinschliff (16.09.2026): ein Icon pro Gebäudetyp statt nur des Textcodes im
// Bau-Menü. Bewusst nur einfache Grundformen (Kreis/Rechteck/Linie/Polygon, kaum Kurven),
// damit die Icons auch ohne visuelle Zwischenprüfung zuverlässig rendern. Form gruppiert
// nach Kategorie (Kreis-Ecken=Wirtschaft, Schild/Burg=Verteidigung, Turm/Kiste=Infrastruktur,
// Diamant=Sonder), Farbe ebenfalls nach Kategorie über CSS (.icon-<kategorie>).
const GEBAEUDE_ICON_PFADE = {
  mine: '<polygon points="12,6 18,17 6,17"/><circle cx="12" cy="13" r="1.3" fill="currentColor" stroke="none"/>',
  farm: '<path d="M6 18 C6 10 10 6 18 6 C18 14 14 18 6 18 Z"/><line x1="7" y1="17" x2="17" y2="7"/>',
  kraftwerk: '<polygon points="13,5 8,13 11,13 10,19 16,10 13,10"/>',
  raffinerie: '<polygon points="12,5 16,13 12,19 8,13"/>',
  hauptquartier: '<line x1="8" y1="19" x2="8" y2="6"/><polygon points="8,6 17,9 8,12"/>',

  mauer: '<rect x="4" y="8" width="7" height="4"/><rect x="13" y="8" width="7" height="4"/><rect x="4" y="13" width="3" height="4"/><rect x="9" y="13" width="7" height="4"/><rect x="18" y="13" width="2" height="4"/>',
  minenguertel: '<circle cx="12" cy="13" r="3"/><line x1="12" y1="8" x2="12" y2="10"/><line x1="12" y1="16" x2="12" y2="18"/><line x1="7" y1="13" x2="9" y2="13"/><line x1="15" y1="13" x2="17" y2="13"/>',
  flagstellung: '<polyline points="6,15 12,9 18,15" fill="none"/>',
  geschuetz: '<rect x="6" y="10" width="12" height="3"/><circle cx="6" cy="16" r="3"/>',
  radar: '<circle cx="12" cy="13" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="13" r="5" fill="none"/><circle cx="12" cy="13" r="8" fill="none"/>',
  artilleriestellung: '<polygon points="12,5 14,11 20,13 14,15 12,21 10,15 4,13 10,11"/>',
  flugabwehr: '<polyline points="8,14 12,7 16,14" fill="none"/><line x1="12" y1="7" x2="12" y2="19"/>',
  kuestenbatterie: '<rect x="9" y="6" width="6" height="6"/><polyline points="4,16 7,14 10,16 13,14 16,16 19,14" fill="none"/>',
  schildgenerator: '<polygon points="12,5 18,8 18,13 12,20 6,13 6,8" fill="none"/>',
  megafestung: '<rect x="6" y="11" width="12" height="8"/><rect x="6" y="7" width="3" height="4"/><rect x="10.5" y="7" width="3" height="4"/><rect x="15" y="7" width="3" height="4"/>',

  aussenposten: '<polygon points="12,7 18,18 6,18" fill="none"/><line x1="12" y1="7" x2="12" y2="18"/>',
  kontrollpunkt: '<line x1="6" y1="18" x2="6" y2="10"/><line x1="18" y1="18" x2="18" y2="10"/><line x1="5" y1="10" x2="19" y2="10"/>',
  kommandozentrale: '<line x1="12" y1="6" x2="12" y2="18"/><circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"/><line x1="12" y1="18" x2="8" y2="19"/><line x1="12" y1="18" x2="16" y2="19"/>',
  reparaturdock: '<circle cx="7" cy="8" r="2.2"/><line x1="9" y1="10" x2="16" y2="17"/><circle cx="17" cy="18" r="2.2"/>',
  versorgungsdepot: '<rect x="6" y="9" width="12" height="9"/><line x1="6" y1="9" x2="18" y2="9"/><line x1="12" y1="9" x2="12" y2="18"/>',
  sabotagezentrum: '<circle cx="12" cy="13" r="7" fill="none"/><polyline points="9,13 11,10 13,16 15,13" fill="none"/>',
  propagandaturm: '<polygon points="6,11 13,8 13,18 6,15"/><rect x="13" y="11" width="3" height="4"/>',
  geheimerstuetzpunkt: '<path d="M5 13 Q12 8 19 13 Q12 18 5 13 Z" fill="none"/><circle cx="12" cy="13" r="2" fill="currentColor" stroke="none"/>',
  orbitalrelais: '<rect x="10" y="11" width="4" height="4"/><line x1="6" y1="9" x2="10" y2="12"/><line x1="18" y1="9" x2="14" y2="12"/><ellipse cx="12" cy="13" rx="9" ry="3" fill="none"/>',

  dekontaminationsanlage: '<polygon points="12,5 16,13 12,19 8,13" fill="none"/><line x1="10" y1="11" x2="14" y2="15"/><line x1="14" y1="11" x2="10" y2="15"/>',
  orbitalstartrampe: '<polygon points="12,5 15,11 9,11"/><rect x="9" y="11" width="6" height="6"/><polygon points="9,17 6,20 9,20"/><polygon points="15,17 18,20 15,20"/>',
};

function gebaeudeIconSvg(typ, groesse) {
  const info = GEBAEUDE_TYPEN[typ];
  const pfade = GEBAEUDE_ICON_PFADE[typ];
  if (!info || !pfade) return "";
  return `<svg class="gebaeude-icon icon-${info.kategorie}" width="${groesse}" height="${groesse}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${pfade}</svg>`;
}

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
  const grenze = art === "energie" ? ENERGIE_MAX : RESSOURCEN_MAX;
  r[art] = Math.min(r[art], grenze);
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

// In eine Funktion ausgelagert, damit die Kampagne (kampagneStarten()) die Karte auf den
// Testverteilung-Ausgangszustand zurücksetzen kann, ohne die Seite neu zu laden.
function resetTerritorien() {
  let globalIndex = 0;
  KARTENDATEN.kontinente.forEach((k) => {
    k.gebiete.forEach((g) => {
      if (!g.polygon) return;
      territorien[g.id] = {
        id: g.id,
        continentId: k.id,
        typ: g.typ ?? "land", // "wasser" für Ozean-Gebiete, siehe werkzeuge/wasserfelder-generieren.js
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
}
resetTerritorien();

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

// Gebäude-Icons als <symbol> für die Karte -- dieselben Pfade wie im Bau-Menü
// (GEBAEUDE_ICON_PFADE), einmal registriert und per <use> auf jedem Gebiet referenziert.
Object.entries(GEBAEUDE_ICON_PFADE).forEach(([typ, pfade]) => {
  const symbol = ns("symbol");
  symbol.setAttribute("id", "icon-symbol-" + typ);
  symbol.setAttribute("viewBox", "0 0 24 24");
  symbol.setAttribute("fill", "none");
  symbol.setAttribute("stroke", "currentColor");
  symbol.setAttribute("stroke-width", "1.6");
  symbol.setAttribute("stroke-linejoin", "round");
  symbol.setAttribute("stroke-linecap", "round");
  symbol.innerHTML = pfade;
  defsEl.appendChild(symbol);
});

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
const iconGruppeById = {};
const centroidById = {};

// Eigene, zuletzt gezeichnete Ebene für alle Gebäude-Icons (statt sie in die jeweilige
// kontinent-geclippte Gebiets-Gruppe zu hängen). Grund: pro Kontinent teilen sich alle
// Gebiete dieselbe <g>, in Zeichenreihenfolge -- ein später gezeichnetes Nachbargebiet
// hätte sonst frühere Icons einfach übermalt (per Konsolentest gefunden, 16.09.2026: selbst
// ein grell rotes Test-Icon war dadurch komplett unsichtbar, obwohl im DOM korrekt vorhanden
// und positioniert). Diese Ebene wird erst NACH allen Kontinenten ans SVG gehängt, damit sie
// garantiert über allem liegt.
const iconEbene = ns("g");
iconEbene.setAttribute("class", "icon-ebene");
iconEbene.setAttribute("pointer-events", "none");

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

  // Durchgehende Wasser-Grundfläche HINTER den einzelnen Ozean-Gebieten: Land und Wasser
  // werden beim Rendern unabhängig geglättet (glattPath), wodurch an der Küste minimale
  // Lücken entstehen könnten, wenn Meeres-Polygone nicht exakt Kante an Kante sitzen. Mit
  // dieser Grundfläche zeigt eine solche Lücke höchstens Wasserfarbe statt der dunklen
  // Buchseite -- unabhängig von Rundungsungenauigkeiten der Kartengeometrie.
  if (k.id === "ozeane") {
    const grund = ns("path");
    grund.setAttribute("d", glattPath(k.umriss));
    grund.setAttribute("fill", KONTINENT_FARBE.ozeane);
    grund.setAttribute("pointer-events", "none");
    g.appendChild(grund);
  }

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
    centroidById[geb.id] = c;
    const t = ns("text");
    t.setAttribute("x", c[0]);
    t.setAttribute("y", c[1] + 3);
    t.setAttribute("class", "truppen");
    g.appendChild(t);
    labelById[geb.id] = t;

    const iconGruppe = ns("g");
    iconGruppe.setAttribute("class", "gebaeude-icons");
    iconEbene.appendChild(iconGruppe);
    iconGruppeById[geb.id] = iconGruppe;
  });

  // Kein Kontinent-Rand für "ozeane": dessen umriss ist die volle Zeichenfläche (die
  // Wasser-Gebiete sitzen jeweils einzeln darin), ein Rand darum würde wie ein Rahmen um
  // die gesamte Karte aussehen statt wie eine Küstenlinie.
  if (k.id !== "ozeane") {
    const border = ns("path");
    border.setAttribute("d", glattPath(k.umriss));
    border.setAttribute("class", "cont-border");
    svg.appendChild(border);
  }
});

svg.appendChild(iconEbene);

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
    p.setAttribute("fill", t.terrainFarbe);
    p.setAttribute("stroke", besitzFarbe);
    p.classList.toggle("ausgewaehlt", t.id === ausgewaehlt);
    p.classList.toggle("ziel", t.id === ziel);
    labelById[t.id].textContent = String(t.truppen);

    // Gebäude-Icons statt Textcodes unter der Truppenzahl -- max. 4 gleichzeitig sichtbar
    // (mehr würde auf den kleinen Gebieten nicht mehr unterscheidbar sein), der Rest bleibt
    // im Titel/Tooltip. Im Bau befindliche Gebäude (noch nicht "fertig") halbtransparent.
    const iconGruppe = iconGruppeById[t.id];
    while (iconGruppe.firstChild) iconGruppe.removeChild(iconGruppe.firstChild);
    if (t.gebaeude.length) {
      const c = centroidById[t.id];
      // Die Karte wird ca. auf halbe viewBox-Größe herunterskaliert angezeigt -- Icon-Größe
      // hier entsprechend größer wählen, sonst sind sie am Bildschirm nur wenige Pixel groß
      // und praktisch unsichtbar (per Zoom-Screenshot getestet, 16.09.2026).
      const GROESSE = 18;
      const ABSTAND = 15;
      const sichtbar = t.gebaeude.slice(0, 3);
      const startX = c[0] - ((sichtbar.length - 1) * ABSTAND) / 2 - GROESSE / 2;
      sichtbar.forEach((b, i) => {
        const use = ns("use");
        use.setAttribute("href", "#icon-symbol-" + b.typ);
        use.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#icon-symbol-" + b.typ);
        use.setAttribute("width", GROESSE);
        use.setAttribute("height", GROESSE);
        use.setAttribute("x", startX + i * ABSTAND);
        use.setAttribute("y", c[1] + 6);
        use.setAttribute("class", "karten-icon icon-" + GEBAEUDE_TYPEN[b.typ].kategorie + (b.fertig ? "" : " im-bau"));
        const titel = ns("title");
        titel.textContent = GEBAEUDE_TYPEN[b.typ].name + (b.fertig ? "" : " (im Bau)");
        use.appendChild(titel);
        iconGruppe.appendChild(use);
      });
    }
  });
  if (typeof aktualisiere3D === "function") aktualisiere3D();
}

function ressourcenText(spielerId) {
  const r = SPIELER.find((s) => s.id === spielerId).ressourcen;
  return `Metall ${r.metall}/${RESSOURCEN_MAX} · Nahrung ${r.nahrung}/${RESSOURCEN_MAX} · Treibstoff ${r.treibstoff}/${RESSOURCEN_MAX} · Energie ${r.energie}/${ENERGIE_MAX}`;
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

  const kampagneStatus = document.getElementById("kampagne-status");
  const btnKampagneStarten = document.getElementById("btn-kampagne-starten");
  if (kampagneStatus) {
    if (!kampagne.aktiv) {
      kampagneStatus.innerHTML = "Keine aktive Kampagne. Start setzt die Karte zurück, macht Spieler 2 zur KI und dich zu Spieler 1.";
      btnKampagneStarten.textContent = "Kampagne starten";
    } else {
      const ep = kampagneAktuelleEpisode();
      const f = kampagne.fortschritt;
      const teile = [];
      if (ep.ziel.erobern) teile.push(`Erobert ${f.erobert}/${ep.ziel.erobern}`);
      if (ep.ziel.cyberangriffe) teile.push(`Cyberangriffe ${f.cyberangriffe}/${ep.ziel.cyberangriffe}`);
      if (ep.ziel.belagerungen) teile.push(`Belagerungen ${f.belagerungen}/${ep.ziel.belagerungen}`);
      if (ep.ziel.bombardierungen) teile.push(`Bombardierungen ${f.bombardierungen}/${ep.ziel.bombardierungen}`);
      if (ep.ziel.reparaturen) teile.push(`Reparaturen ${f.reparaturen}/${ep.ziel.reparaturen}`);
      if (ep.ziel.hauptquartier) teile.push(`Hauptquartier ${territorien[kampagne.hauptquartierGegner]?.owner === 1 ? "erobert" : "nicht erobert"}`);
      if (ep.ziel.strategischeRegionenKontrollieren || ep.ziel.strategischeRegionenVerhindern) {
        const eigene = kampagne.strategischeRegionen.filter((id) => territorien[id]?.owner === 1).length;
        teile.push(`Strategische Regionen ${eigene}/${kampagne.strategischeRegionen.length}`);
      }
      kampagneStatus.innerHTML = `<b>Episode ${ep.nr}: ${ep.name}</b><br>${ep.zielText}<br>${teile.join(" · ")}`;
      btnKampagneStarten.textContent = "Kampagne neu starten";
    }
  }

  const aktiverSpielerObj = SPIELER.find((s) => s.id === aktiverSpieler);
  const spielerName = aktiverSpielerObj.name;

  const rundenleiste = document.getElementById("rundenleiste");
  if (rundenleiste) {
    rundenleiste.style.setProperty("--spielerfarbe", aktiverSpielerObj.farbe);
    document.getElementById("rundenleiste-spieler").textContent =
      `Am Zug: ${spielerName}${aktiverSpielerObj.istBot ? " (KI)" : ""}`;
    const kurzPhase = {
      verstaerkung: "Verstärkung", spielzug: "Spielzug", bauen: "Bauen",
    }[phase] || phase;
    document.getElementById("rundenleiste-phase").textContent =
      mauerZielAuswahl ? "Mauer: Ziel wählen" :
      bauModus ? "Bauen" :
      verschiebenModus ? "Verschieben" :
      belagerungModus ? "Belagerung" :
      bombardierungModus ? "Bombardierung" : kurzPhase;
    // Balken zweckentfremdet als "Weltherrschafts"-Anzeige statt reiner Deko: Anteil der
    // Gebiete, die dem aktiven Spieler gehören, an allen vergebenen Gebieten -- passt zur
    // Boss-Leisten-Optik (Balken = Fortschritt/Macht) und ist im Risiko-Kontext aussagekräftiger
    // als z.B. ein reiner Rundenzähler, den es bisher gar nicht gibt.
    const alleGebiete = Object.values(territorien);
    const eigene = alleGebiete.filter((t) => t.owner === aktiverSpieler).length;
    const anteil = alleGebiete.length ? Math.round((eigene / alleGebiete.length) * 100) : 0;
    const balken = document.getElementById("rundenleiste-balken-fuellung");
    balken.style.width = anteil + "%";
    balken.title = `${eigene} von ${alleGebiete.length} Gebieten (${anteil}%)`;
  }

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
  if (bauZiel && territorien[bauZiel].typ === "wasser") {
    bauAuswahl.innerHTML = `<div style="font-size:12px;color:var(--text-muted)">Auf Wasser-Gebieten kann noch nicht gebaut werden (keine Hafen-/Wassergebäude im Regelwerk definiert).</div>`;
  } else if (bauZiel) {
    const kostenText = (kosten) => Object.entries(kosten).map(([k, v]) => `${v} ${k}`).join(", ");
    bauAuswahl.innerHTML = Object.entries(GEBAEUDE_TYPEN).map(([typ, info2]) => {
      const geht = kannBauen(aktiverSpieler, bauZiel, typ);
      const kontinentHinweis = info2.nurKontinent ? ` (nur ${info2.nurKontinent})` : "";
      return `<button class="btn-gebaeude-typ" data-typ="${typ}" title="${info2.effektText}" ${geht ? "" : "disabled"}>${gebaeudeIconSvg(typ, 18)}<span>${info2.code} ${info2.name} — ${kostenText(info2.kosten)}${kontinentHinweis}${info2.effektAktiv ? "" : " (Effekt folgt)"}</span></button>`;
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
      return `<button class="btn-reparieren" data-gebiet="${t.id}" data-index="${i}" ${geht ? "" : "disabled"}>${gebaeudeIconSvg(b.typ, 18)}<span>${t.id}: ${info2.code} ${info2.name} — ${kostenText(kosten)}</span></button>`;
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
  // Alle 26 Gebäudetypen der Mastertabelle sind für Landinfrastruktur ausgelegt (Regelwerk
  // kennt noch keine Wasser-/Hafengebäude) -- auf Ozean-Gebieten ist Bauen deshalb vorerst
  // komplett gesperrt, bis dafür eigene Gebäude/Regeln definiert sind (siehe Risiko_TODO.md,
  // "Wasserfelder" als eigener, noch nicht bestätigter Vorschlag).
  if (t.typ === "wasser") return false;
  // Regelwerk §5: während der Reparatur können auf dem Gebiet keine neuen Gebäude gebaut werden
  if (t.gebaeude.some((b) => b.beschaedigt)) return false;
  if (t.gebaeude.some((b) => b.typ === typ)) return false;
  if (info.nurKontinent && t.continentId !== info.nurKontinent) return false;
  if (info.limitProSpieler && zaehleAlleGebaeude(spielerId, typ) >= info.limitProSpieler) return false;
  // Kampagne (Episode 6, bestätigt 16.09.2026): S02 Orbitalstartrampe erst ab hier baubar.
  // Außerhalb der Kampagne (Sandbox/Hotseat) gilt diese Sperre nicht.
  if (typ === "orbitalstartrampe" && kampagne.aktiv && kampagneAktuelleEpisode().nr < 6) return false;
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
  if (kampagne.aktiv && aktiverSpieler === 1) { kampagne.fortschritt.reparaturen += 1; kampagnePruefen(); }
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
  if (kampagne.aktiv && aktiverSpieler === 1) {
    kampagne.fortschritt.belagerungen += 1;
    if (r.erobert) kampagne.fortschritt.erobert += 1;
    kampagnePruefen();
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
  if (kampagne.aktiv && aktiverSpieler === 1) { kampagne.fortschritt.bombardierungen += 1; kampagnePruefen(); }
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

  if (kampagne.aktiv && aktiverSpieler === 1) {
    if (r.erobert) kampagne.fortschritt.erobert += 1;
    if (r.cyberEingesetzt) kampagne.fortschritt.cyberangriffe += 1;
    kampagnePruefen();
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
// Reihenfolge per Playtest ermittelt (16.09.2026), zweimal korrigiert:
// 1) Farm zuerst: Farm kostet 1 Nahrung, die einzige Ressource, die "Der Bruch" aktiv
//    wegfrisst (-1/Runde je ungeschütztem Bruch-Gebiet, kein anderer Nahrungs-Zufluss
//    existiert). Baut der Bot die Farm nicht, solange noch Start-Nahrung übrig ist, fällt
//    Nahrung auf 0 und bleibt für immer dort -- ohne Farm nie wieder Nahrung, ohne Nahrung
//    nie wieder Farm. Metall (fürs Kraftwerk unkritisch) hat kein Gegenstück zu dieser
//    Kontamination und ist dadurch weniger dringend.
// 2) Kraftwerk danach: das einzige Energie-Gebäude, und jedes Gebäude kostet Energie. Erst
//    Mine bauen (wie ursprünglich) verbraucht die Start-Energie (10) komplett, bevor das
//    Kraftwerk je dran kommt -- ohne Energie-Nachschub kann der Bot danach nie wieder etwas
//    bauen, keine Cybermarker kaufen und keine Sondermechaniken nutzen.
const BOT_WIRTSCHAFT_TYPEN = ["farm", "kraftwerk", "mine", "raffinerie"];
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

// Priorität 1: pro fehlendem Wirtschaftsgebäudetyp eines bauen, Kraftwerk zuerst (siehe
// BOT_WIRTSCHAFT_TYPEN oben). Priorität 2: eigene, ungeschützte "Der Bruch"-Gebiete
// dekontaminieren (bluten sonst dauerhaft Nahrung, siehe Kontamination-Regel oben) --
// bewusst NACH Wirtschaft: die Dekontaminationsanlage kostet allein 10 Energie, vor dem
// Kraftwerk gebaut wäre das dieselbe Energie-Sackgasse wie bei Mine/Farm zuerst. Per
// Playtest gefunden (16.09.2026). Priorität 3: Grenzgebiete ohne Verteidigungsgebäude.
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

    const bruchOhneSchutz = eigene.find(
      (t) => t.continentId === KONTAMINATION_KONTINENT && !hatAktivesGebaeude(t, "dekontaminationsanlage")
        && kannBauen(spielerId, t.id, "dekontaminationsanlage")
    );
    if (bruchOhneSchutz) {
      bauZiel = bruchOhneSchutz.id;
      gebaeudeBauen("dekontaminationsanlage");
      weiterBauen = true;
      continue;
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

// Repariert beschädigte (durch Besitzwechsel inaktive) Gebäude auf eigenen Gebieten, sofern
// bezahlbar. Per Playtest gefunden (16.09.2026): ohne diesen Schritt blieben nach Eroberungen
// dauerhaft beschädigte Wirtschaftsgebäude stehen, die nie wieder produzierten.
function botReparieren(spielerId) {
  const eigene = botEigeneGebiete(spielerId);
  let sicherheit = 0;
  for (const t of eigene) {
    t.gebaeude.forEach((b, i) => {
      if (sicherheit >= 15 || !b.beschaedigt || b.reparaturBegonnen) return;
      if (kannBezahlen(spielerId, reparaturKosten(b.typ))) {
        reparieren(t.id, i);
        sicherheit++;
      }
    });
  }
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
  botReparieren(spielerId);
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

// --- Kampagne "Krieg der Schatten" (Phase 6) ---
// Struktur aus Risiko_Kampagne_und_Regeln.md: 7 Episoden, Spieler 1 (Mensch) gegen
// Spieler 2 (KI, siehe Phase 5). Läuft auf der bestehenden Karte weiter -- laut Doku
// "behalten Spieler Ressourcen und Marker zwischen den Episoden", d.h. ein Episodenwechsel
// setzt NICHT die Karte zurück, sondern schaltet nur ein neues Ziel frei und gewährt die in
// der Kampagnentabelle genannte Belohnung obendrauf.
//
// Die "Startressourcen" pro Episode (Tabelle: 20/25/30/35/40/45) sind dort als EINE Zahl
// angegeben, unser Spiel kennt aber 4 getrennte Ressourcentypen. Aufgeteilt im selben
// Verhältnis wie der bisherige Standardstart (5/5/5/10 = 1:1:1:2) -- eigener, noch zu
// bestätigender Vorschlag, da die Doku dazu keine Aufteilung nennt. Nur der Einstieg in
// Episode 1 SETZT die Ressourcen fest; jeder weitere Übergang gewährt nur die "Belohnung"
// (rechnerisch identisch, solange nichts ausgegeben wurde, aber konsistent mit "behalten").
const KAMPAGNE_EPISODEN = [
  {
    nr: 1, name: "Erste Konflikte",
    zielText: "3 Regionen erobern",
    ziel: { erobern: 3 },
    // Energie bewusst auf 10 statt der ursprünglich anteilig berechneten 8 -- Farm (5
    // Energie) und Kraftwerk (5 Energie, die einzige Energiequelle im Spiel) passen so
    // beide in den ersten Bauzug. Bei 8 blieb nach der Farm nur Energie 3 übrig, das
    // Kraftwerk war für den Rest der Episode unerreichbar. Per Playtest gefunden
    // (16.09.2026, mit dir bestätigt): Energie blieb 9 Runden lang exakt bei 3 hängen.
    startRessourcen: { metall: 4, nahrung: 4, treibstoff: 4, energie: 10 },
    belohnung: { ressourcen: { metall: 1, nahrung: 1, treibstoff: 1, energie: 2 } },
  },
  {
    nr: 2, name: "Cybersturm",
    zielText: "1 feindliches Gebiet per Cyberangriff angreifen (sabotieren) + 2 Regionen erobern",
    ziel: { erobern: 2, cyberangriffe: 1 },
    belohnung: { ressourcen: { metall: 1, nahrung: 1, treibstoff: 1, energie: 2 }, cybermarker: 1 },
  },
  {
    nr: 3, name: "Belagerung & Bombardierung",
    zielText: "1 Gebiet belagern, 1 Gebiet bombardieren, 2 Regionen erobern",
    ziel: { erobern: 2, belagerungen: 1, bombardierungen: 1 },
    belohnung: { ressourcen: { metall: 1, nahrung: 1, treibstoff: 1, energie: 2 }, cybermarker: 1 },
  },
  {
    nr: 4, name: "Reparatur & Ressourcenmanagement",
    zielText: "2 eigene Gebäude reparieren, 1 Region erobern",
    ziel: { erobern: 1, reparaturen: 2 },
    belohnung: { ressourcen: { metall: 1, nahrung: 1, treibstoff: 1, energie: 2 } },
  },
  {
    nr: 5, name: "Spezialoperationen",
    zielText: "Belagerung, Bombardierung und Cyberangriff je mind. 1x einsetzen, 3 Regionen erobern",
    ziel: { erobern: 3, belagerungen: 1, bombardierungen: 1, cyberangriffe: 1 },
    belohnung: { ressourcen: { metall: 1, nahrung: 1, treibstoff: 1, energie: 2 }, cybermarker: 1 },
  },
  {
    nr: 6, name: "Fraktionskriege",
    // "Strategische Regionen" sind im Regelwerk nicht definiert -- eigener Vorschlag
    // (16.09.2026): die 2 Gebiete des Gegners mit den meisten Truppen bei Episodenbeginn.
    zielText: "4 Regionen erobern und verhindern, dass der Gegner seine 2 stärksten Gebiete (Stand Episodenbeginn) weiter beide hält",
    ziel: { erobern: 4, strategischeRegionenVerhindern: true },
    belohnung: { ressourcen: { metall: 1, nahrung: 1, treibstoff: 1, energie: 2 } },
  },
  {
    nr: 7, name: "Finale Operation",
    // Hauptquartier (W08) wird bei Bedarf automatisch auf dem stärksten Gebiet des Gegners
    // platziert, siehe kampagneEpisodeVorbereiten -- der Bot baut es sonst nicht selbst.
    zielText: "Gegnerisches Hauptquartier erobern und beide strategischen Regionen aus Episode 6 kontrollieren",
    ziel: { hauptquartier: true, strategischeRegionenKontrollieren: true },
  },
];

let kampagne = {
  aktiv: false,
  episodeIndex: 0,
  fortschritt: { erobert: 0, cyberangriffe: 0, belagerungen: 0, bombardierungen: 0, reparaturen: 0 },
  strategischeRegionen: [],
  hauptquartierGegner: null,
};
const botCheckboxes = {}; // spielerId -> Checkbox-Element, siehe spieler-auswahl-Aufbau unten

function kampagneAktuelleEpisode() {
  return KAMPAGNE_EPISODEN[kampagne.episodeIndex];
}

function kampagneEpisodeVorbereiten(index, istStart) {
  const ep = KAMPAGNE_EPISODEN[index];
  kampagne.fortschritt = { erobert: 0, cyberangriffe: 0, belagerungen: 0, bombardierungen: 0, reparaturen: 0 };

  if (istStart && ep.startRessourcen) {
    SPIELER.find((s) => s.id === 1).ressourcen = { ...ep.startRessourcen };
  }

  if (ep.nr === 6) {
    const gegnerGebiete = Object.values(territorien).filter((t) => t.owner === 2).sort((a, b) => b.truppen - a.truppen);
    kampagne.strategischeRegionen = gegnerGebiete.slice(0, 2).map((t) => t.id);
    log(`Episode 6: strategische Regionen des Gegners festgelegt: ${kampagne.strategischeRegionen.join(", ")}.`);
  }

  if (ep.nr === 7) {
    let hq = Object.values(territorien).find((t) => t.owner === 2 && t.gebaeude.some((b) => b.typ === "hauptquartier"));
    if (!hq) {
      const staerkstes = Object.values(territorien).filter((t) => t.owner === 2).sort((a, b) => b.truppen - a.truppen)[0];
      if (staerkstes) {
        staerkstes.gebaeude.push({ typ: "hauptquartier", fertig: true });
        hq = staerkstes;
        log(`Episode 7: ${staerkstes.id} automatisch als gegnerisches Hauptquartier bestimmt (Bot baut es nicht von selbst).`);
      }
    }
    kampagne.hauptquartierGegner = hq ? hq.id : null;
  }
}

function kampagneStarten() {
  resetTerritorien();
  SPIELER.forEach((s) => { s.ressourcen = { metall: 0, nahrung: 0, treibstoff: 0, energie: 0 }; s.cybermarker = 0; });
  SPIELER.find((s) => s.id === 1).istBot = false;
  SPIELER.find((s) => s.id === 2).istBot = true;
  Object.entries(botCheckboxes).forEach(([id, cb]) => { cb.checked = SPIELER.find((s) => s.id === Number(id)).istBot; });

  kampagne.aktiv = true;
  kampagne.episodeIndex = 0;
  kampagne.strategischeRegionen = [];
  kampagne.hauptquartierGegner = null;
  kampagneEpisodeVorbereiten(0, true);

  const ep = kampagneAktuelleEpisode();
  log(`Kampagne "Krieg der Schatten" gestartet — Episode ${ep.nr}: ${ep.name}. Ziel: ${ep.zielText}.`, true);
  rundenStart(1);
}

function kampagneEpisodeAbschliessen() {
  const ep = kampagneAktuelleEpisode();
  log(`Episode ${ep.nr} "${ep.name}" abgeschlossen!`, true);
  if (ep.belohnung) {
    if (ep.belohnung.ressourcen) Object.entries(ep.belohnung.ressourcen).forEach(([k, v]) => gutschreiben(1, k, v));
    if (ep.belohnung.cybermarker) {
      const s = SPIELER.find((sp) => sp.id === 1);
      s.cybermarker = Math.min(CYBERMARKER_MAX, s.cybermarker + ep.belohnung.cybermarker);
    }
  }
  if (kampagne.episodeIndex + 1 >= KAMPAGNE_EPISODEN.length) {
    kampagne.aktiv = false;
    log(`Kampagne "Krieg der Schatten" abgeschlossen — alle 7 Episoden gemeistert!`, true);
    return;
  }
  kampagne.episodeIndex += 1;
  kampagneEpisodeVorbereiten(kampagne.episodeIndex, false);
  const naechste = kampagneAktuelleEpisode();
  log(`Episode ${naechste.nr}: ${naechste.name}. Ziel: ${naechste.zielText}.`, true);
}

// Nach jeder relevanten Aktion des menschlichen Spielers (Spieler 1) aufgerufen, siehe
// angriff(), belagerungAusfuehren(), bombardierungAusfuehren(), reparieren().
function kampagnePruefen() {
  if (!kampagne.aktiv) return;
  const ep = kampagneAktuelleEpisode();
  const f = kampagne.fortschritt;
  let erfuellt = true;
  if (ep.ziel.erobern && f.erobert < ep.ziel.erobern) erfuellt = false;
  if (ep.ziel.cyberangriffe && f.cyberangriffe < ep.ziel.cyberangriffe) erfuellt = false;
  if (ep.ziel.belagerungen && f.belagerungen < ep.ziel.belagerungen) erfuellt = false;
  if (ep.ziel.bombardierungen && f.bombardierungen < ep.ziel.bombardierungen) erfuellt = false;
  if (ep.ziel.reparaturen && f.reparaturen < ep.ziel.reparaturen) erfuellt = false;
  if (ep.ziel.strategischeRegionenVerhindern) {
    const gegnerHaeltBeide = kampagne.strategischeRegionen.length === 2
      && kampagne.strategischeRegionen.every((id) => territorien[id]?.owner === 2);
    if (gegnerHaeltBeide) erfuellt = false;
  }
  if (ep.ziel.hauptquartier) {
    if (!kampagne.hauptquartierGegner || territorien[kampagne.hauptquartierGegner]?.owner !== 1) erfuellt = false;
  }
  if (ep.ziel.strategischeRegionenKontrollieren) {
    const alleEigen = kampagne.strategischeRegionen.length === 2
      && kampagne.strategischeRegionen.every((id) => territorien[id]?.owner === 1);
    if (!alleEigen) erfuellt = false;
  }
  if (erfuellt) kampagneEpisodeAbschliessen();

  if (Object.values(territorien).filter((t) => t.owner === 1).length === 0) {
    kampagne.aktiv = false;
    log(`Kampagne verloren — keine eigenen Gebiete mehr.`, true);
  }
}

document.getElementById("btn-kampagne-starten").addEventListener("click", kampagneStarten);

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
  botCheckboxes[s.id] = botCheckbox;

  zeile.appendChild(btn);
  zeile.appendChild(botLabel);
  spielerAuswahl.appendChild(zeile);
});

rundenStart(aktiverSpieler);
