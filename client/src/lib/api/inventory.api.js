import api from './axios';

// ----- ADJUSTMENTS -----
export const createAdjustment = async (payload) => (await api.post('/inventory/adjustments', payload)).data;
export const getAdjustment = async (id) => (await api.get(`/inventory/adjustments/${id}`)).data;
export const updateAdjustment = async (id, payload) => (await api.patch(`/inventory/adjustments/${id}`, payload)).data;
export const approveAdjustment = async (id) => (await api.patch(`/inventory/adjustments/${id}/approve`)).data;
export const deleteAdjustment = async (id) => (await api.delete(`/inventory/adjustments/${id}`)).data;
export const listAdjustments = async (params) => (await api.get('/inventory/adjustments', { params })).data;

// ----- ITEMS -----
export const getItems = async (params) => (await api.get('/inventory/items', { params })).data;
export const createItem = async (payload) => (await api.post('/inventory/items', payload)).data;
export const updateItem = async (id, payload) => (await api.put(`/inventory/items/${id}`, payload)).data;
export const deleteItem = async (id) => (await api.delete(`/inventory/items/${id}`)).data;
export const getItemsBySupplier = async (supplierId) => (await api.get(`/inventory/items/supplier/${supplierId}`)).data;

// STOCK LEDGER
export const getStockLedger = (params = {}) => api.get("/ledger/stock-ledger", { params });
