// ─────────────────────────────────────────────
//  Configuration
// ─────────────────────────────────────────────
const BACKEND_API = "http://localhost:3000";

let currentWeather = null;
let currentForecast = null;
let chartInstance   = null;
let currentMode     = "dashboard";
let currentGraphTab = "forecast";
let currentChartType = "line";

// ─────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────
window.onload = () => {
  loadHistory();
};



// ─────────────────────────────────────────────
//  Mode switching
// ─────────────────────────────────────────────
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`mode-${mode}`).classList.add("active");
  document.getElementById(`btn-${mode}`).classList.add("active");

  if (mode === "graph" && currentForecast) {
    renderChart();
  }
}



// ─────────────────────────────────────────────
//  Search
// ─────────────────────────────────────────────
async function searchWeather() {
  const city = document.getElementById("cityInput").value.trim();
  if (!city) return;

  hideError();

  try {
    const [weatherRes, forecastRes] = await Promise.all([
      fetch(`${BACKEND_API}/weather/${encodeURIComponent(city)}`),
      fetch(`${BACKEND_API}/forecast/${encodeURIComponent(city)}`)
    ]);

    const weatherData  = await weatherRes.json();
    const forecastData = await forecastRes.json();

    if (weatherData.error || forecastData.error) throw new Error("not found");

    currentWeather  = weatherData;
    currentForecast = forecastData;

    renderCurrent(weatherData);
    renderForecast(forecastData);
    if (currentMode === "graph") renderChart();

  } catch (e) {
    showError();
  }
}

// ─────────────────────────────────────────────
//  Current weather
// ─────────────────────────────────────────────
function renderCurrent(d) {
  document.getElementById("current-section").classList.remove("hidden");

  document.getElementById("cityName").textContent    = `${d.name}, ${d.sys.country}`;
  document.getElementById("weatherDesc").textContent = d.weather[0].description;
  document.getElementById("tempBig").textContent     = `${Math.round(d.main.temp)}°C`;
  document.getElementById("feelsLike").textContent   = `Ressenti ${Math.round(d.main.feels_like)}°C`;
  document.getElementById("weatherDate").textContent = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long"
  });

  document.getElementById("humidity").textContent   = `${d.main.humidity} %`;
  document.getElementById("wind").textContent       = `${Math.round(d.wind.speed * 3.6)} km/h`;
  document.getElementById("pressure").textContent   = `${d.main.pressure} hPa`;
  document.getElementById("visibility").textContent = d.visibility ? `${(d.visibility / 1000).toFixed(1)} km` : "—";
}

// ─────────────────────────────────────────────
//  Forecast
// ─────────────────────────────────────────────
function renderForecast(data) {
  document.getElementById("forecast-section").classList.remove("hidden");

  // Group by day — take noon entry per day
  const byDay = {};
  data.list.forEach(item => {
    const date = item.dt_txt.split(" ")[0];
    const hour = parseInt(item.dt_txt.split(" ")[1]);
    if (!byDay[date] || Math.abs(hour - 12) < Math.abs(parseInt(byDay[date].dt_txt.split(" ")[1]) - 12)) {
      byDay[date] = item;
    }
  });

  const days = Object.values(byDay).slice(0, 5);
  const grid = document.getElementById("forecastGrid");
  grid.innerHTML = "";

  days.forEach(item => {
    const date = new Date(item.dt * 1000);
    const dayName = date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
    const icon = weatherIcon(item.weather[0].main);

    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
      <div class="fc-day">${dayName}</div>
      <div class="fc-icon">${icon}</div>
      <div class="fc-temp">${Math.round(item.main.temp)}°C</div>
      <div class="fc-desc">${item.weather[0].description}</div>
      <div class="fc-hum">💧 ${item.main.humidity}%</div>
    `;
    grid.appendChild(card);
  });
}





// ─────────────────────────────────────────────
//  Chart
// ─────────────────────────────────────────────
function setGraphTab(tab, el) {
  currentGraphTab = tab;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  renderChart();
}

function setChartType(type, el) {
  currentChartType = type;
  document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  renderChart();
}

async function renderChart() {
  if (currentGraphTab === "forecast") {
    if (!currentForecast) return;
    renderForecastChart(currentForecast);
  } else {
    await renderHistoryChart();
  }
}

//Affichage des prévisions dans le graphique
function renderForecastChart(data) {
  // Take every 3h entry (8 per day × 5 days)
  const items = data.list.slice(0, 24);

  const labels = items.map(i => {
    const d = new Date(i.dt * 1000);
    return d.toLocaleDateString("fr-FR", { weekday: "short" }) + " " +
           d.getHours().toString().padStart(2, "0") + "h";
  });
  const temps = items.map(i => Math.round(i.main.temp));
  const hums  = items.map(i => i.main.humidity);

  const city = currentForecast.city?.name || "";
  document.getElementById("chartTitle").textContent = `Prévisions — ${city}`;

  // Mini stats
  document.getElementById("minTemp").textContent  = Math.min(...temps) + "°C";
  document.getElementById("maxTemp").textContent  = Math.max(...temps) + "°C";
  document.getElementById("avgHum").textContent   = Math.round(hums.reduce((a,b)=>a+b,0)/hums.length) + "%";
  const winds = data.list.slice(0,24).map(i => Math.round(i.wind.speed * 3.6));
  document.getElementById("maxWind").textContent  = Math.max(...winds) + " km/h";
  document.getElementById("miniStats").classList.remove("hidden");

  drawChart(labels, temps, hums);
}

//Affichages des historiques dans le graphique
async function renderHistoryChart() {
  try {
    const res = await fetch(`${BACKEND_API}/all`);
    const history = await res.json();

    if (!history.length) {
      document.getElementById("chartWrapper").classList.add("hidden");
      document.getElementById("chartEmpty").textContent = "Aucune donnée historique enregistrée.";
      document.getElementById("chartEmpty").classList.remove("hidden");
      return;
    }

    const sorted = history.slice(-20).reverse();
    const labels = sorted.map(i => `${i.ville} ${i.date ? i.date.substring(0,5) : ""}`);
    const temps  = sorted.map(i => i.temperature);
    const hums   = sorted.map(i => i.humidite);

    document.getElementById("chartTitle").textContent = "Historique enregistré";

    document.getElementById("minTemp").textContent = Math.min(...temps) + "°C";
    document.getElementById("maxTemp").textContent = Math.max(...temps) + "°C";
    document.getElementById("avgHum").textContent  = Math.round(hums.reduce((a,b)=>a+b,0)/hums.length) + "%";
    document.getElementById("maxWind").textContent = "—";
    document.getElementById("miniStats").classList.remove("hidden");

    drawChart(labels, temps, hums);
  } catch (e) {
    console.error(e);
  }
}












//dessin du graphique
function drawChart(labels, temps, hums) {
  document.getElementById("chartEmpty").classList.add("hidden");
  document.getElementById("chartWrapper").classList.remove("hidden");

  if (chartInstance) chartInstance.destroy();

  const ctx = document.getElementById("mainChart").getContext("2d");

  const type = currentChartType;

  chartInstance = new Chart(ctx, {
    type: type,
    data: {
      labels,
      datasets: [
        {
          label: "Température (°C)",
          data: temps,
          borderColor: "#c8a96e",
          backgroundColor: type === "bar" ? "rgba(200,169,110,0.7)" : "rgba(200,169,110,0.08)",
          pointBackgroundColor: "#c8a96e",
          pointRadius: 4,
          borderWidth: 2,
          tension: 0.4,
          yAxisID: "yTemp",
          fill: type === "line",
        },
        {
          label: "Humidité (%)",
          data: hums,
          borderColor: "#3d7fff",
          backgroundColor: type === "bar" ? "rgba(61,127,255,0.6)" : "rgba(61,127,255,0.06)",
          pointBackgroundColor: "#3d7fff",
          pointRadius: 4,
          borderWidth: 2,
          tension: 0.4,
          yAxisID: "yHum",
          fill: type === "line",
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a2030",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          titleColor: "#f0f2f6",
          bodyColor: "#5a6880",
          padding: 12,
          callbacks: {
            label: ctx => {
              const unit = ctx.datasetIndex === 0 ? "°C" : "%";
              return ` ${ctx.dataset.label}: ${ctx.raw}${unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#5a6880", font: { family: "DM Mono", size: 10 }, maxRotation: 45 },
          grid: { color: "rgba(255,255,255,0.04)" }
        },
        yTemp: {
          position: "left",
          ticks: { color: "#c8a96e", font: { family: "DM Mono", size: 11 }, callback: v => v + "°" },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        yHum: {
          position: "right",
          min: 0, max: 100,
          ticks: { color: "#3d7fff", font: { family: "DM Mono", size: 11 }, callback: v => v + "%" },
          grid: { display: false }
        }
      }
    }
  });
}

// ─────────────────────────────────────────────
//  Save & History
// ─────────────────────────────────────────────
async function saveWeather() {
  if (!currentWeather) return;
  const d = currentWeather;

  await fetch(`${BACKEND_API}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ville:       d.name,
      temperature: Math.round(d.main.temp),
      humidite:    d.main.humidity,
      description: d.weather[0].description,
      vent:        Math.round(d.wind.speed * 3.6),
      pression:    d.main.pressure,
      date:        new Date().toLocaleString("fr-FR")
    })
  });

  loadHistory();
}


//chargement des historiques
async function loadHistory() {
  try {
    const res = await fetch(`${BACKEND_API}/all`);
    const history = await res.json();

    const list = document.getElementById("historyList");
    const count = document.getElementById("historyCount");

    count.textContent = `${history.length} entrée${history.length !== 1 ? "s" : ""}`;

    if (!history.length) {
      list.innerHTML = `<div class="empty-state">Aucun enregistrement pour le moment.</div>`;
      return;
    }

    list.innerHTML = history.slice(0, 20).map(item => `
      <div class="history-item">
        <span class="hi-city">${item.ville}</span>
        <span class="hi-desc">${item.description || "—"}</span>
        <span class="hi-temp">${item.temperature}°C</span>
        <span class="hi-date">${item.date || "—"}</span>
      </div>
    `).join("");

  } catch (e) {
    // Backend unavailable
    document.getElementById("historyList").innerHTML =
      `<div class="empty-state">Backend indisponible.</div>`;
  }
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function weatherIcon(main) {
  const map = {
    Clear:        "☀️",
    Clouds:       "☁️",
    Rain:         "🌧️",
    Drizzle:      "🌦️",
    Thunderstorm: "⛈️",
    Snow:         "❄️",
    Mist:         "🌫️",
    Fog:          "🌫️",
    Haze:         "🌫️",
    Smoke:        "🌫️",
    Dust:         "🌪️",
    Sand:         "🌪️",
    Ash:          "🌋",
    Squall:       "💨",
    Tornado:      "🌪️",
  };
  return map[main] || "🌡️";
}

function showError() {
  document.getElementById("error-msg").classList.remove("hidden");
  setTimeout(() => hideError(), 4000);
}
function hideError() {
  document.getElementById("error-msg").classList.add("hidden");
}