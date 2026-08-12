import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../utils/translate';
import { MessageSquare, X, Send, Sparkles, Bot, User as UserIcon, RefreshCw } from 'lucide-react';

export default function Chatbot() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am Sewa Mitra, your GenAI civic assistant. Ask me anything about your reported issues, SLA countdowns, or municipal escalation status!'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend) => {
    const queryText = textToSend || input;
    if (!queryText.trim() || loading) return;

    const userMessage = { sender: 'user', text: queryText };
    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setLoading(true);

    const token = localStorage.getItem('sewa_token');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: queryText })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);
      } else {
        setMessages(prev => [...prev, { sender: 'bot', text: 'I am tracking your issue. Please log in to view detailed status updates.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { sender: 'bot', text: 'Network connection issue. Your grievance is recorded and being processed.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[1000]">
      
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white rounded-full shadow-2xl shadow-orange-950/80 transform hover:scale-105 transition-all border border-orange-400/40 group"
        >
          <div className="relative">
            <Bot size={22} className="group-hover:rotate-12 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <span className="text-xs font-bold font-sans">Sewa Mitra AI</span>
        </button>
      )}

      {/* Chat Window Box */}
      {isOpen && (
        <div className="w-[90vw] max-w-sm h-[480px] glass-panel border border-slate-800 flex flex-col shadow-2xl overflow-hidden animate-fade-in">
          
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white">
                <Sparkles size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-100 font-sans">Sewa Mitra</span>
                <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> GenAI Assistant Active
                </span>
              </div>
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3 font-sans text-xs bg-slate-950/60">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-6 h-6 rounded-full bg-orange-950 border border-orange-800 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={12} />
                  </div>
                )}
                
                <div
                  className={`p-2.5 rounded-2xl max-w-[82%] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-br-none shadow-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                    U
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start items-center">
                <div className="w-6 h-6 rounded-full bg-orange-950 border border-orange-800 text-orange-400 flex items-center justify-center shrink-0">
                  <RefreshCw className="animate-spin" size={12} />
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl rounded-bl-none text-[11px] italic">
                  Sewa Mitra is analyzing status...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="px-3 py-2 bg-slate-900/90 border-t border-slate-800 flex gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleSend("What is the status of my reported issues?")}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-[10px] whitespace-nowrap border border-slate-700 transition-all"
            >
              📊 Check My Reports Status
            </button>
            <button
              onClick={() => handleSend("How does SLA escalation work?")}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-[10px] whitespace-nowrap border border-slate-700 transition-all"
            >
              ⏱️ Explain Escalation SLAs
            </button>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask Sewa Mitra..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:border-orange-500 focus:outline-none text-xs text-slate-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white rounded-xl disabled:opacity-50 transition-all"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
