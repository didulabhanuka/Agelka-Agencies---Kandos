// utils/jwtUtils.js
const jwt = require("jsonwebtoken");
const {
  JWT_SECRET_KEY,             // access secret
  JWT_EXPIRATION,             // e.g. "15m"
  JWT_REFRESH_SECRET_KEY,     // refresh secret
  JWT_REFRESH_EXPIRATION,     // e.g. "30d"
} = require("../config/env");

// -------------------- Access --------------------
function signAccessToken(payload, opts = {}) {
  return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: JWT_EXPIRATION, ...opts });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET_KEY);
}

// Convenience helpers (recommended)
function signAccessTokenForUser(user) {
  return signAccessToken({
    actorType: "User",
    userId: String(user._id),
    role: user.role, // "Admin" | "DataEntry"
  });
}

function signAccessTokenForSalesRep(salesRep) {
  return signAccessToken({
    actorType: "SalesRep",
    salesRepId: String(salesRep._id),
    role: "SalesRep",
  });
}

// -------------------- Refresh --------------------
function signRefreshToken(payload, opts = {}) {
  return jwt.sign(payload, JWT_REFRESH_SECRET_KEY, {
    expiresIn: JWT_REFRESH_EXPIRATION,
    ...opts,
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET_KEY);
}

function signRefreshTokenForUser(user) {
  return signRefreshToken({
    actorType: "User",
    userId: String(user._id),
    role: user.role,
  });
}

function signRefreshTokenForSalesRep(salesRep) {
  return signRefreshToken({
    actorType: "SalesRep",
    salesRepId: String(salesRep._id),
    role: "SalesRep",
  });
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,

  // ✅ new helpers
  signAccessTokenForUser,
  signAccessTokenForSalesRep,
  signRefreshTokenForUser,
  signRefreshTokenForSalesRep,
};
