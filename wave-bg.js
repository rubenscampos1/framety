/* wave-bg.js — fundo animado do site.

   Porte do "dimensional field" (feixes de luz em ruído simplex + esferas de
   vidro com fresnel) para dentro da própria página. O componente original vinha
   embrulhado num <iframe srcdoc> que buscava three.js e tailwind no cdnjs: o CSP
   do site (server.js) só libera script de 'self' e unpkg, e frame-src apenas do
   YouTube/Vimeo — o iframe simplesmente não carregaria. Rodando aqui, o fundo
   ainda ganha duas coisas que o iframe não teria: segue a cor de destaque
   publicada no console (window.__waveBgAccent) e para de desenhar com a aba
   escondida.

   O canvas é o mesmo de antes (#wave-bg, z-index -1, opacity 0 até o app.jsx
   liberar depois da abertura). Sem three.js disponível, cai num gradiente
   estático em vez de deixar o fundo preto. */
(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'wave-bg';
  // O desfoque é filtro de CSS numa camada só (barato). A escala de 1.12 existe
  // por causa dele: sem sobra, o blur puxaria o vazio de fora e deixaria uma
  // moldura clara em volta da tela.
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:0;transition:opacity 2.5s ease;transform:scale(1.12);filter:blur(9px);will-change:transform;';
  document.body.prepend(canvas);

  const ACCENT_FALLBACK = '#2E86C1';
  const hexToRgb = (hex) => {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
    const v = parseInt(m ? m[1] : ACCENT_FALLBACK.slice(1), 16);
    return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
  };
  const readAccent = () => {
    const fromCss = getComputedStyle(document.documentElement).getPropertyValue('--accent');
    return hexToRgb(fromCss || ACCENT_FALLBACK);
  };

  if (!window.THREE) {
    // three.js não chegou (offline, bloqueio de rede): um gradiente parado
    // ainda é melhor do que o vazio preto atrás do site.
    canvas.style.background =
      'radial-gradient(120% 90% at 22% 8%, rgba(46,134,193,0.30), transparent 60%), ' +
      'radial-gradient(90% 70% at 85% 90%, rgba(20,60,110,0.35), transparent 65%), #05060a';
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  // Metade da resolução: o desfoque por cima esconde a diferença, e o custo do
  // borrão de tela cheia (refeito a cada quadro, porque o canvas redesenha)
  // cai junto com a área. Era o maior peso da página.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1) * 0.5);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 12;

  const accent = readAccent();
  const uniforms = {
    u_time:       { value: 0 },
    u_resolution: { value: new THREE.Vector2() },
    // rolagem da página em "telas" (1.0 = uma altura de viewport)
    u_scroll:     { value: 0 },
    // cor 1: o destaque do site. cor 2: o azul claro de aço da referência —
    // é o contraste entre os dois que faz o feixe de luz aparecer.
    u_color1: { value: new THREE.Color(accent.r, accent.g, accent.b) },
    u_color2: { value: new THREE.Color(0.66, 0.80, 0.88) },
  };

  const snoise = `
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
  `;

  const bgMaterial = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
    fragmentShader: `
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform float u_scroll;
      ${snoise}
      void main() {
        vec2 screen = gl_FragCoord.xy / u_resolution.xy;
        // o campo desliza com a página; a vinheta abaixo continua presa à tela
        vec2 uv = screen + vec2(0.0, u_scroll * 0.35);
        uv.x *= u_resolution.x / u_resolution.y;

        vec3 baseColor = vec3(0.02, 0.02, 0.03);
        vec2 st = uv * 0.5;
        st += vec2(snoise(st + u_time * 0.04), snoise(st - u_time * 0.04)) * 0.4;

        float beam = smoothstep(0.2, 0.9, snoise(vec2(st.x + st.y * 2.0 - u_time * 0.1, u_time * 0.03)));
        vec3 glow = mix(u_color1, u_color2, snoise(uv * 2.0 + u_time * 0.15) * 0.5 + 0.5);

        float dist = distance(screen, vec2(0.5));
        float vignette = smoothstep(1.5, 0.1, dist);

        vec3 edgeColor = vec3(0.01, 0.01, 0.015);
        vec3 colorGlow = mix(baseColor, glow, beam * 0.6);

        gl_FragColor = vec4(mix(edgeColor, colorGlow, vignette), 1.0);
      }
    `,
    uniforms,
    depthWrite: false,
    depthTest: false,
  });

  const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMaterial);
  bgMesh.position.z = -15;
  scene.add(bgMesh);

  const glassMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      varying vec3 vNormal;
      ${snoise}
      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        uv += vNormal.xy * 0.2;
        uv.x *= u_resolution.x / u_resolution.y;

        vec3 baseColor = vec3(0.04, 0.04, 0.06);
        vec2 st = uv * 0.6;
        st += vec2(snoise(st + u_time * 0.06), snoise(st - u_time * 0.06)) * 0.35;

        float beam = smoothstep(0.1, 0.9, snoise(vec2(st.x + st.y * 1.8 - u_time * 0.12, u_time * 0.02)));
        vec3 glow = mix(u_color1, u_color2, snoise(uv * 1.8 + u_time * 0.12) * 0.5 + 0.5);

        float fresnel = clamp(1.0 - dot(vec3(0.0, 0.0, 1.0), vNormal), 0.0, 1.0);
        fresnel = pow(fresnel, 2.5);

        vec3 finalColor = mix(baseColor, glow, clamp((beam * 0.45) + (fresnel * 0.7), 0.0, 1.0));
        gl_FragColor = vec4(finalColor, 0.9);
      }
    `,
    uniforms,
    transparent: true,
  });

  const sphereGeo = new THREE.SphereGeometry(1, 48, 48);
  // As esferas moram num grupo só para subirem juntas conforme a página rola.
  const orbGroup = new THREE.Group();
  scene.add(orbGroup);
  const spheres = [];
  [
    { scale: 4.2,  x:  6.5, y: -1.2, z: -1.5, speed: 0.002 },
    { scale: 1.8,  x: -6.0, y: -4.0, z:  2.5, speed: 0.004 },
    { scale: 1.1,  x: -4.5, y:  4.2, z: -2.0, speed: 0.005 },
    { scale: 0.75, x:  3.0, y:  5.5, z:  4.0, speed: 0.008 },
  ].forEach((data) => {
    const mesh = new THREE.Mesh(sphereGeo, glassMaterial);
    mesh.scale.set(data.scale, data.scale, data.scale);
    mesh.position.set(data.x, data.y, data.z);
    orbGroup.add(mesh);
    spheres.push({ mesh, baseY: data.y, speed: data.speed, offset: Math.random() * Math.PI * 2 });
  });

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // o plano do fundo cobre exatamente o frustum na profundidade dele
    const dist = camera.position.z - bgMesh.position.z;
    const planeHeight = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
    bgMesh.scale.set(planeHeight * camera.aspect / 2, planeHeight / 2, 1);

    uniforms.u_resolution.value.set(width, height);
  };
  window.addEventListener('resize', resize);
  resize();

  // Paralaxe do ponteiro — só no mouse: no toque a câmera fica parada.
  let mouseX = 0, mouseY = 0;
  if (!window.matchMedia('(pointer: coarse)').matches) {
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX - window.innerWidth / 2;
      mouseY = e.clientY - window.innerHeight / 2;
    }, { passive: true });
  }

  // Rolagem: o fundo anda junto com a página, mais devagar que o conteúdo — o
  // suficiente para não parecer papel de parede pregado na tela.
  // A posição é lida no próprio quadro, e não num listener de 'scroll': com o
  // body como container de rolagem (overflow:hidden auto no styles.css) o evento
  // não chega à window, e o fundo ficaria parado. Ler no rAF também dispensa
  // debounce — já roda uma vez por quadro.
  let scrollEased = 0;
  const scrollNow = () => {
    const el = document.scrollingElement || document.documentElement;
    const y = window.scrollY || el.scrollTop || document.body.scrollTop || 0;
    return y / Math.max(1, window.innerHeight);
  };

  // A cor de destaque publicada no console entra aqui (ver FRAMETY_APPLY_ACCENT).
  window.__waveBgAccent = (hex) => {
    const c = hexToRgb(hex);
    uniforms.u_color1.value.setRGB(c.r, c.g, c.b);
  };

  let hidden = document.hidden;
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
  // Telas cheias (página do cliente, player) escondem o fundo: enquanto uma
  // estiver aberta, não há por que desenhar — ver _scrollLock em landing.jsx.
  let covered = false;
  window.__waveBgPause = (v) => { covered = !!v; };
  const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clock = new THREE.Clock();
  const render = () => {
    requestAnimationFrame(render);
    if (hidden || covered) return;            // aba escondida ou fundo coberto: não gasta GPU
    const time = stillMotion ? 8 : clock.getElapsedTime();
    uniforms.u_time.value = time;

    scrollEased += (scrollNow() - scrollEased) * 0.08;
    uniforms.u_scroll.value = scrollEased;
    orbGroup.position.y = scrollEased * 3.2;

    camera.position.x += (mouseX * 0.004 - camera.position.x) * 0.05;
    camera.position.y += (-mouseY * 0.004 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    if (!stillMotion) {
      spheres.forEach((s) => {
        s.mesh.position.y = s.baseY + Math.sin(time * s.speed * 120 + s.offset) * 0.5;
        s.mesh.rotation.x = time * s.speed * 18;
        s.mesh.rotation.y = time * s.speed * 24;
      });
    }
    renderer.render(scene, camera);
  };
  render();
})();
