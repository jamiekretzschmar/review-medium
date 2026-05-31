
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { CameraCapture } from './components/CameraCapture';
import { AppState, InputMode, HistoryItem } from './types';
import { identifyItem, generateHumanReview, compareProducts } from './geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isAnalyzing: false,
    isGeneratingReview: false,
    isComparing: false,
    analysis: null,
    review: null,
    error: null,
    imagePreview: null,
    styleMirror: {},
    comparisonList: [],
    comparisonResult: null,
    history: [],
  });

  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      // Small simulated delay to show the skeleton loader smoothly
      await new Promise(resolve => setTimeout(resolve, 800));
      const savedHistory = localStorage.getItem('critique_history');
      if (savedHistory) {
        try {
          setState(prev => ({ ...prev, history: JSON.parse(savedHistory) }));
        } catch (e) {
          console.error('Failed to load history', e);
        }
      }
      setIsLoadingHistory(false);
    };
    loadHistory();
  }, []);

  useEffect(() => {
    localStorage.setItem('critique_history', JSON.stringify(state.history));
  }, [state.history]);

  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [userThoughts, setUserThoughts] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setState(prev => ({ ...prev, imagePreview: base64 }));
        processIdentification({ image: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const processIdentification = async (input: { image?: string; link?: string }) => {
    setState(prev => ({ ...prev, isAnalyzing: true, error: null, analysis: null, review: null }));
    try {
      const result = await identifyItem(input);
      setState(prev => ({ ...prev, analysis: result, isAnalyzing: false }));
    } catch (err: any) {
      console.error("Identification error:", err);
      let errorMessage = "I couldn't quite identify that. Could you try a different angle or a clearer photo?";
      
      if (err.message?.toLowerCase().includes('fetch') || err.name === 'TypeError') {
        errorMessage = "Network error: Please check your internet connection and try again.";
      } else if (err.status === 429 || err.message?.toLowerCase().includes('quota')) {
        errorMessage = "API Quota exceeded. Please try again later.";
      } else if (err.status >= 500) {
        errorMessage = "The AI service is currently experiencing issues. Please try again in a few moments.";
      } else if (input.link) {
        errorMessage = "I couldn't reach or process that product link. Please double-check the URL and try again.";
      }
      
      setState(prev => ({ ...prev, isAnalyzing: false, error: errorMessage }));
    }
  };

  const processReview = async () => {
    if (!state.analysis) return;
    setState(prev => ({ ...prev, isGeneratingReview: true, error: null }));
    try {
      const result = await generateHumanReview(state.analysis, userThoughts, state.styleMirror);
      const historyItem: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        analysis: state.analysis,
        review: result,
        imagePreview: state.imagePreview
      };
      setState(prev => ({ 
        ...prev, 
        review: result, 
        isGeneratingReview: false,
        history: [historyItem, ...prev.history].slice(0, 50)
      }));
    } catch (err: any) {
      console.error("Review error:", err);
      let errorMessage = "Something went wrong while drafting your review. This can happen if the style sample is too complex or the connection is unstable. Let's try once more.";
      
      if (err.message?.toLowerCase().includes('fetch') || err.name === 'TypeError') {
        errorMessage = "Network error: Please check your internet connection and try again.";
      } else if (err.status === 429 || err.message?.toLowerCase().includes('quota')) {
        errorMessage = "API Quota exceeded. Please try again later.";
      } else if (err.status >= 500) {
        errorMessage = "The AI service is currently experiencing issues. Please try again in a few moments.";
      }
      
      setState(prev => ({ ...prev, isGeneratingReview: false, error: errorMessage }));
    }
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setState(prev => ({
      ...prev,
      history: prev.history.filter(item => item.id !== id)
    }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // We could add a toast here if we had one
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const downloadReview = (review: any, name: string) => {
    const content = `Product: ${name}\nRating: ${review.rating}/5\nSentiment: ${review.sentiment}\n\nReview:\n${review.reviewText}\n\nPros:\n${review.pros.join('\n')}\n\nCons:\n${review.cons.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}_review.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addToComparison = () => {
    if (!state.analysis) return;
    const newItem: any = {
      analysis: state.analysis,
      review: state.review,
      imagePreview: state.imagePreview
    };
    setState(prev => ({
      ...prev,
      comparisonList: [...prev.comparisonList, newItem],
      analysis: null,
      review: null,
      imagePreview: null,
      styleMirror: {}
    }));
    setUserThoughts('');
  };

  const runComparison = async () => {
    if (state.comparisonList.length < 2) {
      setState(prev => ({ ...prev, error: "Please add at least two products to compare." }));
      return;
    }
    setState(prev => ({ ...prev, isComparing: true, error: null }));
    try {
      const result = await compareProducts(state.comparisonList);
      setState(prev => ({ ...prev, comparisonResult: result, isComparing: false }));
    } catch (err: any) {
      console.error("Comparison error:", err);
      let errorMessage = "An unexpected error occurred during comparison. Please click 'Compare Products' to try again.";
      
      if (err.message?.toLowerCase().includes('fetch') || err.name === 'TypeError') {
        errorMessage = "Network error: It seems you're offline or the connection dropped. Please check your internet connection and try clicking 'Compare Products' again.";
      } else if (err.status === 429 || err.message?.toLowerCase().includes('quota')) {
        errorMessage = "API Quota exceeded: The AI service has reached its request limit. Please wait a few minutes and try clicking 'Compare Products' again.";
      } else if (err.status >= 500) {
        errorMessage = "Service error: The AI server is currently experiencing issues. Please try clicking 'Compare Products' again in a few moments.";
      }
      
      setState(prev => ({ ...prev, isComparing: false, error: errorMessage }));
    }
  };

  const reset = () => {
    setState(prev => ({
      ...prev,
      isAnalyzing: false,
      isGeneratingReview: false,
      isComparing: false,
      analysis: null,
      review: null,
      error: null,
      imagePreview: null,
      styleMirror: {},
      comparisonList: [],
      comparisonResult: null,
    }));
    setInputMode(null);
    setLinkInput('');
    setUserThoughts('');
  };

  return (
    <Layout>
      {state.comparisonList.length > 0 && !state.comparisonResult && (
        <div className="mb-12 glass p-6 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4 overflow-x-auto pb-2 max-w-full">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">Comparison Queue:</h3>
              {state.comparisonList.map((item, i) => (
                <div key={i} className="flex-shrink-0 relative group">
                  {item.imagePreview ? (
                    <img src={item.imagePreview} className="w-12 h-12 rounded-xl object-cover border border-white/10" alt={item.analysis.name} />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-[10px] text-center p-1 leading-tight">
                      {item.analysis.name}
                    </div>
                  )}
                  <button 
                    onClick={() => setState(prev => ({ ...prev, comparisonList: prev.comparisonList.filter((_, idx) => idx !== i) }))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button 
              onClick={runComparison}
              disabled={state.comparisonList.length < 2 || state.isComparing}
              className="accent-gradient px-8 py-3 rounded-full font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {state.isComparing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
              Compare Products
            </button>
          </div>
        </div>
      )}

      {state.comparisonResult && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold mb-4 italic">Side-by-Side Comparison</h2>
            <p className="text-zinc-400 text-lg">{state.comparisonResult.summary}</p>
          </div>

          <div className="glass rounded-[40px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-6 text-zinc-500 uppercase tracking-widest text-xs font-bold">Feature</th>
                    {state.comparisonList.map((item, i) => (
                      <th key={i} className="p-6 font-bold text-lg min-w-[200px]">
                        <div className="flex items-center gap-3">
                          {item.imagePreview && <img src={item.imagePreview} className="w-10 h-10 rounded-lg object-cover" alt="" />}
                          {item.analysis.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.comparisonResult.featureComparison.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="p-6 font-semibold text-indigo-400">{row.feature}</td>
                      {state.comparisonList.map((item, j) => (
                        <td key={j} className="p-6 text-zinc-300">
                          {row.values[item.analysis.name] || row.values[Object.keys(row.values)[j]] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-white/[0.02]">
                    <td className="p-6 font-bold text-white uppercase tracking-widest text-xs">Sentiment Score</td>
                    {state.comparisonList.map((item, i) => {
                      const sentiment = state.comparisonResult!.sentimentComparison.find(s => s.productName === item.analysis.name);
                      return (
                        <td key={i} className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="flex-grow h-2 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${sentiment?.sentiment === 'positive' ? 'bg-emerald-500' : sentiment?.sentiment === 'negative' ? 'bg-red-500' : 'bg-zinc-500'}`}
                                style={{ width: `${sentiment?.score || 0}%` }}
                              ></div>
                            </div>
                            <span className="font-bold text-sm">{sentiment?.score || 0}%</span>
                          </div>
                          <div className="text-[10px] uppercase tracking-tighter text-zinc-500 mt-1">{sentiment?.sentiment}</div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button 
              onClick={() => setState(prev => ({ ...prev, comparisonResult: null }))}
              className="px-8 py-3 glass rounded-full font-bold hover:bg-white/10 transition-colors"
            >
              Back to Reviews
            </button>
            <button 
              onClick={reset}
              className="px-8 py-3 bg-white text-black rounded-full font-bold hover:bg-zinc-200 transition-colors"
            >
              Start Completely Over
            </button>
          </div>
        </div>
      )}

      {!state.comparisonResult && (
        <>
          {!inputMode && !state.analysis && !state.review && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <button 
            onClick={() => setInputMode('camera')}
            className="glass p-8 rounded-3xl flex flex-col items-center gap-4 hover:bg-white/5 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="font-semibold text-lg">Camera</span>
            <span className="text-zinc-500 text-sm text-center">Snap a photo of the item</span>
          </button>

          <label className="glass p-8 rounded-3xl flex flex-col items-center gap-4 hover:bg-white/5 transition-colors group cursor-pointer">
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-semibold text-lg">Upload</span>
            <span className="text-zinc-500 text-sm text-center">Select an existing photo</span>
          </label>

          <button 
            onClick={() => setInputMode('link')}
            className="glass p-8 rounded-3xl flex flex-col items-center gap-4 hover:bg-white/5 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 9.242m-4.242 4.242l1.372-1.372" />
              </svg>
            </div>
            <span className="font-semibold text-lg">Link</span>
            <span className="text-zinc-500 text-sm text-center">Paste a product URL</span>
          </button>
        </div>
      )}

      {inputMode === 'camera' && !state.analysis && (
        <CameraCapture 
          onCapture={(base64) => {
            setState(prev => ({ ...prev, imagePreview: base64 }));
            processIdentification({ image: base64 });
            setInputMode(null);
          }} 
          onCancel={() => setInputMode(null)} 
        />
      )}

      {inputMode === 'link' && !state.analysis && (
        <div className="glass p-8 rounded-3xl max-w-lg mx-auto w-full">
          <h2 className="text-xl font-bold mb-4">Product Link</h2>
          <input 
            type="text" 
            placeholder="https://example.com/item"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:border-indigo-500"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
          />
          <div className="flex gap-4">
            <button 
              onClick={() => processIdentification({ link: linkInput })}
              disabled={!linkInput}
              className="flex-grow accent-gradient py-3 rounded-xl font-bold disabled:opacity-50"
            >
              Identify
            </button>
            <button onClick={() => setInputMode(null)} className="px-6 py-3 border border-white/10 rounded-xl hover:bg-white/5">Cancel</button>
          </div>
        </div>
      )}

      {state.isAnalyzing && (
        <div className="max-w-2xl mx-auto glass p-8 md:p-12 rounded-[40px] animate-pulse">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            <div className="w-32 h-32 rounded-2xl bg-white/10 flex-shrink-0 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
            <div className="space-y-4 w-full">
              <div className="h-4 bg-white/10 rounded w-1/4"></div>
              <div className="h-8 bg-white/10 rounded w-3/4"></div>
              <div className="h-4 bg-white/10 rounded w-full"></div>
              <div className="h-4 bg-white/10 rounded w-5/6"></div>
              <div className="flex gap-2 mt-4">
                <div className="h-6 bg-white/10 rounded-full w-20"></div>
                <div className="h-6 bg-white/10 rounded-full w-24"></div>
                <div className="h-6 bg-white/10 rounded-full w-16"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {state.error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-8 flex justify-between items-center">
          <span>{state.error}</span>
          <button onClick={reset} className="underline text-sm">Start over</button>
        </div>
      )}

      {state.analysis && !state.review && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start animate-in fade-in zoom-in-95 duration-500">
          <div className="space-y-6">
            {state.imagePreview ? (
              <img src={state.imagePreview} className="w-full aspect-square object-cover rounded-3xl border border-white/10" alt="Item preview" />
            ) : (
              <div className="w-full aspect-square glass rounded-3xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-white/5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 9.242m-4.242 4.242l1.372-1.372" />
                </svg>
              </div>
            )}
            <div className="glass p-6 rounded-3xl">
              <h3 className="text-sm uppercase tracking-widest text-indigo-400 font-bold mb-4">Item Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-500">Name</span>
                  <span className="font-semibold text-right">{state.analysis.name}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-500">Category</span>
                  <span className="font-semibold">{state.analysis.category}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold mb-4">{state.analysis.name}</h2>
              <p className="text-zinc-400 text-lg leading-relaxed">{state.analysis.description}</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {state.analysis.keyFeatures.map((f, i) => (
                <span key={i} className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-zinc-300">
                  {f}
                </span>
              ))}
            </div>

            <div className="pt-8 border-t border-white/5">
              <h3 className="text-lg font-bold mb-4">How was your experience?</h3>
              <textarea 
                placeholder="Share your raw thoughts. What worked for you? What didn't? I'll help you shape this into a beautiful, truthful review."
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 min-h-[150px] focus:outline-none focus:border-indigo-500 mb-6"
                value={userThoughts}
                onChange={(e) => setUserThoughts(e.target.value)}
              />

              <div className="mb-8 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.172-1.172a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 115.656-5.656l1.172 1.172z" />
                  </svg>
                  <h3 className="text-lg font-bold">Mirror Style (Optional)</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Reviewer Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Rainbow Reflections"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
                        value={state.styleMirror.reviewerName || ''}
                        onChange={(e) => setState(prev => ({ ...prev, styleMirror: { ...prev.styleMirror, reviewerName: e.target.value } }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Reviewer URL</label>
                      <input 
                        type="text" 
                        placeholder="e.g. rainbowreflections.org"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
                        value={state.styleMirror.reviewerUrl || ''}
                        onChange={(e) => setState(prev => ({ ...prev, styleMirror: { ...prev.styleMirror, reviewerUrl: e.target.value } }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Paste Style Sample</label>
                    <textarea 
                      placeholder="Paste a review style you love here..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-4 min-h-[100px] focus:outline-none focus:border-indigo-500"
                      value={state.styleMirror.text || ''}
                      onChange={(e) => setState(prev => ({ ...prev, styleMirror: { ...prev.styleMirror, text: e.target.value } }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Or Upload Style Image</label>
                    <div className="flex gap-4 items-center">
                      <label className="flex-grow cursor-pointer glass px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors border-dashed border-2 border-white/10">
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setState(prev => ({ ...prev, styleMirror: { ...prev.styleMirror, image: reader.result as string } }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-zinc-400">{state.styleMirror.image ? 'Style Image Uploaded' : 'Upload Style Sample Image'}</span>
                      </label>
                      {state.styleMirror.image && (
                        <button 
                          onClick={() => setState(prev => ({ ...prev, styleMirror: { ...prev.styleMirror, image: undefined } }))}
                          className="p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={processReview}
                disabled={state.isGeneratingReview}
                className="w-full accent-gradient py-4 rounded-2xl font-bold text-lg hover:brightness-110 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {state.isGeneratingReview ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Drafting your story...
                  </>
                ) : (
                  "Generate My Personal Review"
                )}
              </button>
              <button onClick={reset} className="w-full mt-4 text-zinc-500 hover:text-white transition-colors">Start Over</button>
            </div>
          </div>
        </div>
      )}

      {state.isGeneratingReview && (
        <div className="max-w-3xl mx-auto space-y-12 mt-12 animate-pulse">
          <div className="text-center space-y-4">
            <div className="h-6 bg-white/10 rounded-full w-32 mx-auto"></div>
            <div className="flex justify-center gap-2">
              {[...Array(5)].map((_, i) => <div key={i} className="w-8 h-8 bg-white/10 rounded-full"></div>)}
            </div>
            <div className="h-12 bg-white/10 rounded w-64 mx-auto mt-4"></div>
          </div>
          <div className="glass p-8 md:p-12 rounded-[40px] space-y-4">
            <div className="h-4 bg-white/10 rounded w-full"></div>
            <div className="h-4 bg-white/10 rounded w-full"></div>
            <div className="h-4 bg-white/10 rounded w-5/6"></div>
            <div className="h-4 bg-white/10 rounded w-full"></div>
            <div className="h-4 bg-white/10 rounded w-4/5"></div>
          </div>
        </div>
      )}

      {state.review && !state.isGeneratingReview && (
        <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center">
            <div className="flex justify-between items-start mb-6">
              <div className="flex gap-2">
                <button 
                  onClick={() => copyToClipboard(state.review!.reviewText)}
                  className="p-2 glass rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                  title="Copy to Clipboard"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-7 10h7m-7-4h7" />
                  </svg>
                </button>
                <button 
                  onClick={() => downloadReview(state.review!, state.analysis!.name)}
                  className="p-2 glass rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                  title="Download Review"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
              <div className="inline-block px-4 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-widest">Your Honest Review</div>
              <div className="w-20"></div> {/* Spacer to center the label */}
            </div>
            <div className="flex justify-center items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <svg 
                    key={i} 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-8 w-8 ${i < Math.floor(state.review!.rating) ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-700'}`} 
                    viewBox="0 0 20 20" 
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                state.review.sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-400' :
                state.review.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                'bg-zinc-500/20 text-zinc-400'
              }`}>
                {state.review.sentiment}
              </div>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold italic leading-tight">My Verdict.</h2>
          </div>

          <div className="glass p-8 md:p-12 rounded-[40px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 8.44772 14.017 9V12C14.017 12.5523 13.5693 13 13.017 13H12.017V21H14.017ZM6.017 21L6.017 18C6.017 16.8954 6.91243 16 8.017 16H11.017C11.5693 16 12.017 15.5523 12.017 15V9C12.017 8.44772 11.5693 8 11.017 8H7.017C6.46472 8 6.017 8.44772 6.017 9V12C6.017 12.5523 5.56928 13 5.017 13H4.017V21H6.017Z" />
              </svg>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-xl md:text-2xl leading-relaxed text-zinc-300 font-light whitespace-pre-wrap">
                {state.review.reviewText}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 pt-12 border-t border-white/5">
              <div>
                <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-4">My Highlights</h4>
                <ul className="space-y-2">
                  {state.review.pros.map((pro, i) => (
                    <li key={i} className="flex gap-3 text-zinc-400">
                      <span className="text-emerald-500">✓</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-red-400 font-bold uppercase tracking-widest text-xs mb-4">My Grievances</h4>
                <ul className="space-y-2">
                  {state.review.cons.map((con, i) => (
                    <li key={i} className="flex gap-3 text-zinc-400">
                      <span className="text-red-500">✗</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={addToComparison}
              className="px-12 py-4 glass text-white rounded-full font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add to Comparison
            </button>
            <button 
              onClick={reset}
              className="px-12 py-4 bg-white text-black rounded-full font-bold hover:bg-zinc-200 transition-colors"
            >
              Write Another Review
            </button>
          </div>
        </div>
      )}

      {!state.comparisonResult && !state.review && !state.analysis && isLoadingHistory && (
        <div className="mt-24 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex items-center justify-between mb-8">
            <div className="h-8 bg-white/10 rounded w-48 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass p-6 rounded-3xl animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/10"></div>
                    <div>
                      <div className="h-4 bg-white/10 rounded w-24 mb-2"></div>
                      <div className="h-3 bg-white/10 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="w-8 h-4 bg-white/10 rounded"></div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-3 bg-white/10 rounded w-full"></div>
                  <div className="h-3 bg-white/10 rounded w-full"></div>
                  <div className="h-3 bg-white/10 rounded w-2/3"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-white/10 rounded-full w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!state.comparisonResult && !state.review && !state.analysis && !isLoadingHistory && state.history.length > 0 && (
        <div className="mt-24 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold italic">Recent Critiques</h3>
            <button 
              onClick={() => setState(prev => ({ ...prev, history: [] }))}
              className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors"
            >
              Clear History
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {state.history.map((item) => (
              <div 
                key={item.id}
                onClick={() => setState(prev => ({ ...prev, analysis: item.analysis, review: item.review, imagePreview: item.imagePreview }))}
                className="glass p-6 rounded-3xl text-left group hover:bg-white/[0.03] transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {item.imagePreview ? (
                      <img src={item.imagePreview} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm line-clamp-1">{item.analysis.name}</h4>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500 text-xs font-bold">{item.review.rating}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-yellow-500 fill-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <button
                      onClick={(e) => deleteHistoryItem(e, item.id)}
                      className="p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Review"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-zinc-400 text-xs line-clamp-3 leading-relaxed mb-4 italic">"{item.review.reviewText}"</p>
                <div className="flex items-center justify-between">
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    item.review.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
                    item.review.sentiment === 'negative' ? 'bg-red-500/10 text-red-400' :
                    'bg-zinc-500/10 text-zinc-400'
                  }`}>
                    {item.review.sentiment}
                  </div>
                  <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )}
</Layout>
  );
};

export default App;
