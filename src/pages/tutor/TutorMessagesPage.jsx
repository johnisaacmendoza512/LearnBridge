import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDirectMessages } from '../../hooks/useDirectMessages';
import Avatar from '../../components/ui/Avatar';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

export default function TutorMessagesPage() {
  const { user } = useAuth();

const {
  threads,       // all users who have messaged this tutor
  messages,      // messages for the active thread
  adminProfile,  // admin's profile
  loading,
  msgLoading,
  selectUser,
  sendMessage,
} = useDirectMessages();

  // 'admin' | user_id string
  const [activeThread, setActiveThread] = useState('admin');
  const [text,         setText]         = useState('');
  const [sending,      setSending]      = useState(false);

  // Scroll refs
  const leftPanelRef  = useRef(null);
  const chatPanelRef  = useRef(null);
  const chatBottomRef = useRef(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showChatScroll, setShowChatScroll] = useState(false);

  const isAdminThread = activeThread === 'admin';

  // ── Auto-select admin on mount ────────────────────────────────────────
  useEffect(() => {
    if (adminProfile?.id) {
      selectUser(adminProfile.id);
    }
  }, [adminProfile?.id]); // eslint-disable-line

  // ── Switch thread ─────────────────────────────────────────────────────
  const switchThread = (threadId) => {
    setActiveThread(threadId);
    const targetId = threadId === 'admin' ? adminProfile?.id : threadId;
    if (targetId) selectUser(targetId);
    setText('');
  };

  // ── Auto scroll to bottom ─────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Scroll listeners ──────────────────────────────────────────────────
  const handleLeftScroll = useCallback(() => {
    const el = leftPanelRef.current;
    if (!el) return;
    setShowLeftScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 40);
  }, []);

  const handleChatScroll = useCallback(() => {
    const el = chatPanelRef.current;
    if (!el) return;
    setShowChatScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 60);
  }, []);

  useEffect(() => {
    const el = leftPanelRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleLeftScroll);
    return () => el.removeEventListener('scroll', handleLeftScroll);
  }, [handleLeftScroll]);

  useEffect(() => {
    const el = chatPanelRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleChatScroll);
    return () => el.removeEventListener('scroll', handleChatScroll);
  }, [handleChatScroll]);

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const targetId = isAdminThread ? adminProfile?.id : activeThread;
      await sendMessage(text, targetId);
      setText('');
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Filter threads — exclude admin (shown separately pinned) ──────────
  const parentThreads = threads.filter(t => t.role !== 'admin');

  // ── Active thread info ────────────────────────────────────────────────
  const activeParentInfo = !isAdminThread
    ? threads.find(t => t.id === activeThread)
    : null;

  const chatHeaderName = isAdminThread
    ? 'LearnBridge Admin'
    : (activeParentInfo?.full_name || '—');

  const chatHeaderSub = isAdminThread
    ? 'Official support channel'
    : 'Parent inquiry';

  const ROLE_COLOR = { parent: '#3B82F6', tutor: '#10B981' };
  const ROLE_BG    = { parent: '#EFF6FF', tutor: '#ECFDF5' };

  return (
    <div className="fade-in">
      <div className="mb-20">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Messages</h2>
        <p className="text-sm text-muted mt-4">
          Chat with the admin team and parents who are interested in your services.
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '300px 1fr',
        height: 'calc(100vh - 180px)',
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
          <div ref={leftPanelRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* ── Admin Messages — pinned at top ── */}
            <div>
              <div style={{ padding: '16px 20px 10px' }}>
                <span className="font-jakarta font-bold" style={{ fontSize: 14, color: tokens.dark }}>
                  Admin Messages
                </span>
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
                    <img
                      src={require('../../assets/learnbridge-logo.png')}
                      alt="LearnBridge"
                      style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div className="font-semibold" style={{
                        fontSize: 13,
                        color: activeThread === 'admin' ? tokens.primary : tokens.dark,
                      }}>
                        LearnBridge Admin
                      </div>
                      <div className="text-xs text-muted truncate mt-1">
                        Official support channel
                      </div>
                    </div>
                    <Icon name="shield" size={13} color={tokens.primary} />
                  </div>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: tokens.border, margin: '0 14px' }} />

            {/* ── Parent Inquiries ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 20px 10px' }}>
                <span className="font-jakarta font-bold" style={{ fontSize: 14, color: tokens.dark }}>
                  Parent Inquiries
                </span>
              </div>
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loading ? (
                  <div style={{ padding: 20, textAlign: 'center' }}>
                    <Spinner dark size={20} />
                  </div>
                ) : parentThreads.length === 0 ? (
                  <div style={{
                    padding: '20px 16px', textAlign: 'center',
                    color: tokens.muted, fontSize: 12,
                    border: `1px dashed ${tokens.border}`, borderRadius: 10,
                  }}>
                    No parent inquiries yet.<br />
                    Parents will appear here when they send you a message.
                  </div>
                ) : (
                  parentThreads.map((t, i) => {
                    const isActive = activeThread === t.id;
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
                          <Avatar name={t.full_name || 'P'} size={34} colorIndex={i + 1} />
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="font-semibold" style={{
                              fontSize: 13,
                              color: isActive ? tokens.primary : tokens.dark,
                            }}>
                              {t.full_name || '—'}
                            </div>
                            <div style={{ marginTop: 3 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '1px 7px',
                                borderRadius: 4, textTransform: 'capitalize',
                                background: ROLE_BG[t.role]    || '#F3F4F6',
                                color:      ROLE_COLOR[t.role] || tokens.muted,
                              }}>
                                {t.role}
                              </span>
                            </div>
                          </div>
                          {/* Green dot = new/active */}
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: tokens.success, flexShrink: 0,
                          }} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Left scroll button */}
          {showLeftScroll && (
            <button
              onClick={() => leftPanelRef.current?.scrollTo({ top: leftPanelRef.current.scrollHeight, behavior: 'smooth' })}
              style={{
                position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, width: 36, height: 36, borderRadius: '50%', background: tokens.primary,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(61,59,243,.35)',
              }}
            >
              <Icon name="arrowDown" size={16} color="#fff" />
            </button>
          )}
        </div>

        {/* ══ RIGHT PANEL — Chat ══ */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: '#F9FAFB', overflow: 'hidden', position: 'relative',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 20px', borderBottom: `1px solid ${tokens.border}`,
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#fff', flexShrink: 0,
          }}>
            {isAdminThread ? (
              <img
                src={require('../../assets/learnbridge-logo.png')}
                alt="LearnBridge"
                style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0 }}
              />
            ) : (
              <Avatar name={chatHeaderName} size={38} />
            )}
            <div style={{ flex: 1 }}>
              <div className="font-jakarta font-bold" style={{ fontSize: 15 }}>{chatHeaderName}</div>
              <div className="text-xs text-muted">{chatHeaderSub}</div>
            </div>
            {isAdminThread && (
              <div style={{
                padding: '4px 10px', borderRadius: 6,
                background: '#D1FAE5', fontSize: 11, fontWeight: 700, color: '#065F46',
              }}>
                🔒 Secure
              </div>
            )}
          </div>

          {/* Messages */}
          <div ref={chatPanelRef} style={{
            flex: 1, overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {msgLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spinner dark size={24} />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>
                    {isAdminThread ? '🛡️' : '💬'}
                  </div>
                  <p className="text-sm text-muted">
                    {isAdminThread
                      ? 'Send a message to the LearnBridge admin team.'
                      : 'No messages yet in this conversation.'}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m, i) => {
                const isMe = m.sender_id === user?.id;
                return (
                  <div key={m.id || i} style={{
                    display: 'flex',
                    justifyContent: isMe ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      maxWidth: '65%', padding: '10px 14px',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isMe ? tokens.primary : '#fff',
                      color: isMe ? '#fff' : tokens.dark,
                      boxShadow: '0 1px 4px rgba(0,0,0,.08)',
                      fontSize: 14, lineHeight: 1.5,
                    }}>
                      {m.content}
                      <div style={{
                        fontSize: 10, marginTop: 4, textAlign: 'right',
                        color: isMe ? 'rgba(255,255,255,.6)' : tokens.muted,
                      }}>
                        {formatTime(m.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat scroll button */}
          {showChatScroll && (
            <button
              onClick={() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowChatScroll(false); }}
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

          {/* Input */}
          <div style={{
            padding: '12px 20px', background: '#fff',
            borderTop: `1px solid ${tokens.border}`,
            display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0,
          }}>
            <textarea
              className="input"
              placeholder={isAdminThread ? 'Message the admin team...' : `Reply to ${chatHeaderName.split(' ')[0]}...`}
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
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}