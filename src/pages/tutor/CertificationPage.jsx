import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const PASS_SCORE    = 75;  // 75% to pass
const TOTAL_QUESTIONS = 10;
const EXAM_MINUTES  = 60;

// ── Build the OpenAI prompt for each subject ──────────────────────────────
function buildExamPrompt(subject) {
  const subjectName = subject === 'english' ? 'English Language Arts' : 'Mathematics';

  const englishCurriculum = `
PHILIPPINE K–12 ENGLISH CURRICULUM CONTEXT (DepEd):
Grade 2: Phonemic awareness, decoding CVC words, sight words, simple sentence structure, 
  reading short stories, writing simple sentences, capitalization and punctuation basics.
Grade 3: Fluency reading, main idea and details, cause and effect, adjectives, adverbs, 
  compound words, paragraph writing, story elements (character, setting, plot).
Grade 4: Inferencing, context clues, prefixes/suffixes, figurative language (simile, metaphor), 
  subject-verb agreement, paragraph organization, summarizing.
Grade 5: Critical reading, author's purpose, point of view, persuasive writing, 
  complex sentences, grammar (active/passive voice, tenses), literary devices.
Grade 6: Analysis and synthesis, argumentative writing, research skills, 
  complex grammar structures, idioms, text types (narrative, expository, persuasive).

COMMON STUDENT MISCONCEPTIONS IN ENGLISH:
- Confusing their/there/they're, your/you're
- Subject-verb agreement errors ("They was")
- Tense inconsistency in writing
- Run-on sentences and comma splices
- Literal vs inferential comprehension confusion
- Filipino students often struggle with articles (a, an, the) due to Tagalog influence
- Direct translation errors from Filipino to English

PEDAGOGICAL APPROACHES FOR ELEMENTARY ENGLISH:
- Whole Language vs Phonics debate
- Guided Reading strategies (before/during/after)
- Scaffolding techniques for ESL learners
- Differentiated instruction for mixed reading levels
- DEAR (Drop Everything And Read) program
- KWL charts, graphic organizers
- Bloom's Taxonomy applied to reading comprehension`;

  const mathCurriculum = `
PHILIPPINE K–12 MATHEMATICS CURRICULUM CONTEXT (DepEd):
Grade 2: Place value to 1000, addition/subtraction with regrouping, 
  multiplication as repeated addition, basic fractions (half, third, fourth), 
  measurement (cm, m, kg, L), basic geometry (shapes), telling time.
Grade 3: Place value to 10000, multiplication tables (1-10), 
  division as equal sharing, fractions on number line, perimeter, 
  bar graphs and pictographs, basic money problems.
Grade 4: Large numbers, multi-digit multiplication and division, 
  equivalent fractions, decimal concepts, area and perimeter, 
  angles, symmetry, data interpretation.
Grade 5: Fractions operations (add, subtract, multiply, divide), 
  decimal operations, ratio and proportion, percentage basics, 
  volume of rectangular prisms, line and bar graphs.
Grade 6: Integers, algebraic expressions, geometry (circles, polygons), 
  statistics (mean, median, mode, range), probability basics, 
  problem solving with all operations.

COMMON STUDENT MISCONCEPTIONS IN MATHEMATICS:
- "Multiplication always makes bigger" (false for fractions)
- "Division always makes smaller"
- Confusion between perimeter and area
- Adding numerators AND denominators when adding fractions (1/2 + 1/3 = 2/5)
- Zero confusion (is 0 even? is 0 a number?)
- Regrouping/borrowing errors in subtraction
- Decimal alignment errors
- "The longer the number, the bigger it is" (0.8 vs 0.75)
- Confusing mean, median, and mode

PEDAGOGICAL APPROACHES FOR ELEMENTARY MATHEMATICS:
- Concrete-Pictorial-Abstract (CPA) progression (Bruner)
- Singapore Math model method
- Number sense development vs rote memorization
- Constructivist approach (students discover patterns)
- Differentiated instruction for struggling vs advanced learners
- Error analysis as a teaching tool
- Manipulatives: base-ten blocks, fraction strips, algebra tiles
- Real-world problem contexts relevant to Filipino children`;

  const curriculum = subject === 'english' ? englishCurriculum : mathCurriculum;

  return `You are a professional licensure examiner creating a certification test for tutors 
who will teach Grade 2–6 Filipino elementary students under the DepEd K–12 curriculum.

${curriculum}

Generate exactly ${TOTAL_QUESTIONS} multiple-choice questions to verify the tutor has DEEP PROFESSIONAL 
KNOWLEDGE of ${subjectName} for elementary teaching in the Philippine context.

QUESTION REQUIREMENTS:
- Questions must be at COLLEGE or PROFESSIONAL TEACHER level
- Mix of question types:
  * 3 questions on CONTENT KNOWLEDGE (deep subject matter)
  * 3 questions on COMMON MISCONCEPTIONS (identify and correct student errors)
  * 2 questions on PEDAGOGY (best teaching strategies)
  * 2 questions on CURRICULUM APPLICATION (apply DepEd K-12 standards)
- All options (A, B, C, D) must be plausible — no obviously wrong answers
- Base questions on REAL teaching scenarios a Filipino tutor would encounter
- Make the correct answer require genuine expertise to identify

Return ONLY a valid JSON array, no markdown, no extra text:
[
  {
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Why this answer is correct"
  }
]

Generate exactly ${TOTAL_QUESTIONS} questions now.`;

}

// ── Generate questions from OpenAI ───────────────────────────────────────
async function generateQuestions(subject) {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured. Add REACT_APP_OPENAI_API_KEY to your .env file.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       'gpt-4o-mini',
      max_tokens:  2000,
      temperature: 0.8, // Some variety each attempt
      messages: [
        {
          role:    'user',
          content: buildExamPrompt(subject),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data    = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Parse JSON — strip any accidental markdown fences
  const cleaned = content.replace(/```json|```/g, '').trim();
  const questions = JSON.parse(cleaned);

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Invalid question format received from AI.');
  }

  return questions.slice(0, TOTAL_QUESTIONS);
}

export default function CertificationPage() {
  const { user, tutorData } = useAuth();
  const navigate = useNavigate();

  const [phase,      setPhase]      = useState('idle');    // idle | loading | exam | result
  const [subject,    setSubject]    = useState('english');
  const [questions,  setQuestions]  = useState([]);
  const [current,    setCurrent]    = useState(0);
  const [answers,    setAnswers]    = useState({});        // { [questionIndex]: selectedOptionIndex }
  const [timeLeft,   setTimeLeft]   = useState(EXAM_MINUTES * 60);
  const [genError,   setGenError]   = useState('');
  const [result,     setResult]     = useState(null);      // { score, passed, subject }
  const [saving,     setSaving]     = useState(false);
  const [existingScores, setExistingScores] = useState({});

  // Load existing certification scores
  useEffect(() => {
    if (!user) return;
    supabase
      .from('tutors')
      .select('certification_scores')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setExistingScores(data?.certification_scores || {});
      });
  }, [user]);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'exam') return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Start exam — generate questions via OpenAI
  const handleStartExam = async () => {
    setPhase('loading');
    setGenError('');
    setAnswers({});
    setCurrent(0);
    setTimeLeft(EXAM_MINUTES * 60);

    try {
      const qs = await generateQuestions(subject);
      setQuestions(qs);
      setPhase('exam');
    } catch (err) {
      setGenError(err.message);
      setPhase('idle');
    }
  };

  // Submit exam — calculate score and save
  const handleSubmit = useCallback(async () => {
    if (phase !== 'exam') return;
    setPhase('result');

    // Calculate score
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) correct++;
    });

    const scorePercent = Math.round((correct / questions.length) * 100);
    const passed       = scorePercent >= PASS_SCORE;

    const resultData = { score: scorePercent, correct, total: questions.length, passed, subject };
    setResult(resultData);

    // Save to Supabase if passed
    if (passed) {
      setSaving(true);
      try {
        const newScores = {
          ...existingScores,
          [subject]: scorePercent,
        };
        await supabase
          .from('tutors')
          .update({ certification_scores: newScores })
          .eq('id', user.id);

        setExistingScores(newScores);
      } catch (e) {
        console.error('Failed to save certification score:', e);
      } finally {
        setSaving(false);
      }
    }
  }, [phase, questions, answers, subject, existingScores, user]);

  const selectAnswer = (optionIndex) => {
    setAnswers(prev => ({ ...prev, [current]: optionIndex }));
  };

  const currentQ     = questions[current];
  const totalAnswered = Object.keys(answers).length;
  const certifiedSubjects = Object.keys(existingScores).filter(s => existingScores[s] >= PASS_SCORE);
  const isCertified       = certifiedSubjects.length > 0;

  // ── IDLE PHASE ────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="fade-in">
        <div className="mb-24">
          <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>AI Certification Exam</h2>
          <p className="text-sm text-muted mt-4">
            Pass the exam to unlock your dashboard and start receiving bookings.
          </p>
        </div>

        {/* Welcome / Congratulations Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)',
          border: '1px solid #6EE7B7',
          borderRadius: 16, padding: '24px 28px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div style={{ fontSize: 48, flexShrink: 0 }}>🎉</div>
          <div>
            <div className="font-jakarta font-extrabold mb-6" style={{ fontSize: 18, color: '#065F46' }}>
              {isCertified ? 'You are certified! Well done.' : 'Your account has been approved!'}
            </div>
            <p style={{ fontSize: 13, color: '#047857', lineHeight: 1.6, margin: 0 }}>
              {isCertified
                ? `You have passed: ${certifiedSubjects.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' & ')}. ${certifiedSubjects.length < 2 ? 'You can also take the other subject exam.' : 'You are fully certified!'}`
                : 'Before you can access your dashboard, you must pass the AI Certification Exam for your subject(s). This verifies your qualifications to teach Grade 2–6 learners.'}
            </p>
          </div>
        </div>

        {/* Required warning */}
        {!isCertified && (
          <div style={{
            background: '#FFF7ED', border: '1px solid #FED7AA',
            borderRadius: 12, padding: '12px 18px', marginBottom: 24,
            fontSize: 13, color: '#92400E',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <span>
              <strong>Certification is required.</strong> You cannot access your dashboard until you pass at least one subject exam with a score of <strong>{PASS_SCORE}% or higher</strong>.
            </span>
          </div>
        )}

        {/* Existing scores */}
        {Object.keys(existingScores).length > 0 && (
          <div className="card p-24 mb-20">
            <h3 className="font-jakarta font-bold mb-16" style={{ fontSize: 16 }}>Your Certification Scores</h3>
            {['english', 'mathematics'].map(s => {
              const score = existingScores[s];
              const passed = score >= PASS_SCORE;
              if (!score) return null;
              return (
                <div key={s} style={{ marginBottom: 14 }}>
                  <div className="flex items-center justify-between mb-6">
                    <span style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{s}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: passed ? '#D1FAE5' : '#FEE2E2',
                      color:      passed ? '#065F46' : '#DC2626',
                    }}>
                      {score}% — {passed ? '✓ Passed' : '✗ Failed'}
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4, width: `${score}%`,
                      background: passed ? tokens.success : '#F87171',
                      transition: 'width 0.5s',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Exam card */}
        <div className="card p-28">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: tokens.primaryLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 36,
            }}>🧠</div>
            <h3 className="font-jakarta font-bold" style={{ fontSize: 20 }}>Take the AI Certification Exam</h3>
            <p className="text-sm text-muted mt-8" style={{ maxWidth: 440, margin: '8px auto 0', lineHeight: 1.6 }}>
              Questions are uniquely generated by AI for each attempt. You have <strong>{EXAM_MINUTES} minutes</strong> to answer <strong>{TOTAL_QUESTIONS} questions</strong>. A score of <strong>{PASS_SCORE}%</strong> or above is required to pass.
            </p>
          </div>

          {/* Difficulty notice */}
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            fontSize: 13, color: '#1D4ED8',
            display: 'flex', gap: 10,
          }}>
            <span style={{ flexShrink: 0 }}>📋</span>
            <span>
              Questions are at a <strong>professional/college level</strong> — testing your deep subject knowledge and teaching methodology, not Grade 2–6 content. Be prepared!
            </span>
          </div>

          {genError && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FCA5A5',
              borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              fontSize: 13, color: '#DC2626',
            }}>
              ❌ {genError}
            </div>
          )}

          {/* Subject selector */}
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Select Subject to Certify</label>
            <div className="flex gap-10 mt-8">
              {[
                { value: 'english',     label: '📖 English',      desc: 'Grammar, comprehension, writing, vocabulary' },
                { value: 'mathematics', label: '🔢 Mathematics',   desc: 'Arithmetic, fractions, algebra, geometry' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSubject(opt.value)}
                  style={{
                    flex: 1, padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${subject === opt.value ? tokens.primary : tokens.border}`,
                    background: subject === opt.value ? tokens.primaryLight : '#FAFAFA',
                    color: subject === opt.value ? tokens.primary : tokens.mid,
                    transition: 'all 0.15s', textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{opt.label.split(' ')[0]}</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.label.split(' ').slice(1).join(' ')}</div>
                  <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>{opt.desc}</div>
                  {existingScores[opt.value] >= PASS_SCORE && (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#16A34A' }}>
                      ✓ Already certified ({existingScores[opt.value]}%)
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {isCertified && (
            <button
              className="btn btn-outline btn-full btn-lg mb-12"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard →
            </button>
          )}

          <button
            className="btn btn-primary btn-full btn-lg"
            onClick={handleStartExam}
          >
            <Icon name="brain" size={16} />
            {existingScores[subject] >= PASS_SCORE ? 'Retake Exam' : 'Start Exam'} →
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING PHASE ─────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', gap: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: 52 }}>🧠</div>
        <Spinner dark size={32} />
        <div>
          <div className="font-jakarta font-bold" style={{ fontSize: 18 }}>Generating Your Exam...</div>
          <p className="text-sm text-muted mt-8">
            AI is creating {TOTAL_QUESTIONS} unique questions for your <strong style={{ textTransform: 'capitalize' }}>{subject}</strong> certification.
            <br />This usually takes 5–10 seconds.
          </p>
        </div>
      </div>
    );
  }

  // ── EXAM PHASE ────────────────────────────────────────────────────────
  if (phase === 'exam' && currentQ) {
    const isAnswered    = answers[current] !== undefined;
    const isLastQuestion = current === questions.length - 1;
    const timeWarning   = timeLeft < 300; // last 5 minutes

    return (
      <div className="fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Timer + progress bar */}
        <div className="card p-16 mb-20 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted mb-2">Question {current + 1} of {questions.length}</div>
            <div style={{ width: 200, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${((current + 1) / questions.length) * 100}%`,
                background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.accent})`,
                transition: 'width 0.3s',
              }} />
            </div>
            <div className="text-xs text-muted mt-2">{totalAnswered} of {questions.length} answered</div>
          </div>
          <div>
            <div className="font-jakarta font-extrabold" style={{
              fontSize: 28,
              color: timeWarning ? '#DC2626' : tokens.dark,
            }}>
              ⏱ {fmt(timeLeft)}
            </div>
            {timeWarning && (
              <div style={{ fontSize: 11, color: '#DC2626', textAlign: 'center', fontWeight: 700 }}>
                Running out of time!
              </div>
            )}
          </div>
        </div>

        {/* Question card */}
        <div className="card p-32">
          <div style={{
            fontSize: 11, fontWeight: 700, color: tokens.primary,
            textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12,
          }}>
            Question {current + 1}
          </div>
          <h3 className="font-jakarta font-bold mb-24" style={{ fontSize: 18, lineHeight: 1.5 }}>
            {currentQ.question}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {currentQ.options.map((opt, i) => {
              const isSelected = answers[current] === i;
              const letter     = String.fromCharCode(65 + i);
              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(i)}
                  style={{
                    padding:     '14px 18px',
                    borderRadius: 12,
                    border:      `2px solid ${isSelected ? tokens.primary : tokens.border}`,
                    background:   isSelected ? tokens.primaryLight : '#FAFAFA',
                    color:        isSelected ? tokens.primary : tokens.dark,
                    textAlign:   'left',
                    cursor:       'pointer',
                    fontSize:     14,
                    fontWeight:   isSelected ? 600 : 400,
                    transition:  'all 0.15s',
                    display:     'flex',
                    alignItems:  'flex-start',
                    gap:          12,
                  }}
                >
                  <span style={{
                    width:        24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background:   isSelected ? tokens.primary : '#E5E7EB',
                    color:        isSelected ? '#fff' : tokens.mid,
                    display:     'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize:     11, fontWeight: 700,
                  }}>
                    {letter}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button
              className="btn btn-ghost"
              disabled={current === 0}
              onClick={() => setCurrent(c => c - 1)}
            >
              ← Previous
            </button>

            {isLastQuestion ? (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSubmit}
                style={{ minWidth: 160 }}
              >
                <Icon name="check" size={15} /> Submit Exam
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => setCurrent(c => c + 1)}
              >
                Next Question →
              </button>
            )}
          </div>

          {/* Skip / jump notice */}
          {!isAnswered && (
            <p style={{ fontSize: 12, color: tokens.muted, textAlign: 'center', marginTop: 12 }}>
              You can skip and come back — unanswered questions count as wrong.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT PHASE ──────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const { score, correct, total, passed } = result;

    return (
      <div className="fade-in" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="card p-40 text-center">
          {/* Result icon */}
          <div style={{
            width: 88, height: 88, borderRadius: '50%', margin: '0 auto 20px',
            background: passed ? '#D1FAE5' : '#FEE2E2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 44,
          }}>
            {passed ? '🎓' : '📝'}
          </div>

          <h2 className="font-jakarta font-extrabold mb-8" style={{
            fontSize: 26,
            color:    passed ? tokens.success : '#DC2626',
          }}>
            {passed ? 'Congratulations! You Passed!' : 'Not Quite There Yet'}
          </h2>

          <p className="text-sm text-muted mb-24" style={{ lineHeight: 1.6 }}>
            {passed
              ? `You are now certified to tutor ${result.subject === 'english' ? 'English' : 'Mathematics'} on LearnBridge.`
              : `You need ${PASS_SCORE}% to pass. Review the subject material and try again.`}
          </p>

          {/* Score display */}
          <div style={{
            background: '#F9FAFB', borderRadius: 16, padding: 24,
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16, marginBottom: 24,
          }}>
            <div>
              <div className="font-jakarta font-black" style={{
                fontSize: 40,
                color: passed ? tokens.success : '#DC2626',
              }}>
                {score}%
              </div>
              <div className="text-xs text-muted">Your Score</div>
            </div>
            <div>
              <div className="font-jakarta font-black" style={{ fontSize: 40, color: tokens.dark }}>
                {correct}/{total}
              </div>
              <div className="text-xs text-muted">Correct</div>
            </div>
            <div>
              <div className="font-jakarta font-black" style={{ fontSize: 40, color: tokens.primary }}>
                {PASS_SCORE}%
              </div>
              <div className="text-xs text-muted">Required</div>
            </div>
          </div>

          {/* Score bar */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ height: 12, background: '#E5E7EB', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
              {/* Pass line marker */}
              <div style={{
                position: 'absolute', left: `${PASS_SCORE}%`, top: 0, bottom: 0,
                width: 2, background: '#374151', zIndex: 2,
              }} />
              <div style={{
                height: '100%', borderRadius: 6,
                width: `${score}%`,
                background: passed
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

          {saving && (
            <div style={{ marginBottom: 16, fontSize: 13, color: tokens.muted }}>
              <Spinner dark size={14} /> Saving your certification...
            </div>
          )}

          {passed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {certifiedSubjects.length < 2 && (
                <button
                  className="btn btn-outline btn-full"
                  onClick={() => {
                    setSubject(result.subject === 'english' ? 'mathematics' : 'english');
                    setPhase('idle');
                  }}
                >
                  Take the {result.subject === 'english' ? 'Mathematics' : 'English'} Exam Too
                </button>
              )}
              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={() => navigate('/dashboard')}
                disabled={saving}
              >
                Go to Dashboard →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                background: '#FFF7ED', border: '1px solid #FED7AA',
                borderRadius: 10, padding: '12px 16px', marginBottom: 8,
                fontSize: 13, color: '#92400E', textAlign: 'left',
              }}>
                💡 <strong>Tips for next attempt:</strong> Review your subject's curriculum standards, teaching methodologies, and common student misconceptions. Each exam attempt uses fresh AI-generated questions.
              </div>
              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={() => setPhase('idle')}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}