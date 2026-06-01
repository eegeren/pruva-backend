const fetch = require('node-fetch');

function mergeHourly(marineHourly = {}, forecastHourly = {}) {
  const time = marineHourly.time?.length ? marineHourly.time : forecastHourly.time || [];

  return {
    time,
    wave_height: marineHourly.wave_height || [],
    wave_direction: marineHourly.wave_direction || [],
    wave_period: marineHourly.wave_period || [],
    wind_wave_height: marineHourly.wind_wave_height || [],
    wind_speed_10m: forecastHourly.wind_speed_10m || [],
    wind_direction_10m: forecastHourly.wind_direction_10m || [],
    temperature_2m: forecastHourly.temperature_2m || [],
    apparent_temperature: forecastHourly.apparent_temperature || [],
    precipitation: forecastHourly.precipitation || [],
    pressure_msl: forecastHourly.pressure_msl || [],
  };
}

exports.getMarine = async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });

    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_direction,wave_period,wind_wave_height&forecast_days=7&timezone=Europe/Istanbul`;
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,apparent_temperature,precipitation,pressure_msl&wind_speed_unit=kn&forecast_days=7&timezone=Europe/Istanbul`;

    const [marineResponse, forecastResponse] = await Promise.all([
      fetch(marineUrl),
      fetch(forecastUrl),
    ]);

    const [marineData, forecastData] = await Promise.all([
      marineResponse.json(),
      forecastResponse.json(),
    ]);

    console.log('Weather provider response', {
      provider: 'Open-Meteo Marine + Open-Meteo Forecast',
      lat,
      lon,
      marineStatus: marineResponse.status,
      forecastStatus: forecastResponse.status,
      marineError: marineData.error || null,
      forecastError: forecastData.error || null,
      marineHourlyKeys: Object.keys(marineData.hourly || {}),
      forecastHourlyKeys: Object.keys(forecastData.hourly || {}),
    });
    
    if (marineData.error) {
      return res.status(400).json({ error: 'Marine weather data is not available for this location' });
    }

    const data = {
      ...marineData,
      hourly: mergeHourly(marineData.hourly, forecastData.error ? {} : forecastData.hourly),
      hourly_units: {
        ...(marineData.hourly_units || {}),
        ...(!forecastData.error ? forecastData.hourly_units || {} : {}),
      },
    };
    
    res.json(data);
  } catch (err) {
    next(err);
  }
};
