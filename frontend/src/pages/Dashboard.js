import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Package, AlertTriangle, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, trendsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/dashboard/stock-trends`)
      ]);
      setStats(statsRes.data);
      setTrends(trendsRes.data);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Products',
      value: stats?.total_products || 0,
      icon: Package,
      color: 'from-blue-500 to-blue-600',
      testId: 'stat-total-products'
    },
    {
      title: 'Low Stock Items',
      value: stats?.low_stock_count || 0,
      icon: AlertTriangle,
      color: 'from-yellow-500 to-yellow-600',
      testId: 'stat-low-stock'
    },
    {
      title: 'Out of Stock',
      value: stats?.out_of_stock_count || 0,
      icon: TrendingDown,
      color: 'from-red-500 to-red-600',
      testId: 'stat-out-of-stock'
    },
    {
      title: 'Total Stock Value',
      value: `$${(stats?.total_stock_value || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'from-green-500 to-green-600',
      testId: 'stat-stock-value'
    },
    {
      title: 'Active Alerts',
      value: stats?.unread_alerts || 0,
      icon: Activity,
      color: 'from-purple-500 to-purple-600',
      testId: 'stat-active-alerts'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="dashboard-loading">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard-page">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">Real-time inventory monitoring and insights</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="card-hover border-0 shadow-lg dark:bg-slate-900/50 backdrop-blur" data-testid={stat.testId}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                  </div>
                  <div className={`w-14 h-14 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Trends */}
        <Card className="border-0 shadow-lg dark:bg-slate-900/50 backdrop-blur" data-testid="stock-trends-chart">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Stock Level Trends</CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">Last 7 days stock movement</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends[0]?.data || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Line type="monotone" dataKey="stock" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stock Distribution */}
        <Card className="border-0 shadow-lg dark:bg-slate-900/50 backdrop-blur" data-testid="stock-distribution-chart">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Stock Distribution</CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">Current inventory levels</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends.slice(0, 5).map(t => ({
                name: t.product_name,
                stock: t.data[t.data.length - 1]?.stock || 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} angle={-15} textAnchor="end" height={80} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar dataKey="stock" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;