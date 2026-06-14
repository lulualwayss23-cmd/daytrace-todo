const STORAGE_KEY = "morandiTodo.tasks.v1";
const HABITS_STORAGE_KEY = "morandiTodo.habits.v1";

const tabButtons = document.querySelectorAll(".tab-button");
const pages = document.querySelectorAll(".page");
const todayLabel = document.querySelector("#today-label");
const toast = document.querySelector(".toast");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#task-empty-state");
const taskListTitle = document.querySelector("#task-list-title");
const taskSummary = document.querySelector("#task-summary");
const taskEmptyTitle = document.querySelector("#task-empty-title");
const taskEmptyDescription = document.querySelector("#task-empty-description");
const emptyAddTaskButton = document.querySelector("#empty-add-task");
const emptyAddTaskIcon = document.querySelector("#empty-icon-add-task");
const previousTaskDateButton = document.querySelector("#previous-task-date");
const nextTaskDateButton = document.querySelector("#next-task-date");
const returnTodayButton = document.querySelector("#return-today");
const taskDialog = document.querySelector("#task-dialog");
const taskForm = document.querySelector("#task-form");
const taskTitleInput = document.querySelector("#task-title");
const taskDialogTitle = document.querySelector("#task-dialog-title");
const taskSubmitButton = document.querySelector("#task-submit-button");
const countdownField = document.querySelector("#countdown-field");
const countdownMinutes = document.querySelector("#countdown-minutes");
const taskHabitLink = document.querySelector("#task-habit-link");
const habitLinkHint = document.querySelector("#habit-link-hint");
const historyDialog = document.querySelector("#history-dialog");
const historyList = document.querySelector("#history-list");
const habitGrid = document.querySelector("#habit-grid");
const habitEmptyState = document.querySelector("#habit-empty-state");
const habitDialog = document.querySelector("#habit-dialog");
const habitForm = document.querySelector("#habit-form");
const habitNameInput = document.querySelector("#habit-name");
const habitDialogTitle = document.querySelector("#habit-dialog-title");
const habitSubmitButton = document.querySelector("#habit-submit-button");
const habitTargetInput = document.querySelector("#habit-target");
const habitTargetLabel = document.querySelector("#habit-target-label");
const habitTargetUnit = document.querySelector("#habit-target-unit");
const checkinDialog = document.querySelector("#checkin-dialog");
const checkinForm = document.querySelector("#checkin-form");
const checkinTitle = document.querySelector("#checkin-title");
const checkinHabitName = document.querySelector("#checkin-habit-name");
const checkinMinutesInput = document.querySelector("#checkin-minutes");
const settingsDialog = document.querySelector("#settings-dialog");
const importFileInput = document.querySelector("#import-file");
const reportDialog = document.querySelector("#report-dialog");
const weeklyReportText = document.querySelector("#weekly-report-text");

const modeDetails = {
  "count-up": { label: "正向计时", className: "count-up" },
  countdown: { label: "倒计时", className: "countdown" },
  "no-timer": { label: "不计时", className: "no-timer" },
};

let tasks = loadTasks();
let habits = loadHabits();
let activeHabitView = "week";
let activeTaskDate = getLocalDateKey();
let editingTaskId = null;
let editingHabitId = null;
let editingCheckinHabitId = null;
let audioContext = null;
let tickInterval = null;
let activeSoundTaskId = null;

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTask(task) {
  const countdownSeconds = Math.max(0, Number(task.minutes || 0) * 60);
  return {
    ...task,
    elapsedSeconds: Number.isFinite(task.elapsedSeconds) ? task.elapsedSeconds : 0,
    remainingSeconds:
      task.mode === "countdown"
        ? Number.isFinite(task.remainingSeconds)
          ? task.remainingSeconds
          : countdownSeconds
        : null,
    timerState: task.timerState || "idle",
    timerStartedAt: task.timerStartedAt || null,
    tickSound: task.tickSound !== false,
    linkedHabitId: task.linkedHabitId || null,
    syncedMinutes: Number.isFinite(task.syncedMinutes) ? task.syncedMinutes : 0,
    habitSyncCompleted: Boolean(task.habitSyncCompleted || task.syncedMinutes > 0),
    syncedAt: task.syncedAt || null,
  };
}

function loadTasks() {
  try {
    const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(savedTasks) ? savedTasks.map(normalizeTask) : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function normalizeHabit(habit) {
  const records = habit.records && typeof habit.records === "object" ? habit.records : {};
  const savedTimeRecords =
    habit.timeRecords && typeof habit.timeRecords === "object" ? habit.timeRecords : {};
  const timeRecords = { ...savedTimeRecords };

  if (habit.goalType === "duration") {
    Object.entries(records).forEach(([dateKey, value]) => {
      if (!Number.isFinite(Number(timeRecords[dateKey]))) {
        timeRecords[dateKey] = Math.max(0, Number(value) || 0);
      }
    });
  }

  return {
    ...habit,
    target: Math.max(1, Number(habit.target) || 1),
    goalType: habit.goalType === "duration" ? "duration" : "count",
    color: ["blue", "green", "red", "yellow"].includes(habit.color) ? habit.color : "blue",
    records,
    checkIns: habit.checkIns && typeof habit.checkIns === "object" ? habit.checkIns : {},
    timeRecords,
  };
}

function loadHabits() {
  try {
    const savedHabits = JSON.parse(localStorage.getItem(HABITS_STORAGE_KEY));
    return Array.isArray(savedHabits) ? savedHabits.map(normalizeHabit) : [];
  } catch {
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
}

function escapeHtml(value) {
  const temporary = document.createElement("div");
  temporary.textContent = value;
  return temporary.innerHTML;
}

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function getWeekDates(date = new Date()) {
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  const monday = addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

function formatClockTime(isoDate) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoDate));
}

function formatHistoryDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

function formatShortDate(dateKey) {
  const date = dateFromKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function getRunningDelta(task, now = Date.now()) {
  if (task.timerState !== "running" || !task.timerStartedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(task.timerStartedAt).getTime()) / 1000));
}

function getElapsedSeconds(task, now = Date.now()) {
  return task.elapsedSeconds + getRunningDelta(task, now);
}

function getRemainingSeconds(task, now = Date.now()) {
  return Math.max(0, task.remainingSeconds - getRunningDelta(task, now));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function switchPage(pageName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.page === pageName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  pages.forEach((page) => {
    const isActive = page.id === `${pageName}-page`;
    page.classList.toggle("active", isActive);
    page.hidden = !isActive;
  });
}

function getTimerStatusText(task) {
  if (task.completed) return `已完成于 ${formatClockTime(task.completedAt)}`;
  if (task.timerState === "running") return task.tickSound ? "计时中 · 滴答声已开启" : "正在计时";
  if (task.timerState === "paused") return "已暂停，可继续计时";
  if (task.mode === "countdown") return `计划 ${task.minutes} 分钟`;
  if (task.mode === "count-up") return "等待开始计时";
  return "普通任务";
}

function getTimerButton(task) {
  if (task.mode === "no-timer" || task.completed) return "";
  if (task.date !== getLocalDateKey() && task.timerState !== "running") return "";
  const isRunning = task.timerState === "running";
  const label = isRunning ? "暂停" : task.timerState === "paused" ? "继续" : "开始";
  return `
    <button
      class="timer-button ${isRunning ? "running" : ""}"
      data-action="${isRunning ? "pause" : "start"}"
      type="button"
    >${label}</button>
  `;
}

function getSoundButton(task) {
  if (task.mode === "no-timer" || task.completed) return "";
  if (task.date !== getLocalDateKey() && task.timerState !== "running") return "";
  return `
    <button
      class="sound-button ${task.tickSound ? "enabled" : ""}"
      data-action="sound"
      type="button"
      aria-label="${task.tickSound ? "关闭" : "开启"}${escapeHtml(task.title)}的滴答声"
      title="${task.tickSound ? "关闭滴答声" : "开启滴答声"}"
    >${task.tickSound ? "声" : "静"}</button>
  `;
}

function getLinkedHabit(task) {
  return habits.find((habit) => habit.id === task.linkedHabitId) || null;
}

function getTaskLinkText(task) {
  if (!task.linkedHabitId) return "";
  const habit = getLinkedHabit(task);
  if (!habit) return "关联习惯已删除";
  const syncedText = task.syncedMinutes > 0 ? ` · 已同步 ${task.syncedMinutes} 分钟` : "";
  return `关联习惯：${escapeHtml(habit.name)}${syncedText}`;
}

function createTaskCard(task) {
  const mode = modeDetails[task.mode] || modeDetails["no-timer"];
  const displaySeconds =
    task.mode === "countdown" ? getRemainingSeconds(task) : getElapsedSeconds(task);
  const hasTimer = task.mode !== "no-timer";

  return `
    <article class="task-card ${task.completed ? "completed" : ""} ${task.timerState === "running" ? "timing" : ""}" data-task-id="${task.id}">
      <button
        class="check-button ${task.completed ? "checked" : ""}"
        data-action="toggle"
        type="button"
        aria-label="${task.completed ? "取消完成" : "标记完成"}：${escapeHtml(task.title)}"
      >${task.completed ? '<span aria-hidden="true">✓</span>' : ""}</button>
      <div class="task-content">
        <div class="task-title-row">
          <h3>${escapeHtml(task.title)}</h3>
          <span class="mode-tag ${mode.className}">${mode.label}</span>
        </div>
        <p>${getTimerStatusText(task)}</p>
        ${task.linkedHabitId ? `<p class="task-link-note">${getTaskLinkText(task)}</p>` : ""}
      </div>
      <div class="task-controls">
        ${hasTimer ? `<strong class="static-time" data-timer-display>${formatDuration(displaySeconds)}</strong>` : ""}
        ${getSoundButton(task)}
        ${getTimerButton(task)}
        <button class="edit-button" data-action="edit" type="button" aria-label="编辑：${escapeHtml(task.title)}">编辑</button>
        <button class="delete-button" data-action="delete" type="button" aria-label="删除：${escapeHtml(task.title)}">删除</button>
      </div>
    </article>
  `;
}

function getTodayTasks() {
  return getTasksForDate(getLocalDateKey());
}

function getTasksForDate(dateKey) {
  return tasks
    .filter((task) => task.date === dateKey)
    .sort((a, b) => Number(a.completed) - Number(b.completed) || b.createdAt.localeCompare(a.createdAt));
}

function updateTaskListHeader(dateTasks) {
  const todayKey = getLocalDateKey();
  const isToday = activeTaskDate === todayKey;
  const completedCount = dateTasks.filter((task) => task.completed).length;
  const remainingCount = dateTasks.length - completedCount;

  taskListTitle.textContent = isToday ? "今日任务" : `${formatShortDate(activeTaskDate)}任务`;
  taskSummary.textContent = dateTasks.length
    ? remainingCount > 0
      ? `${completedCount} / ${dateTasks.length} 完成`
      : `已完成全部 ${dateTasks.length} 项`
    : "暂无任务";

  returnTodayButton.textContent = isToday ? "今天" : formatShortDate(activeTaskDate);
  returnTodayButton.classList.toggle("viewing-history", !isToday);
  returnTodayButton.setAttribute(
    "aria-label",
    isToday ? "当前正在查看今天" : `${formatShortDate(activeTaskDate)}，点击回到今天`,
  );
  nextTaskDateButton.disabled = activeTaskDate >= todayKey;

  taskEmptyTitle.textContent = isToday ? "今天还没有计划" : "这一天没有计划记录";
  taskEmptyDescription.textContent = isToday
    ? "先添加一件想完成的小事吧。"
    : "可以继续切换日期，或点击日期按钮回到今天。";
  emptyAddTaskButton.hidden = !isToday;
  emptyAddTaskIcon.hidden = !isToday;
}

function updateOverview() {
  const todayTasks = getTodayTasks();
  const completedCount = todayTasks.filter((task) => task.completed).length;
  const progress = todayTasks.length ? Math.round((completedCount / todayTasks.length) * 100) : 0;
  const totalSeconds = todayTasks.reduce((sum, task) => sum + getElapsedSeconds(task), 0);
  const activeTask = todayTasks.find((task) => task.timerState === "running");

  document.querySelector("#today-progress-text").textContent = `${completedCount} / ${todayTasks.length}`;
  document.querySelector("#today-progress-track span").style.width = `${progress}%`;
  document.querySelector("#today-progress-track").setAttribute("aria-label", `今日任务完成 ${progress}%`);
  document.querySelector("#focus-time").textContent = Math.floor(totalSeconds / 60);
  document.querySelector("#timer-status").textContent = activeTask
    ? `正在进行：${activeTask.title}`
    : totalSeconds > 0
      ? "专注时间已自动保存"
      : "还没有开始计时";
}

function renderTasks() {
  const dateTasks = getTasksForDate(activeTaskDate);
  taskList.innerHTML = dateTasks.map(createTaskCard).join("");
  emptyState.hidden = dateTasks.length > 0;
  updateTaskListHeader(dateTasks);
  updateOverview();
  renderStats();
  syncTickSound();
}

function changeTaskDate(dayOffset) {
  const todayKey = getLocalDateKey();
  const nextDateKey = getLocalDateKey(addDays(dateFromKey(activeTaskDate), dayOffset));
  activeTaskDate = nextDateKey > todayKey ? todayKey : nextDateKey;
  renderTasks();
}

function returnToToday() {
  if (activeTaskDate === getLocalDateKey()) return;
  activeTaskDate = getLocalDateKey();
  renderTasks();
}

function openNewTaskDialog() {
  returnToToday();
  openTaskDialog();
}

function getHabitUnit(habit) {
  return habit.goalType === "duration" ? "分钟" : "次";
}

function getHabitStep(habit) {
  return habit.goalType === "duration" ? 5 : 1;
}

function getHabitValue(habit, dateKey = getLocalDateKey()) {
  return Math.max(0, Number(habit.records[dateKey]) || 0);
}

function getHabitTime(habit, dateKey = getLocalDateKey()) {
  return Math.max(0, Number(habit.timeRecords[dateKey]) || 0);
}

function getHabitTotalTime(habit) {
  return Object.values(habit.timeRecords).reduce(
    (total, value) => total + Math.max(0, Number(value) || 0),
    0,
  );
}

function getSyncedMinutesForHabit(habit, dateKey = getLocalDateKey()) {
  return tasks
    .filter((task) => task.linkedHabitId === habit.id && task.date === dateKey)
    .reduce((total, task) => total + task.syncedMinutes, 0);
}

function isHabitComplete(habit, dateKey = getLocalDateKey()) {
  return Boolean(habit.checkIns[dateKey]) || getHabitValue(habit, dateKey) >= habit.target;
}

function getHabitCompletedDates(habit) {
  return [...new Set([...Object.keys(habit.records), ...Object.keys(habit.checkIns)])]
    .filter((dateKey) => isHabitComplete(habit, dateKey))
    .sort();
}

function getCurrentStreak(habit) {
  let cursor = new Date();
  if (!isHabitComplete(habit, getLocalDateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (isHabitComplete(habit, getLocalDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function getLongestStreak(habit) {
  const completedDates = getHabitCompletedDates(habit);
  if (completedDates.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let index = 1; index < completedDates.length; index += 1) {
    const previous = dateFromKey(completedDates[index - 1]);
    const expected = getLocalDateKey(addDays(previous, 1));
    current = completedDates[index] === expected ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function createWeekDots(habit) {
  const weekLabels = ["一", "二", "三", "四", "五", "六", "日"];
  const todayKey = getLocalDateKey();
  return getWeekDates()
    .map((date, index) => {
      const dateKey = getLocalDateKey(date);
      const value = getHabitValue(habit, dateKey);
      const classes = [
        isHabitComplete(habit, dateKey) ? "done" : "",
        dateKey === todayKey ? "today" : "",
        dateKey > todayKey ? "future" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const isToday = dateKey === todayKey;
      return `
        <button
          class="${classes}"
          type="button"
          ${isToday ? 'data-habit-action="checkin"' : "disabled"}
          title="${dateKey}：${value} ${getHabitUnit(habit)}"
          aria-label="${isToday ? `记录${escapeHtml(habit.name)}今日打卡` : dateKey}"
        >${weekLabels[index]}</button>
      `;
    })
    .join("");
}

function getHabitProgressLevel(habit, dateKey) {
  const value = getHabitValue(habit, dateKey);
  if (value <= 0) return 0;
  const ratio = value / habit.target;
  if (ratio >= 1) return 4;
  if (ratio >= 0.66) return 3;
  if (ratio >= 0.33) return 2;
  return 1;
}

function getHabitDateClasses(habit, dateKey) {
  const todayKey = getLocalDateKey();
  const createdKey = getLocalDateKey(new Date(habit.createdAt));
  return [
    `level-${getHabitProgressLevel(habit, dateKey)}`,
    dateKey === todayKey ? "today" : "",
    dateKey > todayKey ? "future" : "",
    dateKey < createdKey ? "inactive" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function createMonthCalendar(habit) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1);
  const leadingBlanks = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const dateKeys = Array.from(
    { length: daysInMonth },
    (_, index) => getLocalDateKey(new Date(year, month, index + 1)),
  );
  const completedDays = dateKeys.filter((dateKey) => isHabitComplete(habit, dateKey)).length;
  const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"]
    .map((label) => `<span>${label}</span>`)
    .join("");
  const blanks = Array.from({ length: leadingBlanks }, () => "<i></i>").join("");
  const days = dateKeys
    .map((dateKey, index) => {
      const value = getHabitValue(habit, dateKey);
      return `
        <button
          class="${getHabitDateClasses(habit, dateKey)}"
          type="button"
          ${dateKey === getLocalDateKey() ? 'data-habit-action="checkin"' : "disabled"}
          title="${dateKey}：${value} ${getHabitUnit(habit)}"
        >${index + 1}</button>
      `;
    })
    .join("");

  return `
    <div class="habit-chart month-chart">
      <div class="chart-caption">
        <strong>${year} 年 ${month + 1} 月</strong>
        <span>${completedDays} 天达标</span>
      </div>
      <div class="month-weekdays">${weekdayLabels}</div>
      <div class="month-calendar">${blanks}${days}</div>
    </div>
  `;
}

function createYearHeatmap(habit) {
  const year = new Date().getFullYear();
  const firstDay = new Date(year, 0, 1);
  const lastDay = new Date(year, 11, 31);
  const leadingBlanks = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const totalDays = Math.round((lastDay - firstDay) / 86400000) + 1;
  const blanks = Array.from({ length: leadingBlanks }, () => '<i class="heat-cell blank"></i>').join("");
  const cells = Array.from({ length: totalDays }, (_, index) => {
    const dateKey = getLocalDateKey(addDays(firstDay, index));
    const value = getHabitValue(habit, dateKey);
    return `
      <button
        class="heat-cell ${getHabitDateClasses(habit, dateKey)}"
        type="button"
        ${dateKey === getLocalDateKey() ? 'data-habit-action="checkin"' : "disabled"}
        title="${dateKey}：${value} ${getHabitUnit(habit)}"
      ></button>
    `;
  }).join("");
  const completedDays = getHabitCompletedDates(habit).filter((dateKey) =>
    dateKey.startsWith(`${year}-`),
  ).length;
  const monthLabels = Array.from(
    { length: 12 },
    (_, index) => `<span>${index + 1}月</span>`,
  ).join("");

  return `
    <div class="habit-chart year-chart">
      <div class="chart-caption">
        <strong>${year} 年</strong>
        <span>${completedDays} 天达标</span>
      </div>
      <div class="year-scroll">
        <div class="year-month-labels">${monthLabels}</div>
        <div class="year-heatmap">${blanks}${cells}</div>
      </div>
      <div class="heat-legend">
        <span>少</span>
        <i class="level-0"></i><i class="level-1"></i><i class="level-2"></i>
        <i class="level-3"></i><i class="level-4"></i>
        <span>达标</span>
      </div>
    </div>
  `;
}

function createHabitVisualization(habit) {
  if (activeHabitView === "month") return createMonthCalendar(habit);
  if (activeHabitView === "year") return createYearHeatmap(habit);
  return `
    <div class="week-dots" aria-label="${escapeHtml(habit.name)}本周打卡记录">
      ${createWeekDots(habit)}
    </div>
  `;
}

function createHabitCard(habit) {
  const todayValue = getHabitValue(habit);
  const completed = isHabitComplete(habit);
  const targetReached = todayValue >= habit.target;
  const progress = Math.min(100, Math.round((todayValue / habit.target) * 100));
  const step = getHabitStep(habit);
  const unit = getHabitUnit(habit);
  const currentStreak = getCurrentStreak(habit);
  const totalDays = getHabitCompletedDates(habit).length;
  const todayTime = getHabitTime(habit);
  const totalTime = getHabitTotalTime(habit);
  const icon = Array.from(habit.name.trim())[0] || "习";
  const syncedMinutes =
    habit.goalType === "duration" ? getSyncedMinutesForHabit(habit) : 0;

  return `
    <article class="habit-card habit-color-${habit.color} ${targetReached ? "achieved" : ""}" data-habit-id="${habit.id}">
      <div class="habit-card-top">
        <div class="habit-icon ${habit.color}" aria-hidden="true">${escapeHtml(icon)}</div>
        <div>
          <h3>${escapeHtml(habit.name)}</h3>
          <p>连续 ${currentStreak} 天 · 累计 ${totalDays} 天</p>
        </div>
        <button
          class="habit-check ${completed ? "checked" : ""}"
          data-habit-action="add"
          type="button"
          aria-label="为${escapeHtml(habit.name)}增加 ${step} ${unit}"
        >${habit.goalType === "duration" ? `＋${step}` : completed ? "✓" : `＋${step}`}</button>
      </div>
      <div class="habit-goal">
        <div>
          <span>今日目标</span>
          <strong>${todayValue} / ${habit.target} ${unit}</strong>
        </div>
        <div class="progress-track habit-progress ${habit.color}">
          <span style="width: ${progress}%"></span>
        </div>
        <div class="habit-progress-meta">
          <span>完成度 ${progress}%</span>
          <strong>${targetReached ? "今日已达成" : `今日已完成 ${todayValue} ${unit}`}</strong>
        </div>
      </div>
      ${createHabitVisualization(habit)}
      ${syncedMinutes > 0 ? `<p class="sync-note">今日有 ${syncedMinutes} 分钟来自关联计划</p>` : ""}
      <p class="habit-time-summary">今日投入 ${todayTime} 分钟 · 累计 ${totalTime} 分钟</p>
      <div class="habit-card-footer">
        <span>${
          targetReached
            ? "今日目标已达成"
            : completed
              ? `今日已打卡 · 还差 ${Math.max(0, habit.target - todayValue)} ${unit}`
              : `还差 ${Math.max(0, habit.target - todayValue)} ${unit}`
        }</span>
        <div class="habit-card-actions">
          <button data-habit-action="subtract" type="button" ${todayValue <= 0 ? "disabled" : ""}>撤销 ${step}</button>
          ${completed ? '<button class="edit-time-button" data-habit-action="checkin" type="button">修改今日时间</button>' : ""}
          <button data-habit-action="edit" type="button">编辑</button>
          <button class="delete-habit-button" data-habit-action="delete" type="button">删除</button>
        </div>
      </div>
    </article>
  `;
}

function updateHabitSummary() {
  const todayCompleted = habits.filter((habit) => isHabitComplete(habit)).length;
  const longestStreak = habits.reduce(
    (longest, habit) => Math.max(longest, getLongestStreak(habit)),
    0,
  );
  const todayKey = getLocalDateKey();
  const createdTodayOrEarlier = (habit, dateKey) =>
    getLocalDateKey(new Date(habit.createdAt)) <= dateKey;
  let completedOpportunities = 0;
  let totalOpportunities = 0;

  getWeekDates().forEach((date) => {
    const dateKey = getLocalDateKey(date);
    if (dateKey > todayKey) return;
    habits.forEach((habit) => {
      if (!createdTodayOrEarlier(habit, dateKey)) return;
      totalOpportunities += 1;
      if (isHabitComplete(habit, dateKey)) completedOpportunities += 1;
    });
  });

  const weekRate = totalOpportunities
    ? Math.round((completedOpportunities / totalOpportunities) * 100)
    : 0;
  document.querySelector("#habit-today-summary").textContent = `${todayCompleted} / ${habits.length}`;
  document.querySelector("#habit-longest-streak").textContent = longestStreak;
  document.querySelector("#habit-week-rate").textContent = `${weekRate}%`;
}

function renderHabits() {
  habitGrid.className = `habit-grid habit-view-${activeHabitView}`;
  habitGrid.innerHTML = habits.map(createHabitCard).join("");
  habitEmptyState.hidden = habits.length > 0;
  updateHabitSummary();
  renderStats();
}

function getTaskStoredSeconds(task) {
  return task.timerState === "running" ? getElapsedSeconds(task) : task.elapsedSeconds;
}

function getDateRangeKeys(startDate, endDate) {
  return {
    startKey: getLocalDateKey(startDate),
    endKey: getLocalDateKey(endDate),
  };
}

function isDateKeyInRange(dateKey, startKey, endKey) {
  return dateKey >= startKey && dateKey <= endKey;
}

function getFocusSecondsInRange(startDate, endDate) {
  const { startKey, endKey } = getDateRangeKeys(startDate, endDate);
  return tasks
    .filter((task) => isDateKeyInRange(task.date, startKey, endKey))
    .reduce((total, task) => total + getTaskStoredSeconds(task), 0);
}

function getCompletedTasksInRange(startDate, endDate) {
  const { startKey, endKey } = getDateRangeKeys(startDate, endDate);
  return tasks.filter(
    (task) => task.completed && isDateKeyInRange(task.date, startKey, endKey),
  );
}

function getHabitCompletionsInRange(habit, startDate, endDate) {
  const { startKey, endKey } = getDateRangeKeys(startDate, endDate);
  return getHabitCompletedDates(habit).filter((dateKey) =>
    isDateKeyInRange(dateKey, startKey, endKey),
  ).length;
}

function formatFocusSummary(totalSeconds) {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} 小时 ${minutes} 分钟`;
  if (hours > 0) return `${hours} 小时`;
  return `${minutes} 分钟`;
}

function getBestCurrentHabit() {
  return habits
    .map((habit) => ({ habit, streak: getCurrentStreak(habit) }))
    .sort((a, b) => b.streak - a.streak || a.habit.createdAt.localeCompare(b.habit.createdAt))[0] || null;
}

function renderStats() {
  const today = new Date();
  const todayKey = getLocalDateKey(today);
  const weekDates = getWeekDates(today);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const todayTasks = tasks.filter((task) => task.date === todayKey);
  const todayFocusSeconds = todayTasks.reduce(
    (total, task) => total + getTaskStoredSeconds(task),
    0,
  );
  const bestHabit = getBestCurrentHabit();

  document.querySelector("#stats-today-tasks").textContent = todayTasks.filter(
    (task) => task.completed,
  ).length;
  document.querySelector("#stats-today-focus").textContent = Math.floor(todayFocusSeconds / 60);
  document.querySelector("#stats-today-habits").textContent = habits.filter((habit) =>
    isHabitComplete(habit, todayKey),
  ).length;
  document.querySelector("#stats-week-focus").textContent = Math.floor(
    getFocusSecondsInRange(weekStart, weekEnd) / 60,
  );
  document.querySelector("#stats-month-focus").textContent = Math.floor(
    getFocusSecondsInRange(monthStart, monthEnd) / 60,
  );
  document.querySelector("#stats-best-habit").textContent =
    bestHabit && bestHabit.streak > 0 ? bestHabit.habit.name : "暂无";
  document.querySelector("#stats-best-streak").textContent =
    bestHabit && bestHabit.streak > 0
      ? `已连续 ${bestHabit.streak} 天`
      : "开始第一个习惯吧";

  const completedToday = todayTasks.filter((task) => task.completed).length;
  const growthNote =
    completedToday > 0
      ? `今天已完成 ${completedToday} 项计划，清楚地走过今天就很好。`
      : "今天的每一点投入，都会成为之后看得见的成长。";
  document.querySelector("#stats-growth-note").textContent = growthNote;
}

function generateWeeklyReport() {
  const today = new Date();
  const weekDates = getWeekDates(today);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const completedTasks = getCompletedTasksInRange(weekStart, weekEnd).length;
  const focusSeconds = getFocusSecondsInRange(weekStart, weekEnd);
  const habitResults = habits
    .map((habit) => ({
      habit,
      completions: getHabitCompletionsInRange(habit, weekStart, weekEnd),
      streak: getCurrentStreak(habit),
    }))
    .sort((a, b) => b.completions - a.completions || b.streak - a.streak);
  const habitCheckins = habitResults.reduce((total, item) => total + item.completions, 0);
  const bestHabit = habitResults.find((item) => item.completions > 0)?.habit.name || "还在起步";

  return [
    "本周总结：",
    `本周共完成 ${completedTasks} 个任务，`,
    `累计专注 ${formatFocusSummary(focusSeconds)}，`,
    `完成习惯打卡 ${habitCheckins} 次，`,
    `坚持最好的习惯是：${bestHabit}。`,
    "继续保持，把每天过得更清楚一点。",
  ].join("\n");
}

function openWeeklyReport() {
  weeklyReportText.textContent = generateWeeklyReport();
  reportDialog.showModal();
}

async function copyWeeklyReport() {
  const text = weeklyReportText.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
  }
  showToast("本周总结已复制");
}

function openCheckinDialog(habitId) {
  const habit = habits.find((item) => item.id === habitId);
  if (!habit) return;

  editingCheckinHabitId = habitId;
  const dateKey = getLocalDateKey();
  const wasComplete = isHabitComplete(habit, dateKey);

  if (!habit.checkIns[dateKey]) {
    habit.checkIns[dateKey] = true;
    saveHabits();
    renderHabits();
  }

  checkinTitle.textContent = wasComplete ? "修改今日时间" : "今日已完成";
  checkinHabitName.textContent = habit.name;
  checkinMinutesInput.value = String(getHabitTime(habit, dateKey));
  checkinDialog.classList.remove("celebrate");
  checkinDialog.showModal();
  window.requestAnimationFrame(() => {
    checkinDialog.classList.add("celebrate");
    checkinMinutesInput.focus();
    checkinMinutesInput.select();
  });
}

function saveHabitCheckin(formData) {
  const habit = habits.find((item) => item.id === editingCheckinHabitId);
  if (!habit) return;

  const minutes = Number(formData.get("minutes"));
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
    checkinMinutesInput.focus();
    showToast("请输入 0 到 1440 分钟");
    return;
  }

  const dateKey = getLocalDateKey();
  habit.checkIns[dateKey] = true;
  habit.timeRecords[dateKey] = Math.round(minutes);
  if (habit.goalType === "duration") {
    if (minutes === 0) {
      delete habit.records[dateKey];
    } else {
      habit.records[dateKey] = Math.round(minutes);
    }
  }

  saveHabits();
  renderHabits();
  checkinDialog.close();
  editingCheckinHabitId = null;
  showToast("今日打卡时间已保存");
}

function updateHabitLinkOptions() {
  const durationHabits = habits.filter((habit) => habit.goalType === "duration");
  taskHabitLink.innerHTML = [
    '<option value="">不关联习惯</option>',
    ...durationHabits.map(
      (habit) => `<option value="${habit.id}">${escapeHtml(habit.name)} · ${habit.target} 分钟</option>`,
    ),
  ].join("");

  habitLinkHint.textContent = durationHabits.length
    ? "任务完成后，实际专注时间会一次性同步到所选习惯。"
    : "暂无时长目标习惯，可先到“习惯养成”中添加。";
}

function updateHabitLinkSuggestion() {
  if (taskForm.elements.mode.value === "no-timer") {
    habitLinkHint.textContent = "不计时任务完成后，会提醒你手动填写习惯时间。";
    return;
  }

  const title = taskTitleInput.value.trim().toLocaleLowerCase("zh-CN");
  if (!title || taskHabitLink.value) return;

  const matchedHabit = habits.find(
    (habit) =>
      habit.goalType === "duration" &&
      (title.includes(habit.name.toLocaleLowerCase("zh-CN")) ||
        habit.name.toLocaleLowerCase("zh-CN").includes(title)),
  );

  habitLinkHint.textContent = matchedHabit
    ? `检测到相关习惯“${matchedHabit.name}”，可在上方选择关联。`
    : habits.some((habit) => habit.goalType === "duration")
      ? "任务完成后，实际专注时间会一次性同步到所选习惯。"
      : "暂无时长目标习惯，可先到“习惯养成”中添加。";
}

function setRadioValue(form, name, value) {
  const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function openHabitDialog(habitId = null) {
  editingHabitId = habitId;
  habitForm.reset();
  const habit = habits.find((item) => item.id === habitId);
  const goalTypeInputs = habitForm.querySelectorAll('input[name="goalType"]');

  if (habit) {
    habitDialogTitle.textContent = "编辑习惯";
    habitSubmitButton.textContent = "保存修改";
    habitNameInput.value = habit.name;
    setRadioValue(habitForm, "goalType", habit.goalType);
    setRadioValue(habitForm, "color", habit.color);
    habitTargetInput.value = habit.target;
    habitTargetLabel.textContent = habit.goalType === "duration" ? "每日目标时间" : "每日目标次数";
    habitTargetUnit.textContent = getHabitUnit(habit);
    goalTypeInputs.forEach((input) => {
      input.disabled = true;
    });
  } else {
    habitDialogTitle.textContent = "添加习惯";
    habitSubmitButton.textContent = "添加习惯";
    setRadioValue(habitForm, "goalType", "duration");
    habitTargetLabel.textContent = "每日目标时间";
    habitTargetUnit.textContent = "分钟";
    habitTargetInput.value = "30";
    goalTypeInputs.forEach((input) => {
      input.disabled = false;
    });
  }

  habitDialog.showModal();
  window.setTimeout(() => habitNameInput.focus(), 0);
}

function addHabit(formData) {
  const name = String(formData.get("name")).trim();
  const existingHabit = habits.find((habit) => habit.id === editingHabitId);
  const submittedGoalType = formData.get("goalType") === "duration" ? "duration" : "count";
  const goalType = existingHabit?.goalType || submittedGoalType;
  const rawTarget = String(formData.get("target") || "").trim();
  const target = rawTarget ? Number(rawTarget) : goalType === "duration" ? 30 : 1;

  if (!name) {
    habitNameInput.focus();
    return;
  }
  if (!Number.isFinite(target) || target < 1 || target > 999) {
    habitTargetInput.focus();
    showToast("请输入 1 到 999 的每日目标");
    return;
  }

  if (existingHabit) {
    existingHabit.name = name;
    existingHabit.target = target;
    existingHabit.color = String(formData.get("color") || existingHabit.color);
  } else {
    habits.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      name,
      goalType,
      target,
      color: String(formData.get("color") || "blue"),
      records: {},
      checkIns: {},
      timeRecords: {},
      createdAt: new Date().toISOString(),
    });
  }
  saveHabits();
  renderHabits();
  updateHabitLinkOptions();
  habitDialog.close();
  showToast(existingHabit ? "习惯已更新" : "习惯已添加");
  editingHabitId = null;
}

function changeHabitValue(habitId, direction) {
  const habit = habits.find((item) => item.id === habitId);
  if (!habit) return;
  const dateKey = getLocalDateKey();
  const previousValue = getHabitValue(habit, dateKey);
  const wasComplete = isHabitComplete(habit, dateKey);
  const step = getHabitStep(habit);
  const nextValue = Math.max(0, previousValue + step * direction);

  if (nextValue === 0) {
    delete habit.records[dateKey];
  } else {
    habit.records[dateKey] = nextValue;
  }
  if (habit.goalType === "duration") {
    if (nextValue === 0) {
      delete habit.timeRecords[dateKey];
    } else {
      habit.timeRecords[dateKey] = nextValue;
    }
  }

  const isComplete = isHabitComplete(habit, dateKey);
  saveHabits();
  renderHabits();

  if (!wasComplete && isComplete) {
    showToast(`“${habit.name}”今日打卡完成`);
  } else if (direction > 0) {
    showToast(`已记录 ${step} ${getHabitUnit(habit)}`);
  } else {
    showToast("已撤销一条记录");
  }
}

function deleteHabit(habitId) {
  const habit = habits.find((item) => item.id === habitId);
  if (!habit) return;
  habits = habits.filter((item) => item.id !== habitId);
  tasks.forEach((task) => {
    if (task.linkedHabitId === habitId) task.linkedHabitId = null;
  });
  saveHabits();
  saveTasks();
  renderHabits();
  renderTasks();
  showToast(`已删除习惯“${habit.name}”`);
}

function updateVisibleTimers() {
  const now = Date.now();
  let shouldRender = false;

  tasks.forEach((task) => {
    if (task.timerState !== "running") return;
    if (task.mode === "countdown" && getRemainingSeconds(task, now) <= 0) {
      finishCountdown(task);
      shouldRender = true;
    }
  });

  if (shouldRender) {
    renderTasks();
    renderHabits();
    return;
  }

  document.querySelectorAll("[data-task-id]").forEach((card) => {
    const task = tasks.find((item) => item.id === card.dataset.taskId);
    const display = card.querySelector("[data-timer-display]");
    if (!task || !display || task.timerState !== "running") return;

    const seconds =
      task.mode === "countdown" ? getRemainingSeconds(task, now) : getElapsedSeconds(task, now);
    display.textContent = formatDuration(seconds);
  });

  updateOverview();
  renderStats();
}

function getTaskFocusMinutes(task) {
  if (task.mode === "no-timer") return 0;
  const elapsedSeconds = getElapsedSeconds(task);
  return elapsedSeconds > 0 ? Math.max(1, Math.round(elapsedSeconds / 60)) : 0;
}

function syncCompletedTaskToHabit(task) {
  if (task.habitSyncCompleted) {
    return { status: "already-synced", minutes: task.syncedMinutes, habit: getLinkedHabit(task) };
  }

  const habit = getLinkedHabit(task);
  if (!habit || habit.goalType !== "duration") {
    return { status: "no-habit", minutes: 0, habit: null };
  }
  if (task.mode === "no-timer") {
    return { status: "manual-required", minutes: 0, habit };
  }

  const minutes = getTaskFocusMinutes(task);
  if (minutes <= 0) {
    return { status: "no-time", minutes: 0, habit };
  }

  habit.records[task.date] = getHabitValue(habit, task.date) + minutes;
  habit.timeRecords[task.date] = getHabitTime(habit, task.date) + minutes;
  task.syncedMinutes = minutes;
  task.habitSyncCompleted = true;
  task.syncedAt = new Date().toISOString();
  return { status: "synced", minutes, habit };
}

function settleRunningTask(task) {
  if (task.timerState !== "running") return;
  const delta = getRunningDelta(task);
  const appliedDelta =
    task.mode === "countdown" ? Math.min(delta, task.remainingSeconds) : delta;
  task.elapsedSeconds += appliedDelta;
  if (task.mode === "countdown") {
    task.remainingSeconds = Math.max(0, task.remainingSeconds - appliedDelta);
  }
  task.timerStartedAt = null;
}

function pauseOtherTimers(exceptTaskId) {
  tasks.forEach((task) => {
    if (task.id !== exceptTaskId && task.timerState === "running") {
      settleRunningTask(task);
      task.timerState = "paused";
    }
  });
}

async function startTimer(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task || task.completed || task.mode === "no-timer") return;

  if (task.mode === "countdown" && task.remainingSeconds <= 0) {
    task.remainingSeconds = task.minutes * 60;
  }

  pauseOtherTimers(taskId);
  task.timerState = "running";
  task.timerStartedAt = new Date().toISOString();
  saveTasks();
  renderTasks();

  // Starting from a user click unlocks both the ticking sound and the later completion chime.
  await ensureAudioContext();
  syncTickSound();

  showToast("计时已开始");
}

function pauseTimer(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task || task.timerState !== "running") return;

  settleRunningTask(task);
  task.timerState = "paused";
  saveTasks();
  renderTasks();
  showToast("计时已暂停");
}

function finishCountdown(task) {
  settleRunningTask(task);
  task.remainingSeconds = 0;
  task.timerState = "finished";
  task.completed = true;
  task.completedAt = new Date().toISOString();
  const syncResult = syncCompletedTaskToHabit(task);
  saveTasks();
  if (syncResult.status === "synced") {
    saveHabits();
    renderHabits();
  }
  stopTickSound();
  playCompletionChime();
  showToast(
    syncResult.status === "synced"
      ? `已同步 ${syncResult.minutes} 分钟到${syncResult.habit.name}习惯`
      : `“${task.title}”倒计时完成`,
  );
}

function renderHistory() {
  const groupedTasks = tasks.reduce((groups, task) => {
    groups[task.date] ??= [];
    groups[task.date].push(task);
    return groups;
  }, {});
  const dates = Object.keys(groupedTasks).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    historyList.innerHTML = '<div class="history-empty"><p>还没有计划记录。</p></div>';
    return;
  }

  historyList.innerHTML = dates
    .map((date) => {
      const dateTasks = groupedTasks[date];
      const completed = dateTasks.filter((task) => task.completed).length;
      return `
        <section class="history-group">
          <div class="history-date">
            <strong>${formatHistoryDate(date)}</strong>
            <div class="history-date-actions">
              <span>${completed} / ${dateTasks.length} 完成</span>
              <button type="button" data-history-date="${date}">查看当天</button>
            </div>
          </div>
          <div class="history-items">
            ${dateTasks
              .map((task) => {
                const elapsed = getElapsedSeconds(task);
                const duration = elapsed ? ` · ${formatDuration(elapsed)}` : "";
                return `
                  <div class="history-item ${task.completed ? "completed" : ""}">
                    <span class="history-status">${task.completed ? "✓" : "·"}</span>
                    <span>${escapeHtml(task.title)}</span>
                    <small>${modeDetails[task.mode]?.label || "不计时"}${duration}</small>
                  </div>
                `;
              })
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function openTaskDialog(taskId = null) {
  editingTaskId = taskId;
  taskForm.reset();
  updateHabitLinkOptions();
  const task = tasks.find((item) => item.id === taskId);
  const modeInputs = taskForm.querySelectorAll('input[name="mode"]');

  if (task) {
    if (task.timerState === "running") {
      settleRunningTask(task);
      task.timerState = "paused";
      saveTasks();
      renderTasks();
    }

    const timerHasData =
      task.elapsedSeconds > 0 || task.syncedMinutes > 0 || task.timerState !== "idle";
    taskDialogTitle.textContent = "编辑日计划";
    taskSubmitButton.textContent = "确认";
    taskTitleInput.value = task.title;
    setRadioValue(taskForm, "mode", task.mode);
    countdownField.hidden = task.mode !== "countdown";
    countdownMinutes.value = task.minutes || 25;
    taskHabitLink.value = task.linkedHabitId || "";
    taskHabitLink.disabled = task.habitSyncCompleted;
    taskForm.elements.tickSound.checked = task.tickSound;
    modeInputs.forEach((input) => {
      input.disabled = timerHasData;
    });
    habitLinkHint.textContent =
      task.habitSyncCompleted
        ? "该任务已同步过时间，为保护记录不能再更换关联习惯。"
        : task.mode === "no-timer"
          ? "不计时任务完成后会提醒你手动填写习惯时间。"
          : "可修改关联的时长目标习惯。";
  } else {
    taskDialogTitle.textContent = "添加日计划";
    taskSubmitButton.textContent = "确认";
    countdownField.hidden = true;
    taskHabitLink.disabled = false;
    modeInputs.forEach((input) => {
      input.disabled = false;
    });
  }

  taskDialog.showModal();
  window.setTimeout(() => taskTitleInput.focus(), 0);
}

function addTask(formData) {
  const title = String(formData.get("title")).trim();
  const existingTask = tasks.find((task) => task.id === editingTaskId);
  const timerIsLocked =
    existingTask &&
    (existingTask.timerState !== "idle" ||
      existingTask.elapsedSeconds > 0 ||
      existingTask.syncedMinutes > 0);
  const mode = timerIsLocked
    ? existingTask.mode
    : String(formData.get("mode"));
  const minutes = Number(formData.get("minutes"));
  const linkedHabitId = String(formData.get("linkedHabitId") || "");
  const linkedHabit = habits.find(
    (habit) => habit.id === linkedHabitId && habit.goalType === "duration",
  );

  if (!title) {
    taskTitleInput.focus();
    return;
  }

  if (mode === "countdown" && (!Number.isFinite(minutes) || minutes < 1 || minutes > 720)) {
    countdownMinutes.focus();
    showToast("请输入 1 到 720 分钟");
    return;
  }

  if (existingTask) {
    const canChangeTimer = existingTask.timerState === "idle" && existingTask.elapsedSeconds === 0;
    existingTask.title = title;
    existingTask.tickSound = formData.get("tickSound") === "on";
    if (existingTask.syncedMinutes === 0) {
      existingTask.linkedHabitId = linkedHabit?.id || null;
    }
    if (canChangeTimer) {
      existingTask.mode = mode;
      existingTask.minutes = mode === "countdown" ? minutes : null;
      existingTask.remainingSeconds = mode === "countdown" ? minutes * 60 : null;
    }
  } else {
    tasks.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      title,
      mode,
      minutes: mode === "countdown" ? minutes : null,
      date: getLocalDateKey(),
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      elapsedSeconds: 0,
      remainingSeconds: mode === "countdown" ? minutes * 60 : null,
      timerState: "idle",
      timerStartedAt: null,
      tickSound: formData.get("tickSound") === "on",
      linkedHabitId: linkedHabit?.id || null,
      syncedMinutes: 0,
      habitSyncCompleted: false,
      syncedAt: null,
    });
  }

  saveTasks();
  renderTasks();
  taskDialog.close();
  showToast(existingTask ? "计划已更新" : "计划已添加");
  editingTaskId = null;
}

function toggleTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  const isCompleting = !task.completed;
  if (isCompleting && task.timerState === "running") settleRunningTask(task);
  task.completed = isCompleting;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  task.timerState = task.completed ? "paused" : task.timerState === "finished" ? "paused" : task.timerState;
  const syncResult = isCompleting
    ? syncCompletedTaskToHabit(task)
    : { status: "not-applicable", minutes: 0, habit: null };
  saveTasks();
  if (syncResult.status === "synced") {
    saveHabits();
    renderHabits();
  }
  renderTasks();

  if (!task.completed) {
    showToast("已恢复为待完成");
  } else if (syncResult.status === "synced") {
    showToast(`已同步 ${syncResult.minutes} 分钟到${syncResult.habit.name}习惯`);
  } else if (syncResult.status === "manual-required") {
    showToast(`任务已完成，请手动填写${syncResult.habit.name}习惯时间`);
  } else if (syncResult.status === "already-synced") {
    showToast("任务已完成，关联时间此前已同步");
  } else {
    showToast("完成了一项计划");
  }
}

function deleteTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  if (task.timerState === "running") settleRunningTask(task);
  tasks = tasks.filter((item) => item.id !== taskId);
  saveTasks();
  renderTasks();
  showToast(`已删除“${task.title}”`);
}

function createBackupData() {
  const backupHabits = habits.map((habit) => ({
    ...habit,
    records: { ...habit.records },
    checkIns: { ...habit.checkIns },
    timeRecords: { ...habit.timeRecords },
  }));
  const backupTasks = tasks.map((task) => {
    const elapsedSeconds = getElapsedSeconds(task);
    const remainingSeconds =
      task.mode === "countdown" ? getRemainingSeconds(task) : null;
    return {
      ...task,
      elapsedSeconds,
      remainingSeconds,
      timerState: task.timerState === "running" ? "paused" : task.timerState,
      timerStartedAt: null,
    };
  });

  return {
    format: "morandi-todo-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: backupTasks,
    habits: backupHabits,
  };
}

function exportData() {
  const json = JSON.stringify(createBackupData(), null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `morandi-todo-backup-${getLocalDateKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("备份已导出");
}

function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function sanitizeImportedHabit(habit) {
  if (!habit || typeof habit !== "object") throw new Error("习惯数据格式错误");
  if (typeof habit.id !== "string" || !habit.id) throw new Error("习惯缺少有效 ID");
  if (typeof habit.name !== "string" || !habit.name.trim()) throw new Error("习惯名称无效");

  const records = {};
  Object.entries(habit.records || {}).forEach(([dateKey, value]) => {
    const numericValue = Number(value);
    if (isDateKey(dateKey) && Number.isFinite(numericValue) && numericValue >= 0) {
      records[dateKey] = numericValue;
    }
  });
  const checkIns = {};
  Object.entries(habit.checkIns || {}).forEach(([dateKey, value]) => {
    if (isDateKey(dateKey) && value) checkIns[dateKey] = true;
  });
  const timeRecords = {};
  Object.entries(habit.timeRecords || {}).forEach(([dateKey, value]) => {
    const numericValue = Number(value);
    if (
      isDateKey(dateKey) &&
      Number.isFinite(numericValue) &&
      numericValue >= 0 &&
      numericValue <= 1440
    ) {
      timeRecords[dateKey] = Math.round(numericValue);
    }
  });

  return normalizeHabit({
    id: habit.id,
    name: habit.name.trim().slice(0, 30),
    goalType: habit.goalType,
    target: Math.min(999, Math.max(1, Number(habit.target) || 1)),
    color: habit.color,
    records,
    checkIns,
    timeRecords,
    createdAt: Number.isNaN(Date.parse(habit.createdAt))
      ? new Date().toISOString()
      : habit.createdAt,
  });
}

function sanitizeImportedTask(task) {
  if (!task || typeof task !== "object") throw new Error("计划数据格式错误");
  if (typeof task.id !== "string" || !task.id) throw new Error("计划缺少有效 ID");
  if (typeof task.title !== "string" || !task.title.trim()) throw new Error("计划名称无效");
  if (!Object.prototype.hasOwnProperty.call(modeDetails, task.mode)) {
    throw new Error("计划计时模式无效");
  }
  if (!isDateKey(task.date)) throw new Error("计划日期无效");

  const normalized = normalizeTask({
    id: task.id,
    title: task.title.trim().slice(0, 50),
    mode: task.mode,
    minutes:
      task.mode === "countdown"
        ? Math.min(720, Math.max(1, Number(task.minutes) || 1))
        : null,
    date: task.date,
    completed: Boolean(task.completed),
    completedAt:
      task.completed && !Number.isNaN(Date.parse(task.completedAt))
        ? task.completedAt
        : task.completed
          ? new Date().toISOString()
          : null,
    createdAt: Number.isNaN(Date.parse(task.createdAt))
      ? new Date().toISOString()
      : task.createdAt,
    elapsedSeconds: Math.max(0, Number(task.elapsedSeconds) || 0),
    remainingSeconds:
      task.mode === "countdown"
        ? Math.max(0, Number(task.remainingSeconds) || 0)
        : null,
    timerState: ["idle", "paused", "finished"].includes(task.timerState)
      ? task.timerState
      : "paused",
    timerStartedAt: null,
    tickSound: task.tickSound !== false,
    linkedHabitId: typeof task.linkedHabitId === "string" ? task.linkedHabitId : null,
    syncedMinutes: Math.max(0, Number(task.syncedMinutes) || 0),
    habitSyncCompleted: Boolean(task.habitSyncCompleted || Number(task.syncedMinutes) > 0),
    syncedAt:
      typeof task.syncedAt === "string" && !Number.isNaN(Date.parse(task.syncedAt))
        ? task.syncedAt
        : null,
  });
  return normalized;
}

async function importData(file) {
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    if (
      data?.format !== "morandi-todo-backup" ||
      data?.version !== 1 ||
      !Array.isArray(data.tasks) ||
      !Array.isArray(data.habits)
    ) {
      throw new Error("这不是有效的 Morandi Todo 备份文件");
    }
    if (data.tasks.length > 10000 || data.habits.length > 1000) {
      throw new Error("备份数据量异常");
    }

    const importedHabits = data.habits.map(sanitizeImportedHabit);
    const importedTasks = data.tasks.map(sanitizeImportedTask);
    const habitIds = new Set(importedHabits.map((habit) => habit.id));
    if (habitIds.size !== importedHabits.length) throw new Error("备份中存在重复习惯 ID");
    const taskIds = new Set(importedTasks.map((task) => task.id));
    if (taskIds.size !== importedTasks.length) throw new Error("备份中存在重复计划 ID");

    importedTasks.forEach((task) => {
      const linkedHabit = importedHabits.find((habit) => habit.id === task.linkedHabitId);
      if (!linkedHabit || linkedHabit.goalType !== "duration") task.linkedHabitId = null;
    });

    const shouldReplace = window.confirm(
      `将导入 ${importedTasks.length} 条计划和 ${importedHabits.length} 个习惯，并替换当前数据。是否继续？`,
    );
    if (!shouldReplace) return;

    stopTickSound();
    tasks = importedTasks;
    habits = importedHabits;
    saveTasks();
    saveHabits();
    renderTasks();
    renderHabits();
    updateHabitLinkOptions();
    settingsDialog.close();
    showToast("备份导入成功");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "备份导入失败");
  } finally {
    importFileInput.value = "";
  }
}

async function ensureAudioContext() {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return audioContext;
}

function createTick() {
  if (!audioContext || audioContext.state !== "running") return;
  const now = audioContext.currentTime;
  const length = Math.floor(audioContext.sampleRate * 0.035);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const fade = 1 - index / length;
    data[index] = (Math.random() * 2 - 1) * fade;
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  filter.Q.value = 1.2;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start(now);
  source.stop(now + 0.04);
}

function startTickSound(taskId) {
  if (activeSoundTaskId === taskId && tickInterval) return;
  stopTickSound();
  activeSoundTaskId = taskId;
  createTick();
  tickInterval = window.setInterval(createTick, 1000);
}

function stopTickSound() {
  if (tickInterval) window.clearInterval(tickInterval);
  tickInterval = null;
  activeSoundTaskId = null;
}

function syncTickSound() {
  const activeTask = tasks.find(
    (task) => task.timerState === "running" && task.tickSound && !task.completed,
  );
  if (activeTask && audioContext?.state === "running") {
    startTickSound(activeTask.id);
  } else {
    stopTickSound();
  }
}

async function toggleTickSound(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  task.tickSound = !task.tickSound;
  saveTasks();

  if (task.tickSound && task.timerState === "running") {
    await ensureAudioContext();
  }

  renderTasks();
  showToast(task.tickSound ? "滴答声已开启" : "滴答声已关闭");
}

async function playCompletionChime() {
  const context = await ensureAudioContext();
  if (!context) return;
  const now = context.currentTime;

  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * 0.16;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.4);
  });
}

function restoreRunningTimers() {
  const runningTasks = tasks.filter((task) => task.timerState === "running");
  if (runningTasks.length > 1) {
    runningTasks.slice(0, -1).forEach((task) => {
      settleRunningTask(task);
      task.timerState = "paused";
    });
  }

  tasks.forEach((task) => {
    if (task.mode === "countdown" && task.timerState === "running" && getRemainingSeconds(task) <= 0) {
      finishCountdown(task);
    }
  });
  saveTasks();
}

restoreRunningTimers();

function updateDateTimeLabel() {
  const now = new Date();
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  todayLabel.textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ` +
    `${weekdays[now.getDay()]} ${hours}:${minutes}`;
}

function startDateTimeClock() {
  updateDateTimeLabel();
  const now = new Date();
  const delayToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  window.setTimeout(() => {
    updateDateTimeLabel();
    window.setInterval(updateDateTimeLabel, 60000);
  }, delayToNextMinute);
}

startDateTimeClock();
renderTasks();
renderHabits();
window.setInterval(updateVisibleTimers, 500);

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    switchPage(button.dataset.page);
    showToast(`已切换到${button.textContent.trim()}`);
  });
});

document.querySelector("#open-task-form").addEventListener("click", openNewTaskDialog);
emptyAddTaskButton.addEventListener("click", openNewTaskDialog);
emptyAddTaskIcon.addEventListener("click", openNewTaskDialog);
previousTaskDateButton.addEventListener("click", () => changeTaskDate(-1));
nextTaskDateButton.addEventListener("click", () => changeTaskDate(1));
returnTodayButton.addEventListener("click", returnToToday);
document.querySelectorAll(".close-dialog").forEach((button) => {
  button.addEventListener("click", () => taskDialog.close());
});

document.querySelectorAll('input[name="mode"]').forEach((input) => {
  input.addEventListener("change", () => {
    const selectedMode = taskForm.elements.mode.value;
    countdownField.hidden = selectedMode !== "countdown";
    taskHabitLink.disabled = false;
    if (selectedMode === "no-timer") {
      habitLinkHint.textContent = "不计时任务完成后，会提醒你手动填写习惯时间。";
    } else {
      updateHabitLinkSuggestion();
    }
  });
});

taskTitleInput.addEventListener("input", updateHabitLinkSuggestion);

taskHabitLink.addEventListener("change", () => {
  const habit = habits.find((item) => item.id === taskHabitLink.value);
  habitLinkHint.textContent = habit
    ? taskForm.elements.mode.value === "no-timer"
      ? `任务完成后会提醒你手动填写“${habit.name}”的投入时间。`
      : `任务完成后，实际专注时间将同步到“${habit.name}”，且只同步一次。`
    : "请选择一个时长目标习惯，或保持不关联。";
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask(new FormData(taskForm));
});

taskList.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const taskId = actionButton.closest("[data-task-id]")?.dataset.taskId;
  if (!taskId) return;

  const actions = {
    toggle: () => toggleTask(taskId),
    delete: () => deleteTask(taskId),
    start: () => startTimer(taskId),
    pause: () => pauseTimer(taskId),
    sound: () => toggleTickSound(taskId),
    edit: () => openTaskDialog(taskId),
  };
  actions[actionButton.dataset.action]?.();
});

document.querySelector("#open-history").addEventListener("click", () => {
  renderHistory();
  historyDialog.showModal();
});

historyList.addEventListener("click", (event) => {
  const dateButton = event.target.closest("[data-history-date]");
  if (!dateButton) return;
  activeTaskDate = dateButton.dataset.historyDate;
  historyDialog.close();
  renderTasks();
});

document.querySelector(".close-history").addEventListener("click", () => historyDialog.close());

document.querySelector("#open-habit-form").addEventListener("click", () => openHabitDialog());
document.querySelector("#empty-add-habit").addEventListener("click", () => openHabitDialog());
document.querySelector("#empty-icon-add-habit").addEventListener("click", () => openHabitDialog());
document.querySelectorAll(".close-habit-dialog").forEach((button) => {
  button.addEventListener("click", () => habitDialog.close());
});

document.querySelectorAll('input[name="goalType"]').forEach((input) => {
  input.addEventListener("change", () => {
    const isDuration = habitForm.elements.goalType.value === "duration";
    habitTargetLabel.textContent = isDuration ? "每日目标时间" : "每日目标次数";
    habitTargetUnit.textContent = isDuration ? "分钟" : "次";
    habitTargetInput.value = isDuration ? "30" : "1";
  });
});

habitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addHabit(new FormData(habitForm));
});

habitGrid.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-habit-action]");
  if (!actionButton) return;
  const habitId = actionButton.closest("[data-habit-id]")?.dataset.habitId;
  if (!habitId) return;

  const actions = {
    add: () => changeHabitValue(habitId, 1),
    subtract: () => changeHabitValue(habitId, -1),
    checkin: () => openCheckinDialog(habitId),
    edit: () => openHabitDialog(habitId),
    delete: () => deleteHabit(habitId),
  };
  actions[actionButton.dataset.habitAction]?.();
});

document.querySelectorAll("[data-habit-view]").forEach((button) => {
  button.addEventListener("click", () => {
    activeHabitView = button.dataset.habitView;
    document.querySelectorAll("[data-habit-view]").forEach((viewButton) => {
      viewButton.classList.toggle("active", viewButton === button);
    });
    renderHabits();
  });
});

document.querySelector("#generate-weekly-report").addEventListener("click", openWeeklyReport);
document.querySelector("#copy-weekly-report").addEventListener("click", copyWeeklyReport);
document.querySelectorAll(".close-report").forEach((button) => {
  button.addEventListener("click", () => reportDialog.close());
});

checkinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveHabitCheckin(new FormData(checkinForm));
});
document.querySelectorAll(".close-checkin-dialog").forEach((button) => {
  button.addEventListener("click", () => {
    checkinDialog.close();
    editingCheckinHabitId = null;
  });
});

document.querySelector("#open-settings").addEventListener("click", () => {
  settingsDialog.showModal();
});
document.querySelector(".close-settings").addEventListener("click", () => settingsDialog.close());
document.querySelector("#export-data").addEventListener("click", exportData);
document.querySelector("#import-data").addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", () => importData(importFileInput.files?.[0]));

[taskDialog, historyDialog, habitDialog, checkinDialog, settingsDialog, reportDialog].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

checkinDialog.addEventListener("close", () => {
  editingCheckinHabitId = null;
  checkinDialog.classList.remove("celebrate");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    updateDateTimeLabel();
    updateVisibleTimers();
    syncTickSound();
  }
});
