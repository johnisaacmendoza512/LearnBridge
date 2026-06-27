import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDirectMessages } from '../../hooks/useDirectMessages';
import { supabase } from '../../lib/supabase';
import Avatar from '../../components/ui/Avatar';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const {
    threads, messages, activeUserId,
    loading, msgLoading,
    selectUser, sendMessage, refreshThreads,
  } = useDirectMessages();

  const [selectedUser,  setSelectedUser]  = useState(null);
  const [text,          setText]          = useState('');
  const [sending,       setSending]       = useState(false);
  const [search,        setSearch]        = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [showSearch,    setShowSearch]    = useState(false);

  // ── Scroll refs ───────────────────────────────────────────────────────
  const threadListRef  = useRef(null);  // left panel scroll
  const chatPanelRef   = useRef(null);  // chat scroll
  const chatBottomRef  = useRef(null);  // bottom anchor
  const searchRef      = useRef(null);

  // ── Show/hide scroll buttons ──────────────────────────────────────────
  const [showThreadScroll, setShowThreadScroll] = useState(false);
  const [showChatScroll,   setShowChatScroll]   = useState(false);

  // Keep selectedUser in sync when threads update
  useEffect(() => {
    if (activeUserId && threads.length > 0 && !selectedUser) {
      const found = threads.find(t => t.id === activeUserId);
      if (found) setSelectedUser(found);
    }
  }, [threads, activeUserId]); // eslint-disable-line

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Scroll listeners ──────────────────────────────────────────────────
  const handleThreadScroll = useCallback(() => {
    const el = threadListRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setShowThreadScroll(!atBottom);
  }, []);

  const handleChatScroll = useCallback(() => {
    const el = chatPanelRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setShowChatScroll(!atBottom);
  }, []);

  useEffect(() => {
    const el = threadListRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleThreadScroll);
    return () => el.removeEventListener('scroll', handleThreadScroll);
  }, [handleThreadScroll]);

  useEffect(() => {
    const el = chatPanelRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleChatScroll);
    return () => el.removeEventListener('scroll', handleChatScroll);
  }, [handleChatScroll]);

  // ── Close search dropdown when clicking outside ───────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
        setSearch('');
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Search users ──────────────────────────────────────────────────────
  const handleSearch = async (q) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .neq('role', 'admin')
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8);
    setSearchResults(data || []);
    setSearching(false);
  };

  // ── Select user ───────────────────────────────────────────────────────
  const handleSelectUser = (u) => {
    setSelectedUser(u);
    selectUser(u.id);
    setShowSearch(false);
    setSearch('');
    setSearchResults([]);
    refreshThreads();
  };

  const handleSelectThread = (t) => {
    setSelectedUser(t);
    selectUser(t.id);
  };

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim() || sending || !activeUserId) return;
    setSending(true);
    try {
      await sendMessage(text, activeUserId);
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

  // ── Scroll helpers ────────────────────────────────────────────────────
  const scrollThreadsToBottom = () => {
    threadListRef.current?.scrollTo({ top: threadListRef.current.scrollHeight, behavior: 'smooth' });
  };

  const scrollChatToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowChatScroll(false);
  };

  const ROLE_COLOR = { parent: '#3B82F6', tutor: '#10B981' };
  const ROLE_BG    = { parent: '#EFF6FF', tutor: '#ECFDF5' };

  return (
    <div className="fade-in">
      <div className="mb-20">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Messages</h2>
        <p className="text-sm text-muted mt-4">Direct messages between you and platform users.</p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '300px 1fr',
        height: 'calc(100vh - 180px)',
        borderRadius: 16, border: `1px solid ${tokens.border}`,
        overflow: 'hidden', background: '#fff',
        boxShadow: '0 2px 12px rgba(0,0,0,.06)',
      }}>

        {/* ══════════════════════════════════════════
             LEFT PANEL — independent scroll
        ══════════════════════════════════════════ */}
        <div style={{
          borderRight: `1px solid ${tokens.border}`,
          display: 'flex', flexDirection: 'column',
          background: '#FAFAFA',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Search bar — fixed at top */}
          <div style={{
            padding: '12px 14px',
            borderBottom: `1px solid ${tokens.border}`,
            background: '#fff',
            flexShrink: 0,
          }}>
            <div style={{ position: 'relative' }} ref={searchRef}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 10, top: '50%',
                  transform: 'translateY(-50%)', pointerEvents: 'none',
                }}>
                  <Icon name="search" size={14} color={tokens.muted} />
                </div>
                <input
                  className="input"
                  placeholder="Search users to message..."
                  value={search}
                  onChange={e => { setShowSearch(true); handleSearch(e.target.value); }}
                  onFocus={() => setShowSearch(true)}
                  style={{ paddingLeft: 32, background: '#F9FAFB', fontSize: 13 }}
                />
              </div>

              {/* Search dropdown */}
              {showSearch && (search.trim() || searchResults.length > 0) && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#fff', borderRadius: 10, marginTop: 4,
                  border: `1px solid ${tokens.border}`,
                  boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                  maxHeight: 260, overflowY: 'auto',
                }}>
                  {searching ? (
                    <div style={{ padding: 16, textAlign: 'center' }}>
                      <Spinner dark size={18} />
                    </div>
                  ) : searchResults.length === 0 && search.trim() ? (
                    <div style={{ padding: '12px 16px', fontSize: 13, color: tokens.muted }}>
                      No users found for "{search}"
                    </div>
                  ) : (
                    searchResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        style={{
                          width: '100%', padding: '10px 14px', border: 'none',
                          cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: 'transparent',
                          borderBottom: `1px solid ${tokens.border}`,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Avatar name={u.full_name || 'U'} size={32} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div className="font-semibold" style={{ fontSize: 13 }}>{u.full_name || '—'}</div>
                          <div className="text-xs text-muted truncate">{u.email}</div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px',
                          borderRadius: 4, textTransform: 'capitalize',
                          background: ROLE_BG[u.role]    || '#F3F4F6',
                          color:      ROLE_COLOR[u.role] || tokens.muted,
                        }}>
                          {u.role}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Thread list — independently scrollable */}
          <div
            ref={threadListRef}
            style={{ flex: 1, overflowY: 'auto' }}
          >
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center' }}><Spinner dark size={24} /></div>
            ) : threads.length === 0 ? (
              <div style={{ padding: 24 }}>
                <EmptyState
                  icon="💬"
                  title="No conversations yet"
                  description="Search for a user above to start a conversation."
                />
              </div>
            ) : (
              threads.map((t, i) => {
                const isActive = t.id === activeUserId;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectThread(t)}
                    style={{
                      width: '100%', padding: '13px 16px',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderBottom: `1px solid ${tokens.border}`,
                      background: isActive ? tokens.primaryLight : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div className="flex items-center gap-10">
                      <Avatar name={t.full_name || 'U'} size={38} colorIndex={i} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div className="font-semibold" style={{
                          fontSize: 13,
                          color: isActive ? tokens.primary : tokens.dark,
                        }}>
                          {t.full_name || '—'}
                        </div>
                        <div style={{ marginTop: 3 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: '1px 7px', borderRadius: 4,
                            textTransform: 'capitalize',
                            background: ROLE_BG[t.role]    || '#F3F4F6',
                            color:      ROLE_COLOR[t.role] || tokens.muted,
                          }}>
                            {t.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Thread list scroll-to-bottom button */}
          {showThreadScroll && (
            <button
              onClick={scrollThreadsToBottom}
              style={{
                position: 'absolute', bottom: 14,
                left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, width: 36, height: 36,
                borderRadius: '50%', background: tokens.primary,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(61,59,243,.35)',
              }}
              title="Scroll to bottom"
            >
              <Icon name="arrowDown" size={16} color="#fff" />
            </button>
          )}
        </div>

        {/* ══════════════════════════════════════════
             RIGHT PANEL — independent scroll chat
        ══════════════════════════════════════════ */}
        {selectedUser ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            background: '#fff', overflow: 'hidden', position: 'relative',
          }}>
            {/* Header — fixed */}
            <div style={{
              padding: '14px 20px', borderBottom: `1px solid ${tokens.border}`,
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fff', flexShrink: 0,
            }}>
              <Avatar name={selectedUser.full_name || 'U'} size={38} />
              <div>
                <div className="font-jakarta font-bold" style={{ fontSize: 15 }}>
                  {selectedUser.full_name || '—'}
                </div>
                <div style={{ marginTop: 3 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 4, textTransform: 'capitalize',
                    background: ROLE_BG[selectedUser.role]    || '#F3F4F6',
                    color:      ROLE_COLOR[selectedUser.role] || tokens.muted,
                  }}>
                    {selectedUser.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages — independently scrollable */}
            <div
              ref={chatPanelRef}
              style={{
                flex: 1, overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex', flexDirection: 'column', gap: 12,
                background: '#F9FAFB',
              }}
            >
              {msgLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spinner dark size={24} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
                    <p className="text-sm text-muted">
                      Start a conversation with {selectedUser.full_name?.split(' ')[0]}.
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
                      {!isMe && (
                        <Avatar
                          name={selectedUser.full_name || 'U'}
                          size={28}
                          style={{ marginRight: 8, flexShrink: 0, alignSelf: 'flex-end' }}
                        />
                      )}
                      <div style={{
                        maxWidth: '68%', padding: '10px 14px',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
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

            {/* Chat scroll-to-bottom button */}
            {showChatScroll && (
              <button
                onClick={scrollChatToBottom}
                style={{
                  position: 'absolute', bottom: 80, right: 24,
                  zIndex: 10, width: 38, height: 38,
                  borderRadius: '50%', background: tokens.primary,
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 12px rgba(61,59,243,.4)',
                }}
                title="Scroll to latest message"
              >
                <Icon name="arrowDown" size={16} color="#fff" />
              </button>
            )}

            {/* Input — fixed */}
            <div style={{
              padding: '12px 20px', background: '#fff',
              borderTop: `1px solid ${tokens.border}`,
              display: 'flex', gap: 10, alignItems: 'flex-end',
              flexShrink: 0,
            }}>
              <textarea
                className="input"
                placeholder={`Message ${selectedUser.full_name?.split(' ')[0] || 'user'}...`}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                style={{
                  flex: 1, resize: 'none', lineHeight: 1.5,
                  paddingTop: 10, paddingBottom: 10, maxHeight: 100,
                }}
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
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <p className="font-semibold" style={{ fontSize: 15, color: tokens.mid, marginBottom: 8 }}>
                Select a conversation
              </p>
              <p className="text-sm text-muted">Or search for a user above to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}