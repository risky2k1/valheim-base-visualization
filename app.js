// Active tab tracking
let activeTabId = "tab-plan";
function switchTab(tabId, btn) {
  activeTabId = tabId;
  document
    .querySelectorAll(".tab-pane")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn:not(#sidebar-toggle-btn)")
    .forEach((el) => el.classList.remove("active"));
  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");
  if (btn) btn.classList.add("active");

  // Show/hide floating HUD on plan & sections tabs
  const hud = document.getElementById("viewport-hud");
  const hint = document.getElementById("hud-hint");
  const isSvgTab = tabId === "tab-plan" || tabId === "tab-sections";
  if (hud) hud.style.display = isSvgTab ? "flex" : "none";
  if (hint) hint.style.display = isSvgTab ? "block" : "none";

  if (isSvgTab) {
    updateHUD();
  }

  if (tabId === "tab-3d") {
    requestAnimationFrame(() => {
      resize3D();
      draw3D();
    });
  }
}

// Sidebar Toggle
function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const btn = document.getElementById("sidebar-toggle-btn");
  sidebar.classList.toggle("collapsed");
  if (btn) {
    btn.classList.toggle("active", !sidebar.classList.contains("collapsed"));
  }
  if (activeTabId === "tab-3d") {
    requestAnimationFrame(() => {
      resize3D();
      draw3D();
    });
  }
}

// SVG Layer Toggle
function toggleLayer(layerId, visible) {
  const el = document.querySelector("#svg-container #" + layerId);
  if (el) el.style.display = visible ? "inline" : "none";
}

// ==================== RAZOR-SHARP VECTOR SVG VIEWBOX ZOOM & PAN ====================
class SvgPanZoom {
  constructor(viewportId, svgSelector, baseW, baseH) {
    this.viewport = document.getElementById(viewportId);
    this.svg = document.querySelector(svgSelector);
    this.baseW = baseW;
    this.baseH = baseH;

    this.currentZoom = 1.0;
    this.vx = 0;
    this.vy = 0;
    this.vw = baseW;
    this.vh = baseH;

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.initialVx = 0;
    this.initialVy = 0;
    this.dragMoved = false;

    this.initEvents();
    this.applyViewBox();
  }

  applyViewBox() {
    if (!this.svg) return;
    this.svg.setAttribute(
      "viewBox",
      `${this.vx} ${this.vy} ${this.vw} ${this.vh}`,
    );
    if (this.currentZoom <= 1.02) {
      this.svg.style.cursor = "default";
    } else {
      this.svg.style.cursor = this.isDragging ? "grabbing" : "grab";
    }
    if (typeof updateHUD === "function") {
      updateHUD();
    }
  }

  fitView() {
    this.currentZoom = 1.0;
    this.vx = 0;
    this.vy = 0;
    this.vw = this.baseW;
    this.vh = this.baseH;
    this.applyViewBox();
  }

  zoom(factor, reset = false, clientX = null, clientY = null) {
    if (reset) {
      this.fitView();
      return;
    }
    const prevZoom = this.currentZoom;
    let newZoom = Math.max(1.0, Math.min(10.0, prevZoom * factor));
    if (newZoom <= 1.02) {
      this.fitView();
      return;
    }

    let cx = this.vx + this.vw / 2;
    let cy = this.vy + this.vh / 2;

    if (clientX !== null && clientY !== null && this.svg) {
      try {
        const pt = this.svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());
        if (Number.isFinite(svgP.x) && Number.isFinite(svgP.y)) {
          cx = svgP.x;
          cy = svgP.y;
        }
      } catch (err) {
        cx = this.vx + this.vw / 2;
        cy = this.vy + this.vh / 2;
      }
    }

    const ratioX = (cx - this.vx) / this.vw;
    const ratioY = (cy - this.vy) / this.vh;

    const newVw = this.baseW / newZoom;
    const newVh = this.baseH / newZoom;

    this.vx = cx - ratioX * newVw;
    this.vy = cy - ratioY * newVh;
    this.vw = newVw;
    this.vh = newVh;
    this.currentZoom = newZoom;

    this.applyViewBox();
  }

  initEvents() {
    if (!this.viewport || !this.svg) return;

    this.viewport.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (this.currentZoom <= 1.02) return;
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.initialVx = this.vx;
      this.initialVy = this.vy;
      if (this.svg) {
        this.svg.style.cursor = "grabbing";
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.dragMoved = true;
      }
      if (!this.svg) return;
      const rect = this.svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const svgDx = dx * (this.vw / rect.width);
        const svgDy = dy * (this.vh / rect.height);
        this.vx = this.initialVx - svgDx;
        this.vy = this.initialVy - svgDy;
        this.applyViewBox();
      }
    });

    window.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.currentZoom > 1.02) {
          this.svg.style.cursor = "grab";
        } else {
          this.svg.style.cursor = "default";
        }
      }
    });

    this.viewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.2 : 0.83;
        this.zoom(factor, false, e.clientX, e.clientY);
      },
      { passive: false },
    );

    this.viewport.addEventListener("dblclick", () => {
      this.fitView();
    });
  }
}

let planController = null;
let sectionsController = null;

function getActiveController() {
  if (activeTabId === "tab-sections") return sectionsController;
  return planController;
}

function resetActiveFit() {
  const ctrl = getActiveController();
  if (ctrl) ctrl.fitView();
}

function zoomActiveTab(factor, reset = false) {
  const ctrl = getActiveController();
  if (ctrl) ctrl.zoom(factor, reset);
}

function updateHUD() {
  const ctrl = getActiveController();
  if (!ctrl) return;

  const hudFitBtn = document.getElementById("hud-fit-btn");
  const sideFitBtn = document.getElementById("side-fit-btn");
  const zoomVal = document.getElementById("hud-zoom-val");

  const isFit = ctrl.currentZoom <= 1.02;
  if (hudFitBtn) hudFitBtn.classList.toggle("active", isFit);
  if (sideFitBtn) sideFitBtn.classList.toggle("active", isFit);
  if (zoomVal) {
    zoomVal.textContent = isFit
      ? "Fit"
      : Math.round(ctrl.currentZoom * 100) + "%";
  }
}

// Live Coordinate Probe constants & zone resolution
const SCALE = 12.0,
  X_MIN = -52.0,
  Y_MAX = 84.0,
  MARGIN_LEFT = 140,
  MARGIN_TOP = 160;

function resolveZone(xm, ym) {
  if (xm >= 0 && xm <= 24 && ym >= 0 && ym <= 24)
    return ["+4.0 m (Basement 0..+4m)", "A1. Existing Dreamhouse (Fixed)"];
  if (xm >= -20 && xm <= -4 && ym >= 8 && ym <= 24)
    return ["+4.0 m", "A3. Resting & Comfort Hall"];
  if (xm >= -4 && xm <= 0 && ym >= 8 && ym <= 16)
    return ["+4.0 m (+2m under)", "A3. Covered Skybridge"];
  if (xm >= -24 && xm <= -4 && ym >= 0 && ym <= 8)
    return ["+2.0 m", "A4. Hot Tub & Maypole Spa Court"];
  if (xm >= -4 && xm <= 32 && ym >= -8 && ym <= 28)
    return ["+2.0 m", "A2. First Outdoor Elevated Plaza (36×36m)"];
  if (xm >= 40 && xm <= 76 && ym >= -32 && ym <= 16)
    return ["0.0 m (-0.15m Soil)", "Zone B. Agriculture Compound"];
  if (xm >= 60 && xm <= 72 && ym >= 28 && ym <= 52)
    return ["-2.0 m (Sunken Pit)", "C2. Lox / Asksvin Paddock"];
  if (xm >= 40 && xm <= 76 && ym >= 24 && ym <= 56)
    return ["0.0 m", "Zone C. Animal Husbandry Compound"];
  if (xm >= -28 && xm <= -8 && ym >= 38 && ym <= 48)
    return ["0.0 m", "F1. Stone Portal Colonnade"];
  if (xm >= 4 && xm <= 20 && ym >= 64 && ym <= 74)
    return ["0.0 m (+12m Towers)", "D1. North Barbican Gatehouse"];
  if (xm >= -8 && xm <= 28 && ym >= -48 && ym <= -44)
    return ["0.0 m / -0.5 m", "E1. 36m Main Harbor Quay"];
  if (xm >= -8 && xm <= 28 && ym >= -68 && ym <= -48)
    return ["-1.5 m WL / -4.5 m Bed", "Zone E. Dredged Harbor Basin"];
  if (ym < -44) return ["-1.5 m Waterline", "Coastal Sea Approach"];
  return ["0.0 m Ground Datum", "Paved Avenue / Settlement Grounds"];
}

function initPlanProbe(svgEl) {
  if (!svgEl) return;
  const coordBox = document.getElementById("coord-box");
  svgEl.addEventListener("mousemove", (e) => {
    if (planController && planController.isDragging) return;
    try {
      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());
      const xm = (svgP.x - MARGIN_LEFT) / SCALE + X_MIN;
      const ym = Y_MAX - (svgP.y - MARGIN_TOP) / SCALE;
      if (xm >= -52 && xm <= 92 && ym >= -80 && ym <= 84) {
        const tx = Math.floor(xm / 4);
        const ty = Math.floor(ym / 4);
        const [zStr, zoneStr] = resolveZone(xm, ym);
        if (coordBox) {
          coordBox.innerHTML = `
                X (East+): <strong>${xm >= 0 ? "+" : ""}${xm.toFixed(1)} m</strong> (4m Tile ${tx >= 0 ? "+" : ""}${tx})<br>
                Y (North+): <strong>${ym >= 0 ? "+" : ""}${ym.toFixed(1)} m</strong> (4m Tile ${ty >= 0 ? "+" : ""}${ty})<br>
                Z (Elev): <strong>${zStr}</strong><br>
                Zone: <strong style="color:var(--accent);">${zoneStr}</strong>
              `;
        }
      }
    } catch (err) {}
  });
}

// Asynchronously load and mount external SVG files
// Seamlessly supports both local file:// viewing (via pre-bundled svg-data.js) and HTTP/GitHub Pages (via fetch fallback)
async function loadSvg(
  url,
  svgKey,
  containerId,
  viewportId,
  baseW,
  baseH,
  isPlan = false,
) {
  const container = document.getElementById(containerId);
  try {
    let svgText = "";
    if (window.VALHEIM_SVGS && window.VALHEIM_SVGS[svgKey]) {
      svgText = window.VALHEIM_SVGS[svgKey];
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      svgText = await res.text();
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    if (!svgEl) throw new Error("No SVG element found in " + url);

    svgEl.setAttribute("width", "100%");
    svgEl.setAttribute("height", "100%");
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    container.innerHTML = "";
    container.appendChild(svgEl);

    const controller = new SvgPanZoom(
      viewportId,
      "#" + containerId + " svg",
      baseW,
      baseH,
    );
    if (isPlan) {
      initPlanProbe(svgEl);
    }
    return controller;
  } catch (err) {
    console.warn(`Could not load ${url}:`, err);
    container.innerHTML = `
      <div style="color:var(--text-muted); padding:20px; text-align:center;">
        <p>Không thể tải bản vẽ vector.</p>
        <p style="font-size:12px; color:var(--danger);">${err.message}</p>
      </div>
    `;
    return null;
  }
}

async function initApp() {
  const [pCtrl, sCtrl] = await Promise.all([
    loadSvg(
      "valheim_master_site_plan.svg",
      "plan",
      "svg-container",
      "viewport-plan",
      2608,
      2258,
      true,
    ),
    loadSvg(
      "valheim_elevations_and_circulation.svg",
      "sections",
      "sec-container",
      "viewport-sections",
      2400,
      1750,
      false,
    ),
  ]);
  planController = pCtrl;
  sectionsController = sCtrl;
  updateHUD();
}

window.addEventListener("resize", () => {
  if (planController && planController.currentZoom <= 1.02)
    planController.fitView();
  if (sectionsController && sectionsController.currentZoom <= 1.02)
    sectionsController.fitView();
});

// Backward-compatible zoomPlan function
function zoomPlan(factor, reset = false) {
  zoomActiveTab(factor, reset);
}

// svgEl mousemove is registered via initPlanProbe once SVG loads

// ==================== INTERACTIVE 3D AXONOMETRIC RENDERER ====================
const canvas = document.getElementById("canvas3d");
const ctx = canvas.getContext("2d");
let camYaw = -0.65,
  camPitch = 0.55,
  camZoom = 4.2;
let isDragging = false,
  lastX = 0,
  lastY = 0,
  maxStage = 9;

const boxes3D = [
  // [x1, y1, z1, x2, y2, z2, fillColor, strokeColor, stage, isRoof, label]
  // Stage 1-2: Main Ground Platform & Harbor Basin
  [-44, -44, -2.0, 84, 72, 0.0, "#1e293b", "#475569", 1, false, ""],
  [
    -52,
    -76,
    -4.5,
    92,
    -44,
    -1.5,
    "#0c2538",
    "#2b6cb0",
    1,
    false,
    "Sea (-1.5m)",
  ],
  // Stage 3: Fixed 36x36m Elevated Plaza (+2.0m) & West Spa Terrace (+2.0m)
  [
    -4,
    -8,
    0.0,
    32,
    28,
    2.0,
    "#334155",
    "#ecc94b",
    3,
    false,
    "36×36m Plaza (+2m)",
  ],
  [-24, 0, 0.0, -4, 24, 2.0, "#2d2638", "#b794f4", 5, false, "Spa Court (+2m)"],
  // Existing Dreamhouse (X=0..24, Y=0..24, Basement 0..+4m, Walls +4..+12m, Roof +12..+28m)
  [
    0,
    0,
    0.0,
    24,
    24,
    4.0,
    "#3b1d2e",
    "#f687b3",
    1,
    false,
    "Dreamhouse Basement (+4m)",
  ],
  [
    0,
    0,
    4.0,
    24,
    24,
    12.0,
    "#4a192c",
    "#fbb6ce",
    1,
    false,
    "Dreamhouse (24×24m)",
  ],
  [2, 2, 12.0, 22, 22, 20.0, "#3b1d2e", "#f687b3", 1, true, ""],
  [
    6,
    6,
    20.0,
    18,
    18,
    28.0,
    "#551b33",
    "#fed7e2",
    1,
    true,
    "Dreamhouse Peak (+28m)",
  ],
  [8, 22, 4.0, 16, 25.5, 20.0, "#742a2a", "#feb2b2", 1, false, "Dual Chimney"],
  // Stage 4: Avenues & Wayfinder Obelisk
  [8, -44, 0.0, 16, -8, 0.2, "#475569", "#90cdf4", 4, false, "King's Way"],
  [10, -24, 0.0, 14, -20, 7.5, "#744210", "#f6e05e", 4, false, "Obelisk"],
  // Stage 5: Resting Extension & Skybridge (+4.0m) + Hot Tub
  [-4, 8, 4.0, 0, 16, 8.0, "#553c9a", "#d6bcfa", 5, false, "Skybridge (+4m)"],
  [-20, 8, 2.0, -4, 24, 4.0, "#322659", "#b794f4", 5, false, ""],
  [
    -20,
    8,
    4.0,
    -4,
    24,
    9.5,
    "#44337a",
    "#d6bcfa",
    5,
    false,
    "Resting Hall (+4m)",
  ],
  [-18, 10, 9.5, -6, 22, 16.0, "#322659", "#e9d8fd", 5, true, ""],
  [-11, 2, 2.0, -6, 6, 3.2, "#2b6cb0", "#bee3f8", 5, false, "Hot Tub"],
  // Stage 6: Harbor Quay, Ship, Warehouse & Breakwater Beacon
  [
    -8,
    -48,
    -1.5,
    28,
    -44,
    0.0,
    "#4a5568",
    "#ecc94b",
    6,
    false,
    "36m Main Quay",
  ],
  [
    -24,
    -44,
    0.0,
    -8,
    -36,
    5.5,
    "#2b4c65",
    "#63b3ed",
    6,
    false,
    "Harbor Warehouse",
  ],
  [-16, -72, -1.5, 20, -68, 1.0, "#334155", "#94a3b8", 6, false, "Breakwater"],
  [
    16,
    -72,
    1.0,
    20,
    -68,
    12.0,
    "#744210",
    "#f6e05e",
    6,
    false,
    "Beacon (+12m)",
  ],
  [
    1,
    -59,
    -1.5,
    23,
    -53,
    1.2,
    "#744210",
    "#f6ad55",
    6,
    false,
    "Longship / Drakkar",
  ],
  // Stage 7: Agriculture & Animal Husbandry
  [44, -28, -0.1, 56, -16, 0.2, "#22543d", "#68d391", 7, false, "Crop Plot B1"],
  [60, -28, -0.1, 72, -16, 0.2, "#22543d", "#68d391", 7, false, "Crop Plot B2"],
  [44, -12, -0.1, 56, 0, 0.2, "#22543d", "#68d391", 7, false, "Crop Plot B3"],
  [60, -12, -0.1, 72, 0, 0.2, "#276749", "#9ae6b4", 7, false, "Orchard B4"],
  [
    44,
    4,
    0.0,
    72,
    12,
    5.5,
    "#2f4f3e",
    "#9ae6b4",
    7,
    false,
    "Granary & Windmill",
  ],
  [63, 5, 5.5, 69, 11, 13.0, "#234e52", "#81e6d9", 7, false, "Windmill"],
  [
    74.5,
    -28,
    0.0,
    76,
    4,
    6.0,
    "#22543d",
    "#48bb78",
    7,
    false,
    "Vineberry Wall",
  ],
  [44, 28, 0.0, 56, 44, 5.5, "#5c3d2e", "#fbd38d", 7, false, "Boar & Hen Barn"],
  [
    60,
    28,
    -2.0,
    72,
    52,
    2.0,
    "#3d271d",
    "#ed8936",
    7,
    false,
    "Sunken Lox Pit (-2m)",
  ],
  // Stage 8: Perimeter Walls, Gatehouse & Bastions
  [4, 64, 0.0, 8, 74, 12.0, "#334155", "#f6ad55", 8, false, "N. Gatehouse"],
  [16, 64, 0.0, 20, 74, 12.0, "#334155", "#f6ad55", 8, false, ""],
  [8, 66, 4.0, 16, 72, 9.0, "#475569", "#f6e05e", 8, false, ""],
  [-44, -44, 0.0, -36, -36, 10.0, "#334155", "#f6ad55", 8, false, "SW Bastion"],
  [76, -44, 0.0, 84, -36, 10.0, "#334155", "#f6ad55", 8, false, "SE Bastion"],
  [-44, -36, 0.0, -42, 72, 3.0, "#475569", "#cbd5e1", 8, false, ""],
  [82, -36, 0.0, 84, 72, 3.0, "#475569", "#cbd5e1", 8, false, ""],
  [-44, 70, 0.0, 84, 72, 3.0, "#475569", "#cbd5e1", 8, false, ""],
  // Stage 9: Stone Portal Colonnade & Obliterator
  [
    -28,
    38,
    0.0,
    -8,
    48,
    5.5,
    "#1d4044",
    "#81e6d9",
    9,
    false,
    "Stone Portals (6×)",
  ],
  [-32, -30, 0.0, -22, -20, 4.0, "#2c3e50", "#4fd1c5", 9, false, "Obliterator"],
];

function resize3D() {
  const wrap = document.getElementById("canvas3d-wrap");
  if (!wrap || !canvas) return;
  const w = wrap.clientWidth || window.innerWidth - 320;
  const h = wrap.clientHeight || window.innerHeight - 60;
  canvas.width = Math.max(300, w);
  canvas.height = Math.max(300, h);
}
window.addEventListener("resize", () => {
  resize3D();
  draw3D();
});

function setCamera(yaw, pitch, zoom) {
  camYaw = yaw;
  camPitch = pitch;
  camZoom = zoom;
  draw3D();
}

function update3DStage(val) {
  maxStage = parseInt(val, 10);
  const names = [
    "",
    "Stage 1: Site Leveling & Existing Dreamhouse",
    "Stage 2: 4m Grausten Grid",
    "Stage 3: 36×36m Elevated Plaza (+2m)",
    "Stage 4: King's Way Avenue & Loop",
    "Stage 5: Resting Hall & +4m Skybridge",
    "Stage 6: Harbor Quay & Breakwater",
    "Stage 7: Agriculture & Animal Compounds",
    "Stage 8: Barbican Gatehouse & Walls",
    "All 9 Stages (Complete Base)",
  ];
  document.getElementById("stage-lbl").textContent = names[maxStage];
  draw3D();
}

function project3D(x, y, z) {
  const cx = x - 16,
    cy = y - 4,
    cz = z;
  const cosY = Math.cos(camYaw),
    sinY = Math.sin(camYaw);
  const rx = cx * cosY - cy * sinY;
  const ry = cx * sinY + cy * cosY;
  const cosP = Math.cos(camPitch),
    sinP = Math.sin(camPitch);
  const sx = canvas.width / 2 + rx * camZoom;
  const sy = canvas.height / 2 + (-ry * sinP - cz * cosP * 1.35) * camZoom;
  const depth = ry * cosP - cz * sinP;
  return [sx, sy, depth];
}

function draw3D() {
  if (!canvas.width) resize3D();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const showRoofs = document.getElementById("chk-roofs").checked;
  const showGrid = document.getElementById("chk-grid3d").checked;

  // Optional 4m Grausten Grid on Z=0
  if (showGrid) {
    ctx.strokeStyle = "rgba(100, 116, 139, 0.22)";
    ctx.lineWidth = 1;
    for (let gx = -44; gx <= 84; gx += 4) {
      const [x1, y1] = project3D(gx, -44, 0.05);
      const [x2, y2] = project3D(gx, 72, 0.05);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    for (let gy = -44; gy <= 72; gy += 4) {
      const [x1, y1] = project3D(-44, gy, 0.05);
      const [x2, y2] = project3D(84, gy, 0.05);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  // Sort boxes back-to-front by centroid depth
  const active = boxes3D.filter(
    (b) => b[8] <= maxStage && (showRoofs || !b[9]),
  );
  active.sort((a, b) => {
    const da = project3D(
      (a[0] + a[3]) / 2,
      (a[1] + a[4]) / 2,
      (a[2] + a[5]) / 2,
    )[2];
    const db = project3D(
      (b[0] + b[3]) / 2,
      (b[1] + b[4]) / 2,
      (b[2] + b[5]) / 2,
    )[2];
    return db - da;
  });

  for (const b of active) {
    const [x1, y1, z1, x2, y2, z2, fill, stroke, stg, isR, lbl] = b;
    const v = [
      project3D(x1, y1, z1),
      project3D(x2, y1, z1),
      project3D(x2, y2, z1),
      project3D(x1, y2, z1),
      project3D(x1, y1, z2),
      project3D(x2, y1, z2),
      project3D(x2, y2, z2),
      project3D(x1, y2, z2),
    ];
    const faces = [
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
      [4, 5, 6, 7],
    ];
    faces.sort((f1, f2) => {
      const d1 = (v[f1[0]][2] + v[f1[1]][2] + v[f1[2]][2] + v[f1[3]][2]) / 4;
      const d2 = (v[f2[0]][2] + v[f2[1]][2] + v[f2[2]][2] + v[f2[3]][2]) / 4;
      return d2 - d1;
    });
    for (const f of faces) {
      ctx.beginPath();
      ctx.moveTo(v[f[0]][0], v[f[0]][1]);
      ctx.lineTo(v[f[1]][0], v[f[1]][1]);
      ctx.lineTo(v[f[2]][0], v[f[2]][1]);
      ctx.lineTo(v[f[3]][0], v[f[3]][1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    if (lbl) {
      const [lx, ly] = project3D((x1 + x2) / 2, (y1 + y2) / 2, z2 + 1.2);
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "center";
      ctx.fillText(lbl, lx, ly);
    }
  }
}

canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener("mouseup", () => (isDragging = false));
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  camYaw += (e.clientX - lastX) * 0.008;
  camPitch = Math.max(
    0.15,
    Math.min(1.35, camPitch + (e.clientY - lastY) * 0.008),
  );
  lastX = e.clientX;
  lastY = e.clientY;
  draw3D();
});
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  camZoom = Math.max(2.0, Math.min(12.0, camZoom * (e.deltaY < 0 ? 1.1 : 0.9)));
  draw3D();
});

// Initialize 3D view once loaded
requestAnimationFrame(() => {
  resize3D();
  draw3D();
});

// Explicitly expose functions to window for HTML onclick attributes
window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;
window.toggleLayer = toggleLayer;
window.resetActiveFit = resetActiveFit;
window.zoomActiveTab = zoomActiveTab;
window.zoomPlan = zoomPlan;
window.setCamera = setCamera;
window.update3DStage = update3DStage;
window.draw3D = draw3D;
window.resize3D = resize3D;
window.initApp = initApp;

// Start application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

