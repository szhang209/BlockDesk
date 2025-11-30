import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Send, Paperclip, Loader2, User, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWeb3 } from '@/contexts/Web3Context';
import { useNotifications } from '@/contexts/NotificationContext';
import { uploadToIPFS, uploadTextToIPFS } from '@/lib/ipfs';

export const Route = createFileRoute('/create-ticket')({
  component: CreateTicket,
});

interface FormErrors {
  title?: string;
  description?: string;
  issueType?: string;
  equipmentType?: string;
  serialNumber?: string;
  attachment?: string;
}

function CreateTicket() {
  const { user, isConnected, contract } = useWeb3();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const ISSUE_OPTIONS = [
    "Computer won't turn on",
    "Slow performance",
    "Blue screen / crash",
    "Network connectivity issue",
    "Printer not working",
    "Virus / malware symptoms",
    "Software installation request",
    "Other"
  ];

  const EQUIPMENT_OPTIONS = [
    "Desktop PC",
    "Laptop",
    "Printer",
    "Network Switch",
    "Monitor",
    "Router",
    "Server",
    "Other"
  ];

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    issueType: '',
    equipmentType: '',
    serialNumber: '',
    remedialAction: '',
    attachment: undefined as File | undefined
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingToIPFS, setUploadingToIPFS] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    else if (formData.title.length < 5) newErrors.title = 'Title must be at least 5 characters';
    else if (formData.title.length > 100) newErrors.title = 'Title must be less than 100 characters';

    if (!formData.description.trim()) newErrors.description = 'Description is required';
    else if (formData.description.length < 10) newErrors.description = 'Description must be at least 10 characters';

    if (!formData.issueType) newErrors.issueType = "Issue type is required";
    if (!formData.equipmentType) newErrors.equipmentType = "Equipment type is required";

    if (!formData.serialNumber.trim()) newErrors.serialNumber = "Serial number required";

    if (formData.attachment) {
      const maxSize = 10 * 1024 * 1024;
      if (formData.attachment.size > maxSize) newErrors.attachment = 'File must be smaller than 10MB';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleIPFSUpload = async (file: File) => {
    setUploadingToIPFS(true);
    try {
      const result = await uploadToIPFS(file);
      return result;
    } finally {
      setUploadingToIPFS(false);
    }
  };

  const submitTicket = async (descriptionHash: string, attachmentHash?: string) => {
    if (!contract) throw new Error('Smart contract not connected.');
    const tx = await contract.createTicket(
      formData.title,
      descriptionHash,
      attachmentHash || '',
      { gasLimit: 500000 }
    );
    const receipt = await tx.wait();
    return tx.hash;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!isConnected || !user) {
      addNotification({
        type: 'error',
        title: 'Wallet Not Connected',
        message: 'Please connect your wallet to submit a ticket'
      });
      return;
    }

    setIsSubmitting(true);

    addNotification({
      type: 'info',
      title: 'Submitting transaction...',
      message: 'Please check MetaMask to confirm',
      duration: 0
    });

    try {
      const meta = {
        title: formData.title,
        description: formData.description,
        issueType: formData.issueType,
        equipmentType: formData.equipmentType,
        serialNumber: formData.serialNumber,
        remedialAction: formData.remedialAction,
        timestamp: Date.now()
      };

      const descriptionResult = await uploadTextToIPFS(JSON.stringify(meta, null, 2));
      const descriptionHash = descriptionResult.hash;

      localStorage.setItem(`ipfs_${descriptionHash}`, JSON.stringify(meta, null, 2));

      let attachmentHash: string | undefined;
      if (formData.attachment) {
        const result = await handleIPFSUpload(formData.attachment);
        attachmentHash = result.hash;
        if (result.dataUrl) localStorage.setItem(`ipfs_${result.hash}`, result.dataUrl);
      }

      const txHash = await submitTicket(descriptionHash, attachmentHash);

      addNotification({
        type: 'success',
        title: 'Ticket Submitted!',
        message: `TX: ${txHash.slice(0, 10)}...`,
        duration: 10000
      });

      navigate({ to: '/dashboard' });

    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Submission Failed',
        message: error.message,
        duration: 10000
      });

    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFormData(prev => ({ ...prev, attachment: file }));
    if (errors.attachment) setErrors(prev => ({ ...prev, attachment: undefined }));
  };

  const removeAttachment = () => {
    setFormData(prev => ({ ...prev, attachment: undefined }));
  };

  if (!isConnected || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <User size={48} className="mx-auto mb-4 text-yellow-600" />
            <h2 className="text-xl font-semibold">Wallet Connection Required</h2>
            <p className="text-yellow-700">Please connect your MetaMask wallet to create a ticket.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Create Support Ticket</h1>
          <p className="text-gray-600">Submit an IT support request</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            <div>
              <label className="block text-sm font-medium mb-2">Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle size={14} /> {errors.title}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description *</label>
              <textarea
                name="description"
                rows={6}
                value={formData.description}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg resize-y ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle size={14} /> {errors.description}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Issue Type *</label>
              <select
                name="issueType"
                value={formData.issueType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isSubmitting}
              >
                <option value="">Select an issue...</option>
                {ISSUE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {errors.issueType && (
                <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                  <AlertTriangle size={14} /> {errors.issueType}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Equipment Type *</label>
              <select
                name="equipmentType"
                value={formData.equipmentType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isSubmitting}
              >
                <option value="">Select equipment...</option>
                {EQUIPMENT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {errors.equipmentType && (
                <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                  <AlertTriangle size={14} /> {errors.equipmentType}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Equipment Serial Number *</label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.serialNumber ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {errors.serialNumber && (
                <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                  <AlertTriangle size={14} /> {errors.serialNumber}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Remedial Action Taken (Optional)</label>
              <textarea
                name="remedialAction"
                rows={3}
                value={formData.remedialAction}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg resize-y"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Attachment (Optional)</label>

              {formData.attachment ? (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={20} className="text-gray-500" />
                      <span className="text-sm text-gray-700">{formData.attachment.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(formData.attachment.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={removeAttachment}>
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="attachment"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isSubmitting}
                    accept="image/*,.pdf,.doc,.docx,.txt,.log"
                  />
                  <label htmlFor="attachment" className="cursor-pointer">
                    <Paperclip size={24} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload or drag a file</p>
                    <p className="text-xs text-gray-500">(Max 10MB)</p>
                  </label>
                </div>
              )}

              {errors.attachment && (
                <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                  <AlertTriangle size={14} /> {errors.attachment}
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <h3 className="font-medium mb-1">Submitting as:</h3>
              <p><strong>Wallet:</strong> {user.address}</p>
              <p><strong>Role:</strong> {user.role}</p>
              {user.balance && (
                <p><strong>Balance:</strong> {parseFloat(user.balance).toFixed(4)} ETH</p>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: '/dashboard' })}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                disabled={isSubmitting || uploadingToIPFS}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {uploadingToIPFS ? 'Uploading...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit Ticket
                  </>
                )}
              </Button>
            </div>

          </form>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">How it works:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Ticket stored on blockchain</li>
            <li>• File stored on IPFS</li>
            <li>• Requires MetaMask confirmation</li>
            <li>• Gas fees apply</li>
          </ul>
        </div>

      </div>
    </div>
  );
}

export default CreateTicket;
