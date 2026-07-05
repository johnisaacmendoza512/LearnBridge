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
  const bg = type==='error'?'#FEE2E2':'#D1FAE5', color = type==='error'?'#DC2626':'#065F46';
  return (
    <div style={{ position:'fixed',top:24,right:24,zIndex:99999,background:bg,borderRadius:12,padding:'14px 20px',fontSize:14,color,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,.12)',display:'flex',alignItems:'center',gap:10,maxWidth:380 }}>
      <span>{type==='error'?'❌':'✅'}</span><span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color,fontSize:16,padding:0 }}>✕</button>
    </div>
  );
}

function TypeBadge({ type }) {
  const t = MATERIAL_TYPES.find(x => x.value === type) || MATERIAL_TYPES[3];
  return <span style={{ fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:6,background:t.bg,color:t.color,letterSpacing:'0.5px' }}>{t.label}</span>;
}

export default function TutorModulesPage() {
  const { user } = useAuth();
  const { bookings, loading: bLoading } = useBookings();
  const confirmed = bookings.filter(b => ['confirmed','pending_parent_confirm','completed'].includes(b.status));

  const [selBooking,    setSelBooking]    = useState(null);
  const [modules,       setModules]       = useState([]);
  const [expanded,      setExpanded]      = useState({});
  const [loading,       setLoading]       = useState(false);
  const [toast,         setToast]         = useState(null);

  // Module modal
  const [modModal,      setModModal]      = useState(null); // 'create' | module
  const [modForm,       setModForm]       = useState({ title:'', description:'' });
  const [savingMod,     setSavingMod]     = useState(false);

  // Subtopic modal
  const [subModal,      setSubModal]      = useState(null); // { module, subtopic? }
  const [subForm,       setSubForm]       = useState({ title:'' });
  const [savingSub,     setSavingSub]     = useState(false);

  // Material modal
  const [matModal,      setMatModal]      = useState(null); // { module, subtopic?, material? }
  const [matForm,       setMatForm]       = useState({ title:'', material_type:'note', content:'', url:'' });
  const [savingMat,     setSavingMat]     = useState(false);

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const fetchModules = useCallback(async (bookingId) => {
    setLoading(true);
    const { data: mods } = await supabase.from('session_modules').select('*').eq('booking_id', bookingId).order('module_number');
    if (!mods) { setModules([]); setLoading(false); return; }

    const { data: subs } = await supabase.from('module_subtopics').select('*').in('module_id', mods.map(m => m.id)).order('subtopic_number');
    const { data: mats } = await supabase.from('module_materials').select('*').in('module_id', mods.map(m => m.id)).order('order_num');

    const built = mods.map(mod => ({
      ...mod,
      subtopics: (subs || []).filter(s => s.module_id === mod.id).map(sub => ({
        ...sub,
        materials: (mats || []).filter(mat => mat.subtopic_id === sub.id),
      })),
      moduleMaterials: (mats || []).filter(mat => mat.module_id === mod.id && !mat.subtopic_id),
    }));
    setModules(built);
    setLoading(false);
  }, []);

  useEffect(() => { if (selBooking) fetchModules(selBooking.id); }, [selBooking, fetchModules]);

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // ── Module CRUD ─────────────────────────────────────────────────────────
  const saveModule = async () => {
    if (!modForm.title.trim()) { showToast('Module title is required.', 'error'); return; }
    setSavingMod(true);
    try {
      if (modModal === 'create') {
        await supabase.from('session_modules').insert({ booking_id:selBooking.id, tutor_id:user.id, module_number:modules.length+1, title:modForm.title, description:modForm.description, status:'draft' });
        showToast('Module created!');
      } else {
        await supabase.from('session_modules').update({ title:modForm.title, description:modForm.description }).eq('id', modModal.id);
        showToast('Module updated!');
      }
      setModModal(null); fetchModules(selBooking.id);
    } catch(e) { showToast(e.message,'error'); } finally { setSavingMod(false); }
  };

  const deleteModule = async (mod) => {
    if (!window.confirm(`Delete Module ${mod.module_number}: "${mod.title}"? All subtopics and materials will be deleted.`)) return;
    await supabase.from('session_modules').delete().eq('id', mod.id);
    showToast('Module deleted.'); fetchModules(selBooking.id);
  };

  const togglePublish = async (mod) => {
    const ns = mod.status === 'published' ? 'draft' : 'published';
    await supabase.from('session_modules').update({ status:ns }).eq('id', mod.id);
    showToast(ns === 'published' ? 'Module published! Students can now see it.' : 'Module set to draft.');
    fetchModules(selBooking.id);
  };

  // ── Subtopic CRUD ───────────────────────────────────────────────────────
  const saveSubtopic = async () => {
    if (!subForm.title.trim()) { showToast('Subtopic title is required.', 'error'); return; }
    setSavingSub(true);
    try {
      const mod = subModal.module;
      if (!subModal.subtopic) {
        const nextNum = (mod.subtopics?.length || 0) + 1;
        await supabase.from('module_subtopics').insert({ module_id:mod.id, subtopic_number:nextNum, title:subForm.title });
        showToast('Subtopic added!');
      } else {
        await supabase.from('module_subtopics').update({ title:subForm.title }).eq('id', subModal.subtopic.id);
        showToast('Subtopic updated!');
      }
      setSubModal(null); fetchModules(selBooking.id);
    } catch(e) { showToast(e.message,'error'); } finally { setSavingSub(false); }
  };

  const deleteSubtopic = async (sub) => {
    if (!window.confirm(`Delete subtopic "${sub.title}"?`)) return;
    await supabase.from('module_subtopics').delete().eq('id', sub.id);
    showToast('Subtopic deleted.'); fetchModules(selBooking.id);
  };

  // ── Material CRUD ───────────────────────────────────────────────────────
  const saveMaterial = async () => {
    if (!matForm.title.trim()) { showToast('Material title is required.', 'error'); return; }
    setSavingMat(true);
    try {
      const payload = {
        module_id:     matModal.module.id,
        subtopic_id:   matModal.subtopic?.id || null,
        material_type: matForm.material_type,
        title:         matForm.title,
        content:       matForm.content || null,
        url:           matForm.url     || null,
      };
      if (!matModal.material) {
        const orderNum = matModal.subtopic
          ? (matModal.subtopic.materials?.length || 0)
          : (matModal.module.moduleMaterials?.length || 0);
        await supabase.from('module_materials').insert({ ...payload, order_num:orderNum });
        showToast('Material added!');
      } else {
        await supabase.from('module_materials').update(payload).eq('id', matModal.material.id);
        showToast('Material updated!');
      }
      setMatModal(null); fetchModules(selBooking.id);
    } catch(e) { showToast(e.message,'error'); } finally { setSavingMat(false); }
  };

  const deleteMaterial = async (mat) => {
    if (!window.confirm(`Remove "${mat.title}"?`)) return;
    await supabase.from('module_materials').delete().eq('id', mat.id);
    showToast('Material removed.'); fetchModules(selBooking.id);
  };

  if (bLoading) return <Spinner dark size={32} />;

  // ── Booking selector ────────────────────────────────────────────────────
  if (!selBooking) return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize:22 }}>📚 Modules</h2>
        <p className="text-sm text-muted mt-4">Select a booking to build learning modules for your student.</p>
      </div>
      {confirmed.length === 0
        ? <div className="card"><EmptyState icon="📚" title="No active bookings" description="Accept a booking request to start building modules." /></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {confirmed.map(b => (
              <div key={b.id} className="card p-20" style={{ cursor:'pointer', border:`1.5px solid ${tokens.border}`, transition:'all 0.15s' }}
                onClick={() => setSelBooking(b)}
                onMouseEnter={e => e.currentTarget.style.borderColor = tokens.primary}
                onMouseLeave={e => e.currentTarget.style.borderColor = tokens.border}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-jakarta font-bold" style={{ fontSize:15 }}>{b.student?.name} — <span style={{ textTransform:'capitalize' }}>{b.subject}</span></div>
                    <div className="text-xs text-muted mt-4">Parent: {b.parent?.full_name} · Grade {b.student?.grade_level}</div>
                  </div>
                  <div className="flex gap-8 items-center">
                    <Badge variant="success">{b.status}</Badge>
                    <Icon name="arrowRight" size={16} color={tokens.primary} />
                  </div>
                </div>
              </div>
            ))}
          </div>}
    </div>
  );

  // ── Main modules view ───────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="flex items-center gap-12 mb-20">
        <button className="btn btn-ghost btn-sm" onClick={() => setSelBooking(null)}>← Back</button>
        <div style={{ flex:1 }}>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize:20 }}>📚 {selBooking.student?.name} — {selBooking.subject}</h2>
          <p className="text-xs text-muted mt-2">Tutor: {user?.email} · Grade {selBooking.student?.grade_level}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setModForm({ title:'', description:'' }); setModModal('create'); }}>
          <Icon name="plus" size={14} /> Add Module
        </button>
      </div>

      {loading ? <Spinner dark size={28} /> : modules.length === 0
        ? <div className="card p-40 text-center">
            <div style={{ fontSize:48, marginBottom:16 }}>📖</div>
            <div className="font-jakarta font-bold mb-8" style={{ fontSize:18 }}>No modules yet</div>
            <p className="text-sm text-muted mb-20">Create your first module to start building the learning canvas.</p>
            <button className="btn btn-primary" onClick={() => { setModForm({ title:'', description:'' }); setModModal('create'); }}>
              <Icon name="plus" size={14} /> Create First Module
            </button>
          </div>
        : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {modules.map((mod, mi) => (
              <div key={mod.id} style={{ border:`1.5px solid ${mod.status==='published'?tokens.primary:tokens.border}`, borderRadius:14, overflow:'hidden', background:'#fff' }}>
                {/* Module header row */}
                <div style={{ padding:'14px 18px', background:mod.status==='published'?tokens.primaryLight:'#F9FAFB', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}
                  onClick={() => toggle(mod.id)}>
                  <Icon name={expanded[mod.id]?'chevronDown':'chevronRight'} size={16} color={tokens.muted} />
                  <div style={{ flex:1 }}>
                    <div className="font-jakarta font-bold" style={{ fontSize:15 }}>
                      Module {mod.module_number}: {mod.title}
                    </div>
                    {mod.description && <div className="text-xs text-muted mt-2">{mod.description}</div>}
                  </div>
                  <div className="flex gap-6" onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:700, background:mod.status==='published'?'#D1FAE5':'#FEF9C3', color:mod.status==='published'?'#065F46':'#92400E' }}>
                      {mod.status==='published'?'✓ Published':'Draft'}
                    </span>
                    <button className="btn btn-sm" style={{ background:'#F0FDF4', color:'#065F46', border:'1px solid #6EE7B7' }} onClick={() => togglePublish(mod)}>
                      {mod.status==='published'?'Unpublish':'Publish'}
                    </button>
                    <button className="btn btn-sm" style={{ background:tokens.primaryLight, color:tokens.primary }} onClick={() => { setModForm({ title:mod.title, description:mod.description||'' }); setModModal(mod); }}>
                      <Icon name="edit" size={11} /> Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteModule(mod)}>
                      <Icon name="x" size={11} />
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {expanded[mod.id] && (
                  <div style={{ padding:'16px 18px', borderTop:`1px solid ${tokens.border}` }}>

                    {/* Module-level materials */}
                    {mod.moduleMaterials?.length > 0 && (
                      <div style={{ marginBottom:16 }}>
                        {mod.moduleMaterials.map(mat => (
                          <MaterialRow key={mat.id} mat={mat}
                            onEdit={() => { setMatForm({ title:mat.title, material_type:mat.material_type, content:mat.content||'', url:mat.url||'' }); setMatModal({ module:mod, subtopic:null, material:mat }); }}
                            onDelete={() => deleteMaterial(mat)} />
                        ))}
                      </div>
                    )}

                    {/* Subtopics */}
                    {mod.subtopics?.map((sub, si) => (
                      <div key={sub.id} style={{ marginBottom:16, paddingLeft:16, borderLeft:`3px solid ${tokens.primary}20` }}>
                        <div className="flex items-center gap-10 mb-10">
                          <div className="font-jakarta font-bold" style={{ fontSize:14, color:tokens.primary }}>
                            Subtopic {sub.subtopic_number}: {sub.title}
                          </div>
                          <button className="btn btn-sm" style={{ fontSize:11, padding:'3px 8px', background:tokens.primaryLight, color:tokens.primary }}
                            onClick={() => { setSubForm({ title:sub.title }); setSubModal({ module:mod, subtopic:sub }); }}>
                            <Icon name="edit" size={10} />
                          </button>
                          <button className="btn btn-sm btn-danger" style={{ fontSize:11, padding:'3px 8px' }} onClick={() => deleteSubtopic(sub)}>
                            <Icon name="x" size={10} />
                          </button>
                          <button className="btn btn-sm" style={{ fontSize:11, padding:'3px 10px', background:'#F0FDF4', color:'#065F46', border:'1px solid #6EE7B7', marginLeft:'auto' }}
                            onClick={() => { setMatForm({ title:'', material_type:'note', content:'', url:'' }); setMatModal({ module:mod, subtopic:sub, material:null }); }}>
                            + Add Material
                          </button>
                        </div>
                        {sub.materials?.map(mat => (
                          <MaterialRow key={mat.id} mat={mat} indent
                            onEdit={() => { setMatForm({ title:mat.title, material_type:mat.material_type, content:mat.content||'', url:mat.url||'' }); setMatModal({ module:mod, subtopic:sub, material:mat }); }}
                            onDelete={() => deleteMaterial(mat)} />
                        ))}
                        {sub.materials?.length === 0 && (
                          <div style={{ fontSize:12, color:tokens.muted, padding:'8px 0', fontStyle:'italic' }}>No materials yet — add one above</div>
                        )}
                      </div>
                    ))}

                    {/* Add buttons */}
                    <div className="flex gap-8 mt-12">
                      <button className="btn btn-sm" style={{ background:'#EFF6FF', color:tokens.primary, border:`1px solid ${tokens.primary}30` }}
                        onClick={() => { setSubForm({ title:'' }); setSubModal({ module:mod, subtopic:null }); }}>
                        + Add Subtopic
                      </button>
                      <button className="btn btn-sm" style={{ background:'#F9FAFB', color:tokens.mid, border:`1px solid ${tokens.border}` }}
                        onClick={() => { setMatForm({ title:'', material_type:'note', content:'', url:'' }); setMatModal({ module:mod, subtopic:null, material:null }); }}>
                        + Add Module Material
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
      }

      {/* ── Create/Edit Module Modal ── */}
      <Modal open={!!modModal} onClose={() => setModModal(null)}
        title={modModal==='create'?'📖 Create Module':'✏️ Edit Module'}
        footer={<><button className="btn btn-ghost" onClick={() => setModModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveModule} disabled={savingMod}>{savingMod?'Saving...':modModal==='create'?'Create Module':'Save Changes'}</button></>}>
        <FormGroup label="Module Title">
          <input className="input" placeholder="e.g. Introduction to Fractions" value={modForm.title} onChange={e => setModForm(f => ({ ...f, title:e.target.value }))} />
        </FormGroup>
        <FormGroup label="Description (Optional)">
          <textarea className="textarea" placeholder="Brief description of what this module covers..." value={modForm.description} onChange={e => setModForm(f => ({ ...f, description:e.target.value }))} style={{ minHeight:80 }} />
        </FormGroup>
      </Modal>

      {/* ── Create/Edit Subtopic Modal ── */}
      <Modal open={!!subModal} onClose={() => setSubModal(null)}
        title={subModal?.subtopic?'✏️ Edit Subtopic':'➕ Add Subtopic'}
        footer={<><button className="btn btn-ghost" onClick={() => setSubModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveSubtopic} disabled={savingSub}>{savingSub?'Saving...':subModal?.subtopic?'Save Changes':'Add Subtopic'}</button></>}>
        <FormGroup label="Subtopic Title">
          <input className="input" placeholder={`e.g. M${subModal?.module?.module_number}S1 - Topic Name`} value={subForm.title} onChange={e => setSubForm({ title:e.target.value })} />
        </FormGroup>
      </Modal>

      {/* ── Add/Edit Material Modal ── */}
      <Modal open={!!matModal} onClose={() => setMatModal(null)}
        title={matModal?.material?'✏️ Edit Material':'➕ Add Material'}
        footer={<><button className="btn btn-ghost" onClick={() => setMatModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveMaterial} disabled={savingMat}>{savingMat?'Saving...':matModal?.material?'Save Changes':'Add Material'}</button></>}>
        <FormGroup label="Material Type">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
            {MATERIAL_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setMatForm(f => ({ ...f, material_type:t.value }))}
                style={{ padding:'6px 8px', borderRadius:8, cursor:'pointer', border:`2px solid ${matForm.material_type===t.value?t.color:tokens.border}`, background:matForm.material_type===t.value?t.bg:'#FAFAFA', transition:'all 0.15s' }}>
                <div style={{ fontSize:10, fontWeight:800, color:t.color }}>{t.label}</div>
              </button>
            ))}
          </div>
        </FormGroup>
        <FormGroup label="Title">
          <input className="input" placeholder={`[${matForm.material_type?.toUpperCase()}] Title here...`} value={matForm.title} onChange={e => setMatForm(f => ({ ...f, title:e.target.value }))} />
        </FormGroup>
        <FormGroup label="Content / Notes" hint="Write the lesson text, notes, or summary here.">
          <textarea className="textarea" placeholder="Enter lesson content, notes, explanations..." value={matForm.content} onChange={e => setMatForm(f => ({ ...f, content:e.target.value }))} style={{ minHeight:150 }} />
        </FormGroup>
        <FormGroup label="External Link (Optional)" hint="YouTube video, PDF link, etc.">
          <input className="input" placeholder="https://..." value={matForm.url} onChange={e => setMatForm(f => ({ ...f, url:e.target.value }))} />
        </FormGroup>
      </Modal>
    </div>
  );
}

function MaterialRow({ mat, indent, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom:6, marginLeft:indent?0:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background:'#FAFAFA', border:`1px solid ${tokens.border}`, cursor:'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <Icon name="clipboard" size={13} color={tokens.muted} />
        <TypeBadge type={mat.material_type} />
        <span style={{ fontSize:13, flex:1 }}>{mat.title}</span>
        <span style={{ fontSize:11, color:tokens.muted }}>Viewed</span>
        <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ background:'none', border:'none', cursor:'pointer', color:tokens.muted, fontSize:12, padding:'0 4px' }}>✏️</button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#DC2626', fontSize:12, padding:'0 4px' }}>✕</button>
      </div>
      {open && (mat.content || mat.url) && (
        <div style={{ margin:'4px 0 4px 16px', padding:'10px 14px', background:'#fff', borderRadius:8, border:`1px solid ${tokens.border}`, fontSize:13, color:tokens.mid, lineHeight:1.7 }}>
          {mat.content && <div style={{ whiteSpace:'pre-wrap', marginBottom:mat.url?10:0 }}>{mat.content}</div>}
          {mat.url && <a href={mat.url} target="_blank" rel="noreferrer" style={{ color:tokens.primary, fontSize:12, fontWeight:600 }}>🔗 {mat.url}</a>}
        </div>
      )}
    </div>
  );
}
