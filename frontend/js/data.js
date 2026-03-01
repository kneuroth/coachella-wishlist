// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const SYMBOL = { must_see: '★', would_like_to_see: '◆', would_skip: '—' };
const LABEL  = { must_see: 'Must See', would_like_to_see: 'Would Like', would_skip: 'Skip' };


// ── DATA ──────────────────────────────────────────────────────────────────────

async function fetchAll() {
  const wishlists = await fetchWishlists();
  const userIds   = Object.keys(wishlists);
  const profiles  = await Promise.all(userIds.map(id => fetchUser(id)));

  const users = {};
  profiles.forEach(u => { if (u?.userId) users[u.userId] = u.name; });

  const artistSet = new Set();
  Object.values(wishlists).forEach(entries =>
    entries.forEach(e => artistSet.add(e.artistId))
  );

  state.wishlists = wishlists;
  state.users     = users;
  state.artists   = Array.from(artistSet).sort();
}


// ── RANKINGS ──────────────────────────────────────────────────────────────────

function getRanking(userId, artistId) {
  return (state.wishlists[userId] || []).find(e => e.artistId === artistId)?.ranking ?? null;
}

async function setRanking(artistId, ranking) {
  if (!currentUser) return;
  const { userId } = currentUser;

  // Optimistic update — re-render immediately, sync in background
  if (!state.wishlists[userId]) state.wishlists[userId] = [];

  if (ranking === null) {
    state.wishlists[userId] = state.wishlists[userId].filter(e => e.artistId !== artistId);
  } else {
    const entry = { userId, artistId, ranking, updatedAt: new Date().toISOString() };
    const idx   = state.wishlists[userId].findIndex(e => e.artistId === artistId);
    if (idx >= 0) state.wishlists[userId][idx] = entry;
    else          state.wishlists[userId].push(entry);
  }

  renderCards();

  try {
    if (ranking === null) await deleteRanking(userId, artistId);
    else                  await putRanking(userId, artistId, ranking);
  } catch (err) {
    console.error('Failed to save ranking:', err);
  }
}


// ── HEAT ──────────────────────────────────────────────────────────────────────

function heatScore(artistId) {
  return Object.values(state.wishlists)
    .flat()
    .filter(e => e.artistId === artistId && e.ranking === 'must_see')
    .length;
}

function likeScore(artistId) {
  return Object.values(state.wishlists)
    .flat()
    .filter(e => e.artistId === artistId && e.ranking === 'would_like_to_see')
    .length;
}
