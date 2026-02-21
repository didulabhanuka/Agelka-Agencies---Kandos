import api from "./axios";

// -------------------- BUSINESS SNAPSHOT --------------------
export const getBusinessSnapshot = async (params = {}) => 
  (await api.get("/ledger/business-ledger/snapshot", { params })).data;


// -------------------- SALES SNAPSHOT --------------------
export const getSalesSnapshot = async (params = {}) => 
  (await api.get("/ledger/sales-ledger/snapshot", { params })).data;


// -------------------- PURCHASE SNAPSHOT --------------------
export const getPurchaseSnapshot = async (params = {}) => 
  (await api.get("/ledger/purchase-ledger/snapshot", { params })).data;


// -------------------- STOCK SNAPSHOT --------------------
export const getStockSnapshot = async (params = {}) => 
  (await api.get("/ledger/stock-ledger/snapshot", { params })).data;