import { useState, useEffect } from 'react';
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

const ROLE_VARIANT = { parent: 'info', tutor: 'success', admin: 'warning' };

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

  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deleting,   setDeleting]   = useState(null);
  const [viewTutor,  setViewTutor]  = useState(null); // tutor profile modal
  const [tutorDetail,setTutorDetail]= useState(null); // full tutor data + ratings
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newRate,    setNewRate]    = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [dialog,     setDialog]     = useState(null);

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

  // Open tutor profile modal and fetch full details
  const handleViewTutor = async (user) => {
    setViewTutor(user);
    setTutorDetail(null);
    setLoadingDetail(true);
    setNewRate('');

    const { data: tutor } = await supabase
      .from('tutors')
      .select(`
        id, specialization, years_experience, approved_rate, rate_per_session,
        certification_scores, status, wallet_balance, average_rating, total_ratings,
        nbi_clearance_url, prc_license_url, medical_cert_url, resume_url
      `)
      .eq('id', user.id)
      .single();

    const { data: ratings } = await supabase
      .from('tutor_ratings')
      .select(`
        id, star_rating, comment, created_at,
        parent:parent_id ( full_name )
      `)
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    setTutorDetail({ ...tutor, ratings: ratings || [] });
    setNewRate(tutor?.approved_rate || tutor?.rate_per_session || '');
    setLoadingDetail(false);
  };

  const handleSaveRate = async () => {
    if (!newRate || !viewTutor) return;
    setSavingRate(true);
    try {
      await supabase.from('tutors')
        .update({ approved_rate: Number(newRate) })
        .eq('id', viewTutor.id);

      setTutorDetail(prev => ({ ...prev, approved_rate: Number(newRate) }));
      setDialog({
        type: 'success',
        title: 'Rate Updated!',
        message: `${viewTutor.full_name}'s approved rate has been updated to ₱${Number(newRate).toLocaleString()}/session.\n\nThe new commission (10%) will apply to future bookings: ₱${(Number(newRate) * 8 * 0.10).toLocaleString()} per 8-session package.`,
      });
    } catch (e) {
      setDialog({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setSavingRate(false);
    }
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
          <input
            className="input"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-8">
            {['all', 'parent', 'tutor', 'admin'].map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className="btn btn-sm"
                style={{
                  background:    roleFilter === r ? tokens.primary : '#fff',
                  color:         roleFilter === r ? '#fff' : tokens.mid,
                  border:        `1px solid ${roleFilter === r ? tokens.primary : tokens.border}`,
                  textTransform: 'capitalize',
                }}
              >
                {r} ({counts[r] ?? 0})
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="👤"
            title="No users found"
            description={search ? 'Try a different search term.' : 'No users registered yet.'}
          />
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Location</th>
                <th>Gender</th>
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
                        <img
                          src={u.avatar_url}
                          alt={u.full_name}
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${tokens.border}` }}
                        />
                      ) : (
                        <Avatar name={u.full_name || 'U'} size={32} colorIndex={i} />
                      )}
                      <span className="font-semibold" style={{ fontSize: 13 }}>
                        {u.full_name || '—'}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{u.email || '—'}</td>
                  <td>
                    <Badge variant={ROLE_VARIANT[u.role] || 'gray'} style={{ textTransform: 'capitalize' }}>
                      {u.role}
                    </Badge>
                  </td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{u.location || '—'}</td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{u.gender || '—'}</td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{formatDate(u.created_at)}</td>
                  <td>
                    <div className="flex gap-6">
                      {/* View button for tutors */}
                      {u.role === 'tutor' && (
                        <button
                          className="btn btn-sm"
                          style={{ background: tokens.primaryLight, color: tokens.primary }}
                          onClick={() => handleViewTutor(u)}
                        >
                          <Icon name="eye" size={11} color={tokens.primary} /> View
                        </button>
                      )}
                      {u.role !== 'admin' && (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={deleting === u.id}
                          onClick={() => handleDelete(u)}
                        >
                          <Icon name="x" size={11} />
                          {deleting === u.id ? ' ...' : ' Remove'}
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
            {/* Header */}
            <div style={{
              background: `linear-gradient(135deg, ${tokens.primaryLight}, #EFF6FF)`,
              borderRadius: 14, padding: 20, marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              {viewTutor?.avatar_url ? (
                <img src={viewTutor.avatar_url} alt={viewTutor.full_name}
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${tokens.primary}`, flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>
                    {(viewTutor?.full_name || 'T').charAt(0)}
                  </span>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div className="font-jakarta font-extrabold" style={{ fontSize: 18 }}>
                  {viewTutor?.full_name}
                </div>
                <div className="text-xs text-muted mt-2">{viewTutor?.email}</div>
                <div className="flex items-center gap-8 mt-6">
                  <Badge variant="success"><Icon name="shield" size={9} color="#065F46" /> Verified</Badge>
                  {viewTutor?.gender && <span className="text-xs text-muted">{viewTutor.gender}</span>}
                  {viewTutor?.location && <span className="text-xs text-muted">📍 {viewTutor.location}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {tutorDetail.average_rating > 0 && (
                  <>
                    <div className="font-jakarta font-black" style={{ fontSize: 24, color: '#F59E0B' }}>
                      {Number(tutorDetail.average_rating).toFixed(1)} ★
                    </div>
                    <div className="text-xs text-muted">{tutorDetail.total_ratings} review{tutorDetail.total_ratings !== 1 ? 's' : ''}</div>
                  </>
                )}
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                ['Experience',     `${tutorDetail.years_experience || 0} year(s)`],
                ['Status',         tutorDetail.status || '—'],
                ['Wallet Balance', `₱${Number(tutorDetail.wallet_balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
                ['8-Session Total', tutorDetail.approved_rate ? `₱${(Number(tutorDetail.approved_rate) * 8).toLocaleString()}` : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                  <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Subjects */}
            {(tutorDetail.specialization || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>Subjects</div>
                <div className="flex gap-8">
                  {tutorDetail.specialization.map(s => (
                    <span key={s} style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: s === 'english' ? '#EFF6FF' : '#F0FDF4',
                      color:      s === 'english' ? '#1D4ED8' : '#15803D',
                      textTransform: 'capitalize',
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Edit Rate Section ── */}
            <div style={{
              background: '#FFF7ED', border: '1px solid #FED7AA',
              borderRadius: 12, padding: 16, marginBottom: 20,
            }}>
              <div className="font-semibold mb-4" style={{ fontSize: 14, color: '#92400E' }}>
                💰 Session Rate Management
              </div>
              <p style={{ fontSize: 12, color: '#92400E', marginBottom: 12 }}>
                Current approved rate: <strong>₱{Number(tutorDetail.approved_rate || tutorDetail.rate_per_session || 0).toLocaleString()}/session</strong>
                {tutorDetail.approved_rate && (
                  <> · Commission per package: <strong>₱{(Number(tutorDetail.approved_rate) * 8 * 0.10).toLocaleString()}</strong></>
                )}
              </p>
              <div className="flex gap-10 items-end">
                <div style={{ flex: 1 }}>
                  <FormGroup label="New Approved Rate (₱/session)" hint="Changing this affects commission on future bookings (10% of rate × 8 sessions).">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      placeholder="e.g. 350"
                      value={newRate}
                      onChange={e => setNewRate(e.target.value)}
                    />
                  </FormGroup>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveRate}
                  disabled={savingRate || !newRate || Number(newRate) === Number(tutorDetail.approved_rate)}
                  style={{ marginBottom: 20 }}
                >
                  {savingRate ? <Spinner /> : <><Icon name="check" size={13} /> Update Rate</>}
                </button>
              </div>
              {newRate && Number(newRate) !== Number(tutorDetail.approved_rate) && (
                <div style={{ fontSize: 12, color: '#92400E', background: '#FEF9C3', borderRadius: 8, padding: '6px 10px' }}>
                  New commission per 8-session package: ₱{(Number(newRate) * 8 * 0.10).toLocaleString()}
                </div>
              )}
            </div>

            {/* Documents */}
            <div style={{ marginBottom: 20 }}>
              <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>Documents</div>
              <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                {[
                  { label: 'NBI Clearance',      ok: !!tutorDetail.nbi_clearance_url },
                  { label: 'PRC License',         ok: !!tutorDetail.prc_license_url   },
                  { label: 'Medical Certificate', ok: !!tutorDetail.medical_cert_url  },
                  { label: 'Resume / CV',         ok: !!tutorDetail.resume_url        },
                ].map(doc => (
                  <Badge key={doc.label} variant={doc.ok ? 'success' : 'warning'}>
                    <Icon name={doc.ok ? 'check' : 'upload'} size={9} color={doc.ok ? '#065F46' : '#92400E'} />
                    {doc.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Ratings & Feedback */}
            <div>
              <div className="text-xs text-muted uppercase font-bold mb-10" style={{ letterSpacing: '0.5px' }}>
                Parent Ratings & Feedback ({tutorDetail.ratings.length})
              </div>
              {tutorDetail.ratings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: tokens.muted, fontSize: 13 }}>
                  No parent ratings yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tutorDetail.ratings.map((r, i) => {
                    const starLabel = r.star_rating === 5 ? 'Excellent'
                      : r.star_rating === 4 ? 'Good'
                      : r.star_rating === 3 ? 'Average'
                      : r.star_rating === 2 ? 'Below Average' : 'Poor';
                    const starBg    = r.star_rating >= 4 ? '#D1FAE5' : r.star_rating === 3 ? '#FEF3C7' : '#FEE2E2';
                    const starColor = r.star_rating >= 4 ? '#065F46' : r.star_rating === 3 ? '#92400E' : '#DC2626';
                    return (
                      <div key={r.id || i} style={{
                        background: '#F9FAFB', borderRadius: 10, padding: 14,
                        border: `1px solid ${tokens.border}`,
                      }}>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-8">
                            <StarDisplay value={r.star_rating} size={14} />
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: starBg, color: starColor }}>
                              {starLabel}
                            </span>
                          </div>
                          <span className="text-xs text-muted">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          </span>
                        </div>
                        {r.comment && (
                          <p style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.6, margin: '0 0 6px' }}>
                            "{r.comment}"
                          </p>
                        )}
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