/* ════════════════════════════════════════════════════════════════════════
   ResearchMind — app.js
   SSE-driven pipeline UI controller
   ════════════════════════════════════════════════════════════════════════ */

let currentJobId = null;
let currentReport = "";
let currentTopic = "";
let eventSource = null;

// ── Utilities ──────────────────────────────────────────────────────────

function qs(sel) { return document.querySelector(sel); }
function setDisplay(el, val) { if (el) el.style.display = val; }

function setTopic(text) {
  qs("#topic-input").value = text;
  qs("#topic-input").focus();
}

// ── Markdown-lite renderer ─────────────────────────────────────────────
function renderMarkdown(text) {
  // Very lightweight Markdown → HTML for the report
  let html = text
    // Escape HTML
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // URLs
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    // Horizontal rule
    .replace(/^---+$/gm, "<hr>")
    // Bullet lists
    .replace(/^[\-\*] (.+)$/gm, "<li>$1</li>")
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Double newlines → paragraphs
    .replace(/\n\n+/g, "\n\n")
    .split("\n\n")
    .map(block => {
      block = block.trim();
      if (!block) return "";
      if (/^<(h[1-6]|blockquote|hr|li)/.test(block)) return block;
      // Wrap consecutive <li> in <ul>
      if (block.includes("<li>")) return "<ul>" + block + "</ul>";
      return "<p>" + block.replace(/\n/g, "<br>") + "</p>";
    })
    .join("\n");
  return html;
}

// ── Critic parser ──────────────────────────────────────────────────────
function parseCritic(text) {
  const scoreMatch = text.match(/Score:\s*(\d+)\s*\/\s*10/i);
  const score = scoreMatch ? scoreMatch[1] : "–";

  let body = text;
  // Format section headers
  body = body
    .replace(/Score:\s*\d+\s*\/\s*10\s*\n?/i, "")
    .replace(/^(Strengths:|Areas to Improve:|One line verdict:)/gm,
      (m) => `<strong>${m.replace(":", "")}</strong>`)
    .replace(/^- /gm, "• ");

  return { score, body };
}

// ── Step state updater ─────────────────────────────────────────────────
function updateStepCard(stepKey, state) {
  const card = qs(`#step-${stepKey}`);
  if (!card) return;
  card.setAttribute("data-state", state);
}

// ── Tab switcher ───────────────────────────────────────────────────────
function switchTab(btn, tab) {
  document.querySelectorAll(".preview-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".preview-pane").forEach(p => setDisplay(p, "none"));
  btn.classList.add("active");
  setDisplay(qs(`#pane-${tab}`), "block");
}

// ── Reset UI ───────────────────────────────────────────────────────────
function resetUI() {
  if (eventSource) { eventSource.close(); eventSource = null; }
  currentJobId = null;
  currentReport = "";
  currentTopic = "";

  // Reset step cards
  ["search","reader","writer","critic"].forEach(k => updateStepCard(k, "waiting"));

  // Clear preview
  setDisplay(qs("#pipeline-section"), "none");
  setDisplay(qs("#results-section"), "none");
  setDisplay(qs("#preview-idle"), "flex");
  setDisplay(qs("#preview-content"), "none");
  qs("#pane-search").textContent = "";
  qs("#pane-reader").textContent = "";
  qs("#report-body").innerHTML = "";
  qs("#critic-score-box").innerHTML = "";
  qs("#critic-text-box").innerHTML = "";
  qs("#pipeline-topic").textContent = "";

  // Re-enable button
  const btn = qs("#run-btn");
  btn.disabled = false;
  btn.querySelector(".btn-text").textContent = "Run Pipeline";

  qs("#topic-input").value = "";
  qs("#topic-input").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Main: start research ───────────────────────────────────────────────
async function startResearch() {
  const topic = qs("#topic-input").value.trim();
  if (!topic) {
    qs("#topic-input").focus();
    qs("#topic-input").style.borderColor = "var(--coral)";
    setTimeout(() => {
      qs("#topic-input").style.borderColor = "";
    }, 1200);
    return;
  }

  currentTopic = topic;

  // Disable button
  const btn = qs("#run-btn");
  btn.disabled = true;
  btn.querySelector(".btn-text").textContent = "Running…";

  // Show pipeline section
  qs("#pipeline-topic").textContent = topic;
  setDisplay(qs("#pipeline-section"), "block");
  setDisplay(qs("#results-section"), "none");
  qs("#pipeline-section").scrollIntoView({ behavior: "smooth", block: "start" });

  // Reset cards
  ["search","reader","writer","critic"].forEach(k => updateStepCard(k, "waiting"));
  setDisplay(qs("#preview-idle"), "flex");
  setDisplay(qs("#preview-content"), "none");
  qs("#pane-search").textContent = "";
  qs("#pane-reader").textContent = "";

  // Start job
  let jobId;
  try {
    const resp = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    jobId = data.job_id;
    currentJobId = jobId;
  } catch (e) {
    alert("Error starting research: " + e.message);
    btn.disabled = false;
    btn.querySelector(".btn-text").textContent = "Run Pipeline";
    return;
  }

  // Open SSE stream
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`/api/stream/${jobId}`);

  eventSource.onmessage = (evt) => {
    const data = JSON.parse(evt.data);
    handleUpdate(data);
  };

  eventSource.onerror = () => {
    eventSource.close();
  };
}

// ── Handle SSE update ──────────────────────────────────────────────────
function handleUpdate(data) {
  const { status, steps, results, error } = data;

  // Update step cards
  if (steps) {
    Object.entries(steps).forEach(([key, state]) => updateStepCard(key, state));
  }

  // Populate preview as results come in
  if (results) {
    if (results.search) {
      setDisplay(qs("#preview-idle"), "none");
      setDisplay(qs("#preview-content"), "flex");
      setDisplay(qs("#preview-content"), "block");
      qs("#pane-search").textContent = results.search;
    }
    if (results.reader) {
      qs("#pane-reader").textContent = results.reader;
      // Auto-switch tab to reader when available
      const readerTab = document.querySelector('.preview-tab[data-tab="reader"]');
      if (readerTab) {
        document.querySelectorAll(".preview-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".preview-pane").forEach(p => setDisplay(p, "none"));
        readerTab.classList.add("active");
        setDisplay(qs("#pane-reader"), "block");
      }
    }
    if (results.writer) {
      currentReport = results.writer;
    }
  }

  if (status === "done") {
    eventSource.close();
    showResults(results);
    const btn = qs("#run-btn");
    btn.disabled = false;
    btn.querySelector(".btn-text").textContent = "Run Pipeline";
  }

  if (status === "error") {
    eventSource.close();
    alert("Pipeline error: " + (error || "Unknown error"));
    const btn = qs("#run-btn");
    btn.disabled = false;
    btn.querySelector(".btn-text").textContent = "Run Pipeline";
  }
}

// ── Show final results ─────────────────────────────────────────────────
function showResults(results) {
  setDisplay(qs("#results-section"), "block");
  qs("#results-section").scrollIntoView({ behavior: "smooth", block: "start" });

  // Report
  if (results.writer) {
    qs("#report-body").innerHTML = renderMarkdown(results.writer);
  }

  // Critic
  if (results.critic) {
    const { score, body } = parseCritic(results.critic);
    qs("#critic-score-box").innerHTML = `
      <div class="score-number">${score}</div>
      <div class="score-denom">out of 10</div>
      <div class="score-label">Quality Score</div>
    `;
    qs("#critic-text-box").innerHTML = body
      .split("\n")
      .map(line => line.startsWith("•") ? `<div style="margin-bottom:4px">${line}</div>` : line)
      .join("\n");
  }
}

// ── Download report ────────────────────────────────────────────────────
function downloadReport() {
  if (!currentReport) return;
  const blob = new Blob([currentReport], { type: "text/markdown" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `research_report_${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Enter key support ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  qs("#topic-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") startResearch();
  });
});
