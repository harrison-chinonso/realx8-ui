import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="section">
      <div className="wrap stack" style={{ alignItems: 'flex-start', gap: 16 }}>
        <h1 className="h2">Page not found</h1>
        <p className="lead">That page does not exist.</p>
        <Link to="/" className="btn btn-ink">Back to the home page</Link>
      </div>
    </section>
  );
}
