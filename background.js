// Toolbar icon par click karte hi EOD page naye tab me khulta hai.
// Agar pehle se khula hai to wahi tab aage aa jata hai.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('index.html');
  const existing = await chrome.tabs.query({ url: url });
  if (existing.length) {
    await chrome.tabs.update(existing[0].id, { active: true });
    await chrome.windows.update(existing[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: url });
  }
});
