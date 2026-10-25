import { useEffect, useState } from 'react'
import '../App.css'
import { useAuth } from '../features/auth/AuthContext.jsx'
import { supabase } from '../lib/supabase'

function App() {
  const { user, profile, loading, logout } = useAuth()
  const [books, setBooks] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    supabase
      .from('books')
      .select('id, title, authors, collection, available_copies')
      .eq('status', 'active')
      .order('added_at', { ascending: false })
      .limit(20)
      .then(({ data, error: err }) => {
        if (!active) return
        if (err) setError(err.message)
        else setBooks(data ?? [])
      })

    return () => {
      active = false
    }
  }, [])

  if (loading) return <p>Đang tải...</p>

  return (
    <main className="app">
      <header>
        <h1>SW Library</h1>
        {user ? (
          <div className="user">
            <span>{profile?.full_name || user.email}</span>
            <button onClick={logout}>Đăng xuất</button>
          </div>
        ) : (
          <p>Chưa đăng nhập</p>
        )}
      </header>

      <section>
        <h2>Danh sách sách</h2>
        {error && <p className="error">{error}</p>}
        <ul>
          {books.map((book) => (
            <li key={book.id}>
              <strong>{book.title}</strong> - {book.authors?.join(', ')}
              {book.collection === 'premium' && <em> (Premium)</em>}
            </li>
          ))}
        </ul>
        {!error && books.length === 0 && <p>Chưa có sách nào.</p>}
      </section>
    </main>
  )
}

export default App
