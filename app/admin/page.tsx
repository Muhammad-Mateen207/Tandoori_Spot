import type { Metadata } from 'next'
import Link from 'next/link'
import {
  DollarSign,
  ShoppingBag,
  Clock,
  Receipt,
  AlertTriangle,
  Users,
  CheckCircle2,
  ArrowRight,
  User,
  LayoutGrid,
  CheckCheck,
  Flame,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatOrderNumber } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { FEATURED_SPECIALTIES } from '@/lib/food-images'

export const metadata: Metadata = {
  title: 'Operations Dashboard — Tandoori Stop',
}

// Disable caching so dashboard always reflects live data
export const dynamic = 'force-dynamic'

async function getDashboardData() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00.000Z`
  const todayEnd = `${today}T23:59:59.999Z`

  try {
    const [
      { data: completedOrders },
      { data: pendingOrders },
      { data: expenses },
      { data: lowStockItems },
      { data: activeEmployees },
      { data: recentOrders },
    ] = await Promise.all([
      // Today's completed orders
      supabase
        .from('orders')
        .select('total')
        .eq('status', 'completed')
        .gte('completed_at', todayStart)
        .lte('completed_at', todayEnd),

      // Pending & accepted orders
      supabase
        .from('orders')
        .select('id, order_number, status, total, notes, table_number, created_at, profiles(name)')
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: true }),

      // Today's expenses
      supabase
        .from('expenses')
        .select('amount')
        .eq('date', today),

      // Low stock items
      supabase
        .from('inventory_items')
        .select('id, name, current_quantity, minimum_quantity, unit')
        .eq('is_active', true)
        .filter('current_quantity', 'lte', 'minimum_quantity'),

      // Active employees (employees with shifts scheduled today)
      supabase
        .from('shifts')
        .select('employee_id')
        .eq('date', today)
        .eq('status', 'scheduled'),

      // Recent incoming orders for dashboard
      supabase
        .from('orders')
        .select(`
          id, order_number, status, total, notes, table_number, created_at,
          profiles(name),
          order_items(product_name_snapshot, quantity, unit_price_snapshot, subtotal)
        `)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const todaySales = completedOrders?.reduce((sum, o) => sum + o.total, 0) ?? 0
    const todayExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0
    const completedCount = completedOrders?.length ?? 0
    const pendingCount = pendingOrders?.filter((o) => o.status === 'pending').length ?? 0
    const lowStockCount = lowStockItems?.length ?? 0
    const activeStaff = new Set(activeEmployees?.map((s) => s.employee_id)).size

    return {
      todaySales,
      todayExpenses,
      completedCount,
      pendingCount,
      lowStockCount,
      activeStaff,
      recentOrders: recentOrders ?? [],
      lowStockItems: lowStockItems ?? [],
    }
  } catch {
    return {
      todaySales: 0,
      todayExpenses: 0,
      completedCount: 0,
      pendingCount: 0,
      lowStockCount: 0,
      activeStaff: 0,
      recentOrders: [],
      lowStockItems: [],
    }
  }
}

export default async function AdminDashboard() {
  const data = await getDashboardData()

  const stats = [
    {
      label: "Today's Revenue",
      value: formatCurrency(data.todaySales),
      icon: DollarSign,
      iconColor: 'var(--brand-red)',
      id: 'stat-sales',
      trend: '+12% vs last week',
    },
    {
      label: "Today's Orders",
      value: data.completedCount,
      icon: ShoppingBag,
      iconColor: 'var(--success)',
      id: 'stat-orders',
      trend: `${data.completedCount} completed`,
    },
    {
      label: 'Pending Orders',
      value: data.pendingCount,
      icon: Clock,
      iconColor: data.pendingCount > 0 ? 'var(--brand-yellow)' : 'var(--text-muted)',
      id: 'stat-pending',
      highlight: data.pendingCount > 0,
      trend: data.pendingCount > 0 ? 'Requires attention' : 'All clear',
    },
    {
      label: "Today's Expenses",
      value: formatCurrency(data.todayExpenses),
      icon: Receipt,
      iconColor: 'var(--danger)',
      id: 'stat-expenses',
      trend: 'Operating costs',
    },
    {
      label: 'Low Stock Alerts',
      value: data.lowStockCount,
      icon: AlertTriangle,
      iconColor: data.lowStockCount > 0 ? 'var(--brand-yellow)' : 'var(--text-muted)',
      id: 'stat-low-stock',
      highlight: data.lowStockCount > 0,
      trend: data.lowStockCount > 0 ? 'Items below minimum' : 'Stock healthy',
    },
    {
      label: 'Active Staff',
      value: data.activeStaff,
      icon: Users,
      iconColor: 'var(--info)',
      id: 'stat-staff',
      trend: 'On shift today',
    },
  ]

  return (
    <div className="admin-content">
      {/* ─── Hero Welcome Banner ─────────────────────────────────── */}
      <div
        className="brand-hero-card"
        style={{
          padding: '24px 28px',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(250, 229, 93, 0.15)',
                border: '1px solid rgba(250, 229, 93, 0.3)',
                borderRadius: '9999px',
                padding: '2px 10px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#FAE55D',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <Flame size={12} style={{ color: 'var(--brand-red)' }} />
              <span>Tandoori Stop Operations</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#9CA3AF' }}>
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              <span>Live POS Sync</span>
            </div>
          </div>

          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
              marginBottom: 4,
            }}
          >
            Restaurant Management Overview
          </h1>
          <p style={{ color: '#D1D5DB', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {new Date().toLocaleDateString('en-PK', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}{' '}
            — Real-time table orders, kitchen tickets, and financial summary.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 10 }}>
          <Link
            href="/admin/orders"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}
          >
            <Clock size={15} />
            <span>Manage Orders</span>
          </Link>
          <Link
            href="/admin/products"
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.8125rem',
              background: 'rgba(255,255,255,0.08)',
              borderColor: 'rgba(255,255,255,0.15)',
              color: '#FFFFFF',
            }}
          >
            <Sparkles size={15} style={{ color: 'var(--brand-yellow)' }} />
            <span>Menu & Specialties</span>
          </Link>
        </div>
      </div>

      {/* ─── Stat Metric Cards ───────────────────────────────────── */}
      <div className="grid-3" style={{ marginBottom: 'var(--space-lg)' }}>
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.id}
              id={stat.id}
              className="stat-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-md) var(--space-lg)',
                ...(stat.highlight
                  ? { borderColor: 'var(--brand-yellow)', boxShadow: '0 0 16px rgba(250, 229, 93, 0.15)' }
                  : {}),
              }}
            >
              <div>
                <div className="stat-label" style={{ marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div className="stat-value">{stat.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={12} style={{ color: stat.iconColor }} />
                  <span>{stat.trend}</span>
                </div>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: stat.iconColor,
                  flexShrink: 0,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Icon size={24} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ─── Featured Specialties Banner ─────────────────────────── */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-sm)' }}>
          <div className="flex items-center gap-xs">
            <Flame size={18} style={{ color: 'var(--brand-red)' }} />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Signature Tandoori Specialties</h2>
          </div>
          <Link
            href="/admin/products"
            style={{ fontSize: '0.8125rem', color: 'var(--brand-red)', fontWeight: 600, textDecoration: 'none' }}
          >
            View Menu Catalog →
          </Link>
        </div>

        <div className="grid-3">
          {FEATURED_SPECIALTIES.map((spec) => (
            <div
              key={spec.name}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: 14,
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: '#1A1A1A',
                }}
              >
                <img
                  src={spec.image}
                  alt={spec.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: 'var(--brand-red)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'block',
                  }}
                >
                  {spec.category}
                </span>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.2,
                  }}
                  title={spec.name}
                >
                  {spec.name}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.4,
                  }}
                  title={spec.description}
                >
                  {spec.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Main Grid: Incoming Orders & Low Stock ───────────────── */}
      <div className="admin-dashboard-grid">
        {/* Incoming Orders */}
        <div>
          <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--space-md)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Active Kitchen & Table Orders</h2>
            <span className="live-dot" />
            {data.recentOrders.length > 0 && (
              <span className="badge badge-warning">{data.recentOrders.length} active</span>
            )}
          </div>

          {data.recentOrders.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: 'var(--space-2xl) var(--space-md)' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'var(--primary-muted)',
                    color: 'var(--brand-red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--space-sm)',
                    boxShadow: 'var(--shadow-glow)',
                  }}
                >
                  <CheckCircle2 size={26} />
                </div>
                <div className="empty-state-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  Kitchen Queue All Caught Up
                </div>
                <div className="empty-state-desc">
                  Incoming dining & takeaway orders will appear here in real time.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {data.recentOrders.map((order: any) => (
                <div key={order.id} className={`order-card ${order.status}`}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-sm)' }}>
                    <div className="flex items-center gap-sm">
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {formatOrderNumber(order.order_number)}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem' }}
                    >
                      <span>View Ticket</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>

                  <div className="flex gap-md text-sm text-secondary" style={{ marginBottom: 'var(--space-sm)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <User size={14} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontWeight: 500 }}>{order.profiles?.name ?? 'Waiter'}</span>
                    </span>
                    {order.table_number && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <LayoutGrid size={14} style={{ color: 'var(--brand-yellow)' }} />
                        <span style={{ fontWeight: 600 }}>Table {order.table_number}</span>
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>
                        {new Date(order.created_at).toLocaleTimeString('en-PK', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>
                  </div>

                  {order.notes && (
                    <div className="order-notes" style={{ marginBottom: 'var(--space-sm)' }}>
                      Note: {order.notes}
                    </div>
                  )}

                  <div
                    className="flex items-center justify-between"
                    style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-sm)' }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                        Total Amount
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                        {formatCurrency(order.total)}
                      </span>
                    </div>

                    <div className="flex gap-sm">
                      {order.status === 'pending' && (
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="btn btn-sm"
                          style={{
                            background: 'var(--brand-yellow)',
                            color: '#111111',
                            fontWeight: 700,
                            border: 'none',
                          }}
                        >
                          Accept Order
                        </Link>
                      )}
                      {(order.status === 'pending' || order.status === 'accepted') && (
                        <Link href={`/admin/orders/${order.id}`} className="btn btn-primary btn-sm">
                          Complete Order
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Sidebar */}
        <div>
          <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--space-md)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--brand-yellow)' }} />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Ingredient Stock Alerts</h2>
          </div>

          {data.lowStockItems.length === 0 ? (
            <div className="card card-sm">
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-lg)',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCheck size={26} style={{ color: 'var(--success)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>All Stock Levels Healthy</span>
                <span style={{ fontSize: '0.75rem' }}>No ingredients below safety threshold</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {data.lowStockItems.map((item: any) => (
                <div
                  key={item.id}
                  className="card card-sm"
                  style={{
                    borderColor: 'rgba(250, 229, 93, 0.4)',
                    background: 'var(--surface-hover)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 2, color: 'var(--text-primary)' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 700 }}>
                    {item.current_quantity} {item.unit} remaining
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Safety minimum: {item.minimum_quantity} {item.unit}
                  </div>
                </div>
              ))}
              <Link
                href="/admin/inventory"
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'center', marginTop: 4, display: 'block' }}
              >
                Manage Inventory & Supplies →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
