import React, { useEffect, useState } from "react"
import MovieCard from "../components/MovieCard"
import BlurCircle from "../components/BlurCircle"
import { useAppContext } from "../context/AppContext"

const Movie = () => {

  const {shows, axios} = useAppContext()
  const [newReleases, setNewReleases] = useState([])

  // IDs of movies that already have bookable shows
  const showingIds = new Set(shows.map(m => m._id))

  const fetchNewReleases = async () => {
    try {
      const { data } = await axios.get('/api/show/movies')
      if (data.success) {
        // Only show movies that are NOT already in "Now Showing"
        setNewReleases(data.movies.filter(m => !showingIds.has(m._id)))
      }
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    fetchNewReleases()
  }, [shows])

  return (
    <div className='relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]'>

      <BlurCircle top="150px" left="0"/>
      <BlurCircle bottom="50px" right="50px"/>

      <h1 className='text-2xl font-semibold my-4'>Now Showing</h1>
      <p className='text-gray-400 text-sm mb-6'>Movies with scheduled showtimes — ready to book!</p>
      {shows.length > 0 ? (
        <div className='flex flex-wrap max-sm:justify-center gap-8 mb-16'>
          {shows.map((movie) => (
            <MovieCard movie={movie} key={movie._id} hasShows={true} />
          ))}
        </div>
      ) : (
        <p className="text-gray-400 mb-16">No movies available for booking right now.</p>
      )}

      <h1 className='text-2xl font-semibold my-4 border-t border-gray-800 pt-8'>New Releases & Coming Soon</h1>
      <p className='text-gray-400 text-sm mb-6'>Latest movies — showtimes will be added by admin soon.</p>
      {newReleases.length > 0 ? (
        <div className='flex flex-wrap max-sm:justify-center gap-8'>
          {newReleases.map((movie) => (
            <MovieCard movie={movie} key={movie._id} hasShows={false} />
          ))}
        </div>
      ) : (
        <p className="text-gray-400">All new releases already have shows scheduled!</p>
      )}
    </div>
  )
}

export default Movie
