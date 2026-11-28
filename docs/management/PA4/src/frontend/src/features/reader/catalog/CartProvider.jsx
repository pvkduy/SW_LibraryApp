import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { api } from '../../../lib/api'
import { CartContext } from './useCart'
import { NONMEMBER_MAX_ITEMS } from './cartHelpers'

const LOCAL_CART_KEY = 'shelfhelp_local_cart_v1'
const LOCAL_WISHLIST_KEY = 'shelfhelp_local_wishlist_v1'

function readLocal(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeLocal(key, val) {
  try {
    window.localStorage.setItem(key, JSON.stringify(val))
  } catch {
    // ignore storage errors
  }
}

export function CartProvider({ user, children }) {
  const [cartItems, setCartItems] = useState([])
  const [wishlistIds, setWishlistIds] = useState([])
  const [activeLoanBookIds, setActiveLoanBookIds] = useState([])
  const [activeLoansCount, setActiveLoansCount] = useState(0)
  const [dbBacked, setDbBacked] = useState(true)

  const uid = user?.id ?? null

  const refreshCartState = useCallback(async () => {
    if (!uid) {
      setCartItems([])
      setWishlistIds([])
      setActiveLoanBookIds([])
      setActiveLoansCount(0)
      return
    }

    // 1. Load active loan items + ready_for_pickup reservations (UC-09 §2.1.1, DEC-22)
    const [{ data: loanData }, { data: readyResData }] = await Promise.all([
      supabase
        .from('loan_items')
        .select('id, book_id, status')
        .eq('uid', uid)
        .in('status', ['awaiting_payment', 'payment_failed', 'ready_for_pickup', 'borrowed', 'overdue']),
      supabase
        .from('reservations')
        .select('id, book_id')
        .eq('uid', uid)
        .eq('status', 'ready_for_pickup'),
    ])

    const loanCount = loanData?.length ?? 0
    const resCount = readyResData?.length ?? 0
    setActiveLoansCount(loanCount + resCount)
    setActiveLoanBookIds((loanData || []).map((l) => l.book_id))

    // 2. Load persistent cart_items from Supabase
    const { data: cartData, error: cartErr } = await supabase
      .from('cart_items')
      .select(`
        id,
        book_id,
        preferred_copy_id,
        duration_days,
        books (
          id, title, authors, collection, available_copies, shelf_location, cover_path, isbn13, status
        ),
        copies:preferred_copy_id (
          id, barcode, status, shelf_location
        )
      `)
      .eq('uid', uid)
      .order('created_at', { ascending: true })

    if (!cartErr && cartData) {
      setDbBacked(true)
      setCartItems(
        cartData
          .filter((row) => row.books)
          .map((row) => ({
            id: row.id,
            book_id: row.book_id,
            preferred_copy_id: row.preferred_copy_id,
            duration_days: row.duration_days || 7,
            book: row.books,
            copy: row.copies || null,
          })),
      )
    } else {
      setDbBacked(false)
      setCartItems(readLocal(`${LOCAL_CART_KEY}_${uid}`, []))
    }

    // 3. Load wishlists
    const { data: wlData, error: wlErr } = await supabase
      .from('wishlists')
      .select('book_id')
      .eq('uid', uid)

    if (!wlErr && wlData) {
      setWishlistIds(wlData.map((w) => w.book_id))
    } else {
      setWishlistIds(readLocal(`${LOCAL_WISHLIST_KEY}_${uid}`, []))
    }
  }, [uid])

  useEffect(() => {
    const t = window.setTimeout(() => {
      refreshCartState()
    }, 0)
    return () => window.clearTimeout(t)
  }, [refreshCartState])

  const addToCart = useCallback(
    async (book, selectedCopy = null, durationDays = 7) => {
      if (!uid) return { ok: false, error: 'Please sign in first.' }

      if (activeLoanBookIds.includes(book.id)) {
        return { ok: false, error: 'You already have an active loan or pickup request for this book.' }
      }

      const alreadyInCart = cartItems.some((c) => c.book_id === book.id)
      if (!alreadyInCart && activeLoansCount + cartItems.length >= NONMEMBER_MAX_ITEMS) {
        return {
          ok: false,
          error: `You have reached your limit of ${NONMEMBER_MAX_ITEMS} active items.`,
        }
      }

      if (dbBacked) {
        const { error } = await supabase.from('cart_items').upsert(
          {
            uid,
            book_id: book.id,
            preferred_copy_id: selectedCopy?.id ?? null,
            duration_days: durationDays,
          },
          { onConflict: 'uid,book_id' },
        )

        if (!error) {
          await refreshCartState()
          return { ok: true }
        }
      }

      // Local fallback
      const next = [
        ...cartItems.filter((c) => c.book_id !== book.id),
        {
          id: `local-${book.id}`,
          book_id: book.id,
          preferred_copy_id: selectedCopy?.id ?? null,
          duration_days: durationDays,
          book,
          copy: selectedCopy,
        },
      ]
      setCartItems(next)
      writeLocal(`${LOCAL_CART_KEY}_${uid}`, next)
      return { ok: true }
    },
    [uid, activeLoanBookIds, activeLoansCount, cartItems, dbBacked, refreshCartState],
  )

  const updateDuration = useCallback(
    async (bookId, durationDays) => {
      if (!uid) return
      const next = cartItems.map((item) =>
        item.book_id === bookId ? { ...item, duration_days: durationDays } : item,
      )
      setCartItems(next)

      if (dbBacked) {
        await supabase
          .from('cart_items')
          .update({ duration_days: durationDays })
          .eq('uid', uid)
          .eq('book_id', bookId)
      } else {
        writeLocal(`${LOCAL_CART_KEY}_${uid}`, next)
      }
    },
    [uid, cartItems, dbBacked],
  )

  const removeFromCart = useCallback(
    async (bookId) => {
      if (!uid) return
      const next = cartItems.filter((item) => item.book_id !== bookId)
      setCartItems(next)

      if (dbBacked) {
        await supabase.from('cart_items').delete().eq('uid', uid).eq('book_id', bookId)
      } else {
        writeLocal(`${LOCAL_CART_KEY}_${uid}`, next)
      }
    },
    [uid, cartItems, dbBacked],
  )

  const clearCart = useCallback(async () => {
    if (!uid) return
    setCartItems([])
    if (dbBacked) {
      await supabase.from('cart_items').delete().eq('uid', uid)
    } else {
      writeLocal(`${LOCAL_CART_KEY}_${uid}`, [])
    }
  }, [uid, dbBacked])

  const toggleWishlist = useCallback(
    async (bookId) => {
      if (!uid) return { ok: false, error: 'Please sign in first.' }

      try {
        const data = await api.invoke('toggle-wishlist', { book_id: bookId })
        if (!data?.success) {
          return { ok: false, error: data?.message || 'Could not update wishlist.' }
        }
        setWishlistIds((prev) =>
          data.wishlisted ? [...new Set([...prev, bookId])] : prev.filter((id) => id !== bookId),
        )
        return { ok: true, wishlisted: data.wishlisted, message: data.message }
      } catch (err) {
        return { ok: false, error: err.message || 'Could not update wishlist.' }
      }
    },
    [uid],
  )

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount: cartItems.length,
        wishlistIds,
        activeLoansCount,
        activeLoanBookIds,
        maxItems: NONMEMBER_MAX_ITEMS,
        addToCart,
        updateDuration,
        removeFromCart,
        clearCart,
        toggleWishlist,
        refreshCartState,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}
