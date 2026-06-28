import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import FormGroup from '../../components/ui/FormGroup';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const MAX_PDF_BYTES   = 20 * 1024 * 1024;
const PASS_SCORE      = 75;
const TOTAL_QUESTIONS = 10;
const EXAM_MINUTES    = 30;

const ENGLISH_CONTEXT = `
PHILIPPINE K-12 ENGLISH CURRICULUM (DepEd):
Grade 2: Phonemic awareness, decoding CVC words, sight words, simple sentence structure, reading short stories, writing simple sentences.
Grade 3: Fluency reading, main idea and details, cause and effect, adjectives, adverbs, compound words, paragraph writing, story elements.
Grade 4: Inferencing, context clues, prefixes/suffixes, figurative language, subject-verb agreement, paragraph organization, summarizing.
Grade 5: Critical reading, author's purpose, point of view, persuasive writing, complex sentences, grammar (active/passive voice, tenses).
Grade 6: Analysis and synthesis, argumentative writing, research skills, complex grammar, idioms, text types (narrative, expository, persuasive).
COMMON STUDENT MISCONCEPTIONS:
- Confusing their/there/they're, your/you're
- Subject-verb agreement errors
- Filipino students struggle with articles (a, an, the) due to Tagalog influence
PEDAGOGICAL APPROACHES:
- Whole Language vs Phonics, Guided Reading strategies
- Scaffolding for ESL learners, KWL charts, Bloom's Taxonomy`;

const MATH_CONTEXT = `
PHILIPPINE K-12 MATHEMATICS CURRICULUM (DepEd):
Grade 2: Place value to 1000, addition/subtraction with regrouping, multiplication as repeated addition, basic fractions, measurement, basic geometry.
Grade 3: Place value to 10000, multiplication tables (1-10), division, fractions on number line, perimeter, bar graphs.
Grade 4: Large numbers, multi-digit multiplication/division, equivalent fractions, decimal concepts, area and perimeter, angles.
Grade 5: Fractions operations, decimal operations, ratio and proportion, percentage, volume of rectangular prisms.
Grade 6: Integers, algebraic expressions, geometry (circles, polygons), statistics (mean, median, mode), probability.
COMMON STUDENT MISCONCEPTIONS:
- Multiplication always makes bigger (false for fractions)
- Adding numerators AND denominators: 1/2 + 1/3 = 2/5 (wrong)
- Confusing perimeter and area
PEDAGOGICAL APPROACHES:
- Concrete-Pictorial-Abstract (CPA) progression
- Singapore Math model method, constructivist approach`;

function buildExamPrompt(subject) {
  const name    = subject === 'english' ? 'English Language Arts' : 'Mathematics';
  const context = subject === 'english' ? ENGLISH_CONTEXT : MATH_CONTEXT;
  return `You are a professional licensure examiner creating a certification test for tutors who will teach Grade 2-6 Filipino elementary students under the DepEd K-12 curriculum.
${context}
Generate exactly ${TOTAL_QUESTIONS} multiple-choice questions to verify the tutor has DEEP PROFESSIONAL KNOWLEDGE of ${name}.
QUESTION MIX:
- 3 questions: CONTENT KNOWLEDGE
- 3 questions: COMMON MISCONCEPTIONS
- 2 questions: PEDAGOGY
- 2 questions: CURRICULUM APPLICATION
RULES:
- Questions must be at COLLEGE/PROFESSIONAL TEACHER level
- All 4 options must be plausible
- Base on real Philippine classroom scenarios
Return ONLY a valid JSON array:
[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]
Generate exactly ${TOTAL_QUESTIONS} questions now.`;
}

async function generateExamQuestions(subject) {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured.');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini', max_tokens: 3000, temperature: 0.8,
      messages: [{ role: 'user', content: buildExamPrompt(subject) }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }
  const data    = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const cleaned = content.replace(/```json|```/g, '').trim();
  const questions = JSON.parse(cleaned);
  if (!Array.isArray(questions)) throw new Error('Invalid question format from AI.');
  return questions.slice(0, TOTAL_QUESTIONS);
}

function validatePDF(file) {
  if (!file) return 'Please select a file.';
  if (file.type !== 'application/pdf') return 'Only PDF files are accepted.';
  if (file.size > MAX_PDF_BYTES) return 'File must be under 20MB.';
  return null;
}

const STEPS_TUTOR  = ['Terms', 'Info', 'Documents', 'Assessment'];
const STEPS_PARENT = ['Terms', 'Info'];
const STEP_META = {
  Terms:      { icon: '📄' },
  Info:       { icon: '👤' },
  Documents:  { icon: '📁' },
  Assessment: { icon: '🧠' },
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, signOut } = useAuth();
  const [params] = useSearchParams();

  const [role,         setRole]         = useState(params.get('role') || 'parent');
  const [step,         setStep]         = useState(0);
  const [agreed,       setAgreed]       = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showModal,    setShowModal]    = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPw,setShowConfirmPw]= useState(false);

  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    location: '', gender: '', yearsExperience: '', ratePerSession: '',
    specialization: [], bio: '',
  });

  const [docs,      setDocs]      = useState({ nbi: null, prc: null, medical: null, applicationForm: null });
  const [docErrors, setDocErrors] = useState({ nbi: '', prc: '', medical: '', applicationForm: '' });

  const [examSubjects, setExamSubjects] = useState([]);
  const [examPhase,    setExamPhase]    = useState('select');
  const [currentSubj,  setCurrentSubj]  = useState(null);
  const [questions,    setQuestions]    = useState([]);
  const [currentQ,     setCurrentQ]     = useState(0);
  const [answers,      setAnswers]      = useState({});
  const [timeLeft,     setTimeLeft]     = useState(EXAM_MINUTES * 60);
  const [allResults,   setAllResults]   = useState({});
  const timerRef = useRef(null);

  const set        = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleSpec = (s)    => setForm(f => ({
    ...f,
    specialization: f.specialization.includes(s)
      ? f.specialization.filter(x => x !== s)
      : [...f.specialization, s],
  }));

  const steps       = role === 'tutor' ? STEPS_TUTOR : STEPS_PARENT;
  const currentStep = steps[step];

  const handleRoleChange = (r) => {
    setRole(r); setStep(0); setAgreed(false); setError('');
    setShowPassword(false); setShowConfirmPw(false);
    setForm({ fullName: '', email: '', password: '', confirmPassword: '', location: '', gender: '', yearsExperience: '', ratePerSession: '', specialization: [], bio: '' });
  };

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  useEffect(() => {
    if (examPhase !== 'exam') return;
    if (timeLeft <= 0) { handleExamSubmit(); return; }
    timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examPhase, timeLeft]);

  const handleNext = (e) => {
    e?.preventDefault();
    setError('');
    if (currentStep === 'Terms') {
      if (!agreed) { setError('You must agree to the Terms and Conditions.'); return; }
      setStep(s => s + 1); return;
    }
    if (currentStep === 'Info') {
      if (!form.fullName.trim())    { setError('Please enter your full name.'); return; }
      if (!form.email.trim())       { setError('Please enter your email.'); return; }
      if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
      if (role === 'tutor' && form.specialization.length === 0) { setError('Please select at least one subject.'); return; }
      if (step === steps.length - 1) { handleSubmitParent(); return; }
      setStep(s => s + 1); return;
    }
    if (currentStep === 'Documents') {
      const errs = {
        nbi:             validatePDF(docs.nbi)             || '',
        prc:             validatePDF(docs.prc)             || '',
        medical:         validatePDF(docs.medical)         || '',
        applicationForm: validatePDF(docs.applicationForm) || '',
      };
      setDocErrors(errs);
      if (Object.values(errs).some(Boolean)) { setError('Please upload all 4 required PDF documents.'); return; }
      setExamSubjects(form.specialization);
      setExamPhase('select');
      setStep(s => s + 1);
    }
  };

  const handleFileChange = (key, e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const err = validatePDF(file);
    setDocErrors(prev => ({ ...prev, [key]: err || '' }));
    setDocs(prev => ({ ...prev, [key]: err ? null : file }));
  };

  const startExam = async (subject) => {
    setCurrentSubj(subject);
    setExamPhase('loading');
    setAnswers({});
    setCurrentQ(0);
    setTimeLeft(EXAM_MINUTES * 60);
    try {
      const qs = await generateExamQuestions(subject);
      setQuestions(qs);
      setExamPhase('exam');
    } catch (err) {
      setError('Failed to generate exam: ' + err.message);
      setExamPhase('select');
    }
  };

  const handleExamSubmit = () => {
    clearInterval(timerRef.current);
    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.correct) correct++; });
    const score = Math.round((correct / questions.length) * 100);
    setAllResults(prev => ({ ...prev, [currentSubj]: score }));
    setExamPhase('result');
  };

  // Always go back to select so they can retake any subject
  const handleContinueAfterResult = () => {
    setExamPhase('select');
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await signUp({
        email:    form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role,
      });

      // Wait for session AND profiles row
      let userId        = null;
      let profileExists = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          userId = user.id;
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
          if (profileData?.id) { profileExists = true; break; }
        }
      }
      if (!userId) throw new Error('Session not found. Please try again.');

      // Update profile fields
      if (profileExists) {
        await supabase.from('profiles').update({
          location: form.location || null,
          gender:   form.gender   || null,
          bio:      form.bio      || null,
        }).eq('id', userId);
      }

      // Upload documents
      const urls = {};
      const docMap = [
        { key: 'nbi',             file: docs.nbi,             storageName: 'nbi.pdf',              column: 'nbi_clearance_url'    },
        { key: 'prc',             file: docs.prc,             storageName: 'prc.pdf',              column: 'prc_license_url'      },
        { key: 'medical',         file: docs.medical,         storageName: 'medical.pdf',          column: 'medical_cert_url'     },
        { key: 'applicationForm', file: docs.applicationForm, storageName: 'application-form.pdf', column: 'application_form_url' },
      ];
      for (const doc of docMap) {
        if (!doc.file) continue;
        const path = `${userId}/${doc.storageName}`;
        const { error: upErr } = await supabase.storage
          .from('tutor-documents')
          .upload(path, doc.file, { upsert: true, contentType: 'application/pdf' });
        if (upErr) throw new Error(`Failed to upload ${doc.key}: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from('tutor-documents').getPublicUrl(path);
        urls[doc.column] = urlData?.publicUrl || path;
      }

      // Save tutors row
      const strengthSubjects = Object.entries(allResults)
        .filter(([, score]) => score >= PASS_SCORE)
        .map(([subject]) => subject);

      await supabase.from('tutors').upsert({
        id:                    userId,
        years_experience:      Number(form.yearsExperience) || 0,
        rate_per_session:      Number(form.ratePerSession)  || null,
        specialization:        strengthSubjects.length > 0 ? strengthSubjects : form.specialization,
        certification_scores:  Object.keys(allResults).length > 0 ? allResults : null,
        nbi_clearance_url:     urls['nbi_clearance_url']    || null,
        prc_license_url:       urls['prc_license_url']      || null,
        medical_cert_url:      urls['medical_cert_url']     || null,
        application_form_url:  urls['application_form_url'] || null,
        status:                'pending',
      });

      await signOut();
      navigate('/pending-approval');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitParent = async () => {
    setLoading(true);
    setError('');
    try {
      await signUp({ email: form.email.trim(), password: form.password, fullName: form.fullName.trim(), role });
      await signOut();
      navigate('/login', { state: { justRegistered: true } });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (pw) => {
    if (!pw) return null;
    const checks = {
      length:    pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      number:    /[0-9]/.test(pw),
      special:   /[^A-Za-z0-9]/.test(pw),
    };
    const passed  = Object.values(checks).filter(Boolean).length;
    const missing = [];
    if (!checks.length)    missing.push('at least 8 characters');
    if (!checks.uppercase) missing.push('uppercase letter');
    if (!checks.number)    missing.push('number');
    if (!checks.special)   missing.push('special character');
    const strength = passed <= 1 ? 'Weak' : passed === 2 ? 'Fair' : passed === 3 ? 'Good' : 'Strong';
    const color    = passed <= 1 ? '#DC2626' : passed === 2 ? '#F59E0B' : passed === 3 ? '#2563EB' : '#16A34A';
    return { checks, missing, strength, color, passed };
  };
  const pwStrength = getPasswordStrength(form.password);

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${tokens.primaryLight}, #fff, #FEF3C7)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}>

      <Link to="/" style={{ position: 'fixed', top: 24, left: 28, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', zIndex: 100 }}>
        <img src={require('../../assets/learnbridge-logo.png')} alt="LearnBridge" style={{ width: 52, height: 52, objectFit: 'contain' }} />
        <div>
          <div className="font-jakarta font-extrabold" style={{ fontSize: 17, color: tokens.dark }}>LearnBridge</div>
          <div className="text-xs text-muted">← Back to Home</div>
        </div>
      </Link>

      {role === 'tutor' && (
        <div className="flex items-center gap-0 mb-24" style={{ background: '#fff', borderRadius: 14, padding: '14px 28px', boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}>
          {STEPS_TUTOR.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-8">
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: i < step ? tokens.success : i === step ? tokens.primary : '#E5E7EB', color: i <= step ? '#fff' : tokens.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, transition: 'all 0.3s' }}>
                  {i < step ? '✓' : STEP_META[label]?.icon}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: i === step ? tokens.primary : i < step ? tokens.success : tokens.muted }}>{label}</span>
              </div>
              {i < STEPS_TUTOR.length - 1 && (
                <div style={{ width: 40, height: 2, margin: '0 12px', background: i < step ? tokens.success : '#E5E7EB', borderRadius: 2, transition: 'all 0.3s' }} />
              )}
            </div>
          ))}
        </div>
      )}

      {currentStep === 'Assessment' ? (
        <div style={{ width: '100%', maxWidth: 680 }}>

          {/* SELECT */}
          {examPhase === 'select' && (
            <div className="card fade-in" style={{ padding: 36 }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🧠</div>
                <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>AI Certification Assessment</h2>
                <p className="text-sm text-muted mt-8" style={{ lineHeight: 1.7 }}>
                  Each exam has <strong>{TOTAL_QUESTIONS} questions</strong> and a <strong>{EXAM_MINUTES}-minute</strong> time limit.
                  A score of <strong>{PASS_SCORE}%+</strong> confirms your strength in that subject.
                </p>
              </div>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#1D4ED8', display: 'flex', gap: 10 }}>
                <span>📋</span>
                <span>Questions are at a <strong>professional/college level</strong> — testing your subject mastery and teaching methodology.</span>
              </div>
              {error && <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>❌ {error}</div>}
              {Object.keys(allResults).length > 0 && (
                <div style={{ background: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div className="font-semibold mb-10" style={{ fontSize: 13 }}>Results so far:</div>
                  {Object.entries(allResults).map(([subj, score]) => (
                    <div key={subj} className="flex items-center justify-between mb-6">
                      <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{subj}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: score >= PASS_SCORE ? '#D1FAE5' : '#FEE2E2', color: score >= PASS_SCORE ? '#065F46' : '#DC2626' }}>
                        {score}% {score >= PASS_SCORE ? '✓ Passed' : '✗ Below pass mark'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {examSubjects.map(subj => {
                  const done  = allResults[subj] !== undefined;
                  const score = allResults[subj];
                  return (
                    <button key={subj} onClick={() => { if (!done) startExam(subj); }}
                      style={{ padding: '16px 20px', borderRadius: 12, cursor: done ? 'not-allowed' : 'pointer', border: `2px solid ${done ? (score >= PASS_SCORE ? '#6EE7B7' : '#FCA5A5') : tokens.primary}`, background: done ? (score >= PASS_SCORE ? '#F0FDF4' : '#FEF2F2') : tokens.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s', opacity: done ? 0.85 : 1 }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>{subj === 'english' ? '📖 English' : '🔢 Mathematics'}</div>
                        <div style={{ fontSize: 12, color: tokens.muted, marginTop: 3 }}>
                          {done ? `Score: ${score}% — ${score >= PASS_SCORE ? 'Passed ✓' : 'Not passed'}` : `${TOTAL_QUESTIONS} questions · ${EXAM_MINUTES} minutes`}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, padding: '6px 14px', borderRadius: 20, background: done ? (score >= PASS_SCORE ? '#D1FAE5' : '#FEE2E2') : tokens.primary, color: done ? (score >= PASS_SCORE ? '#065F46' : '#DC2626') : '#fff' }}>
                        {done ? (score >= PASS_SCORE ? '✓ Done' : '✗ Not Passed') : 'Start →'}
                      </div>
                    </button>
                  );
                })}
              </div>
              {examSubjects.every(s => allResults[s] !== undefined) && (
                <button className="btn btn-primary btn-full btn-lg" onClick={() => setExamPhase('done')}>
                  Finish & Submit Registration →
                </button>
              )}
              <p className="text-xs text-muted mt-12 text-center">Each subject can only be taken once. Choose carefully before starting.</p>
            </div>
          )}

          {/* LOADING */}
          {examPhase === 'loading' && (
            <div className="card" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🧠</div>
              <Spinner dark size={32} />
              <div className="font-jakarta font-bold mt-16" style={{ fontSize: 18 }}>Generating Your Exam...</div>
              <p className="text-sm text-muted mt-8">AI is creating {TOTAL_QUESTIONS} unique questions for <strong style={{ textTransform: 'capitalize' }}>{currentSubj}</strong>.<br/>This takes about 5-10 seconds.</p>
            </div>
          )}

          {/* EXAM */}
          {examPhase === 'exam' && questions[currentQ] && (
            <div className="fade-in">
              <div className="card p-16 mb-16 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted mb-4" style={{ textTransform: 'capitalize' }}>{currentSubj} · Question {currentQ + 1} of {questions.length}</div>
                  <div style={{ width: 220, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${((currentQ + 1) / questions.length) * 100}%`, background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.accent})` }} />
                  </div>
                </div>
                <div className="font-jakarta font-extrabold" style={{ fontSize: 26, color: timeLeft < 300 ? '#DC2626' : tokens.dark }}>⏱ {fmtTime(timeLeft)}</div>
              </div>
              <div className="card p-28">
                <h3 className="font-jakarta font-bold mb-24" style={{ fontSize: 17, lineHeight: 1.5 }}>{questions[currentQ].question}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {questions[currentQ].options.map((opt, i) => {
                    const selected = answers[currentQ] === i;
                    return (
                      <button key={i} onClick={() => setAnswers(a => ({ ...a, [currentQ]: i }))}
                        style={{ padding: '13px 18px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${selected ? tokens.primary : tokens.border}`, background: selected ? tokens.primaryLight : '#FAFAFA', color: selected ? tokens.primary : tokens.dark, textAlign: 'left', fontSize: 14, fontWeight: selected ? 600 : 400, transition: 'all 0.15s', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: selected ? tokens.primary : '#E5E7EB', color: selected ? '#fff' : tokens.mid, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, marginTop: 1 }}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between">
                  <button className="btn btn-ghost" disabled={currentQ === 0} onClick={() => setCurrentQ(q => q - 1)}>← Previous</button>
                  {currentQ < questions.length - 1
                    ? <button className="btn btn-primary" onClick={() => { if (answers[currentQ] === undefined) { alert('Please select an answer before proceeding.'); return; } setCurrentQ(q => q + 1); }}>Next →</button>
                    : <button className="btn btn-primary" onClick={() => { if (answers[currentQ] === undefined) { alert('Please select an answer before submitting.'); return; } handleExamSubmit(); }}><Icon name="check" size={14} /> Submit Exam</button>
                  }
                </div>
              </div>
            </div>
          )}

          {/* RESULT */}
          {examPhase === 'result' && (
            <div className="card fade-in p-40 text-center">
              <div style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px', background: allResults[currentSubj] >= PASS_SCORE ? '#D1FAE5' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                {allResults[currentSubj] >= PASS_SCORE ? '🎓' : '📝'}
              </div>
              <h2 className="font-jakarta font-extrabold mb-8" style={{ fontSize: 24, color: allResults[currentSubj] >= PASS_SCORE ? tokens.success : '#DC2626' }}>
                {allResults[currentSubj] >= PASS_SCORE ? 'Subject Passed!' : 'Keep Practicing'}
              </h2>
              <p className="text-sm text-muted mb-20" style={{ lineHeight: 1.6 }}>
                Your score for <strong style={{ textTransform: 'capitalize' }}>{currentSubj}</strong>:{' '}
                <strong style={{ fontSize: 20, color: allResults[currentSubj] >= PASS_SCORE ? tokens.success : '#DC2626' }}>{allResults[currentSubj]}%</strong>
              </p>
              <div style={{ marginBottom: 24 }}>
                <div style={{ height: 12, background: '#E5E7EB', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: `${PASS_SCORE}%`, top: 0, bottom: 0, width: 2, background: '#374151', zIndex: 2 }} />
                  <div style={{ height: '100%', borderRadius: 6, width: `${allResults[currentSubj]}%`, background: allResults[currentSubj] >= PASS_SCORE ? `linear-gradient(90deg, ${tokens.success}, #4ADE80)` : `linear-gradient(90deg, #F87171, #DC2626)`, transition: 'width 1s ease' }} />
                </div>
                <div className="flex justify-between mt-4">
                  <span style={{ fontSize: 11, color: tokens.muted }}>0%</span>
                  <span style={{ fontSize: 11, color: '#374151', fontWeight: 700 }}>{PASS_SCORE}% pass mark</span>
                  <span style={{ fontSize: 11, color: tokens.muted }}>100%</span>
                </div>
              </div>
              {allResults[currentSubj] < PASS_SCORE && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400E', textAlign: 'left' }}>
                  💡 You did not pass this subject but you can still submit your registration.
                </div>
              )}
              <div className="flex gap-10">
                <button className="btn btn-primary btn-full" onClick={handleContinueAfterResult}>
                  Back to Subject Selection →
                </button>
              </div>
            </div>
          )}

          {/* DONE */}
          {examPhase === 'done' && (
            <div className="card fade-in p-40 text-center">
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <h2 className="font-jakarta font-extrabold mb-8" style={{ fontSize: 22 }}>Assessment Complete!</h2>
              <p className="text-sm text-muted mb-24" style={{ lineHeight: 1.6 }}>Here are your final results. Your scores and strengths will be saved to your profile.</p>
              <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 20, marginBottom: 24, textAlign: 'left' }}>
                <div className="font-semibold mb-14" style={{ fontSize: 14 }}>📊 Your Assessment Results</div>
                {Object.entries(allResults).map(([subj, score]) => (
                  <div key={subj} style={{ marginBottom: 14 }}>
                    <div className="flex items-center justify-between mb-6">
                      <span style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{subj === 'english' ? '📖 English' : '🔢 Mathematics'}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: score >= PASS_SCORE ? '#D1FAE5' : '#FEF3C7', color: score >= PASS_SCORE ? '#065F46' : '#92400E' }}>
                        {score}% — {score >= PASS_SCORE ? '⭐ Strength Subject' : 'Needs Improvement'}
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${score}%`, background: score >= PASS_SCORE ? tokens.success : '#F59E0B' }} />
                    </div>
                  </div>
                ))}
              </div>
              {Object.entries(allResults).some(([, s]) => s >= PASS_SCORE) && (
                <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#065F46', textAlign: 'left' }}>
                  <strong>⭐ Your Strength Subjects:</strong>{' '}
                  {Object.entries(allResults).filter(([, s]) => s >= PASS_SCORE).map(([subj]) => subj.charAt(0).toUpperCase() + subj.slice(1)).join(' & ')}
                  <br/><span style={{ fontSize: 12 }}>These will be highlighted on your profile visible to parents.</span>
                </div>
              )}
              {error && <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>❌ {error}</div>}
              <button className="btn btn-primary btn-full btn-lg" onClick={handleFinalSubmit} disabled={loading}>
                {loading ? <><Spinner /> Submitting Registration...</> : <>Submit Registration & Go to Pending →</>}
              </button>
              <p className="text-xs text-muted mt-12">Your documents and exam results will be reviewed by the admin team within 1-3 business days.</p>
            </div>
          )}
        </div>

      ) : (

        <div className="card fade-in" style={{ width: '100%', maxWidth: currentStep === 'Terms' ? 640 : currentStep === 'Documents' ? 580 : 480, padding: 36 }}>

          {step === 0 && (
            <div className="form-group mb-20">
              <label className="form-label">I want to register as...</label>
              <div className="flex gap-8">
                {['parent', 'tutor'].map(r => (
                  <button key={r} type="button" onClick={() => handleRoleChange(r)} className="btn" style={{ flex: 1, justifyContent: 'center', background: role === r ? tokens.primary : '#fff', color: role === r ? '#fff' : tokens.mid, border: `1.5px solid ${role === r ? tokens.primary : tokens.border}` }}>
                    <Icon name={r === 'parent' ? 'users' : 'award'} size={14} color={role === r ? '#fff' : tokens.mid} />
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'Terms' && (
            <>
              <h2 className="font-jakarta font-extrabold mb-4" style={{ fontSize: 20 }}>📄 {role === 'tutor' ? 'Tutor' : 'Parent'} Agreement</h2>
              <p className="text-sm text-muted mb-24" style={{ lineHeight: 1.6 }}>Before creating your account, please read and agree to our policies.</p>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '16px 18px', background: agreed ? tokens.primaryLight : '#FAFAFA', border: `1.5px solid ${agreed ? tokens.primary : tokens.border}`, borderRadius: 12, transition: 'all 0.15s', marginBottom: 16 }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 3, accentColor: tokens.primary, width: 16, height: 16, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: tokens.dark, lineHeight: 1.7 }}>
                  I have read and agree to the{' '}
                  <button type="button" onClick={e => { e.preventDefault(); setShowModal('terms'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.primary, fontWeight: 700, padding: 0, fontSize: 13, textDecoration: 'underline' }}>Terms &amp; Conditions</button>
                  {' '}and consent to the collection and processing of my personal data in accordance with the{' '}
                  <button type="button" onClick={e => { e.preventDefault(); setShowModal('privacy'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.primary, fontWeight: 700, padding: 0, fontSize: 13, textDecoration: 'underline' }}>Data Privacy Act of 2012 (RA 10173).</button>
                </span>
              </label>

              {showModal === 'terms' && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
                    <div style={{ padding: '18px 24px', borderBottom: `1px solid ${tokens.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                      <div className="font-jakarta font-extrabold" style={{ fontSize: 17 }}>📋 {role === 'tutor' ? 'Tutor' : 'Parent'} Terms &amp; Conditions</div>
                      <button onClick={() => setShowModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: tokens.muted }}>✕</button>
                    </div>
                    <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
                      {(role === 'parent' ? [
                        { num: '1', title: 'Parental Responsibility', items: ['You are solely responsible for your child\'s participation on LearnBridge.', 'Ensure your child is supervised during all tutoring sessions.'] },
                        { num: '2', title: 'Child Safety & Privacy', items: ['Platform is designed for Grades 2-6 learners (ages 7-12).', 'Do not allow your child to use this platform unsupervised.', 'Your child\'s personal data is protected and never shared with third parties.'] },
                        { num: '3', title: 'Session Commitment', items: ['Each booking = 8 sessions (2 sessions/week, 1.5 hours each).', 'You are responsible for ensuring your child attends all scheduled sessions.'] },
                        { num: '4', title: 'Session Confirmation & Feedback', items: ['After each session the tutor marks it complete.', 'You must confirm each session and provide a star rating and feedback.'] },
                        { num: '5', title: 'Payments & Commission', items: ['Payments are made directly to the tutor.', 'LearnBridge deducts a 10% commission from the tutor\'s wallet — parents pay no extra fees.'] },
                        { num: '6', title: 'Platform Use Policy', items: ['LearnBridge may suspend accounts that violate these terms.', 'Any misuse by a registered child is the legal responsibility of the parent.'] },
                        { num: '7', title: 'Child Privacy Protection', items: ['Child data is used solely for tutoring services.', 'This information will not be sold or disclosed to unauthorized parties.', 'Parents may request access, correction, or deletion of their child\'s data at any time.'] },
                      ] : [
                        { num: '1', title: 'Document Verification Required', items: ['Submit valid NBI Clearance, PRC License, Medical Certificate, and Application Form.', 'All documents will be reviewed by the LearnBridge admin team.', 'Falsified or expired documents result in permanent account termination.'] },
                        { num: '2', title: 'AI Certification Assessment', items: ['Complete an AI-powered exam for each subject you wish to teach.', 'A passing score of 75% or higher is required.', 'Your scores determine your strength subjects shown to parents on your profile.'] },
                        { num: '3', title: 'Child Safety Commitment', items: ['All students are minors (ages 7-12, Grades 2-6).', 'Maintain professional conduct at all times.', 'Never communicate with students outside the LearnBridge platform.', 'Inappropriate conduct toward a minor results in immediate permanent ban.'] },
                        { num: '4', title: 'Session Rate & Commission', items: ['Your approved session rate is set by the LearnBridge admin.', 'A 10% platform commission is automatically deducted per completed session.', 'Maintain sufficient wallet balance to accept booking requests.'] },
                        { num: '5', title: '8-Session Package', items: ['All bookings = 8 sessions (2 sessions/week, 1.5 hours each).', 'Complete all 8 sessions and submit session notes after every session.'] },
                        { num: '6', title: 'Session Completion Flow', items: ['Mark each session complete on the platform after conducting it.', 'Provide session notes including topics covered.', 'Parent confirms the session and provides a star rating.'] },
                        { num: '7', title: 'Conduct & Termination Policy', items: ['Unprofessional conduct or falsified documents result in suspension or permanent ban.', 'Failure to complete booked sessions without valid reason may result in termination.'] },
                        { num: '8', title: 'Privacy of Minor Students', items: ['Use student information only for providing tutoring services through LearnBridge.', 'Do not share, store externally, or use student information for any other purpose.', 'Violation of student privacy is grounds for immediate termination and legal action.'] },
                      ]).map(section => (
                        <div key={section.num} style={{ marginBottom: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: tokens.primaryLight, color: tokens.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{section.num}</div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: tokens.dark }}>{section.title}</div>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 34, display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {section.items.map((item, i) => <li key={i} style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.6 }}>{item}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.border}`, flexShrink: 0 }}>
                      <button className="btn btn-primary btn-full" onClick={() => { setShowModal(null); setAgreed(true); }}>✓ I Understand &amp; Agree</button>
                    </div>
                  </div>
                </div>
              )}

              {showModal === 'privacy' && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
                    <div style={{ padding: '18px 24px', borderBottom: `1px solid ${tokens.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                      <div className="font-jakarta font-extrabold" style={{ fontSize: 17 }}>🔒 Data Privacy Act of 2012 (RA 10173)</div>
                      <button onClick={() => setShowModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: tokens.muted }}>✕</button>
                    </div>
                    <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
                      {[
                        { icon: '🤝', title: 'Our Commitment', items: ['LearnBridge complies fully with the Data Privacy Act of 2012 (RA 10173) of the Philippines.', 'We are committed to protecting your personal data and processing it lawfully, fairly, and transparently.'] },
                        { icon: '📂', title: 'What Data We Collect', items: role === 'tutor' ? ['Name, email address, and contact details', 'Location, gender, and years of experience', 'Submitted credentials: NBI Clearance, PRC License, Medical Certificate, Application Form', 'AI Certification exam scores and strength subjects', 'Session records and wallet transaction history'] : ['Your name and email address', "Your child's name and grade level", 'Session and booking records related to your account'] },
                        { icon: '🎯', title: 'How We Use Your Data', items: ['Platform operations and account management', 'Tutor verification and profile display', 'Service delivery and session management', 'We do NOT sell your data to third parties'] },
                        { icon: '⚖️', title: 'Your Rights Under RA 10173', items: ['Right to be Informed', 'Right to Access', 'Right to Object', 'Right to Erasure or Blocking', 'Right to Rectify', 'Right to Data Portability', 'Right to Damages', 'Right to File a Complaint with the NPC'] },
                        { icon: '🗓️', title: 'Data Retention', items: ['Your data is retained only as long as necessary for platform purposes.', 'Data is deleted or anonymized when your account is removed.'] },
                        { icon: '📬', title: 'Contact Our Data Protection Officer', items: ['Contact us through the LearnBridge admin messaging system.'] },
                      ].map(section => (
                        <div key={section.title} style={{ marginBottom: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 18 }}>{section.icon}</span>
                            <div style={{ fontWeight: 700, fontSize: 14, color: tokens.dark }}>{section.title}</div>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 26, display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {section.items.map((item, i) => <li key={i} style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.6 }}>{item}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.border}`, flexShrink: 0 }}>
                      <button className="btn btn-primary btn-full" onClick={() => { setShowModal(null); setAgreed(true); }}>✓ I Understand &amp; Agree</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {currentStep === 'Info' && (
            <>
              <h2 className="font-jakarta font-extrabold mb-4" style={{ fontSize: 22 }}>{role === 'tutor' ? 'Your Information' : 'Create Account'}</h2>
              <p className="text-sm text-muted mb-20">{role === 'tutor' ? 'Fill in your professional details.' : 'Join LearnBridge as a parent.'}</p>
              <FormGroup label="Full Name">
                <input className="input" placeholder="e.g. Maria Santos" value={form.fullName} onChange={e => set('fullName', e.target.value)} />
              </FormGroup>
              <FormGroup label="Email Address">
                <input className="input" type="email" placeholder="you@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </FormGroup>
              {role === 'tutor' && (
                <>
                  <div className="grid-2">
                    <FormGroup label="Location">
                      <input className="input" placeholder="e.g. Quezon City" value={form.location} onChange={e => set('location', e.target.value)} />
                    </FormGroup>
                    <FormGroup label="Gender">
                      <select className="select"
                        value={['Male','Female',''].includes(form.gender) ? form.gender : 'Others'}
                        onChange={e => {
                          if (e.target.value !== 'Others') set('gender', e.target.value);
                          else set('gender', 'Others');
                        }}>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Others">Others</option>
                      </select>
                      {form.gender !== 'Male' && form.gender !== 'Female' && form.gender !== '' && (
                        <input className="input mt-8" placeholder="Please specify..."
                          value={form.gender === 'Others' ? '' : form.gender}
                          onChange={e => set('gender', e.target.value)} />
                      )}
                    </FormGroup>
                  </div>
                  <div className="grid-2">
                    <FormGroup label="Years of Experience">
                      <input className="input" type="number" min="0" placeholder="e.g. 5" value={form.yearsExperience} onChange={e => set('yearsExperience', e.target.value)} />
                    </FormGroup>
                    <FormGroup label="Proposed Rate (₱/session)">
                      <input className="input" type="number" min="0" placeholder="e.g. 350" value={form.ratePerSession} onChange={e => set('ratePerSession', e.target.value)} />
                    </FormGroup>
                  </div>
                  <FormGroup label="Specialization" hint="Select all subjects you want to teach.">
                    <div className="flex gap-10">
                      {['english','mathematics'].map(s => (
                        <button key={s} type="button" onClick={() => toggleSpec(s)} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${form.specialization.includes(s) ? tokens.primary : tokens.border}`, background: form.specialization.includes(s) ? tokens.primaryLight : '#FAFAFA', color: form.specialization.includes(s) ? tokens.primary : tokens.mid, fontWeight: 600, fontSize: 14, textTransform: 'capitalize', transition: 'all 0.15s' }}>
                          {form.specialization.includes(s) ? '✓ ' : ''}{s}
                        </button>
                      ))}
                    </div>
                  </FormGroup>
                  <FormGroup label="Short Bio" hint="Tell parents about your teaching style.">
                    <textarea className="textarea" placeholder="e.g. Licensed teacher with 5 years experience..." value={form.bio} onChange={e => set('bio', e.target.value)} style={{ minHeight: 80 }} />
                  </FormGroup>
                </>
              )}
              <FormGroup label="Password">
                <div style={{ position: 'relative' }}>
                  <input className="input" type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" value={form.password} onChange={e => set('password', e.target.value)} style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: tokens.muted, fontSize: 13, fontWeight: 600, padding: 0 }}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
                {form.password && pwStrength && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                      {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= pwStrength.passed ? pwStrength.color : '#E5E7EB', transition: 'background 0.2s' }} />)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {pwStrength.missing.length > 0 && <span style={{ fontSize: 11, color: tokens.muted }}>Missing: {pwStrength.missing.join(', ')}</span>}
                      <span style={{ fontSize: 11, fontWeight: 700, color: pwStrength.color, marginLeft: 'auto' }}>{pwStrength.strength}</span>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {[{ key: 'length', label: 'At least 8 characters' }, { key: 'uppercase', label: 'Uppercase letter (A-Z)' }, { key: 'number', label: 'Number (0-9)' }, { key: 'special', label: 'Special character (!@#$...)' }].map(({ key, label }) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, background: pwStrength.checks[key] ? '#D1FAE5' : '#F3F4F6', color: pwStrength.checks[key] ? '#16A34A' : '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{pwStrength.checks[key] ? '✓' : '✕'}</span>
                          <span style={{ fontSize: 11, color: pwStrength.checks[key] ? '#16A34A' : tokens.muted }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </FormGroup>
              <FormGroup label="Confirm Password">
                <div style={{ position: 'relative' }}>
                  <input className="input" type={showConfirmPw ? 'text' : 'password'} placeholder="Repeat password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowConfirmPw(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: tokens.muted, fontSize: 13, fontWeight: 600, padding: 0 }}>{showConfirmPw ? 'Hide' : 'Show'}</button>
                </div>
                {form.confirmPassword && (
                  <div style={{ marginTop: 5, fontSize: 11, fontWeight: 600, color: form.password === form.confirmPassword ? '#16A34A' : '#DC2626' }}>
                    {form.password === form.confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                  </div>
                )}
              </FormGroup>
            </>
          )}

          {currentStep === 'Documents' && (
            <>
              <h2 className="font-jakarta font-extrabold mb-4" style={{ fontSize: 20 }}>📁 Upload Documents</h2>
              <p className="text-sm text-muted mb-4">All 4 documents are required. PDF only, max 20MB each.</p>
              <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#92400E', display: 'flex', gap: 8 }}>
                <Icon name="alertCircle" size={14} color="#92400E" />
                <span><strong>PDF files only.</strong> Each must not exceed <strong>20MB</strong>.</span>
              </div>
              {[
                { key: 'nbi',             label: 'NBI Clearance',      icon: '🪪', hint: 'Valid within last 6 months'         },
                { key: 'prc',             label: 'PRC License',         icon: '📄', hint: 'Professional Regulation Commission' },
                { key: 'medical',         label: 'Medical Certificate', icon: '🏥', hint: 'Issued by licensed physician'        },
                { key: 'applicationForm', label: 'Application Form',    icon: '📋', hint: 'Your completed application form'    },
              ].map(doc => (
                <div key={doc.key} style={{ border: `1.5px solid ${docs[doc.key] ? tokens.success : docErrors[doc.key] ? '#FCA5A5' : tokens.border}`, borderRadius: 12, padding: 14, marginBottom: 12, background: docs[doc.key] ? '#F0FDF4' : '#FAFAFA' }}>
                  <div className="flex items-center gap-12">
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{doc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold" style={{ fontSize: 13 }}>{doc.label} <span style={{ color: '#DC2626' }}>*</span></div>
                      <div className="text-xs text-muted">{doc.hint} · PDF only, max 20MB</div>
                      {docs[doc.key] && <div style={{ fontSize: 11, color: '#16A34A', marginTop: 4, fontWeight: 600 }}>✓ {docs[doc.key].name} ({(docs[doc.key].size/1024/1024).toFixed(1)}MB)</div>}
                      {docErrors[doc.key] && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>⚠ {docErrors[doc.key]}</div>}
                    </div>
                    <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                      <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => handleFileChange(doc.key, e)} />
                      <span className="btn btn-sm" style={{ background: docs[doc.key] ? '#D1FAE5' : tokens.primaryLight, color: docs[doc.key] ? '#065F46' : tokens.primary, border: `1px solid ${docs[doc.key] ? '#6EE7B7' : tokens.primary + '40'}` }}>
                        {docs[doc.key] ? '✓ Uploaded' : '⬆ Upload PDF'}
                      </span>
                    </label>
                  </div>
                </div>
              ))}
              <div style={{ marginBottom: 8 }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted">Documents uploaded</span>
                  <span className="text-xs font-semibold">{Object.values(docs).filter(Boolean).length} / 4</span>
                </div>
                <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${(Object.values(docs).filter(Boolean).length / 4) * 100}%`, background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.success})`, transition: 'width 0.3s' }} />
                </div>
              </div>
            </>
          )}

          {error && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#DC2626' }}>⚠ {error}</div>
          )}

          <div className="flex gap-10 mt-20">
            {step > 0 && <button type="button" className="btn btn-ghost" onClick={() => { setStep(s => s - 1); setError(''); }}>← Back</button>}
            <button type="button" className="btn btn-primary btn-full btn-lg" onClick={handleNext} disabled={loading}>
              {loading ? <Spinner /> : currentStep === 'Documents' ? 'Next: AI Assessment →' : currentStep === steps[steps.length - 1] ? 'Create Account' : 'Continue →'}
            </button>
          </div>
          <p className="text-sm text-muted mt-20 text-center">Already have an account? <Link to="/login" style={{ color: tokens.primary, fontWeight: 600 }}>Sign In</Link></p>
        </div>
      )}
    </div>
  );
}