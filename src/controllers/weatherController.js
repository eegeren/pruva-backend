const fetch = require('node-fetch');

exports.getMarine = async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat ve lon gerekli' });

    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_direction,wave_period&forecast_days=7&timezone=Europe/Istanbul`;

    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ error: 'Bu konum için deniz verisi bulunamadı' });
    }
    
    res.json(data);
  } catch (err) {
    next(err);
  }
};
