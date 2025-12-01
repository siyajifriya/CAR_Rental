import express from 'express';
import { confirmPayment, createCheckoutSession } from '../controllers/paymentController.js';
import { getMyBookings } from '../controllers/bookingController.js';

const paymentRouter = express.Router();

paymentRouter.post('/create-checkout-session', createCheckoutSession);
paymentRouter.get('/confirm', confirmPayment);
paymentRouter.get('/my-bookings', getMyBookings);

export default paymentRouter;
