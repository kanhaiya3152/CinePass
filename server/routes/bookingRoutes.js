import express from "express"
import { createBooking, getOccupiedSeats, verifyTicket } from "../controllers/bookingController.js"

const bookingRouter = express.Router()

bookingRouter.post('/create', createBooking)
bookingRouter.get('/seats/:showId', getOccupiedSeats)
bookingRouter.get('/verify/:token', verifyTicket)

export default bookingRouter;