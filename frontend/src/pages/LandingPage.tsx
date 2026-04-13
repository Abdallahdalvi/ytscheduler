import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PlayCircle, Shield, Zap, BarChart2, Calendar, Globe } from 'lucide-react';

export default function LandingPage() {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <div className="landing-root">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-container flex-between">
          <div className="landing-logo flex-center">
            <PlayCircle size={28} className="text-primary" />
            <span className="logo-text">YTScheduler</span>
          </div>
          <button 
            className="btn btn-primary btn-sm"
            onClick={signInWithGoogle}
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Sign In'}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-container grid-2">
          <div className="hero-content">
            <div className="badge-modern">Powered by Dalvi AI</div>
            <h1 className="hero-title">
              The Executive <span className="text-gradient">YouTube</span> Control Suite.
            </h1>
            <p className="hero-subtitle">
              Automate your uploads, visualize your growth, and manage multiple channels from one premium dashboard. 
              Built for creators who value precision and style.
            </p>
            <div className="hero-actions">
              <button 
                className="btn btn-primary btn-lg flex-center"
                onClick={signInWithGoogle}
                disabled={loading}
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="google-icon" />
                {loading ? 'Redirecting...' : 'Get Started with Google'}
              </button>
              <p className="text-muted text-sm mt-3">Free for self-hosted creators. Cloud-ready architecture.</p>
            </div>
          </div>
          <div className="hero-visual">
            <div className="glass-card main-preview">
              <img 
                src="/src/assets/ytscheduler_hero.png" 
                alt="YTScheduler Preview" 
                className="preview-img" 
                onError={(e) => {
                  e.currentTarget.src = "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=1074";
                }}
              />
              <div className="floating-badge badge-top">
                <BarChart2 size={16} /> +12% Growth
              </div>
              <div className="floating-badge badge-bottom">
                <Calendar size={16} /> Next slot: 6:00 PM
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="landing-features">
        <div className="landing-container">
          <div className="section-header text-center">
            <h2 className="section-title">Designed for Excellence</h2>
            <p className="section-subtitle">Everything you need to master your channel, without the clutter.</p>
          </div>
          <div className="features-grid">
            <FeatureCard 
              icon={<Zap />} 
              title="Smart Queue" 
              desc="Proprietary auto-fill logic that optimizes your upload frequency based on your performance." 
            />
            <FeatureCard 
              icon={<Shield />} 
              title="Supabase Secure" 
              desc="Your data is isolated with Row Level Security (RLS) on your private cloud." 
            />
            <FeatureCard 
              icon={<Globe />} 
              title="Multi-Channel" 
              desc="Switch between unlimited YouTube accounts with one single Google login." 
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container text-center">
          <div className="footer-logo mb-3">
            <PlayCircle size={22} className="text-secondary" />
            <span className="logo-text text-sm">YTScheduler</span>
          </div>
          <p className="text-muted text-xs">© 2026 YTScheduler by Dalvi Apps. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
    </div>
  );
}
