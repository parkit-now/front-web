import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../../shared/components/Logo';

export function LandingNav() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`landing-nav${scrolled ? ' scrolled' : ''}`}>
      <div className="nav-inner">
        <Logo size="sm" />
        <div className="nav-actions">
          <button
            type="button"
            className="landing-btn-ghost-nav"
            onClick={() => {
              void navigate('/login');
            }}
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    </nav>
  );
}
