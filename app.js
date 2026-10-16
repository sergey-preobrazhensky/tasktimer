const STORAGE_KEY = "tasktimer.tasks.v1";

/** @typedef {{
 *   id: string;
 *   title: string;
 *   elapsedMs: number;
 *   runningSince: number | null;
 *   done: boolean;
 *   createdAt: number;
 * }} Task */

/** @type {Task[]} */
let tasks = loadTasks();
let filter = "active";
/** @type {string | null} */
let editingId = null;

const els = {
  form: document.getElementById("create-form"),
  title: document.getElementById("task-title"),
  list: document.getElementById("task-list"),
  empty: document.getElementById("empty-state"),
  totalBar: document.getElementById("total-bar"),
  totalTime: document.getElementById("total-time"),
  filters: document.querySelectorAll(".filter"),
  modal: document.getElementById("edit-modal"),
  editForm: document.getElementById("edit-form"),
  editTitle: document.getElementById("edit-title"),
  editTime: document.getElementById("edit-time"),
};

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTask).filter(Boolean);
  } catch {
    return [];
  }
}

/** @param {unknown} raw @returns {Task | null} */
function normalizeTask(raw) {
  if (!raw || typeof raw !== "object") return null;
  const t = /** @type {Record<string, unknown>} */ (raw);
  if (typeof t.id !== "string" || typeof t.title !== "string") return null;
  return {
    id: t.id,
    title: t.title,
    elapsedMs: typeof t.elapsedMs === "number" ? Math.max(0, t.elapsedMs) : 0,
    runningSince: typeof t.runningSince === "number" ? t.runningSince : null,
    done: Boolean(t.done),
    createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
  };
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function uid() {
  return crypto.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** @param {Task} task */
function getElapsed(task) {
  if (task.runningSince == null) return task.elapsedMs;
  return task.elapsedMs + (Date.now() - task.runningSince);
}

/** @param {number} ms */
function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** @param {string} value @returns {number | null} */
function parseTime(value) {
  const match = value.trim().match(/^(\d{1,3}):([0-5]\d):([0-5]\d)$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3]);
  return ((h * 3600) + (m * 60) + s) * 1000;
}

/** @param {string} id */
function findTask(id) {
  return tasks.find((t) => t.id === id) ?? null;
}

/** @param {string} id */
function stopTask(id) {
  const task = findTask(id);
  if (!task || task.runningSince == null) return;
  task.elapsedMs = getElapsed(task);
  task.runningSince = null;
}

function stopAllRunning() {
  for (const task of tasks) {
    if (task.runningSince != null) stopTask(task.id);
  }
}

/** @param {string} title */
function createTask(title) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const noActive = !tasks.some((t) => !t.done);
  tasks.unshift({
    id: uid(),
    title: trimmed,
    elapsedMs: 0,
    runningSince: noActive ? Date.now() : null,
    done: false,
    createdAt: Date.now(),
  });
  saveTasks();
  render();
}

/** @param {string} id */
function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  render();
}

/** @param {string} id */
function toggleTimer(id) {
  const task = findTask(id);
  if (!task || task.done) return;
  if (task.runningSince != null) {
    stopTask(id);
  } else {
    stopAllRunning();
    task.runningSince = Date.now();
  }
  saveTasks();
  render();
}

/** @param {string} id */
function completeTask(id) {
  const task = findTask(id);
  if (!task) return;
  stopTask(id);
  task.done = true;
  saveTasks();
  render();
}

/** @param {string} id */
function resumeTask(id) {
  const task = findTask(id);
  if (!task) return;
  task.done = false;
  saveTasks();
  render();
}

/** @param {string} id @param {string} title @param {number} elapsedMs */
function updateTask(id, title, elapsedMs) {
  const task = findTask(id);
  if (!task) return;
  const trimmed = title.trim();
  if (!trimmed) return;
  if (task.runningSince != null) {
    task.elapsedMs = getElapsed(task);
    task.runningSince = null;
  }
  task.title = trimmed;
  task.elapsedMs = Math.max(0, elapsedMs);
  saveTasks();
  render();
}

function filteredTasks() {
  if (filter === "active") return tasks.filter((t) => !t.done);
  if (filter === "done") return tasks.filter((t) => t.done);
  return tasks;
}

/** @param {Task[]} list */
function totalElapsed(list) {
  return list.reduce((sum, task) => sum + getElapsed(task), 0);
}

function updateTotal(visible = filteredTasks()) {
  const hasTasks = visible.length > 0;
  els.totalBar.hidden = !hasTasks;
  if (hasTasks) {
    els.totalTime.textContent = formatTime(totalElapsed(visible));
  }
}

/** @param {Task} task */
function taskActionsHtml(task) {
  if (task.done) {
    return `
      <button type="button" class="btn-icon" data-action="resume" title="Возобновить" aria-label="Возобновить">↩</button>
      <button type="button" class="btn-icon" data-action="edit" title="Изменить" aria-label="Изменить">✎</button>
      <button type="button" class="btn-icon is-danger" data-action="delete" title="Удалить" aria-label="Удалить">✕</button>
    `;
  }

  const running = task.runningSince != null;
  return `
    <button type="button" class="btn-icon ${running ? "is-running" : ""}" data-action="toggle" title="${running ? "Стоп" : "Старт"}" aria-label="${running ? "Стоп" : "Старт"}">${running ? "■" : "▶"}</button>
    <button type="button" class="btn-icon" data-action="complete" title="Завершить" aria-label="Завершить">✓</button>
    <button type="button" class="btn-icon" data-action="edit" title="Изменить" aria-label="Изменить">✎</button>
    <button type="button" class="btn-icon is-danger" data-action="delete" title="Удалить" aria-label="Удалить">✕</button>
  `;
}

function render() {
  const visible = filteredTasks();

  if (tasks.length === 0) {
    els.empty.hidden = false;
    els.empty.textContent = "Пока нет задач. Добавьте первую выше.";
  } else if (visible.length === 0) {
    els.empty.hidden = false;
    els.empty.textContent = filter === "done"
      ? "Нет завершённых задач."
      : "Нет активных задач.";
  } else {
    els.empty.hidden = true;
  }

  els.list.innerHTML = visible.map((task) => {
    const running = task.runningSince != null;
    const classes = ["task"];
    if (running) classes.push("is-running");
    if (task.done) classes.push("is-done");
    return `
      <li class="${classes.join(" ")}" data-id="${task.id}">
        <div class="task-main">
          <p class="task-title">${escapeHtml(task.title)}</p>
          <div class="task-meta">
            <span class="task-time" data-time>${formatTime(getElapsed(task))}</span>
            ${running ? '<span class="task-badge">идёт</span>' : ""}
          </div>
        </div>
        <div class="task-actions">
          ${taskActionsHtml(task)}
        </div>
      </li>
    `;
  }).join("");

  updateTotal(visible);
}

/** @param {string} text */
function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tick() {
  const nodes = els.list.querySelectorAll(".task.is-running [data-time]");
  for (const node of nodes) {
    const item = node.closest(".task");
    const id = item?.getAttribute("data-id");
    const task = id ? findTask(id) : null;
    if (!task) continue;
    node.textContent = formatTime(getElapsed(task));
  }
  if (nodes.length > 0) updateTotal();
}

/** @param {string} id */
function openEditModal(id) {
  const task = findTask(id);
  if (!task) return;
  editingId = id;
  els.editTitle.value = task.title;
  els.editTime.value = formatTime(getElapsed(task));
  els.modal.showModal();
  els.editTitle.focus();
  els.editTitle.select();
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  createTask(els.title.value);
  els.title.value = "";
  els.title.focus();
});

els.list.addEventListener("click", (e) => {
  const btn = e.target instanceof Element ? e.target.closest("[data-action]") : null;
  if (!(btn instanceof HTMLElement)) return;
  const item = btn.closest(".task");
  const id = item?.getAttribute("data-id");
  if (!id) return;

  const action = btn.dataset.action;
  if (action === "toggle") toggleTimer(id);
  else if (action === "complete") completeTask(id);
  else if (action === "resume") resumeTask(id);
  else if (action === "edit") openEditModal(id);
  else if (action === "delete") {
    if (confirm("Удалить задачу?")) deleteTask(id);
  }
});

els.filters.forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter ?? "active";
    els.filters.forEach((b) => {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });
    render();
  });
});

els.editForm.addEventListener("submit", (e) => {
  const submitter = /** @type {HTMLButtonElement | null} */ (e.submitter);
  if (submitter?.value === "cancel") {
    editingId = null;
    return;
  }

  e.preventDefault();
  if (!editingId) {
    els.modal.close();
    return;
  }

  const ms = parseTime(els.editTime.value);
  if (ms == null) {
    els.editTime.setCustomValidity("Формат: чч:мм:сс");
    els.editTime.reportValidity();
    els.editTime.setCustomValidity("");
    return;
  }

  updateTask(editingId, els.editTitle.value, ms);
  editingId = null;
  els.modal.close();
});

els.modal.addEventListener("close", () => {
  editingId = null;
});

setInterval(tick, 250);
render();
els.title.focus();
