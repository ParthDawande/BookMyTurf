import client from './client';

export const listTurfs      = (params)       => client.get('/api/owner/turfs', { params });
export const createTurf     = (body)         => client.post('/api/owner/turfs', body);
export const getTurf        = (id)           => client.get(`/api/owner/turfs/${id}`);
export const updateTurf     = (id, body)     => client.put(`/api/owner/turfs/${id}`, body);
export const deleteTurf     = (id)           => client.delete(`/api/owner/turfs/${id}`);

export const listPhotos     = (turfId)       => client.get(`/api/owner/turfs/${turfId}/photos`);
export const addPhoto       = (turfId, body) => client.post(`/api/owner/turfs/${turfId}/photos`, body);
export const deletePhoto    = (turfId, photoId) => client.delete(`/api/owner/turfs/${turfId}/photos/${photoId}`);

export const createSubCourt = (turfId, body) => client.post(`/api/owner/turfs/${turfId}/sub-courts`, body);
export const updateSubCourt = (scId, body)   => client.put(`/api/owner/sub-courts/${scId}`, body);
export const deleteSubCourt = (scId)         => client.delete(`/api/owner/sub-courts/${scId}`);

// Payouts
export const listPayouts = (params) => client.get('/api/owner/payouts', { params });

// Reviews + replies
export const listOwnerReviews = (params)  => client.get('/api/owner/reviews', { params });
export const postReply        = (id, body) => client.post(`/api/owner/reviews/${id}/reply`, body);
export const putReply         = (id, body) => client.put(`/api/owner/reviews/${id}/reply`, body);
export const deleteReply      = (id)       => client.delete(`/api/owner/reviews/${id}/reply`);

// Profile (bank details)
export const getProfile    = ()     => client.get('/api/owner/profile');
export const updateProfile = (body) => client.put('/api/owner/profile', body);
