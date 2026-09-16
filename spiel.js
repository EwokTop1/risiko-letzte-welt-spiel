// Risiko - Letzte Welt: Grundgerüst (Phase 1)
// Kartendarstellung, Gebietsauswahl, Standard-Risiko-Kampf. Kein Rundensystem, keine Ressourcen.

const KONTINENT_FARBE = {
  arktis: "#d9b45c", na: "#5b7fd1", europa: "#6b8fc4", asien: "#7a6bc4",
  afrika: "#c9975a", bruch: "#e2703a", sa: "#4f8f7a", australien: "#5aa06b",
  konstrukt: "#9fb0c3", aqua0: "#4fd1c5", aqua1: "#4fd1c5", aqua2: "#4fd1c5", aqua3: "#4fd1c5",
};

const SPIELER = [
  { id: 1, name: "Spieler 1", farbe: "#d1495b" },
  { id: 2, name: "Spieler 2", farbe: "#3a86ff" },
];
const NEUTRAL_FARBE = "#5a6472";
const START_TRUPPEN = 3;

// --- Zustand aufbauen ---
const territorien = {}; // id -> {id, continentId, polygon, x, y, owner, truppen}
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

// --- Rendering: Karte einmalig aufbauen ---
const svg = document.getElementById("board");
const defsEl = document.createElementNS("http://www.w3.org/2000/svg", "defs");
svg.appendChild(defsEl);

function polyPath(pts) {
  return "M" + pts.map((p) => p[0] + "," + p[1]).join("L") + "Z";
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
  clipPath.setAttribute("d", polyPath(k.umriss));
  clip.appendChild(clipPath);
  defsEl.appendChild(clip);

  const g = ns("g");
  g.setAttribute("clip-path", "url(#" + clipId + ")");
  svg.appendChild(g);

  k.gebiete.forEach((geb) => {
    if (!geb.polygon) return;
    const p = ns("path");
    p.setAttribute("d", polyPath(geb.polygon));
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
  border.setAttribute("d", polyPath(k.umriss));
  border.setAttribute("class", "cont-border");
  svg.appendChild(border);
});

// --- Rendering: laufende Aktualisierung ---
function render() {
  Object.values(territorien).forEach((t) => {
    const farbe = t.owner ? SPIELER.find((s) => s.id === t.owner).farbe : NEUTRAL_FARBE;
    const p = pathById[t.id];
    p.setAttribute("fill", farbe);
    p.classList.toggle("ausgewaehlt", t.id === ausgewaehlt);
    p.classList.toggle("ziel", t.id === ziel);
    labelById[t.id].textContent = t.truppen;
  });
}

function updatePanel() {
  const info = document.getElementById("auswahl-info");
  const btnAngriff = document.getElementById("btn-angriff");
  const btnAbbrechen = document.getElementById("btn-abbrechen");

  if (!ausgewaehlt) {
    info.innerHTML = "Kein Gebiet ausgewählt. Klicke ein eigenes Gebiet mit mehr als 1 Truppe.";
    btnAngriff.disabled = true;
    btnAbbrechen.disabled = true;
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
  const t = territorien[id];

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

function wuerfeln(n) {
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);
}

function angriff() {
  if (!ausgewaehlt || !ziel) return;
  const A = territorien[ausgewaehlt];
  const D = territorien[ziel];

  const aWuerfel = wuerfeln(Math.min(A.truppen - 1, 3));
  const dWuerfel = wuerfeln(Math.min(D.truppen, 2));
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
  }

  log(`${A.id} [${aWuerfel.join(",")}] vs ${D.id} [${dWuerfel.join(",")}] → Angreifer -${aVerlust}, Verteidiger -${dVerlust}` + (erobert ? ` – erobert (${verschoben} verlegt)` : ""), erobert);

  if (typeof NETZWERK !== "undefined" && NETZWERK.istOnline()) {
    NETZWERK.sende({
      typ: "angriff", von: A.id, nach: D.id, aWuerfel, dWuerfel,
      aVerlust, dVerlust, aNeu: A.truppen, dNeu: D.truppen, dBesitzer: D.owner, erobert, verschoben,
    });
  }

  if (erobert || A.truppen <= 1) { ausgewaehlt = null; ziel = null; }

  render(); updatePanel();
}

if (typeof NETZWERK !== "undefined") {
  NETZWERK.aufEmpfang((daten) => {
    if (daten.typ !== "angriff") return;
    const A = territorien[daten.von];
    const D = territorien[daten.nach];
    A.truppen = daten.aNeu;
    D.truppen = daten.dNeu;
    D.owner = daten.dBesitzer;
    log(`${daten.von} [${daten.aWuerfel.join(",")}] vs ${daten.nach} [${daten.dWuerfel.join(",")}] → Angreifer -${daten.aVerlust}, Verteidiger -${daten.dVerlust}` + (daten.erobert ? ` – erobert (${daten.verschoben} verlegt)` : ""), daten.erobert);
    render(); updatePanel();
  });
}

document.getElementById("btn-angriff").addEventListener("click", angriff);
document.getElementById("btn-abbrechen").addEventListener("click", () => {
  ausgewaehlt = null; ziel = null; render(); updatePanel();
});

const spielerAuswahl = document.getElementById("spieler-auswahl");
SPIELER.forEach((s) => {
  const btn = document.createElement("button");
  btn.className = "spieler-btn" + (s.id === aktiverSpieler ? " aktiv" : "");
  btn.textContent = s.name;
  btn.style.color = s.farbe;
  btn.addEventListener("click", () => {
    aktiverSpieler = s.id;
    ausgewaehlt = null; ziel = null;
    document.querySelectorAll(".spieler-btn").forEach((b) => b.classList.remove("aktiv"));
    btn.classList.add("aktiv");
    render(); updatePanel();
  });
  spielerAuswahl.appendChild(btn);
});

render();
updatePanel();
