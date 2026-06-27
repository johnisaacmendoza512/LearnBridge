import { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStudents } from '../../hooks/useStudents';
import { supabase } from '../../lib/supabase';
import FormGroup from '../../components/ui/FormGroup';
import Modal from '../../components/ui/Modal';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import tokens from '../../lib/tokens';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function analyzeResults(questions, answers) {
  const byTopic = {};
  questions.forEach((q, i) => {
    if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0 };
    byTopic[q.topic].total++;
    const userAnswer    = answers[i];
    const correctAnswer = q.correct_answer;
    if (userAnswer !== undefined &&
        String(userAnswer).trim() === String(correctAnswer).trim()) {
      byTopic[q.topic].correct++;
    }
  });

  const strong = [], weak = [];
  Object.entries(byTopic).forEach(([topic, { correct, total }]) => {
    const pct = (correct / total) * 100;
    if (pct >= 70) strong.push(topic);
    else           weak.push(topic);
  });

  const totalCorrect = questions.filter((q, i) =>
    String(answers[i] ?? '').trim() === String(q.correct_answer ?? '').trim()
  ).length;

  const score = questions.length > 0
    ? Math.round((totalCorrect / questions.length) * 100)
    : 0;

  return { strong, weak, score, totalCorrect, total: questions.length };
}

const PERF_LABEL = (score) => {
  if (score >= 80) return { label: 'Advanced',      color: '#16A34A', bg: '#D1FAE5' };
  if (score >= 60) return { label: 'Proficient',    color: '#CA8A04', bg: '#FEF9C3' };
  if (score >= 40) return { label: 'Developing',    color: '#EA580C', bg: '#FFF7ED' };
  return             { label: 'Needs Support', color: '#DC2626', bg: '#FEE2E2' };
};

const SUBJECTS = ['english', 'mathematics'];

export default function MyChildrenPage() {
  const { user } = useAuth();
  const { students, loading, refresh } = useStudents();

  const [uiStep,      setUiStep]      = useState('none');
  const [childForm,   setChildForm]   = useState({ name: '', grade_level: 3, notes: '' });
  const [questions,   setQuestions]   = useState({ english: [], mathematics: [] });
  const [currentSubj, setCurrentSubj] = useState('english');
  const [currentQ,    setCurrentQ]    = useState(0);
  const [answers,     setAnswers]     = useState({ english: {}, mathematics: {} });
  const [selected,    setSelected]    = useState(null);
  const [results,     setResults]     = useState(null);
  const [loadingQ,    setLoadingQ]    = useState(false);
  const [saving,      setSaving]      = useState(false);

  const setF = (k, v) => setChildForm(f => ({ ...f, [k]: v }));

  // ── Remove child ───────────────────────────────────────────────────
  const handleRemoveChild = async (studentId, studentName) => {
    if (!window.confirm(`Remove ${studentName} from your children? This cannot be undone.`)) return;
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) { alert(error.message); return; }
    await refresh();
  };

  const fetchQuestions = useCallback(async () => {
    setLoadingQ(true);
    const fetched = { english: [], mathematics: [] };
    for (const subj of SUBJECTS) {
      const { data } = await supabase
        .from('questions')
        .select('id, subject, topic, question_text, options, correct_answer, difficulty')
        .eq('subject', subj)
        .eq('status', 'approved')
        .limit(50);
      fetched[subj] = shuffle(data || []).slice(0, 10);
    }
    setQuestions(fetched);
    setLoadingQ(false);
  }, []);

  const handleOpenForm = () => {
    setChildForm({ name: '', grade_level: 3, notes: '' });
    setUiStep('form');
  };

  const handleStartAssessment = async () => {
    if (!childForm.name.trim()) { alert("Please enter your child's name."); return; }
    await fetchQuestions();
    setCurrentSubj('english');
    setCurrentQ(0);
    setAnswers({ english: {}, mathematics: {} });
    setSelected(null);
    setResults(null);
    setUiStep('assessing_english');
  };

  const handleNext = () => {
    if (selected === null) { alert('Please select an answer.'); return; }

    const subj = currentSubj;
    const qs   = questions[subj];

    const updatedAnswers = {
      ...answers,
      [subj]: { ...answers[subj], [currentQ]: selected },
    };
    setAnswers(updatedAnswers);
    setSelected(null);

    if (currentQ < qs.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      if (subj === 'english') {
        setCurrentSubj('mathematics');
        setCurrentQ(0);
        setSelected(null);
        setUiStep('assessing_mathematics');
      } else {
        const engResult  = analyzeResults(questions.english,    updatedAnswers.english);
        const mathResult = analyzeResults(questions.mathematics, updatedAnswers.mathematics);
        setResults({ english: engResult, mathematics: mathResult });
        setUiStep('results');
      }
    }
  };

  const handleSaveChild = async () => {
    if (!results) return;
    setSaving(true);
    try {
      const weaknesses = [
        ...results.english.weak.map(t => `English: ${t}`),
        ...results.mathematics.weak.map(t => `Math: ${t}`),
      ];
      const strengths = [
        ...results.english.strong.map(t => `English: ${t}`),
        ...results.mathematics.strong.map(t => `Math: ${t}`),
      ];

      const { error } = await supabase.from('students').insert({
        parent_id:   user.id,
        name:        childForm.name,
        grade_level: Number(childForm.grade_level),
        notes:       childForm.notes || null,
        assessment_results: {
          english:     { score: results.english.score,     strong: results.english.strong,     weak: results.english.weak     },
          mathematics: { score: results.mathematics.score, strong: results.mathematics.strong, weak: results.mathematics.weak },
          completedAt: new Date().toISOString(),
          weaknesses,
          strengths,
          summary: weaknesses.length === 0
            ? 'No major weaknesses detected.'
            : `Needs improvement in: ${weaknesses.join(', ')}.`,
        },
      });

      if (error) throw error;
      await refresh();
      setUiStep('none');
    } catch (e) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetFlow = () => {
    setUiStep('none');
    setResults(null);
    setSelected(null);
    setCurrentQ(0);
  };

  if (loading) return <Spinner dark size={32} />;

  const activeSubj  = currentSubj;
  const activeQs    = questions[activeSubj] || [];
  const activeQ     = activeQs[currentQ];
  const isAssessing = uiStep === 'assessing_english' || uiStep === 'assessing_mathematics';

  const parseOptions = (opts) => {
    if (!opts) return [];
    if (Array.isArray(opts)) return opts;
    if (typeof opts === 'object') return Object.values(opts);
    return [];
  };

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-24">
        <div>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>My Children</h2>
          <p className="text-sm text-muted mt-4">Manage your children's profiles and learning progress.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenForm}>
          <Icon name="plus" size={14} /> Add Child
        </button>
      </div>

      {students.length === 0 ? (
        <div className="card">
          <EmptyState icon="👧" title="No children added yet"
            description="Add your child's profile to get started with finding the right tutor." />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {students.map((s, i) => {
            const ar   = s.assessment_results;
            const eng  = ar?.english;
            const math = ar?.mathematics;
            return (
              <div key={s.id} className="card p-24">
                <div className="flex items-center gap-16 mb-16">
                  <Avatar name={s.name} size={48} colorIndex={i} />
                  <div>
                    <div className="font-jakarta font-bold" style={{ fontSize: 17 }}>{s.name}</div>
                    <div className="text-sm text-muted">Grade {s.grade_level}</div>
                    {s.notes && <div className="text-xs text-muted mt-2">{s.notes}</div>}
                  </div>

                  {/* Pre-assessed badge + Remove button */}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {ar && (
                      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#D1FAE5', color: '#065F46' }}>
                        ✓ Pre-assessed
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveChild(s.id, s.name)}
                      style={{
                        padding: '5px 12px', borderRadius: 8,
                        border: '1.5px solid #FCA5A5',
                        background: '#FFF5F5', color: '#DC2626',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Icon name="trash" size={12} color="#DC2626" /> Remove
                    </button>
                  </div>
                </div>

                {ar && (
                  <div style={{ borderTop: `1px solid ${tokens.border}`, paddingTop: 16 }}>
                    <div className="font-semibold mb-10" style={{ fontSize: 13 }}>Assessment Results</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[['english', 'English', eng], ['mathematics', 'Mathematics', math]].map(([key, label, res]) => {
                        if (!res) return null;
                        const perf = PERF_LABEL(res.score);
                        return (
                          <div key={key} style={{ background: '#F9FAFB', borderRadius: 10, padding: 14 }}>
                            <div className="flex items-center justify-between mb-8">
                              <span className="font-semibold" style={{ fontSize: 13 }}>{label}</span>
                              <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: perf.bg, color: perf.color }}>
                                {res.score}% · {perf.label}
                              </span>
                            </div>
                            {res.weak?.length > 0 && (
                              <div className="text-xs" style={{ color: '#DC2626', marginBottom: 4 }}>⚠️ Weakness: {res.weak.join(', ')}</div>
                            )}
                            {res.strong?.length > 0 && (
                              <div className="text-xs" style={{ color: '#16A34A' }}>✓ Strong in: {res.strong.join(', ')}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {ar.summary && (
                      <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 12, color: '#92400E' }}>
                        📋 {ar.summary}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* STEP 1 — Child form */}
      <Modal open={uiStep === 'form'} onClose={resetFlow} title="Add Child Profile"
        footer={<>
          <button className="btn btn-ghost" onClick={resetFlow}>Cancel</button>
          <button className="btn btn-primary" onClick={handleStartAssessment}>
            <Icon name="clipboard" size={13} /> Next: Pre-Assessment →
          </button>
        </>}
      >
        <div style={{ background: tokens.primaryLight, border: `1px solid ${tokens.primary}30`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: tokens.primary, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Icon name="alertCircle" size={14} color={tokens.primary} />
          <span>After filling in your child's details, they will take a short <strong>pre-assessment</strong> (English + Mathematics) to help match them with the right tutor.</span>
        </div>
        <FormGroup label="Child's Full Name">
          <input className="input" placeholder="e.g. Maria Santos" value={childForm.name} onChange={e => setF('name', e.target.value)} />
        </FormGroup>
        <FormGroup label="Grade Level">
          <select className="select" value={childForm.grade_level} onChange={e => setF('grade_level', e.target.value)}>
            {[2,3,4,5,6].map(g => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Notes (Optional)" hint="Special learning needs or context for the tutor.">
          <textarea className="textarea" placeholder="e.g. Struggles with word problems..." value={childForm.notes} onChange={e => setF('notes', e.target.value)} />
        </FormGroup>
      </Modal>

      {/* STEP 2 — Assessment */}
      {isAssessing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 36 }}>
            {loadingQ ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spinner dark size={32} />
                <p className="text-sm text-muted mt-16">Loading assessment questions...</p>
              </div>
            ) : activeQs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
                <p className="font-semibold mb-8">No questions available yet</p>
                <p className="text-sm text-muted mb-20">The question bank for {activeSubj} doesn't have approved questions yet.</p>
                <div className="flex gap-8" style={{ justifyContent: 'center' }}>
                  {activeSubj === 'english' ? (
                    <button className="btn btn-primary" onClick={() => { setCurrentSubj('mathematics'); setCurrentQ(0); setUiStep('assessing_mathematics'); }}>
                      Skip to Math →
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => {
                      supabase.from('students').insert({ parent_id: user.id, name: childForm.name, grade_level: Number(childForm.grade_level), notes: childForm.notes || null })
                        .then(() => { refresh(); resetFlow(); });
                    }}>
                      Save Without Assessment
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-20">
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: activeSubj === 'english' ? '#EFF6FF' : '#F0FDF4', color: activeSubj === 'english' ? '#1D4ED8' : '#15803D' }}>
                      {activeSubj === 'english' ? '📖' : '🔢'} {activeSubj === 'english' ? 'English' : 'Mathematics'} Assessment
                    </div>
                    <div className="text-xs text-muted mt-4">Question {currentQ + 1} of {activeQs.length} · {activeSubj === 'english' ? 'Math next' : 'Last subject'}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tokens.primary, background: tokens.primaryLight, padding: '4px 12px', borderRadius: 20 }}>
                    {childForm.name}
                  </div>
                </div>

                <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, marginBottom: 24, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${((currentQ + 1) / activeQs.length) * 100}%`, background: activeSubj === 'english' ? 'linear-gradient(90deg,#3B82F6,#6366F1)' : 'linear-gradient(90deg,#10B981,#059669)', transition: 'width 0.3s' }} />
                </div>

                <div className="flex gap-8 mb-24">
                  {SUBJECTS.map(s => {
                    const isDone   = s === 'english' && activeSubj === 'mathematics';
                    const isActive = s === activeSubj;
                    return (
                      <div key={s} style={{ flex: 1, padding: '8px 12px', borderRadius: 10, textAlign: 'center', border: `1.5px solid ${isActive ? tokens.primary : isDone ? tokens.success : tokens.border}`, background: isActive ? tokens.primaryLight : isDone ? '#D1FAE5' : '#F9FAFB', fontSize: 12, fontWeight: 700, color: isActive ? tokens.primary : isDone ? '#065F46' : tokens.muted }}>
                        {isDone ? '✓ ' : isActive ? '● ' : '○ '}{s.charAt(0).toUpperCase() + s.slice(1)}
                      </div>
                    );
                  })}
                </div>

                {activeQ && (
                  <>
                    <div style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 6, background: '#F3F4F6', fontSize: 11, fontWeight: 700, color: tokens.muted, marginBottom: 12, textTransform: 'capitalize' }}>
                      {activeQ.topic} · {activeQ.difficulty}
                    </div>

                    <div className="font-jakarta font-bold mb-20" style={{ fontSize: 17, lineHeight: 1.5, color: tokens.dark }}>
                      {activeQ.question_text}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                      {parseOptions(activeQ.options).map((opt, idx) => {
                        const letter   = ['A','B','C','D'][idx];
                        const isChosen = selected === opt;
                        return (
                          <button key={idx} onClick={() => setSelected(opt)}
                            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', padding: '14px 18px', borderRadius: 12, border: `2px solid ${isChosen ? tokens.primary : tokens.border}`, background: isChosen ? tokens.primaryLight : '#FAFAFA', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s' }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: isChosen ? tokens.primary : '#E5E7EB', color: isChosen ? '#fff' : tokens.mid, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                              {letter}
                            </div>
                            <span style={{ fontSize: 14, color: isChosen ? tokens.primary : tokens.dark, fontWeight: isChosen ? 600 : 400 }}>
                              {opt}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button className="btn btn-primary btn-full btn-lg" onClick={handleNext} disabled={selected === null}>
                      {currentQ < activeQs.length - 1 ? 'Next Question →' : activeSubj === 'english' ? 'Next: Mathematics Assessment →' : 'Finish Assessment ✓'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP 3 — Results */}
      {uiStep === 'results' && results && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 36 }}>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📊</div>
              <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Assessment Complete!</h2>
              <p className="text-sm text-muted mt-4">Here are <strong>{childForm.name}</strong>'s results for Grade {childForm.grade_level}</p>
            </div>

            {SUBJECTS.map(subj => {
              const res   = results[subj];
              const perf  = PERF_LABEL(res.score);
              const label = subj === 'english' ? '📖 English' : '🔢 Mathematics';
              return (
                <div key={subj} style={{ border: `1px solid ${tokens.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                  <div className="flex items-center justify-between mb-12">
                    <span className="font-jakarta font-bold" style={{ fontSize: 15 }}>{label}</span>
                    <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: perf.bg, color: perf.color }}>
                      {res.score}% — {perf.label}
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, width: `${res.score}%`, background: perf.color, transition: 'width 0.6s' }} />
                  </div>
                  <div className="text-xs text-muted mb-10">{res.totalCorrect} out of {res.total} correct</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {res.strong.length > 0 && (
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#D1FAE5', fontSize: 12, color: '#065F46' }}>
                        ✅ <strong>Strong:</strong> {res.strong.join(' · ')}
                      </div>
                    )}
                    {res.weak.length > 0 && (
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FEE2E2', fontSize: 12, color: '#DC2626' }}>
                        ⚠️ <strong>Needs work:</strong> {res.weak.join(' · ')}
                      </div>
                    )}
                    {res.weak.length === 0 && res.strong.length === 0 && (
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F3F4F6', fontSize: 12, color: tokens.muted }}>
                        Not enough data to determine topics — more questions needed in the bank.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div style={{ background: tokens.primaryLight, border: `1px solid ${tokens.primary}30`, borderRadius: 12, padding: 16, marginBottom: 24, fontSize: 13, color: tokens.primary }}>
              <div className="font-semibold mb-6">📋 Summary for tutors</div>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                {[...results.english.weak.map(t => `English (${t})`), ...results.mathematics.weak.map(t => `Math (${t})`)].length === 0
                  ? `${childForm.name} shows strong performance across all tested topics.`
                  : `${childForm.name} needs improvement in: ${[...results.english.weak.map(t => `English (${t})`), ...results.mathematics.weak.map(t => `Math (${t})`)].join(', ')}.`
                }
              </p>
            </div>

            <button className="btn btn-primary btn-full btn-lg" onClick={handleSaveChild} disabled={saving}>
              {saving ? <Spinner /> : <><Icon name="check" size={14} /> Save {childForm.name}'s Profile</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}