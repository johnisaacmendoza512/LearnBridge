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
  const { tutors, loading, error, approveTutor, rejectTutor, refresh } = useAdminData();

  const [filter,     setFilter]     = useState('pending');
  const [selected,   setSelected]   = useState(null);
  const [rate,       setRate]       = useState('');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [docUrls,    setDocUrls]    = useState({});
  const [docLoading, setDocLoading] = useState({});

  const counts = { all: tutors.length, pending: 0, approved: 0, rejected: 0 };
  tutors.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
  const filtered = filter === 'all' ? tutors : tutors.filter(t => t.status === filter);

  const openReview = (t) => {
    setSelected(t);
    setRate(t.approved_rate || t.rate_per_session || '');
    setNotes(t.admin_notes || '');
    setDocUrls({});
    setDocLoading({});
  };

  const handleViewDoc = async (docKey, storagePath) => {
    if (!storagePath) { alert('No document was submitted for this field.'); return; }
    if (docUrls[docKey]) { window.open(docUrls[docKey], '_blank'); return; }

    setDocLoading(prev => ({ ...prev, [docKey]: true }));
    try {
      let path = '';
      if (storagePath.includes('tutor-documents/')) {
        path = storagePath.split('tutor-documents/')[1];
      } else {
        path = storagePath;
      }

      const { data, error: signErr } = await supabase.storage
        .from('tutor-documents')
        .createSignedUrl(path, 3600);

      if (signErr || !data?.signedUrl) {
        window.open(storagePath, '_blank');
        return;
      }

      setDocUrls(prev => ({ ...prev, [docKey]: data.signedUrl }));
      window.open(data.signedUrl, '_blank');
    } catch {
      window.open(storagePath, '_blank');
    } finally {
      setDocLoading(prev => ({ ...prev, [docKey]: false }));
    }
  };

  const handleApprove = async () => {
    if (!rate) { alert('Please set an approved session rate before approving.'); return; }
    setSaving(true);
    try {
      await approveTutor(selected.id, rate, notes);
      setSelected(null);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await rejectTutor(selected.id, notes);
      setSelected(null);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
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
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Tutor Verification</h2>
        <p className="text-sm text-muted mt-4">
          Review submitted credentials and approve or reject tutor applications.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-8 mb-20">
        {['all', 'pending', 'approved', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="btn btn-sm"
            style={{
              background:    filter === f ? tokens.primary : '#fff',
              color:         filter === f ? '#fff' : tokens.mid,
              border:        `1px solid ${filter === f ? tokens.primary : tokens.border}`,
              textTransform: 'capitalize',
            }}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Tutor Table */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🔍"
            title={`No ${filter === 'all' ? '' : filter} tutors`}
            description="Tutor applications will appear here once tutors register."
          />
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
              {filtered.map((t, i) => (
                <tr key={t.id}>
                  <td>
                    <div className="flex items-center gap-10">
                      <Avatar name={t.profile?.full_name || 'T'} size={32} colorIndex={i} />
                      <span className="font-semibold" style={{ fontSize: 13 }}>
                        {t.profile?.full_name || '—'}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{t.profile?.email || '—'}</td>
                  <td>
                    {(t.specialization || []).map(s => (
                      <Badge key={s} variant="info" style={{ marginRight: 4, textTransform: 'capitalize', fontSize: 10 }}>
                        {s}
                      </Badge>
                    ))}
                  </td>
                  <td>
                    <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
                      <Badge variant={t.nbi_clearance_url ? 'success' : 'danger'} style={{ fontSize: 10 }}>
                        NBI {t.nbi_clearance_url ? '✓' : '✗'}
                      </Badge>
                      <Badge variant={t.prc_license_url ? 'success' : 'danger'} style={{ fontSize: 10 }}>
                        PRC {t.prc_license_url ? '✓' : '✗'}
                      </Badge>
                      <Badge variant={t.medical_cert_url ? 'success' : 'danger'} style={{ fontSize: 10 }}>
                        Med {t.medical_cert_url ? '✓' : '✗'}
                      </Badge>
                      <Badge variant={t.resume_url ? 'success' : 'danger'} style={{ fontSize: 10 }}>
                        App {t.resume_url ? '✓' : '✗'}
                      </Badge>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {t.rate_per_session ? `₱${t.rate_per_session}` : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{formatDate(t.created_at)}</td>
                  <td>
                    <Badge variant={STATUS_VARIANT[t.status] || 'gray'}>{t.status}</Badge>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#D1FAE5', color: '#065F46' }}
                      onClick={() => openReview(t)}
                    >
                      <Icon name="eye" size={11} color="#065F46" />
                      {t.status === 'pending' ? ' Review' : ' View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
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
            {/* Basic Info Grid */}
            <div className="grid-2 mb-20">
              {[
                ['Full Name',      selected.profile?.full_name   || '—'],
                ['Email',          selected.profile?.email       || '—'],
                ['Gender',         selected.profile?.gender      || '—'],
                ['Location',       selected.profile?.location    || '—'],
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

            {/* Bio */}
            {selected.profile?.bio && (
              <div className="mb-20">
                <div className="text-xs text-muted uppercase font-bold mb-6" style={{ letterSpacing: '0.5px' }}>Bio</div>
                <p style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.6 }}>{selected.profile.bio}</p>
              </div>
            )}

            {/* Document Viewer */}
            <div className="mb-20">
              <div className="text-xs text-muted uppercase font-bold mb-12" style={{ letterSpacing: '0.5px' }}>
                Submitted Documents (PDF)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { key: 'nbi',     label: 'NBI Clearance',       path: selected.nbi_clearance_url },
                  { key: 'prc',     label: 'PRC License',          path: selected.prc_license_url   },
                  { key: 'medical', label: 'Medical Certificate',  path: selected.medical_cert_url  },
                  { key: 'resume',  label: 'Application Form',     path: selected.resume_url        },
                ].map(({ key, label, path }) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 10,
                      border: `1px solid ${path ? tokens.border : '#FEE2E2'}`,
                      background: path ? '#FAFAFA' : '#FFF5F5',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: path ? '#D1FAE5' : '#FEE2E2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name={path ? 'check' : 'x'} size={14} color={path ? '#065F46' : '#991B1B'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold" style={{ fontSize: 13 }}>{label}</div>
                      <div className="text-xs text-muted">
                        {path ? `📄 ${path.split('/').pop()}` : 'No file submitted'}
                      </div>
                    </div>
                    {path ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleViewDoc(key, path)}
                        disabled={docLoading[key]}
                        style={{ flexShrink: 0 }}
                      >
                        {docLoading[key] ? <Spinner size={12} /> : <><Icon name="eye" size={12} /> View PDF</>}
                      </button>
                    ) : (
                      <Badge variant="danger">Missing</Badge>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted mt-8">
                PDFs open in a new tab. Links expire after 1 hour for security.
              </p>
            </div>

            {/* Certification Scores */}
            {selected.certification_scores && Object.keys(selected.certification_scores).length > 0 && (
              <div className="mb-20">
                <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>
                  Certification Scores
                </div>
                <div className="flex gap-6" style={{ flexWrap: 'wrap' }}>
                  {Object.entries(selected.certification_scores).map(([topic, score]) => (
                    <div key={topic} style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: score >= 75 ? '#D1FAE5' : '#FEF3C7',
                      color:      score >= 75 ? '#065F46' : '#92400E',
                    }}>
                      {topic}: {score}%
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending — set rate and notes */}
            {selected.status === 'pending' && (
              <>
                <div style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: '#FFF7ED', border: `1px solid #FED7AA`,
                  marginBottom: 16, fontSize: 13, color: '#92400E',
                }}>
                  ⚠️ Review all documents carefully before approving.
                  The tutor has already completed the AI Certification Assessment during registration.
                  Check their certification scores above before setting the approved rate.
                </div>
                <FormGroup
                  label="Approved Session Rate (₱)"
                  hint="Based on credentials, experience, and qualifications. This is the rate shown to parents."
                >
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="e.g. 350"
                    value={rate}
                    onChange={e => setRate(e.target.value)}
                  />
                </FormGroup>
                <FormGroup label="Admin Notes (Optional)">
                  <textarea
                    className="textarea"
                    placeholder="Feedback, reasons for approval or rejection..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </FormGroup>
              </>
            )}

            {/* Approved/Rejected — editable rate */}
            {selected.status !== 'pending' && (
              <div>
                <div style={{
                  background: '#FFF7ED', border: '1px solid #FED7AA',
                  borderRadius: 12, padding: 16, marginBottom: 16,
                }}>
                  <div className="font-semibold mb-4" style={{ fontSize: 14, color: '#92400E' }}>
                    💰 Session Rate Management
                  </div>
                  <p style={{ fontSize: 12, color: '#92400E', marginBottom: 12 }}>
                    Current: <strong>₱{Number(selected.approved_rate || selected.rate_per_session || 0).toLocaleString()}/session</strong>
                    {selected.approved_rate && (
                      <> · Commission per package: <strong>₱{(Number(selected.approved_rate) * 8 * 0.10).toLocaleString()}</strong></>
                    )}
                  </p>
                  <FormGroup
                    label="Update Approved Rate (₱/session)"
                    hint="Changing this affects the 10% commission on future bookings."
                  >
                    <input
                      className="input"
                      type="number"
                      min="0"
                      placeholder="e.g. 350"
                      value={rate}
                      onChange={e => setRate(e.target.value)}
                    />
                  </FormGroup>
                  {rate && Number(rate) !== Number(selected.approved_rate) && (
                    <div style={{ fontSize: 12, color: '#92400E', background: '#FEF9C3', borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
                      New commission per 8-session package: ₱{(Number(rate) * 8 * 0.10).toLocaleString()}
                    </div>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={saving || !rate || Number(rate) === Number(selected.approved_rate)}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const { error: updErr } = await supabase
                          .from('tutors')
                          .update({ approved_rate: Number(rate) })
                          .eq('id', selected.id);
                        if (updErr) throw updErr;
                        setSelected(s => ({ ...s, approved_rate: Number(rate) }));
                        await refresh();
                        alert(`✅ Rate updated to ₱${Number(rate).toLocaleString()}/session`);
                      } catch (e) { alert(e.message); }
                      finally { setSaving(false); }
                    }}
                  >
                    <Icon name="check" size={12} /> Update Rate
                  </button>
                </div>

                {selected.admin_notes && (
                  <div>
                    <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>
                      Admin Notes
                    </div>
                    <p style={{ fontSize: 13, color: tokens.mid }}>{selected.admin_notes}</p>
                  </div>
                )}
              </div>
            )}
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