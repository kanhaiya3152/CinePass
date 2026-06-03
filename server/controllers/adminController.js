import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/Users.js";


// API to check if user is admin
export const isAdmin = async (req, res) => {
    res.json({ success: true, isAdmin: true })
}

// API to get dashboard data
export const getDashboardData = async (req, res) => {
    try {
        const bookings = await Booking.find({ isPaid: true });
        const activeShows = await Show.find({ showDateTime: { $gte: new Date() } }).
            populate('movie');
        const totalUser = await User.countDocuments();

        const dashboardData = {
            totalBookings: bookings.length,
            totalRevenue: bookings.reduce((acc, booking) => acc + booking.amount, 0),
            activeShows,
            totalUser
        }
        res.json({ success: true, dashboardData })

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message })
    }
}

// API to get all shows
export const getAllShows = async (req, res) => {
    try {
        const shows = await Show.find({ showDateTime: { $gte: new Date() } }).populate
            ('movie').sort({ showDateTime: 1 })
        res.json({ success: true, shows })
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message })
    }
}

// API to get all bookings
export const getAllBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({}).populate('user').populate({
            path: "show",
            populate: { path: "movie" }
        }).sort({ createdAt: -1 })
        
        res.json({ success: true, bookings })
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message })
    }
}

// API to delete a movie and all its shows
export const deleteMovie = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find all shows for this movie
        const shows = await Show.find({ movie: id });
        const showIds = shows.map(s => s._id);

        // Delete all related bookings (optional but keeps DB clean)
        await Booking.deleteMany({ show: { $in: showIds } });

        // Delete all shows
        await Show.deleteMany({ movie: id });

        // Delete the movie
        await Movie.findByIdAndDelete(id);

        res.json({ success: true, message: "Movie and all related shows deleted completely." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// API to delete a specific show
export const deleteShow = async (req, res) => {
    try {
        const { id } = req.params;

        // Delete bookings for this show
        await Booking.deleteMany({ show: id });

        // Delete the show
        await Show.findByIdAndDelete(id);

        res.json({ success: true, message: "Show deleted successfully." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// API to update a show's time and price
export const updateShow = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, time, showPrice } = req.body;

        const dateTimeString = `${date}T${time}`;
        
        await Show.findByIdAndUpdate(id, {
            showDateTime: new Date(dateTimeString),
            showPrice: Number(showPrice)
        });

        res.json({ success: true, message: "Show updated successfully." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}