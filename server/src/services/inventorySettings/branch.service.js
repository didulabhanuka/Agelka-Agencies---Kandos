// services/inventory/branch.service.js
const logger = require("../../utils/logger.js");
const Branch = require("../../models/inventorySettings/branch.model.js");
const { ApiError } = require("../../middlewares/error");


// ---------- CREATE Branch ----------
async function createBranch(payload, userId) {
  try {
    logger.info("createBranch() called", { payload, userId });

    payload.branchCode = payload.branchCode.toUpperCase();
    payload.createdBy = userId;

    // Check for duplicate branch code
    const exists = await Branch.findOne({ branchCode: payload.branchCode }).lean();
    if (exists) {
      logger.warn("Branch code already exists", { branchCode: payload.branchCode });
      throw new ApiError(400, "Branch code already exists.", "BRANCH_DUPLICATE");
    }

    // Create branch
    const branch = await Branch.create(payload);

    logger.info("Branch created successfully", {
      id: branch._id,
      branchCode: branch.branchCode,
    });

    return branch.toObject();

  } catch (err) {
    // Duplicate key error
    if (err.code === 11000) {
      logger.warn("Duplicate branch code detected during creation", {
        branchCode: payload.branchCode,
      });
      throw new ApiError(400, "Duplicate branch code detected.", "BRANCH_DUPLICATE");
    }

    logger.error("Failed to create branch", err);
    throw new ApiError(500, "Failed to create branch.", "BRANCH_CREATE_FAIL");
  }
}


// ---------- LIST Branch ----------
async function listBranches(filter = {}) {
  logger.info("listBranches() called", { filter });

  const query = {};

  if (filter.status) {
    query.status = filter.status;
    logger.debug("Applying status filter", { status: filter.status });
  }

  return Branch.find(query)
    .sort({ name: 1 })
    .lean();
}


// ---------- GET SINGLE Branch ----------
async function getBranch(id) {
  logger.info("getBranch() called", { id });

  const branch = await Branch.findById(id).lean();

  if (!branch) {
    logger.warn("Branch not found", { id });
    throw new ApiError(404, "Branch not found.", "BRANCH_NOT_FOUND");
  }

  logger.info("Branch fetched successfully", { id: branch._id });

  return branch;
}


// ---------- UPDATE Branch ----------
async function updateBranch(id, payload, userId) {
  try {
    logger.info("updateBranch() called", { id, payload, userId });

    // -------------------- HANDLE BRANCH CODE --------------------
    if (payload.branchCode) {
      payload.branchCode = payload.branchCode.toUpperCase();

      const exists = await Branch.findOne({
        branchCode: payload.branchCode,
        _id: { $ne: id },
      }).lean();

      if (exists) {
        logger.warn("Branch code already exists", { branchCode: payload.branchCode });
        throw new ApiError(400, "Branch code already exists.", "BRANCH_DUPLICATE");
      }
    }

    payload.updatedBy = userId;

    // -------------------- GET CURRENT BRANCH --------------------
    const current = await Branch.findById(id);
    if (!current) {
      logger.warn("Branch not found", { id });
      throw new ApiError(404, "Branch not found.", "BRANCH_NOT_FOUND");
    }

    payload.version = (current.version || 1) + 1;

    // -------------------- UPDATE BRANCH --------------------
    const updated = await Branch.findByIdAndUpdate(id, payload, { new: true });

    logger.info("Branch updated successfully", { id: updated._id, branchCode: updated.branchCode });

    return updated.toObject();

  } catch (err) {
    logger.error("updateBranch() failed", err);
    throw err;
  }
}


// ---------- DELETE Branch ----------
async function deleteBranch(id) {
  try {
    logger.info("deleteBranch() called", { id });

    const branch = await Branch.findById(id);
    if (!branch) {
      logger.warn("Branch not found", { id });
      throw new ApiError(404, "Branch not found.", "BRANCH_NOT_FOUND");
    }

    await Branch.findByIdAndDelete(id);

    logger.info("Branch deleted successfully", { id: branch._id, branchCode: branch.branchCode });

    return branch.toObject();
  } catch (err) {
    logger.error("deleteBranch() failed", err);
    throw err;
  }
}


module.exports = {
  createBranch,
  listBranches,
  getBranch,
  updateBranch,
  deleteBranch,
};
