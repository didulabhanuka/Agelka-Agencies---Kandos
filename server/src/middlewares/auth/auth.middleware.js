const { ApiError } = require("../error");
const { verifyAccessToken } = require("../../utils/jwtUtils");
const User = require("../../models/user/user.model");
const SalesRep = require("../../models/user/salesRep.model");

async function verifyJWT(req, _res, next) {
  const header = req.headers.authorization || "";
  const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : null;

  // optional cookie fallback
  const cookieToken = req.cookies?.accessToken || null;

  const token = bearerToken || cookieToken;
  if (!token) return next(new ApiError(401, "Unauthorized"));

  try {
    const decoded = verifyAccessToken(token);
    if (!decoded?.actorType) return next(new ApiError(401, "Invalid token payload"));
    req.user = decoded;
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

function requireRole(...roleNames) {
  return async (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Unauthorized"));

    try {
      if (req.user.actorType === "User") {
        const user = await User.findById(req.user.userId).lean();
        if (!user || !user.active) return next(new ApiError(403, "Account disabled"));
        if (!roleNames.includes(user.role)) return next(new ApiError(403, "Forbidden"));

        req.authUser = user;
        req.authActor = { actorType: "User", id: user._id, role: user.role };
        return next();
      }

      if (req.user.actorType === "SalesRep") {
        const rep = await SalesRep.findById(req.user.salesRepId).lean();
        if (!rep) return next(new ApiError(403, "Account disabled"));
        if (rep.status && rep.status !== "active") return next(new ApiError(403, "Account disabled"));

        if (!roleNames.includes("SalesRep")) return next(new ApiError(403, "Forbidden"));

        req.authSalesRep = rep;
        req.authActor = { actorType: "SalesRep", id: rep._id, role: "SalesRep" };
        return next();
      }

      return next(new ApiError(401, "Invalid token payload"));
    } catch (e) {
      next(e);
    }
  };
}

function scopeBySalesRep(fieldName = "salesRep") {
  return (req, _res, next) => {
    if (req.authActor?.actorType === "User") {
      req.scopeFilter = {};
      return next();
    }
    if (req.authActor?.actorType === "SalesRep") {
      req.scopeFilter = { [fieldName]: req.authActor.id };
      return next();
    }
    req.scopeFilter = { _id: null };
    next();
  };
}

// optional helper (nice to have)
function requireAuth(req, res, next) {
  return verifyJWT(req, res, next);
}

module.exports = { verifyJWT, requireRole, scopeBySalesRep, requireAuth };
