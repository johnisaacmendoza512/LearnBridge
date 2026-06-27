import Icon from './Icon';

export default function Modal({ open, onClose, title, children, footer, maxWidth = 540 }) {
  if (!open) return null;
  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
               alignItems:'center', justifyContent:'center', zIndex:1000, padding:24 }}
      onClick={onClose}
    >
      <div
        className="card fade-in"
        style={{ width:'100%', maxWidth, maxHeight:'90vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="card-header">
          <h3 className="font-jakarta font-bold" style={{ fontSize:18 }}>{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="card-body">{children}</div>

        {/* Footer */}
        {footer && <div className="card-footer">{footer}</div>}
      </div>
    </div>
  );
}
