const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf-8');

// The Auth Form is around here:
const authFormRegex = /<form onSubmit=\{authTab === "login" \? handleLogin : handleRegister\}[\s\S]*?<\/form>/g;

const newForm = `
            <div className="space-y-4 text-center mt-6">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isAuthLoading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 px-4 py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50 border border-slate-200"
              >
                {isAuthLoading ? (
                  <div className="h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      <path fill="none" d="M1 1h22v22H1z" />
                    </svg>
                    Sign in with Google
                  </>
                )}
              </button>
            </div>
`;

code = code.replace(authFormRegex, newForm);

// Also we should remove the toggle button since there's only "Sign in with Google" now
const toggleRegex = /<button[\s\S]*?className="w-full text-center text-xs font-bold text-slate-400 hover:text-white transition-colors"[\s\S]*?<\/button>/g;
code = code.replace(toggleRegex, '');

// Also remove auth tab headers if any
const authTabRegex = /<div className="flex bg-slate-950 p-1 rounded-xl mb-6">[\s\S]*?<\/div>/g;
code = code.replace(authTabRegex, '');

fs.writeFileSync('src/App.tsx', code);
