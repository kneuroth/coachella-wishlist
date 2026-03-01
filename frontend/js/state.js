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
