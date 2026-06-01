import '../LandingPage.css';
import { LandingNav } from './LandingNav';
import { PersonasSection } from './PersonasSection';
import { LandingFooter } from './LandingFooter';

export function LandingPage() {
  return (
    <div className="landing-page">
      <LandingNav />
      <main>
        <PersonasSection />
      </main>
      <LandingFooter />
    </div>
  );
}
