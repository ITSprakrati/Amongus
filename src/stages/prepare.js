import gsap from 'gsap';
import { watchMarkingSchemeParsing } from '../utils/schemeParsing.js';

export function renderPrepareStage(container, state) {
  let stats = state?.data?.documentIntelligence || {
    ocrConfidence: '99.4%',
    pagesProcessed: 12
  };

  stats = { ...stats };
  if (state?.mode === 'real' && state?.realSession?.documents?.answerScripts?.[0]) {
    const script = state.realSession.documents.answerScripts[0];
    stats.pagesProcessed = script.pageCount || (script.pages ? script.pages.length : stats.pagesProcessed);
  }

  container.innerHTML = `
    <div class="h-full w-full flex flex-col md:flex-row gap-6 p-6 pointer-events-auto overflow-y-auto md:overflow-hidden">
      <!-- Left side panel -->
      <div class="w-full md:w-1/3 glass-panel p-6 flex flex-col h-auto md:h-full rounded-2xl shadow-sm bg-warm-ivory/80 backdrop-blur-md border border-white/50 shrink-0">
        <h2 class="text-2xl font-serif text-slate-ink mb-6">Document Intelligence Pipeline</h2>
        
        <div class="flex-1 overflow-y-auto pr-2 space-y-4" id="prepare-steps-container">
          <div class="prepare-step p-4 rounded-xl border border-warm-ivory/30 bg-white/60 shadow-sm opacity-0 transform translate-y-4">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse step-indicator"></div>
              <h3 class="font-bold text-slate-ink">OCR Processing</h3>
            </div>
            <p class="text-sm text-slate-ink/70">Extracting text from raw documents...</p>
          </div>
          
          <div class="prepare-step p-4 rounded-xl border border-warm-ivory/30 bg-white/60 shadow-sm opacity-0 transform translate-y-4">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse step-indicator"></div>
              <h3 class="font-bold text-slate-ink">Page Segmentation</h3>
            </div>
            <p class="text-sm text-slate-ink/70">Analyzing layout and structural elements...</p>
          </div>
          
          <div class="prepare-step p-4 rounded-xl border border-warm-ivory/30 bg-white/60 shadow-sm opacity-0 transform translate-y-4">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-2 h-2 rounded-full bg-purple-500 animate-pulse step-indicator"></div>
              <h3 class="font-bold text-slate-ink">Question Identification</h3>
            </div>
            <p class="text-sm text-slate-ink/70">Locating questions and semantic anchors...</p>
          </div>
          
          <div class="prepare-step p-4 rounded-xl border border-warm-ivory/30 bg-white/60 shadow-sm opacity-0 transform translate-y-4">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-2 h-2 rounded-full bg-teal-500 animate-pulse step-indicator"></div>
              <h3 class="font-bold text-slate-ink">Answer Region Detection</h3>
            </div>
            <p class="text-sm text-slate-ink/70">Mapping answer fields for grading pipeline...</p>
          </div>
        </div>
        
        <div class="mt-6 pt-4 border-t border-slate-ink/10">
          <h4 class="text-sm font-bold text-slate-ink/60 uppercase tracking-wider mb-3">Extracted Data</h4>
          <div class="grid grid-cols-2 gap-3" id="extracted-data-grid">
            <div class="bg-white/50 p-3 rounded-lg border border-white/60">
              <div class="text-xs text-slate-ink/70 mb-1">OCR Confidence</div>
              <div class="text-lg font-mono font-bold text-slate-ink ocr-val">PROCESSING...</div>
            </div>
            <div class="bg-white/50 p-3 rounded-lg border border-white/60">
              <div class="text-xs text-slate-ink/70 mb-1">Script Count</div>
              <div class="text-lg font-mono font-bold text-slate-ink scripts-val">...</div>
            </div>
          </div>
        </div>
        
        <div class="mt-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
          <svg class="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="text-sm text-slate-ink">
            <strong>Registrar Agent Active:</strong> Structuring and validating document segments for the evaluation pipeline.
          </div>
        </div>
        <div id="prepare-scheme-status" class="mt-4 hidden text-xs font-mono text-slate-ink/70 bg-white/50 border border-white/60 rounded-lg p-3"></div>
        <div id="prepare-ocr-status" class="mt-2 hidden text-xs font-mono text-slate-ink/70 bg-white/50 border border-white/60 rounded-lg p-3"></div>
        <div class="mt-6 hidden" id="prepare-continue-section">
          <button id="prepare-continue-btn" class="w-full py-3 px-4 bg-slate-ink text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-sm flex items-center justify-center gap-2 shadow-sm">
            Continue to Categorisation
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </div>
      </div>
      
      <!-- Right side content area -->
      <div class="flex-1 relative overflow-hidden flex flex-col pointer-events-none">
        
        <!-- Animated scanline overlay to simulate processing -->
        <div class="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/5 to-transparent h-32 w-full animate-scan" style="animation: scan 4s linear infinite;"></div>
      </div>
    </div>
  `;

  // Inject scan animation CSS if not present
  if (!document.getElementById('scan-animation-style')) {
    const style = document.createElement('style');
    style.id = 'scan-animation-style';
    style.textContent = `
      @keyframes scan {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(800px); }
      }
    `;
    document.head.appendChild(style);
  }

  // Honest marking-scheme parse outcome (real backend result; nothing inferred here).
  const schemeDoc = state?.realSession?.documents?.markingScheme;
  const schemeEl = container.querySelector('#prepare-scheme-status');
  if (state?.mode === 'real' && schemeDoc?.id && schemeEl) {
    schemeEl.classList.remove('hidden');
    watchMarkingSchemeParsing(schemeDoc.id, ({ text }) => { schemeEl.textContent = text; });
  }

  // Use GSAP to animate the progress steps
  const steps = container.querySelectorAll('.prepare-step');
  const continueSection = container.querySelector('#prepare-continue-section');
  const continueBtn = container.querySelector('#prepare-continue-btn');

  // Animation function for UI steps
  const animateSteps = (onComplete) => {
    if (window.gsap) {
      window.gsap.to(steps, {
        y: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.8,
        ease: 'power2.out',
        onComplete: onComplete
      });
    } else {
      steps.forEach((step, idx) => {
        setTimeout(() => {
          step.style.opacity = '1';
          step.style.transform = 'translateY(0)';
          step.style.transition = 'all 0.6s ease-out';
          if (idx === steps.length - 1) setTimeout(onComplete, 600);
        }, idx * 800);
      });
    }
  };

  const finalizeUI = async () => {
    steps.forEach(step => {
      const indicator = step.querySelector('.step-indicator');
      if (indicator) {
        indicator.classList.remove('animate-pulse');
        indicator.classList.replace('bg-blue-500', 'bg-green-500');
        indicator.classList.replace('bg-indigo-500', 'bg-green-500');
        indicator.classList.replace('bg-purple-500', 'bg-green-500');
        indicator.classList.replace('bg-teal-500', 'bg-green-500');
      }
    });
    
    // Fetch and show extracted data
    if (state?.mode === 'real') {
      try {
        const markingSchemeId = state?.realSession?.markingSchemeParsing?.assessment_id;
        const assessmentData = await window.EvalOS.apiClient.getAssessment(markingSchemeId);
        if (assessmentData.status === 'READY') {
          const grid = container.querySelector('#extracted-data-grid');
          if (grid) {
            grid.innerHTML += `
              <div class="bg-white/50 p-3 rounded-lg border border-emerald-500/30 col-span-2">
                <div class="text-xs text-emerald-700 font-bold mb-1">Subject Extracted</div>
                <div class="text-sm font-semibold text-slate-ink">${assessmentData.assessment.title}</div>
              </div>
              <div class="bg-white/50 p-3 rounded-lg border border-emerald-500/30">
                <div class="text-xs text-emerald-700 font-bold mb-1">Total Marks</div>
                <div class="text-lg font-mono font-bold text-slate-ink">${assessmentData.assessment.total_marks}</div>
              </div>
              <div class="bg-white/50 p-3 rounded-lg border border-emerald-500/30">
                <div class="text-xs text-emerald-700 font-bold mb-1">Questions</div>
                <div class="text-lg font-mono font-bold text-slate-ink">${assessmentData.questions.length}</div>
              </div>
            `;
            window.EvalOS.state.data = window.EvalOS.state.data || {};
            window.EvalOS.state.data.assessment = assessmentData.assessment;
            window.EvalOS.state.data.questions = assessmentData.questions;
          }
        }
      } catch (e) {
        console.error("Failed to load active assessment data", e);
      }
    }

    if (continueSection) {
      continueSection.classList.remove('hidden');
      if (window.gsap) gsap.fromTo(continueSection, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.2)' });
    }
    
    // Auto-advance after 2 seconds to fulfill user expectation
    setTimeout(() => {
      window.setStage(3);
    }, 2000);
  };

  if (state?.mode === 'real' && state?.realSession?.documents?.answerScripts?.[0]) {
    const docId = state.realSession.documents.answerScripts[0].id;
    let pollInterval;
    let pollStarted = Date.now();
    const POLL_TIMEOUT_MS = 30000; // 30s max wait

    // Populate static script count
    const scriptsVal = container.querySelector('.scripts-val');
    if (scriptsVal) scriptsVal.textContent = state.realSession.documents.answerScripts.length;

    // Show live processing status
    const ocrStatusEl = container.querySelector('#prepare-ocr-status');
    const showProcessingStatus = (msg, isError = false) => {
      if (!ocrStatusEl) return;
      ocrStatusEl.classList.remove('hidden');
      ocrStatusEl.textContent = msg;
      ocrStatusEl.className = `mt-2 text-xs font-mono rounded-lg p-3 border ${
        isError
          ? 'text-red-700 bg-red-50 border-red-200'
          : 'text-slate-ink/70 bg-white/50 border-white/60'
      }`;
    };

    showProcessingStatus('⏳ Waiting for backend OCR processing to complete…');

    const checkStatus = async () => {
      const elapsed = Date.now() - pollStarted;

      // Timeout fallback — show button with a warning so the user isn't stuck forever
      if (elapsed > POLL_TIMEOUT_MS) {
        clearInterval(pollInterval);
        showProcessingStatus('⚠️ Processing is taking longer than expected. You can continue, but AI categorisation data may be incomplete.', true);
        finalizeUI();
        return;
      }

      try {
        const statusResponse = await fetch(`${window.EvalOS.API_BASE_URL}/documents/status/${docId}`);
        if (!statusResponse.ok) {
          showProcessingStatus(`⚠️ Status check failed (HTTP ${statusResponse.status}). Retrying…`, true);
          return;
        }
        const data = await statusResponse.json();

        if (data.status === 'READY') {
          clearInterval(pollInterval);
          showProcessingStatus('✅ Document processing complete.');

          // Update stats dynamically from the backend result
          if (data.result_data?.stats) {
            const ocrStat = container.querySelector('.ocr-val');
            if (ocrStat) ocrStat.textContent = data.result_data.stats.ocrConfidence;
          }

          finalizeUI();
        } else if (data.status === 'FAILED') {
          clearInterval(pollInterval);
          const errDetail = data.result_data?.error || 'unknown error';
          showProcessingStatus(`❌ Backend processing failed: ${errDetail}. Check the uploaded PDF and try again.`, true);
          // Still show Continue — examiner can proceed manually
          finalizeUI();
        } else {
          // Still PROCESSING — show elapsed seconds so the user knows it's alive
          const secs = Math.round(elapsed / 1000);
          showProcessingStatus(`⏳ OCR in progress… (${secs}s)`);
        }
      } catch (e) {
        console.error('Polling error', e);
        showProcessingStatus(`⚠️ Network error while checking status: ${e.message}. Retrying…`, true);
      }
    };

    // Start UI animation; the Continue button appears only when polling resolves
    animateSteps(() => {
      // Animation done — still waiting for backend. Status indicator is already visible.
    });

    pollInterval = setInterval(checkStatus, 1500);
    checkStatus(); // Immediate first check (often already READY in lite/eager mode)
  } else {
    // Demo mode or no answer scripts uploaded: animate steps and show Continue right away
    animateSteps(finalizeUI);
  }

  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      window.setStage(3);
    });
  }
}
