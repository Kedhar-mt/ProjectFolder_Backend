const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  ip: {
    type: String
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  }
});

// Index for faster lookups and token cleanup
TokenSchema.index({ userId: 1 });
TokenSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Token', TokenSchema);