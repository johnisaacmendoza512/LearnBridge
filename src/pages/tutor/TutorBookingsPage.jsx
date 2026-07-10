import { useState } from 'react';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import { useBookings } from '../../hooks/useBookings';
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

export default function TutorBookingsPage() {
  const { bookings, loading, updateBookingStatus, markComplete, saveSchedule } = useBookings();

  const [toast,       setToast]       = useState(null);
  const [selected,       setSelected]       = useState(null);
  const [modalTab,       setModalTab]       = useState('booking'); // 'booking' | 'tutee'
  const [studentProfile, setStudentProfile] = useState(null);
  const [schedForm,   setSchedForm]   = useState({ day1:'', time1:'', day2:'', time2:'' });
  const [showSched,   setShowSched]   = useState(false);
  const [savingSched, setSavingSched] = useState(false);
  const [saving,      setSaving]      = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openBooking = async (b) => {
    setSelected(b);
    setShowSched(false);
    setModalTab('booking');
    setStudentProfile(null);
    setSchedForm({
      day1:  b.proposed_day_1  || b.confirmed_day_1  || '',
      time1: b.proposed_time_1 || b.confirmed_time_1 || '',
      day2:  b.proposed_day_2  || b.confirmed_day_2  || '',
      time2: b.proposed_time_2 || b.confirmed_time_2 || '',
    });
    // Fetch full student profile including pre-assessment
    if (b.student_id) {
      const { supabase } = await import('../../lib/supabase');
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('id', b.student_id)
        .single();
      setStudentProfile(data || null);
    }
  };

  const handleAccept = async () => {
    setSaving(true);
    try {
      await updateBookingStatus(selected.id, 'confirmed');
      setSelected(null);
      showToast('Booking accepted! The parent will now set the schedule.');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await updateBookingStatus(selected.id, 'rejected');
      setSelected(null);
      showToast('Booking rejected.');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSchedule = async () => {
    if (!schedForm.day1 || !schedForm.time1) {
      showToast('Please select Day 1 and a start time.', 'error');
      return;
    }
    setSavingSched(true);
    try {
      await saveSchedule(selected.id, {
        confirmed_day_1:  schedForm.day1,
        confirmed_time_1: schedForm.time1,
        confirmed_day_2:  schedForm.day2  || null,
        confirmed_time_2: schedForm.time2 || null,
        schedule_status:  'confirmed',
      });
      setSelected(null);
      setShowSched(false);
      showToast('Schedule confirmed! Parent has been notified.');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSavingSched(false);
    }
  };

  const handleMarkComplete = async () => {
    setSaving(true);
    try {
      await markComplete(selected.id);
      setSelected(null);
      showToast('Marked as complete. Waiting for parent confirmation.');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner dark size={32} />;

  const pending   = bookings.filter(b => b.status === 'pending');
  const active    = bookings.filter(b => ['confirmed','pending_parent_confirm'].includes(b.status));
  const archived  = bookings.filter(b => ['completed','rejected','cancelled'].includes(b.status));

  const Section = ({ title, items }) => {
    if (!items.length) return null;
    return (
      <div className="mb-24">
        <h3 className="font-jakarta font-bold mb-12" style={{ fontSize:15 }}>{title} ({items.length})</h3>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Child</th><th>Parent</th><th>Subject</th>
                <th>Schedule</th><th>Mode</th><th>Total</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(b => {
                const hasSched    = b.schedule_status === 'confirmed' && b.confirmed_day_1;
                const hasProposed = b.schedule_status === 'proposed'  && b.proposed_day_1;
                return (
                  <tr key={b.id}>
                    <td className="font-semibold" style={{ fontSize:13 }}>{b.student?.name || '—'}</td>
                    <td style={{ fontSize:13 }}>{b.parent?.full_name || '—'}</td>
                    <td style={{ fontSize:13, textTransform:'capitalize' }}>{b.subject || '—'}</td>
                    <td style={{ fontSize:12 }}>
                      {hasSched ? (
                        <div>
                          <div style={{ color:'#065F46', fontWeight:600 }}>✓ {b.confirmed_day_1} {fmtTime(b.confirmed_time_1)}</div>
                          {b.confirmed_day_2 && <div style={{ color:'#065F46', fontWeight:600 }}>✓ {b.confirmed_day_2} {fmtTime(b.confirmed_time_2)}</div>}
                        </div>
                      ) : hasProposed ? (
                        <div>
                          <div style={{ color:'#1D4ED8' }}>📋 {b.proposed_day_1} {fmtTime(b.proposed_time_1)}</div>
                          {b.proposed_day_2 && <div style={{ color:'#1D4ED8' }}>📋 {b.proposed_day_2} {fmtTime(b.proposed_time_2)}</div>}
                        </div>
                      ) : <span style={{ color:tokens.muted }}>Not set</span>}
                    </td>
                    <td style={{ fontSize:12, textTransform:'capitalize' }}>{b.session_mode || '—'}</td>
                    <td className="font-semibold" style={{ fontSize:13 }}>₱{Number(b.total_amount||0).toLocaleString()}</td>
                    <td>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <Badge variant={STATUS_VARIANT[b.status]||'gray'}>
                          {b.status === 'pending_parent_confirm' ? 'Awaiting Parent' : b.status}
                        </Badge>
                        {hasProposed && b.status === 'confirmed' && (
                          <span style={{ fontSize:10, color:'#1D4ED8', fontWeight:600 }}>📅 Confirm schedule</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-sm" style={{ background:tokens.primaryLight, color:tokens.primary }} onClick={() => openBooking(b)}>
                        <Icon name="eye" size={11} color={tokens.primary} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />

      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize:22 }}>Bookings</h2>
        <p className="text-sm text-muted mt-4">Manage booking requests and confirm session schedules.</p>
      </div>

      {bookings.length === 0 ? (
        <div className="card">
          <EmptyState icon="📅" title="No bookings yet" description="Parents will book you after chatting via Messages." />
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ background:'#FEF9C3', border:'1px solid #FDE68A', borderRadius:12, padding:'12px 18px', marginBottom:20, fontSize:13, color:'#92400E', display:'flex', gap:10 }}>
              <span>⏳</span>
              <span>You have <strong>{pending.length}</strong> pending booking request{pending.length !== 1 ? 's' : ''} — review and accept or reject below.</span>
            </div>
          )}
          <Section title="⏳ Pending Requests" items={pending}  />
          <Section title="✅ Active Bookings"  items={active}   />
          <Section title="📋 Past Bookings"    items={archived} />
        </>
      )}

      {/* ── Booking Detail Modal ── */}
      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setShowSched(false); }}
        title={showSched ? '📅 Confirm Schedule' : 'Booking Details'}
        footer={
          <div className="flex gap-10" style={{ width:'100%', flexWrap:'wrap' }}>
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
            {selected?.status === 'pending' && (
              <div style={{background:'#FEF9C3',border:'1px solid #FDE68A',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#92400E',flex:1}}>
                ⏳ Go to <strong>Calendar</strong> to accept or reject this booking request.
              </div>
            )}
            {selected?.status === 'confirmed' && (
              <button className="btn btn-success" onClick={handleMarkComplete} disabled={saving}>
                {saving ? '...' : '🎓 Mark Complete'}
              </button>
            )}
          </div>
        }
      >
        {selected && (
          <div>
            {/* Modal tabs */}
            <div className="flex gap-0 mb-16" style={{borderBottom:`2px solid ${tokens.border}`}}>
              {[
                {key:'booking', label:'📋 Booking Details'},
                {key:'tutee',   label:'👤 Tutee Profile'},
              ].map(t=>(
                <button key={t.key} onClick={()=>setModalTab(t.key)}
                  style={{padding:'8px 20px',border:'none',borderBottom:`3px solid ${modalTab===t.key?tokens.primary:'transparent'}`,background:'none',cursor:'pointer',fontWeight:700,fontSize:13,color:modalTab===t.key?tokens.primary:tokens.muted,marginBottom:-2,transition:'all 0.15s'}}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* TUTEE PROFILE TAB */}
            {modalTab==='tutee' && (
              <div>
                {!studentProfile ? (
                  <div style={{textAlign:'center',padding:'32px 0',color:tokens.muted}}>
                    <div style={{fontSize:40,marginBottom:12}}>👤</div>
                    <div style={{fontSize:14}}>Loading student profile...</div>
                  </div>
                ) : (
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:16,padding:'16px 20px',background:tokens.primaryLight,borderRadius:12,marginBottom:16}}>
                      <div style={{width:56,height:56,borderRadius:'50%',background:tokens.primary,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{color:'#fff',fontWeight:800,fontSize:22}}>{studentProfile.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-jakarta font-extrabold" style={{fontSize:18}}>{studentProfile.name}</div>
                        <div style={{fontSize:13,color:tokens.mid,marginTop:2}}>Grade {studentProfile.grade_level} · {selected.subject}</div>
                      </div>
                    </div>
                    {studentProfile.assessment_results ? (
                      <div style={{marginBottom:16}}>
                        <div className="text-xs text-muted uppercase font-bold mb-10" style={{letterSpacing:'0.5px'}}>Pre-Assessment Result</div>
                        <div style={{background:studentProfile.assessment_level==='intermediate'?'#DBEAFE':'#D1FAE5',border:`1.5px solid ${studentProfile.assessment_level==='intermediate'?'#2563EB':'#059669'}30`,borderRadius:12,padding:16,marginBottom:12}}>
                          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                            <span style={{fontSize:32}}>{studentProfile.assessment_level==='intermediate'?'🚀':'🌱'}</span>
                            <div>
                              <div style={{fontWeight:800,fontSize:15,color:studentProfile.assessment_level==='intermediate'?'#2563EB':'#059669'}}>
                                {studentProfile.assessment_level==='intermediate'?'Intermediate Level (Grade 4–6)':'Primary Level (Grade 1–3)'}
                              </div>
                              <div style={{fontSize:12,color:studentProfile.assessment_level==='intermediate'?'#2563EB':'#059669',opacity:0.8,marginTop:2}}>
                                Score: {studentProfile.assessment_score}% · {studentProfile.assessment_results.passed?'✅ Passed':'⚠️ Needs improvement'}
                              </div>
                            </div>
                            <div style={{marginLeft:'auto',textAlign:'center'}}>
                              <div style={{fontSize:32,fontWeight:900,color:studentProfile.assessment_level==='intermediate'?'#2563EB':'#059669'}}>{studentProfile.assessment_score}%</div>
                            </div>
                          </div>
                          <div style={{height:8,background:'rgba(0,0,0,0.1)',borderRadius:4,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:4,width:`${studentProfile.assessment_score}%`,background:studentProfile.assessment_level==='intermediate'?'#2563EB':'#059669'}}/>
                          </div>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                          <div style={{background:'#D1FAE5',borderRadius:10,padding:12,textAlign:'center'}}>
                            <div style={{fontSize:24,fontWeight:900,color:'#065F46'}}>{studentProfile.assessment_results.correct}</div>
                            <div style={{fontSize:11,color:'#065F46'}}>Correct</div>
                          </div>
                          <div style={{background:'#FEE2E2',borderRadius:10,padding:12,textAlign:'center'}}>
                            <div style={{fontSize:24,fontWeight:900,color:'#DC2626'}}>{studentProfile.assessment_results.total - studentProfile.assessment_results.correct}</div>
                            <div style={{fontSize:11,color:'#DC2626'}}>Incorrect</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{background:'#FEF9C3',border:'1px solid #FDE68A',borderRadius:12,padding:16,marginBottom:16,textAlign:'center'}}>
                        <div style={{fontSize:32,marginBottom:8}}>📋</div>
                        <div style={{fontSize:14,fontWeight:600,color:'#92400E'}}>No Pre-Assessment Yet</div>
                        <p style={{fontSize:12,color:'#92400E',opacity:0.8,marginTop:4}}>The parent hasn't completed a pre-assessment for this student yet.</p>
                      </div>
                    )}
                    {studentProfile.notes && (
                      <div style={{marginBottom:16}}>
                        <div className="text-xs text-muted uppercase font-bold mb-8" style={{letterSpacing:'0.5px'}}>Notes from Parent</div>
                        <div style={{background:'#F9FAFB',border:`1px solid ${tokens.border}`,borderRadius:10,padding:14,fontSize:13,color:tokens.mid,lineHeight:1.7,fontStyle:'italic'}}>
                          "{studentProfile.notes}"
                        </div>
                      </div>
                    )}
                    <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:14,fontSize:13,color:'#1D4ED8'}}>
                      💡 <strong>Teaching tip:</strong> {
                        studentProfile.assessment_level==='intermediate'
                          ? 'Focus on critical thinking, problem-solving and junior high school prep.'
                          : studentProfile.assessment_level==='primary'
                            ? 'Focus on building strong foundations in reading, writing and basic mathematics.'
                            : 'Ask the parent to complete the pre-assessment to better tailor your sessions.'
                      }
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BOOKING DETAILS TAB */}
            {modalTab==='booking' && (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
                  {[
                    ['Child',   selected.student?.name    || '—'],
                    ['Parent',  selected.parent?.full_name || '—'],
                    ['Subject', selected.subject           || '—'],
                    ['Mode',    selected.session_mode      || '—'],
                    ['Payment', (selected.payment_method  || '').replace('_',' ')],
                    ['Total',   `₱${Number(selected.total_amount||0).toLocaleString()}`],
                  ].map(([k,v]) => (
                    <div key={k} style={{ background:'#F9FAFB', borderRadius:8, padding:12 }}>
                      <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing:'0.5px' }}>{k}</div>
                      <div className="font-semibold" style={{ fontSize:13, textTransform:'capitalize' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {/* Schedule summary — view only, managed via Calendar */}
                {selected.scheduled_date ? (
                  <div style={{background:'#D1FAE5',border:'1px solid #6EE7B7',borderRadius:12,padding:16}}>
                    <div className="font-jakarta font-bold mb-8" style={{fontSize:14,color:'#065F46'}}>✅ Session Schedule</div>
                    <div style={{fontSize:13,fontWeight:600,color:'#065F46'}}>
                      📅 {new Date(selected.scheduled_date+'T00:00:00').toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:'#065F46',marginTop:4}}>
                      🕐 {(() => { const [h] = (selected.scheduled_time||'00:00').split(':'); const hr=parseInt(h); return `${hr>12?hr-12:hr||12}:00 ${hr>=12?'PM':'AM'}`; })()}
                    </div>
                  </div>
                ) : (
                  <div style={{background:'#F9FAFB',border:`1px dashed ${tokens.border}`,borderRadius:12,padding:20,textAlign:'center'}}>
                    <div style={{fontSize:28,marginBottom:8}}>📅</div>
                    <div className="text-sm text-muted">Schedule will appear here once the parent selects dates from the calendar.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}