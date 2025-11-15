import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { AlertTriangle, CheckCircle, Trash2, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${API}/alerts`, {
        params: { unread_only: filter === 'unread' }
      });
      setAlerts(response.data);
    } catch (error) {
      toast.error('Failed to fetch alerts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (alertId) => {
    try {
      await axios.put(`${API}/alerts/${alertId}/read`);
      toast.success('Alert marked as read');
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to update alert');
      console.error(error);
    }
  };

  const handleDelete = async (alertId) => {
    try {
      await axios.delete(`${API}/alerts/${alertId}`);
      toast.success('Alert deleted');
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to delete alert');
      console.error(error);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    };
    return colors[severity] || colors.low;
  };

  const getAlertIcon = (alertType) => {
    switch (alertType) {
      case 'out_of_stock':
      case 'low_stock':
      case 'predicted_stockout':
        return AlertTriangle;
      default:
        return Bell;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="alerts-loading">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="alerts-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Alerts</h1>
          <p className="text-slate-600 dark:text-slate-400">Monitor critical inventory notifications</p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => setFilter('all')}
            variant={filter === 'all' ? 'default' : 'outline'}
            className={filter === 'all' ? 'bg-blue-500 hover:bg-blue-600' : ''}
            data-testid="filter-all-button"
          >
            All Alerts
          </Button>
          <Button
            onClick={() => setFilter('unread')}
            variant={filter === 'unread' ? 'default' : 'outline'}
            className={filter === 'unread' ? 'bg-blue-500 hover:bg-blue-600' : ''}
            data-testid="filter-unread-button"
          >
            Unread Only
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = getAlertIcon(alert.alert_type);
          return (
            <Card
              key={alert.id}
              className={`card-hover border-l-4 ${getSeverityColor(alert.severity)} border-0 shadow-lg dark:bg-slate-900/50 backdrop-blur ${
                !alert.is_read ? 'bg-blue-50 dark:bg-blue-950/20' : ''
              }`}
              data-testid={`alert-card-${alert.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getSeverityColor(alert.severity)} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{alert.product_name}</h3>
                      <Badge className={getSeverityBadge(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      {!alert.is_read && (
                        <Badge className="bg-blue-500 text-white">NEW</Badge>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">{alert.message}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {!alert.is_read && (
                      <Button
                        onClick={() => handleMarkRead(alert.id)}
                        variant="outline"
                        size="sm"
                        className="text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                        data-testid={`mark-read-${alert.id}`}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDelete(alert.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      data-testid={`delete-alert-${alert.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {alerts.length === 0 && (
        <Card className="border-0 shadow-lg dark:bg-slate-900/50 backdrop-blur">
          <CardContent className="py-16 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-600 dark:text-slate-400 mb-2">No alerts found</p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {filter === 'unread' ? 'All alerts have been read' : 'Your inventory is healthy'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Alerts;