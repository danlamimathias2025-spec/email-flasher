const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex1 = /const handleApprovePayment = async \(userId: string\) => \{[\s\S]*?\n  \};\n/g;
const new1 = `
  const handleApprovePayment = async (userId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        subscriptionStatus: "approved",
        approvedAt: new Date().toISOString()
      });
      toast.success("Payment approved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to approve payment");
    }
  };
`;
code = code.replace(regex1, new1);

const regex2 = /const handleUpdateUser = async \(e: React\.FormEvent\) => \{[\s\S]*?\n  \};\n/g;
const new2 = `
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, "users", editingUser.id), {
        role: editRole,
        subscriptionStatus: editStatus,
        subscriptionPlan: editPlan
      });
      toast.success("User updated successfully");
      setShowEditModal(false);
      setEditingUser(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update user");
    }
  };
`;
code = code.replace(regex2, new2);

const regex3 = /const handleDeleteUser = async \(userId: string\) => \{[\s\S]*?\n  \};\n/g;
const new3 = `
  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      toast.success("User deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };
`;
code = code.replace(regex3, new3);

fs.writeFileSync('src/App.tsx', code);
