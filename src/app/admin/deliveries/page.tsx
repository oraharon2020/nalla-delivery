'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, DeliveryAssignment, Store, User } from '@/lib/supabase';
import RouteOptimizerModal from '@/components/RouteOptimizerModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WooOrder {
  id: number;
  number: string;
  status: string;
  date_created: string;
  billing: {
    first_name: string;
    last_name: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    city: string;
  };
  line_items: Array<{
    name: string;
    quantity: number;
  }>;
}

// Draggable order component
function DraggableOrder({ 
  order, 
  isSelected,
  isAssigned,
  onSelect,
  getStatusLabel 
}: {
  order: WooOrder;
  isSelected: boolean;
  isAssigned: boolean;
  onSelect: (id: number) => void;
  getStatusLabel: (status: string) => { text: string; color: string };
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: { type: 'order', order },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr 
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 cursor-grab ${isSelected ? 'bg-blue-50' : ''} ${isDragging ? 'bg-blue-100' : ''} ${isAssigned ? 'opacity-60' : ''}`}
      {...listeners}
      {...attributes}
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(order.id)}
          className="rounded"
          disabled={isAssigned}
        />
      </td>
      <td className="px-4 py-3">
        <div className="font-medium flex items-center gap-2">
          #{order.number}
          {isAssigned && (
            <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded">
              שויך
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {new Date(order.date_created).toLocaleDateString('he-IL')}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 text-xs rounded-full ${getStatusLabel(order.status).color}`}>
          {getStatusLabel(order.status).text}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        <div>{order.shipping.address_1}, {order.shipping.city}</div>
        <div className="text-gray-500">{order.billing.phone}</div>
      </td>
    </tr>
  );
}

// Droppable zone for driver assignment
function DroppableDriverZone({ children, isOver }: { children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: 'driver-dropzone',
  });

  return (
    <div 
      ref={setNodeRef}
      className={`bg-white rounded-lg shadow transition-all duration-200 ${
        isOver ? 'ring-4 ring-blue-500 ring-offset-2 bg-blue-50' : ''
      }`}
    >
      {children}
    </div>
  );
}

// Sortable delivery item component
function SortableDeliveryItem({ 
  delivery, 
  index, 
  getStatusLabel, 
  onComplete, 
  onUnassign, 
  onTimeSlot,
  onShowDetails,
}: {
  delivery: DeliveryAssignment;
  index: number;
  getStatusLabel: (status: string) => { text: string; color: string };
  onComplete: (id: string) => void;
  onUnassign: (id: string) => void;
  onTimeSlot: (id: string) => void;
  onShowDetails: (delivery: DeliveryAssignment) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: delivery.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  const products = delivery.products as any[] || [];
  const isCompleted = delivery.status === 'completed' || !!delivery.completed_at;

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`hover:bg-gray-50 ${isDragging ? 'bg-blue-100' : ''} ${isCompleted ? 'bg-green-50 line-through decoration-gray-400' : ''}`}
    >
      <td className="px-4 py-3 text-center cursor-grab">
        <span className="text-gray-400">☰</span> {index + 1}
        {isCompleted && <span className="ml-1 text-green-600">✓</span>}
      </td>
      <td className="px-4 py-3">
        <div className={`font-medium flex items-center gap-2 ${isCompleted ? 'text-green-700' : ''}`}>
          #{delivery.order_number}
          {isCompleted && (
            <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded font-normal">
              הושלם
            </span>
          )}
          {delivery.service_type === 'technician_visit' && (
            <span className="px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded">
              טכנאי
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500">{delivery.store_name}</div>
        <span className={`px-2 py-1 text-xs rounded-full ${getStatusLabel(delivery.status).color}`}>
          {getStatusLabel(delivery.status).text}
        </span>
        {delivery.total_items && delivery.total_items > 0 && (
          <div className="text-xs text-gray-500 mt-1">📦 {delivery.total_items} פריטים</div>
        )}
        {delivery.delivery_cost != null && (
          <div className="text-xs text-green-600 mt-1">₪{Number(delivery.delivery_cost).toFixed(2)}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        <div>{delivery.shipping_address}</div>
        <div className="text-gray-500">{delivery.phone}</div>
        <div className="text-gray-500">{delivery.customer_name}</div>
        {products.length > 0 && (
          <div className="text-xs text-gray-400 mt-1">
            {products.slice(0, 2).map((p: any, i: number) => (
              <div key={i}>{p.name} x{p.quantity}</div>
            ))}
            {products.length > 2 && <div>+{products.length - 2} עוד...</div>}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={(e) => { e.stopPropagation(); onTimeSlot(delivery.id); }}
          className="text-blue-600 hover:text-blue-800"
        >
          {delivery.time_slot || 'הגדר זמן'}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 justify-center">
          <button
            onClick={(e) => { e.stopPropagation(); onShowDetails(delivery); }}
            className="text-gray-600 hover:text-gray-800"
            title="פרטי הזמנה"
          >
            ℹ️
          </button>
          {!isCompleted && (
            <button
              onClick={(e) => { e.stopPropagation(); onComplete(delivery.id); }}
              className="text-green-600 hover:text-green-800"
              title="סמן כהושלם"
            >
              ✓
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onUnassign(delivery.id); }}
            className="text-red-600 hover:text-red-800"
            title="בטל שיוך"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DeliveriesManagementPage() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Stores and drivers
  const [stores, setStores] = useState<Store[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  
  // Filters
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('recent');
  
  // Driver assignment
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Orders
  const [orders, setOrders] = useState<WooOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [assignedOrderIds, setAssignedOrderIds] = useState<Set<number>>(new Set());
  
  // Service type and pricing
  const [defaultDeliveryCost, setDefaultDeliveryCost] = useState<number>(50);
  const [defaultTechnicianCost, setDefaultTechnicianCost] = useState<number>(30);
  
  // Assigned deliveries
  const [assignedDeliveries, setAssignedDeliveries] = useState<DeliveryAssignment[]>([]);
  const [selectedAssigned, setSelectedAssigned] = useState<Set<string>>(new Set());
  
  // Available statuses for selected store
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({});

  // Time slot modal
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [timeSlotDeliveryId, setTimeSlotDeliveryId] = useState<string | null>(null);
  const [timeSlotStart, setTimeSlotStart] = useState('09:00');
  const [timeSlotEnd, setTimeSlotEnd] = useState('12:00');

  // Route optimizer
  const [showRouteOptimizer, setShowRouteOptimizer] = useState(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');

  // Order details modal
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedDeliveryForDetails, setSelectedDeliveryForDetails] = useState<DeliveryAssignment | null>(null);
  const [editingDeliveryCost, setEditingDeliveryCost] = useState<string>('');
  const [editingServiceType, setEditingServiceType] = useState<'delivery' | 'technician_visit'>('delivery');

  // Drag and drop
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<{ type: string; order?: WooOrder } | null>(null);
  const [isOverDropzone, setIsOverDropzone] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setIsClient(true);
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      loadStoreStatuses().then(() => loadOrders());
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedDriver && deliveryDate) {
      loadAssignedDeliveries();
    }
  }, [selectedDriver, deliveryDate]);

  const loadInitialData = async () => {
    try {
      // Load stores
      const { data: storesData } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (storesData) {
        setStores(storesData);
        // Set default store
        const defaultStore = storesData.find(s => s.is_default) || storesData[0];
        if (defaultStore) {
          setSelectedStore(defaultStore.store_id);
        }
      }

      // Load drivers
      const { data: driversData } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'driver')
        .eq('is_active', true)
        .order('display_name');
      
      if (driversData) {
        setDrivers(driversData);
      }

      // Load Google Maps API key
      const { data: apiKeyData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_maps_api_key')
        .single();
      
      if (apiKeyData?.value) {
        setGoogleMapsApiKey(apiKeyData.value);
      }

      // Load default costs
      const { data: costsData } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['default_delivery_cost', 'default_technician_cost']);
      
      console.log('Loaded costs data:', costsData);
      
      if (costsData) {
        costsData.forEach(setting => {
          // Handle both number and string values from JSONB
          const numValue = typeof setting.value === 'number' 
            ? setting.value 
            : parseFloat(String(setting.value).replace(/"/g, '')) || 0;
          
          console.log(`Setting ${setting.key}:`, setting.value, '-> parsed:', numValue);
          
          if (setting.key === 'default_delivery_cost') {
            setDefaultDeliveryCost(numValue || 50);
          } else if (setting.key === 'default_technician_cost') {
            setDefaultTechnicianCost(numValue || 30);
          }
        });
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStoreStatuses = async () => {
    const store = stores.find(s => s.store_id === selectedStore);
    if (store?.active_statuses) {
      setAvailableStatuses(store.active_statuses);
    }
    // Load Hebrew labels from WooCommerce via test endpoint
    if (store) {
      try {
        const res = await fetch('/api/woocommerce/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: store.url,
            consumer_key: store.consumer_key,
            consumer_secret: store.consumer_secret,
          }),
        });
        const data = await res.json();
        if (data.statuses && Array.isArray(data.statuses)) {
          const labels: Record<string, string> = {};
          data.statuses.forEach((s: { value: string; label: string }) => {
            labels[s.value] = s.label;
          });
          setStatusLabels(prev => ({ ...prev, ...labels }));
        }
      } catch (e) {
        console.error('Error loading status labels:', e);
      }
    }
  };

  const loadOrders = async () => {
    if (!selectedStore) return;
    
    setLoadingOrders(true);
    try {
      const store = stores.find(s => s.store_id === selectedStore);
      if (!store) return;

      // Call WooCommerce API to get orders
      const response = await fetch(`/api/woocommerce/orders?store_id=${selectedStore}&status=${selectedStatus}&date_range=${dateRange}&search=${searchTerm}`);
      const data = await response.json();
      
      if (data.orders) {
        setOrders(data.orders);
        
        // Load already assigned order IDs for this store AND delivery date
        const orderIds = data.orders.map((o: WooOrder) => o.id);
        if (orderIds.length > 0) {
          const { data: assignedData } = await supabase
            .from('delivery_assignments')
            .select('order_id')
            .eq('store_id', selectedStore)
            .eq('delivery_date', deliveryDate)
            .in('order_id', orderIds);
          
          if (assignedData) {
            setAssignedOrderIds(new Set(assignedData.map(d => d.order_id)));
          }
        }
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadAssignedDeliveries = async () => {
    if (!selectedDriver || !deliveryDate) return;

    try {
      const { data } = await supabase
        .from('delivery_assignments')
        .select('*, driver:users(*)')
        .eq('driver_id', selectedDriver)
        .eq('delivery_date', deliveryDate)
        .order('sequence');
      
      if (data) {
        setAssignedDeliveries(data);
      }
    } catch (error) {
      console.error('Error loading assigned deliveries:', error);
    }
  };

  const handleSelectOrder = (orderId: number) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const data = event.active.data.current;
    if (data) {
      setActiveDragData(data as { type: string; order?: WooOrder });
    }
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    setIsOverDropzone(over?.id === 'driver-dropzone');
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);
    setIsOverDropzone(false);

    if (!over) return;

    // Check if dragging an order to the driver assignment area
    const activeData = active.data.current;
    if (activeData?.type === 'order' && over.id === 'driver-dropzone') {
      // Assign the order to the selected driver
      if (!selectedDriver || !deliveryDate) {
        alert('יש לבחור נהג ותאריך לפני שיוך הזמנות');
        return;
      }

      const order = activeData.order as WooOrder;
      await assignSingleOrder(order);
      return;
    }

    // Handle reordering assigned deliveries
    if (active.id !== over.id) {
      const oldIndex = assignedDeliveries.findIndex(d => d.id === active.id);
      const newIndex = assignedDeliveries.findIndex(d => d.id === over.id);

      if (oldIndex >= 0 && newIndex >= 0) {
        const newOrder = arrayMove(assignedDeliveries, oldIndex, newIndex);
        setAssignedDeliveries(newOrder);

        // Save new sequence to database
        try {
          for (let i = 0; i < newOrder.length; i++) {
            await supabase
              .from('delivery_assignments')
              .update({ sequence: i + 1 })
              .eq('id', newOrder[i].id);
          }
        } catch (error) {
          console.error('Error saving sequence:', error);
          loadAssignedDeliveries(); // Reload on error
        }
      }
    }
  };

  // Assign a single order when dragged
  const assignSingleOrder = async (order: WooOrder) => {
    try {
      const driver = drivers.find(d => d.id === selectedDriver);
      const store = stores.find(s => s.store_id === selectedStore);
      
      await supabase.from('delivery_assignments').insert({
        store_id: selectedStore,
        store_name: store?.name,
        order_id: order.id,
        order_number: order.number,
        driver_id: selectedDriver,
        delivery_date: deliveryDate,
        shipping_address: `${order.shipping.address_1}, ${order.shipping.city}`,
        phone: order.billing.phone,
        customer_name: `${order.shipping.first_name} ${order.shipping.last_name}`,
        status: 'pending',
        completed_at: null,
        total_items: order.line_items.reduce((sum, item) => sum + item.quantity, 0),
        products: order.line_items,
        sequence: assignedDeliveries.length + 1,
      });

      // Remove from orders list
      setOrders(prev => prev.filter(o => o.id !== order.id));
      loadAssignedDeliveries();
    } catch (error) {
      console.error('Error assigning order:', error);
      alert('שגיאה בשיוך ההזמנה');
    }
  };

  // Route optimization - open modal
  const handleOptimizeRoute = () => {
    if (assignedDeliveries.length < 2) {
      alert('צריך לפחות 2 משלוחים לאופטימיזציה');
      return;
    }

    if (!googleMapsApiKey) {
      alert('יש להגדיר מפתח Google Maps בהגדרות המערכת');
      return;
    }

    setShowRouteOptimizer(true);
  };

  // Save optimized route from modal
  const handleSaveOptimizedRoute = async (optimizedDeliveries: any[]) => {
    try {
      // Update local state
      setAssignedDeliveries(optimizedDeliveries);

      // Save to database
      for (let i = 0; i < optimizedDeliveries.length; i++) {
        await supabase
          .from('delivery_assignments')
          .update({ sequence: i + 1 })
          .eq('id', optimizedDeliveries[i].id);
      }

      setShowRouteOptimizer(false);
      alert('המסלול עודכן בהצלחה!');
    } catch (error) {
      console.error('Error saving optimized route:', error);
      alert('שגיאה בשמירת המסלול');
    }
  };

  const handleSelectAllOrders = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  const handleAssignOrders = async () => {
    if (!selectedDriver || !deliveryDate || selectedOrders.size === 0) {
      alert('יש לבחור נהג, תאריך והזמנות לשיוך');
      return;
    }

    try {
      const driver = drivers.find(d => d.id === selectedDriver);
      const store = stores.find(s => s.store_id === selectedStore);
      
      // Default to 'delivery' service type
      const defaultCost = defaultDeliveryCost;
      
      const ordersToAssign = orders.filter(o => selectedOrders.has(o.id));
      
      for (const order of ordersToAssign) {
        await supabase.from('delivery_assignments').insert({
          store_id: selectedStore,
          store_name: store?.name,
          order_id: order.id,
          order_number: order.number,
          driver_id: selectedDriver,
          delivery_date: deliveryDate,
          shipping_address: `${order.shipping.address_1}, ${order.shipping.city}`,
          phone: order.billing.phone,
          customer_name: `${order.shipping.first_name} ${order.shipping.last_name}`,
          status: 'pending',
          total_items: order.line_items.reduce((sum, item) => sum + item.quantity, 0),
          products: order.line_items,
          service_type: 'delivery',
          delivery_cost: defaultCost,
        });
      }

      // Update assigned order IDs
      setAssignedOrderIds(prev => {
        const newSet = new Set(prev);
        ordersToAssign.forEach(o => newSet.add(o.id));
        return newSet;
      });

      setSelectedOrders(new Set());
      loadAssignedDeliveries();
      alert(`${ordersToAssign.length} הזמנות שויכו בהצלחה`);
    } catch (error) {
      console.error('Error assigning orders:', error);
      alert('שגיאה בשיוך הזמנות');
    }
  };

  const handleUnassign = async (deliveryId: string) => {
    if (!confirm('האם אתה בטוח שברצונך לבטל את השיוך?')) return;

    try {
      // Get delivery to know the order_id
      const delivery = assignedDeliveries.find(d => d.id === deliveryId);
      
      await supabase
        .from('delivery_assignments')
        .delete()
        .eq('id', deliveryId);
      
      // Remove from assigned order IDs
      if (delivery) {
        setAssignedOrderIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(delivery.order_id);
          return newSet;
        });
      }
      
      loadAssignedDeliveries();
    } catch (error) {
      console.error('Error unassigning delivery:', error);
    }
  };

  const handleCompleteDelivery = async (deliveryId: string) => {
    try {
      // Get delivery details
      const delivery = assignedDeliveries.find(d => d.id === deliveryId);
      if (!delivery) return;

      // Get driver info
      const driver = drivers.find(d => d.id === delivery.driver_id);
      
      // Get store info
      const store = stores.find(s => s.store_id === delivery.store_id);
      
      // Get driver's preferred status for this store FIRST
      const { data: statusSetting, error: statusError } = await supabase
        .from('driver_status_settings')
        .select('completion_status')
        .eq('driver_id', delivery.driver_id)
        .eq('store_id', delivery.store_id)
        .single();
      
      console.log('Status setting lookup:', { 
        driver_id: delivery.driver_id, 
        store_id: delivery.store_id, 
        result: statusSetting,
        error: statusError 
      });
      
      const completionStatus = statusSetting?.completion_status || 'completed';

      // Update local database with the actual completion status
      await supabase
        .from('delivery_assignments')
        .update({ 
          status: completionStatus,
          completed_at: new Date().toISOString()
        })
        .eq('id', deliveryId);

      // Update WooCommerce order and send note
      let wooSuccess = false;
      let wooMessage = '';
      try {
        const response = await fetch('/api/woocommerce/complete-delivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: delivery.store_id,
            order_id: delivery.order_id,
            status: completionStatus,
            driver_name: driver?.display_name || '',
            driver_phone: driver?.phone || '',
            customer_name: delivery.customer_name,
            order_number: delivery.order_number,
            store_name: delivery.store_name,
            delivery_date: delivery.delivery_date,
            time_slot: delivery.time_slot,
            service_type: delivery.service_type || 'delivery',
          }),
        });
        
        const result = await response.json();
        wooSuccess = result.success;
        wooMessage = result.message || result.error;
      } catch (wooError) {
        console.error('Error updating WooCommerce:', wooError);
        wooMessage = 'שגיאה בעדכון WooCommerce';
      }
      
      // Immediately update local state for instant visual feedback
      setAssignedDeliveries(prev => prev.map(d => 
        d.id === deliveryId 
          ? { ...d, status: completionStatus as any, completed_at: new Date().toISOString() }
          : d
      ));
      
      // Show feedback to user
      if (wooSuccess) {
        alert(`✅ הזמנה #${delivery.order_number} תואמה בהצלחה!\n\n${wooMessage}`);
      } else {
        alert(`⚠️ הזמנה #${delivery.order_number} סומנה כהושלמה במערכת המקומית.\n\nשגיאת WooCommerce: ${wooMessage}`);
      }
      
      // Also reload from database to ensure consistency
      loadAssignedDeliveries();
    } catch (error) {
      console.error('Error completing delivery:', error);
      alert('❌ שגיאה בסימון ההזמנה כהושלמה');
    }
  };

  const openTimeSlotModal = (deliveryId: string) => {
    setTimeSlotDeliveryId(deliveryId);
    setShowTimeSlotModal(true);
  };

  const saveTimeSlot = async () => {
    if (!timeSlotDeliveryId) return;

    try {
      await supabase
        .from('delivery_assignments')
        .update({ time_slot: `${timeSlotStart}-${timeSlotEnd}` })
        .eq('id', timeSlotDeliveryId);
      
      setShowTimeSlotModal(false);
      loadAssignedDeliveries();
    } catch (error) {
      console.error('Error saving time slot:', error);
    }
  };

  // Open order details modal
  const openOrderDetails = (delivery: DeliveryAssignment) => {
    setSelectedDeliveryForDetails(delivery);
    setEditingDeliveryCost(String(delivery.delivery_cost || 0));
    setEditingServiceType(delivery.service_type || 'delivery');
    setShowOrderDetails(true);
  };

  // Save delivery details
  const saveDeliveryCost = async () => {
    if (!selectedDeliveryForDetails) return;

    try {
      await supabase
        .from('delivery_assignments')
        .update({ 
          delivery_cost: parseFloat(editingDeliveryCost) || 0,
          service_type: editingServiceType 
        })
        .eq('id', selectedDeliveryForDetails.id);
      
      setShowOrderDetails(false);
      loadAssignedDeliveries();
    } catch (error) {
      console.error('Error saving delivery details:', error);
    }
  };

  // Print delivery sheet
  const handlePrint = () => {
    if (!selectedDriver || assignedDeliveries.length === 0) {
      alert('יש לבחור נהג עם משלוחים להדפסה');
      return;
    }

    const driver = drivers.find(d => d.id === selectedDriver);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalItems = assignedDeliveries.reduce((sum, d) => sum + (d.total_items || 0), 0);
    const totalDeliveryCost = assignedDeliveries.reduce((sum, d) => sum + (parseFloat(String(d.delivery_cost)) || 0), 0);

    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>דף משלוחים - ${driver?.display_name} - ${deliveryDate}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 2em; direction: rtl; }
          table { width: 100%; border-collapse: collapse; margin: 2em 0; }
          th, td { border: 1px solid #000; padding: 0.5em; text-align: right; }
          th { background: #f0f0f0; }
          .header { margin-bottom: 2em; }
          .products { font-size: 0.9em; color: #666; margin-top: 0.5em; }
          @media print {
            body { margin: 0; transform-origin: top right; transform: scale(0.85); }
            table { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>דף משלוחים</h2>
          <div>נהג: ${driver?.display_name}</div>
          <div>תאריך: ${deliveryDate}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>הזמנה</th>
              <th>כתובת ופרטים</th>
              <th>שעות</th>
              <th>עלות הובלה</th>
              <th>הערות</th>
            </tr>
          </thead>
          <tbody>
            ${assignedDeliveries.map((d, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${d.order_number}<br>${d.phone}</td>
                <td>
                  ${d.shipping_address}<br>
                  <strong>${d.customer_name}</strong>
                  <div class="products">
                    ${(d.products as any[])?.map((p: any) => `${p.name} x${p.quantity}`).join('<br>') || ''}
                  </div>
                </td>
                <td>${d.time_slot || ''}</td>
                <td>₪${(parseFloat(String(d.delivery_cost)) || 0).toFixed(2)}</td>
                <td>${d.notes || ''}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="6" style="font-weight: bold;">
                סה"כ הזמנות: ${assignedDeliveries.length} | 
                סה"כ פריטים: ${totalItems} | 
                סה"כ עלות הובלה: ₪${totalDeliveryCost.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
        <script>window.print();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const getStatusLabel = (status: string) => {
    const cleanStatus = status?.replace(/^wc-/, '') || '';
    
    // Color mapping by pattern
    const getColor = (s: string): string => {
      if (s.startsWith('done')) return 'bg-green-100 text-green-800';
      if (s.startsWith('un-')) return 'bg-red-100 text-red-800';
      if (s.includes('toam')) return 'bg-cyan-100 text-cyan-800';
      if (s.includes('fix')) return 'bg-orange-100 text-orange-800';
      if (s.includes('delivery') || s.includes('deliver') || s === 'shipping' || s === 'shipped') return 'bg-blue-100 text-blue-800';
      if (s === 'processing') return 'bg-blue-100 text-blue-800';
      if (s === 'pending' || s === 'on-hold') return 'bg-yellow-100 text-yellow-800';
      if (s === 'completed' || s === 'happycustomer') return 'bg-green-100 text-green-800';
      if (s === 'cancelled' || s === 'failed') return 'bg-red-100 text-red-800';
      if (s === 'refunded') return 'bg-purple-100 text-purple-800';
      if (s === 'preparation') return 'bg-amber-100 text-amber-800';
      if (s === 'pickup') return 'bg-cyan-100 text-cyan-800';
      if (s.includes('visit')) return 'bg-teal-100 text-teal-800';
      return 'bg-gray-100 text-gray-800';
    };

    // Use WooCommerce label if available
    if (statusLabels[cleanStatus]) {
      return { text: statusLabels[cleanStatus], color: getColor(cleanStatus) };
    }
    
    return { text: status || 'לא ידוע', color: getColor(cleanStatus) };
  };

  if (!isClient) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Section - Orders */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">ניהול הזמנות</h2>
          <p className="text-sm text-gray-500">גרור הזמנה לצד ימין לשיוך מהיר</p>
        </div>
        
        {/* Filters */}
        <div className="p-4 border-b space-y-4">
          <div className="flex flex-wrap gap-4">
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">בחר חנות</option>
              {stores.map(store => (
                <option key={store.store_id} value={store.store_id}>
                  {store.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!selectedStore}
            >
              <option value="">כל הסטטוסים</option>
              {availableStatuses.map(status => (
                <option key={status} value={status}>
                  {getStatusLabel(status).text}
                </option>
              ))}
            </select>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="recent">חודש אחרון</option>
              <option value="3months">3 חודשים</option>
              <option value="6months">6 חודשים</option>
              <option value="year">שנה</option>
              <option value="all">הכל</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חפש לפי מספר הזמנה/טלפון"
              className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!selectedStore}
            />
            <button
              onClick={loadOrders}
              disabled={!selectedStore}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              חפש
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-right">
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === orders.length && orders.length > 0}
                    onChange={handleSelectAllOrders}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  הזמנה
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  סטטוס
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  פרטי משלוח
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingOrders ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    {selectedStore ? 'אין הזמנות להצגה' : 'בחר חנות'}
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <DraggableOrder
                    key={order.id}
                    order={order}
                    isSelected={selectedOrders.has(order.id)}
                    isAssigned={assignedOrderIds.has(order.id)}
                    onSelect={handleSelectOrder}
                    getStatusLabel={getStatusLabel}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Assign Button */}
        <div className="p-4 border-t">
          <button
            onClick={handleAssignOrders}
            disabled={selectedOrders.size === 0 || !selectedDriver}
            className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            שייך {selectedOrders.size} הזמנות לנהג
          </button>
        </div>
      </div>

      {/* Right Section - Driver Assignment */}
      <DroppableDriverZone isOver={isOverDropzone}>
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">שיוך לנהגים</h2>
          {!selectedDriver && <p className="text-sm text-orange-600">⚠️ בחר נהג כדי לשייך הזמנות</p>}
        </div>

        {/* Driver & Date Selection */}
        <div className="p-4 border-b flex flex-wrap gap-4">
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">בחר נהג</option>
            {drivers.map(driver => (
              <option key={driver.id} value={driver.id}>
                {driver.display_name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          {/* Route Optimizer Button */}
          <button
            onClick={handleOptimizeRoute}
            disabled={assignedDeliveries.length < 2}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            🗺️ סדר קו
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            disabled={assignedDeliveries.length === 0}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            🖨️ הדפס
          </button>
        </div>

        {/* Assigned Deliveries Table with Drag & Drop */}
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    #
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    הזמנה
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    פרטי משלוח
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    זמן
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {!selectedDriver ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      בחר נהג
                    </td>
                  </tr>
                ) : assignedDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      אין משלוחים משויכים - גרור הזמנות לכאן או השתמש בכפתור השיוך
                    </td>
                  </tr>
                ) : (
                  <SortableContext
                    items={assignedDeliveries.map(d => d.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {assignedDeliveries.map((delivery, index) => (
                      <SortableDeliveryItem
                        key={delivery.id}
                        delivery={delivery}
                        index={index}
                        getStatusLabel={getStatusLabel}
                        onComplete={handleCompleteDelivery}
                        onUnassign={handleUnassign}
                        onTimeSlot={openTimeSlotModal}
                        onShowDetails={openOrderDetails}
                      />
                    ))}
                  </SortableContext>
                )}
              </tbody>
            </table>
          </div>
      </DroppableDriverZone>
      
      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeDragData?.type === 'order' ? (
          <div className="bg-blue-100 p-4 rounded shadow-lg border-2 border-blue-500">
            <div className="font-medium">הזמנה #{activeDragData.order?.number}</div>
            <div className="text-sm text-gray-600">{activeDragData.order?.shipping.city}</div>
          </div>
        ) : activeId ? (
          <div className="bg-blue-100 p-4 rounded shadow-lg">
            גורר משלוח...
          </div>
        ) : null}
      </DragOverlay>
    </div>
    </DndContext>

      {/* Time Slot Modal */}
      {showTimeSlotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">בחירת זמן אספקה</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">משעה:</label>
                <select
                  value={timeSlotStart}
                  onChange={(e) => setTimeSlotStart(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', 
                    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">עד שעה:</label>
                <select
                  value={timeSlotEnd}
                  onChange={(e) => setTimeSlotEnd(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', 
                    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'].map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveTimeSlot}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                שמור
              </button>
              <button
                onClick={() => setShowTimeSlotModal(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-100"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedDeliveryForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">
                פרטי הזמנה #{selectedDeliveryForDetails.order_number}
              </h3>
              <button
                onClick={() => setShowOrderDetails(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Customer Info */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm">
                <div><strong>לקוח:</strong> {selectedDeliveryForDetails.customer_name}</div>
                <div><strong>טלפון:</strong> {selectedDeliveryForDetails.phone}</div>
                <div><strong>כתובת:</strong> {selectedDeliveryForDetails.shipping_address}</div>
                {selectedDeliveryForDetails.time_slot && (
                  <div><strong>זמן אספקה:</strong> {selectedDeliveryForDetails.time_slot}</div>
                )}
              </div>
            </div>

            {/* Products */}
            <div className="mb-4">
              <h4 className="font-medium mb-2">פירוט מוצרים:</h4>
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {(selectedDeliveryForDetails.products as any[])?.map((product: any, idx: number) => (
                  <div key={idx} className="p-2 flex justify-between items-center">
                    <span>{product.name}</span>
                    <span className="text-gray-600">x{product.quantity}</span>
                  </div>
                )) || (
                  <div className="p-2 text-gray-500">אין מוצרים</div>
                )}
              </div>
              {selectedDeliveryForDetails.total_items && (
                <div className="text-sm text-gray-600 mt-2">
                  סה"כ פריטים: {selectedDeliveryForDetails.total_items}
                </div>
              )}
            </div>

            {/* Service Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סוג שירות:
              </label>
              <select
                value={editingServiceType}
                onChange={(e) => setEditingServiceType(e.target.value as 'delivery' | 'technician_visit')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="delivery">🚚 משלוח</option>
                <option value="technician_visit">🔧 ביקור טכנאי</option>
              </select>
            </div>

            {/* Delivery Cost */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                עלות הובלה:
              </label>
              <div className="flex gap-2">
                <span className="px-3 py-2 bg-gray-100 rounded-lg">₪</span>
                <input
                  type="number"
                  value={editingDeliveryCost}
                  onChange={(e) => setEditingDeliveryCost(e.target.value)}
                  step="0.01"
                  min="0"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="הזן עלות הובלה"
                />
              </div>
            </div>

            {/* Notes */}
            {selectedDeliveryForDetails.notes && (
              <div className="mb-4">
                <h4 className="font-medium mb-1">הערות:</h4>
                <div className="p-2 bg-yellow-50 rounded-lg text-sm">
                  {selectedDeliveryForDetails.notes}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveDeliveryCost}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                שמור
              </button>
              <button
                onClick={() => setShowOrderDetails(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-100"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Optimizer Modal */}
      {showRouteOptimizer && googleMapsApiKey && (
        <RouteOptimizerModal
          isOpen={showRouteOptimizer}
          onClose={() => setShowRouteOptimizer(false)}
          deliveries={assignedDeliveries}
          apiKey={googleMapsApiKey}
          onSaveRoute={handleSaveOptimizedRoute}
        />
      )}
    </>
  );
}
