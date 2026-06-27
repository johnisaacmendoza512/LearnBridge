import { useState } from 'react';
import { useQuestions } from '../../hooks/useQuestions';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const DIFF_VARIANT = { easy: 'success', medium: 'warning', hard: 'danger' };

export default function QuestionBankAdminPage() {
  const { questions, loading, error, updateStatus, deleteQuestion, refresh } = useQuestions();

  const [filter,   setFilter]   = useState('pending');
  const [selected, setSelected] = useState(null);
  const [saving,   setSaving]   = useState(false);

  const counts = { all: questions.length, pending: 0, approved: 0, rejected: 0 };
  questions.forEach(q => { if (counts[q.status] !== undefined) counts[q.status]++; });
  const filtered = filter === 'all' ? questions : questions.filter(q => q.status === filter);

  const handleStatus = async (id, status) => {
    setSaving(true);
    try {
      await updateStatus(id, status);
      setSelected(null);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this question?')) return;
    setSaving(true);
    try {
      await deleteQuestion(id);
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
      <div className="flex items-center justify-between mb-24">
        <div>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Question Bank — Admin Review</h2>
          <p className="text-sm text-muted mt-4">
            Approve or reject tutor-contributed questions before they enter student assessments.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="font-jakarta font-black" style={{ fontSize: 28, color: tokens.primary }}>
            {counts.pending}
          </div>
          <div className="text-xs text-muted">awaiting review</div>
        </div>
      </div>

      {/* Filter tabs */}
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

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="📝"
            title={`No ${filter === 'all' ? '' : filter} questions`}
            description="Questions contributed by tutors will appear here for admin review."
          />
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Subject</th>
                <th>Topic</th>
                <th>Difficulty</th>
                <th>Contributor</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => (
                <tr key={q.id}>
                  <td
                    style={{ maxWidth: 280, fontSize: 13, cursor: 'pointer' }}
                    className="truncate"
                    onClick={() => setSelected(q)}
                    title={q.question_text}
                  >
                    {q.question_text}
                  </td>
                  <td>
                    <Badge variant="info" style={{ textTransform: 'capitalize' }}>{q.subject}</Badge>
                  </td>
                  <td style={{ fontSize: 13 }}>{q.topic}</td>
                  <td>
                    <Badge variant={DIFF_VARIANT[q.difficulty] || 'gray'}>{q.difficulty}</Badge>
                  </td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>
                    {q.contributor?.full_name || '—'}
                  </td>
                  <td style={{ fontSize: 12, color: tokens.muted }}>{formatDate(q.created_at)}</td>
                  <td>
                    <Badge variant={
                      q.status === 'approved' ? 'success' :
                      q.status === 'rejected' ? 'danger'  : 'warning'
                    }>
                      {q.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex gap-6">
                      <button
                        className="btn btn-sm"
                        style={{ background: '#D1FAE5', color: '#065F46', padding: '4px 10px' }}
                        onClick={() => setSelected(q)}
                        title="View details"
                      >
                        <Icon name="eye" size={11} color="#065F46" />
                      </button>
                      {q.status !== 'approved' && (
                        <button
                          className="btn btn-success btn-sm"
                          style={{ padding: '4px 10px' }}
                          onClick={() => handleStatus(q.id, 'approved')}
                          disabled={saving}
                          title="Approve"
                        >
                          <Icon name="check" size={11} />
                        </button>
                      )}
                      {q.status !== 'rejected' && (
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 10px' }}
                          onClick={() => handleStatus(q.id, 'rejected')}
                          disabled={saving}
                          title="Reject"
                        >
                          <Icon name="x" size={11} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Question Detail Modal ── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Question Details"
        footer={
          <div className="flex gap-8">
            {selected?.status !== 'approved' && (
              <button
                className="btn btn-success"
                onClick={() => handleStatus(selected.id, 'approved')}
                disabled={saving}
              >
                <Icon name="check" size={13} /> {saving ? '...' : 'Approve'}
              </button>
            )}
            {selected?.status !== 'rejected' && (
              <button
                className="btn btn-danger"
                onClick={() => handleStatus(selected.id, 'rejected')}
                disabled={saving}
              >
                <Icon name="x" size={13} /> {saving ? '...' : 'Reject'}
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ marginLeft: 'auto' }}
              onClick={() => handleDelete(selected?.id)}
              disabled={saving}
            >
              Delete
            </button>
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
        }
      >
        {selected && (
          <div>
            <div className="grid-2 mb-16">
              {[
                ['Subject',     selected.subject],
                ['Topic',       selected.topic],
                ['Difficulty',  selected.difficulty],
                ['Status',      selected.status],
                ['Contributor', selected.contributor?.full_name || '—'],
                ['Submitted',   formatDate(selected.created_at)],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                  <div className="text-xs text-muted mb-4 uppercase font-bold" style={{ letterSpacing: '0.5px' }}>{k}</div>
                  <div className="font-semibold" style={{ fontSize: 13, textTransform: 'capitalize' }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="mb-16">
              <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>
                Question
              </div>
              <p style={{ fontSize: 14, color: tokens.dark, lineHeight: 1.6, fontWeight: 500 }}>
                {selected.question_text}
              </p>
            </div>

            {selected.options && (
              <div className="mb-16">
                <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>
                  Answer Options
                </div>
                {Object.entries(selected.options).map(([key, val]) => val && (
                  <div
                    key={key}
                    style={{
                      padding: '8px 12px', borderRadius: 8, marginBottom: 6, fontSize: 13,
                      background: key === selected.correct_answer ? '#D1FAE5' : '#F9FAFB',
                      border: `1px solid ${key === selected.correct_answer ? '#6EE7B7' : tokens.border}`,
                      color: key === selected.correct_answer ? '#065F46' : tokens.dark,
                      fontWeight: key === selected.correct_answer ? 700 : 400,
                    }}
                  >
                    <span style={{ fontWeight: 700, marginRight: 8 }}>
                      {key.toUpperCase()}.
                    </span>
                    {val}
                    {key === selected.correct_answer && (
                      <span style={{ marginLeft: 8, fontSize: 11 }}>✓ Correct</span>
                    )}
                  </div>
                ))}
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