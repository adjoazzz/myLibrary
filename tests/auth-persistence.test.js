const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBooksForUser, saveBooksForUser } = require('../library-storage');

class FakeStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }
}

global.localStorage = new FakeStorage();

test('loadBooksForUser preserves an existing user library', () => {
  const user = { id: 'user-123' };
  const existingBooks = [{ id: 1, title: 'Dune', shelf: 'Fiction' }];

  saveBooksForUser(user, existingBooks);
  const loadedBooks = loadBooksForUser(user, []);

  assert.deepEqual(loadedBooks, existingBooks);
});
