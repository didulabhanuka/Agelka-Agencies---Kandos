import api from './axios';

// ----- PURCHASE ORDERS -----
export const createPurchaseOrder = async (payload) => (await api.post('/purchase/purchase-orders', payload)).data;
export const getPurchaseOrder = async (id) => (await api.get(`/purchase/purchase-orders/${id}`)).data;
export const updatePurchaseOrder = async (id, payload) => (await api.put(`/purchase/purchase-orders/${id}`, payload)).data;
export const cancelPurchaseOrder = async (id) => (await api.post(`/purchase/purchase-orders/${id}/cancel`)).data;
export const deletePurchaseOrder = async (id) => (await api.delete(`/purchase/purchase-orders/${id}`)).data;
export const listPurchaseOrders = async (params) => (await api.get('/purchase/purchase-orders', { params })).data;

// ----- GRN -----
export const createGRN = async (payload) => (await api.post('/purchase/grn', payload)).data;
export const approveGRN = async (id) => (await api.post(`/purchase/grn/${id}/approve`)).data;
export const getGRN = async (id) => (await api.get(`/purchase/grn/${id}`)).data;
export const updateGRN = async (id, payload) => (await api.put(`/purchase/grn/${id}`, payload)).data;
export const deleteGRN = async (id) => (await api.delete(`/purchase/grn/${id}`)).data;
export const listGRN = async (params) => (await api.get('/purchase/grn', { params })).data;

export const getGRNSummary = async () => (await api.get('/purchase/grn/summary')).data;
