import { useState } from 'react';
import { useAdminData } from '../../hooks/useAdminData';
import Icon from '../../components/ui/Icon';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import tokens from '../../lib/tokens';

const STATUS_CONFIG = {
  completed:  { label: 'Completed',  color: '#16A34A', bg: '#D1FAE5' },
  scheduled:  { label: 'Scheduled',  color: '#2563EB', bg: '#DBEAFE' },
  missed:     { label: 'Missed',     color: '#DC2626', bg: '#FEE2E2' },
};

const PERF_CONFIG = {
  good:              { label: 'Good',              color: '#16A34A', bg: '#D1FAE5' },
  improving:         { label: 'Improving',         color: '#CA8A04', bg: '#FEF9C3' },
  needs_improvement: { label: 'Needs Improvement', color: '#DC2626', bg: '#FEE2E2' },
};

export default function AdminSessionsPage() {
  const { allSessions, loading } = useAdminData();
  const [expandedParent, setExpandedParent] = useState(null);
  const [expandedChild,  setExpandedChild]  = useState(null);
  const [search, setSearch] = useState('');

  if (loading) return <Spinner dark size={32} />;

  // ── Group sessions: parent → child → sessions ─────────────────────
  const grouped = {};
  allSessions.forEach(s => {
    const booking   = s.booking;
    if (!booking) return;

    const parentId   = booking.parent?.id   || 'unknown';
    const parentName = booking.parent?.full_name || 'Unknown Parent';
    const childId    = booking.student?.id  || 'unknown';
    const childName  = booking.student?.name || 'Unknown Child';
    const childGrade = booking.student?.grade_level;
    const tutorName  = booking.tutor?.full_name || '—';
    const subject    = booking.subject || '—';

    if (!grouped[parentId]) {
      grouped[parentId] = { parentId, parentName, children: {} };
    }
    if (!grouped[parentId].children[childId]) {
      grouped[parentId].children[childId] = { childId, childName, childGrade, tutorName, subject, sessions: [] };
    }
    grouped[parentId].children[childId].sessions.push(s);
  });

  // Search filter
  const parentGroups = Object.values(grouped).filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.parentName.toLowerCase().includes(q) ||
      Object.values(p.children).some(c =>
        c.childName.toLowerCase().includes(q) ||
        c.tutorName.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q)
      )
    );
  });

  const totalSessions  = allSessions.length;
  const completedCount = allSessions.filter(s => s.status === 'completed').length;
  const scheduledCount = allSessions.filter(s => s.status === 'scheduled').length;

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>All Sessions</h2>
        <p className="text-sm text-muted mt-4">
          Overview of every tutoring session across all parents and children.
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Sessions',    value: totalSessions,  color: tokens.primary,  bg: tokens.primaryLight },
          { label: 'Completed',         value: completedCount, color: '#16A34A',        bg: '#D1FAE5'           },
          { label: 'Scheduled/Pending', value: scheduledCount, color: '#2563EB',        bg: '#DBEAFE'           },
        ].map(c => (
          <div key={c.label} className="card p-20 text-center">
            <div className="font-jakarta font-extrabold" style={{ fontSize: 32, color: c.color }}>{c.value}</div>
            <div className="text-sm text-muted">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card p-16 mb-16">
        <input
          className="input"
          placeholder="Search by parent, child, tutor, or subject..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {parentGroups.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="📅"
            title="No sessions found"
            description={search ? 'Try a different search term.' : 'No sessions have been recorded yet.'}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {parentGroups.map((parent, pi) => {
            const isParentOpen    = expandedParent === parent.parentId;
            const childList       = Object.values(parent.children);
            const totalChildSess  = childList.reduce((sum, c) => sum + c.sessions.length, 0);
            const completedChildSess = childList.reduce((sum, c) => sum + c.sessions.filter(s => s.status === 'completed').length, 0);

            return (
              <div key={parent.parentId} className="card" style={{ overflow: 'hidden' }}>

                {/* ── Parent row (Level 1) ── */}
                <button
                  onClick={() => {
                    setExpandedParent(isParentOpen ? null : parent.parentId);
                    setExpandedChild(null);
                  }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: isParentOpen ? `1px solid ${tokens.border}` : 'none',
                    textAlign: 'left',
                  }}
                >
                  <Avatar name={parent.parentName} size={36} colorIndex={pi} />
                  <div style={{ flex: 1 }}>
                    <div className="font-jakarta font-bold" style={{ fontSize: 15 }}>
                      {parent.parentName}
                    </div>
                    <div className="text-xs text-muted mt-2">
                      {childList.length} child{childList.length !== 1 ? 'ren' : ''} ·{' '}
                      {totalChildSess} session{totalChildSess !== 1 ? 's' : ''} ·{' '}
                      {completedChildSess} completed
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: tokens.primaryLight, color: tokens.primary,
                    }}>
                      {childList.length} child{childList.length !== 1 ? 'ren' : ''}
                    </div>
                    <Icon
                      name={isParentOpen ? 'chevronUp' : 'chevronDown'}
                      size={16}
                      color={tokens.muted}
                    />
                  </div>
                </button>

                {/* ── Children list (Level 2) ── */}
                {isParentOpen && (
                  <div style={{ background: '#FAFAFA' }}>
                    {childList.map((child, ci) => {
                      const childKey    = `${parent.parentId}-${child.childId}`;
                      const isChildOpen = expandedChild === childKey;
                      const completedS  = child.sessions.filter(s => s.status === 'completed').length;

                      return (
                        <div key={child.childId} style={{ borderBottom: ci < childList.length - 1 ? `1px solid ${tokens.border}` : 'none' }}>

                          {/* Child row */}
                          <button
                            onClick={() => setExpandedChild(isChildOpen ? null : childKey)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                              padding: '12px 20px 12px 36px', background: 'none', border: 'none',
                              cursor: 'pointer', textAlign: 'left',
                              borderBottom: isChildOpen ? `1px solid ${tokens.border}` : 'none',
                            }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                              background: tokens.primaryLight,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, color: tokens.primary,
                            }}>
                              {child.childName.charAt(0)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="font-semibold" style={{ fontSize: 14 }}>
                                {child.childName}
                                {child.childGrade && (
                                  <span className="text-xs text-muted" style={{ marginLeft: 8 }}>
                                    Grade {child.childGrade}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted mt-1">
                                Tutor: {child.tutorName} ·{' '}
                                <span style={{ textTransform: 'capitalize' }}>{child.subject}</span> ·{' '}
                                {child.sessions.length} session{child.sessions.length !== 1 ? 's' : ''} ·{' '}
                                {completedS} completed
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {/* Progress pill */}
                              <div style={{
                                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                background: '#D1FAE5', color: '#065F46',
                              }}>
                                {completedS} / {child.sessions.length}
                              </div>
                              <Icon
                                name={isChildOpen ? 'chevronUp' : 'chevronDown'}
                                size={14}
                                color={tokens.muted}
                              />
                            </div>
                          </button>

                          {/* Session rows (Level 3) */}
                          {isChildOpen && (
                            <div style={{ background: '#fff', padding: '8px 0' }}>
                              {child.sessions
                                .sort((a, b) => (a.session_number || 0) - (b.session_number || 0))
                                .map((s, si) => {
                                  const sc  = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
                                  const pc  = s.performance_indicator ? PERF_CONFIG[s.performance_indicator] : null;
                                  return (
                                    <div
                                      key={s.id}
                                      style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 12,
                                        padding: '10px 20px 10px 60px',
                                        borderBottom: si < child.sessions.length - 1 ? `1px solid ${tokens.border}` : 'none',
                                      }}
                                    >
                                      {/* Session number bubble */}
                                      <div style={{
                                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                        background: s.status === 'completed' ? '#D1FAE5' : tokens.primaryLight,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 11, fontWeight: 700,
                                        color: s.status === 'completed' ? '#065F46' : tokens.primary,
                                        marginTop: 2,
                                      }}>
                                        {s.session_number || si + 1}
                                      </div>

                                      <div style={{ flex: 1 }}>
                                        <div className="flex items-center gap-8 mb-4" style={{ flexWrap: 'wrap' }}>
                                          <span className="font-semibold" style={{ fontSize: 13 }}>
                                            Session {s.session_number || si + 1}
                                          </span>
                                          <span style={{
                                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                            background: sc.bg, color: sc.color,
                                          }}>
                                            {sc.label}
                                          </span>
                                          {pc && (
                                            <span style={{
                                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                              background: pc.bg, color: pc.color,
                                            }}>
                                              {pc.label}
                                            </span>
                                          )}
                                        </div>

                                        {s.topic_covered && (
                                          <div className="text-xs text-muted mb-2">
                                            📖 Topic: <strong>{s.topic_covered}</strong>
                                          </div>
                                        )}

                                        {s.tutor_comments && (
                                          <div style={{
                                            fontSize: 12, color: tokens.mid, lineHeight: 1.5,
                                            background: '#F0FDF4', borderRadius: 6,
                                            padding: '5px 10px', marginTop: 4,
                                          }}>
                                            "{s.tutor_comments}"
                                          </div>
                                        )}
                                      </div>

                                      <div style={{ fontSize: 11, color: tokens.muted, flexShrink: 0, marginTop: 2, textAlign: 'right' }}>
                                        {s.scheduled_date
                                          ? new Date(s.scheduled_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                                          : s.created_at
                                          ? new Date(s.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                                          : '—'}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}