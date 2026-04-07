const { getDb } = require("./db.js");

class musicController {

    // GET /musiques/search/:query
    static async searchDeezer(req, res) {
        try {
            const query = req.params.query;
            const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=40`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.error) return res.status(500).json({ error: data.error.message });
            res.json(data.data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // GET /musiques/top
    static async getTopCharts(req, res) {
        try {
            const url = `https://api.deezer.com/chart/0/tracks?limit=40`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.error) return res.status(500).json({ error: data.error.message });
            res.json(data.data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // GET /musiques/geo?ids=123,456,789
    // Retourne les coordonnées géographiques pour une liste d'artist_id Deezer
static async getTracksGeo(req, res) {
  try {
    const db  = getDb();
    const ids = req.query.ids ? req.query.ids.split(',') : [];
    if (!ids.length) return res.json([]);

    const uniqueIds = [...new Set(ids)].slice(0, 8);
    const results   = [];

    for (const id of uniqueIds) {
      try {
        // ── 1. Vérifier le cache MongoDB ─────────────────────
        if (db) {
          const cached = await db.collection("artistes_geo").findOne({ artist_id: id });
          if (cached) {
            results.push(cached);
            continue; // pas besoin d'appeler les APIs externes
          }
        }

        // ── 2. Deezer ─────────────────────────────────────────
        const deezerRes = await fetch(`https://api.deezer.com/artist/${id}`);
        const artist    = await deezerRes.json();
        if (artist.error) continue;

        // ── 3. MusicBrainz → vraie origine géographique ──────
        const mbRes  = await fetch(
          `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artist.name)}&limit=1&fmt=json`,
          { headers: { 'User-Agent': 'MeteoPro-MusicApp/1.0 contact@meteoPro.dev' } }
        );
        const mbData = await mbRes.json();
        const area   = mbData.artists?.[0]?.["begin-area"]?.name
                    || mbData.artists?.[0]?.area?.name;

        let lat = null, lon = null, location = 'Localisation inconnue';

        if (area) {
          // ── 4. Nominatim géocode la vraie ville/pays ────────
          const geoRes  = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(area)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'MeteoPro-MusicApp/1.0 contact@meteoPro.dev' } }
          );
          const geoData = await geoRes.json();
          if (geoData[0]) {
            lat      = parseFloat(geoData[0].lat);
            lon      = parseFloat(geoData[0].lon);
            location = geoData[0].display_name;
          }
          await new Promise(r => setTimeout(r, 1100)); // rate limit Nominatim
        }

        const doc = {
          artist_id:   id,
          artist_name: artist.name,
          picture:     artist.picture_medium || '',
          fans:        artist.nb_fan         || 0,
          area,         // ville/pays MusicBrainz
          lat,
          lon,
          location,
          cachedAt:    new Date()
        };

        // ── 5. Upsert dans MongoDB ────────────────────────────
        if (db) {
          await db.collection("artistes_geo").updateOne(
            { artist_id: id },
            { $set: doc },
            { upsert: true }
          );
        }

        results.push(doc);
        await new Promise(r => setTimeout(r, 1100)); // rate limit MusicBrainz

      } catch { continue; }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

    // POST /musiques/save
    static async saveMusic(req, res) {
        try {
            const db = getDb();
            if (!db) return res.status(503).json({ error: "MongoDB non disponible" });
            const music = req.body;
            const existing = await db.collection("musiques").findOne({ deezer_id: music.deezer_id });
            if (existing) return res.status(409).json({ error: "Déjà dans la bibliothèque", music: existing });
            const result = await db.collection("musiques").insertOne({ ...music, savedAt: new Date() });
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // GET /musiques
    static async getLibrary(req, res) {
        try {
            const db = getDb();
            if (!db) return res.json([]);
            const data = await db.collection("musiques").find().sort({ savedAt: -1 }).toArray();
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // GET /musiques/library/search/:query
    static async searchLibrary(req, res) {
        try {
            const db = getDb();
            if (!db) return res.json([]);
            const query = req.params.query;
            const data = await db.collection("musiques")
                .find({ $or: [
                    { titre:   { $regex: query, $options: "i" } },
                    { artiste: { $regex: query, $options: "i" } },
                    { album:   { $regex: query, $options: "i" } }
                ]})
                .sort({ savedAt: -1 }).toArray();
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // DELETE /musiques/:deezer_id
    static async deleteMusic(req, res) {
        try {
            const db = getDb();
            if (!db) return res.status(503).json({ error: "MongoDB non disponible" });
            const result = await db.collection("musiques").deleteOne({ deezer_id: parseInt(req.params.deezer_id) });
            if (result.deletedCount === 0) return res.status(404).json({ error: "Musique non trouvée" });
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // DELETE /musiques
    static async deleteAll(req, res) {
        try {
            const db = getDb();
            if (!db) return res.status(503).json({ error: "MongoDB non disponible" });
            const result = await db.collection("musiques").deleteMany({});
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = musicController;