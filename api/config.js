// Vercel serverless function — exposes public, non-secret config values to the
// static frontend so they can live in Vercel env vars instead of being
// hardcoded/committed in app.js.

module.exports = async (req, res) => {
  res.status(200).json({
    inpostGeowidgetToken: process.env.INPOST_GEOWIDGET_TOKEN || '',
  });
};
