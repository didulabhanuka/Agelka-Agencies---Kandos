// services/inventory/adjustment.service.js
const mongoose = require("mongoose");
const logger = require("../../utils/logger.js");

const StockAdjustment = require("../../models/inventory/StockAdjustment.model");
const Branch = require("../../models/inventorySettings/branch.model");
const Item = require("../../models/inventory/item.model");
const SalesRepStock = require("../../models/inventory/salesRepStock.model");

const {
  postPurchaseLedger,
  postPurchaseReturnLedger,
} = require("../ledger/purchaseLedger.service");
const {
  postSalesLedger,
  postSalesReturnLedger,
} = require("../ledger/salesLedger.service");
const {
  postLedger,
  postStockReturnLedger,
} = require("../ledger/stockLedger.service");

// ✅ UOM math helper – same logic as invoice
const { computeIssueMovement } = require("../../utils/uomMath");

// -------------------- Helpers --------------------
function generateAdjustmentNo() {
  const now = new Date();
  return `ADJ-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
}

function toObjectId(id) {
  if (!id) return null;
  return id instanceof mongoose.Types.ObjectId
    ? id
    : new mongoose.Types.ObjectId(id);
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ✅ scope helper (SalesRep only)
function applyScope(filter = {}, scope = {}) {
  const q = { ...filter };
  if (scope.salesRep) q.salesRep = toObjectId(scope.salesRep);
  return q;
}

// -------------------- CREATE --------------------
async function createAdjustment(payload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      type,
      items,
      adjustmentDate,
      branch,
      salesRep = null,
      createdBy = null,
      createdBySalesRep = null,
      adjustmentNo,
      relatedSupplier = null,
      relatedCustomer = null,
      remarks = "",
    } = payload;

    logger.info("createAdjustment() called", {
      itemsCount: items?.length || 0,
      type,
      branch,
      salesRep,
    });

    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new Error("Invalid branch selected");

    if (!salesRep) {
      throw new Error(
        "salesRep is required for Stock Adjustments (stock is tracked per SalesRep)"
      );
    }

    const processedItems = await Promise.all(
      (items || []).map(async (i) => {
        const primaryQty = toNumber(i.primaryQty);
        const baseQty = toNumber(i.baseQty);

        const itemDoc = await Item.findById(i.item?._id || i.item)
          .select(
            "avgCostBase avgCostPrimary sellingPriceBase sellingPricePrimary factorToBase"
          )
          .lean();

        if (!itemDoc)
          throw new Error(`Item not found: ${i.item?._id || i.item}`);

        const avgCostBase = toNumber(
          i.avgCostBase !== null && i.avgCostBase !== undefined
            ? i.avgCostBase
            : itemDoc.avgCostBase || 0
        );
        const avgCostPrimary = toNumber(
          i.avgCostPrimary !== null && i.avgCostPrimary !== undefined
            ? i.avgCostPrimary
            : itemDoc.avgCostPrimary || 0
        );
        const sellingPriceBase = toNumber(
          i.sellingPriceBase !== null && i.sellingPriceBase !== undefined
            ? i.sellingPriceBase
            : itemDoc.sellingPriceBase || 0
        );
        const sellingPricePrimary = toNumber(
          i.sellingPricePrimary !== null && i.sellingPricePrimary !== undefined
            ? i.sellingPricePrimary
            : itemDoc.sellingPricePrimary || 0
        );

        // ✅ derive factorToBase safely
        let factorToBase = toNumber(i.factorToBase);
        if (factorToBase <= 0) {
          factorToBase = toNumber(itemDoc.factorToBase) || 1;
        }

        const absPrimary = Math.abs(primaryQty);
        const absBase = Math.abs(baseQty);

const costTotal = absBase * avgCostBase + absPrimary * avgCostPrimary;
const sellingTotal =
  absPrimary * sellingPricePrimary + absBase * sellingPriceBase;

// ✅ itemTotalValue depends on adjustment type (matches your UI logic)
const itemTotalValue =
  type === "adj-sale" || type === "adj-sales-return"
    ? sellingTotal
    : costTotal;

// keep this if you still want both values stored
const totalSellingValue = sellingTotal;


        return {
          item: toObjectId(i.item?._id || i.item),
          primaryQty,
          baseQty,
          avgCostPrimary,
          avgCostBase,
          sellingPricePrimary,
          sellingPriceBase,
          factorToBase, // ✅ always > 0
          itemTotalValue,
          totalSellingValue,
          reason: i.reason || null,
        };
      })
    );

    const totalValue = processedItems.reduce(
      (sum, i) => sum + toNumber(i.itemTotalValue),
      0
    );

    const [adj] = await StockAdjustment.create(
      [
        {
          adjustmentNo: adjustmentNo || generateAdjustmentNo(),
          branch: branchDoc._id,
          salesRep: toObjectId(salesRep),
          type,
          adjustmentDate,
          relatedSupplier: relatedSupplier ? toObjectId(relatedSupplier) : null,
          relatedCustomer: relatedCustomer ? toObjectId(relatedCustomer) : null,
          items: processedItems,
          totalValue,
          remarks,
          status: "waiting_for_approval",
          createdBy: createdBy ? toObjectId(createdBy) : null,
          createdBySalesRep: createdBySalesRep
            ? toObjectId(createdBySalesRep)
            : null,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return adj.toObject();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error("createAdjustment failed", err);
    throw err;
  }
}

// -------------------- APPROVE --------------------
async function approveAdjustment(id, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    logger.info("approveAdjustment() called", { id });

    const adj = await StockAdjustment.findById(id)
      .populate("branch")
      .session(session);
    if (!adj) throw new Error("Adjustment not found");

    if (adj.status !== "waiting_for_approval") {
      throw new Error(
        "Only waiting_for_approval adjustments can be approved"
      );
    }

    adj.status = "approved";
    adj.approvedBy = userId;
    adj.approvedAt = new Date();

    const refModel = "StockAdjustment";
    const refId = adj._id;
    const branchId = String(adj.branch._id);
    const salesRepId = adj.salesRep ? String(adj.salesRep) : null;

    if (!salesRepId) {
      throw new Error(
        "Adjustment missing salesRep (required for ledger posting)"
      );
    }

    for (const line of adj.items || []) {
      const qtyPrimary = toNumber(line.primaryQty);
      const qtyBase = toNumber(line.baseQty);

      if (!qtyPrimary && !qtyBase) continue;

      const itemDoc = await Item.findById(line.item?._id || line.item)
        .select(
          "avgCostBase avgCostPrimary sellingPriceBase sellingPricePrimary factorToBase"
        )
        .session(session)
        .lean();

      if (!itemDoc) {
        throw new Error(`Item not found: ${line.item?._id || line.item}`);
      }

      // ---------- resolve costs & prices ----------
      const avgCostBase = toNumber(
        line.avgCostBase !== null && line.avgCostBase !== undefined
          ? line.avgCostBase
          : itemDoc.avgCostBase || 0
      );
      const avgCostPrimary = toNumber(
        line.avgCostPrimary !== null && line.avgCostPrimary !== undefined
          ? line.avgCostPrimary
          : itemDoc.avgCostPrimary || 0
      );
      const sellingPriceBase = toNumber(
        line.sellingPriceBase !== null && line.sellingPriceBase !== undefined
          ? line.sellingPriceBase
          : itemDoc.sellingPriceBase || 0
      );
      const sellingPricePrimary = toNumber(
        line.sellingPricePrimary !== null &&
          line.sellingPricePrimary !== undefined
          ? line.sellingPricePrimary
          : itemDoc.sellingPricePrimary || 0
      );

      // ✅ factor with fallback
      let factorToBase = toNumber(line.factorToBase);
      if (factorToBase <= 0) {
        factorToBase = toNumber(itemDoc.factorToBase) || 1;
      }

      // ---------- valuations for this line ----------
      const absPrimary = Math.abs(qtyPrimary);
      const absBase = Math.abs(qtyBase);

      // Cost side (for purchase-related ledgers)
      const itemTotalValue =
        absBase * avgCostBase + absPrimary * avgCostPrimary;

      // Sales valuation (for sales-related ledgers)
      const totalSellingValue =
        absPrimary * sellingPricePrimary + absBase * sellingPriceBase;

      const isIncrease =
        adj.type === "adj-sales-return" || adj.type === "adj-goods-receive";
      const isDecrease =
        adj.type === "adj-sale" || adj.type === "adj-goods-return";

      // --------------------------
      // ✅ SalesRepStock updates + movement for ledger
      // --------------------------

      let movementPrimaryForLedger = absPrimary;
      let movementBaseForLedger = absBase;

      if (isIncrease) {
        // 👉 For adj-goods-receive / adj-sales-return:
        //    - No conversion, just add primary to primary, base to base
        //    - Value is recomputed from NEW qty

        const salesRepStock = await SalesRepStock.findOne({
          salesRep: adj.salesRep,
          item: line.item,
        })
          .session(session)
          .lean();

        if (!salesRepStock) {
          throw new Error(`SalesRep stock not found for item ${line.item}`);
        }

        const currentPrimary = toNumber(
          salesRepStock.qtyOnHandPrimary || 0
        );
        const currentBase = toNumber(salesRepStock.qtyOnHandBase || 0);

        const newPrimaryQty = currentPrimary + qtyPrimary;
        const newBaseQty = currentBase + qtyBase;

        const newStockValuePrimary = newPrimaryQty * avgCostPrimary;
        const newStockValueBase = newBaseQty * avgCostBase;

        await SalesRepStock.findOneAndUpdate(
          { salesRep: adj.salesRep, item: line.item },
          {
            $set: {
              qtyOnHandPrimary: newPrimaryQty,
              qtyOnHandBase: newBaseQty,
              stockValuePrimary: newStockValuePrimary,
              stockValueBase: newStockValueBase,
              factorToBase, // keep factor on the record
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true, session }
        );

        // movementForLedger = abs typed (already set)
      }

      if (isDecrease) {
        // 👉 For adj-sale / adj-goods-return:
        //    - Use computeIssueMovement (like invoice) for quantity
        //    - Recompute value from NEW qty

        const salesRepStock = await SalesRepStock.findOne({
          salesRep: adj.salesRep,
          item: line.item,
        })
          .session(session)
          .lean();

        if (!salesRepStock) {
          throw Object.assign(
            new Error(`SalesRep stock not found for item ${line.item}`),
            {
              status: 400,
              code: "INSUFFICIENT_STOCK",
            }
          );
        }

        const currentPrimary = toNumber(
          salesRepStock.qtyOnHandPrimary || 0
        );
        const currentBase = toNumber(salesRepStock.qtyOnHandBase || 0);

        const effectiveFactor = toNumber(
          factorToBase ||
            salesRepStock.factorToBase ||
            itemDoc.factorToBase ||
            1
        );

        const {
          movementPrimary,
          movementBase,
          newPrimary,
          newBase,
        } = computeIssueMovement({
          currentPrimary,
          currentBase,
          issuePrimary: absPrimary,
          issueBase: absBase,
          factorToBase: effectiveFactor,
          errorMeta: {
            item: String(line.item),
            salesRep: String(adj.salesRep),
            adjustmentId: String(adj._id),
          },
        });

        movementPrimaryForLedger = movementPrimary;
        movementBaseForLedger = movementBase;

        const newStockValuePrimary = newPrimary * avgCostPrimary;
        const newStockValueBase = newBase * avgCostBase;

        await SalesRepStock.findOneAndUpdate(
          { salesRep: adj.salesRep, item: line.item },
          {
            $set: {
              qtyOnHandPrimary: newPrimary,
              qtyOnHandBase: newBase,
              stockValuePrimary: newStockValuePrimary,
              stockValueBase: newStockValueBase,
              factorToBase: effectiveFactor,
            },
          },
          { new: true, session }
        );
      }

      const reason = line.reason || adj.reason || "Stock adjustment";

      // Cost value for **movement** (not just original typed qty)
      const movementItemTotalValue =
        movementBaseForLedger * avgCostBase +
        movementPrimaryForLedger * avgCostPrimary;

      // --------------------------
      // Ledger postings
      // --------------------------
      switch (adj.type) {
        case "adj-sale": {
          await postLedger({
            item: line.item,
            branch: branchId,
            salesRep: salesRepId,
            transactionType: "adj-sale",
            refModel,
            refId,
            avgCostBase,
            avgCostPrimary,
            sellingPriceBase,
            sellingPricePrimary,
            factorToBase,
            primaryQty: absPrimary,
            baseQty: absBase,
            itemTotalValue: itemTotalValue,
            remarks: reason,
            createdBy: userId,
            allowNegative: false,
            session,
          });

          await postSalesLedger({
            item: line.item,
            branch: branchId,
            salesRep: salesRepId,
            customer: adj.relatedCustomer || null,
            transactionType: "adj-sale",
            refModel,
            refId,
            sellingPriceBase,
            sellingPricePrimary,
            factorToBase,
            primaryQty: absPrimary,
            baseQty: absBase,
            totalSellingValue,
            remarks: reason,
            createdBy: userId,
            session,
          });

          break;
        }

        case "adj-sales-return": {
          await postStockReturnLedger({
            item: line.item,
            branch: branchId,
            salesRep: salesRepId,
            transactionType: "adj-sales-return",
            refModel,
            refId,
            avgCostBase,
            avgCostPrimary,
            sellingPriceBase,
            sellingPricePrimary,
            factorToBase,
            primaryQty: absPrimary,
            baseQty: absBase,
            itemTotalValue: itemTotalValue,
            remarks: reason,
            createdBy: userId,
            session,
          });

          await postSalesReturnLedger({
            item: line.item,
            branch: branchId,
            salesRep: salesRepId,
            customer: adj.relatedCustomer || null,
            transactionType: "adj-sales-return",
            refModel,
            refId,
            sellingPriceBase,
            sellingPricePrimary,
            factorToBase,
            primaryQty: absPrimary,
            baseQty: absBase,
            totalSellingValue,
            remarks: reason,
            createdBy: userId,
            session,
          });

          break;
        }

        case "adj-goods-receive": {
          await postLedger({
            item: line.item,
            branch: branchId,
            salesRep: salesRepId,
            transactionType: "adj-goods-receive",
            refModel,
            refId,
            avgCostBase,
            avgCostPrimary,
            sellingPriceBase,
            sellingPricePrimary,
            factorToBase,
            primaryQty: absPrimary,
            baseQty: absBase,
            itemTotalValue: itemTotalValue,
            remarks: reason,
            createdBy: userId,
            allowNegative: false,
            session,
          });

          await postPurchaseLedger({
            item: line.item,
            branch: branchId,
            supplier: adj.relatedSupplier || null,
            salesRep: salesRepId,
            transactionType: "adj-goods-receive",
            refModel,
            refId,
            avgCostBase,
            avgCostPrimary,
            factorToBase,
            primaryQty: absPrimary,
            baseQty: absBase,
            totalCostValue: itemTotalValue,
            remarks: reason,
            createdBy: userId,
            session,
          });

          break;
        }

        case "adj-goods-return": {
          await postStockReturnLedger({
            item: line.item,
            branch: branchId,
            salesRep: salesRepId,
            transactionType: "adj-goods-return",
            refModel,
            refId,
            avgCostBase,
            avgCostPrimary,
            sellingPriceBase,
            sellingPricePrimary,
            factorToBase,
            primaryQty: absPrimary,
            baseQty: absBase,
            itemTotalValue: itemTotalValue,
            remarks: reason,
            createdBy: userId,
            session,
          });

          await postPurchaseReturnLedger({
            item: line.item,
            branch: branchId,
            supplier: adj.relatedSupplier || null,
            salesRep: salesRepId,
            transactionType: "adj-goods-return",
            refModel,
            refId,
            avgCostBase,
            avgCostPrimary,
            factorToBase,
            primaryQty: absPrimary,
            baseQty: absBase,
            totalCostValue: itemTotalValue,
            remarks: reason,
            createdBy: userId,
            session,
          });

          break;
        }

        default:
          throw new Error(`Unsupported adjustment type: ${adj.type}`);
      }
    }

    await adj.save({ session });
    await session.commitTransaction();
    session.endSession();

    return adj.toObject();
  } catch (err) {
    logger.error("approveAdjustment() failed", err);
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// -------------------- LIST --------------------
async function listAdjustments(filter = {}, scope = {}) {
  const cleanFilter = Object.fromEntries(
    Object.entries(filter).filter(
      ([_, v]) => v !== undefined && v !== null && v !== ""
    )
  );
  const q = applyScope(cleanFilter, scope);

  return StockAdjustment.find(q)
    .sort({ adjustmentDate: -1 })
    .populate("approvedBy", "username")
    .populate("branch", "name branchCode")
    .populate("salesRep", "repCode name")
    .lean();
}

// -------------------- GET --------------------
async function getAdjustment(id, scope = {}) {
  const q = applyScope({ _id: id }, scope);

  return StockAdjustment.findOne(q)
    .populate("approvedBy", "username")
    .populate("branch", "name branchCode")
    .populate("salesRep", "repCode name")
    .populate("items.item", "itemCode name brand baseUnit")
    .lean();
}

// -------------------- DELETE --------------------
async function deleteAdjustment(id, scope = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const q = applyScope({ _id: id }, scope);

    const adj = await StockAdjustment.findOne(q).session(session);
    if (!adj) throw new Error("Stock Adjustment not found");

    if (adj.status !== "waiting_for_approval") {
      throw new Error(
        "Only adjustments in 'waiting_for_approval' can be deleted"
      );
    }

    await StockAdjustment.deleteOne({ _id: adj._id }).session(session);

    await session.commitTransaction();
    session.endSession();

    return { success: true, deletedId: id, adjustmentNo: adj.adjustmentNo };
  } catch (err) {
    logger.error("deleteAdjustment() failed", err);
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// -------------------- UPDATE --------------------
async function updateAdjustment(id, payload, scope = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const q = applyScope({ _id: id }, scope);

    const adj = await StockAdjustment.findOne(q).session(session);
    if (!adj) throw new Error("Stock Adjustment not found");

    if (adj.status !== "waiting_for_approval") {
      throw new Error(
        "Only adjustments in 'waiting_for_approval' can be updated"
      );
    }

    const {
      branch,
      adjustmentDate,
      remarks,
      items: rawItems,
      type: incomingType,
      salesRep,
    } = payload;

    if (branch) {
      const branchDoc = await Branch.findById(branch).lean();
      if (!branchDoc) throw new Error("Invalid branch selected");
      adj.branch = branchDoc._id;
    }

    if (salesRep) adj.salesRep = toObjectId(salesRep);

    const newType = incomingType || adj.type;
    adj.type = newType;

    const items = [];
    for (const line of rawItems || []) {
      const itemId = toObjectId(line.item?._id || line.item);

      const primaryQty = toNumber(line.primaryQty);
      const baseQty = toNumber(line.baseQty);

      if (!Number.isFinite(primaryQty) || !Number.isFinite(baseQty)) {
        throw new Error(`Invalid qty for item ${itemId}`);
      }
      if (!primaryQty && !baseQty) {
        throw new Error(
          `Both primaryQty and baseQty cannot be 0 for item ${itemId}`
        );
      }

      const avgCostPrimary = toNumber(line.avgCostPrimary);
      const avgCostBase = toNumber(line.avgCostBase);

      const sellingPricePrimary = toNumber(line.sellingPricePrimary);
      const sellingPriceBase = toNumber(line.sellingPriceBase);

      const factorToBase = toNumber(line.factorToBase);

      const absPrimary = Math.abs(primaryQty);
      const absBase = Math.abs(baseQty);

      // Cost valuation
      const itemTotalValue =
        absBase * avgCostBase + absPrimary * avgCostPrimary;

      // Sales valuation (for adj-sale / adj-sales-return usage)
      const totalSellingValue =
        absPrimary * sellingPricePrimary + absBase * sellingPriceBase;

      items.push({
        item: itemId,
        primaryQty,
        baseQty,
        avgCostPrimary,
        avgCostBase,
        sellingPricePrimary,
        sellingPriceBase,
        factorToBase,
        itemTotalValue,
        totalSellingValue,
        reason: line.reason || null,
      });
    }

    adj.adjustmentDate = adjustmentDate || adj.adjustmentDate;
    adj.remarks = remarks ?? adj.remarks;
    adj.items = items;
    adj.totalValue = items.reduce(
      (sum, i) => sum + toNumber(i.itemTotalValue),
      0
    );

    await adj.save({ session });

    await session.commitTransaction();
    session.endSession();

    return adj.toObject();
  } catch (err) {
    logger.error("updateAdjustment() failed", err);
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

module.exports = {
  createAdjustment,
  approveAdjustment,
  listAdjustments,
  getAdjustment,
  deleteAdjustment,
  updateAdjustment,
};
