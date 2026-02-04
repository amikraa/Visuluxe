import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TypeToConfirmDialog } from '@/components/shared/TypeToConfirmDialog';
import { 
  Coins, Plus, Minus, RefreshCw, Search, ArrowUpRight, ArrowDownRight, RotateCcw, 
  Users, AlertTriangle, FileText, Upload, Download, Trash2, CheckCircle, Clock, XCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type TransactionType = 'add' | 'deduct' | 'refund' | 'expire' | 'daily_reset' | 'generation';

// Validation constants
const MIN_CREDIT_AMOUNT = 1;
const MAX_CREDIT_ADD = 1000000;

interface UserCredits {
  id: string;
  user_id: string;
  balance: number;
  daily_credits: number;
  last_daily_reset: string;
  profiles: {
    display_name: string | null;
    email: string | null;
  } | null;
}

interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  reason: string | null;
  admin_id: string | null;
  created_at: string;
  profiles: {
    display_name: string | null;
    email: string | null;
  } | null;
}

interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  amount: number;
  description: string | null;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  file_url: string | null;
  file_name: string | null;
  created_by: string | null;
  created_at: string;
  paid_at: string | null;
  profiles?: {
    display_name: string | null;
    email: string | null;
  } | null;
}

export default function AdminBilling() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Credit management state
  const [searchTerm, setSearchTerm] = useState('');
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [deductConfirmOpen, setDeductConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserCredits | null>(null);
  const [creditAction, setCreditAction] = useState<'add' | 'deduct' | 'refund'>('add');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  
  // Invoice management state
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoiceUserSearch, setInvoiceUserSearch] = useState('');
  const [selectedInvoiceUserId, setSelectedInvoiceUserId] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteInvoiceConfirm, setDeleteInvoiceConfirm] = useState<Invoice | null>(null);

  const { data: userCredits, isLoading: creditsLoading } = useQuery({
    queryKey: ['admin-user-credits', searchTerm],
    queryFn: async () => {
      const { data: credits, error } = await supabase
        .from('user_credits')
        .select('*')
        .order('balance', { ascending: false })
        .limit(50);
      
      if (error) throw error;

      const userIds = credits.map(c => c.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      let result = credits.map(c => ({
        ...c,
        profiles: profileMap.get(c.user_id) || null
      })) as UserCredits[];

      if (searchTerm) {
        result = result.filter(uc => 
          uc.profiles?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          uc.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      return result;
    },
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['admin-credit-transactions'],
    queryFn: async () => {
      const { data: txs, error } = await supabase
        .from('credits_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;

      const userIds = [...new Set(txs.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return txs.map(t => ({
        ...t,
        profiles: profileMap.get(t.user_id) || null
      })) as CreditTransaction[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-credit-stats'],
    queryFn: async () => {
      const { data: totalCredits } = await supabase
        .from('user_credits')
        .select('balance');
      
      const { data: totalUsers } = await supabase
        .from('user_credits')
        .select('id', { count: 'exact' });

      const totalBalance = totalCredits?.reduce((sum, uc) => sum + (uc.balance || 0), 0) || 0;
      
      return {
        totalBalance,
        totalUsers: totalUsers?.length || 0,
        avgBalance: totalUsers?.length ? Math.round(totalBalance / totalUsers.length) : 0,
      };
    },
  });

  const modifyCreditsMutation = useMutation({
    mutationFn: async ({ userId, amount, type, reason }: { 
      userId: string; 
      amount: number; 
      type: TransactionType; 
      reason: string 
    }) => {
      // First, update the user's balance
      const { data: currentCredits, error: fetchError } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const newBalance = type === 'add' || type === 'refund' 
        ? (currentCredits.balance || 0) + amount
        : (currentCredits.balance || 0) - amount;
      
      if (newBalance < 0) {
        throw new Error('Cannot reduce balance below 0');
      }
      
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({ balance: newBalance })
        .eq('user_id', userId);
      
      if (updateError) throw updateError;
      
      // Record the transaction
      const { error: txError } = await supabase
        .from('credits_transactions')
        .insert({
          user_id: userId,
          amount: type === 'deduct' ? -amount : amount,
          type: type,
          reason: reason,
          admin_id: user?.id,
        });
      
      if (txError) throw txError;
    },
    onSuccess: () => {
      toast.success('Credits updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['admin-credit-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-credit-stats'] });
      setCreditDialogOpen(false);
      setSelectedUser(null);
      setCreditAmount('');
      setCreditReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update credits');
    },
  });

  // Fetch all users for invoice creation
  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-all-users-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .order('display_name', { ascending: true })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Filter users for invoice creation
  const filteredInvoiceUsers = allUsers.filter(u => 
    u.display_name?.toLowerCase().includes(invoiceUserSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(invoiceUserSearch.toLowerCase())
  );

  // Fetch invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['admin-invoices', invoiceSearchTerm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;

      const userIds = [...new Set(data.map(i => i.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      let result = data.map(i => ({
        ...i,
        profiles: profileMap.get(i.user_id) || null
      })) as Invoice[];

      if (invoiceSearchTerm) {
        result = result.filter(inv => 
          inv.invoice_number.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
          inv.profiles?.display_name?.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
          inv.profiles?.email?.toLowerCase().includes(invoiceSearchTerm.toLowerCase())
        );
      }
      
      return result;
    },
  });

  // Invoice stats
  const invoiceStats = useMemo(() => {
    const pending = invoices.filter(i => i.status === 'pending').length;
    const paid = invoices.filter(i => i.status === 'paid').length;
    const overdue = invoices.filter(i => i.status === 'overdue').length;
    const totalAmount = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
    const paidAmount = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0);
    return { pending, paid, overdue, totalAmount, paidAmount };
  }, [invoices]);

  // Create/Update invoice mutation
  const invoiceMutation = useMutation({
    mutationFn: async (data: {
      user_id: string;
      invoice_number: string;
      amount: number;
      description: string;
      due_date: string;
      file?: File | null;
      existingId?: string;
    }) => {
      let file_url: string | null = null;
      let file_name: string | null = null;

      // Upload file if provided
      if (data.file) {
        const fileExt = data.file.name.split('.').pop();
        const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('invoice-files')
          .upload(fileName, data.file);
        
        if (uploadError) throw uploadError;
        
        file_url = uploadData.path;
        file_name = data.file.name;
      }

      if (data.existingId) {
        // Update existing invoice
        const updateData: Record<string, unknown> = {
          amount: data.amount,
          description: data.description,
          due_date: data.due_date,
          updated_at: new Date().toISOString(),
        };
        
        if (file_url) {
          updateData.file_url = file_url;
          updateData.file_name = file_name;
        }

        const { error } = await supabase
          .from('invoices')
          .update(updateData)
          .eq('id', data.existingId);
        
        if (error) throw error;
      } else {
        // Create new invoice
        const { error } = await supabase
          .from('invoices')
          .insert({
            user_id: data.user_id,
            invoice_number: data.invoice_number,
            amount: data.amount,
            description: data.description,
            due_date: data.due_date,
            file_url,
            file_name,
            created_by: user?.id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingInvoice ? 'Invoice updated' : 'Invoice created');
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      resetInvoiceForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save invoice');
    },
  });

  // Update invoice status mutation
  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, unknown> = { 
        status,
        updated_at: new Date().toISOString(),
      };
      
      if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Invoice status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoice: Invoice) => {
      // Delete file from storage if exists
      if (invoice.file_url) {
        await supabase.storage.from('invoice-files').remove([invoice.file_url]);
      }
      
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Invoice deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      setDeleteInvoiceConfirm(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete invoice');
    },
  });

  const resetInvoiceForm = () => {
    setInvoiceDialogOpen(false);
    setEditingInvoice(null);
    setSelectedInvoiceUserId('');
    setInvoiceUserSearch('');
    setInvoiceAmount('');
    setInvoiceDescription('');
    setInvoiceDueDate('');
    setInvoiceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setSelectedInvoiceUserId('');
    setInvoiceUserSearch('');
    setInvoiceAmount('');
    setInvoiceDescription('');
    setInvoiceDueDate(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')); // 30 days from now
    setInvoiceFile(null);
    setInvoiceDialogOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setSelectedInvoiceUserId(invoice.user_id);
    const userProfile = allUsers.find(u => u.user_id === invoice.user_id);
    setInvoiceUserSearch(userProfile?.display_name || userProfile?.email || '');
    setInvoiceAmount(String(invoice.amount));
    setInvoiceDescription(invoice.description || '');
    setInvoiceDueDate(invoice.due_date);
    setInvoiceFile(null);
    setInvoiceDialogOpen(true);
  };

  const handleSaveInvoice = () => {
    if (!selectedInvoiceUserId || !invoiceAmount || !invoiceDueDate) {
      toast.error('Please fill all required fields');
      return;
    }

    const invoiceNumber = editingInvoice?.invoice_number || `INV-${Date.now().toString(36).toUpperCase()}`;
    
    invoiceMutation.mutate({
      user_id: selectedInvoiceUserId,
      invoice_number: invoiceNumber,
      amount: parseFloat(invoiceAmount),
      description: invoiceDescription,
      due_date: invoiceDueDate,
      file: invoiceFile,
      existingId: editingInvoice?.id,
    });
  };

  const handleDownloadInvoiceFile = async (invoice: Invoice) => {
    if (!invoice.file_url) return;
    
    try {
      const { data, error } = await supabase.storage
        .from('invoice-files')
        .download(invoice.file_url);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = invoice.file_name || 'invoice';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    const styles: Record<string, { class: string; icon: React.ReactNode }> = {
      pending: { class: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: <Clock className="h-3 w-3" /> },
      paid: { class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle className="h-3 w-3" /> },
      overdue: { class: 'bg-red-500/10 text-red-400 border-red-500/20', icon: <AlertTriangle className="h-3 w-3" /> },
      cancelled: { class: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: <XCircle className="h-3 w-3" /> },
    };
    const style = styles[status] || styles.pending;
    return (
      <Badge className={`${style.class} flex items-center gap-1 capitalize`}>
        {style.icon}
        {status}
      </Badge>
    );
  };

  const handleCreditAction = (action: 'add' | 'deduct' | 'refund', userCredit: UserCredits) => {
    setSelectedUser(userCredit);
    setCreditAction(action);
    setCreditAmount('');
    setCreditReason('');
    setCreditDialogOpen(true);
  };

  // Validation for credit amounts
  const validateCreditAmount = useMemo(() => {
    if (!creditAmount || !selectedUser) return null;
    
    const amount = parseFloat(creditAmount);
    
    if (isNaN(amount) || amount < MIN_CREDIT_AMOUNT) {
      return `Amount must be at least ${MIN_CREDIT_AMOUNT}`;
    }
    
    if (creditAction === 'deduct' && amount > selectedUser.balance) {
      return `Cannot deduct more than current balance (${selectedUser.balance.toLocaleString()})`;
    }
    
    if ((creditAction === 'add' || creditAction === 'refund') && amount > MAX_CREDIT_ADD) {
      return `Maximum amount is ${MAX_CREDIT_ADD.toLocaleString()}`;
    }
    
    return null;
  }, [creditAmount, creditAction, selectedUser]);

  const isDeductReasonMissing = creditAction === 'deduct' && !creditReason.trim();
  const newBalancePreview = selectedUser && creditAmount ? 
    (creditAction === 'deduct' 
      ? selectedUser.balance - parseFloat(creditAmount || '0')
      : selectedUser.balance + parseFloat(creditAmount || '0')) 
    : null;

  const handleProceedWithAction = () => {
    if (!selectedUser || !creditAmount) return;
    
    // For deductions, show type-to-confirm dialog
    if (creditAction === 'deduct') {
      setCreditDialogOpen(false);
      setDeductConfirmOpen(true);
      return;
    }
    
    // For add/refund, proceed directly
    executeCredit();
  };

  const executeCredit = () => {
    if (!selectedUser || !creditAmount) return;
    
    modifyCreditsMutation.mutate({
      userId: selectedUser.user_id,
      amount: parseFloat(creditAmount),
      type: creditAction,
      reason: creditReason || `Admin ${creditAction}`,
    });
  };

  const getTransactionBadge = (type: TransactionType) => {
    const styles: Record<TransactionType, { class: string; icon: React.ReactNode }> = {
      add: { class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <ArrowUpRight className="h-3 w-3" /> },
      deduct: { class: 'bg-red-500/10 text-red-400 border-red-500/20', icon: <ArrowDownRight className="h-3 w-3" /> },
      refund: { class: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: <RotateCcw className="h-3 w-3" /> },
      expire: { class: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: <ArrowDownRight className="h-3 w-3" /> },
      daily_reset: { class: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: <RefreshCw className="h-3 w-3" /> },
      generation: { class: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: <ArrowDownRight className="h-3 w-3" /> },
    };
    const style = styles[type];
    return (
      <Badge className={`${style.class} flex items-center gap-1`}>
        {style.icon}
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Credits</h1>
        <p className="text-slate-400 text-sm mt-1">Manage user credits and transactions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Credits</p>
                <p className="text-2xl font-bold text-white">{stats?.totalBalance?.toLocaleString() || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Coins className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Users with Credits</p>
                <p className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Avg Balance</p>
                <p className="text-2xl font-bold text-white">{stats?.avgBalance || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <Coins className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-admin-surface border border-admin-border">
          <TabsTrigger value="users" className="data-[state=active]:bg-admin-accent">
            <Users className="h-4 w-4 mr-2" />
            User Credits
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-admin-accent">
            <Coins className="h-4 w-4 mr-2" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-admin-accent">
            <FileText className="h-4 w-4 mr-2" />
            Invoices ({invoices.length})
          </TabsTrigger>
        </TabsList>

        {/* User Credits Tab */}
        <TabsContent value="users">
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-admin-accent/20">
                    <Coins className="h-5 w-5 text-admin-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-white">User Credit Balances</CardTitle>
                    <CardDescription className="text-slate-400">
                      Manage individual user credits
                    </CardDescription>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-admin-background border-admin-border text-white w-[250px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
                </div>
              ) : userCredits && userCredits.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-admin-border hover:bg-transparent">
                      <TableHead className="text-slate-400">User</TableHead>
                      <TableHead className="text-slate-400">Balance</TableHead>
                      <TableHead className="text-slate-400">Daily Credits</TableHead>
                      <TableHead className="text-slate-400">Last Reset</TableHead>
                      <TableHead className="text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userCredits.map((uc) => (
                      <TableRow key={uc.id} className="border-admin-border hover:bg-admin-surface-hover">
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{uc.profiles?.display_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{uc.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-lg text-white">{uc.balance.toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-slate-300">{uc.daily_credits}</TableCell>
                        <TableCell className="text-slate-400">
                          {uc.last_daily_reset ? new Date(uc.last_daily_reset).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCreditAction('add', uc)}
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCreditAction('deduct', uc)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCreditAction('refund', uc)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No user credits found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-admin-warning/20">
                  <RefreshCw className="h-5 w-5 text-admin-warning" />
                </div>
                <div>
                  <CardTitle className="text-white">Transaction History</CardTitle>
                  <CardDescription className="text-slate-400">
                    Recent credit transactions
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
                </div>
              ) : transactions && transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-admin-border hover:bg-transparent">
                      <TableHead className="text-slate-400">User</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400">Amount</TableHead>
                      <TableHead className="text-slate-400">Reason</TableHead>
                      <TableHead className="text-slate-400">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} className="border-admin-border hover:bg-admin-surface-hover">
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{tx.profiles?.display_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{tx.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getTransactionBadge(tx.type)}</TableCell>
                        <TableCell>
                          <span className={`font-mono ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {tx.amount >= 0 ? '+' : ''}{tx.amount}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-400 max-w-[200px] truncate">{tx.reason || '-'}</TableCell>
                        <TableCell className="text-slate-300">
                          {new Date(tx.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No transactions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Invoices</CardTitle>
                    <CardDescription className="text-slate-400">
                      Create and manage user invoices
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search invoices..."
                      value={invoiceSearchTerm}
                      onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                      className="pl-9 bg-admin-background border-admin-border text-white w-[200px]"
                    />
                  </div>
                  <Button onClick={handleCreateInvoice} className="bg-admin-accent hover:bg-admin-accent-hover">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Invoice Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-3 rounded-lg bg-admin-background border border-admin-border">
                  <p className="text-xs text-slate-500">Total Invoiced</p>
                  <p className="text-lg font-bold text-white">${invoiceStats.totalAmount.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-admin-background border border-admin-border">
                  <p className="text-xs text-slate-500">Paid</p>
                  <p className="text-lg font-bold text-emerald-400">${invoiceStats.paidAmount.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-admin-background border border-admin-border">
                  <p className="text-xs text-slate-500">Pending</p>
                  <p className="text-lg font-bold text-amber-400">{invoiceStats.pending}</p>
                </div>
                <div className="p-3 rounded-lg bg-admin-background border border-admin-border">
                  <p className="text-xs text-slate-500">Overdue</p>
                  <p className="text-lg font-bold text-red-400">{invoiceStats.overdue}</p>
                </div>
              </div>

              {invoicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
                </div>
              ) : invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-admin-border hover:bg-transparent">
                      <TableHead className="text-slate-400">Invoice #</TableHead>
                      <TableHead className="text-slate-400">User</TableHead>
                      <TableHead className="text-slate-400">Amount</TableHead>
                      <TableHead className="text-slate-400">Due Date</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">File</TableHead>
                      <TableHead className="text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id} className="border-admin-border hover:bg-admin-surface-hover">
                        <TableCell className="font-mono text-white">{invoice.invoice_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{invoice.profiles?.display_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{invoice.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-lg text-white">
                          ${Number(invoice.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>{getInvoiceStatusBadge(invoice.status)}</TableCell>
                        <TableCell>
                          {invoice.file_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadInvoiceFile(invoice)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              {invoice.file_name?.substring(0, 15) || 'Download'}
                            </Button>
                          ) : (
                            <span className="text-slate-500 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Select
                              value={invoice.status}
                              onValueChange={(value) => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: value })}
                            >
                              <SelectTrigger className="w-[100px] h-8 bg-admin-background border-admin-border text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditInvoice(invoice)}
                              className="text-slate-400 hover:text-white"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteInvoiceConfirm(invoice)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No invoices yet</p>
                  <Button onClick={handleCreateInvoice} variant="outline" className="mt-4 border-admin-border text-slate-300">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Invoice
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Create/Edit Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={(open) => { if (!open) resetInvoiceForm(); else setInvoiceDialogOpen(open); }}>
        <DialogContent className="bg-admin-surface border-admin-border text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'Create Invoice'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingInvoice ? 'Update invoice details' : 'Create a new invoice for a user'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* User Selection (only for new invoices) */}
            {!editingInvoice && (
              <div className="grid gap-2">
                <Label className="text-slate-300">Select User *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search users..."
                    value={invoiceUserSearch}
                    onChange={(e) => setInvoiceUserSearch(e.target.value)}
                    className="pl-9 bg-admin-background border-admin-border text-white"
                  />
                </div>
                <ScrollArea className="h-32 rounded-md border border-admin-border bg-admin-background">
                  <div className="p-2 space-y-1">
                    {filteredInvoiceUsers.slice(0, 30).map((u) => (
                      <button
                        key={u.user_id}
                        onClick={() => {
                          setSelectedInvoiceUserId(u.user_id);
                          setInvoiceUserSearch(u.display_name || u.email || '');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedInvoiceUserId === u.user_id
                            ? 'bg-admin-accent/20 text-admin-accent'
                            : 'text-slate-300 hover:bg-admin-border/50'
                        }`}
                      >
                        <span className="font-medium">{u.display_name || 'No name'}</span>
                        <span className="text-slate-500 ml-2 text-xs">{u.email}</span>
                      </button>
                    ))}
                    {filteredInvoiceUsers.length === 0 && (
                      <p className="text-slate-500 text-sm p-2">No users found</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {editingInvoice && (
              <div className="p-3 rounded-lg bg-admin-background border border-admin-border">
                <p className="text-xs text-slate-500">Invoice Number</p>
                <p className="font-mono text-white">{editingInvoice.invoice_number}</p>
              </div>
            )}

            <div className="grid gap-2">
              <Label className="text-slate-300">Amount ($) *</Label>
              <Input
                type="number"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                placeholder="100.00"
                min="0.01"
                step="0.01"
                className="bg-admin-background border-admin-border text-white"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Description</Label>
              <Textarea
                value={invoiceDescription}
                onChange={(e) => setInvoiceDescription(e.target.value)}
                placeholder="Invoice description..."
                className="bg-admin-background border-admin-border text-white"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Due Date *</Label>
              <Input
                type="date"
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                className="bg-admin-background border-admin-border text-white"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">
                Attach File <span className="text-slate-500 text-xs">(PDF, image, etc.)</span>
              </Label>
              {invoiceFile ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-admin-background border border-admin-border">
                  <FileText className="h-5 w-5 text-blue-400" />
                  <span className="text-sm text-white truncate flex-1">{invoiceFile.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setInvoiceFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-admin-border text-slate-300 border-dashed"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              />
              {editingInvoice?.file_name && !invoiceFile && (
                <p className="text-xs text-slate-500">Current file: {editingInvoice.file_name}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetInvoiceForm} className="border-admin-border text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleSaveInvoice}
              disabled={invoiceMutation.isPending || !invoiceAmount || !invoiceDueDate || (!editingInvoice && !selectedInvoiceUserId)}
              className="bg-admin-accent hover:bg-admin-accent-hover"
            >
              {invoiceMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Invoice Confirmation */}
      <TypeToConfirmDialog
        open={!!deleteInvoiceConfirm}
        onOpenChange={(open) => { if (!open) setDeleteInvoiceConfirm(null); }}
        title="Delete Invoice"
        message={`This will permanently delete invoice ${deleteInvoiceConfirm?.invoice_number}.`}
        confirmWord="DELETE"
        variant="destructive"
        isLoading={deleteInvoiceMutation.isPending}
        confirmButtonText="Delete Invoice"
        onConfirm={() => deleteInvoiceConfirm && deleteInvoiceMutation.mutate(deleteInvoiceConfirm)}
      >
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-300">
            Invoice: <span className="font-mono">{deleteInvoiceConfirm?.invoice_number}</span>
          </p>
          <p className="text-sm text-red-300">
            Amount: <span className="font-mono">${Number(deleteInvoiceConfirm?.amount || 0).toLocaleString()}</span>
          </p>
        </div>
      </TypeToConfirmDialog>

      {/* Credit Modification Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="bg-admin-surface border-admin-border text-white">
          <DialogHeader>
            <DialogTitle className="capitalize">{creditAction} Credits</DialogTitle>
            <DialogDescription className="text-slate-400">
              {creditAction === 'add' && 'Add credits to user account'}
              {creditAction === 'deduct' && 'Remove credits from user account'}
              {creditAction === 'refund' && 'Refund credits to user account'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-admin-background border border-admin-border">
              <p className="text-sm text-slate-400">User</p>
              <p className="font-medium text-white">{selectedUser?.profiles?.display_name || selectedUser?.profiles?.email}</p>
              <p className="text-xs text-slate-500">Current balance: {selectedUser?.balance.toLocaleString()} credits</p>
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">Amount</Label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="100"
                min={MIN_CREDIT_AMOUNT}
                max={creditAction === 'deduct' ? selectedUser?.balance : MAX_CREDIT_ADD}
                className={`bg-admin-background border-admin-border text-white ${validateCreditAmount ? 'border-red-500' : ''}`}
              />
              {validateCreditAmount && (
                <p className="text-xs text-red-400">{validateCreditAmount}</p>
              )}
              <p className="text-xs text-slate-500">
                {creditAction === 'add' || creditAction === 'refund' 
                  ? `Min: ${MIN_CREDIT_AMOUNT}, Max: ${MAX_CREDIT_ADD.toLocaleString()}`
                  : `Min: ${MIN_CREDIT_AMOUNT}, Max: ${selectedUser?.balance.toLocaleString() || 0} (current balance)`}
              </p>
            </div>
            
            {/* Balance Preview */}
            {creditAmount && newBalancePreview !== null && !validateCreditAmount && (
              <div className="p-3 rounded-lg bg-admin-background border border-admin-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">New balance after {creditAction}:</span>
                  <span className={`font-mono font-bold ${newBalancePreview < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {newBalancePreview.toLocaleString()} credits
                  </span>
                </div>
              </div>
            )}
            
            <div className="grid gap-2">
              <Label className="text-slate-300">
                Reason {creditAction === 'deduct' && <span className="text-red-400">*</span>}
              </Label>
              <Textarea
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder={creditAction === 'deduct' ? "Reason is required for deductions..." : "Reason for credit adjustment..."}
                className={`bg-admin-background border-admin-border text-white ${isDeductReasonMissing ? 'border-red-500' : ''}`}
              />
              {isDeductReasonMissing && (
                <p className="text-xs text-red-400">Reason is required for deductions</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)} className="border-admin-border text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleProceedWithAction}
              disabled={!!validateCreditAmount || !creditAmount || isDeductReasonMissing}
              className={
                creditAction === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' :
                creditAction === 'deduct' ? 'bg-red-600 hover:bg-red-700' :
                'bg-blue-600 hover:bg-blue-700'
              }
            >
              {creditAction === 'add' && <Plus className="h-4 w-4 mr-2" />}
              {creditAction === 'deduct' && <Minus className="h-4 w-4 mr-2" />}
              {creditAction === 'refund' && <RotateCcw className="h-4 w-4 mr-2" />}
              {creditAction === 'deduct' ? 'Continue' : `Confirm ${creditAction}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deduct Confirmation Dialog */}
      <TypeToConfirmDialog
        open={deductConfirmOpen}
        onOpenChange={(open) => {
          setDeductConfirmOpen(open);
          if (!open) {
            setCreditAmount('');
            setCreditReason('');
            setSelectedUser(null);
          }
        }}
        title="Confirm Credit Deduction"
        message="This action will remove credits from the user's account."
        confirmWord="DEDUCT"
        variant="destructive"
        isLoading={modifyCreditsMutation.isPending}
        confirmButtonText="Deduct Credits"
        onConfirm={executeCredit}
      >
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <p className="text-sm text-red-300 font-medium">Credit Deduction Summary</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-slate-400">User:</span>
            <span className="text-white">{selectedUser?.profiles?.display_name || selectedUser?.profiles?.email}</span>
            
            <span className="text-slate-400">Current Balance:</span>
            <span className="text-white font-mono">{selectedUser?.balance.toLocaleString()}</span>
            
            <span className="text-slate-400">Deducting:</span>
            <span className="text-red-400 font-mono">-{parseFloat(creditAmount || '0').toLocaleString()}</span>
            
            <span className="text-slate-400">New Balance:</span>
            <span className="text-emerald-400 font-mono font-bold">{newBalancePreview?.toLocaleString()}</span>
            
            <span className="text-slate-400">Reason:</span>
            <span className="text-white">{creditReason}</span>
          </div>
        </div>
      </TypeToConfirmDialog>
    </div>
  );
}
