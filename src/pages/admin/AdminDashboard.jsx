import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAdminData } from '../../hooks/useAdminData';
import StatCard from '../../components/ui/StatCard';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const { stats, tutors, allSessions, loading, error, refresh } = useAdminData();

  const pendingTutors  = tutors.filter(t => t.status === 'pending');
  const recentSessions = allSessions.slice(0, 5);

  if (loading) return <Spinner dark size={32} />;

  if (error) return (
    <div className="card p-24 text-center">
      <p className="text-sm mb-12" style={{ color: tokens.danger }}>Failed to load dashboard: {error}</p>
      <button className="btn btn-primary btn-sm" onClick={refresh}>Retry</button>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Admin Dashboard</h2>
        <p className="text-sm text-muted mt-4">
          Welcome back, {profile?.full_name || 'Administrator'}. Here's the platform overview.
        </p>
      </div>

      {/* ── Live Stats ── */}
      <div className="grid-4 mb-24">
        <StatCard
          label="Total Users"
          value={stats?.total_users ?? '—'}
          icon="users"
          accent="primary"
        />
        <StatCard
          label="Approved Tutors"
          value={stats?.approved_tutors ?? '—'}
          icon="award"
          accent="teal"
        />
        <StatCard
          label="Pending Verifications"
          value={stats?.pending_tutors ?? '—'}
          icon="shield"
          accent="secondary"
        />
        <StatCard
          label="Completed Sessions"
          value={stats?.completed_sessions ?? '—'}
          icon="calendar"
          accent="coral"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>

        {/* ── Pending Tutor Verifications ── */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-jakarta font-bold" style={{ fontSize: 15 }}>
              Pending Tutor Verifications
            </h3>
            <Badge variant="warning">{pendingTutors.length} pending</Badge>
          </div>

          {pendingTutors.length === 0 ? (
            <div style={{ padding: '24px' }}>
              <EmptyState
                icon="✅"
                title="No pending verifications"
                description="All tutor applications have been reviewed."
              />
            </div>
          ) : (
            pendingTutors.slice(0, 5).map((t, i) => (
              <div
                key={t.id}
                style={{
                  padding: '14px 24px',
                  borderBottom: i < Math.min(pendingTutors.length, 5) - 1
                    ? `1px solid ${tokens.border}` : 'none',
                }}
              >
                <div className="flex items-center gap-12 mb-8">
                  <Avatar name={t.profile?.full_name || 'T'} size={36} colorIndex={i} />
                  <div style={{ flex: 1 }}>
                    <div className="font-semibold" style={{ fontSize: 14 }}>
                      {t.profile?.full_name || '—'}
                    </div>
                    <div className="text-xs text-muted">
                      {(t.specialization || []).join(', ') || '—'} · Applied {formatDate(t.created_at)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-8">
                  <Badge variant={t.nbi_clearance_url ? 'success' : 'danger'}>
                    NBI {t.nbi_clearance_url ? '✓' : '✗'}
                  </Badge>
                  <Badge variant={t.prc_license_url ? 'success' : 'danger'}>
                    PRC {t.prc_license_url ? '✓' : '✗'}
                  </Badge>
                  <Badge variant={t.medical_cert_url ? 'success' : 'danger'}>
                    Medical {t.medical_cert_url ? '✓' : '✗'}
                  </Badge>
                </div>
                <div className="flex gap-8 mt-10">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/tutor-verification')}
                  >
                    <Icon name="eye" size={12} /> Review
                  </button>
                </div>
              </div>
            ))
          )}

          {pendingTutors.length > 5 && (
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${tokens.border}` }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/tutor-verification')}
              >
                View all {pendingTutors.length} pending →
              </button>
            </div>
          )}
        </div>

        {/* ── Right Column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Platform Summary */}
          <div className="card p-20">
            <h3 className="font-jakarta font-bold mb-16" style={{ fontSize: 15 }}>Platform Summary</h3>
            {[
              ['Total Parents',      stats?.total_parents      ?? '—', tokens.primary],
              ['Total Tutors',       stats?.total_tutors        ?? '—', tokens.accent],
              ['Total Bookings',     stats?.total_bookings      ?? '—', tokens.secondary],
              ['Active Bookings',    stats?.active_bookings     ?? '—', tokens.success],
              ['Pending Questions',  stats?.pending_questions   ?? '—', tokens.warning],
              ['Total Revenue',      stats?.total_revenue != null
                ? `₱${Number(stats.total_revenue).toLocaleString()}`
                : '₱0',             tokens.success],
            ].map(([label, value, color]) => (
              <div
                key={label}
                className="flex items-center justify-between mb-12"
                style={{ paddingBottom: 12, borderBottom: `1px solid ${tokens.border}` }}
              >
                <span className="text-sm text-muted">{label}</span>
                <span className="text-sm font-semibold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="card p-20">
            <h3 className="font-jakarta font-bold mb-16" style={{ fontSize: 15 }}>Quick Actions</h3>
            {[
              ['Manage Users',         'users',     '/users'],
              ['Review Question Bank', 'clipboard', '/question-bank'],
              ['View Transactions',    'wallet',    '/transactions'],
              ['Platform Reports',     'chart',     '/reports'],
            ].map(([label, icon, path]) => (
              <button
                key={label}
                className="btn btn-ghost"
                style={{
                  justifyContent: 'flex-start',
                  padding: '10px 12px',
                  width: '100%',
                  marginBottom: 4,
                }}
                onClick={() => navigate(path)}
              >
                <Icon name={icon} size={14} color={tokens.mid} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Sessions ── */}
      <div className="card mt-20">
        <div className="card-header">
          <h3 className="font-jakarta font-bold" style={{ fontSize: 15 }}>Recent Sessions</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/sessions')}>
            View all →
          </button>
        </div>
        {recentSessions.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState icon="📚" title="No sessions yet" description="Sessions will appear here once bookings are confirmed." />
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Tutor</th>
                <th>Subject</th>
                <th>Session #</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map(s => (
                <tr key={s.id}>
                  <td className="font-semibold" style={{ fontSize: 13 }}>
                    {s.booking?.student?.name || '—'}
                  </td>
                  <td style={{ fontSize: 13 }}>{s.booking?.tutor?.full_name || '—'}</td>
                  <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{s.booking?.subject || '—'}</td>
                  <td><Badge variant="gray">#{s.session_number}/8</Badge></td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{formatDate(s.scheduled_date)}</td>
                  <td>
                    <Badge variant={
                      s.status === 'completed' ? 'success' :
                      s.status === 'missed'    ? 'danger'  : 'info'
                    }>
                      {s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}