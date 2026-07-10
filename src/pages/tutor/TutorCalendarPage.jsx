import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getDaysInMonth(y,m)  { return new Date(y,m+1,0).getDate(); }
function getFirstDay(y,m)     { return new Date(y,m,1).getDay(); }
function toDateStr(y,m,d)     { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

function fmtTime(t) {
  if (!t) return '';
  const [h] = t.split(':');
  const hr = parseInt(h);
  return `${hr>12?hr-12:hr||12}:00 ${hr>=12?'PM':'AM'}`;
}

function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg=type==='error'?'#FEE2E2':'#D1FAE5', color=type==='error'?'#DC2626':'#065F46';
  return (
    <div style={{position:'fixed',top:24,right:24,zIndex:99999,background:bg,borderRadius:12,padding:'14px 20px',fontSize:14,color,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,.12)',display:'flex',alignItems:'center',gap:10,maxWidth:380}}>
      <span>{type==='error'?'❌':'✅'}</span><span style={{flex:1}}>{msg}</span>
      <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color,fontSize:16,padding:0}}>✕</button>
    </div>
  );
}

export default function TutorCalendarPage() {
  const { user } = useAuth();

  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [slots,    setSlots]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [selDate,  setSelDate]  = useState(null); // clicked date string
  const [dayModal, setDayModal] = useState(null); // array of slots for that day
  const [saving,   setSaving]   = useState(false);

  const showToast = (msg,type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('booking_slots')
      .select(`
        *,
        booking:booking_id (
          id, subject, session_mode, payment_method, total_amount,
          parent:parent_id (full_name, email),
          student:student_id (name, grade_level)
        )
      `)
      .eq('tutor_id', user.id)
      .order('slot_date')
      .order('slot_time');
    setSlots(data||[]);
    setLoading(false);
  },[user]);

  useEffect(()=>{ fetchSlots(); },[fetchSlots]);

  const getDateStatus = (dateStr) => {
    const daySlots = slots.filter(s=>s.slot_date===dateStr);
    if (!daySlots.length) return 'available';
    if (daySlots.some(s=>s.status==='confirmed')) return 'confirmed';
    if (daySlots.some(s=>s.status==='pending'))   return 'pending';
    return 'available';
  };

  const handleDayClick = (dateStr) => {
    const daySlots = slots.filter(s=>s.slot_date===dateStr);
    setSelDate(dateStr);
    setDayModal(daySlots); // show modal even if empty (shows "Available" message)
  };

  const handleAccept = async (slot) => {
    setSaving(true);
    try {
      const {error:slotErr} = await supabase.from('booking_slots').update({status:'confirmed'}).eq('id',slot.id);
      if (slotErr) throw slotErr;
      const {error:bookErr} = await supabase.from('bookings').update({
        schedule_status: 'confirmed',
        status:          'confirmed',
        scheduled_date:  slot.slot_date,
        scheduled_time:  slot.slot_time,
      }).eq('id', slot.booking_id);
      if (bookErr) throw bookErr;
      showToast('✅ Booking confirmed! The parent has been notified.');
      await fetchSlots();
      setDayModal(null); // close and let tutor reopen to see updated state
    } catch(e) { showToast(e.message,'error'); }
    finally { setSaving(false); }
  };

  const handleReject = async (slot) => {
    if (!window.confirm('Reject this booking request?')) return;
    setSaving(true);
    try {
      const {error:slotErr} = await supabase.from('booking_slots').update({status:'rejected'}).eq('id',slot.id);
      if (slotErr) throw slotErr;
      const {error:bookErr} = await supabase.from('bookings').update({
        schedule_status: 'rejected',
        status:          'rejected',
      }).eq('id', slot.booking_id);
      if (bookErr) throw bookErr;
      showToast('Booking rejected.');
      await fetchSlots();
      setDayModal(null);
    } catch(e) { showToast(e.message,'error'); }
    finally { setSaving(false); }
  };

  const daysInMonth    = getDaysInMonth(calYear, calMonth);
  const firstDayOfMonth= getFirstDay(calYear, calMonth);
  const todayStr       = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // Count pending for badge
  const pendingCount = slots.filter(s=>s.status==='pending').length;

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>

      <div className="flex items-center justify-between mb-24">
        <div>
          <h2 className="font-jakarta font-extrabold" style={{fontSize:22}}>📅 My Calendar</h2>
          <p className="text-sm text-muted mt-4">View and manage your booking schedule.</p>
        </div>
        {pendingCount>0&&(
          <div style={{background:'#FEF9C3',border:'1px solid #FDE68A',borderRadius:10,padding:'8px 16px',fontSize:13,color:'#92400E',fontWeight:600}}>
            ⏳ {pendingCount} pending request{pendingCount!==1?'s':''} to review
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-16 mb-20" style={{flexWrap:'wrap'}}>
        {[
          ['#22C55E','Available'],
          ['#EF4444','Confirmed/Occupied'],
          ['#F59E0B','🟠 Pending (awaiting confirmation)'],
        ].map(([c,l])=>(
          <div key={l} className="flex items-center gap-8">
            <div style={{width:16,height:16,borderRadius:4,background:c}}/>
            <span style={{fontSize:13,color:tokens.muted}}>{l}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{padding:24}}>
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-20">
          <button className="btn btn-ghost btn-sm" onClick={()=>{
            if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}
            else setCalMonth(m=>m-1);
          }}>← Prev</button>
          <div className="font-jakarta font-extrabold" style={{fontSize:18}}>{MONTHS[calMonth]} {calYear}</div>
          <button className="btn btn-ghost btn-sm" onClick={()=>{
            if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}
            else setCalMonth(m=>m+1);
          }}>Next →</button>
        </div>

        {/* Day headers */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8,marginBottom:8}}>
          {DAYS_SHORT.map(d=>(
            <div key={d} style={{textAlign:'center',fontSize:12,fontWeight:700,color:tokens.muted,padding:'6px 0'}}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? <div style={{textAlign:'center',padding:'40px 0'}}><Spinner dark size={28}/></div> : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8}}>
            {Array.from({length:firstDayOfMonth}).map((_,i)=>(
              <div key={`e-${i}`}/>
            ))}
            {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
              const dateStr  = toDateStr(calYear,calMonth,day);
              const isPast   = dateStr < todayStr;
              const status   = getDateStatus(dateStr);
              const daySlots = slots.filter(s=>s.slot_date===dateStr);
              const isToday  = dateStr===todayStr;

              // Full box colors: green=available, orange=pending, red=confirmed, gray=past
              let bg, border, color, textColor;
              if (isPast && daySlots.length===0) {
                bg='#F3F4F6'; border='#E5E7EB'; color='#9CA3AF'; textColor='#9CA3AF';
              } else if (status==='confirmed') {
                bg='#EF4444'; border='#DC2626'; color='#fff'; textColor='#fff';
              } else if (status==='pending') {
                bg='#F97316'; border='#EA580C'; color='#fff'; textColor='#fff';
              } else {
                bg='#22C55E'; border='#16A34A'; color='#fff'; textColor='#fff';
              }

              return (
                <button key={day} type="button"
                  onClick={()=>handleDayClick(dateStr)}
                  style={{
                    padding:'10px 4px',
                    borderRadius:10,
                    border:`2px solid ${isToday?tokens.primary:border}`,
                    background:isToday?tokens.primary:bg,
                    cursor:'pointer',
                    transition:'all 0.15s',
                    minHeight:60,
                    display:'flex',
                    flexDirection:'column',
                    alignItems:'center',
                    justifyContent:'center',
                    gap:4,
                    boxShadow:isToday?`0 0 0 3px ${tokens.primary}40`:'none',
                  }}>
                  <span style={{fontWeight:700,fontSize:15,color:isToday?'#fff':textColor}}>{day}</span>
                  {daySlots.length>0&&(
                    <span style={{fontSize:10,fontWeight:700,color:isToday?'rgba(255,255,255,0.8)':textColor,opacity:0.9}}>
                      {daySlots.length} booking{daySlots.length!==1?'s':''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Day detail modal */}
      <Modal
        open={!!dayModal}
        onClose={()=>setDayModal(null)}
        title={`📅 ${selDate ? new Date(selDate+'T00:00:00').toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : ''}`}
        footer={<button className="btn btn-ghost" onClick={()=>setDayModal(null)}>Close</button>}
      >
        {dayModal&&(
          <div>
            {dayModal.length===0 ? (
              <div style={{textAlign:'center',padding:'20px 0',color:tokens.muted}}>No bookings for this day.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {dayModal.map(slot=>(
                  <div key={slot.id} style={{border:`2px solid ${slot.status==='confirmed'?'#6EE7B7':slot.status==='pending'?'#FDE68A':'#E5E7EB'}`,borderRadius:12,padding:16,background:slot.status==='confirmed'?'#F0FDF4':slot.status==='pending'?'#FFFBEB':'#FAFAFA'}}>
                    {/* Status badge */}
                    <div className="flex items-center justify-between mb-12">
                      <span style={{fontSize:12,fontWeight:800,padding:'3px 12px',borderRadius:20,background:slot.status==='confirmed'?'#D1FAE5':slot.status==='pending'?'#FEF9C3':'#F3F4F6',color:slot.status==='confirmed'?'#065F46':slot.status==='pending'?'#92400E':'#6B7280'}}>
                        {slot.status==='confirmed'?'✅ Confirmed':slot.status==='pending'?'⏳ Pending':'—'}
                      </span>
                      <span style={{fontSize:13,fontWeight:600,color:tokens.mid}}>{fmtTime(slot.slot_time)}</span>
                    </div>

                    {/* Booking details */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                      {[
                        ['Parent',   slot.booking?.parent?.full_name||'—'],
                        ['Student',  slot.booking?.student?.name||'—'],
                        ['Grade',    `Grade ${slot.booking?.student?.grade_level||'—'}`],
                        ['Subject',  slot.booking?.subject||'—'],
                        ['Mode',     slot.booking?.session_mode||'—'],
                        ['Total',    `₱${Number(slot.booking?.total_amount||0).toLocaleString()}`],
                      ].map(([k,v])=>(
                        <div key={k} style={{background:'rgba(0,0,0,0.04)',borderRadius:8,padding:10}}>
                          <div style={{fontSize:10,color:tokens.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3}}>{k}</div>
                          <div style={{fontSize:13,fontWeight:600,textTransform:'capitalize'}}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Actions for pending */}
                    {slot.status==='pending'&&(
                      <div className="flex gap-8">
                        <button className="btn btn-danger btn-sm" onClick={()=>handleReject(slot)} disabled={saving}>
                          ✗ Reject
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={()=>handleAccept(slot)} disabled={saving}>
                          {saving?'...':'✓ Accept Booking'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}