import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { validateAuth } from '../utils/validation';
import { userApi, getErrorMessage } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { RESIDENCY_OPTIONS } from '../constants';
import { Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', residency: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateAuth(isLogin, formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const res = await userApi.post(endpoint, formData);

      if (isLogin) {
        login(res.data.data.token, res.data.data.user);
        toast.success('Logged in successfully!');
        navigate(location.state?.from || '/');
      } else {
        toast.success('Signup successful! Please login.');
        setIsLogin(true);
        setFormData({ username: '', password: '', residency: '' });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, isLogin ? 'Login failed' : 'Signup failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card center-box">
      <h2 className="text-center mb-md">{isLogin ? 'Login' : 'Signup'}</h2>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label>Username <span className="required">*</span></label>
          <input
            className="input-field"
            placeholder="Enter your username"
            value={formData.username}
            onChange={e => setFormData({ ...formData, username: e.target.value })}
            autoComplete="username"
          />
          {errors.username && <span className="error-text">{errors.username}</span>}
        </div>

        <div className="form-group">
          <label>Password <span className="required">*</span></label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              className="input-field password-input"
              placeholder="Enter your password"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
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
          {errors.password && <span className="error-text">{errors.password}</span>}
        </div>

        {!isLogin && (
          <div className="form-group">
            <label>Residency <span className="required">*</span></label>
            <select
              className="input-field"
              value={formData.residency}
              onChange={e => setFormData({ ...formData, residency: e.target.value })}
            >
              <option value="">Select your state</option>
              {RESIDENCY_OPTIONS.map(state => <option key={state} value={state}>{state}</option>)}
            </select>
            {errors.residency && <span className="error-text">{errors.residency}</span>}
            <span className="field-hint">Only Chhattisgarh residents are eligible for contest prizes.</span>
          </div>
        )}

        <button type="submit" className="btn w-full mt-md" disabled={submitting}>
          {submitting ? 'Please wait…' : (isLogin ? 'Login' : 'Signup')}
        </button>
      </form>

      <div className="text-center mt-md">
        <button className="btn btn-secondary" onClick={() => { setIsLogin(!isLogin); setErrors({}); }}>
          Switch to {isLogin ? 'Signup' : 'Login'}
        </button>
      </div>
    </div>
  );
}
