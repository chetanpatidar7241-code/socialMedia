import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Feed from './pages/Feed';
import CreatePost from './pages/CreatePost';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import { RequireUser } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';

function Nav() {
  const { user, logout, isAdmin, adminLogout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleAdminLogout = () => {
    adminLogout();
    toast.success('Logged out successfully');
    navigate('/admin');
  };

  return (
    <nav>
      {!isAdmin && <Link to="/">Feed</Link>}
      {user && <Link to="/create-post">Create Post</Link>}
      {user && <Link to="/profile">Profile</Link>}
      {!user && !isAdmin && <Link to="/admin">Admin Dashboard</Link>}
      <div className="nav-spacer" />
      {user ? (
        <>
          <span className="nav-user">@{user.username}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
        </>
      ) : isAdmin ? (
        <>
          <span className="nav-user">Admin</span>
          <button className="btn btn-secondary btn-sm" onClick={handleAdminLogout}>Logout</button>
        </>
      ) : (
        <Link to="/login">User Login / Signup</Link>
      )}
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div>
        <Nav />
        <main className="container">
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/create-post" element={<RequireUser><CreatePost /></RequireUser>} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/profile" element={<RequireUser><Profile /></RequireUser>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
