import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Activity, 
  Trash2, 
  Plus, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  History, 
  Info,
  XCircle,
  Hourglass,
  Layers
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
    <div className="min-h-screen flex flex-col font-sans bg-[#f8f9fa] text-slate-800">
      
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="border border-slate-800 bg-white h-10 w-10 flex items-center justify-center text-slate-800 rounded-none shadow-sm shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-sans font-bold text-slate-900 leading-tight">
              Uptime Pulse
            </h1>
            <p className="text-[10px] font-mono tracking-[0.2em] text-slate-500 uppercase mt-0.5">Live Monitor MVP</p>
          </div>
        </div>

        {/* Sync & Refresh section */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f8f9fa] border border-slate-200 rounded-full text-[11px] font-mono text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Refreshing in {countdown}s</span>
          </div>
          <button 
            onClick={() => fetchUrls()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-800 hover:bg-slate-50 text-[11px] font-mono font-semibold tracking-wider text-slate-800 cursor-pointer uppercase transition-colors rounded-none"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync</span>
          </button>
        </div>
      </header>

      {/* Main container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-8">
        
        {/* Connection Error Notification */}
        {error && (
          <div className="rounded-none border border-rose-500 bg-rose-50/50 p-4 text-rose-800 flex items-start gap-3 animate-fade-in font-mono text-xs">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-rose-700 uppercase">Connection Error</h3>
              <p className="text-rose-600 mt-1">{error}</p>
              <button 
                onClick={() => fetchUrls()} 
                className="mt-3 px-3.5 py-1 bg-white border border-rose-500 hover:bg-rose-550 text-rose-700 font-bold transition-colors cursor-pointer uppercase text-[10px]"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Top Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between rounded-none shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Total Monitored URLs</span>
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-bold font-mono text-slate-800">{totalUrls}</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 mt-2">Registered endpoints</span>
          </div>

          <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between rounded-none shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Services UP</span>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-bold font-mono text-emerald-600">{urlsUp}</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 mt-2">
              {totalUrls > 0 ? ((urlsUp / totalUrls) * 100).toFixed(2) : '0.00'}% uptime rate
            </span>
          </div>

          <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between rounded-none shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Services DOWN</span>
              <XCircle className="h-4 w-4 text-rose-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-bold font-mono text-rose-600">{urlsDown}</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 mt-2">Failing endpoints</span>
          </div>

          <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between rounded-none shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Pending Checks</span>
              <Hourglass className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-bold font-mono text-amber-600">{urlsPending}</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 mt-2">Awaiting first ping</span>
          </div>

        </div>

        {/* Add URL Form Control Section */}
        <section className="bg-white border border-slate-200 p-6 rounded-none shadow-sm relative">
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-sans font-bold text-slate-800">Add New Target URL</h2>
              <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase mt-0.5">
                Register an endpoint to monitor
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-400">ping interval - 60s</span>
          </div>

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
                  className="w-full bg-white border border-slate-300 rounded-none px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-all font-mono text-sm"
                  disabled={submitting}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#0055ff] hover:bg-[#0044dd] disabled:bg-slate-400 text-white text-xs font-mono font-semibold tracking-wider px-6 py-2.5 rounded-none transition-colors shadow-none flex items-center justify-center gap-2 uppercase cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Monitor URL</span>
                  </>
                )}
              </button>
            </div>

            {formError && (
              <div className="text-rose-600 font-mono text-xs font-medium flex items-center gap-1.5 animate-slide-up">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{formError}</span>
              </div>
            )}
            
            {formSuccess && (
              <div className="text-emerald-600 font-mono text-xs font-medium flex items-center gap-1.5 animate-slide-up">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>{formSuccess}</span>
              </div>
            )}
          </form>
        </section>

        {/* Monitored URLs Data Display Table */}
        <section className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-sans font-bold text-slate-800">Monitored Endpoints</h2>
              <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase mt-0.5">
                {totalUrls} {totalUrls === 1 ? 'target' : 'targets'}
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Live Database Sync</span>
          </div>

          {loading ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
              <p className="text-slate-500 font-mono text-xs">Loading registered URLs from Postgres...</p>
            </div>
          ) : urls.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-4 border border-dashed border-slate-200 m-6 rounded-none bg-slate-50/50">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Info className="h-6 w-6" />
              </div>
              <div className="font-mono">
                <p className="text-slate-700 font-semibold text-sm">No URLs Monitored</p>
                <p className="text-slate-400 text-xs mt-1">Please enter a URL above to start registering health queries.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    <th className="py-4 px-6">Endpoint Address</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-6 text-center">HTTP</th>
                    <th className="py-4 px-6 text-center">Response Time</th>
                    <th className="py-4 px-6 text-right">Last Verified</th>
                    <th className="py-4 px-6 text-center">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {urls.map((item) => {
                    const check = item.latestCheck;
                    
                    return (
                      <tr 
                        key={item.id} 
                        className="group hover:bg-slate-50/50 transition-colors"
                      >
                        {/* URL Name */}
                        <td className="py-4 px-6 font-medium text-slate-800 max-w-[280px] md:max-w-md truncate">
                          <div className="flex items-center gap-2.5">
                            <span 
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                check === null 
                                  ? 'bg-slate-400' 
                                  : check.isUp 
                                    ? 'bg-emerald-500 glow-up' 
                                    : 'bg-rose-500 glow-down'
                              }`}
                            ></span>
                            <a 
                              href={item.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="hover:text-indigo-600 hover:underline inline-flex items-center gap-1 font-semibold truncate text-slate-800 transition-colors"
                            >
                              {item.url}
                              <ExternalLink className="h-3 w-3 text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
                            </a>
                          </div>
                        </td>

                        {/* Status badge */}
                        <td className="py-4 px-6 text-center">
                          {check === null ? (
                            <span className="inline-block border border-slate-300 text-slate-500 bg-slate-50 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-none">
                              PENDING
                            </span>
                          ) : check.isUp ? (
                            <span className="inline-block border border-emerald-500 text-emerald-600 bg-emerald-50/30 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-none">
                              ONLINE
                            </span>
                          ) : (
                            <span className="inline-block border border-rose-500 text-rose-500 bg-rose-50/30 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-none">
                              OFFLINE
                            </span>
                          )}
                        </td>

                        {/* HTTP Status Code */}
                        <td className="py-4 px-6 text-center font-mono text-xs">
                          {check === null ? (
                            <span className="text-slate-400">-</span>
                          ) : check.statusCode ? (
                            <span className={check.isUp ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                              {check.statusCode}
                            </span>
                          ) : (
                            <span className="text-rose-600 font-bold text-[10px] inline-flex items-center gap-0.5 justify-center">
                              NET_ERR
                            </span>
                          )}
                        </td>

                        {/* Response Time */}
                        <td className="py-4 px-6 text-center font-mono text-xs">
                          {check === null ? (
                            <span className="text-slate-400">-</span>
                          ) : check.isUp ? (
                            <span className="text-slate-700 font-medium">
                              {check.responseTime} ms
                            </span>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>

                        {/* Last Checked Time */}
                        <td className="py-4 px-6 text-right text-xs text-slate-500">
                          <div className="flex items-center justify-end gap-1.5">
                            <span>{getRelativeTime(check?.checkedAt)}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedUrl(item)}
                              title="View History Logs"
                              className="p-1.5 bg-white border border-slate-300 hover:border-slate-800 hover:bg-slate-50 text-slate-600 transition-colors rounded-none cursor-pointer"
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUrl(item.id, item.url)}
                              title="Delete URL"
                              className="p-1.5 bg-white border border-slate-300 hover:border-rose-500 hover:text-rose-600 hover:bg-rose-50 text-slate-450 hover:text-rose-600 transition-colors rounded-none cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
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
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 px-6 text-center text-[10px] font-mono text-slate-400 tracking-wider">
        <p>© 2026 UPTIME PULSE. ALL RIGHTS RESERVED. MVP STACK RUNNING.</p>
      </footer>

      {/* UPTIME HISTORY MODAL */}
      {selectedUrl && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div 
            className="bg-white border border-slate-200 rounded-none w-full max-w-3xl overflow-hidden shadow-lg relative flex flex-col max-h-[85vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex justify-between items-start gap-4">
              <div>
                <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest">Health Metrics & Log History</span>
                <h3 className="text-base font-sans font-bold text-slate-800 mt-1 break-all flex items-center gap-2">
                  {selectedUrl.url}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedUrl(null)}
                className="px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors text-xs font-mono font-semibold rounded-none cursor-pointer uppercase"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {historyLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
                  <p className="text-slate-500 font-mono text-xs">Fetching historical logs from PostgreSQL...</p>
                </div>
              ) : historyError ? (
                <div className="py-12 text-center text-rose-600 font-mono text-xs flex items-center justify-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <p>{historyError}</p>
                </div>
              ) : history.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3 font-mono">
                  <Info className="h-8 w-8 text-slate-400" />
                  <p className="text-slate-500 text-xs">No checks registered yet. The cron runs every 1 minute.</p>
                </div>
              ) : (
                <>
                  {/* Summary Metric Stats Inside Modal */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-none p-4 text-center">
                      <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase block mb-1">Uptime Rate</span>
                      <span className="text-xl font-bold text-emerald-600 font-mono">
                        {modalStats.uptimeRate}%
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-none p-4 text-center">
                      <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase block mb-1">Avg Response</span>
                      <span className="text-xl font-bold text-slate-800 font-mono">
                        {modalStats.avgResponse > 0 ? `${modalStats.avgResponse} ms` : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-none p-4 text-center">
                      <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase block mb-1">Total Logs</span>
                      <span className="text-xl font-bold text-slate-800 font-mono">
                        {history.length}
                      </span>
                    </div>
                  </div>

                  {/* Recent Checks Timeline */}
                  <div>
                    <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-3">Recent Checks Timeline (Left = Newest)</h4>
                    <div className="bg-slate-50/55 rounded-none p-4 border border-slate-200 flex flex-wrap gap-2 items-center">
                      {history.slice(0, 36).map((h) => (
                        <div 
                          key={h.id}
                          title={`Checked: ${new Date(h.checkedAt).toLocaleString()}\nStatus: ${h.isUp ? 'UP' : 'DOWN'}\nHTTP: ${h.statusCode || 'Net Error'}\nTime: ${h.isUp ? h.responseTime + 'ms' : 'N/A'}`}
                          className={`w-6.5 h-6.5 rounded-none flex items-center justify-center text-[9px] font-mono font-bold select-none cursor-help transition-all transform hover:scale-105 ${
                            h.isUp 
                              ? 'bg-emerald-55 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                              : 'bg-rose-55 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {h.isUp ? 'OK' : 'ERR'}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* List of checks */}
                  <div>
                    <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-3">Chronological Log Output</h4>
                    <div className="border border-slate-200 rounded-none overflow-hidden max-h-72 overflow-y-auto">
                      <div className="grid grid-cols-4 bg-slate-50 px-4 py-2 text-[9px] font-mono font-bold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
                        <span>Timestamp</span>
                        <span className="text-center">Status</span>
                        <span className="text-center">HTTP Code</span>
                        <span className="text-right">Response Time</span>
                      </div>
                      
                      <div className="divide-y divide-slate-100 font-mono text-[11px]">
                        {history.map((checkObj) => (
                          <div 
                            key={checkObj.id} 
                            className="grid grid-cols-4 px-4 py-2.5 text-slate-700 items-center hover:bg-slate-50/50"
                          >
                            <span className="text-slate-500">
                              {new Date(checkObj.checkedAt).toLocaleString()}
                            </span>
                            <span className="text-center">
                              {checkObj.isUp ? (
                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="UP"></span>
                              ) : (
                                <span className="inline-block h-2 w-2 rounded-full bg-rose-500" title="DOWN"></span>
                              )}
                            </span>
                            <span className="text-center font-bold">
                              {checkObj.statusCode || 'NET_ERR'}
                            </span>
                            <span className="text-right">
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
