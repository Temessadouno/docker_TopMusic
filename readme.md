# 🌤 Météo Pro

Application fullstack météo + musique avec graphiques interactifs, lecteur audio Deezer et persistance MongoDB.

## Structure

```
winter/
├── backend/
│   ├── root.js               # API 
│   ├── controller.js           # Routes météo
│   ├── musicController.js      # Routes musique (Deezer + MongoDB)
│   ├── db.js                   # Connexion MongoDB
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── index.html              # Interface météo
│   ├── style.css               # Design partagé
│   ├── script.js               # Logique météo + graphiques Chart.js
│   ├── musicInterface.html     # Interface musique
│   ├── musicScript.js          # Logique musique
│   ├── musicStyle.css          # Styles musique
│   └── Dockerfile
└── docker-compose.yml
```

---

## 🚀 Démarrage rapide (recommandé)

```bash
docker-compose up --no-build -d
```

| Service       | URL                                        |
|---------------|--------------------------------------------|
| Frontend météo| http://localhost:8080                      |
| Frontend musique | http://localhost:8080/musicInterface.html |
| Backend API   | http://localhost:3000                      |
| Mongo Express | http://localhost:8081                      |

---

## 🔨 Première installation (build des images)

> ⚠️ Nécessite une connexion internet active pour Docker Hub.

```powershell
# 1. Construire les images
docker build -t meteo-backend:1.0.0 ./backend
docker build -t meteo-frontend:1.0.0 ./frontend

# 2. Lancer tous les services
docker-compose up --build -d
```

---

## ♻️ Développement live (modifications sans rebuild)

Les fichiers sources sont montés directement dans les conteneurs via des volumes.

**Frontend** — chaque modification est visible après un simple **F5** :
```
frontend/*.html  →  nginx sert directement depuis le disque
frontend/*.css   →  idem
frontend/*.js    →  idem
```

**Backend** — redémarrer le conteneur après une modification :
```powershell
docker-compose restart backend
```

---

## 🛑 Commandes utiles

```powershell
# Voir l'état des conteneurs
docker-compose ps

# Logs en temps réel
docker-compose logs -f backend
docker-compose logs -f frontend

# Arrêter tous les services
docker-compose down

# Arrêter et supprimer les volumes (reset MongoDB)
docker-compose down -v

# Rebuilder une image spécifique
docker build -t meteo-backend:1.0.0 ./backend
docker build -t meteo-frontend:1.0.0 ./frontend
docker-compose up -d --force-recreate --no-build
```

---

## ⚙️ Variables d'environnement

| Variable              | Valeur par défaut                                        | Service  |
|-----------------------|----------------------------------------------------------|----------|
| `MONGO_URL`           | `mongodb://admin:pass@mongo:27017/?authSource=admin`     | backend  |
| `OPENWEATHER_API_KEY` | clé incluse dans `controller.js`                         | backend  |
| `MONGO_INITDB_ROOT_USERNAME` | `admin`                                         | mongo    |
| `MONGO_INITDB_ROOT_PASSWORD` | `pass`                                          | mongo    |

---

## 🌐 API Endpoints

### Météo

| Route              | Méthode | Description                     |
|--------------------|---------|----------------------------------|
| `/weather/:city`   | GET     | Météo actuelle                   |
| `/forecast/:city`  | GET     | Prévisions 5 jours               |
| `/save`            | POST    | Sauvegarder dans MongoDB         |
| `/all`             | GET     | Historique complet               |
| `/history/:city`   | GET     | Historique filtré par ville      |
| `/delete`          | DELETE  | Vider l'historique               |

### Musique

| Route                          | Méthode | Description                        |
|--------------------------------|---------|------------------------------------|
| `/musiques/top`                | GET     | Top 20 charts Deezer               |
| `/musiques/search/:query`      | GET     | Recherche sur Deezer               |
| `/musiques`                    | GET     | Bibliothèque sauvegardée           |
| `/musiques/library/search/:q`  | GET     | Recherche dans la bibliothèque     |
| `/musiques/save`               | POST    | Sauvegarder une piste              |
| `/musiques/:deezer_id`         | DELETE  | Supprimer une piste                |
| `/musiques`                    | DELETE  | Vider la bibliothèque              |

---

## ✨ Fonctionnalités

### Météo
- **Mode Dashboard** : météo actuelle + prévisions 5 jours + historique
- **Mode Graphique** : courbes température/humidité, type ligne ou barres
- Sauvegarde MongoDB avec feedback visuel
- Recherche par ville (Enter ou bouton)

### Musique
- **Découvrir** : top charts Deezer + recherche en temps réel
- **Bibliothèque** : pistes sauvegardées dans MongoDB (sans doublons)
- **Lecteur audio** : preview 30s, play/pause, suivant/précédent, barre de progression, volume
- Sauvegarde ♡ / suppression depuis les deux vues

### Design
- Palette unifiée : `#0e1117` (fond) · `#c8a96e` (or) · `#3d7fff` (bleu)
- Fonts : DM Serif Display · DM Mono · DM Sans
- Responsive mobile