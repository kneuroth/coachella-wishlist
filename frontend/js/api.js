const API_BASE = 'https://7bokc88wgb.execute-api.us-east-1.amazonaws.com';

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  if (res.status === 204) return null;
  return res.json();
}

async function fetchWishlists() {
  return api('GET', '/wishlists');
}

async function fetchUser(userId) {
  return api('GET', `/users/${userId}`);
}

async function createUser(name) {
  return api('POST', '/users', { name });
}

async function putRanking(userId, artistId, ranking) {
  return api('PUT', `/wishlists/${userId}/${artistId}`, { ranking });
}

async function deleteRanking(userId, artistId) {
  return api('DELETE', `/wishlists/${userId}/${artistId}`);
}
