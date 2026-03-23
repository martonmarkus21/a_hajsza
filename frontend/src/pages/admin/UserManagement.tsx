
import { useState } from 'react';
import { FiUser, FiTrash2, FiEdit, FiPlus, FiCheckCircle, FiXCircle, FiSearch, FiShield } from 'react-icons/fi';
import { FaSortUp, FaSortDown } from 'react-icons/fa6';
import { UserCog } from 'lucide-react';
import Modal from '../../components/Modal';

interface UserManagementProps {
    users: any[];
    newUser: any;
    setNewUser: (user: any) => void;
    createUser: () => Promise<boolean>;
    deleteUser: (id: number, username: string) => void;
    handleEditUser: (user: any) => void;
}

export default function UserManagement({
    users,
    newUser,
    setNewUser,
    createUser,
    deleteUser,
    handleEditUser
}: UserManagementProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: 'username' | 'email' | 'role' | 'status', direction: 'asc' | 'desc' }>({ key: 'username', direction: 'asc' });

    // Filter users
    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => {
        const direction = sortConfig.direction === 'asc' ? 1 : -1;

        switch (sortConfig.key) {
            case 'username':
                return a.username.localeCompare(b.username) * direction;
            case 'email':
                const emailA = a.email || '';
                const emailB = b.email || '';
                return emailA.localeCompare(emailB) * direction;
            case 'role':
                return a.role.localeCompare(b.role) * direction;
            case 'status':
                const statusA = a.active ? 1 : 0;
                const statusB = b.active ? 1 : 0;
                return (statusA - statusB) * direction;
            default:
                return 0;
        }
    });

    const handleSort = (key: any) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key: string) => {
        const isActive = sortConfig.key === key;
        return (
            <div className="flex flex-col ml-1">
                <FaSortUp className={`w-3 h-3 -mb-3 ${isActive && sortConfig.direction === 'asc' ? 'text-orange-500' : 'text-gray-500 opacity-60'}`} />
                <FaSortDown className={`w-3 h-3 ${isActive && sortConfig.direction === 'desc' ? 'text-orange-500' : 'text-gray-500 opacity-60'}`} />
            </div>
        );
    };

    const handleCreate = async () => {
        const success = await createUser();
        if (success) {
            setShowCreateModal(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Bar */}
            <div className="mw-card flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="relative w-full md:w-96 group">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Keresés felhasználók között..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="mw-input pl-11"
                    />
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="mw-btn mw-btn-primary w-full md:w-auto"
                >
                    <FiPlus className="w-5 h-5" />
                    Új felhasználó
                </button>
            </div>

            {/* Users List */}
            <div className="mw-card p-0 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-orange-500/20 text-orange-500">
                            <UserCog className="w-6 h-6" />
                        </div>
                        Felhasználók listája
                        <span className="text-sm font-normal text-gray-500 ml-2 py-1 px-3 bg-white/5 rounded-full border border-white/5">{filteredUsers.length} felhasználó</span>
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="mw-table">
                        <thead>
                            <tr>
                                <th className="text-left py-4 pl-6 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('username')}>
                                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-white">
                                        Felhasználó {getSortIcon('username')}
                                    </div>
                                </th>
                                <th className="text-left py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('email')}>
                                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-white">
                                        Email {getSortIcon('email')}
                                    </div>
                                </th>
                                <th className="text-left py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('role')}>
                                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-white">
                                        Szerepkör {getSortIcon('role')}
                                    </div>
                                </th>
                                <th className="text-center py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('status')}>
                                    <div className="flex items-center justify-center gap-1 text-gray-400 group-hover:text-white">
                                        Státusz {getSortIcon('status')}
                                    </div>
                                </th>
                                <th className="text-right py-4 pr-6">Műveletek</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-500">
                                        Nem található felhasználó a keresési feltételekkel.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="group hover:bg-white/5 transition-colors">
                                        <td className="pl-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg ${user.role === 'admin'
                                                    ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20 text-orange-500 ring-1 ring-orange-500/50'
                                                    : 'bg-white/10 text-gray-400'
                                                    }`}>
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white group-hover:text-orange-400 transition-colors">{user.username}</div>
                                                    <div className="text-xs text-gray-500">Létrehozva: {new Date(user.createdAt).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-gray-400 py-4">{user.email || <span className="text-gray-600 italic">-</span>}</td>
                                        <td className="py-4">
                                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${user.role === 'admin'
                                                ? 'bg-orange-500/10 text-orange-500'
                                                : 'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                {user.role === 'admin' ? <FiShield className="w-3 h-3" /> : <FiUser className="w-3 h-3" />}
                                                {user.role === 'admin' ? 'Admin' : 'Officer'}
                                            </span>
                                        </td>
                                        <td className="text-center py-4">
                                            {user.active ? (
                                                <span className="inline-flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                                                    <FiCheckCircle /> Aktív
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                                                    <FiXCircle /> Inaktív
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-right pr-6 py-4">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                <button
                                                    onClick={() => handleEditUser(user)}
                                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Szerkesztés"
                                                >
                                                    <FiEdit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteUser(user.id, user.username)}
                                                    className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Törlés"
                                                >
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={
                    <>
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <FiPlus className="w-5 h-5 text-orange-500" />
                        </div>
                        Új felhasználó létrehozása
                    </>
                }
            >
                <div className="p-6 space-y-4">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Felhasználónév</label>
                            <input
                                type="text"
                                value={newUser.username}
                                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-white/5 transition-all"
                                placeholder="Pl. kovacspeter"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Jelszó</label>
                            <div className="relative group">
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-white/5 transition-all text-sm font-mono tracking-widest"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Szerepkör</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setNewUser({ ...newUser, role: 'officer' })}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${newUser.role === 'officer'
                                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                        : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'
                                        }`}
                                >
                                    <FiUser className="w-6 h-6" />
                                    <span className="font-bold text-sm">Officer</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewUser({ ...newUser, role: 'admin' })}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${newUser.role === 'admin'
                                        ? 'bg-orange-500/20 border-orange-500 text-orange-500'
                                        : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'
                                        }`}
                                >
                                    <FiShield className="w-6 h-6" />
                                    <span className="font-bold text-sm">Admin</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-white/5 bg-black/20 flex gap-3">
                    <button
                        onClick={() => setShowCreateModal(false)}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold transition-all"
                    >
                        Mégse
                    </button>
                    <button
                        onClick={handleCreate}
                        className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
                    >
                        <FiPlus className="w-5 h-5" />
                        Felhasználó létrehozása
                    </button>
                </div>
            </Modal>
        </div>
    );
}
