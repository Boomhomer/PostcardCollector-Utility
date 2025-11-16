const APP_VERSION = "0.6.0";

const state = {
  postcards: []
};

const STORAGE_KEY = "postcard-collector";
const THEME_STORAGE_KEY = "postcard-collector-theme";

let selectedPostcardId = null;
let activeCategoryFilter = "";
let searchTerm = "";
let postcardCounter = 0;
const pendingGeneratedIds = new Set();
let toolbarEl;
let subtoolbarEl;
let galleryEl;
let detailEl;
let messageEl;
let themeToggleButton;
let categoryFilterEl;
let searchInputEl;
let importJsonInputEl;
let batchImportInputEl;
let bulkCategorySelectEl;
let currentTheme = "light";
let lightboxEl;
let lightboxFrameEl;
let lightboxImageEl;
let lightboxCloseBtn;
let postcardModalEl;
let postcardModalOverlayEl;
let postcardModalUidEl;
let postcardCreatedEl;
let postcardUpdatedEl;
let postcardModalCopyBtn;
let postcardModalCloseBtn;
let postcardModalSaveBtn;
let postcardModalDeleteBtn;
let overviewPanel;
let editPanel;
let messageTimeoutId = null;
let currentModalPostcardId = null;
let currentModalTab = "overview";
let bulkEditBtn;
let bulkEditModalEl;
let bulkEditOverlayEl;
let bulkEditFormEl;
let bulkEditCloseBtn;
let bulkEditCancelBtn;
let filterStatsEl;
let postcardModalKeydownHandler = null;

const placeholderImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23e0e0ea'/%3E%3Cpath d='M60 230h280M60 70l110 110 80-70 90 90' stroke='%23c0c0d0' stroke-width='12' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='130' cy='100' r='28' fill='%23c0c0d0'/%3E%3C/svg%3E";

const selectedPostcardIds = new Set();

function releasePendingPostcardId(id) {
  if (typeof id === "string" && id) {
    pendingGeneratedIds.delete(id);
  }
}

const CATEGORY_LABELS = {
  pre1945: "Do roku 1945",
  communist: "1945–1989",
  post1989: "Po roce 1989",
  other: "Ostatní"
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

function stripDiacritics(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function createCssUrl(value) {
  const sanitized = String(value ?? "").replace(/"/g, '\\"');
  return `url("${sanitized}")`;
}
function getCategoryLabel(value) {
  if (!value) {
    return "Bez kategorie";
  }
  return CATEGORY_LABELS[value] || value;
}


function formatTimestamp(value) {
  if (!value) {
    return "–";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("cs-CZ");
}

function getNextAvailablePostcardId(postcards) {
  const numbers = [];

  postcards.forEach((item) => {
    const value = extractCounterFromId(item ? item.id : null);
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      numbers.push(value);
    }
  });

  pendingGeneratedIds.forEach((id) => {
    const value = extractCounterFromId(id);
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      numbers.push(value);
    }
  });

  numbers.sort((a, b) => a - b);

  let candidate = 1;
  for (const number of numbers) {
    if (number < candidate) {
      continue;
    }
    if (number === candidate) {
      candidate += 1;
      continue;
    }
    if (number > candidate) {
      break;
    }
  }

  return candidate;
}

// Generates the next available identifier with reuse of freed numbers.
function generatePostcardId() {
  const nextNumber = getNextAvailablePostcardId(state.postcards);
  const newId = `P${String(nextNumber).padStart(6, "0")}`;
  pendingGeneratedIds.add(newId);
  postcardCounter = nextNumber;
  return newId;
}

// Creates a new postcard object with default empty fields following the data model.
function createNewPostcard() {
  const now = new Date().toISOString();
  return {
    id: generatePostcardId(),
    title: "",
    city: "",
    country: "",
    year: "",
    category: "",
    tags: [],
    imageFront: "",
    imageBack: "",
    notes: "",
    createdAt: now,
    updatedAt: now
  };
}

// Renders the gallery grid with postcard cards based on current filter results.
function renderGallery(postcards) {
  if (!galleryEl) return;

  if (!postcards.length) {
    galleryEl.innerHTML = `<div class="empty-gallery">Zatím zde nejsou žádné pohlednice. Přidejte první!</div>`;
    updateIncompleteIndicator();
    return;
  }

  const items = postcards
    .map((postcard) => {
      const hasFrontImage = Boolean(postcard.imageFront);
      const categoryValue = postcard.category || "";
      const badgeLabel = categoryValue ? getCategoryLabel(categoryValue) : "Bez kategorie";
      const badgeAttribute = categoryValue ? ` data-category="${escapeHtml(categoryValue)}"` : "";
      const cityLabel = postcard.city ? postcard.city : "Bez města";
      const titleLabel = postcard.title || "Bez názvu";
      const tagMarkup = postcard.tags.length
        ? `<div class="postcard-tags">${postcard.tags
            .slice(0, 3)
            .map((tag) => `<span class="postcard-tag">${escapeHtml(tag)}</span>`)
            .join("")}</div>`
        : "";
      const isChecked = selectedPostcardIds.has(postcard.id) ? "checked" : "";

      return `
        <article class="postcard-card${selectedPostcardId === postcard.id ? " selected" : ""}" data-id="${escapeHtml(postcard.id)}">
          <label class="card-select">
            <input type="checkbox" class="card-select-checkbox" data-select-id="${escapeHtml(postcard.id)}" ${isChecked} aria-label="Vybrat pohlednici ${escapeHtml(titleLabel)}">
          </label>
          <span class="postcard-badge"${badgeAttribute}>${escapeHtml(badgeLabel)}</span>
          <img src="${escapeHtml(hasFrontImage ? postcard.imageFront : placeholderImage)}" alt="${escapeHtml(titleLabel)}">
          <div class="postcard-info">
            <div class="postcard-title">${escapeHtml(titleLabel)}</div>
            <div class="postcard-uid">${escapeHtml(postcard.id)}</div>
            <div class="postcard-meta">${escapeHtml(cityLabel)}</div>
            ${tagMarkup}
          </div>
        </article>
      `;
    })
    .join("");

  galleryEl.innerHTML = items;
  Array.from(galleryEl.querySelectorAll(".postcard-card")).forEach((card) => {
    const cardId = card.getAttribute("data-id");
    const checkbox = card.querySelector(".card-select-checkbox");
    if (checkbox) {
      checkbox.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedPostcardIds.add(cardId);
        } else {
          selectedPostcardIds.delete(cardId);
        }
        updateBulkEditButtonState();
      });
    }

    card.addEventListener("click", () => {
      openPostcardDetail(cardId);
      renderGallery(applyFilters());
    });
  });

  updateIncompleteIndicator();
  updateBulkEditButtonState();
}



// Opens the postcard modal for a specific postcard ID.
function openPostcardDetail(id) {
  openPostcardModal(id);
}

function openPostcardModal(id) {
  if (!postcardModalEl) return;

  if (!id) {
    closePostcardModal();
    return;
  }

  const postcard = state.postcards.find((item) => item.id === id);
  if (!postcard) {
    closePostcardModal();
    return;
  }

  selectedPostcardId = id;
  const isSamePostcard = currentModalPostcardId === postcard.id;
  if (!isSamePostcard) {
    currentModalTab = "overview";
  }
  currentModalPostcardId = postcard.id;

  if (postcardModalUidEl) {
    postcardModalUidEl.textContent = postcard.id;
  }
  if (postcardModalCopyBtn) {
    postcardModalCopyBtn.textContent = "📋 Kopírovat UID";
    postcardModalCopyBtn.disabled = false;
  }
  if (postcardCreatedEl) {
    postcardCreatedEl.textContent = `Vytvořeno: ${formatTimestamp(postcard.createdAt)}`;
  }
  if (postcardUpdatedEl) {
    postcardUpdatedEl.textContent = `Upraveno: ${formatTimestamp(postcard.updatedAt)}`;
  }
  if (overviewPanel) {
    overviewPanel.innerHTML = renderOverviewTab(postcard);
  }
  if (editPanel) {
    editPanel.innerHTML = renderEditTab(postcard);
  }

  initializePreviewImageFrames(postcardModalEl);

  const form = editPanel ? editPanel.querySelector(".detail-form") : null;
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      savePostcardFromForm(form);
    });

    const fileNameButton = form.querySelector('[data-action="generate-file-name"]');
    const fileNameInput = form.querySelector('[name="generatedFileName"]');
    if (fileNameButton && fileNameInput) {
      fileNameButton.addEventListener("click", () => {
        const previewPostcard = {
          id: postcard.id,
          city: form.elements.city.value.trim(),
          country: form.elements.country.value.trim(),
          category: form.elements.category.value
        };
        fileNameInput.value = generateFileName(previewPostcard);
      });
    }

    const frontUploadInput = form.querySelector('[name="imageFrontUpload"]');
    if (frontUploadInput) {
      frontUploadInput.addEventListener("change", (event) => {
        handleImageFileSelection(event, postcard, "imageFront");
      });
    }

    const backUploadInput = form.querySelector('[name="imageBackUpload"]');
    if (backUploadInput) {
      backUploadInput.addEventListener("change", (event) => {
        handleImageFileSelection(event, postcard, "imageBack");
      });
    }
  }

  setPostcardModalTab(currentModalTab);
  postcardModalEl.classList.remove("pc-hidden");
  postcardModalEl.setAttribute("aria-hidden", "false");
  attachPostcardModalHotkeys();
}

function closePostcardModal() {
  if (!postcardModalEl) return;
  postcardModalEl.classList.add("pc-hidden");
  postcardModalEl.setAttribute("aria-hidden", "true");
  currentModalPostcardId = null;
  detachPostcardModalHotkeys();
}

function attachPostcardModalHotkeys() {
  if (postcardModalKeydownHandler) {
    return;
  }
  postcardModalKeydownHandler = (event) => {
    if (!postcardModalEl || postcardModalEl.classList.contains("pc-hidden")) {
      return;
    }
    const hasPrimaryModifier = event.ctrlKey || event.metaKey;
    if (hasPrimaryModifier && (event.key === "s" || event.key === "S")) {
      event.preventDefault();
      event.stopPropagation();
      triggerPostcardModalSave();
      return;
    }
    if (hasPrimaryModifier && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      triggerPostcardModalSave();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePostcardModal();
    }
  };
  document.addEventListener("keydown", postcardModalKeydownHandler);
}

function detachPostcardModalHotkeys() {
  if (!postcardModalKeydownHandler) {
    return;
  }
  document.removeEventListener("keydown", postcardModalKeydownHandler);
  postcardModalKeydownHandler = null;
}

function triggerPostcardModalSave() {
  if (postcardModalSaveBtn) {
    postcardModalSaveBtn.click();
    return;
  }
  const form = editPanel ? editPanel.querySelector(".detail-form") : null;
  if (form) {
    form.requestSubmit();
  }
}

function renderOverviewTab(postcard) {
  const frontContent = postcard.imageFront
    ? `<div class="image-frame" data-role="image-frame" data-source="${escapeHtml(postcard.imageFront)}">
        <img src="${escapeHtml(postcard.imageFront)}" alt="Přední strana" data-role="preview-image">
      </div>`
    : `<div class="pc-overview-empty">Přední strana nenahrána</div>`;

  const backContent = postcard.imageBack
    ? `<div class="image-frame" data-role="image-frame" data-source="${escapeHtml(postcard.imageBack)}">
        <img src="${escapeHtml(postcard.imageBack)}" alt="Zadní strana" data-role="preview-image">
      </div>`
    : `<div class="pc-overview-empty">Zadní strana nenahrána</div>`;

  const metaItems = [
    renderOverviewMetaItem("Název", postcard.title || "–"),
    renderOverviewMetaItem("Město", postcard.city || "–"),
    renderOverviewMetaItem("Země", postcard.country || "–"),
    renderOverviewMetaItem("Rok / období", postcard.year || "–"),
    renderOverviewMetaItem(
      "Kategorie",
      postcard.category ? getCategoryLabel(postcard.category) : "Bez kategorie"
    )
  ].join("");

  const tagsMarkup = postcard.tags.length
    ? `<div class="pc-overview-tags">${postcard.tags
        .map((tag) => `<span class="pc-chip">🏷️ ${escapeHtml(tag)}</span>`)
        .join("")}</div>`
    : `<div class="pc-overview-empty-inline">Žádné tagy</div>`;

  const notesMarkup = postcard.notes ? escapeHtml(postcard.notes) : "–";

  return `
    <div class="pc-overview-images">
      <div class="pc-overview-figure">
        <h3>📸 Přední strana</h3>
        ${frontContent}
      </div>
      <div class="pc-overview-figure">
        <h3>📸 Zadní strana</h3>
        ${backContent}
      </div>
    </div>
    <div class="pc-overview-section">
      <h4>📄 Základní údaje</h4>
      <div class="pc-overview-meta">
        ${metaItems}
      </div>
    </div>
    <div class="pc-overview-section">
      <h4>🏷️ Tagy</h4>
      ${tagsMarkup}
    </div>
    <div class="pc-overview-section">
      <h4>📝 Poznámka</h4>
      <div class="pc-overview-notes">${notesMarkup}</div>
    </div>
  `;
}

function renderOverviewMetaItem(label, value) {
  return `
    <div class="pc-overview-meta-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderEditTab(postcard) {
  return `
    <form class="detail-form" data-id="${escapeHtml(postcard.id)}">
      <input type="hidden" name="id" value="${escapeHtml(postcard.id)}">
      <input type="hidden" name="imageFront" value="${escapeHtml(postcard.imageFront)}">
      <input type="hidden" name="imageBack" value="${escapeHtml(postcard.imageBack)}">

      <section class="detail-section">
        <div class="detail-grid detail-grid-basic">
          <div class="form-field">
            <label>📛 Název</label>
            <input type="text" name="title" value="${escapeHtml(postcard.title)}" class="text-input">
          </div>
          <div class="form-field">
            <label>🏙️ Město</label>
            <input type="text" name="city" value="${escapeHtml(postcard.city)}" class="text-input">
          </div>
          <div class="form-field">
            <label>🌍 Země</label>
            <input type="text" name="country" value="${escapeHtml(postcard.country)}" class="text-input">
          </div>
          <div class="form-field">
            <label>🕒 Rok / období</label>
            <input type="text" name="year" value="${escapeHtml(postcard.year)}" class="text-input">
          </div>
          <div class="form-field">
            <label>🗂️ Kategorie</label>
            <select name="category" class="select-input">
              <option value="" ${postcard.category === "" ? "selected" : ""}>Nevybráno</option>
              <option value="pre1945" ${postcard.category === "pre1945" ? "selected" : ""}>Do roku 1945</option>
              <option value="communist" ${postcard.category === "communist" ? "selected" : ""}>1945–1989</option>
              <option value="post1989" ${postcard.category === "post1989" ? "selected" : ""}>Po roce 1989</option>
              <option value="other" ${postcard.category === "other" ? "selected" : ""}>Ostatní</option>
            </select>
          </div>
          <div class="form-field">
            <label>🏷️ Tagy (oddělené čárkou)</label>
            <input type="text" name="tags" value="${escapeHtml(postcard.tags.join(", "))}" class="text-input">
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-grid detail-grid-images">
          <label class="file-upload">
            <span>📸 Přední strana</span>
            <input type="file" name="imageFrontUpload" accept="image/*" class="file-input">
          </label>
          <label class="file-upload">
            <span>📸 Zadní strana</span>
            <input type="file" name="imageBackUpload" accept="image/*" class="file-input">
          </label>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-grid">
          <div class="form-field form-field-full">
            <label>📝 Poznámky</label>
            <textarea name="notes">${escapeHtml(postcard.notes)}</textarea>
          </div>
        </div>
      </section>

      <div class="file-name-row">
        <input type="text" name="generatedFileName" placeholder="Název souboru" readonly class="text-input">
        <button type="button" class="btn-secondary" data-action="generate-file-name">📄 Vygenerovat název</button>
      </div>
    </form>
  `;
}

function setPostcardModalTab(tabName) {
  if (!postcardModalEl) return;
  currentModalTab = tabName === "edit" ? "edit" : "overview";

  const tabButtons = postcardModalEl.querySelectorAll(".pc-tab");
  tabButtons.forEach((button) => {
    const isActive = button.getAttribute("data-tab") === currentModalTab;
    button.classList.toggle("pc-tab-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  if (overviewPanel) {
    overviewPanel.classList.toggle("pc-tab-panel-active", currentModalTab === "overview");
  }
  if (editPanel) {
    editPanel.classList.toggle("pc-tab-panel-active", currentModalTab === "edit");
  }
}

// Saves form data back into the postcard state and refreshes UI components.
function savePostcardFromForm(form) {
  const formData = new FormData(form);
  const id = formData.get("id");
  const postcard = state.postcards.find((item) => item.id === id);
  if (!postcard) return;

  postcard.title = formData.get("title").trim();
  postcard.city = formData.get("city").trim();
  postcard.country = formData.get("country").trim();
  postcard.year = formData.get("year").trim();
  postcard.category = formData.get("category");

  const tagsInput = formData.get("tags").trim();
  postcard.tags = tagsInput
    ? tagsInput.split(",").map((tag) => tag.trim()).filter((tag) => tag.length)
    : [];

  postcard.imageFront = formData.get("imageFront").trim();
  postcard.imageBack = formData.get("imageBack").trim();
  postcard.notes = formData.get("notes").trim();

  if (!postcard.createdAt) {
    postcard.createdAt = new Date().toISOString();
  }
  postcard.updatedAt = new Date().toISOString();

  saveToLocalStorage();
  renderGallery(applyFilters());
  openPostcardDetail(postcard.id);
  showAppMessage("Změny byly uloženy.");
}

function deletePostcard(id) {
  if (!id) return;
  if (!confirm("Opravdu smazat tuto pohlednici?")) return;
  state.postcards = state.postcards.filter((pc) => pc.id !== id);
  selectedPostcardIds.delete(id);
  updateBulkEditButtonState();
  selectedPostcardId = null;
  closePostcardModal();
  saveToLocalStorage();
  renderGallery(applyFilters());
  updateIncompleteIndicator();
  showAppMessage("Pohlednice byla smazána.");
}

// Applies the active category and search filters to the postcard list.
function applyFilters() {
  const filtered = state.postcards.filter((postcard) => {
    const matchesCategory =
      activeCategoryFilter === "incomplete"
        ? isPostcardIncomplete(postcard)
        : activeCategoryFilter
        ? postcard.category === activeCategoryFilter
        : true;
    const haystack = `${postcard.title || ""} ${postcard.city || ""}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  updateFilterStats(filtered.length, state.postcards.length);
  return filtered;
}

// Generates a file name suggestion from postcard metadata following the required format.
function generateFileName(postcard) {
  const parts = [postcard.id, postcard.city, postcard.country, postcard.category]
    .filter((value) => value && value.trim())
    .map((value) =>
      stripDiacritics(value.trim())
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_-]/g, "")
    );
  return parts.join("_");
}

function parseTagInput(value) {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length);
}

function applyImageOrientation(frameEl, imageEl, source) {
  if (!frameEl || !imageEl) {
    return;
  }

  const resetOrientation = () => {
    frameEl.classList.remove("portrait");
    frameEl.style.removeProperty("--image-url");
    imageEl.style.removeProperty("object-fit");
    imageEl.style.objectFit = "cover";
  };

  if (!source) {
    resetOrientation();
    return;
  }

  const updateOrientation = () => {
    resetOrientation();
    if (imageEl.naturalHeight > imageEl.naturalWidth) {
      frameEl.classList.add("portrait");
      frameEl.style.setProperty("--image-url", createCssUrl(source));
      imageEl.style.objectFit = "contain";
    }
  };

  if (imageEl.complete && imageEl.naturalWidth) {
    updateOrientation();
  } else {
    imageEl.addEventListener("load", updateOrientation, { once: true });
  }

  imageEl.addEventListener(
    "error",
    () => {
      resetOrientation();
    },
    { once: true }
  );
}

function initializePreviewImageFrames(scope) {
  const frames = scope.querySelectorAll('[data-role="image-frame"]');
  frames.forEach((frame) => {
    const img = frame.querySelector('[data-role="preview-image"]');
    if (!img) return;
    const source = frame.getAttribute("data-source");
    applyImageOrientation(frame, img, source);
    if (source && source !== placeholderImage) {
      img.addEventListener("click", () => {
        openLightbox(source);
      });
    }
  });
}

function isPostcardIncomplete(postcard) {
  return !postcard.imageFront || !postcard.category || !postcard.city;
}

function countIncompletePostcards() {
  return state.postcards.reduce(
    (count, postcard) => (isPostcardIncomplete(postcard) ? count + 1 : count),
    0
  );
}

function updateIncompleteIndicator() {
  const indicator = document.getElementById("incompleteIndicator");
  if (!indicator) return;
  indicator.textContent = `🧹 Nekompletních: ${countIncompletePostcards()}`;
}

function updateBulkEditButtonState() {
  if (bulkEditBtn) {
    bulkEditBtn.disabled = selectedPostcardIds.size === 0;
  }
}

function updateFilterStats(visible, total) {
  if (!filterStatsEl) {
    return;
  }
  filterStatsEl.textContent = `Zobrazeno ${visible} / ${total} pohlednic`;
}

function showAppMessage(message) {
  if (!messageEl) {
    return;
  }
  if (messageTimeoutId) {
    clearTimeout(messageTimeoutId);
    messageTimeoutId = null;
  }
  if (!message) {
    messageEl.classList.remove("visible");
    messageEl.textContent = "";
    return;
  }
  messageEl.textContent = message;
  messageEl.classList.add("visible");
  messageTimeoutId = setTimeout(() => {
    messageEl.classList.remove("visible");
    messageEl.textContent = "";
    messageTimeoutId = null;
  }, 4000);
}

function renderToolbar() {
  if (!toolbarEl) return;

  toolbarEl.innerHTML = `
    <div class="toolbar-left">
      <span class="logo">PostcardCollector</span>
      <span class="version-badge">v${APP_VERSION}</span>
      <button class="btn-primary" id="newPostcardBtn">📮 Nová pohlednice</button>
      <button class="btn-secondary" id="batchImportBtn">Hromadný import</button>
      <input type="file" id="batchImportInput" accept="image/*" multiple hidden>
    </div>
    <div class="toolbar-center">
      <select id="filter-category" class="select-input">
        <option value="">všechny</option>
        <option value="pre1945">Do roku 1945</option>
        <option value="communist">1945–1989</option>
        <option value="post1989">Po roce 1989</option>
        <option value="other">Ostatní</option>
        <option value="incomplete">nekompletní</option>
      </select>
      <input id="search-input" type="text" placeholder="hledat..." class="text-input search-input">
      <span class="incomplete-indicator" id="incompleteIndicator">🧹 Nekompletních: 0</span>
    </div>
    <div class="toolbar-right">
      <button class="btn-ghost" id="importJsonBtn">📥 Import JSON</button>
      <input type="file" id="importJsonInput" accept="application/json" hidden>
      <button class="btn-ghost" id="exportAllBtn">📤 Export vše</button>
      <button class="btn-ghost" id="exportFilteredBtn">📤 Export výběru</button>
      <button class="icon-btn" id="themeToggleBtn" title="přepnout motiv" aria-pressed="false">🌓</button>
    </div>
  `;

  const newPostcardBtn = document.getElementById("newPostcardBtn");
  const batchImportBtn = document.getElementById("batchImportBtn");
  batchImportInputEl = document.getElementById("batchImportInput");
  const importJsonBtn = document.getElementById("importJsonBtn");
  importJsonInputEl = document.getElementById("importJsonInput");
  const exportAllBtn = document.getElementById("exportAllBtn");
  const exportFilteredBtn = document.getElementById("exportFilteredBtn");
  themeToggleButton = document.getElementById("themeToggleBtn");
  categoryFilterEl = document.getElementById("filter-category");
  searchInputEl = document.getElementById("search-input");

  if (newPostcardBtn) {
    newPostcardBtn.addEventListener("click", () => {
      const newPostcard = createNewPostcard();
      state.postcards.unshift(newPostcard);
      releasePendingPostcardId(newPostcard.id);
      activeCategoryFilter = "";
      searchTerm = "";
      selectedPostcardIds.clear();
      updateBulkEditButtonState();
      selectedPostcardId = newPostcard.id;
      if (categoryFilterEl) {
        categoryFilterEl.value = "";
      }
      if (searchInputEl) {
        searchInputEl.value = "";
      }
      saveToLocalStorage();
      renderGallery(applyFilters());
      openPostcardModal(newPostcard.id);
      showAppMessage("Nová pohlednice vytvořena.");
    });
  }

  if (categoryFilterEl) {
    categoryFilterEl.value = activeCategoryFilter;
    categoryFilterEl.addEventListener("change", () => {
      activeCategoryFilter = categoryFilterEl.value;
      selectedPostcardIds.clear();
      updateBulkEditButtonState();
      renderGallery(applyFilters());
    });
  }

  if (searchInputEl) {
    searchInputEl.value = searchTerm;
    searchInputEl.addEventListener("input", () => {
      searchTerm = searchInputEl.value.trim().toLowerCase();
      selectedPostcardIds.clear();
      updateBulkEditButtonState();
      renderGallery(applyFilters());
    });
  }

  if (exportAllBtn) {
    exportAllBtn.addEventListener("click", () => {
      exportPostcardsToJson();
    });
  }

  if (exportFilteredBtn) {
    exportFilteredBtn.addEventListener("click", () => {
      exportFilteredPostcardsToJson();
    });
  }

  if (importJsonBtn && importJsonInputEl) {
    importJsonBtn.addEventListener("click", () => {
      importJsonInputEl.click();
    });
    importJsonInputEl.addEventListener("change", () => {
      if (importJsonInputEl.files && importJsonInputEl.files.length) {
        importPostcardsFromJson(importJsonInputEl.files[0]);
        importJsonInputEl.value = "";
      }
    });
  }

  if (batchImportBtn && batchImportInputEl) {
    batchImportBtn.addEventListener("click", () => {
      batchImportInputEl.click();
    });
    batchImportInputEl.addEventListener("change", () => {
      if (batchImportInputEl.files && batchImportInputEl.files.length) {
        handleBatchImageImport(batchImportInputEl.files);
        batchImportInputEl.value = "";
      }
    });
  }

  if (themeToggleButton) {
    themeToggleButton.addEventListener("click", () => {
      toggleTheme();
    });
  }

  updateIncompleteIndicator();
}



function renderSubtoolbar() {
  if (!subtoolbarEl) return;

  subtoolbarEl.innerHTML = `
    <div class="subtoolbar-left">
      <span class="sub-label">Vybrané:</span>
      <select id="bulk-category" class="select-input">
        <option value="">nastavit kategorii…</option>
        <option value="pre1945">Do roku 1945</option>
        <option value="communist">1945–1989</option>
        <option value="post1989">Po roce 1989</option>
        <option value="other">Ostatní</option>
      </select>
      <button class="btn-small" id="applyBulkCategory">Použít</button>
      <button class="btn-small btn-ghost" id="clearSelectionBtn">Zrušit výběr</button>
      <button class="btn-small" id="bulkEditBtn" disabled>Hromadná úprava</button>
    </div>
    <div class="subtoolbar-right">
      <span class="sub-hint">Tip: označ pohlednice checkboxem v galerii</span>
      <span id="filterStats" class="filter-stats"></span>
    </div>
  `;

  bulkCategorySelectEl = document.getElementById("bulk-category");
  const applyBulkBtn = document.getElementById("applyBulkCategory");
  const clearSelectionBtn = document.getElementById("clearSelectionBtn");
  bulkEditBtn = document.getElementById("bulkEditBtn");
  filterStatsEl = document.getElementById("filterStats");

  if (applyBulkBtn) {
    applyBulkBtn.addEventListener("click", () => {
      applyBulkCategoryToSelection();
    });
  }

  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener("click", () => {
      if (!selectedPostcardIds.size) {
        return;
      }
      selectedPostcardIds.clear();
      if (bulkCategorySelectEl) {
        bulkCategorySelectEl.value = "";
      }
      renderGallery(applyFilters());
      showAppMessage("Výběr byl zrušen.");
      updateBulkEditButtonState();
    });
  }

  if (bulkCategorySelectEl) {
    bulkCategorySelectEl.value = "";
  }

  if (bulkEditBtn) {
    bulkEditBtn.addEventListener("click", () => {
      openBulkEditModal();
    });
    bulkEditBtn.disabled = selectedPostcardIds.size === 0;
  }

  updateFilterStats(0, state.postcards.length);
}

function openBulkEditModal() {
  if (!bulkEditModalEl) {
    return;
  }
  if (!selectedPostcardIds.size) {
    showAppMessage("Vyberte alespoň jednu pohlednici.");
    return;
  }
  if (bulkEditFormEl) {
    bulkEditFormEl.reset();
  }
  bulkEditModalEl.classList.remove("pc-hidden");
  bulkEditModalEl.setAttribute("aria-hidden", "false");
}

function closeBulkEditModal() {
  if (!bulkEditModalEl) {
    return;
  }
  bulkEditModalEl.classList.add("pc-hidden");
  bulkEditModalEl.setAttribute("aria-hidden", "true");
}

function handleBulkEditSubmit(event) {
  event.preventDefault();
  if (!bulkEditFormEl) {
    return;
  }
  if (!selectedPostcardIds.size) {
    closeBulkEditModal();
    return;
  }
  const formData = new FormData(bulkEditFormEl);
  applyBulkEdits(formData);
  bulkEditFormEl.reset();
  closeBulkEditModal();
}

function applyBulkEdits(formData) {
  if (!formData || !selectedPostcardIds.size) {
    return;
  }

  const categoryValue = formData.get("category");
  const cityValue = (formData.get("city") || "").trim();
  const countryValue = (formData.get("country") || "").trim();
  const yearValue = (formData.get("year") || "").trim();
  const addTags = parseTagInput(formData.get("addTags"));
  const removeTags = parseTagInput(formData.get("removeTags"));
  const removeTagSet = new Set(removeTags);
  const now = new Date().toISOString();
  let updatedCount = 0;

  state.postcards.forEach((postcard) => {
    if (!selectedPostcardIds.has(postcard.id)) {
      return;
    }
    let changed = false;
    if (categoryValue) {
      changed = changed || postcard.category !== categoryValue;
      postcard.category = categoryValue;
    }
    if (cityValue) {
      changed = changed || postcard.city !== cityValue;
      postcard.city = cityValue;
    }
    if (countryValue) {
      changed = changed || postcard.country !== countryValue;
      postcard.country = countryValue;
    }
    if (yearValue) {
      changed = changed || postcard.year !== yearValue;
      postcard.year = yearValue;
    }
    if (addTags.length) {
      const existingTags = new Set(postcard.tags);
      addTags.forEach((tag) => {
        if (!existingTags.has(tag)) {
          postcard.tags.push(tag);
          existingTags.add(tag);
          changed = true;
        }
      });
    }
    if (removeTagSet.size) {
      const filteredTags = postcard.tags.filter((tag) => !removeTagSet.has(tag));
      if (filteredTags.length !== postcard.tags.length) {
        postcard.tags = filteredTags;
        changed = true;
      }
    }
    if (changed) {
      if (!postcard.createdAt) {
        postcard.createdAt = now;
      }
      postcard.updatedAt = now;
      updatedCount += 1;
    }
  });

  saveToLocalStorage();
  selectedPostcardIds.clear();
  updateBulkEditButtonState();
  if (bulkCategorySelectEl) {
    bulkCategorySelectEl.value = "";
  }
  renderGallery(applyFilters());
  updateIncompleteIndicator();
  updateBulkEditButtonState();
  showAppMessage(
    updatedCount
      ? `Hromadná úprava aplikována pro ${updatedCount} pohlednic.`
      : "Žádné změny nebyly aplikovány."
  );
}



function normalizePostcardData(raw) {
  const safeObject = typeof raw === "object" && raw !== null ? raw : {};
  const normalizedTags = Array.isArray(safeObject.tags)
    ? safeObject.tags
        .map((tag) => String(tag).trim())
        .filter((tag) => tag.length)
    : typeof safeObject.tags === "string" && safeObject.tags.trim()
      ? safeObject.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length)
      : [];

  const normalized = {
    id:
      typeof safeObject.id === "string" && safeObject.id.trim()
        ? safeObject.id.trim()
        : generatePostcardId(),
    title: typeof safeObject.title === "string" ? safeObject.title : "",
    city: typeof safeObject.city === "string" ? safeObject.city : "",
    country: typeof safeObject.country === "string" ? safeObject.country : "",
    year: typeof safeObject.year === "string" ? safeObject.year : "",
    category:
      typeof safeObject.category === "string" ? safeObject.category : "",
    tags: normalizedTags,
    imageFront:
      typeof safeObject.imageFront === "string" ? safeObject.imageFront : "",
    imageBack:
      typeof safeObject.imageBack === "string" ? safeObject.imageBack : "",
    notes: typeof safeObject.notes === "string" ? safeObject.notes : "",
    createdAt:
      typeof safeObject.createdAt === "string" ? safeObject.createdAt : "",
    updatedAt:
      typeof safeObject.updatedAt === "string" ? safeObject.updatedAt : ""
  };

  return normalized;
}

function extractCounterFromId(id) {
  if (typeof id !== "string") {
    return null;
  }
  const matchNewFormat = id.match(/^P(\d{6,})$/i);
  if (matchNewFormat) {
    return parseInt(matchNewFormat[1], 10);
  }
  const tailDigitsMatch = id.match(/(\d{1,})$/);
  if (tailDigitsMatch) {
    return parseInt(tailDigitsMatch[1], 10);
  }
  return null;
}

function syncPostcardCounter() {
  postcardCounter = state.postcards.reduce((highest, postcard) => {
    const value = extractCounterFromId(postcard.id);
    if (typeof value === "number" && !Number.isNaN(value)) {
      return Math.max(highest, value);
    }
    return highest;
  }, 0);
  pendingGeneratedIds.clear();
}

function seedSamplePostcards() {
  const now = new Date().toISOString();
  const samples = [
    {
      title: "Historické náměstí",
      city: "Praha",
      country: "Československo",
      year: "1932",
      category: "pre1945",
      tags: ["historie", "centrum"],
      notes: "Pohled na Staroměstské náměstí se sochou Jana Husa.",
      imageFront: placeholderImage,
      imageBack: ""
    },
    {
      title: "Továrna Tesla",
      city: "Pardubice",
      country: "ČSSR",
      year: "1978",
      category: "communist",
      tags: ["průmysl"],
      notes: "Propagační pohlednice k otevření nové haly.",
      imageFront: placeholderImage,
      imageBack: ""
    },
    {
      title: "Most SNP",
      city: "Bratislava",
      country: "Slovensko",
      year: "2005",
      category: "post1989",
      tags: ["architektura", "řeka"],
      notes: "Večerní panorama s UFO barem.",
      imageFront: placeholderImage,
      imageBack: ""
    }
  ].map((sample) => {
    const postcard = createNewPostcard();
    return {
      ...postcard,
      ...sample,
      createdAt: now,
      updatedAt: now
    };
  });

  state.postcards = samples;
  samples.forEach((item) => releasePendingPostcardId(item.id));
  syncPostcardCounter();
}

function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.postcards));
  } catch (error) {
    console.error("Nepodařilo se uložit data do localStorage.", error);
  }
}

function loadFromLocalStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        state.postcards = parsed.map((item) => normalizePostcardData(item));
        syncPostcardCounter();
        return;
      }
    }
  } catch (error) {
    console.error("Nepodařilo se načíst data z localStorage.", error);
  }

  seedSamplePostcards();
  saveToLocalStorage();
}

function exportPostcardsToJson() {
  const data = JSON.stringify(state.postcards, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "postcards.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportFilteredPostcardsToJson() {
  const filtered = applyFilters();
  const data = JSON.stringify(filtered, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "postcards_filtered.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importPostcardsFromJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) {
        throw new Error("Očekávané pole pohlednic.");
      }
      state.postcards = parsed.map((item) => normalizePostcardData(item));
      syncPostcardCounter();
      saveToLocalStorage();
      activeCategoryFilter = "";
      searchTerm = "";
      selectedPostcardIds.clear();
      updateBulkEditButtonState();
      if (categoryFilterEl) {
        categoryFilterEl.value = "";
      }
      if (searchInputEl) {
        searchInputEl.value = "";
      }
      selectedPostcardId = null;
      renderGallery(applyFilters());
      openPostcardDetail(null);
      updateIncompleteIndicator();
      showAppMessage("Import JSON dokončen.");
    } catch (error) {
      console.error("Chyba při importu JSON.", error);
      alert("Nepodařilo se načíst JSON soubor. Zkontrolujte jeho formát.");
    }
  };
  reader.readAsText(file);
}

function handleImageFileSelection(event, postcard, fieldName) {
  const { files } = event.target;
  if (!files || !files.length) {
    return;
  }

  const file = files[0];
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== "string") {
      return;
    }
    postcard[fieldName] = reader.result;
    if (!postcard.createdAt) {
      postcard.createdAt = new Date().toISOString();
    }
    postcard.updatedAt = new Date().toISOString();

    const editForm = editPanel ? editPanel.querySelector(".detail-form") : null;
    if (editForm) {
      const hiddenField = editForm.querySelector(`[name="${fieldName}"]`);
      if (hiddenField) {
        hiddenField.value = reader.result;
      }
    }

    saveToLocalStorage();
    renderGallery(applyFilters());
    openPostcardModal(postcard.id);
    showAppMessage("Obrázek byl aktualizován.");
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}



function handleBatchImageImport(fileList) {
  if (!fileList || !fileList.length) {
    return;
  }

  const files = Array.from(fileList);
  const readPromises = files.map(
    (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve({ dataUrl: reader.result, name: file.name });
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      })
  );

  Promise.all(readPromises).then((results) => {
    const now = new Date().toISOString();
    const created = results
      .filter(Boolean)
      .map((result) => {
        const postcard = createNewPostcard();
        postcard.imageFront = result.dataUrl;
        postcard.createdAt = now;
        postcard.updatedAt = now;
        return postcard;
      });

    if (!created.length) {
      return;
    }

    selectedPostcardIds.clear();
    updateBulkEditButtonState();
    state.postcards = created.concat(state.postcards);
    created.forEach((card) => releasePendingPostcardId(card.id));
    saveToLocalStorage();
    activeCategoryFilter = "";
    searchTerm = "";
    selectedPostcardId = created[0].id;
    if (categoryFilterEl) {
      categoryFilterEl.value = "";
    }
    if (searchInputEl) {
      searchInputEl.value = "";
    }

    renderGallery(applyFilters());
    openPostcardDetail(created[0].id);
    updateIncompleteIndicator();
    showAppMessage(`Importováno: ${created.length} nových pohlednic.`);
    console.info(`Hromadný import: vytvořeno ${created.length} pohlednic.`);
  });
}

function applyBulkCategoryToSelection() {
  if (!bulkCategorySelectEl) {
    return;
  }
  if (!selectedPostcardIds.size) {
    showAppMessage("Vyberte alespoň jednu pohlednici.");
    return;
  }

  const targetCategory = bulkCategorySelectEl.value;
  const affectedIds = new Set(selectedPostcardIds);
  const now = new Date().toISOString();
  let updatedCount = 0;

  state.postcards.forEach((postcard) => {
    if (affectedIds.has(postcard.id)) {
      postcard.category = targetCategory;
      if (!postcard.createdAt) {
        postcard.createdAt = now;
      }
      postcard.updatedAt = now;
      updatedCount += 1;
    }
  });

  selectedPostcardIds.clear();
  updateBulkEditButtonState();
  if (bulkCategorySelectEl) {
    bulkCategorySelectEl.value = "";
  }
  saveToLocalStorage();
  renderGallery(applyFilters());
  if (selectedPostcardId && state.postcards.some((pc) => pc.id === selectedPostcardId)) {
    openPostcardModal(selectedPostcardId);
  }
  updateIncompleteIndicator();
  if (updatedCount) {
    showAppMessage(`Kategorie nastavená pro ${updatedCount} pohlednic.`);
  } else {
    showAppMessage("Kategorie zůstala beze změny.");
  }
}

function setTheme(theme) {
  currentTheme = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark", currentTheme === "dark");
  if (themeToggleButton) {
    const nextLabel = currentTheme === "dark" ? "Přepnout na světlý motiv" : "Přepnout na tmavý motiv";
    themeToggleButton.textContent = currentTheme === "dark" ? "☀️" : "🌓";
    themeToggleButton.setAttribute("aria-pressed", currentTheme === "dark" ? "true" : "false");
    themeToggleButton.setAttribute("aria-label", nextLabel);
    themeToggleButton.setAttribute("title", nextLabel);
  }
}


function toggleTheme() {
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    console.error("Nepodařilo se uložit motiv.", error);
  }
}

function openLightbox(source) {
  if (!lightboxEl || !lightboxImageEl || !lightboxFrameEl || !source || source === placeholderImage) {
    return;
  }
  lightboxEl.classList.add("visible");
  lightboxEl.setAttribute("aria-hidden", "false");
  lightboxImageEl.onload = () => {
    applyImageOrientation(lightboxFrameEl, lightboxImageEl, source);
    lightboxImageEl.onload = null;
  };
  lightboxImageEl.onerror = () => {
    lightboxFrameEl.classList.remove("portrait");
    lightboxFrameEl.style.removeProperty("--image-url");
    lightboxImageEl.style.objectFit = "cover";
    lightboxImageEl.onerror = null;
  };
  lightboxImageEl.src = source;
  applyImageOrientation(lightboxFrameEl, lightboxImageEl, source);
}

function closeLightbox() {
  if (!lightboxEl || !lightboxImageEl || !lightboxFrameEl) {
    return;
  }
  lightboxEl.classList.remove("visible");
  lightboxEl.setAttribute("aria-hidden", "true");
  lightboxImageEl.onload = null;
  lightboxImageEl.onerror = null;
  lightboxImageEl.src = "";
  lightboxFrameEl.classList.remove("portrait");
  lightboxFrameEl.style.removeProperty("--image-url");
}

// Placeholder for future loading of data via File System Access API.
function loadFromDisk() {}

// Placeholder for future saving of data via File System Access API.
function saveToDisk() {}

document.addEventListener("DOMContentLoaded", () => {
  toolbarEl = document.getElementById("toolbar");
  subtoolbarEl = document.getElementById("subtoolbar");
  galleryEl = document.getElementById("gallery");
  detailEl = document.getElementById("detail");
  messageEl = document.getElementById("appMessage");
  lightboxEl = document.getElementById("lightbox");
  lightboxFrameEl = document.getElementById("lightboxImageFrame");
  lightboxImageEl = document.getElementById("lightboxImage");
  lightboxCloseBtn = document.getElementById("lightboxCloseBtn");

  postcardModalEl = document.getElementById("postcard-modal");
  postcardModalOverlayEl = postcardModalEl ? postcardModalEl.querySelector(".pc-modal-overlay") : null;
  postcardModalUidEl = document.getElementById("pc-modal-uid");
  postcardCreatedEl = document.getElementById("pc-created");
  postcardUpdatedEl = document.getElementById("pc-updated");
  postcardModalCopyBtn = document.getElementById("pc-copy-uid");
  postcardModalCloseBtn = document.getElementById("pc-modal-close");
  postcardModalSaveBtn = document.getElementById("pc-save");
  postcardModalDeleteBtn = document.getElementById("pc-delete");
  overviewPanel = document.getElementById("pc-tab-overview");
  editPanel = document.getElementById("pc-tab-edit");
  bulkEditModalEl = document.getElementById("bulk-edit-modal");
  bulkEditOverlayEl = bulkEditModalEl ? bulkEditModalEl.querySelector(".bulk-modal-overlay") : null;
  bulkEditFormEl = document.getElementById("bulk-edit-form");
  bulkEditCloseBtn = document.getElementById("bulk-modal-close");
  bulkEditCancelBtn = document.getElementById("bulk-edit-cancel");

  if (lightboxEl && lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener("click", () => {
      closeLightbox();
    });
    lightboxEl.addEventListener("click", (event) => {
      if (event.target === lightboxEl) {
        closeLightbox();
      }
    });
  }

  if (postcardModalOverlayEl) {
    postcardModalOverlayEl.addEventListener("click", () => {
      closePostcardModal();
    });
  }

  if (postcardModalCloseBtn) {
    postcardModalCloseBtn.addEventListener("click", () => {
      closePostcardModal();
    });
  }

  if (postcardModalCopyBtn) {
    const defaultLabel = postcardModalCopyBtn.textContent;
    postcardModalCopyBtn.addEventListener("click", () => {
      if (!currentModalPostcardId) {
        return;
      }
      if (!navigator.clipboard) {
        postcardModalCopyBtn.textContent = "Schránka nedostupná";
        setTimeout(() => {
          postcardModalCopyBtn.textContent = defaultLabel;
        }, 2000);
        return;
      }
      navigator.clipboard
        .writeText(currentModalPostcardId)
        .then(() => {
          postcardModalCopyBtn.textContent = "✅ Zkopírováno";
          setTimeout(() => {
            postcardModalCopyBtn.textContent = defaultLabel;
          }, 2000);
        })
        .catch(() => {
          postcardModalCopyBtn.textContent = "Nelze kopírovat";
          setTimeout(() => {
            postcardModalCopyBtn.textContent = defaultLabel;
          }, 2000);
        });
    });
  }

  if (postcardModalSaveBtn) {
    postcardModalSaveBtn.addEventListener("click", () => {
      const form = editPanel ? editPanel.querySelector(".detail-form") : null;
      if (form) {
        form.requestSubmit();
      }
    });
  }

  if (postcardModalDeleteBtn) {
    postcardModalDeleteBtn.addEventListener("click", () => {
      if (currentModalPostcardId) {
        deletePostcard(currentModalPostcardId);
      }
    });
  }

  if (postcardModalEl) {
    const tabButtons = postcardModalEl.querySelectorAll(".pc-tab");
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setPostcardModalTab(button.getAttribute("data-tab"));
      });
    });
  }

  if (bulkEditOverlayEl) {
    bulkEditOverlayEl.addEventListener("click", () => {
      closeBulkEditModal();
    });
  }

  if (bulkEditCloseBtn) {
    bulkEditCloseBtn.addEventListener("click", () => {
      closeBulkEditModal();
    });
  }

  if (bulkEditCancelBtn) {
    bulkEditCancelBtn.addEventListener("click", () => {
      closeBulkEditModal();
    });
  }

  if (bulkEditFormEl) {
    bulkEditFormEl.addEventListener("submit", handleBulkEditSubmit);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      let handled = false;
      if (lightboxEl && lightboxEl.classList.contains("visible")) {
        closeLightbox();
        handled = true;
      }
      if (postcardModalEl && !postcardModalEl.classList.contains("pc-hidden")) {
        closePostcardModal();
        handled = true;
      }
      if (handled) {
        event.preventDefault();
      }
    }
  });

  let storedTheme = "light";
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      storedTheme = savedTheme;
    }
  } catch (error) {
    console.error("Nepodařilo se načíst nastavení motivu.", error);
  }
  currentTheme = storedTheme;

  renderToolbar();
  renderSubtoolbar();
  setTheme(currentTheme);

  loadFromLocalStorage();
  renderGallery(applyFilters());
  closePostcardModal();
});







