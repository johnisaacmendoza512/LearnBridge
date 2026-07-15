import { useState } from 'react';
import { useAdminData } from '../../hooks/useAdminData';
import { supabase } from '../../lib/supabase';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'danger' };

export default function TutorVerificationPage() {
  const {
    tutors, pendingParents, loading, error,
    approveTutor, rejectTutor, approveParent, rejectParent, refresh
  } = useAdminData();

  // Main tab — tutor or parent
  const [mainTab,    setMainTab]    = useState('tutor');

  // Tutor state
  const [tutorFilter, setTutorFilter] = useState('pending');
  const [selected,    setSelected]    = useState(null);
  const [rate,        setRate]        = useState('');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [docUrls,     setDocUrls]     = useState({});
  const [docLoading,  setDocLoading]  = useState({});

  // Parent state
  const [selectedParent,  setSelectedParent]  = useState(null);
  const [savingParent,    setSavingParent]     = useState(false);

  // ── Tutor helpers ─────────────────────────────────────────────────────
  const tutorCounts = { all: tutors.length, pending: 0, approved: 0, rejected: 0 };
  tutors.forEach(t => { if (tutorCounts[t.status] !== undefined) tutorCounts[t.status]++; });
  const filteredTutors = tutorFilter === 'all' ? tutors : tutors.filter(t => t.status === tutorFilter);

  const openReview = (t) => {
    setSelected(t);
    setRate(t.approved_rate || t.rate_per_session || '');
    setNotes(t.admin_notes || '');
    setDocUrls({});
    setDocLoading({});
  };

  const handleViewDoc = async (docKey, storagePath, bucket = 'tutor-documents') => {
    if (!storagePath) { alert('No document was submitted for this field.'); return; }
    if (docUrls[docKey]) { window.open(docUrls[docKey], '_blank'); return; }
    setDocLoading(prev => ({ ...prev, [docKey]: true }));
    try {
      let path = storagePath.includes(`${bucket}/`) ? storagePath.split(`${bucket}/`)[1] : storagePath;
      const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (signErr || !data?.signedUrl) { window.open(storagePath, '_blank'); return; }
      setDocUrls(prev => ({ ...prev, [docKey]: data.signedUrl }));
      window.open(data.signedUrl, '_blank');
    } catch { window.open(storagePath, '_blank'); }
    finally { setDocLoading(prev => ({ ...prev, [docKey]: false })); }
  };

  const handleApprove = async () => {
    if (!rate) { alert('Please set an approved session rate before approving.'); return; }
    setSaving(true);
    try { await approveTutor(selected.id, rate, notes); setSelected(null); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleReject = async () => {
    setSaving(true);
    try { await rejectTutor(selected.id, notes); setSelected(null); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  // ── Parent helpers ────────────────────────────────────────────────────
  const handleApproveParent = async () => {
    setSavingParent(true);
    try { await approveParent(selectedParent.id); setSelectedParent(null); }
    catch (e) { alert(e.message); }
    finally { setSavingParent(false); }
  };

  const handleRejectParent = async () => {
    if (!window.confirm(`Reject ${selectedParent.full_name}'s account? They will not be able to log in.`)) return;
    setSavingParent(true);
    try { await rejectParent(selectedParent.id); setSelectedParent(null); }
    catch (e) { alert(e.message); }
    finally { setSavingParent(false); }
  };

  if (loading) return <Spinner dark size={32} />;
  if (error) return (
    <div className="card p-24 text-center">
      <p className="text-sm mb-12" style={{ color: tokens.danger }}>Error: {error}</p>
      <button className="btn btn-primary btn-sm" onClick={refresh}>Retry</button>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="mb-24">
        <div className="flex items-center justify-between">
          <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Verification</h2>
          <button className="btn btn-ghost btn-sm" onClick={refresh}>
            🔄 Refresh
          </button>
        </div>
        <p className="text-sm text-muted mt-4">Review and approve tutor and parent account applications.</p>
      </div>

      {/* Main tab switcher */}
      <div className="flex gap-8 mb-20">
        <button onClick={() => setMainTab('tutor')} className="btn" style={{ background: mainTab === 'tutor' ? tokens.primary : '#fff', color: mainTab === 'tutor' ? '#fff' : tokens.mid, border: `1.5px solid ${mainTab === 'tutor' ? tokens.primary : tokens.border}`, fontWeight: 700, fontSize: 14, padding: '10px 24px' }}>
          🏫 Tutor Applications
          {tutorCounts.pending > 0 && (
            <span style={{ marginLeft: 8, background: '#DC2626', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>{tutorCounts.pending}</span>
          )}
        </button>
        <button onClick={() => setMainTab('parent')} className="btn" style={{ background: mainTab === 'parent' ? tokens.primary : '#fff', color: mainTab === 'parent' ? '#fff' : tokens.mid, border: `1.5px solid ${mainTab === 'parent' ? tokens.primary : tokens.border}`, fontWeight: 700, fontSize: 14, padding: '10px 24px' }}>
          👨‍👩‍👧 Parent Accounts
          {pendingParents.length > 0 && (
            <span style={{ marginLeft: 8, background: '#DC2626', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>{pendingParents.length}</span>
          )}
        </button>
      </div>

      {/* ── TUTOR TAB ── */}
      {mainTab === 'tutor' && (
        <>
          <div className="flex gap-8 mb-20">
            {['all', 'pending', 'approved', 'rejected'].map(f => (
              <button key={f} onClick={() => setTutorFilter(f)} className="btn btn-sm" style={{ background: tutorFilter === f ? tokens.primary : '#fff', color: tutorFilter === f ? '#fff' : tokens.mid, border: `1px solid ${tutorFilter === f ? tokens.primary : tokens.border}`, textTransform: 'capitalize' }}>
                {f} ({tutorCounts[f]})
              </button>
            ))}
          </div>

          {filteredTutors.length === 0 ? (
            <div className="card">
              <EmptyState icon="🔍" title={`No ${tutorFilter === 'all' ? '' : tutorFilter} tutors`} description="Tutor applications will appear here once tutors register." />
            </div>
          ) : (
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tutor</th>
                    <th>Email</th>
                    <th>Specialization</th>
                    <th>Documents</th>
                    <th>Proposed Rate</th>
                    <th>Applied</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTutors.map((t, i) => (
                    <tr key={t.id}>
                      <td>
                        <div className="flex items-center gap-10">
                          <Avatar name={t.profile?.full_name || 'T'} size={32} colorIndex={i} />
                          <span className="font-semibold" style={{ fontSize: 13 }}>{t.profile?.full_name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: tokens.muted }}>{t.profile?.email || '—'}</td>
                      <td>
                        {(t.specialization || []).map(s => (
                          <Badge key={s} variant="info" style={{ marginRight: 4, textTransform: 'capitalize', fontSize: 10 }}>{s}</Badge>
                        ))}
                      </td>
                      <td>
                        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
                          <Badge variant={t.nbi_clearance_url    ? 'success' : 'danger'} style={{ fontSize: 10 }}>NBI {t.nbi_clearance_url    ? '✓' : '✗'}</Badge>
                          <Badge variant={t.prc_license_url      ? 'success' : 'danger'} style={{ fontSize: 10 }}>PRC {t.prc_license_url      ? '✓' : '✗'}</Badge>
                          <Badge variant={t.medical_cert_url     ? 'success' : 'danger'} style={{ fontSize: 10 }}>Med {t.medical_cert_url     ? '✓' : '✗'}</Badge>
                          <Badge variant={t.application_form_url ? 'success' : 'danger'} style={{ fontSize: 10 }}>App {t.application_form_url ? '✓' : '✗'}</Badge>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{t.rate_per_session ? `₱${t.rate_per_session}` : '—'}</td>
                      <td style={{ fontSize: 12, color: tokens.muted }}>{formatDate(t.created_at)}</td>
                      <td><Badge variant={STATUS_VARIANT[t.status] || 'gray'}>{t.status}</Badge></td>
                      <td>
                        <button className="btn btn-sm" style={{ background: '#D1FAE5', color: '#065F46' }} onClick={() => openReview(t)}>
                          <Icon name="eye" size={11} color="#065F46" /> {t.status === 'pending' ? ' Review' : ' View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── PARENT TAB ── */}
      {mainTab === 'parent' && (
        <>
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#1D4ED8', display: 'flex', gap: 10 }}>
            <span>ℹ️</span>
            <span>Parents must submit 2 valid government-issued IDs during registration. Review their IDs and approve or reject their account below. Approved parents will appear in the Users section.</span>
          </div>

          {pendingParents.length === 0 ? (
            <div className="card">
              <EmptyState icon="✅" title="No pending parent accounts" description="All parent accounts have been reviewed. New registrations will appear here." />
            </div>
          ) : (
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Parent</th>
                    <th>Email</th>
                    <th>Valid IDs</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingParents.map((p, i) => (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-10">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={p.full_name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <Avatar name={p.full_name || 'P'} size={32} colorIndex={i} />
                          )}
                          <span className="font-semibold" style={{ fontSize: 13 }}>{p.full_name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: tokens.muted }}>{p.email || '—'}</td>
                      <td>
                        <div className="flex gap-4">
                          <Badge variant={p.valid_id_1 ? 'success' : 'danger'} style={{ fontSize: 10 }}>ID 1 {p.valid_id_1 ? '✓' : '✗'}</Badge>
                          <Badge variant={p.valid_id_2 ? 'success' : 'danger'} style={{ fontSize: 10 }}>ID 2 {p.valid_id_2 ? '✓' : '✗'}</Badge>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: tokens.muted }}>{formatDate(p.created_at)}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#FEF9C3', color: '#92400E' }}>⏳ Pending</span>
                      </td>
                      <td>
                        <button className="btn btn-sm" style={{ background: '#EFF6FF', color: tokens.primary, border: `1px solid ${tokens.primary}40` }} onClick={() => setSelectedParent(p)}>
                          <Icon name="eye" size={11} color={tokens.primary} /> Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TUTOR REVIEW MODAL ── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`${selected?.status === 'pending' ? 'Review Application' : 'Tutor Details'}: ${selected?.profile?.full_name || '—'}`}
        footer={
          selected?.status === 'pending' ? (
            <>
              <button className="btn btn-danger" onClick={handleReject} disabled={saving}>
                <Icon name="x" size={13} /> {saving ? '...' : 'Reject'}
              </button>
              <button className="btn btn-primary" onClick={handleApprove} disabled={saving}>
                <Icon name="check" size={13} /> {saving ? '...' : 'Approve & Set Rate'}
              </button>
            </>
          ) : (
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
          )
        }
      >
        {selected && (
          <div>
            <div className="grid-2 mb-20">
              {[
                ['Full Name',      selected.profile?.full_name || '—'],
                ['Email',          selected.profile?.email     || '—'],
                ['Gender',         selected.profile?.gender    || '—'],
                ['Location',       selected.profile?.location  || '—'],
                ['Experience',     selected.years_experience != null ? `${selected.years_experience} year(s)` : '—'],
                ['Specialization', (selected.specialization || []).join(', ') || '—'],
                ['Proposed Rate',  selected.rate_per_session ? `₱${selected.rate_per_session}/session` : '—'],
                ['Applied On',     formatDate(selected.created_at)],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                  <div className="text-xs text-muted mb-4 uppercase font-bold" style={{ letterSpacing: '0.5px' }}>{k}</div>
                  <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>

            {selected.profile?.bio && (
              <div className="mb-20">
                <div className="text-xs text-muted uppercase font-bold mb-6" style={{ letterSpacing: '0.5px' }}>Bio</div>
                <p style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.6 }}>{selected.profile.bio}</p>
              </div>
            )}

            <div className="mb-20">
              <div className="text-xs text-muted uppercase font-bold mb-12" style={{ letterSpacing: '0.5px' }}>Submitted Documents (PDF)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { key: 'nbi',     label: 'NBI Clearance',      path: selected.nbi_clearance_url    },
                  { key: 'prc',     label: 'PRC License',         path: selected.prc_license_url      },
                  { key: 'medical', label: 'Medical Certificate', path: selected.medical_cert_url     },
                  { key: 'app',     label: 'Application Form',    path: selected.application_form_url },
                ].map(({ key, label, path }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, border: `1px solid ${path ? tokens.border : '#FEE2E2'}`, background: path ? '#FAFAFA' : '#FFF5F5' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: path ? '#D1FAE5' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={path ? 'check' : 'x'} size={14} color={path ? '#065F46' : '#991B1B'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold" style={{ fontSize: 13 }}>{label}</div>
                      <div className="text-xs text-muted">{path ? `📄 ${path.split('/').pop()}` : 'No file submitted'}</div>
                    </div>
                    {path ? (
                      <button className="btn btn-primary btn-sm" onClick={() => handleViewDoc(key, path)} disabled={docLoading[key]} style={{ flexShrink: 0 }}>
                        {docLoading[key] ? <Spinner size={12} /> : <><Icon name="eye" size={12} /> View PDF</>}
                      </button>
                    ) : <Badge variant="danger">Missing</Badge>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted mt-8">PDFs open in a new tab. Links expire after 1 hour for security.</p>
            </div>

            {selected.certification_scores && Object.keys(selected.certification_scores).length > 0 && (
              <div className="mb-20">
                <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>Certification Scores</div>
                <div className="flex gap-6" style={{ flexWrap: 'wrap' }}>
                  {Object.entries(selected.certification_scores).map(([topic, score]) => (
                    <div key={topic} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: score >= 75 ? '#D1FAE5' : '#FEF3C7', color: score >= 75 ? '#065F46' : '#92400E' }}>
                      {topic}: {score}%
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.status === 'pending' && (
              <>
                <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
                  ⚠️ Review all documents carefully before approving. The tutor has already completed the AI Certification Assessment during registration.
                </div>
                <FormGroup label="Approved Session Rate (₱)" hint="Based on credentials, experience, and qualifications. This is the rate shown to parents.">
                  <input className="input" type="number" min="0" placeholder="e.g. 350" value={rate} onChange={e => setRate(e.target.value)} />
                </FormGroup>
                <FormGroup label="Admin Notes (Optional)">
                  <textarea className="textarea" placeholder="Feedback, reasons for approval or rejection..." value={notes} onChange={e => setNotes(e.target.value)} />
                </FormGroup>
              </>
            )}

            {selected.status !== 'pending' && (
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 16 }}>
                <div className="font-semibold mb-4" style={{ fontSize: 14, color: '#92400E' }}>💰 Session Rate Management</div>
                <p style={{ fontSize: 12, color: '#92400E', marginBottom: 12 }}>
                  Current: <strong>₱{Number(selected.approved_rate || selected.rate_per_session || 0).toLocaleString()}/session</strong>
                  {selected.approved_rate && <> · Commission per package: <strong>₱{(Number(selected.approved_rate) * 8 * 0.10).toLocaleString()}</strong></>}
                </p>
                <FormGroup label="Update Approved Rate (₱/session)" hint="Changing this affects the 10% commission on future bookings.">
                  <input className="input" type="number" min="0" placeholder="e.g. 350" value={rate} onChange={e => setRate(e.target.value)} />
                </FormGroup>
                {rate && Number(rate) !== Number(selected.approved_rate) && (
                  <div style={{ fontSize: 12, color: '#92400E', background: '#FEF9C3', borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
                    New commission per 8-session package: ₱{(Number(rate) * 8 * 0.10).toLocaleString()}
                  </div>
                )}
                <button className="btn btn-primary btn-sm" disabled={saving || !rate || Number(rate) === Number(selected.approved_rate)}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const { error: updErr } = await supabase.from('tutors').update({ approved_rate: Number(rate) }).eq('id', selected.id);
                      if (updErr) throw updErr;
                      setSelected(s => ({ ...s, approved_rate: Number(rate) }));
                      await refresh();
                      alert(`✅ Rate updated to ₱${Number(rate).toLocaleString()}/session`);
                    } catch (e) { alert(e.message); }
                    finally { setSaving(false); }
                  }}>
                  <Icon name="check" size={12} /> Update Rate
                </button>
                {selected.admin_notes && (
                  <div style={{ marginTop: 12 }}>
                    <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>Admin Notes</div>
                    <p style={{ fontSize: 13, color: tokens.mid }}>{selected.admin_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── PARENT REVIEW MODAL ── */}
      <Modal
        open={!!selectedParent}
        onClose={() => setSelectedParent(null)}
        title={`Review Parent Account: ${selectedParent?.full_name || '—'}`}
        footer={
          <div className="flex gap-10" style={{ width: '100%' }}>
            <button className="btn btn-ghost" onClick={() => setSelectedParent(null)}>Close</button>
            <button className="btn btn-danger" onClick={handleRejectParent} disabled={savingParent}>
              <Icon name="x" size={13} /> {savingParent ? '...' : 'Reject Account'}
            </button>
            <button className="btn btn-primary" onClick={handleApproveParent} disabled={savingParent}>
              <Icon name="check" size={13} /> {savingParent ? '...' : 'Approve Account'}
            </button>
          </div>
        }
      >
        {selectedParent && (
          <div>
            {/* Warning */}
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400E', display: 'flex', gap: 10 }}>
              <span>⚠️</span>
              <span>Review the parent's submitted valid IDs carefully before approving. Approved parents will be able to log in and find tutors for their children.</span>
            </div>

            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, ${tokens.primaryLight}, #EFF6FF)`, borderRadius: 14, padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              {selectedParent.avatar_url ? (
                <img src={selectedParent.avatar_url} alt={selectedParent.full_name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${tokens.primary}`, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{(selectedParent.full_name || 'P').charAt(0)}</span>
                </div>
              )}
              <div>
                <div className="font-jakarta font-extrabold" style={{ fontSize: 18 }}>{selectedParent.full_name}</div>
                <div className="text-xs text-muted mt-2">{selectedParent.email}</div>
                <div className="text-xs text-muted mt-4">📅 Registered {formatDate(selectedParent.created_at)}</div>
              </div>
            </div>

            {/* Profile details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                ['Full Name',       selectedParent.full_name || '—'],
                ['Email',           selectedParent.email    || '—'],
                ['Contact Number',  selectedParent.phone    || 'Not provided'],
                ['Home Address',    selectedParent.location || 'Not provided'],
                ['Gender',          selectedParent.gender   || '—'],
                ['Registered',      formatDate(selectedParent.created_at)],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                  <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Valid IDs */}
            <div>
              <div className="text-xs text-muted uppercase font-bold mb-12" style={{ letterSpacing: '0.5px' }}>🪪 Submitted Valid IDs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: '1st Valid ID', url: selectedParent.valid_id_1, key: 'pid1' },
                  { label: '2nd Valid ID', url: selectedParent.valid_id_2, key: 'pid2' },
                ].map(doc => (
                  <div key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: doc.url ? '#F0FDF4' : '#FEF2F2', border: `1.5px solid ${doc.url ? '#6EE7B7' : '#FCA5A5'}` }}>
                    <span style={{ fontSize: 24 }}>🪪</span>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold" style={{ fontSize: 14 }}>{doc.label}</div>
                      <div className="text-xs text-muted mt-2">{doc.url ? 'PDF submitted · Click to open and verify' : 'Not submitted'}</div>
                    </div>
                    {doc.url ? (
                      <button onClick={() => handleViewDoc(doc.key, doc.url, 'parent-documents')} className="btn btn-sm" style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' }} disabled={docLoading[doc.key]}>
                        {docLoading[doc.key] ? <Spinner size={12} /> : <><Icon name="eye" size={12} color="#065F46" /> View PDF</>}
                      </button>
                    ) : (
                      <Badge variant="danger">Missing</Badge>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, fontSize: 12, color: tokens.muted }}>
                🔒 View the PDFs to verify the identity documents before approving. Links expire after 1 hour.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}