import { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const DIFF_MAP = { easy: 'success', medium: 'warning', hard: 'danger' };

export default function QuestionBankPage() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({
    subject: 'mathematics', topic: '', difficulty: 'easy',
    question: '', optA: '', optB: '', optC: '', optD: '',
    correctIndex: null, // 0=A, 1=B, 2=C, 3=D
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fetchQuestions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('questions')
      .select('id, subject, topic, difficulty, question_text, options, correct_answer, status, created_at')
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false });
    setQuestions(data || []);
    setLoading(false);
  }, [user]);

  useState(() => { fetchQuestions(); }, []);

  const handleOpen = () => {
    setForm({ subject: 'mathematics', topic: '', difficulty: 'easy', question: '', optA: '', optB: '', optC: '', optD: '', correctIndex: null });
    setShowAdd(true);
  };

  const handleSubmit = async () => {
    const opts = [form.optA, form.optB, form.optC, form.optD];
    if (!form.topic.trim())    { alert('Please enter a topic.'); return; }
    if (!form.question.trim()) { alert('Please enter the question.'); return; }
    if (opts.some(o => !o.trim())) { alert('Please fill in all 4 options.'); return; }
    if (form.correctIndex === null) { alert('Please select the correct answer.'); return; }

    // Save correct_answer as the ACTUAL TEXT of the correct option
    const correctAnswerText = opts[form.correctIndex];

    setSaving(true);
    try {
      const { error } = await supabase.from('questions').insert({
        tutor_id:       user.id,
        subject:        form.subject,
        topic:          form.topic,
        difficulty:     form.difficulty,
        question_text:  form.question,
        options:        opts,          // stored as array ["optA text", "optB text", ...]
        correct_answer: correctAnswerText, // stored as the actual text, NOT "A" or "B"
        status:         'pending',
      });
      if (error) throw error;
      setShowAdd(false);
      await fetchQuestions();
    } catch (e) {
      alert('Failed to submit: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const opts = [form.optA, form.optB, form.optC, form.optD];
  const letters = ['A', 'B', 'C', 'D'];

  if (loading) return <Spinner dark size={32} />;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-24">
        <div>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Question Bank</h2>
          <p className="text-sm text-muted mt-4">Contribute questions used in student pre-assessments.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpen}>
          <Icon name="plus" size={14} /> Add Question
        </button>
      </div>

      <div className="card">
        {questions.length === 0 ? (
          <EmptyState icon="📋" title="No questions yet" description="Add your first question to the bank." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Subject</th>
                <th>Topic</th>
                <th>Difficulty</th>
                <th>Correct Answer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {questions.map(q => (
                <tr key={q.id}>
                  <td style={{ maxWidth: 280, fontSize: 13 }} className="truncate">{q.question_text}</td>
                  <td><Badge variant="info" style={{ textTransform: 'capitalize' }}>{q.subject}</Badge></td>
                  <td style={{ fontSize: 13 }}>{q.topic}</td>
                  <td><Badge variant={DIFF_MAP[q.difficulty]}>{q.difficulty}</Badge></td>
                  <td style={{ fontSize: 13, fontWeight: 600, color: tokens.success }}>{q.correct_answer}</td>
                  <td><Badge variant={q.status === 'approved' ? 'success' : q.status === 'rejected' ? 'danger' : 'warning'}>{q.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Question Modal */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: '#fff', borderRadius: 20,
            width: '100%', maxWidth: 560,
            maxHeight: '90vh', overflowY: 'auto',
            padding: 36,
          }}>
            <div className="flex items-center justify-between mb-24">
              <h3 className="font-jakarta font-bold" style={{ fontSize: 18 }}>Add Question</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: tokens.muted }}>×</button>
            </div>

            {/* Subject + Difficulty */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label className="form-label">Subject</label>
                <select className="select" value={form.subject} onChange={e => set('subject', e.target.value)}>
                  <option value="mathematics">Mathematics</option>
                  <option value="english">English</option>
                </select>
              </div>
              <div>
                <label className="form-label">Difficulty</label>
                <select className="select" value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Topic */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Topic</label>
              <input className="input" placeholder="e.g. Addition, Grammar, Fractions"
                value={form.topic} onChange={e => set('topic', e.target.value)} />
            </div>

            {/* Question */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Question</label>
              <textarea className="textarea" placeholder="Type the question here..."
                value={form.question} onChange={e => set('question', e.target.value)}
                style={{ minHeight: 80 }} />
            </div>

            {/* Options */}
            <div style={{ marginBottom: 8 }}>
              <label className="form-label">Options</label>
              <p className="text-xs text-muted mb-10">Fill in all 4 options, then click the correct one to mark it as the answer.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {letters.map((letter, idx) => {
                  const isCorrect = form.correctIndex === idx;
                  const optVal    = opts[idx];
                  return (
                    <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Letter badge — click to mark as correct */}
                      <button
                        type="button"
                        onClick={() => optVal.trim() && set('correctIndex', idx)}
                        title={optVal.trim() ? `Mark ${letter} as correct answer` : 'Fill in the option first'}
                        style={{
                          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${isCorrect ? tokens.success : tokens.border}`,
                          background: isCorrect ? tokens.success : '#F9FAFB',
                          color: isCorrect ? '#fff' : tokens.mid,
                          fontWeight: 800, fontSize: 14, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        {isCorrect ? '✓' : letter}
                      </button>

                      {/* Option input */}
                      <input
                        className="input"
                        placeholder={`Option ${letter}`}
                        value={opts[idx]}
                        onChange={e => {
                          set(['optA','optB','optC','optD'][idx], e.target.value);
                          // If this option is currently selected as correct but cleared, deselect
                          if (!e.target.value.trim() && form.correctIndex === idx) {
                            set('correctIndex', null);
                          }
                        }}
                        style={{
                          flex: 1,
                          border: `1.5px solid ${isCorrect ? tokens.success : tokens.border}`,
                          background: isCorrect ? '#F0FDF4' : '#fff',
                        }}
                      />

                      {isCorrect && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: tokens.success, whiteSpace: 'nowrap' }}>
                          ✓ Correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Correct answer indicator */}
            {form.correctIndex !== null && (
              <div style={{
                marginTop: 12, padding: '10px 14px', borderRadius: 10,
                background: '#D1FAE5', border: '1px solid #6EE7B7',
                fontSize: 13, color: '#065F46', fontWeight: 600,
              }}>
                ✅ Correct answer: <strong>{opts[form.correctIndex]}</strong> (Option {letters[form.correctIndex]})
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-10 mt-24">
              <button className="btn btn-ghost btn-full" onClick={() => setShowAdd(false)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={saving}>
                {saving ? <Spinner /> : <><Icon name="check" size={13} /> Submit Question</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}