// ═══════════════════════════════════════════════════════════
//  musicScript.js — Logique complète + carte géographique
// ═══════════════════════════════════════════════════════════

const API   = 'http://localhost:3000';
const audio = document.getElementById('audio');

// ── État global ──────────────────────────────────────────────
let currentTrack = null;
let playlist     = [];
let currentIdx   = -1;
let libraryIds   = new Set();
let currentView  = 'discover';

// ── État carte ───────────────────────────────────────────────
let map            = null;       // instance Leaflet
let mapInitialized = false;
let mapMarkers     = [];         // tous les marqueurs actifs
let mapSearches    = [];         // historique des recherches { query, color, count }
let totalLocated   = 0;

// Palette de couleurs pour différencier les recherches
const SEARCH_COLORS = [
  '#c8a96e', // or   (accent principal)
  '#3d7fff', // bleu (accent secondaire)
  '#e05c6b', // rouge
  '#4ec98f', // vert
  '#b57cf7', // violet
  '#f97b3b', // orange
  '#4dd4e8', // cyan
  '#f7c842', // jaune
];

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  syncLibraryIds();
  loadTopCharts();
});

// ═══════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.music-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-${view}`).classList.add('active');
  document.querySelectorAll('.music-view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');

  if (view === 'library') loadLibrary();
 if (view === 'map') {
  initMap();

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 200);
}
}

// ═══════════════════════════════════════════════════════════
//  RECHERCHE
// ═══════════════════════════════════════════════════════════
async function doSearch() {
  const q = document.getElementById('musicInput').value.trim();
  if (!q) return;

  switchView('discover');
  document.getElementById('discover-title').innerHTML =
    `Résultats <span class="history-count">pour "${q}"</span>`;

  showListLoading('discover-list');
  hideError();

  try {
    const res    = await fetch(`${API}/musiques/search/${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error();
    const tracks = await res.json();
    playlist     = tracks;
    renderDiscoverList(tracks);

    // Géolocaliser les artistes de cette recherche en arrière-plan
    geolocateSearchResults(tracks, q);


  } catch {
    showError();
    showListEmpty('discover-list', 'Impossible de contacter le serveur.');
  }
}

// ═══════════════════════════════════════════════════════════
//  GÉOLOCALISATION DES ARTISTES
// ═══════════════════════════════════════════════════════════

/**
 * Lance la géoloc pour les artistes uniques d'une liste de tracks
 * s'exécute en arrière-plan sans bloquer l'UI
 */
async function geolocateSearchResults(tracks, query) {
  if (!tracks || !tracks.length) return;

  // Extraire les artist_id uniques (max 8)
  const artistIds = [...new Set(tracks.map(t => t.artist?.id).filter(Boolean))].slice(0, 8);
  if (!artistIds.length) return;

  // Choisir une couleur pour cette recherche
  const color = SEARCH_COLORS[mapSearches.length % SEARCH_COLORS.length];

  try {
    const res  = await fetch(`${API}/musiques/geo?ids=${artistIds.join(',')}`);
    if (!res.ok) return;
    const geos = await res.json();
    console.log(`Géoloc de "${query}" :`, geos);

    // Filtrer ceux avec des coordonnées valides
    const valid = geos.filter(g => g.lat !== null && g.lon !== null);
    if (!valid.length) return;

    // Enregistrer la recherche dans la légende
    mapSearches.push({ query, color, count: valid.length });
    updateMapLegend();

    // Ajouter les marqueurs à la carte
    addMarkersToMap(valid, color, query);

    // Mettre à jour le badge
    totalLocated += valid.length;
    document.getElementById('map-count').textContent = totalLocated;
    document.getElementById('map-subtitle').textContent =
      `${totalLocated} artiste${totalLocated > 1 ? 's' : ''} localisé${totalLocated > 1 ? 's' : ''}`;

    toast(`🗺️ ${valid.length} artiste${valid.length > 1 ? 's' : ''} localisé${valid.length > 1 ? 's' : ''} sur la carte`);

  } catch { /* géoloc optionnelle, on ignore les erreurs */ }
}

// ═══════════════════════════════════════════════════════════
//  CARTE LEAFLET
// ═══════════════════════════════════════════════════════════

function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  // Initialiser Leaflet sur le conteneur
  map = L.map('map-container', {
    center:  [20, 10],
    zoom:    2,
    zoomControl: true,
  });

  // Tuiles OpenStreetMap avec filtre sombre via CSS
  const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 18,
  });
  tileLayer.addTo(map);

  // Appliquer filtre sombre sur les tuiles pour matcher le thème
  tileLayer.getContainer && setTimeout(() => {
    const tiles = document.querySelectorAll('#map-container .leaflet-tile-pane');
    tiles.forEach(t => {
      t.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.75) contrast(0.9) saturate(0.6)';
    });
  }, 500);

  // Si des marqueurs ont déjà été géolocalisés avant que la carte soit ouverte
  // (recherche faite avant de switcher sur la vue carte), les ré-ajouter
  mapMarkers.forEach(({ marker }) => marker.addTo(map));
}

/**
 * Ajoute des marqueurs colorés sur la carte
 */
function addMarkersToMap(geos, color, query) {
  // S'assurer que la carte est initialisée
  if (!mapInitialized) initMap();

  // Masquer l'état vide
  document.getElementById('map-empty').classList.add('hidden');

  geos.forEach(g => {
    // Icône SVG personnalisée avec la couleur de la recherche
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:14px; height:14px;
        background:${color};
        border-radius:50%;
        border:2px solid rgba(255,255,255,0.3);
        box-shadow:0 0 8px ${color}88;
        cursor:pointer;
      "></div>`,
      iconSize:   [14, 14],
      iconAnchor: [7, 7],
    });

    const marker = L.marker([g.lat, g.lon], { icon });

    // Popup avec infos artiste
    const fansStr = g.fans > 1000000
      ? `${(g.fans / 1000000).toFixed(1)}M fans`
      : g.fans > 1000
        ? `${(g.fans / 1000).toFixed(0)}K fans`
        : `${g.fans} fans`;

    const shortLocation = g.location.split(',').slice(-2).join(',').trim();

    marker.bindPopup(`
      <div class="map-popup">
        <div class="map-popup-header">
          ${g.picture ? `<img class="map-popup-img" src="${g.picture}" alt=""/>` : ''}
          <div>
            <div class="map-popup-name">${escHtml(g.artist_name)}</div>
            <div class="map-popup-fans">${fansStr}</div>
          </div>
        </div>
        <div class="map-popup-location">${escHtml(shortLocation)}</div>
        <span class="map-popup-query" style="border-color:${color}40;color:${color}">
          ${escHtml(query)}
        </span>
      </div>
    `, { maxWidth: 240 });

    if (map) marker.addTo(map);

    // Stocker pour pouvoir effacer
    mapMarkers.push({ marker, color, query, artistId: g.artist_id });
  });

  // Centrer la carte sur les nouveaux marqueurs
  if (map && geos.length) {
    const bounds = L.latLngBounds(geos.map(g => [g.lat, g.lon]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
  }
}

/**
 * Met à jour la légende des recherches
 */
function updateMapLegend() {
  const legend = document.getElementById('map-legend');
  legend.innerHTML = mapSearches.map(s => `
    <div class="legend-tag">
      <span class="legend-dot-color" style="background:${s.color}"></span>
      ${escHtml(s.query)}
      <span style="color:var(--muted);margin-left:2px">(${s.count})</span>
    </div>
  `).join('');
}

/**
 * Efface tous les marqueurs et reset la carte
 */
function clearMap() {
  mapMarkers.forEach(({ marker }) => {
    if (map) map.removeLayer(marker);
  });
  mapMarkers  = [];
  mapSearches = [];
  totalLocated = 0;

  document.getElementById('map-count').textContent   = '0';
  document.getElementById('map-subtitle').textContent = '0 artiste localisé';
  document.getElementById('map-legend').innerHTML     = '';
  document.getElementById('map-empty').classList.remove('hidden');

  if (map) map.setView([20, 10], 2);
  toast('Carte effacée');
}

// ═══════════════════════════════════════════════════════════
//  TOP CHARTS
// ═══════════════════════════════════════════════════════════
async function loadTopCharts() {
  document.getElementById('discover-title').innerHTML =
    `Top Charts <span class="history-count">Deezer Global</span>`;
  showListLoading('discover-list');

  try {
    const res    = await fetch(`${API}/musiques/top`);
    if (!res.ok) throw new Error();
    const tracks = await res.json();
    playlist     = tracks;
    renderDiscoverList(tracks);

    // Géoloc du top en arrière-plan
    geolocateSearchResults(tracks, 'Top Charts');

  } catch {
    showListEmpty('discover-list', 'Serveur inaccessible. Lance le backend.');
  }
}

// ═══════════════════════════════════════════════════════════
//  BIBLIOTHÈQUE
// ═══════════════════════════════════════════════════════════
async function loadLibrary() {
  showListLoading('library-list');
  try {
    const res    = await fetch(`${API}/musiques`);
    if (!res.ok) throw new Error();
    const tracks = await res.json();

    const normalized = tracks.map(t => ({
      id:       t.deezer_id,
      title:    t.titre,
      artist:   { name: t.artiste },
      album:    { title: t.album, cover_medium: t.cover },
      preview:  t.preview,
      duration: t.duration
    }));

    playlist = normalized;
    document.getElementById('lib-count').textContent    = normalized.length;
    document.getElementById('lib-subtitle').textContent =
      `${normalized.length} titre${normalized.length !== 1 ? 's' : ''}`;
    renderLibraryList(normalized);
  } catch {
    showListEmpty('library-list', 'Impossible de charger la bibliothèque.');
  }
}

async function syncLibraryIds() {
  try {
    const res  = await fetch(`${API}/musiques`);
    const data = await res.json();
    libraryIds = new Set(data.map(t => t.deezer_id));
    document.getElementById('lib-count').textContent = data.length;
  } catch {}
}

// ═══════════════════════════════════════════════════════════
//  RENDU LISTES
// ═══════════════════════════════════════════════════════════
function renderDiscoverList(tracks) {
  const el = document.getElementById('discover-list');
  if (!tracks || !tracks.length) { el.innerHTML = emptyHTML('Aucun résultat trouvé.'); return; }

  el.innerHTML = tracks.map((t, i) => {
    const saved   = libraryIds.has(t.id);
    const playing = currentTrack?.id === t.id;
    return trackCardHTML(t, i, playing, `
      <button class="btn-action ${saved ? 'saved' : ''}"
              title="${saved ? 'Déjà sauvegardé' : 'Sauvegarder'}"
              onclick="event.stopPropagation(); saveTrack(${i}, this)">
        ${saved ? '♥' : '♡'}
      </button>`);
  }).join('');
}

function renderLibraryList(tracks) {
  const el = document.getElementById('library-list');
  if (!tracks || !tracks.length) {
    el.innerHTML = emptyHTML('Ta bibliothèque est vide. Sauvegarde des pistes depuis Découvrir !');
    return;
  }
  el.innerHTML = tracks.map((t, i) => {
    const playing = currentTrack?.id === t.id;
    return trackCardHTML(t, i, playing, `
      <button class="btn-action del" title="Supprimer"
              onclick="event.stopPropagation(); removeTrack(${t.id})">
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>`);
  }).join('');
}

function trackCardHTML(t, idx, playing, actionHTML) {
  const cover = t.album?.cover_medium || '';
  const dur   = fmtDur(t.duration);
  return `
    <div class="track-card ${playing ? 'playing' : ''}" id="card-${t.id}" onclick="playTrack(${idx})">
      <div class="track-cover">
        ${cover ? `<img src="${cover}" onerror="this.style.display='none'" loading="lazy" alt=""/>` : ''}
        <div class="cover-overlay">
          ${playing
            ? `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
            : `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`}
        </div>
      </div>
      <div class="track-info">
        <div class="track-title">${escHtml(t.title)}</div>
        <div class="track-sub">${escHtml(t.artist?.name || '—')} · ${escHtml(t.album?.title || '—')}</div>
      </div>
      <div class="track-actions">
        <span class="track-duration">${dur}</span>
        ${actionHTML}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
//  LECTEUR AUDIO
// ═══════════════════════════════════════════════════════════
function playTrack(idx) {
  const t = playlist[idx];
  if (!t) return;
  currentIdx   = idx;
  currentTrack = t;

  document.querySelectorAll('.track-card').forEach(c => c.classList.remove('playing'));
  document.getElementById(`card-${t.id}`)?.classList.add('playing');

  updatePlayerUI(t);
  updateNowPlayingSidebar(t);

  audio.src = t.preview || '';
  audio.volume = parseFloat(document.getElementById('vol-slider').value);
  audio.play().catch(() => {});
  document.getElementById('play-btn').disabled = false;
}

function updatePlayerUI(t) {
  document.getElementById('player-title').textContent  = t.title || '—';
  document.getElementById('player-artist').textContent = t.artist?.name || '—';
  const coverEl = document.getElementById('player-cover');
  const img     = t.album?.cover_medium;
  coverEl.innerHTML = img ? `<img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover"/>` : '';
  const saveBtn = document.getElementById('save-btn-player');
  const saved   = libraryIds.has(t.id);
  saveBtn.textContent = saved ? '♥' : '♡';
  saveBtn.classList.toggle('saved', saved);
}

function updateNowPlayingSidebar(t) {
  document.getElementById('np-title-side').textContent  = t.title  || '—';
  document.getElementById('np-artist-side').textContent = t.artist?.name || '—';
  const cover = document.getElementById('np-cover-side');
  const img   = t.album?.cover_medium;
  cover.innerHTML = img ? `<img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px"/>` : '';
}

function togglePlay() {
  if (!audio.src) return;
  audio.paused ? audio.play().catch(() => {}) : audio.pause();
}

function playNext() { if (playlist.length) playTrack((currentIdx + 1) % playlist.length); }
function playPrev() { if (playlist.length) playTrack((currentIdx - 1 + playlist.length) % playlist.length); }

function seekTo(e) {
  if (!audio.duration) return;
  audio.currentTime = (e.offsetX / document.getElementById('prog-bar').offsetWidth) * audio.duration;
}
function setVolume(v) { audio.volume = parseFloat(v); }

audio.addEventListener('play',  () => setPlayIcon(true));
audio.addEventListener('pause', () => setPlayIcon(false));
audio.addEventListener('ended', () => playNext());
audio.addEventListener('timeupdate', () => {
  const dur   = audio.duration || 30;
  const ratio = (audio.currentTime / dur) * 100;
  document.getElementById('prog-fill').style.width = ratio + '%';
  document.getElementById('time-cur').textContent  = fmtTime(audio.currentTime);
  document.getElementById('time-dur').textContent  = fmtTime(dur);
});

function setPlayIcon(playing) {
  document.getElementById('play-icon').innerHTML = playing
    ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
    : '<path d="M8 5v14l11-7z"/>';
}

// ═══════════════════════════════════════════════════════════
//  SAUVEGARDE / SUPPRESSION
// ═══════════════════════════════════════════════════════════
async function saveTrack(idx, btn) {
  const t = playlist[idx];
  if (!t) return;

  const body = {
    deezer_id: t.id,
    titre:     t.title,
    artiste:   t.artist?.name        || '',
    album:     t.album?.title        || '',
    cover:     t.album?.cover_medium || '',
    preview:   t.preview             || '',
    duration:  t.duration            || 0
  };

  try {
    const res = await fetch(`${API}/musiques/save`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (res.status === 409) { toast('Déjà dans ta bibliothèque !'); return; }
    if (!res.ok) throw new Error();

    libraryIds.add(t.id);
    btn.textContent = '♥';
    btn.classList.add('saved');
    btn.title = 'Déjà sauvegardé';

    if (currentTrack?.id === t.id) {
      const sp = document.getElementById('save-btn-player');
      sp.textContent = '♥'; sp.classList.add('saved');
    }
    await syncLibCount();
    toast('Ajouté à ta bibliothèque ✓');
  } catch { toast('Erreur lors de la sauvegarde.'); }
}

async function saveCurrentTrack() {
  if (!currentTrack) return;
  const idx      = playlist.findIndex(t => t.id === currentTrack.id);
  if (idx === -1) return;
  const card     = document.getElementById(`card-${currentTrack.id}`);
  const btnInCard = card?.querySelector('.btn-action');
  if (btnInCard) await saveTrack(idx, btnInCard);
  else toast('Cette piste est déjà dans ta bibliothèque.');
}

async function removeTrack(deezer_id) {
  try {
    const res = await fetch(`${API}/musiques/${deezer_id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    libraryIds.delete(deezer_id);
    await syncLibCount();
    toast('Supprimé de la bibliothèque.');
    loadLibrary();
  } catch { toast('Erreur lors de la suppression.'); }
}

async function syncLibCount() {
  try {
    const res  = await fetch(`${API}/musiques`);
    const data = await res.json();
    libraryIds = new Set(data.map(t => t.deezer_id));
    document.getElementById('lib-count').textContent = data.length;
  } catch {}
}

// ═══════════════════════════════════════════════════════════
//  UTILITAIRES
// ═══════════════════════════════════════════════════════════
function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function fmtDur(s) { return s ? fmtTime(s) : '—'; }

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showListLoading(id) { document.getElementById(id).innerHTML = '<div class="music-spinner"></div>'; }
function showListEmpty(id, msg) { document.getElementById(id).innerHTML = emptyHTML(msg); }
function emptyHTML(msg) { return `<div class="empty-state" style="padding:40px 0">${msg}</div>`; }

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}
function showError() {
  const el = document.getElementById('music-error');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}
function hideError() { document.getElementById('music-error').classList.add('hidden'); }