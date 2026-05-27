import client from './client';

export const loginApi = (email, password) =>
  client.post('/api/auth/login', { email, password });

// Customer registration. Required fields: name, email, phone, password, city.
// Optional: preferred_sports (list of strings). Snake_case to match wire format.
export const registerCustomerApi = (payload) =>
  client.post('/api/auth/register/customer', payload);
