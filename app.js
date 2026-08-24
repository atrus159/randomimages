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

const WORKER_URL =
  "https://black-recipe-f2ad.darius-is-ru.workers.dev/";

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
    return { url: entry, source: entry, title: "" };
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


async function findUpdatedImageUrl(item) {
  console.log("Fallback lookup for image:");
  console.log("Image URL:", item.url);
  console.log("Source:", item.source);

  const params = new URLSearchParams({
    url: item.url,
    source: item.source
  });

  const response = await fetch(
    `${WORKER_URL}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      `Worker returned HTTP ${response.status}`
    );
  }

  const result =
    await response.json();

  console.log(
    "Worker response:",
    result
  );

  if (!result.found || !result.url) {
    throw new Error(
      result.error ||
      "No updated image URL found."
    );
  }

  return result.url;
}

function addCard(item) {
  const fragment =
    template.content.cloneNode(true);

  const card =
    fragment.querySelector(".card");

  const imageLink =
    fragment.querySelector(".image-link");

  const img =
    fragment.querySelector("img");

  const sourceLink =
    fragment.querySelector(".source-link");

  imageLink.href =
    item.source || item.url;

  img.alt =
    item.title ||
    "Image from collection";

  sourceLink.href =
    item.source || item.url;

  /*
   * Keep track of whether we've already
   * attempted the fallback.
   */
  let fallbackAttempted = false;

  /*
   * This function sets the image URL.
   */
  function setImageUrl(url) {
    img.src = url;
  }

  /*
   * If the original image fails, ask the
   * Cloudflare Worker for the current URL.
   */
  img.addEventListener(
    "error",
    async () => {
      /*
       * Don't retry forever.
       */
      if (fallbackAttempted) {
        console.log(
          "Fallback image also failed:",
          img.src
        );

        card.remove();
        return;
      }

      fallbackAttempted = true;

      console.log(
        "Image failed:",
        item.url
      );

      console.log(
        "Trying fallback lookup..."
      );

      try {
        const updatedUrl =
          await findUpdatedImageUrl(item);

        console.log(
          "Updated image URL:",
          updatedUrl
        );

        /*
         * Change the link to point to the
         * newly discovered image as well.
         */
        imageLink.href =
          item.source || updatedUrl;

        /*
         * Try loading the new URL.
         */
        setImageUrl(updatedUrl);

      } catch (error) {
        console.error(
          "Fallback lookup failed:",
          error
        );

        card.remove();
      }
    }
  );

  /*
   * Set the original URL AFTER installing
   * the error handler, so we don't miss
   * an immediate failure.
   */
  setImageUrl(item.url);

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
