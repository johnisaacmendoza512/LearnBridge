import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBookings, calculateCommission } from '../../hooks/useBookings';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/ui/Modal';
import AppDialog from '../../components/ui/AppDialog';
import FormGroup from '../../components/ui/FormGroup';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const TUTOR_STATUS = {
  pending:               { label: 'Pending',          color: '#CA8A04', bg: '#FEF9C3' },
  confirmed:             { label: 'Confirmed',         color: '#16A34A', bg: '#D1FAE5' },
  rejected:              { label: 'Rejected',          color: '#DC2626', bg: '#FEE2E2' },
  cancelled:             { label: 'Cancelled',         color: '#DC2626', bg: '#FEE2E2' },
  pending_parent_confirm:{ label: 'Awaiting Parent',   color: '#7C3AED', bg: '#EDE9FE' },
  completed:             { label: 'Completed',         color: '#16A34A', bg: '#D1FAE5' },
};

const PARENT_STATUS = {
  pending:               { label: 'Pending',           color: '#CA8A04', bg: '#FEF9C3' },
  confirmed:             { label: 'On-going',          color: '#2563EB', bg: '#DBEAFE' },
  rejected:              { label: 'Rejected',          color: '#DC2626', bg: '#FEE2E2' },
  cancelled:             { label: 'Cancelled',         color: '#DC2626', bg: '#FEE2E2' },
  pending_parent_confirm:{ label: 'Awaiting Your Confirmation', color: '#7C3AED', bg: '#EDE9FE' },
  completed:             { label: 'Completed',         color: '#16A34A', bg: '#D1FAE5' },
};

// ── Parent Rating Display — shown in tutor's View modal for completed bookings ──
function RatingDisplay({ bookingId }) {
  const [rating,  setRating]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) return;
    supabase
      .from('tutor_ratings')
      .select('star_rating, comment, created_at, parent:parent_id ( full_name )')
      .eq('booking_id', bookingId)
      .single()
      .then(({ data }) => { setRating(data); setLoading(false); });
  }, [bookingId]);

  if (loading) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>
        Parent Rating & Feedback
      </div>
      {!rating ? (
        <div style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: 8, fontSize: 13, color: tokens.muted }}>
          No parent rating submitted yet for this booking.
        </div>
      ) : (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 16 }}>
          <div className="flex items-center gap-8 mb-8">
            {[1,2,3,4,5].map(s => (
              <span key={s} style={{ fontSize: 24, color: s <= rating.star_rating ? '#F59E0B' : '#D1D5DB' }}>★</span>
            ))}
            <span className="font-semibold" style={{ fontSize: 14, color: '#F59E0B' }}>
              {rating.star_rating}/5
            </span>
          </div>
          {rating.comment && (
            <p style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.6, margin: '0 0 8px' }}>
              "{rating.comment}"
            </p>
          )}
          <div className="text-xs text-muted">
            — {rating.parent?.full_name || 'Parent'} · {rating.created_at
              ? new Date(rating.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
              : ''}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const {
    bookings, loading,
    updateBookingStatus,
    markComplete,
    confirmComplete,
  } = useBookings();

  const isTutor  = profile?.role === 'tutor';
  const isParent = profile?.role === 'parent';

  const [selected,     setSelected]     = useState(null);
  const [updating,     setUpdating]     = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [dialog,       setDialog]       = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({
    topic: '', indicator: 'good', star_rating: 0, rating_comment: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const setF = (k, v) => setFeedbackForm(f => ({ ...f, [k]: v }));

  if (loading) return <Spinner dark size={32} />;

  // ── Tutor: Accept booking with wallet balance check ───────────────────
  const handleAccept = async (booking) => {
    setUpdating(booking.id);
    try {
      // Fetch tutor's approved rate and wallet balance
      const { data: tutorData } = await supabase
        .from('tutors')
        .select('approved_rate, rate_per_session, wallet_balance')
        .eq('id', profile.id)
        .single();

      const walletBalance = Number(tutorData?.wallet_balance || 0);

      // Calculate the actual 10% commission for this specific booking
      const { rate, sessionCount, totalAmount, commission } = calculateCommission(
        booking,
        tutorData?.approved_rate || tutorData?.rate_per_session
      );

      // Only block if wallet can't cover the actual commission
      if (walletBalance < commission) {
        setDialog({
          type:         'warning',
          title:        'Insufficient Wallet Balance',
          message:      `You don't have enough wallet balance to cover the 10% platform commission for this booking.\n\nBooking Total: ₱${totalAmount.toLocaleString()}\nCommission (10%): ₱${commission.toFixed(2)}\nYour Balance: ₱${walletBalance.toFixed(2)}\n\nPlease top up your wallet before accepting this booking.`,
          confirmLabel: 'Go to Wallet',
          onConfirm:    () => { setDialog(null); navigate('/wallet'); },
        });
        return;
      }

      // Enough balance — show confirm with full breakdown
      setDialog({
        type:         'confirm',
        title:        'Accept Booking',
        message:      `Accept this booking request?\n\nRate: ₱${rate.toLocaleString()}/session × ${sessionCount} sessions\nBooking Total: ₱${totalAmount.toLocaleString()}\nPlatform Commission (10%): ₱${commission.toFixed(2)}\nYour Balance After: ₱${(walletBalance - commission).toFixed(2)}\n\nThe commission will be deducted when the parent confirms completion.`,
        confirmLabel: 'Accept Booking',
        onConfirm:    async () => {
          setDialog(null);
          await supabase.from('bookings').update({
            commission_amount: commission,
            total_amount:      totalAmount,
          }).eq('id', booking.id);
          await updateBookingStatus(booking.id, 'confirmed');
        },
      });
    } catch (e) {
      setDialog({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setUpdating(null);
    }
  };

  const handleReject = async (id) => {
    setDialog({
      type: 'confirm',
      title: 'Reject Booking',
      message: 'Are you sure you want to reject this booking request?',
      confirmLabel: 'Yes, Reject',
      confirmDanger: true,
      onConfirm: async () => {
        setDialog(null);
        setUpdating(id);
        try { await updateBookingStatus(id, 'rejected'); }
        catch (e) { setDialog({ type: 'error', title: 'Error', message: e.message }); }
        finally { setUpdating(null); }
      },
    });
  };

  const handleMarkComplete = async (id) => {
    setDialog({
      type: 'confirm',
      title: 'Mark Session Complete',
      message: 'Mark this session as complete?\nThe parent will be asked to confirm and provide feedback.',
      confirmLabel: 'Yes, Mark Complete',
      onConfirm: async () => {
        setDialog(null);
        setUpdating(id);
        try { await markComplete(id); }
        catch (e) { setDialog({ type: 'error', title: 'Error', message: e.message }); }
        finally { setUpdating(null); }
      },
    });
  };

  const handleCancel = async (id) => {
    setDialog({
      type: 'confirm',
      title: 'Cancel Booking',
      message: 'Are you sure you want to cancel this booking?',
      confirmLabel: 'Yes, Cancel',
      confirmDanger: true,
      onConfirm: async () => {
        setDialog(null);
        setUpdating(id);
        try { await updateBookingStatus(id, 'cancelled'); }
        catch (e) { setDialog({ type: 'error', title: 'Error', message: e.message }); }
        finally { setUpdating(null); }
      },
    });
  };

  const handleConfirmComplete = async () => {
    setSubmitting(true);
    try {
      await confirmComplete(confirmModal.id, feedbackForm);
      setConfirmModal(null);
      setFeedbackForm({ topic: '', indicator: 'good', star_rating: 0, rating_comment: '' });
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Bookings</h2>
        <p className="text-sm text-muted mt-4">
          {isTutor
            ? 'Manage booking requests from parents.'
            : 'View and manage your tutoring session bookings.'}
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="📅"
            title="No bookings yet"
            description={isTutor
              ? 'Booking requests from parents will appear here.'
              : 'Inquire a tutor and book a session to get started.'}
          />
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                {isTutor
                  ? <><th>Parent</th><th>Child</th></>
                  : <><th>Child</th><th>Tutor</th></>}
                <th>Subject</th>
                <th>Mode</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, i) => {
                const statusMap  = isTutor ? TUTOR_STATUS : PARENT_STATUS;
                const statusCfg  = statusMap[b.status] || statusMap.pending;
                const isUpdating = updating === b.id;

                return (
                  <tr key={b.id}>
                    {isTutor ? (
                      <>
                        <td>
                          <div className="flex items-center gap-8">
                            <Avatar name={b.parent?.full_name || 'P'} size={28} colorIndex={i} />
                            <span className="font-semibold" style={{ fontSize: 13 }}>
                              {b.parent?.full_name || '—'}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {b.student?.name ? `${b.student.name} (Gr. ${b.student.grade_level})` : '—'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <div className="flex items-center gap-8">
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: tokens.primaryLight, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, color: tokens.primary,
                            }}>
                              {(b.student?.name || '?').charAt(0)}
                            </div>
                            <span className="font-semibold" style={{ fontSize: 13 }}>
                              {b.student?.name || '—'}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{b.tutor?.full_name || '—'}</td>
                      </>
                    )}

                    <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{b.subject || '—'}</td>
                    <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{b.session_mode || '—'}</td>
                    <td className="font-semibold" style={{ fontSize: 13 }}>
                      {b.total_amount ? `₱${Number(b.total_amount).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{b.payment_method || '—'}</td>

                    {/* ── STATUS COLUMN ── */}
                    <td>
                      {/* Tutor: confirmed → Complete button */}
                      {isTutor && b.status === 'confirmed' && (
                        <button
                          className="btn btn-sm"
                          disabled={isUpdating}
                          onClick={() => handleMarkComplete(b.id)}
                          style={{ background: '#7C3AED', color: '#fff', fontSize: 12, padding: '5px 12px' }}
                        >
                          {isUpdating ? '...' : <><Icon name="check" size={11} /> Complete</>}
                        </button>
                      )}

                      {/* Tutor: waiting for parent */}
                      {isTutor && b.status === 'pending_parent_confirm' && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                          background: '#EDE9FE', color: '#7C3AED',
                        }}>
                          ⏳ Awaiting Parent
                        </span>
                      )}

                      {/* Parent: confirm button */}
                      {isParent && b.status === 'pending_parent_confirm' && (
                        <button
                          className="btn btn-sm"
                          disabled={isUpdating}
                          onClick={() => {
                            setConfirmModal(b);
                            setFeedbackForm({ topic: '', indicator: 'good', star_rating: 0, rating_comment: '' });
                          }}
                          style={{
                            background: tokens.success, color: '#fff',
                            fontSize: 12, padding: '5px 12px',
                            animation: 'pulse-green 2s infinite',
                          }}
                        >
                          <Icon name="check" size={11} /> Confirm
                        </button>
                      )}

                      {/* Completed */}
                      {b.status === 'completed' && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                          background: '#D1FAE5', color: '#065F46',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <Icon name="check" size={10} color="#065F46" /> Completed
                        </span>
                      )}

                      {/* Other statuses */}
                      {!['confirmed', 'pending_parent_confirm', 'completed'].includes(b.status) && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                          background: statusCfg.bg, color: statusCfg.color,
                          textTransform: 'capitalize',
                        }}>
                          {statusCfg.label}
                        </span>
                      )}

                      {/* Parent: On-going for confirmed */}
                      {isParent && b.status === 'confirmed' && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                          background: PARENT_STATUS.confirmed.bg, color: PARENT_STATUS.confirmed.color,
                        }}>
                          {PARENT_STATUS.confirmed.label}
                        </span>
                      )}
                    </td>

                    {/* ── ACTIONS COLUMN ── */}
                    <td>
                      <div className="flex gap-6">
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(b)}>
                          <Icon name="eye" size={12} /> View
                        </button>

                        {/* Tutor: accept/reject pending */}
                        {isTutor && b.status === 'pending' && (
                          <>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#D1FAE5', color: '#065F46' }}
                              disabled={isUpdating}
                              onClick={() => handleAccept(b)}
                            >
                              <Icon name="check" size={11} /> Accept
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#FEE2E2', color: '#DC2626' }}
                              disabled={isUpdating}
                              onClick={() => handleReject(b.id)}
                            >
                              <Icon name="x" size={11} /> Reject
                            </button>
                          </>
                        )}

                        {/* Parent: cancel pending */}
                        {isParent && b.status === 'pending' && (
                          <button
                            className="btn btn-sm"
                            style={{ background: '#FEE2E2', color: '#DC2626' }}
                            disabled={isUpdating}
                            onClick={() => handleCancel(b.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* View Detail Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Booking Details"
        footer={<button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>}
      >
        {selected && (
          <div>
            <div className="grid-2">
              {[
                ['Child',   selected.student?.name || '—'],
                ['Parent',  selected.parent?.full_name || '—'],
                ['Tutor',   selected.tutor?.full_name  || '—'],
                ['Subject', selected.subject || '—'],
                ['Mode',    selected.session_mode || '—'],
                ['Payment', selected.payment_method || '—'],
                ['Amount',  selected.total_amount ? `₱${Number(selected.total_amount).toLocaleString()}` : '—'],
                ['Commission', selected.commission_amount ? `₱${Number(selected.commission_amount).toLocaleString()}` : '—'],
                ['Status',  isParent
                  ? (PARENT_STATUS[selected.status]?.label || selected.status)
                  : (TUTOR_STATUS[selected.status]?.label  || selected.status)],
                ['Booked',  selected.created_at
                  ? new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                  <div className="font-semibold" style={{ fontSize: 13, textTransform: 'capitalize' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Show parent rating for tutor viewing a completed booking */}
            {isTutor && selected?.status === 'completed' && (
              <RatingDisplay bookingId={selected?.id} />
            )}
          </div>
        )}
      </Modal>

      {/* Confirm + Feedback Modal (Parent) */}
      <Modal
        open={!!confirmModal}
        onClose={() => !submitting && setConfirmModal(null)}
        title="Confirm Session & Submit Feedback"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setConfirmModal(null)} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirmComplete}
            disabled={submitting || feedbackForm.star_rating === 0}
          >
            <Icon name="check" size={13} />
            {submitting ? ' Submitting...' : ' Confirm & Submit'}
          </button>
        </>}
      >
        {confirmModal && (
          <div>
            <div style={{
              background: '#EFF6FF', border: `1px solid #BFDBFE`,
              borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              fontSize: 13, color: '#1D4ED8',
            }}>
              <strong>📋 Session with:</strong> {confirmModal.tutor?.full_name}
              {' · '}Child: {confirmModal.student?.name}
              {' · Subject: '}<span style={{ textTransform: 'capitalize' }}>{confirmModal.subject}</span>
            </div>

            <div style={{
              background: '#FFF7ED', border: `1px solid #FED7AA`,
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              fontSize: 13, color: '#92400E',
            }}>
              ⚠️ Confirming means this session was conducted. Please rate the tutor and provide feedback.
            </div>

            {/* Star Rating */}
            <div style={{ marginBottom: 20 }}>
              <label className="form-label">
                Rate the Tutor <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setF('star_rating', star)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 32, padding: 0, lineHeight: 1,
                      color: star <= feedbackForm.star_rating ? '#F59E0B' : '#D1D5DB',
                      transition: 'color 0.15s, transform 0.1s',
                      transform: star <= feedbackForm.star_rating ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    ★
                  </button>
                ))}
                <span style={{ fontSize: 13, marginLeft: 8, color: feedbackForm.star_rating === 0 ? '#DC2626' : tokens.muted, fontWeight: feedbackForm.star_rating === 0 ? 600 : 400 }}>
                  {feedbackForm.star_rating === 0 ? 'Please select a rating'
                    : feedbackForm.star_rating === 5 ? 'Excellent!'
                    : feedbackForm.star_rating === 4 ? 'Good'
                    : feedbackForm.star_rating === 3 ? 'Average'
                    : feedbackForm.star_rating === 2 ? 'Below Average'
                    : 'Poor'}
                </span>
              </div>
            </div>

            <FormGroup label="Your Feedback / Comment" hint="This will be visible to other parents in Find Tutors.">
              <textarea
                className="textarea"
                placeholder="Share your experience — how was the tutor? Did your child improve?"
                value={feedbackForm.rating_comment}
                onChange={e => setF('rating_comment', e.target.value)}
                style={{ minHeight: 90 }}
              />
            </FormGroup>
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,.4); }
          50%       { box-shadow: 0 0 0 8px rgba(22,163,74,0); }
        }
      `}</style>

      <AppDialog
        open={!!dialog}
        type={dialog?.type}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        confirmDanger={dialog?.confirmDanger}
        onClose={() => setDialog(null)}
        onConfirm={dialog?.onConfirm}
      />
    </div>
  );
}