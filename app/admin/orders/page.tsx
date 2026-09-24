'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Receipt,
  User,
  Clock,
  ArrowRight,
  Trash2,
  Check,
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Utensils,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/ToastProvider'
import { formatCurrency, formatOrderNumber, formatDateTime } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'

const TABS = [
  { label: 'Pending',   statuses: ['pending'] },
  { label: 'Accepted',  statuses: ['accepted'] },
  { label: 'Completed', statuses: ['completed'] },
  { label: 'Rejected',  statuses: ['rejected'] },
  { label: 'All Orders', statuses: ['pending', 'accepted', 'completed', 'rejected'] },
]

export default function AdminOrdersPage() {
  const supabase   = createClient()
  const { success, error: showError } = useToast()
  const [orders,   setOrders]   = useState<any[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; order: any | null }>({
    open: false,
    order: null,
  })

  const loadOrders = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select(`*, profiles(name), order_items(product_name_snapshot, quantity, subtotal)`)
        .order('created_at', { ascending: false })
      setOrders(data ?? [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadOrders() }, [loadOrders])

  // Realtime subscription for new/updated orders
  useEffect(() => {
    let channel: any = null
    try {
      channel = supabase
        .channel('admin-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadOrders)
        .subscribe()
    } catch {
      // Realtime fallback
    }
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [supabase, loadOrders])

  const handleQuickAccept = async (orderId: string, orderNum: number) => {
    try {
      const { error } = await supabase.from('orders').update({ status: 'accepted' }).eq('id', orderId)
      if (error) throw error
      success(`Order #${formatOrderNumber(orderNum)} accepted!`)
      loadOrders()
    } catch (err: any) {
      showError(err.message ?? 'Failed to accept order')
    }
  }

  const handleDeleteOrder = async () => {
    if (!deleteDialog.order) return
    try {
      await supabase.from('order_items').delete().eq('order_id', deleteDialog.order.id)
      const { error } = await supabase.from('orders').delete().eq('id', deleteDialog.order.id)
      if (error) throw error
      success(`Order ${formatOrderNumber(deleteDialog.order.order_number)} deleted`)
      setDeleteDialog({ open: false, order: null })
      loadOrders()
    } catch (err: any) {
      showError(err.message ?? 'Failed to delete order')
    }
  }

  const filtered = orders.filter((o) => TABS[activeTab].statuses.includes(o.status))
  const pendingCount = orders.filter((o) => o.status === 'pending').length

  return (
    <div className="admin-content">
      {/* ─── Page Header ────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">Order Management</h1>
            <span className="live-dot" />
          </div>
          <p className="page-subtitle">Track, accept, and dispatch live dining room & takeaway orders</p>
        </div>

        {pendingCount > 0 && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(250, 229, 93, 0.16)',
              border: '1.5px solid rgba(250, 229, 93, 0.4)',
              color: 'var(--brand-yellow-dark)',
              fontWeight: 700,
              fontSize: '0.875rem',
            }}
          >
            <Clock size={16} style={{ color: 'var(--brand-red)' }} />
            <span>{pendingCount} order{pendingCount > 1 ? 's' : ''} awaiting approval</span>
          </div>
        )}
      </div>

      {/* ─── Filter Tabs ─────────────────────────────────────────── */}
      <div className="tab-bar" style={{ marginBottom: 'var(--space-lg)' }}>
        {TABS.map((tab, i) => {
          const count = orders.filter((o) =>
            tab.statuses.includes(o.status)
          ).length
          const isActive = activeTab === i
          return (
            <button
              key={tab.label}
              className={`tab-item${isActive ? ' active' : ''}`}
              onClick={() => setActiveTab(i)}
              style={
                isActive
                  ? {
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      borderBottom: '2px solid var(--brand-red)',
                    }
                  : {}
              }
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    background: isActive ? 'var(--brand-red)' : 'var(--bg-elevated)',
                    color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                    borderRadius: 'var(--radius-full)',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ─── Order Cards Grid / List ─────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 130, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 'var(--space-2xl) var(--space-md)' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--primary-muted)',
                color: 'var(--brand-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-sm)',
              }}
            >
              <Receipt size={28} />
            </div>
            <div className="empty-state-title" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
              No {TABS[activeTab].label.toLowerCase()} orders found
            </div>
            <div className="empty-state-desc">
              When new tickets are taken by waitstaff, they will appear here live with audio & visual prompts.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {filtered.map((order) => {
            const isPending = order.status === 'pending'
            const isAccepted = order.status === 'accepted'
            const isCompleted = order.status === 'completed'

            return (
              <div
                key={order.id}
                className={`order-card ${order.status}`}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '18px 20px',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
                }}
              >
                {/* Header row */}
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: 'var(--space-sm)', flexWrap: 'wrap', gap: 8 }}
                >
                  <div className="flex items-center gap-sm">
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '1.125rem',
                        fontFamily: 'monospace',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {formatOrderNumber(order.order_number)}
                    </span>
                    <StatusBadge status={order.status} />

                    {order.table_number && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(250, 229, 93, 0.15)',
                          color: 'var(--brand-yellow-dark)',
                          border: '1px solid rgba(250, 229, 93, 0.3)',
                        }}
                      >
                        <LayoutGrid size={12} />
                        <span>Table {order.table_number}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-xs">
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} />
                      <span>{formatDateTime(order.created_at)}</span>
                    </span>
                  </div>
                </div>

                {/* Waiter info & order items snapshot */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    padding: '10px 0',
                    borderTop: '1px dashed var(--border)',
                    borderBottom: '1px dashed var(--border)',
                    margin: '8px 0 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <User size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>Server: <strong>{order.profiles?.name ?? 'Assigned Waiter'}</strong></span>
                    </span>

                    {order.payment_method && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                        }}
                      >
                        • Paid via {order.payment_method}
                      </span>
                    )}
                  </div>

                  {/* Summary of items */}
                  {order.order_items && order.order_items.length > 0 && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      <Utensils size={13} style={{ display: 'inline', marginRight: 5, color: 'var(--brand-red)' }} />
                      <span>
                        {order.order_items
                          .map((it: any) => `${it.quantity}x ${it.product_name_snapshot}`)
                          .slice(0, 3)
                          .join(', ')}
                        {order.order_items.length > 3 ? ` +${order.order_items.length - 3} more` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {order.notes && (
                  <div className="order-notes" style={{ marginBottom: 12 }}>
                    Special Instructions: <em>{order.notes}</em>
                  </div>
                )}

                {/* Footer action bar */}
                <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      Ticket Total
                    </span>
                    <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {formatCurrency(order.total)}
                    </span>
                  </div>

                  <div className="flex items-center gap-sm">
                    {/* Quick Accept */}
                    {isPending && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleQuickAccept(order.id, order.order_number)}
                        style={{
                          background: 'var(--brand-yellow)',
                          color: '#111111',
                          fontWeight: 700,
                          border: 'none',
                        }}
                      >
                        <Check size={14} />
                        <span>Accept Ticket</span>
                      </button>
                    )}

                    {/* View Details button */}
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span>{isCompleted ? 'View Invoice' : 'Manage Ticket'}</span>
                      <ArrowRight size={14} />
                    </Link>

                    {/* Delete button */}
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => setDeleteDialog({ open: true, order })}
                      title="Delete Order"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, order: null })}
        onConfirm={handleDeleteOrder}
        title="Delete Order Record"
        message={`Are you sure you want to permanently delete order ${
          deleteDialog.order ? formatOrderNumber(deleteDialog.order.order_number) : ''
        }? This action will remove its line items.`}
        confirmLabel="Delete Order"
      />
    </div>
  )
}
