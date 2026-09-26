import gsap from 'gsap';

export async function renderVerifyStage(container, state) {
  container.innerHTML = `
    <div class="h-full w-full flex items-center justify-center p-8 pointer-events-auto">
      <div class="text-slate-500 font-mono text-sm animate-pulse">VERIFYING EVALUATION INTEGRITY...</div>
    </div>
  `;

  let result;
  try {
    let evalId;
    if (state.mode === 'real') {
      const evalIdsObj = window.EvalOS.state.realSession?.evaluationIds || {};
      const evalIds = Object.values(evalIdsObj);
      
      // Fallback if no evaluationIds dict but legacy evaluationId exists
      const fallbackEvalId = window.EvalOS.state.realSession?.evaluationId;
      if (evalIds.length === 0 && fallbackEvalId) evalIds.push(fallbackEvalId);
      
      if (evalIds.length === 0) {
        result = { status: 'REVIEW_REQUIRED', signals: [{ type: 'NO_EVALUATION', message: 'No marks have been entered yet.' }], case_id: null };
      } else {
        // Verify all evaluations for the bundle, aggregate signals
        result = { status: 'OK', signals: [] };
        for (const eId of evalIds) {
          const res = await window.EvalOS.apiClient.verifyEvaluation(eId);
          if (res.status === 'REVIEW_REQUIRED') {
            result.status = 'REVIEW_REQUIRED';
            // Attach evaluation ID to signals to track which script failed
            const signals = (res.signals || []).map(s => ({ ...s, evaluation_id: eId }));
            result.signals.push(...signals);
            if (!result.case_id) result.case_id = res.case_id; // track first case
          }
        }
      }
    } else {
      const evalId = state.realSession?.documents?.answerScripts?.[0]?.id || 'eval-123';
      result = await window.EvalOS.apiClient.verifyEvaluation(evalId);
    }
    window.EvalOS.state.verificationResult = result;
  } catch (err) {
    console.error("Verify failed", err);
    // Explicitly mark this as a network/system error so it isn't confused with an integrity break.
    result = { 
      status: 'SYSTEM_ERROR', 
      signals: [{
        type: 'NETWORK_ERROR', 
        message: `Failed to reach verification engine: ${err.message}. Please check your connection and try again.`
      }] 
    };
  }

  container.innerHTML = `
    <div class="h-full w-full flex items-center justify-center p-8 bg-[#FAF8F5]/30 pointer-events-auto">
      <div id="verify-panel-wrapper" class="w-full max-w-2xl h-auto max-h-[90vh] flex flex-col p-8 rounded-2xl shadow-xl bg-white/90 backdrop-blur-md border border-gray-200">
      </div>
    </div>
  `;

  const panel = container.querySelector('#verify-panel-wrapper');
  
  const hasSignals = result.status === 'REVIEW_REQUIRED';
  const isSystemError = result.status === 'SYSTEM_ERROR';
  
  let headerHtml = '';
  if (isSystemError) {
    headerHtml = `
      <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8">
        <h3 class="text-orange-800 font-bold text-sm mb-1 uppercase tracking-wide">System Error</h3>
        <p class="text-orange-600 text-sm">Could not complete verification due to a system or network error.</p>
      </div>
    `;
  } else if (hasSignals) {
    headerHtml = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
        <h3 class="text-red-800 font-bold text-sm mb-1 uppercase tracking-wide">Integrity Break Detected</h3>
        <p class="text-red-600 text-sm">Submission Blocked. Please resolve the missing evaluations or discrepancies below before final submission.</p>
      </div>
    `;
  } else {
    headerHtml = `
      <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
        <h3 class="text-green-800 font-bold text-sm mb-1 uppercase tracking-wide">Integrity Verified</h3>
        <p class="text-green-600 text-sm">All evaluation criteria met successfully.</p>
      </div>
    `;
  }

  let signalsHtml = '';
  if ((hasSignals || isSystemError) && result.signals) {
    result.signals.forEach(sig => {
      signalsHtml += `
      <div class="integrity-node opacity-0 translate-y-4 relative">
        <div class="absolute -left-[21px] top-1 w-3 h-3 rounded-full ${isSystemError ? 'bg-orange-500' : 'bg-red-500'} ring-4 ring-white shadow-sm"></div>
        <div class="bg-white rounded-lg p-4 border ${isSystemError ? 'border-orange-100' : 'border-red-100'} shadow-sm ml-4">
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-bold text-slate-ink text-sm">${sig.question || sig.type}</h4>
            <span class="px-2 py-0.5 ${isSystemError ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'} text-[10px] uppercase font-bold rounded-full tracking-wider">FAIL</span>
          </div>
          <p class="text-slate-500 text-xs">Reason: ${sig.message || sig.detail}</p>
        </div>
      </div>`;
    });
  }

  panel.innerHTML = `
    <div class="mb-6">
      <h2 class="text-xl font-newsreader text-slate-ink flex items-center gap-2">
        <svg class="w-6 h-6 ${hasSignals ? 'text-red-500' : 'text-green-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        Evaluation Integrity Engine
      </h2>
    </div>

    ${headerHtml}

    <div class="integrity-chain flex-1 overflow-y-auto mb-6 relative pl-4 border-l-2 border-slate-200 ml-2 space-y-8">
      ${signalsHtml}
    </div>

    <div class="mt-auto pt-6 border-t border-slate-100 space-y-3">
      ${hasSignals ? `
      <button id="return-btn" class="w-full py-3 px-4 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 transition-colors font-medium text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        Return to Examiner (Fix Error)
      </button>
      ` : ''}
      <button id="resolve-btn" class="w-full py-3 px-4 ${(hasSignals || isSystemError) ? 'bg-slate-ink text-white' : 'bg-green-600 text-white'} rounded-lg hover:opacity-90 transition-colors font-medium text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
        </svg>
        ${isSystemError ? 'Retry Verification' : (hasSignals ? 'Proceed to Moderation' : 'Proceed to Results')}
      </button>
    </div>
  `;

  // Animate the integrity chain nodes
  const nodes = panel.querySelectorAll('.integrity-node');
  if (window.gsap) {
    gsap.to(nodes, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger: 0.2,
      ease: 'power2.out',
      delay: 0.2
    });
  } else {
    // Fallback if GSAP is not loaded
    nodes.forEach(node => {
      node.style.opacity = '1';
      node.style.transform = 'translateY(0)';
      node.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });
  }

  // Handle interactions
  const resolveBtn = panel.querySelector('#resolve-btn');
  const returnBtn = panel.querySelector('#return-btn');

  if (returnBtn) {
    returnBtn.addEventListener('click', () => {
      window.setStage(4); // Go back to Examiner
    });
  }

  resolveBtn.addEventListener('click', () => {
    if (isSystemError) {
      window.setStage(6); // Retry verification
    } else if (hasSignals) {
      window.setStage(7); // Moderation
    } else {
      window.setStage(8); // Results
    }
  });
}
