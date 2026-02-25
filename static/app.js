// ==========================================
// CONFIG & STATE
// ==========================================
const API_URL = "http://172.16.2.8:8002";
let currentUser = JSON.parse(localStorage.getItem("user")) || null;
let routine = [];
let globalExercises = [];
let activeSession = JSON.parse(localStorage.getItem("workoutState")) || null;
let globalTimerInterval, restTimerInterval;
let currentSetStartTime = null; // Track exact time for Time Under Tension
let progressChartInstance = null;
let swiperInstance = null;

const views = {
  auth: document.getElementById("auth-view"),
  builder: document.getElementById("builder-view"),
  session: document.getElementById("session-view"),
  stats: document.getElementById("stats-view"),
  nav: document.getElementById("bottom-nav"),
};

// ==========================================
// TIMEZONE HELPER
// ==========================================
function getLocalISOString() {
  const date = new Date();
  // Get the exact minute offset for your time zone (IST is -330 minutes)
  const tzOffset = date.getTimezoneOffset() * 60000;
  // Subtract the offset to force the ISO string to show local time
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
}

// ==========================================
// 1. INITIALIZATION & DAILY RESET
// ==========================================
async function initApp() {
  if (!currentUser) {
    views.auth.classList.remove("hidden");
    return;
  }

  // Daily Reset Logic
  const todayStr = new Date().toDateString();
  document.getElementById("date-display").innerText = todayStr;
  if (localStorage.getItem("routineDate") !== todayStr) {
    localStorage.setItem("routineDate", todayStr);
    localStorage.setItem("savedRoutine", JSON.stringify([]));
  }
  routine = JSON.parse(localStorage.getItem("savedRoutine")) || [];

  views.auth.classList.add("hidden");
  views.nav.classList.remove("hidden");

  await loadGlobalLibrary();

  if (activeSession) resumeSession();
  else switchTab("builder");
}

async function handleAuth(action) {
  const u = document.getElementById("username").value;
  const p = document.getElementById("password").value;
  if (!u || !p) return alert("Enter credentials");

  try {
    const res = await fetch(`${API_URL}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    if (!res.ok) throw new Error("Auth failed");
    const data = await res.json();
    currentUser = { id: data.user_id || data.id, username: data.username };
    localStorage.setItem("user", JSON.stringify(currentUser));
    initApp();
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================
// 2. LIBRARY & BUILDER
// ==========================================
async function loadGlobalLibrary() {
  try {
    const res = await fetch(`${API_URL}/exercises/${currentUser.id}`);
    globalExercises = await res.json();
    renderBuilder();
  } catch (e) {
    console.error("Failed to load library");
  }
}

function quickAdd(focus) {
  let focusGroups = focus === "Arms" ? ["Biceps", "Triceps"] : [focus];
  const toAdd = globalExercises.filter((e) =>
    focusGroups.includes(e.muscle_group),
  );

  let addedCount = 0;
  for (let ex of toAdd) {
    // Only add if it's not already in the routine, cap at 4 exercises
    if (!routine.some((r) => r.id === ex.id) && addedCount < 20) {
      routine.push({ ...ex }); // Clone the object
      addedCount++;
    }
  }
  saveRoutine();
}

function removeExercise(index) {
  routine.splice(index, 1);
  saveRoutine();
}

// Add this variable right above your renderBuilder function
let sortableInstance = null;

function renderBuilder() {
  const list = document.getElementById("exercise-list");
  const emptyState = document.getElementById("empty-state");

  if (routine.length === 0) {
    emptyState.style.display = "block";
    list.innerHTML = "";
    return;
  }

  // Safely hide empty state and clear the list
  emptyState.style.display = "none";
  list.innerHTML = "";

  routine.forEach((ex, index) => {
    const li = document.createElement("li");
    li.className =
      "bg-gray-800 rounded-2xl p-3 flex items-center justify-between shadow-sm border border-gray-700/50";
    li.dataset.id = ex.id;
    li.innerHTML = `
            <div class="flex items-center gap-3">
                <button onclick="removeExercise(${index})" class="text-red-500 p-2 active:scale-90 transition">
                    <i class="fas fa-minus-circle text-xl"></i>
                </button>
                <div class="bg-gray-700 h-10 w-10 rounded-xl flex items-center justify-center text-blue-400">
                    <i class="fas fa-dumbbell"></i>
                </div>
                <div>
                    <h3 class="font-bold text-white text-sm">${ex.name}</h3>
                    <p class="text-xs text-gray-400 uppercase">${ex.muscle_group}</p>
                </div>
            </div>
            <i class="fas fa-grip-lines text-gray-500 text-xl cursor-grab p-2 active:cursor-grabbing handle"></i>
        `;
    list.appendChild(li);
  });

  // Destroy the old dragging instance before making a new one to prevent UI freezing
  if (sortableInstance) {
    sortableInstance.destroy();
  }

  sortableInstance = new Sortable(list, {
    handle: ".handle",
    animation: 150,
    onEnd: () => {
      const newOrderIds = Array.from(list.children).map((li) => li.dataset.id);
      routine = newOrderIds.map((id) =>
        routine.find((ex) => String(ex.id) === String(id)),
      );
      // Note: We use localStorage.setItem directly here instead of saveRoutine()
      // so we don't trigger a full re-render while dragging.
      localStorage.setItem("savedRoutine", JSON.stringify(routine));
    },
  });
}

function saveRoutine() {
  localStorage.setItem("savedRoutine", JSON.stringify(routine));
  renderBuilder();
}

// ==========================================
// 3. MODALS
// ==========================================
function openLibraryModal() {
  const modal = document.getElementById("library-modal");
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.remove("translate-y-full"), 10);

  const parts = [...new Set(globalExercises.map((e) => e.muscle_group))].filter(
    Boolean,
  );
  document.getElementById("body-parts-grid").innerHTML = parts
    .map(
      (p) => `
        <button onclick="filterLibrary('${p}')" class="bg-gray-800 p-6 rounded-2xl border border-gray-700 font-bold text-lg active:bg-gray-700">
            <span class="text-blue-500">${p}</span>
        </button>
    `,
    )
    .join("");
}

function closeLibraryModal() {
  const modal = document.getElementById("library-modal");
  modal.classList.add("translate-y-full");
  setTimeout(() => modal.classList.add("hidden"), 300);
  backToBodyParts();
}

function filterLibrary(muscle) {
  document.getElementById("body-parts-grid").classList.add("hidden");
  document.getElementById("library-exercises-list").classList.remove("hidden");

  document.getElementById("filtered-exercises").innerHTML = globalExercises
    .filter((e) => e.muscle_group === muscle)
    .map(
      (e) => `
        <button onclick="addToRoutine(${e.id})" class="w-full text-left bg-gray-800 p-4 rounded-xl border border-gray-700 font-bold text-white flex justify-between active:bg-gray-700">
            ${e.name} <i class="fas fa-plus text-blue-500"></i>
        </button>
    `,
    )
    .join("");
}

function backToBodyParts() {
  document.getElementById("body-parts-grid").classList.remove("hidden");
  document.getElementById("library-exercises-list").classList.add("hidden");
}

function addToRoutine(id) {
  routine.push(globalExercises.find((e) => e.id === id));
  saveRoutine();
  closeLibraryModal();
}

function openCustomModal() {
  document.getElementById("custom-modal").classList.remove("hidden");
}
function closeCustomModal() {
  document.getElementById("custom-modal").classList.add("hidden");
}

async function addCustomExercise() {
  const name = document.getElementById("new-ex-name").value;
  const muscle_group = document.getElementById("new-ex-muscle").value;
  if (!name || !muscle_group) return;

  try {
    const res = await fetch(`${API_URL}/exercises/${currentUser.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, muscle_group, image_url: "" }),
    });
    const newEx = await res.json();
    globalExercises.push(newEx);
    routine.push(newEx);
    saveRoutine();
    closeCustomModal();
    document.getElementById("new-ex-name").value = "";
    document.getElementById("new-ex-muscle").value = "";
  } catch (err) {
    alert("Failed to save exercise");
  }
}

// ==========================================
// 4. ACTIVE SESSION & iOS ROLLERS
// ==========================================
function startWorkout() {
  if (routine.length === 0) return alert("Add exercises first!");
  activeSession = {
    startTime: getLocalISOString(),
    exercises: routine.map((ex) => ({ ...ex, sets: [] })),
  };
  localStorage.setItem("workoutState", JSON.stringify(activeSession));
  resumeSession();
}

function resumeSession() {
  views.builder.classList.add("hidden");
  views.nav.classList.add("hidden");
  views.session.classList.remove("hidden");
  views.session.classList.add("flex");
  currentSetStartTime = getLocalISOString(); // Start timer for first set TUT
  renderSessionCards();
  startGlobalTimer();
}

// Generating the iOS Rollers in HTML
function generateRoller(idPrefix, max, step, isWeight) {
  let items = "";
  // Add an empty item at the top and bottom so the first/last values can center
  items += `<div class="roller-item"></div>`;
  for (let i = 0; i <= max; i++) {
    let val = isWeight ? i * step : i + step; // Weight starts at 0, Reps start at 1
    items += `<div class="roller-item font-mono text-xl">${val}</div>`;
  }
  items += `<div class="roller-item"></div>`;

  return `
    <div class="flex-1 bg-gray-900 rounded-2xl border border-gray-800 relative h-[120px] overflow-hidden">
        <div class="roller-highlight"></div>
        <div class="h-full overflow-y-scroll no-scrollbar roller-container" id="${idPrefix}">
            ${items}
        </div>
        <div class="absolute bottom-1 w-full text-center text-[10px] text-gray-500 font-bold tracking-widest">${isWeight ? "KG" : "REPS"}</div>
    </div>`;
}

function renderSessionCards() {
  const wrapper = document.getElementById("session-swiper-wrapper");
  wrapper.innerHTML = "";

  let firstUnfinishedIndex = 0;
  let foundUnfinished = false;

  activeSession.exercises.forEach((ex, idx) => {
    const slide = document.createElement("div");
    slide.className =
      "swiper-slide flex flex-col h-full bg-gray-950 p-5 no-scrollbar";

    const setNum = ex.sets.length + 1;
    const isDone = ex.sets.length >= 3; // Check if capped at 3 sets

    // Find the slide we should start on
    if (!isDone && !foundUnfinished) {
      firstUnfinishedIndex = idx;
      foundUnfinished = true;
    }

    slide.innerHTML = `
            <h2 class="text-3xl font-bold mb-1 text-white">${ex.name}</h2>
            <p class="text-blue-400 mb-4 font-medium text-sm tracking-wide uppercase">Set <span id="set-tracker-${idx}">${isDone ? "DONE" : setNum}</span></p>
            
            <div id="pr-banner-${idx}" class="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4 mb-6 flex justify-between items-center shadow-inner h-14">
                <span class="text-sm text-gray-500">Loading PRs...</span>
            </div>

            <div class="flex gap-4 mb-8">
                ${generateRoller(`weight-roller-${idx}`, 60, 2.5, true)}
                ${generateRoller(`rep-roller-${idx}`, 29, 1, false)}
            </div>

            <button id="log-btn-${idx}" onclick="logSetAndRest(${idx})" class="w-full ${isDone ? "bg-green-600" : "bg-blue-600 active:scale-95"} text-white font-bold text-xl rounded-2xl py-5 transition mt-auto mb-6" ${isDone ? "disabled" : ""}>
                ${isDone ? "Exercise Complete" : "Log Set"}
            </button>
        `;
    wrapper.appendChild(slide);

    if (!isDone) {
      fetchPRsAndScroll(ex.id, idx, setNum);
    }
  });

  // Destroy old swiper if it exists, and initialize starting on the active exercise
  if (swiperInstance) swiperInstance.destroy();
  swiperInstance = new Swiper(".mySwiper", {
    spaceBetween: 30,
    resistanceRatio: 0.5,
    initialSlide: firstUnfinishedIndex, // Auto-scrolls to where you left off
  });
}

async function fetchPRsAndScroll(exId, idx, setNum) {
  try {
    const res = await fetch(`${API_URL}/prs/${currentUser.id}/${exId}`);
    const data = await res.json();
    const pr = data[`set_${setNum}`];

    if (pr && pr.max_weight) {
      document.getElementById(`pr-banner-${idx}`).innerHTML =
        `<span class="text-sm text-blue-300 font-bold">Set ${setNum} PR</span><span class="font-mono text-lg font-bold text-blue-400">${pr.max_weight}kg × ${pr.max_reps}</span>`;
      // Scroll rollers to PR values (40px per item)
      document.getElementById(`weight-roller-${idx}`).scrollTop =
        (pr.max_weight / 2.5) * 40;
      document.getElementById(`rep-roller-${idx}`).scrollTop =
        (pr.max_reps - 1) * 40;
    } else {
      document.getElementById(`pr-banner-${idx}`).innerHTML =
        `<span class="text-sm text-gray-500">No PR data for Set ${setNum}</span>`;
      // Scroll to defaults (e.g., 20kg, 10 reps)
      document.getElementById(`weight-roller-${idx}`).scrollTop =
        (20 / 2.5) * 40;
      document.getElementById(`rep-roller-${idx}`).scrollTop = (10 - 1) * 40;
    }
  } catch (e) {
    console.error(e);
  }
}

// ==========================================
// 5. TIMERS & TIMESTAMPS
// ==========================================
function startGlobalTimer() {
  const start = new Date(activeSession.startTime).getTime();
  globalTimerInterval = setInterval(() => {
    const diff = Math.floor((Date.now() - start) / 1000);
    document.getElementById("global-timer").innerText =
      `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
  }, 1000);
}

function logSetAndRest(exIndex) {
  const wRoller = document.getElementById(`weight-roller-${exIndex}`);
  const rRoller = document.getElementById(`rep-roller-${exIndex}`);

  const weight = Math.round(wRoller.scrollTop / 40) * 2.5;
  const reps = Math.round(rRoller.scrollTop / 40) + 1;

  const setNum = activeSession.exercises[exIndex].sets.length + 1;
  const endTime = getLocalISOString();

  activeSession.exercises[exIndex].sets.push({
    exercise_id: activeSession.exercises[exIndex].id,
    set_number: setNum,
    weight,
    reps,
    start_time: currentSetStartTime,
    end_time: endTime,
  });

  localStorage.setItem("workoutState", JSON.stringify(activeSession));

  // Check if we hit the 3 set cap
  if (setNum < 3) {
    // Setup UI for next set while resting
    document.getElementById(`set-tracker-${exIndex}`).innerText = setNum + 1;
    fetchPRsAndScroll(activeSession.exercises[exIndex].id, exIndex, setNum + 1);
  } else {
    // Exercise is Complete!
    document.getElementById(`set-tracker-${exIndex}`).innerText = "DONE";
    const btn = document.getElementById(`log-btn-${exIndex}`);
    if (btn) {
      btn.innerText = "Exercise Complete";
      btn.disabled = true;
      btn.classList.replace("bg-blue-600", "bg-green-600");
      btn.classList.remove("active:scale-95");
    }

    // Command Swiper to slide to the next exercise (if not the last one)
    if (swiperInstance && exIndex < activeSession.exercises.length - 1) {
      setTimeout(() => {
        swiperInstance.slideNext();
      }, 300); // Tiny delay so you see the green button before it slides
    }
  }

  // Negative Rest Timer (Always triggers, even between exercises)
  document.getElementById("rest-modal").classList.remove("hidden");
  let timeLeft = 120; // 2 Minutes
  const display = document.getElementById("rest-timer-display");
  display.classList.remove("text-red-500");
  display.classList.add("text-white");

  restTimerInterval = setInterval(() => {
    timeLeft--;
    const isNeg = timeLeft < 0;
    const absTime = Math.abs(timeLeft);
    display.innerText = `${isNeg ? "-" : ""}${String(Math.floor(absTime / 60)).padStart(2, "0")}:${String(absTime % 60).padStart(2, "0")}`;
    if (isNeg) {
      display.classList.add("text-red-500");
      display.classList.remove("text-white");
    }
  }, 1000);
}

function skipRest() {
  clearInterval(restTimerInterval);
  document.getElementById("rest-modal").classList.add("hidden");
  currentSetStartTime = getLocalISOString(); // Start TUT for the next set!
}

// ==========================================
// 6. FINISH & STATS LOADING
// ==========================================
function cancelWorkout() {
  localStorage.removeItem("workoutState");
  location.reload();
}

async function finishWorkout() {
  clearInterval(globalTimerInterval);
  let allSets = [];
  activeSession.exercises.forEach((ex) => (allSets = allSets.concat(ex.sets)));

  try {
    const res = await fetch(`${API_URL}/workouts/${currentUser.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_time: activeSession.startTime,
        end_time: getLocalISOString(),
        sets: allSets,
      }),
    });
    if (res.ok) {
      localStorage.removeItem("workoutState");
      location.reload();
    }
  } catch (e) {
    alert("Failed to save workout");
  }
}

async function switchTab(tab) {
  views.builder.classList.add("hidden");
  views.stats.classList.add("hidden");
  document.getElementById("nav-builder").classList.remove("text-blue-500");
  document.getElementById("nav-builder").classList.add("text-gray-400");
  document.getElementById("nav-stats").classList.remove("text-blue-500");
  document.getElementById("nav-stats").classList.add("text-gray-400");

  if (tab === "builder") {
    views.builder.classList.remove("hidden");
    views.builder.classList.add("flex");
    document.getElementById("nav-builder").classList.add("text-blue-500");
  } else {
    views.stats.classList.remove("hidden");
    document.getElementById("nav-stats").classList.add("text-blue-500");

    // Dynamically load stats.html
    if (views.stats.innerHTML === "") {
      const res = await fetch("/stats.html");
      views.stats.innerHTML = await res.text();
    }
    loadStats();
  }
}

async function loadStats() {
  try {
    const res = await fetch(`${API_URL}/stats/${currentUser.id}`);
    const stats = await res.json();
    document.getElementById("stat-power").innerText = stats.power || 0;
    document.getElementById("stat-consistency").innerText =
      stats.consistency_days || 0;
    document.getElementById("stat-stamina").innerText = stats.stamina || 0;
  } catch (e) {}
  try {
    const res = await fetch(`${API_URL}/metrics/${currentUser.id}`);
    renderChart(await res.json());
  } catch (e) {}
}

async function logBodyWeight() {
  const val = document.getElementById("bw-input").value;
  if (!val) return;
  try {
    await fetch(`${API_URL}/metrics/${currentUser.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body_weight: parseFloat(val) }),
    });
    document.getElementById("bw-input").value = "";
    loadStats();
  } catch (e) {}
}

function renderChart(metrics) {
  const ctx = document.getElementById("progressChart").getContext("2d");
  if (progressChartInstance) progressChartInstance.destroy();
  Chart.defaults.color = "#9ca3af";
  Chart.defaults.font.family = "monospace";
  progressChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: metrics.map((m) => new Date(m.date).toLocaleDateString()),
      datasets: [
        {
          label: "Body Weight (kg)",
          data: metrics.map((m) => m.body_weight),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: "#374151" } },
        x: { grid: { display: false } },
      },
    },
  });
}

initApp();
