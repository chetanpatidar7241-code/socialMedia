import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { userApi, getErrorMessage, USER_HOST } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function PostCard({ post, onRequireLogin }) {
  const { user } = useAuth();
  const toast = useToast();
  const [counts, setCounts] = useState({
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    viewsCount: post.viewsCount
  });
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const hasTrackedView = useRef(false);
  const cardRef = useRef(null);

  // Automatic view tracking: fire once, the first time the post is actually scrolled
  // into view, rather than requiring the viewer to click a "View" button.
  useEffect(() => {
    if (!cardRef.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedView.current) {
          hasTrackedView.current = true;
          userApi.post(`/posts/${post._id}/interact`, { type: 'view' })
            .then(() => setCounts((c) => ({ ...c, viewsCount: c.viewsCount + 1 })))
            .catch(() => { /* Already viewed or offline — not worth surfacing to the user. */ });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [post._id]);

  const handleLike = async () => {
    if (!user) return onRequireLogin();
    if (liked) return;
    try {
      await userApi.post(`/posts/${post._id}/interact`, { type: 'like' });
      setLiked(true);
      setCounts((c) => ({ ...c, likesCount: c.likesCount + 1 }));
    } catch (err) {
      if (err.response?.status === 409) {
        setLiked(true);
        toast.info('You already liked this post');
      } else {
        toast.error(getErrorMessage(err, 'Could not like this post'));
      }
    }
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await userApi.get(`/posts/${post._id}/comments`);
      setComments(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load comments'));
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleComments = () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && comments.length === 0) loadComments();
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!user) return onRequireLogin();
    if (!commentText.trim()) return;

    setCommentSubmitting(true);
    try {
      await userApi.post(`/posts/${post._id}/interact`, { type: 'comment', content: commentText.trim() });
      setCommentText('');
      setCounts((c) => ({ ...c, commentsCount: c.commentsCount + 1 }));
      await loadComments();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not post comment'));
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <div className="card card-no-padding" ref={cardRef}>
      <div className="feed-header">
        <div>
          <p className="author">{post.userId?.username || 'Unknown'}</p>
          <span className="meta">{post.userId?.residency} • {post.category}</span>
        </div>
      </div>

      <div className="feed-media">
        {post.mediaType === 'video' ? (
          <video src={`${USER_HOST}${post.mediaUrl}`} controls />
        ) : (
          <img src={`${USER_HOST}${post.mediaUrl}`} alt={post.caption || 'post media'} />
        )}
      </div>

      <div className="feed-caption-area">
        <p className="feed-caption">{post.caption}</p>
      </div>

      <div className="feed-actions">
        <button className={`btn ${liked ? 'btn-active' : ''}`} onClick={handleLike}>
          👍 {liked ? 'Liked' : 'Like'} ({counts.likesCount})
        </button>
        <button className="btn" onClick={toggleComments}>💬 Comments ({counts.commentsCount})</button>
        <span className="btn btn-static">👁️ {counts.viewsCount} views</span>
      </div>

      {commentsOpen && (
        <div className="comments-section">
          {commentsLoading && <p className="field-hint">Loading comments…</p>}
          {!commentsLoading && comments.length === 0 && <p className="field-hint">No comments yet. Be the first!</p>}
          <ul className="comments-list">
            {comments.map((c) => (
              <li key={c._id} className="comment-item">
                <strong>@{c.userId?.username || 'user'}</strong> <span>{c.content}</span>
              </li>
            ))}
          </ul>
          <form className="comment-form" onSubmit={submitComment}>
            <input
              className="input-field"
              placeholder={user ? 'Write a comment…' : 'Login to comment'}
              value={commentText}
              maxLength={1000}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={!user}
            />
            <button type="submit" className="btn btn-sm" disabled={!user || commentSubmitting || !commentText.trim()}>
              {commentSubmitting ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const fetchPosts = useCallback(async (targetPage) => {
    try {
      const res = await userApi.get('/posts', { params: { page: targetPage, limit: 10 } });
      const { posts: fetched, totalPages: fetchedTotalPages } = res.data.data;
      setPosts((prev) => (targetPage === 1 ? fetched : [...prev, ...fetched]));
      setTotalPages(fetchedTotalPages);
      setPage(targetPage);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load the feed'));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPosts(1).finally(() => setLoading(false));
  }, [fetchPosts]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchPosts(page + 1);
    setLoadingMore(false);
  };

  const handleRequireLogin = () => toast.info('Please login to interact with posts');

  if (loading) {
    return <p className="text-center mt-lg field-hint">Loading feed…</p>;
  }

  if (error && posts.length === 0) {
    return (
      <div className="card center-box text-center">
        <p className="mb-md">{error}</p>
        <button className="btn" onClick={() => { setLoading(true); fetchPosts(1).finally(() => setLoading(false)); }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="feed-container">
      <h2 className="mb-lg text-center">Global Feed</h2>
      <div className="flex-col gap-lg">
        {posts.map((p) => (
          <PostCard key={p._id} post={p} onRequireLogin={handleRequireLogin} />
        ))}
        {posts.length === 0 && (
          <p className="empty-state">
            No posts yet. <Link to="/create-post">Be the first to create one!</Link>
          </p>
        )}
      </div>
      {page < totalPages && (
        <div className="text-center mt-md">
          <button className="btn btn-secondary" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
