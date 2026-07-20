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

export default function Topbar() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const title = pageNames[pathname] || 'LearnBridge';

  return (
    <header style={{
      height: 64, background: '#fff',
      borderBottom: `1px solid ${tokens.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
    }}>
    </header>
  );
}