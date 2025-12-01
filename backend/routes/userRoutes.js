import express from 'express';
import { login, register } from '../controllers/authController.js.js';

const userRoute = express.Router();

userRoute.post('/login', login);
userRoute.post('/register', register);

export default userRoute;
