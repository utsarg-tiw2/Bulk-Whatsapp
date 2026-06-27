import React, { useState, useEffect, useRef } from "react";
import LandingPage from "./components/LandingPage";
import { 
  ArrowLeft, 
  MessageSquare, 
  Send, 
  Smartphone, 
  Activity, 
  CheckCheck, 
  AlertCircle,
  HelpCircle,
  LogOut,
  Users,
  Settings,
  ShieldCheck,
  History,
  FileText,
  Plus,
  Play,
  Server,
  Upload,
  Clock,
  Pause,
  Trash2
} from "lucide-react";

export default function App() {
  const [view, setView] = useState("landing"); // "landing" or "dashboard"
  const [activeTab, setActiveTab] = useState("direct"); // "direct" or "bulk"
  
  // Direct Messenger State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Idle"); // Idle, Sending..., Success, Error

  // Bulk Campaigns State
  const [campaignName, setCampaignName] = useState("Marketing Campaign " + new Date().toLocaleDateString());
  const [directNumbersInput, setDirectNumbersInput] = useState("");
  const [bulkContacts, setBulkContacts] = useState([]); // Array of { name, phone }
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignAttachments, setCampaignAttachments] = useState([]); // Files list
  const [campaignDelay, setCampaignDelay] = useState(10); // delay in seconds
  const [campaignRunning, setCampaignRunning] = useState(false);
  const [campaignContacts, setCampaignContacts] = useState([]); // Live state with status: 'pending' | 'sending' | 'success' | 'error'
  const [currentCampaignIndex, setCurrentCampaignIndex] = useState(0);

  // Global State
  const [backendConnected, setBackendConnected] = useState(null); // null (checking), true, false
  const [history, setHistory] = useState([
    { id: 1, name: "Aarav Patel", phone: "+919876543210", status: "Success", time: "10:30 AM" },
    { id: 2, name: "Sneha Sharma", phone: "+918765432109", status: "Success", time: "11:15 AM" }
  ]);

  // Campaign ref for loop pausing/canceling
  const campaignRunningRef = useRef(campaignRunning);
  useEffect(() => {
    campaignRunningRef.current = campaignRunning;
  }, [campaignRunning]);

  // Check backend server status periodically when on the dashboard
  useEffect(() => {
    if (view !== "dashboard") return;

    const checkBackend = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/health");
        if (response.ok) {
          setBackendConnected(true);
        } else {
          setBackendConnected(false);
        }
      } catch (err) {
        setBackendConnected(false);
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, [view]);

  // Direct Message Sending handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatus("Error: Name field cannot be empty!");
      return;
    }
    if (!phone.trim()) {
      setStatus("Error: Phone number cannot be empty!");
      return;
    }
    if (!message.trim()) {
      setStatus("Error: Message body cannot be empty!");
      return;
    }

    setStatus("Sending...");
    
    try {
      const response = await fetch("http://localhost:5000/api/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          message: message,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`Success: Message successfully sent to ${name} (${phone})!`);
        setHistory(prev => [
          {
            id: Date.now(),
            name,
            phone,
            status: "Success",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          ...prev
        ]);
        setName("");
        setPhone("");
        setMessage("");
      } else {
        setStatus(`Error: ${data.message || "Failed to send message"}`);
        setHistory(prev => [
          {
            id: Date.now(),
            name,
            phone,
            status: "Error",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          ...prev
        ]);
      }
    } catch (error) {
      console.error(error);
      setStatus("Error: Backend server is not running or unreachable");
      setHistory(prev => [
        {
          id: Date.now(),
          name,
          phone,
          status: "Error",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev
      ]);
    }
  };

  // Bulk Campaign Numbers Parsing
  const handleDirectNumbersChange = (val) => {
    setDirectNumbersInput(val);
    const parsed = val.split(/[,\n]/)
      .map(n => n.trim())
      .filter(n => n.length > 0)
      .map((num, idx) => {
        // If entry contains a name/number format like Name:Number or Name,Number
        const parts = num.split(/[;:]/);
        if (parts.length >= 2) {
          return { name: parts[0].trim(), phone: parts[1].trim() };
        }
        return { name: `Contact ${idx + 1}`, phone: num };
      });
    setBulkContacts(parsed);
  };

  // CSV/Text File Upload Parsing
  const handleContactsFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      let parsedContacts = [];

      if (lines.length > 0 && lines[0].includes(',')) {
        // CSV Parsing
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
        const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('number') || h.includes('mobile') || h.includes('contact'));
        const nameIndex = headers.findIndex(h => h.includes('name') || h.includes('first') || h.includes('user'));

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/["']/g, ''));
          if (cols.length > 0 && cols.some(c => c.length > 0)) {
            let phone = phoneIndex !== -1 && cols[phoneIndex] ? cols[phoneIndex] : cols[0];
            let name = nameIndex !== -1 && cols[nameIndex] ? cols[nameIndex] : `Contact ${i}`;
            if (phone) {
              parsedContacts.push({ name, phone });
            }
          }
        }
      } else {
        // Simple list (one per line)
        lines.forEach((line, idx) => {
          const parts = line.split(/[,\t|]/);
          if (parts.length >= 2) {
            parsedContacts.push({ name: parts[0].trim(), phone: parts[1].trim() });
          } else {
            parsedContacts.push({ name: `Contact ${idx + 1}`, phone: line.trim() });
          }
        });
      }

      if (parsedContacts.length > 0) {
        setBulkContacts(parsedContacts);
        setDirectNumbersInput(parsedContacts.map(c => `${c.name}:${c.phone}`).join('\n'));
      }
    };
    reader.readAsText(file);
  };

  // Attachment Handler
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setCampaignAttachments(prev => [...prev, ...selectedFiles]);
  };

  const removeAttachment = (index) => {
    setCampaignAttachments(prev => prev.filter((_, idx) => idx !== index));
  };

  // Start Bulk Campaign
  const handleStartCampaign = async () => {
    if (bulkContacts.length === 0) {
      alert("Please add at least one recipient number.");
      return;
    }
    if (!campaignMessage.trim() && campaignAttachments.length === 0) {
      alert("Please enter a campaign message or select at least one attachment file.");
      return;
    }

    // Initialize campaign run state
    const initialContacts = bulkContacts.map(c => ({
      ...c,
      status: "pending",
      errorMsg: ""
    }));
    setCampaignContacts(initialContacts);
    setCampaignRunning(true);
    setCurrentCampaignIndex(0);

    // Call runner
    setTimeout(() => {
      runBulkCampaignLoop(initialContacts);
    }, 500);
  };

  const runBulkCampaignLoop = async (contactsToRun) => {
    let updatedContacts = [...contactsToRun];

    for (let i = 0; i < updatedContacts.length; i++) {
      if (!campaignRunningRef.current) {
        break;
      }

      updatedContacts[i].status = "sending";
      setCampaignContacts([...updatedContacts]);
      setCurrentCampaignIndex(i);

      const contact = updatedContacts[i];
      const personalizedMsg = campaignMessage.replace(/{{Name}}/g, contact.name);

      // Construct Multipart Form Data for attachments support
      const formData = new FormData();
      formData.append("phone", contact.phone);
      formData.append("message", personalizedMsg);
      campaignAttachments.forEach(file => {
        formData.append("attachments", file);
      });

      try {
        const response = await fetch("http://localhost:5000/api/send", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (response.ok) {
          updatedContacts[i].status = "success";
          setHistory(prev => [
            {
              id: Date.now() + i,
              name: contact.name,
              phone: contact.phone,
              status: "Success",
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            },
            ...prev
          ]);
        } else {
          updatedContacts[i].status = "error";
          updatedContacts[i].errorMsg = data.message || "Failed to deliver";
          setHistory(prev => [
            {
              id: Date.now() + i,
              name: contact.name,
              phone: contact.phone,
              status: "Error",
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            },
            ...prev
          ]);
        }
      } catch (err) {
        console.error(err);
        updatedContacts[i].status = "error";
        updatedContacts[i].errorMsg = "Server unreachable";
        setHistory(prev => [
          {
            id: Date.now() + i,
            name: contact.name,
            phone: contact.phone,
            status: "Error",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          ...prev
        ]);
      }

      setCampaignContacts([...updatedContacts]);

      // Delay between messages (if not last message)
      if (i < updatedContacts.length - 1 && campaignRunningRef.current) {
        await new Promise(resolve => setTimeout(resolve, campaignDelay * 1000));
      }
    }

    setCampaignRunning(false);
  };

  const handlePauseCampaign = () => {
    setCampaignRunning(false);
  };

  const populateTemplate = (templateText, isBulk = false) => {
    if (isBulk) {
      setCampaignMessage(templateText);
    } else {
      setMessage(templateText);
    }
  };

  if (view === "landing") {
    return <LandingPage onLaunchApp={() => setView("dashboard")} />;
  }

  // Campaign Metrics Calculator
  const totalContactsCount = campaignContacts.length;
  const sentSuccessCount = campaignContacts.filter(c => c.status === "success").length;
  const sentFailedCount = campaignContacts.filter(c => c.status === "error").length;
  const pendingCount = campaignContacts.filter(c => c.status === "pending").length;
  const sendingCount = campaignContacts.filter(c => c.status === "sending").length;
  const progressPercent = totalContactsCount > 0 ? Math.round(((sentSuccessCount + sentFailedCount) / totalContactsCount) * 100) : 0;

  return (
    <div className="min-h-screen text-slate-900 bg-slate-50 flex flex-col md:flex-row relative overflow-hidden">
      
      {/* Background ambient glowing blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/3 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-500/3 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white/80 backdrop-blur-xl border-b md:border-b-0 md:border-r border-slate-200 p-6 flex flex-col justify-between z-10">
        <div className="space-y-8">
          {/* Logo / Branding */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <MessageSquare className="w-4.5 h-4.5 text-slate-955 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">WhatsBulk</span>
              <span className="text-[9px] block font-mono text-emerald-650 -mt-1 font-semibold">CONSOLE</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            <button 
              onClick={() => { setActiveTab("direct"); setCampaignRunning(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all border ${
                activeTab === "direct" 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm" 
                  : "text-slate-600 hover:bg-slate-100/50 border-transparent"
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Direct Messenger</span>
            </button>
            
            <button 
              onClick={() => setActiveTab("bulk")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all border ${
                activeTab === "bulk" 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm" 
                  : "text-slate-600 hover:bg-slate-100/50 border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4" />
                <span>Bulk Campaigns</span>
              </div>
              <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">Active</span>
            </button>

            <div className="relative group">
              <button disabled className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-450 text-sm cursor-not-allowed hover:bg-slate-100/50 transition-all">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4" />
                  <span>Templates Library</span>
                </div>
                <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">Soon</span>
              </button>
            </div>

            <div className="relative group">
              <button disabled className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-455 text-sm cursor-not-allowed hover:bg-slate-100/50 transition-all">
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </div>
                <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">Soon</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-6 border-t border-slate-200 space-y-3 mt-6">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-slate-200">
            <Server className={`w-3.5 h-3.5 ${backendConnected ? "text-emerald-600" : backendConnected === false ? "text-rose-600" : "text-amber-500"}`} />
            <div className="text-[10px] flex-1">
              <div className="font-semibold text-slate-700">Backend Server</div>
              <div className="text-slate-500 font-mono">
                {backendConnected === true ? "Online (Port 5000)" : backendConnected === false ? "Offline / Disconnected" : "Pinging server..."}
              </div>
            </div>
            <span className={`w-2 h-2 rounded-full ${backendConnected ? "bg-emerald-650 animate-pulse" : backendConnected === false ? "bg-rose-600" : "bg-amber-500"}`}></span>
          </div>

          <button 
            onClick={() => { setView("landing"); setCampaignRunning(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-100/60 text-slate-600 hover:text-slate-900 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Exit Console</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      {activeTab === "direct" ? (
        <main className="flex-1 p-6 md:p-10 overflow-y-auto z-10 max-w-7xl mx-auto w-full space-y-8">
          {/* Main Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Direct Messenger 🚀
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Draft messages, input contact credentials, and trigger WhatsApp delivery instantly.
              </p>
            </div>

            {/* Quick Stats Banner */}
            <div className="flex items-center gap-3 bg-white border border-slate-200 p-2.5 rounded-xl text-xs shadow-sm">
              <div className="text-center px-3 border-r border-slate-200">
                <div className="font-bold text-emerald-600">{history.filter(h => h.status === "Success").length}</div>
                <div className="text-[9px] text-slate-550 font-semibold uppercase">Sent</div>
              </div>
              <div className="text-center px-2">
                <div className="font-bold text-slate-705">{history.length}</div>
                <div className="text-[9px] text-slate-550 font-semibold uppercase">Total Logs</div>
              </div>
            </div>
          </div>

          {/* Direct Messenger Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Panel: Composer Form */}
            <div className="lg:col-span-7 bg-white border border-slate-200 p-6 md:p-8 rounded-2xl space-y-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-805">Broadcast Composer</h2>
                <span className="text-[10px] bg-emerald-50 px-2 py-1 rounded text-emerald-700 border border-emerald-200 font-bold uppercase tracking-wider">Active Profile</span>
              </div>

              <form onSubmit={handleSendMessage} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., Amit Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-650 focus:ring-1 focus:ring-emerald-655 outline-none transition-all text-sm text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., +919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-655 focus:ring-1 focus:ring-emerald-655 outline-none transition-all text-sm font-mono text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-605 uppercase tracking-widest block">Quick Templates</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button 
                      type="button"
                      onClick={() => populateTemplate("Hello! Just a reminder that your appointment is scheduled for tomorrow at 10:00 AM. Thank you!")}
                      className="bg-slate-50 border border-slate-200 hover:border-slate-350 hover:bg-slate-100 text-[11px] text-slate-650 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      📅 Appointment
                    </button>
                    <button 
                      type="button"
                      onClick={() => populateTemplate("Hey there! ⚡ We noticed you left items in your cart. Use checkout code SAVE10 for 10% off.")}
                      className="bg-slate-50 border border-slate-200 hover:border-slate-350 hover:bg-slate-100 text-[11px] text-slate-655 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      🛒 Abandoned Cart
                    </button>
                    <button 
                      type="button"
                      onClick={() => populateTemplate("Hi! Thank you for choosing us. We would love to hear your feedback. Tap here to leave a review: bit.ly/review")}
                      className="bg-slate-50 border border-slate-200 hover:border-slate-350 hover:bg-slate-100 text-[11px] text-slate-655 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      ⭐ Review Request
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Message Text
                  </label>
                  <textarea
                    placeholder="Type your WhatsApp notification body here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full h-36 p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-655 focus:ring-1 focus:ring-emerald-655 outline-none transition-all text-sm text-slate-900 placeholder-slate-400 resize-none leading-relaxed"
                  />
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Status Indicator
                  </label>
                  <div className={`p-3.5 rounded-xl border text-xs font-medium transition-all duration-300 ${
                    status.startsWith("Success") 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : status.startsWith("Error")
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : status === "Sending..."
                      ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                      : "bg-slate-50 text-slate-500 border-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        status.startsWith("Success") ? "bg-emerald-500 animate-pulse" :
                        status.startsWith("Error") ? "bg-rose-600" :
                        status === "Sending..." ? "bg-amber-500 animate-ping" :
                        "bg-slate-400"
                      }`}></span>
                      <span>{status}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === "Sending..."}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold py-3.5 rounded-xl transition-all duration-200 shadow-md shadow-emerald-600/10 mt-2 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  Send WhatsApp Message
                </button>
              </form>
            </div>

            {/* Right Panel: Live Device Preview & History Log */}
            <div className="lg:col-span-5 space-y-8">
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Live Render Preview</span>
                
                <div className="bg-[#efeae2] rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="bg-slate-100 border-b border-slate-250 px-3.5 py-2.5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <div className="text-[10px] font-semibold text-slate-805">{name.trim() || "Recipient Preview"}</div>
                    <span className="text-[8px] text-slate-500 ml-auto font-mono">WhatsApp Render</span>
                  </div>

                  <div className="p-4 min-h-[140px] flex items-end">
                    {message.trim() ? (
                      <div className="bg-[#d9fdd3] text-slate-900 p-2.5 rounded-2xl rounded-tr-none self-end max-w-[90%] shadow-sm">
                        <p className="text-xs leading-relaxed font-semibold whitespace-pre-wrap">{message}</p>
                        <div className="text-[8px] text-slate-500 mt-1 text-right flex items-center justify-end gap-0.5 font-medium">
                          <span>12:00 PM</span>
                          <CheckCheck className="w-3.5 h-3.5 text-sky-500 stroke-[2.5]" />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center w-full text-slate-500 text-xs py-10 font-medium">
                        Start writing your message in the composer to view live preview rendering.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* History Log */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-emerald-600" />
                    Recent Delivery Logs
                  </span>
                  <button 
                    onClick={() => setHistory([])}
                    className="text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Clear Logs
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                  {history.length > 0 ? (
                    history.map((log) => (
                      <div key={log.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800">{log.name}</div>
                          <div className="text-[10px] text-slate-555 font-mono">{log.phone}</div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            log.status === "Success" 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {log.status === "Success" ? <CheckCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {log.status}
                          </span>
                          <div className="text-[8px] text-slate-550 mt-1 font-medium">{log.time}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-500 font-medium">
                      No broadcast logs available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* Bulk Campaign Workspace Tab */
        <main className="flex-1 p-6 md:p-10 overflow-y-auto z-10 max-w-7xl mx-auto w-full space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Bulk Campaign Manager 📣
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Upload contact files, write templates with personalization variables, attach folder/files, and broadcast safely.
              </p>
            </div>

            {/* Campaign Name Settings */}
            <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-sm max-w-xs w-full">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Campaign Identifier</span>
              <input 
                type="text" 
                value={campaignName} 
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 p-1.5 rounded outline-none focus:border-emerald-600 text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Side: Setup & Configuration */}
            <div className="lg:col-span-7 bg-white border border-slate-200 p-6 md:p-8 rounded-2xl space-y-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-850">Campaign Configuration</h2>

              {/* Step 1: Bulk Numbers Input */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Recipient Numbers List
                  </label>
                  <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    {bulkContacts.length} Contacts Parsed
                  </span>
                </div>

                {/* Direct text area input */}
                <textarea
                  placeholder="Paste numbers here, separated by commas or newlines. Format: Name:Number or just Number&#10;E.g., Amit:+919876543210&#10;Sneha:+918765432109"
                  value={directNumbersInput}
                  onChange={(e) => handleDirectNumbersChange(e.target.value)}
                  className="w-full h-28 p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-655 focus:ring-1 focus:ring-emerald-655 outline-none transition-all text-xs font-mono text-slate-900 placeholder-slate-400 resize-none leading-relaxed"
                />

                {/* CSV File Drag & Drop Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col justify-center items-center text-center relative hover:border-emerald-500 transition-colors">
                    <Upload className="w-5 h-5 text-slate-450 mb-1" />
                    <span className="text-xs font-semibold text-slate-700">Import CSV / TXT List</span>
                    <input 
                      type="file" 
                      accept=".csv,.txt"
                      onChange={handleContactsFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>

                  <div className="text-[10px] text-slate-500 flex flex-col justify-center space-y-1">
                    <p className="font-semibold text-slate-600">💡 Tip: Format your CSV columns as:</p>
                    <code className="bg-slate-100 p-1 rounded block text-[9px] font-mono">"Name, Phone"</code>
                    <p>Dynamic variable <code className="text-emerald-700 font-mono">{"{{Name}}"}</code> parses name column automatically.</p>
                  </div>
                </div>
              </div>

              {/* Step 2: Message Composer */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Campaign Message Template
                  </label>
                </div>

                <textarea
                  placeholder="Type message. Use {{Name}} to customize for each user automatically..."
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  className="w-full h-32 p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-655 focus:ring-1 focus:ring-emerald-655 outline-none transition-all text-sm text-slate-900 placeholder-slate-400 resize-none leading-relaxed"
                />

                {/* Bulk Templates Populator */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block">Quick Templates</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button 
                      onClick={() => populateTemplate("Hello {{Name}}! 🌟 Your customized bill for this month is ready. Please view and clear: bit.ly/bills", true)}
                      className="bg-slate-50 border border-slate-200 hover:border-slate-350 hover:bg-slate-100 text-[11px] text-slate-650 px-2 py-1 rounded-lg"
                    >
                      💳 Payment Link
                    </button>
                    <button 
                      onClick={() => populateTemplate("Hi {{Name}}, 📦 order #9284 has been successfully dispatched and will reach you by tomorrow. Track: bit.ly/status", true)}
                      className="bg-slate-50 border border-slate-200 hover:border-slate-350 hover:bg-slate-100 text-[11px] text-slate-650 px-2 py-1 rounded-lg"
                    >
                      🚚 Shipping Track
                    </button>
                    <button 
                      onClick={() => populateTemplate("Hey {{Name}}! ⚡ Thank you for shopping. Here is your coupon code: DISCOUNT20 for your next purchase!", true)}
                      className="bg-slate-50 border border-slate-200 hover:border-slate-350 hover:bg-slate-100 text-[11px] text-slate-650 px-2 py-1 rounded-lg"
                    >
                      🎟️ Promo Code
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Attachments / Files Folder option */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Attachment Folder / Media Files
                </label>

                <div className="relative">
                  <input 
                    type="file" 
                    multiple 
                    id="bulk-attachments"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="border-2 border-dashed border-slate-200 hover:border-emerald-600 rounded-xl p-5 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                    <span className="text-xs font-bold text-slate-700">Attach Media Files / Documents</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Images, PDFs, media sheets (Will upload and attach dynamically)</span>
                  </div>
                </div>

                {/* Attachments List */}
                {campaignAttachments.length > 0 && (
                  <div className="space-y-1.5 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 max-h-36 overflow-y-auto">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Attached Files ({campaignAttachments.length}):</span>
                    {campaignAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-1.5 bg-white border border-slate-150 rounded-lg text-[11px]">
                        <div className="flex items-center gap-1.5 truncate max-w-[80%]">
                          <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-slate-800 truncate">{file.name}</span>
                          <span className="text-slate-550 text-[9px]">({(file.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <button 
                          onClick={() => removeAttachment(idx)}
                          className="text-rose-600 hover:text-rose-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 4: Delays Settings (Anti-Ban Safeguards) */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-650" />
                  Anti-Ban Delay Configuration
                </h4>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="text-[10px] text-slate-600 max-w-sm">
                    Staggered delay introduces pause intervals between messages. Organic typing delay mimics natural chat behavior to protect your WhatsApp account.
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <input 
                      type="number" 
                      min="5"
                      max="120"
                      value={campaignDelay}
                      onChange={(e) => setCampaignDelay(Number(e.target.value))}
                      className="w-16 p-1.5 text-xs text-center border border-slate-200 rounded-lg focus:border-emerald-600 bg-white font-semibold text-slate-850 outline-none"
                    />
                    <span className="text-xs text-slate-500 font-medium">sec delay</span>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleStartCampaign}
                  disabled={campaignRunning}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold py-3.5 rounded-xl transition-all duration-200 shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 stroke-[2.5]" />
                  Launch Bulk Campaign
                </button>
              </div>
            </div>

            {/* Right Side: Live Progress Monitor Console */}
            <div className="lg:col-span-5 space-y-8">
              
              {/* Campaign Status Card */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Campaign Progress Console</h3>

                {/* Progress bar container */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>Delivery Status</span>
                    <span>{progressPercent}% Complete</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                    <div className="text-xl font-extrabold text-slate-800">{totalContactsCount}</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Total Targets</div>
                  </div>
                  <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-center">
                    <div className="text-xl font-extrabold text-emerald-700">{sentSuccessCount}</div>
                    <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Successful</div>
                  </div>
                  <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-center">
                    <div className="text-xl font-extrabold text-rose-700">{sentFailedCount}</div>
                    <div className="text-[9px] text-rose-600 font-bold uppercase tracking-wider">Failed</div>
                  </div>
                  <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 text-center">
                    <div className="text-xl font-extrabold text-amber-700">{pendingCount}</div>
                    <div className="text-[9px] text-amber-600 font-bold uppercase tracking-wider">Pending</div>
                  </div>
                </div>

                {/* Live Action Buttons */}
                {campaignRunning && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between gap-3 animate-pulse">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                      <span className="text-xs text-amber-800 font-semibold">
                        Sending target {currentCampaignIndex + 1} of {totalContactsCount}...
                      </span>
                    </div>
                    <button 
                      onClick={handlePauseCampaign}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold shadow-sm"
                    >
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </button>
                  </div>
                )}
              </div>

              {/* Contacts Live Delivery Logs Status */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Live Broadcast Queue</span>

                <div className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin">
                  {campaignContacts.length > 0 ? (
                    campaignContacts.map((contact, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl border bg-slate-50 border-slate-200 text-xs transition-all">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {contact.name}
                            {idx === currentCampaignIndex && campaignRunning && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{contact.phone}</div>
                        </div>

                        <div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            contact.status === "success" 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                              : contact.status === "error"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : contact.status === "sending"
                              ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}>
                            {contact.status === "success" ? <CheckCheck className="w-3.5 h-3.5" /> : 
                             contact.status === "error" ? <AlertCircle className="w-3.5 h-3.5" /> :
                             contact.status === "sending" ? <Activity className="w-3.5 h-3.5" /> : 
                             null}
                            {contact.status}
                          </span>
                          {contact.status === "error" && contact.errorMsg && (
                            <span className="block text-[8px] text-rose-500 mt-0.5 text-right font-medium">{contact.errorMsg}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400 font-medium">
                      Setup contacts list on the left to activate queue monitor.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        </main>
      )}

    </div>
  );
}