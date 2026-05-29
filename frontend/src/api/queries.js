import client from './client';

export const createQuery = (body)   => client.post('/api/customer/queries', body);
export const listQueries = (params) => client.get('/api/customer/queries', { params });
export const getQuery    = (id)     => client.get(`/api/customer/queries/${id}`);
