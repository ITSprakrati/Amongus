import { gsap } from 'gsap';

export function renderModerationStage(container, state) {
  const signals = state.verificationResult?.signals || [];
  const hasCases = signals.length > 0;
  
  if (!hasCases) {
    container.innerHTML = `
      <div class="h-full flex items-center justify-center p-8 bg-[#FAF8F5]/30 pointer-events-auto">
        <div class="w-full max-w-3xl p-12 rounded-2xl shadow-sm flex flex-col items-center gap-6 bg-white/80 backdrop-blur-md border border-gray-200">
          <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 class="text-2xl font-serif text-[#1E242B]">No Pending Cases</h2>
          <p class="text-slate-500 font-mono">The evaluation passed integrity checks automatically.</p>
          <button id="resolve-btn" class="mt-4 px-8 py-4 bg-[#1E242B] text-[#FAF8F5] rounded-lg shadow font-medium">Continue to Results</button>
        </div>
      </div>
    `;
    const btn = container.querySelector('#resolve-btn');
    if (btn) btn.addEventListener('click', () => window.setStage(8));
    return;
  }

  const primarySignal = signals[0];
  const evalId = state.mode === 'real'
    ? (window.EvalOS.state.realSession?.evaluationId || 'unknown')
    : (state.realSession?.documents?.answerScripts?.[0]?.id || "eval-000");

  container.innerHTML = `
    <div class="h-full flex items-center justify-center p-8 bg-[#FAF8F5]/30 pointer-events-auto">
      <div class="w-full max-w-3xl p-8 rounded-2xl shadow-xl flex flex-col gap-6 bg-white/80 backdrop-blur-md border border-gray-200" id="moderation-panel">
        
        <header class="border-b border-gray-200 pb-4">
          <h2 class="text-3xl font-serif text-[#1E242B]">Senior Moderator Workspace</h2>
          <p class="text-sm text-slate-500 font-mono mt-2">EVAL ID: ${evalId} &bull; URGENT RESOLUTION REQUIRED</p>
        </header>

        <div class="bg-red-50 border border-red-100 rounded-xl p-6" id="case-details">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-red-700 font-bold font-mono">!</div>
            <h3 class="text-xl font-semibold text-[#1E242B]">${primarySignal.type || 'Integrity Discrepancy Detected'}</h3>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono text-slate-700 mb-4">
            <div class="bg-white/60 p-3 rounded border border-red-100/50">
              <span class="text-slate-500 block text-xs uppercase tracking-wider mb-1">Trigger</span> 
              <span class="font-medium text-[#1E242B]">${primarySignal.question || 'System Check'}</span>
            </div>
            <div class="bg-white/60 p-3 rounded border border-red-100/50">
              <span class="text-slate-500 block text-xs uppercase tracking-wider mb-1">Evaluator</span> 
              <span class="font-medium text-[#1E242B]">Automated Verification</span>
            </div>
          </div>
          
          <div class="mt-2 text-[#1E242B] bg-white/80 p-4 rounded-lg border border-red-200 shadow-sm">
            <span class="font-bold text-red-800 uppercase text-xs tracking-wider block mb-1">Reason for Flag:</span> 
            <p class="font-serif text-lg">${primarySignal.message || primarySignal.detail || 'Discrepancy requires manual review.'}</p>
          </div>
        </div>

        <div id="resolution-area" class="flex flex-col gap-4 py-4">
          <p class="text-sm font-mono text-slate-ink/70 text-center mb-1">Select a resolution decision:</p>
          <div class="flex gap-3 justify-center flex-wrap">
            <button data-decision="APPROVED" id="btn-approve" class="decision-btn px-6 py-3 bg-emerald-700 text-white rounded-lg shadow font-medium hover:opacity-90 transition-all flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Approve Marking
            </button>
            <button data-decision="REJECTED" id="btn-reject" class="decision-btn px-6 py-3 bg-rose-700 text-white rounded-lg shadow font-medium hover:opacity-90 transition-all flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              Reject Marking
            </button>
            <button data-decision="AMENDED" id="btn-amend" class="decision-btn px-6 py-3 bg-amber-600 text-white rounded-lg shadow font-medium hover:opacity-90 transition-all flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              Amend Score
            </button>
          </div>
          <div id="amend-score-area" class="hidden flex-col items-center gap-2 mt-2">
            <label class="text-xs font-mono text-slate-ink/70">Enter corrected total score:</label>
            <input id="amend-score-input" type="number" min="0" class="border border-slate-300 rounded px-3 py-2 text-slate-ink text-center w-32 font-mono text-lg" placeholder="0" />
            <button id="btn-confirm-amend" class="mt-1 px-6 py-2 bg-amber-600 text-white rounded-lg font-medium hover:opacity-90 transition-all">Confirm Amendment</button>
          </div>
        </div>

        <div id="success-state" class="hidden bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h3 class="text-2xl font-serif text-[#1E242B] mb-3">Resolution Successful</h3>
          <p class="text-emerald-800 font-mono text-base bg-emerald-100/50 inline-block px-4 py-2 rounded">
            The discrepancy has been overridden by moderator approval.
          </p>
          <div class="mt-6 pt-6 border-t border-emerald-200/50 text-sm text-slate-500 font-mono">
            Cryptographic audit log updated. Awaiting next case...
          </div>
        </div>

      </div>
    </div>
  `;

  // Entrance Animations
  const panel = container.querySelector('#moderation-panel');
  const caseDetails = container.querySelector('#case-details');
  const resolutionArea = container.querySelector('#resolution-area');
  const successState = container.querySelector('#success-state');
  const amendScoreArea = container.querySelector('#amend-score-area');
  const amendScoreInput = container.querySelector('#amend-score-input');

  gsap.fromTo(panel,
    { opacity: 0, y: 40, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "power3.out" }
  );
  gsap.fromTo(caseDetails,
    { opacity: 0, x: -30 },
    { opacity: 1, x: 0, duration: 0.6, delay: 0.3, ease: "power2.out" }
  );
  gsap.fromTo(resolutionArea,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.5, delay: 0.6, ease: "back.out(1.5)" }
  );

  const caseId = state.verificationResult?.case_id;

  const doResolve = async (decision, adjustedScore = null) => {
    if (!caseId) {
      alert('No moderation case ID found. Run verification first.');
      return;
    }
    container.querySelectorAll('.decision-btn, #btn-confirm-amend').forEach(b => {
      b.disabled = true;
      b.classList.add('opacity-50', 'cursor-not-allowed');
    });
    try {
      await window.EvalOS.apiClient.resolveModerationCase(caseId, decision, adjustedScore);
      if (window.EvalOS.state.data) {
        window.EvalOS.state.data.moderationCase = { status: 'RESOLVED', decision };
      }
      const successMsg = successState.querySelector('p');
      if (successMsg) {
        const msgs = {
          APPROVED: 'Marking approved by Proctor.',
          REJECTED: 'Marking rejected by Proctor. Script returned for re-evaluation.',
          AMENDED: `Score amended to ${adjustedScore} by Proctor.`
        };
        successMsg.textContent = msgs[decision] || 'Case resolved.';
      }
      gsap.to(resolutionArea, {
        opacity: 0, height: 0, margin: 0, padding: 0, duration: 0.4, ease: "power2.inOut",
        onComplete: () => {
          resolutionArea.classList.add('hidden');
          successState.classList.remove('hidden');
          gsap.fromTo(successState,
            { opacity: 0, scale: 0.9, y: 20 },
            { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.2)" }
          );
          setTimeout(() => window.setStage(8), 3000);
        }
      });
    } catch (err) {
      console.error('Moderation resolve failed:', err);
      container.querySelectorAll('.decision-btn, #btn-confirm-amend').forEach(b => {
        b.disabled = false;
        b.classList.remove('opacity-50', 'cursor-not-allowed');
      });
      const errMsg = document.createElement('p');
      errMsg.className = 'text-red-600 text-xs font-mono text-center mt-2';
      errMsg.textContent = `Failed to resolve: ${err.message || 'network error'}. Please try again.`;
      resolutionArea.appendChild(errMsg);
    }
  };

  // Wire up the three decision buttons
  container.querySelectorAll('.decision-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const decision = btn.dataset.decision;
      if (decision === 'AMENDED') {
        amendScoreArea.classList.remove('hidden');
        amendScoreArea.classList.add('flex');
      } else {
        doResolve(decision);
      }
    });
  });

  const btnConfirmAmend = container.querySelector('#btn-confirm-amend');
  if (btnConfirmAmend && amendScoreInput) {
    btnConfirmAmend.addEventListener('click', () => {
      const val = parseInt(amendScoreInput.value);
      if (isNaN(val) || val < 0) {
        alert('Please enter a valid non-negative score.');
        return;
      }
      doResolve('AMENDED', val);
    });
  }

}
