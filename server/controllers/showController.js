import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";
import redisClient from "../configs/redis.js";

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.tmdb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

// Helper: map TMDB genre IDs to names
const GENRE_MAP = { 28:"Action",12:"Adventure",16:"Animation",35:"Comedy",80:"Crime",99:"Documentary",18:"Drama",10751:"Family",14:"Fantasy",36:"History",27:"Horror",10402:"Music",9648:"Mystery",10749:"Romance",878:"Science Fiction",10770:"TV Movie",53:"Thriller",10752:"War",37:"Western" };

// first 30 movies fetching from the TMDB api and stores it to the Redis
export const getNowPlayingMovies = async (req, res) => {
    try {
        if (!TMDB_KEY) {
            return res.status(400).json({ success: false, message: "TMDB_API_KEY is not configured" });
        }

        // Check Redis Cache first
        if (redisClient.isReady) {
            const cachedMovies = await redisClient.get('now_playing_movies');
            if (cachedMovies) {
                console.log("Serving movies from Redis Cache");
                return res.json({ success: true, movies: JSON.parse(cachedMovies) });
            }
        }

        console.log("Fetching movies from TMDB API");
        // Fetch now_playing + upcoming from TMDB for a full list

        const [nowRes, upcomingRes] = await Promise.all([
            axios.get(`${TMDB_BASE}/movie/now_playing?api_key=${TMDB_KEY}&language=en-US&page=1`),
            axios.get(`${TMDB_BASE}/movie/upcoming?api_key=${TMDB_KEY}&language=en-US&page=1`),
        ]);

        const combined = [...nowRes.data.results, ...upcomingRes.data.results];

        // Deduplicate by TMDB id(for removing the duplicate id we declare the set)
        const seen = new Set();
        const unique = combined.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });

        const movies = unique.slice(0, 30).map(m => ({
            id: String(m.id),  // use TMDB id as the movie id
            title: m.title,
            overview: m.overview,
            poster_path: m.poster_path ? `${TMDB_IMG}/w500${m.poster_path}` : "",
            backdrop_path: m.backdrop_path ? `${TMDB_IMG}/w1280${m.backdrop_path}` : "",
            release_date: m.release_date,
            original_language: m.original_language,
            tagline: "",
            genres: (m.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean),
            vote_average: m.vote_average || 0,
            vote_count: m.vote_count || 0,
            runtime: 0,
        }));

        // Store in Redis with an expiration of 30 minutes (1800 seconds)
        if (redisClient.isReady) {
            await redisClient.setEx('now_playing_movies', 1800, JSON.stringify(movies));
        }

        res.json({ success: true, movies });

    } catch (error) {
        console.error("Error fetching TMDB movies:", error.message);
        res.status(500).json({ success: false, message: "Failed to fetch movies from TMDB" });
    }
};

// API to add a new show to the database

export const addShow = async (req, res) => {
    try {
        const { movieId, showsInput, showPrice } = req.body;

        // Check if movie already exists
        let movie = await Movie.findById(movieId);

        // If movie doesn't exist, fetch from TMDB and save it
        if (!movie) {
            if (!TMDB_KEY) {
                return res.status(400).json({ success: false, message: "TMDB_API_KEY is not configured" });
            }

            // 1. Fetch full movie details from TMDB
            const [detailsRes, creditsRes] = await Promise.all([
                axios.get(`${TMDB_BASE}/movie/${movieId}?api_key=${TMDB_KEY}&language=en-US`),
                axios.get(`${TMDB_BASE}/movie/${movieId}/credits?api_key=${TMDB_KEY}&language=en-US`),
            ]);

            const m = detailsRes.data;
            if (!m || !m.id) {
                return res.status(404).json({ success: false, message: "Movie not found on TMDB" });
            }

            const casts = (creditsRes.data.cast || []).slice(0, 8).map(c => c.name);
            const genres = (m.genres || []).map(g => g.name);


            // 3. Save new movie to DB
            movie = new Movie({
                _id: String(m.id),
                title: m.title,
                overview: m.overview,
                poster_path: m.poster_path ? `${TMDB_IMG}/w500${m.poster_path}` : "",
                backdrop_path: m.backdrop_path ? `${TMDB_IMG}/w1280${m.backdrop_path}` : "",
                release_date: m.release_date,
                original_language: m.original_language,
                tagline: m.tagline || "",
                genres,
                casts,
                vote_average: m.vote_average || 0,
                runtime: m.runtime || 0
            });

            await movie.save();
            console.log(`New movie saved: ${movie.title}`);
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

        // Trigger inngest event
        await inngest.send({
            name:"app/show.added",
            data:{movieTitle: movie.title}
        })

        // Invalidate 'all_shows' cache
        if (redisClient.isReady) {
            await redisClient.del('all_shows');
        }

        res.status(201).json({ success: true, message: "Show added successfully" });
    } catch (error) {
        console.error("Error in addShow:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// API to get all shows from the database I
export const getShows = async (req, res) => {
    try {
        // Check Redis Cache first
        if (redisClient.isReady) {
            const cachedShows = await redisClient.get('all_shows');
            if (cachedShows) {
                console.log("Serving all shows from Redis Cache");
                return res.json({ success: true, shows: JSON.parse(cachedShows) });
            }
        }

        console.log("Fetching all shows from MongoDB");
        const shows = await Show.find({ showDateTime: { $gte: new Date() } }).populate('movie').sort({ showDateTime: 1 });

        // filter unique shows
        const uniqueShows = new Set(shows.map(show => show.movie))
        const finalShows = Array.from(uniqueShows);

        // Store in Redis with an expiration of 15 minutes (900 seconds)
        if (redisClient.isReady) {
            await redisClient.setEx('all_shows', 900, JSON.stringify(finalShows));
        }

        res.json({ success: true, shows: finalShows })
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// API to get all movies sorted by release date
export const getMovies = async (req, res) => {
    try {
        const movies = await Movie.find({}).sort({ release_date: -1 }).limit(18);
        res.json({ success: true, movies });
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
            dateTime[date].push({ time: show.showDateTime, showId: show._id, price: show.showPrice })
        })
        res.json({success:true, movie, dateTime})
    } catch (error) {
        console.error(error)
        res.json({success: false, message: error.message})
    }
}
