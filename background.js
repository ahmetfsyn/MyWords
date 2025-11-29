// Background service worker
// Can be used for context menu integration or handling alarms/notifications later.

chrome.runtime.onInstalled.addListener(() => {
    console.log('MyWords Extension Installed');

    // Initialize default list if not exists
    chrome.storage.local.get(['lists'], (result) => {
        if (!result.lists) {
            chrome.storage.local.set({
                lists: [
                    { id: 'default', name: 'My Words', words: [] }
                ]
            });
        }
    });
});
