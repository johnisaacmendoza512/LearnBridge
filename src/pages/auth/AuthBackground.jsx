// Soft blue backdrop with decorative circles and a line-art "desk" strip along the bottom.
const STROKE = '#4F6FAE';

function gearPath(cx, cy, rOuter, rInner, teeth) {
  const pts = [];
  const step = (Math.PI * 2) / (teeth * 4);
  for (let i = 0; i < teeth * 4; i++) {
    const r = i % 4 < 2 ? rOuter : rInner;
    const a = i * step;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function DeskStrip() {
  const keys = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 12; c++) {
      keys.push(<rect key={`${r}-${c}`} x={12 + c * 20} y={12 + r * 20} width={15} height={15} rx={2} />);
    }
  }

  const swatches = [-30, -18, -6, 6];

  return (
    <svg viewBox="0 0 1440 200" preserveAspectRatio="xMidYMax meet"
      style={{ display: 'block', width: '100%', height: 'auto' }}
      fill="none" stroke={STROKE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">

      {/* Tablet with stylus */}
      <g transform="translate(40,70) rotate(-6)">
        <rect x={0} y={0} width={160} height={115} rx={12} />
        <rect x={12} y={12} width={136} height={91} rx={4} />
        <line x1={24} y1={30} x2={70} y2={30} />
        <circle cx={40} cy={30} r={4} />
        {[0, 1, 2, 3, 4].map(i => <circle key={i} cx={84 + i * 12} cy={30} r={4} />)}
        <path d="M100 60 c10 -12 28 -6 24 8 c-4 14 -24 14 -24 -8z" />
        <path d="M30 90 C60 50, 80 80, 110 50" />
        <path d="M-10 140 L20 110 C30 100 45 102 50 112 L40 150" />
        <line x1={34} y1={108} x2={92} y2={52} strokeWidth={3} />
      </g>

      {/* Venn diagram */}
      <g>
        <circle cx={258} cy={78} r={16} />
        <circle cx={248} cy={95} r={16} />
        <circle cx={268} cy={95} r={16} />
      </g>

      {/* Open spiral notebook */}
      <g transform="translate(300,105) rotate(-7)">
        <path d="M0 10 L80 0 L84 120 L4 130 Z" />
        <path d="M84 0 L164 8 L162 128 L84 120" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <line key={i} x1={74} y1={14 + i * 12} x2={94} y2={14 + i * 12} />
        ))}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <line key={`l${i}`} x1={14} y1={30 + i * 14} x2={62} y2={26 + i * 14} strokeWidth={1.5} />
        ))}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <line key={`r${i}`} x1={104} y1={26 + i * 14} x2={150} y2={30 + i * 14} strokeWidth={1.5} />
        ))}
      </g>

      {/* Gear */}
      <g>
        <path d={gearPath(530, 145, 26, 20, 10)} />
        <circle cx={530} cy={145} r={9} />
      </g>

      {/* Keyboard with hand */}
      <g transform="translate(640,95) rotate(-28)">
        <rect x={0} y={0} width={256} height={116} rx={8} />
        {keys}
      </g>
      <path d="M600 200 C620 170 650 160 680 168 L720 150 C730 146 736 156 728 162 L700 180" />

      {/* Pen */}
      <g transform="translate(1000,55) rotate(14)">
        <rect x={0} y={0} width={26} height={170} rx={8} />
        <rect x={6} y={14} width={14} height={40} rx={4} />
        <line x1={13} y1={-6} x2={13} y2={0} />
      </g>

      {/* Highlighter */}
      <g transform="translate(1120,70) rotate(38)">
        <path d="M0 30 L10 0 L24 0 L34 30 Z" />
        <rect x={0} y={30} width={34} height={40} rx={4} />
        <rect x={2} y={70} width={30} height={110} rx={6} />
      </g>

      {/* Coffee mug (top view) */}
      <g>
        <circle cx={1245} cy={170} r={48} />
        <circle cx={1245} cy={170} r={40} />
        <path d="M1292 156 L1318 152 C1326 151 1328 168 1320 170 L1294 176" />
      </g>

      {/* Color swatch fan */}
      <g>
        {swatches.map((a, i) => (
          <g key={i} transform={`rotate(${a} 1355 220)`}>
            <rect x={1335} y={100} width={40} height={120} rx={3} fill="#EEF3FD" />
            {[0, 1, 2, 3].map(j => (
              <line key={j} x1={1335} y1={116 + j * 18} x2={1375} y2={116 + j * 18} strokeWidth={1.5} />
            ))}
          </g>
        ))}
      </g>

      {/* Triangle ruler */}
      <g>
        <path d="M1380 205 L1440 120 L1440 205 Z" />
        <path d="M1402 196 L1430 157 L1430 196 Z" />
        {[0, 1, 2, 3, 4, 5].map(i => (
          <line key={i} x1={1388 + i * 9} y1={205} x2={1388 + i * 9} y2={198} strokeWidth={1.5} />
        ))}
      </g>
    </svg>
  );
}

export default function AuthBackground() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{
        position: 'absolute', width: '58vw', height: '58vw', maxWidth: 900, maxHeight: 900,
        borderRadius: '50%', background: '#E3ECFC', top: '-12vw', right: '-6vw',
      }} />
      <div style={{
        position: 'absolute', width: '48vw', height: '48vw', maxWidth: 760, maxHeight: 760,
        borderRadius: '50%', background: '#DCE7FB', opacity: 0.7, bottom: '-26vw', right: '-14vw',
      }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, opacity: 0.75 }}>
        <DeskStrip />
      </div>
    </div>
  );
}
