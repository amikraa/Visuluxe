import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { devLog } from '@/lib/logger';

interface DashboardStats {
  totalUsers: number;
  activeModels: number;
  apiRequests: number;
  failedRate: number;
}

export default function AdminDashboard() {
  const { isSuperAdmin, isAdmin } = useAdmin();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeModels: 0,
    apiRequests: 0,
    failedRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch user count
        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // Fetch active models count
        const { count: modelCount } = await supabase
          .from('ai_models')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        setStats({
          totalUsers: userCount || 0,
          activeModels: modelCount || 0,
          apiRequests: 843200, // Placeholder - would come from analytics
          failedRate: 1.4, // Placeholder
        });
      } catch (error) {
        devLog.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Row */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">System Overview</h2>
          <p className="text-slate-400 text-sm">Real-time platform metrics and status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-admin-success/10 text-admin-success text-xs font-bold border border-admin-success/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-admin-success animate-pulse"></span>
            SYSTEM NORMAL
          </span>
          <span className="px-3 py-1 rounded-full bg-admin-surface text-slate-400 text-xs font-medium border border-admin-border">
            UTC: {new Date().toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Users"
          value={loading ? '...' : stats.totalUsers.toLocaleString()}
          icon="group"
          trend="+5.2% this week"
          trendUp
        />
        <StatCard
          label="Active Models"
          value={loading ? '...' : stats.activeModels.toString()}
          icon="view_in_ar"
          subtitle="Stable diffusion & Flux"
        />
        <StatCard
          label="API Requests (24h)"
          value={loading ? '...' : `${(stats.apiRequests / 1000).toFixed(1)}K`}
          icon="api"
          trend="+12.4%"
          trendUp
        />
        <StatCard
          label="Failed Gen Rate"
          value={`${stats.failedRate}%`}
          icon="warning"
          trend="-0.2% improvement"
          trendUp
          variant="danger"
        />
        <StatCard
          label="Security Incidents"
          value="0"
          icon="shield"
          subtitle="Last incident: 4d ago"
          variant="danger"
        />
      </div>

      {/* DDoS Protection Banner */}
      <div className="bg-admin-surface/70 backdrop-blur-xl border border-admin-border rounded-xl border-l-4 border-l-admin-danger overflow-hidden">
        <div className="p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-admin-danger/10 rounded-lg text-admin-danger">
              <span className="material-symbols-outlined text-3xl">gpp_maybe</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">DDoS Protection Status</h3>
              <p className="text-slate-400 text-sm mt-1">System is monitoring traffic patterns. No active attacks detected.</p>
              <div className="flex flex-wrap gap-4 mt-3 text-xs font-mono text-slate-500">
                <span>Requests/sec: <span className="text-slate-300">142</span></span>
                <span>Blocked IPs (1h): <span className="text-slate-300">23</span></span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-4">
              <button className="bg-transparent border border-admin-danger/40 text-admin-danger hover:bg-admin-danger hover:text-white px-5 py-3 rounded-lg font-bold text-sm transition-all flex items-center gap-2">
                <span className="material-symbols-outlined">bolt</span>
                Enable "Under Attack" Mode
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <QuickLink
          to="/admin/models"
          icon="view_in_ar"
          title="Manage Models"
          description="Add, edit, or disable AI models"
        />
        <QuickLink
          to="/admin/users"
          icon="group"
          title="User Management"
          description="View and manage user accounts"
        />
        <QuickLink
          to="/admin/logs"
          icon="terminal"
          title="System Logs"
          description="View real-time activity logs"
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-admin-surface/70 backdrop-blur-xl border border-admin-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-admin-border flex justify-between items-center">
          <h3 className="text-white font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-admin-primary">terminal</span>
            Recent Activity
          </h3>
          <Link to="/admin/logs" className="text-admin-primary text-sm hover:underline">
            View All
          </Link>
        </div>
        <div className="p-4 font-mono text-xs space-y-2 max-h-64 overflow-y-auto">
          <LogEntry time="14:30:02" level="INFO" message="User #8291 gen_img success (SDXL)" />
          <LogEntry time="14:30:05" level="INFO" message="User #1102 gen_img success (MJv6)" />
          <LogEntry time="14:30:12" level="WARN" message="High latency detected on Replicate API (1200ms)" />
          <LogEntry time="14:30:45" level="INFO" message="User #9932 gen_img success (SDXL)" />
          <LogEntry time="14:31:01" level="BLOCK" message="IP 192.168.1.42 blocked (Rate Limit Exceeded)" isError />
          <LogEntry time="14:31:15" level="INFO" message="User #4421 gen_img success (DALL-E)" />
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  variant?: 'default' | 'danger';
}

function StatCard({ label, value, icon, trend, trendUp, subtitle, variant = 'default' }: StatCardProps) {
  return (
    <div className={`bg-admin-surface/70 backdrop-blur-xl border border-admin-border p-5 rounded-xl flex flex-col justify-between h-32 hover:border-${variant === 'danger' ? 'admin-danger' : 'admin-primary'}/50 transition-colors group cursor-pointer`}>
      <div className="flex justify-between items-start">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        <span className={`material-symbols-outlined text-slate-600 group-hover:text-${variant === 'danger' ? 'admin-danger' : 'admin-primary'} transition-colors`}>
          {icon}
        </span>
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trendUp ? 'text-admin-success' : 'text-admin-danger'} mt-1`}>
            <span className="material-symbols-outlined text-[14px]">
              {trendUp ? 'trending_up' : 'trending_down'}
            </span>
            <span>{trend}</span>
          </div>
        )}
        {subtitle && (
          <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

interface QuickLinkProps {
  to: string;
  icon: string;
  title: string;
  description: string;
}

function QuickLink({ to, icon, title, description }: QuickLinkProps) {
  return (
    <Link
      to={to}
      className="bg-admin-surface/70 backdrop-blur-xl border border-admin-border rounded-xl p-6 hover:border-admin-primary/50 transition-all group"
    >
      <div className="flex items-center gap-4">
        <div className="p-3 bg-admin-primary/10 rounded-lg text-admin-primary group-hover:bg-admin-primary group-hover:text-white transition-colors">
          <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
        <div>
          <h4 className="text-white font-bold">{title}</h4>
          <p className="text-slate-400 text-sm">{description}</p>
        </div>
      </div>
    </Link>
  );
}

interface LogEntryProps {
  time: string;
  level: string;
  message: string;
  isError?: boolean;
}

function LogEntry({ time, level, message, isError }: LogEntryProps) {
  const levelColors: Record<string, string> = {
    INFO: 'text-green-400',
    WARN: 'text-yellow-400',
    ERROR: 'text-red-400',
    BLOCK: 'text-red-400',
  };

  return (
    <div className={`flex gap-2 ${isError ? 'bg-red-900/10 -mx-4 px-4 py-1 rounded' : ''}`}>
      <span className="text-slate-500">[{time}]</span>
      <span className={levelColors[level] || 'text-slate-300'}>{level}</span>
      <span className={isError ? 'text-red-200' : 'text-slate-300'}>{message}</span>
    </div>
  );
}
