/**
 * TaskFlow — a small, dependency-free task manager.
 *
 * Sections:
 *   1. Constants & state
 *   2. Storage
 *   3. Date helpers
 *   4. Derived data (filter / sort / stats)
 *   5. Rendering
 *   6. Task actions
 *   7. Modals
 *   8. Toasts
 *   9. Theme
 *  10. Events & init
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------- */
  /* 1. Constants & state                                                    */
  /* ---------------------------------------------------------------------- */

  const STORAGE_KEYS = {
    tasks: "taskflow.tasks",
    theme: "taskflow.theme",
  };

  const PRIORITIES = { low: "Low", medium: "Medium", high: "High" };
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  const CATEGORIES = {
    personal: "Personal",
    work: "Work",
    study: "Study",
    shopping: "Shopping",
    other: "Other",
  };

  const DUE_SOON_DAYS = 2;
  const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

  const state = {
    tasks: [],
    search: "",
    statusFilter: "all",
    categoryFilter: "all",
    sortBy: "newest",
    editingId: null,
    pendingDeleteId: null,
    lastDeleted: null,
  };

  const $ = (selector) => document.querySelector(selector);

  const el = {
    greeting: $("#greeting"),
    todayDate: $("#todayDate"),

    statTotal: $("#statTotal"),
    statCompleted: $("#statCompleted"),
    statPending: $("#statPending"),
    statProgress: $("#statProgress"),

    form: $("#taskForm"),
    title: $("#taskTitle"),
    description: $("#taskDescription"),
    dueDate: $("#taskDueDate"),
    priority: $("#taskPriority"),
    category: $("#taskCategory"),
    titleError: $("#titleError"),
    dueDateError: $("#dueDateError"),

    search: $("#searchInput"),
    sortSelect: $("#sortSelect"),
    statusFilters: $("#statusFilters"),
    categoryFilters: $("#categoryFilters"),

    taskList: $("#taskList"),
    activeCount: $("#activeCount"),
    completedSection: $("#completedSection"),
    completedList: $("#completedList"),
    completedCount: $("#completedCount"),
    clearCompletedBtn: $("#clearCompletedBtn"),

    emptyState: $("#emptyState"),
    emptyTitle: $("#emptyTitle"),
    emptyText: $("#emptyText"),
    emptyAddBtn: $("#emptyAddBtn"),

    progressRing: $("#progressRing"),
    progressPercent: $("#progressPercent"),
    progressCompleted: $("#progressCompleted"),
    progressRemaining: $("#progressRemaining"),

    todayList: $("#todayList"),
    todayEmpty: $("#todayEmpty"),
    upcomingList: $("#upcomingList"),
    upcomingEmpty: $("#upcomingEmpty"),

    editModal: $("#editModal"),
    editForm: $("#editForm"),
    editTitle: $("#editTitle"),
    editDescription: $("#editDescription"),
    editDueDate: $("#editDueDate"),
    editPriority: $("#editPriority"),
    editCategory: $("#editCategory"),
    editTitleError: $("#editTitleError"),

    deleteModal: $("#deleteModal"),
    deleteModalText: $("#deleteModalText"),
    confirmDeleteBtn: $("#confirmDeleteBtn"),

    themeToggle: $("#themeToggle"),
    toastStack: $("#toastStack"),
  };

  /* ---------------------------------------------------------------------- */
  /* 2. Storage                                                              */
  /* ---------------------------------------------------------------------- */

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* storage unavailable (private mode / quota) — keep working in memory */
    }
  }

  function normalizeTask(raw) {
    if (!raw || typeof raw.title !== "string" || !raw.title.trim()) return null;
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
      title: raw.title.trim().slice(0, 120),
      description: typeof raw.description === "string" ? raw.description.trim().slice(0, 500) : "",
      dueDate: isValidDateString(raw.dueDate) ? raw.dueDate : "",
      priority: PRIORITIES[raw.priority] ? raw.priority : "medium",
      category: CATEGORIES[raw.category] ? raw.category : "other",
      completed: Boolean(raw.completed),
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
      completedAt: Number.isFinite(raw.completedAt) ? raw.completedAt : null,
    };
  }

  function loadTasks() {
    const stored = readStorage(STORAGE_KEYS.tasks);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeTask).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function saveTasks() {
    writeStorage(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "t-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  /* ---------------------------------------------------------------------- */
  /* 3. Date helpers                                                         */
  /* ---------------------------------------------------------------------- */

  function isValidDateString(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  /** Local "YYYY-MM-DD" for a Date (avoids UTC shifts from toISOString). */
  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function todayKey() {
    return toDateKey(new Date());
  }

  /** Whole days from today to a date key (negative = past). */
  function daysUntil(dateKey) {
    if (!isValidDateString(dateKey)) return null;
    const [y, m, d] = dateKey.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function formatDueDate(dateKey) {
    const diff = daysUntil(dateKey);
    if (diff === null) return "";
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const options = { month: "short", day: "numeric" };
    if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
    return date.toLocaleDateString(undefined, options);
  }

  function formatCreatedAt(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function greetingText() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning 👋";
    if (hour < 17) return "Good Afternoon 👋";
    return "Good Evening 👋";
  }

  /* ---------------------------------------------------------------------- */
  /* 4. Derived data                                                         */
  /* ---------------------------------------------------------------------- */

  function matchesSearch(task, query) {
    if (!query) return true;
    const needle = query.trim().toLowerCase();
    return (
      task.title.toLowerCase().includes(needle) ||
      task.description.toLowerCase().includes(needle)
    );
  }

  function matchesStatus(task, filter) {
    switch (filter) {
      case "active":
        return !task.completed;
      case "completed":
        return task.completed;
      case "high":
        return task.priority === "high";
      case "today":
        return task.dueDate === todayKey();
      default:
        return true;
    }
  }

  function matchesCategory(task, category) {
    return category === "all" || task.category === category;
  }

  function getVisibleTasks() {
    return sortTasks(
      state.tasks.filter(
        (task) =>
          matchesSearch(task, state.search) &&
          matchesStatus(task, state.statusFilter) &&
          matchesCategory(task, state.categoryFilter)
      )
    );
  }

  function sortTasks(tasks) {
    const sorted = tasks.slice();
    switch (state.sortBy) {
      case "oldest":
        return sorted.sort((a, b) => a.createdAt - b.createdAt);
      case "priority":
        return sorted.sort(
          (a, b) =>
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            b.createdAt - a.createdAt
        );
      case "dueDate":
        return sorted.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate) || b.createdAt - a.createdAt;
        });
      default:
        return sorted.sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  function getStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter((task) => task.completed).length;
    const pending = total - completed;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pending, progress };
  }

  function findTask(id) {
    return state.tasks.find((task) => task.id === id) || null;
  }

  /* ---------------------------------------------------------------------- */
  /* 5. Rendering                                                            */
  /* ---------------------------------------------------------------------- */

  const ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="3"></rect><path d="M8 3v4M16 3v4M3.5 10h17"></path></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V4h11l-1.6 4L17 12H6"></path></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 3.5H20V11l-8.6 8.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8z"></path><circle cx="16.4" cy="7.6" r="1.2"></circle></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16z"></path><path d="M14.5 5.5 18.5 9.5"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"></path><path d="M6.5 7l.8 12A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.9l.8-12"></path></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4 3 20h18z"></path><path d="M12 10v4M12 17h.01"></path></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg>',
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function dueStatus(task) {
    if (task.completed || !task.dueDate) return "none";
    const diff = daysUntil(task.dueDate);
    if (diff === null) return "none";
    if (diff < 0) return "overdue";
    if (diff <= DUE_SOON_DAYS) return "soon";
    return "future";
  }

  function buildTaskElement(task) {
    const item = document.createElement("li");
    const status = dueStatus(task);

    item.className = "task";
    item.dataset.id = task.id;
    if (task.completed) item.classList.add("is-completed");
    if (status === "overdue") item.classList.add("is-overdue");
    if (status === "soon") item.classList.add("is-due-soon");

    const dueTagClass =
      status === "overdue" ? "tag--overdue" : status === "soon" ? "tag--due-soon" : "";
    const dueTag = task.dueDate
      ? `<span class="tag ${dueTagClass}">${ICONS.calendar}${escapeHtml(
          status === "overdue" ? `Overdue · ${formatDueDate(task.dueDate)}` : formatDueDate(task.dueDate)
        )}</span>`
      : "";

    item.innerHTML = `
      <button class="task-check" type="button" data-action="toggle"
        aria-pressed="${task.completed}"
        aria-label="${task.completed ? "Mark as active" : "Mark complete"}">${ICONS.check}</button>
      <div class="task-body">
        <p class="task-title">${escapeHtml(task.title)}</p>
        ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ""}
        <div class="task-meta">
          ${dueTag}
          <span class="tag tag--${task.priority}">${ICONS.flag}${PRIORITIES[task.priority]}</span>
          <span class="tag tag--category">${ICONS.tag}${CATEGORIES[task.category]}</span>
          <span class="tag tag--created">Created ${escapeHtml(formatCreatedAt(task.createdAt))}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn" type="button" data-action="edit" aria-label="Edit task">${ICONS.edit}</button>
        <button class="action-btn action-btn--danger" type="button" data-action="delete" aria-label="Delete task">${ICONS.trash}</button>
      </div>
    `;
    return item;
  }

  function buildMiniElement(task) {
    const item = document.createElement("li");
    const status = dueStatus(task);

    item.className = "mini-item";
    item.dataset.id = task.id;
    if (task.completed) item.classList.add("is-completed");
    if (status === "soon" || status === "overdue") item.classList.add("is-soon");

    const subtitle = task.dueDate
      ? status === "overdue"
        ? `Overdue · ${formatDueDate(task.dueDate)}`
        : formatDueDate(task.dueDate)
      : "No due date";

    item.innerHTML = `
      <span class="mini-dot mini-dot--${task.priority}" aria-hidden="true"></span>
      <span class="mini-text">
        <span class="mini-title">${escapeHtml(task.title)}</span>
        <span class="mini-sub">${escapeHtml(subtitle)} · ${CATEGORIES[task.category]}</span>
      </span>
    `;
    return item;
  }

  function renderLists() {
    const visible = getVisibleTasks();
    const showCompletedSeparately = state.statusFilter !== "completed";
    const active = showCompletedSeparately ? visible.filter((t) => !t.completed) : visible;
    const completed = showCompletedSeparately ? visible.filter((t) => t.completed) : [];

    el.taskList.replaceChildren(...active.map(buildTaskElement));
    el.activeCount.textContent = String(active.length);

    el.completedList.replaceChildren(...completed.map(buildTaskElement));
    el.completedCount.textContent = String(completed.length);
    el.completedSection.hidden = completed.length === 0;

    renderEmptyState(visible.length === 0);
  }

  function renderEmptyState(isEmpty) {
    el.emptyState.hidden = !isEmpty;
    if (!isEmpty) return;

    const hasTasks = state.tasks.length > 0;
    if (hasTasks) {
      el.emptyTitle.textContent = "No matching tasks";
      el.emptyText.textContent = "Try a different search, filter or category.";
      el.emptyAddBtn.textContent = "Clear filters";
      el.emptyAddBtn.dataset.mode = "reset";
    } else {
      el.emptyTitle.textContent = "No tasks yet";
      el.emptyText.textContent = "Add your first task and start being productive.";
      el.emptyAddBtn.textContent = "Add Your First Task";
      el.emptyAddBtn.dataset.mode = "add";
    }
  }

  function renderStats() {
    const { total, completed, pending, progress } = getStats();
    el.statTotal.textContent = String(total);
    el.statCompleted.textContent = String(completed);
    el.statPending.textContent = String(pending);
    el.statProgress.textContent = `${progress}%`;

    el.progressPercent.textContent = `${progress}%`;
    el.progressCompleted.textContent = String(completed);
    el.progressRemaining.textContent = String(pending);
    el.progressRing.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    el.progressRing.style.strokeDashoffset = String(
      RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * progress) / 100
    );
  }

  function renderCategoryCounts() {
    el.categoryFilters.querySelectorAll("[data-count]").forEach((node) => {
      const key = node.dataset.count;
      node.textContent = String(
        key === "all"
          ? state.tasks.length
          : state.tasks.filter((task) => task.category === key).length
      );
    });
  }

  function renderSideLists() {
    const today = todayKey();
    const todays = state.tasks
      .filter((task) => task.dueDate === today)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

    el.todayList.replaceChildren(...todays.map(buildMiniElement));
    el.todayEmpty.hidden = todays.length > 0;
    el.todayEmpty.textContent = "You're all caught up! 🎉";

    const upcoming = state.tasks
      .filter((task) => !task.completed && task.dueDate && task.dueDate > today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6);

    el.upcomingList.replaceChildren(...upcoming.map(buildMiniElement));
    el.upcomingEmpty.hidden = upcoming.length > 0;
  }

  function render() {
    renderStats();
    renderCategoryCounts();
    renderLists();
    renderSideLists();
  }

  function renderHeaderDate() {
    el.greeting.textContent = greetingText();
    el.todayDate.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  /* ---------------------------------------------------------------------- */
  /* 6. Task actions                                                         */
  /* ---------------------------------------------------------------------- */

  function showFieldError(input, errorNode, message) {
    input.classList.add("is-invalid");
    errorNode.textContent = message;
    errorNode.hidden = false;
  }

  function clearFieldError(input, errorNode) {
    input.classList.remove("is-invalid");
    errorNode.textContent = "";
    errorNode.hidden = true;
  }

  function addTask() {
    const title = el.title.value.trim();
    clearFieldError(el.title, el.titleError);
    clearFieldError(el.dueDate, el.dueDateError);

    if (!title) {
      showFieldError(el.title, el.titleError, "Please enter a task title.");
      el.title.focus();
      return;
    }
    if (title.length < 3) {
      showFieldError(el.title, el.titleError, "Use at least 3 characters.");
      el.title.focus();
      return;
    }
    if (el.dueDate.value && !isValidDateString(el.dueDate.value)) {
      showFieldError(el.dueDate, el.dueDateError, "Please pick a valid date.");
      return;
    }

    state.tasks.unshift({
      id: createId(),
      title,
      description: el.description.value.trim(),
      dueDate: el.dueDate.value,
      priority: el.priority.value,
      category: el.category.value,
      completed: false,
      createdAt: Date.now(),
      completedAt: null,
    });

    saveTasks();
    render();

    el.form.reset();
    el.priority.value = "medium";
    el.category.value = "personal";
    el.title.focus();

    toast("Task added successfully", "success");
  }

  function toggleTask(id) {
    const task = findTask(id);
    if (!task) return;

    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;
    saveTasks();
    render();
    toast(task.completed ? "Task completed" : "Task marked active", task.completed ? "success" : "info");
  }

  function saveEditedTask() {
    const task = findTask(state.editingId);
    if (!task) return;

    const title = el.editTitle.value.trim();
    clearFieldError(el.editTitle, el.editTitleError);
    if (title.length < 3) {
      showFieldError(el.editTitle, el.editTitleError, "Use at least 3 characters.");
      el.editTitle.focus();
      return;
    }

    task.title = title;
    task.description = el.editDescription.value.trim();
    task.dueDate = isValidDateString(el.editDueDate.value) ? el.editDueDate.value : "";
    task.priority = el.editPriority.value;
    task.category = el.editCategory.value;

    saveTasks();
    render();
    closeModal(el.editModal);
    toast("Task updated successfully", "success");
  }

  function deleteTask(id) {
    const index = state.tasks.findIndex((task) => task.id === id);
    if (index === -1) return;

    const node = document.querySelector(`.task[data-id="${id}"]`);
    state.lastDeleted = { task: state.tasks[index], index };
    state.tasks.splice(index, 1);
    saveTasks();

    const finish = () => {
      render();
      toast("Task deleted", "danger", { label: "Undo", onClick: undoDelete });
    };

    if (node) {
      node.classList.add("is-removing");
      node.addEventListener("animationend", finish, { once: true });
      window.setTimeout(finish, 400);
    } else {
      finish();
    }
  }

  function undoDelete() {
    if (!state.lastDeleted) return;
    const { task, index } = state.lastDeleted;
    state.tasks.splice(Math.min(index, state.tasks.length), 0, task);
    state.lastDeleted = null;
    saveTasks();
    render();
    toast("Task restored", "info");
  }

  function clearCompleted() {
    const removed = state.tasks.filter((task) => task.completed).length;
    if (!removed) return;
    state.tasks = state.tasks.filter((task) => !task.completed);
    saveTasks();
    render();
    toast(`${removed} completed task${removed === 1 ? "" : "s"} cleared`, "info");
  }

  function resetFilters() {
    state.search = "";
    state.statusFilter = "all";
    state.categoryFilter = "all";
    el.search.value = "";
    setActiveChip(el.statusFilters, "[data-filter]", "all", "filter");
    setActiveChip(el.categoryFilters, "[data-category]", "all", "category");
    render();
  }

  function setActiveChip(container, selector, value, datasetKey) {
    container.querySelectorAll(selector).forEach((chip) => {
      const isActive = chip.dataset[datasetKey] === value;
      chip.classList.toggle("is-active", isActive);
      if (chip.hasAttribute("aria-selected")) {
        chip.setAttribute("aria-selected", String(isActive));
      }
    });
  }

  /* ---------------------------------------------------------------------- */
  /* 7. Modals                                                               */
  /* ---------------------------------------------------------------------- */

  let lastFocused = null;

  function openModal(modal) {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    const focusable = modal.querySelector("input, textarea, select, button");
    if (focusable) focusable.focus();
  }

  function closeModal(modal) {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (modal === el.editModal) state.editingId = null;
    if (modal === el.deleteModal) state.pendingDeleteId = null;
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function closeAnyOpenModal() {
    [el.editModal, el.deleteModal].forEach((modal) => {
      if (!modal.hidden) closeModal(modal);
    });
  }

  function openEditModal(id) {
    const task = findTask(id);
    if (!task) return;

    state.editingId = id;
    el.editTitle.value = task.title;
    el.editDescription.value = task.description;
    el.editDueDate.value = task.dueDate;
    el.editPriority.value = task.priority;
    el.editCategory.value = task.category;
    clearFieldError(el.editTitle, el.editTitleError);
    openModal(el.editModal);
  }

  function openDeleteModal(id) {
    const task = findTask(id);
    if (!task) return;

    state.pendingDeleteId = id;
    el.deleteModalText.textContent = `Are you sure you want to delete "${task.title}"?`;
    openModal(el.deleteModal);
  }

  /* ---------------------------------------------------------------------- */
  /* 8. Toasts                                                               */
  /* ---------------------------------------------------------------------- */

  function toast(message, variant, action) {
    const node = document.createElement("div");
    node.className = `toast toast--${variant || "info"}`;
    const icon = variant === "danger" ? ICONS.warning : variant === "success" ? ICONS.check : ICONS.info;
    node.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${escapeHtml(
      message
    )}</span>`;

    if (action && typeof action.onClick === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-ghost btn-sm";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        action.onClick();
        dismiss();
      });
      node.style.pointerEvents = "auto";
      node.appendChild(button);
    }

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      node.classList.add("is-leaving");
      node.addEventListener("animationend", () => node.remove(), { once: true });
      window.setTimeout(() => node.remove(), 400);
    }

    el.toastStack.appendChild(node);
    window.setTimeout(dismiss, action ? 8000 : 2600);

    const toasts = el.toastStack.querySelectorAll(".toast");
    if (toasts.length > 3) toasts[0].remove();
  }

  /* ---------------------------------------------------------------------- */
  /* 9. Theme                                                                */
  /* ---------------------------------------------------------------------- */

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    el.themeToggle.setAttribute("aria-pressed", String(next === "dark"));
    el.themeToggle.setAttribute(
      "aria-label",
      next === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    writeStorage(STORAGE_KEYS.theme, next);
  }

  function initTheme() {
    const stored = readStorage(STORAGE_KEYS.theme);
    if (stored === "dark" || stored === "light") {
      applyTheme(stored);
      return;
    }
    const prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  }

  /* ---------------------------------------------------------------------- */
  /* 10. Events & init                                                       */
  /* ---------------------------------------------------------------------- */

  function handleListClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const item = button.closest(".task");
    if (!item) return;

    const id = item.dataset.id;
    if (button.dataset.action === "toggle") toggleTask(id);
    if (button.dataset.action === "edit") openEditModal(id);
    if (button.dataset.action === "delete") openDeleteModal(id);
  }

  function bindEvents() {
    el.form.addEventListener("submit", (event) => {
      event.preventDefault();
      addTask();
    });

    el.title.addEventListener("input", () => clearFieldError(el.title, el.titleError));

    // Enter submits from the description too (Shift+Enter inserts a newline).
    el.description.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        addTask();
      }
    });

    el.search.addEventListener("input", () => {
      state.search = el.search.value;
      renderLists();
    });

    el.sortSelect.addEventListener("change", () => {
      state.sortBy = el.sortSelect.value;
      renderLists();
    });

    el.statusFilters.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-filter]");
      if (!chip) return;
      state.statusFilter = chip.dataset.filter;
      setActiveChip(el.statusFilters, "[data-filter]", state.statusFilter, "filter");
      renderLists();
    });

    el.categoryFilters.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-category]");
      if (!chip) return;
      state.categoryFilter = chip.dataset.category;
      setActiveChip(el.categoryFilters, "[data-category]", state.categoryFilter, "category");
      renderLists();
    });

    el.taskList.addEventListener("click", handleListClick);
    el.completedList.addEventListener("click", handleListClick);
    el.clearCompletedBtn.addEventListener("click", clearCompleted);

    el.emptyAddBtn.addEventListener("click", () => {
      if (el.emptyAddBtn.dataset.mode === "reset") {
        resetFilters();
        return;
      }
      el.title.focus();
      el.title.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    el.editForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveEditedTask();
    });

    el.confirmDeleteBtn.addEventListener("click", () => {
      const id = state.pendingDeleteId;
      closeModal(el.deleteModal);
      if (id) deleteTask(id);
    });

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop")));
    });

    [el.editModal, el.deleteModal].forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal);
      });
    });

    el.themeToggle.addEventListener("click", toggleTheme);

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

      if (event.key === "Escape") {
        closeAnyOpenModal();
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        el.search.focus();
        el.search.select();
        return;
      }
      if ((event.key === "t" || event.key === "T") && !typing) {
        toggleTheme();
      }
    });
  }

  function init() {
    initTheme();
    state.tasks = loadTasks();
    renderHeaderDate();
    bindEvents();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
