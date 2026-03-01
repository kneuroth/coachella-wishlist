// ── FUZZY MATCHING ────────────────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function normForCompare(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findSimilarArtists(name) {
  const norm = normForCompare(name);
  if (norm.length < 3) return [];

  return state.artists
    .map(id => {
      const display  = fmt(id);
      const normDisp = normForCompare(display);
      const isSubstr = normDisp.includes(norm) || norm.includes(normDisp);
      const dist     = levenshtein(norm, normDisp);
      const maxLen   = Math.max(norm.length, normDisp.length);
      const sim      = maxLen === 0 ? 1 : 1 - dist / maxLen;
      const score    = isSubstr ? Math.max(0.85, sim) : sim;
      return { id, display, score };
    })
    .filter(({ score }) => score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}


// ── ADD ARTIST ────────────────────────────────────────────────────────────────

function setupAddArtist() {
  const openBtn     = document.getElementById('add-artist-btn');
  const modal       = document.getElementById('add-artist-modal');
  const nameIn      = document.getElementById('add-artist-name');
  const submitBtn   = document.getElementById('add-artist-submit');
  const cancelBtn   = document.getElementById('add-artist-cancel');
  const errorEl     = document.getElementById('add-artist-error');
  const formEl      = document.getElementById('add-artist-form');
  const matchesEl   = document.getElementById('add-artist-matches');
  const matchesList = document.getElementById('add-artist-matches-list');
  const anywayBtn   = document.getElementById('add-artist-anyway');
  const backBtn     = document.getElementById('add-artist-back');

  let pendingArtistId = null;

  const showForm    = () => { formEl.classList.remove('hidden'); matchesEl.classList.add('hidden'); };
  const showMatches = () => { formEl.classList.add('hidden');    matchesEl.classList.remove('hidden'); };
  const close       = () => { modal.classList.add('hidden'); showForm(); };

  openBtn.addEventListener('click', () => {
    nameIn.value = '';
    errorEl.classList.add('hidden');
    pendingArtistId = null;
    showForm();
    modal.classList.remove('hidden');
    nameIn.focus();
  });

  cancelBtn.addEventListener('click', close);
  backBtn.addEventListener('click', showForm);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  const doAdd = async () => {
    submitBtn.textContent = '…';
    submitBtn.disabled    = true;
    anywayBtn.disabled    = true;
    try {
      await addSeedArtist(pendingArtistId);
      state.artists = [...state.artists, pendingArtistId].sort();
      close();
      renderCards();
    } catch (err) {
      console.error('Failed to add artist:', err);
    } finally {
      submitBtn.textContent = 'Add';
      submitBtn.disabled    = false;
      anywayBtn.disabled    = false;
    }
  };

  anywayBtn.addEventListener('click', doAdd);

  const submit = () => {
    const name = nameIn.value.trim();
    if (!name) return;

    pendingArtistId = slugify(name);

    if (state.artists.includes(pendingArtistId)) {
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');

    const similar = findSimilarArtists(name);
    if (similar.length > 0) {
      matchesList.innerHTML = '';
      similar.forEach(({ id, display }) => {
        const btn = document.createElement('button');
        btn.className   = 'add-match-btn';
        btn.textContent = display;
        btn.addEventListener('click', close); // artist already exists, just dismiss
        matchesList.appendChild(btn);
      });
      showMatches();
      return;
    }

    doAdd();
  };

  submitBtn.addEventListener('click', submit);
  nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}
