const jwt  = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

/**
 * Generate a signed JWT access token.
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

/**
 * Generate a secure refresh token, persist its hash to DB, and return the raw token.
 */
const generateRefreshToken = async (userId) => {
  const rawToken  = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await RefreshToken.create({ userId, tokenHash, expiresAt });
  return rawToken;
};

/**
 * Verify a raw refresh token: hash it and look up the DB record.
 * Returns the DB record if valid, throws if not.
 */
const verifyRefreshToken = async (rawToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const record = await RefreshToken.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    const err = new Error('Invalid or expired refresh token.');
    err.statusCode = 401;
    throw err;
  }

  return record;
};

/**
 * Revoke a refresh token by deleting its DB record.
 */
const revokeRefreshToken = async (rawToken) => {
  if (!rawToken) return;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await RefreshToken.deleteOne({ tokenHash });
};

module.exports = { generateAccessToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken };
