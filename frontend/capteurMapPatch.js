// ═══════════════════════════════════════════════════════════
//  GESTIONNAIRE DE CAPTEURS TRAFIC - CASABLANCA
// ═══════════════════════════════════════════════════════════

let capteurMap;
let markersLayer;
let capteurFilters = { sous_type: '', statut: '' };

// FIX : URL correcte vers le backend local
const CAPTEUR_API = "http://localhost:3000";

// Configuration visuelle par sous_type
const CAPTEUR_CFG = {
    autoroute:  { symbol: '🛣️', color: '#e05c6b', label: 'Autoroute' },
    boulevard:  { symbol: '🚦', color: '#3d7fff', label: 'Boulevard' },
    carrefour:  { symbol: '⊕',  color: '#f97b3b', label: 'Carrefour' },
    corniche:   { symbol: '🌊', color: '#4dd4e8', label: 'Corniche' },
    route:      { symbol: '🛤️', color: '#a78bfa', label: 'Route' },
    tram:       { symbol: '🚊', color: '#34d399', label: 'Tramway' },
    gare:       { symbol: '🚉', color: '#fbbf24', label: 'Gare' },
    aeroport:   { symbol: '✈️', color: '#60a5fa', label: 'Aéroport' },
    port:       { symbol: '⚓', color: '#2dd4bf', label: 'Port' },
    tunnel:     { symbol: '🚇', color: '#f472b6', label: 'Tunnel' },
    pont:       { symbol: '🌉', color: '#fb923c', label: 'Pont' },
    peripherie: { symbol: '◎',  color: '#94a3b8', label: 'Périphérie' },
    default:    { symbol: '●',  color: '#c8a96e', label: 'Autre' }
};

// ── Initialisation ──────────────────────────────────────────
function initCapteurMap() {
    if (capteurMap) {
        capteurMap.invalidateSize();
        return;
    }

    capteurMap = L.map('map-casablanca', { zoomControl: true }).setView([33.5731, -7.5898], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: 'TMT-Pro | &copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
    }).addTo(capteurMap);

    markersLayer = L.layerGroup().addTo(capteurMap);

    // Construire la légende
    buildLegend();
    loadCapteurs();
}

// ── Légende ─────────────────────────────────────────────────
function buildLegend() {
    const legend = document.getElementById('capteur-legend');
    if (!legend) return;
    legend.innerHTML = Object.entries(CAPTEUR_CFG)
        .filter(([k]) => k !== 'default')
        .map(([, cfg]) => `
            <span class="legend-chip" style="border-color:${cfg.color}33;color:${cfg.color}">
                ${cfg.symbol} ${cfg.label}
            </span>`)
        .join('');
}

// ── Chargement des données ──────────────────────────────────
async function loadCapteurs() {
    const countEl = document.getElementById('capteur-count');
    if (countEl) countEl.textContent = '…';

    try {
        const params = new URLSearchParams();
        if (capteurFilters.sous_type) params.set('sous_type', capteurFilters.sous_type);
        if (capteurFilters.statut)    params.set('statut',    capteurFilters.statut);

        const res  = await fetch(`${CAPTEUR_API}/capteurs?${params}`);
        const data = res.ok ? await res.json() : getFallbackData();

        renderTrafficMarkers(Array.isArray(data) ? data : getFallbackData());
    } catch (err) {
        console.warn('API capteurs indisponible — données démo', err);
        renderTrafficMarkers(getFallbackData());
    }
}

// ── Données de démonstration (CSV embarqué) ─────────────────
function getFallbackData() {
    return [
        { nom: "Échangeur A3 Nord", latitude: 33.6421, longitude: -7.5021, sous_type: "autoroute", statut: "actif",       quartier: "Aïn Harrouda",  adresse: "Autoroute A3, km 12" },
        { nom: "Bd Mohammed V - Place ONU", latitude: 33.5921, longitude: -7.6181, sous_type: "boulevard", statut: "actif", quartier: "Centre-Ville", adresse: "Bd Mohammed V" },
        { nom: "Bd Zerktouni - CFC",  latitude: 33.5912, longitude: -7.6261, sous_type: "boulevard", statut: "actif",       quartier: "Anfa",         adresse: "Bd Zerktouni" },
        { nom: "Corniche Ain Diab km1", latitude: 33.5941, longitude: -7.6651, sous_type: "corniche", statut: "actif",      quartier: "Ain Diab",     adresse: "Corniche km 1" },
        { nom: "Rond-point Sidi Maarouf", latitude: 33.5451, longitude: -7.6321, sous_type: "carrefour", statut: "actif",  quartier: "Sidi Maarouf", adresse: "Technopark" },
        { nom: "Tramway T1 - Hassan II", latitude: 33.5921, longitude: -7.6201, sous_type: "tram",     statut: "actif",    quartier: "Centre-Ville", adresse: "Station Hassan II" },
        { nom: "Accès Gare Casa-Port", latitude: 33.5981, longitude: -7.6191, sous_type: "gare",      statut: "actif",     quartier: "Médina",       adresse: "Gare Casa-Port" },
        { nom: "Route Aéroport CMN km3", latitude: 33.5371, longitude: -7.6691, sous_type: "aeroport", statut: "actif",   quartier: "Nouaceur",      adresse: "Route CMN km 3" },
        { nom: "Péage Casa-Berrechid", latitude: 33.4921, longitude: -7.5481, sous_type: "autoroute", statut: "maintenance", quartier: "Lahraouiyine", adresse: "Autoroute A7" },
        { nom: "Carrefour Mers Sultan", latitude: 33.5841, longitude: -7.6201, sous_type: "carrefour", statut: "maintenance", quartier: "Centre-Ville", adresse: "Mers Sultan" },
    ];
}

// ── Rendu des marqueurs ─────────────────────────────────────
function renderTrafficMarkers(capteurs) {
    if (!markersLayer) return;
    markersLayer.clearLayers();

    capteurs.forEach(c => {
        if (!c.latitude || !c.longitude) return;

        const cfg     = CAPTEUR_CFG[c.sous_type] || CAPTEUR_CFG.default;
        const isActif = c.statut === 'actif';

        const icon = L.divIcon({
            className: '',
            html: `<div class="capteur-dot ${isActif ? '' : 'capteur-maintenance'}"
                        style="--c:${cfg.color};background:${cfg.color};
                               box-shadow:0 0 8px ${cfg.color}88">
                   </div>`,
            iconSize:   [14, 14],
            iconAnchor: [7, 7]
        });

        const marker = L.marker([c.latitude, c.longitude], { icon });

        marker.bindPopup(`
            <div class="map-popup">
                <div class="popup-header">
                    <span style="font-size:1.4rem">${cfg.symbol}</span>
                    <div>
                        <strong style="color:#f0f2f6;font-size:0.9rem">${c.nom}</strong><br/>
                        <small style="color:#5a6880">${c.quartier || ''}</small>
                    </div>
                </div>
                <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                    <span style="background:${cfg.color}22;color:${cfg.color};
                                 border:1px solid ${cfg.color}44;
                                 padding:2px 8px;border-radius:20px;font-size:0.75rem">
                        ${cfg.label}
                    </span>
                    <span style="background:${isActif ? '#16a34a22' : '#f97b3b22'};
                                 color:${isActif ? '#4ade80' : '#f97b3b'};
                                 border:1px solid ${isActif ? '#16a34a44' : '#f97b3b44'};
                                 padding:2px 8px;border-radius:20px;font-size:0.75rem">
                        ${isActif ? '● Actif' : '⚠ Maintenance'}
                    </span>
                </div>
                ${c.adresse ? `<div style="margin-top:6px;color:#5a6880;font-size:0.75rem">📍 ${c.adresse}</div>` : ''}
            </div>
        `, { className: 'tmt-popup' });

        markersLayer.addLayer(marker);
    });

    const countEl = document.getElementById('capteur-count');
    if (countEl) countEl.textContent = capteurs.length;
}

// ── Filtres ─────────────────────────────────────────────────
function applyCapteurFilters() {
    const typeEl   = document.getElementById('filter-type');
    const statutEl = document.getElementById('filter-statut');
    capteurFilters.sous_type = typeEl   ? typeEl.value   : '';
    capteurFilters.statut    = statutEl ? statutEl.value : '';
    loadCapteurs();
}

// ── Toggle visibilité des marqueurs ─────────────────────────
function toggleCapteurs(isVisible) {
    if (!capteurMap || !markersLayer) return;
    if (isVisible) capteurMap.addLayer(markersLayer);
    else           capteurMap.removeLayer(markersLayer);
}

// ── Import CSV via API ───────────────────────────────────────
async function importCapteurCSV() {
    const btn = document.getElementById('btn-import');
    if (btn) { btn.disabled = true; btn.textContent = 'Import…'; }
    try {
        const res  = await fetch(`${CAPTEUR_API}/capteurs/import`, { method: 'POST' });
        const data = await res.json();
        alert(`✅ Import terminé : ${data.total} capteurs (${data.inserted} nouveaux)`);
        loadCapteurs();
    } catch (e) {
        alert('❌ Erreur import : ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '⬆ Importer CSV'; }
    }
}