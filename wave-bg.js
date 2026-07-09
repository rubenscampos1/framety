/* wave-bg.js — Fixed canvas wave background. Plain JS, no deps. */
(function() {
  const canvas = document.createElement('canvas');
  canvas.id = 'wave-bg';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:0;transition:opacity 2.5s ease;';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  const SCALE = 3; // lower res for perf; upscale via drawImage
  let width, height, imageData, data, offscreen;

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    width  = Math.max(1, Math.floor(canvas.width  / SCALE));
    height = Math.max(1, Math.floor(canvas.height / SCALE));
    offscreen = document.createElement('canvas');
    offscreen.width  = width;
    offscreen.height = height;
    imageData = offscreen.getContext('2d').createImageData(width, height);
    data = imageData.data;
  };
  window.addEventListener('resize', resize);
  resize();

  const SIN = new Float32Array(1024);
  const COS = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const a = (i / 1024) * Math.PI * 2;
    SIN[i] = Math.sin(a);
    COS[i] = Math.cos(a);
  }
  const fSin = x => SIN[Math.floor(((x % (Math.PI*2)) / (Math.PI*2)) * 1024) & 1023];
  const fCos = x => COS[Math.floor(((x % (Math.PI*2)) / (Math.PI*2)) * 1024) & 1023];

  const startTime = Date.now();
  let hidden = false;
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; });

  const render = () => {
    if (!hidden) {
      const t = (Date.now() - startTime) * 0.001;
      const octx = offscreen.getContext('2d');
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const ux = (2*x - width)  / height;
          const uy = (2*y - height) / height;
          let a = 0, d = 0;
          for (let i = 0; i < 4; i++) {
            a += fCos(i - d + t*0.5 - a*ux);
            d += fSin(i*uy + a);
          }
          const w   = (fSin(a) + fCos(d)) * 0.5;
          const int = 0.30 + 0.40 * w;
          const bv  = 0.07 + 0.10 * fCos(ux + uy + t*0.3);
          const ba  = 0.18 * fSin(a*1.5 + t*0.2);
          const pa  = 0.12 * fCos(d*2 + t*0.1);
          const idx = (y * width + x) * 4;
          data[idx]   = Math.max(0, Math.min(255, (bv + pa*0.8) * int * 255));
          data[idx+1] = Math.max(0, Math.min(255, (bv + ba*0.6) * int * 255));
          data[idx+2] = Math.max(0, Math.min(255, (bv + ba*1.2 + pa*0.4) * int * 255));
          data[idx+3] = 255;
        }
      }
      octx.putImageData(imageData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(offscreen, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(render);
  };
  render();
})();
