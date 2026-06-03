import React, { useEffect, useState } from "react";
import { dummyShowsData } from "../../assets/assets";
import Loading from "../../components/Loading";
import Title from "../../components/admin/Title";
import { dateFormat } from "../../lib/dateFormat";
import { useAppContext } from "../../context/AppContext";
import toast from "react-hot-toast";

const ListShows = () => {

    const { axios, getToken, user } = useAppContext()

    const currency = import.meta.env.VITE_CURRENCY

    const [shows, setShows] = useState([])
    const [loading, setLoading] = useState(true)

    // Edit state
    const [editingShow, setEditingShow] = useState(null)
    const [editDate, setEditDate] = useState("")
    const [editTime, setEditTime] = useState("")
    const [editPrice, setEditPrice] = useState("")

    // When clicking edit, populate the modal fields
    useEffect(() => {
        if (editingShow) {
            const dateObj = new Date(editingShow.showDateTime);
            setEditDate(dateObj.toISOString().split('T')[0]);
            setEditTime(dateObj.toTimeString().slice(0, 5));
            setEditPrice(editingShow.showPrice || "");
        }
    }, [editingShow]);

    const getAllShows = async () => {
        try {
             const token = await getToken();
            const {data} = await axios.get('/api/admin/all-shows', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setShows(data.shows)
            setLoading(false);
        } catch (error) {
            console.error(error);
        }
    }

    const handleDeleteShow = async (id) => {
        if (!window.confirm("Are you sure you want to delete this specific show? This will also delete any bookings for it.")) return;

        try {
            const token = await getToken();
            const { data } = await axios.delete(`/api/admin/show/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data.success) {
                toast.success(data.message);
                setShows(shows.filter(s => s._id !== id));
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete show");
        }
    };

    const handleUpdateShow = async () => {
        if (!editDate || !editTime || !editPrice) {
            return toast.error("Please fill all fields");
        }
        try {
            const token = await getToken();
            const { data } = await axios.put(`/api/admin/show/${editingShow._id}`, {
                date: editDate,
                time: editTime,
                showPrice: editPrice
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                toast.success(data.message);
                setEditingShow(null);
                getAllShows(); // refresh list to see updated date/time
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to update show");
        }
    };

    useEffect(() => {
        if(user){
            getAllShows()
        }
    }, [user])

    return !loading ? (
        <>
            <Title text1="List" text2="Shows" />

            <div className="max-w-4xl mt-6 overflow-x-auto">
                <table className="w-full border-collapse rounded-md overflow-hidden text-nowrap">
                    <thead>
                        <tr className="bg-primary/20 text-left text-white">
                            <th className="p-2 font-medium pl-5">Movie Name</th>
                            <th className="p-2 font-medium">Show Time</th>
                            <th className="p-2 font-medium">Total Bookings</th>
                            <th className="p-2 font-medium">Earnings</th>
                            <th className="p-2 font-medium text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-light">
                        {shows.map((show, index) => (
                            <tr key={index} className="border-b border-primary/10 bg-primary/5 even:bg-primary/10">
                                <td className="p-2 min-w-45 pl-5">{show.movie.title}</td>
                                <td className="p-2">{dateFormat(show.showDateTime)}</td>
                                <td className="p-2">{Object.keys(show.occupiedSeats).length}
                                </td>
                                <td className="p-2">{currency} {Object.keys(show.
                                    occupiedSeats).length * show.showPrice}</td>
                                <td className="p-2 text-center space-x-3">
                                    <button onClick={() => setEditingShow(show)} className="text-blue-400 hover:text-blue-300 transition">Edit</button>
                                    <button onClick={() => handleDeleteShow(show._id)} className="text-red-500 hover:text-red-400 transition">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Show Modal */}
            {editingShow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
                    <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md border border-gray-700">
                        <h2 className="text-xl font-bold mb-4">Edit Show</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Date</label>
                                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded p-2 outline-none focus:border-primary" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Time</label>
                                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded p-2 outline-none focus:border-primary" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Ticket Price ({currency})</label>
                                <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded p-2 outline-none focus:border-primary" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setEditingShow(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleUpdateShow} className="px-4 py-2 text-sm bg-primary hover:bg-primary-dull text-white rounded transition">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    ) : (
        <Loading />
    )
}

export default ListShows;