import { useState } from 'react';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import { supabase } from '../../lib/supabase';
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
  const [schedList,    setSchedList]    = useState([]);    // 8 session dates for view modal
  const [loadingSched, setLoadingSched] = useState(false);
  const [viewSlots,    setViewSlots]    = useState(null);   // booking object for slot list
  const [bookingSlots, setBookingSlots] = useState([]);     // slots for selected booking
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [schedForm,    setSchedForm]    = useState({ day1:'', time1:'', day2:'', time2:'' });
  const [savingSched,  setSavingSched]  = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);   // booking object
  const [feedback,     setFeedback]     = useState({ topic:'', indicator:'good', star_rating:5, rating_comment:'' });
  const [saving,       setSaving]       = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBookingSlots = async (bookingId) => {
    setLoadingSlots(true);
    const { data } = await supabase
      .from('booking_slots')
      .select('*')
      .eq('booking_id', bookingId)
      .order('session_number');
    setBookingSlots(data||[]);
    setLoadingSlots(false);
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

  const openSchedView = async (b) => {
    setSchedModal(b);
    setLoadingSched(true);
    const { data } = await supabase
      .from('booking_schedules')
      .select('*')
      .eq('booking_id', b.id)
      .order('session_num');
    setSchedList(data||[]);
    setLoadingSched(false);
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
    if (!feedback.topic.trim()) { showToast('Please enter the topic covered.', 'error'); return; }
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

                    {/* Schedule column — View button */}
                    <td>
                      <button className="btn btn-sm"
                        style={{background:'#EFF6FF',color:tokens.primary,border:`1px solid ${tokens.primary}30`}}
                        onClick={async()=>{setViewSlots(b);await fetchBookingSlots(b.id);}}>
                        📅 View
                      </button>
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
                        {/* View Schedule button — show confirmed schedule details */}
                        {b.status === 'confirmed' && b.scheduled_date && (
                          <button className="btn btn-sm" style={{ background:'#D1FAE5', color:'#065F46', border:'1px solid #6EE7B7' }}
                            onClick={() => setSchedModal(b)}>
                            📅 View Schedule
                          </button>
                        )}
                        {b.status === 'confirmed' && !b.scheduled_date && b.schedule_status === 'pending' && (
                          <span style={{ fontSize:11, color:'#F59E0B', fontWeight:700 }}>⏳ Awaiting tutor</span>
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

      {/* ── View Schedule Modal ── */}
      <Modal
        open={!!schedModal}
        onClose={() => setSchedModal(null)}
        title="📅 Confirmed Session Schedule"
        footer={<button className="btn btn-ghost" onClick={() => setSchedModal(null)}>Close</button>}
      >
        {schedModal && (
          <div>
            <div style={{ background:'#D1FAE5', border:'2px solid #6EE7B7', borderRadius:14, padding:24, textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
              <div className="font-jakarta font-extrabold mb-8" style={{ fontSize:20, color:'#065F46' }}>Schedule Confirmed!</div>
              <div style={{ fontSize:16, fontWeight:700, color:'#065F46', marginBottom:4 }}>
                📅 {schedModal.scheduled_date ? new Date(schedModal.scheduled_date + 'T00:00:00').toLocaleDateString('en-PH', {weekday:'long', month:'long', day:'numeric', year:'numeric'}) : '—'}
              </div>
              <div style={{ fontSize:16, fontWeight:700, color:'#065F46' }}>
                🕐 {schedModal.scheduled_time ? (() => { const [h] = schedModal.scheduled_time.split(':'); const hr = parseInt(h); return `${hr > 12 ? hr-12 : hr || 12}:00 ${hr >= 12 ? 'PM' : 'AM'}`; })() : '—'}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                ['Child',   schedModal.student?.name    || '—'],
                ['Tutor',   schedModal.tutor?.full_name || '—'],
                ['Subject', schedModal.subject          || '—'],
                ['Mode',    schedModal.session_mode     || '—'],
                ['Payment', (schedModal.payment_method || '').replace('_',' ')],
                ['Total',   `₱${Number(schedModal.total_amount||0).toLocaleString()}`],
              ].map(([k,v]) => (
                <div key={k} style={{ background:'#F9FAFB', borderRadius:8, padding:12 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing:'0.5px' }}>{k}</div>
                  <div className="font-semibold" style={{ fontSize:13, textTransform:'capitalize' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ── View Schedule Slots Modal ── */}
      <Modal
        open={!!viewSlots}
        onClose={()=>setViewSlots(null)}
        title="📅 Session Schedule"
        footer={<button className="btn btn-ghost" onClick={()=>setViewSlots(null)}>Close</button>}
      >
        {viewSlots&&(
          <div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:13,color:tokens.muted,marginBottom:4}}>
                {viewSlots.student?.name} · {viewSlots.tutor?.full_name} · <span style={{textTransform:'capitalize'}}>{viewSlots.subject}</span>
              </div>
            </div>
            {loadingSlots ? (
              <div style={{textAlign:'center',padding:'20px 0',color:tokens.muted}}>Loading...</div>
            ) : bookingSlots.length===0 ? (
              <div style={{textAlign:'center',padding:'24px 0'}}>
                <div style={{fontSize:36,marginBottom:8}}>📅</div>
                <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>No schedule yet</div>
                <p style={{fontSize:13,color:tokens.muted}}>Your tutor hasn't confirmed the schedule yet.</p>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div className="font-jakarta font-bold" style={{fontSize:15}}>
                    {bookingSlots.length} of 8 Sessions
                  </div>
                  <span style={{fontSize:12,fontWeight:700,padding:'3px 10px',borderRadius:20,
                    background:viewSlots.schedule_status==='confirmed'?'#D1FAE5':'#FEF9C3',
                    color:viewSlots.schedule_status==='confirmed'?'#065F46':'#92400E'}}>
                    {viewSlots.schedule_status==='confirmed'?'✓ Confirmed':'⏳ Pending'}
                  </span>
                </div>
                {bookingSlots.map((slot,i)=>{
                  const [h] = (slot.slot_time||'').split(':');
                  const hr = parseInt(h);
                  const timeLabel = slot.slot_time ? `${hr>12?hr-12:hr||12}:00 ${hr>=12?'PM':'AM'}` : '—';
                  const dateLabel = slot.slot_date ? new Date(slot.slot_date+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'long',day:'numeric',year:'numeric'}) : '—';
                  return (
                    <div key={slot.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:10,
                      background:slot.status==='confirmed'?'#F0FDF4':'#FFFBEB',
                      border:`1.5px solid ${slot.status==='confirmed'?'#6EE7B7':'#FDE68A'}`}}>
                      <span style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
                        background:slot.status==='confirmed'?'#22C55E':'#F59E0B',
                        color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800}}>
                        {i+1}
                      </span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13}}>{dateLabel}</div>
                        <div style={{fontSize:12,color:tokens.muted}}>{timeLabel}</div>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:slot.status==='confirmed'?'#065F46':'#D97706'}}>
                        {slot.status==='confirmed'?'✓ Confirmed':'⏳ Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
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
          <button className="btn btn-primary" onClick={handleConfirmComplete} disabled={saving || !feedback.topic}>
            {saving ? 'Saving...' : '✓ Confirm & Submit'}
          </button>
        </>}
      >
        {confirmModal && (
          <div>
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#1D4ED8' }}>
              ℹ️ The tutor marked this booking as complete. Please confirm and rate.
            </div>
            <FormGroup label="Topic Covered">
              <input className="input" placeholder="e.g. Unlike Fractions..." value={feedback.topic} onChange={e => setFeedback(f => ({ ...f, topic:e.target.value }))} />
            </FormGroup>
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