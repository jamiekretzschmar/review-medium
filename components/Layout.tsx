
import React from 'react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">
      <header className="w-full max-w-4xl flex justify-between items-center mb-12">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 accent-gradient rounded-full flex items-center justify-center text-white font-bold">C</div>
          <h1 className="text-2xl font-bold tracking-tight">CRITIQUE <span className="text-indigo-500">PRO</span></h1>
        </div>
        <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold hidden sm:block">
          The Soulful Review Agent v1.1
        </div>
      </header>
      <main className="w-full max-w-4xl flex-grow">
        {children}
      </main>
      <footer className="mt-20 py-8 border-t border-white/5 w-full text-center text-zinc-600 text-sm">
        &copy; {new Date().getFullYear()} Elite Design Labs. Truthful & Empathetic.
      </footer>
    </div>
  );
};
