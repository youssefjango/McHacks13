import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from "../assets/Logo.svg"
import { Menu, Camera } from 'lucide-react';
import Sidebar from './Sidebar';
import { useFace } from '../context/FaceContext';

const Connections = () => {
    const [showMenu, setShowMenu] = useState(false);
    const navigate = useNavigate();
    const { knownFaces } = useFace();

    return (
        <div className="p-5 flex flex-col h-full bg-gray-50">
            {showMenu && <Sidebar onClose={() => setShowMenu(false)} />}

            {/* Top Bar */}
            <div className="flex items-center justify-between mb-6">
                <Menu onClick={() => setShowMenu(true)} className="cursor-pointer" />
                <img src={Logo} className='w-40' alt="Logo" />
                <Camera onClick={() => navigate('/camera')} className="cursor-pointer" />
            </div>

            <div className="relative flex-1 h-full overflow-hidden">
                <h2 className='my-5 text-xl font-bold'>Your connections :</h2>
                <div className="flex flex-col gap-4 h-full pb-20 overflow-y-auto">
                    {knownFaces.length > 0 ? knownFaces.map((c, i) => (
                        <div key={i} className="group relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-4 sm:p-5 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all rounded-2xl sm:rounded-[2rem]">
                            {/* Image Section */}
                            <div className="relative shrink-0">
                                <img
                                    src={c.faceImage || "https://via.placeholder.com/100"}
                                    className="object-cover w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl shadow-inner border-2 border-white"
                                    alt={c.name}
                                />
                            </div>

                            {/* Info Section */}
                            <div className="flex-1 min-w-0 text-center sm:text-left">
                                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                                    <h3 className="text-lg sm:text-xl font-black text-gray-900 truncate uppercase tracking-tight">{c.name}</h3>
                                    {c.contact && (
                                        <span className="px-2 py-0.5 text-[10px] font-black text-red-600 bg-red-50 rounded-full border border-red-100 uppercase">
                                            Priority
                                        </span>
                                    )}
                                </div>

                                <p className="mb-2 text-sm font-medium text-gray-500 line-clamp-1 italic">
                                    {c.bio || 'Friend'}
                                </p>

                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                    {c.contact && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-gray-700 bg-gray-50 rounded-full border border-gray-100">
                                            <span className="text-red-500">📞</span> {c.contact}
                                        </div>
                                    )}
                                    {c.tags && c.tags.slice(0, 3).map((tag, idx) => (
                                        <span key={idx} className="px-3 py-1 text-[10px] font-bold text-gray-500 bg-white rounded-full border border-gray-100 uppercase tracking-wider">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Action Section */}
                            <div className="w-full sm:w-auto shrink-0 flex items-center mt-3 sm:mt-0 sm:pr-2">
                                <button
                                    className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-xs font-black text-white uppercase tracking-widest rounded-xl sm:rounded-2xl bg-[#ff5c5c] hover:bg-red-600 shadow-lg shadow-red-100 hover:shadow-red-200 transition-all active:scale-[0.98] border-b-4 border-red-700"
                                    onClick={() => navigate(`/history/${c.name}`)}
                                >
                                    View About
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="p-16 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Menu className="text-gray-300 w-10 h-10" />
                            </div>
                            <p className="text-lg font-bold text-gray-400">No connections found yet.</p>
                            <p className="text-sm text-gray-400 mt-1">Faces you detect will appear here.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default Connections;
