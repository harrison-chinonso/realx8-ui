import { Link } from 'react-router-dom';
import { APP_URL } from '../api.js';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span>© {new Date().getFullYear()} Realx8. All rights reserved.</span>
        <nav aria-label="Footer">
          <a href={`${APP_URL}/legal/terms`}>Terms &amp; Privacy</a>
          <Link to="/request">Contact sales</Link>
          <a href={`${APP_URL}/login`}>Sign in</a>
        </nav>
      </div>
    </footer>
  );
}
