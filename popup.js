// popup.js
// Linkedin Auto Easy - popup logic

// Buttons
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

// Counters
const unfollowCountSpan = document.getElementById('unfollowCount');
const hideCountSpan = document.getElementById('hideCount');
const totalCountSpan = document.getElementById('totalCount');

// Toggle buttons
const adBlockBtn = document.getElementById('adBlockBtn');
const suggestBlockBtn = document.getElementById('suggestBlockBtn');
const persianLockBtn = document.getElementById('persianLockBtn');

const adBlockTick = document.getElementById('adBlockTick');
const suggestBlockTick = document.getElementById('suggestBlockTick');
const persianLockTick = document.getElementById('persianLockTick');

// Advanced settings
const scrollDelayRange = document.getElementById('scrollDelayRange');
const scrollDelayValue = document.getElementById('scrollDelayValue');

const refreshRange = document.getElementById('refreshActionsRange');
const refreshValue = document.getElementById('refreshActionsValue');

// Keyword Filter
const filterEnabledInput = document.getElementById('filterEnabled');
const filterKeywordInput = document.getElementById('filterKeyword');

// Human mode
const humanizeMode = document.getElementById("humanizeMode");

// Warning box
const networkWarningBox = document.getElementById('networkWarningBox');


// Helpers
function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}

function sendToActiveTab(message) {
  return getActiveTab().then(tab => {
    if (!tab || !tab.id) return;
    chrome.tabs.sendMessage(tab.id, message, () => {
      void chrome.runtime.lastError;
    });
  });
}

function setToggleUI(button, tickEl, enabled) {
  if (enabled) button.classList.add('active');
  else button.classList.remove('active');
}


// Load state from storage and update UI
function loadState() {
  chrome.storage.sync.get({
    isRunning: false,
    hideAds: true,
    hideSuggestions: true,
    parsiLockEnabled: false,
    scrollDelaySec: 10,
    refreshBeforeActions: 0,
    filterEnabled: false,
    filterKeyword: '',
    unfollowCount: 0,
    hideCount: 0,
    totalCount: 0,
    networkWarning: false,
    humanizeMode: false
  }, (data) => {

    // START / STOP controls
    startBtn.disabled = data.isRunning;
    stopBtn.disabled = !data.isRunning;

    // Counters
    unfollowCountSpan.textContent = data.unfollowCount;
    hideCountSpan.textContent = data.hideCount;
    totalCountSpan.textContent = data.totalCount;

    // Toggles
    setToggleUI(adBlockBtn, adBlockTick, data.hideAds);
    setToggleUI(suggestBlockBtn, suggestBlockTick, data.hideSuggestions);
    setToggleUI(persianLockBtn, persianLockTick, data.parsiLockEnabled);

    // Sliders
    scrollDelayRange.value = data.scrollDelaySec;
    scrollDelayValue.textContent = `${data.scrollDelaySec}s`;

    refreshRange.value = data.refreshBeforeActions;
    refreshValue.textContent = `${data.refreshBeforeActions}`;

    // Filter
    filterEnabledInput.checked = data.filterEnabled;
    filterKeywordInput.value = data.filterKeyword;

    // Human mode
    humanizeMode.checked = data.humanizeMode;

    // Network warning – نمایش بر اساس نتیجه آخرین ذخیره
    networkWarningBox.style.display = data.networkWarning ? 'flex' : 'none';
  });
}


// START / STOP
startBtn.addEventListener('click', () => {
  chrome.storage.sync.set({ isRunning: true }, () => {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    sendToActiveTab({ type: 'START_AUTOCLEAN' });
  });
});

stopBtn.addEventListener('click', () => {
  chrome.storage.sync.set({ isRunning: false }, () => {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    sendToActiveTab({ type: 'STOP_AUTOCLEAN' });
  });
});


// Toggles
adBlockBtn.addEventListener('click', () => {
  chrome.storage.sync.get({ hideAds: true }, (data) => {
    const next = !data.hideAds;
    chrome.storage.sync.set({ hideAds: next });
    setToggleUI(adBlockBtn, adBlockTick, next);
    sendToActiveTab({ type: 'SET_TOGGLE', key: 'hideAds', value: next });
  });
});

suggestBlockBtn.addEventListener('click', () => {
  chrome.storage.sync.get({ hideSuggestions: true }, (data) => {
    const next = !data.hideSuggestions;
    chrome.storage.sync.set({ hideSuggestions: next });
    setToggleUI(suggestBlockBtn, suggestBlockTick, next);
    sendToActiveTab({ type: 'SET_TOGGLE', key: 'hideSuggestions', value: next });
  });
});

persianLockBtn.addEventListener('click', () => {
  chrome.storage.sync.get({ parsiLockEnabled: false }, (data) => {
    const next = !data.parsiLockEnabled;
    chrome.storage.sync.set({ parsiLockEnabled: next });
    setToggleUI(persianLockBtn, persianLockTick, next);
    sendToActiveTab({ type: 'SET_TOGGLE', key: 'parsiLockEnabled', value: next });
  });
});


// Scroll delay slider
scrollDelayRange.addEventListener('input', () => {
  scrollDelayValue.textContent = `${scrollDelayRange.value}s`;
});
scrollDelayRange.addEventListener('change', () => {
  chrome.storage.sync.set({ scrollDelaySec: Number(scrollDelayRange.value) });
});


// Refresh slider
refreshRange.addEventListener('input', () => {
  refreshValue.textContent = `${refreshRange.value}`;
});
refreshRange.addEventListener('change', () => {
  chrome.storage.sync.set({ refreshBeforeActions: Number(refreshRange.value) });
});


// Keyword filter
function pushFilterState() {
  chrome.storage.sync.set({
    filterEnabled: filterEnabledInput.checked,
    filterKeyword: filterKeywordInput.value.trim()
  });

  sendToActiveTab({
    type: 'SET_FILTER',
    enabled: filterEnabledInput.checked,
    keyword: filterKeywordInput.value.trim()
  });
}
filterEnabledInput.addEventListener('change', pushFilterState);
filterKeywordInput.addEventListener('change', pushFilterState);


// Human mode toggle
humanizeMode.addEventListener('change', () => {
  chrome.storage.sync.set({ humanizeMode: humanizeMode.checked });
  sendToActiveTab({
    type: "HUMANIZE_MODE",
    enabled: humanizeMode.checked
  });
});


// Listen for real-time warning updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TOAST_STATUS") {
    networkWarningBox.style.display = msg.active ? "flex" : "none";
  }
});


// Popup opened → ask LinkedIn page for real toast status
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  sendToActiveTab({ type: "CHECK_TOAST_STATUS" });
});
