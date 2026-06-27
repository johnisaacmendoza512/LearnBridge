import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import Avatar from '../../components/ui/Avatar';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const INDICATOR_CONFIG = {
  good:             { label: 'Good',              color: '#16A34A', bg: '#D1FAE5', dot: '#16A34A' },
  improving:        { label: 'Improving',         color: '#CA8A04', bg: '#FEF3C7', dot: '#CA8A04' },
  needs_improvement:{ label: 'Needs Improvement', color: '#DC2626', bg: '#FEE2E2', dot: '#DC2626' },
};

export default function ParentSessionsPage() {
  const { user } = useAuth();

  const [bookings,  setBookings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [debugInfo, setDebugInfo] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setDebugInfo('');

    try {
      // Step 1: Fetch bookings for this parent
      const { data: bookingData, error: bErr } = await supabase
        .from('bookings')
        .select(`
          id, subject, status, created_at,
          tutor:tutor_id   ( id, full_name ),
          student:student_id ( id, name, grade_level )
        `)
        .eq('parent_id', user.id)
        .in('status', ['confirmed', 'pending_parent_confirm', 'completed', 'pending'])
        .order('created_at', { ascending: false });

      if (bErr) throw bErr;

      const bIds = (bookingData || []).map(b => b.id);
      console.log('[ParentSessions] bookings found:', bIds.length, bIds);
      setDebugInfo(`Found ${bIds.length} booking(s). IDs: ${bIds.join(', ')}`);

      let sessionsByBooking = {};

      if (bIds.length > 0) {
        // Step 2: Fetch sessions for these bookings
        const { data: sessionData, error: sErr } = await supabase
          .from('sessions')
          .select(`
            id, booking_id, session_number, scheduled_date,
            status, topic_covered, performance_indicator, tutor_comments,
            created_at
          `)
          .in('booking_id', bIds)
          .order('session_number', { ascending: true });

        if (sErr) {
          console.error('[ParentSessions] sessions query error:', sErr);
          setDebugInfo(prev => prev + ` | Sessions error: ${sErr.message}`);
        } else {
          console.log('[ParentSessions] sessions found:', sessionData?.length, sessionData);
          setDebugInfo(prev => prev + ` | Sessions found: ${sessionData?.length || 0}`);

          (sessionData || []).forEach(s => {
            if (!sessionsByBooking[s.booking_id]) sessionsByBooking[s.booking_id] = [];
            sessionsByBooking[s.booking_id].push(s);
          });
        }
      }

      // Merge sessions into bookings
      const merged = (bookingData || []).map(b => ({
        ...b,
        sessions: (sessionsByBooking[b.id] || []).sort((a, b) =>
          (a.session_number || 0) - (b.session_number || 0)
        ),
      }));

      setBookings(merged);
      if (merged.length > 0 && !selected) {
        setSelected(merged[0].id);
      }
    } catch (e) {
      console.error('[ParentSessions] error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]); // eslint-disable-line

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 15 seconds to pick up new tutor input
  useEffect(() => {
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <Spinner dark size={32} />;

  if (error) return (
    <div className="card p-24 text-center">
      <p className="text-sm mb-12" style={{ color: tokens.danger }}>Error: {error}</p>
      <button className="btn btn-primary btn-sm" onClick={fetchData}>Retry</button>
    </div>
  );

  const activeBooking = bookings.find(b => b.id === selected);

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Sessions</h2>
        <p className="text-sm text-muted mt-4">
          Track your child's progress across all 8 tutoring sessions.
        </p>
      </div>

      {/* Debug info — remove after confirming it works */}
      {debugInfo && (
        <div style={{
          background: '#FEF9C3', border: '1px solid #FDE68A',
          borderRadius: 8, padding: '8px 14px', marginBottom: 16,
          fontSize: 11, color: '#92400E', fontFamily: 'monospace',
        }}>
          🔍 Debug: {debugInfo}
          <button
            onClick={fetchData}
            style={{ marginLeft: 12, fontSize: 11, color: tokens.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ↻ Refresh
          </button>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="📋"
            title="No sessions yet"
            description="Sessions will appear here once your tutor logs feedback in the Sessions page."
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>

          {/* ── LEFT: Booking selector ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="font-jakarta font-bold mb-4" style={{
              fontSize: 13, color: tokens.muted,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              Your Bookings
            </div>
            {bookings.map((b, i) => {
              const isActive     = selected === b.id;
              const sessionCount = b.sessions.length;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelected(b.id)}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    border: `1.5px solid ${isActive ? tokens.primary : tokens.border}`,
                    borderRadius: 12, padding: 14,
                    background: isActive ? tokens.primaryLight : '#fff',
                    transition: 'all 0.15s',
                  }}
                >
                  <div className="flex items-center gap-10">
                    <Avatar name={b.student?.name || 'S'} size={34} colorIndex={i} />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div className="font-semibold" style={{
                        fontSize: 13,
                        color: isActive ? tokens.primary : tokens.dark,
                      }}>
                        {b.student?.name || '—'}
                      </div>
                      <div className="text-xs text-muted truncate mt-1">
                        {b.tutor?.full_name} · <span style={{ textTransform: 'capitalize' }}>{b.subject}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs text-muted">Progress</span>
                      <span className="text-xs font-semibold" style={{
                        color: isActive ? tokens.primary : tokens.mid,
                      }}>
                        {sessionCount} / 8
                      </span>
                    </div>
                    <div style={{ height: 5, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${(sessionCount / 8) * 100}%`,
                        background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.accent})`,
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── RIGHT: Timeline ── */}
          {activeBooking && (
            <div>
              {/* Header card */}
              <div className="card p-20 mb-16">
                <div className="flex items-center gap-16">
                  <Avatar name={activeBooking.student?.name || 'S'} size={44} colorIndex={0} />
                  <div>
                    <div className="font-bold" style={{ fontSize: 16 }}>
                      {activeBooking.student?.name || '—'}
                    </div>
                    <div className="text-sm text-muted">
                      Grade {activeBooking.student?.grade_level || '?'}
                      {' · '}
                      <span style={{ textTransform: 'capitalize' }}>{activeBooking.subject}</span>
                      {' · '}
                      Tutor: {activeBooking.tutor?.full_name || '—'}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span style={{
                      padding: '4px 14px', borderRadius: 20,
                      background: tokens.primaryLight, color: tokens.primary,
                      fontSize: 12, fontWeight: 700,
                    }}>
                      Session {activeBooking.sessions.length} of 8
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-xs text-muted">Package Progress</span>
                    <span className="text-xs font-semibold">
                      {activeBooking.sessions.length} / 8 sessions
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${(activeBooking.sessions.length / 8) * 100}%`,
                      background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.accent})`,
                      transition: 'width 0.4s',
                    }} />
                  </div>
                </div>
              </div>

              {/* Session timeline */}
              <div className="card">
                <div className="card-header">
                  <h3 className="font-jakarta font-bold" style={{ fontSize: 15 }}>Session Feedback Log</h3>
                  <button
                    onClick={fetchData}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12 }}
                  >
                    <Icon name="arrowDown" size={12} /> Refresh
                  </button>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {/* Completed sessions */}
                  {activeBooking.sessions.map((s, i) => {
                    const indCfg    = INDICATOR_CONFIG[s.performance_indicator];
                    const dotColor  = indCfg?.dot || tokens.success;
                    const sessionNum = s.session_number || (i + 1);

                    return (
                      <div key={s.id} style={{
                        padding: '16px 24px',
                        borderBottom: `1px solid ${tokens.border}`,
                        display: 'flex', gap: 16, alignItems: 'flex-start',
                      }}>
                        <div style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', flexShrink: 0,
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: dotColor + '20',
                            border: `2px solid ${dotColor}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: dotColor }}>
                              {sessionNum}
                            </span>
                          </div>
                          {i < activeBooking.sessions.length - 1 && (
                            <div style={{ width: 2, height: 20, background: tokens.border, margin: '4px 0' }} />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="flex items-center gap-8 mb-4">
                            <span className="font-semibold" style={{ fontSize: 14 }}>
                              {s.topic_covered || `Session ${sessionNum}`}
                            </span>
                            {indCfg && (
                              <span style={{
                                padding: '2px 10px', borderRadius: 20,
                                fontSize: 11, fontWeight: 700,
                                background: indCfg.bg, color: indCfg.color,
                              }}>
                                {indCfg.label}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted mb-6">
                            {s.scheduled_date
                              ? new Date(s.scheduled_date).toLocaleDateString('en-PH', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                })
                              : formatDate(s.created_at)}
                          </div>
                          {s.tutor_comments && (
                            <div style={{
                              background: '#F0FDF4', borderRadius: 8,
                              padding: '8px 12px', marginTop: 4,
                            }}>
                              <div className="text-xs font-bold text-muted mb-4" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Tutor's Note
                              </div>
                              <p className="text-sm" style={{ color: tokens.mid, lineHeight: 1.6, margin: 0 }}>
                                {s.tutor_comments}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Remaining sessions */}
                  {Array.from(
                    { length: Math.max(0, 8 - activeBooking.sessions.length) },
                    (_, i) => activeBooking.sessions.length + i + 1
                  ).map((num, idx) => (
                    <div key={num} style={{
                      padding: '14px 24px',
                      display: 'flex', gap: 16, alignItems: 'center',
                      borderTop: idx === 0 && activeBooking.sessions.length > 0
                        ? `1px solid ${tokens.border}` : 'none',
                      opacity: 0.4,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: '#F3F4F6', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px dashed ${tokens.border}`,
                      }}>
                        <span style={{ fontSize: 11, color: tokens.muted, fontWeight: 800 }}>{num}</span>
                      </div>
                      <span className="text-sm text-muted">Session {num} — not yet completed</span>
                    </div>
                  ))}

                  {activeBooking.sessions.length === 8 && (
                    <div style={{
                      padding: '16px 24px', background: '#D1FAE5',
                      display: 'flex', alignItems: 'center', gap: 12,
                      borderTop: `1px solid #6EE7B7`,
                    }}>
                      <Icon name="check" size={18} color="#065F46" />
                      <span className="font-semibold" style={{ fontSize: 14, color: '#065F46' }}>
                        🎉 All 8 sessions completed!
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}