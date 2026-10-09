import { Link } from 'react-router-dom';
import { APP_URL } from '../api.js';

export default function Header() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link to="/" className="brand" aria-label="Realx8 home">
          <img src="/favicon.svg" alt="" width="34" height="34" />
          <span>Realx8</span>
        </Link>
        <nav className="nav" aria-label="Main">
          <Link to="/#features" className="hide-sm">Features</Link>
          <Link to="/#how" className="hide-sm">How it works</Link>
          <Link to="/#who" className="hide-sm">Who it's for</Link>
          <a href={`${APP_URL}/login`} className="hide-xs">Sign in</a>
          <Link to="/request" className="btn btn-gold">Get started</Link>
        </nav>
      </div>
    </header>
  );
}
