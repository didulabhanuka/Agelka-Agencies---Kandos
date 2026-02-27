import api from "./axios";

// ADJUSTMENTS
export const createAdjustment=(p)=>api.post("/inventory/adjustments",p).then(r=>r.data);
export const getAdjustment=(id)=>api.get(`/inventory/adjustments/${id}`).then(r=>r.data);
export const updateAdjustment=(id,p)=>api.patch(`/inventory/adjustments/${id}`,p).then(r=>r.data);
export const approveAdjustment=(id)=>api.patch(`/inventory/adjustments/${id}/approve`).then(r=>r.data);
export const deleteAdjustment=(id)=>api.delete(`/inventory/adjustments/${id}`).then(r=>r.data);
export const listAdjustments=(params)=>api.get("/inventory/adjustments",{ params }).then(r=>r.data);

// ITEMS
export const getItems=(params)=>api.get("/inventory/items",{ params }).then(r=>r.data);
export const createItem=(p)=>api.post("/inventory/items",p).then(r=>r.data);
export const updateItem=(id,p)=>api.put(`/inventory/items/${id}`,p).then(r=>r.data);
export const deleteItem=(id)=>api.delete(`/inventory/items/${id}`).then(r=>r.data);
export const getItemsBySupplier=(supplierId)=>api.get(`/inventory/items/supplier/${supplierId}`).then(r=>r.data);
export const listSalesRepStockDetails=(params)=>api.get("/inventory/items/sales-rep-stock",{ params }).then(r=>r.data);

// STOCK LEDGER
export const getStockLedger=(params={})=>api.get("/ledger/stock-ledger",{ params });

