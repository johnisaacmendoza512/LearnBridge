import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Icon from '../../components/ui/Icon';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { useTutors } from '../../hooks/useTutors';
import { useStudents } from '../../hooks/useStudents';
import { useBookings } from '../../hooks/useBookings';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import tokens from '../../lib/tokens';

const ACCENT_COLORS = [tokens.primary, tokens.accent, tokens.muted];
const HOURS = Array.from({length:15},(_,i)=>i+6); // 6am to 8pm

function fmtHour(h) {
  if (h === 12) return '12:00 PM';
  return h < 12 ? `${h}:00 AM` : `${h-12}:00 PM`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month+1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function toDateStr(year, month, day) {
  return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg = type==='error'?'#FEE2E2':'#D1FAE5', color=type==='error'?'#DC2626':'#065F46';
  return (
    <div style={{position:'fixed',top:24,right:24,zIndex:99999,background:bg,borderRadius:12,padding:'14px 20px',fontSize:14,color,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,.12)',display:'flex',alignItems:'center',gap:10,maxWidth:380}}>
      <span>{type==='error'?'❌':'✅'}</span><span style={{flex:1}}>{msg}</span>
      <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color,fontSize:16,padding:0}}>✕</button>
    </div>
  );
}

// Reviews sub-component
function TutorReviews({ tutorId }) {
  const [reviews, setReviews] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!tutorId) return;
    supabase.from('tutor_ratings')
      .select('*, parent:parent_id(full_name)')
      .eq('tutor_id', tutorId)
      .order('created_at', {ascending:false})
      .then(({data}) => { setReviews(data||[]); setLoading(false); });
  }, [tutorId]);

  if (loading) return <div style={{fontSize:13,color:tokens.muted}}>Loading reviews...</div>;
  if (reviews.length===0) return (
    <div style={{background:'#F9FAFB',borderRadius:10,padding:16,textAlign:'center',color:tokens.muted,fontSize:13}}>
      No reviews yet. Be the first to book this tutor!
    </div>
  );
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {reviews.map(r=>(
        <div key={r.id} style={{background:'#FAFAFA',borderRadius:10,padding:14,border:`1px solid ${tokens.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:13}}>{r.parent?.full_name||'Parent'}</span>
            <span style={{color:'#F59E0B',fontSize:14}}>{'★'.repeat(r.star_rating||5)}{'☆'.repeat(5-(r.star_rating||5))}</span>
          </div>
          {r.comment&&<p style={{fontSize:13,color:tokens.mid,lineHeight:1.6,margin:0}}>{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}

export default function FindTutorsPage() {
  const { user } = useAuth();
  const { tutors, loading } = useTutors(); // fetches nbi_clearance_url, prc_license_url etc from tutors table
  const { students } = useStudents();
  const { createBooking, bookings } = useBookings();

  const [subject,  setSubject]  = useState('');
  const [budget,   setBudget]   = useState('');
  const [gender,   setGender]   = useState('');
  const [toast,    setToast]    = useState(null);
  const [viewTutor, setViewTutor] = useState(null); // tutor profile modal

  // Get tutor IDs that parent already has active bookings with
  const activeTutorIds = new Set(
    bookings
      .filter(b => ['pending','confirmed','pending_parent_confirm'].includes(b.status))
      .map(b => b.tutor_id)
  );

  // Booking modal steps: 'details' | 'calendar' | 'confirm'
  const [booking,  setBooking]  = useState(null); // tutor object
  const [step,     setStep]     = useState('details');
  const [form,     setForm]     = useState({student_id:'',payment_method:'cash',session_mode:'face-to-face'});
  const [saving,   setSaving]   = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  // Calendar state
  const today = new Date();
  const [calYear,      setCalYear]      = useState(today.getFullYear());
  const [calMonth,     setCalMonth]     = useState(today.getMonth());
  const [slots,        setSlots]        = useState([]); // occupied/pending slots for this tutor
  const [selectedSlots,setSelectedSlots]= useState([]); // [{date,time}] max 8
  const [pickingDate,  setPickingDate]  = useState(null); // date string being assigned a time
  const REQUIRED_SESSIONS = 8;

  const showToast = (msg,type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const fetchSlots = useCallback(async (tutorId) => {
    const { data } = await supabase
      .from('booking_slots')
      .select('slot_date,slot_time,status')
      .eq('tutor_id', tutorId);
    setSlots(data||[]);
  },[]);

  useEffect(()=>{
    if (booking && step==='calendar') fetchSlots(booking.id);
  },[booking,step,fetchSlots]);

  const getDateStatus = (dateStr) => {
    const daySlots = slots.filter(s=>s.slot_date===dateStr);
    if (daySlots.some(s=>s.status==='confirmed')) return 'occupied';
    if (daySlots.some(s=>s.status==='pending'))   return 'pending';
    return 'available';
  };

  const isTimeOccupied = (dateStr, hour) => {
    const timeStr = `${String(hour).padStart(2,'0')}:00:00`;
    return slots.some(s=>s.slot_date===dateStr&&s.slot_time===timeStr);
  };

  const handleOpenCalendar = () => {
    if (!form.student_id) { showToast('Please select a child first.','error'); return; }
    setStep('calendar');
    setSelectedSlots([]);
    setPickingDate(null);
  };

  const handleSelectDate = (dateStr, status) => {
    if (status !== 'available') return;
    // If already selected, remove it
    if (selectedSlots.find(s=>s.date===dateStr)) {
      setSelectedSlots(prev=>prev.filter(s=>s.date!==dateStr));
      if (pickingDate===dateStr) setPickingDate(null);
      return;
    }
    // If already 8 selected, don't add more
    if (selectedSlots.length >= REQUIRED_SESSIONS) {
      showToast(`You can only select ${REQUIRED_SESSIONS} dates.`,'error'); return;
    }
    // Open time picker for this date
    setPickingDate(dateStr);
  };

  const handleSelectTime = (dateStr, hour) => {
    const timeStr = `${String(hour).padStart(2,'0')}:00:00`;
    setSelectedSlots(prev => {
      const existing = prev.find(s=>s.date===dateStr);
      if (existing) return prev.map(s=>s.date===dateStr?{...s,time:hour,timeStr}:s);
      return [...prev,{date:dateStr,time:hour,timeStr}];
    });
    setPickingDate(null);
  };

  const handleConfirmSchedule = () => {
    if (selectedSlots.length < REQUIRED_SESSIONS) {
      showToast(`Please select all ${REQUIRED_SESSIONS} session dates.`,'error'); return;
    }
    if (selectedSlots.some(s=>s.time===undefined)) {
      showToast('Please select a time for all dates.','error'); return;
    }
    setStep('confirm');
  };

  const handleBook = async () => {
    if (!booking||!form.student_id||selectedSlots.length<REQUIRED_SESSIONS) return;
    setSaving(true);
    try {
      // Use first slot as primary scheduled_date for the booking record
      const firstSlot = selectedSlots[0];
      // Build timeStr from hour for each slot
      const firstTimeStr = firstSlot.timeStr;

      const data = await createBooking({
        tutor_id:       booking.id,
        student_id:     form.student_id,
        subject:        subject||(booking.specialization||[])[0]||'',
        session_mode:   form.session_mode,
        payment_method: form.payment_method,
        total_amount:   (booking.approved_rate||booking.rate_per_session||0)*8,
        scheduled_date: firstSlot.date,
        scheduled_time: firstTimeStr,
        schedule_status:'pending',
      });

      // Insert all 8 slots into booking_slots (shows on tutor calendar)
      if (data?.id) {
        const slotsToInsert = selectedSlots.map(s=>({
          tutor_id:   booking.id,
          booking_id: data.id,
          slot_date:  s.date,
          slot_time:  s.timeStr,
          status:     'pending',
        }));
        const { error: slotError } = await supabase.from('booking_slots').insert(slotsToInsert);
        if (slotError) console.error('Slot insert error:', slotError.message);

        // Insert booking_schedules (shows in parent view schedule)
        const scheduleRows = selectedSlots.map((s,i)=>({
          booking_id:   data.id,
          session_num:  i+1,
          session_date: s.date,
          session_time: s.timeStr,
          status:       'upcoming',
        }));
        const { error: schedErr } = await supabase.from('booking_schedules').insert(scheduleRows);
        if (schedErr) console.error('Schedule insert error:', schedErr.message);
      }

      setBooking(null);
      setStep('details');
      setForm({student_id:'',payment_method:'cash',session_mode:'face-to-face'});
      setSelectedSlots([]);
      setPickingDate(null);
      showToast('Booking submitted with 8 sessions! Waiting for tutor confirmation.');
    } catch(e) {
      showToast(e.message,'error');
    } finally { setSaving(false); }
  };

  const filtered = tutors.filter(t => {
    if (subject && !(t.specialization||[]).includes(subject)) return false;
    const rate = t.approved_rate||t.rate_per_session||0;
    if (budget && rate > parseInt(budget)) return false;
    if (gender && t.profile?.gender !== gender) return false;
    return true;
  });

  // Build calendar grid
  const daysInMonth   = getDaysInMonth(calYear, calMonth);
  const firstDayOfMonth = getFirstDayOfMonth(calYear, calMonth);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  if (loading) return <Spinner dark size={32}/>;

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>

      {/* Filters */}
      <div className="card p-20 mb-20">
        <div className="flex items-center gap-8 mb-16">
          <Icon name="filter" size={15} color={tokens.primary}/>
          <h3 className="font-jakarta font-bold" style={{fontSize:15}}>Filter Tutors</h3>
        </div>
        <div className="grid-3">
          <FormGroup label="Subject">
            <select className="select" value={subject} onChange={e=>setSubject(e.target.value)}>
              <option value="">All Subjects</option>
              <option value="english">English</option>
              <option value="mathematics">Mathematics</option>
            </select>
          </FormGroup>
          <FormGroup label="Max Budget (₱/session)">
            <input className="input" type="number" placeholder="e.g. 400" value={budget} onChange={e=>setBudget(e.target.value)}/>
          </FormGroup>
          <FormGroup label="Gender Preference">
            <select className="select" value={gender} onChange={e=>setGender(e.target.value)}>
              <option value="">No Preference</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </FormGroup>
        </div>
      </div>

      <div className="flex items-center justify-between mb-16">
        <h3 className="font-jakarta font-bold">{filtered.length} Tutor{filtered.length!==1?'s':''} Found</h3>
        {filtered.length>0&&<Badge variant="success"><Icon name="check" size={10} color="#065F46"/> Verified & approved tutors only</Badge>}
      </div>

      {filtered.length===0 ? (
        <div className="card"><EmptyState icon="🔍" title="No tutors match your filters" description="Try widening your budget or removing filters."/></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {filtered.map((t,i)=>(
            <div key={t.id} className="card p-24">
              <div className="flex items-start gap-16">
                <div style={{width:52,height:52,borderRadius:14,background:ACCENT_COLORS[i%3],display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
                  {t.profile?.avatar_url
                    ? <img src={t.profile.avatar_url} alt={t.profile?.full_name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <span style={{color:'#fff',fontWeight:800,fontSize:20}}>{(t.profile?.full_name||'T').charAt(0)}</span>}
                </div>
                <div style={{flex:1}}>
                  <div className="font-jakarta font-bold" style={{fontSize:16}}>{t.profile?.full_name||'Tutor'}</div>
                  <div className="text-sm text-muted mb-8">{(t.specialization||[]).join(' · ')||'General'}</div>
                  <div className="flex gap-8 mb-12" style={{flexWrap:'wrap'}}>
                    <Badge variant="success">✓ Verified</Badge>
                    <Badge variant="info">₱{t.approved_rate||t.rate_per_session||0}/session</Badge>
                    {t.profile?.gender&&<Badge variant="gray">{t.profile.gender}</Badge>}
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={()=>setViewTutor(t)}>
                      <Icon name="eye" size={13}/> View Profile
                    </button>
                    {activeTutorIds.has(t.id) ? (
                      <button className="btn btn-sm" disabled style={{background:'#FEF9C3',color:'#92400E',border:'1px solid #FDE68A',cursor:'not-allowed',fontWeight:700}}>
                        ⏳ Ongoing Session
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={()=>{setBooking(t);setStep('details');}} disabled={students.length===0}>
                        <Icon name="calendar" size={13}/> Book Now
                      </button>
                    )}
                  </div>
                  {students.length===0&&!activeTutorIds.has(t.id)&&<p className="text-xs text-muted mt-8">Add a child profile first to book.</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Booking Modal ── */}
      <Modal
        open={!!booking}
        onClose={()=>{setBooking(null);setStep('details');}}
        title={
          step==='details'  ? `Book ${booking?.profile?.full_name||'Tutor'}` :
          step==='calendar' ? `📅 Select 8 Session Dates (${selectedSlots.length}/${REQUIRED_SESSIONS})` :
          '✅ Confirm Booking'
        }
        footer={
          step==='details' ? (
            <>
              <button className="btn btn-ghost" onClick={()=>setBooking(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleOpenCalendar} disabled={!form.student_id}>
                📅 Select Schedule →
              </button>
            </>
          ) : step==='calendar' ? (
            <>
              <button className="btn btn-ghost" onClick={()=>setStep('details')}>← Back</button>
              <button className="btn btn-primary" onClick={handleConfirmSchedule}
                disabled={selectedSlots.length<REQUIRED_SESSIONS||selectedSlots.some(s=>s.time===undefined)}>
                Confirm {selectedSlots.length}/{REQUIRED_SESSIONS} Sessions →
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={()=>setStep('calendar')}>← Back</button>
              <button className="btn btn-primary" onClick={handleBook} disabled={saving}>
                {saving?'Booking...':'✓ Confirm Booking'}
              </button>
            </>
          )
        }
      >
        {booking && (
          <div>
            {/* STEP 1: Details */}
            {step==='details' && (
              <div>
                <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:13,color:'#1D4ED8'}}>
                  ℹ️ Select your child, payment method, and session mode. Then choose your preferred schedule.
                </div>
                <FormGroup label="Which child is this for?">
                  <select className="select" value={form.student_id} onChange={e=>set('student_id',e.target.value)}>
                    <option value="">Select a child</option>
                    {students.map(s=><option key={s.id} value={s.id}>{s.name} (Grade {s.grade_level})</option>)}
                  </select>
                </FormGroup>
                <FormGroup label="Payment Method">
                  <select className="select" value={form.payment_method} onChange={e=>set('payment_method',e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </FormGroup>
                <FormGroup label="Session Mode">
                  <select className="select" value={form.session_mode} onChange={e=>set('session_mode',e.target.value)}>
                    <option value="face-to-face">Face-to-Face</option>
                    <option value="online">Online</option>
                  </select>
                </FormGroup>
              </div>
            )}

            {/* STEP 2: Calendar — select 8 dates each with its own time */}
            {step==='calendar' && (
              <div>
                {/* Progress counter */}
                <div style={{background:selectedSlots.length===REQUIRED_SESSIONS?'#D1FAE5':'#EFF6FF',border:`1px solid ${selectedSlots.length===REQUIRED_SESSIONS?'#6EE7B7':'#BFDBFE'}`,borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:13,fontWeight:600,color:selectedSlots.length===REQUIRED_SESSIONS?'#065F46':'#1D4ED8'}}>
                    {selectedSlots.length===REQUIRED_SESSIONS ? '✅ All 8 sessions selected!' : `📅 Select ${REQUIRED_SESSIONS} session dates`}
                  </span>
                  <span style={{fontSize:20,fontWeight:900,color:selectedSlots.length===REQUIRED_SESSIONS?'#065F46':'#1D4ED8'}}>
                    {selectedSlots.length}/{REQUIRED_SESSIONS}
                  </span>
                </div>

                {/* Legend */}
                <div className="flex gap-10 mb-12" style={{flexWrap:'wrap'}}>
                  {[['#22C55E','Available'],['#EF4444','Occupied'],['#F59E0B','Pending'],['#6366F1','Selected']].map(([c,l])=>(
                    <div key={l} className="flex items-center gap-6">
                      <div style={{width:12,height:12,borderRadius:3,background:c}}/>
                      <span style={{fontSize:11,color:tokens.muted}}>{l}</span>
                    </div>
                  ))}
                </div>

                {/* Month navigation */}
                <div className="flex items-center justify-between mb-12">
                  <button className="btn btn-ghost btn-sm" onClick={()=>{
                    if (calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}
                    else setCalMonth(m=>m-1);
                  }}>←</button>
                  <div className="font-jakarta font-bold" style={{fontSize:15}}>{MONTHS[calMonth]} {calYear}</div>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{
                    if (calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}
                    else setCalMonth(m=>m+1);
                  }}>→</button>
                </div>

                {/* Day headers */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:4}}>
                  {DAYS_SHORT.map(d=>(
                    <div key={d} style={{textAlign:'center',fontSize:11,fontWeight:700,color:tokens.muted,padding:'4px 0'}}>{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:16}}>
                  {Array.from({length:firstDayOfMonth}).map((_,i)=>(
                    <div key={`empty-${i}`}/>
                  ))}
                  {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
                    const dateStr   = toDateStr(calYear,calMonth,day);
                    const isPast    = dateStr < todayStr;
                    const status    = getDateStatus(dateStr);
                    const selSlot   = selectedSlots.find(s=>s.date===dateStr);
                    const isSelected= !!selSlot;
                    const slotNum   = isSelected ? selectedSlots.indexOf(selSlot)+1 : null;
                    const isPickingThis = pickingDate===dateStr;

                    let bg='#F0FDF4', border='#22C55E', cursor='pointer', color='#15803D';
                    if (isPast)               { bg='#F9FAFB'; border=tokens.border; cursor='default'; color=tokens.muted; }
                    else if (isSelected)      { bg='#EEF2FF'; border='#6366F1'; color='#4F46E5'; }
                    else if (isPickingThis)   { bg='#FDF4FF'; border='#A855F7'; color='#7C3AED'; }
                    else if (status==='occupied'){ bg='#FEF2F2'; border='#EF4444'; cursor='default'; color='#DC2626'; }
                    else if (status==='pending') { bg='#FFFBEB'; border='#F59E0B'; cursor='default'; color='#D97706'; }

                    return (
                      <button key={day} type="button"
                        disabled={isPast||(status!=='available'&&!isSelected)}
                        onClick={()=>handleSelectDate(dateStr,status)}
                        style={{padding:'6px 2px',borderRadius:8,border:`2px solid ${border}`,background:bg,cursor,color,fontWeight:isSelected?800:600,fontSize:12,transition:'all 0.15s',textAlign:'center',minHeight:44,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
                        <span>{day}</span>
                        {isSelected&&slotNum&&<span style={{fontSize:9,fontWeight:800,background:'#6366F1',color:'#fff',borderRadius:4,padding:'1px 4px'}}>#{slotNum}</span>}
                        {isSelected&&selSlot?.time!==undefined&&<span style={{fontSize:9,color:'#6366F1'}}>{fmtHour(selSlot.time).replace(':00','')}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Time picker for selected date */}
                {pickingDate && (
                  <div style={{background:'#FDF4FF',border:'1px solid #E9D5FF',borderRadius:12,padding:14,marginBottom:12}}>
                    <div className="font-jakarta font-bold mb-10" style={{fontSize:13,color:'#7C3AED'}}>
                      🕐 Select time for {new Date(pickingDate+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric'})}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                      {HOURS.map(h=>{
                        const occupied = isTimeOccupied(pickingDate,h);
                        return (
                          <button key={h} type="button" disabled={occupied}
                            onClick={()=>handleSelectTime(pickingDate,h)}
                            style={{padding:'7px',borderRadius:8,border:`1.5px solid ${occupied?'#EF4444':tokens.border}`,background:occupied?'#FEF2F2':'#fff',color:occupied?'#DC2626':tokens.mid,fontSize:11,fontWeight:400,cursor:occupied?'default':'pointer',transition:'all 0.15s'}}>
                            {fmtHour(h)}
                          </button>
                        );
                      })}
                    </div>
                    <button className="btn btn-ghost btn-sm mt-10" onClick={()=>setPickingDate(null)}>Cancel</button>
                  </div>
                )}

                {/* Selected sessions list */}
                {selectedSlots.length>0&&(
                  <div style={{background:'#F9FAFB',borderRadius:10,padding:12}}>
                    <div className="font-semibold mb-8" style={{fontSize:13}}>Selected Sessions:</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {selectedSlots.map((s,i)=>(
                        <div key={s.date} style={{display:'flex',alignItems:'center',gap:10,fontSize:12}}>
                          <span style={{width:20,height:20,borderRadius:'50%',background:'#6366F1',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,flexShrink:0}}>
                            {i+1}
                          </span>
                          <span style={{flex:1,fontWeight:500}}>
                            {new Date(s.date+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric'})}
                            {s.time!==undefined ? ` · ${fmtHour(s.time)}` : <span style={{color:'#F59E0B'}}> · tap date to set time</span>}
                          </span>
                          <button onClick={()=>setSelectedSlots(prev=>prev.filter((_,pi)=>pi!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',fontSize:14,padding:'0 4px'}}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Confirm */}
            {step==='confirm' && (
              <div>
                <div style={{background:'#D1FAE5',border:'1px solid #6EE7B7',borderRadius:12,padding:16,marginBottom:20}}>
                  <div className="font-jakarta font-bold mb-10" style={{fontSize:16,color:'#065F46',textAlign:'center'}}>✅ 8 Sessions Selected!</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {selectedSlots.map((s,i)=>(
                      <div key={s.date} style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'#065F46'}}>
                        <span style={{width:22,height:22,borderRadius:'50%',background:'#065F46',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</span>
                        <span style={{fontWeight:600}}>{new Date(s.date+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'long',day:'numeric'})}</span>
                        <span style={{marginLeft:'auto',fontWeight:600}}>{fmtHour(s.time)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[
                    ['Tutor',    booking?.profile?.full_name||'—'],
                    ['Child',    students.find(s=>s.id===form.student_id)?.name||'—'],
                    ['Subject',  subject||(booking?.specialization||[])[0]||'—'],
                    ['Mode',     form.session_mode],
                    ['Payment',  form.payment_method.replace('_',' ')],
                    ['Total',    `₱${((booking?.approved_rate||booking?.rate_per_session||0)*8).toLocaleString()}`],
                  ].map(([k,v])=>(
                    <div key={k} style={{background:'#F9FAFB',borderRadius:8,padding:12}}>
                      <div className="text-xs text-muted uppercase font-bold mb-4" style={{letterSpacing:'0.5px'}}>{k}</div>
                      <div className="font-semibold" style={{fontSize:13,textTransform:'capitalize'}}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{background:'#FEF9C3',border:'1px solid #FDE68A',borderRadius:10,padding:'12px 16px',marginTop:16,fontSize:13,color:'#92400E'}}>
                  ⏳ Your selected date will show as <strong>Pending (yellow)</strong> on the tutor's calendar until they confirm.
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      {/* ── View Tutor Profile Modal ── */}
      <Modal open={!!viewTutor} onClose={()=>setViewTutor(null)} title="Tutor Profile"
        footer={<>
          <button className="btn btn-ghost" onClick={()=>setViewTutor(null)}>Close</button>
          <button className="btn btn-primary" onClick={()=>{setBooking(viewTutor);setStep('details');setViewTutor(null);}} disabled={students.length===0}>
            📅 Book Now
          </button>
        </>}>
        {viewTutor && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Header */}
            <div style={{display:'flex',alignItems:'center',gap:16,padding:'20px',background:tokens.primaryLight,borderRadius:14}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:tokens.primary,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
                {viewTutor.profile?.avatar_url
                  ? <img src={viewTutor.profile.avatar_url} alt={viewTutor.profile?.full_name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <span style={{color:'#fff',fontWeight:800,fontSize:26}}>{(viewTutor.profile?.full_name||'T').charAt(0)}</span>}
              </div>
              <div style={{flex:1}}>
                <div className="font-jakarta font-extrabold" style={{fontSize:20}}>{viewTutor.profile?.full_name||'Tutor'}</div>
                <div style={{fontSize:13,color:tokens.mid,marginTop:2}}>{(viewTutor.specialization||[]).map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' & ')}</div>
                <div className="flex gap-8 mt-8">
                  <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#D1FAE5',color:'#065F46'}}>✓ Verified & Approved</span>
                  <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:tokens.primaryLight,color:tokens.primary}}>₱{viewTutor.approved_rate||viewTutor.rate_per_session||0}/session</span>
                </div>
              </div>
            </div>

            {/* About */}
            {viewTutor.profile?.bio && (
              <div>
                <div className="text-xs text-muted uppercase font-bold mb-8" style={{letterSpacing:'0.5px'}}>About</div>
                <p style={{fontSize:13,color:tokens.mid,lineHeight:1.7,background:'#F9FAFB',borderRadius:10,padding:14}}>{viewTutor.profile.bio}</p>
              </div>
            )}

            {/* Key details grid */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[
                ['👨‍🎓 Licensed Teacher', 'PRC Licensed'],
                ['⏱ Experience', `${viewTutor.years_experience||0} year${viewTutor.years_experience!==1?'s':''}`],
                ['📍 Location', viewTutor.profile?.location||'—'],
                ['👤 Gender', viewTutor.profile?.gender||'—'],
                ['✅ Status', 'Verified & Approved'],
                ['📚 Subjects', (viewTutor.specialization||[]).map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(', ')||'—'],
              ].map(([k,v])=>(
                <div key={k} style={{background:'#F9FAFB',borderRadius:10,padding:12}}>
                  <div style={{fontSize:12,color:tokens.muted,marginBottom:4}}>{k}</div>
                  <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                </div>
              ))}
            </div>

            {/* AI Certification Scores */}
            {viewTutor.certification_scores && Object.keys(viewTutor.certification_scores).length>0 && (
              <div>
                <div className="text-xs text-muted uppercase font-bold mb-10" style={{letterSpacing:'0.5px'}}>AI Certification Scores</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {Object.entries(viewTutor.certification_scores).map(([topic,score])=>(
                    <div key={topic} style={{display:'flex',alignItems:'center',gap:12}}>
                      <span style={{fontSize:13,fontWeight:600,textTransform:'capitalize',width:100}}>{topic}</span>
                      <div style={{flex:1,height:8,background:'#E5E7EB',borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:'100%',borderRadius:4,width:`${score}%`,background:score>=90?tokens.success:score>=70?tokens.primary:'#F59E0B',transition:'width 0.5s'}}/>
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:score>=90?tokens.success:score>=70?tokens.primary:'#F59E0B',width:40,textAlign:'right'}}>{score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Credentials */}
            <div>
              <div className="text-xs text-muted uppercase font-bold mb-10" style={{letterSpacing:'0.5px'}}>Credentials</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {[
                  ['🪪','NBI Clearance',    !!viewTutor.nbi_clearance_url],
                  ['📄','PRC License',       !!viewTutor.prc_license_url],
                  ['🏥','Medical Certificate',!!viewTutor.medical_cert_url],
                  ['📋','Application Form',  !!viewTutor.application_form_url],
                ].map(([icon,label,verified])=>(
                  <div key={label} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:verified?'#F0FDF4':'#FEF2F2',border:`1px solid ${verified?'#6EE7B7':'#FECACA'}`}}>
                    <span style={{fontSize:18}}>{icon}</span>
                    <span style={{fontSize:13,fontWeight:600,flex:1}}>{label}</span>
                    <span style={{fontSize:12,fontWeight:700,color:verified?'#065F46':'#DC2626'}}>
                      {verified?'✓ Verified':'✗ Missing'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Parent Reviews */}
            <div>
              <div className="text-xs text-muted uppercase font-bold mb-10" style={{letterSpacing:'0.5px'}}>Parent Reviews</div>
              <TutorReviews tutorId={viewTutor.id} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}