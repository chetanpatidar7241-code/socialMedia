import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { validatePost } from '../utils/validation';
import { userApi, getErrorMessage } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { CATEGORIES } from '../constants';

export default function CreatePost() {
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const previewUrlRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  // Revoke the previous object URL whenever it's replaced or the component unmounts,
  // so picking several files before submitting doesn't leak memory.
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    const validationErrors = validatePost(selected, caption, category);
    if (validationErrors.media) {
      setErrors((prev) => ({ ...prev, media: validationErrors.media }));
      e.target.value = '';
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(selected);
    previewUrlRef.current = url;

    setErrors((prev) => ({ ...prev, media: undefined }));
    setFile(selected);
    setPreview(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validatePost(file, caption, category);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    const formData = new FormData();
    formData.append('caption', caption);
    formData.append('category', category);
    formData.append('media', file);

    setSubmitting(true);
    setUploadProgress(0);
    try {
      await userApi.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      });
      toast.success('Post created!');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Error creating post'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card center-box-wide">
      <h2 className="mb-md">Create New Post</h2>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label>Media (Image/Video) <span className="required">*</span></label>
          <input type="file" className="input-field" accept="image/*,video/*" onChange={handleFileChange} />
          <span className="field-hint">Images or videos up to 50MB.</span>
          {errors.media && <span className="error-text">{errors.media}</span>}
        </div>

        {preview && (
          <div className="media-preview-container">
            {file?.type.startsWith('video') ? (
              <video src={preview} controls className="media-preview-img" />
            ) : (
              <img src={preview} alt="preview" className="media-preview-img" />
            )}
          </div>
        )}

        <div className="form-group">
          <label>Caption <span className="required">*</span></label>
          <textarea
            className="input-field"
            placeholder="Write a caption..."
            value={caption}
            maxLength={500}
            onChange={e => setCaption(e.target.value)}
          />
          <span className="field-hint">{caption.length}/500</span>
          {errors.caption && <span className="error-text">{errors.caption}</span>}
        </div>

        <div className="form-group">
          <label>Category <span className="required">*</span></label>
          <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <span className="error-text">{errors.category}</span>}
        </div>

        {submitting && (
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}

        <button type="submit" className="btn w-full mt-md" disabled={submitting}>
          {submitting ? `Uploading… ${uploadProgress}%` : 'Post'}
        </button>
      </form>
    </div>
  );
}
