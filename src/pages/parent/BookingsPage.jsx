import { useState, useEffect } from 'react';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
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
  const { user } = useAuth();
  const { bookings, loading, updateBookingStatus, confirmComplete, saveSchedule, refresh } = useBookings();

  const [toast,        setToast]        = useState(null);   // {msg, type}
  const [schedModal,   setSchedModal]   = useState(null);   // booking object
  const [schedList,    setSchedList]    = useState([]);    // 8 session dates for view modal
  const [loadingSched, setLoadingSched] = useState(false);
  const [reschedSlot,  setReschedSlot]  = useState(null);
  const [reschedDate,  setReschedDate]  = useState('');
  const [reschedHour,  setReschedHour]  = useState('');
  const [savingResched,setSavingResched]= useState(false);
  const [detailModal,  setDetailModal]  = useState(null); // booking details
  const [payingId,     setPayingId]     = useState(null); // booking being paid
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
    const { data, error } = await supabase
      .from('booking_slots')
      .select('*')
      .eq('booking_id', bookingId)
      .order('slot_date')
      .order('slot_time');
    if (error) console.error('fetchBookingSlots error:', error.message);
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
    setReschedSlot(null);
    setReschedDate('');
    setReschedHour('');
    setLoadingSched(true);
    const { data } = await supabase
      .from('booking_schedules')
      .select('*')
      .eq('booking_id', b.id)
      .order('session_num');
    setSchedList(data||[]);
    setLoadingSched(false);
  };

  const refreshSchedList = async (bookingId) => {
    const { data } = await supabase
      .from('booking_schedules')
      .select('*')
      .eq('booking_id', bookingId)
      .order('session_num');
    setSchedList(data||[]);
  };

  const handleReschedule = async () => {
    if (!reschedSlot || !reschedDate || !reschedHour) {
      showToast('Please select a new date and time.', 'error'); return;
    }
    setSavingResched(true);
    try {
      const newTimeStr = `${String(reschedHour).padStart(2,'0')}:00:00`;

      // Update booking_schedules row
      const { error: schErr } = await supabase.from('booking_schedules')
        .update({ session_date: reschedDate, session_time: newTimeStr, status: 'upcoming' })
        .eq('id', reschedSlot.id);
      if (schErr) throw schErr;

      // UPDATE the existing rejected slot in place — keeps exactly 8 slots
      const { error: slotErr } = await supabase.from('booking_slots')
        .update({
          slot_date: reschedDate,
          slot_time: newTimeStr,
          status:    'pending',
        })
        .eq('id', reschedSlot.id);
      if (slotErr) throw slotErr;

      showToast('✅ New date submitted! Waiting for tutor to confirm.');
      setReschedSlot(null);
      setReschedDate('');
      setReschedHour('');
      await refreshSchedList(schedModal.id);
    } catch(e) { showToast(e.message, 'error'); }
    finally { setSavingResched(false); }
  };

  const handleCancel = async (id) => {
    try {
      await updateBookingStatus(id, 'cancelled');
      showToast('Booking cancelled.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleConfirmAndPay = async (b) => {
    // Prevent double payment — check current payment status first
    const { data: freshBooking } = await supabase
      .from('bookings')
      .select('payment_status, status')
      .eq('id', b.id)
      .single();

    if (freshBooking?.payment_status === 'paid') {
      showToast('This booking has already been paid.', 'error');
      refresh();
      return;
    }

    setPayingId(b.id);
    try {
      const RATE_PER_SESSION = 1;
      const SESSIONS         = 8;
      const totalAmount      = RATE_PER_SESSION * SESSIONS;

      // Check parent wallet balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', user.id)
        .single();

      const balance = Number(profile?.wallet_balance || 0);
      if (balance < totalAmount) {
        showToast(`Insufficient wallet balance. You need ₱${totalAmount.toFixed(2)} but have ₱${balance.toFixed(2)}. Please top up first.`, 'error');
        setPayingId(null);
        return;
      }

      const gross    = totalAmount;
      const fee      = Math.round(gross * 0.10 * 100) / 100;
      const earnings = Math.round(gross * 0.90 * 100) / 100;

      // Deduct from parent wallet
      const { error: deductErr } = await supabase.rpc('decrement_wallet', {
        user_id: user.id,
        amount:  totalAmount,
      });
      if (deductErr) throw new Error('Failed to deduct from wallet: ' + deductErr.message);

      // Record parent deduction
      await supabase.from('wallet_transactions').insert({
        user_id:     user.id,
        type:        'deduction',
        amount:      totalAmount,
        description: `Payment for ${b.subject} sessions with ${b.tutor?.full_name||'Tutor'}`,
        booking_id:  b.id,
        status:      'completed',
      });

      // Add 90% to tutor wallet
      await supabase.rpc('increment_tutor_wallet', {
        tutor_id: b.tutor_id,
        amount:   earnings,
      });

      // Record tutor earning
      await supabase.from('wallet_transactions').insert({
        user_id:     b.tutor_id,
        type:        'earning',
        amount:      earnings,
        description: `90% earnings — ${b.subject} (${b.student?.name||'Student'}) via LearnBridge`,
        booking_id:  b.id,
        status:      'completed',
      });

      // Record platform commission
      const { error: commErr } = await supabase.from('platform_earnings').insert({
        booking_id:   b.id,
        gross_amount: gross,
        commission:   fee,
      });
      if (commErr) console.error('Platform earnings insert error:', commErr.message);

      // Mark booking as paid AND completed
      await supabase.from('bookings').update({
        payment_status: 'paid',
        paid_at:        new Date().toISOString(),
        platform_fee:   fee,
        tutor_earnings: earnings,
        status:         'completed',
      }).eq('id', b.id);

      showToast(`✅ Payment confirmed! ₱${earnings.toFixed(2)} sent to tutor.`);
      refresh(); // Refresh bookings so button disappears immediately
    } catch(e) {
      showToast(e.message, 'error');
    } finally {
      setPayingId(null);
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

                    {/* Schedule column — View Schedule button ONLY */}
                    <td>
                      {b.scheduled_date ? (
                        <button className="btn btn-sm"
                          style={{background:'#EFF6FF',color:tokens.primary,border:`1px solid ${tokens.primary}30`}}
                          onClick={async()=>{setViewSlots(b);await fetchBookingSlots(b.id);}}>
                          📅 View Schedule
                        </button>
                      ) : (
                        <span style={{fontSize:11,color:'#F59E0B',fontWeight:700}}>⏳ Pending</span>
                      )}
                    </td>

                    <td className="font-semibold" style={{ fontSize:13 }}>₱{Number(b.total_amount||0).toLocaleString()}</td>
                    <td style={{ fontSize:13, textTransform:'capitalize' }}>{(b.payment_method||'').replace('_',' ')}</td>

                    <td>
                      <Badge variant={STATUS_VARIANT[b.status]||'gray'}>
                        {b.status === 'pending_parent_confirm' ? 'Needs Confirmation' : b.status}
                      </Badge>
                    </td>

                    {/* Actions column — booking details + action buttons */}
                    <td>
                      <div className="flex gap-6" style={{ flexWrap:'wrap' }}>
                        {/* View — booking details */}
                        <button className="btn btn-sm"
                          style={{background:'#F9FAFB',color:tokens.mid,border:`1px solid ${tokens.border}`}}
                          onClick={()=>setDetailModal(b)}>
                          👁 View
                        </button>
                        {/* Confirm & Pay — only after tutor marks complete (pending_parent_confirm) */}
                        {b.status === 'pending_parent_confirm' && (b.payment_status === 'unpaid' || !b.payment_status) && (
                          <button className="btn btn-sm"
                            style={{background:'#22C55E',color:'#fff',border:'none',fontWeight:700}}
                            onClick={()=>handleConfirmAndPay(b)}
                            disabled={payingId===b.id}>
                            {payingId===b.id ? '⏳ Processing...' : '✅ Confirm & Pay ₱8'}
                          </button>
                        )}
                        {/* Paid badge */}
                        {b.payment_status === 'paid' && (
                          <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#D1FAE5',color:'#065F46'}}>
                            ✅ Paid
                          </span>
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
        onClose={()=>{setViewSlots(null);setReschedSlot(null);}}
        title="📅 Session Schedule"
        footer={<button className="btn btn-ghost" onClick={()=>{setViewSlots(null);setReschedSlot(null);}}>Close</button>}
      >
        {viewSlots&&(
          <div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,color:tokens.muted}}>
                {viewSlots.student?.name} · {viewSlots.tutor?.full_name} · <span style={{textTransform:'capitalize'}}>{viewSlots.subject}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-12 mb-14" style={{flexWrap:'wrap'}}>
              {[['#F97316','Pending'],['#22C55E','Confirmed'],['#EF4444','Rejected — needs reschedule'],['#6B7280','Completed']].map(([c,l])=>(
                <div key={l} className="flex items-center gap-6">
                  <div style={{width:12,height:12,borderRadius:3,background:c,flexShrink:0}}/>
                  <span style={{fontSize:11,color:tokens.muted}}>{l}</span>
                </div>
              ))}
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
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div className="font-jakarta font-bold mb-4" style={{fontSize:14}}>
                  {bookingSlots.length} of 8 Sessions
                </div>

                {bookingSlots.map((slot,i)=>{
                  const [h]    = (slot.slot_time||'00:00').split(':');
                  const hr     = parseInt(h);
                  const timeLabel = slot.slot_time ? `${hr>12?hr-12:hr||12}:00 ${hr>=12?'PM':'AM'}` : '—';
                  const dateLabel = slot.slot_date ? new Date(slot.slot_date+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : '—';

                  const isRejected  = slot.status==='rejected';
                  const isConfirmed = slot.status==='confirmed';
                  const isCompleted = slot.status==='completed';
                  const isRescheduling = reschedSlot?.id===slot.id;

                  const bg    = isRejected?'#FEF2F2':isConfirmed?'#F0FDF4':isCompleted?'#F3F4F6':'#FFFBEB';
                  const border= isRejected?'#FECACA':isConfirmed?'#6EE7B7':isCompleted?'#E5E7EB':'#FDE68A';
                  const dotBg = isRejected?'#EF4444':isConfirmed?'#22C55E':isCompleted?'#6B7280':'#F97316';

                  return (
                    <div key={slot.id}>
                      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:10,background:bg,border:`1.5px solid ${border}`,cursor:isRejected?'pointer':'default',transition:'all 0.15s'}}
                        onClick={()=>isRejected&&setReschedSlot(isRescheduling?null:{...slot, session_date:slot.slot_date, session_time:slot.slot_time, session_num:i+1})}>
                        <div style={{width:12,height:12,borderRadius:'50%',background:dotBg,flexShrink:0}}/>
                        <span style={{fontSize:11,fontWeight:800,background:dotBg,color:'#fff',borderRadius:6,padding:'2px 8px',flexShrink:0}}>
                          S{i+1}
                        </span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:13}}>{dateLabel}</div>
                          <div style={{fontSize:12,color:tokens.muted}}>{timeLabel}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:11,fontWeight:700,color:dotBg}}>
                            {isRejected?'❌ Rejected':isConfirmed?'✅ Confirmed':isCompleted?'✓ Done':'⏳ Pending'}
                          </span>
                          {isRejected&&(
                            <span style={{fontSize:11,fontWeight:600,color:'#DC2626',textDecoration:'underline'}}>
                              {isRescheduling?'Cancel':'📅 Reschedule'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reschedule form */}
                      {isRescheduling&&(
                        <div style={{margin:'4px 0 8px 0',padding:16,background:'#FEF2F2',border:'1.5px solid #FECACA',borderRadius:10}}>
                          <div className="font-jakarta font-bold mb-10" style={{fontSize:13,color:'#DC2626'}}>
                            📅 Pick a new date for Session {i+1}
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                            <div>
                              <div style={{fontSize:12,color:tokens.muted,marginBottom:4}}>New Date</div>
                              <input type="date" className="input"
                                min={new Date().toISOString().split('T')[0]}
                                value={reschedDate}
                                onChange={e=>setReschedDate(e.target.value)}/>
                            </div>
                            <div>
                              <div style={{fontSize:12,color:tokens.muted,marginBottom:4}}>New Time</div>
                              <select className="select" value={reschedHour} onChange={e=>setReschedHour(e.target.value)}>
                                <option value="">Select time</option>
                                {Array.from({length:15},(_,i)=>i+6).map(h=>(
                                  <option key={h} value={h}>{h>12?h-12:h||12}:00 {h>=12?'PM':'AM'}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <button className="btn btn-primary btn-sm" onClick={async()=>{
                            if (!reschedDate||!reschedHour){showToast('Please select date and time.','error');return;}
                            setSavingResched(true);
                            try {
                              const newTimeStr = `${String(reschedHour).padStart(2,'0')}:00:00`;

                              // UPDATE the existing rejected slot in place
                              const { data: updatedSlot, error } = await supabase
                                .from('booking_slots')
                                .update({
                                  slot_date: reschedDate,
                                  slot_time: newTimeStr,
                                  status:    'pending',
                                })
                                .eq('id', slot.id)
                                .select()
                                .single();

                              if (error) throw error;
                              if (!updatedSlot) throw new Error('Slot not found or update failed.');

                              showToast('✅ New date submitted! Waiting for tutor confirmation.');
                              setReschedSlot(null);
                              setReschedDate('');
                              setReschedHour('');
                              await fetchBookingSlots(viewSlots.id);
                            } catch(e){showToast(e.message,'error');}
                            finally{setSavingResched(false);}
                          }} disabled={savingResched||!reschedDate||!reschedHour}>
                            {savingResched?'Submitting...':'✓ Submit New Date'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Warning banner */}
                {bookingSlots.some(s=>s.status==='rejected')&&(
                  <div style={{background:'#FEF9C3',border:'1px solid #FDE68A',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#92400E',fontWeight:600,marginTop:4}}>
                    ⚠️ {bookingSlots.filter(s=>s.status==='rejected').length} session(s) were rejected. Click the red session to pick a new date.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Booking Detail Modal ── */}
      <Modal
        open={!!detailModal}
        onClose={()=>setDetailModal(null)}
        title="📋 Booking Details"
        footer={<button className="btn btn-ghost" onClick={()=>setDetailModal(null)}>Close</button>}
      >
        {detailModal&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:14,padding:'16px 20px',background:tokens.primaryLight,borderRadius:12,marginBottom:16}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:tokens.primary,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{color:'#fff',fontWeight:800,fontSize:20}}>{(detailModal.tutor?.full_name||'T').charAt(0)}</span>
              </div>
              <div>
                <div className="font-jakarta font-extrabold" style={{fontSize:16}}>{detailModal.tutor?.full_name||'—'}</div>
                <div style={{fontSize:12,color:tokens.mid,textTransform:'capitalize'}}>{detailModal.subject} · {detailModal.session_mode}</div>
              </div>
              <div style={{marginLeft:'auto'}}>
                <Badge variant={STATUS_VARIANT[detailModal.status]||'gray'}>
                  {detailModal.status==='pending_parent_confirm'?'Needs Confirmation':detailModal.status}
                </Badge>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[
                ['Child',    detailModal.student?.name||'—'],
                ['Tutor',    detailModal.tutor?.full_name||'—'],
                ['Subject',  detailModal.subject||'—'],
                ['Mode',     detailModal.session_mode||'—'],
                ['Payment',  (detailModal.payment_method||'').replace('_',' ')],
                ['Total',    `₱${Number(detailModal.total_amount||0).toLocaleString()}`],
                ['Sessions', '8 sessions'],
                ['Booked on',detailModal.created_at?new Date(detailModal.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—'],
              ].map(([k,v])=>(
                <div key={k} style={{background:'#F9FAFB',borderRadius:8,padding:12}}>
                  <div className="text-xs text-muted uppercase font-bold mb-4" style={{letterSpacing:'0.5px'}}>{k}</div>
                  <div className="font-semibold" style={{fontSize:13,textTransform:'capitalize'}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirm & Rate Modal ── */}}
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