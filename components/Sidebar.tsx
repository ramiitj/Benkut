import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ViewMode, AuthState } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarProps { mode: ViewMode; setMode: (mode: ViewMode) => void; auth: AuthState; }

const userLinks = [
  { to: '/', icon: 'home', key: 'home', end: true },
  { to: '/chef', icon: 'mic', key: 'Sous Chef' },
] as const;

const Sidebar: React.FC<SidebarProps> = ({ mode, setMode, auth }) => {
  const navigate = useNavigate();
  const isUser = mode === ViewMode.USER;
  const { t, interfaceLanguage, setInterfaceLanguage } = useLanguage();
  const [languageOpen, setLanguageOpen] = useState(false);
  const links = isUser ? userLinks : [
    { to: '/admin/insights', icon: 'space_dashboard', key: 'Dashboard', end: true },
    { to: '/admin/agent', icon: 'tune', key: 'Agent tuning' },
    { to: '/admin/branding', icon: 'palette', key: 'Branding' },
    { to: '/admin/billing', icon: 'receipt_long', key: 'Billing' },
  ];
  const label = (key: string) => t(key) || key;

  return <>
    <aside className="app-sidebar" aria-label="Primary navigation">
      <button className="brand" onClick={() => navigate('/')} aria-label="Benkut home">
        <span className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span><strong>Benkut</strong><small>{isUser ? t('tagline') : 'Workspace'}</small></span>
      </button>

      <nav className="sidebar-nav">
        <p className="nav-eyebrow">{isUser ? t('yourKitchen') : 'Administration'}</p>
        {links.map(item => <NavLink key={item.to} to={item.to} end={'end' in item && item.end}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
          <span>{label(item.key)}</span>
        </NavLink>)}
      </nav>

      <div className="sidebar-footer">
        <button className="language-button" onClick={() => setLanguageOpen(!languageOpen)} aria-expanded={languageOpen}>
          <span className="material-symbols-outlined">language</span>
          <span><small>{t('interfaceLanguage')}</small><strong>{interfaceLanguage === 'en' ? 'English' : interfaceLanguage === 'hi' ? 'हिन्दी' : 'Español'}</strong></span>
          <span className="material-symbols-outlined chevron">expand_more</span>
        </button>
        {languageOpen && <div className="language-menu" role="menu">
          {[['en','English'],['hi','हिन्दी'],['es','Español']].map(([code,name]) =>
            <button key={code} className={interfaceLanguage === code ? 'selected' : ''} onClick={() => { setInterfaceLanguage(code as 'en'|'hi'|'es'); setLanguageOpen(false); }}>
              <span>{name}</span>{interfaceLanguage === code && <span className="material-symbols-outlined">check</span>}
            </button>)}
        </div>}
        {auth.isAuthenticated && auth.user?.role === 'admin' ?
          <button className="admin-link" onClick={() => setMode(isUser ? ViewMode.ADMIN : ViewMode.USER)}><span className="material-symbols-outlined">swap_horiz</span>{isUser ? 'Admin view' : 'Kitchen view'}</button> :
          <button className="admin-link" onClick={() => navigate('/login')}><span className="material-symbols-outlined">lock</span>Admin</button>}
      </div>
    </aside>

    {isUser && <nav className="mobile-nav" aria-label="Mobile navigation">
      {userLinks.slice(0,4).map(item => <NavLink key={item.to} to={item.to} end={'end' in item && item.end} className={({isActive}) => isActive ? 'active' : ''}>
        <span className="material-symbols-outlined">{item.icon}</span><small>{label(item.key)}</small>
      </NavLink>)}
    </nav>}
  </>;
};

export default Sidebar;
