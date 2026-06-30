import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, Check, Info, AlertTriangle, CheckCircle2, ShieldAlert, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToNotifications, markNotificationAsRead, deleteNotification, clearAllNotifications } from '../lib/firebase';
import { AppNotification, SystemUser } from '../types';

interface NotificationsPopoverProps {
  currentUser: SystemUser;
}

export default function NotificationsPopover({ currentUser }: NotificationsPopoverProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToNotifications((allNotifs) => {
      // Filter notifications relevant to the user
      const relevantNotifs = allNotifs.filter(notif => {
        if (notif.targetRole === "all") return true;
        if (notif.targetUserId === currentUser.id) return true;
        if (notif.targetRole === currentUser.role) return true;
        if (currentUser.role === "admin" || currentUser.role === "super") {
           // Admin sees admin notifications
           if (notif.targetRole === "admin") return true;
        }
        if (currentUser.role === "manager" && notif.targetRole === "admin") return true; // Managers are admins
        if (currentUser.role === "leader" && notif.targetRole === "leader") return true;
        return false;
      });
      setNotifications(relevantNotifs);
    });
    return () => unsub();
  }, [currentUser]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.readBy.includes(currentUser.id)).length;
  }, [notifications, currentUser.id]);

  const isAdmin = currentUser.role === "admin" || currentUser.role === "super" || currentUser.role === "manager";

  const handleMarkAsRead = (id: string) => {
    markNotificationAsRead(id, currentUser.id);
  };

  const markAllAsRead = () => {
    notifications.forEach(n => {
      if (!n.readBy.includes(currentUser.id)) {
        markNotificationAsRead(n.id, currentUser.id);
      }
    });
  };

  const handleClearAll = async () => {
    await clearAllNotifications(notifications.map(n => n.id));
  };

  const handleDeleteNotif = async (id: string) => {
    await deleteNotification(id);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "info": return <Info className="w-5 h-5 text-blue-500" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case "success": return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "alert": return <ShieldAlert className="w-5 h-5 text-rose-500" />;
      default: return <Info className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 sm:p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 text-slate-500 hover:text-we-purple transition-all flex items-center justify-center cursor-pointer shadow-sm relative shrink-0"
        title="الإشعارات"
      >
        <Bell className="w-4.5 h-4.5 sm:w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 sm:left-auto sm:-right-2 w-80 sm:w-96 bg-white rounded-3xl shadow-xl border border-slate-100 z-50 overflow-hidden"
            dir="rtl"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Bell className="w-4 h-4 text-we-purple" />
                الإشعارات
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] sm:text-xs text-we-purple hover:text-we-pink transition-colors font-semibold"
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
                {isAdmin && notifications.length > 0 && (
                  <>
                    {unreadCount > 0 && <span className="text-slate-200 text-xs">|</span>}
                    <button
                      onClick={handleClearAll}
                      className="text-[10px] sm:text-xs text-rose-500 hover:text-rose-700 transition-colors font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      مسح الكل
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium">لا توجد إشعارات حالياً</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((notif) => {
                    const isRead = notif.readBy.includes(currentUser.id);
                    return (
                      <div
                        key={notif.id}
                        className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 relative ${isRead ? 'opacity-70' : 'bg-we-purple/5'}`}
                      >
                        {!isRead && (
                          <div className="absolute top-1/2 -translate-y-1/2 right-2 w-1.5 h-1.5 rounded-full bg-we-pink"></div>
                        )}
                        <div className="shrink-0 mt-0.5">
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-sm ${isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900'} mb-1`}>
                            {notif.title}
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed mb-2">
                            {notif.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(notif.timestamp).toLocaleString("ar-EG")}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {!isRead && (
                                <button
                                  onClick={() => handleMarkAsRead(notif.id)}
                                  className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                                  title="تحديد كمقروء"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteNotif(notif.id)}
                                  className="w-6 h-6 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                                  title="حذف الإشعار"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
