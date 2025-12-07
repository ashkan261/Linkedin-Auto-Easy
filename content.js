// content.js
// Linkedin Auto Easy - feed logic
//  - Auto unfollow + hide suggested posts when START is active
//  - Ad / suggestion / Persian filters
//  - Scroll delay & auto refresh
//  - Keyword filter mode
//  - Network warning detection
//  - Human-behavior mode (optional)
//  - Auto click "See new posts"

// ==============================
// HUMAN-BEHAVIOR MODE
// ==============================

let HUMAN_MODE = false;

// بارگذاری مقدار اولیه humanizeMode از استوریج
chrome.storage.sync.get({ humanizeMode: false }, (data) => {
  HUMAN_MODE = !!data.humanizeMode;
});

// لیسنر برای تغییر realtime از طرف popup/background
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.type) return;
  if (msg.type === "HUMANIZE_MODE") {
    HUMAN_MODE = !!msg.enabled;
  }
});

// تاخیر انسانی
function humanDelay(ms) {
  if (!HUMAN_MODE) return ms;
  return ms + Math.floor(Math.random() * 3000) + 500; // +0.5–3.5s
}

// کلیک با جیتِر کوچک روی عنصر
function humanJitterClick(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2 + (Math.random() * 6 - 3);
  const y = rect.top + rect.height / 2 + (Math.random() * 6 - 3);
  el.dispatchEvent(
    new MouseEvent("click", {
      clientX: x,
      clientY: y,
      bubbles: true,
    })
  );
}

// ==============================
// AUTO CLICK "SEE NEW POSTS"
// ==============================

setInterval(() => {
  // ساختار فعلی لینکدین برای دکمه
  const btn = document.querySelector(
    "div.text-align-center button.artdeco-button--secondary"
  );
  if (
    btn &&
    btn.innerText &&
    btn.innerText.trim().toLowerCase().includes("see new posts")
  ) {
    console.log("[Linkedin Auto Easy] auto clicking See new posts");
    humanJitterClick(btn);
  }
}, 2500);

// ==============================
// STATE
// ==============================

let state = {
  isRunning: false,

  // Toggles
  hideAds: true,
  hideSuggestions: true,
  parsiLockEnabled: false,

  // Timings
  scrollDelaySec: 10, // 1–120 seconds
  refreshBeforeActions: 0, // 0–50 actions; 0 = disabled

  // Filter
  filterEnabled: false,
  filterKeyword: "",
  filterMatches: 0,

  // Counters
  unfollowCount: 0,
  hideCount: 0,
  totalCount: 0,
  opsSinceRefresh: 0,

  // Scroll
  lastScrollTime: 0,

  // Warning
  networkWarning: false,
};

const PERSIAN_REGEX = /[\u0600-\u06FF]/;

// ==============================
// HELPERS
// ==============================

function log(...args) {
  console.log("[Linkedin Auto Easy]", ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ذخیره‌ی شمارنده‌ها در استوریج و اطلاع به popup
function syncCounters() {
  chrome.storage.sync.set({
    unfollowCount: state.unfollowCount,
    hideCount: state.hideCount,
    totalCount: state.totalCount,
  });

  chrome.runtime.sendMessage(
    {
      type: "COUNTERS_UPDATE",
      unfollowCount: state.unfollowCount,
      hideCount: state.hideCount,
      totalCount: state.totalCount,
    },
    () => {
      void chrome.runtime.lastError;
    }
  );

  // کامپتیبلیتی با نسخه‌های قبلی
  chrome.runtime.sendMessage(
    {
      type: "updateUnfollow",
      count: state.unfollowCount,
    },
    () => {
      void chrome.runtime.lastError;
    }
  );
}

// آپدیت فلگ networkWarning (هم استوریج، هم استیت، هم پیام به popup)
function setNetworkWarning(active) {
  if (state.networkWarning === active) return;
  state.networkWarning = active;
  chrome.storage.sync.set({ networkWarning: active });
  if (active) {
    chrome.runtime.sendMessage({ type: "NETWORK_WARNING" }, () => {
      void chrome.runtime.lastError;
    });
  }
}

// ثبت اکشن برای شمارنده‌ها + auto refresh
function registerAction(isUnfollow = false, isHide = false) {
  let changed = false;
  if (isUnfollow) {
    state.unfollowCount++;
    changed = true;
  }
  if (isHide) {
    state.hideCount++;
    changed = true;
  }
  if (changed) {
    state.totalCount++;
    state.opsSinceRefresh++;
    syncCounters();

    if (
      state.refreshBeforeActions > 0 &&
      state.opsSinceRefresh >= state.refreshBeforeActions
    ) {
      log("Auto refresh threshold reached, reloading page.");
      state.opsSinceRefresh = 0;
      setTimeout(() => {
        location.reload();
      }, humanDelay(800));
    }
  }
}

// اسکرول با تاخیر (بر اساس Scroll Delay)
async function scrollFeedIfNeeded() {
  const now = Date.now();
  const delayMs = (state.scrollDelaySec || 1) * 1000;
  const elapsed = now - state.lastScrollTime;

  if (elapsed < delayMs) {
    const waitMore = delayMs - elapsed;
    await sleep(humanDelay(waitMore));
  }

  window.scrollBy({
    top: window.innerHeight * 0.9,
    left: 0,
    behavior: "smooth",
  });
  state.lastScrollTime = Date.now();
}

// ==============================
// DOM HELPERS
// ==============================

// تمام پست‌ها
function getAllPosts() {
  return Array.from(document.querySelectorAll(".feed-shared-update-v2"));
}

// تشخیص "Suggested"
function isSuggestedPost(post) {
  const header = post
    .closest(".ember-view")
    ?.querySelector(".update-components-header__text-view");
  if (!header) return false;
  const txt = header.innerText.trim().toLowerCase();
  return txt.includes("suggested");
}

// تشخیص آگهی (Sponsored / Promoted)
function isAdPost(post) {
  const text = post.innerText.toLowerCase();
  return text.includes("promoted") || text.includes("sponsored");
}

// تشخیص Repost (در صورت نیاز)
function isRepost(post) {
  const text = post.innerText.toLowerCase();
  return text.includes("reposted this") || text.includes("shared this");
}

// تشخیص comment/like activity (در صورت نیاز)
function isCommentedActivity(post) {
  const text = post.innerText.toLowerCase();
  return text.includes("commented on this") || text.includes("liked this");
}

// لاک‌شده
function isLockedPost(post) {
  const lockIcon = post.querySelector(
    'svg[data-test-icon="lock-small"], svg[data-test-icon="lock-medium"]'
  );
  return !!lockIcon;
}

// مخفی کردن پست از طریق X یا display:none
async function hidePostViaX(post) {
  if (!post || post.dataset.laeHidden === "1") return false;

  const hideBtn = post
    .closest(".ember-view")
    ?.querySelector(".feed-shared-control-menu__hide-post-button");
  if (hideBtn) {
    hideBtn.click();
    post.dataset.laeHidden = "1";
    registerAction(false, true);
    return true;
  }

  post.style.display = "none";
  post.dataset.laeHidden = "1";
  registerAction(false, true);
  return true;
}

// دکمه سه‌نقطه
function getMenuButton(post) {
  return post
    .closest(".ember-view")
    ?.querySelector(
      ".feed-shared-update-v2__control-menu button.feed-shared-control-menu__trigger"
    );
}

// آیتم "Unfollow ..." داخل منو
function getUnfollowMenuItem() {
  const items = Array.from(
    document.querySelectorAll(
      "li.feed-shared-control-menu__item.option-unfollow-member"
    )
  );
  if (items.length > 0) {
    return items[0].querySelector('[role="button"], .tap-target');
  }

  const buttons = Array.from(
    document.querySelectorAll(
      ".feed-shared-control-menu__dropdown-item, .artdeco-dropdown__item"
    )
  );
  for (const b of buttons) {
    const t = b.innerText.trim().toLowerCase();
    if (t.startsWith("unfollow ")) {
      return b;
    }
  }

  return null;
}

// Unfollow نویسنده‌ی پست
async function unfollowPostAuthor(post) {
  if (!post || post.dataset.laeUnfollowDone === "1") return false;

  const menuBtn = getMenuButton(post);
  if (!menuBtn) {
    return false;
  }

  menuBtn.click();
  await sleep(humanDelay(600));

  const unfollowItem = getUnfollowMenuItem();
  if (unfollowItem) {
    unfollowItem.click();
    post.dataset.laeUnfollowDone = "1";
    registerAction(true, false);
    return true;
  }

  // اگر Unfollow پیدا نشد، پست رو مخفی کن
  await hidePostViaX(post);
  post.dataset.laeUnfollowDone = "1";
  return false;
}

// اعمال فیلترها روی یک پست
async function applyFiltersToPost(post) {
  if (!post || post.dataset.laeFiltered === "1") return;
  post.dataset.laeFiltered = "1";

  // اگر فیلتر کلمه فعاله، اولویت با اونه
  if (state.filterEnabled && state.filterKeyword) {
    await applyKeywordFilterToPost(post);
    return;
  }

  // Persian Lock
  if (state.parsiLockEnabled) {
    const txt = post.innerText || "";
    if (PERSIAN_REGEX.test(txt)) {
      await hidePostViaX(post);
      return;
    }
  }

  // Suggestions
  if (state.hideSuggestions && isSuggestedPost(post)) {
    await hidePostViaX(post);
    return;
  }

  // Ads
  if (state.hideAds && isAdPost(post)) {
    await hidePostViaX(post);
    return;
  }

  // در صورت نیاز می‌تونی isRepost / isCommentedActivity / isLockedPost رو هم استفاده کنی
}

// فیلتر keyword روی متن پست
async function applyKeywordFilterToPost(post) {
  if (!post || post.dataset.laeFilterDone === "1") return;
  post.dataset.laeFilterDone = "1";

  const kw = state.filterKeyword.trim().toLowerCase();
  if (!kw) return;

  const text = (post.innerText || "").toLowerCase();
  if (text.includes(kw)) {
    state.filterMatches++;
  } else {
    await hidePostViaX(post);
  }
}

// auto-step برای suggested + unfollow
async function processAutoForPost(post) {
  if (!post || post.dataset.laeAutoDone === "1") return false;

  // اول Suggested را حذف کن
  if (isSuggestedPost(post)) {
    const ok = await hidePostViaX(post);
    if (ok) {
      post.dataset.laeAutoDone = "1";
      return true;
    }
  }

  // بعد Unfollow
  const okUnfollow = await unfollowPostAuthor(post);
  if (okUnfollow) {
    post.dataset.laeAutoDone = "1";
    return true;
  }

  post.dataset.laeAutoDone = "1";
  return false;
}

// ==============================
// NETWORK ERROR DETECTION
// ==============================

function checkNetworkError() {
  try {
    const text = document.body.innerText || "";
    const hasError = text.includes(
      "Error due to network issue. Please check your connection."
    );
    setNetworkWarning(hasError);
  } catch (e) {
    // ignore
  }
}

// ==============================
// MAIN LOOPS
// ==============================

async function applyFiltersToAllPosts() {
  const posts = getAllPosts();
  for (const p of posts) {
    await applyFiltersToPost(p);
  }
}

// وقتی فیلتر keyword فعاله
async function filterStep() {
  const posts = getAllPosts();
  for (const p of posts) {
    await applyKeywordFilterToPost(p);
  }

  if (state.filterMatches < 10) {
    await scrollFeedIfNeeded();
  } else {
    await sleep(humanDelay(800));
  }
}

// وقتی auto-clean فعاله
async function autoStep() {
  const posts = getAllPosts();
  let acted = false;

  for (const p of posts) {
    if (!p.isConnected) continue;
    const res = await processAutoForPost(p);
    if (res) {
      acted = true;
      break;
    }
  }

  if (!acted) {
    await scrollFeedIfNeeded();
  } else {
    await sleep(humanDelay(800));
  }
}

// MutationObserver برای پست‌های جدید
function setupMutationObserver() {
  try {
    const observer = new MutationObserver(() => {
      const posts = getAllPosts();
      for (const p of posts) {
        applyFiltersToPost(p);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  } catch (e) {
    log("MutationObserver error:", e);
  }
}

// ==============================
// MESSAGE HANDLING FROM POPUP
// ==============================

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case "START_AUTOCLEAN":
      state.isRunning = true;
      chrome.storage.sync.set({ isRunning: true });
      break;

    case "STOP_AUTOCLEAN":
      state.isRunning = false;
      chrome.storage.sync.set({ isRunning: false });
      break;

    case "SET_TOGGLE":
      if (msg.key === "hideAds") {
        state.hideAds = !!msg.value;
        chrome.storage.sync.set({ hideAds: state.hideAds });
        applyFiltersToAllPosts();
      }
      if (msg.key === "hideSuggestions") {
        state.hideSuggestions = !!msg.value;
        chrome.storage.sync.set({ hideSuggestions: state.hideSuggestions });
        applyFiltersToAllPosts();
      }
      if (msg.key === "parsiLockEnabled") {
        state.parsiLockEnabled = !!msg.value;
        chrome.storage.sync.set({ parsiLockEnabled: state.parsiLockEnabled });
        applyFiltersToAllPosts();
      }
      break;

    case "SET_SCROLL_DELAY":
      state.scrollDelaySec = Math.max(
        1,
        Math.min(120, parseInt(msg.value || 10, 10))
      );
      chrome.storage.sync.set({ scrollDelaySec: state.scrollDelaySec });
      break;

    case "SET_REFRESH_BEFORE_ACTIONS":
      state.refreshBeforeActions = Math.max(
        0,
        Math.min(50, parseInt(msg.value || 0, 10))
      );
      chrome.storage.sync.set({
        refreshBeforeActions: state.refreshBeforeActions,
      });
      break;

    case "SET_FILTER":
      state.filterEnabled = !!msg.enabled;
      state.filterKeyword = (msg.keyword || "").trim();
      state.filterMatches = 0;

      chrome.storage.sync.set({
        filterEnabled: state.filterEnabled,
        filterKeyword: state.filterKeyword,
      });

      // ریست فلگ‌ها تا دوباره پردازش شوند
      const posts = getAllPosts();
      for (const p of posts) {
        p.dataset.laeFilterDone = "0";
        p.dataset.laeFiltered = "0";
      }

      applyFiltersToAllPosts();
      break;

    default:
      break;
  }
});

// ==============================
// INIT FROM STORAGE + MAIN LOOP
// ==============================

async function initFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        isRunning: false,
        hideAds: true,
        hideSuggestions: true,
        parsiLockEnabled: false,
        scrollDelaySec: 10,
        refreshBeforeActions: 0,
        filterEnabled: false,
        filterKeyword: "",
        unfollowCount: 0,
        hideCount: 0,
        totalCount: 0,
        networkWarning: false,
      },
      (data) => {
        state.isRunning = !!data.isRunning;
        state.hideAds = !!data.hideAds;
        state.hideSuggestions = !!data.hideSuggestions;
        state.parsiLockEnabled = !!data.parsiLockEnabled;
        state.scrollDelaySec = data.scrollDelaySec || 10;
        state.refreshBeforeActions = data.refreshBeforeActions || 0;
        state.filterEnabled = !!data.filterEnabled;
        state.filterKeyword = (data.filterKeyword || "").trim();
        state.unfollowCount = data.unfollowCount || 0;
        state.hideCount = data.hideCount || 0;
        state.totalCount = data.totalCount || 0;
        state.networkWarning = !!data.networkWarning;
        state.lastScrollTime = Date.now();
        state.opsSinceRefresh = 0;
        state.filterMatches = 0;

        resolve();
      }
    );
  });
}

async function mainLoop() {
  await initFromStorage();

  // یک بار روی تمام پست‌های اول صفحه فیلترها را اعمال کن
  await applyFiltersToAllPosts();

  // MutationObserver برای بقیه پست‌ها
  setupMutationObserver();

  while (true) {
    // هر دور، وضعیت ارور شبکه را چک کن
    checkNetworkError();

    if (state.filterEnabled && state.filterKeyword) {
      await filterStep();
    } else if (state.isRunning) {
      await autoStep();
    } else {
      await sleep(humanDelay(600));
    }
  }
}

// Start main loop
mainLoop().catch((e) => {
  log("Main loop error:", e);
});
