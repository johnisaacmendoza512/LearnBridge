import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useBookings } from '../../hooks/useBookings';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import tokens from '../../lib/tokens';

const QUIZ_TYPES = [
  { value:'formative',  label:'📝 Formative Assessment',  short:'FA',  color:'#6366F1', bg:'#EEF2FF', desc:'During learning check' },
  { value:'summative',  label:'📊 Summative Assessment',  short:'SA',  color:'#059669', bg:'#ECFDF5', desc:'End of module evaluation' },
  { value:'practice',   label:'🎯 Practice Quiz',          short:'PQ',  color:'#D97706', bg:'#FFFBEB', desc:'Ungraded practice' },
  { value:'activity',   label:'🏃 Activity',               short:'ACT', color:'#BE185D', bg:'#FDF2F8', desc:'In-class exercise' },
];

function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg = type==='error'?'#FEE2E2':'#D1FAE5', color = type==='error'?'#DC2626':'#065F46';
  return (
    <div style={{ position:'fixed',top:24,right:24,zIndex:99999,background:bg,borderRadius:12,padding:'14px 20px',fontSize:14,color,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,.12)',display:'flex',alignItems:'center',gap:10,maxWidth:380 }}>
      <span>{type==='error'?'❌':'✅'}</span><span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color,fontSize:16,padding:0 }}>✕</button>
    </div>
  );
}

export default function TutorQuizzesPage() {
  const { user } = useAuth();
  const { bookings, loading:bLoading } = useBookings();
  const confirmed = bookings.filter(b => ['confirmed','pending_parent_confirm','completed'].includes(b.status));

  const [selBooking,  setSelBooking]  = useState(null);
  const [quizzes,     setQuizzes]     = useState([]);
  const [modules,     setModules]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [toast,       setToast]       = useState(null);
  const [activeQuiz,  setActiveQuiz]  = useState(null); // quiz being edited (questions)

  // Quiz modal
  const [quizModal,   setQuizModal]   = useState(null); // 'create' | quiz
  const [quizForm,    setQuizForm]    = useState({ title:'', quiz_type:'formative', instructions:'', pass_score:75, max_attempts:10, time_limit:0, module_id:'' });
  const [savingQuiz,  setSavingQuiz]  = useState(false);

  // Question state
  const [questions,   setQuestions]   = useState([]);
  const [loadingQs,   setLoadingQs]   = useState(false);
  const [newQ,        setNewQ]        = useState({ question_text:'', question_type:'multiple_choice', options:['','','',''], correct_index:0, points:1 });
  const [savingQ,     setSavingQ]     = useState(false);

  const showToast = (msg, type='success') => { setToast({ msg,type }); setTimeout(() => setToast(null), 3500); };

  const fetchQuizzes = useCallback(async (bookingId) => {
    setLoading(true);
    const { data } = await supabase.from('session_quizzes').select('*').eq('booking_id', bookingId).order('order_num');
    setQuizzes(data || []);
    setLoading(false);
  }, []);

  const fetchModules = useCallback(async (bookingId) => {
    const { data } = await supabase.from('session_modules').select('id,title,module_number').eq('booking_id', bookingId).order('module_number');
    setModules(data || []);
  }, []);

  useEffect(() => {
    if (selBooking) { fetchQuizzes(selBooking.id); fetchModules(selBooking.id); }
  }, [selBooking, fetchQuizzes, fetchModules]);

  const fetchQuestions = async (quizId) => {
    setLoadingQs(true);
    const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('order_num');
    setQuestions(data || []);
    setLoadingQs(false);
  };

  // ── Quiz CRUD ───────────────────────────────────────────────────────────
  const saveQuiz = async () => {
    if (!quizForm.title.trim()) { showToast('Quiz title is required.','error'); return; }
    setSavingQuiz(true);
    try {
      const payload = {
        booking_id:  selBooking.id,
        tutor_id:    user.id,
        title:       quizForm.title,
        quiz_type:   quizForm.quiz_type,
        instructions: quizForm.instructions || null,
        pass_score:  quizForm.pass_score,
        max_attempts: quizForm.max_attempts,
        time_limit:  quizForm.time_limit,
        module_id:   quizForm.module_id || null,
        order_num:   quizzes.length,
      };
      if (quizModal === 'create') {
        const { data } = await supabase.from('session_quizzes').insert(payload).select().single();
        showToast('Quiz created! Now add questions.');
        setQuizModal(null);
        await fetchQuizzes(selBooking.id);
        setActiveQuiz(data);
        await fetchQuestions(data.id);
      } else {
        await supabase.from('session_quizzes').update(payload).eq('id', quizModal.id);
        showToast('Quiz updated!');
        setQuizModal(null);
        fetchQuizzes(selBooking.id);
      }
    } catch(e) { showToast(e.message,'error'); } finally { setSavingQuiz(false); }
  };

  const deleteQuiz = async (quiz) => {
    if (!window.confirm(`Delete "${quiz.title}"? All questions will also be deleted.`)) return;
    await supabase.from('session_quizzes').delete().eq('id', quiz.id);
    showToast('Quiz deleted.'); fetchQuizzes(selBooking.id);
  };

  const togglePublishQuiz = async (quiz) => {
    const ns = quiz.status==='published'?'draft':'published';
    await supabase.from('session_quizzes').update({ status:ns }).eq('id', quiz.id);
    showToast(ns==='published'?'Quiz published!':'Quiz set to draft.'); fetchQuizzes(selBooking.id);
  };

  const openQuizEditor = async (quiz) => {
    setActiveQuiz(quiz);
    setNewQ({ question_text:'', question_type:'multiple_choice', options:['','','',''], correct_index:0, points:1 });
    await fetchQuestions(quiz.id);
  };

  // ── Question CRUD ───────────────────────────────────────────────────────
  const addQuestion = async () => {
    if (!newQ.question_text.trim()) { showToast('Question text is required.','error'); return; }
    if (newQ.question_type === 'multiple_choice' && newQ.options.some(o => !o.trim())) {
      showToast('Fill in all 4 options.','error'); return;
    }
    setSavingQ(true);
    try {
      const opts = newQ.question_type === 'true_false' ? ['True','False'] : newQ.options;
      await supabase.from('quiz_questions').insert({
        quiz_id:       activeQuiz.id,
        question_text: newQ.question_text,
        question_type: newQ.question_type,
        options:       opts,
        correct_index: newQ.correct_index,
        points:        newQ.points,
        order_num:     questions.length,
      });
      setNewQ({ question_text:'', question_type:'multiple_choice', options:['','','',''], correct_index:0, points:1 });
      await fetchQuestions(activeQuiz.id);
      showToast('Question added!');
    } catch(e) { showToast(e.message,'error'); } finally { setSavingQ(false); }
  };

  const deleteQuestion = async (qId) => {
    await supabase.from('quiz_questions').delete().eq('id', qId);
    await fetchQuestions(activeQuiz.id);
    showToast('Question removed.');
  };

  if (bLoading) return <Spinner dark size={32} />;

  // Booking selector
  if (!selBooking) return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize:22 }}>📝 Quizzes</h2>
        <p className="text-sm text-muted mt-4">Select a booking to create and manage quizzes (FA, SA, Practice Quiz).</p>
      </div>
      {confirmed.length === 0
        ? <div className="card"><EmptyState icon="📝" title="No active bookings" /></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {confirmed.map(b => (
              <div key={b.id} className="card p-20" style={{ cursor:'pointer', border:`1.5px solid ${tokens.border}`, transition:'all 0.15s' }}
                onClick={() => setSelBooking(b)}
                onMouseEnter={e => e.currentTarget.style.borderColor = tokens.primary}
                onMouseLeave={e => e.currentTarget.style.borderColor = tokens.border}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-jakarta font-bold" style={{ fontSize:15 }}>{b.student?.name} — <span style={{ textTransform:'capitalize' }}>{b.subject}</span></div>
                    <div className="text-xs text-muted mt-4">Parent: {b.parent?.full_name} · Grade {b.student?.grade_level}</div>
                  </div>
                  <div className="flex gap-8 items-center">
                    <Badge variant="success">{b.status}</Badge>
                    <Icon name="arrowRight" size={16} color={tokens.primary} />
                  </div>
                </div>
              </div>
            ))}
          </div>}
    </div>
  );

  // Quiz editor (questions view)
  if (activeQuiz) {
    const qType = QUIZ_TYPES.find(t => t.value === activeQuiz.quiz_type);
    return (
      <div className="fade-in">
        <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />
        <button className="btn btn-ghost btn-sm mb-20" onClick={() => { setActiveQuiz(null); fetchQuizzes(selBooking.id); }}>← Back to Quizzes</button>

        <div className="flex items-center gap-12 mb-20">
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:20, background:qType?.bg, color:qType?.color, display:'inline-block', marginBottom:6 }}>{qType?.label}</div>
            <h2 className="font-jakarta font-extrabold" style={{ fontSize:20 }}>{activeQuiz.title}</h2>
            <p className="text-xs text-muted mt-2">Pass: {activeQuiz.pass_score}% · Max {activeQuiz.max_attempts} attempts · {questions.length} question{questions.length!==1?'s':''}</p>
          </div>
        </div>

        <div className="grid-2" style={{ gap:20 }}>
          {/* Questions list */}
          <div>
            <h3 className="font-jakarta font-bold mb-12" style={{ fontSize:15 }}>Questions ({questions.length})</h3>
            {loadingQs ? <Spinner dark size={24} /> : questions.length === 0
              ? <div style={{ padding:'20px', textAlign:'center', color:tokens.muted, fontSize:13, background:'#F9FAFB', borderRadius:12, border:`1px dashed ${tokens.border}` }}>No questions yet — add some on the right</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {questions.map((q, i) => (
                    <div key={q.id} style={{ background:'#F9FAFB', borderRadius:10, padding:14, border:`1px solid ${tokens.border}` }}>
                      <div className="flex items-start justify-between gap-10">
                        <div style={{ flex:1 }}>
                          <div className="font-semibold mb-8" style={{ fontSize:13 }}>Q{i+1}. {q.question_text} <span style={{ fontSize:11, color:tokens.muted }}>({q.points}pt)</span></div>
                          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            {q.options.map((opt, oi) => (
                              <div key={oi} style={{ fontSize:12, padding:'4px 8px', borderRadius:6, background:oi===q.correct_index?'#D1FAE5':'#fff', color:oi===q.correct_index?'#065F46':tokens.mid, border:`1px solid ${oi===q.correct_index?'#6EE7B7':tokens.border}`, fontWeight:oi===q.correct_index?700:400 }}>
                                {String.fromCharCode(65+oi)}. {opt} {oi===q.correct_index?'✓':''}
                              </div>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => deleteQuestion(q.id)} style={{ background:'#FEE2E2', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', color:'#DC2626', fontSize:12, flexShrink:0 }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>}
          </div>

          {/* Add question */}
          <div>
            <h3 className="font-jakarta font-bold mb-12" style={{ fontSize:15 }}>Add Question</h3>
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:12, padding:16 }}>
              <FormGroup label="Question Type">
                <div className="flex gap-8">
                  {['multiple_choice','true_false'].map(t => (
                    <button key={t} type="button" onClick={() => setNewQ(q => ({ ...q, question_type:t, options:t==='true_false'?['True','False']:['','','',''], correct_index:0 }))}
                      style={{ flex:1, padding:'8px', borderRadius:8, cursor:'pointer', border:`2px solid ${newQ.question_type===t?tokens.primary:tokens.border}`, background:newQ.question_type===t?tokens.primaryLight:'#FAFAFA', fontSize:12, fontWeight:600, color:newQ.question_type===t?tokens.primary:tokens.mid }}>
                      {t==='multiple_choice'?'Multiple Choice':'True / False'}
                    </button>
                  ))}
                </div>
              </FormGroup>
              <FormGroup label="Question">
                <textarea className="textarea" placeholder="Type the question here..." value={newQ.question_text} onChange={e => setNewQ(q => ({ ...q, question_text:e.target.value }))} style={{ minHeight:80 }} />
              </FormGroup>
              {newQ.question_type === 'multiple_choice'
                ? newQ.options.map((opt, i) => (
                    <FormGroup key={i} label={`Option ${String.fromCharCode(65+i)}${i===newQ.correct_index?' ✓ Correct':''}`}>
                      <div className="flex gap-8">
                        <input className="input" style={{ flex:1, borderColor:i===newQ.correct_index?tokens.success:undefined }} placeholder={`Option ${String.fromCharCode(65+i)}`} value={opt}
                          onChange={e => setNewQ(q => ({ ...q, options:q.options.map((o,oi) => oi===i?e.target.value:o) }))} />
                        {i!==newQ.correct_index && (
                          <button type="button" onClick={() => setNewQ(q => ({ ...q, correct_index:i }))}
                            style={{ padding:'8px 10px', borderRadius:8, background:'#F9FAFB', border:`1px solid ${tokens.border}`, cursor:'pointer', fontSize:11, color:tokens.muted, whiteSpace:'nowrap' }}>
                            Set Correct
                          </button>
                        )}
                      </div>
                    </FormGroup>
                  ))
                : <FormGroup label="Correct Answer">
                    <div className="flex gap-8">
                      {['True','False'].map((v,i) => (
                        <button key={v} type="button" onClick={() => setNewQ(q => ({ ...q, correct_index:i }))}
                          style={{ flex:1, padding:'10px', borderRadius:8, cursor:'pointer', border:`2px solid ${newQ.correct_index===i?tokens.primary:tokens.border}`, background:newQ.correct_index===i?tokens.primaryLight:'#FAFAFA', fontWeight:600, fontSize:14, color:newQ.correct_index===i?tokens.primary:tokens.mid }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </FormGroup>}
              <FormGroup label="Points">
                <input className="input" type="number" min="1" max="10" value={newQ.points} onChange={e => setNewQ(q => ({ ...q, points:Number(e.target.value) }))} />
              </FormGroup>
              <button className="btn btn-primary btn-full" onClick={addQuestion} disabled={savingQ}>
                {savingQ?'Adding...':'+ Add Question'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz list view ──────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />

      <div className="flex items-center gap-12 mb-20">
        <button className="btn btn-ghost btn-sm" onClick={() => setSelBooking(null)}>← Back</button>
        <div style={{ flex:1 }}>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize:20 }}>📝 {selBooking.student?.name} — Quizzes</h2>
          <p className="text-xs text-muted mt-2">Formative · Summative · Practice Quiz · Activity</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setQuizForm({ title:'', quiz_type:'formative', instructions:'', pass_score:75, max_attempts:10, time_limit:0, module_id:'' }); setQuizModal('create'); }}>
          <Icon name="plus" size={14} /> Create Quiz
        </button>
      </div>

      {/* Quiz type tabs */}
      <div className="flex gap-8 mb-20" style={{ flexWrap:'wrap' }}>
        {QUIZ_TYPES.map(t => {
          const count = quizzes.filter(q => q.quiz_type===t.value).length;
          return (
            <div key={t.value} style={{ padding:'8px 16px', borderRadius:10, background:t.bg, border:`1px solid ${t.color}30` }}>
              <div style={{ fontSize:12, fontWeight:800, color:t.color }}>{t.label}</div>
              <div style={{ fontSize:11, color:t.color, opacity:0.7 }}>{count} quiz{count!==1?'zes':''}</div>
            </div>
          );
        })}
      </div>

      {loading ? <Spinner dark size={28} /> : quizzes.length === 0
        ? <div className="card p-40 text-center">
            <div style={{ fontSize:48, marginBottom:16 }}>📝</div>
            <div className="font-jakarta font-bold mb-8" style={{ fontSize:18 }}>No quizzes yet</div>
            <p className="text-sm text-muted mb-20">Create formative, summative, or practice quizzes for your student.</p>
            <button className="btn btn-primary" onClick={() => { setQuizForm({ title:'', quiz_type:'formative', instructions:'', pass_score:75, max_attempts:10, time_limit:0, module_id:'' }); setQuizModal('create'); }}>
              <Icon name="plus" size={14} /> Create First Quiz
            </button>
          </div>
        : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {quizzes.map(quiz => {
              const qType = QUIZ_TYPES.find(t => t.value===quiz.quiz_type);
              const linkedMod = modules.find(m => m.id===quiz.module_id);
              return (
                <div key={quiz.id} style={{ border:`1.5px solid ${quiz.status==='published'?qType?.color||tokens.primary:tokens.border}`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:14, background:'#fff' }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:qType?.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:14, fontWeight:900, color:qType?.color }}>{qType?.short}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div className="font-jakarta font-bold" style={{ fontSize:14 }}>{quiz.title}</div>
                    <div style={{ fontSize:11, color:tokens.muted, marginTop:3, display:'flex', gap:10, flexWrap:'wrap' }}>
                      <span>{qType?.label}</span>
                      {linkedMod && <span>· Module {linkedMod.module_number}: {linkedMod.title}</span>}
                      <span>· Pass: {quiz.pass_score}%</span>
                      <span>· Max {quiz.max_attempts} attempts</span>
                      {quiz.time_limit>0 && <span>· {quiz.time_limit} min</span>}
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:700, background:quiz.status==='published'?'#D1FAE5':'#FEF9C3', color:quiz.status==='published'?'#065F46':'#92400E' }}>
                      {quiz.status==='published'?'✓ Published':'Draft'}
                    </span>
                    <button className="btn btn-sm" style={{ background:'#EFF6FF', color:tokens.primary }} onClick={() => openQuizEditor(quiz)}>
                      <Icon name="clipboard" size={11} color={tokens.primary} /> Questions
                    </button>
                    <button className="btn btn-sm" style={{ background:'#F0FDF4', color:'#065F46', border:'1px solid #6EE7B7' }} onClick={() => togglePublishQuiz(quiz)}>
                      {quiz.status==='published'?'Unpublish':'Publish'}
                    </button>
                    <button className="btn btn-sm" style={{ background:tokens.primaryLight, color:tokens.primary }} onClick={() => { setQuizForm({ title:quiz.title, quiz_type:quiz.quiz_type, instructions:quiz.instructions||'', pass_score:quiz.pass_score, max_attempts:quiz.max_attempts, time_limit:quiz.time_limit, module_id:quiz.module_id||'' }); setQuizModal(quiz); }}>
                      <Icon name="edit" size={11} />
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteQuiz(quiz)}><Icon name="x" size={11} /></button>
                  </div>
                </div>
              );
            })}
          </div>}

      {/* Create/Edit Quiz Modal */}
      <Modal open={!!quizModal} onClose={() => setQuizModal(null)}
        title={quizModal==='create'?'📝 Create Quiz':'✏️ Edit Quiz'}
        footer={<><button className="btn btn-ghost" onClick={() => setQuizModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveQuiz} disabled={savingQuiz}>{savingQuiz?'Saving...':quizModal==='create'?'Create Quiz':'Save Changes'}</button></>}>
        <FormGroup label="Quiz Type">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {QUIZ_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setQuizForm(f => ({ ...f, quiz_type:t.value }))}
                style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer', border:`2px solid ${quizForm.quiz_type===t.value?t.color:tokens.border}`, background:quizForm.quiz_type===t.value?t.bg:'#FAFAFA', textAlign:'left', transition:'all 0.15s' }}>
                <div style={{ fontWeight:700, fontSize:13, color:quizForm.quiz_type===t.value?t.color:tokens.dark }}>{t.label}</div>
                <div style={{ fontSize:11, color:tokens.muted }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </FormGroup>
        <FormGroup label="Quiz Title">
          <input className="input" placeholder={`e.g. [${quizForm.quiz_type?.toUpperCase().slice(0,2)}1] First ${QUIZ_TYPES.find(t=>t.value===quizForm.quiz_type)?.label}`} value={quizForm.title} onChange={e => setQuizForm(f => ({ ...f, title:e.target.value }))} />
        </FormGroup>
        {modules.length > 0 && (
          <FormGroup label="Link to Module (Optional)">
            <select className="select" value={quizForm.module_id} onChange={e => setQuizForm(f => ({ ...f, module_id:e.target.value }))}>
              <option value="">— Not linked to a module —</option>
              {modules.map(m => <option key={m.id} value={m.id}>Module {m.module_number}: {m.title}</option>)}
            </select>
          </FormGroup>
        )}
        <FormGroup label="Instructions (Optional)">
          <textarea className="textarea" placeholder="Instructions for the student..." value={quizForm.instructions} onChange={e => setQuizForm(f => ({ ...f, instructions:e.target.value }))} style={{ minHeight:80 }} />
        </FormGroup>
        <div className="grid-2">
          <FormGroup label="Pass Score (%)">
            <input className="input" type="number" min="50" max="100" value={quizForm.pass_score} onChange={e => setQuizForm(f => ({ ...f, pass_score:Number(e.target.value) }))} />
          </FormGroup>
          <FormGroup label="Max Attempts">
            <input className="input" type="number" min="1" max="20" value={quizForm.max_attempts} onChange={e => setQuizForm(f => ({ ...f, max_attempts:Number(e.target.value) }))} />
          </FormGroup>
        </div>
        <FormGroup label="Time Limit (minutes)" hint="Set 0 for no time limit.">
          <input className="input" type="number" min="0" value={quizForm.time_limit} onChange={e => setQuizForm(f => ({ ...f, time_limit:Number(e.target.value) }))} />
        </FormGroup>
      </Modal>
    </div>
  );
}