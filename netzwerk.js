// Peer-to-Peer-Verbindung über PeerJS. Kein eigener Dauer-Server für die Spieldaten,
// nur ein öffentlicher Vermittlungsserver (von PeerJS gestellt) für den ersten Verbindungsaufbau.
// Braucht dafür einmalig Internet; danach laufen die Daten direkt zwischen den zwei Browsern.

const NETZWERK = (() => {
  const PREFIX = "letztewelt-";
  let peer = null;
  let verbindung = null;
  let rolle = null; // 1 = Ersteller, 2 = Beigetretener
  let empfangenCallback = null;

  function zufallsCode() {
    return Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  function verbindungEinrichten(conn, onStatus) {
    verbindung = conn;
    verbindung.on("open", () => onStatus("verbunden"));
    verbindung.on("data", (d) => empfangenCallback && empfangenCallback(d));
    verbindung.on("close", () => onStatus("getrennt"));
  }

  function spielErstellen(onStatus) {
    rolle = 1;
    const code = zufallsCode();
    peer = new Peer(PREFIX + code);
    peer.on("open", () => onStatus("warte", code));
    peer.on("connection", (conn) => verbindungEinrichten(conn, onStatus));
    peer.on("error", (e) => onStatus("fehler", e.message || String(e)));
  }

  function spielBeitreten(eingabeCode, onStatus) {
    rolle = 2;
    peer = new Peer();
    peer.on("open", () => {
      const conn = peer.connect(PREFIX + eingabeCode.trim().toUpperCase());
      verbindungEinrichten(conn, onStatus);
    });
    peer.on("error", (e) => onStatus("fehler", e.message || String(e)));
  }

  function sende(daten) {
    if (verbindung && verbindung.open) verbindung.send(daten);
  }

  function aufEmpfang(cb) { empfangenCallback = cb; }
  function meineRolle() { return rolle; }
  function istOnline() { return !!(verbindung && verbindung.open); }

  return { spielErstellen, spielBeitreten, sende, aufEmpfang, meineRolle, istOnline };
})();
