
function matchPattern(url, pattern) {
    const regexp = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return regexp.test(url);
}

const BROWSER_API = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : undefined);

BROWSER_API.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && matchPattern(changeInfo.url, "https://*.zendesk.com/*")) {
        // URL has changed, send message to content script
        console.log("background script url changed:", changeInfo);
        BROWSER_API.tabs.sendMessage(tabId, { message: 'urlChanged', url: changeInfo.url });
    }
});
console.log("background script listening for url changes...");