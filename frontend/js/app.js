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

    // Ensure current user's wishlist array exists for optimistic updates
    if (currentUser) {
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
  setupAddArtist();

  const modal   = document.getElementById('setup-modal');
  const nameIn  = document.getElementById('setup-name');
  const joinBtn = document.getElementById('setup-btn');

  if (!currentUser) {
    modal.classList.remove('hidden');

    // Fetch existing users in the background and populate the sign-in list
    fetchAll()
      .then(() => {
        const realUsers = Object.entries(state.users)
          .filter(([uid]) => uid !== 'coachella-2026-seed');
        if (realUsers.length === 0) return;
        const list = document.getElementById('existing-users-list');
        realUsers.forEach(([uid, name]) => {
          const btn = document.createElement('button');
          btn.className   = 'existing-user-btn';
          btn.textContent = name;
          btn.addEventListener('click', async () => {
            currentUser = { userId: uid, name };
            saveCurrentUser(currentUser);
            modal.classList.add('hidden');
            await loadAndRender();
          });
          list.appendChild(btn);
        });
        document.getElementById('existing-users').classList.remove('hidden');
      })
      .catch(err => console.error('Failed to load existing users:', err));

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
        joinBtn.textContent = 'Join';
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
