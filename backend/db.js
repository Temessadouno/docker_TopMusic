const { MongoClient } = require("mongodb");

const mongoUrl = process.env.MONGO_URL || "mongodb://admin:pass@localhost:27017/?authSource=admin";

let db;

async function connectDB(retries = 10, delay = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      db = client.db("Meteodb");
      console.log("✅ MongoDB connecté");
      return;
    } catch (err) {
      console.error(`❌ MongoDB tentative ${i}/${retries} : ${err.message}`);
      if (i < retries) {
        console.log(`⏳ Nouvelle tentative dans ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.warn("⚠️  MongoDB inaccessible — le serveur tourne sans persistance");
      }
    }
  }
}

function getDb() {
  return db;
}

module.exports = { connectDB, getDb };