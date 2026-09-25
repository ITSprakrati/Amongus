import { DEMO_STATE } from './data/demoState.js';
import { init3DEngine } from './3d/engine.js';
import { SceneController } from './3d/scenes.js';
import { GuidedDemoController } from './features/guidedDemo.js';
import gsap from 'gsap';

// UI Stages
import { renderUploadStage } from './stages/upload.js';
import { renderPrepareStage } from './stages/prepare.js';
import { renderCategoriseStage } from './stages/categorise.js';
import { renderExaminerStage } from './stages/examiner.js';
import { renderSubmitStage } from './stages/submit.js';
import { renderVerifyStage } from './stages/verify.js';
import { renderModerationStage } from './stages/moderation.js';
import { renderResultStage } from './stages/result.js';
import { renderAnalyticsStage } from './stages/analytics.js';
import { apiClient, API_BASE_URL } from './api/client.js';

// Core State Management
window.EvalOS = {
  apiClient: apiClient,
  API_BASE_URL: API_BASE_URL,
  state: {
    currentStage: 1,
    mode: 'real', // 'real' or 'demo'
    realSession: {
      documents: {
        answerScripts: [], // Array of { file, name, size, pages, renderedCanvases }
        markingScheme: null,
        assessmentStructure: null
      },
      processing: { status: 'idle', progress: 0 }
    },
    demoMode: true, // Keep for backward compatibility during transition if needed
    data: JSON.parse(JSON.stringify(DEMO_STATE)),
    activeAssessmentType: 'University Examination'
  },
  engine: null,
  sceneController: null,
  ui: null,
  demoController: null,
  
  // State Mutations
  updateMark(questionId, mark) {
    const candidate = this.state.data.candidates[0]; // Active candidate in demo
    candidate.marks[questionId] = mark;
    // Mark as checked in leaves
    const leaf = candidate.leaves.find(l => l.questions.includes(parseInt(questionId)));
    if (leaf) leaf.status = 'CHECKED';

    // Single source of truth for downstream stages (verify.js, result.js): both
    // read this top-level Q0N-keyed map. Previously those stages read from here
    // while updateMark only wrote to candidate.marks, so real marks never reached
    // verification/results — this keeps both in sync.
    this.state.data.marks = this.state.data.marks || {};
    const key = `Q${String(questionId).padStart(2, '0')}`;
    this.state.data.marks[key] = mark;
  },
  
  resetState() {
    this.state.data = JSON.parse(JSON.stringify(DEMO_STATE));
    this.state.activeAssessmentType = 'University Examination';
    this.state.currentStage = 1;
    setStage(1);
  },
  
  setAssessmentType(type) {
    this.state.activeAssessmentType = type;
    buildUIShell(); // Rebuild shell to update tabs
    setStage(this.state.currentStage); // Re-render active stage
  }
};

// Workflow Stages Definition
const STAGES = {
  1: { id: 'upload', name: 'Upload & Configure', render: renderUploadStage },
  2: { id: 'prepare', name: 'AI Prepare', render: renderPrepareStage },
  3: { id: 'categorise', name: 'AI Categorise', render: renderCategoriseStage },
  4: { id: 'examiner', name: 'Human Check', render: renderExaminerStage },
  5: { id: 'submit', name: 'Submit Checked Copy', render: renderSubmitStage },
  6: { id: 'verify', name: 'AI Post-Verify', render: renderVerifyStage },
  7: { id: 'moderation', name: 'Moderation', render: renderModerationStage },
  8: { id: 'result', name: 'Result Ready', render: renderResultStage },
  9: { id: 'analytics', name: 'Analytics & Learning', render: renderAnalyticsStage }
};

// Initialize the Application
async function init() {
  console.log('EvalOS Initializing...');
  
  // 1. Initialize 3D Engine
  const container = document.getElementById('three-canvas-container');
  if (container) {
    window.EvalOS.engine = init3DEngine(container);
    window.EvalOS.sceneController = new SceneController(window.EvalOS.engine);
  } else {
    console.warn('Three.js container not found');
  }

  // 2. Build Core UI Shell
  buildUIShell();

  // 3. Initialize Guided Demo
  // Demo is user-initiated — not auto-opened
  // User clicks 'Start Demo' button in header to begin

  // 4. Set Initial Stage
  setStage(1);

  // 5. Setup Event Listeners
  setupEventListeners();
}

function buildUIShell() {
  const uiLayer = document.getElementById('ui-layer');
  if (!uiLayer) return;
  uiLayer.innerHTML = ''; // Clear for rebuilding

  const institutionName = window.EvalOS.state.data?.institution?.name || '';

  // Header Chrome
  const header = document.createElement('header');
  header.className = 'fixed top-0 left-0 w-full h-16 flex items-center justify-between px-6 pointer-events-auto z-50 glass-panel border-b border-slateink/5';
  header.innerHTML = `
    <div class="flex items-center gap-4">
      <div class="w-8 h-8 rounded-full bg-slateink flex items-center justify-center text-ivory font-serif font-bold text-xl">A+</div>
      <span class="font-serif text-xl text-slateink tracking-tight">EvalOS</span>
    </div>
    
    <!-- Active System Role HUD (Registrar, Assessor, Proctor, Auditor, Archivist) -->
    <div id="header-role-hud" class="flex items-center gap-2 px-3 py-1.5 bg-white/90 border border-slateink/10 rounded-full shadow-xs">
      <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" id="role-hud-dot"></span>
      <span class="text-xs font-mono font-bold text-slateink uppercase tracking-wider" id="role-hud-title">REGISTRAR</span>
      <span class="text-slateink/30 text-xs font-mono">•</span>
      <span class="text-xs font-sans text-slateink/70 hidden sm:inline" id="role-hud-desc">Intake & Assessment Config</span>
    </div>

    <div class="flex items-center gap-3">
      <div id="header-institution-label" class="hidden md:flex p-1 px-3 text-xs font-mono text-slateink/70 bg-slateink/5 rounded-lg border border-slateink/10">
        ${institutionName ? institutionName + ' Evaluation' : 'CBSE Evaluation'}
      </div>
      <div class="w-8 h-8 rounded-full bg-slateink/10 flex items-center justify-center text-slateink">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      </div>
    </div>
  `;

  uiLayer.appendChild(header);

  // Start Demo button removed per user request

  // Bottom Workflow Bar
  const footer = document.createElement('footer');
  footer.className = 'fixed bottom-2 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 rounded-2xl sm:rounded-full glass-card pointer-events-auto z-50 workflow-bar shadow-xl border border-slateink/5';
  
  Object.entries(STAGES).forEach(([num, stage]) => {
    const btn = document.createElement('button');
    btn.className = `workflow-step relative w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm transition-all duration-300`;
    btn.dataset.stage = num;
    btn.innerHTML = `<div>0${num}</div>`;
    btn.title = stage.name;
    
    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'absolute -top-12 bg-slateink text-ivory text-xs px-3 py-1.5 rounded-md whitespace-nowrap opacity-0 pointer-events-none transition-opacity duration-200 flex flex-col items-center shadow-lg';
    tooltip.innerHTML = `${stage.name}<div class="w-2 h-2 bg-slateink rotate-45 absolute -bottom-1"></div>`;
    btn.appendChild(tooltip);
    
    btn.addEventListener('mouseenter', () => tooltip.classList.remove('opacity-0'));
    btn.addEventListener('mouseleave', () => tooltip.classList.add('opacity-0'));
    
    btn.addEventListener('click', () => setStage(parseInt(num)));
    footer.appendChild(btn);
  });

  // Main Content Container for Stages
  const stageContainer = document.createElement('main');
  stageContainer.id = 'stage-container';
  stageContainer.className = 'fixed inset-0 pt-16 pb-24 px-2 sm:px-6 pointer-events-none z-40 flex flex-col overflow-y-auto';

  uiLayer.appendChild(header);
  uiLayer.appendChild(stageContainer);
  uiLayer.appendChild(footer);
}

// Attach setStage globally for custom events
window.setStage = setStage;

function setStage(stageNum) {
  if (!STAGES[stageNum]) return;
  
  window.EvalOS.state.currentStage = stageNum;
  
  // Update Workflow Bar
  document.querySelectorAll('.workflow-step').forEach(btn => {
    const num = parseInt(btn.dataset.stage);
    const div = btn.querySelector('div:first-child');
    if (num === stageNum) {
      btn.className = 'workflow-step relative w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm transition-all duration-300 bg-slateink text-ivory scale-110 shadow-lg';
      div.innerHTML = `0${num}`;
    } else if (num < stageNum) {
      // Completed
      btn.className = 'workflow-step relative w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm transition-all duration-300 bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/20';
      div.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
      // Pending
      btn.className = 'workflow-step relative w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm transition-all duration-300 bg-transparent text-slateink/50 hover:bg-slateink/10 hover:text-slateink';
    }
  });

  // Dynamic Role HUD Update (5 Autonomous Agents + Human Examiner)
  const roleMap = {
    1: { role: 'REGISTRAR', desc: 'Intake, Assessment Config & Marking Scheme', color: '#ffbf00' },
    2: { role: 'ASSESSOR', desc: 'Document Understanding & Answer Preparation', color: '#ff6600' },
    3: { role: 'ASSESSOR', desc: 'AI Copy Categorisation & Rubric Matching', color: '#ff6600' },
    4: { role: 'HUMAN EXAMINER', desc: 'Actual Academic Evaluation & Final Mark', color: '#2563eb' },
    5: { role: 'PROCTOR', desc: 'Checked Copy Re-Upload & QA Gate', color: '#059669' },
    6: { role: 'PROCTOR', desc: 'Post-Evaluation Verification & Integrity Checks', color: '#059669' },
    7: { role: 'ARCHIVIST', desc: 'Moderation Knowledge & Institutional Learning', color: '#0284c7' },
    8: { role: 'AUDITOR', desc: 'Certified Results Publication & Verification', color: '#dc2626' },
    9: { role: 'AUDITOR', desc: 'Analytics, Anomalies & Review Signals', color: '#dc2626' },
  };
  const roleInfo = roleMap[stageNum] || roleMap[1];
  const hudTitle = document.getElementById('role-hud-title');
  const hudDesc = document.getElementById('role-hud-desc');
  const hudDot = document.getElementById('role-hud-dot');
  if (hudTitle) hudTitle.textContent = roleInfo.role;
  if (hudDesc) hudDesc.textContent = roleInfo.desc;
  if (hudDot) hudDot.style.backgroundColor = roleInfo.color;

  // Clear current stage UI
  const stageContainer = document.getElementById('stage-container');
  if (stageContainer) {
    if (stageContainer.children.length > 0) {
      gsap.to(stageContainer.children, {
        opacity: 0,
        y: 10,
        duration: 0.3,
        stagger: 0.05,
        onComplete: () => {
          stageContainer.innerHTML = '';
          renderStageUI(stageNum, stageContainer);
        }
      });
    } else {
      renderStageUI(stageNum, stageContainer);
    }
  }

  // Trigger 3D Scene Transition
  if (window.EvalOS.sceneController) {
    window.EvalOS.sceneController.transitionToStage(stageNum);
  }
}

function renderStageUI(stageNum, container) {
  const stageData = STAGES[stageNum];
  
  if (stageData.render) {
    try {
        stageData.render(container, window.EvalOS.state);
        // Animate elements in if they have opacity-0 class
        gsap.to(container.querySelectorAll('.opacity-0'), {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.1,
            ease: "power2.out"
        });
    } catch (e) {
        console.error(`Error rendering stage ${stageNum}:`, e);
    }
  } else {
    // Fallback placeholder
    const header = document.createElement('div');
    header.className = 'flex flex-col items-center mt-8 pointer-events-auto opacity-0 translate-y-4';
    header.innerHTML = `
      <div class="text-label-xs text-slateink/50 tracking-[0.2em] uppercase mb-2">STAGE 0${stageNum}</div>
      <h1 class="text-headline-lg text-slateink">${stageData.name}</h1>
    `;
    container.appendChild(header);

    const content = document.createElement('div');
    content.className = 'flex-1 mt-8 pointer-events-auto opacity-0 translate-y-4 flex items-center justify-center';
    content.innerHTML = `<div class="glass-card p-12 text-center max-w-2xl border border-slateink/10 shadow-xl bg-ivory/80 backdrop-blur-md rounded-2xl">
      <h2 class="text-title-md text-slateink mb-4">Implementation in Progress</h2>
      <p class="text-body-md text-slateink/70">The detailed UI for ${stageData.name} is being built.</p>
    </div>`;
    container.appendChild(content);

    gsap.to(container.children, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: "power2.out"
    });
  }
}

function setupEventListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && window.EvalOS.state.currentStage < 9) {
      setStage(window.EvalOS.state.currentStage + 1);
    } else if (e.key === 'ArrowLeft' && window.EvalOS.state.currentStage > 1) {
      setStage(window.EvalOS.state.currentStage - 1);
    }
  });

  // Listen for custom events from demo controller or other modules
  document.addEventListener('evalos:setStage', (e) => {
    if (e.detail && e.detail.stage) {
      setStage(e.detail.stage);
    }
  });
}

// Boot
document.addEventListener('DOMContentLoaded', init);
