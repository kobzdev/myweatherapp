/* app.js
 * Application orchestrator: wires storage + scraper + ui together,
 * handles GPS, refresh timers, notifications, settings, and PWA install.
 */
'use strict';

const App = (() => {
  let state = {
    settings: Storage.getSettings(),
    favorites: Storage.getFavorites(),
    location: null,
    data: null,
    refreshTimer: null,
    currentHistoryRange: '7',
  };

  const DEFAULT_LOCATION = { key: '10.282,123.986', name: 'Mandaue City', lat: 10.282, lon: 123.986 };

  function init() {
    UI.applyTheme(state.settings.theme);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.settings.theme === 'auto') UI.applyTheme('auto');
    });

    bindEvents();
    registerServiceWorker();

    state.location = Storage.getLastLocation() || DEFAULT_LOCATION;
    UI.renderFavorites(state.favorites, state.location.key, selectLocation, removeFavoriteLocation);

    loadWeather(state.location, { showLoading: true });
    scheduleAutoRefresh();

    window.addEventListener('online', () => { UI.setOfflineBadge(false); loadWeather(state.location); });
    window.addEventListener('offline', () => UI.setOfflineBadge(true));
    UI.setOfflineBadge(!navigator.onLine);

    setupPullToRefresh();
    setupInstallPrompt();
  }

  /* ---------------- Weather loading pipeline ---------------- */
  async function loadWeather(location, { showLoading = false } = {}) {
    if (showLoading) UI.showStatus('Fetching latest weather…', 'info');

    if (!navigator.onLine) {
      return loadFromCache(location, 'You are offline — showing last saved data');
    }

    try {
      const data = await WeatherScraper.fetchWeather(location, state.settings);
      state.data = data;
      Storage.saveCachedWeather(location.key, data);
      recordHistorySnapshot(location.key, data);
      render();
      checkNotifications(data);
      UI.showStatus(`Updated from ${data.source === 'open-meteo' ? 'live weather service' : data.source}`, 'success', 2000);
    } catch (err) {
      console.warn('Weather fetch failed, falling back to cache:', err);
      loadFromCache(location, 'Could not refresh weather — showing cached data');
    }
  }

  function loadFromCache(location, message) {
    const cached = Storage.getCachedWeather(location.key);
    if (cached) {
      state.data = cached;
      render();
      UI.showStatus(message, 'warning');
    } else {
      UI.showStatus('No cached data available for this location yet', 'error');
    }
  }

  function render() {
    if (!state.data) return;
    UI.renderDashboard(state.data, state.settings);
    UI.renderHourly(state.data, state.settings);
    UI.renderDaily(state.data, state.settings);
    UI.renderCharts(state.data);
  }

  function recordHistorySnapshot(locationKey, data) {
    const today = data.daily[0];
    if (!today) return;
    Storage.appendHistory(locationKey, {
      date: new Date().toISOString(),
      tempHigh: today.high,
      tempLow: today.low,
      humidity: data.current.humidity,
      wind: data.current.windSpeed,
      condition: data.current.condition,
    });
  }

  /* ---------------- Location selection ---------------- */
  function selectLocation(key) {
    const loc = state.favorites.find(f => f.key === key) || (state.location.key === key ? state.location : null);
    if (!loc) return;
    state.location = loc;
    Storage.saveLastLocation(loc);
    UI.renderFavorites(state.favorites, state.location.key, selectLocation, removeFavoriteLocation);
    loadWeather(loc, { showLoading: true });
  }

  function removeFavoriteLocation(key) {
    state.favorites = Storage.removeFavorite(key);
    UI.renderFavorites(state.favorites, state.location.key, selectLocation, removeFavoriteLocation);
  }

  function addCurrentToFavorites() {
    if (!state.location) return;
    state.favorites = Storage.addFavorite(state.location);
    UI.renderFavorites(state.favorites, state.location.key, selectLocation, removeFavoriteLocation);
    UI.showStatus('Added to favorites', 'success', 1500);
  }

  function useGPS() {
    if (!('geolocation' in navigator)) {
      UI.showStatus('Geolocation is not supported on this device', 'error');
      return;
    }
    UI.showStatus('Detecting your location…', 'info');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = {
          key: `${pos.coords.latitude.toFixed(3)},${pos.coords.longitude.toFixed(3)}`,
          name: 'My Location',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        };
        state.location = loc;
        Storage.saveLastLocation(loc);
        loadWeather(loc, { showLoading: true });
      },
      err => UI.showStatus(`Location detection failed: ${err.message}`, 'error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  /* ---------------- Search ---------------- */
  let searchDebounce = null;
  function onSearchInput(e) {
    const q = e.target.value.trim();
    clearTimeout(searchDebounce);
    if (q.length < 2) { UI.closeSearchResults(); return; }
    searchDebounce = setTimeout(async () => {
      try {
        const results = await WeatherScraper.searchLocations(q);
        UI.renderSearchResults(results, pickSearchResult);
      } catch (err) {
        UI.showStatus('Search failed — check your connection', 'error');
      }
    }, 350);
  }

  function pickSearchResult(loc) {
    state.location = loc;
    Storage.saveLastLocation(loc);
    UI.closeSearchResults();
    document.querySelector('#searchInput').value = '';
    loadWeather(loc, { showLoading: true });
  }

  /* ---------------- Settings ---------------- */
  function applySettingsToForm() {
    const s = state.settings;
    document.querySelector('#settingUnits').value = s.units;
    document.querySelector('#settingClock').value = String(s.clock);
    document.querySelector('#settingTheme').value = s.theme;
    document.querySelector('#settingRefresh').value = String(s.refreshInterval);
    document.querySelector('#settingNotifRain').checked = s.notifications.heavyRain;
    document.querySelector('#settingNotifStorm').checked = s.notifications.storm;
    document.querySelector('#settingNotifHeat').checked = s.notifications.extremeHeat;
    document.querySelector('#settingNotifWind').checked = s.notifications.strongWind;
  }

  function saveSettingsFromForm() {
    state.settings = {
      ...state.settings,
      units: document.querySelector('#settingUnits').value,
      clock: parseInt(document.querySelector('#settingClock').value, 10),
      theme: document.querySelector('#settingTheme').value,
      refreshInterval: parseInt(document.querySelector('#settingRefresh').value, 10),
      notifications: {
        heavyRain: document.querySelector('#settingNotifRain').checked,
        storm: document.querySelector('#settingNotifStorm').checked,
        extremeHeat: document.querySelector('#settingNotifHeat').checked,
        strongWind: document.querySelector('#settingNotifWind').checked,
      },
    };
    Storage.saveSettings(state.settings);
    UI.applyTheme(state.settings.theme);
    render();
    scheduleAutoRefresh();
    UI.showStatus('Settings saved', 'success', 1500);
    closeModal('#settingsModal');
  }

  /* ---------------- Auto refresh ---------------- */
  function scheduleAutoRefresh() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    const ms = Math.max(5, state.settings.refreshInterval) * 60 * 1000;
    state.refreshTimer = setInterval(() => loadWeather(state.location), ms);
  }

  /* ---------------- Notifications ---------------- */
  function checkNotifications(data) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = state.settings.notifications;
    const alerts = UI.renderRainAlerts(data, state.settings); // also returns computed alerts
    alerts.forEach(a => {
      const key = `notif_${a.text}`;
      if (sessionStorage.getItem(key)) return; // avoid duplicate spam per session
      const shouldNotify =
        (a.text.includes('Heavy rain') && n.heavyRain) ||
        (a.text.includes('Thunderstorm') && n.storm) ||
        (a.text.includes('heat') && n.extremeHeat) ||
        (a.text.includes('wind') && n.strongWind);
      if (shouldNotify) {
        new Notification('Weather Alert', { body: a.text, icon: 'icons/icon-192.png' });
        sessionStorage.setItem(key, '1');
      }
    });
  }

  function requestNotificationPermission() {
    if (!('Notification' in window)) {
      UI.showStatus('Notifications are not supported on this browser', 'error');
      return;
    }
    Notification.requestPermission().then(perm => {
      UI.showStatus(perm === 'granted' ? 'Notifications enabled' : 'Notifications denied', perm === 'granted' ? 'success' : 'warning');
    });
  }

  /* ---------------- History / export / import ---------------- */
  function refreshHistoryView() {
    const history = Storage.getHistory(state.location.key);
    UI.renderHistory(history, state.currentHistoryRange, state.settings);
  }

  function exportHistory() {
    const csv = Storage.exportHistoryCSV(state.location.key);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weather-history-${state.location.key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importHistory(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Storage.importHistoryCSV(state.location.key, reader.result);
        refreshHistoryView();
        UI.showStatus('History imported', 'success');
      } catch (e) {
        UI.showStatus('Failed to import CSV', 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ---------------- Manual JSON paste fallback ---------------- */
  function importManualJSON(text) {
    try {
      const data = WeatherScraper.fromManualJSON(text, state.location);
      state.data = data;
      Storage.saveCachedWeather(state.location.key, data);
      recordHistorySnapshot(state.location.key, data);
      render();
      UI.showStatus('Loaded weather from pasted JSON', 'success');
      closeModal('#manualJsonModal');
    } catch (e) {
      UI.showStatus('Could not parse pasted JSON', 'error');
    }
  }

  /* ---------------- Pull to refresh (mobile) ---------------- */
  function setupPullToRefresh() {
    let startY = null;
    const threshold = 70;
    const indicator = document.querySelector('#pullIndicator');

    window.addEventListener('touchstart', e => {
      if (window.scrollY === 0) startY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', e => {
      if (startY === null) return;
      const delta = e.touches[0].clientY - startY;
      if (delta > 0 && window.scrollY === 0) {
        indicator.style.opacity = Math.min(1, delta / threshold);
        indicator.style.transform = `translateY(${Math.min(delta, threshold)}px)`;
      }
    }, { passive: true });

    window.addEventListener('touchend', e => {
      if (startY === null) return;
      const delta = (e.changedTouches[0].clientY - startY);
      indicator.style.opacity = 0;
      indicator.style.transform = 'translateY(0)';
      if (delta > threshold) loadWeather(state.location, { showLoading: true });
      startY = null;
    });
  }

  /* ---------------- Modal helpers ---------------- */
  function openModal(sel) { document.querySelector(sel).classList.add('open'); }
  function closeModal(sel) { document.querySelector(sel).classList.remove('open'); }

  /* ---------------- PWA install prompt ---------------- */
  let deferredInstallPrompt = null;
  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      document.querySelector('#installBtn').style.display = 'inline-flex';
    });
    document.querySelector('#installBtn').addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      document.querySelector('#installBtn').style.display = 'none';
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => {
          console.warn('Service worker registration failed:', err);
        });
      });
    }
  }

  /* ---------------- Event wiring ---------------- */
  function bindEvents() {
    document.querySelector('#refreshBtn').addEventListener('click', () => loadWeather(state.location, { showLoading: true }));
    document.querySelector('#gpsBtn').addEventListener('click', useGPS);
    document.querySelector('#addFavoriteBtn').addEventListener('click', addCurrentToFavorites);
    document.querySelector('#searchInput').addEventListener('input', onSearchInput);
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) UI.closeSearchResults();
    });

    document.querySelector('#settingsBtn').addEventListener('click', () => { applySettingsToForm(); openModal('#settingsModal'); });
    document.querySelector('#settingsCloseBtn').addEventListener('click', () => closeModal('#settingsModal'));
    document.querySelector('#settingsSaveBtn').addEventListener('click', saveSettingsFromForm);
    document.querySelector('#enableNotifBtn').addEventListener('click', requestNotificationPermission);

    document.querySelector('#historyBtn').addEventListener('click', () => { refreshHistoryView(); openModal('#historyModal'); });
    document.querySelector('#historyCloseBtn').addEventListener('click', () => closeModal('#historyModal'));
    document.querySelectorAll('.history-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.history-range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentHistoryRange = btn.dataset.range;
        refreshHistoryView();
      });
    });
    document.querySelector('#exportHistoryBtn').addEventListener('click', exportHistory);
    document.querySelector('#importHistoryInput').addEventListener('change', e => {
      if (e.target.files[0]) importHistory(e.target.files[0]);
    });

    document.querySelector('#manualJsonBtn').addEventListener('click', () => openModal('#manualJsonModal'));
    document.querySelector('#manualJsonCloseBtn').addEventListener('click', () => closeModal('#manualJsonModal'));
    document.querySelector('#manualJsonSubmitBtn').addEventListener('click', () => {
      importManualJSON(document.querySelector('#manualJsonInput').value);
    });

    document.querySelectorAll('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', e => { if (e.target === bd) bd.classList.remove('open'); });
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
