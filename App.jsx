const { useState, useEffect, useRef } = React;

// --- YARDIMCI FONKSİYONLAR (Şifreleme & Zaman) ---
const SECRET_KEY = "SAMIPDR_PREMIUM_KEY_2026";

const encryptData = (data, key = SECRET_KEY) => {
    try {
        const textToChars = text => text.split('').map(c => c.charCodeAt(0));
        const byteHex = n => ("0" + Number(n).toString(16)).substr(-2);
        const applySaltToChar = code => textToChars(key).reduce((a,b) => a ^ b, code);
        return data.split('').map(textToChars).map(applySaltToChar).map(byteHex).join('');
    } catch (e) {
        console.error("Şifreleme hatası:", e);
        return null;
    }
};

const decryptData = (encoded, key = SECRET_KEY) => {
    try {
        const textToChars = text => text.split('').map(c => c.charCodeAt(0));
        const applySaltToChar = code => textToChars(key).reduce((a,b) => a ^ b, code);
        return encoded.match(/.{1,2}/g).map(hex => parseInt(hex, 16)).map(applySaltToChar).map(charCode => String.fromCharCode(charCode)).join('');
    } catch (e) {
        console.error("Şifre çözme hatası:", e);
        return null;
    }
};

const formatTime = (date) => {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

// --- ANA UYGULAMA BİLEŞENİ ---
function App() {
    // Varsayılan Veri Yapısı
    const defaultData = {
        schoolName: "Okul Adı Giriniz",
        password: null,
        bells: [
            { id: 1, name: "1. Ders", start: "08:30", end: "09:10", type: "lesson" },
            { id: 2, name: "Teneffüs", start: "09:10", end: "09:25", type: "break" },
            { id: 3, name: "2. Ders", start: "09:25", end: "10:05", type: "lesson" }
        ],
        reminders: [],
        notes: [],
        theme: 'light'
    };

    const [data, setData] = useState(() => {
        const saved = localStorage.getItem('samipdr_data');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return defaultData; }
        }
        return defaultData;
    });

    const [isAuthenticated, setIsAuthenticated] = useState(!data.password);
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    
    const [activeTab, setActiveTab] = useState('dashboard');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [nextBellInfo, setNextBellInfo] = useState({ text: "Hesaplanıyor...", minutes: 0, seconds: 0 });
    
    // Mobil menü durumu
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Kopyalama, Sağ Tık ve Kısayol Koruması
    useEffect(() => {
        const handleContextMenu = (e) => e.preventDefault();
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'u', 'p', 's'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
                e.preventDefault();
            }
        };

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        document.body.classList.add('select-none');

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            document.body.classList.remove('select-none');
        };
    }, []);

    // Veri değiştiğinde LocalStorage'a kaydet
    useEffect(() => {
        localStorage.setItem('samipdr_data', JSON.stringify(data));
    }, [data]);

    // Saat ve Zil Geri Sayım Sayacı
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);
            if (data.bells && data.bells.length > 0) {
                calculateNextBell(now, data.bells);
            } else {
                setNextBellInfo({ text: "Zil programı boş", minutes: 0, seconds: 0 });
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [data.bells]);

    const calculateNextBell = (now, bells) => {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const currentSeconds = now.getSeconds();
        
        const sortedBells = [...bells].sort((a, b) => {
            const aMins = parseInt(a.start.split(':')[0]) * 60 + parseInt(a.start.split(':')[1]);
            const bMins = parseInt(b.start.split(':')[0]) * 60 + parseInt(b.start.split(':')[1]);
            return aMins - bMins;
        });

        let found = false;

        for (let i = 0; i < sortedBells.length; i++) {
            const bell = sortedBells[i];
            const startMins = parseInt(bell.start.split(':')[0]) * 60 + parseInt(bell.start.split(':')[1]);
            const endMins = parseInt(bell.end.split(':')[0]) * 60 + parseInt(bell.end.split(':')[1]);

            if (currentMinutes >= startMins && currentMinutes < endMins) {
                const remainingMinutes = endMins - currentMinutes - 1;
                const remainingSeconds = 60 - currentSeconds;
                setNextBellInfo({
                    text: `${bell.name} bitimine:`,
                    minutes: remainingMinutes,
                    seconds: remainingSeconds === 60 ? 0 : remainingSeconds,
                    isBreak: bell.type === 'break'
                });
                found = true; break;
            }
            
            if (currentMinutes < startMins) {
                let diffMins = startMins - currentMinutes - 1;
                let diffSecs = 60 - currentSeconds;
                setNextBellInfo({
                    text: `${bell.name} başlamasına:`,
                    minutes: diffMins,
                    seconds: diffSecs === 60 ? 0 : diffSecs,
                    isBreak: false
                });
                found = true; break;
            }
        }

        if (!found) {
            setNextBellInfo({ text: "Mesai saatleri dışında", minutes: 0, seconds: 0 });
        }
    };

    const updateData = (key, value) => {
        setData(prev => ({ ...prev, [key]: value }));
    };

    // Menü sekmesi değiştirildiğinde mobil menüyü kapat
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setIsMobileMenuOpen(false);
    };

    // --- GİRİŞ EKRANI (ŞİFRE KORUMASI) ---
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 md:p-10 transform transition-all border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                    
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner text-3xl">
                            <i className="fa-solid fa-shield-halved"></i>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">SamiPDR</h1>
                        <p className="text-slate-500 mt-2 text-sm">Uygulamaya erişmek için şifrenizi giriniz.</p>
                    </div>

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (loginPassword === data.password) {
                            setIsAuthenticated(true); setLoginError('');
                        } else {
                            setLoginError('Hatalı şifre. Lütfen tekrar deneyin.');
                        }
                    }} className="space-y-6">
                        <div>
                            <div className="relative">
                                <i className="fa-solid fa-lock absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
                                <input
                                    type="password"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Güvenlik Şifreniz" autoFocus
                                />
                            </div>
                            {loginError && <p className="text-red-500 text-sm mt-2 flex items-center"><i className="fa-solid fa-circle-exclamation mr-1"></i> {loginError}</p>}
                        </div>
                        <button type="submit" className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all">
                            Giriş Yap
                        </button>
                    </form>
                    <div className="mt-10 text-center">
                        <p className="text-xs text-slate-400 font-medium">Geliştirici</p>
                        <p className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-slate-600 to-slate-800">Sami GÜREVİN - Psikolojik Danışman</p>
                    </div>
                </div>
            </div>
        );
    }

    // --- BİLEŞENLER ---

    // 1. ANA EKRAN
    const Dashboard = () => {
        const activeReminders = data.reminders.filter(r => !r.completed);
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                        <i className="fa-solid fa-clock absolute -right-10 -top-10 text-9xl opacity-10"></i>
                        <div className="relative z-10">
                            <h2 className="text-3xl font-bold mb-1">{currentTime.toLocaleTimeString('tr-TR')}</h2>
                            <p className="text-blue-100 text-base md:text-lg mb-6">{currentTime.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            
                            <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 md:p-5 border border-white/20">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-blue-100 text-xs md:text-sm font-medium mb-1 uppercase tracking-wider">{nextBellInfo.text}</p>
                                        <div className="text-3xl md:text-4xl font-black tabular-nums tracking-tight">
                                            {String(nextBellInfo.minutes).padStart(2, '0')}:{String(nextBellInfo.seconds).padStart(2, '0')}
                                        </div>
                                    </div>
                                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-xl md:text-2xl ${nextBellInfo.isBreak ? 'bg-green-400/30 text-green-100' : 'bg-white/20 text-white'}`}>
                                        <i className="fa-solid fa-bell"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-100 shadow-sm flex flex-col justify-center">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mb-3 md:mb-4 text-lg md:text-xl">
                                <i className="fa-solid fa-square-check"></i>
                            </div>
                            <p className="text-slate-500 text-xs md:text-sm font-medium">Bekleyen Görev</p>
                            <p className="text-2xl md:text-3xl font-bold text-slate-800">{activeReminders.length}</p>
                        </div>
                        <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-100 shadow-sm flex flex-col justify-center">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-3 md:mb-4 text-lg md:text-xl">
                                <i className="fa-solid fa-book-open"></i>
                            </div>
                            <p className="text-slate-500 text-xs md:text-sm font-medium">Görüşme Notu</p>
                            <p className="text-2xl md:text-3xl font-bold text-slate-800">{data.notes.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4 md:mb-6">
                        <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center"><i className="fa-solid fa-calendar-days mr-2 text-blue-500"></i> Anımsatıcılar</h3>
                        <button onClick={() => setActiveTab('reminders')} className="text-xs md:text-sm text-blue-600 font-medium hover:underline">Tümünü Gör</button>
                    </div>
                    {activeReminders.length === 0 ? (
                        <p className="text-slate-500 text-center py-6 bg-slate-50 rounded-2xl border border-dashed text-sm">Bekleyen anımsatıcı bulunmuyor. Harika!</p>
                    ) : (
                        <div className="space-y-3">
                            {activeReminders.slice(0, 4).map(rem => (
                                <div key={rem.id} className="flex items-start p-3 hover:bg-slate-50 rounded-xl border border-transparent">
                                    <div className={`w-3 h-3 rounded-full mt-1.5 mr-3 ${rem.priority === 'high' ? 'bg-red-500' : rem.priority === 'medium' ? 'bg-orange-400' : 'bg-blue-400'}`}></div>
                                    <div>
                                        <p className="text-slate-800 font-medium text-sm md:text-base">{rem.title}</p>
                                        {rem.date && <p className="text-xs text-slate-500 flex items-center mt-1"><i className="fa-solid fa-clock mr-1"></i> {rem.date}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // 2. ZİL SAATLERİ
    const BellSchedule = () => {
        const [bells, setBells] = useState(data.bells);
        const [newBell, setNewBell] = useState({ name: '', start: '', end: '', type: 'lesson' });

        const handleSave = () => { updateData('bells', bells); alert("Kaydedildi."); };
        const addBell = () => {
            if (!newBell.name || !newBell.start || !newBell.end) return;
            const updated = [...bells, { ...newBell, id: Date.now() }].sort((a, b) => a.start.localeCompare(b.start));
            setBells(updated); setNewBell({ name: '', start: '', end: '', type: 'lesson' });
        };
        const removeBell = (id) => setBells(bells.filter(b => b.id !== id));

        return (
            <div className="bg-white rounded-3xl p-5 md:p-8 border border-slate-100 shadow-sm animate-fade-in">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Ders Zili Programı</h2>
                        <p className="text-sm text-slate-500">Okulunuzun zil saatlerini özelleştirin.</p>
                    </div>
                    <button onClick={handleSave} className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">
                        <i className="fa-solid fa-floppy-disk mr-2"></i> Kaydet
                    </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 flex flex-col md:flex-row gap-3 md:items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Adı</label>
                        <input type="text" value={newBell.name} onChange={e => setNewBell({...newBell, name: e.target.value})} placeholder="Örn: 1. Ders" className="w-full p-2 rounded-xl border border-slate-200" />
                    </div>
                    <div className="flex gap-3">
                        <div className="w-1/2 md:w-24">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Başlama</label>
                            <input type="time" value={newBell.start} onChange={e => setNewBell({...newBell, start: e.target.value})} className="w-full p-2 rounded-xl border border-slate-200" />
                        </div>
                        <div className="w-1/2 md:w-24">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Bitiş</label>
                            <input type="time" value={newBell.end} onChange={e => setNewBell({...newBell, end: e.target.value})} className="w-full p-2 rounded-xl border border-slate-200" />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-2 md:mt-0">
                        <div className="flex-1 md:w-32">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Tür</label>
                            <select value={newBell.type} onChange={e => setNewBell({...newBell, type: e.target.value})} className="w-full p-2 rounded-xl border border-slate-200 bg-white">
                                <option value="lesson">Ders</option>
                                <option value="break">Teneffüs</option>
                            </select>
                        </div>
                        <button onClick={addBell} className="px-4 py-2 mt-5 md:mt-0 bg-slate-800 text-white rounded-xl flex items-center justify-center">
                            <i className="fa-solid fa-plus mr-1"></i> Ekle
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    {bells.map((bell, index) => (
                        <div key={bell.id} className={`flex items-center justify-between p-3 md:p-4 rounded-2xl border ${bell.type === 'break' ? 'bg-green-50 border-green-100' : 'bg-white border-slate-100'} shadow-sm`}>
                            <div className="flex items-center">
                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center mr-3 font-bold text-sm md:text-lg ${bell.type === 'break' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {index + 1}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm md:text-base">{bell.name}</h4>
                                    <p className="text-xs md:text-sm text-slate-500 flex items-center"><i className="fa-solid fa-clock mr-1 text-[10px]"></i> {bell.start} - {bell.end}</p>
                                </div>
                            </div>
                            <button onClick={() => removeBell(bell.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                <i className="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    ))}
                    {bells.length === 0 && <p className="text-center text-slate-500 py-10 text-sm">Zil programı eklenmemiş.</p>}
                </div>
            </div>
        );
    };

    // 3. ANIMSATICILAR
    const Reminders = () => {
        const [reminders, setReminders] = useState(data.reminders);
        const [newTask, setNewTask] = useState('');
        const [priority, setPriority] = useState('medium');

        const addReminder = (e) => {
            e.preventDefault();
            if (!newTask.trim()) return;
            const updated = [{ id: Date.now(), title: newTask, completed: false, priority, date: new Date().toLocaleDateString('tr-TR') }, ...reminders];
            setReminders(updated); updateData('reminders', updated); setNewTask('');
        };
        const toggleComplete = (id) => {
            const updated = reminders.map(r => r.id === id ? { ...r, completed: !r.completed } : r);
            setReminders(updated); updateData('reminders', updated);
        };
        const deleteReminder = (id) => {
            const updated = reminders.filter(r => r.id !== id);
            setReminders(updated); updateData('reminders', updated);
        };

        return (
            <div className="bg-white rounded-3xl p-5 md:p-8 border border-slate-100 shadow-sm animate-fade-in h-[calc(100vh-140px)] flex flex-col">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-4 md:mb-6">Anımsatıcılar & Görevler</h2>
                
                <form onSubmit={addReminder} className="flex flex-col md:flex-row gap-2 md:gap-3 mb-6">
                    <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Yeni görev yazın..." className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl" />
                    <div className="flex gap-2">
                        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-1/2 md:w-auto p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                            <option value="low">Düşük</option>
                            <option value="medium">Orta</option>
                            <option value="high">Yüksek</option>
                        </select>
                        <button type="submit" className="w-1/2 md:w-auto px-6 bg-blue-600 text-white rounded-xl font-medium">Ekle</button>
                    </div>
                </form>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2 md:space-y-3 custom-scrollbar">
                    {reminders.map(rem => (
                        <div key={rem.id} className={`flex items-center justify-between p-3 md:p-4 rounded-2xl border ${rem.completed ? 'bg-slate-50 opacity-60' : 'bg-white shadow-sm'}`}>
                            <div className="flex items-center flex-1 cursor-pointer" onClick={() => toggleComplete(rem.id)}>
                                <div className={`w-5 h-5 md:w-6 md:h-6 rounded-md border-2 mr-3 flex items-center justify-center ${rem.completed ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'}`}>
                                    {rem.completed && <i className="fa-solid fa-check text-xs"></i>}
                                </div>
                                <div className="flex-1">
                                    <p className={`font-medium text-sm md:text-base ${rem.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>{rem.title}</p>
                                </div>
                                {!rem.completed && <div className={`w-2 h-2 rounded-full mx-3 ${rem.priority === 'high' ? 'bg-red-500' : rem.priority === 'medium' ? 'bg-orange-400' : 'bg-blue-400'}`}></div>}
                            </div>
                            <button onClick={() => deleteReminder(rem.id)} className="p-2 text-slate-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button>
                        </div>
                    ))}
                    {reminders.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <i className="fa-solid fa-square-check text-4xl mb-4 opacity-20"></i>
                            <p className="text-sm">Tüm görevler tamamlandı.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // 4. GÖRÜŞME NOTLARI
    const SessionNotes = () => {
        const [notes, setNotes] = useState(data.notes);
        const [activeNote, setActiveNote] = useState(null);
        const [search, setSearch] = useState('');

        const saveNote = () => {
            if (!activeNote.title.trim()) return;
            let updated = activeNote.id 
                ? notes.map(n => n.id === activeNote.id ? { ...activeNote, date: new Date().toLocaleDateString('tr-TR') } : n)
                : [{ ...activeNote, id: Date.now(), date: new Date().toLocaleDateString('tr-TR') }, ...notes];
            setNotes(updated); updateData('notes', updated); setActiveNote(null);
        };
        const deleteNote = (id) => {
            if(window.confirm('Emin misiniz?')) {
                const updated = notes.filter(n => n.id !== id);
                setNotes(updated); updateData('notes', updated);
                if(activeNote?.id === id) setActiveNote(null);
            }
        };
        const filteredNotes = notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));

        return (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm animate-fade-in h-[calc(100vh-140px)] flex flex-col md:flex-row overflow-hidden">
                
                {/* Liste Alanı */}
                <div className={`w-full md:w-1/3 border-b md:border-r border-slate-100 bg-slate-50/50 flex flex-col ${activeNote !== null ? 'hidden md:flex' : 'flex'} h-full`}>
                    <div className="p-4 md:p-6 border-b border-slate-100">
                        <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-3 flex items-center"><i className="fa-solid fa-book-open mr-2 text-blue-500"></i> Notlar</h2>
                        <div className="relative">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm"></i>
                            <input type="text" placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        <button onClick={() => setActiveNote({ title: '', content: '' })} className="w-full p-3 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl flex flex-col items-center text-sm font-medium mb-4">
                            <i className="fa-solid fa-plus text-xl mb-1"></i> Yeni Not
                        </button>
                        {filteredNotes.map(note => (
                            <div key={note.id} onClick={() => setActiveNote(note)} className={`p-3 md:p-4 rounded-xl cursor-pointer ${activeNote?.id === note.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-800'}`}>
                                <h4 className="font-bold text-sm md:text-base truncate">{note.title || "İsimsiz"}</h4>
                                <div className={`text-[10px] mt-2 font-medium ${activeNote?.id === note.id ? 'text-blue-200' : 'text-slate-400'}`}>{note.date}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Editör Alanı */}
                <div className={`flex-1 bg-white flex-col ${activeNote === null ? 'hidden md:flex' : 'flex'} h-full`}>
                    {activeNote !== null ? (
                        <div className="flex-1 flex flex-col p-4 md:p-8 h-full">
                            <div className="flex justify-between items-center mb-4 md:mb-6 border-b md:border-none pb-3 md:pb-0">
                                <button className="md:hidden mr-3 text-slate-500" onClick={() => setActiveNote(null)}>
                                    <i className="fa-solid fa-arrow-left"></i>
                                </button>
                                <input type="text" value={activeNote.title} onChange={e => setActiveNote({...activeNote, title: e.target.value})} placeholder="Öğrenci Adı / Konu" className="text-lg md:text-2xl font-bold text-slate-800 outline-none w-full bg-transparent" />
                                <div className="flex gap-1 md:gap-2 ml-2">
                                    {activeNote.id && <button onClick={() => deleteNote(activeNote.id)} className="p-2 text-red-500"><i className="fa-solid fa-trash"></i></button>}
                                    <button onClick={saveNote} className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-xl text-sm md:text-base flex items-center">
                                        <i className="fa-solid fa-floppy-disk md:mr-2"></i><span className="hidden md:inline">Kaydet</span>
                                    </button>
                                </div>
                            </div>
                            <textarea value={activeNote.content} onChange={e => setActiveNote({...activeNote, content: e.target.value})} placeholder="Görüşme detayları..." className="flex-1 w-full resize-none outline-none text-slate-700 text-sm md:text-base custom-scrollbar bg-transparent"></textarea>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                            <i className="fa-solid fa-file-lines text-5xl md:text-6xl mb-4 opacity-30"></i>
                            <p className="text-base md:text-lg font-medium text-slate-500">Not seçin veya oluşturun</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // 5. AYARLAR
    const SettingsPanel = () => {
        const [schoolName, setSchoolName] = useState(data.schoolName);
        const [pwd, setPwd] = useState(data.password || '');
        
        const handleSaveSettings = () => {
            updateData('schoolName', schoolName); updateData('password', pwd || null); alert("Güncellendi.");
        };
        const handleExport = () => {
            const encrypted = encryptData(JSON.stringify(data));
            if(!encrypted) return alert("Hata oluştu.");
            const blob = new Blob([encrypted], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `SamiPDR_Yedek_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.pdr`;
            link.href = url; link.click();
        };
        const handleImport = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const decryptedStr = decryptData(event.target.result);
                if (decryptedStr) {
                    try {
                        if(window.confirm("Üzerine yazılacak. Onaylıyor musunuz?")) { setData(JSON.parse(decryptedStr)); alert("Başarılı!"); }
                    } catch (err) { alert("Bozuk dosya."); }
                } else { alert("Şifre çözülemedi."); }
            };
            reader.readAsText(file);
        };

        return (
            <div className="bg-white rounded-3xl p-5 md:p-8 border border-slate-100 shadow-sm animate-fade-in max-w-4xl">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-6">Ayarlar</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-4 md:space-y-6">
                        <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100">
                            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-3"><i className="fa-solid fa-pen mr-2 text-blue-500"></i> Kişiselleştirme</h3>
                            <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm" />
                        </div>
                        <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100">
                            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-2"><i className="fa-solid fa-shield-halved mr-2 text-green-500"></i> Şifre</h3>
                            <p className="text-[11px] md:text-xs text-slate-500 mb-3">İstemiyorsanız boş bırakın.</p>
                            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Yeni şifre" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm" />
                        </div>
                        <button onClick={handleSaveSettings} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold">Kaydet</button>
                    </div>
                    <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100 flex flex-col">
                        <h3 className="text-base md:text-lg font-bold text-slate-800 mb-2"><i className="fa-solid fa-floppy-disk mr-2 text-indigo-500"></i> Yedekleme</h3>
                        <p className="text-[11px] md:text-sm text-slate-500 mb-6 flex-1">Veriler tarayıcıda tutulur. Cihaz değiştirirken yedeği indirip diğer cihazda yükleyin.</p>
                        <div className="space-y-3 mt-auto">
                            <button onClick={handleExport} className="w-full flex items-center justify-center p-3 md:p-4 bg-indigo-600 text-white rounded-xl font-medium text-sm">
                                <i className="fa-solid fa-download mr-2"></i> İndir (.pdr)
                            </button>
                            <div className="relative w-full">
                                <input type="file" accept=".pdr" onChange={handleImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <button className="w-full flex items-center justify-center p-3 md:p-4 bg-white border-2 border-indigo-200 text-indigo-600 rounded-xl font-medium text-sm">
                                    <i className="fa-solid fa-upload mr-2"></i> Yükle (.pdr)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- ANA DİZİLİM ---
    const menuItems = [
        { id: 'dashboard', icon: 'fa-chart-line', label: 'Ana Ekran' },
        { id: 'bells', icon: 'fa-bell', label: 'Zil Saatleri' },
        { id: 'reminders', icon: 'fa-square-check', label: 'Anımsatıcılar' },
        { id: 'notes', icon: 'fa-book-open', label: 'Görüşme Notları' },
        { id: 'settings', icon: 'fa-gear', label: 'Ayarlar' },
    ];

    return (
        <div className="min-h-screen flex text-slate-800">
            {/* Mobil Menü Arkaplan Karartması */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
            )}

            {/* Yan Menü (Sidebar) */}
            <div className={`fixed inset-y-0 left-0 w-64 md:w-72 bg-white border-r border-slate-100 shadow-sm flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
                <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-lg text-white mb-3 text-lg md:text-xl">
                            <i className="fa-solid fa-shield-halved"></i>
                        </div>
                        <h1 className="text-lg md:text-xl font-black text-slate-800 tracking-tight">Sami<span className="text-blue-600">PDR</span></h1>
                        <p className="text-[10px] md:text-xs font-semibold text-slate-500 mt-1 uppercase truncate max-w-[180px]">{data.schoolName}</p>
                    </div>
                    <button className="md:hidden text-slate-400 p-2 text-xl" onClick={() => setIsMobileMenuOpen(false)}>
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <nav className="flex-1 p-3 md:p-4 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => (
                        <button key={item.id} onClick={() => handleTabChange(item.id)} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all font-medium text-sm md:text-base ${activeTab === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                            <i className={`fa-solid ${item.icon} w-6 text-left ${activeTab === item.id ? 'text-blue-600' : 'text-slate-400'}`}></i>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">Geliştirici</p>
                        <p className="text-xs md:text-sm font-bold text-slate-800 truncate">Sami GÜREVİN</p>
                        <p className="text-[10px] md:text-xs text-blue-600 font-medium">Psikolojik Danışman</p>
                    </div>
                    {data.password && (
                        <button onClick={() => setIsAuthenticated(false)} className="mt-3 w-full flex items-center justify-center p-2 text-xs md:text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg font-medium">
                            <i className="fa-solid fa-right-from-bracket mr-2"></i> Kilitle
                        </button>
                    )}
                </div>
            </div>

            {/* Ana İçerik */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <header className="h-16 md:h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center">
                        <button className="md:hidden mr-4 text-slate-600 text-xl" onClick={() => setIsMobileMenuOpen(true)}>
                            <i className="fa-solid fa-bars"></i>
                        </button>
                        <h2 className="text-lg md:text-xl font-bold text-slate-800 capitalize truncate">
                            {menuItems.find(m => m.id === activeTab)?.label}
                        </h2>
                    </div>
                    <div className="flex items-center">
                        <div className="bg-slate-100 px-3 py-1.5 md:px-4 md:py-2 rounded-full flex items-center text-xs md:text-sm font-bold text-slate-700">
                            <i className="fa-solid fa-clock mr-2 text-blue-500"></i> {formatTime(currentTime)}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    <div className="max-w-6xl mx-auto h-full">
                        {activeTab === 'dashboard' && <Dashboard />}
                        {activeTab === 'bells' && <BellSchedule />}
                        {activeTab === 'reminders' && <Reminders />}
                        {activeTab === 'notes' && <SessionNotes />}
                        {activeTab === 'settings' && <SettingsPanel />}
                    </div>
                </main>
            </div>
        </div>
    );
}

// Render İşlemi
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
