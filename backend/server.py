from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import random
import numpy as np

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ===== MODELS =====

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str
    current_stock: int
    max_capacity: int
    low_stock_threshold: int
    unit: str
    weight_per_unit: float  # in kg
    price: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    category: str
    current_stock: int
    max_capacity: int
    low_stock_threshold: int
    unit: str
    weight_per_unit: float
    price: float

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    current_stock: Optional[int] = None
    max_capacity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    unit: Optional[str] = None
    weight_per_unit: Optional[float] = None
    price: Optional[float] = None

class SensorReading(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    stock_level: int
    weight: float  # in kg
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    product_name: str
    alert_type: str  # "low_stock", "out_of_stock", "predicted_stockout"
    message: str
    severity: str  # "low", "medium", "high"
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    stock_level: int
    change_amount: int
    change_type: str  # "restock", "sale", "adjustment"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Prediction(BaseModel):
    product_id: str
    product_name: str
    current_stock: int
    predicted_weekly_demand: float
    recommended_restock_quantity: int
    predicted_stockout_days: Optional[int]
    confidence: str  # "high", "medium", "low"

class DashboardStats(BaseModel):
    total_products: int
    low_stock_count: int
    out_of_stock_count: int
    total_alerts: int
    unread_alerts: int
    total_stock_value: float

# ===== UTILITY FUNCTIONS =====

def serialize_datetime(obj):
    """Convert datetime to ISO string for MongoDB"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def deserialize_datetime(doc):
    """Convert ISO string back to datetime"""
    for key, value in doc.items():
        if isinstance(value, str) and key in ['created_at', 'updated_at', 'timestamp']:
            try:
                doc[key] = datetime.fromisoformat(value)
            except:
                pass
    return doc

async def calculate_moving_average_prediction(product_id: str, days: int = 7) -> dict:
    """Calculate predictions using moving average algorithm"""
    # Get stock history for the product
    history = await db.stock_history.find(
        {"product_id": product_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(30).to_list(30)
    
    if len(history) < 3:
        return {
            "predicted_weekly_demand": 0,
            "recommended_restock": 0,
            "stockout_days": None,
            "confidence": "low"
        }
    
    # Deserialize timestamps
    for h in history:
        deserialize_datetime(h)
    
    # Calculate daily demand using moving average
    daily_changes = []
    for i in range(min(len(history) - 1, days)):
        if history[i]['change_type'] == 'sale':
            daily_changes.append(abs(history[i]['change_amount']))
    
    if not daily_changes:
        avg_daily_demand = 0
    else:
        avg_daily_demand = np.mean(daily_changes)
    
    # Predict weekly demand
    predicted_weekly_demand = avg_daily_demand * 7
    
    # Get current stock
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        return {
            "predicted_weekly_demand": 0,
            "recommended_restock": 0,
            "stockout_days": None,
            "confidence": "low"
        }
    
    deserialize_datetime(product)
    current_stock = product['current_stock']
    max_capacity = product['max_capacity']
    
    # Calculate days until stockout
    if avg_daily_demand > 0:
        stockout_days = int(current_stock / avg_daily_demand)
    else:
        stockout_days = None
    
    # Calculate recommended restock quantity
    safety_stock = predicted_weekly_demand * 0.3  # 30% safety buffer
    recommended_restock = int(max_capacity - current_stock + safety_stock)
    recommended_restock = max(0, min(recommended_restock, max_capacity - current_stock))
    
    # Determine confidence based on data points
    if len(daily_changes) >= 7:
        confidence = "high"
    elif len(daily_changes) >= 3:
        confidence = "medium"
    else:
        confidence = "low"
    
    return {
        "predicted_weekly_demand": round(predicted_weekly_demand, 2),
        "recommended_restock": recommended_restock,
        "stockout_days": stockout_days,
        "confidence": confidence
    }

async def check_and_create_alerts(product: dict):
    """Check product status and create alerts if needed"""
    product_id = product['id']
    product_name = product['name']
    current_stock = product['current_stock']
    low_threshold = product['low_stock_threshold']
    
    # Check for out of stock
    if current_stock == 0:
        existing = await db.alerts.find_one({
            "product_id": product_id,
            "alert_type": "out_of_stock",
            "is_read": False
        })
        if not existing:
            alert = Alert(
                product_id=product_id,
                product_name=product_name,
                alert_type="out_of_stock",
                message=f"{product_name} is out of stock!",
                severity="high"
            )
            doc = alert.model_dump()
            doc['created_at'] = serialize_datetime(doc['created_at'])
            await db.alerts.insert_one(doc)
    
    # Check for low stock
    elif current_stock <= low_threshold:
        existing = await db.alerts.find_one({
            "product_id": product_id,
            "alert_type": "low_stock",
            "is_read": False
        })
        if not existing:
            alert = Alert(
                product_id=product_id,
                product_name=product_name,
                alert_type="low_stock",
                message=f"{product_name} is running low (Stock: {current_stock})",
                severity="medium"
            )
            doc = alert.model_dump()
            doc['created_at'] = serialize_datetime(doc['created_at'])
            await db.alerts.insert_one(doc)
    
    # Check for predicted stockout
    prediction = await calculate_moving_average_prediction(product_id)
    if prediction['stockout_days'] is not None and prediction['stockout_days'] <= 3:
        existing = await db.alerts.find_one({
            "product_id": product_id,
            "alert_type": "predicted_stockout",
            "is_read": False
        })
        if not existing:
            alert = Alert(
                product_id=product_id,
                product_name=product_name,
                alert_type="predicted_stockout",
                message=f"{product_name} predicted to run out in {prediction['stockout_days']} days",
                severity="high" if prediction['stockout_days'] <= 1 else "medium"
            )
            doc = alert.model_dump()
            doc['created_at'] = serialize_datetime(doc['created_at'])
            await db.alerts.insert_one(doc)

# ===== ROUTES =====

@api_router.get("/")
async def root():
    return {"message": "Smart Retail Shelf Monitoring System API"}

# ===== PRODUCT ROUTES =====

@api_router.post("/products", response_model=Product)
async def create_product(product: ProductCreate):
    product_obj = Product(**product.model_dump())
    doc = product_obj.model_dump()
    doc['created_at'] = serialize_datetime(doc['created_at'])
    doc['updated_at'] = serialize_datetime(doc['updated_at'])
    await db.products.insert_one(doc)
    
    # Create initial stock history
    history = StockHistory(
        product_id=product_obj.id,
        stock_level=product_obj.current_stock,
        change_amount=product_obj.current_stock,
        change_type="initial"
    )
    history_doc = history.model_dump()
    history_doc['timestamp'] = serialize_datetime(history_doc['timestamp'])
    await db.stock_history.insert_one(history_doc)
    
    await check_and_create_alerts(doc)
    return product_obj

@api_router.get("/products", response_model=List[Product])
async def get_products():
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    for p in products:
        deserialize_datetime(p)
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    deserialize_datetime(product)
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, update: ProductUpdate):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data['updated_at'] = serialize_datetime(datetime.now(timezone.utc))
    
    # Track stock changes
    if 'current_stock' in update_data:
        old_stock = product['current_stock']
        new_stock = update_data['current_stock']
        change = new_stock - old_stock
        
        history = StockHistory(
            product_id=product_id,
            stock_level=new_stock,
            change_amount=change,
            change_type="restock" if change > 0 else "sale"
        )
        history_doc = history.model_dump()
        history_doc['timestamp'] = serialize_datetime(history_doc['timestamp'])
        await db.stock_history.insert_one(history_doc)
    
    await db.products.update_one({"id": product_id}, {"$set": update_data})
    updated_product = await db.products.find_one({"id": product_id}, {"_id": 0})
    deserialize_datetime(updated_product)
    
    await check_and_create_alerts(updated_product)
    return updated_product

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Clean up related data
    await db.stock_history.delete_many({"product_id": product_id})
    await db.sensor_readings.delete_many({"product_id": product_id})
    await db.alerts.delete_many({"product_id": product_id})
    
    return {"message": "Product deleted successfully"}

# ===== SENSOR ROUTES =====

@api_router.post("/sensors/simulate/{product_id}")
async def simulate_sensor_reading(product_id: str):
    """Simulate IoT sensor reading for a product"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    deserialize_datetime(product)
    
    # Simulate slight variations in readings
    stock_variance = random.randint(-2, 2)
    new_stock = max(0, product['current_stock'] + stock_variance)
    new_weight = new_stock * product['weight_per_unit'] + random.uniform(-0.5, 0.5)
    
    # Save sensor reading
    reading = SensorReading(
        product_id=product_id,
        stock_level=new_stock,
        weight=round(new_weight, 2)
    )
    reading_doc = reading.model_dump()
    reading_doc['timestamp'] = serialize_datetime(reading_doc['timestamp'])
    await db.sensor_readings.insert_one(reading_doc)
    
    # Update product stock if changed
    if new_stock != product['current_stock']:
        change = new_stock - product['current_stock']
        await db.products.update_one(
            {"id": product_id},
            {"$set": {
                "current_stock": new_stock,
                "updated_at": serialize_datetime(datetime.now(timezone.utc))
            }}
        )
        
        # Record stock change
        history = StockHistory(
            product_id=product_id,
            stock_level=new_stock,
            change_amount=change,
            change_type="sale" if change < 0 else "restock"
        )
        history_doc = history.model_dump()
        history_doc['timestamp'] = serialize_datetime(history_doc['timestamp'])
        await db.stock_history.insert_one(history_doc)
        
        # Check for alerts
        updated_product = await db.products.find_one({"id": product_id}, {"_id": 0})
        await check_and_create_alerts(updated_product)
    
    deserialize_datetime(reading_doc)
    # Remove MongoDB _id if present to avoid serialization issues
    reading_doc.pop('_id', None)
    return reading_doc

@api_router.get("/sensors/readings/{product_id}", response_model=List[SensorReading])
async def get_sensor_readings(product_id: str, limit: int = 50):
    readings = await db.sensor_readings.find(
        {"product_id": product_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for r in readings:
        deserialize_datetime(r)
    return readings

# ===== ALERT ROUTES =====

@api_router.get("/alerts", response_model=List[Alert])
async def get_alerts(unread_only: bool = False):
    query = {"is_read": False} if unread_only else {}
    alerts = await db.alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for a in alerts:
        deserialize_datetime(a)
    return alerts

@api_router.put("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str):
    result = await db.alerts.update_one(
        {"id": alert_id},
        {"$set": {"is_read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert marked as read"}

@api_router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    result = await db.alerts.delete_one({"id": alert_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert deleted successfully"}

# ===== PREDICTION ROUTES =====

@api_router.get("/predictions", response_model=List[Prediction])
async def get_predictions():
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    predictions = []
    
    for product in products:
        deserialize_datetime(product)
        pred_data = await calculate_moving_average_prediction(product['id'])
        
        prediction = Prediction(
            product_id=product['id'],
            product_name=product['name'],
            current_stock=product['current_stock'],
            predicted_weekly_demand=pred_data['predicted_weekly_demand'],
            recommended_restock_quantity=pred_data['recommended_restock'],
            predicted_stockout_days=pred_data['stockout_days'],
            confidence=pred_data['confidence']
        )
        predictions.append(prediction)
    
    return predictions

@api_router.get("/predictions/{product_id}", response_model=Prediction)
async def get_product_prediction(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    deserialize_datetime(product)
    pred_data = await calculate_moving_average_prediction(product_id)
    
    return Prediction(
        product_id=product['id'],
        product_name=product['name'],
        current_stock=product['current_stock'],
        predicted_weekly_demand=pred_data['predicted_weekly_demand'],
        recommended_restock_quantity=pred_data['recommended_restock'],
        predicted_stockout_days=pred_data['stockout_days'],
        confidence=pred_data['confidence']
    )

# ===== DASHBOARD ROUTES =====

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    alerts = await db.alerts.find({}, {"_id": 0}).to_list(1000)
    
    for p in products:
        deserialize_datetime(p)
    
    total_products = len(products)
    low_stock_count = sum(1 for p in products if 0 < p['current_stock'] <= p['low_stock_threshold'])
    out_of_stock_count = sum(1 for p in products if p['current_stock'] == 0)
    total_stock_value = sum(p['current_stock'] * p['price'] for p in products)
    unread_alerts = sum(1 for a in alerts if not a['is_read'])
    
    return DashboardStats(
        total_products=total_products,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        total_alerts=len(alerts),
        unread_alerts=unread_alerts,
        total_stock_value=round(total_stock_value, 2)
    )

@api_router.get("/dashboard/stock-trends")
async def get_stock_trends():
    """Get stock level trends for the past 7 days"""
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    trends = []
    
    for product in products:
        history = await db.stock_history.find(
            {"product_id": product['id']},
            {"_id": 0}
        ).sort("timestamp", -1).limit(7).to_list(7)
        
        for h in history:
            deserialize_datetime(h)
        
        trend_data = [
            {
                "date": h['timestamp'].strftime("%Y-%m-%d"),
                "stock": h['stock_level']
            } for h in reversed(history)
        ]
        
        trends.append({
            "product_id": product['id'],
            "product_name": product['name'],
            "data": trend_data
        })
    
    return trends

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()