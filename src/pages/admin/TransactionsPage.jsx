import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import FormGroup from '../../components/ui/FormGroup';
import AppDialog from '../../components/ui/AppDialog';
import tokens from '../../lib/tokens';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: '#CA8A04', bg: '#FEF9C3' },
  approved: { label: 'Approved', color: '#16A34A', bg: '#D1FAE5' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEE2E2' },
};

export default function TransactionsPage() {
  const { user } = useAuth();
  const [requests,   setRequests]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('pending');
  const [selected,   setSelected]   = useState(null);
  const [adminNote,  setAdminNote]  = useState('');
  const [processing, setProcessing] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [dialog,     setDialog]     = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('wallet_topups')
      .select(`
        *,
        tutor:tutor_id ( id, full_name, email )
      `)
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const openRequest = async (req) => {
    setSelected(req);
    setAdminNote(req.admin_notes || '');
    setReceiptUrl(null);

    // Generate signed URL for receipt
    if (req.receipt_url) {
      try {
        let path = '';
        if (req.receipt_url.includes('wallet-receipts/')) {
          path = req.receipt_url.split('wallet-receipts/')[1];
        } else {
          path = `${req.tutor_id}/${req.receipt_url.split('/').pop()}`;
        }
        const { data } = await supabase.storage
          .from('wallet-receipts')
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) setReceiptUrl(data.signedUrl);
        else setReceiptUrl(req.receipt_url);
      } catch {
        setReceiptUrl(req.receipt_url);
      }
    }
  };

  const handleApprove = async () => {
    const tutorName = selected.tutor?.full_name;
    const amount    = Number(selected.amount).toLocaleString();
    setDialog({
      type: 'confirm',
      title: 'Approve Top-Up',
      message: `Credit ₱${amount} to ${tutorName}'s wallet?`,
      confirmLabel: 'Yes, Approve',
      onConfirm: async () => {
        setDialog(null);
        setProcessing(true);
        try {
          const { data: tutorData } = await supabase
            .from('tutors')
            .select('wallet_balance')
            .eq('id', selected.tutor_id)
            .single();

          const currentBalance = Number(tutorData?.wallet_balance || 0);
          const newBalance     = currentBalance + Number(selected.amount);

          await supabase.from('tutors')
            .update({ wallet_balance: newBalance })
            .eq('id', selected.tutor_id);

          await supabase.from('wallet_transactions').insert({
            tutor_id:      selected.tutor_id,
            type:          'topup',
            amount:        Number(selected.amount),
            balance_after: newBalance,
            description:   `Wallet Top-Up · GCash Ref: ${selected.reference_number}`,
            topup_id:      selected.id,
          });

          await supabase.from('wallet_topups').update({
            status:      'approved',
            admin_notes: adminNote || null,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          }).eq('id', selected.id);

          setSelected(null);
          await fetchRequests();
          setDialog({
            type: 'success',
            title: 'Top-Up Approved!',
            message: `₱${amount} has been credited to ${tutorName}'s wallet successfully.`,
          });
        } catch (e) {
          setDialog({ type: 'error', title: 'Error', message: e.message });
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  const handleReject = async () => {
    const tutorName = selected.tutor?.full_name;
    setDialog({
      type: 'confirm',
      title: 'Reject Request',
      message: `Reject this top-up request from ${tutorName}?`,
      confirmLabel: 'Yes, Reject',
      confirmDanger: true,
      onConfirm: async () => {
        setDialog(null);
        setProcessing(true);
        try {
          await supabase.from('wallet_topups').update({
            status:      'rejected',
            admin_notes: adminNote || null,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          }).eq('id', selected.id);
          setSelected(null);
          await fetchRequests();
          setDialog({
            type: 'error',
            title: 'Request Rejected',
            message: `The top-up request from ${tutorName} has been rejected.`,
          });
        } catch (e) {
          setDialog({ type: 'error', title: 'Error', message: e.message });
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Wallet Top-Up Requests</h2>
        <p className="text-sm text-muted mt-4">Review and approve tutor GCash wallet top-up requests.</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Pending',  count: requests.filter(r => r.status === 'pending').length,  color: '#CA8A04', bg: '#FEF9C3' },
          { label: 'Approved', count: requests.filter(r => r.status === 'approved').length, color: '#16A34A', bg: '#D1FAE5' },
          { label: 'Rejected', count: requests.filter(r => r.status === 'rejected').length, color: '#DC2626', bg: '#FEE2E2' },
        ].map(c => (
          <div key={c.label} className="card p-20 text-center">
            <div className="font-jakarta font-extrabold" style={{ fontSize: 32, color: c.color }}>{c.count}</div>
            <div className="text-sm text-muted">{c.label} Requests</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-8 mb-16">
        {['all', 'pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className="btn btn-sm" style={{
            background: filter === f ? tokens.primary : '#fff',
            color:      filter === f ? '#fff' : tokens.mid,
            border:     `1.5px solid ${filter === f ? tokens.primary : tokens.border}`,
            textTransform: 'capitalize',
          }}>
            {f} {f !== 'all' && `(${requests.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner dark size={28} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="💳" title="No requests found" description="Top-up requests will appear here." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tutor</th>
                <th>Amount</th>
                <th>Reference #</th>
                <th>Receipt</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-8">
                        <Avatar name={r.tutor?.full_name || 'T'} size={28} colorIndex={i} />
                        <div>
                          <div className="font-semibold" style={{ fontSize: 13 }}>{r.tutor?.full_name || '—'}</div>
                          <div className="text-xs text-muted">{r.tutor?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="font-semibold" style={{ fontSize: 14, color: tokens.success }}>
                      +₱{Number(r.amount).toLocaleString()}
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: tokens.mid }}>{r.reference_number}</td>
                    <td>
                      {r.receipt_url ? (
                        <span style={{ fontSize: 12, color: tokens.primary }}>📎 Attached</span>
                      ) : (
                        <span className="text-xs text-muted">No receipt</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: tokens.muted }}>
                      {new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm"
                        style={{ background: '#D1FAE5', color: '#065F46' }}
                        onClick={() => openRequest(r)}
                      >
                        <Icon name="eye" size={11} color="#065F46" /> Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 540,
            maxHeight: '90vh', overflowY: 'auto', padding: 36,
          }}>
            <div className="flex items-center justify-between mb-24">
              <h3 className="font-jakarta font-bold" style={{ fontSize: 18 }}>Review Top-Up Request</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: tokens.muted }}>×</button>
            </div>

            {/* Request details grid */}
            <div className="grid-2 mb-16">
              {[
                ['Tutor',      selected.tutor?.full_name || '—'],
                ['Email',      selected.tutor?.email     || '—'],
                ['Amount',     `₱${Number(selected.amount).toLocaleString()}`],
                ['Reference #',selected.reference_number],
                ['Submitted',  new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })],
                ['Status',     STATUS_CONFIG[selected.status]?.label || selected.status],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                  <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Receipt */}
            <div style={{ marginBottom: 16 }}>
              <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>Receipt</div>
              {receiptUrl ? (
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  <Icon name="eye" size={12} /> View Receipt
                </a>
              ) : (
                <span className="text-sm text-muted">No receipt uploaded</span>
              )}
            </div>

            {/* Admin notes */}
            <FormGroup label="Admin Notes" hint="Optional — visible to tutor if rejected.">
              <textarea
                className="textarea"
                placeholder="Reason for rejection or any notes..."
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
              />
            </FormGroup>

            {selected.status === 'pending' ? (
              <div className="flex gap-10 mt-4">
                <button className="btn btn-ghost btn-full" onClick={() => setSelected(null)} disabled={processing}>
                  Close
                </button>
                <button
                  className="btn btn-full"
                  style={{ background: '#FEE2E2', color: '#DC2626' }}
                  onClick={handleReject}
                  disabled={processing}
                >
                  <Icon name="x" size={13} color="#DC2626" /> Reject
                </button>
                <button
                  className="btn btn-primary btn-full"
                  onClick={handleApprove}
                  disabled={processing}
                >
                  {processing ? <Spinner /> : <><Icon name="check" size={13} /> Approve & Credit</>}
                </button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-full mt-4" onClick={() => setSelected(null)}>Close</button>
            )}
          </div>
        </div>
      )}

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