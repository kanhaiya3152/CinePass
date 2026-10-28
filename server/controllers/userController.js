import { clerkClient } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";
import { inngest } from "../inngest/index.js";
import Stripe from "stripe";
import { randomUUID } from "crypto";

// API Controller Function to Get User Bookings
export const getUserBookings = async (req, res) => {
    try {
        const user = req.auth().userId;

        let bookings = await Booking.find({ user }).populate({
            path: "show",
            populate: { path: "movie" }
        }).sort({ createdAt: -1 });

        // Auto-verify with Stripe if any unpaid bookings were actually paid
        // (Ensures payment status updates even if Stripe webhook didn't reach localhost)
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey) {
            const stripeInstance = new Stripe(stripeKey);
            for (let i = 0; i < bookings.length; i++) {
                const b = bookings[i];
                if (!b.isPaid && (b.sessionId || b.paymentLink)) {
                    let sessionId = b.sessionId;
                    if (!sessionId && b.paymentLink) {
                        const match = b.paymentLink.match(/(cs_[a-zA-Z0-9_]+)/);
                        if (match) sessionId = match[1];
                    }
                    if (sessionId) {
                        try {
                            const session = await stripeInstance.checkout.sessions.retrieve(sessionId);
                            if (session && session.payment_status === 'paid') {
                                b.isPaid = true;
                                b.paymentLink = "";
                                if (!b.qrToken) {
                                    b.qrToken = randomUUID();
                                }
                                await b.save();

                                // Send confirmation email via inngest
                                await inngest.send({
                                    name: "app/show.booked",
                                    data: { bookingId: b._id.toString() }
                                }).catch(e => console.error("Inngest send error:", e.message));
                            }
                        } catch (err) {
                            console.error(`Error verifying Stripe session for booking ${b._id}:`, err.message);
                        }
                    }
                }
            }
        }

        // Backfill qrToken for existing bookings that don't have it
        for (let i = 0; i < bookings.length; i++) {
            if (!bookings[i].qrToken) {
                bookings[i].qrToken = randomUUID();
                await bookings[i].save();
            }
        }

        res.json({ success: true, bookings });
    } catch (error) {
        console.error("getUserBookings error:", error.message);
        res.json({ success: false, message: error.message });
    }
};

// API Controller Function to update Favorite Movie in Clerk User Metadata
export const updateFavorite = async (req, res) => {
    try {
        const { movieId } = req.body;
        const userId = req.auth().userId;

        const user = await clerkClient.users.getUser(userId);

        if(!user.privateMetadata.favorites){
            user.privateMetadata.favorites=[]
        }

        if(!user.privateMetadata.favorites.includes(movieId)){
            user.privateMetadata.favorites.push(movieId);
        }else{
            user.privateMetadata.favorites = user.privateMetadata.favorites.filter(item => item !== movieId);
        }

        await clerkClient.users.updateUserMetadata(userId,{privateMetadata:user.privateMetadata})

        res.json({success: true , message: "Favourite movies updated"})

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};

// get the list of all favourite movies
export const getFavorite = async(req,res) => {
    try {
        const user = await clerkClient.users.getUser(req.auth().userId);
        const favorites = user.privateMetadata.favorites || [];

        //Getting movies from database
        const movies = await Movie.find({_id:{$in: favorites}});

        res.json({success: true, movies});
    } catch (error) {
        console.error(error.message);
        res.json({success: false, message: error.message});
    }
};
