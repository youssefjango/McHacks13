import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Camera } from 'lucide-react';
import Logo from "../assets/Logo.svg"
import { useFace } from '../context/FaceContext';
import Sidebar from './Sidebar';

const Dashboard = () => {
    const navigate = useNavigate();
    const { knownFaces, childhoodPhoto, relaxingMusicUrl, emergencyContact } = useFace();
    const [showMenu, setShowMenu] = useState(false);
    const [showRelaxation, setShowRelaxation] = useState(false);
    const user = "Pierre";

    return (
        <div className="p-5 h-full overflow-y-auto">
            {showMenu && <Sidebar onClose={() => setShowMenu(false)} />}

            {/* Top Bar */}
            <div className="flex items-center justify-between mb-6">
                <Menu onClick={() => setShowMenu(true)} className="cursor-pointer" />
                <img src={Logo} className='w-40' alt="Logo" />
                <Camera onClick={() => navigate('/camera')} className="cursor-pointer" />
            </div>

            <h2 className='text-2xl mb-5'>Hi, <span className='font-bold'>{user}</span>!</h2>

            {/* Slider */}
            <div className="relative w-full">
                <h2 className='my-5 text-xl'>Your last connections :</h2>
                <div className="overflow-x-scroll pb-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    <div className="flex gap-5">
                        {knownFaces.length > 0 ? knownFaces.map((c, i) => (
                            <div key={i} className="flex-shrink-0 w-52 bg-white rounded-[2rem] border border-gray-100 p-4 flex flex-col shadow-sm hover:shadow-md transition-all">
                                <div className="relative mb-3">
                                    <img
                                        src={c.faceImage || c.photo || "https://via.placeholder.com/100"}
                                        className="object-cover w-full h-32 rounded-2xl shadow-inner border-2 border-white"
                                        alt={c.name}
                                    />
                                    {c.contact && (
                                        <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></div>
                                    )}
                                </div>

                                <div className="flex-1 text-center">
                                    <strong className="block text-base font-black text-gray-900 truncate uppercase tracking-tight">{c.name}</strong>
                                    <span className="text-[10px] font-bold text-gray-400 mb-2 block uppercase tracking-widest">{c.bio || 'Friend'}</span>

                                    {c.contact && (
                                        <div className="mb-2 text-[10px] font-black text-gray-700 bg-gray-50 inline-flex items-center gap-1 px-3 py-1 rounded-full border border-gray-100">
                                            <span>📞</span> {c.contact}
                                        </div>
                                    )}

                                    {c.tags && (
                                        <div className="flex flex-wrap justify-center gap-1 mb-3">
                                            {c.tags.slice(0, 2).map((tag, idx) => (
                                                <span key={idx} className="px-2 py-0.5 text-[8px] font-black text-gray-500 bg-white rounded-full border border-gray-100 uppercase tracking-wider">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="w-full py-3 bg-[#ff5c5c] hover:bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-100 hover:shadow-red-200 transition-all active:scale-[0.98] border-b-4 border-red-700"
                                    onClick={() => navigate(`/history/${c.name}`)}
                                >
                                    View About
                                </button>
                            </div>
                        )) : (
                            <div className="w-full p-10 text-center bg-white rounded-[2rem] border border-dashed border-gray-200">
                                <p className="text-sm font-bold text-gray-300">No connections yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-4 mb-10 mt-10">
                {/* Relaxation Button */}
                <button
                    onClick={() => setShowRelaxation(true)}
                    className="flex-1 py-6 px-4 bg-[#fab005] hover:bg-yellow-500 text-white rounded-[2rem] shadow-xl shadow-yellow-100 hover:shadow-yellow-200 transition-all active:scale-[0.98] flex flex-col items-center gap-3 border-b-4 border-yellow-700"
                >
                    <span className="text-3xl">🎵</span>
                    <span className="text-xs font-black uppercase tracking-widest text-[#5c4000]">Relax</span>
                </button>

                {/* Emergency Button */}
                <a
                    href={emergencyContact ? `tel:${emergencyContact}` : '#'}
                    className="flex-1 py-6 px-4 bg-[#ff5c5c] hover:bg-red-600 text-white rounded-[2rem] shadow-xl shadow-red-100 hover:shadow-red-200 transition-all active:scale-[0.98] flex flex-col items-center gap-3 border-4 border-red-800"
                    onClick={(e) => {
                        if (!emergencyContact) {
                            e.preventDefault();
                            alert('No emergency contact set. Please configure in Settings (Admin Panel).');
                        }
                    }}
                >
                    <span className="text-3xl">🆘</span>
                    <span className="text-xs font-black uppercase tracking-widest text-white">S.O.S</span>
                </a>
            </div>

            {/* Relaxation Modal */}
            {showRelaxation && (
                <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-8" onClick={() => setShowRelaxation(false)}>
                    <button
                        className="absolute top-6 right-6 text-white text-4xl font-light hover:opacity-70"
                        onClick={() => setShowRelaxation(false)}
                    >
                        ×
                    </button>

                    {childhoodPhoto ? (
                        <img
                            src={childhoodPhoto}
                            alt="Cherished Memory"
                            className="max-w-full max-h-[60vh] rounded-3xl shadow-2xl object-contain mb-6"
                        />
                    ) : (
                        <div className="w-64 h-64 bg-white/10 rounded-3xl flex items-center justify-center mb-6">
                            <span className="text-white/50 text-center px-4">Add a childhood photo in Settings</span>
                        </div>
                    )}

                    <p className="text-white/70 text-lg mb-4 italic">A cherished memory...</p>

                    {relaxingMusicUrl && (
                        <audio autoPlay loop className="hidden">
                            <source src={relaxingMusicUrl} />
                        </audio>
                    )}

                    <p className="text-white/50 text-sm">Tap anywhere to close</p>
                </div>
            )}

            <div className="relative w-full mt-4">
                <h2 className='my-5 text-xl'>Your next meetings :</h2>
                <div className="rounded-2xl w-full h-50 bg-red-100 flex justify-center items-center">
                    <p className='italic opacity-50 text-red-800'>Coming soon...</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
