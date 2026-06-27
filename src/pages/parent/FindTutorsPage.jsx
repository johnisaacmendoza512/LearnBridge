import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import Badge from '../../components/ui/Badge';
import FormGroup from '../../components/ui/FormGroup';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import Modal from '../../components/ui/Modal';
import { useTutors } from '../../hooks/useTutors';
import { useInquiries } from '../../hooks/useInquiries';
import { useBookings } from '../../hooks/useBookings';
import { supabase } from '../../lib/supabase';
import tokens from '../../lib/tokens';

// Shows tutor's real photo if available, otherwise falls back to letter avatar
function TutorAvatar({ name, avatarUrl, size = 48, colorIndex = 0 }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: `2px solid ${tokens.border}`,
        }}
      />
    );
  }
  return <Avatar name={name} size={size} colorIndex={colorIndex} />;
}

const PERF_LABEL = {
  good:             { label: 'Good',             stars: 5 },
  improving:        { label: 'Improving',        stars: 4 },
  needs_improvement:{ label: 'Needs Improvement',stars: 3 },
};

// Tutor is available as long as wallet balance is greater than 0
// Actual commission check happens when tutor clicks Accept in BookingsPage

function StarRating({ value, max = 5, size = 13 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{
          fontSize: size,
          color: i < Math.round(value) ? '#F59E0B' : '#D1D5DB',
        }}>★</span>
      ))}
    </span>
  );
}

export default function FindTutorsPage() {
  const navigate   = useNavigate();
  const { tutors, loading }    = useTutors();
  const { startInquiry }       = useInquiries();
  const { bookings }           = useBookings();

  const [subject,       setSubject]       = useState('');
  const [budget,        setBudget]        = useState('');
  const [gender,        setGender]        = useState('');
  const [inquiring,     setInquiring]     = useState(null);
  const [profileModal,  setProfileModal]  = useState(null); // tutor full profile modal
  const [ratingsMap,    setRatingsMap]    = useState({});
  const [loadingRatings, setLoadingRatings] = useState(false);

  // Fetch ratings and feedback from completed sessions
  useEffect(() => {
    if (!tutors.length) return;
    const fetchRatings = async () => {
      setLoadingRatings(true);
      const tutorIds = tutors.map(t => t.id);

      // Read real star ratings directly from tutor_ratings table
      const { data: ratingData } = await supabase
        .from('tutor_ratings')
        .select(`
          id, tutor_id, star_rating, comment, created_at,
          parent:parent_id ( full_name )
        `)
        .in('tutor_id', tutorIds)
        .order('created_at', { ascending: false });

      if (!ratingData?.length) { setLoadingRatings(false); return; }

      // Group by tutor
      const grouped = {};
      (ratingData || []).forEach(r => {
        if (!grouped[r.tutor_id]) grouped[r.tutor_id] = [];
        grouped[r.tutor_id].push(r);
      });

      // Calculate avg per tutor
      const map = {};
      Object.entries(grouped).forEach(([tutorId, ratings]) => {
        const avg = ratings.reduce((s, r) => s + r.star_rating, 0) / ratings.length;
        map[tutorId] = {
          avg:     Math.round(avg * 10) / 10,
          count:   ratings.length,
          reviews: ratings.slice(0, 5),
        };
      });

      setRatingsMap(map);
      setLoadingRatings(false);
    };

    fetchRatings();
  }, [tutors]);

  // Booking status per tutor
  const getBookingStatus = (tutorId) => {
    const b = bookings.find(b => b.tutor_id === tutorId);
    return b?.status || null;
  };
  const isOngoing = (tutorId) => ['pending','confirmed','pending_parent_confirm'].includes(getBookingStatus(tutorId));

  // Tutor is available if wallet balance > 0 (can cover at least some commission)
  const isAvailable = (tutor) => Number(tutor.wallet_balance || 0) > 0;

  // Filter tutors
  const filtered = tutors.filter(t => {
    if (subject && !(t.specialization || []).includes(subject)) return false;
    const rate = (t.approved_rate || t.rate_per_session || 0) * 8;
    if (budget && rate > parseInt(budget)) return false;
    if (gender && t.profile?.gender !== gender) return false;
    return true;
  });

  const handleInquire = async (tutor) => {
    setInquiring(tutor.id);
    try {
      await startInquiry({ tutorId: tutor.id, subject: subject || (tutor.specialization || [])[0] || '' });
      navigate('/messages', { state: { openTutorId: tutor.id } });
    } catch (e) { alert('Could not start inquiry: ' + e.message); }
    finally { setInquiring(null); }
  };

  if (loading) return <Spinner dark size={32} />;

  return (
    <div className="fade-in">
      <div className="mb-20">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Find a Tutor</h2>
        <p className="text-sm text-muted mt-4">
          Browse verified tutors. All prices shown are for the full <strong>8-session package</strong>.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-20 mb-20">
        <div className="flex items-center gap-8 mb-16">
          <Icon name="filter" size={15} color={tokens.primary} />
          <h3 className="font-jakarta font-bold" style={{ fontSize: 15 }}>Filter Tutors</h3>
        </div>
        <div className="grid-3">
          <FormGroup label="Subject">
            <select className="select" value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">All Subjects</option>
              <option value="english">English</option>
              <option value="mathematics">Mathematics</option>
            </select>
          </FormGroup>
          <FormGroup label="Max Budget (₱ for 8 sessions)">
            <input className="input" type="number" placeholder="e.g. 3200"
              value={budget} onChange={e => setBudget(e.target.value)} />
          </FormGroup>
          <FormGroup label="Gender Preference">
            <select className="select" value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">No Preference</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </FormGroup>
        </div>
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between mb-16">
        <h3 className="font-jakarta font-bold">
          {filtered.length} Tutor{filtered.length !== 1 ? 's' : ''} Found
        </h3>
        {filtered.length > 0 && (
          <Badge variant="success">
            <Icon name="check" size={10} color="#065F46" /> Verified & approved tutors only
          </Badge>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon="🔍" title="No tutors match your filters"
            description="Try widening your budget or removing filters." />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map((t, i) => {
            const rate        = t.approved_rate || t.rate_per_session || 0;
            const totalPrice  = rate * 8;
            const specs       = t.specialization || [];
            const certScores  = t.certification_scores || {};
            const rating      = ratingsMap[t.id];
            const ongoing     = isOngoing(t.id);
            const isInquiring = inquiring === t.id;
            const completed   = getBookingStatus(t.id) === 'completed';
            const available   = isAvailable(t); // wallet > 0

            return (
              <div key={t.id} className="card p-24">
                <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 20, alignItems: 'flex-start' }}>

                  {/* Avatar */}
                  <TutorAvatar name={t.profile?.full_name || 'T'} avatarUrl={t.profile?.avatar_url} size={56} colorIndex={i} />

                  {/* Info */}
                  <div>
                    {/* Name + badges — clickable to open full profile */}
                    <div className="flex items-center gap-10 mb-6" style={{ flexWrap: 'wrap' }}>
                      <h3
                        className="font-jakarta font-bold"
                        style={{ fontSize: 17, cursor: 'pointer', color: tokens.primary }}
                        onClick={() => setProfileModal(t)}
                      >
                        {t.profile?.full_name || 'Tutor'}
                      </h3>
                      <Badge variant="success">
                        <Icon name="shield" size={9} color="#065F46" /> Verified
                      </Badge>
                      {t.profile?.gender && <Badge variant="gray">{t.profile.gender}</Badge>}
                    </div>

                    {/* Rating */}
                    {rating ? (
                      <div className="flex items-center gap-8 mb-8">
                        <StarRating value={rating.avg} />
                        <span className="font-semibold" style={{ fontSize: 13, color: '#F59E0B' }}>
                          {rating.avg.toFixed(1)}
                        </span>
                        <span className="text-xs text-muted">
                          ({rating.count} review{rating.count !== 1 ? 's' : ''})
                        </span>
                        <button
                          onClick={() => setProfileModal(t)}
                          style={{
                            fontSize: 11, color: tokens.primary, background: 'none',
                            border: 'none', cursor: 'pointer', fontWeight: 600,
                            textDecoration: 'underline',
                          }}
                        >
                          View Profile
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-8 mb-8">
                        <span className="text-xs text-muted">No ratings yet</span>
                        <button
                          onClick={() => setProfileModal(t)}
                          style={{
                            fontSize: 11, color: tokens.primary, background: 'none',
                            border: 'none', cursor: 'pointer', fontWeight: 600,
                            textDecoration: 'underline',
                          }}
                        >
                          View Profile
                        </button>
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex gap-16 mb-8" style={{ flexWrap: 'wrap' }}>
                      {[
                        t.years_experience != null && `${t.years_experience} yr${t.years_experience !== 1 ? 's' : ''} experience`,
                        t.profile?.location,
                      ].filter(Boolean).map((d, j) => (
                        <span key={j} className="text-xs text-muted">{d}</span>
                      ))}
                    </div>

                    {/* Specializations */}
                    <div className="flex gap-6 mb-8" style={{ flexWrap: 'wrap' }}>
                      {specs.map(s => (
                        <span key={s} style={{
                          padding: '3px 10px', borderRadius: 20,
                          fontSize: 12, fontWeight: 600,
                          background: s === 'english' ? '#EFF6FF' : '#F0FDF4',
                          color:      s === 'english' ? '#1D4ED8' : '#15803D',
                          textTransform: 'capitalize',
                        }}>
                          {s}
                        </span>
                      ))}
                    </div>

                    {t.profile?.bio && (
                      <p className="text-sm text-muted mb-8" style={{ lineHeight: 1.6, maxWidth: 480 }}>
                        {t.profile.bio}
                      </p>
                    )}

                    {/* Cert scores */}
                    {Object.keys(certScores).length > 0 && (
                      <div className="flex gap-6" style={{ flexWrap: 'wrap' }}>
                        {Object.entries(certScores).map(([topic, score]) => (
                          <div key={topic} style={{
                            padding: '3px 10px', borderRadius: 20,
                            fontSize: 11, fontWeight: 700,
                            background: score >= 80 ? '#D1FAE5' : '#FEF3C7',
                            color:      score >= 80 ? '#065F46' : '#92400E',
                          }}>
                            {topic.replace(/_/g, ' ')}: {score}%
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Price + Button */}
                  <div style={{ textAlign: 'right', minWidth: 150 }}>
                    {/* Total price for 8 sessions */}
                    <div className="font-jakarta font-black" style={{ fontSize: 26, color: tokens.primary }}>
                      ₱{totalPrice.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted mb-2">for 8 sessions</div>
                    <div style={{
                      fontSize: 11, color: tokens.mid, marginBottom: 14,
                      background: '#F3F4F6', padding: '2px 8px', borderRadius: 6,
                      display: 'inline-block',
                    }}>
                      ₱{rate.toLocaleString()} / session
                    </div>

                    {!available ? (
                      /* Tutor wallet is empty — Not Available */
                      <div>
                        <button disabled style={{
                          width: '100%', padding: '9px 16px', borderRadius: 8, border: 'none',
                          background: '#F3F4F6', color: '#9CA3AF', fontSize: 13,
                          fontWeight: 700, cursor: 'not-allowed',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                          🚫 Not Available
                        </button>
                        <div style={{ fontSize: 10, color: tokens.muted, textAlign: 'center', marginTop: 5 }}>
                          Tutor temporarily unavailable
                        </div>
                      </div>
                    ) : ongoing ? (
                      /* Active booking — On-going */
                      <button disabled style={{
                        width: '100%', padding: '9px 16px', borderRadius: 8, border: 'none',
                        background: '#FEF9C3', color: '#CA8A04', fontSize: 13,
                        fontWeight: 700, cursor: 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        <Icon name="clock" size={13} color="#CA8A04" /> On-going
                      </button>
                    ) : (
                      /* Available — Inquire Now */
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleInquire(t)}
                        disabled={isInquiring}
                        style={{ width: '100%' }}
                      >
                        {isInquiring
                          ? 'Opening chat...'
                          : <><Icon name="message" size={13} /> Inquire Now</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Tutor Profile Modal */}
      <Modal
        open={!!profileModal}
        onClose={() => setProfileModal(null)}
        title="Tutor Profile"
        footer={
          <div className="flex gap-10" style={{ width: '100%' }}>
            <button className="btn btn-ghost btn-full" onClick={() => setProfileModal(null)}>
              Close
            </button>
            {profileModal && !isOngoing(profileModal.id) && isAvailable(profileModal) && (
              <button
                className="btn btn-primary btn-full"
                disabled={inquiring === profileModal.id}
                onClick={() => {
                  setProfileModal(null);
                  handleInquire(profileModal);
                }}
              >
                <Icon name="message" size={13} /> Inquire Now
              </button>
            )}
          </div>
        }
      >
        {profileModal && (() => {
          const t      = profileModal;
          const rating = ratingsMap[t.id];
          const rate   = t.approved_rate || t.rate_per_session || 0;
          const specs  = t.specialization || [];
          const cert   = t.certification_scores || {};
          const tutorAvailable = isAvailable(t);

          return (
            <div>
              {/* Not Available Banner */}
              {!tutorAvailable && (
                <div style={{
                  background: '#FEE2E2', border: '1px solid #FCA5A5',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                  fontSize: 13, color: '#DC2626', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  🚫 This tutor is currently not available for new bookings.
                  <span style={{ fontWeight: 400, fontSize: 12 }}>They need to top up their wallet before accepting students.</span>
                </div>
              )}
              {/* Header */}
              <div style={{
                background: `linear-gradient(135deg, ${tokens.primaryLight}, #EFF6FF)`,
                borderRadius: 14, padding: 20, marginBottom: 20,
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <TutorAvatar name={t.profile?.full_name || 'T'} avatarUrl={t.profile?.avatar_url} size={60} colorIndex={0} />
                <div style={{ flex: 1 }}>
                  <div className="font-jakarta font-extrabold" style={{ fontSize: 18 }}>
                    {t.profile?.full_name || 'Tutor'}
                  </div>
                  <div className="flex items-center gap-8 mt-4" style={{ flexWrap: 'wrap' }}>
                    <Badge variant="success"><Icon name="shield" size={9} color="#065F46" /> Verified</Badge>
                    {t.profile?.gender && <Badge variant="gray">{t.profile.gender}</Badge>}
                    {t.profile?.location && (
                      <span className="text-xs text-muted">📍 {t.profile.location}</span>
                    )}
                  </div>
                  {rating && (
                    <div className="flex items-center gap-6 mt-6">
                      <StarRating value={rating.avg} size={14} />
                      <span className="font-semibold" style={{ fontSize: 13, color: '#F59E0B' }}>
                        {rating.avg.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted">({rating.count} review{rating.count !== 1 ? 's' : ''})</span>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="font-jakarta font-black" style={{ fontSize: 22, color: tokens.primary }}>
                    ₱{(rate * 8).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted">for 8 sessions</div>
                  <div style={{ fontSize: 11, color: tokens.mid, marginTop: 2 }}>₱{rate.toLocaleString()}/session</div>
                </div>
              </div>

              {/* Bio */}
              {t.profile?.bio && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs font-bold text-muted uppercase mb-8" style={{ letterSpacing: '0.5px' }}>About</div>
                  <p style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.7, margin: 0 }}>{t.profile.bio}</p>
                </div>
              )}

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  ['Experience', `${t.years_experience || 0} year${t.years_experience !== 1 ? 's' : ''}`],
                  ['Location',   t.profile?.location || '—'],
                  ['Gender',     t.profile?.gender   || '—'],
                  ['Status',     'Verified & Approved'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                    <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                    <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Subjects */}
              {specs.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs font-bold text-muted uppercase mb-8" style={{ letterSpacing: '0.5px' }}>Subjects</div>
                  <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                    {specs.map(s => (
                      <span key={s} style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                        background: s === 'english' ? '#EFF6FF' : '#F0FDF4',
                        color:      s === 'english' ? '#1D4ED8' : '#15803D',
                        textTransform: 'capitalize',
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Certification Scores */}
              {Object.keys(cert).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs font-bold text-muted uppercase mb-8" style={{ letterSpacing: '0.5px' }}>
                    AI Certification Scores
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(cert).map(([topic, score]) => (
                      <div key={topic}>
                        <div className="flex items-center justify-between mb-4">
                          <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{topic.replace(/_/g, ' ')}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                            background: score >= 80 ? '#D1FAE5' : '#FEF3C7',
                            color:      score >= 80 ? '#065F46' : '#92400E',
                          }}>{score}%</span>
                        </div>
                        <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3, width: `${score}%`,
                            background: score >= 80 ? tokens.success : '#F59E0B',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Credentials */}
              <div style={{ marginBottom: 20 }}>
                <div className="text-xs font-bold text-muted uppercase mb-8" style={{ letterSpacing: '0.5px' }}>Credentials</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'NBI Clearance',       ok: !!t.nbi_clearance_url,  icon: '🪪' },
                    { label: 'PRC License',          ok: !!t.prc_license_url,    icon: '📄' },
                    { label: 'Medical Certificate',  ok: !!t.medical_cert_url,   icon: '🏥' },
                    { label: 'Resume / CV',          ok: !!t.resume_url,         icon: '📋' },
                  ].map(doc => (
                    <div key={doc.label} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 8,
                      background: doc.ok ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${doc.ok ? '#6EE7B7' : '#FCA5A5'}`,
                    }}>
                      <span style={{ fontSize: 16 }}>{doc.icon}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{doc.label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        background: doc.ok ? '#D1FAE5' : '#FEE2E2',
                        color:      doc.ok ? '#065F46' : '#DC2626',
                      }}>
                        {doc.ok ? '✓ Verified' : '✗ Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews */}
              <div>
                <div className="text-xs font-bold text-muted uppercase mb-8" style={{ letterSpacing: '0.5px' }}>
                  Parent Reviews {rating ? `(${rating.count})` : ''}
                </div>
                {!rating || rating.reviews.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '20px 0',
                    color: tokens.muted, fontSize: 13,
                  }}>
                    No reviews yet. Be the first to book this tutor!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {rating.reviews.map((r, i) => {
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
                              <StarRating value={r.star_rating} size={13} />
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
          );
        })()}
      </Modal>
    </div>
  );
}