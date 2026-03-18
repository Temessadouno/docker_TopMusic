FROM nginx:alpine

# ── Frontend météo (existant) ──────────────────────────
COPY index.html  /usr/share/nginx/html/index.html
COPY script.js   /usr/share/nginx/html/script.js
COPY style.css   /usr/share/nginx/html/style.css

# ── Frontend musique (nouveau) ─────────────────────────
COPY musicInterface.html /usr/share/nginx/html/musicInterface.html
COPY musicScript.js      /usr/share/nginx/html/musicScript.js
COPY musicStyle.css      /usr/share/nginx/html/musicStyle.css

EXPOSE 80