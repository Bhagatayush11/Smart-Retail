import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Plus, Edit, Trash2, Package, Activity } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    current_stock: 0,
    max_capacity: 0,
    low_stock_threshold: 0,
    unit: 'units',
    weight_per_unit: 0,
    price: 0
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
    } catch (error) {
      toast.error('Failed to fetch products');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await axios.put(`${API}/products/${editingProduct.id}`, formData);
        toast.success('Product updated successfully');
      } else {
        await axios.post(`${API}/products`, formData);
        toast.success('Product created successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      toast.error('Operation failed');
      console.error(error);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      current_stock: product.current_stock,
      max_capacity: product.max_capacity,
      low_stock_threshold: product.low_stock_threshold,
      unit: product.unit,
      weight_per_unit: product.weight_per_unit,
      price: product.price
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await axios.delete(`${API}/products/${id}`);
      toast.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      toast.error('Failed to delete product');
      console.error(error);
    }
  };

  const handleSimulateSensor = async (productId) => {
    try {
      await axios.post(`${API}/sensors/simulate/${productId}`);
      toast.success('Sensor reading simulated');
      fetchProducts();
    } catch (error) {
      toast.error('Simulation failed');
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      current_stock: 0,
      max_capacity: 0,
      low_stock_threshold: 0,
      unit: 'units',
      weight_per_unit: 0,
      price: 0
    });
    setEditingProduct(null);
  };

  const getStockStatus = (product) => {
    if (product.current_stock === 0) return { text: 'Out of Stock', color: 'bg-red-500' };
    if (product.current_stock <= product.low_stock_threshold) return { text: 'Low Stock', color: 'bg-yellow-500' };
    return { text: 'In Stock', color: 'bg-green-500' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="products-loading">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="products-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Products</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage your inventory products</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-600" data-testid="add-product-button">
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="product-dialog">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-product-name"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    data-testid="input-category"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="current_stock">Current Stock</Label>
                  <Input
                    id="current_stock"
                    type="number"
                    value={formData.current_stock}
                    onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) })}
                    required
                    data-testid="input-current-stock"
                  />
                </div>
                <div>
                  <Label htmlFor="max_capacity">Max Capacity</Label>
                  <Input
                    id="max_capacity"
                    type="number"
                    value={formData.max_capacity}
                    onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) })}
                    required
                    data-testid="input-max-capacity"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) })}
                    required
                    data-testid="input-threshold"
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    required
                    data-testid="input-unit"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="weight_per_unit">Weight per Unit (kg)</Label>
                  <Input
                    id="weight_per_unit"
                    type="number"
                    step="0.01"
                    value={formData.weight_per_unit}
                    onChange={(e) => setFormData({ ...formData, weight_per_unit: parseFloat(e.target.value) })}
                    required
                    data-testid="input-weight"
                  />
                </div>
                <div>
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    required
                    data-testid="input-price"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-blue-500 hover:bg-blue-600" data-testid="submit-product-button">
                  {editingProduct ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const status = getStockStatus(product);
          const stockPercentage = (product.current_stock / product.max_capacity) * 100;
          
          return (
            <Card key={product.id} className="card-hover border-0 shadow-lg dark:bg-slate-900/50 backdrop-blur" data-testid={`product-card-${product.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg text-slate-900 dark:text-white mb-1">{product.name}</CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{product.category}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${status.color} animate-pulse-slow`}></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600 dark:text-slate-400">Stock Level</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {product.current_stock} / {product.max_capacity} {product.unit}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                      style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Price</p>
                    <p className="font-semibold text-slate-900 dark:text-white">${product.price}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Weight/Unit</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{product.weight_per_unit} kg</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Button
                    onClick={() => handleSimulateSensor(product.id)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    data-testid={`simulate-sensor-${product.id}`}
                  >
                    <Activity className="w-4 h-4 mr-1" />
                    Simulate
                  </Button>
                  <Button
                    onClick={() => handleEdit(product)}
                    variant="outline"
                    size="sm"
                    data-testid={`edit-product-${product.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(product.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    data-testid={`delete-product-${product.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {products.length === 0 && (
        <Card className="border-0 shadow-lg dark:bg-slate-900/50 backdrop-blur">
          <CardContent className="py-16 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-600 dark:text-slate-400 mb-4">No products found</p>
            <p className="text-sm text-slate-500 dark:text-slate-500">Get started by adding your first product</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Products;