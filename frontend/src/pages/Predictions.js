import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { TrendingUp, Package, AlertCircle, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Predictions = () => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPredictions();
    const interval = setInterval(fetchPredictions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchPredictions = async () => {
    try {
      const response = await axios.get(`${API}/predictions`);
      setPredictions(response.data);
    } catch (error) {
      toast.error('Failed to fetch predictions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadge = (confidence) => {
    const colors = {
      high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[confidence] || colors.low;
  };

  const getStockoutStatus = (days) => {
    if (days === null) return { text: 'Stable', color: 'text-green-600 dark:text-green-400', icon: TrendingUp };
    if (days <= 1) return { text: `Critical (${days}d)`, color: 'text-red-600 dark:text-red-400', icon: AlertCircle };
    if (days <= 3) return { text: `Warning (${days}d)`, color: 'text-yellow-600 dark:text-yellow-400', icon: TrendingDown };
    return { text: `${days} days`, color: 'text-blue-600 dark:text-blue-400', icon: TrendingUp };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="predictions-loading">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading predictions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="predictions-page">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">ML Predictions</h1>
        <p className="text-slate-600 dark:text-slate-400">AI-powered demand forecasting and restock recommendations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {predictions.map((prediction) => {
          const stockoutStatus = getStockoutStatus(prediction.predicted_stockout_days);
          const StatusIcon = stockoutStatus.icon;
          
          return (
            <Card key={prediction.product_id} className="card-hover border-0 shadow-lg dark:bg-slate-900/50 backdrop-blur" data-testid={`prediction-card-${prediction.product_id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg text-slate-900 dark:text-white mb-1">{prediction.product_name}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge className={getConfidenceBadge(prediction.confidence)}>
                        {prediction.confidence.toUpperCase()} CONFIDENCE
                      </Badge>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Stock */}
                <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Package className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Current Stock</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{prediction.current_stock}</span>
                  </div>
                </div>

                {/* Predictions Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">Weekly Demand</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                      {prediction.predicted_weekly_demand.toFixed(1)}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
                    <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Restock Qty</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-300">
                      {prediction.recommended_restock_quantity}
                    </p>
                  </div>
                </div>

                {/* Stockout Prediction */}
                <div className={`p-4 rounded-lg border-2 border-dashed ${
                  prediction.predicted_stockout_days === null 
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                    : prediction.predicted_stockout_days <= 1
                    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                    : 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <StatusIcon className={`w-5 h-5 ${stockoutStatus.color}`} />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Stockout Prediction</span>
                    </div>
                    <span className={`text-lg font-bold ${stockoutStatus.color}`}>
                      {stockoutStatus.text}
                    </span>
                  </div>
                </div>

                {/* Recommendation */}
                {prediction.predicted_stockout_days !== null && prediction.predicted_stockout_days <= 3 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      <span className="font-semibold">Action Required:</span> Restock {prediction.recommended_restock_quantity} units to prevent stockout
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {predictions.length === 0 && (
        <Card className="border-0 shadow-lg dark:bg-slate-900/50 backdrop-blur">
          <CardContent className="py-16 text-center">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-600 dark:text-slate-400 mb-2">No predictions available</p>
            <p className="text-sm text-slate-500 dark:text-slate-500">Add products and generate stock history to see ML predictions</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Predictions;