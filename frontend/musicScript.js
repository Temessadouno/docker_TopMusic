// ═══════════════════════════════════════════════════════════
//  musicScript.js — Logique complète de l'interface musique
// ═══════════════════════════════════════════════════════════

const API = 'http://localhost:3000';
const audio = document.getElementById('audio');

// ── État global ──────────────────────────────────────────────
let currentTrack  = null;
let playlist      = [];
let currentIdx    = -1;
let libraryIds    = new Set();   // deezer_id des pistes sauvegardées
let currentView   = 'discover';

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  syncLibraryIds();   // charge les IDs sauvegardés depuis MongoDB
  loadTopCharts();    // affiche le top Deezer au démarrage
});

// ═══════════════════════════════════════════════════════════
//  NAVIGATION / VUES
// ═══════════════════════════════════════════════════════════
function switchView(view) {
  currentView = view;

  // Activer le bon onglet sidebar
  document.querySelectorAll('.music-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-${view}`).classList.add('active');

  // Afficher la bonne section
  document.querySelectorAll('.music-view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');

  if (view === 'library') loadLibrary();
}

// ═══════════════════════════════════════════════════════════
//  RECHERCHE
// ═══════════════════════════════════════════════════════════
async function doSearch() {
  const q = document.getElementById('musicInput').value.trim();
  if (!q) return;

  // Basculer sur la vue découvrir
  switchView('discover');
  document.getElementById('discover-title').innerHTML =
    `Résultats <span class="history-count">pour "${q}"</span>`;

  showListLoading('discover-list');
  hideError();

  try {
    const res = await fetch(`${API}/musiques/search/${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('Erreur réseau');
    const tracks = await res.json();
    playlist = tracks;
    renderDiscoverList(tracks);
  } catch {
    showError();
    showListEmpty('discover-list', 'Impossible de contacter le serveur.');
  }
}

// ═══════════════════════════════════════════════════════════
//  TOP CHARTS
// ═══════════════════════════════════════════════════════════
async function loadTopCharts() {
  document.getElementById('discover-title').innerHTML =
    `Top Charts <span class="history-count">Deezer Global</span>`;
  showListLoading('discover-list');

  try {
    const res = await fetch(`${API}/musiques/top`);
    if (!res.ok) throw new Error();
    const tracks = await res.json();
    playlist = tracks;
    renderDiscoverList(tracks);
  } catch {
    showListEmpty('discover-list', 'Serveur inaccessible. Lance le backend.');
  }
}

// ═══════════════════════════════════════════════════════════
//  BIBLIOTHÈQUE (MongoDB)
// ═══════════════════════════════════════════════════════════
async function loadLibrary() {
  showListLoading('library-list');

  try {
    const res = await fetch(`${API}/musiques`);
    if (!res.ok) throw new Error();
    const tracks = await res.json();

    // Normaliser vers le format Deezer pour réutiliser le renderer
    const normalized = tracks.map(t => ({
      id:       t.deezer_id,
      title:    t.titre,
      artist:   { name: t.artiste },
      album:    { title: t.album, cover_medium: t.cover },
      preview:  t.preview,
      duration: t.duration
    }));

    playlist = normalized;

    // Mettre à jour le badge et sous-titre
    document.getElementById('lib-count').textContent = normalized.length;
    document.getElementById('lib-subtitle').textContent = `${normalized.length} titre${normalized.length !== 1 ? 's' : ''}`;

    renderLibraryList(normalized);
  } catch {
    showListEmpty('library-list', 'Impossible de charger la bibliothèque.');
  }
}

// Récupère juste les IDs sauvegardés pour mettre à jour les ♡
async function syncLibraryIds() {
  try {
    const res = await fetch(`${API}/musiques`);
    const data = await res.json();
    libraryIds = new Set(data.map(t => t.deezer_id));
    document.getElementById('lib-count').textContent = data.length;
  } catch { /* backend non démarré, pas grave */ }
}

// ═══════════════════════════════════════════════════════════
//  RENDU LISTES
// ═══════════════════════════════════════════════════════════

/** Liste découverte : bouton sauvegarder ♡ */
function renderDiscoverList(tracks) {
  const el = document.getElementById('discover-list');
  if (!tracks || !tracks.length) {
    el.innerHTML = emptyHTML('Aucun résultat trouvé.');
    return;
  }

  el.innerHTML = tracks.map((t, i) => {
    const saved   = libraryIds.has(t.id);
    const playing = currentTrack?.id === t.id;
    return trackCardHTML(t, i, playing, `
      <button class="btn-action ${saved ? 'saved' : ''}"
              title="${saved ? 'Déjà sauvegardé' : 'Sauvegarder'}"
              onclick="event.stopPropagation(); saveTrack(${i}, this)">
        ${saved ? '♥' : '♡'}
      </button>
    `);
  }).join('');
}

/** Liste bibliothèque : bouton supprimer */
function renderLibraryList(tracks) {
  const el = document.getElementById('library-list');
  if (!tracks || !tracks.length) {
    el.innerHTML = emptyHTML('Ta bibliothèque est vide. Sauvegarde des pistes depuis Découvrir !');
    return;
  }

  el.innerHTML = tracks.map((t, i) => {
    const playing = currentTrack?.id === t.id;
    return trackCardHTML(t, i, playing, `
      <button class="btn-action del"
              title="Supprimer"
              onclick="event.stopPropagation(); removeTrack(${t.id})">
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>
    `);
  }).join('');
}

/** Template HTML d'une carte piste */
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
            : `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`
          }
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

  // Highlight carte
  document.querySelectorAll('.track-card').forEach(c => c.classList.remove('playing'));
  const card = document.getElementById(`card-${t.id}`);
  if (card) card.classList.add('playing');

  // Mettre à jour le player bas
  updatePlayerUI(t);

  // Mettre à jour sidebar "Now playing"
  updateNowPlayingSidebar(t);

  // Lancer l'audio
  audio.src = t.preview || '';
  audio.volume = parseFloat(document.getElementById('vol-slider').value);
  audio.play().catch(() => {}); // catch autoplay policy

  document.getElementById('play-btn').disabled = false;
}

function updatePlayerUI(t) {
  document.getElementById('player-title').textContent  = t.title || '—';
  document.getElementById('player-artist').textContent = t.artist?.name || '—';

  const coverEl = document.getElementById('player-cover');
  const img = t.album?.cover_medium;
  coverEl.innerHTML = img
    ? `<img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover"/>`
    : '';

  // Bouton save dans le player
  const saveBtn = document.getElementById('save-btn-player');
  const saved = libraryIds.has(t.id);
  saveBtn.textContent = saved ? '♥' : '♡';
  saveBtn.classList.toggle('saved', saved);
}

function updateNowPlayingSidebar(t) {
  document.getElementById('np-title-side').textContent  = t.title  || '—';
  document.getElementById('np-artist-side').textContent = t.artist?.name || '—';

  const cover = document.getElementById('np-cover-side');
  const img   = t.album?.cover_medium;
  cover.innerHTML = img
    ? `<img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px"/>`
    : '';
}

function togglePlay() {
  if (!audio.src) return;
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

function playNext() {
  if (!playlist.length) return;
  playTrack((currentIdx + 1) % playlist.length);
}

function playPrev() {
  if (!playlist.length) return;
  playTrack((currentIdx - 1 + playlist.length) % playlist.length);
}

function seekTo(e) {
  if (!audio.duration) return;
  const bar   = document.getElementById('prog-bar');
  const ratio = e.offsetX / bar.offsetWidth;
  audio.currentTime = ratio * audio.duration;
}

function setVolume(v) {
  audio.volume = parseFloat(v);
}

// ── Événements audio ─────────────────────────────────────
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

/** Sauvegarde depuis la liste découverte */
async function saveTrack(idx, btn) {
  const t = playlist[idx];
  if (!t) return;

  const body = {
    deezer_id: t.id,
    titre:     t.title,
    artiste:   t.artist?.name  || '',
    album:     t.album?.title  || '',
    cover:     t.album?.cover_medium || '',
    preview:   t.preview  || '',
    duration:  t.duration || 0
  };

  try {
    const res = await fetch(`${API}/musiques/save`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });

    if (res.status === 409) {
      toast('Déjà dans ta bibliothèque !');
      return;
    }
    if (!res.ok) throw new Error();

    libraryIds.add(t.id);
    btn.textContent = '♥';
    btn.classList.add('saved');
    btn.title = 'Déjà sauvegardé';

    // Mettre à jour le bouton save du player si c'est la piste en cours
    if (currentTrack?.id === t.id) {
      const sp = document.getElementById('save-btn-player');
      sp.textContent = '♥';
      sp.classList.add('saved');
    }

    await syncLibCount();
    toast('Ajouté à ta bibliothèque ✓');
  } catch {
    toast('Erreur lors de la sauvegarde.');
  }
}

/** Sauvegarde la piste en cours depuis le player */
async function saveCurrentTrack() {
  if (!currentTrack) return;

  // Trouver l'indice dans la playlist
  const idx = playlist.findIndex(t => t.id === currentTrack.id);
  if (idx === -1) return;

  // Si c'est la vue découvrir, trouver le bouton correspondant
  const card   = document.getElementById(`card-${currentTrack.id}`);
  const btnInCard = card?.querySelector('.btn-action');
  if (btnInCard) {
    await saveTrack(idx, btnInCard);
  } else {
    // Sauvegarde directe sans bouton de carte (ex: on est en biblio)
    toast('Cette piste est déjà dans ta bibliothèque.');
  }
}

/** Supprime une piste de la bibliothèque */
async function removeTrack(deezer_id) {
  try {
    const res = await fetch(`${API}/musiques/${deezer_id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();

    libraryIds.delete(deezer_id);
    await syncLibCount();
    toast('Supprimé de la bibliothèque.');
    loadLibrary(); // recharger la vue
  } catch {
    toast('Erreur lors de la suppression.');
  }
}

/** Met à jour le badge de compte sans tout recharger */
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
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function fmtDur(s) { return s ? fmtTime(s) : '—'; }

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showListLoading(listId) {
  document.getElementById(listId).innerHTML = '<div class="music-spinner"></div>';
}
function showListEmpty(listId, msg) {
  document.getElementById(listId).innerHTML = emptyHTML(msg);
}
function emptyHTML(msg) {
  return `<div class="empty-state" style="padding:40px 0">${msg}</div>`;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function showError() {
  const el = document.getElementById('music-error');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}
function hideError() {
  document.getElementById('music-error').classList.add('hidden');
}