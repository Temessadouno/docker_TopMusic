const { getDb } = require("./db.js");

class musicController {

    // GET /musiques/search/:query — cherche sur Deezer et retourne les résultats
    static async searchDeezer(req, res) {
        try {
            const query = req.params.query;
            const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=20`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.error) return res.status(500).json({ error: data.error.message });
            res.json(data.data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // GET /musiques/top — top charts Deezer
    static async getTopCharts(req, res) {
        try {
            const url = `https://api.deezer.com/chart/0/tracks?limit=20`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.error) return res.status(500).json({ error: data.error.message });
            res.json(data.data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // POST /musiques/save — sauvegarder une musique dans MongoDB
    static async saveMusic(req, res) {
        try {
            const db = getDb();
            if (!db) return res.status(503).json({ error: "MongoDB non disponible" });
            const music = req.body;
            // Éviter les doublons par deezer_id
            const existing = await db.collection("musiques").findOne({ deezer_id: music.deezer_id });
            if (existing) return res.status(409).json({ error: "Déjà dans la bibliothèque", music: existing });
            const result = await db.collection("musiques").insertOne({
                ...music,
                savedAt: new Date()
            });
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // GET /musiques — toutes les musiques sauvegardées
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

    // GET /musiques/library/search/:query — chercher dans la bibliothèque locale
    static async searchLibrary(req, res) {
        try {
            const db = getDb();
            if (!db) return res.json([]);
            const query = req.params.query;
            const data = await db.collection("musiques")
                .find({
                    $or: [
                        { titre: { $regex: query, $options: "i" } },
                        { artiste: { $regex: query, $options: "i" } },
                        { album: { $regex: query, $options: "i" } }
                    ]
                })
                .sort({ savedAt: -1 })
                .toArray();
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // DELETE /musiques/:deezer_id — supprimer de la bibliothèque
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

    // DELETE /musiques — vider toute la bibliothèque
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