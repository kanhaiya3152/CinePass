import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './configs/db.js';
import { clerkMiddleware } from '@clerk/express'
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"
import showRouter from './routes/showRoutes.js';
import bookingRouter from './routes/bookingRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import userRouter from './routes/userRoutes.js';


const app = express(); 
const port = 3000;

// Middleware
app.use(express.json()) // all the request will be passed using the json method
app.use(cors())
app.use(clerkMiddleware())


await connectDB()

// API Routes
app.get('/' , (req,res)=>{res.send("Welcome to my backend")})
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use('/api/show', showRouter)
app.use('/api/booking', bookingRouter)
app.use('/api/admin', adminRouter)
app.use('/api/user', userRouter)

app.listen(port, () => 
    console.log(`Server running at http://localhost:${port}`)
)