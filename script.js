// ── AUTH STATE ──
let currentUser = null;

async function loadUserBooks(userId) {
  const { data, error } = await supabaseClient
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading books:', error);
    showToast('Could not load your books. Please refresh.');
    return;
  }

  books.length = 0;
  (data || []).forEach(function (row) {
    books.push({
      id: row.id,
      title: row.title,
      author: row.author,
      cover: row.cover,
      coverBg: row.cover_bg,
      coverText: row.cover_text,
      shelf: row.shelf,
      rating: row.rating,
      notes: row.notes,
    });
  });
  applyCustomBookOrder();
}


async function initializeAuthState() {
  // A shared link shows the sharer's books to anyone, signed in or not.
  if (await sharedViewReady) {
    renderGrid();
    renderShelves();
    updateBookCount();
    showLibraryPage();
    return;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    currentUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
      picture: session.user.user_metadata?.picture || session.user.user_metadata?.avatar_url || '',
    };
    await loadUserBooks(currentUser.id);
    renderGrid();
    renderShelves();
    updateBookCount();
    updatePageState();
  } else {
    showOnboarding();
  }
}


function showOnboarding() {
  document.getElementById('onboarding-screen').style.display = 'flex';
  document.getElementById('empty-state-screen').style.display = 'none';
  document.getElementById('main-page').style.display = 'none';
}

function showEmptyState() {
  document.getElementById('onboarding-screen').style.display = 'none';
  document.getElementById('empty-state-screen').style.display = 'flex';
  document.getElementById('main-page').style.display = 'none';
}

function showLibraryPage() {
  document.getElementById('onboarding-screen').style.display = 'none';
  document.getElementById('empty-state-screen').style.display = 'none';
  document.getElementById('main-page').style.display = 'block';
}

function updatePageState() {
  if (!currentUser) {
    showOnboarding();
  } else if (books.length === 0) {
    showEmptyState();
  } else {
    showLibraryPage();
  }
}

function goToAddBook() {
  showLibraryPage();
  openModal();
}

// Google Sign-In callback
async function onGoogleSignIn(response) {
  const userData = response.credential; // JWT token
  try {
    const payload = JSON.parse(atob(userData.split('.')[1])); // Decode JWT payload (still used for name/picture)

    // Hand the same token to Supabase so it creates a real, verified session
    const { data, error } = await supabaseClient.auth.signInWithIdToken({
      provider: 'google',
      token: userData,
    });

    if (error) {
      console.error('Supabase sign-in error:', error);
      showToast('Sign in failed: ' + (error.message || 'please try again.'));
      return;
    }

    // IMPORTANT: id now comes from Supabase's own user table, not Google's payload.
    // This is the id your RLS policies check against (auth.uid()).
    currentUser = {
      id: data.user.id,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    localStorage.setItem('myLibrary_user', JSON.stringify(currentUser));
    await loadUserBooks(currentUser.id);
    updatePageState();
    renderGrid();
    renderShelves();
    updateBookCount();
  } catch (err) {
    console.error(err);
    showToast('Sign in failed. Please try again.');
  }
}

let googleSignInReady = false;

// Renders Google's own sign-in button into #google-signin-btn. We don't rely on
// google.accounts.id.prompt() (One Tap): Google silently suppresses it after it
// has been dismissed and in browsers that block third-party cookies, which left
// the "Continue with Google" button doing nothing.
function initializeGoogleSignIn() {
  if (googleSignInReady) return true;
  if (!(window.google && google.accounts && google.accounts.id)) return false;

  google.accounts.id.initialize({
    client_id: '684826739629-p96i1jgjelionebkggt1s733pd239894.apps.googleusercontent.com',
    callback: onGoogleSignIn,
  });

  const googleBtn = document.getElementById('google-signin-btn');
  if (googleBtn) {
    googleBtn.innerHTML = '';
    googleBtn.classList.add('gsi-rendered');
    google.accounts.id.renderButton(googleBtn, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
      width: Math.min(400, Math.max(200, googleBtn.offsetWidth || 320)),
    });
  }

  googleSignInReady = true;
  return true;
}

// The Google script loads async, so keep trying for a few seconds if it isn't there yet.
function waitForGoogleSignIn(attemptsLeft) {
  if (initializeGoogleSignIn() || attemptsLeft <= 0) return;
  setTimeout(function () { waitForGoogleSignIn(attemptsLeft - 1); }, 250);
}

// Initialize Google Sign-In button
window.addEventListener('load', function () {
  const googleBtn = document.getElementById('google-signin-btn');
  waitForGoogleSignIn(40);

  if (googleBtn) {
    googleBtn.addEventListener('click', function () {
      // If the user is already signed in, just continue to their library/empty state
      if (currentUser) {
        updatePageState();
        return;
      }
      if (!googleSignInReady) {
        showToast('Google sign-in is not ready yet. Refresh and try again.');
      }
    });
  }

  initializeAuthState();
  bindModalTriggers();
  bindAddBookButtons();
  renderGrid();
  renderShelves();
  updateBookCount();
});

// ── VIEW TOGGLE ──
function setView(v, el) {
  document.querySelectorAll('.toggle-group .nav-btn').forEach(function (b) {
    b.classList.remove('active');
  });
  el.classList.add('active');
  document.getElementById('grid-sections').style.display = v === 'grid' ? 'block' : 'none';
  document.getElementById('shelf-sections').style.display = v === 'shelf' ? 'block' : 'none';
}

// ── BOOK DATA ──
const books = [];

// custom shelves created by user (beyond the built-in ones)
const customShelves = [];
// ── SAFE MARKUP HELPERS ──
// Book titles/authors can come from Google Books or a share link, so never put
// them into HTML unescaped.
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Fills coverEl with the book's cover image, falling back to a coloured
// placeholder with the title if there is no cover or it fails to load.
function fillCover(coverEl, book, placeholderClass, options) {
  const opts = options || {};
  const bg = book.coverBg || opts.bg || '#888780';
  const text = book.coverText || opts.text || '#F0EDE6';

  function showPlaceholder() {
    coverEl.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.className = placeholderClass;
    const span = document.createElement('span');
    span.textContent = book.title || '';
    if (!opts.plain) {
      placeholder.style.background = bg;
      span.style.color = text;
    }
    placeholder.appendChild(span);
    coverEl.appendChild(placeholder);
    if (opts.fillParent) coverEl.style.background = bg;
  }

  coverEl.innerHTML = '';
  if (!book.cover) {
    showPlaceholder();
    return;
  }
  const img = document.createElement('img');
  img.src = book.cover;
  img.alt = book.title || '';
  if (opts.imgFill) {
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
  }
  img.addEventListener('error', showPlaceholder);
  coverEl.appendChild(img);
  if (opts.fillParent) coverEl.style.background = '';
}

function bookCardInnerHtml(book) {
  return `
      <div class="book-cover"></div>
      <div class="book-title">${escapeHtml(book.title)}</div>
      <div class="book-author">${escapeHtml(book.author)}</div>
    `;
}

// ── RENDER GRID ──
function renderGrid() {
  const container = document.getElementById('grid-books');
  if (!container) return;
  container.innerHTML = '';

  const isReorderable = !isSharedView && (activeFilter === null) && (!document.querySelector('.search-input') || !document.querySelector('.search-input').value.trim());

  if (isReorderable) {
    container.addEventListener('dragover', handleDragOver);
  } else {
    container.removeEventListener('dragover', handleDragOver);
  }

  books.forEach(function (book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = bookCardInnerHtml(book);
    fillCover(card.querySelector('.book-cover'), book, 'book-cover-placeholder', { imgFill: true });

    card.addEventListener('click', function () { openFocus(book); });

    if (isReorderable) {
      card.setAttribute('draggable', 'true');
      card.dataset.id = book.id;

      card.addEventListener('dragstart', function (e) {
        e.stopPropagation();
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', book.id);
      });

      card.addEventListener('dragend', function (e) {
        card.classList.remove('dragging');
        const newOrderIds = Array.from(container.querySelectorAll('.book-card')).map(el => el.dataset.id);
        reorderBooksArray(newOrderIds);
      });
    }

    container.appendChild(card);
  });
}

function handleDragOver(e) {
  e.preventDefault();
  const draggingCard = document.querySelector('.book-card.dragging');
  if (!draggingCard) return;

  const container = document.getElementById('grid-books');
  const closest = getDragAfterElement(container, e.clientY, e.clientX);

  if (closest.element == null) {
    container.appendChild(draggingCard);
  } else {
    if (closest.isBefore) {
      container.insertBefore(draggingCard, closest.element);
    } else {
      container.insertBefore(draggingCard, closest.element.nextSibling);
    }
  }
}

function getDragAfterElement(container, y, x) {
  const draggableElements = [...container.querySelectorAll('.book-card:not(.dragging)')];

  let closest = { distance: Infinity, element: null, isBefore: true };

  draggableElements.forEach(child => {
    const box = child.getBoundingClientRect();
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const distance = Math.hypot(x - centerX, y - centerY);

    if (distance < closest.distance) {
      const isBefore = (x < centerX);
      closest = { distance, element: child, isBefore };
    }
  });

  return closest;
}

function reorderBooksArray(newOrderIds) {
  const bookMap = {};
  books.forEach(b => {
    bookMap[b.id] = b;
  });

  const reordered = [];
  newOrderIds.forEach(id => {
    if (bookMap[id]) {
      reordered.push(bookMap[id]);
      delete bookMap[id];
    }
  });

  books.forEach(b => {
    if (bookMap[b.id]) {
      reordered.push(b);
    }
  });

  books.length = 0;
  reordered.forEach(b => books.push(b));

  saveCustomBookOrder();
  try { persistBooks(); } catch (e) {}
}

function saveCustomBookOrder() {
  if (!currentUser) return;
  const orderIds = books.map(b => b.id);
  localStorage.setItem(`myLibrary_book_order_${currentUser.id}`, JSON.stringify(orderIds));
}

function applyCustomBookOrder() {
  if (!currentUser) return;
  const stored = localStorage.getItem(`myLibrary_book_order_${currentUser.id}`);
  if (!stored) return;
  try {
    const orderIds = JSON.parse(stored);
    if (!Array.isArray(orderIds)) return;

    const bookMap = {};
    books.forEach(b => {
      bookMap[b.id] = b;
    });

    const reordered = [];
    orderIds.forEach(id => {
      if (bookMap[id]) {
        reordered.push(bookMap[id]);
        delete bookMap[id];
      }
    });

    books.forEach(b => {
      if (bookMap[b.id]) {
        reordered.push(b);
      }
    });

    books.length = 0;
    reordered.forEach(b => books.push(b));
  } catch (e) {
    console.error('Error applying custom book order:', e);
  }
}

// ── SPINE COLOR EXTRACTION ──
const spineColorCache = {}; // keyed by cover URL -> { bg, text }

function getReadableTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#2C2C2A' : '#F0EDE6';
}

function applySpineColor(spineEl, color) {
  if (!spineEl) return;
  const placeholder = spineEl.querySelector('.spine-placeholder');
  if (!placeholder) return;
  placeholder.style.setProperty('--spine-bg', color.bg);
  placeholder.style.setProperty('--spine-text', color.text);
}

// Picks the cover's main colour rather than averaging every pixel (averaging a
// cover with lots of white and one bold colour gives a washed-out pastel).
// Pixels are grouped into coarse colour buckets; the biggest bucket wins, with
// colourful buckets counting extra so a strong title colour beats a plain background.
function pickSpineColor(img) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  const buckets = {};
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue; // skip transparent pixels
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
    const bucket = buckets[key] || (buckets[key] = { r: 0, g: 0, b: 0, count: 0 });
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count++;
  }

  let best = null;
  let bestScore = 0;
  Object.keys(buckets).forEach(function (key) {
    const bucket = buckets[key];
    const r = bucket.r / bucket.count, g = bucket.g / bucket.count, b = bucket.b / bucket.count;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const score = bucket.count * (0.2 + saturation * 2);
    if (score > bestScore) {
      bestScore = score;
      best = [r, g, b];
    }
  });
  if (!best) return null;

  // Very pale colours read as blank spines; deepen them a little.
  const lightness = (Math.max.apply(null, best) + Math.min.apply(null, best)) / 2 / 255;
  if (lightness > 0.75) {
    const factor = 0.75 / lightness;
    best = best.map(v => v * factor);
  }
  return '#' + best.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function extractSpineColor(book, spineEl) {
  if (!book.cover) return;

  if (spineColorCache[book.cover]) {
    applySpineColor(spineEl, spineColorCache[book.cover]);
    return;
  }


  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = function () {
    try {
      const color = pickSpineColor(img);
      if (!color) return; // nothing usable — keep fallback colour
      const result = { bg: color, text: getReadableTextColor(color) };
      spineColorCache[book.cover] = result;
      applySpineColor(spineEl, result);
    } catch (e) {
      // canvas got tainted (no CORS) — keep fallback colour
    }
  };

  img.onerror = function () {
    // image failed to load — keep gray fallback
  };

  const proxiedUrl = 'https://images.weserv.nl/?url=' + encodeURIComponent(book.cover.replace(/^https?:\/\//, ''));
  img.src = proxiedUrl;
}

function createSpine(book) {
  const spine = document.createElement('div');
  spine.className = 'spine';

  const cached = book.cover ? spineColorCache[book.cover] : null;
  const initialBg = cached ? cached.bg : book.coverBg;
  const initialText = cached ? cached.text : book.coverText;
  spine.innerHTML = `<div class="spine-placeholder" style="--spine-bg:${escapeHtml(initialBg)}; --spine-text:${escapeHtml(initialText)};"><span>${escapeHtml(book.title)}</span></div>`;
  spine.addEventListener('click', function () { openFocus(book); });

  if (book.cover && !cached) {
    extractSpineColor(book, spine);
  }
  return spine;
}

// ── RENDER SHELVES ──
function renderShelves() {
  const shelves = {};
  books.forEach(function (book) {
    const shelfName = book.shelf || 'Unsorted';
    if (!shelves[shelfName]) shelves[shelfName] = [];
    shelves[shelfName].push(book);
  });

  const container = document.getElementById('shelf-rows');
  container.innerHTML = '';

  Object.keys(shelves).forEach(function (name) {
    const unit = document.createElement('div');
    unit.className = 'shelf-unit';
    unit.innerHTML = `
      <div class="section-label">${escapeHtml(name)}</div>
      <div class="shelf-books"></div>
      <div class="shelf-wood"></div>
    `;
    container.appendChild(unit);

    const shelfEl = unit.querySelector('.shelf-books');
    shelves[name].forEach(function (book) {
      shelfEl.appendChild(createSpine(book));
    });

  });
}

// ── BOOK FOCUS OVERLAY ──
let focusedBook = null;

function openFocus(book) {
  focusedBook = book;
  const overlay = document.getElementById('book-focus-overlay');
  const card = document.getElementById('focus-card');
  const coverEl = document.getElementById('focus-cover');

  card.classList.remove('closing');

  fillCover(coverEl, book, 'book-focus-cover-placeholder', { bg: '#4a3b2c', text: '#f4efe6', fillParent: true });

  // Populate Ex Libris Owner Branding
  const ownerName = (currentUser && currentUser.name) ? currentUser.name : "Nana Adjoa";
  const nameParts = ownerName.trim().split(/\s+/);
  let monogram = "N · A";
  if (nameParts.length >= 2) {
    monogram = `${nameParts[0][0].toUpperCase()} · ${nameParts[nameParts.length - 1][0].toUpperCase()}`;
  } else if (nameParts.length === 1 && nameParts[0]) {
    monogram = nameParts[0][0].toUpperCase();
  }
  const monogramEl = document.getElementById('focus-monogram');
  const ownerNameEl = document.getElementById('focus-owner-name');
  if (monogramEl) monogramEl.textContent = monogram;
  if (ownerNameEl) ownerNameEl.textContent = ownerName;

  // Header Badge
  const badgeEl = document.getElementById('focus-badge');
  if (badgeEl) {
    if (book.rating === 5) {
      badgeEl.textContent = 'A FIVE-STAR FAVORITE';
    } else if (book.rating >= 4) {
      badgeEl.textContent = 'HIGHLY RECOMMENDED';
    } else {
      badgeEl.textContent = (book.shelf || 'FEATURED SELECTION').toUpperCase();
    }
  }

  document.getElementById('focus-title').textContent = book.title;
  document.getElementById('focus-author').textContent = book.author || 'Unknown Author';

  // Ratings
  const starsEl = document.getElementById('focus-stars');
  starsEl.innerHTML = '';
  const ratingVal = book.rating || 5;
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement('span');
    s.textContent = '★';
    if (i <= ratingVal) s.classList.add('lit');
    starsEl.appendChild(s);
  }

  const ratingValEl = document.getElementById('focus-rating-val');
  if (ratingValEl) ratingValEl.textContent = `${ratingVal} Star${ratingVal > 1 ? 's' : ''}`;

  // Meta Grid
  const statusEl = document.getElementById('focus-status');
  const shelfEl = document.getElementById('focus-shelf');
  if (statusEl) statusEl.textContent = book.shelf === 'To Read' ? 'To Read' : (book.shelf === 'Currently Reading' ? 'Reading' : 'Read');
  if (shelfEl) shelfEl.textContent = book.shelf || 'Favorites';

  // Notes
  const notesEl = document.getElementById('focus-notes');
  if (book.notes) {
    notesEl.textContent = '"' + book.notes + '"';
    notesEl.classList.remove('empty');
  } else {
    notesEl.textContent = 'No personal notes added for this book yet.';
    notesEl.classList.add('empty');
  }

  // External Links
  const query = encodeURIComponent(`${book.title} ${book.author || ''}`);
  const goodreadsLink = document.getElementById('focus-link-goodreads');
  const amazonLink = document.getElementById('focus-link-amazon');
  if (goodreadsLink) goodreadsLink.href = `https://www.goodreads.com/search?q=${query}`;
  if (amazonLink) amazonLink.href = `https://www.amazon.com/s?k=${query}`;

  overlay.classList.add('open');
}

function closeFocus() {
  const overlay = document.getElementById('book-focus-overlay');
  const card = document.getElementById('focus-card');
  if (!overlay || !overlay.classList.contains('open')) return;
  
  if (card) card.classList.add('closing');
  setTimeout(function () {
    overlay.classList.remove('open');
    if (card) card.classList.remove('closing');
  }, 250);
}

function deleteFocusedBook() {
  if (!focusedBook) return;

  const confirmDelete = confirm(`Are you sure you want to delete "${focusedBook.title}" from your library?`);
  if (!confirmDelete) return;

  const index = books.findIndex(b => b.id === focusedBook.id);
  if (index !== -1) {
    const title = focusedBook.title;
    books.splice(index, 1);
    saveCustomBookOrder();
    try { persistBooks(); } catch (e) {}
    closeFocus();
    applyFilter(activeFilter);
    showToast(`"${title}" deleted from library`);
  }
}

document.getElementById('book-focus-overlay').addEventListener('click', function (e) {
  if (e.target === this || e.target.classList.contains('book-focus-container')) closeFocus();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeFocus();
  }
});

// ── ADD BOOK MODAL ──
let selectedBook = null;
let searchTimeout = null;
let latestSearchId = 0;
let currentSearchController = null;

function openModal() {
  const modal = document.getElementById('add-book-modal');
  const searchView = document.getElementById('modal-search-view');
  const detailView = document.getElementById('modal-detail-view');
  const searchInput = document.getElementById('book-search-input');
  const results = document.getElementById('search-results');
  const resultsLabel = document.getElementById('results-label');

  if (!modal || !searchView || !detailView || !searchInput || !results || !resultsLabel) return;

  document.body.classList.add('modal-open');
  modal.classList.add('open');
  searchView.style.display = 'flex';
  detailView.style.display = 'none';
  searchInput.value = '';
  results.innerHTML = '';
  resultsLabel.style.display = 'none';
  disableAddDetails();
  setTimeout(() => searchInput.focus(), 100);
}

function closeModal() {
  document.body.classList.remove('modal-open');
  const modal = document.getElementById('add-book-modal');
  if (modal) modal.classList.remove('open');
  selectedBook = null;
  editMode = false;
  editingBook = null;
}

function bindModalTriggers() {
  const navAddBtn = document.getElementById('nav-add-btn');
  if (navAddBtn) {
    navAddBtn.removeEventListener('click', handleAddBookClick);
    navAddBtn.addEventListener('click', handleAddBookClick);
  }
}

function bindAddBookButtons() {
  const emptyStateBtn = document.querySelector('.btn-open-add-book');
  if (emptyStateBtn) {
    emptyStateBtn.removeEventListener('click', handleAddBookButtonClick);
    emptyStateBtn.addEventListener('click', handleAddBookButtonClick);
  }

  const navAddBtn = document.getElementById('nav-add-btn');
  if (navAddBtn) {
    navAddBtn.removeEventListener('click', handleAddBookButtonClick);
    navAddBtn.addEventListener('click', handleAddBookButtonClick);
  }
}

function handleAddBookClick() {
  openModal();
}

function handleAddBookButtonClick(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  goToAddBook();
}

const addBookModal = document.getElementById('add-book-modal');
if (addBookModal) {
  addBookModal.addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });
}

// ── GOOGLE BOOKS SEARCH ──
function getCoverUrl(imageLinks) {
  if (!imageLinks) return null;
  const raw = imageLinks.thumbnail || imageLinks.smallThumbnail || imageLinks.medium || imageLinks.large || imageLinks.extraLarge;
  if (!raw) return null;
  // Only upgrade to https — avoid re-manipulating Google's signed URL parameters
  return raw.replace('http://', 'https://');
}

const GOOGLE_BOOKS_KEY = 'AIzaSyDYgVj9GRej6iSb3mkmL9bDRca9sxF3k2o';

// One clickable search result. Built with DOM nodes + textContent so titles
// containing quotes or apostrophes can't break the markup.
function createResultCard(book) {
  const card = document.createElement('div');
  card.className = 'result-card';

  const coverEl = document.createElement('div');
  coverEl.className = 'result-cover';

  function showPlaceholder() {
    coverEl.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'result-cover-placeholder';
    if (book.coverBg) placeholder.style.background = book.coverBg;
    const span = document.createElement('span');
    span.textContent = book.title;
    if (book.coverText) span.style.color = book.coverText;
    placeholder.appendChild(span);
    coverEl.appendChild(placeholder);
  }

  if (book.cover) {
    const img = document.createElement('img');
    img.src = book.cover;
    img.alt = book.title;
    img.onerror = showPlaceholder;
    coverEl.appendChild(img);
  } else {
    showPlaceholder();
  }

  const infoEl = document.createElement('div');
  infoEl.className = 'result-info';
  const titleEl = document.createElement('div');
  titleEl.className = 'result-title';
  titleEl.textContent = book.title;
  const authorEl = document.createElement('div');
  authorEl.className = 'result-author';
  authorEl.textContent = book.author;
  infoEl.appendChild(titleEl);
  infoEl.appendChild(authorEl);

  card.appendChild(coverEl);
  card.appendChild(infoEl);

  card.addEventListener('click', function () {
    document.querySelectorAll('.result-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedBook = {
      title: book.title,
      author: book.author,
      cover: book.cover,
      description: book.description || '',
    };
    enableAddDetails();
  });

  return card;
}

function createResultsSection(label) {
  const section = document.createElement('div');
  section.className = 'results-section';
  const labelEl = document.createElement('div');
  labelEl.className = 'results-section-label';
  labelEl.textContent = label;
  const grid = document.createElement('div');
  grid.className = 'results-grid';
  section.appendChild(labelEl);
  section.appendChild(grid);
  return { section, grid };
}

function setResultsMessage(grid, message) {
  grid.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'search-loading';
  msg.style.gridColumn = '1/-1';
  msg.textContent = message;
  grid.appendChild(msg);
}

// Searches all fields (title, author, ...) so "dune", "frank herbert" and
// "dune frank herbert" all work. Retries once on rate-limit / server hiccups.
async function fetchGoogleBooks(query, signal) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20&printType=books&key=${GOOGLE_BOOKS_KEY}`;
  let res = await fetch(url, { signal });
  if (res.status === 429 || res.status >= 500) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    res = await fetch(url, { signal });
  }
  if (!res.ok) {
    const err = new Error('Google Books returned ' + res.status);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();

  // Google often returns several editions of the same book; keep the first
  // (most relevant) one, preferring an edition that has a cover.
  const byKey = new Map();
  (data.items || []).forEach(function (item) {
    const info = item.volumeInfo || {};
    const book = {
      title: info.title || 'Unknown Title',
      author: info.authors && info.authors.length ? info.authors[0] : 'Unknown Author',
      cover: getCoverUrl(info.imageLinks),
      description: info.description || '',
    };
    const key = (book.title + '|' + book.author).toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, book);
    } else if (!existing.cover && book.cover) {
      existing.cover = book.cover;
    }
  });
  return Array.from(byKey.values()).slice(0, 12);
}

async function searchBooks(query) {
  const thisSearchId = ++latestSearchId;

  // cancel any still-in-flight search from a previous keystroke
  if (currentSearchController) {
    currentSearchController.abort();
  }
  currentSearchController = new AbortController();
  const signal = currentSearchController.signal;

  const container = document.getElementById('search-results');
  const labelEl = document.getElementById('results-label');

  selectedBook = null;
  disableAddDetails();

  if (!query || query.trim().length < 2) {
    container.innerHTML = '';
    labelEl.style.display = 'none';
    return;
  }

  labelEl.style.display = 'block';
  container.innerHTML = '';

  // ── Local matches (instant) ──
  const q = query.trim().toLowerCase();
  const localMatches = books.filter(function (b) {
    return (b.title || '').toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q);
  });

  if (localMatches.length > 0) {
    const local = createResultsSection('In your library');
    localMatches.forEach(function (book) {
      local.grid.appendChild(createResultCard({
        title: book.title,
        author: book.author || 'Unknown Author',
        cover: book.cover,
        coverBg: book.coverBg,
        coverText: book.coverText,
      }));
    });
    container.appendChild(local.section);
  }

  // ── Google Books (async) ──
  const google = createResultsSection('From Google Books');
  setResultsMessage(google.grid, 'Searching…');
  container.appendChild(google.section);

  try {
    const results = await fetchGoogleBooks(query.trim(), signal);

    // if a newer search has started since this one began, ignore this stale result
    if (thisSearchId !== latestSearchId) return;

    if (results.length === 0) {
      setResultsMessage(google.grid, 'No books found. Try the author\'s name, or check the spelling.');
      return;
    }
    google.grid.innerHTML = '';
    results.forEach(function (book) {
      google.grid.appendChild(createResultCard(book));
    });
  } catch (err) {
    if (err.name === 'AbortError') return; // cancelled because a newer search started - not a real error
    if (thisSearchId !== latestSearchId) return;
    console.error('Google Books search failed:', err);
    setResultsMessage(google.grid, err.status === 429
      ? 'Too many searches in a row. Wait a few seconds and try again.'
      : err.status
        ? 'Google Books had a problem (' + err.status + '). Try again in a moment.'
        : 'Could not reach Google Books. Check your connection.');
  }
}

// renderResults is now inlined inside searchBooks above

function enableAddDetails() {
  document.getElementById('btn-add-details').classList.add('enabled');
}

function disableAddDetails() {
  document.getElementById('btn-add-details').classList.remove('enabled');
}

// ── DETAIL VIEW ──
let editMode = false;   // true when editing an existing book
let editingBook = null; // the book object being edited

function showDetailView() {
  if (!selectedBook) return;
  document.getElementById('modal-search-view').style.display = 'none';
  document.getElementById('modal-detail-view').style.display = 'flex';

  // Titles / button labels depend on mode
  document.getElementById('detail-modal-title').textContent = editMode ? 'Edit book' : 'Add to library';
  document.getElementById('detail-save-btn').textContent = editMode ? 'Save changes' : 'Add to library';
  document.getElementById('detail-back-btn').style.display = editMode ? 'none' : '';

  const coverEl = document.getElementById('detail-cover');
  fillCover(coverEl, selectedBook, 'detail-cover-placeholder', { plain: true });

  document.getElementById('detail-title').textContent = selectedBook.title;
  document.getElementById('detail-author').textContent = selectedBook.author;

  refreshShelfOptions();

  if (editMode && editingBook) {
    // Pre-fill existing values
    document.getElementById('book-notes').value = editingBook.notes || '';
    document.getElementById('shelf-select').value = editingBook.shelf || '';
    setRating(editingBook.rating || 0);
  } else {
    document.getElementById('book-notes').value = '';
    document.getElementById('shelf-select').value = '';
    setRating(0);
  }
}

function goBackToSearch() {
  document.getElementById('modal-search-view').style.display = 'flex';
  document.getElementById('modal-detail-view').style.display = 'none';
}

// Open modal in edit mode for an existing book
function openEditModal() {
  if (!focusedBook) return;
  editMode = true;
  editingBook = focusedBook;
  selectedBook = {
    title: focusedBook.title,
    author: focusedBook.author,
    cover: focusedBook.cover,
    description: '',
  };

  closeFocus();

  const modal = document.getElementById('add-book-modal');
  document.body.classList.add('modal-open');
  modal.classList.add('open');
  document.getElementById('modal-search-view').style.display = 'none';
  showDetailView();
}



// ── SHELF OPTIONS — keeps built-ins + any custom ones in sync ──
const builtInShelves = ['Fiction', 'Nonfiction', 'Design', 'Self-help', 'Poetry'];

function getAllShelves() {
  return [...builtInShelves, ...customShelves];
}

function refreshShelfOptions() {
  const select = document.getElementById('shelf-select');
  const current = select.value;
  select.innerHTML = '<option value="" disabled selected>Choose a shelf…</option>';
  getAllShelves().forEach(function (s) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });

  const createOpt = document.createElement('option');
  createOpt.value = '__CREATE_NEW__';
  createOpt.textContent = '+ Create new category…';
  select.appendChild(createOpt);

  if (current) select.value = current;
}

// ── STAR RATING ──
let currentRating = 0;

function setRating(val) {
  currentRating = val;
  document.querySelectorAll('.star').forEach(function (star) {
    star.classList.toggle('filled', parseInt(star.dataset.value) <= val);
  });
}

document.querySelectorAll('.star').forEach(function (star) {
  star.addEventListener('click', function () { setRating(parseInt(this.dataset.value)); });
  star.addEventListener('mouseenter', function () {
    const val = parseInt(this.dataset.value);
    document.querySelectorAll('.star').forEach(function (s) {
      s.classList.toggle('hover', parseInt(s.dataset.value) <= val);
    });
  });
  star.addEventListener('mouseleave', function () {
    document.querySelectorAll('.star').forEach(function (s) { s.classList.remove('hover'); });
  });
});

// ── SAVE BOOK ──
async function saveBook() {
  if (!selectedBook) return;
  const shelf = document.getElementById('shelf-select').value;
  const notes = document.getElementById('book-notes').value.trim();

  if (!shelf) {
    document.getElementById('shelf-select').classList.add('error');
    setTimeout(() => document.getElementById('shelf-select').classList.remove('error'), 1500);
    return;
  }

  if (editMode && editingBook) {
    const { data, error } = await supabaseClient
      .from('books')
      .update({
        shelf,
        rating: currentRating,
        notes,
      })
      .eq('id', editingBook.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating book:', error);
      showToast('Could not update book. Please try again.');
      return;
    }

    const idx = books.findIndex(b => b.id === editingBook.id);
    if (idx !== -1) {
      books[idx].shelf = data.shelf;
      books[idx].rating = data.rating;
      books[idx].notes = data.notes;
    }

    try { persistBooks(); } catch (e) {}

    applyFilter(activeFilter);
    updatePageState();
    showToast(`"${selectedBook.title}" updated`);
    closeModal();
    return;
  }

const newBookForDb = {
    user_id: currentUser.id,
    title: selectedBook.title,
    author: selectedBook.author,
    cover: selectedBook.cover,
    cover_bg: '#888780',
    cover_text: '#F0EDE6',
    shelf,
    rating: currentRating,
    notes,
  };

  const { data, error } = await supabaseClient
    .from('books')
    .insert(newBookForDb)
    .select()
    .single();

  if (error) {
    console.error('Error saving book:', error);
    showToast('Could not save book. Please try again.');
    return;
  }

  books.push({
    id: data.id,
    title: data.title,
    author: data.author,
    cover: data.cover,
    coverBg: data.cover_bg,
    coverText: data.cover_text,
    shelf: data.shelf,
    rating: data.rating,
    notes: data.notes,
  });

  renderGrid();
  renderShelves();
  updateBookCount();
  updatePageState();
  showToast(`"${selectedBook.title}" added to ${shelf}`);
  closeModal();
}

function persistBooks() {
  if (!currentUser) return;
  try {
    localStorage.setItem(`myLibrary_books_${currentUser.id}`, JSON.stringify(books));
  } catch (e) {
    // ignore storage errors
  }
}

function updateBookCount() {
  document.getElementById('book-count').textContent = books.length + ' Books';
}

// ── TOAST ──
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── SEARCH INPUT DEBOUNCE (Add Book modal) ──
document.getElementById('book-search-input').addEventListener('input', function () {
  clearTimeout(searchTimeout);
  const val = this.value.trim();
  searchTimeout = setTimeout(() => searchBooks(val), 700);
});

document.getElementById('book-search-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    clearTimeout(searchTimeout);
    searchBooks(this.value.trim());
  }
});

// ── NAV SEARCH (local library filter) ──
let navSearchTimeout = null;

document.querySelector('.search-input').addEventListener('input', function () {
  clearTimeout(navSearchTimeout);
  const val = this.value.trim();
  navSearchTimeout = setTimeout(() => filterLocalLibrary(val), 250);
});

function filterLocalLibrary(query) {
  const q = query.toLowerCase().trim();

  if (q.length < 1) {
    // No query — restore full grid
    document.getElementById('book-count').textContent = books.length + ' Books';
    renderGrid();
    return;
  }

  // Separate title-only matches from author-only matches
  const titleMatches = books.filter(function (b) {
    return (b.title || '').toLowerCase().includes(q);
  });
  const authorMatches = books.filter(function (b) {
    return (b.author || '').toLowerCase().includes(q) && !(b.title || '').toLowerCase().includes(q);
  });

  const allMatched = [...titleMatches, ...authorMatches];

  // Update count display
  const countEl = document.getElementById('book-count');
  countEl.textContent = allMatched.length + (allMatched.length === 1 ? ' Result' : ' Results');

  const gridContainer = document.getElementById('grid-books');
  if (!gridContainer) return;
  gridContainer.innerHTML = '';

  if (allMatched.length === 0) {
    gridContainer.innerHTML = '<div class="library-empty-search">No books match "' + query + '"</div>';
    return;
  }

  function makeBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = bookCardInnerHtml(book);
    fillCover(card.querySelector('.book-cover'), book, 'book-cover-placeholder', { imgFill: true });
    card.addEventListener('click', function () { openFocus(book); });
    return card;
  }

  // If there are author-only matches, group them under "Books by [Author]" headings
  if (authorMatches.length > 0) {
    // Render title matches first (if any) with no label when also have author section
    if (titleMatches.length > 0) {
      const titleSection = document.createElement('div');
      titleSection.className = 'author-search-section';
      const titleHeading = document.createElement('div');
      titleHeading.className = 'author-search-heading';
      titleHeading.textContent = 'Matching titles';
      titleSection.appendChild(titleHeading);
      const titleGrid = document.createElement('div');
      titleGrid.className = 'author-search-grid';
      titleMatches.forEach(function (book) { titleGrid.appendChild(makeBookCard(book)); });
      titleSection.appendChild(titleGrid);
      gridContainer.appendChild(titleSection);
    }

    // Group author matches by author name
    const byAuthor = {};
    authorMatches.forEach(function (book) {
      if (!byAuthor[book.author]) byAuthor[book.author] = [];
      byAuthor[book.author].push(book);
    });

    Object.keys(byAuthor).forEach(function (authorName) {
      const section = document.createElement('div');
      section.className = 'author-search-section';

      const heading = document.createElement('div');
      heading.className = 'author-search-heading';
      heading.innerHTML = `Books by <em>${escapeHtml(authorName)}</em>`;
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'author-search-grid';
      byAuthor[authorName].forEach(function (book) { grid.appendChild(makeBookCard(book)); });
      section.appendChild(grid);
      gridContainer.appendChild(section);
    });
  } else {
    // Only title matches — render flat grid as before
    titleMatches.forEach(function (book) { gridContainer.appendChild(makeBookCard(book)); });
  }
}

// ── FILTER ──
let activeFilter = null;
let showingNewCategoryInput = false;

function toggleFilter() {
  const dropdown = document.getElementById('filter-dropdown');
  const isOpen = dropdown.classList.contains('open');
  if (isOpen) {
    closeFilter();
  } else {
    showingNewCategoryInput = false;
    buildFilterDropdown();
    dropdown.classList.add('open');
  }
}

function closeFilter() {
  showingNewCategoryInput = false;
  document.getElementById('filter-dropdown').classList.remove('open');
}

document.addEventListener('click', function (e) {
  const wrapper = document.querySelector('.filter-wrapper');
  if (wrapper && !wrapper.contains(e.target)) closeFilter();
});

function buildFilterDropdown() {
  const dropdown = document.getElementById('filter-dropdown');
  dropdown.innerHTML = '';

  // ── Create new category row (at the top) ──
  if (showingNewCategoryInput) {
    const inputRow = document.createElement('div');
    inputRow.className = 'filter-new-input-row';
    inputRow.innerHTML = `
      <input class="filter-new-input" id="new-category-input" type="text" placeholder="Category name…" autocomplete="off" />
      <button class="filter-new-confirm" onclick="confirmNewCategory()">Add</button>
    `;
    dropdown.appendChild(inputRow);
    setTimeout(() => {
      const inp = document.getElementById('new-category-input');
      if (inp) inp.focus();
    }, 50);

    // allow Enter key to confirm
    setTimeout(() => {
      const inp = document.getElementById('new-category-input');
      if (inp) inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') confirmNewCategory();
      });
    }, 60);
  } else {
    const newCatBtn = document.createElement('div');
    newCatBtn.className = 'filter-new-category';
    newCatBtn.innerHTML = `<span class="filter-new-category-icon">+</span><span>New category</span>`;
    newCatBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      showingNewCategoryInput = true;
      buildFilterDropdown();
    });
    dropdown.appendChild(newCatBtn);
  }

  // divider
  const div1 = document.createElement('div');
  div1.className = 'filter-divider';
  dropdown.appendChild(div1);

  // All option
  const allOpt = document.createElement('div');
  allOpt.className = 'filter-option' + (activeFilter === null ? ' active' : '');
  allOpt.innerHTML = `<span>All</span><span class="filter-option-count">${books.length}</span>`;
  allOpt.addEventListener('click', function () { applyFilter(null); });
  dropdown.appendChild(allOpt);

  // divider
  const div2 = document.createElement('div');
  div2.className = 'filter-divider';
  dropdown.appendChild(div2);

  // shelf counts from books
  const shelfCounts = {};
  books.forEach(function (b) {
    shelfCounts[b.shelf] = (shelfCounts[b.shelf] || 0) + 1;
  });

  // show all known shelves (even empty custom ones)
  const allShelves = [...new Set([...Object.keys(shelfCounts), ...customShelves])];
  allShelves.forEach(function (shelf) {
    const count = shelfCounts[shelf] || 0;
    const opt = document.createElement('div');
    opt.className = 'filter-option' + (activeFilter === shelf ? ' active' : '');
    
    const shelfSpan = document.createElement('span');
    shelfSpan.textContent = shelf;
    opt.appendChild(shelfSpan);

    const countSpan = document.createElement('span');
    countSpan.className = 'filter-option-count';
    countSpan.textContent = count;
    opt.appendChild(countSpan);

    opt.addEventListener('click', function () { applyFilter(shelf); });
    dropdown.appendChild(opt);
  });
}

function confirmNewCategory() {
  const inp = document.getElementById('new-category-input');
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) return;

  // avoid duplicates
  if (getAllShelves().map(s => s.toLowerCase()).includes(name.toLowerCase())) {
    showToast('That category already exists.');
    return;
  }

  customShelves.push(name);
  showingNewCategoryInput = false;
  showToast(`"${name}" category created`);
  buildFilterDropdown(); // rebuild to show new shelf
}

function applyFilter(shelf) {
  activeFilter = shelf;
  closeFilter();

  const filterBtn = document.getElementById('filter-btn');

  if (shelf === null) {
    filterBtn.classList.remove('filtering');
    filterBtn.textContent = 'Filter';
    // renderFilteredView replaced these sections' markup (adding a filter header); put the originals back
    document.getElementById('grid-sections').innerHTML = '<div class="grid" id="grid-books"></div>';
    document.getElementById('shelf-sections').innerHTML = '<div id="shelf-rows"></div>';
    renderGrid();
    renderShelves();
    updateBookCount();
  } else {
    filterBtn.classList.add('filtering');
    filterBtn.textContent = shelf;
    renderFilteredView(shelf);
  }
}

function renderFilteredView(shelf) {
  const filtered = books.filter(b => b.shelf === shelf);
  document.getElementById('book-count').textContent = filtered.length + ' Books';

  const gridSections = document.getElementById('grid-sections');
  gridSections.innerHTML = `
    <div class="filter-header">
      <div class="filter-header-title">${escapeHtml(shelf)}</div>
      <button class="filter-clear" onclick="applyFilter(null)">✕ Clear</button>
    </div>
    <div class="grid" id="grid-books"></div>
  `;

  const gridEl = document.getElementById('grid-books');
  filtered.forEach(function (book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = bookCardInnerHtml(book);
    fillCover(card.querySelector('.book-cover'), book, 'book-cover-placeholder', { imgFill: true });
    card.addEventListener('click', function () { openFocus(book); });
    gridEl.appendChild(card);
  });

  const shelfSections = document.getElementById('shelf-sections');
  shelfSections.innerHTML = `
    <div class="filter-header">
      <div class="filter-header-title">${escapeHtml(shelf)}</div>
      <button class="filter-clear" onclick="applyFilter(null)">✕ Clear</button>
    </div>
    <div id="shelf-rows"></div>
  `;

  const shelfRows = document.getElementById('shelf-rows');
  const row = document.createElement('div');
  row.className = 'shelf-row';
  const unit = document.createElement('div');
  unit.className = 'shelf-unit';
  const shelfBooks = document.createElement('div');
  shelfBooks.className = 'shelf-books';

  filtered.forEach(function (book) {
    shelfBooks.appendChild(createSpine(book));
  });

  unit.appendChild(shelfBooks);
  const wood = document.createElement('div');
  wood.className = 'shelf-wood';
  unit.appendChild(wood);
  row.appendChild(unit);
  shelfRows.appendChild(row);
}

// ── PROFILE MODAL ──
function openProfile() {
  document.body.classList.add('modal-open');
  document.getElementById('profile-modal').classList.add('open');

  // populate stats
  const uniqueShelves = new Set(books.map(b => b.shelf)).size;
  const rated = books.filter(b => b.rating > 0).length;
  document.getElementById('stat-books').textContent = books.length;
  document.getElementById('stat-shelves').textContent = uniqueShelves;
  document.getElementById('stat-rated').textContent = rated;
}

function closeProfile() {
  document.body.classList.remove('modal-open');
  document.getElementById('profile-modal').classList.remove('open');
}

document.getElementById('profile-modal').addEventListener('click', function (e) {
  if (e.target === this) closeProfile();
});

function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const libName = document.getElementById('profile-library-name').value.trim();

  if (name) {
    // update avatar initials
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const avatarEl = document.getElementById('profile-avatar-display');
    if (!avatarEl.querySelector('img')) avatarEl.textContent = initials;
    document.querySelector('.avatar').textContent = initials;
  }

  if (libName) {
    document.querySelector('.lib-sub').textContent = libName;
  }

  showToast('Profile saved');
  closeProfile();
}

async function signOut() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  localStorage.removeItem('myLibrary_user');
  showOnboarding();
  closeProfile();
}

function triggerAvatarUpload() {
  document.getElementById('avatar-upload').click();
}

function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const avatarEl = document.getElementById('profile-avatar-display');
    avatarEl.innerHTML = `<img src="${e.target.result}" alt="Profile photo" />`;
    document.querySelector('.avatar').style.background = 'transparent';
    document.querySelector('.avatar').innerHTML = `<img src="${e.target.result}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
  };
  reader.readAsDataURL(file);
}

document.getElementById('shelf-select').addEventListener('change', function () {
  if (this.value === '__CREATE_NEW__') {
    const newCat = prompt('Enter the name of the new category:');
    if (newCat && newCat.trim()) {
      const name = newCat.trim();
      if (getAllShelves().map(s => s.toLowerCase()).includes(name.toLowerCase())) {
        showToast('That category already exists.');
        this.value = '';
        return;
      }
      customShelves.push(name);
      refreshShelfOptions();
      this.value = name;
      showToast(`Category "${name}" created`);
    } else {
      this.value = '';
    }
  }
});

// ── SHARE LIBRARY ──
// Shared links carry the library in the URL itself (#s=...), compressed so the
// link stays short enough to paste into chats and to fit a link shortener.
function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function compressText(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompressText(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

// Only what a visitor needs to see, with short keys to keep the link small.
function toSharedBook(book) {
  const shared = { t: book.title, a: book.author, s: book.shelf, r: book.rating };
  if (book.cover) shared.c = book.cover;
  if (book.coverBg) shared.b = book.coverBg;
  if (book.coverText) shared.x = book.coverText;
  if (book.notes) shared.n = book.notes;
  return shared;
}

function fromSharedBook(shared, index) {
  return {
    id: 'shared-' + index,
    title: shared.t || 'Untitled',
    author: shared.a || '',
    shelf: shared.s,
    rating: shared.r,
    cover: shared.c || null,
    coverBg: shared.b,
    coverText: shared.x,
    notes: shared.n || '',
  };
}

async function shareLibrary() {
  const profileName = document.getElementById('profile-name');
  const profileLibName = document.getElementById('profile-library-name');
  const name = (profileName && profileName.value.trim()) || (currentUser && currentUser.name) || '';
  const libName = (profileLibName && profileLibName.value.trim()) || document.querySelector('.lib-sub').textContent;

  const payload = {
    v: 2,
    o: name,
    l: libName,
    k: books.map(toSharedBook),
    cs: customShelves,
  };

  let encoded;
  try {
    encoded = toBase64Url(await compressText(JSON.stringify(payload)));
  } catch (e) {
    console.error('Could not build share link:', e);
    showToast('Could not create a share link in this browser.');
    return;
  }

  const baseUrl = window.location.href.split('#')[0];
  const longUrl = baseUrl + '#s=' + encoded;

  // Shortening a link that points at this computer is pointless (and is.gd rejects it).
  const isLocal = isLocalAddress();
  const shortUrl = isLocal ? null : await getShortUrl(longUrl);
  const finalUrl = shortUrl || longUrl;

  const copied = await copyToClipboard(finalUrl);
  if (copied) {
    showToast(shortUrl ? 'Short share link copied to clipboard!' : 'Share link copied to clipboard!');
  } else {
    showToast('Share link ready in the box below.');
  }

  showShareConfirm(finalUrl, isLocal);
}

function isLocalAddress() {
  const host = window.location.hostname;
  return window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '' || host.endsWith('.local');
}

async function getShortUrl(longUrl) {
  try {
    const response = await fetch('https://is.gd/create.php?format=json&url=' + encodeURIComponent(longUrl));
    if (!response.ok) return null;
    const data = await response.json();
    if (data.shorturl) return data.shorturl;
  } catch (err) {
    // ignore and return null to fall back to full URL
  }
  return null;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
}

function showShareConfirm(url, isLocal) {
  const overlay = document.getElementById('share-confirm-overlay');
  const input = document.getElementById('share-confirm-input');
  const openBtn = document.getElementById('share-open-btn');
  const localNote = document.getElementById('share-local-note');

  if (!overlay || !input || !openBtn) return;

  if (localNote) localNote.style.display = isLocal ? 'block' : 'none';
  input.value = url;
  openBtn.href = url;
  overlay.classList.add('open');
  setTimeout(() => input.select(), 50);
}

function closeShareConfirm() {
  const overlay = document.getElementById('share-confirm-overlay');
  if (overlay) overlay.classList.remove('open');
}

function copyShareLink() {
  const input = document.getElementById('share-confirm-input');
  if (!input) return;
  copyToClipboard(input.value).then(function (copied) {
    if (copied) showToast('Share link copied to clipboard!');
  });
}

const shareConfirmOverlay = document.getElementById('share-confirm-overlay');
if (shareConfirmOverlay) {
  shareConfirmOverlay.addEventListener('click', function (e) {
    if (e.target === this) closeShareConfirm();
  });
}

// ── SHARED VIEW ──
let isSharedView = false;

async function readSharedPayload(hash) {
  if (hash.startsWith('#s=')) {
    const json = await decompressText(fromBase64Url(hash.slice('#s='.length)));
    const data = JSON.parse(json);
    return {
      ownerName: data.o,
      libName: data.l,
      books: Array.isArray(data.k) ? data.k.map(fromSharedBook) : null,
      customShelves: data.cs,
    };
  }
  if (hash.startsWith('#share=')) {
    // links made before compressed sharing was added
    return JSON.parse(decodeURIComponent(escape(atob(hash.slice('#share='.length)))));
  }
  return null;
}

// Resolves to true when the page was opened from a share link.
async function checkSharedView() {
  const hash = window.location.hash;
  if (!hash.startsWith('#s=') && !hash.startsWith('#share=')) return false;

  let payload;
  try {
    payload = await readSharedPayload(hash);
  } catch (e) {
    console.error('Could not read shared library:', e);
    showToast('Could not load shared library — link may be incomplete.');
    return false;
  }

  if (!payload || !Array.isArray(payload.books)) return false;

  isSharedView = true;

  books.length = 0;
  payload.books.forEach(function (b) { books.push(b); });

  if (Array.isArray(payload.customShelves)) {
    customShelves.length = 0;
    payload.customShelves.forEach(function (s) { customShelves.push(s); });
  }

  const libName = payload.libName || (payload.ownerName ? payload.ownerName + "'s Library" : 'Shared Library');
  document.querySelector('.lib-sub').textContent = libName;

  const banner = document.getElementById('shared-banner');
  document.getElementById('shared-lib-name').textContent = libName;
  banner.classList.add('visible');

  // Visitors can browse but not change anything
  ['nav-add-btn', 'nav-share-btn', 'nav-avatar', 'nav-profile-divider', 'btn-edit-book', 'btn-delete-book'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  return true;
}

// Opening a different share link in the same tab only changes the hash
window.addEventListener('hashchange', function () {
  if (window.location.hash.startsWith('#s=') || window.location.hash.startsWith('#share=')) {
    window.location.reload();
  }
});

// ── INIT ──
const sharedViewReady = checkSharedView();
renderGrid();
renderShelves();
updateBookCount();