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

const REVEAL_STORAGE_KEY = "flatpack:showGroundTruthAndResponses";
const REVEAL_SHOW_LABEL = "Click to see the ground-truth and model responses!";
const REVEAL_HIDE_LABEL = "Hide the ground-truth and model responses";
const VISUAL_PROMPT_FORMATS = ["sep", "collage", "concat"];
const RESULT_FILTER_LABELS = {
  model: "Model",
  prompt: "Prompt",
  video: "Video",
};
const RESULTS_TABLE_HASHES = new Set(["#zero-shot-results", "#results-table-region", "#results-table"]);
const TASK_DECOMPOSITION_HASHES = new Set(["#task-decomposition-viewer", "#task-decomposition"]);
const ERROR_PIE_SLICES = [
  { key: "object", start: 0, end: 37.28 },
  { key: "spatiotemporal", start: 37.28, end: 69.73 },
  { key: "temporal", start: 69.73, end: 87.71 },
  { key: "physical", start: 87.71, end: 95.6 },
  { key: "language", start: 95.6, end: 100 },
];

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
  fpbGameIndex: 0,
  fpbGameSelections: {},
  fpbGameRevealed: false,
  visualPromptIndex: 0,
  visualPromptFormat: "sep",
  selfExplanationIndex: 0,
  selfExplanationModel: "Gemini 2.5 Pro",
  tvaExampleIndex: 0,
  datasetVideoMode: "keyframe",
  currentQid: "",
  filteredQuestions: [],
  showGroundTruthAndResponses: false,
  resultsSort: { key: "micro", direction: "desc" },
  resultsFilters: [],
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

setupTableOfContents();
setupAffiliationHover();
setupBibtexCopy();
setupErrorPieHover();

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
  state.showGroundTruthAndResponses = readRevealPreference();

  renderBenchmarkStats();
  setupFpbGame();
  setupDatasetViewer();
  setupResultsTable();
  renderSupplementaryExplorers();
  setupDatasetHashDeepLink();
  setupVisualPromptHashDeepLink();
  setupSelfExplanationHashDeepLink();
  setupTaskDecompositionHashDeepLink();
  setupGlobalEvents();
  setupTrackingPromptResize();
  syncRevealControls();
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

function setupAffiliationHover() {
  const hoverRegions = $$(".hero-copy, .fpb-byline").filter(
    (region) => $(".authors", region) && $(".affiliation-logos", region),
  );
  if (hoverRegions.length === 0) return;

  const affiliations = ["cornell", "mbzuai", "ucb"];

  hoverRegions.forEach((region) => {
    const activate = (affiliation, source) => {
      region.dataset.activeAffiliation = affiliation;
      region.dataset.hoverSource = source;
    };
    const clear = (affiliation, source) => {
      if (
        region.dataset.activeAffiliation === affiliation &&
        region.dataset.hoverSource === source
      ) {
        delete region.dataset.activeAffiliation;
        delete region.dataset.hoverSource;
      }
    };

    affiliations.forEach((affiliation) => {
      const authors = $$(`.authors .affiliation-${affiliation}`, region);
      const logos = $$(`.affiliation-logos > .affiliation-${affiliation}`, region);

      authors.forEach((author) => {
        author.addEventListener("pointerenter", () => activate(affiliation, "author"));
        author.addEventListener("pointerleave", () => clear(affiliation, "author"));
        author.addEventListener("focus", () => activate(affiliation, "author"));
        author.addEventListener("blur", () => clear(affiliation, "author"));
      });

      logos.forEach((logo) => {
        logo.addEventListener("pointerenter", () => activate(affiliation, "logo"));
        logo.addEventListener("pointerleave", () => clear(affiliation, "logo"));
        logo.addEventListener("focus", () => activate(affiliation, "logo"));
        logo.addEventListener("blur", () => clear(affiliation, "logo"));
      });
    });
  });
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

function setupFpbGame() {
  const game = $("#fpb-game");
  if (!game) return;

  const tabs = $("#fpb-game-tabs", game);
  const detail = $("#fpb-game-detail", game);
  if (!tabs || !detail) return;

  if (state.examples.length === 0) {
    detail.innerHTML = `<div class="empty-state">Curated examples are unavailable.</div>`;
    return;
  }

  renderFpbGameTabs();
  renderFpbGameDetail();

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fpb-game-index]");
    if (!button) return;
    selectFpbGameIndex(Number(button.dataset.fpbGameIndex));
  });

  tabs.addEventListener("keydown", (event) => {
    handleFpbGameNavigationKey(event, { focusTab: true });
  });

  detail.addEventListener("click", (event) => {
    const option = event.target.closest("[data-fpb-game-option]");
    if (option) {
      const entry = state.examples[state.fpbGameIndex];
      const qid = entry?.question?.qid_flat;
      if (qid) {
        state.fpbGameSelections[qid] = option.dataset.fpbGameOption;
        syncFpbGameAnswerState();
      }
      return;
    }

    const reveal = event.target.closest("[data-fpb-game-reveal]");
    if (reveal) {
      const entry = state.examples[state.fpbGameIndex];
      const selected = entry?.question?.qid_flat ? state.fpbGameSelections[entry.question.qid_flat] : "";
      if (!selected) return;
      state.fpbGameRevealed = !state.fpbGameRevealed;
      syncFpbGameAnswerState();
    }
  });
}

function selectFpbGameIndex(index, options = {}) {
  if (!state.examples.length) return;

  const count = state.examples.length;
  const nextIndex = ((index % count) + count) % count;
  state.fpbGameIndex = nextIndex;
  state.fpbGameRevealed = false;
  renderFpbGameTabs();
  renderFpbGameDetail();

  if (options.focusTab) {
    requestAnimationFrame(() => {
      const activeTab = $(`#fpb-game-tabs [data-fpb-game-index="${state.fpbGameIndex}"]`);
      activeTab?.focus({ preventScroll: true });
    });
  }
}

function handleFpbGameNavigationKey(event, options = {}) {
  const action = fpbGameNavigationAction(event.key);
  if (action === null) return false;

  event.preventDefault();
  event.stopPropagation();
  if (action === "first") {
    selectFpbGameIndex(0, options);
  } else if (action === "last") {
    selectFpbGameIndex(state.examples.length - 1, options);
  } else {
    selectFpbGameIndex(state.fpbGameIndex + action, options);
  }
  return true;
}

function fpbGameNavigationAction(key) {
  if (["ArrowRight", "ArrowDown", "j", "J"].includes(key)) return 1;
  if (["ArrowLeft", "ArrowUp", "k", "K"].includes(key)) return -1;
  if (key === "Home") return "first";
  if (key === "End") return "last";
  return null;
}

function renderFpbGameTabs() {
  const tabs = $("#fpb-game-tabs");
  if (!tabs) return;

  tabs.innerHTML = state.examples
    .map((entry, index) => {
      const q = entry.question;
      const promptSpecs = supplementaryPromptSpecs(q, "assets/supplementary/sep");
      const thumb = promptSpecs.find((spec) => spec.src) || promptSpecs[0];
      const meta = CATEGORY_META[q.question_category] || {};
      const isActive = index === state.fpbGameIndex;
      const label = `Example ${pad(index + 1)} / ${meta.short || categoryShort(q.question_category)}`;
      return `
        <button
          type="button"
          role="tab"
          aria-label="${escapeHtml(label)} ${escapeHtml(exampleCaption(q))}"
          aria-selected="${String(isActive)}"
          aria-controls="fpb-game-detail"
          tabindex="${isActive ? "0" : "-1"}"
          data-fpb-game-index="${index}"
          class="fpb-game-thumb ${isActive ? "active" : ""} ${escapeHtml(meta.className || "")}"
        >
          <span class="fpb-game-thumb-image">
            ${thumb?.src ? `<img src="${escapeHtml(thumb.src)}" alt="">` : ""}
          </span>
        </button>
      `;
    })
    .join("");
}

function renderFpbGameDetail() {
  const detail = $("#fpb-game-detail");
  if (!detail) return;

  const entry = state.examples[state.fpbGameIndex];
  if (!entry) {
    detail.innerHTML = `<div class="empty-state">Select a curated example to inspect it.</div>`;
    return;
  }

  const q = entry.question;
  const meta = CATEGORY_META[q.question_category] || {};
  const promptSpecs = supplementaryPromptSpecs(q, "assets/supplementary/sep");
  const videoSrc = supplementaryVideo("sep", entry.video_id, "trimmed");
  const selected = state.fpbGameSelections[q.qid_flat] || "";
  const canReveal = Boolean(selected);

  detail.innerHTML = `
    <div class="fpb-game-panel dataset-detail-stack">
      ${renderFpbGameMedia(q, videoSrc, promptSpecs)}
      <div class="question-card">
        <div class="question-card-top">
          <div class="question-meta">
            <span class="tag ${escapeHtml(meta.className || "")}">${escapeHtml(meta.short || q.question_category)}</span>
          </div>
          <div class="reveal-control">
            <button
              class="reveal-toggle fpb-game-reveal"
              type="button"
              data-fpb-game-reveal
              aria-expanded="${String(state.fpbGameRevealed)}"
              ${canReveal ? "" : "disabled"}
            >${fpbGameRevealLabel(canReveal)}</button>
          </div>
        </div>
        <h3>Example ${pad(state.fpbGameIndex + 1)}</h3>
        <p class="question-text">${escapeHtml(q.question.raw_qstr)}</p>
        ${renderFpbGameOptions(q, selected)}
      </div>
      <div class="fpb-game-answer-slot" id="fpb-game-answer-slot" ${state.fpbGameRevealed ? "" : "hidden"}>
        ${state.fpbGameRevealed ? renderFpbGameAnswer(entry, q) : ""}
      </div>
    </div>
  `;

  scheduleTrackingPromptHeights(detail);
}

function renderFpbGameMedia(q, videoSrc, promptSpecs) {
  const sourceTags = `<source src="${escapeHtml(videoSrc)}" type="video/mp4">`;
  const videoCell = `
    <div class="viewer-media-cell viewer-video-cell">
      <video class="dataset-video" controls playsinline preload="metadata">${sourceTags}</video>
      <p class="media-hint">Trimmed video</p>
    </div>
  `;
  const specs = promptSpecs && promptSpecs.length ? promptSpecs : [{ label: "Visual Prompt", available: false }];
  const promptCells = specs
    .map((spec) => renderPromptMediaCell(spec))
    .join("");

  if (specs.length > 1) {
    return `
      <div class="viewer-media-tracking dataset-media" style="--prompt-count: ${specs.length};">
        ${videoCell}
        ${renderPromptStackCell(specs)}
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

function renderFpbGameOptions(q, selected) {
  const correct = q.question.correct_option || {};
  const options = Object.entries(q.question.options || {}).sort(([a], [b]) => Number(a) - Number(b));
  return `
    <ul class="fpb-game-options" role="radiogroup" aria-label="Answer options">
      ${options
        .map(([key, option]) => {
          const label = option.label || key;
          const isSelected = selected === label;
          const isCorrect = Number(key) === Number(correct.idx) || label === correct.label;
          const resultClass = state.fpbGameRevealed && isCorrect
            ? " is-correct"
            : state.fpbGameRevealed && isSelected
              ? " is-incorrect"
              : "";
          return `
            <li>
              <button
                type="button"
                role="radio"
                aria-checked="${String(isSelected)}"
                data-fpb-game-option="${escapeHtml(label)}"
                class="${isSelected ? "is-selected" : ""}${resultClass}"
              >
                <strong>${escapeHtml(label)}.</strong>
                <span>${escapeHtml(option.text || option.full_text || "")}</span>
              </button>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function syncFpbGameAnswerState() {
  const entry = state.examples[state.fpbGameIndex];
  const q = entry?.question;
  if (!entry || !q) return;

  const selected = state.fpbGameSelections[q.qid_flat] || "";
  const correct = q.question.correct_option || {};

  $$("#fpb-game-detail [data-fpb-game-option]").forEach((button) => {
    const label = button.dataset.fpbGameOption;
    const isSelected = selected === label;
    const isCorrect = label === correct.label;
    button.setAttribute("aria-checked", String(isSelected));
    button.classList.toggle("is-selected", isSelected);
    button.classList.toggle("is-correct", state.fpbGameRevealed && isCorrect);
    button.classList.toggle("is-incorrect", state.fpbGameRevealed && isSelected && !isCorrect);
  });

  const reveal = $("#fpb-game-detail [data-fpb-game-reveal]");
  if (reveal) {
    const canReveal = Boolean(selected);
    reveal.disabled = !canReveal;
    reveal.setAttribute("aria-expanded", String(state.fpbGameRevealed));
    reveal.textContent = fpbGameRevealLabel(canReveal);
  }

  const answerSlot = $("#fpb-game-answer-slot");
  if (answerSlot) {
    answerSlot.hidden = !state.fpbGameRevealed;
    answerSlot.innerHTML = state.fpbGameRevealed ? renderFpbGameAnswer(entry, q) : "";
  }
}

function renderFpbGameAnswer(entry, q) {
  const modelRows = state.modelResponses.responsesByQuestion?.[q.qid_flat] || [];
  const rows = modelRows.length ? modelRows : flattenResponses(entry.responses);
  const correct = q.question?.correct_option || {};
  const correctText = correct.full_text || `${correct.label}. ${correct.text || ""}`.trim();

  return `
    <section class="model-response-section fpb-game-answer" aria-label="Challenge answer">
      <h3>Ground truth and LVLM answers</h3>
      <p class="fpb-game-ground-truth"><strong>Ground truth:</strong> ${escapeHtml(correctText)}</p>
      ${rows.length ? `
        <div class="response-grid">
          ${rows.map((response) => renderFpbGameResponseCard(response, q)).join("")}
        </div>
      ` : `<div class="empty-state">No model responses available for this example.</div>`}
    </section>
  `;
}

function renderFpbGameResponseCard(response, q) {
  const correct = q.question?.correct_option?.label;
  const verdict = typeof response.correct === "boolean"
    ? (response.correct ? "correct" : "incorrect")
    : (correct && response.answer ? (response.answer === correct ? "correct" : "incorrect") : "");
  const thoughts = response.thoughts?.length ? `\n\n${response.thoughts.join("\n\n")}` : "";
  const setting = response.settingLabel || `${response.video || ""} / ${response.prompt || ""}`.trim();
  return `
    <article class="response-card">
      <strong>${escapeHtml(response.model)}</strong>
      <p>${escapeHtml(setting)}</p>
      ${renderAnswerBadge(response.answer, verdict)}
      <details>
        <summary>Response</summary>
        <pre class="response-text">${escapeHtml(`${response.raw || ""}${thoughts}`.trim())}</pre>
      </details>
    </article>
  `;
}

function setupCuratedControls() {
  const tabs = $("#example-tabs");
  if (!tabs || state.examples.length === 0) return;

  const sampleCount = $("#sample-count");
  if (sampleCount) {
    sampleCount.textContent = `${state.examples.length} curated sample${state.examples.length === 1 ? "" : "s"}`;
  }

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
      ${state.showGroundTruthAndResponses ? renderModelResponsesForQuestion(q) : ""}
    </div>
  `;
}

function setupDatasetViewer() {
  const hasCuratedViewer = Boolean($("#curated-sample-view") && $("#example-tabs"));
  if (hasCuratedViewer) {
    setupCuratedControls();
  }
  renderCategoryLegend("#dataset-legend");
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
    state.viewerMode = viewer === "full" || !hasCuratedViewer ? "full" : "curated";
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
  const hasCuratedViewer = Boolean($("#curated-sample-view") && $("#example-tabs"));
  state.viewerMode = mode === "full" || !hasCuratedViewer ? "full" : "curated";
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
  const hasCuratedViewer = Boolean($("#curated-sample-view") && $("#example-tabs"));
  const isFull = state.viewerMode === "full" || !hasCuratedViewer;
  state.viewerMode = isFull ? "full" : "curated";
  $("#curated-sample-view")?.toggleAttribute("hidden", isFull);
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
      ${state.showGroundTruthAndResponses ? renderModelResponsesForQuestion(q) : ""}
    </div>
  `;

  scheduleTrackingPromptHeights(detail);

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

  const specs = promptSpecs && promptSpecs.length ? promptSpecs : [{ label: "Visual Prompt", available: false }];
  const promptCells = specs
    .map((spec) => renderPromptMediaCell(spec))
    .join("");

  if (specs.length > 1) {
    return `
      <div class="viewer-media-tracking dataset-media" style="--prompt-count: ${specs.length};">
        ${videoCell}
        ${renderPromptStackCell(specs)}
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

function renderPromptStackCell(promptSpecs) {
  const specs = promptSpecs && promptSpecs.length ? promptSpecs : [{ label: "Visual Prompt", available: false }];
  return `
    <div class="viewer-media-cell viewer-prompt-stack-cell">
      <div class="viewer-media-image-stack" style="--prompt-count: ${specs.length};">
        ${specs.map((spec) => renderPromptStackTile(spec)).join("")}
      </div>
    </div>
  `;
}

function renderPromptStackTile(spec) {
  const label = spec.label || "Prompt image";
  if (!spec.available && spec.available !== undefined) {
    return `
      <figure class="viewer-prompt-stack-figure">
        ${promptFallback(spec)}
        <figcaption class="media-hint">${escapeHtml(label)}</figcaption>
      </figure>
    `;
  }

  return `
    <figure class="viewer-prompt-stack-figure">
      <div class="prompt-tile">
        <button class="prompt-image-button" type="button" data-overlay-src="${escapeHtml(spec.src)}" data-overlay-label="${escapeHtml(label)}">
          <img src="${escapeHtml(spec.src)}" alt="${escapeHtml(label)}" data-fallback="${escapeHtml(spec.original || label)}">
        </button>
      </div>
      <figcaption class="media-hint">${escapeHtml(label)}</figcaption>
    </figure>
  `;
}

function setupTrackingPromptResize() {
  window.addEventListener("resize", () => scheduleTrackingPromptHeights());
}

function scheduleTrackingPromptHeights(root = document) {
  requestAnimationFrame(() => syncTrackingPromptHeights(root));
}

function syncTrackingPromptHeights(root = document) {
  const layouts = root instanceof Element && root.matches(".viewer-media-tracking")
    ? [root]
    : $$(".viewer-media-tracking", root);

  layouts.forEach((layout) => {
    const media = $(":scope > .viewer-video-cell video, :scope > .viewer-video-cell .missing-video", layout);
    const stack = $(".viewer-media-image-stack", layout);
    if (!media || !stack) return;

    const applyHeight = () => {
      if (window.matchMedia("(max-width: 700px)").matches) {
        stack.style.height = "";
        return;
      }
      const height = media.getBoundingClientRect().height;
      if (height > 0) {
        stack.style.height = `${Math.round(height)}px`;
      }
    };

    applyHeight();

    if (!layout.dataset.promptHeightBound && media instanceof HTMLVideoElement) {
      ["loadedmetadata", "loadeddata", "resize"].forEach((eventName) => {
        media.addEventListener(eventName, applyHeight);
      });
      layout.dataset.promptHeightBound = "true";
    }
  });
}

function moveDatasetSelection(step) {
  if (state.filteredQuestions.length === 0) return;
  const index = state.filteredQuestions.findIndex((q) => q.qid_flat === state.currentQid);
  const nextIndex = clamp(index + step, 0, state.filteredQuestions.length - 1);
  selectDatasetQuestion(state.filteredQuestions[nextIndex].qid_flat);
  $("#question-list button.active")?.scrollIntoView({ block: "nearest" });
}

function moveCuratedSelection(step) {
  if (state.examples.length === 0) return;
  state.exampleIndex = clamp(state.exampleIndex + step, 0, state.examples.length - 1);
  renderCuratedDetail();
  $("#example-tabs button.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function isDatasetViewerKeyboardContext() {
  const viewer = $("#dataset-viewer");
  if (!viewer) return false;
  if (viewer.contains(document.activeElement)) return true;

  const rect = viewer.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

function isFpbGameKeyboardContext() {
  const game = $("#fpb-game");
  if (!game) return false;
  if (game.contains(document.activeElement)) return true;

  const rect = game.getBoundingClientRect();
  const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  return visibleHeight >= Math.min(240, rect.height * 0.25);
}

function handleSupplementaryExplorerNavigationKey(event) {
  const action = fpbGameNavigationAction(event.key);
  if (action === null) return false;

  const target = activeSupplementaryExplorer();
  if (!target) return false;

  event.preventDefault();
  event.stopPropagation();
  if (target === "visual-prompts") {
    if (action === "first") {
      selectVisualPromptExample(0);
    } else if (action === "last") {
      selectVisualPromptExample(state.visualPrompts.length - 1);
    } else {
      moveVisualPromptExample(action);
    }
  } else if (target === "self-explanations") {
    if (action === "first") {
      selectSelfExplanationExample(0);
    } else if (action === "last") {
      selectSelfExplanationExample(state.selfExplanations.length - 1);
    } else {
      moveSelfExplanationExample(action);
    }
  } else if (target === "task-decomposition") {
    if (action === "first") {
      selectTvaExample(0);
    } else if (action === "last") {
      selectTvaExample(state.tvaExamples.length - 1);
    } else {
      moveTvaExample(action);
    }
  }
  return true;
}

function activeSupplementaryExplorer() {
  const contexts = [
    { name: "visual-prompts", context: supplementaryDetailsKeyboardContext("#visual-prompts") },
    { name: "self-explanations", context: supplementaryDetailsKeyboardContext("#self-explanation-viewer") },
    { name: "task-decomposition", context: supplementaryDetailsKeyboardContext("#task-decomposition-viewer") },
  ];
  const focused = contexts.find((item) => item.context.focused);
  if (focused) return focused.name;
  const visible = contexts
    .filter((item) => item.context.visible)
    .sort((a, b) => b.context.visibleHeight - a.context.visibleHeight);
  return visible[0]?.name || "";
}

function supplementaryDetailsKeyboardContext(selector) {
  const details = $(selector);
  if (!details || !details.open) {
    return { focused: false, visible: false, visibleHeight: 0 };
  }
  const focused = details.contains(document.activeElement);
  const rect = details.getBoundingClientRect();
  const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  return {
    focused,
    visible: visibleHeight >= Math.min(220, rect.height * 0.25),
    visibleHeight,
  };
}

function setupResultsTable() {
  updateResultsFilterOptions();

  $("#results-search")?.addEventListener("input", renderResultsTable);
  $("#results-filter-field")?.addEventListener("change", () => {
    const input = $("#results-filter-value");
    if (input) input.value = "";
    updateResultsFilterOptions();
  });
  $("#results-filter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    addResultsFilter($("#results-filter-field")?.value, $("#results-filter-value")?.value);
    const input = $("#results-filter-value");
    if (input) {
      input.value = "";
      input.focus();
    }
  });
  $("#active-results-filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter-field]");
    if (!button) return;
    removeResultsFilter(button.dataset.filterField, button.dataset.filterValue);
  });
  $("#results-table tbody")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-result-filter-field]");
    if (!button) return;
    addResultsFilter(button.dataset.resultFilterField, button.dataset.resultFilterValue);
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
  setupResultsTableHashDeepLink();
}

function toggleResultsTable() {
  const button = $("#results-toggle");
  if (!button) return;
  setResultsTableOpen(button.getAttribute("aria-expanded") !== "true");
}

function setResultsTableOpen(shouldOpen) {
  const button = $("#results-toggle");
  const region = $("#results-table-region");
  const label = $("[data-results-toggle-label]", button);
  if (!button || !region) return;
  button.setAttribute("aria-expanded", String(shouldOpen));
  region.hidden = !shouldOpen;
  if (label) {
    label.textContent = shouldOpen ? "Collapse" : "Expand";
  }
}

function setupResultsTableHashDeepLink() {
  const openResultsTable = () => {
    if (!RESULTS_TABLE_HASHES.has(window.location.hash)) return;
    setResultsTableOpen(true);
    const target = $("#zero-shot-results") || $("#results-table-region");
    const scrollToTarget = () => target?.scrollIntoView({ block: "start" });
    requestAnimationFrame(scrollToTarget);
    window.setTimeout(scrollToTarget, 250);
    window.setTimeout(scrollToTarget, 1000);
  };

  window.addEventListener("hashchange", openResultsTable);
  openResultsTable();
}

function renderResultsTable() {
  const tbody = $("#results-table tbody");
  if (!tbody) return;
  const search = ($("#results-search")?.value || "").trim().toLowerCase();
  const groupedFilters = groupResultsFilters();

  const rows = state.results
    .filter((row) => {
      const haystack = [row.model, row.prompt, row.video].join(" ").toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (!matchesResultsFilters(row, groupedFilters)) return false;
      return true;
    })
    .sort((a, b) => compareRows(a, b, state.resultsSort.key, state.resultsSort.direction));

  const count = $("#results-count");
  if (count) {
    count.textContent = `${rows.length} configuration${rows.length === 1 ? "" : "s"}`;
  }

  updateResultsFiltersUi();

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td class="empty-table" colspan="9">No configurations match the current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(renderResultsRow).join("");
}

function renderResultsRow(row) {
  return `
    <tr>
      <td>${renderResultsFilterButton("model", row.model)}</td>
      <td>${renderResultsFilterButton("prompt", row.prompt)}</td>
      <td>${renderResultsFilterButton("video", row.video)}</td>
      <td class="num">${formatScore(row.micro)}</td>
      <td class="num">${escapeHtml(row.ci || "")}</td>
      <td class="num">${formatScore(row.tord)}</td>
      <td class="num">${formatScore(row.tloc)}</td>
      <td class="num">${formatScore(row.track)}</td>
      <td class="num">${formatScore(row.mate)}</td>
    </tr>
  `;
}

function renderResultsFilterButton(field, value) {
  return `
    <button
      type="button"
      class="result-filter-button"
      data-result-filter-field="${escapeHtml(field)}"
      data-result-filter-value="${escapeHtml(value)}"
      title="Filter by ${escapeHtml(RESULT_FILTER_LABELS[field] || field)}: ${escapeHtml(value)}"
    >${escapeHtml(value)}</button>
  `;
}

function addResultsFilter(field, value) {
  if (!Object.prototype.hasOwnProperty.call(RESULT_FILTER_LABELS, field)) return;
  const canonical = canonicalResultFilterValue(field, value);
  if (!canonical) return;
  const exists = state.resultsFilters.some((filter) => filter.field === field && filter.value === canonical);
  if (exists) return;
  state.resultsFilters.push({ field, value: canonical });
  renderResultsTable();
}

function removeResultsFilter(field, value) {
  state.resultsFilters = state.resultsFilters.filter((filter) => !(filter.field === field && filter.value === value));
  renderResultsTable();
}

function groupResultsFilters() {
  return state.resultsFilters.reduce((groups, filter) => {
    if (!groups[filter.field]) groups[filter.field] = [];
    groups[filter.field].push(filter.value);
    return groups;
  }, {});
}

function matchesResultsFilters(row, groupedFilters) {
  return Object.entries(groupedFilters).every(([field, values]) => values.some((value) => row[field] === value));
}

function updateResultsFilterOptions() {
  const field = $("#results-filter-field")?.value || "model";
  const options = $("#results-filter-options");
  if (!options) return;
  options.innerHTML = resultFilterValues(field)
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join("");
}

function resultFilterValues(field) {
  if (!Object.prototype.hasOwnProperty.call(RESULT_FILTER_LABELS, field)) return [];
  return unique(state.results.map((row) => row[field]));
}

function canonicalResultFilterValue(field, value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const match = resultFilterValues(field).find((candidate) => String(candidate).toLowerCase() === normalized.toLowerCase());
  return match || normalized;
}

function updateResultsFiltersUi() {
  const container = $("#active-results-filters");
  if (!container) return;
  if (state.resultsFilters.length === 0) {
    container.innerHTML = `<span class="results-meta">Tip: click a model, prompt, or video to pin it as a filter.</span>`;
    return;
  }
  container.innerHTML = state.resultsFilters
    .map((filter) => `
      <span class="filter-pill">
        ${escapeHtml(RESULT_FILTER_LABELS[filter.field] || filter.field)}: ${escapeHtml(filter.value)}
        <button
          type="button"
          aria-label="Remove ${escapeHtml(RESULT_FILTER_LABELS[filter.field] || filter.field)} filter ${escapeHtml(filter.value)}"
          data-filter-field="${escapeHtml(filter.field)}"
          data-filter-value="${escapeHtml(filter.value)}"
        >x</button>
      </span>
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

  if (state.visualPrompts.length === 0) {
    container.innerHTML = `<div class="empty-state">Visual prompt examples are unavailable.</div>`;
    return;
  }

  state.visualPromptIndex = clamp(state.visualPromptIndex, 0, state.visualPrompts.length - 1);
  container.innerHTML = `
    <div class="prompt-type-browser" tabindex="0" aria-label="Visual prompt example browser">
      <div class="detail-nav prompt-type-nav">
        <span class="results-meta">Question ${pad(state.visualPromptIndex + 1)} of ${pad(state.visualPrompts.length)}</span>
      </div>
      <div class="segmented prompt-type-rail" role="tablist" aria-label="Visual prompt examples">
        ${state.visualPrompts
          .map((entry, index) => {
            const q = entry.question;
            const meta = CATEGORY_META[q.question_category] || {};
            const active = index === state.visualPromptIndex;
            return `
              <button
                type="button"
                role="tab"
                aria-selected="${String(active)}"
                data-visual-prompt-index="${index}"
                class="${active ? "active" : ""} ${escapeHtml(meta.className || "")}"
                title="${escapeHtml(categoryShort(q.question_category))}"
              >${pad(index + 1)}</button>
            `;
          })
          .join("")}
      </div>
      <div id="visual-prompt-example-detail">
        ${renderVisualPromptExampleDetail(state.visualPrompts[state.visualPromptIndex], state.visualPromptIndex)}
      </div>
    </div>
  `;

  container.querySelectorAll("[data-visual-prompt-index]").forEach((button) => {
    button.addEventListener("click", () => selectVisualPromptExample(Number(button.dataset.visualPromptIndex)));
  });
  container.querySelector("[data-visual-prompt-format]")?.addEventListener("change", (event) => {
    selectVisualPromptFormat(event.target.value);
  });
  scheduleTrackingPromptHeights(container);
}

function renderVisualPromptExampleDetail(entry, index) {
  if (!entry) return `<div class="empty-state">Select an example to inspect it.</div>`;

  const q = entry.question;
  const selectedFormat = currentVisualPromptFormat();
  const promptSpecs = supplementaryPromptSpecs(q, "assets/supplementary/sectionb/sep");

  return `
    <div class="dataset-detail-stack">
      <div class="prompt-format-control">
        <label>
          Prompt format
          <select data-visual-prompt-format>
            ${VISUAL_PROMPT_FORMATS
              .map((format) => `
                <option value="${escapeHtml(format)}" ${format === selectedFormat ? "selected" : ""}>
                  ${escapeHtml(promptKindLabel(format))}
                </option>
              `)
              .join("")}
          </select>
        </label>
        <div class="prompt-format-notes">
          <p class="media-hint">${escapeHtml(promptKindDescription(selectedFormat))}</p>
          <p class="media-hint">All videos in this viewer are key-frame videos.</p>
        </div>
      </div>
      ${renderSelectedVisualPromptMedia(entry, selectedFormat, promptSpecs)}
      ${renderQuestion(q, { includeTitle: false, includeIndex: false, includeReveal: false, showCorrectOption: true })}
      ${renderVisualPromptResponses(entry, selectedFormat)}
    </div>
  `;
}

function renderSelectedVisualPromptMedia(entry, selectedFormat, promptSpecs) {
  const videoCell = `
    <div class="viewer-media-cell viewer-video-cell prompt-setting-cell">
      <video src="${escapeHtml(supplementaryVideo(selectedFormat, entry.video_id, "keyframe", "sectionb"))}" controls playsinline preload="metadata"></video>
    </div>
  `;

  if (selectedFormat === "sep") {
    if (promptSpecs.length > 1) {
      return `
        <div class="viewer-media-tracking dataset-media prompt-type-video-row" style="--prompt-count: ${promptSpecs.length};">
          ${videoCell}
          ${renderPromptStackCell(promptSpecs)}
        </div>
      `;
    }

    return `
      <div class="viewer-media-row dataset-media prompt-type-video-row">
        ${videoCell}
        ${promptSpecs.map((spec) => renderPromptMediaCell(spec)).join("")}
      </div>
    `;
  }

  return `
    <div class="viewer-media-row dataset-media prompt-type-video-row prompt-type-single-media">
      ${videoCell}
    </div>
  `;
}

function currentVisualPromptFormat() {
  return VISUAL_PROMPT_FORMATS.includes(state.visualPromptFormat) ? state.visualPromptFormat : "sep";
}

function selectVisualPromptFormat(format) {
  if (!VISUAL_PROMPT_FORMATS.includes(format)) return;
  state.visualPromptFormat = format;
  renderVisualPromptExamples();
}

function renderVisualPromptResponses(entry, selectedFormat) {
  const q = entry.question;
  const correct = q.question?.correct_option || {};
  const correctText = correct.full_text || `${correct.label}. ${correct.text || ""}`.trim();
  const rows = visualPromptResponseRows(entry, selectedFormat);

  return `
    <section class="model-response-section prompt-response-section" aria-label="Key-frame model responses">
      <h3>Ground truth and key-frame model responses</h3>
      <p class="prompt-ground-truth"><strong>Ground truth:</strong> ${escapeHtml(correctText)}</p>
      ${rows.length ? `
        <div class="response-grid">
          ${rows.map((response) => renderVisibleResponseCard(response, q)).join("")}
        </div>
      ` : `<div class="empty-state">No key-frame model responses available for this prompt format.</div>`}
    </section>
  `;
}

function visualPromptResponseRows(entry, selectedFormat) {
  return flattenResponses(entry.responses)
    .filter((response) => response.video === "keyframe" && response.prompt === selectedFormat)
    .map((response) => ({
      ...response,
      settingLabel: `Key-frame / ${promptKindLabel(selectedFormat)}`,
    }));
}

function renderVisibleResponseCard(response, q) {
  const correct = q.question?.correct_option?.label;
  const verdict = typeof response.correct === "boolean"
    ? (response.correct ? "correct" : "incorrect")
    : (correct && response.answer ? (response.answer === correct ? "correct" : "incorrect") : "");
  const thoughts = response.thoughts?.length ? `\n\n${response.thoughts.join("\n\n")}` : "";
  const setting = response.settingLabel || `${response.video || ""} / ${response.prompt || ""}`.trim();
  return `
    <article class="response-card">
      <strong>${escapeHtml(response.model)}</strong>
      <p>${escapeHtml(setting)}</p>
      ${renderAnswerBadge(response.answer, verdict)}
      <details>
        <summary>Response</summary>
        <pre class="response-text">${escapeHtml(`${response.raw || ""}${thoughts}`.trim())}</pre>
      </details>
    </article>
  `;
}

function selectVisualPromptExample(index) {
  if (!state.visualPrompts.length) return;
  state.visualPromptIndex = clamp(index, 0, state.visualPrompts.length - 1);
  renderVisualPromptExamples();
}

function moveVisualPromptExample(step) {
  if (!state.visualPrompts.length) return;
  const count = state.visualPrompts.length;
  state.visualPromptIndex = ((state.visualPromptIndex + step) % count + count) % count;
  renderVisualPromptExamples();
}

function setupDatasetHashDeepLink() {
  const scrollToDatasetViewer = () => {
    if (window.location.hash !== "#dataset") return;
    const section = $("#dataset");
    if (!section) return;
    const scrollToSection = () => section.scrollIntoView({ block: "start" });
    requestAnimationFrame(scrollToSection);
    window.setTimeout(scrollToSection, 250);
    window.setTimeout(scrollToSection, 1000);
    if (document.readyState !== "complete") {
      window.addEventListener("load", scrollToSection, { once: true });
    }
  };

  window.addEventListener("hashchange", scrollToDatasetViewer);
  scrollToDatasetViewer();
}

function setupVisualPromptHashDeepLink() {
  const openVisualPromptViewer = () => {
    if (window.location.hash !== "#visual-prompts") return;
    const details = $("#visual-prompts");
    if (!details) return;
    details.open = true;
    requestAnimationFrame(() => {
      details.scrollIntoView({ block: "start" });
    });
  };

  window.addEventListener("hashchange", openVisualPromptViewer);
  openVisualPromptViewer();
}

function setupSelfExplanationHashDeepLink() {
  const openSelfExplanationViewer = () => {
    if (window.location.hash !== "#self-explanation-viewer") return;
    const details = $("#self-explanation-viewer");
    if (!details) return;
    details.open = true;
    const scrollToViewer = () => details.scrollIntoView({ block: "start" });
    requestAnimationFrame(scrollToViewer);
    window.setTimeout(scrollToViewer, 250);
  };

  window.addEventListener("hashchange", openSelfExplanationViewer);
  openSelfExplanationViewer();
}

function setupTaskDecompositionHashDeepLink() {
  const openTaskDecompositionViewer = () => {
    if (!TASK_DECOMPOSITION_HASHES.has(window.location.hash)) return;
    const details = $("#task-decomposition-viewer");
    if (!details) return;
    details.open = true;
    const scrollToViewer = () => details.scrollIntoView({ block: "start" });
    requestAnimationFrame(scrollToViewer);
    window.setTimeout(scrollToViewer, 250);
  };

  window.addEventListener("hashchange", openTaskDecompositionViewer);
  openTaskDecompositionViewer();
}

function renderSelfExplanationExamples() {
  const container = $("#self-explanation-examples");
  if (!container) return;
  if (state.selfExplanations.length === 0) {
    container.innerHTML = `<div class="empty-state">No self-explanation examples available.</div>`;
    return;
  }

  state.selfExplanationIndex = clamp(state.selfExplanationIndex, 0, state.selfExplanations.length - 1);
  container.innerHTML = `
    <div class="prompt-type-browser self-explanation-browser" tabindex="0" aria-label="Self-explanation example browser">
      <div class="detail-nav prompt-type-nav self-explanation-nav">
        <span class="results-meta">Example ${pad(state.selfExplanationIndex + 1)} of ${pad(state.selfExplanations.length)}</span>
      </div>
      <div class="segmented prompt-type-rail self-explanation-rail" role="tablist" aria-label="Self-explanation examples">
        ${state.selfExplanations
          .map((entry, index) => {
            const q = entry.question;
            const meta = CATEGORY_META[q.question_category] || {};
            const active = index === state.selfExplanationIndex;
            return `
              <button
                type="button"
                role="tab"
                aria-selected="${String(active)}"
                data-self-explanation-index="${index}"
                class="${active ? "active" : ""} ${escapeHtml(meta.className || "")}"
                title="${escapeHtml(categoryShort(q.question_category))}"
              >${pad(index + 1)}</button>
            `;
          })
          .join("")}
      </div>
      <div id="self-explanation-example-detail">
        ${renderSelfExplanationExample(state.selfExplanations[state.selfExplanationIndex], state.selfExplanationIndex)}
      </div>
    </div>
  `;
  container.querySelectorAll("[data-self-explanation-index]").forEach((button) => {
    button.addEventListener("click", () => selectSelfExplanationExample(Number(button.dataset.selfExplanationIndex)));
  });
  container.querySelectorAll("[data-self-explanation-model]").forEach((button) => {
    button.addEventListener("click", () => selectSelfExplanationModel(button.dataset.selfExplanationModel));
  });
  scheduleTrackingPromptHeights(container);
}

function renderSelfExplanationExample(entry, index) {
  if (!entry) return `<div class="empty-state">Select an example to inspect it.</div>`;

  const q = entry.question;
  const promptSpecs = supplementaryPromptSpecs(q, "assets/supplementary/sep");
  const responses = selfExplanationResponseRows(entry);
  const selectedResponse = currentSelfExplanationResponse(responses);

  return `
    <article class="self-explanation-example">
      ${renderSelfExplanationMedia(entry, promptSpecs)}
      ${renderQuestion(q, { includeTitle: false, includeReveal: false, showCorrectOption: true })}
      ${renderSelfExplanationModelViewer(entry, responses, selectedResponse, q)}
    </article>
  `;
}

function selectSelfExplanationExample(index) {
  if (!state.selfExplanations.length) return;
  state.selfExplanationIndex = clamp(index, 0, state.selfExplanations.length - 1);
  renderSelfExplanationExamples();
}

function moveSelfExplanationExample(step) {
  if (!state.selfExplanations.length) return;
  const count = state.selfExplanations.length;
  state.selfExplanationIndex = ((state.selfExplanationIndex + step) % count + count) % count;
  renderSelfExplanationExamples();
}

function selectSelfExplanationModel(model) {
  if (!model) return;
  state.selfExplanationModel = model;
  renderSelfExplanationExamples();
}

function renderSelfExplanationPerformance(tags = []) {
  if (!tags.length) return "";

  return `
    <section class="self-performance-box" aria-label="Performance Indicators">
      <h4>Performance Indicators</h4>
      <div class="self-performance-list">
        ${tags.map(([label, signal]) => {
          const signalClass = signal === "+"
            ? "is-positive"
            : signal === "-"
              ? "is-negative"
              : "";
          return `
            <span class="self-performance-pill ${signalClass}">
              <span>${escapeHtml(label)}</span>
              <strong class="${signalClass}">${escapeHtml(signal || "")}</strong>
            </span>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function currentSelfExplanationResponse(responses) {
  if (!responses.length) return null;
  return responses.find((response) => response.model === state.selfExplanationModel) || responses[0];
}

function renderSelfExplanationModelViewer(entry, responses, selectedResponse, q) {
  if (!responses.length) {
    return `<div class="empty-state">No self-explanations available for this example.</div>`;
  }

  return `
    <section class="self-model-viewer" aria-label="Model self-explanation viewer">
      <h4 class="self-model-picker-label">Select Model</h4>
      <div class="self-model-picker" role="tablist" aria-label="Choose self-explanation model">
        ${responses.map((response) => {
          const active = selectedResponse?.model === response.model;
          return `
            <button
              type="button"
              role="tab"
              aria-selected="${String(active)}"
              data-self-explanation-model="${escapeHtml(response.model)}"
              class="${active ? "active" : ""}"
            >${escapeHtml(response.model)}</button>
          `;
        }).join("")}
      </div>
      <div class="self-model-detail">
        ${renderSelfExplanationResponseCard(entry, selectedResponse, q)}
      </div>
    </section>
  `;
}

function renderSelfExplanationMedia(entry, promptSpecs) {
  const videoCell = `
    <div class="viewer-media-cell viewer-video-cell prompt-setting-cell">
      <video src="${escapeHtml(supplementaryVideo("sep", entry.video_id, "keyframe"))}" controls playsinline preload="metadata"></video>
      <p class="media-hint">Key-frame video</p>
    </div>
  `;

  if (promptSpecs.length > 1) {
    return `
      <div class="viewer-media-tracking dataset-media prompt-type-video-row self-explanation-media" style="--prompt-count: ${promptSpecs.length};">
        ${videoCell}
        ${renderPromptStackCell(promptSpecs)}
      </div>
    `;
  }

  return `
    <div class="viewer-media-row dataset-media prompt-type-video-row self-explanation-media">
      ${videoCell}
      ${promptSpecs.map((spec) => renderPromptMediaCell(spec)).join("")}
    </div>
  `;
}

function selfExplanationResponseRows(entry) {
  const preferredOrder = ["Qwen2.5-VL-72B", "Gemini 2.5 Pro"];
  return flattenResponses(entry.responses)
    .filter((response) => preferredOrder.includes(response.model))
    .sort((a, b) => preferredOrder.indexOf(a.model) - preferredOrder.indexOf(b.model));
}

function renderSelfExplanationResponseCard(entry, response, q) {
  const correct = q.question?.correct_option?.label;
  const verdict = correct && response.answer ? (response.answer === correct ? "correct" : "incorrect") : "";
  const performance = response.model === "Gemini 2.5 Pro" ? renderSelfExplanationPerformance(entry.cot_error_tags) : "";
  const override = window.MANUAL_OVERRIDE_HTML?.[`${entry.qid_flat}|${response.model}`];
  const responseBody = override?.thoughts
    ? `<div class="self-explanation-html">${override.thoughts}</div>`
    : `<pre class="response-text">${escapeHtml(`${response.raw || ""}${response.thoughts?.length ? `\n\n${response.thoughts.join("\n\n")}` : ""}`.trim())}</pre>`;
  const notes = override?.notes
    ? `
      <div class="self-explanation-notes">
        <h4>Notes</h4>
        ${override.notes}
      </div>
    `
    : "";

  return `
    <article class="response-card self-explanation-response-card">
      <strong>${escapeHtml(response.model)}</strong>
      ${renderAnswerBadge(response.answer, verdict)}
      ${performance}
      <details open>
        <summary>${response.model.includes("Gemini") ? "Thought summary" : "Generated explanation"}</summary>
        ${responseBody}
      </details>
      ${notes}
    </article>
  `;
}

function renderTvaExamples() {
  const container = $("#tva-examples");
  if (!container) return;
  if (state.tvaExamples.length === 0) {
    container.innerHTML = `<div class="empty-state">No TVA examples available.</div>`;
    return;
  }

  state.tvaExampleIndex = clamp(state.tvaExampleIndex, 0, state.tvaExamples.length - 1);
  container.innerHTML = `
    <div class="prompt-type-browser tva-browser" tabindex="0" aria-label="TVA qualitative example browser">
      <div class="detail-nav prompt-type-nav tva-nav">
        <span class="results-meta">Example ${pad(state.tvaExampleIndex + 1)} of ${pad(state.tvaExamples.length)}</span>
      </div>
      <div class="segmented prompt-type-rail tva-rail" role="tablist" aria-label="TVA qualitative examples">
        ${state.tvaExamples
          .map((entry, index) => {
            const q = entry.question;
            const meta = CATEGORY_META[q.question_category] || {};
            const active = index === state.tvaExampleIndex;
            return `
              <button
                type="button"
                role="tab"
                aria-selected="${String(active)}"
                data-tva-example-index="${index}"
                class="${active ? "active" : ""} ${escapeHtml(meta.className || "")}"
                title="${escapeHtml(categoryShort(q.question_category))}"
              >${pad(index + 1)}</button>
            `;
          })
          .join("")}
      </div>
      <div id="tva-example-detail">
        ${renderTvaExample(state.tvaExamples[state.tvaExampleIndex])}
      </div>
    </div>
  `;

  container.querySelectorAll("[data-tva-example-index]").forEach((button) => {
    button.addEventListener("click", () => selectTvaExample(Number(button.dataset.tvaExampleIndex)));
  });
  scheduleTrackingPromptHeights(container);
}

function renderTvaExample(entry) {
  if (!entry) return `<div class="empty-state">Select an example to inspect it.</div>`;

  const q = entry.question;
  const promptSpecs = supplementaryPromptSpecs(q, "assets/supplementary/sep");

  return `
    <article class="tva-example">
      ${renderTvaMedia(entry, promptSpecs)}
      ${renderQuestion(q, { includeTitle: false, includeReveal: false, showCorrectOption: true })}
      ${renderTvaWalkthrough(entry)}
    </article>
  `;
}

function selectTvaExample(index) {
  if (!state.tvaExamples.length) return;
  state.tvaExampleIndex = clamp(index, 0, state.tvaExamples.length - 1);
  renderTvaExamples();
}

function moveTvaExample(step) {
  if (!state.tvaExamples.length) return;
  const count = state.tvaExamples.length;
  state.tvaExampleIndex = ((state.tvaExampleIndex + step) % count + count) % count;
  renderTvaExamples();
}

function renderTvaMedia(entry, promptSpecs) {
  const videoCell = `
    <div class="viewer-media-cell viewer-video-cell">
      <video src="${escapeHtml(supplementaryVideo("sep", entry.video_id, "trimmed"))}" controls playsinline preload="metadata"></video>
      <p class="media-hint">Trimmed video</p>
    </div>
  `;

  if (promptSpecs.length > 1) {
    return `
      <div class="viewer-media-tracking dataset-media prompt-type-video-row tva-media" style="--prompt-count: ${promptSpecs.length};">
        ${videoCell}
        ${renderPromptStackCell(promptSpecs)}
      </div>
    `;
  }

  return `
    <div class="viewer-media-row dataset-media prompt-type-video-row tva-media">
      ${videoCell}
      ${promptSpecs.map((spec) => renderPromptMediaCell(spec)).join("")}
    </div>
  `;
}

function renderTvaWalkthrough(entry) {
  const src = `assets/supplementary/sectiond/walkthrough_${entry.video_id}.mp4`;
  return `
    <section class="tva-walkthrough-card" aria-label="TVA walkthrough video">
      <div class="tva-walkthrough-copy">
        <h3>Walkthrough Video</h3>
        <p>
          A walkthrough demonstrating the execution of the code generated by the
          agent. The generated function received the above video, frame index and
          part masks used to construct the above visual prompt(s).
        </p>
      </div>
      <video class="tva-walkthrough-video" src="${escapeHtml(src)}" controls playsinline preload="metadata"></video>
    </section>
  `;
}

function renderQuestion(q, options = {}) {
  const meta = CATEGORY_META[q.question_category] || { label: q.question_category, short: q.question_category, className: "" };
  const title = options.title || "Question";
  const titleMarkup = options.includeTitle === false ? "" : `<h3>${escapeHtml(title)}</h3>`;
  const revealControl = options.includeReveal === false ? "" : renderRevealControl();
  return `
    <div class="question-card">
      <div class="question-card-top">
        <div class="question-meta">
          <span class="tag ${meta.className}">${meta.short}</span>
        </div>
        ${revealControl}
      </div>
      ${titleMarkup}
      <p class="question-text">${escapeHtml(q.question.raw_qstr)}</p>
      ${renderOptions(q, options)}
    </div>
  `;
}

function renderRevealControl() {
  return `
    <div class="reveal-control">
      <button class="reveal-toggle" type="button" data-reveal-toggle aria-pressed="${String(state.showGroundTruthAndResponses)}">
        ${escapeHtml(state.showGroundTruthAndResponses ? REVEAL_HIDE_LABEL : REVEAL_SHOW_LABEL)}
      </button>
    </div>
  `;
}

function renderOptions(q, options = {}) {
  const correct = q.question.correct_option || {};
  const showCorrect = options.showCorrectOption || state.showGroundTruthAndResponses;
  const optionEntries = Object.entries(q.question.options || {}).sort(([a], [b]) => Number(a) - Number(b));
  return `
    <ul class="option-list">
      ${optionEntries
        .map(([key, option]) => {
          const isCorrect = showCorrect && (Number(key) === Number(correct.idx) || option.label === correct.label);
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
  if (!state.showGroundTruthAndResponses) return "";
  const correct = q.question?.correct_option?.label;
  const verdict = typeof response.correct === "boolean"
    ? (response.correct ? "correct" : "incorrect")
    : (correct && response.answer ? (response.answer === correct ? "correct" : "incorrect") : "");
  const thoughts = response.thoughts?.length ? `\n\n${response.thoughts.join("\n\n")}` : "";
  const setting = response.settingLabel || `${response.video || ""} / ${response.prompt || ""}`.trim();
  return `
    <article class="response-card">
      <strong>${escapeHtml(response.model)}</strong>
      <p>${escapeHtml(setting)}</p>
      ${renderAnswerBadge(response.answer, verdict)}
      <details>
        <summary>Response</summary>
        <pre class="response-text">${escapeHtml(`${response.raw}${thoughts}`.trim())}</pre>
      </details>
    </article>
  `;
}

function renderAnswerBadge(answer, verdict) {
  if (!answer) return "";
  const iconClass = verdict === "correct" ? "fa-check" : verdict === "incorrect" ? "fa-xmark" : "";
  const stateClass = verdict === "correct" || verdict === "incorrect" ? ` is-${verdict}` : "";
  const icon = iconClass ? `<i class="fa-solid ${iconClass}" aria-hidden="true"></i>` : "";
  const label = verdict ? ` aria-label="Answer ${escapeHtml(answer)}, ${verdict}"` : "";
  return `<span class="answer-badge${stateClass}"${label}>${icon}<span>Answer ${escapeHtml(answer)}</span></span>`;
}

function renderModelResponsesForQuestion(q) {
  if (!state.showGroundTruthAndResponses) return "";
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

function readRevealPreference() {
  try {
    return window.localStorage.getItem(REVEAL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeRevealPreference(value) {
  try {
    window.localStorage.setItem(REVEAL_STORAGE_KEY, String(value));
  } catch {
    // Ignore storage failures; the button still works for this page load.
  }
}

function toggleGroundTruthAndResponses() {
  state.showGroundTruthAndResponses = !state.showGroundTruthAndResponses;
  writeRevealPreference(state.showGroundTruthAndResponses);
  syncRevealControls();
  renderCuratedDetail();
  renderDatasetDetail();
  renderSupplementaryExplorers();
}

function syncRevealControls() {
  $$("[data-reveal-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(state.showGroundTruthAndResponses));
    button.textContent = state.showGroundTruthAndResponses ? REVEAL_HIDE_LABEL : REVEAL_SHOW_LABEL;
  });
}

function setupErrorPieHover() {
  const chart = $(".self-error-chart");
  if (!chart) return;
  const pie = $("[data-error-pie]", chart);
  const rows = $$("[data-error-key]", chart);
  if (!pie || rows.length === 0) return;

  let activeKey = "";

  const setActiveKey = (key) => {
    if (key === activeKey) return;
    activeKey = key;
    if (key) {
      chart.dataset.activeError = key;
    } else {
      chart.removeAttribute("data-active-error");
    }
    rows.forEach((row) => {
      row.classList.toggle("is-highlighted", row.dataset.errorKey === key);
    });
  };

  pie.addEventListener("pointermove", (event) => {
    setActiveKey(errorPieSliceFromPointer(event, pie));
  });
  pie.addEventListener("pointerleave", () => setActiveKey(""));
  pie.addEventListener("pointercancel", () => setActiveKey(""));
}

function errorPieSliceFromPointer(event, pie) {
  const rect = pie.getBoundingClientRect();
  const radius = Math.min(rect.width, rect.height) / 2;
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(dx, dy);

  if (distance < radius * 0.52 || distance > radius) return "";

  const degreesFromTop = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  const percent = degreesFromTop / 3.6;
  const slice = ERROR_PIE_SLICES.find(({ start, end }) => percent >= start && percent < end);
  return slice ? slice.key : "";
}

function setupTableOfContents() {
  const links = $$(".toc a[href^='#']");
  const sections = links
    .map((link) => {
      const target = $(link.hash);
      return target ? { id: target.id, link, target } : null;
    })
    .filter(Boolean);

  if (sections.length === 0) return;

  let frame = 0;
  const setActiveSection = (id) => {
    sections.forEach(({ link, id: sectionId }) => {
      const isActive = sectionId === id;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const updateActiveSection = () => {
    frame = 0;
    const anchorY = Math.min(window.innerHeight * 0.35, 240);
    let active = sections[0];

    sections.forEach((section) => {
      if (section.target.getBoundingClientRect().top <= anchorY) {
        active = section;
      }
    });

    const pageBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    if (pageBottom <= 2) {
      active = sections[sections.length - 1];
    }

    setActiveSection(active.id);
  };

  const scheduleUpdate = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(updateActiveSection);
  };

  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    sections.forEach(({ target }) => resizeObserver.observe(target));
  }

  window.addEventListener("load", scheduleUpdate);
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("hashchange", scheduleUpdate);
  updateActiveSection();
}

function setupBibtexCopy() {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-copy-bibtex]");
    if (!button) return;
    copyBibtex(button);
  });
}

async function copyBibtex(button) {
  const code = button.closest(".bibtex-shell")?.querySelector("code");
  const label = $("span", button);
  const defaultLabel = button.dataset.copyLabel || "Copy";
  const copiedLabel = button.dataset.copiedLabel || "Copied";
  const text = code?.textContent.trim();
  if (!text) return;

  const resetExisting = Number(button.dataset.copyResetTimer || 0);
  window.clearTimeout(resetExisting);

  try {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        copyTextFallback(text);
      }
    } else {
      copyTextFallback(text);
    }

    setBibtexCopyState(button, label, copiedLabel, true);
  } catch (error) {
    console.error("Unable to copy BibTeX", error);
    setBibtexCopyState(button, label, "Failed", false);
  }

  const resetTimer = window.setTimeout(() => {
    setBibtexCopyState(button, label, defaultLabel, false);
    delete button.dataset.copyResetTimer;
  }, 1800);
  button.dataset.copyResetTimer = String(resetTimer);
}

function setBibtexCopyState(button, label, text, copied) {
  if (label) label.textContent = text;
  button.classList.toggle("is-copied", copied);
}

function copyTextFallback(text) {
  let handled = false;
  const onCopy = (event) => {
    event.clipboardData?.setData("text/plain", text);
    event.preventDefault();
    handled = true;
  };

  document.addEventListener("copy", onCopy);
  const copiedFromEvent = document.execCommand("copy");
  document.removeEventListener("copy", onCopy);
  if (copiedFromEvent || handled) return;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("Clipboard fallback failed");
  }
}

function setupGlobalEvents() {
  document.addEventListener("click", (event) => {
    const revealButton = event.target.closest("[data-reveal-toggle]");
    if (revealButton) {
      toggleGroundTruthAndResponses();
      return;
    }

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
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tagName = document.activeElement?.tagName;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return;
    if (isFpbGameKeyboardContext()) {
      if (handleFpbGameNavigationKey(event, { focusTab: true })) return;
    }
    if (handleSupplementaryExplorerNavigationKey(event)) return;
    if (!isDatasetViewerKeyboardContext()) return;
    const isNextKey = ["ArrowRight", "ArrowDown", "j", "J"].includes(event.key);
    const isPreviousKey = ["ArrowLeft", "ArrowUp", "k", "K"].includes(event.key);
    if (!isNextKey && !isPreviousKey) return;

    event.preventDefault();
    const step = isNextKey ? 1 : -1;
    if (state.viewerMode === "full") {
      moveDatasetSelection(step);
    } else {
      moveCuratedSelection(step);
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

function promptKindLabel(kind) {
  return {
    sep: "Mixed-Media",
    collage: "Collage",
    concat: "Concat",
  }[kind] || kind;
}

function promptKindDescription(kind) {
  return {
    sep: "Prompt image(s) supplied separately from the video.",
    collage: "Prompt image(s) fixed alongside every video frame.",
    concat: "Prompt image(s) prepended as initial video frame(s).",
  }[kind] || "";
}

function fpbGameRevealLabel(canReveal) {
  if (!canReveal) return "Select an option";
  return state.fpbGameRevealed ? "Hide answer" : "Click to view Ground Truth and LVLMs' answers!";
}

function exampleCaption(q) {
  const item = titleCase(String(q.furniture_name || "furniture").replace(/_/g, " "));
  const family = q.vid_category && q.vid_category !== "Misc" ? `${String(q.vid_category).toLowerCase()} ` : "";
  return `${item} ${family}assembly`;
}

function titleCase(value) {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
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
