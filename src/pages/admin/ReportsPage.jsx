import { useAdminData } from '../../hooks/useAdminData';
import StatCard from '../../components/ui/StatCard';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

export default function ReportsPage() {
  const {
    stats, allTxns, allSessions, tutors, allUsers,
    loading, error, refresh,
  } = useAdminData();

  if (loading) return <Spinner dark size={32} />;

  if (error) return (
    <div className="card p-24 text-center">
      <p className="text-sm mb-12" style={{ color: tokens.danger }}>
        Failed to load reports: {error}
      </p>
      <button className="btn btn-primary btn-sm" onClick={refresh}>Retry</button>
    </div>
  );

  // ── Computed values from live Supabase data — nothing hardcoded ──────────
  const totalRevenue    = Number(stats?.total_revenue ?? 0);
  const totalTopUps     = allTxns
    .filter(t => t.type === 'topup')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalCommission = allTxns
    .filter(t => t.type === 'commission_deduction')
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

  const completedSessions = allSessions.filter(s => s.status === 'completed').length;
  const missedSessions    = allSessions.filter(s => s.status === 'missed').length;

  const approvedTutors = tutors.filter(t => t.status === 'approved').length;
  const pendingTutors  = tutors.filter(t => t.status === 'pending').length;
  const rejectedTutors = tutors.filter(t => t.status === 'rejected').length;

  const totalParents   = allUsers.filter(u => u.role === 'parent').length;
  const totalTutorsAll = allUsers.filter(u => u.role === 'tutor').length;
  const totalAdmins    = allUsers.filter(u => u.role === 'admin').length;

  // Performance indicator distribution from completed sessions
  const indicatorCounts = { good: 0, improving: 0, needs_improvement: 0 };
  allSessions.forEach(s => {
    if (s.performance_indicator && indicatorCounts[s.performance_indicator] !== undefined) {
      indicatorCounts[s.performance_indicator]++;
    }
  });

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Platform Reports</h2>
        <p className="text-sm text-muted mt-4">
          Live analytics and statistics across all platform operations.
        </p>
      </div>

      {/* ── User Overview ── */}
      <SectionTitle>User Overview</SectionTitle>
      <div className="grid-4 mb-24">
        <StatCard
          label="Total Users"
          value={stats?.total_users ?? 0}
          icon="users"
          accent="primary"
        />
        <StatCard
          label="Total Parents"
          value={totalParents}
          icon="user"
          accent="teal"
        />
        <StatCard
          label="Total Tutors"
          value={totalTutorsAll}
          icon="award"
          accent="secondary"
        />
        <StatCard
          label="Administrators"
          value={totalAdmins}
          icon="shield"
          accent="coral"
        />
      </div>

      {/* ── Tutor Verification Status ── */}
      <SectionTitle>Tutor Verification Status</SectionTitle>
      <div className="grid-3 mb-24">
        <StatCard
          label="Approved Tutors"
          value={approvedTutors}
          icon="check"
          accent="teal"
        />
        <StatCard
          label="Pending Review"
          value={pendingTutors}
          icon="clock"
          accent="secondary"
        />
        <StatCard
          label="Rejected"
          value={rejectedTutors}
          icon="x"
          accent="coral"
        />
      </div>

      {/* ── Bookings & Sessions ── */}
      <SectionTitle>Bookings &amp; Sessions</SectionTitle>
      <div className="grid-4 mb-24">
        <StatCard
          label="Total Bookings"
          value={stats?.total_bookings ?? 0}
          icon="calendar"
          accent="primary"
        />
        <StatCard
          label="Active Bookings"
          value={stats?.active_bookings ?? 0}
          icon="check"
          accent="teal"
        />
        <StatCard
          label="Completed Sessions"
          value={completedSessions}
          icon="book"
          accent="secondary"
        />
        <StatCard
          label="Missed Sessions"
          value={missedSessions}
          icon="x"
          accent="coral"
        />
      </div>

      {/* ── Financial Overview ── */}
      <SectionTitle>Financial Overview</SectionTitle>
      <div className="grid-3 mb-24">
        <StatCard
          label="Total Revenue (Commission)"
          value={`₱${totalRevenue.toLocaleString()}`}
          icon="wallet"
          accent="teal"
        />
        <StatCard
          label="Total Tutor Top-Ups"
          value={`₱${totalTopUps.toLocaleString()}`}
          icon="upload"
          accent="primary"
        />
        <StatCard
          label="Total Commission Collected"
          value={`₱${totalCommission.toLocaleString()}`}
          icon="percent"
          accent="secondary"
        />
      </div>

      {/* ── Question Bank ── */}
      <SectionTitle>Question Bank</SectionTitle>
      <div className="grid-3 mb-24">
        <StatCard
          label="Total Questions"
          value={stats?.total_questions ?? 0}
          icon="clipboard"
          accent="primary"
        />
        <StatCard
          label="Pending Review"
          value={stats?.pending_questions ?? 0}
          icon="clock"
          accent="secondary"
        />
        <StatCard
          label="Approved Questions"
          value={(stats?.total_questions ?? 0) - (stats?.pending_questions ?? 0)}
          icon="check"
          accent="teal"
        />
      </div>

      {/* ── Session Performance Distribution ── */}
      <SectionTitle>Session Performance Distribution</SectionTitle>
      <div className="grid-3 mb-24">
        <PerformanceCard
          label="Good"
          count={indicatorCounts.good}
          color={tokens.success}
          bg="#D1FAE5"
        />
        <PerformanceCard
          label="Improving"
          count={indicatorCounts.improving}
          color={tokens.secondary}
          bg="#FEF3C7"
        />
        <PerformanceCard
          label="Needs Improvement"
          count={indicatorCounts.needs_improvement}
          color={tokens.danger}
          bg="#FEE2E2"
        />
      </div>

      {/* ── Recent Transactions ── */}
      <SectionTitle>Recent Transactions</SectionTitle>
      <div className="card mb-24">
        {allTxns.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <p className="text-sm text-muted">No transactions recorded yet.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tutor</th>
                <th>Type</th>
                <th>Description</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {allTxns.slice(0, 20).map(t => (
                <tr key={t.id}>
                  <td style={{ fontSize: 13 }}>{t.tutor?.full_name || '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 4,
                      background: t.type === 'topup' ? '#D1FAE5' : '#FEE2E2',
                      color:      t.type === 'topup' ? '#065F46' : '#991B1B',
                    }}>
                      {t.type === 'topup' ? 'Top-Up' : 'Commission'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{t.description || '—'}</td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>
                    {formatDate(t.created_at)}
                  </td>
                  <td>
                    <span style={{
                      fontWeight: 700, fontSize: 14,
                      color: Number(t.amount) > 0 ? tokens.success : tokens.danger,
                    }}>
                      {Number(t.amount) > 0 ? '+' : ''}₱{Math.abs(Number(t.amount)).toLocaleString()}
                    </span>
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

// ── Helper Components ──────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 className="font-jakarta font-bold" style={{ fontSize: 15, color: tokens.dark }}>
        {children}
      </h3>
      <div style={{
        height: 2, width: 40,
        background: tokens.primary,
        borderRadius: 2, marginTop: 4,
      }} />
    </div>
  );
}

function PerformanceCard({ label, count, color, bg }) {
  return (
    <div className="card p-20 text-center" style={{ borderTop: `4px solid ${color}` }}>
      <div
        className="font-jakarta font-black mb-8"
        style={{ fontSize: 40, color }}
      >
        {count}
      </div>
      <div
        style={{
          display: 'inline-block',
          padding: '4px 14px', borderRadius: 20,
          background: bg, fontSize: 13, fontWeight: 600, color,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}