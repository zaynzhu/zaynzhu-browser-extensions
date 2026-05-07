// 创建右键菜单项
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "searchDouban",
    title: "在豆瓣搜索 \"%s\"",
    contexts: ["selection"]
  });
});

// 处理菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "searchDouban" && info.selectionText) {
    const searchUrl = 'https://search.douban.com/movie/subject_search?search_text=' + encodeURIComponent(info.selectionText);
    chrome.tabs.create({ url: searchUrl });
  }
});