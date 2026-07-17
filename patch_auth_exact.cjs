const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Imports
const imports = `import { auth, db, googleProvider } from "./lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, onSnapshot } from "firebase/firestore";
`;
code = code.replace('import { Toaster, toast } from "react-hot-toast";', imports + 'import { Toaster, toast } from "react-hot-toast";');

code = code.replace(/const \[authTab, setAuthTab\] = useState.*?;/g, 'const [authTab, setAuthTab] = useState<"login" | "register">("login");');
code = code.replace(/const \[authEmail, setAuthEmail\] = useState.*?;/g, '');
code = code.replace(/const \[authPassword, setAuthPassword\] = useState.*?;/g, '');

const startIdx = code.indexOf('const handleRegister = async');
const endIdx = code.indexOf('// --- Subscription Receipt Upload Handlers ---');

if (startIdx !== -1 && endIdx !== -1) {
  const newHandlers = `
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
            setAccountUser(data);
            localStorage.setItem("account_user", JSON.stringify(data));
          } else {
            // Create user
            const newUser = {
              email: user.email,
              role: user.email === 'mathiasdanlami2025@gmail.com' ? 'admin' : 'user',
              subscriptionStatus: user.email === 'mathiasdanlami2025@gmail.com' ? 'approved' : 'none',
              subscriptionPlan: user.email === 'mathiasdanlami2025@gmail.com' ? '1-Month' : null
            };
            setDoc(userRef, newUser).then(() => {
              const data = { id: user.uid, ...newUser };
              setAccountUser(data);
              localStorage.setItem("account_user", JSON.stringify(data));
            });
          }
        });
        return () => unsubscribeDoc();
      } else {
        setAccountUser(null);
        localStorage.removeItem("account_user");
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Signed in successfully!");
    } catch (err: any) {
      setAuthError(err.message || "Failed to sign in");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAccountLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("account_user");
    setAccountUser(null);
    toast.success("Logged out from user account");
  };

  // Watch for session expiration in real-time to immediately kick out expired users
  useEffect(() => {
    if (accountUser && isAuthorized) {
      const checkExpiry = () => {
        const info = getSessionInfo();
        if (info && info.isExpired) {
          toast.error("Your subscription plan has expired! Please select a plan and submit a payment to regain terminal access.", { id: "sub-expired-toast", duration: 10000 });
        }
      };
      const interval = setInterval(checkExpiry, 1000);
      return () => clearInterval(interval);
    }
  }, [accountUser?.email, isAuthorized]);

  `;
  code = code.substring(0, startIdx) + newHandlers + code.substring(endIdx);
}

fs.writeFileSync('src/App.tsx', code);
