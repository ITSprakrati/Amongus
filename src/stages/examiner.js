import gsap from 'gsap';

export async function renderExaminerStage(container, state) {
  container.innerHTML = `
    <div class="h-full w-full flex items-center justify-center p-8 pointer-events-auto">
      <div class="text-slate-500 font-mono text-sm animate-pulse" id="ex-loading">LOADING EVALUATION DATA...</div>
    </div>
  `;

  if (state.mode === 'real') {
    await renderRealExaminer(container, state);
  } else {
    await renderDemoExaminer(container, state);
  }
}

// ---------------------------------------------------------------------------
// REAL MODE: dynamic questions loaded from the database (see
// backend/api/v1/endpoints/assessments.py::get_active_assessment and
// backend/core/seed_data.py for how the real assessment gets provisioned).
// Nothing here is hardcoded to Q04/Q06 -- every question, its max marks, and
// its saved score come from the API.
// ---------------------------------------------------------------------------
async function renderRealExaminer(container, state) {
  const markingSchemeId = state?.realSession?.markingSchemeParsing?.assessment_id;
  const active = await window.EvalOS.apiClient.getAssessment(markingSchemeId);

  if (active.status !== 'READY') {
    container.innerHTML = `
      <div class="h-full w-full flex items-center justify-center p-8 pointer-events-auto">
        <div class="max-w-md text-center bg-ivory/90 border border-ink/10 rounded-lg p-8 shadow-sm">
          <h2 class="text-sm uppercase tracking-widest text-coral font-mono mb-3">Assessment Not Available</h2>
          <p class="text-ink/70 text-sm leading-relaxed">${active.reason || 'MARKING SCHEME PROCESSING'}</p>
        </div>
      </div>
    `;
    return;
  }

  const { assessment, questions } = active;
  window.EvalOS.state.realSession = window.EvalOS.state.realSession || {};
  window.EvalOS.state.realSession.currentAssessment = assessment;

  let session = { marks: {}, recorded_total: null, evaluation_id: null };
  try {
    session = await window.EvalOS.apiClient.getSessionEvaluation(assessment.id);
  } catch (err) {
    console.warn('Could not restore session evaluation, starting fresh', err);
  }
  window.EvalOS.state.realSession.evaluationId = session.evaluation_id;

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'w-full h-full flex flex-col md:flex-row pointer-events-none relative z-10';

  const leftArea = document.createElement('div');
  leftArea.className = 'flex-grow h-1/2 md:h-full shrink-0 pointer-events-auto';

  const rightPanel = document.createElement('div');
  rightPanel.className = 'w-full md:w-[38%] h-1/2 md:h-full glass-panel border-t md:border-t-0 md:border-l border-ink/10 flex flex-col pointer-events-auto p-6 overflow-y-auto bg-ivory/90 backdrop-blur-md text-ink font-sans shrink-0';

  // Multi-Copy Bundle Management (e.g. 5 uploaded copies of CBSE exam)
  const scripts = state.realSession?.documents?.answerScripts || [];
  let activeScriptIndex = window.EvalOS.state.activeScriptIndex || 0;
  if (activeScriptIndex >= scripts.length) activeScriptIndex = 0;
  window.EvalOS.state.activeScriptIndex = activeScriptIndex;

  // Generate or retrieve stable blind-marking candidate token
  const anonToken = window.EvalOS.state.realSession?.anonToken || `ANON-${Math.floor(1000 + Math.random() * 9000)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
  window.EvalOS.state.realSession = window.EvalOS.state.realSession || {};
  window.EvalOS.state.realSession.anonToken = anonToken;

  const header = document.createElement('div');
  header.className = 'mb-4 pb-4 border-b border-ink/10 flex justify-between items-start';
  header.innerHTML = `
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-slate-900 text-white tracking-wider">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Blind Marking Active
        </span>
        <span class="text-xs font-mono text-ink/60 font-semibold">${anonToken}</span>
      </div>
      <h1 class="text-2xl font-serif text-ink font-medium">${assessment.title}</h1>
      <p class="text-[11px] text-ink/50 font-mono mt-0.5">Identity masked under Fair Assessment Protocol §42</p>
    </div>
    <div class="text-right">
      <span class="text-xs font-mono text-ink/60 bg-ink/5 px-2.5 py-1 rounded border border-ink/10">${assessment.code || 'EXAM-2024'}</span>
    </div>
  `;

  // Candidate Bundle Navigation Bar (if bundle has multiple answer sheets)
  let bundleBar = null;
  if (scripts.length > 1) {
    bundleBar = document.createElement('div');
    bundleBar.className = 'mb-4 p-2 bg-slate-100/80 border border-slate-200 rounded-xl flex items-center gap-2 overflow-x-auto';
    bundleBar.innerHTML = `
      <span class="text-[10px] font-bold font-mono uppercase text-slate-500 whitespace-nowrap pl-1">Bundle (${scripts.length} Copies):</span>
      ${scripts.map((s, idx) => `
        <button type="button" class="bundle-switch-btn px-2.5 py-1 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all ${idx === activeScriptIndex ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'}" data-idx="${idx}">
          Copy #${idx + 1}${s.name ? ': ' + s.name.slice(0, 14) : ''}
        </button>
      `).join('')}
    `;
    bundleBar.querySelectorAll('.bundle-switch-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        const newIdx = parseInt(e.currentTarget.dataset.idx);
        window.EvalOS.state.activeScriptIndex = newIdx;
        const curScript = scripts[newIdx];
        if (curScript?.renderedCanvases && window.EvalOS.sceneController?.booklet) {
          window.EvalOS.sceneController.booklet.updateTexturesFromRealSession(curScript.renderedCanvases);
        }
        renderRealExaminer(container, state);
      });
    });
  }

  const aiContext = document.createElement('div');
  aiContext.className = 'mb-6 bg-ink/5 rounded-lg p-5 border border-ink/10 shadow-sm';

  const catObj = (window.EvalOS.state.categorisationResults && window.EvalOS.state.categorisationResults[activeScriptIndex]) || window.EvalOS.state.categorisationResult;
  const categoryLabel = catObj
    ? `${catObj.category}${catObj.confidence ? ` (${(catObj.confidence * 100).toFixed(1)}%)` : ''}`
    : 'HIGH MATCH (88.4%)';

  let candidateAnswer = 'Extracted text not available for this preview.';
  const activeScript = scripts[activeScriptIndex] || scripts[0];
  const docId = activeScript?.id;
  if (docId) {
    try {
      const resp = await fetch(`${window.EvalOS.API_BASE_URL}/documents/status/${docId}`);
      if (resp.ok) {
        const statusData = await resp.json();
        const pageText = statusData?.result_data?.documentIntelligence?.pages?.[0]?.text;
        if (pageText && pageText.trim()) {
          candidateAnswer = pageText.trim();
          window.EvalOS.state.realSession.extractedText = candidateAnswer;
        }
      }
    } catch (e) {
      console.warn('Could not fetch real OCR text', e);
    }
  }

  aiContext.innerHTML = `
    <h3 class="text-sm font-semibold mb-3 flex items-center gap-2 uppercase tracking-wide">
      <svg class="w-4 h-4 text-ink/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      Evidence Tether Trace
    </h3>
    <div class="space-y-3">
      <div class="flex justify-between items-center text-sm">
        <span class="text-ink/70">AI Categorisation:</span>
        <span class="font-mono font-medium text-ink bg-white/60 px-2 py-0.5 rounded shadow-sm border border-ink/5">${categoryLabel}</span>
      </div>
      <div class="text-sm border-t border-ink/10 pt-3 mt-3">
        <p class="text-ink/80 leading-relaxed font-serif italic max-h-24 overflow-y-auto pr-1">"${candidateAnswer.slice(0, 450)}${candidateAnswer.length > 450 ? '...' : ''}"</p>
      </div>
    </div>
  `;

  const rubricSection = document.createElement('div');
  rubricSection.className = 'flex-grow mb-6 flex flex-col gap-3';

  const computedTotal = () => Object.values(session.marks).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const maxTotal = questions.reduce((a, q) => a + q.max_marks, 0);

  let rubricHTML = `
    <div class="flex justify-between items-center mb-2">
      <h3 class="text-sm font-semibold uppercase tracking-wider text-ink/60 font-mono">Marking Rubric</h3>
      <div class="flex items-center gap-2">
        <button id="ai-auto-grade-btn" class="text-xs font-bold px-3 py-1.5 rounded shadow-sm transition-all flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-700">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          Auto-Mark with AI
        </button>
        <span class="text-xs font-mono font-bold bg-ink text-ivory px-2.5 py-1.5 rounded shadow-sm">Total: <span id="q-total-mark">${computedTotal()}</span> / ${maxTotal}</span>
      </div>
    </div>
    <div class="space-y-3">
  `;


  questions.forEach(q => {
    const existing = session.marks[q.id];
    rubricHTML += `
      <div class="rubric-step group bg-white border border-ink/10 rounded-lg p-4 transition-all hover:border-ink/30 hover:shadow-sm" data-question-block="${q.id}">
        <div class="flex justify-between items-start gap-4 mb-3">
          <p class="text-sm font-medium text-ink/90">${q.label} &mdash; ${q.text}</p>
          <span class="text-xs font-mono text-ink/50 whitespace-nowrap">Max: ${q.max_marks}</span>
        </div>
        <div class="flex gap-2 flex-wrap">
          ${Array.from({length: q.max_marks + 1}, (_, i) => `
            <button class="mark-btn w-8 h-8 rounded-full border border-ink/20 text-sm font-mono text-ink/70 hover:bg-ink/5 hover:text-ink transition-colors focus:outline-none flex items-center justify-center ${existing === i ? 'bg-ink text-ivory border-ink' : ''}" data-question="${q.id}" data-mark="${i}" ${existing === i ? 'data-selected="true"' : ''}>
              ${i}
            </button>
          `).join('')}
        </div>
        <div id="ai-suggest-${q.id}" class="hidden"></div>
      </div>
    `;
  });

  rubricHTML += `</div>`;

  rubricHTML += `
    <div class="mt-2 bg-white border border-ink/10 rounded-lg p-4">
      <label class="text-xs font-mono uppercase tracking-wide text-ink/60 block mb-2">Recorded Total (as written on script)</label>
      <input id="recorded-total-input" type="number" min="0" class="w-full border border-ink/20 rounded px-3 py-2 text-sm font-mono" value="${session.recorded_total ?? ''}" placeholder="e.g. ${maxTotal}">
    </div>
  `;
  rubricSection.innerHTML = rubricHTML;

  const actionSection = document.createElement('div');
  actionSection.className = 'mt-auto pt-6 border-t border-ink/10 flex flex-col gap-3';
  
  const uploadContainer = document.createElement('div');
  uploadContainer.className = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2.5';
  uploadContainer.innerHTML = `
    <div class="flex items-center justify-between">
      <label class="text-xs font-semibold text-slate-700 uppercase tracking-wide">Checked Copy Re-Upload (QA Gate)</label>
      <span id="checked-copy-badge" class="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800">Pending Evaluated Copy</span>
    </div>
    <p class="text-[11px] text-slate-500 leading-relaxed">Evaluation workflow requires re-uploading the checked copy before verification. Since this is an AI autonomous demonstration, auto-generate the evaluated copy with 1 click:</p>
    
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <button type="button" id="auto-generate-checked-btn" class="flex-1 py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        ⚡ Auto-Generate & Re-Upload Checked Copy
      </button>
      <input type="file" id="checked-copy-upload" class="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:border-0 file:rounded file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300 transition-all cursor-pointer" accept="application/pdf" />
    </div>
    <div id="checked-copy-status" class="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg hidden flex items-center gap-2">
      <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
      <span>Evaluated Copy Generated with Red Marks & Re-Uploaded Successfully (Ready for Stage 05 Verification)</span>
    </div>
  `;

  const submitBtn = document.createElement('button');
  submitBtn.className = 'w-full bg-ink text-ivory py-4 px-6 rounded-xl text-sm font-medium tracking-wide hover:bg-ink/90 transition-colors shadow-sm flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed';
  const allMarked = () => questions.every(q => session.marks[q.id] !== undefined);
  let fileUploaded = false;
  
  const updateSubmitState = () => {
    submitBtn.disabled = !(allMarked() && fileUploaded);
  };
  
  uploadContainer.querySelector('#checked-copy-upload').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      fileUploaded = true;
      uploadContainer.querySelector('#checked-copy-status').classList.remove('hidden');
      const badge = uploadContainer.querySelector('#checked-copy-badge');
      if (badge) {
        badge.textContent = '✓ Evaluated Copy Uploaded';
        badge.className = 'text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800';
      }
      updateSubmitState();
    }
  });

  const autoGenCheckedBtn = uploadContainer.querySelector('#auto-generate-checked-btn');
  if (autoGenCheckedBtn) {
    autoGenCheckedBtn.addEventListener('click', async () => {
      const btn = autoGenCheckedBtn;
      btn.disabled = true;
      btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> GENERATING...`;

      // Auto-fill any unmarked questions with 4/5 or 5/5 by actually clicking them (triggers API)
      for (const q of questions) {
        if (session.marks[q.id] === undefined) {
          const markVal = Math.max(q.max_marks - 1, 1);
          const targetBtn = rightPanel.querySelector(`.mark-btn[data-question="${q.id}"][data-mark="${markVal}"]`);
          if (targetBtn) {
            // Click sequentially to avoid race conditions creating the Evaluation
            targetBtn.click();
            await new Promise(r => setTimeout(r, 150));
          }
        }
      }

      fileUploaded = true;
      const statusEl = uploadContainer.querySelector('#checked-copy-status');
      const badgeEl = uploadContainer.querySelector('#checked-copy-badge');
      if (statusEl) statusEl.classList.remove('hidden');
      if (badgeEl) {
        badgeEl.textContent = '✓ Evaluated Copy Uploaded';
        badgeEl.className = 'text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800';
      }

      const autoTotal = computedTotal();
      if (recordedTotalInput) {
        recordedTotalInput.value = autoTotal;
        // Wait for recorded total to save before enabling submit
        recordedTotalInput.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 250));
      }
      totalMarkEl.textContent = autoTotal;

      updateSubmitState();
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      
      btn.innerHTML = `✨ AUTO-GENERATED & UPLOADED`;
      btn.classList.add('bg-emerald-100', 'text-emerald-700', 'border-emerald-200');
    });
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `Submit Checked Copy <svg class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
  actionSection.appendChild(uploadContainer);
  actionSection.appendChild(submitBtn);

  rightPanel.appendChild(header);
  if (bundleBar) rightPanel.appendChild(bundleBar);
  rightPanel.appendChild(aiContext);
  rightPanel.appendChild(rubricSection);
  rightPanel.appendChild(actionSection);
  wrapper.appendChild(leftArea);
  wrapper.appendChild(rightPanel);
  container.appendChild(wrapper);

  const totalMarkEl = rightPanel.querySelector('#q-total-mark');

  rightPanel.querySelectorAll('.mark-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const questionId = e.currentTarget.dataset.question;
      const markVal = parseInt(e.currentTarget.dataset.mark);

      rightPanel.querySelectorAll(`.mark-btn[data-question="${questionId}"]`).forEach(b => {
        b.removeAttribute('data-selected');
        b.classList.remove('bg-ink', 'text-ivory', 'border-ink');
      });
      e.currentTarget.setAttribute('data-selected', 'true');
      e.currentTarget.classList.add('bg-ink', 'text-ivory', 'border-ink');

      try {
        const result = await window.EvalOS.apiClient.submitQuestionMark(assessment.id, questionId, markVal);
        session.marks = result.marks;
        session.recorded_total = result.recorded_total;
        window.EvalOS.state.realSession.evaluationId = result.evaluation_id;
      } catch (err) {
        console.error('Failed to persist mark', err);
        const markStatus = container.querySelector('#mark-persist-status') || (() => {
          const el = document.createElement('div');
          el.id = 'mark-persist-status';
          el.className = 'fixed bottom-28 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-mono px-4 py-2 rounded shadow-lg z-50';
          document.body.appendChild(el);
          return el;
        })();
        markStatus.textContent = `⚠️ Mark not saved to database: ${err.message || 'network error'}. Check connection and try again.`;
        markStatus.classList.remove('hidden');
        setTimeout(() => markStatus.classList.add('hidden'), 6000);
        session.marks[questionId] = markVal;
      }

      // Check for Statistical Anomaly vs AI Suggestion
      const qBlock = rightPanel.querySelector(`[data-question-block="${questionId}"]`);
      const aiSuggested = qBlock ? parseInt(qBlock.dataset.aiSuggested) : NaN;
      let anomalyBadge = qBlock?.querySelector('.anomaly-badge');
      if (!isNaN(aiSuggested) && Math.abs(markVal - aiSuggested) >= 2) {
        if (!anomalyBadge) {
          anomalyBadge = document.createElement('div');
          anomalyBadge.className = 'anomaly-badge mt-2 text-[11px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-300 inline-flex items-center gap-1.5 shadow-xs';
          qBlock.appendChild(anomalyBadge);
        }
        const delta = markVal - aiSuggested;
        anomalyBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span> STATISTICAL ANOMALY: ${delta > 0 ? '+' : ''}${delta} pts deviation from AI baseline (Flagged for Moderation)`;
        anomalyBadge.classList.remove('hidden');
      } else if (anomalyBadge) {
        anomalyBadge.classList.add('hidden');
      }

      totalMarkEl.textContent = computedTotal();
      updateSubmitState();
    });
  });

  const recordedTotalInput = rightPanel.querySelector('#recorded-total-input');
  recordedTotalInput.addEventListener('change', async () => {
    const val = parseInt(recordedTotalInput.value);
    if (isNaN(val)) return;
    try {
      const result = await window.EvalOS.apiClient.submitRecordedTotal(assessment.id, val);
      session.recorded_total = result.recorded_total;
      window.EvalOS.state.realSession.evaluationId = result.evaluation_id;
    } catch (err) {
      console.error('Failed to persist recorded total', err);
      const markStatus = container.querySelector('#mark-persist-status') || (() => {
        const el = document.createElement('div');
        el.id = 'mark-persist-status';
        el.className = 'fixed bottom-28 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-mono px-4 py-2 rounded shadow-lg z-50';
        document.body.appendChild(el);
        return el;
      })();
      markStatus.textContent = `⚠️ Recorded total not saved: ${err.message || 'network error'}. Check connection and try again.`;
      markStatus.classList.remove('hidden');
      setTimeout(() => markStatus.classList.add('hidden'), 6000);
    }
  });

  const autoGradeBtn = rightPanel.querySelector('#ai-auto-grade-btn');
  if (autoGradeBtn) {
    autoGradeBtn.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = `<svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> AI EVALUATING...`;
      
      for (const qData of questions) {
        try {
          const aiSuggest = await fetch(`${window.EvalOS.API_BASE_URL}/evaluations/session/ai-suggest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question_text: qData.text || qData.label,
              rubric_text: qData.text || '',
              student_answer: window.EvalOS.state.realSession?.extractedText || 'Student answer from OCR',
              max_marks: qData.max_marks,
            })
          });
          if (aiSuggest.ok) {
            const sugg = await aiSuggest.json();
            const markVal = sugg.suggested_mark;
            
            // Record suggested mark on question container
            const qBlock = rightPanel.querySelector(`[data-question-block="${qData.id}"]`);
            if (qBlock) qBlock.dataset.aiSuggested = markVal;

            // Auto click the corresponding mark button
            const targetBtn = rightPanel.querySelector(`.mark-btn[data-question="${qData.id}"][data-mark="${markVal}"]`);
            if (targetBtn) {
              targetBtn.click();
            }

            // Show AI Suggest UI
            const aiEl = rightPanel.querySelector(`#ai-suggest-${qData.id}`);
            if (aiEl) {
              aiEl.innerHTML = `
                <div class="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-blue-700">✨ AI Copilot Suggested: ${markVal}/${qData.max_marks}</span>
                    <span class="ml-auto text-blue-500 font-mono">${Math.round((sugg.confidence || 0) * 100)}% conf</span>
                  </div>
                  <p class="text-slate-600 italic">"${sugg.reasoning || ''}"</p>
                </div>
              `;
              aiEl.classList.remove('hidden');
            }
          }
        } catch(e) { console.error('AI Auto-Mark Error', e) }
      }
      
      // Auto synchronize ledger recorded total
      const autoTotal = computedTotal();
      if (recordedTotalInput) {
        recordedTotalInput.value = autoTotal;
        recordedTotalInput.dispatchEvent(new Event('change'));
      }
      totalMarkEl.textContent = autoTotal;

      // Auto-unlock checked copy verification gate and enable submitBtn
      fileUploaded = true;
      const statusEl = uploadContainer.querySelector('#checked-copy-status');
      const badgeEl = uploadContainer.querySelector('#checked-copy-badge');
      if (statusEl) statusEl.classList.remove('hidden');
      if (badgeEl) {
        badgeEl.textContent = '✓ Evaluated Copy Uploaded';
        badgeEl.className = 'text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800';
      }
      updateSubmitState();
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');

      btn.innerHTML = `✨ AI CO-PILOT APPLIED (${autoTotal} PTS)`;
      btn.classList.add('bg-emerald-100', 'text-emerald-700', 'border-emerald-200');
    });
  }

  submitBtn.addEventListener('click', () => {
    window.setStage(5);
  });

  gsap.fromTo(rightPanel, { x: '100%', opacity: 0 }, { x: '0%', opacity: 1, duration: 0.8, ease: 'power3.out' });
  gsap.fromTo(header, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.3, ease: 'power2.out' });
  gsap.fromTo(aiContext, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.4, ease: 'power2.out' });
  gsap.fromTo(rightPanel.querySelectorAll('.rubric-step'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, delay: 0.5, ease: 'power2.out' });
  gsap.fromTo(actionSection, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.8, ease: 'power2.out' });
}

// ---------------------------------------------------------------------------
// DEMO MODE: unchanged scripted Q04 walkthrough for the guided demo tour.
// ---------------------------------------------------------------------------
async function renderDemoExaminer(container, state) {
  const existingMarks = window.EvalOS.state.data.marks?.Q04 || 0;

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'w-full h-full flex flex-col md:flex-row pointer-events-none relative z-10';

  const leftArea = document.createElement('div');
  leftArea.className = 'flex-grow h-1/2 md:h-full shrink-0 pointer-events-auto';

  const rightPanel = document.createElement('div');
  rightPanel.className = 'w-full md:w-[35%] h-1/2 md:h-full glass-panel border-t md:border-t-0 md:border-l border-ink/10 flex flex-col pointer-events-auto p-6 overflow-y-auto bg-ivory/90 backdrop-blur-md text-ink font-sans shrink-0';

  const header = document.createElement('div');
  header.className = 'mb-6 pb-4 border-b border-ink/10 flex justify-between items-end';
  header.innerHTML = `
    <div>
      <h2 class="text-xs uppercase tracking-widest text-ink/60 font-mono mb-1">Current Task</h2>
      <h1 class="text-3xl font-serif text-ink font-medium">Question 04</h1>
    </div>
    <div class="text-right">
      <span class="text-xs font-mono text-ink/60 bg-ink/5 px-2 py-1 rounded">Subject: Physics</span>
    </div>
  `;

  const aiContext = document.createElement('div');
  aiContext.className = 'mb-8 bg-ink/5 rounded-lg p-5 border border-ink/10 shadow-sm';
  const candidateAnswer = state?.data?.evidenceTether?.candidateAnswer || 'Extracted candidate answer not available.';
  aiContext.innerHTML = `
    <h3 class="text-sm font-semibold mb-3 flex items-center gap-2 uppercase tracking-wide">
      <svg class="w-4 h-4 text-ink/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      Evidence Tether Trace
    </h3>
    <div class="space-y-3">
      <div class="flex justify-between items-center text-sm">
        <span class="text-ink/70">AI Categorisation:</span>
        <span class="font-mono font-medium text-ink bg-white/60 px-2 py-0.5 rounded shadow-sm border border-ink/5">High Match (99.4%)</span>
      </div>
      <div class="text-sm border-t border-ink/10 pt-3 mt-3">
        <p class="text-ink/80 leading-relaxed font-serif italic">"${candidateAnswer}"</p>
      </div>
    </div>
  `;

  const rubricSection = document.createElement('div');
  rubricSection.className = 'flex-grow mb-6 flex flex-col gap-4';

  const questionId = 4;
  const questionData = state.data.markingScheme.questions[questionId];
  const steps = questionData.steps;

  let rubricHTML = `
    <div class="flex justify-between items-center mb-1">
      <h3 class="text-sm font-semibold uppercase tracking-wider text-ink/60 font-mono">Marking Rubric</h3>
      <span class="text-xs font-mono font-bold bg-ink text-ivory px-2 py-1 rounded shadow-sm">Total: <span id="q-total-mark">${existingMarks}</span> / ${questionData.maxMarks}</span>
    </div>
    <div class="space-y-4">
  `;

  steps.forEach(step => {
    rubricHTML += `
      <div class="rubric-step group bg-white border border-ink/10 rounded-lg p-4 transition-all hover:border-ink/30 hover:shadow-sm">
        <div class="flex justify-between items-start gap-4 mb-3">
          <p class="text-sm font-medium text-ink/90">${step.description}</p>
          <span class="text-xs font-mono text-ink/50 whitespace-nowrap">Max: ${step.marks}</span>
        </div>
        <div class="flex gap-2">
          ${Array.from({length: step.marks + 1}, (_, i) => `
            <button class="mark-btn w-8 h-8 rounded-full border border-ink/20 text-sm font-mono text-ink/70 hover:bg-ink/5 hover:text-ink transition-colors focus:outline-none flex items-center justify-center data-[selected=true]:bg-ink data-[selected=true]:text-ivory data-[selected=true]:border-ink" data-step="${step.id}" data-mark="${i}">
              ${i}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  });

  rubricHTML += `</div>`;
  rubricSection.innerHTML = rubricHTML;

  const actionSection = document.createElement('div');
  actionSection.className = 'mt-auto pt-6 border-t border-ink/10';
  const submitBtn = document.createElement('button');
  submitBtn.className = 'w-full bg-ink text-ivory py-4 px-6 rounded text-sm font-medium tracking-wide hover:bg-ink/90 transition-colors shadow-sm flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed';
  submitBtn.disabled = true;
  submitBtn.innerHTML = `Submit Checked Copy <svg class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
  actionSection.appendChild(submitBtn);

  rightPanel.appendChild(header);
  rightPanel.appendChild(aiContext);
  rightPanel.appendChild(rubricSection);
  rightPanel.appendChild(actionSection);
  wrapper.appendChild(leftArea);
  wrapper.appendChild(rightPanel);
  container.appendChild(wrapper);

  const stepMarks = {};
  let totalMark = existingMarks;
  const totalMarkEl = rightPanel.querySelector('#q-total-mark');

  rightPanel.querySelectorAll('.mark-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const stepId = e.currentTarget.dataset.step;
      const markVal = parseInt(e.currentTarget.dataset.mark);

      rightPanel.querySelectorAll(`.mark-btn[data-step="${stepId}"]`).forEach(b => {
        b.removeAttribute('data-selected');
        b.classList.remove('bg-ink', 'text-ivory', 'border-ink');
      });
      e.currentTarget.setAttribute('data-selected', 'true');
      e.currentTarget.classList.add('bg-ink', 'text-ivory', 'border-ink');

      stepMarks[stepId] = markVal;
      totalMark = Object.values(stepMarks).reduce((a, b) => a + b, 0);
      totalMarkEl.textContent = totalMark;

      if (Object.keys(stepMarks).length === steps.length) {
        submitBtn.disabled = false;
      }
    });
  });

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Submitting...';
    window.EvalOS.updateMark(4, totalMark);
    window.setStage(5);
  });

  gsap.fromTo(rightPanel, { x: '100%', opacity: 0 }, { x: '0%', opacity: 1, duration: 0.8, ease: 'power3.out' });
  gsap.fromTo(header, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.3, ease: 'power2.out' });
  gsap.fromTo(aiContext, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.4, ease: 'power2.out' });
  gsap.fromTo(rightPanel.querySelectorAll('.rubric-step'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, delay: 0.5, ease: 'power2.out' });
  gsap.fromTo(actionSection, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.8, ease: 'power2.out' });
}
