import React from 'react';
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import GuideSection from '../components/landing/GuideSection';
import CtaSection from '../components/landing/CtaSection';
import Footer from '../components/landing/Footer';

const Landing = ({ onLoginClick }) => {
  return (
    <div className="min-h-screen font-sans bg-white text-slate-800 overflow-x-hidden scroll-smooth">
      <Navbar onLoginClick={onLoginClick} />
      
      <div id="hero">
        <HeroSection onLoginClick={onLoginClick} />
      </div>
      
      <FeaturesSection />
      <GuideSection />
      <CtaSection onLoginClick={onLoginClick} />
      <Footer />
    </div>
  );
};

export default Landing;