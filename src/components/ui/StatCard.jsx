import Icon from './Icon';
import tokens from '../../lib/tokens';

const accentMap = {
  primary:   { border: tokens.primary,   bg: tokens.primaryLight, color: tokens.primary   },
  secondary: { border: tokens.secondary, bg: '#FEF3C7',           color: '#92400E'        },
  teal:      { border: tokens.accent,    bg: '#CCFBF1',           color: tokens.accent    },
  coral:     { border: tokens.coral,     bg: '#FFE4E6',           color: tokens.coral     },
  success:   { border: tokens.success,   bg: '#D1FAE5',           color: tokens.success   },
  warning:   { border: tokens.warning,   bg: '#FEF3C7',           color: tokens.warning   },
  danger:    { border: tokens.danger,    bg: '#FEE2E2',           color: tokens.danger    },
};

export default function StatCard({ label, value, icon, accent = 'primary', sub }) {
  // Fallback to 'primary' if an unknown accent is passed — prevents crash
  const { border, bg, color } = accentMap[accent] || accentMap['primary'];

  return (
    <div className="card" style={{ padding: '20px 24px', borderLeft: `4px solid ${border}` }}>
      <div className="flex items-center justify-between mb-8">
        <span className="text-xs uppercase font-semibold text-muted">{label}</span>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={16} color={color} />
        </div>
      </div>
      <div className="font-jakarta font-extrabold text-2xl">{value}</div>
      {sub && <div className="text-xs text-muted mt-4">{sub}</div>}
    </div>
  );
}