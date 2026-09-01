import { Component } from 'react';

export default class ErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('Unhandled error in component tree:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="card center-box text-center">
                    <h2 className="mb-md">Something went wrong</h2>
                    <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                        An unexpected error occurred. Reloading usually fixes it.
                    </p>
                    <button className="btn" onClick={() => window.location.reload()}>Reload page</button>
                </div>
            );
        }
        return this.props.children;
    }
}
