const DATA_PATHS = {
  questions: "assets/data/questions.json",
  stats: "assets/data/dataset-stats.json",
  manifest: "assets/data/media-manifest.json",
  examples: "assets/data/example-responses.json",
  modelResponses: "assets/data/model-responses.json",
  visualPrompts: "assets/data/visual-prompt-examples.json",
  selfExplanations: "assets/data/self-explanation-examples.json",
  tvaExamples: "assets/data/tva-examples.json",
  results: "assets/data/results.json",
};

const VIDEO_REPO_PAGES_BASE = "https://flat-pack-bench.github.io/videos";
const VIDEO_REPO_MEDIA_BASE = "https://media.githubusercontent.com/media/flat-pack-bench/videos/videos";
const VIDEO_REPO_SOURCE_FOLDERS = {
  keyframe: "keyframe_videos",
  trimmed: "trimmed_videos",
};

const CATEGORY_META = {
  temporal_loc: { label: "Temporal Localization", short: "TLOC", className: "tag-temporal_loc" },
  temporal_ord: { label: "Temporal Ordering", short: "TORD", className: "tag-temporal_ord" },
  mating: { label: "Mating", short: "MATE", className: "tag-mating" },
  tracking: { label: "Tracking", short: "TRACK", className: "tag-tracking" },
};

const state = {
  questions: [],
  stats: {},
  manifest: { videos: {}, questionPromptImages: {}, stats: {} },
  examples: [],
  modelResponses: { models: [], responsesByQuestion: {} },
  visualPrompts: [],
  selfExplanations: [],
  tvaExamples: [],
  results: [],
  viewerMode: "curated",
  exampleIndex: 0,
  datasetVideoMode: "keyframe",
  currentQid: "",
  filteredQuestions: [],
  resultsSort: { key: "micro", direction: "desc" },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

init().catch((error) => {
  console.error(error);
  const content = $(".content");
  if (content) {
    content.insertAdjacentHTML(
      "afterbegin",
      `<div class="empty-state">Unable to load project data: ${escapeHtml(error.message)}</div>`,
    );
  }
});

async function init() {
  const [
    questions,
    stats,
    manifest,
    examples,
    modelResponses,
    visualPrompts,
    selfExplanations,
    tvaExamples,
    results,
  ] = await Promise.all([
    loadJson(DATA_PATHS.questions),
    loadJson(DATA_PATHS.stats),
    loadJson(DATA_PATHS.manifest),
    loadJson(DATA_PATHS.examples),
    loadJsonOptional(DATA_PATHS.modelResponses, { models: [], responsesByQuestion: {} }),
    loadJson(DATA_PATHS.visualPrompts),
    loadJson(DATA_PATHS.selfExplanations),
    loadJson(DATA_PATHS.tvaExamples),
    loadJson(DATA_PATHS.results),
  ]);

  state.questions = questions.map((question, index) => ({ ...question, _siteIndex: index }));
  state.stats = stats;
  state.manifest = manifest;
  state.examples = examples;
  state.modelResponses = modelResponses;
  state.visualPrompts = visualPrompts;
  state.selfExplanations = selfExplanations;
  state.tvaExamples = tvaExamples;
  state.results = results;

  renderBenchmarkStats();
  setupDatasetViewer();
  setupResultsTable();
  renderSupplementaryExplorers();
  setupGlobalEvents();
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

async function loadJsonOptional(path, fallback) {
  const response = await fetch(path);
  if (!response.ok) return fallback;
  return response.json();
}

function renderBenchmarkStats() {
  const container = $("#benchmark-stats");
  if (!container) return;
  const counts = state.stats.category_counts || {};
  const overview = [
    ["Questions", state.stats.question_count, "multiple-choice benchmark items"],
    ["Videos", state.stats.unique_video_count, "real furniture assembly clips"],
    ["Furniture items", state.stats.furniture_count, "unique furniture pieces"],
    ["Task families", Object.keys(CATEGORY_META).length, "spatio-temporal skills"],
  ];
  container.innerHTML = `
    ${overview
      .map(([label, value, description]) => `
        <article class="metric-card metric-card-primary">
          <span>${escapeHtml(label)}</span>
          <strong>${formatNumber(value || 0)}</strong>
          <p>${escapeHtml(description)}</p>
        </article>
      `)
      .join("")}
  `;
  Object.entries(CATEGORY_META).forEach(([key]) => {
    const count = counts[key] ?? 0;
    const target = $(`[data-category-card="${key}"] .category-count`);
    if (target) {
      target.textContent = `${formatNumber(count)} questions`;
    }
  });
}

function renderCategoryLegend(selector) {
  const container = $(selector);
  if (!container) return;
  container.innerHTML = Object.entries(CATEGORY_META)
    .map(([key, meta]) => `
      <span>
        <i class="${escapeHtml(meta.className)}" aria-hidden="true"></i>
        ${escapeHtml(meta.short)}
      </span>
    `)
    .join("");
}

function setupCuratedControls() {
  const tabs = $("#example-tabs");
  if (!tabs || state.examples.length === 0) return;

  tabs.innerHTML = state.examples
    .map((entry, index) => {
      const q = entry.question;
      const meta = CATEGORY_META[q.question_category] || {};
      return `
        <button
          type="button"
          data-index="${index}"
          class="${escapeHtml(meta.className || "")}"
          aria-label="Sample ${pad(index + 1)} ${categoryShort(q.question_category)}"
          title="${categoryShort(q.question_category)}"
        >${pad(index + 1)}</button>
      `;
    })
    .join("");
  renderCategoryLegend("#sample-legend");

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;
    state.exampleIndex = Number(button.dataset.index);
    renderCuratedDetail();
  });

  renderCuratedDetail();
}

function renderCuratedDetail() {
  const detail = $("#curated-detail");
  if (!detail) return;
  const entry = state.examples[state.exampleIndex];
  if (!entry) {
    detail.innerHTML = `<div class="empty-state">Curated examples are unavailable.</div>`;
    return;
  }

  $$("#example-tabs button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.index) === state.exampleIndex);
  });

  const q = entry.question;
  const videoSrc = supplementaryVideo("sep", entry.video_id, state.datasetVideoMode);
  const promptSpecs = supplementaryPromptSpecs(q, "assets/supplementary/sep");

  detail.innerHTML = `
    <div class="dataset-detail-stack">
      ${renderDatasetMedia(q, videoSrc, promptSpecs)}
      ${renderQuestion(q, { title: `Curated example ${state.exampleIndex + 1}`, includeIndex: false })}
      ${renderModelResponsesForQuestion(q)}
    </div>
  `;
}

function setupDatasetViewer() {
  setupCuratedControls();
  populateSelect("#category-filter", unique(state.questions.map((q) => q.question_category)), "All categories", categoryLabel);
  populateSelect("#template-filter", unique(state.questions.map((q) => q.template_type)), "All templates");
  populateSelect("#furniture-filter", unique(state.questions.map((q) => q.furniture_name)), "All furniture");

  $("#dataset-viewer-mode")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-viewer-mode]");
    if (!button) return;
    setViewerMode(button.dataset.viewerMode, { pushUrl: true });
  });

  ["#dataset-search", "#category-filter", "#template-filter", "#furniture-filter"].forEach((selector) => {
    $(selector)?.addEventListener("input", () => {
      applyDatasetFilters();
      renderDatasetList();
      selectDatasetQuestion(state.filteredQuestions[0]?.qid_flat || "", { pushUrl: false });
    });
  });

  $("#dataset-video-mode")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    state.datasetVideoMode = button.dataset.mode;
    $$("#dataset-video-mode button").forEach((node) => {
      node.classList.toggle("active", node.dataset.mode === state.datasetVideoMode);
    });
    renderCuratedDetail();
    renderDatasetDetail();
  });

  $("#question-list")?.addEventListener("click", handleQuestionListClick);

  const params = new URLSearchParams(window.location.search);
  const qid = params.get("qid");
  const id = params.get("id");
  const viewer = params.get("viewer");
  if (qid && state.questions.some((q) => q.qid_flat === qid)) {
    state.currentQid = qid;
    state.viewerMode = "full";
  } else if (id && state.questions[Number(id)]) {
    state.currentQid = state.questions[Number(id)].qid_flat;
    state.viewerMode = "full";
  } else {
    state.currentQid = state.questions[0]?.qid_flat || "";
    state.viewerMode = viewer === "full" ? "full" : "curated";
  }

  applyDatasetFilters();
  if (!state.filteredQuestions.some((q) => q.qid_flat === state.currentQid)) {
    state.currentQid = state.filteredQuestions[0]?.qid_flat || "";
  }
  renderDatasetList();
  renderCuratedDetail();
  renderDatasetDetail();
  syncViewerMode();
}

function setViewerMode(mode, options = {}) {
  state.viewerMode = mode === "full" ? "full" : "curated";
  syncViewerMode();
  if (options.pushUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("viewer", state.viewerMode);
    if (state.viewerMode === "curated") {
      url.searchParams.delete("qid");
      url.searchParams.delete("id");
    } else if (state.currentQid) {
      url.searchParams.set("qid", state.currentQid);
      url.searchParams.delete("id");
    }
    window.history.replaceState({}, "", url);
  }
}

function syncViewerMode() {
  const isFull = state.viewerMode === "full";
  $("#curated-detail")?.toggleAttribute("hidden", isFull);
  $("#curated-controls")?.toggleAttribute("hidden", isFull);
  $("#dataset-filters")?.toggleAttribute("hidden", !isFull);
  $("#full-dataset-view")?.toggleAttribute("hidden", !isFull);
  $$("#dataset-viewer-mode button").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewerMode === state.viewerMode);
  });
}

function populateSelect(selector, values, allLabel, labeler = (value) => value) {
  const select = $(selector);
  if (!select) return;
  select.innerHTML = [
    `<option value="">${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labeler(value))}</option>`),
  ].join("");
}

function applyDatasetFilters() {
  const search = ($("#dataset-search")?.value || "").trim().toLowerCase();
  const category = $("#category-filter")?.value || "";
  const template = $("#template-filter")?.value || "";
  const furniture = $("#furniture-filter")?.value || "";

  state.filteredQuestions = state.questions.filter((q) => {
    if (category && q.question_category !== category) return false;
    if (template && q.template_type !== template) return false;
    if (furniture && q.furniture_name !== furniture) return false;
    if (!search) return true;
    return [
      q.qid_flat,
      q.qid,
      q.video_id,
      q.furniture_name,
      q.template_type,
      q.vid_category,
      q.question?.raw_qstr,
      q.question?.qstr,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

function renderDatasetList() {
  const count = $("#dataset-count");
  if (count) {
    count.textContent = `${state.filteredQuestions.length} question${state.filteredQuestions.length === 1 ? "" : "s"}`;
  }

  const list = $("#question-list");
  if (!list) return;
  if (state.filteredQuestions.length === 0) {
    list.innerHTML = `<div class="empty-state">No questions match the current filters.</div>`;
    return;
  }

  list.innerHTML = state.filteredQuestions
    .map((q) => `
      <button
        type="button"
        data-qid="${escapeHtml(q.qid_flat)}"
        class="${escapeHtml(CATEGORY_META[q.question_category]?.className || "")}"
        aria-label="Question ${pad(q._siteIndex + 1)} ${categoryShort(q.question_category)} ${escapeHtml(q.furniture_name)} ${escapeHtml(q.video_id)}"
        title="${categoryShort(q.question_category)} - ${escapeHtml(q.furniture_name)} / ${escapeHtml(q.video_id)}"
      >
        ${pad(q._siteIndex + 1)}
      </button>
    `)
    .join("");

  markActiveQuestion();
}

function handleQuestionListClick(event) {
  const button = event.target.closest("button[data-qid]");
  if (button) {
    selectDatasetQuestion(button.dataset.qid);
  }
}

function selectDatasetQuestion(qid, options = {}) {
  if (!qid) {
    state.currentQid = "";
    renderDatasetDetail();
    markActiveQuestion();
    return;
  }
  state.currentQid = qid;
  renderDatasetDetail();
  markActiveQuestion();
  if (options.pushUrl !== false) {
    const url = new URL(window.location.href);
    url.searchParams.set("viewer", "full");
    url.searchParams.set("qid", qid);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url);
  }
}

function markActiveQuestion() {
  $$("#question-list button[data-qid]").forEach((button) => {
    button.classList.toggle("active", button.dataset.qid === state.currentQid);
  });
}

function renderDatasetDetail() {
  const detail = $("#dataset-detail");
  if (!detail) return;
  const q = state.questions.find((item) => item.qid_flat === state.currentQid);
  if (!q) {
    detail.innerHTML = `<div class="empty-state">Select a question to inspect it.</div>`;
    return;
  }

  const videoSpec = state.manifest.videos[videoKey(q)];
  const videoSources = datasetVideoSources(q, videoSpec, state.datasetVideoMode);
  const promptSpecs = state.manifest.questionPromptImages[q.qid_flat] || [];
  const filteredIndex = state.filteredQuestions.findIndex((item) => item.qid_flat === q.qid_flat);

  detail.innerHTML = `
    <div class="detail-nav">
      <button class="nav-button" type="button" data-step="-1">Previous</button>
      <span class="pill">Question ${pad(q._siteIndex + 1)} of ${state.questions.length}</span>
      <button class="nav-button" type="button" data-step="1">Next</button>
    </div>
    <div class="dataset-detail-stack">
      ${renderDatasetMedia(q, videoSources, promptSpecs)}
      ${renderQuestion(q, { title: `Question ${pad(q._siteIndex + 1)}`, includeIndex: true })}
      ${renderModelResponsesForQuestion(q)}
    </div>
  `;

  detail.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => moveDatasetSelection(Number(button.dataset.step)));
    button.disabled = filteredIndex < 0;
  });
}

function renderDatasetMedia(q, videoInput, promptSpecs) {
  const videoSources = normalizeVideoSources(videoInput);
  const sourceTags = videoSources
    .map((src) => `<source src="${escapeHtml(src)}" type="video/mp4">`)
    .join("");
  const videoCell = videoSources.length
    ? `
      <div class="viewer-media-cell viewer-video-cell">
        <video class="dataset-video" controls playsinline preload="metadata">${sourceTags}</video>
        <p class="media-hint">${state.datasetVideoMode === "keyframe" ? "Key-frame video" : "Trimmed video"}</p>
      </div>
    `
    : `
      <div class="viewer-media-cell viewer-video-cell">
        <div class="missing-video">Video unavailable for ${escapeHtml(videoKey(q))}</div>
      </div>
    `;

  const promptCells = (promptSpecs && promptSpecs.length ? promptSpecs : [{ label: "Visual Prompt", available: false }])
    .map((spec) => renderPromptMediaCell(spec))
    .join("");

  if (promptSpecs.length > 1) {
    return `
      <div class="viewer-media-stack dataset-media">
        ${videoCell}
        <div class="viewer-media-images">${promptCells}</div>
      </div>
    `;
  }

  return `
    <div class="viewer-media-row dataset-media">
      ${videoCell}
      ${promptCells}
    </div>
  `;
}

function datasetVideoSources(q, videoSpec, mode) {
  const sources = [];
  addVideoSource(sources, videoSpec?.[mode]);

  const deployedFolder = VIDEO_REPO_SOURCE_FOLDERS[mode];
  if (deployedFolder) {
    const sourcePath = `${deployedFolder}/${q.vid_category}/${q.furniture_name}/${q.video_id}/${q.video_id}.mp4`;
    addVideoSource(sources, `${VIDEO_REPO_PAGES_BASE}/${sourcePath}`);
    addVideoSource(sources, `${VIDEO_REPO_MEDIA_BASE}/${sourcePath}`);
  }

  if (mode === "keyframe") {
    addVideoSource(sources, `${VIDEO_REPO_PAGES_BASE}/${q.vid_category}/${q.furniture_name}/${q.video_id}.mp4`);
  }

  return sources;
}

function normalizeVideoSources(videoInput) {
  const sources = [];
  if (Array.isArray(videoInput)) {
    videoInput.forEach((src) => addVideoSource(sources, src));
  } else {
    addVideoSource(sources, videoInput);
  }
  return sources;
}

function addVideoSource(sources, src) {
  if (!src || sources.includes(src)) return;
  sources.push(src);
}

function renderPromptMediaCell(spec) {
  if (!spec.available && spec.available !== undefined) {
    return `
      <div class="viewer-media-cell">
        ${promptFallback(spec)}
        <p class="media-hint">${escapeHtml(spec.label || "Prompt image")}</p>
      </div>
    `;
  }
  return `
    <div class="viewer-media-cell">
      <button class="prompt-image-button" type="button" data-overlay-src="${escapeHtml(spec.src)}" data-overlay-label="${escapeHtml(spec.label || "Prompt image")}">
        <img src="${escapeHtml(spec.src)}" alt="${escapeHtml(spec.label)}" data-fallback="${escapeHtml(spec.original || spec.label)}">
      </button>
      <p class="media-hint">${escapeHtml(spec.label || "Prompt image")}</p>
    </div>
  `;
}

function moveDatasetSelection(step) {
  if (state.filteredQuestions.length === 0) return;
  const index = state.filteredQuestions.findIndex((q) => q.qid_flat === state.currentQid);
  const nextIndex = clamp(index + step, 0, state.filteredQuestions.length - 1);
  selectDatasetQuestion(state.filteredQuestions[nextIndex].qid_flat);
  $("#question-list button.active")?.scrollIntoView({ block: "nearest" });
}

function setupResultsTable() {
  populateSelect("#results-prompt", unique(state.results.map((row) => row.prompt)), "All prompts");
  populateSelect("#results-video", unique(state.results.map((row) => row.video)), "All videos");

  ["#results-search", "#results-prompt", "#results-video"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderResultsTable);
  });

  $$("#results-table th[data-sort]").forEach((header) => {
    header.addEventListener("click", () => {
      const key = header.dataset.sort;
      if (state.resultsSort.key === key) {
        state.resultsSort.direction = state.resultsSort.direction === "asc" ? "desc" : "asc";
      } else {
        state.resultsSort = { key, direction: key === "model" ? "asc" : "desc" };
      }
      renderResultsTable();
    });
  });

  $("#results-toggle")?.addEventListener("click", toggleResultsTable);
  renderResultsTable();
}

function toggleResultsTable() {
  const button = $("#results-toggle");
  const region = $("#results-table-region");
  const label = $("[data-results-toggle-label]", button);
  if (!button || !region) return;
  const shouldOpen = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(shouldOpen));
  region.hidden = !shouldOpen;
  if (label) {
    label.textContent = shouldOpen ? "Collapse" : "Expand";
  }
}

function renderResultsTable() {
  const tbody = $("#results-table tbody");
  if (!tbody) return;
  const search = ($("#results-search")?.value || "").trim().toLowerCase();
  const prompt = $("#results-prompt")?.value || "";
  const video = $("#results-video")?.value || "";

  const rows = state.results
    .filter((row) => {
      if (prompt && row.prompt !== prompt) return false;
      if (video && row.video !== video) return false;
      if (search && !row.model.toLowerCase().includes(search)) return false;
      return true;
    })
    .sort((a, b) => compareRows(a, b, state.resultsSort.key, state.resultsSort.direction));

  tbody.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.model)}</td>
        <td>${escapeHtml(row.prompt)}</td>
        <td>${escapeHtml(row.video)}</td>
        <td class="num">${formatScore(row.micro)}</td>
        <td class="num">${escapeHtml(row.ci || "")}</td>
        <td class="num">${formatScore(row.tord)}</td>
        <td class="num">${formatScore(row.tloc)}</td>
        <td class="num">${formatScore(row.track)}</td>
        <td class="num">${formatScore(row.mate)}</td>
      </tr>
    `)
    .join("");
}

function renderSupplementaryExplorers() {
  renderVisualPromptExamples();
  renderSelfExplanationExamples();
  renderTvaExamples();
}

function renderVisualPromptExamples() {
  const container = $("#visual-prompt-examples");
  if (!container) return;
  container.innerHTML = state.visualPrompts
    .map((entry) => {
      const q = entry.question;
      const videos = ["sep", "collage", "concat"]
        .map((kind) => `
          <div>
            <span class="pill">${kind}</span>
            <video src="${escapeHtml(supplementaryVideo(kind, entry.video_id, "keyframe", "sectionb"))}" controls playsinline preload="metadata"></video>
          </div>
        `)
        .join("");
      return `
        <article class="mini-card">
          <span class="tag ${CATEGORY_META[q.question_category]?.className || ""}">${categoryShort(q.question_category)}</span>
          <h3>${escapeHtml(q.furniture_name)} / ${escapeHtml(q.video_id)}</h3>
          <p>${escapeHtml(q.question.raw_qstr)}</p>
          ${videos}
        </article>
      `;
    })
    .join("");
}

function renderSelfExplanationExamples() {
  const container = $("#self-explanation-examples");
  if (!container) return;
  container.innerHTML = state.selfExplanations
    .map((entry) => {
      const q = entry.question;
      const responses = flattenResponses(entry.responses).slice(0, 2);
      const tags = (entry.cot_error_tags || [])
        .map((tag) => `<span class="pill">${escapeHtml(tag.join(" "))}</span>`)
        .join("");
      return `
        <article class="mini-card">
          <span class="tag ${CATEGORY_META[q.question_category]?.className || ""}">${categoryShort(q.question_category)}</span>
          <h3>${escapeHtml(q.furniture_name)} / ${escapeHtml(q.video_id)}</h3>
          <p>${escapeHtml(q.question.raw_qstr)}</p>
          <div class="question-meta">${tags}</div>
          ${responses.map((response) => renderResponseCard(response, q)).join("")}
        </article>
      `;
    })
    .join("");
}

function renderTvaExamples() {
  const container = $("#tva-examples");
  if (!container) return;
  container.innerHTML = state.tvaExamples
    .map((entry) => {
      const q = entry.question;
      const responses = flattenResponses(entry.responses).slice(0, 2);
      return `
        <article class="mini-card">
          <span class="tag ${CATEGORY_META[q.question_category]?.className || ""}">${categoryShort(q.question_category)}</span>
          <h3>${escapeHtml(q.furniture_name)} / ${escapeHtml(q.video_id)}</h3>
          <video src="assets/supplementary/sectiond/walkthrough_${escapeHtml(entry.video_id)}.mp4" controls playsinline preload="metadata"></video>
          <p>${escapeHtml(q.question.raw_qstr)}</p>
          ${responses.map((response) => renderResponseCard(response, q)).join("")}
        </article>
      `;
    })
    .join("");
}

function renderQuestion(q, options = {}) {
  const meta = CATEGORY_META[q.question_category] || { label: q.question_category, short: q.question_category, className: "" };
  const title = options.title || "Question";
  const promptStatus = promptAvailabilityLabel(q);
  return `
    <div class="question-card">
      <div class="question-meta">
        <span class="tag ${meta.className}">${meta.short}</span>
        <span class="pill">${escapeHtml(categoryLabel(q.question_category))}</span>
        <span class="pill">${escapeHtml(q.template_type)}</span>
        <span class="pill">${escapeHtml(q.vid_category)} / ${escapeHtml(q.furniture_name)}</span>
        <span class="pill">${escapeHtml(q.video_id)}</span>
        ${promptStatus ? `<span class="pill">${promptStatus}</span>` : ""}
      </div>
      <h3>${escapeHtml(title)}</h3>
      <p class="question-text">${escapeHtml(q.question.raw_qstr)}</p>
      ${renderOptions(q)}
    </div>
  `;
}

function renderOptions(q) {
  const correct = q.question.correct_option || {};
  const options = Object.entries(q.question.options || {}).sort(([a], [b]) => Number(a) - Number(b));
  return `
    <ul class="option-list">
      ${options
        .map(([key, option]) => {
          const isCorrect = Number(key) === Number(correct.idx) || option.label === correct.label;
          return `<li class="${isCorrect ? "correct" : ""}"><strong>${escapeHtml(option.label)}.</strong> ${escapeHtml(option.text || option.full_text || "")}</li>`;
        })
        .join("")}
    </ul>
  `;
}

function renderPromptTiles(specs) {
  if (!specs || specs.length === 0) {
    return `<div class="prompt-tile"><div class="prompt-fallback">Prompt image unavailable</div></div>`;
  }
  return specs
    .map((spec) => {
      if (!spec.available && spec.available !== undefined) {
        return promptFallback(spec);
      }
      return `
        <figure class="prompt-tile">
          <button class="prompt-image-button" type="button" data-overlay-src="${escapeHtml(spec.src)}" data-overlay-label="${escapeHtml(spec.label || "Prompt image")}">
            <img src="${escapeHtml(spec.src)}" alt="${escapeHtml(spec.label)}" data-fallback="${escapeHtml(spec.original || spec.label)}">
          </button>
        </figure>
      `;
    })
    .join("");
}

function promptFallback(spec) {
  return `
    <div class="prompt-tile">
      <div class="prompt-fallback">
        <strong>${escapeHtml(spec.label || "Prompt image")}</strong>
        <span>Prompt image unavailable</span>
        ${spec.original ? `<small>${escapeHtml(spec.original)}</small>` : ""}
      </div>
    </div>
  `;
}

function promptAvailabilityLabel(q) {
  const specs = state.manifest.questionPromptImages?.[q.qid_flat];
  if (!specs) return "";
  const available = specs.filter((spec) => spec.available).length;
  if (available === specs.length) return "Prompt available";
  if (available > 0) return `${available}/${specs.length} prompts available`;
  return "Prompt fallback";
}

function flattenResponses(responses = {}) {
  const rows = [];
  Object.entries(responses).forEach(([model, byVideo]) => {
    Object.entries(byVideo || {}).forEach(([video, byPrompt]) => {
      Object.entries(byPrompt || {}).forEach(([prompt, payload]) => {
        const normalized = normalizeResponse(payload);
        rows.push({
          model,
          video,
          prompt,
          answer: payload?.post_processed_response || normalized.answer || "",
          raw: normalized.raw,
          thoughts: normalized.thoughts,
        });
      });
    });
  });
  return rows.sort((a, b) => `${a.model}${a.video}${a.prompt}`.localeCompare(`${b.model}${b.video}${b.prompt}`));
}

function normalizeResponse(payload = {}) {
  const response = payload.response ?? payload;
  if (typeof response === "string") {
    return { raw: response, thoughts: [], answer: extractAnswer(response) };
  }
  if (response && typeof response === "object") {
    const raw = typeof response.response === "string" ? response.response : JSON.stringify(response, null, 2);
    return {
      raw,
      thoughts: Array.isArray(response.thoughts) ? response.thoughts : [],
      answer: extractAnswer(raw),
    };
  }
  return { raw: "", thoughts: [], answer: "" };
}

function renderResponseCard(response, q) {
  const correct = q.question?.correct_option?.label;
  const verdict = typeof response.correct === "boolean"
    ? (response.correct ? "correct" : "incorrect")
    : (correct && response.answer ? (response.answer === correct ? "correct" : "incorrect") : "");
  const thoughts = response.thoughts?.length ? `\n\n${response.thoughts.join("\n\n")}` : "";
  const setting = response.settingLabel || `${response.video || ""} / ${response.prompt || ""}`.trim();
  return `
    <article class="response-card">
      <strong>${escapeHtml(response.model)}</strong>
      <p>${escapeHtml(setting)}${verdict ? ` - ${verdict}` : ""}</p>
      ${response.answer ? `<span class="answer-badge">Answer ${escapeHtml(response.answer)}</span>` : ""}
      <details>
        <summary>Response</summary>
        <pre class="response-text">${escapeHtml(`${response.raw}${thoughts}`.trim())}</pre>
      </details>
    </article>
  `;
}

function renderModelResponsesForQuestion(q) {
  const rows = state.modelResponses.responsesByQuestion?.[q.qid_flat] || [];
  if (!rows.length) {
    return `<div class="empty-state">No model responses available for this question.</div>`;
  }
  return `
    <section class="model-response-section" aria-label="Model responses">
      <h3>Model responses</h3>
      <div class="response-grid">
        ${rows.map((response) => renderResponseCard(response, q)).join("")}
      </div>
    </section>
  `;
}

function supplementaryPromptSpecs(q, root) {
  const frame = q.frame_idx;
  if (Array.isArray(frame)) {
    return [
      {
        label: "Image A",
        src: `${root}/${q.video_id}_${pad(frame[0])}.jpg`,
        original: `${q.video_id}_${pad(frame[0])}.jpg`,
      },
      {
        label: "Image B",
        src: `${root}/${q.video_id}_${pad(frame[1])}_jumbled.jpg`,
        original: `${q.video_id}_${pad(frame[1])}_jumbled.jpg`,
      },
    ];
  }
  return [
    {
      label: "Visual Prompt",
      src: `${root}/${q.video_id}_${pad(frame)}.jpg`,
      original: `${q.video_id}_${pad(frame)}.jpg`,
    },
  ];
}

function supplementaryVideo(promptKind, videoId, mode, section = "sep") {
  if (section === "sectionb") {
    return `assets/supplementary/sectionb/${promptKind}/${videoId}_${mode}.mp4`;
  }
  return `assets/supplementary/${section}/${videoId}_${mode}.mp4`;
}

function setupGlobalEvents() {
  document.addEventListener("click", (event) => {
    const promptButton = event.target.closest(".prompt-image-button[data-overlay-src]");
    if (promptButton) {
      openImageOverlay(promptButton.dataset.overlaySrc, promptButton.dataset.overlayLabel);
      return;
    }
    if (event.target.closest(".image-overlay-close") || event.target.id === "image-overlay") {
      closeImageOverlay();
    }
  });

  document.addEventListener(
    "error",
    (event) => {
      if (!(event.target instanceof HTMLImageElement) || !event.target.dataset.fallback) return;
      const tile = event.target.closest(".prompt-tile");
      const cell = event.target.closest(".viewer-media-cell");
      const fallback = promptFallback({
        label: event.target.alt,
        original: event.target.dataset.fallback,
      });
      if (tile) {
        tile.outerHTML = fallback;
      } else if (cell) {
        cell.insertAdjacentHTML("afterbegin", fallback);
        event.target.closest(".prompt-image-button")?.remove();
      }
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#image-overlay")?.hidden) {
      closeImageOverlay();
      return;
    }
    if (!$("#image-overlay")?.hidden) return;
    const tagName = document.activeElement?.tagName;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return;
    if (state.viewerMode !== "full") return;
    if (["ArrowRight", "ArrowDown", "j", "J"].includes(event.key)) {
      moveDatasetSelection(1);
    }
    if (["ArrowLeft", "ArrowUp", "k", "K"].includes(event.key)) {
      moveDatasetSelection(-1);
    }
  });
}

function openImageOverlay(src, label = "Prompt image") {
  const overlay = $("#image-overlay");
  if (!overlay || !src) return;
  const image = $("img", overlay);
  const caption = $("figcaption", overlay);
  image.src = src;
  image.alt = label;
  caption.textContent = label;
  overlay.hidden = false;
  document.body.classList.add("overlay-open");
  $(".image-overlay-close", overlay)?.focus();
}

function closeImageOverlay() {
  const overlay = $("#image-overlay");
  if (!overlay) return;
  overlay.hidden = true;
  const image = $("img", overlay);
  image.removeAttribute("src");
  document.body.classList.remove("overlay-open");
}

function compareRows(a, b, key, direction) {
  const aValue = a[key];
  const bValue = b[key];
  const multiplier = direction === "asc" ? 1 : -1;
  if (typeof aValue === "number" && typeof bValue === "number") {
    return (aValue - bValue) * multiplier;
  }
  return String(aValue).localeCompare(String(bValue)) * multiplier;
}

function extractAnswer(text) {
  const match = String(text).match(/"answer"\s*:\s*"([^"]+)"/i) || String(text).match(/\banswer\s*[:=]\s*([A-D])\b/i);
  return match ? match[1].trim() : "";
}

function videoKey(q) {
  return `${q.vid_category}/${q.furniture_name}/${q.video_id}`;
}

function categoryLabel(category) {
  return CATEGORY_META[category]?.label || category;
}

function categoryShort(category) {
  return CATEGORY_META[category]?.short || category;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
}

function pad(value) {
  return String(value ?? 0).padStart(3, "0");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatScore(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
