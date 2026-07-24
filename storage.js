/* storage.js
 * Centralized localStorage persistence layer.
 * Everything the app needs to survive offline / reloads lives here.
 */
'use strict';

const Storage = (() => {
  const KEYS = {
    SETTINGS: 'wx_settings',
    FAVORITES: 'wx_favorites',
    LAST_LOCATION: 'wx_last_location',
    CACHE_PREFIX: 'wx_cache_',
    HISTORY_PREFIX: 'wx_history_',
  };

  const DEFAULT_SETTINGS = {
    units: 'metric',        // 'metric' | 'imperial'
    clock: 24,              // 12 | 24
    theme: 'auto',          // 'light' | 'dark' | 'auto'
    refreshInterval: 15,    // minutes
    notifications: {
      heavyRain: true,
      storm: true,
      extremeHeat: true,
      strongWind: true,
    },
    language: 'en',
  };

  function safeGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Storage read failed for', key, e);
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Storage write failed for', key, e);
      return false;
    }
  }

  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, safeGet(KEYS.SETTINGS) || {});
  }

  function saveSettings(settings) {
    return safeSet(KEYS.SETTINGS, settings);
  }

  function getFavorites() {
    return safeGet(KEYS.FAVORITES) || [];
  }

  function saveFavorites(list) {
    return safeSet(KEYS.FAVORITES, list);
  }

  function addFavorite(location) {
    const list = getFavorites();
    if (!list.some(l => l.key === location.key)) {
      list.push(location);
      saveFavorites(list);
    }
    return list;
  }

  function removeFavorite(key) {
    const list = getFavorites().filter(l => l.key !== key);
    saveFavorites(list);
    return list;
  }

  function getLastLocation() {
    return safeGet(KEYS.LAST_LOCATION);
  }

  function saveLastLocation(location) {
    return safeSet(KEYS.LAST_LOCATION, location);
  }

  function cacheKey(locationKey) {
    return KEYS.CACHE_PREFIX + locationKey;
  }

  function getCachedWeather(locationKey) {
    return safeGet(cacheKey(locationKey));
  }

  function saveCachedWeather(locationKey, data) {
    const withTimestamp = Object.assign({}, data, { cachedAt: Date.now() });
    return safeSet(cacheKey(locationKey), withTimestamp);
  }

  function historyKey(locationKey) {
    return KEYS.HISTORY_PREFIX + locationKey;
  }

  function getHistory(locationKey) {
    return safeGet(historyKey(locationKey)) || [];
  }

  // Appends a daily snapshot to history, keeping at most 30 days.
  function appendHistory(locationKey, snapshot) {
    const list = getHistory(locationKey);
    const today = new Date(snapshot.date).toDateString();
    const idx = list.findIndex(s => new Date(s.date).toDateString() === today);
    if (idx >= 0) {
      list[idx] = snapshot;
    } else {
      list.push(snapshot);
    }
    list.sort((a, b) => new Date(a.date) - new Date(b.date));
    while (list.length > 30) list.shift();
    safeSet(historyKey(locationKey), list);
    return list;
  }

  function exportHistoryCSV(locationKey) {
    const list = getHistory(locationKey);
    const header = 'date,tempHigh,tempLow,humidity,wind,condition\n';
    const rows = list.map(s =>
      [s.date, s.tempHigh, s.tempLow, s.humidity, s.wind, s.condition].join(',')
    );
    return header + rows.join('\n');
  }

  function importHistoryCSV(locationKey, csvText) {
    const lines = csvText.trim().split('\n').slice(1);
    const list = lines.map(line => {
      const [date, tempHigh, tempLow, humidity, wind, condition] = line.split(',');
      return {
        date,
        tempHigh: parseFloat(tempHigh),
        tempLow: parseFloat(tempLow),
        humidity: parseFloat(humidity),
        wind: parseFloat(wind),
        condition,
      };
    });
    safeSet(historyKey(locationKey), list);
    return list;
  }

  return {
    KEYS,
    getSettings,
    saveSettings,
    getFavorites,
    saveFavorites,
    addFavorite,
    removeFavorite,
    getLastLocation,
    saveLastLocation,
    getCachedWeather,
    saveCachedWeather,
    getHistory,
    appendHistory,
    exportHistoryCSV,
    importHistoryCSV,
  };
})();
