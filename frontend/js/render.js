// ── SLUGIFY ───────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/'/g, '')
    .replace(/[/]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    + '-2026';
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
