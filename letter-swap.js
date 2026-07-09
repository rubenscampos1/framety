/* letter-swap.js — reutilizável, sem deps */
function initLetterSwap(selector, mode) {
  document.querySelectorAll(selector).forEach(el => {
    if (el.dataset.ls) return;
    el.dataset.ls = '1';
    const text = el.textContent.trim();
    el.innerHTML = '';

    // Wrapper with overflow:hidden so layer B is invisible at rest
    el.style.position = 'relative';
    el.style.overflow = 'hidden';
    el.style.display = el.style.display || 'inline-flex';
    el.style.verticalAlign = 'top';

    const layerA = document.createElement('span');
    layerA.style.cssText = 'display:inline-flex;white-space:nowrap;';

    const layerB = document.createElement('span');
    // Start fully below — translateY(100%) = hidden below overflow:hidden container
    layerB.style.cssText = 'display:inline-flex;white-space:nowrap;position:absolute;top:0;left:0;transform:translateY(100%);pointer-events:none;';
    layerB.setAttribute('aria-hidden', 'true');

    [...text].forEach((ch) => {
      const a = document.createElement('span');
      const b = document.createElement('span');
      const char = ch === ' ' ? '\u00a0' : ch;
      a.textContent = char;
      b.textContent = char;
      const style = 'display:inline-block;transition:transform 0.5s cubic-bezier(0.2,0.8,0.2,1);will-change:transform;';
      a.style.cssText = style;
      b.style.cssText = style;
      layerA.appendChild(a);
      layerB.appendChild(b);
    });

    el.appendChild(layerA);
    el.appendChild(layerB);

    const spansA = [...layerA.children];
    const spansB = [...layerB.children];
    const stagger = (i) => i * 25 + 'ms';

    const enter = () => {
      spansA.forEach((s, i) => {
        s.style.transitionDelay = stagger(i);
        s.style.transform = 'translateY(-100%)';
      });
      spansB.forEach((s, i) => {
        s.style.transitionDelay = stagger(i);
        s.style.transform = 'translateY(-100%)';
      });
    };

    const leave = () => {
      if (mode === 'pingpong') {
        spansA.forEach((s, i) => {
          s.style.transitionDelay = stagger(spansA.length - 1 - i);
          s.style.transform = '';
        });
        spansB.forEach((s, i) => {
          s.style.transitionDelay = stagger(spansB.length - 1 - i);
          s.style.transform = '';
        });
      } else {
        spansA.forEach(s => { s.style.transitionDelay = '0ms'; s.style.transform = ''; });
        spansB.forEach(s => { s.style.transitionDelay = '0ms'; s.style.transform = ''; });
      }
    };

    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
  });
}
window.initLetterSwap = initLetterSwap;
