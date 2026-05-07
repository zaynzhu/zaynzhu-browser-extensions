const HDHIVE_URL = "https://hdhive.com";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "search-hdhive",
    title: '在 HDHive 搜索"%s"',
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "search-hdhive" && info.selectionText) {
    const query = encodeURIComponent(info.selectionText.trim());
    const url = `${HDHIVE_URL}/search?query=${query}&type=multi&page=1`;
    chrome.tabs.create({ url });
  }
});