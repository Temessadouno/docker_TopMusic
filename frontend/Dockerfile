FROM nginx:alpine

# ── Frontend météo ──────────────────────────
COPY index.html  /usr/share/nginx/html/index.html
COPY script.js   /usr/share/nginx/html/script.js
COPY style.css   /usr/share/nginx/html/style.css

# ── Frontend musique ─────────────────────────
COPY musicInterface.html /usr/share/nginx/html/musicInterface.html
COPY musicScript.js      /usr/share/nginx/html/musicScript.js
COPY musicStyle.css      /usr/share/nginx/html/musicStyle.css

COPY capteurMapPatch.js /usr/share/nginx/html/capteurMapPatch.js
COPY capteurStyle.css /usr/share/nginx/html/capteurStyle.css

EXPOSE 80