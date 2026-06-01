require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const app = express();
if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET. Create a .env file and set JWT_SECRET.');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/anchorages', require('./routes/anchorages'));
app.use('/api/anchorages', require('./routes/comments'));
app.use('/api/anchorages', require('./routes/checkins'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/boats', require('./routes/boats'));
app.use('/api/map-points', require('./routes/mapPoints'));
app.use('/api/v1/pro-plus', require('./routes/proPlus'));

const { isConfigured: isGeminiConfigured, getQuotaStatus } = require('./services/geminiMapPointEnrichment');

app.get('/health', (req, res) => {
  const gemini = getQuotaStatus();
  res.json({
    status: 'ok',
    app: 'Mavi Yol API',
    gemini_configured: gemini.configured,
    gemini_quota_blocked: gemini.blocked,
    gemini_quota_blocked_until: gemini.blocked_until,
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚢 Mavi Yol API → http://localhost:${PORT}`));
