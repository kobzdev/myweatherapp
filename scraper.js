/* scraper.js
 * Pluggable weather data-provider architecture.
 *
 * The brief asks us to scrape https://transsion-h5.weahunter.com/hourly
 * That page (built for Transsion/HiOS devices) renders its data client-side
 * from a private, signed, anti-bot-protected endpoint that is not reachable
 * from a browser context (no public CORS headers, requires device-specific
 * signing headers). Because of that we register it as the FIRST provider in
 * the chain (in case it ever becomes reachable, e.g. through a configurable
 * proxy the user supplies in Settings), then automatically fall through to a
 * fully public, CORS-enabled, key-less provider (Open-Meteo) so the app is
 * always functional. Every provider normalizes its response into the exact
 * same shape, so the rest of the app never needs to know which one answered.
 *
 * Normalized shape:
 * {
 *   location: { name, lat, lon, key },
 *   current: { temp, feelsLike, condition, icon, humidity, windSpeed,
 *              windDir, pressure, uvIndex, visibility, sunrise, sunset, aqi, moonPhase },
 *   hourly: [ { time, icon, temp, rainChance, wind } ... 24+ ],
 *   daily:  [ { date, icon, high, low, rainChance } ... 7 ],
 *   source: 'weahunter' | 'open-meteo' | 'cache' | 'manual',
 *   fetchedAt: <ms epoch>
 * }
 */
'use strict';

const WeatherScraper = (() => {
  const FETCH_TIMEOUT_MS = 8000;

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
  }

  function iconFromWMO(code, isDay) {
    // Maps Open-Meteo WMO weather codes to a small internal icon vocabulary
    // consumed by ui.js's animated SVG icon set.
    const day = isDay ? 'day' : 'night';
    if (code === 0) return `clear-${day}`;
    if ([1, 2].includes(code)) return `partly-cloudy-${day}`;
    if (code === 3) return 'cloudy';
    if ([45, 48].includes(code)) return 'fog';
    if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ([95, 96, 99].includes(code)) return 'thunderstorm';
    return `partly-cloudy-${day}`;
  }

  function conditionTextFromWMO(code) {
    const map = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Depositing rime fog',
      51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
      56: 'Freezing drizzle', 57: 'Dense freezing drizzle',
      61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain',
      66: 'Freezing rain', 67: 'Heavy freezing rain',
      71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
      80: 'Rain showers', 81: 'Rain showers', 82: 'Violent rain showers',
      85: 'Snow showers', 86: 'Heavy snow showers',
      95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ heavy hail',
    };
    return map[code] || 'Unknown';
  }

  function computeMoonPhase(date) {
    // Simple synodic-month approximation (no external dependency needed).
    const synodic = 29.53058867;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const diffDays = (date.getTime() - knownNewMoon) / 86400000;
    const phase = ((diffDays % synodic) + synodic) % synodic;
    const pct = phase / synodic;
    const names = [
      'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
      'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
    ];
    const idx = Math.round(pct * 8) % 8;
    return { name: names[idx], fraction: pct };
  }

  /* ---------------- Provider: WeaHunter (Transsion) ---------------- *
   * Left in place and attempted first. In a browser this will almost
   * always reject (opaque/CORS-blocked or anti-bot challenge) which is
   * expected -- we catch it silently and move to the next provider.
   * Users can point PROXY_ENDPOINT (Settings > Advanced) at their own
   * CORS proxy to make this provider live without touching app code.
   */
  const WeaHunterProvider = {
    name: 'weahunter',
    async fetch(location, settings) {
      const proxy = settings && settings.proxyEndpoint;
      const base = 'https://transsion-h5.weahunter.com/hourly';
      const qs = `lan=en&location=${location.lon},${location.lat}&par=transsion&level=3`;
      const url = proxy ? `${proxy.replace(/\/$/, '')}/${base}?${qs}` : `${base}?${qs}`;

      const res = await withTimeout(fetch(url, { mode: 'cors', credentials: 'omit' }), FETCH_TIMEOUT_MS);
      if (!res.ok) throw new Error(`weahunter HTTP ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        // The public page returns HTML shell with client-rendered data;
        // without the private XHR endpoint this can't be parsed reliably.
        throw new Error('weahunter did not return JSON (no accessible API)');
      }
      const json = await res.json();
      return WeaHunterProvider.normalize(json, location);
    },
    normalize(json, location) {
      // Best-effort normalizer in case a compatible JSON payload is ever
      // reachable (e.g. via user-supplied proxy or pasted export).
      const d = json.data || json;
      return {
        location,
        current: {
          temp: d.current?.temp ?? d.temp,
          feelsLike: d.current?.feelsLike ?? d.feelsLike,
          condition: d.current?.condition ?? d.weather ?? 'Unknown',
          icon: d.current?.icon ?? 'partly-cloudy-day',
          humidity: d.current?.humidity ?? d.humidity,
          windSpeed: d.current?.windSpeed ?? d.windSpeed,
          windDir: d.current?.windDir ?? d.windDir ?? '--',
          pressure: d.current?.pressure ?? d.pressure,
          uvIndex: d.current?.uv ?? d.uv ?? 0,
          visibility: d.current?.visibility ?? d.visibility ?? 10,
          sunrise: d.current?.sunrise ?? d.sunrise,
          sunset: d.current?.sunset ?? d.sunset,
          aqi: d.current?.aqi ?? null,
          moonPhase: computeMoonPhase(new Date()),
        },
        hourly: (d.hourly || []).map(h => ({
          time: h.time, icon: h.icon || 'partly-cloudy-day', temp: h.temp,
          rainChance: h.rainChance ?? 0, wind: h.wind ?? 0,
        })),
        daily: (d.daily || []).map(dd => ({
          date: dd.date, icon: dd.icon || 'partly-cloudy-day',
          high: dd.high, low: dd.low, rainChance: dd.rainChance ?? 0,
        })),
        source: 'weahunter',
        fetchedAt: Date.now(),
      };
    },
  };

  /* ---------------- Provider: Open-Meteo (public, no key, CORS-open) ---------------- */
  const OpenMeteoProvider = {
    name: 'open-meteo',
    async fetch(location) {
      const params = new URLSearchParams({
        latitude: location.lat,
        longitude: location.lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day,visibility',
        hourly: 'temperature_2m,weather_code,precipitation_probability,wind_speed_10m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max',
        timezone: 'auto',
        forecast_days: '10',
      });
      const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
      const res = await withTimeout(fetch(url), FETCH_TIMEOUT_MS);
      if (!res.ok) throw new Error(`open-meteo HTTP ${res.status}`);
      const json = await res.json();

      // Air quality is a separate free Open-Meteo endpoint.
      let aqi = null;
      try {
        const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.lat}&longitude=${location.lon}&current=us_aqi`;
        const aqRes = await withTimeout(fetch(aqUrl), FETCH_TIMEOUT_MS);
        if (aqRes.ok) {
          const aqJson = await aqRes.json();
          aqi = aqJson.current?.us_aqi ?? null;
        }
      } catch (e) { /* AQI is a bonus feature; ignore failures */ }

      return OpenMeteoProvider.normalize(json, location, aqi);
    },
    normalize(json, location, aqi) {
      const c = json.current;
      const isDay = !!c.is_day;
      const now = new Date();

      const hourly = json.hourly.time
        .map((t, i) => ({
          time: t,
          icon: iconFromWMO(json.hourly.weather_code[i], (new Date(t).getHours() >= 6 && new Date(t).getHours() < 18)),
          temp: json.hourly.temperature_2m[i],
          rainChance: json.hourly.precipitation_probability[i],
          wind: json.hourly.wind_speed_10m[i],
        }))
        .filter(h => new Date(h.time).getTime() >= now.getTime() - 3600000)
        .slice(0, 48);

      const daily = json.daily.time.map((t, i) => ({
        date: t,
        icon: iconFromWMO(json.daily.weather_code[i], true),
        high: json.daily.temperature_2m_max[i],
        low: json.daily.temperature_2m_min[i],
        rainChance: json.daily.precipitation_probability_max[i],
        sunrise: json.daily.sunrise[i],
        sunset: json.daily.sunset[i],
        uvIndex: json.daily.uv_index_max[i],
      }));

      return {
        location,
        current: {
          temp: c.temperature_2m,
          feelsLike: c.apparent_temperature,
          condition: conditionTextFromWMO(c.weather_code),
          icon: iconFromWMO(c.weather_code, isDay),
          humidity: c.relative_humidity_2m,
          windSpeed: c.wind_speed_10m,
          windDir: degToCompass(c.wind_direction_10m),
          pressure: c.surface_pressure,
          uvIndex: daily[0]?.uvIndex ?? 0,
          visibility: (c.visibility ?? 10000) / 1000,
          sunrise: daily[0]?.sunrise,
          sunset: daily[0]?.sunset,
          aqi,
          moonPhase: computeMoonPhase(now),
        },
        hourly,
        daily,
        source: 'open-meteo',
        fetchedAt: Date.now(),
      };
    },
  };

  function degToCompass(deg) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  /* ---------------- Geocoding (search) ---------------- */
  async function searchLocations(query) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
    const res = await withTimeout(fetch(url), FETCH_TIMEOUT_MS);
    if (!res.ok) throw new Error(`geocoding HTTP ${res.status}`);
    const json = await res.json();
    return (json.results || []).map(r => ({
      key: `${r.latitude.toFixed(3)},${r.longitude.toFixed(3)}`,
      name: r.name,
      admin1: r.admin1 || '',
      country: r.country || '',
      lat: r.latitude,
      lon: r.longitude,
    }));
  }

  /* ---------------- Orchestration: try providers in order ---------------- */
  const providers = [WeaHunterProvider, OpenMeteoProvider];

  async function fetchWeather(location, settings) {
    let lastError = null;
    for (const provider of providers) {
      try {
        const data = await provider.fetch(location, settings);
        return data;
      } catch (err) {
        lastError = err;
        console.info(`[scraper] provider "${provider.name}" unavailable: ${err.message}`);
      }
    }
    throw lastError || new Error('All weather providers failed');
  }

  // Allows a user to paste an exported JSON payload as an explicit fallback.
  function fromManualJSON(text, location) {
    const json = JSON.parse(text);
    if (json.hourly && json.hourly.time) {
      return OpenMeteoProvider.normalize(json, location, json.aqi ?? null);
    }
    return Object.assign({}, WeaHunterProvider.normalize(json, location), { source: 'manual' });
  }

  return {
    fetchWeather,
    searchLocations,
    fromManualJSON,
    _providers: providers,
  };
})();
