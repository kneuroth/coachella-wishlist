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
