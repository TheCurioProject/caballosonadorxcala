'use client';

import React, { useState, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';

interface Props {
  initialEmails: string;
}

export default function AdminEmailsEditor({ initialEmails }: Props) {
  // Parse initial emails
  const [emails, setEmails] = useState<string[]>(
    initialEmails
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0)
  );
  
  const [newEmail, setNewEmail] = useState('');
  const [justAdded, setJustAdded] = useState(false);

  const addEmail = () => {
    if (newEmail && !emails.includes(newEmail)) {
      setEmails([...emails, newEmail.trim()]);
      setNewEmail('');
      setJustAdded(true);
    }
  };

  useEffect(() => {
    if (justAdded) {
      const timer = setTimeout(() => setJustAdded(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [justAdded]);

  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(e => e !== emailToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail();
    }
  };

  return (
    <div>
      <label className="block text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
        Admin Notification Emails
      </label>
      
      {/* Hidden input to pass the comma-separated string to the form action */}
      <input 
        type="hidden" 
        name="adminEmails" 
        value={emails.join(',')} 
      />

      <div className="space-y-3">
        {/* Email list */}
        {emails.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {emails.map(email => (
              <div 
                key={email} 
                className="flex items-center gap-1 bg-[#F5F5F5] border border-gray-200 px-3 py-1.5 rounded-full text-sm text-[#23211F] transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
              >
                <span>{email}</span>
                <button 
                  type="button" 
                  onClick={() => removeEmail(email)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Input for new email */}
        <div className="flex gap-2">
          <input 
            type="email" 
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="new.admin@example.com" 
            className="flex-1 border border-gray-200 rounded-xl px-3 py-3 sm:py-2 text-[#23211F] text-base sm:text-sm focus:outline-none focus:border-[#9B7E67] transition-all"
          />
          <button 
            type="button"
            onClick={addEmail}
            disabled={!newEmail && !justAdded}
            className={`px-4 rounded-xl flex items-center justify-center transition-all duration-300 ${
              justAdded 
                ? 'bg-green-600 text-white' 
                : 'bg-[#23211F] hover:bg-[#9B7E67] disabled:opacity-50 disabled:hover:bg-[#23211F] text-white'
            }`}
          >
            {justAdded ? <Check size={18} className="animate-in zoom-in" /> : <Plus size={18} />}
          </button>
        </div>
        <p className="text-xs md:text-[10px] text-gray-400 mt-1">
          These emails receive invoice copies and new booking alerts. Press Enter to add.
        </p>
      </div>
    </div>
  );
}
