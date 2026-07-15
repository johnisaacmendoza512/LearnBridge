import { useState } from 'react';
import { useAdminData } from '../../hooks/useAdminData';
import { supabase } from '../../lib/supabase';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import AppDialog from '../../components/ui/AppDialog';
import tokens from '../../lib/tokens';

const ROLE_VARIANT = { parent: 'info', tutor: 'gray', admin: 'warning' };
const TUTOR_STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'danger' };

function StarDisplay({ value, size = 14 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ fontSize: size, color: s <= Math.round(value) ? '#F59E0B' : '#D1D5DB' }}>★</span>
      ))}
    </span>
  );
}

export default function UsersPage() {
  const { allUsers, loading, error, deleteUser, refresh } = useAdminData();

  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState('all');
  const [deleting,      setDeleting]      = useState(null);
  const [viewTutor,     setViewTutor]     = useState(null);
  const [tutorDetail,   setTutorDetail]   = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newRate,       setNewRate]       = useState('');
  const [savingRate,    setSavingRate]    = useState(false);
  const [dialog,        setDialog]        = useState(null);

  // Parent modal state
  const [viewParent,      setViewParent]      = useState(null);
  const [parentDetail,    setParentDetail]    = useState(null);
  const [loadingParent,   setLoadingParent]   = useState(false);
  const [approvingParent, setApprovingParent] = useState(false);

  const filtered = allUsers.filter(u => {
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const counts = { all: allUsers.length, parent: 0, tutor: 0, admin: 0 };
  allUsers.forEach(u => { if (counts[u.role] !== undefined) counts[u.role]++; });

  const handleDelete = async (user) => {
    setDialog({
      type: 'confirm', confirmDanger: true,
      title: 'Remove User',
      message: `Remove "${user.full_name}"? This cannot be undone.`,
      confirmLabel: 'Yes, Remove',
      onConfirm: async () => {
        setDialog(null);
        setDeleting(user.id);
        try { await deleteUser(user.id); }
        catch (e) { setDialog({ type: 'error', title: 'Error', message: e.message }); }
        finally { setDeleting(null); }
      },
    });
  };

  // ── View tutor ──────────────────────────────────────────────────────
  const handleViewTutor = async (user) => {
    setViewTutor(user);
    setTutorDetail(null);
    setLoadingDetail(true);
    setNewRate('');

    // Fetch fresh tutor data
    const { data: tutor, error: tutorErr } = await supabase
      .from('tutors')
      .select(`
        id, specialization, years_experience, approved_rate, rate_per_session,
        certification_scores, status, wallet_balance,
        nbi_clearance_url, prc_license_url, medical_cert_url, application_form_url
      `)
      .eq('id', user.id)
      .single();

    if (tutorErr) console.error('Tutor fetch error:', tutorErr.message);

    const { data: ratings } = await supabase
      .from('tutor_ratings')
      .select(`id, star_rating, comment, created_at, parent:parent_id ( full_name )`)
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Merge fresh fetch with cached tutorData as fallback
    const mergedTutor = {
      ...(user.tutorData || {}),  // cached data first
      ...(tutor || {}),           // fresh data overrides
    };
    setTutorDetail({ ...mergedTutor, ratings: ratings || [], profile: user });
    setNewRate(mergedTutor?.approved_rate || mergedTutor?.rate_per_session || '');
    setLoadingDetail(false);
  };

  const handleSaveRate = async () => {
    if (!newRate || !viewTutor) return;
    setSavingRate(true);
    try {
      await supabase.from('tutors').update({ approved_rate: Number(newRate) }).eq('id', viewTutor.id);
      setTutorDetail(prev => ({ ...prev, approved_rate: Number(newRate) }));
      setDialog({
        type: 'success', title: 'Rate Updated!',
        message: `${viewTutor.full_name}'s approved rate has been updated to ₱${Number(newRate).toLocaleString()}/session.\n\nNew commission per 8-session package: ₱${(Number(newRate) * 8 * 0.10).toLocaleString()}`,
      });
    } catch (e) {
      setDialog({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setSavingRate(false);
    }
  };

  // ── View parent ─────────────────────────────────────────────────────
  const handleViewParent = async (user) => {
    setViewParent(user);
    setParentDetail(null);
    setLoadingParent(true);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setParentDetail(profileData);
    setLoadingParent(false);
  };

  const handleApproveParent = async () => {
    if (!viewParent) return;
    setApprovingParent(true);
    try {
      await supabase.from('profiles').update({ status: 'approved' }).eq('id', viewParent.id);
      setParentDetail(prev => ({ ...prev, status: 'approved' }));
      // Update the user in the list
      refresh();
      setDialog({
        type: 'success', title: 'Parent Approved!',
        message: `${viewParent.full_name}'s account has been approved. They can now log in and use the platform.`,
      });
    } catch (e) {
      setDialog({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setApprovingParent(false);
    }
  };

  const handleRejectParent = async () => {
    if (!viewParent) return;
    setDialog({
      type: 'confirm', confirmDanger: true,
      title: 'Reject Parent Account',
      message: `Reject "${viewParent.full_name}"'s account? They will not be able to log in.`,
      confirmLabel: 'Yes, Reject',
      onConfirm: async () => {
        setDialog(null);
        setApprovingParent(true);
        try {
          await supabase.from('profiles').update({ status: 'rejected' }).eq('id', viewParent.id);
          setParentDetail(prev => ({ ...prev, status: 'rejected' }));
          refresh();
        } catch (e) {
          setDialog({ type: 'error', title: 'Error', message: e.message });
        } finally {
          setApprovingParent(false);
        }
      },
    });
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
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>User Management</h2>
        <p className="text-sm text-muted mt-4">View and manage all registered users across the platform.</p>
      </div>

      {/* Filters */}
      <div className="card p-16 mb-20">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
          <input className="input" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-8">
            {['all', 'parent', 'tutor', 'admin'].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)} className="btn btn-sm" style={{ background: roleFilter === r ? tokens.primary : '#fff', color: roleFilter === r ? '#fff' : tokens.mid, border: `1px solid ${roleFilter === r ? tokens.primary : tokens.border}`, textTransform: 'capitalize' }}>
                {r} ({counts[r] ?? 0})
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon="👤" title="No users found" description={search ? 'Try a different search term.' : 'No users registered yet.'} /></div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Location</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-10">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.full_name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${tokens.border}` }} />
                      ) : (
                        <Avatar name={u.full_name || 'U'} size={32} colorIndex={i} />
                      )}
                      <span className="font-semibold" style={{ fontSize: 13 }}>{u.full_name || '—'}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{u.email || '—'}</td>
                  <td>
                    <Badge variant={ROLE_VARIANT[u.role] || 'gray'} style={{ textTransform: 'capitalize' }}>{u.role}</Badge>
                  </td>
                  <td>
                    {u.role === 'parent' && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: u.status === 'approved' ? '#D1FAE5' : u.status === 'rejected' ? '#FEE2E2' : '#FEF9C3',
                        color:      u.status === 'approved' ? '#065F46' : u.status === 'rejected' ? '#DC2626' : '#92400E',
                      }}>
                        {u.role === 'tutor'
                          ? (u.tutorData?.status === 'approved' ? '✓ Approved' : u.tutorData?.status === 'rejected' ? '✗ Rejected' : '⏳ Pending')
                          : (u.status === 'approved' ? '✓ Verified' : u.status === 'rejected' ? '✗ Rejected' : '⏳ Pending')
                        }
                      </span>
                    )}
                    {u.role === 'tutor' && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: u.tutorData?.status === 'approved' ? '#D1FAE5' : u.tutorData?.status === 'rejected' ? '#FEE2E2' : '#FEF9C3',
                        color:      u.tutorData?.status === 'approved' ? '#065F46' : u.tutorData?.status === 'rejected' ? '#DC2626' : '#92400E',
                      }}>
                        {u.tutorData?.status === 'approved' ? '✓ Approved' : u.tutorData?.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                      </span>
                    )}
                    {u.role === 'admin' && <span style={{ fontSize: 11, color: tokens.muted }}>Admin</span>}
                  </td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{u.location || '—'}</td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{formatDate(u.created_at)}</td>
                  <td>
                    <div className="flex gap-6">
                      {u.role === 'tutor' && (
                        <button className="btn btn-sm" style={{ background: tokens.primaryLight, color: tokens.primary }} onClick={() => handleViewTutor(u)}>
                          <Icon name="eye" size={11} color={tokens.primary} /> View
                        </button>
                      )}
                      {u.role === 'parent' && (
                        <button className="btn btn-sm" style={{ background: tokens.primaryLight, color: tokens.primary }} onClick={() => handleViewParent(u)}>
                          <Icon name="eye" size={11} color={tokens.primary} /> View
                        </button>
                      )}
                      {u.role !== 'admin' && (
                        <button className="btn btn-danger btn-sm" disabled={deleting === u.id} onClick={() => handleDelete(u)}>
                          <Icon name="x" size={11} />{deleting === u.id ? ' ...' : ' Remove'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 24px', borderTop: `1px solid ${tokens.border}` }}>
            <p className="text-xs text-muted">Showing {filtered.length} of {allUsers.length} users</p>
          </div>
        </div>
      )}

      {/* ── Tutor Profile Modal ── */}
      <Modal
        open={!!viewTutor}
        onClose={() => setViewTutor(null)}
        title={`Tutor Profile: ${viewTutor?.full_name || '—'}`}
        footer={<button className="btn btn-ghost" onClick={() => setViewTutor(null)}>Close</button>}
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spinner dark size={28} /></div>
        ) : tutorDetail && (
          <div>
            <div style={{ background: `linear-gradient(135deg, ${tokens.primaryLight}, #EFF6FF)`, borderRadius: 14, padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              {viewTutor?.avatar_url ? (
                <img src={viewTutor.avatar_url} alt={viewTutor.full_name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${tokens.primary}`, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{(viewTutor?.full_name || 'T').charAt(0)}</span>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div className="font-jakarta font-extrabold" style={{ fontSize: 18 }}>{viewTutor?.full_name}</div>
                <div className="text-xs text-muted mt-2">{viewTutor?.email}</div>
                <div className="flex items-center gap-8 mt-6">
                  <Badge variant={tutorDetail?.status === 'approved' ? 'success' : tutorDetail?.status === 'rejected' ? 'danger' : 'warning'}>
                    {tutorDetail?.status === 'approved' ? '✓ Approved' : tutorDetail?.status === 'rejected' ? '✗ Rejected' : '⏳ Pending Admin Approval'}
                  </Badge>
                  {viewTutor?.gender && <span className="text-xs text-muted">{viewTutor.gender}</span>}
                  {viewTutor?.location && <span className="text-xs text-muted">📍 {viewTutor.location}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {tutorDetail.average_rating > 0 && (
                  <>
                    <div className="font-jakarta font-black" style={{ fontSize: 24, color: '#F59E0B' }}>{Number(tutorDetail.average_rating).toFixed(1)} ★</div>
                    <div className="text-xs text-muted">{tutorDetail.total_ratings} review{tutorDetail.total_ratings !== 1 ? 's' : ''}</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                ['Experience',      (tutorDetail.years_experience || viewTutor?.tutorData?.years_experience) ? `${tutorDetail.years_experience || viewTutor?.tutorData?.years_experience} year(s)` : 'Not set'],
                ['Status',          tutorDetail.status || viewTutor?.tutorData?.status || 'pending'],
                ['Wallet Balance',  `₱${Number(tutorDetail.wallet_balance || viewTutor?.tutorData?.wallet_balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
                ['Rate/Session',    (tutorDetail.rate_per_session || viewTutor?.tutorData?.rate_per_session) ? `₱${Number(tutorDetail.rate_per_session || viewTutor?.tutorData?.rate_per_session || 0).toLocaleString()}` : 'Not set'],
                ['8-Session Total', (tutorDetail.approved_rate || tutorDetail.rate_per_session) ? `₱${(Number(tutorDetail.approved_rate || tutorDetail.rate_per_session) * 8).toLocaleString()}` : 'Not set'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                  <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>

            {(tutorDetail.specialization || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>Subjects</div>
                <div className="flex gap-8">
                  {tutorDetail.specialization.map(s => (
                    <span key={s} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s === 'english' ? '#EFF6FF' : '#F0FDF4', color: s === 'english' ? '#1D4ED8' : '#15803D', textTransform: 'capitalize' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div className="font-semibold mb-4" style={{ fontSize: 14, color: '#92400E' }}>💰 Session Rate Management</div>
              <p style={{ fontSize: 12, color: '#92400E', marginBottom: 12 }}>
                Current approved rate: <strong>₱{Number(tutorDetail.approved_rate || tutorDetail.rate_per_session || 0).toLocaleString()}/session</strong>
                {tutorDetail.approved_rate && <> · Commission per package: <strong>₱{(Number(tutorDetail.approved_rate) * 8 * 0.10).toLocaleString()}</strong></>}
              </p>
              <div className="flex gap-10 items-end">
                <div style={{ flex: 1 }}>
                  <FormGroup label="New Approved Rate (₱/session)" hint="10% commission applies per 8-session package.">
                    <input className="input" type="number" min="0" placeholder="e.g. 350" value={newRate} onChange={e => setNewRate(e.target.value)} />
                  </FormGroup>
                </div>
                <button className="btn btn-primary" onClick={handleSaveRate} disabled={savingRate || !newRate || Number(newRate) === Number(tutorDetail.approved_rate)} style={{ marginBottom: 20 }}>
                  {savingRate ? <Spinner /> : <><Icon name="check" size={13} /> Update Rate</>}
                </button>
              </div>
              {newRate && Number(newRate) !== Number(tutorDetail.approved_rate) && (
                <div style={{ fontSize: 12, color: '#92400E', background: '#FEF9C3', borderRadius: 8, padding: '6px 10px' }}>
                  New commission per 8-session package: ₱{(Number(newRate) * 8 * 0.10).toLocaleString()}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>Submitted Documents</div>
              <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                {[
                  { label: 'NBI Clearance',      url: tutorDetail.nbi_clearance_url    },
                  { label: 'PRC License',         url: tutorDetail.prc_license_url      },
                  { label: 'Medical Certificate', url: tutorDetail.medical_cert_url     },
                  { label: 'Application Form',    url: tutorDetail.application_form_url },
                ].map(doc => (
                  <div key={doc.label}>
                    {doc.url ? (
                      <button onClick={() => window.open(doc.url, '_blank')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7', cursor: 'pointer' }}>
                        👁 {doc.label}
                      </button>
                    ) : (
                      <Badge variant="warning"><Icon name="upload" size={9} color="#92400E" /> {doc.label} Missing</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted uppercase font-bold mb-10" style={{ letterSpacing: '0.5px' }}>Parent Ratings & Feedback ({tutorDetail.ratings.length})</div>
              {tutorDetail.ratings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: tokens.muted, fontSize: 13 }}>No parent ratings yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tutorDetail.ratings.map((r, i) => {
                    const starLabel = r.star_rating === 5 ? 'Excellent' : r.star_rating === 4 ? 'Good' : r.star_rating === 3 ? 'Average' : r.star_rating === 2 ? 'Below Average' : 'Poor';
                    const starBg    = r.star_rating >= 4 ? '#D1FAE5' : r.star_rating === 3 ? '#FEF3C7' : '#FEE2E2';
                    const starColor = r.star_rating >= 4 ? '#065F46' : r.star_rating === 3 ? '#92400E' : '#DC2626';
                    return (
                      <div key={r.id || i} style={{ background: '#F9FAFB', borderRadius: 10, padding: 14, border: `1px solid ${tokens.border}` }}>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-8">
                            <StarDisplay value={r.star_rating} size={14} />
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: starBg, color: starColor }}>{starLabel}</span>
                          </div>
                          <span className="text-xs text-muted">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                        </div>
                        {r.comment && <p style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.6, margin: '0 0 6px' }}>"{r.comment}"</p>}
                        <div className="text-xs text-muted">— {r.parent?.full_name || 'Anonymous Parent'}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Parent Profile Modal ── */}
      <Modal
        open={!!viewParent}
        onClose={() => setViewParent(null)}
        title={`Parent Profile: ${viewParent?.full_name || '—'}`}
        footer={
          <div className="flex gap-10" style={{ width: '100%' }}>
            <button className="btn btn-ghost" onClick={() => setViewParent(null)}>Close</button>
            {parentDetail && parentDetail.status !== 'approved' && (
              <button className="btn btn-primary" onClick={handleApproveParent} disabled={approvingParent}>
                {approvingParent ? <Spinner /> : <><Icon name="check" size={13} /> Approve Account</>}
              </button>
            )}
            {parentDetail && parentDetail.status !== 'rejected' && (
              <button className="btn btn-danger" onClick={handleRejectParent} disabled={approvingParent}>
                <Icon name="x" size={13} /> Reject
              </button>
            )}
          </div>
        }
      >
        {loadingParent ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spinner dark size={28} /></div>
        ) : parentDetail && (
          <div>
            {/* Status banner */}
            <div style={{
              background: parentDetail.status === 'approved' ? '#D1FAE5' : parentDetail.status === 'rejected' ? '#FEE2E2' : '#FEF9C3',
              border: `1px solid ${parentDetail.status === 'approved' ? '#6EE7B7' : parentDetail.status === 'rejected' ? '#FCA5A5' : '#FDE68A'}`,
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              fontSize: 13, fontWeight: 600,
              color: parentDetail.status === 'approved' ? '#065F46' : parentDetail.status === 'rejected' ? '#DC2626' : '#92400E',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>
                {parentDetail.status === 'approved' ? '✅' : parentDetail.status === 'rejected' ? '❌' : '⏳'}
              </span>
              <div>
                <div>{parentDetail.status === 'approved' ? 'Account Verified' : parentDetail.status === 'rejected' ? 'Account Rejected' : 'Pending Admin Approval'}</div>
                {parentDetail.status === 'pending' && <div style={{ fontWeight: 400, fontSize: 12, marginTop: 2 }}>Review the submitted IDs below and approve or reject this account.</div>}
              </div>
            </div>

            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, ${tokens.primaryLight}, #EFF6FF)`, borderRadius: 14, padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              {viewParent?.avatar_url ? (
                <img src={viewParent.avatar_url} alt={viewParent.full_name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${tokens.primary}`, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{(viewParent?.full_name || 'P').charAt(0)}</span>
                </div>
              )}
              <div>
                <div className="font-jakarta font-extrabold" style={{ fontSize: 18 }}>{viewParent?.full_name}</div>
                <div className="text-xs text-muted mt-2">{viewParent?.email}</div>
                <div className="text-xs text-muted mt-4">📅 Registered {formatDate(viewParent?.created_at)}</div>
              </div>
            </div>

            {/* Profile details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                ['Full Name',       parentDetail.full_name || '—'],
                ['Email',           parentDetail.email     || '—'],
                ['Contact Number',  parentDetail.phone     || 'Not provided'],
                ['Home Address',    parentDetail.location  || 'Not provided'],
                ['Gender',          parentDetail.gender    || '—'],
                ['Registered',      formatDate ? formatDate(parentDetail.created_at) : parentDetail.created_at?.split('T')[0] || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                  <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Valid IDs */}
            <div>
              <div className="text-xs text-muted uppercase font-bold mb-10" style={{ letterSpacing: '0.5px' }}>🪪 Submitted Valid IDs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: '1st Valid ID', url: parentDetail.valid_id_1 },
                  { label: '2nd Valid ID', url: parentDetail.valid_id_2 },
                ].map((doc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: doc.url ? '#F0FDF4' : '#FEF2F2', border: `1.5px solid ${doc.url ? '#6EE7B7' : '#FCA5A5'}` }}>
                    <span style={{ fontSize: 24 }}>🪪</span>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold" style={{ fontSize: 14 }}>{doc.label}</div>
                      <div className="text-xs text-muted mt-2">{doc.url ? 'PDF submitted · Click to open' : 'Not submitted'}</div>
                    </div>
                    {doc.url ? (
                      <button onClick={() => window.open(doc.url, '_blank')} className="btn btn-sm" style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                        👁 View PDF
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>Missing</span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, fontSize: 12, color: tokens.muted }}>
                🔒 Review these IDs carefully before approving the parent account.
              </div>
            </div>
          </div>
        )}
      </Modal>

      <AppDialog
        open={!!dialog}
        type={dialog?.type}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        confirmDanger={dialog?.confirmDanger}
        onClose={() => setDialog(null)}
        onConfirm={dialog?.onConfirm}
      />
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}