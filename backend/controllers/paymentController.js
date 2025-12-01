import Booking from '../models/bookingModel.js'
import Stripe from 'stripe'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

dotenv.config();

const CLIENT_URL = 'http://localhost:5173';
const STRIPE_API_VERSION = "2022-11-15";

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

// GET STRIPE FROM .ENV
const getStripe = () => {
    const key = (process.env.STRIPE_SECRET_KEY || '').trim();
    if (!key) throw new Error('Missing Stripe Key');
    return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
};

//CREATE A BOOKING PAYMENT DONE
export const createCheckoutSession = async (req, res) => {
    try {
        if (!req.body)
            return res.status(400).json({
                success: false,
                message: 'Missing Request Key',
            });

        const {
            userId: incomingUserId,
            customer,
            email,
            phone,
            car,
            pickupDate,
            returnDate,
            amount,
            details,
            address,
            carImage,
        } = req.body;

        // try to resolve userId from Authorization header if not provided
        let userId = incomingUserId || null;
        try {
            const authHeader = String(req.headers?.authorization || '');
            if (!userId && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                const payload = jwt.verify(token, JWT_SECRET);
                if (payload && (payload.id || payload._id)) userId = payload.id || payload._id;
            }
        } catch (e) {
            // ignore token decode errors — booking can still be created as guest
        }

        // minimal validation
        const total = Number(amount);
        if (!total || Number.isNaN(total) || total <= 0)
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        if (!email) return res.status(400).json({ success: false, message: 'Email required' });
        if (!pickupDate || !returnDate)
            return res.status(400).json({ success: false, message: 'pickupDate and returnDate required' });

        const pd = new Date(pickupDate);
        const rd = new Date(returnDate);
        if (Number.isNaN(pd.getTime()) || Number.isNaN(rd.getTime()))
            return res.status(400).json({ success: false, message: 'Invalid dates' });
        if (rd < pd)
            return res.status(400).json({ success: false, message: 'returnDate must be same or after pickupDate' });

        let carField = car;
        if (typeof car === 'string') {
            try {
                carField = JSON.parse(car);
            } catch {
                carField = { name: car };
            }
        }

        // create booking (pending)
        const booking = await Booking.create({
            userId: userId || null,
            customer: String(customer ?? ''),
            email: String(email ?? ''),
            phone: String(phone ?? ''),
            car: carField ?? {},
            carImage: String(carImage ?? ''),
            pickupDate: pd,
            returnDate: rd,
            amount: total,
            paymentStatus: 'pending',
            details: typeof details === 'string' ? JSON.parse(details) : (details || {}),
            address: typeof address === 'string' ? JSON.parse(address) : (address || {}),
            status: 'pending',
            currency: 'INR',
        });

        let stripe;
        try {
            stripe = getStripe();
        } catch (err) {
            await Booking.findByIdAndDelete(booking._id).catch(() => {});
            return res.status(500).json({ success: false, message: 'Payment not configure', error: err.message });
        }

        let session;
        try {
            session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                mode: 'payment',
                customer_email: email || undefined,
                line_items: [
                    {
                        price_data: {
                            currency: 'inr',
                            product_data: {
                                name: (carField && (carField.name || carField.title)) || 'Car Rental',
                                description: `Rental ${pickupDate} → ${returnDate}`,
                            },
                            unit_amount: Math.round(total * 100),
                        },
                        quantity: 1,
                    },
                ],
                success_url: `${CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}&payment_status=success`,
                cancel_url: `${CLIENT_URL}/cancel?payment_status=cancel`,
                metadata: {
                    bookingId: booking._id.toString(),
                    userId: String(userId ?? ''),
                    carId: String((carField && (carField.id || carField._id)) || ''),
                    pickupDate: String(pickupDate || ''),
                    returnDate: String(returnDate || ''),
                },
            });
        } catch (stripeErr) {
            await Booking.findByIdAndDelete(booking._id).catch(() => {});
            return res.status(500).json({ success: false, message: 'Failed to create Stripe Checkout Session', error: stripeErr.message || String(stripeErr) });
        }

        booking.sessionId = session.id;
        booking.stripeSession = {
            id: session.id,
            url: session.url || null,
        };
        await booking.save();
        return res.json({ success: true, id: session.id, url: session.url, bookingId: booking._id });
    } catch (err) {
        console.error('CheckoutSession Error', err);
        return res.status(500).json({ success: false, message: err.message || 'Server Error' });
    }
};

// SUCCESSFULL PAYMENT VERIFICATION
export const confirmPayment = async (req, res) => {
    try {
        const {session_id} = req.query;
        if (!session_id) return res.status(400).json({ success: false, message: 'Session_id required' });

        let stripe;
        try { stripe = getStripe(); } catch (err) {
            return res.status(500).json ({
                success: false,
                message: 'Payment not configure',
                error: err.message,
            });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);
        if(!session) return res.status(404).json({
            success: false,
            message: 'Session not found'
        });

        if (session.payment_status !== 'paid')
            return res.status(400).json({
                success: false,
                message: `Payment not completed. status=${session.payment_status}`,
                session,
            });

        const bookingId = session.metadata.bookingId;

        let order = null;
        if (bookingId) {
            order = await Booking.findByIdAndUpdate(bookingId, {
                paymentStatus: 'paid',
                status: 'active',
                paymentIntentId: session.payment_intent || '',
                paymentDetails: {
                    amount_total: session.amount_total || null,
                    currency: session.currency || null,
                },
            }, { new: true });
        }

        if (!order) {
            order = await Booking.findOneAndUpdate({ sessionId: session_id }, {
                paymentStatus: 'paid',
                status: 'active',
                paymentIntentId: session.payment_intent || '',
                paymentDetails: {
                    amount_total: session.amount_total || null,
                    currency: session.currency || null,
                },
            }, { new: true });

        }

        if (!order) return res.status(404).json({
            success: false,
            message: 'Booking not found for this session',
            session,
        });
        return res.json({ success: true, order });
    } catch (error) {
        console.error('Confirm Payment Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Server Error',
        });
    }
}
