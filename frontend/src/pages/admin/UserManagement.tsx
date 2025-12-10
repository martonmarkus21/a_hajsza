
import { FiUser, FiTrash2, FiEdit, FiPlus, FiCheckCircle, FiXCircle } from 'react-icons/fi';

interface UserManagementProps {
    users: any[];
    newUser: any;
    setNewUser: (user: any) => void;
    createUser: () => void;
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
    return (
        <div className="space-y-6">
            {/* Create User Card */}
            <div className="mw-card">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <FiPlus className="w-6 h-6 text-orange-500" />
                    Új Felhasználó
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Felhasználónév</label>
                        <input
                            type="text"
                            value={newUser.username}
                            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                            className="mw-input"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Jelszó</label>
                        <input
                            type="password"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            className="mw-input"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Szerepkör</label>
                        <select
                            value={newUser.role}
                            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                            className="mw-input appearance-none"
                        >
                            <option value="officer">Officer (Tiszt)</option>
                            <option value="admin">Adminisztrátor</option>
                        </select>
                    </div>
                    <button
                        onClick={createUser}
                        className="w-full px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <FiPlus className="w-5 h-5" />
                        Hozzáadás
                    </button>
                </div>
            </div>

            {/* Users List */}
            <div className="mw-card overflow-hidden p-0">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FiUser className="w-6 h-6 text-orange-500" />
                        Felhasználók
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="mw-table">
                        <thead>
                            <tr>
                                <th className="text-left">Felhasználó</th>
                                <th className="text-left">Email</th>
                                <th className="text-left">Szerepkör</th>
                                <th className="text-center">Státusz</th>
                                <th className="text-right">Műveletek</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td className="font-semibold text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center">
                                                <FiUser />
                                            </div>
                                            {user.username}
                                        </div>
                                    </td>
                                    <td className="text-gray-400">{user.email || '-'}</td>
                                    <td>
                                        <span className={`mw-badge ${user.role === 'admin' ? 'warning' : 'active'}`}>
                                            {user.role === 'admin' ? 'ADMIN' : 'OFFICER'}
                                        </span>
                                    </td>
                                    <td className="text-center">
                                        {user.active ? (
                                            <FiCheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                                        ) : (
                                            <FiXCircle className="w-5 h-5 text-red-500 mx-auto" />
                                        )}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEditUser(user)}
                                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                            >
                                                <FiEdit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deleteUser(user.id, user.username)}
                                                className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
