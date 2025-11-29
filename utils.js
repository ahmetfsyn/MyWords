// Utility functions for API calls and IndexedDB Storage

const TURENG_URL = 'https://tureng.com/en/turkish-english/';
const DB_NAME = 'MyWordsDB';
const DB_VERSION = 1;

// IndexedDB Manager
class DBManager {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create lists object store
                if (!db.objectStoreNames.contains('lists')) {
                    const listsStore = db.createObjectStore('lists', { keyPath: 'id' });
                    listsStore.createIndex('name', 'name', { unique: false });
                }

                // Create words object store
                if (!db.objectStoreNames.contains('words')) {
                    const wordsStore = db.createObjectStore('words', { keyPath: 'id' });
                    wordsStore.createIndex('listId', 'listId', { unique: false });
                    wordsStore.createIndex('word', 'word', { unique: false });
                }
            };
        });
    }

    async getAllLists() {
        const transaction = this.db.transaction(['lists'], 'readonly');
        const store = transaction.objectStore('lists');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getWordsByListId(listId) {
        const transaction = this.db.transaction(['words'], 'readonly');
        const store = transaction.objectStore('words');
        const index = store.index('listId');
        return new Promise((resolve, reject) => {
            const request = index.getAll(listId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async addList(list) {
        const transaction = this.db.transaction(['lists'], 'readwrite');
        const store = transaction.objectStore('lists');
        return new Promise((resolve, reject) => {
            const request = store.add(list);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteList(listId) {
        const transaction = this.db.transaction(['lists', 'words'], 'readwrite');
        const listsStore = transaction.objectStore('lists');
        const wordsStore = transaction.objectStore('words');
        const wordsIndex = wordsStore.index('listId');

        return new Promise((resolve, reject) => {
            // Delete the list
            listsStore.delete(listId);

            // Delete all words in this list
            const request = wordsIndex.openCursor(IDBKeyRange.only(listId));
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    wordsStore.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async addWord(word) {
        const transaction = this.db.transaction(['words'], 'readwrite');
        const store = transaction.objectStore('words');
        return new Promise((resolve, reject) => {
            const request = store.add(word);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteWord(wordId) {
        const transaction = this.db.transaction(['words'], 'readwrite');
        const store = transaction.objectStore('words');
        return new Promise((resolve, reject) => {
            const request = store.delete(wordId);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async findWordInList(listId, wordText) {
        const words = await this.getWordsByListId(listId);
        return words.find(w => w.word === wordText);
    }
}

// Initialize DB Manager
const dbManager = new DBManager();
let dbInitialized = false;

const Utils = {
    // Initialize database
    async initDB() {
        if (!dbInitialized) {
            await dbManager.init();

            // Check if we need to create default list
            const lists = await dbManager.getAllLists();
            if (lists.length === 0) {
                await dbManager.addList({
                    id: 'default',
                    name: 'My Words',
                    createdAt: Date.now()
                });
            }

            dbInitialized = true;
        }
        return dbInitialized;
    },

    // Fetch word definition from Tureng
    async fetchDefinition(word) {
        try {
            const response = await fetch(`${TURENG_URL}${encodeURIComponent(word)}`);
            if (!response.ok) {
                throw new Error('Word not found or network error');
            }
            const htmlText = await response.text();
            return this.parseTurengHTML(htmlText, word);
        } catch (error) {
            console.error('Error fetching definition:', error);
            return null;
        }
    },

    parseTurengHTML(html, word) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const table = doc.getElementById('englishResultsTable');

        if (!table) return null;

        const results = [];
        const rows = table.querySelectorAll('tr');

        // Skip header row, take top 5 results
        for (let i = 0; i < rows.length && results.length < 5; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td');
            if (cells.length < 4) continue;

            const category = cells[1].textContent.trim();
            const enTerm = cells[2].querySelector('a')?.textContent.trim() || cells[2].textContent.trim();
            const trTerm = cells[3].querySelector('a')?.textContent.trim() || cells[3].textContent.trim();

            if (trTerm && enTerm) {
                results.push({
                    category,
                    turkish: trTerm,
                    english: enTerm
                });
            }
        }

        if (results.length === 0) return null;

        return {
            word: word,
            phonetic: '',
            meanings: results
        };
    },

    // Get all lists with their words
    async getLists() {
        await this.initDB();
        const lists = await dbManager.getAllLists();

        // Fetch words for each list
        const listsWithWords = await Promise.all(
            lists.map(async (list) => {
                const words = await dbManager.getWordsByListId(list.id);
                return {
                    ...list,
                    words: words.map(w => ({
                        word: w.word,
                        meanings: w.meanings,
                        phonetic: w.phonetic || ''
                    }))
                };
            })
        );

        return listsWithWords;
    },

    // Create a new list
    async createList(name) {
        await this.initDB();
        const newList = {
            id: Date.now().toString(),
            name: name,
            createdAt: Date.now()
        };
        await dbManager.addList(newList);
        return { ...newList, words: [] };
    },

    // Add word to a list
    async addWordToList(listId, wordData) {
        await this.initDB();

        // Check if word already exists in the list
        const existingWord = await dbManager.findWordInList(listId, wordData.word);
        if (existingWord) {
            return false;
        }

        const wordEntry = {
            id: `${listId}_${Date.now()}`,
            listId: listId,
            word: wordData.word,
            meanings: wordData.meanings,
            phonetic: wordData.phonetic || '',
            createdAt: Date.now()
        };

        await dbManager.addWord(wordEntry);
        return true;
    },

    // Delete word from a list
    async deleteWordFromList(listId, wordText) {
        await this.initDB();
        const word = await dbManager.findWordInList(listId, wordText);
        if (word) {
            await dbManager.deleteWord(word.id);
            return true;
        }
        return false;
    },

    // Delete a list
    async deleteList(listId) {
        await this.initDB();
        await dbManager.deleteList(listId);
        return true;
    }
};
