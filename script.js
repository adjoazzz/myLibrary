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
}


async function initializeAuthState() {
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
      showToast('Sign in failed. Please try again.');
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

function initializeGoogleSignIn() {
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: '684826739629-p96i1jgjelionebkggt1s733pd239894.apps.googleusercontent.com',
      callback: onGoogleSignIn,
    });
    googleSignInReady = true;
    return true;
  }
  googleSignInReady = false;
  return false;
}

// Initialize Google Sign-In button
window.addEventListener('load', function () {
  const googleBtn = document.getElementById('google-signin-btn');
  initializeGoogleSignIn();

  if (googleBtn) {
    googleBtn.addEventListener('click', function () {
      // If the user is already signed in, just continue to their library/empty state
      if (currentUser) {
        updatePageState();
        return;
      }
      if (!googleSignInReady) {
        showToast('Google sign-in is not ready yet. Refresh and try again.');
        return;
      }
      google.accounts.id.prompt();
    });
  }

  initializeAuthState();
  bindModalTriggers();
  bindAddBookButtons();
  checkSharedView();
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

// ── RENDER GRID ──
function renderGrid() {
  const container = document.getElementById('grid-books');
  container.innerHTML = '';
  books.forEach(function (book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="book-cover">
        ${book.cover
          ? `<img src="${book.cover}" alt="${book.title}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div class=\'book-cover-placeholder\' style=\'background:${book.coverBg};\' ><span style=\'color:${book.coverText};\' >${book.title}</span></div>'" />`
          : `<div class="book-cover-placeholder" style="background:${book.coverBg};"><span style="color:${book.coverText};">${book.title}</span></div>`
        }
      </div>
      <div class="book-title">${book.title}</div>
      <div class="book-author">${book.author}</div>
    `;
    card.addEventListener('click', function () { openFocus(book); });
    container.appendChild(card);
  });
}

// ── RENDER SHELVES ──
function renderShelves() {
  const shelves = {};
  books.forEach(function (book) {
    if (!shelves[book.shelf]) shelves[book.shelf] = [];
    shelves[book.shelf].push(book);
  });

  const container = document.getElementById('shelf-rows');
  container.innerHTML = '';

  const shelfNames = Object.keys(shelves);
  for (let i = 0; i < shelfNames.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'shelf-row';

    [shelfNames[i], shelfNames[i + 1]].forEach(function (name) {
      if (!name) return;
      const unit = document.createElement('div');
      unit.className = 'shelf-unit';
      unit.innerHTML = `
        <div class="section-label">${name}</div>
        <div class="shelf-books" id="shelf-${name}"></div>
        <div class="shelf-wood"></div>
      `;
      row.appendChild(unit);

      const shelfEl = unit.querySelector('.shelf-books');
      shelves[name].forEach(function (book) {
        const spine = document.createElement('div');
        spine.className = 'spine';
        // use CSS variables so the stylesheet can layer texture/effects while
        // still using the book's chosen colors
        spine.innerHTML = `
          <div class="spine-inner">
            <div class="spine-front" style="--spine-bg:${book.coverBg}; --spine-text:${book.coverText};">
              <span>${book.title}</span>
            </div>
            <div class="spine-side" style="--spine-bg:${book.coverBg};"></div>
            <div class="spine-top"></div>
            <div class="spine-back" style="--spine-bg:${book.coverBg}; --spine-text:${book.coverText};">
              ${book.cover
                ? `<img src="${book.cover}" alt="${book.title}" />`
                : `<div class="spine-back-placeholder" style="--spine-bg:${book.coverBg};"><span style="--spine-text:${book.coverText};">${book.title}</span></div>`
              }
            </div>
          </div>
        `;
        spine.addEventListener('click', function () { openFocus(book); });
        shelfEl.appendChild(spine);
      });
    });

    container.appendChild(row);
  }
}

// ── BOOK FOCUS OVERLAY ──
let focusedBook = null;

function openFocus(book) {
  focusedBook = book;
  const overlay = document.getElementById('book-focus-overlay');
  const coverFloat = document.getElementById('focus-cover');
  const card = document.getElementById('focus-card');

  coverFloat.classList.remove('closing');
  card.classList.remove('closing');

  if (book.cover) {
    coverFloat.innerHTML = `<img src="${book.cover}" alt="${book.title}" onerror="this.parentElement.innerHTML='<div class=\'book-focus-cover-placeholder\' style=\'background:${book.coverBg};\' ><span style=\'color:${book.coverText};\' >${book.title}</span></div>'; this.parentElement.style.background='${book.coverBg}';" />`;
    coverFloat.style.background = '';
  } else {
    coverFloat.innerHTML = `<div class="book-focus-cover-placeholder" style="background:${book.coverBg};"><span style="color:${book.coverText};">${book.title}</span></div>`;
    coverFloat.style.background = book.coverBg;
  }

  document.getElementById('focus-title').textContent = book.title;
  document.getElementById('focus-author').textContent = book.author;
  document.getElementById('focus-shelf').textContent = book.shelf;

  const starsEl = document.getElementById('focus-stars');
  starsEl.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement('span');
    s.textContent = '★';
    if (i <= book.rating) s.classList.add('lit');
    starsEl.appendChild(s);
  }

  const notesEl = document.getElementById('focus-notes');
  if (book.notes) {
    notesEl.textContent = '"' + book.notes + '"';
    notesEl.classList.remove('empty');
  } else {
    notesEl.textContent = 'No notes added yet.';
    notesEl.classList.add('empty');
  }

  overlay.classList.add('open');
}

function closeFocus() {
  const overlay = document.getElementById('book-focus-overlay');
  const coverFloat = document.getElementById('focus-cover');
  const card = document.getElementById('focus-card');
  coverFloat.classList.add('closing');
  card.classList.add('closing');
  setTimeout(function () { overlay.classList.remove('open'); }, 300);
}

function deleteFocusedBook() {
  if (!focusedBook) return;

  const confirmDelete = confirm(`Are you sure you want to delete "${focusedBook.title}" from your library?`);
  if (!confirmDelete) return;

  const index = books.findIndex(b => b.id === focusedBook.id);
  if (index !== -1) {
    const title = focusedBook.title;
    books.splice(index, 1);
    try { persistBooks(); } catch (e) {}
    closeFocus();
    applyFilter(activeFilter);
    showToast(`"${title}" deleted from library`);
  }
}

document.getElementById('book-focus-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeFocus();
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

  if (!query || query.trim().length < 2) {
    container.innerHTML = '';
    labelEl.style.display = 'none';
    disableAddDetails();
    return;
  }

  labelEl.style.display = 'block';
  disableAddDetails();

  // ── Local matches (instant) ──
  const q = query.trim().toLowerCase();
  const localMatches = books.filter(function (b) {
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
  });

  container.innerHTML = '';

  if (localMatches.length > 0) {
    const localSection = document.createElement('div');
    localSection.className = 'results-section';

    const localLabel = document.createElement('div');
    localLabel.className = 'results-section-label';
    localLabel.textContent = 'In your library';
    localSection.appendChild(localLabel);

    const localGrid = document.createElement('div');
    localGrid.className = 'results-grid';
    localMatches.forEach(function (book) {
      const card = document.createElement('div');
      card.className = 'result-card';
      const coverHtml = book.cover
        ? `<img src="${book.cover}" alt="${book.title}" onerror="this.parentElement.innerHTML='<div class=\'result-cover-placeholder\'><span>${book.title.replace(/'/g, "&#39;")}</span></div>'" />`
        : `<div class="result-cover-placeholder" style="background:${book.coverBg};"><span style="color:${book.coverText};">${book.title}</span></div>`;
      card.innerHTML = `
        <div class="result-cover">${coverHtml}</div>
        <div class="result-info">
          <div class="result-title">${book.title}</div>
          <div class="result-author">${book.author}</div>
        </div>
      `;
      card.addEventListener('click', function () {
        document.querySelectorAll('.result-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedBook = {
          title: book.title,
          author: book.author,
          cover: book.cover,
          description: '',
        };
        enableAddDetails();
      });
      localGrid.appendChild(card);
    });
    localSection.appendChild(localGrid);
    container.appendChild(localSection);
  }

  // ── Google Books (async) ──
  const googleSection = document.createElement('div');
  googleSection.className = 'results-section';

  const googleLabel = document.createElement('div');
  googleLabel.className = 'results-section-label';
  googleLabel.textContent = 'From Google Books';
  googleSection.appendChild(googleLabel);

  const googleGrid = document.createElement('div');
  googleGrid.className = 'results-grid';
  googleGrid.innerHTML = '<div class="search-loading" style="grid-column:1/-1">Searching…</div>';
  googleSection.appendChild(googleGrid);
  container.appendChild(googleSection);

  try {
      let res = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent('intitle:' + query)}&maxResults=9&printType=books&key=AIzaSyDYgVj9GRej6iSb3mkmL9bDRca9sxF3k2o`,
            { signal }
          );

        // if Google's server had a brief hiccup, wait a bit and try one more time
        if (res.status === 503) {
          await new Promise(resolve => setTimeout(resolve, 800));
        res = await fetch(
                `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent('intitle:' + query)}&maxResults=9&printType=books&key=AIzaSyDYgVj9GRej6iSb3mkmL9bDRca9sxF3k2o`,
                { signal }
              );
        }

      const data = await res.json();

          // if a newer search has started since this one began, ignore this stale result
          if (thisSearchId !== latestSearchId) return;

          googleGrid.innerHTML = '';
          if (!data.items || data.items.length === 0) {
        googleGrid.innerHTML = '<div class="search-loading" style="grid-column:1/-1">No results from Google Books.</div>';
        return;
      }
    data.items.forEach(function (item) {
      const info = item.volumeInfo;
      const title = info.title || 'Unknown Title';
      const author = info.authors ? info.authors[0] : 'Unknown Author';
      const cover = getCoverUrl(info.imageLinks);
      const description = info.description || '';

      const card = document.createElement('div');
      card.className = 'result-card';
      const coverHtml = cover
        ? `<img src="${cover}" alt="${title}" onerror="this.parentElement.innerHTML='<div class=\'result-cover-placeholder\'><span>${title.replace(/'/g, "&#39;")}</span></div>'" />`
        : `<div class="result-cover-placeholder"><span>${title}</span></div>`;
      card.innerHTML = `
        <div class="result-cover">${coverHtml}</div>
        <div class="result-info">
          <div class="result-title">${title}</div>
          <div class="result-author">${author}</div>
        </div>
      `;
      card.addEventListener('click', function () {
        document.querySelectorAll('.result-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedBook = { title, author, cover, description };
        enableAddDetails();
      });
      googleGrid.appendChild(card);
    });
} catch (err) {
    if (err.name === 'AbortError') return; // this search was cancelled because a newer one started - not a real error
    googleGrid.innerHTML = '<div class="search-loading" style="grid-column:1/-1">Could not reach Google Books. Check your connection.</div>';
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
function showDetailView() {
  if (!selectedBook) return;
  document.getElementById('modal-search-view').style.display = 'none';
  document.getElementById('modal-detail-view').style.display = 'flex';

  const coverEl = document.getElementById('detail-cover');
  if (selectedBook.cover) {
    coverEl.innerHTML = `<img src="${selectedBook.cover}" alt="${selectedBook.title}" onerror="this.parentElement.innerHTML='<div class=\'detail-cover-placeholder\'><span>${selectedBook.title.replace(/'/g, "&#39;")}</span></div>'" />`;
  } else {
    coverEl.innerHTML = `<div class="detail-cover-placeholder"><span>${selectedBook.title}</span></div>`;
  }

  document.getElementById('detail-title').textContent = selectedBook.title;
  document.getElementById('detail-author').textContent = selectedBook.author;
  document.getElementById('book-notes').value = '';
  document.getElementById('shelf-select').value = '';
  refreshShelfOptions();
  setRating(0);
}

function goBackToSearch() {
  document.getElementById('modal-search-view').style.display = 'flex';
  document.getElementById('modal-detail-view').style.display = 'none';
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
  const q = query.toLowerCase();
  const filtered = q.length < 1
    ? books
    : books.filter(function (b) {
        return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
      });

  // Update count display
  const countEl = document.getElementById('book-count');
  if (q.length > 0) {
    countEl.textContent = filtered.length + (filtered.length === 1 ? ' Result' : ' Results');
  } else {
    countEl.textContent = books.length + ' Books';
  }

  // Re-render with filtered set
  const gridContainer = document.getElementById('grid-books');
  if (gridContainer) {
    gridContainer.innerHTML = '';
    filtered.forEach(function (book) {
      const card = document.createElement('div');
      card.className = 'book-card';
      const coverBg = book.coverBg || '#888780';
      const coverText = book.coverText || '#F0EDE6';
      card.innerHTML = `
        <div class="book-cover">
          ${book.cover
            ? `<img src="${book.cover}" alt="${book.title}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div class=\'book-cover-placeholder\' style=\'background:${coverBg};\' ><span style=\'color:${coverText};\' >${book.title}</span></div>'" />`
            : `<div class="book-cover-placeholder" style="background:${coverBg};"><span style="color:${coverText};">${book.title}</span></div>`
          }
        </div>
        <div class="book-title">${book.title}</div>
        <div class="book-author">${book.author}</div>
      `;
      card.addEventListener('click', function () { openFocus(book); });
      gridContainer.appendChild(card);
    });
  }

  if (filtered.length === 0 && q.length > 0) {
    if (gridContainer) {
      gridContainer.innerHTML = '<div class="library-empty-search">No books match "' + query + '"</div>';
    }
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
      <div class="filter-header-title">${shelf}</div>
      <button class="filter-clear" onclick="applyFilter(null)">✕ Clear</button>
    </div>
    <div class="grid" id="grid-books"></div>
  `;

  const gridEl = document.getElementById('grid-books');
  filtered.forEach(function (book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="book-cover">
        ${book.cover
          ? `<img src="${book.cover}" alt="${book.title}" style="width:100%;height:100%;object-fit:cover;" />`
          : `<div class="book-cover-placeholder" style="background:${book.coverBg};"><span style="color:${book.coverText};">${book.title}</span></div>`
        }
      </div>
      <div class="book-title">${book.title}</div>
      <div class="book-author">${book.author}</div>
    `;
    card.addEventListener('click', function () { openFocus(book); });
    gridEl.appendChild(card);
  });

  const shelfSections = document.getElementById('shelf-sections');
  shelfSections.innerHTML = `
    <div class="filter-header">
      <div class="filter-header-title">${shelf}</div>
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
    const spine = document.createElement('div');
    spine.className = 'spine';
    spine.innerHTML = `
      <div class="spine-inner">
        <div class="spine-front" style="background:${book.coverBg};">
          <span style="color:${book.coverText};">${book.title}</span>
        </div>
        <div class="spine-side" style="background:${book.coverBg};"></div>
        <div class="spine-top"></div>
        <div class="spine-back" style="background:${book.coverBg};">
          ${book.cover
            ? `<img src="${book.cover}" alt="${book.title}" />`
            : `<div class="spine-back-placeholder" style="background:${book.coverBg};"><span style="color:${book.coverText};">${book.title}</span></div>`
          }
        </div>
      </div>
    `;
    spine.addEventListener('click', function () { openFocus(book); });
    shelfBooks.appendChild(spine);
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
async function shareLibrary() {
  const name = document.getElementById('profile-name')
    ? document.getElementById('profile-name').value.trim() || 'Nana Adjoa'
    : 'Nana Adjoa';
  const libName = document.getElementById('profile-library-name')
    ? document.getElementById('profile-library-name').value.trim() || document.querySelector('.lib-sub').textContent
    : document.querySelector('.lib-sub').textContent;

  const payload = {
    v: 1,
    ownerName: name,
    libName: libName,
    books: books,
    customShelves: customShelves,
  };

  let encoded;
  try {
    encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch (e) {
    showToast('Library is too large to share as a link.');
    return;
  }

  const baseUrl = (window.location.protocol === 'file:' || window.location.origin === 'null')
    ? window.location.href.split('#')[0]
    : window.location.origin + window.location.pathname;
  const longUrl = baseUrl + '#share=' + encoded;

  if (longUrl.length > 64000) {
    showToast('Library is too large to share as a link.');
    return;
  }

  const shortUrl = await getShortUrl(longUrl);
  const finalUrl = shortUrl || longUrl;

  const copied = await copyToClipboard(finalUrl);
  if (copied) {
    showToast(shortUrl ? 'Short share link copied to clipboard!' : 'Share link copied to clipboard!');
  } else {
    showToast('Share link ready in the box below.');
  }

  showShareConfirm(finalUrl);
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

function showShareConfirm(url) {
  const overlay = document.getElementById('share-confirm-overlay');
  const input = document.getElementById('share-confirm-input');
  const openBtn = document.getElementById('share-open-btn');

  if (!overlay || !input || !openBtn) return;

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
function checkSharedView() {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return;

  const encoded = hash.slice('#share='.length);
  let payload;
  try {
    payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch (e) {
    showToast('Could not load shared library — link may be corrupted.');
    return;
  }

  if (!payload || !Array.isArray(payload.books)) return;

  // Load the shared books
  books.length = 0;
  payload.books.forEach(function (b) { books.push(b); });

  if (Array.isArray(payload.customShelves)) {
    customShelves.length = 0;
    payload.customShelves.forEach(function (s) { customShelves.push(s); });
  }

  // Update the page header
  const libName = payload.libName || (payload.ownerName ? payload.ownerName + "'s Library" : 'Shared Library');
  document.querySelector('.lib-sub').textContent = libName;

  // Show the banner
  const banner = document.getElementById('shared-banner');
  document.getElementById('shared-lib-name').textContent = libName;
  banner.classList.add('visible');

  // Hide editing controls
  const addBtn = document.getElementById('nav-add-btn');
  const shareBtn = document.getElementById('nav-share-btn');
  const avatar = document.getElementById('nav-avatar');
  const divider = document.getElementById('nav-profile-divider');
  if (addBtn) addBtn.style.display = 'none';
  if (shareBtn) shareBtn.style.display = 'none';
  if (avatar) avatar.style.display = 'none';
  if (divider) divider.style.display = 'none';
}

// ── INIT ──
checkSharedView();
renderGrid();
renderShelves();
updateBookCount();