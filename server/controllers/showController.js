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
            const omdbRes = await axios.get(`http://www.omdbapi.com/?i=tt3896198&apikey=8d3506a1`);
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
