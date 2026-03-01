// ── STATE ─────────────────────────────────────────────────────────────────────

let currentUser = null; // { userId, name }

const state = {
  wishlists: {}, // userId → [{ artistId, ranking, updatedAt }]
  users:     {}, // userId → name
  artists:   [], // all known artistIds (sorted)
  query:     '',
};

let activeArtistId = null; // currently open in bottom sheet


// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────

function loadCurrentUser() {
  try { return JSON.parse(localStorage.getItem('cwl_user')); }
  catch { return null; }
}

function saveCurrentUser(u) {
  localStorage.setItem('cwl_user', JSON.stringify(u));
}


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

const SYMBOL = { must_see: '★', would_like_to_see: '◆', would_skip: '—' };
const LABEL  = { must_see: 'Must See', would_like_to_see: 'Would Like', would_skip: 'Skip' };

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


// ── FORMAT ────────────────────────────────────────────────────────────────────

function fmt(id) {
  return id
    .replace(/-\d{4}$/, '')
    .split('-')
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : w)
    .join(' ');
}


// ── RENDER CARDS ──────────────────────────────────────────────────────────────

function renderCards() {
  // Always include current user even if they have no ratings yet
  if (currentUser && !state.users[currentUser.userId]) {
    state.users[currentUser.userId] = currentUser.name;
  }

  const grid    = document.getElementById('artist-grid');
  const emptyEl = document.getElementById('empty-state');

  // Filter by search query
  const query    = state.query.toLowerCase().trim();
  const filtered = state.artists.filter(id =>
    !query || fmt(id).toLowerCase().includes(query)
  );

  // Sort: most must_see first, then most would_like_to_see, then alphabetically
  const sorted = [...filtered].sort((a, b) =>
    heatScore(b) - heatScore(a) || likeScore(b) - likeScore(a) || a.localeCompare(b)
  );

  if (sorted.length === 0) {
    grid.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const userIds  = Object.keys(state.users);
  const myUserId = currentUser?.userId;

  grid.innerHTML = '';

  sorted.forEach((artistId, i) => {
    const card = document.createElement('div');
    card.className = 'artist-card';
    card.dataset.artistId = artistId;
    card.style.animationDelay = `${Math.min(i, 24) * 28}ms`;

    // My ranking badge (top-right)
    const myRanking = myUserId ? getRanking(myUserId, artistId) : null;
    if (myRanking) {
      const badge = document.createElement('div');
      badge.className = `my-badge rank-${myRanking}`;
      badge.textContent = SYMBOL[myRanking];
      badge.title = `Your rating: ${LABEL[myRanking]}`;
      card.appendChild(badge);
    }

    // Artist name
    const nameEl = document.createElement('div');
    nameEl.className = 'card-name';
    nameEl.textContent = fmt(artistId);
    card.appendChild(nameEl);

    // Friend bubbles (one per user)
    if (userIds.length > 0) {
      const friendsRow = document.createElement('div');
      friendsRow.className = 'card-friends';

      userIds.forEach(uid => {
        const ranking = getRanking(uid, artistId);
        const name    = state.users[uid] || '?';
        const bubble  = document.createElement('div');
        bubble.className = `friend-bubble rank-${ranking || 'none'}`;
        bubble.textContent = name[0].toUpperCase();
        bubble.title = `${name}: ${ranking ? LABEL[ranking] : 'Not rated'}`;
        friendsRow.appendChild(bubble);
      });

      card.appendChild(friendsRow);
    }

    card.addEventListener('click', () => openSheet(artistId));
    grid.appendChild(card);
  });
}


// ── SEARCH / AUTOCOMPLETE ─────────────────────────────────────────────────────

function setupSearch() {
  const input    = document.getElementById('search-input');
  const dropdown = document.getElementById('autocomplete-dropdown');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    state.query = q;
    renderCards();

    if (!q) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }

    const matches = state.artists
      .filter(id => fmt(id).toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }

    dropdown.innerHTML = '';
    matches.forEach(artistId => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = fmt(artistId);
      item.addEventListener('mousedown', () => {
        input.value = fmt(artistId);
        state.query = '';
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        renderCards();
        // Scroll matching card into view
        const card = document.querySelector(`[data-artist-id="${artistId}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      dropdown.appendChild(item);
    });

    dropdown.classList.remove('hidden');
  });

  input.addEventListener('blur', () => {
    // Delay so mousedown on item fires first
    setTimeout(() => dropdown.classList.add('hidden'), 150);
  });
}


// ── BOTTOM SHEET ─────────────────────────────────────────────────────────────

function openSheet(artistId) {
  activeArtistId = artistId;

  const sheet     = document.getElementById('rank-sheet');
  const backdrop  = document.getElementById('sheet-backdrop');
  const title     = document.getElementById('sheet-artist-name');
  const removeBtn = document.getElementById('sheet-remove');

  title.textContent = fmt(artistId);

  const myRanking = currentUser ? getRanking(currentUser.userId, artistId) : null;

  // Highlight the active ranking button
  document.querySelectorAll('.sheet-btn').forEach(btn => {
    btn.classList.toggle('active-rank', btn.dataset.ranking === myRanking);
  });

  // Show "Remove" only when already ranked
  removeBtn.classList.toggle('hidden', !myRanking);

  backdrop.classList.remove('hidden');
  sheet.classList.remove('hidden');
  // Force reflow so the CSS transition fires
  sheet.getBoundingClientRect();
  sheet.classList.add('open');
}

function closeSheet() {
  const sheet    = document.getElementById('rank-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  sheet.classList.remove('open');
  setTimeout(() => {
    sheet.classList.add('hidden');
    backdrop.classList.add('hidden');
  }, 300);
  activeArtistId = null;
}

function setupSheet() {
  const backdrop  = document.getElementById('sheet-backdrop');
  const removeBtn = document.getElementById('sheet-remove');

  backdrop.addEventListener('click', closeSheet);

  document.querySelectorAll('.sheet-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!activeArtistId) return;
      await setRanking(activeArtistId, btn.dataset.ranking);
      closeSheet();
    });
  });

  removeBtn.addEventListener('click', async () => {
    if (!activeArtistId) return;
    await setRanking(activeArtistId, null);
    closeSheet();
  });
}


// ── SETUP ─────────────────────────────────────────────────────────────────────

async function setupUser(name) {
  const user = await createUser(name);
  saveCurrentUser(user);
  currentUser = user;
  state.users[user.userId]     = user.name;
  state.wishlists[user.userId] = state.wishlists[user.userId] || [];
}


// ── INIT ──────────────────────────────────────────────────────────────────────

async function loadAndRender() {
  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');

  try {
    await fetchAll();

    // Merge current user so their bubble always appears
    if (currentUser) {
      state.users[currentUser.userId]     = state.users[currentUser.userId] || currentUser.name;
      state.wishlists[currentUser.userId] = state.wishlists[currentUser.userId] || [];
    }

    document.getElementById('user-label').textContent =
      currentUser ? `hi, ${currentUser.name}` : '';

    loading.classList.add('hidden');
    document.getElementById('grid-container').classList.remove('hidden');
    renderCards();
  } catch (err) {
    console.error(err);
    loading.classList.add('hidden');
    const banner = document.getElementById('error-banner');
    const detail = document.getElementById('error-detail');
    const isCors = err instanceof TypeError && err.message.toLowerCase().includes('fetch');
    detail.textContent = isCors
      ? 'CORS or network error — is the API running? Check API_BASE in js/api.js.'
      : err.message;
    banner.classList.remove('hidden');
  }
}

async function init() {
  currentUser = loadCurrentUser();

  setupSheet();
  setupSearch();

  const modal   = document.getElementById('setup-modal');
  const nameIn  = document.getElementById('setup-name');
  const joinBtn = document.getElementById('setup-btn');

  if (!currentUser) {
    modal.classList.remove('hidden');

    const join = async () => {
      const name = nameIn.value.trim();
      if (!name) return;
      joinBtn.textContent = '…';
      joinBtn.disabled    = true;
      try {
        await setupUser(name);
        modal.classList.add('hidden');
        await loadAndRender();
      } catch (err) {
        console.error(err);
        joinBtn.textContent = 'Join the group';
        joinBtn.disabled    = false;
      }
    };

    joinBtn.addEventListener('click', join);
    nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
  } else {
    await loadAndRender();
  }
}

document.addEventListener('DOMContentLoaded', init);
