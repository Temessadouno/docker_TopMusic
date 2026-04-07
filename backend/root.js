const express = require("express");
const cors = require("cors");
const { connectDB } = require("./db.js");
const Controller = require("./controller.js");
const musicController = require("./musicController.js");
const capteurController = require("./capteurController.js");

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

// ─── Routes Météo ─────────────────────────────────────────────
app.delete("/delete",         Controller.deleteAll);
app.get("/weather/:city",     Controller.getWeather);
app.get("/forecast/:city",    Controller.getForecast);
app.get("/all",               Controller.getHistory);
app.get("/history/:city",     Controller.getHistoryByCity);
app.post("/save",             Controller.saveWeather);

// ─── Routes Musique ───────────────────────────────────────────
app.get("/musiques/top",                      musicController.getTopCharts);
app.get("/musiques/geo",                      musicController.getTracksGeo);
app.get("/musiques/search/:query",            musicController.searchDeezer);
app.get("/musiques",                          musicController.getLibrary);
app.get("/musiques/library/search/:query",    musicController.searchLibrary);
app.post("/musiques/save",                    musicController.saveMusic);
app.delete("/musiques/:deezer_id",            musicController.deleteMusic);
app.delete("/musiques",                       musicController.deleteAll);

// ─── Routes Capteurs ──────────────────────────────────────────
// FIX : router correctement monté sur /capteurs
const capteurRouter = express.Router();
capteurRouter.post("/import",     capteurController.importCSV);
capteurRouter.get("/meta/:field", capteurController.getMeta);
capteurRouter.get("/",            capteurController.getAll);
capteurRouter.get("/:sensor_id",  capteurController.getOne);
app.use("/capteurs", capteurRouter);

app.listen(3000, () => console.log("Serveur sur http://localhost:3000"));