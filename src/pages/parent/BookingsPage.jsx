import { useState } from 'react';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import { useBookings, calculateCommission } from '../../hooks/useBookings';
import tokens from '../../lib/tokens';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const STATUS_VARIANT = {
  pending:                'warning',
  confirmed:              'success',
  rejected:               'danger',
  cancelled:              'gray',
  completed:              'info',
  pending_parent_confirm: 'warning',
};

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

// Inline toast that auto-dismisses
function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg    = type === 'success' ? '#D1FAE5' : type === 'error' ? '#FEE2E2' : '#EFF6FF';
  const color = type === 'success' ? '#065F46' : type === 'error' ? '#DC2626'  : '#1D4ED8';
  return (
    <div style={{ position:'fixed', top:24, right:24, zIndex:99999, background:bg, border:`1px solid ${color}30`, borderRadius:12, padding:'14px 20px', fontSize:14, color, fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,.12)', display:'flex', alignItems:'center', gap:10, maxWidth:360 }}>
      <span>{type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color, fontSize:16, padding:0, lineHeight:1 }}>✕</button>
    </div>
  );
}

export default function BookingsPage() {
  const { bookings, loading, updateBookingStatus, confirmComplete, saveSchedule } = useBookings();

  const [toast,        setToast]        = useState(null);   // {msg, type}
  const [schedModal,   setSchedModal]   = useState(null);   // booking object
  const [schedForm,    setSchedForm]    = useState({ day1:'', time1:'', day2:'', time2:'' });
  const [savingSched,  setSavingSched]  = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);   // booking object
  const [feedback, setFeedback] = useState({ indicator:'good', star_rating:5, rating_comment:'' });
  const [saving,       setSaving]       = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openSchedModal = (b) => {
    setSchedModal(b);
    setSchedForm({
      day1:  b.proposed_day_1  || '',
      time1: b.proposed_time_1 || '',
      day2:  b.proposed_day_2  || '',
      time2: b.proposed_time_2 || '',
    });
  };

  const handleProposeSchedule = async () => {
    if (!schedForm.day1 || !schedForm.time1) {
      showToast('Please select Day 1 and a start time.', 'error');
      return;
    }
    setSavingSched(true);
    try {
      await saveSchedule(schedModal.id, {
        proposed_day_1:  schedForm.day1,
        proposed_time_1: schedForm.time1,
        proposed_day_2:  schedForm.day2  || null,
        proposed_time_2: schedForm.time2 || null,
        schedule_status: 'proposed',
      });
      setSchedModal(null);
      showToast('Schedule proposal sent to tutor!');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSavingSched(false);
    }
  };

  const handleCancel = async (id) => {
    try {
      await updateBookingStatus(id, 'cancelled');
      showToast('Booking cancelled.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleConfirmComplete = async () => {
    setSaving(true);
    try {
      await confirmComplete(confirmModal.id, feedback);
      setConfirmModal(null);
      setFeedback({ topic:'', indicator:'good', star_rating:5, rating_comment:'' });
      showToast('Session confirmed and rating submitted!');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner dark size={32} />;

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />

      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize:22 }}>Bookings</h2>
        <p className="text-sm text-muted mt-4">View your bookings and set session schedules with your tutor.</p>
      </div>

      {bookings.length === 0 ? (
        <div className="card">
          <EmptyState icon="📅" title="No bookings yet" description="Find a tutor, chat via Messages, then book a session package." />
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Child</th><th>Tutor</th><th>Subject</th>
                <th>Schedule</th><th>Total</th><th>Payment</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => {
                const hasSched    = b.schedule_status === 'confirmed' && b.confirmed_day_1;
                const hasProposed = b.schedule_status === 'proposed'  && b.proposed_day_1;
                return (
                  <tr key={b.id}>
                    <td className="font-semibold" style={{ fontSize:13 }}>{b.student?.name || '—'}</td>
                    <td style={{ fontSize:13 }}>{b.tutor?.full_name || '—'}</td>
                    <td style={{ fontSize:13, textTransform:'capitalize' }}>{b.subject || '—'}</td>

                    {/* Schedule column */}
                    <td style={{ fontSize:12 }}>
                      {hasSched ? (
                        <div>
                          <div style={{ color:'#065F46', fontWeight:600 }}>✓ {b.confirmed_day_1} {fmtTime(b.confirmed_time_1)}</div>
                          {b.confirmed_day_2 && <div style={{ color:'#065F46', fontWeight:600 }}>✓ {b.confirmed_day_2} {fmtTime(b.confirmed_time_2)}</div>}
                        </div>
                      ) : hasProposed ? (
                        <div>
                          <div style={{ color:'#92400E' }}>⏳ {b.proposed_day_1} {fmtTime(b.proposed_time_1)}</div>
                          {b.proposed_day_2 && <div style={{ color:'#92400E' }}>⏳ {b.proposed_day_2} {fmtTime(b.proposed_time_2)}</div>}
                        </div>
                      ) : (
                        <span style={{ color:tokens.muted }}>Not set</span>
                      )}
                    </td>

                    <td className="font-semibold" style={{ fontSize:13 }}>₱{Number(b.total_amount||0).toLocaleString()}</td>
                    <td style={{ fontSize:13, textTransform:'capitalize' }}>{(b.payment_method||'').replace('_',' ')}</td>

                    <td>
                      <Badge variant={STATUS_VARIANT[b.status]||'gray'}>
                        {b.status === 'pending_parent_confirm' ? 'Needs Confirmation' : b.status}
                      </Badge>
                    </td>

                    <td>
                      <div className="flex gap-6" style={{ flexWrap:'wrap' }}>
                        {/* Schedule button — confirmed bookings only */}
                        {b.status === 'confirmed' && (
                          <button className="btn btn-sm" style={{ background:'#EFF6FF', color:tokens.primary, border:`1px solid ${tokens.primary}30` }} onClick={() => openSchedModal(b)}>
                            <Icon name="calendar" size={11} color={tokens.primary} />
                            {b.schedule_status === 'confirmed' ? ' Update' : ' Schedule'}
                          </button>
                        )}
                        {/* Confirm+Rate button — tutor marked complete */}
                        {b.status === 'pending_parent_confirm' && (
                          <button className="btn btn-primary btn-sm" onClick={() => setConfirmModal(b)}>
                            ✓ Confirm & Rate
                          </button>
                        )}
                        {/* Cancel — pending only */}
                        {b.status === 'pending' && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b.id)}>
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

      {/* ── Schedule Modal ── */}
      <Modal
        open={!!schedModal}
        onClose={() => setSchedModal(null)}
        title="📅 Propose Session Schedule"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setSchedModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleProposeSchedule} disabled={savingSched}>
            {savingSched ? 'Saving...' : '✓ Send Proposal'}
          </button>
        </>}
      >
        {schedModal && (
          <div>
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#1D4ED8' }}>
              ℹ️ Sessions run <strong>twice a week, 1.5 hours each</strong>. Propose your preferred days and times. The tutor will confirm.
            </div>

            {/* Show current confirmed if exists */}
            {schedModal.schedule_status === 'confirmed' && schedModal.confirmed_day_1 && (
              <div style={{ background:'#D1FAE5', border:'1px solid #6EE7B7', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#065F46', fontWeight:600 }}>
                ✅ Current confirmed: {schedModal.confirmed_day_1} {fmtTime(schedModal.confirmed_time_1)}
                {schedModal.confirmed_day_2 && ` · ${schedModal.confirmed_day_2} ${fmtTime(schedModal.confirmed_time_2)}`}
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <div className="font-semibold mb-8" style={{ fontSize:13 }}>Session Day 1 <span style={{ color:'#DC2626' }}>*</span></div>
              <div className="grid-2">
                <select className="select" value={schedForm.day1} onChange={e => setSchedForm(f => ({ ...f, day1:e.target.value }))}>
                  <option value="">Select day</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input className="input" type="time" value={schedForm.time1} onChange={e => setSchedForm(f => ({ ...f, time1:e.target.value }))} />
              </div>
            </div>

            <div>
              <div className="font-semibold mb-8" style={{ fontSize:13 }}>Session Day 2 <span className="text-xs text-muted">(optional)</span></div>
              <div className="grid-2">
                <select className="select" value={schedForm.day2} onChange={e => setSchedForm(f => ({ ...f, day2:e.target.value }))}>
                  <option value="">Select day</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input className="input" type="time" value={schedForm.time2} onChange={e => setSchedForm(f => ({ ...f, time2:e.target.value }))} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirm & Rate Modal ── */}
      <Modal
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title="✅ Confirm Session & Rate Tutor"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setConfirmModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirmComplete} disabled={saving}>
            {saving ? 'Saving...' : '✓ Confirm & Submit'}
          </button>
        </>}
      >
        {confirmModal && (
          <div>
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#1D4ED8' }}>
              ℹ️ The tutor marked this booking as complete. Please confirm and rate.
            </div>
            <FormGroup label="Child's Performance">
              <div className="flex gap-8">
                {[
                  { value:'good',             label:'⭐ Good',        bg:'#D1FAE5', color:'#065F46' },
                  { value:'improving',        label:'📈 Improving',   bg:'#FEF3C7', color:'#92400E' },
                  { value:'needs_improvement',label:'📝 Needs Work',  bg:'#FEE2E2', color:'#DC2626' },
                ].map(o => (
                  <button key={o.value} type="button" onClick={() => setFeedback(f => ({ ...f, indicator:o.value }))}
                    style={{ flex:1, padding:'10px 8px', borderRadius:10, cursor:'pointer', border:`2px solid ${feedback.indicator===o.value?o.color:tokens.border}`, background:feedback.indicator===o.value?o.bg:'#FAFAFA', color:o.color, fontWeight:600, fontSize:12 }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </FormGroup>
            <FormGroup label="Star Rating">
              <div className="flex gap-4">
                {[1,2,3,4,5].map(s => (
                  <button key={s} type="button" onClick={() => setFeedback(f => ({ ...f, star_rating:s }))}
                    style={{ fontSize:28, background:'none', border:'none', cursor:'pointer', color:s<=feedback.star_rating?'#F59E0B':'#D1D5DB', transition:'color 0.15s' }}>★</button>
                ))}
              </div>
            </FormGroup>
            <FormGroup label="Comment (Optional)">
              <textarea className="textarea" placeholder="Share feedback for the tutor..." value={feedback.rating_comment} onChange={e => setFeedback(f => ({ ...f, rating_comment:e.target.value }))} style={{ minHeight:80 }} />
            </FormGroup>
          </div>
        )}
      </Modal>
    </div>
  );
}