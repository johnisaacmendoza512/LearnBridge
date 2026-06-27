import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AIChatbot from '../ui/AIChatbot';

export default function AppLayout() {
  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <Topbar />
        <main style={{ flex:1, overflowY:'auto', padding:24, background:'var(--bg)' }}>
          <Outlet />
        </main>
         <AIChatbot />
      </div>
    </div>
  );
}
