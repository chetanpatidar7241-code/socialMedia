import { useState } from 'react';
import { userApi, getErrorMessage } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { RESIDENCY_OPTIONS, ELIGIBLE_RESIDENCY } from '../constants';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [residency, setResidency] = useState(user?.residency || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!residency || residency.trim() === '') {
      setError('Residency is required');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const res = await userApi.put('/auth/residency', { residency });
      localStorage.setItem('user', JSON.stringify(res.data.data.user));
      setUser(res.data.data.user);
      toast.success('Residency updated successfully!');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Error updating residency'));
    } finally {
      setSubmitting(false);
    }
  };

  const isEligible = residency === ELIGIBLE_RESIDENCY;

  return (
    <div className="card center-box">
      <h2 className="mb-md text-center">My Profile</h2>

      <div className="profile-info-box">
        <p className="profile-info-label">Username</p>
        <p className="profile-info-value">@{user.username}</p>
      </div>

      <form onSubmit={handleUpdate} noValidate>
        <div className="form-group">
          <label>Residency State <span className="required">*</span></label>
          <select className="input-field" value={residency} onChange={e => setResidency(e.target.value)}>
            <option value="">Select your state</option>
            {RESIDENCY_OPTIONS.map(state => <option key={state} value={state}>{state}</option>)}
          </select>
          {error && <span className="error-text">{error}</span>}
        </div>

        <div className={`eligibility-banner ${isEligible ? 'eligibility-yes' : 'eligibility-no'}`}>
          <span>{isEligible ? '✅' : '⚠️'}</span>
          <div>
            <strong>Contest Eligibility: {isEligible ? 'Eligible' : 'Not Eligible'}</strong>
            <p>Only residents of <strong>Chhattisgarh</strong> are eligible to participate and win prizes in the contest.</p>
          </div>
        </div>

        <button type="submit" className="btn w-full" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
