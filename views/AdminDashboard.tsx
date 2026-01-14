
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, UserRole, Order, ChatMessage, OrderStatus, DiscountOffer } from '../types';
import { Store } from '../store';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const ITEMS_PER_PAGE = 5;

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user: initialUser, onLogout }) => {
  const [user, setUser] = useState<User>(initialUser);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allDiscounts, setAllDiscounts] = useState<DiscountOffer[]>([]);
  const [selectedUserChat, setSelectedUserChat] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [adminReply, setAdminReply] = useState('');
  const [needsAttention, setNeedsAttention] = useState<string[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const orderDetailRef = useRef<HTMLDivElement>(null);

  // Profile Update State
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdStatus, setPwdStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  useEffect(() => {
    const fetch = () => {
      setUsers(Store.getUsers());
      setOrders(Store.getOrders());
      setAllDiscounts(Store.getDiscounts());
      
      const freshUser = Store.getUsers().find(u => u.id === user.id);
      if (freshUser) setUser(freshUser);

      const allUsers = Store.getUsers().filter(u => u.role === UserRole.CUSTOMER);
      const alerting: string[] = [];
      allUsers.forEach(u => {
        const chats = Store.getChats(u.id);
        const last = chats[chats.length - 1];
        if (last && (last.needsAdmin || last.isTakenOverByAdmin)) {
          alerting.push(u.id);
        }
      });
      
      if (alerting.length > needsAttention.length) {
        try {
          if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        } catch (e) {}
      }
      setNeedsAttention(alerting);
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, [needsAttention.length, user.id]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedUserChat, adminReply]);

  useEffect(() => {
    if (selectedOrder && orderDetailRef.current) {
      orderDetailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedOrder]);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdStatus(null);
    if (pwdForm.current !== user.password) {
      setPwdStatus({ type: 'error', msg: 'Verification failed: incorrect current master key.' });
      return;
    }
    if (pwdForm.next !== pwdForm.confirm) {
      setPwdStatus({ type: 'error', msg: 'Master key mismatch.' });
      return;
    }
    Store.updateUser(user.id, { password: pwdForm.next });
    setPwdStatus({ type: 'success', msg: 'Administrative Master Key Updated Successfully.' });
    setPwdForm({ current: '', next: '', confirm: '' });
  };

  const totalRevenue = orders
    .filter(o => o.status === OrderStatus.DELIVERED)
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  const filteredCompletedOrders = useMemo(() => {
    const completed = orders
      .filter(o => o.status === OrderStatus.DELIVERED)
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());

    return completed.filter(order => 
      order.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
      order.id.toLowerCase().includes(orderSearch.toLowerCase())
    );
  }, [orders, orderSearch]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [orderSearch]);

  const totalPages = Math.ceil(filteredCompletedOrders.length / ITEMS_PER_PAGE);
  const paginatedCompletedOrders = filteredCompletedOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.phone && u.phone.includes(userSearch))
  );

  const handleSelectUserChat = (userId: string) => {
    setSelectedUserChat(userId);
  };

  const handleTakeOver = () => {
    if (!selectedUserChat) return;
    const history = Store.getChats(selectedUserChat);
    const updatedHistory = history.map(m => ({ ...m, isTakenOverByAdmin: true }));
    Store.updateChatHistory(selectedUserChat, updatedHistory);
  };

  const releaseToAI = () => {
    if (!selectedUserChat) return;
    const history = Store.getChats(selectedUserChat);
    const updatedHistory = history.map(m => ({ ...m, isTakenOverByAdmin: false, needsAdmin: false }));
    Store.updateChatHistory(selectedUserChat, updatedHistory);
    alert("Control handed back to AI Support Bot.");
  };

  const sendAdminReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserChat || !adminReply.trim()) return;

    const history = Store.getChats(selectedUserChat);
    if (history.some(m => !m.isTakenOverByAdmin)) {
      const updatedHistory = history.map(m => ({ ...m, isTakenOverByAdmin: true }));
      Store.updateChatHistory(selectedUserChat, updatedHistory);
    }

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      senderId: user.id,
      senderName: 'Admin',
      text: adminReply,
      timestamp: new Date().toISOString(),
      isAI: false,
      needsAdmin: false,
      isTakenOverByAdmin: true
    };

    Store.saveChat(selectedUserChat, newMsg);
    setAdminReply('');
  };

  const giveDiscount = (userId: string) => {
    const amount = 200;
    const discount = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      amount,
      message: "Regular customer reward! Use code FRESH200 for Ksh 200 off.",
      claimed: false
    };
    Store.saveDiscount(discount);
    
    Store.saveChat(userId, {
      id: Date.now().toString(),
      senderId: 'admin',
      senderName: 'Ray',
      text: `🎁 DISCOUNT UNLOCKED: You've been given a special Ksh ${amount} discount for being a regular customer!`,
      timestamp: new Date().toISOString(),
      isAI: false,
      needsAdmin: false
    });
    alert("Discount granted and user notified!");
  };

  const getDiscountStatus = (userId: string) => {
    const userDiscounts = allDiscounts.filter(d => d.userId === userId);
    if (userDiscounts.length === 0) return 'None';
    return userDiscounts.some(d => !d.claimed) ? 'Pending' : 'Claimed';
  };

  const selectedUser = users.find(u => u.id === selectedUserChat);
  const selectedChatHistory = selectedUserChat ? Store.getChats(selectedUserChat) : [];
  const isIntervening = selectedChatHistory.some(m => m.isTakenOverByAdmin);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-blue-500 tracking-tight">Ray's Laundromat</h1>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Operational Hub</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setShowProfile(false)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold border transition-all ${!showProfile ? 'text-blue-400 bg-blue-900/20 border-blue-900/30' : 'text-slate-400 border-transparent hover:bg-slate-800'}`}
          >
             Dashboard
          </button>
          <button 
            onClick={() => setShowProfile(true)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold border transition-all ${showProfile ? 'text-blue-400 bg-blue-900/20 border-blue-900/30' : 'text-slate-400 border-transparent hover:bg-slate-800'}`}
          >
             Security Settings
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors font-medium">
             Sign Out
          </button>
        </nav>
      </aside>

      {/* Main Admin Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {!showProfile ? (
          <>
            <header className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-3xl font-black text-slate-100 tracking-tight">Admin Dashboard</h2>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Real-time business monitoring</p>
              </div>
              <div className="flex items-center gap-6">
                 <div className="bg-slate-900 px-6 py-4 rounded-3xl shadow-xl border border-slate-800 flex flex-col">
                   <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Total Sales</span>
                   <span className="text-2xl font-black text-blue-400 leading-none">Ksh {totalRevenue.toLocaleString()}</span>
                 </div>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                {/* User Directory */}
                <section className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden">
                   <div className="p-8 border-b border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-6">
                     <div>
                       <h3 className="text-xl font-black text-slate-100">User Management</h3>
                       <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Registered Accounts</p>
                     </div>
                     <input 
                      type="text" 
                      placeholder="Search users..."
                      className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-bold text-slate-100 outline-none w-full sm:w-80"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                     />
                   </div>
                   <div className="overflow-x-auto px-2">
                     <table className="w-full text-left">
                       <thead className="bg-slate-800/30 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                         <tr>
                           <th className="px-8 py-5">User</th>
                           <th className="px-8 py-5">Discount Status</th>
                           <th className="px-8 py-5 text-right">Actions</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-800/50">
                         {filteredUsers.map(u => {
                           const status = getDiscountStatus(u.id);
                           return (
                             <tr key={u.id} className="hover:bg-slate-800/40 transition-colors group">
                               <td className="px-8 py-6 font-black text-slate-200">{u.fullName}</td>
                               <td className="px-8 py-6">
                                 <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                   status === 'Pending' ? 'bg-amber-900/20 text-amber-400 border border-amber-800/30' :
                                   status === 'Claimed' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-800/30' :
                                   'bg-slate-800 text-slate-500'
                                 }`}>
                                   {status}
                                 </span>
                               </td>
                               <td className="px-8 py-6 text-right">
                                 {u.role === UserRole.CUSTOMER && (
                                   <button 
                                     onClick={() => giveDiscount(u.id)}
                                     className="text-[10px] font-black text-white bg-blue-600 px-4 py-2.5 rounded-xl hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/30"
                                   >
                                     Grant Reward
                                   </button>
                                 )}
                               </td>
                             </tr>
                           );
                         })}
                       </tbody>
                     </table>
                   </div>
                </section>

                {/* Orders History & Detailed Breakdown */}
                <section className="bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-800 overflow-hidden">
                   <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                     <div>
                       <h3 className="text-xl font-black text-slate-100">Completed Orders History</h3>
                       <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Showing {paginatedCompletedOrders.length} of {filteredCompletedOrders.length} items</p>
                     </div>
                     <input 
                        type="text" 
                        placeholder="Search ID..."
                        className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 outline-none"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                      />
                   </div>
                   <div className="overflow-x-auto px-2">
                     <table className="w-full text-left">
                       <thead className="bg-slate-800/30 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                         <tr>
                           <th className="px-8 py-5">Customer</th>
                           <th className="px-8 py-5">Total</th>
                           <th className="px-8 py-5 text-right">Date</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-800/50">
                         {paginatedCompletedOrders.map(order => (
                           <tr 
                            key={order.id} 
                            className={`hover:bg-blue-900/10 transition-colors cursor-pointer ${selectedOrder?.id === order.id ? 'bg-blue-900/20' : ''}`}
                            onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                           >
                             <td className="px-8 py-6 font-black text-slate-200">{order.customerName}</td>
                             <td className="px-8 py-6 font-black text-blue-400">Ksh {order.totalAmount.toLocaleString()}</td>
                             <td className="px-8 py-6 text-right text-slate-500 text-xs font-bold">
                               {new Date(order.completedAt || order.createdAt).toLocaleDateString()}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                     {/* Pagination Controls */}
                     {totalPages > 1 && (
                       <div className="p-6 border-t border-slate-800 flex justify-center items-center gap-4">
                          <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="p-2 bg-slate-800 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          <div className="flex gap-2">
                             {[...Array(totalPages)].map((_, i) => (
                               <button
                                 key={i}
                                 onClick={() => setCurrentPage(i + 1)}
                                 className={`w-8 h-8 rounded-lg font-black text-xs transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                               >
                                 {i + 1}
                               </button>
                             ))}
                          </div>
                          <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="p-2 bg-slate-800 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                       </div>
                     )}
                   </div>
                </section>

                {/* Expanded Detailed Breakdown */}
                {selectedOrder && (
                  <section ref={orderDetailRef} className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-blue-900/40 overflow-hidden animate-in zoom-in-95 duration-500">
                    <div className="p-8 bg-blue-700 text-white flex justify-between items-center">
                      <div>
                        <h3 className="font-black text-2xl">Invoice Detail: #{selectedOrder.id}</h3>
                        <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mt-1">Customer: {selectedOrder.customerName}</p>
                      </div>
                      <button onClick={() => setSelectedOrder(null)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                    <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div className="md:col-span-2 space-y-4">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Itemized Breakdown</p>
                           <div className="bg-slate-800/50 rounded-[2rem] border border-slate-700/50 overflow-hidden">
                              <table className="w-full text-left">
                                <thead className="bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  <tr>
                                    <th className="px-6 py-4">Service Description</th>
                                    <th className="px-6 py-4 text-center">Qty</th>
                                    <th className="px-6 py-4 text-right">Unit Price</th>
                                    <th className="px-6 py-4 text-right">Line Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/30">
                                  {selectedOrder.items.map(item => (
                                    <tr key={item.id} className="text-sm font-bold text-slate-200">
                                      <td className="px-6 py-5">{item.name}</td>
                                      <td className="px-6 py-5 text-center text-slate-400">{item.quantity}</td>
                                      <td className="px-6 py-5 text-right text-slate-400">Ksh {item.price.toLocaleString()}</td>
                                      <td className="px-6 py-5 text-right text-blue-400">Ksh {(item.price * item.quantity).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                           </div>
                        </div>
                        <div className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 shadow-xl self-start">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Order Summary</p>
                           <div className="space-y-6">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-bold">Subtotal</span>
                                <span className="text-slate-200 font-black">Ksh {selectedOrder.totalAmount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-bold">Tax/Fees</span>
                                <span className="text-slate-200 font-black">Ksh 0</span>
                              </div>
                              <div className="h-px bg-slate-700"></div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Total Settled</span>
                                <span className="text-4xl font-black text-blue-400 tracking-tighter">Ksh {selectedOrder.totalAmount.toLocaleString()}</span>
                              </div>
                           </div>
                        </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Support Columns */}
              <div className="space-y-10">
                {/* Active Threads */}
                <section className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden flex flex-col h-[400px] sticky top-8 z-20">
                  <div className="p-8 border-b border-slate-800 bg-blue-700 text-white">
                     <h3 className="font-black text-lg">Active Support Threads</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/40">
                    {users.filter(u => u.role === UserRole.CUSTOMER).map(u => {
                      const hasAlert = needsAttention.includes(u.id);
                      const chats = Store.getChats(u.id);
                      const lastChat = chats[chats.length - 1];
                      if (!lastChat) return null;
                      return (
                        <div 
                          key={u.id} 
                          onClick={() => handleSelectUserChat(u.id)}
                          className={`p-5 rounded-3xl cursor-pointer transition-all border-2 ${
                            selectedUserChat === u.id ? 'border-blue-600 bg-slate-900 shadow-2xl' : hasAlert ? 'border-red-600 bg-red-900/10' : 'border-transparent bg-slate-900'
                          }`}
                        >
                          <span className="font-black text-sm text-slate-200">{u.fullName}</span>
                          <p className="text-xs text-slate-500 truncate font-medium italic mt-1">"{lastChat.text}"</p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Chat Transcript with 'Take Over' Button */}
                {selectedUserChat && (
                  <section className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden flex flex-col h-[650px] animate-in slide-in-from-top-6 duration-700">
                    <div className="p-8 border-b border-slate-800 bg-slate-800 text-white flex justify-between items-center">
                       <div>
                         <div className="flex items-center gap-2">
                           <h3 className="font-black text-base text-slate-100">Reviewing: {selectedUser?.fullName}</h3>
                           <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isIntervening ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                             {isIntervening ? 'Admin Controlled' : 'AI Active'}
                           </span>
                         </div>
                       </div>
                       <div className="flex items-center gap-2">
                         {!isIntervening ? (
                           <button 
                             onClick={handleTakeOver} 
                             className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest shadow-lg shadow-red-900/40"
                           >
                             Take Over
                           </button>
                         ) : (
                           <button 
                             onClick={releaseToAI} 
                             className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest shadow-lg shadow-emerald-900/40"
                           >
                             Release to AI
                           </button>
                         )}
                         <button onClick={() => setSelectedUserChat(null)} className="p-2 bg-slate-700 rounded-xl">
                           <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg>
                         </button>
                       </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-950/20">
                      {selectedChatHistory.map(m => (
                        <div key={m.id} className={`flex ${m.senderName === 'Admin' || m.senderName === 'Staff Support' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] p-5 rounded-[2rem] text-sm font-bold shadow-xl ${
                            m.senderName === 'Admin' || m.senderName === 'Staff Support' ? 'bg-blue-600 text-white rounded-tr-none' : 
                            m.isAI ? 'bg-purple-700 text-white rounded-tl-none border border-purple-600/30' :
                            'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                          }`}>
                            <p className="leading-relaxed">{m.text}</p>
                            <p className="text-[9px] mt-2 opacity-40 text-right uppercase">{m.senderName}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="p-8 border-t border-slate-800 bg-slate-900">
                      <form onSubmit={sendAdminReply} className="flex gap-3">
                        <input 
                          className="flex-1 bg-slate-800 border-none px-6 py-5 rounded-[1.5rem] text-sm font-bold text-slate-100 outline-none"
                          placeholder={isIntervening ? "Type response to client..." : "Reply to Intervene (AI will be paused)"}
                          value={adminReply}
                          onChange={(e) => setAdminReply(e.target.value)}
                        />
                        <button className="bg-blue-600 text-white p-5 rounded-[1.5rem] transition-all hover:bg-blue-500">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeWidth="3"/></svg>
                        </button>
                      </form>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="max-w-2xl mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-700">
            <header className="mb-10">
              <h2 className="text-4xl font-black text-slate-100 tracking-tight">System Security</h2>
            </header>
            <div className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl border border-slate-800">
               <form onSubmit={handlePasswordChange} className="space-y-6">
                  <input 
                    type="password" required placeholder="Current Key" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-[1.5rem] px-8 py-5 text-sm font-bold text-slate-100"
                    value={pwdForm.current} onChange={e => setPwdForm({...pwdForm, current: e.target.value})}
                  />
                  <input 
                    type="password" required placeholder="New Master Key" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-[1.5rem] px-8 py-5 text-sm font-bold text-slate-100"
                    value={pwdForm.next} onChange={e => setPwdForm({...pwdForm, next: e.target.value})}
                  />
                  <input 
                    type="password" required placeholder="Verify Master Key" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-[1.5rem] px-8 py-5 text-sm font-bold text-slate-100"
                    value={pwdForm.confirm} onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})}
                  />
                  <button type="submit" className="w-full bg-blue-600 text-white font-black py-6 rounded-[1.5rem] uppercase tracking-widest shadow-2xl shadow-blue-900/40">
                    Update Master Key
                  </button>
               </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
