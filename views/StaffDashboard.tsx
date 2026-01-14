
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Order, OrderStatus, ChatMessage } from '../types';
import { Store } from '../store';

interface StaffDashboardProps {
  user: User;
  onLogout: () => void;
}

const StaffDashboard: React.FC<StaffDashboardProps> = ({ user: initialUser, onLogout }) => {
  const [user, setUser] = useState<User>(initialUser);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'picking' | 'queue' | 'completed' | 'support' | 'profile'>('pending');
  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(null);
  const [staffReply, setStaffReply] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Profile State
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdStatus, setPwdStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const fetchAll = () => {
    setOrders(Store.getOrders());
    setUsers(Store.getUsers());
    const freshUser = Store.getUsers().find(u => u.id === user.id);
    if (freshUser) setUser(freshUser);
  };

  useEffect(() => {
    fetchAll();
    window.addEventListener('rays_store_update', fetchAll);
    const interval = setInterval(fetchAll, 2000);
    return () => {
      window.removeEventListener('rays_store_update', fetchAll);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedChatUser, staffReply]);

  const advanceStatus = (order: Order) => {
    const statuses = Object.values(OrderStatus);
    const currentIdx = statuses.indexOf(order.status);
    if (currentIdx < statuses.length - 1) {
      const nextStatus = statuses[currentIdx + 1];
      const updates: Partial<Order> = { 
        status: nextStatus, 
        staffId: user.id 
      };
      
      // Send notification to customer when order is accepted
      if (order.status === OrderStatus.PENDING && nextStatus === OrderStatus.PICKING_UP) {
        Store.saveChat(order.customerId, {
          id: Date.now().toString(),
          senderId: user.id,
          senderName: 'Staff Support',
          text: `🚀 Your order #${order.id} has been accepted! Our rider is now heading to your location for pickup.`,
          timestamp: new Date().toISOString(),
          isAI: false,
          needsAdmin: false
        });
      }

      // Notification when washing begins
      if (order.status === OrderStatus.PICKING_UP && nextStatus === OrderStatus.WASHING) {
        Store.saveChat(order.customerId, {
          id: Date.now().toString(),
          senderId: user.id,
          senderName: 'Staff Support',
          text: `🫧 Update: Order #${order.id} has arrived at our facility and the washing process has started!`,
          timestamp: new Date().toISOString(),
          isAI: false,
          needsAdmin: false
        });
      }

      // Notification when out for delivery
      if (order.status === OrderStatus.WASHING && nextStatus === OrderStatus.DELIVERY) {
        Store.saveChat(order.customerId, {
          id: Date.now().toString(),
          senderId: user.id,
          senderName: 'Staff Support',
          text: `🚚 Fresh and Clean! Order #${order.id} is out for delivery. Please have your verification code ${order.deliveryCode} ready.`,
          timestamp: new Date().toISOString(),
          isAI: false,
          needsAdmin: false
        });
      }
      
      if (nextStatus === OrderStatus.DELIVERED) {
        updates.completedAt = new Date().toISOString();
      }
      
      Store.updateOrder(order.id, updates);
    }
  };

  const getStatusButtonText = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return 'Accept Pickup';
      case OrderStatus.PICKING_UP: return 'Moving to Washing';
      case OrderStatus.WASHING: return 'Notify & Move to Delivery';
      case OrderStatus.DELIVERY: return 'Confirm Hand Over';
      case OrderStatus.DELIVERED: return 'Order Completed';
      default: return 'Process Order';
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdStatus(null);
    if (pwdForm.current !== user.password) {
      setPwdStatus({ type: 'error', msg: 'Current password is incorrect.' });
      return;
    }
    if (pwdForm.next !== pwdForm.confirm) {
      setPwdStatus({ type: 'error', msg: 'New passwords do not match.' });
      return;
    }
    Store.updateUser(user.id, { password: pwdForm.next });
    setPwdStatus({ type: 'success', msg: 'Password updated!' });
    setPwdForm({ current: '', next: '', confirm: '' });
  };

  const getDirections = (order: Order) => {
    const addr = encodeURIComponent(order.pickupLocation?.address || "Nairobi");
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, '_blank');
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatUser || !staffReply.trim()) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      senderId: user.id,
      senderName: 'Staff Support',
      text: staffReply,
      timestamp: new Date().toISOString(),
      isAI: false,
      needsAdmin: false,
      isTakenOverByAdmin: true 
    };

    Store.saveChat(selectedChatUser, newMsg);
    const history = Store.getChats(selectedChatUser);
    const updatedHistory = history.map(m => ({ ...m, isTakenOverByAdmin: true }));
    Store.updateChatHistory(selectedChatUser, updatedHistory);
    setStaffReply('');
  };

  const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING);
  const pickingOrders = orders.filter(o => o.status === OrderStatus.PICKING_UP);
  const inProgressOrders = orders.filter(o => 
    o.status === OrderStatus.WASHING || 
    o.status === OrderStatus.DELIVERY
  );

  const customersWithChats = users.filter(u => u.role === UserRole.CUSTOMER).map(u => {
    const chats = Store.getChats(u.id);
    const lastMsg = chats[chats.length - 1];
    return { user: u, lastMsg, needsAttention: lastMsg?.needsAdmin };
  }).filter(item => item.lastMsg);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col p-4 pb-24 relative overflow-hidden">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6 px-1">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Staff Portal</h1>
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest mt-0.5">Verified: {user.fullName}</p>
        </div>
        <button onClick={onLogout} className="p-3 bg-white rounded-2xl shadow-sm text-gray-400 hover:text-red-500 transition-all border border-gray-100 active:scale-90 shadow-blue-50">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex p-1.5 bg-gray-200/50 rounded-2xl mb-6 border border-gray-200 sticky top-0 z-20 backdrop-blur-md overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('pending')} className={`flex-1 min-w-[60px] py-3 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all relative ${activeTab === 'pending' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500'}`}>
          New
          {pendingOrders.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-[7px] border-2 border-white">{pendingOrders.length}</span>}
        </button>
        <button onClick={() => setActiveTab('picking')} className={`flex-1 min-w-[60px] py-3 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all relative ${activeTab === 'picking' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500'}`}>
          Picking
        </button>
        <button onClick={() => setActiveTab('queue')} className={`flex-1 min-w-[60px] py-3 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'queue' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500'}`}>
          Queue
        </button>
        <button onClick={() => setActiveTab('support')} className={`flex-1 min-w-[60px] py-3 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all relative ${activeTab === 'support' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500'}`}>
          Chat
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex-1 min-w-[60px] py-3 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'profile' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500'}`}>
          Profile
        </button>
      </div>

      {/* Content Area */}
      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
        {activeTab === 'pending' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
             <div className="flex justify-between items-center px-2 mb-2">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Incoming Requests</h3>
              <div className="h-0.5 bg-gray-200 flex-1 ml-4 rounded-full"></div>
            </div>
            {pendingOrders.map(order => (
              <div key={order.id} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 group transition-all hover:shadow-lg border-l-4 border-l-blue-600">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-black text-gray-800 text-lg leading-tight">{order.customerName}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">ID: {order.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-blue-600">Ksh {order.totalAmount}</p>
                    <p className="text-[8px] text-gray-300 font-bold uppercase tracking-tighter">{new Date(order.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
                <button onClick={() => advanceStatus(order)} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                  ACCEPT PICKUP
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'picking' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
             {pickingOrders.map(order => (
               <div key={order.id} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 border-l-4 border-l-amber-500">
                 <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="font-black text-gray-800 text-lg">{order.customerName}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">ID: {order.id}</p>
                    </div>
                    <button onClick={() => getDirections(order)} className="p-3 bg-slate-50 rounded-2xl border border-slate-100"><svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="11" r="3" strokeWidth="2.5"/></svg></button>
                 </div>
                 <button onClick={() => advanceStatus(order)} className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl shadow-lg">START WASHING</button>
               </div>
             ))}
           </div>
        )}

        {activeTab === 'queue' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             {inProgressOrders.map(order => (
               <div key={order.id} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black">{order.customerName.charAt(0)}</div>
                      <div>
                        <p className="font-black text-gray-800 text-lg leading-tight">{order.customerName}</p>
                        <span className="text-[10px] text-blue-500 font-black uppercase bg-blue-50 px-2 py-1 rounded-full">{order.status.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => advanceStatus(order)} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl">{getStatusButtonText(order.status)}</button>
               </div>
             ))}
           </div>
        )}

        {activeTab === 'support' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
            {selectedChatUser ? (
              <div className="bg-white rounded-[2.5rem] h-[65vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100">
                <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                   <button onClick={() => setSelectedChatUser(null)}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                   <p className="font-black text-sm uppercase tracking-widest">{users.find(u => u.id === selectedChatUser)?.fullName}</p>
                   <div className="w-6 h-6"></div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                   {Store.getChats(selectedChatUser).map(msg => (
                     <div key={msg.id} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-3xl text-xs font-bold ${msg.senderId === user.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100 shadow-sm'}`}>
                           {msg.text}
                        </div>
                     </div>
                   ))}
                </div>
                <form onSubmit={handleSendReply} className="p-4 bg-white border-t border-gray-100 flex gap-2">
                   <input type="text" placeholder="Type message..." className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs outline-none font-bold" value={staffReply} onChange={(e) => setStaffReply(e.target.value)} />
                   <button className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                </form>
              </div>
            ) : (
              <div className="space-y-3">
                 {customersWithChats.map(item => (
                   <div key={item.user.id} onClick={() => setSelectedChatUser(item.user.id)} className={`p-6 bg-white border rounded-[2.5rem] shadow-sm relative ${item.needsAttention ? 'border-red-200 bg-red-50/20' : 'border-gray-100'}`}>
                      <div className="flex items-center gap-4 mb-3">
                         <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-black">{item.user.fullName.charAt(0)}</div>
                         <div>
                            <p className="font-black text-gray-800 text-sm">{item.user.fullName}</p>
                            <p className="text-[10px] text-gray-400 font-bold">{item.user.phone}</p>
                         </div>
                      </div>
                      <p className="text-xs text-gray-500 italic truncate">"{item.lastMsg?.text}"</p>
                   </div>
                 ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            <h3 className="font-black text-gray-800 text-2xl px-2">Staff Profile</h3>
            
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100">
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-2xl font-black">{user.fullName.charAt(0)}</div>
                  <div>
                    <p className="font-black text-gray-800 text-lg leading-none">{user.fullName}</p>
                    <p className="text-xs text-blue-600 font-black uppercase tracking-widest mt-1">Verified Personnel</p>
                  </div>
               </div>
               <div className="space-y-2">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">Employee ID</p>
                  <p className="font-mono text-xs font-bold text-gray-500 bg-slate-50 p-2 rounded-lg">{user.id}</p>
               </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-blue-50">
               <h4 className="font-black text-gray-800 uppercase tracking-tight mb-6">Security Access Key</h4>
               {pwdStatus && (
                 <div className={`p-4 rounded-2xl mb-6 text-[10px] font-black uppercase ${pwdStatus.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                   {pwdStatus.msg}
                 </div>
               )}
               <form onSubmit={handlePasswordChange} className="space-y-4">
                  <input 
                    type="password" 
                    placeholder="Current Key" 
                    required
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-bold"
                    value={pwdForm.current}
                    onChange={e => setPwdForm({...pwdForm, current: e.target.value})}
                  />
                  <input 
                    type="password" 
                    placeholder="New Secure Key" 
                    required
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-bold"
                    value={pwdForm.next}
                    onChange={e => setPwdForm({...pwdForm, next: e.target.value})}
                  />
                  <input 
                    type="password" 
                    placeholder="Confirm New Key" 
                    required
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-bold"
                    value={pwdForm.confirm}
                    onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})}
                  />
                  <button type="submit" className="w-full bg-blue-600 text-white font-black py-4.5 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95">
                    UPDATE SECURITY ACCESS
                  </button>
               </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
