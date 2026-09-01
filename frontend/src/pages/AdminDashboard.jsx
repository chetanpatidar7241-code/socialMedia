import { useEffect, useState, useCallback } from 'react';
import { adminApi, getErrorMessage } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { WINNER_TIERS } from '../constants';
import { Eye, EyeOff } from 'lucide-react';

export default function AdminDashboard() {
  const { isAdmin, adminLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginErrors, setLoginErrors] = useState({});
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [winners, setWinners] = useState([]);
  const [tierFilter, setTierFilter] = useState('ALL');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [kycPendingId, setKycPendingId] = useState(null);
  const toast = useToast();

  const fetchWinners = useCallback(async (tier) => {
    setFetching(true);
    setFetchError('');
    try {
      const res = await adminApi.get('/winners', { params: tier && tier !== 'ALL' ? { tier } : {} });
      setWinners(res.data);
    } catch (err) {
      if (err.response?.status !== 401) {
        setFetchError(getErrorMessage(err, 'Failed to load winners'));
      }
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchWinners(tierFilter);
  }, [isAdmin, tierFilter, fetchWinners]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!username.trim()) errors.username = 'Admin username is required';
    if (!password) errors.password = 'Password is required';
    if (Object.keys(errors).length > 0) {
      setLoginErrors(errors);
      return;
    }
    setLoginErrors({});
    setLoginSubmitting(true);
    try {
      const res = await adminApi.post('/admin/login', { username, password });
      adminLogin(res.data.token);
      toast.success('Logged in as admin');
    } catch (err) {
      setLoginErrors({ form: getErrorMessage(err, 'Invalid credentials') });
    } finally {
      setLoginSubmitting(false);
    }
  };

  const generateRankings = async (force = false) => {
    const confirmMsg = force
      ? 'This will WIPE all current winners and history, then recompute everything from scratch. Continue?'
      : 'Generate the initial contest rankings now?';
    if (!window.confirm(confirmMsg)) return;

    setGenerating(true);
    try {
      await adminApi.post('/ranking/generate', { force });
      toast.success('Rankings generated successfully!');
      fetchWinners(tierFilter);
    } catch (err) {
      if (err.response?.status === 409) {
        if (window.confirm(`${err.response.data.message}\n\nForce a full regenerate now?`)) {
          return generateRankings(true);
        }
        return;
      }
      toast.error(getErrorMessage(err, 'Error generating rankings'));
    } finally {
      setGenerating(false);
    }
  };

  const handleKyc = async (id, status) => {
    setKycPendingId(id);
    try {
      const res = await adminApi.post(`/winners/${id}/kyc`, { status });
      toast.success(res.data.message);
      fetchWinners(tierFilter);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Error updating KYC'));
    } finally {
      setKycPendingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="card center-box">
        <h2 className="text-center mb-md">Admin Login</h2>
        <form onSubmit={handleLogin} noValidate>
          <div className="form-group">
            <label>Admin Username <span className="required">*</span></label>
            <input
              className="input-field"
              placeholder="Enter admin username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
            />
            {loginErrors.username && <span className="error-text">{loginErrors.username}</span>}
          </div>
          <div className="form-group">
            <label>Password <span className="required">*</span></label>
            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field password-input"
                placeholder="Enter admin password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="eye-icon"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {loginErrors.password && <span className="error-text">{loginErrors.password}</span>}
          </div>
          {loginErrors.form && <span className="error-text">{loginErrors.form}</span>}
          <button type="submit" className="btn w-full mt-md" disabled={loginSubmitting}>
            {loginSubmitting ? 'Logging in…' : 'Login to Dashboard'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-row justify-between mb-md admin-toolbar">
        <h2>Admin Dashboard</h2>
        <div className="flex-row gap-sm">
          <button onClick={() => generateRankings(false)} disabled={generating} className="btn">
            {generating ? 'Generating…' : '⚡ Generate Rankings'}
          </button>
        </div>
      </div>

      <div className="tier-tabs">
        <button className={`tier-tab ${tierFilter === 'ALL' ? 'tier-tab-active' : ''}`} onClick={() => setTierFilter('ALL')}>
          All
        </button>
        {WINNER_TIERS.map((tier) => (
          <button
            key={tier}
            className={`tier-tab ${tierFilter === tier ? 'tier-tab-active' : ''}`}
            onClick={() => setTierFilter(tier)}
          >
            {tier.replace('_', ' ')}
          </button>
        ))}
      </div>

      {fetchError && (
        <div className="card text-center">
          <p className="mb-md">{fetchError}</p>
          <button className="btn" onClick={() => fetchWinners(tierFilter)}>Retry</button>
        </div>
      )}

      {!fetchError && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Username</th>
                <th>Tier</th>
                <th>Category</th>
                <th>Score</th>
                <th>KYC Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {winners.map((w, index) => (
                <tr key={w.id}>
                  <td>{index + 1}</td>
                  <td>{w.username}</td>
                  <td><strong>{w.tier.replace('_', ' ')}</strong></td>
                  <td>{w.category || '-'}</td>
                  <td>{w.score.toFixed(1)}</td>
                  <td>
                    <span className={`badge ${w.kycStatus === 'PASSED' ? 'badge-passed' : 'badge-pending'}`}>
                      {w.kycStatus}
                    </span>
                  </td>
                  <td>
                    {w.kycStatus === 'PENDING' ? (
                      <div className="flex-row gap-sm">
                        <button
                          onClick={() => handleKyc(w.id, 'PASSED')}
                          className="btn btn-sm btn-success"
                          disabled={kycPendingId === w.id}
                        >
                          Pass
                        </button>
                        <button
                          onClick={() => handleKyc(w.id, 'FAILED')}
                          className="btn btn-sm btn-danger"
                          disabled={kycPendingId === w.id}
                        >
                          {kycPendingId === w.id ? '…' : 'Fail'}
                        </button>
                      </div>
                    ) : (
                      <span className="monospace">Verified</span>
                    )}
                  </td>
                </tr>
              ))}
              {!fetching && winners.length === 0 && (
                <tr><td colSpan="7" className="empty-state">No winners for this filter yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
