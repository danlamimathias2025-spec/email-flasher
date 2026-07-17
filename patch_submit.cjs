const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /const submitPaymentReceipt = async \(\) => \{[\s\S]*?\n  \};\n/g;

const newSubmit = `
  const submitPaymentReceipt = async () => {
    if (!uploadedReceiptBase64) {
      toast.error("Please upload a receipt image before submitting.");
      return;
    }
    setIsUploading(true);
    try {
      if (accountUser?.id) {
        await updateDoc(doc(db, "users", accountUser.id), {
          receiptImage: uploadedReceiptBase64,
          subscriptionPlan: selectedPlan,
          subscriptionStatus: "pending",
          paymentSubmittedAt: new Date().toISOString()
        });
        toast.success("Payment receipt submitted for review! Let your administrator know.");
        // refreshUserStatus is handled by onSnapshot
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred submitting receipt");
    } finally {
      setIsUploading(false);
    }
  };
`;

code = code.replace(regex, newSubmit);

fs.writeFileSync('src/App.tsx', code);
