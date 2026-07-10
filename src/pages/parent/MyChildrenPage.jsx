import { useState } from 'react';
import Avatar from '../../components/ui/Avatar';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { useStudents } from '../../hooks/useStudents';
import { supabase } from '../../lib/supabase';
import tokens from '../../lib/tokens';

const LEVELS = [
  {
    value: 'primary',
    label: 'Primary Level',
    grades: 'Grade 1–3',
    desc: 'Focuses on basic skills such as reading, writing, mathematics, and foundational knowledge.',
    color: '#059669',
    bg: '#D1FAE5',
    border: '#6EE7B7',
    icon: '🌱',
  },
  {
    value: 'intermediate',
    label: 'Intermediate Level',
    grades: 'Grade 4–6',
    desc: 'Focuses on more advanced concepts, critical thinking, problem-solving, and preparation for junior high school.',
    color: '#2563EB',
    bg: '#DBEAFE',
    border: '#93C5FD',
    icon: '🚀',
  },
];

const PASS_SCORE = 70; // percent to pass
const QUESTIONS_PER_ASSESSMENT = 10;

function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg = type === 'error' ? '#FEE2E2' : '#D1FAE5';
  const color = type === 'error' ? '#DC2626' : '#065F46';
  return (
    <div style={{ position:'fixed', top:24, right:24, zIndex:99999, background:bg, borderRadius:12, padding:'14px 20px', fontSize:14, color, fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,.12)', display:'flex', alignItems:'center', gap:10, maxWidth:380 }}>
      <span>{type === 'error' ? '❌' : '✅'}</span>
      <span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color, fontSize:16, padding:0 }}>✕</button>
    </div>
  );
}

export default function MyChildrenPage() {
  const { students, loading, addStudent, refresh } = useStudents();

  const [toast,        setToast]        = useState(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [form,         setForm]         = useState({ name:'', grade_level:'2', notes:'' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Edit child state
  const [editChild,    setEditChild]    = useState(null);
  const [editForm,     setEditForm]     = useState({ name:'', grade_level:'2', notes:'' });
  const [savingEdit,   setSavingEdit]   = useState(false);
  const setE = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  // Pre-Assessment state
  const [assessStudent,   setAssessStudent]   = useState(null); // student object
  const [assessStep,      setAssessStep]      = useState('level'); // 'level' | 'quiz' | 'result'
  const [selectedLevel,   setSelectedLevel]   = useState(null);
  const [questions,       setQuestions]       = useState([]);
  const [currentQ,        setCurrentQ]        = useState(0);
  const [answers,         setAnswers]         = useState({});
  const [quizResult,      setQuizResult]      = useState(null);
  const [loadingAssess,   setLoadingAssess]   = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [answerError,     setAnswerError]     = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) { showToast('Please enter the child\'s name.', 'error'); return; }
    setSaving(true);
    try {
      await addStudent({ name:form.name, grade_level:parseInt(form.grade_level), notes:form.notes });
      setShowAdd(false);
      setForm({ name:'', grade_level:'2', notes:'' });
      showToast('Child profile added!');
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setSaving(false); }
  };

  const handleEditSave = async () => {
    if (!editForm.name.trim()) { showToast('Please enter the child\'s name.', 'error'); return; }
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('students').update({
        name:        editForm.name,
        grade_level: parseInt(editForm.grade_level),
        notes:       editForm.notes || null,
      }).eq('id', editChild.id);
      if (error) throw error;
      setEditChild(null);
      if (refresh) await refresh();
      showToast('Child profile updated!');
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setSavingEdit(false); }
  };

  // Determine level from grade automatically
  const getLevelFromGrade = (grade) => {
    const g = parseInt(grade);
    if (g >= 1 && g <= 3) return LEVELS.find(l => l.value === 'primary');
    return LEVELS.find(l => l.value === 'intermediate');
  };

  // Start assessment — auto-detect level from grade, go straight to quiz
  const startAssessment = async (student) => {
    setAssessStudent(student);
    setAnswers({});
    setCurrentQ(0);
    setQuizResult(null);
    setAnswerError(false);

    const level = getLevelFromGrade(student.grade_level);
    setSelectedLevel(level);
    setLoadingAssess(true);
    setAssessStep('quiz');

    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('level', level.value)
        .eq('status', 'approved')
        .limit(50); // fetch more then shuffle

      if (error) throw error;
      if (!data || data.length === 0) {
        showToast(`No approved questions available for ${level.label} yet. Please ask a tutor to add questions to the Question Bank.`, 'error');
        setAssessStudent(null);
        setAssessStep('level');
        setLoadingAssess(false);
        return;
      }

      // Shuffle and limit to QUESTIONS_PER_ASSESSMENT
      const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_ASSESSMENT);
      setQuestions(shuffled);
    } catch (e) {
      showToast(e.message, 'error');
      setAssessStudent(null);
    } finally { setLoadingAssess(false); }
  };

  const handleAnswer = (questionIdx, answer) => {
    setAnswers(a => ({ ...a, [questionIdx]: answer }));
    setAnswerError(false);
  };

  const handleSubmitQuiz = async () => {
    if (answers[currentQ] === undefined) { setAnswerError(true); return; }
    if (currentQ < questions.length - 1) {
      setCurrentQ(q => q + 1);
      setAnswerError(false);
      return;
    }

    // Submit
    setSubmitting(true);
    try {
      let correct = 0;
      questions.forEach((q, i) => {
        const opts = q.options;
        const correctLetter = q.correct_answer; // 'A', 'B', 'C', 'D'
        const selectedLetter = answers[i];
        if (selectedLetter === correctLetter) correct++;
      });

      const score = Math.round((correct / questions.length) * 100);
      const passed = score >= PASS_SCORE;

      // Save result to student profile
      const { error } = await supabase.from('students').update({
        assessment_level:        selectedLevel.value,
        assessment_score:        score,
        assessment_completed_at: new Date().toISOString(),
        assessment_results:      { level:selectedLevel.value, score, passed, correct, total:questions.length },
      }).eq('id', assessStudent.id);

      if (error) throw error;

      setQuizResult({ score, passed, correct, total:questions.length });
      setAssessStep('result');
      if (refresh) await refresh();
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setSubmitting(false); }
  };

  if (loading) return <Spinner dark size={32} />;

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />

      <div className="flex items-center justify-between mb-24">
        <div>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize:22 }}>My Children</h2>
          <p className="text-sm text-muted mt-4">Manage your children's profiles and learning assessments.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={14} /> Add Child
        </button>
      </div>

      {students.length === 0 ? (
        <div className="card">
          <EmptyState icon="👦" title="No children yet" description="Add your first child profile to get started with LearnBridge."
            action={<button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={14} /> Add Child</button>} />
        </div>
      ) : (
        <div className="grid-2">
          {students.map((s, i) => {
            const assessed = !!s.assessment_results;
            const level = LEVELS.find(l => l.value === s.assessment_level);
            return (
              <div key={s.id} className="card p-24">
                <div className="flex items-center justify-between mb-16">
                  <div className="flex items-center gap-12">
                    <Avatar name={s.name} size={44} colorIndex={i} />
                    <div>
                      <div className="font-jakarta font-bold" style={{ fontSize:16 }}>{s.name}</div>
                      <div className="text-sm text-muted">Grade {s.grade_level}</div>
                    </div>
                  </div>
                  <span className={`badge ${assessed ? 'badge-success' : 'badge-warning'}`}>
                    {assessed ? 'Assessed' : 'Pending Assessment'}
                  </span>
                </div>

                {/* Assessment result */}
                {assessed && level && (
                  <div style={{ background:level.bg, border:`1px solid ${level.border}`, borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:18 }}>{level.icon}</span>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:level.color }}>{level.label} · {level.grades}</div>
                        <div style={{ fontSize:11, color:level.color, opacity:0.8 }}>Score: {s.assessment_score}% · {s.assessment_results?.passed ? 'Passed ✓' : 'Needs improvement'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {s.notes && <p className="text-sm text-muted mb-16" style={{ lineHeight:1.5 }}>{s.notes}</p>}

                <div className="flex gap-8">
                  <button className="btn btn-primary btn-sm" onClick={() => startAssessment(s)}>
                    <Icon name="clipboard" size={12} /> {assessed ? 'Re-Assess' : 'Assess'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditChild(s); setEditForm({ name:s.name, grade_level:String(s.grade_level), notes:s.notes||'' }); }}>
                    <Icon name="edit" size={12} /> Edit
                  </button>

                </div>
              </div>
            );
          })}

          {/* Add placeholder */}
          <div className="card p-24" onClick={() => setShowAdd(true)}
            style={{ cursor:'pointer', border:`2px dashed ${tokens.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, minHeight:200 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:tokens.primaryLight, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name="plus" size={22} color={tokens.primary} />
            </div>
            <div style={{ textAlign:'center' }}>
              <div className="font-semibold text-mid">Add Another Child</div>
              <div className="text-xs text-muted mt-4">Register a new learner profile</div>
            </div>
          </div>
        </div>
      )}

      {/* Add Child Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Child Profile"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !form.name}>
            {saving ? <Spinner /> : <><Icon name="plus" size={14} /> Add Child</>}
          </button>
        </>}>
        <FormGroup label="Child's Full Name">
          <input className="input" placeholder="e.g. Maria Santos" value={form.name} onChange={e => set('name', e.target.value)} />
        </FormGroup>
        <FormGroup label="Grade Level">
          <select className="select" value={form.grade_level} onChange={e => set('grade_level', e.target.value)}>
            {[1,2,3,4,5,6].map(g => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Notes (Optional)" hint="Special learning needs or context for the tutor.">
          <textarea className="textarea" placeholder="e.g. Struggles with word problems..." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </FormGroup>
      </Modal>

      {/* Edit Child Modal */}
      <Modal open={!!editChild} onClose={() => setEditChild(null)} title="✏️ Edit Child Profile"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setEditChild(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEditSave} disabled={savingEdit}>
            {savingEdit ? <Spinner /> : 'Save Changes'}
          </button>
        </>}>
        <FormGroup label="Child's Full Name">
          <input className="input" placeholder="e.g. Maria Santos" value={editForm.name} onChange={e => setE('name', e.target.value)} />
        </FormGroup>
        <FormGroup label="Grade Level">
          <select className="select" value={editForm.grade_level} onChange={e => setE('grade_level', e.target.value)}>
            {[1,2,3,4,5,6].map(g => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Notes (Optional)">
          <textarea className="textarea" placeholder="e.g. Struggles with word problems..." value={editForm.notes} onChange={e => setE('notes', e.target.value)} />
        </FormGroup>
      </Modal>

      {/* Pre-Assessment Modal */}
      <Modal
        open={!!assessStudent}
        onClose={() => { if (assessStep !== 'quiz') setAssessStudent(null); }}
        title={
          loadingAssess ? `📋 Loading Assessment...` :
          assessStep === 'quiz'   ? `${selectedLevel?.icon} ${selectedLevel?.label} — Grade ${assessStudent?.grade_level}` :
          '🎉 Assessment Complete!'
        }
        footer={
          assessStep === 'result' ? (
            <button className="btn btn-primary" onClick={() => setAssessStudent(null)}>Done</button>
          ) : assessStep === 'level' ? (
            <button className="btn btn-ghost" onClick={() => setAssessStudent(null)}>Cancel</button>
          ) : null
        }
      >


        {/* Loading */}
        {assessStep === 'quiz' && loadingAssess && (
          <div style={{ textAlign:'center', padding:'40px 0' }}>
            <Spinner dark size={32} />
            <p className="text-sm text-muted mt-12">Loading questions for {selectedLevel?.label}...</p>
          </div>
        )}

        {/* QUIZ */}
        {assessStep === 'quiz' && !loadingAssess && questions[currentQ] && (
          <div>
            {/* Progress */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ flex:1, height:6, background:'#E5E7EB', borderRadius:3, overflow:'hidden', marginRight:16 }}>
                <div style={{ height:'100%', borderRadius:3, width:`${((currentQ+1)/questions.length)*100}%`, background:`linear-gradient(90deg,${selectedLevel?.color},${tokens.primary})`, transition:'width 0.3s' }} />
              </div>
              <span style={{ fontSize:12, color:tokens.muted, fontWeight:600, whiteSpace:'nowrap' }}>
                {currentQ+1} / {questions.length}
              </span>
            </div>

            <div style={{ marginBottom:4 }}>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, background:selectedLevel?.bg, color:selectedLevel?.color }}>
                {selectedLevel?.icon} {selectedLevel?.label}
              </span>
              <span style={{ fontSize:11, color:tokens.muted, marginLeft:8 }}>{questions[currentQ].topic}</span>
            </div>

            <h3 style={{ fontSize:16, fontWeight:700, lineHeight:1.6, margin:'12px 0 16px' }}>
              {questions[currentQ].question_text}
            </h3>

            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
              {['A','B','C','D'].map((letter, idx) => {
                const opts = questions[currentQ].options;
                // Handle array format ["opt1","opt2","opt3","opt4"]
                // and object format {A:"opt1", B:"opt2", C:"opt3", D:"opt4"}
                let optText = '';
                if (Array.isArray(opts)) {
                  optText = opts[idx] || '';
                } else if (opts && typeof opts === 'object') {
                  optText = opts[letter] || opts[letter.toLowerCase()] || opts[idx] || '';
                }
                if (!optText) return null;
                const selected = answers[currentQ] === letter;
                return (
                  <button key={letter} type="button"
                    onClick={() => handleAnswer(currentQ, letter)}
                    style={{ padding:'13px 16px', borderRadius:10, cursor:'pointer', border:`2px solid ${selected?selectedLevel?.color:tokens.border}`, background:selected?selectedLevel?.bg:'#FAFAFA', color:selected?selectedLevel?.color:tokens.dark, textAlign:'left', fontSize:14, fontWeight:selected?600:400, transition:'all 0.15s', display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, background:selected?selectedLevel?.color:'#E5E7EB', color:selected?'#fff':tokens.mid, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                      {letter}
                    </span>
                    {optText}
                  </button>
                );
              })}
            </div>

            {answerError && (
              <div style={{ background:'#FEE2E2', border:'1px solid #FCA5A5', borderRadius:8, padding:'8px 14px', fontSize:13, color:'#DC2626', fontWeight:600, marginBottom:12 }}>
                ⚠️ Please select an answer before continuing.
              </div>
            )}

            <button className="btn btn-primary btn-full btn-lg" onClick={handleSubmitQuiz} disabled={submitting}>
              {submitting ? 'Submitting...' : currentQ < questions.length - 1 ? 'Next →' : 'Submit Assessment'}
            </button>
          </div>
        )}

        {/* RESULT */}
        {assessStep === 'result' && quizResult && (
          <div style={{ textAlign:'center', padding:'8px 0' }}>
            <div style={{ fontSize:64, marginBottom:16 }}>{quizResult.passed ? '🎉' : '📚'}</div>
            <div className="font-jakarta font-extrabold mb-8" style={{ fontSize:24, color:quizResult.passed?'#065F46':'#D97706' }}>
              {quizResult.passed ? 'Assessment Passed!' : 'Keep Practicing!'}
            </div>
            <div style={{ fontSize:52, fontWeight:900, color:quizResult.passed?selectedLevel?.color:'#F59E0B', marginBottom:8 }}>
              {quizResult.score}%
            </div>
            <p style={{ fontSize:14, color:tokens.muted, marginBottom:20 }}>
              {quizResult.correct} of {quizResult.total} correct
            </p>

            {/* Score bar */}
            <div style={{ width:'100%', height:12, background:'#E5E7EB', borderRadius:6, overflow:'hidden', position:'relative', marginBottom:8 }}>
              <div style={{ position:'absolute', left:`${PASS_SCORE}%`, top:0, bottom:0, width:2, background:'#374151', zIndex:2 }} />
              <div style={{ height:'100%', borderRadius:6, width:`${quizResult.score}%`, background:quizResult.passed?`linear-gradient(90deg,${selectedLevel?.color},#4ADE80)`:'linear-gradient(90deg,#F87171,#F59E0B)', transition:'width 1s' }} />
            </div>
            <div style={{ fontSize:11, color:tokens.muted, marginBottom:24 }}>{PASS_SCORE}% pass mark</div>

            {/* Level badge */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'12px 20px', borderRadius:12, background:selectedLevel?.bg, border:`1px solid ${selectedLevel?.border}`, marginBottom:16 }}>
              <span style={{ fontSize:24 }}>{selectedLevel?.icon}</span>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:14, fontWeight:700, color:selectedLevel?.color }}>{selectedLevel?.label}</div>
                <div style={{ fontSize:12, color:selectedLevel?.color, opacity:0.7 }}>{selectedLevel?.grades}</div>
              </div>
            </div>

            <p style={{ fontSize:13, color:tokens.muted, lineHeight:1.6 }}>
              {quizResult.passed
                ? `${assessStudent?.name} is ready for ${selectedLevel?.label} content! This will help tutors tailor their teaching approach.`
                : `${assessStudent?.name} may need more practice. You can re-take the assessment anytime.`}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}