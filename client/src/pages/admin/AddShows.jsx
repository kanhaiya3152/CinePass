import React, { useEffect, useState } from "react";
import Loading from "../../components/Loading";
import Title from "../../components/admin/Title";
import { CheckIcon, DeleteIcon, StarIcon } from "lucide-react";
import { kConverter } from "../../lib/kConverter";
import { useAppContext } from "../../context/AppContext";
import toast from "react-hot-toast";

const AddShows = () => {

    const { axios, getToken, user } = useAppContext()

    const currency = import.meta.env.VITE_CURRENCY
    const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [dateTimeSelection, setDateTimeSelection] = useState({});
    const [dateTimeInput, setDateTimeInput] = useState("");
    const [showPrice, setShowPrice] = useState("");
    const [addingShow, setAddingShow] = useState(false);

    const fetchingNowPlayingMovies = async () => {
        try {
            const token = await getToken();
            const [tmdbRes, dbRes] = await Promise.all([
                axios.get('/api/show/now-playing', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/show/movies')
            ]);

            let combinedMovies = [];
            
            // First add movies already in DB
            if (dbRes.data.success) {
                // Map DB movies to match TMDB format expected by the UI
                const dbMovies = dbRes.data.movies.map(m => ({
                    id: m._id,
                    title: m.title,
                    poster_path: m.poster_path,
                    vote_average: m.vote_average,
                    release_date: m.release_date,
                    vote_count: 0,
                    isExisting: true // badge to show it's already in DB
                }));
                combinedMovies = [...dbMovies];
            }

            // Then add TMDB movies (avoiding duplicates)
            if (tmdbRes.data.success) {
                const existingIds = new Set(combinedMovies.map(m => m.id));
                const tmdbMovies = tmdbRes.data.movies.filter(m => !existingIds.has(m.id));
                combinedMovies = [...combinedMovies, ...tmdbMovies];
            }

            setNowPlayingMovies(combinedMovies);
        } catch (error) {
            console.error("Error fetching movies", error)
        }
    }

    const handleDateTimeAdd = () => {
        if (!dateTimeInput) return;
        const [date, time] = dateTimeInput.split("T");
        if (!date || !time) return;

        setDateTimeSelection((prev) => {
            const times = prev[date] || [];
            if (!times.includes(time)) {
                return { ...prev, [date]: [...times, time] };
            }
            return prev;
        });
    };

    const handleRemoveTime = (date, time) => {
        setDateTimeSelection((prev) => {
            const filteredTimes = prev[date].filter((t) => t !== time);
            if (filteredTimes.length === 0) {
                const { [date]: _, ...rest } = prev;
                return rest;
            }
            return {
                ...prev,
                [date]: filteredTimes,
            };
        });
    };

    const handleSubmit = async () => {
        try {
            setAddingShow(true)

            if (!selectedMovie || Object.keys(dateTimeSelection).length === 0 || !showPrice) {
                return toast('Missing required fields');
            }

            const showsInput = Object.entries(dateTimeSelection).map(([date, time]) => ({ date, time }))

            const payLoad = {
                movieId: selectedMovie,
                showsInput,
                showPrice: Number(showPrice)
            }

            const token = await getToken();

            const {data} = await axios.post('/api/show/add', payLoad,{
                headers: { Authorization: `Bearer ${token}`}
            })

            if(data.success){
                toast.success(data.message)
                setSelectedMovie(null)
                setDateTimeSelection({})
                setShowPrice("")
            }else{
                toast.error(data.message)
            }

        } catch (error) {
            console.error("Submission error",error)
            toast.error("An error occured. Please try again.")
        }
        setAddingShow(false)
    }


    useEffect(() => {
        if (user) {
            fetchingNowPlayingMovies()
        }
    }, [user])

    return nowPlayingMovies.length > 0 ? (
        <>
            <Title text1="Add" text2="Shows" />
            <p className="mt-10 text-lg font-medium">Now Playing Movies</p>
            <div className="overflow-x-auto pb-4">
                <div className="group flex flex-wrap gap-4 mt-4 w-max">
                    {nowPlayingMovies.map((movie) => (
                        <div onClick={() => setSelectedMovie(movie.id)} key={movie.id} className={`relative max-w-40 cursor-pointer group-hover:not-hover:opacity-40 hover:-translate-y-1 transition duration-300 `}>
                            <div className="relative rounded-lg overflow-hidden">
                                <img src={movie.poster_path} alt="" className="w-full object-cover brightness-90" />

                                <div className="text-sm flex items-center justify-between p-2 bg-black/70 w-full absolute bottom-0 left-0">
                                    <p className="flex items-center gap-1 text-gray-400">
                                        <StarIcon className="w-4 h-4 text-primary fill-primary" />
                                        {movie.vote_average.toFixed(1)}
                                    </p>
                                    <p className="text-gray-300">{kConverter(movie.vote_count)} Votes</p>
                                </div>
                            </div>
                            {selectedMovie === movie.id && (
                                <div className="absolute top-2 right-2 flex items-center justify-center bg-primary h-6 w-6 rounded z-10">
                                    <CheckIcon className="w-4 h-4 text-white" strokeWidth={2.5} />
                                </div>
                            )}
                            {movie.isExisting && (
                                <div className="absolute top-2 left-2 flex items-center justify-center bg-green-600/90 text-white text-[10px] px-2 py-0.5 rounded font-medium z-10">
                                    In DB
                                </div>
                            )}
                            <p className="font-medium truncate mt-2">{movie.title}</p>
                            <p className="text-gray-400 text-sm">{movie.release_date}</p>
                        </div>
                    ))}
                </div>
            </div>
            {/* Show Price Input */}
            <div className="mt-8">
                <label className="block text-sm font-medium mb-2">Show Price</label>
                <div className="inline-flex items-center gap-2 border border-gray-600 px-3 py-2 rounded-md">
                    <p className="text-gray-400 text-sm">{currency}</p>
                    <input min={0} type="number" value={showPrice} onChange={(e) =>
                        setShowPrice(e.target.value)} placeholder="Enter show price"
                        className="outline-none" />
                </div>
            </div>

            {/* Date & Time Selection */}
            <div className="mt-6">
                <label className="block text-sm font-medium mb-2">Select Date and Time</
                label>
                <div className="inline-flex gap-5 border border-gray-600 p-1 pl-3 rounded-lg">
                    <input type="datetime-local" value={dateTimeInput} onChange={(e) =>
                        setDateTimeInput(e.target.value)} className="outline-none rounded-md" />
                    <button onClick={handleDateTimeAdd} className="bg-primary/80 active:scale-95
                    text-white px-3 py-2 text-sm rounded-lg hover:bg-primary cursor-pointer" >
                        Add Time
                    </button>
                </div>
            </div>

            {/* Display Selected Times */}
            {Object.keys(dateTimeSelection).length > 0 && (
                <div className="mt-6">
                    <h2 className=" mb-2">Selected Date-Time</h2>
                    <ul className="space-y-3">
                        {Object.entries(dateTimeSelection).map(([date, times]) => (
                            <li key={date}>
                                <div className="font-medium">{date}</div>
                                <div className="flex flex-wrap gap-2 mt-1 text-sm">
                                    {times.map((time) => (
                                        <div key={time} className="border border-primary px-2 py-1 flex items-center rounded" >
                                            <span>{time}</span>
                                            <DeleteIcon onClick={() => handleRemoveTime(date, time)} width={15} className="ml-2 text-red-500 hover:text-red-700 cursor-pointer" />
                                        </div>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <button onClick={handleSubmit} disabled={addingShow} className="bg-primary text-white px-8 py-2 mt-6 active:scale-95 rounded hover:bg-primary/90 transition-all cursor-pointer" >
                Add Show
            </button>
        </>
    ) : (
        <Loading />
    )
}

export default AddShows;