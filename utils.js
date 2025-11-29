// Utility functions for API calls and Storage

const TURENG_URL = 'https://tureng.com/en/turkish-english/';

const Utils = {
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
            // Tureng rows: [hidden, category, turkish, english, ...]
            // We need to be careful with column indices.
            // Usually:
            // td[1] -> Category
            // td[2] -> Source Language (English)
            // td[3] -> Target Language (Turkish)

            const cells = row.querySelectorAll('td');
            if (cells.length < 4) continue; // Skip headers or malformed rows

            // Check if it's a valid result row (sometimes there are ads or spacers)
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
            phonetic: '', // Tureng might have audio but scraping phonetic text is harder
            meanings: results // We will adapt the UI to show these
        };
    },

    // Get all lists
    async getLists() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['lists'], (result) => {
                resolve(result.lists || []);
            });
        });
    },

    // Save a new list
    async createList(name) {
        const lists = await this.getLists();
        const newList = {
            id: Date.now().toString(),
            name: name,
            words: []
        };
        lists.push(newList);
        await chrome.storage.local.set({ lists });
        return newList;
    },

    // Add word to a list
    async addWordToList(listId, wordData) {
        const lists = await this.getLists();
        const listIndex = lists.findIndex(l => l.id === listId);

        if (listIndex !== -1) {
            // Check if word already exists in the list
            const wordExists = lists[listIndex].words.some(w => w.word === wordData.word);
            if (!wordExists) {
                lists[listIndex].words.unshift(wordData); // Add to top
                await chrome.storage.local.set({ lists });
                return true;
            }
        }
        return false;
    },

    // Delete word from a list
    async deleteWordFromList(listId, word) {
        const lists = await this.getLists();
        const listIndex = lists.findIndex(l => l.id === listId);

        if (listIndex !== -1) {
            lists[listIndex].words = lists[listIndex].words.filter(w => w.word !== word);
            await chrome.storage.local.set({ lists });
            return true;
        }
        return false;
    },

    // Delete a list
    async deleteList(listId) {
        let lists = await this.getLists();
        lists = lists.filter(l => l.id !== listId);
        await chrome.storage.local.set({ lists });
        return true;
    }
};
