import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import tokens from '../../lib/tokens';

const pageNames = {
  '/dashboard':          'Dashboard',
  '/my-children':        'My Children',
  '/find-tutors':        'Find Tutors',
  '/bookings':           'Bookings',
  '/progress':           'Progress',
  '/messages':           'Messages',
  '/my-profile':         'My Profile',
  '/certification':      'AI Certification',
  '/sessions':           'Sessions',
  '/question-bank':      'Question Bank',
  '/wallet':             'Wallet',
  '/tutor-verification': 'Tutor Verification',
  '/users':              'User Management',
  '/transactions':       'Transactions',
  '/settings':           'Settings',
};

export default function Topbar() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = pageNames[pathname] || 'LearnBridge';

  const { announcements, unreadCount, readIds, markRead, markAllRead } = useAnnouncements();

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBellClick = () => {
    setShowDropdown(prev => !prev);
  };

  const handleAnnouncementClick = (a) => {
    markRead(a.id);
    setShowDropdown(false);
    navigate('/messages');
  };

  return (
    <header style={{
      height: 64, background: '#fff',
      borderBottom: `1px solid ${tokens.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
    }}>
      <h1 className="font-jakarta font-bold" style={{ fontSize: 16, color: tokens.dark }}>
        {title}
      </h1>

      <div className="flex items-center gap-12">

        {/* ── Notification Bell ── */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={handleBellClick}
            style={{
              position: 'relative', width: 38, height: 38,
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: showDropdown ? tokens.primaryLight : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            title="Announcements"
          >
            <Icon
              name="bell"
              size={19}
              color={showDropdown ? tokens.primary : tokens.mid}
            />
            {/* Red dot indicator — shows when there are unread announcements */}
            {unreadCount > 0 && (
              <div style={{
                position: 'absolute', top: 6, right: 6,
                width: 16, height: 16, borderRadius: '50%',
                background: tokens.danger,
                border: '2px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800, color: '#fff',
                animation: 'pulse 2s infinite',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </button>

          {/* ── Dropdown Panel ── */}
          {showDropdown && (
            <div style={{
              position: 'absolute', top: 46, right: 0,
              width: 340, maxHeight: 420,
              background: '#fff', borderRadius: 14,
              border: `1px solid ${tokens.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,.12)',
              overflow: 'hidden', zIndex: 200,
            }}>
              {/* Header */}
              <div style={{
                padding: '14px 18px', borderBottom: `1px solid ${tokens.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#FAFAFA',
              }}>
                <div className="font-jakarta font-bold" style={{ fontSize: 14 }}>
                  Announcements
                  {unreadCount > 0 && (
                    <span style={{
                      marginLeft: 8, padding: '2px 8px', borderRadius: 20,
                      background: tokens.danger, color: '#fff',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      fontSize: 11, color: tokens.primary, fontWeight: 600,
                      background: 'none', border: 'none', cursor: 'pointer',
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Announcement list */}
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {announcements.length === 0 ? (
                  <div style={{ padding: '24px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📢</div>
                    <p className="text-sm text-muted">No announcements yet</p>
                  </div>
                ) : (
                  announcements.map(a => {
                    const isUnread = !readIds.has(a.id);
                    return (
                      <div
                        key={a.id}
                        onClick={() => handleAnnouncementClick(a)}
                        style={{
                          padding: '12px 18px', cursor: 'pointer',
                          borderBottom: `1px solid ${tokens.border}`,
                          background: isUnread ? '#FFFBEB' : '#fff',
                          transition: 'background 0.15s',
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                        onMouseLeave={e => e.currentTarget.style.background = isUnread ? '#FFFBEB' : '#fff'}
                      >
                        {/* Unread indicator dot */}
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: isUnread ? tokens.danger : 'transparent',
                          marginTop: 5,
                        }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div className="font-semibold" style={{ fontSize: 13, marginBottom: 3 }}>
                            {a.title}
                          </div>
                          <div className="text-xs text-muted truncate">{a.body}</div>
                          <div className="text-xs" style={{ color: tokens.muted, marginTop: 4 }}>
                            {formatDate(a.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '10px 18px', borderTop: `1px solid ${tokens.border}`,
                background: '#FAFAFA',
              }}>
                <button
                  onClick={() => { setShowDropdown(false); navigate('/messages'); }}
                  style={{
                    width: '100%', padding: '8px', borderRadius: 8,
                    background: 'none', border: `1px solid ${tokens.border}`,
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    color: tokens.primary,
                  }}
                >
                  View All in Messages →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <Avatar name={profile?.full_name || 'U'} size={34} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </header>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}