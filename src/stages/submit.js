import { gsap } from 'gsap';

export function renderSubmitStage(container, state) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[60vh] w-full pointer-events-auto">
      <div class="glass-card flex flex-col items-center justify-center p-12 text-center opacity-0 translate-y-8" id="submit-card">
        <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <svg class="w-8 h-8 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h2 class="font-newsreader text-4xl text-slate-900 mb-4">Human Evaluation Complete</h2>
        <p class="font-jakarta text-slate-600 mb-8 max-w-md text-lg">
          The checked copy has been finalized and is ready to be sent to the AI Verify Engine for final validation.
        </p>
        <button id="submit-btn" class="bg-slate-900 text-warm-ivory px-8 py-4 rounded font-jakarta font-semibold tracking-wide hover:bg-slate-800 transition-colors shadow-lg">
          Submit Checked Copy to AI Verify Engine
        </button>
      </div>
    </div>
  `;

  const card = container.querySelector('#submit-card');
  const submitBtn = container.querySelector('#submit-btn');

  // Animate In
  gsap.to(card, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: 'power3.out'
  });

  // Handle Submit Click
  submitBtn.addEventListener('click', () => {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
    submitBtn.innerText = "Submitting...";

    gsap.to(submitBtn, { scale: 0.95, duration: 0.1, yoyo: true, repeat: 1 });

    gsap.to(card, {
      opacity: 0,
      y: -20,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        if (typeof window.setStage === 'function') {
          window.setStage(6);
        }
      }
    });
  });
}
