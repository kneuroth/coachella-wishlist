// ── CONFIG ────────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000';

// ── STATE ─────────────────────────────────────────────────────────────────────
let currentUser = null; // { userId, name }
let firstRender  = true;

const state = {
  wishlists: {}, // userId → [{ artistId, ranking, updatedAt }]
  users:     {}, // userId → name
  artists:   [], // all known artistIds
};

// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────
function loadCurrentUser() {
  try { return JSON.parse(localStorage.getItem('cwl_user')); }
  catch { return null; }
}

function saveCurrentUser(u) {
  localStorage.setItem('cwl_user', JSON.stringify(u));
}

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  if (res.status === 204) return null;
  return res.json();
}

// ── DATA ──────────────────────────────────────────────────────────────────────
async function fetchAll() {
  const wishlists = await api('GET', '/wishlists');
  const userIds   = Object.keys(wishlists);
  const profiles  = await Promise.all(userIds.map(id => api('GET', `/users/${id}`)));

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
const CYCLE  = [null, 'must_see', 'would_like_to_see', 'would_skip'];
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

  renderGrid();

  try {
    if (ranking === null) await api('DELETE', `/wishlists/${userId}/${artistId}`);
    else                  await api('PUT',    `/wishlists/${userId}/${artistId}`, { ranking });
  } catch (err) {
    console.error('Failed to save ranking:', err);
  }
}

function cycleRanking(artistId) {
  const cur  = getRanking(currentUser.userId, artistId);
  const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
  setRanking(artistId, next);
}

// ── HEAT ──────────────────────────────────────────────────────────────────────
function heatScore(artistId) {
  return Object.values(state.wishlists)
    .flat()
    .filter(e => e.artistId === artistId && e.ranking === 'must_see')
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

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderGrid() {
  // Always include current user even if they have no ratings yet
  if (currentUser && !state.users[currentUser.userId]) {
    state.users[currentUser.userId] = currentUser.name;
  }

  const userIds = Object.keys(state.users);

  const emptyEl = document.getElementById('empty-state');
  if (state.artists.length === 0) {
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
  }

  // Sort: most must_see heat first, then alphabetically
  const sorted = [...state.artists].sort((a, b) =>
    heatScore(b) - heatScore(a) || a.localeCompare(b)
  );

  // Header
  const thead = document.getElementById('thead-row');
  thead.innerHTML = '';

  const thArtist = el('th', 'th-artist', 'Artist');
  const thHeat   = el('th', 'th-heat', '🔥');
  thead.append(thArtist, thHeat);

  userIds.forEach(uid => {
    const th = el('th', 'th-friend' + (currentUser?.userId === uid ? ' is-me' : ''),
      state.users[uid] || uid.slice(0, 8));
    thead.appendChild(th);
  });

  // Rows
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';

  sorted.forEach((artistId, i) => {
    const tr = document.createElement('tr');

    if (firstRender) {
      tr.style.animation      = 'row-in 0.3s ease both';
      tr.style.animationDelay = `${i * 28}ms`;
    }

    // Artist name
    const tdA = el('td', 'td-artist', fmt(artistId));
    tr.appendChild(tdA);

    // Heat badge
    const score = heatScore(artistId);
    const tdH   = document.createElement('td');
    tdH.className = 'td-heat';
    if (score > 0) {
      const badge = el('span', 'heat-badge', String(score));
      badge.title = `${score} friend${score === 1 ? '' : 's'} marked Must See`;
      tdH.appendChild(badge);
    }
    tr.appendChild(tdH);

    // Ranking cells
    userIds.forEach(uid => {
      const ranking = getRanking(uid, artistId);
      const isMe    = currentUser?.userId === uid;
      const td      = document.createElement('td');

      td.className = 'td-rank'
        + (ranking ? ` r-${ranking}` : '')
        + (isMe    ? ' mine'         : '');

      if (ranking) {
        const sym   = el('span', 'rank-sym', SYMBOL[ranking]);
        sym.title   = LABEL[ranking];
        td.appendChild(sym);
      } else if (isMe) {
        const add   = el('span', 'rank-add', '+');
        add.title   = 'Click to rate';
        td.appendChild(add);
      }

      if (isMe) td.addEventListener('click', () => cycleRanking(artistId));
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  if (firstRender) firstRender = false;
}

// Small helper — creates an element with a class and optional text
function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ── SETUP ─────────────────────────────────────────────────────────────────────
async function setupUser(name) {
  const user = await api('POST', '/users', { name });
  saveCurrentUser(user);
  currentUser = user;
  state.users[user.userId]     = user.name;
  state.wishlists[user.userId] = state.wishlists[user.userId] || [];
}

// ── ADD ARTIST ────────────────────────────────────────────────────────────────
function addArtist(raw) {
  const id = raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (!id || state.artists.includes(id)) return false;
  state.artists.push(id);
  renderGrid();
  return true;
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function loadAndRender() {
  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');

  try {
    await fetchAll();

    // Merge current user so their column always appears
    if (currentUser) {
      state.users[currentUser.userId]     = state.users[currentUser.userId] || currentUser.name;
      state.wishlists[currentUser.userId] = state.wishlists[currentUser.userId] || [];
    }

    document.getElementById('user-label').textContent =
      currentUser ? `hi, ${currentUser.name}` : '';

    loading.classList.add('hidden');
    document.getElementById('grid-container').classList.remove('hidden');
    renderGrid();
  } catch (err) {
    console.error(err);
    loading.querySelector('span').textContent =
      'Failed to load — check API_BASE in app.js';
  }
}

async function init() {
  currentUser = loadCurrentUser();

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

  // Add artist controls
  const addInput = document.getElementById('new-artist');
  const addBtn   = document.getElementById('add-btn');

  const tryAdd = () => {
    if (addArtist(addInput.value)) addInput.value = '';
  };

  addBtn.addEventListener('click', tryAdd);
  addInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryAdd(); });
}

document.addEventListener('DOMContentLoaded', init);
