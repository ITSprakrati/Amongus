import gsap from 'gsap';
import { processPDF } from '../utils/pdfProcessor.js';
import { watchMarkingSchemeParsing } from '../utils/schemeParsing.js';

export function renderUploadStage(container, state) {
  // Ensure documents state is ready
  window.EvalOS = window.EvalOS || {};
  window.EvalOS.state = window.EvalOS.state || {};
  window.EvalOS.state.realSession = {
    evaluationId: null,
    marks: {},
    recorded_total: null,
    markingSchemeParsing: null,
    documents: {
      answerScripts: [],
      markingScheme: null,
      assessmentStructure: null
    }
  };
  window.EvalOS.state.categorisationResult = null;
  window.EvalOS.state.verificationResult = null;

  const uploadCategories = [
    { id: 'assessmentStructure', title: 'Question Paper', isArray: false },
    { id: 'markingScheme', title: 'Marking Scheme', isArray: false },
    { id: 'answerScripts', title: 'Answer Script Bundle', isArray: true }
  ];

  container.innerHTML = `
    <div class="w-full h-full flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 bg-[#FAF8F5] text-[#1E242B] font-sans pointer-events-auto relative overflow-y-auto">
      
      <!-- Step 1: Institution Select -->
      <div id="step-1-inst" class="glass-card max-w-md w-full bg-white/60 backdrop-blur-xl border border-[#1E242B]/10 rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col gap-4 sm:gap-6 opacity-0 translate-y-8">
        <h2 class="text-xl sm:text-2xl font-serif text-[#1E242B] text-center">Select Institution Type</h2>
        <div class="flex flex-col gap-3 sm:gap-4 mt-1 sm:mt-2">
          <button class="inst-btn py-3 sm:py-4 px-5 sm:px-6 rounded-xl border border-[#1E242B]/20 hover:bg-[#1E242B] hover:text-white transition-all text-left font-medium text-sm sm:text-base" data-type="CBSE">CBSE / Central Board</button>
          <button class="inst-btn py-3 sm:py-4 px-5 sm:px-6 rounded-xl border border-[#1E242B]/20 hover:bg-[#1E242B] hover:text-white transition-all text-left font-medium text-sm sm:text-base" data-type="University">State University</button>
          <button class="inst-btn py-3 sm:py-4 px-5 sm:px-6 rounded-xl border border-[#1E242B]/20 hover:bg-[#1E242B] hover:text-white transition-all text-left font-medium text-sm sm:text-base" data-type="Other">Other / Autonomous</button>
        </div>
      </div>

      <!-- Step 2: Document Uploads (hidden initially) -->
      <div id="step-2-upload" class="glass-card upload-container max-w-4xl w-full bg-white/60 backdrop-blur-xl border border-[#1E242B]/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl flex flex-col gap-5 sm:gap-8 opacity-0 translate-y-8 hidden pointer-events-none">
        
        <div class="header-section flex flex-col items-center gap-1 sm:gap-2 border-b border-[#1E242B]/10 pb-4 sm:pb-6 text-center">
          <h2 class="text-xs sm:text-sm uppercase tracking-widest text-[#1E242B]/60 font-semibold font-mono" id="selected-inst-label">Institution</h2>
          <h1 class="text-xl sm:text-3xl font-serif text-[#1E242B]">Provide Assessment Documents</h1>
          <p class="text-xs sm:text-sm text-[#1E242B]/60 max-w-lg mt-1 sm:mt-2 mx-auto">Upload the blank question paper, marking scheme, and answer script bundle. AI will extract the assessment structure automatically.</p>
        </div>

        <!-- Upload Zones: 1-col on mobile, 3-col on md+ -->
        <div class="upload-zones grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
          ${uploadCategories.map((cat, index) => `
            <div class="upload-item flex flex-row md:flex-col items-center justify-start md:justify-center p-4 sm:p-6 border-2 border-dashed border-[#1E242B]/20 rounded-xl sm:rounded-2xl bg-white/40 hover:bg-white/80 transition-colors duration-300 group cursor-pointer relative overflow-hidden gap-3 md:gap-0" data-id="${cat.id}">
              <input type="file" accept=".pdf" class="hidden file-input" ${cat.isArray ? 'multiple' : ''} />
              
              <div class="icon-container w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#1E242B]/5 flex items-center justify-center mb-0 md:mb-4 shrink-0 group-hover:scale-110 transition-transform duration-300">
                <svg class="w-5 h-5 sm:w-6 sm:h-6 text-[#1E242B]/70 default-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <div class="spinner w-5 h-5 border-2 border-[#1E242B]/30 border-t-[#1E242B] rounded-full animate-spin hidden"></div>
                <svg class="w-5 h-5 sm:w-6 sm:h-6 hidden success-icon text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              
              <div class="flex flex-col flex-1 md:items-center">
                <span class="text-sm font-medium md:text-center title-text">${cat.title}</span>
                <div class="details-text text-xs text-[#1E242B]/60 mt-1 hidden flex-col items-start md:items-center gap-1 w-full z-10">
                  <span class="file-name truncate w-full font-mono"></span>
                  <span class="file-meta"></span>
                </div>
              </div>
              
              <div class="progress-bar absolute bottom-0 left-0 h-1 bg-[#1E242B] w-0"></div>
            </div>
          `).join('')}
        </div>

        <!-- Action Button: full-width on mobile -->
        <div class="action-section flex justify-end sm:justify-end mt-2 sm:mt-4">
          <button id="init-pipeline-btn" disabled class="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-[#1E242B] text-[#FAF8F5] rounded-xl font-medium tracking-wide hover:bg-[#1E242B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3 text-sm sm:text-base">
            <span class="btn-text">Initialize Assessment Pipeline</span>
            <svg class="w-5 h-5 hidden btn-success-icon text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <div class="btn-spinner w-5 h-5 border-2 border-[#FAF8F5]/30 border-t-[#FAF8F5] rounded-full animate-spin hidden"></div>
          </button>
        </div>
      </div>
    </div>
  `;

  const step1 = container.querySelector('#step-1-inst');
  const step2 = container.querySelector('#step-2-upload');
  const instLabel = container.querySelector('#selected-inst-label');

  // GSAP Animations
  const tl = gsap.timeline();
  tl.to(step1, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });

  container.querySelectorAll('.inst-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.target.dataset.type;
      window.EvalOS.state.data = window.EvalOS.state.data || {};
      window.EvalOS.state.data.institution = { name: type };
      instLabel.textContent = type;
      
      const headerLabel = document.getElementById('header-institution-label');
      if (headerLabel) {
        headerLabel.textContent = type + ' Evaluation';
      }
      
      gsap.to(step1, {
        opacity: 0, y: -20, duration: 0.4, onComplete: () => {
          step1.classList.add('hidden');
          step2.classList.remove('hidden', 'pointer-events-none');
          step2.style.opacity = '0';
          step2.style.transform = 'translateY(20px)';
          
          const tl2 = gsap.timeline();
          tl2.to(step2, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' })
            .from('.header-section', { opacity: 0, y: -20, duration: 0.6, ease: 'power2.out' }, '-=0.4')
            .from('.upload-item', { opacity: 0, y: 20, duration: 0.5, stagger: 0.15, ease: 'back.out(1.2)' }, '-=0.2')
            .from('.action-section', { opacity: 0, duration: 0.5 }, '-=0.2');
        }
      });
    });
  });

  const uploadItems = container.querySelectorAll('.upload-item');
  const initBtn = container.querySelector('#init-pipeline-btn');
  const btnText = initBtn.querySelector('.btn-text');
  const btnSpinner = initBtn.querySelector('.btn-spinner');
  const btnSuccessIcon = initBtn.querySelector('.btn-success-icon');

  function checkAllUploaded() {
    const docs = window.EvalOS.state.realSession.documents;
    // Allow advancing if ANY document is present for testing the document engine
    const anyUploaded = docs.answerScripts.length > 0 || docs.markingScheme || docs.assessmentStructure;
    
    if (anyUploaded) {
      initBtn.disabled = false;
      gsap.to(initBtn, { scale: 1.05, duration: 0.2, yoyo: true, repeat: 1 });
    } else {
      initBtn.disabled = true;
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  uploadItems.forEach(item => {
    const fileInput = item.querySelector('.file-input');
    const catId = item.dataset.id;
    const isArray = uploadCategories.find(c => c.id === catId).isArray;

    item.addEventListener('click', (e) => {
      // Prevent clicking input itself from re-triggering this
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const iconContainer = item.querySelector('.icon-container');
      const defaultIcon = item.querySelector('.default-icon');
      const spinner = item.querySelector('.spinner');
      const successIcon = item.querySelector('.success-icon');
      const detailsText = item.querySelector('.details-text');
      const fileNameEl = item.querySelector('.file-name');
      const fileMetaEl = item.querySelector('.file-meta');
      const progressBar = item.querySelector('.progress-bar');

      // Show loading state
      defaultIcon.classList.add('hidden');
      successIcon.classList.add('hidden');
      spinner.classList.remove('hidden');
      
      gsap.to(progressBar, { width: '50%', duration: 0.5 });

      // Setup diagnostics
      let diagPanel = document.getElementById('doc-diagnostics');
      if (!diagPanel && window.EvalOS_DEBUG) {
        diagPanel = document.createElement('div');
        diagPanel.id = 'doc-diagnostics';
        diagPanel.className = 'fixed bottom-4 left-4 bg-black/80 text-green-400 font-mono text-xs p-4 rounded-lg z-50 pointer-events-none whitespace-pre';
        document.body.appendChild(diagPanel);
      }
      if (diagPanel && window.EvalOS_DEBUG) {
        diagPanel.innerHTML = 'DOCUMENT DIAGNOSTICS\n';
      }

      const updateDiagnostics = (msg) => {
        if (diagPanel && window.EvalOS_DEBUG) diagPanel.innerHTML += msg + '\n';
        console.log('[Diagnostics]', msg);
      };

      try {
        let totalSize = 0;
        let totalPages = 0;
        let lastDoc = null;

        for (const file of files) {
          updateDiagnostics(`Uploading ${file.name} to backend API...`);
          
          // 1. Upload to FastAPI Backend for persistence and Async ML/OCR
          const backendDoc = await window.EvalOS.apiClient.uploadDocument(file, catId, updateDiagnostics);
          updateDiagnostics(`Backend Upload Success (ID: ${backendDoc.id})`);

          // 2. Process locally for 3D Examiner Engine textures
          updateDiagnostics(`Extracting 3D rendering textures locally for ${file.name}...`);
          const doc = await processPDF(file, updateDiagnostics);
          
          // Merge the backend ID into the local doc object
          doc.id = backendDoc.id;
          lastDoc = doc;
          totalSize += doc.size;
          totalPages += doc.pages;
          
          updateDiagnostics('Stored ✓');
          
          // Save to state
          if (isArray) {
            window.EvalOS.state.realSession.documents[catId].push(doc);
          } else {
            window.EvalOS.state.realSession.documents[catId] = doc;
          }
        }

        // Update UI
        spinner.classList.add('hidden');
        successIcon.classList.remove('hidden');
        iconContainer.classList.add('bg-[#1E242B]', 'text-[#FAF8F5]');
        iconContainer.classList.remove('bg-[#1E242B]/5');
        
        fileNameEl.textContent = files.length > 1 ? `${files.length} Files Uploaded` : lastDoc.name;
        fileMetaEl.textContent = `${formatBytes(totalSize)} • ${totalPages} Pages`;
        detailsText.classList.remove('hidden');
        detailsText.classList.add('flex');
        
        gsap.to(progressBar, { width: '100%', duration: 0.5 });

        // Marking scheme: surface the backend's honest parse outcome under the file name.
        if (catId === 'markingScheme' && lastDoc) {
          const parseLine = document.createElement('span');
          parseLine.className = 'scheme-parse-status text-[11px] font-mono text-center leading-snug';
          detailsText.appendChild(parseLine);
          const tones = { ok: 'text-emerald-700', unavailable: 'text-amber-700', pending: 'text-[#1E242B]/60' };
          watchMarkingSchemeParsing(lastDoc.id, ({ tone, text }) => {
            parseLine.textContent = text;
            parseLine.className = `scheme-parse-status text-[11px] font-mono text-center leading-snug ${tones[tone] || ''}`;
            updateDiagnostics(text);
          });
        }
        
        checkAllUploaded();
      } catch (error) {
        console.error("Error processing document:", error);
        updateDiagnostics(`ERROR: ${error.message || error}`);
        
        // Revert UI on error
        spinner.classList.add('hidden');
        defaultIcon.classList.remove('hidden');
        gsap.to(progressBar, { width: '0%', duration: 0.3 });
        
        // Detailed error message as requested
        alert(`PDF COULD NOT BE OPENEDnn${error.message || error}nnThe selected file appears to be corrupted or unsupported. Try another PDF.`);
      }
      
      // Reset input
      e.target.value = '';
    });
  });

  initBtn.addEventListener('click', () => {
    initBtn.disabled = true;
    btnText.textContent = 'Initializing...';
    btnSpinner.classList.remove('hidden');
    
    setTimeout(() => {
      btnSpinner.classList.add('hidden');
      btnSuccessIcon.classList.remove('hidden');
      btnText.textContent = 'Pipeline Ready';
      
      gsap.to('.upload-container', {
        scale: 0.95,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.in',
        delay: 0.5,
        onComplete: () => {
          // If in real mode and an answer script is available, map its pages to the 3D booklet
          if (state.mode === 'real' && state.realSession.documents.answerScripts?.[0]?.renderedCanvases) {
            if (window.EvalOS && window.EvalOS.sceneController && window.EvalOS.sceneController.booklet) {
              window.EvalOS.sceneController.booklet.updateTexturesFromRealSession(state.realSession.documents.answerScripts[0].renderedCanvases);
            }
          }
          
          if (typeof state.onComplete === 'function') {
            state.onComplete();
          } else {
            window.setStage(2);
          }
        }
      });
    }, 1000);
  });
}
