import api from './axios';


export const sendInquiry = async (payload) => {
const { data } = await api.post('/inquiry', payload);
return data;
};