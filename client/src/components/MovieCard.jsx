import { StarIcon } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import timeFormat from "../lib/timeFormat";

const MovieCard = ({ movie, hasShows = true }) => {
    const navigate = useNavigate()
    return (
        <div className='flex flex-col justify-between p-3 bg-gray-800 rounded-2xl hover:-translate-y-1 transition duration-300 w-66'>
            <div className="relative">
                <img onClick={() => { if(hasShows){ navigate(`/movies/${movie._id}`); scrollTo(0, 0) }}}
                    src={movie.poster_path} alt="" className={`rounded-lg h-55 w-full object-cover ${hasShows ? 'cursor-pointer' : 'cursor-default brightness-75'}`} />
                {!hasShows && (
                    <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                        Coming Soon
                    </div>
                )}
            </div>
            <p className='font-semibold mt-2 truncate'> {movie.title}</p>
            <p className='text-sm text-gray-400 mt-2'>
                {movie.release_date ? new Date(movie.release_date).getFullYear() : "TBA"} {movie.genres?.slice(0, 2)
                    .map(genre => genre.name || genre).join(" | ")} {movie.runtime ? timeFormat(movie.runtime) : ""}
            </p>

            <div className='flex items-center justify-between mt-4 pb-3'>
                {hasShows ? (
                    <button onClick={() => { navigate(`/movies/${movie._id}`); scrollTo(0, 0) }}
                        className='px-4 py-2 text-xs bg-primary hover:bg-primary-dull transition
                        rounded-full font-medium cursor-pointer'>Buy Tickets</button>
                ) : (
                    <button
                        className='px-4 py-2 text-xs bg-gray-600 text-gray-300 rounded-full font-medium cursor-not-allowed'
                        disabled>Coming Soon</button>
                )}
                <p className="flex items-center gap-1">
                    <StarIcon className="w-4 h-4 text-primary fill-primary" />
                    {movie.vote_average?.toFixed(1)}
                </p>
            </div>
        </div>
    )
}

export default MovieCard