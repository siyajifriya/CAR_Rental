import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import path from 'path'
import helmet from 'helmet'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'

import { connectDB } from './config/db.js';
import userRouter from './routes/userRoutes.js';
import carRouter from './routes/carRoutes.js'
import bookingRouter from './routes/bookingRoutes.js'
import paymentRouter from './routes/paymentRoutes.js'

const app = express();
const PORT = 5000;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


connectDB();

// MIDDLEWARES
app.use(cors())
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
)
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

// Disable ETag for API responses and prevent caching for dynamic API routes
app.set('etag', false);
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

app.use(
    '/uploads', (req,res,next) => {
        res.setHeader('Access-Control-Allow-Origin', "*");
        next();
    },
    express.static(path.join(process.cwd(), 'uploads'))
)

// ROUTES
app.use('/api/auth', userRouter);
app.use('/api/cars', carRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/payments', paymentRouter);

app.get('/api/ping', (req, res) => res.json({
    ok: true,
    time: Date.now()
}))

// Debug: echo request headers (unprotected)
app.get('/api/debug/headers', (req, res) => {
    res.json({ headers: req.headers });
});

// Debug: verify Authorization Bearer token with server secret
app.get('/api/debug/verify-token', (req, res) => {
    const auth = String(req.headers.authorization || '');
    const secret = process.env.JWT_SECRET || 'your_jwt_secret_here';
    if (!auth || !auth.startsWith('Bearer ')) return res.status(400).json({ success: false, message: 'Missing Bearer token in Authorization header' });
    const token = auth.split(' ')[1];
    try {
        const payload = jwt.verify(token, secret);
        return res.json({ success: true, payload });
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token verification failed', error: err.message });
    }
});

// Debug: list bookings by userId (unprotected - temporary)
app.get('/api/debug/bookings-by-user/:id', async (req, res) => {
    try {
        const { default: Booking } = await import('./models/bookingModel.js');
        const userId = req.params.id;
        if (!userId) return res.status(400).json({ success: false, message: 'User id required' });
        const docs = await Booking.find({ userId }).sort({ bookingDate: -1 }).lean();
        return res.json({ success: true, count: docs.length, data: docs });
    } catch (err) {
        console.error('Debug bookings-by-user error', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Debug: protected endpoint to see what mybooking returns (with auth)
app.get('/api/debug/mybooking-debug', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(400).json({ success: false, message: 'Missing Bearer token' });
        }
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'your_jwt_secret_here';
        const { default: Booking } = await import('./models/bookingModel.js');
        
        let payload;
        try {
            payload = jwt.verify(token, secret);
        } catch (e) {
            return res.status(401).json({ success: false, message: 'Token invalid', error: e.message });
        }
        
        const userId = payload.id;
        const docs = await Booking.find({ userId }).sort({ bookingDate: -1 }).lean();
        return res.json({ success: true, userId, tokenPayload: payload, bookingsCount: docs.length, bookings: docs });
    } catch (err) {
        console.error('Debug mybooking-debug error', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});


// LISTEN
app.get('/',(req, res) => {
    res.send('API WORKING')
});

app.listen(PORT, () => {
    console.log(` Server Started on http://localhost:${PORT}`);
    
})