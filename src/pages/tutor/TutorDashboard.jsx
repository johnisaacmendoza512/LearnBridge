import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTutorDashboard } from '../../hooks/useTutorDashboard';
import { useWallet } from '../../hooks/useWallet';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

export default function TutorDashboard() {
  const { profile }  = useAuth();
  const navigate     = useNavigate();
  const { balance }  = useWallet();
  const {
    stats, todaySessions, pendingBookings,
    loading, error, respondToBooking, refresh,
  } = useTutorDashboard();

  const [responding, setResponding] = useState({});

  const name = profile?.full_name?.split(' ')[0] || 'Tutor';

  const handleRespond = async (bookingId, accept) => {
    setResponding(r => ({ ...r, [bookingId]: true }));
    try {
      await respondToBooking(bookingId, accept);
    } catch (e) {
      alert(e.message);
    } finally {
      setResponding(r => ({ ...r, [bookingId]: false }));
    }
  };

  if (loading) return <Spinner dark size={32} />;

  if (error) return (
    <div className="card p-24 text-center">
      <p className="text-sm mb-12" style={{ color: tokens.danger }}>
        Failed to load dashboard: {error}
      </p>
      <button className="btn btn-primary btn-sm" onClick={refresh}>Retry</button>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>
          Welcome back, {name} 👋
        </h2>
        <p className="text-sm text-muted mt-4">
          Manage your sessions, wallet, and tutee requests.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid-4 mb-24">
        <StatCard
          label="Active Tutees"
          value={stats.activeTutees}
          icon="users"
          accent="primary"
        />
        <StatCard
          label="Sessions This Month"
          value={stats.sessionsThisMonth}
          icon="calendar"
          accent="secondary"
        />
        <StatCard
          label="Wallet Balance"
          value={`₱${Number(balance || 0).toLocaleString()}`}
          icon="wallet"
          accent="teal"
        />
        <StatCard
          label="Pending Requests"
          value={pendingBookings.length}
          icon="star"
          accent="coral"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* ── Today's Sessions ── */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-jakarta font-bold" style={{ fontSize: 15 }}>Today's Sessions</h3>
            <Badge variant="info">{todaySessions.length} today</Badge>
          </div>
          {todaySessions.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState
                icon="📅"
                title="No sessions today"
                description="Your scheduled sessions will appear here."
              />
            </div>
          ) : (
            todaySessions.map((s, i) => (
              <div
                key={s.id}
                style={{
                  padding: '14px 24px',
                  borderBottom: i < todaySessions.length - 1
                    ? `1px solid ${tokens.border}` : 'none',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-12">
                    <Avatar
                      name={s.booking?.student?.name || 'S'}
                      size={36}
                      colorIndex={i}
                    />
                    <div>
                      <div className="font-semibold" style={{ fontSize: 14 }}>
                        {s.booking?.student?.name || '—'}
                      </div>
                      <div className="text-xs text-muted">
                        {s.booking?.subject} · Session {s.session_number}/8
                        {s.scheduled_time ? ` · ${formatTime(s.scheduled_time)}` : ''}
                      </div>
                    </div>
                  </div>
                  <Badge variant={s.status === 'completed' ? 'success' : 'info'}>
                    {s.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Pending Booking Requests ── */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-jakarta font-bold" style={{ fontSize: 15 }}>Booking Requests</h3>
            {pendingBookings.length > 0 && (
              <Badge variant="warning">{pendingBookings.length} pending</Badge>
            )}
          </div>
          {pendingBookings.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState
                icon="📩"
                title="No pending requests"
                description="New booking requests will appear here."
              />
            </div>
          ) : (
            pendingBookings.map((b, i) => (
              <div
                key={b.id}
                style={{
                  padding: '14px 24px',
                  borderBottom: i < pendingBookings.length - 1
                    ? `1px solid ${tokens.border}` : 'none',
                }}
              >
                <div className="font-semibold mb-4" style={{ fontSize: 14 }}>
                  {b.student?.name || '—'}
                  {b.student?.grade_level ? ` (Grade ${b.student.grade_level})` : ''}
                </div>
                <div className="text-xs text-muted mb-8">
                  {b.subject} · {b.session_mode} · Parent: {b.parent?.full_name || '—'}
                </div>
                <div className="flex gap-8">
                  <button
                    className="btn btn-success btn-sm"
                    disabled={responding[b.id]}
                    onClick={() => handleRespond(b.id, true)}
                  >
                    <Icon name="check" size={12} />
                    {responding[b.id] ? ' ...' : ' Accept'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={responding[b.id]}
                    onClick={() => handleRespond(b.id, false)}
                  >
                    <Icon name="x" size={12} />
                    {responding[b.id] ? ' ...' : ' Decline'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Certification Banner ── */}
      <div
        className="card p-24"
        style={{ background: `linear-gradient(135deg, ${tokens.primaryLight}, #FEF3C7)` }}
      >
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div className="flex items-center gap-16">
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: tokens.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="award" size={24} color="#fff" />
            </div>
            <div>
              <div className="font-jakarta font-bold" style={{ fontSize: 16 }}>
                AI Certification Exam
              </div>
              <div className="text-sm text-muted">
                Take topic-based exams to get matched with students
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/certification')}
          >
            Go to Certification
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(+h, +m);
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}