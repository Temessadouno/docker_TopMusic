const { getDb } = require("./db.js");
const fs   = require("fs");
const path = require("path");
const csv  = require("csv-parse/sync");

// ── Helpers ──────────────────────────────────────────────────
function loadCSV() {
  const filePath = path.join(__dirname, "./data/casadataset.csv");
  const raw      = fs.readFileSync(filePath, "utf-8");
  return csv.parse(raw, { columns: true, skip_empty_lines: true });
}

function parseRow(row) {
  return {
    sensor_id: row.sensor_id,
    nom:       row.nom,
    quartier:  row.quartier,
    sous_type: row.sous_type,
    latitude:  parseFloat(row.latitude),
    longitude: parseFloat(row.longitude),
    adresse:   row.adresse,
    statut:    row.statut,
  };
}

// ═══════════════════════════════════════════════════════════
class capteurController {

  // POST /capteurs/import
  // Importe le CSV dans MongoDB (upsert — idempotent)
  static async importCSV(req, res) {
    try {
      const db = getDb();
      if (!db) return res.status(503).json({ error: "MongoDB non disponible" });

      const rows = loadCSV().map(parseRow);
      let upserted = 0;

      for (const doc of rows) {
        const result = await db.collection("capteurs_trafic").updateOne(
          { sensor_id: doc.sensor_id },
          { $set: { ...doc, updatedAt: new Date() } },
          { upsert: true }
        );
        if (result.upsertedCount) upserted++;
      }

      // Index pour les requêtes fréquentes
      await db.collection("capteurs_trafic").createIndex({ sensor_id: 1 }, { unique: true });
      await db.collection("capteurs_trafic").createIndex({ sous_type: 1 });
      await db.collection("capteurs_trafic").createIndex({ quartier:  1 });
      await db.collection("capteurs_trafic").createIndex({ statut:    1 });

      res.json({ total: rows.length, inserted: upserted, message: "Import terminé" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // GET /capteurs
  // Tous les capteurs — filtres optionnels : ?sous_type=autoroute&quartier=Maarif&statut=actif
  static async getAll(req, res) {
    try {
      const db = getDb();

      // Fallback CSV si Mongo indisponible
      if (!db) {
        let rows = loadCSV().map(parseRow);
        rows = capteurController._applyFilters(rows, req.query);
        return res.json(rows);
      }

      const filter = capteurController._buildMongoFilter(req.query);
      const data   = await db.collection("capteurs_trafic").find(filter, { projection: { _id: 0 } }).toArray();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // GET /capteurs/:sensor_id
  static async getOne(req, res) {
    try {
      const db = getDb();
      if (!db) {
        const rows = loadCSV().map(parseRow);
        const found = rows.find(r => r.sensor_id === req.params.sensor_id);
        return found ? res.json(found) : res.status(404).json({ error: "Capteur introuvable" });
      }
      const doc = await db.collection("capteurs_trafic").findOne(
        { sensor_id: req.params.sensor_id },
        { projection: { _id: 0 } }
      );
      doc ? res.json(doc) : res.status(404).json({ error: "Capteur introuvable" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // GET /capteurs/meta/types     → liste des sous_type distincts
  // GET /capteurs/meta/quartiers → liste des quartiers distincts
  static async getMeta(req, res) {
    try {
      const field = req.params.field; // "types" | "quartiers"
      const key   = field === "types" ? "sous_type" : "quartier";

      const db = getDb();
      if (!db) {
        const rows   = loadCSV().map(parseRow);
        const unique = [...new Set(rows.map(r => r[key]))].sort();
        return res.json(unique);
      }

      const unique = await db.collection("capteurs_trafic").distinct(key);
      res.json(unique.sort());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ── Helpers internes ───────────────────────────────────────
  static _buildMongoFilter({ sous_type, quartier, statut }) {
    const f = {};
    if (sous_type) f.sous_type = sous_type;
    if (quartier)  f.quartier  = quartier;
    if (statut)    f.statut    = statut;
    return f;
  }

  static _applyFilters(rows, { sous_type, quartier, statut }) {
    return rows.filter(r =>
      (!sous_type || r.sous_type === sous_type) &&
      (!quartier  || r.quartier  === quartier)  &&
      (!statut    || r.statut    === statut)
    );
  }
}

module.exports = capteurController;