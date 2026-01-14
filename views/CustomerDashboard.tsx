
import React, { useState, useEffect, useRef } from 'react';
import { User, Order, OrderStatus, ChatMessage } from '../types';
import { Store } from '../store';
import { getAIResponse } from '../geminiService';

interface CustomerDashboardProps {
  user: User;
  onLogout: () => void;
}

const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ user: initialUser, onLogout }) => {
  const [user, setUser] = useState<User>(initialUser);
  const [orders, setOrders] = useState<Order[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'order' | 'chat' | 'profile'>('home');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Password Change State
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdStatus, setPwdStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const fetchStatus = () => {
    const myOrders = Store.getOrders().filter(o => o.customerId === user.id);
    setOrders(myOrders);
    setChatMessages(Store.getChats(user.id));
    
    // Refresh user data from store (for password updates sync)
    const freshUser = Store.getUsers().find(u => u.id === user.id);
    if (freshUser) setUser(freshUser);
  };

  useEffect(() => {
    fetchStatus();
    window.addEventListener('rays_store_update', fetchStatus);
    const interval = setInterval(fetchStatus, 3000); 
    return () => {
      window.removeEventListener('rays_store_update', fetchStatus);
      clearInterval(interval);
    };
  }, [user.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      senderId: user.id,
      senderName: user.fullName,
      text: message,
      timestamp: new Date().toISOString(),
      isAI: false,
      needsAdmin: false
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    Store.saveChat(user.id, userMsg);
    setMessage('');

    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg?.isTakenOverByAdmin) return;

    setIsTyping(true);
    const aiRes = await getAIResponse(message, newHistory);
    setIsTyping(false);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      senderId: 'ai',
      senderName: 'Support',
      text: aiRes.text,
      timestamp: new Date().toISOString(),
      isAI: true,
      needsAdmin: aiRes.needsAdmin
    };

    Store.saveChat(user.id, aiMsg);
    setChatMessages(prev => [...prev, aiMsg]);
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
    if (pwdForm.next.length < 6) {
      setPwdStatus({ type: 'error', msg: 'Password must be at least 6 characters.' });
      return;
    }

    Store.updateUser(user.id, { password: pwdForm.next });
    setPwdStatus({ type: 'success', msg: 'Password updated successfully!' });
    setPwdForm({ current: '', next: '', confirm: '' });
  };

  const confirmDelivery = (order: Order) => {
    Store.updateOrder(order.id, { 
      confirmedByCustomer: true, 
      status: OrderStatus.DELIVERED,
      completedAt: new Date().toISOString()
    });
    alert(`Order ${order.id} confirmed! Delivery code ${order.deliveryCode} has been verified.`);
  };

  const placeOrder = (service: string, price: number) => {
    const newOrder: Order = {
      id: 'RD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      customerId: user.id,
      customerName: user.fullName,
      items: [{ id: '1', name: service, price, quantity: 1 }],
      totalAmount: price,
      status: OrderStatus.PENDING,
      createdAt: new Date().toISOString(),
      pickupLocation: { lat: -1.286389, lng: 36.817223, address: 'Current Location' },
      deliveryCode: Math.floor(1000 + Math.random() * 9000).toString()
    };
    Store.saveOrder(newOrder);
    setOrders(prev => [newOrder, ...prev]);
    setActiveTab('home');
  };

  const activeOrder = orders.find(o => o.status !== OrderStatus.DELIVERED);

  // Added logic for chat notifications - messages from staff/admin that might need user attention
  const needsAttention = chatMessages.filter(m => 
    !m.isAI && (m.senderName.includes('Staff') || m.senderName === 'Admin')
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl flex flex-col relative pb-20 overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 p-6 text-white rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">Hello, {user.fullName.split(' ')[0]}!</h2>
            <p className="text-blue-100 text-sm">Laundry made simple.</p>
          </div>
          <button onClick={onLogout} className="p-2 bg-blue-500 rounded-full hover:bg-blue-400 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        {activeTab !== 'profile' && !activeOrder && (
          <button 
            onClick={() => setActiveTab('order')}
            className="w-full bg-white text-blue-600 font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <span className="text-2xl font-black">+</span> START NEW WASH
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
        {activeTab === 'home' && (
          <div className="space-y-6">
            {activeOrder && (
              <div className="bg-white p-5 rounded-3xl shadow-xl border border-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest">Live Status Update</h4>
                    </div>
                    <p className="font-black text-gray-800 text-xl">{activeOrder.status.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    <span className="text-[10px] font-black text-blue-600">OTP: {activeOrder.deliveryCode}</span>
                  </div>
                </div>

                <div className="flex gap-2 h-2.5 mb-6">
                  {Object.values(OrderStatus).map((s, idx) => {
                    const states = Object.values(OrderStatus);
                    const currentIdx = states.indexOf(activeOrder.status);
                    const isCompleted = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    return (
                      <div 
                        key={s} 
                        className={`flex-1 rounded-full transition-all duration-1000 ${
                          isCompleted ? 'bg-blue-600' : 
                          isCurrent ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.6)] animate-pulse' : 
                          'bg-gray-200'
                        }`}
                      />
                    );
                  })}
                </div>

                {(activeOrder.status === OrderStatus.PICKING_UP || activeOrder.status === OrderStatus.DELIVERY) && (
                  <div className="bg-blue-50/50 rounded-2xl p-4 flex items-center gap-4 mb-4 border border-blue-100 animate-in fade-in zoom-in-95">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md relative">
                       <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                       <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/><path d="M3 16a1 1 0 110 2 1 1 0 010-2zm14.122-11.832L16.22 8H6.28l-.31-1.243A1 1 0 005 6H3a1 1 0 100 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 13.846 4.632 16 6.414 16H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 5h-2.878z"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-800">Ray's Rider is Moving</p>
                      <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest bg-white px-2 py-0.5 rounded-full inline-block mt-1">Real-time Delivery Tracking</p>
                    </div>
                  </div>
                )}

                {activeOrder.status === OrderStatus.DELIVERY && (
                  <button 
                    onClick={() => confirmDelivery(activeOrder)}
                    className="w-full bg-blue-600 text-white font-black py-4.5 rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all mt-2 animate-bounce ring-4 ring-blue-50"
                  >
                    COMPLETE & VERIFY HANDOVER
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight">Recent Orders</h3>
              <div className="w-12 h-1 bg-blue-600 rounded-full"></div>
            </div>

            <div className="space-y-4">
              {orders.filter(o => o.status === OrderStatus.DELIVERED).map(order => (
                <div key={order.id} className="bg-white border border-gray-100 p-5 rounded-[2.5rem] shadow-sm flex items-center justify-between transition-all hover:shadow-md">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 shadow-sm border border-green-100">
                      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                    </div>
                    <div>
                      <p className="font-black text-gray-800">{order.items[0].name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{new Date(order.completedAt || order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="font-black text-gray-800 text-lg">Ksh {order.totalAmount}</span>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="text-center py-20 opacity-30 flex flex-col items-center">
                  <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeWidth="2"/></svg>
                  <p className="font-black uppercase tracking-widest text-sm">Ready for your first wash?</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'order' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveTab('home')} className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-90 transition-all">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <h3 className="font-black text-gray-800 text-2xl">Service Menu</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {[
                { name: "Assorted Clothes (Wash/Dry/Fold)", price: 90, desc: "Standard daily wear" },
                { name: "Assorted Clothes (Wash/Iron)", price: 140, desc: "Premium crisp finish" },
                { name: "Duvet Small (White)", price: 650, desc: "Intensive white treatment" },
                { name: "Full Suit (2-Piece)", price: 500, desc: "Professional cleaning" },
                { name: "Wedding Gown", price: 2000, desc: "Special care handling" }
              ].map((svc, i) => (
                <div 
                  key={i}
                  className="p-6 border-2 border-transparent bg-white rounded-[2.5rem] shadow-sm hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer group flex flex-col"
                  onClick={() => placeOrder(svc.name, svc.price)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-black text-gray-800 text-lg leading-tight group-hover:text-blue-600 transition-colors pr-4">{svc.name}</p>
                    <p className="text-blue-600 font-black text-xl whitespace-nowrap">Ksh {svc.price}</p>
                  </div>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{svc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-[580px] border border-gray-100 rounded-[2.5rem] overflow-hidden bg-white shadow-2xl animate-in slide-in-from-right-4">
            <div className="p-6 bg-blue-600 text-white flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z"/></svg>
              </div>
              <div>
                <p className="font-black text-sm uppercase tracking-widest">Ray Support</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse border-2 border-blue-600"></span>
                  <span className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Agent Online</span>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.isAI || msg.senderName.includes('Staff') || msg.senderName === 'Admin' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-bold shadow-sm ${
                    msg.isAI || msg.senderName.includes('Staff') || msg.senderName === 'Admin' ? 'bg-white text-gray-800 rounded-tl-none border border-gray-100' : 'bg-blue-600 text-white rounded-tr-none'
                  }`}>
                    {msg.text}
                    <p className={`text-[8px] mt-1 opacity-50 ${msg.isAI || msg.senderName.includes('Staff') || msg.senderName === 'Admin' ? 'text-left' : 'text-right'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-3xl rounded-tl-none flex gap-2 shadow-sm">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex gap-2">
              <input
                type="text"
                placeholder="Message support..."
                className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button className="p-4 bg-blue-600 text-white rounded-2xl active:scale-95 transition-all shadow-lg shadow-blue-200">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </form>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300 pb-10">
            <h3 className="font-black text-gray-800 text-2xl px-2">Account Settings</h3>
            
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 space-y-4">
               <div className="flex items-center gap-4 border-b border-gray-50 pb-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-2xl font-black">
                    {user.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-gray-800 text-lg leading-none">{user.fullName}</p>
                    <p className="text-sm text-gray-500 mt-1">{user.email}</p>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Phone</p>
                    <p className="font-black text-gray-700 mt-1">{user.phone || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Orders</p>
                    <p className="font-black text-gray-700 mt-1">{orders.length}</p>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-blue-50">
               <div className="flex items-center gap-2 mb-6">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <h4 className="font-black text-gray-800 uppercase tracking-tight">Security & Password</h4>
               </div>

               {pwdStatus && (
                 <div className={`p-4 rounded-2xl mb-6 text-xs font-bold ${pwdStatus.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                   {pwdStatus.msg}
                 </div>
               )}

               <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-1 block">Current Password</label>
                    <input 
                      type="password" 
                      required
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                      value={pwdForm.current}
                      onChange={e => setPwdForm({...pwdForm, current: e.target.value})}
                    />
                  </div>
                  <div className="h-px bg-gray-100 my-2"></div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-1 block">New Password</label>
                    <input 
                      type="password" 
                      required
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                      value={pwdForm.next}
                      onChange={e => setPwdForm({...pwdForm, next: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-1 block">Confirm New Password</label>
                    <input 
                      type="password" 
                      required
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                      value={pwdForm.confirm}
                      onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})}
                    />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white font-black py-4.5 rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all mt-4">
                    UPDATE SECURITY KEY
                  </button>
               </form>
            </div>
            
            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-4 text-red-500 font-black uppercase tracking-widest text-xs hover:bg-red-50 rounded-2xl transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Sign Out Securely
            </button>
          </div>
        )}
      </div>

      {/* Navigation Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-22 bg-white/80 backdrop-blur-lg border-t border-gray-100 flex items-center justify-around px-4 z-20">
        <button onClick={() => setActiveTab('home')} className={`p-3 transition-all flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-300'}`}>
          <svg className={`w-8 h-8 transition-transform ${activeTab === 'home' ? 'scale-110' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
          <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button onClick={() => setActiveTab('order')} className={`p-3 transition-all flex flex-col items-center gap-1 ${activeTab === 'order' ? 'text-blue-600' : 'text-gray-300'}`}>
          <svg className={`w-8 h-8 transition-transform ${activeTab === 'order' ? 'scale-110' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
          <span className="text-[8px] font-black uppercase tracking-widest">Washing</span>
        </button>
        <button onClick={() => setActiveTab('chat')} className={`p-3 transition-all flex flex-col items-center gap-1 ${activeTab === 'chat' ? 'text-blue-600' : 'text-gray-300'}`}>
          <div className="relative">
             <svg className={`w-8 h-8 transition-transform ${activeTab === 'chat' ? 'scale-110' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z"/></svg>
             {needsAttention.length > 0 && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></div>}
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest">Support</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`p-3 transition-all flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-blue-600' : 'text-gray-300'}`}>
          <svg className={`w-8 h-8 transition-transform ${activeTab === 'profile' ? 'scale-110' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
          <span className="text-[8px] font-black uppercase tracking-widest">Profile</span>
        </button>
      </div>
    </div>
  );
};

export default CustomerDashboard;
