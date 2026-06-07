import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import stripe from 'stripe';
import { randomUUID } from 'crypto';

// Function to check availability of selected seats for a movie

const checkSeatsAvailability = async (showId, selectedSeats) => {
    try {
        const showData = await Show.findById(showId)
        if (!showData) return false;

        const occupiedSeats = showData.occupiedSeats;
        const isAnySeatTaken = selectedSeats.some(seat => occupiedSeats[seat]); // it will check the seat is occupied or not

        return !isAnySeatTaken;
    } catch (error) {
        console.log(error.message);
        return false;
    }

}

export const createBooking = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { showId, selectedSeats } = req.body;
        const { origin } = req.headers;

        //Check if the seat is available or not for the selected show
        const isAvailable = await checkSeatsAvailability(showId, selectedSeats);

        if (!isAvailable) {
            return res.json({ success: false, message: "Selected seats are not available" })
        }

        // Get the show details
        const showData = await Show.findById(showId).populate('movie');

        // Create a new booking with a unique QR token right away
        const booking = await Booking.create({
            user: userId,
            show: showId,
            amount: showData.showPrice * selectedSeats.length,
            bookedSeats: selectedSeats,
            qrToken: randomUUID()
        })

        selectedSeats.map((seat) => {
            showData.occupiedSeats[seat] = userId;
        })

        showData.markModified('occupiedSeats');

        await showData.save(); // save to the db

        // Stripe Gateway Initialize
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY)

        // create line items for stripe
        const line_items = [{
            price_data: {
                currency: 'inr',
                product_data: {
                    name: showData.movie.title
                },
                unit_amount: Math.floor(booking.amount) * 100
            },
            quantity: 1
        }]

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-bookings`, // origin -> frontend url
            cancel_url: `${origin}/my-bookings`,
            line_items: line_items,
            mode: 'payment',
            metadata: {
                bookingId: booking._id.toString()
            },
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // Expires in 30 min
        })

        booking.paymentLink = session.url
        await booking.save()  // save to db

        // Run Inngest Sheduler Function to check payment status after 10 minutes
        await inngest.send({
            name: "app/checkpayment",
            data: {
                bookingId: booking._id.toString()

            }
        })

        res.json({ success: true, url: session.url });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

export const getOccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId)
        const occupiedSeats = Object.keys(showData.occupiedSeats)
        res.json({ success: true, occupiedSeats })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

// Verify a ticket by its QR token (used by admin scanner)
export const verifyTicket = async (req, res) => {
    try {
        const { token } = req.params;
        const booking = await Booking.findOne({ qrToken: token }).populate({
            path: 'show',
            populate: { path: 'movie' }
        });

        if (!booking) {
            return res.json({ success: false, message: 'Invalid or unknown QR code' });
        }
        if (!booking.isPaid) {
            return res.json({ success: false, message: 'Ticket not paid' });
        }

        res.json({
            success: true,
            ticket: {
                bookingId: booking._id,
                movie: booking.show.movie.title,
                poster: booking.show.movie.poster_path,
                showDateTime: booking.show.showDateTime,
                seats: booking.bookedSeats,
                amount: booking.amount
            }
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}
