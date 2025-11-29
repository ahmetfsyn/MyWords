document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const navSearch = document.getElementById('nav-search');
    const navLists = document.getElementById('nav-lists');
    const viewSearch = document.getElementById('view-search');
    const viewLists = document.getElementById('view-lists');

    const wordInput = document.getElementById('word-input');
    const searchBtn = document.getElementById('search-btn');
    const resultContainer = document.getElementById('result-container');
    const searchError = document.getElementById('search-error');

    const wordTitle = document.getElementById('word-title');
    const wordPhonetic = document.getElementById('word-phonetic');
    const wordMeanings = document.getElementById('word-meanings');

    const listSelect = document.getElementById('list-select');
    const addWordBtn = document.getElementById('add-word-btn');

    const newListInput = document.getElementById('new-list-input');
    const createListBtn = document.getElementById('create-list-btn');
    const listsContainer = document.getElementById('lists-container');

    // List Detail Elements
    const viewListDetail = document.getElementById('view-list-detail');
    const backToListsBtn = document.getElementById('back-to-lists-btn');
    const detailListName = document.getElementById('detail-list-name');
    const listWordsContainer = document.getElementById('list-words-container');

    // Modal Elements
    const modalOverlay = document.getElementById('custom-modal');
    const modalMessage = document.getElementById('modal-message');
    const modalActions = document.getElementById('modal-actions');

    let currentWordData = null;

    // Modal Functions
    function showModal(message, type = 'alert', onConfirm = null) {
        modalMessage.textContent = message;
        modalActions.innerHTML = '';

        if (type === 'confirm') {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'modal-btn modal-btn-secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = closeModal;

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'modal-btn modal-btn-primary';
            confirmBtn.textContent = 'Confirm';
            confirmBtn.onclick = () => {
                closeModal();
                if (onConfirm) onConfirm();
            };

            modalActions.appendChild(cancelBtn);
            modalActions.appendChild(confirmBtn);
        } else {
            const okBtn = document.createElement('button');
            okBtn.className = 'modal-btn modal-btn-primary';
            okBtn.textContent = 'OK';
            okBtn.onclick = closeModal;
            modalActions.appendChild(okBtn);
        }

        modalOverlay.classList.add('active');
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    // Navigation Logic
    navSearch.addEventListener('click', () => switchView('search'));
    navLists.addEventListener('click', () => {
        switchView('lists');
        renderLists();
    });

    backToListsBtn.addEventListener('click', () => {
        switchView('lists');
        renderLists();
    });

    function switchView(viewName) {
        viewSearch.classList.add('hidden');
        viewLists.classList.add('hidden');
        viewListDetail.classList.add('hidden');

        navSearch.classList.remove('active');
        navLists.classList.remove('active');

        if (viewName === 'search') {
            navSearch.classList.add('active');
            viewSearch.classList.remove('hidden');
            loadListOptions();
        } else if (viewName === 'lists') {
            navLists.classList.add('active');
            viewLists.classList.remove('hidden');
        } else if (viewName === 'detail') {
            navLists.classList.add('active');
            viewListDetail.classList.remove('hidden');
        }
    }

    // Search Logic
    searchBtn.addEventListener('click', performSearch);
    wordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    async function performSearch() {
        const word = wordInput.value.trim();
        if (!word) return;

        searchError.classList.add('hidden');
        resultContainer.classList.add('hidden');

        const data = await Utils.fetchDefinition(word);

        if (data) {
            currentWordData = data;
            renderResult(currentWordData);
        } else {
            searchError.textContent = 'Word not found.';
            searchError.classList.remove('hidden');
            currentWordData = null;
        }
    }

    function renderResult(data) {
        wordTitle.textContent = data.word;
        wordPhonetic.textContent = data.phonetic || '';
        wordMeanings.innerHTML = '';

        if (data.meanings && data.meanings.length > 0) {
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.marginTop = '0.5rem';

            data.meanings.forEach(m => {
                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid #374151'; // Dark border

                row.innerHTML = `
          <td style="padding: 4px; color: #9ca3af; font-size: 0.8em; width: 20%;">${m.category}</td>
          <td style="padding: 4px; font-weight: 500; color: #f9fafb;">${m.turkish}</td>
        `;
                table.appendChild(row);
            });
            wordMeanings.appendChild(table);
        }

        resultContainer.classList.remove('hidden');
    }

    // List Management Logic
    async function loadListOptions() {
        const lists = await Utils.getLists();
        listSelect.innerHTML = '';
        lists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = list.name;
            listSelect.appendChild(option);
        });
    }

    addWordBtn.addEventListener('click', async () => {
        if (!currentWordData) return;

        const listId = listSelect.value;
        const success = await Utils.addWordToList(listId, currentWordData);

        if (success) {
            const originalText = addWordBtn.textContent;
            addWordBtn.textContent = 'Saved!';
            addWordBtn.style.backgroundColor = '#10b981';
            setTimeout(() => {
                addWordBtn.textContent = originalText;
                addWordBtn.style.backgroundColor = '';
            }, 2000);
        } else {
            showModal('Word already exists in this list.', 'alert');
        }
    });

    createListBtn.addEventListener('click', async () => {
        const name = newListInput.value.trim();
        if (!name) return;

        await Utils.createList(name);
        newListInput.value = '';
        renderLists();
    });

    async function renderLists() {
        const lists = await Utils.getLists();
        listsContainer.innerHTML = '';

        lists.forEach(list => {
            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `
        <span class="list-name">${list.name}</span>
        <div style="display: flex; align-items: center;">
          <span class="list-count">${list.words.length}</span>
          ${list.id !== 'default' ? '<button class="delete-list-btn" data-id="' + list.id + '">×</button>' : ''}
        </div>
      `;

            // Click to view details
            el.addEventListener('click', () => {
                renderListDetails(list);
            });

            if (list.id !== 'default') {
                el.querySelector('.delete-list-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    showModal(`Delete list "${list.name}"?`, 'confirm', async () => {
                        await Utils.deleteList(list.id);
                        renderLists();
                    });
                });
            }

            listsContainer.appendChild(el);
        });
    }

    function renderListDetails(list) {
        detailListName.textContent = list.name;
        listWordsContainer.innerHTML = '';

        if (list.words.length === 0) {
            listWordsContainer.innerHTML = '<p style="text-align: center; color: #9ca3af;">No words saved yet.</p>';
        } else {
            list.words.forEach(wordData => {
                const item = document.createElement('div');
                item.className = 'saved-word-item';

                let meaningsHtml = '';
                if (wordData.meanings && wordData.meanings.length > 0) {
                    meaningsHtml = '<div class="saved-word-meanings"><table>';
                    // Show top 3 meanings to save space
                    wordData.meanings.slice(0, 3).forEach(m => {
                        meaningsHtml += `
              <tr>
                <td style="color: #9ca3af; width: 25%;">${m.category}</td>
                <td style="color: #f9fafb;">${m.turkish}</td>
              </tr>
            `;
                    });
                    meaningsHtml += '</table></div>';
                }

                item.innerHTML = `
          <div class="saved-word-header">
            <span class="saved-word-text">${wordData.word}</span>
            <button class="delete-word-btn" title="Remove word">×</button>
          </div>
          ${meaningsHtml}
        `;

                // Add delete functionality
                item.querySelector('.delete-word-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    showModal(`Remove "${wordData.word}" from list?`, 'confirm', async () => {
                        await Utils.deleteWordFromList(list.id, wordData.word);
                        // Refresh the list details
                        const updatedLists = await Utils.getLists();
                        const updatedList = updatedLists.find(l => l.id === list.id);
                        renderListDetails(updatedList);
                    });
                });

                listWordsContainer.appendChild(item);
            });
        }

        switchView('detail');
    }

    // Initial Load
    loadListOptions();
});
