import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle, XCircle, ScanLine, Camera } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { dateFormat } from "../../lib/dateFormat";

const ScanTicket = () => {
    const { axios, getToken } = useAppContext();
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState(null); // { success, ticket/message }
    const [error, setError] = useState(null);
    const html5QrRef = useRef(null);

    const startScanner = async () => {
        setResult(null);
        setError(null);
        setScanning(true);
    };

    useEffect(() => {
        if (!scanning) return;

        const html5Qr = new Html5Qrcode("qr-reader");
        html5QrRef.current = html5Qr;

        html5Qr.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                // Stop scanning after first successful scan
                if (html5QrRef.current && html5QrRef.current.isScanning) {
                    try {
                        html5QrRef.current.stop().then(() => {
                            html5QrRef.current.clear();
                        }).catch(console.error);
                    } catch (err) {
                        console.error("Synchronous error stopping scanner:", err);
                    }
                }
                setScanning(false);
                verifyToken(decodedText);
            },

            () => {} // ignore per-frame errors
        ).catch((err) => {
            setScanning(false);
            setError("Could not access camera. Please allow camera permissions.");
        });

        return () => {
            if (html5QrRef.current && html5QrRef.current.isScanning) {
                try {
                    html5QrRef.current.stop().then(() => {
                        html5QrRef.current.clear();
                    }).catch(() => {});
                } catch (err) {
                    console.error("Cleanup error stopping scanner:", err);
                }
            }
        };
    }, [scanning]);

    const verifyToken = async (token) => {
        try {
            const { data } = await axios.get(`/api/booking/verify/${token}`, {
                headers: { Authorization: `Bearer ${await getToken()}` }
            });
            setResult(data);
        } catch (err) {
            setResult({ success: false, message: "Ticket is not valid! Please try again." });
        }
    };

    const reset = () => {
        setResult(null);
        setError(null);
        setScanning(false);
    };

    return (
        <div className="flex-1 p-6 md:p-10 min-h-screen bg-[#0f0f0f] text-white">
            <h1 className="text-2xl font-bold mb-1">Scan Ticket QR</h1>
            <p className="text-gray-400 text-sm mb-8">Point the camera at a customer's ticket QR code to verify entry.</p>

            {/* Scanner Box */}
            {!result && (
                <div className="max-w-md mx-auto">
                    <div
                        id="qr-reader"
                        className={`rounded-2xl overflow-hidden bg-gray-900 border-2 ${scanning ? 'border-primary' : 'border-gray-700'} min-h-[300px] flex items-center justify-center`}
                    >
                        {!scanning && (
                            <div className="flex flex-col items-center gap-3 text-gray-500 p-10">
                                <ScanLine className="w-12 h-12 text-primary/40" />
                                <p className="text-sm text-center">Camera will appear here when scanning starts</p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                            <XCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={scanning ? reset : startScanner}
                        className={`mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition cursor-pointer ${
                            scanning
                                ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                                : 'bg-primary hover:bg-primary/80 text-white'
                        }`}
                    >
                        <Camera className="w-5 h-5" />
                        {scanning ? 'Stop Scanner' : 'Start Scanner'}
                    </button>
                </div>
            )}

            {/* Verification Result */}
            {result && (
                <div className="max-w-md mx-auto">
                    {result.success ? (
                        <div className="bg-green-900/20 border border-green-500/40 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
                                <div>
                                    <p className="text-green-400 font-bold text-lg">Valid Ticket ✓</p>
                                    <p className="text-gray-400 text-xs">Entry approved</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <img
                                    src={result.ticket.poster}
                                    alt={result.ticket.movie}
                                    className="w-20 rounded-lg object-cover flex-shrink-0"
                                />
                                <div className="flex flex-col gap-1.5 text-sm">
                                    <p className="font-semibold text-base text-white">{result.ticket.movie}</p>
                                    <p className="text-gray-400">{dateFormat(result.ticket.showDateTime)}</p>
                                    <p className="text-gray-300">
                                        <span className="text-gray-500">Seats: </span>
                                        {result.ticket.seats.join(", ")}
                                    </p>
                                    <p className="text-gray-300">
                                        <span className="text-gray-500">Amount Paid: </span>
                                        ₹{result.ticket.amount}
                                    </p>
                                    <p className="text-gray-300">
                                        <span className="text-gray-500">Tickets: </span>
                                        {result.ticket.seats.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-red-900/20 border border-red-500/40 rounded-2xl p-6 flex items-center gap-4">
                            <XCircle className="w-10 h-10 text-red-400 flex-shrink-0" />
                            <div>
                                <p className="text-red-400 font-bold text-lg">Invalid Ticket!</p>
                                <p className="text-gray-400 text-sm mt-1">{result.message}</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={reset}
                        className="mt-5 w-full py-3 rounded-xl bg-primary hover:bg-primary/80 font-semibold transition cursor-pointer"
                    >
                        Scan Another Ticket
                    </button>
                </div>
            )}
        </div>
    );
};

export default ScanTicket;
