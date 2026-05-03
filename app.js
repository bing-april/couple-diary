const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  mode: "login",
  session: null,
  profile: null,
  book: null,
  bookId: null,
  entries: [],
  members: [],
  calendarDate: new Date(),
  selectedCalendarKey: formatDateKey(new Date()),
  diaryFilter: "all",
  darkMode: localStorage.getItem("coupleDiaryDarkMode") === "true",
  editingEntryId: null,
  collapsedGroups: new Set(),
  expandedEntries: new Set(),
  viewerPhotos: [],
  viewerIndex: 0,
};

const themes = {
  rose: { primary: "#1683f7" },
  pink: { primary: "#ff2d55" },
  sakura: { primary: "#f75d9a" },
  ink: { primary: "#1c1c1e" },
  sea: { primary: "#39c9c1" },
};
const weekNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const cnWeekNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const authScreen = $("#auth-screen");
const appScreen = $("#app-screen");
const authMessage = $("#auth-message");

function formatDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(date) {
  const today = new Date();
  const then = new Date(date);
  today.setHours(0, 0, 0, 0);
  then.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - then) / 86400000));
}

function toDateInputValue(date) {
  return formatDateKey(date);
}

function toDateTimeLocalValue(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function defaultAnniversaryDate() {
  const oldestEntry = [...state.entries].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date))[0];
  return state.book?.anniversary_date || (oldestEntry ? formatDateKey(oldestEntry.entry_date) : formatDateKey(new Date()));
}

function specialDayLabel(entryDate, startDate) {
  if (!startDate) return "";
  const start = new Date(`${startDate}T00:00:00`);
  const current = new Date(entryDate);
  start.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  if (current < start) return "";

  const daysTogether = Math.floor((current - start) / 86400000) + 1;
  const labels = [];
  if (daysTogether > 0 && daysTogether % 100 === 0) {
    labels.push(`第 ${daysTogether} 天纪念`);
  }

  const yearDiff = current.getFullYear() - start.getFullYear();
  if (yearDiff >= 1 && current.getMonth() === start.getMonth() && current.getDate() === start.getDate()) {
    labels.push(`${yearDiff} 年纪念日`);
  }

  return labels.join(" · ");
}

function entryAuthor(entry) {
  return state.members.find((member) => member.user_id === entry.author_id);
}

function profileForAuthor(entry) {
  const member = entryAuthor(entry);
  return member?.profiles || (entry.author_id === state.session?.user.id ? state.profile : null);
}

function authorBadge(entry) {
  return authorName(entry);
}

function ownerForEntry(entry) {
  return authorName(entry).includes("小宝") ? "xiaobao" : "dabao";
}

function authorName(entry) {
  const profile = profileForAuthor(entry) || {};
  const displayName = profile.display_name || profile.email || "";
  if (displayName.includes("小宝")) return "小宝";
  if (displayName.includes("大宝")) return "大宝";

  const currentName = state.profile?.display_name || "";
  if (entry.author_id === state.session?.user.id && currentName.includes("小宝")) return "小宝";
  return "大宝";
}

function entriesForDate(dateKey) {
  return state.entries.filter((entry) => formatDateKey(entry.entry_date) === dateKey);
}

function formatEntryTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function monthLabel(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function init() {
  applyDarkMode(state.darkMode);
  bindEvents();
  const { data } = await client.auth.getSession();
  state.session = data.session;
  if (state.session) {
    await enterApp();
  } else {
    showAuth();
  }
}

function bindEvents() {
  $("#show-login").addEventListener("click", () => setAuthMode("login"));
  $("#show-signup").addEventListener("click", () => setAuthMode("signup"));
  $("#auth-form").addEventListener("submit", handleAuth);
  $("#top-new-entry-button").addEventListener("click", openNewEntryDialog);
  $("#close-dialog").addEventListener("click", closeEntryDialog);
  $("#close-name-dialog").addEventListener("click", closeNameDialog);
  $("#entry-form").addEventListener("submit", saveEntry);
  $("#name-form").addEventListener("submit", saveDisplayName);
  $("#entry-photos").addEventListener("change", previewSelectedPhotos);
  $("#diary-search-input").addEventListener("input", renderDiary);
  $("#toggle-search").addEventListener("click", () => {
    $("#diary-search").classList.toggle("open");
    if ($("#diary-search").classList.contains("open")) $("#diary-search-input").focus();
  });
  $("#close-image-viewer").addEventListener("click", closeImageViewer);
  $("#prev-image").addEventListener("click", () => showAdjacentImage(-1));
  $("#next-image").addEventListener("click", () => showAdjacentImage(1));
  $("#image-viewer").addEventListener("click", (event) => {
    if (event.target.id === "image-viewer") closeImageViewer();
  });
  $("#prev-month").addEventListener("click", () => changeMonth(-1));
  $("#next-month").addEventListener("click", () => changeMonth(1));
  $("#edit-name").addEventListener("click", editName);
  $("#dark-mode-toggle").addEventListener("click", toggleDarkMode);
  $("#join-book").addEventListener("click", joinBook);
  $("#export-pdf").addEventListener("click", exportPdf);
  $("#logout").addEventListener("click", logout);

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  $$(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.diaryFilter = button.dataset.filter;
      $$(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip === button));
      renderDiary();
    });
  });

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-entry]");
    const deleteButton = event.target.closest("[data-delete-entry]");
    const imageButton = event.target.closest("[data-view-image]");
    const entryToggle = event.target.closest("[data-toggle-entry]");
    const groupToggle = event.target.closest("[data-toggle-group]");
    const calendarDay = event.target.closest("[data-calendar-day]");
    if (editButton) openEditEntryDialog(editButton.dataset.editEntry);
    if (deleteButton) deleteEntry(deleteButton.dataset.deleteEntry);
    if (imageButton) openImageViewer(imageButton.dataset.viewImage, imageButton.dataset.imageGroup);
    if (entryToggle) toggleEntry(entryToggle.dataset.toggleEntry);
    if (groupToggle) toggleGroup(groupToggle.dataset.toggleGroup);
    if (calendarDay) {
      state.selectedCalendarKey = calendarDay.dataset.calendarDay;
      renderCalendar();
    }
  });
}

function setAuthMode(mode) {
  state.mode = mode;
  $("#show-login").classList.toggle("active", mode === "login");
  $("#show-signup").classList.toggle("active", mode === "signup");
  $("#auth-submit").textContent = mode === "login" ? "登录" : "注册";
  authMessage.textContent = "";
}

async function handleAuth(event) {
  event.preventDefault();
  authMessage.textContent = "正在处理...";
  try {
    const email = $("#email").value.trim();
    const password = $("#password").value;

    const result =
      state.mode === "login"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password });

    if (result.error) {
      authMessage.textContent = result.error.message;
      return;
    }

    if (!result.data.session) {
      authMessage.textContent = "注册成功，请按 Supabase 邮件提示确认邮箱后再登录。";
      return;
    }

    state.session = result.data.session;
    await enterApp();
    authMessage.textContent = "";
  } catch (error) {
    showAuth();
    authMessage.textContent = error.message || "登录后加载失败，请把这个提示发给我。";
  }
}

function showAuth() {
  document.body.classList.remove("app-view");
  document.body.classList.add("auth-view");
  authScreen.style.display = "grid";
  appScreen.style.display = "none";
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

async function enterApp() {
  await ensureProfile();
  await ensureBook();
  await loadAll();
  document.body.classList.remove("auth-view");
  document.body.classList.add("app-view");
  authScreen.style.display = "none";
  appScreen.style.display = "block";
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

async function ensureProfile() {
  const user = state.session.user;
  const { data } = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (data) {
    state.profile = data;
    return;
  }

  const displayName = user.email?.includes("bingting") ? "大宝" : "小宝";
  const { data: created, error } = await client
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      display_name: displayName,
      diary_color: displayName === "大宝" ? "#ec4899" : "#a855f7",
    })
    .select("*")
    .single();

  if (error) throw error;
  state.profile = created;
}

async function ensureBook() {
  const { data, error } = await client.rpc("get_or_create_my_diary_book");
  if (error) throw error;
  state.bookId = data;
}

async function loadAll() {
  await Promise.all([loadBook(), loadMembers(), loadEntries()]);
  renderAll();
}

async function loadBook() {
  const { data, error } = await client.from("diary_books").select("*").eq("id", state.bookId).maybeSingle();
  if (error) {
    state.book = { id: state.bookId, name: "情侣日记本" };
    return;
  }
  state.book = data || { id: state.bookId, name: "情侣日记本" };
}

async function loadMembers() {
  const { data, error } = await client.from("diary_book_members").select("user_id").eq("book_id", state.bookId);
  if (error) {
    state.members = [{ user_id: state.session.user.id, profiles: state.profile }];
    return;
  }
  const members = data?.length ? data : [{ user_id: state.session.user.id }];
  const ids = members.map((member) => member.user_id);
  const { data: profiles } = await client.from("profiles").select("id, email, display_name, diary_color").in("id", ids);
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  state.members = members.map((member) => ({
    ...member,
    profiles: profileMap.get(member.user_id) || (member.user_id === state.session.user.id ? state.profile : null),
  }));
}

async function loadEntries() {
  const { data, error } = await client
    .from("diary_entries")
    .select("*")
    .eq("book_id", state.bookId)
    .order("entry_date", { ascending: false });
  if (error) throw error;
  state.entries = data || [];
}

function renderAll() {
  applyTheme(state.profile.theme_name || "rose");
  renderProfile();
  renderDiary();
  renderMemory();
  renderCalendar();
}

function renderProfile() {
  $("#profile-name").textContent = state.profile.display_name || "宝贝";
  $("#profile-email").textContent = state.profile.email || state.session.user.email || "管理个人信息";
  $("#my-count").textContent = state.entries.filter((entry) => entry.author_id === state.session.user.id).length;
  $("#photo-count").textContent = state.entries.reduce((total, entry) => total + (entry.photos?.length || 0), 0);
  $("#book-code").value = state.bookId || "";
  $("#dark-mode-status").textContent = state.darkMode ? "已开启" : "已关闭";
  $("#dark-mode-toggle").classList.toggle("active", state.darkMode);

  $("#members-list").innerHTML = state.members
    .map((member) => {
      const profile = member.profiles || {};
      return `${escapeHtml(profile.display_name || profile.email || "未命名")} ${state.entries.filter((entry) => entry.author_id === member.user_id).length} 篇`;
    })
    .join(" · ");

  $$(".theme-chip").forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === (state.profile.theme_name || "rose"));
    button.onclick = () => updateTheme(button.dataset.theme);
  });
}

function renderDiary() {
  const list = $("#diary-list");
  const keyword = $("#diary-search-input").value.trim().toLowerCase();
  const entries = state.entries.filter((entry) => {
    const profile = profileForAuthor(entry) || {};
    const text = `${entry.title || ""} ${entry.content || ""} ${entry.location || ""} ${entry.mood || ""} ${profile.display_name || ""} ${profile.email || ""}`.toLowerCase();
    const filterMatch = state.diaryFilter === "all" || ownerForEntry(entry) === state.diaryFilter;
    return filterMatch && text.includes(keyword);
  });

  if (!state.entries.length) {
    list.innerHTML = `<div class="empty">还没有日记。点右上角的加号，写下第一篇。</div>`;
    return;
  }

  if (!entries.length) {
    list.innerHTML = `<div class="empty">没有找到相关日记。</div>`;
    return;
  }

  const years = new Map();
  entries.forEach((entry) => {
    const date = new Date(entry.entry_date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    if (!years.has(year)) years.set(year, new Map());
    if (!years.get(year).has(month)) years.get(year).set(month, []);
    years.get(year).get(month).push(entry);
  });

  list.innerHTML = Array.from(years.entries())
    .map(([year, months]) => {
      const monthHtml = Array.from(months.entries())
        .map(([month, entries]) => {
          const key = `${year}-${month}`;
          const collapsed = state.collapsedGroups.has(key);
          return `
            <button class="month-toggle" data-toggle-group="${key}" type="button">
              <span>${month} 月</span>
              <span>${collapsed ? "⌄" : "⌃"}</span>
            </button>
            <div class="month-entries ${collapsed ? "collapsed" : ""}">${entries.map(renderEntryCard).join("")}</div>
          `;
        })
        .join("");
      return `<section class="month-group"><button class="year-toggle" data-toggle-group="${year}" type="button"><span>${year}</span><span>${state.collapsedGroups.has(String(year)) ? "⌄" : "⌃"}</span></button><div class="year-entries ${state.collapsedGroups.has(String(year)) ? "collapsed" : ""}">${monthHtml}</div></section>`;
    })
    .join("");
}

function renderEntryCard(entry) {
  const date = new Date(entry.entry_date);
  const profile = profileForAuthor(entry) || {};
  const canEdit = entry.author_id === state.session?.user.id;
  const photos = entry.photos || [];
  const title = entry.title?.trim();
  const isLong = entry.content.length > 220 || entry.content.split("\n").length > 5;
  const expanded = state.expandedEntries.has(entry.id);
  const preview = entry.content;
  const meta = [entry.mood, entry.location].filter(Boolean).map(escapeHtml).join(" ");
  return `
    <article class="entry-card">
      <div class="entry-date">
        <strong>${date.getDate()}</strong>
        <span>${weekNames[date.getDay()]}</span>
        <time>${formatEntryTime(date)}</time>
      </div>
      <div class="entry-body">
        <div class="entry-head">
          <div class="author">
            <span class="author-badge" style="background:${profile.diary_color || "var(--primary)"}">${authorBadge(entry)}</span>
            ${meta ? `<span>${meta}</span>` : ""}
            ${photos.length ? `<span>▧</span>` : ""}
          </div>
          ${
            canEdit
              ? `<div class="entry-actions">
                  <button data-edit-entry="${entry.id}" type="button" aria-label="编辑日记">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5z"></path></svg>
                  </button>
                  <button data-delete-entry="${entry.id}" type="button" aria-label="删除日记">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 15H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
                  </button>
                </div>`
              : ""
          }
        </div>
        ${title ? `<h4>${escapeHtml(title)}</h4>` : ""}
        <p class="${isLong && !expanded ? "entry-content collapsed-text" : "entry-content"}">${escapeHtml(preview)}</p>
        ${isLong ? `<button class="expand-button" data-toggle-entry="${entry.id}" type="button">${expanded ? "收起" : "展开"}</button>` : ""}
        ${photos.length ? `<div class="entry-photos">${photos.map((url) => `<button data-view-image="${escapeHtml(url)}" data-image-group="${entry.id}" type="button"><img src="${escapeHtml(url)}" alt="日记照片" /></button>`).join("")}</div>` : ""}
      </div>
    </article>
  `;
}

function renderMemory() {
  const startDate = defaultAnniversaryDate();
  const byYear = new Map();
  state.entries.forEach((entry) => {
    const year = new Date(entry.entry_date).getFullYear();
    byYear.set(year, (byYear.get(year) || 0) + 1);
  });
  const yearStats = Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .slice(0, 3);
  while (yearStats.length < 3) yearStats.push(["--", 0]);

  const moodCounts = new Map();
  state.entries.forEach((entry) => {
    const mood = entry.mood?.trim() || "其他";
    moodCounts.set(mood, (moodCounts.get(mood) || 0) + 1);
  });
  const moods = Array.from(moodCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const filtered = state.entries
    .map((entry) => ({ ...entry, specialLabel: specialDayLabel(entry.entry_date, startDate) }))
    .filter((entry) => entry.specialLabel);

  $("#memory-list").innerHTML = `
    <article class="memory-stat">
      <strong>${state.entries.length}</strong>
      <p>条共同记忆</p>
      <div class="memory-divider"></div>
      <div class="year-stats">
        ${yearStats.map(([year, count]) => `<div><strong>${count}</strong><span>${year}年</span></div>`).join("")}
      </div>
    </article>

    <article class="memory-panel">
      <h3>心情分布</h3>
      <div class="mood-chips">
        ${
          moods.length
            ? moods.map(([mood, count]) => `<span>${escapeHtml(mood)} ${Math.round((count / Math.max(state.entries.length, 1)) * 100)}%</span>`).join("")
            : `<span>还没有心情记录</span>`
        }
      </div>
    </article>

    <article class="memory-panel">
      <h3>本月亮点</h3>
      <div class="highlights">
        <div class="highlight"><span class="blue-dot"></span>共同回忆 ${state.entries.length} 条</div>
        <div class="highlight"><span class="blue-dot"></span>照片记录 ${state.entries.reduce((total, entry) => total + (entry.photos?.length || 0), 0)} 张</div>
        <div class="highlight"><span class="blue-dot"></span>最长日记 ${Math.max(0, ...state.entries.map((entry) => entry.content?.length || 0))} 字</div>
      </div>
    </article>

    <article class="memory-panel">
      <h3>纪念日起点</h3>
      <div class="anniversary-tools">
        <input id="anniversary-date" type="date" value="${escapeHtml(startDate)}" />
        <button id="save-anniversary" type="button">保存</button>
      </div>
    </article>

    ${
      filtered
        .map((entry) => {
          const date = new Date(entry.entry_date);
          const title = entry.title?.trim();
          const isLong = entry.content.length > 220 || entry.content.split("\n").length > 5;
          const expanded = state.expandedEntries.has(`memory-${entry.id}`);
          const preview = entry.content;
          return `
            <article class="memory-card">
              <div class="ago">${escapeHtml(entry.specialLabel)} · ${daysAgo(entry.entry_date)} 天前</div>
              <time>${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${cnWeekNames[date.getDay()]}</time>
              ${title ? `<h3>${escapeHtml(title)}</h3>` : ""}
              <p class="${isLong && !expanded ? "collapsed-text" : ""}">${escapeHtml(preview)}</p>
              ${isLong ? `<button class="expand-button" data-toggle-entry="memory-${entry.id}" type="button">${expanded ? "收起" : "展开"}</button>` : ""}
            </article>
          `;
        })
        .join("") || ""
    }
  `;

  $("#save-anniversary")?.addEventListener("click", saveAnniversaryDate);
}

function renderCalendar() {
  const date = state.calendarDate;
  const year = date.getFullYear();
  const month = date.getMonth();
  $("#calendar-month").textContent = monthLabel(date);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const entryDays = new Set(state.entries.map((entry) => formatDateKey(entry.entry_date)));
  const photoByDay = new Map();
  state.entries.forEach((entry) => {
    const firstPhoto = entry.photos?.[0];
    if (firstPhoto && !photoByDay.has(formatDateKey(entry.entry_date))) {
      photoByDay.set(formatDateKey(entry.entry_date), firstPhoto);
    }
  });
  const todayKey = formatDateKey(new Date());

  const days = [];
  for (let i = 0; i < firstDay.getDay(); i += 1) {
    days.push(`<span></span>`);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(year, month, day);
    const key = formatDateKey(current);
    const photo = photoByDay.get(key);
    days.push(`
      <button class="calendar-day ${entryDays.has(key) ? "has-entry" : ""} ${photo ? "photo-day" : ""} ${key === todayKey ? "today" : ""} ${key === state.selectedCalendarKey ? "active" : ""}" data-calendar-day="${key}" ${photo ? `style="background-image:url('${escapeHtml(photo)}')"` : ""} type="button">
        <span>${current.getDate()}</span>
      </button>
    `);
  }
  $("#calendar-grid").innerHTML = days.join("");
  renderCalendarSelected();
}

function changeMonth(offset) {
  state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + offset, 1);
  state.selectedCalendarKey = formatDateKey(state.calendarDate);
  renderCalendar();
}

function renderCalendarSelected() {
  const selectedDate = new Date(`${state.selectedCalendarKey}T00:00:00`);
  const entries = entriesForDate(state.selectedCalendarKey);
  $("#calendar-selected").innerHTML = `
    <div>${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 ${weekNames[selectedDate.getDay()]}</div>
    ${
      entries.length
        ? entries
            .map((entry) => {
              const title = entry.title?.trim() || "这天的日记";
              return `<article class="calendar-mini-entry"><h3><span class="author-badge">${authorBadge(entry)}</span> ${escapeHtml(title)}</h3><p>${escapeHtml((entry.content || "").slice(0, 42))}${entry.content?.length > 42 ? "..." : ""}</p></article>`;
            })
            .join("")
        : `<div class="calendar-mini-entry"><h3>这天还没有日记</h3><p>点右上角的加号，补写这一日。</p></div>`
    }
  `;
}

function showPage(page) {
  $$(".page").forEach((section) => section.classList.toggle("active", section.id === `page-${page}`));
  $$(".tab").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
}

async function saveEntry(event) {
  event.preventDefault();
  const title = $("#entry-title").value.trim();
  const content = $("#entry-content").value.trim();
  const location = $("#entry-location").value.trim();
  const mood = $("#entry-mood").value.trim();
  const entryDate = $("#entry-date").value;
  if (!content) return;

  const existing = state.entries.find((entry) => entry.id === state.editingEntryId);
  const uploadedPhotos = await uploadPhotos();
  const photos = [...(existing?.photos || []), ...uploadedPhotos];
  const payload = { title, content, location: location || null, photos, mood: mood || null, entry_date: new Date(entryDate).toISOString() };

  const query = state.editingEntryId
    ? client.from("diary_entries").update(payload).eq("id", state.editingEntryId)
    : client.from("diary_entries").insert({
        ...payload,
        book_id: state.bookId,
        author_id: state.session.user.id,
      });

  const { error } = await query;

  if (error) {
    alert(error.message);
    return;
  }

  closeEntryDialog();
  await loadAll();
  showPage("diary");
}

function openNewEntryDialog() {
  state.editingEntryId = null;
  $("#dialog-title").textContent = "写一篇日记";
  $("#entry-form").reset();
  $("#entry-date").value = toDateTimeLocalValue(new Date());
  $("#photo-preview").innerHTML = "";
  $("#entry-dialog").showModal();
}

function openEditEntryDialog(entryId) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;
  state.editingEntryId = entryId;
  $("#dialog-title").textContent = "编辑日记";
  $("#entry-date").value = toDateTimeLocalValue(entry.entry_date);
  $("#entry-title").value = entry.title;
  $("#entry-mood").value = entry.mood || "";
  $("#entry-content").value = entry.content;
  $("#entry-location").value = entry.location || "";
  $("#entry-photos").value = "";
  $("#photo-preview").innerHTML = (entry.photos || []).map((url) => `<img src="${escapeHtml(url)}" alt="已有照片" />`).join("");
  $("#entry-dialog").showModal();
}

async function saveAnniversaryDate() {
  const anniversaryDate = $("#anniversary-date").value;
  if (!anniversaryDate) return;
  const { data, error } = await client
    .from("diary_books")
    .update({ anniversary_date: anniversaryDate })
    .eq("id", state.bookId)
    .select("*")
    .single();
  if (error) {
    alert(error.message);
    return;
  }
  state.book = data;
  renderMemory();
}

function toggleEntry(entryId) {
  if (state.expandedEntries.has(entryId)) {
    state.expandedEntries.delete(entryId);
  } else {
    state.expandedEntries.add(entryId);
  }
  renderDiary();
  renderMemory();
}

function toggleGroup(groupKey) {
  if (state.collapsedGroups.has(groupKey)) {
    state.collapsedGroups.delete(groupKey);
  } else {
    state.collapsedGroups.add(groupKey);
  }
  renderDiary();
}

function openImageViewer(url, entryId) {
  const entry = state.entries.find((item) => item.id === entryId);
  state.viewerPhotos = entry?.photos?.length ? entry.photos : [url];
  state.viewerIndex = Math.max(0, state.viewerPhotos.indexOf(url));
  renderImageViewer();
  $("#image-viewer").classList.remove("hidden");
}

function renderImageViewer() {
  const total = state.viewerPhotos.length;
  $("#image-viewer-img").src = state.viewerPhotos[state.viewerIndex] || "";
  $("#image-counter").textContent = total > 1 ? `${state.viewerIndex + 1} / ${total}` : "";
  $("#prev-image").classList.toggle("hidden", total <= 1);
  $("#next-image").classList.toggle("hidden", total <= 1);
}

function showAdjacentImage(direction) {
  if (state.viewerPhotos.length <= 1) return;
  state.viewerIndex = (state.viewerIndex + direction + state.viewerPhotos.length) % state.viewerPhotos.length;
  renderImageViewer();
}

function closeImageViewer() {
  $("#image-viewer").classList.add("hidden");
  $("#image-viewer-img").src = "";
  state.viewerPhotos = [];
  state.viewerIndex = 0;
}

function closeEntryDialog() {
  state.editingEntryId = null;
  $("#entry-form").reset();
  $("#photo-preview").innerHTML = "";
  $("#entry-dialog").close();
}

function closeNameDialog() {
  $("#name-dialog").close();
}

function previewSelectedPhotos() {
  const files = Array.from($("#entry-photos").files || []);
  $("#photo-preview").innerHTML = files.map((file) => `<span>${escapeHtml(file.name)}</span>`).join("");
}

async function uploadPhotos() {
  const files = Array.from($("#entry-photos").files || []);
  const urls = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${state.session.user.id}/${Date.now()}-${safeName}`;
    const { error } = await client.storage.from("diary-photos").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = client.storage.from("diary-photos").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

async function deleteEntry(entryId) {
  if (!confirm("确定删除这篇日记吗？")) return;
  const { error } = await client.from("diary_entries").delete().eq("id", entryId);
  if (error) {
    alert(error.message);
    return;
  }
  await loadAll();
}

async function editName() {
  $("#display-name-input").value = state.profile.display_name || "";
  $("#name-dialog").showModal();
  $("#display-name-input").focus();
  $("#display-name-input").select();
}

async function saveDisplayName(event) {
  event.preventDefault();
  const name = $("#display-name-input").value.trim();
  if (!name) return;
  const { data, error } = await client.from("profiles").update({ display_name: name.trim() }).eq("id", state.session.user.id).select("*").single();
  if (error) {
    alert(error.message);
    return;
  }
  state.profile = data;
  closeNameDialog();
  await loadAll();
}

async function updateColor(color) {
  const { data, error } = await client.from("profiles").update({ diary_color: color }).eq("id", state.session.user.id).select("*").single();
  if (error) {
    alert(error.message);
    return;
  }
  state.profile = data;
  await loadAll();
}

async function updateTheme(themeName) {
  const normalizedTheme = themeName === "paper" ? "rose" : themeName;
  applyTheme(normalizedTheme);
  const { data, error } = await client.from("profiles").update({ theme_name: normalizedTheme }).eq("id", state.session.user.id).select("*").single();
  if (error) {
    alert(error.message);
    return;
  }
  state.profile = data;
  renderProfile();
}

function applyTheme(themeName) {
  const theme = themes[themeName === "paper" ? "rose" : themeName] || themes.rose;
  document.documentElement.style.setProperty("--primary", theme.primary);
  document.documentElement.style.setProperty("--primary-strong", theme.primary);
}

function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  localStorage.setItem("coupleDiaryDarkMode", String(state.darkMode));
  applyDarkMode(state.darkMode);
  renderProfile();
}

function applyDarkMode(enabled) {
  document.body.classList.toggle("dark-mode", enabled);
}

function exportPdf() {
  const backup = {
    exported_at: new Date().toISOString(),
    book: state.book,
    profile: state.profile,
    members: state.members,
    entries: state.entries,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `couple-diary-backup-${formatDateKey(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function joinBook() {
  const code = $("#join-code").value.trim();
  if (!code) return;
  const { error } = await client.from("diary_book_members").insert({
    book_id: code,
    user_id: state.session.user.id,
  });
  if (error) {
    alert(error.message);
    return;
  }
  state.bookId = code;
  $("#join-code").value = "";
  await loadAll();
  alert("已经加入这个日记本。");
}

async function logout() {
  await client.auth.signOut();
  state.session = null;
  state.profile = null;
  state.bookId = null;
  state.entries = [];
  showAuth();
}

init().catch((error) => {
  console.error(error);
  alert(error.message);
});
