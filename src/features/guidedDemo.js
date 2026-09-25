import gsap from 'gsap';

export class GuidedDemoController {
  constructor() {
    this.state = window.EvalOS.state;
    this.steps = this.state.data.guidedDemoSteps;
    this.currentStepIndex = 0;
    this.container = null;
    this.visible = false;
    this.buildUI();
    this.setupKeyboardHandler();
  }

  buildUI() {
    const overlay = document.getElementById('guided-demo-overlay');
    if (!overlay) return;

    this.container = document.createElement('div');
    this.container.className = 'absolute top-24 left-6 w-80 glass-panel border border-accent-gold/20 shadow-2xl p-6 pointer-events-auto z-50 rounded-2xl bg-ivory/95 backdrop-blur-xl';
    
    this.updateUI();
    overlay.appendChild(this.container);
    this.visible = true;
    
    gsap.from(this.container, {
      x: -50,
      opacity: 0,
      duration: 0.6,
      ease: "back.out(1.2)"
    });
  }

  updateUI() {
    const step = this.steps[this.currentStepIndex];
    if (!step || !this.container) return;

    this.container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div class="badge-review bg-accent-gold/10 text-accent-gold px-2 py-0.5 rounded text-xs font-mono font-bold">GUIDED DEMO</div>
        <div class="flex items-center gap-3">
          <div class="text-xs font-mono text-slateink/50">${this.currentStepIndex + 1} / ${this.steps.length}</div>
          <button id="demo-close" class="w-6 h-6 rounded-full bg-slateink/10 hover:bg-slateink/20 flex items-center justify-center text-slateink/60 hover:text-slateink transition-colors" title="Close Demo">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>
      
      <h3 class="text-title-md text-slateink mb-2">${step.title}</h3>
      <p class="text-body-sm text-slateink/70 mb-6 leading-relaxed">${step.description}</p>
      
      <div class="flex gap-2 w-full">
        <button id="demo-prev" class="flex-1 py-2 rounded-full border border-slateink/10 text-slateink text-sm font-sans hover:bg-slateink/5 transition-colors disabled:opacity-30" ${this.currentStepIndex === 0 ? 'disabled' : ''}>Prev</button>
        <button id="demo-next" class="flex-1 py-2 rounded-full bg-slateink text-ivory text-sm font-sans hover:bg-slateink/90 transition-colors shadow-md shadow-slateink/20">${this.currentStepIndex === this.steps.length - 1 ? 'Finish' : 'Next Step'}</button>
      </div>
      <div class="mt-4 pt-4 border-t border-slateink/10 text-center">
         <button id="demo-reset" class="text-xs text-slateink/50 hover:text-accent-coral transition-colors font-mono underline underline-offset-2">RESET DEMO STATE</button>
      </div>
    `;

    // Attach listeners
    this.container.querySelector('#demo-next')?.addEventListener('click', () => this.next());
    this.container.querySelector('#demo-prev')?.addEventListener('click', () => this.prev());
    this.container.querySelector('#demo-reset')?.addEventListener('click', () => this.reset());
    this.container.querySelector('#demo-close')?.addEventListener('click', () => this.hide());
  }

  setupKeyboardHandler() {
    this._keyHandler = (e) => {
      if (e.key === 'Escape' && this.visible) {
        this.hide();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  next() {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this.applyStep();
      this.updateUI();
    } else {
      // Last step — finish and hide
      this.hide();
    }
  }

  prev() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.applyStep();
      this.updateUI();
    }
  }
  
  reset() {
    this.currentStepIndex = 0;
    if (window.EvalOS && typeof window.EvalOS.resetState === 'function') {
      window.EvalOS.resetState();
    } else {
      this.applyStep();
    }
    this.updateUI();
  }

  show() {
    if (this.container) {
      this.container.style.display = '';
      this.visible = true;
      gsap.fromTo(this.container, 
        { x: -30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.2)' }
      );
    } else {
      this.buildUI();
    }
  }

  hide() {
    if (this.container) {
      gsap.to(this.container, {
        x: -30,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          if (this.container) this.container.style.display = 'none';
        }
      });
      this.visible = false;
    }
  }

  applyStep() {
    const step = this.steps[this.currentStepIndex];
    if (!step) return;

    // The demo drives the application state
    if (typeof window.setStage === 'function') {
      window.setStage(step.stage);
    }
    
    // Animate container subtly to show change
    if (this.container) {
      gsap.fromTo(this.container, 
        { y: -5, opacity: 0.8 },
        { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" }
      );
    }
  }
}
