import { Inngest } from "inngest";
import User from "../models/Users.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import Movie from "../models/Movie.js";
import sendEmail from "../configs/nodemailer.js";
import axios from "axios";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

//Inngest Function to save user data to a database
const syncUserCreation = inngest.createFunction(
    { id: 'sync-user-from-clerk' },
    { event: 'clerk/user.created' },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        }
        await User.create(userData);
    }
)

//Inngest Function to delete user from database
const syncUserDeletion = inngest.createFunction(
    { id: 'delete-user-with-clerk' },
    { event: 'clerk/user.deleted' },
    async ({ event }) => {

        const { id } = event.data
        await User.findByIdAndDelete(id)
    }
)

//Inngest Function to update user data in database
const syncUserUpdation = inngest.createFunction(
    { id: 'update-user-from-clerk' },
    { event: 'clerk/user.updated' },
    async ({ event }) => {
        const { id, first_name, last_name, email_addressess, image_url } = event.data
        const userData = {
            _id: id,
            email: email_addressess[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        }
        await User.findByIdAndUpdate(id, userData)
    }
)

// Inngest Function to cancel booking and release seats of show after 10 minutes of
// booking created if payment is not made
const releaseSeatsAndDeleteBooking = inngest.createFunction(
    { id: 'release-seats-delete-booking' },
    { event: "app/checkpayment" },

    async ({ event, step }) => {
        const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
        await step.sleepUntil('wait-for-10-minutes', tenMinutesLater);

        await step.run('check-payment-status', async () => {
            const bookingId = event.data.bookingId;
            const booking = await Booking.findById(bookingId)

            // If payment is not made, release seats and delete booking
            if (!booking.isPaid) {
                const show = await Show.findById(booking.show);

                booking.bookedSeats.forEach((seat) => {
                    delete show.occupiedSeats[seat]
                });

                show.markModified('occupiedSeats')
                await show.save()
                await Booking.findByIdAndDelete(booking._id)
            }
        })
    }
)

// Inngest Function to send email when user books a show
const sendBookingConfirmationEmail = inngest.createFunction(
    { id: "send-booking-confirmation-email" },
    { event: "app/show.booked" },
    async ({ event, step }) => {
        const { bookingId } = event.data;
        const booking = await Booking.findById(bookingId).populate({
            path: 'show',
            populate: { path: "movie", model: "Movie" }
        }).populate('user');

        await sendEmail({
            to: booking.user.email,
            subject: `Payment Confirmation: "${booking.show.movie.title}" booked!`,
            body: `<div style="font-family: Arial, sans-serif; line-height: 1.5;">
                    <h2>Hi ${booking.user.name},</h2>
                    <p>Your booking for <strong style="color: #F84565;">"${booking.show.movie.title}"</strong> is confirmed.</p>
                    <p>
                    <strong>Date:</strong> ${new Date(booking.show.showDateTime).toLocaleDateString('en-US', {
                timeZone: 'Asia/Kolkata'
            })}
                    <br/>
                    <strong>Time:</strong> ${new Date(booking.show.
                showDateTime).toLocaleTimeString('en-US', {
                    timeZone:
                        'Asia/Kolkata'
                })}
                    </p>
                    <p>Enjoy the show! </p>
                    <p>Thanks for booking with us! <br/>- CinePass Team</p>
                    </div>`
        })
    }
)

// Inngest Function to send reminders
const sendShowReminders = inngest.createFunction(
    { id: "send-show-reminders" },
    { cron: "0 */8 * * *" }, // Every 8 hours

    async ({ step }) => {
        const now = new Date();
        const in8Hours = new Date(now.getTime() + 8 * 60 * 60 *
            1000);
        const windowStart = new Date(in8Hours.getTime() - 10 * 60
            * 1000);

        // Prepare reminder tasks
        const reminderTasks = await step.run("prepare-reminder-tasks", async () => {
            const shows = await Show.find({
                showTime: { $gte: windowStart, $lte: in8Hours },
            }).populate('movie');

            const tasks = [];

            for (const show of shows) {
                if (!show.movie || !show.occupiedSeats) continue;

                const userIds = [...new Set(Object.values(show.occupiedSeats))];
                if (userIds.length === 0) continue;

                const users = await User.find({ _id: { $in: userIds } }).select("name email");

                for (const user of users) {
                    tasks.push({
                        userEmail: user.email,
                        userName: user.name,
                        movieTitle: show.movie.title,
                        showTime: show.showTime,
                    })
                }
            }
            return tasks;

        })

        if (reminderTasks.length === 0) {
            return { sent: 0, message: "No reminders to send." }
        }
        // Send reminder emails
        const results = await step.run('send-all-reminders', async () => {
            return await Promise.allSettled(
                reminderTasks.map(task => sendEmail({
                    to: task.userEmail,
                    subject: `Reminder: Your movie "${task.movieTitle}" starts soon!`,
                    body: `<div style="font-family: Arial, sans-serif; padding:20px;">
                        <h2>Hello ${task.userName},</h2>
                        <p>This is a quick reminder that your movie:</p>
                        <h3 style="color: #F84565;">"${task.movieTitle}"</h3>
                        <p>
                        is scheduled for <strong>${new Date(task.showTime).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</strong> at
                        <strong>${new Date(task.showTime).toLocaleTimeString
                            ('en-US', { timeZone: 'Asia/Kolkata' })}</strong>.
                        </p>
                        <p>It starts in approximately <strong>8 hours</strong>
                        -make sure you're ready!</p>
                        <br/>
                        <p>Enjoy the show! <br/>QuickShow Team</p>
                        </div>`

                }))
            )
        })

        const sent = results.filter(r => r.status === "fulfilled").length;
        const failed = results.length - sent;

        return {
            sent,
            failed,
            message: `Sent ${sent} reminder(s), ${failed} failed.`
        }
    }
)

// Inngest Function to send notifications when a new show is added
const sendNewShowNotifications = inngest.createFunction(
    { id: "send-new-show-notifications" },
    { event: "app/show.added" },

    async ({ event }) => {
        const { movieTitle } = event.data;
        const users = await User.find({})
        for (const user of users) {
            const userEmail = user.email;
            const userName = user.name;
            const subject = `New Show Added: ${movieTitle}`;
            const body = `<div style="font-family: Arial, sans-serif; padding: 20px;
                    <h2>Hi ${userName},</h2>
                    <p>We've just added a new show to our library:</p>
                    <h3 style="color: #F84565;">"${movieTitle}"</h3>
                    <p>Visit our website</p>
                    <br/>
                    <p>Thanks, <br/>QuickShow Team</p>
                    </div>`;

                    await sendEmail({
                        to: userEmail,
                        subject,
                        body,
                    })

        }

        return {message: "Notification sent"}
    }
)

// Inngest Function to update dynamic pricing
const updateDynamicPricing = inngest.createFunction(
    { id: "update-dynamic-pricing" },
    { cron: "0 * * * *" }, // Run every hour
    async ({ step }) => {
        await step.run("calculate-dynamic-prices", async () => {
            const now = new Date();
            const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const in4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000);

            // Find all shows starting within the next 24 hours
            const upcomingShows = await Show.find({
                showDateTime: { $gte: now, $lte: in24Hours }
            });

            for (const show of upcomingShows) {
                const totalSeats = 100; // Assuming 100 seats per theater
                const occupiedCount = Object.keys(show.occupiedSeats || {}).length;
                const capacity = occupiedCount / totalSeats;
                let newPrice = show.showPrice;
                let priceModified = false;

                if (capacity > 0.8 && show.showDateTime <= in24Hours) {
                    // High Demand: >80% full within 24 hours
                    newPrice = show.showPrice * 1.10; // Increase by 10%
                    priceModified = true;
                } else if (capacity < 0.2 && show.showDateTime <= in4Hours) {
                    // Flash Sale: <20% full within 4 hours
                    newPrice = show.showPrice * 0.85; // Decrease by 15%
                    priceModified = true;
                }

                if (priceModified && newPrice !== show.showPrice) {
                    show.showPrice = Math.round(newPrice);
                    await show.save();
                }
            }
        });
        return { message: "Dynamic pricing updated successfully" };
    }
)

// Inngest Function to sync new movies daily
const syncNewMovies = inngest.createFunction(
    { id: "sync-new-movies" },
    { cron: "0 0 * * *" }, // Run daily at midnight
    async ({ step }) => {
        await step.run("fetch-and-save-new-movies", async () => {
            if (!process.env.TMDB_API_KEY) return;
            try {
                // Fetch Now Playing movies from TMDB
                const response = await axios.get(`https://api.tmdb.org/3/movie/now_playing?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=1`);
                const tmdbMovies = response.data.results;
                
                for (const tmdb of tmdbMovies) {
                    // Check if movie already exists (TMDB ID instead of IMDB ID here, but let's try to find by title to avoid duplicates since we use IMDB ID as _id)
                    const existingMovie = await Movie.findOne({ title: tmdb.title });
                    if (!existingMovie) {
                        // We will save it with TMDB ID prefixed if IMDB ID is not readily available, or just fetch external ID
                        const extRes = await axios.get(`https://api.tmdb.org/3/movie/${tmdb.id}/external_ids?api_key=${process.env.TMDB_API_KEY}`);
                        const imdbId = extRes.data.imdb_id || `tmdb-${tmdb.id}`;
                        
                        // We need genres - TMDB uses genre IDs, let's just save generic strings for simplicity
                        const genresMap = { 28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western" };
                        const movieGenres = tmdb.genre_ids.map(id => genresMap[id]).filter(Boolean);

                        const newMovie = new Movie({
                            _id: imdbId,
                            title: tmdb.title,
                            overview: tmdb.overview,
                            poster_path: `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`,
                            backdrop_path: `https://image.tmdb.org/t/p/w1280${tmdb.backdrop_path}`,
                            release_date: tmdb.release_date,
                            original_language: tmdb.original_language,
                            vote_average: tmdb.vote_average,
                            genres: movieGenres,
                            casts: [], // TMDB casts require another API call
                            runtime: 120 // Default runtime
                        });
                        

                        await newMovie.save();
                    }
                }
            } catch (error) {
                console.error("Error syncing new movies:", error.message);
            }
        });
        return { message: "Sync complete" };
    }
);

// Create an empty array where we'll export future Inngest functions
export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    releaseSeatsAndDeleteBooking,
    sendBookingConfirmationEmail,
    sendShowReminders,
    sendNewShowNotifications,
    updateDynamicPricing,
    syncNewMovies
];
