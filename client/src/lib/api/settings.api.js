import api from './axios';

// ----- BRANDS -----
export const getBrands = async (params) => (await api.get('/inventorySettings/brands', { params })).data;
export const createBrand = async (payload) => (await api.post('/inventorySettings/brands', payload)).data;
export const updateBrand = async (id, payload) => (await api.put(`/inventorySettings/brands/${id}`, payload)).data;
export const deleteBrand = async (id) => (await api.delete(`/inventorySettings/brands/${id}`)).data;

// ----- PRODUCT GROUPS -----
export const getProductGroups = async (params) => (await api.get('/inventorySettings/groups', { params })).data;
export const createProductGroup = async (payload) => (await api.post('/inventorySettings/groups', payload)).data;
export const updateProductGroup = async (id, payload) => (await api.put(`/inventorySettings/groups/${id}`, payload)).data;
export const deleteProductGroup = async (id) => (await api.delete(`/inventorySettings/groups/${id}`)).data;

// ----- BRANCHES -----
export const createBranch = async (payload) => (await api.post('/inventorySettings/branches', payload)).data;
export const getBranch = async (id) => (await api.get(`/inventorySettings/branches/${id}`)).data;
export const updateBranch = async (id, payload) => (await api.put(`/inventorySettings/branches/${id}`, payload)).data;
export const deleteBranch = async (id) => (await api.delete(`/inventorySettings/branches/${id}`)).data;
export const listBranches = async (params) => (await api.get('/inventorySettings/branches', { params })).data;

// ----- CLEANER -----
export const deleteSalesInvoicesAndReturns = async (payload) => (await api.delete('/settings/cleaner/salesInvoicesAndReturns', { data: payload })).data;
export const deleteStockAdjustments = async (payload) => (await api.delete('/settings/cleaner/stockAdjustments', { data: payload })).data;
export const deleteSalesRepStock = async (payload) => (await api.delete('/settings/cleaner/salesRepStock', { data: payload })).data;
export const deleteGRNs = async (payload) => (await api.delete('/settings/cleaner/grns', { data: payload })).data;
export const deleteLedgers = async (payload) => (await api.delete('/settings/cleaner/ledgers', { data: payload })).data;