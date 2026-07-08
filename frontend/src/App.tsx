import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Activity, 
  Trash2, 
  Plus, 
  ExternalLink, 
  Clock, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  History, 
  Info,
  Server,
  FileText,
  ChevronRight
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface HealthCheck {
  id: string;
  urlId: string;
  statusCode: number | null;
  responseTime: number;
  isUp: boolean;
  checkedAt: string;
}

interface MonitoredUrl {
  id: string;
  url: string;
  createdAt: string;
  latestCheck: HealthCheck | null;
}

export default function App() {
  // Main data states
  const [urls, setUrls] = useState<MonitoredUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [inputUrl, setInputUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // History Modal states
  const [selectedUrl, setSelectedUrl] = useState<MonitoredUrl | null>(null);
  const [history, setHistory] = useState<HealthCheck[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Auto-refresh states
  const [countdown, setCountdown] = useState(5);

  // Memoized fetch function for main URL list
  const fetchUrls = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await axios.get<MonitoredUrl[]>(`${API_URL}/urls`);
      setUrls(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching URLs:', err);
      setError('Could not connect to the monitoring server. Please make sure the backend is running.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Fetch URLs on initial mount
  useEffect(() => {
    fetchUrls();
  }, [fetchUrls]);

  // Handle countdown and auto-refresh trigger every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchUrls(true); // silent refresh (no full screen loading spinner)
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchUrls]);

  // Fetch health check history when selected URL changes
  useEffect(() => {
    if (!selectedUrl) return;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await axios.get<HealthCheck[]>(`${API_URL}/urls/${selectedUrl.id}/history`);
        setHistory(response.data);
      } catch (err: any) {
        console.error('Error fetching history:', err);
        setHistoryError('Failed to retrieve health check logs.');
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [selectedUrl]);

  // Handle URL addition
  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    let urlToPost = inputUrl.trim();
    if (!urlToPost) {
      setFormError('Please enter a URL.');
      return;
    }

    // Auto prepend http:// if user forgot protocol to be user-friendly, 
    // but check if it resembles a valid host first.
    if (!/^https?:\/\//i.test(urlToPost)) {
      urlToPost = 'https://' + urlToPost;
    }

    // Check basic URL format client-side
    try {
      new URL(urlToPost);
    } catch (_) {
      setFormError('Please enter a valid URL (e.g. https://example.com).');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/urls`, { url: urlToPost });
      setFormSuccess('URL successfully registered for monitoring!');
      setInputUrl('');
      fetchUrls(true); // update list immediately
      
      // Auto clear success message
      setTimeout(() => setFormSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error adding URL:', err);
      const apiErr = err.response?.data?.error || 'Failed to add URL. Please try again.';
      setFormError(apiErr);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle URL removal
  const handleDeleteUrl = async (id: string, urlName: string) => {
    if (!window.confirm(`Are you sure you want to stop monitoring ${urlName}?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/urls/${id}`);
      setUrls((prev) => prev.filter((item) => item.id !== id));
      if (selectedUrl?.id === id) {
        setSelectedUrl(null);
      }
    } catch (err: any) {
      console.error('Error deleting URL:', err);
      alert('Failed to remove URL. Please try again.');
    }
  };

  // Calculate high level stats
  const totalUrls = urls.length;
  const urlsUp = urls.filter(u => u.latestCheck?.isUp).length;
  const urlsDown = urls.filter(u => u.latestCheck && !u.latestCheck.isUp).length;
  const urlsPending = urls.filter(u => !u.latestCheck).length;

  // Relative time helper
  const getRelativeTime = (timeStr?: string) => {
    if (!timeStr) return 'Never';
    const date = new Date(timeStr);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    return `${diffMin}m ago`;
  };

  // Modal statistics
  const getModalStats = () => {
    if (history.length === 0) return { uptimeRate: 0, avgResponse: 0 };
    const upChecks = history.filter(h => h.isUp);
    const uptimeRate = (upChecks.length / history.length) * 100;
    
    const sumResponse = upChecks.reduce((sum, h) => sum + h.responseTime, 0);
    const avgResponse = upChecks.length > 0 ? Math.round(sumResponse / upChecks.length) : 0;

    return {
      uptimeRate: Math.round(uptimeRate * 10) / 10,
      avgResponse
    };
  };

  const modalStats = getModalStats();

  return (
    <div className="min-h-screen flex flex-col font-sans">
      
      {/* Background glowing gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] -z-10 pointer-events-none"></div>

      {/* Header Bar */}
      <header className="glass-panel border-b border-slate-800 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Uptime Pulse
            </h1>
            <p className="text-xs text-indigo-400 font-medium tracking-widest uppercase">Live Monitor MVP</p>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
          <RefreshCw className="h-3.5 w-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
          <span>Refreshing in </span>
          <span className="font-bold text-white w-4 inline-block text-center">{countdown}s</span>
        </div>
      </header>

      {/* Main container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-8">
        
        {/* Connection Error Notification */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-950/40 p-4 text-red-200 flex items-start gap-3 animate-fade-in">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-300">Connection Error</h3>
              <p className="text-sm text-red-200/80">{error}</p>
              <button 
                onClick={() => fetchUrls()} 
                className="mt-2.5 px-3.5 py-1 text-xs font-semibold bg-red-800/60 hover:bg-red-700/80 rounded-md transition-colors"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Top Summary Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monitored URLs</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold font-display">{totalUrls}</span>
              <span className="text-xs text-slate-500">active sites</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: totalUrls > 0 ? '100%' : '0%' }}></div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Services UP</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold font-display text-emerald-400">{urlsUp}</span>
              <span className="text-xs text-emerald-500/80 font-medium">
                {totalUrls > 0 ? Math.round((urlsUp / totalUrls) * 100) : 0}% online
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: totalUrls > 0 ? `${(urlsUp / totalUrls) * 100}%` : '0%' }}
              ></div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Services DOWN</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold font-display text-rose-500">{urlsDown}</span>
              <span className="text-xs text-rose-400/80 font-medium">
                {totalUrls > 0 ? Math.round((urlsDown / totalUrls) * 100) : 0}% offline
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
              <div 
                className="bg-rose-500 h-full transition-all duration-500" 
                style={{ width: totalUrls > 0 ? `${(urlsDown / totalUrls) * 100}%` : '0%' }}
              ></div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Checks</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold font-display text-slate-400">{urlsPending}</span>
              <span className="text-xs text-slate-500">awaiting check</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
              <div 
                className="bg-slate-400 h-full transition-all duration-500" 
                style={{ width: totalUrls > 0 ? `${(urlsPending / totalUrls) * 100}%` : '0%' }}
              ></div>
            </div>
          </div>

        </div>

        {/* Add URL Form Control Section */}
        <section className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <h2 className="text-lg font-semibold tracking-tight text-white mb-2 flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-400" />
            Add New Target URL
          </h2>
          <p className="text-sm text-slate-400 mb-5">
            Register an HTTP/HTTPS URL. The backend agent will begin health queries immediately and schedule monitoring once per minute.
          </p>

          <form onSubmit={handleAddUrl} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  id="target-url-input"
                  type="text"
                  placeholder="e.g. https://example.com"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/70 transition-all font-sans text-sm"
                  disabled={submitting}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-indigo-800 disabled:to-indigo-900 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Monitor URL</span>
                  </>
                )}
              </button>
            </div>

            {formError && (
              <div className="text-rose-400 text-xs font-medium flex items-center gap-1.5 animate-slide-up">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{formError}</span>
              </div>
            )}
            
            {formSuccess && (
              <div className="text-emerald-400 text-xs font-medium flex items-center gap-1.5 animate-slide-up">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>{formSuccess}</span>
              </div>
            )}
          </form>
        </section>

        {/* Monitored URLs Data Display Table */}
        <section className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
          <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-indigo-400" />
              Monitored Endpoints
            </h2>
            <span className="text-xs font-semibold text-slate-500 uppercase">Live Database Sync</span>
          </div>

          {loading ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
              <p className="text-slate-400 text-sm">Loading registered URLs from Postgres...</p>
            </div>
          ) : urls.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-4 border-2 border-dashed border-slate-800 m-6 rounded-2xl bg-slate-900/20">
              <div className="h-12 w-12 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-500">
                <Info className="h-6 w-6" />
              </div>
              <div>
                <p className="text-slate-300 font-semibold">No URLs Monitored</p>
                <p className="text-slate-500 text-sm mt-1">Please enter a URL above to start registering health queries.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800/80 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-4 px-6">Endpoint Address</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-6 text-center">HTTP Status</th>
                    <th className="py-4 px-6 text-center">Response Time</th>
                    <th className="py-4 px-6 text-right">Last Verified</th>
                    <th className="py-4 px-6 text-center">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {urls.map((item) => {
                    const check = item.latestCheck;
                    
                    return (
                      <tr 
                        key={item.id} 
                        className="group hover:bg-slate-800/30 transition-colors"
                      >
                        {/* URL Name */}
                        <td className="py-4.5 px-6 font-medium text-slate-200 max-w-[280px] md:max-w-md truncate">
                          <div className="flex items-center gap-2.5">
                            <span 
                              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                check === null 
                                  ? 'bg-slate-500' 
                                  : check.isUp 
                                    ? 'bg-emerald-500 glow-up' 
                                    : 'bg-rose-500 glow-down'
                              }`}
                            ></span>
                            <a 
                              href={item.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="hover:text-indigo-400 hover:underline inline-flex items-center gap-1 text-sm font-semibold truncate group-hover:text-slate-100 transition-colors"
                            >
                              {item.url}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-400 group-hover:text-indigo-400 transition-opacity shrink-0" />
                            </a>
                          </div>
                        </td>

                        {/* Status badge */}
                        <td className="py-4.5 px-6 text-center">
                          {check === null ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              PENDING
                            </span>
                          ) : check.isUp ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">
                              ONLINE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-rose-950/60 text-rose-400 border border-rose-500/20 animate-pulse">
                              OFFLINE
                            </span>
                          )}
                        </td>

                        {/* HTTP Status Code */}
                        <td className="py-4.5 px-6 text-center font-mono text-sm">
                          {check === null ? (
                            <span className="text-slate-500">-</span>
                          ) : check.statusCode ? (
                            <span className={check.isUp ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-bold'}>
                              {check.statusCode}
                            </span>
                          ) : (
                            <span className="text-rose-500 font-semibold text-xs inline-flex items-center gap-1 justify-center">
                              <AlertTriangle className="h-3.5 w-3.5" /> NET_ERR
                            </span>
                          )}
                        </td>

                        {/* Response Time */}
                        <td className="py-4.5 px-6 text-center font-mono text-sm">
                          {check === null ? (
                            <span className="text-slate-500">-</span>
                          ) : check.isUp ? (
                            <span className={`font-semibold ${
                              check.responseTime < 300 
                                ? 'text-emerald-400' 
                                : check.responseTime < 800 
                                  ? 'text-yellow-400' 
                                  : 'text-amber-500'
                            }`}>
                              {check.responseTime} ms
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>

                        {/* Last Checked Time */}
                        <td className="py-4.5 px-6 text-right text-xs text-slate-400 font-medium">
                          <div className="flex items-center justify-end gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <span>{getRelativeTime(check?.checkedAt)}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4.5 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedUrl(item)}
                              title="View History Logs"
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-400 hover:text-indigo-400 hover:border-indigo-500 hover:bg-indigo-950/30 transition-all cursor-pointer"
                            >
                              <History className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUrl(item.id, item.url)}
                              title="Delete URL"
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-400 hover:text-rose-400 hover:border-rose-500 hover:bg-rose-950/30 transition-all cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Footer Info */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/30 py-6 px-6 text-center text-xs text-slate-500">
        <p>© 2026 Uptime Pulse. Generated production-quality MVP stack. Docker orchestration ready.</p>
      </footer>

      {/* UPTIME HISTORY MODAL */}
      {selectedUrl && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div 
            className="glass-panel border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/60 flex justify-between items-start gap-4">
              <div>
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Health Metrics & Log History</span>
                <h3 className="text-lg font-bold text-white mt-1 break-all flex items-center gap-2">
                  {selectedUrl.url}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedUrl(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-sm font-semibold"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {historyLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                  <p className="text-slate-400 text-sm">Fetching historical logs from PostgreSQL...</p>
                </div>
              ) : historyError ? (
                <div className="py-12 text-center text-rose-400 flex items-center justify-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <p>{historyError}</p>
                </div>
              ) : history.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                  <Info className="h-10 w-10 text-slate-500" />
                  <p className="text-slate-400 text-sm">No checks registered yet. The cron runs every 1 minute.</p>
                </div>
              ) : (
                <>
                  {/* Summary Metric Stats Inside Modal */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 text-center">
                      <span className="text-xs font-semibold text-slate-400 uppercase block mb-1">Uptime Rate</span>
                      <span className="text-2xl font-bold text-emerald-400 font-display">
                        {modalStats.uptimeRate}%
                      </span>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 text-center">
                      <span className="text-xs font-semibold text-slate-400 uppercase block mb-1">Avg Response</span>
                      <span className="text-2xl font-bold text-white font-display">
                        {modalStats.avgResponse > 0 ? `${modalStats.avgResponse} ms` : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 text-center">
                      <span className="text-xs font-semibold text-slate-400 uppercase block mb-1">Total Logs</span>
                      <span className="text-2xl font-bold text-indigo-400 font-display">
                        {history.length}
                      </span>
                    </div>
                  </div>

                  {/* CUSTOM TIMELINE VISUALIZATION (Github commits graph style) */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Checks Timeline (Left = Newest)</h4>
                    <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50 flex flex-wrap gap-2.5 items-center">
                      {history.slice(0, 36).map((h, i) => (
                        <div 
                          key={h.id}
                          title={`Checked: ${new Date(h.checkedAt).toLocaleString()}\nStatus: ${h.isUp ? 'UP' : 'DOWN'}\nHTTP: ${h.statusCode || 'Net Error'}\nTime: ${h.isUp ? h.responseTime + 'ms' : 'N/A'}`}
                          className={`w-6.5 h-6.5 rounded-md flex items-center justify-center text-[9px] font-bold select-none cursor-help transition-all transform hover:scale-115 ${
                            h.isUp 
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-900/80' 
                              : 'bg-rose-950/60 text-rose-400 border border-rose-500/30 hover:border-rose-400 hover:bg-rose-900/80'
                          }`}
                        >
                          {h.isUp ? 'OK' : 'ERR'}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* List of checks */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Chronological Log Output</h4>
                    <div className="border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <div className="grid grid-cols-4 bg-slate-900 px-4 py-2 text-[10px] font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                        <span>Timestamp</span>
                        <span className="text-center">Status</span>
                        <span className="text-center">HTTP Code</span>
                        <span className="text-right">Response Time</span>
                      </div>
                      
                      <div className="divide-y divide-slate-800/50">
                        {history.map((checkObj) => (
                          <div 
                            key={checkObj.id} 
                            className="grid grid-cols-4 px-4 py-2.5 text-xs font-medium text-slate-300 items-center hover:bg-slate-800/20"
                          >
                            <span className="text-[11px] font-semibold text-slate-400">
                              {new Date(checkObj.checkedAt).toLocaleString()}
                            </span>
                            <span className="text-center">
                              {checkObj.isUp ? (
                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 glow-up" title="UP"></span>
                              ) : (
                                <span className="inline-block h-2 w-2 rounded-full bg-rose-500 glow-down" title="DOWN"></span>
                              )}
                            </span>
                            <span className="text-center font-mono font-semibold">
                              {checkObj.statusCode || 'NET_ERR'}
                            </span>
                            <span className="text-right font-mono text-[11px]">
                              {checkObj.isUp ? `${checkObj.responseTime} ms` : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
