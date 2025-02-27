const jwt = require('jsonwebtoken');

// Helper function to generate access and refresh tokens
exports.generateTokens = (user) => {
  const payload = { id: user.id };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m' }); // 1 hour
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '1h' }); // 7 days

  return { accessToken, refreshToken };
};
