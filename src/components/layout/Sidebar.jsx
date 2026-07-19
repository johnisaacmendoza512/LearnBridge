import { NavLink } from 'react-router-dom';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import tokens from '../../lib/tokens';

const navItems = {
  parent: [
    { to: '/dashboard',     label: 'Dashboard',    icon: 'home'      },
    { to: '/my-profile',    label: 'My Profile',   icon: 'user'      },
    { to: '/my-children',   label: 'My Children',  icon: 'users'     },
    { to: '/find-tutors',   label: 'Find Tutors',  icon: 'search'    },
    { to: '/sessions',      label: 'Sessions',     icon: 'book'      },
    { to: '/bookings',      label: 'Bookings',     icon: 'calendar'  },
    { to: '/wallet',        label: 'Wallet',       icon: 'wallet'    },
    { to: '/messages',      label: 'Messages',     icon: 'message',  badge: true },
  ],
  tutor: [
    { to: '/dashboard',     label: 'Dashboard',    icon: 'home'      },
    { to: '/my-profile',    label: 'My Profile',   icon: 'user'      },
    { to: '/certification', label: 'Certification',icon: 'award'     },
    { to: '/bookings',      label: 'Bookings',     icon: 'calendar'  },
    { to: '/sessions',      label: 'Sessions',     icon: 'book'      },
    { to: '/question-bank', label: 'Question Bank',icon: 'clipboard' },
    { to: '/wallet',        label: 'Wallet',       icon: 'wallet'    },
    { to: '/messages',      label: 'Messages',     icon: 'message',  badge: true },
  ],
  admin: [
    { to: '/dashboard',          label: 'Dashboard',    icon: 'home'      },
    { to: '/tutor-verification', label: 'Verification', icon: 'shield'    },
    { to: '/users',              label: 'Users',        icon: 'users'     },
    { to: '/question-bank',      label: 'Question Bank',icon: 'clipboard' },
    { to: '/sessions',           label: 'All Sessions', icon: 'calendar'  },
    { to: '/transactions',       label: 'Transactions', icon: 'wallet'    },
    { to: '/messages',           label: 'Messages',     icon: 'message'   },
  ],
};

export default function Sidebar() {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useAnnouncements();
  const items = navItems[profile?.role] || navItems.parent;

  return (
    <aside style={{
      width: 240, minHeight: '100vh', background: tokens.dark,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div className="flex items-center gap-8">
          <img
            src={require('../../assets/learnbridge-logo.png')}
            alt="LearnBridge"
            style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: "'Plus Jakarta Sans'" }}>
              LearnBridge
            </div>
            <div style={{ color: '#6B7280', fontSize: 11, textTransform: 'capitalize' }}>
              {profile?.role || 'User'}
            </div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 20px', margin: '2px 10px', borderRadius: 8,
              color: isActive ? '#fff' : '#9CA3AF',
              background: isActive ? tokens.primary : 'transparent',
              fontWeight: 500, fontSize: 14,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              textDecoration: 'none',
              transition: 'all .15s',
              position: 'relative',
            })}
          >
            <Icon name={item.icon} size={16} color="currentColor" />
            <span style={{ flex: 1 }}>{item.label}</span>
            {/* Unread announcement badge — only for parent/tutor Messages link */}
            {item.badge && unreadCount > 0 && (
              <div style={{
                minWidth: 18, height: 18, borderRadius: 9,
                background: tokens.danger, color: '#fff',
                fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User strip + sign-out */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <div className="flex items-center gap-10 mb-12">
          <Avatar name={profile?.full_name || 'U'} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="truncate" style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
              {profile?.full_name || 'User'}
            </div>
            <div className="truncate" style={{ color: '#6B7280', fontSize: 11 }}>
              {profile?.email}
            </div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="btn btn-ghost btn-sm btn-full"
          style={{ color: '#9CA3AF', justifyContent: 'center' }}
        >
          <Icon name="logout" size={14} color="#9CA3AF" /> Sign Out
        </button>
      </div>
    </aside>
  );
}