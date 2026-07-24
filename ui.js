/* ui.js
 * All DOM rendering, animated SVG icon set, and lightweight canvas charts.
 * Deliberately framework-free: template strings + targeted DOM updates.
 */
'use strict';

const UI = (() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  /* ---------------- Animated SVG weather icons ---------------- */
  const ICONS = {
    'clear-day': `<svg viewBox="0 0 64 64"><circle class="sun-core" cx="32" cy="32" r="14" fill="url(#sunGrad)"/><g class="sun-rays">${rays()}</g><defs><radialGradient id="sunGrad"><stop offset="0%" stop-color="#FFE9A8"/><stop offset="100%" stop-color="#FFB74D"/></radialGradient></defs></svg>`,
    'clear-night': `<svg viewBox="0 0 64 64"><path class="moon" d="M40 12a20 20 0 1 0 12 36 16 16 0 0 1-12-36z" fill="url(#moonGrad)"/><circle class="star" cx="14" cy="16" r="1.6" fill="#fff"/><circle class="star" cx="20" cy="28" r="1" fill="#fff"/><circle class="star" cx="10" cy="34" r="1.2" fill="#fff"/><defs><linearGradient id="moonGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#EAF2FF"/><stop offset="100%" stop-color="#B9C7E8"/></linearGradient></defs></svg>`,
    'partly-cloudy-day': `<svg viewBox="0 0 64 64"><circle class="sun-core" cx="24" cy="24" r="10" fill="url(#pcSunGrad)"/><g class="sun-rays">${rays(24, 24, 10)}</g><path class="cloud" d="M20 46a10 10 0 0 1 1-20 13 13 0 0 1 25 3 9 9 0 0 1-2 17H20z" fill="url(#cloudGrad)"/><defs><radialGradient id="pcSunGrad"><stop offset="0%" stop-color="#FFE9A8"/><stop offset="100%" stop-color="#FFB74D"/></radialGradient><linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#D9E2F1"/></linearGradient></defs></svg>`,
    'partly-cloudy-night': `<svg viewBox="0 0 64 64"><path class="moon" d="M34 10a14 14 0 1 0 8 26 11 11 0 0 1-8-26z" fill="#CBD6EF"/><path class="cloud" d="M20 48a10 10 0 0 1 1-20 13 13 0 0 1 25 3 9 9 0 0 1-2 17H20z" fill="url(#cloudGrad2)"/><defs><linearGradient id="cloudGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#E7ECF7"/><stop offset="100%" stop-color="#B9C3D6"/></linearGradient></defs></svg>`,
    'cloudy': `<svg viewBox="0 0 64 64"><path class="cloud cloud-back" d="M8 40a9 9 0 0 1 1-18 11 11 0 0 1 21 2H8z" fill="#C7D0E0"/><path class="cloud" d="M22 50a10 10 0 0 1 1-20 13 13 0 0 1 25 3 9 9 0 0 1-2 17H22z" fill="url(#cloudGrad3)"/><defs><linearGradient id="cloudGrad3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#C9D3E3"/></linearGradient></defs></svg>`,
    'fog': `<svg viewBox="0 0 64 64"><path class="cloud" d="M18 26a10 10 0 0 1 1-20 13 13 0 0 1 25 3 9 9 0 0 1-2 17H18z" fill="#D6DEEC"/><g class="fog-lines" stroke="#A9B6CC" stroke-width="3" stroke-linecap="round"><line x1="8" y1="42" x2="56" y2="42"/><line x1="14" y1="50" x2="50" y2="50"/><line x1="10" y1="58" x2="54" y2="58"/></g></svg>`,
    'drizzle': `<svg viewBox="0 0 64 64"><path class="cloud" d="M20 40a10 10 0 0 1 1-20 13 13 0 0 1 25 3 9 9 0 0 1-2 17H20z" fill="#B7C4DB"/><g class="rain-drops" stroke="#5B8DEF" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="46" x2="20" y2="52"/><line x1="32" y1="46" x2="30" y2="52"/><line x1="42" y1="46" x2="40" y2="52"/></g></svg>`,
    'rain': `<svg viewBox="0 0 64 64"><path class="cloud" d="M20 38a10 10 0 0 1 1-20 13 13 0 0 1 25 3 9 9 0 0 1-2 17H20z" fill="#8FA1C4"/><g class="rain-drops" stroke="#4F7FE0" stroke-width="3" stroke-linecap="round"><line x1="20" y1="46" x2="17" y2="56"/><line x1="32" y1="46" x2="29" y2="56"/><line x1="44" y1="46" x2="41" y2="56"/></g></svg>`,
    'snow': `<svg viewBox="0 0 64 64"><path class="cloud" d="M20 38a10 10 0 0 1 1-20 13 13 0 0 1 25 3 9 9 0 0 1-2 17H20z" fill="#C7D3E8"/><g class="snow-flakes" fill="#EAF2FF"><circle cx="20" cy="50" r="2"/><circle cx="32" cy="54" r="2"/><circle cx="44" cy="50" r="2"/></g></svg>`,
    'thunderstorm': `<svg viewBox="0 0 64 64"><path class="cloud" d="M18 36a10 10 0 0 1 1-20 13 13 0 0 1 25 3 9 9 0 0 1-2 17H18z" fill="#6B7796"/><polygon class="bolt" points="34,42 24,56 32,56 28,64 42,48 34,48" fill="#FFD54A"/></svg>`,
  };

  function rays(cx = 32, cy = 32, r = 14) {
    let out = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const x1 = cx + Math.cos(a) * (r + 4);
      const y1 = cy + Math.sin(a) * (r + 4);
      const x2 = cx + Math.cos(a) * (r + 10);
      const y2 = cy + Math.sin(a) * (r + 10);
      out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#FFC069" stroke-width="3" stroke-linecap="round"/>`;
    }
    return out;
  }

  function icon(name) {
    return ICONS[name] || ICONS['partly-cloudy-day'];
  }

  /* ---------------- Unit conversion helpers ---------------- */
  function fmtTemp(celsius, units) {
    if (celsius === null || celsius === undefined || isNaN(celsius)) return '--°';
    const v = units === 'imperial' ? (celsius * 9) / 5 + 32 : celsius;
    return `${Math.round(v)}°`;
  }
  function fmtSpeed(kmh, units) {
    if (kmh === null || kmh === undefined || isNaN(kmh)) return '--';
    const v = units === 'imperial' ? kmh * 0.621371 : kmh;
    return `${Math.round(v)} ${units === 'imperial' ? 'mph' : 'km/h'}`;
  }
  function fmtTime(iso, clock) {
    if (!iso) return '--:--';
    const d = new Date(iso);
    if (clock === 12) {
      let h = d.getHours() % 12; if (h === 0) h = 12;
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
    }
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function fmtHour(iso, clock) {
    const d = new Date(iso);
    if (clock === 12) {
      let h = d.getHours() % 12; if (h === 0) h = 12;
      return `${h}${d.getHours() >= 12 ? 'PM' : 'AM'}`;
    }
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  }

  /* ---------------- Gradient backgrounds driven by condition + time ---------------- */
  const GRADIENTS = {
    'clear-day': ['#1E8E5A', '#6FCF97'],
    'clear-night': ['#0B1F17', '#123B2A'],
    'partly-cloudy-day': ['#2E9E68', '#7FCB9E'],
    'partly-cloudy-night': ['#0F241B', '#1E3B2C'],
    'cloudy': ['#4B6358', '#7C9A8B'],
    'fog': ['#5E7268', '#9CB1A3'],
    'drizzle': ['#33705A', '#5E9982'],
    'rain': ['#245240', '#3C7B60'],
    'snow': ['#5A9C82', '#D3ECD9'],
    'thunderstorm': ['#122019', '#233F30'],
  };
  function applyBackground(iconName) {
    const [c1, c2] = GRADIENTS[iconName] || GRADIENTS['partly-cloudy-day'];
    document.documentElement.style.setProperty('--bg-gradient-1', c1);
    document.documentElement.style.setProperty('--bg-gradient-2', c2);
  }

  /* ---------------- Plain-language hints (makes raw numbers easier to read) ---------------- */
  function humidityHint(h) {
    if (h == null) return '';
    if (h < 30) return 'Dry';
    if (h < 60) return 'Comfortable';
    if (h < 80) return 'Humid';
    return 'Very humid';
  }
  function uvHint(uv) {
    if (uv == null) return '';
    if (uv < 3) return 'Low';
    if (uv < 6) return 'Moderate';
    if (uv < 8) return 'High';
    if (uv < 11) return 'Very high';
    return 'Extreme';
  }
  function aqiHint(aqi) {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy (sensitive)';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very unhealthy';
    return 'Hazardous';
  }

  /* ---------------- Dashboard render ---------------- */
  function renderDashboard(data, settings) {
    const c = data.current;
    $('#currentTemp').textContent = fmtTemp(c.temp, settings.units);
    $('#currentCondition').textContent = c.condition;
    $('#currentIcon').innerHTML = icon(c.icon);
    $('#locationName').textContent = data.location.name;
    $('#feelsLike').textContent = fmtTemp(c.feelsLike, settings.units);
    $('#humidity').textContent = `${Math.round(c.humidity ?? 0)}%`;
    $('#humidityHint').textContent = humidityHint(c.humidity);
    $('#windSpeed').textContent = fmtSpeed(c.windSpeed, settings.units);
    $('#windDir').textContent = c.windDir || '--';
    $('#pressure').textContent = `${Math.round(c.pressure ?? 0)} hPa`;
    $('#uvIndex').textContent = Math.round(c.uvIndex ?? 0);
    $('#uvHint').textContent = uvHint(c.uvIndex);
    $('#visibility').textContent = `${(c.visibility ?? 0).toFixed(1)} km`;
    $('#sunrise').textContent = fmtTime(c.sunrise, settings.clock);
    $('#sunset').textContent = fmtTime(c.sunset, settings.clock);
    $('#aqiValue').textContent = c.aqi != null ? Math.round(c.aqi) : '--';
    $('#aqiHint').textContent = c.aqi != null ? aqiHint(c.aqi) : '';
    $('#aqiValue').parentElement.style.display = c.aqi != null ? '' : 'none';
    $('#moonPhase').textContent = c.moonPhase ? c.moonPhase.name : '--';

    applyBackground(c.icon);
    renderSunArc(c.sunrise, c.sunset);
    renderLastUpdated(data.fetchedAt, settings.clock);
    renderRainAlerts(data, settings);
  }

  function renderLastUpdated(ts, clock) {
    if (!ts) return;
    $('#lastUpdated').textContent = fmtTime(new Date(ts).toISOString(), clock);
  }

  function renderSunArc(sunriseIso, sunsetIso) {
    const svg = $('#sunArc');
    if (!svg || !sunriseIso || !sunsetIso) return;
    const now = Date.now();
    const sunrise = new Date(sunriseIso).getTime();
    const sunset = new Date(sunsetIso).getTime();
    let progress = (now - sunrise) / (sunset - sunrise);
    progress = Math.min(1, Math.max(0, progress));
    const angle = Math.PI * (1 - progress);
    const x = 100 - Math.cos(angle) * 90;
    const y = 100 - Math.sin(angle) * 90;
    const marker = svg.querySelector('.sun-marker');
    if (marker) {
      marker.setAttribute('cx', x.toFixed(1));
      marker.setAttribute('cy', y.toFixed(1));
    }
  }

  /* ---------------- Hourly forecast ---------------- */
  function renderHourly(data, settings) {
    const track = $('#hourlyTrack');
    track.innerHTML = data.hourly.slice(0, 24).map(h => `
      <div class="hour-card glass">
        <div class="hour-time">${fmtHour(h.time, settings.clock)}</div>
        <div class="hour-icon">${icon(h.icon)}</div>
        <div class="hour-temp">${fmtTemp(h.temp, settings.units)}</div>
        <div class="hour-rain">💧 ${Math.round(h.rainChance)}%</div>
        <div class="hour-wind">${fmtSpeed(h.wind, settings.units)}</div>
      </div>
    `).join('');
  }

  /* ---------------- Daily forecast ---------------- */
  function renderDaily(data, settings) {
    const list = $('#dailyList');
    const dayName = iso => new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
    list.innerHTML = data.daily.slice(0, 7).map((d, i) => `
      <div class="day-row glass">
        <div class="day-name">${i === 0 ? 'Today' : dayName(d.date)}</div>
        <div class="day-icon">${icon(d.icon)}</div>
        <div class="day-rain">💧 ${Math.round(d.rainChance)}%</div>
        <div class="day-temps">
          <span class="day-low">${fmtTemp(d.low, settings.units)}</span>
          <span class="day-bar"><span class="day-bar-fill" style="width:${tempBarWidth(d, data.daily)}%"></span></span>
          <span class="day-high">${fmtTemp(d.high, settings.units)}</span>
        </div>
      </div>
    `).join('');
  }

  function tempBarWidth(day, all) {
    const highs = all.map(d => d.high), lows = all.map(d => d.low);
    const min = Math.min(...lows), max = Math.max(...highs);
    const span = Math.max(1, max - min);
    return Math.max(15, Math.round(((day.high - day.low) / span) * 100));
  }

  /* ---------------- Rain / severe weather alerts ---------------- */
  function renderRainAlerts(data, settings) {
    const box = $('#alertsBox');
    const alerts = [];
    const nextHour = data.hourly[0];
    const todayRain = data.daily[0]?.rainChance ?? 0;

    if (nextHour && nextHour.rainChance >= 60) {
      alerts.push({ level: 'info', text: `Rain likely in the next hour (${Math.round(nextHour.rainChance)}%)` });
    }
    if (todayRain >= 50) {
      alerts.push({ level: 'info', text: `Rain expected today (${Math.round(todayRain)}% chance)` });
    }
    const heavyRainSoon = data.hourly.slice(0, 6).some(h => h.rainChance >= 80);
    if (heavyRainSoon) {
      alerts.push({ level: 'warning', text: 'Heavy rain warning within the next 6 hours' });
    }
    const stormSoon = data.hourly.slice(0, 12).some(h => h.icon === 'thunderstorm');
    if (stormSoon) {
      alerts.push({ level: 'danger', text: 'Thunderstorm warning within the next 12 hours' });
    }
    const strongWind = data.current.windSpeed >= 40;
    if (strongWind) {
      alerts.push({ level: 'warning', text: `Strong wind: ${fmtSpeed(data.current.windSpeed, settings.units)}` });
    }
    const extremeHeat = data.current.temp >= 38;
    if (extremeHeat) {
      alerts.push({ level: 'danger', text: `Extreme heat: ${fmtTemp(data.current.temp, settings.units)}` });
    }

    box.innerHTML = alerts.length
      ? alerts.map(a => `<div class="alert alert-${a.level}">⚠️ ${a.text}</div>`).join('')
      : `<div class="alert alert-ok">✅ No weather alerts</div>`;

    return alerts;
  }

  /* ---------------- Canvas charts (no chart library, per spec) ---------------- */
  function drawLineChart(canvas, points, opts = {}) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    if (!points.length) return;
    const vals = points.map(p => p.value);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const padX = 8, padY = 14;
    const stepX = (w - padX * 2) / Math.max(1, points.length - 1);

    const coords = points.map((p, i) => ({
      x: padX + i * stepX,
      y: padY + (1 - (p.value - min) / span) * (h - padY * 2),
    }));

    // Filled area
    ctx.beginPath();
    ctx.moveTo(coords[0].x, h - padY);
    coords.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(coords[coords.length - 1].x, h - padY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, opts.color || 'rgba(107,155,255,0.45)');
    grad.addColorStop(1, 'rgba(107,155,255,0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    coords.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.strokeStyle = opts.stroke || '#6B9BFF';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Points
    ctx.fillStyle = opts.stroke || '#6B9BFF';
    coords.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function renderCharts(data) {
    const hourly = data.hourly.slice(0, 24);
    drawLineChart($('#chartTemp'), hourly.map(h => ({ value: h.temp })), { stroke: '#FF9F5B', color: 'rgba(255,159,91,0.35)' });
    drawLineChart($('#chartHumidity'), hourly.map((h, i) => ({ value: data.current.humidity != null ? data.current.humidity : 50 })), { stroke: '#5BC8FF', color: 'rgba(91,200,255,0.3)' });
    drawLineChart($('#chartWind'), hourly.map(h => ({ value: h.wind })), { stroke: '#8AE38A', color: 'rgba(138,227,138,0.3)' });
    drawLineChart($('#chartRain'), hourly.map(h => ({ value: h.rainChance })), { stroke: '#B48CFF', color: 'rgba(180,140,255,0.3)' });
  }

  /* ---------------- Favorites / location chips ---------------- */
  function renderFavorites(favorites, activeKey, onSelect, onRemove) {
    const box = $('#favoritesRow');
    box.innerHTML = favorites.map(f => `
      <button class="chip ${f.key === activeKey ? 'chip-active' : ''}" data-key="${f.key}">
        ${f.name}<span class="chip-remove" data-remove="${f.key}">×</span>
      </button>
    `).join('') || `<span class="chip-empty">No favorites yet — search to add one</span>`;

    $$('#favoritesRow .chip').forEach(btn => {
      btn.addEventListener('click', e => {
        if (e.target.matches('[data-remove]')) return;
        onSelect(btn.dataset.key);
      });
    });
    $$('#favoritesRow [data-remove]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        onRemove(el.dataset.remove);
      });
    });
  }

  /* ---------------- Search results ---------------- */
  function renderSearchResults(results, onPick) {
    const box = $('#searchResults');
    if (!results.length) {
      box.innerHTML = `<div class="search-empty">No matches</div>`;
      box.classList.add('open');
      return;
    }
    box.innerHTML = results.map(r => `
      <button class="search-result" data-key="${r.key}">
        <strong>${r.name}</strong>
        <span>${[r.admin1, r.country].filter(Boolean).join(', ')}</span>
      </button>
    `).join('');
    box.classList.add('open');
    $$('.search-result', box).forEach ? null : null;
    Array.from(box.querySelectorAll('.search-result')).forEach(btn => {
      const match = results.find(r => r.key === btn.dataset.key);
      btn.addEventListener('click', () => onPick(match));
    });
  }

  function closeSearchResults() {
    $('#searchResults').classList.remove('open');
  }

  /* ---------------- History view ---------------- */
  function renderHistory(history, range, settings) {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - (range === 'yesterday' ? 1 : range === '7' ? 7 : 30));
    const filtered = history.filter(h => new Date(h.date) >= cutoff);
    const list = $('#historyList');
    if (!filtered.length) {
      list.innerHTML = `<div class="history-empty">No history recorded yet for this range. History builds up automatically each day the app is opened.</div>`;
      return;
    }
    list.innerHTML = filtered.map(h => `
      <div class="history-row">
        <span>${new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        <span>${h.condition}</span>
        <span>${fmtTemp(h.tempHigh, settings.units)} / ${fmtTemp(h.tempLow, settings.units)}</span>
        <span>${Math.round(h.humidity)}%</span>
      </div>
    `).join('');
  }

  /* ---------------- Theme ---------------- */
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }

  /* ---------------- Toast / status ---------------- */
  function showStatus(message, type = 'info', timeout = 3500) {
    const el = $('#statusToast');
    el.textContent = message;
    el.className = `toast toast-${type} toast-visible`;
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => el.classList.remove('toast-visible'), timeout);
  }

  function setOfflineBadge(isOffline) {
    $('#offlineBadge').style.display = isOffline ? 'inline-flex' : 'none';
  }

  return {
    icon,
    fmtTemp, fmtSpeed, fmtTime, fmtHour,
    renderDashboard, renderHourly, renderDaily, renderRainAlerts,
    renderCharts, renderFavorites, renderSearchResults, closeSearchResults,
    renderHistory, applyTheme, showStatus, setOfflineBadge, applyBackground,
  };
})();
