/* ============================================================
   SIMULADOR SIR — script.js  (Rediseño Médico Universitario)
   Autores: Yeimar Joshep Bernal Zea · Sofía Velandia Rodríguez
            · Thomas Cruz Vanegas
   Curso:   Ecuaciones Diferenciales C-502105-4-1S-2026
   Docente: Nixon Andrés Meneses Marentes
   ─────────────────────────────────────────────────────────────
   Contenido:
     1. Parámetros y estado global
     2. Solver Runge-Kutta 4 para el sistema SIR
     3. Gráfica con Chart.js (tema claro médico)
     4. Simulación de agentes / partículas
     5. Actualización de indicadores R₀ y KPIs
     6. Eventos de sliders
     7. Reinicio
     8. Arranque (DOMContentLoaded)
============================================================ */

'use strict';

/* ══════════════════════════════════════════════
   1. PARÁMETROS GLOBALES
══════════════════════════════════════════════ */

/**
 * Parámetros actuales del modelo SIR.
 * Se actualizan al mover cualquier slider.
 */
const PARAMS = {
  beta:  0.30,   // β: tasa de contagio (contactos efectivos/día)
  gamma: 0.10,   // γ: tasa de recuperación (fracción/día)
  N:     1000,   // Población total (constante)
  I0:    10,     // Infectados iniciales
};

const T_MAX = 160;  // Días de simulación
const DT    = 0.5;  // Paso de integración (días)

/* ══════════════════════════════════════════════
   2. SOLVER RUNGE-KUTTA 4
══════════════════════════════════════════════ */

/**
 * Derivadas del sistema SIR:
 *   dS/dt = -β·S·I/N
 *   dI/dt =  β·S·I/N - γ·I
 *   dR/dt =  γ·I
 */
function sirDerivatives(S, I, R, beta, gamma, N) {
  const newInfections = beta * S * I / N;
  return {
    dS: -newInfections,
    dI:  newInfections - gamma * I,
    dR:  gamma * I,
  };
}

/**
 * Un paso Runge-Kutta 4.
 * Combina cuatro estimaciones de pendiente para mayor precisión.
 */
function rk4Step(S, I, R, dt, beta, gamma, N) {
  const k1 = sirDerivatives(S, I, R, beta, gamma, N);
  const k2 = sirDerivatives(S + k1.dS*dt/2, I + k1.dI*dt/2, R + k1.dR*dt/2, beta, gamma, N);
  const k3 = sirDerivatives(S + k2.dS*dt/2, I + k2.dI*dt/2, R + k2.dR*dt/2, beta, gamma, N);
  const k4 = sirDerivatives(S + k3.dS*dt,   I + k3.dI*dt,   R + k3.dR*dt,   beta, gamma, N);

  return {
    S: S + dt * (k1.dS + 2*k2.dS + 2*k3.dS + k4.dS) / 6,
    I: I + dt * (k1.dI + 2*k2.dI + 2*k3.dI + k4.dI) / 6,
    R: R + dt * (k1.dR + 2*k2.dR + 2*k3.dR + k4.dR) / 6,
  };
}

/**
 * Resuelve el modelo SIR completo de t=0 a T_MAX.
 * @returns {{ times, S, I, R }}
 */
function solveSIR() {
  const times = [], Sarr = [], Iarr = [], Rarr = [];

  let S = PARAMS.N - PARAMS.I0;
  let I = PARAMS.I0;
  let R = 0;

  for (let t = 0; t <= T_MAX; t += DT) {
    times.push(parseFloat(t.toFixed(2)));
    Sarr.push(S);
    Iarr.push(I);
    Rarr.push(R);

    const next = rk4Step(S, I, R, DT, PARAMS.beta, PARAMS.gamma, PARAMS.N);
    S = Math.max(0, next.S);
    I = Math.max(0, next.I);
    R = Math.max(0, next.R);
  }

  return { times, S: Sarr, I: Iarr, R: Rarr };
}

/* ══════════════════════════════════════════════
   3. GRÁFICA CHART.JS — TEMA CLARO MÉDICO
══════════════════════════════════════════════ */

let sirChart = null;

/**
 * Opciones comunes de la gráfica para el tema claro médico.
 */
function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350, easing: 'easeInOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        titleColor: '#64748b',
        bodyColor: '#0f172a',
        titleFont:  { family: 'DM Mono, monospace', size: 11 },
        bodyFont:   { family: 'DM Mono, monospace', size: 11 },
        padding: 10,
        boxPadding: 4,
        callbacks: {
          label: ctx => `  ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8',
          font: { family: 'DM Mono, monospace', size: 10 },
          maxTicksLimit: 12,
        },
        grid: { color: '#f1f5f9' },
        border: { color: '#e2e8f0' },
        title: {
          display: true, text: 'Días (t)',
          color: '#94a3b8', font: { family: 'DM Mono, monospace', size: 11 },
        },
      },
      y: {
        ticks: {
          color: '#94a3b8',
          font: { family: 'DM Mono, monospace', size: 10 },
          callback: v => Math.round(v).toLocaleString(),
        },
        grid: { color: '#f1f5f9' },
        border: { color: '#e2e8f0' },
        title: {
          display: true, text: 'Individuos',
          color: '#94a3b8', font: { family: 'DM Mono, monospace', size: 11 },
        },
        min: 0,
      },
    },
  };
}

/**
 * Inicializa la gráfica SIR con Chart.js.
 */
function initChart(data) {
  const ctx = document.getElementById('sirChart').getContext('2d');

  sirChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.times,
      datasets: [
        {
          label: 'Susceptibles S(t)',
          data: data.S,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.05)',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Infectados I(t)',
          data: data.I,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220,38,38,0.06)',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Recuperados R(t)',
          data: data.R,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22,163,74,0.05)',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: chartOptions(),
  });
}

/** Actualiza los datos sin recrear el chart. */
function updateChart(data) {
  if (!sirChart) return;
  sirChart.data.labels           = data.times;
  sirChart.data.datasets[0].data = data.S;
  sirChart.data.datasets[1].data = data.I;
  sirChart.data.datasets[2].data = data.R;
  sirChart.update();
}

/* ══════════════════════════════════════════════
   4. SIMULACIÓN DE AGENTES (PARTÍCULAS)
══════════════════════════════════════════════ */

const SIM = {
  canvas: null,
  ctx: null,
  particles: [],
  animId: null,
  data: null,
  step: 0,
  COUNT: 110,        // Número de agentes visuales
  frameSkip: 0,
  FRAMES_PER_STEP: 2,
};

/**
 * Crea los agentes con posiciones y velocidades aleatorias.
 * La proporción inicial S/I se escala de PARAMS.
 */
function createParticles() {
  const c   = SIM.COUNT;
  const nI  = Math.max(1, Math.round(PARAMS.I0 / PARAMS.N * c));
  SIM.particles = Array.from({ length: c }, (_, i) => ({
    x:  Math.random() * SIM.canvas.width,
    y:  Math.random() * SIM.canvas.height,
    vx: (Math.random() - 0.5) * 1.1,
    vy: (Math.random() - 0.5) * 1.1,
    r:  3.5,
    state: i < nI ? 'I' : 'S',
  }));
}

/**
 * Actualiza los estados de las partículas según las proporciones
 * S/I/R calculadas por el solver para el paso de tiempo actual.
 */
function updateParticles() {
  const { data, step, COUNT } = SIM;
  if (!data || step >= data.times.length) return;

  const targetI = Math.round(data.I[step] / PARAMS.N * COUNT);
  const targetS = Math.round(data.S[step] / PARAMS.N * COUNT);

  let curI = SIM.particles.filter(p => p.state === 'I').length;
  let curS = SIM.particles.filter(p => p.state === 'S').length;

  // Transición S → I
  for (const p of SIM.particles) {
    if (curI >= targetI) break;
    if (p.state === 'S') { p.state = 'I'; curI++; curS--; }
  }
  // Transición I → R
  for (const p of SIM.particles) {
    if (curS <= targetS) break;
    if (p.state === 'I') { p.state = 'R'; curS--; }
  }

  // Mover y rebotar
  const w = SIM.canvas.width, h = SIM.canvas.height;
  for (const p of SIM.particles) {
    p.x += p.vx;  p.y += p.vy;
    if (p.x < p.r || p.x > w - p.r) p.vx *= -1;
    if (p.y < p.r || p.y > h - p.r) p.vy *= -1;
  }

  // Actualizar contadores en el DOM
  document.getElementById('statS').textContent = Math.round(data.S[step]).toLocaleString();
  document.getElementById('statI').textContent = Math.round(data.I[step]).toLocaleString();
  document.getElementById('statR').textContent = Math.round(data.R[step]).toLocaleString();

  // KPIs de la banda superior
  document.getElementById('kpiS').textContent = Math.round(data.S[step]).toLocaleString();
  document.getElementById('kpiI').textContent = Math.round(data.I[step]).toLocaleString();
  document.getElementById('kpiR').textContent = Math.round(data.R[step]).toLocaleString();

  // Barra de progreso
  const pct = step / (data.times.length - 1) * 100;
  document.getElementById('timeBar').style.width   = pct + '%';
  document.getElementById('timeLabel').textContent = `t = ${Math.round(data.times[step])} días`;
}

/**
 * Dibuja las partículas sobre el canvas con colores médicos limpios.
 * Fondo claro, puntos sólidos pequeños con halo suave.
 */
function drawParticles() {
  const { canvas, ctx, particles } = SIM;

  // Efecto de estela muy sutil sobre fondo claro
  ctx.fillStyle = 'rgba(248, 250, 252, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const colors = { S: '#2563eb', I: '#dc2626', R: '#16a34a' };
  const glows  = { S: 'rgba(37,99,235,0.18)', I: 'rgba(220,38,38,0.18)', R: 'rgba(22,163,74,0.18)' };

  for (const p of particles) {
    // Halo
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2.8, 0, Math.PI * 2);
    ctx.fillStyle = glows[p.state];
    ctx.fill();
    // Punto sólido
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = colors[p.state];
    ctx.fill();
  }
}

/** Bucle de animación principal. */
function animLoop() {
  SIM.frameSkip++;
  if (SIM.frameSkip >= SIM.FRAMES_PER_STEP) {
    SIM.frameSkip = 0;
    SIM.step = (SIM.step < SIM.data.times.length - 1) ? SIM.step + 1 : 0;
    updateParticles();
  }
  drawParticles();
  SIM.animId = requestAnimationFrame(animLoop);
}

/** Inicializa el canvas y arranca la simulación. */
function initParticleSim(data) {
  SIM.canvas = document.getElementById('particleCanvas');
  SIM.ctx    = SIM.canvas.getContext('2d');
  SIM.data   = data;
  SIM.step   = 0;
  resizeCanvas();
  createParticles();
  animLoop();
}

/** Reinicia la simulación de agentes con nuevos datos. */
function resetParticleSim(data) {
  if (SIM.animId) { cancelAnimationFrame(SIM.animId); SIM.animId = null; }
  SIM.data  = data;
  SIM.step  = 0;
  resizeCanvas();
  createParticles();
  animLoop();
}

/** Ajusta las dimensiones internas del canvas al tamaño CSS. */
function resizeCanvas() {
  if (!SIM.canvas) return;
  const rect = SIM.canvas.getBoundingClientRect();
  SIM.canvas.width  = rect.width  || 600;
  SIM.canvas.height = rect.height || 200;
}

/* ══════════════════════════════════════════════
   5. INDICADORES R₀ Y KPIs
══════════════════════════════════════════════ */

/**
 * Recalcula R₀ = β/γ y actualiza todos los elementos del DOM
 * relacionados: valor numérico, badge de estado, panel lateral.
 */
function updateR0() {
  const r0 = PARAMS.beta / PARAMS.gamma;
  const r0Str = r0.toFixed(2);

  // Panel y KPI superior
  document.getElementById('kpiR0').textContent     = r0Str;
  document.getElementById('r0NumPanel').textContent = r0Str;

  let cls, label;
  if      (r0 < 1)   { cls = 'r0-controlled'; label = 'Controlado'; }
  else if (r0 < 1.5) { cls = 'r0-endemic';    label = 'Endemia';    }
  else               { cls = 'r0-epidemic';    label = 'Epidemia';   }

  const badgeKPI   = document.getElementById('kpiBadge');
  const badgePanel = document.getElementById('r0BadgePanel');

  [badgeKPI, badgePanel].forEach(el => {
    el.textContent = label;
    el.className   = 'r0-badge ' + cls;
  });
}

/* ══════════════════════════════════════════════
   6. SLIDERS — LECTURA Y EVENTOS
══════════════════════════════════════════════ */

/** Lee los valores actuales de todos los sliders y actualiza PARAMS. */
function readSliders() {
  PARAMS.beta  = parseFloat(document.getElementById('betaSlider').value);
  PARAMS.gamma = parseFloat(document.getElementById('gammaSlider').value);
  PARAMS.N     = parseInt(document.getElementById('popSlider').value, 10);
  PARAMS.I0    = parseInt(document.getElementById('infSlider').value, 10);
  if (PARAMS.I0 >= PARAMS.N) PARAMS.I0 = Math.max(1, PARAMS.N - 1);
}

/** Actualiza los badges de valor junto a cada slider. */
function updateDisplays() {
  document.getElementById('betaVal').textContent  = PARAMS.beta.toFixed(2);
  document.getElementById('gammaVal').textContent = PARAMS.gamma.toFixed(2);
  document.getElementById('popVal').textContent   = PARAMS.N.toLocaleString();
  document.getElementById('infVal').textContent   = PARAMS.I0;
}

/**
 * Función principal de actualización.
 * Lee sliders → actualiza displays → recalcula SIR → actualiza todo.
 */
function onParamChange() {
  readSliders();
  updateDisplays();
  updateR0();
  const data = solveSIR();
  updateChart(data);
  resetParticleSim(data);
}

/** Conecta el evento 'input' a cada slider. */
function bindSliders() {
  ['betaSlider', 'gammaSlider', 'popSlider', 'infSlider'].forEach(id => {
    document.getElementById(id).addEventListener('input', onParamChange);
  });
}

/* ══════════════════════════════════════════════
   7. REINICIO
══════════════════════════════════════════════ */

/** Restaura todos los sliders a sus valores por defecto y recalcula. */
function resetSimulation() {
  document.getElementById('betaSlider').value  = '0.30';
  document.getElementById('gammaSlider').value = '0.10';
  document.getElementById('popSlider').value   = '1000';
  document.getElementById('infSlider').value   = '10';
  onParamChange();
}

/* ══════════════════════════════════════════════
   8. ARRANQUE
══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // Leer estado inicial de los sliders
  readSliders();
  updateDisplays();
  updateR0();

  // Resolver el modelo por primera vez
  const data = solveSIR();

  // Inicializar gráfica
  initChart(data);

  // Inicializar simulación de agentes (delay para que el canvas tenga dimensiones CSS)
  setTimeout(() => initParticleSim(data), 120);

  // Conectar sliders
  bindSliders();

  // Botón de reinicio
  document.getElementById('resetBtn').addEventListener('click', resetSimulation);

  // Redimensionar canvas al cambiar tamaño de ventana
  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  console.log('%c🏥 Simulador SIR Médico · Cargado correctamente', 'color:#1d6fce;font-family:DM Mono,monospace;font-size:13px;');
  console.log('%cEcuaciones Diferenciales C-502105-4-1S-2026 · Nixon Andrés Meneses Marentes', 'color:#94a3b8;font-family:DM Mono,monospace;font-size:11px;');
});
