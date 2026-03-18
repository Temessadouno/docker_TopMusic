const { getDb } = require("./db.js");

const apiKey = process.env.OPENWEATHER_API_KEY || "5d2cbc3f48915815b3e12a3b334a47e6";

class Controller {
    static async deleteAll(req, res) {
        try {
            const db = getDb();
            if (!db) 
                return res.status(503).json({ error: "MongoDB non disponible" });
            const result = await db.collection("weather").deleteMany({});
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
   

    static async getWeather(req, res) {
        try {
            const city = req.params.city;
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=fr`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.cod !== 200) return res.status(404).json({ error: "Ville non trouvée" });
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async getForecast(req, res) {
        try {
            const city = req.params.city;
            const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric&lang=fr&cnt=40`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.cod !== "200") return res.status(404).json({ error: "Ville non trouvée" });
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async saveWeather(req, res) {
        try {
            const db = getDb();
            const weather = req.body;
            if (!db) return res.status(503).json({ error: "MongoDB non disponible" });
            const result = await db.collection("weather").insertOne(weather);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async getHistory(req, res) {
        try {
            const db = getDb();
            if (!db) return res.json([]);
            const data = await db.collection("weather").find().sort({ _id: -1 }).limit(50).toArray();
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async getHistoryByCity(req, res) {
        try {
            const db = getDb();
            if (!db) return res.json([]);
            const data = await db.collection("weather")
                .find({ ville: { $regex: req.params.city, $options: "i" } })
                .sort({ _id: -1 })
                .limit(30)
                .toArray();
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}


module.exports = Controller;