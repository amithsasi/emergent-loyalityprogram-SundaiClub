import React, { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { AlertCircle, Coffee, Smartphone, Users, BarChart3, Shield, QrCode } from 'lucide-react';
import { Alert, AlertDescription } from './components/ui/alert';
import { useToast } from './hooks/use-toast';
import { Toaster } from './components/ui/toaster';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WhatsAppQR = () => {
  const [qrCode, setQrCode] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const checkStatus = async () => {
    try {
      const response = await axios.get(`${API}/whatsapp/status`);
      setStatus(response.data.connected ? 'connected' : 'disconnected');
      return response.data.connected;
    } catch (error) {
      console.error('Status check failed:', error);
      setStatus('error');
      return false;
    }
  };

  const fetchQR = async () => {
    try {
      const response = await axios.get(`${API}/whatsapp/qr`);
      if (response.data.qr) {
        setQrCode(response.data.qr);
      } else {
        setQrCode(null);
      }
    } catch (error) {
      console.error('QR fetch failed:', error);
    }
  };

  const startPolling = () => {
    const interval = setInterval(async () => {
      const isConnected = await checkStatus();
      if (isConnected) {
        setQrCode(null);
        clearInterval(interval);
        toast({
          title: "WhatsApp Connected!",
          description: "Your coffee passport system is now ready.",
        });
      } else {
        await fetchQR();
      }
    }, 3000);

    return interval;
  };

  useEffect(() => {
    checkStatus();
    const interval = startPolling();
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    await checkStatus();
    if (status !== 'connected') {
      startPolling();
    }
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
          <Smartphone className="h-8 w-8 text-green-600" />
        </div>
        <CardTitle className="text-2xl font-bold">WhatsApp Connection</CardTitle>
        <CardDescription>
          Connect your WhatsApp to start the coffee passport system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'connected' && (
          <Alert className="border-green-200 bg-green-50">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              WhatsApp is connected! Customers can now send messages.
            </AlertDescription>
          </Alert>
        )}

        {status === 'disconnected' && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              WhatsApp is not connected. Scan the QR code to connect.
            </AlertDescription>
          </Alert>
        )}

        {status === 'error' && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Connection error. Please check if the WhatsApp service is running.
            </AlertDescription>
          </Alert>
        )}

        {qrCode && (
          <div className="text-center space-y-4">
            <h3 className="font-semibold">Scan with WhatsApp:</h3>
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                alt="WhatsApp QR Code"
                className="w-48 h-48"
              />
            </div>
            <p className="text-sm text-gray-600">
              Open WhatsApp → Settings → Linked Devices → Link a Device
            </p>
          </div>
        )}

        <Button
          onClick={handleConnect}
          disabled={loading || status === 'connected'}
          className="w-full"
          data-testid="connect-whatsapp-btn"
        >
          {loading ? 'Connecting...' : status === 'connected' ? 'Connected ✓' : 'Connect WhatsApp'}
        </Button>

        {status === 'connected' && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">Customer Commands:</h4>
            <div className="text-xs space-y-1 text-gray-600">
              <div><strong>JOIN</strong> - Create passport</div>
              <div><strong>STATUS</strong> - Check progress</div>
              <div><strong>REWARD</strong> - Claim free coffee</div>
              <div><strong>HELP</strong> - Show all commands</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [newStaff, setNewStaff] = useState({ name: '', phone_number: '' });
  const [newCustomer, setNewCustomer] = useState({ name: '', phone_number: '', stamps: 0, rewards: 0 });
  const [editingStaff, setEditingStaff] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
    fetchCustomers();
    fetchStaff();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/analytics/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API}/customers`);
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await axios.get(`${API}/staff`);
      setStaff(response.data);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    }
  };

  const addStaff = async () => {
    try {
      await axios.post(`${API}/staff`, newStaff);
      setNewStaff({ name: '', phone_number: '' });
      fetchStaff();
      toast({
        title: "Staff Added",
        description: `${newStaff.name} has been added as authorized staff.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to add staff member.",
        variant: "destructive",
      });
    }
  };

  const updateStaff = async () => {
    try {
      await axios.put(`${API}/staff/${editingStaff.phone_number}`, {
        name: editingStaff.name,
        phone_number: editingStaff.phone_number
      });
      setEditingStaff(null);
      fetchStaff();
      toast({
        title: "Staff Updated",
        description: "Staff member has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update staff member.",
        variant: "destructive",
      });
    }
  };

  const removeStaff = async (phoneNumber) => {
    try {
      await axios.delete(`${API}/staff/${phoneNumber}`);
      fetchStaff();
      toast({
        title: "Staff Removed",
        description: "Staff member has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove staff member.",
        variant: "destructive",
      });
    }
  };

  const addCustomer = async () => {
    try {
      await axios.post(`${API}/customers`, newCustomer);
      setNewCustomer({ name: '', phone_number: '', stamps: 0, rewards: 0 });
      fetchCustomers();
      fetchStats();
      toast({
        title: "Customer Added",
        description: `${newCustomer.name} has been added successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to add customer.",
        variant: "destructive",
      });
    }
  };

  const updateCustomer = async () => {
    try {
      await axios.put(`${API}/customers/${editingCustomer.customer_id}`, {
        name: editingCustomer.name,
        phone_number: editingCustomer.phone_number,
        stamps: parseInt(editingCustomer.stamps),
        rewards: parseInt(editingCustomer.rewards)
      });
      setEditingCustomer(null);
      fetchCustomers();
      fetchStats();
      toast({
        title: "Customer Updated",
        description: "Customer has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update customer.",
        variant: "destructive",
      });
    }
  };

  const removeCustomer = async (customerId, customerName) => {
    console.log('🐛 DELETE DEBUG: Attempting to delete customer:', customerId, 'Name:', customerName);
    
    // More explicit confirmation
    const confirmMessage = `Are you sure you want to delete customer "${customerName}" (ID: ${customerId})?\n\nThis action will:\n- Remove the customer from the system\n- Delete all their audit logs\n- Cannot be undone`;
    
    if (!window.confirm(confirmMessage)) {
      console.log('🐛 DELETE DEBUG: User cancelled deletion');
      return;
    }
    
    console.log('🐛 DELETE DEBUG: User confirmed deletion, proceeding...');
    
    try {
      console.log('🐛 DELETE DEBUG: Making API call to:', `${API}/customers/${customerId}`);
      const response = await axios.delete(`${API}/customers/${customerId}`);
      console.log('🐛 DELETE DEBUG: API response:', response.data);
      
      // Refresh data
      await fetchCustomers();
      await fetchStats();
      
      toast({
        title: "Customer Deleted",
        description: `Customer "${customerName}" has been deleted successfully.`,
      });
      console.log('🐛 DELETE DEBUG: Success toast shown');
    } catch (error) {
      console.error('🐛 DELETE DEBUG: Error occurred:', error);
      console.error('🐛 DELETE DEBUG: Error response:', error.response?.data);
      console.error('🐛 DELETE DEBUG: Error status:', error.response?.status);
      
      toast({
        title: "Error",
        description: error.response?.data?.detail || `Failed to delete customer "${customerName}".`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-customers">
              {stats?.total_customers || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="active-customers">
              {stats?.active_customers || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stamps</CardTitle>
            <Coffee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-stamps">
              {stats?.total_stamps || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="staff">Staff Management</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New Customer</CardTitle>
              <CardDescription>
                Manually add a customer to the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer-name">Name</Label>
                  <Input
                    id="customer-name"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder="Customer name"
                    data-testid="customer-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="customer-phone">Phone Number</Label>
                  <Input
                    id="customer-phone"
                    value={newCustomer.phone_number}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone_number: e.target.value })}
                    placeholder="e.g. +919876543210"
                    data-testid="customer-phone-input"
                  />
                </div>
                <div>
                  <Label htmlFor="customer-stamps">Initial Stamps</Label>
                  <Input
                    id="customer-stamps"
                    type="number"
                    min="0"
                    max="10"
                    value={newCustomer.stamps}
                    onChange={(e) => setNewCustomer({ ...newCustomer, stamps: parseInt(e.target.value) || 0 })}
                    data-testid="customer-stamps-input"
                  />
                </div>
                <div>
                  <Label htmlFor="customer-rewards">Initial Rewards</Label>
                  <Input
                    id="customer-rewards"
                    type="number"
                    min="0"
                    value={newCustomer.rewards}
                    onChange={(e) => setNewCustomer({ ...newCustomer, rewards: parseInt(e.target.value) || 0 })}
                    data-testid="customer-rewards-input"
                  />
                </div>
              </div>
              <Button onClick={addCustomer} disabled={!newCustomer.name || !newCustomer.phone_number} data-testid="add-customer-btn">
                <Users className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer List</CardTitle>
              <CardDescription>
                All registered customers and their progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customers.map((customer) => (
                  <div key={customer.customer_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-semibold">{customer.name}</div>
                      <div className="text-sm text-gray-600">ID: #{customer.customer_id}</div>
                      <div className="text-sm text-gray-600">{customer.phone_number}</div>
                    </div>
                    <div className="text-right mr-4">
                      <Badge variant={customer.stamps >= 10 ? "default" : "secondary"}>
                        {customer.stamps}/10 stamps
                      </Badge>
                      <div className="text-sm text-gray-600 mt-1">
                        {customer.rewards} rewards
                      </div>
                    </div>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingCustomer(customer)}
                        data-testid={`edit-customer-${customer.customer_id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeCustomer(customer.customer_id)}
                        data-testid={`delete-customer-${customer.customer_id}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {editingCustomer && (
            <Card>
              <CardHeader>
                <CardTitle>Edit Customer: {editingCustomer.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-customer-name">Name</Label>
                    <Input
                      id="edit-customer-name"
                      value={editingCustomer.name}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-customer-phone">Phone Number</Label>
                    <Input
                      id="edit-customer-phone"
                      value={editingCustomer.phone_number}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, phone_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-customer-stamps">Stamps</Label>
                    <Input
                      id="edit-customer-stamps"
                      type="number"
                      min="0"
                      max="10"
                      value={editingCustomer.stamps}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, stamps: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-customer-rewards">Rewards</Label>
                    <Input
                      id="edit-customer-rewards"
                      type="number"
                      min="0"
                      value={editingCustomer.rewards}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, rewards: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-x-2">
                  <Button onClick={updateCustomer}>Update Customer</Button>
                  <Button variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Staff Member</CardTitle>
              <CardDescription>
                Authorize staff members to add stamps and redeem rewards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="staff-name">Name</Label>
                  <Input
                    id="staff-name"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    placeholder="Staff member name"
                    data-testid="staff-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="staff-phone">Phone Number</Label>
                  <Input
                    id="staff-phone"
                    value={newStaff.phone_number}
                    onChange={(e) => setNewStaff({ ...newStaff, phone_number: e.target.value })}
                    placeholder="e.g. 1234567890"
                    data-testid="staff-phone-input"
                  />
                </div>
              </div>
              <Button onClick={addStaff} disabled={!newStaff.name || !newStaff.phone_number} data-testid="add-staff-btn">
                <Shield className="mr-2 h-4 w-4" />
                Add Staff Member
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Authorized Staff</CardTitle>
              <CardDescription>
                Current staff members who can manage customer passports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {staff.map((member) => (
                  <div key={member.phone_number} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-semibold">{member.name}</div>
                      <div className="text-sm text-gray-600">{member.phone_number}</div>
                    </div>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingStaff(member)}
                        data-testid={`edit-staff-${member.phone_number}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeStaff(member.phone_number)}
                        data-testid={`remove-staff-${member.phone_number}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {editingStaff && (
            <Card>
              <CardHeader>
                <CardTitle>Edit Staff: {editingStaff.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-staff-name">Name</Label>
                    <Input
                      id="edit-staff-name"
                      value={editingStaff.name}
                      onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-staff-phone">Phone Number</Label>
                    <Input
                      id="edit-staff-phone"
                      value={editingStaff.phone_number}
                      onChange={(e) => setEditingStaff({ ...editingStaff, phone_number: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-x-2">
                  <Button onClick={updateStaff}>Update Staff</Button>
                  <Button variant="outline" onClick={() => setEditingStaff(null)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="mx-auto mb-6 p-4 bg-amber-600 rounded-full w-fit">
            <Coffee className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Coffee Passport</h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            WhatsApp-powered digital loyalty program. Customers collect stamps, track progress, and unlock rewards through simple WhatsApp messages.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dashboard">
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700" data-testid="admin-dashboard-btn">
                <BarChart3 className="mr-2 h-5 w-5" />
                Admin Dashboard
              </Button>
            </Link>
            <Link to="/setup">
              <Button size="lg" variant="outline" data-testid="setup-whatsapp-btn">
                <QrCode className="mr-2 h-5 w-5" />
                Setup WhatsApp
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
                <Smartphone className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle>WhatsApp Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Customers interact through familiar WhatsApp messages. No app downloads required.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
                <Coffee className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle>Digital Stamps</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Staff verify purchases and add digital stamps. Collect 10 stamps to unlock rewards.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-purple-100 rounded-full w-fit">
                <Shield className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle>Staff Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Authorize staff members to manage customer passports and redeem rewards securely.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-6">How It Works</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-amber-600">For Customers:</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Send "JOIN" to create passport</li>
                <li>• Buy coffee & show ID to staff</li>
                <li>• Send "STATUS" to check progress</li>
                <li>• Send "REWARD" when you have 10 stamps</li>
                <li>• Show redemption message to get free coffee</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4 text-amber-600">For Staff:</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Verify customer purchase</li>
                <li>• Send "STAMP C1234" to add stamp</li>
                <li>• Send "REDEEM C1234" to confirm reward</li>
                <li>• Customer passport resets to 0/10</li>
                <li>• All actions are logged for audit</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={
            <div className="min-h-screen bg-gray-50">
              <div className="bg-white shadow">
                <div className="container mx-auto px-4 py-4">
                  <div className="flex items-center justify-between">
                    <Link to="/" className="flex items-center space-x-2">
                      <Coffee className="h-8 w-8 text-amber-600" />
                      <h1 className="text-2xl font-bold">Coffee Passport</h1>
                    </Link>
                    <Badge variant="outline">Admin Dashboard</Badge>
                  </div>
                </div>
              </div>
              <div className="container mx-auto px-4 py-8">
                <Dashboard />
              </div>
            </div>
          } />
          <Route path="/setup" element={
            <div className="min-h-screen bg-gray-50 py-12">
              <div className="container mx-auto px-4">
                <div className="max-w-lg mx-auto">
                  <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center space-x-2 text-amber-600 hover:text-amber-700">
                      <Coffee className="h-6 w-6" />
                      <span className="text-lg font-semibold">← Back to Coffee Passport</span>
                    </Link>
                  </div>
                  <WhatsAppQR />
                </div>
              </div>
            </div>
          } />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;