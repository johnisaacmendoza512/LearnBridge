import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const LEVELS = [
  {
    value: 'primary',
    label: 'Primary Level',
    grades: 'Grade 1–3',
    desc: 'Basic skills: reading, writing, mathematics, foundational knowledge',
    color: '#059669',
    bg: '#D1FAE5',
    icon: '🌱',
  },
  {
    value: 'intermediate',
    label: 'Intermediate Level',
    grades: 'Grade 4–6',
    desc: 'Advanced concepts, critical thinking, problem-solving, junior high prep',
    color: '#2563EB',
    bg: '#DBEAFE',
    icon: '🚀',
  },
];

const SUBJECTS = ['mathematics', 'english'];

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

export default function QuestionBankPage() {
  const { user } = useAuth();

  const [questions,   setQuestions]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState(null);
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterSubj,  setFilterSubj]  = useState('all');
  const [showAdd,     setShowAdd]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(null);

  const [form, setForm] = useState({
    level: 'primary',
    subject: 'mathematics',
    topic: '',
    question: '',
    optA: '', optB: '', optC: '', optD: '',
    correct: 'A',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false });
    if (error) showToast(error.message, 'error');
    setQuestions(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleAdd = async () => {
    if (!form.topic.trim() || !form.question.trim() || !form.optA || !form.optB || !form.optC || !form.optD) {
      showToast('Please fill in all fields.', 'error'); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('questions').insert({
        tutor_id: user.id,
        level:    form.level,
        subject:  form.subject,
        topic:    form.topic,
        question_text: form.question,
        options:  [form.optA, form.optB, form.optC, form.optD],
        correct_answer: form.correct,
        status:   'pending',
      });
      if (error) { showToast(error.message, 'error'); return; }
      showToast('Question submitted for admin review!');
      setShowAdd(false);
      setForm({ level:'primary', subject:'mathematics', topic:'', question:'', optA:'', optB:'', optC:'', optD:'', correct:'A' });
      fetchQuestions();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    setDeleting(id);
    await supabase.from('questions').delete().eq('id', id);
    showToast('Question deleted.');
    setDeleting(null);
    fetchQuestions();
  };

  const filtered = questions.filter(q => {
    if (filterLevel !== 'all' && q.level !== filterLevel) return false;
    if (filterSubj  !== 'all' && q.subject !== filterSubj) return false;
    return true;
  });

  const counts = {
    primary:      questions.filter(q => q.level === 'primary').length,
    intermediate: questions.filter(q => q.level === 'intermediate').length,
  };

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />

      <div className="flex items-center justify-between mb-24">
        <div>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize:22 }}>Question Bank</h2>
          <p className="text-sm text-muted mt-4">Contribute questions used in student pre-assessments.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={14} /> Add Question
        </button>
      </div>

      {/* Level summary cards */}
      <div className="grid-2 mb-20">
        {LEVELS.map(lvl => (
          <div key={lvl.value} style={{ background:lvl.bg, border:`2px solid ${lvl.color}30`, borderRadius:14, padding:20, display:'flex', alignItems:'center', gap:16 }}>
            <span style={{ fontSize:36 }}>{lvl.icon}</span>
            <div style={{ flex:1 }}>
              <div className="font-jakarta font-bold" style={{ fontSize:15, color:lvl.color }}>{lvl.label}</div>
              <div style={{ fontSize:12, color:lvl.color, opacity:0.8, marginTop:2 }}>{lvl.grades}</div>
              <div style={{ fontSize:11, color:lvl.color, opacity:0.6, marginTop:2 }}>{lvl.desc}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:32, fontWeight:900, color:lvl.color }}>{counts[lvl.value]}</div>
              <div style={{ fontSize:11, color:lvl.color, opacity:0.7 }}>question{counts[lvl.value] !== 1 ? 's' : ''}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-16 mb-20">
        <div className="flex gap-8" style={{ flexWrap:'wrap' }}>
          <div className="flex gap-6">
            {['all', 'primary', 'intermediate'].map(f => (
              <button key={f} onClick={() => setFilterLevel(f)} className="btn btn-sm"
                style={{ background:filterLevel===f?tokens.primary:'#fff', color:filterLevel===f?'#fff':tokens.mid, border:`1px solid ${filterLevel===f?tokens.primary:tokens.border}`, textTransform:'capitalize' }}>
                {f === 'all' ? 'All Levels' : LEVELS.find(l=>l.value===f)?.label}
              </button>
            ))}
          </div>
          <div style={{ width:1, background:tokens.border }} />
          <div className="flex gap-6">
            {['all', ...SUBJECTS].map(f => (
              <button key={f} onClick={() => setFilterSubj(f)} className="btn btn-sm"
                style={{ background:filterSubj===f?tokens.primary:'#fff', color:filterSubj===f?'#fff':tokens.mid, border:`1px solid ${filterSubj===f?tokens.primary:tokens.border}`, textTransform:'capitalize' }}>
                {f === 'all' ? 'All Subjects' : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? <Spinner dark size={28} /> : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon="📋" title="No questions yet" description="Add your first question to the bank. Questions are reviewed by admin before going live." />
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Level</th>
                <th>Subject</th>
                <th>Topic</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => {
                const lvl = LEVELS.find(l => l.value === q.level);
                return (
                  <tr key={q.id}>
                    <td style={{ maxWidth:280, fontSize:13 }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.question}</div>
                    </td>
                    <td>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:lvl?.bg, color:lvl?.color }}>
                        {lvl?.icon} {lvl?.label}
                      </span>
                    </td>
                    <td><Badge variant="info" style={{ textTransform:'capitalize' }}>{q.subject}</Badge></td>
                    <td style={{ fontSize:13 }}>{q.topic}</td>
                    <td>
                      <Badge variant={q.status === 'approved' ? 'success' : q.status === 'rejected' ? 'danger' : 'warning'}>
                        {q.status}
                      </Badge>
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm" disabled={deleting === q.id} onClick={() => handleDelete(q.id)}>
                        <Icon name="x" size={11} /> {deleting === q.id ? '...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding:'12px 24px', borderTop:`1px solid ${tokens.border}` }}>
            <p className="text-xs text-muted">Showing {filtered.length} of {questions.length} questions</p>
          </div>
        </div>
      )}

      {/* Add Question Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="📋 Add Question to Bank"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit for Review'}
          </button>
        </>}>

        {/* Level selector */}
        <FormGroup label="Difficulty Level" hint="Select the level this question is appropriate for.">
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {LEVELS.map(lvl => (
              <button key={lvl.value} type="button" onClick={() => set('level', lvl.value)}
                style={{ padding:'14px 16px', borderRadius:12, cursor:'pointer', border:`2px solid ${form.level===lvl.value?lvl.color:tokens.border}`, background:form.level===lvl.value?lvl.bg:'#FAFAFA', textAlign:'left', transition:'all 0.15s' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:24 }}>{lvl.icon}</span>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:form.level===lvl.value?lvl.color:tokens.dark }}>
                      {lvl.label} <span style={{ fontSize:12, fontWeight:400 }}>({lvl.grades})</span>
                    </div>
                    <div style={{ fontSize:11, color:tokens.muted, marginTop:2 }}>{lvl.desc}</div>
                  </div>
                  {form.level===lvl.value && (
                    <span style={{ marginLeft:'auto', fontSize:16, color:lvl.color }}>✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </FormGroup>

        <div className="grid-2">
          <FormGroup label="Subject">
            <select className="select" value={form.subject} onChange={e => set('subject', e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s} style={{ textTransform:'capitalize' }}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Topic">
            <input className="input" placeholder="e.g. Fractions, Grammar" value={form.topic} onChange={e => set('topic', e.target.value)} />
          </FormGroup>
        </div>

        <FormGroup label="Question">
          <textarea className="textarea" placeholder="Write the question here..." value={form.question} onChange={e => set('question', e.target.value)} style={{ minHeight:90 }} />
        </FormGroup>

        {['A','B','C','D'].map(opt => (
          <FormGroup key={opt} label={`Option ${opt}${form.correct===opt?' ✓ (Correct)':''}`}>
            <div className="flex gap-8">
              <input className="input" style={{ flex:1, borderColor:form.correct===opt?tokens.success:undefined }}
                placeholder={`Option ${opt}`}
                value={form[`opt${opt}`]}
                onChange={e => set(`opt${opt}`, e.target.value)}
              />
              {form.correct !== opt && (
                <button type="button" onClick={() => set('correct', opt)}
                  style={{ padding:'8px 12px', borderRadius:8, background:'#F9FAFB', border:`1px solid ${tokens.border}`, cursor:'pointer', fontSize:12, color:tokens.muted, whiteSpace:'nowrap' }}>
                  Set Correct
                </button>
              )}
            </div>
          </FormGroup>
        ))}
      </Modal>
    </div>
  );
}