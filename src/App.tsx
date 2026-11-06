import { NavLink, Route, Routes, useLocation } from 'react-router';
import { ConnectionPage } from './features/settings/ConnectionPage';
import { TicketsPage } from './features/tickets/TicketsPage';
import { TicketDetailPage } from './features/tickets/TicketDetailPage';
import { RateLimitMeter } from './components/RateLimitMeter';
import { StatusDot } from './components/ui';
import { useConnectionCheck, useHealth } from './api/lookups';

function ConnectionBadge() {
  const health = useHealth();
  const conn = useConnectionCheck(health.data?.configured === true);
  const tone = health.isPending || conn.isFetching ? 'idle' : !health.data?.configured || conn.isError ? 'error' : conn.isSuccess ? 'ok' : 'warn';
  const text = !health.data ? 'Checking…' : !health.data.configured ? 'Not configured' : conn.isError ? 'Connection error' : conn.isSuccess ? health.data.domain : 'Connecting…';
  return (
    <span className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
      <StatusDot tone={tone} /> {text}
    </span>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1.5 text-sm ${isActive ? 'bg-zinc-200 font-medium dark:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'}`;

export function App() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-6 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="font-semibold">Freshservice Console</span>
        <nav className="flex gap-1">
          <NavLink to="/" className={({ isActive }) => navClass({ isActive: isActive || location.pathname.startsWith('/tickets') })} end>Tickets</NavLink>
          <NavLink to="/settings" className={navClass}>Settings</NavLink>
        </nav>
        <div className="ml-auto"><ConnectionBadge /></div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4">
        <Routes>
          <Route path="/" element={<TicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/settings" element={<ConnectionPage />} />
        </Routes>
      </main>
      <footer className="border-t border-zinc-200 px-4 py-2 text-xs dark:border-zinc-800">
        <RateLimitMeter />
      </footer>
    </div>
  );
}
