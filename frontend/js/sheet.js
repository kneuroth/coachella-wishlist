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
