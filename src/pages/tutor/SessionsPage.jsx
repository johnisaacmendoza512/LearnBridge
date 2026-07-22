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
import ZoomMeeting from '../../components/ZoomMeeting';

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

const QUIZ_TYPES = [
  { value:'formative',   label:'📝 Formative',        short:'FA',  color:'#6366F1', bg:'#EEF2FF' },
  { value:'summative',   label:'📊 Summative',        short:'SA',  color:'#059669', bg:'#ECFDF5' },
  { value:'practice',    label:'🎯 Practice',         short:'PQ',  color:'#D97706', bg:'#FFFBEB' },
  { value:'activity',    label:'🏃 Activity',         short:'ACT', color:'#BE185D', bg:'#FDF2F8' },
  { value:'checkpoint',  label:'🔖 Checkpoint Exam',  short:'CE',  color:'#DC2626', bg:'#FEE2E2' },
  { value:'short_quiz',  label:'⚡ Short Quiz',       short:'SQ',  color:'#0891B2', bg:'#E0F2FE' },
];

function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg = type==='error'?'#FEE2E2':'#D1FAE5', color=type==='error'?'#DC2626':'#065F46';
  return (
    <div style={{position:'fixed',top:24,right:24,zIndex:99999,background:bg,borderRadius:12,padding:'14px 20px',fontSize:14,color,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,.12)',display:'flex',alignItems:'center',gap:10,maxWidth:380}}>
      <span>{type==='error'?'❌':'✅'}</span><span style={{flex:1}}>{msg}</span>
      <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color,fontSize:16,padding:0}}>✕</button>
    </div>
  );
}

function MatTypeBadge({ type }) {
  const t = MATERIAL_TYPES.find(x=>x.value===type)||MATERIAL_TYPES[3];
  return <span style={{fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:6,background:t.bg,color:t.color,letterSpacing:'0.5px',flexShrink:0}}>{t.label}</span>;
}

export default function TutorSessionsPage() {
  const { user } = useAuth();
  const { bookings, loading: bLoading } = useBookings();
  const confirmed = bookings.filter(b=>['confirmed','pending_parent_confirm','completed'].includes(b.status));

  const [selBooking,      setSelBooking]      = useState(null);
  const [modules,         setModules]         = useState([]);
  const [expanded,        setExpanded]        = useState({});
  const [loading,         setLoading]         = useState(false);
  const [toast,           setToast]           = useState(null);
  const [activeTab,       setActiveTab]       = useState('modules'); // 'modules' | 'progress'

  // Progress tracking
  const [quizAttempts,    setQuizAttempts]    = useState([]); // all student attempts
  const [matViews,        setMatViews]        = useState([]); // all material views

  // Announcements
  const [announcements,   setAnnouncements]   = useState([]);
  const [annText,         setAnnText]         = useState('');
  const [editingAnn,      setEditingAnn]      = useState(null); // announcement object being edited
  const [editAnnText,     setEditAnnText]     = useState('');
  const [savingAnn,       setSavingAnn]       = useState(false);

  // Active quiz editor
  const [activeQuiz,  setActiveQuiz]  = useState(null);
  const [questions,     setQuestions]     = useState([]);
  const [loadingQs,     setLoadingQs]     = useState(false);
  const [newQ,          setNewQ]          = useState({question_text:'',question_type:'multiple_choice',options:['','','',''],correct_index:0,points:1});
  const [savingQ,       setSavingQ]       = useState(false);
  const [qTab,          setQTab]          = useState('manual'); // 'manual' | 'ai'
  const [aiPdfFile,     setAiPdfFile]     = useState(null);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiPreview,     setAiPreview]     = useState([]); // extracted questions preview
  const [savingAiQs,    setSavingAiQs]    = useState(false);

  // Module copy state
  const [copyModal,     setCopyModal]     = useState(false);
  const [pastBookings,  setPastBookings]  = useState([]);
  const [copyingFrom,   setCopyingFrom]   = useState(null);
  const [copying,       setCopying]       = useState(false);

  // Module modal
  const [modModal,    setModModal]    = useState(null);
  const [modForm,     setModForm]     = useState({title:'',description:''});
  const [savingMod,   setSavingMod]   = useState(false);

  // Subtopic modal
  const [subModal,    setSubModal]    = useState(null);
  const [subForm,     setSubForm]     = useState({title:''});
  const [savingSub,   setSavingSub]   = useState(false);

  // Material modal
  const [matModal,    setMatModal]    = useState(null);
  const [matForm,     setMatForm]     = useState({title:'',material_type:'note',content:'',url:'',file:null,file_name:'',file_type:''});
  const [matFilePreview, setMatFilePreview] = useState(null); // { url, type } for preview
  const [savingMat,   setSavingMat]   = useState(false);

  // Quiz modal (create/edit)
  const [quizModal,   setQuizModal]   = useState(null);
  const [quizForm,    setQuizForm]    = useState({title:'',quiz_type:'formative',instructions:'',pass_score:75,max_attempts:10,time_limit:0});
  const [savingQuiz,  setSavingQuiz]  = useState(false);

  const showToast = (msg,type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };
  const toggle = (id) => setExpanded(e=>({...e,[id]:!e[id]}));

  // ── Fetch announcements ──────────────────────────────────────────────────
  const fetchAnnouncements = useCallback(async (bookingId) => {
    const {data} = await supabase.from('session_announcements').select('*').eq('booking_id',bookingId).order('created_at',{ascending:false});
    setAnnouncements(data||[]);
  },[]);

  // ── Fetch all data ───────────────────────────────────────────────────────
  const fetchAll = useCallback(async (bookingId) => {
    setLoading(true);
    fetchAnnouncements(bookingId);
    const {data:mods,error:mErr} = await supabase.from('session_modules').select('*').eq('booking_id',bookingId).order('module_number');
    if (mErr) { showToast(`Fetch error: ${mErr.message}`,'error'); setLoading(false); return; }
    if (!mods || mods.length===0) { setModules([]); setLoading(false); return; }

    const modIds = mods.map(m=>m.id);
    const [{data:subs},{data:mats},{data:quizzes}] = await Promise.all([
      supabase.from('module_subtopics').select('*').in('module_id',modIds).order('subtopic_number'),
      supabase.from('module_materials').select('*').in('module_id',modIds).order('order_num'),
      supabase.from('session_quizzes').select('*').in('module_id',modIds).order('order_num'),
    ]);

    // Fetch student progress — quiz attempts and material views
    const quizIds = (quizzes||[]).map(q=>q.id);
    const matIds  = (mats||[]).map(m=>m.id);

    const [attemptsRes, viewsRes] = await Promise.all([
      quizIds.length > 0
        ? supabase.from('student_quiz_attempts').select('*, student:student_id(name,grade_level)').in('quiz_id',quizIds).order('submitted_at',{ascending:false})
        : Promise.resolve({data:[]}),
      matIds.length > 0
        ? supabase.from('student_material_views').select('*, student:student_id(name)').in('material_id',matIds)
        : Promise.resolve({data:[]}),
    ]);
    setQuizAttempts(attemptsRes.data||[]);
    setMatViews(viewsRes.data||[]);

    setModules(mods.map(mod=>({
      ...mod,
      subtopics: (subs||[]).filter(s=>s.module_id===mod.id).map(sub=>({
        ...sub,
        materials:(mats||[]).filter(mat=>mat.subtopic_id===sub.id),
        quizzes:  (quizzes||[]).filter(q=>q.subtopic_id===sub.id),
      })),
      moduleMaterials: (mats||[]).filter(mat=>mat.module_id===mod.id&&!mat.subtopic_id),
      quizzes: (quizzes||[]).filter(q=>q.module_id===mod.id&&!q.subtopic_id),
    })));
    setLoading(false);
  },[]);

  useEffect(()=>{ if(selBooking) fetchAll(selBooking.id); },[selBooking,fetchAll]);

  const fetchQuestions = async (quizId) => {
    setLoadingQs(true);
    const {data} = await supabase.from('quiz_questions').select('*').eq('quiz_id',quizId).order('order_num');
    setQuestions(data||[]);
    setLoadingQs(false);
  };

  // ── AI PDF Question Extraction ───────────────────────────────────────────
  const extractQuestionsFromPdf = async () => {
    if (!aiPdfFile) return;
    setAiLoading(true);
    setAiPreview([]);
    try {
      // Load pdf.js from CDN
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = res;
          script.onerror = rej;
          document.head.appendChild(script);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      // Read PDF as ArrayBuffer
      const arrayBuffer = await aiPdfFile.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      // Render all pages to canvas and collect base64 images
      const images = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        const base64  = dataUrl.split(',')[1];
        images.push(base64);
      }

      if (images.length === 0) throw new Error('Could not render PDF pages.');

      // Process pages in batches of 3 to avoid context limit
      const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
      const batchSize = 3;
      const allExtracted = [];
      const MAX_QUESTIONS = 20;

      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        const content = [
          {
            type: 'text',
            text: `Extract ALL multiple choice and true/false questions from these PDF page images.
Return ONLY a valid JSON array:
[{"question_text":"...","options":["A","B","C","D"],"correct_index":0,"points":1}]
- correct_index is 0-based
- For True/False use options: ["True","False"]
- Return ONLY the JSON array, nothing else`,
          },
          ...batch.map(b64 => ({
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${b64}`, detail: 'high' },
          })),
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 8000,
            messages: [{ role: 'user', content }],
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err?.error?.message || `API error ${response.status}`);
        }

        const data    = await response.json();
        const text    = data.choices?.[0]?.message?.content || '';
        const cleaned = text.replace(/```json|```/g, '').trim();
        try {
          const batchResult = JSON.parse(cleaned);
          if (Array.isArray(batchResult)) allExtracted.push(...batchResult);
        } catch {
          // skip malformed batch, continue with next
        }
      }

      if (allExtracted.length === 0) throw new Error('No questions found in PDF.');

      // Deduplicate then limit to 20 questions
      const seen = new Set();
      const unique = allExtracted.filter(q => {
        const key = (q.question_text || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, MAX_QUESTIONS);

      setAiPreview(unique);
      showToast(`✅ Extracted ${unique.length} of max ${MAX_QUESTIONS} questions from ${images.length} page${images.length !== 1 ? 's' : ''}!`);
    } catch (e) {
      showToast(`AI extraction failed: ${e.message}`, 'error');
      setAiLoading(false);
    }
  };

  const saveAiQuestions = async () => {
    if (!aiPreview.length || !activeQuiz) return;
    setSavingAiQs(true);
    try {
      const rows = aiPreview.map((q, i) => ({
        quiz_id:       activeQuiz.id,
        question_text: q.question_text,
        question_type: q.options.length === 2 && q.options[0]==='True' ? 'true_false' : 'multiple_choice',
        options:       q.options,
        correct_index: q.correct_index,
        points:        q.points || 1,
        order_num:     questions.length + i,
      }));
      const {error} = await supabase.from('quiz_questions').insert(rows);
      if (error) { showToast(`Failed: ${error.message}`, 'error'); return; }
      showToast(`✅ ${rows.length} questions saved!`);
      setAiPreview([]);
      setAiPdfFile(null);
      setQTab('manual');
      await fetchQuestions(activeQuiz.id);
    } finally {
      setSavingAiQs(false); }
  };

  // ── Module Copy (reuse from past booking) ────────────────────────────────
  const openCopyModal = async () => {
    // Fetch all other confirmed/completed bookings for this tutor
    const {data} = await supabase
      .from('bookings')
      .select('id, subject, status, student:student_id(name, grade_level), parent:parent_id(full_name)')
      .eq('tutor_id', user.id)
      .in('status', ['confirmed','completed'])
      .neq('id', selBooking.id)
      .order('created_at', {ascending:false});
    setPastBookings(data||[]);
    setCopyModal(true);
  };

  const copyModulesFrom = async (sourceBookingId) => {
    setCopying(true);
    try {
      // Fetch source modules with all children
      const {data:srcMods} = await supabase.from('session_modules').select('*').eq('booking_id', sourceBookingId).order('module_number');
      if (!srcMods||srcMods.length===0) { showToast('No sessions found in that booking.','error'); return; }

      const srcModIds = srcMods.map(m=>m.id);
      const [{data:srcSubs},{data:srcMats},{data:srcQuizzes}] = await Promise.all([
        supabase.from('module_subtopics').select('*').in('module_id',srcModIds).order('subtopic_number'),
        supabase.from('module_materials').select('*').in('module_id',srcModIds).order('order_num'),
        supabase.from('session_quizzes').select('*').in('module_id',srcModIds).order('order_num'),
      ]);

      const startNum = modules.length;

      for (let mi=0; mi<srcMods.length; mi++) {
        const srcMod = srcMods[mi];

        // Insert new module
        const {data:newMod,error:modErr} = await supabase.from('session_modules').insert({
          booking_id:    selBooking.id,
          tutor_id:      user.id,
          module_number: startNum + mi + 1,
          title:         srcMod.title,
          description:   srcMod.description||null,
          status:        'draft', // start as draft for review
        }).select().single();
        if (modErr) { showToast(`Failed copying module: ${modErr.message}`,'error'); continue; }

        // Copy module-level materials
        const srcModMats = (srcMats||[]).filter(m=>m.module_id===srcMod.id&&!m.subtopic_id);
        if (srcModMats.length>0) {
          await supabase.from('module_materials').insert(srcModMats.map(m=>({
            module_id:     newMod.id,
            subtopic_id:   null,
            material_type: m.material_type,
            title:         m.title,
            content:       m.content||null,
            url:           m.url||null,
            file_url:      m.file_url||null,
            file_name:     m.file_name||null,
            file_type:     m.file_type||null,
            order_num:     m.order_num,
          })));
        }

        // Copy subtopics
        const srcModSubs = (srcSubs||[]).filter(s=>s.module_id===srcMod.id);
        for (const srcSub of srcModSubs) {
          const {data:newSub,error:subErr} = await supabase.from('module_subtopics').insert({
            module_id:       newMod.id,
            subtopic_number: srcSub.subtopic_number,
            title:           srcSub.title,
          }).select().single();
          if (subErr) continue;

          // Copy subtopic materials
          const subMats = (srcMats||[]).filter(m=>m.subtopic_id===srcSub.id);
          if (subMats.length>0) {
            await supabase.from('module_materials').insert(subMats.map(m=>({
              module_id:     newMod.id,
              subtopic_id:   newSub.id,
              material_type: m.material_type,
              title:         m.title,
              content:       m.content||null,
              url:           m.url||null,
              file_url:      m.file_url||null,
              file_name:     m.file_name||null,
              file_type:     m.file_type||null,
              order_num:     m.order_num,
            })));
          }
        }

        // Copy quizzes for this module
        const srcModQuizzes = (srcQuizzes||[]).filter(q=>q.module_id===srcMod.id);
        for (const srcQuiz of srcModQuizzes) {
          const {data:newQuiz,error:quizErr} = await supabase.from('session_quizzes').insert({
            booking_id:   selBooking.id,
            tutor_id:     user.id,
            module_id:    newMod.id,
            title:        srcQuiz.title,
            quiz_type:    srcQuiz.quiz_type,
            instructions: srcQuiz.instructions||null,
            pass_score:   srcQuiz.pass_score,
            max_attempts: srcQuiz.max_attempts,
            time_limit:   srcQuiz.time_limit,
            order_num:    srcQuiz.order_num,
            status:       'draft',
          }).select().single();
          if (quizErr) continue;

          // Copy quiz questions
          const {data:srcQs} = await supabase.from('quiz_questions').select('*').eq('quiz_id',srcQuiz.id);
          if (srcQs&&srcQs.length>0) {
            await supabase.from('quiz_questions').insert(srcQs.map(q=>({
              quiz_id:       newQuiz.id,
              question_text: q.question_text,
              question_type: q.question_type,
              options:       q.options,
              correct_index: q.correct_index,
              points:        q.points,
              order_num:     q.order_num,
            })));
          }
        }
      }

      showToast(`✅ Copied ${srcMods.length} module${srcMods.length!==1?'s':''} successfully! They are set to Draft — review and publish when ready.`);
      setCopyModal(false);
      setCopyingFrom(null);
      fetchAll(selBooking.id);
    } finally { setCopying(false); }
  };

  // ── Announcement CRUD ────────────────────────────────────────────────────
  const postAnnouncement = async () => {
    if (!annText.trim()) return;
    setSavingAnn(true);
    try {
      const {error} = await supabase.from('session_announcements').insert({
        booking_id: selBooking.id,
        tutor_id:   user.id,
        message:    annText.trim(),
        is_pinned:  true,
      });
      if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
      setAnnText('');
      fetchAnnouncements(selBooking.id);
      showToast('Announcement posted!');
    } finally { setSavingAnn(false); }
  };

  const updateAnnouncement = async () => {
    if (!editAnnText.trim()) return;
    setSavingAnn(true);
    try {
      const {error} = await supabase.from('session_announcements')
        .update({message: editAnnText.trim(), updated_at: new Date().toISOString()})
        .eq('id', editingAnn.id);
      if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
      setEditingAnn(null); setEditAnnText('');
      fetchAnnouncements(selBooking.id);
      showToast('Announcement updated!');
    } finally { setSavingAnn(false); }
  };

  const deleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    await supabase.from('session_announcements').delete().eq('id', id);
    fetchAnnouncements(selBooking.id);
    showToast('Announcement deleted.');
  };

  // ── Module CRUD ──────────────────────────────────────────────────────────
  const saveModule = async () => {
    if (!modForm.title.trim()) { showToast('Session title is required.','error'); return; }
    setSavingMod(true);
    try {
      if (modModal==='create') {
        const {error} = await supabase.from('session_modules').insert({
          booking_id:    selBooking.id,
          tutor_id:      user.id,
          module_number: modules.length+1,
          title:         modForm.title,
          description:   modForm.description||null,
          status:        'draft',
        });
        if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
        showToast('Module created!');
      } else {
        const {error} = await supabase.from('session_modules').update({title:modForm.title,description:modForm.description||null}).eq('id',modModal.id);
        if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
        showToast('Module updated!');
      }
      setModModal(null); fetchAll(selBooking.id);
    } finally { setSavingMod(false); }
  };

  const deleteModule = async (mod) => {
    if (!window.confirm(`Delete Session ${mod.module_number}: "${mod.title}"? Everything inside will be deleted.`)) return;
    const {error} = await supabase.from('session_modules').delete().eq('id',mod.id);
    if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
    showToast('Module deleted.'); fetchAll(selBooking.id);
  };

  const togglePublish = async (mod) => {
    const ns = mod.status==='published'?'draft':'published';
    const {error} = await supabase.from('session_modules').update({status:ns}).eq('id',mod.id);
    if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
    showToast(ns==='published'?'✅ Module published! Students can now see it.':'Module set to draft.');
    fetchAll(selBooking.id);
  };

  // ── Subtopic CRUD ────────────────────────────────────────────────────────
  const saveSubtopic = async () => {
    if (!subForm.title.trim()) { showToast('Title is required.','error'); return; }
    setSavingSub(true);
    try {
      const mod = subModal.module;
      if (!subModal.subtopic) {
        const {error} = await supabase.from('module_subtopics').insert({module_id:mod.id,subtopic_number:(mod.subtopics?.length||0)+1,title:subForm.title});
        if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
        showToast('Subtopic added!');
      } else {
        const {error} = await supabase.from('module_subtopics').update({title:subForm.title}).eq('id',subModal.subtopic.id);
        if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
        showToast('Subtopic updated!');
      }
      setSubModal(null); fetchAll(selBooking.id);
    } finally { setSavingSub(false); }
  };

  const deleteSubtopic = async (sub) => {
    if (!window.confirm(`Delete "${sub.title}"?`)) return;
    const {error} = await supabase.from('module_subtopics').delete().eq('id',sub.id);
    if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
    showToast('Subtopic deleted.'); fetchAll(selBooking.id);
  };

  // ── Material CRUD ────────────────────────────────────────────────────────
  const saveMaterial = async () => {
    if (!matForm.title.trim()) { showToast('Title is required.','error'); return; }
    setSavingMat(true);
    try {
      let fileUrl = matModal.material?.file_url || null;
      let fileName = matModal.material?.file_name || null;
      let fileType = matModal.material?.file_type || null;

      // Upload file if one was selected
      if (matForm.file) {
        const ext = matForm.file.name.split('.').pop();
        const path = `${user.id}/${Date.now()}-${matForm.file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const {error:upErr} = await supabase.storage
          .from('session-materials')
          .upload(path, matForm.file, {upsert:true, contentType:matForm.file.type});
        if (upErr) { showToast(`File upload failed: ${upErr.message}`,'error'); return; }
        const {data:urlData} = supabase.storage.from('session-materials').getPublicUrl(path);
        fileUrl  = urlData?.publicUrl || null;
        fileName = matForm.file.name;
        fileType = matForm.file.type;
      }

      const payload = {
        module_id:     matModal.module.id,
        subtopic_id:   matModal.subtopic?.id||null,
        material_type: matForm.material_type,
        title:         matForm.title,
        content:       matForm.content||null,
        url:           matForm.url||null,
        file_url:      fileUrl,
        file_name:     fileName,
        file_type:     fileType,
      };
      if (!matModal.material) {
        const orderNum = matModal.subtopic?(matModal.subtopic.materials?.length||0):(matModal.module.moduleMaterials?.length||0);
        const {error} = await supabase.from('module_materials').insert({...payload,order_num:orderNum});
        if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
        showToast('Material added!');
      } else {
        const {error} = await supabase.from('module_materials').update(payload).eq('id',matModal.material.id);
        if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
        showToast('Material updated!');
      }
      setMatModal(null);
      setMatFilePreview(null);
      fetchAll(selBooking.id);
    } finally { setSavingMat(false); }
  };

  const deleteMaterial = async (mat) => {
    if (!window.confirm(`Remove "${mat.title}"?`)) return;
    await supabase.from('module_materials').delete().eq('id',mat.id);
    showToast('Material removed.'); fetchAll(selBooking.id);
  };

  // ── Quiz CRUD ────────────────────────────────────────────────────────────
  const saveQuiz = async () => {
    if (!quizForm.title.trim()) { showToast('Quiz title is required.','error'); return; }
    setSavingQuiz(true);
    try {
      const payload = {
        booking_id:   selBooking.id,
        tutor_id:     user.id,
        module_id:    quizModal.module.id,
        subtopic_id:  quizModal.subtopic?.id || null, // link to subtopic if created from subtopic
        title:        quizForm.title,
        quiz_type:    quizForm.quiz_type,
        instructions: quizForm.instructions||null,
        pass_score:   quizForm.pass_score,
        max_attempts: quizForm.max_attempts,
        time_limit:   quizForm.time_limit,
        order_num:    (quizModal.module.quizzes?.length||0),
        status:       'draft',
      };
      if (quizModal.quiz) {
        const {error} = await supabase.from('session_quizzes').update(payload).eq('id',quizModal.quiz.id);
        if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
        showToast('Quiz updated!');
        setQuizModal(null); fetchAll(selBooking.id);
      } else {
        const {data,error} = await supabase.from('session_quizzes').insert(payload).select().single();
        if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
        showToast('Quiz created! Now add questions.');
        setQuizModal(null);
        await fetchAll(selBooking.id);
        setActiveQuiz(data);
        await fetchQuestions(data.id);
      }
    } finally { setSavingQuiz(false); }
  };

  const deleteQuiz = async (quiz) => {
    if (!window.confirm(`Delete quiz "${quiz.title}"?`)) return;
    const {error} = await supabase.from('session_quizzes').delete().eq('id',quiz.id);
    if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
    showToast('Quiz deleted.'); fetchAll(selBooking.id);
  };

  const togglePublishQuiz = async (quiz) => {
    const ns = quiz.status==='published'?'draft':'published';
    const {error} = await supabase.from('session_quizzes').update({status:ns}).eq('id',quiz.id);
    if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
    showToast(ns==='published'?'✅ Quiz published! Students can now take it.':'Quiz set to draft.');
    fetchAll(selBooking.id);
  };

  // ── Question CRUD ────────────────────────────────────────────────────────
  const addQuestion = async () => {
    if (!newQ.question_text.trim()) { showToast('Question is required.','error'); return; }
    if (newQ.question_type==='multiple_choice'&&newQ.options.some(o=>!o.trim())) { showToast('Fill in all 4 options.','error'); return; }
    setSavingQ(true);
    try {
      const opts = newQ.question_type==='true_false'?['True','False']:newQ.options;
      const {error} = await supabase.from('quiz_questions').insert({quiz_id:activeQuiz.id,question_text:newQ.question_text,question_type:newQ.question_type,options:opts,correct_index:newQ.correct_index,points:newQ.points,order_num:questions.length});
      if (error) { showToast(`Failed: ${error.message}`,'error'); return; }
      setNewQ({question_text:'',question_type:'multiple_choice',options:['','','',''],correct_index:0,points:1});
      await fetchQuestions(activeQuiz.id);
      showToast('Question added!');
    } finally { setSavingQ(false); }
  };

  const deleteQuestion = async (qId) => {
    await supabase.from('quiz_questions').delete().eq('id',qId);
    await fetchQuestions(activeQuiz.id);
    showToast('Question removed.');
  };

  if (bLoading) return <Spinner dark size={32}/>;

  // ── Booking selector ─────────────────────────────────────────────────────
  if (!selBooking) return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:22}}>Sessions</h2>
        <p className="text-sm text-muted mt-4">Select a booking to manage learning modules and quizzes.</p>
      </div>
      {confirmed.length===0
        ? <div className="card"><EmptyState icon="📚" title="No active bookings" description="Accept a booking first to start building sessions."/></div>
        : <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {confirmed.map(b=>(
              <div key={b.id} className="card p-20" style={{cursor:'pointer',border:`1.5px solid ${tokens.border}`,transition:'all 0.15s'}}
                onClick={()=>setSelBooking(b)}
                onMouseEnter={e=>e.currentTarget.style.borderColor=tokens.primary}
                onMouseLeave={e=>e.currentTarget.style.borderColor=tokens.border}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-jakarta font-bold" style={{fontSize:15}}>{b.student?.name} — <span style={{textTransform:'capitalize'}}>{b.subject}</span></div>
                    <div className="text-xs text-muted mt-4">Parent: {b.parent?.full_name} · Grade {b.student?.grade_level}</div>
                  </div>
                  <div className="flex gap-8 items-center">
                    <Badge variant={b.status==='completed'?'info':b.status==='confirmed'?'success':'warning'}>
                      {b.status==='completed'?'✅ Completed':b.status==='confirmed'?'🟢 Ongoing':'⏳ '+b.status}
                    </Badge>
                    <Icon name="arrowRight" size={16} color={tokens.primary}/>
                  </div>
                </div>
              </div>
            ))}
          </div>}
    </div>
  );

  // ── Quiz question editor ─────────────────────────────────────────────────
  if (activeQuiz) {
    const qType = QUIZ_TYPES.find(t=>t.value===activeQuiz.quiz_type);
    return (
      <div className="fade-in">
        <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>
        <button className="btn btn-ghost btn-sm mb-20" onClick={()=>{setActiveQuiz(null);fetchAll(selBooking.id);}}>← Back to Modules</button>
        <div className="flex items-center gap-12 mb-20">
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:800,padding:'3px 10px',borderRadius:20,background:qType?.bg,color:qType?.color,display:'inline-block',marginBottom:6}}>{qType?.label}</div>
            <h2 className="font-jakarta font-extrabold" style={{fontSize:20}}>{activeQuiz.title}</h2>
            <p className="text-xs text-muted mt-2">Pass: {activeQuiz.pass_score}% · Max {activeQuiz.max_attempts} attempts · {questions.length} question{questions.length!==1?'s':''}</p>
          </div>
        </div>
        <div className="grid-2" style={{gap:20}}>
          <div>
            <h3 className="font-jakarta font-bold mb-12" style={{fontSize:15}}>Questions ({questions.length})</h3>
            {loadingQs ? <Spinner dark size={24}/> : questions.length===0
              ? <div style={{padding:20,textAlign:'center',color:tokens.muted,fontSize:13,background:'#F9FAFB',borderRadius:12,border:`1px dashed ${tokens.border}`}}>No questions yet</div>
              : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {questions.map((q,i)=>(
                    <div key={q.id} style={{background:'#F9FAFB',borderRadius:10,padding:14,border:`1px solid ${tokens.border}`}}>
                      <div className="flex items-start justify-between gap-10">
                        <div style={{flex:1}}>
                          <div className="font-semibold mb-8" style={{fontSize:13}}>Q{i+1}. {q.question_text} <span style={{fontSize:11,color:tokens.muted}}>({q.points}pt)</span></div>
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            {q.options.map((opt,oi)=>(
                              <div key={oi} style={{fontSize:12,padding:'4px 8px',borderRadius:6,background:oi===q.correct_index?'#D1FAE5':'#fff',color:oi===q.correct_index?'#065F46':tokens.mid,border:`1px solid ${oi===q.correct_index?'#6EE7B7':tokens.border}`,fontWeight:oi===q.correct_index?700:400}}>
                                {String.fromCharCode(65+oi)}. {opt} {oi===q.correct_index?'✓':''}
                              </div>
                            ))}
                          </div>
                        </div>
                        <button onClick={()=>deleteQuestion(q.id)} style={{background:'#FEE2E2',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#DC2626',fontSize:12}}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>}
          </div>
          <div>
            {/* Tab switcher */}
            <div className="flex gap-0 mb-12" style={{borderBottom:`2px solid ${tokens.border}`}}>
              {[{key:'manual',label:'✏️ Manual'},{key:'ai',label:'🤖 AI from PDF'}].map(t=>(
                <button key={t.key} onClick={()=>setQTab(t.key)}
                  style={{padding:'8px 20px',border:'none',borderBottom:`3px solid ${qTab===t.key?tokens.primary:'transparent'}`,background:'none',cursor:'pointer',fontWeight:700,fontSize:13,color:qTab===t.key?tokens.primary:tokens.muted,marginBottom:-2}}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Manual tab */}
            {qTab==='manual'&&(
              <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:16}}>
                <FormGroup label="Type">
                  <div className="flex gap-8">
                    {['multiple_choice','true_false'].map(t=>(
                      <button key={t} type="button" onClick={()=>setNewQ(q=>({...q,question_type:t,options:t==='true_false'?['True','False']:['','','',''],correct_index:0}))}
                        style={{flex:1,padding:'8px',borderRadius:8,cursor:'pointer',border:`2px solid ${newQ.question_type===t?tokens.primary:tokens.border}`,background:newQ.question_type===t?tokens.primaryLight:'#FAFAFA',fontSize:12,fontWeight:600,color:newQ.question_type===t?tokens.primary:tokens.mid}}>
                        {t==='multiple_choice'?'Multiple Choice':'True / False'}
                      </button>
                    ))}
                  </div>
                </FormGroup>
                <FormGroup label="Question">
                  <textarea className="textarea" placeholder="Type the question..." value={newQ.question_text} onChange={e=>setNewQ(q=>({...q,question_text:e.target.value}))} style={{minHeight:80}}/>
                </FormGroup>
                {newQ.question_type==='multiple_choice'
                  ? newQ.options.map((opt,i)=>(
                      <FormGroup key={i} label={`Option ${String.fromCharCode(65+i)}${i===newQ.correct_index?' ✓':''}`}>
                        <div className="flex gap-8">
                          <input className="input" style={{flex:1,borderColor:i===newQ.correct_index?tokens.success:undefined}} placeholder={`Option ${String.fromCharCode(65+i)}`} value={opt} onChange={e=>setNewQ(q=>({...q,options:q.options.map((o,oi)=>oi===i?e.target.value:o)}))}/>
                          {i!==newQ.correct_index&&<button type="button" onClick={()=>setNewQ(q=>({...q,correct_index:i}))} style={{padding:'8px 10px',borderRadius:8,background:'#F9FAFB',border:`1px solid ${tokens.border}`,cursor:'pointer',fontSize:11,color:tokens.muted,whiteSpace:'nowrap'}}>Set Correct</button>}
                        </div>
                      </FormGroup>
                    ))
                  : <FormGroup label="Correct Answer">
                      <div className="flex gap-8">
                        {['True','False'].map((v,i)=>(
                          <button key={v} type="button" onClick={()=>setNewQ(q=>({...q,correct_index:i}))} style={{flex:1,padding:'10px',borderRadius:8,cursor:'pointer',border:`2px solid ${newQ.correct_index===i?tokens.primary:tokens.border}`,background:newQ.correct_index===i?tokens.primaryLight:'#FAFAFA',fontWeight:600,fontSize:14,color:newQ.correct_index===i?tokens.primary:tokens.mid}}>{v}</button>
                        ))}
                      </div>
                    </FormGroup>}
                <FormGroup label="Points"><input className="input" type="number" min="1" max="10" value={newQ.points} onChange={e=>setNewQ(q=>({...q,points:Number(e.target.value)}))}/></FormGroup>
                <button className="btn btn-primary btn-full" onClick={addQuestion} disabled={savingQ}>{savingQ?'Adding...':'+ Add Question'}</button>
              </div>
            )}

            {/* AI PDF tab */}
            {qTab==='ai'&&(
              <div>
                <div style={{background:'#F5F3FF',border:'1px solid #DDD6FE',borderRadius:12,padding:16,marginBottom:16}}>
                  <div className="font-jakarta font-bold mb-4" style={{fontSize:14,color:'#7C3AED'}}>🤖 AI Question Extractor</div>
                  <p style={{fontSize:12,color:'#6D28D9',marginBottom:12,lineHeight:1.6}}>
                    Upload a PDF with quiz questions. AI reads it and extracts all multiple-choice and true/false questions automatically.
                  </p>
                  <label style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:10,border:`2px dashed ${aiPdfFile?'#7C3AED':'#DDD6FE'}`,background:aiPdfFile?'#EDE9FE':'#FAFAF9',cursor:'pointer',marginBottom:12}}>
                    <input type="file" accept=".pdf,application/pdf" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];e.target.value='';if(f)setAiPdfFile(f);}}/>
                    <span style={{fontSize:24}}>{aiPdfFile?'✅':'📄'}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:aiPdfFile?'#7C3AED':'#6B7280'}}>{aiPdfFile?aiPdfFile.name:'Click to upload PDF'}</div>
                      <div style={{fontSize:11,color:'#9CA3AF'}}>PDF only · Questions extracted automatically</div>
                    </div>
                    {aiPdfFile&&<button type="button" onClick={e=>{e.preventDefault();setAiPdfFile(null);setAiPreview([]);}} style={{marginLeft:'auto',background:'#FEE2E2',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#DC2626',fontSize:12}}>Remove</button>}
                  </label>
                  <button className="btn btn-full" style={{background:'#7C3AED',color:'#fff',fontWeight:700}} onClick={extractQuestionsFromPdf} disabled={!aiPdfFile||aiLoading}>
                    {aiLoading?'🤖 AI is reading the PDF...':'🤖 Extract Questions with AI'}
                  </button>
                </div>
                {aiPreview.length>0&&(
                  <div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                      <div className="font-jakarta font-bold" style={{fontSize:14}}>Preview — {aiPreview.length} questions found</div>
                      <div className="flex gap-8">
                        <button className="btn btn-sm btn-ghost" onClick={()=>{setAiPreview([]);setAiPdfFile(null);}}>Clear</button>
                        <button className="btn btn-sm" style={{background:'#7C3AED',color:'#fff'}} onClick={saveAiQuestions} disabled={savingAiQs}>
                          {savingAiQs?'Saving...':'Save All '+aiPreview.length+' Questions'}
                        </button>
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:10,maxHeight:500,overflowY:'auto'}}>
                      {aiPreview.map((q,i)=>(
                        <div key={i} style={{background:'#F9FAFB',borderRadius:10,padding:14,border:`1px solid ${tokens.border}`}}>
                          {/* Question text - editable */}
                          <div style={{fontSize:11,color:tokens.muted,marginBottom:4,fontWeight:600}}>Q{i+1}. Question</div>
                          <textarea
                            className="input"
                            value={q.question_text}
                            onChange={e=>setAiPreview(prev=>prev.map((pq,pi)=>pi===i?{...pq,question_text:e.target.value}:pq))}
                            style={{fontSize:13,marginBottom:10,minHeight:60,resize:'vertical',width:'100%'}}
                          />
                          {/* Options - editable */}
                          <div style={{fontSize:11,color:tokens.muted,marginBottom:6,fontWeight:600}}>Options (click ✓ to set correct answer)</div>
                          <div style={{display:'flex',flexDirection:'column',gap:6}}>
                            {q.options.map((opt,oi)=>(
                              <div key={oi} style={{display:'flex',alignItems:'center',gap:8}}>
                                <button
                                  type="button"
                                  onClick={()=>setAiPreview(prev=>prev.map((pq,pi)=>pi===i?{...pq,correct_index:oi}:pq))}
                                  style={{width:28,height:28,borderRadius:'50%',flexShrink:0,border:`2px solid ${oi===q.correct_index?'#22C55E':'#D1D5DB'}`,background:oi===q.correct_index?'#22C55E':'#fff',color:oi===q.correct_index?'#fff':'#9CA3AF',fontSize:12,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                  {oi===q.correct_index?'✓':String.fromCharCode(65+oi)}
                                </button>
                                <input
                                  className="input"
                                  value={opt}
                                  onChange={e=>setAiPreview(prev=>prev.map((pq,pi)=>pi===i?{...pq,options:pq.options.map((o,opi)=>opi===oi?e.target.value:o)}:pq))}
                                  style={{fontSize:12,flex:1,background:oi===q.correct_index?'#F0FDF4':'#fff',border:`1px solid ${oi===q.correct_index?'#6EE7B7':'#E5E7EB'}`}}
                                />
                                {q.options.length > 2 && (
                                  <button type="button"
                                    onClick={()=>setAiPreview(prev=>prev.map((pq,pi)=>pi===i?{...pq,options:pq.options.filter((_,fi)=>fi!==oi),correct_index:pq.correct_index>=oi&&pq.correct_index>0?pq.correct_index-1:pq.correct_index}:pq))}
                                    style={{width:24,height:24,borderRadius:'50%',flexShrink:0,border:'none',background:'#FEE2E2',color:'#DC2626',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          {/* Add option button */}
                          {q.options.length < 6 && (
                            <button type="button"
                              onClick={()=>setAiPreview(prev=>prev.map((pq,pi)=>pi===i?{...pq,options:[...pq.options,'']}:pq))}
                              style={{marginTop:8,fontSize:12,fontWeight:600,color:tokens.primary,background:tokens.primaryLight,border:`1px dashed ${tokens.primary}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',width:'100%'}}>
                              + Add Option {String.fromCharCode(65+q.options.length)}
                            </button>
                          )}
                          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10}}>
                            <span style={{fontSize:11,color:tokens.muted}}>{q.points||1} pt</span>
                            <button onClick={()=>setAiPreview(prev=>prev.filter((_,pi)=>pi!==i))} style={{marginLeft:'auto',background:'#FEE2E2',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',color:'#DC2626',fontSize:11}}>Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-full mt-12" style={{background:'#7C3AED',color:'#fff',fontWeight:700}} onClick={saveAiQuestions} disabled={savingAiQs}>
                      {savingAiQs?'Saving...':'Save All '+aiPreview.length+' Questions to Quiz'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main canvas view ─────────────────────────────────────────────────────

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
      <div className="flex items-center gap-12 mb-16">
        <button className="btn btn-ghost btn-sm" onClick={()=>{setSelBooking(null);setModules([]);setExpanded({});setActiveTab('modules');}}>← Back</button>
        <div style={{flex:1}}>
          <h2 className="font-jakarta font-extrabold" style={{fontSize:20}}>📚 {selBooking.student?.name} — {selBooking.subject}</h2>
          <div className="flex items-center gap-10 mt-4">
            <p className="text-xs text-muted">Parent: {selBooking.parent?.full_name} · Grade {selBooking.student?.grade_level}</p>
            <span style={{fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:20,
              background:selBooking.status==='completed'?'#D1FAE5':selBooking.status==='confirmed'?'#EFF6FF':'#FEF9C3',
              color:selBooking.status==='completed'?'#065F46':selBooking.status==='confirmed'?'#1D4ED8':'#92400E'}}>
              {selBooking.status==='completed'?'✅ Completed':selBooking.status==='confirmed'?'🟢 Ongoing':'⏳ '+selBooking.status}
            </span>
          </div>
        </div>
        {activeTab==='modules'&&(
          <div className="flex gap-8">
            <button className="btn btn-sm" style={{background:'#EFF6FF',color:tokens.primary,border:`1px solid ${tokens.primary}30`}} onClick={openCopyModal}>
              📋 Copy from Booking
            </button>
            <button className="btn btn-primary" onClick={()=>{setModForm({title:'',description:''});setModModal('create');}}>
              <Icon name="plus" size={14}/> Add Module
            </button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 mb-20" style={{borderBottom:`2px solid ${tokens.border}`}}>
        {[
          {key:'modules', label:'📖 Sessions & Quizzes', count:modules.length},
          {key:'progress', label:'📊 Student Progress', count:quizAttempts.length+matViews.length},
          {key:'video',    label:'🎥 Video Meeting',     count:null},
        ].map(t=>(
          <button key={t.key} onClick={()=>setActiveTab(t.key)}
            style={{padding:'10px 24px',border:'none',borderBottom:`3px solid ${activeTab===t.key?tokens.primary:'transparent'}`,background:'none',cursor:'pointer',fontWeight:700,fontSize:14,color:activeTab===t.key?tokens.primary:tokens.muted,marginBottom:-2,transition:'all 0.15s',display:'flex',alignItems:'center',gap:8}}>
            {t.label}
            {t.count>0&&<span style={{fontSize:11,fontWeight:800,padding:'2px 8px',borderRadius:20,background:activeTab===t.key?tokens.primary:'#E5E7EB',color:activeTab===t.key?'#fff':tokens.muted}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── PROGRESS TAB ── */}
      {activeTab==='progress'&&(
        <div className="fade-in">
          {quizAttempts.length===0&&matViews.length===0 ? (
            <div className="card p-40 text-center">
              <div style={{fontSize:48,marginBottom:16}}>📊</div>
              <div className="font-jakarta font-bold mb-8" style={{fontSize:18}}>No activity yet</div>
              <p className="text-sm text-muted">The student hasn't opened any materials or taken any quizzes yet.</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:20}}>

              {/* Quiz scores per module — including subtopic quizzes */}
              {modules.map(mod=>{
                // Combine module-level quizzes AND subtopic quizzes
                const modQuizzes = [
                  ...(mod.quizzes||[]).map(q=>({...q, subtopicName: null})),
                  ...(mod.subtopics||[]).flatMap(sub=>
                    (sub.quizzes||[]).map(q=>({...q, subtopicName: sub.title}))
                  ),
                ];
                if (modQuizzes.length===0) return null;
                return (
                  <div key={mod.id} className="card" style={{overflow:'hidden'}}>
                    <div style={{padding:'12px 20px',background:tokens.primaryLight,borderBottom:`1px solid ${tokens.border}`}}>
                      <div className="font-jakarta font-bold" style={{fontSize:14}}>Session {mod.module_number}: {mod.title}</div>
                    </div>
                    <div style={{padding:'16px 20px'}}>
                      {modQuizzes.map(quiz=>{
                        const attempts = quizAttempts.filter(a=>a.quiz_id===quiz.id);
                        const best = attempts.reduce((b,a)=>(!b||a.score>b.score)?a:b, null);
                        const qTypeDef = QUIZ_TYPES.find(t=>t.value===quiz.quiz_type)||QUIZ_TYPES[0];
                        const qt = {color:qTypeDef.color, bg:qTypeDef.bg, label:qTypeDef.short};
                        return (
                          <div key={quiz.id} style={{marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${tokens.border}`}}>
                            <div className="flex items-center gap-10 mb-10">
                              <span style={{fontSize:11,fontWeight:800,padding:'2px 8px',borderRadius:6,background:qt.bg,color:qt.color}}>{qt.label}</span>
                              <span className="font-semibold" style={{fontSize:13}}>{quiz.title}</span>
                              {quiz.subtopicName && <span style={{fontSize:11,padding:'2px 8px',borderRadius:6,background:'#E0F2FE',color:'#0891B2',fontWeight:600}}>📌 {quiz.subtopicName}</span>}
                              <span style={{fontSize:11,color:tokens.muted,marginLeft:'auto'}}>Pass: {quiz.pass_score}% · Max {quiz.max_attempts} attempts</span>
                            </div>
                            {attempts.length===0 ? (
                              <div style={{fontSize:12,color:tokens.muted,fontStyle:'italic',padding:'8px 0'}}>No attempts yet</div>
                            ) : (
                              <div>
                                {/* Best score summary */}
                                {best&&(
                                  <div className="flex items-center gap-12 mb-10" style={{padding:'10px 14px',borderRadius:10,background:best.passed?'#F0FDF4':'#FEF9C3',border:`1px solid ${best.passed?'#6EE7B7':'#FDE68A'}`}}>
                                    <div style={{width:48,height:48,borderRadius:'50%',background:best.passed?tokens.success:'#F59E0B',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                      <span style={{color:'#fff',fontWeight:800,fontSize:16}}>{best.score}%</span>
                                    </div>
                                    <div>
                                      <div style={{fontSize:13,fontWeight:700,color:best.passed?'#065F46':'#92400E'}}>{best.passed?'✅ Passed':'⚠️ Not Yet Passed'}</div>
                                      <div style={{fontSize:11,color:tokens.muted}}>Best score · {attempts.length} attempt{attempts.length!==1?'s':''} · Student: {best.student?.name||'—'}</div>
                                    </div>
                                    {/* Score bar */}
                                    <div style={{flex:1}}>
                                      <div style={{height:8,background:'#E5E7EB',borderRadius:4,overflow:'hidden',position:'relative'}}>
                                        <div style={{position:'absolute',left:`${quiz.pass_score}%`,top:0,bottom:0,width:2,background:'#374151',zIndex:2}}/>
                                        <div style={{height:'100%',borderRadius:4,width:`${best.score}%`,background:best.passed?tokens.success:'#F59E0B',transition:'width 0.5s'}}/>
                                      </div>
                                      <div style={{fontSize:10,color:tokens.muted,marginTop:3}}>{quiz.pass_score}% pass mark</div>
                                    </div>
                                  </div>
                                )}
                                {/* All attempts */}
                                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                  {attempts.map((a,i)=>(
                                    <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,background:'#F9FAFB',border:`1px solid ${tokens.border}`,fontSize:12}}>
                                      <span style={{fontWeight:700,color:tokens.muted}}>Attempt {a.attempt_num}</span>
                                      <span style={{fontWeight:700,color:a.passed?'#065F46':'#DC2626'}}>{a.score}% {a.passed?'✓ Passed':'✗ Failed'}</span>
                                      <span style={{color:tokens.muted,marginLeft:'auto'}}>{a.submitted_at?new Date(a.submitted_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Material views */}
              {matViews.length>0&&(
                <div className="card" style={{overflow:'hidden'}}>
                  <div style={{padding:'12px 20px',background:'#F0FDF4',borderBottom:`1px solid ${tokens.border}`}}>
                    <div className="font-jakarta font-bold" style={{fontSize:14}}>📂 Materials Opened by Student</div>
                  </div>
                  <div style={{padding:'16px 20px'}}>
                    {modules.map(mod=>{
                      const allMats = [...(mod.moduleMaterials||[]),...(mod.subtopics||[]).flatMap(s=>s.materials||[])];
                      const viewedMats = allMats.filter(mat=>matViews.some(v=>v.material_id===mat.id));
                      if (viewedMats.length===0) return null;
                      return (
                        <div key={mod.id} style={{marginBottom:14}}>
                          <div style={{fontSize:12,fontWeight:700,color:tokens.muted,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px'}}>Session {mod.module_number}: {mod.title}</div>
                          {viewedMats.map(mat=>{
                            const view = matViews.find(v=>v.material_id===mat.id);
                            return (
                              <div key={mat.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,background:'#F9FAFB',border:`1px solid ${tokens.border}`,marginBottom:6,fontSize:12}}>
                                <span style={{color:'#065F46'}}>✓</span>
                                <span style={{flex:1}}>{mat.title}</span>
                                <span style={{color:tokens.muted}}>{view?.student?.name||'Student'}</span>
                                <span style={{color:tokens.muted}}>{view?.viewed_at?new Date(view.viewed_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab==='video'&&(
        <ZoomMeeting booking={selBooking} isTutor={true} />
      )}

      {activeTab==='modules'&&(
      <>
      {/* ── Announcements — pinned above modules ── */}
      <div style={{marginBottom:20}}>
        {/* Existing announcements */}
        {announcements.map(ann=>(
          <div key={ann.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'14px 18px',borderRadius:12,background:'#FFFBEB',border:'2px solid #FDE68A',marginBottom:10}}>
            <span style={{fontSize:20,flexShrink:0}}>📌</span>
            <div style={{flex:1}}>
              {editingAnn?.id===ann.id ? (
                <div>
                  <textarea
                    className="textarea"
                    value={editAnnText}
                    onChange={e=>setEditAnnText(e.target.value)}
                    style={{minHeight:70,marginBottom:8,fontSize:13}}
                  />
                  <div className="flex gap-8">
                    <button className="btn btn-sm btn-ghost" onClick={()=>{setEditingAnn(null);setEditAnnText('');}}>Cancel</button>
                    <button className="btn btn-sm btn-primary" onClick={updateAnnouncement} disabled={savingAnn}>{savingAnn?'Saving...':'Save'}</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{fontSize:13,lineHeight:1.7,color:'#92400E',fontWeight:500}}>{linkify(ann.message)}</div>
                  <div style={{fontSize:11,color:'#B45309',marginTop:4}}>
                    Posted {new Date(ann.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                    {ann.updated_at!==ann.created_at&&' · edited'}
                  </div>
                </div>
              )}
            </div>
            {editingAnn?.id!==ann.id&&(
              <div className="flex gap-6">
                <button onClick={()=>{setEditingAnn(ann);setEditAnnText(ann.message);}} style={{background:'none',border:'none',cursor:'pointer',color:'#92400E',fontSize:13}}>✏️</button>
                <button onClick={()=>deleteAnnouncement(ann.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',fontSize:13}}>✕</button>
              </div>
            )}
          </div>
        ))}

        {/* Post new announcement */}
        <div style={{background:'#FAFAFA',border:`1px solid ${tokens.border}`,borderRadius:12,padding:14}}>
          <div className="font-semibold mb-8" style={{fontSize:13,color:tokens.mid}}>📢 Post Announcement to {selBooking.parent?.full_name}</div>
          <textarea
            className="textarea"
            placeholder="Write an announcement visible to the parent and student (e.g. No session this Saturday, Quiz next week, Reminder: bring materials...)"
            value={annText}
            onChange={e=>setAnnText(e.target.value)}
            style={{minHeight:80,fontSize:13,marginBottom:8}}
          />
          <button className="btn btn-sm" style={{background:'#FDE68A',color:'#92400E',border:'1px solid #F59E0B',fontWeight:700}} onClick={postAnnouncement} disabled={savingAnn||!annText.trim()}>
            {savingAnn?'Posting...':'📌 Post Announcement'}
          </button>
        </div>
      </div>

      {loading ? <Spinner dark size={28}/> : modules.length===0
        ? <div className="card p-40 text-center">
            <div style={{fontSize:48,marginBottom:16}}>📖</div>
            <div className="font-jakarta font-bold mb-8" style={{fontSize:18}}>No modules yet</div>
            <p className="text-sm text-muted mb-20">Create your first module, add materials and quizzes inside it.</p>
            <button className="btn btn-primary" onClick={()=>{setModForm({title:'',description:''});setModModal('create');}}>+ Create First Module</button>
          </div>
        : <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {modules.map(mod=>(
              <div key={mod.id} style={{border:`2px solid ${mod.status==='published'?tokens.primary:tokens.border}`,borderRadius:16,overflow:'hidden',background:'#fff'}}>

                {/* Module header */}
                <div style={{padding:'14px 20px',background:mod.status==='published'?tokens.primaryLight:'#F9FAFB',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>toggle(mod.id)}>
                  <Icon name={expanded[mod.id]?'chevronDown':'chevronRight'} size={16} color={tokens.muted}/>
                  <div style={{flex:1}}>
                    <div className="font-jakarta font-bold" style={{fontSize:15}}>Session {mod.module_number}: {mod.title}</div>
                    {mod.description&&<div className="text-xs text-muted mt-2">{mod.description}</div>}
                    <div className="flex gap-8 mt-4">
                      <span style={{fontSize:11,color:tokens.muted}}>{(mod.moduleMaterials?.length||0)+(mod.subtopics?.reduce((a,s)=>a+(s.materials?.length||0),0)||0)} materials</span>
                      <span style={{fontSize:11,color:tokens.muted}}>{mod.quizzes?.length||0} quiz{(mod.quizzes?.length||0)!==1?'zes':''}</span>
                    </div>
                  </div>
                  <div className="flex gap-6" onClick={e=>e.stopPropagation()}>
                    <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:700,background:mod.status==='published'?'#D1FAE5':'#FEF9C3',color:mod.status==='published'?'#065F46':'#92400E'}}>
                      {mod.status==='published'?'✓ Published':'Draft'}
                    </span>
                    <button className="btn btn-sm" style={{background:'#F0FDF4',color:'#065F46',border:'1px solid #6EE7B7'}} onClick={()=>togglePublish(mod)}>
                      {mod.status==='published'?'Unpublish':'Publish'}
                    </button>
                    <button className="btn btn-sm" style={{background:tokens.primaryLight,color:tokens.primary}} onClick={()=>{setModForm({title:mod.title,description:mod.description||''});setModModal(mod);}}>
                      <Icon name="edit" size={11}/>
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={()=>deleteModule(mod)}><Icon name="x" size={11}/></button>
                  </div>
                </div>

                {/* Expanded body */}
                {expanded[mod.id]&&(
                  <div style={{padding:'16px 20px',borderTop:`1px solid ${tokens.border}`}}>

                    {/* Module-level materials */}
                    {mod.moduleMaterials?.map(mat=>(
                      <MatRow key={mat.id} mat={mat}
                        onEdit={()=>{setMatForm({title:mat.title,material_type:mat.material_type,content:mat.content||'',url:mat.url||'',file:null,file_name:mat.file_name||'',file_type:mat.file_type||''});setMatFilePreview(mat.file_url?{url:mat.file_url,type:mat.file_type}:null);setMatModal({module:mod,subtopic:null,material:mat});}}
                        onDelete={()=>deleteMaterial(mat)}/>
                    ))}

                    {/* Subtopics */}
                    {mod.subtopics?.map(sub=>(
                      <div key={sub.id} style={{marginBottom:12,paddingLeft:16,borderLeft:`3px solid ${tokens.primary}20`}}>
                        <div className="flex items-center gap-8 mb-8">
                          <div className="font-jakarta font-bold" style={{fontSize:13,color:tokens.primary}}>Subtopic {sub.subtopic_number}: {sub.title}</div>
                          <button className="btn btn-sm" style={{fontSize:11,padding:'2px 8px',background:tokens.primaryLight,color:tokens.primary}} onClick={()=>{setSubForm({title:sub.title});setSubModal({module:mod,subtopic:sub});}}>✏️</button>
                          <button className="btn btn-sm btn-danger" style={{fontSize:11,padding:'2px 8px'}} onClick={()=>deleteSubtopic(sub)}>✕</button>
                          <button className="btn btn-sm" style={{fontSize:11,padding:'3px 10px',background:'#F0FDF4',color:'#065F46',border:'1px solid #6EE7B7',marginLeft:'auto'}} onClick={()=>{setMatForm({title:'',material_type:'note',content:'',url:''});setMatModal({module:mod,subtopic:sub,material:null});}}>+ Material</button>
                          <button className="btn btn-sm" style={{fontSize:11,padding:'3px 10px',background:'#E0F2FE',color:'#0891B2',border:'1px solid #BAE6FD'}} onClick={()=>{setQuizForm({title:'',quiz_type:'checkpoint',instructions:'',pass_score:75,max_attempts:3,time_limit:30});setQuizModal({module:mod,subtopic:sub,quiz:null,subtopicOnly:true});}}>+ Subtopic Quiz</button>
                        </div>
                        {sub.materials?.map(mat=>(
                          <MatRow key={mat.id} mat={mat}
                            onEdit={()=>{setMatForm({title:mat.title,material_type:mat.material_type,content:mat.content||'',url:mat.url||'',file:null,file_name:mat.file_name||'',file_type:mat.file_type||''});setMatFilePreview(mat.file_url?{url:mat.file_url,type:mat.file_type}:null);setMatModal({module:mod,subtopic:sub,material:mat});}}
                            onDelete={()=>deleteMaterial(mat)}/>
                        ))}
                        {/* Subtopic Quizzes — shown directly under subtopic */}
                        {sub.quizzes?.length>0&&(
                          <div style={{marginTop:6,paddingLeft:8}}>
                            {sub.quizzes.map(quiz=>{
                              const qType = QUIZ_TYPES.find(t=>t.value===quiz.quiz_type);
                              return (
                                <div key={quiz.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,background:quiz.status==='published'?'#F0FDF4':'#F0F9FF',border:`1px solid ${quiz.status==='published'?'#6EE7B7':'#BAE6FD'}`,marginBottom:4}}>
                                  <div style={{width:28,height:28,borderRadius:6,background:qType?.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                    <span style={{fontSize:10,fontWeight:900,color:qType?.color}}>{qType?.short}</span>
                                  </div>
                                  <div style={{flex:1}}>
                                    <div style={{fontSize:12,fontWeight:600}}>{quiz.title}</div>
                                    <div style={{fontSize:10,color:tokens.muted}}>Pass {quiz.pass_score}% · {quiz.time_limit>0?`${quiz.time_limit} min`:'No limit'}</div>
                                  </div>
                                  <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:quiz.status==='published'?'#D1FAE5':'#FEF9C3',color:quiz.status==='published'?'#065F46':'#92400E'}}>
                                    {quiz.status==='published'?'✓ Published':'Draft'}
                                  </span>
                                  <button className="btn btn-sm" style={{fontSize:10,padding:'2px 8px',background:'#EFF6FF',color:tokens.primary}} onClick={async()=>{setActiveQuiz(quiz);await fetchQuestions(quiz.id);}}>
                                    Questions
                                  </button>
                                  <button className="btn btn-sm" style={{fontSize:10,padding:'2px 8px',background:'#F0FDF4',color:'#065F46',border:'1px solid #6EE7B7'}} onClick={()=>togglePublishQuiz(quiz)}>
                                    {quiz.status==='published'?'Unpublish':'Publish'}
                                  </button>
                                  <button className="btn btn-sm btn-danger" style={{fontSize:10,padding:'2px 6px'}} onClick={()=>deleteQuiz(quiz)}><Icon name="x" size={10}/></button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Quizzes section — inside same module */}
                    {mod.quizzes?.length>0&&(
                      <div style={{marginTop:16,paddingTop:14,borderTop:`1px dashed ${tokens.border}`}}>
                        <div className="text-xs text-muted uppercase font-bold mb-10" style={{letterSpacing:'0.5px'}}>Quizzes in this module</div>
                        {mod.quizzes.map(quiz=>{
                          const qType = QUIZ_TYPES.find(t=>t.value===quiz.quiz_type);
                          return (
                            <div key={quiz.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:'#FAFAFA',border:`1px solid ${quiz.status==='published'?qType?.color||tokens.primary:tokens.border}`,marginBottom:8}}>
                              <div style={{width:36,height:36,borderRadius:8,background:qType?.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                <span style={{fontSize:12,fontWeight:900,color:qType?.color}}>{qType?.short}</span>
                              </div>
                              <div style={{flex:1}}>
                                <div className="font-semibold" style={{fontSize:13}}>{quiz.title}</div>
                                <div style={{fontSize:11,color:tokens.muted}}>Pass {quiz.pass_score}% · Max {quiz.max_attempts} attempts{quiz.time_limit>0?` · ${quiz.time_limit} min`:''}</div>
                              </div>
                              <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:700,background:quiz.status==='published'?'#D1FAE5':'#FEF9C3',color:quiz.status==='published'?'#065F46':'#92400E'}}>
                                {quiz.status==='published'?'✓ Published':'Draft'}
                              </span>
                              <button className="btn btn-sm" style={{background:'#EFF6FF',color:tokens.primary}} onClick={async()=>{setActiveQuiz(quiz);await fetchQuestions(quiz.id);}}>
                                <Icon name="clipboard" size={11} color={tokens.primary}/> Questions
                              </button>
                              <button className="btn btn-sm" style={{background:'#F0FDF4',color:'#065F46',border:'1px solid #6EE7B7'}} onClick={()=>togglePublishQuiz(quiz)}>
                                {quiz.status==='published'?'Unpublish':'Publish'}
                              </button>
                              <button className="btn btn-sm" style={{background:tokens.primaryLight,color:tokens.primary}} onClick={()=>{setQuizForm({title:quiz.title,quiz_type:quiz.quiz_type,instructions:quiz.instructions||'',pass_score:quiz.pass_score,max_attempts:quiz.max_attempts,time_limit:quiz.time_limit});setQuizModal({module:mod,quiz});}}>
                                <Icon name="edit" size={11}/>
                              </button>
                              <button className="btn btn-sm btn-danger" onClick={()=>deleteQuiz(quiz)}><Icon name="x" size={11}/></button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add buttons */}
                    <div className="flex gap-8 mt-12" style={{flexWrap:'wrap'}}>
                      <button className="btn btn-sm" style={{background:'#EFF6FF',color:tokens.primary,border:`1px solid ${tokens.primary}30`}} onClick={()=>{setSubForm({title:''});setSubModal({module:mod,subtopic:null});}}>+ Add Subtopic</button>
                      <button className="btn btn-sm" style={{background:'#F9FAFB',color:tokens.mid,border:`1px solid ${tokens.border}`}} onClick={()=>{setMatForm({title:'',material_type:'note',content:'',url:''});setMatModal({module:mod,subtopic:null,material:null});}}>+ Add Material</button>
                      <button className="btn btn-sm" style={{background:'#EEF2FF',color:'#6366F1',border:'1px solid #6366F130'}} onClick={()=>{setQuizForm({title:'',quiz_type:'formative',instructions:'',pass_score:75,max_attempts:10,time_limit:0});setQuizModal({module:mod,quiz:null});}}>+ Add Quiz</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>}
      </>)}

      {/* Module Modal */}
      <Modal open={!!modModal} onClose={()=>setModModal(null)} title={modModal==='create'?'📖 Create Session':'✏️ Edit Session'}
        footer={<><button className="btn btn-ghost" onClick={()=>setModModal(null)}>Cancel</button><button className="btn btn-primary" onClick={saveModule} disabled={savingMod}>{savingMod?'Saving...':modModal==='create'?'Create Module':'Save Changes'}</button></>}>
        <FormGroup label="Session Title"><input className="input" placeholder="e.g. Session 1 - Introduction to Fractions" value={modForm.title} onChange={e=>setModForm(f=>({...f,title:e.target.value}))}/></FormGroup>
        <FormGroup label="Description (Optional)"><textarea className="textarea" placeholder="Brief description..." value={modForm.description} onChange={e=>setModForm(f=>({...f,description:e.target.value}))} style={{minHeight:80}}/></FormGroup>
      </Modal>

      {/* Subtopic Modal */}
      <Modal open={!!subModal} onClose={()=>setSubModal(null)} title={subModal?.subtopic?'✏️ Edit Subtopic':'➕ Add Subtopic'}
        footer={<><button className="btn btn-ghost" onClick={()=>setSubModal(null)}>Cancel</button><button className="btn btn-primary" onClick={saveSubtopic} disabled={savingSub}>{savingSub?'Saving...':subModal?.subtopic?'Save Changes':'Add Subtopic'}</button></>}>
        <FormGroup label="Subtopic Title"><input className="input" placeholder="e.g. The Economic Context" value={subForm.title} onChange={e=>setSubForm({title:e.target.value})}/></FormGroup>
      </Modal>

      {/* Material Modal */}
      <Modal open={!!matModal} onClose={()=>{setMatModal(null);setMatFilePreview(null);}} title={matModal?.material?'✏️ Edit Material':'➕ Add Material'}
        footer={<><button className="btn btn-ghost" onClick={()=>{setMatModal(null);setMatFilePreview(null);}}>Cancel</button><button className="btn btn-primary" onClick={saveMaterial} disabled={savingMat}>{savingMat?'Uploading...':matModal?.material?'Save Changes':'Add Material'}</button></>}>
        <FormGroup label="Material Type">
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
            {MATERIAL_TYPES.map(t=>(
              <button key={t.value} type="button" onClick={()=>setMatForm(f=>({...f,material_type:t.value}))}
                style={{padding:'6px 8px',borderRadius:8,cursor:'pointer',border:`2px solid ${matForm.material_type===t.value?t.color:tokens.border}`,background:matForm.material_type===t.value?t.bg:'#FAFAFA',transition:'all 0.15s'}}>
                <div style={{fontSize:10,fontWeight:800,color:t.color}}>{t.label}</div>
              </button>
            ))}
          </div>
        </FormGroup>
        <FormGroup label="Title"><input className="input" placeholder="Title here..." value={matForm.title} onChange={e=>setMatForm(f=>({...f,title:e.target.value}))}/></FormGroup>
        <FormGroup label="Content / Notes" hint="Optional lesson text or summary."><textarea className="textarea" placeholder="Lesson content, notes, explanations..." value={matForm.content} onChange={e=>setMatForm(f=>({...f,content:e.target.value}))} style={{minHeight:100}}/></FormGroup>

        {/* File Upload */}
        <FormGroup label="Upload File (PDF or PPT)" hint="Students will view the file directly inside the website.">
          <label style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:10,border:`2px dashed ${matForm.file||matModal?.material?.file_url?tokens.success:tokens.border}`,background:matForm.file||matModal?.material?.file_url?'#F0FDF4':'#FAFAFA',cursor:'pointer',transition:'all 0.15s'}}>
            <input type="file" accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              style={{display:'none'}}
              onChange={e=>{
                const f = e.target.files[0];
                e.target.value='';
                if (!f) return;
                if (f.size > 50*1024*1024) { showToast('File too large. Max 50MB.','error'); return; }
                setMatForm(prev=>({...prev,file:f,file_name:f.name,file_type:f.type}));
                // Create local preview URL
                const localUrl = URL.createObjectURL(f);
                setMatFilePreview({url:localUrl,type:f.type,local:true});
              }}
            />
            <span style={{fontSize:24}}>{matForm.file||matModal?.material?.file_url?'✅':'📎'}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:matForm.file||matModal?.material?.file_url?'#065F46':tokens.mid}}>
                {matForm.file ? matForm.file.name : matModal?.material?.file_name ? matModal.material.file_name : 'Click to upload PDF or PPT'}
              </div>
              <div style={{fontSize:11,color:tokens.muted}}>PDF, PPT, PPTX · Max 50MB</div>
            </div>
            {(matForm.file||matModal?.material?.file_url)&&(
              <button type="button" onClick={e=>{e.preventDefault();setMatForm(f=>({...f,file:null,file_name:'',file_type:''}));setMatFilePreview(null);}} style={{marginLeft:'auto',background:'#FEE2E2',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#DC2626',fontSize:12}}>Remove</button>
            )}
          </label>
        </FormGroup>

        {/* External Link */}
        <FormGroup label="External Link (Optional)" hint="YouTube, Google Slides, Teams link, etc."><input className="input" placeholder="https://..." value={matForm.url} onChange={e=>setMatForm(f=>({...f,url:e.target.value}))}/></FormGroup>
      </Modal>

      {/* Quiz Modal */}
      <Modal open={!!quizModal} onClose={()=>setQuizModal(null)} title={quizModal?.subtopicOnly?'⚡ Add Subtopic Quiz':quizModal?.quiz?'✏️ Edit Quiz':'📝 Add Quiz to Module'}
        footer={<><button className="btn btn-ghost" onClick={()=>setQuizModal(null)}>Cancel</button><button className="btn btn-primary" onClick={saveQuiz} disabled={savingQuiz}>{savingQuiz?'Saving...':quizModal?.quiz?'Save Changes':'Create Quiz'}</button></>}>
        <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#1D4ED8'}}>
          📌 This quiz will appear inside <strong>Session {quizModal?.module?.module_number}: {quizModal?.module?.title}</strong>
        </div>
        <FormGroup label="Quiz Type">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {(quizModal?.subtopicOnly ? QUIZ_TYPES.filter(t=>t.value==='checkpoint'||t.value==='short_quiz') : QUIZ_TYPES).map(t=>(
              <button key={t.value} type="button" onClick={()=>setQuizForm(f=>({...f,quiz_type:t.value}))}
                style={{padding:'10px 12px',borderRadius:10,cursor:'pointer',border:`2px solid ${quizForm.quiz_type===t.value?t.color:tokens.border}`,background:quizForm.quiz_type===t.value?t.bg:'#FAFAFA',textAlign:'left',transition:'all 0.15s'}}>
                <div style={{fontWeight:700,fontSize:13,color:quizForm.quiz_type===t.value?t.color:tokens.dark}}>{t.label}</div>
              </button>
            ))}
          </div>
        </FormGroup>
        <FormGroup label="Quiz Title"><input className="input" placeholder="e.g. [FA1] First Formative Assessment" value={quizForm.title} onChange={e=>setQuizForm(f=>({...f,title:e.target.value}))}/></FormGroup>
        <FormGroup label="Instructions (Optional)"><textarea className="textarea" placeholder="Instructions for the student..." value={quizForm.instructions} onChange={e=>setQuizForm(f=>({...f,instructions:e.target.value}))} style={{minHeight:80}}/></FormGroup>
        <div className="grid-2">
          <FormGroup label="Pass Score (%)"><input className="input" type="number" min="50" max="100" value={quizForm.pass_score} onChange={e=>setQuizForm(f=>({...f,pass_score:Number(e.target.value)}))}/></FormGroup>
          <FormGroup label="Max Attempts"><input className="input" type="number" min="1" max="20" value={quizForm.max_attempts} onChange={e=>setQuizForm(f=>({...f,max_attempts:Number(e.target.value)}))}/></FormGroup>
        </div>
        <FormGroup label="Time Limit (minutes)" hint="0 = no limit"><input className="input" type="number" min="0" value={quizForm.time_limit} onChange={e=>setQuizForm(f=>({...f,time_limit:Number(e.target.value)}))}/></FormGroup>
      </Modal>

      {/* ── Copy Modules Modal ── */}
      <Modal open={copyModal} onClose={()=>setCopyModal(false)} title="📋 Copy Modules from Another Booking"
        footer={<button className="btn btn-ghost" onClick={()=>setCopyModal(false)}>Close</button>}>
        <div>
          <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#1D4ED8'}}>
            ℹ️ Select a booking to copy all its modules, subtopics, materials, quizzes and questions into the current booking. Copied items will be set to <strong>Draft</strong> — review and publish when ready.
          </div>
          {pastBookings.length===0 ? (
            <div style={{textAlign:'center',padding:'24px 0',color:tokens.muted,fontSize:13}}>
              No other bookings found. Complete at least one other booking with modules to reuse them.
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {pastBookings.map(b=>(
                <div key={b.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:12,border:`1.5px solid ${copyingFrom===b.id?tokens.primary:tokens.border}`,background:copyingFrom===b.id?tokens.primaryLight:'#FAFAFA',transition:'all 0.15s'}}>
                  <div style={{flex:1}}>
                    <div className="font-semibold" style={{fontSize:14}}>{b.student?.name} — <span style={{textTransform:'capitalize'}}>{b.subject}</span></div>
                    <div style={{fontSize:11,color:tokens.muted,marginTop:3}}>Parent: {b.parent?.full_name} · Grade {b.student?.grade_level} · <span style={{textTransform:'capitalize'}}>{b.status}</span></div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={copying}
                    onClick={()=>{ setCopyingFrom(b.id); copyModulesFrom(b.id); }}>
                    {copying&&copyingFrom===b.id ? 'Copying...' : '📋 Copy'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function MatRow({mat,onEdit,onDelete}) {
  const [open,setOpen]=useState(false);
  const isPdf = mat.file_type==='application/pdf'||mat.file_name?.endsWith('.pdf');
  const isPpt = mat.file_name?.endsWith('.ppt')||mat.file_name?.endsWith('.pptx');
  return (
    <div style={{marginBottom:6}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,background:'#FAFAFA',border:`1px solid ${tokens.border}`,cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        <Icon name="clipboard" size={13} color={tokens.muted}/>
        <MatTypeBadge type={mat.material_type}/>
        <span style={{fontSize:13,flex:1}}>{mat.title}</span>
        {mat.file_url&&<span style={{fontSize:10,fontWeight:700,color:'#065F46',background:'#D1FAE5',padding:'2px 6px',borderRadius:4}}>{isPdf?'PDF':isPpt?'PPT':'FILE'}</span>}
        <button onClick={e=>{e.stopPropagation();onEdit();}} style={{background:'none',border:'none',cursor:'pointer',color:tokens.muted,fontSize:12,padding:'0 4px'}}>✏️</button>
        <button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',fontSize:12,padding:'0 4px'}}>✕</button>
      </div>
      {open&&(
        <div style={{margin:'4px 0 4px 0',padding:'12px 14px',background:'#fff',borderRadius:8,border:`1px solid ${tokens.border}`}}>
          {mat.content&&<div style={{fontSize:13,color:tokens.mid,lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-word',marginBottom:mat.file_url||mat.url?12:0}}>{mat.content}</div>}
          {mat.file_url&&isPdf&&(
            <div style={{borderRadius:8,overflow:'hidden',border:`1px solid ${tokens.border}`,marginBottom:mat.url?12:0}}>
              <iframe src={mat.file_url} width="100%" height="500px" style={{border:'none',display:'block'}} title={mat.title}/>
            </div>
          )}
          {mat.file_url&&isPpt&&(
            <div style={{borderRadius:8,overflow:'hidden',border:`1px solid ${tokens.border}`,marginBottom:mat.url?12:0}}>
              <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(mat.file_url)}`} width="100%" height="500px" style={{border:'none',display:'block'}} title={mat.title}/>
            </div>
          )}
          {mat.file_url&&!isPdf&&!isPpt&&(
            <a href={mat.file_url} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,color:tokens.primary,fontSize:13,fontWeight:600}}>📎 {mat.file_name||'Download File'}</a>
          )}
          {mat.url&&<a href={mat.url} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,color:tokens.primary,fontSize:12,fontWeight:600}}>🔗 Open Link</a>}
        </div>
      )}
    </div>
  );
}