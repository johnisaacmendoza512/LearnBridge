import tokens from '../../lib/tokens';

const TYPE_CONFIG = {
  success: { icon: '✅', color: '#16A34A', bg: '#D1FAE5', border: '#6EE7B7' },
  error:   { icon: '❌', color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' },
  warning: { icon: '⚠️', color: '#92400E', bg: '#FEF9C3', border: '#FDE68A' },
  info:    { icon: 'ℹ️', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  confirm: { icon: '❓', color: '#7C3AED', bg: '#EDE9FE', border: '#C4B5FD' },
};

export default function AppDialog({
  open,
  type         = 'info',
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel  = 'Confirm',
  cancelLabel   = 'Cancel',
  confirmDanger = false,
}) {
  if (!open) return null;
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div className="fade-in" style={{
        background: '#fff', borderRadius: 20,
        width: '100%', maxWidth: 420,
        padding: 36, boxShadow: '0 20px 60px rgba(0,0,0,.2)',
      }}>
        {/* Icon circle */}
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: cfg.bg, border: `2px solid ${cfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 28,
        }}>
          {cfg.icon}
        </div>

        {/* Title */}
        {title && (
          <h3 className="font-jakarta font-extrabold text-center" style={{
            fontSize: 18, color: tokens.dark, marginBottom: 10,
          }}>
            {title}
          </h3>
        )}

        {/* Message */}
        <p style={{
          fontSize: 14, color: tokens.mid, lineHeight: 1.7,
          textAlign: 'center', marginBottom: 28,
          whiteSpace: 'pre-line',
        }}>
          {message}
        </p>

        {/* Buttons */}
        {type === 'confirm' ? (
          <div className="flex gap-10">
            <button className="btn btn-ghost btn-full" onClick={onClose}>
              {cancelLabel}
            </button>
            <button
              className="btn btn-full"
              onClick={onConfirm}
              style={{
                background: confirmDanger ? '#DC2626' : tokens.primary,
                color: '#fff',
              }}
            >
              {confirmLabel}
            </button>
          </div>
        ) : (
          <button
            className="btn btn-full btn-lg"
            onClick={onClose}
            style={{ background: cfg.color, color: '#fff' }}
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
}
