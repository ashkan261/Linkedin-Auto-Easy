# Linkedin Auto Easy – V7
<p align="center">
  <img src="https://github.com/ashkan261/Linkedin-Auto-Easy/blob/main/linkeddin-auto-post.png" width="800">
</p>

A lightweight Chrome extension that automates common LinkedIn feed actions such as unfollowing, hiding suggested posts, blocking ads, filtering Persian content, and applying human-like behavior patterns.  
The extension also supports keyword-based feed filtering and customizable scrolling/refresh logic.

---

## 🚀 Features

### 🔹 Auto Actions
- **Auto-Unfollow** inactive or unwanted accounts  
- **Auto-Hide (X)** suggested posts  
- **Auto-Scroll** with adjustable delay  
- **Auto-Refresh** every X actions  

### 🔹 Filters
- **Ad Block** – removes LinkedIn ads  
- **Suggestions Block** – hides “Suggested for you” posts  
- **Persian Lock** – hides all posts containing Persian characters  

### 🔹 Human-Behavior Mode
Adds:
- Random delay  
- Jitter click  
- Random pauses  
- Non-sequential actions  

### 🔹 Keyword Filter
Keeps only posts containing selected keywords.  
Everything else is automatically hidden.

---

## 📦 File Structure

```
linkedin-auto-easy/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── style.css
└── icons/ (optional)
```

---

## 🛠 Installation (Developer Mode)

1. Download or clone this repository.
2. Open **Chrome → Extensions** (`chrome://extensions/`)
3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select the extension folder.

The extension will appear in your Chrome toolbar.

---

## 📌 Permissions Used

From `manifest.json`:

```
"permissions": ["storage", "tabs", "scripting"],
"host_permissions": ["https://www.linkedin.com/*"]
```

These allow:
- modifying the active LinkedIn tab  
- storing user settings  
- injecting `content.js` into the feed  

---

## ⚙️ How It Works

- `content.js` runs directly on the LinkedIn feed page and performs automation.  
- `popup.js` manages UI actions (Start/Stop, toggles, sliders).  
- `background.js` keeps service worker events.  
- `manifest.json` registers the extension and permissions.  

---

## 🧩 Compatibility
- Google Chrome  
- Microsoft Edge  
- Any Chromium-based browser  

---

## 📄 License
MIT License

---

## 👤 Author
Developed by **Ashkan MahinFallah**

