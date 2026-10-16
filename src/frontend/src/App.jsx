import { useEffect, useState } from 'react'
import './App.css'
import { useAuth } from './context/AuthContext'
import { api } from './services/api'

function App() {
  const { user, loading, loginWithGoogle, logout } = useAuth()
  const [books, setBooks] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/api/books')
      .then((data) => setBooks(data.books ?? []))
      .catch((err) => setError(err.message))
  }, [])

  if (loading) return <p>Đang tải...</p>

  return (
    <main className="app">
      <header>
        <h1>SW Library</h1>
        {user ? (
          <div className="user">
            <span>{user.email}</span>
            <button onClick={logout}>Đăng xuất</button>
          </div>
        ) : (
          <button onClick={loginWithGoogle}>Đăng nhập bằng Google</button>
        )}
      </header>

      <section>
        <h2>Danh sách sách</h2>
        {error && <p className="error">{error}</p>}
        <ul>
          {books.map((book) => (
            <li key={book.id}>
              <strong>{book.title}</strong> - {book.author}
            </li>
          ))}
        </ul>
        {!error && books.length === 0 && <p>Chưa có sách nào.</p>}
      </section>
    </main>
  )
}

export default App
