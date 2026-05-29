import client from './client';

export const getMyReview  = (bookingId)     => client.get(`/api/customer/reviews/booking/${bookingId}`);
export const createReview = (body)          => client.post('/api/customer/reviews', body);
export const updateReview = (id, body)      => client.put(`/api/customer/reviews/${id}`, body);
export const deleteReview = (id)            => client.delete(`/api/customer/reviews/${id}`);
