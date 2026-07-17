const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const fetchAdminUsersRegex = /const fetchAdminUsers = async \(\) => \{[\s\S]*?\n  \};\n/g;

const newFetchAdminUsers = `
  const fetchAdminUsers = async () => {
    // Replaced by onSnapshot below
  };
`;
code = code.replace(fetchAdminUsersRegex, newFetchAdminUsers);

const adminEffectRegex = /useEffect\(\(\) => \{\n    if \(accountUser\?\.role === "admin" && activeTab === "admin"\) \{\n      fetchAdminUsers\(\);\n    \}\n  \}, \[accountUser\?\.role, activeTab\]\);/g;

const newAdminEffect = `
  useEffect(() => {
    if (accountUser?.role === "admin" && activeTab === "admin") {
      setAdminLoading(true);
      const q = collection(db, "users");
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersList: any[] = [];
        snapshot.forEach((doc) => {
          usersList.push({ id: doc.id, ...doc.data() });
        });
        setAdminUsers(usersList);
        setAdminLoading(false);
      });
      return () => unsubscribe();
    }
  }, [accountUser?.role, activeTab]);
`;
code = code.replace(adminEffectRegex, newAdminEffect);

fs.writeFileSync('src/App.tsx', code);
