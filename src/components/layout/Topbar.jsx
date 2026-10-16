import { useLocation } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
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
  '/modules':            'Modules',
  '/quizzes':            'Quizzes',
};

export default function Topbar({ onMenuClick }) {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const title = pageNames[pathname] || 'LearnBridge';

  return (
    <header className="app-topbar" style={{
      background: '#fff',
      borderBottom: `1px solid ${tokens.border}`,
      display: 'flex', alignItems: 'center', gap: 12,
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <button className="menu-toggle" onClick={onMenuClick} aria-label="Open menu">
        <span /><span /><span />
      </button>
      <div className="app-topbar-title" style={{ fontWeight: 700, fontSize: 16, color: tokens.dark }}>{title}</div>
    </header>
  );
}