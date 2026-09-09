import client from './client';

export const listPosts = (params) => client.get('/media/posts', { params }).then((response) => response.data);
export const createPost = (payload) => client.post('/media/posts', payload).then((response) => response.data);
export const updatePost = (id, payload) => client.put(`/media/posts/${id}`, payload).then((response) => response.data);
export const deletePost = (id) => client.delete(`/media/posts/${id}`).then((response) => response.data);
export const submitForReview = (id) => client.post(`/media/posts/${id}/submit`).then((response) => response.data);
export const approvePost = (id, payload) => client.post(`/media/posts/${id}/approve`, payload).then((response) => response.data);
export const rejectPost = (id, payload) => client.post(`/media/posts/${id}/reject`, payload).then((response) => response.data);
export const publishPost = (id) => client.post(`/media/posts/${id}/publish`).then((response) => response.data);
export const uploadMediaFiles = (files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return client.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((response) => response.data);
};

export const listBlog = (params) => client.get('/media/blog', { params }).then((response) => response.data);
export const createBlogPost = (payload) => client.post('/media/blog', payload).then((response) => response.data);
export const updateBlogPost = (id, payload) => client.put(`/media/blog/${id}`, payload).then((response) => response.data);
export const deleteBlogPost = (id) => client.delete(`/media/blog/${id}`).then((response) => response.data);

export const listSocialAccounts = () => client.get('/social-accounts').then((response) => response.data);
export const saveSocialAccount = (platform, data) => client.put(`/social-accounts/${platform}`, data).then((response) => response.data);
export const disconnectSocialAccount = (platform) => client.delete(`/social-accounts/${platform}`).then((response) => response.data);
export const testSocialAccount = (platform) => client.post(`/social-accounts/${platform}/test`).then((response) => response.data);

export const syncImpressions = () => client.post('/media/sync-impressions').then((response) => response.data);
