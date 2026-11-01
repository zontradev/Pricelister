/**
 * orderService.js
 * Service for managing customer orders stored under Workspaces/{workspaceId}/Orders
 */

import { createRepository } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';
import { Order } from '../../DataModel.js';
import { validateOrder } from '../schemas/orderSchema.js';

export const getOrderService = (workspaceId) => {
    const ordersRepo = createRepository('Orders', workspaceId);

    return {
        /**
         * Get all orders for this workspace
         */
        getAllOrders: async () => {
            try {
                const all = await ordersRepo.getAll();
                return (all || [])
                    .filter(ord => !ord.isArchive)
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            } catch (err) {
                console.error("Error fetching orders:", err);
                return [];
            }
        },

        /**
         * Real-time listener for orders
         */
        listenOrders: (callback) => {
            return ordersRepo.listenAll(data => {
                const filtered = (data || [])
                    .filter(ord => !ord.isArchive)
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                callback(filtered);
            });
        },

        /**
         * Get single order by ID
         */
        getOrderById: async (id) => {
            return await ordersRepo.getById(id);
        },

        /**
         * Create a new customer order
         */
        createOrder: async (orderPayload) => {
            // Instantiate Order model
            const newOrder = new Order({
                ...orderPayload,
                workspaceId: workspaceId,
                uniqueId: orderPayload.uniqueId || generateUniqueId(),
                createdAt: orderPayload.createdAt || Date.now(),
                updatedAt: Date.now(),
                status: orderPayload.status || 'PENDING'
            });

            // Calculate total price if not passed
            if (!newOrder.totalAmount || newOrder.totalAmount <= 0) {
                const sub = newOrder.items.reduce((acc, it) => acc + (Number(it.totalPrice) || (it.quantity * it.unitPrice)), 0);
                newOrder.subtotal = sub;
                newOrder.totalAmount = sub + (Number(newOrder.shippingCost) || 0);
            }

            // Validate against schema
            validateOrder(newOrder);

            // Save to Firestore sub-collection: Workspaces/{workspaceId}/Orders
            const cleanData = JSON.parse(JSON.stringify(newOrder));
            const savedDoc = await ordersRepo.add(cleanData);

            const savedOrder = {
                ...cleanData,
                id: (savedDoc && (savedDoc.id || savedDoc.uniqueId)) || newOrder.uniqueId
            };

            // Also mirror in localStorage for immediate customer session persistence
            try {
                const customerOrdersKey = `pricelister_placed_orders_${workspaceId}`;
                const existing = JSON.parse(localStorage.getItem(customerOrdersKey) || '[]');
                existing.unshift(savedOrder);
                localStorage.setItem(customerOrdersKey, JSON.stringify(existing.slice(0, 50)));
            } catch (e) {}

            return savedOrder;
        },

        /**
         * Update order status (PENDING, CONFIRMED, PROCESSING, SHIPPED, COMPLETED, CANCELLED)
         */
        updateOrderStatus: async (orderId, newStatus, extraNotes = '') => {
            const updates = {
                status: newStatus,
                updatedAt: Date.now()
            };
            if (extraNotes) {
                updates.statusNotes = extraNotes;
            }
            return await ordersRepo.update(orderId, updates);
        },

        /**
         * Delete or archive order
         */
        deleteOrder: async (orderId) => {
            return await ordersRepo.delete(orderId);
        }
    };
};
