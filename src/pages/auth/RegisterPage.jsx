import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import FormGroup from '../../components/ui/FormGroup';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const MAX_PDF_BYTES   = 20 * 1024 * 1024; // 20MB
const PASS_SCORE      = 75;
const TOTAL_QUESTIONS = 10;
const EXAM_MINUTES    = 30;

// ── Curriculum context for OpenAI ────────────────────────────────────────
const ENGLISH_CONTEXT = `
PHILIPPINE K–12 ENGLISH CURRICULUM (DepEd):
Grade 2: Phonemic awareness, decoding CVC words, sight words, simple sentence structure, reading short stories, writing simple sentences.
Grade 3: Fluency reading, main idea and details, cause and effect, adjectives, adverbs, compound words, paragraph writing, story elements.
Grade 4: Inferencing, context clues, prefixes/suffixes, figurative language, subject-verb agreement, paragraph organization, summarizing.
Grade 5: Critical reading, author's purpose, point of view, persuasive writing, complex sentences, grammar (active/passive voice, tenses).
Grade 6: Analysis and synthesis, argumentative writing, research skills, complex grammar, idioms, text types (narrative, expository, persuasive).

COMMON STUDENT MISCONCEPTIONS:
- Confusing their/there/they're, your/you're
- Subject-verb agreement errors
- Run-on sentences and comma splices
- Filipino students struggle with articles (a, an, the) due to Tagalog influence
- Direct translation errors from Filipino to English

PEDAGOGICAL APPROACHES:
- Whole Language vs Phonics, Guided Reading strategies
- Scaffolding for ESL learners, KWL charts, Bloom's Taxonomy`;

const MATH_CONTEXT = `
PHILIPPINE K–12 MATHEMATICS CURRICULUM (DepEd):
Grade 2: Place value to 1000, addition/subtraction with regrouping, multiplication as repeated addition, basic fractions, measurement, basic geometry.
Grade 3: Place value to 10000, multiplication tables (1-10), division, fractions on number line, perimeter, bar graphs.
Grade 4: Large numbers, multi-digit multiplication/division, equivalent fractions, decimal concepts, area and perimeter, angles.
Grade 5: Fractions operations, decimal operations, ratio and proportion, percentage, volume of rectangular prisms.
Grade 6: Integers, algebraic expressions, geometry (circles, polygons), statistics (mean, median, mode), probability.

COMMON STUDENT MISCONCEPTIONS:
- "Multiplication always makes bigger" (false for fractions)
- Adding numerators AND denominators: 1/2 + 1/3 = 2/5 (wrong)
- Confusing perimeter and area
- Decimal alignment errors (0.8 vs 0.75)
- Regrouping/borrowing errors in subtraction

PEDAGOGICAL APPROACHES:
- Concrete-Pictorial-Abstract (CPA) progression
- Singapore Math model method, constructivist approach
- Manipulatives: base-ten blocks, fraction strips`;

function buildExamPrompt(subject) {
  const name    = subject === 'english' ? 'English Language Arts' : 'Mathematics';
  const context = subject === 'english' ? ENGLISH_CONTEXT : MATH_CONTEXT;
  return `You are a professional licensure examiner creating a certification test for tutors who will teach Grade 2–6 Filipino elementary students under the DepEd K–12 curriculum.

${context}

Generate exactly ${TOTAL_QUESTIONS} multiple-choice questions to verify the tutor has DEEP PROFESSIONAL KNOWLEDGE of ${name}.

QUESTION MIX (must follow this):
- 3 questions: CONTENT KNOWLEDGE (deep subject mastery)
- 3 questions: COMMON MISCONCEPTIONS (identify and correct student errors)
- 2 questions: PEDAGOGY (best teaching strategies and approaches)
- 2 questions: CURRICULUM APPLICATION (DepEd K-12 grade-level standards)

RULES:
- Questions must be at COLLEGE/PROFESSIONAL TEACHER level — not student level
- All 4 options must be plausible — no obviously wrong answers
- Base on real Philippine classroom scenarios
- Correct answer requires genuine expertise to identify

Return ONLY a valid JSON array, no markdown, no explanation, just the array:
[{"question":"...","options":["A text","B text","C text","D text"],"correct":0,"explanation":"..."}]

Generate exactly ${TOTAL_QUESTIONS} questions now.`;
}

async function generateExamQuestions(subject) {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 3000,
      temperature: 0.8,
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
const STEPS_PARENT = ['Info'];

// ── Step indicator labels ─────────────────────────────────────────────────
const STEP_META = {
  Terms:      { icon: '📄', label: 'Terms'      },
  Info:       { icon: '👤', label: 'Info'       },
  Documents:  { icon: '📁', label: 'Documents'  },
  Assessment: { icon: '🧠', label: 'Assessment' },
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, signOut } = useAuth();

  const [role,   setRole]   = useState('parent');
  const [step,   setStep]   = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [error,  setError]  = useState('');
  const [loading,setLoading]= useState(false);

  // Info form
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    location: '', gender: '', yearsExperience: '', ratePerSession: '',
    specialization: [], bio: '',
  });

  // Documents
  const [docs,      setDocs]      = useState({ nbi: null, prc: null, medical: null, resume: null });
  const [docErrors, setDocErrors] = useState({ nbi: '', prc: '', medical: '', resume: '' });

  // Assessment state
  const [examSubjects,  setExamSubjects]  = useState([]);   // which subjects to take
  const [examPhase,     setExamPhase]     = useState('select'); // select|loading|exam|result|done
  const [currentSubj,   setCurrentSubj]   = useState(null);
  const [questions,     setQuestions]     = useState([]);
  const [currentQ,      setCurrentQ]      = useState(0);
  const [answers,       setAnswers]       = useState({});
  const [timeLeft,      setTimeLeft]      = useState(EXAM_MINUTES * 60);
  const [allResults,    setAllResults]    = useState({}); // { english: score, mathematics: score }
  const [subjectsQueue, setSubjectsQueue] = useState([]); // remaining subjects to test
  const timerRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleSpec = (s) => setForm(f => ({
    ...f,
    specialization: f.specialization.includes(s)
      ? f.specialization.filter(x => x !== s)
      : [...f.specialization, s],
  }));

  const steps = role === 'tutor' ? STEPS_TUTOR : STEPS_PARENT;
  const currentStep = steps[step];

  const handleRoleChange = (r) => { setRole(r); setStep(0); setAgreed(false); setError(''); };

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  // ── Timer for exam ────────────────────────────────────────────────────
  useEffect(() => {
    if (examPhase !== 'exam') return;
    if (timeLeft <= 0) { handleExamSubmit(); return; }
    timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examPhase, timeLeft]);

  // ── Step navigation ───────────────────────────────────────────────────
  const handleNext = (e) => {
    e?.preventDefault();
    setError('');

    if (currentStep === 'Terms') {
      if (!agreed) { setError('You must agree to the Terms and Conditions.'); return; }
      setStep(s => s + 1);
      return;
    }

    if (currentStep === 'Info') {
      if (!form.fullName.trim())   { setError('Please enter your full name.'); return; }
      if (!form.email.trim())      { setError('Please enter your email.'); return; }
      if (form.password.length < 8){ setError('Password must be at least 8 characters.'); return; }
      if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
      if (role === 'tutor' && form.specialization.length === 0) {
        setError('Please select at least one subject.'); return;
      }
      if (step === steps.length - 1) { handleSubmitParent(); return; }
      setStep(s => s + 1);
      return;
    }

    if (currentStep === 'Documents') {
      const errs = {
        nbi:     validatePDF(docs.nbi)     || '',
        prc:     validatePDF(docs.prc)     || '',
        medical: validatePDF(docs.medical) || '',
        resume:  validatePDF(docs.resume)  || '',
      };
      setDocErrors(errs);
      if (Object.values(errs).some(Boolean)) {
        setError('Please upload all 4 required PDF documents.'); return;
      }
      // Go to Assessment step
      setExamSubjects(form.specialization);
      setExamPhase('select');
      setStep(s => s + 1);
      return;
    }

    if (currentStep === 'Assessment') {
      // Assessment handles its own navigation
    }
  };

  // ── File change handler ───────────────────────────────────────────────
  const handleFileChange = (key, e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const err = validatePDF(file);
    setDocErrors(prev => ({ ...prev, [key]: err || '' }));
    setDocs(prev => ({ ...prev, [key]: err ? null : file }));
  };

  // ── Start exam for a subject ──────────────────────────────────────────
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

  // ── Submit current exam ───────────────────────────────────────────────
  const handleExamSubmit = () => {
    clearInterval(timerRef.current);
    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.correct) correct++; });
    const score   = Math.round((correct / questions.length) * 100);
    const newResults = { ...allResults, [currentSubj]: score };
    setAllResults(newResults);
    setExamPhase('result');
  };

  // ── After seeing result, continue to next subject or finish ───────────
  const handleContinueAfterResult = () => {
    const remaining = subjectsQueue.filter(s => s !== currentSubj);
    setSubjectsQueue(remaining);
    if (remaining.length > 0) {
      setExamPhase('select');
    } else {
      setExamPhase('done');
    }
  };

  // ── Final registration submit ─────────────────────────────────────────
const handleFinalSubmit = async () => {
  setLoading(true);
  setError('');
  try {
    // Step 1: Create auth account + base profile
    const result = await signUp({
      email:    form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      role,
    });

    const userId = result?.user?.id;
    if (!userId) throw new Error('Account creation failed — no user ID returned.');

    // Step 2: Update profile with extra fields
    await supabase.from('profiles').update({
      location: form.location  || null,
      gender:   form.gender    || null,
      bio:      form.bio       || null,
    }).eq('id', userId);

    // Step 3: Upload documents to storage
    const urls = {};
    const docMap = [
      { key: 'nbi',     file: docs.nbi,     storageName: 'nbi.pdf',     column: 'nbi_clearance_url'  },
      { key: 'prc',     file: docs.prc,     storageName: 'prc.pdf',     column: 'prc_license_url'    },
      { key: 'medical', file: docs.medical, storageName: 'medical.pdf', column: 'medical_cert_url'   },
      { key: 'resume',  file: docs.resume,  storageName: 'resume.pdf',  column: 'resume_url'         },
    ];

    for (const doc of docMap) {
      if (!doc.file) continue;
      const path = `${userId}/${doc.storageName}`;
      const { error: upErr } = await supabase.storage
        .from('tutor-documents')
        .upload(path, doc.file, { upsert: true, contentType: 'application/pdf' });
      if (upErr) throw new Error(`Failed to upload ${doc.key}: ${upErr.message}`);
      const { data: urlData } = supabase.storage
        .from('tutor-documents')
        .getPublicUrl(path);
      urls[doc.column] = urlData?.publicUrl || path;
    }

    // Step 4: Upsert tutors row with all fields + exam scores
    const strengthSubjects = Object.entries(allResults)
      .filter(([, score]) => score >= PASS_SCORE)
      .map(([subject]) => subject);

    await supabase.from('tutors').upsert({
      id:                   userId,
      years_experience:     Number(form.yearsExperience) || 0,
      rate_per_session:     Number(form.ratePerSession)  || null,
      specialization:       strengthSubjects.length > 0 ? strengthSubjects : form.specialization,
      certification_scores: Object.keys(allResults).length > 0 ? allResults : null,
      nbi_clearance_url:    urls['nbi_clearance_url']  || null,
      prc_license_url:      urls['prc_license_url']    || null,
      medical_cert_url:     urls['medical_cert_url']   || null,
      resume_url:           urls['resume_url']         || null,
      status:               'pending',
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
      await signUp({
        email:    form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role,
      });
      await signOut();
      navigate('/login', { state: { justRegistered: true } });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${tokens.primaryLight}, #fff, #FEF3C7)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      {/* Brand */}
      <div className="flex items-center gap-10 mb-24">
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: tokens.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>LB</span>
        </div>
        <div>
          <div className="font-jakarta font-extrabold" style={{ fontSize: 18 }}>LearnBridge</div>
          <div className="text-xs text-muted">{role === 'tutor' ? 'Become a Tutor' : 'Create Account'}</div>
        </div>
      </div>

      {/* Step indicator for tutor */}
      {role === 'tutor' && (
        <div className="flex items-center gap-0 mb-24" style={{
          background: '#fff', borderRadius: 14, padding: '14px 28px',
          boxShadow: '0 2px 12px rgba(0,0,0,.07)',
        }}>
          {STEPS_TUTOR.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-8">
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: i < step ? tokens.success : i === step ? tokens.primary : '#E5E7EB',
                  color: i <= step ? '#fff' : tokens.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13, flexShrink: 0,
                  transition: 'all 0.3s',
                }}>
                  {i < step ? '✓' : STEP_META[label]?.icon}
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: i === step ? tokens.primary : i < step ? tokens.success : tokens.muted,
                }}>
                  {label}
                </span>
              </div>
              {i < STEPS_TUTOR.length - 1 && (
                <div style={{
                  width: 40, height: 2, margin: '0 12px',
                  background: i < step ? tokens.success : '#E5E7EB',
                  borderRadius: 2, transition: 'all 0.3s',
                }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ASSESSMENT STEP — full-width, no card wrapper ── */}
      {currentStep === 'Assessment' ? (
        <div style={{ width: '100%', maxWidth: 680 }}>
          {/* ── SUBJECT SELECT ── */}
          {examPhase === 'select' && (
            <div className="card fade-in" style={{ padding: 36 }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🧠</div>
                <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>AI Certification Assessment</h2>
                <p className="text-sm text-muted mt-8" style={{ lineHeight: 1.7 }}>
                  You will take an AI-generated exam for each subject you selected.
                  <br/>Each exam has <strong>{TOTAL_QUESTIONS} questions</strong> and a <strong>{EXAM_MINUTES}-minute</strong> time limit.
                  <br/>A score of <strong>{PASS_SCORE}%+</strong> confirms your strength in that subject.
                </p>
              </div>

              {/* Difficulty notice */}
              <div style={{
                background: '#EFF6FF', border: '1px solid #BFDBFE',
                borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                fontSize: 13, color: '#1D4ED8', display: 'flex', gap: 10,
              }}>
                <span>📋</span>
                <span>Questions are at a <strong>professional/college level</strong> — testing your subject mastery and teaching methodology for Grade 2–6 learners.</span>
              </div>

              {error && (
                <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
                  ❌ {error}
                </div>
              )}

              {/* Results so far */}
              {Object.keys(allResults).length > 0 && (
                <div style={{ background: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div className="font-semibold mb-10" style={{ fontSize: 13 }}>Results so far:</div>
                  {Object.entries(allResults).map(([subj, score]) => (
                    <div key={subj} className="flex items-center justify-between mb-6">
                      <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{subj}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: score >= PASS_SCORE ? '#D1FAE5' : '#FEE2E2',
                        color:      score >= PASS_SCORE ? '#065F46' : '#DC2626',
                      }}>
                        {score}% {score >= PASS_SCORE ? '✓ Passed' : '✗ Below pass mark'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Subject buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {examSubjects.map(subj => {
                  const done  = allResults[subj] !== undefined;
                  const score = allResults[subj];
                  return (
                    <button
                      key={subj}
                      onClick={() => {
                        setSubjectsQueue(examSubjects.filter(s => !allResults[s] !== undefined));
                        startExam(subj);
                      }}
                      style={{
                        padding: '16px 20px', borderRadius: 12, cursor: 'pointer',
                        border: `2px solid ${done ? (score >= PASS_SCORE ? '#6EE7B7' : '#FCA5A5') : tokens.primary}`,
                        background: done ? (score >= PASS_SCORE ? '#F0FDF4' : '#FEF2F2') : tokens.primaryLight,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>
                          {subj === 'english' ? '📖 English' : '🔢 Mathematics'}
                        </div>
                        <div style={{ fontSize: 12, color: tokens.muted, marginTop: 3 }}>
                          {done
                            ? `Score: ${score}% — ${score >= PASS_SCORE ? 'Passed' : 'Retake to improve'}`
                            : `${TOTAL_QUESTIONS} questions · ${EXAM_MINUTES} minutes`}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 13, fontWeight: 700, padding: '6px 14px', borderRadius: 20,
                        background: done ? (score >= PASS_SCORE ? '#D1FAE5' : '#FEE2E2') : tokens.primary,
                        color: done ? (score >= PASS_SCORE ? '#065F46' : '#DC2626') : '#fff',
                      }}>
                        {done ? (score >= PASS_SCORE ? '✓ Done' : '↺ Retake') : 'Start →'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Finish button — shown when all subjects attempted */}
              {examSubjects.every(s => allResults[s] !== undefined) && (
                <button
                  className="btn btn-primary btn-full btn-lg"
                  onClick={() => setExamPhase('done')}
                >
                  Finish & Submit Registration →
                </button>
              )}

              <p className="text-xs text-muted mt-12 text-center">
                You can retake any subject exam to improve your score before submitting.
              </p>
            </div>
          )}

          {/* ── LOADING ── */}
          {examPhase === 'loading' && (
            <div className="card" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🧠</div>
              <Spinner dark size={32} />
              <div className="font-jakarta font-bold mt-16" style={{ fontSize: 18 }}>Generating Your Exam...</div>
              <p className="text-sm text-muted mt-8">
                AI is creating {TOTAL_QUESTIONS} unique questions for{' '}
                <strong style={{ textTransform: 'capitalize' }}>{currentSubj}</strong>.<br/>
                This takes about 5–10 seconds.
              </p>
            </div>
          )}

          {/* ── EXAM ── */}
          {examPhase === 'exam' && questions[currentQ] && (
            <div className="fade-in">
              {/* Timer + progress */}
              <div className="card p-16 mb-16 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted mb-4" style={{ textTransform: 'capitalize' }}>
                    {currentSubj} · Question {currentQ + 1} of {questions.length}
                  </div>
                  <div style={{ width: 220, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${((currentQ + 1) / questions.length) * 100}%`,
                      background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.accent})`,
                    }} />
                  </div>
                </div>
                <div className="font-jakarta font-extrabold" style={{
                  fontSize: 26, color: timeLeft < 300 ? '#DC2626' : tokens.dark,
                }}>
                  ⏱ {fmtTime(timeLeft)}
                </div>
              </div>

              <div className="card p-28">
                <h3 className="font-jakarta font-bold mb-24" style={{ fontSize: 17, lineHeight: 1.5 }}>
                  {questions[currentQ].question}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {questions[currentQ].options.map((opt, i) => {
                    const selected = answers[currentQ] === i;
                    return (
                      <button
                        key={i}
                        onClick={() => setAnswers(a => ({ ...a, [currentQ]: i }))}
                        style={{
                          padding: '13px 18px', borderRadius: 10, cursor: 'pointer',
                          border: `2px solid ${selected ? tokens.primary : tokens.border}`,
                          background: selected ? tokens.primaryLight : '#FAFAFA',
                          color: selected ? tokens.primary : tokens.dark,
                          textAlign: 'left', fontSize: 14,
                          fontWeight: selected ? 600 : 400,
                          transition: 'all 0.15s',
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                        }}
                      >
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          background: selected ? tokens.primary : '#E5E7EB',
                          color: selected ? '#fff' : tokens.mid,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, marginTop: 1,
                        }}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between">
                  <button className="btn btn-ghost" disabled={currentQ === 0} onClick={() => setCurrentQ(q => q - 1)}>
                    ← Previous
                  </button>
                  {currentQ < questions.length - 1 ? (
                    <button className="btn btn-primary" onClick={() => setCurrentQ(q => q + 1)}>
                      Next →
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={handleExamSubmit}>
                      <Icon name="check" size={14} /> Submit Exam
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── RESULT ── */}
          {examPhase === 'result' && (
            <div className="card fade-in p-40 text-center">
              <div style={{
                width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
                background: allResults[currentSubj] >= PASS_SCORE ? '#D1FAE5' : '#FEE2E2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
              }}>
                {allResults[currentSubj] >= PASS_SCORE ? '🎓' : '📝'}
              </div>

              <h2 className="font-jakarta font-extrabold mb-8" style={{
                fontSize: 24,
                color: allResults[currentSubj] >= PASS_SCORE ? tokens.success : '#DC2626',
              }}>
                {allResults[currentSubj] >= PASS_SCORE ? 'Subject Passed!' : 'Keep Practicing'}
              </h2>

              <p className="text-sm text-muted mb-20" style={{ lineHeight: 1.6 }}>
                Your score for <strong style={{ textTransform: 'capitalize' }}>{currentSubj}</strong>:{' '}
                <strong style={{ fontSize: 20, color: allResults[currentSubj] >= PASS_SCORE ? tokens.success : '#DC2626' }}>
                  {allResults[currentSubj]}%
                </strong>
              </p>

              {/* Score bar */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ height: 12, background: '#E5E7EB', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: `${PASS_SCORE}%`, top: 0, bottom: 0,
                    width: 2, background: '#374151', zIndex: 2,
                  }} />
                  <div style={{
                    height: '100%', borderRadius: 6,
                    width: `${allResults[currentSubj]}%`,
                    background: allResults[currentSubj] >= PASS_SCORE
                      ? `linear-gradient(90deg, ${tokens.success}, #4ADE80)`
                      : `linear-gradient(90deg, #F87171, #DC2626)`,
                    transition: 'width 1s ease',
                  }} />
                </div>
                <div className="flex justify-between mt-4">
                  <span style={{ fontSize: 11, color: tokens.muted }}>0%</span>
                  <span style={{ fontSize: 11, color: '#374151', fontWeight: 700 }}>{PASS_SCORE}% pass mark</span>
                  <span style={{ fontSize: 11, color: tokens.muted }}>100%</span>
                </div>
              </div>

              {allResults[currentSubj] < PASS_SCORE && (
                <div style={{
                  background: '#FFF7ED', border: '1px solid #FED7AA',
                  borderRadius: 10, padding: '10px 16px', marginBottom: 16,
                  fontSize: 13, color: '#92400E', textAlign: 'left',
                }}>
                  💡 You did not pass this subject but you can still submit your registration. Your score is recorded and can be improved after admin approval.
                </div>
              )}

              <div className="flex gap-10">
                {allResults[currentSubj] < PASS_SCORE && (
                  <button className="btn btn-outline btn-full" onClick={() => startExam(currentSubj)}>
                    ↺ Retake This Exam
                  </button>
                )}
                <button className="btn btn-primary btn-full" onClick={handleContinueAfterResult}>
                  {examSubjects.filter(s => !allResults[s]).length > 0
                    ? `Next Subject →`
                    : `View All Results →`}
                </button>
              </div>
            </div>
          )}

          {/* ── DONE — all subjects completed ── */}
          {examPhase === 'done' && (
            <div className="card fade-in p-40 text-center">
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <h2 className="font-jakarta font-extrabold mb-8" style={{ fontSize: 22 }}>Assessment Complete!</h2>
              <p className="text-sm text-muted mb-24" style={{ lineHeight: 1.6 }}>
                Here are your final results. Your scores and strengths will be saved to your profile.
              </p>

              {/* Final scores */}
              <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 20, marginBottom: 24, textAlign: 'left' }}>
                <div className="font-semibold mb-14" style={{ fontSize: 14 }}>📊 Your Assessment Results</div>
                {Object.entries(allResults).map(([subj, score]) => (
                  <div key={subj} style={{ marginBottom: 14 }}>
                    <div className="flex items-center justify-between mb-6">
                      <span style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>
                        {subj === 'english' ? '📖 English' : '🔢 Mathematics'}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: score >= PASS_SCORE ? '#D1FAE5' : '#FEF3C7',
                        color:      score >= PASS_SCORE ? '#065F46' : '#92400E',
                      }}>
                        {score}% — {score >= PASS_SCORE ? '⭐ Strength Subject' : 'Needs Improvement'}
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4, width: `${score}%`,
                        background: score >= PASS_SCORE ? tokens.success : '#F59E0B',
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Strength subjects */}
              {Object.entries(allResults).some(([, s]) => s >= PASS_SCORE) && (
                <div style={{
                  background: '#D1FAE5', border: '1px solid #6EE7B7',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                  fontSize: 13, color: '#065F46', textAlign: 'left',
                }}>
                  <strong>⭐ Your Strength Subjects:</strong>{' '}
                  {Object.entries(allResults)
                    .filter(([, s]) => s >= PASS_SCORE)
                    .map(([subj]) => subj.charAt(0).toUpperCase() + subj.slice(1))
                    .join(' & ')}
                  <br/>
                  <span style={{ fontSize: 12 }}>These will be highlighted on your profile visible to parents.</span>
                </div>
              )}

              {error && (
                <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
                  ❌ {error}
                </div>
              )}

              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={handleFinalSubmit}
                disabled={loading}
              >
                {loading ? <><Spinner /> Submitting Registration...</> : <>Submit Registration & Go to Pending →</>}
              </button>

              <p className="text-xs text-muted mt-12">
                Your documents and exam results will be reviewed by the admin team within 1–3 business days.
              </p>
            </div>
          )}
        </div>

      ) : (

        /* ── ALL OTHER STEPS inside a card ── */
        <div className="card fade-in" style={{
          width: '100%',
          maxWidth: currentStep === 'Terms' ? 640 : currentStep === 'Documents' ? 580 : 480,
          padding: 36,
        }}>

          {/* Role selector on first step */}
          {step === 0 && (
            <div className="form-group mb-20">
              <label className="form-label">I want to register as...</label>
              <div className="flex gap-8">
                {['parent', 'tutor'].map(r => (
                  <button key={r} type="button" onClick={() => handleRoleChange(r)} className="btn" style={{
                    flex: 1, justifyContent: 'center',
                    background: role === r ? tokens.primary : '#fff',
                    color:      role === r ? '#fff' : tokens.mid,
                    border:     `1.5px solid ${role === r ? tokens.primary : tokens.border}`,
                  }}>
                    <Icon name={r === 'parent' ? 'users' : 'award'} size={14} color={role === r ? '#fff' : tokens.mid} />
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── TERMS ── */}
          {currentStep === 'Terms' && (
            <>
              <h2 className="font-jakarta font-extrabold mb-4" style={{ fontSize: 20 }}>📄 Terms & Conditions</h2>
              <p className="text-sm text-muted mb-16">Please read carefully before registering as a tutor.</p>
              <div style={{
                maxHeight: 320, overflowY: 'auto',
                border: `1px solid ${tokens.border}`, borderRadius: 10,
                padding: 18, fontSize: 13, color: tokens.mid, lineHeight: 1.75,
                marginBottom: 16, whiteSpace: 'pre-wrap',
              }}>
{`1. Platform Agreement
By registering as a tutor on LearnBridge, you agree to provide honest, accurate information about your qualifications. You agree to maintain professional conduct at all times.

2. Document Requirements
All tutors must submit NBI Clearance, PRC License, Medical Certificate, and Resume (PDF only, max 20MB each). Falsified documents result in permanent termination.

3. AI Certification Assessment
During registration, you will take an AI-powered exam for each subject you wish to teach (English and/or Mathematics). Your scores determine your strength subjects shown to parents. You may retake exams before submitting.

4. Session Conduct & Payments
A 10% platform commission is automatically deducted from your wallet after each completed session. Tutors must maintain sufficient wallet balance to accept bookings.

5. Code of Conduct
Maintain professionalism and provide quality instruction at all times. Misconduct may result in immediate account suspension.

6. Privacy & Data
All personal information and documents are stored securely and used solely for platform operation.`}
              </div>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                padding: '12px 16px', marginBottom: 16,
                background: agreed ? tokens.primaryLight : '#FAFAFA',
                border: `1.5px solid ${agreed ? tokens.primary : tokens.border}`,
                borderRadius: 10, transition: 'all 0.15s',
              }}>
                <input
                  type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  style={{ marginTop: 3, accentColor: tokens.primary, width: 16, height: 16, flexShrink: 0 }}
                />
                <span className="text-sm" style={{ color: tokens.dark, lineHeight: 1.5 }}>
                  I have read and agree to the LearnBridge Tutor Terms & Conditions, including submitting to document verification and the AI Certification Assessment.
                </span>
              </label>
            </>
          )}

          {/* ── INFO ── */}
          {currentStep === 'Info' && (
            <>
              <h2 className="font-jakarta font-extrabold mb-4" style={{ fontSize: 22 }}>
                {role === 'tutor' ? 'Your Information' : 'Create Account'}
              </h2>
              <p className="text-sm text-muted mb-20">
                {role === 'tutor' ? 'Fill in your professional details.' : 'Join LearnBridge as a parent.'}
              </p>
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
                      <select className="select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
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
                        <button key={s} type="button" onClick={() => toggleSpec(s)} style={{
                          flex: 1, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                          border: `2px solid ${form.specialization.includes(s) ? tokens.primary : tokens.border}`,
                          background: form.specialization.includes(s) ? tokens.primaryLight : '#FAFAFA',
                          color: form.specialization.includes(s) ? tokens.primary : tokens.mid,
                          fontWeight: 600, fontSize: 14, textTransform: 'capitalize',
                          transition: 'all 0.15s',
                        }}>
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
              <div className="grid-2">
                <FormGroup label="Password">
                  <input className="input" type="password" placeholder="Min. 8 characters" value={form.password} onChange={e => set('password', e.target.value)} />
                </FormGroup>
                <FormGroup label="Confirm Password">
                  <input className="input" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
                </FormGroup>
              </div>
            </>
          )}

          {/* ── DOCUMENTS ── */}
          {currentStep === 'Documents' && (
            <>
              <h2 className="font-jakarta font-extrabold mb-4" style={{ fontSize: 20 }}>📁 Upload Documents</h2>
              <p className="text-sm text-muted mb-4">All 4 documents are required. PDF only, max 20MB each.</p>
              <div style={{
                background: '#FEF9C3', border: '1px solid #FDE68A',
                borderRadius: 10, padding: '10px 14px', marginBottom: 20,
                fontSize: 12, color: '#92400E', display: 'flex', gap: 8,
              }}>
                <Icon name="alertCircle" size={14} color="#92400E" />
                <span><strong>PDF files only.</strong> Each must not exceed <strong>20MB</strong>.</span>
              </div>
              {[
                { key: 'nbi',     label: 'NBI Clearance',       icon: '🪪', hint: 'Valid within last 6 months' },
                { key: 'prc',     label: 'PRC License',          icon: '📄', hint: 'Professional Regulation Commission' },
                { key: 'medical', label: 'Medical Certificate',  icon: '🏥', hint: 'Issued by licensed physician' },
                { key: 'resume',  label: 'Resume / CV',           icon: '📋', hint: 'Educational background and experience' },
              ].map(doc => (
                <div key={doc.key} style={{
                  border: `1.5px solid ${docs[doc.key] ? tokens.success : docErrors[doc.key] ? '#FCA5A5' : tokens.border}`,
                  borderRadius: 12, padding: 14, marginBottom: 12,
                  background: docs[doc.key] ? '#F0FDF4' : '#FAFAFA',
                }}>
                  <div className="flex items-center gap-12">
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{doc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold" style={{ fontSize: 13 }}>
                        {doc.label} <span style={{ color: '#DC2626' }}>*</span>
                      </div>
                      <div className="text-xs text-muted">{doc.hint} · PDF only, max 20MB</div>
                      {docs[doc.key] && (
                        <div style={{ fontSize: 11, color: '#16A34A', marginTop: 4, fontWeight: 600 }}>
                          ✓ {docs[doc.key].name} ({(docs[doc.key].size/1024/1024).toFixed(1)}MB)
                        </div>
                      )}
                      {docErrors[doc.key] && (
                        <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>⚠ {docErrors[doc.key]}</div>
                      )}
                    </div>
                    <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                      <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => handleFileChange(doc.key, e)} />
                      <span className="btn btn-sm" style={{
                        background: docs[doc.key] ? '#D1FAE5' : tokens.primaryLight,
                        color: docs[doc.key] ? '#065F46' : tokens.primary,
                        border: `1px solid ${docs[doc.key] ? '#6EE7B7' : tokens.primary + '40'}`,
                      }}>
                        {docs[doc.key] ? '✓ Uploaded' : '⬆ Upload PDF'}
                      </span>
                    </label>
                  </div>
                </div>
              ))}
              {/* Progress */}
              <div style={{ marginBottom: 8 }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted">Documents uploaded</span>
                  <span className="text-xs font-semibold">{Object.values(docs).filter(Boolean).length} / 4</span>
                </div>
                <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${(Object.values(docs).filter(Boolean).length / 4) * 100}%`,
                    background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.success})`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FCA5A5',
              borderRadius: 10, padding: '10px 14px', marginTop: 12,
              fontSize: 13, color: '#DC2626',
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex gap-10 mt-20">
            {step > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => { setStep(s => s - 1); setError(''); }}>
                ← Back
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-full btn-lg"
              onClick={handleNext}
              disabled={loading}
            >
              {loading ? <Spinner /> : (
                currentStep === 'Documents'
                  ? 'Next: AI Assessment →'
                  : currentStep === steps[steps.length - 1]
                  ? 'Create Account'
                  : 'Continue →'
              )}
            </button>
          </div>

          <p className="text-sm text-muted mt-20 text-center">
            Already have an account?{' '}
            <Link to="/login" style={{ color: tokens.primary, fontWeight: 600 }}>Sign In</Link>
          </p>
        </div>
      )}
    </div>
  );
}