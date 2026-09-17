// Echte 3D-Ansicht der Karte (three.js), zusätzlich zur bestehenden 2D-SVG-Karte.
// Nutzt dieselben Kartendaten (KARTENDATEN) und denselben Spielzustand (territorien,
// ausgewaehlt, ziel, onClickGebiet) -- die 3D-Szene ist nur eine zweite Darstellung,
// keine zweite Spiellogik. Wird lazy initialisiert, erst beim ersten Umschalten auf 3D
// (kein WebGL-Overhead, solange niemand die 3D-Ansicht nutzt).

let szene3D = null;
const HOEHE_GEBIET = 6; // Extrusionstiefe der Gebiets-Blöcke -- Modulebene, da auch die
                        // Marker-Funktionen wissen müssen, wo die Kartenoberfläche liegt.

// Gleiche Kategoriefarben wie die 2D-Bau-Icons (siehe .icon-wirtschaft/-verteidigung/
// -infrastruktur/-sonder in style.css), damit beide Ansichten farblich übereinstimmen.
const KATEGORIE_FARBE_3D = { wirtschaft: 0xd9a441, verteidigung: 0xd1495b, infrastruktur: 0x4c9bd1, sonder: 0x9a6fd1 };

function macheGebaeudeGeometrie(kategorie) {
  // Eine eigene Grundform pro Kategorie, analog zu den unterschiedlichen 2D-Icon-Formen --
  // in 3D per Primitiv statt per SVG-Pfad.
  switch (kategorie) {
    case "wirtschaft": return new THREE.CylinderGeometry(4, 4, 8, 10);
    case "verteidigung": return new THREE.ConeGeometry(5, 9, 4);
    case "infrastruktur": return new THREE.BoxGeometry(7, 8, 7);
    default: return new THREE.OctahedronGeometry(5.5);
  }
}

// Höhe der kompletten Soldaten-Figur (Sockel bis Kopf) -- feste Größe wie bei echten
// Risiko-Spielfiguren: die Anzahl Truppen wird nicht über die Größe der Figur ausgedrückt
// (eine gestreckte Figur pro Truppenzahl sähe verzerrt aus), sondern weiterhin über das
// Zahlen-Schild darüber.
const FIGUR_HOEHE = 19;

// Eine einzelne Spielfigur, angelehnt an die klassische Risiko-Infanterie-Figur: Sockel,
// stehender Körper, Kopf, Gewehr schräg über der Brust -- alles in Besitzerfarbe, wie bei
// den echten Plastikfiguren (eine Farbe pro Spieler, keine Terrain-/Detailfarben am Stück).
function macheSoldatFigur(farbeHex) {
  const material = new THREE.MeshStandardMaterial({ color: farbeHex, roughness: 0.45, metalness: 0.25 });
  const gruppe = new THREE.Group();

  const sockel = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.2, 1.6, 14), material);
  sockel.position.y = 0.8;
  gruppe.add(sockel);

  const beine = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.7, 6.5, 10), material);
  beine.position.y = 1.6 + 3.25;
  gruppe.add(beine);

  const koerper = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 6.5, 10), material);
  koerper.position.y = 1.6 + 6.5 + 3.25;
  gruppe.add(koerper);

  const schultern = new THREE.Mesh(new THREE.SphereGeometry(2.7, 10, 8), material);
  schultern.scale.set(1, 0.55, 1);
  schultern.position.y = 1.6 + 6.5 + 6.5;
  gruppe.add(schultern);

  const kopf = new THREE.Mesh(new THREE.SphereGeometry(1.9, 10, 8), material);
  kopf.position.y = 1.6 + 6.5 + 6.5 + 2.1;
  gruppe.add(kopf);

  // Gewehr diagonal über den Oberkörper -- genau die Silhouette, an der man eine klassische
  // Risiko-Infanteriefigur sofort erkennt.
  const gewehr = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 9, 6), material);
  gewehr.rotation.z = Math.PI / 3;
  gewehr.position.set(2.1, 1.6 + 6.5 + 4.2, 0.6);
  gruppe.add(gewehr);

  return gruppe;
}

// Kleines, immer zur Kamera ausgerichtetes Zahlen-Schild -- für die exakte Truppenzahl,
// die sich aus einer reinen Geometriegröße (anders als bei der 2D-Textbeschriftung) nicht
// zuverlässig ablesen ließe.
function macheZahlenSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(10,14,19,0.75)";
  ctx.beginPath(); ctx.arc(32, 32, 27, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 32, 35);
  const textur = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textur, depthTest: false }));
  sprite.scale.set(16, 16, 1);
  sprite.renderOrder = 999;
  return sprite;
}

// Welcher Terrain-Deko-Typ zu welchem Kontinent passt -- grobe, aber klar unterscheidbare
// Biome, passend zum Kontinent-Konzept (siehe Risiko_TODO.md): Arktis=Eis, die drei grünen
// klassischen Kontinente=Wald, die trockenen/warmen=Wüste, "Der Bruch"=zerstörtes Ödland,
// "Konstrukt"=künstliche Tech-Landschaft, Aquanova-Knoten=Ozean-Plattformen.
const TERRAIN_TYP_NACH_KONTINENT = {
  arktis: "eis", na: "wald", europa: "wald", sa: "wald",
  asien: "wueste", afrika: "wueste", australien: "wueste",
  bruch: "bruch", konstrukt: "konstrukt",
  aqua0: "wasser", aqua1: "wasser", aqua2: "wasser", aqua3: "wasser", ozeane: "wasser",
};

function hashSeed3D(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}
function erzeugeZufall3D(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function punktInPolygon3D(punkt, polygon) {
  let innen = false;
  const [px, py] = punkt;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    const schneidet = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (schneidet) innen = !innen;
  }
  return innen;
}

// Eine einzelne Deko-Instanz (Baum, Eiskristall, Dünenkegel, Bruch-Zacke, Konstrukt-Block
// oder Wasserplattform-Pfeiler) für ein gegebenes Biom. Groesse/Rotation leicht per rnd()
// variiert, damit ein Gebiet mit mehreren Deko-Objekten nicht wie geklont aussieht.
function macheDekoMesh(typ, rnd) {
  let geo, farbe, hoehe;
  switch (typ) {
    case "wald": {
      const gruppe = new THREE.Group();
      const stammH = 3 + rnd() * 1.5;
      const stamm = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, stammH, 5), new THREE.MeshStandardMaterial({ color: 0x5c4324, roughness: 1 }));
      stamm.position.y = stammH / 2;
      gruppe.add(stamm);
      const kroneH = 5 + rnd() * 3;
      const krone = new THREE.Mesh(new THREE.ConeGeometry(2.6 + rnd(), kroneH, 6), new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.95 }));
      krone.position.y = stammH + kroneH / 2.3;
      gruppe.add(krone);
      return gruppe;
    }
    case "eis":
      geo = new THREE.ConeGeometry(1.8 + rnd() * 1.2, 6 + rnd() * 5, 5);
      farbe = 0xdff3f8;
      break;
    case "wueste":
      geo = new THREE.ConeGeometry(3 + rnd() * 2, 3 + rnd() * 1.5, 8);
      farbe = 0xcaa25e;
      break;
    case "bruch":
      geo = new THREE.ConeGeometry(1.2 + rnd(), 7 + rnd() * 6, 4);
      farbe = 0x8a3324;
      break;
    case "konstrukt":
      hoehe = 5 + rnd() * 6;
      geo = new THREE.BoxGeometry(3 + rnd(), hoehe, 3 + rnd());
      farbe = 0xaab2bd;
      break;
    default: // wasser -- kleine Plattform-Pfeiler, wie Beine eines Offshore-Rigs
      hoehe = 6 + rnd() * 4;
      geo = new THREE.CylinderGeometry(1, 1.4, hoehe, 6);
      farbe = 0x2f7d82;
      break;
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.85 }));
  if (typ !== "wald") mesh.position.y = geo.parameters.height / 2;
  return mesh;
}

// Benannte, wiedererkennbare Gebirgszüge an geografisch passender Stelle innerhalb eines
// Kontinents -- nicht per Gebiets-ID fest verdrahtet (die Gebiets-Grenzen sind Voronoi-
// Zellen, kein reales Gelände), sondern per Position relativ zur Kontinent-Bounding-Box:
// "achse"/"richtung"/"schwelle" beschreiben, welcher Rand des Kontinents das Gebirge trägt.
// Ersetzt in den betroffenen Gebieten die normale Biom-Deko (Baum/Düne/...) komplett durch
// Gebirgs-Deko, damit der Höhenzug optisch klar als eigenständiges Merkmal hervorsticht.
const GEBIRGSZUEGE = {
  sa: { achse: "x", richtung: "min", schwelle: 0.32 },      // Anden -- Westküste Südamerikas
  na: { achse: "x", richtung: "min", schwelle: 0.3 },       // Rocky Mountains -- Westen Nordamerikas
  asien: { achse: "y", richtung: "max", schwelle: 0.3 },    // Himalaya -- Süden/Zentralasien
  europa: { achse: "y", richtung: "max", schwelle: 0.32 },  // Alpen -- Süden Europas
};

function istGebirgsGebiet(kontinentId, mitte, bbox) {
  const zone = GEBIRGSZUEGE[kontinentId];
  if (!zone) return false;
  const [minA, maxA] = zone.achse === "x" ? [bbox.minX, bbox.maxX] : [bbox.minY, bbox.maxY];
  const wert = zone.achse === "x" ? mitte[0] : mitte[1];
  const anteil = (wert - minA) / ((maxA - minA) || 1);
  return zone.richtung === "min" ? anteil < zone.schwelle : anteil > 1 - zone.schwelle;
}

// Einzelner Gipfel: grauer Felskegel + weiße Schneekuppe -- die Silhouette, an der man ein
// Gebirge (Anden/Rockies/Himalaya/Alpen) auf den ersten Blick von normalen Hügeln/Bäumen
// unterscheidet. Deutlich höher als die übrige Terrain-Deko.
function macheGebirgsMesh(rnd) {
  const gruppe = new THREE.Group();
  const hoehe = 17 + rnd() * 16;
  const fels = new THREE.Mesh(
    new THREE.ConeGeometry(4 + rnd() * 2.5, hoehe, 6),
    new THREE.MeshStandardMaterial({ color: 0x757478, roughness: 0.95 })
  );
  fels.position.y = hoehe / 2;
  gruppe.add(fels);
  const schneeHoehe = hoehe * 0.3;
  const schnee = new THREE.Mesh(
    new THREE.ConeGeometry(2 + rnd(), schneeHoehe, 6),
    new THREE.MeshStandardMaterial({ color: 0xf3f8fb, roughness: 0.6 })
  );
  schnee.position.y = hoehe - schneeHoehe * 0.4;
  gruppe.add(schnee);
  return gruppe;
}

// Streut deterministisch ein paar Deko-Objekte über die Fläche eines Gebiets (Rejection
// Sampling im Bounding-Box, verworfen wenn außerhalb des Polygons). Anzahl grob an die
// Bounding-Box-Fläche gekoppelt, gedeckelt, damit sehr große Gebiete (z.B. in Asien) nicht
// mit hunderten Objekten die Framerate belasten.
function erzeugeTerrainDeko(gebiet, kontinentId, dekoGruppe, kontinentBBox) {
  const typ = TERRAIN_TYP_NACH_KONTINENT[kontinentId];
  if (!typ) return;
  const polygon = gebiet.polygon;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polygon.forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
  const flaecheNaeherung = (maxX - minX) * (maxY - minY);
  const rnd = erzeugeZufall3D(hashSeed3D(gebiet.id));
  const anzahl = Math.max(1, Math.min(6, Math.round(flaecheNaeherung / 900)));
  const mitte = [(minX + maxX) / 2, (minY + maxY) / 2];
  const bbox = kontinentBBox[kontinentId];
  const gebirge = bbox && istGebirgsGebiet(kontinentId, mitte, bbox);

  for (let i = 0; i < anzahl; i++) {
    let punkt = null;
    for (let versuch = 0; versuch < 12; versuch++) {
      const kandidat = [minX + rnd() * (maxX - minX), minY + rnd() * (maxY - minY)];
      if (punktInPolygon3D(kandidat, polygon)) { punkt = kandidat; break; }
    }
    if (!punkt) continue;
    const deko = gebirge ? macheGebirgsMesh(rnd) : macheDekoMesh(typ, rnd);
    const skala = 0.7 + rnd() * 0.6;
    deko.scale.setScalar(skala);
    deko.rotation.y = rnd() * Math.PI * 2;
    deko.position.x += punkt[0];
    deko.position.z += punkt[1];
    deko.position.y += HOEHE_GEBIET;
    dekoGruppe.add(deko);
  }
}

function initKarte3D() {
  if (szene3D) { aktualisiere3D(); return; }

  const container = document.getElementById("board-3d");
  const breite = container.clientWidth || 1200;
  const hoehe = container.clientHeight || 620;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1b2c);

  const camera = new THREE.PerspectiveCamera(45, breite / hoehe, 1, 5000);
  // Kartenmittelpunkt liegt bei ca. (600, 310) im 1200x620-Koordinatenraum der SVG-Daten.
  camera.position.set(600, 650, 900);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(breite, hoehe);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  // OrbitControls: Drehen per Linksklick-Ziehen, Verschieben (Pan) per Rechtsklick-Ziehen
  // oder Zweifinger-Geste, Zoom per Mausrad -- Standardverhalten, genau die "frei drehbare
  // und bewegliche Kamera", die für die 3D-Ansicht gewünscht war.
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(600, 0, 310);
  controls.maxPolarAngle = Math.PI * 0.49; // nicht unter die Kartenebene schwenken
  controls.minDistance = 150;
  controls.maxDistance = 2200;
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sonne = new THREE.DirectionalLight(0xffffff, 0.8);
  sonne.position.set(400, 800, 200);
  scene.add(sonne);

  const gebietGruppe = new THREE.Group();
  scene.add(gebietGruppe);

  // Durchgehende Wasser-Grundebene knapp unter den Ozean-Gebiets-Blöcken -- dieselbe
  // Absicherung wie in der 2D-Karte: verhindert, dass kleine Geometrie-Lücken zwischen
  // einzelnen Wasser-Gebieten den dunklen Szenenhintergrund durchscheinen lassen.
  const wasserGrund = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 820),
    new THREE.MeshStandardMaterial({ color: 0x1f5f7a, roughness: 0.9 })
  );
  wasserGrund.rotation.x = -Math.PI / 2;
  wasserGrund.position.set(600, -1, 310);
  scene.add(wasserGrund);

  // Eigene Gruppe für Truppen- und Gebäude-Marker, wird bei jedem aktualisiere3D() komplett
  // neu befüllt (Anzahl Truppen/Gebäude ändert sich laufend) -- getrennt von gebietGruppe,
  // damit das Klick-Raycasting weiterhin nur die Gebiets-Flächen trifft, nicht die Marker.
  const markerGruppe = new THREE.Group();
  scene.add(markerGruppe);

  // Statische Terrain-Deko (Bäume, Eiskristalle, Dünen, ...) -- einmalig beim Aufbau erzeugt,
  // ändert sich nie über den Spielverlauf, deshalb NICHT Teil von aktualisiere3D().
  const dekoGruppe = new THREE.Group();
  dekoGruppe.userData.nichtAnklickbar = true;
  scene.add(dekoGruppe);

  const meshById = {};

  // Bounding-Box pro Kontinent -- Grundlage dafür, wo genau (z.B. "Westrand") ein benannter
  // Gebirgszug (siehe GEBIRGSZUEGE) innerhalb des Kontinents zu liegen kommt.
  const kontinentBBox = {};
  KARTENDATEN.kontinente.forEach((k) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    k.gebiete.forEach((g) => {
      if (!g.polygon) return;
      g.polygon.forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
    });
    kontinentBBox[k.id] = { minX, minY, maxX, maxY };
  });

  KARTENDATEN.kontinente.forEach((k) => {
    k.gebiete.forEach((g) => {
      if (!g.polygon || g.polygon.length < 3) return;
      erzeugeTerrainDeko(g, k.id, dekoGruppe, kontinentBBox);
      // SVG-Koordinaten (x nach rechts, y nach unten) -> 3D-Ebene (x, z), y bleibt "oben"
      // für die Extrusionshöhe. z = SVG-y, damit die Karte in der 3D-Szene nicht gespiegelt wird.
      const form = new THREE.Shape(g.polygon.map(([x, y]) => new THREE.Vector2(x, -y)));
      const geometrie = new THREE.ExtrudeGeometry(form, { depth: HOEHE_GEBIET, bevelEnabled: false });
      geometrie.rotateX(-Math.PI / 2);
      const material = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9, metalness: 0.05 });
      const mesh = new THREE.Mesh(geometrie, material);
      mesh.userData.gebietId = g.id;
      gebietGruppe.add(mesh);
      meshById[g.id] = mesh;

      // Umriss in Besitzerfarbe -- dieselbe Regel wie in der 2D-Karte: Terrainfarbe ist die
      // Fläche, die Spielerfarbe markiert ausschließlich die Grenze.
      const kanten = new THREE.EdgesGeometry(geometrie);
      const rand = new THREE.LineSegments(kanten, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
      mesh.add(rand);
      mesh.userData.randMaterial = rand.material;
    });
  });

  // Klick-Auswahl: Raycasting auf die Gebiets-Meshes, ruft dieselbe onClickGebiet()-Funktion
  // wie die 2D-Karte auf -- ein Klick in 3D wirkt sich exakt so aus wie ein Klick in 2D.
  const raycaster = new THREE.Raycaster();
  const maus = new THREE.Vector2();
  renderer.domElement.addEventListener("click", (ev) => {
    const rect = renderer.domElement.getBoundingClientRect();
    maus.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    maus.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(maus, camera);
    const treffer = raycaster.intersectObjects(gebietGruppe.children);
    if (treffer.length) onClickGebiet(treffer[0].object.userData.gebietId);
  });

  function animieren() {
    requestAnimationFrame(animieren);
    controls.update();
    renderer.render(scene, camera);
  }
  animieren();

  window.addEventListener("resize", () => {
    if (container.hasAttribute("hidden")) return;
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  szene3D = { meshById, markerGruppe };
  aktualisiere3D();
}

// Wird von render() (spiel.js) nach jeder Zustandsänderung mitaufgerufen, damit 2D- und
// 3D-Ansicht immer denselben Spielstand zeigen, egal welche gerade sichtbar ist.
function markerGruppeLeeren(gruppe) {
  // Geometrien/Texturen der alten Marker sauber freigeben, sonst wächst der GPU-Speicher
  // unbegrenzt -- render() (und damit aktualisiere3D()) läuft bei jeder Spielaktion, bei
  // einem Bot-Zug ggf. dutzendfach hintereinander. traverse() statt nur die direkten Kinder,
  // da die Soldatenfigur selbst eine Gruppe aus mehreren Meshes ist (Sockel/Beine/Körper/...).
  while (gruppe.children.length) {
    const obj = gruppe.children.pop();
    obj.traverse((teil) => {
      if (teil.geometry) teil.geometry.dispose();
      if (teil.material) {
        if (teil.material.map) teil.material.map.dispose();
        teil.material.dispose();
      }
    });
  }
}

function aktualisiere3D() {
  if (!szene3D) return;
  markerGruppeLeeren(szene3D.markerGruppe);

  Object.values(territorien).forEach((t) => {
    const mesh = szene3D.meshById[t.id];
    if (!mesh) return;
    const besitzFarbe = t.owner ? SPIELER.find((s) => s.id === t.owner).farbe : NEUTRAL_FARBE;
    mesh.material.color.set(t.terrainFarbe);
    const ausgewaehltOderZiel = t.id === ausgewaehlt || t.id === ziel;
    mesh.userData.randMaterial.color.set(ausgewaehltOderZiel ? 0xffffff : besitzFarbe);
    mesh.position.y = ausgewaehltOderZiel ? 4 : 0; // leichtes Anheben statt Weißrand-Dicke in 3D

    const c = centroidById[t.id];
    if (!c) return;

    // Truppen-Einheit: eine feste Risiko-Soldatenfigur in Besitzerfarbe (keine verzerrende
    // Größenskalierung nach Truppenzahl -- wie beim echten Spiel), plus Zahlen-Schild für
    // den exakten Wert darüber. Bei Auswahl/Ziel etwas größer, als zusätzliche Hervorhebung
    // neben dem weißen Gebiets-Rand.
    const figur = macheSoldatFigur(besitzFarbe);
    figur.scale.setScalar(ausgewaehltOderZiel ? 1.2 : 1);
    figur.position.set(c[0], HOEHE_GEBIET, c[1]);
    szene3D.markerGruppe.add(figur);

    const schild = macheZahlenSprite(String(t.truppen));
    schild.position.set(c[0], HOEHE_GEBIET + FIGUR_HOEHE + 8, c[1]);
    szene3D.markerGruppe.add(schild);

    // Gebäude als kleine, nach Kategorie geformte/gefärbte Marker in einer Reihe --
    // dieselbe Begrenzung auf 3 gleichzeitig sichtbare wie im 2D-Icon-Rendering, aus
    // demselben Grund (mehr wäre auf der kleinen Fläche nicht mehr unterscheidbar).
    const sichtbar = t.gebaeude.slice(0, 3);
    const ABSTAND = 13;
    const startX = c[0] - ((sichtbar.length - 1) * ABSTAND) / 2;
    sichtbar.forEach((b, i) => {
      const typ = GEBAEUDE_TYPEN[b.typ];
      const geo = macheGebaeudeGeometrie(typ.kategorie);
      const mat = new THREE.MeshStandardMaterial({
        color: KATEGORIE_FARBE_3D[typ.kategorie] ?? 0xffffff,
        roughness: 0.6,
        transparent: !b.fertig,
        opacity: b.fertig ? 1 : 0.5, // im Bau befindlich -- gleiche Konvention wie 2D-Icons
      });
      const marker = new THREE.Mesh(geo, mat);
      marker.position.set(startX + i * ABSTAND, HOEHE_GEBIET + 5, c[1] + 14);
      szene3D.markerGruppe.add(marker);
    });
  });
}
