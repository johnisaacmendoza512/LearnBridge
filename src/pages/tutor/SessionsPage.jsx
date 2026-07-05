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
  { value: 'formative',   label: '📝 Formative',   desc: 'During learning check' },
  { value: 'summative',   label: '📊 Summative',   desc: 'End of module evaluation' },
  { value: 'activity',    label: '🎯 Activity',    desc: 'Practice exercise' },
  { value: 'assessment',  label: '📋 Assessment',  desc: 'Formal evaluation' },
];

function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg    = type === 'error' ? '#FEE2E2' : '#D1FAE5';
  const color = type === 'error' ? '#DC2626'  : '#065F46';
  return (
    <div style={{ position:'fixed', top:24, right:24, zIndex:99999, background:bg, borderRadius:12, padding:'14px 20px', fontSize:14, color, fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,.12)', display:'flex', alignItems:'center', gap:10, maxWidth:380 }}>
      <span>{type === 'error' ? '❌' : '✅'}</span>
      <span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color, fontSize:16, padding:0 }}>✕</button>
    </div>
  );
}

export default function TutorSessionsPage() {
  const { user } = useAuth();
  const { bookings, loading: bookingsLoading } = useBookings();

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [modules,         setModules]         = useState([]);
  const [progress,        setProgress]        = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [toast,           setToast]           = useState(null);

  // Module modal
  const [moduleModal,  setModuleModal]  = useState(null); // null | 'create' | module object
  const [moduleForm,   setModuleForm]   = useState({ title:'', content:'', quiz_type:'formative', pass_score:75, max_attempts:10 });
  const [savingModule, setSavingModule] = useState(false);

  // Quiz modal
  const [quizModal,    setQuizModal]    = useState(null); // module object
  const [questions,    setQuestions]    = useState([]);
  const [loadingQuiz,  setLoadingQuiz]  = useState(false);
  const [savingQuiz,   setSavingQuiz]   = useState(false);
  const [newQ,         setNewQ]         = useState({ question_text:'', options:['','','',''], correct_index:0 });

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending_parent_confirm' || b.status === 'completed');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchModules = useCallback(async (bookingId) => {
    setLoading(true);
    const { data: mods } = await supabase
      .from('session_modules')
      .select('*')
      .eq('booking_id', bookingId)
      .order('module_number');

    const { data: prog } = await supabase
      .from('student_module_progress')
      .select('*, student:student_id(name)')
      .in('module_id', (mods || []).map(m => m.id));

    setModules(mods || []);
    setProgress(prog || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedBooking) fetchModules(selectedBooking.id);
  }, [selectedBooking, fetchModules]);

  const fetchQuestions = async (moduleId) => {
    setLoadingQuiz(true);
    const { data } = await supabase
      .from('module_quiz_questions')
      .select('*')
      .eq('module_id', moduleId)
      .order('order_num');
    setQuestions(data || []);
    setLoadingQuiz(false);
  };

  // ── Save module ─────────────────────────────────────────────────────────
  const handleSaveModule = async () => {
    if (!moduleForm.title.trim() || !moduleForm.content.trim()) {
      showToast('Title and content are required.', 'error'); return;
    }
    setSavingModule(true);
    try {
      if (moduleModal === 'create') {
        const nextNum = modules.length + 1;
        await supabase.from('session_modules').insert({
          booking_id:   selectedBooking.id,
          tutor_id:     user.id,
          module_number: nextNum,
          title:        moduleForm.title,
          content:      moduleForm.content,
          quiz_type:    moduleForm.quiz_type,
          pass_score:   moduleForm.pass_score,
          max_attempts: moduleForm.max_attempts,
          status:       'draft',
        });
        showToast('Module created!');
      } else {
        await supabase.from('session_modules').update({
          title:        moduleForm.title,
          content:      moduleForm.content,
          quiz_type:    moduleForm.quiz_type,
          pass_score:   moduleForm.pass_score,
          max_attempts: moduleForm.max_attempts,
        }).eq('id', moduleModal.id);
        showToast('Module updated!');
      }
      setModuleModal(null);
      fetchModules(selectedBooking.id);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSavingModule(false); }
  };

  const handlePublishToggle = async (mod) => {
    const newStatus = mod.status === 'published' ? 'draft' : 'published';
    await supabase.from('session_modules').update({ status: newStatus }).eq('id', mod.id);
    showToast(newStatus === 'published' ? 'Module published! Students can now see it.' : 'Module set to draft.');
    fetchModules(selectedBooking.id);
  };

  const handleDeleteModule = async (mod) => {
    if (!window.confirm(`Delete "${mod.title}"? This also deletes all quiz questions.`)) return;
    await supabase.from('session_modules').delete().eq('id', mod.id);
    showToast('Module deleted.');
    fetchModules(selectedBooking.id);
  };

  // ── Quiz questions ──────────────────────────────────────────────────────
  const openQuizModal = async (mod) => {
    setQuizModal(mod);
    setNewQ({ question_text:'', options:['','','',''], correct_index:0 });
    await fetchQuestions(mod.id);
  };

  const handleAddQuestion = async () => {
    if (!newQ.question_text.trim() || newQ.options.some(o => !o.trim())) {
      showToast('Fill in the question and all 4 options.', 'error'); return;
    }
    setSavingQuiz(true);
    try {
      await supabase.from('module_quiz_questions').insert({
        module_id:     quizModal.id,
        question_text: newQ.question_text,
        options:       newQ.options,
        correct_index: newQ.correct_index,
        order_num:     questions.length,
      });
      setNewQ({ question_text:'', options:['','','',''], correct_index:0 });
      await fetchQuestions(quizModal.id);
      showToast('Question added!');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSavingQuiz(false); }
  };

  const handleDeleteQuestion = async (qId) => {
    await supabase.from('module_quiz_questions').delete().eq('id', qId);
    await fetchQuestions(quizModal.id);
    showToast('Question removed.');
  };

  const getModuleProgress = (modId) => progress.filter(p => p.module_id === modId);

  if (bookingsLoading) return <Spinner dark size={32} />;

  // ── BOOKING LIST VIEW ───────────────────────────────────────────────────
  if (!selectedBooking) {
    return (
      <div className="fade-in">
        <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />
        <div className="mb-24">
          <h2 className="font-jakarta font-extrabold" style={{ fontSize:22 }}>Sessions Canvas</h2>
          <p className="text-sm text-muted mt-4">Select a booking to create and manage learning modules for your student.</p>
        </div>
        {confirmedBookings.length === 0 ? (
          <div className="card"><EmptyState icon="📚" title="No active bookings" description="Accept a booking request first to start creating modules." /></div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {confirmedBookings.map(b => (
              <div key={b.id} className="card p-20" style={{ cursor:'pointer', border:`1.5px solid ${tokens.border}`, transition:'border-color 0.15s' }}
                onClick={() => setSelectedBooking(b)}
                onMouseEnter={e => e.currentTarget.style.borderColor = tokens.primary}
                onMouseLeave={e => e.currentTarget.style.borderColor = tokens.border}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-jakarta font-bold" style={{ fontSize:15 }}>
                      {b.student?.name} — <span style={{ textTransform:'capitalize' }}>{b.subject}</span>
                    </div>
                    <div className="text-xs text-muted mt-4">
                      Parent: {b.parent?.full_name} · Grade {b.student?.grade_level} · {b.session_mode}
                    </div>
                  </div>
                  <div className="flex items-center gap-10">
                    <Badge variant={b.status === 'confirmed' ? 'success' : 'info'}>{b.status}</Badge>
                    <Icon name="arrowRight" size={16} color={tokens.primary} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── CANVAS VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="flex items-center gap-12 mb-24">
        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedBooking(null)}>
          ← Back
        </button>
        <div style={{ flex:1 }}>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize:20 }}>
            📚 {selectedBooking.student?.name} — {selectedBooking.subject}
          </h2>
          <p className="text-xs text-muted mt-2">Parent: {selectedBooking.parent?.full_name} · Grade {selectedBooking.student?.grade_level}</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setModuleForm({ title:'', content:'', quiz_type:'formative', pass_score:75, max_attempts:10 });
          setModuleModal('create');
        }}>
          <Icon name="plus" size={14} /> Add Module
        </button>
      </div>

      {loading ? <Spinner dark size={28} /> : modules.length === 0 ? (
        <div className="card p-40 text-center">
          <div style={{ fontSize:52, marginBottom:16 }}>📖</div>
          <div className="font-jakarta font-bold mb-8" style={{ fontSize:18 }}>No modules yet</div>
          <p className="text-sm text-muted mb-20">Create your first module to start building the learning canvas for this student.</p>
          <button className="btn btn-primary" onClick={() => {
            setModuleForm({ title:'', content:'', quiz_type:'formative', pass_score:75, max_attempts:10 });
            setModuleModal('create');
          }}>
            <Icon name="plus" size={14} /> Create First Module
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {modules.map((mod, idx) => {
            const modProgress = getModuleProgress(mod.id);
            const passed      = modProgress.filter(p => p.quiz_passed).length;
            return (
              <div key={mod.id} style={{ border:`2px solid ${mod.status === 'published' ? tokens.primary : tokens.border}`, borderRadius:16, overflow:'hidden', background:'#fff' }}>
                {/* Module header */}
                <div style={{ padding:'16px 20px', background: mod.status === 'published' ? tokens.primaryLight : '#F9FAFB', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background: mod.status === 'published' ? tokens.primary : '#E5E7EB', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ color: mod.status === 'published' ? '#fff' : tokens.muted, fontWeight:800, fontSize:16 }}>{idx + 1}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div className="font-jakarta font-bold" style={{ fontSize:15 }}>Module {mod.module_number}: {mod.title}</div>
                    <div className="flex items-center gap-8 mt-4">
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background: mod.status === 'published' ? '#D1FAE5' : '#FEF9C3', color: mod.status === 'published' ? '#065F46' : '#92400E', fontWeight:700 }}>
                        {mod.status === 'published' ? '✓ Published' : '✎ Draft'}
                      </span>
                      <span style={{ fontSize:11, color:tokens.muted }}>
                        {QUIZ_TYPES.find(t => t.value === mod.quiz_type)?.label || mod.quiz_type}
                      </span>
                      <span style={{ fontSize:11, color:tokens.muted }}>Pass: {mod.pass_score}% · Max {mod.max_attempts} attempts</span>
                      {modProgress.length > 0 && (
                        <span style={{ fontSize:11, color: passed > 0 ? '#065F46' : '#92400E', fontWeight:600 }}>
                          {passed}/{modProgress.length} student{modProgress.length !== 1 ? 's' : ''} passed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-sm" style={{ background:'#EFF6FF', color:tokens.primary, border:`1px solid ${tokens.primary}20` }}
                      onClick={() => openQuizModal(mod)}>
                      <Icon name="clipboard" size={11} color={tokens.primary} /> Quiz
                    </button>
                    <button className="btn btn-sm" style={{ background:'#F9FAFB', color:tokens.mid, border:`1px solid ${tokens.border}` }}
                      onClick={() => { setModuleForm({ title:mod.title, content:mod.content, quiz_type:mod.quiz_type, pass_score:mod.pass_score, max_attempts:mod.max_attempts }); setModuleModal(mod); }}>
                      <Icon name="edit" size={11} /> Edit
                    </button>
                    <button className="btn btn-sm" style={{ background: mod.status === 'published' ? '#FEF9C3' : '#D1FAE5', color: mod.status === 'published' ? '#92400E' : '#065F46', border:'none' }}
                      onClick={() => handlePublishToggle(mod)}>
                      {mod.status === 'published' ? 'Unpublish' : '↑ Publish'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteModule(mod)}>
                      <Icon name="x" size={11} />
                    </button>
                  </div>
                </div>

                {/* Module content preview */}
                <div style={{ padding:'16px 20px', borderTop:`1px solid ${tokens.border}` }}>
                  <div style={{ fontSize:13, color:tokens.mid, lineHeight:1.7, maxHeight:80, overflow:'hidden', position:'relative' }}>
                    {mod.content.substring(0, 300)}{mod.content.length > 300 ? '...' : ''}
                  </div>
                </div>

                {/* Student progress */}
                {modProgress.length > 0 && (
                  <div style={{ padding:'12px 20px', borderTop:`1px solid ${tokens.border}`, background:'#FAFAFA' }}>
                    <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing:'0.5px' }}>Student Progress</div>
                    <div className="flex gap-12" style={{ flexWrap:'wrap' }}>
                      {modProgress.map(p => (
                        <div key={p.id} style={{ fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:8, height:8, borderRadius:'50%', background: p.quiz_passed ? tokens.success : '#F59E0B', flexShrink:0 }} />
                          <span>{p.student?.name}</span>
                          <span style={{ color:tokens.muted }}>{p.quiz_passed ? `✓ Passed (${p.quiz_score}%)` : `${p.attempts}/${p.module_id} attempts`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create/Edit Module Modal ── */}
      <Modal
        open={!!moduleModal}
        onClose={() => setModuleModal(null)}
        title={moduleModal === 'create' ? '📖 Create New Module' : `✏️ Edit Module ${moduleModal?.module_number}`}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModuleModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveModule} disabled={savingModule}>
            {savingModule ? 'Saving...' : moduleModal === 'create' ? 'Create Module' : 'Save Changes'}
          </button>
        </>}
      >
        <FormGroup label="Module Title">
          <input className="input" placeholder="e.g. Introduction to Fractions" value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title:e.target.value }))} />
        </FormGroup>

        <FormGroup label="Module Content" hint="Write the lesson content, explanation, examples, etc. Students will read this before taking the quiz.">
          <textarea className="textarea" placeholder="Write the full lesson content here...&#10;&#10;You can include:&#10;- Explanations&#10;- Examples&#10;- Key concepts&#10;- Step-by-step solutions" value={moduleForm.content} onChange={e => setModuleForm(f => ({ ...f, content:e.target.value }))} style={{ minHeight:220, fontFamily:'inherit', lineHeight:1.7 }} />
        </FormGroup>

        <FormGroup label="Quiz Type">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {QUIZ_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setModuleForm(f => ({ ...f, quiz_type:t.value }))}
                style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer', border:`2px solid ${moduleForm.quiz_type === t.value ? tokens.primary : tokens.border}`, background: moduleForm.quiz_type === t.value ? tokens.primaryLight : '#FAFAFA', textAlign:'left', transition:'all 0.15s' }}>
                <div style={{ fontWeight:700, fontSize:13, color: moduleForm.quiz_type === t.value ? tokens.primary : tokens.dark }}>{t.label}</div>
                <div style={{ fontSize:11, color:tokens.muted }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </FormGroup>

        <div className="grid-2">
          <FormGroup label="Pass Score (%)" hint="Minimum score to pass this module.">
            <input className="input" type="number" min="50" max="100" value={moduleForm.pass_score} onChange={e => setModuleForm(f => ({ ...f, pass_score:Number(e.target.value) }))} />
          </FormGroup>
          <FormGroup label="Max Attempts" hint="How many times can student retry the quiz.">
            <input className="input" type="number" min="1" max="20" value={moduleForm.max_attempts} onChange={e => setModuleForm(f => ({ ...f, max_attempts:Number(e.target.value) }))} />
          </FormGroup>
        </div>
      </Modal>

      {/* ── Quiz Questions Modal ── */}
      <Modal
        open={!!quizModal}
        onClose={() => setQuizModal(null)}
        title={`📝 Quiz Questions — ${quizModal?.title}`}
        footer={<button className="btn btn-ghost" onClick={() => setQuizModal(null)}>Done</button>}
      >
        {loadingQuiz ? <Spinner dark size={24} /> : (
          <div>
            {/* Existing questions */}
            {questions.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div className="text-xs text-muted uppercase font-bold mb-12" style={{ letterSpacing:'0.5px' }}>
                  {questions.length} Question{questions.length !== 1 ? 's' : ''}
                </div>
                {questions.map((q, i) => (
                  <div key={q.id} style={{ background:'#F9FAFB', borderRadius:10, padding:14, marginBottom:10, border:`1px solid ${tokens.border}` }}>
                    <div className="flex items-start justify-between gap-10">
                      <div style={{ flex:1 }}>
                        <div className="font-semibold mb-8" style={{ fontSize:13 }}>Q{i + 1}. {q.question_text}</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {q.options.map((opt, oi) => (
                            <div key={oi} style={{ fontSize:12, padding:'4px 8px', borderRadius:6, background: oi === q.correct_index ? '#D1FAE5' : '#fff', color: oi === q.correct_index ? '#065F46' : tokens.mid, border:`1px solid ${oi === q.correct_index ? '#6EE7B7' : tokens.border}`, fontWeight: oi === q.correct_index ? 700 : 400 }}>
                              {String.fromCharCode(65 + oi)}. {opt} {oi === q.correct_index ? '✓' : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteQuestion(q.id)} style={{ background:'#FEE2E2', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', color:'#DC2626', fontSize:12, flexShrink:0 }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new question */}
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:12, padding:16 }}>
              <div className="font-jakarta font-bold mb-12" style={{ fontSize:14, color:'#1D4ED8' }}>
                ➕ Add Question
              </div>
              <FormGroup label="Question">
                <input className="input" placeholder="e.g. What is ½ + ¼?" value={newQ.question_text} onChange={e => setNewQ(q => ({ ...q, question_text:e.target.value }))} />
              </FormGroup>
              {newQ.options.map((opt, i) => (
                <FormGroup key={i} label={`Option ${String.fromCharCode(65 + i)}${i === newQ.correct_index ? ' ✓ (Correct)' : ''}`}>
                  <div className="flex gap-8">
                    <input className="input" placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt}
                      onChange={e => setNewQ(q => ({ ...q, options: q.options.map((o, oi) => oi === i ? e.target.value : o) }))}
                      style={{ flex:1, borderColor: i === newQ.correct_index ? tokens.success : undefined }} />
                    {i !== newQ.correct_index && (
                      <button type="button" onClick={() => setNewQ(q => ({ ...q, correct_index:i }))}
                        style={{ padding:'8px 12px', borderRadius:8, background:'#F9FAFB', border:`1px solid ${tokens.border}`, cursor:'pointer', fontSize:12, color:tokens.muted, whiteSpace:'nowrap' }}>
                        Set Correct
                      </button>
                    )}
                  </div>
                </FormGroup>
              ))}
              <button className="btn btn-primary btn-full" onClick={handleAddQuestion} disabled={savingQuiz}>
                {savingQuiz ? 'Adding...' : '+ Add Question'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}