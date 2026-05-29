import client from './client';

export const getPublicTurfs = (params) => client.get('/api/public/turfs', { params });
export const getPublicCities = () => client.get('/api/public/cities');
export const getCustomerTurfDetail = (id) => client.get(`/api/customer/turfs/${id}`);
export const getCustomerAvailability = (id, date) =>
  client.get(`/api/customer/turfs/${id}/availability`, { params: { date } });
