const TOPICS = {
  "visual-prompts": {
    title: "How sensitive are models to visual prompt construction?",
    summary:
      "The supplementary prompt-construction study compares Mixed-Media, Concat, and Collage inputs. The key takeaway is that prompt format matters, but prompt engineering alone does not close the benchmark gap.",
    data: "../assets/data/visual-prompt-examples.json",
    renderer: renderVisualPromptAnalysis,
  },
  "temporal-context": {
    title: "Do models use video evidence, or can static cues solve the task?",
    summary:
      "The paper's ablations show that temporal context is underused. Key-frame and trimmed videos often perform similarly, while tasks that require identity tracking remain difficult.",
    data: "../assets/data/results.json",
    renderer: renderTemporalContextAnalysis,
  },
  "self-explanations": {
    title: "What failure modes appear in model self-explanations?",
    summary:
      "Self-explanations expose object-grounding and spatio-temporal reasoning failures that are hidden by option-only accuracy.",
    data: "../assets/data/self-explanation-examples.json",
    renderer: renderSelfExplanationAnalysis,
  },
  tva: {
    title: "Can models align video segments with assembly events?",
    summary:
      "Temporal Video Alignment remains difficult: many examples abstain, and answered examples are often grounded in the wrong visual event.",
    data: "../assets/data/tva-examples.json",
    renderer: renderTvaAnalysis,
  },
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

const revealState = {
  showGroundTruthAndResponses: readRevealPreference(),
};

const topicKey = document.body.dataset.analysisTopic;
const topic = TOPICS[topicKey];
const root = document.querySelector("#analysis-root");
let topicData = null;

if (!topic || !root) {
  if (root) root.innerHTML = `<div class="empty-state">Unknown analysis topic.</div>`;
} else {
  loadJson(topic.data)
    .then((data) => {
      topicData = data;
      renderTopic();
    })
    .catch((error) => {
      root.innerHTML = `<div class="empty-state">Unable to load analysis data: ${escapeHtml(error.message)}</div>`;
    });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-reveal-toggle]");
  if (!button) return;
  toggleGroundTruthAndResponses();
});

function renderTopic() {
  if (!topic || !root || !topicData) return;
  if (topicKey === "visual-prompts") {
    root.innerHTML = topic.renderer(topicData);
    setupVisualPromptAnalysis(topicData);
    syncRevealControls();
    return;
  }
  root.innerHTML = `
    <article class="analysis-answer">
      <span class="eyebrow">Research Question</span>
      <h2>${escapeHtml(topic.title)}</h2>
      <p>${escapeHtml(topic.summary)}</p>
    </article>
    ${topic.renderer(topicData)}
  `;
  syncRevealControls();
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
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
  revealState.showGroundTruthAndResponses = !revealState.showGroundTruthAndResponses;
  writeRevealPreference(revealState.showGroundTruthAndResponses);
  if (topicKey === "visual-prompts") {
    syncRevealControls();
    renderVisualPromptDetail();
    return;
  }
  renderTopic();
}

function renderRevealControl() {
  return `
    <div class="reveal-control">
      <button class="reveal-toggle" type="button" data-reveal-toggle aria-pressed="${String(revealState.showGroundTruthAndResponses)}">
        ${escapeHtml(revealState.showGroundTruthAndResponses ? REVEAL_HIDE_LABEL : REVEAL_SHOW_LABEL)}
      </button>
    </div>
  `;
}

function syncRevealControls() {
  document.querySelectorAll("[data-reveal-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(revealState.showGroundTruthAndResponses));
    button.textContent = revealState.showGroundTruthAndResponses ? REVEAL_HIDE_LABEL : REVEAL_SHOW_LABEL;
  });
}

function renderVisualPromptAnalysis(entries) {
  return `
    <div class="viewer-shell visual-prompt-viewer">
      <div class="viewer-header">
        <div>
          <h2>Visualizing Visual Prompt Types</h2>
          <p>${entries.length} qualitative examples. For quantitative results, see the paper.</p>
        </div>
        <div class="viewer-controls">
          <label class="control-group">
            Video variant
            <span class="control-static">Key-frame</span>
          </label>
          <label class="control-group">
            Prompt recipe
            <select id="visual-prompt-type">
              <option value="sep">Mixed-Media</option>
              <option value="concat">Concat</option>
              <option value="collage">Collage</option>
            </select>
          </label>
        </div>
      </div>
      <div class="analysis-rail-row">
        <span>Browse examples:</span>
        <div class="segmented analysis-nav-rail" id="visual-prompt-nav"></div>
      </div>
      <div id="visual-prompt-detail"></div>
    </div>
  `;
}

const visualPromptState = {
  entries: [],
  index: 0,
  promptType: "sep",
};

function setupVisualPromptAnalysis(entries) {
  visualPromptState.entries = entries;
  const nav = document.querySelector("#visual-prompt-nav");
  const select = document.querySelector("#visual-prompt-type");
  if (!nav || !select) return;
  select.value = visualPromptState.promptType;

  nav.innerHTML = entries
    .map((entry, index) => {
      const q = entry.question;
      const meta = CATEGORY_META[q.question_category] || {};
      return `
        <button
          type="button"
          data-index="${index}"
          class="${escapeHtml(meta.className || "")}"
          aria-label="Example ${index + 1} ${meta.short || q.question_category}"
          title="${meta.short || q.question_category}"
        >${index + 1}</button>
      `;
    })
    .join("");

  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;
    visualPromptState.index = Number(button.dataset.index);
    renderVisualPromptDetail();
  });

  select.addEventListener("input", () => {
    visualPromptState.promptType = select.value;
    renderVisualPromptDetail();
  });

  renderVisualPromptDetail();
}

function renderVisualPromptDetail() {
  const container = document.querySelector("#visual-prompt-detail");
  const entry = visualPromptState.entries[visualPromptState.index];
  if (!container || !entry) return;

  document.querySelectorAll("#visual-prompt-nav button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.index) === visualPromptState.index);
  });

  const q = entry.question;
  const kind = visualPromptState.promptType;
  const promptSpecs = supplementaryPromptSpecs(q, "../assets/supplementary/sectionb/sep");
  const responses = flattenResponses(entry.responses).filter((response) => response.video === "keyframe" && response.prompt === kind);
  const responseSection = revealState.showGroundTruthAndResponses
    ? `
      <div>
        <h3>Model responses (${promptKindLabel(kind)} - Key-frame)</h3>
        ${
          responses.length
            ? `<div class="response-grid">${responses.map((response) => renderResponseCard(response, q)).join("")}</div>`
            : `<div class="empty-state">No responses available for this prompt recipe.</div>`
        }
      </div>
    `
    : "";
  container.innerHTML = `
    <div class="viewer-question">
      <div class="${promptSpecs.length > 1 ? "viewer-media-stack" : "viewer-media-row"}">
        <div class="viewer-media-cell">
          <video src="../assets/supplementary/sectionb/${kind}/${escapeHtml(entry.video_id)}_keyframe.mp4" controls playsinline preload="metadata"></video>
          <p class="media-hint">${promptKindLabel(kind)} key-frame media</p>
        </div>
        ${promptSpecs.length > 1 ? `<div class="viewer-media-images">${promptSpecs.map(renderPromptCell).join("")}</div>` : promptSpecs.map(renderPromptCell).join("")}
      </div>
      <div class="viewer-question-body">
        ${renderQuestionSummary(q)}
      </div>
      ${responseSection}
    </div>
  `;
}

function renderPromptConstructionExample(entry) {
  const q = entry.question;
  const media = ["sep", "concat", "collage"]
    .map((kind) => `
      <div class="viewer-media-cell">
        <video src="../assets/supplementary/sectionb/${kind}/${escapeHtml(entry.video_id)}_keyframe.mp4" controls playsinline preload="metadata"></video>
        <p class="media-hint">${promptKindLabel(kind)}</p>
      </div>
    `)
    .join("");

  return `
    <article class="analysis-example-card">
      ${renderQuestionSummary(q)}
      <div class="viewer-media-row">${media}</div>
      <div class="viewer-media-images">
        ${supplementaryPromptSpecs(q, "../assets/supplementary/sectionb/sep").map(renderPromptCell).join("")}
      </div>
    </article>
  `;
}

function renderTemporalContextAnalysis(rows) {
  const topRows = [...rows].sort((a, b) => b.micro - a.micro).slice(0, 16);
  const byVideo = summarizeBy(rows, "video");
  return `
    <div class="analysis-section">
      <h2>Video Variant Summary</h2>
      <p>
        Trimmed videos are more temporally focused, but the result table shows that many
        models do not consistently gain from the additional temporal signal. This supports
        the paper's conclusion that LVLMs often lean on static visual cues.
      </p>
      <div class="cards two">
        ${Object.entries(byVideo)
          .map(([video, summary]) => `
            <article class="metric-card">
              <span>${escapeHtml(video)}</span>
              <strong>${summary.mean.toFixed(2)}</strong>
              <p>mean micro accuracy across ${summary.count} result rows</p>
            </article>
          `)
          .join("")}
      </div>
      <div class="table-wrap analysis-table">
        <table>
          <thead>
            <tr>
              <th>Model</th><th>Prompt</th><th>Video</th><th>Micro</th><th>TORD</th><th>TLOC</th><th>TRACK</th><th>MATE</th>
            </tr>
          </thead>
          <tbody>
            ${topRows
              .map((row) => `
                <tr>
                  <td>${escapeHtml(row.model)}</td>
                  <td>${escapeHtml(row.prompt)}</td>
                  <td>${escapeHtml(row.video)}</td>
                  <td class="num">${score(row.micro)}</td>
                  <td class="num">${score(row.tord)}</td>
                  <td class="num">${score(row.tloc)}</td>
                  <td class="num">${score(row.track)}</td>
                  <td class="num">${score(row.mate)}</td>
                </tr>
              `)
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSelfExplanationAnalysis(entries) {
  return `
    <div class="analysis-section">
      <h2>Qualitative Self-Explanations</h2>
      <p>
        These examples show when rationales correctly identify the relevant assembly event
        and when they instead paraphrase an answer choice or ground the wrong object.
      </p>
      <div class="analysis-example-list">
        ${entries.map((entry) => renderExplanationExample(entry, "self")).join("")}
      </div>
    </div>
  `;
}

function renderTvaAnalysis(entries) {
  return `
    <div class="analysis-section">
      <h2>TVA Qualitative Examples</h2>
      <p>
        The walkthrough videos show generated alignment attempts against the same question
        media, making incorrect temporal grounding easier to inspect.
      </p>
      <div class="analysis-example-list">
        ${entries.map((entry) => renderExplanationExample(entry, "tva")).join("")}
      </div>
    </div>
  `;
}

function renderExplanationExample(entry, mode) {
  const q = entry.question;
  const responses = flattenResponses(entry.responses).slice(0, 3);
  const mediaRoot = mode === "tva" ? "../assets/supplementary/sectiond" : "../assets/supplementary/sep";
  const walkthrough =
    mode === "tva"
      ? `<div class="viewer-media-cell"><video src="${mediaRoot}/walkthrough_${escapeHtml(entry.video_id)}.mp4" controls playsinline preload="metadata"></video><p class="media-hint">Generated TVA walkthrough</p></div>`
      : "";
  return `
    <article class="analysis-example-card">
      ${renderQuestionSummary(q)}
      <div class="viewer-media-row">
        <div class="viewer-media-cell">
          <video src="../assets/supplementary/sep/${escapeHtml(entry.video_id)}_keyframe.mp4" controls playsinline preload="metadata"></video>
          <p class="media-hint">Key-frame video</p>
        </div>
        ${walkthrough}
      </div>
      <div class="viewer-media-images">
        ${supplementaryPromptSpecs(q, "../assets/supplementary/sep").map(renderPromptCell).join("")}
      </div>
      <div class="question-meta">
        ${(entry.cot_error_tags || []).map((tag) => `<span class="pill">${escapeHtml(tag.join(" "))}</span>`).join("")}
      </div>
      ${
        revealState.showGroundTruthAndResponses
          ? `<div class="response-grid">${responses.map((response) => renderResponseCard(response, q)).join("")}</div>`
          : ""
      }
    </article>
  `;
}

function renderQuestionSummary(q) {
  const meta = CATEGORY_META[q.question_category] || { short: q.question_category, className: "" };
  return `
    <div class="question-card-top">
      <div class="question-meta">
        <span class="tag ${meta.className}">${meta.short}</span>
      </div>
      ${renderRevealControl()}
    </div>
    <h3>${escapeHtml(q.furniture_name)} / ${escapeHtml(q.video_id)}</h3>
    <p class="question-text">${escapeHtml(q.question.raw_qstr)}</p>
    ${renderOptions(q)}
  `;
}

function renderOptions(q) {
  const correct = q.question.correct_option || {};
  return `
    <ul class="option-list">
      ${Object.entries(q.question.options || {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([key, option]) => {
          const isCorrect = revealState.showGroundTruthAndResponses && (Number(key) === Number(correct.idx) || option.label === correct.label);
          return `<li class="${isCorrect ? "correct" : ""}"><strong>${escapeHtml(option.label)}.</strong> ${escapeHtml(option.text || option.full_text || "")}</li>`;
        })
        .join("")}
    </ul>
  `;
}

function supplementaryPromptSpecs(q, root) {
  const frame = q.frame_idx;
  if (Array.isArray(frame)) {
    return [
      { label: "Image A", src: `${root}/${q.video_id}_${pad(frame[0])}.jpg` },
      { label: "Image B", src: `${root}/${q.video_id}_${pad(frame[1])}_jumbled.jpg` },
    ];
  }
  return [{ label: "Visual Prompt", src: `${root}/${q.video_id}_${pad(frame)}.jpg` }];
}

function renderPromptCell(spec) {
  return `
    <div class="viewer-media-cell">
      <img src="${escapeHtml(spec.src)}" alt="${escapeHtml(spec.label)}">
      <p class="media-hint">${escapeHtml(spec.label)}</p>
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
  return rows;
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
  if (!revealState.showGroundTruthAndResponses) return "";
  const correct = q.question?.correct_option?.label;
  const verdict = correct && response.answer ? (response.answer === correct ? "correct" : "incorrect") : "";
  const thoughts = response.thoughts?.length ? `\n\n${response.thoughts.join("\n\n")}` : "";
  return `
    <article class="response-card">
      <strong>${escapeHtml(response.model)}</strong>
      <p>${escapeHtml(response.video)} / ${escapeHtml(response.prompt)}</p>
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

function summarizeBy(rows, key) {
  return rows.reduce((acc, row) => {
    const label = row[key];
    if (!acc[label]) acc[label] = { total: 0, count: 0, mean: 0 };
    acc[label].total += Number(row.micro) || 0;
    acc[label].count += 1;
    acc[label].mean = acc[label].total / acc[label].count;
    return acc;
  }, {});
}

function promptKindLabel(kind) {
  return { sep: "Mixed-Media", concat: "Concat", collage: "Collage" }[kind] || kind;
}

function extractAnswer(text) {
  const match = String(text).match(/"answer"\s*:\s*"([^"]+)"/i) || String(text).match(/\banswer\s*[:=]\s*([A-D])\b/i);
  return match ? match[1].trim() : "";
}

function pad(value) {
  return String(value ?? 0).padStart(3, "0");
}

function score(value) {
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
