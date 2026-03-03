import React, { useState } from 'react';
import { 
  Search, Book, HelpCircle, Keyboard, MessageCircle, 
  Phone, Mail, ChevronDown, ChevronUp, FileText, 
  Video, Zap, ExternalLink, LifeBuoy
} from 'lucide-react';

const HelpCenter: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "How do I reset my password?",
      answer: "Go to the login page and click on 'Forgot Password'. Follow the instructions sent to your email to reset your credentials."
    },
    {
      question: "How can I update stock levels manually?",
      answer: "Navigate to Products > List Products. Locate the item, click 'Actions', and select 'Add Stock' or 'Edit' to adjust the quantity manually. Alternatively, use the Stock Adjustment module for bulk corrections."
    },
    {
      question: "Can I customize the invoice layout?",
      answer: "Yes. Go to Settings > Business Settings. Under the 'Invoice' tab, you can select different schemes (Default, Format A) and upload your business logo."
    },
    {
      question: "Where can I find sales reports?",
      answer: "Reports are located in the sidebar under the 'Reports' section. You can view Profit/Loss, Product Sell Reports, and Trending Products analysis."
    },
    {
      question: "How do I create a customer group?",
      answer: "Navigate to Contacts > Customer Groups. Click 'Create Group', define the group name and link it to a specific Selling Price Group if needed."
    }
  ];

  const shortcuts = [
    { keys: ['Alt', 'S'], description: 'Open POS Screen' },
    { keys: ['Alt', 'A'], description: 'Add New Product' },
    { keys: ['Ctrl', 'P'], description: 'Print Invoice' },
    { keys: ['Esc'], description: 'Close Modal / Clear' },
    { keys: ['F2'], description: 'Focus Search Bar' },
    { keys: ['F11'], description: 'Toggle Full Screen' },
  ];

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
      
      {/* Hero Search Section */}
      <div className="bg-slate-900 rounded-3xl p-12 text-center text-white relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/help/1920/1080?blur=4')] opacity-20 bg-cover bg-center mix-blend-overlay" referrerPolicy="no-referrer"></div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <LifeBuoy size={48} className="mx-auto mb-6 text-blue-400" />
          <h1 className="text-4xl font-bold mb-4 tracking-tight">How can we help you?</h1>
          <p className="text-slate-300 mb-8 text-lg">Search our knowledge base or browse frequently asked questions.</p>
          
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search for answers..." 
              className="w-full pl-12 pr-4 py-4 rounded-xl text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/30 shadow-lg font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left/Main Column: FAQs */}
        <div className="md:col-span-8 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <HelpCircle className="text-blue-600" size={28} />
            <h2 className="text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
                <button 
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-bold text-slate-800 text-base group-hover:text-blue-600 transition-colors">
                    {faq.question}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${openFaqIndex === idx ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                    {openFaqIndex === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>
                {openFaqIndex === idx && (
                  <div className="px-6 pb-6 pt-0 text-slate-600 leading-relaxed animate-in slide-in-from-top-2">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: User Guide */}
        <div className="md:col-span-4">
          <div className="bg-blue-50 rounded-3xl p-8 border border-blue-100 text-center sticky top-8">
            <div className="w-16 h-16 bg-white text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Book size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">User Guide</h3>
            <p className="text-slate-600 mb-8 text-sm leading-relaxed">
              Comprehensive documentation on how to use every feature of the POS system. Learn at your own pace.
            </p>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-600/20">
              Read Documentation <ExternalLink size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HelpCenter;
