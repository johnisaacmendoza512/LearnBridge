import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AIChatbot from '../ui/AIChatbot';

// Copy each table's column headers onto its cells (data-label) so the
// mobile CSS can render rows as stacked cards with labels.
function labelTableCells(root) {
  root.querySelectorAll('table.table').forEach(table => {
    const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!headers.length) return;
    table.querySelectorAll('tbody tr').forEach(tr => {
      [...tr.children].forEach((td, i) => {
        if (headers[i] && td.getAttribute('data-label') !== headers[i]) td.setAttribute('data-label', headers[i]);
      });
    });
  });
}

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  // Desktop: sidebar minimized to icons only (remembered between visits)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  // Phones open the slide-in menu; larger screens minimize/expand the sidebar
  const handleMenuClick = () => {
    if (window.matchMedia('(max-width: 768px)').matches) setMenuOpen(o => !o);
    else setCollapsed(c => !c);
  };
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  // Close the mobile menu whenever the route changes
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    labelTableCells(main);
    const observer = new MutationObserver(() => labelTableCells(main));
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-layout">
      <Sidebar open={menuOpen} collapsed={collapsed} onClose={() => setMenuOpen(false)} />
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <div className="app-content">
        <Topbar onMenuClick={handleMenuClick} />
        <main className="app-main" ref={mainRef}>
          <Outlet />
        </main>
         <AIChatbot />
      </div>
    </div>
  );
}
