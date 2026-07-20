import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminData } from '../../hooks/useAdminData';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import tokens from '../../lib/tokens';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_VARIANT = {
  pending:              'warning',
  confirmed:            'success',
  completed:            'info',
  cancelled:            'danger',
  pending_parent_confirm: 'warning',
};

export default function AdminSessionsPage() {
  const { allSessions, loading } = useAdminData();
  const [search,      setSearch]      = useState('');
  const [statusFilter,setStatusFilter]= useState('');
  const [selected,    setSelected]    = useState(null);
  const [schedules,    setSchedules]    = useState([]);
  const [loadingSched, setLoadingSched] = useState(false);
  const [modules,      setModules]      = useState([]);
  const [announcements,setAnnouncements]= useState([]);
  const [activeTab,    setActiveTab]    = useState('schedule');

  const filtered = allSessions.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (b.tutor?.full_name||'').toLowerCase().includes(q) ||
      (b.parent?.full_name||'').toLowerCase().includes(q) ||
      (b.student?.name||'').toLowerCase().includes(q) ||
      (b.subject||'').toLowerCase().includes(q);
    const matchStatus = !statusFilter || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openDetail = async (b) => {
    setSelected(b);
    setLoadingSched(true);
    setActiveTab('schedule');
    setModules([]);
    setAnnouncements([]);

    const [{ data: sched }, { data: rawMods }, { data: anns }] = await Promise.all([
      supabase.from('booking_schedules').select('*').eq('booking_id', b.id).order('session_num'),
      supabase.from('session_modules').select('*').eq('booking_id', b.id).order('module_number'),
      supabase.from('session_announcements').select('*').eq('booking_id', b.id).order('created_at', { ascending: false }),
    ]);

    // Fetch modules with full structure
    let mods = rawMods || [];
    if (mods.length > 0) {
      const modIds = mods.map(m => m.id);
      const [{ data: subtopics }, { data: materials }, { data: quizzes }] = await Promise.all([
        supabase.from('module_subtopics').select('*').in('module_id', modIds).order('subtopic_number'),
        supabase.from('module_materials').select('*').in('module_id', modIds).order('order_num'),
        supabase.from('session_quizzes').select('*').in('module_id', modIds).order('order_num'),
      ]);

      mods = mods.map(m => ({
        ...m,
        subtopics: (subtopics || [])
          .filter(s => s.module_id === m.id)
          .map(sub => ({
            ...sub,
            materials: (materials || []).filter(mat => mat.subtopic_id === sub.id),
          })),
        moduleMaterials: (materials || []).filter(mat => mat.module_id === m.id && !mat.subtopic_id),
        quizzes: (quizzes || []).filter(q => q.module_id === m.id),
      }));
    }

    setSchedules(sched || []);
    setModules(mods);
    setAnnouncements(anns || []);
    setLoadingSched(false);
  };

  // Summary stats
  const total     = allSessions.length;
  const active    = allSessions.filter(b=>b.status==='confirmed').length;
  const completed = allSessions.filter(b=>b.status==='completed').length;
  const pending   = allSessions.filter(b=>b.status==='pending').length;

  if (loading) return <Spinner dark size={32}/>;

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:22}}>📚 All Sessions</h2>
        <p className="text-sm text-muted mt-4">Overview of all tutoring sessions across the platform.</p>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
        {[
          {label:'Total Bookings',  value:total,     bg:'#EFF6FF', color:'#1D4ED8', icon:'📋'},
          {label:'Active Sessions', value:active,    bg:'#D1FAE5', color:'#065F46', icon:'✅'},
          {label:'Completed',       value:completed, bg:'#F0FDF4', color:'#16A34A', icon:'🎓'},
          {label:'Pending',         value:pending,   bg:'#FEF9C3', color:'#92400E', icon:'⏳'},
        ].map(c=>(
          <div key={c.label} style={{background:c.bg,borderRadius:14,padding:'16px 20px'}}>
            <div style={{fontSize:24,marginBottom:6}}>{c.icon}</div>
            <div style={{fontSize:26,fontWeight:900,color:c.color}}>{c.value}</div>
            <div style={{fontSize:12,color:c.color,opacity:0.8}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-16 mb-20" style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
        <input className="input" placeholder="Search tutor, parent, student, subject..."
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{flex:1,minWidth:200}}/>
        <select className="select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{width:160}}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div style={{fontSize:13,color:tokens.muted,flexShrink:0}}>
          {filtered.length} booking{filtered.length!==1?'s':''}
        </div>
      </div>

      {/* Sessions table */}
      {filtered.length === 0 ? (
        <div className="card" style={{textAlign:'center',padding:'48px 0'}}>
          <div style={{fontSize:48,marginBottom:16}}>📚</div>
          <div className="font-jakarta font-bold" style={{fontSize:18,marginBottom:8}}>No Sessions Found</div>
          <p style={{fontSize:14,color:tokens.muted}}>No bookings match your search or filter.</p>
        </div>
      ) : (
        <div className="card" style={{overflow:'hidden'}}>
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Parent</th>
                <th>Tutor</th>
                <th>Subject</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Booked On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b=>(
                <tr key={b.id}>
                  <td>
                    <div style={{fontWeight:600,fontSize:13}}>{b.student?.name||'—'}</div>
                    <div style={{fontSize:11,color:tokens.muted}}>Grade {b.student?.grade_level||'—'}</div>
                  </td>
                  <td style={{fontSize:13}}>{b.parent?.full_name||'—'}</td>
                  <td style={{fontSize:13}}>{b.tutor?.full_name||'—'}</td>
                  <td style={{fontSize:13,textTransform:'capitalize'}}>{b.subject||'—'}</td>
                  <td style={{fontSize:12,textTransform:'capitalize',color:tokens.muted}}>{(b.session_mode||'').replace('-',' ')}</td>
                  <td>
                    <Badge variant={STATUS_VARIANT[b.status]||'gray'}>
                      {b.status==='pending_parent_confirm'?'Needs Confirm':b.status}
                    </Badge>
                  </td>
                  <td>
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,
                      background:b.payment_status==='paid'?'#D1FAE5':'#FEF9C3',
                      color:b.payment_status==='paid'?'#065F46':'#92400E'}}>
                      {b.payment_status==='paid'?'✅ Paid':'⏳ Unpaid'}
                    </span>
                  </td>
                  <td style={{fontSize:12,color:tokens.muted}}>{fmtDate(b.created_at)}</td>
                  <td>
                    <button className="btn btn-sm"
                      style={{background:'#EFF6FF',color:tokens.primary,border:`1px solid ${tokens.primary}30`}}
                      onClick={()=>openDetail(b)}>
                      👁 View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={()=>{setSelected(null);setSchedules([]);}}
        title="📋 Session Detail"
        footer={<button className="btn btn-ghost" onClick={()=>{setSelected(null);setSchedules([]);}}>Close</button>}>
        {selected&&(
          <div>
            {/* Booking info */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              {[
                ['Student',  selected.student?.name||'—'],
                ['Grade',    `Grade ${selected.student?.grade_level||'—'}`],
                ['Parent',   selected.parent?.full_name||'—'],
                ['Tutor',    selected.tutor?.full_name||'—'],
                ['Subject',  selected.subject||'—'],
                ['Mode',     (selected.session_mode||'').replace('-',' ')],
                ['Status',   selected.status],
                ['Payment',  selected.payment_status==='paid'?'✅ Paid':'⏳ Unpaid'],
                ['Total',    `₱${Number(selected.total_amount||0).toLocaleString()}`],
                ['Booked',   fmtDate(selected.created_at)],
              ].map(([k,v])=>(
                <div key={k} style={{background:'#F9FAFB',borderRadius:8,padding:12}}>
                  <div className="text-xs text-muted uppercase font-bold mb-4" style={{letterSpacing:'0.5px'}}>{k}</div>
                  <div style={{fontSize:13,fontWeight:600,textTransform:'capitalize'}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-0 mb-16" style={{borderBottom:`2px solid ${tokens.border}`}}>
              {[
                {key:'schedule', label:'📅 Schedule'},
                {key:'modules',  label:`📚 Modules (${modules.length})`},
                {key:'announce', label:`📢 Announcements (${announcements.length})`},
              ].map(t=>(
                <button key={t.key} onClick={()=>setActiveTab(t.key)}
                  style={{padding:'10px 20px',border:'none',borderBottom:`3px solid ${activeTab===t.key?tokens.primary:'transparent'}`,background:'none',cursor:'pointer',fontWeight:700,fontSize:13,color:activeTab===t.key?tokens.primary:tokens.muted,marginBottom:-2}}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Schedule Tab */}
            {activeTab==='schedule' && (
              loadingSched ? (
                <div style={{textAlign:'center',padding:'20px 0'}}><Spinner dark size={24}/></div>
              ) : schedules.length===0 ? (
                <div style={{textAlign:'center',padding:'20px 0',color:tokens.muted,fontSize:13}}>No schedule set yet.</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {schedules.map(s=>{
                    const [h] = (s.session_time||'00:00').split(':');
                    const hr  = parseInt(h);
                    const timeLabel = `${hr>12?hr-12:hr||12}:00 ${hr>=12?'PM':'AM'}`;
                    return (
                      <div key={s.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:'#F9FAFB',border:`1px solid ${tokens.border}`}}>
                        <span style={{fontSize:11,fontWeight:800,background:tokens.primary,color:'#fff',borderRadius:6,padding:'2px 8px',flexShrink:0}}>
                          S{s.session_num}
                        </span>
                        <div>
                          <div style={{fontSize:13,fontWeight:600}}>
                            {new Date(s.session_date+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}
                          </div>
                          <div style={{fontSize:12,color:tokens.muted}}>{timeLabel}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Modules Tab */}
            {activeTab==='modules' && (
              modules.length===0 ? (
                <div style={{textAlign:'center',padding:'32px 0',color:tokens.muted}}>
                  <div style={{fontSize:36,marginBottom:8}}>📚</div>
                  <div>No modules uploaded yet.</div>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:16}}>
                  {modules.map((mod,i)=>(
                    <div key={mod.id} style={{border:`1px solid ${tokens.border}`,borderRadius:12,overflow:'hidden'}}>
                      {/* Module header */}
                      <div style={{background:tokens.primaryLight,padding:'12px 16px',display:'flex',alignItems:'center',gap:10}}>
                        {mod.module_type&&<span style={{fontSize:10,fontWeight:800,background:tokens.primary,color:'#fff',borderRadius:4,padding:'2px 6px'}}>{mod.module_type}</span>}
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:14,color:tokens.primary}}>{mod.title||`Module ${i+1}`}</div>
                          <div style={{fontSize:12,color:tokens.mid,marginTop:2}}>
                            {(mod.subtopics||[]).length} subtopic(s) · {(mod.moduleMaterials||[]).length + (mod.subtopics||[]).reduce((s,sub)=>s+(sub.materials||[]).length,0)} material(s) · {(mod.quizzes||[]).length} quiz(zes)
                          </div>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:mod.is_published?'#D1FAE5':'#F3F4F6',color:mod.is_published?'#065F46':'#6B7280'}}>
                          {mod.is_published?'✓ Published':'Draft'}
                        </span>
                      </div>

                      <div style={{padding:'12px 16px'}}>
                        {/* Module-level materials */}
                        {(mod.moduleMaterials||[]).length > 0 && (
                          <div style={{marginBottom:12}}>
                            {mod.moduleMaterials.map(mat=>(
                              <div key={mat.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#F9FAFB',borderRadius:8,marginBottom:6}}>
                                <span style={{fontSize:11,fontWeight:700,padding:'2px 6px',borderRadius:4,background:'#EFF6FF',color:'#1D4ED8'}}>
                                  {(mat.material_type||'FILE').toUpperCase()}
                                </span>
                                <span style={{fontSize:13,fontWeight:600,flex:1}}>{mat.title||mat.file_name||'Material'}</span>
                                {mat.file_url&&<a href={mat.file_url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:tokens.primary,fontWeight:600}}>View ↗</a>}
                                {mat.url&&<a href={mat.url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:tokens.primary,fontWeight:600}}>Open ↗</a>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Subtopics */}
                        {(mod.subtopics||[]).map((sub,si)=>(
                          <div key={sub.id} style={{marginBottom:12}}>
                            <div style={{fontSize:12,fontWeight:700,color:tokens.muted,marginBottom:6}}>
                              Subtopic {si+1}: {sub.title||sub.name||'Untitled'}
                            </div>
                            {(sub.materials||[]).map(mat=>(
                              <div key={mat.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#F9FAFB',borderRadius:8,marginBottom:4,marginLeft:12}}>
                                <span style={{fontSize:11,fontWeight:700,padding:'2px 6px',borderRadius:4,background:'#EFF6FF',color:'#1D4ED8'}}>
                                  {(mat.material_type||'FILE').toUpperCase()}
                                </span>
                                <span style={{fontSize:13,fontWeight:600,flex:1}}>{mat.title||mat.file_name||'Material'}</span>
                                {mat.file_url&&<a href={mat.file_url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:tokens.primary,fontWeight:600}}>View ↗</a>}
                                {mat.url&&<a href={mat.url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:tokens.primary,fontWeight:600}}>Open ↗</a>}
                              </div>
                            ))}
                          </div>
                        ))}

                        {/* Quizzes */}
                        {(mod.quizzes||[]).length > 0 && (
                          <div style={{borderTop:`1px solid ${tokens.border}`,paddingTop:12,marginTop:4}}>
                            <div style={{fontSize:12,fontWeight:700,color:tokens.muted,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>
                              Quizzes in this module
                            </div>
                            {mod.quizzes.map(q=>(
                              <div key={q.id} style={{padding:'10px 12px',background:'#FEF9C3',borderRadius:8,marginBottom:6,border:'1px solid #FDE68A'}}>
                                <div style={{fontSize:13,fontWeight:700,color:'#92400E'}}>{q.title||q.topic||'Quiz'}</div>
                                <div style={{fontSize:12,color:'#78350F',marginTop:3}}>
                                  {q.pass_score&&`Pass ${q.pass_score}%`}
                                  {q.max_attempts&&` · Max ${q.max_attempts} attempt(s)`}
                                  {q.time_limit&&` · ${q.time_limit} min`}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Announcements Tab */}
            {activeTab==='announce' && (
              announcements.length===0 ? (
                <div style={{textAlign:'center',padding:'32px 0',color:tokens.muted}}>
                  <div style={{fontSize:36,marginBottom:8}}>📢</div>
                  <div>No announcements yet.</div>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {announcements.map(a=>(
                    <div key={a.id} style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:10,padding:'12px 16px'}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#92400E',marginBottom:4}}>{a.title||'Announcement'}</div>
                      <div style={{fontSize:13,color:'#78350F',lineHeight:1.7}}>{a.message}</div>
                      <div style={{fontSize:11,color:tokens.muted,marginTop:6}}>
                        {new Date(a.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}