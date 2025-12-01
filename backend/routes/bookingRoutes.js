import express from 'express'
import authMiddleware from '../middlewares/auth.js';
import { createBooking, deleteBooking, getBooking, getBookings, getMyBookings, updateBooking, updateBookingStatus, assignBookingsByEmail } from '../controllers/bookingController.js'
import { uploads } from '../middlewares/uploads.js';


const bookingRouter = express.Router();

bookingRouter.post('/', authMiddleware, uploads.single('carImage'), createBooking);
// Public listing (supports query params) -> use singular `getBooking`
bookingRouter.get('/', getBooking);

bookingRouter.get('/mybooking', authMiddleware, getMyBookings);


// Assign guest bookings (matching your email) to your account
bookingRouter.post('/assign-mybookings', authMiddleware, assignBookingsByEmail);

bookingRouter.put('/:id', uploads.single('carImage'), updateBooking);
bookingRouter.patch('/:id/status', updateBookingStatus);
bookingRouter.delete('/:id', deleteBooking);

export default bookingRouter;
