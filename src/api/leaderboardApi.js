import client from './client';

export const getLeaderboard = (params) => client.get('/leaderboard', { params }).then((r) => r.data);
export const listLeaderboardStats = (params) => client.get('/leaderboard/stats', { params }).then((r) => r.data);
export const saveLeaderboardStat = (payload) => client.post('/leaderboard/stats', payload).then((r) => r.data);
