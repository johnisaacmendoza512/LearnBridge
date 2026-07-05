import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useBookings } from '../../hooks/useBookings';
import { useStudents } from '../../hooks/useStudents';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import tokens from '../../lib/tokens';

function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg    = type === 'error' ? '#FEE2E2' : type === 'success' ? '#D1FAE5' : '#EFF6FF';
  const color = type === 'error' ? '#DC2626'  : type === 'success' ? '#065F46'  : '#1D4ED8';
  return (
    <div style={{ position:'fixed', top:24, right:24, zIndex:99999, background:bg, borderRadius:12, padding:'14px 20px', fontSize:14, color, fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,.12)', display:'flex', alignItems:'center', gap:10, maxWidth:380 }}>
      <span>{type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</span>
      <span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color, fontSize:16, padding:0 }}>✕</button>
    </div>
  );
}

const QUIZ_TYPE_LABELS = { formative:'📝 Formative', summative:'📊 Summative', activity:'🎯 Activity', assessment:'📋 Assessment' };

export default function ParentSessionsPage() {
  const { user } = useAuth();
  const { bookings, loading: bookingsLoading } = useBookings();
  const { students } = useStudents();

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [modules,         setModules]         = useState([]);
  const [progress,        setProgress]        = useState({});  // { moduleId: progressRow }
  const [loading,         setLoading]         = useState(false);
  const [toast,           setToast]           = useState(null);

  // Reading a module
  const [readingModule, setReadingModule]     = useState(null);

  // Quiz state
  const [quizModal,    setQuizModal]    = useState(null);   // module object
  const [questions,    setQuestions]    = useState([]);
  const [answers,      setAnswers]      = useState({});     // { questionIndex: selectedOption }
  const [quizResult,   setQuizResult]   = useState(null);   // { score, passed, correct, total }
  const [submitting,   setSubmitting]   = useState(false);
  const [answerErrors, setAnswerErrors] = useState(false);

  const activeBookings = bookings.filter(b =>
    b.status === 'confirmed' || b.status === 'pending_parent_confirm' || b.status === 'completed'
  );

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchModulesAndProgress = useCallback(async (bookingId, studentId) => {
    setLoading(true);
    const { data: mods } = await supabase
      .from('session_modules')
      .select('*')
      .eq('booking_id', bookingId)
      .eq('status', 'published')
      .order('module_number');

    setModules(mods || []);

    if (studentId && mods?.length > 0) {
      const { data: prog } = await supabase
        .from('student_module_progress')
        .select('*')
        .eq('student_id', studentId)
        .in('module_id', mods.map(m => m.id));

      const progMap = {};
      (prog || []).forEach(p => { progMap[p.module_id] = p; });
      setProgress(progMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedBooking && selectedStudent) {
      fetchModulesAndProgress(selectedBooking.id, selectedStudent.id);
    }
  }, [selectedBooking, selectedStudent, fetchModulesAndProgress]);

  const getBookingStudent = (booking) =>
    students.find(s => s.id === booking.student_id) || booking.student;

  // Mark module as viewed and unlock quiz
  const handleStartReading = async (mod) => {
    setReadingModule(mod);
    const prog = progress[mod.id];
    if (!prog || !prog.module_viewed) {
      // Upsert progress row
      await supabase.from('student_module_progress').upsert({
        module_id:     mod.id,
        student_id:    selectedStudent.id,
        parent_id:     user.id,
        module_viewed: true,
      }, { onConflict: 'module_id,student_id' });
      await fetchModulesAndProgress(selectedBooking.id, selectedStudent.id);
    }
  };

  // Open quiz
  const handleOpenQuiz = async (mod) => {
    const prog = progress[mod.id];
    const attempts = prog?.attempts || 0;
    if (attempts >= mod.max_attempts && !prog?.quiz_passed) {
      showToast(`Maximum ${mod.max_attempts} attempts reached for this quiz.`, 'error'); return;
    }
    const { data: qs } = await supabase
      .from('module_quiz_questions')
      .select('*')
      .eq('module_id', mod.id)
      .order('order_num');

    if (!qs || qs.length === 0) {
      showToast('No quiz questions added for this module yet.', 'info'); return;
    }
    setQuestions(qs);
    setAnswers({});
    setQuizResult(null);
    setAnswerErrors(false);
    setQuizModal(mod);
  };

  const handleSubmitQuiz = async () => {
    // Check all answered
    if (Object.keys(answers).length < questions.length) {
      setAnswerErrors(true);
      showToast('Please answer all questions before submitting.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      let correct = 0;
      questions.forEach((q, i) => {
        if (answers[i] === q.correct_index) correct++;
      });
      const score  = Math.round((correct / questions.length) * 100);
      const passed = score >= quizModal.pass_score;
      const prog   = progress[quizModal.id];
      const newAttempts = (prog?.attempts || 0) + 1;

      await supabase.from('student_module_progress').upsert({
        module_id:      quizModal.id,
        student_id:     selectedStudent.id,
        parent_id:      user.id,
        module_viewed:  true,
        quiz_passed:    passed || prog?.quiz_passed || false,
        quiz_score:     Math.max(score, prog?.quiz_score || 0),
        attempts:       newAttempts,
        last_attempt_at: new Date().toISOString(),
        ...(passed ? { completed_at: new Date().toISOString() } : {}),
      }, { onConflict: 'module_id,student_id' });

      setQuizResult({ score, passed, correct, total: questions.length });
      await fetchModulesAndProgress(selectedBooking.id, selectedStudent.id);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const isModuleLocked = (mod, idx) => {
    if (idx === 0) return false; // first module always unlocked
    const prevMod  = modules[idx - 1];
    const prevProg = progress[prevMod?.id];
    return !prevProg?.quiz_passed;
  };

  if (bookingsLoading) return <Spinner dark size={32} />;

  // ── STEP 1: Select booking ──────────────────────────────────────────────
  if (!selectedBooking) {
    return (
      <div className="fade-in">
        <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />
        <div className="mb-24">
          <h2 className="font-jakarta font-extrabold" style={{ fontSize:22 }}>Sessions Canvas</h2>
          <p className="text-sm text-muted mt-4">Select a booking to view your child's learning modules.</p>
        </div>
        {activeBookings.length === 0 ? (
          <div className="card"><EmptyState icon="📚" title="No active bookings" description="Book a tutor session first to access learning modules." /></div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {activeBookings.map(b => (
              <div key={b.id} className="card p-20" style={{ cursor:'pointer', border:`1.5px solid ${tokens.border}`, transition:'border-color 0.15s' }}
                onClick={() => { setSelectedBooking(b); setSelectedStudent(getBookingStudent(b)); }}
                onMouseEnter={e => e.currentTarget.style.borderColor = tokens.primary}
                onMouseLeave={e => e.currentTarget.style.borderColor = tokens.border}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-jakarta font-bold" style={{ fontSize:15 }}>
                      {b.student?.name} — <span style={{ textTransform:'capitalize' }}>{b.subject}</span>
                    </div>
                    <div className="text-xs text-muted mt-4">Tutor: {b.tutor?.full_name} · Grade {b.student?.grade_level}</div>
                  </div>
                  <div className="flex items-center gap-10">
                    <Badge variant="success">{b.status}</Badge>
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

  // ── STEP 2: Reading a module ────────────────────────────────────────────
  if (readingModule) {
    const prog = progress[readingModule.id];
    return (
      <div className="fade-in">
        <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />
        <button className="btn btn-ghost btn-sm mb-20" onClick={() => setReadingModule(null)}>← Back to Modules</button>

        <div className="card p-32" style={{ maxWidth:780, margin:'0 auto' }}>
          {/* Module header */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:tokens.primaryLight, color:tokens.primary }}>
                Module {readingModule.module_number}
              </span>
              <span style={{ fontSize:11, color:tokens.muted }}>{QUIZ_TYPE_LABELS[readingModule.quiz_type]}</span>
            </div>
            <h2 className="font-jakarta font-extrabold" style={{ fontSize:24 }}>{readingModule.title}</h2>
            <p className="text-xs text-muted mt-4">For: {selectedStudent?.name} · Pass score: {readingModule.pass_score}%</p>
          </div>

          {/* Module content */}
          <div style={{ background:'#FAFAFA', borderRadius:12, padding:24, marginBottom:28, lineHeight:1.9, fontSize:15, color:tokens.dark, whiteSpace:'pre-wrap', border:`1px solid ${tokens.border}` }}>
            {readingModule.content}
          </div>

          {/* Quiz status */}
          {prog?.quiz_passed ? (
            <div style={{ background:'#D1FAE5', border:'1px solid #6EE7B7', borderRadius:12, padding:16, textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🎉</div>
              <div className="font-jakarta font-bold" style={{ fontSize:16, color:'#065F46' }}>Quiz Passed!</div>
              <div style={{ fontSize:13, color:'#065F46', marginTop:4 }}>
                Best score: {prog.quiz_score}% · Proceed to the next module
              </div>
            </div>
          ) : (
            <div style={{ background:tokens.primaryLight, border:`1px solid ${tokens.primary}30`, borderRadius:12, padding:20, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
              <div>
                <div className="font-jakarta font-bold" style={{ fontSize:15 }}>Ready to take the quiz?</div>
                <div style={{ fontSize:13, color:tokens.mid, marginTop:4 }}>
                  Pass score: {readingModule.pass_score}% ·
                  Attempts used: {prog?.attempts || 0}/{readingModule.max_attempts}
                  {prog?.quiz_score > 0 && ` · Best: ${prog.quiz_score}%`}
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => handleOpenQuiz(readingModule)}
                disabled={(prog?.attempts || 0) >= readingModule.max_attempts}>
                {(prog?.attempts || 0) >= readingModule.max_attempts ? 'No attempts left' : `Take ${QUIZ_TYPE_LABELS[readingModule.quiz_type]}`}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── STEP 3: Modules Canvas ──────────────────────────────────────────────
  const totalPassed  = Object.values(progress).filter(p => p.quiz_passed).length;
  const totalModules = modules.length;

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="flex items-center gap-12 mb-20">
        <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedBooking(null); setSelectedStudent(null); setModules([]); setProgress({}); }}>
          ← Back
        </button>
        <div style={{ flex:1 }}>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize:20 }}>
            📚 {selectedBooking.student?.name} — {selectedBooking.subject}
          </h2>
          <p className="text-xs text-muted mt-2">Tutor: {selectedBooking.tutor?.full_name}</p>
        </div>
        {totalModules > 0 && (
          <div style={{ textAlign:'right' }}>
            <div className="font-jakarta font-bold" style={{ fontSize:15 }}>{totalPassed}/{totalModules} Modules Completed</div>
            <div style={{ width:160, height:6, background:'#E5E7EB', borderRadius:3, marginTop:6, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:3, width:`${totalModules > 0 ? (totalPassed/totalModules)*100 : 0}%`, background:`linear-gradient(90deg, ${tokens.primary}, ${tokens.success})`, transition:'width 0.4s' }} />
            </div>
          </div>
        )}
      </div>

      {loading ? <Spinner dark size={28} /> : modules.length === 0 ? (
        <div className="card p-40 text-center">
          <div style={{ fontSize:52, marginBottom:16 }}>📖</div>
          <div className="font-jakarta font-bold mb-8" style={{ fontSize:18 }}>No modules yet</div>
          <p className="text-sm text-muted">Your tutor hasn't published any modules yet. Check back soon!</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:780, margin:'0 auto' }}>
          {modules.map((mod, idx) => {
            const locked  = isModuleLocked(mod, idx);
            const prog    = progress[mod.id];
            const passed  = prog?.quiz_passed || false;
            const viewed  = prog?.module_viewed || false;
            const attempts = prog?.attempts || 0;

            return (
              <div key={mod.id} style={{ border:`2px solid ${passed ? '#6EE7B7' : locked ? '#E5E7EB' : tokens.primary}`, borderRadius:16, overflow:'hidden', background:'#fff', opacity: locked ? 0.6 : 1, transition:'all 0.2s' }}>
                {/* Module bar */}
                <div style={{ padding:'16px 20px', background: passed ? '#D1FAE5' : locked ? '#F9FAFB' : tokens.primaryLight, display:'flex', alignItems:'center', gap:14 }}>
                  {/* Number circle */}
                  <div style={{ width:44, height:44, borderRadius:'50%', flexShrink:0, background: passed ? tokens.success : locked ? '#E5E7EB' : tokens.primary, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {passed
                      ? <span style={{ fontSize:22 }}>✓</span>
                      : locked
                        ? <span style={{ fontSize:18 }}>🔒</span>
                        : <span style={{ color:'#fff', fontWeight:800, fontSize:18 }}>{idx + 1}</span>
                    }
                  </div>
                  <div style={{ flex:1 }}>
                    <div className="font-jakarta font-bold" style={{ fontSize:15, color: locked ? tokens.muted : tokens.dark }}>
                      Module {mod.module_number}: {mod.title}
                    </div>
                    <div className="flex items-center gap-8 mt-4">
                      <span style={{ fontSize:11, color:tokens.muted }}>{QUIZ_TYPE_LABELS[mod.quiz_type]}</span>
                      {passed && <span style={{ fontSize:11, fontWeight:700, color:'#065F46' }}>✓ Passed ({prog.quiz_score}%)</span>}
                      {!passed && viewed && attempts > 0 && <span style={{ fontSize:11, color:'#92400E' }}>Attempts: {attempts}/{mod.max_attempts}</span>}
                      {locked && <span style={{ fontSize:11, color:tokens.muted }}>Complete previous module first</span>}
                    </div>
                  </div>
                  {!locked && (
                    <div className="flex gap-8">
                      <button className="btn btn-sm" style={{ background: passed ? '#065F46' : tokens.primary, color:'#fff' }}
                        onClick={() => handleStartReading(mod)}>
                        {viewed ? '📖 Read Again' : '📖 Start Reading'}
                      </button>
                      {viewed && !passed && (
                        <button className="btn btn-sm" style={{ background:'#FFF7ED', color:'#92400E', border:'1px solid #FED7AA' }}
                          onClick={() => handleOpenQuiz(mod)}
                          disabled={attempts >= mod.max_attempts}>
                          {attempts >= mod.max_attempts ? 'No Attempts Left' : `Take Quiz (${attempts}/${mod.max_attempts})`}
                        </button>
                      )}
                      {passed && (
                        <button className="btn btn-sm" style={{ background:'#D1FAE5', color:'#065F46', border:'1px solid #6EE7B7' }}
                          onClick={() => handleOpenQuiz(mod)}>
                          View Results
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Content preview (visible when not locked) */}
                {!locked && (
                  <div style={{ padding:'14px 20px', borderTop:`1px solid ${tokens.border}` }}>
                    <p style={{ fontSize:13, color:tokens.muted, lineHeight:1.6, margin:0 }}>
                      {mod.content.substring(0, 200)}{mod.content.length > 200 ? '...' : ''}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Completion message */}
          {totalPassed === totalModules && totalModules > 0 && (
            <div style={{ background:'linear-gradient(135deg, #D1FAE5, #EFF6FF)', border:'2px solid #6EE7B7', borderRadius:16, padding:32, textAlign:'center' }}>
              <div style={{ fontSize:52, marginBottom:12 }}>🎓</div>
              <div className="font-jakarta font-extrabold mb-8" style={{ fontSize:22, color:'#065F46' }}>All Modules Completed!</div>
              <p style={{ fontSize:14, color:'#065F46' }}>{selectedStudent?.name} has completed all {totalModules} modules. Great job!</p>
            </div>
          )}
        </div>
      )}

      {/* ── Quiz Modal ── */}
      <Modal
        open={!!quizModal}
        onClose={() => { if (!submitting) { setQuizModal(null); setQuizResult(null); } }}
        title={`${QUIZ_TYPE_LABELS[quizModal?.quiz_type] || '📝 Quiz'} — ${quizModal?.title}`}
        footer={
          quizResult ? (
            <div className="flex gap-10" style={{ width:'100%' }}>
              <button className="btn btn-ghost" onClick={() => { setQuizModal(null); setQuizResult(null); }}>Close</button>
              {!quizResult.passed && (progress[quizModal?.id]?.attempts || 0) < (quizModal?.max_attempts || 10) && (
                <button className="btn btn-primary" onClick={() => { setAnswers({}); setQuizResult(null); setAnswerErrors(false); }}>
                  Retry Quiz
                </button>
              )}
            </div>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => setQuizModal(null)} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitQuiz} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
            </>
          )
        }
      >
        {quizModal && (
          <div>
            {/* Result screen */}
            {quizResult ? (
              <div style={{ textAlign:'center', padding:'16px 0' }}>
                <div style={{ fontSize:64, marginBottom:16 }}>{quizResult.passed ? '🎉' : '📝'}</div>
                <div className="font-jakarta font-extrabold mb-8" style={{ fontSize:24, color: quizResult.passed ? '#065F46' : '#DC2626' }}>
                  {quizResult.passed ? 'Quiz Passed!' : 'Not Passed Yet'}
                </div>
                <div style={{ fontSize:48, fontWeight:900, color: quizResult.passed ? tokens.success : '#F59E0B', marginBottom:8 }}>
                  {quizResult.score}%
                </div>
                <p style={{ fontSize:14, color:tokens.muted, marginBottom:20 }}>
                  {quizResult.correct} out of {quizResult.total} correct · Pass score: {quizModal.pass_score}%
                </p>
                {/* Score bar */}
                <div style={{ width:'100%', height:12, background:'#E5E7EB', borderRadius:6, overflow:'hidden', position:'relative', marginBottom:16 }}>
                  <div style={{ position:'absolute', left:`${quizModal.pass_score}%`, top:0, bottom:0, width:2, background:'#374151', zIndex:2 }} />
                  <div style={{ height:'100%', borderRadius:6, width:`${quizResult.score}%`, background: quizResult.passed ? `linear-gradient(90deg, ${tokens.success}, #4ADE80)` : `linear-gradient(90deg, #F87171, #F59E0B)`, transition:'width 1s' }} />
                </div>
                {quizResult.passed ? (
                  <div style={{ background:'#D1FAE5', borderRadius:10, padding:14, fontSize:14, color:'#065F46' }}>
                    🎊 Excellent! You can now proceed to the next module.
                  </div>
                ) : (
                  <div style={{ background:'#FEF9C3', borderRadius:10, padding:14, fontSize:14, color:'#92400E' }}>
                    Keep studying the module and try again.
                    Attempts remaining: {(quizModal.max_attempts) - (progress[quizModal.id]?.attempts || 0)}
                  </div>
                )}
              </div>
            ) : (
              /* Quiz questions */
              <div>
                <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'10px 14px', marginBottom:20, fontSize:13, color:'#1D4ED8' }}>
                  {questions.length} question{questions.length !== 1 ? 's' : ''} · Pass score: {quizModal.pass_score}% ·
                  Attempt {(progress[quizModal.id]?.attempts || 0) + 1} of {quizModal.max_attempts}
                </div>

                {questions.map((q, qi) => (
                  <div key={q.id} style={{ marginBottom:24 }}>
                    <div className="font-semibold mb-10" style={{ fontSize:14 }}>
                      {qi + 1}. {q.question_text}
                      {answerErrors && answers[qi] === undefined && (
                        <span style={{ fontSize:12, color:'#DC2626', marginLeft:8, fontWeight:400 }}>⚠ Please answer</span>
                      )}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {q.options.map((opt, oi) => {
                        const selected = answers[qi] === oi;
                        return (
                          <button key={oi} type="button"
                            onClick={() => setAnswers(a => ({ ...a, [qi]:oi }))}
                            style={{ padding:'12px 16px', borderRadius:10, cursor:'pointer', border:`2px solid ${selected ? tokens.primary : tokens.border}`, background: selected ? tokens.primaryLight : '#FAFAFA', color: selected ? tokens.primary : tokens.dark, textAlign:'left', fontSize:14, fontWeight: selected ? 600 : 400, transition:'all 0.15s', display:'flex', alignItems:'center', gap:12 }}>
                            <span style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, background: selected ? tokens.primary : '#E5E7EB', color: selected ? '#fff' : tokens.mid, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                              {String.fromCharCode(65 + oi)}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
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