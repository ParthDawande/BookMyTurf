import client from './client';

export const createComplaint = (body)       => client.post('/api/customer/complaints', body);
export const listComplaints  = (params)     => client.get('/api/customer/complaints', { params });
export const getComplaint    = (id)         => client.get(`/api/customer/complaints/${id}`);
