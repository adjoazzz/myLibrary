// ── VIEW TOGGLE ──
function setView(v, el) {
  document.querySelectorAll('.toggle-group .nav-btn').forEach(function (b) {
    b.classList.remove('active');
  });
  el.classList.add('active');
  document.getElementById('grid-sections').style.display = v === 'grid' ? 'block' : 'none';
  document.getElementById('shelf-sections').style.display = v === 'shelf' ? 'block' : 'none';
}

// ── BOOK DATA (replace with Supabase fetch later) ──
const books = [
  { id: 1, title: 'Dune', author: 'Frank Herbert', cover: null, coverBg: '#D85A30', coverText: '#712B13', shelf: 'Fiction', rating: 5, notes: 'One of the greatest worldbuilding exercises ever committed to paper.' },
  { id: 2, title: 'Neuromancer', author: 'William Gibson', cover: null, coverBg: '#534AB7', coverText: '#CECBF6', shelf: 'Fiction', rating: 4, notes: '' },
  { id: 3, title: 'Grand Union', author: 'Zadie Smith', cover: null, coverBg: '#1D9E75', coverText: '#9FE1CB', shelf: 'Fiction', rating: 4, notes: 'Sharp, funny, and deeply humane.' },
  { id: 4, title: 'Ficciones', author: 'Borges', cover: null, coverBg: '#2C2C2A', coverText: '#D3D1C7', shelf: 'Fiction', rating: 5, notes: '' },
  { id: 5, title: 'Spring Snow', author: 'Mishima', cover: null, coverBg: '#BA7517', coverText: '#FAC775', shelf: 'Fiction', rating: 4, notes: '' },
  { id: 6, title: 'Veronica', author: 'Mary Gaitskill', cover: null, coverBg: '#993556', coverText: '#F4C0D1', shelf: 'Fiction', rating: 3, notes: '' },
  { id: 7, title: 'Thinking, Fast and Slow', author: 'Kahneman', cover: null, coverBg: '#185FA5', coverText: '#B5D4F4', shelf: 'Nonfiction', rating: 5, notes: 'Changed how I think about thinking.' },
  { id: 8, title: 'Sapiens', author: 'Harari', cover: null, coverBg: '#3B6D11', coverText: '#C0DD97', shelf: 'Nonfiction', rating: 4, notes: '' },
  { id: 9, title: 'Bad Blood', author: 'Carreyrou', cover: null, coverBg: '#444441', coverText: '#B4B2A9', shelf: 'Nonfiction', rating: 5, notes: 'Reads like a thriller.' },
  { id: 10, title: 'The Design of Everyday Things', author: 'Don Norman', cover: null, coverBg: '#0F6E56', coverText: '#9FE1CB', shelf: 'Design', rating: 5, notes: '' },
  { id: 11, title: 'Dieter Rams', author: 'Sophie Lovell', cover: null, coverBg: '#D85A30', coverText: '#F5C4B3', shelf: 'Design', rating: 4, notes: '' },
  { id: 12, title: 'Babel', author: 'R.F. Kuang', cover: null, coverBg: '#7A3B69', coverText: '#E8C4E0', shelf: 'Fiction', rating: 4, notes: '' },
];

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
          ? `<img src="${book.cover}" alt="${book.title}" style="width:100%;height:100%;object-fit:cover;" />`
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
        shelfEl.appendChild(spine);
      });
    });

    container.appendChild(row);
  }
}

// ── BOOK FOCUS OVERLAY ──
function openFocus(book) {
  const overlay = document.getElementById('book-focus-overlay');
  const coverFloat = document.getElementById('focus-cover');
  const card = document.getElementById('focus-card');

  // reset closing classes
  coverFloat.classList.remove('closing');
  card.classList.remove('closing');

  // populate cover
  if (book.cover) {
    coverFloat.innerHTML = `<img src="${book.cover}" alt="${book.title}" />`;
    coverFloat.style.background = '';
  } else {
    coverFloat.innerHTML = `<div class="book-focus-cover-placeholder" style="background:${book.coverBg};"><span style="color:${book.coverText};">${book.title}</span></div>`;
    coverFloat.style.background = book.coverBg;
  }

  document.getElementById('focus-title').textContent = book.title;
  document.getElementById('focus-author').textContent = book.author;
  document.getElementById('focus-shelf').textContent = book.shelf;

  // stars
  const starsEl = document.getElementById('focus-stars');
  starsEl.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement('span');
    s.textContent = '★';
    if (i <= book.rating) s.classList.add('lit');
    starsEl.appendChild(s);
  }

  // notes
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

  // trigger exit animations
  coverFloat.classList.add('closing');
  card.classList.add('closing');

  // wait for animation to finish then hide
  setTimeout(function () {
    overlay.classList.remove('open');
  }, 300);
}

document.getElementById('book-focus-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeFocus();
});

// ── ADD BOOK MODAL ──
let selectedBook = null;
let searchTimeout = null;

function openModal() {
  document.getElementById('add-book-modal').classList.add('open');
  document.getElementById('modal-search-view').style.display = 'block';
  document.getElementById('modal-detail-view').style.display = 'none';
  document.getElementById('book-search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
  
  setTimeout(() => document.getElementById('book-search-input').focus(), 100);
}

function closeModal() {
  document.getElementById('add-book-modal').classList.remove('open');
  selectedBook = null;
}

document.getElementById('add-book-modal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// ── GOOGLE BOOKS SEARCH ──
async function searchBooks(query) {
  if (!query || query.trim().length < 2) {
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('results-label').style.display = 'none';
    disableAddDetails();
    return;
  }

  document.getElementById('results-label').style.display = 'block';
  document.getElementById('search-results').innerHTML = '<div class="results-grid"><div class="search-loading">Searching...</div></div>';
  disableAddDetails();

  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=9&printType=books&key=AIzaSyDYgVj9GRej6iSb3mkmL9bDRca9sxF3k2o`
    );
    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      document.getElementById('search-results').innerHTML = '<div class="search-empty" style="display:block;">No books found. Try a different search.</div>';
      return;
    }

    renderResults(data.items);
  } catch (err) {
    document.getElementById('search-results').innerHTML =
      '<div class="results-grid"><div class="search-loading">Something went wrong. Try again.</div></div>';
  }
}

function renderResults(items) {
  const container = document.getElementById('search-results');
  const grid = document.createElement('div');
  grid.className = 'results-grid';

  items.forEach(function (item) {
    const info = item.volumeInfo;
    const title = info.title || 'Unknown Title';
    const author = info.authors ? info.authors[0] : 'Unknown Author';
    const cover = info.imageLinks
      ? info.imageLinks.thumbnail.replace('http://', 'https://')
      : null;
    const description = info.description || '';

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-cover">
        ${cover
          ? `<img src="${cover}" alt="${title}" />`
          : `<div class="result-cover-placeholder"><span>${title}</span></div>`
        }
      </div>
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

    grid.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(grid);
}

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
  document.getElementById('modal-detail-view').style.display = 'block';

  const coverEl = document.getElementById('detail-cover');
  if (selectedBook.cover) {
    coverEl.innerHTML = `<img src="${selectedBook.cover}" alt="${selectedBook.title}" />`;
  } else {
    coverEl.innerHTML = `<div class="detail-cover-placeholder"><span>${selectedBook.title}</span></div>`;
  }

  document.getElementById('detail-title').textContent = selectedBook.title;
  document.getElementById('detail-author').textContent = selectedBook.author;
  document.getElementById('book-notes').value = '';
  document.getElementById('shelf-select').value = '';
  setRating(0);
}

function goBackToSearch() {
  document.getElementById('modal-search-view').style.display = 'block';
  document.getElementById('modal-detail-view').style.display = 'none';
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
  star.addEventListener('click', function () {
    setRating(parseInt(this.dataset.value));
  });
  star.addEventListener('mouseenter', function () {
    const val = parseInt(this.dataset.value);
    document.querySelectorAll('.star').forEach(function (s) {
      s.classList.toggle('hover', parseInt(s.dataset.value) <= val);
    });
  });
  star.addEventListener('mouseleave', function () {
    document.querySelectorAll('.star').forEach(function (s) {
      s.classList.remove('hover');
    });
  });
});

// ── SAVE BOOK ──
function saveBook() {
  if (!selectedBook) return;
  const shelf = document.getElementById('shelf-select').value;
  const notes = document.getElementById('book-notes').value.trim();

  if (!shelf) {
    document.getElementById('shelf-select').classList.add('error');
    setTimeout(() => document.getElementById('shelf-select').classList.remove('error'), 1500);
    return;
  }

  // Add to local books array (replace with Supabase insert later)
  const newBook = {
    id: books.length + 1,
    title: selectedBook.title,
    author: selectedBook.author,
    cover: selectedBook.cover,
    coverBg: '#888780',
    coverText: '#F0EDE6',
    shelf,
    rating: currentRating,
    notes,
  };
  books.push(newBook);
  renderGrid();
  renderShelves();
  updateBookCount();

  showToast(`"${selectedBook.title}" added to ${shelf}`);
  closeModal();
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

// ── SEARCH INPUT DEBOUNCE ──
document.getElementById('book-search-input').addEventListener('input', function () {
  clearTimeout(searchTimeout);
  const val = this.value.trim();
  searchTimeout = setTimeout(() => searchBooks(val), 400);
});

// ── FILTER ──
let activeFilter = null;

function toggleFilter() {
  const dropdown = document.getElementById('filter-dropdown');
  const isOpen = dropdown.classList.contains('open');
  if (isOpen) {
    closeFilter();
  } else {
    buildFilterDropdown();
    dropdown.classList.add('open');
  }
}

function closeFilter() {
  document.getElementById('filter-dropdown').classList.remove('open');
}

// close when clicking outside
document.addEventListener('click', function (e) {
  const wrapper = document.querySelector('.filter-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    closeFilter();
  }
});

function buildFilterDropdown() {
  const dropdown = document.getElementById('filter-dropdown');
  dropdown.innerHTML = '';

  // "All" option first
  const allOpt = document.createElement('div');
  allOpt.className = 'filter-option' + (activeFilter === null ? ' active' : '');
  allOpt.innerHTML = `
    <span>All</span>
    <span class="filter-option-count">${books.length}</span>
  `;
  allOpt.addEventListener('click', function () {
    applyFilter(null);
  });
  dropdown.appendChild(allOpt);

  // divider
  const div = document.createElement('div');
  div.className = 'filter-divider';
  dropdown.appendChild(div);

  // get unique shelves with counts
  const shelfCounts = {};
  books.forEach(function (b) {
    shelfCounts[b.shelf] = (shelfCounts[b.shelf] || 0) + 1;
  });

  Object.entries(shelfCounts).forEach(function ([shelf, count]) {
    const opt = document.createElement('div');
    opt.className = 'filter-option' + (activeFilter === shelf ? ' active' : '');
    opt.innerHTML = `
      <span>${shelf}</span>
      <span class="filter-option-count">${count}</span>
    `;
    opt.addEventListener('click', function () {
      applyFilter(shelf);
    });
    dropdown.appendChild(opt);
  });
}

function applyFilter(shelf) {
  activeFilter = shelf;
  closeFilter();

  const filterBtn = document.getElementById('filter-btn');

  if (shelf === null) {
    // clear filter
    filterBtn.classList.remove('filtering');
    filterBtn.textContent = 'Filter';
    renderGrid();
    renderShelves();
    updateBookCount();
  } else {
    // mark button as active
    filterBtn.classList.add('filtering');
    filterBtn.textContent = shelf;
    renderFilteredView(shelf);
  }
}

function renderFilteredView(shelf) {
  const filtered = books.filter(b => b.shelf === shelf);

  // update book count
  document.getElementById('book-count').textContent = filtered.length + ' Books';

  // update grid
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

  // update shelf view
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

// ── INIT ──
renderGrid();
renderShelves();
updateBookCount();