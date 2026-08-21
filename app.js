const feed = document.getElementById("feed");
const status = document.getElementById("status");
const shuffleBtn = document.getElementById("shuffleBtn");
const clearSeenBtn = document.getElementById("clearSeenBtn");
const batchSizeSelect = document.getElementById("batchSize");
const template = document.getElementById("cardTemplate");

let images = [];
let queue = [];
let seen = new Set();
let loading = false;

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeEntry(entry) {
  if (typeof entry === "string") {
    return { url: entry, source: entry };
  }

  if (entry && typeof entry.url === "string") {
    return {
      url: entry.url,
      source: entry.source || entry.url,
      title: entry.title || ""
    };
  }

  return null;
}

async function loadImages() {
  try {
    const response = await fetch("images.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("images.json must contain an array.");
    }

    images = data.map(normalizeEntry).filter(Boolean);

    if (!images.length) {
      status.textContent = "No images found. Add image URLs to images.json.";
      return;
    }

    restoreSeen();
    refillQueue();
    loadMore();
  } catch (error) {
    console.error(error);
    status.textContent =
      "Couldn't load images.json. Make sure this page is being served by a web server.";
  }
}

function restoreSeen() {
  try {
    const stored = JSON.parse(localStorage.getItem("randomImageFeedSeen") || "[]");
    seen = new Set(stored);
  } catch {
    seen = new Set();
  }
}

function saveSeen() {
  localStorage.setItem("randomImageFeedSeen", JSON.stringify([...seen]));
}

function refillQueue() {
  let unseen = images.filter((item, index) => !seen.has(index));

  // Once everything has been seen, start a new cycle.
  if (unseen.length === 0) {
    seen.clear();
    saveSeen();
    unseen = images;
  }

  queue = shuffle(unseen.map((item, index) => ({
    item,
    index: images.indexOf(item)
  })));
}

function loadMore() {
  if (loading || queue.length === 0) return;

  loading = true;
  const count = Number(batchSizeSelect.value);

  for (let i = 0; i < count; i++) {
    if (queue.length === 0) refillQueue();

    const entry = queue.shift();
    if (!entry) break;

    seen.add(entry.index);
    addCard(entry.item);
  }

  saveSeen();
  status.textContent = `${seen.size} of ${images.length} images seen this cycle`;
  loading = false;
}

function addCard(item) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".card");
  const imageLink = fragment.querySelector(".image-link");
  const img = fragment.querySelector("img");
  const sourceLink = fragment.querySelector(".source-link");

  imageLink.href = item.source || item.url;
  img.src = item.url;
  img.alt = item.title || "Image from collection";

  sourceLink.href = item.source || item.url;

  img.addEventListener("error", () => {
    card.remove();
  });

  feed.appendChild(fragment);
}

function startNewFeed() {
  feed.innerHTML = "";
  queue = [];
  refillQueue();
  loadMore();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

shuffleBtn.addEventListener("click", startNewFeed);

clearSeenBtn.addEventListener("click", () => {
  seen.clear();
  localStorage.removeItem("randomImageFeedSeen");
  startNewFeed();
});

batchSizeSelect.addEventListener("change", () => {
  if (queue.length < 10) loadMore();
});

// Infinite scrolling.
const observer = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) {
    loadMore();
  }
}, { rootMargin: "1200px" });

observer.observe(status);

loadImages();
