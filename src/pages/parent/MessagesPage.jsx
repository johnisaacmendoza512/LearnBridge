import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDirectMessages } from '../../hooks/useDirectMessages';
import { useStudents } from '../../hooks/useStudents';
import { useBookings } from '../../hooks/useBookings';
import { supabase } from '../../lib/supabase';
import Avatar from '../../components/ui/Avatar';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import FormGroup from '../../components/ui/FormGroup';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

export default function MessagesPage() {
  const { user }     = useAuth();
  const location     = useLocation();
  const navigate     = useNavigate();
  const { students } = useStudents();
  const { bookings, createBooking } = useBookings();

  const {
    threads, messages, adminProfile,
    msgLoading, selectUser, sendMessage, refreshThreads,
  } = useDirectMessages();

  const [inquiryMap,   setInquiryMap]   = useState({});
  const [cancelledIds, setCancelledIds] = useState(new Set());
  const [activeThread, setActiveThread] = useState('admin');
  const [text,         setText]         = useState('');
  const [sending,      setSending]      = useState(false);
  const [bookModal,    setBookModal]    = useState(false);
  const [bookForm,     setBookForm]     = useState({ student_id: '', session_mode: 'face-to-face', payment_method: 'cash', subject: '' });
  const [booking,      setBooking]      = useState(false);
  const [cancelling,   setCancelling]   = useState(false);

  const isAdminThread = activeThread === 'admin';

  const tutorThreads = threads.filter(t =>
    t.role !== 'admin' && !cancelledIds.has(t.id)
  );

  const fetchInquiries = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('inquiries')
      .select(`*, tutor:tutor_id ( id, full_name, approved_rate, rate_per_session )`)
      .eq('parent_id', user.id)
      .in('status', ['open', 'booked']);
    const map = {};
    (data || []).forEach(inq => { map[inq.tutor_id] = inq; });
    setInquiryMap(map);
  }, [user]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const leftRef   = useRef(null);
  const chatRef   = useRef(null);
  const bottomRef = useRef(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showChatScroll, setShowChatScroll] = useState(false);

  useEffect(() => {
    const openId = location.state?.openTutorId;
    if (openId) setTimeout(() => switchThread(openId), 200);
  }, [location.state?.openTutorId]); // eslint-disable-line

  useEffect(() => {
    if (adminProfile?.id) selectUser(adminProfile.id);
  }, [adminProfile?.id, selectUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const el = leftRef.current;
    if (!el) return;
    const fn = () => setShowLeftScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 40);
    el.addEventListener('scroll', fn);
    return () => el.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const fn = () => setShowChatScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 60);
    el.addEventListener('scroll', fn);
    return () => el.removeEventListener('scroll', fn);
  }, []);

  const switchThread = useCallback((threadId) => {
    setActiveThread(threadId);
    setText('');
    const targetId = threadId === 'admin' ? adminProfile?.id : threadId;
    if (targetId) selectUser(targetId);
  }, [adminProfile?.id, selectUser]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const targetId = isAdminThread ? adminProfile?.id : activeThread;
      if (!targetId) return;
      await sendMessage(text, targetId);
      setText('');
    } catch (e) { alert(e.message); }
    finally { setSending(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Cancel ────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!window.confirm('Cancel this inquiry? The conversation will be removed.')) return;
    setCancelling(true);
    const tutorId = activeThread;
    try {
      setCancelledIds(prev => new Set([...prev, tutorId]));
      setActiveThread('admin');
      if (adminProfile?.id) selectUser(adminProfile.id);

      await supabase
        .from('direct_messages')
        .delete()
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${tutorId}),` +
          `and(sender_id.eq.${tutorId},receiver_id.eq.${user.id})`
        );

      const inquiry = inquiryMap[tutorId];
      if (inquiry?.id) {
        await supabase.from('inquiries').update({ status: 'cancelled' }).eq('id', inquiry.id);
      }

      if (refreshThreads) refreshThreads();
      await fetchInquiries();
      navigate('/find-tutors');
    } catch (e) {
      setCancelledIds(prev => { const n = new Set(prev); n.delete(tutorId); return n; });
      alert(e.message);
    } finally {
      setCancelling(false);
    }
  };

  // ── Book Now ──────────────────────────────────────────────────────
  const handleConfirmBook = async () => {
    if (!bookForm.student_id) { alert('Please select a child.'); return; }
    if (!bookForm.subject)    { alert('Please select a subject for this booking.'); return; }
    const inquiry = inquiryMap[activeThread];
    const rate    = inquiry?.tutor?.approved_rate || inquiry?.tutor?.rate_per_session || 0;
    const subject = bookForm.subject;
    setBooking(true);
    try {
      await createBooking({
        tutor_id:          activeThread,
        student_id:        bookForm.student_id,
        subject,
        session_mode:      bookForm.session_mode,
        payment_method:    bookForm.payment_method,
        total_amount:      rate * 8,
        commission_amount: rate * 8 * 0.10,
      });
      if (inquiry?.id) {
        await supabase.from('inquiries')
          .update({ status: 'booked', student_id: bookForm.student_id })
          .eq('id', inquiry.id);
      }
      await sendMessage(
        `I've submitted a booking request for ${subject === 'both' ? 'English & Mathematics' : subject}! Please confirm the schedule. Looking forward to working with you! 📚`,
        activeThread
      );
      setBookModal(false);
      setBookForm({ student_id: '', session_mode: 'face-to-face', payment_method: 'cash', subject: '' });
      await fetchInquiries();
      navigate('/find-tutors', {
        state: { bookedMessage: 'Booking submitted! The tutor will confirm shortly.' }
      });
    } catch (e) { alert('Booking failed: ' + e.message); }
    finally { setBooking(false); }
  };

  // ── Active thread info ────────────────────────────────────────────
  const activeTutorInfo = !isAdminThread ? threads.find(t => t.id === activeThread) : null;

  // ── KEY FIX: exclude 'completed' so re-inquiry after completion shows buttons ──
  const hasBookingWithTutor = !isAdminThread && bookings.some(b =>
    b.tutor_id === activeThread &&
    !['cancelled', 'rejected', 'completed'].includes(b.status)
  );

  const showActionButtons = !isAdminThread
    && !hasBookingWithTutor
    && !cancelledIds.has(activeThread);

  const chatName = isAdminThread ? 'LearnBridge Admin' : (activeTutorInfo?.full_name || 'Tutor');
  const chatSub  = isAdminThread ? 'Official support channel'
    : hasBookingWithTutor ? 'Tutor · Booking submitted'
    : 'Tutor · Inquiring';

  return (
    <div className="fade-in">
      <div className="mb-20">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Messages</h2>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '340px 1fr',
        height: 'calc(100vh - 160px)',
        borderRadius: 16, border: `1px solid ${tokens.border}`,
        overflow: 'hidden', background: '#fff',
        boxShadow: '0 2px 12px rgba(0,0,0,.06)',
      }}>

        {/* ══ LEFT PANEL ══ */}
        <div style={{
          borderRight: `1px solid ${tokens.border}`,
          display: 'flex', flexDirection: 'column',
          background: '#fff', position: 'relative', overflow: 'hidden',
        }}>
          <div ref={leftRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            <div style={{ padding: '16px 20px 10px' }}>
              <span className="font-jakarta font-bold" style={{ fontSize: 14, color: tokens.dark }}>Admin Messages</span>
            </div>
            <div style={{ padding: '0 14px 16px' }}>
              <button
                onClick={() => switchThread('admin')}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  border: `1.5px solid ${activeThread === 'admin' ? tokens.primary : tokens.border}`,
                  borderRadius: 12, padding: 14,
                  background: activeThread === 'admin' ? tokens.primaryLight : '#FAFAFA',
                  transition: 'all 0.15s',
                }}
              >
                <div className="flex items-center gap-10">
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', background: tokens.primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>LB</span>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div className="font-semibold" style={{ fontSize: 13, color: activeThread === 'admin' ? tokens.primary : tokens.dark }}>
                      LearnBridge Admin
                    </div>
                    <div className="text-xs text-muted mt-1">Official support channel</div>
                  </div>
                  <Icon name="shield" size={13} color={tokens.primary} />
                </div>
              </button>
            </div>

            <div style={{ height: 1, background: tokens.border, margin: '0 14px' }} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 20px 10px' }}>
                <span className="font-jakarta font-bold" style={{ fontSize: 14, color: tokens.dark }}>Tutor Messages</span>
              </div>
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tutorThreads.length === 0 ? (
                  <div style={{
                    padding: '20px 16px', textAlign: 'center',
                    color: tokens.muted, fontSize: 12,
                    border: `1px dashed ${tokens.border}`, borderRadius: 10,
                  }}>
                    No tutor conversations yet.<br />
                    Click <strong>"Inquire Now"</strong> on a tutor to start chatting.
                  </div>
                ) : (
                  tutorThreads.map((t, i) => {
                    const isActive   = activeThread === t.id;
                    // Same fix here — exclude completed from "booked" label
                    const hasBooking = bookings.some(b =>
                      b.tutor_id === t.id && !['cancelled', 'rejected', 'completed'].includes(b.status)
                    );
                    return (
                      <button
                        key={t.id}
                        onClick={() => switchThread(t.id)}
                        style={{
                          width: '100%', textAlign: 'left', cursor: 'pointer',
                          border: `1.5px solid ${isActive ? tokens.primary : tokens.border}`,
                          borderRadius: 10, padding: '12px 14px',
                          background: isActive ? tokens.primaryLight : '#FAFAFA',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div className="flex items-center gap-10">
                          <Avatar name={t.full_name || 'T'} size={34} colorIndex={i + 1} />
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="font-semibold" style={{ fontSize: 13, color: isActive ? tokens.primary : tokens.dark }}>
                              {t.full_name || 'Tutor'}
                            </div>
                            <div className="text-xs text-muted truncate mt-1">
                              {hasBooking ? '📅 Booking submitted' : '💬 Inquiring'}
                            </div>
                          </div>
                          {!hasBooking && (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: tokens.success, flexShrink: 0 }} />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {showLeftScroll && (
            <button
              onClick={() => leftRef.current?.scrollTo({ top: leftRef.current.scrollHeight, behavior: 'smooth' })}
              style={{
                position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, width: 36, height: 36, borderRadius: '50%',
                background: tokens.primary, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(61,59,243,.35)',
              }}
            >
              <Icon name="arrowDown" size={16} color="#fff" />
            </button>
          )}
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: '#F9FAFB', overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            padding: '12px 20px', borderBottom: `1px solid ${tokens.border}`,
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#fff', flexShrink: 0,
          }}>
            {isAdminThread ? (
              <div style={{
                width: 38, height: 38, borderRadius: '50%', background: tokens.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>LB</span>
              </div>
            ) : (
              <Avatar name={chatName} size={38} />
            )}
            <div style={{ flex: 1 }}>
              <div className="font-jakarta font-bold" style={{ fontSize: 15 }}>{chatName}</div>
              <div className="text-xs text-muted">{chatSub}</div>
            </div>

            {showActionButtons && (
              <div className="flex gap-8">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setBookModal(true)}
                  style={{ fontSize: 12, padding: '7px 14px' }}
                >
                  <Icon name="check" size={12} /> Book Now
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleCancel}
                  disabled={cancelling}
                  style={{ fontSize: 12, padding: '7px 14px' }}
                >
                  <Icon name="x" size={12} /> {cancelling ? '...' : 'Cancel'}
                </button>
              </div>
            )}

            {!isAdminThread && hasBookingWithTutor && (
              <Badge variant="success">
                <Icon name="check" size={10} color="#065F46" /> Booked
              </Badge>
            )}

            {isAdminThread && (
              <div style={{
                padding: '4px 10px', borderRadius: 6,
                background: '#D1FAE5', fontSize: 11, fontWeight: 700, color: '#065F46',
              }}>
                🔒 Secure
              </div>
            )}
          </div>

          <div ref={chatRef} style={{
            flex: 1, overflowY: 'auto', padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {msgLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spinner dark size={24} />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>{isAdminThread ? '🛡️' : '💬'}</div>
                  <p className="text-sm text-muted">
                    {isAdminThread ? 'Send a message to the LearnBridge admin team.' : 'No messages yet. Say hello!'}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m, i) => {
                const isMe = m.sender_id === user?.id;
                return (
                  <div key={m.id || i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '65%', padding: '10px 14px',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isMe ? tokens.primary : '#fff',
                      color: isMe ? '#fff' : tokens.dark,
                      boxShadow: '0 1px 4px rgba(0,0,0,.08)',
                      fontSize: 14, lineHeight: 1.5,
                    }}>
                      {m.content}
                      <div style={{ fontSize: 10, marginTop: 4, textAlign: 'right', color: isMe ? 'rgba(255,255,255,.6)' : tokens.muted }}>
                        {formatTime(m.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {showChatScroll && (
            <button
              onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowChatScroll(false); }}
              style={{
                position: 'absolute', bottom: 80, right: 24, zIndex: 10,
                width: 38, height: 38, borderRadius: '50%', background: tokens.primary,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 12px rgba(61,59,243,.4)',
              }}
            >
              <Icon name="arrowDown" size={16} color="#fff" />
            </button>
          )}

          <div style={{
            padding: '12px 20px', background: '#fff',
            borderTop: `1px solid ${tokens.border}`,
            display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0,
          }}>
            <textarea
              className="input"
              placeholder={isAdminThread ? 'Message the admin team...' : 'Type a message... (Enter to send)'}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              style={{ flex: 1, resize: 'none', lineHeight: 1.5, paddingTop: 10, paddingBottom: 10, maxHeight: 100 }}
            />
            <button
              className="btn btn-primary btn-icon"
              onClick={handleSend}
              disabled={!text.trim() || sending}
              style={{ flexShrink: 0, width: 42, height: 42 }}
            >
              <Icon name="send" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Book Now Modal */}
      <Modal
        open={bookModal}
        onClose={() => setBookModal(false)}
        title={`Book ${chatName}`}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setBookModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirmBook} disabled={booking || !bookForm.student_id || !bookForm.subject}>
            <Icon name="check" size={13} /> {booking ? 'Booking...' : 'Confirm Booking'}
          </button>
        </>}
      >
        <div className="alert alert-info mb-16" style={{ fontSize: 13 }}>
          This sends a booking request to the tutor. They will confirm the details with you.
        </div>

        {/* Subject selection — required */}
        <div style={{ marginBottom: 20 }}>
          <label className="form-label">
            Subject to Tutor <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <p className="form-hint mb-10">What subject does your child need help with?</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { value: 'english',     label: '📖 English',              color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
              { value: 'mathematics', label: '🔢 Mathematics',           color: '#065F46', bg: '#F0FDF4', border: '#6EE7B7' },
              { value: 'both',        label: '📚 Both (English & Math)', color: '#7C3AED', bg: '#EDE9FE', border: '#C4B5FD' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBookForm(f => ({ ...f, subject: opt.value }))}
                style={{
                  flex: 1, minWidth: 120,
                  padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${bookForm.subject === opt.value ? opt.border : tokens.border}`,
                  background: bookForm.subject === opt.value ? opt.bg : '#FAFAFA',
                  color: bookForm.subject === opt.value ? opt.color : tokens.mid,
                  fontWeight: bookForm.subject === opt.value ? 700 : 500,
                  fontSize: 13, textAlign: 'center',
                  transition: 'all 0.15s',
                  transform: bookForm.subject === opt.value ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {!bookForm.subject && (
            <p style={{ fontSize: 12, color: '#DC2626', marginTop: 6 }}>
              Please select a subject to continue.
            </p>
          )}
        </div>
        <FormGroup label="Which child is this for?">
          <select className="select" value={bookForm.student_id}
            onChange={e => setBookForm(f => ({ ...f, student_id: e.target.value }))}>
            <option value="">Select a child</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name} (Grade {s.grade_level})</option>
            ))}
          </select>
          {students.length === 0 && (
            <p className="form-hint" style={{ color: tokens.danger }}>
              Please add a child profile first in My Children.
            </p>
          )}
        </FormGroup>
        <FormGroup label="Session Mode">
          <select className="select" value={bookForm.session_mode}
            onChange={e => setBookForm(f => ({ ...f, session_mode: e.target.value }))}>
            <option value="face-to-face">Face-to-Face</option>
            <option value="online">Online</option>
          </select>
        </FormGroup>
        <FormGroup label="Payment Method">
          <select className="select" value={bookForm.payment_method}
            onChange={e => setBookForm(f => ({ ...f, payment_method: e.target.value }))}>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </FormGroup>
      </Modal>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}