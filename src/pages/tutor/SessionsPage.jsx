import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import FormGroup from '../../components/ui/FormGroup';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import tokens from '../../lib/tokens';

const INDICATOR_CONFIG = {
  good:             { label: 'Good',             color: '#16A34A', bg: '#D1FAE5', dot: '#16A34A' },
  improving:        { label: 'Improving',        color: '#CA8A04', bg: '#FEF3C7', dot: '#CA8A04' },
  needs_improvement:{ label: 'Needs Improvement',color: '#DC2626', bg: '#FEE2E2', dot: '#DC2626' },
};

function StarDisplay({ value, size = 14 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ fontSize: size, color: s <= value ? '#F59E0B' : '#D1D5DB' }}>★</span>
      ))}
    </span>
  );
}

function buildSessionMap(sessions) {
  const map = {};
  sessions.forEach(s => { if (s.session_number) map[s.session_number] = s; });
  return map;
}

export default function SessionsPage() {
  const { user } = useAuth();

  // All bookings where this tutor is involved
  const [bookings,      setBookings]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [expandedId,    setExpandedId]    = useState(null);
  const [sessionMaps,   setSessionMaps]   = useState({});
  const [savingSession, setSavingSession] = useState(null);
  const [ratingsMap,    setRatingsMap]    = useState({});    // bookingId → rating row
  const [feedbackModal, setFeedbackModal] = useState(null);  // booking to show parent rating

  // Per-booking per-session form state
  const [forms, setForms] = useState({});

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch confirmed bookings for this tutor
      const { data: bookingData, error: bErr } = await supabase
        .from('bookings')
        .select(`
          id, subject, status, created_at,
          parent:parent_id   ( id, full_name ),
          student:student_id ( id, name, grade_level )
        `)
        .eq('tutor_id', user.id)
        .in('status', ['confirmed', 'pending_parent_confirm', 'completed'])
        .order('created_at', { ascending: false });

      if (bErr) throw bErr;

      // Fetch all sessions for these bookings
      const bookingIds = (bookingData || []).map(b => b.id);
      let sessionsByBooking = {};

      if (bookingIds.length > 0) {
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('*')
          .in('booking_id', bookingIds);

        (sessionData || []).forEach(s => {
          if (!sessionsByBooking[s.booking_id]) sessionsByBooking[s.booking_id] = [];
          sessionsByBooking[s.booking_id].push(s);
        });
      }

      // Build session maps per booking
      const maps = {};
      Object.entries(sessionsByBooking).forEach(([bId, sessions]) => {
        maps[bId] = buildSessionMap(sessions);
      });

      setBookings(bookingData || []);
      setSessionMaps(maps);

      // Fetch parent ratings for completed bookings
      const completedIds = (bookingData || []).filter(b => b.status === 'completed').map(b => b.id);
      if (completedIds.length > 0) {
        const { data: ratingData } = await supabase
          .from('tutor_ratings')
          .select(`
            id, booking_id, star_rating, comment, created_at,
            parent:parent_id ( full_name )
          `)
          .in('booking_id', completedIds);

        const rMap = {};
        (ratingData || []).forEach(r => { rMap[r.booking_id] = r; });
        setRatingsMap(rMap);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Get or init form for a booking+session
  const getForm = (bookingId, sessionNum) => {
    const existing = sessionMaps[bookingId]?.[sessionNum];
    if (forms[bookingId]?.[sessionNum]) return forms[bookingId][sessionNum];
    return {
      topic:     existing?.topic_covered        || '',
      indicator: existing?.performance_indicator || 'good',
      comments:  existing?.tutor_comments       || '',
    };
  };

  const setForm = (bookingId, sessionNum, key, value) => {
    setForms(prev => ({
      ...prev,
      [bookingId]: {
        ...(prev[bookingId] || {}),
        [sessionNum]: {
          ...getForm(bookingId, sessionNum),
          [key]: value,
        },
      },
    }));
  };

  const handleSaveSession = async (bookingId, sessionNum) => {
    const form   = getForm(bookingId, sessionNum);
    if (!form.topic.trim()) { alert('Please enter the topic covered.'); return; }

    setSavingSession(`${bookingId}-${sessionNum}`);
    try {
      const existing = sessionMaps[bookingId]?.[sessionNum];

      if (existing) {
        // Update existing session
        await supabase
          .from('sessions')
          .update({
            topic_covered:         form.topic,
            performance_indicator: form.indicator,
            tutor_comments:        form.comments,
          })
          .eq('id', existing.id);
      } else {
        // Insert new session
        await supabase.from('sessions').insert({
          booking_id:            bookingId,
          session_number:        sessionNum,
          scheduled_date:        new Date().toISOString().split('T')[0],
          status:                'completed',
          topic_covered:         form.topic,
          performance_indicator: form.indicator,
          tutor_comments:        form.comments,
        });
      }

      // Refresh data
      await fetchData();
    } catch (e) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSavingSession(null);
    }
  };

  if (loading) return <Spinner dark size={32} />;

  if (error) return (
    <div className="card p-24 text-center">
      <p className="text-sm mb-12" style={{ color: tokens.danger }}>Error: {error}</p>
      <button className="btn btn-primary btn-sm" onClick={fetchData}>Retry</button>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Sessions</h2>
        <p className="text-sm text-muted mt-4">
          Track and log feedback for each of your 8 sessions per booking.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="📋"
            title="No active bookings"
            description="Session logs will appear here once you have confirmed bookings."
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {bookings.map(b => {
            const isExpanded     = expandedId === b.id;
            const sessionMap     = sessionMaps[b.id] || {};
            const completedCount = Object.keys(sessionMap).length;
            const parentRating   = ratingsMap[b.id];

            return (
              <div key={b.id} className="card" style={{ overflow: 'hidden' }}>

                {/* ── Booking header row ── */}
                <div style={{
                  padding: '16px 24px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  borderBottom: isExpanded ? `1px solid ${tokens.border}` : 'none',
                }}>
                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div className="font-jakarta font-bold" style={{ fontSize: 15 }}>
                      {b.student?.name || '—'}
                    </div>
                    <div className="text-xs text-muted mt-2">
                      Parent: {b.parent?.full_name || '—'}
                      {' · '}
                      <span style={{ textTransform: 'capitalize' }}>{b.subject}</span>
                    </div>
                    {/* Show parent rating if available */}
                    {parentRating && (
                      <div className="flex items-center gap-6 mt-6">
                        <StarDisplay value={parentRating.star_rating} size={13} />
                        <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 700 }}>
                          {parentRating.star_rating}/5
                        </span>
                        <button
                          onClick={() => setFeedbackModal(b)}
                          style={{ fontSize: 11, color: tokens.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                        >
                          View Feedback
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress pill */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: tokens.primary,
                      background: tokens.primaryLight, padding: '4px 12px',
                      borderRadius: 20, marginBottom: 6,
                    }}>
                      {completedCount} / 8 sessions logged
                    </div>
                    {/* Mini progress bar */}
                    <div style={{
                      width: 140, height: 6, background: '#E5E7EB',
                      borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${(completedCount / 8) * 100}%`,
                        background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.accent})`,
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>

                  {/* View / Close button */}
                  <button
                    className="btn btn-sm"
                    onClick={() => setExpandedId(isExpanded ? null : b.id)}
                    style={{
                      background: isExpanded ? '#F3F4F6' : tokens.primary,
                      color:      isExpanded ? tokens.mid : '#fff',
                      minWidth: 80,
                    }}
                  >
                    {isExpanded
                      ? <><Icon name="x" size={12} /> Close</>
                      : <><Icon name="eye" size={12} /> View</>
                    }
                  </button>
                </div>

                {/* ── Expanded: 8-session timeline ── */}
                {isExpanded && (
                  <div style={{ padding: '8px 0 16px' }}>
                    {[1,2,3,4,5,6,7,8].map(num => {
                      const existing  = sessionMap[num];
                      const hasData   = !!existing;
                      const form      = getForm(b.id, num);
                      const indCfg    = hasData
                        ? INDICATOR_CONFIG[existing.performance_indicator]
                        : null;
                      const isSaving  = savingSession === `${b.id}-${num}`;
                      const dotColor  = hasData ? (indCfg?.dot || '#16A34A') : tokens.border;
                      const isLast    = num === 8;

                      return (
                        <div key={num} style={{ display: 'flex', gap: 0 }}>
                          {/* ── Timeline line + circle ── */}
                          <div style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', paddingLeft: 24,
                            minWidth: 52,
                          }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%',
                              background: hasData ? dotColor + '20' : '#F3F4F6',
                              border: `2px solid ${hasData ? dotColor : tokens.border}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, zIndex: 1,
                            }}>
                              {hasData
                                ? <Icon name="check" size={13} color={dotColor} />
                                : <span style={{ fontSize: 11, fontWeight: 800, color: tokens.muted }}>{num}</span>
                              }
                            </div>
                            {!isLast && (
                              <div style={{
                                width: 2, flex: 1, minHeight: 16,
                                background: hasData ? dotColor + '40' : '#E5E7EB',
                              }} />
                            )}
                          </div>

                          {/* ── Session content ── */}
                          <div style={{
                            flex: 1, paddingRight: 24, paddingTop: 4,
                            paddingBottom: isLast ? 8 : 20,
                          }}>
                            {/* Session header */}
                            <div className="flex items-center gap-8 mb-10">
                              <span className="font-jakarta font-bold" style={{ fontSize: 14 }}>
                                Session {num}
                              </span>
                              {hasData && indCfg && (
                                <span style={{
                                  padding: '2px 10px', borderRadius: 20,
                                  fontSize: 11, fontWeight: 700,
                                  background: indCfg.bg, color: indCfg.color,
                                }}>
                                  {indCfg.label}
                                </span>
                              )}
                              {hasData && existing.scheduled_date && (
                                <span className="text-xs text-muted">
                                  {new Date(existing.scheduled_date).toLocaleDateString('en-PH', {
                                    month: 'short', day: 'numeric', year: 'numeric',
                                  })}
                                </span>
                              )}
                            </div>

                            {/* Form fields */}
                            <div style={{
                              background: hasData ? '#F9FAFB' : '#FFFBEB',
                              border: `1px solid ${hasData ? tokens.border : '#FDE68A'}`,
                              borderRadius: 12, padding: '16px 18px',
                            }}>
                              {!hasData && (
                                <div style={{
                                  fontSize: 12, color: '#92400E', marginBottom: 12,
                                  fontWeight: 600,
                                }}>
                                  📝 Session {num} — Not yet logged
                                </div>
                              )}

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {/* Topic */}
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <label style={{
                                    fontSize: 11, fontWeight: 700, color: tokens.muted,
                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                    display: 'block', marginBottom: 5,
                                  }}>
                                    Topic Covered
                                  </label>
                                  <input
                                    className="input"
                                    placeholder="e.g. Addition of Unlike Fractions"
                                    value={form.topic}
                                    onChange={e => setForm(b.id, num, 'topic', e.target.value)}
                                    style={{ fontSize: 13 }}
                                  />
                                </div>

                                {/* Performance */}
                                <div>
                                  <label style={{
                                    fontSize: 11, fontWeight: 700, color: tokens.muted,
                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                    display: 'block', marginBottom: 5,
                                  }}>
                                    Performance
                                  </label>
                                  <select
                                    className="select"
                                    value={form.indicator}
                                    onChange={e => setForm(b.id, num, 'indicator', e.target.value)}
                                    style={{ fontSize: 13 }}
                                  >
                                    <option value="good">Good</option>
                                    <option value="improving">Improving</option>
                                    <option value="needs_improvement">Needs Improvement</option>
                                  </select>
                                </div>

                                {/* Save button */}
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                  <button
                                    className="btn btn-primary btn-sm btn-full"
                                    disabled={isSaving || !form.topic.trim()}
                                    onClick={() => handleSaveSession(b.id, num)}
                                    style={{ fontSize: 12 }}
                                  >
                                    {isSaving
                                      ? 'Saving...'
                                      : hasData
                                        ? <><Icon name="edit" size={12} /> Update</>
                                        : <><Icon name="check" size={12} /> Save Session</>
                                    }
                                  </button>
                                </div>

                                {/* Comments */}
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <label style={{
                                    fontSize: 11, fontWeight: 700, color: tokens.muted,
                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                    display: 'block', marginBottom: 5,
                                  }}>
                                    Comments <span style={{ fontWeight: 400, textTransform: 'none' }}>(Optional — parents will see this)</span>
                                  </label>
                                  <textarea
                                    className="textarea"
                                    placeholder="Describe the student's performance, areas to improve, what to focus on next session..."
                                    value={form.comments}
                                    onChange={e => setForm(b.id, num, 'comments', e.target.value)}
                                    style={{ fontSize: 13, minHeight: 72 }}
                                  />
                                </div>
                              </div>

                              {/* Saved indicator */}
                              {hasData && (
                                <div style={{
                                  marginTop: 10, paddingTop: 10,
                                  borderTop: `1px solid ${tokens.border}`,
                                  fontSize: 11, color: '#16A34A', fontWeight: 600,
                                  display: 'flex', alignItems: 'center', gap: 5,
                                }}>
                                  <Icon name="check" size={11} color="#16A34A" />
                                  Logged on {existing.scheduled_date
                                    ? new Date(existing.scheduled_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                                    : 'saved'}
                                </div>
                              )}
                            </div>
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

      {/* Parent Feedback Modal */}
      <Modal
        open={!!feedbackModal}
        onClose={() => setFeedbackModal(null)}
        title="Parent Feedback & Rating"
        footer={<button className="btn btn-ghost" onClick={() => setFeedbackModal(null)}>Close</button>}
      >
        {feedbackModal && (() => {
          const rating = ratingsMap[feedbackModal.id];
          return (
            <div>
              <div style={{
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 12, padding: 20, marginBottom: 20, textAlign: 'center',
              }}>
                <div style={{ fontSize: 48, fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>
                  {rating?.star_rating || '—'}
                </div>
                {rating && <StarDisplay value={rating.star_rating} size={22} />}
                <div className="text-sm text-muted mt-8">
                  Rating from {rating?.parent?.full_name || feedbackModal.parent?.full_name || 'Parent'}
                </div>
              </div>

              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 16 }}>
                <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>
                  Parent's Comment
                </div>
                {rating?.comment ? (
                  <p style={{ fontSize: 14, color: tokens.dark, lineHeight: 1.7, margin: 0 }}>
                    "{rating.comment}"
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: tokens.muted, margin: 0 }}>No comment provided.</p>
                )}
                <div className="text-xs text-muted mt-10">
                  {rating?.created_at
                    ? new Date(rating.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
                    : ''}
                </div>
              </div>

              <div style={{ marginTop: 16, background: tokens.primaryLight, borderRadius: 10, padding: 14, fontSize: 13, color: tokens.primary }}>
                <strong>Student:</strong> {feedbackModal.student?.name} · <strong>Subject:</strong> <span style={{ textTransform: 'capitalize' }}>{feedbackModal.subject}</span>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}