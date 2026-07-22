import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useBookings } from '../../hooks/useBookings';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import tokens from '../../lib/tokens';
import ZoomMeeting from '../../components/ZoomMeeting';

const QUIZ_TYPES = {
  formative:  { label:'📝 Formative',       color:'#6366F1', bg:'#EEF2FF', short:'FA' },
  summative:  { label:'📊 Summative',       color:'#059669', bg:'#ECFDF5', short:'SA' },
  practice:   { label:'🎯 Practice',        color:'#D97706', bg:'#FFFBEB', short:'PQ' },
  activity:   { label:'🏃 Activity',        color:'#BE185D', bg:'#FDF2F8', short:'ACT'},
  checkpoint: { label:'🔖 Checkpoint Exam', color:'#DC2626', bg:'#FEE2E2', short:'CE' },
  short_quiz: { label:'⚡ Short Quiz',      color:'#0891B2', bg:'#E0F2FE', short:'SQ' },
};

const MATERIAL_TYPES = [
  { value:'intro',         label:'INTRO',         color:'#6366F1', bg:'#EEF2FF' },
  { value:'guide',         label:'GUIDE',         color:'#0891B2', bg:'#ECFEFF' },
  { value:'main',          label:'MAIN',           color:'#059669', bg:'#ECFDF5' },
  { value:'note',          label:'NOTE',           color:'#7C3AED', bg:'#F5F3FF' },
  { value:'powerpoint',    label:'POWERPOINT',    color:'#DC2626', bg:'#FEF2F2' },
  { value:'video',         label:'VIDEO',         color:'#D97706', bg:'#FFFBEB' },
  { value:'supplementary', label:'SUPPLEMENTARY', color:'#6B7280', bg:'#F9FAFB' },
  { value:'discussion',    label:'DISCUSSION',    color:'#BE185D', bg:'#FDF2F8' },
];

function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg=type==='error'?'#FEE2E2':type==='success'?'#D1FAE5':'#EFF6FF';
  const color=type==='error'?'#DC2626':type==='success'?'#065F46':'#1D4ED8';
  return (
    <div style={{position:'fixed',top:24,right:24,zIndex:99999,background:bg,borderRadius:12,padding:'14px 20px',fontSize:14,color,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,.12)',display:'flex',alignItems:'center',gap:10,maxWidth:380}}>
      <span>{type==='error'?'❌':type==='success'?'✅':'ℹ️'}</span>
      <span style={{flex:1}}>{msg}</span>
      <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color,fontSize:16,padding:0}}>✕</button>
    </div>
  );
}

function MatTypeBadge({ type }) {
  const t = MATERIAL_TYPES.find(x=>x.value===type)||MATERIAL_TYPES[3];
  return <span style={{fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:6,background:t.bg,color:t.color,letterSpacing:'0.5px',flexShrink:0}}>{t.label}</span>;
}

export default function ParentSessionsPage() {
  const { user } = useAuth();
  const { bookings, loading: bLoading } = useBookings();
  const activeBookings = bookings.filter(b=>['confirmed','pending_parent_confirm','completed'].includes(b.status));

  const [selBooking,    setSelBooking]    = useState(null);
  const [selStudent,    setSelStudent]    = useState(null);
  const [modules,       setModules]       = useState([]);
  const [activeTab,     setActiveTab]     = useState('modules');
  const [progress,      setProgress]      = useState({});
  const [loading,       setLoading]       = useState(false);
  const [toast,         setToast]         = useState(null);
  const [expanded,      setExpanded]      = useState({});
  const [announcements, setAnnouncements] = useState([]);

  // Reading
  const [readingMat,    setReadingMat]    = useState(null);

  // Quiz taking
  const [activeQuiz,    setActiveQuiz]    = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [answers,       setAnswers]       = useState({});
  const [quizResult,    setQuizResult]    = useState(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [timeLeft,      setTimeLeft]      = useState(null);
  const timerRef = useRef(null);
  const [answerErrors,  setAnswerErrors]  = useState(false);

  const showToast = (msg,type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };
  const toggle = (id) => setExpanded(e=>({...e,[id]:!e[id]}));

  const fetchModulesAndProgress = useCallback(async (bookingId, studentId) => {
    setLoading(true);
    // Fetch announcements
    const {data:anns} = await supabase.from('session_announcements')
      .select('*').eq('booking_id',bookingId).order('created_at',{ascending:false});
    setAnnouncements(anns||[]);

    // Fetch published modules
    const {data:mods,error:mErr} = await supabase
      .from('session_modules')
      .select('*')
      .eq('booking_id', bookingId)
      .eq('status','published')
      .order('module_number');

    if (mErr) { showToast(`Error: ${mErr.message}`,'error'); setLoading(false); return; }
    if (!mods||mods.length===0) { setModules([]); setLoading(false); return; }

    const modIds = mods.map(m=>m.id);

    // Fetch subtopics, materials, quizzes for these modules
    const [{data:subs},{data:mats},{data:quizzes}] = await Promise.all([
      supabase.from('module_subtopics').select('*').in('module_id',modIds).order('subtopic_number'),
      supabase.from('module_materials').select('*').in('module_id',modIds).order('order_num'),
      supabase.from('session_quizzes').select('*').in('module_id',modIds).eq('status','published').order('order_num'),
    ]);

    // Fetch student progress for quizzes
    let attemptMap = {};
    if (quizzes&&quizzes.length>0&&studentId) {
      const quizIds = quizzes.map(q=>q.id);
      const {data:attempts} = await supabase
        .from('student_quiz_attempts')
        .select('*')
        .eq('student_id',studentId)
        .in('quiz_id',quizIds);
      (attempts||[]).forEach(a=>{
        if (!attemptMap[a.quiz_id]||a.attempt_num>attemptMap[a.quiz_id].attempt_num) {
          attemptMap[a.quiz_id] = a;
        }
      });
    }

    const built = mods.map(mod=>({
      ...mod,
      subtopics:(subs||[]).filter(s=>s.module_id===mod.id).map(sub=>({
        ...sub,
        materials:(mats||[]).filter(mat=>mat.subtopic_id===sub.id),
        quizzes:  (quizzes||[]).filter(q=>q.subtopic_id===sub.id&&q.status==='published').map(q=>({
          ...q,
          bestAttempt: attemptMap[q.id]||null,
        })),
      })),
      moduleMaterials:(mats||[]).filter(mat=>mat.module_id===mod.id&&!mat.subtopic_id),
      quizzes:(quizzes||[]).filter(q=>q.module_id===mod.id&&!q.subtopic_id).map(q=>({
        ...q,
        bestAttempt: attemptMap[q.id]||null,
      })),
    }));

    setModules(built);
    setProgress(attemptMap);
    setLoading(false);
  },[]);

  useEffect(()=>{
    if (selBooking&&selStudent) {
      fetchModulesAndProgress(selBooking.id, selStudent.id);
    }
  },[selBooking,selStudent,fetchModulesAndProgress]);

  // Open quiz
  const openQuiz = async (quiz) => {
    const best = quiz.bestAttempt;
    const attempts = best?.attempt_num||0;
    if (attempts>=quiz.max_attempts&&!best?.passed) {
      showToast(`Maximum ${quiz.max_attempts} attempts reached.`,'error'); return;
    }
    const {data:qs,error} = await supabase.from('quiz_questions').select('*').eq('quiz_id',quiz.id).order('order_num');
    if (error||!qs||qs.length===0) { showToast('No questions added yet.','info'); return; }
    setActiveQuiz(quiz);
    setQuizQuestions(qs);
    setAnswers({});
    setQuizResult(null);
    setAnswerErrors(false);
    // Start timer if quiz has time limit
    if (quiz.time_limit > 0) {
      setTimeLeft(quiz.time_limit * 60); // convert minutes to seconds
    } else {
      setTimeLeft(null);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { submitQuiz(); return; }
    timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [timeLeft]);

  const submitQuiz = async () => {
    if (Object.keys(answers).length<quizQuestions.length) {
      setAnswerErrors(true);
      showToast('Please answer all questions before submitting.','error'); return;
    }
    setSubmitting(true);
    try {
      let correct=0;
      quizQuestions.forEach((q,i)=>{ if(answers[i]===q.correct_index) correct++; });
      const score = Math.round((correct/quizQuestions.length)*100);
      const passed = score>=activeQuiz.pass_score;

      // Get actual attempt count from DB to avoid duplicate key
      const { count } = await supabase
        .from('student_quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', activeQuiz.id)
        .eq('student_id', selStudent.id);
      const newAttemptNum = (count || 0) + 1;

      const {error} = await supabase.from('student_quiz_attempts').insert({
        quiz_id:      activeQuiz.id,
        student_id:   selStudent.id,
        parent_id:    user.id,
        score,
        passed,
        answers,
        attempt_num:  newAttemptNum,
        submitted_at: new Date().toISOString(),
      });
      if (error) { showToast(`Failed to save: ${error.message}`,'error'); return; }

      setQuizResult({score,passed,correct,total:quizQuestions.length,attemptNum:newAttemptNum});
      clearInterval(timerRef.current);
      setTimeLeft(null);
      // Refresh to update attempt counts
      fetchModulesAndProgress(selBooking.id,selStudent.id);
    } finally { setSubmitting(false); }
  };

  if (bLoading) return <Spinner dark size={32}/>;

  // ── Booking selector ─────────────────────────────────────────────────────
  if (!selBooking) return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:22}}>Sessions</h2>
        <p className="text-sm text-muted mt-4">Select a booking to view your child's learning modules and quizzes.</p>
      </div>
      {activeBookings.length===0
        ? <div className="card"><EmptyState icon="📚" title="No active bookings" description="Book a tutor to access learning sessions."/></div>
        : <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {activeBookings.map(b=>(
              <div key={b.id} className="card p-20" style={{cursor:'pointer',border:`1.5px solid ${tokens.border}`,transition:'all 0.15s'}}
                onClick={()=>{ setSelBooking(b); setSelStudent(b.student); }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=tokens.primary}
                onMouseLeave={e=>e.currentTarget.style.borderColor=tokens.border}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-jakarta font-bold" style={{fontSize:15}}>{b.student?.name} — <span style={{textTransform:'capitalize'}}>{b.subject}</span></div>
                    <div className="text-xs text-muted mt-4">Tutor: {b.tutor?.full_name} · Grade {b.student?.grade_level}</div>
                  </div>
                  <div className="flex gap-8 items-center">
                    <Badge variant="success">{b.status}</Badge>
                    <Icon name="arrowRight" size={16} color={tokens.primary}/>
                  </div>
                </div>
              </div>
            ))}
          </div>}
    </div>
  );

  // ── Quiz taking view ─────────────────────────────────────────────────────
  if (activeQuiz) {
    const qType = QUIZ_TYPES[activeQuiz.quiz_type]||QUIZ_TYPES.formative;
    const prevAttempts = activeQuiz.bestAttempt?.attempt_num||0;
    return (
      <div className="fade-in" style={{maxWidth:720,margin:'0 auto'}}>
        <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>
        {!quizResult&&<button className="btn btn-ghost btn-sm mb-20" onClick={()=>setActiveQuiz(null)}>← Back to Modules</button>}

        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:800,padding:'3px 10px',borderRadius:20,background:qType.bg,color:qType.color,display:'inline-block',marginBottom:8}}>{qType.label}</div>
          <h2 className="font-jakarta font-extrabold" style={{fontSize:22}}>{activeQuiz.title}</h2>
          {!quizResult&&<p style={{fontSize:13,color:tokens.muted,marginTop:4}}>
            Pass score: {activeQuiz.pass_score}% · Attempt {prevAttempts+1} of {activeQuiz.max_attempts}
            {activeQuiz.bestAttempt?.score>0&&` · Best score: ${activeQuiz.bestAttempt.score}%`}
          </p>}
          {/* Timer */}
          {timeLeft !== null && !quizResult && (
            <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 16px',borderRadius:20,marginTop:8,
              background:timeLeft<60?'#FEE2E2':timeLeft<300?'#FEF9C3':'#D1FAE5',
              color:timeLeft<60?'#DC2626':timeLeft<300?'#92400E':'#065F46',
              fontWeight:800,fontSize:16}}>
              ⏱ {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
            </div>
          )}
          {activeQuiz.instructions&&!quizResult&&(
            <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'10px 14px',marginTop:10,fontSize:13,color:'#1D4ED8'}}>📋 {activeQuiz.instructions}</div>
          )}
        </div>

        {/* Result */}
        {quizResult ? (
          <div className="card p-40 text-center">
            <div style={{fontSize:64,marginBottom:16}}>{quizResult.passed?'🎉':'📝'}</div>
            <div className="font-jakarta font-extrabold mb-8" style={{fontSize:26,color:quizResult.passed?'#065F46':'#DC2626'}}>
              {quizResult.passed?'Quiz Passed!':'Not Passed Yet'}
            </div>
            <div style={{fontSize:52,fontWeight:900,color:quizResult.passed?tokens.success:'#F59E0B',marginBottom:8}}>{quizResult.score}%</div>
            <p style={{fontSize:14,color:tokens.muted,marginBottom:20}}>
              {quizResult.correct} of {quizResult.total} correct · Pass score: {activeQuiz.pass_score}%
            </p>
            <div style={{width:'100%',height:12,background:'#E5E7EB',borderRadius:6,overflow:'hidden',position:'relative',marginBottom:20}}>
              <div style={{position:'absolute',left:`${activeQuiz.pass_score}%`,top:0,bottom:0,width:2,background:'#374151',zIndex:2}}/>
              <div style={{height:'100%',borderRadius:6,width:`${quizResult.score}%`,background:quizResult.passed?`linear-gradient(90deg,${tokens.success},#4ADE80)`:`linear-gradient(90deg,#F87171,#F59E0B)`,transition:'width 1s'}}/>
            </div>
            {quizResult.passed
              ? <div style={{background:'#D1FAE5',borderRadius:10,padding:14,fontSize:14,color:'#065F46',marginBottom:20}}>🎊 Excellent work! You passed this quiz.</div>
              : <div style={{background:'#FEF9C3',borderRadius:10,padding:14,fontSize:14,color:'#92400E',marginBottom:20}}>
                  Keep studying and try again. Attempts remaining: {activeQuiz.max_attempts - quizResult.attemptNum}
                </div>}
            <div className="flex gap-10 justify-center">
              <button className="btn btn-ghost" onClick={()=>setActiveQuiz(null)}>← Back to Modules</button>
              {!quizResult.passed&&quizResult.attemptNum<activeQuiz.max_attempts&&(
                <button className="btn btn-primary" onClick={()=>{setAnswers({});setQuizResult(null);setAnswerErrors(false);}}>Retry Quiz</button>
              )}
            </div>
          </div>
        ) : (
          /* Questions */
          <div>
            {quizQuestions.map((q,qi)=>(
              <div key={q.id} style={{background:'#fff',borderRadius:14,padding:20,marginBottom:16,border:`1.5px solid ${answerErrors&&answers[qi]===undefined?'#FCA5A5':tokens.border}`}}>
                <div className="font-semibold mb-12" style={{fontSize:15}}>
                  {qi+1}. {q.question_text}
                  {answerErrors&&answers[qi]===undefined&&<span style={{fontSize:12,color:'#DC2626',marginLeft:8,fontWeight:400}}>⚠ Please answer</span>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {q.options.map((opt,oi)=>{
                    const selected = answers[qi]===oi;
                    return (
                      <button key={oi} type="button" onClick={()=>setAnswers(a=>({...a,[qi]:oi}))}
                        style={{padding:'12px 16px',borderRadius:10,cursor:'pointer',border:`2px solid ${selected?tokens.primary:tokens.border}`,background:selected?tokens.primaryLight:'#FAFAFA',color:selected?tokens.primary:tokens.dark,textAlign:'left',fontSize:14,fontWeight:selected?600:400,transition:'all 0.15s',display:'flex',alignItems:'center',gap:12}}>
                        <span style={{width:28,height:28,borderRadius:'50%',flexShrink:0,background:selected?tokens.primary:'#E5E7EB',color:selected?'#fff':tokens.mid,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>
                          {String.fromCharCode(65+oi)}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button className="btn btn-primary btn-full btn-lg" onClick={submitQuiz} disabled={submitting}>
              {submitting?'Submitting...':'Submit Quiz'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Reading a material ───────────────────────────────────────────────────
  if (readingMat) {
    return (
      <div className="fade-in">
        <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>
        <button className="btn btn-ghost btn-sm mb-20" onClick={()=>setReadingMat(null)}>← Back to Modules</button>
        <div className="card p-32" style={{maxWidth:780,margin:'0 auto'}}>
          <div style={{marginBottom:20}}>
            <MatTypeBadge type={readingMat.material_type}/>
            <h2 className="font-jakarta font-extrabold mt-8" style={{fontSize:22}}>{readingMat.title}</h2>
          </div>
          {readingMat.content&&(
            <div style={{background:'#FAFAFA',borderRadius:12,padding:24,marginBottom:20,lineHeight:1.9,fontSize:15,color:tokens.dark,whiteSpace:'pre-wrap',wordBreak:'break-word',border:`1px solid ${tokens.border}`}}>
              {readingMat.content}
            </div>
          )}
          {/* Inline PDF viewer */}
          {readingMat.file_url&&(readingMat.file_type==='application/pdf'||readingMat.file_name?.endsWith('.pdf'))&&(
            <div style={{borderRadius:12,overflow:'hidden',border:`1px solid ${tokens.border}`,marginBottom:16}}>
              <div style={{padding:'8px 14px',background:'#F9FAFB',borderBottom:`1px solid ${tokens.border}`,fontSize:12,color:tokens.muted,display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontWeight:700,color:'#DC2626'}}>PDF</span>
                <span>{readingMat.file_name}</span>
                <a href={readingMat.file_url} target="_blank" rel="noreferrer" style={{marginLeft:'auto',fontSize:12,color:tokens.primary,fontWeight:600}}>⬇ Download</a>
              </div>
              <iframe src={readingMat.file_url} width="100%" height="600px" style={{border:'none',display:'block'}} title={readingMat.title}/>
            </div>
          )}
          {/* Inline PPT viewer via Microsoft Office Online */}
          {readingMat.file_url&&(readingMat.file_name?.endsWith('.ppt')||readingMat.file_name?.endsWith('.pptx'))&&(
            <div style={{borderRadius:12,overflow:'hidden',border:`1px solid ${tokens.border}`,marginBottom:16}}>
              <div style={{padding:'8px 14px',background:'#F9FAFB',borderBottom:`1px solid ${tokens.border}`,fontSize:12,color:tokens.muted,display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontWeight:700,color:'#D97706'}}>PPT</span>
                <span>{readingMat.file_name}</span>
                <a href={readingMat.file_url} target="_blank" rel="noreferrer" style={{marginLeft:'auto',fontSize:12,color:tokens.primary,fontWeight:600}}>⬇ Download</a>
              </div>
              <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(readingMat.file_url)}`} width="100%" height="600px" style={{border:'none',display:'block'}} title={readingMat.title}/>
            </div>
          )}
          {readingMat.url&&(
            <a href={readingMat.url} target="_blank" rel="noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 20px',borderRadius:10,background:tokens.primaryLight,color:tokens.primary,fontWeight:600,fontSize:14,textDecoration:'none'}}>
              🔗 Open Resource Link
            </a>
          )}
          {!readingMat.content&&!readingMat.url&&!readingMat.file_url&&(
            <div style={{textAlign:'center',padding:'32px 0',color:tokens.muted}}>No content added for this material yet.</div>
          )}
        </div>
      </div>
    );
  }

  // ── Main canvas view ─────────────────────────────────────────────────────
  const totalQuizzes = modules.reduce((a,m)=>a+(m.quizzes?.length||0),0);
  const passedQuizzes = modules.reduce((a,m)=>a+(m.quizzes?.filter(q=>q.bestAttempt?.passed).length||0),0);


  // Convert URLs in text to clickable links
  const linkify = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          style={{color:'#1D4ED8',textDecoration:'underline',fontWeight:600,wordBreak:'break-all'}}>
          {part}
        </a>
      ) : part
    );
  };

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>

      <div className="flex items-center gap-12 mb-20">
        <button className="btn btn-ghost btn-sm" onClick={()=>{setSelBooking(null);setSelStudent(null);setModules([]);}}>← Back</button>
        <div style={{flex:1}}>
          <h2 className="font-jakarta font-extrabold" style={{fontSize:20}}>📚 {selBooking.student?.name} — {selBooking.subject}</h2>
          <p className="text-xs text-muted mt-2">Tutor: {selBooking.tutor?.full_name}</p>
        </div>
        {totalQuizzes>0&&(
          <div style={{textAlign:'right'}}>
            <div className="font-jakarta font-bold" style={{fontSize:14}}>{passedQuizzes}/{totalQuizzes} Quizzes Passed</div>
            <div style={{width:140,height:6,background:'#E5E7EB',borderRadius:3,marginTop:6,overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:3,width:`${totalQuizzes>0?(passedQuizzes/totalQuizzes)*100:0}%`,background:`linear-gradient(90deg,${tokens.primary},${tokens.success})`,transition:'width 0.4s'}}/>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 mb-20" style={{borderBottom:`2px solid ${tokens.border}`}}>
        {[
          {key:'modules',     label:'📚 Modules'},
          {key:'progress',    label:'📊 Student Progress'},
          {key:'video',       label:'🎥 Video Meeting'},
          {key:'announcements',label:'📢 Announcements'},
        ].map(t=>(
          <button key={t.key} onClick={()=>setActiveTab(t.key)}
            style={{padding:'10px 20px',border:'none',borderBottom:`3px solid ${activeTab===t.key?tokens.primary:'transparent'}`,background:'none',cursor:'pointer',fontWeight:700,fontSize:13,color:activeTab===t.key?tokens.primary:tokens.muted,marginBottom:-2}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Video Meeting Tab ── */}
      {activeTab==='video' && (
        <ZoomMeeting booking={selBooking} isTutor={false} />
      )}

      {/* ── Pinned Announcements from Tutor ── */}
      {activeTab==='announcements' && (announcements.length>0 ? (
        <div style={{marginBottom:20}}>
          {announcements.map(ann=>(
            <div key={ann.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'14px 18px',borderRadius:12,background:'#FFFBEB',border:'2px solid #FDE68A',marginBottom:10}}>
              <span style={{fontSize:20,flexShrink:0}}>📌</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:700,color:'#B45309',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>
                  Announcement from Tutor
                </div>
                <div style={{fontSize:14,lineHeight:1.7,color:'#78350F',fontWeight:500}}>{linkify(ann.message)}</div>
                <div style={{fontSize:11,color:'#B45309',marginTop:6}}>
                  📅 {new Date(ann.created_at).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-40 text-center">
          <div style={{fontSize:48,marginBottom:12}}>📢</div>
          <div className="font-jakarta font-bold mb-8" style={{fontSize:18}}>No announcements yet</div>
          <p className="text-sm text-muted">Your tutor hasn't posted any announcements yet.</p>
        </div>
      ))}

      {/* ── Student Progress Tab ── */}
      {activeTab==='progress' && (
        <div>
          {(() => {
            // Collect all quiz attempts across all modules
            const allQuizzes = modules.flatMap(mod => [
              ...mod.quizzes.map(q => ({ ...q, moduleName: mod.title, subtopicName: null })),
              ...mod.subtopics.flatMap(sub =>
                sub.quizzes.map(q => ({ ...q, moduleName: mod.title, subtopicName: sub.title }))
              ),
            ]);
            const attempted = allQuizzes.filter(q => q.bestAttempt);
            const notAttempted = allQuizzes.filter(q => !q.bestAttempt);

            if (allQuizzes.length === 0) return (
              <div className="card p-40 text-center">
                <div style={{fontSize:48,marginBottom:12}}>📊</div>
                <div className="font-jakarta font-bold mb-8" style={{fontSize:18}}>No quizzes yet</div>
                <p className="text-sm text-muted">No quizzes have been published yet.</p>
              </div>
            );

            return (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {/* Summary */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:8}}>
                  {[
                    {label:'Total Quizzes',  value:allQuizzes.length,                                  bg:'#EFF6FF',color:'#1D4ED8'},
                    {label:'Attempted',      value:attempted.length,                                   bg:'#FEF9C3',color:'#92400E'},
                    {label:'Passed',         value:attempted.filter(q=>q.bestAttempt?.passed).length,  bg:'#D1FAE5',color:'#065F46'},
                  ].map(c=>(
                    <div key={c.label} style={{background:c.bg,borderRadius:12,padding:'16px 20px',textAlign:'center'}}>
                      <div style={{fontSize:28,fontWeight:900,color:c.color}}>{c.value}</div>
                      <div style={{fontSize:12,color:c.color,opacity:0.8}}>{c.label}</div>
                    </div>
                  ))}
                </div>

                {/* Attempted quizzes */}
                {attempted.length > 0 && (
                  <div className="card" style={{overflow:'hidden'}}>
                    <div style={{padding:'12px 20px',borderBottom:`1px solid ${tokens.border}`,fontWeight:700,fontSize:14}}>
                      📝 Quiz Attempts
                    </div>
                    {attempted.map(q => {
                      const qType = QUIZ_TYPES[q.quiz_type] || QUIZ_TYPES.formative;
                      const best  = q.bestAttempt;
                      return (
                        <div key={q.id} style={{padding:'14px 20px',borderBottom:`1px solid ${tokens.border}`,display:'flex',alignItems:'center',gap:14}}>
                          <div style={{width:40,height:40,borderRadius:10,background:qType.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <span style={{fontSize:12,fontWeight:900,color:qType.color}}>{qType.short||'Q'}</span>
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:14}}>{q.title}</div>
                            <div style={{fontSize:12,color:tokens.muted,marginTop:2}}>
                              <span style={{fontWeight:600,color:qType.color}}>{qType.label}</span>
                              {q.subtopicName && <span> · Subtopic: <strong>{q.subtopicName}</strong></span>}
                              {q.moduleName   && <span> · Module: {q.moduleName}</span>}
                            </div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:20,fontWeight:900,color:best?.passed?'#065F46':'#DC2626'}}>
                              {best?.score}%
                            </div>
                            <div style={{fontSize:11,color:tokens.muted}}>
                              {best?.correct}/{best?.total||quizQuestions?.length||'?'} correct · Attempt {best?.attempt_num}
                            </div>
                            <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,
                              background:best?.passed?'#D1FAE5':'#FEE2E2',
                              color:best?.passed?'#065F46':'#DC2626'}}>
                              {best?.passed?'✓ Passed':'✗ Failed'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Not yet attempted */}
                {notAttempted.length > 0 && (
                  <div className="card" style={{overflow:'hidden'}}>
                    <div style={{padding:'12px 20px',borderBottom:`1px solid ${tokens.border}`,fontWeight:700,fontSize:14,color:tokens.muted}}>
                      ⏳ Not Yet Attempted ({notAttempted.length})
                    </div>
                    {notAttempted.map(q => {
                      const qType = QUIZ_TYPES[q.quiz_type] || QUIZ_TYPES.formative;
                      return (
                        <div key={q.id} style={{padding:'12px 20px',borderBottom:`1px solid ${tokens.border}`,display:'flex',alignItems:'center',gap:14,opacity:0.7}}>
                          <div style={{width:36,height:36,borderRadius:8,background:qType.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <span style={{fontSize:11,fontWeight:900,color:qType.color}}>{qType.short||'Q'}</span>
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:600,fontSize:13}}>{q.title}</div>
                            <div style={{fontSize:12,color:tokens.muted}}>
                              <span style={{fontWeight:600,color:qType.color}}>{qType.label}</span>
                              {q.subtopicName && <span> · Subtopic: <strong>{q.subtopicName}</strong></span>}
                            </div>
                          </div>
                          <span style={{fontSize:11,color:tokens.muted}}>Not attempted</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab==='modules' && (loading ? <Spinner dark size={28}/> : modules.length===0
        ? <div className="card p-40 text-center">
            <div style={{fontSize:52,marginBottom:16}}>📖</div>
            <div className="font-jakarta font-bold mb-8" style={{fontSize:18}}>No modules yet</div>
            <p className="text-sm text-muted">Your tutor hasn't published any modules yet. Check back soon!</p>
          </div>
        : <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {modules.map(mod=>(
              <div key={mod.id} style={{border:`2px solid ${tokens.primary}`,borderRadius:16,overflow:'hidden',background:'#fff'}}>
                {/* Module header */}
                <div style={{padding:'16px 20px',background:tokens.primaryLight,display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>toggle(mod.id)}>
                  <Icon name={expanded[mod.id]?'chevronDown':'chevronRight'} size={16} color={tokens.primary}/>
                  <div style={{flex:1}}>
                    <div className="font-jakarta font-bold" style={{fontSize:15,color:tokens.dark}}>Session {mod.module_number}: {mod.title}</div>
                    {mod.description&&<div className="text-xs text-muted mt-2">{mod.description}</div>}
                    <div className="flex gap-10 mt-4">
                      <span style={{fontSize:11,color:tokens.muted}}>{(mod.moduleMaterials?.length||0)+(mod.subtopics?.reduce((a,s)=>a+(s.materials?.length||0),0)||0)} materials</span>
                      {mod.quizzes?.length>0&&<span style={{fontSize:11,color:tokens.muted}}>{mod.quizzes.length} quiz{mod.quizzes.length!==1?'zes':''}</span>}
                    </div>
                  </div>
                  {mod.quizzes?.length>0&&(
                    <div>
                      {mod.quizzes.filter(q=>q.bestAttempt?.passed).length===mod.quizzes.length
                        ? <span style={{fontSize:12,fontWeight:700,color:'#065F46'}}>✅ All Passed</span>
                        : <span style={{fontSize:12,color:tokens.muted}}>{mod.quizzes.filter(q=>q.bestAttempt?.passed).length}/{mod.quizzes.length} passed</span>}
                    </div>
                  )}
                </div>

                {expanded[mod.id]&&(
                  <div style={{padding:'16px 20px',borderTop:`1px solid ${tokens.border}`}}>

                    {/* Module-level materials */}
                    {mod.moduleMaterials?.map(mat=>(
                      <div key={mat.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:8,background:'#FAFAFA',border:`1px solid ${tokens.border}`,marginBottom:8,cursor:'pointer'}} onClick={()=>setReadingMat(mat)}>
                        <Icon name="clipboard" size={13} color={tokens.muted}/>
                        <MatTypeBadge type={mat.material_type}/>
                        <span style={{fontSize:13,flex:1}}>{mat.title}</span>
                        {mat.file_url&&<span style={{fontSize:10,fontWeight:700,color:'#DC2626',background:'#FEE2E2',padding:'2px 6px',borderRadius:4}}>{mat.file_name?.endsWith('.pdf')?'PDF':'PPT'}</span>}
                        <span style={{fontSize:11,color:tokens.primary,fontWeight:600}}>Read →</span>
                      </div>
                    ))}

                    {/* Subtopics */}
                    {mod.subtopics?.map(sub=>(
                      <div key={sub.id} style={{marginBottom:14,paddingLeft:16,borderLeft:`3px solid ${tokens.primary}30`}}>
                        <div className="font-jakarta font-bold mb-8" style={{fontSize:13,color:tokens.primary}}>Subtopic {sub.subtopic_number}: {sub.title}</div>
                        {sub.materials?.map(mat=>(
                          <div key={mat.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:8,background:'#FAFAFA',border:`1px solid ${tokens.border}`,marginBottom:6,cursor:'pointer'}} onClick={()=>setReadingMat(mat)}>
                            <Icon name="clipboard" size={13} color={tokens.muted}/>
                            <MatTypeBadge type={mat.material_type}/>
                            <span style={{fontSize:13,flex:1}}>{mat.title}</span>
                            <span style={{fontSize:11,color:tokens.primary,fontWeight:600}}>Read →</span>
                          </div>
                        ))}
                        {/* Subtopic Quizzes */}
                        {sub.quizzes?.length>0&&(
                          <div style={{marginTop:6}}>
                            {sub.quizzes.map(quiz=>{
                              const qType = QUIZ_TYPES[quiz.quiz_type]||QUIZ_TYPES.formative;
                              const best = quiz.bestAttempt;
                              const passed = best?.passed||false;
                              const attempts = best?.attempt_num||0;
                              const noAttemptsLeft = attempts>=quiz.max_attempts&&!passed;
                              return (
                                <div key={quiz.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:passed?'#F0FDF4':noAttemptsLeft?'#FEF2F2':'#F0F9FF',border:`1.5px solid ${passed?'#6EE7B7':noAttemptsLeft?'#FCA5A5':'#BAE6FD'}`,marginBottom:8}}>
                                  <div style={{width:36,height:36,borderRadius:8,background:qType.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                    <span style={{fontSize:11,fontWeight:900,color:qType.color}}>{qType.short||qType.label?.split(' ')[0]}</span>
                                  </div>
                                  <div style={{flex:1}}>
                                    <div className="font-jakarta font-bold" style={{fontSize:13}}>{quiz.title}</div>
                                    <div style={{fontSize:11,color:tokens.muted,marginTop:2}}>
                                      Pass {quiz.pass_score}% · Max {quiz.max_attempts} attempts{quiz.time_limit>0?` · ${quiz.time_limit} min`:''}
                                      {passed&&<span style={{color:'#065F46',fontWeight:700,marginLeft:6}}>✓ Passed</span>}
                                    </div>
                                  </div>
                                  {!passed&&!noAttemptsLeft&&(
                                    <button className="btn btn-primary btn-sm" onClick={()=>openQuiz(quiz)}>Take Quiz</button>
                                  )}
                                  {noAttemptsLeft&&<span style={{fontSize:11,color:'#DC2626',fontWeight:700}}>No attempts left</span>}
                                  {passed&&<span style={{fontSize:11,color:'#065F46',fontWeight:700}}>✓ Done</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Quizzes inside this module */}
                    {mod.quizzes?.length>0&&(
                      <div style={{marginTop:16,paddingTop:14,borderTop:`1px dashed ${tokens.border}`}}>
                        <div className="text-xs text-muted uppercase font-bold mb-10" style={{letterSpacing:'0.5px'}}>Quizzes</div>
                        {mod.quizzes.map(quiz=>{
                          const qType = QUIZ_TYPES[quiz.quiz_type]||QUIZ_TYPES.formative;
                          const best = quiz.bestAttempt;
                          const passed = best?.passed||false;
                          const attempts = best?.attempt_num||0;
                          const noAttemptsLeft = attempts>=quiz.max_attempts&&!passed;
                          return (
                            <div key={quiz.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:12,background:passed?'#F0FDF4':noAttemptsLeft?'#FEF2F2':'#FAFAFA',border:`1.5px solid ${passed?'#6EE7B7':noAttemptsLeft?'#FCA5A5':tokens.border}`,marginBottom:10}}>
                              <div style={{width:40,height:40,borderRadius:10,background:qType.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                <span style={{fontSize:13,fontWeight:900,color:qType.color}}>{qType.label.split(' ')[0]}</span>
                              </div>
                              <div style={{flex:1}}>
                                <div className="font-jakarta font-bold" style={{fontSize:14}}>{quiz.title}</div>
                                <div style={{fontSize:11,color:tokens.muted,marginTop:3}}>
                                  Pass: {quiz.pass_score}%
                                  {best?.score>0&&<span style={{color:passed?'#065F46':'#92400E',fontWeight:600}}> · Best: {best.score}%</span>}
                                  {attempts>0&&<span> · Attempts: {attempts}/{quiz.max_attempts}</span>}
                                </div>
                              </div>
                              {passed
                                ? <span style={{fontSize:12,fontWeight:700,color:'#065F46'}}>✅ Passed</span>
                                : noAttemptsLeft
                                  ? <span style={{fontSize:12,fontWeight:700,color:'#DC2626'}}>No attempts left</span>
                                  : <button className="btn btn-primary btn-sm" onClick={()=>openQuiz(quiz)}>
                                      {attempts>0?'Retry Quiz':'Take Quiz'}
                                    </button>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
      )}
    </div>
  );
}