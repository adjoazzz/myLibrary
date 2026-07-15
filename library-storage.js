(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.LibraryStorage = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function getStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }

    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }

    return null;
  }

  function getBooksStorageKey(userId) {
    return `myLibrary_books_${userId}`;
  }

  function loadBooksForUser(user, fallbackBooks) {
    const storage = getStorage();

    if (!user || !storage) {
      return Array.isArray(fallbackBooks) ? fallbackBooks.slice() : [];
    }

    const storageKey = getBooksStorageKey(user.id);

    try {
      const storedValue = storage.getItem(storageKey);
      if (storedValue) {
        const parsed = JSON.parse(storedValue);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }

      const fallback = Array.isArray(fallbackBooks) ? fallbackBooks : [];
      storage.setItem(storageKey, JSON.stringify(fallback));
      return fallback.slice();
    } catch (error) {
      const fallback = Array.isArray(fallbackBooks) ? fallbackBooks : [];
      return fallback.slice();
    }
  }

  function saveBooksForUser(user, books) {
    const storage = getStorage();

    if (!user || !storage) {
      return false;
    }

    try {
      storage.setItem(getBooksStorageKey(user.id), JSON.stringify(books || []));
      return true;
    } catch (error) {
      return false;
    }
  }

  return {
    getBooksStorageKey,
    loadBooksForUser,
    saveBooksForUser,
  };
});
