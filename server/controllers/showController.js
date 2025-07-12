import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const OMDB_KEY = process.env.OMDB_KEY;

export const getNowPlayingMovies = async (req, res) => {
    try {
        // 1. Fetch trending movies from Trakt
        const traktRes = await axios.get("https://api.trakt.tv/movies/trending", {
            headers: {
                "Content-Type": "application/json",
                "trakt-api-version": "2",
                "trakt-api-key": TRAKT_CLIENT_ID
            }
        });

        const traktData = traktRes.data;
        const movies = [];

        for (const item of traktData) {
            const imdbID = item.movie.ids.imdb;

            if (!imdbID) continue;

            // 2. Fetch detailed movie info from OMDb using IMDb ID
            const omdbRes = await axios.get(`http://www.omdbapi.com/?i=${imdbID}&apikey=${OMDB_KEY}`);
            const omdbData = omdbRes.data;

            if (omdbData.Response === "False") {
                console.warn(`OMDb error for ${imdbID}: ${omdbData.Error}`);
                continue;
            }

            // 3. Push movie object to response array
            movies.push({
                id: omdbData.imdbID,
                title: omdbData.Title,
                overview: omdbData.Plot,
                poster_path: omdbData.Poster,
                backdrop_path: "", // OMDb doesn't provide this
                release_date: omdbData.Released,
                original_language: omdbData.Language,
                tagline: "", // OMDb doesn't provide this
                genres: omdbData.Genre.split(", "),
                casts: omdbData.Actors.split(", "),
                vote_average: parseFloat(omdbData.imdbRating) || 0,
                runtime: parseInt(omdbData.Runtime) || 0
            });
        }

        res.json({ success: true, movies });
    } catch (error) {
        console.error("❌ Error fetching trending movies:", error.message);
        res.status(500).json({ success: false, message: "Failed to fetch movies from Trakt/OMDb" });
    }
};

// API to add a new show to the database

export const addShow = async (req, res) => {
    try {
        const { movieId, showsInput, showPrice } = req.body;

        // Check if movie already exists
        let movie = await Movie.findById(movieId);

        // If movie doesn't exist, fetch and save it
        if (!movie) {
            // 1. Fetch movie details from OMDb using IMDb ID
            const omdbRes = await axios.get(`http://www.omdbapi.com/?i=${movieId}&apikey=${OMDB_KEY}`);
            const omdbData = omdbRes.data;

            if (omdbData.Response === "False") {
                return res.status(404).json({ success: false, message: `Movie not found: ${omdbData.Error}` });
            }

            // 2. Save new movie to DB
            movie = new Movie({
                _id: omdbData.imdbID,
                title: omdbData.Title,
                overview: omdbData.Plot,
                poster_path: omdbData.Poster,
                backdrop_path: "", // OMDb doesn't provide this
                release_date: omdbData.Released,
                original_language: omdbData.Language,
                tagline: "", // Optional
                genres: omdbData.Genre?.split(", ") || [],
                casts: omdbData.Actors?.split(", ") || [],
                vote_average: parseFloat(omdbData.imdbRating) || 0,
                runtime: parseInt(omdbData.Runtime) || 0
            });

            await movie.save();
            console.log(`🎬 New movie saved: ${movie.title}`);
        }

        // 3. Save the show for the movie
        const showsToCreate = [];
        showsInput.forEach(show => {
            const showDate = show.date;
            show.time.forEach((time) => {
                const dateTimeString = `${showDate}T${time}`;
                showsToCreate.push({
                    movie: movieId,
                    showDateTime: new Date(dateTimeString),
                    showPrice,
                    occupiedSeats: {}
                })
            })
        });
        if (showsToCreate.length > 0) {
            await Show.insertMany(showsToCreate);
        }

        res.status(201).json({ success: true, message: "Show added successfully" });
    } catch (error) {
        console.error("❌ Error in addShow:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// API to get all shows from the database I
export const getShows = async (req, res) => {
    try {
        const shows = await Show.find({ showDateTime: { $gte: new Date() } }).populate('movie').sort({ showDateTime: 1 });

        // filter unique shows
        const uniqueShows = new Set(shows.map(show => show.movie))

        res.json({ success: true, shows: Array.from(uniqueShows) })
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// API to get a single show from the database
export const getShow = async (req, res) => {
    try {
        const { movieId } = req.params;

        // get all upcoming shows for the movie
        const shows = await Show.find({ movie: movieId, showDateTime: { $gte: new Date() } })

        const movie = await Movie.findById(movieId);
        const dateTime = {};

        shows.forEach((show) => {
            const date = show.showDateTime.toISOString().split("T")[0];
            if (!dateTime[date]) {
                dateTime[date] = []
            }
            dateTime[date].push({ time: show.showDateTime, showId: show._id })
        })
        res.json({success:true, movie, dateTime})
    } catch (error) {
        console.error(error)
        res.json({success: false, message: error.message})
    }
}
