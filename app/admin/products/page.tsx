'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/ToastProvider'
import { formatCurrency } from '@/lib/utils'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/FormFields'
import { Plus, Search, UtensilsCrossed, Trash2, Edit2, Flame, Eye, EyeOff, Sparkles } from 'lucide-react'
import { getProductImage } from '@/lib/food-images'
import type { Product, ProductCategory } from '@/types/database'

const EMPTY_FORM = {
  name: '', description: '', category_id: '', selling_price: '',
  cost_price: '', is_available: true,
}

export default function AdminProductsPage() {
  const supabase = createClient()
  const { success, error: showError } = useToast()

  const [products,    setProducts]    = useState<Product[]>([])
  const [categories,  setCategories]  = useState<ProductCategory[]>([])
  const [search,      setSearch]      = useState('')
  const [filterCat,   setFilterCat]   = useState('')
  const [loading,     setLoading]     = useState(true)

  // Add/edit modal
  const [modal,       setModal]       = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  })

  const loadData = useCallback(async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*, product_categories(name)').order('name'),
      supabase.from('product_categories').select('*').order('name'),
    ])
    setProducts((prods as any) ?? [])
    setCategories(cats ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const openAdd = () => {
    setEditProduct(null)
    setForm(EMPTY_FORM)
    setModal(true)
  }

  const openEdit = (product: Product) => {
    setEditProduct(product)
    setForm({
      name:          product.name,
      description:   product.description ?? '',
      category_id:   product.category_id ?? '',
      selling_price: String(product.selling_price),
      cost_price:    product.cost_price != null ? String(product.cost_price) : '',
      is_available:  product.is_available,
    })
    setModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.selling_price) {
      showError('Name and Selling Price are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name:          form.name.trim(),
        description:   form.description.trim() || null,
        category_id:   form.category_id || null,
        selling_price: parseFloat(form.selling_price),
        cost_price:    form.cost_price ? parseFloat(form.cost_price) : null,
        is_available:  form.is_available,
      }

      if (editProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editProduct.id)
        if (error) throw error
        success('Product updated successfully')
      } else {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
        success('Product added to Tandoori Stop menu')
      }
      setModal(false)
      loadData()
    } catch (err: any) {
      showError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.product) return
    try {
      await supabase.from('order_items').update({ product_id: null }).eq('product_id', deleteDialog.product.id)
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteDialog.product.id)
      if (error) throw error
      success(`"${deleteDialog.product.name}" deleted successfully`)
      setDeleteDialog({ open: false, product: null })
      loadData()
    } catch (err: any) {
      showError(err.message)
    }
  }

  const handleToggleAvailability = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_available: !product.is_available })
        .eq('id', product.id)
      if (error) throw error
      success(`"${product.name}" marked as ${!product.is_available ? 'Available' : 'Unavailable'}`)
      loadData()
    } catch (err: any) {
      showError(err.message)
    }
  }

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCat || p.category_id === filterCat
    return matchSearch && matchCat
  })

  const catOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="admin-content">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">Menu & Food Catalog</h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--brand-yellow-dark)',
                background: 'rgba(250, 229, 93, 0.16)',
                border: '1px solid rgba(250, 229, 93, 0.35)',
                padding: '2px 8px',
                borderRadius: '9999px',
              }}
            >
              {products.length} Specialties
            </span>
          </div>
          <p className="page-subtitle">Configure recipes, pricing, ingredients, and dining room availability</p>
        </div>

        <button
          id="add-product-btn"
          className="btn btn-primary"
          onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* ─── Search & Category Filters ──────────────────────────── */}
      <div className="flex gap-sm" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            className="form-input"
            placeholder="Search by name (e.g. Tandoori Chicken, Naan)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>

        <select
          className="form-select"
          style={{ flex: '0 1 200px' }}
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="">All Categories ({categories.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* ─── Product Cards Grid ─────────────────────────────────── */}
      {loading ? (
        <div className="grid-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 260, borderRadius: 'var(--radius-lg)' }} />
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-sm)',
                color: 'var(--brand-red)',
              }}
            >
              <UtensilsCrossed size={26} />
            </div>
            <div className="empty-state-title" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
              No dishes found matching criteria
            </div>
            <div className="empty-state-desc">
              Try adjusting your search query or add a new recipe to your menu.
            </div>
            <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: 'var(--space-md)' }}>
              Add Menu Item
            </button>
          </div>
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map((product) => {
            const categoryName = (product as any).product_categories?.name ?? 'Specialty'
            const foodImage = getProductImage(product.name, categoryName)
            const margin =
              product.cost_price != null && product.selling_price > 0
                ? Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100)
                : null

            return (
              <div
                key={product.id}
                className="food-card"
                style={{
                  opacity: product.is_available ? 1 : 0.75,
                }}
              >
                {/* Food Image with Floating Badges */}
                <div className="food-card-img-wrapper">
                  <img
                    src={foodImage}
                    alt={product.name}
                    className="food-card-img"
                  />
                  {/* Subtle Dark Gradient Overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.65) 100%)',
                    }}
                  />

                  {/* Top Category Badge */}
                  <div style={{ position: 'absolute', top: 10, left: 10 }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(17, 17, 17, 0.75)',
                        backdropFilter: 'blur(6px)',
                        color: '#FFFFFF',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                    >
                      {categoryName}
                    </span>
                  </div>

                  {/* Availability Badge */}
                  <div style={{ position: 'absolute', top: 10, right: 10 }}>
                    <span
                      className={`badge ${product.is_available ? 'badge-success' : 'badge-default'}`}
                      style={{
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                      }}
                    >
                      {product.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>

                  {/* Price Tag overlay on bottom right of photo */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      right: 10,
                      background: 'rgba(241, 24, 104, 0.92)',
                      color: '#FFFFFF',
                      padding: '2px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 800,
                      fontSize: '0.9375rem',
                      boxShadow: '0 2px 8px rgba(241, 24, 104, 0.4)',
                    }}
                  >
                    {formatCurrency(product.selling_price)}
                  </div>
                </div>

                {/* Content Body */}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                    }}
                  >
                    {product.name}
                  </div>

                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.4,
                      marginBottom: 12,
                      minHeight: 34,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {product.description || 'Authentic tandoor-roasted preparation seasoned with chef-crafted spices.'}
                  </p>

                  {/* Financial Metrics */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      marginBottom: 14,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      Cost: <strong>{product.cost_price != null ? formatCurrency(product.cost_price) : '—'}</strong>
                    </div>
                    {margin !== null && (
                      <div style={{ color: margin > 50 ? 'var(--success)' : 'var(--brand-yellow-dark)', fontWeight: 700 }}>
                        {margin}% Profit Margin
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex gap-xs items-center" style={{ marginTop: 'auto' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                      onClick={() => openEdit(product)}
                    >
                      <Edit2 size={13} />
                      <span>Edit Dish</span>
                    </button>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{
                        color: product.is_available ? 'var(--text-muted)' : 'var(--success)',
                        fontSize: '0.75rem',
                        padding: '6px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title={product.is_available ? 'Hide from waiter POS' : 'Make available on POS'}
                      onClick={() => handleToggleAvailability(product)}
                    >
                      {product.is_available ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{product.is_available ? 'Hide' : 'Enable'}</span>
                    </button>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)', padding: '6px 8px' }}
                      title="Delete dish"
                      onClick={() => setDeleteDialog({ open: true, product })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editProduct ? 'Edit Menu Item' : 'Add Tandoori Stop Menu Item'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editProduct ? 'Save Changes' : 'Add to Menu'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <Input
            label="Dish / Item Name"
            required
            placeholder="e.g. Tandoori Chicken (Half / Full)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            label="Category"
            options={catOptions}
            placeholder="Select a culinary category…"
            value={form.category_id}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
          />
          <div className="grid-2">
            <Input
              label="Selling Price (PKR)"
              required
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 1250"
              value={form.selling_price}
              onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
            />
            <Input
              label="Estimated Cost Price (PKR)"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 650"
              value={form.cost_price}
              onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
              hint="Used to calculate item profit margins"
            />
          </div>
          <Textarea
            label="Description & Recipe Notes"
            placeholder="Brief ingredients, preparation style, or allergen information…"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="flex items-center gap-sm">
            <input
              type="checkbox"
              id="is_available"
              checked={form.is_available}
              onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--brand-red)', cursor: 'pointer' }}
            />
            <label htmlFor="is_available" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
              Available for immediate ordering by waitstaff
            </label>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, product: null })}
        onConfirm={handleDelete}
        title="Remove Menu Item"
        message={`Are you sure you want to delete "${deleteDialog.product?.name}"? Past completed orders will retain their historic name and price snapshots.`}
        confirmLabel="Delete Item"
      />
    </div>
  )
}
