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
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/anchorages', require('./routes/anchorages'));
app.use('/api/anchorages', require('./routes/comments'));
app.use('/api/anchorages', require('./routes/checkins'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/boats', require('./routes/boats'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/map-points', require('./routes/mapPoints'));
app.use('/api/marine-pois', require('./routes/marinePOIs'));
app.use('/api/admin/import/marine-pois', require('./routes/adminMarinePOIImport'));
app.use('/api/v1/pro-plus', require('./routes/proPlus'));

const { isConfigured: isGeminiConfigured } = require('./services/geminiMapPointEnrichment');

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Pruva API',
    gemini_configured: isGeminiConfigured(),
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pruva API -> http://localhost:${PORT}`));
