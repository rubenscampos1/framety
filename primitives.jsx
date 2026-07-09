/* primitives.jsx — shared bits */
const { useEffect, useRef, useState, useLayoutEffect, useCallback } = React;

/* SVG icon set (small, no extra deps) */
const Icon = ({ name, size = 16, stroke = 1.6, ...rest }) => {
  const s = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", ...rest };
  switch (name) {
    case "arrow-right": return <svg {...s}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case "chevron-left": return <svg {...s}><polyline points="15 18 9 12 15 6"/></svg>;
    case "chevron-right": return <svg {...s}><polyline points="9 18 15 12 9 6"/></svg>;
    case "arrow-up-right": return <svg {...s}><path d="M7 17L17 7M9 7h8v8"/></svg>;
    case "play": return <svg {...s} fill="currentColor" stroke="none"><path d="M6 4l14 8-14 8V4z"/></svg>;
    case "play-line": return <svg {...s}><path d="M6 4l14 8-14 8V4z"/></svg>;
    case "x": return <svg {...s}><path d="M18 6L6 18M6 6l12 12"/></svg>;
    case "search": return <svg {...s}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case "plus": return <svg {...s}><path d="M12 5v14M5 12h14"/></svg>;
    case "edit": return <svg {...s}><path d="M11 4H4v16h16v-7"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
    case "trash": return <svg {...s}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>;
    case "grip": return <svg {...s}><circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/></svg>;
    case "video": return <svg {...s}><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4V8z"/></svg>;
    case "folder": return <svg {...s}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>;
    case "stats": return <svg {...s}><path d="M3 3v18h18M7 14l3-3 4 4 6-6"/></svg>;
    case "settings": return <svg {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1A2 2 0 117 4.6l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/></svg>;
    case "logout": return <svg {...s}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
    case "eye": return <svg {...s}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "upload": return <svg {...s}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>;
    case "pause": return <svg {...s} fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
    case "volume": return <svg {...s}><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>;
    case "fullscreen": return <svg {...s}><path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"/></svg>;
    case "menu": return <svg {...s}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
    case "grid": return <svg {...s}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
    case "list": return <svg {...s}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>;
    case "users": return <svg {...s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
    case "star": return <svg {...s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case "external": return <svg {...s}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
    case "share": return <svg {...s}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
    case "chevron-down": return <svg {...s}><polyline points="6 9 12 15 18 9"/></svg>;
    case "chevron-up": return <svg {...s}><polyline points="18 15 12 9 6 15"/></svg>;
    case "check": return <svg {...s}><polyline points="20 6 9 17 4 12"/></svg>;
    case "send": return <svg {...s}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
    case "loader": return <svg {...s}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>;
    case "help": return <svg {...s}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "sparkles": return <svg {...s}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z"/><path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z"/></svg>;
    case "copy": return <svg {...s}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
    case "filter": return <svg {...s}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
    case "download": return <svg {...s}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>;
    default: return null;
  }
};

/* Custom cursor */
const CustomCursor = () => null;



/* Synthetic reel — cycles between colored frames as a stand-in for a real demo reel */
const SyntheticReel = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(p => (p + 1) % 4), 4200);
    return () => clearInterval(id);
  }, []);
  const frames = [
    { cls: "f1", label: "Reel · Atlas Motors · 02:14" },
    { cls: "f2", label: "Reel · Saturn Festival · 03:42" },
    { cls: "f3", label: "Reel · Nova Music · 04:08" },
    { cls: "f4", label: "Reel · Mata Atlântica · 26:00" },
  ];
  return (
    <div className="reel-frames">
      {frames.map((f, idx) => (
        <div key={idx} className={`reel-frame ${f.cls} ${idx === i ? "active" : ""}`}>
          <div className="placeholder-mark">[ DEMO REEL · DROP VIDEO HERE ]</div>
          <div className="label">{f.label}</div>
        </div>
      ))}
      <div className="reel-scanline" />
    </div>
  );
};

/* Magnetic button — light cursor magnet */
const Magnetic = ({ children, strength = 0.1, ...rest }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width/2;
      const y = e.clientY - r.top - r.height/2;
      el.style.transform = `translate(${x*strength}px, ${y*strength}px)`;
    };
    const onLeave = () => { el.style.transform = ""; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [strength]);
  return <span ref={ref} style={{ display: "inline-block", transition: "transform 0.5s cubic-bezier(.2,.8,.2,1)" }} {...rest}>{children}</span>;
};

/* Spotlight / Glow Card — replicates the 21st.dev effect */
const SpotlightCard = ({ children, className = "", color = "red", style = {}, overlay = true, ...rest }) => {
  const cardRef = useRef(null);

  const colorMap = {
    blue:   { base: 220, spread: 200 },
    purple: { base: 280, spread: 300 },
    green:  { base: 120, spread: 200 },
    red:    { base: 355, spread: 0 },
    orange: { base: 30,  spread: 200 }
  };

  useEffect(() => {
    const syncPointer = (e) => {
      const { clientX: x, clientY: y } = e;
      if (cardRef.current) {
        cardRef.current.style.setProperty('--x', x.toFixed(2));
        cardRef.current.style.setProperty('--xp', (x / window.innerWidth).toFixed(2));
        cardRef.current.style.setProperty('--y', y.toFixed(2));
        cardRef.current.style.setProperty('--yp', (y / window.innerHeight).toFixed(2));
      }
    };
    document.addEventListener('pointermove', syncPointer);
    return () => document.removeEventListener('pointermove', syncPointer);
  }, []);

  const { base, spread } = colorMap[color] || colorMap.red;

  const glowStyles = {
    '--base':           base,
    '--spread':         spread,
    '--radius':         '14',
    '--border':         '2',
    '--backdrop':       'rgba(255,255,255,0.04)',
    '--backup-border':  'var(--backdrop)',
    '--size':           '250',
    '--outer':          '1',
    '--border-size':    'calc(var(--border, 2) * 1px)',
    '--spotlight-size': 'calc(var(--size, 150) * 1px)',
    '--hue':            'calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))',
    backgroundImage: `radial-gradient(
      var(--spotlight-size) var(--spotlight-size) at
      calc(var(--x, 0) * 1px)
      calc(var(--y, 0) * 1px),
      hsl(var(--hue, 355) 100% 60% / 0.18), transparent
    )`,
    backgroundColor:      'var(--backdrop, transparent)',
    backgroundSize:       'calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))',
    backgroundPosition:   '50% 50%',
    backgroundAttachment: 'fixed',
    border:               'var(--border-size) solid var(--backup-border)',
    position:             'relative',
    touchAction:          'none',
    ...style
  };

  const css = `
    [data-glow]::before,
    [data-glow]::after {
      pointer-events: none;
      content: "";
      position: absolute;
      inset: calc(var(--border-size) * -1);
      border: var(--border-size) solid transparent;
      border-radius: calc(var(--radius) * 1px);
      background-attachment: fixed;
      background-size: calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));
      background-repeat: no-repeat;
      background-position: 50% 50%;
      mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
      -webkit-mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
      mask-clip: padding-box, border-box;
      -webkit-mask-clip: padding-box, border-box;
      mask-composite: intersect;
      -webkit-mask-composite: source-in, xor;
    }
    [data-glow]::before {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at
        calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
        hsl(var(--hue, 355) 100% 50% / 1), transparent 100%
      );
      filter: brightness(2);
    }
    [data-glow]::after {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at
        calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
        hsl(0 100% 100% / 0.18), transparent 100%
      );
    }
    [data-glow] [data-glow] {
      position: absolute; inset: 0;
      will-change: filter;
      opacity: var(--outer, 1);
      border-radius: calc(var(--radius) * 1px);
      filter: blur(calc(var(--border-size) * 10));
      background: none; pointer-events: none; border: none;
    }
    [data-glow] > [data-glow]::before { inset: -10px; border-width: 10px; }
  `;

  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div ref={cardRef} data-glow style={glowStyles} className={`spotlight-card ${className}`} {...rest}>
        {overlay && <div data-glow />}
        {children}
      </div>
    </React.Fragment>
  );
};

Object.assign(window, { Icon, CustomCursor, SyntheticReel, Magnetic, SpotlightCard });
