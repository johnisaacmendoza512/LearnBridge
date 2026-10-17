import tokens from '../../lib/tokens';
import logo from '../../assets/logo-mark.png';

const colorMap = ['#3D3BF3','#0D9488','#F5A623','#F25C54','#8B5CF6','#EC4899'];

export default function Avatar({ name = 'U', size = 36, colorIndex = 0, src = null, role = null }) {
  const bg = colorMap[colorIndex % colorMap.length];

  // Admin always shows the LearnBridge logo
  if (role === 'admin') {
    return (
      <img src={logo} alt="LearnBridge" style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'contain',
        background: '#fff', padding: size * 0.08, flexShrink: 0,
        border: `1px solid ${tokens.border}`,
      }} />
    );
  }

  if (src) {
    return (
      <img src={src} alt={name} style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        flexShrink: 0, border: `2px solid ${bg}30`,
      }} />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg + '25', color: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.38,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      border: `2px solid ${bg}30`,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
