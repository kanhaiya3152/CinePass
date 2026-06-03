import express from "express";
import { protectAdmin } from "../middleware/auth.js";
import { getAllBookings, getAllShows, getDashboardData, isAdmin, deleteMovie, deleteShow, updateShow } from "../controllers/adminController.js";


const adminRouter = express. Router();
adminRouter.get('/is-admin', protectAdmin, isAdmin)
adminRouter.get('/dashboard', protectAdmin, getDashboardData)
adminRouter.get('/all-shows', protectAdmin, getAllShows)
adminRouter.get('/all-bookings', protectAdmin, getAllBookings)

adminRouter.delete('/movie/:id', protectAdmin, deleteMovie)
adminRouter.delete('/show/:id', protectAdmin, deleteShow)
adminRouter.put('/show/:id', protectAdmin, updateShow)

export default adminRouter;